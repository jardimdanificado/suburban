import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CITIZEN_MODEL_FRAMES,parseCitizenOBJ,citizenAnimation,citizenFrame,CityCitizenModels} from '../js/city_citizen_models.js';
class Vector3{constructor(x=0,y=0,z=0){this.set(x,y,z);}set(x,y,z){Object.assign(this,{x,y,z});return this;}}
class Matrix4{compose(p,q,s){this.data={position:{...p},angle:q.angle,scale:{...s}};return this;}}
class Quaternion{setFromAxisAngle(axis,angle){this.angle=angle;return this;}}
class Color{setHex(value){this.value=value;return this;}}
class BufferGeometry{constructor(){this.attributes={};}setAttribute(k,v){this.attributes[k]=v;}computeBoundingSphere(){}}
class Float32BufferAttribute{constructor(array,itemSize){Object.assign(this,{array,itemSize});}}
class InstancedMesh{constructor(geometry,material,capacity){Object.assign(this,{geometry,material,capacity,matrices:[],colors:[],instanceMatrix:{setUsage(){}}});}setMatrixAt(i,m){this.matrices[i]=structuredClone(m.data);}getMatrixAt(i,m){m.data=structuredClone(this.matrices[i]);}setColorAt(i,c){this.colors[i]=c.value;this.instanceColor??={};}getColorAt(i,c){c.value=this.colors[i];}dispose(){this.disposed=true;}}
const THREE={Vector3,Matrix4,Quaternion,Color,BufferGeometry,Float32BufferAttribute,InstancedMesh,DoubleSide:2,DynamicDrawUsage:1,MeshLambertMaterial:class{constructor(options){this.options=options;}}};
function person(id,x=0,y=0){return {id,x,y,properties:{render:{color:0xc42b24},citizen:{task:null,path:[]}}};}
async function models(){const requests=[],group={meshes:new Set(),add(m){this.meshes.add(m);},remove(m){this.meshes.delete(m);}},model=new CityCitizenModels(THREE,group,{fetchAsset:async url=>{requests.push(String(url));return {ok:true,text:()=>fs.readFile(url,'utf8')};}});await model.loading;return{model,requests,group};}
test('all nine supplied OBJ frames parse as finite triangular meshes with shared world scale',async()=>{
 const {model,requests}=await models();assert(model.ready);assert.equal(requests.length,9);assert.equal(model.frames.size,9);
 for(const [clip,frames]of Object.entries(CITIZEN_MODEL_FRAMES))for(const frame of frames){const geometry=model.frames.get(`${clip}:${frame}`),p=geometry.attributes.position.array,n=geometry.attributes.normal.array;assert(p.length>0);assert(p.every(Number.isFinite));assert(n.every(Number.isFinite));assert.equal(p.length,n.length);assert(Math.max(...p.filter((_,i)=>i%3===1))<1.1);assert(Math.min(...p.filter((_,i)=>i%3===1))>=-.001);}
});
test('OBJ parser triangulates quads, resolves negative indices and rejects invalid meshes',()=>{
 const data=parseCitizenOBJ('v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf -4 -3 -2 -1');assert.equal(data.triangles,2);assert.equal(data.positions.length,18);assert(data.normals.every(Number.isFinite));
 assert.throws(()=>parseCitizenOBJ('v NaN 0 0\nf 1 1 1'));
 assert.throws(()=>parseCitizenOBJ('v 0 0 0\nf 0 1 1'));
 assert.throws(()=>parseCitizenOBJ('v 0 0 0\nf 2 1 1'));
 assert.throws(()=>parseCitizenOBJ('v 0 0 0'));
});
test('animation distinguishes actual movement, on-site work, idle and bicycle poses',()=>{
 assert.equal(citizenAnimation({task:null,path:[]}), 'idle');assert.equal(citizenAnimation({task:'work',path:[]}), 'use');assert.equal(citizenAnimation({task:'work',path:[{}]},true),'run');
 assert.equal(citizenAnimation({task:'work',path:[{}]},false),'idle');assert.equal(citizenAnimation({ridingVehicleId:1},true),'ride');assert.deepEqual(citizenFrame('ride',.3),{clip:'use',frame:1});
 assert.notEqual(citizenFrame('run',0).frame,citizenFrame('run',.15).frame);assert.equal(citizenFrame('use',.5).frame,2);assert.equal(citizenFrame('use',.75).frame,1);
});
test('1024 people share at most nine frame batches and preserve political colors through growth',async()=>{
 const {model,group,requests}=await models();model.begin(.016,1);
 const people=Array.from({length:1024},(_,id)=>person(id));
 for(let i=0;i<people.length;i++){const e=people[i];e.properties.render.color=i;assert(model.add(e,3));}model.end();assert.equal(group.meshes.size,1);const b=[...model.batches.values()][0];assert.equal(b.mesh.count,1024);assert.equal(b.mesh.colors[0],0);assert.equal(b.mesh.colors[900],900);assert.equal(b.mesh.matrices[0].position.y,3);assert.equal(requests.length,9);
 model.begin(.05,1);for(let i=0;i<people.length;i++){const e=people[i];if(i%3===0)e.x+=1;else if(i%3===1)e.properties.citizen.task='work';model.add(e,3);}model.end();assert.equal([...model.batches.values()].reduce((n,b)=>n+b.count,0),1024);assert(group.meshes.size<=9);assert(group.meshes.size>=7);
 model.begin(.016,1);model.end();assert.equal(b.mesh.count,0);
});
test('heading follows movement, indoor bodies are shown, first-person bodies stay hidden, pause freezes animation',async()=>{
 const {model}=await models(),e=person(1);model.begin(.1,1);model.add(e,2);e.x=1;model.begin(.1,1);model.add(e,2);model.end();const run=[...model.batches.entries()].find(([key,b])=>key.startsWith('run')&&b.count);assert(run);assert.equal(run[1].mesh.matrices[0].angle,Math.PI/2);
 const clock=model.clock;model.begin(1,0);assert.equal(model.clock,clock);model.add(e,2);model.end();assert.equal([...model.batches.values()].reduce((n,b)=>n+b.count,0),1);
 model.begin(.1,1);model.add(e,2,{hidden:true});model.end();assert.equal([...model.batches.values()].reduce((n,b)=>n+b.count,0),0);
 e.properties.citizen.indoorLocation={buildingId:1,position:{x:4,y:5,z:1.8}};model.begin(.1,1);model.add(e,2);model.end();assert.equal([...model.batches.values()].reduce((n,b)=>n+b.count,0),1);
});
test('clearing a city keeps loaded geometry and resets character motion without fetching again',async()=>{
 const {model,group,requests}=await models();model.add(person(2),0);model.end();model.clear();assert.equal(group.meshes.size,0);assert(model.ready);assert.equal(model.frames.size,9);model.add(person(3),0);model.end();assert.equal(requests.length,9);assert.equal(group.meshes.size,1);
});
test('a failed asset leaves the renderer able to use its existing sprite fallback',async()=>{
 const model=new CityCitizenModels(THREE,{add(){},remove(){}},{fetchAsset:async()=>({ok:false,status:404})});await model.loading;assert(!model.ready);assert.match(model.error,/404/);assert.equal(model.add(person(1),0),false);
});

