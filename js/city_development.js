import { inspectBuildingSite, findTerrainPath, flatSiteLevel, tileAt, tileHeight, canStep, ROAD_TILES, pavePath, roadFor } from './city_terrain.js';
import { initializeInventory, inventoryFree } from './city_inventory.js';

export const DEVELOPMENT_RULES = { landPerCell: 4000, stonePerCell: 2, laborPerCell: 3, constructionFeePerCell: 12000, roadStonePerTile: 1, roadLaborPerTile: 2, roadFeePerTile: 8000, municipalMultiplier: 1.5, wearInterval: 30 * 1440, repairThreshold: 60 };
export class CityDevelopment {
  constructor(city) { this.city = city; this.plots = []; this.projects = []; this.nextPlotId = 1; this.nextProjectId = 1; }
  clientCitizen(accountId) { return accountId === 'treasury' ? this.city.economy.citizen(this.city.economy.mayorId) : this.ownerCitizen(accountId); }
  selectBuilder(clientId, door, builderId = null) {
    return this.city.economy.businesses.filter(b => b.type === 'builder' && (!builderId || b.id === builderId) && b.accountId !== clientId && this.city.economy.connected(b, { id: `site:${door.x}:${door.y}`, door })).sort((a, b) => this.projects.filter(p => p.builderId === a.id && !p.cancelled && p.status !== 'completed').length - this.projects.filter(p => p.builderId === b.id && !p.cancelled && p.status !== 'completed').length || a.id - b.id)[0] || null;
  }
  serviceOffers(builderId) {
    const b = this.city.building(builderId);
    if (!b?.active || b.type !== 'builder') return [];
    return [{ service: 'building', label: 'Empreendimento sob medida', feePerCell: this.city.currency.price(DEVELOPMENT_RULES.constructionFeePerCell) }, { service: 'road', label: 'Construção de estrada', feePerCell: this.city.currency.price(DEVELOPMENT_RULES.roadFeePerTile) }, { service: 'expansion', label: 'Ampliação de edifício', feePerCell: this.city.currency.price(DEVELOPMENT_RULES.constructionFeePerCell) }];
  }
  registerService(accountId, builder, details) {
    const city = this.city, owner = this.clientCitizen(accountId);
    if (!owner || !builder || !Number.isSafeInteger(details.stone) || details.stone < 1) return null;
    const project = { id: `project:${this.nextProjectId++}`, accountId, ownerId: owner.id, builderId: builder.id, active: true, status: 'materials', startedAt: city.minute, cancelled: false, labor: 0, plotId: null, ...details };
    initializeInventory(project, city.economy.goods, project.stone + 48);
    project.feeAccountId = `construction-fee:${project.id}`;
    city.accounts.set(project.feeAccountId, { name: `Contrato ${project.id}`, balance: 0 });
    const ordinaryFee = project.fee;
    project.fee = accountId === 'treasury' ? Math.ceil(ordinaryFee * DEVELOPMENT_RULES.municipalMultiplier) : ordinaryFee;
    const materialCost = details.stone * city.economy.goods.pedra.price;
    project.requiredBudget = project.fee + materialCost;
    const ordinaryMaterialCost = materialCost;
    if ((city.accounts.get(accountId)?.balance || 0) < project.fee + ordinaryMaterialCost) { city.accounts.delete(project.feeAccountId); return null; }
    if (!city.transfer(accountId, project.feeAccountId, project.fee, 'Reserva do serviço de construção')) { city.accounts.delete(project.feeAccountId); return null; }
    this.projects.push(project);
    city.log(`${city.accountName(accountId)} contratou ${builder.entity.properties.name}: ${project.name}.`, 'construction', [owner.id, builder.ownerId].filter(Boolean), { kind: 'service-contracted', projectId: project.id, service: project.service, fee: project.fee });
    return project;
  }
  beginRoad(accountId, start, end, { builderId = null } = {}) {
    const city = this.city;
    if (!start || !end || ![start.x, start.y, end.x, end.y].every(Number.isFinite)) return null;
    const path = findTerrainPath(city.world, start, end, city.occupied, { extraBlocked: (x, y) => this.plots.some(p => x >= p.x && x < p.x + p.width && y >= p.y && y < p.y + p.depth) });
    if (path === null) return null;
    const route = [{ x: Math.floor(start.x) + .5, y: Math.floor(start.y) + .5 }, ...path];
    const tiles = route.filter(p => !ROAD_TILES.has(tileAt(city.world, Math.floor(p.x), Math.floor(p.y))));
    if (!tiles.length || tiles.some(p => this.plots.some(l => p.x >= l.x && p.x < l.x + l.width && p.y >= l.y && p.y < l.y + l.depth)) || this.projects.some(p => p.service === 'road' && !p.cancelled && p.status !== 'completed' && p.path.some(t => tiles.some(n => n.x === t.x && n.y === t.y)))) return null;
    const builder = this.selectBuilder(accountId, tiles[0], builderId);
    return this.registerService(accountId, builder, { service: 'road', type: 'road', name: `Estrada de ${tiles.length} células`, path: tiles, route, door: { ...tiles[0] }, stone: tiles.length * DEVELOPMENT_RULES.roadStonePerTile, requiredLabor: tiles.length * DEVELOPMENT_RULES.roadLaborPerTile, fee: tiles.length * city.currency.price(DEVELOPMENT_RULES.roadFeePerTile) });
  }
  beginExpansion(accountId, buildingId, { floors = 1, builderId = null } = {}) {
    const b = this.city.building(buildingId);
    if (!b || b.constructionKind !== 'building' || !Number.isInteger(floors) || floors < 1 || b.floors + floors > 12 || !b.units.every(u => u.ownerId === accountId) || this.projects.some(p => p.buildingId === buildingId && p.service === 'expansion' && !p.cancelled && p.status !== 'completed')) return null;
    const builder = this.selectBuilder(accountId, b.door, builderId), cells = b.width * b.depth * floors;
    const project = this.registerService(accountId, builder, { service: 'expansion', type: b.type, name: `Ampliação de ${b.entity.properties.name}`, buildingId, plotId: b.plotId, baseFloors: b.floors, floors, targetFloors: b.floors + floors, door: { ...b.door }, stone: cells * DEVELOPMENT_RULES.stonePerCell, requiredLabor: cells * DEVELOPMENT_RULES.laborPerCell, fee: cells * this.city.currency.price(DEVELOPMENT_RULES.constructionFeePerCell) });
    const lot = this.plots.find(p => p.id === b.plotId); if (project && lot) lot.projectId = project.id;
    return project;
  }
  completeService(project) {
    const city = this.city;
    if (project.status === 'completed' || project.cancelled || project.inventory.pedra < project.stone || project.labor < project.requiredLabor) return null;
    let result;
    if (project.service === 'lamp') {
      result = city.lighting.completePost(project);
      if (!result) { project.status = 'blocked'; project.error = 'Local do poste indisponível.'; return null; }
    } else if (project.service === 'road' || project.service === 'road-repair') {
      if (project.route.some(t => this.plots.some(p => t.x >= p.x && t.x < p.x + p.width && t.y >= p.y && t.y < p.y + p.depth)) || project.route.some(p => !city.walkable(Math.floor(p.x), Math.floor(p.y))) || project.route.some((p, i, route) => i && !canStep(city.world, Math.floor(route[i - 1].x), Math.floor(route[i - 1].y), Math.floor(p.x), Math.floor(p.y)))) { project.status = 'blocked'; project.error = 'Trajeto deixou de ser acessível.'; return null; }
      pavePath(city.world, project.route); result = project;
      if (project.service === 'road-repair') for (const p of project.route) { const x = Math.floor(p.x), y = Math.floor(p.y), tile = tileAt(city.world, x, y); if (ROAD_TILES.has(tile)) { city.world.setTile(x, y, roadFor(tile)); city.world.roadCondition?.set(`${x},${y}`, 100); } }
      if (project.service === 'road') project.service = 'road';
    } else {
      const b = city.building(project.buildingId);
      if (!b || (project.service === 'expansion' && b.floors !== project.baseFloors)) { project.status = 'blocked'; project.error = 'Edifício foi removido ou alterado durante a obra.'; return null; }
      if (project.service === 'repair') { b.condition = 100; b.repairNeeded = false; }
      else {
      if (project.service === 'expansion') for (let z = b.floors; z < project.targetFloors; z++) city.housing.addFloor(b, z, project.accountId);
      city.sanitation.setupBuilding(b);
      city.sanitation.setupBusinessRooms(b);
      if (project.service === 'expansion') {
      b.floors = project.targetFloors; b.inventoryCapacity += b.width * b.depth * project.floors * 16;
      b.jobs += b.type === 'townhall' ? project.floors : 0; b.geometryRevision = (b.geometryRevision || 0) + 1;
      }
      }
      const lot = this.plots.find(p => p.id === b.plotId); if (lot) lot.projectId = null;
      result = b;
    }
    project.inventory.pedra -= project.stone; city.economy.consumed.pedra += project.stone;
    city.economy.recordGoods(project.service, 'pedra', project.stone, project.id, project.buildingId || null);
    project.status = 'completed'; project.error = null; project.completedAt = city.minute;
    city.transfer(project.feeAccountId, city.building(project.builderId)?.accountId || project.accountId, project.fee, 'Serviço de construção');
    const account = city.accounts.get(project.accountId); if (account?.entity?.properties.cityBuilding) account.totalExpenses += project.fee;
    city.history.record('service',`${project.name}: serviço concluído.`,[project.accountId,city.building(project.builderId)?.accountId,city.building(project.buildingId)?.accountId],{amount:project.fee,projectId:project.id,service:project.service,stone:project.stone});
    city.workMeals.closeSite(project, project.service === 'expansion' ? result : null);
    city.log(`${project.name} concluída por ${city.building(project.builderId)?.entity.properties.name || 'construtora'}.`, 'construction', [project.ownerId], { kind: 'service-completed', projectId: project.id, service: project.service });
    return result;
  }
  planPublicWorks() {
    const city = this.city, hall = city.buildings.find(b => b.type === 'townhall' && !b.entity.destroyed);
    if (!hall || !this.clientCitizen('treasury') || city.treasury < city.currency.price(100000) || city.hour % 6 !== 0) return;
    const activePublic = this.projects.filter(p => p.accountId === 'treasury' && !p.cancelled && p.status !== 'completed');
    const targetFloors = Math.min(6, 2 + Math.floor((city.citizens.length + city.economy.businesses.length * 2) / 36));
    if (hall.floors < targetFloors && !activePublic.some(p => p.service === 'expansion')) this.beginExpansion('treasury', hall.id);
    const housing = city.buildings.filter(b => ['residential', 'popular_housing', 'luxury_housing'].includes(b.type)).length;
    if (housing < 1 && !activePublic.some(p => ['residential', 'popular_housing', 'luxury_housing'].includes(p.type))) {
      const lot = this.plots.find(p => p.ownerId === 'treasury' && !p.projectId && !p.buildingId && p.width >= 3 && p.depth >= 3 && p.width<=8 && p.depth<=8 && !['quarry','farm'].includes(p.type));
      if (lot) this.beginProject('treasury', lot.id, 'popular_housing', { floors: 3 });
    }
    if (city.citizens.some(c => c.needs.food < 35) && city.treasury > city.currency.price(500000) && !city.buildings.some(b => b.type === 'popular_refectory') && !activePublic.some(p => p.type === 'popular_refectory')) {
      const lot = this.plots.find(p => p.ownerId === 'treasury' && !p.projectId && !p.buildingId && p.width >= 3 && p.depth >= 3 && p.width<=8 && p.depth<=8 && !['quarry','farm'].includes(p.type));
      if (lot) this.beginProject('treasury', lot.id, 'popular_refectory');
    }
    if (city.stats().homeless >= 5 && !city.buildings.some(b => b.type === 'popular_housing') && !this.projects.some(p => p.type === 'popular_housing' && !p.cancelled && p.status !== 'completed') && city.treasury > city.currency.price(5000000)) {
      const lot = this.plots.find(p => p.ownerId === 'treasury' && !p.projectId && !p.buildingId && p.width >= 3 && p.depth >= 3 && p.width<=8 && p.depth<=8 && !['quarry','farm'].includes(p.type));
      if (lot) this.beginProject('treasury', lot.id, 'popular_housing', { floors: 3 });
    }
    if (city.economy.businesses.length >= 5 && city.treasury > city.currency.price(500000) && !city.buildings.some(b => b.type === 'public_toilet') && !this.projects.some(p => p.type === 'public_toilet' && !p.cancelled && p.status !== 'completed')) { const lot = this.plots.find(p => p.ownerId === 'treasury' && !p.projectId && !p.buildingId && p.width >= 3 && p.depth >= 3 && p.width<=8 && p.depth<=8 && !['quarry','farm'].includes(p.type)); if (lot) this.beginProject('treasury', lot.id, 'public_toilet'); }
    if (city.treasury > city.currency.price(2000000) && !activePublic.some(p => p.service === 'road')) {
      for (const b of city.buildings.filter(b => !b.entity.destroyed && b.id !== hall.id).sort((a,b)=>city.trafficScore(b.accessPath)-city.trafficScore(a.accessPath))) {
        if (this.beginRoad('treasury', b.door, hall.door)) break;
      }
    }
    const repairable = city.buildings.filter(b => b.repairNeeded && !this.projects.some(p => p.service === 'repair' && p.buildingId === b.id && p.status !== 'completed' && !p.cancelled));
    if (city.treasury > city.currency.price(500000)) for (const b of repairable) if (this.beginRepair('treasury', b.id)) break;
    const damagedRoad = this.cityRoadNeedsRepair();
    if (damagedRoad.length && city.random() < .01 && city.treasury > city.currency.price(1000000) && !this.projects.some(p => p.service === 'road-repair' && p.status !== 'completed' && !p.cancelled)) this.beginRoadRepair('treasury', damagedRoad.sort((a,b)=>city.trafficScore([b])-city.trafficScore([a])).slice(0, 12));
  }
  cityRoadNeedsRepair() {
    const out = [];
    for (const [key, condition] of this.city.world.roadCondition || []) {
      if (condition > DEVELOPMENT_RULES.repairThreshold) continue;
      const [x, y] = key.split(',').map(Number);
      if (ROAD_TILES.has(tileAt(this.city.world, x, y))) out.push({ x: x + .5, y: y + .5 });
    }
    return out;
  }
  beginRepair(accountId, buildingId) {
    const b = this.city.building(buildingId);
    if (!b?.repairNeeded) return null;
    const cells = b.width * b.depth, builder = this.selectBuilder(accountId, b.door);
    return this.registerService(accountId, builder, { service: 'repair', type: b.type, name: `Reparo de ${b.entity.properties.name}`, buildingId, plotId: b.plotId, door: { ...b.door }, stone: Math.max(2, Math.ceil(cells * .25)), requiredLabor: Math.max(4, Math.ceil(cells * .75)), fee: cells * this.city.currency.price(2500) });
  }
  beginRoadRepair(accountId, path, { builderId = null } = {}) {
    if (!path?.length) return null;
    const builder = this.selectBuilder(accountId, path[0], builderId);
    return this.registerService(accountId, builder, { service: 'road-repair', type: 'road', name: `Reparo de ${path.length} trechos de estrada`, path, route: path, door: { ...path[0] }, stone: path.length, requiredLabor: path.length * DEVELOPMENT_RULES.roadLaborPerTile, fee: path.length * this.city.currency.price(2500) });
  }
  homeCount(buildingId) { return [...this.city.housing.homes.values()].filter(h => h.buildingId === buildingId).length; }
  updateWear() {
    const city = this.city;
    if (city.minute % DEVELOPMENT_RULES.wearInterval !== 0) return;
    for (const b of city.buildings.filter(b => !b.entity.destroyed)) {
      b.condition = Math.max(0, (b.condition ?? 100) - (b.constructionKind === 'open-air' ? 2 : 1));
      b.repairNeeded = b.condition <= DEVELOPMENT_RULES.repairThreshold;
    }
    if (city.world.map) for (let y = 0; y < city.world.height; y++) for (let x = 0; x < city.world.width; x++) {
      const tile = tileAt(city.world, x, y);
      if (ROAD_TILES.has(tile) && city.random() < .015) {
        const k = `${x},${y}`, condition = Math.max(0, (city.world.roadCondition?.get(k) ?? 100) - 10);
        (city.world.roadCondition ??= new Map()).set(k, condition);
        if (condition <= DEVELOPMENT_RULES.repairThreshold) city.world.setTile(x, y, Math.floor(tile / 2) * 2);
      }
    }
  }
  ownerCitizen(accountId) {
    const account = this.city.accounts.get(accountId);
    if (account?.entity?.destroyed) return null;
    if (account?.municipal) return this.city.economy.citizen(this.city.economy.mayorId);
    return account?.entity?.properties.citizen ? this.city.society.citizen(account.id) : this.city.economy.citizen(account?.ownerId);
  }
  attachBuilding(b, ownerId = 'treasury') {
    const lot = { id: this.nextPlotId++, x: b.entity.x, y: b.entity.y, width: b.width, depth: b.depth, door: { ...b.door }, ownerId, price: b.width * b.depth * this.city.currency.price(DEVELOPMENT_RULES.landPerCell), forSale: false, forRent: false, rent: 0, buildingId: b.id, projectId: null };
    this.plots.push(lot); b.plotId = lot.id; return lot;
  }
  overlaps(x, y, width, depth, exceptId = null) {
    return this.plots.some(p => p.id !== exceptId && x - 1 < p.x + p.width && x + width + 1 > p.x && y - 1 < p.y + p.depth && y + depth + 1 > p.y);
  }
  isFarmPlot(plot) {
    if (plot.type === 'quarry' || plot.width < 8 || plot.depth < 8) return false;
    let fertile = 0;
    for (let y = plot.y; y < plot.y + plot.depth; y++) for (let x = plot.x; x < plot.x + plot.width; x++) {
      if ([0, 9].includes(tileAt(this.city.world, x, y))) fertile++;
    }
    return fertile >= plot.width * plot.depth * .75;
  }
  createPlot(x, y, width = 4, depth = 4, { type = null } = {}) {
    if (![x, y, width, depth].every(Number.isInteger) || width < 2 || depth < 2 || width > 20 || depth > 20 || this.overlaps(x, y, width, depth)) return null;
    if (this.projects.some(p => p.service === 'road' && !p.cancelled && p.status !== 'completed' && p.route.some(t => t.x >= x && t.x < x + width && t.y >= y && t.y < y + depth))) return null;
    if (!type) for (let yy = y; yy < y + depth; yy++) for (let xx = x; xx < x + width; xx++) if (tileAt(this.city.world, xx, yy) === 4) type = 'quarry';
    if (type === 'farm' && !this.isFarmPlot({ x, y, width, depth, type })) return null;
    const terrain = inspectBuildingSite(this.city, x, y, width, depth, { type });
    const level = flatSiteLevel(this.city.world, x, y, width, depth);
    if (terrain.error || (level === null && type !== 'quarry' && type !== 'farm')) return null;
    const hall = this.city.buildings[0];
    if (hall && findTerrainPath(this.city.world, terrain.door, hall.door, this.city.occupied, { extraBlocked: (xx, yy) => (xx >= x && xx < x + width && yy >= y && yy < y + depth) || this.plots.some(p => xx >= p.x && xx < p.x + p.width && yy >= p.y && yy < p.y + p.depth) }) === null) return null;
    const p = { id: this.nextPlotId++, x, y, width, depth, type, door: terrain.door, level, ownerId: 'treasury', price: width * depth * this.city.currency.price(DEVELOPMENT_RULES.landPerCell), forSale: true, forRent: false, rent: 0, buildingId: null, projectId: null };
    this.plots.push(p); return p;
  }
  ensurePlots(count = 18) {
    const available = () => this.plots.filter(p => !p.buildingId && !p.projectId && p.ownerId === 'treasury');
    const ruralTarget = 3;
    const supply = () => {
      const plots = available();
      return { rural: plots.filter(p => this.isFarmPlot(p)).length, urban: plots.filter(p => p.type !== 'farm' && p.width <= 8 && p.depth <= 8).length };
    };
    let stock = supply();
    // A full urban catalogue must never stop the search for agricultural land.
    if (stock.urban >= count && stock.rural >= ruralTarget) return;
    if (this.nextPlotSearchAt > this.city.minute) return;
    this.nextPlotSearchAt = this.city.minute + 60;
    const budget = this.hasSearchedPlots ? 24 : 96;
    this.hasSearchedPlots = true;
    const ruralSizes = [[10, 10], [8, 12], [12, 12], [16, 12], [8, 8]];
    const urbanSizes = [[4, 5], [6, 6], [5, 7], [4, 4]];
    const center = this.city.world.spawnCenter;
    const maxRadius = Math.max(this.city.world.width, this.city.world.height) * .65;
    const radii = [];
    for (let r = 8; r < maxRadius; r += 6) { radii.push(r); if (r + 30 < maxRadius) radii.push(r + 30); }
    const rings = [...new Set(radii)], total = rings.length * 32;
    const start = (this.plotSearchCursor || 0) % total;
    for (let offsetIndex = 0; offsetIndex < Math.min(total, budget); offsetIndex++) {
      const index = (start + offsetIndex) % total;
      this.plotSearchCursor = (index + 1) % total;
      const radius = rings[Math.floor(index / 32)], step = index % 32;
      const angle = step * Math.PI / 16 + (this.city.initialSeed % 11) * .07;
      const x = Math.floor(center.x + Math.cos(angle) * radius), y = Math.floor(center.y + Math.sin(angle) * radius);
      let created = null;
      if (stock.rural < ruralTarget) for (const [width, depth] of ruralSizes) {
        created = this.createPlot(x, y, width, depth, { type: 'farm' });
        if (created) break;
      }
      if (!created && stock.urban < count) {
        const offset = this.nextPlotId % urbanSizes.length;
        for (let i = 0; i < urbanSizes.length; i++) {
          const [width, depth] = urbanSizes[(offset + i) % urbanSizes.length];
          created = this.createPlot(x, y, width, depth);
          if (created) break;
        }
      }
      if (created) stock = supply();
      if (stock.urban >= count && stock.rural >= ruralTarget) return;
    }
  }

