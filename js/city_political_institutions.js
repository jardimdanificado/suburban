const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
export function seatBounds(city){const population=city.citizens.filter(c=>!c.entity.destroyed).length;const min=Math.max(1,Math.ceil(population*.05));return {population,min,max:Math.max(min,Math.floor(population*.125))};}
export function publicPressure(p,record){const living=p.city.citizens.filter(c=>!c.entity.destroyed&&p.city.society.isAdult(c));const aware=new Set(record.awareIds||[]);return living.length?living.filter(c=>aware.has(c.id)).length/living.length*100:0;}
export function scandalEligible(p,record){return !!record?.proven&&(record.severity||0)>=60&&publicPressure(p,record)>=65&&!record.archived;}
export function approvalReport(p){
  const city=p.city,now=p.conditions(),base=p.baseline||now,t=p.mandates.current;
  const fulfilled=t?.promises.filter(pr=>pr.fulfilled).length||0,total=t?.promises.length||0,delivery=total?fulfilled/total:0;
  const elapsed=t?clamp((city.minute-t.startedAt)/p.termRules.termMinutes,0,1):0;
  const scandals=p.scandals.filter(s=>s.proven&&s.accusedId===city.economy.mayorId).reduce((n,s)=>n+publicPressure(p,s)/100*(s.severity||20)*.2,0);
  const vetoPenalty=(p.vetoes||[]).reduce((n,v)=>n+Math.max(0,28-(city.minute-v.minute)/1440*2),0);
  const rows=[
    {label:'Felicidade',points:-(100-now.happiness)*.25,detail:`${now.happiness.toFixed(1)}/100; peso máximo de 25 pontos`},
    {label:'Moradia',points:-now.homeless*20,detail:`${(now.homeless*100).toFixed(1)}% sem moradia; peso de 20 pontos`},
    {label:'Alimentação',points:-now.hunger*25,detail:`${(now.hunger*100).toFixed(1)}% com alimentação abaixo de 30/100; peso de 25 pontos`},
    {label:'Ocupação',points:-(1-now.employment)*15,detail:`${(now.employment*100).toFixed(1)}% com emprego ou negócio; peso de 15 pontos`},
    {label:'Mudança na felicidade',points:(now.happiness-base.happiness)*.35,detail:`Início: ${base.happiness.toFixed(1)}; agora: ${now.happiness.toFixed(1)}`},
    {label:'Promessas pendentes',points:-(1-delivery)*elapsed*28,detail:`${fulfilled}/${total} cumpridas; ${(elapsed*100).toFixed(1)}% do mandato transcorrido`},
    {label:'Corrupção comprovada',points:-scandals,detail:'Penalidade ponderada pela gravidade e pela parcela da população informada'},
    {label:'Vetos do prefeito',points:-vetoPenalty,detail:'Cada veto começa com perda de 28 pontos, reduzida em 2 pontos por dia'}
  ].map(row=>Object.freeze(row));
  const raw=100+rows.reduce((n,r)=>n+r.points,0),score=clamp(raw);
  return {minute:city.minute,startingScore:100,score,raw,adjustment:score-raw,rows,fulfilled,promises:total,housed:1-now.homeless,fed:1-now.hunger,employment:now.employment};
}
export function criticalApproval(p){
  p.approvalReport=approvalReport(p);p.approval=p.approvalReport.score;
  p.lowApprovalSince=p.approval<20?(p.lowApprovalSince??p.city.minute):null;
}
export function organizeScheme(p,official){
  const city=p.city,projects=city.development.projects.filter(pr=>pr.accountId==='treasury'&&!pr.cancelled&&pr.fee>0&&city.building(pr.builderId)?.ownerId);
  const project=projects[Math.floor(city.random()*projects.length)],firm=project?city.building(project.builderId):city.economy.businesses.find(b=>b.ownerId&&city.society.citizen(b.ownerId)&&(city.society.related(official,city.society.citizen(b.ownerId))||city.relationships.view(official,city.society.citizen(b.ownerId))?.trust>40));
  const entrepreneur=firm&&city.society.citizen(firm.ownerId);
  const partners=p.council.people().filter(c=>c.id!==official.id&&(c.traits?.honesty??.5)<.45&&c.political.partyId===official.political.partyId);
  const accomplice=partners[Math.floor(city.random()*partners.length)];
  const type=project?'contract-overbilling':entrepreneur?'favoritism':'embezzlement';
  const amount=Math.min(Math.floor(city.treasury*.002),city.currency.price(project?Math.max(500,Math.floor(project.fee*.08)):500+Math.floor(city.random()*2500)));
  if(amount<100||city.treasury-amount<city.welfare.conditions().reserve)return null;
  const record=p.crime(official,type,'treasury',entrepreneur?.accountId||official.accountId,amount,{projectId:project?.id,buildingId:firm?.id,participantIds:[official.id,entrepreneur?.id,accomplice?.id].filter(id=>id!=null),roles:[{citizenId:official.id,role:'articulador'},{citizenId:entrepreneur?.id,role:'beneficiário de contrato'},{citizenId:accomplice?.id,role:'intermediário e proteção parlamentar'}].filter(r=>r.citizenId!=null)});
  if(!record)return null;record.steps[0].description=project?'Aditivo indevido em contrato público':entrepreneur?'Subvenção direcionada a aliado':'Desvio de caixa';
  if(entrepreneur){for(const [recipient,share] of [[official,.3],[accomplice,.15]]){if(!recipient||recipient.accountId===entrepreneur.accountId)continue;const kickback=Math.floor(amount*share);if(city.transfer(entrepreneur.accountId,recipient.accountId,kickback,'Repasse clandestino de contrato',{corruptionCaseId:record.id})){record.steps.push(p.corruptionStep(entrepreneur.accountId,recipient.accountId,kickback,'Retorno ao integrante do esquema'));}}firm.favoredBy=official.id;firm.favorUntil=city.minute+3*1440;}
  record.severity=clamp((project?45:20)+record.participantIds.length*8+Math.min(25,amount/Math.max(1,city.treasury)*5000));
  record.concealment=clamp(.25+(official.skills.governance||0)/200+(accomplice ? .25 : 0),0,.9);
  return record;
}
export function investigateCases(p){
  const city=p.city;if(p.lastInvestigationDay===city.day)return;p.lastInvestigationDay=city.day;
  const voters=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c));
  for(const record of p.corruption){
    record.severity??=record.type==='vote-buying'?25:40;record.concealment??=.4;record.awareIds??=[];
    if(record.archived)continue;
    const age=(city.minute-record.occurredAt)/1440;
    if(!record.discoveredAt){
      if(age>p.policy.termDays*2){record.archived=true;record.outcome='Nunca descoberto';continue;}
      if(age<1||city.random()>.025+(record.severity/100)*.09*(1-record.concealment))continue;
      record.discoveredAt=city.minute;record.evidence=.15+city.random()*.25;p.scandals.push(record);if(p.scandals.length>96)p.scandals.shift();
      city.log('Uma denúncia abriu investigação de possíveis irregularidades.','government',[record.accusedId],{kind:'corruption-investigation',corruptionCaseId:record.id});
    }
    if(!record.proven){
      const allies=p.council.people().filter(c=>c.political.partyId===record.partyId).length/Math.max(1,p.council.seats);
      if(city.random()<allies*(1-(city.society.citizen(record.accusedId)?.traits?.honesty??.5))*.12){record.coverUps=(record.coverUps||0)+1;record.evidence=Math.max(0,(record.evidence||0)-.2);if(record.coverUps>=2){record.archived=true;record.outcome='Investigação arquivada por obstrução e proteção política';continue;}}
      if(city.random()<.18*(1-record.concealment)){record.evidence=Math.min(1,(record.evidence||0)+.15+city.random()*.2);}
      if(record.evidence>=.8){record.proven=true;record.provenAt=city.minute;city.reputation.observe(`citizen:${record.accusedId}`,'civic',-Math.max(8,record.severity*.3),'corrupção comprovada',{corruptionCaseId:record.id});city.log('Auditoria reuniu prova documental de um esquema de corrupção.','government',record.participantIds||[record.accusedId],{kind:'corruption-proven',corruptionCaseId:record.id,amount:record.amount});}
    }
    const reach=Math.max(1,Math.ceil(voters.length*(record.proven?.035:.01)*(1+record.severity/100)));
    const listeners=p.campaigns.sample(voters.filter(c=>!record.awareIds.includes(c.id)),reach);
    for(const voter of listeners){record.awareIds.push(voter.id);p.remember(voter,{kind:record.proven?'proven-scandal':'corruption-rumor',caseId:record.id,partyId:record.partyId,candidateId:record.accusedId,effect:record.proven?-record.severity/4:-2,description:record.proven?'Conheceu provas de corrupção e seus participantes.':'Ouviu denúncia ainda sob investigação.'});}
    record.publicAttention=publicPressure(p,record);
    if(scandalEligible(p,record))for(const targetId of [...new Set([record.accusedId,...(record.participantIds||[])])]){
      if(record.impeachedIds?.includes(targetId)||p.council.bills.some(b=>b.type==='impeach'&&b.payload.caseId===record.id&&b.payload.targetId===targetId))continue;
      const author=p.council.people().filter(c=>c.id!==targetId&&!record.participantIds?.includes(c.id)).sort((a,b)=>(b.traits?.honesty??.5)-(a.traits?.honesty??.5))[0];
      if(author&&p.officeHolder(city.society.citizen(targetId)))p.council.propose(author,'impeach',{targetId,caseId:record.id},'Cassação: esquema comprovado de grande repercussão');
    }

  }
  if(p.lowApprovalSince!=null&&city.minute-p.lowApprovalSince>=3*1440){const author=p.council.people().find(c=>c.political.partyId!==p.partyOfId(city.economy.mayorId)?.id);if(author)p.council.propose(author,'confidence',{targetId:city.economy.mayorId},'Impeachment por perda persistente de confiança popular');}
}
