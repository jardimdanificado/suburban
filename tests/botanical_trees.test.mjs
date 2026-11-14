import test from 'node:test';
import assert from 'node:assert/strict';
import {PLANT_SPECIES} from '../js/city_nature.js';
import {BOTANICAL_TREE_MODELS,botanicalTreeSurface,addBotanicalTreeWind,BotanicalTreeInstances} from '../js/botanical_trees.js';

const excluded=new Set(['coconut_palm','traveller_palm']);
test('every existing tree and broad-leaf model has a species model; revised reference models stay excluded',()=>{
  for(const [id,spec] of Object.entries(PLANT_SPECIES)){
    if((spec.wood>0||spec.tree||id==='berry')&&!excluded.has(id))assert.ok(BOTANICAL_TREE_MODELS[id],id);
  }
  for(const id of [...excluded,'water_lily','waterlily'])assert.equal(botanicalTreeSurface(id),null);
});
test('all species produce finite, aligned, deterministic geometry within the per-model budget',()=>{
  const signatures=new Set();
  for(const id of Object.keys(BOTANICAL_TREE_MODELS)){
    const a=botanicalTreeSurface(id),b=botanicalTreeSurface(id),vertices=a.positions.length/3;
    assert.ok(vertices>100,id);assert.ok(vertices/3<=4500,`${id}: ${vertices/3} triangles`);
    assert.equal(a.colors.length,vertices*3,id);assert.equal(a.uvs.length,vertices*2,id);
    assert.equal(a.flex.length,vertices,id);assert.equal(a.parts.length,vertices,id);assert.equal(a.woodMask.length,vertices,id);
    for(const array of Object.values(a))assert.ok(array.every(Number.isFinite),id);
    assert.ok(a.uvs.every(v=>v>=0&&v<=1),id);
    assert.ok(a.flex.every(v=>v>=0&&v<=1),id);
    assert.deepEqual(a,b,id);
    signatures.add(JSON.stringify(a.positions));
  }
  assert.equal(signatures.size,Object.keys(BOTANICAL_TREE_MODELS).length);
});
test('cacao, jackfruit and jabuticaba bear fruit against the trunk instead of the generic crown offsets',()=>{
  for(const id of ['cacao','jackfruit','jabuticaba']){
    const surface=botanicalTreeSurface(id),fruit=surface.parts.flatMap((part,i)=>part===1?[surface.positions.slice(i*3,i*3+3)]:[]);
    assert.ok(fruit.length>0,id);
    assert.ok(fruit.every(([x,,z])=>Math.hypot(x,z)<.48),id);
    assert.ok(fruit.every(([,y])=>y<BOTANICAL_TREE_MODELS[id].height*.8),id);
  }
});
test('mangrove stilt roots extend outward to the ground and fan palm remains short',()=>{
  const roots=botanicalTreeSurface('mangrove').positions;
  assert.ok(roots.some((x,i)=>i%3===0&&Math.hypot(x,roots[i+2])>.7&&roots[i+1]<.08));
  const palm=botanicalTreeSurface('licuala_palm').positions;
  assert.ok(Math.max(...palm.filter((_,i)=>i%3===1))<2);
});
test('tree wind preserves prior shader hooks, uses the existing stepped clock and hides immature fruit and blooms',()=>{
  const material={userData:{},customProgramCacheKey:()=> 'lighting',onBeforeCompile(shader){shader.kept=true;}};
  addBotanicalTreeWind(material);
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>'};material.onBeforeCompile(shader);
  assert.equal(shader.kept,true);assert.equal(material.userData.foliageShader,shader);
  assert.equal(shader.uniforms.uSimTick.value,0);assert.match(shader.vertexShader,/floor\(\(uSimTick/);
  assert.match(shader.vertexShader,/treePart>0.5&&instanceGrowth<0.8/);
  assert.match(material.customProgramCacheKey(),/lighting:botanical-tree/);
});


// Exercise batching independently of WebGL; the browser fixture compiles both
// real materials and verifies the renderer's entity classification routes.
class Attribute{
  constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.ranges=[];}
  setX(i,value){this.array[i]=value;}
  clearUpdateRanges(){this.ranges=[];}
  addUpdateRange(start,count){this.ranges.push({start,count});}
}
class Geometry{
  constructor(){this.attributes={};}
  setAttribute(name,attribute){this.attributes[name]=attribute;return this;}
  computeVertexNormals(){}
  computeBoundingSphere(){}
  dispose(){this.disposed=true;}
}
class Mesh{
  constructor(geometry,material,capacity){Object.assign(this,{geometry,material,count:capacity});this.instanceMatrix=new Attribute(new Float32Array(capacity*16),16);this.matrices=[];}
  setMatrixAt(index,matrix){this.matrices[index]=matrix;}
  dispose(){this.disposed=true;}
}
const THREE={BufferGeometry:Geometry,Float32BufferAttribute:Attribute,InstancedBufferAttribute:Attribute,InstancedMesh:Mesh,MeshDepthMaterial:class{constructor(values){Object.assign(this,values);}},DoubleSide:2,RGBADepthPacking:3201};
test('batches reuse geometry, preserve growth, reset removed instances, rebind materials and dispose owned resources',()=>{
  const group={children:new Set(),add(mesh){this.children.add(mesh);},remove(mesh){this.children.delete(mesh);}},first={},next={};
  const models=new BotanicalTreeInstances(THREE,group,first,2),matrix={};models.begin();
  assert.equal(models.add('coconut_palm',matrix),false);assert.equal(models.batches.size,0);
  assert.equal(models.add('tree',matrix,.3),true);models.add('oak',matrix,1);models.add('oak',matrix,1);models.end();
  const batch=models.batches.get('oak'),geometry=batch.mesh.geometry;
  assert.equal(batch.mesh.count,2);assert.equal(group.children.size,1);
  assert.ok(Math.abs(batch.age.array[0]-.3)<1e-6);assert.equal(batch.age.array[1],1);
  assert.deepEqual(batch.mesh.instanceMatrix.ranges,[{start:0,count:32}]);
  assert.equal(batch.mesh.customDepthMaterial,models.shadowMaterial);
  const shader={vertexShader:'#include <begin_vertex>'};models.shadowMaterial.onBeforeCompile(shader);
  assert.match(shader.vertexShader,/if\(treeWood<0.5\)/);
  models.begin();models.add('oak',matrix,.65);models.end();
  assert.equal(batch.mesh.geometry,geometry);assert.equal(batch.mesh.count,1);
  models.setMaterial(next);assert.equal(batch.mesh.material,next);
  models.begin();models.end();assert.equal(batch.mesh.count,0);
  models.clear();assert.equal(models.batches.size,0);assert.equal(group.children.size,0);
  assert.equal(geometry.disposed,true);assert.equal(batch.mesh.disposed,true);
});
