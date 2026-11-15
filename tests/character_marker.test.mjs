import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {syncCityFavoriteMarkers} from '../js/city_activity_renderer.js';

test('played citizen reuses favorite markers across character switches and interiors without saving a favorite',()=>{
 const context=new Proxy({}, {get:(object,key)=>object[key]||(()=>{})});
 globalThis.document={createElement:()=>({getContext:()=>context})};
 const THREE={CanvasTexture:class{},SpriteMaterial:class{constructor(options){Object.assign(this,options);}},Sprite:class{constructor(material){this.material=material;this.scale={set(){}};this.position={set(x,y,z){Object.assign(this,{x,y,z});}};}}};
 const city=setup({starter:true,population:24}),[first,second]=city.citizens;
 const renderer={cityFavorites:{people:{}},scene:{add(){}},zoom:1};
 first.indoorLocation=null;second.indoorLocation=null;
 city.characterGame={mode:'play',citizenId:first.id};syncCityFavoriteMarkers(renderer,THREE,city,city.world);
 assert(renderer.cityFavoriteSprites.get(first.entity.id).visible);assert.deepEqual(renderer.cityFavorites.people,{});
 city.characterGame.citizenId=second.id;syncCityFavoriteMarkers(renderer,THREE,city,city.world);
 assert(!renderer.cityFavoriteSprites.get(first.entity.id).visible);assert(renderer.cityFavoriteSprites.get(second.entity.id).visible);
 const building=city.buildings[0];second.indoorLocation={buildingId:building.id,position:{x:10,y:11,z:3}};
 syncCityFavoriteMarkers(renderer,THREE,city,city.world);const sprite=renderer.cityFavoriteSprites.get(second.entity.id);
 assert(sprite.visible);assert.equal(sprite.position.x,10);assert.equal(sprite.position.z,11);assert(sprite.position.y>=5.05);
 city.characterGame.mode='simulation';syncCityFavoriteMarkers(renderer,THREE,city,city.world);assert(!sprite.visible);
 assert.deepEqual(renderer.cityFavorites.people,{});
});

test('game and favorite markers independently customize their symbol, color and background',()=>{
 const oldDocument=globalThis.document;
 globalThis.document={createElement:()=>{
  const canvas={backgroundDrawn:false},context=new Proxy({arc(){canvas.backgroundDrawn=true;}},{get:(object,key)=>object[key]||(()=>{})});
  canvas.getContext=()=>context;return canvas;
 }};
 const THREE={CanvasTexture:class{constructor(image){this.image=image;}},SpriteMaterial:class{constructor(options){Object.assign(this,options);}},Sprite:class{constructor(material){this.material=material;this.scale={set(){}};this.position={set(){}};}}};
 try{
  const city=setup({starter:true,population:24}),person=city.citizens[0];person.indoorLocation=null;
  const favorite={icon:12,color:'#123456',background:false};
  const renderer={cityFavorites:{people:{[person.id]:favorite}},scene:{add(){}},zoom:1};
  city.characterGame={mode:'play',citizenId:person.id,marker:{icon:17,color:'#abcdef',background:true}};
  syncCityFavoriteMarkers(renderer,THREE,city,city.world);
  const sprite=renderer.cityFavoriteSprites.get(person.id),withBackground=sprite.material;
  assert(withBackground.map.image.backgroundDrawn);
  assert(renderer.cityFavoriteMaterials.has('17:#abcdef:true'));
  city.characterGame.marker.background=false;syncCityFavoriteMarkers(renderer,THREE,city,city.world);
  assert.notEqual(sprite.material,withBackground);
  assert(!sprite.material.map.image.backgroundDrawn);
  city.characterGame.mode='simulation';syncCityFavoriteMarkers(renderer,THREE,city,city.world);
  assert(renderer.cityFavoriteMaterials.has('12:#123456:false'));
  assert(!sprite.material.map.image.backgroundDrawn);
  assert.deepEqual(favorite,{icon:12,color:'#123456',background:false});
  favorite.background=true;syncCityFavoriteMarkers(renderer,THREE,city,city.world);
  assert(sprite.material.map.image.backgroundDrawn);
 }finally{globalThis.document=oldDocument;}
});

test('game marker settings validate, survive save transfer and remain editable during reserved services',async()=>{
 const {canControl}=await import('../js/character_game.js');
 const {CITY_SYMBOLS}=await import('../js/city_symbols.js');
 const {CityStateGraph,bindCityState}=await import('../js/city_state.js');
 const city=setup({starter:true,population:24}),person=city.citizens.find(c=>canControl(city,c));
 assert(city.gameAction('start',{citizenId:person.id}));
 person.deliveryId=999;
 const marker={icon:CITY_SYMBOLS.length-1,color:'#aabbcc',background:false};
 assert(city.gameAction('marker',marker));
 assert.deepEqual(city.characterGame.marker,marker);
 for(const invalid of [{icon:-1},{icon:CITY_SYMBOLS.length},{color:'red'},{background:0}]){
  assert(!city.gameAction('marker',invalid));assert.deepEqual(city.characterGame.marker,marker);
 }
 const mirror=new CityStateGraph().apply(new CityStateGraph().encode({city})).city;bindCityState(mirror);
 assert.deepEqual(mirror.characterGame.marker,marker);
 assert(mirror.gameAction('marker',{background:true}));
 assert.equal(mirror.characterGame.marker.background,true);
 assert.equal(city.characterGame.marker.background,false);
});
