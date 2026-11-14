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
  const factor=city.fastForward2?2:1;minMinutes*=factor;maxMinutes*=factor;
  let timers=reducedCadences.get(owner);if(!timers)reducedCadences.set(owner,timers=new Map());
  const now=city.minute||0,old=timers.get(key),sig=String(signature);
  if(old&&old.signature!==sig){timers.set(key,{signature:sig,nextAt:now+Math.max(1,minMinutes)});return true;}
  if(!old){const span=Math.max(0,maxMinutes-minMinutes),offset=span?cadenceHash(`${key}:${owner.id??owner.constructor?.name??''}`)%(span+1):0;timers.set(key,{signature:sig,nextAt:now+minMinutes+offset});return true;}
  if(now<old.nextAt)return false;
  const span=Math.max(0,maxMinutes-minMinutes),offset=span?cadenceHash(`${key}:${now}`)%(span+1):0;
  old.nextAt=now+minMinutes+offset;return true;
}
const TRAVEL_TASKS = new Set(['work','manage','leisure','social','walk','energy','food','water','health','hygiene','toilet']);
// SPECIAL keys split by frequency: the common personal states are checked by
// direct property read before the array scan, so the recurring fast-forward
// pass pays the small list only for citizens in rare missions.
const COMMON_SPECIAL=['deliveryId','cleaningJobId','informalJobId','conversation','workMeal','mobilityTrip','sharedBoatRide','ridingVehicleId','pregnancy'];

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

// ff skips safe personal passes for four minutes; ff2 widens that event window
// and also time-slices stable idle adults. Needs are integrated on wake.
export function deferFastForwardCitizen(city,c){
  const state=schedules.get(city);if(!city.fastForward||!state)return false;
  const path=c.indoorLocation?.path?.length?c.indoorLocation.path:c.path,n=c.needs,sleeping=c.task==='energy'&&c.sleep?.active&&!path?.length;
  const idle=city.fastForward2&&c.task==null&&!path?.length&&c.homeUnitId&&city.minute<(c._nextTaskAt||0)&&c._routineRevision===routineRevision(city,c)&&Math.min(n.food,n.water,n.energy,n.hygiene,n.toilet,n.health)>45&&!city.urgentNeed(c);
  // The safe predicate is all pure reads (age() only refreshes deterministic
  // derived caches), so the terms keep the same result in any order. The
  // activity gate comes first: most residents in fast-forward fail here and
  // used to pay the society.age() call before failing. The rare-mission scan
  // (formerly SPECIAL.some with a closure per candidate) is unrolled to
  // direct property reads with identical truthiness and short-circuit slot.
  const traveling=TRAVEL_TASKS.has(c.task)&&(path?.length||sleeping);
  const safe=!c.entity.destroyed&&c.initialAge>=18&&(traveling||idle)&&!(c.deliveryId||c.cleaningJobId||c.informalJobId||c.conversation||c.workMeal||c.mobilityTrip||c.ridingVehicleId||c.pregnancy||c.skybridgeTransit||c.custody||c.custodyEscort||c.custodyWaterDelivery||c.funeralBodyId||c.graffitiMission||c.policePatrol||c.policeResponse||c.policeInvestigation||c.policeOversight||c.policeAudit||c.policeRestitution||c.policeArrestEscort||c.combatFlee||c.forestryJob||c.mechanicJob||c.paintWorkId||c.workProjectId)&&!c.substanceState?.effects?.length&&!c.combatInjuries?.length&&!c.career?.pendingInterview&&!city.childrenOf(c.id).length&&(city.society?.age?.(c)??c.initialAge)<85&&Number.isFinite(n.food+n.water+n.energy+n.hygiene+n.toilet+n.health)&&(!sleeping||n.energy>1)&&n.food>(sleeping?6:city.fastForward2?35:19)&&n.water>(sleeping?6:city.fastForward2?35:19)&&(sleeping||n.energy>(city.fastForward2?30:13))&&n.hygiene>11&&n.toilet>(sleeping?6:city.fastForward2?30:11)&&n.health>21;
  // Hour-boundary wakes used to trip every citizen in the same minute and
  // turn the hour's first worker interval into a 100-300 ms spike. Each
  // citizen now wakes within the first 8 minutes of the hour on its own line
  // (id mod 8); shift boundaries, payroll and civic rules are hour-based, so
  // the couple of minutes of jitter stay inside the same hourly window.
  if(!safe||(city.minute-(c.id%8))%60===0||city.detailedInteriorBuildingId!=null&&c.indoorLocation?.buildingId===city.detailedInteriorBuildingId){state.people.delete(c);return false;}
  // The signature used to be rebuilt as an array for every citizen every
  // minute; compare tokens directly on the stored entry instead.
  const previous=state.people.get(c);
  const nextTaskAt=c._nextTaskAt,routineRevisionValue=c._routineRevision,worldRevision=city.world.revision,structureRevision=city.structureRevision;
  if(previous&&previous.task===c.task&&previous.path===path&&previous.homeUnitId===c.homeUnitId&&previous.jobId===c.jobId&&previous.nextTaskAt===nextTaskAt&&previous.routineRevision===routineRevisionValue&&previous.worldRevision===worldRevision&&previous.structureRevision===structureRevision&&previous.sleeping===sleeping)return true;
  // Invalidation wakes immediately. The next scheduled check never crosses an
  // hour boundary, where shifts, payroll and many civic rules can change.
  const sleepEnd=sleeping?c.sleep.lastMinute+480-c.sleep.minutes:Infinity;
  const at=Math.min(city.minute+(city.fastForward2?12:4),Math.floor(city.minute/60+1)*60,sleepEnd,idle?c._nextTaskAt:Infinity);
  const entry=state.queue.schedule(at,c);entry.value=c;entry.at=at;entry.sleeping=sleeping;entry.path=path;entry.homeUnitId=c.homeUnitId;entry.jobId=c.jobId;entry.nextTaskAt=nextTaskAt;entry.routineRevision=routineRevisionValue;entry.worldRevision=worldRevision;entry.structureRevision=structureRevision;
  state.people.set(c,entry);return false;
}

