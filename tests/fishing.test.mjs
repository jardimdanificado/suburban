import test from 'node:test';
import assert from 'node:assert/strict';
import {fishHabitat,fishingWaters,fishingWork,advanceFishing,fishSupplyInputs} from '../js/city_fishing.js';
import {FISH_SPECIES,FISHING_RULES} from '../js/fishing_catalog.js';
import {TILE_FLOOR,TILE_WATER} from '../js/world_gen.js';
import {CitySimulation} from '../js/city_simulation.js';
import {CityEconomy,GOODS,JOB_SKILL} from '../js/city_economy.js';
import {INDUSTRIES,KITCHEN_RECIPES} from '../js/city_industries.js';
import {citizenAnimation} from '../js/city_citizen_models.js';
import {packFishing,applyFishing} from '../js/fishing_motion.js';
import {advanceLocalBoatTrip} from '../js/city_boat_towing.js';
function fixture({boat=false,chair=true,salt=false,inland=false}={}){
 const width=32,height=24,map=new Uint8Array(width*height).fill(TILE_FLOOR),world={width,height,map,revision:1,getTile(x,y){return x<0||y<0||x>=width||y>=height?5:map[y*width+x];}};
 for(let y=4;y<(salt?height:21);y++)for(let x=12;x<23;x++)map[y*width+x]=TILE_WATER;
 const c={id:1,accountId:'person:1',businessIds:[],entity:{x:8.5,y:12.5,properties:{}},task:'work',targetId:7,jobId:7,path:[],skills:{fishing:0,baking:0,construction:0},traits:{},needs:{},equipment:{}};c.entity.properties.citizen=c;
 const b={id:7,type:'fishery',active:true,accountId:'business:7',door:{x:8.5,y:12.5},entity:{x:7,y:11},inventory:Object.fromEntries(Object.keys(GOODS).map(g=>[g,0])),inventoryCapacity:128,incoming:{},units:[]};b.inventory.vara_pesca=2;b.inventory.moveis=+chair;
 const events=[],city=Object.assign(Object.create(CitySimulation.prototype),{world,citizens:[c],buildings:[b],building:id=>id===b.id?b:null,minute:600,occupied:new Set(),obstacleRevision:0,structureRevision:0,pathCache:new Map(),random:()=>.5,vehicles:{units:new Map()},logistics:{shipments:[]},society:{citizen:id=>id===c.id?c:null},worldPort:{accountId:'port'}});
 city.economy={produced:Object.fromEntries(Object.keys(GOODS).map(g=>[g,0])),consumed:Object.fromEntries(Object.keys(GOODS).map(g=>[g,0])),recordGoods:(...args)=>events.push(args)};
 const canoe={id:2,boatClass:'canoe',good:'canoe',active:true,condition:100,x:inland?9.5:12.5,y:12.5,ownerAccountId:b.accountId,entity:{x:12.5,y:12.5},pickLength:2.6,pickWidth:.65};
 if(boat)city.vehicles.units.set(canoe.id,canoe);
 if(inland)city.vehicles.units.set(3,{id:3,good:'bicicleta',active:true,condition:100,x:c.entity.x,y:c.entity.y,ownerAccountId:b.accountId,entity:{x:c.entity.x,y:c.entity.y}});
 return {city,c,b,events,canoe};
}
function walk(c){if(c.path.length){const last=c.path.at(-1);c.entity.x=last.x;c.entity.y=last.y;c.path=[];}}
function tick(f,minutes=1){for(let m=0;m<minutes;m++){f.city.minute++;fishingWork(f.city,f.b,f.c);for(let i=0;i<100;i++){const controlled=advanceFishing(f.city,f.c,.05);if(!controlled){if(f.c.localBoatTrip||f.c.path[0]?.boatPlan)advanceLocalBoatTrip(f.city,f.c,.05);else walk(f.c);}}}}

