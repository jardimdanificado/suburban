// Small scene registry used by the renderer. Experiences own simulation rules.
export const globalWallCoords = new Set();

let activeEntities = [];
const entitiesById = new Map();

export function setActiveEntities(entities) {
  activeEntities = entities || [];
  entitiesById.clear();
  for (const entity of activeEntities) if (entity?.id != null) entitiesById.set(entity.id, entity);
}

export function getEntityById(id) {
  return entitiesById.get(Number(id)) || null;
}

export function getTileKey(x, y) {
  return ((Math.floor(x) & 0xffff) << 16) | (Math.floor(y) & 0xffff);
}

export function getEntitiesInViewport(minX, maxX, minY, maxY) {
  return activeEntities.filter((entity) =>
    entity && !entity.destroyed && entity.x + (entity.properties?.cityBuilding?.width || 0) >= minX && entity.x <= maxX &&
    entity.y + (entity.properties?.cityBuilding?.depth || 0) >= minY && entity.y <= maxY
  );
}

export function resolveWallSkin(x, y) {
  const entity = getEntitiesInViewport(x, x, y, y).find((item) => item.properties?.wall);
  return entity?.properties?.render?.skin || "Feature_Wood.png";
}
