import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney,finishShipment} from './helpers/city.mjs';
import {queueService} from '../js/city_service_queue.js';

function vacantBuilding(city,type,options={}){for(const site of city.economy.locateBuilding(type)){const b=city.addBuilding(type,site.x,site.y,{...site,width:3,depth:3,floors:2,free:true,...options});if(b)return b;}throw Error('No suitable site');}
function makeFree(city,c){c.jobId=null;c.businessIds=[];c.task=null;c.path=[];c.indoorLocation=null;c.deliveryId=null;c.cleaningJobId=null;c.informalJobId=null;c.workMeal=null;c.conversation=null;c.mobilityTrip=null;c.ridingVehicleId=null;for(const key of Object.keys(c.needs))c.needs[key]=90;}

test('municipal residential homes become rentable and rent goes to the treasury',()=>{
 const city=setup({starter:true,funded:true,population:24}),b=vacantBuilding(city,'residential'),tenant=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)),home=[...city.housing.homes.values()].find(h=>h.buildingId===b.id&&city.housing.hasBathroom(h));
 assert(home);city.housing.market();assert(city.housing.units(home).every(u=>u.ownerId==='treasury'&&u.forRent));
 const before=city.treasury,rent=city.housing.rent(home,tenant);assert(city.housing.rentHome(tenant,home));assert.equal(tenant.homeId,home.id);assert.equal(city.treasury,before+rent);
});

test('dirty properties generate funded informal work and the worker receives the escrow',()=>{
 const city=setup({starter:true,funded:true,population:24}),hall=city.buildings.find(b=>b.type==='townhall'),worker=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c));
 for(const b of city.buildings){b.cleanliness=100;b.litter=0;b.feces?.clear();b.condition=100;b.repairNeeded=false;}city.sanitation.streetFeces.clear();
 for(const c of city.citizens)if(c!==worker){c.jobId=-1;c.businessIds=[];}makeFree(city,worker);
 hall.municipal=true;hall.ownerId=null;hall.cleanliness=0;city.gigs.postNeededWork();const job=city.gigs.jobs.find(j=>j.buildingId===hall.id&&j.scope==='interior');assert(job);assert(job.fee>0);assert.equal(city.accounts.get(job.accountId).balance,job.fee);
 // Use an exterior job so the whole paid work cycle is independent of room layout.
 city.gigs.cancel(job,'teste');const frontage=city.gigs.createCleaningOrder('treasury',hall.id,{scope:'frontage'});assert(frontage);const goal=city.gigs.frontagePoint(hall);worker.entity.x=goal.x;worker.entity.y=goal.y;city.minute=540+frontage.id%3;
 const before=worker.balance,total=totalMoney(city);for(let i=0;i<35&&frontage.status!=='completed';i++){city.gigs.updateMinute();city.minute++;}
 assert.equal(frontage.status,'completed');assert.equal(worker.balance,before+frontage.fee);assert.equal(totalMoney(city),total);
});

test('paid freight with a busy carrier becomes available to an unemployed resident indoors',()=>{
 const city=setup({starter:true,funded:true,population:24}),carrier=city.economy.businesses.find(b=>b.type==='carrier'),worker=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)&&c.id!==carrier.ownerId&&!carrier.workers.includes(c.id));assert(carrier&&worker);
 makeFree(city,worker);worker.indoorLocation={buildingId:city.buildings[0].id,position:{x:worker.entity.x,y:worker.entity.y,z:0},path:[]};
 for(const id of [...carrier.workers,carrier.ownerId]){const c=city.society.citizen(id);if(c)c.deliveryId=999;}
 const seller=city.buildings.find(b=>b.active&&b.id!==carrier.id),buyer=city.buildings.find(b=>b.active&&b.id!==seller.id&&b.id!==carrier.id),shipment={id:99,carrierId:carrier.id,requireCarrier:false,fee:500,createdAt:city.minute-31,quantity:1,position:{...seller.door},seller,buyer};
 const candidates=city.logistics.candidates(shipment);assert.equal(shipment.carrierId,null);assert(candidates.some(c=>c.id===worker.id));
});

