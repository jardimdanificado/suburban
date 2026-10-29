import {activityRoomReady,activityCellAvailable} from './city_interiors.js?v=refectory-survival-1';
import { inventoryFree } from './city_inventory.js';
import { HOUSING_TYPES } from './city_housing.js';
import { reserveService } from './city_service_queue.js?v=presential-jobs-meals-1';
export const SANITATION_RULES = { dirtPerUse: 6, freeCleaningInterval: 7 * 1440, paidCleaningInterval: 180, privateCleaningInterval: 1440, cleaningPrice: 400, usePrice: 300, wastePerUse: 1, wasteToStone: 2 };
const clamp = n => Math.max(0, Math.min(100, n));
export class CitySanitation {
  constructor(city) { this.city = city; this.facilities = new Map(); this.jobs = []; this.streetFeces = new Map(); this.fecesRevision=0; this.nextJobId = 1; this.cleaned = 0; this.cleanedFeces=0; this.collected = 0; }
  addFacility(b, { unitId = null, homeId = null, homeIds = null, access = 'employees' } = {}) {
    const id = `toilet:${unitId || b.id}`;
    if (this.facilities.has(id)) {const existing=this.facilities.get(id);if(homeIds)existing.homeIds=homeIds;return existing;}
    const f = { id, buildingId: b.id, unitId, homeId, homeIds:homeIds||null, access, price: access === 'paid' ? this.city.currency.price(SANITATION_RULES.usePrice) : 0, cleanliness: 100, uses: 0, occupantId: null, busyUntil: 0, createdAt: this.city.minute, lastCleanedAt: this.city.minute, cleaningJobId: null };
    this.facilities.set(id, f); return f;
  }
  setupBuilding(b) {
    b.litter ??= 0;
    if (HOUSING_TYPES.includes(b.type)) {
      for (const u of b.units.filter(u => u.roomType === 'bathroom')) {const homes=[...this.city.housing.homes.values()].filter(h=>h.buildingId===b.id&&h.bathroomUnitId===u.id).map(h=>h.id);this.addFacility(b, { unitId: u.id, homeId: u.homeId, homeIds:homes, access: 'home' });}
      this.setupBusinessRooms(b);
    } else {
      const access = ['public_toilet', 'popular_refectory'].includes(b.type) ? 'public' : b.type === 'paid_toilet' ? 'paid' : 'employees';
      const u = b.units.find(u => u.roomType === 'bathroom') || b.units.at(-1);
      if(u&&u.roomType!=='bathroom'){u.roomType='bathroom';b.layoutRevision=(b.layoutRevision||0)+1;}
      this.addFacility(b, { unitId: u?.id || null, access });
    }
  }
  setupBusinessRooms(b) {
    if (HOUSING_TYPES.includes(b.type)) return;
    if(b.type==='public_toilet'){
      for(const room of b.units){if(room.roomType!=='bathroom'){room.roomType='bathroom';b.layoutRevision=(b.layoutRevision||0)+1;}this.addFacility(b,{unitId:room.id,access:'public'});}
      return;
    }
    if(b.type==='popular_refectory'){
      // Dedicated refectories use every usable floor for meals. Circulation
      // stays separate and existing toilets keep their real facilities.
      let changed=false;
      const bathroom=b.units.find(u=>u.roomType==='bathroom')||b.units.at(-1);
      if(bathroom&&bathroom.roomType!=='bathroom'){bathroom.roomType='bathroom';changed=true;}
      for(const room of b.units){
        if(room.roomType==='bathroom'){this.addFacility(b,{unitId:room.id,access:'public'});continue;}
        if(room.roomType!=='circulation'&&room.roomType!=='dining'){room.roomType='dining';changed=true;}
      }
      if(changed)b.layoutRevision=(b.layoutRevision||0)+1;
      return;
    }
    // Reuse existing rooms so repeated setup/expansion cannot duplicate facilities.
    let bathroom = b.units.find(u => u.roomType === 'bathroom');
    bathroom ||= b.units.find(u => u.roomType === 'workspace');
    if (bathroom) {
      if(bathroom.roomType!=='bathroom'){bathroom.roomType='bathroom';b.layoutRevision=(b.layoutRevision||0)+1;}
      this.addFacility(b, { unitId: bathroom.id, access: ['public_toilet', 'popular_refectory'].includes(b.type) ? 'public' : b.type === 'paid_toilet' ? 'paid' : 'employees' });
    }
  }

