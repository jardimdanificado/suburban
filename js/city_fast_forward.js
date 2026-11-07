// Runtime scheduling stays out of snapshots. Entries are invalidated by changes
// to the itinerary, job, home, map, or physical condition, and at every hour.
const schedules = new WeakMap();
const reducedCadences = new WeakMap();

function cadenceHash(value){
  let hash=2166136261;
  for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return hash>>>0;
}

export function reducedCadence(city,owner,key,minMinutes,maxMinutes=minMinutes,signature=''){
  if(!city?.fastForward){reducedCadences.get(owner)?.delete(key);return true;}
  let timers=reducedCadences.get(owner);if(!timers)reducedCadences.set(owner,timers=new Map());
  const now=city.minute||0,old=timers.get(key),sig=String(signature);
  if(old&&old.signature!==sig){timers.set(key,{signature:sig,nextAt:now+Math.max(1,minMinutes)});return true;}
  if(!old){const span=Math.max(0,maxMinutes-minMinutes),offset=span?cadenceHash(`${key}:${owner.id??owner.constructor?.name??''}`)%(span+1):0;timers.set(key,{signature:sig,nextAt:now+minMinutes+offset});return true;}
  if(now<old.nextAt)return false;
  const span=Math.max(0,maxMinutes-minMinutes),offset=span?cadenceHash(`${key}:${now}`)%(span+1):0;
  old.nextAt=now+minMinutes+offset;return true;
}
const TRAVEL_TASKS = new Set(['work','manage','leisure','social','walk','energy','food','water','health','hygiene','toilet']);
const SPECIAL = ['deliveryId','cleaningJobId','informalJobId','conversation','workMeal','mobilityTrip','ridingVehicleId','skybridgeTransit','custody','custodyEscort','custodyWaterDelivery','funeralBodyId','graffitiMission','policePatrol','policeResponse','policeInvestigation','policeOversight','policeAudit','policeRestitution','policeArrestEscort','combatFlee','forestryJob','mechanicJob','paintWorkId','workProjectId','pregnancy'];

/** A small deterministic min-heap; equal times retain insertion order. */
export class OccurrenceQueue {
  constructor(){this.heap=[];this.serial=0;}
  schedule(at,value){const entry={at,value,serial:this.serial++},h=this.heap;h.push(entry);let i=h.length-1;while(i){const p=(i-1)>>1;if(!this.before(entry,h[p]))break;h[i]=h[p];i=p;}h[i]=entry;return entry;}
  before(a,b){return a.at<b.at||a.at===b.at&&a.serial<b.serial;}
  takeUntil(at){const out=[],h=this.heap;while(h.length&&h[0].at<=at){out.push(h[0]);const last=h.pop();if(!h.length)break;let i=0;while(i*2+1<h.length){let child=i*2+1;if(child+1<h.length&&this.before(h[child+1],h[child]))child++;if(!this.before(h[child],last))break;h[i]=h[child];i=child;}h[i]=last;}return out;}
}

export function beginFastForwardMinute(city){
  if(!city.fastForward){schedules.delete(city);return;}
  let state=schedules.get(city);if(!state){state={queue:new OccurrenceQueue(),people:new Map()};schedules.set(city,state);}
  for(const entry of state.queue.takeUntil(city.minute))if(state.people.get(entry.value)===entry)state.people.delete(entry.value);
}

// Only safe adult journeys and sleep defer their personal decision pass, at most
// four city minutes. Production, transactions, justice and social events still
// execute each minute. Needs are integrated by the existing elapsed-time path.
export function deferFastForwardCitizen(city,c){
  const state=schedules.get(city);if(!city.fastForward||!state)return false;
  const path=c.indoorLocation?.path?.length?c.indoorLocation.path:c.path,n=c.needs,sleeping=c.task==='energy'&&c.sleep?.active&&!path?.length;
  const safe=!c.entity.destroyed&&c.initialAge>=18&&(city.society?.age?.(c)??c.initialAge)<85&&TRAVEL_TASKS.has(c.task)&&(path?.length||sleeping)&&!SPECIAL.some(key=>c[key])&&!c.substanceState?.effects?.length&&!c.combatInjuries?.length&&!c.career?.pendingInterview&&!city.childrenOf(c.id).length&&Number.isFinite(n.food+n.water+n.energy+n.hygiene+n.toilet+n.health)&&(!sleeping||n.energy>1)&&n.food>(sleeping?6:19)&&n.water>(sleeping?6:19)&&(sleeping||n.energy>13)&&n.hygiene>11&&n.toilet>(sleeping?6:11)&&n.health>21;
  if(!safe||city.minute%60===0||city.detailedInteriorBuildingId!=null&&c.indoorLocation?.buildingId===city.detailedInteriorBuildingId){state.people.delete(c);return false;}
  const signature=[c.task,path,c.homeUnitId,c.jobId,city.world.revision,city.structureRevision,sleeping];
  const previous=state.people.get(c);
  if(previous&&signature.every((value,i)=>value===previous.signature[i]))return true;
  // Invalidation wakes immediately. The next scheduled check never crosses an
  // hour boundary, where shifts, payroll and many civic rules can change.
  const sleepEnd=sleeping?c.sleep.lastMinute+480-c.sleep.minutes:Infinity;
  const at=Math.min(city.minute+4,Math.floor(city.minute/60+1)*60,sleepEnd);
  const entry=state.queue.schedule(at,c);entry.signature=signature;state.people.set(c,entry);return false;
}

// Repeated low-priority searches become a routine, with an hourly wake and
// immediate invalidation on a changed job, home, city structure or urgent need.
export function routineRevision(city,c){return `${c.jobId}:${c.homeUnitId}:${c.businessIds.join(',')}:${city.structureRevision}:${city.world.revision}:${Math.floor(city.minute/60)}`;}
export function nextRoutineReview(city,c,stable,urgent=false){
  const interval=city.fastForward&&!urgent?(stable?60:20):(stable?30:10);
  return Math.min(city.minute+interval+c.id%interval,Math.floor(city.minute/60+1)*60);
}
