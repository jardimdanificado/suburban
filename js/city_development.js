import { inspectBuildingSite, findTerrainPath } from './city_terrain.js';
import { initializeInventory, inventoryFree } from './city_inventory.js';

export const DEVELOPMENT_RULES = { landPerCell: 180, stonePerCell: 2, laborPerCell: 3, constructionFeePerCell: 120 };
export class CityDevelopment {
  constructor(city) { this.city = city; this.plots = []; this.projects = []; this.nextPlotId = 1; this.nextProjectId = 1; }
  ownerCitizen(accountId) {
    const account = this.city.accounts.get(accountId);
    if (account?.entity?.destroyed) return null;
    return account?.entity?.properties.citizen ? this.city.society.citizen(account.id) : this.city.economy.citizen(account?.ownerId);
  }
  attachBuilding(b, ownerId = 'treasury') {
    const lot = { id: this.nextPlotId++, x: b.entity.x, y: b.entity.y, width: b.width, depth: b.depth, door: { ...b.door }, ownerId, price: b.width * b.depth * DEVELOPMENT_RULES.landPerCell, forSale: false, forRent: false, rent: 0, buildingId: b.id, projectId: null };
    this.plots.push(lot); b.plotId = lot.id; return lot;
  }
  overlaps(x, y, width, depth, exceptId = null) {
    return this.plots.some(p => p.id !== exceptId && x - 1 < p.x + p.width && x + width + 1 > p.x && y - 1 < p.y + p.depth && y + depth + 1 > p.y);
  }
  createPlot(x, y, width = 4, depth = 4) {
    if (![x, y, width, depth].every(Number.isInteger) || width < 2 || depth < 2 || width > 8 || depth > 8 || this.overlaps(x, y, width, depth)) return null;
    const terrain = inspectBuildingSite(this.city, x, y, width, depth);
    if (terrain.error) return null;
    const hall = this.city.buildings[0];
    if (hall && findTerrainPath(this.city.world, terrain.door, hall.door, this.city.occupied, { extraBlocked: (xx, yy) => (xx >= x && xx < x + width && yy >= y && yy < y + depth) || this.plots.some(p => xx >= p.x && xx < p.x + p.width && yy >= p.y && yy < p.y + p.depth) }) === null) return null;
    const p = { id: this.nextPlotId++, x, y, width, depth, door: terrain.door, ownerId: 'treasury', price: width * depth * DEVELOPMENT_RULES.landPerCell, forSale: true, forRent: false, rent: 0, buildingId: null, projectId: null };
    this.plots.push(p); return p;
  }
  ensurePlots(count = 18) {
    if (this.plots.filter(p => !p.buildingId && !p.projectId && p.ownerId === 'treasury').length >= count) return;
    for (const site of this.city.economy.locateBuilding('farm')) {
      this.createPlot(site.x, site.y, 4, 4);
      if (this.plots.filter(p => !p.buildingId && !p.projectId && p.ownerId === 'treasury').length >= count) break;
    }
  }
  buyPlot(accountId, plotId) {
    const p = this.plots.find(p => p.id === plotId), a = this.city.accounts.get(accountId);
    if (!p || !a || !p.forSale || p.ownerId === accountId || p.projectId || (!a.entity?.properties.citizen && a.type !== 'builder')) return this.city.fail('Terreno indisponível para compra.');
    if (!this.city.transfer(accountId, p.ownerId, p.price, 'Compra de terreno')) return this.city.fail('Saldo insuficiente para comprar o terreno.');
    p.ownerId = accountId; p.forSale = p.forRent = false;
    this.city.log(`${this.city.accountName(accountId)} comprou o terreno ${p.id}.`, 'land', this.ownerCitizen(accountId) ? [this.ownerCitizen(accountId).id] : [], { kind: 'land-purchase', plotId }); return p;
  }
  listPlot(accountId, plotId, { price, rent = 0, forSale = false, forRent = false }) {
    const p = this.plots.find(p => p.id === plotId);
    if (!p || p.ownerId !== accountId || p.projectId || !Number.isSafeInteger(price) || price < 1 || !Number.isSafeInteger(rent) || rent < 0) return false;
    Object.assign(p, { price, rent, forSale: p.ownerId === 'treasury' || !!forSale, forRent: p.ownerId !== 'treasury' && !!forRent }); return true;
  }
  beginProject(accountId, plotId, type, { kind = type === 'farm' || type === 'quarry' ? 'open-air' : 'building', floors = type === 'residential' ? 3 : 1, crop = null, sell = false } = {}) {
    const city = this.city, p = this.plots.find(p => p.id === plotId), owner = this.ownerCitizen(accountId);
    if ((kind === 'open-air' && !['farm', 'quarry', 'leisure', 'market', 'greengrocer'].includes(type)) || !p || p.ownerId !== accountId || p.buildingId || p.projectId || !owner || !city.buildingTypes[type] || !['open-air', 'building'].includes(kind) || !Number.isInteger(floors) || floors < 1 || floors > 8 || (type === 'farm' && (!city.economy.crops[crop] || kind !== 'open-air'))) return null;
    const terrain = inspectBuildingSite(city, p.x, p.y, p.width, p.depth, { plotId }); if (terrain.error) return null;
    floors = kind === 'open-air' ? 1 : floors;
    const cells = p.width * p.depth * floors, stone = kind === 'open-air' ? 0 : cells * DEVELOPMENT_RULES.stonePerCell;
    const builder = city.economy.businesses.find(b => b.type === 'builder' && b.accountId !== accountId && city.economy.connected(b, { id: `lot${p.id}`, door: p.door }));
    const fee = builder && stone ? cells * DEVELOPMENT_RULES.constructionFeePerCell : 0;
    if ((city.accounts.get(accountId)?.balance || 0) < stone * city.economy.goods.pedra.price + fee + 20000) return null;
    const project = { id: `project:${this.nextProjectId++}`, accountId, ownerId: owner.id, name: `Obra no terreno ${p.id}`, plotId, type, crop, kind, floors, sell, stone, labor: 0, requiredLabor: stone ? cells * DEVELOPMENT_RULES.laborPerCell : 0, builderId: builder?.id || null, fee, active: true, door: p.door, status: stone ? 'materials' : 'ready', startedAt: city.minute, cancelled: false };
    initializeInventory(project, city.economy.goods, stone + 48);
    project.feeAccountId = `construction-fee:${project.id}`;
    city.accounts.set(project.feeAccountId, { name: `Caução da obra ${project.id}`, balance: 0 });
    city.transfer(accountId, project.feeAccountId, fee, 'Reserva do serviço de construção');
    this.projects.push(project); p.projectId = project.id;
    city.log(`${owner.entity.properties.name} iniciou ${city.buildingTypes[type].label} no terreno ${p.id}: ${stone} pedras.`, 'construction', [owner.id], { kind: 'project-started', projectId: project.id, plotId });
    if (!stone) this.complete(project);
    return project;
  }
  complete(project) {
    if (project.status === 'completed' || project.cancelled || project.inventory.pedra < project.stone || project.labor < project.requiredLabor) return null;
    const p = this.plots.find(p => p.id === project.plotId), city = this.city;
    const b = city.addBuilding(project.type, p.x, p.y, { width: p.width, depth: p.depth, floors: project.floors, plotId: p.id, ownerAccountId: project.accountId, kind: project.kind, materialSource: project });
    if (!b) { project.status = 'blocked'; project.error = city.lastError; return null; }
    p.buildingId = b.id; p.projectId = null; project.status = 'completed'; project.error = null; project.completedAt = city.minute;
    city.transfer(project.feeAccountId, this.city.building(project.builderId)?.accountId || project.accountId, project.fee, 'Serviço de construção');
    const account = city.accounts.get(project.accountId); if (account?.entity?.properties.cityBuilding) account.totalExpenses += project.fee;
    if (project.type === 'residential' || project.sell) {
      for (const u of b.units) { u.occupantId = null; u.forSale = project.sell; u.forRent = !project.sell; }
    } else city.economy.activateBusiness(b, this.ownerCitizen(project.accountId), project.crop, false);
    city.log(`${b.entity.properties.name} concluído no terreno ${p.id}.`, 'construction', [project.ownerId], { kind: 'project-completed', buildingId: b.id, plotId: p.id }); return b;
  }
  requestMaterials(project) {
    if (project.cancelled || project.status === 'completed') return;
    let need = project.stone - project.inventory.pedra - (project.incoming.pedra || 0);
    for (const quarry of this.city.economy.businesses.filter(b => b.type === 'quarry')) {
      const qty = Math.min(24, need, quarry.inventory.pedra, inventoryFree(project));
      if (qty > 0 && this.city.logistics.order(quarry, project, 'pedra', qty, this.city.economy.goods.pedra.price)) need -= qty;
    }
  }
  work(project, c) {
    if (!project || project.cancelled || project.status === 'completed') return false;
    if (project.inventory.pedra < project.stone) return false;
    if (Math.hypot(c.entity.x - project.door.x, c.entity.y - project.door.y) > 2) return false;
    project.status = 'building'; project.labor = Math.min(project.requiredLabor, project.labor + 1 + c.skills.construction / 50);
    this.city.economy.practice(c, 'construction'); this.complete(project); return true;
  }
  projectFor(c, business = null) {
    return this.projects.find(p => !p.cancelled && p.status !== 'completed' && p.inventory.pedra >= p.stone && (business?.type === 'builder' ? p.builderId === business.id || p.accountId === business.accountId : p.accountId === c.accountId && !p.builderId));
  }
  updateHourly() {
    this.ensurePlots();
    for (const p of this.projects) { this.requestMaterials(p); if (p.status === 'blocked') this.complete(p); }
    // Builders develop housing for sale; individual investors prefer premises for their own firms.
    const homeless = this.city.citizens.filter(c => !c.homeUnitId).length;
    const housingProjects = this.projects.filter(p => p.type === 'residential' && !p.cancelled && p.status !== 'completed');
    const availableHomes = [...this.city.units.values()].filter(u => this.city.building(u.buildingId)?.type === 'residential' && !u.tenantId && (u.forSale || u.forRent)).length;
    if (homeless + 3 > availableHomes && !housingProjects.length) {
      const builder = this.city.economy.businesses.find(b => b.type === 'builder');
      const p = this.plots.find(p => p.ownerId === 'treasury' && p.forSale && !p.buildingId && !p.projectId);
      if (builder && p) {
        const owner = this.city.economy.citizen(builder.ownerId);
        if (owner && builder.balance < 50000 && owner.balance > 90000) this.city.transfer(owner.accountId, builder.accountId, 70000, 'Aporte para empreendimento imobiliário');
        if (builder.balance > p.price + 40000 && this.buyPlot(builder.accountId, p.id)) this.beginProject(builder.accountId, p.id, 'residential', { floors: 3, sell: true });
      }
    }
  }
  reconcile() {
    for (const p of this.plots) if (p.buildingId && !this.city.building(p.buildingId)) { p.buildingId = null; p.forSale = true; }
    for (const project of this.projects) if (project.builderId && !this.city.building(project.builderId) && project.status !== 'completed' && !project.cancelled) { project.builderId = null; this.city.transfer(project.feeAccountId, project.accountId, this.city.accounts.get(project.feeAccountId)?.balance || 0, 'Estorno de contrato de construtora encerrada'); project.fee = 0; }
    for (const p of this.projects) if (!p.cancelled && p.status !== 'completed' && (!this.ownerCitizen(p.accountId) || !this.city.society.citizen(p.ownerId))) {
      this.city.transfer(p.feeAccountId, 'treasury', this.city.accounts.get(p.feeAccountId)?.balance || 0, 'Estorno de obra cancelada');
      p.cancelled = true; p.active = false; p.status = 'cancelled';
      const lot = this.plots.find(l => l.id === p.plotId); lot.projectId = null; lot.ownerId = 'treasury'; lot.forSale = true;
      const hall = this.city.buildings.find(b => b.type === 'townhall');
      for (const [good, qty] of Object.entries(p.inventory)) { const stored = Math.min(qty, hall ? inventoryFree(hall) : 0); if (hall) hall.inventory[good] += stored; this.city.economy.lost[good] += qty - stored; p.inventory[good] = 0; }
    }
    for (const lot of this.plots) if (lot.ownerId !== 'treasury' && !this.ownerCitizen(lot.ownerId)) { lot.ownerId = 'treasury'; lot.forSale = true; lot.forRent = false; }
  }
}
