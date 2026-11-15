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
test('third person stays outside and frames the building instead of following interior movement',()=>{
 const {r,entity}=fixture();r.updateCamera([],1/60);assert.equal(r.tpCameraTarget.x,10);assert.equal(r.tpCameraTarget.z,10);assert.equal(r.collisionInside,7);
 const before={...r.fpCamera.position};entity.properties.citizen.indoorLocation.position={x:9,y:9,z:5.4};r.updateCamera([],1/60);assert.equal(r.fpCamera.position.x,before.x);assert.equal(r.fpCamera.position.z,before.z);assert.equal(r.followLight.visible,false);
 assert(r.fpCamera.position.x<0||r.fpCamera.position.x>20||r.fpCamera.position.z<0||r.fpCamera.position.z>20);
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

test('exterior orbit and its smoothed camera position stay out of neighboring buildings',()=>{
 const from=source.indexOf('  thirdPersonBuildingIndex('),to=source.indexOf('\n  getTileBaseHeight(',from);
 class Vector3{constructor(x,y,z){Object.assign(this,{x,y,z});}}
 const Collision=new Function('THREE','CITY_FLOOR_HEIGHT',`return class {${source.slice(from,to)}}`)({Vector3},1.8),{r}=fixture();
 r.thirdPersonBuildingIndex=Collision.prototype.thirdPersonBuildingIndex;r.resolveThirdPersonCamera=Collision.prototype.resolveThirdPersonCamera;
 const own=r.cityDevelopment.city.building(),neighbors=[{id:8,entity:{x:8,y:24},width:5,depth:8,floors:6,terrain:{base:0}},{id:9,entity:{x:23,y:8},width:8,depth:6,floors:4,terrain:{base:0}}];r.cityDevelopment.city.buildings=[own,...neighbors];r.cityDevelopment.city.structureRevision=1;
 for(let i=0;i<80;i++){
  r.fpYaw=i*.1;r.updateCamera([],.05);const p=r.fpCamera.position;
  for(const b of neighbors)assert(!(p.x>b.entity.x&&p.x<b.entity.x+b.width&&p.z>b.entity.y&&p.z<b.entity.y+b.depth&&p.y>0&&p.y<b.floors*1.8+1),'camera penetrated a neighboring facade or roof');
 }
});


test('isometric follow tracks floor height, descent and unlocking',()=>{
 const {r,entity}=fixture();r.isPerspectiveActive=()=>false;r.followCharacterId=1;r.zoom=1;r.fixedRotationY=.7;r.isometricAngleX=.6;
 r.camera={position:vector(),updateProjectionMatrix(){},lookAt(x,y,z){this.target={x,y,z};}};
 r.updateCamera([],1/60);assert.equal(r.camera.target.y,2+3.6+.65);
 const before=r.camera.position.y;
 entity.properties.citizen._renderIndoorPosition={x:6,y:7,z:5.4};
 r.updateCamera([],1/60);assert.equal(r.camera.target.x,6);assert.equal(r.camera.target.z,7);
 assert(Math.abs(r.camera.position.y-before-1.8)<1e-10);
 entity.properties.citizen._renderIndoorPosition.z=0;r.updateCamera([],1/60);assert.equal(r.camera.target.y,2.65);
 r.followCharacterId=null;r.updateCamera([],1/60);assert.equal(r.camera.target.y,1);
});

test('perspective follow tracks rendered skybridge height and descent',()=>{
 const {r,entity}=fixture();const citizen=entity.properties.citizen;citizen.indoorLocation=null;citizen.skybridgeZ=5.4;
 r.updateCamera([],1/60);assert(Math.abs(r.tpCameraTarget.y-6.05)<1e-10);
 citizen._renderIndoorPosition={x:6,y:7,z:2.7};r.updateCamera([],1/60);
 assert(Math.abs(r.tpCameraTarget.y-3.35)<1e-10);assert.equal(r.tpCameraTarget.x,6);
 citizen._renderIndoorPosition.z=0;r.updateCamera([],1/60);assert.equal(r.tpCameraTarget.y,.65);
});
