import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),start=source.indexOf('function updateGameInteriorCamera('),end=source.indexOf('\nfunction panGameCamera(',start);
function fixture(third=true,locked=true){
 const renderer={third,fpYaw:1.2,fpPitch:.4,tpDistance:6,thirdPersonFreeTarget:locked?null:{x:20,y:3,z:30},isThirdPersonActive(){return this.third;},setThirdPersonMode(active,id){this.third=active;this.entityId=id;this.thirdPersonFreeTarget=null;this.fpYaw=0;this.fpPitch=.35;this.tpDistance=4.5;}};
 const update=new Function('renderer3D','gameCameraLocked',`let gameIndoorCamera=null;const configureGameCameraLock=()=>{};${source.slice(start,end)};return updateGameInteriorCamera;`)(renderer,locked);
 return {renderer,update,c:{entity:{id:7},indoorLocation:null}};
}
test('entering from 3p switches once to isometric and restores orbit only after fully leaving',()=>{
 const {renderer:r,update,c}=fixture();update(c);assert(r.third);c.indoorLocation={buildingId:1};update(c);assert(!r.third);update(c);assert(!r.third);
 c.indoorLocation.exiting=true;update(c);assert(!r.third);c.indoorLocation=null;update(c);assert(r.third);assert.equal(r.entityId,7);assert.equal(r.fpYaw,1.2);assert.equal(r.fpPitch,.4);assert.equal(r.tpDistance,6);
 r.third=false;update(c);assert(!r.third,'must not keep restoring 3p every frame');
});
test('an isometric player stays isometric after entering and leaving',()=>{
 const {renderer:r,update,c}=fixture(false);c.indoorLocation={buildingId:1};update(c);c.indoorLocation=null;update(c);assert(!r.third);
});
test('free 3p restores its detached orbit anchor on exit',()=>{
 const {renderer:r,update,c}=fixture(true,false);c.indoorLocation={buildingId:1};update(c);assert(!r.third);c.indoorLocation=null;update(c);assert(r.third);assert.deepEqual(r.thirdPersonFreeTarget,{x:20,y:3,z:30});
});