test('connected water bodies distinguish freshwater, seawater, shore and middle and invalidate on terrain changes',()=>{
 const {city}=fixture(),world=city.world;
 assert.equal(fishHabitat(world,12,12).salinity,'fresh');assert.deepEqual(fishHabitat(world,12,12).species,['tilapia']);assert.deepEqual(fishHabitat(world,17,12).species,['pacu']);assert.equal(fishHabitat(world,8,12),null);
 const before=fishingWaters(world);for(let y=21;y<24;y++)world.map[y*world.width+17]=TILE_WATER;world.revision++;
 assert.notEqual(fishingWaters(world),before);assert.deepEqual(fishHabitat(world,12,12).species,['robalo']);assert.deepEqual(fishHabitat(world,17,12).species,['cavala']);
 // Diagonal contact alone does not turn a closed pond into sea.
 world.map[0]=TILE_WATER;world.map[world.width+1]=TILE_WATER;world.revision++;assert.equal(fishHabitat(world,1,1).salinity,'fresh');
});

test('shore fishers use a real rod and optional chair, catch local species and deliver before stocking the business',()=>{
 for(const chair of [true,false]){const f=fixture({chair});tick(f,2);assert(f.c.fishingPose);assert.equal(f.c.fishingPose.chair,chair);assert.equal(citizenAnimation(f.c),chair?'sentado_no_banco':'sentado_no_chao');assert.equal(f.b.inventory.vara_pesca,1);assert.equal(f.b.inventory.moveis,0);
  tick(f,6);assert.equal(f.b.inventory.tilapia,0,'catch remains physically with the fisher');assert.equal(f.c.fishingCatch.goods.tilapia,1);assert.equal(f.city.economy.produced.tilapia,1);
  tick(f,20);assert(f.b.inventory.tilapia>=3);assert.equal(f.b.inventory.pacu,0);assert.equal(f.b.inventory.robalo,0);assert(f.events.some(row=>row[0]==='fishing-delivery'));}
});

test('an owned canoe sails to the middle, fishes there, returns to shore and releases the physical hull',()=>{
 const f=fixture({boat:true});tick(f,3);assert.equal(f.c.fishingJob.stage,'fish');assert(f.c.boatClass);assert.equal(f.canoe.fishingCitizenId,f.c.id);assert.equal(f.c.boatVehicleId,f.canoe.id);assert.equal(fishHabitat(f.city.world,f.c.entity.x,f.c.entity.y).zone,'middle');
 tick(f,8);assert.equal(f.c.fishingCatch.goods.pacu,1);assert.equal(f.c.fishingPose.boat,true);assert.equal(f.b.inventory.pacu,0);
 for(let i=0;i<25&&f.b.inventory.pacu<3;i++)tick(f,1);assert(f.b.inventory.pacu>=3);assert.equal(f.b.inventory.tilapia,0);assert.equal(f.canoe.fishingCitizenId,null);assert.equal(f.c.boatClass,null);assert(Math.hypot(f.canoe.x-f.c.entity.x,f.canoe.y-f.c.entity.y)>0);
});

test('marine fishing produces marine species and busy or foreign canoes cannot be claimed',()=>{
 const f=fixture({salt:true,boat:true});f.canoe.ownerAccountId='other';tick(f,10);assert.equal(f.c.fishingJob.boatId,undefined);assert.equal(f.c.fishingCatch.goods.robalo,1);assert.equal(f.c.fishingCatch.goods.tilapia,undefined);assert.equal(f.canoe.driverId,undefined);
});

test('interrupting a trip mid-lake reaches shore without teleporting or releasing the hull at sea',()=>{
 const f=fixture({boat:true});tick(f,3);const before={x:f.c.entity.x,y:f.c.entity.y};f.c.task='food';f.c.path=[];advanceFishing(f.city,f.c,.05);assert(f.c.fishingJob);assert.equal(f.canoe.fishingCitizenId,f.c.id);assert(Math.hypot(f.c.entity.x-before.x,f.c.entity.y-before.y)<=.161);
 for(let i=0;i<300&&f.c.fishingJob;i++)advanceFishing(f.city,f.c,.05);
 assert.equal(f.c.fishingJob,null);assert(f.city.walkable(Math.floor(f.c.entity.x),Math.floor(f.c.entity.y)));assert.equal(f.canoe.driverId,null);assert.equal(f.c.boatClass,null);
});

