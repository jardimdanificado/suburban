import { inventoryFree } from './city_inventory.js';

export const WORK_MEAL_RULES = { units: 3, foodThreshold: 45, stockPerWorker: 6, voucherMinimum: 3000, voucherPriceMultiple: 6, duration: 15 };
export class CityWorkMeals {
  constructor(city) { this.city = city; }
  employer(c) {
    const b = this.city.building(c.jobId) || c.businessIds.map(id => this.city.building(id)).find(b => b?.active && this.offer(b)), hour = this.city.hour;
    return b?.active && (b.workers.includes(c.id) || b.ownerId === c.id) && hour >= (b.type === 'carrier' ? 7 : 8) && hour < (b.type === 'carrier' ? 20 : 17) ? b : null;
  }
  foodGoods() { return Object.keys(this.city.economy.goods).filter(g => !['trigo', 'pedra', 'sementes', 'lixo'].includes(g)); }
  offer(holder) {
    const good = this.foodGoods().filter(g => (holder.inventory[g] || 0) >= WORK_MEAL_RULES.units).sort((a, b) => holder.inventory[b] - holder.inventory[a])[0];
    return good ? { good, quantity: WORK_MEAL_RULES.units } : null;
  }
  stock(holder) { return this.foodGoods().reduce((n, g) => n + (holder.inventory[g] || 0) + (holder.incoming[g] || 0), 0); }
  site(c, employer) {
    if (c.task === 'workmeal' && c.mealTargetId) return this.city.development.projects.find(p => p.id === c.mealTargetId && !p.cancelled && p.status !== 'completed') || employer;
    const project = this.city.development.projects.find(p => p.id === c.workProjectId && !p.cancelled && p.status !== 'completed' && p.builderId === employer.id);
    return c.task === 'construction' && project ? project : employer;
  }
  routeToMeal(c) {
    const b = this.employer(c); if (!b) return false;
    const sites = [b, ...this.city.development.projects.filter(p => p.builderId === b.id && !p.cancelled && p.status !== 'completed')].filter(s => this.offer(s)).sort((a, d) => Math.hypot(a.door.x - c.entity.x, a.door.y - c.entity.y) - Math.hypot(d.door.x - c.entity.x, d.door.y - c.entity.y));
    for (const site of sites) {
      const path = this.city.findPath(c.entity, site.door); if (path === null) continue;
      c.task = 'workmeal'; c.targetId = b.id; c.mealTargetId = site.id; c.path = path; return true;
    }
    return false;
  }
  tryStart(c) {
    if (c.workMeal) return true;
    const b = this.employer(c);
    if (!b || c.needs.food >= WORK_MEAL_RULES.foodThreshold || c.conversation) return false;
    const holder = this.site(c, b);
    if (Math.hypot(c.entity.x - holder.door.x, c.entity.y - holder.door.y) > 2) return false;
    const offer = this.offer(holder); if (!offer) return false;
    holder.inventory[offer.good] -= offer.quantity;
    this.city.economy.consumed[offer.good] += offer.quantity;
    this.city.economy.recordGoods('workplace-meal', offer.good, offer.quantity, holder.id, c.id);
    c.workMeal = { employerId: b.id, siteId: holder.id, startedAt: this.city.minute, elapsed: 0, good: offer.good, resume: ['work', 'manage', 'construction', 'transport'].includes(c.task) };
    b.mealsServed++;
    this.city.log(`${c.entity.properties.name} recebeu uma refeição de ${b.entity.properties.name}, no local de trabalho.`, 'work', [c.id, b.ownerId].filter(Boolean), { kind: 'workplace-meal', employerId: b.id, siteId: holder.id, good: offer.good, quantity: offer.quantity });
    return true;
  }
  advance(c) {
    if (!c.workMeal) return false;
    c.workMeal.elapsed++; c.needs.food = Math.min(100, c.needs.food + 5);
    c.action = 'Comendo refeição fornecida pela empresa';
    if (c.needs.food >= 95 || c.workMeal.elapsed >= WORK_MEAL_RULES.duration) {
      const resume = c.workMeal.resume; c.workMeal = null; c.foodVoucher = null;
      if (!resume) { c.task = null; c.path = []; c.servicePaid = null; }
    }
    return true;
  }
  issueVoucher(c, shop) {
    const b = this.employer(c), offer = this.city.economy.mealOffer(shop);
    if (!b || c.needs.food >= WORK_MEAL_RULES.foodThreshold || c.foodVoucher || !offer) return false;
    const amount = Math.max(WORK_MEAL_RULES.voucherMinimum, offer.price * WORK_MEAL_RULES.voucherPriceMultiple);
    if (!this.city.transfer(b.accountId, c.accountId, amount, 'Vale-alimentação')) return false;
    c.foodVoucher = { employerId: b.id, amount, issuedAt: this.city.minute };
    c.mealAllowanceToday += amount; b.foodVoucherCost += amount; b.vouchersIssued++;
    this.city.log(`${b.entity.properties.name} pagou vale-alimentação de ${(amount / 100).toFixed(2)} para ${c.entity.properties.name}, por falta de refeição no local.`, 'work', [c.id, b.ownerId].filter(Boolean), { kind: 'meal-voucher', employerId: b.id, amount });
    return true;
  }
  purchase() {
    const city = this.city;
    const employers = city.buildings.filter(b => b.active && !b.entity.destroyed && b.workers.length);
    const suppliers = city.buildings.filter(b => b.active && !b.entity.destroyed && ['market', 'greengrocer', 'bakery', 'townhall'].includes(b.type));
    for (const b of employers) {
      const projects = city.development.projects.filter(p => p.builderId === b.id && !p.cancelled && p.status !== 'completed' && p.requiredLabor - p.labor >= 30);
      const sites = [b, ...projects];
      for (const holder of sites) {
        const target = holder === b && projects.length ? 6 : Math.max(9, Math.ceil(b.workers.length / Math.max(1, projects.length)) * WORK_MEAL_RULES.stockPerWorker);
        if (this.stock(holder) > target / 2) continue;
        let needed = Math.min(24, target - this.stock(holder), inventoryFree(holder));
        if (needed < 3) continue;
        const shops = suppliers.filter(s => s !== holder && s !== b).sort((a, c) => Number(a.type === 'townhall') - Number(c.type === 'townhall') || Math.hypot(a.door.x - holder.door.x, a.door.y - holder.door.y) - Math.hypot(c.door.x - holder.door.x, c.door.y - holder.door.y));
        for (const shop of shops) {
          const offer = this.offer(shop); if (!offer) continue;
          const unitPrice = shop.type === 'townhall' ? city.economy.goods[offer.good].price : offer.good === 'pao' ? 160 : city.economy.goods[offer.good].price + 65;
          const reserve = b.workers.length * b.wage * 60;
          let quantity = Math.floor(Math.min(needed, shop.inventory[offer.good], Math.max(0, b.balance - reserve) / unitPrice) / 3) * 3;
          let order = null;
          for (; quantity >= 3; quantity -= 3) {
            order = city.logistics.order(shop, holder, offer.good, quantity, unitPrice, { payerAccountId: b.accountId, purpose: 'work-meals' });
            if (order) break;
          }
          if (order) needed -= quantity;
          if (needed < 3) break;
        }
      }
    }
  }
  closeSite(project, building = null) {
    const city = this.city, builder = city.building(project.builderId);
    for (const s of city.logistics.shipments) if (s.buyer === project && s.purpose === 'work-meals') city.logistics.cancel(s);
    for (const good of this.foodGoods()) {
      if (building) {
        const quantity = Math.min(project.inventory[good], inventoryFree(building));
        building.inventory[good] += quantity; project.inventory[good] -= quantity;
      } else if (builder?.active) {
        const quantity = Math.min(24, project.inventory[good], inventoryFree(builder));
        if (quantity) city.logistics.order(project, builder, good, quantity, 0, { purpose: 'work-meals' });
      }
    }
  }
}