  allowed(c, f) {
    const b = this.city.building(f.buildingId); if (!b) return false;
    if (f.access === 'public' || f.access === 'paid') return f.price <= (this.city.accounts.get(this.city.payerFor(c))?.balance || 0);
    if (f.access === 'employees') return b.active && (c.jobId === b.id || c.id === b.ownerId);
    const homes=[...new Set([...(f.homeIds||[]),f.homeId].filter(Boolean))].map(id=>this.city.housing.homes.get(id)).filter(Boolean);if(!homes.length)return false;
    const residents=homes.flatMap(home=>this.city.housing.residents(home));
    if (residents.some(p => p.id === c.id)) return true;
    if (!residents.length && this.city.units.get(f.unitId)?.ownerId === c.accountId) return true;
    return residents.some(p => { const r = this.city.relationships.view(p,c); return r && r.affection >= 65 && r.trust >= 50 && r.resentment<30; });
  }
  choose(c,task='toilet') {
    const options = [...this.facilities.values()].filter(f => this.allowed(c, f) && this.city.units.get(f.unitId)?.roomType==='bathroom');
    options.sort((a, b) => this.score(c, a) - this.score(c, b));
    for (const f of options) {
      const b = this.city.building(f.buildingId), path = this.city.findPath(c.entity, b.door); if (path === null) continue;
      if(task==='toilet')c.toiletTargetId=f.id;else c.hygieneTargetId=f.id;c.task=task;c.targetId=b.id;c.path=path;
      if(task==='toilet')reserveService(this.city,c,b,'toilet',f.id);
      return true;
    }
    return false;
  }
  score(c, f) {
    const b = this.city.building(f.buildingId);
    const entrance=b.officeTenantOf?this.city.building(b.officeTenantOf)||b:b;
    const queued=(entrance.serviceQueue||[]).filter(q=>q.buildingId===b.id&&q.kind==='toilet'&&q.resource===f.id).length,busy=f.occupantId&&f.occupantId!==c.id&&this.city.minute<f.busyUntil;
    return Math.hypot(c.entity.x - b.door.x, c.entity.y - b.door.y) + (100 - f.cleanliness) * .12 + f.price / 50 + queued*24+(busy?8:0) - ((f.homeId === c.homeId || f.homeIds?.includes(c.homeId)) ? 8 : 0) - (c.jobId === b.id ? 4 : 0);
  }
  addWaste(b, amount = 1) {
    const stored = Math.min(amount, inventoryFree(b)); b.inventory.lixo += stored; b.litter += amount - stored;
    this.city.economy.produced.lixo += amount;
    this.city.economy.recordGoods('waste', 'lixo', amount, null, b.id);
  }
  emergencyRelief(c) {
    c.needs.toilet=clamp(c.needs.toilet+65);c.needs.hygiene=clamp(c.needs.hygiene-12);c.mood=Math.max(-25,(c.mood||0)-8);
    c.toiletWaitingSince=null;c.toiletTargetId=null;c.task=null;c.targetId=null;c.path=[];c.action='Aliviou-se por falta de banheiro';
    const place=this.depositFeces(c),inside=place.scope==='building';this.outdoorIncidents=(this.outdoorIncidents||0)+(!inside?1:0);
    this.disgustNearby(place,c);
    this.city.log(`${c.entity.properties.name} não conseguiu chegar ao banheiro e deixou fezes ${inside?'dentro de um prédio':'na via pública'}.`, 'sanitation', [c.id], {kind:'feces-incident',scope:place.scope,buildingId:place.buildingId??null,x:place.x,y:place.y});
  }
  depositFeces(c){
    const location=c.indoorLocation,b=location&&this.city.building(location.buildingId);
    if(b&&b.constructionKind!=='open-air'){
      const position=location.position||{x:c.entity.x,y:c.entity.y,z:0},floor=Math.max(0,Math.floor((position.z||0)/1.8)),unit=this.city.units.get(location.unitId||location.targetUnitId)||b.units.filter(u=>u.z===floor).sort((a,d)=>Math.hypot(b.entity.x+a.x+.5-position.x,b.entity.y+a.y+.5-position.y)-Math.hypot(b.entity.x+d.x+.5-position.x,b.entity.y+d.y+.5-position.y))[0];
      if(unit){b.feces??=new Map();const key=`${unit.x},${unit.y},${unit.z}`,pile=b.feces.get(key)||{amount:0,jobId:null};pile.amount++;b.feces.set(key,pile);b.fecesRevision=(b.fecesRevision||0)+1;this.fecesRevision++;const place={scope:'building',buildingId:b.id,unitId:unit.id,cellKey:key,x:b.entity.x+unit.x+.5,y:b.entity.y+unit.y+.5,z:unit.z*1.8};this.requestFecesCleaning(place);return place;}
    }
    const x=Math.floor(c.entity.x),y=Math.floor(c.entity.y),key=`${x},${y}`,pile=this.streetFeces.get(key)||{amount:0,jobId:null};pile.amount++;this.streetFeces.set(key,pile);this.fecesRevision++;
    const place={scope:'street',cellKey:key,x:x+.5,y:y+.5,z:0};this.requestFecesCleaning(place);return place;
  }
  ownerForCell(buildingId,unitId){
    const b=this.city.building(buildingId),unit=this.city.units.get(unitId);
    let candidate=unit?.ownerId&&unit.ownerId!=='treasury'?unit.ownerId:null;
    if(!candidate&&b?.ownerId!=null)candidate=this.city.economy.citizen(b.ownerId)?.accountId;
    if(!candidate&&b?.ownerId==null)candidate=b?.accountId;
    return candidate&&this.city.accounts.has(candidate)?candidate:'treasury';
  }
  requestFecesCleaning(place){
    if(this.jobs.some(j=>j.kind==='feces'&&j.scope===place.scope&&j.cellKey===place.cellKey&&(j.buildingId??null)===(place.buildingId??null)&&!['completed','cancelled'].includes(j.status)))return null;
    const b=place.scope==='building'?this.city.building(place.buildingId):null,pile=place.scope==='building'?b?.feces?.get(place.cellKey):this.streetFeces.get(place.cellKey);if(!pile)return null;
    const target=b||{id:`street:${place.cellKey}`,door:{x:place.x,y:place.y},entity:{properties:{name:'Via pública'}}},payer=place.scope==='street'?'treasury':this.ownerForCell(b.id,place.unitId),company=this.selectCompany(target),fee=Math.ceil(this.city.currency.price(180+Math.min(20,pile.amount)*80)*(payer==='treasury'?1.5:1));
    if(!company||(this.city.accounts.get(payer)?.balance||0)<fee){pile.jobId=null;return null;}
    const id=this.nextJobId++,accountId=`cleaning:${id}`;this.city.accounts.set(accountId,{name:`Limpeza urbana ${id}`,balance:0});if(!this.city.transfer(payer,accountId,fee,'Reserva de limpeza de fezes',{scope:place.scope,buildingId:place.buildingId??null,cellKey:place.cellKey})){this.city.accounts.delete(accountId);return null;}
    const job={id,kind:'feces',scope:place.scope,buildingId:place.buildingId??null,unitId:place.unitId??null,cellKey:place.cellKey,door:{x:place.x,y:place.y},payerId:payer,accountId,providerId:company.id,fee,status:'waiting',workerId:null,labor:0,createdAt:this.city.minute};pile.jobId=id;this.jobs.push(job);return job;
  }
  disgustNearby(place,offender){
    const city=this.city,amount=place.scope==='building'?city.building(place.buildingId)?.feces?.get(place.cellKey)?.amount:this.streetFeces.get(place.cellKey)?.amount;
    for(const person of city.citizens){if(person===offender||person.entity.destroyed)continue;const inside=person.indoorLocation,near=place.scope==='street'?!inside&&Math.hypot(person.entity.x-place.x,person.entity.y-place.y)<=3:inside?.buildingId===place.buildingId&&Math.hypot((inside.position?.x||0)-place.x,(inside.position?.y||0)-place.y)<=3;if(!near)continue;const disgust=Math.min(7,1+(amount||1)*.5);person.mood=Math.max(-25,(person.mood||0)-disgust);person.needs.hygiene=clamp(person.needs.hygiene-disgust*.35);person.lastFecesDisgustAt=city.minute;}
  }
  exposeNearby(){
    const city=this.city,expose=(x,y,amount,buildingId=null)=>{if(amount<2)return;for(const person of city.citizens){if(person.entity.destroyed||city.minute-(person.lastFecesExposureAt||-Infinity)<60)continue;const location=person.indoorLocation,near=buildingId!=null?location?.buildingId===buildingId&&Math.hypot((location.position?.x||0)-x,(location.position?.y||0)-y)<=2.2:!location&&Math.hypot(person.entity.x-x,person.entity.y-y)<=2.2;if(!near)continue;const dose=Math.min(3,amount*.18);person.needs.hygiene=clamp(person.needs.hygiene-dose);person.mood=Math.max(-25,(person.mood||0)-dose*.45);person.lastFecesExposureAt=city.minute;}};
    for(const [key,pile]of this.streetFeces){const [x,y]=key.split(',').map(Number);expose(x+.5,y+.5,pile.amount);}
    for(const b of city.buildings)for(const [key,pile]of b.feces||[]){const unit=b.units.find(u=>`${u.x},${u.y},${u.z}`===key);if(unit)expose(b.entity.x+unit.x+.5,b.entity.y+unit.y+.5,pile.amount,b.id);}
  }
  cleanliness(){
    const street=[...this.streetFeces.values()].reduce((n,p)=>n+p.amount,0),indoors=this.city.buildings.reduce((n,b)=>n+[...(b.feces?.values()||[])].reduce((s,p)=>s+p.amount,0),0),spilled=this.city.buildings.reduce((n,b)=>n+(b.litter||0),0),facilities=[...this.facilities.values()];
    const population=Math.max(1,this.city.citizens.filter(c=>!c.entity.destroyed).length),fecesScore=100/(1+(street+indoors)/(population*.04)),bathroomScore=facilities.length?facilities.reduce((n,f)=>n+f.cleanliness,0)/facilities.length:100,litterScore=100/(1+spilled/(population*.1));
    return {score:Math.round((fecesScore*.65+bathroomScore*.25+litterScore*.1)*10)/10,streetFeces:street,indoorFeces:indoors,spilled,dirtyStreetTiles:this.streetFeces.size,dirtyBuildings:this.city.buildings.filter(b=>b.feces?.size).length};
  }
  use(c) {
    const f = this.facilities.get(c.toiletTargetId), b = f && this.city.building(f.buildingId);
    if (!f || !b || !this.allowed(c, f) || (f.occupantId && f.occupantId !== c.id && this.city.minute < f.busyUntil)) { c.task = null; c.toiletTargetId = null; return false; }
    const room=this.city.units.get(f.unitId);if(!room||!activityRoomReady(this.city,c,b,room,'bathroom'))return false;
    if (c.servicePaid !== f.id) {
      if (!this.city.transfer(this.city.payerFor(c), b.accountId, f.price, 'Serviço: Banheiro')) { c.task = null; return false; }
      b.lastToiletUseAt = this.city.minute; f.occupantId = c.id; f.busyUntil = this.city.minute + 20; f.uses++;
      const quality = f.cleanliness;
      c.mood = Math.max(-25, Math.min(25, (c.mood || 0) + (quality >= 95 ? 6 : quality < 25 ? -9 : quality < 60 ? -4 : 0)));
      if (quality < 25) { c.needs.hygiene = clamp(c.needs.hygiene - 5); c.needs.health = clamp(c.needs.health - 1); }
      f.cleanliness = clamp(f.cleanliness - SANITATION_RULES.dirtPerUse);
      this.addWaste(b, SANITATION_RULES.wastePerUse); c.servicePaid = f.id;
      this.city.log(`${c.entity.properties.name} usou banheiro ${f.access === 'public' ? 'público gratuito' : f.access === 'paid' ? 'pago' : 'privado'}, limpeza ${Math.round(quality)}%.`, 'sanitation', [c.id], { kind: 'toilet-use', facilityId: f.id, quality, waste: SANITATION_RULES.wastePerUse });
    }
    c.needs.toilet = clamp(c.needs.toilet + 10); c.action = `Usando banheiro / limpeza ${Math.round(f.cleanliness)}%`;
    if (c.needs.toilet >= 95) { f.occupantId = null; c.task = null; c.servicePaid = null; c.toiletTargetId = null; }
    return true;
  }
  payer(f) {
    const b = this.city.building(f.buildingId); if (!b) return null;
    if (f.access === 'public') return 'treasury';
    const unit=this.city.units.get(f.unitId);if(unit?.ownerId==='treasury'&&f.access!=='paid')return 'treasury';
    if (f.homeId) {
      const home = this.city.housing.homes.get(f.homeId), resident = home && this.city.housing.residents(home).find(c => this.city.society.isAdult(c));
      return resident?.accountId || this.city.units.get(f.unitId)?.ownerId;
    }
    if(f.homeIds?.length){for(const id of f.homeIds){const home=this.city.housing.homes.get(id),resident=home&&this.city.housing.residents(home).find(c=>this.city.society.isAdult(c));if(resident)return resident.accountId;}}
    return b.accountId;
  }
  selectCompany(site) {
    const companies=this.city.economy.businesses.filter(b=>b.type==='cleaner' && (this.city.economy.workingOwner(b) || b.workers.length && b.balance>=b.wage) && this.city.economy.connected(b,site));
    const load=b=>this.jobs.filter(j=>j.providerId===b.id && !['completed','cancelled'].includes(j.status)).length/Math.max(1,b.workers.length+(b.ownerId?1:0));
    return companies.sort((a,b)=>load(a)-load(b)||a.id-b.id)[0]||null;
  }
  rebalanceWaiting() {
    for(const job of this.jobs.filter(j=>!j.workerId && !['completed','cancelled'].includes(j.status))) {
      const f=this.facilities.get(job.facilityId),site=f && this.city.building(f.buildingId);if(!site)continue;
      const company=this.selectCompany(site);if(!company)continue;
      if(!job.fee){const fee=Math.ceil(this.city.currency.price(SANITATION_RULES.cleaningPrice)*(job.payerId==='treasury'?1.5:1));if(!this.city.transfer(job.payerId,job.accountId,fee,'Reserva de limpeza por nova prestadora'))continue;job.fee=fee;}
      job.providerId=company.id;
    }
  }
  requestCleaning(facilityId, payerId = null, providerId = null) {
    const f = this.facilities.get(facilityId); if (!f || f.cleaningJobId || f.cleanliness >= 99) return null;
    const interval = f.access === 'public' ? SANITATION_RULES.freeCleaningInterval : f.access === 'paid' ? SANITATION_RULES.paidCleaningInterval : SANITATION_RULES.privateCleaningInterval;
    if (f.cleanliness >= 35 && this.city.minute - f.lastCleanedAt < interval) return null;
    const payer = this.payer(f); if (!payer || (payerId && payerId !== payer)) return null;
    const b = this.city.building(f.buildingId);
    const company = providerId ? this.city.economy.businesses.find(p=>p.id===providerId && p.type==='cleaner' && this.city.economy.connected(p,b)) : this.selectCompany(b);
    if (providerId && !company) return null;
    // The weekly municipal crew is a fallback only for free public toilets.
    if (!company && f.access !== 'public') return null;
    const fee = company ? Math.ceil(this.city.currency.price(SANITATION_RULES.cleaningPrice)*(payer==='treasury'?1.5:1)) : 0;
    if ((this.city.accounts.get(payer)?.balance || 0) < fee) return null;
    const id = this.nextJobId++, accountId = `cleaning:${id}`;
    this.city.accounts.set(accountId, { name: `Limpeza ${id}`, balance: 0 });
    if (!this.city.transfer(payer, accountId, fee, 'Reserva de limpeza', {jobId:id})) { this.city.accounts.delete(accountId); return null; }
    const job = { id, facilityId, providerId: company?.id || null, payerId: payer, accountId, fee, status: 'waiting', workerId: null, labor: 0, createdAt: this.city.minute };
    this.jobs.push(job); f.cleaningJobId = id; return job;
  }
  worker(job) {
    const b = this.city.building(job.providerId), hall = this.city.buildings.find(b => b.type === 'townhall');
    const ids = b ? [...b.workers, b.ownerId] : hall?.workers || [];
    return ids.map(id => this.city.society.citizen(id)).find(c => c && c.role!=='councilor' && !c.deliveryId && !c.cleaningJobId && !c.workMeal && !c.conversation && !this.city.urgentNeed(c));
  }
  releaseCitizen(c) {
    for (const f of this.facilities.values()) if (f.occupantId === c.id) f.occupantId = null;
    const job = this.jobs.find(j => j.workerId === c.id && j.status !== 'completed' && j.status !== 'cancelled');
    if (job) { job.workerId = null; job.status = 'waiting'; }
    c.cleaningJobId = null;
  }
  updateMinute() {
    for (const job of this.jobs) {
      if (['completed', 'cancelled'].includes(job.status)) continue;
      if(job.kind==='feces')continue;
      const f = this.facilities.get(job.facilityId), site = f && this.city.building(f.buildingId);
      if (!f || !site) {
        const c = this.city.society.citizen(job.workerId); if (c) { c.cleaningJobId = null; c.task = null; c.path = []; }
        this.city.transfer(job.accountId, this.city.accounts.get(job.payerId)?.entity?.destroyed ? 'treasury' : job.payerId, this.city.accounts.get(job.accountId).balance, 'Estorno de limpeza'); job.status = 'cancelled'; continue;
      }
      let c = this.city.society.citizen(job.workerId);
      if (c && this.city.urgentNeed(c)) { this.releaseCitizen(c); c.task = null; c.path = []; c = null; }
      if (!c && this.city.minute % 5 === 0 && this.city.hour >= 7 && this.city.hour < 19) {
        c = this.worker(job); const path = c && this.city.findPath(c.entity, site.door);
        if (!c || path === null) continue;
        c.cleaningJobId = job.id; c.task = 'clean'; c.servicePaid = null; c.targetId = site.id; c.path = path; job.workerId = c.id; job.status = 'working';
      }
      if (!c || c.workMeal || c.task==='workmeal' || c.conversation || c.path.length) continue;
      if(c.task!=='clean'){c.task='clean';c.targetId=site.id;}
      if (Math.hypot(c.entity.x - site.door.x, c.entity.y - site.door.y) > 2) { const path = this.city.findPath(c.entity, site.door); if (path) c.path = path; else this.releaseCitizen(c); continue; }
      const room=this.city.units.get(this.facilities.get(job.facilityId)?.unitId);if(room&&!activityRoomReady(this.city,c,site,room,'bathroom'))continue;
      const employer = this.city.building(job.providerId);
      if (employer && c.id !== employer.ownerId) {
        if (employer.balance < employer.wage) { this.releaseCitizen(c); continue; }
        this.city.payWage(c, employer);
      }
      job.labor += 1 + (c.skills.cleaning || 0) / 50; c.action = 'Limpando banheiro'; this.city.economy.practice(c, 'cleaning');
      if (job.labor >= 20) {
        f.cleanliness = 100; f.lastCleanedAt = this.city.minute; f.cleaningJobId = null; this.cleaned++;
        this.city.transfer(job.accountId, employer?.accountId || 'treasury', job.fee, 'Serviço de limpeza', {jobId:job.id});
        if (this.city.accounts.get(job.payerId)?.entity?.properties.cityBuilding) this.city.accounts.get(job.payerId).totalExpenses += job.fee;
        this.city.history.record('service',`Limpeza de banheiro em ${site.entity.properties.name}.`,[job.payerId,employer?.accountId,site.accountId,c.accountId],{amount:job.fee,jobId:job.id});
        this.city.reputation.completed(employer,c,'faxina concluída',{jobId:job.id});
        job.status = 'completed'; job.completedAt = this.city.minute; c.cleaningJobId = null; c.task = null; c.path = [];
        this.city.log(`Banheiro em ${site.entity.properties.name} foi limpo por ${employer?.entity.properties.name || 'equipe municipal'}.`, 'sanitation', [c.id], { kind: 'cleaning-completed', facilityId: f.id, jobId: job.id });
      }
    }
    for (const f of this.facilities.values()) if (f.occupantId && (!this.city.society.citizen(f.occupantId) || this.city.minute >= f.busyUntil)) f.occupantId = null;
    const city=this.city;
    if(city.minute%60===0){
      for(const [cell,pile] of this.streetFeces) if(!pile.jobId){const [x,y]=cell.split(',').map(Number);this.requestFecesCleaning({scope:'street',cellKey:cell,x:x+.5,y:y+.5});}
      for(const b of city.buildings)for(const [cell,pile] of b.feces||[])if(!pile.jobId){const unit=b.units.find(u=>`${u.x},${u.y},${u.z}`===cell);if(unit)this.requestFecesCleaning({scope:'building',buildingId:b.id,unitId:unit.id,cellKey:cell,x:b.entity.x+unit.x+.5,y:b.entity.y+unit.y+.5,z:unit.z*1.8});}
      this.exposeNearby();
    }
    this.updateFecesJobs();
  }
  updateFecesJobs(){
    const city=this.city;
    for(const job of this.jobs.filter(j=>j.kind==='feces'&&!['completed','cancelled'].includes(j.status))){
      const site=job.scope==='building'?city.building(job.buildingId):null,pile=job.scope==='building'?site?.feces?.get(job.cellKey):this.streetFeces.get(job.cellKey);
      if(!pile||site?.entity.destroyed){const c=city.society.citizen(job.workerId);if(c){c.cleaningJobId=null;c.task=null;c.path=[];}const account=city.accounts.get(job.accountId);if(account?.balance)city.transfer(job.accountId,job.payerId,account.balance,'Estorno: local de fezes removido',{jobId:job.id});job.status='cancelled';continue;}
      const target=site||{id:`street:${job.cellKey}`,door:job.door,entity:{properties:{name:'Via pública'}}};
      let company=city.building(job.providerId);
      if(!company||company.type!=='cleaner'||!company.active||!city.economy.connected(company,target)){
        company=this.selectCompany(target);if(!company)continue;
        // The job fee is already in escrow. Reassigning an unavailable cleaner
        // changes the provider, not the price charged to the property owner.
        job.providerId=company.id;
      }
      let worker=city.society.citizen(job.workerId);
      if(worker&&city.urgentNeed(worker)){this.releaseCitizen(worker);worker.task=null;worker.path=[];worker=null;}
      if(!worker&&city.minute%5===0&&city.hour>=7&&city.hour<19){worker=this.worker(job);if(!worker)continue;const destination=site?.door||job.door,path=city.findPath(worker.entity,destination);if(path===null)continue;worker.cleaningJobId=job.id;worker.task='clean';worker.targetId=site?.id??null;worker.path=path;worker.servicePaid=null;job.workerId=worker.id;job.status='working';}
      if(!worker||worker.path.length||worker.workMeal||worker.task==='workmeal'||worker.conversation)continue;
      if(job.scope==='street'){
        if(Math.hypot(worker.entity.x-job.door.x,worker.entity.y-job.door.y)>.45){const path=city.findPath(worker.entity,job.door);if(path===null)continue;worker.path=path;continue;}
      }else{
        const room=city.units.get(job.unitId);if(!room){this.releaseCitizen(worker);continue;}
        if(!worker.indoorLocation||worker.indoorLocation.buildingId!==site.id||worker.indoorLocation.targetUnitId!==room.id||worker.indoorLocation.path?.length)continue;
      }
      if(worker.id!==company.ownerId){if(company.balance<company.wage){this.releaseCitizen(worker);continue;}city.payWage(worker,company);}
      job.labor+=1+(worker.skills.cleaning||0)/50;worker.action=job.scope==='street'?'Limpando fezes da via pública':'Limpando fezes do prédio';city.economy.practice(worker,'cleaning');
      if(job.labor<12+Math.max(0,pile.amount-1)*8)continue;
      if(job.scope==='building'){site.feces.delete(job.cellKey);site.fecesRevision=(site.fecesRevision||0)+1;}else this.streetFeces.delete(job.cellKey);this.fecesRevision++;this.cleanedFeces+=pile.amount;
      const paid=city.transfer(job.accountId,company.accountId,city.accounts.get(job.accountId)?.balance||0,'Serviço de remoção de fezes',{jobId:job.id,scope:job.scope});job.status='completed';job.completedAt=city.minute;job.cleanedAmount=pile.amount;job.workerId=worker.id;worker.cleaningJobId=null;worker.task=null;worker.targetId=null;worker.path=[];worker.workCell=null;
      city.history.record('service',job.scope==='street'?'Limpeza de fezes em via pública.':'Limpeza de fezes em propriedade privada.',[job.payerId,company.accountId,worker.accountId],{amount:paid?job.fee:0,jobId:job.id,scope:job.scope,buildingId:job.buildingId,cellKey:job.cellKey,quantity:pile.amount});
      city.reputation.completed(company,worker,'limpeza concluída',{jobId:job.id});city.log(`${job.scope==='street'?'A prefeitura':'O proprietário'} pagou a limpeza de fezes ${job.scope==='street'?'na via pública':`em ${site.entity.properties.name}`}.`,'sanitation',[worker.id],{kind:'feces-cleaned',jobId:job.id,scope:job.scope,buildingId:job.buildingId,amount:job.fee});
    }
  }
  wasteMetrics() {
    const city=this.city,buildings=city.buildings.filter(b=>!b.entity.destroyed);
    const loads=city.logistics.shipments.filter(s=>s.good==='lixo' && !['delivered','cancelled'].includes(s.status));
    const processors=buildings.filter(b=>['recycler','composting'].includes(b.type));
    return {
      awaiting:buildings.filter(b=>!['waste_collector','recycler','composting'].includes(b.type)).reduce((n,b)=>n+(b.inventory.lixo||0)+(b.litter||0),0),
      atCollectors:buildings.filter(b=>b.type==='waste_collector').reduce((n,b)=>n+(b.inventory.lixo||0)+(b.litter||0),0),
      atProcessors:processors.reduce((n,b)=>n+(b.inventory.lixo||0)+(b.litter||0),0),
      collecting:loads.filter(s=>s.purpose==='waste-collection').reduce((n,s)=>n+s.quantity,0),
      transferring:loads.filter(s=>s.purpose!=='waste-collection').reduce((n,s)=>n+s.quantity,0),
      total:city.goodsStock('lixo'),processed:city.economy.consumed.lixo,
    };
  }
  hourly() {
    this.rebalanceWaiting();
    for (const f of this.facilities.values()) if (f.cleanliness < (f.access === 'paid' ? 85 : 60)) this.requestCleaning(f.id);
    const city=this.city,hall=city.buildings.find(b=>b.type==='townhall'&&!b.entity.destroyed);if(hall)this.setupBusinessRooms(hall);
    for(const building of city.buildings)if(!building.entity.destroyed&&['public_toilet','popular_refectory'].includes(building.type))this.setupBusinessRooms(building);
    const collectors=city.economy.businesses.filter(b=>b.type==='waste_collector');
    const processors=city.economy.businesses.filter(b=>['recycler','composting'].includes(b.type));
    const activeLoads=()=>city.logistics.shipments.filter(s=>!['delivered','cancelled'].includes(s.status));
    for (const b of city.buildings.filter(b=>!b.entity.destroyed)) {
      // Keep spilled and stored waste conserved while deliveries clear bin space.
      if (b.litter>0) {const n=Math.min(b.litter,inventoryFree(b));b.inventory.lixo+=n;b.litter-=n;}
      if(b.inventory.lixo<2 || ['waste_collector','recycler','composting'].includes(b.type))continue;
      if(activeLoads().some(s=>s.seller===b && s.purpose==='waste-collection'))continue;
      const options=collectors.filter(c=>inventoryFree(c)>=2 && city.economy.connected(c,b)).sort((a,d)=>inventoryFree(d)-inventoryFree(a)||a.id-d.id);
      const f=[...this.facilities.values()].find(f=>f.buildingId===b.id);
      let payer=['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing'].includes(b.type)?b.units[0]?.ownerId:f?this.payer(f):b.accountId;
      if(!b.active)payer=b.units[0]?.ownerId||payer;
      if(!payer)continue;
      for(const collector of options) {
        const quantity=Math.min(24,b.inventory.lixo,inventoryFree(collector));
        const fee=Math.ceil(city.currency.price(200+quantity*50)*(payer==='treasury'?1.5:1));
        const order=city.logistics.order(b,collector,'lixo',quantity,0,{payerAccountId:payer,purpose:'waste-collection',serviceFee:fee,serviceAccountId:collector.accountId});
        if(order)break;
      }
    }
    // Alternate destinations so recycling and composting both receive physical inputs.
    const offset=(this.processorCursor||0)%Math.max(1,processors.length);
    const ordered=[...processors.slice(offset),...processors.slice(0,offset)];this.processorCursor=offset+1;
    for(const processor of ordered) {
      let need=Math.max(0,12-processor.inventory.lixo-(processor.incoming.lixo||0));
      for(const seller of collectors) {
        const quantity=Math.min(24,seller.inventory.lixo,inventoryFree(processor),need);
        if(quantity>0 && city.logistics.order(seller,processor,'lixo',quantity,city.economy.goods.lixo.price,{purpose:'waste-processing'}))need-=quantity;
      }
    }
  }

