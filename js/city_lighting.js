import { ROAD_TILES, tileAt } from './city_terrain.js';
import { initializeInventory, inventoryFree } from './city_inventory.js';
export class CityLighting {
  constructor(city) { this.city = city; this.posts = []; this.propertyStores = new Map(); this.roadPosts = new Map(); }
  hourly() {
    const city = this.city, buildings = city.buildings.filter(b => !b.entity.destroyed);
    const utility = buildings.find(b => b.type === 'utility') || buildings.find(b => b.type === 'townhall');
    if (!utility) return;
    const night = city.hour < 6 || city.hour >= 18, groups = new Map(), posts = [];
    const register = (holder, payer, post) => {
      const key = `${holder.id}:${payer}`;
      if (!groups.has(key)) groups.set(key, { holder, payer, posts: [] });
      groups.get(key).posts.push(post); posts.push(post);
    };
    for (const b of buildings) {
      // Road lamps belong to the city, independently of the neighbouring owner.
      for (const [index, point] of (b.accessPath || []).entries()) {
        if (index % 6 || !ROAD_TILES.has(tileAt(city.world, Math.floor(point.x), Math.floor(point.y)))) continue;
        const id = `road:${Math.floor(point.x)}:${Math.floor(point.y)}`;
        if (!this.roadPosts.has(id)) this.roadPosts.set(id, { id, x: point.x, y: point.y, fuel: 0, lit: false, public: true, payerId: 'treasury' });
      }
      const owners = new Map();
      for (const unit of b.units) if (unit.ownerId && !owners.has(unit.ownerId)) owners.set(unit.ownerId, unit);
      for (const [owner, unit] of owners) {
        const id = `property:${b.id}:${owner}`;
        let holder = this.propertyStores.get(id);
        if (!holder) {
          holder = { id, type: 'property-lighting', active: true, entity: b.entity, accountId: owner, ownerId: city.development.ownerCitizen(owner)?.id, door: b.door, post: { id, buildingId: b.id, x: b.entity.x + unit.x + .5, y: b.entity.y + unit.y + .5, height: b.constructionKind === 'open-air' ? 0 : unit.z + 1, fuel: 0, lit: false, public: false, payerId: owner } };
          initializeInventory(holder, city.economy.goods, 24); this.propertyStores.set(id, holder);
        }
        holder.active = true; register(holder, owner, holder.post);
      }
    }
    for (const [id, post] of this.roadPosts) {
      if (!ROAD_TILES.has(tileAt(city.world, Math.floor(post.x), Math.floor(post.y)))) { this.roadPosts.delete(id); continue; }
      register(utility, 'treasury', post);
    }
    for (const [id, holder] of this.propertyStores) {
      const b = city.building(holder.post.buildingId);
      if (b && b.units.some(u => u.ownerId === holder.post.payerId)) continue;
      for (const shipment of city.logistics.shipments) if (shipment.buyer === holder && !['cancelled', 'delivered'].includes(shipment.status)) city.logistics.cancel(shipment);
      // Retired property fuel remains in its depot for exact stock accounting.
      holder.active = false; holder.post.lit = false;
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
      let need = Math.min(12, inventoryFree(holder), Math.max(0, lamps.filter(p => p.fuel <= 0).length - holder.inventory.oleo - (holder.incoming.oleo || 0)));
      const unitPrice = Math.ceil(city.economy.goods.oleo.price * (payer === 'treasury' ? 1.5 : 1));
      need = Math.min(need, Math.floor((city.accounts.get(payer)?.balance || 0) / unitPrice));
      for (const mill of mills) {
        const quantity = Math.min(need, mill.inventory.oleo);
        if (quantity > 0 && city.logistics.order(mill, holder, 'oleo', quantity, unitPrice, { payerAccountId: payer, purpose: payer === 'treasury' ? 'public-lighting' : 'property-lighting' })) break;
      }
    }
    this.posts = posts; city.world.cityLampPosts = posts;
  }
}
