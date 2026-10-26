import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {chooseBuildingSite} from '../js/city_terrain.js';
function hideEmptyLots(city){for(const lot of city.development.plots)if(!lot.buildingId&&!lot.projectId){lot.ownerId=city.citizens[10].accountId;lot.forSale=false;}}
function lot(city,w=3,d=3){for(const site of city.economy.locateBuilding('clinic')){const p=city.development.createPlot(site.x,site.y,w,d);if(p)return p;}throw Error('No test lot');}

test('a full catalogue of obsolete plots does not prevent registering valid public land',()=>{
  const city=setup({starter:true,funded:true,population:48}),dev=city.development;dev.ensurePlots();const before=new Set(dev.plots.map(p=>p.id)),money=totalMoney(city);city.world.parkingTiles=new Map();
  for(const p of dev.plots)if(!p.buildingId&&!p.projectId)city.world.parkingTiles.set(`${p.x},${p.y}`,{vehicleId:999});
  const site=dev.publicBuildingSite('clinic');assert(site,dev.publicLandReport?.reason);assert(!before.has(site.lot.id));assert(dev.publicLandReport.created);assert.equal(chooseBuildingSite(city,site.lot.x,site.lot.y,site.width,site.depth,{plotId:site.lot.id,type:'clinic',rotation:site.rotation}).error,undefined);assert.equal(totalMoney(city),money);
});

test('four-cell parcels are usable and landing reservations are excluded',()=>{
  const city=setup({starter:true,funded:true,population:48});hideEmptyLots(city);const bad=lot(city),small=lot(city,2,2);bad.landingReserved=true;
  const site=city.development.publicBuildingSite('clinic');assert(site);assert.equal(site.lot.id,small.id);assert.equal(site.width*site.depth,4);
});

test('approved public works escape obsolete lots and retain their mandate and priority links',()=>{
  const city=setup({starter:true,funded:true,population:48}),p=city.politics,dev=city.development;city.world.parkingTiles=new Map();for(const l of dev.plots)if(!l.buildingId&&!l.projectId)city.world.parkingTiles.set(`${l.x},${l.y}`,{vehicleId:900});
  const bill=p.council.propose(p.council.people()[0],'build',{buildingType:'clinic'},'Promessa de clínica');assert(bill);bill.agendaTermId=p.mandates.current.id;bill.promiseMetric='clinics';p.council.execute(bill);
  assert(bill.projectId,bill.result);const project=dev.projects.find(pr=>pr.id===bill.projectId);assert(project);assert.equal(project.agendaTermId,bill.agendaTermId);assert.equal(project.priority,95);assert.equal(project.accountId,'treasury');assert(project.rotation>=0&&project.rotation<4);
});

test('an empty parcel for sale can be bought at its price, while unlisted land is untouched',()=>{
  const city=setup({starter:true,funded:true,population:48});hideEmptyLots(city);const offered=lot(city),seller=city.citizens[10],money=totalMoney(city),before=seller.balance;offered.ownerId=seller.accountId;offered.forSale=true;offered.price=10000;
  const site=city.development.publicBuildingSite('clinic');assert.equal(site.lot.id,offered.id);assert.equal(site.purchasePrice,10000);assert.equal(offered.ownerId,seller.accountId);assert(city.development.acquirePublicSite(site));assert.equal(seller.balance,before+10000);assert.equal(offered.ownerId,'treasury');assert.equal(totalMoney(city),money);
  assert(city.development.plots.filter(p=>p.ownerId===seller.accountId).every(p=>!p.forSale));
});

test('executive construction uses the same validated search and finite works budget',()=>{
  const city=setup({starter:true,funded:true,population:48}),p=city.politics;city.world.parkingTiles=new Map();for(const lot of city.development.plots)if(!lot.buildingId&&!lot.projectId)city.world.parkingTiles.set(`${lot.x},${lot.y}`,{vehicleId:900});
  p.fundInitialWorksBudget();const money=totalMoney(city),before=p.ensureWorksBudget(),project=p.startPublicWork('clinic');assert(project,city.lastError);assert(project.executiveInitiative);assert(p.ensureWorksBudget()<before);assert.equal(totalMoney(city),money);
});

test('gentle slopes can be registered as plots and used without flattening the terrain',()=>{
  const city=setup({starter:true,population:48});hideEmptyLots(city);const spot=city.economy.locateBuilding('clinic')[0];assert(spot);for(let yy=spot.y;yy<spot.y+3;yy++)for(let xx=spot.x+2;xx<spot.x+4;xx++)city.world.setTile(xx,yy,9);
  const plot=city.development.createPlot(spot.x,spot.y,4,3);assert(plot);assert.equal(plot.level,null);const before=[];for(let yy=plot.y;yy<plot.y+plot.depth;yy++)for(let xx=plot.x;xx<plot.x+plot.width;xx++)before.push(city.world.getTile(xx,yy));const site=city.development.publicBuildingSite('clinic');assert.equal(site.lot.id,plot.id);
  const after=[];for(let yy=plot.y;yy<plot.y+plot.depth;yy++)for(let xx=plot.x;xx<plot.x+plot.width;xx++)after.push(city.world.getTile(xx,yy));assert.deepEqual(after,before);
});

test('failed searches have bounded work and do not rescan unchanged land in the same hour',()=>{
  const city=setup({starter:true,population:48});hideEmptyLots(city);let attempts=0;city.development.createPlot=()=>{attempts++;return null;};assert.equal(city.development.publicBuildingSite('clinic'),null);const before=attempts;assert(before>0&&before<=768);assert.equal(city.development.publicBuildingSite('clinic'),null);assert.equal(attempts,before);assert.match(city.development.publicLandReport.reason,/busca|Busca/);
});

test('housing promises can expand municipal homes vertically when new land is unavailable',()=>{
  const city=setup({starter:true,funded:true,population:48}),p=city.politics;let house;for(const site of city.economy.locateBuilding('popular_housing')){house=city.addBuilding('popular_housing',site.x,site.y,{...site,width:3,depth:3,floors:2,free:true,ownerAccountId:'treasury'});if(house)break;}assert(house);hideEmptyLots(city);city.development.createPlot=()=>null;
  const bill=p.council.propose(p.council.people()[0],'build',{buildingType:'popular_housing'},'Meta de moradias');assert(bill);p.council.execute(bill);assert(bill.projectId,bill.result);const project=city.development.projects.find(pr=>pr.id===bill.projectId);assert.equal(project.service,'expansion');assert.equal(project.buildingId,house.id);assert(project.targetFloors>house.floors&&project.targetFloors<=12);
});

test('new public buildings avoid the footprint of a contracted road before it is paved',()=>{
  const city=setup({starter:true,population:48});hideEmptyLots(city);const blocked=lot(city),clear=lot(city);city.development.projects.push({id:'planned-road',service:'road',status:'materials',route:[{x:blocked.x+.5,y:blocked.y+.5}]});const site=city.development.publicBuildingSite('clinic');assert.equal(site.lot.id,clear.id);
});
