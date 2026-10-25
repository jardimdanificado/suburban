import {GOVERNMENT_OUTCOMES} from './city_promise_evaluation.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Interpolate the predecessor's saved measurements at the same elapsed time.
function atElapsed(term,elapsed){
  const end=term.endedAt??term.startedAt,target=Math.min(end,term.startedAt+elapsed);
  const points=[{...term.baseline,minute:term.startedAt},...(term.checkpoints||[]).filter(r=>r.minute>term.startedAt&&r.minute<end),{...term.latest,minute:end}];
  let before=points[0];for(const after of points.slice(1)){
    if(after.minute>=target){const f=clamp((target-before.minute)/Math.max(1,after.minute-before.minute),0,1);return Object.fromEntries(Object.keys(GOVERNMENT_OUTCOMES).map(key=>[key,(before[key]??term.baseline[key]??0)*(1-f)+(after[key]??term.baseline[key]??0)*f]));}before=after;
  }
  return before;
}
export function governmentExpectations(p){
  const t=p.mandates.current,previous=t?[...p.mandates.terms].reverse().find(r=>r.id!==t.id&&r.endedAt!=null&&r.endedAt<=t.startedAt):null;
  if(!t||!previous)return {factor:1,previousTermId:null,detail:'Sem gestão anterior concluída para estabelecer uma referência.'};
  const elapsed=Math.max(0,p.city.minute-t.startedAt),previousDuration=Math.max(1,previous.endedAt-previous.startedAt),comparisonTime=Math.min(elapsed,previousDuration),prior=atElapsed(previous,comparisonTime);
  let currentGain=0,previousGain=0,currentRoom=0,previousRoom=0;
  for(const [key,[,weight]] of Object.entries(GOVERNMENT_OUTCOMES)){
    const base=t.baseline[key]??0,oldBase=previous.baseline[key]??0;
    currentGain+=Math.max(0,(t.latest[key]??base)-base)*weight;
    previousGain+=Math.max(0,(prior[key]??oldBase)-oldBase)*weight;
    currentRoom+=Math.max(0,100-base)*weight;previousRoom+=Math.max(0,100-oldBase)*weight;
  }
  const currentRate=currentGain/Math.max(1/24,elapsed/1440),previousRate=previousGain/Math.max(1/24,comparisonTime/1440);
  // Maintaining a city near its indicator ceilings cannot reproduce a recovery from crisis.
  const opportunity=previousRoom>0?clamp(currentRoom/previousRoom,0,1):1,expectedRate=previousRate*opportunity;
  const ratio=expectedRate>.25?currentRate/expectedRate:1;
  const confidence=clamp(elapsed/1440,0,1)*clamp(expectedRate/2,0,1);
  const factor=1+(clamp(.35+.65*ratio,.35,1.15)-1)*confidence;
  return {factor,previousTermId:previous.id,previousMayorName:previous.mayorName,elapsedDays:elapsed/1440,currentRate,previousRate,expectedRate,opportunity,ratio,
    detail:`Referência: gestão de ${previous.mayorName}, por interpolação das medições salvas. Avanço ponderado por dia: atual ${currentRate.toFixed(2)}, anterior ${previousRate.toFixed(2)}, expectativa ajustada à margem de melhoria ${expectedRate.toFixed(2)}. Bônus positivos multiplicados por ${factor.toFixed(2)}; retrocessos e penalidades não são reduzidos. A comparação ganha peso ao longo do primeiro dia.`};
}
