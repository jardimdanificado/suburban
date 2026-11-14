import test from 'node:test';
import assert from 'node:assert/strict';
import {boatSurfaceY} from '../js/city_watercraft_renderer.js';
import {waterWaveHeight,WATER_LEVEL,WATER_WAVE_GLSL} from '../js/water_surface.js';
import {BOAT_CLASSES} from '../js/boat_types.js';
import {TILE_WATER,TILE_FLOOR} from '../js/world_gen.js';
import {surfaceElevation} from '../js/city_terrain.js';

const world=tile=>({width:16,height:16,getTile:()=>tile});
test('boats track the actual GPU wave height instead of amplified waves',()=>{
  const gpuWave=new Function('p','uCaribbeanWaterTime','sin','cos','max',WATER_WAVE_GLSL
    .replace('float caribbeanWaveHeight(vec2 p)', 'function caribbeanWaveHeight(p)')
    .replace('float waves =','let waves =')+';return caribbeanWaveHeight(p);');
  for(const time of [0,1,10,100])for(const [x,y] of [[0,0],[2.5,5.8],[10,12]]){
    const wave=waterWaveHeight(x,y,time);
    assert(Math.abs(wave-gpuWave({x,y},time,Math.sin,Math.cos,Math.max))<1e-12);
    assert(wave>=-.035&&wave<=.079);
    for(const [kind,spec] of Object.entries(BOAT_CLASSES)){
      const scale=kind==='canoe'?1:spec.scale,group={scale:{y:scale},userData:{floatHeight:.12}};
      assert(Math.abs(boatSurfaceY({waterTime:time},world(TILE_WATER),x,y,group)-(WATER_LEVEL+wave+.12-.08*scale))<1e-12);
    }
  }
});
test('lower draft applies only afloat and preserves boats carried over land',()=>{
  const land=world(TILE_FLOOR),group={scale:{y:2.3},userData:{floatHeight:.12}};
  assert.equal(boatSurfaceY({waterTime:20},land,5,5,group),surfaceElevation(land,5,5)+.12);
});
