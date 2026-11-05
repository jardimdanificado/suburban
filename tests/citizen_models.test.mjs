import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CITIZEN_MODEL_FRAMES,parseCitizenOBJ,headwearSurface,citizenAnimation,citizenFrame,citizenIsSleeping,CityCitizenModels} from '../js/city_citizen_models.js';
class Vector3{constructor(x=0,y=0,z=0){this.set(x,y,z);}set(x,y,z){Object.assign(this,{x,y,z});return this;}}
class Matrix4{constructor(){this.elements=new Float32Array(16);}compose(p,q,s){this.data={position:{...p},angle:q.angle,lying:!!q.lying,scale:{...s}};this.elements.fill(0);this.elements[0]=s.x;this.elements[5]=s.y;this.elements[10]=s.z;this.elements[12]=p.x;this.elements[13]=p.y;this.elements[14]=p.z;this.elements[15]=1;return this;}}
class Quaternion{setFromAxisAngle(axis,angle){this.angle=angle;this.lying=false;return this;}multiply(){this.lying=true;return this;}}
class Color{setHex(value){this.value=value;this.r=((value>>16)&255)/255;this.g=((value>>8)&255)/255;this.b=(value&255)/255;return this;}}
class BufferGeometry{constructor(){this.attributes={};}setAttribute(k,v){this.attributes[k]=v;}computeBoundingSphere(){}}
class Float32BufferAttribute{constructor(array,itemSize){Object.assign(this,{array,itemSize});}}
class InstancedMesh{constructor(geometry,material,capacity){Object.assign(this,{geometry,material,capacity,matrices:[],colors:[],userData:{},instanceMatrix:{array:new Float32Array(capacity*16),setUsage(){}},instanceColor:null});}setMatrixAt(i,m){this.matrices[i]=structuredClone(m.data);this.instanceMatrix.array.set(m.elements,i*16);}getMatrixAt(i,m){m.data=structuredClone(this.matrices[i]);m.elements.set(this.instanceMatrix.array.subarray(i*16,(i+1)*16));}setColorAt(i,c){this.colors[i]=c.value;this.instanceColor??={array:new Float32Array(this.capacity*3)};this.instanceColor.array.set([c.r,c.g,c.b],i*3);}getColorAt(i,c){c.setHex(this.colors[i]);}dispose(){this.disposed=true;}}
const THREE={Vector3,Matrix4,Quaternion,Color,BufferGeometry,Float32BufferAttribute,InstancedMesh,DoubleSide:2,DynamicDrawUsage:1,MeshLambertMaterial:class{constructor(options){this.options=options;}}};
function person(id,x=0,y=0){return {id,x,y,properties:{render:{color:0xc42b24},citizen:{task:null,path:[]}}};}
async function models(){const requests=[],group={meshes:new Set(),add(m){this.meshes.add(m);},remove(m){this.meshes.delete(m);}},model=new CityCitizenModels(THREE,group,{fetchAsset:async url=>{requests.push(String(url));return {ok:true,text:()=>fs.readFile(url,'utf8')};}});await model.loading;return{model,requests,group};}
const frameCount=Object.values(CITIZEN_MODEL_FRAMES).reduce((sum,frames)=>sum+frames.length,0);
test('all supplied OBJ frames parse as finite triangular meshes with shared world scale',async()=>{
 const {model,requests}=await models();assert(model.ready);assert.equal(requests.length,frameCount);assert.equal(model.frames.size,frameCount);
 for(const [clip,frames]of Object.entries(CITIZEN_MODEL_FRAMES))for(const frame of frames){const geometry=model.frames.get(`${clip}:${frame}`),p=geometry.attributes.position.array,n=geometry.attributes.normal.array;assert(p.length>0);assert(p.every(Number.isFinite));assert(n.every(Number.isFinite));assert.equal(p.length,n.length);assert(Math.max(...p.filter((_,i)=>i%3===1))<1.1);assert(Math.min(...p.filter((_,i)=>i%3===1))>=-.001);}
});
test('OBJ parser triangulates quads, resolves negative indices and rejects invalid meshes',()=>{
 const data=parseCitizenOBJ('v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf -4 -3 -2 -1');assert.equal(data.triangles,2);assert.equal(data.positions.length,18);assert(data.normals.every(Number.isFinite));
 assert.throws(()=>parseCitizenOBJ('v NaN 0 0\nf 1 1 1'));
 assert.throws(()=>parseCitizenOBJ('v 0 0 0\nf 0 1 1'));
 assert.throws(()=>parseCitizenOBJ('v 0 0 0\nf 2 1 1'));
 assert.throws(()=>parseCitizenOBJ('v 0 0 0'));
});
test('OBJ padding is removed without changing the order of real anatomical faces',()=>{
 const data=parseCitizenOBJ('v 0 0 0\nv 1 0 0\nv 0 1 0\nv 0 0 1\nf 1 2 3\nf 1 2 2\nf 1 3 4');
 assert.equal(data.triangles,2);
 assert.deepEqual([...data.positions],[0,0,0,1,0,0,0,1,0,0,0,0,0,1,0,0,0,1]);
 assert.throws(()=>parseCitizenOBJ('v 0 0 0\nv 1 0 0\nf 1 2 2'),/modelo sem faces/);
});
test('clothes stay on the chest, thighs, hands and feet in every supplied pose',async()=>{
 const {model}=await models();assert(model.ready);
 const containsFace=(geometry,face)=>{
  const data=geometry.attributes.position.array;
  for(let i=0;i<data.length;i+=9)if(face.every((n,j)=>data[i+j]===n))return true;
  return false;
 };
 // IDs refer to the anatomical source surface: 0 foot, 1 thigh, 9 torso,
 // 13 head, 54 shin, 82 hand. Export padding must not shift these IDs.
 const checks=[
  ['camisa',9,true],['camisa',13,false],['camisa',82,false],
  ['camiseta',9,true],['camiseta',13,false],
  ['vestido',13,false],['vestido',82,false],
  ['maiô',13,false],['maiô',82,false],
  ['calça',1,true],['calça',9,false],['calça',13,false],['calça',82,false],
  ['shorts',1,true],['shorts',54,false],['shorts',9,false],
  ['sapatos',0,true],['sapatos',82,false],
  ['luvas',82,true],['luvas',0,false],['luvas',13,false],
 ];
 for(const [key,geometry] of model.frames){
  const positions=geometry.attributes.position.array;assert.equal(positions.length/9,246,key);
  for(const [piece,id,covered] of checks){
   const face=positions.subarray(id*9,id*9+9),outfit=model.outfits.get(`${key}:${piece}`);
   assert.equal(containsFace(outfit.clothes,face),covered,`${key}: ${piece}, anatomical face ${id}`);
   assert.equal(containsFace(outfit.body,face),!covered,`${key}: exposed skin, ${piece}, anatomical face ${id}`);
  }
  for(const piece of ['calça','sapatos','botas','luvas']){
   assert.deepEqual(model.headwear.get(`${key}:${piece}`).attributes.position.array,model.outfits.get(`${key}:${piece}`).clothes.attributes.position.array,`${key}: fitted ${piece} faces must not separate at flat-normal seams`);
  }
 }
});
test('skirt instances retain their bound morph attributes and tops are tucked above the pelvis',async()=>{
 const {model}=await models();assert(model.ready);
 const containsFace=(geometry,face)=>{
  const data=geometry.attributes.position.array;
  for(let i=0;i<data.length;i+=9)if(face.every((n,j)=>data[i+j]===n))return true;
  return false;
 };
 for(const [key,geometry] of model.frames)for(const piece of ['saia','saia longa']){
  const skirt=model.outfits.get(`${key}:${piece}`).clothes;
  assert.equal(model.headwear.get(`${key}:${piece}`),skirt);
  for(const name of ['skirtMorph','skirtNormalLinear','skirtNormalQuadratic'])assert.equal(skirt.attributes[name].array.length,skirt.attributes.position.array.length,`${key}: fitted skirt shader data`);
  const top=model.outfits.get(`${key}:camiseta`),tucked=top[piece==='saia'?'clothesWithSaia':'clothesWithSaiaLonga'],p=geometry.attributes.position.array;
  assert(containsFace(tucked,p.subarray(9*9,10*9)),`${key}: torso must keep its top`);
  assert(!containsFace(tucked,p.subarray(48*9,49*9)),`${key}: top must not protrude through the skirt at the pelvis`);
 }
 const e=person(0),c=e.properties.citizen;
 c.wardrobe=[{piece:'camiseta',color:'#e6bd43'},{piece:'saia',color:'#3c9793'}];c.wearingIndex=0;c.lowerWearIndex=1;
 for(const piece of ['saia','saia longa']){
  c.wardrobe[1].piece=piece;model.begin(0,0);model.add(e,0);model.end();
  const top=model.outfits.get('idle:0:camiseta'),batch=model.batches.get(`idle:0:camiseta:shared+${piece}`);
  assert.equal(batch.clothingMesh.geometry,top[piece==='saia'?'clothesWithSaia':'clothesWithSaiaLonga']);
  assert.equal(model.headwearBatches.get(`idle:0:${piece}`).mesh.material,model.skirtMaterial);
 }
});
test('hat meshes share one normalized shape while each animated frame retains its own head anchor',async()=>{
 const pieces=['boné','cartola','chapéu','chapéu nordestino','chapéu de cangaceiro','chapéu de couro','chapéu de vaqueiro','chapéu de palha pequeno','chapéu de palha médio','chapéu de palha grande','cesta'];
 for(const piece of pieces){let reference=null;const anchors=[];for(let frame=0;frame<5;frame++){
  const text=await fs.readFile(new URL(`../data/model/run/${frame}.obj`,import.meta.url),'utf8'),surface=headwearSurface(parseCitizenOBJ(text),piece);anchors.push(surface.anchor);
  if(!reference)reference=surface;else{
   assert.equal(surface.positions.length,reference.positions.length,piece);assert.equal(surface.normals.length,reference.normals.length,piece);
   for(let i=0;i<surface.positions.length;i++)assert.ok(Math.abs(surface.positions[i]-reference.positions[i])<1e-6,`${piece} vertex ${i}`);
   for(let i=0;i<surface.normals.length;i++)assert.ok(Math.abs(surface.normals[i]-reference.normals[i])<1e-6,`${piece} normal ${i}`);
  }
 }
 assert(anchors.every(anchor=>Number.isFinite(anchor.x)&&Number.isFinite(anchor.y)&&Number.isFinite(anchor.z)),piece);
 }
});
test('animation distinguishes actual movement, on-site work, idle and bicycle poses',()=>{
 assert.equal(citizenAnimation({task:null,path:[]}), 'idle');assert.equal(citizenAnimation({task:'work',path:[],workCell:{x:0,y:0}}), 'use');assert.equal(citizenAnimation({task:'work',path:[{}]},true),'run');
 assert.equal(citizenAnimation({task:'work',path:[{}]},false),'idle');assert.equal(citizenAnimation({ridingVehicleId:1,ridingVehicleKind:'bicicleta',mobilityTrip:{stage:'riding'}},true),'seated');assert.deepEqual(citizenFrame('mount',.3),{clip:'use',frame:0});assert.deepEqual(citizenFrame('passenger',.3),{clip:'use',frame:0});
 assert.deepEqual([0,.125,.25].map(time=>citizenFrame('pedal',time).frame),[0,2,4]);
 assert.notEqual(citizenFrame('run',0).frame,citizenFrame('run',.15).frame);assert.equal(citizenFrame('use',.5).frame,0);assert.equal(citizenFrame('seated',.5).frame,2);assert.equal(citizenFrame('use',.75).frame,1);
});
test('1024 people share at most nine frame batches and preserve political colors through growth',async()=>{
 const {model,group,requests}=await models();model.begin(.016,1);
 const people=Array.from({length:1024},(_,id)=>person(id));
 for(let i=0;i<people.length;i++){const e=people[i];e.properties.render.color=i;assert(model.add(e,3));}model.end();assert.equal(group.meshes.size,1);const b=[...model.batches.values()][0];assert.equal(b.mesh.count,1024);assert.equal(b.mesh.colors[0],0);assert.equal(b.mesh.colors[900],900);assert.equal(b.mesh.matrices[0].position.y,3);assert.equal(requests.length,frameCount);
 model.begin(.05,1);for(let i=0;i<people.length;i++){const e=people[i];if(i%3===0)e.x+=1;else if(i%3===1){e.properties.citizen.task='work';e.properties.citizen.workCell={x:e.x,y:e.y};}model.add(e,3);}model.end();assert.equal([...model.batches.values()].reduce((n,b)=>n+b.count,0),1024);assert(group.meshes.size<=9);assert(group.meshes.size>=7);
 model.begin(.016,1);model.end();assert.equal(b.mesh.count,0);
});
test('heading follows movement, indoor bodies are shown, first-person bodies stay hidden, pause freezes animation',async()=>{
 const {model}=await models(),e=person(1);model.begin(.1,1);model.add(e,2);e.x=1;model.begin(.1,1);model.add(e,2);model.end();const run=[...model.batches.entries()].find(([key,b])=>key.startsWith('run')&&b.count);assert(run);assert.equal(run[1].mesh.matrices[0].angle,Math.PI/2);
 const clock=model.clock;model.begin(1,0);assert.equal(model.clock,clock);model.add(e,2);model.end();assert.equal([...model.batches.values()].reduce((n,b)=>n+b.count,0),1);
 model.begin(.1,1);model.add(e,2,{hidden:true});model.end();assert.equal([...model.batches.values()].reduce((n,b)=>n+b.count,0),0);
 e.properties.citizen.indoorLocation={buildingId:1,position:{x:4,y:5,z:1.8}};model.begin(.1,1);model.add(e,2);model.end();assert.equal([...model.batches.values()].reduce((n,b)=>n+b.count,0),1);
});
test('a walking interior resident keeps the physical position and walking pose instead of snapping to furniture',async()=>{
 const {model}=await models(),e=person(1),c=e.properties.citizen;
 c.task='food';c.path=[];c.indoorLocation={buildingId:1,position:{x:2,y:3,z:0},path:[{x:2,y:3.5,z:0}]};
 c.furnitureUse={pose:'lying',posePoint:{x:50,y:50,z:0}};
 model.begin(.05,1);model.add(e,0);model.end();
 const walking=[...model.batches.entries()].find(([key,b])=>key.startsWith('run')&&b.count);assert(walking,'the body uses the walking animation while crossing the door');
 assert.equal(walking[1].mesh.matrices[0].position.x,2);assert.equal(walking[1].mesh.matrices[0].position.z,3);
});
test('sleepers and patients on an exam bed use the lying pose at their physical furniture point',async()=>{
 const {model}=await models(),e=person(88);e.properties.citizen.task='health';e.properties.citizen.indoorLocation={buildingId:1,roomType:'treatment',position:{x:2,y:3,z:1.8},path:[]};e.properties.citizen.furnitureUse={pose:'lying',posePoint:{x:2.5,y:3.25,z:1.98}};
 model.begin(.1,1);model.add(e,4);model.end();let batch=[...model.batches.values()].find(b=>b.count);assert(batch);assert.equal(batch.mesh.matrices[0].lying,true);assert.equal(batch.mesh.matrices[0].position.x,2.5);assert.equal(batch.mesh.matrices[0].position.y,5.98);assert.equal(batch.mesh.matrices[0].position.z,3.25);
 e.properties.citizen.task='energy';e.properties.citizen.sleep={active:true};e.properties.citizen.indoorLocation.roomType='bedroom';model.begin(.1,1);model.add(e,4);model.end();batch=[...model.batches.values()].find(b=>b.count);assert.equal(batch.mesh.geometry,model.frames.get('dormindo:0'));assert.equal(batch.mesh.matrices[0].lying,false);
});
test('street sleepers use the horizontal sleep model at their assigned spot; travel and other tasks keep their own animation',async()=>{
 const {model}=await models(),e=person(91),c=e.properties.citizen;c.entity={x:0,y:0};c.task='energy';c.sleep={active:true};c.homelessSleepSpot={x:0,y:0};c.action='Dormindo no abrigo de rua · 45/480 min';assert.equal(citizenIsSleeping(c),true);assert.equal(citizenAnimation(c), 'dormindo');model.begin(.1,1);model.add(e,0);model.end();let sleeping=[...model.batches].find(([key,b])=>key==='dormindo:0'&&b.count);assert(sleeping);assert(Math.max(...sleeping[1].mesh.geometry.attributes.position.array.filter((_,i)=>i%3===1))<.4);
 c.path=[{x:2,y:0}];assert.equal(citizenIsSleeping(c),false);assert.equal(citizenAnimation(c,true),'run');c.path=[];c.task='food';c.sleep.active=false;c.workCell={x:0,y:0};assert.equal(citizenAnimation(c), 'use_alt');
});
test('clearing a city keeps loaded geometry and resets character motion without fetching again',async()=>{
 const {model,group,requests}=await models();model.add(person(2),0);model.end();model.clear();assert.equal(group.meshes.size,0);assert(model.ready);assert.equal(model.frames.size,frameCount);model.add(person(3),0);model.end();assert.equal(requests.length,frameCount);assert.equal(group.meshes.size,1);
});
test('a failed asset leaves the renderer able to use its existing sprite fallback',async()=>{
 const model=new CityCitizenModels(THREE,{add(){},remove(){}},{fetchAsset:async()=>({ok:false,status:404})});await model.loading;assert(!model.ready);assert.match(model.error,/404/);assert.equal(model.add(person(1),0),false);
});

