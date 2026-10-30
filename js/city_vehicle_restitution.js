const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const vehicleFor=(city,record)=>city.vehicles?.units.get(record.details?.vehicleId);

export function dispatchVehicleRestitution(justice){
  const city=justice.city;
  for(const record of justice.cases){
    if(record.type!=='bicycleTheft'||record.status!=='convicted'||record.vehicleRecoverySource==='owner')continue;
    const vehicle=vehicleFor(city,record),owner=city.society.citizen(record.victimId);
    const recovery=record.vehicleRecovery??={status:'awaiting-officer',vehicleId:record.details?.vehicleId,ownerId:record.victimId};
    if(recovery.status==='in-progress'){
      const previous=city.society.citizen(recovery.mission?.officerId);
      if(!previous||previous.entity.destroyed||previous.custody||previous.jobId!==recovery.mission.stationId){
        if(previous)pauseVehicleRestitution(justice,previous,'agente indisponível');
        if(vehicle?.policeRecoveryOfficerId===recovery.mission.officerId)vehicle.policeRecoveryOfficerId=null;
        recovery.mission.status='interrupted';recovery.status='awaiting-officer';if(previous)previous.policeRestitution=null;
      }
    }
    if(['returned','in-progress'].includes(recovery.status))continue;
    if(!vehicle?.active||vehicle.scrapped){recovery.waitingReason='veículo indisponível';continue;}
    if(!owner||owner.entity.destroyed||vehicle.ownerAccountId!==owner.accountId){recovery.waitingReason='proprietário legal indisponível ou alterado';continue;}
    if(vehicle.driverId||vehicle.mechanicId||vehicle.paintJobId||vehicle.serviceBodyId||vehicle.policeRecoveryOfficerId){recovery.waitingReason='veículo em uso ou reservado';continue;}
    let assignment;
    for(const station of justice.activeBuildings('police_station')){
      const officer=(station.workers||[]).map(id=>city.society.citizen(id)).find(c=>c&&!c.entity.destroyed&&c.jobId===station.id&&c.task==='work'&&c.indoorLocation?.buildingId===station.id&&!c.indoorLocation.path?.length&&!c.path.length&&!c.policeAudit&&!c.policePatrol&&!c.policeResponse&&!c.policeInvestigation&&!c.policeRestitution&&!c.custodyEscort&&!c.custody&&!c.funeralBodyId&&!c.deliveryId&&!city.urgentNeed?.(c));
      if(officer){assignment={station,officer};break;}
    }
    if(!assignment){recovery.waitingReason='aguardando policial disponível na delegacia';continue;}
    const {station,officer}=assignment;
    if(city.findPath(station.door,vehicle)===null){recovery.waitingReason='sem rota até o veículo';continue;}
    const mission={kind:'vehicle',caseId:record.id,stationId:station.id,officerId:officer.id,vehicleId:vehicle.id,ownerId:owner.id,phase:'to-vehicle',startedAt:city.minute,status:'in-progress'};
    recovery.status='in-progress';recovery.waitingReason=null;recovery.mission=mission;officer.policeRestitution=mission;officer.task='police-restitution';officer.path=[];officer.targetId=null;officer.action=`Indo recuperar o veículo do caso #${record.id}`;
    city.log(`A polícia iniciou a recuperação física do veículo do caso #${record.id}.`,'justice',[officer.id,owner.id],{kind:'vehicle-restitution-dispatched',caseId:record.id,vehicleId:vehicle.id,buildingId:station.id});
  }
}

export function pauseVehicleRestitution(justice,officer,reason){
  const mission=officer.policeRestitution;if(mission?.kind!=='vehicle')return;
  const city=justice.city,record=justice.cases.find(r=>r.id===mission.caseId),vehicle=city.vehicles?.units.get(mission.vehicleId);
  if(vehicle?.policeRecoveryOfficerId===officer.id){vehicle.policeRecoveryOfficerId=null;vehicle.status='Recuperação policial interrompida';mission.phase='to-vehicle';}
  mission.waitingReason=reason;if(record?.vehicleRecovery)record.vehicleRecovery.waitingReason=reason;
}

