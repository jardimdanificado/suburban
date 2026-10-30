const leads=record=>new Set([...(record.witnesses||[]).filter(w=>w.confidence>=.7).map(w=>w.identifiedSuspectId),...(record.evidence||[]).filter(e=>e.confidence>=.7).map(e=>e.implicatedCitizenId)].filter(Number.isInteger));

export function dispatchPoliceAudits(justice){
  const city=justice.city,hour=Math.floor(city.minute/60);if(justice.lastAuditAssignmentHour===hour)return;justice.lastAuditAssignmentHour=hour;
  const activeInvestigators=new Set(justice.cases.filter(r=>r.status==='investigating').map(r=>r.investigation?.officerId));
  for(const source of justice.cases){
    const investigation=source.investigation;if(source.status!=='no-suspect'||!investigation||investigation.finishedAt==null||!leads(source).size)continue;
    const audit=investigation.financialAudit??={status:'waiting',progress:0,required:90,createdAt:city.minute,caseIds:[]};
    if(['completed','inconclusive'].includes(audit.status))continue;
    const previous=city.society.citizen(audit.officerId);if(audit.status==='active'&&previous&&!previous.entity.destroyed&&previous.policeAudit?.caseId===source.id)continue;
    audit.status='waiting';let assignment;
    for(const station of justice.activeBuildings('police_station')){
      const witnessIds=new Set((source.witnesses||[]).map(w=>w.citizenId));
      const officer=(station.workers||[]).map(id=>city.society.citizen(id)).find(c=>c&&c.id!==investigation.officerId&&!leads(source).has(c.id)&&!witnessIds.has(c.id)&&!activeInvestigators.has(c.id)&&!c.entity.destroyed&&!c.custody&&!c.workMeal&&!c.conversation&&!c.mobilityTrip&&c.jobId===station.id&&c.task==='work'&&c.indoorLocation?.buildingId===station.id&&!c.indoorLocation.path?.length&&!c.path.length&&!c.policeAudit&&!c.policeInvestigation&&!c.policePatrol&&!c.policeResponse&&!c.policeRestitution&&!c.custodyEscort&&!city.urgentNeed?.(c));
      if(officer){assignment={station,officer};break;}
    }
    if(!assignment){audit.waitingReason='aguardando auditor disponível que não esteja envolvido no inquérito';continue;}
    const {station,officer}=assignment;audit.status='active';audit.officerId=officer.id;audit.stationId=station.id;audit.startedAt??=city.minute;audit.waitingReason=null;officer.policeAudit={caseId:source.id};officer.action=`Auditando registros financeiros do inquérito #${source.id}`;
  }
}

