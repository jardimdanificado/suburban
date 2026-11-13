import test from 'node:test';
import assert from 'node:assert/strict';
import {beginTerrainFade,advanceTerrainFades,finishTerrainFade} from '../js/terrain_quality_fade.js';
function material(){return {defaultAttributeValues:{grassShelter:[0,0,0,0]},clone:material,customProgramCacheKey:()=> 'base',dispose(){this.disposed=true;},onBeforeCompile(shader){shader.uniforms.original={value:true};}};}
function chunk(){return {terrain:{parent:{},children:[{material:material()}]},water:{children:[]}};}
function renderer(){return {_terrainFadeClock:{value:10},disposeTerrainChunk(c){c.disposed=true;}};}
test('quality replacements retain old ground during a complementary dither fade',()=>{
 const r=renderer(),old=chunk(),next=chunk(),original=next.terrain.children[0].material;
 assert.equal(beginTerrainFade(r,old,next),true);assert.equal(old.disposed,undefined);
 const shaders=[];
 for(const c of [old,next]){
   const shader={uniforms:{},fragmentShader:'#include <common>\nvoid main() {\n}'};
   c.terrain.children[0].material.onBeforeCompile(shader);shaders.push(shader);
   assert(shader.uniforms.original.value);assert(shader.fragmentShader.includes('pattern>=blend:pattern<blend'));
 }
 assert.equal(shaders[0].uniforms.terrainFadeIncoming.value,0);assert.equal(shaders[1].uniforms.terrainFadeIncoming.value,1);
 advanceTerrainFades(r,10.2);assert.equal(old.disposed,undefined);
 advanceTerrainFades(r,10.5);assert.equal(old.disposed,true);assert.equal(next.terrain.children[0].material,original);assert.equal(r._terrainFades.size,0);
});
test('a hidden or disabled replacement skips fading, and cancellation frees temporary materials',()=>{
 const r=renderer(),old=chunk(),next=chunk();old.terrain.parent=null;
 assert.equal(beginTerrainFade(r,old,next),false);old.terrain.parent={};
 r.terrainOptimizationsEnabled=false;assert.equal(beginTerrainFade(r,old,next),false);
 r.terrainOptimizationsEnabled=true;beginTerrainFade(r,old,next);
 const fade=next._terrainFade,materials=[...fade.materials];finishTerrainFade(r,fade);finishTerrainFade(r,fade);
 assert(materials.every(m=>m.disposed));assert.equal(next._terrainFade,null);assert.equal(r._terrainFades.size,0);
});
