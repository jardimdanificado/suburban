const text=(value,limit)=>String(value??'').trim().slice(0,limit);

export function artworkParticipants(event,subjectId=null){const ids=[...new Set((event?.citizenIds||[]).filter(Number.isInteger))];if(Number.isInteger(subjectId)&&!ids.includes(subjectId)){if(ids.length>=12)ids[11]=subjectId;else ids.push(subjectId);}return ids.slice(0,12);}

/** Select visual motifs only from the story the artist chose to tell. */
export function narrativeSceneType(narrative){
  const source=narrative?.source||{},words=`${source.kind||''} ${source.message||''} ${narrative?.title||''} ${narrative?.description||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/protest|manifest|demonstr|repress|passeata/.test(words))return 'protest';
  if(/eleic|vot|urna|campanh|candid/.test(words))return 'election';
  if(/crime|assalt|agred|homicid|roub|ataque|conflit/.test(words))return 'conflict';
  if(/hospital|saude|resgat|socor|cura|atendiment/.test(words))return 'care';
  if(/inaugur|construc|abertur|ponte|edific/.test(words))return 'civic';
  if(/fest|celebr|comemor|encontro|conquista/.test(words))return 'celebration';
  return 'gathering';
}

export function artworkNarrative(city,input){
  if(!input)return null;
  const mode=['faithful','distorted','invented'].includes(input.mode)?input.mode:'invented';
  const event=mode==='invented'?null:city.history?.get(input.sourceEventId);
  const source=event?{id:event.id,message:text(event.message,500),minute:event.minute,citizenIds:[...(event.citizenIds||[])],kind:event.kind}:input.source;
  if(mode!=='invented'&&(!source||source.id!==Number(input.sourceEventId)))return null;
  const participantIds=[...new Set((input.participantIds||source?.citizenIds||[]).filter(Number.isInteger))].slice(0,12),roles=new Set(['protagonist','antagonist','victim','witness','leader','rescuer','participant']);
  const participantRoles=(input.participantRoles||[]).filter(row=>row&&participantIds.includes(row.citizenId)&&roles.has(row.role)).slice(0,12).map(row=>({citizenId:row.citizenId,role:row.role}));
  return {mode,sourceEventId:mode==='invented'?null:source.id,source:mode==='invented'?null:structuredClone(source),title:text(input.title||source?.message,180),description:text(input.description,500),claimedMinute:Number.isFinite(input.claimedMinute)?input.claimedMinute:source?.minute??null,claimedDate:text(input.claimedDate,80),claimedPlace:text(input.claimedPlace,120),participantIds,participantRoles,sourceClaim:text(input.sourceClaim,180),responseToArtId:Number.isSafeInteger(input.responseToArtId)?input.responseToArtId:null};
}

export function narrativeRoleForParticipant(narrative,citizenId){return narrative?.participantRoles?.find(row=>row.citizenId===citizenId)?.role||'participant';}

/** The observer evaluates the account using their memories, never its hidden accuracy. */
export function narrativeReception(c,narrative){
  const memories=(c.social?.memories||[]).filter(m=>m.kind!=='public-art'&&narrative.sourceEventId!=null&&m.eventId===narrative.sourceEventId);
  const familiarity=memories.length>0,critical=c.political?.criticalSense??.5;
  const knownPeople=memories.flatMap(m=>[m.actorId,m.targetId]).filter(Number.isInteger),omittedPerson=knownPeople.some(id=>!narrative.participantIds.includes(id)),roleContradiction=(narrative.participantRoles||[]).some(({citizenId,role})=>memories.some(m=>role==='victim'&&m.actorId===citizenId||role==='antagonist'&&m.targetId===citizenId||role==='witness'&&[m.actorId,m.targetId].includes(citizenId)));
  const contradiction=omittedPerson||roleContradiction;
  const support=(c.social?.beliefs||[]).some(b=>b.narrativeSourceEventId===narrative.sourceEventId&&narrative.sourceEventId!=null&&b.believes&&!b.corrected);
  return {familiarity,contradiction,acceptance:Math.max(.05,Math.min(.95,.45+(c.traits?.openness??.5)*.12-critical*.22+(contradiction?-.35:familiarity?.16:0)+(support?.12:0)))};
}
