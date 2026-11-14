import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainStoneSurface,terrainSurfaceElevation,terrainTileSurfaceVertices} from '../js/road_terrain_geometry.js';
import {TILE_FLOOR,TILE_STONE,TILE_ROAD_GRASS_STONE} from '../js/world_gen.js';
const fixture=()=>({width:8,height:8,seed:42,revision:1,map:new Uint8Array(64).fill(TILE_FLOOR)});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('rock facets are deterministic, asymmetric and cached until terrain changes',()=>{
  const world=fixture();world.map[27]=TILE_STONE;
  const surface=terrainStoneSurface(world,3,3);
  assert.equal(surface.ring.length,8);
  assert.equal(terrainStoneSurface(world,3,3),surface);
  assert.deepEqual(terrainStoneSurface({...world},3,3),surface);
  assert.ok(surface.center.every(Number.isFinite));
  assert.notEqual(surface.center[0],3.5);
  assert.notDeepEqual(terrainStoneSurface({...world,seed:43},3,3),surface);
  world.map[28]=TILE_STONE;world.revision++;
  assert.notDeepEqual(terrainStoneSurface(world,3,3),surface);
  assert.equal(terrainStoneSurface(world,0,0),null);
});

test('neighboring rock facets share every edge vertex across tile and chunk boundaries',()=>{
  const world=fixture();for(const index of [27,28,35,36])world.map[index]=TILE_STONE;
  const a=terrainStoneSurface(world,3,3),east=terrainStoneSurface(world,4,3),south=terrainStoneSurface(world,3,4);
  for(const [i,j] of [[2,0],[3,7],[4,6]])assert.deepEqual(a.ring[i],east.ring[j]);
  for(const [i,j] of [[6,0],[5,1],[4,2]])assert.deepEqual(a.ring[i],south.ring[j]);
});

test('outer rock edges remain on existing wall panels and roads keep grid-aligned seams',()=>{
  const world=fixture();world.map[27]=TILE_STONE;world.map[19]=TILE_ROAD_GRASS_STONE;
  const {ring}=terrainStoneSurface(world,3,3),corners=terrainTileSurfaceVertices(world,3,3);
  for(let i=0;i<4;i++)for(let axis=0;axis<3;axis++)near(ring[i*2+1][axis],(corners[i][axis]+corners[(i+1)%4][axis])/2);
  assert.equal(ring[0][2],3);assert.equal(ring[2][2],3);
});

test('walking elevation follows the new coarse rock triangles',()=>{
  const world=fixture();world.map[27]=TILE_STONE;
  const {ring,center}=terrainStoneSurface(world,3,3);
  near(terrainSurfaceElevation(world,center[0],center[2]),center[1]);
  for(let i=0;i<8;i++){
    const points=[center,ring[i],ring[(i+1)%8]],mean=axis=>points.reduce((sum,p)=>sum+p[axis],0)/3;
    near(terrainSurfaceElevation(world,mean(0),mean(2)),mean(1));
  }
});


test('rock relief has no systematic raised summit at each tile center',()=>{
  const world=fixture();world.map.fill(TILE_STONE);
  let valleys=0;
  for(let y=1;y<7;y++)for(let x=1;x<7;x++){
    const {center,ring}=terrainStoneSurface(world,x,y),u=center[0]-x,v=center[2]-y;
    const plane=ring[0][1]*(1-u)*(1-v)+ring[2][1]*u*(1-v)+ring[4][1]*u*v+ring[6][1]*(1-u)*v;
    assert.ok(Math.abs(center[1]-plane)<.12,'no tile-sized pyramid');
    if(center[1]<plane)valleys++;
  }
  assert.ok(valleys>0,'centers can follow valleys instead of always rising');
});
