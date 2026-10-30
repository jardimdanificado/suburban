const near=(a,b)=>!!a&&!!b&&Math.hypot(a.x-b.x,a.y-b.y)<=1.6;

function sameScene(justice,a,b){
  const left=justice.observationScene(a),right=justice.observationScene(b);
  return left.buildingId===right.buildingId&&left.unitId===right.unitId&&left.floor===right.floor&&Math.abs(left.height-right.height)<=.5;
}

function relatedCase(justice,body){
  if(!body)return null;
  return justice.cases.find(record=>record.id===(body.criminalCaseId??body.circumstances?.caseId))||
    justice.cases.find(record=>record.type==='murder'&&record.victimId===body.citizenId&&Math.abs(record.occurredAt-body.diedAt)<=1)||null;
}

function identifiedSuspects(record){
  return [...new Set([record?.chargedCitizenId,record?.investigation?.suspectId,...(record?.witnesses||[]).map(w=>w.identifiedSuspectId)].filter(Number.isInteger))];
}

function conflictedForensicParticipants(source,briberyCase){
  return [...new Set([briberyCase?.chargedCitizenId,briberyCase?.details?.examinerId,briberyCase?.details?.payerId,source?.chargedCitizenId,source?.investigation?.suspectId,source?.investigation?.officerId,...(source?.witnesses||[]).flatMap(item=>[item.citizenId,item.identifiedSuspectId]),...(source?.evidence||[]).flatMap(item=>[item.implicatedCitizenId,item.identifiedSuspectId])].filter(Number.isSafeInteger))];
}

export function offerForensicBribe(justice,body,payer,examiner,amount){
  const city=justice.city,iml=city.building(body?.imlBuildingId),record=relatedCase(justice,body);
  if(!body||body.status!=='autopsy'||body.autopsy||body.forensicBribe||!iml||iml.type!=='iml'||!record||!payer||!examiner||
    !identifiedSuspects(record).includes(payer.id)||payer===examiner||examiner.jobId!==iml.id||examiner.indoorLocation?.buildingId!==iml.id||
    payer.entity.destroyed||examiner.entity.destroyed||payer.custody||examiner.custody||
    (payer.needs?.health??100)<=20||(examiner.needs?.health??100)<=20||(payer.unconsciousUntil||0)>city.minute||(examiner.unconsciousUntil||0)>city.minute||
    !Number.isSafeInteger(amount)||amount<=0||!sameScene(justice,payer,examiner)||!near(justice.observationPosition(payer),justice.observationPosition(examiner)))return false;
  body.criminalCaseId??=record.id;
  const payerAccount=city.accounts?.get(payer.accountId),examinerAccount=city.accounts?.get(examiner.accountId);if(!payerAccount||!examinerAccount||(payerAccount.balance||0)<amount)return false;
  const accepted=city.random()<Math.max(.02,Math.min(.95,(1-(examiner.traits?.honesty??.5))*.8));
  if(accepted&&!city.transfer(payer.accountId,examiner.accountId,amount,'Pagamento clandestino a perito do IML',{bodyId:body.id,caseId:record.id,payerId:payer.id,examinerId:examiner.id}))return false;
  const event=city.log(accepted?'Um perito recebeu dinheiro para adulterar um laudo.':'Um perito recusou e registrou uma oferta para adulterar o laudo.','justice',[payer.id,examiner.id],{kind:accepted?'forensic-bribe-paid':'forensic-bribe-refused',bodyId:body.id,caseId:record.id,amount:accepted?amount:0,offeredAmount:amount});
  const bribe=body.forensicBribe={status:accepted?'paid':'refused',bodyId:body.id,caseId:record.id,payerId:payer.id,examinerId:examiner.id,amount:accepted?amount:0,offeredAmount:amount,minute:city.minute,eventId:event.id,paymentEventId:accepted?(city.ledger?.at(-1)?.eventId??event.id):null,caseIds:[]};
  const accused=accepted?[payer,examiner]:[payer];
  for(const person of accused){
    const role=person===examiner?'recipient':'payer',complaint=justice.crimeRecord('forensicBribery',person.id,person===examiner?payer.id:examiner.id,{bodyId:body.id,sourceCaseId:record.id,payerId:payer.id,examinerId:examiner.id,role,attempted:!accepted,amount:bribe.amount,bribeEventId:event.id,paymentEventId:bribe.paymentEventId,position:{...justice.observationPosition(examiner)},scene:{...justice.observationScene(examiner)}});
    if(!complaint)continue;bribe.caseIds.push(complaint.id);
    if(!accepted&&person===payer){complaint.status='reported';complaint.reportedAt=city.minute;complaint.reportSource='examiner-refusal';complaint.statement={reporterId:examiner.id,description:'O perito recusou e denunciou a tentativa de compra do laudo.',confidence:.95};}
  }
  return bribe;
}

export function considerForensicBribe(justice,body,examiner){
  const city=justice.city;if(body.status!=='autopsy'||body.autopsy||body.forensicBribe||city.minute-(body.lastForensicBribeConsideredAt??-Infinity)<60)return;
  body.lastForensicBribeConsideredAt=city.minute;const record=relatedCase(justice,body);if(!record)return;
  for(const id of identifiedSuspects(record)){
    const payer=city.society.citizen(id);if(!payer||payer===examiner||payer.entity.destroyed||payer.custody||(payer.traits?.honesty??.5)>.12||(payer.traits?.riskTolerance??.5)<.72||city.random()>.001)continue;
    const balance=city.accounts?.get(payer.accountId)?.balance||0,amount=Math.floor(Math.min(city.currency?.price(10000)??10000,balance*.1));if(amount>0&&offerForensicBribe(justice,body,payer,examiner,amount))return;
  }
}

