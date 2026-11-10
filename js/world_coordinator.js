import {INTERCITY_BOAT_CLASSES} from './boat_types.js?v=local-sea-travel-2';

/** Coordinates city sessions and world-level transfers. City state stays local to its worker. */
export class WorldCoordinator {
  constructor({ minute = 0, paused = false, speed = 1, onChange = () => {}, transferHandlers = {} } = {}) {
    if (!Number.isFinite(minute) || minute < 0) throw new RangeError('Horário global inválido.');
    this.minute = minute;
    this.paused = !!paused;
    this.speed = Number.isFinite(speed) && speed > 0 ? speed : 1;
    this.cities = new Map();
    this.activeCityId = null;
    this.transfers = new Map();
    this.contracts = new Map();
    this.migrationPolicies=new Map();
    this.regionalTradeDay=null;
    this.autonomousMigrationDay=null;
    this.summaries=new Map();
    this.ports = new Map();
    this.routes = new Map();
    this.vessels = new Map();
    this.transferHandlers = transferHandlers;
    this.processingTransfers=Promise.resolve();
    this.onChange = onChange;
  }

  registerCity(cityId, session) {
    if (typeof cityId !== 'string' || !cityId.trim()) throw new TypeError('A cidade precisa de um identificador estável.');
    if (!session?.city || !session?.bridge) throw new TypeError('A sessão precisa conter cidade e bridge de simulação.');
    if (this.cities.has(cityId)) throw new Error(`Cidade já registrada: ${cityId}`);
    if(Number.isFinite(session.city.minute)&&session.city.minute<this.minute)throw new Error('A nova sessão precisa começar no minuto global atual ou depois dele.');
    const time = session.time || { paused: this.paused, speed: this.speed, tick: 0, elapsed: 0 };
    time.paused = this.paused;
    time.speed = this.speed;
    const record = { ...session, id: cityId, city: session.city, bridge: session.bridge, time, metadata: session.metadata || {} };
    const identities=new Set([...this.cities.values()].flatMap(city=>city.city.citizens||[]).map(person=>person.globalId).filter(Boolean));
    for(const person of record.city.citizens||[]){person.globalId??=`${cityId}:${person.id}`;if(identities.has(person.globalId))throw new Error(`Identidade global de cidadão duplicada: ${person.globalId}`);identities.add(person.globalId);}
    record.bridge.time = time;
    this.cities.set(cityId, record);
    record.reportedMinute = Number.isFinite(session.city.minute) ? session.city.minute : this.minute;
    const location=session.city.worldPort?.door||session.metadata?.port||session.world?.spawnCenter||{x:0,y:0};
    this.registerPort({id:`${cityId}:port`,cityId,x:location.x,y:location.y});
    if (this.activeCityId === null) this.activeCityId = cityId;
    record.bridge.setObserved?.(this.activeCityId===cityId);
    record.bridge.control?.();
    this.onChange({ type: 'city-added', cityId });
    return record;
  }

  unregisterCity(cityId) {
    const record = this.cities.get(cityId);
    if (!record) return false;
    if ([...this.transfers.values()].some(t => !['delivered','cancelled'].includes(t.status) && (t.originCityId === cityId || t.destinationCityId === cityId))) {
      throw new Error('Não é possível remover uma cidade com transferências pendentes.');
    }
    record.bridge.worker?.terminate();
    record.bridge.active = false;
    this.cities.delete(cityId);
    this.summaries.delete(cityId);
    if (this.activeCityId === cityId) {this.activeCityId = this.cities.keys().next().value ?? null;for(const session of this.cities.values())session.bridge.setObserved?.(session.id===this.activeCityId);}
    this.reconcileMinute();
    this.onChange({ type: 'city-removed', cityId });
    return true;
  }

  selectCity(cityId) {
    if (!this.cities.has(cityId)) throw new Error(`Cidade desconhecida: ${cityId}`);
    this.activeCityId = cityId;
    for(const session of this.cities.values())session.bridge.setObserved?.(session.id===cityId);
    this.onChange({ type: 'city-selected', cityId });
    return this.cities.get(cityId);
  }

  updateCitySummary(cityId,summary){
    if(!this.cities.has(cityId)||!summary||!Number.isFinite(summary.minute)||summary.minute<this.minute||!Number.isSafeInteger(summary.population)||summary.population<0)return false;
    const previous=this.summaries.get(cityId);if(previous&&summary.minute<previous.minute)return false;
    const stored=structuredClone(summary);this.summaries.set(cityId,stored);this.onChange({type:'city-summary-changed',cityId,summary:stored});return true;
  }

