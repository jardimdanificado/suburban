import {terrainZoomDetail} from '../js/terrain_zoom_detail.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cachedWaterGeometry,setWaterGeometryCacheEnabled} from '../js/water_geometry_cache.js';
import {sandShoreTileSurface} from '../js/sand_shore.js';
import {shoreFoamTileSurface,cachedShoreFoamTileSurface} from '../js/water_foam.js';
import {sandNormalField} from '../js/sand_surface_lighting.js';
import {grassChunkSignatures,grassExclusionSignature,grassExclusionCells,constructionSiteCells} from '../js/city_site_footprints.js';
const world=()=>({width:128,height:128,revision:1,getTile(x,z){return x<0||z<0||x>=128||z>=128?5:z<64?3:2;}});

test('coast caches preserve geometry and invalidate on terrain edits, dimensions and map replacement',()=>{
 const w=world();let builds=0;const build=()=>({id:++builds});
 const first=cachedWaterGeometry(w,'test','key',build);assert.equal(cachedWaterGeometry(w,'test','key',build),first);
 w.waterPollutionRevision=1;w.simTick=120;assert.equal(cachedWaterGeometry(w,'test','key',build),first);
 w.revision++;assert.notEqual(cachedWaterGeometry(w,'test','key',build),first);assert.equal(builds,2);
 w.width++;cachedWaterGeometry(w,'test','key',build);w.map=new Uint8Array(10);cachedWaterGeometry(w,'test','key',build);assert.equal(builds,4);
 const legacy={};cachedWaterGeometry(legacy,'test','key',build);cachedWaterGeometry(legacy,'test','key',build);assert.equal(builds,6,'worlds without a revision stay uncached');
});
test('warm coast rebuilds reuse identical surfaces and world normals without scanning terrain again',()=>{
 const w=world(),tile=w.getTile;let reads=0;w.getTile=(x,z)=>{reads++;return tile(x,z);};
 const water=(x,z)=>w.getTile(x,z)===2,sand=(x,z)=>w.getTile(x,z)===3;
 const bed=sandShoreTileSurface(w,63,64),a=cachedShoreFoamTileSurface(w,63,64,water,bed,sand);
 assert.deepEqual(a,shoreFoamTileSurface(63,64,water,bed,sand));
 const field=sandNormalField(w),normal=field(63.25,64.25);reads=0;
 assert.equal(sandShoreTileSurface(w,63,64),bed);assert.equal(cachedShoreFoamTileSurface(w,63,64,water,bed,sand),a);
 assert.equal(sandNormalField(w),field);assert.equal(field(63.25,64.25),normal);assert.ok(reads<=1,`${reads} terrain reads after warming`);
 w.revision++;assert.notEqual(sandShoreTileSurface(w,63,64),bed);assert.notEqual(sandNormalField(w),field);
});
test('footprints invalidate nearby chunks and their blend neighbors, not distant water',()=>{
 const a=grassChunkSignatures(new Set(['40,40']),32,128,128),b=grassChunkSignatures(new Set(['40,40','100,100']),32,128,128);
 assert.equal(a.get('2,2'),b.get('2,2'));assert.notEqual(a.get('3,3'),b.get('3,3'));
 const border=grassChunkSignatures(new Set(['31,31']),32,128,128);assert.deepEqual([...border.keys()].sort(),['0,0','0,1','1,0','1,1']);
});

