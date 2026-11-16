import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/renderer_3d.js',import.meta.url),'utf8');
const start=source.indexOf('function indoorCitizenVisibleFromOutside('),end=source.indexOf('\nconst roadRailingLayouts=',start);
assert(start>=0&&end>start);
const visible=new Function(`${source.slice(start,end)};return indoorCitizenVisibleFromOutside;`)();
function fixture(){
 const building={id:1,entity:{destroyed:false}},unit={x:0,y:0,z:1},mesh={visible:true,userData:{windowCellKeys:new Set(['0,0,1']),balconyCellKeys:new Set()}},location={buildingId:1,unitId:2,floor:1,roomType:'bedroom'};
 const city={building:id=>id===1?building:null,units:new Map([[2,unit]])};
 const renderer={cityDevelopment:{city},cityMeshes:new Map([[1,mesh]]),sleepingFloorsByBuilding:new Map()};
 return {renderer,building,unit,mesh,location};
}
test('hiding a building hides window, balcony and rooftop occupants; showing it restores them',()=>{
 const {renderer,mesh,location}=fixture();
 for(const roomType of ['bedroom','balcony','roof_terrace']){
  location.roomType=roomType;assert.equal(visible(renderer,location),true);
  mesh.visible=false;assert.equal(visible(renderer,location),false,roomType);
  mesh.visible=true;assert.equal(visible(renderer,location),true,roomType);
 }
});
test('occupants are hidden when their building mesh is absent or their building was destroyed',()=>{
 const {renderer,building,mesh,location}=fixture();
 for(const roomType of ['bedroom','balcony','roof_terrace']){
  location.roomType=roomType;renderer.cityMeshes.clear();assert.equal(visible(renderer,location),false);
  renderer.cityMeshes.set(1,mesh);building.entity.destroyed=true;assert.equal(visible(renderer,location),false);building.entity.destroyed=false;
 }
});
test('office occupants follow the tower shell visibility',()=>{
 const {renderer,building,mesh,location}=fixture();building.officeTenantOf=10;renderer.cityMeshes=new Map([[10,mesh]]);
 assert.equal(visible(renderer,location),true);mesh.visible=false;assert.equal(visible(renderer,location),false);
});
test('window, shutter and sleeping-floor rules remain intact',()=>{
 const {renderer,unit,mesh,location}=fixture();
 unit.windowStyle='shuttered';assert.equal(visible(renderer,location),false);unit.windowStyle='open';
 renderer.sleepingFloorsByBuilding.set(1,new Set([1]));assert.equal(visible(renderer,location),false);renderer.sleepingFloorsByBuilding.clear();
 mesh.userData.windowCellKeys.clear();assert.equal(visible(renderer,location),false);
 mesh.userData.balconyCellKeys.add('0,0,1');assert.equal(visible(renderer,location),true);
});
test('cutaway facade visibility alone does not hide people in a visible building',()=>{
 const {renderer,mesh,location}=fixture();mesh.userData.facade={visible:false};assert.equal(visible(renderer,location),true);
});
test('exiting and moving indoor occupants keep their existing visibility rules',()=>{
 const {renderer,location}=fixture();location.exiting=true;assert.equal(visible(renderer,location),false);
 location.exiting=false;location.path=[{}];assert.equal(visible(renderer,location),false);
 assert.equal(visible(renderer,null),false);
});

test('raised house occupants follow the visible shell base, including occupied balconies',async()=>{
 const {citizenBuildingSurfaceHeight:height}=await import('../js/city_building_geometry.js');
 const building={entity:{x:10,y:10},width:3,depth:3,terrain:{base:2}};
 assert.equal(height(building,{unitId:1,path:[]},{x:11,y:11},.5,4),4);
 assert.equal(height(building,{unitId:1,path:[]},{x:13.2,y:11},.5,4),4);
 assert.equal(height(building,{unitId:null,path:[{}]},{x:13.2,y:11},.5,4),.5);
 assert.equal(height(building,{unitId:1,exiting:true,path:[{}]},{x:13.2,y:11},.5,4),.5);
 assert.equal(height(building,{unitId:1,path:[]},{x:11,y:11},.5),2);
});
