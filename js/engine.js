// Scene registry shared by both renderers. Large queries use region buckets.
export const globalWallCoords = new Set();
const entitiesById = new Map(), regions = new Map(), memberships = new Map();
const REGION = 16;
let activeEntities = [], indexGeneration = 0;
const regionKey = (x, y) => `${x},${y}`;

export function setActiveEntities(entities) {
  activeEntities = entities || [];
  const generation = ++indexGeneration;
  for (const entity of activeEntities) {
    if (entity?.id == null || entity.destroyed) continue;
    const building = entity.properties?.cityBuilding, width = building?.width || 0, depth = building?.depth || 0;
    const previous = memberships.get(entity.id);
    if (previous?.entity === entity) {
      previous.generation = generation;
      if (previous.x === entity.x && previous.y === entity.y && previous.width === width && previous.depth === depth) continue;
    }
    const minX = Math.floor(entity.x / REGION), minY = Math.floor(entity.y / REGION);
    const maxX = Math.floor((entity.x + width) / REGION), maxY = Math.floor((entity.y + depth) / REGION);
    if (previous?.entity === entity && previous.minX === minX && previous.minY === minY && previous.maxX === maxX && previous.maxY === maxY) {
      previous.x=entity.x;previous.y=entity.y;previous.width=width;previous.depth=depth;continue;
    }
    removeMembership(entity.id);entitiesById.set(entity.id, entity);
    const keys = [];
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const key = regionKey(x, y); let bucket = regions.get(key);
      if (!bucket) regions.set(key, bucket = new Set());
      bucket.add(entity); keys.push(key);
    }
    memberships.set(entity.id, { minX,minY,maxX,maxY,x:entity.x,y:entity.y,width,depth,generation,keys,entity });
  }
  for (const [id, membership] of memberships) if (membership.generation !== generation) { removeMembership(id);entitiesById.delete(id); }
}

function removeMembership(id) {
  const previous = memberships.get(id); if (!previous) return;
  for (const key of previous.keys) {
    const bucket = regions.get(key); bucket?.delete(previous.entity);
    if (!bucket?.size) regions.delete(key);
  }
  memberships.delete(id);
}
export function getEntityById(id) { return entitiesById.get(Number(id)) || null; }
export function getTileKey(x, y) { return ((Math.floor(x) & 0xffff) << 16) | (Math.floor(y) & 0xffff); }
export function getEntitiesInViewport(minX, maxX, minY, maxY) {
  const candidates = new Set();
  const x0 = Math.floor(minX / REGION), x1 = Math.floor(maxX / REGION);
  const y0 = Math.floor(minY / REGION), y1 = Math.floor(maxY / REGION);
  // Whole-map views are cheaper as one pass than thousands of empty buckets.
  const source = (x1 - x0 + 1) * (y1 - y0 + 1) > regions.size * 2 ? activeEntities : candidates;
  if (source === candidates) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    for (const entity of regions.get(regionKey(x, y)) || []) candidates.add(entity);
  }
  return [...source].filter(entity => entity && !entity.destroyed &&
    entity.x + (entity.properties?.cityBuilding?.width || 0) >= minX && entity.x <= maxX &&
    entity.y + (entity.properties?.cityBuilding?.depth || 0) >= minY && entity.y <= maxY);
}
export function resolveWallSkin(x, y) {
  return getEntitiesInViewport(x, x, y, y).find(item => item.properties?.wall)?.properties?.render?.skin || 'Feature_Wood.png';
}