  recycle(b, c) {
    if (b.inventory.lixo < SANITATION_RULES.wasteToStone) return false;
    b.recyclingLabor = (b.recyclingLabor || 0) + 1 + (c.skills.recycling || 0) / 60;
    if (b.recyclingLabor >= 8) {
      b.recyclingLabor -= 8; b.inventory.lixo -= SANITATION_RULES.wasteToStone; b.inventory.pedra++; b.recycledStone=(b.recycledStone||0)+1; b.wasteProcessed=(b.wasteProcessed||0)+SANITATION_RULES.wasteToStone;
      this.city.history.record('production','Reciclagem: lixo transformado em pedra.',[b.accountId],{good:'pedra',quantity:1,waste:SANITATION_RULES.wasteToStone});
      this.city.economy.consumed.lixo += SANITATION_RULES.wasteToStone; this.city.economy.produced.pedra++;
      this.city.economy.recordGoods('recycling-input', 'lixo', SANITATION_RULES.wasteToStone, b.id, null); this.city.economy.recordGoods('recycling-output', 'pedra', 1, null, b.id);
    }
    return true;
  }
  reconcile() {
    for(const b of this.city.buildings)if(!b.entity.destroyed&&['public_toilet','popular_refectory'].includes(b.type))this.setupBusinessRooms(b);
    for (const [id, f] of this.facilities) if (!this.city.building(f.buildingId) || (f.unitId && !this.city.units.has(f.unitId))) this.facilities.delete(id);
  }
}
