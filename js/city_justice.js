import {dispatchPoliceAudits,updatePoliceAudit} from './city_police_financial_audit.js';
import {offerPoliceBribe,considerPoliceBribe,reopenBribedInvestigation} from './city_police_bribery.js';
import {offerWitnessBribe,considerWitnessBribe,alterBribedTestimony} from './city_witness_bribery.js';
import {offerJudgeBribe,considerJudgeBribe} from './city_judge_bribery.js';
import {offerForensicBribe,considerForensicBribe,preserveReportedForensicEvidence,reviewBribedAutopsy} from './city_forensic_bribery.js';
import {dispatchVehicleRestitution,updateVehicleRestitution,pauseVehicleRestitution} from './city_vehicle_restitution.js';
import {artworkNarrative,artworkReception,narrativeReception} from './city_art_narratives.js';
import {funeralSpec} from './city_funeral_services.js';
import {interiorLayout,interiorRoute} from './city_interior_layout.js';
import {injuryMovementFactor,injuredCarryCapacity} from './city_injury_effects.js';
import {CITY_FLOOR_HEIGHT,buildingPoint} from './city_building_geometry.js';
import {syncCitizenInterior} from './city_interiors.js';
import {civicStatus,civicVisit} from './city_public_services.js';
import {inventoryFree} from './city_inventory.js';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const buildingContainsPoint=(building,x,y)=>{const px=x-building.entity.x,py=y-building.entity.y;let localX,localY;switch((building.rotation||0)%4){case 1:localX=building.depth-py;localY=px;break;case 2:localX=building.width-px;localY=building.depth-py;break;case 3:localX=py;localY=building.width-px;break;default:localX=px;localY=py;}return localX>=0&&localX<building.width&&localY>=0&&localY<building.depth;};
const cityUnitForInvestigation=(city,room)=>city.units?.get(room?.unitId??room?.targetUnitId)??null;
export const CRIME_TYPES=Object.freeze({graffiti:'Pichação',bicycleTheft:'Furto de bicicleta',vehicleReceiving:'Receptação de veículo',propertyReceiving:'Receptação de bens',theft:'Furto de objetos',robbery:'Roubo',trespass:'Invasão de propriedade',vandalism:'Depredação',assault:'Agressão',attemptedMurder:'Tentativa de homicídio',illegalArrest:'Prisão ilegal',investigationFraud:'Fraude de investigação',falseTestimony:'Depoimento falso',policeBribery:'Suborno policial',witnessBribery:'Suborno de testemunha',judgeBribery:'Suborno judicial',forensicBribery:'Suborno de perito',murder:'Homicídio',corruption:'Corrupção',defamation:'Difamação'});
const BASE_PENAL_CODE=Object.freeze({graffiti:{criminal:true,severity:10,fine:100,ownerConsentDefense:true,exemptArtworkKinds:[]},bicycleTheft:{criminal:true,severity:45,fine:0},vehicleReceiving:{criminal:true,severity:55,fine:400},propertyReceiving:{criminal:true,severity:45,fine:250},theft:{criminal:true,severity:35,fine:0},robbery:{criminal:true,severity:60,fine:0},trespass:{criminal:true,severity:15,fine:50},vandalism:{criminal:true,severity:30,fine:100,minimumDamage:0},assault:{criminal:true,severity:60,fine:0},attemptedMurder:{criminal:true,severity:90,fine:0},illegalArrest:{criminal:true,severity:85,fine:500},investigationFraud:{criminal:true,severity:75,fine:300},falseTestimony:{criminal:true,severity:60,fine:300},policeBribery:{criminal:true,severity:75,fine:500},witnessBribery:{criminal:true,severity:75,fine:500},judgeBribery:{criminal:true,severity:85,fine:1000},forensicBribery:{criminal:true,severity:85,fine:1000},murder:{criminal:true,severity:100,fine:0},corruption:{criminal:true,severity:80,fine:0},defamation:{criminal:true,severity:25,fine:50}});
const stolenMoneyQuantity=(city,accountId,caseId=null)=>Math.min(Math.max(0,city.accounts.get(accountId)?.balance||0),(city.accounts.get(accountId)?.stolenMoneyLots||[]).filter(lot=>caseId==null||lot.caseId===caseId).reduce((sum,lot)=>sum+Math.max(0,lot.amount||0),0));
function addStolenMoneyLot(city,accountId,caseId,amount){if(!Number.isSafeInteger(amount)||amount<=0)return false;const account=city.accounts.get(accountId);if(!account)return false;account.stolenMoneyLots??=[];account.stolenMoneyLots.push({caseId,amount,acquiredAt:city.minute});return true;}
function takeStolenMoneyLots(city,accountId,amount,caseId=null){const account=city.accounts.get(accountId);if(!account||!Number.isSafeInteger(amount)||amount<=0||stolenMoneyQuantity(city,accountId,caseId)<amount)return null;let remaining=amount;const moved=[];account.stolenMoneyLots??=[];for(const lot of account.stolenMoneyLots){if(remaining<=0)break;if(caseId!=null&&lot.caseId!==caseId)continue;const quantity=Math.min(remaining,Math.max(0,lot.amount||0));if(!quantity)continue;moved.push({...lot,amount:quantity});lot.amount-=quantity;remaining-=quantity;}account.stolenMoneyLots=account.stolenMoneyLots.filter(lot=>lot.amount>0);return remaining===0?moved:null;}
const stolenInventoryQuantity=(citizen,caseId,good)=>Math.min(Math.max(0,citizen?.inventory?.[good]||0),(citizen?.inventoryProvenance||[]).filter(lot=>lot.caseId===caseId&&lot.good===good).reduce((sum,lot)=>sum+Math.max(0,lot.quantity||0),0));
function takeStolenInventory(citizen,caseId,good,quantity){
  if(stolenInventoryQuantity(citizen,caseId,good)<quantity||(citizen.inventory?.[good]||0)<quantity)return null;
  let remaining=quantity;const moved=[];citizen.inventoryProvenance??=[];
  for(const lot of citizen.inventoryProvenance){if(remaining<=0)break;if(lot.caseId!==caseId||lot.good!==good)continue;const count=Math.min(remaining,lot.quantity||0);if(!count)continue;moved.push({...lot,quantity:count});lot.quantity-=count;remaining-=count;}
  citizen.inventoryProvenance=citizen.inventoryProvenance.filter(lot=>lot.quantity>0);citizen.inventory[good]-=quantity;return moved;
}
function giveStolenInventory(citizen,lots){
  if(!lots?.length)return 0;citizen.inventory??={};citizen.inventoryProvenance??=[];let quantity=0;
  for(const lot of lots){citizen.inventory[lot.good]=(citizen.inventory[lot.good]||0)+lot.quantity;citizen.inventoryProvenance.push({...lot});quantity+=lot.quantity;}return quantity;
}
function ensureStolenInventoryLot(citizen,asset,caseId){
  if(asset?.kind!=='item'||!citizen||stolenInventoryQuantity(citizen,caseId,asset.good)>0)return;
  const quantity=Math.min(Math.max(0,(asset.quantity||0)-(asset.recovered||0)),Math.max(0,citizen.inventory?.[asset.good]||0));if(!quantity)return;
  citizen.inventoryProvenance??=[];citizen.inventoryProvenance.push({caseId,good:asset.good,quantity,originOwnerId:asset.ownerId,createdAt:asset.stolenAt??null,migrated:true});
}
function reconcileStolenInventory(citizen){
  const lots=citizen?.inventoryProvenance;if(!lots?.length)return;const totals=new Map();for(const lot of lots)totals.set(lot.good,(totals.get(lot.good)||0)+Math.max(0,lot.quantity||0));
  for(const [good,total]of totals){let excess=total-Math.max(0,citizen.inventory?.[good]||0);if(excess<=0)continue;for(const lot of lots){if(lot.good!==good||excess<=0)continue;const removed=Math.min(excess,Math.max(0,lot.quantity||0));lot.quantity-=removed;excess-=removed;}}
  citizen.inventoryProvenance=lots.filter(lot=>lot.quantity>0);
}

/** Physical death records and municipal recovery of remains. */
export class CityJustice {
  constructor(city){this.city=city;this.bodies=[];this.nextBodyId=1;this.corpseRevision=0;this.art=[];this.nextArtId=1;this.artRevision=0;this.artFactId=1;this.cases=[];this.nextCaseId=1;this.policeOrders=[];this.nextPoliceOrderId=1;this.protests=[];this.nextProtestId=1;this.lastWorksDay=null;this.lastMinute=null;this.lastArtReactionMinute=null;this.penalCodeRevision=0;this.policies={cleanRecord:false,parliamentaryImmunity:false,popularJurySize:this.popularJuryBounds().minimum,penalCode:Object.fromEntries(Object.entries(BASE_PENAL_CODE).map(([id,rule])=>[id,{...rule,fineOnly:false,politicalDisqualification:false,cleanRecordDisqualifying:false,recidivismSeverityBonus:0,cassation:true,cassationTrigger:'arrest'}]))};}
  ensureState(){
    this.bodies??=[];this.art??=[];this.cases??=[];this.policeOrders??=[];this.protests??=[];this.corpseRevision??=0;this.artRevision??=0;this.artFactId??=1;this.penalCodeRevision??=0;
    this.nextBodyId=Math.max(this.nextBodyId||1,this.bodies.reduce((n,b)=>Math.max(n,b.id+1),1));this.nextArtId=Math.max(this.nextArtId||1,this.art.reduce((n,a)=>Math.max(n,a.id+1),1));this.nextCaseId=Math.max(this.nextCaseId||1,this.cases.reduce((n,c)=>Math.max(n,c.id+1),1));this.nextPoliceOrderId=Math.max(this.nextPoliceOrderId||1,this.policeOrders.reduce((n,o)=>Math.max(n,o.id+1),1));this.nextProtestId=Math.max(this.nextProtestId||1,this.protests.reduce((n,p)=>Math.max(n,p.id+1),1));
    this.policies??={};this.policies.cleanRecord??=false;this.policies.parliamentaryImmunity??=false;this.policies.popularJurySize??=this.popularJuryBounds().minimum;this.policies.penalCode??={};
    for(const [type,base]of Object.entries(BASE_PENAL_CODE)){const defaults={...base,fineOnly:false,politicalDisqualification:false,cleanRecordDisqualifying:false,recidivismSeverityBonus:0,cassation:true,cassationTrigger:'arrest'};this.policies.penalCode[type]??={...defaults};for(const [key,value]of Object.entries(defaults))this.policies.penalCode[type][key]??=value;}
    for(const record of this.cases){record.rule??={};if(record.rule.cassationTrigger==null)record.rule.cassationTrigger='arrest';if(record.originalRule?.cassationTrigger==null&&record.originalRule)record.originalRule.cassationTrigger='arrest';}
    for(const piece of this.art){piece.layers??=[];piece.seenBy??={};piece.damaged??=0;piece.nextLayerId=Math.max(piece.nextLayerId||1,[...piece.layers,...(piece.removedLayers||[])].reduce((n,l)=>Math.max(n,l.id+1),1));}
    if(this.artKnowledgePrivacyRevision!==1){
      const factIds=new Set(),artEventIds=new Set();for(const piece of this.art)for(const layer of [piece,...(piece.layers||[]),...(piece.removedLayers||[])]){if(layer.socialFactId!=null)factIds.add(layer.socialFactId);if(layer.eventId!=null)artEventIds.add(layer.eventId);}
      for(const entry of new Set([...(this.city.history?.entries||[]),...(this.city.events||[])])){
        if(['art-installed','art-defaced'].includes(entry.kind)){delete entry.truth;if(entry.data)delete entry.data.truth;}
        if(entry.kind==='rumor-heard'&&factIds.has(entry.socialFactId)){delete entry.objectiveTruth;if(entry.data)delete entry.data.objectiveTruth;}
      }
      for(const id of factIds){const fact=this.city.relationships?.facts?.get(id);if(fact?.kind==='public-art'&&fact.truth!=null)this.city.relationships.facts.set(id,{...fact,truth:null});}
      for(const c of this.city.citizens||[]){
        if(c.social?.memories)for(let i=0;i<c.social.memories.length;i++){const memory=c.social.memories[i];if(memory.kind==='public-art'&&memory.truth!=null)c.social.memories[i]=Object.freeze({...memory,truth:null});}
        if(c.political?.memories)for(let i=0;i<c.political.memories.length;i++){const memory=c.political.memories[i];if(memory.kind==='observer-opinion'&&memory.description?.startsWith('Viu arte urbana sobre ')&&memory.truth!=null)c.political.memories[i]=Object.freeze({...memory,truth:null});}
      }
      this.artKnowledgePrivacyRevision=1;
    }
    return this;
  }
  registerDeath(c,event){
    if(c.custodyWaterDelivery){const trip=c.custodyWaterDelivery,jail=this.city.building(trip.jailId),record=this.cases.find(r=>r.id===trip.caseId),prisoner=this.city.society.citizen(record?.chargedCitizenId??record?.investigation?.suspectId);if(prisoner?.custody)prisoner.custody.waterStatus='awaiting-water-worker';if(trip.carrying)this.city.history.record('service','A água transportada foi perdida quando o funcionário morreu durante a entrega.',[c.accountId,jail?.accountId].filter(Boolean),{kind:'prison-water-lost',buildingId:jail?.id,quantity:trip.water});c.custodyWaterDelivery=null;}
    const city=this.city,vehicleId=c.ridingVehicleId||null,vehicle=vehicleId?city.vehicles?.units.get(vehicleId):null,point=c.indoorLocation?.position||(vehicle?{x:vehicle.x,y:vehicle.y,z:c.skybridgeZ||0}:c.entity),entity=city.createEntity({x:point.x,y:point.y,properties:{name:`Corpo de ${event.name}`,cityCorpse:true}});
    const body={id:this.nextBodyId++,citizenId:c.id,name:event.name,age:event.age,diedAt:event.minute,cause:event.cause,position:{...point},currentVehicleId:vehicleId,originVehicleId:vehicleId,skybridgeZ:c.skybridgeZ||0,skybridgeId:c.skybridgeId||c.skybridgeTransit?.linkId||null,originSkybridge:c.skybridgeZ&&!c.indoorLocation?{linkId:c.skybridgeId||c.skybridgeTransit?.linkId||null,position:{...point,z:c.skybridgeZ}}:null,originInterior:c.indoorLocation?{buildingId:c.indoorLocation.buildingId,unitId:c.indoorLocation.unitId??null,floor:c.indoorLocation.floor??Math.floor((point.z||0)/CITY_FLOOR_HEIGHT),position:{...point}}:null,circumstances:event.circumstances?{...event.circumstances}:null,injuries:(event.injuries||[]).map(w=>({...w})),entity,status:'waiting',reportedAt:event.minute,imlBuildingId:null,crematoriumId:null,carrierId:null,path:[],autopsy:null,crematedAt:null};
    body.currentInterior=body.originInterior?{...body.originInterior,position:{...body.originInterior.position}}:null;body.currentSkybridge=body.originSkybridge?{...body.originSkybridge,position:{...body.originSkybridge.position}}:null;this.bodies.push(body);this.corpseRevision++;
    // A death while riding otherwise leaves the dead driver attached to a
    // moving vehicle forever, so the IML worker keeps waiting for it to stop.
    if(vehicle?.driverId===c.id)city.vehicles.releaseTrip(c);
    this.city.log(`O corpo de ${event.name} aguarda remoção pelo IML.`,'justice',[c.id],{kind:'body-awaiting-iml',bodyId:body.id,position:body.position,parentEventId:event.eventId});
    return body;
  }
  activeBuildings(type){return this.city.buildings.filter(b=>b.type===type&&b.active&&!b.entity.destroyed);}
  staffed(b){return (b.workers||[]).map(id=>this.city.society.citizen(id)).filter(c=>c&&!c.entity.destroyed&&c.jobId===b.id).length;}
  popularJuryBounds(){const population=(this.city.citizens||[]).filter(c=>!c.entity?.destroyed&&!c.dead).length||this.city.initialPopulation||0,minimum=Math.max(5,Math.ceil(population*.05)),maximum=Math.max(minimum,Math.floor(population*.15));return {minimum,maximum,population};}
  planFacilities(){
    const city=this.city,hour=Math.floor(city.minute/60);if(this.lastWorksPlanHour===hour)return;this.lastWorksPlanHour=hour;this.lastWorksDay=city.day;
    if(city.treasury<city.welfare.conditions().reserve+50000)return;
    city.politics.fundInitialWorksBudget();
    const baseline=new Set(['police_station','iml','jail','courthouse','crematorium','council_oversight_office']);
    for(const [type,needed]of [['police_station',baseline.has('police_station')||this.cases.some(c=>!['closed','dismissed','convicted','acquitted','decriminalized'].includes(c.status))],['council_oversight_office',baseline.has('council_oversight_office')||this.cases.some(c=>c.type==='investigationFraud'&&!['completed','inconclusive'].includes(c.externalReview?.status))],['iml',baseline.has('iml')||this.bodies.some(b=>['waiting','transporting','autopsy'].includes(b.status))],['jail',baseline.has('jail')||this.cases.some(c=>(['arrested','arrest-requested'].includes(c.status)||c.status==='convicted'&&c.sentence?.completedAt==null&&c.sentence?.suspendedAt==null)&&!c.rule.fineOnly)],['courthouse',baseline.has('courthouse')||this.cases.some(c=>['charged','trial','arrested'].includes(c.status))],['crematorium',baseline.has('crematorium')||this.bodies.some(b=>['cremation-wait','cremation-transporting','cremating'].includes(b.status))]]){
      if(!needed||(type==='jail'?this.activeBuildings(type).some(b=>this.jailOccupancy(b)<this.jailCapacity(b)):funeralSpec({type})?this.activeBuildings(type).some(b=>this.funeralOccupancy(b)<this.funeralCapacity(b)):this.activeBuildings(type).length)||city.development.projects.some(p=>p.type===type&&!p.cancelled&&p.status!=='completed'))continue;
      city.politics.startPublicWork(type);
    }
  }
  funeralCapacity(b){return Math.max(2,Math.floor((b.width||3)*(b.depth||3)*(b.floors||1)/3));}
  funeralOccupancy(b){return this.bodies.filter(body=>body.status!=='cremated'&&(body.locationBuildingId===b.id||(['transporting','cremation-transporting'].includes(body.status)&&body.destinationId===b.id)||(b.type==='iml'&&body.imlBuildingId===b.id&&['autopsy','cremation-wait'].includes(body.status))||(b.type==='crematorium'&&body.crematoriumId===b.id&&body.status==='cremating'))).length;}
  funeralWorkerWage(b,c,spec=funeralSpec(b)){return b.wage+this.city.currency.price(Math.floor((c.skills?.[spec?.skill]||0)/30));}
  canPayFuneralWorker(b,c,spec=funeralSpec(b)){return c.id===this.city.economy.mayorId||b.balance>=this.funeralWorkerWage(b,c,spec);}
  workFuneralProcedure(body,b){
    const city=this.city,spec=funeralSpec(b);if(!spec||!b.active||b.entity.destroyed){body.action='Aguardando instalação funerária disponível';return false;}
    if(body.lastProcedureMinute===city.minute)return false;
    const priorExaminerId=body.autopsyReview?.examinerId??body.autopsy?.examinerId,reviewConflicts=new Set(body.autopsyReview?.independenceExcludedIds||[]),worker=(b.workers||[]).map(id=>city.society.citizen(id)).find(c=>c&&c.forensicDisqualifiedAt==null&&(b.type!=='iml'||c.id!==priorExaminerId&&!reviewConflicts.has(c.id))&&!c.entity.destroyed&&c.jobId===b.id&&!c.funeralBodyId&&c.task==='work'&&c.indoorLocation?.buildingId===b.id&&!c.indoorLocation.path?.length&&!c.indoorLocation.exiting&&!c.path.length&&c.funeralProcedureMinute!==city.minute);
    if(!worker){body.action=body.autopsyReview?.physicalReviewStatus==='underway'?'Aguardando perito independente disponível e sem conflito de interesse no IML':'Aguardando funcionário presente para o procedimento';return false;}
    if(!this.canPayFuneralWorker(b,worker,spec)){body.action='Aguardando verba da instalação funerária para pagar o funcionário';return false;}
    if(b.type==='iml'){body.forensicExaminerId=worker.id;considerForensicBribe(this,body,worker);}
    body.procedureInputs??={};if(!body.procedureInputs[b.type]){
      if(Object.entries(spec.inputs).some(([good,n])=>(b.inventory?.[good]||0)<n)){body.action='Aguardando insumos do procedimento funerário';return false;}
      for(const [good,n]of Object.entries(spec.inputs)){b.inventory[good]-=n;city.economy.consumed[good]=(city.economy.consumed[good]||0)+n;city.economy.recordGoods('funeral-procedure',good,n,b.id,body.citizenId);}
      body.procedureInputs[b.type]={...spec.inputs};
    }
    if(b.type==='iml')body.autopsyStartedAt??=city.minute;
    worker.funeralProcedureMinute=city.minute;body.lastProcedureMinute=city.minute;const key=b.type==='iml'?'autopsyProgress':'cremationProgress';body[key]=(body[key]||0)+1;body.action=`${b.type==='iml'?'Autópsia':'Cremação'}: ${body[key]}/${spec.minutes} minutos de trabalho`;city.economy.practice(worker,spec.skill);if(body[key]<spec.minutes)return false;
    if(b.type==='iml')this.completeAutopsy(body,worker);else{body.status='cremated';body.crematedAt=city.minute;body.entity.destroyed=true;body.locationBuildingId=null;this.corpseRevision++;city.log(`A cremação de ${body.name} foi concluída.`,'justice',[body.citizenId],{kind:'cremation-completed',bodyId:body.id,buildingId:b.id});}return true;
  }
  beginTransport(body,destination,leg='iml'){
    const city=this.city;if(body.status!==(leg==='iml'?'waiting':'cremation-wait'))return false;if(this.funeralOccupancy(destination)>=this.funeralCapacity(destination)){body.action='Aguardando vaga no armazenamento funerário';return false;}if(body.currentVehicleId&&city.vehicles?.units.get(body.currentVehicleId)?.driverId){body.action='Aguardando o veículo parar para recolher o corpo';return false;}if(body.currentInterior===undefined&&body.originInterior&&!body.exitedInteriorAt)body.currentInterior={...body.originInterior,position:{...body.originInterior.position}};
    const source=body.currentInterior?city.building(body.currentInterior.buildingId):null;
    if(body.currentInterior&&(!source||source.entity.destroyed||interiorRoute(source,{...source.door,z:0},body.currentInterior.position)===null)){body.action='Coleta aguarda rota acessível ao interior';return false;}
    const availableWorkers=(destination.workers||[]).map(id=>city.society.citizen(id)).filter(c=>c&&!c.entity.destroyed&&c.jobId===destination.id&&injuredCarryCapacity(c,96)>=72&&!c.path.length&&(!c.indoorLocation||c.indoorLocation.buildingId===destination.id&&c.task==='work'&&!c.indoorLocation.path?.length&&!c.indoorLocation.exiting)&&!c.skybridgeZ&&!c.skybridgeTransit&&!c.funeralBodyId&&!c.deliveryId&&!c.cleaningJobId&&!c.informalJobId&&!c.workMeal&&!c.conversation&&!c.paintWorkId&&!c.mechanicJob&&!c.custody&&!c.mobilityTrip&&!c.ridingVehicleId&&!city.urgentNeed?.(c)),spec=funeralSpec(destination),worker=availableWorkers.find(c=>this.canPayFuneralWorker(destination,c,spec));if(!worker){if(availableWorkers.length)body.action='Aguardando verba da instalação funerária para pagar a equipe';return false;}
    let bridgeSource=null;
    if(!source&&body.skybridgeZ){const links=city.skybridgeLinksForRevision?.()||[],position=body.currentSkybridge?.position||body.entity,link=links.find(item=>item.id===(body.skybridgeId||body.currentSkybridge?.linkId||body.originSkybridge?.linkId))||links.find(item=>Math.abs(item.height-body.skybridgeZ)<.2&&(item.axis==='x'?Math.abs(position.y-item.start.y)<.12&&position.x>=Math.min(item.start.x,item.end.x)-.1&&position.x<=Math.max(item.start.x,item.end.x)+.1:Math.abs(position.x-item.start.x)<.12&&position.y>=Math.min(item.start.y,item.end.y)-.1&&position.y<=Math.max(item.start.y,item.end.y)+.1));if(!link){body.action='Coleta aguarda passarela acessível';return false;}body.skybridgeId=link.id;body.currentSkybridge??={linkId:link.id,position:{x:position.x,y:position.y,z:body.skybridgeZ}};
      const workerExitPoint=worker.indoorLocation?destination.door:worker.entity;bridgeSource=[{buildingId:link.aId,unitId:link.auId,endpoint:'start',point:link.start},{buildingId:link.bId,unitId:link.buId,endpoint:'end',point:link.end}].map(option=>{const building=city.building(option.buildingId),unit=building?.units?.find(u=>u.id===option.unitId),path=building&&unit?city.findPath(workerExitPoint,building.door,{allowSkybridges:false}):null,position=body.currentSkybridge?.position||body.entity,axis=link.axis,onSpan=axis==='x'?Math.abs(position.y-option.point.y)<.12&&position.x>=Math.min(link.start.x,link.end.x)-.1&&position.x<=Math.max(link.start.x,link.end.x)+.1:Math.abs(position.x-option.point.x)<.12&&position.y>=Math.min(link.start.y,link.end.y)-.1&&position.y<=Math.max(link.start.y,link.end.y)+.1;return {...option,building,unit,path,onSpan,score:path?.length??Infinity};}).filter(option=>option.building&&!option.building.entity.destroyed&&option.unit&&option.path!==null&&option.onSpan&&interiorRoute(option.building,{...option.building.door,z:0},{x:option.building.entity.x+option.unit.x+.5,y:option.building.entity.y+option.unit.y+.5,z:option.unit.z*CITY_FLOOR_HEIGHT})!==null).sort((a,b)=>a.score-b.score)[0]||null;
      if(!bridgeSource){body.action='Coleta aguarda rota acessível até a passarela';return false;}
      body.bridgeSource={buildingId:bridgeSource.buildingId,unitId:bridgeSource.unitId,endpoint:bridgeSource.endpoint,linkId:link.id};
    }
    const collectionPoint=source?.door||bridgeSource?.building?.door||(body.currentVehicleId&&city.vehicles?.units.get(body.currentVehicleId))||body.entity;
    const vehicle=[...(city.vehicles?.units.values()||[])].find(v=>v.id!==body.currentVehicleId&&v.active&&!v.scrapped&&v.good==='bicicleta_carga'&&v.condition>15&&!v.driverId&&!v.mechanicId&&!v.paintJobId&&!v.serviceBodyId&&[destination.accountId,worker.accountId].includes(v.possessorAccountId||v.ownerAccountId));
    if(!vehicle){body.action='Aguardando bicicleta de carga disponível para coleta';return false;}
    const workerExitPoint=worker.indoorLocation?destination.door:worker.entity;if(city.findPath(workerExitPoint,collectionPoint,{allowSkybridges:false})===null||city.findPath(collectionPoint,destination.door,{allowSkybridges:false})===null){body.action='Sem rota acessível para coleta e entrega';return false;}
    body.status=leg==='iml'?'transporting':'cremation-transporting';body.transportLeg=leg;body.transportPhase='collect';body.pickedUp=false;body.carrierId=worker.id;body.vehicleId=vehicle.id;body.destinationId=destination.id;body.lastTransportInterruption=null;body.nextCollectionAttemptAt=0;if(leg==='iml')body.imlBuildingId=destination.id;else body.crematoriumId=destination.id;
    vehicle.serviceBodyId=body.id;worker.funeralBodyId=body.id;worker.task='funeral';worker.targetId=null;worker.path=[];worker.funeralTripStarted=false;if(worker.indoorLocation){const from={...worker.indoorLocation.position},path=this.funeralInteriorRoute(destination,from,{...destination.door,z:0});if(path===null){this.cancelBodyTransport(body,'Funcionário sem rota interna para sair da instalação');return false;}worker.funeralInterior=true;worker.indoorLocation.path=path;worker.indoorLocation.unitId=null;worker.indoorLocation.targetUnitId=null;worker.indoorLocation.roomType='circulation';worker.indoorLocation.targetRoomType='funeral';worker.indoorLocation.phase='walking';body.transportPhase='work-exit';body.action='Funcionário saindo da instalação antes da coleta';}else body.action='Funcionário a caminho para recolher o corpo';return true;
  }
  cancelBodyTransport(body,reason){
    const city=this.city,c=city.society.citizen(body.carrierId),v=city.vehicles?.units.get(body.vehicleId),interruption={minute:city.minute,reason,leg:body.transportLeg||null,phase:body.transportPhase||null,carrierId:body.carrierId??null,pickedUp:!!body.pickedUp};if(c&&c.funeralBodyId===body.id){if(body.pickedUp)this.syncCarriedBody(body,c);if(c.mobilityTrip||c.ridingVehicleId)city.vehicles.releaseTrip(c);c.funeralBodyId=null;c.funeralInterior=false;c.funeralTripStarted=false;if(c.skybridgeTransit){c.action='Transporte funerário interrompido durante travessia; saindo pela rota física';}else if(c.skybridgeZ>0){this.routeWorkerOffSkybridge(c);}else{c.task=null;c.path=[];c.targetId=null;}}
    if(v?.serviceBodyId===body.id)v.serviceBodyId=null;body.status=body.transportLeg==='crematorium'?'cremation-wait':'waiting';body.carrierId=null;body.vehicleId=null;body.transportPhase=null;body.pickedUp=false;if(!body.currentInterior&&!body.skybridgeZ)body.bridgeSource=null;body.lastTransportInterruption={...interruption,position:{x:body.entity.x,y:body.entity.y},interior:body.currentInterior?structuredClone(body.currentInterior):null,skybridgeZ:body.skybridgeZ||0};body.nextCollectionAttemptAt=Math.max(body.nextCollectionAttemptAt||0,city.minute+5+body.id%5);body.action=reason;this.corpseRevision++;
  }
  routeWorkerOffSkybridge(c){
    const city=this.city,link=(city.skybridgeLinksForRevision?.()||[]).find(item=>item.id===c.skybridgeId);if(!link){c.task=null;c.path=[];c.targetId=null;c.action='Aguardando uma conexão acessível para sair da passarela';return false;}
    const endpoints=[{buildingId:link.aId,unitId:link.auId,endpoint:'start',point:link.start},{buildingId:link.bId,unitId:link.buId,endpoint:'end',point:link.end}],target=endpoints.sort((a,b)=>Math.hypot(c.entity.x-a.point.x,c.entity.y-a.point.y)-Math.hypot(c.entity.x-b.point.x,c.entity.y-b.point.y))[0];
    c.path=[{x:target.point.x,y:target.point.y,z:link.height,skybridgeId:link.id},{x:target.point.x,y:target.point.y,z:link.height,skybridgeExit:{buildingId:target.buildingId,unitId:target.unitId,linkId:link.id,endpoint:target.endpoint,interrupted:true}}];c.task='walk';c.targetId=target.buildingId;c.action='Saindo da passarela pela conexão mais próxima';return true;
  }
  syncCarriedBody(body,c){
    const point=c.indoorLocation?.position||c.entity;body.entity.x=point.x;body.entity.y=point.y;body.currentInterior=c.indoorLocation?{buildingId:c.indoorLocation.buildingId,unitId:c.indoorLocation.unitId,floor:c.indoorLocation.floor,position:{...point}}:null;body.skybridgeZ=c.indoorLocation?0:c.skybridgeZ||0;body.skybridgeId=body.skybridgeZ?(c.skybridgeId||body.skybridgeId):null;body.currentSkybridge=body.skybridgeZ?{linkId:body.skybridgeId,position:{x:point.x,y:point.y,z:body.skybridgeZ}}:null;this.corpseRevision++;
  }
  funeralInteriorRoute(building,from,to){const path=interiorRoute(building,from,to);if(path===null)return null;const last=path.at(-1);if(!last||Math.hypot(last.x-to.x,last.y-to.y,(last.z||0)-(to.z||0))>.01)path.push({...to});return path;}
  advanceFuneralInterior(c,body){
    const city=this.city,location=c.indoorLocation,building=city.building(location?.buildingId);if(!location){this.cancelBodyTransport(body,'Acesso interno indisponível durante coleta');return;}
    if(!building||building.entity.destroyed){
      const position=location.position||c.entity;c.entity.x=position.x;c.entity.y=position.y;
      if(body.pickedUp){this.syncCarriedBody(body,c);c.indoorLocation=null;c.funeralInterior=false;body.currentInterior=null;body.skybridgeZ=0;body.currentSkybridge=null;body.transportPhase='delivery';body.exitedInteriorAt=city.minute;c.funeralTripStarted=false;body.action='Imóvel demolido durante a retirada; funcionário e corpo saíram entre os escombros';return;}
      if(body.currentInterior){body.entity.x=body.currentInterior.position.x;body.entity.y=body.currentInterior.position.y;body.currentInterior=null;body.locationBuildingId=null;}
      this.cancelBodyTransport(body,'Imóvel demolido durante a retirada; corpo aguardando nova coleta entre os escombros');c.indoorLocation=null;c.funeralInterior=false;return;
    }
    if(body.pickedUp)this.syncCarriedBody(body,c);if(location.path.length)return;
    if(body.transportPhase==='work-exit'){c.entity.x=location.position.x;c.entity.y=location.position.y;c.indoorLocation=null;c.funeralInterior=false;body.transportPhase='collect';c.funeralTripStarted=false;body.action='Funcionário deixou a instalação e iniciou a coleta';return;}
    if(body.transportPhase==='interior-collect'){
      const target=body.currentInterior.position;if(Math.hypot(location.position.x-target.x,location.position.y-target.y,(location.position.z||0)-(target.z||0))>.15){this.cancelBodyTransport(body,'Rota não alcançou a posição interna do corpo');return;}
      const path=this.funeralInteriorRoute(building,location.position,{...building.door,z:0});if(path===null){this.cancelBodyTransport(body,'Sem rota de saída para o corpo');return;}
      body.pickedUp=true;body.locationBuildingId=null;body.transportPhase='interior-exit';location.path=path;location.unitId=null;location.targetUnitId=null;location.roomType='circulation';location.targetRoomType='funeral';body.action='Funcionário retirando o corpo pelo acesso interno';return;
    }
    this.syncCarriedBody(body,c);body.currentInterior=null;body.skybridgeZ=0;body.exitedInteriorAt=city.minute;c.entity.x=location.position.x;c.entity.y=location.position.y;c.indoorLocation=null;c.funeralInterior=false;body.transportPhase='delivery';c.funeralTripStarted=false;body.action='Corpo na saída, aguardando embarque na bicicleta';
  }
  updateFuneralWorker(c){
    const city=this.city,body=this.bodies.find(b=>b.id===c.funeralBodyId),destination=city.building(body?.destinationId),v=city.vehicles?.units.get(body?.vehicleId);
    if(!body||!destination?.active||destination.entity.destroyed||c.jobId!==destination.id||!v?.active||v.scrapped||v.condition<=15||city.urgentNeed?.(c)){if(body)this.cancelBodyTransport(body,'Transporte interrompido; aguardando nova equipe');else c.funeralBodyId=null;return;}
    if(c.funeralPaidAt!==city.minute){const paid=city.payWage?.(c,destination)??false;c.funeralPaidAt=city.minute;if(!paid){this.cancelBodyTransport(body,'Transporte interrompido por falta de verba salarial da instalação funerária');return false;}}
    if(c.skybridgeTransit){if(body.pickedUp)this.syncCarriedBody(body,c);if(body.transportPhase==='bridge-collect-enter'&&c.skybridgeTransit.phase==='crossing'){
        const link=(city.skybridgeLinksForRevision?.()||[]).find(item=>item.id===body.bridgeSource?.linkId);if(!link){this.cancelBodyTransport(body,'Passarela removida durante a coleta');return;}
        const position=body.currentSkybridge?.position||body.entity;c.path=[{x:position.x,y:position.y,z:link.height,skybridgeId:link.id}];c.skybridgeTransit=null;body.transportPhase='bridge-pickup';body.action='Funcionário atravessando a passarela para alcançar o corpo';
      }return;}
    if(body.transportPhase==='bridge-pickup'){
      if(!body.pickedUp&&!c.path.length&&dist(c.entity,body.entity)<.2&&Math.abs((c.skybridgeZ||0)-body.skybridgeZ)<.2){body.pickedUp=true;body.locationBuildingId=null;body.transportPhase='bridge-return';body.action='Funcionário recolheu o corpo na passarela';const link=(city.skybridgeLinksForRevision?.()||[]).find(item=>item.id===body.bridgeSource?.linkId),endpoint=body.bridgeSource?.endpoint;if(!link){this.cancelBodyTransport(body,'Passarela removida durante a coleta');return;}const point=endpoint==='end'?link.end:link.start;c.path=[{x:point.x,y:point.y,z:link.height,skybridgeId:link.id},{x:point.x,y:point.y,z:link.height,skybridgeExit:{buildingId:body.bridgeSource.buildingId,unitId:body.bridgeSource.unitId,linkId:link.id,endpoint}}];c.targetId=body.bridgeSource.buildingId;}
      if(body.pickedUp)this.syncCarriedBody(body,c);return;
    }
    if(body.transportPhase==='bridge-return'&&!c.indoorLocation&&!c.skybridgeTransit&&(c.skybridgeZ||0)<=0){if(body.pickedUp)this.syncCarriedBody(body,c);body.currentInterior=null;body.currentSkybridge=null;body.skybridgeZ=0;body.skybridgeId=null;body.bridgeSource=null;body.transportPhase='delivery';body.exitedInteriorAt=city.minute;c.funeralTripStarted=false;c.path=[];c.action='Corpo na saída da passarela, aguardando embarque na bicicleta';return;}
    if(c.funeralInterior){this.advanceFuneralInterior(c,body);return;}
    if(c.indoorLocation||c.mobilityTrip||c.ridingVehicleId)return;
    if(body.currentVehicleId&&city.vehicles?.units.get(body.currentVehicleId)?.driverId){const moving=city.vehicles.units.get(body.currentVehicleId);body.entity.x=moving.x;body.entity.y=moving.y;this.cancelBodyTransport(body,'O veículo voltou a circular; a coleta será retomada quando parar');return;}
    const source=body.currentInterior?city.building(body.currentInterior.buildingId):body.bridgeSource?city.building(body.bridgeSource.buildingId):null,goal=body.transportPhase==='collect'?(source?.door||body.entity):destination.door;
    if(!c.funeralTripStarted){if(!city.vehicles.startServiceTrip(c,v,goal)){this.cancelBodyTransport(body,'Não foi possível iniciar a viagem funerária');return;}c.funeralTripStarted=true;return;}
    if(c.path.length)return;
    if(dist(c.entity,goal)>1.3){const path=city.findPath(c.entity,goal);if(path===null){this.cancelBodyTransport(body,'Rota funerária interrompida');return;}c.path=path;return;}
    if(body.transportPhase==='collect'){
      if(body.currentVehicleId){body.currentVehicleId=null;body.vehicleReleasedAt=city.minute;body.locationBuildingId=null;body.pickedUp=true;body.transportPhase='delivery';this.syncCarriedBody(body,c);c.funeralTripStarted=false;body.action='Funcionário retirou o corpo do veículo';return;}
      if(body.currentInterior){
        if(!source||source.entity.destroyed){this.cancelBodyTransport(body,'Imóvel de coleta indisponível');return;}
        const from={...source.door,z:0},path=this.funeralInteriorRoute(source,from,body.currentInterior.position);if(path===null){this.cancelBodyTransport(body,'Sem rota interna até o corpo');return;}
        c.entity.x=source.door.x;c.entity.y=source.door.y;c.funeralInterior=true;c.indoorLocation={buildingId:source.id,unitId:null,targetUnitId:body.currentInterior.unitId,floor:0,position:from,path,targetRoomType:'funeral',roomType:'circulation',phase:'walking',task:'funeral',layoutRevision:source.layoutRevision||0};body.transportPhase='interior-collect';body.action='Funcionário entrando para recolher o corpo';return;
      }
      if(body.bridgeSource){const bridge=city.skybridgeLinksForRevision?.().find(item=>item.id===body.bridgeSource.linkId);if(!bridge||!city.beginSkybridgeTransit?.(c,{buildingId:body.bridgeSource.buildingId,unitId:body.bridgeSource.unitId,linkId:bridge.id,endpoint:body.bridgeSource.endpoint,phase:'entry'})){this.cancelBodyTransport(body,'Não foi possível acessar a passarela para recolher o corpo');return;}body.transportPhase='bridge-collect-enter';body.action='Funcionário entrando no prédio para acessar a passarela';return;}
      body.pickedUp=true;body.locationBuildingId=null;body.transportPhase='delivery';c.funeralTripStarted=false;body.action='Corpo sendo transportado pelo funcionário';return;}
    body.entity.x=c.entity.x;body.entity.y=c.entity.y;body.arrivedAt=city.minute;body.locationBuildingId=destination.id;body.carrierId=null;body.pickedUp=false;v.serviceBodyId=null;c.funeralBodyId=null;c.funeralTripStarted=false;c.task=null;c.path=[];c.targetId=null;
    if(body.transportLeg==='iml'){body.status='autopsy';body.autopsyEndsAt=city.minute+90;body.action='Aguardando autópsia';if(body.autopsyReview?.physicalReviewStatus==='awaiting-return-to-iml'){body.autopsyReview.physicalReviewStatus='underway';body.autopsyProgress=0;body.procedureInputs??={};delete body.procedureInputs.iml;body.lastProcedureMinute=null;body.action='Segunda perícia independente iniciada no IML';}}else{body.status='cremating';body.cremationEndsAt=city.minute+120;body.action='No crematório';}
    city.log(`O corpo de ${body.name} chegou ${body.transportLeg==='iml'?'ao IML':'ao crematório'} conduzido pelo funcionário.`,'justice',[body.citizenId,c.id],{kind:body.transportLeg==='iml'?'body-arrived-iml':'cremation-started',bodyId:body.id,buildingId:destination.id,vehicleId:v.id});this.corpseRevision++;
  }
  decayBody(body){
    if(body.status==='cremated')return;
    if(body.currentInterior===undefined&&body.originInterior&&!body.exitedInteriorAt&&['waiting','transporting'].includes(body.status)){body.currentInterior={...body.originInterior,position:{...body.originInterior.position}};body.entity.x=body.currentInterior.position.x;body.entity.y=body.currentInterior.position.y;}
    if(!Number.isFinite(body.diedAt))body.diedAt=this.city.minute;const elapsed=Math.max(0,this.city.minute-body.diedAt);body.decomposition=Math.min(100,Math.max(Number.isFinite(body.decomposition)?body.decomposition:0,elapsed/(7*1440)*100));body.evidenceIntegrity=Math.max(.2,1-body.decomposition*.008);
  }
  updateCorpseExposure(){
    const city=this.city;if(city.minute%30!==0||this.lastCorpseExposureMinute===city.minute)return;this.lastCorpseExposureMinute=city.minute;
    const buckets=new Map(),key=(scene,x,y)=>`${scene.buildingId??'street'}:${scene.unitId??'-'}:${scene.floor??'-'}:${Math.round(scene.height||0)}:${x}:${y}`;
    for(const c of city.citizens){if(c.entity.destroyed)continue;if(c.corpseExposure)c.corpseExposure=0;const p=this.observationPosition(c),scene=this.observationScene(c),id=key(scene,Math.floor(p.x/3),Math.floor(p.y/3));let rows=buckets.get(id);if(!rows)buckets.set(id,rows=[]);rows.push(c);}
    const exposed=new Map();
    for(const body of this.bodies){
      if(body.status==='cremated'||body.currentVehicleId||body.locationBuildingId!=null&&!body.currentInterior)continue;
      this.decayBody(body);const strength=Math.max(0,((body.decomposition||0)-7)/93);if(!strength)continue;
      const scene=body.currentInterior?{buildingId:body.currentInterior.buildingId,unitId:body.currentInterior.unitId??null,floor:body.currentInterior.floor,height:0}:{buildingId:null,unitId:null,floor:null,height:body.skybridgeZ||0},x=Math.floor(body.entity.x/3),y=Math.floor(body.entity.y/3);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)for(const c of buckets.get(key(scene,x+dx,y+dy))||[]){const distance=dist(this.observationPosition(c),body.entity);if(distance>3)continue;exposed.set(c,Math.min(1,(exposed.get(c)||0)+strength*(1-distance/4)));}
    }
    for(const [c,hazard]of exposed){c.corpseExposure=Math.round(hazard*100);c.lastCorpseExposureAt=city.minute;c.needs.hygiene=Math.max(0,c.needs.hygiene-hazard*.6);if(c.needs.hygiene<20)c.needs.health=Math.max(0,c.needs.health-hazard*.03);c.mood=Math.max(-25,(c.mood||0)-hazard*.15);}
  }
  updateBody(body){
    const city=this.city;this.decayBody(body);
    if(body.status==='waiting'){
      const occupiedVehicle=body.currentVehicleId&&city.vehicles?.units.get(body.currentVehicleId);if(occupiedVehicle?.active&&!occupiedVehicle.scrapped){body.entity.x=occupiedVehicle.x;body.entity.y=occupiedVehicle.y;if(occupiedVehicle.driverId){body.action='Aguardando o veículo parar para recolher o corpo';this.corpseRevision++;return;}}
      if(city.minute<(body.nextCollectionAttemptAt||0))return;
      const sites=this.activeBuildings('iml').filter(b=>this.staffed(b)>0).sort((a,b)=>dist(a.door,body.entity)-dist(b.door,body.entity));
      for(const site of sites)if(this.beginTransport(body,site))return;
      body.nextCollectionAttemptAt=city.minute+5+body.id%5;return;
    }
    if(['transporting','cremation-transporting'].includes(body.status)){
      const c=city.society.citizen(body.carrierId);if(!c||c.entity.destroyed||c.funeralBodyId!==body.id){this.cancelBodyTransport(body,'Funcionário indisponível; corpo aguarda nova coleta');return;}
      if(body.pickedUp)this.syncCarriedBody(body,c);return;
    }
    if(body.status==='autopsy'){this.workFuneralProcedure(body,city.building(body.imlBuildingId));return;}
    if(body.status==='cremation-wait'){
      if(city.minute<(body.nextCollectionAttemptAt||0))return;
      const sites=this.activeBuildings('crematorium').filter(b=>this.staffed(b)>0).sort((a,b)=>dist(a.door,body.entity)-dist(b.door,body.entity));
      for(const site of sites)if(this.beginTransport(body,site,'crematorium'))return;
      body.nextCollectionAttemptAt=city.minute+5+body.id%5;return;
    }
    if(body.status==='cremating'){this.workFuneralProcedure(body,city.building(body.crematoriumId));return;}
  }
  completeAutopsy(body,examiner){
    if(body.autopsy&&body.autopsyReview?.physicalReviewStatus==='underway')return this.completeSecondOpinionAutopsy(body,examiner);
    if(body.autopsy)return body.autopsy;
    const city=this.city,skill=Math.min(1,Math.max(0,(examiner.skills?.forensics||0)/100))*this.skillFactor(examiner,'forensics'),delay=Math.max(0,city.minute-body.diedAt),deterioration=Math.min(.65,body.decomposition!=null?body.decomposition/100*.65:delay/(7*1440)),violent=body.circumstances?.kind==='violence',trauma=(body.injuries||[]).filter(w=>w.severity>=3),suspicious=violent||trauma.some(w=>w.region==='cabeça'&&w.severity>=5),uncertainty=Math.round(15+(1-skill)*105+deterioration*180),estimate=Math.min(city.minute,Math.max(0,body.diedAt+Math.round((city.random()*2-1)*uncertainty))),cause=suspicious?'Traumatismo com indícios de violência':body.cause;
    const findings=trauma.map(w=>({region:w.region,severity:w.severity})),honestReport={cause,estimatedDeathMinute:estimate,deathWindow:{from:Math.max(0,estimate-uncertainty),to:Math.min(city.minute,estimate+uncertainty)},confidence:Math.max(.1,.55+skill*.4-deterioration),suspicious,findings};
    let official={...honestReport};
    if(body.forensicBribe?.status==='paid'&&body.forensicBribe.examinerId===examiner.id){
      body.forensicObserverRecord={...honestReport,examinerId:examiner.id,recordedAt:city.minute,bribeEventId:body.forensicBribe.eventId};
      const falsifiedEstimate=Math.min(city.minute,estimate+Math.max(30,uncertainty*2));
      official={...honestReport,cause:body.cause||'Causa não determinada',estimatedDeathMinute:falsifiedEstimate,deathWindow:{from:Math.max(0,falsifiedEstimate-uncertainty),to:Math.min(city.minute,falsifiedEstimate+uncertainty)},confidence:Math.max(.1,honestReport.confidence-.25),suspicious:false,findings:[]};
      body.forensicBribe.reportAlteredAt=city.minute;body.forensicBribe.effect='violence-omitted-and-time-shifted';
    }
    body.autopsy={completedAt:city.minute,...official,examinerId:examiner.id};
    if(body.autopsy.suspicious){
      let record=this.cases.find(r=>r.id===body.circumstances?.caseId&&r.victimId===body.citizenId)||this.cases.find(r=>r.type==='murder'&&r.victimId===body.citizenId&&Math.abs(r.occurredAt-body.diedAt)<=1);
      if(!record)record=this.crimeRecord('murder',null,body.citizenId,{position:{...body.position},bodyId:body.id,source:'autopsy'},{observe:false,occurredAt:body.diedAt});
      if(record){body.criminalCaseId=record.id;body.autopsy.caseId=record.id;if(!record.evidence.some(e=>e.kind==='autopsy'&&e.bodyId===body.id))record.evidence.push({kind:'autopsy',bodyId:body.id,examinerId:examiner.id,recordedAt:city.minute,cause,confidence:body.autopsy.confidence,deathWindow:{...body.autopsy.deathWindow}});if(['unreported','no-suspect'].includes(record.status)){record.status='reported';record.reportedAt=city.minute;record.reportSource='iml';if(record.investigation?.status==='inconclusive')record.investigation=null;}}
    }
    const source=this.cases.find(record=>record.id===body.criminalCaseId);if(source?.status==='no-suspect'&&source.investigation?.finishedAt!=null){const audit=source.investigation.financialAudit;if(audit&&['completed','inconclusive'].includes(audit.status)){audit.autopsyRefreshBodyIds??=[];if(!audit.autopsyRefreshBodyIds.includes(body.id)){audit.autopsyRefreshBodyIds.push(body.id);audit.status='waiting';audit.progress=0;audit.reopenedAt=city.minute;audit.waitingReason='nova autópsia vinculada ao caso; reanálise de transferências aguardando auditor';audit.completedAt=null;}}}
    body.status='cremation-wait';body.action='Aguardando cremação';const report=body.autopsy,reportedUncertainty=Math.max(report.estimatedDeathMinute-report.deathWindow.from,report.deathWindow.to-report.estimatedDeathMinute);city.log(`Autópsia de ${body.name}: ${report.cause}; horário estimado ${report.estimatedDeathMinute} (margem de ${reportedUncertainty} minutos).`,'justice',[body.citizenId,examiner.id],{kind:'autopsy-completed',bodyId:body.id,caseId:body.criminalCaseId??null,cause:report.cause,estimatedDeathMinute:report.estimatedDeathMinute,uncertainty:reportedUncertainty,suspicious:report.suspicious});return body.autopsy;
  }
  completeSecondOpinionAutopsy(body,examiner){
    const previous=structuredClone(body.autopsy),review=body.autopsyReview;review.firstReport??=previous;body.autopsy=null;this.completeAutopsy(body,examiner);const report=body.autopsy,city=this.city;
    review.physicalReviewStatus='completed';review.completedAt=city.minute;review.reviewerId=examiner.id;review.secondReport=structuredClone(report);
    const source=this.cases.find(record=>record.id===body.criminalCaseId),briberyCase=this.cases.find(record=>record.id===review.briberyCaseId),evidence={kind:'forensic-review-result',bodyId:body.id,briberyCaseId:review.briberyCaseId,sourceCaseId:source?.id??null,examinerId:examiner.id,recordedAt:city.minute,cause:report.cause,confidence:report.confidence,deathWindow:{...report.deathWindow},findings:report.findings.map(item=>({...item})),suspicious:report.suspicious,independent:true};
    for(const record of [source,briberyCase].filter(Boolean)){record.evidence??=[];if(!record.evidence.some(item=>item.kind==='forensic-review-result'&&item.bodyId===body.id&&item.examinerId===examiner.id))record.evidence.push({...evidence});}
    if(briberyCase?.details){briberyCase.details.physicalReviewStatus='completed';briberyCase.details.physicalReviewCompletedAt=city.minute;briberyCase.details.physicalReviewExaminerId=examiner.id;}
    if(source?.details?.forensicReviewPendingBodyId===body.id){delete source.details.forensicReviewPendingBodyId;source.details.forensicReviewCompletedBodyId=body.id;}
    city.log(`Uma segunda perícia presencial do corpo de ${body.name} foi concluída por ${examiner.entity.properties.name}, sem participação do perito condenado.`,'justice',[body.citizenId,examiner.id].filter(Number.isInteger),{kind:'forensic-second-opinion-completed',bodyId:body.id,caseId:body.criminalCaseId??null,briberyCaseId:review.briberyCaseId,firstExaminerId:review.examinerId,reviewerId:examiner.id,independentReport:report});this.corpseRevision++;return report;
  }
  requestForensicSecondOpinion(body,briberyCaseId){
    const city=this.city;if(!body)return false;body.autopsyReview??={openedAt:city.minute,briberyCaseId,examinerId:body.autopsy?.examinerId,officialReport:body.autopsy?structuredClone(body.autopsy):null};const review=body.autopsyReview;review.briberyCaseId=briberyCaseId;review.requestedAt??=city.minute;
    if(body.status==='cremated'||body.crematedAt!=null){review.physicalReviewStatus='impossible-cremated';review.impossibleAt=city.minute;return false;}
    if(['completed','underway','awaiting-return-to-iml'].includes(review.physicalReviewStatus))return true;
    if(body.status==='cremation-transporting')this.cancelBodyTransport(body,'Transporte ao crematório interrompido para segunda perícia independente');
    if(body.status==='cremating'){body.status='waiting';body.action='Cremação suspensa para segunda perícia independente';}
    const iml=city.building(body.imlBuildingId);
    if(body.status==='cremation-wait'&&iml?.active&&!iml.entity.destroyed&&body.locationBuildingId===iml.id){body.status='autopsy';body.action='Segunda perícia independente solicitada';review.physicalReviewStatus='underway';body.autopsyProgress=0;body.procedureInputs??={};delete body.procedureInputs.iml;body.lastProcedureMinute=null;}
    else{body.status='waiting';body.action='Aguardando transporte de retorno ao IML para segunda perícia';review.physicalReviewStatus='awaiting-return-to-iml';review.returnRequestedAt=city.minute;body.nextCollectionAttemptAt=city.minute;}
    city.log(`A cremação do corpo de ${body.name} foi suspensa para uma segunda perícia independente após a condenação do perito.`,'justice',[body.citizenId].filter(Number.isInteger),{kind:'forensic-second-opinion-requested',bodyId:body.id,caseId:body.criminalCaseId??null,briberyCaseId});this.corpseRevision++;return true;
  }
  updateMinute(){if(this.lastMinute===this.city.minute)return;this.lastMinute=this.city.minute;this.planFacilities();this.updateProtests();this.updatePolicePatrols();for(const body of this.bodies)if(body.status!=='cremated')this.updateBody(body);this.updateCorpseExposure();this.dispatchReports();this.updateInvestigations();this.dispatchExternalPoliceReviews();this.updateCourtCases();dispatchPoliceAudits(this);this.updateRestitutionMissions();this.updateVehicleRecognition();this.updatePropertyFencing();this.updateSkybridgeArtSupport();for(const citizen of this.city.citizens)if(citizen.inventoryProvenance?.length)reconcileStolenInventory(citizen);if(this.city.minute%30===0)this.reactToArt();}
  updateSkybridgeArtSupport(){
    const pieces=this.art.filter(piece=>!piece.entity.destroyed&&piece.support?.kind==='skybridge');if(!pieces.length)return;const links=new Set((this.city.skybridgeLinksForRevision?.()||[]).map(link=>link.id));
    for(const piece of pieces)if(!links.has(piece.support.linkId)){piece.entity.destroyed=true;piece.destroyedAt=this.city.minute;piece.destroyedBy=null;piece.debris={artId:piece.id,x:piece.entity.x,y:piece.entity.y,createdAt:this.city.minute,reason:'support-removed'};piece.damageHistory??=[];piece.damageHistory.push({minute:this.city.minute,actorId:null,damage:100-(piece.damaged||0),kind:'support-removed',caseId:null});this.city.log(`${this.labelArt(piece.kind)} #${piece.id} caiu quando a passarela que a sustentava foi removida.`,'justice',[piece.creatorId].filter(Number.isInteger),{kind:'art-destroyed-with-support',artId:piece.id,linkId:piece.support.linkId});this.artRevision++;}
  }
  policeShift(hour=this.city.hour){if(hour>=8&&hour<17)return'day';if(hour>=20||hour<5)return'night';return null;}
  policeShiftActive(){return this.policeShift()!=null;}
  updatePoliceAudit(c){return updatePoliceAudit(this,c);}
  dispatchExternalPoliceReviews(){
    const city=this.city;if(this.lastExternalReviewMinute===city.minute)return;this.lastExternalReviewMinute=city.minute;
    const occupied=new Set(this.cases.filter(record=>record.externalReview?.status==='active').map(record=>record.externalReview.officeId));
    for(const record of this.cases){
      if(record.type!=='investigationFraud'||['completed','inconclusive'].includes(record.externalReview?.status))continue;
      const review=record.externalReview??={status:'waiting',progress:0,required:90,createdAt:city.minute,reviewedCaseId:record.details?.reviewedCaseId};
      const source=this.cases.find(item=>item.id===review.reviewedCaseId),conflicts=new Set([
        record.details?.investigatorUnderReviewId,record.statement?.reporterId,record.chargedCitizenId,
        source?.victimId,source?.chargedCitizenId,source?.offenderId,source?.investigation?.officerId,
        source?.investigation?.suspectId,source?.investigation?.defenderId,source?.trial?.judgeId,
        source?.trial?.defenderId,
      ].filter(Number.isInteger));
      for(const witness of source?.witnesses||[])if(Number.isInteger(witness.citizenId))conflicts.add(witness.citizenId);
      for(const interview of source?.investigation?.interviewEvidence||[])if(Number.isInteger(interview.witnessId))conflicts.add(interview.witnessId);
      for(const entry of record.evidence||[])if(entry.kind==='investigation-record'&&entry.sourceCaseId===source?.id){if(Number.isInteger(entry.submittedBy))conflicts.add(entry.submittedBy);for(const interview of entry.originalInterviewEvidence||[])if(Number.isInteger(interview.witnessId))conflicts.add(interview.witnessId);}
      for(const item of source?.evidence||[])if(Number.isInteger(item.discoveredBy))conflicts.add(item.discoveredBy);
      const current=city.society.citizen(review.reviewerId);
      if(review.status==='active'&&current&&!conflicts.has(current.id)&&!current.entity.destroyed&&current.policeOversight?.caseId===record.id&&!city.politics.officeHolder(current))continue;
      if(current?.policeOversight?.caseId===record.id){current.policeOversight=null;if(current.task==='police-oversight')current.task='work';}
      review.status='waiting';let assignment;
      for(const office of this.activeBuildings('council_oversight_office')){
        if(occupied.has(office.id))continue;
        const officer=(office.workers||[]).map(id=>city.society.citizen(id)).filter(c=>c&&!conflicts.has(c.id)&&!city.politics.officeHolder(c)&&!c.entity.destroyed&&!c.custody&&!c.workMeal&&!c.conversation&&!c.mobilityTrip&&c.jobId===office.id&&c.task==='work'&&c.indoorLocation?.buildingId===office.id&&!c.indoorLocation.path?.length&&!c.path.length&&!c.policeOversight&&!c.policeAudit&&!c.policeInvestigation&&!c.policePatrol&&!c.policeResponse&&!c.custodyEscort&&!city.urgentNeed?.(c)).sort((a,b)=>(b.skills?.law||0)-(a.skills?.law||0))[0];
        if(officer){assignment={office,officer};break;}
      }
      if(!assignment){review.waitingReason=this.activeBuildings('council_oversight_office').length?'aguardando auditor sem conflito disponível':'aguardando instalação da comissão de fiscalização';continue;}
      const {office,officer}=assignment;review.status='active';review.officeId=office.id;review.reviewerId=officer.id;review.startedAt??=city.minute;review.waitingReason=null;occupied.add(office.id);officer.policeOversight={caseId:record.id,officeId:office.id};officer.task='police-oversight';officer.targetId=office.id;officer.action=`Revisando independentemente a apuração #${record.id}`;
    }
  }
  updatePoliceOversight(officer){
    const city=this.city,mission=officer.policeOversight,record=this.cases.find(item=>item.id===mission?.caseId),review=record?.externalReview,office=city.building(review?.officeId);if(!mission)return false;if(!review||review.status!=='active'){officer.policeOversight=null;officer.task='work';return false;}
    if(officer.entity.destroyed||officer.custody||officer.workMeal||officer.conversation||city.politics.officeHolder(officer)||!office?.active||office.entity.destroyed||officer.jobId!==office.id||officer.indoorLocation?.buildingId!==office.id||officer.indoorLocation.path?.length||officer.path.length||city.urgentNeed?.(officer)||(officer.unconsciousUntil||0)>city.minute){review.status='waiting';review.waitingReason='revisão pausada: auditor indisponível ou em conflito';officer.policeOversight=null;officer.task='work';return false;}
    if(review.lastWorkedMinute===city.minute)return true;review.lastWorkedMinute=city.minute;if(!city.payWage(officer,office)){review.status='waiting';review.waitingReason='aguardando salário público da comissão';officer.policeOversight=null;officer.task='work';return false;}review.waitingReason=null;review.progress++;if(review.progress<review.required)return true;
    const source=this.cases.find(item=>item.id===review.reviewedCaseId),submittedRecord=(record.evidence||[]).find(item=>item.kind==='investigation-record'&&item.sourceCaseId===source?.id),contradictions=(record.evidence||[]).filter(item=>item.kind==='investigation-record'&&item.sourceCaseId===source?.id).flatMap(item=>item.contradictions||[]),investigation=source?.investigation||source?.pastInvestigations?.at(-1),originalInterviews=submittedRecord?.originalInterviewEvidence||investigation?.interviewEvidence||[],reported=new Set(submittedRecord?.officialReportedInterviewIndexes||(investigation?.reportedInterviews||[]).map(item=>item.sourceInterviewIndex)),officialSuspectId=submittedRecord?.officialSuspectId??investigation?.suspectId,verified=[];
    for(const discrepancy of contradictions){
      if(discrepancy.contradictionKind==='investigator-concealment'){
        const statement=originalInterviews[discrepancy.sourceInterviewIndex];
        if(statement&&!reported.has(discrepancy.sourceInterviewIndex)&&statement.identifiedSuspectId===discrepancy.originalSuspectId&&statement.identifiedSuspectId!==officialSuspectId)verified.push({...discrepancy,independentSourceInterview:structuredClone(statement)});
        continue;
      }
      if(discrepancy.contradictionKind==='investigator-fabrication'){
        const official=submittedRecord?.recordedEvidence?.find(item=>item.sourceCaseEvidenceIndex===discrepancy.sourceEvidenceIndex),witness=submittedRecord?.originalWitnesses?.find(item=>item.citizenId===discrepancy.witnessId),captured=originalInterviews.some(item=>item.witnessId===discrepancy.witnessId&&Number.isInteger(item.sourceEventId));
        if(official?.kind==='police-interview'&&official.sourceInterviewEventId===null&&official.witnessId===discrepancy.witnessId&&official.identifiedSuspectId===discrepancy.recordedSuspectId&&witness?.interviewStatus==='declined'&&!captured&&witness.identifiedSuspectId===discrepancy.originalSuspectId&&witness.identifiedSuspectId!==official.identifiedSuspectId)verified.push({...discrepancy,independentSourceInterview:{witnessId:witness.citizenId,declined:true,identifiedSuspectId:witness.identifiedSuspectId,officialInterviewEventMissing:true}});
        continue;
      }
      if(source?.evidence?.some(item=>item.kind==='defense-contradiction'&&item.contradictionKind===discrepancy.contradictionKind&&item.witnessId===discrepancy.witnessId&&item.originalSuspectId===discrepancy.originalSuspectId&&item.recordedSuspectId===discrepancy.recordedSuspectId))verified.push({...discrepancy});
    }
    review.completedAt=city.minute;review.verifiedDiscrepancies=verified.length;review.status=verified.length?'completed':'inconclusive';review.report={reviewerId:officer.id,reviewedCaseId:source?.id??null,recordedAt:city.minute,verifiedDiscrepancies:structuredClone(verified),conclusion:verified.length?'divergências confirmadas nos registros de origem; responsabilidade depende de investigação e julgamento':'não foi possível confirmar divergência nos registros disponíveis'};
    if(verified.length){record.evidence.push({kind:'external-review',reviewerId:officer.id,sourceCaseId:source.id,recordedAt:city.minute,confidence:Math.min(.95,.65+(officer.skills?.law||0)/400),verifiedDiscrepancies:structuredClone(verified)});source.details??={};source.details.externalReviewCaseIds??=[];if(!source.details.externalReviewCaseIds.includes(record.id))source.details.externalReviewCaseIds.push(record.id);}
    officer.policeOversight=null;officer.task='work';officer.action='Concluiu revisão independente de procedimento policial';city.log(`A Comissão de Fiscalização da Câmara ${verified.length?'confirmou divergências documentais':'não confirmou divergências nos registros disponíveis'} no caso de fraude policial #${record.id}; a decisão sobre responsabilidade cabe à Justiça.`,'justice',[officer.id].filter(Number.isInteger),{kind:'external-police-review-completed',caseId:record.id,reviewedCaseId:source?.id??null,verifiedDiscrepancies:verified.length,buildingId:office.id});return true;
  }
  policeOnDuty(c){return !!c?.policePatrol&&!c.entity.destroyed&&!c.custody&&(c.unconsciousUntil||0)<=this.city.minute;}
  updatePolicePatrols(){
    const city=this.city,shift=this.policeShift(),onShift=shift!=null;
    for(const station of this.activeBuildings('police_station')){
      let officer=city.society.citizen(station.patrolOfficerId);
      if(!officer||officer.entity.destroyed||officer.jobId!==station.id||!officer.policePatrol){station.patrolOfficerId=null;officer=null;}
      if(officer&&!officer.policeResponse&&onShift){
        const queued=this.cases.filter(r=>r.response?.stationId===station.id&&r.response.status==='awaiting-officer').sort((a,b)=>b.severity-a.severity||a.occurredAt-b.occurredAt)[0];
        if(queued){this.dispatchPoliceResponse(queued,officer);continue;}
      }
      const pendingCase=this.cases.some(r=>r.reportingStationId===station.id&&['reporting','reported','investigating'].includes(r.status)||r.investigation?.financialAudit?.status==='waiting'),queuedResponse=this.cases.some(r=>r.response?.stationId===station.id&&r.response.status==='awaiting-officer'),activeStaff=this.staffed(station);
      if(officer){if(!officer.policeResponse&&(!onShift||pendingCase&&activeStaff<=1))officer.policePatrol.phase='return';continue;}
      if(!onShift||pendingCase&&activeStaff<=1&&!queuedResponse)continue;
      station.policeShiftAssignments??={day:city.day,dayOfficerId:null,nightOfficerId:null};
      if(station.policeShiftAssignments.day!==city.day)station.policeShiftAssignments={day:city.day,dayOfficerId:null,nightOfficerId:null};
      const otherShiftOfficerId=station.policeShiftAssignments[shift==='day'?'nightOfficerId':'dayOfficerId'];
      if(shift==='night'&&activeStaff<2)continue;
      const activeInvestigators=new Set(this.cases.filter(r=>r.status==='investigating'&&r.investigation?.status==='active').map(r=>r.investigation.officerId));
      officer=(station.workers||[]).map(id=>city.society.citizen(id)).find(c=>c&&c.id!==otherShiftOfficerId&&!c.entity.destroyed&&c.jobId===station.id&&c.task==='work'&&c.indoorLocation?.buildingId===station.id&&!c.indoorLocation.path?.length&&!c.path.length&&!c.custody&&!c.custodyEscort&&!c.mobilityTrip&&!c.ridingVehicleId&&!c.conversation&&!c.funeralBodyId&&!c.deliveryId&&!c.cleaningJobId&&!c.paintWorkId&&!c.policeAudit&&!activeInvestigators.has(c.id)&&!city.urgentNeed?.(c));
      if(!officer)continue;
      station.patrolOfficerId=officer.id;officer.policePatrol={stationId:station.id,phase:'exit',startedAt:city.minute,waypointIndex:(officer.id+station.id)%8,waitUntil:0,lastPaidMinute:null};officer.task='police-patrol';officer.targetId=null;officer.path=[];officer.action='Iniciando patrulhamento a pé';
      station.policeShiftAssignments[shift==='day'?'dayOfficerId':'nightOfficerId']=officer.id;officer.policePatrol.shift=shift;this.considerMunicipalPoliceOrder(station,officer);
      city.log(`${officer.entity.properties.name} saiu da delegacia para patrulhar a região.`, 'justice',[officer.id],{kind:'police-patrol-started',buildingId:station.id});
    }
  }
  municipalPolicePressure(mayor){
    if(!mayor)return 0;const ideology=mayor.political?.ideology?.liberty??0,loyalty=mayor.political?.loyalty??0,party=mayor.political?.partyId,partyControl=this.city.politics?.party?.(party)?.ideology?.liberty??0;
    return Math.max(0,Math.min(1,.5-ideology*.28-(mayor.traits?.empathy??.5)*.16-(mayor.traits?.honesty??.5)*.12-partyControl*.12+loyalty*.08));
  }
  activeProtests(){return this.protests.filter(p=>p.status==='active'&&p.endsAt>this.city.minute);}
  updateProtests(){for(const protest of this.protests)if(protest.status==='active'&&this.city.minute>=protest.endsAt){protest.status='ended';protest.closedAt=this.city.minute;protest.reason='participantes dispersaram ao fim do ato';this.city.log(`O protesto #${protest.id} terminou sem intervenção policial.`,'justice',protest.participantIds,{kind:'protest-ended',protestId:protest.id,artId:protest.artId,position:{...protest.position}});}}
  disperseProtest(protest){
    const city=this.city,dirs=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]],dispersed=[];
    for(const id of protest.participantIds){const c=city.society.citizen(id);if(!c||c.entity.destroyed||c.custody||c.indoorLocation||c.mobilityTrip||c.ridingVehicleId||c.policePatrol||c.policeResponse||c.policeInvestigation||c.deliveryId||city.urgentNeed?.(c)||dist(c.entity,protest.position)>4)continue;
      for(let step=0;step<dirs.length;step++){const [dx,dy]=dirs[(step+id)%dirs.length],destination={x:Math.floor(protest.position.x+dx*6)+.5,y:Math.floor(protest.position.y+dy*6)+.5},path=city.findPath(c.entity,destination);if(path===null||!path.length)continue;c.path=path;c.targetId=null;c.task='walk';c.action='Saindo de protesto após repressão policial';dispersed.push(c.id);break;}
    }
    protest.dispersedParticipantIds=dispersed;return dispersed.length;
  }
  considerMunicipalPoliceOrder(station,officer){
    const city=this.city,mayor=city.society.citizen(city.economy.mayorId),pressure=this.municipalPolicePressure(mayor);if(!mayor||pressure<.58||city.minute-(station.lastPoliticalOrderAt??-Infinity)<1440)return null;
    const protestTarget=pressure>=.68?this.activeProtests().filter(p=>p.participantIds.length>=2).map(protest=>({protest,target:protest.participantIds.map(id=>city.society.citizen(id)).filter(c=>c&&!c.entity.destroyed&&!c.custody&&!c.indoorLocation&&c.needs?.health>25&&dist(c.entity,protest.position)<=4).sort((a,b)=>dist(officer.entity,a.entity)-dist(officer.entity,b.entity))[0]})).filter(x=>x.target&&dist(officer.entity,x.protest.position)<18&&city.findPath(officer.entity,x.target.entity)!==null).sort((a,b)=>dist(officer.entity,a.protest.position)-dist(officer.entity,b.protest.position))[0]:null;
    const artTarget=!protestTarget?this.art.filter(piece=>!piece.entity.destroyed&&piece.partyId!=null&&piece.partyId!==mayor.political?.partyId&&['banner','painting','flags','graffiti'].includes(piece.kind)).map(piece=>({piece,path:city.findPath(officer.entity,piece.entity)})).filter(x=>x.path!==null&&dist(officer.entity,x.piece.entity)<18).sort((a,b)=>dist(officer.entity,a.piece.entity)-dist(officer.entity,b.piece.entity))[0]:null;
    const oppositionTarget=pressure>=.82&&!artTarget?city.citizens.filter(c=>c.id!==officer.id&&c.id!==mayor.id&&!c.entity.destroyed&&!c.indoorLocation&&!c.custody&&c.needs?.health>35&&city.society.isAdult(c)&&c.political?.partyId!=null&&c.political.partyId!==mayor.political?.partyId&&dist(officer.entity,c.entity)<10&&city.findPath(officer.entity,c.entity)!==null).sort((a,b)=>dist(officer.entity,a.entity)-dist(officer.entity,b.entity))[0]:null;
    const illegalTarget=pressure>=.94&&this.policies.penalCode.illegalArrest?.criminal!==false&&!protestTarget&&!artTarget?city.citizens.filter(c=>c.id!==officer.id&&c.id!==mayor.id&&!c.entity.destroyed&&!c.indoorLocation&&!c.custody&&c.needs?.health>35&&city.society.isAdult(c)&&c.political?.partyId!=null&&c.political.partyId!==mayor.political?.partyId&&!this.cases.some(r=>r.investigation?.suspectId===c.id&&!['closed','dismissed','acquitted','decriminalized'].includes(r.status))&&dist(officer.entity,c.entity)<10&&city.findPath(officer.entity,c.entity)!==null).sort((a,b)=>dist(officer.entity,a.entity)-dist(officer.entity,b.entity))[0]:null;
    const executionTarget=pressure>=.995&&!protestTarget&&!artTarget?oppositionTarget:null;
    const target=protestTarget?{kind:'protest',protest:protestTarget.protest,citizen:protestTarget.target}:artTarget?{kind:'art',piece:artTarget.piece}:executionTarget?{kind:'execution',citizen:executionTarget}:illegalTarget?{kind:'detain',citizen:illegalTarget}:oppositionTarget?{kind:'person',citizen:oppositionTarget}:null;if(!target)return null;
    const chance=target.kind==='art'?Math.min(.18,(pressure-.5)*.32):target.kind==='protest'?Math.min(.22,(pressure-.6)*.5):target.kind==='detain'?Math.min(.015,Math.max(.001,(pressure-.93)*.12)):target.kind==='execution'?Math.min(.015,Math.max(.0001,(pressure-.995)*30)):Math.min(.05,Math.max(.005,(pressure-.78)*.25));if(city.random()>chance)return null;
    station.lastPoliticalOrderAt=city.minute;const order={id:this.nextPoliceOrderId++,minute:city.minute,mayorId:mayor.id,stationId:station.id,officerId:officer.id,artId:target.piece?.id??target.protest?.artId??null,targetId:target.citizen?.id??null,protestId:target.protest?.id??null,action:target.kind==='art'?'damage-opposition-art':target.kind==='protest'?'repress-protest':target.kind==='detain'?'illegal-arrest-opposition':target.kind==='execution'?'execute-opposition':'assault-opposition',status:'issued',pressure};this.policeOrders.push(order);if(target.kind==='protest')target.protest.repressionOrderId=order.id;if(this.policeOrders.length>256)this.policeOrders.shift();
    const partyLoyalty=officer.political?.partyId===mayor.political?.partyId ? 0.14 : 0,obedience=Math.max(.08,Math.min(.92,.3+pressure*.32+partyLoyalty-(officer.traits?.honesty??.5)*.28));
    const subject=target.kind==='art'?`a obra #${order.artId}`:target.kind==='protest'?`o protesto #${target.protest.id}`:`a pessoa ${target.citizen.entity.properties.name}`;
    if(city.random()>obedience){order.status='refused';order.decidedAt=city.minute;order.reason='agente recusou a ordem';city.log(`${officer.entity.properties.name} recusou ordem municipal abusiva contra ${subject}.`,'justice',[officer.id,mayor.id].concat(target.citizen?[target.citizen.id]:[]),{kind:'police-order-refused',orderId:order.id,artId:order.artId,targetId:order.targetId,protestId:order.protestId,buildingId:station.id});return order;}
    if((officer.traits?.honesty??.5)>.78&&city.random()<.35){order.status='reported';order.decidedAt=city.minute;order.reason='agente comunicou a ordem';city.log(`${officer.entity.properties.name} comunicou ordem municipal abusiva contra ${subject} antes de executá-la.`,'justice',[officer.id,mayor.id].concat(target.citizen?[target.citizen.id]:[]),{kind:'police-order-reported',orderId:order.id,artId:order.artId,targetId:order.targetId,protestId:order.protestId,buildingId:station.id});return order;}
    officer.policeOrder={orderId:order.id,artId:order.artId,targetId:order.targetId,protestId:order.protestId,targetKind:target.kind,phase:'travel',lastPaidMinute:null};officer.action=target.kind==='art'?'Recebeu ordem municipal para danificar arte de oposição':target.kind==='protest'?'Recebeu ordem municipal para reprimir protesto':target.kind==='detain'?'Recebeu ordem municipal para deter opositor sem mandado':target.kind==='execution'?'Recebeu ordem municipal para executar um opositor':'Recebeu ordem municipal para agredir opositor';order.status='accepted';order.acceptedAt=city.minute;
    const position=target.kind==='art'?target.piece.entity:target.kind==='protest'?target.protest.position:target.citizen.entity;city.log(`A prefeitura enviou uma ordem abusiva à delegacia contra ${subject}.`,'justice',[mayor.id,officer.id].concat(target.citizen?[target.citizen.id]:[]),{kind:'police-order-issued',orderId:order.id,artId:order.artId,targetId:order.targetId,protestId:order.protestId,buildingId:station.id,position:{x:position.x,y:position.y}});return order;
  }
  executeIllegalDetention(officer,target,order){
    const city=this.city,station=city.building(order.stationId),place=this.custodyPlace(target);if(!place.jail){order.status='blocked';order.decidedAt=city.minute;order.reason=place.reason==='awaiting-jail-space'?'sem vaga para a detenção ilegal':place.reason==='unreachable'?'sem rota até a cadeia':'cadeia sem equipe disponível';return false;}
    const protectedMember=!!(this.policies.parliamentaryImmunity&&city.politics.council.members.some(m=>m.citizenId===target.id)),record=this.crimeRecord('illegalArrest',officer.id,target.id,{position:{x:target.entity.x,y:target.entity.y},scene:this.observationScene(target),municipalOrderId:order.id,orderedByMayorId:order.mayorId,detentionWithoutWarrant:true,parliamentaryImmunityBypassed:protectedMember,source:'municipal-order'});if(!record){order.status='failed';order.decidedAt=city.minute;order.reason='prisão ilegal não está tipificada como crime no código vigente';return false;}
    record.status='reported';record.reportedAt=city.minute;record.reportSource='official-order-register';record.reportingStationId=station?.id??null;record.details.detainedAt=city.minute;record.details.detentionJailId=place.jail.id;record.evidence.push({kind:'municipal-order',orderId:order.id,mayorId:order.mayorId,officerId:officer.id,targetId:target.id,recordedAt:city.minute,source:'official-order-register',parliamentaryImmunityBypassed:protectedMember});
    const path=place.path;
    target.custody={caseId:record.id,jailId:place.jail.id,cellUnitId:place.cellUnitId,status:'in-transit',arriveBy:city.minute+Math.max(60,path.length*8),releaseAt:city.minute+360,illegalDetention:true,orderedByMayorId:order.mayorId,arrestingOfficerId:officer.id,detentionOrderId:order.id};target.task='custody';target.path=path;target.targetId=place.jail.id;target.action='Detido ilegalmente por ordem municipal';
    record.details.detentionStatus='in-transit';record.details.releaseAt=target.custody.releaseAt;return record;
  }
  updatePolicePoliticalOrder(officer){
    const city=this.city,mission=officer.policeOrder,order=this.policeOrders.find(o=>o.id===mission?.orderId),piece=this.art.find(a=>a.id===mission?.artId&&!a.entity.destroyed),protest=this.protests.find(p=>p.id===mission?.protestId&&p.status==='active'),target=city.society.citizen(mission?.targetId),destination=mission?.targetKind==='art'?piece?.entity:target?.entity;if(!mission||!order)return false;
    const station=city.building(order.stationId);if(!station||officer.jobId!==station.id||officer.entity.destroyed||city.urgentNeed?.(officer)){order.status='interrupted';order.decidedAt=city.minute;order.reason=!station?'delegacia indisponível':'diligência interrompida';officer.policeOrder=null;officer.path=[];officer.action='Ordem municipal interrompida';return false;}
    if(mission.lastPaidMinute!==city.minute){if(!city.payWage(officer,station))officer.action='Ordem municipal aguardando pagamento do turno';mission.lastPaidMinute=city.minute;}
    if(!destination||mission.targetKind!=='art'&&(!target||target.entity.destroyed||target.custody)||mission.targetKind==='protest'&&!protest){order.status='target-missing';order.decidedAt=city.minute;order.reason=mission.targetKind==='art'?'obra removida antes da chegada':mission.targetKind==='protest'?'protesto encerrado antes da chegada':'pessoa não está mais acessível';officer.policeOrder=null;return false;}
    if(officer.indoorLocation||officer.path.length)return true;
    if(dist(officer.entity,destination)>1.4){const path=city.findPath(officer.entity,destination);if(path===null){order.status='blocked';order.decidedAt=city.minute;order.reason='sem rota acessível ao alvo';officer.action='Ordem municipal sem rota acessível';officer.policeOrder=null;officer.policePatrol.phase='patrol';return false;}officer.path=path;officer.action=mission.targetKind==='art'?'A caminho da obra indicada pela ordem municipal':mission.targetKind==='protest'?'A caminho do protesto indicado pela prefeitura':'Perseguindo opositor por ordem municipal';mission.phase='travel';return true;}
    let executed=false,records=[];if(mission.targetKind==='art'){executed=this.damageArtwork(piece.id,15+city.random()*10,officer.id);const record=piece.damageHistory?.at(-1)?.caseId?this.cases.find(c=>c.id===piece.damageHistory.at(-1).caseId):null;if(record)records.push(record);}else if(mission.targetKind==='detain'){const record=this.executeIllegalDetention(officer,target,order);executed=!!record;if(record)records.push(record);}else{const before=this.cases.length;executed=!!this.combatEncounter(officer,target,{forced:true,lethalIntent:mission.targetKind==='execution',municipalOrder:mission.targetKind==='execution'?order:null});records=this.cases.slice(before).filter(r=>r.offenderId===officer.id&&r.victimId===target.id);if(executed&&mission.targetKind==='protest'){protest.status='repressed';protest.closedAt=city.minute;protest.reason='dispersado por ordem municipal';this.disperseProtest(protest);}}
    for(const record of records){record.details.municipalOrderId=order.id;record.details.orderedByMayorId=order.mayorId;if(mission.targetKind==='protest')record.details.protestId=protest.id;record.evidence.push({kind:'municipal-order',orderId:order.id,mayorId:order.mayorId,officerId:officer.id,artId:order.artId??null,targetId:order.targetId??null,protestId:order.protestId??null,recordedAt:city.minute,source:'official-order-register'});}
    if(order.status!=='blocked'){order.status=executed?'executed':'failed';order.decidedAt=city.minute;order.reason=mission.targetKind==='art'?(executed?'obra danificada':'ato não foi concluído'):mission.targetKind==='protest'?(executed?'protesto reprimido com agressão registrada':'repressão não foi concluída'):mission.targetKind==='detain'?(executed?'opositor detido ilegalmente':'detenção não foi concluída'):mission.targetKind==='execution'?(target.dead?'opositor morto; homicídio registrado':executed?'tentativa de execução; alvo sobreviveu':'tentativa não foi concluída'):(executed?'opositor agredido':'agressão não foi concluída');}
    city.log(executed?`A polícia executou uma ordem municipal abusiva; os atos e a autoria foram registrados.`:`A polícia não conseguiu executar uma ordem municipal abusiva.`,'justice',[officer.id,order.mayorId].concat(target?[target.id]:[]),{kind:'police-order-executed',orderId:order.id,caseIds:records.map(r=>r.id),artId:order.artId??null,targetId:order.targetId??null,protestId:order.protestId??null,buildingId:station.id,position:{x:destination.x,y:destination.y}});
    officer.policeOrder=null;officer.policePatrol.phase='patrol';officer.task='police-patrol';return true;
  }
  policePatrolPoints(station){
    if(station.policePatrolPoints?.revision===this.city.structureRevision)return station.policePatrolPoints.points;
    const city=this.city,door=station.door,dirs=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]],points=[];
    for(const [index,[dx,dy]] of dirs.entries()){
      const distance=index%2?6:5,x=Math.floor(door.x+dx*distance),y=Math.floor(door.y+dy*distance),point={x:x+.5,y:y+.5};
      if(x<0||y<0||x>=city.world.width||y>=city.world.height||!city.walkable(x,y)||city.findPath(door,point)===null)continue;
      points.push(point);
    }
    station.policePatrolPoints={revision:city.structureRevision,points};return points;
  }
  stopPolicePatrol(c,reason='Patrulha encerrada'){
    const city=this.city,patrol=c.policePatrol,station=city.building(patrol?.stationId);if(station?.patrolOfficerId===c.id)station.patrolOfficerId=null;
    c.policePatrol=null;c.path=[];c.targetId=null;c.task=null;c.action=reason;return false;
  }
  updatePolicePatrol(c){
    const city=this.city,patrol=c.policePatrol,station=city.building(patrol?.stationId);if(!patrol)return false;
    if(c.policeResponse)return true;
    if(c.policeOrder)return this.updatePolicePoliticalOrder(c);
    if(!station?.active||station.entity.destroyed||c.jobId!==station.id||c.entity.destroyed)return this.stopPolicePatrol(c,'Patrulha interrompida: delegacia ou vínculo de trabalho indisponível');
    if(city.urgentNeed?.(c))return this.stopPolicePatrol(c,'Patrulha interrompida por uma necessidade urgente');
    if(patrol.phase==='patrol'&&city.minute%30===0){this.considerMunicipalPoliceOrder(station,c);if(c.policeOrder)return this.updatePolicePoliticalOrder(c);}
    if(patrol.lastPaidMinute!==city.minute){if(!city.payWage(c,station)){patrol.phase='return';c.action='Patrulha interrompida: aguardando salário municipal';}patrol.lastPaidMinute=city.minute;}
    if(c.indoorLocation){
      const room=c.indoorLocation;if(room.buildingId!==station.id)return this.stopPolicePatrol(c,'Patrulha interrompida: oficial está em outro prédio');
      if(!room.exiting){const path=interiorRoute(station,room.position||{x:c.entity.x,y:c.entity.y,z:0},{x:station.door.x,y:station.door.y,z:0});if(path===null){c.action='Patrulha aguardando rota de saída da delegacia';return false;}room.unitId=null;room.targetUnitId=null;room.roomType='circulation';room.targetRoomType='circulation';room.exiting=true;room.phase='leaving';room.path=path;room.task='police-patrol';c.action='Saindo da delegacia para patrulhar';return true;}
      if(room.path?.length)return true;
      c.action='Aguardando saída da delegacia';return false;
    }
    if(c.path.length)return true;
    if(patrol.phase==='exit')patrol.phase='patrol';
    if(patrol.phase==='return'){
      if(dist(c.entity,station.door)>1.2){const path=city.findPath(c.entity,station.door);if(path===null){c.action='Patrulha aguardando rota de retorno à delegacia';return false;}c.path=path;c.action='Retornando à delegacia';return true;}
      const officerId=c.id;this.stopPolicePatrol(c,'Retornou à delegacia');c.task='work';c.targetId=station.id;station.lastPatrolOfficerId=officerId;return true;
    }
    const points=this.policePatrolPoints(station);if(!points.length){c.action='Patrulha sem rota acessível neste turno';patrol.phase='return';return false;}
    if(patrol.waitUntil>city.minute){c.action='Patrulhando a pé';return true;}
    let point=points[patrol.waypointIndex%points.length];if(dist(c.entity,point)<=.8){patrol.waypointIndex=(patrol.waypointIndex+1)%points.length;patrol.waitUntil=city.minute+4;point=null;}
    if(!point){c.action='Observando a região durante a patrulha';return true;}
    const path=city.findPath(c.entity,point);if(path===null){patrol.waypointIndex=(patrol.waypointIndex+1)%points.length;c.action='Desviando de trecho sem acesso';return false;}
    c.path=path;if(!path.length){patrol.waypointIndex=(patrol.waypointIndex+1)%points.length;patrol.waitUntil=city.minute+4;}c.action='Patrulhando a pé';return true;
  }
  dispatchPoliceResponse(record,assignedOfficer=null){
    const city=this.city;if(!record?.position||record.scene?.buildingId!=null)return false;
    const witness=record.witnesses.find(w=>w.role==='police-officer'),observingOfficer=witness&&city.society.citizen(witness.citizenId),officer=assignedOfficer||observingOfficer,patrol=officer?.policePatrol,stationId=record.response?.stationId??patrol?.stationId;
    if(!officer||!patrol||officer.entity.destroyed||officer.custody)return false;
    const station=city.building(stationId);if(!station?.active||station.entity.destroyed)return false;
    if(officer.policeResponse){
      record.response={status:'awaiting-officer',officerId:null,stationId:station.id,queuedAt:record.response?.queuedAt??city.minute,phase:'queue'};return false;
    }
    record.response={status:'dispatched',officerId:officer.id,stationId:station.id,dispatchedAt:city.minute,phase:'scene',routeFailures:0};
    officer.policeResponse={caseId:record.id,stationId:station.id,phase:'scene',dispatchedAt:city.minute,lastPaidMinute:null,resumePatrolPhase:patrol.phase==='return'?'return':'patrol'};patrol.phase='respond';officer.task='police-response';officer.path=[];officer.targetId=null;officer.action=`Respondendo à ocorrência #${record.id}`;
    city.log(`A patrulha enviou ${officer.entity.properties.name} ao local da ocorrência #${record.id}.`,'justice',[officer.id],{kind:'police-response-dispatched',caseId:record.id,buildingId:station.id,position:{...record.position}});return true;
  }
  finishPoliceResponse(c,record,station,status='completed'){
    const city=this.city,response=record.response,mission=c.policeResponse;c.policeResponse=null;c.path=[];c.targetId=null;c.task='police-patrol';c.action=status==='completed'?'Registrou a ocorrência no local; retomando patrulha':'Resposta policial interrompida';
    response.status=status;response.completedAt=city.minute;response.phase='finished';if(status!=='completed')response.reason??='agente indisponível';
    if(c.policePatrol)c.policePatrol.phase=status==='completed'&&this.policeShiftActive()?(mission?.resumePatrolPhase==='return'?'return':'patrol'):'return';
    city.log(status==='completed'?`A patrulha registrou a ocorrência #${record.id} no local.`:`A resposta à ocorrência #${record.id} foi interrompida.`,'justice',[c.id],{kind:'police-response-finished',caseId:record.id,status,position:{x:c.entity.x,y:c.entity.y}});return true;
  }
  updatePoliceResponse(c){
    const city=this.city,mission=c.policeResponse,record=this.cases.find(r=>r.id===mission?.caseId),station=city.building(mission?.stationId);if(!mission||!record||!record.response)return false;
    if(!station?.active||station.entity.destroyed||c.jobId!==station.id||c.entity.destroyed){record.response.reason='delegacia ou agente indisponível';return this.finishPoliceResponse(c,record,station,'interrupted');}
    if(city.urgentNeed?.(c)){record.response.reason='necessidade urgente do agente';return this.finishPoliceResponse(c,record,station,'interrupted');}
    if(mission.lastPaidMinute!==city.minute){if(!city.payWage(c,station)){record.response.reason='falta de verba salarial';mission.phase='return';record.response.phase='return';}mission.lastPaidMinute=city.minute;}
    if(c.indoorLocation){record.response.reason='agente está dentro de um prédio';mission.phase='return';record.response.phase='return';return false;}
    if(c.path.length)return true;
    if(mission.phase==='scene'){
      const target=record.position;
      if(!target){record.response.reason='local da ocorrência desconhecido';mission.phase='return';record.response.phase='return';}
      else if(dist(c.entity,target)>1.2){const path=city.findPath(c.entity,target);if(path===null){mission.routeFailures=(mission.routeFailures||0)+1;record.response.reason='sem rota até a ocorrência';if(mission.routeFailures<3)return false;mission.phase='return';record.response.phase='return';}else{c.path=path;if(!path.length&&dist(c.entity,target)>.1)c.path=[{x:target.x,y:target.y}];c.action=`Indo ao local da ocorrência #${record.id}`;return true;}}
      else {
        const officerWitness=record.witnesses.find(w=>w.citizenId===c.id&&w.role==='police-officer');record.response.arrivedAt=city.minute;record.response.phase='report';record.response.sceneNotes=[{kind:'police-scene-response',officerId:c.id,position:{x:c.entity.x,y:c.entity.y},scene:{...record.scene},observedAt:city.minute}];
        record.evidence??=[];record.evidence.push({...record.response.sceneNotes[0],sourceEventId:record.eventId});
        if(record.status==='unreported'){record.status='reported';record.reportedAt=city.minute;record.reportSource='police-response';record.reportingStationId=station.id;record.statement={reporterId:c.id,description:'A patrulha chegou ao local após observar a ocorrência.',confidence:officerWitness?.confidence??.5};city.log(`A polícia registrou o BO #${record.id} após resposta no local.`,'justice',[c.id,record.victimId].filter(Number.isInteger),{kind:'crime-reported-by-police',caseId:record.id,buildingId:station.id});}
        return this.finishPoliceResponse(c,record,station,'completed');
      }
    }
    if(mission.phase==='return'){
      if(dist(c.entity,station.door)>1.2){const path=city.findPath(c.entity,station.door);if(path===null)return false;c.path=path;c.action='Retornando à delegacia após resposta';return true;}
      return this.finishPoliceResponse(c,record,station,record.response.reason?'interrupted':'completed');
    }
    return true;
  }
  startPoliceInvestigation(record,station,officer){
    const city=this.city,fieldwork=!!record.position&&typeof city.findPath==='function'&&(record.scene?.buildingId==null||!!city.building(record.scene.buildingId));
    record.investigation={officerId:officer.id,stationId:station.id,startedAt:city.minute,concludesAt:fieldwork?null:city.minute+180,status:'active',...(fieldwork?{fieldwork:true,phase:'exit',fieldNotes:[],interviewEvidence:[],witnessIndex:0,routeFailures:0}:{})};
    if(fieldwork){officer.policeInvestigation={caseId:record.id,stationId:station.id,phase:'exit',assignedAt:city.minute,lastPaidMinute:null};officer.task='police-investigation';officer.targetId=null;officer.path=[];officer.action=`Saindo para investigar o caso #${record.id}`;}
    record.status='investigating';city.log(fieldwork?`A polícia iniciou diligências presenciais no caso #${record.id}.`:`A polícia iniciou a análise documental do caso #${record.id}.`,'justice',[officer.id],{kind:fieldwork?'investigation-fieldwork-started':'investigation-started',caseId:record.id,buildingId:station.id});
  }
  finishPoliceInvestigation(c,record,station,result){
    const city=this.city,investigation=record.investigation;c.policeInvestigation=null;c.path=[];c.targetId=null;c.task='work';c.action=result==='completed'?'Diligência concluída; retornou à delegacia':'Diligência encerrada sem conclusão';
    if(station?.policeInvestigatorId===c.id)station.policeInvestigatorId=null;
    investigation.fieldworkResult=result;investigation.completedAt=city.minute;investigation.concludesAt=city.minute;investigation.phase='analysis';
    city.log(result==='completed'?`As diligências do caso #${record.id} foram entregues à delegacia.`:`As diligências do caso #${record.id} foram interrompidas: ${investigation.blockedReason||'agente indisponível'}.`,'justice',[c.id],{kind:'investigation-fieldwork-finished',caseId:record.id,result});return true;
  }
  enterInvestigationScene(c,record,building,mission){
    const city=this.city,unit=city.units.get(record.scene?.unitId),target={...(record.position||{}),z:unit?unit.z*CITY_FLOOR_HEIGHT:(record.scene?.floor||0)*CITY_FLOOR_HEIGHT};
    if(!building||!unit||unit.buildingId!==building.id){record.investigation.blockedReason='cômodo da cena não está disponível';mission.phase='return';record.investigation.phase='return';return false;}
    const from={x:building.door.x,y:building.door.y,z:0},path=interiorRoute(building,from,target);
    if(path===null){record.investigation.blockedReason='sem rota interna até a cena';mission.phase='return';record.investigation.phase='return';return false;}
    c.indoorLocation={buildingId:building.id,unitId:path.length?null:unit.id,targetUnitId:unit.id,targetRoomType:unit.roomType,roomType:path.length?'circulation':unit.roomType,floor:unit.z,position:from,path,phase:path.length?'walking':'using',task:'police-investigation',layoutRevision:building.layoutRevision||0,enteredAt:city.minute};
    mission.phase='scene';record.investigation.phase='scene';c.action=`Inspecionando o interior do caso #${record.id}`;return true;
  }
  leaveInvestigationInterior(c,building,mission,record,nextPhase='exit-scene'){
    const room=c.indoorLocation;if(!room)return false;
    const path=interiorRoute(building,room.position||{x:c.entity.x,y:c.entity.y,z:0},{x:building.door.x,y:building.door.y,z:0});
    if(path===null){record.investigation.blockedReason='sem rota interna para sair do prédio';return false;}
    room.unitId=null;room.targetUnitId=null;room.roomType='circulation';room.targetRoomType='circulation';room.exiting=true;room.phase='leaving';room.path=path;room.task='police-investigation';mission.phase=nextPhase;record.investigation.phase=nextPhase; c.action='Saindo do prédio após a diligência';return true;
  }
  beginVehicleInspection(c,record,mission,investigation){
    if(!['bicycleTheft','vehicleReceiving'].includes(record.type))return false;
    const vehicle=this.city.vehicles?.units.get(record.details?.vehicleId);
    if(!vehicle||vehicle.scrapped){investigation.vehicleInspection={status:'unavailable',startedAt:this.city.minute,vehicleId:record.details?.vehicleId??null,reason:'veículo não está disponível para inspeção'};investigation.fieldNotes.push({kind:'vehicle-inspection-unavailable',vehicleId:record.details?.vehicleId??null,recordedAt:this.city.minute,reason:investigation.vehicleInspection.reason});mission.phase='return';investigation.phase='return';return true;}
    mission.phase='vehicle-approach';mission.vehicleInspectionStartedAt=this.city.minute;mission.vehicleWaitSince=null;investigation.phase='vehicle-approach';investigation.vehicleInspection={status:'active',vehicleId:vehicle.id,startedAt:this.city.minute,waitLimit:180};c.action=`Indo verificar o veículo #${vehicle.id}`;return true;
  }
  updateVehicleInspection(c,record,mission,investigation){
    const city=this.city,vehicle=city.vehicles?.units.get(record.details?.vehicleId);
    if(!vehicle||vehicle.scrapped){investigation.vehicleInspection={...investigation.vehicleInspection,status:'unavailable',completedAt:city.minute,reason:'veículo deixou de estar disponível'};investigation.fieldNotes.push({kind:'vehicle-inspection-unavailable',vehicleId:record.details?.vehicleId??null,recordedAt:city.minute,reason:'veículo deixou de estar disponível'});mission.phase='return';investigation.phase='return';return true;}
    const driver=vehicle.driverId!=null?city.society.citizen(vehicle.driverId):null,occupied=!!driver&&!driver.entity.destroyed&&(driver.mobilityTrip?.vehicleId===vehicle.id||driver.ridingVehicleId===vehicle.id),target=occupied?driver.entity:vehicle;
    if(occupied)mission.vehicleWaitSince??=city.minute;
    if(dist(c.entity,target)>1.5){const targetMoved=!mission.vehicleTargetPosition||dist(mission.vehicleTargetPosition,target)>1;if(c.path.length&&!targetMoved)return true;const path=city.findPath(c.entity,target);if(path===null){investigation.blockedReason='sem rota física até a posição conhecida do veículo';c.path=[];return false;}mission.vehicleTargetPosition={x:target.x,y:target.y};investigation.blockedReason=null;c.path=path;if(!path.length)c.path=[{x:target.x,y:target.y}];c.action=occupied?`Acompanhando a rota do veículo #${vehicle.id}`:`Indo verificar o veículo #${vehicle.id}`;return true;}
    if(occupied){c.path=[];c.action=`Aguardando o veículo #${vehicle.id} parar para inspeção`;if(city.minute-(mission.vehicleWaitSince??city.minute)<180)return true;investigation.vehicleInspection={...investigation.vehicleInspection,status:'unavailable',completedAt:city.minute,reason:'veículo permaneceu em movimento durante o prazo da diligência'};investigation.fieldNotes.push({kind:'vehicle-inspection-unavailable',vehicleId:vehicle.id,recordedAt:city.minute,reason:investigation.vehicleInspection.reason});mission.phase='return';investigation.phase='return';return true;}
    const theftAt=record.occurredAt??0,paintHistory=(vehicle.paintHistory||[]).filter(entry=>entry.minute>=theftAt).map(entry=>({minute:entry.minute,color:entry.color,workshopId:entry.workshopId??null,workerId:entry.workerId??null,price:entry.price??null}));
    const note={kind:'vehicle-registry-inspection',officerId:c.id,vehicleId:vehicle.id,recordedAt:city.minute,position:{x:vehicle.x,y:vehicle.y},legalOwnerAccountId:vehicle.ownerAccountId??null,currentPossessorAccountId:vehicle.possessorAccountId??vehicle.ownerAccountId??null,color:vehicle.color??null,paintHistory};investigation.fieldNotes.push(note);investigation.vehicleInspection={...investigation.vehicleInspection,status:'completed',completedAt:city.minute,position:{...note.position},legalOwnerAccountId:note.legalOwnerAccountId,currentPossessorAccountId:note.currentPossessorAccountId,color:note.color,paintHistory};investigation.blockedReason=null;city.log(`O agente ${c.entity.properties.name} conferiu o cadastro observável do veículo #${vehicle.id} no caso #${record.id}.`,'justice',[c.id],{kind:'vehicle-inspected',caseId:record.id,vehicleId:vehicle.id,position:{...note.position},paintCount:paintHistory.length});mission.phase='return';investigation.phase='return';return true;
  }
  enterInvestigationWitness(c,witness,building,mission){
    const room=witness.indoorLocation,unit=cityUnitForInvestigation(this.city,room),target=room.position||witness.entity;
    if(!unit||unit.buildingId!==building.id)return false;
    const path=interiorRoute(building,{x:building.door.x,y:building.door.y,z:0},{...target,z:(room.floor??unit.z??0)*CITY_FLOOR_HEIGHT});if(path===null)return false;
    c.indoorLocation={buildingId:building.id,unitId:path.length?null:room.unitId,targetUnitId:room.unitId,targetRoomType:room.roomType,roomType:path.length?'circulation':room.roomType,floor:room.floor??unit.z??0,position:{x:building.door.x,y:building.door.y,z:0},path,phase:path.length?'walking':'using',task:'police-investigation',layoutRevision:building.layoutRevision||0,enteredAt:this.city.minute};
    mission.phase='witness-interior';mission.witnessInterviewDone=false;c.action=`Entrando para ouvir testemunha do caso #${mission.caseId}`;return true;
  }
  interviewFieldWitness(c,record,witnessRecord,witness){
    const city=this.city,honesty=witness.traits?.honesty??.5,skill=this.skillFactor(c,'investigation'),identified=witnessRecord.identifiedSuspectId!=null,confidence=identified?Math.max(.05,Math.min(.98,witnessRecord.confidence*(.55+skill*.35+honesty*.1))):null,cooperates=city.random()<Math.max(.2,Math.min(.98,.45+honesty*.35+(witness.traits?.riskTolerance??.5)*.1+skill*.1));
    witnessRecord.interviewStatus=cooperates?'interviewed':'declined';witnessRecord.interviewAttemptAt=city.minute;witnessRecord.interviewedBy=c.id;
    if(cooperates){const testimony={kind:'police-interview',witnessId:witness.id,recordedAt:city.minute,confidence:confidence??.25,identifiedSuspectId:identified?witnessRecord.identifiedSuspectId:null,scene:{...witnessRecord.scene}},event=city.log(`O agente ${c.entity.properties.name} ouviu ${witness.entity.properties.name} sobre o caso #${record.id}.`,'justice',[c.id,witness.id],{kind:'witness-interviewed',caseId:record.id,witnessId:witness.id,identified:identified&&cooperates});testimony.sourceEventId=event.id;record.investigation.interviewEvidence.push(alterBribedTestimony(this,record,witness,testimony));city.economy.practice(c,'investigation',1);}
    else city.log(`${witness.entity.properties.name} não prestou depoimento no caso #${record.id}.`,'justice',[c.id,witness.id],{kind:'witness-declined-interview',caseId:record.id,witnessId:witness.id});
    return cooperates;
  }
  updatePoliceInvestigation(c){
    const city=this.city,mission=c.policeInvestigation,record=this.cases.find(r=>r.id===mission?.caseId),station=city.building(mission?.stationId),investigation=record?.investigation;
    if(!mission||!record||!investigation||record.status!=='investigating')return false;
    if(!station?.active||station.entity.destroyed||c.jobId!==station.id||c.entity.destroyed){investigation.blockedReason='delegacia ou agente indisponível';return this.finishPoliceInvestigation(c,record,station,'interrupted');}
    if(city.urgentNeed?.(c)){investigation.blockedReason='necessidade urgente do agente';return this.finishPoliceInvestigation(c,record,station,'interrupted');}
    if(mission.lastPaidMinute!==city.minute){if(!city.payWage(c,station)){investigation.blockedReason='falta de verba para o salário';mission.phase='return';investigation.phase='return';}mission.lastPaidMinute=city.minute;}
    const sceneBuilding=record.scene?.buildingId!=null?city.building(record.scene.buildingId):null;
    if(mission.phase==='exit-scene'&&!c.indoorLocation){if(!this.beginVehicleInspection(c,record,mission,investigation)){mission.phase='return';investigation.phase='return';}}
    if(mission.phase==='exit-scene-to-witnesses'&&!c.indoorLocation){mission.phase='witnesses';investigation.phase='witnesses';}
    if(mission.phase==='exit-witness-interior'&&!c.indoorLocation){mission.witnessBuildingId=null;mission.witnessInterviewDone=false;mission.phase='witnesses';investigation.phase='witnesses';investigation.witnessIndex++;}
    if(c.indoorLocation){
      const room=c.indoorLocation;
      if(room.path?.length)return true;
      if(mission.phase==='exit'&&room.buildingId===station.id){const path=interiorRoute(station,room.position||{x:c.entity.x,y:c.entity.y,z:0},{x:station.door.x,y:station.door.y,z:0});if(path===null){investigation.blockedReason='sem rota interna para sair da delegacia';mission.phase='return';investigation.phase='return';}else{room.unitId=null;room.targetUnitId=null;room.roomType='circulation';room.targetRoomType='circulation';room.exiting=true;room.phase='leaving';room.path=path;room.task='police-investigation';c.action=`Saindo para investigar o caso #${record.id}`;return true;}}
      else if(mission.phase==='exit-scene-to-witnesses'&&sceneBuilding&&room.buildingId===sceneBuilding.id){if(!room.exiting)return this.leaveInvestigationInterior(c,sceneBuilding,mission,record,'exit-scene-to-witnesses');return true;}
      else if(['approach-interior','scene','witnesses'].includes(mission.phase)&&sceneBuilding&&room.buildingId===sceneBuilding.id){
        if(mission.phase==='approach-interior')mission.phase='scene';
        if(mission.phase==='scene'){
          const targetUnit=city.units.get(record.scene?.unitId),target=record.position;
          if(targetUnit&&room.unitId===targetUnit.id&&room.floor===targetUnit.z&&target&&dist(room.position||c.entity,target)<=1.2){investigation.sceneVisitedAt=city.minute;investigation.fieldNotes.push({kind:'scene-inspection',officerId:c.id,position:{...target},scene:{...record.scene},recordedAt:city.minute});mission.phase='witnesses';investigation.phase='witnesses';investigation.witnessIndex=0;city.log(`O agente ${c.entity.properties.name} inspecionou o interior do caso #${record.id}.`,'justice',[c.id],{kind:'scene-inspected',caseId:record.id,position:{...target},buildingId:sceneBuilding.id,unitId:targetUnit.id});return true;}
          const path=target&&interiorRoute(sceneBuilding,room.position||{x:c.entity.x,y:c.entity.y,z:0},{...target,z:targetUnit?targetUnit.z*CITY_FLOOR_HEIGHT:0});if(path===null||!target){investigation.blockedReason='sem rota interna até a cena';mission.phase='return';investigation.phase='return';}else{room.unitId=null;room.targetUnitId=targetUnit?.id??null;room.roomType='circulation';room.targetRoomType=targetUnit?.roomType??'workspace';room.path=path;room.phase=path.length?'walking':'using';c.action='Percorrendo o interior até a cena';return true;}
        }
        if(mission.phase==='witnesses'){
          const witnessRecord=record.witnesses[ investigation.witnessIndex ],witness=city.society.citizen(witnessRecord?.citizenId);
          if(witness&&witness.indoorLocation?.buildingId===sceneBuilding.id&&!witness.entity.destroyed&&!witness.custody&&(witness.unconsciousUntil||0)<=city.minute&&(witness.needs?.health??100)>20){
            if(witness.indoorLocation.unitId!==room.unitId||Math.abs(witness.indoorLocation.floor-room.floor)>0||dist(room.position||c.entity,witness.indoorLocation.position||witness.entity)>1.35){const target=witness.indoorLocation.position||witness.entity,path=interiorRoute(sceneBuilding,room.position||{x:c.entity.x,y:c.entity.y,z:0},{...target,z:(witness.indoorLocation.floor||0)*CITY_FLOOR_HEIGHT});if(path===null){witnessRecord.interviewStatus='no-route';witnessRecord.interviewAttemptAt=city.minute;investigation.witnessIndex++;return true;}room.unitId=null;room.targetUnitId=witness.indoorLocation.unitId;room.roomType='circulation';room.targetRoomType=witness.indoorLocation.roomType;room.path=path;room.phase=path.length?'walking':'using';c.action=`Indo ouvir testemunha do caso #${record.id}`;return true;}
          }
          if(!witnessRecord){mission.phase='return';investigation.phase='return';}
          else if(witness&&(!witness.indoorLocation||witness.indoorLocation.buildingId!==sceneBuilding.id)&&!witness.entity.destroyed&&!witness.custody&&(witness.unconsciousUntil||0)<=city.minute&&(witness.needs?.health??100)>20){mission.witnessBuildingId=null;return this.leaveInvestigationInterior(c,sceneBuilding,mission,record,'exit-scene-to-witnesses');}
          else if(!witness||witness.indoorLocation?.buildingId!==sceneBuilding.id||witness.entity.destroyed||witness.custody||(witness.unconsciousUntil||0)>city.minute||(witness.needs?.health??100)<=20){witnessRecord.interviewStatus='unavailable';witnessRecord.interviewAttemptAt=city.minute;investigation.witnessIndex++;return true;}
          else {const honesty=witness.traits?.honesty??.5,skill=this.skillFactor(c,'investigation'),identified=witnessRecord.identifiedSuspectId!=null,confidence=identified?Math.max(.05,Math.min(.98,witnessRecord.confidence*(.55+skill*.35+honesty*.1))):null,cooperates=city.random()<Math.max(.2,Math.min(.98,.45+honesty*.35+(witness.traits?.riskTolerance??.5)*.1+skill*.1));witnessRecord.interviewStatus=cooperates?'interviewed':'declined';witnessRecord.interviewAttemptAt=city.minute;witnessRecord.interviewedBy=c.id;if(cooperates){const testimony={kind:'police-interview',witnessId:witness.id,recordedAt:city.minute,confidence:confidence??.25,identifiedSuspectId:identified?witnessRecord.identifiedSuspectId:null,scene:{...witnessRecord.scene}},event=city.log(`O agente ${c.entity.properties.name} ouviu ${witness.entity.properties.name} sobre o caso #${record.id}.`,'justice',[c.id,witness.id],{kind:'witness-interviewed',caseId:record.id,witnessId:witness.id,identified:identified&&cooperates});testimony.sourceEventId=event.id;investigation.interviewEvidence.push(alterBribedTestimony(this,record,witness,testimony));city.economy.practice(c,'investigation',1);}else city.log(`${witness.entity.properties.name} não prestou depoimento no caso #${record.id}.`,'justice',[c.id,witness.id],{kind:'witness-declined-interview',caseId:record.id,witnessId:witness.id});investigation.witnessIndex++;return true;}
        }
      }else if(['witness-interior','exit-witness-interior'].includes(mission.phase)&&room.buildingId===mission.witnessBuildingId){
        const witnessRecord=record.witnesses[investigation.witnessIndex],witness=city.society.citizen(witnessRecord?.citizenId),building=city.building(mission.witnessBuildingId);
        if(mission.phase==='exit-witness-interior'){if(!room.exiting)return this.leaveInvestigationInterior(c,building,mission,record,'exit-witness-interior');return true;}
        if(mission.witnessInterviewDone)return this.leaveInvestigationInterior(c,building,mission,record,'exit-witness-interior');
        if(!witnessRecord||!witness||witness.entity.destroyed||witness.custody||(witness.unconsciousUntil||0)>city.minute||(witness.needs?.health??100)<=20||witness.indoorLocation?.buildingId!==building?.id){if(witnessRecord){witnessRecord.interviewStatus='unavailable';witnessRecord.interviewAttemptAt=city.minute;}mission.witnessInterviewDone=true;return this.leaveInvestigationInterior(c,building,mission,record,'exit-witness-interior');}
        const target=witness.indoorLocation.position||witness.entity,unit=cityUnitForInvestigation(city,witness.indoorLocation),atWitness=witness.indoorLocation.unitId===room.unitId&&witness.indoorLocation.floor===room.floor&&dist(room.position||c.entity,target)<=1.35;
        if(!atWitness){const path=unit&&interiorRoute(building,room.position||{x:c.entity.x,y:c.entity.y,z:0},{...target,z:(witness.indoorLocation.floor??unit.z??0)*CITY_FLOOR_HEIGHT});if(path===null||!path){witnessRecord.interviewStatus='no-route';witnessRecord.interviewAttemptAt=city.minute;mission.witnessInterviewDone=true;return this.leaveInvestigationInterior(c,building,mission,record,'exit-witness-interior');}room.unitId=null;room.targetUnitId=witness.indoorLocation.unitId;room.roomType='circulation';room.targetRoomType=witness.indoorLocation.roomType;room.path=path;room.phase='walking';c.action=`Indo ouvir testemunha do caso #${record.id}`;return true;}
        this.interviewFieldWitness(c,record,witnessRecord,witness);mission.witnessInterviewDone=true;return this.leaveInvestigationInterior(c,building,mission,record,'exit-witness-interior');
      }else if(mission.phase==='return'||mission.phase==='exit-scene'||room.buildingId!==station.id){const building=city.building(room.buildingId);if(!building){investigation.blockedReason='prédio do agente não está disponível';return false;}if(!room.exiting)return this.leaveInvestigationInterior(c,building,mission,record);return true;}
    }
    if(c.path.length)return true;
    if(mission.phase==='exit'){if(record.scene?.buildingId!=null){mission.phase='approach-interior';investigation.phase='approach-interior';}else{mission.phase='scene';investigation.phase='scene';}}
    if(mission.phase==='approach-interior'){
      if(!sceneBuilding){investigation.blockedReason='prédio da cena não está disponível';mission.phase='return';investigation.phase='return';}
      else if(dist(c.entity,sceneBuilding.door)>1.2){const path=city.findPath(c.entity,sceneBuilding.door);if(path===null){investigation.blockedReason='sem rota até o prédio da cena';mission.phase='return';investigation.phase='return';}else{c.path=path;c.action=`Indo ao prédio do caso #${record.id}`;return true;}}
      else return this.enterInvestigationScene(c,record,sceneBuilding,mission);
    }
    if(mission.phase==='approach-witness-interior'){
      const witnessRecord=record.witnesses[investigation.witnessIndex],witness=city.society.citizen(witnessRecord?.citizenId),building=witness?.indoorLocation&&city.building(witness.indoorLocation.buildingId);
      if(!witnessRecord){mission.phase='return';investigation.phase='return';}
      else if(!witness||!building||!building.active||witness.entity.destroyed||witness.custody||(witness.unconsciousUntil||0)>city.minute||(witness.needs?.health??100)<=20){witnessRecord.interviewStatus='unavailable';witnessRecord.interviewAttemptAt=city.minute;mission.phase='witnesses';investigation.phase='witnesses';investigation.witnessIndex++;return true;}
      else{mission.witnessBuildingId=building.id;if(dist(c.entity,building.door)>1.2){const path=city.findPath(c.entity,building.door);if(path===null){witnessRecord.interviewStatus='no-route';witnessRecord.interviewAttemptAt=city.minute;mission.phase='witnesses';investigation.phase='witnesses';investigation.witnessIndex++;return true;}c.path=path;c.action=`Indo ao prédio para ouvir testemunha do caso #${record.id}`;return true;}if(!this.enterInvestigationWitness(c,witness,building,mission)){witnessRecord.interviewStatus='no-route';witnessRecord.interviewAttemptAt=city.minute;mission.witnessBuildingId=null;mission.phase='witnesses';investigation.phase='witnesses';investigation.witnessIndex++;return true;}return true;}
    }
    if(mission.phase==='scene'){
      const target=record.position;
      if(!target){investigation.blockedReason='local da ocorrência desconhecido';mission.phase='return';investigation.phase='return';}
      else if(dist(c.entity,target)>1.2){const path=city.findPath(c.entity,target);if(path===null){mission.routeFailures=(mission.routeFailures||0)+1;investigation.blockedReason='sem rota até o local da ocorrência';if(mission.routeFailures<3)return false;mission.phase='return';investigation.phase='return';}else{c.path=path;if(!path.length&&dist(c.entity,target)>0.1)c.path=[{x:target.x,y:target.y}];c.action=`Indo ao local do caso #${record.id}`;return true;}}
      else{investigation.sceneVisitedAt=city.minute;investigation.fieldNotes.push({kind:'scene-inspection',officerId:c.id,position:{x:c.entity.x,y:c.entity.y},scene:{...record.scene},recordedAt:city.minute});mission.phase='witnesses';investigation.phase='witnesses';investigation.witnessIndex=0;city.log(`O agente ${c.entity.properties.name} inspecionou o local do caso #${record.id}.`,'justice',[c.id],{kind:'scene-inspected',caseId:record.id,position:{x:c.entity.x,y:c.entity.y}});return true;}
    }
    if(mission.phase==='witnesses'){
      while(investigation.witnessIndex<record.witnesses.length){
        const witnessRecord=record.witnesses[investigation.witnessIndex],witness=city.society.citizen(witnessRecord.citizenId);
        if(!witness||witness.entity.destroyed||witness.custody||(witness.unconsciousUntil||0)>city.minute||(witness.needs?.health??100)<=20){witnessRecord.interviewStatus='unavailable';witnessRecord.interviewAttemptAt=city.minute;investigation.witnessIndex++;continue;}
        if(witness.indoorLocation){const building=city.building(witness.indoorLocation.buildingId);if(!building||!building.active){witnessRecord.interviewStatus='unavailable';witnessRecord.interviewAttemptAt=city.minute;investigation.witnessIndex++;continue;}mission.witnessBuildingId=building.id;mission.phase='approach-witness-interior';investigation.phase='approach-witness-interior';if(dist(c.entity,building.door)>1.2){const path=city.findPath(c.entity,building.door);if(path===null){witnessRecord.interviewStatus='no-route';witnessRecord.interviewAttemptAt=city.minute;mission.phase='witnesses';investigation.phase='witnesses';investigation.witnessIndex++;continue;}c.path=path;c.action=`Indo ao prédio para ouvir testemunha do caso #${record.id}`;return true;}if(!this.enterInvestigationWitness(c,witness,building,mission)){witnessRecord.interviewStatus='no-route';witnessRecord.interviewAttemptAt=city.minute;mission.witnessBuildingId=null;mission.phase='witnesses';investigation.phase='witnesses';investigation.witnessIndex++;continue;}return true;}
        if(dist(c.entity,witness.entity)>1.35){const path=city.findPath(c.entity,witness.entity);if(path===null){witnessRecord.interviewStatus='no-route';witnessRecord.interviewAttemptAt=city.minute;investigation.witnessIndex++;continue;}c.path=path;if(!path.length&&dist(c.entity,witness.entity)>.1)c.path=[{x:witness.entity.x,y:witness.entity.y}];c.action=`Indo entrevistar testemunha do caso #${record.id}`;return true;}
        const honesty=witness.traits?.honesty??.5,skill=this.skillFactor(c,'investigation'),identified=witnessRecord.identifiedSuspectId!=null,confidence=identified?Math.max(.05,Math.min(.98,witnessRecord.confidence*(.55+skill*.35+honesty*.1))):null,cooperates=city.random()<Math.max(.2,Math.min(.98,.45+honesty*.35+(witness.traits?.riskTolerance??.5)*.1+skill*.1));
        witnessRecord.interviewStatus=cooperates?'interviewed':'declined';witnessRecord.interviewAttemptAt=city.minute;witnessRecord.interviewedBy=c.id;
        if(cooperates){const testimony={kind:'police-interview',witnessId:witness.id,recordedAt:city.minute,confidence:confidence??.25,identifiedSuspectId:identified?witnessRecord.identifiedSuspectId:null,scene:{...witnessRecord.scene}},event=city.log(`O agente ${c.entity.properties.name} ouviu ${witness.entity.properties.name} sobre o caso #${record.id}.`,'justice',[c.id,witness.id],{kind:'witness-interviewed',caseId:record.id,witnessId:witness.id,identified:identified&&cooperates});testimony.sourceEventId=event.id;investigation.interviewEvidence.push(alterBribedTestimony(this,record,witness,testimony));city.economy.practice(c,'investigation',1);}
        else city.log(`${witness.entity.properties.name} não prestou depoimento no caso #${record.id}.`,'justice',[c.id,witness.id],{kind:'witness-declined-interview',caseId:record.id,witnessId:witness.id});
        investigation.witnessIndex++;return true;
      }
      if(c.indoorLocation&&sceneBuilding)return this.leaveInvestigationInterior(c,sceneBuilding,mission,record);
      if(!this.beginVehicleInspection(c,record,mission,investigation)){mission.phase='return';investigation.phase='return';}
    }
    if(mission.phase==='exit-scene'){return true;}
    if(mission.phase==='vehicle-approach')return this.updateVehicleInspection(c,record,mission,investigation);
    if(mission.phase==='return'){
      if(c.indoorLocation){const building=city.building(c.indoorLocation.buildingId);if(building)return this.leaveInvestigationInterior(c,building,mission,record);investigation.blockedReason='prédio do agente não está disponível';return false;}
      if(dist(c.entity,station.door)>1.2){const path=city.findPath(c.entity,station.door);if(path===null){mission.routeFailures=(mission.routeFailures||0)+1;investigation.blockedReason='sem rota de retorno à delegacia';return false;}c.path=path;c.action=`Retornando à delegacia com o caso #${record.id}`;return true;}
      return this.finishPoliceInvestigation(c,record,station,investigation.blockedReason?'interrupted':'completed');
    }
    return true;
  }
  patrolNearby(position,radius=8){return this.city.citizens.some(c=>this.policeOnDuty(c)&&!c.indoorLocation&&dist(c.entity,position)<=radius);}
  updateInjuries(c){const wounds=c.combatInjuries||[];if(c.unconsciousUntil&&c.unconsciousUntil<=this.city.minute){c.unconsciousUntil=null;c.action=null;this.city.log(`${c.entity.properties.name} recobrou a consciência.`,'justice',[c.id],{kind:'regained-consciousness'});}if(c.surrenderedUntil&&c.surrenderedUntil<=this.city.minute){c.surrenderedUntil=null;c.action=null;this.city.log(`${c.entity.properties.name} encerrou a rendição.`,'justice',[c.id],{kind:'combat-surrender-ended'});}if(c.combatFlee?.status==='arrived'&&c.combatFlee.endsAt<=this.city.minute)c.combatFlee=null;if(c.lastSurrenderNegotiation&&this.city.minute-c.lastSurrenderNegotiation.minute>15)c.lastSurrenderNegotiation=null;if(!wounds.length)return;for(let i=wounds.length-1;i>=0;i--){const wound=wounds[i];if(wound.bleedingRate==null)wound.bleedingRate=this.injuryBleedingRate(wound.region,wound.severity);if(wound.bleedingRate>0&&!wound.bleedingStoppedAt&&wound.lastBloodLossAt!==this.city.minute){wound.lastBloodLossAt=this.city.minute;const loss=wound.bleedingRate;wound.bloodLoss=Number(((wound.bloodLoss||0)+loss).toFixed(3));c.needs.health=Math.max(0,(c.needs.health??100)-loss);if(!wound.bleedingLoggedAt){wound.bleedingLoggedAt=this.city.minute;this.city.log(`${c.entity.properties.name} está perdendo sangue por um ferimento em ${wound.region}.`,'justice',[c.id],{kind:'injury-bleeding',region:wound.region,severity:wound.severity,rate:loss});}}if(wound.recoversAt<=this.city.minute){const healed=wounds.splice(i,1)[0];this.city.log(`${c.entity.properties.name} se recuperou de uma lesão em ${healed.region}.`,'justice',[c.id],{kind:'injury-recovered',region:healed.region});}}if(!wounds.length)c.combatInjuries=null;}
  recordSurrenderNegotiation(actor,target,weapon,accepted,parentEventId){
    const city=this.city,at=city.minute,state={actorId:actor.id,targetId:target.id,minute:at,until:at+15,status:accepted?'accepted':'refused',weapon:weapon?.name||'desarmado',parentEventId:parentEventId??null};
    target.lastSurrenderNegotiation={...state};actor.lastSurrenderNegotiation={...state};
    city.log(`${actor.entity.properties.name} pediu que ${target.entity.properties.name} se rendesse; ${accepted?'a pessoa aceitou e a agressão foi suspensa':'a pessoa recusou e o confronto continuou'}.`,'justice',[actor.id,target.id],{kind:'combat-surrender-negotiation',...state});
    return state;
  }
  combatLineOfSight(actor,target){
    const from=this.observationPosition(actor),to=this.observationPosition(target),a=this.observationScene(actor),b=this.observationScene(target);if(!from||!to||a.buildingId!==b.buildingId||Math.abs((a.height||0)-(b.height||0))>.5)return false;
    if(a.buildingId!=null)return a.floor===b.floor&&this.interiorLineOfSight(this.city.building(a.buildingId),from,to,a.floor||0);
    const steps=Math.max(1,Math.ceil(dist(from,to)/.2));for(let i=1;i<steps;i++){const x=from.x+(to.x-from.x)*i/steps,y=from.y+(to.y-from.y)*i/steps;if(this.city.buildings.some(building=>!building.entity.destroyed&&building.constructionKind!=='open-air'&&buildingContainsPoint(building,x,y)))return false;}return true;
  }
  injuryBleedingRate(region,severity){if(severity>=6&&['cabeça','tronco','costas'].includes(region))return Number((.018+severity*.009).toFixed(3));if(severity>=7&&['braço','mão','perna','pé'].includes(region))return Number((.01+severity*.004).toFixed(3));return 0;}
  mobilityFactor(c){return injuryMovementFactor(c);}
  treatInjuries(c,building){
    if(!building?.active||building.entity.destroyed||!['clinic','hospital'].includes(building.type)||c.civicVisit?.buildingId!==building.id||c.civicVisit?.need!=='health')return;
    for(const wound of c.combatInjuries||[]){if(wound.lastTreatmentAt===this.city.minute)continue;wound.lastTreatmentAt=this.city.minute;wound.recoversAt=Math.max(this.city.minute,wound.recoversAt-2);
      if(wound.treatedAt==null){wound.treatedAt=this.city.minute;wound.treatmentBuildingId=building.id;if((wound.bleedingRate??this.injuryBleedingRate(wound.region,wound.severity))>0&&!wound.bleedingStoppedAt){wound.bleedingRate=0;wound.bleedingStoppedAt=this.city.minute;this.city.log(`${c.entity.properties.name} teve o sangramento em ${wound.region} estancado no atendimento.`,'justice',[c.id],{kind:'injury-bleeding-stopped',region:wound.region,buildingId:building.id,bloodLoss:wound.bloodLoss||0});}this.city.log(`${c.entity.properties.name} recebeu tratamento para lesão em ${wound.region}.`,'justice',[c.id],{kind:'injury-treated',region:wound.region,buildingId:building.id});}
    }
  }
  skillFactor(c,skill){if(!c)return 1;let factor=1;for(const wound of c.combatInjuries||[]){if((wound.region==='braço'||wound.region==='mão')&&['combat','artistic','maintenance','construction','forensics'].includes(skill))factor-=wound.severity*.035;if(wound.region==='cabeça'&&this.city.minute<(c.combatConfusedUntil||0)&&['investigation','law','forensics','social'].includes(skill))factor-=.45;}return Math.max(.2,factor);}
  combatSurrenderChance(actor,target,weapon){const health=target.needs?.health??100,weaponThreat=!!weapon&&!target.equipment?.weapon;if(health>42&&!weaponThreat)return 0;const courage=target.traits?.riskTolerance??.5,skillGap=((actor.skills?.combat||0)-(target.skills?.combat||0))/100,threat=(health<=42?(42-health)/100:0)+(weaponThreat ? .2 : 0)+Math.max(0,skillGap)*.12;return Math.max(0,Math.min(.8,.06+(1-courage)*.22+threat));}
  combatFleeChance(actor,target,weapon){const health=target.needs?.health??100,weaponThreat=!!weapon&&!target.equipment?.weapon;if(health>=70&&!weaponThreat)return 0;const risk=target.traits?.riskTolerance??.5,skillGap=((actor.skills?.combat||0)-(target.skills?.combat||0))/100;return Math.max(0,Math.min(.55,.03+(1-risk)*.14+(health<70?(70-health)/220:0)+(weaponThreat ? .08 : 0)+Math.max(0,skillGap)*.08));}
  combatFleeRoute(target){const city=this.city;if(typeof city.findPath!=='function')return null;const room=target.indoorLocation,originBuilding=room?city.building(room.buildingId):null;if(room&&(!originBuilding||originBuilding.entity.destroyed||originBuilding.constructionKind==='open-air'||interiorRoute(originBuilding,room.position||{x:target.entity.x,y:target.entity.y,z:0},{x:originBuilding.door.x,y:originBuilding.door.y,z:0})===null))return null;const origin=originBuilding?.door||target.entity,home=city.building?.(city.housing?.home?.(target)?.buildingId),safe=[home,...(city.buildings||[]).filter(b=>['police_station','hospital','clinic','courthouse','townhall'].includes(b.type)&&b.active&&!b.entity.destroyed)].filter((b,i,a)=>b?.door&&b.id!==originBuilding?.id&&a.findIndex(x=>x?.id===b.id)===i).sort((a,b)=>dist(origin,a.door)-dist(origin,b.door));for(const building of safe){const path=city.findPath(origin,building.door);if(path!==null)return {building,path,exitBuildingId:originBuilding?.id??null};}return null;}
  recordAttemptedMurder(actor,target,weaponName,parentEventId,municipalOrder){return this.crimeRecord('attemptedMurder',actor.id,target.id,{position:{x:target.entity.x,y:target.entity.y},weapon:weaponName,parentEventId,attempted:true,municipalOrderId:municipalOrder?.id??null,orderedByMayorId:municipalOrder?.mayorId??null,source:'lethal-municipal-order'});}
  combatEncounter(actor,target,{parentEventId=null,forced=false,weapon=null,round=0,lethalIntent=false,municipalOrder=null}={}){
    const city=this.city,weaponUsed=weapon||actor?.equipment?.weapon||null;if(!actor||!target||actor.entity.destroyed||target.entity.destroyed||actor===target||actor.surrenderedUntil>city.minute||target.surrenderedUntil>city.minute||actor.combatFlee?.status==='running'||target.combatFlee?.status==='running'||dist(actor.entity,target.entity)>(weaponUsed?.range??1.6)||(actor.indoorLocation?.buildingId??null)!==(target.indoorLocation?.buildingId??null)||(actor.indoorLocation?.unitId??null)!==(target.indoorLocation?.unitId??null)||weaponUsed?.kind==='firearm'&&!this.combatLineOfSight(actor,target))return false;
    const relation=city.society.getRelation(actor,target),views=relation?.views,anger=((views?.[actor.id]?.resentment||0)+(views?.[target.id]?.resentment||0))/200,temper=actor.socialProfile?.temper??actor.traits?.temper??.5,health=target.needs.health;
    const chance=forced?1:Math.max(.015,Math.min(.24,.015+anger*.12+temper*.06));if(city.random()>chance)return false;
    const surrenderChance=this.combatSurrenderChance(actor,target,weaponUsed),surrenderAccepted=surrenderChance>0&&city.random()<surrenderChance;if(surrenderChance>0)this.recordSurrenderNegotiation(actor,target,weaponUsed,surrenderAccepted,parentEventId);if(surrenderAccepted){target.surrenderedUntil=city.minute+15;target.task=null;target.path=[];target.targetId=null;target.action='Rendeu-se durante uma agressão';if(target.conversation){const other=city.society.citizen(target.conversation.a===target.id?target.conversation.b:target.conversation.a);if(other)other.conversation=null;target.conversation=null;}if(target.ridingVehicleId||target.mobilityTrip)city.vehicles?.releaseTrip?.(target);if(target.indoorLocation?.path)target.indoorLocation.path=[];const weaponName=weaponUsed?.name||'desarmado',record=this.crimeRecord('assault',actor.id,target.id,{position:{x:target.entity.x,y:target.entity.y},weapon:weaponName,parentEventId,attempted:true,outcome:'target-surrendered',attemptedHomicide:!!lethalIntent,municipalOrderId:municipalOrder?.id??null,orderedByMayorId:municipalOrder?.mayorId??null});if(lethalIntent)this.recordAttemptedMurder(actor,target,weaponName,parentEventId,municipalOrder);city.log(`${target.entity.properties.name} se rendeu diante de ${actor.entity.properties.name}; a agressão foi interrompida.`,'justice',[actor.id,target.id],{kind:'combat-surrender',until:target.surrenderedUntil,caseId:record?.id,weapon:weaponName,parentEventId});return true;}
    const fleeChance=this.combatFleeChance(actor,target,weaponUsed),fleeRoute=fleeChance>0?this.combatFleeRoute(target):null;if(fleeRoute&&city.random()<fleeChance){target.combatFlee={startedAt:city.minute,safeBuildingId:fleeRoute.building.id,exitBuildingId:fleeRoute.exitBuildingId,status:'running'};target.task='combat-flee';target.targetId=fleeRoute.building.id;target.path=fleeRoute.exitBuildingId?[]:fleeRoute.path;if(!fleeRoute.exitBuildingId&&!target.path.length&&dist(target.entity,fleeRoute.building.door)>.1)target.path=[{x:fleeRoute.building.door.x,y:fleeRoute.building.door.y}];target.action=`Fugindo da agressão para ${fleeRoute.building.entity.properties.name}`;if(target.conversation){const other=city.society.citizen(target.conversation.a===target.id?target.conversation.b:target.conversation.a);if(other)other.conversation=null;target.conversation=null;}if(target.ridingVehicleId||target.mobilityTrip)city.vehicles?.releaseTrip?.(target);const weaponName=weaponUsed?.name||'desarmado',record=this.crimeRecord('assault',actor.id,target.id,{position:{x:target.entity.x,y:target.entity.y},weapon:weaponName,parentEventId,attempted:true,outcome:'target-fled',fleeDestinationId:fleeRoute.building.id,attemptedHomicide:!!lethalIntent,municipalOrderId:municipalOrder?.id??null,orderedByMayorId:municipalOrder?.mayorId??null});if(lethalIntent)this.recordAttemptedMurder(actor,target,weaponName,parentEventId,municipalOrder);city.log(`${target.entity.properties.name} fugiu da agressão e correu para ${fleeRoute.building.entity.properties.name}.`,'justice',[actor.id,target.id,fleeRoute.building.id],{kind:'combat-flee-started',caseId:record?.id,safeBuildingId:fleeRoute.building.id,exitBuildingId:fleeRoute.exitBuildingId??null,weapon:weaponName,parentEventId});return true;}
    const regions=['braço','perna','costas','cabeça'],weights=lethalIntent?[.12,.12,.16,.52]:[.28,.28,.28,.16];let roll=city.random(),region=regions[0];for(let i=0;i<weights.length;i++){roll-=weights[i];if(roll<=0){region=regions[i];break;}}
    const strength=((actor.skills?.combat||0)*this.skillFactor(actor,'combat'))/100,weaponDamage=weaponUsed?.damage||0,damage=Math.min(12,1+city.random()*2.4+strength*3+weaponDamage+(lethalIntent?3.5:0)),severity=Math.min(8,Math.max(1,Math.round(damage*.65))),lethalRisk=health<18&&region==='cabeça'&&damage>5&&city.random()<.08;
    if(weaponUsed?.durability!=null&&actor.equipment?.weapon===weaponUsed){weaponUsed.durability=Math.max(0,weaponUsed.durability-1);if(!weaponUsed.durability){actor.inventory??={};actor.inventory[weaponUsed.good]=Math.max(0,(actor.inventory[weaponUsed.good]||0)-1);actor.equipment.weapon=null;}}
    target.needs.health=Math.max(0,target.needs.health-damage);target.combatInjuries??=[];const bleedingRate=this.injuryBleedingRate(region,severity);target.combatInjuries.push({region,severity,causedBy:actor.id,minute:city.minute,recoversAt:city.minute+Math.round((240+severity*90)*(target.skills?.medicine?1-target.skills.medicine/250:1)),bleedingRate,bloodLoss:0,lastBloodLossAt:null,bleedingStoppedAt:null});
    if(region==='cabeça')target.combatConfusedUntil=city.minute+severity*20;
    if(region==='cabeça'&&severity>=5&&city.random()<Math.min(.3,.06+severity*.025)){
      target.unconsciousUntil=Math.max(target.unconsciousUntil||0,city.minute+15+severity*10);target.task=null;target.path=[];target.targetId=null;target.action='Inconsciente após ferimento na cabeça';
      if(target.conversation){const other=city.society.citizen(target.conversation.a===target.id?target.conversation.b:target.conversation.a);if(other)other.conversation=null;target.conversation=null;}
      if(target.ridingVehicleId||target.mobilityTrip)city.vehicles?.releaseTrip?.(target);
      if(target.indoorLocation?.path)target.indoorLocation.path=[];
      city.log(`${target.entity.properties.name} perdeu a consciência após um ferimento na cabeça.`,'justice',[actor.id,target.id],{kind:'citizen-unconscious',until:target.unconsciousUntil,region,severity});
    }
    city.economy.practice(actor,'combat',2);const weaponName=weaponUsed?.name||'desarmado',record=this.crimeRecord('assault',actor.id,target.id,{position:{x:target.entity.x,y:target.entity.y},region,damage,weapon:weaponName,parentEventId,attemptedHomicide:!!lethalIntent,municipalOrderId:municipalOrder?.id??null,orderedByMayorId:municipalOrder?.mayorId??null});
    city.log(`${actor.entity.properties.name} agrediu ${target.entity.properties.name}; ${lethalIntent?`tentou um golpe letal em ${region}`:`${region} ferido${lethalRisk?' gravemente':''}`}.`,'justice',[actor.id,target.id],{kind:'combat-injury',caseId:record?.id,region,severity,damage,weapon:weaponName,parentEventId,attemptedHomicide:!!lethalIntent,municipalOrderId:municipalOrder?.id??null});
    const counterChance=Math.min(.45,.08+(target.skills?.combat||0)/250+(target.socialProfile?.temper||0)*.12);if(round===0&&!target.entity.destroyed&&city.random()<counterChance)this.combatEncounter(target,actor,{parentEventId:parentEventId,forced:true,round:1});
    const fatalStrike=lethalIntent?region==='cabeça'&&severity>=6&&city.random()<.025:lethalRisk&&city.random()<.08;
    if(fatalStrike){const homicide=this.crimeRecord('murder',actor.id,target.id,{position:{x:target.entity.x,y:target.entity.y},weapon:weaponName,parentEventId,municipalOrderId:municipalOrder?.id??null,orderedByMayorId:municipalOrder?.mayorId??null,source:lethalIntent?'lethal-municipal-order':'combat-injury'});target.deathCircumstances={kind:'violence',caseId:homicide?.id??null,aggressorId:actor.id,municipalOrderId:municipalOrder?.id??null,orderedByMayorId:municipalOrder?.mayorId??null};city.life.die(target,lethalIntent?'execução política por agente público':'ferimento grave na cabeça durante agressão');if(homicide){homicide.details.homicide=true;homicide.details.atSceneDeath=true;}}else if(lethalIntent)this.recordAttemptedMurder(actor,target,weaponName,parentEventId,municipalOrder);
    return true;
  }
  activeBodies(){return this.bodies.filter(b=>b.status!=='cremated');}
  labelCrime(type){return CRIME_TYPES[type]||type;}
  conviction(citizenId){return this.cases.find(record=>(record.chargedCitizenId??record.offenderId)===citizenId&&record.status==='convicted'&&(record.rule.politicalDisqualification||this.policies.cleanRecord&&record.rule.cleanRecordDisqualifying))||null;}
  createArtwork({kind='banner',message='',creatorId=null,subjectId=null,sponsorId=null,sponsorAccountId=null,purpose='expression',buildingId=null,x,y,rotation=0,truth=true,commercial=false,partyId=null,color=0xc9b979,narrative=null,support=null}={}){
    if(!['banner','painting','graffiti','statue','flags','monument'].includes(kind)||!Number.isFinite(x)||!Number.isFinite(y)||!String(message).trim())return null;
    const account=artworkNarrative(this.city,narrative);if(narrative&&!account)return null;
    const piece={narrative:account,id:this.nextArtId++,kind,message:String(message).trim().slice(0,180),creatorId,subjectId,sponsorId,sponsorAccountId,purpose:['expression','defamation'].includes(purpose)?purpose:'expression',buildingId,x,y,rotation,truth:account?account.mode==='faithful':truth,commercial,partyId,color,support:support?{...support}:null,scene:support?{buildingId:support.kind==='skybridge'?null:support.buildingId,unitId:support.kind==='roof-terrace'||support.kind==='skybridge'?null:support.unitId,floor:support.kind==='skybridge'?null:support.floor,height:support.kind==='skybridge'?(support.position?.z||0):0}:null,layers:[],seenBy:{},createdAt:this.city.minute,damaged:0};piece.ownerAccountId=this.artworkOwnerAccountId(piece);
    piece.entity=this.city.createEntity({x,y,properties:{name:`${kind==='statue'?'Estátua':kind==='graffiti'?'Pichação':'Arte urbana'}: ${piece.message.slice(0,42)}`,cityUrbanArt:piece}});this.art.push(piece);this.artRevision++;
    const record=this.city.log(`${this.city.society.citizen(creatorId)?.entity.properties.name||'Alguém'} instalou ${this.labelArt(kind)}: “${piece.message}”.`,'justice',[creatorId,subjectId,sponsorId].filter(Number.isInteger),{kind:'art-installed',artId:piece.id,subjectId,sponsorId,sponsorAccountId,purpose:piece.purpose,buildingId,narrativeSourceEventId:account?.sourceEventId??null,narrativeMode:account?.mode??null});piece.eventId=record.id;return piece;
  }
  registerArtworkDefamation(piece){
    if(!piece||piece.purpose!=='defamation'||piece.truth!==false||!Number.isInteger(piece.subjectId))return null;
    const city=this.city,offender=city.society.citizen(piece.sponsorId)||city.citizens.find(c=>c.accountId===piece.sponsorAccountId),target=city.society.citizen(piece.subjectId);
    if(!offender||!target||offender.id===target.id||offender.entity.destroyed||target.entity.destroyed)return null;
    const record=this.crimeRecord('defamation',offender.id,target.id,{artId:piece.id,source:'urban-art',claimText:piece.message,sponsorAccountId:piece.sponsorAccountId,useExactPosition:true,position:{x:piece.entity.x,y:piece.entity.y},scene:piece.scene||{buildingId:null,unitId:null,floor:null,height:0}},{observe:false});
    if(!record)return null;piece.defamationCaseId=record.id;record.evidence.push({kind:'public-art-accusation',artId:piece.id,publisherId:offender.id,installerId:piece.creatorId,claimText:piece.message,recordedAt:city.minute,source:'urban-art-registry'});return record;
  }
  registerCampaignDecoration(decoration,creatorId){
    const piece={id:this.nextArtId++,kind:decoration.kind==='flag'?'flags':decoration.kind==='paint'?'painting':'banner',message:decoration.kind==='paint'?`${decoration.candidateName} · ${decoration.partyName}`:`Vote ${decoration.candidateName} · ${decoration.partyName} nº ${decoration.partyNumber}`,creatorId,subjectId:decoration.candidateId,buildingId:decoration.buildingId??null,x:decoration.entity.x,y:decoration.entity.y,rotation:decoration.rotation||0,truth:true,commercial:false,partyId:decoration.partyId,color:parseInt(decoration.color?.slice(1)||'c9b979',16),layers:[],seenBy:{},createdAt:this.city.minute,damaged:0,entity:decoration.entity,campaignDecorationId:decoration.id};
    decoration.urbanArtId=piece.id;this.art.push(piece);this.artRevision++;return piece;
  }
  labelArt(kind){return ({banner:'um banner',painting:'uma pintura',graffiti:'uma pichação',statue:'uma estátua',flags:'bandeirinhas',monument:'um monumento'})[kind]||'uma obra de arte';}
  artworkOwnerAccountId(piece){if(!piece)return null;const building=this.city.building(piece.support?.buildingId??piece.buildingId),owner=this.city.society.citizen(building?.ownerId);return piece.ownerAccountId??owner?.accountId??(building?.municipal?'treasury':building?.accountId??(piece.campaignDecorationId?'treasury':null));}
  setArtworkGraffitiPermission(artId,allowed){const city=this.city,piece=this.art.find(item=>item.id===artId&&!item.entity.destroyed),ownerAccountId=this.artworkOwnerAccountId(piece);if(!piece||!ownerAccountId||typeof allowed!=='boolean')return false;piece.ownerAccountId=ownerAccountId;piece.graffitiPermission={authorized:allowed,ownerAccountId,changedAt:city.minute};this.artRevision++;city.log(`${city.accountName(ownerAccountId)||'O proprietário'} ${allowed?'autorizou':'revogou a autorização para'} pichação na obra urbana #${piece.id}.`,'justice',[piece.creatorId,piece.subjectId].filter(Number.isInteger),{kind:allowed?'art-graffiti-authorized':'art-graffiti-authorization-revoked',artId:piece.id,ownerAccountId});return true;}
  defaceArtwork(artId,creatorId,message,{truth=false,color=0xb64335}={}){
    const city=this.city,piece=this.art.find(a=>a.id===artId&&!a.entity.destroyed);if(!piece)return null;
    const layer={id:piece.nextLayerId??Math.max(0,...piece.layers.map(l=>l.id))+1,kind:'graffiti',message:String(message).trim().slice(0,180),creatorId,truth,color,minute:this.city.minute};if(!layer.message)return null;
    piece.nextLayerId=layer.id+1;piece.layers.push(layer);piece.lastDefacedAt=this.city.minute;piece.defacedBy=creatorId;this.artRevision++;
    const owner=city.building(piece.support?.buildingId??piece.buildingId)?.ownerId,ownerAuthorized=piece.graffitiPermission?.authorized===true,record=this.crimeRecord('graffiti',creatorId,null,{artId,artworkKind:piece.kind,buildingId:piece.buildingId,ownerId:owner,ownerAccountId:this.artworkOwnerAccountId(piece),ownerAuthorized,cleaningCost:city.currency.price(500),position:{x:piece.entity.x,y:piece.entity.y}});
    layer.caseId=record?.id??null;const event=this.city.log(`${this.city.society.citizen(creatorId)?.entity.properties.name||'Alguém'} cobriu uma obra urbana com outra mensagem: “${layer.message}”.`,'justice',[creatorId,piece.creatorId,piece.subjectId].filter(Number.isInteger),{kind:'art-defaced',artId,caseId:record?.id});layer.eventId=event.id;return layer;
  }
  considerAutonomousGraffiti(c,piece){
    const city=this.city;if(!c||!piece||piece.entity.destroyed||piece.buildingId!=null||piece.support||c.entity.destroyed||c.dead||c.custody||c.jobId||c.businessIds?.length||c.task&&!['walk','leisure','social'].includes(c.task)||c.conversation||c.mobilityTrip||c.ridingVehicleId||c.indoorLocation||c.deliveryId||c.cleaningJobId||city.urgentNeed?.(c)||!city.society.isAdult(c)||(c.traits?.honesty??.5)>.12||(c.traits?.riskTolerance??.5)<.72||(c.skills?.artistic??0)<12||city.minute-(c.lastGraffitiAttemptAt??-Infinity)<7*1440)return false;
    c.lastGraffitiAttemptAt=city.minute;const darkness=city.hour<7||city.hour>=19;if(city.random()>(darkness?0.014:0.003))return false;
    const targets=[{x:Math.floor(piece.entity.x)+.5,y:Math.floor(piece.entity.y)-.5},{x:Math.floor(piece.entity.x)+1.5,y:Math.floor(piece.entity.y)+.5},{x:Math.floor(piece.entity.x)+.5,y:Math.floor(piece.entity.y)+1.5},{x:Math.floor(piece.entity.x)-.5,y:Math.floor(piece.entity.y)+.5}].filter(point=>city.walkable(Math.floor(point.x),Math.floor(point.y))).map(point=>({point,path:city.findPath(c.entity,point)})).filter(route=>route.path!==null).sort((a,b)=>a.path.length-b.path.length);
    if(!targets.length)return false;const dissent=piece.partyId!=null&&piece.partyId!==c.political?.partyId,messages=piece.narrative?['Essa história tem mais de uma versão.','Esta obra não fala por todos nós.']:dissent?['Propaganda não conta a história toda.','Esta obra não fala por todos nós.']:['A cidade também é de quem vive nela.','Esta obra não fala por todos nós.'],route=targets[0];c.graffitiMission={status:'to-artwork',artId:piece.id,message:messages[Math.floor(city.random()*messages.length)],startedAt:city.minute,completeAt:city.minute+Math.max(2,Math.round(12-(c.skills.artistic||0)*.08)),waitingReason:null};c.task='urban-graffiti';c.path=route.path;if(!c.path.length&&Math.hypot(c.entity.x-route.point.x,c.entity.y-route.point.y)>.1)c.path=[route.point];c.targetId=null;c.action='Indo pichar uma obra urbana';return true;
  }
  updateGraffitiMission(c){
    const city=this.city,mission=c.graffitiMission,piece=this.art.find(item=>item.id===mission?.artId&&!item.entity.destroyed);if(!mission)return false;
    if(!piece||city.urgentNeed?.(c)||c.custody||c.dead||c.entity.destroyed||(c.unconsciousUntil||0)>city.minute||(c.surrenderedUntil||0)>city.minute||c.combatFlee){c.graffitiMission=null;c.task=null;c.path=[];c.targetId=null;c.action='Desistiu da pichação';return false;}
    if(c.path.length){c.action='Indo pichar uma obra urbana';return true;}
    if(dist(c.entity,piece.entity)>1.35){const targets=[{x:Math.floor(piece.entity.x)+.5,y:Math.floor(piece.entity.y)-.5},{x:Math.floor(piece.entity.x)+1.5,y:Math.floor(piece.entity.y)+.5},{x:Math.floor(piece.entity.x)+.5,y:Math.floor(piece.entity.y)+1.5},{x:Math.floor(piece.entity.x)-.5,y:Math.floor(piece.entity.y)+.5}].filter(point=>city.walkable(Math.floor(point.x),Math.floor(point.y))).map(point=>({point,path:city.findPath(c.entity,point)})).filter(route=>route.path!==null).sort((a,b)=>a.path.length-b.path.length);if(!targets.length){mission.status='blocked';mission.waitingReason='sem rota acessível até a obra';c.action='Desistiu: não encontrou acesso à obra';c.graffitiMission=null;c.task=null;c.targetId=null;return false;}c.path=targets[0].path;if(!c.path.length)c.path=[targets[0].point];return true;}
    if(city.minute<mission.completeAt){c.action='Pichando uma obra urbana';return true;}
    const layer=this.defaceArtwork(piece.id,c.id,mission.message,{truth:null});mission.status=layer?'completed':'interrupted';mission.completedAt=city.minute;mission.caseId=layer?.caseId??null;c.graffitiMission=null;c.task=null;c.path=[];c.targetId=null;c.action=layer?'Concluiu uma pichação urbana':'A pichação não foi concluída';return !!layer;
  }
  requestArtworkCleaning(artId){
    const city=this.city,piece=this.art.find(a=>a.id===artId&&!a.entity.destroyed),layer=piece?.layers.at(-1);if(!layer)return false;
    if(city.gigs.jobs.some(j=>j.kind==='art-cleaning'&&j.artId===artId&&['open','working'].includes(j.status)))return false;
    const interior=piece.support?.kind==='interior-wall',roof=piece.support?.kind==='roof-terrace',skybridge=piece.support?.kind==='skybridge',support=city.building(interior||roof||skybridge?piece.support.buildingId:piece.buildingId),building=support||this.activeBuildings('townhall')[0],unit=interior||roof||skybridge?city.units.get(piece.support.unitId):null,payerId=piece.ownerAccountId||(support?.ownerId!=null?city.society.citizen(support.ownerId)?.accountId:support?.municipal?'treasury':support?.accountId)||city.society.citizen(piece.creatorId)?.accountId;
    if(!building||!payerId)return false;
    const point=roof||skybridge?piece.support.position:interior?unit&&{x:piece.entity.x,y:piece.entity.y,z:(piece.support.floor??unit.z??0)*CITY_FLOOR_HEIGHT}: [[0,0],[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x:Math.floor(piece.entity.x)+x+.5,y:Math.floor(piece.entity.y)+y+.5})).find(p=>city.walkable(Math.floor(p.x),Math.floor(p.y))&&city.findPath(building.door,p)!==null);
    const routeUnit=piece.support?.kind==='skybridge'?unit&&{x:building.entity.x+unit.x+.5,y:building.entity.y+unit.y+.5,z:unit.z*CITY_FLOOR_HEIGHT}:point;
    if(!point||(interior||roof||skybridge)&&interiorRoute(building,{x:building.door.x,y:building.door.y,z:0},routeUnit)===null)return false;
    const job=city.gigs.reserveOrder(payerId,building,{kind:'art-cleaning',scope:interior||roof||skybridge?'interior-art':'outdoor',unitId:unit?.id||null,fee:city.currency.price(500),point,required:18});if(!job)return false;job.artId=piece.id;job.layerId=layer.id;job.caseId=layer.caseId??null;if(interior||roof||skybridge)job.artworkSupport={...piece.support,cleaning:true};return job;
  }
  canCompleteArtworkCleaning(job){const piece=this.art.find(a=>a.id===job.artId&&!a.entity.destroyed);return !!piece&&piece.layers.at(-1)?.id===job.layerId;}
  finishArtworkCleaning(job){
    if(job.status!=='completed'||job.completedBy==null||!this.canCompleteArtworkCleaning(job))return false;
    const piece=this.art.find(a=>a.id===job.artId),layer=piece.layers.pop();piece.removedLayers??=[];piece.removedLayers.push({...layer,removedAt:this.city.minute,cleaningJobId:job.id});piece.seenBy={};this.artRevision++;
    const record=this.cases.find(r=>r.id===job.caseId);if(record&&!record.reparation)record.reparation={creditorAccountId:job.payerAccountId,cost:job.fee,paid:0,cleaningJobId:job.id};
    if(record?.status==='convicted')this.collectReparation(record);
    this.city.log(`A limpeza removeu uma pichação e revelou a mensagem anterior: “${piece.layers.at(-1)?.message||piece.message}”.`,'justice',[job.completedBy].filter(Number.isInteger),{kind:'art-cleaned',artId:piece.id,layerId:layer.id,caseId:record?.id,gigId:job.id,amount:job.fee});return true;
  }
  collectReparation(record){
    const debt=record.reparation,c=this.city.society.citizen(record.chargedCitizenId);if(!debt||!c||(record.status!=='convicted'&&!debt.civilEnforceable))return false;const outstanding=Math.max(0,debt.cost-debt.paid),amount=Math.min(outstanding,Math.max(0,this.city.accounts.get(c.accountId)?.balance||0));if(!amount)return false;
    if(!this.city.transfer(c.accountId,debt.creditorAccountId,amount,'Ressarcimento de limpeza por condenação',{caseId:record.id,gigId:debt.cleaningJobId}))return false;debt.paid+=amount;debt.lastPaidAt=this.city.minute;return true;
  }
  damageArtwork(artId,damage,actorId=null){
    const city=this.city,piece=this.art.find(a=>a.id===artId&&!a.entity.destroyed),actor=city.society.citizen(actorId);if(!piece||!Number.isFinite(damage)||damage<=0)return false;
    const scene=piece.scene||{buildingId:null,unitId:null,floor:null,height:0};if(actorId!=null&&(!actor||dist(this.observationPosition(actor),piece.entity)>1.6||!this.canObserve(actor,piece.entity,scene)))return false;
    const applied=Math.min(100-(piece.damaged||0),damage);piece.damaged=(piece.damaged||0)+applied;
    const owner=city.building(piece.buildingId)?.ownerId??piece.creatorId,record=actor?this.crimeRecord('vandalism',actor.id,owner,{artId:piece.id,damage:applied,position:{x:piece.entity.x,y:piece.entity.y},scene}):null;
    piece.damageHistory??=[];piece.damageHistory.push({minute:city.minute,actorId,damage:applied,caseId:record?.id??null});
    if(piece.damaged>=100){piece.entity.destroyed=true;piece.destroyedAt=city.minute;piece.destroyedBy=actorId;piece.debris={artId:piece.id,x:piece.entity.x,y:piece.entity.y,createdAt:city.minute};}
    city.log(`${this.labelArt(piece.kind)} foi ${piece.damaged>=100?'destruída':`depredada (${Math.round(piece.damaged)}%)`}.`,'justice',[actorId,piece.creatorId].filter(Number.isInteger),{kind:piece.damaged>=100?'art-destroyed':'art-damaged',artId:piece.id,damage:applied,caseId:record?.id});this.artRevision++;return true;
  }
  knowsArtWrongdoing(c,subjectId){return (c.social?.memories||[]).some(m=>m.actorId===subjectId&&['murder','corruption'].includes(m.kind)&&m.truth===true)||(c.social?.beliefs||[]).some(b=>b.aboutId===subjectId&&['murder','corruption'].includes(b.kind)&&b.believes&&!b.corrected);}
  beginArtProtest(c,piece){
    const city=this.city,existing=this.activeProtests().find(p=>p.artId===piece.id);if(existing){if(!existing.participantIds.includes(c.id)&&existing.participantIds.length<24){existing.participantIds.push(c.id);c.lastArtProtestAt=city.minute;}return existing;}
    const participants=city.citizens.filter(person=>!person.entity.destroyed&&!person.custody&&person.needs?.health>=40&&person.needs?.energy>=30&&city.society.isAdult(person)&&this.artObserverAt(person,piece,2.6)&&this.canObserve(person,piece.entity,piece.scene||{buildingId:null,unitId:null,floor:null,height:0})&&this.knowsArtWrongdoing(person,piece.subjectId));
    if(!participants.some(person=>person.id===c.id))participants.push(c);
    const protest={id:this.nextProtestId++,artId:piece.id,subjectId:piece.subjectId,instigatorId:c.id,participantIds:[...new Set(participants.map(person=>person.id))],position:{x:piece.entity.x,y:piece.entity.y},scene:{...(piece.scene||{buildingId:null,unitId:null,floor:null,height:0})},startedAt:city.minute,endsAt:city.minute+240,status:'active',vandalismCaseId:null,reason:'reação pública a homenagem de pessoa associada a crime conhecido ou acreditado'};
    this.protests.push(protest);if(this.protests.length>128){const expired=this.protests.findIndex(item=>item.status!=='active');if(expired>=0)this.protests.splice(expired,1);}
    for(const person of participants)person.lastArtProtestAt=city.minute;
    protest.eventId=city.log(`${participants.length} pessoa(s) iniciaram protesto diante de ${this.labelArt(piece.kind)} em homenagem a ${city.society.citizen(piece.subjectId)?.entity.properties.name||'pessoa falecida'}.`,'justice',[piece.subjectId,...protest.participantIds],{kind:'protest-started',protestId:protest.id,artId:piece.id,participantIds:protest.participantIds,position:protest.position}).id;return protest;
  }
  considerArtProtest(c,piece){
    const city=this.city;if(!['statue','monument','banner','painting'].includes(piece.kind)||piece.subjectId==null||c.entity.destroyed||c.custody||c.indoorLocation&&piece.support?.kind!=='roof-terrace'||c.needs.health<40||c.needs.energy<30||!city.society.isAdult(c)||!this.artObserverAt(c,piece,1.6)||city.minute-(c.lastArtProtestAt??-Infinity)<1440)return false;
    if(!this.knowsArtWrongdoing(c,piece.subjectId))return false;
    const chance=Math.max(.01,Math.min(.2,(c.socialProfile?.temper??.5)*.12+(c.traits?.riskTolerance??.5)*.05-(c.traits?.empathy??.5)*.03));if(city.random()>chance)return false;
    const protest=this.beginArtProtest(c,piece),damaged=this.damageArtwork(piece.id,8+city.random()*10,c.id),record=this.cases.at(-1);if(damaged&&record?.details?.artId===piece.id){record.details.protestId=protest.id;protest.vandalismCaseId=record.id;}return damaged;
  }
  rememberObservedCrime(record){
    const city=this.city,relationships=city.relationships;if(!relationships?.facts||!relationships.remember)return;
    const identified=record.witnesses.filter(w=>w.identifiedSuspectId!=null);if(!identified.length)return;
    const id=relationships.nextFactId++,fact=Object.freeze({id,kind:record.type,actorId:record.offenderId,targetId:record.victimId,aboutId:record.offenderId,creatorId:record.offenderId,truth:true,minute:record.occurredAt,eventId:record.eventId,caseId:record.id,description:`Presenciou ${this.labelCrime(record.type).toLowerCase()} cometido por ${city.society.citizen(record.offenderId)?.entity.properties.name||'uma pessoa identificada'}.`});relationships.facts.set(id,fact);if(relationships.facts.size>768)relationships.facts.delete(relationships.facts.keys().next().value);
    for(const witness of identified){const c=city.society.citizen(witness.citizenId);if(c?.social)relationships.remember(c,fact,{otherId:record.offenderId,firsthand:true,truth:true,impact:-8});}
  }
  commissionCounterArtwork(c,piece,layer,reception){
    const city=this.city,narrative=layer?.narrative;if(!narrative||narrative.sourceEventId==null||!reception?.familiarity||!reception.contradiction||c.entity.destroyed||c.custody||c.lastCounterArtworkAt!=null&&city.minute-c.lastCounterArtworkAt<30*1440)return false;
    const responseExists=this.art.some(art=>art.narrative?.responseToArtId===piece.id)||city.gigs.jobs.some(job=>job.kind==='art-installation'&&job.artwork?.narrative?.responseToArtId===piece.id&&['open','working','completed'].includes(job.status));if(responseExists)return false;
    const recentReaders=(piece.narrativeReadings||[]).filter(reading=>(reading.layerId??0)===(layer.id??0)&&reading.familiarity&&reading.contradiction&&reading.minute>=city.minute-3*1440&&reading.citizenId!==c.id).map(reading=>city.society.citizen(reading.citizenId)).filter(person=>person&&!person.entity.destroyed&&!person.custody&&city.society.isAdult(person));
    const participants=[...new Map([c,...recentReaders].map(person=>[person.id,person])).values()].slice(0,6),groupSize=participants.length,party=city.politics?.party(c.political?.partyId),isPartyOrganizer=!!party?.active&&(party.leaderId===c.id||city.economy.mayorId===c.id||city.politics.council?.members?.some(member=>member.citizenId===c.id)||city.politics.active?.candidates?.some(candidate=>candidate.citizenId===c.id&&candidate.partyId===party.id));
    const week=Math.floor(city.minute/(7*1440)),seed=Math.imul(c.id+1,2654435761)^Math.imul(piece.id+1,1597334677)^Math.imul(week+1,3812015801),roll=(seed>>>0)%1000,chance=18+Math.round((c.political?.criticalSense??.5)*24)+Math.round((c.traits?.riskTolerance??.5)*16)+(groupSize>1?18+(groupSize-2)*12:0)+(isPartyOrganizer?32:0);if(roll>=chance)return false;
    const sponsors=[];if(isPartyOrganizer){const account=city.politics.partyAccount(party);if(account)sponsors.push({accountId:account.accountId,partyId:party.id,partyShort:party.short,color:party.flag?.background??null});}if(city.accounts.has(c.accountId))sponsors.push({accountId:c.accountId,partyId:null,partyShort:null,color:null});
    const availableSites=city.buildings.filter(b=>b.active&&!b.entity.destroyed&&b.municipal&&b.units?.length&&b.constructionKind!=='open-air'&&!city.gigs.jobs.some(job=>job.kind==='art-installation'&&job.buildingId===b.id&&['open','working'].includes(job.status)));
    for(const sponsor of sponsors){const payer=city.accounts.get(sponsor.accountId);if(!payer)continue;const sites=availableSites.map(building=>({building,fee:city.gigs.artworkQuote(building.id,'painting',sponsor.accountId)})).filter(row=>row.fee>0&&payer.balance>=row.fee).sort((a,b)=>Math.hypot(a.building.door.x-piece.entity.x,a.building.door.y-piece.entity.y)-Math.hypot(b.building.door.x-piece.entity.x,b.building.door.y-piece.entity.y)||a.building.id-b.building.id);
      for(const {building} of sites){
        const participantIds=participants.map(person=>person.id),groupLabel=sponsor.partyId?`Resposta pública de ${sponsor.partyShort}`:groupSize>1?`Resposta coletiva de ${groupSize} moradores`:'Contestação pública',message=sponsor.partyId?`${sponsor.partyShort}: nossa memória também faz parte desta história.`:groupSize>1?'Nossa memória também faz parte desta história.':'Eu me lembro. Essa história está incompleta.',description=groupSize>1?`A pessoa organizadora reuniu moradores que também reconheceram divergências entre a obra e suas memórias; ${sponsor.partyId?`${sponsor.partyShort} financiou a resposta`:'a resposta não afirma uma versão única sobre todos os detalhes'}.`:'Uma pessoa que reconheceu o acontecimento discorda da versão exposta.',job=city.gigs.createArtworkOrder(sponsor.accountId,building.id,{kind:'painting',message,sponsorId:c.id,truth:null,partyId:sponsor.partyId,color:sponsor.color,narrative:{mode:'invented',title:groupLabel,description,participantIds,participantRoles:participantIds.map(citizenId=>({citizenId,role:'witness'})),sourceClaim:`Resposta à obra urbana #${piece.id}, baseada nas memórias de ${groupSize} morador(es) que reconheceram divergências com a narrativa exposta.`,responseToArtId:piece.id}});
        if(!job)continue;c.lastCounterArtworkAt=city.minute;const kind=sponsor.partyId?'art-political-counterpropaganda':groupSize>1?'art-group-countercommissioned':'art-countercommissioned';city.log(sponsor.partyId?`${sponsor.partyShort} financiou uma resposta política à versão da obra #${piece.id}, organizada por ${c.entity.properties.name}.`:groupSize>1?`${c.entity.properties.name} organizou uma resposta coletiva, com ${groupSize} moradores, à versão da obra #${piece.id}.`:`${c.entity.properties.name} encomendou uma pintura para contestar a versão apresentada na obra #${piece.id}.`,'justice',[...participantIds,piece.id,building.id],{kind,artId:piece.id,gigId:job.id,buildingId:building.id,citizenId:c.id,partyId:sponsor.partyId,participantIds,responseToArtId:piece.id,payerAccountId:sponsor.accountId});return true;
      }
    }
    return false;
  }
  reactToArt(){if(this.lastArtReactionMinute===this.city.minute)return;this.lastArtReactionMinute=this.city.minute;const city=this.city;for(const piece of this.art)if(!piece.entity.destroyed&&(!piece.campaignDecorationId||piece.layers.length)){const layer=piece.layers.at(-1)||piece,subject=city.society.citizen(piece.subjectId);for(const c of city.citizens){if(c.entity.destroyed||!this.artObserverAt(c,piece,2.6)||(piece.seenBy[c.id]??-Infinity)>city.minute-240||!this.canObserve(c,piece.entity,piece.scene||{buildingId:null,unitId:null,floor:null,height:0}))continue;if(this.considerArtProtest(c,piece)&&piece.entity.destroyed)break;piece.seenBy[c.id]=city.minute;const knowsWrongdoing=this.knowsArtWrongdoing(c,piece.subjectId),reception=layer.narrative?narrativeReception(c,layer.narrative):artworkReception(c,piece,layer,{knowsWrongdoing});this.commissionCounterArtwork(c,piece,layer,reception);const accepts=reception.acceptance,believes=city.random()<accepts,effect=believes?(reception.effect??1.5):-(reception.effect??0)*.25;
      if(layer.narrative){piece.narrativeReadings??=[];piece.narrativeReadings.push({citizenId:c.id,layerId:layer.id??0,minute:city.minute,believes,confidence:Math.round(accepts*100),familiarity:reception.familiarity,contradiction:reception.contradiction});if(piece.narrativeReadings.length>32)piece.narrativeReadings.shift();}
      const relations=city.relationships;layer.socialFactId??=relations.nextFactId++;const memory={id:layer.socialFactId,kind:'public-art',actorId:layer.creatorId??piece.creatorId,targetId:piece.subjectId,aboutId:piece.subjectId??layer.narrative?.participantIds[0]??piece.creatorId,minute:layer.minute??piece.createdAt,eventId:layer.eventId??piece.eventId,truth:null,artId:piece.id,narrative:layer.narrative?structuredClone(layer.narrative):null,description:`Mensagem urbana: “${layer.message}”.`};relations.facts.set(memory.id,memory);if(relations.facts.size>768)relations.facts.delete(relations.facts.keys().next().value);city.relationships.remember(c,memory,{otherId:subject?.id??null,firsthand:false,truth:null,impact:effect,accepted:believes});if(subject&&c.political)city.politics.remember(c,{kind:'observer-opinion',candidateId:subject.id,truth:null,believes,effect,description:`Viu arte urbana sobre ${subject.entity.properties.name}: ${layer.message}`});c.mood=Math.max(-25,Math.min(25,(c.mood||0)+effect));this.considerAutonomousGraffiti(c,piece);
    }}}
  stealVehicle(actor,vehicleId){
    const city=this.city,v=city.vehicles?.units.get(vehicleId);if(!actor||actor.entity.destroyed||actor.custody||actor.indoorLocation||actor.skybridgeZ||!city.society.isAdult(actor)||!v?.active||v.scrapped||v.policeRecoveryOfficerId||v.driverId||v.paintJobId||v.mechanicId||v.serviceBodyId||actor.ridingVehicleId||dist(actor.entity,v)>1.6||v.ownerAccountId===actor.accountId||v.possessorAccountId)return false;
    const owner=city.citizens.find(c=>c.accountId===v.ownerAccountId),record=this.crimeRecord('bicycleTheft',actor.id,owner?.id??null,{vehicleId:v.id,position:{x:v.x,y:v.y}});
    v.possessorAccountId=actor.accountId;v.theft={caseId:record?.id??null,holderId:actor.id,stolenAt:city.minute,originalColor:v.color};v.possessionHistory??=[];v.possessionHistory.push({minute:city.minute,accountId:actor.accountId,reason:'Furto',caseId:record?.id??null});
    city.log(`${actor.entity.properties.name} furtou um veículo estacionado; a propriedade legal foi preservada.`,'justice',[actor.id,owner?.id].filter(Number.isInteger),{kind:'vehicle-stolen',caseId:record?.id,vehicleId:v.id});return record||true;
  }
  sellStolenVehicle(seller,vehicleId,buyerId,price=null){
    const city=this.city,v=city.vehicles?.units.get(vehicleId),buyer=city.society.citizen(buyerId),theft=v?.theft,theftCase=this.cases.find(record=>record.id===theft?.caseId),owner=v&&city.citizens.find(c=>c.accountId===v.ownerAccountId);
    if(!seller||!buyer||seller===buyer||seller.entity.destroyed||buyer.entity.destroyed||seller.custody||buyer.custody||seller.indoorLocation||buyer.indoorLocation||seller.skybridgeZ||buyer.skybridgeZ||!city.society.isAdult(seller)||!city.society.isAdult(buyer)||!v?.active||v.scrapped||!theft||!theftCase||theftCase.details?.vehicleId!==v.id||!owner||buyer.accountId===v.ownerAccountId||seller.accountId!==v.possessorAccountId||seller.id!==theft.holderId||v.driverId||v.policeRecoveryOfficerId||v.paintJobId||v.mechanicId||v.serviceBodyId||this.cases.some(record=>record.details?.vehicleId===v.id&&record.vehicleRecovery?.status==='in-progress')||seller.ridingVehicleId||buyer.ridingVehicleId||seller.mobilityTrip||buyer.mobilityTrip||dist(seller.entity,v)>1.6||dist(buyer.entity,v)>1.6||dist(seller.entity,buyer.entity)>1.6||!this.sameOutdoorScene(seller,buyer))return false;
    const witnessed=(theftCase.witnesses||[]).some(w=>w.citizenId===buyer.id&&w.confidence>=.35),remembered=(buyer.social?.memories||[]).some(m=>m.caseId===theftCase.id&&m.kind==='bicycleTheft'&&m.truth===true&&m.actorId===theftCase.offenderId);
    if(!witnessed&&!remembered)return false;
    const market=city.vehicles.vehiclePrice(v),amount=price??Math.max(1,Math.floor(market*(.2+city.random()*.25)));
    if(!Number.isSafeInteger(amount)||amount<=0||amount>=market||!city.accounts.has(buyer.accountId)||!city.accounts.has(seller.accountId)||(city.accounts.get(buyer.accountId).balance||0)<amount)return false;
    if(!city.transfer(buyer.accountId,seller.accountId,amount,'Compra clandestina de veículo furtado',{vehicleId:v.id,sourceTheftCaseId:theftCase.id,sellerId:seller.id,buyerId:buyer.id}))return false;
    const oldHolder=seller.accountId;v.possessorAccountId=buyer.accountId;theft.resoldAt=city.minute;theft.lastSellerId=seller.id;theft.holderId=buyer.id;theft.resaleHistory??=[];theft.resaleHistory.push({minute:city.minute,from:seller.accountId,to:buyer.accountId,sellerId:seller.id,buyerId:buyer.id,price:amount});v.possessionHistory??=[];v.possessionHistory.push({minute:city.minute,accountId:buyer.accountId,reason:'Receptação de veículo furtado',caseId:theftCase.id,price:amount,previousAccountId:oldHolder});
    const receiving=this.crimeRecord('vehicleReceiving',buyer.id,owner.id,{vehicleId:v.id,sourceTheftCaseId:theftCase.id,sellerId:seller.id,knowledgeWitnessId:buyer.id,knowledgeSource:'witnessed-original-theft',price:amount,position:{x:v.x,y:v.y}});
    city.log(`${buyer.entity.properties.name} comprou de ${seller.entity.properties.name} o veículo #${v.id}, mesmo sabendo que era furtado.`,'justice',[buyer.id,seller.id,owner.id].filter(Number.isInteger),{kind:'stolen-vehicle-received',caseId:receiving?.id,sourceTheftCaseId:theftCase.id,vehicleId:v.id,price:amount,previousPossessor:oldHolder,newPossessor:buyer.accountId});
    return receiving||true;
  }
  sameOutdoorScene(a,b){const left=this.observationScene(a),right=this.observationScene(b);return left.buildingId==null&&right.buildingId==null&&left.unitId==null&&right.unitId==null&&Math.abs(left.height-right.height)<=.5;}
  considerVehicleFencing(v){
    const city=this.city,theft=v?.theft,theftCase=this.cases.find(record=>record.id===theft?.caseId),seller=city.citizens.find(c=>c.accountId===v?.possessorAccountId);
    if(!theft||!theftCase||!seller||seller.entity.destroyed||seller.custody||seller.indoorLocation||seller.ridingVehicleId||v.driverId||v.policeRecoveryOfficerId||city.minute-(theft.lastFenceConsideredAt??-Infinity)<180||city.minute-(theft.stolenAt??city.minute)<60)return false;
    theft.lastFenceConsideredAt=city.minute;
    for(const witness of theftCase.witnesses||[]){
      const buyer=city.society.citizen(witness.citizenId);if(!buyer||buyer===seller||buyer.entity.destroyed||buyer.custody||buyer.indoorLocation||buyer.ridingVehicleId||buyer.mobilityTrip||buyer.deliveryId||buyer.skybridgeZ||buyer.accountId===v.ownerAccountId||dist(buyer.entity,v)>1.6||dist(seller.entity,v)>1.6||dist(buyer.entity,seller.entity)>1.6||(buyer.traits?.honesty??.5)>.2||(buyer.traits?.riskTolerance??.5)<.7||city.random()>.015)continue;
      const amount=Math.max(1,Math.floor(city.vehicles.vehiclePrice(v)*(.2+city.random()*.25)));if((city.accounts.get(buyer.accountId)?.balance||0)<amount)continue;
      if(this.sellStolenVehicle(seller,v.id,buyer.id,amount))return true;
    }
    return false;
  }
  recoverVehiclesOnArrest(suspect){
    const city=this.city;if(!city.vehicles)return;
    if(suspect.ridingVehicleId||suspect.mobilityTrip)city.vehicles.releaseTrip(suspect);
    for(const v of city.vehicles.units.values())if(v.theft&&v.possessorAccountId===suspect.accountId){
      const pending=this.cases.find(r=>r.id===v.theft.caseId);if(pending)pending.vehicleRecovery??={status:'awaiting-officer',vehicleId:v.id,ownerId:pending.victimId};
      if(dist(v,suspect.entity)>1.6||v.driverId||v.policeRecoveryOfficerId)continue;
      const record=this.cases.find(r=>r.id===v.theft.caseId);v.possessorAccountId=null;v.theft=null;v.possessionHistory??=[];v.possessionHistory.push({minute:city.minute,accountId:v.ownerAccountId,reason:'Recuperação policial'});if(record){record.vehicleRecoveredAt=city.minute;record.vehicleRecoverySource='police';}
      city.log(`A polícia recuperou um veículo no local da prisão; o dono pode buscá-lo onde ficou estacionado.`,'justice',[suspect.id],{kind:'vehicle-recovered-police',caseId:record?.id,vehicleId:v.id,position:{x:v.x,y:v.y}});
    }
  }
  recognizeStolenVehicle(owner,v){
    const city=this.city;if(!owner||owner.entity.destroyed||owner.indoorLocation||owner.skybridgeZ||owner.accountId!==v?.ownerAccountId||!v.theft||!v.possessorAccountId||dist(owner.entity,v)>3)return false;
    if(city.minute-(v.theft.lastRecognitionAt??-Infinity)<30)return false;v.theft.lastRecognitionAt=city.minute;
    const daylight=city.hour>=7&&city.hour<19,repainted=v.color!==v.theft.originalColor,chance=(repainted?0.08:0.95)*(daylight?1:.35);if(city.random()>chance)return false;
    const record=this.cases.find(r=>r.id===v.theft.caseId),driver=city.society.citizen(v.driverId),rider=driver?.ridingVehicleId===v.id?driver:null;
    if(rider){
      if(record&&!record.witnesses.some(w=>w.citizenId===owner.id&&w.vehicleId===v.id)){record.witnesses.push({citizenId:owner.id,confidence:repainted?0.55:0.95,identifiedSuspectId:rider.id,noticedAt:city.minute,vehicleId:v.id});record.witnessIds=[...new Set(record.witnesses.map(w=>w.citizenId))];}
      if(dist(owner.entity,v)<=1.6&&owner.needs.health>50&&owner.needs.energy>35&&(owner.socialProfile?.temper??0)>.65){city.vehicles.releaseTrip(rider);this.combatEncounter(owner,rider,{forced:true});}
      else if(record?.status==='unreported')this.report(record.id,owner.id);
      return 'recognized-rider';
    }
    if(v.paintJobId||v.mechanicId)return 'recognized-busy';
    if(driver)city.vehicles.releaseTrip(driver);const oldHolder=v.possessorAccountId;v.possessorAccountId=null;v.theft.recoveredAt=city.minute;v.possessionHistory??=[];v.possessionHistory.push({minute:city.minute,accountId:owner.accountId,reason:'Recuperação pelo proprietário'});v.theft=null;
    if(record){record.vehicleRecoveredAt=city.minute;record.vehicleRecoverySource='owner';}
    city.log(`${owner.entity.properties.name} reconheceu e recuperou seu veículo estacionado.`,'justice',[owner.id],{kind:'vehicle-recovered',vehicleId:v.id,caseId:record?.id,previousPossessor:oldHolder});return 'recovered';
  }
  updateVehicleRecognition(){if(this.city.minute%30!==0||!this.city.vehicles)return;for(const v of this.city.vehicles.units.values())if(v.theft&&v.active&&!v.scrapped){this.considerVehicleFencing(v);const owner=this.city.citizens.find(c=>c.accountId===v.ownerAccountId);if(owner)this.recognizeStolenVehicle(owner,v);}}
  ensureStolenMoneyLot(accountId,caseId,asset){
    const city=this.city;if([...city.accounts.values()].some(account=>(account.stolenMoneyLots||[]).some(lot=>lot.caseId===caseId)))return;
    const remaining=Math.max(0,(asset.amount||0)-(asset.recovered||0)-(asset.spent||0)),quantity=Math.min(remaining,Math.max(0,city.accounts.get(accountId)?.balance||0));if(quantity)addStolenMoneyLot(city,accountId,caseId,quantity);
  }
  refreshStolenMoneyAsset(caseId,accountId,holderId=null){
    const city=this.city,record=this.cases.find(item=>item.id===caseId),asset=record?.stolenAsset;if(!asset||asset.kind!=='money')return;
    const total=accountId==null?0:stolenMoneyQuantity(city,accountId,caseId),resolvedHolder=holderId??(asset.holderId!=null&&city.society.citizen(asset.holderId)?.accountId===accountId?asset.holderId:null);asset.holderId=total?resolvedHolder:null;asset.heldAmount=total;
    asset.recoveryStatus=total?'awaiting-physical-return':(asset.recovered||0)+(asset.spent||0)>=(asset.amount||0)?'spent':'unavailable';
  }
  trackStolenMoneyTransfer(from,to,amount,details={}){
    if(!Number.isSafeInteger(amount)||amount<=0)return true;
    const city=this.city,caseId=details.stolenMoneySourceCaseId??details.stolenMoneyCustodyCaseId??details.stolenMoneyRestitutionCaseId??null;
    if(caseId!=null){const moved=takeStolenMoneyLots(city,from,amount,caseId);if(!moved)return false;
      if(details.stolenMoneySourceCaseId!=null||details.stolenMoneyCustodyCaseId!=null){const target=city.accounts.get(to);if(!target)return false;target.stolenMoneyLots??=[];target.stolenMoneyLots.push(...moved.map(lot=>({...lot,acquiredAt:city.minute,transferredFrom:from})));}
      this.refreshStolenMoneyAsset(caseId,to,details.stolenMoneyCustodianId??details.buyerId??null);return true;
    }
    const quantity=Math.min(amount,stolenMoneyQuantity(city,from));if(!quantity)return true;
    const moved=takeStolenMoneyLots(city,from,quantity);for(const lot of moved||[]){const asset=this.cases.find(item=>item.id===lot.caseId)?.stolenAsset;if(asset){asset.spent=(asset.spent||0)+lot.amount;asset.lastSpentAt=city.minute;}}
    for(const caseId of new Set((moved||[]).map(lot=>lot.caseId)))this.refreshStolenMoneyAsset(caseId,from);return true;
  }
  considerTheft(actor,target,parentEventId=null){
    const city=this.city;if((actor.traits?.honesty??.5)>.25||(actor.traits?.riskTolerance??.5)<.4||city.minute-(actor.lastTheftAttemptAt??-Infinity)<1440)return false;
    if(actor.needs.food>=40&&(actor.traits?.ambition??.5)<.65)return false;
    actor.lastTheftAttemptAt=city.minute;const darkness=city.hour<7||city.hour>=19,opportunity=darkness?0.07:0.025;
    if(city.random()>opportunity*(this.patrolNearby(actor.entity)?0.3:1))return false;
    const relation=city.society.getRelation?.(actor,target),resentment=relation?.views?.[actor.id]?.resentment||0,violent=darkness&&(actor.socialProfile?.temper??0)>=.75&&(actor.traits?.riskTolerance??.5)>.82&&(actor.traits?.honesty??.5)<.12&&resentment>45&&(city.accounts.get(target.accountId)?.balance||0)>0;
    if(violent&&city.random()<.015)return !!this.attemptRobbery(actor,target,{amount:city.currency.price(100),parentEventId});
    if(actor.mobilityNeed>12&&city.vehicles){const bike=[...city.vehicles.units.values()].find(v=>v.active&&!v.driverId&&!v.possessorAccountId&&v.ownerAccountId!==actor.accountId&&dist(actor.entity,v)<=1.6);if(bike)return !!this.stealVehicle(actor,bike.id);}
    const capacity=injuredCarryCapacity(actor,actor.equipment?.carrinho?72:actor.equipment?.cesta?36:24),carried=Object.values(actor.inventory||{}).reduce((sum,count)=>sum+(Number(count)||0),0),portable=Object.entries(target.inventory||{}).filter(([good,count])=>count>0&&city.economy.goods[good]&&carried<capacity).sort((a,b)=>(city.economy.goods[b[0]].price||0)-(city.economy.goods[a[0]].price||0));
    if(portable.length&&(city.random()<.2||!(city.accounts.get(target.accountId)?.balance||0)&&!target.pocket?.food?.length)){const [good]=portable[0];return !!this.attemptTheft(actor,target,{kind:'item',good,quantity:1,parentEventId});}
    return !!this.attemptTheft(actor,target,{kind:actor.needs.food<40&&target.pocket?.food?.length?'meal':'money',amount:city.currency.price(100),parentEventId});
  }
  attemptRobbery(actor,target,{amount=100,parentEventId=null}={}){
    const city=this.city;if(!actor||!target||actor===target||actor.entity.destroyed||target.entity.destroyed||actor.custody||target.custody||!city.society.isAdult(actor)||!Number.isSafeInteger(amount)||amount<=0||dist(actor.entity,target.entity)>1.6||(actor.indoorLocation?.buildingId??null)!==(target.indoorLocation?.buildingId??null)||(actor.indoorLocation?.unitId??null)!==(target.indoorLocation?.unitId??null)||Math.abs((actor.skybridgeZ||0)-(target.skybridgeZ||0))>.5)return false;
    const available=Math.max(0,city.accounts.get(target.accountId)?.balance||0);if(!available||!city.accounts.has(actor.accountId))return false;
    const prior=this.cases.length;if(!this.combatEncounter(actor,target,{parentEventId,forced:true}))return false;
    const assault=this.cases.slice(prior).find(r=>r.type==='assault'),targetFled=assault?.details?.outcome==='target-fled',stolen=target.entity.destroyed||targetFled?0:Math.min(amount,Math.max(0,city.accounts.get(target.accountId)?.balance||0));if(stolen&&!city.transfer(target.accountId,actor.accountId,stolen,'Dinheiro roubado mediante violência',{offenderId:actor.id,victimId:target.id,parentEventId:assault?.eventId}))return false;
    const record=this.crimeRecord('robbery',actor.id,target.id,{position:{x:target.entity.x,y:target.entity.y},parentEventId:assault?.eventId??parentEventId,amount:stolen,attempted:stolen===0||targetFled,outcome:targetFled?'target-fled':undefined});if(record&&stolen){record.stolenAsset={kind:'money',amount:stolen,recovered:0,spent:0,heldAmount:stolen,holderId:actor.id,ownerId:target.id,sourceAssetCaseId:record.id};addStolenMoneyLot(city,actor.accountId,record.id,stolen);}
    const description=targetFled?`${actor.entity.properties.name} tentou roubar ${target.entity.properties.name}, mas a vítima fugiu.`:`${actor.entity.properties.name} roubou ${stolen?`R$ ${(stolen/100).toFixed(2)}`:'sem conseguir levar dinheiro'} de ${target.entity.properties.name} mediante violência.`;city.log(description,'justice',[actor.id,target.id],{kind:'violent-robbery',caseId:record?.id,assaultCaseId:assault?.id,amount:stolen,parentEventId:assault?.eventId??parentEventId});return record||true;
  }
  attemptTheft(actor,target,{kind='money',amount=100,good=null,quantity=1,parentEventId=null}={}){
    const city=this.city;if(!actor||!target||actor.id===target.id||actor.entity.destroyed||target.entity.destroyed||actor.custody||target.custody||!city.society.isAdult(actor)||dist(actor.entity,target.entity)>1.6)return false;
    const a=actor.indoorLocation,b=target.indoorLocation;if((a?.buildingId??null)!==(b?.buildingId??null)||(a?.unitId??null)!==(b?.unitId??null)||Math.abs((actor.skybridgeZ||0)-(target.skybridgeZ||0))>.5)return false;
    let asset;
    if(kind==='money'){
      if(!Number.isSafeInteger(amount)||amount<=0)return false;const value=Math.min(amount,Math.max(0,city.accounts.get(target.accountId)?.balance||0));if(!value||!city.transfer(target.accountId,actor.accountId,value,'Dinheiro subtraído',{offenderId:actor.id,victimId:target.id,parentEventId}))return false;asset={kind,amount:value,recovered:0};
    }else if(kind==='item'){
      if(!city.economy.goods[good]||!Number.isSafeInteger(quantity)||quantity<1||(target.inventory?.[good]||0)<quantity)return false;
      actor.inventory??={};const capacity=injuredCarryCapacity(actor,actor.equipment?.carrinho?72:actor.equipment?.cesta?36:24);if(Object.values(actor.inventory).reduce((n,q)=>n+(Number(q)||0),0)+quantity>capacity)return false;
      target.inventory[good]-=quantity;if(target.inventory[good]<=0&&target.equipment?.weapon?.good===good)target.equipment.weapon=null;actor.inventory[good]=(actor.inventory[good]||0)+quantity;asset={kind,good,quantity,recovered:0};
    }else if(kind==='meal'){
      if(!target.pocket?.food?.length)return false;actor.pocket??={food:[],water:0,waterContamination:0};if(actor.pocket.food.length>=4)return false;
      const meal=target.pocket.food.shift();actor.pocket.food.push(meal);asset={kind,meal,quantity:1,recovered:0};
    }else return false;
    const record=this.crimeRecord('theft',actor.id,target.id,{position:{x:target.entity.x,y:target.entity.y},parentEventId});if(record){record.stolenAsset={...asset,...(asset.kind==='money'?{spent:0,heldAmount:asset.amount}:{}),holderId:actor.id,ownerId:target.id,sourceAssetCaseId:record.id};if(asset.kind==='money')addStolenMoneyLot(city,actor.accountId,record.id,asset.amount);else if(asset.kind==='meal')asset.meal.stolenCaseId=record.id;else if(asset.kind==='item'){actor.inventoryProvenance??=[];actor.inventoryProvenance.push({caseId:record.id,good:asset.good,quantity:asset.quantity,originOwnerId:target.id,createdAt:city.minute});}}
    city.log(`${actor.entity.properties.name} furtou ${kind==='money'?'dinheiro':kind==='meal'?'alimento':'um objeto'} de ${target.entity.properties.name}.`,'justice',[actor.id,target.id],{kind:'property-stolen',caseId:record?.id,parentEventId,assetKind:kind,amount:asset.amount,good:asset.good,quantity:asset.quantity});return record||true;
  }
  sellStolenProperty(seller,sourceCaseId,buyerId,price=null){
    const city=this.city,source=this.cases.find(record=>record.id===sourceCaseId),asset=source?.stolenAsset,buyer=city.society.citizen(buyerId),owner=city.society.citizen(asset?.ownerId),left=this.observationScene(seller),right=this.observationScene(buyer),leftPos=this.observationPosition(seller),rightPos=this.observationPosition(buyer);
    if(!seller||!buyer||seller===buyer||!source||!['theft','robbery'].includes(source.type)||!asset||!['item','meal','money'].includes(asset.kind)||!owner||!leftPos||!rightPos||seller.entity.destroyed||buyer.entity.destroyed||seller.custody||buyer.custody||seller.skybridgeZ||buyer.skybridgeZ||!city.society.isAdult(seller)||!city.society.isAdult(buyer)||asset.holderId!==seller.id||['returned','spent','unavailable'].includes(asset.recoveryStatus)||asset.recoveryMission?.status==='in-progress'||dist(leftPos,rightPos)>1.6||left.buildingId!==right.buildingId||left.unitId!==right.unitId||left.floor!==right.floor||Math.abs(left.height-right.height)>.5||seller.ridingVehicleId||buyer.ridingVehicleId||seller.mobilityTrip||buyer.mobilityTrip||seller.deliveryId||buyer.deliveryId)return false;
    const witnessed=(source.witnesses||[]).some(w=>w.citizenId===buyer.id&&w.confidence>=.35),remembered=(buyer.social?.memories||[]).some(m=>m.caseId===source.id&&m.kind==='theft'&&m.truth===true&&m.actorId===source.offenderId);if(!witnessed&&!remembered)return false;
    const assetCaseId=asset.sourceAssetCaseId??source.id;
    if(asset.kind==='money')this.ensureStolenMoneyLot(seller.accountId,assetCaseId,asset);
    else if(asset.kind==='item')ensureStolenInventoryLot(seller,asset,assetCaseId);
    const quantity=asset.kind==='item'?stolenInventoryQuantity(seller,assetCaseId,asset.good):asset.kind==='meal'?1:stolenMoneyQuantity(city,seller.accountId,assetCaseId),expected=asset.kind==='money'?Math.max(0,(asset.amount||0)-(asset.recovered||0)-(asset.spent||0)):Math.max(0,(asset.quantity||1)-(asset.recovered||0));
    if(quantity!==expected||quantity<=0)return false;
    if(asset.kind==='meal'&&(!seller.pocket?.food?.some(meal=>meal.stolenCaseId===(asset.sourceAssetCaseId??source.id))||buyer.pocket?.food?.length>=4))return false;
    const unitPrice=asset.kind==='item'?city.economy.goods[asset.good]?.price:asset.kind==='meal'?city.economy.goods[asset.meal?.good]?.price:null,retail=asset.kind==='money'?quantity:Math.max(1,(unitPrice||city.currency.price(100))*quantity),amount=price??Math.max(1,Math.floor(retail*(.2+city.random()*.25)));
    if(!Number.isSafeInteger(amount)||amount<=0||amount>=retail||!city.accounts.has(buyer.accountId)||!city.accounts.has(seller.accountId)||(city.accounts.get(buyer.accountId).balance||0)<amount)return false;
    let lots=null,mealIndex=-1;
    if(asset.kind==='item'){lots=takeStolenInventory(seller,asset.sourceAssetCaseId??source.id,asset.good,quantity);if(!lots)return false;}
    else if(asset.kind==='meal'){mealIndex=seller.pocket.food.findIndex(meal=>meal.stolenCaseId===assetCaseId);if(mealIndex<0)return false;}
    else if(stolenMoneyQuantity(city,seller.accountId,assetCaseId)<quantity||(city.accounts.get(seller.accountId).balance||0)<quantity)return false;
    if(!city.transfer(buyer.accountId,seller.accountId,amount,'Compra clandestina de bem roubado',{sourceTheftCaseId:source.id,sellerId:seller.id,buyerId:buyer.id,good:asset.good||asset.meal?.good,quantity})){
      if(lots)giveStolenInventory(seller,lots);
      return false;
    }
    if(asset.kind==='item')giveStolenInventory(buyer,lots);
    else if(asset.kind==='meal'){const [meal]=seller.pocket.food.splice(mealIndex,1);buyer.pocket??={food:[],water:0,waterContamination:0};buyer.pocket.food.push(meal);}
    else if(!city.transfer(seller.accountId,buyer.accountId,quantity,'Repasse de dinheiro roubado',{stolenMoneySourceCaseId:assetCaseId,sourceTheftCaseId:source.id,sellerId:seller.id,buyerId:buyer.id,quantity}))return false;
    const previousHolder=seller.id;asset.holderId=buyer.id;asset.recoveryStatus='awaiting-physical-return';asset.lastTransferAt=city.minute;asset.holderHistory??=[];asset.holderHistory.push({minute:city.minute,from:seller.id,to:buyer.id,quantity,price:amount});
    const receiving=this.crimeRecord('propertyReceiving',buyer.id,owner.id,{sourceTheftCaseId:source.id,knowledgeWitnessId:buyer.id,knowledgeSource:'witnessed-original-theft',sellerId:seller.id,good:asset.good||asset.meal?.good,quantity,price:amount,assetKind:asset.kind,position:{x:seller.entity.x,y:seller.entity.y}});
    if(receiving)receiving.stolenAsset=asset;
    city.log(`${buyer.entity.properties.name} comprou de ${seller.entity.properties.name} ${asset.kind==='meal'?'um alimento':asset.kind==='money'?'dinheiro roubado':'bens furtados'} no caso #${source.id}.`,'justice',[buyer.id,seller.id,owner.id],{kind:'stolen-property-received',caseId:receiving?.id,sourceTheftCaseId:source.id,quantity,price:amount,assetKind:asset.kind});return receiving||true;
  }
  updatePropertyFencing(){
    const city=this.city;if(city.minute%30!==0)return;
    for(const source of this.cases){const asset=source.stolenAsset;if(!['theft','robbery'].includes(source.type)||!asset||!['item','meal','money'].includes(asset.kind)||['returned','spent','unavailable'].includes(asset.recoveryStatus)||asset.recoveryMission?.status==='in-progress'||asset.recoveryMission?.status==='interrupted'&&asset.recoveryMission.custodyHolderId===asset.holderId||city.minute-(asset.lastFenceConsideredAt??-Infinity)<180)continue;asset.lastFenceConsideredAt=city.minute;
      const seller=city.society.citizen(asset.holderId);if(!seller||seller.entity.destroyed||seller.custody||seller.indoorLocation)continue;
      for(const witness of source.witnesses||[]){const buyer=city.society.citizen(witness.citizenId);if(!buyer||buyer===seller||buyer.entity.destroyed||buyer.custody||buyer.indoorLocation||buyer.id===asset.ownerId||(buyer.traits?.honesty??.5)>.2||(buyer.traits?.riskTolerance??.5)<.7||city.urgentNeed?.(buyer)||dist(buyer.entity,seller.entity)>1.6||city.random()>.015)continue;
        if(this.sellStolenProperty(seller,source.id,buyer.id))break;
      }
    }
  }
  recoverStolenAsset(record,suspect){
    const city=this.city,asset=record.stolenAsset,owner=city.society.citizen(asset?.ownerId),sourceAssetCaseId=asset?.sourceAssetCaseId??record.id;if(!asset||asset.recoveryMission?.status==='in-progress'||!owner||asset.holderId!==suspect?.id)return false;
    if(asset.kind==='money'){this.ensureStolenMoneyLot(suspect.accountId,sourceAssetCaseId,asset);const amount=Math.min(Math.max(0,asset.amount-(asset.recovered||0)-(asset.spent||0)),stolenMoneyQuantity(city,suspect.accountId,sourceAssetCaseId));asset.heldAmount=amount;asset.recoveryStatus=amount?'awaiting-physical-return':(asset.spent||0)>0?'spent':'unavailable';}
    else if(asset.kind==='item'){ensureStolenInventoryLot(suspect,asset,sourceAssetCaseId);asset.recoveryStatus=stolenInventoryQuantity(suspect,sourceAssetCaseId,asset.good)>0?'awaiting-physical-return':'unavailable';}
    else if(asset.kind==='meal'){const index=suspect.pocket?.food?.findIndex(meal=>meal.stolenCaseId===sourceAssetCaseId)??-1;asset.recoveryStatus=index>=0?'awaiting-physical-return':'unavailable';}
    if(asset.recoveryStatus==='awaiting-physical-return')asset.recoveryWaitingReason='aguardando decisão judicial e entrega física pela polícia';return false;
  }
  reconcileRestitutionMissions(){
    const city=this.city;
    for(const record of this.cases){const asset=record.stolenAsset,mission=asset?.recoveryMission;if(!mission||mission.status!=='in-progress')continue;
      const officer=city.society.citizen(mission.officerId),station=city.building(mission.stationId),sameMission=officer?.policeRestitution===mission,otherDuty=officer&&(officer.policeAudit||officer.policePatrol||officer.policeResponse||officer.policeInvestigation||officer.custodyEscort||officer.funeralBodyId||officer.deliveryId||officer.cleaningJobId||officer.paintWorkId||officer.mechanicJob||officer.informalJobId||officer.mobilityTrip),available=!!officer&&!officer.entity.destroyed&&!officer.dead&&!!station&&station.active&&!station.entity.destroyed&&officer.jobId===station.id&&!otherDuty&&(!officer.policeRestitution||sameMission)&&(sameMission||!officer.task||officer.task==='work'||officer.task==='police-restitution');
      if(available){if(!officer.policeRestitution){officer.policeRestitution=mission;officer.task='police-restitution';officer.action=`Retomando restituição do caso #${record.id}`;}continue;}
      mission.status='interrupted';mission.interruptedAt=city.minute;mission.waitingReason='agente ou delegacia indisponível; aguardando nova equipe';asset.recoveryWaitingReason=mission.waitingReason;
      if(asset.holderId===mission.officerId){mission.custodyHolderId=mission.officerId;asset.recoveryStatus='awaiting-physical-return';}
      else if(asset.holderId===mission.suspectId)asset.recoveryStatus='awaiting-physical-return';
      if(officer?.policeRestitution===mission){officer.policeRestitution=null;if(officer.jobId===station?.id&&!officer.entity.destroyed){officer.task='work';officer.targetId=station.id;officer.path=[];}}
      city.log(`A missão de restituição do caso #${record.id} foi interrompida; o bem permanece sob custódia registrada até a chegada de outra equipe.`,'justice',[mission.officerId,mission.suspectId,mission.ownerId].filter(Number.isInteger),{kind:'police-restitution-interrupted',caseId:record.id,assetKind:asset.kind,custodianId:asset.holderId,reason:mission.waitingReason});
    }
  }
  updateRestitutionMissions(){
    dispatchVehicleRestitution(this);
    const city=this.city;this.reconcileRestitutionMissions();
    for(const record of this.cases){
      const asset=record.stolenAsset,convictedHolderId=record.chargedCitizenId??record.investigation?.suspectId,previousMission=asset?.recoveryMission,recoveringFromCustodian=previousMission?.status==='interrupted'&&previousMission.caseId===record.id&&previousMission.custodyHolderId===asset.holderId;if(!asset||!['item','meal','money'].includes(asset.kind)||record.status!=='convicted'||asset.recoveryStatus!=='awaiting-physical-return'||asset.holderId!==convictedHolderId&&!recoveringFromCustodian)continue;
      if(asset.recoveryMission?.status==='in-progress'||asset.recoveryMission?.status==='blocked'&&city.minute<(asset.recoveryMission.retryAt||Infinity))continue;
      const suspect=city.society.citizen(asset.holderId),owner=city.society.citizen(asset.ownerId);if(!suspect||suspect.entity.destroyed||suspect.dead||!owner||owner.entity.destroyed)continue;
      const stations=this.activeBuildings('police_station').filter(b=>this.staffed(b)>0).sort((a,b)=>dist(a.door,suspect.entity)-dist(b.door,suspect.entity));let assignment=null;
      for(const station of stations){const officer=(station.workers||[]).map(id=>city.society.citizen(id)).find(c=>c&&!c.entity.destroyed&&c.jobId===station.id&&c.task==='work'&&c.indoorLocation?.buildingId===station.id&&!c.indoorLocation.path?.length&&!c.path.length&&!c.policeAudit&&!c.policePatrol&&!c.policeResponse&&!c.policeInvestigation&&!c.policeRestitution&&!c.policeArrestEscort&&!c.custodyEscort&&!c.funeralBodyId&&!c.deliveryId&&!city.urgentNeed?.(c));if(officer){assignment={station,officer};break;}}
      if(!assignment){asset.recoveryWaitingReason='aguardando policial disponível na delegacia';continue;}
      const {station,officer}=assignment;asset.recoveryMission={status:'in-progress',caseId:record.id,stationId:station.id,officerId:officer.id,suspectId:suspect.id,ownerId:owner.id,phase:'to-suspect',targetRole:recoveringFromCustodian?'custodian':'convicted-person',previousOfficerId:recoveringFromCustodian?previousMission.officerId:null,startedAt:city.minute,lastPaidMinute:null};officer.policeRestitution=asset.recoveryMission;officer.task='police-restitution';officer.path=[];officer.targetId=null;officer.action=`Recolhendo bem do caso #${record.id}`;asset.recoveryWaitingReason=null;
      city.log(`A polícia enviou ${officer.entity.properties.name} para recuperar fisicamente os bens do caso #${record.id}.`,'justice',[officer.id,suspect.id,owner.id],{kind:'police-restitution-dispatched',caseId:record.id,buildingId:station.id});
    }
  }
  enterRestitutionInterior(officer,building,target){
    const path=interiorRoute(building,{x:building.door.x,y:building.door.y,z:0},{x:target.position.x,y:target.position.y,z:(target.floor||0)*CITY_FLOOR_HEIGHT});if(path===null)return false;
    const unit=this.city.units.get(target.unitId);officer.indoorLocation={buildingId:building.id,unitId:path.length?null:target.unitId,targetUnitId:target.unitId,targetRoomType:unit?.roomType||'workspace',roomType:path.length?'circulation':unit?.roomType||'workspace',floor:target.floor||0,position:{x:building.door.x,y:building.door.y,z:0},path,phase:path.length?'walking':'using',task:'police-restitution',layoutRevision:building.layoutRevision||0,enteredAt:this.city.minute};return true;
  }
  leaveRestitutionInterior(officer,building,mission){
    const room=officer.indoorLocation;if(!room)return false;const path=interiorRoute(building,room.position||{x:officer.entity.x,y:officer.entity.y,z:0},{x:building.door.x,y:building.door.y,z:0});if(path===null){mission.waitingReason='sem rota interna para sair do prédio';return false;}
    room.unitId=null;room.targetUnitId=null;room.roomType='circulation';room.targetRoomType='circulation';room.exiting=true;room.phase='leaving';room.path=path;room.task='police-restitution';return true;
  }
  collectRestitutionAsset(record,officer,suspect){
    const city=this.city,asset=record.stolenAsset,mission=asset?.recoveryMission;if(!asset||!mission||mission.phase!=='collect')return false;
    if(asset.kind==='item'){
      const assetCaseId=asset.sourceAssetCaseId??record.id;ensureStolenInventoryLot(suspect,asset,assetCaseId);const available=stolenInventoryQuantity(suspect,assetCaseId,asset.good),quantity=Math.min(available,Math.max(0,asset.quantity-(asset.recovered||0))),capacity=injuredCarryCapacity(officer,officer.equipment?.carrinho?72:officer.equipment?.cesta?36:24),used=Object.values(officer.inventory||{}).reduce((n,q)=>n+(Number(q)||0),0);
      if(!quantity||used+quantity>capacity){mission.waitingReason=!quantity?'bem não está mais com o suspeito':'policial sem capacidade de carga';asset.recoveryWaitingReason=mission.waitingReason;mission.status='blocked';mission.phase='return';mission.retryAt=city.minute+360;if(!quantity)asset.recoveryStatus='unavailable';return false;}
      const lots=takeStolenInventory(suspect,assetCaseId,asset.good,quantity);if(!lots){mission.waitingReason='proveniência do bem indisponível';asset.recoveryWaitingReason=mission.waitingReason;return false;}if(suspect.inventory[asset.good]<=0&&suspect.equipment?.weapon?.good===asset.good)suspect.equipment.weapon=null;giveStolenInventory(officer,lots);mission.quantity=quantity;
    }else if(asset.kind==='money'){
      const assetCaseId=asset.sourceAssetCaseId??record.id,amount=Math.min(Math.max(0,asset.amount-(asset.recovered||0)-(asset.spent||0)),stolenMoneyQuantity(city,suspect.accountId,assetCaseId));if(!amount||!city.transfer(suspect.accountId,officer.accountId,amount,'Dinheiro apreendido para restituição policial',{caseId:record.id,stolenMoneyCustodyCaseId:assetCaseId,stolenMoneyCustodianId:officer.id})){mission.waitingReason='dinheiro rastreável indisponível para apreensão';asset.recoveryWaitingReason=mission.waitingReason;if(!amount){asset.recoveryStatus='unavailable';asset.heldAmount=0;}mission.status='blocked';mission.phase='return';mission.retryAt=city.minute+360;return false;}mission.quantity=amount;
    }else{
      const assetCaseId=asset.sourceAssetCaseId??record.id,index=suspect.pocket?.food?.findIndex(meal=>meal.stolenCaseId===assetCaseId)??-1;if(index<0||officer.pocket?.food?.length>=4){mission.waitingReason=index<0?'alimento não está mais com o suspeito':'policial sem espaço para levar o alimento';asset.recoveryWaitingReason=mission.waitingReason;mission.status='blocked';mission.phase='return';mission.retryAt=city.minute+360;if(index<0)asset.recoveryStatus='unavailable';return false;}
      officer.pocket??={food:[],water:0,waterContamination:0};const [meal]=suspect.pocket.food.splice(index,1);officer.pocket.food.push(meal);mission.meal=meal;mission.quantity=1;
    }
    asset.holderId=officer.id;asset.recoveryStatus='in-transit';mission.phase='to-owner';mission.waitingReason=null;city.log(`O agente recolheu fisicamente o bem do caso #${record.id} e está levando-o à vítima.`,'justice',[officer.id,suspect.id],{kind:'stolen-property-seized',caseId:record.id,assetKind:asset.kind,quantity:mission.quantity});return true;
  }
  deliverRestitutionAsset(record,officer,owner){
    const city=this.city,asset=record.stolenAsset,mission=asset?.recoveryMission;if(!asset||!mission||mission.phase!=='deliver')return false;
    if(asset.kind==='item'){
      const assetCaseId=asset.sourceAssetCaseId??record.id,quantity=Math.min(mission.quantity||0,stolenInventoryQuantity(officer,assetCaseId,asset.good)),lots=takeStolenInventory(officer,assetCaseId,asset.good,quantity);if(!quantity||!lots){mission.waitingReason='bem apreendido não está mais com o agente';return false;}
      owner.inventory??={};owner.inventory[asset.good]=(owner.inventory[asset.good]||0)+quantity;mission.quantity=quantity;
    }else if(asset.kind==='money'){
      const assetCaseId=asset.sourceAssetCaseId??record.id,quantity=Math.min(mission.quantity||0,stolenMoneyQuantity(city,officer.accountId,assetCaseId));if(!quantity){mission.waitingReason='dinheiro apreendido não está mais rastreável';asset.recoveryWaitingReason=mission.waitingReason;asset.heldAmount=0;asset.holderId=null;asset.recoveryStatus=asset.recovered?'partially-returned':asset.spent?'spent':'unavailable';mission.status='blocked';mission.phase='return';mission.retryAt=city.minute+360;city.log(`A restituição do dinheiro no caso #${record.id} foi interrompida: o valor deixou de estar rastreável durante a missão.`,'justice',[officer.id,owner.id],{kind:'stolen-property-restitution-blocked',caseId:record.id,assetKind:'money',reason:mission.waitingReason});return false;}if(!city.transfer(officer.accountId,owner.accountId,quantity,'Restituição policial de dinheiro subtraído',{caseId:record.id,stolenMoneyRestitutionCaseId:assetCaseId})){mission.waitingReason='transferência da restituição não concluída';asset.recoveryWaitingReason=mission.waitingReason;return false;}mission.quantity=quantity;
    }else{
      const assetCaseId=asset.sourceAssetCaseId??record.id,index=officer.pocket?.food?.findIndex(meal=>meal.stolenCaseId===assetCaseId)??-1;if(index<0||owner.pocket?.food?.length>=4){mission.waitingReason=index<0?'alimento apreendido não está mais com o agente':'vítima sem espaço para receber o alimento';return false;}
      const [meal]=officer.pocket.food.splice(index,1);delete meal.stolenCaseId;owner.pocket??={food:[],water:0,waterContamination:0};owner.pocket.food.push(meal);mission.meal=meal;
    }
    asset.recovered=(asset.recovered||0)+mission.quantity;if(asset.kind==='money')asset.heldAmount=stolenMoneyQuantity(city,mission.suspectId!=null?city.society.citizen(mission.suspectId)?.accountId:null,asset.sourceAssetCaseId??record.id);const complete=asset.recovered>=(asset.kind==='money'?asset.amount:(asset.quantity||1));asset.holderId=complete?owner.id:asset.kind==='money'&&!asset.heldAmount?null:mission.suspectId;asset.recoveryStatus=complete?'returned':asset.recovered?'partially-returned':asset.kind==='money'&&!asset.heldAmount?(asset.spent?'spent':'unavailable'):'partially-returned';asset.lastRecoveredAt=city.minute;asset.recoveryWaitingReason=null;mission.status='completed';mission.completedAt=city.minute;mission.waitingReason=null;officer.path=[];officer.targetId=null;officer.task='police-restitution';mission.phase='return';officer.action=`Retornando à delegacia após entregar os bens do caso #${record.id}`;
    city.log(`A polícia devolveu fisicamente ${asset.kind==='meal'?'o alimento':asset.kind==='money'?`R$ ${(mission.quantity/100).toFixed(2)}`:`${mission.quantity} ${asset.good}`} a ${owner.entity.properties.name}.`,'justice',[officer.id,owner.id],{kind:'stolen-property-returned',caseId:record.id,assetKind:asset.kind,quantity:mission.quantity,physical:true});return true;
  }
  pauseVehicleRestitution(officer,reason){pauseVehicleRestitution(this,officer,reason);}
  updatePoliceRestitution(officer){
    if(officer.policeRestitution?.kind==='vehicle')return updateVehicleRestitution(this,officer);
    const city=this.city,mission=officer.policeRestitution,record=this.cases.find(r=>r.id===mission?.caseId),asset=record?.stolenAsset,station=city.building(mission?.stationId),suspect=city.society.citizen(mission?.suspectId),owner=city.society.citizen(mission?.ownerId);if(!mission||!record||!asset||!station||!suspect||!owner)return false;
    if(officer.entity.destroyed||officer.jobId!==station.id||city.urgentNeed?.(officer)){mission.waitingReason='agente ou condições de serviço indisponíveis';return false;}
    if(mission.lastPaidMinute!==city.minute){if(!city.payWage(officer,station))mission.waitingReason='aguardando verba salarial';mission.lastPaidMinute=city.minute;}
    const targetCitizen=mission.phase==='to-suspect'?suspect:mission.phase==='to-owner'?owner:null;
    if(officer.indoorLocation){const room=officer.indoorLocation;if(room.path?.length)return true;
      if(mission.phase==='return'||!targetCitizen||targetCitizen.indoorLocation?.buildingId!==room.buildingId){const building=city.building(room.buildingId);if(!building)return false;if(!room.exiting)return this.leaveRestitutionInterior(officer,building,mission);return true;}
      const location=targetCitizen.indoorLocation,building=city.building(location.buildingId);if(!building)return false;
      if(room.buildingId!==building.id){return this.leaveRestitutionInterior(officer,city.building(room.buildingId),mission);}
      const sameRoom=room.unitId===location.unitId&&room.floor===location.floor,position=location.position||targetCitizen.entity;
      if(sameRoom&&dist(room.position||officer.entity,position)<=1.35){if(mission.phase==='to-suspect'){mission.phase='collect';this.collectRestitutionAsset(record,officer,suspect);return true;}mission.phase='deliver';this.deliverRestitutionAsset(record,officer,owner);return true;}
      const unit=city.units.get(location.unitId),path=interiorRoute(building,room.position||{x:officer.entity.x,y:officer.entity.y,z:0},{x:position.x,y:position.y,z:(unit?.z||location.floor||0)*CITY_FLOOR_HEIGHT});if(path===null){mission.waitingReason='sem rota interna até a pessoa';return false;}room.unitId=null;room.targetUnitId=location.unitId;room.roomType='circulation';room.targetRoomType=unit?.roomType||location.roomType||'workspace';room.floor=unit?.z||location.floor||0;room.path=path;room.phase=path.length?'walking':'using';return true;
    }
    if(mission.phase==='return'){
      if(dist(officer.entity,station.door)>1.2){const path=city.findPath(officer.entity,station.door);if(path===null){mission.waitingReason='sem rota de retorno à delegacia';return false;}officer.path=path;return true;}
      if(mission.status!=='blocked')mission.status='completed';mission.returnedAt=city.minute;officer.policeRestitution=null;officer.task='work';officer.targetId=station.id;officer.action='Retornou à delegacia após a restituição';return true;
    }
    if(officer.path.length)return true;
    if(targetCitizen.indoorLocation){const building=city.building(targetCitizen.indoorLocation.buildingId);if(!building){mission.waitingReason='prédio da pessoa indisponível';return false;}if(dist(officer.entity,building.door)>1.2){const path=city.findPath(officer.entity,building.door);if(path===null){mission.waitingReason='sem rota até o prédio';return false;}officer.path=path;return true;}if(!this.enterRestitutionInterior(officer,building,targetCitizen.indoorLocation)){mission.waitingReason='sem rota interna até a pessoa';return false;}return true;}
    const position=targetCitizen.entity;if(dist(officer.entity,position)>1.35){const path=city.findPath(officer.entity,position);if(path===null){mission.waitingReason='sem rota até a pessoa';return false;}officer.path=path;if(!path.length&&dist(officer.entity,position)>.1)officer.path=[{x:position.x,y:position.y}];return true;}
    if(mission.phase==='to-suspect'){mission.phase='collect';this.collectRestitutionAsset(record,officer,suspect);}else{mission.phase='deliver';this.deliverRestitutionAsset(record,officer,owner);}return true;
  }
  observationPosition(c){return c?.indoorLocation?.position||c?.entity;}
  observationScene(c){const room=c?.indoorLocation;return {buildingId:room?.buildingId??null,unitId:room?.unitId??null,floor:room?.floor??null,height:c?.skybridgeZ||0};}
  interiorLineOfSight(building,from,to,floor){
    if(!building||building.entity.destroyed)return false;const layout=interiorLayout(building),cell=point=>({x:Math.floor(point.x-building.entity.x),y:Math.floor(point.y-building.entity.y),z:floor}),nodeAt=p=>layout.nodes.get(`${p.x},${p.y},${p.z}`),start=cell(from),end=cell(to);if(!nodeAt(start)||!nodeAt(end))return false;
    const connected=(a,b)=>{const node=nodeAt(a),next=nodeAt(b);return !!node&&!!next&&(layout.neighbors.get(node.key)||[]).includes(next.key);};
    const transition=(a,b)=>{const dx=b.x-a.x,dy=b.y-a.y;if(Math.abs(dx)>1||Math.abs(dy)>1)return false;if(dx&&dy){const xFirst={x:b.x,y:a.y,z:floor},yFirst={x:a.x,y:b.y,z:floor};return connected(a,xFirst)&&connected(xFirst,b)&&connected(a,yFirst)&&connected(yFirst,b);}return connected(a,b);};
    const steps=Math.max(1,Math.ceil(dist(from,to)/.12));let previous=start;
    for(let i=1;i<=steps;i++){const t=i/steps,current=cell({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t});if(current.x===previous.x&&current.y===previous.y)continue;if(!transition(previous,current))return false;previous=current;}
    return previous.x===end.x&&previous.y===end.y;
  }
  observeThroughWindow(observer,position,scene,building){
    const unit=this.city.units?.get(scene.unitId),point=this.observationPosition(observer);if(!unit||!unit.hasWindow||unit.windowStyle==='shuttered'||unit.z!==scene.floor||!Number.isInteger(scene.floor)||scene.floor<0||!building||building.constructionKind==='open-air'||!point)return false;
    const target=buildingPoint(building,unit.x+.5,unit.y+.5),wx=building.entity.x+target.x,wy=building.entity.y+target.y,dx=point.x-wx,dy=point.y-wy,sides=[];
    const addSide=(bit,x,y,nx,ny)=>{const face=buildingPoint(building,x,y),normal=buildingPoint(building,x+nx*.1,y+ny*.1),vx=normal.x-face.x,vy=normal.y-face.y,length=Math.hypot(vx,vy)||1,along=dx*vx/length+dy*vy/length,lateral=Math.abs(dx*vy/length-dy*vx/length);if(along>.02&&lateral<=.85)sides.push({bit,x:building.entity.x+face.x,y:building.entity.y+face.y});};
    if(unit.x===0)addSide(4,unit.x,unit.y+.5,-1,0);if(unit.x===building.width-1)addSide(8,unit.x+1,unit.y+.5,1,0);if(unit.y===0)addSide(1,unit.x+.5,unit.y,0,-1);if(unit.y===building.depth-1)addSide(2,unit.x+.5,unit.y+1,0,1);
    const visibleSide=sides.find(side=>unit.z!==0||!building.door||Math.hypot(building.door.x-side.x,building.door.y-side.y)>.65);if(!visibleSide)return false;
    const eyeHeight=(observer.skybridgeZ||0)+1,targetHeight=scene.floor*CITY_FLOOR_HEIGHT+.95;if(Math.abs(eyeHeight-targetHeight)>2.2)return false;
    const samples=Math.max(1,Math.ceil(dist(point,position)/.2));for(let i=1;i<samples;i++){const t=i/samples,sx=point.x+(position.x-point.x)*t,sy=point.y+(position.y-point.y)*t;if(buildingContainsPoint(building,sx,sy))continue;if(this.city.buildings.some(other=>other.id!==building.id&&!other.entity.destroyed&&other.constructionKind!=='open-air'&&buildingContainsPoint(other,sx,sy)))return false;}
    return true;
  }
  canObserve(c,position,scene){
    if(!c||c.entity.destroyed||(c.needs?.health??100)<=20||(c.unconsciousUntil||0)>this.city.minute)return false;
    const own=this.observationScene(c),point=this.observationPosition(c);if(!point||dist(point,position)>3.2)return false;
    if(scene.buildingId!=null){const building=this.city.building(scene.buildingId);if(own.buildingId===scene.buildingId){if(own.unitId!==scene.unitId||own.floor!==scene.floor)return false;return this.interiorLineOfSight(building,point,position,scene.floor??0);}if(own.buildingId==null)return this.observeThroughWindow(c,position,scene,building);return false;}
    if(own.buildingId!=null||Math.abs(own.height-scene.height)>.5)return false;
    const steps=Math.max(1,Math.ceil(dist(point,position)/.2));
    for(let i=1;i<steps;i++){const x=point.x+(position.x-point.x)*i/steps,y=point.y+(position.y-point.y)*i/steps;
      if(this.city.buildings.some(b=>!b.entity.destroyed&&b.constructionKind!=='open-air'&&b.width>0&&b.depth>0&&buildingContainsPoint(b,x,y)))return false;
    }
    return true;
  }
  artObserverAt(c,piece,radius=2.6){
    const location=c?.indoorLocation,support=piece?.support,position=this.observationPosition(c);if(!position)return false;
    if(support?.kind==='interior-wall')return !!location&&location.buildingId===support.buildingId&&location.unitId===support.unitId&&location.floor===support.floor&&dist(position,piece.entity)<=radius;
    if(support?.kind==='roof-terrace')return !!location&&location.buildingId===support.buildingId&&location.targetRoomType==='roof_terrace'&&location.floor===support.floor&&dist(position,piece.entity)<=radius;
    if(support?.kind==='skybridge')return !location&&c.skybridgeId===support.linkId&&Math.abs((c.skybridgeZ||0)-(support.position?.z||0))<.3&&dist(position,piece.entity)<=radius;
    return !location&&dist(position,piece.entity)<=radius;
  }
  sceneIllumination(scene,position,daylight){
    const city=this.city;if(scene.buildingId==null){const lit=position&&(city.world.cityLampPosts||[]).some(post=>post.lit&&Math.hypot(post.x-position.x,post.y-position.y)<=7);return daylight?1:(lit?0.72:0.12);}
    const building=city.building(scene.buildingId),unit=city.units?.get(scene.unitId),window=!!unit?.hasWindow&&unit.windowStyle!=='shuttered';if(!building||!unit)return daylight?0.35:0.06;if(!position)return daylight?0.35:0.05;
    if(daylight)return window?0.9:0.35;if(!window)return 0.05;
    const lamp=(city.world.cityLampPosts||[]).find(post=>post.lit&&Math.hypot(post.x-position.x,post.y-position.y)<=8&&(()=>{const steps=Math.max(1,Math.ceil(Math.hypot(post.x-position.x,post.y-position.y)/.25));for(let i=1;i<steps;i++){const x=post.x+(position.x-post.x)*i/steps,y=post.y+(position.y-post.y)*i/steps;if(buildingContainsPoint(building,x,y))continue;if(city.buildings.some(other=>other.id!==building.id&&!other.entity.destroyed&&other.constructionKind!=='open-air'&&buildingContainsPoint(other,x,y)))return false;}return true;})());return lamp?0.42:0.08;
  }
  crimeRecord(type,offenderId,victimId,details={},{observe=true,occurredAt=this.city.minute}={}){
    const rule=this.policies.penalCode[type]||{criminal:true,severity:50,fine:0,politicalDisqualification:false};
    if(!rule.criminal||type==='graffiti'&&((rule.ownerConsentDefense&&details.ownerAuthorized)||(rule.exemptArtworkKinds||[]).includes(details.artworkKind))||type==='vandalism'&&(details.damage??0)<(rule.minimumDamage||0))return null;
    const city=this.city,source=city.society.citizen(offenderId)||city.society.citizen(victimId),scene=details.scene||this.observationScene(source),position=details.useExactPosition?details.position:scene.buildingId!=null?this.observationPosition(source):details.position||this.observationPosition(source)||null,daylight=city.hour>=7&&city.hour<19,priorConviction=Number.isInteger(offenderId)&&this.cases.some(previous=>previous.type===type&&previous.status==='convicted'&&(previous.chargedCitizenId??previous.offenderId)===offenderId&&previous.convictionAnnulledAt==null&&previous.decriminalizedAt==null&&previous.verdictAt!=null&&previous.verdictAt<=occurredAt),recidivismBonus=priorConviction?Math.max(0,Math.min(50,Math.floor(rule.recidivismSeverityBonus||0))):0,effectiveRule={...rule,severity:Math.min(100,(rule.severity??50)+recidivismBonus)};
    const visibility=this.sceneIllumination(scene,position,daylight),witnesses=[];
    if(observe&&position)for(const witness of city.citizens){
      if(witness.id===offenderId||!this.canObserve(witness,position,scene))continue;
      const distance=dist(position,this.observationPosition(witness)),patrolling=this.policeOnDuty(witness),attention=this.skillFactor(witness,'investigation')*(patrolling?1.2+(witness.skills?.investigation||0)/500:1),confidence=Math.max(0,Math.min(1,(1-distance/4)*visibility*(.72+(witness.traits?.skepticism??.5)*.28)*attention));
      if(city.random()<confidence)witnesses.push({citizenId:witness.id,confidence,identifiedSuspectId:confidence>(patrolling ? .55 : .72)?offenderId:null,noticedAt:city.minute,scene:{...scene},role:patrolling?'police-officer':null});
    }
    const record={id:this.nextCaseId++,type,offenderId,victimId,occurredAt,scene:{...scene},visibility,position:position?{x:position.x,y:position.y}:null,reportedAt:null,status:'unreported',severity:effectiveRule.severity,baseSeverity:rule.severity??50,recidivismApplied:recidivismBonus>0,originalRule:{...effectiveRule},rule:{...effectiveRule},penalCodeRevision:this.penalCodeRevision||0,evidence:[],witnesses,witnessIds:witnesses.map(w=>w.citizenId),investigation:null,trial:null,details:{...details,...(recidivismBonus?{recidivismApplied:true,recidivismBonus}:{})}};
    this.cases.push(record);record.eventId=this.city.log(`Registro de ocorrência: ${type}.`,'justice',[offenderId,victimId].filter(Number.isInteger),{kind:'crime-recorded',caseId:record.id,crime:type}).id;this.rememberObservedCrime(record);this.dispatchPoliceResponse(record);return record;
  }
  recordTrespassUse(c,building,facility){
    const city=this.city;c.trespassHistory??={};const previous=c.trespassHistory[building.id];if(previous!=null&&city.minute-previous<1440)return null;
    const record=this.crimeRecord('trespass',c.id,building.ownerId??null,{buildingId:building.id,facilityId:facility.id,purpose:'unauthorized-bathroom-use',ownerAccountId:building.accountId,serviceValue:facility.price||0,position:{x:c.indoorLocation?.position?.x??c.entity.x,y:c.indoorLocation?.position?.y??c.entity.y}});
    if(record){c.trespassHistory[building.id]=city.minute;record.details.ownerAccountId=building.accountId;record.details.physicalUseAt=city.minute;}
    return record;
  }
  report(caseId,reporterId){
    const city=this.city,record=this.cases.find(c=>c.id===caseId),reporter=city.society.citizen(reporterId);if(!record||!reporter||reporter.entity.destroyed||record.status==='reported'||record.status==='investigating')return false;
    const station=this.activeBuildings('police_station').filter(b=>this.staffed(b)>0).sort((a,b)=>dist(a.door,reporter.entity)-dist(b.door,reporter.entity))[0];if(!station){reporter.action='Não há uma delegacia com atendimento disponível';return false;}
    record.status='reporting';record.reporterId=reporterId;record.reportingStationId=station.id;record.reportStartedAt=city.minute;reporter.justiceReportCaseId=record.id;reporter.task='justice-report';reporter.action=`Indo registrar o BO na delegacia`;return true;
  }
  arriveToReport(c){const city=this.city,record=this.cases.find(r=>r.id===c.justiceReportCaseId),station=city.building(record?.reportingStationId);if(!record||record.status!=='reporting'||!station){c.justiceReportCaseId=null;c.task=null;c.targetId=null;return false;}if(Math.hypot(c.entity.x-station.door.x,c.entity.y-station.door.y)>1.5){const path=city.findPath(c.entity,station.door);if(path===null){record.status='unreported';c.justiceReportCaseId=null;c.task=null;c.targetId=null;return false;}c.targetId=station.id;c.path=path;if(!path.length){c.path=[{x:station.door.x,y:station.door.y}];}return false;}record.reportedAt=city.minute;record.status='reported';record.statement={reporterId:c.id,description:`${c.entity.properties.name} compareceu pessoalmente à delegacia.`,confidence:record.witnesses.find(w=>w.citizenId===c.id)?.confidence??.35};c.justiceReportCaseId=null;c.task=null;c.targetId=null;c.action='Registrou um boletim de ocorrência';city.log(`BO #${record.id} registrado por ${c.entity.properties.name} na delegacia.`,'justice',[c.id,record.victimId].filter(Number.isInteger),{kind:'crime-reported',caseId:record.id,buildingId:station.id});return true;}
  dispatchReports(){
    const city=this.city;if(!this.activeBuildings('police_station').some(b=>this.staffed(b)>0))return;
    for(const record of this.cases){
      if(record.status==='reporting'){
        const reporter=city.society.citizen(record.reporterId);if(!reporter||reporter.entity.destroyed||reporter.task!=='justice-report'){record.status='unreported';if(reporter?.justiceReportCaseId===record.id)reporter.justiceReportCaseId=null;record.reporterId=null;}
      }
      if(record.status!=='unreported')continue;
      const victim=city.society.citizen(record.victimId),available=c=>c&&!c.entity.destroyed&&c.needs.health>20&&!c.custody&&!c.justiceReportCaseId&&!city.urgentNeed?.(c);
      if(record.type==='defamation'&&!record.discovery){const work=this.art.find(piece=>piece.id===record.details?.artId);if(work?.seenBy?.[victim?.id]!=null)record.discovery={citizenId:victim.id,noticedAt:work.seenBy[victim.id],basis:'public-art-accusation'};}
      if(record.stolenAsset&&victim&&!victim.entity.destroyed&&city.minute-record.occurredAt>=30&&!record.discovery)record.discovery={citizenId:victim.id,noticedAt:city.minute,basis:'missing-property'};
      const victimAware=record.witnesses.some(w=>w.citizenId===victim?.id)||record.discovery?.citizenId===victim?.id;
      const reporter=available(victim)&&victimAware?victim:record.witnesses.map(w=>city.society.citizen(w.citizenId)).find(available);
      if(reporter&&this.report(record.id,reporter.id))break;
    }
  }
  referCorruption(source){
    if(source.discoveredAt==null)return null;
    let record=this.cases.find(r=>r.details.corruptionCaseId===source.id);if(record)return record;
    record=this.crimeRecord('corruption',source.accusedId,null,{corruptionCaseId:source.id,complaintSuspectId:source.accusedId,participantIds:[...(source.participantIds||[])],source:'financial-complaint'},{observe:false,occurredAt:source.occurredAt});if(!record)return null;
    record.status='reported';record.reportedAt=this.city.minute;record.reportSource='financial-complaint';
    if(source.evidenceEventId!=null)record.evidence.push({kind:'financial-record',eventId:source.evidenceEventId,recordedAt:this.city.minute,implicatedCitizenId:source.accusedId,confidence:Math.min(.95,Math.max(.25,Number(source.evidence)||.25)),amount:source.amount});
    source.justiceCaseId=record.id;source.policeInvestigationStatus='awaiting-police';source.legacyLegislativeConvictedIds??=[...(source.convictedIds||[])];source.convictedIds=[];
    this.city.log(`A denúncia de corrupção #${source.id} foi encaminhada à polícia como caso #${record.id}.`,'justice',[],{kind:'corruption-referred-police',caseId:record.id,corruptionCaseId:source.id});return record;
  }
  syncCorruptionOutcome(record){
    const source=this.city.politics?.corruption?.find(r=>r.id===record.details?.corruptionCaseId);if(!source)return;
    source.justiceCaseId=record.id;source.judicialStatus=record.status;source.policeInvestigationStatus=record.investigation?.status||'awaiting-police';source.convictedIds??=[];
    const defendant=record.chargedCitizenId;if(defendant==null)return;
    if(record.status==='convicted'){source.proven=true;source.provenAt??=this.city.minute;if(!source.convictedIds.includes(defendant))source.convictedIds.push(defendant);}else source.convictedIds=source.convictedIds.filter(id=>id!==defendant);
  }
  offerPoliceBribe(caseId,payerId,amount){return offerPoliceBribe(this,this.cases.find(r=>r.id===caseId),this.city.society.citizen(payerId),amount);}
  offerWitnessBribe(caseId,payerId,witnessId,amount){return offerWitnessBribe(this,this.cases.find(r=>r.id===caseId),this.city.society.citizen(payerId),this.city.society.citizen(witnessId),amount);}
  offerJudgeBribe(caseId,payerId,amount){return offerJudgeBribe(this,this.cases.find(r=>r.id===caseId),this.city.society.citizen(payerId),amount);}
  offerForensicBribe(bodyId,payerId,amount){const body=this.bodies.find(b=>b.id===bodyId);return offerForensicBribe(this,body,this.city.society.citizen(payerId),this.city.society.citizen(body?.forensicExaminerId),amount);}
  updateInvestigations(){
    const city=this.city,stations=this.activeBuildings('police_station').filter(b=>this.staffed(b)>0);if(!stations.length&&!this.cases.some(r=>r.status==='investigating'&&r.investigation?.fieldwork&&!r.investigation.completedAt))return;
    for(const record of this.cases){
      if(record.status==='no-suspect'&&record.investigation?.finishedAt!=null&&Number.isInteger(record.investigation.evidenceCountAtConclusion)&&record.evidence.length>record.investigation.evidenceCountAtConclusion){
        const previous=record.investigation,newEvidence=record.evidence.slice(previous.evidenceCountAtConclusion);previous.reopenedAt=city.minute;previous.reopenedForEvidence=newEvidence.map(e=>e.kind);record.pastInvestigations??=[];record.pastInvestigations.push(structuredClone(previous));record.investigation=null;record.status='reported';record.reportedAt=city.minute;record.reportSource='new-evidence';record.investigationWaitingReason='Nova prova recebida; aguardando nova diligência e entrevistas';city.log(`O caso #${record.id}, antes sem suspeito, foi reaberto após o registro de nova prova.`,'justice',[record.victimId].filter(Number.isInteger),{kind:'investigation-reopened-new-evidence',caseId:record.id,evidenceKinds:newEvidence.map(e=>e.kind)});
      }
      if(record.status==='arrested'){const suspect=city.society.citizen(record.chargedCitizenId??record.investigation?.suspectId);if(suspect?.custody?.status==='in-transit'&&record.arrestEscort?.status!=='in-progress')this.arrest(record.id,suspect.id);continue;}
      if(record.status==='arrest-requested'){const suspect=city.society.citizen(record.investigation?.suspectId),protectedMember=this.policies.parliamentaryImmunity&&city.politics.council.members.some(m=>m.citizenId===suspect?.id);if(!protectedMember||record.immunityAuthorization==='approved')this.arrest(record.id,suspect?.id);continue;}
      if(record.status==='arrest-requested'&&record.immunityAuthorization==='approved'){this.arrest(record.id,record.investigation?.suspectId);continue;}
      if(record.status==='reported'&&!record.investigation){if(!stations.length)continue;const availableStations=[...stations].sort((a,b)=>Number(b.id===record.reportingStationId)-Number(a.id===record.reportingStationId)),needsFieldwork=!!record.position&&typeof city.findPath==='function'&&(record.scene?.buildingId==null||!!city.building(record.scene.buildingId)),assignment=availableStations.map(station=>({station,officer:station.workers.map(id=>city.society.citizen(id)).find(c=>c&&c.id!==record.details?.investigatorUnderReviewId&&c.id!==record.details?.excludedOfficerId&&c.id!==record.details?.payerId&&c.id!==record.details?.witnessId&&!c.entity.destroyed&&c.jobId===station.id&&!c.policeAudit&&!c.policePatrol&&!c.policeInvestigation&&!c.custodyEscort&&!c.policeResponse&&!c.policeRestitution&&!c.deliveryId&&!c.cleaningJobId&&!c.mechanicJob&&!c.mobilityTrip&&!city.urgentNeed?.(c)&&!this.cases.some(other=>other!==record&&other.status==='investigating'&&other.investigation?.officerId===c.id))})).find(a=>a.officer);if(!assignment){record.investigationWaitingReason=record.details?.investigatorUnderReviewId!=null||record.details?.excludedOfficerId!=null?'Aguardando investigador independente, sem vínculo com o caso original':'Aguardando investigador disponível';continue;}const {station,officer}=assignment;record.investigationWaitingReason=null;if(!officer)continue;if(needsFieldwork)station.policeInvestigatorId=officer.id;this.startPoliceInvestigation(record,station,officer);continue;}
      if(record.status!=='investigating'||!record.investigation)continue;
      considerPoliceBribe(this,record);
      considerWitnessBribe(this,record);
      const officer=city.society.citizen(record.investigation.officerId);if(record.investigation.fieldwork&&!record.investigation.completedAt){if(!officer||officer.entity.destroyed||officer.policeInvestigation?.caseId!==record.id){record.investigation.blockedReason='agente morreu ou saiu do serviço';record.investigation.fieldworkResult='interrupted';record.investigation.completedAt=city.minute;record.investigation.concludesAt=city.minute;record.investigation.phase='analysis';const station=city.building(record.investigation.stationId);if(station?.policeInvestigatorId===record.investigation.officerId)station.policeInvestigatorId=null;}else continue;}if(city.minute<(record.investigation.concludesAt??Infinity))continue;
      const investigation=record.investigation,interviewLeads=investigation.fieldwork?(investigation.interviewEvidence||[]).filter(e=>e.identifiedSuspectId!=null).map(e=>({...e,citizenId:e.witnessId})):record.witnesses.filter(w=>w.identifiedSuspectId!=null),bribe=investigation.bribe,suppressedId=bribe?.status==='paid'?bribe.payerId:null,witnesses=interviewLeads.filter(w=>w.identifiedSuspectId!==suppressedId).sort((a,b)=>b.confidence-a.confidence),document=record.evidence.find(e=>['financial-record','investigation-record'].includes(e.kind)&&e.implicatedCitizenId!=null&&e.implicatedCitizenId!==suppressedId),lead=witnesses[0]||(document?{identifiedSuspectId:document.implicatedCitizenId,confidence:Math.min(.95,Math.max(document.confidence,.6+(officer?.skills?.investigation||0)/250+(officer?.traits?.honesty??.5)*.18)),documentEventId:document.eventId}:null),honesty=officer?.traits?.honesty??.5,successChance=Math.max(.05,Math.min(.98,(lead?.confidence??.08)*.72+honesty*.28));let suspectId=null,fraud=false;
      if(suppressedId!=null)investigation.suppressedLeads={payerId:suppressedId,witnesses:structuredClone(interviewLeads.filter(w=>w.identifiedSuspectId===suppressedId)),documents:structuredClone(record.evidence.filter(e=>e.implicatedCitizenId===suppressedId)),minute:city.minute};
      if(lead&&city.random()<successChance)suspectId=lead.identifiedSuspectId;
      else if(lead&&city.random()>honesty*.75){const mayor=city.society.citizen(city.economy.mayorId),opponents=city.citizens.filter(c=>!c.entity.destroyed&&c.id!==lead?.identifiedSuspectId&&c.id!==officer?.id&&mayor&&c.political?.partyId!==mayor.political?.partyId),candidates=opponents.length?opponents:city.citizens.filter(c=>!c.entity.destroyed&&c.id!==lead?.identifiedSuspectId&&c.id!==officer?.id);suspectId=candidates[Math.floor(city.random()*Math.max(1,candidates.length))]?.id??null;fraud=suspectId!=null;}
      const interviewRecords=(investigation.fieldwork?investigation.interviewEvidence||[]:[]).map((statement,sourceInterviewIndex)=>({...structuredClone(statement),sourceInterviewIndex})),reportedInterviews=interviewRecords.slice();
      if(fraud&&officer){const contradictory=interviewRecords.filter(statement=>statement.identifiedSuspectId!=null&&statement.identifiedSuspectId!==suspectId&&(statement.confidence??0)>=.55).sort((a,b)=>(b.confidence||0)-(a.confidence||0))[0],concealChance=Math.max(0,Math.min(.65,(1-honesty)*.55+(officer.traits?.riskTolerance??.5)*.1));if(contradictory&&city.random()<concealChance)reportedInterviews.splice(reportedInterviews.findIndex(statement=>statement.sourceInterviewIndex===contradictory.sourceInterviewIndex),1);}
      const filedEvidence=lead?[{kind:lead.documentEventId!=null?'document-analysis':lead.kind==='police-interview'?'police-interview':'witness-identification',witnessId:lead.witnessId??lead.citizenId??null,reportedSuspectId:lead.identifiedSuspectId??null,identifiedSuspectId:suspectId,sourceEventId:lead.documentEventId??null,sourceInterviewEventId:lead.kind==='police-interview'?lead.sourceEventId??null:null,confidence:lead.confidence,recordedAt:city.minute,...(lead.bribeEffect?{bribeEffect:lead.bribeEffect}:{})}]:[];
      if(fraud&&officer&&investigation.fieldwork){const interviewed=new Set(interviewRecords.map(statement=>statement.witnessId)),refused=record.witnesses.filter(witness=>witness.interviewStatus==='declined'&&witness.identifiedSuspectId!=null&&witness.identifiedSuspectId!==suspectId&&!interviewed.has(witness.citizenId)).sort((a,b)=>(b.confidence||0)-(a.confidence||0))[0],forgeChance=Math.max(0,Math.min(.22,.02+(1-honesty)*.15+(officer.traits?.riskTolerance??.5)*.05));if(refused&&city.random()<forgeChance)filedEvidence.push({kind:'police-interview',witnessId:refused.citizenId,reportedSuspectId:suspectId,identifiedSuspectId:suspectId,sourceEventId:null,sourceInterviewEventId:null,confidence:Math.max(.35,Math.min(.8,refused.confidence||.5)),recordedAt:city.minute,interviewerId:officer.id});}
      record.investigation={...record.investigation,finishedAt:city.minute,status:suspectId==null?'inconclusive':'suspect-identified',suspectId,fraud,...(investigation.fieldwork?{reportedInterviews}:{}),evidence:filedEvidence};record.evidence.push(...record.investigation.evidence);if(investigation.fieldwork){const reportEvent=city.log(`O relatório policial do caso #${record.id} registrou ${reportedInterviews.length} de ${interviewRecords.length} entrevistas presenciais.`,'justice',[officer?.id].filter(Number.isInteger),{kind:'investigation-interview-report',caseId:record.id,capturedInterviewCount:interviewRecords.length,submittedInterviewCount:reportedInterviews.length,submittedInterviewIndexes:reportedInterviews.map(statement=>statement.sourceInterviewIndex)});record.investigation.interviewReportEventId=reportEvent.id;}record.investigation.evidenceCountAtConclusion=record.evidence.length;const corruption=city.politics?.corruption?.find(r=>r.id===record.details?.corruptionCaseId);if(corruption){corruption.policeInvestigationStatus=record.investigation.status;if(document&&suspectId===document.implicatedCitizenId&&!fraud&&lead.confidence>=.8){corruption.proven=true;corruption.provenAt=city.minute;corruption.evidence=Math.max(corruption.evidence||0,lead.confidence);}}record.status=suspectId==null?'no-suspect':record.rule.fineOnly?'charged':'arrest-requested';if(record.rule.fineOnly&&suspectId!=null)record.chargedCitizenId=suspectId;const station=city.building?.(record.investigation.stationId);if(station?.policeInvestigatorId===officer?.id)station.policeInvestigatorId=null;city.log(suspectId==null?`A investigação do BO #${record.id} terminou sem suspeito identificado.`:`A investigação do BO #${record.id} apontou ${city.accountName(`citizen:${suspectId}`)}.`,'justice',[officer?.id,suspectId].filter(Number.isInteger),{kind:'investigation-concluded',caseId:record.id,suspectId,fraud});
    }
  }
  requestArrest(caseId){const record=this.cases.find(r=>r.id===caseId),suspect=this.city.society.citizen(record?.investigation?.suspectId);if(!record||!suspect||record.status!=='arrest-requested')return false;record.arrestRequestedAt=this.city.minute;if(this.city.justice.policies.parliamentaryImmunity&&this.city.politics.council.members.some(m=>m.citizenId===suspect.id)){record.immunityAuthorization='required';return 'authorization-required';}return this.arrest(caseId,suspect.id);}
  authorizeArrest(caseId,billId){const record=this.cases.find(r=>r.id===caseId);if(!record||!['arrest-requested','convicted'].includes(record.status))return false;record.immunityAuthorization='approved';record.authorizationBillId=billId;if(record.status==='convicted')this.enforceSentence(record);else this.arrest(caseId,record.investigation.suspectId);return true;}
  jailCapacity(jail){const footprint=Math.max(1,Math.floor((jail.width||3)*(jail.depth||3)*(jail.floors||1)/4));return jail?.units?.length?this.jailCells(jail).length:footprint;}
  jailCells(jail){
    if(!Array.isArray(jail?.units)||!jail.units.length)return [];
    const target=Math.max(1,Math.floor((jail.width||3)*(jail.depth||3)*(jail.floors||1)/4)),busy=new Set((jail.workers||[]).map(id=>this.city.society.citizen(id)).filter(Boolean).flatMap(c=>[c.workCell?.unitId,c.indoorLocation?.targetUnitId,c.indoorLocation?.unitId]).filter(Boolean)),eligible=jail.units.filter(u=>u.roomType!=='bathroom'&&u.roomType!=='dining'&&(!busy.has(u.id)||u.detentionCell)).sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));
    const selected=[...eligible.filter(u=>u.detentionCell),...eligible.filter(u=>!u.detentionCell)].slice(0,target),selectedIds=new Set(selected.map(u=>u.id));
    let changed=false;for(const unit of selected)if(unit.roomType!=='cell'||!unit.detentionCell){unit.roomType='cell';unit.detentionCell=true;changed=true;}
    for(const unit of jail.units)if(unit.detentionCell&&!selectedIds.has(unit.id)){delete unit.detentionCell;if(unit.roomType==='cell')unit.roomType='workspace';changed=true;}
    if(changed){jail.layoutRevision=(jail.layoutRevision||0)+1;this.city.structureRevision=(this.city.structureRevision||0)+1;}
    return jail.units.filter(u=>u.detentionCell);
  }
  jailOccupancy(jail){const people=this.city.citizens||this.cases.map(r=>this.city.society.citizen(r.chargedCitizenId??r.investigation?.suspectId));return new Set(people.filter(c=>c&&!c.entity.destroyed&&c.custody?.jailId===jail.id).map(c=>c.id)).size;}
  freeJailCell(jail){const cells=this.jailCells(jail);if(!cells.length)return null;const reserved=new Set((this.city.citizens||[]).filter(c=>!c.entity.destroyed&&c.custody?.jailId===jail.id).map(c=>c.custody.cellUnitId).filter(Boolean));return cells.find(u=>!reserved.has(u.id))||null;}
  custodyPlace(c){
    const sites=this.activeBuildings('jail').filter(b=>this.staffed(b)>0).sort((a,b)=>dist(a.door,c.entity)-dist(b.door,c.entity));let vacancy=false;
    for(const jail of sites){if(this.jailOccupancy(jail)>=this.jailCapacity(jail))continue;vacancy=true;const path=this.city.findPath(c.entity,jail.door);if(path!==null)return {jail,path,cellUnitId:this.freeJailCell(jail)?.id??null};}
    return {reason:!sites.length?'awaiting-jail':!vacancy?'awaiting-jail-space':'unreachable'};
  }
  arrest(caseId,suspectId){
    const city=this.city,record=this.cases.find(r=>r.id===caseId),suspect=city.society.citizen(suspectId),existingCustody=suspect?.custody?.caseId===record?.id&&['awaiting-escort','in-transit'].includes(suspect.custody.status),resumingEscort=record?.status==='arrested'&&suspect?.custody?.status==='in-transit';if(!record||!suspect||suspect.entity.destroyed||suspect.dead||suspect.custody&&!existingCustody||record.investigation?.suspectId!==suspect.id||!['arrest-requested','arrested'].includes(record.status)||record.status==='arrested'&&!resumingEscort)return false;
    if(record.arrestEscort?.status==='in-progress'){const current=city.society.citizen(record.arrestEscort.officerId);if(current&&!current.entity.destroyed&&current.policeArrestEscort===record.arrestEscort)return true;record.arrestEscort.status='interrupted';record.arrestEscort.interruptedAt=city.minute;record.arrestEscort.reason='agente indisponível; aguardando outra equipe';if(current?.policeArrestEscort===record.arrestEscort)current.policeArrestEscort=null;}
    const isCouncilor=city.politics.council.members.some(m=>m.citizenId===suspect.id);if(this.policies.parliamentaryImmunity&&isCouncilor&&record.immunityAuthorization!=='approved')return false;
    if(record.rule.fineOnly)return false;let jail,cellUnitId;if(existingCustody){jail=city.building(suspect.custody.jailId);cellUnitId=suspect.custody.cellUnitId;}else{const place=this.custodyPlace(suspect);if(!place.jail){record.arrestWaitingReason=place.reason;record.arrestQueuedAt??=city.minute;return false;}jail=place.jail;cellUnitId=place.cellUnitId;}
    const assignedStation=city.building(record.investigation?.stationId),stations=this.activeBuildings('police_station').filter(b=>b.workers?.length).sort((a,b)=>Number(b.id===assignedStation?.id)-Number(a.id===assignedStation?.id));let station=null,officer=null;for(const candidate of stations){const available=(candidate.workers||[]).map(id=>city.society.citizen(id)).find(c=>c&&!c.entity.destroyed&&c.jobId===candidate.id&&c.task==='work'&&!c.indoorLocation?.path?.length&&!c.path.length&&!c.policeAudit&&!c.policePatrol&&!c.policeResponse&&!c.policeInvestigation&&!c.policeRestitution&&!c.policeArrestEscort&&!c.custodyEscort&&!c.funeralBodyId&&!c.deliveryId&&!city.urgentNeed?.(c));if(available){station=candidate;officer=available;break;}}if(!station||station.entity.destroyed||!officer){record.arrestWaitingReason='aguardando policial disponível em uma delegacia';record.arrestQueuedAt??=city.minute;return false;}
    record.arrestWaitingReason=null;record.jailId=jail.id;record.chargedCitizenId=suspect.id;record.arrestEscort={status:'in-progress',caseId:record.id,officerId:officer.id,suspectId:suspect.id,stationId:station.id,jailId:jail.id,cellUnitId,phase:suspect.custody?.status==='in-transit'?'to-jail':'to-suspect',assignedAt:city.minute,lastPaidMinute:null};officer.policeArrestEscort=record.arrestEscort;officer.task='police-arrest-escort';officer.path=[];officer.targetId=null;officer.action=`Indo buscar ${suspect.entity.properties.name} para o caso #${record.id}`;
    if(!resumingEscort){suspect.custody={...(suspect.custody||{}),caseId:record.id,jailId:jail.id,cellUnitId,status:'awaiting-escort',arrestingOfficerId:officer.id,releaseAt:null};suspect.task='custody';suspect.path=[];suspect.targetId=jail.id;suspect.action='Aguardando escolta policial para a cadeia';}else{suspect.custody.arrestingOfficerId=officer.id;}
    city.log(`A polícia enviou ${officer.entity.properties.name} para buscar fisicamente ${suspect.entity.properties.name} no caso #${record.id}.`,'justice',[officer.id,suspect.id],{kind:'arrest-escort-dispatched',caseId:record.id,buildingId:station.id,jailId:jail.id});
    return true;
  }
  recordArrestSearch(officer,suspect,record){
    const city=this.city;if(record.arrestEscort?.searchedAt!=null)return record.searches?.find(item=>item.minute===record.arrestEscort.searchedAt&&item.officerId===officer.id)||null;const weapon=suspect.equipment?.weapon||null,found=[];if(weapon){const good=weapon.good;suspect.inventory??={};officer.inventory??={};if((suspect.inventory[good]||0)>0&&inventoryFree(officer)>0){suspect.inventory[good]--;officer.inventory[good]=(officer.inventory[good]||0)+1;const lots=[];for(const lot of [...(suspect.inventoryProvenance||[])].filter(item=>item.good===good)){if(!lot.quantity)continue;lot.quantity--;lots.push({...lot,quantity:1});if(lot.quantity<=0)suspect.inventoryProvenance.splice(suspect.inventoryProvenance.indexOf(lot),1);break;}if(lots.length){officer.inventoryProvenance??=[];officer.inventoryProvenance.push(...lots);}suspect.equipment.weapon=null;found.push({kind:'weapon',good,name:weapon.name,durability:weapon.durability,provenance:lots});}}
    const search={officerId:officer.id,suspectId:suspect.id,minute:city.minute,position:{x:suspect.entity.x,y:suspect.entity.y},scene:{...this.observationScene(suspect)},items:found};record.searches??=[];record.searches.push(search);record.evidence??=[];record.evidence.push({kind:'police-search',officerId:officer.id,found:found.map(item=>({kind:item.kind,good:item.good,name:item.name})),recordedAt:city.minute,scene:{...search.scene}});record.arrestEscort.searchedAt=city.minute;record.arrestEscort.searchedBy=officer.id;
    city.log(found.length?`${officer.entity.properties.name} revistou ${suspect.entity.properties.name} e recolheu ${found.map(item=>item.name).join(', ')}.`:`${officer.entity.properties.name} revistou ${suspect.entity.properties.name}; nenhum objeto perigoso foi encontrado.`,'justice',[officer.id,suspect.id],{kind:'police-search-completed',caseId:record.id,items:found.map(item=>({good:item.good,name:item.name}))});return search;
  }
  beginArrestEscortToJail(record,officer,suspect,jail){
    const city=this.city,officerPath=city.findPath(officer.entity,jail.door),suspectPath=city.findPath(suspect.entity,jail.door);if(officerPath===null||suspectPath===null){record.arrestWaitingReason='sem rota física de escolta até a cadeia';record.arrestEscort.waitingReason=record.arrestWaitingReason;return false;}
    record.arrestEscort.phase='to-jail';record.arrestEscort.waitingReason=null;record.arrestedAt??=city.minute;record.status='arrested';suspect.custody.status='in-transit';suspect.custody.releaseAt=city.minute+Math.max(360,record.severity*18);suspect.custody.arriveBy=city.minute+Math.max(60,suspectPath.length*8);suspect.path=suspectPath;suspect.targetId=jail.id;suspect.action='Sendo conduzido à cadeia sob escolta';officer.path=officerPath;officer.targetId=jail.id;officer.action=`Escoltando ${suspect.entity.properties.name} até a cadeia`;
    if(suspect.funeralBodyId){const body=this.bodies.find(item=>item.id===suspect.funeralBodyId);if(body)this.cancelBodyTransport(body,'Coleta interrompida pela prisão do funcionário');}this.recoverVehiclesOnArrest(suspect);this.recoverStolenAsset(record,suspect);this.applyMandateCassation(record,'arrest');city.log(`${officer.entity.properties.name} iniciou a escolta física de ${suspect.entity.properties.name} até ${jail.entity.properties.name}.`,'justice',[officer.id,suspect.id],{kind:'arrest-escort-started',caseId:record.id,buildingId:jail.id});return true;
  }
  pausePoliceArrestEscort(officer,suspect,record,mission,reason){
    mission.waitingReason=reason;mission.pauseMinute=this.city.minute;record.arrestWaitingReason=reason;officer.path=[];if(officer.indoorLocation?.path?.length)officer.indoorLocation.path=[];if(suspect?.custody?.status==='in-transit'){suspect.path=[];if(suspect.indoorLocation?.path?.length)suspect.indoorLocation.path=[];suspect.action='Aguardando policial para retomar a escolta até a cadeia';}return false;
  }
  updatePoliceArrestEscort(officer){
    const city=this.city,mission=officer.policeArrestEscort,record=this.cases.find(item=>item.id===mission?.caseId),suspect=city.society.citizen(mission?.suspectId),station=city.building(mission?.stationId),jail=city.building(mission?.jailId);if(!mission)return false;if(!record||!suspect||!station||!jail){mission.status='interrupted';mission.interruptedAt=city.minute;mission.waitingReason='pessoa, delegacia ou cadeia não está disponível';if(record)record.arrestWaitingReason=mission.waitingReason;officer.path=[];if(officer.indoorLocation?.path?.length)officer.indoorLocation.path=[];if(suspect?.custody?.status==='in-transit'){suspect.path=[];if(suspect.indoorLocation?.path?.length)suspect.indoorLocation.path=[];suspect.action='Aguardando policial para retomar a escolta até a cadeia';}officer.policeArrestEscort=null;officer.task='work';return false;}
    if(!station.active||station.entity.destroyed||!jail.active||jail.entity.destroyed||officer.jobId!==station.id||officer.entity.destroyed){mission.status='interrupted';mission.interruptedAt=city.minute;this.pausePoliceArrestEscort(officer,suspect,record,mission,'agente, delegacia ou cadeia indisponível');officer.policeArrestEscort=null;officer.task='work';return false;}
    if(city.urgentNeed?.(officer))return this.pausePoliceArrestEscort(officer,suspect,record,mission,'policial atendendo necessidade urgente');
    if(mission.lastPaidMinute!==city.minute){mission.lastPaidMinute=city.minute;if(!city.payWage(officer,station))return this.pausePoliceArrestEscort(officer,suspect,record,mission,'aguardando verba salarial');}
    if(mission.phase==='to-suspect'){
      const location=suspect.indoorLocation;if(officer.indoorLocation){const room=officer.indoorLocation;if(room.path?.length)return true;if(location?.buildingId===room.buildingId&&location.unitId===room.unitId&&location.floor===room.floor&&dist(room.position||officer.entity,location.position||suspect.entity)<=1.35){this.recordArrestSearch(officer,suspect,record);mission.phase='escort-exit';this.leaveRestitutionInterior(officer,city.building(room.buildingId),mission);this.startSuspectEscortExit(suspect,mission);return true;}
        if(location?.buildingId===room.buildingId){const building=city.building(room.buildingId),unit=city.units.get(location.unitId),position=location.position||suspect.entity,path=interiorRoute(building,room.position||officer.entity,{x:position.x,y:position.y,z:(unit?.z||location.floor||0)*CITY_FLOOR_HEIGHT});if(path===null){mission.waitingReason='sem rota interna até a pessoa';return false;}room.unitId=null;room.targetUnitId=location.unitId;room.roomType='circulation';room.targetRoomType=unit?.roomType||location.roomType;room.floor=unit?.z||location.floor||0;room.path=path;room.phase=path.length?'walking':'using';return true;}
        this.leaveRestitutionInterior(officer,city.building(room.buildingId),mission);return true;}
      if(location){const building=city.building(location.buildingId);if(!building){mission.waitingReason='prédio da pessoa indisponível';return false;}if(dist(officer.entity,building.door)>1.2){const path=city.findPath(officer.entity,building.door);if(path===null){mission.waitingReason='sem rota até o prédio';return false;}officer.path=path;return true;}if(!this.enterRestitutionInterior(officer,building,location)){mission.waitingReason='sem rota interna até a pessoa';return false;}return true;}
      if(officer.path.length)return true;if(dist(officer.entity,suspect.entity)>1.35){const path=city.findPath(officer.entity,suspect.entity);if(path===null){mission.waitingReason='sem rota até a pessoa';return false;}officer.path=path;if(!path.length&&dist(officer.entity,suspect.entity)>.1)officer.path=[{x:suspect.entity.x,y:suspect.entity.y}];return true;}
      this.recordArrestSearch(officer,suspect,record);return this.beginArrestEscortToJail(record,officer,suspect,jail);
    }
    if(mission.phase==='escort-exit'){
      if(officer.indoorLocation){if(officer.indoorLocation.path?.length)return true;this.leaveRestitutionInterior(officer,city.building(officer.indoorLocation.buildingId),mission);return true;}
      if(suspect.indoorLocation){if(suspect.indoorLocation.path?.length){mission.waitingReason='pessoa aguardando saída física do prédio';return false;}this.startSuspectEscortExit(suspect,mission);mission.waitingReason='pessoa aguardando saída física do prédio';return false;}return this.beginArrestEscortToJail(record,officer,suspect,jail);
    }
    if(mission.phase==='to-jail'){
      if(officer.indoorLocation){if(officer.indoorLocation.path?.length)return true;this.leaveRestitutionInterior(officer,city.building(officer.indoorLocation.buildingId),mission);return true;}
      if(officer.path.length)return true;if(suspect.custody?.status==='detained'){mission.phase='return';mission.detainedAtJailAt=city.minute;officer.path=[];officer.targetId=station.id;officer.action=`Retornando à delegacia após conduzir ${suspect.entity.properties.name}`;return true;}if(dist(officer.entity,jail.door)>1.2){const path=city.findPath(officer.entity,jail.door);if(path===null){mission.waitingReason='sem rota até a cadeia';return false;}officer.path=path;return true;}mission.waitingReason='aguardando chegada da pessoa à cadeia';return false;
    }
    if(mission.phase==='return'){
      if(officer.path.length)return true;if(dist(officer.entity,station.door)>1.2){const path=city.findPath(officer.entity,station.door);if(path===null){mission.waitingReason='sem rota de retorno à delegacia';return false;}officer.path=path;return true;}mission.status='completed';mission.completedAt=city.minute;record.arrestEscortStatus='completed';officer.policeArrestEscort=null;officer.task='work';officer.targetId=station.id;officer.action='Retornou à delegacia após a escolta';record.arrestWaitingReason=null;city.log(`${officer.entity.properties.name} concluiu a escolta e retornou à delegacia.`,'justice',[officer.id,suspect.id],{kind:'arrest-escort-completed',caseId:record.id,buildingId:station.id});return true;
    }
    return true;
  }
  startSuspectEscortExit(suspect,mission){
    const building=this.city.building(suspect.indoorLocation?.buildingId),room=suspect.indoorLocation;if(!building||!room)return false;const path=interiorRoute(building,room.position||suspect.entity,{x:building.door.x,y:building.door.y,z:0});if(path===null){mission.waitingReason='sem rota interna para sair com a pessoa';return false;}room.unitId=null;room.targetUnitId=null;room.roomType='circulation';room.targetRoomType='circulation';room.exiting=true;room.phase='leaving';room.path=path;room.task='custody';suspect.task='custody';suspect.action='Saindo do prédio sob escolta policial';return true;
  }
  applyMandateCassation(record,trigger){
    if(!record?.rule?.cassation||record.rule.cassationTrigger!==trigger||record.cassatedAt!=null)return false;
    const city=this.city,citizenId=record.chargedCitizenId??record.investigation?.suspectId;if(!city.politics.cassateCriminalMandate?.(citizenId,record.id,trigger))return false;
    record.cassatedAt=city.minute;record.cassationTriggerApplied=trigger;return true;
  }
  reviewDefenseEvidence(record,defender,phase='hearing'){
    if(!record.trial||!defender||defender.entity.destroyed)return false;
    record.trial.defenseReviews??={};if(record.trial.defenseReviews[phase])return false;record.trial.defenseReviews[phase]={minute:this.city.minute,defenderId:defender.id};
    const skill=(defender.skills?.law||0)/100*this.skillFactor(defender,'law'),chance=Math.min(.95,.1+skill*.65+(defender.traits?.honesty??.5)*.15);let found=false;
    const investigation=record.investigation,interviews=investigation?.interviewEvidence||[],reportEvent=investigation?.interviewReportEventId!=null?this.city.history?.get(investigation.interviewReportEventId):null,reportedIndexes=reportEvent?.submittedInterviewIndexes??(investigation?.reportedInterviews||[]).map(statement=>statement.sourceInterviewIndex),reportedIds=new Set(reportedIndexes);if(investigation?.interviewReportEventId!=null&&Array.isArray(reportedIndexes))for(const [sourceInterviewIndex,statement]of interviews.entries()){if(reportedIds.has(sourceInterviewIndex)||statement.identifiedSuspectId==null||statement.identifiedSuspectId===investigation?.suspectId||record.evidence.some(e=>e.kind==='defense-contradiction'&&e.contradictionKind==='investigator-concealment'&&e.sourceInterviewIndex===sourceInterviewIndex)||this.city.random()>chance)continue;record.evidence.push({kind:'defense-contradiction',contradictionKind:'investigator-concealment',sourceEvidenceIndex:null,sourceInterviewIndex,originalSuspectId:statement.identifiedSuspectId,recordedSuspectId:investigation?.suspectId??null,witnessId:statement.witnessId??null,discoveredBy:defender.id,recordedAt:this.city.minute,phase,confidence:Math.min(.98,.7+skill*.25),withheldInterview:structuredClone(statement)});found=true;}
    for(const [index,evidence]of record.evidence.entries()){
      if(!['witness-identification','police-interview','document-analysis'].includes(evidence.kind))continue;
      const addContradiction=(contradictionKind,original,recorded)=>{
        if(original===recorded||record.evidence.some(e=>e.kind==='defense-contradiction'&&e.sourceEvidenceIndex===index&&e.contradictionKind===contradictionKind)||this.city.random()>chance)return;
        record.evidence.push({kind:'defense-contradiction',contradictionKind,sourceEvidenceIndex:index,originalSuspectId:original,recordedSuspectId:recorded,witnessId:evidence.witnessId??null,discoveredBy:defender.id,recordedAt:this.city.minute,phase,confidence:Math.min(.98,.7+skill*.25)});found=true;
      };
      if(evidence.kind==='police-interview'||evidence.kind==='witness-identification'){
        const witness=this.city.society.citizen(evidence.witnessId);if(!witness||witness.entity.destroyed||(witness.needs?.health??100)<=20)continue;
        const original=record.witnesses.find(w=>w.citizenId===witness.id)?.identifiedSuspectId??null;
        if(evidence.kind==='police-interview'){
          const reported=Object.hasOwn(evidence,'reportedSuspectId')?evidence.reportedSuspectId:evidence.identifiedSuspectId??null,witnessRecord=record.witnesses.find(w=>w.citizenId===witness.id),unsupportedInterview=record.investigation?.fieldwork&&Object.hasOwn(evidence,'sourceInterviewEventId')&&evidence.sourceInterviewEventId==null&&witnessRecord?.interviewStatus==='declined';if(unsupportedInterview)addContradiction('investigator-fabrication',original,evidence.identifiedSuspectId??null);else{addContradiction('witness-testimony',original,reported);addContradiction('investigator-alteration',reported,evidence.identifiedSuspectId??null);}
        }else addContradiction('investigator-alteration',original,evidence.identifiedSuspectId??null);
      }else{
        const original=record.evidence.find(e=>['financial-record','investigation-record'].includes(e.kind)&&e.eventId===evidence.sourceEventId)?.implicatedCitizenId??null;
        addContradiction('investigator-alteration',original,evidence.identifiedSuspectId??null);
      }
    }
    if(found){record.investigation??={};record.investigation.irregularityDetectedAt=this.city.minute;this.city.log(`A defesa identificou divergências entre as provas originais e o inquérito no caso #${record.id}.`,'justice',[defender.id,record.chargedCitizenId].filter(Number.isInteger),{kind:'defense-found-contradiction',caseId:record.id,phase});this.referInvestigationIrregularity(record,defender);this.referFalseTestimony(record,defender);}return found;
  }
  referInvestigationIrregularity(source,defender){
    const city=this.city,officer=city.society.citizen(source.investigation?.officerId),contradictions=(source.evidence||[]).filter(e=>e.kind==='defense-contradiction'&&e.contradictionKind!=='witness-testimony');
    if(!officer||!contradictions.length)return null;
    let inquiry=this.cases.find(r=>r.details?.reviewedCaseId===source.id&&r.type==='investigationFraud');if(inquiry)return inquiry;
    // A discovered discrepancy opens a complaint, not a determination of intent or guilt.
    inquiry=this.crimeRecord('investigationFraud',null,source.chargedCitizenId??source.investigation.suspectId,{reviewedCaseId:source.id,investigatorUnderReviewId:officer.id,complaintSuspectId:officer.id,source:'defense-review'},{observe:false});
    if(!inquiry){source.investigation.reviewReferralStatus='not-criminal';return null;}
    inquiry.position=null;inquiry.scene={buildingId:null,unitId:null,floor:null,height:0};inquiry.status='reported';inquiry.reportedAt=city.minute;inquiry.reportSource='defense-review';inquiry.statement={reporterId:defender.id,description:`A defesa apresentou divergências documentadas no inquérito #${source.id}.`,confidence:.75};
    const event=city.log(`As divergências do caso #${source.id} abriram a apuração #${inquiry.id} sobre a atuação do investigador.`,'justice',[defender.id,officer.id,inquiry.victimId].filter(Number.isInteger),{kind:'investigation-irregularity-referred',caseId:inquiry.id,reviewedCaseId:source.id,officerId:officer.id});
    const interviewReport=this.city.history?.get(source.investigation?.interviewReportEventId),originalInterviewEvidence=structuredClone(source.investigation?.interviewEvidence||[]),officialReportedInterviewIndexes=structuredClone(interviewReport?.submittedInterviewIndexes??(source.investigation?.reportedInterviews||[]).map(statement=>statement.sourceInterviewIndex)),recordedEvidence=(source.evidence||[]).flatMap((item,sourceCaseEvidenceIndex)=>['witness-identification','police-interview','document-analysis'].includes(item.kind)?[{...structuredClone(item),sourceCaseEvidenceIndex}]:[]);
    inquiry.evidence.push({kind:'investigation-record',eventId:event.id,implicatedCitizenId:officer.id,recordedAt:city.minute,confidence:.75,sourceCaseId:source.id,submittedBy:defender.id,contradictions:structuredClone(contradictions),originalWitnesses:structuredClone(source.witnesses||[]),recordedEvidence,originalInterviewEvidence,officialReportedInterviewIndexes,officialSuspectId:source.investigation?.suspectId??null,originalInvestigatorId:source.investigation?.officerId??officer.id,withheldInterviews:structuredClone(contradictions.filter(e=>e.contradictionKind==='investigator-concealment').map(e=>({sourceInterviewIndex:e.sourceInterviewIndex,statement:source.investigation?.interviewEvidence?.[e.sourceInterviewIndex]||e.withheldInterview})))});
    source.investigation.reviewCaseId=inquiry.id;source.investigation.reviewReferralStatus='reported';return inquiry;
  }
  referFalseTestimony(source,defender){
    const city=this.city,contradictions=(source.evidence||[]).filter(e=>e.kind==='defense-contradiction'&&e.contradictionKind==='witness-testimony'&&Number.isInteger(e.witnessId));if(!contradictions.length)return null;source.investigation??={};
    const referrals=[];for(const witnessId of new Set(contradictions.map(e=>e.witnessId))){const witness=city.society.citizen(witnessId);if(!witness)continue;
      let inquiry=this.cases.find(r=>r.type==='falseTestimony'&&r.details?.reviewedCaseId===source.id&&r.details?.witnessId===witnessId);
      if(!inquiry){inquiry=this.crimeRecord('falseTestimony',witnessId,source.chargedCitizenId??source.investigation?.suspectId,{reviewedCaseId:source.id,witnessId,excludedOfficerId:source.investigation?.officerId??null,source:'defense-review'},{observe:false});if(!inquiry){source.investigation.witnessTestimonyReferralStatus='not-criminal';continue;}inquiry.position=null;inquiry.scene={buildingId:null,unitId:null,floor:null,height:0};inquiry.status='reported';inquiry.reportedAt=city.minute;inquiry.reportSource='defense-review';inquiry.statement={reporterId:defender.id,description:`A defesa apresentou relatos incompatíveis atribuídos à testemunha no caso #${source.id}.`,confidence:.7};}
      const event=city.log(`Contradições no caso #${source.id} encaminharam um depoimento para apuração no caso #${inquiry.id}.`,'justice',[defender.id,witnessId,source.chargedCitizenId].filter(Number.isInteger),{kind:'false-testimony-referred',caseId:inquiry.id,reviewedCaseId:source.id,witnessId});
      if(!inquiry.evidence.some(e=>e.kind==='investigation-record'&&e.sourceCaseId===source.id))inquiry.evidence.push({kind:'investigation-record',eventId:event.id,implicatedCitizenId:witnessId,recordedAt:city.minute,confidence:.7,sourceCaseId:source.id,submittedBy:defender.id,contradictions:structuredClone(contradictions.filter(e=>e.witnessId===witnessId)),originalWitnesses:structuredClone(source.witnesses||[]),recordedEvidence:structuredClone((source.evidence||[]).filter(e=>e.kind==='police-interview'&&e.witnessId===witnessId))});
      source.investigation.falseTestimonyCaseIds??=[];if(!source.investigation.falseTestimonyCaseIds.includes(inquiry.id))source.investigation.falseTestimonyCaseIds.push(inquiry.id);source.investigation.witnessTestimonyReferralStatus='reported';referrals.push(inquiry);
    }return referrals[0]??null;
  }
  reopenBribedJudgment(conviction){
    if(conviction.type!=='judgeBribery'||conviction.status!=='convicted'||conviction.details?.role!=='recipient'||conviction.chargedCitizenId!==conviction.details?.judgeId)return false;
    const city=this.city,source=this.cases.find(r=>r.id===conviction.details.sourceCaseId),bribe=source?.trial?.judgeBribe;if(!source||bribe?.status!=='paid'||bribe.judgeId!==conviction.chargedCitizenId)return false;
    bribe.status='exposed';bribe.exposedAt=city.minute;source.pastTrials??=[];source.pastTrials.push({trial:structuredClone(source.trial),sentence:null,archivedAt:city.minute,reason:'Juiz condenado por suborno relacionado ao processo'});
    source.details??={};source.details.recusedJudgeIds??=[];if(!source.details.recusedJudgeIds.includes(bribe.judgeId))source.details.recusedJudgeIds.push(bribe.judgeId);
    source.pastSentences??=[];if(source.sentence){source.sentence.fine=0;source.sentence.suspendedAt=city.minute;source.sentence.executionStatus='judicial-integrity-review';this.refundExcessFine(source);source.pastSentences.push(structuredClone(source.sentence));source.pastTrials.at(-1).sentence=structuredClone(source.sentence);source.sentence=null;}
    if(source.reparation){source.pastReparations??=[];source.pastReparations.push(structuredClone(source.reparation));source.reparation.civilEnforceable=false;source.reparation.suspendedAt=city.minute;}
    const defendant=city.society.citizen(source.chargedCitizenId),previousStatus=source.status;source.trial=null;source.reopenedJudgmentAt=city.minute;source.reopenedJudgmentByCaseId=conviction.id;source.judicialReviewReason='Condenação do juiz por suborno';
    if(!defendant||defendant.entity.destroyed){source.status='closed';source.closedAt=city.minute;source.closureReason='Decisão anulada após condenação do juiz; réu falecido, sem possibilidade de novo julgamento';source.convictionAnnulledAt=city.minute;source.sentence=null;city.log(`A decisão do processo #${source.id} foi anulada após a condenação do juiz no caso #${conviction.id}; não haverá novo julgamento porque o réu faleceu.`,'justice',[bribe.judgeId].filter(Number.isInteger),{kind:'bribed-judgment-vacated',caseId:source.id,corruptionCaseId:conviction.id,judgeId:bribe.judgeId,previousStatus});return true;}
    if(defendant.custody?.caseId===source.id)this.release(defendant,'Reabertura do processo após condenação do juiz por suborno');source.status='charged';
    city.log(`O processo #${source.id} foi reaberto após a condenação do juiz no caso #${conviction.id}; a decisão anterior foi arquivada e será designado outro juiz.`,'justice',[source.chargedCitizenId,bribe.judgeId].filter(Number.isInteger),{kind:'bribed-judgment-reopened',caseId:source.id,corruptionCaseId:conviction.id,judgeId:bribe.judgeId,previousStatus});return true;
  }
  reopenBribedWitnessJudgment(conviction){
    if(conviction.type!=='witnessBribery'||conviction.status!=='convicted'||conviction.details?.attempted===true||conviction.details?.paymentEventId==null)return false;
    const city=this.city,source=this.cases.find(record=>record.id===conviction.details.sourceCaseId),witnessId=conviction.details.witnessId;
    if(!source||!Number.isInteger(witnessId)||!['convicted','acquitted','appeal-pending'].includes(source.status))return false;
    source.details??={};source.details.witnessBriberyReviewPaymentIds??=[];if(source.details.witnessBriberyReviewPaymentIds.includes(conviction.details.paymentEventId))return false;
    source.details.witnessBriberyReviewPaymentIds.push(conviction.details.paymentEventId);source.details.excludedWitnessIds??=[];if(!source.details.excludedWitnessIds.includes(witnessId))source.details.excludedWitnessIds.push(witnessId);
    const tainted=source.evidence.filter(e=>e.witnessId===witnessId&&(['witness-identification','police-interview'].includes(e.kind)||e.kind==='defense-contradiction'));
    source.pastEvidence??=[];source.pastEvidence.push(...structuredClone(tainted));source.evidence=source.evidence.filter(e=>!tainted.includes(e));
    if(source.investigation?.evidence)source.investigation.evidence=source.investigation.evidence.filter(e=>e.witnessId!==witnessId);
    source.pastTrials??=[];source.pastTrials.push({trial:structuredClone(source.trial),sentence:source.sentence?structuredClone(source.sentence):null,archivedAt:city.minute,reason:'Condenação por suborno de testemunha ligada ao processo'});
    source.pastSentences??=[];if(source.sentence){source.sentence.originalFine??=source.sentence.fine;source.sentence.fine=0;source.sentence.suspendedAt=city.minute;source.sentence.executionStatus='judicial-integrity-review';this.refundExcessFine(source);source.pastSentences.push(structuredClone(source.sentence));source.pastTrials.at(-1).sentence=structuredClone(source.sentence);source.sentence=null;}
    if(source.reparation){source.pastReparations??=[];source.pastReparations.push(structuredClone(source.reparation));source.reparation.civilEnforceable=false;source.reparation.suspendedAt=city.minute;}
    const defendant=city.society.citizen(source.chargedCitizenId),previousStatus=source.trial?.appeal?.originalVerdict??source.status;source.trial=null;source.reopenedJudgmentAt=city.minute;source.reopenedJudgmentByCaseId=conviction.id;source.judicialReviewReason='Condenação por suborno de testemunha';
    if(!defendant||defendant.entity.destroyed){source.status='closed';source.closedAt=city.minute;source.closureReason='Decisão anulada após condenação por suborno de testemunha; réu falecido, sem possibilidade de novo julgamento';source.convictionAnnulledAt=city.minute;source.sentence=null;city.log(`A decisão do processo #${source.id} foi anulada após a condenação por suborno de testemunha no caso #${conviction.id}; não haverá novo julgamento porque o réu faleceu.`,'justice',[witnessId].filter(Number.isInteger),{kind:'bribed-testimony-judgment-vacated',caseId:source.id,briberyCaseId:conviction.id,witnessId,previousStatus});return true;}
    if(defendant.custody?.caseId===source.id)this.release(defendant,'Reabertura do processo após condenação por suborno de testemunha');source.status='charged';
    city.log(`O processo #${source.id} foi reaberto após a condenação por suborno de testemunha no caso #${conviction.id}; o depoimento foi retirado da nova avaliação e outro juiz e defensor serão designados.`,'justice',[source.chargedCitizenId,witnessId].filter(Number.isInteger),{kind:'bribed-testimony-judgment-reopened',caseId:source.id,briberyCaseId:conviction.id,witnessId,previousStatus,removedEvidenceCount:tainted.length});return true;
  }
  applyJudgeDisqualification(conviction){
    if(conviction.type!=='judgeBribery'||conviction.status!=='convicted'||conviction.details?.role!=='recipient'||conviction.chargedCitizenId!==conviction.details?.judgeId)return false;
    const city=this.city,judge=city.society.citizen(conviction.chargedCitizenId);if(!judge||judge.judicialDisqualifiedAt!=null)return false;
    judge.judicialDisqualifiedAt=city.minute;judge.judicialDisqualificationCaseId=conviction.id;
    city.log(`${judge.entity.properties.name} foi inabilitado permanentemente para atuar como juiz após condenação por suborno.`,'justice',[judge.id],{kind:'judge-disqualified',caseId:conviction.id,citizenId:judge.id});return true;
  }
  applyInvestigationFraudSanction(conviction){
    if(conviction.type!=='investigationFraud'||conviction.status!=='convicted'||conviction.chargedCitizenId!==conviction.details?.investigatorUnderReviewId)return false;
    const city=this.city,officer=city.society.citizen(conviction.chargedCitizenId),source=this.cases.find(r=>r.id===conviction.details?.reviewedCaseId);
    if(!conviction.details.investigationSanctionAppliedAt){
      conviction.details.investigationSanctionAppliedAt=city.minute;
      if(officer){officer.policeDisqualifiedAt??=city.minute;officer.policeDisqualificationCaseId=conviction.id;const station=city.building(officer.jobId);if(station?.type==='police_station'){if(station.policeInvestigatorId===officer.id)station.policeInvestigatorId=null;city.economy.leaveJob(officer,'Condenação por fraude de investigação');}if(officer.policeAudit){const audited=this.cases.find(r=>r.id===officer.policeAudit.caseId),audit=audited?.investigation?.financialAudit;if(audit?.status==='active'){audit.status='waiting';audit.waitingReason='auditoria interrompida após condenação do agente';}officer.policeAudit=null;}if(officer.policeOrder){const order=this.policeOrders.find(o=>o.id===officer.policeOrder.orderId);if(order&&['issued','accepted'].includes(order.status)){order.status='interrupted';order.decidedAt=city.minute;order.reason='agente condenado por fraude e afastado da polícia';}officer.policeOrder=null;}officer.policePatrol=null;officer.policeResponse=null;officer.policeInvestigation=null;city.log(`${officer.entity.properties.name} perdeu o vínculo policial após condenação por fraude de investigação.`,'justice',[officer.id],{kind:'investigator-disqualified',caseId:conviction.id,citizenId:officer.id,buildingId:station?.type==='police_station'?station.id:null});}
    }
    if(!source||source.details?.fraudReviewByCaseId===conviction.id)return false;
    source.details??={};source.details.fraudReviewByCaseId=conviction.id;source.details.investigatorUnderReviewId=conviction.details.investigatorUnderReviewId;source.details.previouslyChargedCitizenId=source.chargedCitizenId??source.investigation?.suspectId??null;
    if(source.investigation){source.pastInvestigations??=[];source.pastInvestigations.push(structuredClone(source.investigation));const tainted=new Set(source.investigation.evidence||[]);source.evidence=source.evidence.filter(e=>!tainted.has(e));}
    source.pastTrials??=[];if(source.trial||source.sentence)source.pastTrials.push({trial:source.trial?structuredClone(source.trial):null,sentence:source.sentence?structuredClone(source.sentence):null,archivedAt:city.minute,reason:'Revisão após condenação do investigador por fraude'});
    if(source.sentence){source.sentence.originalFine??=source.sentence.fine;source.sentence.fine=0;source.sentence.suspendedAt=city.minute;source.sentence.executionStatus='investigation-integrity-review';this.refundExcessFine(source);source.pastSentences??=[];source.pastSentences.push(structuredClone(source.sentence));if(source.pastTrials.length)source.pastTrials.at(-1).sentence=structuredClone(source.sentence);source.sentence=null;}
    if(source.reparation){source.pastReparations??=[];source.pastReparations.push(structuredClone(source.reparation));source.reparation.civilEnforceable=false;source.reparation.suspendedAt=city.minute;source.reparation=null;}
    const defendant=city.society.citizen(source.details.previouslyChargedCitizenId);
    if(defendant?.custody?.caseId===source.id)this.release(defendant,'Reabertura após condenação do investigador por fraude');
    source.trial=null;source.investigation=null;source.chargedCitizenId=null;source.reopenedAt=city.minute;source.reopenedByCaseId=conviction.id;
    if(!defendant||defendant.entity.destroyed){source.status='closed';source.closedAt=city.minute;source.closureReason='Processo encerrado após condenação do investigador; acusado falecido, sem novo julgamento';source.convictionAnnulledAt=city.minute;source.sentence=null;}
    else{source.status='reported';source.reportedAt=city.minute;source.details.excludedOfficerId=conviction.chargedCitizenId;source.investigationWaitingReason='Aguardando investigador independente após fraude comprovada';}
    city.log(`O caso #${source.id} foi reaberto após a condenação do investigador no caso #${conviction.id}; a apuração será refeita por outro agente e qualquer custódia anterior foi suspensa.`,'justice',[conviction.chargedCitizenId,defendant?.id].filter(Number.isInteger),{kind:'fraudulent-investigation-reopened',caseId:source.id,investigationFraudCaseId:conviction.id,investigatorId:conviction.chargedCitizenId});return true;
  }
  reopenBribedForensicJudgment(conviction,source,body){
    if(source.details?.forensicJudgmentReviewByCaseId===conviction.id||!source.trial||!['convicted','acquitted'].includes(source.trial.status)||!['convicted','acquitted'].includes(source.status))return false;
    const city=this.city,previousStatus=source.status,examinerId=conviction.chargedCitizenId,defendant=city.society.citizen(source.chargedCitizenId);
    source.pastTrials??=[];source.pastTrials.push({trial:structuredClone(source.trial),sentence:source.sentence?structuredClone(source.sentence):null,archivedAt:city.minute,reason:'Decisão reaberta após condenação do perito por laudo adulterado'});
    if(source.sentence){source.sentence.fine=0;source.sentence.suspendedAt=city.minute;source.sentence.executionStatus='forensic-integrity-review';this.refundExcessFine(source);source.pastSentences??=[];source.pastSentences.push(structuredClone(source.sentence));source.pastTrials.at(-1).sentence=structuredClone(source.sentence);source.sentence=null;}
    if(source.reparation){source.pastReparations??=[];source.pastReparations.push(structuredClone(source.reparation));source.reparation.civilEnforceable=false;source.reparation.suspendedAt=city.minute;}
    source.details??={};source.details.recusedExpertIds??=[];if(!source.details.recusedExpertIds.includes(examinerId))source.details.recusedExpertIds.push(examinerId);source.details.forensicJudgmentReviewByCaseId=conviction.id;if(['underway','awaiting-return-to-iml'].includes(body.autopsyReview?.physicalReviewStatus))source.details.forensicReviewPendingBodyId=body.id;
    source.trial=null;source.reopenedJudgmentAt=city.minute;source.reopenedJudgmentByCaseId=conviction.id;source.judicialReviewReason='Laudo pericial adulterado após condenação do perito';source.judicialReviewBodyId=body.id;
    if(!defendant||defendant.entity.destroyed){source.status='closed';source.closedAt=city.minute;source.closureReason='Decisão anulada após condenação do perito; réu falecido, sem possibilidade de novo julgamento';source.convictionAnnulledAt=city.minute;source.sentence=null;city.log(`A decisão do processo #${source.id} foi anulada após a condenação do perito no caso #${conviction.id}; não haverá novo julgamento porque o réu faleceu.`,'justice',[examinerId].filter(Number.isInteger),{kind:'bribed-autopsy-judgment-vacated',caseId:source.id,briberyCaseId:conviction.id,bodyId:body.id,previousStatus});return true;}
    if(defendant.custody?.caseId===source.id)this.release(defendant,'Reabertura do processo após condenação do perito por laudo adulterado');source.status='charged';
    city.log(`O julgamento do processo #${source.id} foi reaberto após a condenação do perito no caso #${conviction.id}; a decisão anterior foi arquivada, a pena suspensa e outro juiz será designado.`,'justice',[source.chargedCitizenId,examinerId].filter(Number.isInteger),{kind:'bribed-autopsy-judgment-reopened',caseId:source.id,briberyCaseId:conviction.id,bodyId:body.id,previousStatus});return true;
  }
  requiresPopularJury(record){return ['murder','attemptedMurder'].includes(record.type);}
  selectPopularJury(record){
    const city=this.city,excluded=new Set([record.chargedCitizenId,record.investigation?.suspectId,record.victimId,record.offenderId,record.details?.investigatorUnderReviewId,record.details?.excludedOfficerId,record.details?.witnessId,record.details?.payerId,...(record.details?.excludedWitnessIds||[]),...(record.witnesses||[]).map(w=>w.citizenId),...(record.evidence||[]).flatMap(e=>[e.witnessId,e.officerId])].filter(Number.isInteger)),justiceStaff=new Set(this.activeBuildings('police_station').concat(this.activeBuildings('courthouse'),this.activeBuildings('jail'),this.activeBuildings('council_oversight_office')).flatMap(b=>b.workers||[]));
    const candidates=(city.citizens||[]).filter(c=>c&&!c.entity?.destroyed&&!c.dead&&!excluded.has(c.id)&&!justiceStaff.has(c.id)&&c.judicialDisqualifiedAt==null&&c.policeDisqualifiedAt==null&&!c.custody&&!c.custodyEscort&&!c.policeInvestigation&&!c.policeAudit&&!c.policeResponse&&!c.policePatrol&&!city.politics?.officeHolder?.(c)&&(city.society?.isAdult?city.society.isAdult(c):(c.age??18)>=18));
    const bounds=this.popularJuryBounds(),required=Math.max(bounds.minimum,Math.min(bounds.maximum,Math.round(this.policies.popularJurySize??bounds.minimum)));if(candidates.length<required)return null;
    for(let i=candidates.length-1;i>0;i--){const j=Math.floor((city.random?.()??Math.random())*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
    return {status:'selected',memberIds:candidates.slice(0,required).map(c=>c.id),required,population:bounds.population,selectedAt:city.minute,votes:[]};
  }
  castPopularJuryVotes(jury,convictionChance){
    const city=this.city,votes=jury.memberIds.map(citizenId=>{const juror=city.society.citizen(citizenId),law=(juror?.skills?.law||0)/100,honesty=juror?.traits?.honesty??.5,riskTolerance=juror?.traits?.riskTolerance??.5,individualChance=Math.max(.03,Math.min(.97,convictionChance+(law-.3)*.08+(honesty-.5)*.06+(riskTolerance-.5)*.04));return {citizenId,decision:(city.random?.()??Math.random())<individualChance?'guilty':'not-guilty',convictionChance:individualChance};});
    jury.votes=votes;jury.decidedAt=city.minute;jury.guiltyVotes=votes.filter(v=>v.decision==='guilty').length;jury.notGuiltyVotes=votes.length-jury.guiltyVotes;jury.status='decided';jury.verdict=jury.guiltyVotes>votes.length/2?'convicted':'acquitted';return jury.verdict==='convicted';
  }
  updateCourtCases(){
    const city=this.city;for(const record of this.cases){this.applyJudgeDisqualification(record);this.applyInvestigationFraudSanction(record);reopenBribedInvestigation(this,record);this.reopenBribedJudgment(record);this.reopenBribedWitnessJudgment(record);preserveReportedForensicEvidence(this,record);reviewBribedAutopsy(this,record);this.syncCorruptionOutcome(record);if(record.status==='convicted')this.enforceSentence(record);if(city.minute%60===0){const defendant=city.society.citizen(record.chargedCitizenId);if(defendant&&record.status==='convicted'){this.collectFine(defendant,record);this.recoverStolenAsset(record,defendant);}this.collectReparation(record);this.refundExcessFine(record);for(const previous of record.pastSentences||[])if(previous.fineRefundDue>0)this.refundExcessFine(record,previous);}}const courts=this.activeBuildings('courthouse').filter(b=>this.staffed(b)>=2);
    if(!courts.length)return;
    for(const record of this.cases){
      if(!['arrested','charged'].includes(record.status)&&record.trial?.status!=='appeal-pending')continue;
      if(record.details?.forensicReviewPendingBodyId!=null){const body=this.bodies.find(item=>item.id===record.details.forensicReviewPendingBodyId),review=body?.autopsyReview;if(review?.physicalReviewStatus==='completed'||review?.physicalReviewStatus==='impossible-cremated'){delete record.details.forensicReviewPendingBodyId;if(review.physicalReviewStatus==='impossible-cremated')record.details.forensicReviewUnavailableBodyId=body.id;}else{record.trialWaitingReason='Aguardando segunda perícia física independente no IML';continue;}}
      const defendant=city.society.citizen(record.chargedCitizenId??record.investigation?.suspectId);if(!defendant||defendant.entity.destroyed)continue;
      let court,workers;
      if(!record.trial){
        const excluded=new Set([defendant.id,record.details?.investigatorUnderReviewId,record.details?.excludedOfficerId,record.details?.witnessId,record.details?.judgeId,record.details?.payerId,...(record.details?.recusedJudgeIds||[]),...(record.details?.recusedExpertIds||[]),...(record.details?.excludedWitnessIds||[])].filter(Number.isInteger)),assignments=courts.map(candidate=>({court:candidate,workers:(candidate.workers||[]).map(id=>city.society.citizen(id)).filter(c=>c&&!c.entity.destroyed&&c.jobId===candidate.id&&!excluded.has(c.id)).sort((a,b)=>(b.traits?.honesty??.5)-(a.traits?.honesty??.5))})).filter(a=>a.workers.length>=2&&a.workers.some(c=>c.judicialDisqualifiedAt==null));
        const assignment=assignments.find(a=>a.court.id===record.trial?.courtId)||assignments[0];if(!assignment){record.trialWaitingReason=record.details?.recusedJudgeIds?.length?'Aguardando outro juiz e defensor sem conflito de interesse':'Aguardando juiz e defensor disponíveis';continue;}record.trialWaitingReason=null;court=assignment.court;workers=assignment.workers;
        const judge=workers.find(c=>c.judicialDisqualifiedAt==null),defender=workers.find(c=>c.id!==judge?.id);if(!judge||!defender){record.trialWaitingReason='Aguardando juiz habilitado e defensor disponíveis';continue;}
        const jury=this.requiresPopularJury(record)?this.selectPopularJury(record):null;if(this.requiresPopularJury(record)&&!jury){const bounds=this.popularJuryBounds(),required=Math.max(bounds.minimum,Math.min(bounds.maximum,Math.round(this.policies.popularJurySize??bounds.minimum)));record.trialWaitingReason=`Aguardando ${required} jurados populares independentes`;continue;}
        record.trial={status:'hearing-scheduled',courtId:court.id,judgeId:judge.id,defenderId:defender.id,scheduledAt:city.minute,hearingAt:city.minute+180,defense:{appointed:true,appointedAt:city.minute},jury,appeal:null};
        city.log(`O caso #${record.id} foi encaminhado ao tribunal. ${defender.entity.properties.name} foi designado para a defesa pública de ${defendant.entity.properties.name}.`,'justice',[judge.id,defender.id,defendant.id],{kind:'trial-scheduled',caseId:record.id,buildingId:court.id});continue;
      }
      const currentJudge=city.society.citizen(record.trial.judgeId);
      if(currentJudge?.judicialDisqualifiedAt!=null&&['hearing-scheduled','appeal-pending'].includes(record.trial.status)){
        const excluded=new Set([defendant.id,record.trial.defenderId,currentJudge.id,record.details?.investigatorUnderReviewId,record.details?.excludedOfficerId,record.details?.witnessId,record.details?.payerId,...(record.details?.recusedJudgeIds||[]),...(record.details?.recusedExpertIds||[]),...(record.details?.excludedWitnessIds||[])].filter(Number.isInteger));
        const replacement=courts.map(candidate=>({court:candidate,judge:(candidate.workers||[]).map(id=>city.society.citizen(id)).find(c=>c&&!c.entity.destroyed&&c.jobId===candidate.id&&!excluded.has(c.id)&&c.judicialDisqualifiedAt==null)})).find(item=>item.judge);
        if(!replacement){record.trialWaitingReason='Aguardando substituto habilitado para juiz condenado';continue;}
        record.trial.previousJudgeAssignments??=[];record.trial.previousJudgeAssignments.push({judgeId:currentJudge.id,courtId:record.trial.courtId,replacedAt:city.minute,reason:'Inabilitação após condenação por suborno'});record.trial.judgeId=replacement.judge.id;record.trial.courtId=replacement.court.id;record.trial.judgeReplacedAt=city.minute;record.trialWaitingReason=null;
        if(record.trial.status==='appeal-pending')record.trial.appeal.reviewAt=city.minute+180;else record.trial.hearingAt=city.minute+180;
        city.log(`O juiz condenado foi substituído no caso #${record.id}; a próxima decisão aguardará um novo prazo de audiência.`,'justice',[currentJudge.id,replacement.judge.id,defendant.id].filter(Number.isInteger),{kind:'trial-judge-replaced',caseId:record.id,previousJudgeId:currentJudge.id,judgeId:replacement.judge.id});continue;
      }
      court=courts.find(b=>b.id===record.trial.courtId)||courts[0];workers=(court.workers||[]).map(id=>city.society.citizen(id)).filter(c=>c&&!c.entity.destroyed&&c.jobId===court.id).sort((a,b)=>(b.traits?.honesty??.5)-(a.traits?.honesty??.5));
      considerJudgeBribe(this,record);
      if(record.trial.status==='hearing-scheduled'&&city.minute>=record.trial.hearingAt){
        this.reviewDefenseEvidence(record,city.society.citizen(record.trial.defenderId));
        const irregularity=record.evidence.some(e=>e.kind==='defense-contradiction'),judge=city.society.citizen(record.trial.judgeId),defender=city.society.citizen(record.trial.defenderId),witness=record.evidence.find(e=>['witness-identification','police-interview','document-analysis'].includes(e.kind)),evidence=(witness?.confidence??0)*(irregularity?0.15:1),lawSkill=(judge?.skills?.law??0)/100*this.skillFactor(judge,'law'),defenseSkill=(defender?.skills?.law??0)/100*this.skillFactor(defender,'law'),judgeHonesty=judge?.traits?.honesty??.5;
        const judgeBribeBias=record.trial.judgeBribe?.status==='paid'&&record.trial.judgeBribe.payerId===defendant.id?-.4:0,convictionChance=Math.max(.03,Math.min(.96,.12+evidence*.68+record.evidence.filter(e=>!['witness-identification','document-analysis'].includes(e.kind)).length*.08+lawSkill*.08+judgeHonesty*.08-defenseSkill*.22-(irregularity?0.35:0)+judgeBribeBias));
        const convicted=record.trial.jury?this.castPopularJuryVotes(record.trial.jury,convictionChance):city.random()<convictionChance;record.trial.status=convicted?'convicted':'acquitted';record.trial.decidedAt=city.minute;record.trial.convictionChance=convictionChance;record.trial.reason=irregularity?'A defesa demonstrou contradições no inquérito.':record.trial.jury?`Júri popular decidiu por ${record.trial.jury.guiltyVotes} votos a ${record.trial.jury.notGuiltyVotes}.`:convicted?'Provas aceitas após audiência e defesa.':'Provas insuficientes após audiência e defesa.';record.status=record.trial.status;record.verdictAt=city.minute;this.syncCorruptionOutcome(record);
        if(convicted){record.sentence={fine:record.rule.fine||0,imprisonmentMinutes:record.rule.fineOnly?0:Math.round(Math.max(0,record.severity)*12),politicalDisqualification:!!record.rule.politicalDisqualification,appealUntil:city.minute+2*1440};if(record.sentence.fine>0)this.collectFine(defendant,record);this.enforceSentence(record);city.log(`${defendant.entity.properties.name} foi condenado no caso #${record.id}; pena: ${record.sentence.imprisonmentMinutes?`${Math.ceil(record.sentence.imprisonmentMinutes/1440)} dia(s) de prisão`: 'sem prisão'}${record.sentence.fine?` e multa de ${record.sentence.fine}`:''}.`,'justice',[judge?.id,defender?.id,defendant.id].filter(Number.isInteger),{kind:'court-conviction',caseId:record.id,buildingId:court.id,fine:record.sentence.fine,imprisonmentMinutes:record.sentence.imprisonmentMinutes});}
        else {if(defendant.custody)this.release(defendant,'Absolvição no tribunal');city.log(`${defendant.entity.properties.name} foi absolvido no caso #${record.id}.`,'justice',[judge?.id,defender?.id,defendant.id].filter(Number.isInteger),{kind:'court-acquittal',caseId:record.id,buildingId:court.id});}
        continue;
      }
      if(record.trial.status==='appeal-pending'&&city.minute>=record.trial.appeal.reviewAt){this.reviewDefenseEvidence(record,city.society.citizen(record.trial.defenderId),'appeal');const prior=record.trial.appeal.originalVerdict,appealStrength=record.evidence.some(e=>e.kind==='defense-contradiction')?0.62:0.25,overturn=city.random()<appealStrength;record.trial.appeal.status=overturn?'overturned':'upheld';record.trial.appeal.decidedAt=city.minute;record.trial.status=prior;if(overturn){record.status=prior==='convicted'?'acquitted':'convicted';record.trial.status=record.status;if(record.status==='acquitted'){record.convictionAnnulledAt=city.minute;if(record.sentence){record.sentence.originalFine??=record.sentence.fine;record.sentence.fine=0;record.sentence.suspendedAt=city.minute;record.sentence.executionStatus='annulled';this.refundExcessFine(record);}if(record.reparation)record.reparation.civilEnforceable=false;if(defendant.custody)this.release(defendant,'Sentença reformada em recurso');}if(record.status==='convicted'&&record.sentence&&defendant.custody)defendant.custody.releaseAt=Math.max(defendant.custody.releaseAt,city.minute+record.sentence.imprisonmentMinutes);}this.syncCorruptionOutcome(record);city.log(`Recurso do caso #${record.id}: ${overturn?'sentença reformada':'sentença mantida'}.`,'justice',[defendant.id,record.trial.judgeId].filter(Number.isInteger),{kind:'appeal-decided',caseId:record.id,result:record.trial.appeal.status});}
    }
  }
  collectFine(defendant,record){
    if(record.status!=='convicted'||!record.sentence)return false;
    const sentence=record.sentence,due=Math.max(0,sentence.fine-(sentence.finePaid||0)+(sentence.fineRefunded||0)),amount=Math.min(due,Math.max(0,this.city.accounts.get(defendant.accountId)?.balance||0));
    if(!amount||!this.city.transfer(defendant.accountId,'treasury',amount,'Multa criminal após condenação',{caseId:record.id}))return false;sentence.finePaid=(sentence.finePaid||0)+amount;return true;
  }
  refundExcessFine(record,sentence=record.sentence){
    const c=this.city.society.citizen(record.chargedCitizenId);if(!sentence||!c)return false;
    const due=Math.max(0,(sentence.finePaid||0)-(sentence.fineRefunded||0)-sentence.fine);sentence.fineRefundDue=due;if(!due)return false;
    const amount=Math.min(due,Math.max(0,this.city.accounts.get('treasury')?.balance||0));if(!amount||!this.city.transfer('treasury',c.accountId,amount,'Restituição de multa após revisão legal',{caseId:record.id}))return false;
    sentence.fineRefunded=(sentence.fineRefunded||0)+amount;sentence.fineRefundDue=due-amount;return true;
  }
  hireDefense(caseId){const city=this.city,record=this.cases.find(r=>r.id===caseId),defendant=city.society.citizen(record?.chargedCitizenId);if(!record?.trial||record.trial.status!=='hearing-scheduled'||!defendant||record.trial.privateDefense)return false;const offices=this.activeBuildings('legal_office').filter(b=>this.staffed(b)>0).sort((a,b)=>dist(a.door,defendant.entity)-dist(b.door,defendant.entity));for(const office of offices){const lawyer=office.workers.map(id=>city.society.citizen(id)).filter(c=>c&&!c.entity.destroyed&&c.jobId===office.id).sort((a,b)=>(b.skills?.law??0)-(a.skills?.law??0))[0];if(!lawyer)continue;const fee=city.currency.price(500+record.severity*20);if((city.accounts.get(defendant.accountId)?.balance??0)<fee||!city.transfer(defendant.accountId,office.accountId,fee,'Honorários de defesa criminal',{caseId:record.id,buildingId:office.id,lawyerId:lawyer.id}))return false;record.trial.defenderId=lawyer.id;record.trial.defense={appointed:true,private:true,officeId:office.id,fee,hiredAt:city.minute};record.trial.privateDefense=true;city.log(`${defendant.entity.properties.name} contratou ${lawyer.entity.properties.name} para a defesa no caso #${record.id}.`,'justice',[defendant.id,lawyer.id],{kind:'private-defense-hired',caseId:record.id,buildingId:office.id,fee});return true;}return false;}
  appeal(caseId,citizenId){const record=this.cases.find(r=>r.id===caseId),defendant=this.city.society.citizen(record?.chargedCitizenId);if(!record||!defendant||defendant.id!==citizenId||!['convicted','acquitted'].includes(record.status)||!record.sentence||this.city.minute>record.sentence.appealUntil||record.trial.appeal)return false;record.trial.appeal={status:'pending',originalVerdict:record.status,requestedAt:this.city.minute,reviewAt:this.city.minute+180};record.trial.status='appeal-pending';this.city.log(`${defendant.entity.properties.name} recorreu da sentença do caso #${record.id}.`,'justice',[defendant.id],{kind:'appeal-filed',caseId:record.id});return true;}
  enforceSentence(record){
    const city=this.city,sentence=record.sentence,c=city.society.citizen(record.chargedCitizenId);
    if(!sentence||sentence.completedAt!=null||sentence.suspendedAt!=null||!c||c.entity.destroyed)return false;
    if(c.custody&&c.custody.caseId!==record.id)return false;
    const served=(record.custodyMinutes||0)+(c.custody?.startedAt!=null?Math.max(0,city.minute-c.custody.startedAt):0),remaining=Math.max(0,sentence.imprisonmentMinutes-served),parliamentaryProtection=this.policies.parliamentaryImmunity&&(city.politics.council.members.some(m=>m.citizenId===c.id)||record.immunityAuthorization==='required'||record.parliamentaryImmunityProtectionAt!=null);if(remaining>0&&parliamentaryProtection&&record.immunityAuthorization!=='approved'){sentence.executionStatus='awaiting-immunity-authorization';record.immunityAuthorization='required';record.immunityAuthorizationRequestedAt??=city.minute;return false;}
    this.applyMandateCassation(record,'conviction');
    if(!remaining){sentence.completedAt=city.minute;sentence.executionStatus='completed';if(c.custody)this.release(c,'Pena cumprida');return true;}
    if(c.custody){if(!c.custody.sentenced){c.custody.sentenced=true;c.custody.remainingMinutes=remaining;c.custody.releaseAt=c.custody.startedAt!=null?city.minute+remaining:null;}sentence.startedAt??=city.minute;sentence.executionStatus=c.custody.status==='in-transit'?'in-transit':'serving';return true;}
    const place=this.custodyPlace(c);if(!place.jail){sentence.executionStatus=place.reason;sentence.queuedAt??=city.minute;return false;}const {jail,path}=place;
    if(c.funeralBodyId){const body=this.bodies.find(b=>b.id===c.funeralBodyId);if(body)this.cancelBodyTransport(body,'Coleta interrompida para cumprimento de sentença');}
    c.custody={caseId:record.id,jailId:jail.id,cellUnitId:place.cellUnitId,status:'in-transit',sentenced:true,remainingMinutes:remaining,releaseAt:null};c.task='custody';c.path=path;c.targetId=jail.id;c.action='Sendo conduzido para cumprir sentença';record.jailId=jail.id;sentence.executionStatus='in-transit';
    city.log(`${c.entity.properties.name} está sendo conduzido para cumprir a sentença do caso #${record.id}.`,'justice',[c.id],{kind:'sentence-enforcement',caseId:record.id,buildingId:jail.id});return true;
  }
  updateDetainee(c){
    const city=this.city,record=this.cases.find(r=>r.id===c.custody?.caseId),jail=city.building(c.custody?.jailId);
    if(!record||!jail||!jail.active||jail.entity.destroyed){this.release(c,'Cadeia indisponível');return;}
    if(c.custody.status==='in-transit'&&record.arrestEscort?.status==='in-progress'&&record.arrestEscort.pauseMinute===city.minute){c.path=[];if(c.indoorLocation?.path?.length)c.indoorLocation.path=[];c.action='Aguardando policial para retomar a escolta até a cadeia';return;}
    if(c.custody.status==='in-transit'&&record.arrestEscort&&record.arrestEscort.status!=='in-progress'){c.path=[];if(c.indoorLocation?.path?.length)c.indoorLocation.path=[];c.action='Aguardando policial para retomar a escolta até a cadeia';return;}
    if(c.custody.status==='in-transit'&&!c.path.length){
      if(dist(c.entity,jail.door)>1.5){const path=city.findPath(c.entity,jail.door);if(path===null){this.release(c,'Sem acesso à cadeia');return;}c.path=path;return;}
      c.custody.status='detained';c.custody.startedAt=city.minute;c.custody.nextRationAt=city.minute;c.task='custody';c.action='Em custódia na cadeia';
      if(c.custody.sentenced){c.custody.releaseAt=city.minute+c.custody.remainingMinutes;record.sentence.startedAt??=city.minute;record.sentence.executionStatus='serving';}
      city.log(`${c.entity.properties.name} chegou à cadeia no caso #${record.id}.`,'justice',[c.id],{kind:'custody-started',caseId:record.id,buildingId:jail.id});
    }
    if(c.custody.illegalDetention){if(['detained','sentenced'].includes(c.custody.status)){this.carePrisoner(c,jail);this.servePrisoner(c,jail);if(c.custody.careService!=='bathroom')this.ensurePrisonCell(c,jail);if(city.minute>=c.custody.releaseAt||record.status==='convicted'&&record.chargedCitizenId!==c.id)this.release(c,record.status==='convicted'?'Abuso policial reconhecido pelo tribunal':'Fim da detenção ilegal');}return;}
    if(['detained','sentenced'].includes(c.custody.status)){const medicalStatus=c.custody.medical?.status;if(!['to-hospital','in-treatment','returning'].includes(medicalStatus))this.carePrisoner(c,jail);this.servePrisoner(c,jail);if(c.custody.medical?.status)this.advanceCustodyMedical(c,jail);else if(c.custody.medicalReferralNeeded)this.requestCustodyMedical(c,jail);if(c.custody.careService!=='bathroom'&&!['to-hospital','in-treatment','returning'].includes(c.custody.medical?.status))this.ensurePrisonCell(c,jail);if(city.minute>=c.custody.releaseAt){if(c.custody.sentenced||record.status==='convicted'){record.sentence.completedAt=city.minute;record.sentence.executionStatus='completed';this.release(c,'Pena cumprida');}else this.release(c,'Fim do prazo cautelar');}}
  }
  requestCustodyMedical(c,jail){
    const city=this.city,custody=c.custody;if(city.minute<(custody.nextMedicalRetryAt||0))return false;custody.nextMedicalRetryAt=city.minute+30;
    const hospitals=this.activeBuildings('hospital').filter(b=>b.workers?.length>=2&&city.findPath(jail.door,b.door)!==null).sort((a,b)=>dist(jail.door,a.door)-dist(jail.door,b.door));
    if(!hospitals.length){c.custody.medicalStatus='awaiting-accessible-hospital';return false;}
    const hospital=hospitals.find(b=>civicStatus(city,b,c).ready);if(!hospital){c.custody.medicalStatus='awaiting-hospital-team-or-supplies';return false;}
    const stations=this.activeBuildings('police_station').filter(b=>this.staffed(b)>0).sort((a,b)=>dist(a.door,c.entity)-dist(b.door,c.entity));
    for(const station of stations){const officer=(station.workers||[]).map(id=>city.society.citizen(id)).find(w=>w&&!w.policeAudit&&!w.entity.destroyed&&w.jobId===station.id&&w.task==='work'&&w.indoorLocation?.buildingId===station.id&&!w.indoorLocation.path?.length&&!w.path.length&&!w.custody&&!w.custodyEscort&&!w.mobilityTrip&&!w.ridingVehicleId&&!w.conversation&&!w.funeralBodyId&&!w.deliveryId&&!w.cleaningJobId);
      if(!officer)continue;
      city.sanitation?.releaseCitizen(c);c.custody.careService=null;c.custody.medicalStatus=null;const medical={status:'awaiting-officer',jailId:jail.id,hospitalId:hospital.id,stationId:station.id,officerId:officer.id,requestedAt:city.minute};c.custody.medical=medical;
      officer.custodyEscort={citizenId:c.id,phase:'to-jail',jailId:jail.id,hospitalId:hospital.id,stationId:station.id,assignedAt:city.minute,lastPaidAt:null};officer.task='custody-escort';officer.targetId=null;officer.path=[];officer.action=`Indo buscar pessoa presa para atendimento médico`;
      city.log(`A polícia designou ${officer.entity.properties.name} para escoltar ${c.entity.properties.name} ao hospital.`, 'justice',[officer.id,c.id],{kind:'medical-escort-assigned',caseId:c.custody.caseId,buildingId:jail.id,hospitalId:hospital.id});return true;
    }
    c.custody.medicalStatus='awaiting-police-officer';return false;
  }
  advanceCustodyMedical(c,jail){
    const city=this.city,medical=c.custody.medical,hospital=city.building(medical.hospitalId),officer=city.society.citizen(medical.officerId);if(!medical||!hospital?.active||hospital.entity.destroyed||!officer||officer.entity.destroyed||officer.custodyEscort?.citizenId!==c.id){c.custody.medicalStatus='medical-escort-interrupted';return false;}
    if(medical.status==='awaiting-officer')return false;
    if(medical.status==='officer-at-jail'){
      if(c.indoorLocation||c.path.length)return false;
      if(dist(c.entity,jail.door)>1.5){const path=city.findPath(c.entity,jail.door);if(path===null){medical.status='awaiting-jail-exit-route';return false;}c.path=path;return false;}
      c.task='health';c.targetId=hospital.id;const path=city.findPath(c.entity,hospital.door);if(path===null){medical.status='awaiting-hospital-route';return false;}c.path=path;medical.status='to-hospital';officer.custodyEscort.phase='to-hospital';officer.path=[];return true;
    }
    if(medical.status==='to-hospital'){
      if(c.indoorLocation?.buildingId===hospital.id){medical.status='in-treatment';medical.arrivedAt=city.minute;}
      else if(!c.indoorLocation&&!c.path.length){if(dist(c.entity,hospital.door)>1.5){const path=city.findPath(c.entity,hospital.door);if(path===null){medical.status='awaiting-hospital-route';return false;}c.path=path;return false;}syncCitizenInterior(city,c);}
      return false;
    }
    if(medical.status==='in-treatment'){
      if(!c.indoorLocation||c.indoorLocation.buildingId!==hospital.id){medical.status='to-hospital';return false;}
      if(c.indoorLocation.path?.length||c.indoorLocation.targetRoomType!=='treatment'||c.indoorLocation.unitId!==c.indoorLocation.targetUnitId)return false;
      c.task='health';c.targetId=hospital.id;const readiness=civicStatus(city,hospital,c);if(readiness.ready)civicVisit(city,c,hospital);else{c.action=`Aguardando atendimento hospitalar: ${readiness.reason}`;return false;}
      const serious=(c.combatInjuries||[]).some(w=>w.severity>=6),needsMore=c.needs.health<80||serious;
      if(!needsMore){medical.status='returning';medical.treatedAt=city.minute;c.custody.medicalReferralNeeded=false;c.task='custody';c.targetId=jail.id;c.civicVisit=null;officer.custodyEscort.phase='returning';officer.path=[];city.log(`${c.entity.properties.name} recebeu atendimento e está sendo levado de volta à cadeia.`, 'justice',[c.id,officer.id],{kind:'custody-medical-complete',caseId:c.custody.caseId,hospitalId:hospital.id});}
      else if(!c.task){c.task='health';c.targetId=hospital.id;c.civicVisit=null;}
      return true;
    }
    if(medical.status==='returning'){
      if(c.indoorLocation)return false;
      if(!c.path.length&&dist(c.entity,jail.door)>1.5){const path=city.findPath(c.entity,jail.door);if(path===null){medical.status='awaiting-jail-return-route';return false;}c.path=path;return false;}
      if(dist(c.entity,jail.door)<=1.5){medical.status='returning-to-cell';c.task='custody';c.targetId=jail.id;this.ensurePrisonCell(c,jail);}
      return false;
    }
    if(medical.status==='returning-to-cell'&&c.indoorLocation?.buildingId===jail.id&&c.indoorLocation.targetUnitId===c.custody.cellUnitId&&!c.indoorLocation.path?.length){medical.status='completed';c.custody.medicalCompletedAt=city.minute;officer.custodyEscort=null;officer.path=[];officer.targetId=null;officer.task='work';officer.action='Retornou ao serviço policial';}
    return false;
  }
  updateCustodyEscort(officer){
    const city=this.city,escort=officer.custodyEscort,c=city.society.citizen(escort?.citizenId),medical=c?.custody?.medical,jail=city.building(escort?.jailId),hospital=city.building(escort?.hospitalId),station=city.building(escort?.stationId);
    if(!escort)return false;if(!c||c.entity.destroyed||!medical||!jail||!hospital?.active||officer.jobId!==station?.id){officer.custodyEscort=null;officer.path=[];officer.task=officer.jobId?'work':null;return false;}
    if(escort.lastPaidAt!==city.minute){city.payWage(officer,station);escort.lastPaidAt=city.minute;}
    const goal=escort.phase==='to-jail'?jail.door:escort.phase==='returning'?jail.door:hospital.door;
    if(officer.indoorLocation||officer.path.length)return false;
    officer.task='custody-escort';officer.targetId=null;
    if(escort.phase==='to-jail'){
      if(dist(officer.entity,goal)>1.5){const path=city.findPath(officer.entity,goal);if(path===null){medical.status='awaiting-officer-route';officer.action='Sem rota para acompanhar custódia';return false;}officer.path=path;return false;}
      escort.phase='waiting-at-jail';medical.status='officer-at-jail';c.task='health';c.targetId=hospital.id;officer.action=`Aguardando ${c.entity.properties.name} na saída da cadeia`;return true;
    }
    if(escort.phase==='waiting-at-jail'){
      if(c.indoorLocation)return false;
      if(dist(officer.entity,c.entity)>2){const path=city.findPath(officer.entity,c.entity);if(path?.length)officer.path=path;return false;}
      if(!c.path.length){c.task='health';c.targetId=hospital.id;const path=city.findPath(c.entity,hospital.door);if(path!==null)c.path=path;}
      escort.phase='to-hospital';medical.status='to-hospital';return true;
    }
    if(['to-hospital','returning'].includes(escort.phase)){
      if(dist(officer.entity,goal)>2&&!officer.path.length){const path=city.findPath(officer.entity,goal);if(path!==null)officer.path=path;else{medical.status='awaiting-officer-route';return false;}}
      if(escort.phase==='to-hospital'&&c.indoorLocation?.buildingId===hospital.id){escort.phase='at-hospital';medical.status='in-treatment';}
      if(escort.phase==='returning'&&c.indoorLocation?.buildingId===jail.id){officer.custodyEscort=null;officer.path=[];officer.targetId=null;officer.task='work';officer.action='Retornou ao serviço policial';medical.status='completed';c.custody.medicalCompletedAt=city.minute;}
      return true;
    }
    if(escort.phase==='at-hospital')return true;
    return false;
  }
  ensurePrisonCell(c,jail){
    const custody=c.custody;if(!custody||custody.careService==='bathroom')return false;
    let cell=jail.units?.find(u=>u.id===custody.cellUnitId&&u.detentionCell);
    if(!cell){cell=this.freeJailCell(jail);if(!cell){custody.cellStatus='waiting-for-cell';return false;}custody.cellUnitId=cell.id;}
    if(c.indoorLocation?.buildingId===jail.id&&c.indoorLocation.targetUnitId===cell.id){if(!c.indoorLocation.path?.length)custody.cellStatus='occupied';else custody.cellStatus='moving-to-cell';return !c.indoorLocation.path?.length;}
    if(c.path.length)return false;
    const target={x:jail.entity.x+cell.x+.5,y:jail.entity.y+cell.y+.5,z:(cell.z||0)*CITY_FLOOR_HEIGHT};
    if(!c.indoorLocation||c.indoorLocation.buildingId!==jail.id){
      if(dist(c.entity,jail.door)>1.5){const path=this.city.findPath(c.entity,jail.door);if(path===null){custody.cellStatus='waiting-for-access';return false;}c.path=path;c.targetId=jail.id;return false;}
      const from={x:jail.door.x,y:jail.door.y,z:0},path=interiorRoute(jail,from,target);if(path===null){custody.cellStatus='waiting-for-access';return false;}
      c.indoorLocation={buildingId:jail.id,unitId:path.length?null:cell.id,targetUnitId:cell.id,targetRoomType:'cell',roomType:path.length?'circulation':'cell',floor:Math.floor(from.z/CITY_FLOOR_HEIGHT),position:from,path,phase:path.length?'walking':'using',task:'custody',layoutRevision:jail.layoutRevision||0,enteredAt:this.city.minute};
    }else{
      const from=c.indoorLocation.position||{x:c.entity.x,y:c.entity.y,z:0},path=interiorRoute(jail,from,target);if(path===null){custody.cellStatus='waiting-for-access';return false;}
      c.indoorLocation.unitId=path.length?null:cell.id;c.indoorLocation.targetUnitId=cell.id;c.indoorLocation.targetRoomType='cell';c.indoorLocation.roomType=path.length?'circulation':'cell';c.indoorLocation.path=path;c.indoorLocation.phase=path.length?'walking':'using';c.indoorLocation.exiting=false;c.indoorLocation.layoutRevision=jail.layoutRevision||0;c.indoorLocation.task='custody';
    }
    custody.cellStatus='moving-to-cell';c.task='custody';c.targetId=jail.id;c.action='Sendo levado à cela';return false;
  }
  carePrisoner(c,jail){
    const city=this.city,n=c.needs,custody=c.custody;if(custody.lastCareMinute===city.minute)return;custody.lastCareMinute=city.minute;
    n.energy=Math.min(95,(n.energy||0)+(city.hour>=22||city.hour<6?0.35:0.1));n.shelter=Math.max(n.shelter||0,60);n.safety=Math.max(n.safety||0,50);
    if(custody.careService==='bathroom'){
      const facility=city.sanitation?.facilities.get(custody.bathroomId);if(!facility||city.units&&!city.units.has(facility.unitId)){custody.careService=null;c.task='custody';c.targetId=jail.id;return;}
      c.task='toilet';c.targetId=jail.id;c.toiletTargetId=facility.id;city.sanitation.use(c);
      if(c.indoorLocation?.buildingId===jail.id&&c.indoorLocation.unitId===facility.unitId&&!c.indoorLocation.path?.length&&n.hygiene<60&&(jail.inventory?.sabao||0)>0&&custody.lastWashAt!==custody.bathroomVisitAt){jail.inventory.sabao--;city.economy.consumed.sabao=(city.economy.consumed.sabao||0)+1;city.economy.recordGoods('custody-hygiene','sabao',1,jail.id,c.id);n.hygiene=Math.min(90,n.hygiene+25);custody.lastWashAt=custody.bathroomVisitAt;custody.lastCareAt=city.minute;city.history.record('service',`Higiene de custódia realizada por ${c.entity.properties.name}.`,[c.accountId,jail.accountId],{kind:'custody-wash',caseId:custody.caseId,buildingId:jail.id,good:'sabao',quantity:1});}
      if(c.task!=='toilet'){custody.careService=null;c.task='custody';c.targetId=jail.id;}return;
    }
    if(city.minute<(custody.nextCareAt||0))return;
    const worker=(jail.workers||[]).map(id=>city.society.citizen(id)).find(w=>w&&!w.entity.destroyed&&w.jobId===jail.id&&w.task==='work'&&w.indoorLocation?.buildingId===jail.id&&!w.indoorLocation.path?.length&&!w.indoorLocation.exiting&&!w.path.length&&w.prisonCareMinute!==city.minute);
    if(!worker){custody.careStatus='awaiting-staff';return;}worker.prisonCareMinute=city.minute;custody.nextCareAt=city.minute+30;let care=false;
    const bathroom=[...(city.sanitation?.facilities.values()||[])].find(f=>f.buildingId===jail.id&&(!city.units||city.units.get(f.unitId)?.roomType==='bathroom')&&(f.busyUntil||0)<=city.minute);
    if((n.toilet<60||n.hygiene<60)&&bathroom){custody.careService='bathroom';custody.bathroomId=bathroom.id;custody.bathroomVisitAt=city.minute;custody.careStatus='going-to-bathroom';c.task='toilet';c.targetId=jail.id;c.toiletTargetId=bathroom.id;}
    if(n.health<45&&(jail.inventory?.remedio||0)>0){jail.inventory.remedio--;city.economy.consumed.remedio=(city.economy.consumed.remedio||0)+1;city.economy.recordGoods('custody-first-aid','remedio',1,jail.id,c.id);n.health=Math.min(45,n.health+8);care=true;}
    custody.medicalReferralNeeded=n.health<25||(c.combatInjuries||[]).some(w=>w.severity>=6);custody.careStatus=custody.careService?'going-to-bathroom':care?'care-provided':'awaiting-need-or-supplies';
    if(care){custody.lastCareAt=city.minute;city.history.record('service',`Cuidados de custódia prestados a ${c.entity.properties.name}.`,[c.accountId,jail.accountId],{kind:'custody-care',caseId:custody.caseId,buildingId:jail.id,workerId:worker.id,medicalReferralNeeded:custody.medicalReferralNeeded});}
  }
  servePrisoner(c,jail){
    const city=this.city,p=c.pocket??=( {food:[],water:0,waterContamination:0,waterSource:null} );if(city.minute<(c.custody.nextRationAt||0))return;c.custody.nextRationAt=city.minute+30;
    if(c.needs.food<65&&p.food.length<4){
      const offer=city.economy.mealOffer(jail,c);
      if(offer&&Object.entries(offer.inputs).every(([good,q])=>(jail.inventory[good]||0)>=q)){
        for(const [good,q]of Object.entries(offer.inputs))jail.inventory[good]-=q;
        p.food.push({good:offer.good,inputs:{...offer.inputs},quality:offer.quality||1,ingredients:offer.ingredients?{...offer.ingredients}:null,sourceId:jail.id,packedAt:city.minute});
        c.custody.foodStatus='ration-issued';
      }else this.orderPrisonRations(jail,c);
    }
    if(c.needs.water<65&&p.water<4){
      if((jail.waterStock||0)>=6){jail.waterStock-=6;p.water=6;p.waterContamination=jail.waterContamination||0;p.waterSource=jail.waterSource||'Água coletada por funcionário';p.receivedWater=(p.receivedWater||0)+6;c.custody.waterStatus='supplied-from-jail-stock';city.history.record('service',`A cadeia entregou água do estoque físico a ${c.entity.properties.name}.`,[c.accountId,jail.accountId],{buildingId:jail.id,caseId:c.custody.caseId,kind:'prison-water',quantity:6,contamination:p.waterContamination});}
      else this.requestPrisonWater(c,jail);
    }
  }
  requestPrisonWater(c,jail){
    const city=this.city,custody=c.custody;if(city.minute<(custody.nextWaterRetryAt||0))return false;custody.nextWaterRetryAt=city.minute+30;
    if((jail.waterStock||0)>=6){custody.waterStatus='water-in-jail-stock';return true;}
    if((city.citizens||[]).some(w=>w.custodyWaterDelivery?.jailId===jail.id)){custody.waterStatus='water-in-transit';return true;}
    const worker=(jail.workers||[]).map(id=>city.society.citizen(id)).find(w=>w&&!w.entity.destroyed&&w.jobId===jail.id&&w.task==='work'&&w.indoorLocation?.buildingId===jail.id&&!w.indoorLocation.path?.length&&!w.indoorLocation.exiting&&!w.path.length&&!w.custodyWaterDelivery&&!w.custodyEscort&&!w.funeralBodyId&&!w.deliveryId&&!w.mobilityTrip&&!w.ridingVehicleId);
    if(!worker){custody.waterStatus='awaiting-water-worker';return false;}
    const shore=city.water?.nearestShore({entity:jail.door});if(!shore){custody.waterStatus='awaiting-water-source';return false;}
    const origin={buildingId:jail.id,position:{...(worker.indoorLocation.position||worker.entity)},roomType:worker.indoorLocation.roomType||'workspace',unitId:worker.indoorLocation.unitId||null,floor:worker.indoorLocation.floor||0},path=interiorRoute(jail,origin.position,{...jail.door,z:0});if(path===null){custody.waterStatus='awaiting-jail-exit-route';return false;}
    worker.custodyWaterDelivery={jailId:jail.id,caseId:custody.caseId,phase:'to-source',source:{bodyId:shore.bodyId,point:{...shore.point}},sourcePath:shore.path,origin,assignedAt:city.minute,water:6};worker.task='custody-water';worker.targetId=null;worker.path=[];worker.action='Saindo para buscar água para a cadeia';
    worker.indoorLocation.unitId=null;worker.indoorLocation.targetUnitId=null;worker.indoorLocation.roomType='circulation';worker.indoorLocation.targetRoomType='circulation';worker.indoorLocation.exiting=true;worker.indoorLocation.path=path;worker.indoorLocation.phase='leaving';worker.indoorLocation.task='custody-water';
    custody.waterStatus='water-in-transit';return true;
  }
  updateCustodyWaterDelivery(worker){
    const city=this.city,trip=worker.custodyWaterDelivery,jail=city.building(trip?.jailId);if(!trip)return false;
    if(!jail||jail.entity.destroyed||worker.entity.destroyed||worker.jobId!==jail.id){worker.custodyWaterDelivery=null;worker.task=worker.jobId?'work':null;return false;}
    if(worker.indoorLocation?.path?.length||worker.path.length)return true;
    if(trip.phase==='to-source'){
      if(worker.indoorLocation){const path=interiorRoute(jail,worker.indoorLocation.position||trip.origin.position,{...jail.door,z:0});if(path===null){trip.phase='waiting-jail-exit-route';return false;}worker.indoorLocation.unitId=null;worker.indoorLocation.targetUnitId=null;worker.indoorLocation.roomType='circulation';worker.indoorLocation.targetRoomType='circulation';worker.indoorLocation.exiting=true;worker.indoorLocation.path=path;worker.indoorLocation.phase='leaving';worker.indoorLocation.task='custody-water';return true;}
      const path=city.findPath(worker.entity,trip.source.point);if(path===null){trip.phase='waiting-source-route';return false;}worker.path=path;trip.phase='walking-to-source';return true;
    }
    if(trip.phase==='waiting-jail-exit-route'&&worker.indoorLocation){const path=interiorRoute(jail,worker.indoorLocation.position||trip.origin.position,{...jail.door,z:0});if(path!==null){worker.indoorLocation.unitId=null;worker.indoorLocation.targetUnitId=null;worker.indoorLocation.roomType='circulation';worker.indoorLocation.targetRoomType='circulation';worker.indoorLocation.exiting=true;worker.indoorLocation.path=path;worker.indoorLocation.phase='leaving';worker.indoorLocation.task='custody-water';trip.phase='to-source';}return true;}
    if(trip.phase==='walking-to-source'&&dist(worker.entity,trip.source.point)<=.8){trip.contamination=city.water.contamination(trip.source.bodyId,trip.source.point);city.water.draw(trip.source.bodyId,trip.water);trip.carrying=true;const path=city.findPath(worker.entity,jail.door);if(path===null){trip.phase='waiting-return-route';return false;}worker.path=path;trip.phase='returning-to-jail';worker.action='Levando água coletada para a cadeia';return true;}
    if(trip.phase==='waiting-source-route'){const path=city.findPath(worker.entity,trip.source.point);if(path!==null){worker.path=path;trip.phase='walking-to-source';}return true;}
    if(trip.phase==='waiting-return-route'){const path=city.findPath(worker.entity,jail.door);if(path!==null){worker.path=path;trip.phase='returning-to-jail';}return true;}
    if(trip.phase==='waiting-jail-entry-route'&&dist(worker.entity,jail.door)<=1.5){const target={...trip.origin.position,z:trip.origin.position.z||0},path=interiorRoute(jail,{...jail.door,z:0},target);if(path!==null){worker.indoorLocation={buildingId:jail.id,unitId:path.length?null:trip.origin.unitId,targetUnitId:trip.origin.unitId,targetRoomType:trip.origin.roomType,roomType:path.length?'circulation':trip.origin.roomType,floor:0,position:{...jail.door,z:0},path,phase:path.length?'walking':'using',task:'custody-water',layoutRevision:jail.layoutRevision||0,enteredAt:city.minute};trip.phase='delivering-inside';}return true;}
    if(trip.phase==='returning-to-jail'&&dist(worker.entity,jail.door)<=1.5){
      const target={...trip.origin.position,z:trip.origin.position.z||0},path=interiorRoute(jail,{...jail.door,z:0},target);if(path===null){trip.phase='waiting-jail-entry-route';return false;}
      worker.indoorLocation={buildingId:jail.id,unitId:path.length?null:trip.origin.unitId,targetUnitId:trip.origin.unitId,targetRoomType:trip.origin.roomType,roomType:path.length?'circulation':trip.origin.roomType,floor:0,position:{...jail.door,z:0},path,phase:path.length?'walking':'using',task:'custody-water',layoutRevision:jail.layoutRevision||0,enteredAt:city.minute};trip.phase='delivering-inside';return true;
    }
    if(trip.phase==='delivering-inside'&&worker.indoorLocation?.buildingId===jail.id&&!worker.indoorLocation.path?.length){jail.waterStock=(jail.waterStock||0)+trip.water;jail.waterContamination=trip.contamination;jail.waterSource='Água coletada por funcionário';city.history.record('service','Água coletada em fonte local chegou fisicamente à cadeia.',[worker.accountId,jail.accountId],{kind:'prison-water-delivery',buildingId:jail.id,quantity:trip.water,contamination:trip.contamination,bodyId:trip.source.bodyId});worker.custodyWaterDelivery=null;worker.task='work';worker.action='Retornou ao serviço da cadeia';return true;}
    if(trip.phase.startsWith('waiting-'))worker.action='Aguardando rota para concluir o abastecimento de água';
    return true;
  }
  orderPrisonRations(jail,c){
    const city=this.city,good='pao',target=12,stock=(jail.inventory?.[good]||0)+(jail.incoming?.[good]||0),needed=Math.max(0,target-stock);
    if(!needed){c.custody.foodStatus='ration-in-transit';return false;}
    const suppliers=city.buildings.filter(b=>b.active&&!b.entity.destroyed&&['bakery','market'].includes(b.type)&&(b.inventory?.[good]||0)>0).sort((a,b)=>dist(a.door,jail.door)-dist(b.door,jail.door));
    for(const seller of suppliers){const quantity=Math.min(needed,seller.inventory[good],city.logistics.transportLimit(seller,jail),inventoryFree(jail));if(quantity<3)continue;
      const order=city.logistics.order(seller,jail,good,quantity,city.economy.goods[good].price,{payerAccountId:'treasury',purpose:'prison-rations',requireCarrier:true});
      if(order){c.custody.foodStatus='ration-in-transit';c.custody.foodShipmentId=order.id;return true;}
    }
    c.custody.foodStatus='awaiting-ration-stock-or-carrier';return false;
  }
  cancelCustodyEscort(c){const officer=this.city.society.citizen(c?.custody?.medical?.officerId);if(officer?.custodyEscort?.citizenId===c.id){officer.custodyEscort=null;officer.path=[];officer.targetId=null;officer.task=officer.jobId?'work':null;officer.action='Retornou ao serviço policial';}if(c?.custody?.medical)c.custody.medical.status='interrupted';c.civicVisit=null;}
  onDetaineeDeath(c){const record=this.cases.find(r=>r.id===c.custody?.caseId);this.cancelCustodyEscort(c);if(record){if(c.custody.illegalDetention)record.details.detainedVictimDiedAt=this.city.minute;else{record.closedAt=this.city.minute;record.closureReason='A pessoa morreu sob custódia';if(record.status!=='convicted')record.status='closed';if(record.sentence){record.sentence.executionStatus='ended-by-death';record.sentence.suspendedAt=this.city.minute;}}this.city.log(`${c.entity.properties.name} morreu sob custódia no caso #${record.id}.`,'justice',[c.id],{kind:'case-closed-death',caseId:record.id,illegalDetention:!!c.custody.illegalDetention});}c.custody=null;}
  release(c,reason='Soltura'){const custody=c?.custody;if(!custody)return false;const record=this.cases.find(r=>r.id===custody.caseId),jail=this.city.building?.(custody.jailId),arrestEscort=record?.arrestEscort;if(arrestEscort?.suspectId===c.id&&arrestEscort.status==='in-progress'){const officer=this.city.society.citizen(arrestEscort.officerId);arrestEscort.status='cancelled';arrestEscort.cancelledAt=this.city.minute;arrestEscort.reason='pessoa solta antes da conclusão da escolta';if(officer?.policeArrestEscort===arrestEscort){officer.policeArrestEscort=null;officer.path=[];officer.targetId=null;officer.task=officer.jobId?'work':null;officer.action='Retornou ao serviço policial';}}this.cancelCustodyEscort(c);this.city.sanitation?.releaseCitizen(c);c.custody=null;c.path=[];c.task=null;c.targetId=null;
    if(jail&&c.indoorLocation?.buildingId===jail.id){const from=c.indoorLocation.position||{x:c.entity.x,y:c.entity.y,z:0},path=interiorRoute(jail,from,{x:jail.door.x,y:jail.door.y,z:0});if(path!==null){c.indoorLocation.unitId=null;c.indoorLocation.targetUnitId=null;c.indoorLocation.roomType='circulation';c.indoorLocation.targetRoomType='circulation';c.indoorLocation.exiting=true;c.indoorLocation.path=path;c.indoorLocation.phase='leaving';c.indoorLocation.task=null;}}
    c.action=`Foi solto: ${reason}`;if(record){const minutes=custody.startedAt!=null?Math.max(0,this.city.minute-custody.startedAt):0;if(custody.illegalDetention){record.victimCustodyMinutes=(record.victimCustodyMinutes||0)+minutes;record.victimReleasedAt=this.city.minute;record.victimReleaseReason=reason;}else{record.custodyMinutes=(record.custodyMinutes||0)+minutes;record.releasedAt=this.city.minute;record.releaseReason=reason;if(record.status==='arrested')record.status='charged';}}this.city.log(`${c.entity.properties.name} foi solto (${reason}).`,'justice',[c.id],{kind:custody.illegalDetention?'unlawful-detainee-released':'prisoner-released',caseId:record?.id,reason});return true;}
  releaseByCouncil(caseId,billId){const record=this.cases.find(r=>r.id===caseId),person=this.city.society.citizen(record?.investigation?.suspectId);if(!record||!person?.custody||person.custody.caseId!==record.id)return false;record.releaseBillId=billId;if(record.sentence){record.sentence.suspendedAt=this.city.minute;record.sentence.executionStatus='released-by-council';}return this.release(person,'Soltura votada pela Câmara');}
  setCrimeRule(type,rule,billId=null){
    if(!CRIME_TYPES[type]||!Number.isFinite(rule.severity)||!Number.isSafeInteger(rule.fine)||rule.fine<0||rule.recidivismSeverityBonus!=null&&(!Number.isSafeInteger(rule.recidivismSeverityBonus)||rule.recidivismSeverityBonus<0||rule.recidivismSeverityBonus>50)||type==='vandalism'&&rule.minimumDamage!=null&&(!Number.isSafeInteger(rule.minimumDamage)||rule.minimumDamage<0||rule.minimumDamage>100)||type==='graffiti'&&rule.exemptArtworkKinds!=null&&(!Array.isArray(rule.exemptArtworkKinds)||rule.exemptArtworkKinds.some(kind=>!['banner','painting','graffiti','statue','flags','monument'].includes(kind))) )return null;
    const next={criminal:rule.criminal!==false,severity:Math.max(0,Math.min(100,rule.severity)),fine:rule.fine,fineOnly:!!rule.fineOnly,politicalDisqualification:!!rule.politicalDisqualification,cleanRecordDisqualifying:!!rule.cleanRecordDisqualifying,recidivismSeverityBonus:Math.max(0,Math.min(50,Math.floor(rule.recidivismSeverityBonus||0))),...(type==='graffiti'?{ownerConsentDefense:rule.ownerConsentDefense!==false,exemptArtworkKinds:[...new Set(rule.exemptArtworkKinds||[])]}:{}),...(type==='vandalism'?{minimumDamage:Math.max(0,Math.min(100,Math.floor(rule.minimumDamage||0)))}:{}),cassation:!!rule.cassation,cassationTrigger:['arrest','conviction'].includes(rule.cassationTrigger)?rule.cassationTrigger:(this.policies.penalCode[type]?.cassationTrigger||'arrest')};
    this.policies.penalCode[type]=next;this.penalCodeRevision=(this.penalCodeRevision||0)+1;
    for(const record of this.cases)if(record.type===type)this.applyLenientRule(record,next,billId);
    return next;
  }
  applyLenientRule(record,next,billId=null){
    const city=this.city,old={...record.rule},oldRecidivism=Math.max(0,Math.floor(old.recidivismSeverityBonus||0)),nextRecidivism=Math.min(oldRecidivism,next.recidivismSeverityBonus||0),ownerConsentDefense=!!old.ownerConsentDefense||!!next.ownerConsentDefense,exemptArtworkKinds=[...new Set([...(old.exemptArtworkKinds||[]),...(next.exemptArtworkKinds||[])])],supportExempt=record.type==='graffiti'&&exemptArtworkKinds.includes(record.details?.artworkKind),minimumDamage=Math.max(old.minimumDamage||0,next.minimumDamage||0),belowVandalismThreshold=record.type==='vandalism'&&(record.details?.damage??0)<minimumDamage,revised={...old,criminal:old.criminal&&next.criminal&&!(record.type==='graffiti'&&record.details?.ownerAuthorized&&next.ownerConsentDefense)&&!supportExempt&&!belowVandalismThreshold,severity:Math.min(old.severity,next.severity+(record.recidivismApplied?nextRecidivism:0)),fine:Math.min(old.fine,next.fine),fineOnly:old.fineOnly||next.fineOnly,politicalDisqualification:old.politicalDisqualification&&next.politicalDisqualification,cleanRecordDisqualifying:old.cleanRecordDisqualifying&&next.cleanRecordDisqualifying,recidivismSeverityBonus:nextRecidivism,...(record.type==='graffiti'?{ownerConsentDefense,exemptArtworkKinds}:{}),...(record.type==='vandalism'?{minimumDamage}:{}),cassation:old.cassation&&next.cassation,cassationTrigger:old.cassationTrigger||'arrest'};
    if(Object.keys(revised).every(key=>revised[key]===old[key]))return false;
    record.originalRule??={...old};record.rule=revised;record.severity=revised.severity;record.legalHistory??=[];record.legalHistory.push({minute:city.minute,billId,revision:this.penalCodeRevision,previousRule:old,effectiveRule:{...revised},previousStatus:record.status});
    const c=city.society.citizen(record.chargedCitizenId??record.investigation?.suspectId);
    if(!revised.criminal){
      record.arrestWaitingReason=null;if(record.sentence){record.sentence.executionStatus='decriminalized';record.sentence.suspendedAt=city.minute;}
      if(record.status==='convicted'){record.convictionAnnulledAt=city.minute;if(record.reparation)record.reparation.civilEnforceable=true;}
      if(record.status!=='acquitted')record.status='decriminalized';record.decriminalizedAt=city.minute;if(record.trial){record.trial.status=record.status;if(record.trial.appeal?.status==='pending'){record.trial.appeal.status='closed-by-decriminalization';record.trial.appeal.decidedAt=city.minute;}}
      if(record.investigation)record.investigation.status='closed-by-decriminalization';
      const reporter=city.society.citizen(record.reporterId);if(reporter?.justiceReportCaseId===record.id){reporter.justiceReportCaseId=null;if(reporter.task==='justice-report'){reporter.task=null;reporter.path=[];reporter.targetId=null;}}
    }
    if(revised.fineOnly){record.arrestWaitingReason=null;if(record.status==='arrest-requested'){record.status='charged';record.chargedCitizenId??=record.investigation?.suspectId;}}
    if(record.sentence){record.sentence.fine=revised.criminal?Math.min(record.sentence.fine,revised.fine):0;record.sentence.imprisonmentMinutes=!revised.criminal||revised.fineOnly?0:Math.min(record.sentence.imprisonmentMinutes,Math.round(revised.severity*12));record.sentence.politicalDisqualification=!!revised.politicalDisqualification;this.refundExcessFine(record);}
    if(c?.custody?.caseId===record.id){if(!revised.criminal||revised.fineOnly)this.release(c,!revised.criminal?'Conduta descriminalizada pela Câmara':'Infração passou a admitir somente multa');else if(record.status==='convicted'){c.custody.sentenced=false;this.enforceSentence(record);}else c.custody.releaseAt=Math.min(c.custody.releaseAt,city.minute+Math.max(0,revised.severity*18));}
    this.syncCorruptionOutcome(record);city.log(`O caso #${record.id} foi revisto por alteração mais favorável do código penal.`,'justice',[c?.id].filter(Number.isInteger),{kind:'case-legal-review',caseId:record.id,billId,revision:this.penalCodeRevision,decriminalized:!revised.criminal});return true;
  }
}
