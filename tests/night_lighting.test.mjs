import test from 'node:test';
import assert from 'node:assert/strict';
import {NightLighting,hasOutdoorTorch} from '../js/night_lighting.js';
class Vector{constructor(...values){this.set(...values);}set(...values){this.values=values;return this;}}
class Matrix{constructor(){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];}}
class Texture{constructor(data,width,height){this.image={data,width,height};this.version=0;}set needsUpdate(value){if(value)this.version++;}dispose(){this.disposed=true;}}
const THREE={Vector2:Vector,Vector4:Vector,Matrix4:Matrix,DataTexture:Texture};
const source=()=>({visible:true,intensity:2,distance:10,decay:1.6,position:{x:10,y:3,z:20},color:{r:1,g:.5,b:.25}});
const camera=()=>({matrixWorld:new Matrix(),matrixWorldInverse:new Matrix(),updateMatrixWorld(){}});
const scene={traverseVisible(){}};
test('stationary lights/camera do not rebuild or upload the grid, and camera motion only uploads view positions',()=>{
 const n=new NightLighting(THREE),c=camera(),sources=[source()];n.update(sources,c,scene);
 const versions=[n.data.version,n.cells.version,n.indices.version];n.update(sources,c,scene);
 assert.deepEqual([n.data.version,n.cells.version,n.indices.version],versions);
 c.matrixWorldInverse.elements[12]=-4;n.update(sources,c,scene);
 assert.equal(n.viewLights[0],6);assert.equal(n.grid.lights[0],10);
 assert.equal(n.data.version,versions[0]+1);assert.equal(n.cells.version,versions[1]);assert.equal(n.indices.version,versions[2]);
 sources[0].position.x=12;n.update(sources,c,scene);assert.equal(n.viewLights[0],8);assert.ok(n.cells.version>versions[1]);
 sources[0].visible=false;n.update(sources,c,scene);assert.equal(n.uniforms.nightLightCount.value,0);
 sources[0].visible=true;n.update(sources,c,scene);assert.equal(n.uniforms.nightLightCount.value,1);assert.equal(n.viewLights[0],8);
});
test('lighting preserves model shader hooks and shares live uniforms across material variants',()=>{
 const n=new NightLighting(THREE);let previousCalls=0;
 const material={isMeshLambertMaterial:true,onBeforeCompile(shader){previousCalls++;shader.uniforms.bodyMorph={value:2};shader.vertexShader+='\n// existing morph';},customProgramCacheKey(){return 'morph-print';}};
 n.decorate(material);const key=material.customProgramCacheKey(),hook=material.onBeforeCompile;n.decorate(material);assert.equal(material.onBeforeCompile,hook);
 for(let i=0;i<2;i++){
  const shader={uniforms:{},vertexShader:'void main() {}',fragmentShader:'#include <lights_fragment_begin>'};material.onBeforeCompile(shader,{});
  assert.equal(shader.uniforms.bodyMorph.value,2);assert.match(shader.vertexShader,/existing morph/);
  assert.equal(shader.uniforms.nightLightCount,n.uniforms.nightLightCount);
  assert.match(shader.fragmentShader,/#include <lights_fragment_begin>/);assert.match(shader.fragmentShader,/RE_Direct\(directLight/);
 }
 n.update([source()],camera(),scene);assert.equal(material.customProgramCacheKey(),key);assert.equal(previousCalls,2);
});

test('a cloned terrain variant retaining the decorated source hook injects lighting only once',()=>{
 const n=new NightLighting(THREE),base={isMeshLambertMaterial:true,onBeforeCompile(){},customProgramCacheKey(){return 'ground';}};
 n.decorate(base);
 const variant={isMeshLambertMaterial:true,onBeforeCompile(shader){base.onBeforeCompile(shader);shader.vertexShader+='// terrain blend';},customProgramCacheKey(){return base.customProgramCacheKey()+':blend';}};
 n.decorate(variant);
 const shader={uniforms:{},vertexShader:'',fragmentShader:'#include <lights_fragment_begin>'};variant.onBeforeCompile(shader,{});
 assert.equal(shader.fragmentShader.match(/uniform sampler2D nightLightData;/g).length,1);
 assert.equal(shader.fragmentShader.match(/RE_Direct\(directLight/g).length,1);
 assert.match(shader.vertexShader,/terrain blend/);
});


test('blocker rows include nearby buildings and update when a building changes',()=>{
 const n=new NightLighting(THREE),c=camera(),light=source();
 const nearby={min:[11,0,19],max:[14,6,22]},far={min:[100,0,100],max:[104,6,104]};
 n.update([light],c,scene,[nearby,far]);
 assert.equal(n.blockers.image.data[3],1);
 assert.deepEqual([...n.blockers.image.data.slice(0,3)],nearby.min);
 assert.deepEqual([...n.blockers.image.data.slice(4,7)],nearby.max);
 const version=n.blockers.version;n.update([light],c,scene,[nearby,far]);
 assert.equal(n.blockers.version,version);
 nearby.max[1]=9;n.update([light],c,scene,[nearby,far]);
 assert.equal(n.blockers.image.data[5],9);
 n.update([light],c,scene,[]);assert.equal(n.blockers.image.data[3],0);
});

test('reused blocker revisions skip serialization while daylight skips the scene scan',()=>{
 const n=new NightLighting(THREE),c=camera(),light=source(),scan={calls:0,traverseVisible(){this.calls++;}};
 const boxes=[{min:[8,0,18],max:[12,6,22]}];boxes.revision='terrain:1';
 n.update([light],c,scan,boxes);
 const scans=scan.calls;assert.equal(n.uniforms.nightLightCount.value,1);
 const original=JSON.stringify;let serialized=0;JSON.stringify=(...args)=>{serialized++;return original(...args);};
 try{for(let i=0;i<5;i++)n.update([light],c,scan,boxes);}finally{JSON.stringify=original;}
 assert.equal(serialized,0);
 assert.equal(scan.calls,scans+5);
 light.visible=false;n.update([light],c,scan,boxes);
 assert.equal(n.uniforms.nightLightCount.value,0);
 assert.equal(scan.calls,scans+5);
 light.visible=true;n.update([light],c,scan,boxes);
 assert.equal(scan.calls,scans+6);
});

test('blocker revision changes still rebuild nearby rows',()=>{
 const n=new NightLighting(THREE),c=camera(),light=source();
 const boxes=[{min:[8,0,18],max:[12,6,22]}];boxes.revision='terrain:1';
 n.update([light],c,scene,boxes);
 assert.equal(n.blockers.image.data[3],1);
 boxes[0]={min:[100,0,100],max:[104,6,104]};boxes.revision='terrain:2';
 n.update([light],c,scene,boxes);
 assert.equal(n.blockers.image.data[3],0);
});

test('carried torches emit outdoors only, including fueled torches taken indoors',()=>{
 const entity={properties:{citizen:{},heldItem:{resourceType:'torch',fuel:48}}};
 assert.equal(hasOutdoorTorch(entity),true);
 entity.properties.citizen.indoorLocation={buildingId:1,floor:0};
 assert.equal(hasOutdoorTorch(entity),false);
 assert.equal(entity.properties.heldItem.fuel,48);
 delete entity.properties.citizen.indoorLocation;
 assert.equal(hasOutdoorTorch(entity),true);
 entity.properties.heldItem.fuel=0;
 assert.equal(hasOutdoorTorch(entity),false);
});
