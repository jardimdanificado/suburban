import { CitySimulation } from '../../js/city_simulation.js';
import { WorldClock } from '../../js/world.js';

/** Most older tests exercise contracts/families in an already developed city. */
export function setup({ starter = false } = {}) {
  const tiles = new Uint8Array(128 * 128);
  const world = { width: 128, height: 128, revision: 0, spawnCenter: { x: 64, y: 64 }, clock: new WorldClock(), setTile(x, y, t) { tiles[y * 128 + x] = t; this.revision++; }, getTile(x, y) { return tiles[y * 128 + x]; }, isWalkable(x, y) { return x >= 0 && y >= 0 && x < 128 && y < 128 && ![2, 5].includes(tiles[y * 128 + x]); } };
  let id = 0;
  const city = new CitySimulation({ world, createEntity: data => ({ id: ++id, destroyed: false, ...data }) });
  city.initialize();
  if (!starter) developFixture(city);
  return city;
}
function developFixture(city) {
  const wealthy = city.citizens.filter(c => c.wealthTier === 'wealthy');
  const specs = [['residential', 5], ['residential', 5], ['clinic', 2], ['utility', 2], ['leisure', 2], ['market', 2], ['bakery', 2], ['greengrocer', 2], ['farm', 1, 'maca'], ['farm', 1, 'trigo']];
  let ownerIndex = 0;
  for (const [type, floors, crop] of specs) {
    let b;
    for (const site of city.economy.locateBuilding(type)) {
      b = city.addBuilding(type, site.x, site.y, { ...site, floors, free: true }); if (b) break;
    }
    if (!b) throw Error(`Fixture site unavailable for ${type}`);
    if (type === 'residential' && city.buildings.filter(b => b.type === 'residential').length === 2) { city.economy.investInHousing(true); city.economy.assignHomes(); }
    if (['market', 'bakery', 'greengrocer', 'farm'].includes(type)) {
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
    const c = city.society.citizen(shipment.driverId);
    if (c?.path.length) { const p = c.path.shift(); c.entity.x = p.x; c.entity.y = p.y; }
  }
  if (shipment.status !== 'delivered') throw Error('Shipment did not arrive');
}
export const totalMoney = city => [...city.accounts.values()].reduce((sum, a) => sum + a.balance, 0);
