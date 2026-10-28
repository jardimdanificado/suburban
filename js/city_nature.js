import { inventoryFree } from './city_inventory.js';
import { tileAt, ROAD_TILES } from './city_terrain.js?v=business-heights-1';
export const PLANT_SPECIES = {
  oak: { label: 'Carvalho', color: 0x6c994b, grow: 3 * 1440, wood: 4, terrain: [0,9] },
  pine: { label: 'Pinheiro', color: 0x527d55, grow: 4 * 1440, wood: 4, terrain: [0,9] },
  willow: { label: 'Salgueiro', color: 0x81a967, grow: 3 * 1440, wood: 4, terrain: [0] },
  birch: { label: 'Bétula', color: 0xa7bc70, grow: 3 * 1440, wood: 4, terrain: [0,9] },
  maple: { label: 'Bordo', color: 0xc99352, grow: 3 * 1440, wood: 4, terrain: [0,9] },
  cherry_blossom: { label: 'Cerejeira', color: 0xd899b1, grow: 3 * 1440, wood: 4, terrain: [0] },
  berry: { label: 'Amoreira', color: 0x73934c, grow: 1440, wood: 0, terrain: [0,9] },
};
export const NATURE_RULES = { maxPlants: 640, maxSeeds: 160, germinationMinutes: 360, seedAttemptsPerHour: 12 };
/** Bounded vegetation population. Seeds are records until germination, not extra entities. */
export class CityNature {
  constructor(city) { this.city = city; this.plants = new Map(); this.tiles = new Map(); this.seeds = []; this.germinated = 0; this.harvested = 0; this.lost = 0; }
  available(x, y, species, buildingId = null, ignorePlantId = null) {
    const city = this.city, key = `${x},${y}`, spec = PLANT_SPECIES[species];
    if (!spec || !spec.terrain.includes(tileAt(city.world,x,y)) || ROAD_TILES.has(tileAt(city.world,x,y)) || city.occupied.has(key) || this.tiles.has(key) && this.tiles.get(key) !== ignorePlantId) return false;
    if (city.development.plots.some(p => (buildingId == null || p.buildingId !== buildingId) && x >= p.x && x < p.x+p.width && y >= p.y && y < p.y+p.depth)) return false;
    if (city.development.projects.some(p => !p.cancelled && p.status !== 'completed' && p.path?.some(t => Math.floor(t.x) === x && Math.floor(t.y) === y))) return false;
    if ([...city.lighting.sites.values()].some(p => p.status !== 'cancelled' && Math.floor(p.x) === x && Math.floor(p.y) === y)) return false;
    return !city.buildings.some(b => Math.floor(b.door.x) === x && Math.floor(b.door.y) === y);
  }
  spawn(x, y, species, { mature = false, buildingId = null } = {}) {
    if (this.plants.size >= NATURE_RULES.maxPlants || !this.available(x,y,species,buildingId)) return null;
    const spec = PLANT_SPECIES[species], city = this.city;
    const entity = city.createEntity({x,y,properties:{name:spec.label,species,tree:spec.wood>0,render:{color:spec.color,size:mature?1:.3,skin:species==='pine'?'feature_tree_pine.png':'feature_tree_full.png'}}});
    const plant = { id:entity.id,entity,species,x,y,buildingId,plantedAt:city.minute-(mature?spec.grow:0),stage:mature?'mature':'seedling' };
    entity.properties.cityPlant = plant;
    this.plants.set(plant.id,plant); this.tiles.set(`${x},${y}`,plant.id); city.structureRevision++;
    return plant;
  }
  initialize() {
    const hall=this.city.buildings.find(b=>b.type==='townhall'); if(!hall)return;
    const species=Object.keys(PLANT_SPECIES);
    for(let attempt=0;attempt<900 && this.plants.size<160;attempt++) {
      const angle=this.city.random()*Math.PI*2,distance=22+this.city.random()*95;
      const x=Math.floor(hall.door.x+Math.cos(angle)*distance),y=Math.floor(hall.door.y+Math.sin(angle)*distance);
      this.spawn(x,y,species[attempt%species.length],{mature:true});
    }
    this.city.log(`${this.plants.size} árvores e arbustos compõem a vegetação inicial.`, 'nature', [], {kind:'vegetation-founded',quantity:this.plants.size});
  }
  sow(x,y,species,buildingId=null,parentEventId=null) {
    if(this.seeds.length>=NATURE_RULES.maxSeeds || !this.available(x,y,species,buildingId) || this.seeds.some(s=>s.x===x && s.y===y))return false;
    this.seeds.push({x,y,species,buildingId,parentEventId,dueAt:this.city.minute+NATURE_RULES.germinationMinutes}); return true;
  }
  remove(plant, reason, details={}) {
    plant.entity.destroyed=true;this.plants.delete(plant.id);this.tiles.delete(`${plant.x},${plant.y}`);this.city.structureRevision++;
    return this.city.log(`${PLANT_SPECIES[plant.species].label}: ${reason}.`,'nature',[],{kind:'plant-removed',plantId:plant.id,buildingId:plant.buildingId,...details});
  }
  hourly() {
    const city=this.city;
    for(const c of city.citizens){const job=c.forestryJob;if(!job)continue;const b=city.building(job.buildingId);if(c.entity.destroyed||!b||city.politics.officeHolder(c)||c.jobId!==b.id&&b.ownerId!==c.id){if(job.load){city.economy.lost.madeira+=job.load;city.log('Madeira em transporte perdida após interrupção da atividade florestal.','nature',[c.id],{kind:'forestry-cargo-lost',quantity:job.load,buildingId:job.buildingId});}c.forestryJob=null;}}
    for(const plant of [...this.plants.values()]) {
      if(plant.buildingId && !city.building(plant.buildingId))plant.buildingId=null;
      if(plant.entity.destroyed || !this.validExisting(plant)) {this.remove(plant,'vegetação removida por ocupação ou alteração do terreno');this.lost++;continue;}
      const progress=(city.minute-plant.plantedAt)/PLANT_SPECIES[plant.species].grow;
      const stage=progress>=1?'mature':progress>=.5?'young':'seedling';
      if(stage!==plant.stage) {
        plant.stage=stage;plant.entity.properties.render.size=stage==='mature'?1:stage==='young'?.65:.3;city.structureRevision++;
        if(stage==='mature')city.log(`${PLANT_SPECIES[plant.species].label} chegou à maturidade.`,'nature',[],{kind:'plant-mature',plantId:plant.id,buildingId:plant.buildingId});
      }
    }
    let budget=NATURE_RULES.seedAttemptsPerHour;
    for(const seed of [...this.seeds]) {
      if(seed.dueAt>city.minute || budget--<=0)continue;
      this.seeds.splice(this.seeds.indexOf(seed),1);
      if(seed.buildingId && !city.building(seed.buildingId))continue;
      const plant=this.spawn(seed.x,seed.y,seed.species,{buildingId:seed.buildingId});
      if(plant){this.germinated++;city.log(`${PLANT_SPECIES[seed.species].label} germinou.`,'nature',[],{kind:'plant-germinated',plantId:plant.id,buildingId:seed.buildingId,parentEventId:seed.parentEventId});}
    }
    // At most two natural dispersals per hour, even in accelerated simulation.
    const candidates=[...this.plants.values()].filter(p=>p.stage==='mature' && !p.buildingId);
    for(let i=0;i<Math.min(2,candidates.length);i++) {
      if(city.random()>.2)continue;
      const parent=candidates[Math.floor(city.random()*candidates.length)],dx=Math.floor(city.random()*9)-4,dy=Math.floor(city.random()*9)-4;
      this.sow(parent.x+dx,parent.y+dy,parent.species);
    }
  }
  validExisting(p) {
    const city=this.city;
    return PLANT_SPECIES[p.species].terrain.includes(tileAt(city.world,p.x,p.y)) && !city.occupied.has(`${p.x},${p.y}`) &&
      !city.development.plots.some(l=>(p.buildingId == null || l.buildingId!==p.buildingId) && p.x>=l.x && p.x<l.x+l.width && p.y>=l.y && p.y<l.y+l.depth) &&
      ![...city.lighting.sites.values()].some(l=>l.built && Math.floor(l.x)===p.x && Math.floor(l.y)===p.y);
  }
  forestryTree(b) {
    return [...this.plants.values()].filter(p=>PLANT_SPECIES[p.species].wood && p.stage==='mature' && (!p.buildingId || p.buildingId===b.id) && Math.hypot(p.x-b.door.x,p.y-b.door.y)<=14 && this.validExisting(p))
      .sort((a,c)=>Math.hypot(a.x-b.door.x,a.y-b.door.y)-Math.hypot(c.x-b.door.x,c.y-b.door.y))[0];
  }
  // Workers reserve one tree or planting site and physically visit it.
  forestryWork(b,c){
    const city=this.city;city.economy.buySeeds(b);
    let job=c.forestryJob;
    if(job&&job.buildingId!==b.id)return false;
    if(!job){
      if(inventoryFree(b)<4||b.inventory.madeira>=48||city.minute<(b.forestryBlockedUntil||0))return false;
      const claimed=new Set(city.citizens.filter(v=>v.forestryJob).map(v=>v.forestryJob.treeId));
      const tree=[...this.plants.values()].filter(p=>p.stage==='mature'&&PLANT_SPECIES[p.species].wood&&(!p.buildingId||p.buildingId===b.id)&&!claimed.has(p.id)&&Math.hypot(p.x-b.door.x,p.y-b.door.y)<=14&&this.validExisting(p)).sort((a,d)=>Math.hypot(a.x-c.entity.x,a.y-c.entity.y)-Math.hypot(d.x-c.entity.x,d.y-c.entity.y))[0];
      if(b.seedStock<1&&!(c.forestrySeeds>0))return false;
      if(tree)job={buildingId:b.id,treeId:tree.id,x:tree.x+.5,y:tree.y+.5,species:tree.species,stage:'cut',labor:0,load:0};
      else{
        const planted=[...this.plants.values()].filter(p=>p.buildingId===b.id).length+this.seeds.filter(p=>p.buildingId===b.id).length;
        if(planted>=16)return false;
        for(let i=0;i<24&&!job;i++){
          const x=Math.floor(b.door.x+city.random()*24-12),y=Math.floor(b.door.y+city.random()*24-12),species=tileAt(city.world,x,y)===9?'pine':'oak';
          if(this.available(x,y,species,b.id)&&!this.seeds.some(s=>s.x===x&&s.y===y)&&!city.citizens.some(v=>v.forestryJob?.x===x+.5&&v.forestryJob?.y===y+.5))job={buildingId:b.id,x:x+.5,y:y+.5,species,stage:'plant',labor:0,load:0};
        }
      }
      if(!job)return false;if(!(c.forestrySeeds>0)){b.seedStock--;c.forestrySeeds=1;}c.forestryJob=job;
    }
    const destination=job.stage==='return'?b.door:job;
    if(Math.hypot(c.entity.x-destination.x,c.entity.y-destination.y)>1.2){
      const path=city.findPath(c.entity,destination);
      if(path===null){c.action='Sem caminho para a atividade florestal';if(!job.load){c.forestryJob=null;b.forestryBlockedUntil=city.minute+60;}return false;}
      c.path=path;c.action=job.stage==='return'?'Levando madeira à silvicultura':job.stage==='cut'?'Indo cortar uma árvore':'Indo plantar uma árvore';return true;
    }
    if(job.stage==='return'){
      if(inventoryFree(b)<job.load){c.action='Aguardando espaço para descarregar madeira';return false;}
      b.inventory.madeira+=job.load;
      if(job.load>0)city.economy.recordGoods('forestry-delivery','madeira',job.load,null,b.id,{citizenIds:[c.id],plantId:job.treeId,parentEventId:job.harvestEventId});
      c.forestryJob=null;c.action='Descarregando a madeira cortada';return true;
    }
    if(job.stage==='cut'){
      const tree=this.plants.get(job.treeId);if(!tree||tree.stage!=='mature'){c.forestryJob=null;return false;}
      job.labor+=1+(c.skills.agriculture||0)/80+(c.toolUntil>city.minute?.3:0);c.action=`Cortando ${PLANT_SPECIES[tree.species].label.toLowerCase()}`;
      if(job.labor<45)return true;
      const event=this.harvest(b,tree,c);if(!event)return false;
      job.load=PLANT_SPECIES[tree.species].wood;job.harvestEventId=event.id;job.stage='plant';job.labor=0;return true;
    }
    c.action='Plantando árvore para renovar a floresta';
    if(!(c.forestrySeeds>0))return false;
    job.labor+=1+(c.skills.agriculture||0)/100;if(job.labor<12)return true;
    const x=Math.floor(job.x),y=Math.floor(job.y);
    if(this.sow(x,y,job.species,b.id,job.harvestEventId)){
      c.forestrySeeds--;city.economy.consumed.sementes++;city.economy.recordGoods('replanting','sementes',1,b.id,null,{citizenIds:[c.id]});
      city.log(`${c.entity.properties.name} plantou uma árvore.`, 'nature',[c.id],{kind:'tree-planted',buildingId:b.id,species:job.species,x,y,parentEventId:job.harvestEventId});
    }else if(this.available(x,y,job.species,b.id)&&!this.seeds.some(s=>s.x===x&&s.y===y))return false;
    job.stage='return';return true;
  }
  harvest(b,tree,worker){
    if(!worker||!tree||!this.plants.has(tree.id)||tree.stage!=='mature'||Math.hypot(worker.entity.x-tree.x-.5,worker.entity.y-tree.y-.5)>1.6)return false;
    const event=this.remove(tree,`cortada por ${worker.entity.properties.name}`,{citizenIds:[worker.id],buildingId:b.id,quantity:PLANT_SPECIES[tree.species].wood});
    this.harvested++;this.city.economy.produced.madeira+=PLANT_SPECIES[tree.species].wood;return event;
  }
}