  resolveCitizen(globalId){
    if(typeof globalId!=='string'||!globalId)return null;
    for(const session of this.cities.values()){
      const citizen=session.city.citizens?.find(person=>person.globalId===globalId&&!person.dead&&!person.entity?.destroyed);
      if(citizen)return {globalId,cityId:session.id,citizenId:citizen.id,name:citizen.entity?.properties?.name||citizen.name||`Cidadão ${citizen.id}`,age:session.city.society?.age?.(citizen)??null,citizen};
    }
    return null;
  }

  resolveCitizenLinks(citizen){
    const links=citizen?.worldLinks;if(!links)return {parents:[],guardian:null,partner:null,children:[],relationships:[]};
    const resolve=globalId=>globalId?this.resolveCitizen(globalId):null;
    return {
      parents:(links.parentGlobalIds||[]).map(globalId=>resolve(globalId)||{globalId,unresolved:true}),
      guardian:links.guardianGlobalId?resolve(links.guardianGlobalId)||{globalId:links.guardianGlobalId,unresolved:true}:null,
      partner:links.partnerGlobalId?resolve(links.partnerGlobalId)||{globalId:links.partnerGlobalId,unresolved:true}:null,
      children:(links.childGlobalIds||[]).map(globalId=>resolve(globalId)||{globalId,unresolved:true}),
      relationships:(links.relationships||[]).map(link=>({...link,...(resolve(link.globalId)||{unresolved:true})})),
    };
  }

  setTime({ paused = this.paused, speed = this.speed } = {}) {
    if (!Number.isFinite(speed) || speed <= 0) throw new RangeError('A velocidade precisa ser positiva.');
    this.paused = !!paused;
    this.speed = speed;
    for (const session of this.cities.values()) {
      session.time.paused = this.paused;
      session.time.speed = this.speed;
      session.bridge.control?.();
    }
    this.onChange({ type: 'time-changed', minute: this.minute, paused: this.paused, speed: this.speed });
  }

  reset({minute=0,clearTransfers=true}={}) {
    if(this.cities.size)throw new Error('Remova todas as sessões antes de reiniciar o mundo.');
    if(!Number.isFinite(minute)||minute<0)throw new RangeError('Horário global inválido.');
    this.minute=minute;this.activeCityId=null;
    if(clearTransfers)this.transfers.clear();
    this.contracts.clear();
    this.migrationPolicies.clear();
    this.regionalTradeDay=null;
    this.autonomousMigrationDay=null;
    this.summaries.clear();
    this.ports.clear();this.routes.clear();this.vessels.clear();
    this.onChange({type:'world-reset',minute});
  }

  reportCityMinute(cityId, minute) {
    const session=this.cities.get(cityId);
    if(!session||!Number.isFinite(minute)||minute<session.reportedMinute)return this.minute;
    session.reportedMinute=minute;
    return this.reconcileMinute();
  }

  reconcileMinute() {
    if(!this.cities.size)return this.minute;
    const synchronizedMinute=Math.min(...[...this.cities.values()].map(session=>session.reportedMinute));
    if(synchronizedMinute>this.minute){
      this.minute=synchronizedMinute;
      this.queueTransferProcessing(this.minute);
      this.onChange({type:'world-minute',minute:this.minute});
    }
    return this.minute;
  }

  scheduleTransfer({ id, kind, originCityId, destinationCityId, payload, departureMinute, arrivalMinute, status = 'scheduled' }) {
    if (typeof id !== 'string' || !id.trim()) throw new TypeError('A transferência precisa de um identificador único.');
    if (this.transfers.has(id)) throw new Error(`Transferência já registrada: ${id}`);
    if (!['goods', 'citizen'].includes(kind)) throw new TypeError(`Tipo de transferência inválido: ${kind}`);
    if (originCityId === destinationCityId || !this.cities.has(originCityId) || !this.cities.has(destinationCityId)) throw new Error('Origem e destino precisam ser cidades diferentes já registradas.');
    if (!Number.isSafeInteger(departureMinute) || !Number.isSafeInteger(arrivalMinute) || departureMinute < this.minute || arrivalMinute <= departureMinute) throw new RangeError('Horários de viagem inválidos.');
    if(status!=='scheduled')throw new TypeError('Uma nova transferência precisa começar programada.');
    if (!payload || typeof payload !== 'object') throw new TypeError('A transferência precisa de um manifesto.');
    const transfer = { id, kind, originCityId, destinationCityId, payload: structuredClone(payload), departureMinute, arrivalMinute, status, createdAt: this.minute, departedAt: null, deliveredAt: null };
    this.transfers.set(id, transfer);
    this.onChange({ type: 'transfer-scheduled', transfer: structuredClone(transfer) });
    if(departureMinute<=this.minute)this.queueTransferProcessing(this.minute);
    return transfer;
  }

