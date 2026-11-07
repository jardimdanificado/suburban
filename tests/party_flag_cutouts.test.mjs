import test from 'node:test';
import assert from 'node:assert/strict';
import {drawPartyFlag} from '../js/city_party_flags.js';
import {ASSET_DATA} from '../js/assets_data.js';

test('detailed flag emblems expose the field through enclosed internal marks',()=>{
 const oldDocument=globalThis.document,oldImage=globalThis.Image;
 globalThis.Image=class{complete=true;naturalWidth=3;naturalHeight=3;};
 let opaqueTile=false;
 globalThis.document={createElement(){
  const canvas={width:3,height:3},pixels=new Uint8ClampedArray(36).fill(255);
  if(!opaqueTile){pixels[3]=0;pixels[16]=pixels[17]=pixels[18]=0;}
  const context={drawImage(){},getImageData(){return {data:pixels};},putImageData(image){canvas.pixels=image.data;}};
  canvas.getContext=()=>context;return canvas;
 }};
 const images=[],ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},fillRect(){},strokeRect(){},drawImage(image){images.push(image);}};
 const flag={background:'#3377ff',foreground:'#001144',colors:['#3377ff','#001144','#ffffaa','#001144'],backgroundStyle:'solid',texts:[],emblems:[{skin:ASSET_DATA[0].filename,x:0,y:0,w:1,h:1,color:'#001144',backgroundMode:'transparent',detailMode:'detailed'}]};
 try{
  drawPartyFlag(ctx,flag,0,0,30,30);drawPartyFlag(ctx,flag,0,0,30,30);
  const detailed=images.at(-1).pixels;
  assert.equal(detailed[19],0,'enclosed internal mark must be transparent');
  assert.equal(detailed[3],0,'existing transparency must survive');
  assert.deepEqual(Array.from(detailed.slice(4,8)),[0,17,68,255],'silhouette keeps emblem ink');
  drawPartyFlag(ctx,{...flag,emblems:[{...flag.emblems[0],detailMode:'flat'}]},0,0,30,30);
  assert.deepEqual(Array.from(images.at(-1).pixels.slice(16,20)),[0,17,68,255],'flat silhouettes retain their solid fill');
  drawPartyFlag(ctx,{...flag,emblems:[{...flag.emblems[0],backgroundMode:'tile'}]},0,0,30,30);
  assert.equal(images.at(-1).pixels[19],0,'legacy tile settings must also use a transparent cutout');
  opaqueTile=true;
  const before=images.length,uncuttable={...flag,emblems:[{...flag.emblems[0],skin:ASSET_DATA[1].filename}]};
  drawPartyFlag(ctx,uncuttable,0,0,30,30);drawPartyFlag(ctx,uncuttable,0,0,30,30);
  assert.equal(images.length,before,'uncuttable tile art must never fall back to an opaque rectangle');
 }finally{globalThis.document=oldDocument;globalThis.Image=oldImage;}
});
