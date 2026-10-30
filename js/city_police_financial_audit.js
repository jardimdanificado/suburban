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
      const officer=(station.workers||[]).map(id=>city.society.citizen(id)).find(c=>c&&c.id!==investigation.officerId&&!leads(source).has(c.id)&&!activeInvestigators.has(c.id)&&!c.entity.destroyed&&!c.custody&&!c.workMeal&&!c.conversation&&!c.mobilityTrip&&c.jobId===station.id&&c.task==='work'&&c.indoorLocation?.buildingId===station.id&&!c.indoorLocation.path?.length&&!c.path.length&&!c.policeAudit&&!c.policeInvestigation&&!c.policePatrol&&!c.policeResponse&&!c.policeRestitution&&!c.custodyEscort&&!city.urgentNeed?.(c));
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
  const documents=(city.history?.entries||[]).filter(e=>e.kind==='finance'&&e.to===target?.accountId&&e.amount>0&&e.minute>=from&&e.minute<=to&&[...involved].some(id=>city.society.citizen(id)?.accountId===e.from));
  const chance=Math.min(.95,.25+(officer.skills?.investigation||0)/200+(officer.traits?.honesty??.5)*.2),found=documents.length&&city.random()<chance;
  audit.completedAt=city.minute;audit.status=found?'completed':'inconclusive';audit.documentCount=found?documents.length:0;officer.policeAudit=null;officer.action='Concluiu a auditoria financeira';
  if(!found)return true;
  audit.findings=documents.map(e=>({eventId:e.id,from:e.from,to:e.to,amount:e.amount,minute:e.minute,reason:e.reason}));
  for(const document of documents){
    const payer=city.citizens.find(c=>c.accountId===document.from);if(!payer||!target)continue;
    for(const accused of [payer,target]){
      let complaint=justice.cases.find(r=>r.type==='policeBribery'&&r.details?.sourceCaseId===source.id&&r.details.paymentEventId===document.id&&r.details.role===(accused===target?'recipient':'payer'));
      complaint??=justice.crimeRecord('policeBribery',null,null,{sourceCaseId:source.id,payerId:payer.id,officerId:target.id,investigatorUnderReviewId:target.id,role:accused===target?'recipient':'payer',amount:document.amount,paymentEventId:document.id,source:'financial-audit'},{observe:false});
      if(!complaint)continue;
      if(!complaint.evidence.some(e=>e.kind==='financial-record'&&e.eventId===document.id))complaint.evidence.push({kind:'financial-record',eventId:document.id,recordedAt:city.minute,implicatedCitizenId:accused.id,confidence:.75,from:document.from,to:document.to,amount:document.amount,transactionMinute:document.minute,auditedBy:officer.id,sourceCaseId:source.id});
      if(['unreported','reporting','no-suspect'].includes(complaint.status)){complaint.status='reported';complaint.reportedAt=city.minute;complaint.reportSource='financial-audit';if(complaint.investigation?.status==='inconclusive'){complaint.pastInvestigations??=[];complaint.pastInvestigations.push(complaint.investigation);complaint.investigation=null;}}
      complaint.position=null;if(!audit.caseIds.includes(complaint.id))audit.caseIds.push(complaint.id);
    }
  }
  city.log(`A auditoria do inquérito #${source.id} encontrou transferências entre pessoa citada e investigador. Os pagamentos serão apurados.`,'justice',[officer.id,target?.id].filter(Number.isInteger),{kind:'police-financial-audit-completed',caseId:source.id,documentEventIds:documents.map(e=>e.id),relatedEventIds:documents.map(e=>e.id)});return true;
}
