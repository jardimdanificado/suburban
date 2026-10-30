const near=(a,b)=>!!a&&!!b&&Math.hypot(a.x-b.x,a.y-b.y)<=1.6;

function sameScene(justice,a,b){
  const left=justice.observationScene(a),right=justice.observationScene(b);
  return left.buildingId===right.buildingId&&left.unitId===right.unitId&&left.floor===right.floor&&Math.abs(left.height-right.height)<=.5;
}

export function offerWitnessBribe(justice,record,payer,witness,amount){
  const city=justice.city,statement=record?.witnesses?.find(item=>item.citizenId===witness?.id);
  if(!record||['witnessBribery','policeBribery'].includes(record.type)||!statement||!payer||!witness||payer===witness||!['reported','investigating'].includes(record.status)||
    record.witnessBribes?.some(item=>item.witnessId===witness.id)||
    ![record.offenderId,statement.identifiedSuspectId].includes(payer.id)||
    payer.entity.destroyed||witness.entity.destroyed||payer.custody||witness.custody||
    (payer.needs?.health??100)<=20||(witness.needs?.health??100)<=20||
    (payer.unconsciousUntil||0)>city.minute||(witness.unconsciousUntil||0)>city.minute||
    !Number.isSafeInteger(amount)||amount<=0||!sameScene(justice,payer,witness)||
    !near(justice.observationPosition(payer),justice.observationPosition(witness)))return false;
  const payerAccount=city.accounts?.get(payer.accountId),witnessAccount=city.accounts?.get(witness.accountId);
  if(!payerAccount||!witnessAccount||(payerAccount.balance||0)<amount)return false;
  const accepted=city.random()<Math.max(.02,Math.min(.95,(1-(witness.traits?.honesty??.5))*.8));
  if(accepted&&!city.transfer(payer.accountId,witness.accountId,amount,'Pagamento clandestino a testemunha',{caseId:record.id,payerId:payer.id,witnessId:witness.id}))return false;
  const event=city.log(accepted?'Uma testemunha recebeu dinheiro para alterar seu depoimento.':'Uma testemunha recusou uma oferta para alterar seu depoimento.','justice',[payer.id,witness.id],{kind:accepted?'witness-bribe-paid':'witness-bribe-refused',caseId:record.id,amount:accepted?amount:0,offeredAmount:amount});
  const bribe={status:accepted?'paid':'refused',caseId:record.id,payerId:payer.id,witnessId:witness.id,amount:accepted?amount:0,offeredAmount:amount,minute:city.minute,eventId:event.id,paymentEventId:accepted?(city.ledger?.at(-1)?.eventId??event.id):null};
  (record.witnessBribes??=[]).push(bribe);
  const accused=accepted?[payer,witness]:[payer];
  for(const person of accused){
    const role=person===witness?'recipient':'payer';
    const complaint=justice.crimeRecord('witnessBribery',person.id,person===witness?payer.id:witness.id,{sourceCaseId:record.id,payerId:payer.id,witnessId:witness.id,role,amount:bribe.amount,attempted:!accepted,bribeEventId:event.id,paymentEventId:bribe.paymentEventId,position:{...justice.observationPosition(witness)},scene:{...justice.observationScene(witness)}});
    if(!complaint)continue;bribe.caseIds??=[];bribe.caseIds.push(complaint.id);
    if(!accepted&&person===payer){complaint.status='reported';complaint.reportedAt=city.minute;complaint.reportSource='witness-refusal';complaint.statement={reporterId:witness.id,description:'A testemunha recusou e denunciou a tentativa de compra do depoimento.',confidence:.9};complaint.witnesses.push({citizenId:witness.id,identifiedSuspectId:payer.id,confidence:.95,noticedAt:city.minute,role:'victim'});complaint.witnessIds=[...new Set(complaint.witnesses.map(item=>item.citizenId))];}
  }
  if(!accepted)statement.bribeRefusalReportedAt=city.minute;
  return bribe;
}

export function considerWitnessBribe(justice,record){
  const city=justice.city;if(['witnessBribery','policeBribery'].includes(record.type)||!['reported','investigating'].includes(record.status)||city.minute-(record.lastWitnessBribeConsideredAt??-Infinity)<60)return;
  record.lastWitnessBribeConsideredAt=city.minute;
  for(const statement of record.witnesses||[]){
    if(statement.interviewStatus||record.witnessBribes?.some(item=>item.witnessId===statement.citizenId))continue;
    const payer=city.society.citizen(statement.identifiedSuspectId??record.offenderId),witness=city.society.citizen(statement.citizenId);
    if(!payer||!witness||payer===witness||payer.entity.destroyed||witness.entity.destroyed||payer.custody||witness.custody||
      (payer.traits?.honesty??.5)>.18||(payer.traits?.riskTolerance??.5)<.7||city.random()>.002)continue;
    const balance=city.accounts?.get(payer.accountId)?.balance||0,amount=Math.floor(Math.min(city.currency?.price(3000)??3000,balance*.08));
    if(amount>0&&offerWitnessBribe(justice,record,payer,witness,amount))return;
  }
}

export function alterBribedTestimony(justice,record,witness,testimony){
  const bribe=record.witnessBribes?.find(item=>item.witnessId===witness.id&&item.status==='paid');if(!bribe)return testimony;
  if(justice.city.random()<.55){testimony.identifiedSuspectId=null;testimony.confidence=Math.min(.35,testimony.confidence);testimony.bribeEffect='omission';}
  else{
    const candidates=justice.city.citizens.filter(person=>!person.entity.destroyed&&person.id!==witness.id&&person.id!==bribe.payerId&&person.id!==record.offenderId);
    const falseLead=candidates[Math.floor(justice.city.random()*Math.max(1,candidates.length))];
    testimony.identifiedSuspectId=falseLead?.id??null;testimony.confidence=falseLead?Math.min(.7,Math.max(.3,testimony.confidence)):0;testimony.bribeEffect=falseLead?'false-identification':'omission';
  }
  bribe.testimonyRecordedAt=justice.city.minute;bribe.effect=testimony.bribeEffect;
  return testimony;
}
