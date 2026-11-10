import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {TILE_WATER,TILE_SAND} from '../js/world_gen.js';
import {mooringPosition} from '../js/harbor_berths.js';

test('moorings remain in navigable water, separated from the dock and each other',()=>{
 const world={width:20,height:40,getTile:(x,y)=>x===0?TILE_SAND:TILE_WATER},berth={x:1,y:20},occupied=[];
 for(let i=0;i<4;i++){const point=mooringPosition(world,berth,occupied,1.4);assert(point);assert.equal(world.getTile(Math.floor(point.x),Math.floor(point.y)),TILE_WATER);assert(Math.hypot(point.x-1.5,point.y-20.5)>=3.4);for(const previous of occupied)assert(Math.hypot(point.x-previous.x,point.y-previous.y)>=3.8);occupied.push({...point,radius:1.4});}
});
test('the initial port sells two canoes and one launch to citizens and companies',()=>{
 const city=setup({starter:true,population:24}),port=city.worldPort;
 for(let x=0;x<city.world.width;x++){city.world.setTile(x,0,TILE_WATER);city.world.setTile(x,1,TILE_SAND);}port.berth={x:10,y:0};port.door={x:10,y:1};
 city.vehicles.initialBoatSales=false;city.vehicles.provisionBoatSales(port);
 const stock=[...city.vehicles.units.values()].filter(v=>!v.active&&v.holderAccountId===port.accountId);
 assert.equal(stock.filter(v=>v.good==='canoe').length,2);assert.equal(stock.filter(v=>v.good==='launch').length,1);
 const buyer=city.citizens[0];city.accounts.get(buyer.accountId).balance=1e9;
 assert(city.vehicles.buyVehicle(buyer.accountId,stock[0].id));assert.equal(stock[0].ownerAccountId,buyer.accountId);
 const company=city.economy.businesses.find(b=>b.active&&b.accountId!=='treasury');assert(company);city.accounts.get(company.accountId).balance=1e9;assert(city.vehicles.buyVehicle(company.accountId,stock[1].id));assert.equal(stock[1].ownerAccountId,company.accountId);
 assert(city.vehicles.model(stock[0]).components.every(part=>part.brand&&part.origin));
});
