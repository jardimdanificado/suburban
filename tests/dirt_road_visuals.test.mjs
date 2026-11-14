import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isDirtRoad,dirtRoadGround,permanentRoadContacts} from '../js/dirt_road_visuals.js';
import {GrassWear,GRASS_TRACK_LIFE,SandCarry,TerrainTracks,createTerrainTrackUniforms,TERRAIN_TRACK_GLSL} from '../js/terrain_tracks.js';
import {TILE_FLOOR,TILE_HILL,TILE_SAND,TILE_ROAD_GRASS,TILE_ROAD_HILL,TILE_ROAD_SAND,TILE_ROAD_GRASS_STONE,TILE_WATER} from '../js/world_gen.js';
const stamp={x:1,z:1.5,width:.2,length:.22,angle:0,kind:-1};

test('dirt roads use their natural ground while paved roads keep their material',()=>{
  for(const [road,ground] of [[TILE_ROAD_GRASS,TILE_FLOOR],[TILE_ROAD_HILL,TILE_HILL],[TILE_ROAD_SAND,TILE_SAND]]){
    assert(isDirtRoad(road));assert.equal(dirtRoadGround(road),ground);
  }
  for(const tile of [TILE_FLOOR,TILE_ROAD_GRASS_STONE,TILE_WATER]){assert(!isDirtRoad(tile));assert.equal(dirtRoadGround(tile),tile);}
  const source=readFileSync(new URL('../js/renderer_3d.js',import.meta.url),'utf8');
  const start=source.indexOf('const visualType=dirtRoadGround(tType)'),end=source.indexOf('const bucket = tileMeshBuckets',start);
  assert(start>0&&end>start);
  const choose=new Function('dirtRoadGround','farmSurfaceTile','FARM_TILES','shouldRenderTerrainSprite','terrainTextureCategory','terrainTextureHash','tType','TILE_SAND',`
    const tx=1,ty=1,isSidewalk=false,isTreeSidewalk=false,detailBand=0;
    ${source.slice(start,end)}return {visualType,bucketKey};`);
  for(const [road,ground] of [[TILE_ROAD_GRASS,TILE_FLOOR],[TILE_ROAD_HILL,TILE_HILL],[TILE_ROAD_SAND,TILE_SAND]]){
    const selection=choose.call({_farmSoilCells:new Set()},dirtRoadGround,tile=>tile,new Set(),()=>false,()=>null,()=>0,road,TILE_SAND);
    assert.equal(selection.visualType,ground);assert.equal(selection.bucketKey,ground===TILE_SAND?'sandClean':ground);
  }
});

test('permanent marks stop at dirt-road borders and exclude transported residue',()=>{
  const world={width:4,height:4,getTile:x=>x===1?TILE_ROAD_GRASS:TILE_FLOOR};
  const marks=permanentRoadContacts([stamp,{...stamp,deposit:-.5}],world);
  assert.equal(marks.length,1);assert.deepEqual(marks[0].clip,[1,1,2,2]);
  assert.deepEqual(permanentRoadContacts([stamp],{...world,getTile:()=>TILE_ROAD_GRASS_STONE}),[]);
  for(const tile of [TILE_ROAD_GRASS,TILE_ROAD_HILL,TILE_ROAD_SAND])assert(permanentRoadContacts([stamp],{...world,getTile:()=>tile}).length>0);
});

test('only trampled parts of dirt roads remain bare; natural grass still regrows and paving clears CPU wear',()=>{
  let road=TILE_ROAD_GRASS;
  const world={width:4,height:4,getTile:x=>x===1?road:TILE_FLOOR},wear=new GrassWear();
  assert.equal(wear.strength(1.03125,1.46875,world,0),0);
  wear.record([stamp],world,0);
  assert.equal(wear.strength(1.03125,1.46875,world,10000),1);
  assert.equal(wear.strength(.96875,1.46875,world,GRASS_TRACK_LIFE),0);
  assert.equal(wear.strength(1.8,1.8,world,10000),0);
  wear.prune(10000,1000,world);assert(wear.cells.size>0);
  road=TILE_ROAD_GRASS_STONE;wear.prune(10000,1000,world);assert.equal(wear.cells.size,0);
});

