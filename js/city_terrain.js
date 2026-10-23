import { TILE_FLOOR, TILE_SAND, TILE_HILL, TILE_STONE, TILE_WATER, TILE_VOID, TILE_ROAD_GRASS, TILE_ROAD_GRASS_STONE, TILE_ROAD_SAND, TILE_ROAD_SAND_STONE, TILE_ROAD_HILL, TILE_ROAD_HILL_STONE } from './world_gen.js';

const heights = [1.1, 5.5, 0, .4, 3.8, 0, 1.1, .4, 1.1, 2.3, 7.5, .4, 2.3, 2.3];
export const ROAD_TILES = new Set([TILE_ROAD_GRASS, TILE_ROAD_GRASS_STONE, TILE_ROAD_SAND, TILE_ROAD_SAND_STONE, TILE_ROAD_HILL, TILE_ROAD_HILL_STONE]);
const land = new Set([TILE_FLOOR, TILE_SAND, TILE_HILL, ...ROAD_TILES]);
export const tileKey = (x, y) => `${x},${y}`;
export const tileHeight = tile => heights[tile] ?? 0;
export function tileAt(world, x, y) { return x < 0 || y < 0 || x >= world.width || y >= world.height ? TILE_VOID : world.getTile(x, y); }
export function terrainWalkable(world, x, y) { return land.has(tileAt(world, x, y)); }
export function canStep(world, x, y, nx, ny) { return terrainWalkable(world, nx, ny) && Math.abs(tileHeight(tileAt(world, x, y)) - tileHeight(tileAt(world, nx, ny))) <= 1.25; }
export function roadFor(tile) {
  if ([TILE_FLOOR, TILE_ROAD_GRASS, TILE_ROAD_GRASS_STONE].includes(tile)) return TILE_ROAD_GRASS_STONE;
  if ([TILE_SAND, TILE_ROAD_SAND, TILE_ROAD_SAND_STONE].includes(tile)) return TILE_ROAD_SAND_STONE;
  if ([TILE_HILL, TILE_ROAD_HILL, TILE_ROAD_HILL_STONE].includes(tile)) return TILE_ROAD_HILL_STONE;
  return null;
}
// Match the renderer's interpolated corners, without changing any terrain tile.
export function cornerHeight(world, x, y) {
  const tiles = [tileAt(world, x - 1, y - 1), tileAt(world, x, y - 1), tileAt(world, x - 1, y), tileAt(world, x, y)].filter(t => t !== TILE_WATER && t !== TILE_VOID);
  return tiles.length ? tiles.reduce((sum, t) => sum + tileHeight(t), 0) / tiles.length : 0;
}
export function surfaceBounds(world, x, y, width, depth) {
  let min = Infinity, max = -Infinity;
  for (let yy = y; yy <= y + depth; yy++) for (let xx = x; xx <= x + width; xx++) {
    const height = cornerHeight(world, xx, yy); min = Math.min(min, height); max = Math.max(max, height);
  }
  return { min, max, variation: max - min, base: max + .06 };
}
export function surfaceElevation(world, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y), u = x - tx, v = y - ty;
  return cornerHeight(world, tx, ty) * (1 - u) * (1 - v) + cornerHeight(world, tx + 1, ty) * u * (1 - v) + cornerHeight(world, tx, ty + 1) * (1 - u) * v + cornerHeight(world, tx + 1, ty + 1) * u * v;
}
/** A saleable plot has one elevation, including its interpolated surface and entrance. */
export function flatSiteLevel(world, x, y, width, depth) {
  const level = tileHeight(tileAt(world, x, y));
  for (let yy = y; yy < y + depth; yy++) for (let xx = x; xx < x + width; xx++) {
    if (!terrainWalkable(world, xx, yy) || tileHeight(tileAt(world, xx, yy)) !== level) return null;
  }
  const surface = surfaceBounds(world, x, y, width, depth);
  const doorLevel = tileHeight(tileAt(world, x + Math.floor(width / 2), y + depth));
  return surface.variation < .001 && Math.abs(surface.min - level) < .001 && doorLevel === level ? level : null;
}
export function buildingGround(world, x, y, width, depth) {
  const terrain = surfaceBounds(world, x, y, width, depth);
  const door = { x: x + Math.floor(width / 2) + .5, y: y + depth + .5 };
  return { ...terrain, base: Math.max(terrain.base, surfaceElevation(world, door.x, door.y) + .06), door };
}
export function inspectBuildingSite(city, x, y, width, depth, { plotId = null, type = null } = {}) {
  if (city.development?.overlaps(x, y, width, depth, plotId)) return { error: 'Este espaço já pertence a um terreno cadastrado.' };
  const { world, occupied } = city;
  const quarry = type === 'quarry' || type === 'iron_mine';
  for (let yy = y - 1; yy <= y + depth; yy++) for (let xx = x - 1; xx <= x + width; xx++) {
    if (occupied.has(tileKey(xx, yy))) return { error: 'Deixe uma célula livre entre os prédios.' };
    if (xx >= x && xx < x + width && yy >= y && yy < y + depth) {
      if (!terrainWalkable(world, xx, yy) && !(quarry && tileAt(world, xx, yy) === TILE_STONE)) return { error: 'O prédio precisa caber em terra firme, fora da água e das encostas rochosas.' };
      if (ROAD_TILES.has(tileAt(world, xx, yy))) return { error: 'A construção não pode ocupar uma rua.' };
    }
  }
  let door = { x: x + Math.floor(width / 2) + .5, y: y + depth + .5 };
  if (quarry || type === 'farm') {
    if (quarry && world.map && !quarryDeposits(world, x, y, width, depth).length) return { error: 'A área da pedreira precisa ocupar rochas.' };
    const doors = [];
    for (let dx = 0; dx < width; dx++) { doors.push({ x: x + dx + .5, y: y + depth + .5 }, { x: x + dx + .5, y: y - .5 }); }
    for (let dy = 0; dy < depth; dy++) { doors.push({ x: x - .5, y: y + dy + .5 }, { x: x + width + .5, y: y + dy + .5 }); }
    door = doors.find(p => terrainWalkable(world, Math.floor(p.x), Math.floor(p.y)) && !occupied.has(tileKey(Math.floor(p.x), Math.floor(p.y))));
    if (!door) return { error: quarry ? 'A pedreira precisa de uma entrada acessível junto às rochas.' : 'A fazenda precisa de uma entrada acessível em terra firme.' };
  }
  if (!terrainWalkable(world, Math.floor(door.x), Math.floor(door.y))) return { error: 'A entrada precisa ter acesso por terra firme.' };
  const terrain = buildingGround(world, x, y, width, depth);
  if (!quarry && type !== 'farm' && (terrain.variation > 1.3 || terrain.base - tileHeight(tileAt(world, Math.floor(door.x), Math.floor(door.y))) > 1.65)) return { error: 'Encosta muito íngreme. Escolha um lote menor ou outro trecho do terreno.' };
  return { ...terrain, door };
}

