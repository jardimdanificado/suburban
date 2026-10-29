import {initializeInventory,inventoryFree} from './city_inventory.js';
import {officeFloors} from './city_offices.js?v=office-demand-rollout-1';
import {partyCapsHourly,seedPartyCaps,returnPartyCap} from './city_party_caps.js?v=party-caps-skin-1';
import {moveGarments} from './city_clothing.js?v=party-caps-skin-1';

export function headquartersAccount(p,party){
 const city=p.city,account=p.partyAccount(party);if(!account.inventory)initializeInventory(account,city.economy.goods,160);
 account.id=account.accountId;account.type='party-headquarters';account.active=party.active;account.partyId=party.id;
 const secretId=party.secretAccountId??=`party-secret:${party.id}`;if(!city.accounts.has(secretId))city.accounts.set(secretId,{accountId:secretId,name:`Caixa clandestino: ${party.name}`,balance:0,partyId:party.id,headquarters:true});
 return account;
}
function releaseLocation(city,party){
 const h=party.headquarters;if(!h)return;
 if(h.kind==='office'){const tower=city.building(h.buildingId);for(const u of tower?.units||[])if(u.z===h.floor&&u.occupantId===party.accountId){u.occupantId=null;u.forRent=true;}}
 else {const unit=city.units.get(h.unitId);if(unit?.partyHeadquartersIds)unit.partyHeadquartersIds=unit.partyHeadquartersIds.filter(id=>id!==party.id);}
 if(h.flagEntity)h.flagEntity.destroyed=true;
}
function assign(p,party,b,unit,floor,kind,rent=0){
 const city=p.city,account=headquartersAccount(p,party);releaseLocation(city,party);
 if(kind==='office')for(const u of b.units.filter(u=>u.z===floor)){u.occupantId=party.accountId;u.forRent=false;}
 else {unit.partyHeadquartersIds??=[];if(!unit.partyHeadquartersIds.includes(party.id))unit.partyHeadquartersIds.push(party.id);}
 const h={kind,buildingId:b.id,unitId:unit.id,floor,rent,startedAt:city.minute,lastRentDay:city.day,arrears:0,missedDays:0};
 account.door={...b.door};account.buildingId=b.id;account.headquartersUnitId=unit.id;account.name=`Sede e fundo: ${party.name}`;
  h.flagEntity=null;party.headquarters=h;
 party.history.push(Object.freeze({minute:city.minute,description:`Sede ${kind==='office'?'alugada':'provisória'} em ${b.entity.properties.name}, ${floor+1}º andar.`}));
  city.log(`${party.short} instalou sua sede em ${b.entity.properties.name}.`,'government',party.leaderId?[party.leaderId]:[],{kind:'party-headquarters',partyId:party.id,buildingId:b.id,floor,unitId:unit.id,rent});return h;
}
export function ensureHeadquarters(p,party){
 if(!party?.active)return null;const city=p.city,account=headquartersAccount(p,party),current=party.headquarters,host=current&&city.building(current.buildingId);
 if(host&&!host.entity.destroyed&&city.units.has(current.unitId)){if(current.flagEntity){current.flagEntity.destroyed=true;current.flagEntity=null;}return current;}
 if(account.incoming&&Object.values(account.incoming).some(n=>n>0))for(const shipment of city.logistics.shipments)if(shipment.buyer===account&&!['delivered','cancelled'].includes(shipment.status))city.logistics.cancel(shipment);
 const hall=city.buildings.find(b=>b.type==='townhall'&&!b.entity.destroyed);if(!hall)return null;
 const choices=hall.units.filter(u=>u.roomType==='workspace'||u.roomType==='office');const unit=choices.sort((a,b)=>(a.partyHeadquartersIds?.length||0)-(b.partyHeadquartersIds?.length||0))[0]||hall.units[0];if(!unit)return null;
 return assign(p,party,hall,unit,unit.z,'provisional');
}
export function leaseHeadquarters(p,partyId,towerId,floor){
 const city=p.city,party=p.party(partyId),tower=city.building(towerId);if(!party?.active||!tower?.active||tower.entity.destroyed||tower.type!=='office_tower')return city.fail('Partido ou empresarial indisponível.');
 const account=headquartersAccount(p,party),row=officeFloors(city,tower).find(r=>r.floor===floor);if(!row||row.tenantId||!row.units.length||!row.units.every(u=>u.forRent))return city.fail('Andar indisponível.');
 if(Object.values(account.incoming).some(n=>n>0))return city.fail('A mudança exige a conclusão ou o cancelamento das entregas pendentes.');
 const rent=Math.max(city.currency.price(100),row.rent);if(account.balance<rent||!city.transfer(account.accountId,tower.accountId,rent,'Primeiro aluguel de sede partidária',{partyId,buildingId:tower.id,floor}))return city.fail('O fundo partidário não cobre o primeiro aluguel.');tower.totalRevenue+=rent;
 return assign(p,party,tower,row.units[0],floor,'office',rent);
}
export function headquartersHourly(p){
 const city=p.city;sellLiquidatedCaps(city);for(const party of p.parties.filter(p=>p.active)){
  const h=ensureHeadquarters(p,party);if(!h)continue;const account=headquartersAccount(p,party);
  seedPartyCaps(p,party);
  partyCapsHourly(p,party);
  if(h.kind==='office'&&h.lastRentDay!==city.day){h.lastRentDay=city.day;const landlord=city.building(h.buildingId),amount=h.rent+h.arrears;if(landlord?.active&&city.transfer(account.accountId,landlord.accountId,amount,'Aluguel de sede partidária',{partyId:party.id,buildingId:landlord.id,floor:h.floor})){landlord.totalRevenue+=amount;h.arrears=0;h.missedDays=0;}else{h.arrears+=h.rent;h.missedDays++;if(h.missedDays>=3){releaseLocation(city,party);party.headquarters=null;ensureHeadquarters(p,party);}}}
  if(h.kind==='provisional'&&!Object.values(account.incoming).some(n=>n>0)){
   const tower=city.economy.businesses.find(b=>b.type==='office_tower'&&officeFloors(city,b).some(f=>!f.tenantId&&f.units.every(u=>u.forRent)&&account.balance>=f.rent*3));const row=tower&&officeFloors(city,tower).find(f=>!f.tenantId&&f.units.every(u=>u.forRent)&&account.balance>=f.rent*3);if(row)leaseHeadquarters(p,party.id,tower.id,row.floor);
  }
 }
}
function sellLiquidatedCaps(city){
 const hall=city.buildings.find(b=>b.type==='townhall'&&!b.entity.destroyed),caps=hall?.garments?.filter(g=>g.liquidatedPartyId!=null)||[];if(!caps.length)return;
 const price=Math.max(1,Math.floor(city.economy.goods.roupas.price*.05));
 for(const shop of city.economy.businesses.filter(b=>b.type==='thrift_store'&&b.active&&!b.entity.destroyed&&inventoryFree(b)>0)){
  const quantity=Math.min(caps.length,inventoryFree(shop),city.logistics.transportLimit(hall,shop),24);if(!quantity)continue;
  if(city.logistics.order(hall,shop,'roupas',quantity,price,{payerAccountId:shop.accountId,purpose:'liquidated-party-caps',garmentIds:caps.slice(0,quantity).map(g=>g.garmentId)}))break;
 }
}
export function stockHeadquarters(p,election){
 const city=p.city;if(!election||election.status!=='campaign')return;
 for(const party of p.parties.filter(p=>p.active)){
  const h=ensureHeadquarters(p,party),holder=headquartersAccount(p,party);if(!h||!holder.door)continue;
  for(const [good,target] of [['bandeiras',3],['panfletos',6],['faixas',2]]){
   const missing=target-(holder.inventory[good]||0)-(holder.incoming[good]||0);if(missing<=0||inventoryFree(holder)<=0)continue;
   const shop=city.economy.businesses.find(b=>b.active&&!b.entity.destroyed&&(b.inventory[good]||0)>0);if(!shop)continue;
   const quantity=Math.min(missing,shop.inventory[good],inventoryFree(holder)),price=city.economy.goods[good].price;
   city.logistics.order(shop,holder,good,quantity,price,{payerAccountId:holder.accountId,purpose:'campaign-headquarters'});
  }
 }
}
export function closeHeadquarters(p,party){
 const city=p.city,account=headquartersAccount(p,party);for(const s of city.logistics.shipments)if(s.buyer===account&&!['delivered','cancelled'].includes(s.status))city.logistics.cancel(s);
 for(const citizen of city.citizens)if(citizen.wardrobe?.some(g=>g.partyOwnerId===party.id))returnPartyCap(p,party,citizen);
 for(const tailor of city.economy.businesses)if(tailor.type==='tailor'){for(const order of tailor.partyCapOrders||[])if(order.partyId===party.id)order.remaining=0;for(const g of tailor.garments||[])if(g.reservedPartyId===party.id)delete g.reservedPartyId;}
 const hall=city.buildings.find(b=>b.type==='townhall'&&!b.entity.destroyed);
 if(hall){const caps=(account.garments||[]).filter(g=>g.partyOwnerId===party.id||g.reservedPartyId===party.id);for(const g of caps){g.liquidatedPartyId=party.id;g.liquidatedPartyName=party.name;delete g.partyOwnerId;delete g.reservedPartyId;g.ownerHistory??=[];g.ownerHistory.push({ownerId:hall.accountId,ownerName:'Prefeitura',minute:city.minute,event:'liquidação do partido'});}hall.inventoryCapacity=Math.max(hall.inventoryCapacity,hall.inventoryCapacity+Math.max(0,caps.length-inventoryFree(hall)));if(caps.length){hall.inventory.roupas+=caps.length;account.inventory.roupas-=caps.length;moveGarments(account,hall,caps.length,caps.map(g=>g.garmentId));}}
 for(const [good,q] of Object.entries(account.inventory)){if(!q)continue;const keep=hall?Math.min(q,inventoryFree(hall)):0;if(keep){hall.inventory[good]+=keep;if(good==='roupas')moveGarments(account,hall,keep);city.publications.moveStock(account,hall,good,keep);city.paint.move(account,hall,good,keep);}if(q>keep){if(good==='roupas')account.garments?.splice(0,q-keep);city.publications.loseStock(account,good,q-keep);city.economy.lost[good]+=q-keep;}account.inventory[good]=0;}
 const secret=city.accounts.get(party.secretAccountId);if(secret?.balance)city.transfer(secret.accountId,'treasury',secret.balance,'Liquidação de caixa clandestino',{partyId:party.id});releaseLocation(city,party);party.headquarters=null;account.active=false;
}
