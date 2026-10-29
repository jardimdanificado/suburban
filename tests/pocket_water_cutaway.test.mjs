import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,finishActivityRoute,totalMoney} from './helpers/city.mjs';
import {pocket,POCKET_RULES} from '../js/city_supplies.js';
import {CityWater,waterIndex,waterTint} from '../js/city_water.js';
import {applyInteriorCutaway} from '../js/city_interior_view.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
import {CITY_FLOOR_HEIGHT} from '../js/city_building_geometry.js';
function fixture(){const city=setup({starter:true,population:48}),c=city.citizens.find(c=>!city.politics.officeHolder(c)&&!c.businessIds.length),b=city.buildings.find(b=>b.type==='popular_refectory');city.economy.leaveJob(c);c.provisions=0;c.pocket={food:[],water:0,waterContamination:0,receivedMeals:0,receivedWater:0};c.indoorLocation=null;c.conversation=null;for(const n in c.needs)c.needs[n]=95;return {city,c,b};}
test('a public food basket moves real goods into pockets; only eating consumes them',()=>{
 const {city,c,b}=fixture(),p=pocket(c),stock=city.goodsStock('pao'),consumed=city.economy.consumed.pao,money=totalMoney(city),bread=b.inventory.pao;c.task='supplies';c.targetId=b.id;c.path=[];c.entity.x=b.door.x;c.entity.y=b.door.y;
 finishActivityRoute(city,c);city.performTask(c);assert.equal(p.food.length,POCKET_RULES.foodCapacity);assert.equal(p.water,POCKET_RULES.waterCapacity);assert.equal(b.inventory.pao,bread-12);assert.equal(city.goodsStock('pao'),stock);assert.equal(city.economy.consumed.pao,consumed);assert.equal(totalMoney(city),money);assert.equal(city.supplies.basketsDistributed,1);
 c.indoorLocation=null;c.needs.food=40;c.needs.water=40;city.supplies.useCarried(c);assert(c.needs.food>60);assert(c.needs.water>65);assert.equal(p.food.length,3);assert.equal(p.water,5);assert.equal(city.economy.consumed.pao,consumed+3);assert.equal(city.goodsStock('pao'),stock-3);
});
test('stock depletion triggers replenishment while a person is still well fed and hydrated',()=>{
 const {city,c}=fixture();c.provisions=1;pocket(c).water=1;assert(city.supplies.route(c));assert.equal(c.task,'supplies');assert.equal(c.needs.food,95);assert.equal(c.needs.water,95);
});
test('a dining room improves a carried meal but standing outdoors does not prevent eating',()=>{
 const {city,c}=fixture(),meal={good:'pao',inputs:{pao:3},quality:1};pocket(c).food=[{...meal}];c.needs.food=40;city.supplies.useCarried(c);const standing=c.lastMealQuality;assert(c.needs.food>40);
 pocket(c).food=[{...meal}];c.needs.food=40;c.indoorLocation={roomType:'dining'};city.supplies.useCarried(c);assert(c.lastMealQuality>standing);
});
test('only the lack of a safe supplier sends a thirsty person to a real shoreline, where dirty water harms health',()=>{
 const {city,c}=fixture();for(const b of city.buildings)b.active=false;city.world.setTile(5,5,2);c.entity.x=7.5;c.entity.y=5.5;c.provisions=3;c.needs.water=5;city.sanitation.streetFeces.set('6,5',{amount:30});city.water.hourly();
 assert(city.supplies.route(c));assert.equal(c.task,'lake-water');const point=c.lakeCollection.point;c.entity.x=point.x;c.entity.y=point.y;c.path=[];const health=c.needs.health;city.supplies.collectLake(c);assert(c.needs.water>5);assert(c.needs.health<health);assert(pocket(c).waterContamination>0);assert.equal(city.world.getTile(Math.floor(c.entity.x),Math.floor(c.entity.y))===2,false);
});
test('connected lake volume dilutes equal pollutant loads and drives visible tint',()=>{
 const width=24,height=16,map=new Uint8Array(width*height);map[2*width+2]=2;for(let y=8;y<12;y++)for(let x=12;x<16;x++)map[y*width+x]=2;
 const world={width,height,map},city={world,sanitation:{streetFeces:new Map()},buildings:[]},water=new CityWater(city);water.reconcile();assert.equal(waterIndex(world).bodies.length,2);for(const b of water.bodies)b.pollutants=500;water.hourly();assert(water.bodies[0].pollution>water.bodies[1].pollution*10);assert.notDeepEqual(waterTint(water.bodies[0].pollution),waterTint(0));assert(world.waterPollutionRevision>0);
});
test('carried meals, water quality and basin pollution survive the simulation worker snapshot',()=>{
 const {city,c}=fixture();pocket(c).food=[{good:'pao',inputs:{pao:3},quality:1}];pocket(c).water=2;pocket(c).waterContamination=24;city.world.setTile(5,5,2);city.water.reconcile();city.water.bodies[0].pollutants=50;city.water.hourly();
 const writer=new CityStateGraph(),reader=new CityStateGraph(),copy=reader.apply(writer.encode({city})).city;bindCityState(copy);assert.equal(pocket(copy.society.citizen(c.id)).waterContamination,24);assert.equal(copy.supplies.carriedGoods('pao'),3);assert.equal(copy.world.waterBodies[0].pollution,city.water.bodies[0].pollution);assert.equal(typeof copy.water.nearestShore,'function');
});
class Matrix{constructor(y=0){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,y,0,1];}copy(m){this.elements=[...m.elements];return this;}scale(v){this.elements[0]*=v.x;this.elements[5]*=v.y;this.elements[10]*=v.z;return this;}}
class Vector{constructor(x,y,z){Object.assign(this,{x,y,z});}}
const instanced=levels=>({userData:{interiorFloors:levels,interiorBaseMatrices:levels.map(z=>new Matrix(z*CITY_FLOOR_HEIGHT+CITY_FLOOR_HEIGHT/2))},instanceMatrix:{},values:[],setMatrixAt(i,m){this.values[i]=[...m.elements];}});
test('cutaway lowers selected walls, completely hides other floors and restores the full facade',()=>{
 const walls=instanced([0,1,2]),floors=instanced([0,1,2]),group={userData:{cellMeshes:[walls],interiorFloors:floors,roof:{visible:true},facade:{visible:true},interiorCeilings:{visible:true},roomProps:{children:[0,1,2].map(z=>({userData:{interiorFloor:z}}))}}},THREE={Matrix4:Matrix,Vector3:Vector};
 applyInteriorCutaway(THREE,group,1);assert.equal(walls.values[1][5],.16);assert.equal(walls.values[1][13],CITY_FLOOR_HEIGHT+CITY_FLOOR_HEIGHT*.08);assert.equal(walls.values[2][0],0);assert.equal(floors.values[2][0],0);assert.equal(group.userData.roof.visible,false);assert.deepEqual(group.userData.roomProps.children.map(p=>p.visible),[false,true,false]);
 applyInteriorCutaway(THREE,group,null);assert.equal(walls.values[1][5],1);assert.equal(floors.values[2][0],1);assert.equal(group.userData.roof.visible,true);assert.equal(group.userData.interiorCeilings.visible,true);
});

test('clearing a desktop selection also clears the inspecting dossier cutaway state',async()=>{
 const {CityDesktop}=await import('../js/city_desktop.js');let cleared=0;const state={selectedProjectId:8,interiorView:{buildingId:11,floor:2},setInteriorView(value){this.interiorView=value;cleared++;}},desktop={manager:{windows:[{state}]},lastSelected:{id:11}};
 CityDesktop.prototype.setSelection.call(desktop,null);assert.equal(state.interiorView,null);assert.equal(desktop.lastSelected,null);assert.equal(cleared,1);
});
