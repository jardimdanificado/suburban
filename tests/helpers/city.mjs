import { CitySimulation } from '../../js/city_simulation.js';
import { WorldClock } from '../../js/world.js';

export function setup() {
  const tiles = new Uint8Array(128 * 128);
  const world = { width: 128, height: 128, revision: 0, spawnCenter: { x: 64, y: 64 }, clock: new WorldClock(), setTile(x, y, t) { tiles[y * 128 + x] = t; this.revision++; }, getTile(x, y) { return tiles[y * 128 + x]; }, isWalkable(x, y) { return x >= 0 && y >= 0 && x < 128 && y < 128 && ![2, 5].includes(tiles[y * 128 + x]); } };
  let id = 0;
  const city = new CitySimulation({ world, createEntity: data => ({ id: ++id, destroyed: false, ...data }) });
  city.initialize();
  return city;
}
export const totalMoney = city => [...city.accounts.values()].reduce((sum, a) => sum + a.balance, 0);

