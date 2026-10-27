import {syncCorruptionVotes} from './city_corruption_votes.js';
import {VEHICLE_SPECS} from './city_vehicles.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const INTERVENTIONS={
  praise:{label:'Destacar boas ações',group:'opinion',description:'Divulga um perfil favorável, melhora reputação e alcança parte dos moradores.'},
  rumor:{label:'Espalhar um boato',group:'opinion',description:'Tenta prejudicar a imagem. Pessoas críticas podem desconfiar; o efeito enfraquece com o tempo.'},
  correction:{label:'Publicar esclarecimento',group:'opinion',description:'Corrige boatos das intervenções e divulga a correção aos moradores alcançados.'},
  expose:{label:'Vazar documentos de corrupção',group:'opinion',description:'Expõe um esquema existente envolvendo a pessoa; não inventa um crime.'},
  shield:{label:'Obstruir uma investigação',group:'opinion',description:'Dificulta a coleta de novas provas, preservando as provas e o conhecimento já públicos.'},
  endorsement:{label:'Divulgar apoio à candidatura',group:'campaign',description:'Apresenta a candidatura e a promessa a uma amostra de moradores.'},
  debate:{label:'Organizar debate público',group:'campaign',description:'Apresenta todos os candidatos; preparo, comunicação e afinidade influenciam a reação individual.'},
  rally:{label:'Organizar ato de rua',group:'campaign',description:'Mobiliza moradores disponíveis para fazer campanha presencial. Precisa de equipe e verba partidária.'},
  rigPoll:{label:'Comprar adulteração de pesquisa',group:'campaign',description:'Usa dinheiro do partido para adulterar uma pesquisa eleitoral publicada. Abre um esquema real de corrupção; provas podem levar à correção pública.'},
  partyFunding:{label:'Aporte ao fundo do partido',group:'campaign',description:'Transfere verba municipal para o partido escolhido; favorecimento gera desgaste político.',cost:25000},
  businessFunding:{label:'Financiar empresa',group:'economy',description:'Transfere capital municipal para custeio, salários e compras da empresa escolhida.',cost:100000},
  importVehicle:{label:'Importar veículo',group:'economy',description:'Compra externa explícita: entrega um veículo ao cidadão escolhido, sem depender da produção local.'},
  ride:{label:'Solicitar passeio de bicicleta ou patins',group:'economy',description:'O proprietário ou funcionário busca o equipamento e segue por um caminho real na cidade.'},
  divineBlessing:{label:'Benção: restaurar necessidades',group:'god',description:'Restaura imediatamente as necessidades e o ânimo da pessoa escolhida.'},
  divineInspiration:{label:'Faísca de talento',group:'god',description:'Dá experiência imediata à habilidade mais baixa da pessoa escolhida.'},
  divineRepair:{label:'Reparo instantâneo',group:'god',description:'Restaura imediatamente a condição do prédio escolhido.'},
  divineHarvest:{label:'Acelerar lavoura',group:'god',description:'Leva as plantações ativas da fazenda diretamente à maturidade.'},
};
export class CityInterventions {
  constructor(city){this.city=city;this.records=[];this.nextId=1;this.cooldowns=new Map();}
  perform(kind,targetId=null,options={}){
    const city=this.city,p=city.politics,spec=INTERVENTIONS[kind];if(!spec)return city.fail('Intervenção desconhecida.');
    const key=`${kind}:${targetId??'city'}`;if(spec.group!=='god'&&city.minute-(this.cooldowns.get(key)??-Infinity)<30)return city.fail('Aguarde 30 minutos da cidade para repetir esta intervenção no mesmo alvo.');
    const c=city.society.citizen(targetId),e=p.active,n=e?.candidates.find(n=>n.citizenId===targetId),record={id:this.nextId,kind,title:spec.label,targetId,minute:city.minute,affected:0,cost:0,description:'',truth:kind!=='rumor'};
    const live=c&&!c.entity.destroyed;if(['opinion','campaign','god'].includes(spec.group)&&!['debate','divineRepair','divineHarvest'].includes(kind)&&!live)return city.fail('Selecione uma pessoa viva.');
    if(spec.group==='campaign'&&(!e||e.status!=='campaign'))return city.fail('Esta intervenção precisa de uma campanha eleitoral em andamento.');
    if(['endorsement','rally','rigPoll'].includes(kind)&&!n)return city.fail('Selecione um candidato a prefeito desta eleição.');
    const audience=()=>p.campaigns.audience(Math.max(1,Math.ceil(city.citizens.length*.25)));
    const remember=(v,target,effect,message,truth=true)=>{p.initializeCitizen(v);p.remember(v,{kind:'observer-opinion',interventionId:record.id,electionId:null,candidateId:target.id,partyId:target.political?.partyId,truth,believes:effect!==0,effect,promiseKey:`observer:${record.id}:${target.id}`,description:message});record.affected++;};
    const pay=(to,amount,reason)=>{if(!Number.isSafeInteger(amount)||amount<1||city.treasury-amount<city.welfare.conditions().reserve)return city.fail('O caixa municipal não tem saldo livre para esta intervenção.');if(!city.transfer('treasury',to,amount,reason,{kind:'observer-intervention',interventionId:record.id,targetId}))return false;record.cost+=amount;return true;};
    if(kind==='praise'||kind==='rumor'){
      p.initializeCitizen(c);for(const voter of audience()){const believes=kind==='praise'||city.random()<clamp(.85-(voter.political?.criticalSense??.5)*.7,.1,.8);remember(voter,c,believes?(kind==='praise'?5:-7):0,kind==='praise'?`Conheceu uma divulgação favorável sobre ${c.entity.properties.name}.`:`Ouviu um boato sobre ${c.entity.properties.name}; ${believes?'acreditou':'desconfiou'}.`,kind==='praise');}
      if(kind==='rumor'){const believers=city.citizens.filter(v=>v.political?.memories.some(m=>m.interventionId===record.id&&m.effect<0)).length;record.reputationDelta=-Math.round(4*believers/Math.max(1,record.affected));city.reputation.observe(c.accountId,'civic',record.reputationDelta,'boato divulgado pelo observador',{interventionId:record.id});}
      if(kind==='praise'){city.reputation.observe(c.accountId,'civic',5,'divulgação favorável do observador',{interventionId:record.id});c.political.popularity=clamp((c.political.popularity??50)+3,0,100);}
      record.description=`${kind==='praise'?'Perfil favorável':'Boato'} sobre ${c.entity.properties.name}; ${record.affected} moradores alcançados.`;
    }else if(kind==='correction'){
      for(const voter of city.citizens){if(voter.entity.destroyed)continue;let corrected=0;voter.political?.memories.forEach((m,i)=>{if(m.kind==='observer-opinion'&&m.candidateId===c.id&&!m.truth&&!m.corrected){voter.political.memories[i]=Object.freeze({...m,effect:0,corrected:true,description:'Conheceu a correção do boato divulgado pelo observador.'});corrected++;}});if(corrected)record.affected++;}for(const old of this.records.filter(r=>r.kind==='rumor'&&r.targetId===c.id&&!r.correctedAt)){old.correctedAt=city.minute;if(old.reputationDelta)city.reputation.observe(c.accountId,'civic',-old.reputationDelta,'correção de boato divulgado pelo observador',{interventionId:record.id});}record.description=`Esclarecimento sobre ${c.entity.properties.name}: ${record.affected} moradores corrigiram a informação.`;
    }else if(kind==='expose'||kind==='shield'){
      const cases=p.corruption.filter(s=>!s.archived&&(s.accusedId===c.id||s.participantIds?.includes(c.id))).sort((a,b)=>(b.severity||0)-(a.severity||0)),crime=options.caseId!=null?cases.find(s=>s.id===options.caseId):cases[0];if(!crime)return city.fail('Esta pessoa não está ligada a um esquema ativo conhecido pela simulação.');record.caseId=crime.id;
      if(kind==='expose'){crime.discoveredAt??=city.minute;crime.evidence=Math.min(1,(crime.evidence||0)+.45);if(!p.scandals.includes(crime))p.scandals.push(crime);crime.awareIds??=[];for(const voter of audience()){if(!crime.awareIds.includes(voter.id))crime.awareIds.push(voter.id);remember(voter,c,-(crime.proven?12:4),`Conheceu documentos do caso #${crime.id}, ${crime.proven?'comprovado':'ainda sob investigação'}.`);}syncCorruptionVotes(p,crime);record.description=`Documentos do caso #${crime.id} divulgados; novas provas e ${record.affected} moradores informados.`;}
      else{crime.concealment=clamp((crime.concealment??.4)+.2,0,.95);crime.coverUps=(crime.coverUps||0)+1;record.description=`Obstrução do caso #${crime.id}: descoberta de novas provas ficou mais difícil.`;}
    }else if(kind==='endorsement'){
      for(const voter of audience()){p.campaigns.hearPromises(voter,n,e,'Apoio divulgado pelo observador');remember(voter,c,3,`Conheceu um apoio público à candidatura de ${n.name}.`);}record.description=`Apoio a ${n.name} divulgado a ${record.affected} moradores.`;
    }else if(kind==='debate'){
      const listeners=audience();for(const voter of listeners)for(const candidate of e.candidates){const person=city.society.citizen(candidate.citizenId);if(!person||person.entity.destroyed)continue;p.campaigns.hearPromises(voter,candidate,e,'Debate público organizado pelo observador');const fit=1-p.distance(voter.political.ideology,p.party(candidate.partyId).ideology)/2.8,performance=((person.skills.social||0)+(person.skills.governance||0))/200;remember(voter,person,clamp((fit+performance-1)*5,-4,4),`Avaliou ${candidate.name} num debate público.`);}record.description=`Debate com ${e.candidates.length} candidaturas e ${listeners.length} moradores; reações individuais.`;
    }else if(kind==='rally'){
      const funds=p.partyAccount(p.party(n.partyId)),before=funds.balance;for(let i=0;i<6;i++)p.campaigns.recruit(n,e);const participants=p.campaigns.rally(n,e);record.cost=Math.max(0,before-funds.balance);
      record.affected=participants||city.citizens.filter(c=>c.task==='campaign'&&c.campaign?.partyId===n.partyId).length;if(!record.affected)return city.fail('Nenhum novo militante disponível: confira horário, necessidades e caixa partidário.');record.description=`Ato de ${n.name}: ${record.affected} moradores mobilizados nas ruas.`;
    }else if(kind==='rigPoll'){
      const poll=options.pollId!=null?e.polls.find(poll=>poll.id===options.pollId&&!poll.manipulated):[...e.polls].reverse().find(poll=>!poll.manipulated),institute=poll&&city.building(poll.instituteId),director=institute&&p.getResearch().staff(institute)[0];if(!poll||!institute||!director)return city.fail('Não há pesquisa publicada sem adulteração e com direção disponível.');
      const amount=city.currency.price(300000+poll.sampleSize*10000),account=p.partyAccount(p.party(n.partyId));if(account.balance<amount)return city.fail(`O partido precisa de R$ ${(amount/100).toFixed(2)} para comprar a adulteração.`);
      const crime=p.crime(c,'poll-rigging',account.accountId,institute.accountId,amount,{studyId:poll.studyId,pollId:poll.id,electionId:e.id,buildingId:institute.id,targetCandidateId:c.id,participantIds:[c.id,director.id],roles:[{citizenId:c.id,role:'Contratante da adulteração'},{citizenId:director.id,role:'Direção do instituto'}]});if(!crime)return city.fail('Não foi possível financiar o esquema.');crime.severity=75;crime.concealment=.65;record.caseId=crime.id;record.cost=amount;
      poll.originalPublishedResults=poll.results;poll.originalPublishedUndecided=poll.undecided;const forged=poll.results.map(r=>({...r})),favored=forged.find(r=>r.candidateId===c.id);if(favored){let needed=Math.max(1,Math.floor(poll.sampleSize*.2)),take=Math.min(needed,poll.undecided);poll.undecided-=take;favored.intentions+=take;needed-=take;for(const other of forged.filter(r=>r!==favored).sort((a,b)=>b.intentions-a.intentions)){take=Math.min(needed,other.intentions);other.intentions-=take;favored.intentions+=take;needed-=take;}poll.results=forged.map(Object.freeze);}poll.manipulated=true;poll.corruptionCaseId=crime.id;const study=p.getResearch().studies.find(s=>s.id===poll.studyId);if(study)study.corruptionCaseId=crime.id;record.truth=false;const leader=poll.results.slice().sort((a,b)=>b.intentions-a.intentions)[0];if(leader)for(const voter of audience()){p.remember(voter,{kind:'published-poll',electionId:e.id,studyId:poll.studyId,partyId:leader.partyId,candidateId:leader.candidateId,effect:Math.min(3,leader.intentions/Math.max(1,poll.sampleSize)*3),description:'Conheceu a divulgação adulterada de uma pesquisa eleitoral.'});record.affected++;}record.description=`Pesquisa #${poll.id} adulterada para favorecer ${n.name}; caso de corrupção #${crime.id}. Entrevistas originais e votos nas urnas foram preservados.`;
    }else if(kind==='partyFunding'){
      const party=p.party(c.political?.partyId);if(!party?.active)return city.fail('A pessoa escolhida não tem partido ativo.');if(!pay(p.partyAccount(party).accountId,city.currency.price(spec.cost),'Intervenção: aporte direcionado ao fundo partidário'))return false;
      for(const voter of audience())remember(voter,c,-2,`Desaprovou o aporte público direcionado a ${party.short}.`);record.description=`${party.short} recebeu verba municipal direcionada; houve reação ao favorecimento.`;
    }else if(kind==='businessFunding'){
      const b=city.building(targetId);if(!b?.active||b.entity.destroyed)return city.fail('Selecione uma empresa ativa.');if(!pay(b.accountId,city.currency.price(spec.cost),'Intervenção: capital para empresa'))return false;record.description=`Aporte municipal em ${b.entity.properties.name}; compras e trabalho continuam sendo necessários.`;record.buildingId=b.id;
    }else if(kind==='importVehicle'){
      if(!live)return city.fail('Selecione quem receberá o veículo.');const good=options.good||'bicicleta',system=city.vehicles,building=city.buildings.find(b=>b.type==='townhall'&&!b.entity.destroyed);if(!VEHICLE_SPECS[good]||!building)return city.fail('Veículo ou ponto de entrega indisponível.');
      if(!city.accounts.has('external-trade'))city.accounts.set('external-trade',{name:'Comércio exterior',balance:0,totalRevenue:0,totalExpenses:0});if(!pay('external-trade',Math.ceil(city.economy.goods[good].price*1.5),'Intervenção: importação de veículo'))return false;
      const signature=`imported:${good}`;let model=system.models.get(signature);if(!model){model={id:system.nextModelId++,signature,kind:good,manufacturerId:null,brand:'Importação',name:VEHICLE_SPECS[good].label,components:[],createdAt:city.minute,imported:true};system.models.set(signature,model);}const id=system.nextId;system.registerUnits(building,good,1,model.id);const v=system.units.get(id);system.activate(v,c.accountId,building);v.imported=true;v.ownershipHistory=[{minute:city.minute,from:'external-trade',to:c.accountId,price:record.cost,reason:'Importação pelo observador'}];city.economy.initialStock[good]=(city.economy.initialStock[good]||0)+1;record.vehicleId=id;record.description=`${VEHICLE_SPECS[good].label} #${id} importado para ${c.entity.properties.name}. Usa força humana para circular nas ruas.`;
    }else if(kind==='divineBlessing'){
      for(const need of Object.keys(c.needs))c.needs[need]=Math.min(100,(c.needs[need]||0)+45);
      c.happiness=clamp((c.happiness||0)+18,0,100);c.mood=clamp((c.mood||0)+24,0,100);record.affected=1;
      record.description=`${c.entity.properties.name} recebeu uma benção: necessidades restauradas e ânimo renovado.`;
    }else if(kind==='divineInspiration'){
      const entries=Object.entries(c.skills||{});if(!entries.length)return city.fail('Esta pessoa ainda não tem habilidades para inspirar.');
      const [skill,value]=entries.sort((a,b)=>a[1]-b[1])[0];c.skills[skill]=clamp(value+20,0,100);record.affected=1;record.skill=skill;
      record.description=`${c.entity.properties.name} recebeu uma faísca de talento em ${skill}: ${value} → ${c.skills[skill]}.`;
    }else if(kind==='divineRepair'){
      const b=city.building(targetId);if(!b||b.entity.destroyed)return city.fail('Selecione um prédio existente.');
      const previous=b.condition??100;b.condition=100;b.repairNeeded=false;b.maintenanceNeeded=false;record.affected=1;record.buildingId=b.id;
      record.description=`${b.entity.properties.name} foi reparado instantaneamente (${Math.round(previous)}% → 100%).`;
    }else if(kind==='divineHarvest'){
      const b=city.building(targetId);if(!b||b.entity.destroyed||b.type!=='farm')return city.fail('Selecione uma fazenda.');
      const fields=b.fields?.filter(f=>f.plantedAt!==null&&f.plantedAt!==undefined)||[];if(!fields.length)return city.fail('Esta fazenda não tem plantações ativas para acelerar.');
      const maturity=({arroz:150,alface:75,tomate:100,girassol:180,maca:180,goiaba:160,trigo:120,milho:100,mandioca:200,cebola:140,feijao:150,coentro:80})[b.crop]||120;
      for(const field of fields)field.plantedAt=Math.min(field.plantedAt,city.minute-maturity);
      record.affected=fields.length;record.buildingId=b.id;record.description=`${fields.length} canteiros de ${b.entity.properties.name} amadureceram agora; os funcionários já podem colher.`;
    }else if(kind==='ride'){
      const system=city.vehicles,v=system.units.get(targetId);if(!v?.active||v.scrapped||v.driverId||v.condition<=15)return city.fail('Escolha um equipamento conservado e sem usuário ocupado.');
      const owner=city.accounts.get(v.ownerAccountId)?.entity?.properties.citizen,company=city.buildings.find(b=>b.accountId===v.ownerAccountId),people=owner?[owner]:(company?.workers||[]).map(id=>city.society.citizen(id)),rider=people.find(c=>c&&!c.entity.destroyed&&city.society.isAdult(c)&&!c.mobilityTrip&&!c.deliveryId&&!c.cleaningJobId&&!c.researchAssignment&&!c.campaign&&!c.conversation&&!city.urgentNeed(c));
      if(!rider)return city.fail('Não há usuário disponível ligado ao proprietário.');
      const entry=city.findPath(rider.entity,v),destination=p.campaigns.streetPoints(96,v).sort((a,b)=>Math.hypot(b.x-v.x,b.y-v.y)-Math.hypot(a.x-v.x,a.y-v.y)).find(point=>Math.hypot(point.x-v.x,point.y-v.y)>2&&city.findPath(v,point)!==null);
      if(entry===null||!destination)return city.fail('Não há caminho acessível para o passeio.');
      v.driverId=rider.id;rider.mobilityTrip={kind:'cycle',vehicleId:v.id,goal:destination,stage:'boarding'};rider.path=entry;rider.indoorLocation=null;rider.task=null;record.vehicleId=v.id;record.affected=1;record.description=`Passeio com ${VEHICLE_SPECS[v.good].label.toLowerCase()} solicitado para ${rider.entity.properties.name}.`;
    }

    this.nextId++;this.cooldowns.set(key,city.minute);record.eventId=city.log(`Intervenção do observador: ${record.description}`,'government',live&&(spec.group!=='economy'||kind==='importVehicle')?[c.id]:[],{kind:'observer-intervention',interventionId:record.id,action:kind,targetId,buildingId:record.buildingId,vehicleId:record.vehicleId,corruptionCaseId:record.caseId,amount:record.cost,affected:record.affected,truth:record.truth}).id;this.records.push(record);if(this.records.length>200)this.records.shift();city.lastError='';return record;
  }
}