test('walking frames advance only with distance, never with elapsed time while blocked',async()=>{
 const {model}=await models(),e=person(71);e.properties.citizen.path=[{x:10,y:0}];model.begin(.01,1);model.add(e,0);e.x=1;model.begin(.01,1);model.add(e,0);model.end();
 const pose=()=>[...model.batches].find(([key,b])=>key.startsWith('run')&&b.count)?.[0],first=pose();assert(first);
 for(let i=0;i<30;i++){model.begin(.1,2);model.add(e,0);model.end();assert.equal(pose(),first);}
 e.x+=.4;model.begin(.01,1);model.add(e,0);model.end();assert.notEqual(pose(),first);
});

test('bicycle riders hold use frame 1 while moving, stopped and paused',async()=>{
 const {model}=await models(),e=person(11);e.properties.citizen.ridingVehicleId=1;e.properties.citizen.ridingVehicleKind='bicicleta';
 const pose=()=>[...model.batches].find(([,b])=>b.count)?.[0];
 model.begin(0,1);model.add(e,0);model.end();assert.equal(pose(),'use:1');
 e.x+=.7;model.begin(.1,1);model.add(e,0);model.end();assert.equal(pose(),'use:1');
 for(let i=0;i<20;i++){model.begin(.1,1);model.add(e,0);model.end();assert.equal(pose(),'use:1');}
 e.x+=.7;model.begin(.1,1);model.add(e,0);model.end();assert.equal(pose(),'use:1');
 e.properties.citizen.ridingVehicleKind='patinete';assert.equal(citizenAnimation(e.properties.citizen,true),'glide');
});
