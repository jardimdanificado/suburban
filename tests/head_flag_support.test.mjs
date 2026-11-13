import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CITIZEN_MODEL_FRAMES,parseCitizenOBJ} from '../js/city_citizen_models.js';
import {HEAD_CROWN_FACES,citizenHeadAttachment,createHeadFlag} from '../js/city_head_flag.js';
import {animateClothFlag} from '../js/city_flag_animation.js';
import {addGroundDisplayPost} from '../js/city_display_supports.js';
class Vector{constructor(){this.set(0,0,0);}set(x,y,z){Object.assign(this,{x,y,z});return this;}}
class Group{constructor(){this.children=[];this.userData={};}add(...objects){this.children.push(...objects);}}
class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material;this.position=new Vector();this.userData={};}}
class Geometry{constructor(...args){this.args=args;}}
class PlaneGeometry{constructor(width,height){this.parameters={width,height};this.userData={};this.attributes={position:{array:new Float32Array([-width/2,-height/2,0,width/2,-height/2,0,-width/2,height/2,0,width/2,height/2,0]),count:4}};}computeVertexNormals(){}}
const THREE={Group,Mesh,BoxGeometry:Geometry,CylinderGeometry:Geometry,PlaneGeometry,MeshLambertMaterial:class{constructor(options){this.options=options;}}};
test('flag anchor is the actual common crown vertex in every supplied pose, including sitting and lying',async()=>{
 for(const [clip,frames]of Object.entries(CITIZEN_MODEL_FRAMES))for(const frame of frames){
  const data=parseCitizenOBJ(await fs.readFile(new URL(`../data/model/${clip}/${frame}.obj`,import.meta.url),'utf8')),anchor=citizenHeadAttachment(data),point=anchor.position;
  for(const face of HEAD_CROWN_FACES){let found=false;for(let i=face*9;i<face*9+9;i+=3)if(data.positions[i]===point.x&&data.positions[i+1]===point.y&&data.positions[i+2]===point.z)found=true;assert(found,`${clip}:${frame}: attachment must be on the crown`);}
  assert.ok(Math.abs(Math.hypot(...Object.values(anchor.normal))-1)<1e-6);
 }
});
test('flagpole enters the head and stays connected to the entire hoist edge in every wind pose',()=>{
 const flag=createHeadFlag(THREE,{}),{pole,cloth,mount}=flag.userData;
 assert.equal(flag.matrixAutoUpdate,false,'the flag inherits the complete posed body matrix');assert.equal(mount.children.length,2);
 assert(pole.position.y-pole.geometry.args[2]/2<0,'pole is embedded into the scalp');
 assert(cloth.position.y+cloth.geometry.parameters.height/2<=pole.position.y+pole.geometry.args[2]/2);
 for(const time of [0,.1,.3,1,8]){animateClothFlag(cloth,time,.7);const p=cloth.geometry.attributes.position.array;for(let i=0;i<p.length;i+=3)if(p[i]<0){assert.ok(Math.abs(p[i]+cloth.position.x-pole.position.x)<1e-7);assert.ok(Math.abs(p[i+2]+cloth.position.z-pole.position.z)<1e-7);}}
});
test('a display gets exactly one post that touches the ground and the backing height',()=>{
 const group=new Group(),post=addGroundDisplayPost(THREE,group,{height:1.32,z:.20});assert.equal(group.children.length,1);
 assert.ok(Math.abs(post.position.y-post.geometry.args[1]/2+.04)<1e-8);assert.equal(post.position.y+post.geometry.args[1]/2,1.32);assert.equal(post.position.z,.20);
});
