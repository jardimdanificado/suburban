const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export const GOVERNMENT_OUTCOMES=Object.freeze({happiness:['Felicidade',.28],fed:['Alimentação',.28],housed:['Moradia',.24],employed:['Ocupação',.18],health:['Saúde',.08],water:['Água',.08],hygiene:['Higiene',.06],rest:['Descanso',.04]});
export function outcomeAssessment(baseline,latest){
  const rows=Object.entries(GOVERNMENT_OUTCOMES).map(([metric,[label,weight]])=>{const before=Number(baseline[metric]||0),now=Number(latest[metric]||0);return {metric,label,baseline:before,current:now,change:now-before,points:(now-before)*weight};});
  const raw=rows.reduce((n,r)=>n+r.points,0);return {rows,raw,points:clamp(raw,-40,40)};
}
export function promiseAssessment(p,term,minute){
  const direction=p.higher?1:-1,goal=(p.target-p.baseline)*direction,change=(p.current-p.baseline)*direction;
  const scale=Math.max(.1,Math.abs(goal),Math.abs(p.target-(p.campaignBaseline??p.baseline))*.25);
  const progress=clamp(change/scale,-1,3),fulfilled=(p.current-p.target)*direction>=-.001;
  const duration=Math.max(1,term.calendarRules?.termMinutes||12*1440),elapsed=clamp((minute-term.startedAt)/duration);
  // An inherited target already met at inauguration gives no completion credit.
  const earned=goal>.001&&change>0,completionAt=p.fulfilledAt??(fulfilled&&earned?minute:null);
  const speed=completionAt==null?0:clamp(1-(completionAt-term.startedAt)/duration);
  const completion=fulfilled&&earned?16:0,early=completion?speed*14:0;
  const overdelivery=fulfilled&&earned?clamp((change-goal)/scale,0,2):0;
  const partial=clamp(progress)*8,excess=overdelivery*10;
  const attention=p.attention??.4,pending=fulfilled?0:-(1-clamp(progress))*elapsed*(16+attention*18);
  const regression=Math.min(0,progress)*18-(completionAt!=null&&!fulfilled?6:0);
  return {goal,change,progress,fulfilled,earned,completionAt,speed,overdelivery,partial,completion,early,excess,pending,regression,points:partial+completion+early+excess+pending+regression};
}
export function promiseDifficulty(metric,baseline,target,spec){
  const goal=Math.abs(target-baseline),step=spec.unit==='%'?(metric==='inflation'?Math.max(.1,baseline*.35):metric==='tax'?5:20):spec.unit==='centavos'?Math.max(30,baseline*.2):Math.max(1,Math.abs(baseline)*.35);
  const difficulty=clamp(goal/step,.1,4),attention=clamp(difficulty/3);
  return {difficulty,attention,ambitionLabel:difficulty>=2.5?'Ousada':difficulty>=1.5?'Alta':difficulty>=.75?'Moderada':'Baixa'};
}
