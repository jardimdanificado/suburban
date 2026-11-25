import {partyNetworkAction} from './city_party_network.js';
import {partyMediaAction} from './city_party_media.js';
import {partyActivity} from './city_party_player.js';
import {syncMayorReviews,selectReviewPromises,confirmMayorReview,selectReviewCandidate} from './city_mayor_decisions.js';
import {acceptMayorChallenge,updateMayorChallenges} from './city_mayor_challenges.js';
import {OFFICE_ONLY_TYPES,officeFloors,createMunicipalOffice} from './city_offices.js?v=office-demand-rollout-1';
import {SECRETARIATS, secretarySkillScore} from './city_secretariats.js';
import {canFarmVertically} from './city_farm_layout.js';
import {equityShares,equityValue,initializeEquity,offerShares,buyShares,privatizationQuota} from './city_equity.js?v=daily-mayor-privatization-2';
// The player directs municipal priorities; execution stays in the city's systems.
export const mayorMode = city => city.mayorCampaign?.mode === 'play';
export const publicProjects = city => city.development.projects.filter(p => p.accountId === 'treasury' && !p.cancelled && p.status !== 'completed');
// Only the Executive may open these requests; every other bill needs a councilor.
const executiveRequests = new Set(['worksBudget','worksTransfer','mayorDecreeDays','impeachmentCooldownElections']);
// Budget, ownership, identity and electoral rules keep their legislative path.
const decreeBlocked = new Set(['worksBudget','worksTransfer','build','nationalize','privatize','mayorCandidateLimit','partyLimit','councilRate','councilSeats','councilBudget','mayorBudget','cityName','citySlogan','cityFlag','secretaryElection','mayorElectionSystem','reelectionLimit','termDays','campaignDays','impeachmentCooldownElections','mayorDecreeDays','cleanRecord','parliamentaryImmunity']);
// Municipal firms the Executive may open or run directly; civic buildings keep the works budget.
const firmextras=new Set(['farm','quarry','mill','builder','carrier','cleaner','waste_collector','recycler','composting','bakery','market','greengrocer','restaurant','popular_refectory','public_toilet','paid_toilet','lamp_service','utility','clinic','leisure','paper_mill']);
export const municipalFirmType=(city,type)=>{const spec=city?.buildingTypes?.[type];return !!spec&&type!=='office_tower'&&(!!spec.category||firmextras.has(type))&&!OFFICE_ONLY_TYPES.has(type)&&!['townhall','mint','council_chamber'].includes(type);};
export function updateMayorCampaign(city) {
  const s=city.mayorCampaign;
  if(!s || s.status!=='active' || !mayorMode(city))return;
  const party=city.politics.party(s.partyId),mayor=city.society.citizen(city.economy.mayorId);
  if(!party?.active){s.status='defeated';s.endedAt=city.minute;s.reason=`${s.partyName} foi liquidado.`;city.log(s.reason,'government',[],{kind:'mayor-campaign-defeated',partyId:s.partyId});return;}
  s.mayorId=mayor?.id??null;
  s.inGovernment=mayor?.political?.partyId===s.partyId;
  if(s.inGovernment)updateMayorChallenges(city);
  else s.governmentReview=null;
  syncMayorReviews(city);
  if(s.mediaSession&&city.minute-(s.lastMediaTick??-Infinity)>=60){s.lastMediaTick=city.minute;city.politics.campaigns.media(s.mediaSession);}
}
function record(city, action, text, details={}) {
  const s=city.mayorCampaign;
  s.orders.push({id:s.nextOrderId++,minute:city.minute,action,text,...details});
  if(s.orders.length>80)s.orders.shift();
  city.log(text,'government',[city.economy.mayorId],{kind:'mayor-player-order',action,...details});
}
function cabinet(city) {
  const p=city.politics;
  p.ensureSecretariatState?.();
  p.secretaries??=[];
  if(SECRETARIATS.some(office=>!p.secretaries.some(row=>row.officeId===office.id)))p.ensureSecretaries?.();
  return p;
}
function townhall(city){return city.buildings.find(b=>b.type==='townhall'&&!b.entity.destroyed)??null;}
function releaseSecretary(city,person,officeId,reason) {
  if(!person)return;
  if(person.secretaryOffice===officeId){
    delete person.secretaryOffice;
    if(person.role==='secretary'){person.role='citizen';person.action='Cargo devolvido; disponível para trabalhar';}
  }
  city.politics.releaseDuties?.(person,reason);
}
function appointSecretary(city,officeId,citizenId) {
  const p=cabinet(city),office=SECRETARIATS.find(o=>o.id===officeId),row=p.secretaries.find(r=>r.officeId===officeId),mayor=city.society.citizen(city.economy.mayorId);
  if(!office||!row)return city.fail('Secretaria desconhecida.');
  const mode=p.policy.secretaryElectionModes?.[officeId]||'appointed';
  if(mode!=='appointed')return city.fail(`A ${office.short} não é nomeada pelo prefeito; o sistema vigente é outro. Proponha a mudança do sistema à Câmara.`);
  const person=city.society.citizen(citizenId);
  if(!person||person.entity.destroyed)return city.fail('Escolha um morador vivo.');
  if(person.id===mayor?.id||person.id===p.viceMayorId||p.council.members.some(m=>m.citizenId===person.id))return city.fail('Prefeito, vice-prefeito e vereadores não podem acumular uma secretaria.');
  if(!p.eligible(person))return city.fail('Este morador não está elegível para o cargo.');
  if(person.secretaryOffice&&person.secretaryOffice!==officeId){
    const previous=p.secretaries.find(r=>r.officeId===person.secretaryOffice);
    if(previous){const outgoing=city.society.citizen(previous.citizenId);releaseSecretary(city,outgoing,previous.officeId,'Transferência de secretaria');Object.assign(previous,{citizenId:null,citizenName:'Cargo vago',partyId:null,skill:0,votes:0});}
  }
  if(row.citizenId&&row.citizenId!==person.id){const outgoing=city.society.citizen(row.citizenId);releaseSecretary(city,outgoing,officeId,`Substituição na ${office.short}`);}
  Object.assign(row,{officeId,name:office.name,citizenId:person.id,citizenName:person.entity.properties.name,partyId:person.political?.partyId??null,mode:'appointed',appointedByMayorId:mayor.id,buildingId:townhall(city)?.id??null,termNumber:p.termNumber,minute:city.minute,votes:0,skill:secretarySkillScore(person,office)});
  person.role='secretary';person.secretaryOffice=officeId;person.action=`Secretário(a) · ${office.short}`;
  if(officeId==='labor'){p.laborSecretaryId=person.id;p.syncLaborSecretaryWorkplace();}
  return true;
}
function dismissSecretary(city,officeId) {
  const p=cabinet(city),office=SECRETARIATS.find(o=>o.id===officeId),row=p.secretaries.find(r=>r.officeId===officeId);
  if(!office||!row)return city.fail('Secretaria desconhecida.');
  if(!row.citizenId)return city.fail('O cargo já está vago.');
  const mode=p.policy.secretaryElectionModes?.[officeId]||'appointed';
  if(mode!=='appointed')return city.fail('Só nomeados pelo prefeito podem ser exonerados por esta ordem.');
  const person=city.society.citizen(row.citizenId);
  releaseSecretary(city,person,officeId,`Exoneração da ${office.short}`);
  if(officeId==='labor')p.laborSecretaryId=null;
  Object.assign(row,{citizenId:null,citizenName:'Cargo vago',partyId:null,skill:0,votes:0,minute:city.minute});
  return true;
}
function contractAccess(city,buildingId) {
  const b=city.building(buildingId),hall=city.townhall?.()??townhall(city);
  if(!b||b.entity.destroyed||!hall)return city.fail('Imóvel indisponível para ligação viária.');
  if(typeof city.world?.getTile!=='function')return city.fail('Acesso viário indisponível neste estado da cidade.');
  if(city.politics.roadConnected(b))return city.fail('Este imóvel já possui acesso pavimentado.');
  const route=city.findPath?.(b.door,hall.door),estimate=(route?.length||0)*(city.currency.price(8000)*1.5+city.economy.goods.pedra.price);
  if(estimate&&city.treasury-estimate<city.fiscal.reserve())return city.fail('O tesouro não cobre o acesso sem consumir a reserva municipal.');
  const project=city.development.beginRoad('treasury',b.door,hall.door,{priority:100});
  if(!project)return city.fail('Sem rota viável ou construtora disponível para o acesso.');
  project.executiveInitiative=true;
  return project;
}
function expandBuilding(city,buildingId,floors=1) {
  const b=city.building(buildingId);
  if(!b||b.entity.destroyed)return city.fail('Imóvel indisponível para ampliação.');
  if(!['townhall','super_popular_housing','popular_housing','popular_luxury_housing'].includes(b.type))return city.fail('A ampliação direta atende a prefeitura e as moradias populares.');
  if(!Number.isInteger(floors)||floors<1||floors>6)return city.fail('Escolha de um a seis pavimentos.');
  if(b.floors+floors>12)return city.fail('O imóvel já está no limite de pavimentos.');
  const needs=city.welfare.conditions(),estimate=b.width*b.depth*floors*(2*city.economy.goods.pedra.price+Math.ceil(city.currency.price(12000)*1.5));
  if(city.treasury-estimate<needs.reserve)return city.fail('O tesouro não cobre a ampliação sem consumir a reserva social.');
  const project=city.development.beginExpansion('treasury',b.id,{floors});
  if(!project)return city.fail('Ampliação indisponível: confira titularidade, construtora e obra em andamento.');
  project.executiveInitiative=true;
  return project;
}
export function municipalOfficeVacancies(city) {
  return city.economy.businesses.filter(tower=>tower.type==='office_tower'&&tower.municipal&&tower.active&&!tower.entity.destroyed)
    .flatMap(tower=>officeFloors(city,tower).filter(row=>!row.tenantId&&row.units.length&&row.units.every(unit=>unit.forRent)).map(row=>({tower,floor:row.floor,rent:row.rent})));
}
function openMunicipalOffice(city,type,towerId,floorNumber,budget) {
  if(!OFFICE_ONLY_TYPES.has(type))return city.fail('Escolha uma atividade que ocupe andar empresarial.');
  const tower=city.building(towerId),row=officeFloors(city,tower).find(item=>item.floor===floorNumber);
  if(!tower||tower.entity.destroyed||!tower.active||tower.type!=='office_tower'||!tower.municipal)return city.fail('Escolha um empresarial municipal em atividade.');
  if(!row||row.tenantId||!row.units.length||!row.units.every(unit=>unit.forRent))return city.fail('Este andar não está disponível para instalação municipal.');
  const capital=Number.isSafeInteger(budget)&&budget>0?budget:city.currency.price(type==='bank'?2000000:100000);
  if(city.treasury-capital<city.fiscal.reserve())return city.fail('O capital de operação consumiria a reserva municipal.');
  const building=createMunicipalOffice(city,tower,floorNumber,type,capital);
  if(!building)return city.fail('Não foi possível instalar a atividade neste andar.');
  return building;
}
function openMunicipalFirm(city,type,crop='milho',vertical=false,floors=null) {
  if(!municipalFirmType(city,type))return city.fail('Escolha uma atividade produtiva ou de serviço para a empresa municipal.');
  const verticalFarm=type==='farm'&&vertical===true&&canFarmVertically(crop),site=city.development.publicBuildingSite(type,verticalFarm?{kind:'building'}:{});
  if(!site)return city.fail(city.development.publicLandReport?.reason||'Procurando terreno público acessível e compatível.');
  const builder=city.development.selectBuilder('treasury',site.door);
  if(!builder&&(type!=='farm'||verticalFarm))return city.fail('Aguardando construtora disponível.');
  const tinyMap=Math.max(city.world.width,city.world.height)<128;
  const {width,depth}=site,monumentFloors=type==='courthouse'?(tinyMap?2:4):['police_station','jail','council_chamber','clinic'].includes(type)?(tinyMap?2:3):['iml','crematorium','council_oversight_office','library'].includes(type)?2:1,targetFloors=verticalFarm?(floors||3):monumentFloors,cells=width*depth*targetFloors,stone=type==='farm'&&!verticalFarm||['quarry','iron_mine','bauxite_mine'].includes(type)?0:cells*2,fee=builder&&stone?Math.ceil(cells*city.currency.price(12000)*1.5):0,capital=city.currency.price(type==='bank'?2000000:60000),estimate=site.purchasePrice+stone*city.economy.goods.pedra.price+fee+capital;
  if(city.treasury-estimate<city.fiscal.reserve())return city.fail('O tesouro não cobre terreno, obra e capital de operação sem consumir a reserva municipal.');
  if(!city.development.acquirePublicSite(site))return city.fail('Não foi possível concluir a compra negociada do terreno.');
  const project=city.development.beginProject('treasury',site.lot.id,type,{width,depth,floors:targetFloors,...(verticalFarm?{kind:'building'}:{}),crop:type==='farm'?crop:null,builderId:builder?.id??null,priority:120,rotation:site.rotation});
  if(!project)return city.fail('Não foi possível contratar a empresa municipal neste terreno.');
  project.executiveInitiative=true;project.productionChain=true;project.startupCapital=capital;
  return project;
}
function planSocialHousing(city) {
  const before=new Set(city.development.projects.map(project=>project.id));
  city.development.planBasicHousing();
  const project=city.development.projects.find(item=>!before.has(item.id));
  if(!project)return city.fail('Sem fila de moradia: a oferta atual cobre os moradores sem casa ou faltam caixa, terreno e construtora.');
  project.executiveInitiative=true;
  return project;
}
function planPaving(city) {
  const hall=townhall(city);
  if(!hall)return city.fail('A prefeitura ainda não existe para orientar a malha viária.');
  city.development.planRoadNetwork(hall,city.welfare.conditions());
  const planning=city.development.roadPlanning,project=planning?.projectId?city.development.projects.find(item=>item.id===planning.projectId):null;
  if(!project)return city.fail(planning?.reason||'Nenhum trecho prioritário de pavimentação disponível.');
  project.executiveInitiative=true;
  return project;
}
function repairRoads(city) {
  const damaged=city.development.cityRoadNeedsRepair?.()||[];
  if(!damaged.length)return city.fail('Nenhum trecho de via precisa de conservação.');
  if(city.treasury-city.fiscal.reserve()<city.currency.price(200000))return city.fail('O caixa livre não cobre a conservação viária sem consumir a reserva municipal.');
  const project=city.development.beginRoadRepair('treasury',damaged.sort((a,b)=>city.trafficScore([b])-city.trafficScore([a])).slice(0,12));
  if(!project)return city.fail('Conservação indisponível: confira construtora e trechos já contratados.');
  project.executiveInitiative=true;
  return project;
}
function maintainBuilding(city,buildingId) {
  const b=city.building(buildingId);
  if(!b||b.entity.destroyed)return city.fail('Imóvel indisponível para manutenção.');
  if(!city.fiscal.municipal(b)&&b.id!==city.townhall()?.id)return city.fail('Escolha um imóvel municipal.');
  if(!b.repairNeeded&&(b.condition??100)>=95)return city.fail('O imóvel não precisa de reparo preventivo.');
  const estimate=b.width*b.depth*city.currency.price(2500)*1.5;
  if(city.treasury-estimate<city.fiscal.reserve())return city.fail('O tesouro não cobre o reparo sem consumir a reserva municipal.');
  const project=city.development.beginRepair('treasury',b.id,{preventive:true});
  if(!project)return city.fail('Reparo indisponível: confira construtora e obra em andamento.');
  project.executiveInitiative=true;
  return project;
}
function offerPublicShares(city,buildingId,percent=5) {
  const b=city.building(buildingId),points=Math.round(Number(percent)*100);
  if(!b||b.entity.destroyed||!b.active)return city.fail('Escolha uma empresa ativa para ofertar participações.');
  if(!Number.isSafeInteger(points)||points<1)return city.fail('Percentual de oferta inválido.');
  const owned=equityShares(city,b).find(share=>share.accountId==='treasury')?.points||0;
  if(points>owned)return city.fail('A participação pública disponível é menor que a oferta.');
  const quota=privatizationQuota(city);
  if(points>quota.remaining)return city.fail(`A cota diária permite ofertar mais ${(quota.remaining/100).toFixed(2)}%.`);
  const offer=offerShares(city,b,'treasury',points,{dailyPrivatization:true});
  if(!offer)return city.fail('A oferta de participações não pôde ser aberta.');
  return {offer,buildingId:b.id,points};
}
function collectMunicipalResult(city,buildingId) {
  const b=city.building(buildingId);
  if(!b||!city.fiscal.municipal(b))return city.fail('Escolha uma empresa municipal.');
  const amount=city.fiscal.distribute(b);
  if(!amount)return city.fail('A empresa não tem excedente disponível além da reserva operacional.');
  return amount;
}
function recoverMarket(city,buildingId) {
  const b=city.building(buildingId);
  if(!b||b.entity.destroyed||!b.active||b.type!=='market')return city.fail('Escolha um mercado ativo.');
  if(!((b.financialDistressDays||0)>0||b.balance<city.currency.price(5000)))return city.fail('O mercado não está em dificuldade financeira.');
  const budget=Math.max(0,city.treasury-city.fiscal.reserve());
  if(budget<city.currency.price(1000))return city.fail('O caixa livre não comporta o fundo de recuperação.');
  const amount=Math.min(budget,city.currency.price(30000),Math.max(city.currency.price(1000),Math.floor((b.totalExpenses||0)*.15)));
  if(!city.transfer('treasury',b.accountId,amount,'Fundo de recuperação de mercado local',{buildingId:b.id}))return city.fail('O fundo de recuperação não pôde ser transferido.');
  b.governmentRecovery??=[];b.governmentRecovery.push({minute:city.minute,amount,initiativeId:'market-revival'});
  return {buildingId:b.id,amount};
}
function grantRentVoucher(city,citizenId=null) {
  const person=citizenId?city.society.citizen(citizenId):city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!c.homeUnitId&&c.balance<city.currency.price(20000)).sort((a,b)=>a.balance-b.balance)[0];
  if(!person||person.entity.destroyed)return city.fail('Sem morador elegível para o vale-aluguel.');
  if(!city.society.isAdult(person)||person.homeUnitId||person.balance>=city.currency.price(20000))return city.fail('O vale atende adulto sem moradia e com poucos recursos.');
  const amount=Math.min(Math.max(0,city.treasury-city.fiscal.reserve()),city.currency.price(6000));
  if(amount<1)return city.fail('O caixa livre não comporta o vale-aluguel.');
  if(!city.transfer('treasury',person.accountId,amount,'Vale-aluguel temporário',{citizenId:person.id}))return city.fail('O vale-aluguel não pôde ser pago.');
  city.politics.rentVouchers??=[];city.politics.rentVouchers.push({citizenId:person.id,amount,minute:city.minute,termId:null});
  return {citizenId:person.id,amount};
}
function subsidizeHousing(city,citizenId=null,homeId=null) {
  const buyer=citizenId?city.society.citizen(citizenId):city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!c.homeUnitId&&c.balance<city.currency.price(90000)&&c.jobId).sort((a,b)=>b.balance-a.balance)[0];
  if(!buyer||buyer.entity.destroyed)return city.fail('Sem comprador elegível: adulto, empregado e sem moradia.');
  if(!city.society.isAdult(buyer)||buyer.homeUnitId)return city.fail('O financiamento atende adulto sem moradia.');
  const home=homeId?city.housing.homes.get(Number(homeId)):[...city.housing.homes.values()].find(h=>!city.housing.isSocial(h)&&city.housing.units(h).length&&city.housing.units(h).every(unit=>unit.forSale&&!unit.tenantId));
  if(!home)return city.fail('Sem imóvel privado à venda para o financiamento.');
  const banks=city.bank.developmentBanks();
  if(!banks.length)return city.fail('Nenhum banco pode conceder o financiamento.');
  const price=city.housing.price(home),reserve=city.currency.price(30000),down=Math.ceil(price*.25),needed=price-down,grant=Math.max(down,down+reserve-buyer.balance),free=Math.max(0,city.treasury-city.fiscal.reserve());
  if(grant>free)return city.fail('A entrada subsidiada consumiria a reserva municipal.');
  if(!city.transfer('treasury',buyer.accountId,grant,'Entrada subsidiada do programa de crédito habitacional',{citizenId:buyer.id,homeId:home.id}))return city.fail('A entrada subsidiada não pôde ser transferida.');
  let loan=null;
  for(const bank of banks){loan=city.bank.mortgage(bank,buyer,needed,{homeId:home.id});if(loan)break;}
  if(!loan){city.transfer(buyer.accountId,'treasury',grant,'Estorno de entrada habitacional sem financiamento');return city.fail('O financiamento não foi aprovado; a entrada foi devolvida.');}
  if(!city.housing.buyHome(buyer,home)){city.bank.cancelMortgage(loan);city.transfer(buyer.accountId,'treasury',grant,'Estorno de entrada habitacional não utilizada');return city.fail('A compra não foi concluída; a entrada foi devolvida.');}
  return {citizenId:buyer.id,homeId:home.id,buildingId:home.buildingId,loanId:loan.id,amount:grant};
}
function municipalEquityLoan(city,citizenId=null,buildingId=null) {
  const resident=citizenId?city.society.citizen(citizenId):city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!c.businessIds?.length&&c.balance<city.currency.price(30000)).sort((a,b)=>(b.traits?.ambition||0)-(a.traits?.ambition||0))[0];
  if(!resident||resident.entity.destroyed)return city.fail('Sem morador elegível para o crédito de participação.');
  if(!city.society.isAdult(resident)||resident.businessIds?.length)return city.fail('O crédito atende adulto sem empresa própria.');
  const firm=buildingId?city.building(buildingId):city.economy.businesses.find(b=>b.municipal&&!b.entity.destroyed&&b.active&&!['townhall','mint'].includes(b.type));
  if(!firm||firm.entity.destroyed)return city.fail('Sem estatal disponível para o crédito de participação.');
  if(!initializeEquity(city,firm))return city.fail(city.lastError||'A empresa não pode ser incorporada ao programa.');
  const value=equityValue(city,firm),points=500,price=Math.max(1,Math.ceil(value*points/10000)),free=Math.max(0,city.treasury-city.fiscal.reserve()),principal=Math.min(free,price);
  if(principal<price)return city.fail('O caixa livre não cobre a participação de 5%.');
  if((equityShares(city,firm).find(share=>share.accountId==='treasury')?.points||0)<points)return city.fail('A empresa não tem 5% público para transferir.');
  if(!city.transfer('treasury',resident.accountId,principal,'Empréstimo municipal para aquisição de participação em estatal',{citizenId:resident.id,buildingId:firm.id}))return city.fail('O empréstimo não pôde ser transferido.');
  const offer=offerShares(city,firm,'treasury',points,{capitalRaise:false});
  if(!offer||!buyShares(city,firm,offer.id,resident.accountId,points,{silent:true})){city.transfer(resident.accountId,'treasury',principal,'Estorno de empréstimo de participação estatal');return city.fail('A participação não pôde ser comprada; o valor foi devolvido.');}
  city.politics.stateEquityLoans??=[];city.politics.stateEquityLoans.push({citizenId:resident.id,buildingId:firm.id,principal,remaining:principal,startedAt:city.minute,termId:null});
  return {citizenId:resident.id,buildingId:firm.id,amount:principal,points};
}
function installPublicLighting(city) {
  if(city.treasury-city.fiscal.reserve()<city.currency.price(20000))return city.fail('O caixa livre não cobre um poste sem consumir a reserva municipal.');
  const before=new Set(city.development.projects.filter(project=>project.service==='lamp'&&!project.cancelled&&project.status!=='completed').map(project=>project.id));
  city.lighting.hourly();
  const created=city.development.projects.filter(project=>project.service==='lamp'&&!before.has(project.id));
  if(!created.length)return city.fail('Nenhum ponto escuro com rua, construtora e caixa livre para instalar poste.');
  for(const project of created)project.executiveInitiative=true;
  return {projects:created.map(project=>project.id),count:created.length};
}
function orderPublicFood(city) {
  const before=city.logistics.shipments.length;
  city.welfare.restockPublicMeals();
  const created=city.logistics.shipments.slice(before);
  if(!created.length)return city.fail('A reserva pública de alimentos está completa ou faltam fornecedores, caixa e transporte.');
  for(const shipment of created)shipment.executiveInitiative=true;
  return {shipments:created.length};
}
function campaignRally(city,options={}) {
  const p=city.politics,election=p.active;
  if(options.point&&(!Number.isFinite(options.point.x)||!Number.isFinite(options.point.y)))return city.fail('Ponto de campanha inválido.');
  if(!election||election.status!=='campaign')return city.fail('Não há campanha eleitoral em curso.');
  if(city.hour<7||city.hour>=20)return city.fail('Bandeiraços acontecem entre 7h e 20h.');
  const partyId=city.mayorCampaign?.partyId??p.partyOfId(city.economy.mayorId)?.id,nomination=election.candidates?.find(item=>item.partyId===partyId);
  if(!nomination)return city.fail('O partido do prefeito não tem candidatura própria nesta eleição.');
  const s=city.mayorCampaign,hour=Math.floor(city.minute/60);
  if(s.lastRallyHour===hour)return city.fail('A militância já foi mobilizada nesta hora; aguarde o próximo horário.');
  const participants=p.campaigns.rally(nomination,election,options.point);
  if(!participants)return city.fail('Sem militantes, bandeiras ou ponto de rua disponíveis para o bandeiraço.');
  s.lastRallyHour=hour;
  return {participants,candidateId:nomination.citizenId,partyId};
}
export function mayorAction(city,action,options={}) {
  city.lastError='';
  if(!options || typeof options!=='object')return city.fail('Opções inválidas.');
  const p=city.politics;
  if(action==='start'){
    if(city.mayorCampaign?.mode==='play')return city.fail('Já existe uma partida ativa.');
    if(city.characterGame?.mode==='play'||city.familyCampaign)return city.fail('Use uma cidade sem campanha de personagem ou família.');
    p.ensureMayor();
    const mayor=city.society.citizen(city.economy.mayorId),party=p.party(options.partyId??mayor?.political?.partyId);
    if(!mayor||mayor.entity.destroyed||!party?.active)return city.fail('Aguarde um prefeito com partido em exercício.');
    city.mayorCampaign={version:2,mode:'play',status:'active',partyId:party.id,partyName:party.name,mayorId:mayor.id,startedAt:city.minute,orders:[],nextOrderId:1};
    syncMayorReviews(city);
    record(city,'start',`O jogador assumiu a gestão de ${party.name}. Obras e serviços dependem dos recursos da cidade.`);
    return true;
  }
  const s=city.mayorCampaign;
  if(!s)return city.fail('Inicie o modo prefeito primeiro.');
  if(action==='observe'){s.mode='observe';if(s.mediaSession){s.mediaSession.voteAt=city.minute;p.campaigns.media(s.mediaSession);}for(const c of city.citizens)if(c.partyMeeting){c.partyMeeting=null;if(c.task==='party-meeting'){c.task=null;c.targetId=null;c.path=[];}}return true;}
  if(!mayorMode(city))return city.fail('A campanha foi encerrada. Crie outra cidade para jogar novamente.');
  updateMayorCampaign(city);
  if(s.status!=='active')return city.fail('O partido foi liquidado. A campanha terminou.');
  const partyActions=new Set(['reviewCandidate','reviewVice','reviewPromises','confirmReview','campaignControl','campaignMaterial','rally','bill','partyVote','partyStance','partyActivity','partyMedia','partyBusiness','partyPlacement','partySchemePlan','partySchemeExecute','partySchemeCancel','partySchemeMeet']);
  if(p.partyOfId(city.economy.mayorId)?.id!==s.partyId&&(!partyActions.has(action)||['reviewPromises','confirmReview'].includes(action)&&options.kind==='government'))return city.fail('Esta decisão exige que seu partido governe a prefeitura.');
  const mayor=city.society.citizen(city.economy.mayorId);
  if(!mayor||mayor.entity.destroyed)return city.fail('Aguarde a posse do prefeito.');
  let result,details={};
  if(['partyBusiness','partyPlacement','partySchemePlan','partySchemeExecute','partySchemeCancel','partySchemeMeet'].includes(action)){
    result=partyNetworkAction(city,action,options);
  }else if(action==='partyMedia'){
    result=partyMediaAction(city,options);
  }else if(action==='partyActivity'){
    result=partyActivity(city,options);
  }else if(action==='partyStance'){
    if(!['yes','no','free'].includes(options.stance))return city.fail('Orientação inválida.');
    s.voteStance=options.stance;result=true;
  }else if(action==='partyVote'){
    const bill=p.council.bills.find(b=>b.id===options.billId&&['awaiting-session','proposed','vetoed'].includes(b.status));
    const members=p.council.members.filter(m=>m.partyId===s.partyId&&(!options.citizenId||m.citizenId===options.citizenId));
    if(!bill||!members.length||!['yes','no','free'].includes(options.stance))return city.fail('Votação ou bancada indisponível.');
    bill.playerVotes??={};for(const m of members){if(options.stance==='free')delete bill.playerVotes[m.citizenId];else bill.playerVotes[m.citizenId]=options.stance==='yes';}result=true;details={billId:bill.id};
  }else if(action==='reviewCandidate'||action==='reviewVice'){
    result=selectReviewCandidate(city,options.citizenId,action==='reviewVice');
  }else if(action==='reviewPromises'){
    if(!['government','program'].includes(options.kind))return city.fail('Revisão desconhecida.');
    const review=options.kind==='government'?s.governmentReview:s.programReview;
    const metrics=options.metric&&review?(review.selected.includes(options.metric)?review.selected.filter(m=>m!==options.metric):[...review.selected,options.metric]):options.metrics;
    result=selectReviewPromises(city,options.kind,metrics);
  }else if(action==='confirmReview'){
    if(!['government','program'].includes(options.kind))return city.fail('Revisão desconhecida.');
    result=confirmMayorReview(city,options.kind);
  }else if(action==='challenge'){
    result=acceptMayorChallenge(city,options.kind);if(!result)return result;details={challengeId:result.id};
  }else if(action==='campaignControl'){
    if(!['manual','automatic'].includes(options.mode))return city.fail('Controle de campanha inválido.');
    s.campaignControl=options.mode;result=true;
  }else if(action==='campaignMaterial'){
    const election=p.active,n=election?.candidates?.find(n=>n.partyId===s.partyId);
    if(election?.status!=='campaign'||!n)return city.fail('Sem candidatura própria em campanha.');
    if(!['pamphlet','flag','banner','paint'].includes(options.kind))return city.fail('Material de campanha inválido.');
    const materials=p.campaigns.getMaterials(),firstId=materials.nextId;
    materials.plan(election,{candidateId:n.citizenId,kind:options.kind});
    result=materials.missions.find(m=>m.id>=firstId&&m.candidateId===n.citizenId&&m.kind===options.kind);
    if(!result)return city.fail('Sem contratação: confira horário (7h–22h), material, caixa partidário, trabalhador, destino e limite diário.');
    details={missionId:result.id};
  }else if(action==='pauseWork'){
    const project=publicProjects(city).find(p=>p.id===options.projectId);
    if(!project||typeof options.paused!=='boolean')return city.fail('Escolha uma obra pública pendente.');
    project.paused=options.paused;result=true;details={projectId:project.id,paused:project.paused};
  }else if(action==='build'){
    if(OFFICE_ONLY_TYPES.has(options.type))return city.fail('Esta atividade precisa de um andar empresarial; a contratação direta deste modo atende instalações próprias.');
    const vertical=options.type==='farm'&&options.vertical===true?true:null,floors=Number.isInteger(options.floors)?options.floors:null;
    result=p.startPublicWork(options.type,options.crop||'milho',{vertical,floors,plotId:options.plotId??null});
    if(!result)return result;
    details={projectId:result.id};
  }else if(action==='priority'){
    const project=publicProjects(city).find(p=>p.id===options.projectId);
    if(!project||![10,100,200].includes(options.value))return city.fail('Escolha uma obra pública pendente e uma prioridade válida.');
    project.priority=options.value;result=true;details={projectId:project.id,priority:options.value};
  }else if(action==='fund'){
    const b=city.building(options.buildingId),amount=options.amount;
    if(!b||!city.fiscal.municipal(b))return city.fail('Escolha uma empresa municipal em atividade.');
    if(!Number.isSafeInteger(amount)||amount<=0)return city.fail('Valor de custeio inválido.');
    if(city.treasury-amount<city.fiscal.reserve())return city.fail('Custeio consumiria a reserva municipal.');
    result=city.transfer('treasury',b.accountId,amount,'Custeio ordenado pelo prefeito',{buildingId:b.id});
    details={buildingId:b.id,amount};
  }else if(action==='service'){
    const b=city.building(options.buildingId);
    if(!b||!city.fiscal.municipal(b)&&b.id!==city.townhall()?.id)return city.fail('Escolha um imóvel municipal.');
    const methods={repair:'createRepairOrder',cleaning:'createCleaningOrder',garden:'createGardenOrder'},method=Object.hasOwn(methods,options.service)?methods[options.service]:null;
    if(!method)return city.fail('Serviço inválido.');
    const fee=city.gigs.quote(b.id,options.service==='cleaning'?'interior':options.service,'treasury');
    if(city.treasury-fee<city.fiscal.reserve())return city.fail('Serviço consumiria a reserva municipal.');
    result=city.gigs[method]('treasury',b.id,{fee});
    if(!result)return city.fail('Serviço indisponível: confira caixa, acesso, necessidade e encomendas existentes.');
    details={gigId:result.id,buildingId:b.id};
  }else if(action==='bill'){
    const type=String(options.type||''),payload={...(options.payload||{})};
    if(options.value!==undefined)payload.value=options.value;
    if(!type)return city.fail('Escolha a medida a encaminhar à Câmara.');
    const representative=p.council.people().find(c=>c.political.partyId===s.partyId);
    if(mayor.political.partyId!==s.partyId&&(executiveRequests.has(type)||!representative))return city.fail('Esta proposta exige prefeito do partido ou representação na Câmara.');
    const author=executiveRequests.has(type)?mayor:(representative??p.council.people()[0]??mayor);
    result=p.submitBill(type,payload,author.id);
    if(!result)return result;
    details={billId:result.id};
  }else if(action==='decree'){
    const type=String(options.type||''),payload={...(options.payload||{})};
    if(!type)return city.fail('Escolha a medida do decreto.');
    if(decreeBlocked.has(type))return city.fail('Orçamento, propriedade, identidade e regras eleitorais exigem projeto de lei; use o instrumento PROJETO NA CÂMARA.');
    if(options.value!==undefined)payload.value=options.value;
    result=p.issueDecree(type,payload,mayor.id);
    if(!result)return result;
    details={billId:result.id,decree:true};
  }else if(action==='appoint'){
    result=appointSecretary(city,options.officeId,options.citizenId);
    if(!result)return result;
    const person=city.society.citizen(options.citizenId),office=SECRETARIATS.find(o=>o.id===options.officeId);
    details={officeId:options.officeId,citizenId:person.id,officeShort:office.short};
  }else if(action==='dismiss'){
    const office=SECRETARIATS.find(o=>o.id===options.officeId);
    result=dismissSecretary(city,options.officeId);
    if(!result)return result;
    details={officeId:options.officeId,officeShort:office?.short??options.officeId};
  }else if(action==='nationalize'||action==='privatize'){
    const b=city.building(options.buildingId);
    if(!b||b.entity.destroyed)return city.fail('Empresa indisponível para a operação.');
    const payload={buildingId:b.id};
    if(action==='privatize'){
      const percent=Number(options.percent??100);
      if(!Number.isFinite(percent)||percent<=0||percent>100)return city.fail('Percentual de privatização deve ficar entre 0,01% e 100%.');
      payload.percent=percent;
    }
    const author=p.council.people().find(c=>c.political.partyId===s.partyId)??p.council.people()[0]??mayor;
    result=p.submitBill(action,payload,author.id);
    if(!result)return result;
    details={billId:result.id,buildingId:b.id,...(payload.percent?{percent:payload.percent}:{})};
  }else if(action==='road'){
    result=contractAccess(city,options.buildingId);
    if(!result)return result;
    details={projectId:result.id,buildingId:options.buildingId};
  }else if(action==='expand'){
    const floors=Number.isInteger(options.floors)?options.floors:1;
    result=expandBuilding(city,options.buildingId,floors);
    if(!result)return result;
    details={projectId:result.id,buildingId:options.buildingId,floors};
  }else if(action==='firm'){
    result=openMunicipalFirm(city,String(options.type||''),options.crop||'milho',options.vertical===true,Number.isInteger(options.floors)?options.floors:null);
    if(!result)return result;
    details={projectId:result.id,type:options.type};
  }else if(action==='office'){
    result=openMunicipalOffice(city,String(options.type||''),options.towerId,Number(options.floor),options.budget);
    if(!result)return result;
    details={buildingId:result.id,towerId:options.towerId,officeType:options.type};
  }else if(action==='housing'){
    result=planSocialHousing(city);
    if(!result)return result;
    details={projectId:result.id};
  }else if(action==='paving'){
    result=planPaving(city);
    if(!result)return result;
    details={projectId:result.id};
  }else if(action==='roadRepair'){
    result=repairRoads(city);
    if(!result)return result;
    details={projectId:result.id};
  }else if(action==='maintain'){
    result=maintainBuilding(city,options.buildingId);
    if(!result)return result;
    details={projectId:result.id,buildingId:options.buildingId};
  }else if(action==='offerShares'){
    result=offerPublicShares(city,options.buildingId,options.percent??5);
    if(!result)return result;
    details={offerId:result.offer.id,buildingId:result.buildingId,points:result.points};
  }else if(action==='dividend'){
    result=collectMunicipalResult(city,options.buildingId);
    if(!result)return result;
    details={buildingId:options.buildingId,amount:result};
  }else if(action==='marketRecovery'){
    result=recoverMarket(city,options.buildingId);
    if(!result)return result;
    details=result;
  }else if(action==='rentVoucher'){
    result=grantRentVoucher(city,options.citizenId);
    if(!result)return result;
    details=result;
  }else if(action==='housingCredit'){
    result=subsidizeHousing(city,options.citizenId,options.homeId);
    if(!result)return result;
    details=result;
  }else if(action==='equityLoan'){
    result=municipalEquityLoan(city,options.citizenId,options.buildingId);
    if(!result)return result;
    details=result;
  }else if(action==='lighting'){
    result=installPublicLighting(city);
    if(!result)return result;
    details=result;
  }else if(action==='restock'){
    result=orderPublicFood(city);
    if(!result)return result;
    details=result;
  }else if(action==='rally'){
    result=campaignRally(city,options);
    if(!result)return result;
    details=result;
  }else if(action==='forceSanction'||action==='acceptRejection'){
    const bill=p.council.bills.find(b=>b.id===options.billId&&b.status==='rejected'&&city.minute<(b.forceSanctionAt??-Infinity));
    if(!bill)return city.fail('Projeto indisponível: o prazo para forçar sanção terminou.');
    if(action==='forceSanction'){
      bill.forcedSanction=true;bill.sanctionedBy=mayor.id;bill.sanctionedAt=city.minute;
      bill.status='awaiting-sanction';p.council.execute(bill);
    }
    bill.forceSanctionAt=city.minute;result=true;details={billId:bill.id};
  }else if(action==='sanction'||action==='veto'){
    const bill=p.council.bills.find(b=>b.id===options.billId&&b.status==='awaiting-sanction'&&city.minute<(b.sanctionAt??Infinity));
    if(!bill)return city.fail('Projeto indisponível para sanção ou veto.');
    if(action==='veto')result=p.vetoBill(bill.id);
    else {bill.sanctionedBy=mayor.id;bill.sanctionedAt=city.minute;p.council.execute(bill);result=bill.status!=='awaiting-sanction';}
    details={billId:bill.id};
  }else return city.fail('Ordem de prefeito desconhecida.');
  if(!result)return result;
  const label={partySchemeMeet:'encaminhar participante ao encontro',partyBusiness:'administrar empresa de filiado',partyPlacement:'encaminhar filiado a órgão público',partySchemePlan:'planejar operação clandestina',partySchemeExecute:'executar operação clandestina',partySchemeCancel:'cancelar operação clandestina',partyMedia:'decidir participação na imprensa',partyActivity:'organizar atividade partidária',partyVote:'definir voto da bancada',partyStance:'orientar a bancada',forceSanction:'forçar sanção de projeto recusado',acceptRejection:'manter rejeição da Câmara',reviewCandidate:'escolher candidato a prefeito',reviewVice:'escolher candidato a vice',reviewPromises:'escolher promessas',confirmReview:'confirmar decisões de governo',challenge:'assumir compromisso público',campaignControl:'definir controle da campanha',campaignMaterial:'contratar propaganda partidária',pauseWork:'alterar execução de obra',build:'contratar obra',priority:'alterar prioridade',fund:'destinar custeio',service:'contratar serviço',bill:'encaminhar proposta à Câmara',decree:'emitir decreto',appoint:'nomear secretário',dismiss:'exonerar secretário',nationalize:'encaminhar estatização',privatize:'encaminhar privatização',road:'contratar acesso viário',expand:'contratar ampliação',firm:'abrir empresa municipal',office:'instalar atividade em andar municipal',housing:'contratar habitação social',paving:'priorizar pavimentação',roadRepair:'conservar vias',maintain:'contratar manutenção predial',offerShares:'ofertar participações dentro da cota',dividend:'transferir resultado de estatal',marketRecovery:'recuperar mercado local',rentVoucher:'conceder vale-aluguel',housingCredit:'conceder crédito habitacional',equityLoan:'conceder crédito de participação em estatal',lighting:'instalar iluminação pública',restock:'comprar alimentos para refeições públicas',rally:'realizar bandeiraço',sanction:'sancionar projeto',veto:'vetar projeto'}[action];
  const suffix=action==='appoint'?` ${details.officeShort}: ${city.society.citizen(details.citizenId)?.entity.properties.name||''}.`:action==='dismiss'?` ${details.officeShort}.`:'';
  record(city,action,`Ordem de governo: ${label}.${suffix}`,details);
  return result;
}
