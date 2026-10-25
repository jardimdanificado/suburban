import {surfaceElevation} from './city_terrain.js';

export const AIR_RULES=Object.freeze({levels:8,separation:3,clearance:4,verticalSpeed:4,lookAhead:1.4,safetyDistance:2.4,collisionDistance:1.3});
const ground=(city,p)=>surfaceElevation(city.world,p.x,p.y);
const id=(x,y)=>`${Math.floor(x/16)},${Math.floor(y/16)}`;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
// Closest approach of two swept segments, including altitude. This also catches
// aircraft crossing between frames instead of only comparing their endpoints.
function separation(a,b,c,d){
  const x=a.x-c.x,y=a.y-c.y,z=a.z-c.z,dx=(b.x-a.x)-(d.x-c.x),dy=(b.y-a.y)-(d.y-c.y),dz=(b.z-a.z)-(d.z-c.z),length=dx*dx+dy*dy+dz*dz;
  const t=length?Math.max(0,Math.min(1,-(x*dx+y*dy+z*dz)/length)):0;
  return Math.hypot(x+dx*t,y+dy*t,z+dz*t);
}
export class CityAirTraffic {
  constructor(city){this.city=city;this.accidents=[];this.contacts=new Set();this.nextAccidentId=1;this.stats={airborne:0,holding:0,avoided:0,accidents:0,emergencies:0};}
  ceiling(){
    const revision=`${this.city.structureRevision}:${this.city.world.topologyRevision||0}`;
    if(this.ceilingRevision!==revision||this.ceilingMinute!==this.city.minute){this.ceilingRevision=revision;this.ceilingMinute=this.city.minute;this.baseAltitude=Math.max(12,this.baseAltitude||0);for(const b of this.city.buildings)if(!b.entity.destroyed)this.baseAltitude=Math.max(this.baseAltitude,(b.terrain?.base||ground(this.city,b.entity))+b.floors+AIR_RULES.clearance);}
    return this.baseAltitude;
  }
  path(from,to){
    if(!from||!to||![from.x,from.y,to.x,to.y].every(Number.isFinite))return null;
    if(to.x<0||to.y<0||to.x>=this.city.world.width||to.y>=this.city.world.height)return null;
    const count=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y))),points=[];
    for(let n=1;n<=count;n++)points.push({x:from.x+(to.x-from.x)*n/count,y:from.y+(to.y-from.y)*n/count});
    return points;
  }
  fuelNeeded(v,to){return (Math.hypot(to.x-v.x,to.y-v.y)+2*Math.max(0,this.ceiling()+21-ground(this.city,v)))*.18+5;}
  takeoff(v,journey){
    const goal=journey.parking||journey.route.at(-1)||journey.destination||v,dx=goal.x-v.x,dy=goal.y-v.y;
    // Reciprocal headings use separate cruise bands; a second band spreads load.
    const sector=(Math.floor((Math.atan2(dy,dx)+Math.PI)/(Math.PI/2))+4)%4;
    v.flightLevel=sector+(v.id%2)*4;v.cruiseAltitude=this.ceiling()+v.flightLevel*AIR_RULES.separation;
    v.altitude??=ground(this.city,v);v.flightPhase='takeoff';v.airWait=0;v.flightFault=false;
    journey.route=this.path(v,goal)||[];journey.phase='takeoff';journey.destination=goal;
  }
  land(v,reason='Pouso solicitado',emergency=false){
    if(v.journey?.landingRequested&&!v.journey.parking?.cells.some(cell=>this.city.occupied.has(cell))){
      if(emergency&&!v.journey.emergency){v.journey.emergency=true;v.journey.reason=reason;this.stats.emergencies++;}return;
    }
    const system=this.city.vehicles;let pad=system.parkingAt(v,v.id,true);
    if(!pad&&emergency){
      const slots=this.city.world.parkingTiles??=new Map();
      for(let r=0;r<=16&&!pad;r++)for(let dy=-r;dy<=r&&!pad;dy++)for(let dx=-r;dx<=r;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
        const x=Math.floor(v.x)+dx,y=Math.floor(v.y)+dy,cell=`${x},${y}`,slot=slots.get(cell);
        if(!this.city.walkable(x,y)||slot?.vehicleId!=null&&slot.vehicleId!==v.id)continue;
        pad={x:x+.5,y:y+.5,cells:[cell],emergency:true};slots.set(cell,{vehicleId:v.id});break;
      }
    }
    if(!pad){v.status='Aguardando área segura de pouso';v.landingRetryAt=this.city.minute+1;if(v.journey){v.journey.phase='holding';v.journey.emergency=emergency;}return;}
    if(!v.lineId&&v.journey?.parking&&v.journey.parking!==v.parking)system.freeParking(v.journey.parking,v.id);
    v.journey={route:this.path(v,pad)||[],destination:pad,parking:pad,phase:'cruise',landingRequested:true,emergency,reason};
    v.flightPhase='cruise';v.cruiseAltitude=Math.max(v.altitude||0,this.ceiling());
    if(emergency){this.stats.emergencies++;v.flightFault=false;}
  }
  proposal(v,dt){
    const system=this.city.vehicles,journey=v.journey,here={x:v.x,y:v.y,z:v.altitude??ground(this.city,v)},next={...here};
    if(!journey.phase)this.takeoff(v,journey);
    if(!journey.landingRequested)v.cruiseAltitude=this.ceiling()+(v.flightLevel||0)*AIR_RULES.separation;
    const speed=system.spec(v).speed*(v.condition<40?.55:1),vertical=AIR_RULES.verticalSpeed*dt;
    if(journey.phase==='takeoff'){
      next.z=Math.min(v.cruiseAltitude,here.z+vertical);if(next.z>=v.cruiseAltitude-.001)journey.phase='cruise';
    }else if(journey.phase==='cruise'){
      if(here.z<v.cruiseAltitude-.001)next.z=Math.min(v.cruiseAltitude,here.z+vertical);
      else if(here.z>v.cruiseAltitude+.001)next.z=Math.max(v.cruiseAltitude,here.z-vertical);
      else{
        while(journey.route.length&&Math.hypot(journey.route[0].x-here.x,journey.route[0].y-here.y)<.01)journey.route.shift();
        const goal=journey.route[0];
        if(goal){const dx=goal.x-here.x,dy=goal.y-here.y,len=Math.hypot(dx,dy),travel=Math.min(len,speed*dt*(journey.emergency?.5:1));next.x+=dx/len*travel;next.y+=dy/len*travel;v.angle=Math.atan2(dx,dy);}
        else journey.phase='landing';
      }
    }else if(journey.phase==='landing'){
      // A building/editor change can invalidate a reserved landing pad in flight.
      const pad=journey.parking;
      if(pad?.cells.some(cell=>this.city.occupied.has(cell))){this.land(v,'Área de pouso obstruída',true);return {v,here,next:here};}
      next.z=Math.max(ground(this.city,next),here.z-vertical);
    }
    return {v,here,next};
  }
  accident(a,b,point){
    const city=this.city;if((a.lastAirAccidentAt??-Infinity)+1>city.minute||(b.lastAirAccidentAt??-Infinity)+1>city.minute)return;
    const people=[...new Set([a.driverId,b.driverId,...a.passengerIds,...b.passengerIds].filter(Boolean))];
    const record={id:this.nextAccidentId++,minute:city.minute,vehicleIds:[a.id,b.id],citizenIds:people,x:point.x,y:point.y,altitude:point.z,cause:'Colisão durante falha de controle ou perda de separação',injured:0};
    for(const v of [a,b]){v.lastAirAccidentAt=city.minute;v.condition=Math.max(1,v.condition-45-city.random()*25);v.flightFault=false;this.land(v,'Colisão aérea',true);}
    for(const id of people){const c=city.society.citizen(id);if(c){c.needs.health=Math.max(0,c.needs.health-15-city.random()*30);c.mood-=15;record.injured++;}}
    this.stats.accidents++;this.accidents.push(Object.freeze(record));if(this.accidents.length>100)this.accidents.shift();
    city.log(`Acidente aéreo: veículos ${a.id} e ${b.id}, ${record.injured} feridos. Pouso de emergência solicitado.`,'city',people,{kind:'air-accident',airAccidentId:record.id,vehicleIds:record.vehicleIds,x:point.x,y:point.y,altitude:point.z});
  }
  update(dt){
    const system=this.city.vehicles,units=[...system.units.values()].filter(v=>v.active&&!v.scrapped),flying=units.filter(v=>v.journey),bins=new Map(),accepted=new Map();
    this.stats.airborne=0;this.stats.holding=0;
    const add=v=>{const k=id(v.x,v.y);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(v);};
    for(const v of units){v.altitude??=ground(this.city,v);add(v);}
    const neighbors=v=>{const result=[],x=Math.floor(v.x/16),y=Math.floor(v.y/16);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)result.push(...(bins.get(`${x+dx},${y+dy}`)||[]));return result;};
    flying.sort((a,b)=>(b.airWait||0)-(a.airWait||0)||Number(!!b.journey.emergency)-Number(!!a.journey.emergency)||a.id-b.id);
    for(const v of flying){
      if(!v.journey)continue;
      if((v.fuel<=0||v.condition<=15)&&!v.journey.emergency)this.land(v,v.fuel<=0?'Combustível esgotado':'Falha mecânica',true);
      if(v.landingRetryAt&&v.landingRetryAt<=this.city.minute){v.landingRetryAt=null;this.land(v,'Procurando pouso seguro',true);}
      // A poorly maintained aircraft can lose its avoidance controller. Healthy
      // aircraft never roll random accidents: damage requires a physical impact.
      if(!v.flightFault&&v.condition<35&&!v.journey.emergency&&this.city.random()<dt*.0008)v.flightFault=true;
      const p=this.proposal(v,dt),near=neighbors(v),look=Math.min(1.4,Math.max(dt,.1)),project=(start,end)=>({x:start.x+(end.x-start.x)*look/dt,y:start.y+(end.y-start.y)*look/dt,z:start.z+(end.z-start.z)*look/dt});
      let blocked=false;
      for(const other of near){if(other===v)continue;const otherHere={x:other.x,y:other.y,z:other.altitude},otherPlan=accepted.get(other.id),otherNext=otherPlan?project(otherPlan.here,otherPlan.next):otherHere;
        const current=distance(p.here,otherPlan?.here||otherHere),predicted=separation(p.here,project(p.here,p.next),otherPlan?.here||otherHere,otherNext);
        if(predicted<AIR_RULES.safetyDistance&&(current>=AIR_RULES.safetyDistance||predicted<current-.005)){blocked=true;break;}}
      if(blocked&&!v.flightFault){
        p.next={...p.here};v.airWait=(v.airWait||0)+dt;v.status='Aguardando separação aérea';this.stats.holding++;
        if(!v.airConflict){this.stats.avoided++;v.airConflict=true;}
        if(v.airWait>4&&v.journey.phase==='cruise'&&!v.journey.landingRequested){v.flightLevel=((v.flightLevel||0)+1)%AIR_RULES.levels;v.cruiseAltitude=this.ceiling()+v.flightLevel*AIR_RULES.separation;v.airWait=0;}
      }else{v.airWait=0;v.airConflict=false;v.status=v.journey.emergency?'Pouso de emergência':({takeoff:'Decolando',cruise:'Em voo',landing:'Pousando',holding:'Aguardando área segura de pouso'})[v.journey.phase];}
      accepted.set(v.id,p);
    }
    const impacts=new Set();
    for(const p of accepted.values())for(const other of neighbors(p.v)){if(other===p.v)continue;const pair=[p.v.id,other.id].sort((a,b)=>a-b).join(':');if(impacts.has(pair))continue;
      const q=accepted.get(other.id),here=q?.here||{x:other.x,y:other.y,z:other.altitude},next=q?.next||here;
      if(separation(p.here,p.next,here,next)<AIR_RULES.collisionDistance){impacts.add(pair);if(!this.contacts.has(pair))this.accident(p.v,other,p.next);}}
    this.contacts=impacts;
    for(const {v,here,next}of accepted.values()){
      const travelled=distance(here,next);v.x=next.x;v.y=next.y;v.altitude=next.z;v.entity.x=v.x;v.entity.y=v.y;v.flightPhase=v.journey?.phase||'parked';
      if(travelled){v.fuel=Math.max(0,v.fuel-travelled*(v.journey?.emergency?0:.18));v.distance+=Math.hypot(next.x-here.x,next.y-here.y);v.condition=Math.max(0,v.condition-travelled*.012);system.stats.distance+=Math.hypot(next.x-here.x,next.y-here.y);}
      if(v.altitude>ground(this.city,v)+.15)this.stats.airborne++;
      if(v.journey?.phase==='holding')this.stats.holding++;
      for(const id of [v.driverId,...v.passengerIds]){const c=this.city.society.citizen(id);if(c){c.entity.x=v.x;c.entity.y=v.y;c.action=v.status;}}
      if(v.journey?.phase==='landing'&&v.altitude<=ground(this.city,v)+.01)system.finishFlight(v);
    }
  }
}
