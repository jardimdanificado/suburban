import test from 'node:test';
import assert from 'node:assert/strict';
import {ASSET_DATA} from '../js/assets_data.js';
import {CITY_SYMBOLS,legacyGlyphIndex} from '../js/city_symbols.js';
import {CityFavorites,FAVORITE_GLYPH_COUNT} from '../js/city_favorites.js';
import {drawFavoriteSymbol,drawPartyFlag,mutateMunicipalFlag} from '../js/city_party_flags.js';

test('shared catalog preserves favorite indices and includes every flag tile',()=>{
 assert.equal(FAVORITE_GLYPH_COUNT,CITY_SYMBOLS.length);
 for(let index=0;index<256;index++)assert.equal(legacyGlyphIndex(CITY_SYMBOLS[index]),index);
 assert.deepEqual(CITY_SYMBOLS.slice(256),ASSET_DATA.filter(asset=>/\.png$/i.test(asset.filename)).map(asset=>asset.filename));
 const preferences={people:{1:{icon:42},2:{icon:CITY_SYMBOLS.length-1},3:{icon:CITY_SYMBOLS.length}},businesses:{},parties:{}};
 CityFavorites.prototype.sanitize.call(preferences);
 assert.equal(preferences.people[1].icon,42);
 assert.equal(preferences.people[2].icon,CITY_SYMBOLS.length-1);
 assert.equal(preferences.people[3].icon,42);
});

test('flag mutations can select favorite glyphs and render them as transparent emblems',()=>{
 const oldDocument=globalThis.document;
 const context={fillRect(){},drawImage(){}};
 globalThis.document={createElement:()=>({getContext:()=>context})};
 try{
  const flag=mutateMunicipalFlag({random:()=>.01},{foreground:'#ffffff',background:'#000000',backgroundStyle:'solid',colors:['#000000','#ffffff','#ff0000','#00ff00'],emblems:[{skin:ASSET_DATA[0].filename,x:0,y:0,w:1,h:1}],texts:[]},{type:'replace-symbol',index:0});
  const skin=flag.emblems[0].skin,glyph=legacyGlyphIndex(skin);
  assert.notEqual(glyph,null);
  const images=[],target={save(){},restore(){},beginPath(){},rect(){},clip(){},fillRect(){},strokeRect(){},drawImage(image,...args){images.push({image,args});}};
  drawPartyFlag(target,flag,0,0,32,32);
  assert.equal(images.length,1);
  assert.equal(images[0].image.width,8);
  drawFavoriteSymbol(target,glyph,0,0,'#ffffff',2);
  assert.equal(images.length,2);
  assert.equal(images[1].args[0],glyph%16*8);
 }finally{globalThis.document=oldDocument;}
});

test('favorite tile previews redraw after loading and retain the selected color',()=>{
 const oldDocument=globalThis.document,oldImage=globalThis.Image,loaded=[],draws=[];
 globalThis.Image=class{
  complete=false;naturalWidth=2;naturalHeight=2;
  constructor(){loaded.push(this);}
 };
 globalThis.document={createElement(){
  const canvas={width:2,height:2},pixels=new Uint8ClampedArray(16).fill(255);
  canvas.getContext=()=>({drawImage(){},getImageData:()=>({data:pixels}),putImageData:()=>{canvas.pixels=pixels;}});
  return canvas;
 }};
 const target={save(){},restore(){},drawImage(image){draws.push(image);}};
 let ready=0;
 try{
  const index=CITY_SYMBOLS.length-1;
  drawFavoriteSymbol(target,index,0,0,'#123456',2,()=>ready++);
  assert.equal(draws.length,0);
  assert.equal(loaded.length,1);
  loaded[0].complete=true;loaded[0].onload();
  assert.equal(ready,1);
  drawFavoriteSymbol(target,index,0,0,'#123456',2);
  assert.equal(draws.length,1);
  assert.deepEqual(Array.from(draws[0].pixels.slice(0,4)),[18,52,86,255]);
 }finally{globalThis.document=oldDocument;globalThis.Image=oldImage;}
});