export function updatePoliceAudit(justice,officer){
  const city=justice.city,source=justice.cases.find(r=>r.id===officer.policeAudit?.caseId),investigation=source?.investigation,audit=investigation?.financialAudit,station=city.building(audit?.stationId);
  if(!audit||audit.status!=='active'){officer.policeAudit=null;return false;}
  if(officer.entity.destroyed||officer.custody||officer.workMeal||officer.conversation||!station?.active||officer.jobId!==station.id||officer.task!=='work'||officer.indoorLocation?.buildingId!==station.id||officer.indoorLocation.path?.length||officer.path.length||city.urgentNeed?.(officer)||(officer.unconsciousUntil||0)>city.minute){audit.status='waiting';audit.waitingReason='auditoria interrompida: agente precisa estar disponível na delegacia';officer.policeAudit=null;return false;}
  if(audit.lastWorkedMinute===city.minute)return true;audit.lastWorkedMinute=city.minute;
  if(!city.payWage(officer,station)){audit.waitingReason='aguardando verba salarial';return false;}
  audit.waitingReason=null;audit.progress++;if(audit.progress<audit.required)return true;
  const involved=leads(source),target=city.society.citizen(investigation.officerId),from=investigation.startedAt??source.occurredAt??0,to=investigation.finishedAt;
  const witnessPairs=(source.witnesses||[]).filter(w=>involved.has(w.identifiedSuspectId)).map(w=>({payer:city.society.citizen(w.identifiedSuspectId),witness:city.society.citizen(w.citizenId)})).filter(pair=>pair.payer&&pair.witness&&pair.payer!==pair.witness);
  const relatedBodies=justice.bodies.filter(body=>(body.criminalCaseId===source.id||body.circumstances?.caseId===source.id)&&body.autopsy?.examinerId!=null&&body.autopsy.completedAt>=(source.occurredAt??from));
  const forensicPairs=relatedBodies.flatMap(body=>[...involved].map(id=>({payer:city.society.citizen(id),examiner:city.society.citizen(body.autopsy.examinerId),body})).filter(pair=>pair.payer&&pair.examiner&&pair.payer!==pair.examiner));
  const matchesForensicPayment=(pair,e)=>e.from===pair.payer.accountId&&e.to===pair.examiner.accountId&&e.minute>=(pair.body.autopsyStartedAt??Math.max(0,pair.body.autopsy.completedAt-1440))&&e.minute<=pair.body.autopsy.completedAt;
  const documents=(city.history?.entries||[]).filter(e=>{
    if(e.kind!=='finance'||e.amount<=0)return false;
    const duringInvestigation=e.minute>=from&&e.minute<=to;
    const investigatorPayment=duringInvestigation&&e.to===target?.accountId&&[...involved].some(id=>city.society.citizen(id)?.accountId===e.from);
    const witnessPayment=duringInvestigation&&witnessPairs.some(pair=>pair.payer.accountId===e.from&&pair.witness.accountId===e.to);
    const forensicPayment=forensicPairs.some(pair=>matchesForensicPayment(pair,e));
    return investigatorPayment||witnessPayment||forensicPayment;
  });
  const chance=Math.min(.95,.25+(officer.skills?.investigation||0)/200+(officer.traits?.honesty??.5)*.2),found=documents.length&&city.random()<chance;
  audit.completedAt=city.minute;audit.status=found?'completed':'inconclusive';audit.documentCount=found?documents.length:0;officer.policeAudit=null;officer.action='Concluiu a auditoria financeira';
  if(!found)return true;
  audit.findings=documents.map(e=>({eventId:e.id,from:e.from,to:e.to,amount:e.amount,minute:e.minute,reason:e.reason,kind:witnessPairs.some(pair=>pair.payer.accountId===e.from&&pair.witness.accountId===e.to)?'witness-bribery':forensicPairs.some(pair=>matchesForensicPayment(pair,e))?'forensic-bribery':'investigator-payment'}));
  for(const document of documents){
    const witnessPair=witnessPairs.find(pair=>pair.payer.accountId===document.from&&pair.witness.accountId===document.to),forensicPair=forensicPairs.find(pair=>matchesForensicPayment(pair,document)),payer=witnessPair?.payer||forensicPair?.payer||city.citizens.find(c=>c.accountId===document.from),recipient=witnessPair?.witness||forensicPair?.examiner||target,type=witnessPair?'witnessBribery':forensicPair?'forensicBribery':'policeBribery';if(!payer||!recipient)continue;
    for(const accused of [payer,recipient]){
      const role=accused===recipient?'recipient':'payer';let complaint=justice.cases.find(r=>r.type===type&&r.details?.sourceCaseId===source.id&&r.details.paymentEventId===document.id&&r.details.role===role);
      complaint??=justice.crimeRecord(type,accused.id,accused===recipient?payer.id:recipient.id,{sourceCaseId:source.id,payerId:payer.id,witnessId:witnessPair?.witness.id??null,examinerId:forensicPair?.examiner.id??null,bodyId:forensicPair?.body.id??null,officerId:type==='policeBribery'?recipient.id:null,investigatorUnderReviewId:type==='policeBribery'?recipient.id:null,role,amount:document.amount,paymentEventId:document.id,source:'financial-audit',position:null},{observe:false});
      if(!complaint)continue;
      if(!complaint.evidence.some(e=>e.kind==='financial-record'&&e.eventId===document.id))complaint.evidence.push({kind:'financial-record',eventId:document.id,recordedAt:city.minute,implicatedCitizenId:accused.id,confidence:.75,from:document.from,to:document.to,amount:document.amount,transactionMinute:document.minute,auditedBy:officer.id,sourceCaseId:source.id});
      if(['unreported','reporting','no-suspect'].includes(complaint.status)){complaint.status='reported';complaint.reportedAt=city.minute;complaint.reportSource='financial-audit';if(complaint.investigation?.status==='inconclusive'){complaint.pastInvestigations??=[];complaint.pastInvestigations.push(complaint.investigation);complaint.investigation=null;}}
      complaint.position=null;complaint.scene={buildingId:null,unitId:null,floor:null,height:0};if(!audit.caseIds.includes(complaint.id))audit.caseIds.push(complaint.id);
    }
  }
  city.log(`A auditoria policial do inquérito #${source.id} encontrou transferências entre pessoas citadas, testemunhas, perito do IML e/ou investigador. Os pagamentos serão apurados.`,'justice',[officer.id,target?.id].filter(Number.isInteger),{kind:'police-financial-audit-completed',caseId:source.id,documentEventIds:documents.map(e=>e.id),relatedEventIds:documents.map(e=>e.id),witnessBriberyFound:audit.findings.some(e=>e.kind==='witness-bribery'),forensicBriberyFound:audit.findings.some(e=>e.kind==='forensic-bribery')});return true;
}
