export const HOUSING_RULES = { roomPrice: 120000, roomRent: 350, livingReserve: 3000, defaultDays: 3, unsoldRentalAfter: 1440 };

/** Only facade cells can be owned. Interior cells are common circulation. */
export function floorCells(b, z) {
  const cells = [];
  if (b.constructionKind === 'open-air') { for (let y = 0; y < b.depth; y++) for (let x = 0; x < b.width; x++) cells.push({ x, y, z }); return cells; }
  for (let x = 0; x < b.width; x++) cells.push({ x, y: 0, z });
  for (let y = 1; y < b.depth; y++) cells.push({ x: b.width - 1, y, z });
  if (b.depth > 1) for (let x = b.width - 2; x >= 0; x--) cells.push({ x, y: b.depth - 1, z });
  if (b.width > 1) for (let y = b.depth - 2; y > 0; y--) cells.push({ x: 0, y, z });
  return cells;
}
export class CityHousing {
  constructor(city) { this.city = city; this.homes = new Map(); }
  addFloor(b, z, ownerId) {
    const spec = this.city.buildingTypes[b.type], units = [];
    const housingType = ['residential', 'popular_housing', 'luxury_housing'].includes(b.type);
    for (const { x, y } of floorCells(b, z)) {
      const u = { id: `${b.id}:${x}:${y}:${z}`, buildingId: b.id, x, y, z, width: 1, depth: 1, roomType: housingType ? 'bedroom' : 'workspace', homeId: null, ownerId, tenantId: null, occupantId: b.active ? b.accountId : null, rent: this.city.currency.price(housingType ? HOUSING_RULES.roomRent * (b.type === 'luxury_housing' ? 2 : 1) : spec.rent), price: this.city.currency.price(housingType ? HOUSING_RULES.roomPrice * (b.type === 'luxury_housing' ? 3 : 1) : spec.price), forSale: ownerId === 'treasury', forRent: false, arrears: 0, missedDays: 0 };
      b.units.push(u); this.city.units.set(u.id, u); units.push(u);
    }
    if (b.constructionKind !== 'open-air') for (let y = 1; y < b.depth - 1; y++) for (let x = 1; x < b.width - 1; x++) (b.circulation ??= []).push({ x, y, z });
    if (housingType) for (let i = 0; i < units.length; i += (b.type === 'luxury_housing' ? 4 : 2)) {
      const rooms = units.slice(i, i + (b.type === 'luxury_housing' ? 4 : 2)), id = `home:${rooms[0].id}`;
      if (rooms[1]) rooms[1].roomType = 'bathroom';
      if (b.type === 'luxury_housing' && rooms[2]) rooms[2].roomType = 'dining';
      const home = { id, buildingId: b.id, unitIds: rooms.map(u => u.id), createdAt: this.city.minute };
      for (const u of rooms) u.homeId = id;
      this.homes.set(id, home);
    }
    return units;
  }
  units(home) { return home.unitIds.map(id => this.city.units.get(id)).filter(Boolean); }
  home(c) { return this.homes.get(c.homeId); }
  hasDining(home) { return this.units(home).some(u => u.roomType === 'dining'); }
  residents(home) { return this.city.citizens.filter(c => !c.entity.destroyed && c.homeId === home.id); }
  hasBathroom(home) { return this.units(home).some(u => u.roomType === 'bathroom'); }
  price(home) { return this.units(home).reduce((n, u) => n + u.price, 0); }
  rent(home, citizen = null) { return this.units(home).reduce((n, u) => n + (citizen && u.ownerId === citizen.accountId ? 0 : u.rent), 0); }
  release(c) {
    const home = this.home(c), units = home ? this.units(home) : [this.city.units.get(c.homeUnitId)].filter(Boolean);
    for (const u of units) if (u.tenantId === c.accountId) { u.tenantId = null; u.rentPayerId = null; u.arrears = 0; u.missedDays = 0; }
    c.homeUnitId = null; c.homeId = null; c.homeShareWith = null;
    if (home) for (const resident of this.city.citizens.filter(p => p.homeId === home.id && (p.guardianId === c.id || p.homeShareWith === c.id))) { resident.homeId = null; resident.homeUnitId = null; resident.homeShareWith = null; }
  }
  rentHome(c, home) {
    const units = this.units(home), payer = this.city.payerFor(c), rent = this.rent(home, c);
    if (!units.length || !units.some(u => u.roomType === 'bedroom') || units.some(u => u.ownerId !== c.accountId && (!u.forRent || u.ownerId === 'treasury')) || units.some(u => u.tenantId && u.tenantId !== c.accountId) || (this.city.accounts.get(payer)?.balance || 0) < rent) return false;
    if (c.homeId === home.id) return true;
    this.release(c);
    for (const u of units) {
      if (u.ownerId !== c.accountId) this.city.transfer(payer, u.ownerId, u.rent, 'Primeiro aluguel');
      u.tenantId = c.accountId; u.rentPayerId = payer === c.accountId ? null : payer; u.arrears = 0; u.missedDays = 0;
    }
    c.homeId = home.id; c.homeUnitId = units.find(u => u.roomType === 'bedroom').id; c.task = null; c.path = [];
    this.city.log(`${c.entity.properties.name} passou a morar em ${home.id}, com ${units.length} cômodos.`, 'housing', [c.id], { kind: 'home-lease', homeId: home.id, rent });
    for (const child of this.city.citizens.filter(p => p.guardianId === c.id && !this.city.society.isAdult(p))) this.houseChild(child, c);
    return true;
  }
  buyHome(c, home) {
    const units = this.units(home), total = this.price(home);
    if (!units.length || units.some(u => !u.forSale || u.ownerId === c.accountId) || c.balance < total + this.city.currency.price(HOUSING_RULES.livingReserve)) return false;
    for (const u of units) if (!this.city.buyUnit(c.id, u.id)) throw Error('Compra de moradia mudou durante transação síncrona.');
    return true;
  }
  houseChild(child, parent) {
    const home = this.home(parent); if (!home) return false;
    if (child.homeUnitId && child.homeUnitId !== parent.homeUnitId) this.release(child);
    child.guardianId = parent.id; child.homeId = home.id; child.homeUnitId = parent.homeUnitId; return true;
  }
  market() {
    for (const home of this.homes.values()) {
      const units = this.units(home), b = this.city.building(home.buildingId); if (!b || !units.length) continue;
      const builder = this.city.accounts.get(units[0].ownerId);
      if (builder?.type === 'builder' && units.every(u => u.ownerId === builder.accountId) && this.city.minute - home.createdAt >= HOUSING_RULES.unsoldRentalAfter) for (const u of units) { u.forSale = true; u.forRent = true; }
    }
  }
  assign() {
    this.market();
    for (const c of this.city.citizens) {
      if (c.entity.destroyed) continue;
      if (!this.city.society.isAdult(c)) { const parent = this.city.society.guardian(c); if (parent) this.houseChild(c, parent); continue; }
      const partner = this.city.society.citizen(c.partnerId), partnerHome = partner && this.home(partner);
      if (partner && partner.id < c.id && partnerHome && c.homeId !== partnerHome.id) { this.release(c); c.homeShareWith = partner.id; c.homeId = partnerHome.id; c.homeUnitId = partner.homeUnitId; for (const child of this.city.citizens.filter(p => p.guardianId === c.id)) this.houseChild(child, c); }
      if (c.homeShareWith && (!partner || c.homeShareWith !== partner.id)) { this.release(c); c.homeShareWith = null; }
      const current = this.home(c);
      if (current && this.hasBathroom(current)) continue;
      const candidates = [...this.homes.values()].filter(h => this.city.building(h.buildingId) && this.units(h).every(u => !u.tenantId || u.tenantId === c.accountId));
      candidates.sort((a, b) => Number(this.hasBathroom(b)) - Number(this.hasBathroom(a)) || this.rent(a, c) - this.rent(b, c));
      for (const h of candidates) {
        if (current && !this.hasBathroom(h)) continue;
        const units = this.units(h), owned = units.every(u => u.ownerId === c.accountId);
        if (owned && this.rentHome(c, h)) break;
        if (this.price(h) + this.city.currency.price(HOUSING_RULES.livingReserve) <= c.balance && this.buyHome(c, h) && this.rentHome(c, h)) break;
        // Keep money for the next meals; a lease must be sustainable beyond its first payment.
        if (this.rent(h, c) + Math.min(1500, c.balance * .25) <= c.balance && this.rentHome(c, h)) break;
      }
    }
  }
  invest(initial = false) {
    const investors = this.city.citizens.filter(c => this.city.society.isAdult(c));
    for (const c of investors) {
      if (!c.homeUnitId) {
        const home = [...this.homes.values()].find(h => this.units(h).every(u => u.forSale && !u.tenantId && u.ownerId !== c.accountId) && this.price(h) + 60000 < c.balance);
        if (home && this.buyHome(c, home)) this.rentHome(c, home);
      }
      const demand = this.city.citizens.some(p => !p.homeUnitId && this.city.society.isAdult(p)); if (!demand) continue;
      for (const home of this.homes.values()) if (this.units(home).every(u => u.forSale && !u.tenantId && u.ownerId !== c.accountId) && this.price(home) + (initial ? 140000 : 65000) < c.balance && this.buyHome(c, home)) {
        for (const u of this.units(home)) { u.forRent = true; u.forSale = false; }
      }
    }
  }
  collectRent() {
    const handled = new Set();
    for (const u of this.city.units.values()) {
      if (!u.tenantId || u.ownerId === 'treasury' || u.ownerId === u.tenantId || u.ownerId === u.rentPayerId) continue;
      const c = this.city.accounts.get(u.tenantId), home = this.home(c || {});
      if (!home) { this.collectSingle(u); continue; }
      if (handled.has(home.id)) continue; handled.add(home.id);
      const units = this.units(home).filter(r => r.tenantId === c.accountId && r.ownerId !== c.accountId && r.ownerId !== (r.rentPayerId || c.accountId));
      const payer = units[0]?.rentPayerId || c.accountId, due = units.reduce((n, r) => n + r.rent + r.arrears, 0);
      if ((this.city.accounts.get(payer)?.balance || 0) >= due) for (const r of units) { this.city.transfer(payer, r.ownerId, r.rent + r.arrears, 'Aluguel diário'); r.arrears = 0; r.missedDays = 0; }
      else {
        for (const r of units) { r.arrears += r.rent; r.missedDays++; }
        if (units.some(r => r.missedDays >= HOUSING_RULES.defaultDays)) {
          this.city.log(`${c.entity.properties.name} perdeu a moradia por falta de pagamento e está na rua.`, 'housing', [c.id], { kind: 'eviction', homeId: home.id }); this.release(c);
        }
      }
    }
  }
  collectSingle(u) {
    const payer = u.rentPayerId || u.tenantId;
    if (this.city.transfer(payer, u.ownerId, u.rent + u.arrears, 'Aluguel diário')) { u.arrears = 0; u.missedDays = 0; }
    else { u.arrears += u.rent; u.missedDays++; if (u.missedDays >= HOUSING_RULES.defaultDays) { const c = this.city.accounts.get(u.tenantId); if (c) this.release(c); } }
  }
  reconcile() { for (const [id, h] of this.homes) if (!this.city.building(h.buildingId)) this.homes.delete(id); }
}
