/** Career records are independent of the bounded event journal and survive snapshots. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function career(c){return c.career??={jobs:[],applications:[],worked:{},motivation:50};}
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
export function apply(city,c,b){
  const cv=career(c),last=cv.applications.findLast(a=>a.buildingId===b.id);
  if(last&&last.status==='análise')return last;
  if(last&&city.minute>480&&city.minute-last.appliedAt<360)return null;
  const q=qualification(city,c,b),row={buildingId:b.id,company:b.entity.properties.name,appliedAt:city.minute,decideAt:city.minute<=480?city.minute:city.minute+60,status:q.eligible?'análise':'reprovado',reason:q.reason,trainee:q.trainee,score:city.economy.hiringScore(c,b),offeredWage:wageFor(city,c,b)};
  if(row.status!=='análise')Object.freeze(row);
  cv.applications.push(row);if(cv.applications.length>48)cv.applications=cv.applications.filter((a,index)=>a.status==='análise'||index>=cv.applications.length-24);return row;
}
export function reviewMarket(city,offers){
  // One staggered search per citizen per day; examine only the twelve best offers.
  const top=offers.filter(b=>b.workers.length<b.jobs&&b.balance>=b.wage*60).sort((a,b)=>b.wage-a.wage||a.id-b.id).slice(0,12);
  for(const c of city.citizens){
    if(!c.jobId||c.id===city.economy.mayorId||city.politics.officeHolder(c)||c.businessIds.length||c.deliveryId||c.cleaningJobId||c.researchAssignment||c.mobilityTrip||c.workMeal)continue;
    const cv=career(c);if(city.minute<(cv.nextSearchAt??c.id%24*60))continue;cv.nextSearchAt=city.minute+1440;
    const old=city.building(c.jobId);if(!old)continue;
    const b=top.find(b=>b.id!==old.id&&wageFor(city,c,b)>wageFor(city,c,old)*1.15&&qualification(city,c,b).eligible&&city.relationships.willingToWork(c,b));
    if(b)apply(city,c,b);
  }
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
  p.heading('PROCESSOS SELETIVOS');
  for(const a of [...cv.applications].reverse().slice(0,12))p.record(a.company,`${a.status}${a.trainee?' · formação no trabalho':''} · ${a.reason} · oferta ${money(a.offeredWage*60)}/h`,()=>ui.openBuilding(a.buildingId));
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
