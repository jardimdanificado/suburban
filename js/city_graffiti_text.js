import {gerarFraseTematica} from './gerador_frases.js';

function politicalGraffiti(city,c){
  const politics=city.politics;if(!politics)return null;
  const memories=c.political?.memories||[],parties=(politics.parties||[]).filter(p=>p.active);
  const known=memories.filter(m=>['proven-scandal','corruption-rumor'].includes(m.kind)&&m.candidateId!=null);
  const hostile=memories.filter(m=>(m.effect||0)<0&&m.candidateId!=null);
  const own=parties.find(p=>p.id===c.political?.partyId);
  if(!known.length&&!hostile.length&&!own)return null;
  // Civic knowledge belongs to the author: never inspect undisclosed cases.
  if(city.random()>=.65)return null;
  const pool=known.length?known:hostile;
  if(pool.length){
    const memory=pool[Math.floor(city.random()*pool.length)],target=city.society?.citizen?.(memory.candidateId);
    if(target&&!target.entity?.destroyed){
      const party=parties.find(p=>p.id===(memory.partyId??target.political?.partyId));
      const proven=memory.kind==='proven-scandal',rumor=memory.kind==='corruption-rumor';
      const insults=proven?['ladrão','corrupto','safado']:rumor?['ladrão?','corrupto?']:['safado','canalha','sem-vergonha'];
      const insult=insults[Math.floor(city.random()*insults.length)];
      return {subjectId:target.id,partyId:party?.id??null,politicalKind:proven?'corruption':rumor?'corruption-rumor':'political-insult',corruptionCaseId:memory.caseId??null,
        targetName:`${String(target.entity.properties.name).slice(0,56)}: ${insult}${party?` · ${String(party.short||party.name).slice(0,20)} ${party.number}`:''}`};
    }
  }
  if(own)return {subjectId:null,partyId:own.id,politicalKind:'party-support',targetName:`${String(own.short||own.name).slice(0,60)} · ${own.number}`};
  return null;
}

export function graffitiContent(city,c,{protest=false,targetName=null}={}){
  const political=politicalGraffiti(city,c);
  if(political){protest=true;targetName=political.targetName;}

  const themes=['cidade'];
  if(c.homeUnitId===null)themes.push('moradia');
  if(c.needs?.food<42)themes.push('alimentacao');
  if(c.needs?.health<45)themes.push('saude');
  if(protest)themes.push('politica');
  const sentence=gerarFraseTematica(themes,{random:()=>city.random(),complexidade:'simples'});
  const suffix=targetName?` · ${String(targetName).trim().slice(0,political?110:60)}`:'',limit=180-suffix.length;
  const message=sentence.length<=limit?sentence:sentence.slice(0,limit-1).replace(/\s+\S*$/u,'').replace(/[.,;:!?]+$/u,'')+'.';
  return {message:message+suffix,...(political?{subjectId:political.subjectId,partyId:political.partyId,politicalKind:political.politicalKind,corruptionCaseId:political.corruptionCaseId??null}:{})};
}

export function graffitiMessage(city,c,options){return graffitiContent(city,c,options).message;}
