import test from 'node:test';
import assert from 'node:assert/strict';
import { CityCitizenBatches } from '../js/city_citizen_batches.js';

class InstancedMesh {
  constructor(geometry,material,capacity){Object.assign(this,{geometry,material,capacity,matrices:[],instanceMatrix:{setUsage(value){this.usage=value;}}});}
  getMatrixAt(i,matrix){matrix.value=this.matrices[i];}
  setMatrixAt(i,matrix){this.matrices[i]=matrix.value;}
  dispose(){this.disposed=true;}
}
function fixture(){
  const group={children:new Set(),add(mesh){this.children.add(mesh);},remove(mesh){this.children.delete(mesh);}},geometry={};
  return {group,geometry,batches:new CityCitizenBatches({InstancedMesh,DynamicDrawUsage:35048},group,geometry)};
}
function sprite(material,id){return {material,visible:true,matrix:{value:id},updateMatrix(){this.matrix.value=id;},castShadow:true,receiveShadow:true,renderOrder:10,customDepthMaterial:{},userData:{entityId:id}};}

test('512 citizen billboards use one batch per appearance while preserving all transforms and picking identities',()=>{
  const {batches,group,geometry}=fixture(),materials=Array.from({length:5},()=>({})),sprites=Array.from({length:512},(_,i)=>sprite(materials[i%5],i));
  batches.begin();for(const s of sprites)batches.add(s);batches.end();assert.equal(group.children.size,5);
  const ids=[...group.children].flatMap(mesh=>mesh.matrices.slice(0,mesh.count)).sort((a,b)=>a-b);assert.deepEqual(ids,Array.from({length:512},(_,i)=>i));
  for(const mesh of group.children){assert.equal(mesh.geometry,geometry);assert.equal(mesh.instanceMatrix.usage,35048);assert(mesh.instanceMatrix.needsUpdate);assert(mesh.castShadow);assert.equal(mesh.renderOrder,10);assert.equal(mesh.frustumCulled,false);}
  assert(sprites.every((s,i)=>!s.visible&&s.userData.entityId===i));
});

test('batch updates remove departed appearances, skip hidden players and release instance buffers',()=>{
  const {batches,group}=fixture(),a={},b={},first=sprite(a,1),hidden=sprite(b,2);hidden.visible=false;
  batches.begin();batches.add(first);batches.add(hidden);batches.end();assert.equal(group.children.size,1);const previous=[...group.children][0];
  batches.begin();batches.add(sprite(b,3));batches.end();assert(previous.disposed);assert.equal(group.children.size,1);assert.equal([...group.children][0].matrices[0],3);
  const last=[...group.children][0];batches.clear();assert(last.disposed);assert.equal(group.children.size,0);assert.equal(batches.batches.size,0);
});
