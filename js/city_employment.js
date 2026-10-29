/** Career records are independent of the bounded event journal and survive snapshots. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
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
export const RECRUITMENT_RULES=Object.freeze({discoveryRadius:10,discoveryInterval:5,interviewDuration:10,minimumNotice:60});
const vacancyIndexes=new WeakMap();
function nearbyFirms(city,c){
  let index=vacancyIndexes.get(city);
  if(!index||index.revision!==city.structureRevision||index.length!==city.buildings.length){
    const buckets=new Map();
    for(const b of city.buildings){const key=`${Math.floor(b.door.x/16)},${Math.floor(b.door.y/16)}`;let list=buckets.get(key);if(!list)buckets.set(key,list=[]);list.push(b);}
    index={revision:city.structureRevision,length:city.buildings.length,buckets};vacancyIndexes.set(city,index);
  }
  const result=[],x=Math.floor(c.entity.x/16),y=Math.floor(c.entity.y/16);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const b of index.buckets.get(`${x+dx},${y+dy}`)||[])if(b.active&&!b.entity.destroyed&&b.jobs>b.workers.length&&Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y)<=RECRUITMENT_RULES.discoveryRadius)result.push(b);
  return result;
}
export function discoverVacancies(city,c,force=false){
  if(!force&&city.minute<(c.career?.nextDiscoveryAt||0))return;
  if(c.entity.destroyed||c.indoorLocation||!city.society.isAdult(c)||city.politics.officeHolder(c)||c.businessIds.length)return;
  const cv=career(c);cv.nextDiscoveryAt=city.minute+RECRUITMENT_RULES.discoveryInterval;
  cv.knownVacancies??=[];
  for(const b of nearbyFirms(city,c)){
    let entry=cv.knownVacancies.find(v=>v.buildingId===b.id);if(!entry){entry={buildingId:b.id,discoveredAt:city.minute,source:'Anúncio na fachada'};cv.knownVacancies.push(entry);}
    entry.seenAt=city.minute;entry.wage=b.wage;entry.positions=b.jobs-b.workers.length;
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
function queueApplications(city){
  return city.economy.recruitmentQueue??=city.citizens.flatMap(c=>(c.career?.applications||[]).filter(a=>a.status==='análise').map(application=>({citizenId:c.id,application})));
}
export function apply(city,c,b){
  const cv=career(c),last=cv.applications.findLast(a=>a.buildingId===b.id);
  if(cv.pendingInterview&&!cv.applications.includes(cv.pendingInterview))cv.pendingInterview=null;
  if(last&&last.status==='análise')return last;
  if(last&&city.minute-last.appliedAt<360)return null;
  if(cv.pendingInterview?.status==='análise')return null;
  const q=qualification(city,c,b),interviewAt=appointmentTime(city,c,b),row={buildingId:b.id,company:b.entity.properties.name,appliedAt:city.minute,interviewAt,decideAt:interviewAt+RECRUITMENT_RULES.interviewDuration,status:q.eligible?'análise':'reprovado',reason:q.eligible?'Seleção presencial agendada; pode continuar sua rotina até o horário marcado.':q.reason,trainee:q.trainee,score:city.economy.hiringScore(c,b),offeredWage:wageFor(city,c,b)};
  const queue=queueApplications(city);cv.applications.push(row);
  if(row.status==='análise'){cv.pendingInterview=row;queue.push({citizenId:c.id,application:row});}
  else {row.decidedAt=city.minute;Object.freeze(row);}
  if(cv.applications.length>48)cv.applications=cv.applications.filter((a,index)=>a.status==='análise'||index>=cv.applications.length-24);
  return row;
}
function considerKnownVacancies(city,c,offers=null){
  const cv=career(c);if(cv.pendingInterview?.status==='análise')return;
  const old=city.building(c.jobId),allowed=offers&&new Set(offers.map(b=>b.id));
  const demand=new Map();for(const {application:a} of queueApplications(city))if(a.status==='análise')demand.set(a.buildingId,(demand.get(a.buildingId)||0)+1);
  const value=b=>wageFor(city,c,b)/Math.max(1,city.currency.price(1))*2+city.economy.hiringScore(c,b)*.2-Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y)*.05-(demand.get(b.id)||0)/Math.max(1,b.jobs-b.workers.length)*8;
  const choices=(cv.knownVacancies||[]).map(v=>city.building(v.buildingId)).filter(b=>b&&(!allowed||allowed.has(b.id))&&b.active&&!b.entity.destroyed&&b.jobs>b.workers.length&&b.balance>=b.wage*60&&b.id!==c.jobId&&(!old||wageFor(city,c,b)>wageFor(city,c,old)*1.15)&&qualification(city,c,b).eligible&&city.relationships.willingToWork(c,b)).sort((a,b)=>value(b)-value(a)||a.id-b.id);
  for(const b of choices)if(apply(city,c,b)?.status==='análise')return;
}
export function reviewMarket(city,offers){
  for(const c of city.citizens){
    if(c.entity.destroyed||!city.society.isAdult(c)||city.politics.officeHolder(c)||c.businessIds.length)continue;
    discoverVacancies(city,c);
    const cv=career(c);if(city.minute<(cv.nextSearchAt||0))continue;cv.nextSearchAt=city.minute+(c.jobId?240:30);
    considerKnownVacancies(city,c,offers);
  }
}
export function searchEmployment(city,c){
  discoverVacancies(city,c);considerKnownVacancies(city,c);
  if(c.career?.pendingInterview?.status==='análise')return false;
  // Explore a few nearby blocks; distant vacancy signs are learned along the route.
  const offsets=[[12,0],[0,12],[-12,0],[0,-12],[8,8],[-8,8],[-8,-8],[8,-8]],start=(c.id+Math.floor(city.minute/30))%offsets.length;
  for(let i=0;i<offsets.length;i++){const [dx,dy]=offsets[(start+i)%offsets.length],target={x:Math.floor(c.entity.x)+dx+.5,y:Math.floor(c.entity.y)+dy+.5};if(!city.walkable(Math.floor(target.x),Math.floor(target.y)))continue;const path=city.findPath(c.entity,target);if(path?.length){c.task='walk';c.targetId=null;c.path=path;c.action='Procurando anúncios de emprego pelo bairro';return true;}}
  return false;
}
export function routeToInterview(city,c){
  const a=c.career?.pendingInterview;if(!a||a.status!=='análise'||city.minute>a.decideAt)return false;
  const b=city.building(a.buildingId);if(!b?.active||b.entity.destroyed)return false;
  const lead=Math.max(30,Math.ceil(Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)*2+(b.officeFloor||0)*5+15));
  if(city.minute<a.interviewAt-lead)return false;
  if(c.task==='job-interview'&&c.targetId===b.id)return true;
  if(c.deliveryId||c.cleaningJobId||c.informalJobId||c.mobilityTrip||c.ridingVehicleId||c.workMeal||c.conversation||['caregiving','care','vote','council-session','interview'].includes(c.task))return false;
  const path=city.findPath(c.entity,b.door);if(path===null)return false;
  c.task='job-interview';c.targetId=b.id;c.path=path;c.action='Indo à seleção de emprego agendada';return true;
}
function releaseInterview(c,a){
  if(c.career?.pendingInterview===a)c.career.pendingInterview=null;
  if(c.task==='job-interview'&&c.targetId===a.buildingId){c.task=null;c.targetId=null;c.path=[];c.action=a.resultReceivedAt!=null?'Resultado do processo seletivo recebido':`Seleção encerrada: ${a.reason}`;}
}
export function advanceRecruitment(city){
  const queue=queueApplications(city),sessions=new Map();
  for(const {citizenId,application:a} of queue){
    if(a.status!=='análise')continue;
    const c=city.society.citizen(citizenId),b=city.building(a.buildingId);
    if(c&&!c.career?.applications.includes(a)){finishApplication(a,'retirado','Inscrição retirada',city.minute);releaseInterview(c,a);continue;}
    if(!c||c.entity.destroyed||!b?.active||b.entity.destroyed||city.politics.officeHolder(c)||c.businessIds.length){finishApplication(a,'retirado','Candidato ou empresa indisponível',city.minute);if(c)releaseInterview(c,a);continue;}
    if(a.interviewAt==null){a.interviewAt=appointmentTime(city,c,b);a.decideAt=a.interviewAt+RECRUITMENT_RULES.interviewDuration;c.career.pendingInterview=a;}
    const present=c.task==='job-interview'&&c.targetId===b.id&&c.indoorLocation?.buildingId===b.id&&!c.indoorLocation.exiting;
    if(present)a.arrivedAt??=city.minute;
    if(city.minute<a.interviewAt)continue;
    if(!present){a.absentAt=city.minute;finishApplication(a,'reprovado',a.checkedInAt!=null?'Saiu da seleção antes de receber o resultado':'Não compareceu ao local no horário marcado',city.minute);releaseInterview(c,a);continue;}
    a.checkedInAt??=city.minute;c.action='Participando da seleção e aguardando o resultado presencial';
    if(city.minute<a.decideAt)continue;
    const key=`${b.id}:${a.interviewAt}`;let list=sessions.get(key);if(!list)sessions.set(key,list=[]);list.push({c,b,a});
  }
  for(const rows of sessions.values()){
    const b=rows[0].b,slots=Math.max(0,b.jobs-b.workers.length);let hired=0;
    rows.sort((x,y)=>city.economy.hiringScore(y.c,b)-city.economy.hiringScore(x.c,b)||x.c.id-y.c.id);
    for(const {c,a} of rows){
      const q=qualification(city,c,b),old=city.building(c.jobId),better=!old||wageFor(city,c,b)>wageFor(city,c,old)*1.15;
      a.resultReceivedAt=city.minute;a.resultBuildingId=b.id;
      if(hired<slots&&b.balance>=b.wage*60&&q.eligible&&better&&c.jobId!==b.id){
        finishApplication(a,'aprovado',a.trainee?'Selecionado presencialmente para formação no trabalho':'Selecionado presencialmente por habilidade, experiência e referências',city.minute);
        if(c.jobId)city.economy.leaveJob(c,'Aceitou proposta salarial melhor');
        c.jobId=b.id;c.profession=city.economy.jobSkill(b);b.workers.push(c.id);hired++;
        city.history.employment(c,b,'contratação');city.log(`${c.entity.properties.name} recebeu a aprovação na seleção presencial de ${b.entity.properties.name}.`,'work',[c.id],{kind:'employment',buildingId:b.id,interviewAt:a.interviewAt});
      }else finishApplication(a,'reprovado',!q.eligible?q.reason:!better?'A proposta deixou de compensar a troca de emprego':hired>=slots?'Outro candidato foi escolhido ou a vaga foi preenchida':'Empresa sem recursos para contratar',city.minute);
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
  for(const a of [...cv.applications].reverse().slice(0,12)){p.record(a.company,`${a.status}${a.trainee?' · formação no trabalho':''} · ${a.reason} · oferta ${money(a.offeredWage*60)}/h`,()=>ui.openBuilding(a.buildingId));if(a.interviewAt!=null)p.kv('Seleção presencial',`Dia ${Math.floor(a.interviewAt/1440)+1} · ${String(Math.floor(a.interviewAt%1440/60)).padStart(2,'0')}:${String(a.interviewAt%60).padStart(2,'0')}`);if(a.absentAt!=null)p.note('Dispensado por ausência ou saída antes do resultado.');}
  if(!cv.applications.length)p.note('Nenhuma candidatura registrada.');
}

export function workEfficiency(c,b){return c.jobId===b.id?.85+career(c).motivation*.003:1;}

export function reviewWages(city,b){
  if(b.jobs<=b.workers.length){b.vacancySince=null;return;}
  b.vacancySince??=city.minute;
  if(city.minute-b.vacancySince<1440||b.lastWageReviewDay===city.day)return;
  b.lastWageReviewDay=city.day;
  // Recruitment pressure raises the offer only when the firm can fund a week of payroll.
  const next=Math.min(1000,b.baseWage*1.1),payroll=city.currency.price(Math.max(next,city.politics.policy.minimumWage||0))*Math.max(1,b.workers.length+1)*480*7;
  if(b.balance<Math.max(city.currency.price(20000),payroll))return;
  b.baseWage=next;
  city.history.record('employment',`${b.entity.properties.name} elevou sua base salarial para disputar funcionários.`,[b.accountId],{buildingId:b.id,wage:b.wage,action:'revisão salarial'});
}

export function wageFor(city,c,b){return b.wage+city.currency.price(Math.floor((c.skills[city.economy.jobSkill(b)]||0)/30));}
