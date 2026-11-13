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
 r.invalidateTerrainAt(45,45);assert.ok(cancelled);assert.ok(pending.partial.disposed);assert.equal(r._terrainBuildJobs.size,0);
 assert.equal(r.terrainChunks.get('2,2'),complete,'local edits retain the last complete terrain');
 r.rebuildTerrainIfNeeded(w,40,45,40,45);r.advanceTerrainBuilds(w,new Set(['2,2']),false,1000);
 assert.notEqual(r.terrainChunks.get('2,2'),complete);assert.ok(complete.disposed);
});

test('stationary terrain finishes despite remote edits and publishes only after roots are ready',()=>{
 const r=new Klass(),w=world(),city={structureRevision:0,buildings:[]};let starts=0,rootsReady=false;
 const group=()=>({children:[],add(child){child.parent=this;},remove(child){child.parent=null;}});
 const make=signature=>({signature,terrain:group(),water:group(),grid:group()});
 Object.assign(r,{zoom:2,mapWidth:128,mapHeight:128,camX:45,camY:45,terrainChunks:new Map(),visibleTerrainChunkKeys:new Set(),cityDevelopment:{city},terrainGroup:group(),waterGroup:group(),rctGridLineGroup:group(),isPerspectiveActive(){return false;},disposeTerrainChunk(c){c.disposed=true;},buildTerrainPlaceholder(){return make('pending');},*buildTerrainChunkSteps(...args){starts++;const c=make(args[6]);yield c;while(!rootsReady)yield {waitingForRoots:true};return c;}});
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
 const r=new Klass(),cancelled=[];Object.assign(r,{terrainChunkSize:32,cancelTerrainBuild(key){cancelled.push(key);}});
 r.invalidateTerrainAt(48,48);assert.deepEqual(cancelled,['1,1']);
 cancelled.length=0;r.invalidateTerrainAt(31,31);
 assert.deepEqual(cancelled,['0,0','1,0','0,1','1,1']);
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
