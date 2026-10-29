import test from 'node:test';
import assert from 'node:assert/strict';
import {beginBuildingSiteSearch,chooseBuildingSite} from '../js/city_terrain.js';
function fixture(){let reads=0,seed=123,calls=0;const city={world:{width:64,height:64,revision:0,getTile(x,y){reads++;return x>=0&&y>=0&&x<64&&y<64?0:5;}},occupied:new Set(),obstacleRevision:0,buildings:[{entity:{destroyed:false},door:{x:4.5,y:4.5}}],development:{plots:[],overlaps(x,y,w,d,id){return this.plots.some(p=>p.id!==id&&x<p.x+p.width&&x+w>p.x&&y<p.y+p.depth&&y+d>p.y);}},random(){calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}};return {city,reads:()=>reads,state:()=>[seed,calls]};}
test('one investment search reuses equivalent trade sites without changing routes or random draws',()=>{
 const ordinary=fixture(),cached=fixture(),end=beginBuildingSiteSearch(cached.city),expected=[],actual=[];
 try{for(let i=0;i<100;i++){const options={type:['market','bakery','cleaner','clinic'][i%4]};expected.push(chooseBuildingSite(ordinary.city,20,20,4,4,options));actual.push(chooseBuildingSite(cached.city,20,20,4,4,options));}}finally{end();}
 assert.deepEqual(actual,expected);assert.deepEqual(cached.state(),ordinary.state());assert(cached.reads()<ordinary.reads());
 const before=cached.reads();chooseBuildingSite(cached.city,20,20,4,4);assert(cached.reads()>before,'search lifetime must end');
});
test('cached sites return independent coordinates and invalidate when buildings or registered plots change',()=>{
 const {city}=fixture(),end=beginBuildingSiteSearch(city),options={type:'market',rotation:0};
 try{
 const first=chooseBuildingSite(city,20,20,4,4,options);assert(first.access.length);const original=structuredClone(first);first.door.x=-100;first.access[0].x=-100;first.access.length=0;assert.deepEqual(chooseBuildingSite(city,20,20,4,4,options),original);
 for(let y=0;y<64;y++)city.occupied.add(`12,${y}`);city.obstacleRevision++;assert(chooseBuildingSite(city,20,20,4,4,options).error);
 city.occupied.clear();city.obstacleRevision++;assert(!chooseBuildingSite(city,20,20,4,4,options).error);
 city.development.plots.push({id:1,x:12,y:0,width:1,depth:64});assert(chooseBuildingSite(city,20,20,4,4,options).error);city.development.plots[0].y=40;city.development.plots[0].depth=1;assert(!chooseBuildingSite(city,20,20,4,4,options).error);
 }finally{end();}
});
test('terrain edits invalidate cached orientations and invalid rotations consume no random numbers',()=>{
 const f=fixture(),end=beginBuildingSiteSearch(f.city);try{const options={rotation:0};assert(!chooseBuildingSite(f.city,20,20,4,4,options).error);f.city.world.getTile=()=>2;f.city.world.revision++;assert(chooseBuildingSite(f.city,20,20,4,4,options).error);const before=f.state();assert(chooseBuildingSite(f.city,20,20,4,4,{rotation:8}).error);assert.deepEqual(f.state(),before);}finally{end();}
});

test('contractor load sorting preserves favoritism, active backlog, reputation and explicit selection',async()=>{
 const {CityDevelopment}=await import('../js/city_development.js');
 const builders=Array.from({length:12},(_,i)=>({id:i+1,type:'builder',accountId:`business:${i+1}`,door:{x:i,y:0},favorUntil:i===4?500:0,favoredBy:7}));
 const city={minute:480,economy:{businesses:builders,mayorId:7,connected:()=>true},reputation:{providerPenalty:b=>b.id%4}},development=new CityDevelopment(city);
 development.projects=Array.from({length:1000},(_,i)=>({builderId:i%12+1,cancelled:i%7===0,status:i%5===0?'completed':'materials'}));
 const reference=client=>builders.filter(b=>b.accountId!==client).sort((a,b)=>(client==='treasury'?Number(b.favorUntil>city.minute&&b.favoredBy===7)-Number(a.favorUntil>city.minute&&a.favoredBy===7):0)||development.projects.filter(p=>p.builderId===a.id&&!p.cancelled&&p.status!=='completed').length-development.projects.filter(p=>p.builderId===b.id&&!p.cancelled&&p.status!=='completed').length||city.reputation.providerPenalty(a)-city.reputation.providerPenalty(b)||a.id-b.id)[0];
 for(const client of ['treasury','citizen:1','business:1'])assert.equal(development.selectBuilder(client,{x:20,y:20}),reference(client));
 assert.equal(development.selectBuilder('citizen:1',{x:20,y:20},8),builders[7]);assert.equal(development.selectBuilder('business:8',{x:20,y:20},8),null);
 city.minute=501;assert.equal(development.selectBuilder('treasury',{x:20,y:20}),reference('treasury'));
});
