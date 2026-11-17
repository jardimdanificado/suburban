import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureWallArtDesign} from '../js/city_wall_art.js';
import {CityStateGraph} from '../js/city_state.js';

test('murals generate varied compositions with the flag symbol catalog rather than four fixed drawings',()=>{
 const designs=Array.from({length:64},(_,id)=>ensureWallArtDesign({id,createdAt:id*60,message:'Arte da cidade'},713));
 assert(designs.every(d=>d.emblems.length>=1));
 assert(new Set(designs.map(d=>JSON.stringify(d))).size>50);
 assert(new Set(designs.flatMap(d=>d.emblems.map(e=>e.skin))).size>12);
 assert(new Set(designs.map(d=>d.layoutId)).size>4);
 assert(designs.every(d=>d.emblems.every(e=>e.backgroundMode==='transparent')));
});

test('generated wall art stays stable across renders and saves and varies by city seed',()=>{
 const piece={id:12,createdAt:125,message:'Arte da cidade'},design=ensureWallArtDesign(piece,42);
 assert.equal(ensureWallArtDesign(piece,999),design);
 assert.deepEqual(ensureWallArtDesign({id:12,createdAt:125,message:piece.message},42),design);
 assert.notDeepEqual(ensureWallArtDesign({id:12,createdAt:125,message:piece.message},43),design);
 const restored=new CityStateGraph().apply(new CityStateGraph().encode({city:{world:{},piece}})).city.piece;assert.deepEqual(ensureWallArtDesign(restored,0),design);
});
