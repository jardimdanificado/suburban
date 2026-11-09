import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../js/city_simulation.js';
import {setup,finishShipment} from './helpers/city.mjs';

function portCity(stock=0){
  const goods={pao:0};
  const city=Object.create(CitySimulation.prototype);
  const building={id:1,type:'bakery',active:true,entity:{destroyed:false},inventory:{pao:stock},incoming:{},inventoryCapacity:100};
  city.minute=480;city.building=id=>id===1?building:null;
  city.worldPort={id:'world-port',inventory:{pao:0},inventoryCapacity:100,reservations:{},receipts:{},payments:{}};
  city.economy={goods,recordGoods(){}};
  return {city,building};
}

test('world port export, voyage and import preserve cargo quantity and are idempotent',()=>{
  const origin=portCity(20),destination=portCity();
  assert.equal(origin.city.reserveWorldExport('ship-1',1,'pao',12),true);
  assert.equal(origin.building.inventory.pao,8);
  assert.equal(origin.city.worldPort.inventory.pao,12);
  assert.equal(origin.city.reserveWorldExport('ship-1',1,'pao',12),true);
  assert.equal(origin.building.inventory.pao,8);
  assert.equal(origin.city.departWorldExport('ship-1'),true);
  assert.equal(origin.city.worldPort.inventory.pao,0);
  assert.equal(origin.city.departWorldExport('ship-1'),true);
  assert.equal(destination.city.receiveWorldImport('ship-1','pao',12),true);
  assert.equal(destination.city.receiveWorldImport('ship-1','pao',12),true);
  assert.equal(destination.city.worldPort.inventory.pao,12);
  assert.equal(destination.city.deliverWorldImport('ship-1',1),true);
  assert.equal(destination.city.deliverWorldImport('ship-1',1),true);
  assert.equal(destination.building.inventory.pao,12);
  assert.equal(destination.city.worldPort.inventory.pao,0);
});

test('reserved export can return to its seller exactly once before departure',()=>{
  const origin=portCity(10);
  assert.equal(origin.city.reserveWorldExport('ship-2',1,'pao',4),true);
  assert.equal(origin.city.returnWorldExport('ship-2'),true);
  assert.equal(origin.city.returnWorldExport('ship-2'),true);
  assert.equal(origin.building.inventory.pao,10);
  assert.equal(origin.city.worldPort.inventory.pao,0);
  assert.equal(origin.city.departWorldExport('ship-2'),false);
});

test('live city cargo physically walks to the port and from the port to the destination building',()=>{
  const city=setup({starter:true,population:24});city.worldPort.cityId='city';
  const seller=city.buildings.find(building=>building.active&&!building.entity.destroyed&&building.inventory.pao>=1&&city.findPath(building.door,city.worldPort.door)!==null);
  const buyer=city.buildings.find(building=>building.active&&!building.entity.destroyed&&building!==seller&&Object.hasOwn(building.inventory,'pao')&&city.findPath(city.worldPort.door,building.door)!==null);
  assert(seller&&buyer,'fixture needs walkable seller, port, and destination');
  city.transfer('treasury',seller.accountId,5000,'Fixture funding');city.transfer('treasury',buyer.accountId,5000,'Fixture funding');
  const quantity=1,stock=seller.inventory.pao;
  assert.equal(city.reserveWorldExport('physical-1',seller.id,'pao',quantity),true);
  const outbound=city.logistics.shipments.find(shipment=>shipment.id===city.worldPort.reservations['physical-1'].localShipmentId);
  assert(outbound);assert.equal(city.worldPort.inventory.pao,0);assert.equal(seller.inventory.pao,stock-quantity);
  finishShipment(city,outbound);assert.equal(city.worldPort.inventory.pao,quantity);assert.equal(outbound.status,'delivered');
  assert.equal(city.departWorldExport('physical-1'),true);assert.equal(city.worldPort.inventory.pao,0);
  assert.equal(city.receiveWorldImport('physical-1','pao',quantity),true);
  const before=buyer.inventory.pao;assert.equal(city.deliverWorldImport('physical-1',buyer.id),false);
  const receipt=city.worldPort.receipts['physical-1'],inbound=city.logistics.shipments.find(shipment=>shipment.id===receipt.localShipmentId);
  assert(inbound);assert.equal(buyer.inventory.pao,before);finishShipment(city,inbound);
  assert.equal(city.deliverWorldImport('physical-1',buyer.id),true);assert.equal(buyer.inventory.pao,before+quantity);
});

test('world trade payment is reserved, settled, and idempotent across city ledgers',()=>{
  const buyer=portCity(),seller=portCity();
  const makePaymentCity=(fixture,balance)=>{
    const city=fixture.city,transactions=[];city.accounts=new Map([['supplier',{balance:0,externalMoney:true}],['buyer',{balance,externalMoney:false}],['seller',{balance:0,externalMoney:false}]]);city.worldPort.payments={};city.transfer=(from,to,amount,reason,details)=>{const a=city.accounts.get(from),b=city.accounts.get(to);if(!a||!b||!a.externalMoney&&a.balance<amount)return false;if(!a.externalMoney)a.balance-=amount;if(!b.externalMoney)b.balance+=amount;transactions.push({from,to,amount,reason,details});return true;};return {city,transactions};
  };
  const destination=makePaymentCity(buyer,5000),origin=makePaymentCity(seller,0);
  assert.equal(destination.city.reserveWorldPayment('payment-1','buyer',1200),true);
  assert.equal(destination.city.accounts.get('buyer').balance,3800);
  assert.equal(destination.city.reserveWorldPayment('payment-1','buyer',1200),true);
  assert.equal(origin.city.receiveWorldPayment('payment-1','buyer',1200),true);
  assert.equal(origin.city.settleWorldPayment('payment-1','seller'),true);
  assert.equal(origin.city.accounts.get('seller').balance,1200);
  assert.equal(origin.city.settleWorldPayment('payment-1','seller'),true);
  assert.equal(origin.city.accounts.get('seller').balance,1200);
  assert.equal(destination.city.finalizeWorldPayment('payment-1'),true);
  assert.equal(destination.city.refundWorldPayment('payment-1'),false);
});