test('walking frames advance each quarter tile and freeze while paused',async()=>{
 const {model}=await models(),e=person(71);e.properties.citizen.path=[{x:10,y:0}];model.begin(.01,1);model.add(e,0);e.x=1;model.begin(.01,1);model.add(e,0);model.end();
 const pose=()=>[...model.batches].find(([key,b])=>key.startsWith('run')&&b.count)?.[0],first=pose();assert(first);
 for(let i=0;i<30;i++){model.begin(.1,2);model.add(e,0);model.end();}
 assert.equal(pose(),first);e.x=1.24;model.begin(.1,1);model.add(e,0);model.end();assert.equal(pose(),first);e.x=1.25;model.begin(.1,1);model.add(e,0);model.end();assert.notEqual(pose(),first);e.x=2;model.begin(.1,1);model.add(e,0);model.end();const moving=pose();assert.notEqual(moving,first);model.begin(.1,0);model.add(e,0);model.end();assert.equal(pose(),moving);
});
test('stationary citizens never cycle through run frames just because their path is still set',async()=>{
 const {model}=await models(),e=person(71);e.properties.citizen.path=[{x:10,y:0}];
 model.begin(.01,1);model.add(e,0);model.end();e.x=1;
 model.begin(.01,1);model.add(e,0);model.end();assert([...model.batches].some(([key,b])=>key.startsWith('run:')&&b.count));
 const pose=()=>[...model.batches].find(([key,b])=>b.count)?.[0];
 const held=pose();model.begin(.1,1);model.add(e,0);model.end();assert.equal(pose(),held);
 for(let i=0;i<20;i++){model.begin(.1,2);model.add(e,0);model.end();assert.equal(pose(),held);}
});

