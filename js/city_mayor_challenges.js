/** Optional public commitments use measurable city conditions and electoral memory. */
export const MAYOR_CHALLENGES={
  food:{title:'Garantir dois dias de comida',desk:'operations',section:'programs'},
  housing:{title:'Reduzir a falta de moradia',desk:'build',section:'programs'},
  works:{title:'Entregar uma obra pública',desk:'build',section:'queue'}
};
export function challengeValue(city,kind){
  if(kind==='works')return city.development.projects.filter(p=>p.accountId==='treasury'&&p.status==='completed'&&!p.cancelled).length;
  const needs=city.welfare.conditions();return kind==='food'?needs.foodDays:needs.homeless;
}
export function acceptMayorChallenge(city,kind){
  const s=city.mayorCampaign,spec=MAYOR_CHALLENGES[kind];if(!spec)return city.fail('Desafio desconhecido.');
  s.challenges??=[];
  if(s.challenges.some(c=>c.status==='active'))return city.fail('Conclua o compromisso atual antes de assumir outro.');
  const term=city.politics.mandates.current?.id??s.startedAt;
  if(s.challenges.some(c=>c.term===term&&c.kind===kind))return city.fail('Este compromisso já foi assumido neste mandato.');
  const baseline=challengeValue(city,kind);
  if(kind==='food'&&baseline>=2||kind==='housing'&&baseline<=0)return city.fail('A cidade já atende esta demanda.');
  const target=kind==='food'?2:kind==='housing'?Math.max(0,baseline-Math.max(1,Math.ceil(baseline*.25))):baseline+1;
  const row={id:s.nextOrderId,term,kind,title:spec.title,baseline,target,current:baseline,startedAt:city.minute,deadline:city.minute+3*1440,status:'active'};
  s.challenges.push(row);return row;
}
export function updateMayorChallenges(city){
  const s=city.mayorCampaign;
  for(const c of s.challenges||[]){
    if(c.status!=='active')continue;
    c.current=challengeValue(city,c.kind);
    // A late update must never award an expired commitment.
    const met=c.kind==='housing'?c.current<=c.target:c.current>=c.target;
    if(city.minute>c.deadline||!met&&city.minute===c.deadline)c.status='failed';
    else if(met)c.status='completed';else continue;
    c.endedAt=city.minute;
    const description=`Compromisso ${c.status==='completed'?'cumprido':'não cumprido'}: ${c.title}.`;
    for(const person of city.citizens.filter(p=>!p.entity.destroyed&&city.society.isAdult(p)))city.politics.remember(person,{kind:'mayor-commitment',partyId:s.partyId,candidateId:s.mayorId,effect:c.status==='completed'?3:-4,promiseKey:`mayor-commitment:${s.startedAt}:${c.id}`,description});
    city.log(description,'government',[s.mayorId],{kind:'mayor-commitment',challengeId:c.id,status:c.status});
  }
}
