import test from 'node:test';
import assert from 'node:assert/strict';
import {boatFlagIdentity,syncBoatFlags,boatFlagRotation} from '../js/boat_flags.js';
const flag=name=>({name});
function fixture(id){
 const owner={id:1,accountId:'person:1',political:{partyId:7}},party={active:true,flag:flag(`party-${id}`)},boat={ownerAccountId:owner.accountId};
 const city={id,worldPort:{cityId:id},municipalIdentity:{flag:flag(id)},citizens:[owner],vehicles:{units:new Map([[9,boat]])},politics:{party:n=>n===7?party:null}};
 return {city,owner,party,boat};
}
test('boat uses city flag and party of its owner, without requiring a driver',()=>{
 const {city,boat,party}=fixture('a');
 assert.deepEqual(boatFlagIdentity(city,null,boat),{cityFlag:city.municipalIdentity.flag,partyFlag:party.flag});
});
test('unaffiliated owners, municipal boats and closed parties have no party flag',()=>{
 const {city,boat,owner,party}=fixture('a');
 owner.political.partyId=null;assert.equal(boatFlagIdentity(city,null,boat).partyFlag,null);
 owner.political.partyId=7;party.active=false;assert.equal(boatFlagIdentity(city,null,boat).partyFlag,null);
 assert.equal(boatFlagIdentity(city,null,{ownerAccountId:'port:a'}).partyFlag,null);
});
test('visiting vessels retain home nationality and home owner affiliation',()=>{
 const a=fixture('a'),b=fixture('b'),coordinator={cities:new Map([['a',{city:a.city}],['b',{city:b.city}]])};
 assert.deepEqual(boatFlagIdentity(b.city,coordinator,{homeCityId:'a',localVehicleId:9}),{cityFlag:a.city.municipalIdentity.flag,partyFlag:a.party.flag});
 assert.deepEqual(boatFlagIdentity(b.city,coordinator,{homeCityId:'missing',localVehicleId:9}),{cityFlag:null,partyFlag:null});
});
test('ownership transfer, disaffiliation and flag edits are reflected immediately',()=>{
 const {city,boat,owner}=fixture('a');
 boat.ownerAccountId='person:2';assert.equal(boatFlagIdentity(city,null,boat).partyFlag,null);
 boat.ownerAccountId=owner.accountId;owner.political.partyId=null;
 city.municipalIdentity.flag=flag('new');assert.deepEqual(boatFlagIdentity(city,null,boat),{cityFlag:flag('new'),partyFlag:null});
});

test('both boat flags keep the municipal flag direction through every heading',()=>{
 const {city,boat}=fixture('a'),attachment={x:0,y:.28,z:-.5};
 const flags={rotation:{y:0},position:attachment,children:[]};
 const group={rotation:{y:0},userData:{flagVessel:boat,boatFlags:flags,boatFlagKey:JSON.stringify(boatFlagIdentity(city,null,boat))}};
 for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2,5.7]){
  group.rotation.y=heading;syncBoatFlags({}, {},city,group);
  const worldAngle=heading+flags.rotation.y;
  // Townhall cloth extends toward world -X, not +X.
  assert(Math.abs(Math.cos(worldAngle)+1)<1e-12);
  assert(Math.abs(Math.sin(worldAngle))<1e-12);
  assert.equal(flags.position,attachment);
 }
});


test('moving flags trail actual travel in every direction regardless of hull heading',()=>{
 for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1]])for(const heading of [0,Math.PI/2,Math.PI,5.7]){
  const group={position:{x:0,z:0},rotation:{y:heading},userData:{}};
  boatFlagRotation(group,0);group.position.x=dx;group.position.z=dz;
  const angle=heading+boatFlagRotation(group,.1),length=Math.hypot(dx,dz);
  assert(Math.abs(Math.cos(angle)+dx/length)<1e-12);
  assert(Math.abs(-Math.sin(angle)+dz/length)<1e-12);
  assert.equal(boatFlagRotation(group,.3),angle-heading,'retain direction between worker snapshots');
  const stopped=heading+boatFlagRotation(group,1);
  assert(Math.abs(Math.cos(stopped)+1)<1e-12);
  assert(Math.abs(Math.sin(stopped))<1e-12);
 }
});

test('turning a stopped hull and wave bobbing preserve the municipal flag direction',()=>{
 const group={position:{x:0,y:0,z:0},rotation:{y:0},userData:{}};
 boatFlagRotation(group,0);group.rotation.y=1.2;group.position.y=1;
 const angle=group.rotation.y+boatFlagRotation(group,.1);
 assert(Math.abs(Math.cos(angle)+1)<1e-12);
});