class MinHeap {
  items = [];
  push(node) {
    const a = this.items; a.push(node); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].score <= node.score) break; a[i] = a[p]; i = p; } a[i] = node;
  }
  pop() {
    const a = this.items, first = a[0], last = a.pop();
    if (a.length) { let i = 0; while (i * 2 + 1 < a.length) { let child = i * 2 + 1; if (child + 1 < a.length && a[child + 1].score < a[child].score) child++; if (a[child].score >= last.score) break; a[i] = a[child]; i = child; } a[i] = last; }
    return first;
  }
}

export function findTerrainPath(world, start, goal, blocked = new Set(), { limit = 30000, extraBlocked = null } = {}) {
  const sx = Math.floor(start.x), sy = Math.floor(start.y), gx = Math.floor(goal.x), gy = Math.floor(goal.y);
  if (!terrainWalkable(world, sx, sy) || !terrainWalkable(world, gx, gy) || blocked.has(tileKey(gx, gy))) return null;
  const startKey = tileKey(sx, sy), goalKey = tileKey(gx, gy);
  const open = new MinHeap(), costs = new Map([[startKey, 0]]), parents = new Map();
  open.push({ x: sx, y: sy, cost: 0, score: 0 });
  let visited = 0;
  while (open.items.length && visited++ < limit) {
    const current = open.pop(), k = tileKey(current.x, current.y);
    if (current.cost !== costs.get(k)) continue;
    if (k === goalKey) {
      const path = []; let step = [gx, gy];
      while (tileKey(...step) !== startKey) { path.push({ x: step[0] + .5, y: step[1] + .5 }); step = parents.get(tileKey(...step)); }
      return path.reverse();
    }
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const x = current.x + dx, y = current.y + dy, nextKey = tileKey(x, y);
      if (blocked.has(nextKey) || extraBlocked?.(x, y) || !canStep(world, current.x, current.y, x, y)) continue;
      const tile = tileAt(world, x, y);
      const cost = current.cost + (ROAD_TILES.has(tile) ? .55 : tile === TILE_HILL ? 1.6 : tile === TILE_SAND ? 1.2 : 1) + Math.abs(tileHeight(tile) - tileHeight(tileAt(world, current.x, current.y))) * .7;
      if (cost >= (costs.get(nextKey) ?? Infinity)) continue;
      costs.set(nextKey, cost); parents.set(nextKey, [current.x, current.y]);
      open.push({ x, y, cost, score: cost + (Math.abs(gx - x) + Math.abs(gy - y)) * .55 });
    }
  }
  return null;
}

