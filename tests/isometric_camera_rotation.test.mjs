import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {movementVector} from '../js/character_game.js';
const rendererSource=readFileSync(new URL('../js/renderer_3d.js',import.meta.url),'utf8'),appSource=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=rendererSource.indexOf('  rotateIsometricCamera('),end=rendererSource.indexOf('  rotatePerspectiveCamera(',start);
const Camera=new Function(`return class {${rendererSource.slice(start,end)}}`)();
test('isometric rotation wraps safely and character movement follows the rotated screen axes',()=>{
 const r=new Camera();r.fixedRotationY=0;r.rotateIsometricCamera(Math.PI/2);const right=movementVector(1,0,r.fixedRotationY);assert(Math.abs(right.x)<1e-10);assert(Math.abs(right.y+1)<1e-10);
 r.rotateIsometricCamera(-Math.PI*5);assert(r.fixedRotationY>=0&&r.fixedRotationY<Math.PI*2);const before=r.fixedRotationY;r.rotateIsometricCamera(NaN);assert.equal(r.fixedRotationY,before);
});
function gesture({locked=true,third=false,button=1,x=20,game=true,onUI=false}={}){
 const rotate=[],pan=[],input=[];
 let prevented=false;
 const renderer={isPerspectiveActive:()=>third,isFirstPersonActive:()=>false,getCameraZoom:()=>4,setMousePos(){},rotatePerspectiveCamera:(...args)=>rotate.push(['3p',...args]),rotateIsometricCamera:angle=>rotate.push(['iso',angle])};
 const ui={active:game,keys:new Set(['KeyW']),pointerDown:()=>onUI,pointerMove:()=>false,input:()=>input.push(true)};
 const root={getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){}};
 const cityUI={rightClick:()=>false,pointerDown:()=>onUI,pointerMove:()=>false,scrollAt(){}};
 const from=appSource.indexOf('function onPointerDown(event)'),to=appSource.indexOf('\nfunction onPointerUp(event)',from);
 const handlers=new Function('gameUI','renderer3D','root','gameCameraLocked','panGameCamera','moveCameraByPointer','cityUI','mainMenu','legacyUI','freeCameraTouch','editor',`
  let mousePosition,lastPointer=null,pointerDown=null,pointerOnUI=false,cameraLookDrag=false,dragging=false,editingGesture=false,rightClickConsumed=false;
  ${appSource.slice(from,to)};return {onPointerDown,onPointerMove};
 `)(ui,renderer,root,locked,(...args)=>pan.push(args),(...args)=>pan.push(args),cityUI,{isActive:()=>false},{hitTest:()=>false},{pointerDown:()=>false},{open:false});
 const event={clientX:0,clientY:0,button,buttons:button===1?4:button===2?2:1,pointerType:'mouse',target:{closest:()=>null},preventDefault(){prevented=true;}};
 handlers.onPointerDown(event);handlers.onPointerMove({...event,clientX:x});return {rotate,pan,input,prevented};
}
test('middle drag rotates game and simulation cameras while tiny gestures and UI drags do not',()=>{
 for(const game of [true,false])for(const locked of [true,false])for(const third of [true,false]){
  const result=gesture({game,locked,third});
  assert.equal(result.rotate[0][0],third?'3p':'iso');
  assert.equal(result.rotate[0][1],third?.08:-.08);
  assert.equal(result.pan.length,0);assert(result.prevented);
  assert.equal(result.input.length,game?1:0);
  assert.equal(gesture({game,locked,third,x:3}).rotate.length,0);
  assert.equal(gesture({game,locked,third,onUI:true}).rotate.length,0);
 }
});
test('right drag pans free cameras without rotating and left drag still pans the simulation',()=>{
 for(const game of [true,false]){
  const right=gesture({game,locked:false,button:2});assert.equal(right.rotate.length,0);assert.equal(right.pan.length,1);
  const click=gesture({game,button:2,x:0});assert.equal(click.rotate.length,0);
 }
 const locked=gesture({button:2});assert.equal(locked.rotate.length,0);assert.equal(locked.pan.length,0);
 const left=gesture({game:false,button:0});assert.equal(left.rotate.length,0);assert.equal(left.pan.length,1);
});
test('isometric panning uses the current rotation rather than the initial 45-degree axes',()=>{
 const from=appSource.indexOf('function moveCameraByPointer('),to=appSource.indexOf('\nfunction updateFreeCameraMovement(',from);
 const r={fixedRotationY:Math.PI/2,isometricAngleX:Math.atan(1/Math.SQRT2),getCameraX:()=>10,getCameraY:()=>20,setCamera(x,y){this.x=x;this.y=y;}};
 const move=new Function('renderer3D','root',`${appSource.slice(from,to)};return moveCameraByPointer;`)(r,{clientHeight:800});move(20,0,4);assert(Math.abs(r.x-10)<1e-10);assert(r.y>20);
});
