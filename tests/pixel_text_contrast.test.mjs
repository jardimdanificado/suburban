import test from 'node:test';
import assert from 'node:assert/strict';
import {drawPixelText} from '../js/pixel_text.js';

test('pixel text adapts opaque glyph pixels to the local field without filling transparent pixels',()=>{
 const previous=globalThis.document;
 const pixels={data:new Uint8ClampedArray([255,255,255,255,255,255,255,0,255,255,255,200,255,255,255,100])};
 let result,draws=0;
 const mask={fillText(){},getImageData(){return pixels;},putImageData(value){result=value;}};
 globalThis.document={createElement(){return {getContext(){return mask;}};}};
 const ctx={font:'10px monospace',canvas:{width:20},textAlign:'center',textBaseline:'middle',save(){},restore(){},drawImage(){draws++;}};
 try{
  const points=[];
  drawPixelText(ctx,'AB',0,0,4,(x,y)=>{points.push([x,y]);return x<0?[255,255,255]:[17,17,17];});
  assert.equal(points.length,2);
  assert.deepEqual(Array.from(result.data.filter((_,i)=>i%4===3)),[255,0,255,0]);
  assert.deepEqual(Array.from(result.data.slice(0,3)),[255,255,255]);
  assert.deepEqual(Array.from(result.data.slice(8,11)),[17,17,17]);
  assert.equal(draws,1);
 }finally{globalThis.document=previous;}
});