test('bicycle riders stay seated when stationary and a waiting boarding rider stays idle',async()=>{
 const {model}=await models(),e=person(0);e.properties.citizen.ridingVehicleId=1;e.properties.citizen.ridingVehicleKind='bicicleta';
 const pose=()=>[...model.batches].find(([,b])=>b.count)?.[0];
 e.properties.citizen.mobilityTrip={stage:'riding'};
 model.begin(0,1);model.add(e,0);model.end();assert.equal(pose(),'use:2');
 model.begin(.1,1);model.add(e,0);model.end();assert.equal(pose(),'use:2');
 e.x=.25;model.begin(.1,1);model.add(e,0);model.end();assert.equal(pose(),'use:2');
 e.x=.5;model.begin(.1,1);model.add(e,0);model.end();assert.equal(pose(),'use:2');
 e.properties.citizen.mobilityTrip.stage='boarding';model.begin(.1,1);model.add(e,0);model.end();assert.equal(pose(),'idle:0');
 e.properties.citizen.mobilityTrip=null;model.begin(.1,1);model.add(e,0);model.end();assert.equal(pose(),'use:2');
 e.properties.citizen.ridingVehicleKind='patinete';assert.equal(citizenAnimation(e.properties.citizen,true),'glide');
});

test('each garment replaces a distinct part of every animated body and follows its pose',async()=>{
 const {model}=await models();
 for(const [key,geometry] of model.frames)for(const piece of ['camisa','calça','vestido','casaco','saia','macacão','trapos']){
  const outfit=model.outfits.get(`${key}:${piece}`),whole=geometry.attributes.position.array;
  assert(outfit);assert(outfit.body.attributes.position.array.length>0);assert(outfit.clothes.attributes.position.array.length>0);
  if(piece==='saia')assert(outfit.clothes.attributes.position.array.length>0);
  else assert.equal(outfit.body.attributes.position.array.length+outfit.clothes.attributes.position.array.length,whole.length,piece);
 }
 const personWithClothes=person(12);personWithClothes.properties.citizen.wardrobe=[{piece:'vestido',color:'#329ac1'}];
 model.begin(.1,1);model.add(personWithClothes,0);model.end();let batch=model.batches.get('idle:0:vestido:shared');assert(batch);assert.equal(batch.mesh.colors[0],0xc42b24);assert.equal(batch.clothingMesh.colors[0],0x329ac1);assert.deepEqual(batch.mesh.matrices[0],batch.clothingMesh.matrices[0]);
 personWithClothes.x=1;model.begin(.1,1);model.add(personWithClothes,0);model.end();batch=[...model.batches.entries()].find(([key,b])=>key.startsWith('run:')&&b.count)?.[1];assert(batch);assert.deepEqual(batch.mesh.matrices[0],batch.clothingMesh.matrices[0]);assert.equal(batch.clothingMesh.colors[0],0x329ac1);
 personWithClothes.properties.citizen.wardrobe[0]={piece:'calça',color:'#ddbb11'};model.begin(.1,1);model.add(personWithClothes,0);model.end();batch=[...model.batches.entries()].find(([key,b])=>key.endsWith(':calça:shared')&&b.count)?.[1];assert.equal(batch.clothingMesh.colors[0],0xddbb11);
});

