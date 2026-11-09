export class WorldTradeService {
  constructor(coordinator){
    this.world=coordinator;
    this.inFlight=new Set();
    this.quiesced=false;
    this.world.transferHandlers={depart:transfer=>this.depart(transfer),deliver:transfer=>this.deliver(transfer),cancel:transfer=>this.rollback(transfer)};
  }

  track(operation){let tracked;tracked=Promise.resolve(operation).finally(()=>this.inFlight.delete(tracked));this.inFlight.add(tracked);return tracked;}
  async drain(){while(this.inFlight.size)await Promise.all([...this.inFlight]);}
  quiesce(){this.quiesced=true;return this.drain();}
  resume(){this.quiesced=false;}

  async request(session,method,args){
    const result=await session?.bridge.request(method,args);
    if(!result?.ok||result.value!==true)throw new Error(result?.message||`A operação ${method} falhou em ${session?.id||'cidade desconhecida'}.`);
    return true;
  }

  schedule(options){if(this.quiesced)return Promise.reject(new Error('O mundo está preparando um salvamento.'));return this.track(this.scheduleNow(options));}
  async scheduleNow({id,originCityId,destinationCityId,sellerBuildingId,destinationBuildingId,good,quantity,unitPrice,departureMinute=this.world.minute+1,contractId=null}){
    const origin=this.world.cities.get(originCityId),destination=this.world.cities.get(destinationCityId);
    if(!origin||!destination||originCityId===destinationCityId)throw new Error('Escolha duas cidades diferentes já fundadas.');
    if(!Number.isSafeInteger(unitPrice)||unitPrice<1||!Number.isSafeInteger(quantity)||quantity<1)throw new RangeError('Quantidade e preço precisam ser inteiros positivos.');
    const seller=origin.city.building(sellerBuildingId),buyer=destination.city.building(destinationBuildingId),route=this.world.routes.get(`route:${originCityId}>${destinationCityId}`),goodsAmount=quantity*unitPrice,freightAmount=quantity*(route?.freightPerUnit||0),amount=goodsAmount+freightAmount;
    if(!seller||!buyer||!route||!origin.city.economy.goods[good]||!Number.isSafeInteger(goodsAmount)||!Number.isSafeInteger(freightAmount)||!Number.isSafeInteger(amount))throw new Error('Produto, vendedor, comprador ou rota indisponível.');
    await this.request(destination,'reserveWorldPayment',[id,buyer.accountId,amount]);
    try{await this.request(origin,'reserveWorldExport',[id,sellerBuildingId,good,quantity]);}
    catch(error){await destination.bridge.request('refundWorldPayment',[id]);throw error;}
    try{
      return this.world.scheduleVoyage({id,routeId:route.id,departureMinute,manifest:{kind:'goods',good,quantity,unitPrice,goodsAmount,freightAmount,amount,sellerBuildingId,sellerAccountId:seller.accountId,destinationBuildingId,payerAccountId:buyer.accountId,...(contractId?{contractId}:{})}});
    }catch(error){await origin.bridge.request('returnWorldExport',[id]);await destination.bridge.request('refundWorldPayment',[id]);throw error;}
  }

  scheduleMigration(options){if(this.quiesced)return Promise.reject(new Error('O mundo está preparando um salvamento.'));return this.track(this.scheduleMigrationNow(options));}
  async scheduleMigrationNow({id,originCityId,destinationCityId,citizenId,departureMinute=this.world.minute+1}){
    const origin=this.world.cities.get(originCityId),destination=this.world.cities.get(destinationCityId),route=this.world.routes.get(`route:${originCityId}>${destinationCityId}`);
    if(!origin||!destination||originCityId===destinationCityId||!route)throw new Error('Escolha duas cidades diferentes com uma rota disponível.');
    const result=await origin.bridge.request('reserveWorldCitizenMigration',[id,citizenId]);
    if(!result?.ok||!result.value||typeof result.value!=='object')throw new Error(result?.message||'Este cidadão não está elegível para migração marítima.');
    try{return this.world.scheduleVoyage({id,routeId:route.id,departureMinute,manifest:{kind:'citizen',globalId:result.value.globalId,citizenId,package:result.value}});}
    catch(error){await origin.bridge.request('cancelWorldCitizenMigration',[id]);throw error;}
  }

  scheduleHouseholdMigration(options){if(this.quiesced)return Promise.reject(new Error('O mundo está preparando um salvamento.'));return this.track(this.scheduleHouseholdMigrationNow(options));}
  async scheduleHouseholdMigrationNow({id,originCityId,destinationCityId,citizenId,departureMinute=this.world.minute+1}){
    const origin=this.world.cities.get(originCityId),destination=this.world.cities.get(destinationCityId),route=this.world.routes.get(`route:${originCityId}>${destinationCityId}`);
    if(!origin||!destination||originCityId===destinationCityId||!route)throw new Error('Escolha duas cidades diferentes com uma rota disponível.');
    const result=await origin.bridge.request('reserveWorldHouseholdMigration',[id,citizenId]);
    if(!result?.ok||!result.value||result.value.version!==2||!Array.isArray(result.value.members))throw new Error(result?.message||'Este núcleo familiar não está elegível para migração marítima.');
    try{return this.world.scheduleVoyage({id,routeId:route.id,departureMinute,manifest:{kind:'citizen',globalId:result.value.globalId,package:result.value}});}
    catch(error){await origin.bridge.request('cancelWorldHouseholdMigration',[id]);throw error;}
  }

  createContract({id,routeId,sellerBuildingId,destinationBuildingId,good,quantity,unitPrice,intervalMinutes=1440,nextDepartureMinute=this.world.minute+1}){
    if(this.quiesced)throw new Error('O mundo está preparando um salvamento.');
    const route=this.world.routes.get(routeId);if(typeof id!=='string'||!id||!route||this.world.contracts.has(id))throw new Error('Rota inválida ou identificador de contrato repetido.');
    if(!Number.isSafeInteger(intervalMinutes)||intervalMinutes<1||!Number.isSafeInteger(nextDepartureMinute)||nextDepartureMinute<this.world.minute)throw new RangeError('Intervalo ou próxima partida inválidos.');
    const origin=this.world.cities.get(route.originCityId),destination=this.world.cities.get(route.destinationCityId),seller=origin?.city.building(sellerBuildingId),buyer=destination?.city.building(destinationBuildingId);
    if(!seller||!buyer||!origin.city.economy.goods[good]||!Number.isSafeInteger(quantity)||quantity<1||quantity>route.capacity||!Number.isSafeInteger(unitPrice)||unitPrice<1)throw new Error('Os dados do contrato comercial não são válidos.');
    const contract={id,routeId,sellerBuildingId,destinationBuildingId,good,quantity,unitPrice,intervalMinutes,nextDepartureMinute,lastAttemptMinute:null,active:true,createdAt:this.world.minute,lastError:null};
    this.world.contracts.set(id,contract);this.world.onChange({type:'contract-created',contract:structuredClone(contract)});return contract;
  }

  cancelContract(id){if(this.quiesced)return false;const contract=this.world.contracts.get(id);if(!contract||!contract.active)return false;contract.active=false;contract.cancelledAt=this.world.minute;this.world.onChange({type:'contract-cancelled',contract:structuredClone(contract)});return true;}

  processContracts(minute=this.world.minute){if(this.quiesced)return Promise.resolve(0);return this.track(this.processContractsNow(minute));}
  async processContractsNow(minute=this.world.minute){
    const due=[...this.world.contracts.values()].filter(contract=>contract.active&&contract.nextDepartureMinute<=minute&&contract.lastAttemptMinute!==minute);
    for(const contract of due){
      contract.lastAttemptMinute=minute;contract.nextDepartureMinute=minute+contract.intervalMinutes;contract.lastError=null;
      try{await this.scheduleNow({id:`contract:${contract.id}:${minute}`,originCityId:this.world.routes.get(contract.routeId).originCityId,destinationCityId:this.world.routes.get(contract.routeId).destinationCityId,sellerBuildingId:contract.sellerBuildingId,destinationBuildingId:contract.destinationBuildingId,good:contract.good,quantity:contract.quantity,unitPrice:contract.unitPrice,departureMinute:minute+1,contractId:contract.id});}
      catch(error){contract.lastError=error.message;contract.nextDepartureMinute=minute+1;}
    }
    return due.length;
  }

  createMigrationPolicy({id,routeId,intervalMinutes=1440,maxTransfers=5,nextDepartureMinute=this.world.minute+1}){
    if(this.quiesced)throw new Error('O mundo está preparando um salvamento.');
    const route=this.world.routes.get(routeId);if(typeof id!=='string'||!id||!route||this.world.migrationPolicies.has(id))throw new Error('Rota inválida ou identificador de migração repetido.');
    if(!Number.isSafeInteger(intervalMinutes)||intervalMinutes<1||!Number.isSafeInteger(maxTransfers)||maxTransfers<1||!Number.isSafeInteger(nextDepartureMinute)||nextDepartureMinute<this.world.minute)throw new RangeError('Intervalo, limite ou próxima partida inválidos.');
    const policy={id,routeId,originCityId:route.originCityId,destinationCityId:route.destinationCityId,intervalMinutes,maxTransfers,nextDepartureMinute,transfersCreated:0,lastAttemptMinute:null,lastError:null,active:true,createdAt:this.world.minute};
    this.world.migrationPolicies.set(id,policy);this.world.onChange({type:'migration-policy-created',policy:structuredClone(policy)});return policy;
  }

  cancelMigrationPolicy(id){if(this.quiesced)return false;const policy=this.world.migrationPolicies.get(id);if(!policy||!policy.active)return false;policy.active=false;policy.cancelledAt=this.world.minute;this.world.onChange({type:'migration-policy-cancelled',policy:structuredClone(policy)});return true;}

  processMigrationPolicies(minute=this.world.minute){if(this.quiesced)return Promise.resolve(0);return this.track(this.processMigrationPoliciesNow(minute));}
  async processMigrationPoliciesNow(minute=this.world.minute){
    const due=[...this.world.migrationPolicies.values()].filter(policy=>policy.active&&policy.nextDepartureMinute<=minute&&policy.lastAttemptMinute!==minute);
    for(const policy of due){
      policy.lastAttemptMinute=minute;const city=this.world.cities.get(policy.originCityId)?.city,candidates=[],people=city?.citizens||[],guardianIds=new Set(people.map(person=>person.guardianId).filter(id=>id!=null)),ownedAccounts=new Set([...[...(city?.units?.values()||[])].map(unit=>unit.ownerId),...[...(city?.vehicles?.units?.values()||[])].map(vehicle=>vehicle.ownerAccountId)]);
      for(const citizen of people){if(!city.society.isAdult(citizen)||citizen.dead||citizen.entity.destroyed)continue;if(citizen.partnerId!=null||guardianIds.has(citizen.id)){const memberIds=city.worldMigrationHousehold(citizen.id);if(memberIds?.length>1)candidates.push({citizenId:citizen.id,memberIds});continue;}if(!citizen.childIds?.length&&!citizen.businessIds?.length&&!citizen.deliveryId&&!citizen.mobilityTrip&&!citizen.ridingVehicleId&&!citizen.custody&&!citizen.indoorLocation&&!citizen.expectingId&&!citizen.worldMigrationPending&&!ownedAccounts.has(citizen.accountId))candidates.push({citizenId:citizen.id,memberIds:[citizen.id]});}
      const selected=candidates.sort((a,b)=>b.memberIds.length-a.memberIds.length||a.citizenId-b.citizenId)[0];
      if(!selected){policy.lastError='Nenhuma pessoa ou família elegível está disponível.';policy.nextDepartureMinute=minute+1;continue;}
      const id=`auto-migration:${policy.id}:${minute}`;
      try{
        if(selected.memberIds.length>1)await this.scheduleHouseholdMigrationNow({id,originCityId:policy.originCityId,destinationCityId:policy.destinationCityId,citizenId:selected.citizenId,departureMinute:minute+1});
        else await this.scheduleMigrationNow({id,originCityId:policy.originCityId,destinationCityId:policy.destinationCityId,citizenId:selected.citizenId,departureMinute:minute+1});
        policy.transfersCreated++;policy.lastError=null;policy.nextDepartureMinute=minute+policy.intervalMinutes;if(policy.transfersCreated>=policy.maxTransfers)policy.active=false;
      }catch(error){policy.lastError=error.message;policy.nextDepartureMinute=minute+1;}
    }
    return due.length;
  }

  cancel(transferId){if(this.quiesced)return Promise.resolve(false);return this.track(this.cancelNow(transferId));}
  async cancelNow(transferId){
    const transfer=this.world.transfers.get(transferId);if(!transfer||transfer.status!=='scheduled')return false;
    if(!this.world.beginCancelTransfer(transferId))return false;
    try{await this.rollback(transfer);}catch{this.world.abortCancelTransfer(transferId);return false;}
    return this.world.cancelTransfer(transferId);
  }

  async rollback(transfer){
    const origin=this.world.cities.get(transfer.originCityId),destination=this.world.cities.get(transfer.destinationCityId);
    if(transfer.kind==='citizen')await this.request(origin,transfer.payload.package.version===2?'cancelWorldHouseholdMigration':'cancelWorldCitizenMigration',[transfer.id]);
    else{await this.request(origin,'returnWorldExport',[transfer.id]);await this.request(destination,'refundWorldPayment',[transfer.id]);}
  }

  async depart(transfer){
    const origin=this.world.cities.get(transfer.originCityId);
    return this.request(origin,transfer.kind==='citizen'?(transfer.payload.package.version===2?'departWorldHouseholdMigration':'departWorldCitizenMigration'):'departWorldExport',[transfer.id]);
  }

  async deliver(transfer){
    const destination=this.world.cities.get(transfer.destinationCityId),origin=this.world.cities.get(transfer.originCityId),manifest=transfer.payload;
    if(transfer.kind==='citizen'){
      const household=manifest.package.version===2;
      await this.request(destination,household?'receiveWorldHouseholdMigration':'receiveWorldCitizenMigration',[transfer.id,manifest.package]);
      await this.request(origin,household?'completeWorldHouseholdMigration':'completeWorldCitizenMigration',[transfer.id]);return;
    }
    await this.request(destination,'receiveWorldImport',[transfer.id,manifest.good,manifest.quantity]);
    await this.request(destination,'deliverWorldImport',[transfer.id,manifest.destinationBuildingId]);
    await this.request(origin,'receiveWorldPayment',[transfer.id,manifest.payerAccountId,manifest.amount]);
    await this.request(origin,'settleWorldPayment',[transfer.id,manifest.sellerAccountId,manifest.goodsAmount??manifest.amount,manifest.freightAmount||0]);
    await this.request(origin,'completeWorldExport',[transfer.id]);
    await this.request(destination,'finalizeWorldPayment',[transfer.id]);
  }
}
