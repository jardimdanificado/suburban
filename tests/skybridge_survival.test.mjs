import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {advanceCitizenInterior} from '../js/city_interiors.js';

function fixture(){
 const city=setup({starter:true,population:64}),link=city.skybridgeLinksForRevision().find(link=>link.gap>1);assert(link,'the settlement has a real elevated link');
 const c=city.citizens.find(c=>!city.politics.officeHolder(c)),other=city.citizens.find(p=>p!==c&&!city.politics.officeHolder(p));
 for(const p of [c,other]){p.conversation=null;p.path=[];p.task='walk';p.indoorLocation=null;for(const k in p.needs)p.needs[k]=95;}
 const b=city.building(link.aId);c.entity.x=b.door.x;c.entity.y=b.door.y;
 assert(city.beginSkybridgeTransit(c,{buildingId:link.aId,unitId:link.auId,linkId:link.id,endpoint:'start',phase:'entry'}));
 advanceCitizenInterior(city,c,100);city.finishSkybridgeTransit(c);assert.equal(c.skybridgeTransit.phase,'crossing');
 return {city,c,other,link};
}

test('a pedestrian cannot start a conversation or board a vehicle during a skybridge crossing',()=>{
 const {city,c,other}=fixture();other.entity.x=c.entity.x+1;other.entity.y=c.entity.y;c.path=[{x:c.entity.x+1,y:c.entity.y},{x:c.entity.x+2,y:c.entity.y},{x:c.entity.x+3,y:c.entity.y}];
 assert.equal(city.society.canSocialize(c),false);assert.equal(city.society.startConversation(c,other),false);assert.equal(c.path.length,3);
 city.vehicles.activeCount=1;c.lastVehicleSearchAt=-Infinity;city.vehicles.tryTrip(c);assert.equal(c.lastVehicleSearchAt,-Infinity);
});

for(const endpoint of ['start','end'])test(`a saved crossing with no remaining route walks to the ${endpoint} exit and returns to essential decisions`,()=>{
 const {city,c,other,link}=fixture(),point=link[endpoint];
 c.entity.x=point.x+(endpoint==='start'?.1:-.1);c.entity.y=point.y;c.path=[];c.task=null;
 const conversation={a:c.id,b:other.id,until:city.minute+1000};c.conversation=other.conversation=conversation;
 const position={x:c.entity.x,y:c.entity.y},needs={...c.needs};
 city.finishSkybridgeTransit(c);
 assert.deepEqual({x:c.entity.x,y:c.entity.y},position,'repair schedules movement without teleporting');assert.deepEqual(c.needs,needs);
 assert.equal(c.conversation,null);assert.equal(other.conversation,null);assert.equal(c.path.at(-1).skybridgeExit.endpoint,endpoint);
 for(let i=0;i<60&&c.skybridgeTransit;i++)city.update(.25);
 assert.equal(c.skybridgeTransit,null);assert.equal(c.skybridgeZ,0);assert.equal(c.skybridgeId,null);assert(!c.entity.destroyed);
 assert.notEqual(city.findPath(c.entity,city.buildings.find(b=>b.type==='townhall').door),null);
});

test('an intact skybridge crossing keeps its planned exit',()=>{
 const {city,c,link}=fixture();const path=[{...link.end,z:link.height,skybridgeId:link.id},{...link.end,z:link.height,skybridgeExit:{buildingId:link.bId,unitId:link.buId,linkId:link.id,endpoint:'end'}}];c.path=path;
 city.finishSkybridgeTransit(c);assert.equal(c.path,path);assert.equal(c.skybridgeTransit.phase,'crossing');
});

test('a critically ill resident stranded on a skybridge can leave it and receive care before terminal deprivation',()=>{
 const {city,c}=fixture();c.task=null;c.path=[];c.needs.health=0;c.deprivation={food:0,water:0,health:10};
 for(let i=0;i<100&&!c.entity.destroyed;i++)city.update(.25);
 assert(!c.entity.destroyed);assert.equal(c.skybridgeTransit,null);assert(c.needs.health>20);assert.equal(c.deprivation.health,0);
});