test('citizens wearing different colored clothes share an instance batch without losing colors',async()=>{
 const {model}=await models();model.begin(.01,1);
 for(let i=0;i<100;i++){const e=person(i);e.properties.citizen.wardrobe=[{piece:'camisa',color:i%2?'#ff0000':'#0000ff'}];model.add(e,0);}
 model.end();const batch=model.batches.get('idle:0:camisa:shared');assert.equal(batch.count,100);assert.equal(batch.clothingMesh.colors[0],0x0000ff);assert.equal(batch.clothingMesh.colors[99],0xff0000);assert.deepEqual(batch.mesh.matrices[99],batch.clothingMesh.matrices[99]);
});

 test('distance cadence accumulates diagonal substeps and accounts for multi-tile updates',async()=>{
 const {model}=await models(),e=person(0);e.properties.citizen.path=[{x:10,y:10}];
 const pose=()=>[...model.batches].find(([key,b])=>b.count)?.[0];
 const draw=()=>{model.begin(.1,1);model.add(e,0);model.end();};
 draw();e.x=.1;e.y=.1;draw();assert.equal(pose(),'run:0');
 e.x=.2;e.y=.2;draw();assert.equal(pose(),'run:1');
 e.x+=2;draw();assert.equal(pose(),'run:2');
 const heading=[...model.batches.values()].find(b=>b.count).mesh.matrices[0].angle;assert.equal(heading,Math.PI/2);
 for(let i=0;i<10;i++)draw();assert.equal(pose(),'run:2');
 });

test('rapid movement cannot flicker poses or skip full cycles between worker snapshots',async()=>{
 const {model}=await models(),e=person(0);e.properties.citizen.path=[{x:100,y:0}];
 const draw=dt=>{model.begin(dt,1);model.add(e,0);model.end();};const pose=()=>[...model.batches].find(([,b])=>b.count)?.[0];
 draw(.01);e.x=1.25;draw(.01);assert.equal(pose(),'run:1');
 for(let i=0;i<5;i++){e.x+=.25;draw(.01);assert.equal(pose(),'run:1');}
 e.x+=1.25;draw(.1);assert.equal(pose(),'run:2');
 for(let i=0;i<10;i++)draw(.1);assert.equal(pose(),'run:2');
});
