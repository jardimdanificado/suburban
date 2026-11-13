import {terrainZoomDetail} from '../js/terrain_zoom_detail.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cachedWaterGeometry} from '../js/water_geometry_cache.js';
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
 assert.equal(a.get('1,1'),b.get('1,1'));assert.notEqual(a.get('3,3'),b.get('3,3'));
 const border=grassChunkSignatures(new Set(['31,31']),32,128,128);assert.deepEqual([...border.keys()].sort(),['0,0','0,1','1,0','1,1']);
});

const source=readFileSync(new URL('../js/renderer_3d.js',import.meta.url),'utf8');
const method=source.slice(source.indexOf('  rebuildTerrainIfNeeded('),source.indexOf('\n  buildTerrainChunk('));
const Klass=new Function('terrainZoomDetail','cityGoverningParty','grassExclusionSignature','grassExclusionCells','constructionSiteCells','grassChunkSignatures',`return class {${method}}`)(terrainZoomDetail,()=>null,grassExclusionSignature,grassExclusionCells,constructionSiteCells,grassChunkSignatures);
test('actual chunk renderer builds visible terrain only and a far building does not rebuild its coast',()=>{
 const r=new Klass(),w=world(),city={structureRevision:0,buildings:[]};let builds=0;
 const group=()=>({add(child){child.parent=this;},remove(child){child.parent=null;}});
 Object.assign(r,{zoom:2,mapWidth:128,mapHeight:128,camX:45,camY:45,terrainChunks:new Map(),visibleTerrainChunkKeys:new Set(),cityDevelopment:{city},terrainGroup:group(),waterGroup:group(),rctGridLineGroup:group(),isPerspectiveActive(){return false;},disposeTerrainChunk(){},buildTerrainChunk(_world,_a,_b,_c,_d,_vision,signature){builds++;return {signature,terrain:{},water:{},grid:{children:[]}};}});
 r.rebuildTerrainIfNeeded(w,40,50,40,50);assert.equal(builds,1,'eight hidden neighbors must not stall this frame');
 city.buildings.push({id:1,type:'residential',entity:{x:100,y:100},width:2,depth:2});city.structureRevision++;
 r.rebuildTerrainIfNeeded(w,40,50,40,50);assert.equal(builds,1,'the distant lot must not rebuild the visible chunk');
 city.buildings.push({id:2,type:'residential',entity:{x:45,y:45},width:2,depth:2});city.structureRevision++;
 r.rebuildTerrainIfNeeded(w,40,50,40,50);assert.equal(builds,2,'a changed lot inside the visible chunk still rebuilds');
 r.zoom=.4;r.rebuildTerrainIfNeeded(w,40,50,40,50);assert.equal(r.terrainChunkSize,32);assert.equal(builds,3);
 r.zoom=.38;r.rebuildTerrainIfNeeded(w,40,50,40,50);assert.equal(builds,3,'small zoom changes inside one LOD band keep the terrain cache');
});

test('empty ocean entries do not evict useful coast arrays, and retained geometry stays bounded',()=>{
 const w=world();let builds=0;
 const first=cachedWaterGeometry(w,'bounded','coast',()=>({id:++builds}));
 for(let i=0;i<1000;i++)cachedWaterGeometry(w,'bounded',`empty-${i}`,()=>null);
 assert.equal(cachedWaterGeometry(w,'bounded','coast',()=>({id:++builds})),first);
 for(let i=0;i<600;i++)cachedWaterGeometry(w,'bounded',`coast-${i}`,()=>({id:++builds}));
 assert.notEqual(cachedWaterGeometry(w,'bounded','coast',()=>({id:++builds})),first);
});
