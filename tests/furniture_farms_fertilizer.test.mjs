import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,finishActivityRoute,finishShipment,totalMoney} from './helpers/city.mjs';
import {INDUSTRIES} from '../js/city_industries.js';
import {WORKSTATIONS,roomFurniture,furnitureInteraction} from '../js/city_furniture_catalog.js';
import {citizenAnimation,citizenFrame} from '../js/city_citizen_models.js';
import {farmSoilTile,baseTerrainTile,FARM_TILES} from '../js/world_gen.js';
import {tileHeight,surfaceElevation,findTerrainPath} from '../js/city_terrain.js';
import {cultivateFarmTerrain} from '../js/city_farm_ground.js';
import {CROPS} from '../js/city_economy.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';

function fixture(){const city=setup({starter:true,population:48}),c=city.citizens.find(c=>!city.politics.officeHolder(c)&&!c.businessIds.length);city.economy.leaveJob(c);c.indoorLocation=null;c.path=[];c.conversation=null;for(const n in c.needs)c.needs[n]=95;return {city,c};}
test('every production industry has an explicitly named workstation and usable equipment',()=>{
 for(const type of Object.keys(INDUSTRIES)){assert(WORKSTATIONS[type],type);const u={id:`unit:${type}`,x:0,y:0,z:0,roomType:'workspace'},b={type,entity:{x:0,y:0},layoutRevision:0};const equipment=roomFurniture(b,u).find(f=>f.workstation);assert(equipment,type);assert.notEqual(equipment.label,'Posto de atendimento',type);assert(furnitureInteraction(b,u,'workspace'),type);}
 const b={type:'residential'},u={id:'bedroom',x:0,y:0,z:0,roomType:'bedroom'};assert.deepEqual(roomFurniture(b,u).filter(f=>['bed','chest','fridge'].includes(f.type)).map(f=>f.type),['bed','chest','fridge']);
});
test('people occupy a real dining chair and stay on use/2 until moving again',()=>{
 const {city,c}=fixture(),b=city.buildings.find(b=>b.type==='popular_refectory');c.task='food';c.targetId=b.id;c.entity.x=b.door.x;c.entity.y=b.door.y;finishActivityRoute(city,c);city.furniture.syncCitizen(c);assert(c.seated);assert.equal(c.furnitureUse.type,'chair');assert.deepEqual(citizenFrame(citizenAnimation(c,false),200),{clip:'use',frame:2});assert.equal(citizenAnimation(c,true),'run');
});
test('street benches reserve distinct seats and release them when the activity changes',()=>{
 const {city,c}=fixture(),other=city.citizens.find(p=>p!==c&&!city.politics.officeHolder(p));assert(city.furniture.benches.length>0);const first=city.furniture.claimBench(c,c.entity,Infinity),second=city.furniture.claimBench(other,c.entity,Infinity);assert(first&&second);assert.notEqual(c.seatId,other.seatId);
 c.task='sit';c.entity.x=first.point.x;c.entity.y=first.point.y;c.path=[];city.furniture.syncCitizen(c);assert(c.seated);c.task='walk';city.furniture.syncCitizen(c);assert.equal(c.seatId,null);assert.equal(c.seated,false);
});
test('a worker short of materials waits at a real bench or indoors and retries without losing the job',()=>{
 const {city,c}=fixture(),b=city.buildings.find(b=>b.type==='cycle_assembler');c.jobId=b.id;b.workers.push(c.id);for(const good in INDUSTRIES[b.type].inputs)b.inventory[good]=0;c.task='work';c.targetId=b.id;c.entity.x=b.door.x;c.entity.y=b.door.y;finishActivityRoute(city,c);city.performTask(c);assert.equal(c.task,'work-wait');assert.equal(c.workWait.employerId,b.id);assert(c.seatId||c.targetId===b.id);city.minute+=13;city.furniture.advanceWait(c);assert.equal(c.jobId,b.id);assert.equal(c.task,null);
});
test('cultivated tiles preserve every original height class and the interpolated terrain surface',()=>{
 for(const original of [0,3,9,4,1,10]){const farm=farmSoilTile(original);assert(FARM_TILES.has(farm));assert.equal(tileHeight(farm),tileHeight(original));assert.equal(baseTerrainTile(farm),original);}
 const {city}=fixture(),b=city.buildings.find(b=>b.type==='farm'),points=b.units.slice(0,8).map(u=>({x:b.entity.x+u.x+.4,y:b.entity.y+u.y+.3})),before=points.map(p=>surfaceElevation(city.world,p.x,p.y));cultivateFarmTerrain(city,b);assert.deepEqual(points.map(p=>surfaceElevation(city.world,p.x,p.y)),before);
 const unit=b.units.find(u=>u.roomType==='workspace');assert(findTerrainPath(city.world,b.door,{x:b.entity.x+unit.x+.5,y:b.entity.y+unit.y+.5},city.occupied)!==null);
});
test('toilet use creates contained feedstock which fertilizer firms buy and physically receive',()=>{
 const {city,c}=fixture(),source=city.buildings.find(b=>b.type==='public_toilet'),f=[...city.sanitation.facilities.values()].find(f=>f.buildingId===source.id),buyer=city.buildings.find(b=>b.type==='cycle_assembler');buyer.type='composting';buyer.inventory.fezes=0;buyer.incoming.fezes=0;buyer.jobs=1;
 c.task='toilet';c.targetId=source.id;c.toiletTargetId=f.id;c.entity.x=source.door.x;c.entity.y=source.door.y;c.needs.toilet=10;finishActivityRoute(city,c);const initial=source.inventory.fezes;city.sanitation.use(c);assert.equal(source.inventory.fezes,initial+1);const before=totalMoney(city);city.sanitation.hourly();const s=city.logistics.shipments.find(s=>s.good==='fezes'&&s.buyer===buyer);assert(s);assert(s.cost>0);finishShipment(city,s);assert(buyer.inventory.fezes>0);assert.equal(totalMoney(city),before);
});
test('composting consumes purchased feces and produces saleable fertilizer after real labor',()=>{
 const {city,c}=fixture(),b=city.buildings.find(b=>b.type==='cycle_assembler');b.type='composting';b.layoutRevision++;b.inventory.fezes=4;b.inventory.lixo=0;b.inventory.adubo=0;b.productionLabor=0;c.jobId=b.id;b.workers.push(c.id);c.task='work';c.targetId=b.id;c.entity.x=b.door.x;c.entity.y=b.door.y;finishActivityRoute(city,c);const used=city.economy.consumed.fezes;for(let i=0;i<30&&b.inventory.adubo===0;i++)city.economy.productionWork(b,c);assert.equal(b.inventory.fezes,0);assert.equal(b.inventory.adubo,3);assert.equal(city.economy.consumed.fezes-used,4);
});
test('fertilized crops can actually be harvested earlier instead of merely reducing sowing work',()=>{
 const {city}=fixture(),b=city.buildings.find(b=>b.type==='farm'),grow=CROPS[b.crop].grow,field={plantedAt:city.minute-grow/1.5,requiredLabor:10,labor:10,yield:6,cellLabor:[10],harvestedCells:[false],growthMultiplier:1.5};b.inventory[b.crop]=0;
 const plain={...field,cellLabor:[10],harvestedCells:[false],growthMultiplier:1};assert.equal(city.economy.harvest(b,plain,0),false);assert(city.economy.harvest(b,field,0));assert.equal(b.inventory[b.crop],6);
});
test('furniture reservations and refrigerated goods survive worker snapshots without duplicating food',()=>{
 const {city,c}=fixture(),b=city.buildings.find(b=>b.type==='townhall');b.homeFoodStores=new Map([[c.id,{ownerId:c.id,furnitureId:'fridge:test',meals:[{inputs:{pao:3},quality:1}]}]]);const stock=city.goodsStock('pao'),writer=new CityStateGraph(),reader=new CityStateGraph(),copy=reader.apply(writer.encode({city})).city;bindCityState(copy);assert.equal(copy.furniture.storedGoods('pao'),3);assert.equal(copy.goodsStock('pao'),stock);assert.equal(typeof copy.furniture.claimBench,'function');assert(copy.furniture.benches.length>0);
});

