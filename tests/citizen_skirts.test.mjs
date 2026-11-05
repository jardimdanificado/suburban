import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CITIZEN_MODEL_FRAMES,parseCitizenOBJ,citizenVertexWeightDelta} from '../js/city_citizen_models.js';
import {fittedSkirtSurface} from '../js/city_citizen_skirts.js';

const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sample=(point,fat)=>point.p.map((v,i)=>v+fat*point.d[i]);
const fixtures=Promise.all(Object.entries(CITIZEN_MODEL_FRAMES).flatMap(([clip,frames])=>frames.map(async frame=>({key:`${clip}:${frame}`,data:parseCitizenOBJ(await fs.readFile(new URL(`../data/model/${clip}/${frame}.obj`,import.meta.url),'utf8'))})))).then(entries=>{
 const idle=entries.find(e=>e.key==='idle:0').data.bounds,origin=[(idle.min[0]+idle.max[0])/2,Math.min(...entries.map(e=>e.data.bounds.min[1])),(idle.min[2]+idle.max[2])/2],scale=1.05/(idle.max[1]-idle.min[1]);
 for(const {data} of entries)for(let i=0;i<data.positions.length;i++)data.positions[i]=(data.positions[i]-origin[i%3])*scale;
 return entries.map(entry=>({...entry,skirts:['saia','saia longa'].map(piece=>({piece,surface:fittedSkirtSurface(entry.data,piece,citizenVertexWeightDelta)}))}));
});

test('short and long skirts stay on anatomical pelvis and leg faces in all 24 poses',async()=>{
 for(const {key,skirts} of await fixtures)for(const {piece,surface} of skirts){
  assert.equal(surface.bodyMask[13],0,`${key}: head must remain visible`);
  assert.equal(surface.bodyMask[82],0,`${key}: hands must remain visible`);
  assert.equal(surface.bodyMask[0],0,`${key}: feet must remain visible`);
  assert.equal(surface.bodyMask[1],1,`${key}: thigh is covered`);
  assert.equal(surface.bodyMask[48],1,`${key}: pelvis is covered`);
  assert.equal(surface.bodyMask[54],Number(piece==='saia longa'),`${key}: short hem exposes the shin`);
  assert.equal(surface.bodyMask.reduce((sum,v)=>sum+v,0),piece==='saia longa'?60:36);
  for(const buffer of [surface.positions,surface.normals,surface.morphDeltas,surface.normalLinear,surface.normalQuadratic]){
   assert.equal(buffer.length,surface.positions.length);assert(buffer.every(Number.isFinite),`${key}: finite ${piece} geometry`);
  }
  assert(surface.positions.length/9<=452,`${key}: shared skirt geometry has a bounded triangle count`);
 }
});

test('the inner lining preserves covered leg surfaces instead of exposing a hollow body through the hem',async()=>{
 const faceKey=points=>points.map(p=>p.join(',')).sort().join('|');
 for(const {key,data,skirts} of await fixtures)for(const {piece,surface} of skirts){
  const faces=new Set();
  for(let i=0;i<surface.positions.length;i+=9)faces.add(faceKey([0,3,6].map(j=>Array.from(surface.positions.subarray(i+j,i+j+3)))));
  for(let face=0;face<surface.bodyMask.length;face++)if(surface.bodyMask[face]){
   const points=[0,3,6].map(j=>Array.from(data.positions.subarray(face*9+j,face*9+j+3)));
   assert(faces.has(faceKey(points)),`${key} ${piece}: missing inner lining on anatomical face ${face}`);
  }
 }
});

test('fitted sections enclose the body at lean, average and maximum body weights',async()=>{
 for(const {key,skirts} of await fixtures)for(const {piece,surface} of skirts)for(const fat of [-.42,-.2,0,.6,1.2,1.8])for(const ring of surface.rings){
  const projected=ring.vertices.map(v=>{const p=sample(v,fat);return [dot(p,ring.frame.right),dot(p,ring.frame.forward)];});
  for(const anchor of ring.anchors){
   const point=sample(anchor,fat),x=dot(point,ring.frame.right),y=dot(point,ring.frame.forward);
   for(let i=0;i<projected.length;i++){
    const a=projected[i],b=projected[(i+1)%projected.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const clearance=((b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]))/length;
    assert(clearance>=ring.clearance-1e-6,`${key} ${piece} fat=${fat}: cloth must remain outside the body (${clearance})`);
   }
  }
 }
});

