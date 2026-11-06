import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySanitation} from '../js/city_sanitation.js';
import {CityHousing} from '../js/city_housing.js';
import {CitySociety} from '../js/city_society.js';
import {CityRelationships} from '../js/city_relationships.js';

function fixture(){
 const host={id:1,homeId:'host-home',entity:{destroyed:false}},guest={id:2,homeId:null,accountId:'citizen:2',entity:{x:0,y:0,destroyed:false},needs:{toilet:50,hygiene:50},path:[]};
 const site={id:1,type:'residential',active:true,door:{x:1,y:1}},unit={id:'bath',roomType:'bathroom',ownerId:'citizen:1'};
 const city={minute:600,citizens:[host,guest],accounts:new Map(),units:new Map([[unit.id,unit]]),building:id=>id===1?site:null,findPath:()=>[],payerFor:c=>c.accountId};
 city.housing=new CityHousing(city);city.housing.homes.set('host-home',{id:'host-home'});
 city.society=new CitySociety(city);city.relationships=new CityRelationships(city);
 city.sanitation=new CitySanitation(city);city.sanitation.addFacility(site,{unitId:unit.id,homeId:'host-home',access:'home'});
 const relation={id:'1:2',a:1,b:2,views:{1:{affection:0,trust:0,resentment:0},2:{affection:90,trust:90,resentment:0}}};
 city.society.relations.set(relation.id,relation);city.society.contactIndex.set(1,new Set([relation.id]));city.society.contactIndex.set(2,new Set([relation.id]));
 return{city,host,guest,relation};
}

test('facility searches use the host view and refresh access after a relationship changes in the same minute',()=>{
 const {city,guest,relation}=fixture();
 assert.equal(city.sanitation.choose(guest),false); // Guest likes host; host does not reciprocate.
 Object.assign(relation.views[1],{affection:65,trust:50,resentment:29});
 assert.equal(city.sanitation.choose(guest,'hygiene'),true);assert.equal(guest.hygieneTargetId,'toilet:bath');
 relation.views[1].resentment=30;
 assert.equal(city.sanitation.choose(guest),false);
 relation.views[1].resentment=0;city.society.forgetRelation(relation);
 assert.equal(city.sanitation.choose(guest),false);
});

test('a friend moving out removes visitor access, while an empty owned bathroom remains usable',()=>{
 const {city,host,guest,relation}=fixture();Object.assign(relation.views[1],{affection:80,trust:80});
 assert.equal(city.sanitation.choose(guest),true);
 host.homeId=null;city.housing.invalidateResidents();assert.equal(city.sanitation.choose(guest),false);
 city.units.get('bath').ownerId=guest.accountId;assert.equal(city.sanitation.choose(guest),true);
});
