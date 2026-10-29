import {colorAffinity,buildingColor} from './city_colors.js';
import {DEVELOPMENT_RULES} from './city_development.js?v=landlord-stock-market-1';
export const HOUSING_RULES = { roomPrice: 120000, roomRent: 120, livingReserve: 3000, defaultDays: 3, unsoldRentalAfter: 1440 };
export const SOCIAL_HOUSING_TYPES = Object.freeze(['super_popular_housing','popular_housing','popular_luxury_housing']);
export const HOUSING_TYPES = Object.freeze(['residential',...SOCIAL_HOUSING_TYPES,'luxury_housing']);
const NO_RESIDENTS=Object.freeze([]);
const roomRoll=(b,u,salt=0)=>{let value=(b.id*2654435761^u.x*2246822519^u.y*3266489917^u.z*668265263^salt)>>>0;value^=value>>>16;return value%100;};
function configureRoomWindow(b,u){const roll=roomRoll(b,u,5);u.hasWindow=u.roomType==='bedroom'||u.roomType==='dining'||u.roomType==='laundry'||u.roomType==='plenary'||u.roomType==='treatment'||u.roomType==='office'&&roll<78||u.roomType==='workspace'&&roll<58||u.roomType==='service'&&roll<42;u.windowStyle=['sash','tall','picture','round','shuttered'][roomRoll(b,u,11)%5];}

