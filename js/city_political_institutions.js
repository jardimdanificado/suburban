import {syncCorruptionVotes} from './city_corruption_votes.js';
import {governmentExpectations} from './city_government_expectations.js';
import {outcomeAssessment,promiseAssessment} from './city_promise_evaluation.js';
import {governmentPerformance} from './city_government_performance.js';
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
export function seatBounds(city){const population=city.citizens.filter(c=>!c.entity.destroyed).length;const min=Math.max(1,Math.ceil(population*.05));return {population,min,max:Math.max(min,Math.floor(population*.125))};}
export function publicPressure(p,record){const living=p.city.citizens.filter(c=>!c.entity.destroyed&&p.city.society.isAdult(c));const aware=new Set(record.awareIds||[]);return living.length?living.filter(c=>aware.has(c.id)).length/living.length*100:0;}
export function scandalEligible(p,record){return !!record?.proven&&(record.severity||0)>=60&&publicPressure(p,record)>=65&&!record.archived;}
export function approvalReport(p){
  const city=p.city,now=p.conditions(),t=p.mandates.current;
  const finance=governmentPerformance(city),financialBaseline=t?.baseline||finance,financialLatest=t?.latest||finance;
  const fulfilled=t?.promises.filter(pr=>pr.fulfilled).length||0,total=t?.promises.length||0;
  const outcomes=t?(t.outcomes||outcomeAssessment(t.baseline,t.latest)):null;
  const assessments=t?.promises.map(pr=>pr.assessment||promiseAssessment(pr,t,city.minute))||[];
  const mean=key=>assessments.reduce((n,a)=>n+(a[key]||0),0)/Math.max(1,assessments.length);
  const scandals=p.scandals.filter(s=>s.proven&&s.accusedId===city.economy.mayorId).reduce((n,s)=>n+publicPressure(p,s)/100*(s.severity||20)*.2,0);
  const vetoPenalty=(p.vetoes||[]).filter(v=>v.mayorId===city.economy.mayorId).reduce((n,v)=>n+Math.max(0,28-(city.minute-v.minute)/1440*2),0);
  const expectations=governmentExpectations(p);
  const rows=[
    {label:'Fundo partidário',points:(p.partyFundChanges||[]).filter(r=>r.mayorId===city.economy.mayorId).reduce((n,r)=>n+r.points*Math.exp(-(city.minute-r.minute)/(12*1440)),0),detail:'Aumentar o fundo eleitoral gera desaprovação; reduzir gera aprovação. Efeito decai ao longo de 12 dias.'},
    {label:'Condições atuais: felicidade',points:(now.happiness-50)*.06,detail:`${now.happiness.toFixed(1)}/100; peso menor que o avanço desde a posse`},
    {label:'Condições atuais: moradia',points:(.5-now.homeless)*6,detail:`${((1-now.homeless)*100).toFixed(1)}% abrigados`},
    {label:'Condições atuais: alimentação',points:(.5-now.hunger)*8,detail:`${((1-now.hunger)*100).toFixed(1)}% sem fome`},
    {label:'Condições atuais: ocupação',points:(now.employment-.5)*4,detail:`${(now.employment*100).toFixed(1)}% com ocupação`},
    {label:'Caixa municipal e reserva',points:(finance.cashHealth-50)*.16,detail:`Caixa ${Math.round(finance.cash)}; reserva social ${Math.round(finance.reserve)}. Indicador ${finance.cashHealth.toFixed(1)}/100; caixa zerado recebe avaliação mínima.`},
    {label:'Equilíbrio do custeio público',points:(finance.operatingHealth-50)*.16,detail:`Saldo de custeio nos últimos dias: ${Math.round(finance.operatingBalance)}. Indicador ${finance.operatingHealth.toFixed(1)}/100, calculado em relação às despesas correntes.`},
    {label:'Produtividade das empresas ativas',points:(finance.companyProductivity-50)*.1,detail:`${finance.productiveCompanies}/${finance.activeCompanies} empresas ativas têm equipe e receita ${finance.revenueWindowReady?'nos últimos 30 dias':'registrada desde o início do acompanhamento'}; indicador ${finance.companyProductivity.toFixed(1)}/100.`},
    {label:'Mudança da saúde do caixa desde a posse',points:((financialLatest.treasuryHealth??finance.cashHealth)-(financialBaseline.treasuryHealth??finance.cashHealth))*.1,detail:`${(financialBaseline.treasuryHealth??finance.cashHealth).toFixed(1)} → ${(financialLatest.treasuryHealth??finance.cashHealth).toFixed(1)}/100 desde a posse.`},
    {label:'Mudança do equilíbrio de custeio desde a posse',points:((financialLatest.operatingHealth??finance.operatingHealth)-(financialBaseline.operatingHealth??finance.operatingHealth))*.1,detail:`${(financialBaseline.operatingHealth??finance.operatingHealth).toFixed(1)} → ${(financialLatest.operatingHealth??finance.operatingHealth).toFixed(1)}/100 desde a posse.`},
    {label:'Mudança da produtividade empresarial desde a posse',points:((financialLatest.companyProductivity??finance.companyProductivity)-(financialBaseline.companyProductivity??finance.companyProductivity))*.08,detail:`${(financialBaseline.companyProductivity??finance.companyProductivity).toFixed(1)} → ${(financialLatest.companyProductivity??finance.companyProductivity).toFixed(1)}/100 desde a posse.`},
    ...(outcomes?.rows||[]).map(row=>({label:`Mudança desde a posse: ${row.label.toLowerCase()}`,points:row.points*(row.points<0?1.8:.6),detail:`Início ${row.baseline.toFixed(1)}% → agora ${row.current.toFixed(1)}%; variação ${row.change>0?'+':''}${row.change.toFixed(1)} pontos percentuais. Ganhos têm peso moderado; retrocessos descontam com mais força.`})),
    {label:'Avanço da promessa',points:mean('partial')*.4,detail:'Até 4,8 pontos pelo avanço real, antes do ajuste às expectativas'},
    {label:'Execução comprovada do plano',points:mean('initiative')*.5,detail:'Até 3 pontos por execução comprovada enquanto a promessa está pendente'},
    {label:'Meta alcançada',points:mean('completion')*.45,detail:`${fulfilled}/${total} metas atendidas; até 7,2 pontos por conclusão com avanço real`},
    {label:'Rapidez do cumprimento',points:mean('early')*.45,detail:'Até 6,3 pontos pelo cumprimento antecipado; a velocidade continua relevante'},
    {label:'Superação da meta',points:mean('excess')*.35,detail:'Até 7 pontos pela superação; o bônus depende de a meta continuar atendida'},
    {label:'Cobrança da promessa pendente',points:mean('pending'),detail:'Após 25% do mandato, a cobrança cresce com o atraso, a ambição e a parte não realizada'},
    {label:'Recuos na promessa',points:mean('regression'),detail:'Pioras desde a posse e perda de uma meta anteriormente alcançada descontam pontos'},
    {label:'Corrupção comprovada',points:-scandals,detail:'Penalidade ponderada pela gravidade e pela parcela da população informada'},
    {label:'Vetos do prefeito',points:-vetoPenalty,detail:'Cada veto começa com perda de 28 pontos, reduzida em 2 pontos por dia'}
  ];
  const changeRows=rows.filter(r=>r.label.startsWith('Mudança')),changeRaw=changeRows.reduce((n,r)=>n+r.points,0),changePoints=clamp(changeRaw,-30,22);
  rows.push({label:'Limite do efeito das mudanças',points:changePoints-changeRaw,detail:'A evolução dos indicadores contribui entre −30 e +22 pontos; evita somar muitas vezes a mesma recuperação.'});
  const positiveChanges=changeRows.reduce((n,r)=>n+Math.max(0,r.points),0),boundedPositiveChanges=Math.min(22,positiveChanges);
  const promiseRows=rows.filter(r=>['Avanço da promessa','Execução comprovada do plano','Meta alcançada','Rapidez do cumprimento','Superação da meta','Cobrança da promessa pendente','Recuos na promessa'].includes(r.label)),promiseRaw=promiseRows.reduce((n,r)=>n+r.points,0),promisePoints=clamp(promiseRaw,-30,26);
  rows.push({label:'Limite do efeito da promessa',points:promisePoints-promiseRaw,detail:'O conjunto de efeitos da promessa contribui entre −30 e +26 pontos.'});
  const positivePromises=Math.min(26,promiseRows.reduce((n,r)=>n+Math.max(0,r.points),0));
  rows.push({label:'Expectativa em relação à gestão anterior',points:(expectations.factor-1)*(boundedPositiveChanges+positivePromises),detail:expectations.detail});
  const raw=50+rows.reduce((n,r)=>n+r.points,0),delta=raw-50;
  // Diminishing returns preserve room for disagreement instead of clamping at unanimity.
  const score=50+49.5*Math.tanh(delta/50);
  rows.forEach(Object.freeze);
  return {version:5,expectations,minute:city.minute,startingScore:50,score,raw,adjustment:score-raw,rows,finance,fulfilled,promises:total,housed:1-now.homeless,fed:1-now.hunger,employment:now.employment,outcomePoints:outcomes?.points||0,promisePoints};
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
    if(city.justice)city.justice.referCorruption(record);
    if(!city.justice&&!record.proven){
      const allies=p.council.people().filter(c=>c.political.partyId===record.partyId).length/Math.max(1,p.council.seats);
      if(city.random()<allies*(1-(city.society.citizen(record.accusedId)?.traits?.honesty??.5))*.12){record.coverUps=(record.coverUps||0)+1;record.evidence=Math.max(0,(record.evidence||0)-.2);if(record.coverUps>=2){record.archived=true;record.outcome='Investigação arquivada por obstrução e proteção política';continue;}}
      if(city.random()<.18*(1-record.concealment)){record.evidence=Math.min(1,(record.evidence||0)+.15+city.random()*.2);}
      if(record.evidence>=.8){record.proven=true;record.provenAt=city.minute;city.reputation.observe(`citizen:${record.accusedId}`,'civic',-Math.max(8,record.severity*.3),'corrupção comprovada',{corruptionCaseId:record.id});city.log('Auditoria reuniu prova documental de um esquema de corrupção.','government',record.participantIds||[record.accusedId],{kind:'corruption-proven',corruptionCaseId:record.id,amount:record.amount});}
    }
    const reach=Math.max(1,Math.ceil(voters.length*(record.proven?.035:.01)*(1+record.severity/100)));
    const listeners=p.campaigns.sample(voters.filter(c=>!record.awareIds.includes(c.id)),reach);
    for(const voter of listeners){record.awareIds.push(voter.id);p.remember(voter,{kind:record.proven?'proven-scandal':'corruption-rumor',caseId:record.id,partyId:record.partyId,candidateId:record.accusedId,effect:record.proven?-record.severity/4:-2,description:record.proven?'Conheceu provas de corrupção e seus participantes.':'Ouviu denúncia ainda sob investigação.'});}
    syncCorruptionVotes(p,record);
    record.publicAttention=publicPressure(p,record);
    if(scandalEligible(p,record))for(const targetId of [...new Set([record.accusedId,...(record.participantIds||[])])]){
      if(record.impeachedIds?.includes(targetId)||p.council.bills.some(b=>b.type==='impeach'&&b.payload.caseId===record.id&&b.payload.targetId===targetId))continue;
      const author=p.council.people().filter(c=>c.id!==targetId&&!record.participantIds?.includes(c.id)).sort((a,b)=>(b.traits?.honesty??.5)-(a.traits?.honesty??.5))[0];
      if(author&&p.officeHolder(city.society.citizen(targetId)))p.council.propose(author,'impeach',{targetId,caseId:record.id},'Cassação: esquema comprovado de grande repercussão');
    }

  }
  if(p.lowApprovalSince!=null&&city.minute-p.lowApprovalSince>=3*1440){const author=p.council.people().find(c=>c.political.partyId!==p.partyOfId(city.economy.mayorId)?.id);if(author)p.council.propose(author,'confidence',{targetId:city.economy.mayorId},'Impeachment por perda persistente de confiança popular');}
}