export function hasSettlementAccess(world, door, x, y, width, depth) {
  const start = [Math.floor(door.x), Math.floor(door.y)], queue = [start], seen = new Set([tileKey(...start)]);
  for (let head = 0; head < queue.length && seen.size < 256; head++) {
    const [cx, cy] = queue[head];
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, key = tileKey(nx, ny);
      if (seen.has(key) || (nx >= x && nx < x + width && ny >= y && ny < y + depth) || !canStep(world, cx, cy, nx, ny)) continue;
      seen.add(key); queue.push([nx, ny]);
    }
  }
  return seen.size >= 256;
}

export function pavePath(world, path) {
  for (const p of path) { const x = Math.floor(p.x), y = Math.floor(p.y), tile = tileAt(world, x, y), road = roadFor(tile); if (road !== null && road !== tile) world.setTile(x, y, road); }
}

export function generateSettlement(city) {
  const { world } = city;
  const origin = { ...world.spawnCenter };
  let hub = null;
  const specs = [['townhall', 4, 4, 2], ['builder', 3, 3, 1], ['quarry', 4, 4, 1], ['mint', 3, 3, 1]];
  for (const [type, w, d, h] of specs) {
    const angle = city.random() * Math.PI * 2, radius = hub ? 8 + city.random() * 13 : 0;
    const preferred = { x: (hub?.x ?? origin.x) + Math.cos(angle) * radius, y: (hub?.y ?? origin.y) + Math.sin(angle) * radius };
    let placed = null;
    for (const searchRadius of [24, 48, 96]) {
      const candidates = [];
      const center = hub || origin;
      for (let y = Math.max(1, Math.floor(center.y - searchRadius)); y < Math.min(world.height - d - 1, center.y + searchRadius); y++) for (let x = Math.max(1, Math.floor(center.x - searchRadius)); x < Math.min(world.width - w - 1, center.x + searchRadius); x++) {
        const site = inspectBuildingSite(city, x, y, w, d, { type });
        if (site.error) continue;
        if (type === 'quarry' && world.map && !quarryDeposits(world, x, y, w, d).length) continue;
        const score = Math.hypot(x - preferred.x, y - preferred.y) + site.variation * 8 + city.random() * 3 + (flatSiteLevel(world, x, y, w, d) === null ? 10000 : 0);
        candidates.push({ x, y, score });
      }
      candidates.sort((a, b) => a.score - b.score);
      for (const candidate of candidates.slice(0, 100)) {
        placed = city.addBuilding(type, candidate.x, candidate.y, { width: w, depth: d, floors: h, free: true });
        if (placed) break;
      }
      if (placed) break;
    }
    if (!placed) throw new Error(`Não há terreno acessível para ${type}. Experimente outra semente.`);
    if (!hub) { hub = { ...placed.door }; city.spawn = { ...hub }; }
  }
  const xs = city.buildings.map(b => b.entity.x + b.width / 2), ys = city.buildings.map(b => b.entity.y + b.depth / 2);
  world.spawnCenter = { x: Math.round(xs.reduce((a, b) => a + b) / xs.length), y: Math.round(ys.reduce((a, b) => a + b) / ys.length) };
  city.bounds = { minX: Math.min(...xs) - 12, maxX: Math.max(...xs) + 12, minY: Math.min(...ys) - 12, maxY: Math.max(...ys) + 12 };
}

// Extraction is tied to rocky tiles inside the quarry footprint.
export function quarryDeposits(world, x, y, width, depth) {
  const deposits = [];
  for (let yy = y; yy < y + depth; yy++) for (let xx = x; xx < x + width; xx++) {
    if (tileAt(world, xx, yy) === TILE_STONE) deposits.push({ x: xx, y: yy });
  }
  return deposits;
}
