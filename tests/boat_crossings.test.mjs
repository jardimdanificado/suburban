import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../js/city_simulation.js';
import {CityStateGraph} from '../js/city_state.js';
import {CityVehicles} from '../js/city_vehicles.js';
import {planBoatTrip,advanceLocalBoatTrip} from '../js/city_boat_towing.js';
import {crossingFare,dispatchRegularCrossings} from '../js/city_boat_crossings.js';

function fixture(count=3){
 const width=32,height=24,map=new Uint8Array(width*height);for(let y=0;y<height;y++)for(let x=12;x<18;x++)map[y*width+x]=2;
 const world={width,height,map,revision:1,getTile(x,y){return x<0||y<0||x>=width||y>=height?5:map[y*width+x];}};
 const job={id:17,active:true,accountId:'job',door:{x:23.5,y:12.5},entity:{destroyed:false,properties:{name:'Trabalho'}}},home={id:18,active:true,door:{x:8.5,y:12.5},entity:{destroyed:false,properties:{name:'Casa'}}};
 const citizens=Array.from({length:count},(_,i)=>{const c={id:i+1,accountId:`person:${i+1}`,businessIds:[],jobId:17,homeUnitId:18,path:[],task:'work',targetId:17,needs:Object.fromEntries(['food','water','energy','hygiene','toilet','health'].map(k=>[k,95])),entity:{x:10.5,y:12.5+i*.2,properties:{name:`Pessoa ${i+1}`}}};c.entity.properties.citizen=c;return c;});
 const boat={id:9,good:'launch',boatClass:'launch',active:true,condition:100,ownerAccountId:'company',x:12.5,y:12.5,distance:0,entity:{x:12.5,y:12.5},passengerIds:[]},payments=[];
 const business={id:4,ownerId:99,accountId:'company',door:{x:10.5,y:10.5},active:true,workers:[],entity:{destroyed:false,properties:{name:'Travessias do canal'}}};
 const city=Object.assign(Object.create(CitySimulation.prototype),{world,citizens,occupied:new Set(),obstacleRevision:0,structureRevision:0,minute:480,pathCache:new Map(),buildings:[job,home,business],units:new Map([[18,{buildingId:18}]]),building:id=>[job,home,business].find(b=>b.id===id),worldPort:{accountId:'port'},society:{citizen:id=>citizens.find(c=>c.id===id),isAdult:()=>true},logistics:{shipments:[]},currency:{price:n=>n},payerFor:c=>c.accountId,accounts:new Map([...citizens.map(c=>[c.accountId,{balance:500}]),['company',{balance:0}]]),transfer(from,to,amount,reason,details){const a=this.accounts.get(from),b=this.accounts.get(to);if(a.balance<amount)return false;a.balance-=amount;b.balance+=amount;payments.push({from,to,amount,reason,details});return true;}});
 city.vehicles=new CityVehicles(city);city.vehicles.units=new Map([[9,boat]]);city.vehicles.boatCount=1;
 return {city,boat,citizens,leader:citizens[0],payments,goal:job.door};
}
function walk(c,dt){let left=dt*4;while(left>0&&c.path.length){const p=c.path[0],dx=p.x-c.entity.x,dy=p.y-c.entity.y,len=Math.hypot(dx,dy),step=Math.min(left,len);if(len){c.entity.x+=dx/len*step;c.entity.y+=dy/len*step;}left-=step;if(step>=len-1e-6)c.path.shift();}}
function run(f,max=1200){let boarded=0,sailing=false;const start=f.city.minute,previous=new Map(f.citizens.map(c=>[c.id,{...c.entity}]));
 for(let i=0;i<max;i++){
  f.city.minute=start+Math.floor(i*.05*4);
  for(const c of f.citizens){if(!advanceLocalBoatTrip(f.city,c,.05))walk(c,.05);const old=previous.get(c.id);assert.ok(Math.hypot(c.entity.x-old.x,c.entity.y-old.y)<=.05*6+.001,'all boarding, sailing and landing must move physically');previous.set(c.id,{...c.entity});}
  f.city.vehicles.syncBoatTravelers();if(f.boat.localTripCitizenId!=null)assert.equal(f.boat.driverId,f.boat.localTripCitizenId);
  boarded=Math.max(boarded,f.citizens.filter(c=>c.boatVehicleId===f.boat.id).length);sailing||=f.leader.localBoatTrip?.sharedCrossing?.phase==='sailing';
  if(f.citizens.every(c=>!c.path.length&&!c.localBoatTrip&&!c.sharedBoatRide))return {boarded,sailing};
 }
 assert.fail('crossing did not finish');
}
test('a company recruits workers, shares one physical hull and divides fare by actual occupancy',()=>{
 const f=fixture();f.leader.path=planBoatTrip(f.city,f.leader.entity,f.goal);assert.ok(f.leader.path);
 advanceLocalBoatTrip(f.city,f.leader,.01);assert.equal(f.leader.localBoatTrip.sharedCrossing.members.length,2);assert.equal(f.payments.length,0);
 const result=run(f);assert.equal(result.boarded,3);assert.equal(result.sailing,true);assert.equal(f.payments.length,3);assert.ok(f.payments.every(p=>p.amount===15&&p.details.passengers===3));
 for(const c of f.citizens){assert.equal(c.boatVehicleId,null);assert.equal(c.sharedBoatRide??null,null);assert.ok(Math.hypot(c.entity.x-f.goal.x,c.entity.y-f.goal.y)<.01);}
 const route=f.city.vehicles.crossingRoutes[0];assert.equal(route.companyName,'Travessias do canal');assert.equal(route.organizerId,99);assert.equal(route.members.length,3);assert.equal(route.departures,1);assert.equal(route.revenue,45);
 assert.equal(f.boat.driverId,null);assert.deepEqual(f.boat.passengerIds,[]);
});
test('fare decreases monotonically with occupancy and a solo traveller is not stranded waiting for a full boat',()=>{
 const f=fixture(1);assert.ok(crossingFare(f.city,f.boat,1)>crossingFare(f.city,f.boat,2));assert.ok(crossingFare(f.city,f.boat,2)>crossingFare(f.city,f.boat,4));
 f.leader.path=planBoatTrip(f.city,f.leader.entity,f.goal);run(f);assert.equal(f.payments[0].amount,45);
});
test('a late request joins a boarding boat rather than treating its entire capacity as reserved',()=>{
 const f=fixture(2),other=f.citizens[1];other.sleep={active:true};f.leader.path=planBoatTrip(f.city,f.leader.entity,f.goal);advanceLocalBoatTrip(f.city,f.leader,.01);
 other.sleep.active=false;other.path=planBoatTrip(f.city,other.entity,f.goal);assert.equal(other.path[0].boatPlan.sharedTripCitizenId,f.leader.id);run(f);assert.equal(f.payments.length,2);assert.ok(f.payments.every(p=>p.amount===23));
});
test('urgent needs and a faster land journey exclude a passenger from recruitment',()=>{
 const f=fixture(3);f.citizens[1].needs.water=0;f.citizens[2].jobId=18;f.citizens[2].targetId=18;
 f.leader.path=planBoatTrip(f.city,f.leader.entity,f.goal);advanceLocalBoatTrip(f.city,f.leader,.01);assert.equal(f.leader.localBoatTrip.sharedCrossing.members.length,0);
});

