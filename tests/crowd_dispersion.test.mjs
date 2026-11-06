import test from 'node:test';
import assert from 'node:assert/strict';
import {disperseCrowds} from '../js/city_interiors.js';
const person=(id,x=10.5,y=10.5)=>({id,entity:{x,y,destroyed:false},path:[],task:null});
const city=people=>({citizens:people,minute:0,world:{width:128,height:128},urgentNeed:()=>null,walkable:()=>true,findPath:(_from,to)=>[to]});
test('crowd exits preserve deterministic search order and reserve the destinations of travelers',()=>{
 const people=[person(1),person(2),person(3),person(4,1.5,1.5)];people[3].path=[{x:11.5,y:11.5}];
 disperseCrowds(city(people));
 assert.deepEqual(people.slice(0,3).map(c=>c.path.at(-1)),[{x:11.5,y:9.5},{x:9.5,y:9.5},{x:12.5,y:10.5}]);
 assert.ok(people.slice(0,3).every(c=>c.task==='walk'));
 assert.deepEqual(people[3].path,[{x:11.5,y:11.5}]);
});
test('outside-map tiles do not alias inside tiles and singleton residents do not disperse',()=>{
 const people=[person(1,-.5,1.5),person(2,-.5,1.5),person(3,7.5,.5)];const c=city(people);c.world={width:8,height:8};
 disperseCrowds(c);assert.ok(people.every(p=>!p.path.length));
});
test('busy and urgent residents stay put, while the pass respects its 32-route budget',()=>{
 const people=Array.from({length:40},(_,i)=>person(i+1));people[0].task='energy';people[1].conversation={};
 const c=city(people);c.urgentNeed=p=>p.id===3?'water':null;disperseCrowds(c);
 assert.ok(people.slice(0,3).every(p=>!p.path.length));assert.equal(people.filter(p=>p.path.length).length,32);
 assert.equal(new Set(people.filter(p=>p.path.length).map(p=>JSON.stringify(p.path.at(-1)))).size,32);
});
