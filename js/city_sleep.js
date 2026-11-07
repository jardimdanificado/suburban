/** Rest is measured in actual simulation minutes, independently of stimulants. */
export const SLEEP_MINUTES=480;
export function sleepState(city,c){return c.sleep??={active:false,minutes:0,lastMinute:null,lastWakeAt:city.minute-((city.hour+24-(c.substanceState?.nocturnal?22:6))%24)*60,completed:0};}
export function wantsSleep(city,c){const s=sleepState(city,c);if(s.active||s.minutes>0)return true;const awake=city.minute-s.lastWakeAt;return awake>=960||awake>=480&&c.needs.energy<25||awake>=720&&(c.substanceState?.nocturnal?city.hour>=6&&city.hour<14:city.hour>=22||city.hour<6);}
export function sleepMinute(city,c,{street=false}={}){
 const s=sleepState(city,c);if(s.lastMinute===city.minute)return;
 const elapsed=s.active?Math.min(SLEEP_MINUTES-s.minutes,Math.max(1,city.minute-(s.lastMinute??city.minute-1))):1;
 if(!s.active){s.active=true;s.startedAt=city.minute;s.sessionStartedAt=city.minute;s.interruptedAt=null;}
 s.lastMinute=city.minute;s.minutes+=elapsed;c.lastProgressAt=city.minute;
 c.needs.energy=Math.min(100,c.needs.energy+(street?.22:.26)*elapsed);c.action=`Dormindo${street?' no abrigo de rua':''} · ${s.minutes}/${SLEEP_MINUTES} min`;
 if(s.minutes>=SLEEP_MINUTES){s.active=false;s.lastDuration=s.minutes;s.lastWakeAt=city.minute;s.completed++;s.minutes=0;c.task=null;c.targetId=null;c.servicePaid=null;c._nextTaskAt=0;c.action='Acordou após oito horas de sono';}
}
export function interruptSleep(city,c){const s=c.sleep;if(!s?.active)return;const pending=Math.min(SLEEP_MINUTES-s.minutes,Math.max(0,city.minute-(s.lastMinute??city.minute)-1));if(pending){s.minutes+=pending;c.needs.energy=Math.min(100,c.needs.energy+(c.homeUnitId ? .26 : .22)*pending);s.lastMinute=city.minute-1;}s.active=false;s.interruptedAt=city.minute;}