test('the fridge stores actual food and the bedroom chest stores unworn garments at home',()=>{
 const {city,c}=fixture();let b;for(const site of city.economy.locateBuilding('popular_luxury_housing')){b=city.addBuilding('popular_luxury_housing',site.x,site.y,{...site,floors:1,free:true});if(b)break;}assert(b);
 const home=[...city.housing.homes.values()].find(h=>h.buildingId===b.id),room=city.housing.units(home).find(u=>u.roomType==='bedroom');c.homeId=home.id;c.homeUnitId=room.id;c.indoorLocation={buildingId:b.id,unitId:room.id};c.pocket.food=Array.from({length:4},()=>({inputs:{pao:3},quality:1}));c.wardrobe.push({piece:'camisa',garmentId:'spare-shirt'});
 city.furniture.storeAtHome(c,b,home);assert.equal(c.pocket.food.length,2);assert.equal(b.homeFoodStores.get(c.id).meals.length,2);assert(c.wardrobe.at(-1).storedAtFurnitureId);assert.equal(c.wardrobe.at(-1).storedInBuildingId,b.id);
 c.pocket.food=[];city.furniture.storeAtHome(c,b,home);assert.equal(c.pocket.food.length,2);assert.equal(b.homeFoodStores.get(c.id).meals.length,0);
});

test('hiding interior walls remains in force when another floor is inspected',async()=>{
 const {applyInteriorCutaway}=await import('../js/city_interior_view.js');class Matrix{constructor(){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,1,0,1];}copy(other){this.elements=[...other.elements];return this;}scale(v){this.elements[0]*=v.x;this.elements[5]*=v.y;this.elements[10]*=v.z;return this;}}class Vector{constructor(x,y,z){Object.assign(this,{x,y,z});}}
 const mesh={userData:{interiorFloors:[0,1],interiorBaseMatrices:[new Matrix(),new Matrix()]},instanceMatrix:{},values:[],setMatrixAt(i,m){this.values[i]=[...m.elements];}},group={userData:{cellMeshes:[mesh]}};applyInteriorCutaway({Matrix4:Matrix,Vector3:Vector},group,0,true);assert.equal(mesh.values[0][0],0);applyInteriorCutaway({Matrix4:Matrix,Vector3:Vector},group,1,true);assert.equal(mesh.values[1][0],0);applyInteriorCutaway({Matrix4:Matrix,Vector3:Vector},group,1,false);assert.equal(mesh.values[1][0],1);
});

test('office tower floors show the tenant production equipment instead of generic landlord desks',async()=>{
 const {roomFurnitureForCity}=await import('../js/city_furniture_catalog.js'),{city}=fixture(),tenant=city.buildings.find(b=>b.type==='publisher'&&b.officeTenantOf);assert(tenant);const tower=city.building(tenant.officeTenantOf),unit=tower.units.find(u=>u.z===tenant.officeFloor&&u.roomType==='workspace'),items=roomFurnitureForCity(city,tower,unit);assert(items.some(f=>f.type==='press'&&f.label==='Prensa de encadernação'));const logical=tenant.units.find(u=>u.x===unit.x&&u.y===unit.y);assert(items.every(f=>f.id.startsWith(`furniture:${logical.id}:`)));
});
