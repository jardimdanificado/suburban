const near=(a,b)=>!!a&&!!b&&Math.hypot(a.x-b.x,a.y-b.y)<=1.6;

function sameScene(justice,a,b){
  const left=justice.observationScene(a),right=justice.observationScene(b);
  return left.buildingId===right.buildingId&&left.unitId===right.unitId&&left.floor===right.floor&&Math.abs(left.height-right.height)<=.5;
}

export function offerJudgeBribe(justice,record,payer,amount){
  const city=justice.city,trial=record?.trial,judge=city.society.citizen(trial?.judgeId);
  if(!record||record.type==='judgeBribery'||trial?.status!=='hearing-scheduled'||trial.judgeBribe||!payer||payer.id!==record.chargedCitizenId||!judge||payer===judge||
    payer.entity.destroyed||judge.entity.destroyed||payer.custody||judge.custody||(payer.needs?.health??100)<=20||(judge.needs?.health??100)<=20||
    (payer.unconsciousUntil||0)>city.minute||(judge.unconsciousUntil||0)>city.minute||!Number.isSafeInteger(amount)||amount<=0||
    !sameScene(justice,payer,judge)||!near(justice.observationPosition(payer),justice.observationPosition(judge)))return false;
  const payerAccount=city.accounts?.get(payer.accountId),judgeAccount=city.accounts?.get(judge.accountId);if(!payerAccount||!judgeAccount||(payerAccount.balance||0)<amount)return false;
  const accepted=city.random()<Math.max(.02,Math.min(.95,(1-(judge.traits?.honesty??.5))*.8));
  if(accepted&&!city.transfer(payer.accountId,judge.accountId,amount,'Pagamento clandestino a juiz',{caseId:record.id,payerId:payer.id,judgeId:judge.id}))return false;
  const event=city.log(accepted?'Um juiz recebeu dinheiro para favorecer uma das partes.':'Um juiz recusou e registrou uma oferta de suborno.','justice',[payer.id,judge.id],{kind:accepted?'judge-bribe-paid':'judge-bribe-refused',caseId:record.id,amount:accepted?amount:0,offeredAmount:amount});
  const bribe=trial.judgeBribe={status:accepted?'paid':'refused',caseId:record.id,payerId:payer.id,judgeId:judge.id,amount:accepted?amount:0,offeredAmount:amount,minute:city.minute,eventId:event.id,paymentEventId:accepted?(city.ledger?.at(-1)?.eventId??event.id):null,caseIds:[]};
  const accused=accepted?[payer,judge]:[payer];
  for(const person of accused){
    const role=person===judge?'recipient':'payer';
    const complaint=justice.crimeRecord('judgeBribery',person.id,person===judge?payer.id:judge.id,{sourceCaseId:record.id,payerId:payer.id,judgeId:judge.id,role,attempted:!accepted,amount:bribe.amount,bribeEventId:event.id,paymentEventId:bribe.paymentEventId,position:{...justice.observationPosition(judge)},scene:{...justice.observationScene(judge)}});
    if(!complaint)continue;bribe.caseIds.push(complaint.id);
    if(!accepted&&person===payer){complaint.status='reported';complaint.reportedAt=city.minute;complaint.reportSource='judge-refusal';complaint.statement={reporterId:judge.id,description:'O juiz recusou e denunciou a tentativa de compra da decisão.',confidence:.95};}
  }
  return bribe;
}

export function considerJudgeBribe(justice,record){
  const city=justice.city,trial=record.trial;if(record.type==='judgeBribery'||!trial||trial.status!=='hearing-scheduled'||trial.judgeBribe||city.minute>=trial.hearingAt||city.minute-(trial.lastBribeConsideredAt??-Infinity)<60)return;
  trial.lastBribeConsideredAt=city.minute;
  const payer=city.society.citizen(record.chargedCitizenId),judge=city.society.citizen(trial.judgeId);
  if(!payer||!judge||payer===judge||payer.entity.destroyed||judge.entity.destroyed||payer.custody||judge.custody||
    (payer.traits?.honesty??.5)>.12||(payer.traits?.riskTolerance??.5)<.72||city.random()>.001) return;
  const balance=city.accounts?.get(payer.accountId)?.balance||0,amount=Math.floor(Math.min(city.currency?.price(10000)??10000,balance*.1));
  if(amount>0)offerJudgeBribe(justice,record,payer,amount);
}