const source=readFileSync(new URL('../js/renderer_3d.js',import.meta.url),'utf8');
const method=source.slice(source.indexOf('  rebuildTerrainIfNeeded('),source.indexOf('\n  buildTerrainChunk('));
const Klass=new Function('terrainZoomDetail','cityGoverningParty','grassExclusionSignature','grassExclusionCells','constructionSiteCells','grassChunkSignatures',`return class {${method} ${source.slice(source.indexOf('  invalidateTerrainAt('),source.indexOf('\n  terrainViewportBounds('))}}`)(terrainZoomDetail,()=>null,grassExclusionSignature,grassExclusionCells,constructionSiteCells,grassChunkSignatures);
test('actual chunk renderer builds visible terrain only and a far building does not rebuild its coast',()=>{
 const r=new Klass(),w=world(),city={structureRevision:0,buildings:[]};let builds=0;
 const group=()=>({add(child){child.parent=this;},remove(child){child.parent=null;}});
 Object.assign(r,{zoom:2,mapWidth:128,mapHeight:128,camX:45,camY:45,terrainChunks:new Map(),visibleTerrainChunkKeys:new Set(),cityDevelopment:{city},terrainGroup:group(),waterGroup:group(),rctGridLineGroup:group(),isPerspectiveActive(){return false;},disposeTerrainChunk(){},buildTerrainChunk(_world,_a,_b,_c,_d,_vision,signature){builds++;return {signature,terrain:{},water:{},grid:{children:[]}};}});
 r.rebuildTerrainIfNeeded(w,40,45,40,45);assert.equal(builds,1,'eight hidden neighbors must not stall this frame');
 r.camX=115;r.rebuildTerrainIfNeeded(w,40,45,40,45);assert.equal(builds,1,'moving the camera must not rebuild an existing chunk just because its center distance changed');r.camX=45;
 city.buildings.push({id:1,type:'residential',entity:{x:100,y:100},width:2,depth:2});city.structureRevision++;
 r.rebuildTerrainIfNeeded(w,40,45,40,45);assert.equal(builds,1,'the distant lot must not rebuild the visible chunk');
 city.buildings.push({id:3,type:'farm',entity:{x:110,y:110},width:2,depth:2});city.structureRevision++;
 r.rebuildTerrainIfNeeded(w,40,45,40,45);assert.equal(builds,1,'a distant farm must not restart visible terrain');
 city.buildings.push({id:2,type:'residential',entity:{x:45,y:45},width:2,depth:2});city.structureRevision++;
 r.rebuildTerrainIfNeeded(w,40,45,40,45);assert.equal(builds,2,'a changed lot inside the visible chunk still rebuilds');
 r.zoom=.4;r.rebuildTerrainIfNeeded(w,40,45,40,45);assert.equal(r.terrainChunkSize,16);assert.equal(builds,3);
 r.zoom=.38;r.rebuildTerrainIfNeeded(w,40,45,40,45);assert.equal(builds,3,'small zoom changes inside one LOD band keep the terrain cache');
});

test('empty ocean entries do not evict useful coast arrays, and retained geometry stays bounded',()=>{
 const w=world();let builds=0;
 const first=cachedWaterGeometry(w,'bounded','coast',()=>({id:++builds}));
 for(let i=0;i<1000;i++)cachedWaterGeometry(w,'bounded',`empty-${i}`,()=>null);
 assert.equal(cachedWaterGeometry(w,'bounded','coast',()=>({id:++builds})),first);
 for(let i=0;i<600;i++)cachedWaterGeometry(w,'bounded',`coast-${i}`,()=>({id:++builds}));
 assert.notEqual(cachedWaterGeometry(w,'bounded','coast',()=>({id:++builds})),first);
});

