import {ROAD_TILES,tileAt} from './city_terrain.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const live=c=>c&&!c.entity.destroyed;
const essential=new Set(['council-session','vote','care','caregiving','food','provisions','workmeal','water','health','energy','toilet','construction','campaign','research','interview']);
export class CityResearch {
  constructor(city){this.city=city;this.studies=[];this.nextId=1;this.lastMinute=null;this.lastSupplyDay=null;}
  institutes(){return this.city.economy.businesses.filter(b=>b.type==='research_institute'&&b.active&&!b.entity.destroyed);}
  demand(){const n=this.institutes().length,pending=this.city.development.projects.filter(p=>p.type==='research_institute'&&!p.cancelled&&p.status!=='completed').length,desired=Math.max(2,Math.min(6,Math.ceil(this.city.citizens.length/200)));return {required:desired,supply:n+pending,score:Math.max(0,(desired-n-pending)*65)};}
  ensureSupply(){
    const city=this.city;if(this.lastSupplyDay===city.day)return;this.lastSupplyDay=city.day;
    // Public commissioning uses the same voted construction, materials and builders as other firms.
    const gov=city.politics,preparing=gov.active||gov.nextElectionAt!=null&&city.minute>=gov.nextElectionAt-gov.termRules.campaignMinutes-3*1440;
    const supply=this.demand();if(supply.supply<supply.required&&preparing){const author=city.politics.council.people()[0];if(author)city.politics.council.propose(author,'build',{buildingType:'research_institute'},'Instalar instituto para garantir pesquisas presenciais');}
  }
  sites(target=Infinity,origin=null){
    const city=this.city,points=[];
    const siteLimit=Math.min(4,Math.max(1,Math.ceil(target/5)));
    let traffic=[...city.traffic].sort((a,b)=>b[1]-a[1]);
    if(origin){const local=traffic.filter(([key])=>{const [x,y]=key.split(',').map(Number);return Math.hypot(x+.5-origin.x,y+.5-origin.y)<=30;});if(local.length)traffic=local;else{const ox=Math.floor(origin.x),oy=Math.floor(origin.y),nearby=[];for(let y=Math.max(0,oy-30);y<=Math.min(city.world.height-1,oy+30);y++)for(let x=Math.max(0,ox-30);x<=Math.min(city.world.width-1,ox+30);x++)if(ROAD_TILES.has(tileAt(city.world,x,y)))nearby.push({x:x+.5,y:y+.5,flow:1,label:`Via ${x}, ${y}`});nearby.sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y));for(const site of nearby){if(points.length>=siteLimit)break;if(points.every(p=>Math.hypot(p.x-site.x,p.y-site.y)>=4))points.push(site);}if(points.length)return points;traffic.sort((a,b)=>{const [ax,ay]=a[0].split(',').map(Number),[bx,by]=b[0].split(',').map(Number);return Math.hypot(ax+.5-origin.x,ay+.5-origin.y)-Math.hypot(bx+.5-origin.x,by+.5-origin.y);});}}
    for(const [key,flow] of traffic){if(points.length>=siteLimit)break;const [x,y]=key.split(',').map(Number);if(!ROAD_TILES.has(tileAt(city.world,x,y))||points.some(p=>Math.hypot(p.x-x-.5,p.y-y-.5)<4))continue;points.push({x:x+.5,y:y+.5,flow:Math.max(1,flow),label:`Via ${x}, ${y}`});}
    if(!points.length)for(const b of city.buildings.filter(b=>b.active&&!b.entity.destroyed).slice(0,siteLimit))points.push({x:b.door.x,y:b.door.y,flow:1,label:b.entity.properties.name});
    return points;
  }
  createStudy(e,b,commission=null){const city=this.city;
      const population=city.citizens.filter(c=>live(c)&&city.society.isAdult(c)).length,minRate=clamp(city.politics.policy.pollMinRate??5,5,10),maxRate=clamp(city.politics.policy.pollMaxRate??20,15,20),minimum=Math.ceil(population*minRate/100),maximum=Math.floor(population*maxRate/100);
      const target=maximum>=minimum&&minimum>0?(commission?minimum:minimum+Math.floor(city.random()*(maximum-minimum+1))):0;
      const s={id:this.nextId++,electionId:e.id,commission:commission?{...commission}:null,instituteId:b.id,instituteName:b.entity.properties.name,requestDay:city.day,requestedAt:city.minute,deadline:e.voteAt,population,cityPopulation:city.citizens.filter(live).length,minRate,maxRate,minimum,maximum,target,status:target?'funding':'insufficient',reason:target?'Aguardando financiamento':'Eleitorado insuficiente para uma amostra inteira dentro dos limites legais',responses:[],respondentIds:new Set(),reservedIds:new Set(),sessions:[],funders:[],funded:0,spent:0,wages:0,sites:this.sites(target,b.door)};
      s.budget=city.currency.price(15000)+Math.max(1,target)*Math.max(city.currency.price(500),b.wage*40);
      const total=s.sites.reduce((n,p)=>n+p.flow,0)||1;
      for(const site of s.sites){site.share=site.flow/total;site.quota=Math.floor(site.share*target);site.interviews=0;}
      let remaining=target-s.sites.reduce((n,p)=>n+p.quota,0);for(const site of s.sites.slice().sort((a,b)=>(b.share*target-b.quota)-(a.share*target-a.quota)))if(remaining-->0)site.quota++;
      s.eventId=city.politics.campaigns.event(e,`${s.instituteName} registrou pesquisa presencial: ${minimum} a ${maximum} entrevistas únicas (${minRate}%–${maxRate}% do eleitorado).`,'research-registered',[],{studyId:s.id,buildingId:b.id}).id;
      this.studies.push(s);if(target)this.fund(s);return s;
  }
  request(e){
    const city=this.city;this.ensureSupply();const institutes=this.institutes();
    e.requiredPolls??=[{key:'mayor',label:'Prefeitura',organizerId:city.economy.mayorId,status:'requested',studyId:null},{key:'council',label:'Câmara municipal',organizerId:city.politics.council.leaderId,status:'requested',studyId:null}];
    for(const [index,commission]of e.requiredPolls.entries()){
      if(commission.studyId!=null)continue;
      commission.organizerId??=commission.key==='mayor'?city.economy.mayorId:city.politics.council.leaderId||city.politics.council.people()[0]?.id||city.economy.mayorId;
      if(!institutes.length){commission.reason='Aguardando instituto construído e com equipe';continue;}
      const institute=institutes[index%institutes.length],study=this.createStudy(e,institute,commission);commission.studyId=study.id;commission.status=study.status;
    }
    for(const b of institutes){
      if(city.minute+1440>=e.voteAt)continue;
      if(this.studies.some(s=>s.electionId===e.id&&s.instituteId===b.id&&(s.requestDay===city.day||['funding','collecting'].includes(s.status))))continue;
      this.createStudy(e,b);
    }
    for(const commission of e.requiredPolls){const study=this.studies.find(s=>s.id===commission.studyId);if(study){commission.status=study.status;commission.pollId=study.pollId??null;commission.reason=study.reason;}}
    while(this.studies.length>96){const removable=this.studies.findIndex(s=>!['funding','collecting'].includes(s.status));if(removable<0)break;this.studies.splice(removable,1);}
  }
  fund(s){
    const city=this.city,b=city.building(s.instituteId);if(!b?.active)return;
    s.lastFundingAt=city.minute;
    if(s.commission){
      if(!s.funded){const amount=Math.ceil(s.budget*1.5);if(city.transfer('treasury',b.accountId,amount,`Serviço: Pesquisa obrigatória da ${s.commission.label}`,{studyId:s.id,electionId:s.electionId,buildingId:b.id,organizerId:s.commission.organizerId,costCenter:s.commission.key,multiplier:1.5})){s.funded=amount;s.funders.push({accountId:'treasury',name:s.commission.label,kind:'contratação obrigatória',organizerId:s.commission.organizerId,amount,minute:city.minute,eventId:city.ledger.at(-1)?.eventId});}}
      s.status=s.funded?'collecting':'funding';s.reason=s.funded?'Pesquisa obrigatória financiada; coleta presencial em preparação':'Obrigação registrada; aguardando caixa público';return;
    }
    const investors=city.citizens.filter(c=>live(c)&&city.society.isAdult(c)&&c.balance>city.currency.price(50000)).sort((a,b)=>b.balance-a.balance).slice(0,12).map(c=>({accountId:c.accountId,reserve:city.currency.price(50000),kind:'investidor privado'}));
    const firms=city.economy.businesses.filter(f=>f.id!==b.id&&!f.municipal&&f.ownerId&&f.active).sort((a,b)=>b.balance-a.balance).slice(0,12).map(f=>({accountId:f.accountId,reserve:city.currency.price(30000)+f.wage*Math.max(1,f.workers.length)*480,kind:'empresa'}));
    for(const source of [...investors,...firms]){
      if(s.funded>=s.budget)break;
      const account=city.accounts.get(source.accountId),amount=Math.min(s.budget-s.funded,Math.floor(Math.max(0,(account?.balance||0)-source.reserve)*.08));
      // Investors fund information and visibility; an investment alone never buys an answer.
      if(amount<city.currency.price(500)||city.random()>.6)continue;
      if(city.transfer(source.accountId,b.accountId,amount,'Investimento em pesquisa presencial',{studyId:s.id,electionId:s.electionId,buildingId:b.id})){s.funded+=amount;s.funders.push({...source,name:city.accountName(source.accountId),amount,minute:city.minute,eventId:city.ledger.at(-1)?.eventId});}
    }
    if(!s.funded){const amount=Math.ceil(s.budget*1.5);if(city.transfer('treasury',b.accountId,amount,'Serviço: Pesquisa eleitoral sem investimento privado',{studyId:s.id,electionId:s.electionId,buildingId:b.id,multiplier:1.5})){s.funded=amount;s.funders.push({accountId:'treasury',name:'Prefeitura',kind:'contrato público de último recurso',amount,minute:city.minute,eventId:city.ledger.at(-1)?.eventId});}}
    s.status=s.funded?'collecting':'funding';s.reason=s.funded?'Equipe preparando coleta presencial':'Sem investimento privado e prefeitura sem caixa';
  }
  staff(b){return [...new Set([b.ownerId,...b.workers])].map(id=>this.city.society.citizen(id)).filter(c=>live(c)&&c.role!=='councilor'&&this.city.society.isAdult(c)&&(c.id===b.ownerId||c.jobId===b.id));}
  releaseInterview(s,session){
    const city=this.city,c=city.society.citizen(session.voterId);s.reservedIds.delete(session.voterId);
    if(c?.pollInterview?.studyId===s.id&&c.pollInterview.sessionId===session.id){const previous=c.pollInterview.previous;c.pollInterview=null;if(c.task==='interview'){if(!city.urgentNeed(c)){c.task=previous.task;c.path=previous.path;c.targetId=previous.targetId;}else{c.task=null;c.path=[];}}}
    session.voterId=null;session.finishAt=null;
  }
  releaseAgent(s,session,reason){
    this.releaseInterview(s,session);const c=this.city.society.citizen(session.agentId);
    if(c?.researchAssignment?.studyId===s.id&&c.researchAssignment.sessionId===session.id){c.researchAssignment=null;if(c.task==='research'){c.task=null;c.path=[];c.targetId=null;}}
    session.status='finished';session.reason=reason;session.endedAt=this.city.minute;
  }
  dispatch(s){
    const city=this.city,b=city.building(s.instituteId),staff=this.staff(b),today=Math.floor(city.minute/1440)*1440;
    if(!s.sites.length||!staff.length){s.reason=!staff.length?'Instituto sem agentes contratados':'Nenhum local acessível para coleta';return;}
    let dispatched=0;
    for(let i=0;i<staff.length&&dispatched<2;i++){
      const c=staff[i],start=today+(8+i%5*2)*60,end=Math.min(s.deadline,start+240);
      if(city.minute<start||city.minute>=end||s.sessions.some(r=>r.agentId===c.id&&r.day===city.day)||c.researchAssignment||c.deliveryId||c.cleaningJobId||c.workMeal||c.conversation||essential.has(c.task)||city.urgentNeed(c)||Math.min(c.needs.food,c.needs.water,c.needs.energy,c.needs.toilet)<40)continue;
      if(s.spent+b.wage>=s.funded||b.balance<b.wage){s.reason='Coleta aguardando recursos para salários';continue;}
      const sites=s.sites.slice().sort((a,b)=>(b.quota-b.interviews)/Math.max(1,b.quota)-(a.quota-a.interviews)/Math.max(1,a.quota));
      for(const site of sites){
        if(site.interviews>=site.quota||s.sessions.some(r=>r.day===city.day&&r.status==='active'&&r.siteIndex===s.sites.indexOf(site)))continue;
        const path=city.findPath(c.entity,site);if(path===null||path.length>60)continue;
        const session={id:s.sessions.length+1,agentId:c.id,agentName:c.entity.properties.name,siteIndex:s.sites.indexOf(site),day:city.day,scheduledAt:start,startedAt:city.minute,until:end,status:'active',interviews:0,nextInterviewAt:city.minute,voterId:null};
        s.sessions.push(session);c.researchAssignment={studyId:s.id,sessionId:session.id};c.path=path;c.task='research';c.targetId=b.id;c.action=`Indo entrevistar em ${site.label}`;dispatched++;break;
      }
    }
  }
  interview(voter,e,agent,site){
    const city=this.city,p=city.politics;p.initializeCitizen(voter);const scores=p.intentions(voter,e.candidates),top=scores[0];if(!top)return null;
    const margin=top.score-(scores[1]?.score??0),knows=margin>=8||voter.political.memories.some(m=>m.electionId===e.id&&m.candidateId===top.candidateId),decided=knows&&city.random()<Math.min(.97,.55+margin/80);
    const approval=clamp(50+(p.approval-50)*.7+(voter.happiness-50)*.12+(voter.homeUnitId?3:-4)+(voter.needs.food>=30?3:-6)+(voter.jobId||voter.businessIds.length?2:-2),0,100);
    const rejected=scores.filter(a=>a.score<40||voter.political.memories.some(m=>m.candidateId===a.candidateId&&(m.kind==='proven-scandal'||m.kind==='defamation'&&m.believes&&!m.corrected))).map(a=>a.candidateId);
    return Object.freeze({citizenId:voter.id,name:voter.entity.properties.name,candidateId:decided?top.candidateId:null,leaningId:top.candidateId,decided,partyId:voter.political.partyId??null,sympathyPartyId:voter.political.sympathyPartyId??null,reason:decided?top.reason:'ainda avaliando propostas e alternativas',approval:Math.round(approval),rejectedIds:Object.freeze(rejected),reasons:Object.freeze(top.reasons.map(r=>Object.freeze({...r}))),interviewedAt:city.minute,agentId:agent.id,agentName:agent.entity.properties.name,x:site.x,y:site.y,siteLabel:site.label});
  }
  fieldWork(c){
    const city=this.city,a=c.researchAssignment,s=this.studies.find(s=>s.id===a?.studyId),session=s?.sessions.find(r=>r.id===a.sessionId),e=city.politics.active,b=city.building(s?.instituteId);
    if(!s||!session||session.status!=='active'||s.status!=='collecting'||e?.id!==s.electionId||e.status!=='campaign'||!b?.active||!live(c)||(c.id!==b.ownerId&&c.jobId!==b.id)){if(session)this.releaseAgent(s,session,'Equipe ou pesquisa indisponível');else{c.task=null;c.researchAssignment=null;}return false;}
    const site=s.sites[session.siteIndex];
    if(city.minute>=session.until||city.urgentNeed(c)||Math.min(c.needs.food,c.needs.water,c.needs.energy,c.needs.toilet)<25||s.responses.length>=s.target||site.interviews>=site.quota){this.releaseAgent(s,session,'Fim do turno, cota concluída ou necessidade pessoal');return false;}
    if(s.spent+b.wage>s.funded||b.balance<b.wage){this.releaseAgent(s,session,'Recursos de coleta esgotados');return false;}
    const before=b.balance;if(c.id!==b.ownerId){if(!city.payWage(c,b,b.wage))return false;s.wages+=before-b.balance;s.spent+=before-b.balance;}
    city.economy.practice(c,'social');
    if(c.path.length){c.action=`Indo entrevistar em ${site.label}`;return true;}
    if(Math.hypot(c.entity.x-site.x,c.entity.y-site.y)>1.5){this.releaseAgent(s,session,'Rota interrompida');return false;}
    c.action=`Entrevistando eleitores: ${s.instituteName}`;
    if(session.voterId!=null){const voter=city.society.citizen(session.voterId);
      if(!live(voter)||voter.task!=='interview'||voter.pollInterview?.studyId!==s.id||voter.pollInterview.sessionId!==session.id||city.urgentNeed(voter)){this.releaseInterview(s,session);return true;}
      if(voter.path.length||Math.hypot(voter.entity.x-c.entity.x,voter.entity.y-c.entity.y)>4)return true;
      session.finishAt??=city.minute+4;
      if(city.minute<session.finishAt)return true;
      if(!s.respondentIds.has(voter.id)&&s.responses.length<s.target){const response=this.interview(voter,e,c,site);if(response){s.respondentIds.add(voter.id);s.responses.push(response);site.interviews++;session.interviews++;city.history.record('government',`${c.entity.properties.name} entrevistou ${response.name} presencialmente.`,[c.accountId,voter.accountId,b.accountId],{kind:'research-interview',studyId:s.id,electionId:e.id,agentId:c.id,citizenId:voter.id,buildingId:b.id,x:site.x,y:site.y,parentEventId:s.eventId});}}
      this.releaseInterview(s,session);session.nextInterviewAt=city.minute+2;return true;
    }
    if(city.minute<session.nextInterviewAt||s.responses.length+s.reservedIds.size>=s.target)return true;session.nextInterviewAt=city.minute+5;
    const candidates=city.citizens.filter(v=>live(v)&&v.id!==c.id&&city.society.isAdult(v)&&!s.respondentIds.has(v.id)&&!s.reservedIds.has(v.id)&&!v.pollInterview&&!v.deliveryId&&!v.cleaningJobId&&!v.workMeal&&!v.conversation&&!essential.has(v.task)&&!city.urgentNeed(v)&&Math.hypot(v.entity.x-c.entity.x,v.entity.y-c.entity.y)<=60).sort((a,b)=>Math.hypot(a.entity.x-c.entity.x,a.entity.y-c.entity.y)-Math.hypot(b.entity.x-c.entity.x,b.entity.y-c.entity.y));
    let voter=null,voterPath=null;
    for(const option of candidates.slice(0,8)){const path=Math.hypot(option.entity.x-c.entity.x,option.entity.y-c.entity.y)<=4?[]:city.findPath(option.entity,c.entity);if(path!==null&&path.length<=60){voter=option;voterPath=path;break;}}
    if(!voter)return true;
    s.reservedIds.add(voter.id);session.voterId=voter.id;session.finishAt=voterPath.length?null:city.minute+4;
    voter.pollInterview={studyId:s.id,sessionId:session.id,previous:{task:voter.task,path:voter.path,targetId:voter.targetId}};voter.path=voterPath;voter.targetId=c.id;voter.task='interview';voter.action=`Indo responder à pesquisa de ${s.instituteName}`;return true;
  }
  respondentWait(c){if(!c.pollInterview){c.task=null;return;}c.action='Respondendo entrevista presencial';}
  manipulate(s,poll,e){
    const city=this.city,p=city.politics,b=city.building(s.instituteId),director=this.staff(b).find(c=>c.id===b.ownerId)||this.staff(b)[0];if(!director||(director.traits?.honesty??.5)>.55)return;
    const organizer=s.commission?city.society.citizen(s.commission.organizerId):null;if(s.commission&&(s.commission.key==='mayor'?p.city.economy.mayorId:p.council.leaderId)!==organizer?.id)return;const preferred=organizer?e.candidates.find(n=>n.partyId===organizer.political?.partyId):null;
    const nominees=(s.commission?(preferred?[{nomination:preferred,c:organizer}]:[]):e.candidates.map(n=>({nomination:n,c:city.society.citizen(n.citizenId)}))).filter(a=>live(a.c)&&a.c.id!==director.id&&(a.c.traits?.honesty??.5)<.5);
    for(const {nomination,c} of nominees){
      if(city.random()>(s.commission?.035:.12))continue;
      const amount=city.currency.price(300000+s.target*10000),firms=city.economy.businesses.filter(f=>{const owner=city.society.citizen(f.ownerId);return f.id!==b.id&&!f.municipal&&f.active&&live(owner)&&(owner.traits?.honesty??.5)<.5&&(owner.id===c.id||owner.political?.partyId===nomination.partyId||(city.relationships.view(owner,c)?.trust||0)>55);}).sort((a,b)=>b.balance-a.balance),payer=s.commission&&city.treasury>=amount+city.welfare.conditions().reserve?{accountId:'treasury',balance:city.treasury}:[c,...firms].find(a=>a.balance>=amount+city.currency.price(50000));if(!payer)continue;
      const financier=payer.ownerId?city.society.citizen(payer.ownerId):c;
      const record=p.crime(c,'poll-rigging',payer.accountId,b.accountId,amount,{studyId:s.id,pollId:poll.id,electionId:e.id,buildingId:b.id,targetCandidateId:nomination.citizenId,organizerId:s.commission?.organizerId,commissioner:s.commission?.key,participantIds:[...new Set([c.id,director.id,financier.id])],roles:[{citizenId:c.id,role:'Contratante da manipulação'},{citizenId:director.id,role:'Direção cúmplice do instituto'},...(financier.id!==c.id?[{citizenId:financier.id,role:'Empresário financiador do pagamento clandestino'}]:[])]});if(!record)continue;
      record.severity=clamp(65+amount/Math.max(1,city.treasury)*500,65,95);record.concealment=.65+(director.skills.social||0)/500;
      record.steps[0].description='Pagamento clandestino por alteração do relatório eleitoral';
      if(director.accountId!==payer.accountId){const share=Math.floor(amount*.4);if(city.transfer(b.accountId,director.accountId,share,'Repasse clandestino pela adulteração',{corruptionCaseId:record.id,studyId:s.id})){record.steps.push(p.corruptionStep(b.accountId,director.accountId,share,'Comissão à direção cúmplice'));}}
      const forged=poll.results.map(r=>({...r})),favored=forged.find(r=>r.candidateId===nomination.citizenId);if(!favored)break;
      let needed=Math.max(1,Math.floor(poll.sampleSize*(.15+city.random()*.2))),shift=Math.min(needed,poll.undecided);poll.undecided-=shift;favored.intentions+=shift;needed-=shift;
      for(const other of forged.filter(r=>r!==favored).sort((a,b)=>b.intentions-a.intentions)){shift=Math.min(needed,other.intentions);other.intentions-=shift;favored.intentions+=shift;needed-=shift;}
      poll.results=forged.map(Object.freeze);poll.corruptionCaseId=record.id;poll.manipulated=true;poll.originalPublishedResults=poll.results;poll.originalPublishedUndecided=poll.undecided;s.corruptionCaseId=record.id;return;
    }
  }
  publish(s,e){
    const city=this.city,n=s.responses.length;if(n<s.minimum||n>s.maximum)return false;
    const results=e.candidates.map(c=>Object.freeze({candidateId:c.citizenId,name:c.name,partyId:c.partyId,partyNumber:c.partyNumber??city.politics.party(c.partyId)?.number,intentions:s.responses.filter(r=>r.candidateId===c.citizenId).length,rejections:s.responses.filter(r=>r.rejectedIds.includes(c.citizenId)).length})),undecided=s.responses.filter(r=>!r.decided).length;
    const finite=s.population>1?Math.sqrt(Math.max(0,s.population-n)/(s.population-1)):0;
    const poll={id:e.polls.length+1,studyId:s.id,commission:s.commission,instituteId:s.instituteId,instituteName:s.instituteName,minute:city.minute,startedAt:s.requestedAt,population:s.population,cityPopulation:s.cityPopulation,sampleSize:n,sampleFraction:n/Math.max(1,s.population),minRate:s.minRate,maxRate:s.maxRate,minimum:s.minimum,maximum:s.maximum,responses:s.responses,results,rawResults:results,undecided,rawUndecided:undecided,approval:s.responses.reduce((sum,r)=>sum+r.approval,0)/n,marginOfError:Math.min(100,1.96*Math.sqrt(.25/n)*finite*Math.sqrt(1.5)*100),designEffect:1.5,funders:s.funders,sites:s.sites,sessions:s.sessions,budget:s.budget,funded:s.funded,spent:s.spent,method:'Entrevistas presenciais por pontos de fluxo, em horários distintos, sem repetição de eleitores. Distribuição proporcional ao fluxo observado; a amostra pode ter viés de local e horário. Margem aproximada com efeito de agrupamento de 1,5.'};
    this.manipulate(s,poll,e);s.status='published';s.reason='Coleta concluída e relatório publicado dentro dos limites de amostragem';s.completedAt=city.minute;s.pollId=poll.id;const obligation=e.requiredPolls?.find(r=>r.studyId===s.id);if(obligation){obligation.status='published';obligation.pollId=poll.id;}
    for(const session of s.sessions.filter(r=>r.status==='active'))this.releaseAgent(s,session,'Pesquisa encerrada');
    const institute=city.building(s.instituteId);city.history.record('service',`${s.instituteName} concluiu pesquisa eleitoral com ${n} entrevistas presenciais.`,[institute.accountId],{kind:'research-service',studyId:s.id,electionId:e.id,pollId:poll.id,buildingId:institute.id,interviews:n,funded:s.funded,wages:s.wages});
    e.polls.push(poll);poll.eventId=city.politics.campaigns.event(e,`${s.instituteName}: pesquisa ${poll.id} publicada com ${n} entrevistas presenciais únicas (${(poll.sampleFraction*100).toFixed(1)}% do eleitorado).`,'election-poll',[],{pollId:poll.id,studyId:s.id,buildingId:s.instituteId,sampleSize:n}).id;
    const leader=poll.results.slice().sort((a,b)=>b.intentions-a.intentions)[0];if(leader)for(const c of city.politics.campaigns.audience(Math.ceil(s.population*.2))){city.politics.initializeCitizen(c);city.politics.remember(c,{kind:'published-poll',electionId:e.id,studyId:s.id,partyId:leader.partyId,candidateId:leader.candidateId,effect:Math.min(3,leader.intentions/n*3),description:`Conheceu a pesquisa de ${s.instituteName}; ${leader.name} aparece à frente.`,eventId:poll.eventId});}
    return true;
  }
  reviewCases(){
    const p=this.city.politics;
    for(const e of [p.active,...p.elections].filter(Boolean))for(const poll of e.polls.filter(r=>r.manipulated&&!r.correctedAt)){
      const record=p.scandals.find(r=>r.id===poll.corruptionCaseId&&r.proven);if(!record)continue;
      poll.correctedAt=this.city.minute;this.city.reputation.observe(this.city.building(poll.instituteId)?.accountId,'commerce',-30,'manipulação de pesquisa comprovada',{studyId:poll.studyId,corruptionCaseId:record.id});poll.results=poll.rawResults;poll.undecided=poll.rawUndecided;
      poll.correctionEventId=p.campaigns.event(e,`${poll.instituteName}: auditoria comprovou manipulação; pesquisa ${poll.id} corrigida com as respostas originais.`,'poll-corrected',record.participantIds,{pollId:poll.id,studyId:poll.studyId,corruptionCaseId:record.id}).id;
      for(const c of this.city.citizens.filter(live)){p.initializeCitizen(c);c.political.memories=c.political.memories.map(m=>m.kind==='published-poll'&&m.studyId===poll.studyId?Object.freeze({...m,effect:0,corrected:true}):m);}
    }
  }
  updateMinute(){
    const city=this.city;if(this.lastMinute===city.minute)return;this.lastMinute=city.minute;const e=city.politics.active;
    for(const s of this.studies.filter(s=>['funding','collecting'].includes(s.status)).sort((a,b)=>Number(!!b.commission)-Number(!!a.commission))){
      const b=city.building(s.instituteId);
      if(!b?.active||b.entity.destroyed||e?.id!==s.electionId||e.status!=='campaign'||city.minute>=s.deadline){
        for(const session of s.sessions.filter(r=>r.status==='active'))this.releaseAgent(s,session,'Fim da coleta');
        if(b?.active&&!b.entity.destroyed&&e?.id===s.electionId&&s.responses.length>=s.minimum)this.publish(s,e);else{s.status='insufficient';const completed=s.sessions.filter(r=>r.status==='finished').length;s.reason=`Coleta encerrou com ${s.responses.length}/${s.minimum} entrevistas únicas; ${completed} turnos de campo concluídos sem completar a amostra.`;}continue;
      }
      if(s.responses.length>=s.target||city.hour>=19&&s.responses.length>=s.minimum){this.publish(s,e);continue;}
      for(const session of s.sessions.filter(r=>r.status==='active')){const c=city.society.citizen(session.agentId);if(!live(c)||c.task!=='research'||c.researchAssignment?.studyId!==s.id||city.minute>=session.until)this.releaseAgent(s,session,'Agente indisponível ou turno encerrado');}
      if((s.status==='funding'||s.funded<s.budget)&&city.minute-(s.lastFundingAt??-Infinity)>=60)this.fund(s);
      if(s.status==='collecting'&&city.minute%10===0)this.dispatch(s);
    }
    if(city.minute%60===0)this.reviewCases();
  }
}
