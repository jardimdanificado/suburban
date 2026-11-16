import {apply,qualification,openPositions,contract} from './city_employment.js';
import {playerAction,playerGoods} from './character_player_actions.js';
import {formatMoney} from './city_ui_format.js';
export const SCHEMES={embezzlement:'Desvio para o caixa partidário',favoritism:'Favorecer empresa de filiado',kickback:'Repasse clandestino da empresa ao partido',join:'Participar de esquema existente',police:'Subornar investigador',judge:'Subornar juiz',forensic:'Subornar perito',witness:'Subornar testemunha'};
const live=c=>c&&!c.entity.destroyed&&!c.custody;
const member=(city,id)=>{const c=city.society.citizen(id);return live(c)&&c.political?.partyId===city.mayorCampaign.partyId?c:null;};
const owns=(city,b)=>b?.active&&!b.entity.destroyed&&!b.municipal&&!!member(city,b.ownerId);
export function partySchemeTarget(city,plan){
 const record=city.justice.cases.find(r=>r.id===plan.caseId);
 const id=plan.kind==='police'?record?.investigation?.officerId:plan.kind==='judge'?record?.trial?.judgeId:plan.kind==='forensic'?city.justice.bodies.find(b=>b.id===plan.caseId)?.forensicExaminerId:plan.kind==='witness'?plan.targetId:null;
 return city.society.citizen(id);
}
export function partyNetworkAction(city,action,o){
 const p=city.politics,s=city.mayorCampaign,party=p.party(s.partyId),actor=member(city,o.citizenId),b=city.building(o.buildingId),governing=p.partyOfId(city.economy.mayorId)?.id===s.partyId;
 if(action==='partyBusiness'){
  if(!owns(city,b))return city.fail('Escolha uma empresa privada de filiado ativo.');
  const owner=member(city,b.ownerId),allowed=new Set(['fund-business','employment','hire-applicant','dismiss','price','buy-stock','offer-shares']);
  if(!allowed.has(o.command))return city.fail('Comando empresarial indisponível.');
  return playerAction(city,owner,o.command,o,{stop(){},route(){return city.fail('A operação exige deslocamento do proprietário.');}});
 }
 if(action==='partyPlacement'){
  if(!actor||!b?.active||b.entity.destroyed||!['iml','police_station','courthouse'].includes(b.type)||!city.society.isAdult(actor)||actor.jobId===b.id)return city.fail('Escolha filiado adulto e órgão ativo.');
  if(o.command==='apply')return apply(city,actor,b)||city.fail('Inscrição indisponível; confira agência de emprego, currículo e entrevistas pendentes.');
  if(o.command!=='patronage'||!governing)return city.fail('Indicação política exige que o partido governe.');
  const q=qualification(city,actor,b);
  if(!q.eligible||b.type==='courthouse'&&actor.judicialDisqualifiedAt!=null||openPositions(city,b)<1||b.balance<b.wage*60)return city.fail('Órgão sem vaga, recursos ou candidato habilitado.');
  const mayor=city.society.citizen(city.economy.mayorId),amount=city.currency.price(100);
  const record=p.crime(mayor,'favoritism','treasury',actor.accountId,amount,{buildingId:b.id,participantIds:[mayor.id,actor.id],roles:[{citizenId:mayor.id,role:'responsável pela indicação'},{citizenId:actor.id,role:'beneficiário do favorecimento'}]});
  if(!record)return city.fail('Sem recursos disponíveis para executar a indicação.');
  if(actor.jobId)city.economy.leaveJob(actor,'Indicação política para órgão público');
  actor.jobId=b.id;actor.profession=city.economy.jobSkill(b);b.workers.push(actor.id);contract(city,actor,b);actor.partyPlacementCaseId=record.id;
  city.history.employment(actor,b,'contratação');return record;
 }
 if(action==='partySchemePlan'){
  if((s.schemes||[]).filter(row=>row.status==='planned').length>=20)return city.fail('Execute ou cancele planos pendentes antes de registrar mais.');
  if(!actor||!Object.hasOwn(SCHEMES,o.kind)||!Number.isSafeInteger(o.amount)||o.amount<=0)return city.fail('Escolha articulador, tipo de esquema e valor positivo.');
  s.schemes??=[];const row={id:(s.nextSchemeId||1),kind:o.kind,citizenId:actor.id,buildingId:o.buildingId??null,caseId:o.caseId??null,targetId:o.targetId??null,amount:o.amount,status:'planned',plannedAt:city.minute};s.nextSchemeId=row.id+1;s.schemes.push(row);return row;
 }
 const plan=s.schemes?.find(row=>row.id===o.schemeId&&row.status==='planned');
 if(!plan)return city.fail('Plano indisponível.');
 if(action==='partySchemeMeet'){
  const person=member(city,plan.citizenId),target=partySchemeTarget(city,plan);
  if(!person||!live(target)||city.urgentNeed(person)||person.mobilityTrip||person.ridingVehicleId)return city.fail('Encontro indisponível: confira participantes, saúde e deslocamento.');
  const site=target.indoorLocation&&city.building(target.indoorLocation.buildingId),destination=site?.door||target.entity,path=person.indoorLocation?[]:city.findPath(person.entity,destination);
  if(path===null)return city.fail('Não há caminho até o participante.');
  person.path=path;person.targetId=site?.id??null;person.task='party-meeting';person.partyMeeting={targetId:target.id,schemeId:plan.id,until:city.minute+360};return true;
 }
 if(action==='partySchemeCancel'){plan.status='cancelled';const c=member(city,plan.citizenId);if(c?.partyMeeting?.schemeId===plan.id){c.partyMeeting=null;if(c.task==='party-meeting'){c.task=null;c.targetId=null;c.path=[];}}return true;}
 if(action!=='partySchemeExecute')return city.fail('Decisão desconhecida.');
 const person=member(city,plan.citizenId),firm=city.building(plan.buildingId);
 if(!person)return city.fail('O articulador deixou de estar disponível.');
 let result;
 if(['embezzlement','favoritism'].includes(plan.kind)){
  if(!governing||person.id!==city.economy.mayorId)return city.fail('O desvio exige o prefeito do partido como articulador.');
  if(plan.kind==='favoritism'&&!owns(city,firm))return city.fail('Empresa beneficiária indisponível.');
  result=p.crime(person,plan.kind==='embezzlement'?'party-fund-diversion':plan.kind,'treasury',plan.kind==='embezzlement'?p.partyAccount(party).accountId:firm.accountId,plan.amount,{buildingId:plan.kind==='favoritism'?firm?.id:undefined,participantIds:[person.id,...(plan.kind==='favoritism'?[firm.ownerId]:[])],playerSchemeId:plan.id});
  if(result&&firm&&plan.kind==='favoritism'){firm.favoredBy=person.id;firm.favorUntil=city.minute+3*1440;}
 }else if(plan.kind==='kickback'){
  if(!owns(city,firm)||firm.ownerId!==person.id)return city.fail('O articulador precisa ser dono da empresa escolhida.');
  result=p.crime(person,'party-fund-diversion',firm.accountId,p.partyAccount(party).accountId,plan.amount,{buildingId:firm.id,participantIds:[person.id],playerSchemeId:plan.id});
 }else if(plan.kind==='join'){
  const record=p.corruption.find(r=>r.id===plan.caseId&&!r.archived&&(r.discoveredAt!=null||r.partyId===s.partyId||r.participantIds?.some(id=>member(city,id))));
  const beneficiary=record&&city.society.citizen(record.accusedId);
  if(!record||!live(beneficiary)||beneficiary.id===person.id||record.participantIds?.includes(person.id))return city.fail('Escolha outro participante e um esquema acessível ainda ativo.');
  if(!city.transfer(person.accountId,beneficiary.accountId,plan.amount,'Participação clandestina em esquema',{corruptionCaseId:record.id,playerSchemeId:plan.id}))return city.fail('O participante não tem saldo suficiente.');
  record.participantIds??=[];record.participantIds.push(person.id);record.roles??=[];record.roles.push({citizenId:person.id,role:'financiador e integrante do esquema'});record.partyAffiliations??=[];record.partyAffiliations.push({citizenId:person.id,partyId:s.partyId});record.steps.push(p.corruptionStep(person.accountId,beneficiary.accountId,plan.amount,'Ingresso financeiro no esquema'));record.severity=Math.min(100,record.severity+5);result=record;
 }else{
  const justice=city.justice,methods={police:'offerPoliceBribe',judge:'offerJudgeBribe',forensic:'offerForensicBribe'};
  result=plan.kind==='witness'?justice.offerWitnessBribe(plan.caseId,person.id,plan.targetId,plan.amount):justice[methods[plan.kind]](plan.caseId,person.id,plan.amount);
 }
 if(!result)return city.fail('Execução recusada: confira saldo, participantes, fase do processo e proximidade física. Subornos exigem encontro no mesmo local.');
 plan.status=result.status==='refused'?'refused':'executed';plan.executedAt=city.minute;if(person.partyMeeting?.schemeId===plan.id){person.partyMeeting=null;if(person.task==='party-meeting'){person.task=null;person.targetId=null;person.path=[];}}plan.resultCaseId=result.id??result.caseId??null;plan.resultCrimeIds=result.caseIds?[...result.caseIds]:[];plan.corruptionCaseId=['embezzlement','favoritism','kickback','join'].includes(plan.kind)?result.id:null;return result;
}
export function renderPartyNetwork(ui,p,act){
 const city=ui.city,s=city.mayorCampaign,gov=city.politics;
 const sections=[['institutions','Órgãos públicos'],['companies','Empresas dos filiados'],['schemes','Planos clandestinos']];
 const section=ui.partyNetworkSection||'institutions';ui.selectControl(p,'Área de influência',sections,section,value=>{ui.partyNetworkSection=value;});
 const members=city.citizens.filter(c=>live(c)&&c.political?.partyId===s.partyId&&city.society.isAdult(c)),person=members.find(c=>c.id===ui.networkMember)||members[0];
 if(!person){p.note('Sem filiados disponíveis.');return;}
 ui.selectControl(p,'Filiado responsável',members.map(c=>[c.id,c.entity.properties.name]),person.id,value=>{ui.networkMember=Number(value);});
 if(section==='institutions'){
  const organs=city.buildings.filter(b=>b.active&&!b.entity.destroyed&&['iml','police_station','courthouse'].includes(b.type)),b=organs.find(b=>b.id===ui.networkOrgan)||organs[0];
  p.note('Inscrições seguem o recrutamento normal. Indicação política, disponível no governo, ocupa vaga real e gera caso de favorecimento. A indicação paga uma vantagem de 100 na moeda atual ao beneficiário. Habilitação e impedimentos judiciais continuam valendo.');
  if(!b){p.note('A cidade ainda não possui órgãos ativos nesta área.');return;}
  ui.selectControl(p,'Órgão público',organs.map(b=>[b.id,`${b.entity.properties.name} · ${openPositions(city,b)} vagas`]),b.id,value=>{ui.networkOrgan=Number(value);});
  p.kv('Qualificação',qualification(city,person,b).reason||'Elegível');
  p.buttons([{label:'INSCREVER NO RECRUTAMENTO',click:()=>act('partyPlacement',{command:'apply',citizenId:person.id,buildingId:b.id})},{label:'INDICAÇÃO POLÍTICA',click:()=>act('partyPlacement',{command:'patronage',citizenId:person.id,buildingId:b.id})}]);
  p.heading('PRESENÇA DO PARTIDO');for(const organ of organs)p.kv(organ.entity.properties.name,(organ.workers||[]).map(id=>member(city,id)?.entity.properties.name).filter(Boolean).join(', ')||'Sem filiados');
  return;
 }
 const firms=city.buildings.filter(b=>owns(city,b)),firm=firms.find(b=>b.id===ui.networkFirm)||firms[0];
 if(firm)ui.selectControl(p,'Empresa de filiado',firms.map(b=>[b.id,b.entity.properties.name]),firm.id,value=>{ui.networkFirm=Number(value);});
 if(section==='companies'){
  if(!firm){p.note('Nenhum filiado possui empresa privada ativa.');return;}
  p.kv('Caixa',formatMoney(firm.balance));p.kv('Empregados',firm.workers.length);p.windowLink('ABRIR EMPRESA',()=>ui.openBuilding(firm.id));
  ui.selectControl(p,'Decisão empresarial',[['fund','Aporte do proprietário'],['wage','Salário e recrutamento'],['price','Preço de venda'],['hire','Aprovar contratação'],['dismiss','Demitir funcionário']],ui.partyBusinessCommand||'fund',value=>{ui.partyBusinessCommand=value;});
  const command=ui.partyBusinessCommand||'fund';
  if(command==='fund')for(const value of [100,500,1000])p.button(`APORTAR ${formatMoney(city.currency.price(value))}`,()=>act('partyBusiness',{command:'fund-business',buildingId:firm.id,amount:city.currency.price(value)}));
  if(command==='wage'){
   for(const factor of [.9,1,1.1])p.button(`SALÁRIO BASE ${((firm.baseWage||5)*factor).toFixed(1)} · CONTRATAÇÃO MANUAL`,()=>act('partyBusiness',{command:'employment',buildingId:firm.id,baseWage:(firm.baseWage||5)*factor,minSkill:firm.hiringPolicy?.minSkill||0,allowTraining:true,manualHiring:true}));
   p.button('RETOMAR CONTRATAÇÃO AUTOMÁTICA',()=>act('partyBusiness',{command:'employment',buildingId:firm.id,baseWage:firm.baseWage||5,minSkill:firm.hiringPolicy?.minSkill||0,allowTraining:true,manualHiring:false}));
  }
  if(command==='price'){
   const goods=Object.keys(firm.inventory||{}).filter(g=>playerGoods(city).includes(g)),good=goods.includes(ui.partyBusinessGood)?ui.partyBusinessGood:goods[0];
   if(good){ui.selectControl(p,'Produto',goods.map(g=>[g,city.economy.goods[g].label||g]),good,value=>{ui.partyBusinessGood=value;});for(const factor of [.9,1,1.2])p.button(`PREÇO ${formatMoney(Math.ceil(city.economy.goods[good].price*factor))}`,()=>act('partyBusiness',{command:'price',buildingId:firm.id,good,amount:Math.ceil(city.economy.goods[good].price*factor)}));}
  }
  if(command==='hire')for(const c of city.citizens.filter(c=>c.career?.applications.some(a=>a.buildingId===firm.id&&a.status==='análise')).slice(0,10))p.button(`APROVAR ${c.entity.properties.name}`,()=>act('partyBusiness',{command:'hire-applicant',buildingId:firm.id,citizenId:c.id}));
  if(command==='dismiss')for(const id of firm.workers.slice(0,10))p.button(`DEMITIR ${city.society.citizen(id)?.entity.properties.name}`,()=>act('partyBusiness',{command:'dismiss',buildingId:firm.id,citizenId:id}));
  p.note('Aportes usam o saldo do proprietário. Preços, salários e contratações afetam a operação real. Favorecimento público e repasses clandestinos ficam nos planos clandestinos.');return;
 }
 p.note('Planeje primeiro, execute depois. Dinheiro deixa rastros; recusas podem gerar denúncias. Investigadores, peritos e juízes podem ser afastados ou condenados.');
 ui.selectControl(p,'Tipo de plano',Object.entries(SCHEMES),ui.partySchemeKind||'kickback',value=>{ui.partySchemeKind=value;});
 ui.selectControl(p,'Valor do plano',[[100,'100'],[500,'500'],[1000,'1.000'],[5000,'5.000']],ui.partySchemeAmount||100,value=>{ui.partySchemeAmount=Number(value);});
 const kind=ui.partySchemeKind||'kickback',cases=kind==='join'?gov.corruption.filter(r=>!r.archived&&(r.discoveredAt!=null||r.partyId===s.partyId||r.participantIds?.some(id=>member(city,id)))):kind==='forensic'?city.justice.bodies.filter(b=>b.status==='autopsy'):city.justice.cases.filter(r=>['investigating','charged','arrested'].includes(r.status));
 const record=cases.find(r=>r.id===ui.partySchemeCase)||cases[0];
 if(['police','judge','forensic','witness','join'].includes(kind)&&record)ui.selectControl(p,'Processo / corpo',cases.map(r=>[r.id,`#${r.id} · ${r.status}`]),record.id,value=>{ui.partySchemeCase=Number(value);});
 const witness=city.society.citizen(ui.partySchemeWitness)||city.citizens.find(c=>live(c)&&c.id!==person.id);
 if(kind==='witness'&&witness)ui.selectControl(p,'Testemunha',city.citizens.filter(c=>live(c)&&c.id!==person.id).map(c=>[c.id,c.entity.properties.name]),witness.id,value=>{ui.partySchemeWitness=Number(value);});
 p.button('REGISTRAR PLANO SEM EXECUTAR',()=>act('partySchemePlan',{kind,citizenId:person.id,buildingId:firm?.id,caseId:record?.id,targetId:witness?.id,amount:city.currency.price(ui.partySchemeAmount||100)}));
 for(const plan of (s.schemes||[]).slice(-8).reverse()){
  p.status(`#${plan.id} · ${SCHEMES[plan.kind]}`,`${plan.status} · ${formatMoney(plan.amount)}`);
  p.kv('Articulador',city.society.citizen(plan.citizenId)?.entity.properties.name||'Indisponível');
  if(plan.buildingId)p.kv('Empresa vinculada',city.building(plan.buildingId)?.entity.properties.name||'Indisponível');
  if(plan.caseId!=null)p.kv('Processo / corpo',`#${plan.caseId}`);
  for(const id of plan.resultCrimeIds||[])p.windowLink(`PROCESSO DE SUBORNO #${id}`,()=>ui.openPanel({tab:'justice',justiceCaseId:id}));
  if(plan.status==='planned'&&['police','judge','forensic','witness'].includes(plan.kind)){const target=partySchemeTarget(city,plan);p.button('ENCAMINHAR ARTICULADOR AO ENCONTRO',()=>act('partySchemeMeet',{schemeId:plan.id}));if(target)p.button('LOCALIZAR ALVO',()=>ui.camera?.(target.entity.x,target.entity.y));}
  if(plan.status==='planned')p.buttons([{label:'EXECUTAR PLANO',click:()=>act('partySchemeExecute',{schemeId:plan.id})},{label:'CANCELAR PLANO',click:()=>act('partySchemeCancel',{schemeId:plan.id})}]);
  if(plan.corruptionCaseId)p.windowLink('ACOMPANHAR CASO',()=>ui.openCorruption(plan.corruptionCaseId));
 }
}