test('terrain jobs preserve the visible chunk until complete and cancel stale partial work',()=>{
 const r=new Klass(),w=world(),city={structureRevision:0,buildings:[]};let cancelled=false;
 const group=()=>({children:[],add(child){child.parent=this;},remove(child){child.parent=null;}});
 const make=signature=>({signature,terrain:group(),water:group(),grid:group()});
 Object.assign(r,{zoom:2,mapWidth:128,mapHeight:128,camX:45,camY:45,terrainChunks:new Map(),visibleTerrainChunkKeys:new Set(),cityDevelopment:{city},terrainGroup:group(),waterGroup:group(),rctGridLineGroup:group(),isPerspectiveActive(){return false;},disposeTerrainChunk(c){c.disposed=true;},buildTerrainPlaceholder(){return make('pending');},*buildTerrainChunkSteps(...args){const c=make(args[6]);try{yield c;for(let i=0;i<100;i++){const start=performance.now();while(performance.now()-start<.1){}yield;}return c;}finally{cancelled=true;}}});
 r.rebuildTerrainIfNeeded(w,40,45,40,45);const placeholder=r.terrainChunks.get('2,2');assert.equal(placeholder.signature,'pending');assert.ok(r._terrainBuildJobs.size);
 r.advanceTerrainBuilds(w,new Set(['2,2']),false,1000);const complete=r.terrainChunks.get('2,2');assert.notEqual(complete,placeholder);assert.ok(placeholder.disposed);assert.equal(r._terrainBuildJobs.size,0);
 r.zoom=.4;r.rebuildTerrainIfNeeded(w,40,45,40,45);assert.equal(r.terrainChunks.get('2,2'),complete,'zoom changes keep existing ground until replacement is ready');
 const pending=r._terrainBuildJobs.get('2,2');assert.ok(pending.partial);cancelled=false;w.revision++;
 r.invalidateTerrainAt(115,115);
 r.advanceTerrainBuilds(w,new Set(['2,2']),false,1);assert.equal(cancelled,false);assert.equal(pending.partial.disposed,undefined);
 r.invalidateTerrainAt(45,45);assert.equal(cancelled,false);assert.equal(pending.partial.disposed,undefined);assert.equal(r._terrainBuildJobs.get('2,2'),pending);
 assert.equal(r.terrainChunks.get('2,2'),complete,'local edits retain the last complete terrain');
 r.rebuildTerrainIfNeeded(w,40,45,40,45);r.advanceTerrainBuilds(w,new Set(['2,2']),false,1000);
 assert.notEqual(r.terrainChunks.get('2,2'),complete);assert.ok(complete.disposed);
 r.rebuildTerrainIfNeeded(w,40,45,40,45);r.advanceTerrainBuilds(w,new Set(['2,2']),false,1000);
 assert.match(r.terrainChunks.get('2,2').signature,/\|r1$/,'coalesced edits get a fresh replacement after current work completes');
});

test('stationary terrain finishes despite remote edits and publishes only after roots are ready',()=>{
 const r=new Klass(),w=world(),city={structureRevision:0,buildings:[]};let starts=0,rootsReady=false;
 const group=()=>({children:[],add(child){child.parent=this;},remove(child){child.parent=null;}});
 const make=signature=>({signature,terrain:group(),water:group(),grid:group()});
 Object.assign(r,{zoom:2,mapWidth:128,mapHeight:128,camX:45,camY:45,terrainChunks:new Map(),visibleTerrainChunkKeys:new Set(),cityDevelopment:{city},terrainGroup:group(),waterGroup:group(),rctGridLineGroup:group(),isPerspectiveActive(){return false;},disposeTerrainChunk(c){c.disposed=true;},buildTerrainPlaceholder(){return make('pending');},*buildTerrainChunkSteps(...args){if(args[1]===32&&args[3]===32)starts++;const c=make(args[6]);yield c;while(!rootsReady)yield {waitingForRoots:true};return c;}});
 r.rebuildTerrainIfNeeded(w,40,45,40,45);const old=r.terrainChunks.get('2,2');
 for(let i=0;i<20;i++){
   w.revision++;r.invalidateTerrainAt(115,115);r.rebuildTerrainIfNeeded(w,40,45,40,45);
   assert.equal(r.terrainChunks.get('2,2'),old);assert.equal(starts,1);
 }
 rootsReady=true;r.advanceTerrainBuilds(w,new Set(['2,2']),false,1000);
 const ready=r.terrainChunks.get('2,2');assert.notEqual(ready,old);assert.ok(old.disposed);
 for(let i=0;i<20;i++){w.revision++;r.invalidateTerrainAt(115,115);r.rebuildTerrainIfNeeded(w,40,45,40,45);assert.equal(r.terrainChunks.get('2,2'),ready);}
 assert.equal(starts,1);assert.equal(r._terrainBuildJobs.size,0);
 let cleared=0;r.grassRootJobs={clear(){cleared++;}};r.invalidateTerrainAt(NaN,NaN);
 assert.equal(cleared,1);assert.equal(r.terrainChunks.size,0);assert.ok(ready.disposed);
});