  registerPort({id,cityId,x,y}) {
    if(typeof id!=='string'||!id||!this.cities.has(cityId)||!Number.isFinite(x)||!Number.isFinite(y))throw new TypeError('Porto precisa de cidade e coordenadas válidas.');
    if(this.ports.has(id))throw new Error(`Porto já registrado: ${id}`);
    const port={id,cityId,x,y};this.ports.set(id,port);this.onChange({type:'port-added',port:structuredClone(port)});return port;
  }

  connectPorts({id,originPortId,destinationPortId,travelMinutes=180,capacity=100,freightPerUnit=0}) {
    if(typeof id!=='string'||!id||this.routes.has(id))throw new Error('Identificador de rota inválido ou duplicado.');
    const origin=this.ports.get(originPortId),destination=this.ports.get(destinationPortId);
    if(!origin||!destination||origin.cityId===destination.cityId)throw new Error('A rota precisa ligar portos de cidades diferentes.');
    if(!Number.isSafeInteger(travelMinutes)||travelMinutes<1||!Number.isSafeInteger(capacity)||capacity<1||!Number.isSafeInteger(freightPerUnit)||freightPerUnit<0)throw new RangeError('Duração, capacidade e frete da rota precisam ser valores inteiros não negativos.');
    const route={id,originPortId,destinationPortId,originCityId:origin.cityId,destinationCityId:destination.cityId,travelMinutes,capacity,freightPerUnit};
    this.routes.set(id,route);this.onChange({type:'route-added',route:structuredClone(route)});return route;
  }

  ensureRouteFleet(routeId){
    const route=this.routes.get(routeId);if(!route)return false;
    for(const[classId,spec]of Object.entries(INTERCITY_BOAT_CLASSES)){
      const id=`vessel:${routeId}:${classId}`;if(!this.vessels.has(id))this.addVessel({id,classId,capacity:spec.capacity,routeId,currentPortId:route.originPortId});
    }
    const legacy=this.vessels.get(`ferry:${routeId}`);if(legacy){legacy.classId??='cargo';legacy.routeId??=routeId;legacy.currentPortId??=route.originPortId;}
    return true;
  }

  addVessel({id,capacity,classId=null,routeId=null,currentPortId=null,operatorType='municipal',ownerAccountId=null,ownerName=null,localVehicleId=null,homeCityId=null}) {
    if(typeof id!=='string'||!id||this.vessels.has(id))throw new Error('Identificador de embarcação inválido ou duplicado.');
    classId=classId&&INTERCITY_BOAT_CLASSES[classId]?classId:Object.entries(INTERCITY_BOAT_CLASSES).sort((a,b)=>a[1].capacity-b[1].capacity).find(([,spec])=>spec.capacity>=capacity)?.[0]||'cargo';
    capacity??=INTERCITY_BOAT_CLASSES[classId].capacity;
    if(!Number.isSafeInteger(capacity)||capacity<1)throw new RangeError('A capacidade da embarcação precisa ser positiva.');
    const vessel={id,classId,capacity,status:'idle',transferId:null,routeId,currentPortId,operatorType,ownerAccountId,ownerName,localVehicleId,homeCityId};this.vessels.set(id,vessel);this.onChange({type:'vessel-added',vessel:structuredClone(vessel)});return vessel;
  }

  availableVessel(routeId,quantity,{municipalOnly=false}={}){
    const route=this.routes.get(routeId);if(!route)return null;
    const priority={carrier:0,freelance:1,municipal:2};
    return [...this.vessels.values()].filter(item=>{
      const returningForLoad=item.operatorType!=='municipal'&&item.status==='returning'&&item.returnMinute>this.minute+1&&item.currentPortId===route.originPortId&&item.homeCityId===route.destinationCityId&&this.routes.get(item.routeId)?.destinationPortId===route.originPortId;
      const idleAtOrigin=item.status==='idle'&&(!item.routeId||item.routeId===routeId)&&(!item.currentPortId||item.currentPortId===route.originPortId);
      return (idleAtOrigin||returningForLoad)&&item.capacity>=quantity&&(!municipalOnly||item.operatorType==='municipal');
    }).sort((a,b)=>(priority[a.operatorType]??2)-(priority[b.operatorType]??2)||a.capacity-b.capacity)[0]||null;
  }