// Repeated low-priority searches become a routine, with an hourly wake and
// immediate invalidation on a changed job, home, city structure or urgent need.
// The revision string was rebuilt for every citizen every minute and then
// discarded; the cache keeps only the last inputs and the resulting string.
// A citizen's business list mutates in place by appending, and any removal
// reassigns a fresh array, so identity plus length detects every change.
const routineRevisions=new WeakMap();
// Hourly reviews keep the same wake spread documented at deferFastForwardCitizen.
export function routineRevision(city,c){
  const hour=Math.floor((city.minute-(c.id%8))/60);
  const jobId=c.jobId??null,homeUnitId=c.homeUnitId??null,businessIds=c.businessIds,structureRevision=city.structureRevision,worldRevision=city.world.revision;
  const cached=routineRevisions.get(c);
  if(cached&&cached.hour===hour&&cached.jobId===jobId&&cached.homeUnitId===homeUnitId&&cached.businessIds===businessIds&&cached.structureRevision===structureRevision&&cached.worldRevision===worldRevision)return cached.value;
  const value=`${c.jobId}:${c.homeUnitId}:${businessIds.join(',')}:${structureRevision}:${worldRevision}:${hour}`;
  routineRevisions.set(c,{value,hour,jobId,homeUnitId,businessIds,structureRevision,worldRevision});
  return value;
}
export function nextRoutineReview(city,c,stable,urgent=false){
  const interval=city.fastForward&&!urgent?(city.fastForward2?(stable?120:40):(stable?60:20)):(stable?30:10);
  // The next review lands on the citizen's own staggered hourly wake instead
  // of stacking every resident on the same minute.
  return Math.min(city.minute+interval+c.id%interval,Math.floor((city.minute-(c.id%8))/60+1)*60+(c.id%8));
}
