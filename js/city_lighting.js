import { ROAD_TILES, tileAt, terrainWalkable, canStep } from './city_terrain.js';
import { initializeInventory, inventoryFree } from './city_inventory.js';
export const LIGHTING_RULES = { roadSpacing: 10, privateSpacing: 3, stone: 2, labor: 20, installationFee: 8000, maxActiveSites: 2 };
export class CityLighting {
  constructor(city) { this.city = city; this.posts = []; this.propertyStores = new Map(); this.roadPosts = new Map(); this.sites = new Map(); }
  freeSite(x, y, building = null) {
    const city = this.city;
    if (!terrainWalkable(city.world, x, y) || ROAD_TILES.has(tileAt(city.world, x, y)) || city.occupied.has(`${x},${y}`)) return false;
    if (city.development.plots.some(p => Math.floor(p.door.x) === x && Math.floor(p.door.y) === y)) return false;
    if (city.development.projects.some(p => !p.cancelled && p.status !== 'completed' && Math.floor(p.door.x) === x && Math.floor(p.door.y) === y)) return false;
    if (city.development.plots.some(p => p.id !== building?.plotId && x >= p.x && x < p.x + p.width && y >= p.y && y < p.y + p.depth)) return false;
    if (city.buildings.some(b => !b.entity.destroyed && (x >= b.entity.x && x < b.entity.x + b.width && y >= b.entity.y && y < b.entity.y + b.depth || b.accessPath?.some(p => Math.floor(p.x) === x && Math.floor(p.y) === y)))) return false;
    if (city.development.projects.some(p => !p.cancelled && p.status !== 'completed' && p.route?.some(t => Math.floor(t.x) === x && Math.floor(t.y) === y))) return false;
    return !city.citizens.some(c => !c.entity.destroyed && Math.floor(c.entity.x) === x && Math.floor(c.entity.y) === y);
  }
  findSite(point, building = null) {
    const x = Math.floor(point.x), y = Math.floor(point.y);
    const radius = building ? 4 : 1;
    for (let r = 1; r <= radius; r++) for (const [dx, dy] of [[r,0],[-r,0],[0,r],[0,-r]]) {
      const xx = x + dx, yy = y + dy;
      if (!this.freeSite(xx, yy, building)) continue;
      const street = [[xx + 1, yy], [xx - 1, yy], [xx, yy + 1], [xx, yy - 1]].find(([sx, sy]) => ROAD_TILES.has(tileAt(this.city.world, sx, sy)) && canStep(this.city.world, sx, sy, xx, yy));
      if (street) return { x: xx + .5, y: yy + .5, door: { x: street[0] + .5, y: street[1] + .5 } };
    }
    return null;
  }
  plan(post) {
    if (this.sites.has(post.id) && this.sites.get(post.id).status !== 'cancelled') return this.sites.get(post.id);
    const spacing = post.public ? LIGHTING_RULES.roadSpacing : LIGHTING_RULES.privateSpacing;
    if ([...this.sites.values()].some(p => p.status !== 'cancelled' && Math.hypot(p.x - post.x, p.y - post.y) < (post.public && p.public ? spacing : LIGHTING_RULES.privateSpacing))) return null;
    post.status = 'planned'; post.built = false;
    this.sites.set(post.id, post); return post;
  }
  reserve(post) {
    const city = this.city;
    if (post.projectId || post.built || post.status === 'cancelled') return;
    const pending = city.development.projects.filter(p => p.service === 'lamp' && !p.cancelled && p.status !== 'completed');
    if (pending.length >= LIGHTING_RULES.maxActiveSites || pending.some(p => this.sites.get(p.lampId)?.public === post.public) || !this.freeSite(Math.floor(post.x), Math.floor(post.y), city.building(post.buildingId))) return;
    const builder = city.development.selectBuilder(post.payerId, post.door);
    const fee = city.currency.price(LIGHTING_RULES.installationFee);
    const budget = Math.ceil(fee * (post.payerId === 'treasury' ? 1.5 : 1)) + LIGHTING_RULES.stone * city.economy.goods.pedra.price;
    if (!builder || (city.accounts.get(post.payerId)?.balance || 0) < budget) return;
    if (city.development.projects.filter(p => p.builderId === builder.id && p.service !== 'lamp' && !p.cancelled && p.status !== 'completed').length >= 2) return;
    const project = city.development.registerService(post.payerId, builder, { service: 'lamp', type: 'lamp', name: post.public ? 'Instalação de poste público' : 'Instalação de iluminação do imóvel', lampId: post.id, door: { ...post.door }, stone: LIGHTING_RULES.stone, requiredLabor: LIGHTING_RULES.labor, fee });
    if (!project) return;
    post.projectId = project.id; post.status = 'materials';
    city.occupied.add(`${Math.floor(post.x)},${Math.floor(post.y)}`);
  }
  completePost(project) {
    const post = this.sites.get(project.lampId);
    if (!post || post.status === 'cancelled' || !terrainWalkable(this.city.world, Math.floor(post.x), Math.floor(post.y)) || ROAD_TILES.has(tileAt(this.city.world, Math.floor(post.x), Math.floor(post.y)))) return null;
    post.status = 'completed'; post.built = true; post.builtAt = this.city.minute;
    if (!this.posts.includes(post)) this.posts.push(post);
    this.city.world.cityLampPosts = this.posts;
    return post;
  }
  cancelPost(post) {
    if (post.status === 'cancelled') return;
    const city = this.city, project = city.development.projects.find(p => p.id === post.projectId);
    if (project && project.status !== 'completed') {
      project.cancelled = true; project.active = false; project.status = 'cancelled';
      for (const s of city.logistics.shipments) if (s.buyer === project && !['delivered','cancelled'].includes(s.status)) city.logistics.cancel(s);
      city.transfer(project.feeAccountId, city.accounts.has(post.payerId) ? post.payerId : 'treasury', city.accounts.get(project.feeAccountId)?.balance || 0, 'Estorno de instalação de poste');
      const hall = city.buildings.find(b => b.type === 'townhall' && !b.entity.destroyed);
      for (const [good, quantity] of Object.entries(project.inventory)) {
        const stored = Math.min(quantity, hall ? inventoryFree(hall) : 0);
        if (hall) hall.inventory[good] += stored;
        city.economy.lost[good] += quantity - stored; project.inventory[good] = 0;
      }
    }
    if (post.projectId) city.occupied.delete(`${Math.floor(post.x)},${Math.floor(post.y)}`);
    post.status = 'cancelled'; post.built = false; post.lit = false;
  }
  reconcile() {
    for (const post of this.sites.values()) {
      if (post.status === 'cancelled') continue;
      const b = this.city.building(post.buildingId);
      const project = this.city.development.projects.find(p => p.id === post.projectId);
      if ((!post.projectId && this.city.occupied.has(`${Math.floor(post.x)},${Math.floor(post.y)}`)) || (!post.public && (!b || !b.units.some(u => u.ownerId === post.payerId))) || (project && !post.built && (project.cancelled || !project.builderId)) || !terrainWalkable(this.city.world, Math.floor(post.x), Math.floor(post.y)) || ROAD_TILES.has(tileAt(this.city.world, Math.floor(post.x), Math.floor(post.y)))) this.cancelPost(post);
    }
    this.posts = this.posts.filter(p => p.built && p.status !== 'cancelled');
    this.city.world.cityLampPosts = this.posts;
  }
  hourly() {
    const city = this.city, buildings = city.buildings.filter(b => !b.entity.destroyed);
    const utility = buildings.find(b => b.type === 'utility') || buildings.find(b => b.type === 'townhall');
    if (!utility) return;
    this.reconcile();
    const night = city.hour < 6 || city.hour >= 18, groups = new Map(), posts = [];
    const register = (holder, payer, post) => {
      if (!post.built) return;
      const key = `${holder.id}:${payer}`;
      if (!groups.has(key)) groups.set(key, { holder, payer, posts: [] });
      groups.get(key).posts.push(post); posts.push(post);
    };
    for (const b of buildings) {
      // Road lamps belong to the city, independently of the neighbouring owner.
      for (const point of b.accessPath || []) {
        if (!ROAD_TILES.has(tileAt(city.world, Math.floor(point.x), Math.floor(point.y)))) continue;
        if ([...this.roadPosts.values()].some(p => p.status !== 'cancelled' && Math.hypot(p.door.x - point.x, p.door.y - point.y) < LIGHTING_RULES.roadSpacing)) continue;
        const site = this.findSite(point); if (!site) continue;
        const id = `road:${Math.floor(site.x)}:${Math.floor(site.y)}`;
        const post = this.plan({ id, ...site, fuel: 0, lit: false, public: true, payerId: 'treasury' });
        if (post) this.roadPosts.set(id, post);
      }
      const owners = new Map();
      for (const unit of b.units) if (unit.ownerId && !owners.has(unit.ownerId)) owners.set(unit.ownerId, unit);
      for (const owner of owners.keys()) {
        const id = `property:${b.id}:${owner}`;
        let holder = this.propertyStores.get(id);
        if (!holder || holder.post.status === 'cancelled') {
          const site = this.findSite(b.door, b); if (!site) continue;
          const post = this.plan({ id, buildingId: b.id, ...site, fuel: 0, lit: false, public: false, payerId: owner });
          if (!post) continue;
          holder = { id, type: 'property-lighting', active: true, entity: b.entity, accountId: owner, ownerId: city.development.ownerCitizen(owner)?.id, door: b.door, post };
          const previous = this.propertyStores.get(id);
          initializeInventory(holder, city.economy.goods, 24);
          if (previous) holder.inventory = previous.inventory;
          this.propertyStores.set(id, holder);
        }
        holder.active = true; register(holder, owner, holder.post);
      }
    }
    for (const [id, post] of this.roadPosts) {
      if (!ROAD_TILES.has(tileAt(city.world, Math.floor(post.door.x), Math.floor(post.door.y)))) { this.cancelPost(post); this.roadPosts.delete(id); continue; }
      register(utility, 'treasury', post);
    }
    for (const [id, holder] of this.propertyStores) {
      const b = city.building(holder.post.buildingId);
      if (b && b.units.some(u => u.ownerId === holder.post.payerId)) continue;
      for (const shipment of city.logistics.shipments) if (shipment.buyer === holder && !['cancelled', 'delivered'].includes(shipment.status)) city.logistics.cancel(shipment);
      // Retired property fuel remains in its depot for exact stock accounting.
      holder.active = false; this.cancelPost(holder.post);
    }
    const mills = city.economy.businesses.filter(b => b.type === 'mill' && b.inventory.oleo > 0);
    for (const { holder, payer, posts: lamps } of groups.values()) {
      for (const post of lamps) {
        if (night && post.fuel <= 0 && holder.inventory.oleo > 0) {
          holder.inventory.oleo--; post.fuel = 12; city.economy.consumed.oleo++;
          city.economy.recordGoods('lighting-fuel', 'oleo', 1, holder.id, post.id);
        }
        post.lit = night && post.fuel > 0;
        if (post.lit) post.fuel--;
      }
      let need = Math.min(12, inventoryFree(holder), Math.max(0, lamps.length - holder.inventory.oleo - (holder.incoming.oleo || 0)));
      const unitPrice = Math.ceil(city.economy.goods.oleo.price * (payer === 'treasury' ? 1.5 : 1));
      need = Math.min(need, Math.floor((city.accounts.get(payer)?.balance || 0) / unitPrice));
      for (const mill of mills) {
        const quantity = Math.min(need, mill.inventory.oleo);
        if (quantity > 0 && city.logistics.order(mill, holder, 'oleo', quantity, unitPrice, { payerAccountId: payer, purpose: payer === 'treasury' ? 'public-lighting' : 'property-lighting' })) break;
      }
    }
    // Only contracted sites reserve land; at most two installations run concurrently.
    for (const post of this.sites.values()) this.reserve(post);
    this.posts = posts; city.world.cityLampPosts = posts;
    city.world.cityLampSites = [...this.sites.values()].filter(p => p.projectId && !p.built && p.status !== 'cancelled');
  }
}
