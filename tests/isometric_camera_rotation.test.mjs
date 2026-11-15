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
function gesture({locked=true,third=false,buttons=2,x=20}={}){
 const rotate=[],pan=[],input=[];
 const renderer={isPerspectiveActive:()=>third,rotatePerspectiveCamera:(...args)=>rotate.push(['3p',...args]),rotateIsometricCamera:angle=>rotate.push(['iso',angle])};
 const ui={active:true,keys:new Set(['KeyW']),pointerMove:()=>false,input:()=>input.push(true)},root={getBoundingClientRect:()=>({left:0,top:0})};
 const from=appSource.indexOf('function onPointerMove(event)'),to=appSource.indexOf('\nfunction onPointerUp(event)',from);
 const handler=new Function('gameUI','renderer3D','root','gameCameraLocked','panGameCamera',`let mousePosition,lastPointer={x:0,y:0},pointerDown={x:0,y:0},pointerOnUI=false,cameraLookDrag=true;${appSource.slice(from,to)};return onPointerMove;`)(ui,renderer,root,locked,(...args)=>pan.push(args));
 handler({clientX:x,clientY:0,buttons,pointerType:'mouse'});return {rotate,pan,input};
}
test('right drag rotates isometric in locked and free modes, while tiny clicks preserve the contextual menu gesture',()=>{
 for(const locked of [true,false]){const result=gesture({locked});assert.equal(result.rotate[0][0],'iso');assert.equal(result.rotate[0][1],-.08);assert.equal(result.pan.length,0);assert.equal(result.input.length,1);}
 assert.equal(gesture({x:3}).rotate.length,0);assert.equal(gesture({third:true}).rotate[0][0],'3p');
 const middle=gesture({locked:false,buttons:4});assert.equal(middle.rotate.length,0);assert.equal(middle.pan.length,1);
});
test('isometric panning uses the current rotation rather than the initial 45-degree axes',()=>{
 const from=appSource.indexOf('function moveCameraByPointer('),to=appSource.indexOf('\nfunction updateFreeCameraMovement(',from);
 const r={fixedRotationY:Math.PI/2,isometricAngleX:Math.atan(1/Math.SQRT2),getCameraX:()=>10,getCameraY:()=>20,setCamera(x,y){this.x=x;this.y=y;}};
 const move=new Function('renderer3D','root',`${appSource.slice(from,to)};return moveCameraByPointer;`)(r,{clientHeight:800});move(20,0,4);assert(Math.abs(r.x-10)<1e-10);assert(r.y>20);
});