test('missing rods prevent fishing; exhausted local stock cannot manufacture catches',()=>{
 const f=fixture();f.b.inventory.vara_pesca=0;assert.equal(fishingWork(f.city,f.b,f.c),false);assert.equal(f.c.fishingJob,undefined);
 f.b.inventory.vara_pesca=1;tick(f,2);const point=f.c.fishingJob.point;f.city.world.fishStocks.set(`${Math.floor(point.x)},${Math.floor(point.y)}`,{amount:0,minute:f.city.minute});tick(f,1);assert.equal(f.city.economy.produced.tilapia,0);assert.equal(f.c.fishingPose,null);
});

test('the fishing chain exposes actual materials, species, fillets and a cooked fish meal',()=>{
 assert.deepEqual(INDUSTRIES.fishing_tackle.inputs,{madeira:1,fibras:2,ferro:1});assert.equal(JOB_SKILL.fishery,'fishing');for(const g of Object.keys(FISH_SPECIES))assert(GOODS[g]);
 const recipe=KITCHEN_RECIPES.find(r=>r.good==='marmita_peixe');assert.deepEqual(recipe.inputs,{file_peixe:1,arroz:1,tomate:1});assert.equal(recipe.quantity,2);
 const f=fixture(),b=f.b;b.type='fishmonger';b.inventory.pacu=2;b.inventory.robalo=0;b.productionLabor=7;
 const economy=Object.assign(Object.create(CityEconomy.prototype),f.city.economy,{city:f.city});f.city.economy=economy;f.city.paint={discard:()=>{}};f.city.vehicles.discardComponents=()=>{};f.city.vehicles.produced=()=>{};
 assert(economy.industrialWork(b,f.c,INDUSTRIES.fishmonger));assert.equal(b.inventory.pacu,1);assert.equal(b.inventory.file_peixe,2);assert.equal(economy.consumed.pacu,1);assert.equal(economy.produced.file_peixe,2);
});

test('fishing poses survive compact worker updates and clear when the activity ends',()=>{
 const f=fixture();tick(f,2);const pose=structuredClone(f.c.fishingPose),rows=packFishing([f.c]);f.c.fishingPose=null;applyFishing(f.city,rows);assert.deepEqual(f.c.fishingPose,pose);applyFishing(f.city,new Float64Array());assert.equal(f.c.fishingPose,null);
});

test('an inland company canoe is physically towed to a launch before fishing',()=>{
 const f=fixture({boat:true,inland:true});fishingWork(f.city,f.b,f.c);assert.equal(f.c.fishingJob.stage,'tow');assert(f.c.path.length||f.c.localBoatTrip);
 tick(f,4);assert.equal(f.c.fishingJob.stage,'fish');assert.equal(f.c.fishingPose.boat,true);assert.equal(f.canoe.fishingCitizenId,f.c.id);assert.equal(f.c.boatVehicleId,f.canoe.id);
});

