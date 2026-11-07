import test from 'node:test';
import assert from 'node:assert/strict';
import {syncLampBatches} from '../js/city_lamp_batches.js';
class Color{constructor(value){this.value=value;}getHex(){return this.value;}}
class Material{constructor(value=0){this.emissive=new Color(value);}clone(){return new Material(this.emissive.value);}}
class Geometry{clone(){return new Geometry();}}
class InstancedMesh{
 constructor(geometry,material,count){this.geometry=geometry;this.material=material;this.instanceMatrix={count,setUsage(){},needsUpdate:false};this.matrices=[];this.count=count;this.visible=true;}
 setMatrixAt(i,matrix){this.matrices[i]={...matrix};this.writes=(this.writes||0)+1;}
 dispose(){this.disposed=true;}
}
const THREE={InstancedMesh,DynamicDrawUsage:35048};
function fixture(count){
 const objects=new Set(),renderer={lampMeshes:new Map(),scene:{add:o=>objects.add(o),remove:o=>objects.delete(o)}};
 let modelId=0;const add=id=>{const lamp={id:modelId++,visible:true,position:{x:id,y:0,z:0},userData:{styleVersion:3}};const head={parent:lamp};
  const parts=[lamp,head,head].map((parent,i)=>({isMesh:true,parent,visible:true,geometry:new Geometry(),material:new Material(i===2?0xffa52f:0),castShadow:false,receiveShadow:false,matrixWorld:{x:0,y:i,z:0}}));
  lamp.userData.lantern=parts[2];lamp.traverse=fn=>parts.forEach(fn);lamp.updateMatrixWorld=()=>parts.forEach(p=>{p.matrixWorld.x=lamp.position.x;p.matrixWorld.z=lamp.position.z;});renderer.lampMeshes.set('lamp-'+id,lamp);return lamp;};
 for(let i=0;i<count;i++)add(i);return{renderer,objects,add};
}

test('lamp batches retain models, emissions and visibility while stationary frames skip matrix uploads',()=>{
 const {renderer}=fixture(64);syncLampBatches(renderer,THREE);
 const active=()=>[...renderer.lampBatches.values()].filter(m=>m.visible);
 assert.equal(active().length,9);assert.equal(active().reduce((s,m)=>s+m.count,0),192);
 for(const lamp of renderer.lampMeshes.values()){assert(lamp.visible);assert(lamp.userData.batchParts.every(p=>!p.visible));}
 const writes=[...renderer.lampBatches.values()].reduce((s,m)=>s+m.writes,0);syncLampBatches(renderer,THREE);
 assert.equal([...renderer.lampBatches.values()].reduce((s,m)=>s+m.writes,0),writes);
 const lamp=renderer.lampMeshes.values().next().value;lamp.position.x=400;lamp.userData.lantern.material.emissive.value=0;syncLampBatches(renderer,THREE);
 assert(active().some(m=>m.matrices.slice(0,m.count).some(p=>p.x===400)));assert.equal(active().filter(m=>m.material.emissive.getHex()===0xffa52f).reduce((s,m)=>s+m.count,0),63);
 renderer.lampBatchReference=true;syncLampBatches(renderer,THREE);assert.equal(active().length,0);assert(lamp.userData.batchParts.every(p=>p.visible));
 renderer.lampBatchReference=false;lamp.visible=false;syncLampBatches(renderer,THREE);assert.equal(active().reduce((s,m)=>s+m.count,0),63*3);
});

test('lamp batches grow safely and remove stale instances after demolition or model recreation',()=>{
 const {renderer,objects,add}=fixture(3);syncLampBatches(renderer,THREE);const old=[...renderer.lampBatches.values()];
 for(let i=3;i<200;i++)add(i);syncLampBatches(renderer,THREE);assert(old.some(m=>m.disposed));assert(old.filter(m=>m.disposed).every(m=>!objects.has(m)));
 renderer.lampMeshes.clear();syncLampBatches(renderer,THREE);assert([...renderer.lampBatches.values()].every(m=>!m.visible&&m.count===0));
 const recreated=add(1);syncLampBatches(renderer,THREE);assert(recreated.userData.batchParts.every(p=>!p.visible));assert.equal([...renderer.lampBatches.values()].reduce((s,m)=>s+m.count,0),3);
 const replacement=add(1);syncLampBatches(renderer,THREE);assert(replacement.userData.batchParts.every(p=>!p.visible));assert.equal([...renderer.lampBatches.values()].reduce((s,m)=>s+m.count,0),3);
});
