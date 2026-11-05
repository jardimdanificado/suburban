import {injuryWorkFactor} from './city_injury_effects.js';
/** Career records are independent of the bounded event journal and survive snapshots. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const EMPLOYMENT_SEARCH_OFFSETS=Object.freeze([[12,0],[0,12],[-12,0],[0,-12],[8,8],[-8,8],[-8,-8],[8,-8]]);
export function career(c){const cv=c.career??={jobs:[],applications:[],worked:{},motivation:50};if(cv.pendingInterview&&(cv.pendingInterview.status!=='análise'||!cv.applications.includes(cv.pendingInterview)))cv.pendingInterview=null;return cv;}
export function finishApplication(application,status,reason,decidedAt){
  application.status=status;application.reason=reason;
  if(decidedAt!==undefined)application.decidedAt=decidedAt;
  return Object.freeze(application);
}
export function contract(city,c,b){
  const cv=career(c);let row=cv.jobs.at(-1);
  if(row?.buildingId===b.id&&row.endedAt==null)return row;
  if(row&&row.endedAt==null){row.endedAt=city.minute;row.reason='Mudança de vínculo';}
  row={buildingId:b.id,company:b.entity.properties.name,skill:city.economy.jobSkill(b),startedAt:city.minute,endedAt:null,workedMinutes:0,earned:0,rating:50,paidMinutes:0,unpaidMinutes:0,wageAtStart:b.wage};cv.jobs.push(row);return row;
}
export function employmentEvent(city,c,b,action,reason){
  if(action==='contratação')contract(city,c,b);
  else if(action==='desligamento'){
    const row=career(c).jobs.at(-1);
    if(row?.buildingId===b.id&&row.endedAt==null){row.endedAt=city.minute;row.reason=reason;}
  }
}
export function recordWork(city,c,b,wage,paid){
  const cv=career(c),row=contract(city,c,b);
  if(row.lastMinute===city.minute)return;
  row.lastMinute=city.minute;
  if(!paid){row.unpaidMinutes++;cv.motivation=Math.max(10,cv.motivation-2);return;}
  row.paidMinutes++;row.workedMinutes++;row.earned+=wage;
  cv.worked[row.skill]=(cv.worked[row.skill]||0)+1;
  const floor=Math.max(1,city.currency.price(city.politics.policy.minimumWage||5));
  const target=clamp(40+25*Math.log2(Math.max(1,wage)/floor),10,100);
  cv.motivation+= (target-cv.motivation)*.025;
  const performance=clamp(35+(c.skills[row.skill]||0)*.35+(c.traits?.diligence??.5)*25+cv.motivation*.15,0,100);
  row.rating+=(performance-row.rating)*.005;
}
export function requirements(city,b){
  b.hiringPolicy??={minSkill:['clinic','mint','research_institute','cycle_workshop','bank'].includes(b.type)?15:0,minExperienceMinutes:0,minRating:0,allowTraining:true};
  return b.hiringPolicy;
}
export function qualification(city,c,b){
  if(b.type==='iml'&&c.forensicDisqualifiedAt!=null)return {eligible:false,trainee:false,experience:c.career?.worked?.forensics||0,rating:0,reason:'inabilitado para exercer perícia por condenação judicial'};
  if(b.type==='police_station'&&c.policeDisqualifiedAt!=null)return {eligible:false,trainee:false,experience:c.career?.worked?.investigation||0,rating:0,reason:'inabilitado para o serviço policial por condenação judicial'};
  const policy=requirements(city,b),skill=city.economy.jobSkill(b),cv=career(c),experience=cv.worked[skill]||0;
  let weighted=0,minutes=0;for(const row of cv.jobs)if(row.skill===skill&&row.workedMinutes>0){weighted+=row.rating*row.workedMinutes;minutes+=row.workedMinutes;}
  const rating=minutes?weighted/minutes:50;
  const gaps=[];
  if((c.skills[skill]||0)<policy.minSkill)gaps.push(`habilidade mínima ${policy.minSkill}`);
  if(experience<policy.minExperienceMinutes)gaps.push(`experiência comprovada de ${policy.minExperienceMinutes} minutos`);
  if(rating<policy.minRating)gaps.push(`avaliação mínima ${policy.minRating}`);
  // Entry-level training is explicit; stricter vacancies never fabricate experience.
  const trainee=!!gaps.length&&policy.allowTraining&&policy.minExperienceMinutes===0&&policy.minRating===0;
  return {eligible:!gaps.length||trainee,trainee,experience,rating,reason:gaps.join('; ')||'Requisitos atendidos'};
}
export const RECRUITMENT_RULES=Object.freeze({discoveryRadius:10,discoveryInterval:15,interviewDuration:10,minimumNotice:60});
export function ownerSelfHire(city,b){const owner=city.economy.workingOwner(b);return Number((b.jobs||0)>0&&!!owner&&owner.jobId!==b.id);}
export function occupiedPositions(city,b){return b.workers.length+ownerSelfHire(city,b);}
export function openPositions(city,b){return Math.max(0,b.jobs-occupiedPositions(city,b));}
const vacancyIndexes=new WeakMap();
const vacancyChoiceScratch=[];
const vacancySearchDemandCache=new WeakMap();
function nearbyFirms(city,c){
  let index=vacancyIndexes.get(city);
  if(!index||index.revision!==city.structureRevision||index.length!==city.buildings.length){
    const buckets=new Map();
    for(const b of city.buildings){const key=`${Math.floor(b.door.x/16)},${Math.floor(b.door.y/16)}`;let list=buckets.get(key);if(!list)buckets.set(key,list=[]);list.push(b);}
    index={revision:city.structureRevision,length:city.buildings.length,buckets};vacancyIndexes.set(city,index);
  }
  const result=[],x=Math.floor(c.entity.x/16),y=Math.floor(c.entity.y/16);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const b of index.buckets.get(`${x+dx},${y+dy}`)||[])if(b.active&&!b.entity.destroyed&&openPositions(city,b)>0&&Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y)<=RECRUITMENT_RULES.discoveryRadius)result.push(b);
  return result;
}
export function discoverVacancies(city,c,force=false){
  if(c.entity.destroyed||c.indoorLocation||!city.society.isAdult(c)||city.politics.officeHolder(c)||c.businessIds.length)return;
  const cv=career(c),interval=RECRUITMENT_RULES.discoveryInterval;
  // Give each resident a stable place in the discovery cycle. Without an
  // existing career record, the first eligible minute used to trigger a full
  // population scan at once (hundreds of path searches after founding).
  cv.nextDiscoveryAt??=city.minute+((c.id%interval)+interval)%interval;
  if(!force&&city.minute<cv.nextDiscoveryAt)return;
  cv.nextDiscoveryAt=city.minute+interval;
  cv.knownVacancies??=[];
  for(const b of nearbyFirms(city,c)){
    let entry=cv.knownVacancies.find(v=>v.buildingId===b.id);if(!entry){entry={buildingId:b.id,discoveredAt:city.minute,source:'Anúncio na fachada'};cv.knownVacancies.push(entry);}
    entry.seenAt=city.minute;entry.wage=b.wage;entry.positions=openPositions(city,b);
  }
  if(cv.knownVacancies.length>64)cv.knownVacancies=cv.knownVacancies.sort((a,b)=>b.seenAt-a.seenAt).slice(0,64);
}
function appointmentTime(city,c,b){
  const travel=Math.ceil(Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)*2+(b.officeFloor||0)*5+30);
  let at=Math.ceil((city.minute+Math.max(RECRUITMENT_RULES.minimumNotice,travel))/30)*30;
  const day=Math.floor(at/1440),clock=at%1440;
  if(clock<8*60)at=day*1440+8*60;
  else if(clock>16*60+30)at=(day+1)*1440+8*60;
  return at;
}
function laborAgency(city){const office=city.politics?.secretaries?.find(row=>row.officeId==='labor'),secretary=city.society.citizen(office?.citizenId),building=city.building(office?.buildingId)||city.buildings.find(b=>b.type==='townhall'&&b.active&&!b.entity.destroyed);return secretary&&!secretary.entity.destroyed&&building?.active&&!building.entity.destroyed?{secretary,building}:null;}
function secretaryPresent(city){const agency=laborAgency(city),c=agency?.secretary;return !!(c&&city.hour>=8&&city.hour<17&&c.jobId===agency.building.id&&c.task==='work'&&c.indoorLocation?.buildingId===agency.building.id&&c.indoorLocation.unitId&&!c.indoorLocation.exiting&&!c.path.length);}
function agencyAppointmentTime(city,c,agency){const b=agency.building,travel=Math.ceil(Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)*2+30);let at=Math.ceil((city.minute+Math.max(RECRUITMENT_RULES.minimumNotice,travel))/30)*30;const day=Math.floor(at/1440),clock=at%1440;if(clock<480)at=day*1440+480;else if(clock>=990)at=(day+1)*1440+480;return at;}
function queueApplications(city){
  return city.economy.recruitmentQueue??=city.citizens.flatMap(c=>(c.career?.applications||[]).filter(a=>a.status==='análise').map(application=>({citizenId:c.id,application})));
}
function vacancySearchIndexes(city){
  let index=vacancySearchDemandCache.get(city);if(index?.minute===city.minute)return index;
  const demand=new Map();for(const {application} of queueApplications(city))if(application.status==='análise')demand.set(application.buildingId,(demand.get(application.buildingId)||0)+1);
  index={minute:city.minute,demand};vacancySearchDemandCache.set(city,index);return index;
}
export function apply(city,c,b){
  const cv=career(c),last=cv.applications.findLast(a=>a.buildingId===b.id);
  if(cv.pendingInterview&&!cv.applications.includes(cv.pendingInterview))cv.pendingInterview=null;
  if(last&&last.status==='análise')return last;
  if(last&&city.minute-last.appliedAt<360)return null;
  if(cv.pendingInterview?.status==='análise'||cv.applications.some(a=>a.status==='análise'))return null;
  const agency=laborAgency(city);if(!agency)return null;
  const q=qualification(city,c,b),interviewAt=agencyAppointmentTime(city,c,agency),row={buildingId:b.id,company:b.entity.properties.name,agencyBuildingId:agency.building.id,interviewAt,decideAt:interviewAt+RECRUITMENT_RULES.interviewDuration,resultDueAt:interviewAt+RECRUITMENT_RULES.interviewDuration+RECRUITMENT_RULES.minimumNotice,status:q.eligible?'análise':'reprovado',reason:q.eligible?'Currículo recebido; entrevista na Secretaria do Trabalho agendada.':q.reason,trainee:q.trainee,score:city.economy.hiringScore(c,b),offeredWage:wageFor(city,c,b)};
  const queue=queueApplications(city);cv.applications.push(row);
  if(row.status==='análise'){cv.pendingInterview=row;queue.push({citizenId:c.id,application:row});}
  else {row.decidedAt=city.minute;Object.freeze(row);}
  if(cv.applications.length>48)cv.applications=cv.applications.filter((a,index)=>a.status==='análise'||index>=cv.applications.length-24);
  return row;
}
function considerKnownVacancies(city,c,offers=null,indexes=null){
  const cv=career(c);if(cv.pendingInterview?.status==='análise')return;
  const context=indexes||(!offers?vacancySearchIndexes(city):null);
  const old=city.building(c.jobId),allowed=indexes?.allowed||(offers instanceof Set?offers:offers&&new Set(offers.map(b=>b.id)));
  const demand=context?.demand||new Map();if(!context)for(const {application:a} of queueApplications(city))if(a.status==='análise')demand.set(a.buildingId,(demand.get(a.buildingId)||0)+1);
  const value=b=>wageFor(city,c,b)/Math.max(1,city.currency.price(1))*2+city.economy.hiringScore(c,b)*.2-Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y)*.05-(demand.get(b.id)||0)/Math.max(1,openPositions(city,b))*8,choices=vacancyChoiceScratch;choices.length=0;
  for(const vacancy of cv.knownVacancies||[]){const b=city.building(vacancy.buildingId);if(b&&(!allowed||allowed.has(b.id))&&b.active&&!b.entity.destroyed&&openPositions(city,b)>0&&b.balance>=b.wage*60&&b.id!==c.jobId&&(!old||wageFor(city,c,b)>wageFor(city,c,old)*1.15)&&qualification(city,c,b).eligible&&city.relationships.willingToWork(c,b))choices.push(b);}
  choices.sort((a,b)=>value(b)-value(a)||a.id-b.id);
  for(const b of choices){const queue=queueApplications(city),before=queue.length,application=apply(city,c,b);if(application?.status==='análise'){if(context&&queue.length>before)demand.set(b.id,(demand.get(b.id)||0)+1);return;}}
}
export function reviewMarket(city,offers){
  const profile=city.profileDiagnostics?{eligible:0,discoverMs:0,indexMs:0,listingsMs:0,considerMs:0}:null;
  const posted=offers.filter(b=>openPositions(city,b)>0&&b.balance>=b.wage*60).sort((a,b)=>Number(occupiedPositions(city,a)>0)-Number(occupiedPositions(city,b)>0)||b.wage-a.wage||a.id-b.id).slice(0,64);
  const postedIds=new Set(posted.map(b=>b.id));
  const indexes={allowed:new Set(offers.map(b=>b.id)),demand:new Map()};
  for(const {application} of queueApplications(city))if(application.status==='análise')indexes.demand.set(application.buildingId,(indexes.demand.get(application.buildingId)||0)+1);
  for(const c of city.citizens){
    if(c.entity.destroyed||!city.society.isAdult(c)||city.politics.officeHolder(c)||c.businessIds.length)continue;
    if(profile)profile.eligible++;
    let started=profile?performance.now():0;
    discoverVacancies(city,c);
    if(profile){profile.discoverMs+=performance.now()-started;started=performance.now();}
    const cv=career(c);cv.knownVacancies??=[];
    // Rural employers need the public jobs board: facade signs alone left
    // remote farms permanently invisible to residents working in the centre.
    const known=new Map(cv.knownVacancies.map(v=>[v.buildingId,v]));
    const listings=posted.map(b=>{const entry=known.get(b.id)||{buildingId:b.id,discoveredAt:city.minute,source:'Quadro municipal de empregos'};entry.seenAt=city.minute;entry.wage=b.wage;entry.positions=openPositions(city,b);return entry;});
    cv.knownVacancies=[...listings,...cv.knownVacancies.filter(v=>!postedIds.has(v.buildingId))].slice(0,64);
    if(profile){profile.indexMs+=performance.now()-started;started=performance.now();}
    if(city.minute<(cv.nextSearchAt||0))continue;cv.nextSearchAt=city.minute+(c.jobId?240:30);
    considerKnownVacancies(city,c,offers,indexes);
    if(profile)profile.considerMs+=performance.now()-started;
  }
  if(profile)city.lastReviewMarketProfile={posted:posted.length,...profile};
}
export function searchEmployment(city,c){
  discoverVacancies(city,c);
  const cv=career(c);
  if(cv.nextPersonalVacancyCheckAt==null)cv.nextPersonalVacancyCheckAt=city.minute+((Number(c.id)||0)%5);
  if(city.minute>=cv.nextPersonalVacancyCheckAt){considerKnownVacancies(city,c);cv.nextPersonalVacancyCheckAt=city.minute+5;}
  if(c.career?.pendingInterview?.status==='análise')return false;
  const tileX=Math.floor(c.entity.x),tileY=Math.floor(c.entity.y),searchWindow=Math.floor(city.minute/30),obstacleRevision=city.obstacleRevision||0,structureRevision=city.structureRevision||0;
  const sameSearchState=cv.employmentSearchTileX===tileX&&cv.employmentSearchTileY===tileY&&cv.employmentSearchWindow===searchWindow&&cv.employmentSearchObstacleRevision===obstacleRevision&&cv.employmentSearchStructureRevision===structureRevision;
  if(!sameSearchState&&cv.employmentSearchTileX!==undefined)cv.nextEmploymentSearchAt=city.minute;
  else if(cv.nextEmploymentSearchAt==null)cv.nextEmploymentSearchAt=city.minute+((Number(c.id)||0)%4);
  if(city.minute<(cv.nextEmploymentSearchAt||0))return false;
  // Explore one nearby block per pass and rotate through the neighborhood.
  // Known vacancies are checked above; this lower-priority walk should not
  // launch two A* searches for every resident in the same exploration turn.
  const offsets=EMPLOYMENT_SEARCH_OFFSETS,start=cv.employmentSearchCursor??(c.id+searchWindow)%offsets.length;
  {const [dx,dy]=offsets[start%offsets.length],target={x:tileX+dx+.5,y:tileY+dy+.5};if(city.walkable(Math.floor(target.x),Math.floor(target.y))){const path=city.findPath(c.entity,target);if(path?.length){c.task='walk';c.targetId=null;c.path=path;c.action='Procurando anúncios de emprego pelo bairro';return true;}}}
  cv.employmentSearchCursor=(start+1)%offsets.length;cv.employmentSearchTileX=tileX;cv.employmentSearchTileY=tileY;cv.employmentSearchWindow=searchWindow;cv.employmentSearchObstacleRevision=obstacleRevision;cv.employmentSearchStructureRevision=structureRevision;cv.nextEmploymentSearchAt=city.minute+4;
  return false;
}
export function routeToInterview(city,c){
  if(c.sleep?.active||c.sleep?.minutes>0)return false;
  const a=c.career?.pendingInterview;if(!a||a.status!=='análise'||a.submittedAt!=null)return false;
  const b=city.building(a.agencyBuildingId);if(!b?.active||b.entity.destroyed)return false;
  const lead=Math.max(30,Math.ceil(Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)*2+15));
  if(city.minute<a.interviewAt-lead)return false;
  if(c.task==='job-interview'&&c.targetId===b.id)return true;
  if(c.deliveryId||c.cleaningJobId||c.informalJobId||c.mobilityTrip||c.ridingVehicleId||c.workMeal||c.conversation||['caregiving','care','vote','council-session','interview'].includes(c.task))return false;
  const path=city.findPath(c.entity,b.door);if(path===null)return false;
  c.task='job-interview';c.targetId=b.id;c.path=path;c.action='Indo à entrevista na Secretaria do Trabalho';return true;
}
function releaseInterview(c,a){
  if(c.career?.pendingInterview===a)c.career.pendingInterview=null;
  if(c.task==='job-interview'&&c.targetId===a.agencyBuildingId){c.task=null;c.targetId=null;c.path=[];c.action=a.resultReceivedAt!=null?'Resultado do processo seletivo recebido':a.submittedAt!=null?'Currículo entregue; aguardando o resultado':`Entrevista encerrada: ${a.reason}`;}
}
export function advanceRecruitment(city){
  const queue=queueApplications(city),sessions=new Map();
  for(const {citizenId,application:a} of queue){
    if(a.status!=='análise')continue;
    const c=city.society.citizen(citizenId),b=city.building(a.buildingId);
    if(c&&!c.career?.applications.includes(a)){finishApplication(a,'retirado','Inscrição retirada',city.minute);releaseInterview(c,a);continue;}
    if(!c||c.entity.destroyed||!b?.active||b.entity.destroyed||city.politics.officeHolder(c)||c.businessIds.length){finishApplication(a,'retirado','Candidato ou empresa indisponível',city.minute);if(c)releaseInterview(c,a);continue;}
    const agency=laborAgency(city);if(!agency){a.resultDueAt=city.minute+30;continue;}
    if(a.agencyBuildingId!==agency.building.id){a.agencyBuildingId=agency.building.id;a.interviewAt=agencyAppointmentTime(city,c,agency);a.decideAt=a.interviewAt+RECRUITMENT_RULES.interviewDuration;}
    if(a.submittedAt==null){
      const present=c.task==='job-interview'&&c.targetId===agency.building.id&&(agency.building.constructionKind==='open-air'?!c.indoorLocation&&!c.path.length&&Math.hypot(c.entity.x-agency.building.door.x,c.entity.y-agency.building.door.y)<=.8:c.indoorLocation?.buildingId===agency.building.id&&!c.indoorLocation.exiting);
      if(city.minute<a.interviewAt)continue;
      if(city.minute>=a.interviewAt&&!secretaryPresent(city)){a.interviewAt=agencyAppointmentTime(city,c,agency);a.decideAt=a.interviewAt+RECRUITMENT_RULES.interviewDuration;continue;}
      if(!present){if(city.minute>a.interviewAt+60){a.absentAt=city.minute;finishApplication(a,'reprovado','Não compareceu à entrevista na Secretaria do Trabalho',city.minute);releaseInterview(c,a);}continue;}
      a.arrivedAt??=city.minute;a.interviewStartedAt??=city.minute;c.action='Entrevista na Secretaria do Trabalho';
      if(city.minute<a.interviewStartedAt+RECRUITMENT_RULES.interviewDuration)continue;
      a.submittedAt=city.minute;a.resultDueAt=city.minute+RECRUITMENT_RULES.minimumNotice;releaseInterview(c,a);
    }
    if(city.minute<(a.resultDueAt??a.submittedAt+RECRUITMENT_RULES.minimumNotice))continue;
    if(!secretaryPresent(city)){a.resultDueAt=city.minute+30;continue;}
    const key=`${b.id}:${a.resultDueAt}`;let list=sessions.get(key);if(!list)sessions.set(key,list=[]);list.push({c,b,a});
  }
  for(const rows of sessions.values()){
    const b=rows[0].b,slots=openPositions(city,b);let hired=0;
    rows.sort((x,y)=>city.economy.hiringScore(y.c,b)-city.economy.hiringScore(x.c,b)||x.c.id-y.c.id);
    for(const {c,a} of rows){
      const q=qualification(city,c,b),old=city.building(c.jobId),better=!old||wageFor(city,c,b)>wageFor(city,c,old)*1.15;
      a.resultReceivedAt=city.minute;a.resultBuildingId=b.id;
      if(hired<slots&&b.balance>=b.wage*60&&q.eligible&&better&&c.jobId!==b.id){
        finishApplication(a,'aprovado',a.trainee?'Currículo aprovado pela Secretaria do Trabalho; selecionado para formação no trabalho':'Currículo aprovado pela Secretaria do Trabalho por habilidade, experiência e referências',city.minute);
        if(c.jobId)city.economy.leaveJob(c,'Aceitou proposta salarial melhor');
        c.jobId=b.id;c.profession=city.economy.jobSkill(b);b.workers.push(c.id);hired++;
        city.history.employment(c,b,'contratação');city.log(`${c.entity.properties.name} recebeu da Secretaria do Trabalho a aprovação para trabalhar em ${b.entity.properties.name}.`,'work',[c.id],{kind:'employment',buildingId:b.id,interviewAt:a.interviewAt,agencyBuildingId:a.agencyBuildingId});
      }else{const reason=!q.eligible?q.reason:!better?'A proposta deixou de compensar a troca de emprego':hired>=slots?'Outro candidato foi escolhido ou a vaga foi preenchida':'Empresa sem recursos para contratar';finishApplication(a,'reprovado',reason,city.minute);city.log(`${c.entity.properties.name} recebeu da Secretaria do Trabalho a resposta negativa da vaga em ${b.entity.properties.name}: ${reason}.`,'work',[c.id],{kind:'employment-result',status:'reprovado',buildingId:b.id,agencyBuildingId:a.agencyBuildingId,interviewAt:a.interviewAt});}
      releaseInterview(c,a);
    }
  }
  city.economy.recruitmentQueue=queue.filter(({application:a})=>a.status==='análise');
}
export function renderResume(ui,p,c,money){
  const city=ui.city,cv=career(c),job=city.building(c.jobId);
  p.heading('CURRÍCULO PROFISSIONAL');p.meter('Motivação no trabalho',cv.motivation);
  p.note('Tempo de vínculo inclui o período empregado; experiência comprovada conta apenas minutos efetivamente trabalhados e pagos.');
  if(job){p.button(job.entity.properties.name,()=>ui.openBuilding(job.id));p.kv('Salário base por hora',money(job.wage*60));}
  p.heading('EXPERIÊNCIA E REFERÊNCIAS');
  if(!cv.jobs.length)p.note('Sem experiência profissional registrada.');
  for(const row of [...cv.jobs].reverse()){
    const end=row.endedAt??city.minute;
    p.record(row.company,`${row.endedAt==null?'Vínculo atual':'Encerrado'} · dia ${Math.floor(row.startedAt/1440)+1} até ${row.endedAt==null?'hoje':`dia ${Math.floor(end/1440)+1}`}`,()=>ui.openBuilding(row.buildingId));
    p.kv('Tempo na empresa',`${((end-row.startedAt)/1440).toFixed(1)} dias`);p.kv('Experiência comprovada',`${(row.workedMinutes/60).toFixed(1)} horas`);
    p.kv('Avaliação da empresa',row.workedMinutes?`${row.rating.toFixed(1)}/100`:'Ainda sem trabalho avaliado');p.kv('Remuneração bruta acumulada',money(row.earned));
    if(row.unpaidMinutes)p.kv('Tentativas sem pagamento',row.unpaidMinutes);
    if(row.reason)p.note(row.reason);
  }
  p.heading('VAGAS DESCOBERTAS');
  p.note('Os anúncios são descobertos ao passar perto das empresas; esta lista registra o que a pessoa viu, sem revelar todas as vagas da cidade.');
  for(const entry of (cv.knownVacancies||[]).slice(-12).reverse()){const firm=city.building(entry.buildingId);p.record(firm?.entity.properties.name||'Empresa encerrada',`${entry.positions} vagas anunciadas · ${money(entry.wage*60)}/h · ${entry.source} · dia ${Math.floor(entry.discoveredAt/1440)+1}`,()=>ui.openBuilding(entry.buildingId));}
  p.heading('PROCESSOS SELETIVOS');
  for(const a of [...cv.applications].reverse().slice(0,12)){p.record(a.company,`${a.status}${a.trainee?' · formação no trabalho':''} · ${a.reason} · oferta ${money(a.offeredWage*60)}/h`,()=>ui.openBuilding(a.buildingId));if(a.interviewAt!=null)p.kv('Entrevista na Secretaria do Trabalho',`Dia ${Math.floor(a.interviewAt/1440)+1} · ${String(Math.floor(a.interviewAt%1440/60)).padStart(2,'0')}:${String(a.interviewAt%60).padStart(2,'0')}`);if(a.submittedAt!=null)p.kv('Currículo entregue',`Dia ${Math.floor(a.submittedAt/1440)+1} · ${String(Math.floor(a.submittedAt%1440/60)).padStart(2,'0')}:${String(a.submittedAt%60).padStart(2,'0')}`);if(a.resultDueAt!=null)p.kv('Resultado previsto',`Dia ${Math.floor((a.resultReceivedAt??a.resultDueAt)/1440)+1} · ${String(Math.floor((a.resultReceivedAt??a.resultDueAt)%1440/60)).padStart(2,'0')}:${String((a.resultReceivedAt??a.resultDueAt)%60).padStart(2,'0')}`);if(a.absentAt!=null)p.note('Dispensado por ausência à entrevista.');}
  if(!cv.applications.length)p.note('Nenhuma candidatura registrada.');
}

export function workEfficiency(c,b){return (c.jobId===b.id?.85+career(c).motivation*.003:1)*injuryWorkFactor(c)*(c.substanceModifiers?.cognition||1);}

export function reviewWages(city,b){
  const vacancies=openPositions(city,b);if(vacancies<=0){b.vacancySince=null;return;}
  if(b.wagePolicyVersion!==3){b.wagePolicyVersion=3;b.lastWageReviewDay=null;}
  b.vacancySince??=city.minute;b.wageReference??=b.baseWage;
  const understaffed=occupiedPositions(city,b)<b.jobs*.5;
  if(city.minute-b.vacancySince<(understaffed?360:1440)||b.lastWageReviewDay===city.day)return;
  const floor=Math.max(1,city.politics.policy.minimumWage||0);
  // Keep the ceiling tied to a stable reference, rather than increasing it
  // again every time the current offer rises.
  b.wageCompetitionCeiling=Math.max(b.wageCompetitionCeiling||0,b.wageReference*2,floor*1.5);
  const competitors=understaffed?city.buildings.filter(firm=>firm.active&&!firm.entity.destroyed&&firm.id!==b.id&&occupiedPositions(city,firm)>0&&firm.jobs>0&&firm.balance>=firm.wage*60).map(firm=>firm.baseWage).filter(Number.isFinite).sort((a,b)=>a-b):[];
  const marketOffer=competitors.length?competitors[Math.floor(competitors.length/2)]*1.2:0;
  const next=Math.min(b.wageCompetitionCeiling,Math.max(b.baseWage*1.01,marketOffer)),payroll=city.currency.price(Math.max(next,floor))*Math.max(1,b.jobs)*480;
  if(next<=b.baseWage||b.balance<Math.max(city.currency.price(5000),payroll))return;
  b.lastWageReviewDay=city.day;b.baseWage=next;
  city.history.record('employment',`${b.entity.properties.name} elevou sua base salarial para disputar funcionários.`,[b.accountId],{buildingId:b.id,wage:b.wage,action:'revisão salarial'});
}

export function wageFor(city,c,b){return b.wage+city.currency.price(Math.floor((c.skills[city.economy.jobSkill(b)]||0)/30));}