  scheduleVoyage({id,routeId,manifest,departureMinute=this.minute,vesselId=null}) {
    const route=this.routes.get(routeId);if(!route)throw new Error('Rota marítima desconhecida.');
    if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))throw new TypeError('Manifesto marítimo inválido.');
    const quantity=manifest.kind==='citizen'?(manifest.package?.version===2?manifest.package.members?.reduce((n,member)=>n+1+(member.vehicleAssets?.length||0),0):1+(manifest.package?.vehicleAssets?.length||0)):manifest.quantity;
    if(!Number.isSafeInteger(quantity)||quantity<1||quantity>route.capacity)throw new RangeError('A carga excede a capacidade da rota.');
    const vessel=vesselId?this.vessels.get(vesselId):this.availableVessel(routeId,quantity);
    if(vessel&&(vessel.capacity<quantity||vessel.status!=='idle'&&vessel.status!=='returning'||vessel.currentPortId&&vessel.currentPortId!==route.originPortId))throw new Error('A embarcação escolhida não está disponível neste porto.');
    if(!vessel)throw new Error('Não há embarcação livre com capacidade suficiente para esta rota.');
    const transfer=this.scheduleTransfer({id,kind:manifest.kind==='citizen'?'citizen':'goods',originCityId:route.originCityId,destinationCityId:route.destinationCityId,payload:manifest,departureMinute,arrivalMinute:departureMinute+route.travelMinutes,routeId,vesselId:vessel.id});
    transfer.routeId=route.id;transfer.vesselId=vessel.id;vessel.status='reserved';vessel.transferId=id;vessel.routeId=route.id;vessel.currentPortId=route.originPortId;vessel.returnMinute=null;
    this.onChange({type:'voyage-scheduled',transfer:structuredClone(transfer),vessel:structuredClone(vessel)});return transfer;
  }

  cancelTransfer(id) {
    const transfer=this.transfers.get(id);if(!transfer||!['scheduled','cancelling'].includes(transfer.status))return false;
    transfer.status='cancelled';transfer.cancelledAt=this.minute;
    const vessel=this.vessels.get(transfer.vesselId);if(vessel?.transferId===id){vessel.status='idle';vessel.transferId=null;vessel.currentPortId=this.routes.get(transfer.routeId)?.originPortId||vessel.currentPortId;}
    this.onChange({type:'transfer-cancelled',transfer:structuredClone(transfer)});return true;
  }

  beginCancelTransfer(id){const transfer=this.transfers.get(id);if(!transfer||transfer.status!=='scheduled')return false;transfer.status='cancelling';this.onChange({type:'transfer-cancelling',transfer:structuredClone(transfer)});return true;}
  abortCancelTransfer(id){const transfer=this.transfers.get(id);if(!transfer||transfer.status!=='cancelling')return false;transfer.status='scheduled';this.onChange({type:'transfer-cancel-retry',transfer:structuredClone(transfer)});this.queueTransferProcessing(this.minute);return true;}

  queueTransferProcessing(minute=this.minute){
    this.processingTransfers=this.processingTransfers.then(()=>this.advanceTo(minute,this.transferHandlers)).catch(error=>{this.onChange({type:'transfer-processing-error',message:error.message,minute});});
    return this.processingTransfers;
  }

  flushTransfers(){return this.queueTransferProcessing(this.minute);}

  async advanceTo(minute, handlers = this.transferHandlers) {
    if (!Number.isFinite(minute) || minute < this.minute) throw new RangeError('O relógio do mundo não pode voltar no tempo.');
    const {depart,deliver}=handlers||{};
    for(const vessel of this.vessels.values())if(vessel.status==='returning'&&Number.isFinite(vessel.returnMinute)&&vessel.returnMinute<=minute){const route=this.routes.get(vessel.routeId);vessel.status='idle';vessel.currentPortId=route?.originPortId||vessel.currentPortId;vessel.returnMinute=null;if(vessel.operatorType!=='municipal')vessel.routeId=null;this.onChange({type:'vessel-returned',vessel:structuredClone(vessel)});}
    const due = [...this.transfers.values()].sort((a, b) => a.departureMinute - b.departureMinute || a.arrivalMinute - b.arrivalMinute || a.id.localeCompare(b.id));
    for (const transfer of due) {
      if(transfer.status==='cancelling'&&typeof handlers?.cancel==='function'){
        try{await handlers.cancel(structuredClone(transfer));this.cancelTransfer(transfer.id);}catch(error){this.onChange({type:'transfer-processing-error',transferId:transfer.id,phase:'cancel',message:error.message});}
        continue;
      }
      if (transfer.status === 'scheduled' && transfer.departureMinute <= minute && typeof depart==='function') {
        transfer.status='departing';this.onChange({type:'transfer-departing',transfer:structuredClone(transfer)});
        try{await depart(structuredClone(transfer));}catch(error){transfer.status='scheduled';this.onChange({type:'transfer-processing-error',transferId:transfer.id,phase:'depart',message:error.message});continue;}
        transfer.status = 'in-transit';transfer.departedAt = transfer.departureMinute;
        const vessel=this.vessels.get(transfer.vesselId);if(vessel?.transferId===transfer.id)vessel.status='at-sea';
        this.onChange({ type: 'transfer-departed', transfer: structuredClone(transfer) });
      }
      if (transfer.status === 'in-transit' && transfer.arrivalMinute <= minute && typeof deliver==='function') {
        transfer.status='arriving';this.onChange({type:'transfer-arriving',transfer:structuredClone(transfer)});
        try{await deliver(structuredClone(transfer));}catch(error){transfer.status='in-transit';this.onChange({type:'transfer-processing-error',transferId:transfer.id,phase:'deliver',message:error.message});continue;}
        transfer.status = 'delivered';
        transfer.deliveredAt = transfer.arrivalMinute;
        const vessel=this.vessels.get(transfer.vesselId);if(vessel?.transferId===transfer.id){const route=this.routes.get(transfer.routeId),homecoming=vessel.operatorType!=='municipal'&&vessel.homeCityId===route?.destinationCityId,returnMinute=transfer.arrivalMinute+(route?.travelMinutes||0),alreadyReturned=returnMinute<=minute||homecoming;vessel.status=alreadyReturned?'idle':'returning';vessel.currentPortId=alreadyReturned?route?.destinationPortId||vessel.currentPortId:route?.destinationPortId||vessel.currentPortId;vessel.returnMinute=alreadyReturned?null:returnMinute;vessel.transferId=null;vessel.routeId=alreadyReturned&&vessel.operatorType!=='municipal'?null:route?.id||vessel.routeId;}
        this.onChange({ type: 'transfer-delivered', transfer: structuredClone(transfer) });
      }
    }
    this.minute = minute;
    return this.minute;
  }

  snapshot() {
    return {
      version: 1,
      minute: this.minute,
      regionalTradeDay:this.regionalTradeDay,
      autonomousMigrationDay:this.autonomousMigrationDay,
      paused: this.paused,
      speed: this.speed,
      activeCityId: this.activeCityId,
      transfers: [...this.transfers.values()].map(transfer => structuredClone(transfer)),
      contracts:[...this.contracts.values()].map(contract=>structuredClone(contract)),
      migrationPolicies:[...this.migrationPolicies.values()].map(policy=>structuredClone(policy)),
      summaries:[...this.summaries.entries()].map(([cityId,summary])=>({cityId,summary:structuredClone(summary)})),
      cities: [...this.cities.values()].map(({ id, metadata, reportedMinute }) => ({ id, metadata: structuredClone(metadata), reportedMinute })),
      ports:[...this.ports.values()].map(port=>structuredClone(port)),
      routes:[...this.routes.values()].map(route=>structuredClone(route)),
      vessels:[...this.vessels.values()].map(vessel=>structuredClone(vessel)),
    };
  }

  restore(snapshot) {
    if (snapshot?.version !== 1 || !Number.isFinite(snapshot.minute) || !Array.isArray(snapshot.transfers) || !Array.isArray(snapshot.cities)) throw new TypeError('Salvamento do mundo incompatível.');
    for(const day of [snapshot.regionalTradeDay,snapshot.autonomousMigrationDay])if(day!=null&&(!Number.isSafeInteger(day)||day<0))throw new TypeError('Dia de decisão automática inválido no salvamento.');
    const knownCities = new Set(this.cities.keys());
    if (snapshot.cities.some(city => !knownCities.has(city.id))) throw new Error('Registre todas as cidades antes de restaurar o mundo.');
    const transfers = new Map();
    for (const transfer of snapshot.transfers) {
      if (!transfer?.id || transfers.has(transfer.id) || !knownCities.has(transfer.originCityId) || !knownCities.has(transfer.destinationCityId) || !['scheduled','cancelling','departing','in-transit','arriving','delivered','cancelled'].includes(transfer.status)) throw new TypeError('Registro de transferência inválido no salvamento.');
      const restored=structuredClone(transfer);if(restored.status==='departing')restored.status='scheduled';else if(restored.status==='arriving')restored.status='in-transit';transfers.set(transfer.id,restored);
    }
    const contracts=new Map();for(const contract of snapshot.contracts||[]){if(!contract?.id||contracts.has(contract.id)||!snapshot.routes?.some(route=>route.id===contract.routeId)||!Number.isSafeInteger(contract.quantity)||contract.quantity<1||!Number.isSafeInteger(contract.intervalMinutes)||contract.intervalMinutes<1||!Number.isSafeInteger(contract.nextDepartureMinute)||typeof contract.good!=='string'||!contract.good)throw new TypeError('Contrato comercial inválido no salvamento.');contracts.set(contract.id,structuredClone(contract));}
    const migrationPolicies=new Map();for(const policy of snapshot.migrationPolicies||[]){if(!policy?.id||migrationPolicies.has(policy.id)||!snapshot.routes?.some(route=>route.id===policy.routeId)||!Number.isSafeInteger(policy.intervalMinutes)||policy.intervalMinutes<1||!Number.isSafeInteger(policy.nextDepartureMinute)||!Number.isSafeInteger(policy.maxTransfers)||policy.maxTransfers<1||!Number.isSafeInteger(policy.transfersCreated)||policy.transfersCreated<0)throw new TypeError('Política de migração inválida no salvamento.');migrationPolicies.set(policy.id,structuredClone(policy));}
    const ports=new Map((snapshot.ports||[]).map(port=>[port.id,structuredClone(port)])),routes=new Map((snapshot.routes||[]).map(route=>[route.id,structuredClone(route)])),vessels=new Map((snapshot.vessels||[]).map(vessel=>[vessel.id,structuredClone(vessel)]));
    if(ports.size!==(snapshot.ports||[]).length||routes.size!==(snapshot.routes||[]).length||vessels.size!==(snapshot.vessels||[]).length||[...ports.values()].some(port=>!knownCities.has(port.cityId))||[...routes.values()].some(route=>!ports.has(route.originPortId)||!ports.has(route.destinationPortId))||[...vessels.values()].some(vessel=>!Number.isSafeInteger(vessel.capacity)||vessel.capacity<1||!['idle','reserved','at-sea','returning'].includes(vessel.status)||vessel.classId&&!INTERCITY_BOAT_CLASSES[vessel.classId]||vessel.routeId&&!routes.has(vessel.routeId)||vessel.currentPortId&&!ports.has(vessel.currentPortId)||vessel.returnMinute!=null&&!Number.isSafeInteger(vessel.returnMinute)))throw new TypeError('Rotas, portos ou embarcações inválidos no salvamento.');
    this.minute = snapshot.minute;
    this.regionalTradeDay=snapshot.regionalTradeDay??null;
    this.autonomousMigrationDay=snapshot.autonomousMigrationDay??null;
    this.paused = !!snapshot.paused;
    this.speed = Number.isFinite(snapshot.speed) && snapshot.speed > 0 ? snapshot.speed : 1;
    this.activeCityId = knownCities.has(snapshot.activeCityId) ? snapshot.activeCityId : this.cities.keys().next().value ?? null;
    for(const session of this.cities.values())session.bridge.setObserved?.(session.id===this.activeCityId);
    this.transfers = transfers;
    this.contracts=contracts;
    this.migrationPolicies=migrationPolicies;
    this.summaries=new Map((snapshot.summaries||[]).filter(item=>knownCities.has(item.cityId)&&item.summary&&Number.isFinite(item.summary.minute)&&Number.isSafeInteger(item.summary.population)).map(item=>[item.cityId,structuredClone(item.summary)]));
    this.ports=ports;this.routes=routes;this.vessels=vessels;
    for(const route of this.routes.values())this.ensureRouteFleet(route.id);
    for(const city of snapshot.cities)this.cities.get(city.id).reportedMinute=Number.isFinite(city.reportedMinute)?city.reportedMinute:snapshot.minute;
    this.setTime({ paused: this.paused, speed: this.speed });
    this.onChange({ type: 'world-restored', minute: this.minute });
    this.queueTransferProcessing(this.minute);
    return this;
  }
}
