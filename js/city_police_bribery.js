const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<=1.6;

export function offerPoliceBribe(justice,record,payer,amount){
  const city=justice.city,investigation=record?.investigation,officer=city.society.citizen(investigation?.officerId);
  const station=city.building?.(investigation?.stationId);
  if(!payer||!officer||!station?.active||station.type!=='police_station'||officer?.jobId!==station.id||city.society.isAdult?.(payer)===false)return false;
  if(record?.status!=='investigating'||!officer||!payer||officer===payer||investigation.bribe||officer.entity.destroyed||payer.entity.destroyed||payer.custody||officer.custody||(payer.needs?.health??100)<=20||(officer.needs?.health??100)<=20||(payer.unconsciousUntil||0)>city.minute||(officer.unconsciousUntil||0)>city.minute||!Number.isSafeInteger(amount)||amount<=0)return false;
  const a=justice.observationScene(officer),b=justice.observationScene(payer);
  if(a.buildingId!==b.buildingId||a.unitId!==b.unitId||a.floor!==b.floor||Math.abs(a.height-b.height)>.5||!near(justice.observationPosition(officer),justice.observationPosition(payer)))return false;
  if(!city.accounts?.has(payer.accountId)||!city.accounts.has(officer.accountId)||(city.accounts.get(payer.accountId).balance||0)<amount)return false;
  const known=(record.witnesses||[]).some(w=>w.identifiedSuspectId===payer.id)||(record.evidence||[]).some(e=>e.implicatedCitizenId===payer.id);
  if(!known)return false;
  const accepted=city.random()<Math.max(0,(1-(officer.traits?.honesty??.5))*.8);
  if(accepted&&!city.transfer(payer.accountId,officer.accountId,amount,'Pagamento clandestino a investigador',{caseId:record.id,officerId:officer.id,payerId:payer.id}))return false;
  const event=city.log(accepted?'Um investigador recebeu um pagamento clandestino para interferir num inquérito.':'Um investigador recusou e registrou uma tentativa de suborno.','justice',[officer.id,payer.id],{kind:accepted?'police-bribe-paid':'police-bribe-refused',caseId:record.id,amount:accepted?amount:0,offeredAmount:amount});
  const bribe=investigation.bribe={status:accepted?'paid':'refused',officerId:officer.id,payerId:payer.id,amount:accepted?amount:0,offeredAmount:amount,minute:city.minute,paymentEventId:accepted?(city.ledger?.at(-1)?.eventId??event.id):null,eventId:event.id,caseIds:[]};
  for(const accused of accepted?[payer,officer]:[payer]){
    const complaint=justice.crimeRecord('policeBribery',accused.id,null,{sourceCaseId:record.id,investigatorUnderReviewId:officer.id,payerId:payer.id,officerId:officer.id,role:accused===officer?'recipient':'payer',amount:bribe.amount,attempted:!accepted,bribeEventId:event.id,paymentEventId:bribe.paymentEventId},{observe:false});
    if(!complaint)continue;bribe.caseIds.push(complaint.id);
    if(!accepted){complaint.status='reported';complaint.reportedAt=city.minute;complaint.reportSource='officer-refusal';complaint.statement={reporterId:officer.id,description:'O investigador registrou a oferta de pagamento para interferir na investigação.'};complaint.witnesses.push({citizenId:officer.id,identifiedSuspectId:payer.id,confidence:.95,noticedAt:city.minute});}
    else for(const witness of city.citizens||[]){
      if([officer.id,payer.id].includes(witness.id)||!justice.canObserve(witness,complaint.position,complaint.scene))continue;
      const confidence=Math.max(0,Math.min(.95,complaint.visibility*(1-Math.hypot(witness.entity.x-complaint.position.x,witness.entity.y-complaint.position.y)/4)));
      if(city.random()<confidence)complaint.witnesses.push({citizenId:witness.id,identifiedSuspectId:confidence>.72?accused.id:null,confidence,noticedAt:city.minute});
    }
    complaint.witnessIds=complaint.witnesses.map(w=>w.citizenId);justice.rememberObservedCrime(complaint);justice.dispatchPoliceResponse(complaint);
  }
  return bribe;
}

export function considerPoliceBribe(justice,record){
  const city=justice.city;if(record.investigation.bribe||city.minute-(record.lastBribeConsideredAt??-Infinity)<60)return;
  record.lastBribeConsideredAt=city.minute;
  const ids=new Set([...(record.witnesses||[]).map(w=>w.identifiedSuspectId),...(record.evidence||[]).map(e=>e.implicatedCitizenId)].filter(Number.isInteger));
  for(const id of ids){const payer=city.society.citizen(id);if(!payer||payer.entity.destroyed||payer.custody||(payer.traits?.honesty??.5)>.2||(payer.traits?.riskTolerance??.5)<.65)continue;
    if(city.random()>.003)continue;const balance=city.accounts?.get(payer.accountId)?.balance||0,amount=Math.floor(Math.min(city.currency?.price(5000)??5000,balance*.1));
    if(amount>0&&offerPoliceBribe(justice,record,payer,amount))break;
  }
}

export function reopenBribedInvestigation(justice,conviction){
  if(conviction.type!=='policeBribery'||conviction.status!=='convicted'||conviction.details?.role!=='recipient'||conviction.chargedCitizenId!==conviction.details.officerId)return;
  const source=justice.cases.find(r=>r.id===conviction.details.sourceCaseId);
  if(!source||source.status!=='no-suspect'||source.investigation?.bribe?.status!=='paid')return;
  const previous=source.investigation;previous.bribe.status='exposed';previous.bribe.exposedAt=justice.city.minute;source.pastInvestigations??=[];source.pastInvestigations.push(previous);source.investigation=null;source.status='reported';source.details??={};source.details.investigatorUnderReviewId=previous.officerId;source.reopenedAt=justice.city.minute;source.reopenedByCaseId=conviction.id;
  justice.city.log(`O caso #${source.id} foi reaberto após condenação por suborno do investigador.`,'justice',[],{kind:'bribed-investigation-reopened',caseId:source.id,corruptionCaseId:conviction.id});
}