test('retained workers return home together and repeat the route the next morning',()=>{
 const f=fixture();f.leader.path=planBoatTrip(f.city,f.leader.entity,f.goal);run(f);
 f.city.minute=1020;dispatchRegularCrossings(f.city);assert.ok(f.citizens.some(c=>c.path[0]?.boatPlan));run(f);
 assert.ok(f.citizens.every(c=>Math.hypot(c.entity.x-8.5,c.entity.y-12.5)<.01));
 f.city.minute=1440+450;dispatchRegularCrossings(f.city);assert.ok(f.citizens.some(c=>c.path[0]?.boatPlan));run(f);
 assert.ok(f.citizens.every(c=>Math.hypot(c.entity.x-f.goal.x,c.entity.y-f.goal.y)<.01));assert.equal(f.payments.length,9);
});
test('shared household funds are checked before any passenger is charged',()=>{
 const f=fixture(2);f.city.payerFor=()=>f.leader.accountId;f.city.accounts.get(f.leader.accountId).balance=30;
 f.leader.path=planBoatTrip(f.city,f.leader.entity,f.goal);run(f);assert.equal(f.payments.length,0);assert.ok(f.citizens.every(c=>c.entity.x<12));
});
test('a surviving passenger lands the group physically after the pilot dies at sea',()=>{
 const f=fixture();f.leader.path=planBoatTrip(f.city,f.leader.entity,f.goal);
 for(let i=0;i<400;i++){
  for(const c of f.citizens)if(!advanceLocalBoatTrip(f.city,c,.05))walk(c,.05);
  if(f.leader.localBoatTrip?.sharedCrossing?.phase==='sailing'&&f.boat.x>14)break;
 }
 assert.ok(f.boat.x>14);f.leader.dead=true;f.leader.entity.destroyed=true;f.city.society.citizen=id=>f.citizens.find(c=>c.id===id&&!c.entity.destroyed);
 advanceLocalBoatTrip(f.city,f.citizens[1],.05);assert.equal(f.citizens[1].sharedBoatRide.state,'aboard');advanceLocalBoatTrip(f.city,f.leader,.05);
 assert.ok(f.citizens[1].localBoatTrip);run(f);
 assert.ok(f.citizens.slice(1).every(c=>f.city.world.getTile(Math.floor(c.entity.x),Math.floor(c.entity.y))!==2));assert.equal(f.payments.length,3);
});