test('skirt anchors follow a rotated and translated body without guessing a world-space waist height',async()=>{
 const {data}= (await fixtures).find(e=>e.key==='sentado_no_banco:0');
 const rotate=([x,y,z])=>[z,-x,-y],offset=[2.3,-1.7,4.1];
 for(const piece of ['saia','saia longa']){
  const original=fittedSkirtSurface(data,piece),positions=new Float32Array(data.positions.length);
  for(let i=0;i<positions.length;i+=3){const p=rotate(data.positions.subarray(i,i+3));for(let axis=0;axis<3;axis++)positions[i+axis]=p[axis]+offset[axis];}
  const transformed=fittedSkirtSurface({positions},piece);
  assert.equal(transformed.positions.length,original.positions.length);
  for(let i=0;i<original.positions.length;i+=3){const expected=rotate(original.positions.subarray(i,i+3));for(let axis=0;axis<3;axis++)assert(Math.abs(transformed.positions[i+axis]-expected[axis]-offset[axis])<2e-6);}
  assert.deepEqual(transformed.bodyMask,original.bodyMask);
 }
});

test('the waistband inner edge remains on the actual non-planar waist at every weight',async()=>{
 const distanceToSegment=(point,a,b)=>{
  const edge=sub(b,a),t=Math.max(0,Math.min(1,dot(sub(point,a),edge)/dot(edge,edge)));
  return Math.hypot(...point.map((v,i)=>v-a[i]-t*edge[i]));
 };
 for(const {key,skirts} of await fixtures)for(const {piece,surface} of skirts)for(const fat of [-.42,0,.7,1.8]){
  const waist=surface.rings[0].anchors.map(anchor=>sample(anchor,fat));
  for(const binding of surface.waistInner){
   const point=sample(binding,fat),distance=Math.min(...waist.map((p,i)=>distanceToSegment(point,p,waist[(i+1)%waist.length])));
   assert(distance<1e-8,`${key} ${piece} fat=${fat}: floating waistband (${distance})`);
  }
  for(const anchor of surface.rings[0].anchors){
   let found=false;
   for(let i=0;i<surface.positions.length;i+=3)if(anchor.p.every((v,axis)=>Math.abs(v-surface.positions[i+axis])<1e-7)&&anchor.d.every((v,axis)=>Math.abs(v-surface.morphDeltas[i+axis])<1e-7)){found=true;break;}
   assert(found,`${key} ${piece}: the waistband must retain every original body corner`);
  }
 }
});

test('GPU skirt normals match the deformed cloth triangles across the full weight range',async()=>{
 for(const {key,skirts} of await fixtures)for(const {piece,surface} of skirts)for(const fat of [-.42,0,.7,1.8]){
  const {positions:p,morphDeltas:d,normals:n,normalLinear:linear,normalQuadratic:quadratic}=surface;
  for(let i=0;i<p.length;i+=9){
   const points=[0,3,6].map(j=>[0,1,2].map(axis=>p[i+j+axis]+fat*d[i+j+axis]));
   const actual=cross(sub(points[1],points[0]),sub(points[2],points[0])),shader=[0,1,2].map(axis=>n[i+axis]+fat*linear[i+axis]+fat*fat*quadratic[i+axis]);
   const area=Math.hypot(...actual),shaderLength=Math.hypot(...shader);
   assert(area>1e-10,`${key} ${piece} fat=${fat}: collapsed triangle ${i/9}`);
   assert(shaderLength>1e-8);
   assert(dot(actual,shader)/(area*shaderLength)>.9999,`${key} ${piece} fat=${fat}: incorrect normal ${i/9}`);
  }
 }
});
