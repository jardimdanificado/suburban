const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hash(a,b){let n=Math.imul(a+101,b+197)^Math.imul(a+17,2654435761);n=Math.imul(n^(n>>>16),2246822507);return (n^(n>>>13))>>>0;}
export function electoralPriorities(c){
  const s=c.political;if(s.electoralPriorities)return s.electoralPriorities;
  const traits=c.traits||{},u=salt=>hash(c.id,salt)/4294967296;
  return s.electoralPriorities=Object.freeze({ideology:14+(1-(traits.openness??.5))*7+u(31)*7,competence:.65+u(37)*.65,material:.65+(traits.empathy??.5)*.4+u(41)*.45,renewal:.25+(s.independence??.6)*.5+u(43)*.35,green:.5+u(47),civil:.6+u(53)*.8});
}
export function captureGovernmentExperience(city,c,termId){
  return c.political.governmentExperience={termId,happiness:c.happiness,food:c.needs.food,health:c.needs.health,housed:!!c.homeUnitId,employed:!!(c.jobId||c.businessIds.length||c.role==='councilor')};
}
export function personalGovernmentExperience(city,c,term){
  if(!term)return 0;const baseline=c.political.governmentExperience;if(!baseline||baseline.termId!==term.id){captureGovernmentExperience(city,c,term.id);return 0;}
  const employed=!!(c.jobId||c.businessIds.length||c.role==='councilor');
  return clamp((c.happiness-baseline.happiness)*.16+(c.needs.health-baseline.health)*.05+(Number(!!c.homeUnitId)-Number(baseline.housed))*6+(Number(employed)-Number(baseline.employed))*4,-12,12);
}
export function governingStreak(p,partyId){let count=0;for(let i=p.mandates.terms.length-1;i>=0;i--){const term=p.mandates.terms[i];if(term.partyId!==partyId)break;count+=term.provisional?.5:1;}return count;}
/** Public image is useful evidence, but correlated measures cannot compound without limit. */
export function standingEvidence(p,voter,candidate,party){
  const governing=p.mandates.current?.partyId===party.id,record=p.mandates.recordScore(candidate.id,party.id),parts=[['popularidade pessoal',((candidate.political.popularity??50)-50)*.12],['reputação do partido',((party.publicReputation??50)-50)*.1],['balanço dos governos',Math.tanh(record/24)*8]];
  if(governing)parts.push(['avaliação da gestão do partido',Math.tanh((p.approval-50)/30)*6]);
  const positive=parts.reduce((n,[,v])=>n+Math.max(0,v),0),scale=positive>18?18/positive:1;
  return parts.map(([reason,value])=>({reason,value:value>0?value*scale:value}));
}
export function campaignMemory(voter,candidate,party,election,minute){
  if(!election)return 0;let raw=0;for(const memory of voter.political.memories){if(memory.electionId!==election?.id||memory.corrected||memory.believes===false)continue;if(memory.candidateId!==candidate.id&&memory.partyId!==party.id)continue;
    const age=Math.max(0,minute-memory.minute),weight=Math.exp(-age/(4*1440));raw+=(memory.effect||0)*(memory.candidateId===candidate.id?1:.2)*weight;
  }return Math.tanh(raw/18)*12;
}
export function personalAffinity(voter,candidate){return (hash(voter.id,candidate.id)/4294967296-.5)*12;}
