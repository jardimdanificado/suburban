import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {TILE_WATER} from '../js/world_gen.js';
import {waterfrontBerth} from '../js/waterfront_businesses.js';
import {inspectBuildingSite} from '../js/city_terrain.js';

test('boat shops and workshops reject inland plots and build with a shoreline berth',()=>{
 const city=setup({starter:true,population:24});
 for(const [type,x]of [['boat_shop',25],['boat_workshop',35]]){
  assert.match(inspectBuildingSite(city,x,10,3,3,{type}).error,/borda da água/);
  assert(!city.addBuilding(type,x,10,{width:3,depth:3,floors:1,free:true}));
  for(let offset=0;offset<3;offset++)city.world.setTile(x+offset,9,TILE_WATER);
  const business=city.addBuilding(type,x,10,{width:3,depth:3,floors:1,free:true});assert(business,city.lastError);assert.equal(business.waterfront.berth.y,9);
 }
 for(let x=10;x<22;x++)city.world.setTile(x,20,TILE_WATER);
 const sites=city.economy.locateBuilding('boat_shop');assert(sites.length>0);for(const site of sites)assert(waterfrontBerth(city.world,site.x,site.y,site.width,site.depth));
});
test('naval maintenance requires a nearby boat, parts, payment and labor, and records component provenance',()=>{
 const city=setup({starter:true,population:24});for(let x=35;x<38;x++)city.world.setTile(x,9,TILE_WATER);
 const shop=city.addBuilding('boat_workshop',35,10,{width:3,depth:3,floors:1,free:true});assert(shop,city.lastError);
 const worker=city.citizens[0];city.accounts.get(worker.accountId).balance=1e7;
 const boat=city.vehicles.createBoatVehicle('canoe',worker.accountId);boat.condition=30;boat.x=80;boat.y=80;
 for(const [good,n]of Object.entries({tabuas:2,cordas:1,ferragens_navais:1})){shop.inventory[good]=n;shop.componentLots??={};shop.componentLots[good]=[{quantity:n,producerId:'fixture-producer',producerName:'Fornecedor naval',brand:'Marca naval',origin:'Produção local',design:2}];}
 assert.equal(city.vehicles.boatWorkshopWork(shop,worker),false);assert.equal(shop.inventory.tabuas,2);
 boat.x=35.5;boat.y=9.5;const balance=worker.balance;
 assert(city.vehicles.boatWorkshopWork(shop,worker));assert.equal(shop.inventory.tabuas,0);assert.equal(boat.condition,30);assert(worker.balance<balance);
 for(let i=0;i<40&&boat.condition<100;i++)city.vehicles.boatWorkshopWork(shop,worker);
 assert.equal(boat.condition,100);assert.equal(boat.mechanicId,null);assert.equal(shop.repairVehicleId,null);
 assert(boat.maintenanceHistory[0].components.every(part=>part.brand==='Marca naval'&&part.design===2));
});
