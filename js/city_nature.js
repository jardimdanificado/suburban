import {INDUSTRIES} from './city_industries.js';
import { inventoryFree } from './city_inventory.js';
import { tileAt, ROAD_TILES } from './city_terrain.js?v=entrance-retaining-clearance-1';
import { TILE_WATER } from './world_gen.js?v=terrain-generation-reset-2-map-default-128';
import {reducedCadence} from './city_fast_forward.js';
import {NATURAL_PLANTS} from './plant_catalog.js';
import {FARM_CROPS} from './farm_crop_catalog.js';
export const PLANT_SPECIES={...NATURAL_PLANTS};
for(const [good,crop] of Object.entries(FARM_CROPS)){
 const species=crop.plantSpecies||good;if(PLANT_SPECIES[species])continue;
 PLANT_SPECIES[species]={label:crop.label,scientific:({cubensis:'Psilocybe cubensis',amanita:'Amanita muscaria',peyote:'Lophophora williamsii',trombeta_anjo:'Brugmansia suaveolens'})[species]||'',color:0x398a29,grow:crop.grow*12,wood:0,tree:false,form:'crop',renderSize:1,terrain:[0,9],crop:good,products:{[good]:3}};
}
const citizenFree=c=>{c.inventoryCapacity??=24;return inventoryFree(c);};
export const NATURE_RULES = { maxPlants: 1000, maxSeeds: 240, germinationMinutes: 360, seedAttemptsPerHour: 12 };
/** Bounded vegetation population. Seeds are records until germination, not extra entities. */
export class CityNature {
  constructor(city) { this.city = city; this.plants = new Map(); this.tiles = new Map(); this.seeds = []; this.growthEvents=new Map();this.growthEventsInitialized=false;this.germinated = 0; this.harvested = 0; this.lost = 0; }
  scheduleGrowth(plant){
    const grow=PLANT_SPECIES[plant.species]?.grow;if(!grow)return;
    const dueAt=plant.stage==='seedling'?plant.plantedAt+Math.ceil(grow/2):plant.stage==='young'?plant.plantedAt+grow:Infinity;
    if(!Number.isFinite(dueAt))return;const minute=Math.max(this.city.minute,dueAt),ids=this.growthEvents.get(minute)||[];ids.push(plant.id);this.growthEvents.set(minute,ids);
  }
  updateGrowthMinute(){
    if(!this.growthEventsInitialized){this.growthEvents=new Map();for(const plant of this.plants.values())this.scheduleGrowth(plant);this.growthEventsInitialized=true;}
    const due=this.growthEvents.get(this.city.minute);if(!due)return;this.growthEvents.delete(this.city.minute);
    for(const id of due){const plant=this.plants.get(id);if(!plant||plant.entity.destroyed)continue;const spec=this.normalizePlantSpecies(plant),stage=(this.city.minute-plant.plantedAt)/spec.grow>=1?'mature':'young';if(stage===plant.stage)continue;plant.stage=stage;plant.entity.properties.render.size=stage==='mature'?(spec.renderSize||1):.65;this.city.structureRevision++;if(stage==='mature')this.city.log(`${spec.label} chegou à maturidade.`,'nature',[],{kind:'plant-mature',plantId:plant.id,buildingId:plant.buildingId});this.scheduleGrowth(plant);}
  }
  available(x, y, species, buildingId = null, ignorePlantId = null) {
    const city = this.city, key = `${x},${y}`, spec = PLANT_SPECIES[species];
    if (!spec || !spec.terrain.includes(tileAt(city.world,x,y)) || ROAD_TILES.has(tileAt(city.world,x,y)) || city.world.hasSidewalk?.(x,y) || city.cardboardShelters?.has(key) || city.occupied.has(key) || city.furniture?.benches.some(b=>Math.floor(b.x)===x&&Math.floor(b.y)===y) || this.tiles.has(key) && this.tiles.get(key) !== ignorePlantId) return false;
    if (city.development.plots.some(p => (buildingId == null || p.buildingId !== buildingId) && x >= p.x && x < p.x+p.width && y >= p.y && y < p.y+p.depth)) return false;
    if (city.development.projects.some(p => !p.cancelled && p.status !== 'completed' && p.path?.some(t => Math.floor(t.x) === x && Math.floor(t.y) === y))) return false;
    if ([...city.lighting.sites.values()].some(p => p.status !== 'cancelled' && Math.floor(p.x) === x && Math.floor(p.y) === y)) return false;
    return !city.buildings.some(b => Math.floor(b.door.x) === x && Math.floor(b.door.y) === y);
  }
  spawn(x, y, species, { mature = false, buildingId = null } = {}) {
    if (this.plants.size >= NATURE_RULES.maxPlants || !this.available(x,y,species,buildingId)) return null;
    const spec = PLANT_SPECIES[species], city = this.city;
    const scaleSeed=Math.abs(Math.sin(x*12.9898+y*78.233+species.length*0.31)*43758.5453)%1;
    const entity = city.createEntity({x,y,properties:{name:spec.label,species,tree:spec.tree??(spec.wood>0),render:{color:spec.color,size:mature?(spec.renderSize||1):.3,skin:'feature_tree_full.png'}}});
    const plant = { id:entity.id,entity,species,x,y,buildingId,form:spec.form||(spec.tree||spec.wood>0?'tree':'flowering'),scientific:spec.scientific||'',visualScale:0.76+scaleSeed*0.52,plantedAt:city.minute-(mature?spec.grow:0),stage:mature?'mature':'seedling' };
    entity.properties.cityPlant = plant;
    this.plants.set(plant.id,plant); this.tiles.set(`${x},${y}`,plant.id);this.scheduleGrowth(plant); city.structureRevision++;city.obstacleRevision=(city.obstacleRevision||0)+1;
    return plant;
  }
  normalizePlantSpecies(plant) {
    if(!plant)return null;
    let species=plant.species??plant.entity?.properties?.species;
    if(!PLANT_SPECIES[species]){
      const savedName=plant.entity?.properties?.name;
      species=Object.keys(PLANT_SPECIES).find(key=>PLANT_SPECIES[key].label===savedName)||'tropical_almond';
      plant.species=species;
      const props=plant.entity?.properties;
      if(props){props.species=species;props.tree=PLANT_SPECIES[species].tree??(PLANT_SPECIES[species].wood>0);props.name=PLANT_SPECIES[species].label;props.render??={};props.render.color=PLANT_SPECIES[species].color;props.render.skin??='feature_tree_full.png';}
    }
    plant.species=species;
    const spec=PLANT_SPECIES[species];
    plant.form??=spec.form||(spec.tree||spec.wood>0?'tree':'flowering');plant.scientific??=spec.scientific||'';
    const props=plant.entity?.properties;
    if(props){props.cityPlant=plant;props.species=species;props.tree=spec.tree??(spec.wood>0);props.name=spec.label;props.render??={};props.render.color=spec.color;props.render.skin??='feature_tree_full.png';}
    return spec;
  }
  initialize() {
    const hall=this.city.buildings.find(b=>b.type==='townhall'); if(!hall)return;
    const species=Object.keys(PLANT_SPECIES);
    for(let attempt=0;attempt<2600 && this.plants.size<320;attempt++) {
      const angle=this.city.random()*Math.PI*2,distance=22+this.city.random()*95;
      const x=Math.floor(hall.door.x+Math.cos(angle)*distance),y=Math.floor(hall.door.y+Math.sin(angle)*distance);
      this.spawn(x,y,species[attempt%species.length],{mature:true});
    }
    // Add a dense, irregular fringe of palms along any reachable shoreline.
    // Sampling the whole map keeps bays and small coves from being overlooked.
    const waterSide=(x,y)=>[[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]].some(([dx,dy])=>tileAt(this.city.world,x+dx,y+dy)===TILE_WATER);
    for(let attempt=0;attempt<9000&&this.plants.size<460;attempt++){
      const x=Math.floor(this.city.random()*this.city.world.width),y=Math.floor(this.city.random()*this.city.world.height);
      if(waterSide(x,y)){const shoreline=['coconut_palm','royal_palm','traveller_palm','licuala_palm','jeriva_palm','buriti_palm','mangrove','sea_grape'];this.spawn(x,y,shoreline[Math.floor(this.city.random()*shoreline.length)],{mature:true});}
    }
    this.city.log(`${this.plants.size} árvores e arbustos compõem a vegetação inicial.`, 'nature', [], {kind:'vegetation-founded',quantity:this.plants.size});
  }
  seedNewFloraForExistingCities() {
    if(this.tropicaliaVarietyIndex==null)this.tropicaliaVarietyIndex=0;
    const additions=Object.keys(PLANT_SPECIES).filter(id=>PLANT_SPECIES[id].scientific||PLANT_SPECIES[id].form==='crop');
    if(this.plants.size>=NATURE_RULES.maxPlants)return;
    let placed=0,checked=0;
    while(this.tropicaliaVarietyIndex<additions.length&&placed<4&&checked<8){
      const species=additions[this.tropicaliaVarietyIndex++];checked++;
      if([...this.plants.values()].some(plant=>plant.species===species))continue;
      for(let attempt=0;attempt<48;attempt++){
        const x=Math.floor(this.city.random()*this.city.world.width),y=Math.floor(this.city.random()*this.city.world.height);
        if(this.spawn(x,y,species,{mature:true})){placed++;break;}
      }
    }
    if(this.tropicaliaVarietyIndex>=additions.length)this.tropicaliaVarietyIndex=additions.length;
  }
  sow(x,y,species,buildingId=null,parentEventId=null) {
    if(this.seeds.length>=NATURE_RULES.maxSeeds || !this.available(x,y,species,buildingId) || this.seeds.some(s=>s.x===x && s.y===y))return false;
    this.seeds.push({x,y,species,buildingId,parentEventId,dueAt:this.city.minute+NATURE_RULES.germinationMinutes}); return true;
  }
  remove(plant, reason, details={}) {
    plant.entity.destroyed=true;this.plants.delete(plant.id);this.tiles.delete(`${plant.x},${plant.y}`);this.city.structureRevision++;this.city.obstacleRevision=(this.city.obstacleRevision||0)+1;
    this.city.world.removeSidewalk?.(plant.x,plant.y);
    const label=this.normalizePlantSpecies(plant)?.label||'Vegetação';
    return this.city.log(`${label}: ${reason}.`,'nature',[],{kind:'plant-removed',plantId:plant.id,buildingId:plant.buildingId,...details});
  }
  hourly() {
    const city=this.city;this.reviewFellingLicenses();
    const reconcilePlants=reducedCadence(city,this,'plant-reconciliation',360,360,`${city.world.revision}:${city.buildings.length}:${this.plants.size}`);
    this.seedNewFloraForExistingCities();
    if(reconcilePlants)for(const plant of this.plants.values())this.normalizePlantSpecies(plant);
    for(const c of city.citizens){const job=c.forestryJob;if(!job)continue;const b=city.building(job.buildingId);if(c.entity.destroyed||!b||city.politics.officeHolder(c)||c.jobId!==b.id&&b.ownerId!==c.id){if(job.load){city.economy.lost.madeira+=job.load;city.log('Madeira em transporte perdida após interrupção da atividade florestal.','nature',[c.id],{kind:'forestry-cargo-lost',quantity:job.load,buildingId:job.buildingId});}c.forestryJob=null;}}
    if(reconcilePlants)for(const plant of [...this.plants.values()]) {
      if(plant.buildingId && !city.building(plant.buildingId))plant.buildingId=null;
      if(plant.entity.destroyed || !this.validExisting(plant)) {this.remove(plant,'vegetação removida por ocupação ou alteração do terreno');this.lost++;continue;}
      if(!city.fastForward){const progress=(city.minute-plant.plantedAt)/PLANT_SPECIES[plant.species].grow,stage=progress>=1?'mature':progress>=.5?'young':'seedling';if(stage!==plant.stage){plant.stage=stage;plant.entity.properties.render.size=stage==='mature'?(PLANT_SPECIES[plant.species].renderSize||1):stage==='young'?.65:.3;city.structureRevision++;if(stage==='mature')city.log(`${PLANT_SPECIES[plant.species].label} chegou à maturidade.`,'nature',[],{kind:'plant-mature',plantId:plant.id,buildingId:plant.buildingId});}}
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
    const species=this.normalizePlantSpecies(p);if(!species)return false;
    return species.terrain.includes(tileAt(city.world,p.x,p.y)) && !city.cardboardShelters?.has(`${p.x},${p.y}`) && !city.occupied.has(`${p.x},${p.y}`) &&
      !city.development.plots.some(l=>(p.buildingId == null || l.buildingId!==p.buildingId) && p.x>=l.x && p.x<l.x+l.width && p.y>=l.y && p.y<l.y+l.depth) &&
      ![...city.lighting.sites.values()].some(l=>l.built && Math.floor(l.x)===p.x && Math.floor(l.y)===p.y);
  }
  forestryTree(b) {
    return [...this.plants.values()].filter(p=>this.normalizePlantSpecies(p)?.wood && p.stage==='mature' && (!p.buildingId || p.buildingId===b.id) && Math.hypot(p.x-b.door.x,p.y-b.door.y)<=14 && this.validExisting(p))
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
      const tree=[...this.plants.values()].filter(p=>p.stage==='mature'&&this.normalizePlantSpecies(p)?.wood&&(!p.buildingId||p.buildingId===b.id)&&!claimed.has(p.id)&&Math.hypot(p.x-b.door.x,p.y-b.door.y)<=14&&this.validExisting(p)).sort((a,d)=>Math.hypot(a.x-c.entity.x,a.y-c.entity.y)-Math.hypot(d.x-c.entity.x,d.y-c.entity.y))[0];
      if(b.seedStock<1&&!(c.forestrySeeds>0))return false;
      if(tree&&!tree.buildingId&&city.justice?.policies.penalCode.unlicensedTreeFelling?.criminal&&!this.fellingLicense(b)&&!city.substances?.dealer(c)){this.requestFellingLicense(b);c.action='Aguardando licença municipal de corte';return false;}
      if(tree)job={buildingId:b.id,treeId:tree.id,x:tree.x+.5,y:tree.y+.5,species:tree.species,stage:'cut',labor:0,load:0};
      else{
        const planted=[...this.plants.values()].filter(p=>p.buildingId===b.id).length+this.seeds.filter(p=>p.buildingId===b.id).length;
        if(planted>=16)return false;
        for(let i=0;i<24&&!job;i++){
          const x=Math.floor(b.door.x+city.random()*24-12),y=Math.floor(b.door.y+city.random()*24-12),options=tileAt(city.world,x,y)===0?['banana','mango','guava','jackfruit','breadfruit','papaya','cacao','soursop','ackee','lime','allspice','coconut_palm','sea_grape','pau_brasil','yellow_ipe','quaresmeira','pitanga','jabuticaba','frangipani','clusia']:['mango','guava','avocado','tamarind','lime','coconut_palm','royal_palm','tropical_almond','jeriva_palm','buriti_palm'],species=options[Math.floor(city.random()*options.length)];
          if(this.available(x,y,species,b.id)&&!this.seeds.some(s=>s.x===x&&s.y===y)&&!city.citizens.some(v=>v.forestryJob?.x===x+.5&&v.forestryJob?.y===y+.5))job={buildingId:b.id,x:x+.5,y:y+.5,species,stage:'plant',labor:0,load:0};
        }
      }
      if(!job)return false;if(!(c.forestrySeeds>0)){b.seedStock--;c.forestrySeeds=1;}c.forestryJob=job;
    }
    const destination=job.stage==='return'?b.door:job;
    if(Math.hypot(c.entity.x-destination.x,c.entity.y-destination.y)>1.2){
      const path=job.stage==='cut'?this.interactionPath(c,destination):city.findPath(c.entity,destination);
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
      const tree=this.plants.get(job.treeId);if(!tree||tree.stage!=='mature'||!(this.normalizePlantSpecies(tree)?.wood>0)){c.forestryJob=null;return false;}
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
  products(plant){return PLANT_SPECIES[plant.species]?.products||{};}
  stock(plant,good){
    const maximum=this.products(plant)[good]||0;if(plant.stage!=='mature'||plant.entity.destroyed)return 0;
    const record=plant.gatheredProducts?.[good];return !record||this.city.minute>=record.readyAt?maximum:record.remaining;
  }
  collect(c,plant,good,quantity=1){
    if(!c||c.entity.destroyed||c.custody||c.sleep?.active||c.indoorLocation||!this.plants.has(plant?.id)||plant.buildingId||Math.hypot(c.entity.x-plant.x-.5,c.entity.y-plant.y-.5)>1.6)return 0;
    const available=this.stock(plant,good),q=Math.min(Math.max(0,Math.floor(quantity)),available,citizenFree(c));if(!(q>0))return 0;
    plant.gatheredProducts??={};const record=plant.gatheredProducts[good],readyAt=record&&this.city.minute<record.readyAt?record.readyAt:this.city.minute+Math.max(180,PLANT_SPECIES[plant.species].grow/4);
    plant.gatheredProducts[good]={remaining:available-q,readyAt};c.inventory??={};c.inventory[good]=(c.inventory[good]||0)+q;
    const economy=this.city.economy;economy.produced[good]=(economy.produced[good]||0)+q;economy.recordGoods('wild-harvest',good,q,plant.id,c.id,{species:plant.species});this.city.substances?.addLot(c,good,q,55,'wild-harvest');
    this.city.log(`${c.entity.properties.name} colheu ${q} ${economy.goods[good].label.toLowerCase()} na natureza.`,'nature',[c.id],{kind:'wild-harvest',plantId:plant.id,good,quantity:q});return q;
  }
  productsForFood(good){return !!FARM_CROPS[good]&&!FARM_CROPS[good].nonFood;}
  eat(c,good){
    if(!FARM_CROPS[good]||FARM_CROPS[good].nonFood||!(c.inventory?.[good]>0)||c.custody||c.sleep?.active)return false;
    c.inventory[good]--;this.city.economy.consumed[good]=(this.city.economy.consumed[good]||0)+1;this.city.economy.recordGoods('wild-food-consumed',good,1,c.id,null);c.needs.food=Math.min(100,c.needs.food+18);return true;
  }
  interactionPath(c,point){
    const city=this.city,x=Math.floor(point.x),y=Math.floor(point.y);
    if(city.walkable(x,y))return city.findPath(c.entity,point);
    const approaches=[[0,1],[1,0],[0,-1],[-1,0]].map(([dx,dy])=>({x:x+dx+.5,y:y+dy+.5})).sort((a,b)=>Math.hypot(a.x-c.entity.x,a.y-c.entity.y)-Math.hypot(b.x-c.entity.x,b.y-c.entity.y));
    for(const approach of approaches){if(!city.walkable(Math.floor(approach.x),Math.floor(approach.y)))continue;const path=city.findPath(c.entity,approach);if(path!==null)return path;}
    return null;
  }
  routeGather(c,plant,good){
    if(!plant||!this.stock(plant,good)||plant.buildingId||citizenFree(c)<1||c.custody||c.sleep?.active)return false;
    const point={x:plant.x+.5,y:plant.y+.5},path=this.interactionPath(c,point);if(path===null)return false;
    c.forageJob={plantId:plant.id,good,progress:0};c.task='forage';c.targetId=null;c.path=path;c.action='Indo colher uma planta silvestre';return true;
  }
  sell(c,b,good,quantity=1){
    const city=this.city,controlled=city.substances?.controlled(good),illegal=controlled&&city.substances.law(controlled).regime==='prohibited';
    if(!b?.active||b.entity.destroyed||Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)>1.6||illegal&&!city.substances.dealer(c))return 0;
    if(!city.substances?.canTrade(good,c,b,{quantity,illegal}))return 0;
    const price=Math.max(1,Math.floor((city.economy.goods[good]?.price||0)*.55)),q=Math.min(Math.floor(quantity),c.inventory?.[good]||0,inventoryFree(b),Math.floor(b.balance/price));
    if(!(q>0)||!city.transfer(b.accountId,c.accountId,q*price,'Compra de produtos coletados',{good,quantity:q}))return 0;
    city.substances?.moveLots(c,b,good,q);c.inventory[good]-=q;b.inventory[good]=(b.inventory[good]||0)+q;b.totalExpenses=(b.totalExpenses||0)+q*price;city.economy.recordGoods('wild-harvest-sale',good,q,c.id,b.id);if(illegal)city.substances.observeIllegalSale(b,c,good,q);return q;
  }
  plantCutting(c,good,x,y){
    const species=FARM_CROPS[good]?.plantSpecies;if(!good.startsWith('muda_')||!species||!(c.inventory?.[good]>0)||Math.hypot(c.entity.x-x-.5,c.entity.y-y-.5)>1.6||!this.sow(x,y,species))return false;
    c.inventory[good]--;this.city.economy.consumed[good]++;this.city.economy.recordGoods('cutting-planted',good,1,c.id,null);return true;
  }
  consider(c,{foodOnly=false}={}){
    const city=this.city;if(c.custody||c.sleep?.active||c.indoorLocation||c.deliveryId||c.mobilityTrip||!city.society.isAdult(c))return false;
    if(c.needs.food<80){const food=Object.keys(c.inventory||{}).find(g=>c.inventory[g]>0&&FARM_CROPS[g]&&!FARM_CROPS[g].nonFood);if(food&&this.eat(c,food))return true;}
    if(city.minute-(c.lastForageDecisionAt??-Infinity)<90)return false;c.lastForageDecisionAt=city.minute;
    if(!foodOnly){
      const good=Object.keys(c.inventory||{}).find(g=>c.inventory[g]>0&&FARM_CROPS[g]);
      if(good){
        if(good.startsWith('muda_'))for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])if(this.plantCutting(c,good,Math.floor(c.entity.x)+dx,Math.floor(c.entity.y)+dy))return true;
        const controlled=city.substances?.controlled(good),illegal=controlled&&city.substances.law(controlled).regime==='prohibited';
        const buyers=city.buildings.filter(b=>b.active&&!b.entity.destroyed&&Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y)<20&&((!FARM_CROPS[good].nonFood&&['market','greengrocer','restaurant'].includes(b.type))||b.type==='farm'&&b.crop===good||city.economy.goods[good]&&INDUSTRIES[b.type]?.inputs?.[good])).sort((a,b)=>Math.hypot(a.door.x-c.entity.x,a.door.y-c.entity.y)-Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y));
        if(!illegal||city.substances.dealer(c))for(const b of buyers.slice(0,3)){if(illegal&&!city.substances.dealer(city.society.citizen(b.ownerId)||{}))continue;if(inventoryFree(b)<1||b.balance<(city.economy.goods[good].price||0))continue;const path=city.findPath(c.entity,b.door);if(path!==null){c.forageSale={buildingId:b.id,good};c.task='forage-sale';c.targetId=b.id;c.path=path;return true;}}
      }
    }
    if(citizenFree(c)<1)return false;
    const x=Math.floor(c.entity.x),y=Math.floor(c.entity.y),candidates=[];
    // Tile index bounds each decision; never scan the vegetation population.
    for(let dy=-7;dy<=7;dy++)for(let dx=-7;dx<=7;dx++){const plant=this.plants.get(this.tiles.get(`${x+dx},${y+dy}`));if(!plant||plant.buildingId||plant.stage!=='mature')continue;for(const good of Object.keys(this.products(plant))){if(!this.stock(plant,good)||foodOnly&&FARM_CROPS[good]?.nonFood)continue;const id=city.substances?.controlled(good);if(id&&!city.substances.initialize(c).uses[id]?.potential&&!city.substances.dealer(c))continue;candidates.push({plant,good,d:dx*dx+dy*dy});}}
    candidates.sort((a,b)=>a.d-b.d);for(const {plant,good}of candidates.slice(0,3))if(this.routeGather(c,plant,good))return true;return false;
  }
  perform(c){
    if(c.task==='forage-sale'){if(c.path.length)return;const job=c.forageSale;this.sell(c,this.city.building(job?.buildingId),job?.good,c.inventory?.[job?.good]||0);c.forageSale=null;c.task=null;c.targetId=null;return;}
    const job=c.forageJob,plant=this.plants.get(job?.plantId);if(c.path.length)return;
    if(!plant||Math.hypot(c.entity.x-plant.x-.5,c.entity.y-plant.y-.5)>1.6){c.task=null;c.forageJob=null;return;}
    c.lastProgressAt=this.city.minute;c.action=`Colhendo ${PLANT_SPECIES[plant.species].label.toLowerCase()}`;if(++job.progress<6)return;
    this.collect(c,plant,job.good,3);if(c.needs.food<80)this.eat(c,job.good);c.task=null;c.forageJob=null;
  }
  requestFellingLicense(holder){
    this.fellingLicenses??=[];if(!holder?.accountId)return null;
    const existing=this.fellingLicenses.find(p=>p.holderId===holder.id&&(p.status==='pending'||p.status==='approved'&&p.expiresAt>this.city.minute&&p.remaining>0));if(existing)return existing;
    const permit={id:this.fellingLicenses.length+1,holderId:holder.id,accountId:holder.accountId,status:'pending',requestedAt:this.city.minute,decideAt:this.city.minute+60,remaining:8};this.fellingLicenses.push(permit);return permit;
  }
  fellingLicense(holder){return this.fellingLicenses?.find(p=>p.holderId===holder?.id&&p.accountId===holder.accountId&&p.status==='approved'&&p.expiresAt>this.city.minute&&p.remaining>0);}
  reviewFellingLicenses(){
    for(const permit of this.fellingLicenses||[]){if(permit.status!=='pending'||this.city.minute<permit.decideAt)continue;
      const holder=this.city.building(permit.holderId)||this.city.society.citizen(permit.holderId),paid=holder&&!holder.entity.destroyed&&holder.accountId===permit.accountId&&this.city.transfer(holder.accountId,'treasury',this.city.currency.price(80),'Licença municipal de manejo florestal',{kind:'felling-license',permitId:permit.id});
      permit.status=paid?'approved':'rejected';permit.expiresAt=this.city.minute+7*1440;permit.decidedAt=this.city.minute;this.city.log(`Licença florestal #${permit.id}: ${paid?'aprovada por sete dias, até oito árvores':'recusada por falta de recursos ou titular inválido'}.`,'government',[],{kind:'felling-license-decided',permitId:permit.id});
    }
  }
  harvest(b,tree,worker){
    if(!worker||!tree||!this.plants.has(tree.id)||tree.stage!=='mature'||Math.hypot(worker.entity.x-tree.x-.5,worker.entity.y-tree.y-.5)>1.6)return false;
    if(!(this.normalizePlantSpecies(tree)?.wood>0))return false;
    const license=this.fellingLicense(b)||this.fellingLicense(worker);
    if(!tree.buildingId&&this.city.justice?.policies.penalCode.unlicensedTreeFelling?.criminal){if(license)license.remaining--;else this.city.justice.crimeRecord('unlicensedTreeFelling',worker.id,null,{position:{x:tree.x,y:tree.y},plantId:tree.id,species:tree.species,physicalEvidence:true,buildingId:b?.id??null});}
    const event=this.remove(tree,`cortada por ${worker.entity.properties.name}`,{citizenIds:[worker.id],buildingId:b?.id??null,quantity:PLANT_SPECIES[tree.species].wood});
    this.harvested++;this.city.economy.produced.madeira+=PLANT_SPECIES[tree.species].wood;return event;
  }
}
