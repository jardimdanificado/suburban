import test from 'node:test';
import assert from 'node:assert/strict';
import {CityRelationships} from '../js/city_relationships.js';

test('relationship contexts preserve label order, refresh changed memberships and retain unchanged snapshots',()=>{
 const buildings=[{door:{x:0,y:0}},{door:{x:7,y:0}}];
 const city={units:new Map([[1,{buildingId:0}],[2,{buildingId:1}]]),building:id=>buildings[id],society:{related:()=>false}};
 const relationships=new CityRelationships(city),a={id:1,parentIds:[],homeUnitId:1,homeId:1,jobId:10},b={id:2,parentIds:[],homeUnitId:2};
 const relation={contexts:Object.freeze([])};
 for(const mask of [...Array(16).keys(),0]){
  const previous=relation.contexts;
  a.parentIds=mask&1?[2]:[];b.jobId=mask&2?10:null;b.homeId=mask&4?1:2;buildings[1].door.x=mask&8?8:9;
  const expected=['family','coworkers','household','neighbors'].filter((label,index)=>mask&(1<<index));
  relationships.context(relation,a,b);
  assert.deepEqual(relation.contexts,expected);
  assert.ok(Object.isFrozen(relation.contexts));
  if(previous.join('|')!==expected.join('|'))assert.notEqual(relation.contexts,previous);
  const snapshot=relation.contexts;
  relationships.context(relation,a,b);
  assert.equal(relation.contexts,snapshot,'unchanged contexts retain their snapshot');
 }
 b.homeUnitId=1;buildings[1].door.x=1;
 relation.contexts=Object.freeze(['neighbors']);
 relationships.context(relation,a,b);
 assert.deepEqual(relation.contexts,[],'the same building is not a neighboring home');
});

test('daily relationship decay applies each observer’s own forgiveness and updates both views',()=>{
 const people=[.25,.75].map((forgiveness,index)=>({id:index+1,parentIds:[],socialProfile:{forgiveness},social:{grief:[{until:1},{until:10000}],beliefs:[{heardAt:0},{heardAt:-20*1440}]}}));
 const makeView=()=>({affection:20,trust:10,respect:0,resentment:5,fear:1,status:'known',romance:'none',attraction:0});
 const relation={a:1,b:2,lastContact:0,views:{1:makeView(),2:makeView()},contexts:Object.freeze([])};
 const city={minute:5000,citizens:people,units:new Map(),building:()=>undefined,society:{relations:new Map([[1,relation]]),citizen:id=>people.find(c=>c.id===id),related:()=>false},log(){assert.fail('these unchanged bonds must not emit status events');}};
 new CityRelationships(city).daily();
 for(const person of people){
  const view=relation.views[person.id];
  assert.equal(view.affection,19);assert.equal(view.trust,9.5);assert.equal(view.fear,.5);
  assert.equal(view.resentment,5-person.socialProfile.forgiveness*.8);
  assert.deepEqual(person.social.grief,[{until:10000}]);assert.deepEqual(person.social.beliefs,[{heardAt:0}]);
 }
 assert.equal(relation.revision,1);assert.equal(relation.affection,19);assert.equal(relation.trust,9.5);
});