/** Only facade cells can be owned. Interior cells are common circulation. */
export function floorCells(b, z) {
  const cells = [];
  if (b.constructionKind === 'open-air'||b.type==='council_chamber'&&z===0) { for (let y = 0; y < b.depth; y++) for (let x = 0; x < b.width; x++) cells.push({ x, y, z }); return cells; }
  for (let x = 0; x < b.width; x++) cells.push({ x, y: 0, z });
  for (let y = 1; y < b.depth; y++) cells.push({ x: b.width - 1, y, z });
  if (b.depth > 1) for (let x = b.width - 2; x >= 0; x--) cells.push({ x, y: b.depth - 1, z });
  if (b.width > 1) for (let y = b.depth - 2; y > 0; y--) cells.push({ x: 0, y, z });
  return cells;
}
export class CityHousing {
  constructor(city) { this.city = city; this.homes = new Map(); this.rentPolicyVersion=2; }
  addFloor(b, z, ownerId) {
    const spec = this.city.buildingTypes[b.type], units = [];
    const housingType = HOUSING_TYPES.includes(b.type);
    for (const { x, y } of floorCells(b, z)) {
      const u = { id: `${b.id}:${x}:${y}:${z}`, buildingId: b.id, x, y, z, width: 1, depth: 1, roomType:b.type==='council_chamber'?(z===0?'plenary':'office'):housingType?'bedroom':'workspace', homeId: null, ownerId, tenantId: null, occupantId: !housingType && b.active ? b.accountId : null, rent: this.city.currency.price(housingType ? HOUSING_RULES.roomRent * (b.type === 'luxury_housing' ? 2 : 1) : spec.rent), price: this.city.currency.price(housingType ? HOUSING_RULES.roomPrice * (b.type === 'luxury_housing' ? 3 : 1) : spec.price), forSale:ownerId==='treasury'&&!['council_chamber',...SOCIAL_HOUSING_TYPES].includes(b.type), forRent: false, arrears: 0, missedDays: 0 };
      b.units.push(u); this.city.units.set(u.id, u); units.push(u);
    }
    if (b.constructionKind !== 'open-air'&&!(b.type==='council_chamber'&&z===0)) for (let y = 1; y < b.depth - 1; y++) for (let x = 1; x < b.width - 1; x++) (b.circulation ??= []).push({ x, y, z });
    if (housingType) {
      const shared = b.type==='popular_housing'||b.type==='super_popular_housing';
      const floorGroups=new Map();for(const u of units){let a=floorGroups.get(u.z);if(!a)floorGroups.set(u.z,a=[]);a.push(u);}
      if(b.type==='super_popular_housing'&&units.length&&!b.sharedBathroomUnitId){const bathroom=units[0];bathroom.roomType='bathroom';b.sharedBathroomUnitId=bathroom.id;}
      for(const [floor,floorUnits] of floorGroups){
        let bathroom=null,bedrooms=floorUnits;
        if(b.type==='popular_housing'){bathroom=floorUnits[0];bathroom.roomType='bathroom';bedrooms=floorUnits.slice(1);}
        if(b.type==='super_popular_housing')bedrooms=floorUnits.filter(u=>u.id!==b.sharedBathroomUnitId);
        if(b.type==='popular_luxury_housing'){
          const rooms=floorUnits,id=`home:${rooms[0].id}`;if(rooms[0])rooms[0].roomType='bedroom';if(rooms[1])rooms[1].roomType='bathroom';if(rooms[2])rooms[2].roomType='dining';if(rooms[3]&&roomRoll(b,rooms[3],29)<62)rooms[3].roomType='laundry';
          const home={id,buildingId:b.id,unitIds:rooms.map(u=>u.id),createdAt:this.city.minute};for(const u of rooms)u.homeId=id;this.homes.set(id,home);continue;
        }
        if(b.type==='residential'||b.type==='luxury_housing'){
          const groupSize=b.type==='luxury_housing'?4:2;
          for(let i=0;i<floorUnits.length;i+=groupSize){const rooms=floorUnits.slice(i,i+groupSize),id=`home:${rooms[0].id}`;if(rooms[1])rooms[1].roomType='bathroom';if(groupSize===4&&rooms[2])rooms[2].roomType='dining';if(groupSize===4&&rooms[3]&&roomRoll(b,rooms[3],29)<62)rooms[3].roomType='laundry';const home={id,buildingId:b.id,unitIds:rooms.map(u=>u.id),createdAt:this.city.minute};for(const u of rooms)u.homeId=id;this.homes.set(id,home);}
          continue;
        }
        for(let i=0;i<bedrooms.length;i+=2){const rooms=bedrooms.slice(i,i+2),id=`home:${rooms[0].id}`,bathroomUnitId=b.type==='super_popular_housing'?b.sharedBathroomUnitId:bathroom?.id;const home={id,buildingId:b.id,unitIds:rooms.map(u=>u.id),bathroomUnitId,sharedBathroom:shared,sharedBathroomFloor:floor,createdAt:this.city.minute};for(const u of rooms)u.homeId=id;this.homes.set(id,home);}
      }
    }
    if(b.type==='laundromat'&&units[0])units[0].roomType='laundry';
    else if(!housingType&&b.constructionKind!=='open-air'&&b.type!=='council_chamber'&&units.length>=6&&roomRoll(b,units[0],37)<22)units[0].roomType='laundry';
    for(const u of units)configureRoomWindow(b,u);
    b.layoutRevision=(b.layoutRevision||0)+1;
    return units;
  }
  units(home) { return home.unitIds.map(id => this.city.units.get(id)).filter(Boolean); }
  homeColor(home){const b=this.city.building(home.buildingId),room=this.units(home).find(u=>u.roomType==='bedroom');return b?.wallColors?.[room?.id]||buildingColor(b);}
  home(c) { return this.homes.get(c.homeId); }
  hasDining(home) { return this.units(home).some(u => u.roomType === 'dining'); }
  invalidateResidents(){this.residentsByHome=null;}
  residents(home) {
    const city=this.city;
    if(!this.residentsByHome||this.residentsMinute!==city.minute||this.residentsPopulation!==city.citizens.length){
      const index=new Map();for(const c of city.citizens)if(!c.entity.destroyed&&c.homeId){let people=index.get(c.homeId);if(!people)index.set(c.homeId,people=[]);people.push(c);}
      this.residentsByHome=index;this.residentsMinute=city.minute;this.residentsPopulation=city.citizens.length;
    }
    return this.residentsByHome.get(home.id)?.slice()||NO_RESIDENTS;
  }
  hasBathroom(home) { return !!home?.bathroomUnitId&&this.city.units.get(home.bathroomUnitId)?.roomType==='bathroom'||this.units(home).some(u => u.roomType === 'bathroom'); }
  price(home) { return this.units(home).reduce((n, u) => n + u.price, 0); }
  rent(home, citizen = null) { if(this.isSocial(home))return 0;return this.units(home).reduce((n, u) => n + (citizen && u.ownerId === citizen.accountId ? 0 : u.rent), 0); }
  isSocial(home) {
    const units=home?this.units(home):[];
    return SOCIAL_HOUSING_TYPES.includes(this.city.building(home?.buildingId)?.type) && units.length>0 && units.every(u=>u.ownerId==='treasury');
  }
  configureSocialHousing() {
    for(const home of this.homes.values())if(this.isSocial(home)) {
      const building=this.city.building(home.buildingId);
      for(const unit of this.units(home)) {
        unit.forSale=false;unit.forRent=false;unit.rent=0;unit.arrears=0;unit.missedDays=0;
        if(unit.occupantId===building.accountId)unit.occupantId=null;
      }
    }
  }
  shareHome(c, partner, reason = 'partner') {
    const home=this.home(partner);
    if(!home || partner.homeShareWith===c.id || reason==='friend' && (partner.homeShareWith || !this.city.relationships.canShareHome(partner,c) || this.residents(home).length>=4))return false;
    this.release(c);
    c.homeShareReason=reason;c.homeShareWith=partner.homeShareWith||partner.id;c.homeId=home.id;c.homeUnitId=partner.homeUnitId;
    this.invalidateResidents();
    c.homelessSince=null;c.task=null;c.path=[];
    for(const child of this.city.citizens.filter(p=>p.guardianId===c.id && !this.city.society.isAdult(p)))this.houseChild(child,c);
    this.city.history.record('housing',`${c.entity.properties.name} passou a compartilhar moradia com ${partner.entity.properties.name}.`,[c.accountId,this.city.building(home.buildingId)?.accountId],{homeId:home.id,regime:this.isSocial(home)?'social':'shared'});
    return true;
  }
  grantSocialHome(c,home) {
    const city=this.city,units=this.units(home),building=city.building(home.buildingId);
    if(!city.society.isAdult(c) || !this.isSocial(home) || !this.hasBathroom(home) || !units.some(u=>u.roomType==='bedroom') || units.some(u=>u.tenantId) || this.residents(home).length || city.findPath(c.entity,building.door)===null)return false;
    this.release(c);
    for(const unit of units){unit.tenantId=c.accountId;unit.occupantId=null;unit.rentPayerId=null;unit.arrears=0;unit.missedDays=0;}
    c.homeId=home.id;c.homeUnitId=units.find(u=>u.roomType==='bedroom').id;c.homelessSince=null;c.task=null;c.path=[];
    this.invalidateResidents();
    for(const child of city.citizens.filter(p=>p.guardianId===c.id && !city.society.isAdult(p)))this.houseChild(child,c);
    const partner=city.society.citizen(c.partnerId);if(partner && !partner.homeUnitId)this.shareHome(partner,c);
    const message=`${c.entity.properties.name} recebeu ocupação gratuita em ${building.entity.properties.name}; o imóvel continua público.`;
    city.history.record('housing',message,[c.accountId,building.accountId,'treasury'],{homeId:home.id,regime:'social',amount:0});
    city.log(message,'housing',[c.id],{kind:'social-housing-assigned',homeId:home.id,buildingId:building.id});return true;
  }
  assignSocialHomes() {
    const city=this.city;
    const waiting=city.citizens.filter(c=>!c.entity.destroyed && city.society.isAdult(c) && !c.homeUnitId);
    if(!waiting.length)return;
    for(const c of waiting)c.homelessSince??=city.minute;
    const counts=new Map();for(const person of city.citizens)if(!person.entity.destroyed&&!city.society.isAdult(person))counts.set(person.guardianId,(counts.get(person.guardianId)||0)+1);
    const priorities=new Map(waiting.map(c=>[c.id,{dependents:(counts.get(c.id)||0)+(c.partnerId!==c.id?(counts.get(c.partnerId)||0):0),means:c.balance+city.bank.savings(c.accountId)}]));
    const dependents=c=>priorities.get(c.id).dependents;
    const means=c=>priorities.get(c.id).means;
    waiting.sort((a,b)=>dependents(b)-dependents(a)||means(a)-means(b)||a.homelessSince-b.homelessSince||a.id-b.id);
    const vacant=[...this.homes.values()].filter(h=>this.isSocial(h) && this.hasBathroom(h) && this.units(h).every(u=>!u.tenantId) && !this.residents(h).length);
    for(const c of waiting) {
      if(c.homeUnitId)continue;
      const partner=city.society.citizen(c.partnerId);
      if(partner?.homeUnitId && this.shareHome(c,partner))continue;
      for(let i=0;i<vacant.length;i++)if(this.grantSocialHome(c,vacant[i])){vacant.splice(i,1);break;}
    }
  }
  release(c) {
    const home = this.home(c), units = home ? this.units(home) : [this.city.units.get(c.homeUnitId)].filter(Boolean);
    for (const u of units) if (u.tenantId === c.accountId) { u.tenantId = null; u.rentPayerId = null; u.arrears = 0; u.missedDays = 0; }
    c.homeUnitId = null; c.homeId = null; c.homeShareWith = null;c.homelessSince??=this.city.minute;
    if (home) for (const resident of this.city.citizens.filter(p => p.homeId === home.id && (p.guardianId === c.id || p.homeShareWith === c.id))) { resident.homeId = null; resident.homeUnitId = null; resident.homeShareWith = null; }
    this.invalidateResidents();
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
    this.invalidateResidents();
    this.city.log(`${c.entity.properties.name} passou a morar em ${home.id}, com ${units.length} cômodos.`, 'housing', [c.id], { kind: 'home-lease', homeId: home.id, rent });
    for (const child of this.city.citizens.filter(p => p.guardianId === c.id && !this.city.society.isAdult(p))) this.houseChild(child, c);
    return true;
  }
  buyHome(c, home) {
    const units = this.units(home), total = this.price(home);
    if (this.isSocial(home) || !units.length || units.some(u => !u.forSale || u.ownerId === c.accountId) || c.balance < total + this.city.currency.price(HOUSING_RULES.livingReserve)) return false;
    for (const u of units) if (!this.city.buyUnit(c.id, u.id)) throw Error('Compra de moradia mudou durante transação síncrona.');
    return true;
  }
  houseChild(child, parent) {
    const home = this.home(parent); if (!home) return false;
    if (child.homeUnitId && child.homeUnitId !== parent.homeUnitId) this.release(child);
    if(child.homeId!==home.id)this.invalidateResidents();
    child.guardianId = parent.id; child.homeId = home.id; child.homeUnitId = parent.homeUnitId; return true;
  }
  market() {
    this.configureSocialHousing();
    for (const home of this.homes.values()) {
      const units = this.units(home), b = this.city.building(home.buildingId); if (!b || !units.length) continue;
      const builder = this.city.accounts.get(units[0].ownerId);
      if (builder?.type === 'builder' && units.every(u => u.ownerId === builder.accountId) && this.city.minute - home.createdAt >= HOUSING_RULES.unsoldRentalAfter) for (const u of units) { u.forSale = true; u.forRent = true; }
    }
  }
  assign() {
    this.market();
    this.assignSocialHomes();
    for (const c of this.city.citizens) {
      if (c.entity.destroyed) continue;
      if (!this.city.society.isAdult(c)) { const parent = this.city.society.guardian(c); if (parent) this.houseChild(c, parent); continue; }
      const partner = this.city.society.citizen(c.partnerId), partnerHome = partner && this.home(partner);
      if (partnerHome && c.homeId !== partnerHome.id && (!this.home(c) || partner.id<c.id)) this.shareHome(c,partner);
      if(c.homeShareWith){const host=this.city.society.citizen(c.homeShareWith),shared=this.home(c);const permitted=host && shared && host.homeId===c.homeId && (partner?.homeId===c.homeId || this.city.relationships.canShareHome(host,c));if(!permitted){this.release(c);c.homeShareWith=null;}}
      if(!this.home(c))for(const relation of this.city.society.relationsFor(c.id).slice(0,6)){const friend=this.city.society.citizen(relation.a===c.id?relation.b:relation.a);if(friend && this.home(friend) && this.shareHome(c,friend,'friend'))break;}
      const current = this.home(c);
      if (current && this.hasBathroom(current)) continue;
      const candidates = [...this.homes.values()].filter(h => this.city.building(h.buildingId) && this.units(h).every(u => !u.tenantId || u.tenantId === c.accountId));
      candidates.sort((a, b) => Number(this.hasBathroom(b)) - Number(this.hasBathroom(a)) || this.rent(a,c)*(1-.25*colorAffinity(c,this.homeColor(a)))-this.rent(b,c)*(1-.25*colorAffinity(c,this.homeColor(b))));
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
    const city=this.city,investors=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)),homes=[...this.homes.values()],unhoused=investors.reduce((n,c)=>n+Number(!c.homeUnitId),0),demand=unhoused>0,targetRental=Math.max(2,Math.ceil(unhoused/4));
    let rentalUnits=homes.filter(h=>!this.isSocial(h)&&this.units(h).every(u=>u.forRent&&!u.tenantId)).length;
    const ownedHomes=new Map();for(const home of homes){const owner=this.units(home).find(u=>u.ownerId!=='treasury')?.ownerId;if(owner)ownedHomes.set(owner,(ownedHomes.get(owner)||0)+1);}
    for (const c of investors) {
      if (!c.homeUnitId) {
        let home=null,best=Infinity;for(const candidate of homes){if(this.isSocial(candidate))continue;const units=this.units(candidate);if(!units.length||!units.every(u=>u.forSale&&!u.tenantId&&u.ownerId!==c.accountId))continue;const price=this.price(candidate);if(price+60000>=c.balance)continue;const score=price*(1-.25*colorAffinity(c,this.homeColor(candidate)));if(score<best){best=score;home=candidate;}}
        if(home&&this.buyHome(c,home)&&this.rentHome(c,home))ownedHomes.set(c.accountId,(ownedHomes.get(c.accountId)||0)+1);
      }
      if(!demand)continue;
      const personHomes=ownedHomes.get(c.accountId)||0;
      const landlord=c.homeUnitId&&(c.rentalPreference>=.76||c.businessIds.length>0||c.landlordSince!=null);
      if(!landlord||personHomes>=6||rentalUnits>=targetRental)continue;
      for (const home of homes) {
        const units=this.units(home),price=this.price(home);if(this.isSocial(home)||!units.length||!units.every(u=>u.forSale&&!u.tenantId&&u.ownerId!==c.accountId))continue;
        let loan=null;
        if(price+this.city.currency.price(65000)>c.balance){
          const downPayment=Math.ceil(price*.25),needed=price-downPayment,banks=this.city.bank.available();
          if(c.balance<downPayment+this.city.currency.price(HOUSING_RULES.livingReserve))continue;
          for(const bank of banks){loan=this.city.bank.mortgage(bank,c,needed,{homeId:home.id});if(loan)break;}
          if(!loan)continue;
        }
        if(this.buyHome(c,home)){
          for(const u of units){u.forRent=true;u.forSale=false;}
          c.landlordSince??=this.city.minute;c.landlordPortfolio??=[];if(!c.landlordPortfolio.includes(home.id))c.landlordPortfolio.push(home.id);
          ownedHomes.set(c.accountId,personHomes+1);rentalUnits++;
          this.city.history.record('property',`${c.entity.properties.name} comprou uma moradia para alugar${loan?' com financiamento imobiliário':''}.`,[c.accountId],{kind:'landlord-acquisition',homeId:home.id,buildingId:home.buildingId,amount:price,loanId:loan?.id||null});
          this.city.log(`${c.entity.properties.name} entrou no mercado de aluguel e colocou ${units.length} cômodos disponíveis.`, 'housing',[c.id],{kind:'landlord-acquisition',homeId:home.id,buildingId:home.buildingId,units:units.length,loanId:loan?.id||null});
          break;
        }
        if(loan)this.city.bank.cancelMortgage(loan);
      }
    }
    this.developRentalProperty();
  }
  developRentalProperty(){
    const city=this.city,unhoused=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!c.homeUnitId).length;
    if(!unhoused||this.lastRentalDevelopmentDay===city.day)return false;
    const vacant=[...this.homes.values()].filter(h=>!this.isSocial(h)&&this.units(h).every(u=>!u.tenantId&&(u.forRent||u.forSale))).length;
    const planned=city.development.projects.filter(p=>p.type==='residential'&&!p.cancelled&&p.status!=='completed').length;
    if(unhoused<=vacant+planned)return false;
    this.lastRentalDevelopmentDay=city.day;
    const investors=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&c.homeUnitId&&(c.landlordSince!=null||c.rentalPreference>=.89||c.businessIds.length&&c.rentalPreference>=.78))
      .filter(c=>c.creditAllowed!==false&&!city.politics.officeHolder(c)&&[...this.homes.values()].filter(h=>this.units(h).some(u=>u.ownerId===c.accountId)).length<3)
      .sort((a,b)=>((b.skills.management||0)+b.rentalPreference*30+b.balance/100000)-((a.skills.management||0)+a.rentalPreference*30+a.balance/100000)||a.id-b.id);
    const plots=city.development.plots.filter(p=>p.ownerId==='treasury'&&p.forSale&&!p.buildingId&&!p.projectId&&p.width>=2&&p.depth>=2&&p.width<=8&&p.depth<=8&&!['farm','quarry'].includes(p.type)).sort((a,b)=>Math.abs(a.width*a.depth-4)-Math.abs(b.width*b.depth-4)||a.price-b.price);
    for(const owner of investors)for(const plot of plots){
      const width=Math.min(2,plot.width),depth=Math.min(2,plot.depth),floors=2,cells=width*depth*floors,stone=cells*DEVELOPMENT_RULES.stonePerCell;
      const constructionFee=cells*city.currency.price(DEVELOPMENT_RULES.constructionFeePerCell),materialBudget=stone*city.economy.goods.pedra.price+city.currency.price(24000);
      const budget=plot.price+stone*city.economy.goods.pedra.price+constructionFee+city.currency.price(20000)+materialBudget;
      let loan=null;const deficit=Math.max(0,budget-owner.balance);
      if(deficit){city.bank.developmentBanks();for(const bank of city.bank.available()){loan=city.bank.lendForBusiness(bank,owner,deficit,{type:'residential',score:82,budget});if(loan)break;}if(!loan)continue;}
      if(!city.development.buyPlot(owner.accountId,plot.id)){if(loan)city.bank.cancelBusinessLoan(loan);continue;}
      const project=city.development.beginProject(owner.accountId,plot.id,'residential',{width,depth,floors,sell:false,priority:65});
      if(!project){city.transfer('treasury',owner.accountId,plot.price,'Estorno de terreno: projeto de aluguel não iniciado');plot.ownerId='treasury';plot.forSale=true;if(loan)city.bank.cancelBusinessLoan(loan);continue;}
      project.landlordDevelopment=true;project.priority=65;
      if(loan){loan.projectId=project.id;loan.propertyDevelopment=true;loan.purpose='mortgage';loan.installments=1440;loan.dailyPayment=Math.ceil(loan.remaining/1440);loan.rate=.00015;project.loanId=loan.id;}
      owner.landlordSince??=city.minute;city.history.record('property','Investidor financiou uma construção residencial para oferecer novos aluguéis.',[owner.accountId,loan?.bankId?`business:${loan.bankId}`:null].filter(Boolean),{kind:'landlord-development',projectId:project.id,plotId:plot.id,amount:budget,loanId:loan?.id||null});
      city.log(`${owner.entity.properties.name} financiou um prédio residencial para ampliar a oferta de aluguel.`, 'housing',[owner.id],{kind:'landlord-development',projectId:project.id,plotId:plot.id,loanId:loan?.id||null,floors});return true;
    }
    return false;
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
  reconcile() {
    if(this.rentPolicyVersion!==2){for(const home of this.homes.values()){const b=this.city.building(home.buildingId);if(!b||!HOUSING_TYPES.includes(b.type))continue;const cap=this.city.currency.price(HOUSING_RULES.roomRent*(b.type==='luxury_housing'?2:1));for(const unit of this.units(home))if(unit.rent>cap){unit.rent=cap;unit.arrears=0;unit.missedDays=0;}}this.rentPolicyVersion=2;}
    for (const [id, h] of this.homes) if (!this.city.building(h.buildingId)) this.homes.delete(id);
    for(const b of this.city.buildings)if(b.type==='super_popular_housing'&&b.units.length){
      const bathroom=b.units.find(u=>u.id===b.sharedBathroomUnitId&&u.roomType==='bathroom')||b.units.filter(u=>u.roomType==='bathroom').sort((a,b)=>a.z-b.z)[0];
      if(!bathroom)continue;b.sharedBathroomUnitId=bathroom.id;
      for(const u of b.units)if(u.roomType==='bathroom'&&u!==bathroom){u.roomType='bedroom';configureRoomWindow(b,u);b.layoutRevision=(b.layoutRevision||0)+1;this.city.sanitation.facilities.delete(`toilet:${u.id}`);}
      const homes=[...this.homes.values()].filter(h=>h.buildingId===b.id);for(const h of homes)h.bathroomUnitId=bathroom.id;
      const facility=this.city.sanitation.facilities.get(`toilet:${bathroom.id}`);if(facility)facility.homeIds=homes.map(h=>h.id);
    }
  }
}
