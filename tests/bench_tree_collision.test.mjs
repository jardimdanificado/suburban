import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {sampleCitizenMotion} from '../js/city_sim_bridge.js';

test('trees block routes and cutting or gathering approaches from a neighboring tile',()=>{
 const city=setup({starter:true,population:12}),c=city.citizens[0];
 const tree=city.nature.spawn(4,4,'mango',{mature:true});assert(tree);
 assert.equal(city.walkable(4,4),false);
 const start={x:2.5,y:4.5},goal={x:6.5,y:4.5},path=city.findPath(start,goal);assert(path);
 assert(path.every(p=>Math.floor(p.x)!==4||Math.floor(p.y)!==4));
 c.entity.x=start.x;c.entity.y=start.y;
 const approach=city.nature.interactionPath(c,{x:4.5,y:4.5});assert(approach);
 assert.equal(Math.hypot(approach.at(-1).x-4.5,approach.at(-1).y-4.5),1);
 city.nature.remove(tree,'test');assert.equal(city.walkable(4,4),true);
});

test('benches block through traffic but reserved users walk onto the seat and sit without teleporting',()=>{
 const city=setup({starter:true,population:12}),c=city.citizens[0];
 const bench={id:999,x:4.5,y:4.5,angle:0,kind:'bench',seats:[null,null]};
 city.furniture.benches=[bench];city.obstacleRevision++;
 assert.equal(city.walkable(4,4),false);
 assert.equal(city.nature.spawn(4,4,'mango'),null);
 const path=city.findPath({x:2.5,y:4.5},{x:6.5,y:4.5});assert(path);
 assert(path.every(p=>Math.floor(p.x)!==4||Math.floor(p.y)!==4));
 c.entity.x=3.5;c.entity.y=5.5;c.path=[];c.indoorLocation=null;
 const seat=city.furniture.claimBench(c,c.entity,Infinity);assert(seat);
 assert(seat.path.slice(0,-1).every(p=>city.walkable(Math.floor(p.x),Math.floor(p.y))));
 assert.equal(seat.path.at(-1).benchSeat,true);
 assert.equal(Math.floor(seat.path.at(-1).x),4);assert.equal(Math.floor(seat.path.at(-1).y),4);
 Object.assign(c.entity,seat.point);c.task='sit';c.path=[];city.furniture.syncCitizen(c);
 assert(c.seated);assert.equal(Math.floor(c.entity.x),4);assert.equal(Math.floor(c.entity.y),4);
 assert.equal(c.furnitureUse.posePoint.x,c.entity.x);assert.equal(c.furnitureUse.posePoint.y,c.entity.y);
 city.furniture.release(c);assert(c._benchExitPoint);
});

test('reconciliation removes old benches overlapping trees without deleting valid benches',()=>{
 const city=setup({starter:true,population:12});
 const bench=city.furniture.benches[0];assert(bench);
 city.furniture.reconcile();assert(city.furniture.benches.includes(bench));
 const x=Math.floor(bench.x),y=Math.floor(bench.y),id=999999;
 city.nature.tiles.set(`${x},${y}`,id);
 city.furniture.reconcile();assert(!city.furniture.benches.includes(bench));
});

test('render interpolation also respects tree and bench collision',()=>{
 const city=setup({starter:true,population:12});assert(city.nature.spawn(4,4,'mango',{mature:true}));
 const sample={city,citizen:{},entity:{x:3.5,y:4.5},to:{x:4.5,y:4.5},points:[]};
 sampleCitizenMotion(city.world,sample,0,false);
 sampleCitizenMotion(city.world,sample,1000,false);
 assert.equal(sample.entity.x,3.5);assert.equal(sample.entity.y,4.5);
});

test('a citizen walks to a collidable bench, sits, and publishes the seat without a full snapshot',async()=>{
 const {packBenchSeats,applyBenchSeats}=await import('../js/bench_seat_motion.js');
 const {citizenAnimation}=await import('../js/city_citizen_models.js');
 const city=setup({starter:true,population:48});city.minute=720;city.syncClock();
 const c=city.citizens.find(c=>!city.politics.officeHolder(c)&&!c.businessIds.length);
 city.economy.leaveJob(c);c.indoorLocation=null;c.path=[];c.conversation=null;
 for(const need in c.needs)c.needs[need]=95;c.needs.leisure=20;
 city.furniture.routeBeach=()=>false;
 const bench=city.furniture.benches[0];c.entity.x=bench.x;c.entity.y=bench.y+1;
 city.minute+=((c.id-city.minute)%5+5)%5;
 assert(city.furniture.routeLeisure(c));assert(c.path.length);
 const mirror={id:c.id,task:'walk',path:[],seated:false};
 const observed={citizens:[mirror],society:{citizen:id=>id===mirror.id?mirror:null}};
 for(let frame=0;frame<300&&!c.seated;frame++){
  city.update(1/60);applyBenchSeats(observed,packBenchSeats([c]));
 }
 assert(c.seated,'real movement must finish in the seated state without teleporting the test resident');
 assert.equal(citizenAnimation(mirror,false),'sentado_no_banco');
 assert.deepEqual(mirror.furnitureUse.posePoint,c.furnitureUse.posePoint);
 assert.equal(city.walkable(Math.floor(bench.x),Math.floor(bench.y)),false);
 city.furniture.release(c);applyBenchSeats(observed,packBenchSeats([c]));
 assert.equal(citizenAnimation(mirror,false),'idle');
});