export function preserveReportedForensicEvidence(justice,briberyCase){
  const details=briberyCase?.details;if(briberyCase?.type!=='forensicBribery'||details?.role!=='recipient'||details.attempted||!(details.amount>0)||!['reported','investigating','arrest-requested','arrested','charged','convicted'].includes(briberyCase.status))return false;
  const body=justice.bodies.find(item=>item.id===details.bodyId),source=justice.cases.find(item=>item.id===details.sourceCaseId);if(!body)return false;
  body.autopsyReview??={openedAt:justice.city.minute,briberyCaseId:briberyCase.id,examinerId:body.autopsy?.examinerId,officialReport:body.autopsy?structuredClone(body.autopsy):null};
  const review=body.autopsyReview;review.briberyCaseId=briberyCase.id;review.independenceExcludedIds=conflictedForensicParticipants(source,briberyCase);
  const holdTrial=()=>{if(source&&['charged','arrested'].includes(source.status)&&['underway','awaiting-return-to-iml'].includes(review.physicalReviewStatus)){source.details??={};source.details.forensicReviewPendingBodyId=body.id;}};
  if(['completed','underway','awaiting-return-to-iml','impossible-cremated'].includes(review.physicalReviewStatus)){details.physicalReviewStatus=review.physicalReviewStatus;if(review.physicalReviewStatus==='completed'){details.physicalReviewCompletedAt=review.completedAt;details.physicalReviewExaminerId=review.reviewerId;}holdTrial();return true;}
  const requested=justice.requestForensicSecondOpinion(body,briberyCase.id);details.physicalReviewStatus=review.physicalReviewStatus;details.physicalReviewRequestedAt??=justice.city.minute;
  holdTrial();
  if(!requested&&review.physicalReviewStatus==='impossible-cremated')details.physicalReviewUnavailableAt=justice.city.minute;
  return requested;
}

export function reviewBribedAutopsy(justice,conviction){
  if(conviction.type!=='forensicBribery'||conviction.status!=='convicted'||conviction.details?.role!=='recipient'||conviction.details?.examinerId!==conviction.chargedCitizenId)return false;
  const city=justice.city;
  if(!conviction.details.forensicSanctionAppliedAt){
    conviction.details.forensicSanctionAppliedAt=city.minute;
    const examiner=city.society.citizen(conviction.chargedCitizenId);
    if(examiner){examiner.forensicDisqualifiedAt??=city.minute;examiner.forensicDisqualificationCaseId=conviction.id;const job=city.building(examiner.jobId);if(job?.type==='iml')city.economy?.leaveJob(examiner,'Condenação por suborno e adulteração de laudo pericial');city.log(`${examiner.entity.properties.name} perdeu o vínculo pericial após condenação por suborno.`,'justice',[examiner.id],{kind:'forensic-examiner-disqualified',caseId:conviction.id,citizenId:examiner.id,buildingId:job?.type==='iml'?job.id:null});}
  }
  if(conviction.details.forensicReviewAppliedAt)return false;
  const body=justice.bodies.find(item=>item.id===conviction.details.bodyId),source=justice.cases.find(item=>item.id===conviction.details.sourceCaseId),parallel=body?.forensicObserverRecord;
  if(!body||!source||!parallel||body.forensicBribe?.examinerId!==conviction.chargedCitizenId)return false;
  conviction.details.forensicReviewAppliedAt=city.minute;body.forensicBribe.status='exposed';body.forensicBribe.exposedAt=city.minute;
  const review=body.autopsyReview??={openedAt:city.minute,briberyCaseId:conviction.id,examinerId:conviction.chargedCitizenId,officialReport:body.autopsy?structuredClone(body.autopsy):null};
  review.parallelRecord??={cause:parallel.cause,estimatedDeathMinute:parallel.estimatedDeathMinute,deathWindow:{...parallel.deathWindow},suspicious:parallel.suspicious,findings:parallel.findings.map(item=>({...item}))};
  review.independenceExcludedIds=conflictedForensicParticipants(source,conviction);
  justice.requestForensicSecondOpinion(body,conviction.id);
  source.evidence??=[];if(!source.evidence.some(item=>item.kind==='forensic-review'&&item.bodyId===body.id))source.evidence.push({kind:'forensic-review',bodyId:body.id,briberyCaseId:conviction.id,examinerId:conviction.chargedCitizenId,recordedAt:city.minute,cause:parallel.cause,confidence:Math.max(.5,parallel.confidence||.5),deathWindow:{...parallel.deathWindow},findings:parallel.findings.map(item=>({...item})),suspicious:parallel.suspicious,recoveredAfterBriberyConviction:true});
  if(source.trial&&['convicted','acquitted'].includes(source.trial.status)&&['convicted','acquitted'].includes(source.status))justice.reopenBribedForensicJudgment(conviction,source,body);
  if(source.status==='no-suspect'||source.status==='closed'){
    if(source.investigation){source.pastInvestigations??=[];source.pastInvestigations.push(source.investigation);}
    source.investigation=null;source.status='reported';source.reportedAt=city.minute;source.reportSource='forensic-review';source.closedAt=null;source.closureReason=null;
    source.details??={};source.details.forensicReviewCaseId=conviction.id;
    city.log(`O caso #${source.id} foi reaberto após a condenação do perito; os registros da autópsia serão reavaliados.`,'justice',[conviction.chargedCitizenId].filter(Number.isInteger),{kind:'bribed-autopsy-review-opened',caseId:source.id,bodyId:body.id,briberyCaseId:conviction.id});
  }
  return true;
}