test('different services reserve distinct positions and use independent available rooms concurrently',()=>{
 const city=setup({starter:true,population:24}),b=city.buildings.find(b=>b.type==='public_toilet'),people=city.citizens.filter(c=>city.society.isAdult(c)).slice(0,2),facilities=[...city.sanitation.facilities.values()].filter(f=>f.buildingId===b.id);assert(facilities.length>=2);
 city.furniture.queueSeat=()=>false;
 for(let i=0;i<2;i++){const c=people[i];makeFree(city,c);c.entity.x=b.door.x;c.entity.y=b.door.y;c.task='toilet';c.targetId=b.id;c.toiletTargetId=facilities[i].id;assert.equal(queueService(city,c,b,'toilet',facilities[i].id,false),false);}
 assert.notEqual(b.serviceQueue[0].slot,b.serviceQueue[1].slot);
 for(const c of people){c.path=[];c.entity.x=b.door.x;c.entity.y=b.door.y;}
 assert.equal(queueService(city,people[0],b,'toilet',facilities[0].id,true),true);
 assert.equal(queueService(city,people[1],b,'toilet',facilities[1].id,true),true);
});

test('social housing allocates empty homes to residents and keeps public ownership',()=>{
 const city=setup({starter:true,funded:true,population:24}),b=vacantBuilding(city,'super_popular_housing',{floors:3});
 const rooms=b.units.filter(u=>u.roomType==='bedroom'),homes=[...city.housing.homes.values()].filter(h=>h.buildingId===b.id);assert.equal(homes.length,rooms.length);const before=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!c.homeUnitId).length;city.housing.assign();
 const housed=city.citizens.filter(c=>city.housing.home(c)?.buildingId===b.id);assert(before>0);assert(housed.length>0);assert(b.units.every(u=>u.ownerId==='treasury'));assert(housed.every(c=>city.housing.hasBathroom(city.housing.home(c))));
});

test('large homelessness sustains multiple housing projects and uses larger plots',async()=>{
 const {CityDevelopment}=await import('../js/city_development.js');let begun;
 const city={welfare:{conditions:()=>({homeless:450,population:512,reserve:0})},housing:{homes:new Map()},buildings:[],treasury:1e9,currency:{price:n=>n},economy:{goods:{pedra:{price:1}}},spawn:{x:0,y:0},building:()=>null};
 const development={city,projects:Array.from({length:2},()=>({type:'super_popular_housing',service:'building',status:'materials',width:3,depth:3,floors:3})),plots:[{id:9,x:1,y:1,width:5,depth:5,ownerId:'treasury',type:'urban'}],beginProject:(account,id,type,options)=>(begun={account,id,type,options}),beginExpansion:()=>null};
 CityDevelopment.prototype.planBasicHousing.call(development);assert(begun);assert.equal(begun.options.width,5);assert.equal(begun.options.depth,5);assert.equal(begun.options.floors,4);
});


test('an autonomous hauler completes a paid delivery and receives the reserved fee',()=>{
 const city=setup({starter:true,funded:true,population:24}),seller=city.buildings.find(b=>b.type==='popular_refectory'),buyer=city.buildings.find(b=>b.type==='townhall'),carrier=city.economy.businesses.find(b=>b.type==='carrier');
 const worker=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)&&c.id!==carrier.ownerId&&!carrier.workers.includes(c.id));assert(worker);
 for(const c of city.citizens)if(c!==worker){c.jobId=-1;c.deliveryId=999;}makeFree(city,worker);worker.entity.x=seller.door.x;worker.entity.y=seller.door.y;
 seller.inventory.pao=Math.max(seller.inventory.pao||0,3);city.minute=540;const shipment=city.logistics.order(seller,buyer,'pao',1,0,{payerAccountId:'treasury'});assert(shipment);assert(shipment.fee>0);shipment.createdAt=city.minute-31;
 const before=worker.balance,total=totalMoney(city);finishShipment(city,shipment);assert.equal(shipment.informalDriverId,worker.id);assert.equal(worker.balance,before+shipment.fee);assert.equal(totalMoney(city),total);
});

test('builders keep their own work cell while coworkers advance the same project',async()=>{
 const {CityDevelopment}=await import('../js/city_development.js');
 const city={walkable:()=>true,findPath:()=>[],economy:{practice(){}}},plot={id:1,x:10,y:10,width:2,depth:2},development={city,plots:[plot],complete(){}};
 const project={id:'project:1',service:'building',plotId:1,width:2,depth:2,floors:1,status:'building',stone:0,inventory:{pedra:0},labor:0,requiredLabor:100};
 const worker=(id,x,y)=>({id,task:'construction',entity:{x,y},skills:{construction:0},path:[],indoorLocation:null});
 const a=worker(1,10.5,10.5),b=worker(2,11.5,10.5),c=worker(3,10.5,11.5);
 assert(CityDevelopment.prototype.work.call(development,project,a));assert(CityDevelopment.prototype.work.call(development,project,b));assert(CityDevelopment.prototype.work.call(development,project,c));assert.equal(project.labor,3);
 assert(CityDevelopment.prototype.work.call(development,project,a));assert.equal(project.labor,4);assert.deepEqual(a.workCell.target,{x:10.5,y:10.5});assert.equal(a.path.length,0);
});

