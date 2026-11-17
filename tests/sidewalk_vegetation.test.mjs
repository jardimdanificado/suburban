import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../js/world.js';
import {CityDevelopment} from '../js/city_development.js';
import {CityNature} from '../js/city_nature.js';

test('road completion clears sidewalk shrubs, preserves trees and respects occupied tiles',()=>{
 const world=Object.assign(Object.create(World.prototype),{width:12,height:12,map:new Uint8Array(144),revision:0,sidewalkTiles:new Set(),sidewalkTreeTiles:new Set()});
 const city={world,minute:0,structureRevision:0,occupied:new Set(['5,4']),lighting:{sites:new Map()},walkable:()=>true,
  economy:{consumed:{pedra:0},recordGoods(){}},reputation:{completed(){}},building:()=>null,transfer(){},accounts:new Map(),history:{record(){}},workMeals:{closeSite(){}},log(){}};
 city.nature=new CityNature(city);
 const add=(id,x,y,tree)=>{const plant={id,x,y,species:tree?'coconut_palm':'cubensis',entity:{properties:{tree,render:{}}}};city.nature.plants.set(id,plant);city.nature.tiles.set(`${x},${y}`,id);return plant;};
 const shrub=add(1,3,4,false),tree=add(2,4,4,true),blocked=add(3,5,4,false),outside=add(4,3,3,false);
 const dev=new CityDevelopment(city);dev.roadAccessTiles=()=>[];dev.roadPlotBlocked=()=>false;
 const project={service:'road',route:[3,4,5].map(x=>({x,y:5})),inventory:{pedra:3},stone:3,labor:3,requiredLabor:3};
 assert.equal(dev.completeService(project),project);
 assert.equal(project.status,'completed');
 assert.equal(shrub.entity.destroyed,true);
 assert.equal(city.nature.tiles.has('3,4'),false);
 assert.equal(world.hasSidewalk(3,4),true);
 assert.equal(city.nature.plants.has(tree.id),true);
 assert.equal(world.hasSidewalk(4,4),true);
 assert.equal(world.sidewalkTreeTiles.has(4*world.width+4),true);
 assert.equal(world.hasSidewalk(5,4),false);
 assert.equal(city.nature.plants.has(blocked.id),true);
 assert.equal(city.nature.plants.has(outside.id),true);
 assert.equal(city.nature.lost,1);
});