test('the production dispatcher, normal movement and real vehicle synchronization complete a fishing shift',async()=>{
 const {setup}=await import('./helpers/city.mjs'),city=setup({starter:true,population:24});
 const b=city.addBuilding('fishery',35,25,{width:3,depth:3,floors:1,free:true});assert(b,city.lastError);b.active=true;
 for(let y=21;y<43;y++)for(let x=44;x<56;x++)city.world.setTile(x,y,TILE_WATER);
 const c=city.citizens.find(p=>city.society.isAdult(p)&&!city.politics.officeHolder(p));assert(c);c.jobId=b.id;c.businessIds.push(b.id);b.ownerId=c.id;c.task='manage';c.targetId=b.id;c.path=[];c.indoorLocation=null;c.entity.x=b.door.x;c.entity.y=b.door.y;c.conversation=null;c.workMeal=null;
 for(const key of Object.keys(c.needs))c.needs[key]=100;b.inventory.vara_pesca=1;b.inventory.moveis=1;
 const canoe=city.vehicles.createBoatVehicle('canoe',b.accountId);canoe.x=44.5;canoe.y=27.5;canoe.entity.x=canoe.x;canoe.entity.y=canoe.y;canoe.condition=100;
 city.minute=600;city.accumulator=0;city._movingCitizens=[c];
 // Exercise the real work dispatcher and update; keep unrelated city scheduling out of this focused shift.
 city.stepMinute=()=>{city.minute++;if(!c.path.length)city.performTask(c);city._movingCitizens=[c];};
 let seenFishing=false;for(let i=0;i<1600&&b.inventory.pacu<3;i++){city.update(.05);if(c.fishingPose?.boat)seenFishing=true;}
 assert(seenFishing);assert(b.inventory.pacu>=3);assert.equal(canoe.fishingCitizenId,null);assert.equal(canoe.driverId,null);assert.equal(c.boatClass,null);assert(c.skills.fishing>0);
});

test('existing saves gain the fishing catalog without spawning fish or losing stored goods',async()=>{
 const {setup}=await import('./helpers/city.mjs'),{CityStateGraph,bindCityState}=await import('../js/city_state.js'),{FISH_GOODS}=await import('../js/fishing_catalog.js');
 const city=setup({starter:true,population:24});city.goodsCatalogSchemaVersion=1;const oldBread=city.buildings.reduce((n,b)=>n+(b.inventory.pao||0),0);
 for(const good of Object.keys(FISH_GOODS)){delete city.economy.goods[good];for(const key of ['initialStock','produced','consumed','lost'])delete city.economy[key][good];for(const b of [...city.buildings,city.worldPort,city.economy.importDepot].filter(holder=>holder?.inventory))delete b.inventory[good];}
 for(const c of city.citizens)delete c.skills.fishing;
 const copy=new CityStateGraph().apply(structuredClone(new CityStateGraph().encode({city}))).city;bindCityState(copy);
 assert.equal(copy.goodsCatalogSchemaVersion,2);assert.equal(copy.buildings.reduce((n,b)=>n+(b.inventory.pao||0),0),oldBread);
 for(const good of Object.keys(FISH_GOODS)){assert(copy.economy.goods[good]);assert.equal(copy.economy.produced[good],0);assert([...copy.buildings,copy.worldPort,copy.economy.importDepot].filter(holder=>holder?.inventory).every(b=>b.inventory[good]===0));}
 assert(copy.citizens.every(c=>c.skills.fishing===0));
});


test('marine canoes catch middle-water fish and processors accept available species as substitutes',()=>{
 const f=fixture({salt:true,boat:true});tick(f,10);assert.equal(f.c.fishingCatch.goods.cavala,1);assert.equal(f.c.fishingCatch.goods.robalo,undefined);
 const fresh=fixture(),economy={city:fresh.city,businesses:[fresh.b]};assert.deepEqual(fishSupplyInputs(economy),{tilapia:1});fresh.b.inventory.pacu=3;assert.deepEqual(fishSupplyInputs(economy),{pacu:1});
});

test('a fish lunch consumes real fillets and vegetables and records the prepared portions',async()=>{
 const {kitchenWork}=await import('../js/city_markets.js'),f=fixture();f.b.type='kitchen';Object.assign(f.b.inventory,{file_peixe:1,arroz:1,tomate:1});
 for(let i=0;i<20&&f.b.inventory.marmita_peixe<2;i++)kitchenWork(f.city.economy,f.b,f.c);
 assert.equal(f.b.inventory.marmita_peixe,2);assert.equal(f.b.inventory.file_peixe,0);assert.equal(f.b.inventory.arroz,0);assert.equal(f.b.inventory.tomate,0);assert.equal(f.city.economy.consumed.file_peixe,1);assert.equal(f.city.economy.produced.marmita_peixe,2);
});
