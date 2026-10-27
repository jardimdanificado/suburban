import {syncCitizenInterior,advanceCitizenInterior,outdoorCellReady} from '../../js/city_interiors.js';
import { CitySimulation } from '../../js/city_simulation.js';
import { WorldClock } from '../../js/world.js';

/** Most older tests exercise contracts/families in an already developed city. */
export function setup({ starter = false, funded = false, population = 24 } = {}) {
  const tiles = new Uint8Array(128 * 128);
  const world = { width: 128, height: 128, revision: 0, spawnCenter: { x: 64, y: 64 }, clock: new WorldClock(), setTile(x, y, t) { tiles[y * 128 + x] = t; this.revision++; }, getTile(x, y) { return tiles[y * 128 + x]; }, isWalkable(x, y) { return x >= 0 && y >= 0 && x < 128 && y < 128 && ![2, 5].includes(tiles[y * 128 + x]); } };
  let id = 0;
  const city = new CitySimulation({ world, population, createEntity: data => ({ id: ++id, destroyed: false, ...data }) });
  city.initialize();
  if (!starter || funded) fundFixture(city, starter ? 1800000 : 400000);
  if (!starter) developFixture(city);
  return city;
}
/** Contract tests explicitly seed an established ownership distribution; live cities start equal. */
function fundFixture(city, investorCapital) {
  const investors=city.citizens.filter(c=>!city.politics.officeHolder(c)).slice(0,3);
  for(const c of city.citizens) {
    c.fixtureInvestor=investors.includes(c);
    const target=c.fixtureInvestor?investorCapital:5000;
    if(c.balance<target) city.transfer('treasury',c.accountId,target-c.balance,'Fixture capital');
    else city.transfer(c.accountId,'treasury',c.balance-target,'Fixture reserves');
  }
}
function developFixture(city) {
  const wealthy = city.citizens.filter(c => c.fixtureInvestor);
  for (const [i,type] of ['builder','quarry'].entries()) {
    const b=city.buildings.find(b=>b.type===type);b.active=false;b.municipal=false;
    city.transfer(b.accountId,'treasury',b.balance,'Fixture privatization');
    for(const u of b.units){u.price=1000;u.occupantId=null;u.forSale=true;}
    if(!city.economy.purchasePremises(b,wealthy[i],null))throw Error('Fixture starter purchase');
  }
  const specs = [['residential', 5], ['residential', 5], ['clinic', 2], ['utility', 2], ['leisure', 2], ['market', 2], ['bakery', 2], ['greengrocer', 2], ['farm', 1, 'maca'], ['farm', 1, 'trigo']];
  let ownerIndex = 0;
  for (const [type, floors, crop] of specs) {
    let b;
    for (const site of city.economy.locateBuilding(type)) {
      b = city.addBuilding(type, site.x, site.y, { ...site, floors, free: true }); if (b) break;
    }
    if (!b) throw Error(`Fixture site unavailable for ${type}`);
    // Explicit affordable quotes isolate the older contract/family tests from live-market pricing.
    if (type === 'residential') for (const u of b.units) { u.price = 12000; u.rent = 65; }
    if (type === 'residential' && city.buildings.filter(b => b.type === 'residential').length === 2) { city.economy.investInHousing(true); city.economy.assignHomes(); }
    if (['market', 'bakery', 'greengrocer', 'farm'].includes(type)) {
      for(const u of b.units)u.price=1000;
      const investor = wealthy[ownerIndex++ % wealthy.length];
      if (!city.economy.purchasePremises(b, investor, crop || null)) throw Error(`Fixture investor cannot buy ${type}`);
    }
  }
  city.economy.investInHousing(true); city.economy.assignHomes(); city.economy.hire(); city.economy.updateDemand();
}
/** Advance only the logistics subsystem one route cell per minute, without unrelated production. */
export function finishShipment(city, shipment) {
  for (let i = 0; i < 3000 && shipment.status !== 'delivered'; i++) {
    city.minute++; city.logistics.updateMinute();
    for (const c of city.citizens) if (c.deliveryId && c.path.length) {
      const p = c.path.shift(); c.entity.x = p.x; c.entity.y = p.y;
    }
  }
  if (shipment.status !== 'delivered') throw Error(`Shipment ${shipment.id} did not arrive: ${shipment.status}, carrier ${shipment.carrierId}, driver ${shipment.driverId}, candidates ${city.logistics.candidates(shipment).map(c=>c.id).join(',')}, minute ${city.minute}`);
}
export const totalMoney = city => [...city.accounts.values()].reduce((sum, a) => sum + a.balance, 0);

/** Complete an explicitly requested indoor/outdoor route without running unrelated systems. */
export function finishActivityRoute(city,c){
  for(let i=0;i<40;i++){
    if(c.path.length){const last=c.path.at(-1);c.entity.x=last.x;c.entity.y=last.y;c.path=[];}
    advanceCitizenInterior(city,c,100);
    if(syncCitizenInterior(city,c)&&!c.path.length&&!c.indoorLocation?.path?.length)return;
  }
  throw Error(`Activity route did not finish: ${c.task} ${c.action}`);
}
export function putAtWorkCell(city,c,b){
  c.path=[];c.indoorLocation=null;c.task='work';c.targetId=b.id;c.entity.x=b.door.x;c.entity.y=b.door.y;
  if(b.constructionKind==='open-air'){const unit=b.units.find(u=>!['bathroom','dining'].includes(u.roomType));outdoorCellReady(city,c,b,unit);if(c.path.length){const last=c.path.at(-1);c.entity.x=last.x;c.entity.y=last.y;c.path=[];}outdoorCellReady(city,c,b,unit);}
  else finishActivityRoute(city,c);
}