test('tile edits invalidate dependency radius rather than nine whole blocks',()=>{
 const r=new Klass();r.terrainChunkSize=32;
 r.invalidateTerrainAt(48,48);assert.deepEqual([...r._terrainChunkVersions.keys()],['1,1']);
 r._terrainChunkVersions.clear();r.invalidateTerrainAt(31,31);
 assert.deepEqual([...r._terrainChunkVersions.keys()],['0,0','1,0','0,1','1,1']);
});
test('terrain scheduler finishes the center before peripheral queued blocks',()=>{
 const r=new Klass(),order=[],group={add(){}};
 const job=key=>({world:null,steps:(function*(){order.push(key);return {terrain:{},water:{},grid:{children:[]}};})()});
 const w=world(),far=job('0,0'),near=job('2,2');far.world=near.world=w;
 Object.assign(r,{camX:40,camY:40,terrainChunkSize:16,_terrainBuildJobs:new Map([['0,0',far],['2,2',near]]),terrainChunks:new Map(),terrainGroup:group,waterGroup:group});
 r.advanceTerrainBuilds(w,new Set(['0,0','2,2']),false,1000);assert.deepEqual(order,['2,2','0,0']);
});

test('disabling terrain optimizations bypasses water caches until enabled again',()=>{
 const w=world();let builds=0;const build=()=>++builds;
 assert.equal(cachedWaterGeometry(w,'toggle','a',build),1);
 setWaterGeometryCacheEnabled(w,false);
 assert.equal(cachedWaterGeometry(w,'toggle','a',build),2);
 assert.equal(cachedWaterGeometry(w,'toggle','a',build),3);
 setWaterGeometryCacheEnabled(w,true);
 assert.equal(cachedWaterGeometry(w,'toggle','a',build),4);
 assert.equal(cachedWaterGeometry(w,'toggle','a',build),4);
});
test('disabled terrain optimizations use full detail and synchronous terrain at every zoom',()=>{
 const r=new Klass(),w=world(),group={add(){},remove(){}};let builds=0;
 Object.assign(r,{terrainOptimizationsEnabled:false,zoom:.2,mapWidth:128,mapHeight:128,camX:45,camY:45,terrainChunks:new Map(),visibleTerrainChunkKeys:new Set(),terrainGroup:group,waterGroup:group,rctGridLineGroup:group,isPerspectiveActive(){return false;},disposeTerrainChunk(){},*buildTerrainChunkSteps(){throw Error('progressive work must be bypassed');},buildTerrainChunk(...args){builds++;assert.equal(args[7],2);return {signature:args[6],terrain:{},water:{},grid:{children:[]}};}});
 r.rebuildTerrainIfNeeded(w,40,45,40,45);assert.equal(builds,1);assert.equal(r.terrainChunkSize,32);assert.equal(r._terrainBuildJobs?.size||0,0);
 r.zoom=.7;r.rebuildTerrainIfNeeded(w,40,45,40,45);assert.equal(builds,1);
});

