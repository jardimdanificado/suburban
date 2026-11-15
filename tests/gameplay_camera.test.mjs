import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/renderer_3d.js',import.meta.url),'utf8');
const start=source.indexOf('  updateCamera('),end=source.indexOf('\n  // ---------------------------------------------------------------------------',start);
const Camera=new Function(`return class {${source.slice(start,end)}}`)();
function vector(){return {x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});return this;},copy(p){Object.assign(this,{x:p.x,y:p.y,z:p.z});return this;},lerp(p){return this.copy(p);}};}
function fixture(){
 const building={id:7,width:20,depth:20,floors:4,entity:{x:0,y:0},terrain:{base:2}},entity={x:4,y:5,properties:{citizen:{indoorLocation:{buildingId:7,floor:2,position:{x:4.5,y:5.5,z:3.6}}}}};
 const r=new Camera();Object.assign(r,{fpEntityId:1,width:1000,height:800,currentMap:{},fpYaw:0,fpPitch:.35,tpDistance:4.5,tpCameraPosition:vector(),tpCameraTarget:vector(),tpDesiredPosition:vector(),tpDesiredTarget:vector(),followMarker:{visible:false,position:vector()},followLight:{visible:true},fpCamera:{position:vector(),updateProjectionMatrix(){},lookAt(p){this.target={...p};}},cityDevelopment:{city:{building:()=>building}},isPerspectiveActive:()=>true,isThirdPersonActive:()=>true,isFirstPersonActive:()=>false,findCameraEntity:()=>entity,getSurfaceElevation:()=>0,resolveThirdPersonCamera(target,desired,city,inside){this.collisionInside=inside;return desired;}});
 return {r,entity};
}
test('third person indoors targets the resident on the actual floor and never turns on a personal light',()=>{
 const {r}=fixture();r.updateCamera([],1/60);assert.equal(r.tpCameraTarget.x,4.5);assert.equal(r.tpCameraTarget.z,5.5);assert.equal(r.tpCameraTarget.y,6.25);assert.equal(r.collisionInside,7);
 assert(Math.hypot(r.fpCamera.position.x-4.5,r.fpCamera.position.y-6.25,r.fpCamera.position.z-5.5)<=3.001);assert.equal(r.followLight.visible,false);
});
test('detached third person keeps a fixed orbit anchor while the controlled citizen moves',()=>{
 const {r,entity}=fixture();r.thirdPersonFreeTarget={x:20,y:8,z:30};r.updateCamera([],1/60);const before={...r.fpCamera.position};entity.properties.citizen.indoorLocation.position.x+=5;r.updateCamera([],1/60);
 assert.equal(r.tpCameraTarget.x,20);assert.equal(r.tpCameraTarget.z,30);assert.equal(r.fpCamera.position.x,before.x);assert.equal(r.fpCamera.position.z,before.z);assert.equal(r.followLight.visible,false);
});

import {applyInteriorCutaway} from '../js/city_interior_view.js';
test('merged building walls expose only the occupied floor and restore the full mesh on exit',()=>{
 const ranges=new Map([[0,{start:0,count:36}],[1,{start:36,count:72}]]),cells={userData:{combinedCellFloors:ranges,cellVertexCount:108},geometry:{setDrawRange(start,count){Object.assign(this,{start,count});}},scale:{},position:{}},roof={visible:true},facade={visible:true},group={userData:{cellMeshes:[cells],roof,facade}};
 class Matrix{}class Vector{constructor(x,y,z){Object.assign(this,{x,y,z});}}
 applyInteriorCutaway({Matrix4:Matrix,Vector3:Vector},group,1,true);assert.equal(cells.geometry.start,36);assert.equal(cells.geometry.count,72);assert.equal(cells.scale.y,.16);assert(!roof.visible);assert(!facade.visible);
 applyInteriorCutaway({Matrix4:Matrix,Vector3:Vector},group,null);assert.equal(cells.geometry.start,0);assert.equal(cells.geometry.count,108);assert.equal(cells.scale.y,1);assert(roof.visible);assert(facade.visible);
});
