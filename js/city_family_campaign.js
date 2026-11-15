import {apply as applyForJob} from './city_employment.js';
import {inventoryFree} from './city_inventory.js';

export const FAMILY_STARTS = {
  worker: {label:'Trabalhador', capital:150000, description:'Reserva de R$ 1.500. Construa sua renda pelo trabalho e pelos fretes.'},
  artisan: {label:'Artesão', capital:1200000, description:'Capital de R$ 12.000. Invista em produção e assuma os custos de uma empresa.'},
  merchant: {label:'Comerciante', capital:800000, description:'Capital de R$ 8.000. Compre mercadorias, encontre compradores e organize entregas.'},
};
export const FAMILY_BUSINESSES = ['farm','bakery','market','carrier','builder','cleaner'];
const DAY = 1440;
const alive = c => c && !c.entity.destroyed && !c.migrationDeparted;
const open = r => r.status === 'active';
export function familyMembers(city) {
  const state=city.familyCampaign;
  return state ? state.memberIds.map(id=>city.society.citizen(id)).filter(alive) : [];
}
export function familyBusinesses(city) {
  const ids=new Set(familyMembers(city).map(c=>c.id));
  return city.economy.businesses.filter(b=>b.active&&!b.entity.destroyed&&ids.has(b.ownerId));
}
function remember(city, text) {
  const s=city.familyCampaign;
  s.journal.push({minute:city.minute,text});
  if(s.journal.length>60)s.journal.shift();
  city.log(text,'business',[s.leaderId],{kind:'family-campaign'});
}
function refreshFamily(city) {
  const s=city.familyCampaign;
  // A partner joins by an existing reciprocal relationship. Descendants remain
  // members across death, separation, and the simulation's inheritance process.
  for(const id of [...s.memberIds]){
    const c=city.society.citizen(id);if(!c)continue;
    const partner=city.society.citizen(c.partnerId);
    const relatives=[...(c.childIds||[]),...(alive(partner)&&partner.partnerId===c.id?[partner.id]:[])];
    for(const next of relatives)if(!s.memberIds.includes(next))s.memberIds.push(next);
    c.playerPoliticalAmbition??=city.politics.officeHolder(c);
    c.playerManaged=true;
  }
  for(const c of familyMembers(city)){c.playerPoliticalAmbition??=city.politics.officeHolder(c);c.playerManaged=true;}
}
export function familyOffers(city) {
  if(!city.familyCampaign)return [];
  const s=city.familyCampaign,day=Math.floor(city.minute/DAY),offers=[];
  const add=(buyer,good,quantity,label)=>{
    if(!buyer?.active||buyer.entity.destroyed||!city.economy.goods[good]||!(good in buyer.inventory))return;
    quantity=Math.min(quantity,inventoryFree(buyer));if(quantity<2)return;
    const id=`${day}:${buyer.id}:${good}`;
    if(s.contracts.some(r=>r.offerId===id))return;
    const unitPrice=Math.ceil(city.economy.goods[good].price*1.15);
    const payer=buyer.municipal||buyer.type==='townhall'?'treasury':buyer.accountId;
    const budget=quantity*unitPrice+city.currency.price(12000);
    if((city.accounts.get(payer)?.balance||0)<budget)return;
    offers.push({id,buyerId:buyer.id,good,quantity,unitPrice,budget,payer,label,expiresAt:(day+1)*DAY});
  };
  // Public food purchases are finite, budgeted stock, not an infinite export sink.
  const ownIds=new Set(familyBusinesses(city).map(b=>b.id));
  const hall=city.townhall();
  for(const good of ['milho','trigo','maca'])if(hall&&(hall.inventory[good]||0)+(hall.incoming[good]||0)<48)add(hall,good,6,'Reserva alimentar do município');
  for(const b of city.economy.businesses){
    if(ownIds.has(b.id))continue;
    for(const [good,need] of Object.entries(b.inputDemand||{}))if(need>=2)add(b,good,Math.min(6,Math.floor(need)),'Abastecimento local');
  }
  return offers.slice(0,18);
}
function settleContract(city, r, status, reason) {
  if(!open(r))return;
  // Cancel through logistics before refunding the remaining contract budget.
  // This releases cargo, incoming space, drivers, and shipment escrow together.
  if(status!=='completed')for(const shipment of city.logistics.shipments)if(shipment.familyContractId===r.id&&!['delivered','cancelled'].includes(shipment.status))city.logistics.cancel(shipment);
  const escrow=city.accounts.get(r.accountId);
  if(escrow?.balance)city.transfer(r.accountId,r.payer,escrow.balance,'Devolução de reserva de contrato familiar',{familyContractId:r.id});
  r.status=status;r.closedAt=city.minute;r.reason=reason;
  const leader=city.society.citizen(r.ownerId);
  city.reputation.observe(leader?.accountId,'commerce',status==='completed'?4:-4,reason,{familyContractId:r.id});
  remember(city,`Contrato #${r.id}: ${reason}`);
}
export function updateFamilyCampaign(city) {
  const s=city.familyCampaign;if(!s)return;
  refreshFamily(city);
  const members=familyMembers(city),leader=city.society.citizen(s.leaderId);
  if(!alive(leader)){
    const heir=members.find(c=>c.id===s.heirId&&city.society.isAdult(c))||members.find(c=>city.society.isAdult(c));
    if(heir){s.leaderId=heir.id;s.generation++;remember(city,`${heir.entity.properties.name} assumiu a liderança da família. A herança segue as regras da cidade.`);}
    else if(!members.length&&s.status!=='ended'){s.status='ended';remember(city,'A família não possui sobreviventes. Inicie outra cidade para uma nova campanha.');}
  }
  for(const r of s.contracts.filter(open)){
    // Keep a cumulative count: normal logistics prunes old completed shipments.
    for(const shipment of city.logistics.shipments){
      if(shipment.familyContractId!==r.id||shipment.status!=='delivered'||shipment.completedAt>r.deadline||r.counted.includes(shipment.id))continue;
      r.counted.push(shipment.id);r.delivered+=shipment.quantity;r.revenue+=shipment.cost;
    }
    if(r.delivered>=r.quantity)settleContract(city,r,'completed','Entrega concluída e pagamento recebido.');
    else if(city.minute>=r.deadline)settleContract(city,r,'failed','Prazo vencido; saldo reservado devolvido ao cliente.');
    else if(city.building(r.buyerId)?.entity.destroyed||!city.building(r.buyerId))settleContract(city,r,'cancelled','Cliente indisponível; contrato encerrado.');
  }
  const companies=familyBusinesses(city),completed=s.contracts.filter(r=>r.status==='completed').length;
  const liquid=members.reduce((n,c)=>n+c.balance,0),housed=members.length>0&&members.every(c=>!!c.homeUnitId);
  const healthy=members.length>0&&members.every(c=>c.needs.food>=40&&c.needs.health>=40);
  const solvent=companies.some(b=>b.balance>=Math.max(city.currency.price(1000),b.wage*Math.max(1,b.workers.length)*480));
  const conditions=completed>=3&&housed&&healthy&&solvent&&liquid>=city.currency.price(30000);
  if(!conditions)s.stableSince=null;else s.stableSince??=city.minute;
  if(s.wonAt==null&&s.stableSince!=null&&city.minute-s.stableSince>=DAY){s.wonAt=city.minute;s.status='won';remember(city,'Bairro conquistado: três contratos cumpridos, família abrigada e reservas mantidas por um dia. A partida continua.');}
  s.progress={completed,housed,healthy,solvent,liquid,stableMinutes:s.stableSince==null?0:city.minute-s.stableSince};
}
function selectedMember(city, options) {
  return familyMembers(city).find(c=>c.id===(options.citizenId??city.familyCampaign.leaderId)&&city.society.isAdult(c));
}
export function familyAction(city, action, options={}) {
  city.lastError='';
  if(!options||typeof options!=='object')return city.fail('Opções inválidas.');
  if(action==='start'){
    if(city.mayorCampaign?.mode==='play')return city.fail('Encerre o modo prefeito antes de iniciar uma campanha familiar.');
    if(city.familyCampaign)return city.fail('Esta cidade já possui uma campanha familiar.');
    const c=city.society.citizen(options.citizenId),profile=Object.hasOwn(FAMILY_STARTS,options.profile)?FAMILY_STARTS[options.profile]:null;
    if(!alive(c)||!city.society.isAdult(c)||city.politics.officeHolder(c)||!profile)return city.fail('Escolha um adulto sem cargo público e uma origem.');
    const capital=city.currency.price(profile.capital);
    if(city.treasury<capital)return city.fail('O tesouro não possui o capital inicial desta origem. Escolha outra origem.');
    if(!city.transfer('treasury',c.accountId,capital,'Capital inicial da campanha familiar',{profile:options.profile}))return false;
    city.familyCampaign={version:1,leaderId:c.id,memberIds:[c.id],heirId:null,profile:options.profile,generation:1,startedAt:city.minute,status:'active',contracts:[],nextContractId:1,journal:[],stableSince:null,wonAt:null,progress:{}};
    refreshFamily(city);remember(city,`${c.entity.properties.name} iniciou a campanha ${profile.label.toLowerCase()}. Capital transferido do tesouro: ${(capital/100).toFixed(2)}.`);
    updateFamilyCampaign(city);return true;
  }
  const state=city.familyCampaign;if(!state||state.status==='ended')return city.fail('Inicie uma campanha com uma família viva.');
  refreshFamily(city);
  const c=selectedMember(city,options);
  if(!c)return city.fail('Escolha um adulto vivo da sua família.');
  const company=city.building(options.buildingId),owned=familyBusinesses(city).find(b=>b.id===options.buildingId);
  switch(action){
    case 'politics':c.playerPoliticalAmbition=options.enabled===true;remember(city,`${c.entity.properties.name} ${c.playerPoliticalAmbition?'passou a aceitar candidaturas e cargos públicos':'deixou de buscar novos cargos públicos'}.`);return true;
    case 'heir':state.heirId=c.id;remember(city,`${c.entity.properties.name} foi escolhido para a sucessão.`);return true;
    case 'apply':
      if(!company?.active||company.entity.destroyed||company.workers.length>=company.jobs||c.jobId)return city.fail('Vaga indisponível ou familiar já empregado.');
      return applyForJob(city,c,company)||city.fail('Não foi possível candidatar-se. Confira os requisitos e as entrevistas pendentes.');
    case 'leaveJob':
      if(!c.jobId)return city.fail('Este familiar não possui emprego.');
      city.economy.leaveJob(c,'Decisão da família');return true;
    case 'found':
      if(!FAMILY_BUSINESSES.includes(options.type))return city.fail('Atividade indisponível na campanha.');
      return city.economy.foundBusiness(c.id,options.type,options.type==='farm'?(options.crop||'milho'):null,{compact:true})||city.fail(city.lastError||'Capital, instalações ou terreno insuficientes. Consulte Terrenos e obras.');
    case 'buyPlot':return city.development.buyPlot(c.accountId,options.plotId);
    case 'build':{
      if(options.type!=='residential'&&city.politics.officeHolder(c))return city.fail('Este cargo público impede administrar uma nova empresa.');
      if(![...FAMILY_BUSINESSES,'residential'].includes(options.type))return city.fail('Tipo de obra indisponível.');
      const plot=city.development.plots.find(p=>p.id===options.plotId);
      if(!plot||plot.ownerId!==c.accountId)return city.fail('O terreno deve pertencer ao familiar escolhido.');
      return city.development.beginProject(c.accountId,plot.id,options.type,{width:2,depth:2,floors:options.type==='residential'?2:1,crop:options.type==='farm'?(options.crop||'milho'):null})||city.fail(city.lastError||'Obra indisponível: confira capital, terreno e construtora.');
    }
    case 'home':{
      const home=city.housing.homes.get(options.homeId);if(!home)return city.fail('Moradia indisponível.');
      if(options.buy&&!city.housing.buyHome(c,home))return city.fail('Compra indisponível: confira saldo, reserva pessoal e oferta.');
      return city.housing.rentHome(c,home)||city.fail('Ocupação indisponível: confira aluguel, ocupantes e oferta.');
    }
    case 'fund':{
      if(!owned)return city.fail('Selecione uma empresa da família.');
      const amount=options.amount;if(!Number.isSafeInteger(amount)||amount<1)return city.fail('Valor inválido.');
      return city.transfer(c.accountId,owned.accountId,amount,'Aporte familiar de capital');
    }
    case 'employment':
      if(!owned)return city.fail('Selecione uma empresa da família.');
      return city.economy.configureEmployment(owned.id,{baseWage:options.baseWage,allowTraining:options.allowTraining});
    case 'buyStock':{
      if(!owned)return city.fail('Selecione uma empresa da família.');
      const seller=city.building(options.sellerId),good=options.good,quantity=options.quantity;
      if(!seller||!city.economy.goods[good]||!Number.isSafeInteger(quantity)||quantity<1||quantity>6)return city.fail('Fornecedor, produto ou quantidade inválidos.');
      return city.logistics.order(seller,owned,good,quantity,city.economy.goods[good].price)||city.fail('Compra indisponível: confira estoque, caixa, espaço e caminho.');
    }
    case 'accept':{
      if(state.contracts.filter(open).length>=3)return city.fail('Conclua um dos três contratos ativos antes de aceitar outro.');
      const offer=familyOffers(city).find(o=>o.id===options.offerId);if(!offer)return city.fail('Oferta encerrada ou já aceita.');
      if(!owned)return city.fail('Escolha uma empresa da família como fornecedora.');
      if(owned.id===offer.buyerId)return city.fail('Uma empresa não pode contratar a própria entrega.');
      const accountId=`family-contract:${state.nextContractId}`;
      city.accounts.set(accountId,{name:`Reserva do contrato familiar ${state.nextContractId}`,balance:0});
      if(!city.transfer(offer.payer,accountId,offer.budget,'Reserva de contrato familiar')){city.accounts.delete(accountId);return city.fail('O cliente não conseguiu reservar o pagamento.');}
      const r={...offer,offerId:offer.id,id:state.nextContractId++,accountId,sellerId:owned.id,ownerId:c.id,status:'active',acceptedAt:city.minute,deadline:city.minute+3*DAY,delivered:0,revenue:0,counted:[]};
      state.contracts.push(r);remember(city,`Contrato #${r.id} aceito: ${r.quantity} ${city.economy.goods[r.good].label}, prazo de três dias.`);return true;
    }
    case 'dispatch':{
      const r=state.contracts.find(r=>r.id===options.contractId&&open(r));if(!r)return city.fail('Contrato indisponível.');
      const seller=familyBusinesses(city).find(b=>b.id===r.sellerId),buyer=city.building(r.buyerId);
      if(!seller)return city.fail('A empresa fornecedora não pertence mais à família.');
      const pending=city.logistics.shipments.filter(s=>s.familyContractId===r.id&&!['cancelled','delivered'].includes(s.status)).reduce((n,s)=>n+s.quantity,0);
      const quantity=Math.min(r.quantity-r.delivered-pending,6,Math.floor(seller.inventory[r.good]||0));
      if(quantity<1)return city.fail('Aguarde produção ou entrega das cargas já despachadas.');
      const shipment=city.logistics.order(seller,buyer,r.good,quantity,r.unitPrice,{payerAccountId:r.accountId,purpose:'family-contract'});
      if(!shipment)return city.fail('Frete indisponível: confira caminho, espaço e reserva financeira.');
      shipment.familyContractId=r.id;return true;
    }
    case 'cancel':{
      const r=state.contracts.find(r=>r.id===options.contractId&&open(r));if(!r)return city.fail('Contrato indisponível.');
      settleContract(city,r,'cancelled','Cancelado pela família; confiança comercial reduzida.');return true;
    }
    case 'bill':
      if(!city.politics.council.members.some(m=>m.citizenId===c.id))return city.fail('Este familiar precisa conquistar uma cadeira na Câmara.');
      if(!['tax','minimumWage','build'].includes(options.type))return city.fail('Proposta indisponível.');
      return city.politics.submitBill(options.type,options.payload||{},c.id);
    default:return city.fail('Ação familiar desconhecida.');
  }
}
