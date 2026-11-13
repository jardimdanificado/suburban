import test from 'node:test';
import assert from 'node:assert/strict';
import {cardboardFootprint,syncCardboardGrass} from '../js/cardboard_grass.js';
test('cardboard cutout matches the seeded rotated bedding dimensions',()=>{
 for(let citizenId=1;citizenId<32;citizenId++){
  const site={x:10.5,y:20.5,citizenId},box=cardboardFootprint(site),seed=Math.imul(citizenId+31,2654435761)>>>0;
  assert.equal(box.x,site.x+((seed>>>12)%3-1)*.12);
  assert.equal(box.z,site.y+((seed>>>14)%3-1)*.12);
  const rotated=((seed>>>16)%4)%2;
  assert(Math.abs(box.maxX-box.minX-(rotated?.50:.68))<1e-10);
  assert(Math.abs(box.maxZ-box.minZ-(rotated?.68:.50))<1e-10);
 }
});
test('cutouts update when a shelter is removed and include newly built grass',()=>{
 const site={x:10.5,y:10.5,citizenId:5},box=cardboardFootprint(site);
 const roots={count:2,getX:i=>i?9:box.x,getZ:i=>i?9:box.z};
 const geometry={attributes:{grassRoot:roots},getAttribute(key){return this.attributes[key];},setAttribute(key,value){this.attributes[key]=value;},deleteAttribute(key){delete this.attributes[key];}};
 const renderer={terrainChunks:new Map([['0',{terrain:{children:[{geometry}]}}]])},city={cardboardRevision:1,cardboardShelters:new Map([['bed',site]])};
 const THREE={InstancedBufferAttribute:class{constructor(array,size){this.array=array;this.itemSize=size;}}};
 syncCardboardGrass(renderer,THREE,city);
 const values=geometry.attributes.grassShelter.array;
 assert.deepEqual([...values.slice(0,4)],[box.minX,box.minZ,box.maxX,box.maxZ].map(Math.fround));
 assert.deepEqual([...values.slice(4)],[0,0,0,0]);
 city.cardboardShelters.clear();city.cardboardRevision++;
 syncCardboardGrass(renderer,THREE,city);assert.equal(geometry.attributes.grassShelter,undefined);
});

test('no beds and distant beds never scan grass roots or allocate a cutout',()=>{
 let reads=0,allocations=0;
 const roots={count:147456,getX(){reads++;return 0;},getZ(){reads++;return 0;}};
 const geometry={boundingBox:{min:{x:0,z:0},max:{x:16,z:16}},getAttribute:key=>key==='grassRoot'?roots:null,setAttribute(){allocations++;}};
 const renderer={terrainChunks:new Map([['local',{terrain:{children:[{geometry}]}}]])};
 const city={cardboardRevision:0,cardboardShelters:new Map()};
 syncCardboardGrass(renderer,{},city);assert.equal(reads,0);assert.equal(allocations,0);
 city.cardboardShelters.set('remote',{x:100,y:100,citizenId:3});city.cardboardRevision++;
 syncCardboardGrass(renderer,{},city);assert.equal(reads,0);assert.equal(allocations,0);
});
test('a changed distant shelter keeps the local mask buffer and avoids rescanning',()=>{
 let reads=0;
 const roots={count:1,getX(){reads++;return 10.5;},getZ(){reads++;return 10.5;}};
 const geometry={boundingBox:{min:{x:0,z:0},max:{x:16,z:16}},attributes:{grassRoot:roots},getAttribute(key){return this.attributes[key];},setAttribute(key,v){this.attributes[key]=v;}};
 const renderer={terrainChunks:new Map([['local',{terrain:{children:[{geometry}]}}]])};
 const city={cardboardRevision:0,cardboardShelters:new Map([['local',{x:10.5,y:10.5,citizenId:5}]])};
 const THREE={InstancedBufferAttribute:class{constructor(array){this.array=array;}}};
 syncCardboardGrass(renderer,THREE,city);const before=geometry.attributes.grassShelter;
 assert.equal(reads,2);
 syncCardboardGrass(renderer,THREE,city);assert.equal(reads,2);
 city.cardboardShelters.set('remote',{x:100,y:100,citizenId:3});city.cardboardRevision++;
 syncCardboardGrass(renderer,THREE,city);assert.equal(reads,2);assert.equal(geometry.attributes.grassShelter,before);
});
