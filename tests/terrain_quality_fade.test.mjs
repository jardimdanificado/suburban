import test from 'node:test';
import assert from 'node:assert/strict';
import {beginTerrainFade,advanceTerrainFades,finishTerrainFade,clearTerrainFadeMaterials} from '../js/terrain_quality_fade.js';
function material(){return {copy(base){this.userData=base.userData;return this;},defaultAttributeValues:{grassShelter:[0,0,0,0]},clone:material,customProgramCacheKey:()=> 'base',dispose(){this.disposed=true;},onBeforeCompile(shader){shader.uniforms.original={value:true};}};}
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
   assert(materials.every(m=>!m.disposed));clearTerrainFadeMaterials(r);assert(materials.every(m=>m.disposed));assert.equal(next._terrainFade,null);assert.equal(r._terrainFades.size,0);
});
test('fade materials share userData instead of serializing shader textures',()=>{
 const r=renderer(),old=chunk(),next=chunk();let serializations=0;
 const base=material(),userData={foliageShader:{uniforms:{map:{toJSON(){serializations++;return {};}}}}};
 base.userData=userData;
 base.clone=function(){const copy=material();copy.userData=JSON.parse(JSON.stringify(this.userData));return copy;};
 next.terrain.children[0].material=base;
 assert.equal(beginTerrainFade(r,old,next),true);
 assert.equal(serializations,0);
 assert.equal(next.terrain.children[0].material.userData,userData);
 assert.equal(base.userData,userData);
});


test('successive fades reuse materials and live shader uniforms without changing source userData',()=>{
 const r=renderer(),base=material(),data={shader:{toJSON(){throw Error('must not serialize shader');}}};base.userData=data;
 const make=()=>({terrain:{parent:{},children:[{material:base}]},water:{children:[]}});
 const old=make(),next=make();beginTerrainFade(r,old,next);
 const incoming=next.terrain.children[0].material,shader={uniforms:{},fragmentShader:'#include <common>\nvoid main() {\n}'};
 incoming.onBeforeCompile(shader);finishTerrainFade(r,next._terrainFade);
 r._terrainFadeClock.value=20;const newer=make();beginTerrainFade(r,next,newer);
 const reused=[next,newer].find(c=>c.terrain.children[0].material===incoming);
 assert.ok(reused,'a retained material is used again');
 assert.equal(shader.uniforms.terrainFadeStart.value,20);
 assert.equal(shader.uniforms.terrainFadeIncoming.value,reused===newer?1:0);
 assert.equal(base.userData,data);assert.equal(incoming.userData,data);
 clearTerrainFadeMaterials(r);assert.equal(r._terrainFades.size,0);assert.equal(incoming.disposed,true);
});
test('overlapping fades own distinct uniforms and idle storage stays bounded',()=>{
 const r=renderer(),base=material();
 const make=()=>({terrain:{parent:{},children:[{material:base}]},water:{children:[]}});
 const a=make(),b=make(),c=make(),d=make();beginTerrainFade(r,a,b);
 r._terrainFadeClock.value=11;beginTerrainFade(r,c,d);
 const shader=chunk=>{const s={uniforms:{},fragmentShader:'void main() {'};chunk.terrain.children[0].material.onBeforeCompile(s);return s;};
 const first=shader(b),second=shader(d);assert.notEqual(first.uniforms.terrainFadeStart,second.uniforms.terrainFadeStart);
 assert.equal(first.uniforms.terrainFadeStart.value,10);assert.equal(second.uniforms.terrainFadeStart.value,11);
 for(let i=0;i<80;i++)beginTerrainFade(r,make(),make());
 for(const fade of [...r._terrainFades])finishTerrainFade(r,fade);
 assert.equal(r._terrainFadeMaterialPool.idle.size,128);clearTerrainFadeMaterials(r);
});

test('reused fade materials invalidate their program after source material changes',()=>{
 const r=renderer(),base=material();base.version=0;
 const make=()=>({terrain:{parent:{},children:[{material:base}]},water:{children:[]}});
 const next=make();beginTerrainFade(r,make(),next);const first=[...next._terrainFade.materials];finishTerrainFade(r,next._terrainFade);
 base.version++;base.defaultAttributeValues={grassShelter:[1,2,3,4]};base.customProgramCacheKey=()=> 'changed-lighting';
 const newer=make();beginTerrainFade(r,next,newer);
 for(const m of newer._terrainFade.materials){assert.ok(first.includes(m));assert.equal(m.needsUpdate,true);assert.equal(m.defaultAttributeValues,base.defaultAttributeValues);assert.match(m.customProgramCacheKey(),/changed-lighting/);}
 clearTerrainFadeMaterials(r);
});
