import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseBuildingSite,canStep} from '../js/city_terrain.js';
import {TILE_FLOOR} from '../js/world_gen.js';

function fixture(){
 const width=32,map=new Uint8Array(width*width).fill(TILE_FLOOR),world={width,height:width,map,revision:1,getTile(x,y){return map[y*width+x];}};
 return {world,occupied:new Set(),buildings:[{entity:{destroyed:false},door:{x:2.5,y:15.5}}],random:()=>0,development:{overlaps:()=>false,plots:[{id:1,x:20,y:20,width:3,depth:3},{id:2,x:10,y:0,width:2,depth:30}]}};
}

test('construction access avoids other plots and its own planned footprint',()=>{
 const city=fixture(),site=chooseBuildingSite(city,20,20,3,3,{plotId:1,type:'builder'});assert(!site.error);
 let previous=site.door;
 for(const p of site.access){
  assert(canStep(city.world,Math.floor(previous.x),Math.floor(previous.y),Math.floor(p.x),Math.floor(p.y)));
  assert(!(p.x>=10&&p.x<12&&p.y<30));assert(!(p.x>=20&&p.x<23&&p.y>=20&&p.y<23));previous=p;
 }
 assert.deepEqual(previous,city.buildings[0].door);assert(site.access.some(p=>p.y>=30));
});

test('construction access rejects a route sealed by registered plots',()=>{
 const city=fixture();city.development.plots[1].depth=32;
 const site=chooseBuildingSite(city,20,20,3,3,{plotId:1,type:'builder'});assert(site.error);
});