test('prefetched neighbors stay hidden and are ready before the camera enters them',()=>{
 const r=new Klass(),w=world(),order=[];
 const group=()=>({children:[],add(child){child.parent=this;},remove(child){child.parent=null;}});
 const make=signature=>({signature,terrain:group(),water:group(),grid:group()});
 Object.assign(r,{zoom:2,mapWidth:128,mapHeight:128,camX:40,camY:40,terrainChunks:new Map(),visibleTerrainChunkKeys:new Set(),terrainGroup:group(),waterGroup:group(),rctGridLineGroup:group(),isPerspectiveActive(){return false;},disposeTerrainChunk(c){c.disposed=true;},buildTerrainPlaceholder(){return make('pending');},*buildTerrainChunkSteps(...args){order.push(`${args[1]/16},${args[3]/16}`);return make(args[6]);}});
 r.rebuildTerrainIfNeeded(w,40,45,40,45);r.advanceTerrainBuilds(w,r.visibleTerrainChunkKeys,false,1000);
 assert.equal(order[0],'2,2');const ready=r.terrainChunks.get('3,2');assert(ready);assert.equal(ready.terrain.parent,undefined);
 r.camX=56;r.rebuildTerrainIfNeeded(w,56,60,40,45);
 assert.equal(r.terrainChunks.get('3,2'),ready);assert.equal(ready.terrain.parent,r.terrainGroup);
 assert.equal(order.filter(key=>key==='3,2').length,1);
});

test('off-screen preparation waits while a visible chunk is blocked on grass',()=>{
 const r=new Klass(),w=world(),group={add(){}},visible=new Set(['2,2']);let waiting=true,background=0;
 const make=()=>({terrain:{},water:{},grid:{children:[]}});
 const foreground={world:w,steps:(function*(){while(waiting)yield {waitingForRoots:true};return make();})()};
 const hidden={world:w,steps:(function*(){background++;return make();})()};
 Object.assign(r,{camX:40,camY:40,terrainChunkSize:16,terrainChunks:new Map(),terrainGroup:group,waterGroup:group,_terrainPrefetchKeys:new Set(['2,2','3,2']),_terrainBuildJobs:new Map([['3,2',hidden],['2,2',foreground]])});
 r.advanceTerrainBuilds(w,visible,false,1000);assert.equal(background,0);assert.equal(r._terrainBuildJobs.size,2);
 waiting=false;r.advanceTerrainBuilds(w,visible,false,1000);assert.equal(background,1);assert.equal(r._terrainBuildJobs.size,0);
});

test('continuous local edits cannot starve the currently visible terrain build',()=>{
 const r=new Klass(),w=world(),group=()=>({children:[],add(c){c.parent=this;},remove(){}}),make=signature=>({signature,terrain:group(),water:group(),grid:group()});let ready=false,starts=0;
 Object.assign(r,{zoom:.4,mapWidth:128,mapHeight:128,camX:40,camY:40,terrainChunks:new Map(),visibleTerrainChunkKeys:new Set(),terrainGroup:group(),waterGroup:group(),rctGridLineGroup:group(),isPerspectiveActive(){return false;},disposeTerrainChunk(c){c.disposed=true;},buildTerrainPlaceholder(){return make('pending');},*buildTerrainChunkSteps(...args){if(args[1]===32&&args[3]===32)starts++;const c=make(args[6]);yield c;while(!ready)yield {waitingForRoots:true};return c;}});
 r.rebuildTerrainIfNeeded(w,40,45,40,45);const pending=r._terrainBuildJobs.get('2,2');
 for(let i=0;i<30;i++){w.revision++;r.invalidateTerrainAt(40,40);r.rebuildTerrainIfNeeded(w,40,45,40,45);assert.equal(r._terrainBuildJobs.get('2,2'),pending);}
 ready=true;r.advanceTerrainBuilds(w,new Set(['2,2']),false,1000);
 assert.equal(starts,1);assert.notEqual(r.terrainChunks.get('2,2').signature,'pending');
 r.rebuildTerrainIfNeeded(w,40,45,40,45);r.advanceTerrainBuilds(w,new Set(['2,2']),false,1000);
 assert.match(r.terrainChunks.get('2,2').signature,/\|r30$/);
});