  buyPlot(accountId, plotId) {
    const p = this.plots.find(p => p.id === plotId), a = this.city.accounts.get(accountId);
    if (!p || !a || !p.forSale || p.ownerId === accountId || p.projectId || (!a.entity?.properties.citizen && a.type !== 'builder')) return this.city.fail('Terreno indisponível para compra.');
    if (!this.city.transfer(accountId, p.ownerId, p.price, 'Compra de terreno')) return this.city.fail('Saldo insuficiente para comprar o terreno.');
    this.city.history.record('ownership',`Terreno ${p.id}: ${this.city.accountName(p.ownerId)} → ${this.city.accountName(accountId)}.`,[p.ownerId,accountId,`plot:${p.id}`],{plotId:p.id,amount:p.price});
    p.ownerId = accountId; p.forSale = p.forRent = false;
    this.city.log(`${this.city.accountName(accountId)} comprou o terreno ${p.id}.`, 'land', this.ownerCitizen(accountId) ? [this.ownerCitizen(accountId).id] : [], { kind: 'land-purchase', plotId }); return p;
  }
  listPlot(accountId, plotId, { price, rent = 0, forSale = false, forRent = false }) {
    const p = this.plots.find(p => p.id === plotId);
    if (!p || p.ownerId !== accountId || p.projectId || !Number.isSafeInteger(price) || price < 1 || !Number.isSafeInteger(rent) || rent < 0) return false;
    Object.assign(p, { price, rent, forSale: p.ownerId === 'treasury' || !!forSale, forRent: p.ownerId !== 'treasury' && !!forRent }); return true;
  }
  beginProject(accountId, plotId, type, { kind = type === 'farm' || type === 'quarry' ? 'open-air' : 'building', floors = ['residential', 'popular_housing', 'luxury_housing'].includes(type) ? 3 : 1, crop = null, sell = false, width = null, depth = null, builderId = null, selfBuild = false, priority = 0 } = {}) {
    const city = this.city, p = this.plots.find(p => p.id === plotId), owner = this.clientCitizen(accountId);
    if ((kind === 'open-air' && !['farm', 'quarry', 'leisure', 'market', 'greengrocer'].includes(type)) || !p || p.ownerId !== accountId || p.buildingId || p.projectId || !owner || !city.buildingTypes[type] || !['open-air', 'building'].includes(kind) || !Number.isInteger(floors) || floors < 1 || floors > 8 || (type === 'farm' && (!city.economy.crops[crop] || kind !== 'open-air'))) return null;
    width ??= p.width; depth ??= p.depth;
    if ((p.type === 'quarry' && !['quarry','iron_mine'].includes(type)) || (p.type==='farm' && type!=='farm')) return null;
    const terrain = inspectBuildingSite(city, p.x, p.y, width, depth, { plotId, type }); if (terrain.error) return null;
    if (![width, depth].every(Number.isInteger) || width < 1 || depth < 1 || width > p.width || depth > p.depth || (kind==='building' && (width>8 || depth>8))) return null;
    floors = kind === 'open-air' ? 1 : floors;
    const cells = width * depth * floors, stone = kind === 'open-air' ? 0 : cells * DEVELOPMENT_RULES.stonePerCell;
    const builder = selfBuild ? null : this.selectBuilder(accountId, terrain.door, builderId);
    if (builderId && !builder) return null;
    const fee = builder && stone ? cells * this.city.currency.price(DEVELOPMENT_RULES.constructionFeePerCell) : 0;
    const publicFee = accountId === 'treasury' ? Math.ceil(fee * DEVELOPMENT_RULES.municipalMultiplier) : fee;
    if ((city.accounts.get(accountId)?.balance || 0) < stone * city.economy.goods.pedra.price + publicFee + city.currency.price(20000)) return null;
    const project = { id: `project:${this.nextProjectId++}`, accountId, ownerId: owner.id, name: `Obra no terreno ${p.id}`, priority, service: 'building', width, depth, plotId, type, crop, kind, floors, sell, stone, labor: 0, requiredLabor: stone ? cells * DEVELOPMENT_RULES.laborPerCell : 0, builderId: builder?.id || null, fee, active: true, door: terrain.door, status: stone ? 'materials' : 'ready', startedAt: city.minute, cancelled: false };
    initializeInventory(project, city.economy.goods, stone + 48);
    project.feeAccountId = `construction-fee:${project.id}`;
    city.accounts.set(project.feeAccountId, { name: `Caução da obra ${project.id}`, balance: 0 });
    if (accountId === 'treasury' && fee) project.fee = publicFee;
    if (!city.transfer(accountId, project.feeAccountId, project.fee, 'Reserva do serviço de construção')) { city.accounts.delete(project.feeAccountId); return null; }
    this.projects.push(project); p.projectId = project.id;
    city.log(`${owner.entity.properties.name} iniciou ${city.buildingTypes[type].label} no terreno ${p.id}: ${stone} pedras.`, 'construction', [owner.id], { kind: 'project-started', projectId: project.id, plotId });
    if (!stone) this.complete(project);
    return project;
  }
  complete(project) {
    if (project.status === 'completed' || project.cancelled || project.inventory.pedra < project.stone || project.labor < project.requiredLabor) return null;
    if (['lamp', 'road', 'road-repair', 'repair', 'expansion'].includes(project.service)) return this.completeService(project);
    const p = this.plots.find(p => p.id === project.plotId), city = this.city;
    const b = city.addBuilding(project.type, p.x, p.y, { width: project.width ?? p.width, depth: project.depth ?? p.depth, floors: project.floors, plotId: p.id, ownerAccountId: project.accountId, kind: project.kind, materialSource: project });
    if (!b) { project.status = 'blocked'; project.error = city.lastError; return null; }
    p.buildingId = b.id; p.projectId = null; project.status = 'completed'; project.error = null; project.completedAt = city.minute;
    city.transfer(project.feeAccountId, this.city.building(project.builderId)?.accountId || project.accountId, project.fee, 'Serviço de construção');
    const account = city.accounts.get(project.accountId); if (account?.entity?.properties.cityBuilding) account.totalExpenses += project.fee;
    if(project.materialAccountId)city.transfer(project.materialAccountId,b.accountId,city.accounts.get(project.materialAccountId)?.balance||0,'Capital operacional reservado da nova empresa');
    if (['residential', 'popular_housing', 'luxury_housing'].includes(project.type) || project.sell) {
      for (const u of b.units) { u.occupantId = null; u.forSale = project.accountId === 'treasury' || project.sell; u.forRent = project.accountId !== 'treasury' && !project.sell; }
    } else if (project.accountId === 'treasury') city.economy.activateMunicipalBusiness(b, city.currency.price(b.type==='bank'?300000:50000), project.crop);
    else city.economy.activateBusiness(b, this.ownerCitizen(project.accountId), project.crop, false);
    city.history.record('service',`Construção de ${b.entity.properties.name} concluída.`,[project.accountId,city.building(project.builderId)?.accountId,b.accountId],{amount:project.fee,projectId:project.id,stone:project.stone});
    city.workMeals.closeSite(project, b);
    city.log(`${b.entity.properties.name} concluído no terreno ${p.id}.`, 'construction', [project.ownerId], { kind: 'project-completed', buildingId: b.id, plotId: p.id }); return b;
  }
  requestMaterials(project) {
    if (project.cancelled || project.status === 'completed') return;
    let need = project.stone - project.inventory.pedra - (project.incoming.pedra || 0);
    for (const quarry of this.city.economy.businesses.filter(b => b.type === 'quarry' || b.type === 'recycler')) {
      const qty = Math.min(24, need, quarry.inventory.pedra, inventoryFree(project));
      if (qty > 0 && this.city.logistics.order(quarry, project, 'pedra', qty, this.city.economy.goods.pedra.price, {payerAccountId:project.materialAccountId||project.accountId,purpose:project.priority>=100?'critical-infrastructure':project.service==='lamp'?'lamp-construction':'trade'})) need -= qty;
    }
  }
  work(project, c) {
    if (!project || project.cancelled || project.status === 'completed') return false;
    if (project.inventory.pedra < project.stone) return false;
    if (Math.hypot(c.entity.x - project.door.x, c.entity.y - project.door.y) > 2) return false;
    project.status = 'building'; project.labor = Math.min(project.requiredLabor, project.labor + 1 + c.skills.construction / 50);
    if (project.service === 'road' || project.service === 'road-repair') { const tile = project.path[Math.min(project.path.length - 1, Math.floor(project.labor / DEVELOPMENT_RULES.roadLaborPerTile))]; project.door = { ...tile }; }
    this.city.economy.practice(c, 'construction'); this.complete(project); return true;
  }
  projectFor(c, business = null) {
    const eligible = p => !p.cancelled && p.status !== 'completed' && p.inventory.pedra >= p.stone && (p.service !== 'lamp' || !!p.builderId) && ((!p.builderId && (p.accountId===c.accountId || p.accountId==='treasury' && p.ownerId===c.id)) || business?.type==='builder' && (p.builderId===business.id || p.accountId===business.accountId));
    return this.projects.filter(eligible).sort((a,b)=>(b.priority||0)-(a.priority||0)||Number(a.service==='lamp')-Number(b.service==='lamp')||a.startedAt-b.startedAt)[0]||null;
  }
  balanceContracts() {
    const builders=this.city.economy.businesses.filter(b=>b.type==='builder' && (b.workers.length || this.city.economy.citizen(b.ownerId)));
    if(builders.length<2)return;
    const load=new Map(builders.map(b=>[b.id,0]));
    const projects=this.projects.filter(p=>!p.cancelled && p.status!=='completed' && p.builderId);
    for(const p of projects.filter(p=>p.labor>0))load.set(p.builderId,(load.get(p.builderId)||0)+Math.max(0,p.requiredLabor-p.labor));
    for(const p of projects.filter(p=>p.labor===0).sort((a,b)=>(b.priority||0)-(a.priority||0)||a.startedAt-b.startedAt)) {
      const options=builders.filter(b=>b.accountId!==p.accountId && this.city.economy.connected(b,{id:`site:${p.door.x}:${p.door.y}`,door:p.door}));
      options.sort((a,b)=>(load.get(a.id)||0)/Math.max(1,a.workers.length+(a.ownerId?1:0))-(load.get(b.id)||0)/Math.max(1,b.workers.length+(b.ownerId?1:0))||a.id-b.id);
      const next=options[0];if(!next)continue;
      if(p.builderId!==next.id){p.builderId=next.id;this.city.history.record('service',`Contrato ${p.id} atribuído a ${next.entity.properties.name} antes do início do trabalho.`,[p.accountId,next.accountId],{projectId:p.id});}
      load.set(next.id,(load.get(next.id)||0)+p.requiredLabor);
    }
  }
  updateHourly() {
    this.ensurePlots();
    this.updateWear();
    this.planPublicWorks();
    for (const p of [...this.projects].sort((a, b) => (b.priority||0)-(a.priority||0)||Number(a.service === 'lamp') - Number(b.service === 'lamp'))) { this.requestMaterials(p); if (p.status === 'blocked') this.complete(p); }
    // Builders develop housing for sale; individual investors prefer premises for their own firms.
    const homeless = this.city.citizens.filter(c => !c.homeUnitId).length;
    const housingProjects = this.projects.filter(p => p.type === 'residential' && !p.cancelled && p.status !== 'completed');
    const availableHomes = [...this.city.housing.homes.values()].filter(h => this.city.housing.units(h).every(u => !u.tenantId && (u.forSale || u.forRent))).length;
    if (homeless + 3 > availableHomes && !housingProjects.length) {
      const builder = this.city.economy.businesses.find(b => b.type === 'builder');
      const p = this.plots.filter(p => p.ownerId === 'treasury' && p.forSale && !p.buildingId && !p.projectId && p.width<=8 && p.depth<=8 && !['quarry','farm'].includes(p.type)).sort((a, b) => Math.abs(a.width * a.depth - 16) - Math.abs(b.width * b.depth - 16))[0];
      if (builder && p) {
        const owner = this.city.economy.citizen(builder.ownerId);
        if (owner && builder.balance < 50000 && owner.balance > 90000) this.city.transfer(owner.accountId, builder.accountId, 70000, 'Aporte para empreendimento imobiliário');
        if (builder.balance > p.price + 40000 && this.buyPlot(builder.accountId, p.id)) this.beginProject(builder.accountId, p.id, 'residential', { floors: 3, sell: true });
      }
    }
  }
  reconcile() {
    this.city.economy.appointMayor();
    for (const p of this.plots) if (p.buildingId && !this.city.building(p.buildingId)) { p.buildingId = null; p.forSale = true; }
    for (const project of this.projects) if (project.builderId && !this.city.building(project.builderId) && project.status !== 'completed' && !project.cancelled) { project.builderId = null; this.city.transfer(project.feeAccountId, project.accountId, this.city.accounts.get(project.feeAccountId)?.balance || 0, 'Estorno de contrato de construtora encerrada'); project.fee = 0; }
    for (const project of this.projects) if ((project.accountId === 'treasury' || this.city.accounts.get(project.accountId)?.municipal) && this.clientCitizen(project.accountId)) project.ownerId = this.clientCitizen(project.accountId).id;
    for (const p of this.projects) if (!p.cancelled && p.status !== 'completed' && ((p.service === 'expansion' && !this.city.building(p.buildingId)) || !this.clientCitizen(p.accountId) || (p.accountId !== 'treasury' && !this.city.society.citizen(p.ownerId)))) {
      this.city.transfer(p.feeAccountId, 'treasury', this.city.accounts.get(p.feeAccountId)?.balance || 0, 'Estorno de obra cancelada');
      p.cancelled = true; p.active = false; p.status = 'cancelled';
      if(p.materialAccountId){for(const shipment of this.city.logistics.shipments)if(shipment.buyer===p && !['delivered','cancelled'].includes(shipment.status))this.city.logistics.cancel(shipment);this.city.transfer(p.materialAccountId,this.city.accounts.has(p.accountId)?p.accountId:'treasury',this.city.accounts.get(p.materialAccountId)?.balance||0,'Estorno de capital de empreendimento cancelado');}
      const lot = this.plots.find(l => l.id === p.plotId); if (lot) { lot.projectId = null; if (p.service !== 'expansion') { lot.ownerId = 'treasury'; lot.forSale = true; } }
      const hall = this.city.buildings.find(b => b.type === 'townhall');
      for (const [good, qty] of Object.entries(p.inventory)) { const stored = Math.min(qty, hall ? inventoryFree(hall) : 0); if (hall) hall.inventory[good] += stored; this.city.economy.lost[good] += qty - stored; p.inventory[good] = 0; }
    }
    for (const lot of this.plots) if (lot.ownerId !== 'treasury' && !this.ownerCitizen(lot.ownerId)) { lot.ownerId = 'treasury'; lot.forSale = true; lot.forRent = false; }
  }
}
