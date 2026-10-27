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

test('vehicle parts are produced, delivered, assembled as a batch and sold as a human-powered bicycle',()=>{
  const city=setup({starter:true,funded:true,population:64}),owner=city.citizens.find(c=>c.fixtureInvestor);
  const cycle_assembler=business(city,'cycle_assembler'),dealer=business(city,'cycle_shop'),recipe=VEHICLE_RECIPES.bicicleta;
  city.vehicles.configureAssembly(cycle_assembler.id,'bicicleta',1);
  const partFactories={rolamentos:'bearing_factory',quadro:'frame_factory',rodas:'tire_factory',corrente:'chain_factory',selim:'saddle_factory'};
  for(const [good,type]of Object.entries(partFactories)){
    const factory=business(city,type),spec=INDUSTRIES[type],worker=city.society.citizen(factory.ownerId);
    for(const [input,quantity]of Object.entries(spec.inputs)){factory.inventory[input]=quantity;city.economy.initialStock[input]+=quantity;}
    factory.productionLabor=spec.labor;
    assert(city.economy.productionWork(factory,worker),`${type} should complete production`);
    assert(factory.inventory[good]>0,`${type} should produce ${good}`);
    const shipment=city.logistics.order(factory,cycle_assembler,good,recipe[good],0,{purpose:'vehicle-parts'});
    assert(shipment,`${good} should be deliverable to the cycle_assembler`);
    finishShipment(city,shipment);
    assert.equal(cycle_assembler.inventory[good],recipe[good]);
  }
  for(const good of Object.keys(recipe))assert(cycle_assembler.componentLots[good]?.length,`${good} should retain its producer and design`);
  const worker=city.society.citizen(cycle_assembler.ownerId);
  for(let i=0;i<100&&cycle_assembler.inventory.bicicleta===0;i++)city.economy.productionWork(cycle_assembler,worker);
  const vehicle=[...city.vehicles.units.values()].find(v=>v.batchId&&v.good==='bicicleta');
  assert(vehicle,'assembly should register a vehicle unit');
  assert(vehicle.modelId&&city.vehicles.model(vehicle)?.components.length===Object.keys(recipe).length);
  const sale=city.logistics.order(cycle_assembler,dealer,'bicicleta',1,0,{purpose:'vehicle-sales'});
  assert(sale);finishShipment(city,sale);
  assert.equal(vehicle.holderAccountId,dealer.accountId);
  assert(city.vehicles.buyVehicle(owner.accountId,vehicle.id));
  assert.equal(vehicle.ownerAccountId,owner.accountId);assert(vehicle.active);assert.equal(vehicle.fuelStore,undefined);assert.equal(city.vehicles.air,undefined);
});
