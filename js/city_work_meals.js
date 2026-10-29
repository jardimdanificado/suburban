import {syncCitizenInterior} from './city_interiors.js?v=refectory-survival-1';
import { preparedOffer } from './city_markets.js';
import { CROPS } from './city_economy.js?v=refectory-survival-1';
import { INDUSTRIAL_FOODS } from './city_industries.js';
import { inventoryFree } from './city_inventory.js';

export const WORK_MEAL_RULES = { units: 3, foodThreshold: 45, stockPerWorker: 6, voucherMinimum: 3000, voucherPriceMultiple: 6, duration: 15 };
export class CityWorkMeals {
  constructor(city) { this.city = city; }
  employer(c) {
    const hour = this.city.hour;
    if(hour<7||hour>=20||c.role==='councilor'||!c.jobId&&!c.businessIds.length)return null;
    let b=this.city.building(c.jobId);
    if(!b)for(const id of c.businessIds){const candidate=this.city.building(id);if(candidate?.active&&this.offer(candidate)){b=candidate;break;}}
    return b?.active && (b.workers.includes(c.id) || b.ownerId === c.id) && hour >= (b.type === 'carrier' ? 7 : 8) && hour < (b.type === 'carrier' ? 20 : 17) ? b : null;
  }
  foodGoods() { return [...Object.keys(CROPS).filter(g=>!['trigo','girassol'].includes(g)),...INDUSTRIAL_FOODS,'pao']; }
  offer(holder, citizen = null) {
    const packed=preparedOffer(this.city.economy,holder,citizen);if(packed)return {...packed,price:0};
    if (holder.type === 'bakery' && holder.inventory.pao >= WORK_MEAL_RULES.units) return { good: 'pao', quantity: WORK_MEAL_RULES.units, inputs: { pao: WORK_MEAL_RULES.units }, quality: 1 };
    const recipes = holder.type === 'bakery' ? { pao: this.city.economy.recipes.pao } : { ...Object.fromEntries(this.foodGoods().map(g => [`single_${g}`, { inputs: { [g]: WORK_MEAL_RULES.units }, quality: 1 }])), ...this.city.economy.recipes };
    let ready=null,bestScore=-Infinity;
    for(const [good,recipe] of Object.entries(recipes)){
      if(!Object.entries(recipe.inputs).every(([g,n])=>(holder.inventory[g]||0)>=n))continue;
      const score=recipe.quality+(citizen?this.city.economy.mealTaste(citizen,{good,inputs:recipe.inputs})*10:0);
      if(!ready||score>bestScore){ready=[good,recipe];bestScore=score;}
    }
    if (ready) return { good: ready[0], quantity: 1, inputs: ready[1].inputs, quality: ready[1].quality + (holder.mealQuality || 0) - 1 };
    const good = this.foodGoods().filter(g => (holder.inventory[g] || 0) >= WORK_MEAL_RULES.units).sort((a, b) => holder.inventory[b] - holder.inventory[a])[0];
    return good ? { good, quantity: WORK_MEAL_RULES.units, inputs: { [good]: WORK_MEAL_RULES.units }, quality: 1 } : null;
  }
  stock(holder) { return this.foodGoods().reduce((n, g) => n + (holder.inventory[g] || 0) + (holder.incoming[g] || 0), 0); }
  completeFloor(holder,z) {
    if(!holder?.units?.length||!holder.width||!holder.depth)return false;
    const shell=this.city.building(holder.officeTenantOf)||holder,rooms=holder.units.filter(u=>u.z===z);
    if(!rooms.some(u=>u.roomType!=='circulation'))return false;
    const cells=new Set([...rooms,...(shell.circulation||[]).filter(u=>u.z===z)].map(u=>`${u.x},${u.y}`));
    return cells.size===holder.width*holder.depth;
  }
  hasFullDiningFloor(holder) {
    if(!holder?.units?.length)return false;
    for(const z of new Set(holder.units.filter(u=>u.roomType==='dining').map(u=>u.z))){
      const rooms=holder.units.filter(u=>u.z===z&&u.roomType!=='circulation');
      if(this.completeFloor(holder,z)&&rooms.every(u=>u.roomType==='dining'))return true;
    }
    return false;
  }
  site(c, employer) {
    if (c.task === 'workmeal' && c.mealTargetId) return this.city.development.projects.find(p => p.id === c.mealTargetId && !p.cancelled && p.status !== 'completed') || employer;
    const project = this.city.development.projects.find(p => p.id === c.workProjectId && !p.cancelled && p.status !== 'completed' && p.builderId === employer.id);
    return c.task === 'construction' && project ? project : employer;
  }
  routeToMeal(c) {
    if(this.city.minute<(c.mealRetryAt||0))return false;
    const b = this.employer(c); if (!b || !this.hasFullDiningFloor(b)) return false;
    const sites = [b, ...this.city.development.projects.filter(p => p.builderId === b.id && !p.cancelled && p.status !== 'completed')].filter(s => { if(!this.hasFullDiningFloor(s))return false;const offer = this.offer(s, c); return offer && (c.needs.food < 18 || !this.city.buildings.some(shop => this.city.economy.mealScore(c, shop) < Math.hypot(s.door.x - c.entity.x, s.door.y - c.entity.y) - this.city.economy.mealTaste(c, offer) * 45)); }).sort((a, d) => Math.hypot(a.door.x - c.entity.x, a.door.y - c.entity.y) - Math.hypot(d.door.x - c.entity.x, d.door.y - c.entity.y));
    for (const site of sites) {
      const path = this.city.findPath(c.entity, site.door); if (path === null) continue;
      c.task = 'workmeal'; c.targetId = b.id; c.mealTargetId = site.id; c.path = path; return true;
    }
    return false;
  }
  tryStart(c) {
    if(c.task==='workmeal'&&!c.workMeal&&!this.hasFullDiningFloor(this.employer(c))){c.task=null;c.targetId=null;c.path=[];c.mealResume=null;c.mealTargetId=null;c.mealWaitSince=null;return false;}
    if(c.mobilityTrip||c.ridingVehicleId)return false;
    if (c.workMeal) return true;
    // An optional meal must not interrupt drinking, treatment or other urgent travel.
    if(!['work','manage','construction','workmeal'].includes(c.task))return false;
    const urgent=this.city.urgentNeed(c);if(urgent&&urgent!=='food')return false;
    if(this.city.minute<(c.mealRetryAt||0))return false;
    if(c.needs.food>=WORK_MEAL_RULES.foodThreshold||c.conversation)return false;
    const b = this.employer(c);
    if (!b || !this.hasFullDiningFloor(b)) {
      if(c.task==='workmeal'){c.task=null;c.targetId=null;c.path=[];c.mealResume=null;c.mealTargetId=null;c.mealWaitSince=null;}
      return false;
    }
    const holder = this.site(c, b);
    if(!this.hasFullDiningFloor(holder))return false;
    const atFarm=holder.type==='farm'&&c.entity.x>=holder.entity.x-1&&c.entity.x<=holder.entity.x+holder.width+1&&c.entity.y>=holder.entity.y-1&&c.entity.y<=holder.entity.y+holder.depth+1;
    if(!atFarm&&Math.hypot(c.entity.x-holder.door.x,c.entity.y-holder.door.y)>2&&!c.indoorLocation)return false;
    const offer = this.offer(holder, c); if (!offer) return false;
    if(c.task!=='workmeal'){c.mealResume={task:c.task,targetId:c.targetId,workProjectId:c.workProjectId};c.task='workmeal';c.path=[];c.targetId=b.id;c.mealTargetId=holder.id;}
    if(c.path.length)return true;
    if(!syncCitizenInterior(this.city,c)){
      c.mealWaitSince??=this.city.minute;
      if(this.city.minute-c.mealWaitSince>=30&&!c.indoorLocation?.targetUnitId){c.mealWaitSince=null;c.mealRetryAt=this.city.minute+90;c.task=null;c.targetId=null;c.path=[];c.mealResume=null;return false;}
      return true;
    }
    if(c.indoorLocation?.buildingId!==holder.id||c.indoorLocation?.roomType!=='dining'||c.indoorLocation?.path?.length)return true;
    c.mealWaitSince=null;
    this.city.economy.enjoyMeal(c, offer);
    for (const [good, amount] of Object.entries(offer.inputs)) { holder.inventory[good] -= amount; this.city.economy.consumed[good] += amount; this.city.economy.recordGoods('workplace-meal', good, amount, holder.id, c.id); }
    c.workMeal = { employerId: b.id, siteId: holder.id, startedAt: this.city.minute, elapsed: 0, good: offer.good, quality: offer.quality, resume:c.mealResume?['work','manage','construction','transport'].includes(c.mealResume.task):false,resumeState:c.mealResume };
    b.mealsServed++;
    this.city.log(`${c.entity.properties.name} recebeu uma refeição de ${b.entity.properties.name}, no local de trabalho.`, 'work', [c.id, b.ownerId].filter(Boolean), { kind: 'workplace-meal', employerId: b.id, siteId: holder.id, good: offer.good, quantity: offer.quantity });
    return true;
  }
  advance(c) {
    if (!c.workMeal) return false;
    c.workMeal.elapsed++; c.needs.food = Math.min(100, c.needs.food + 5 * c.workMeal.quality);
    c.action = 'Comendo refeição fornecida pela empresa';
    if (c.needs.food >= 95 || c.workMeal.elapsed >= WORK_MEAL_RULES.duration) {
      const resume = c.workMeal.resume,state=c.workMeal.resumeState; c.workMeal = null; c.foodVoucher = null;c.mealResume=null;
      if(resume&&state){c.task=state.task;c.targetId=state.targetId;c.workProjectId=state.workProjectId;}
      if (!resume) { c.task = null; c.path = []; c.servicePaid = null; }
    }
    return true;
  }
  issueVoucher(c, shop) {
    const b = this.employer(c), offer = this.city.economy.mealOffer(shop);
    if (!b || this.hasFullDiningFloor(b)&&!(c.mealRetryAt>this.city.minute) || c.needs.food >= WORK_MEAL_RULES.foodThreshold || c.foodVoucher || !offer) return false;
    const amount = Math.max(this.city.currency.price(WORK_MEAL_RULES.voucherMinimum), offer.price * WORK_MEAL_RULES.voucherPriceMultiple);
    if (!this.city.transfer(b.accountId, c.accountId, amount, 'Vale-alimentação')) return false;
    c.foodVoucher = { employerId: b.id, amount, issuedAt: this.city.minute };
    c.mealAllowanceToday += amount; b.foodVoucherCost += amount; b.vouchersIssued++;
    this.city.log(`${b.entity.properties.name} pagou vale-alimentação de ${(amount / 100).toFixed(2)} para ${c.entity.properties.name}, por falta de refeição no local.`, 'work', [c.id, b.ownerId].filter(Boolean), { kind: 'meal-voucher', employerId: b.id, amount });
    return true;
  }
  purchase() {
    const city = this.city;
    const employers = city.buildings.filter(b => b.active && !b.entity.destroyed && b.workers.length);
    const suppliers = city.buildings.filter(b => b.active && !b.entity.destroyed && ['market', 'greengrocer', 'bakery', 'popular_refectory', 'townhall'].includes(b.type));
    for (const b of employers) {
      if (b.type && !this.hasFullDiningFloor(b)) continue;
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
          const good = Object.keys(offer.inputs).find(g => g !== 'pao') || 'pao';
          const unitPrice = shop.type === 'townhall' ? city.economy.goods[good]?.price || 0 : good === 'pao' ? city.currency.price(160) : city.economy.goods[good].price + city.currency.price(65);
          const reserve = b.workers.length * b.wage * 60;
          let quantity = Math.floor(Math.min(needed, shop.inventory[good] || 0, unitPrice ? Math.max(0, b.balance - reserve) / unitPrice : needed) / 3) * 3;
          let order = null;
          for (; quantity >= 3; quantity -= 3) {
            order = city.logistics.order(shop, holder, good, quantity, unitPrice, { payerAccountId: b.accountId, purpose: 'work-meals' });
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
