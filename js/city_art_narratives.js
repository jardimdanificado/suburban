const text=(value,limit)=>String(value??'').trim().slice(0,limit);

export function artworkNarrative(city,input){
  if(!input)return null;
  const mode=['faithful','distorted','invented'].includes(input.mode)?input.mode:'invented';
  const event=mode==='invented'?null:city.history?.get(input.sourceEventId);
  const source=event?{id:event.id,message:text(event.message,500),minute:event.minute,citizenIds:[...(event.citizenIds||[])],kind:event.kind}:input.source;
  if(mode!=='invented'&&(!source||source.id!==Number(input.sourceEventId)))return null;
  return {mode,sourceEventId:mode==='invented'?null:source.id,source:mode==='invented'?null:structuredClone(source),title:text(input.title||source?.message,180),description:text(input.description,500),claimedMinute:Number.isFinite(input.claimedMinute)?input.claimedMinute:source?.minute??null,claimedPlace:text(input.claimedPlace,120),participantIds:[...new Set((input.participantIds||source?.citizenIds||[]).filter(Number.isInteger))].slice(0,12),sourceClaim:text(input.sourceClaim,180)};
}

/** The observer evaluates the account using their memories, never its hidden accuracy. */
export function narrativeReception(c,narrative){
  const memories=(c.social?.memories||[]).filter(m=>m.kind!=='public-art'&&narrative.sourceEventId!=null&&m.eventId===narrative.sourceEventId);
  const familiarity=memories.length>0,critical=c.political?.criticalSense??.5;
  const knownPeople=memories.flatMap(m=>[m.actorId,m.targetId]).filter(Number.isInteger),contradiction=knownPeople.some(id=>!narrative.participantIds.includes(id));
  const support=(c.social?.beliefs||[]).some(b=>b.narrativeSourceEventId===narrative.sourceEventId&&narrative.sourceEventId!=null&&b.believes&&!b.corrected);
  return {familiarity,contradiction,acceptance:Math.max(.05,Math.min(.95,.45+(c.traits?.openness??.5)*.12-critical*.22+(contradiction?-.35:familiarity?.16:0)+(support?.12:0)))};
}
