import { tileAt, ROAD_TILES } from './city_terrain.js';
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
  replant(b) {
    const planted=[...this.plants.values()].filter(p=>p.buildingId===b.id).length+this.seeds.filter(s=>s.buildingId===b.id).length;
    if(planted>=8 || b.lastSownAt===this.city.minute || b.inventory.sementes<1)return;
    for(let attempt=0;attempt<12;attempt++) {
      const x=Math.floor(b.door.x+this.city.random()*22-11),y=Math.floor(b.door.y+this.city.random()*22-11);
      if(this.sow(x,y,tileAt(this.city.world,x,y)===9?'pine':'oak',b.id)){b.lastSownAt=this.city.minute;b.inventory.sementes--;this.city.economy.consumed.sementes++;this.city.economy.recordGoods('replanting','sementes',1,b.id,null);return;}
    }
  }
  harvest(b,tree) {
    if(!tree || !this.plants.has(tree.id) || tree.stage!=='mature' || this.seeds.length>=NATURE_RULES.maxSeeds || !this.available(tree.x,tree.y,tree.species,b.id,tree.id))return false;
    const event=this.remove(tree,`cortada por ${b.entity.properties.name}`,{buildingId:b.id,quantity:PLANT_SPECIES[tree.species].wood});
    this.harvested++;this.sow(tree.x,tree.y,tree.species,b.id,event.id);return true;
  }
}