test('informal freight panel excludes unpaid self-transport and shows the actual delivery leg',async()=>{
 const {CityUI}=await import('../js/city_ui.js');const c={entity:{properties:{name:'Autônomo'}},deliveryLeg:'delivery'},holder={name:'Empresa'};
 const shipment=(id,fee,driverId,informalDriverId,status='waiting')=>({id,fee,driverId,informalDriverId,status,carrierId:null,good:'pao',quantity:1,seller:holder,buyer:holder,createdAt:1,completedAt:2});
 const city={logistics:{shipments:[shipment(1,0,null,null),shipment(2,0,4,null),shipment(3,150,4,4,'in-transit'),shipment(4,0,4,4,'delivered'),shipment(5,200,null,null)]},society:{citizen:()=>c}};
 const rows=[],records=[],metrics=[],page={metrics:x=>metrics.push(x),heading(){},note(){},table:(_,r)=>rows.push(...r),record:(title,description)=>records.push({title,description})};
 CityUI.prototype.transport.call({city,view:()=> 'informal',openPanel(){}},page);
 assert.equal(rows.length,1);assert.equal(metrics[0][0][1],1);assert.equal(metrics[0][1][1],1);assert.equal(metrics[0][2][1],0);assert.equal(records.length,1);assert.match(records[0].title,/#3/);assert.match(records[0].description,/a caminho do destino/);
});

test('receiving social housing preserves an active informal job and its route',()=>{
 const city=setup({starter:true,funded:true,population:24}),b=vacantBuilding(city,'super_popular_housing'),c=city.citizens.find(p=>city.society.isAdult(p)&&!city.politics.officeHolder(p)),home=[...city.housing.homes.values()].find(h=>h.buildingId===b.id&&city.housing.hasBathroom(h));
 makeFree(city,c);c.task='informal-frontage';c.informalJobId=77;c.targetId=null;const route=[{x:c.entity.x+.5,y:c.entity.y}];c.path=route;
 assert(city.housing.grantSocialHome(c,home));assert.equal(c.informalJobId,77);assert.equal(c.task,'informal-frontage');assert.equal(c.path,route);assert.equal(c.homeId,home.id);
});

test('housing assignment actually places residents into vacant municipal rentals',()=>{
 const city=setup({starter:true,funded:true,population:24}),b=vacantBuilding(city,'residential');city.housing.assign();
 const tenants=city.citizens.filter(c=>city.housing.home(c)?.buildingId===b.id),municipalTenants=tenants.filter(c=>city.housing.units(city.housing.home(c)).every(u=>u.ownerId==='treasury'));
 assert(municipalTenants.length>0);assert(municipalTenants.every(c=>city.housing.units(city.housing.home(c)).every(u=>u.tenantId===c.accountId)));
});


test('older two-bedroom social homes split into independent rooms without displacing the resident',()=>{
 const city=setup({starter:true,funded:true,population:24}),b=vacantBuilding(city,'super_popular_housing'),homes=[...city.housing.homes.values()].filter(h=>h.buildingId===b.id),[first,second]=homes,unit=city.units.get(second.unitIds[0]),c=city.citizens.find(p=>city.society.isAdult(p)&&!city.politics.officeHolder(p));
 assert(city.housing.grantSocialHome(c,first));first.unitIds.push(unit.id);unit.homeId=first.id;unit.tenantId=c.accountId;city.housing.homes.delete(second.id);city.housing.sharedRoomHousingVersion=undefined;
 city.housing.reconcile();const restored=city.housing.homes.get(`home:${unit.id}`),facility=city.sanitation.facilities.get(`toilet:${b.sharedBathroomUnitId}`);assert(restored);assert.equal(c.homeId,first.id);assert.equal(unit.tenantId,null);assert.equal(city.housing.units(first).length,1);assert(facility.homeIds.includes(restored.id));assert(city.housing.hasBathroom(restored));
});