test('sand from imaginary roads still transfers to shoes',()=>{
  const carry=new SandCarry(),entity={},world={width:4,height:4,getTile:x=>x===0?TILE_ROAD_SAND:TILE_ROAD_GRASS_STONE};
  carry.contacts(entity,[{...stamp,x:.5}],world);
  const marks=carry.contacts(entity,[{...stamp,x:1.1},{...stamp,x:1.3},{...stamp,x:1.5}],world);
  assert(marks.length>0);assert(marks.every(mark=>mark.deposit>0));
});

test('permanent contacts use a separate GPU atlas, survive deposits and release GPU targets on reset',()=>{
  class Attribute{constructor(array,itemSize){Object.assign(this,{array,itemSize});}setUsage(){return this;}setXYZW(i,...v){this.array.set(v,i*4);}setXY(i,...v){this.array.set(v,i*2);}setX(i,v){this.array[i]=v;}}
  class Geometry{constructor(){this.attributes={};}setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k];}setIndex(){}dispose(){}}
  class Scene{add(){}remove(){}}
  class Color{clone(){return this;}}
  class Target{constructor(width,height,options){Object.assign(this,{width,height,options,texture:{}});}dispose(){this.disposed=true;}}
  class Vector{set(){}}
  const THREE={DataTexture:class{},Vector2:Vector,Scene,Camera:class{},Color,ShaderMaterial:class{constructor(options){Object.assign(this,options);}},WebGLRenderTarget:Target,
    InstancedBufferGeometry:Geometry,Float32BufferAttribute:Attribute,InstancedBufferAttribute:Attribute,Mesh:class{constructor(geometry,material){Object.assign(this,{geometry,material});}},RedFormat:'red',RGBAFormat:'rgba'};
  const passes=[],renderer={capabilities:{maxTextureSize:4096,isWebGL2:true},autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:false},target:null,
    getRenderTarget(){return this.target;},setRenderTarget(target){this.target=target;},getClearColor:()=>new Color(),getClearAlpha:()=>1,setClearColor(){},clear(){},
    readRenderTargetPixels(){throw Error('GPU readback forbidden');},render(){passes.push({target:this.target,pass:tracks.material.uniforms.permanentPass.value});}};
  const world={width:4,height:4,getTile:()=>TILE_ROAD_GRASS},uniforms=createTerrainTrackUniforms(THREE),tracks=new TerrainTracks(THREE,uniforms);
  tracks.ensureWorld(renderer,world);
  const permanent=tracks.permanentTarget;
  assert.equal(permanent.options.format,'red');assert.equal(uniforms.terrainPermanentTrackMap.value,permanent.texture);
  tracks.paint(renderer,[stamp]);tracks.paint(renderer,permanentRoadContacts([stamp],world),permanent,1);
  tracks.paint(renderer,[{...stamp,deposit:-.5}]);
  assert.deepEqual(passes.map(pass=>pass.pass),[0,1,0]);assert.notEqual(passes[2].target,permanent);
  assert(TERRAIN_TRACK_GLSL.includes('max(texture2D(terrainPermanentTrackMap, uv).r,'));
  assert(tracks.material.fragmentShader.includes('greaterThanEqual(vContactWorld,vContactClip.zw)'));
  tracks.permanentRoadTiles.set(5,{x:1,z:1});
  world.getTile=()=>TILE_ROAD_GRASS_STONE;world.revision=1;
  tracks.update(renderer,world,[],.1);
  assert.equal(passes.at(-1).pass,2,'paving removes the old permanent mask');
  assert.equal(tracks.permanentRoadTiles.size,0);
  tracks.clear();assert(permanent.disposed);assert.equal(uniforms.terrainPermanentTrackMap.value,tracks.empty);
});
