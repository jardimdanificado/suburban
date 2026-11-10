import {createSeaEdgeNavigation} from './sea_edge_navigation.js?v=sea-edge-routes-1';
import { INDUSTRIES } from './city_industries.js';
import { GOODS } from './city_economy.js?v=regional-supply-5';

export class WorldTradeService {
  constructor(coordinator){
    this.world=coordinator;
    this.inFlight=new Set();
    this.quiesced=false;
    this.world.transferHandlers={prepareDeparture:transfer=>this.prepareDeparture(transfer),depart:transfer=>this.depart(transfer),deliver:transfer=>this.deliver(transfer),cancel:transfer=>this.rollback(transfer),returnVessel:vessel=>this.returnVessel(vessel)};
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

  requireSeaAccess(...sessions){for(const session of sessions){const city=session?.city;if(city?.world?.getTile&&!createSeaEdgeNavigation(city.world)?.reachable(city.worldPort?.berth))throw new Error('O porto não tem acesso navegável ao mar.');}}

  syncOperatorFleet(){
    const live=new Set();
    for(const session of this.world.cities.values()){
      const city=session.city;
      for(const vehicle of city.vehicles?.units?.values?.()||[]){
        if(!vehicle.boatClass||!vehicle.active||vehicle.scrapped||vehicle.driverId||vehicle.mechanicId||vehicle.condition<=15)continue;
        const boatPosition=vehicle.entity||vehicle,harbour=city.worldPort?.berth||city.worldPort?.door||city.worldPort;
        if(!Number.isFinite(boatPosition.x)||!Number.isFinite(boatPosition.y)||!harbour||Math.hypot(boatPosition.x-harbour.x,boatPosition.y-harbour.y)>24)continue;
        const account=city.accounts.get(vehicle.ownerAccountId),business=city.economy.businesses.find(item=>item.accountId===vehicle.ownerAccountId&&item.type==='carrier'&&item.active&&!item.entity.destroyed);
        const owner=account?.entity?.properties?.citizen||(typeof account?.accountId==='string'&&account.accountId.startsWith('citizen:')?account:null);
        const operatorType=business?'carrier':owner?'freelance':['treasury',city.worldPort?.accountId].includes(vehicle.ownerAccountId)?'municipal':null;
        if(!operatorType)continue;
        const id=`owned-vessel:${session.id}:${vehicle.id}`,classId=vehicle.boatClass,capacity=vehicle.capacity||vehicle.pickCapacity||({canoe:2,launch:8,ferry:32,cargo:100}[classId]||1);
        live.add(id);
        const existing=this.world.vessels.get(id);
        if(existing){existing.capacity=capacity;existing.classId=classId;existing.ownerAccountId=vehicle.ownerAccountId;existing.ownerName=business?.entity.properties.name||owner?.entity.properties.name||city.accountName(vehicle.ownerAccountId);continue;}
        this.world.addVessel({id,classId,capacity,routeId:null,currentPortId:`${session.id}:port`,operatorType,ownerAccountId:vehicle.ownerAccountId,ownerName:business?.entity.properties.name||owner?.entity.properties.name||city.accountName(vehicle.ownerAccountId),localVehicleId:vehicle.id,homeCityId:session.id});
      }
    }
    for(const [id,vessel]of this.world.vessels){
      if(!id.startsWith('owned-vessel:')||live.has(id)||vessel.status!=='idle')continue;
      const home=this.world.cities.get(vessel.homeCityId);if(home)void home.bridge.request('setWorldBoatAssigned',[vessel.localVehicleId,false]);
      this.world.vessels.delete(id);this.world.onChange({type:'vessel-removed',vesselId:id});
    }
  }

  reserveBoatVehicle(vessel){const home=this.world.cities.get(vessel.homeCityId);if(home&&vessel.localVehicleId!=null)void home.bridge.request('setWorldBoatAssigned',[vessel.localVehicleId,true]);}
  freightQuote(route,vessel,quantity){return Math.ceil((route.freightPerUnit||0)*(vessel.capacity*.35+quantity*.65));}
  async scheduleBatch({id,route,vessel,offers,minute}){
    const quantity=offers.reduce((n,offer)=>n+offer.quantity,0),totalFreight=this.freightQuote(route,vessel,quantity),shipments=[];let allocated=0;
    try{
      for(const [index,offer]of offers.entries()){
        const freight=index===offers.length-1?totalFreight-allocated:Math.floor(totalFreight*offer.quantity/quantity);allocated+=freight;
        shipments.push(await this.scheduleNow({id:`${id}:${index}`,originCityId:route.originCityId,destinationCityId:route.destinationCityId,sellerBuildingId:offer.seller.id,destinationBuildingId:offer.buyer.id,good:offer.good,quantity:offer.quantity,unitPrice:offer.unitPrice,prepareOnly:true,freightOverride:freight,vesselOverride:vessel}));
      }
      this.reserveBoatVehicle(vessel);return this.world.scheduleVoyage({id,routeId:route.id,vesselId:vessel.id,departureMinute:minute+1,manifest:{kind:'goods',quantity,shipments,freightAmount:totalFreight}});
    }catch(error){for(const shipment of shipments)await this.rollback({id:shipment.id,kind:'goods',originCityId:route.originCityId,destinationCityId:route.destinationCityId,payload:shipment.manifest});throw error;}
  }
  schedule(options){if(this.quiesced)return Promise.reject(new Error('O mundo está preparando um salvamento.'));return this.track(this.scheduleNow(options));}
  async scheduleNow({id,originCityId,destinationCityId,sellerBuildingId,destinationBuildingId,good,quantity,unitPrice,departureMinute=this.world.minute+1,contractId=null,prepareOnly=false,freightOverride=null,vesselOverride=null}){
    this.syncOperatorFleet();
    const origin=this.world.cities.get(originCityId),destination=this.world.cities.get(destinationCityId);
    if(!origin||!destination||originCityId===destinationCityId)throw new Error('Escolha duas cidades diferentes já fundadas.');
    if(!Number.isSafeInteger(unitPrice)||unitPrice<1||!Number.isSafeInteger(quantity)||quantity<1)throw new RangeError('Quantidade e preço precisam ser inteiros positivos.');
    const seller=origin.city.building(sellerBuildingId)||(origin.city.economy.importDepot?.id===sellerBuildingId?origin.city.economy.importDepot:null),buyer=destination.city.building(destinationBuildingId),route=this.world.routes.get(`route:${originCityId}>${destinationCityId}`),goodsAmount=quantity*unitPrice,freightAmount=freightOverride??(route?this.freightQuote(route,this.world.availableVessel(route.id,quantity)||{capacity:quantity},quantity):0),amount=goodsAmount+freightAmount;
    if(!seller||!buyer||!route||!origin.city.economy.goods[good]||!Number.isSafeInteger(goodsAmount)||!Number.isSafeInteger(freightAmount)||!Number.isSafeInteger(amount))throw new Error('Produto, vendedor, comprador ou rota indisponível.');
    this.requireSeaAccess(origin,destination);
    await this.request(destination,'reserveWorldPayment',[id,buyer.accountId,amount]);
    try{await this.request(destination,'reserveWorldImport',[id,destinationBuildingId,good,quantity]);}
    catch(error){await destination.bridge.request('refundWorldPayment',[id]);throw error;}
    try{await this.request(origin,'reserveWorldExport',[id,sellerBuildingId,good,quantity,true]);}
    catch(error){await destination.bridge.request('cancelWorldImport',[id]);await destination.bridge.request('refundWorldPayment',[id]);throw error;}
    try{
      const vessel=vesselOverride||this.world.availableVessel(route.id,quantity);
      if(!vessel)throw new Error('Não há embarcação livre com capacidade para esta carga.');
      const manifest={kind:'goods',good,quantity,unitPrice,goodsAmount,freightAmount,amount,sellerBuildingId,sellerAccountId:seller.accountId,destinationBuildingId,payerAccountId:buyer.accountId,...(vessel.operatorType!=='municipal'&&vessel.ownerAccountId?{freightReceiverAccountId:vessel.ownerAccountId,freightReceiverCityId:vessel.homeCityId,freightOperatorName:vessel.ownerName}:{}),...(contractId?{contractId}:{})};
      if(prepareOnly)return {id,manifest};
      this.reserveBoatVehicle(vessel);return this.world.scheduleVoyage({id,routeId:route.id,vesselId:vessel.id,departureMinute,manifest});
    }catch(error){await origin.bridge.request('returnWorldExport',[id]);await destination.bridge.request('cancelWorldImport',[id]);await destination.bridge.request('refundWorldPayment',[id]);throw error;}
  }

  scheduleMigration(options){if(this.quiesced)return Promise.reject(new Error('O mundo está preparando um salvamento.'));return this.track(this.scheduleMigrationNow(options));}
  async choosePassengerVessel({id,origin,route,citizenId,passengerCount,assetCount=0}){
    this.syncOperatorFleet();
    const quantity=passengerCount+assetCount,preferred=this.world.availableVessel(route.id,quantity);
    if(!preferred||preferred.operatorType==='municipal')return preferred;
    // A private carrier can run the passenger service only from its home city;
    // otherwise the fare would be charged in a city where its owner has no account.
    if(preferred.homeCityId!==origin.id||!preferred.ownerAccountId||!origin.city.accounts.has(preferred.ownerAccountId))return this.world.availableVessel(route.id,quantity,{municipalOnly:true});
    const head=origin.city.society.citizen(citizenId),accountId=head?.accountId;
    const fare=origin.city.currency.price(60*passengerCount+30*assetCount);
    if(!accountId||!Number.isSafeInteger(fare)||fare<1)return this.world.availableVessel(route.id,quantity,{municipalOnly:true});
    const payment=await origin.bridge.request('payWorldPassengerFare',[id,accountId,preferred.ownerAccountId,fare,preferred.id]);
    return payment?.ok&&payment.value===true?{...preferred,passengerFare:{payerAccountId:accountId,operatorAccountId:preferred.ownerAccountId,amount:fare}}:this.world.availableVessel(route.id,quantity,{municipalOnly:true});
  }
  async scheduleMigrationNow({id,originCityId,destinationCityId,citizenId,departureMinute=this.world.minute+1,reason=null}){
    const origin=this.world.cities.get(originCityId),destination=this.world.cities.get(destinationCityId),route=this.world.routes.get(`route:${originCityId}>${destinationCityId}`);
    if(!origin||!destination||originCityId===destinationCityId||!route)throw new Error('Escolha duas cidades diferentes com uma rota disponível.');
    this.requireSeaAccess(origin,destination);
    const result=await origin.bridge.request('reserveWorldCitizenMigration',[id,citizenId]);
    if(!result?.ok||!result.value||typeof result.value!=='object')throw new Error(result?.message||'Este cidadão não está elegível para migração marítima.');
    let vessel;
    try{vessel=await this.choosePassengerVessel({id,origin,route,citizenId,passengerCount:1,assetCount:result.value.vehicleAssets?.length||0});if(!vessel)throw new Error('Não há embarcação disponível para transportar este morador.');this.reserveBoatVehicle(vessel);return this.world.scheduleVoyage({id,routeId:route.id,departureMinute,vesselId:vessel.id,manifest:{kind:'citizen',globalId:result.value.globalId,citizenId,package:result.value,...(vessel.passengerFare?{passengerFare:vessel.passengerFare}:{}),...(reason?{reason}:{})}});}
    catch(error){if(vessel?.passengerFare)await origin.bridge.request('refundWorldPassengerFare',[id]);await origin.bridge.request('cancelWorldCitizenMigration',[id]);throw error;}
  }

  scheduleHouseholdMigration(options){if(this.quiesced)return Promise.reject(new Error('O mundo está preparando um salvamento.'));return this.track(this.scheduleHouseholdMigrationNow(options));}
  async scheduleHouseholdMigrationNow({id,originCityId,destinationCityId,citizenId,departureMinute=this.world.minute+1,reason=null}){
    const origin=this.world.cities.get(originCityId),destination=this.world.cities.get(destinationCityId),route=this.world.routes.get(`route:${originCityId}>${destinationCityId}`);
    if(!origin||!destination||originCityId===destinationCityId||!route)throw new Error('Escolha duas cidades diferentes com uma rota disponível.');
    this.requireSeaAccess(origin,destination);
    const result=await origin.bridge.request('reserveWorldHouseholdMigration',[id,citizenId]);
    if(!result?.ok||!result.value||result.value.version!==2||!Array.isArray(result.value.members))throw new Error(result?.message||'Este núcleo familiar não está elegível para migração marítima.');
    const passengerCount=result.value.members.length,assetCount=result.value.members.reduce((n,member)=>n+(member.vehicleAssets?.length||0),0);let vessel;
    try{vessel=await this.choosePassengerVessel({id,origin,route,citizenId,passengerCount,assetCount});if(!vessel)throw new Error('Não há embarcação disponível para transportar esta família.');this.reserveBoatVehicle(vessel);return this.world.scheduleVoyage({id,routeId:route.id,departureMinute,vesselId:vessel.id,manifest:{kind:'citizen',globalId:result.value.globalId,package:result.value,...(vessel.passengerFare?{passengerFare:vessel.passengerFare}:{}),...(reason?{reason}:{})}});}
    catch(error){if(vessel?.passengerFare)await origin.bridge.request('refundWorldPassengerFare',[id]);await origin.bridge.request('cancelWorldHouseholdMigration',[id]);throw error;}
  }

  processAutonomousMigrations(minute=this.world.minute){if(this.quiesced)return Promise.resolve(0);return this.track(this.processAutonomousMigrationsNow(minute));}
  async processAutonomousMigrationsNow(minute=this.world.minute){
    const day=Math.floor(minute/1440);
    if(this.world.autonomousMigrationDay===day||this.world.cities.size<2)return 0;
    this.world.autonomousMigrationDay=day;
    let departures=0;
    for(const origin of this.world.cities.values()){
      const from=origin.city,fromStats=from.stats(),fromVacant=Math.max(0,fromStats.units-fromStats.occupied),fromJobRate=fromStats.vacancies/Math.max(1,fromStats.population),fromHomeRate=fromVacant/Math.max(1,fromStats.population);
      const destinations=[...this.world.cities.values()].filter(destination=>destination.id!==origin.id&&this.world.routes.has(`route:${origin.id}>${destination.id}`)).map(destination=>{
        const stats=destination.city.stats(),vacant=Math.max(0,stats.units-stats.occupied);
        return {session:destination,stats,vacant,jobRate:stats.vacancies/Math.max(1,stats.population),homeRate:vacant/Math.max(1,stats.population)};
      });
      if(!destinations.length)continue;
      const eligible=[],seen=new Set();
      for(const citizen of from.citizens){
        if(!from.society.isAdult(citizen)||citizen.dead||citizen.entity.destroyed||seen.has(citizen.id))continue;
        const memberIds=from.worldMigrationHousehold(citizen.id);
        if(!memberIds?.length)continue;
        for(const id of memberIds)seen.add(id);
        const family=memberIds.map(id=>from.society.citizen(id)).filter(Boolean),adults=family.filter(person=>from.society.isAdult(person));
        const jobSeekers=adults.filter(person=>!person.jobId&&!person.businessIds?.length&&!from.politics.officeHolder(person)).length,workingAdults=adults.filter(person=>person.jobId||from.politics.officeHolder(person)).length,unemployed=jobSeekers>0;
        const homeless=family.some(person=>!person.homeUnitId);
        const happiness=family.reduce((sum,person)=>sum+(person.happiness||0),0)/Math.max(1,family.length);
        const minimumNeed=Math.min(...family.flatMap(person=>Object.values(person.needs||{})));
        if(!unemployed&&!homeless&&happiness>=48&&minimumNeed>=35)continue;
        const pressure=(unemployed?18:0)+(homeless?18:0)+Math.max(0,48-happiness)*.7+Math.max(0,35-minimumNeed)*.35;
        const options=destinations.map(destination=>{
          const hasJobs=destination.stats.vacancies>=Math.max(jobSeekers,workingAdults);
          const hasHousing=destination.vacant>=Math.max(1,Math.ceil(family.length/2));
          if(!hasJobs||!hasHousing)return null;
          const wellbeing=(destination.stats.happiness-fromStats.happiness)*.65;
          const jobAdvantage=(destination.jobRate-fromJobRate)*100;
          const homeAdvantage=(destination.homeRate-fromHomeRate)*100;
          const opportunity=pressure+wellbeing+Math.max(-8,jobAdvantage*24)+Math.max(-8,homeAdvantage*28);
          const temperament=.8+(citizen.traits?.ambition??.5)*.25+(citizen.traits?.riskTolerance??.5)*.2;
          return {...destination,score:opportunity*temperament,unemployed,homeless,happiness,minimumNeed};
        }).filter(Boolean).sort((a,b)=>b.score-a.score);
        if(options[0]?.score>=28)eligible.push({citizenId:citizen.id,memberIds,score:options[0].score,reason:unemployed?'work':homeless?'housing':'wellbeing',destinationId:options[0].session.id});
      }
      eligible.sort((a,b)=>b.score-a.score||a.citizenId-b.citizenId);
      for(const choice of eligible){
        const id=`resident-migration:${origin.id}:${choice.citizenId}:${day}`;
        try{
          const options={id,originCityId:origin.id,destinationCityId:choice.destinationId,citizenId:choice.citizenId,departureMinute:minute+1,reason:choice.reason};
          if(choice.memberIds.length>1)await this.scheduleHouseholdMigrationNow(options);else await this.scheduleMigrationNow(options);
          departures++;break;
        }catch{}
      }
    }
    return departures;
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

  findRegionalTradeCandidate(route,excludedGoods=new Set(),excludedOffers=new Set()){
    const origin=this.world.cities.get(route?.originCityId),destination=this.world.cities.get(route?.destinationCityId);if(!origin||!destination)return null;
    const city=origin.city,other=destination.city,economy=city.economy,targetEconomy=other.economy;
    const inTransit=new Set([...this.world.transfers.values()].filter(transfer=>transfer.destinationCityId===destination.id&&transfer.kind==='goods'&&['scheduled','departing','in-transit','arriving'].includes(transfer.status)).map(transfer=>transfer.payload.good));
    const suppliers=[];
    const importDepot=economy.importDepot;
    for(const seller of [...city.buildings,...(importDepot?[importDepot]:[])]){
      if(!seller.active||seller.entity.destroyed)continue;
      const outputs=seller.type==='farm'?[seller.crop]:seller.type==='bakery'?['pao']:seller.type==='mill'?['oleo']:Object.keys(INDUSTRIES[seller.type]?.outputs||{});
      // Retailers can redistribute genuine stocked goods when their local
      // shelves are full. This lets trade begin before a city has developed
      // its own factories, without assigning a preset industry to either city.
      const stockedGoods=seller.type==='import_depot'?Object.keys(seller.inventory||{}).filter(good=>(seller.inventory[good]||0)>(Object.values(seller.claims||{}).reduce((n,claim)=>n+(claim?.[good]||0),0))):['market','greengrocer','restaurant'].includes(seller.type)?Object.keys(seller.inventory||{}).filter(good=>(seller.inventory[good]||0)>0&&economy.accepts(seller,good)):[];
      for(const good of new Set([...outputs,...stockedGoods])){
        const stock=seller.inventory?.[good]||0,market=economy.market?.[good];
        const reserved=[...this.world.transfers.values()].filter(transfer=>transfer.originCityId===origin.id&&transfer.kind==='goods'&&['scheduled','departing','in-transit','arriving'].includes(transfer.status)&&transfer.payload.good===good&&transfer.payload.sellerBuildingId===seller.id).reduce((n,transfer)=>n+transfer.payload.quantity,0),depotClaims=seller.type==='import_depot'?Object.values(seller.claims||{}).reduce((n,claim)=>n+(claim?.[good]||0),0):0,reserve=Math.min(6,Math.floor(stock*.25)),surplus=stock-reserved-reserve-depotClaims;
        if(excludedGoods.has(good)||inTransit.has(good)||surplus<1||!targetEconomy.goods[good]||!GOODS[good])continue;
        suppliers.push({seller,good,surplus,score:surplus-(market?.demand||0)});
      }
    }
    suppliers.sort((a,b)=>b.score-a.score||a.good.localeCompare(b.good));
    for(const offer of suppliers){
      const buyers=other.buildings.filter(buyer=>buyer.active&&!buyer.entity.destroyed&&targetEconomy.accepts(buyer,offer.good));
      const unitPrice=Math.max(1,Math.ceil(city.currency.price(GOODS[offer.good].price)*.9-(route.freightPerUnit||0))),landedPrice=unitPrice+(route.freightPerUnit||0);
      const needFor=buyer=>{
        const recipe=targetEconomy.vehicles?.recipeFor(buyer)?.inputs||INDUSTRIES[buyer.type]?.inputs||{},quantity=recipe[offer.good],target=buyer.type==='boat_shop'?1:quantity?quantity*6:['market','greengrocer','restaurant'].includes(buyer.type)?12:6;
        return Math.max(0,target-(buyer.inventory?.[offer.good]||0)-(buyer.incoming?.[offer.good]||0)-(buyer.worldIncoming?.[offer.good]||0)-(buyer.importIncoming?.[offer.good]||0));
      };
      const affordableFor=buyer=>Math.floor(Math.max(0,buyer.balance-Math.max(city.currency.price(500),buyer.workers.length*buyer.wage*12))/landedPrice);
      buyers.sort((a,b)=>needFor(b)-needFor(a)||a.id-b.id);
      const buyer=buyers.find(candidate=>!excludedOffers.has(`${offer.seller.id}:${candidate.id}:${offer.good}`)&&needFor(candidate)>0&&affordableFor(candidate)>0),need=buyer?needFor(buyer):0;
      if(!buyer||need<1)continue;
      // Let larger factory orders use the cargo vessel instead of splitting
      // every shipment below the ferry capacity threshold.
      const quantityToShip=Math.min(route.capacity,offer.surplus,need,affordableFor(buyer));
      if(quantityToShip<1)continue;
      return {route,origin,destination,seller:offer.seller,buyer,good:offer.good,surplus:offer.surplus,need,quantity:quantityToShip,unitPrice};
    }
    return null;
  }

  regionalTradePreview(){
    const candidates=[];
    for(const route of this.world.routes.values()){
      const excludedGoods=new Set();
      for(let count=0;count<4;count++){const candidate=this.findRegionalTradeCandidate(route,excludedGoods);if(!candidate)break;candidates.push(candidate);excludedGoods.add(candidate.good);}
    }
    return candidates;
  }

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

  processRegionalTrade(minute=this.world.minute){if(this.quiesced)return Promise.resolve(0);return this.track(this.processRegionalTradeNow(minute));}
  async processRegionalTradeNow(minute=this.world.minute){
    // Check often enough that a new surplus turns into a visible voyage soon,
    // rather than leaving a full warehouse idle for an entire game hour.
    const window=Math.floor(minute/15);
    if(this.world.cities.size<2)return 0;
    this.syncOperatorFleet();
    if(this.world.regionalTradeDay===window)return 0;
    this.world.regionalTradeDay=window;
    let scheduled=0;
    for(const route of this.world.routes.values()){
      const first=this.findRegionalTradeCandidate(route);if(!first){route.freightWaitingSince=null;continue;}
      const vessel=this.world.availableVessel(route.id,first.quantity);if(!vessel)continue;
      const offers=[],excluded=new Set(),excludedOffers=new Set();let quantity=0;
      for(let index=0;index<16;index++){
        const offer=this.findRegionalTradeCandidate(route,excluded,excludedOffers);if(!offer)break;excludedOffers.add(`${offer.seller.id}:${offer.buyer.id}:${offer.good}`);
        const committed=offers.filter(item=>item.seller.id===offer.seller.id&&item.good===offer.good).reduce((sum,item)=>sum+item.quantity,0);offer.quantity=Math.min(offer.quantity,vessel.capacity-quantity,(offer.surplus??Infinity)-committed);if(offer.quantity<1)continue;
        offers.push(offer);quantity+=offer.quantity;if(quantity===vessel.capacity)break;
      }
      route.municipalWaitMinutes??=60;route.freightWaitingSince??=minute;
      if(vessel.operatorType==='municipal'&&quantity<vessel.capacity&&minute-route.freightWaitingSince<route.municipalWaitMinutes)continue;
      try{await this.scheduleBatch({id:`regional:${route.id}:${window}`,route,vessel,offers,minute});scheduled++;route.freightWaitingSince=null;}
      catch(error){this.world.onChange({type:'regional-trade-attempt-failed',routeId:route.id,message:error.message,minute});}
    }
    return scheduled;
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
      policy.lastAttemptMinute=minute;const city=this.world.cities.get(policy.originCityId)?.city,candidates=[],people=city?.citizens||[],guardianIds=new Set(people.map(person=>person.guardianId).filter(id=>id!=null)),ownedAccounts=new Set([...[...(city?.units?.values()||[])].map(unit=>unit.ownerId),...[...(city?.vehicles?.units?.values()||[])].filter(vehicle=>!['bicicleta','bicicleta_carga','patinete','patins','skate'].includes(vehicle.good)).map(vehicle=>vehicle.ownerAccountId)]);
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
    const cancelledBoat=this.world.vessels.get(transfer.vesselId);if(cancelledBoat?.localVehicleId!=null){const home=this.world.cities.get(cancelledBoat.homeCityId);if(home)await this.request(home,'setWorldBoatAssigned',[cancelledBoat.localVehicleId,false]);}
    if(transfer.payload.shipments){if(transfer.payload.crew)await this.request(origin,'cancelWorldCitizenMigration',[`${transfer.id}:crew`]);for(const shipment of transfer.payload.shipments)await this.rollback({...transfer,id:shipment.id,payload:shipment.manifest});return;}
    if(transfer.payload.crew)await this.request(origin,'cancelWorldCitizenMigration',[`${transfer.id}:crew`]);
    if(transfer.kind==='citizen'){if(transfer.payload.passengerFare)await this.request(origin,'refundWorldPassengerFare',[transfer.id]);await this.request(origin,transfer.payload.package.version===2?'cancelWorldHouseholdMigration':'cancelWorldCitizenMigration',[transfer.id]);}
    else{await this.request(origin,'returnWorldExport',[transfer.id]);await this.request(destination,'cancelWorldImport',[transfer.id]);await this.request(destination,'refundWorldPayment',[transfer.id]);}
  }

  async prepareDeparture(transfer){
    const origin=this.world.cities.get(transfer.originCityId);
    {
      const stored=this.world.transfers.get(transfer.id).payload;
      if(!stored.crew){
        for(const person of origin.city.citizens||[]){
          if(!origin.city.society.isAdult(person)||person.jobId||person.homeUnitId||origin.city.worldMigrationHousehold(person.id)?.length!==1)continue;
          const ship=this.world.vessels.get(transfer.vesselId);if(ship?.localVehicleId!=null){const boarding=await origin.bridge.request('approachWorldBoat',[ship.localVehicleId,person.id]);if(!boarding?.ok||boarding.value!==true)break;}
          const result=await origin.bridge.request('reserveWorldCitizenMigration',[`${transfer.id}:crew`,person.id]);
          if(result?.ok&&result.value){stored.crew=result.value;break;}
        }
        if(!stored.crew)throw new Error('A viagem aguarda um piloto disponível na cidade de origem.');
      }
      await this.request(origin,'departWorldCitizenMigration',[`${transfer.id}:crew`]);
    }
    return true;
  }

  async depart(transfer){
    const origin=this.world.cities.get(transfer.originCityId);
    if(transfer.payload.shipments){for(const shipment of transfer.payload.shipments)await this.request(origin,'departWorldExport',[shipment.id]);return true;}
    return this.request(origin,transfer.kind==='citizen'?(transfer.payload.package.version===2?'departWorldHouseholdMigration':'departWorldCitizenMigration'):'departWorldExport',[transfer.id]);
  }

  async returnVessel(vessel){
    const trip=this.world.transfers.get(vessel.lastTransferId),crew=trip?.payload.crew;if(!crew)return;
    const home=this.world.cities.get(trip.originCityId);
    await this.request(home,'receiveWorldCitizenMigration',[`${trip.id}:crew`,crew]);
    await this.request(home,'completeWorldCitizenMigration',[`${trip.id}:crew`]);if(vessel.localVehicleId!=null)await this.request(home,'setWorldBoatAssigned',[vessel.localVehicleId,false]);
  }

  async deliver(transfer){
    const destination=this.world.cities.get(transfer.destinationCityId),origin=this.world.cities.get(transfer.originCityId),manifest=transfer.payload;
    if(manifest.shipments){for(const shipment of manifest.shipments)await this.deliver({...transfer,id:shipment.id,payload:shipment.manifest});return;}
    if(transfer.kind==='citizen'){
      const household=manifest.package.version===2;
      await this.request(destination,household?'receiveWorldHouseholdMigration':'receiveWorldCitizenMigration',[transfer.id,manifest.package]);
      await this.request(origin,household?'completeWorldHouseholdMigration':'completeWorldCitizenMigration',[transfer.id]);return;
    }
    await this.request(destination,'receiveWorldImport',[transfer.id,manifest.good,manifest.quantity]);
    await this.request(destination,'deliverWorldImport',[transfer.id,manifest.destinationBuildingId]);
    await this.request(origin,'receiveWorldPayment',[transfer.id,manifest.payerAccountId,manifest.amount]);
    await this.request(origin,'settleWorldPayment',[transfer.id,manifest.sellerAccountId,manifest.goodsAmount??manifest.amount,manifest.freightAmount||0,manifest.freightReceiverCityId===origin.id?manifest.freightReceiverAccountId||null:null]);
    if(manifest.freightAmount>0&&manifest.freightReceiverAccountId&&manifest.freightReceiverCityId!==origin.id){const receiver=this.world.cities.get(manifest.freightReceiverCityId);if(!receiver)throw new Error('A cidade da transportadora não está disponível para receber o frete.');await this.request(receiver,'receiveWorldFreightIncome',[transfer.id,manifest.freightReceiverAccountId,manifest.freightAmount,transfer.vesselId]);}
    await this.request(origin,'completeWorldExport',[transfer.id]);
    await this.request(destination,'finalizeWorldPayment',[transfer.id]);
  }
}
