import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';

test('founding community includes compatible couples, generations, siblings and single parents',()=>{
 const city=setup({starter:true,population:64}),society=city.society;
 assert.equal(city.citizens.length,64);
 const couples=city.citizens.filter(c=>c.partnerId&&c.id<c.partnerId);
 assert(couples.some(c=>c.socialProfile.gender===society.citizen(c.partnerId).socialProfile.gender));
 assert(couples.some(c=>c.socialProfile.gender!==society.citizen(c.partnerId).socialProfile.gender));
 assert(city.citizens.some(c=>c.parentIds.length===1&&!society.isAdult(c)));
 const grandchild=city.citizens.find(c=>c.parentIds.some(id=>society.citizen(id).parentIds.length));
 assert(grandchild);
 const parent=society.citizen(grandchild.parentIds.find(id=>society.citizen(id).parentIds.length));
 const grandparent=society.citizen(parent.parentIds[0]);
 assert.equal(society.getRelation(grandchild,grandparent).views[grandchild.id].kinship,'relative');
 assert(society.getRelation(grandchild,grandparent).contexts.includes('family'));
 assert([...society.relations.values()].some(r=>Object.values(r.views).some(v=>v.kinship==='sibling')));
 assert([...society.relations.values()].some(r=>r.status==='rival'));
 assert([...society.relations.values()].some(r=>r.status==='close'&&!r.related));
 for(const person of city.citizens){
  if(person.partnerId){
   const partner=society.citizen(person.partnerId);
   assert.equal(partner.partnerId,person.id);
   assert(city.relationships.compatible(person,partner));
   assert.equal(society.getRelation(person,partner).views[person.id].romance,'partner');
   assert(society.getRelation(person,partner).partnerSince<city.minute);
  }
  for(const id of person.parentIds){
   const parent=society.citizen(id);
   assert(parent.childIds.includes(person.id));
   assert(society.age(parent)-society.age(person)>=18);
   assert(person.surnames.includes(parent.surnames.at(-1)));
  }
  if(!society.isAdult(person)){
   assert(society.isAdult(society.guardian(person)));
   assert(city.childrenOf(person.guardianId).includes(person));
   assert.equal(person.entity.properties.render.size,society.age(person)<6?.55:.8);
  }
 }
});

test('small and partial founding populations retain valid references and exact population',()=>{
 for(const population of [1,2,5,8,11,12,17]){
  const city=setup({starter:true,population});
  assert.equal(city.citizens.length,population);
  for(const person of city.citizens){
   for(const id of person.parentIds)assert(city.society.citizen(id));
   if(person.partnerId)assert.equal(city.society.citizen(person.partnerId).partnerId,person.id);
  }
 }
});

test('initial arrivals keep children at or below one tenth of the population',()=>{
 for(const population of [8,11,12,17,24,40,41,64,81]){
  const city=setup({starter:true,population});
  const children=city.citizens.filter(person=>!city.society.isAdult(person));
  assert(children.length<=Math.floor(population/10),`${children.length} children among ${population} residents`);
  for(const child of children)assert(city.society.isAdult(city.society.guardian(child)));
 }
});

test('founding genealogy is deterministic and survives state transfer',async()=>{
 const {CityStateGraph,bindCityState}=await import('../js/city_state.js');
 const first=setup({starter:true,population:48}),second=setup({starter:true,population:48});
 const describe=city=>city.citizens.map(c=>({id:c.id,age:c.initialAge,parents:c.parentIds,children:c.childIds,partner:c.partnerId,guardian:c.guardianId,profile:c.socialProfile}));
 assert.deepEqual(describe(first),describe(second));
 const restored=new CityStateGraph().apply(new CityStateGraph().encode({city:first})).city;
 bindCityState(restored);
 assert.deepEqual(describe(restored),describe(first));
 for(const person of restored.citizens){
  if(person.partnerId)assert.equal(restored.society.getRelation(person,restored.society.citizen(person.partnerId)).status,'partner');
  if(!restored.society.isAdult(person))assert(restored.childrenOf(person.guardianId).some(c=>c.id===person.id));
 }
});
