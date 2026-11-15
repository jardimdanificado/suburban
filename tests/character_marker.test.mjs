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
