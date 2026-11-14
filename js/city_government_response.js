import {GOVERNMENT_OUTCOMES} from './city_promise_evaluation.js';

const factors={
  'Emprego e renda do trabalho':['employed','Emprego e renda'],
  'Condições atuais: ocupação':['employed','Emprego e renda'],
  'Solvência das estatais':['municipalSolvency','Solvência das estatais'],
  'Condições atuais: felicidade':['happiness','Bem-estar'],
  'Condições atuais: moradia':['housed','Moradia'],
  'Condições atuais: alimentação':['fed','Alimentação'],
  'Caixa municipal e reserva':['treasuryHealth','Reserva municipal'],
  'Equilíbrio do custeio público':['operatingHealth','Equilíbrio do custeio'],
  'Déficit recente de receita municipal':['operatingHealth','Equilíbrio do custeio'],
  'Continuidade dos serviços essenciais':['serviceHealth','Continuidade dos serviços'],
  'Produtividade das empresas ativas':['companyProductivity','Produtividade'],
  'Mudança da saúde do caixa desde a posse':['treasuryHealth','Reserva municipal'],
  'Mudança do equilíbrio de custeio desde a posse':['operatingHealth','Equilíbrio do custeio'],
  'Mudança da continuidade dos serviços desde a posse':['serviceHealth','Continuidade dos serviços'],
  'Mudança da produtividade empresarial desde a posse':['companyProductivity','Produtividade'],
};
for(const [metric,[label]] of Object.entries(GOVERNMENT_OUTCOMES))factors[`Mudança desde a posse: ${label.toLowerCase()}`]=[metric,label];

/** Rank actual approval losses; accounting limits and scandals are not service demands. */
export function responsePriorities(report){
  const groups=new Map();
  for(const row of report.rows){
    if(row.points>=0)continue;
    let factor=factors[row.label];
    if(row.label==='Iluminação e avanço do calçamento')factor=report.finance.lightingHealth<report.finance.roadHealth?['lamps','Iluminação']:['connected','Acessos e calçamento'];
    if(row.label==='Corpos e resposta judicial')factor=report.finance.funeralHealth<report.finance.justiceHealth?['funeralHealth','Serviços funerários']:['justiceHealth','Estrutura da Justiça'];
    if(!factor)continue;
    const [metric,title]=factor,entry=groups.get(metric)||{metric,title,loss:0,factors:[]};
    entry.loss-=row.points;entry.factors.push(row.label);groups.set(metric,entry);
  }
  return [...groups.values()].sort((a,b)=>b.loss-a.loss||a.metric.localeCompare(b.metric));
}

export function reviewGovernmentResponse(city,term,report){
  const previous=term.response,priorities=responsePriorities(report),metrics={...city.politics.mandates.metrics(),municipalSolvency:report.finance.municipalSolvency,funeralHealth:report.finance.funeralHealth,justiceHealth:report.finance.justiceHealth};
  const history=previous?.history||[];
  if(previous?.current){
    const current=previous.current,currentLoss=priorities.find(row=>row.metric===current.metric)?.loss||0;
    const change=(metrics[current.metric]??current.baseline)-current.baseline;
    const review={minute:city.minute,metric:current.metric,title:current.title,change,lossChange:current.initialLoss-currentLoss,blocked:current.execution?.blocked||null};
    history.push(review);if(history.length>16)history.shift();
    // Give contracts a day to take effect; then let another urgent problem receive attention.
    if(city.minute-current.startedAt>=1440&&change<=0&&priorities.length>1){
      const index=priorities.findIndex(row=>row.metric===current.metric);
      if(index>=0){const [stalled]=priorities.splice(index,1);priorities.push(stalled);}
    }
  }
  const selected=priorities[0],same=selected&&previous?.current?.metric===selected.metric;
  const current=!selected?null:same?previous.current:{...selected,title:`Resposta à desaprovação: ${selected.title}`,baseline:metrics[selected.metric]??0,initialLoss:selected.loss,startedAt:city.minute};
  const response=term.response={minute:city.minute,approval:report.score,priorities,current,history};
  if(current&&!same)city.log(`${term.mayorName} priorizou ${selected.title.toLowerCase()} após diagnóstico de ${selected.loss.toFixed(1)} pontos de desaprovação.`,'government',[term.mayorId],{kind:'government-response-priority',termId:term.id,metric:current.metric,factors:selected.factors});
  return response;
}