test('saving a sailing group preserves occupancy and avoids charging twice',()=>{
 const f=fixture();f.leader.path=planBoatTrip(f.city,f.leader.entity,f.goal);
 for(let i=0;i<400;i++){
  for(const c of f.citizens)if(!advanceLocalBoatTrip(f.city,c,.05))walk(c,.05);
  if(f.leader.localBoatTrip?.sharedCrossing?.phase==='sailing'&&f.boat.x>14)break;
 }
 assert.equal(f.payments.length,3);
 const packet=new CityStateGraph().encode({city:{world:f.city.world},citizens:f.citizens,units:f.city.vehicles.units,routes:f.city.vehicles.crossingRoutes,accounts:f.city.accounts});
 const saved=new CityStateGraph().apply(structuredClone(packet));
 f.citizens=saved.citizens;f.city.citizens=f.citizens;f.city.society.citizen=id=>f.citizens.find(c=>c.id===id);f.leader=f.citizens[0];
 f.city.vehicles.units=saved.units;f.boat=saved.units.get(9);f.city.vehicles.crossingRoutes=saved.routes;f.city.accounts=saved.accounts;
 run(f);assert.equal(f.payments.length,3);assert.equal(f.city.vehicles.crossingRoutes[0].departures,1);
 assert.ok(f.citizens.every(c=>Math.hypot(c.entity.x-f.goal.x,c.entity.y-f.goal.y)<.01));
});

test('recruitment respects hull capacity and a missing passenger cannot delay departure indefinitely',()=>{
 const full=fixture(12);full.leader.path=planBoatTrip(full.city,full.leader.entity,full.goal);const result=run(full);assert.equal(result.boarded,8);assert.equal(full.payments.length,8);
 const late=fixture(2);late.leader.path=planBoatTrip(late.city,late.leader.entity,late.goal);
 for(let i=0;i<400&&late.leader.path.length;i++)advanceLocalBoatTrip(late.city,late.leader,.05);
 assert.equal(late.leader.localBoatTrip,null);assert.equal(late.citizens[1].sharedBoatRide,null);assert.equal(late.payments.length,1);assert.equal(late.payments[0].amount,45);
});
test('daily invitations stop when members change jobs',()=>{
 const f=fixture();f.leader.path=planBoatTrip(f.city,f.leader.entity,f.goal);run(f);
 for(const c of f.citizens)c.jobId=null;
 f.city.minute=1020;dispatchRegularCrossings(f.city);assert.ok(f.citizens.every(c=>!c.path.length));
});