export function updateVehicleRestitution(justice,officer){
  const city=justice.city,mission=officer.policeRestitution,record=justice.cases.find(r=>r.id===mission?.caseId),recovery=record?.vehicleRecovery,vehicle=city.vehicles?.units.get(mission?.vehicleId),station=city.building(mission?.stationId),owner=city.society.citizen(mission?.ownerId);
  if(!mission||!recovery)return false;
  if(!station||!station.active||station.entity.destroyed||officer.entity.destroyed||officer.jobId!==station.id||officer.custody){pauseVehicleRestitution(justice,officer,'agente ou delegacia indisponível');recovery.status='awaiting-officer';officer.policeRestitution=null;officer.task=null;officer.targetId=null;officer.path=[];return false;}
  if(city.urgentNeed?.(officer)){pauseVehicleRestitution(justice,officer,'necessidade urgente do agente');return false;}
  if(mission.lastPaidMinute!==city.minute){mission.lastPaidMinute=city.minute;if(!city.payWage(officer,station)){pauseVehicleRestitution(justice,officer,'aguardando verba salarial');mission.payBlockedMinute=city.minute;officer.path=[];return false;}}
  if(mission.payBlockedMinute===city.minute)return false;
  officer.task='police-restitution';mission.waitingReason=null;recovery.waitingReason=null;
  if(officer.indoorLocation){if(officer.indoorLocation.path?.length)return true;return justice.leaveRestitutionInterior(officer,city.building(officer.indoorLocation.buildingId),mission);}
  if(officer.path.length)return true;
  if(mission.phase==='return'){
    if(distance(officer.entity,station.door)>1.2)return route(city,officer,station.door,recovery,mission,'sem rota de retorno à delegacia');
    mission.status='completed';mission.returnedAt=city.minute;officer.policeRestitution=null;officer.task='work';officer.targetId=station.id;officer.action='Retornou após devolver o veículo';return true;
  }
  if(!vehicle?.active||vehicle.scrapped||!owner||owner.entity.destroyed||vehicle.ownerAccountId!==owner.accountId){pauseVehicleRestitution(justice,officer,'veículo ou proprietário indisponível');recovery.status='awaiting-officer';mission.status='interrupted';mission.phase='return';return false;}
  if(mission.phase==='to-vehicle'){
    if(vehicle.driverId||vehicle.mechanicId||vehicle.paintJobId||vehicle.serviceBodyId||vehicle.policeRecoveryOfficerId&&vehicle.policeRecoveryOfficerId!==officer.id){recovery.waitingReason=mission.waitingReason='veículo em uso ou reservado';return false;}
    if(distance(officer.entity,vehicle)>1.2)return route(city,officer,vehicle,recovery,mission,'sem rota até o veículo');
    vehicle.policeRecoveryOfficerId=officer.id;vehicle.policeRecoveryOffset={x:vehicle.x-officer.entity.x,y:vehicle.y-officer.entity.y};vehicle.possessorAccountId=null;vehicle.theft=null;city.vehicles.freeParking?.(vehicle);vehicle.status='Sendo levado pela polícia';mission.phase='to-owner';recovery.seizedAt=city.minute;
    city.log(`O agente recolheu o veículo do caso #${record.id}.`,'justice',[officer.id,owner.id],{kind:'vehicle-seized-for-return',caseId:record.id,vehicleId:vehicle.id,position:{x:vehicle.x,y:vehicle.y}});return true;
  }
  const building=owner.indoorLocation&&city.building(owner.indoorLocation.buildingId),destination=building?.door||owner.entity;
  if(distance(officer.entity,destination)>1.2)return route(city,officer,destination,recovery,mission,'sem rota até o proprietário');
  // The vehicle followed the officer's physical movement; delivery never relocates it.
  if(distance(vehicle,destination)>2.5){recovery.waitingReason=mission.waitingReason='aguardando chegada física do veículo';return false;}
  vehicle.policeRecoveryOfficerId=null;vehicle.status='Devolvido ao proprietário';vehicle.possessionHistory??=[];vehicle.possessionHistory.push({minute:city.minute,accountId:owner.accountId,reason:'Restituição policial presencial',caseId:record.id});
  recovery.status='returned';recovery.returnedAt=city.minute;record.vehicleRecoveredAt=city.minute;record.vehicleRecoverySource='police-delivery';mission.phase='return';
  city.log(`A polícia devolveu o veículo do caso #${record.id} ao proprietário${building?' na entrada do prédio':''}.`,'justice',[officer.id,owner.id],{kind:'vehicle-restitution-delivered',caseId:record.id,vehicleId:vehicle.id,position:{x:vehicle.x,y:vehicle.y}});return true;
}

function route(city,officer,goal,recovery,mission,reason){
  const path=city.findPath(officer.entity,goal);if(path===null){recovery.waitingReason=mission.waitingReason=reason;return false;}officer.path=path;return true;
}
