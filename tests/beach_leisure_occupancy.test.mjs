import test from 'node:test';
import assert from 'node:assert/strict';
import {CityFurniture} from '../js/city_furniture.js?v=beach-occupancy-index-1';
import {TILE_SAND,TILE_WATER} from '../js/world_gen.js?v=deep-perf-3';

test('beach visits reserve separate nearby shore spots during the same minute',()=>{
 const city={minute:120,world:{width:40,height:40,getTile(x,y){if(x===19)return TILE_SAND;if(x>=20)return TILE_WATER;return 0;}},citizens:[],nature:{tiles:new Set()},walkable(){return true;},findPath(){return [];}};
 city.citizens=Array.from({length:8},(_,i)=>({id:i+1,task:null,entity:{x:18.5,y:20.5}}));
 const furniture=new CityFurniture(city);
 for(const citizen of city.citizens)assert.equal(furniture.routeBeach(citizen),true);
 const spots=city.citizens.map(c=>c.beachLeisure).filter(Boolean);
 assert.equal(spots.length,city.citizens.length);
 for(let i=0;i<spots.length;i++)for(let j=i+1;j<spots.length;j++)assert.ok(Math.hypot(spots[i].x-spots[j].x,spots[i].y-spots[j].y)>=1.15);
});
