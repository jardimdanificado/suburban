// Share the exact cells painted by construction soil with vegetation coverage.
export function constructionSiteCells(project, plot) {
  if (project.cancelled || project.status === 'completed' || project.status === 'cancelled') return [];
  const route = project.path || project.route;
  const cells = [];
  if (project.service === 'building' && plot) {
    for (let y = plot.y; y < plot.y + Math.min(plot.depth, project.depth || plot.depth); y++) {
      for (let x = plot.x; x < plot.x + Math.min(plot.width, project.width || plot.width); x++) cells.push({x:x+.5, y:y+.5});
    }
  } else if ((project.service === 'road' || project.service === 'road-repair') && route) {
    for (const point of route) cells.push({x:Math.floor(point.x)+.5, y:Math.floor(point.y)+.5});
  } else if (project.door) cells.push({...project.door});
  return cells;
}

export function grassExclusionCells(buildings, siteCells) {
  const cells = new Set(siteCells.map(p => `${Math.floor(p.x)},${Math.floor(p.y)}`));
  for (const building of buildings) {
    if (building.type !== 'farm' || !building.entity || building.entity.destroyed) continue;
    const {x, y} = building.entity;
    for (let ty = Math.floor(y); ty < Math.ceil(y + building.depth); ty++) {
      for (let tx = Math.floor(x); tx < Math.ceil(x + building.width); tx++) cells.add(`${tx},${ty}`);
    }
  }
  return cells;
}
