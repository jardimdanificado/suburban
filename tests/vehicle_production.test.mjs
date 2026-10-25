import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,finishShipment} from './helpers/city.mjs';
import {INDUSTRIES} from '../js/city_industries.js';
import {VEHICLE_RECIPES} from '../js/city_vehicles.js';

function business(city,type){
  for(const site of city.economy.locateBuilding(type)){
    const b=city.addBuilding(type,site.x,site.y,{...site,width:3,depth:3,floors:1,free:true});
    if(!b)continue;
    const owner=city.citizens.find(c=>c.fixtureInvestor);
    for(const unit of b.units)unit.price=1000;
    assert(city.economy.purchasePremises(b,owner));
    return b;
  }
  throw new Error(`No site for ${type}`);
}

test('vehicle parts are produced, delivered, assembled as a batch and sold as an active aircraft',()=>{
  const city=setup({starter:true,funded:true,population:64}),owner=city.citizens.find(c=>c.fixtureInvestor);
  const automaker=business(city,'automaker'),dealer=business(city,'dealership'),recipe=VEHICLE_RECIPES.carro;
  city.vehicles.configureAssembly(automaker.id,'carro',1);
  const partFactories={motor:'engine_factory',chassi:'chassis_factory',carroceria:'bodyworks',rodas:'tire_factory',transmissao:'transmission_factory',janelas:'automotive_glass',bancos:'upholstery'};
  for(const [good,type]of Object.entries(partFactories)){
    const factory=business(city,type),spec=INDUSTRIES[type],worker=city.society.citizen(factory.ownerId);
    for(const [input,quantity]of Object.entries(spec.inputs)){factory.inventory[input]=quantity;city.economy.initialStock[input]+=quantity;}
    factory.productionLabor=spec.labor;
    assert(city.economy.productionWork(factory,worker),`${type} should complete production`);
    assert(factory.inventory[good]>0,`${type} should produce ${good}`);
    const shipment=city.logistics.order(factory,automaker,good,recipe[good],0,{purpose:'vehicle-parts'});
    assert(shipment,`${good} should be deliverable to the automaker`);
    finishShipment(city,shipment);
    assert.equal(automaker.inventory[good],recipe[good]);
  }
  for(const good of Object.keys(recipe))assert(automaker.componentLots[good]?.length,`${good} should retain its producer and design`);
  const worker=city.society.citizen(automaker.ownerId);
  for(let i=0;i<100&&automaker.inventory.carro===0;i++)city.economy.productionWork(automaker,worker);
  const vehicle=[...city.vehicles.units.values()].find(v=>v.batchId&&v.good==='carro');
  assert(vehicle,'assembly should register a vehicle unit');
  assert(vehicle.modelId&&city.vehicles.model(vehicle)?.components.length===Object.keys(recipe).length);
  const sale=city.logistics.order(automaker,dealer,'carro',1,0,{purpose:'vehicle-sales'});
  assert(sale);finishShipment(city,sale);
  assert.equal(vehicle.holderAccountId,dealer.accountId);
  assert(city.vehicles.buyVehicle(owner.accountId,vehicle.id));
  assert.equal(vehicle.ownerAccountId,owner.accountId);assert(vehicle.active);assert(vehicle.parking?.cells.length===4);
});
