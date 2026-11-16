import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {nearbyGraffitiSurfaces,graffitiSurfaceVertices,graffitiSurfaceExists} from '../js/city_graffiti_surfaces.js';
import {CityStateGraph} from '../js/city_state.js';
import {setup} from './helpers/city.mjs';
import {renderUrbanArt} from '../js/city_justice_ui.js';

function fixture(){
  const citizen={id:1,jobId:9,businessIds:[9],task:'leisure',entity:{x:2.5,y:1.5,properties:{name:'Artista'}},traits:{honesty:.1,riskTolerance:.8},skills:{artistic:20},path:[]};
  const piece={id:1,kind:'painting',message:'Original',creatorId:2,entity:{x:2.5,y:2.5},buildingId:9,support:{kind:'facade-banner',buildingId:9},layers:[],createdAt:0};
  const building={id:9,width:2,depth:2,door:{x:5.5,y:6.5},entity:{x:4,y:4,properties:{name:'Prédio'}}};
  let nextId=1;const city={minute:1440,hour:22,buildings:[building],world:{width:16,height:16,getTile:()=>0},createEntity:data=>({...data,id:nextId++}),citizens:[citizen],society:{isAdult:()=>true,citizen:id=>id===1?citizen:null},building:id=>id===9?building:null,walkable:()=>true,findPath:()=>[],urgentNeed:()=>false,random:()=>.05,log:()=>({id:1}),currency:{price:n=>n},gigs:{jobs:[]},accountName:()=>null};
  const justice=new CityJustice(city);city.justice=justice;justice.art.push(piece);justice.crimeRecord=()=>({id:7});return {city,justice,citizen,piece};
}

test('off-duty citizens paint a real surface without reading or defacing an artwork',()=>{
  const {city,justice,citizen,piece}=fixture();justice.art=[];
  assert.equal(justice.considerAutonomousGraffiti(citizen),true);
  const support=citizen.graffitiMission.surface;assert.equal(support.kind,'street-graffiti');assert.equal(citizen.graffitiMission.completeAt,null);
  citizen.entity.x=support.approach.x;citizen.entity.y=support.approach.y;citizen.path=[];
  justice.updateGraffitiMission(citizen);assert(citizen.graffitiMission.completeAt>city.minute);
  city.minute=citizen.graffitiMission.completeAt;
  assert.equal(justice.updateGraffitiMission(citizen),true);const tag=justice.art[0];
  assert.equal(tag.layers.length,1);assert.equal(tag.layers[0].creatorId,1);assert.equal(tag.layers[0].caseId,7);assert.equal(citizen.lastGraffitiAt,city.minute);assert.equal(tag.support.kind,'street-graffiti');assert.equal(tag.scene.buildingId,null);assert.equal(piece.layers.length,0);
  assert.equal(justice.considerAutonomousGraffiti(citizen),false);
});

test('failed chance retries after four hours, without a week-long lockout',()=>{
  const {city,justice,citizen,piece}=fixture();city.random=()=>.5;
  assert.equal(justice.considerAutonomousGraffiti(citizen,piece),false);city.random=()=>.05;city.minute+=239;
  assert.equal(justice.considerAutonomousGraffiti(citizen,piece),false);city.minute++;
  assert.equal(justice.considerAutonomousGraffiti(citizen,piece),true);
});

test('on-duty work, indoor activity and urgent needs still prevent street graffiti',()=>{
  for(const change of [f=>f.citizen.indoorLocation={buildingId:9},f=>f.citizen.task='work',f=>f.city.urgentNeed=()=>true]){
    const f=fixture();change(f);assert.equal(f.justice.considerAutonomousGraffiti(f.citizen,f.piece),false);
  }
});

test('graffiti catalogue shows overlay author and locates the tagged artwork',()=>{
  const {city,justice,piece}=fixture();piece.layers=[{id:1,kind:'graffiti',creatorId:1,message:'Meu pixo',minute:1440}];
  const records=[],headings=[],selected=[];
  const panel=new Proxy({heading:title=>headings.push(title),record:(...args)=>records.push(args)},{get:(target,key)=>target[key]||(()=>{})});
  renderUrbanArt({city,view:()=> 'overview',matches:()=>true,host:{setSelection:entity=>selected.push(entity)}},panel);
  assert(headings.includes('PICHAÇÕES'));const tag=records.find(([title,description])=>title.startsWith('Pichação · Artista')&&description.includes('Meu pixo'));
  assert(tag);assert.match(tag[1],/Prédio/);tag[2]();assert.equal(selected[0],piece.entity);
});


test('ground, wall and retaining candidates use reachable standing points',()=>{
  const {city,citizen}=fixture();citizen.entity={x:4.5,y:3.5};
  const surfaces=nearbyGraffitiSurfaces(city,citizen);assert(surfaces.some(s=>s.surface==='wall'));assert(surfaces.some(s=>s.surface==='ground'));
  city.world.getTile=(x,y)=>x>=7?9:x===6?8:0;citizen.entity={x:5.5,y:2.5};
  const retaining=nearbyGraffitiSurfaces(city,citizen).filter(s=>s.surface==='retaining');assert(retaining.length,'real road height difference must expose a paintable retaining face');
  for(const support of retaining)assert(graffitiSurfaceExists(city,support));
  city.walkable=()=>false;assert.deepEqual(nearbyGraffitiSurfaces(city,citizen),[]);
});

test('ground paint follows terrain and cannot spawn on a blocked or already tagged cell',()=>{
  const {city,citizen,justice}=fixture();city.buildings=[];
  const support=nearbyGraffitiSurfaces(city,citizen)[0];assert.equal(support.surface,'ground');
  const vertices=graffitiSurfaceVertices(city.world,support);assert.equal(vertices.length,12);assert(vertices.every(Number.isFinite));
  justice.art.push({entity:{},support});assert(!nearbyGraffitiSurfaces(city,citizen).some(s=>s.key===support.key));
  city.findPath=()=>null;assert.equal(justice.considerAutonomousGraffiti(citizen),false);assert.equal(citizen.graffitiMission,undefined);
});

test('removing the target wall interrupts painting without creating an artwork',()=>{
  const {city,justice,citizen}=fixture();citizen.entity={x:4.5,y:3.5};justice.art=[];
  assert(justice.considerAutonomousGraffiti(citizen));assert.equal(citizen.graffitiMission.surface.surface,'wall');
  city.buildings[0].entity.destroyed=true;assert.equal(justice.updateGraffitiMission(citizen),false);assert.equal(justice.art.length,0);assert.equal(citizen.graffitiMission,null);
});

test('city minute loop considers graffiti without any pre-existing artworks',()=>{
  const city=setup({starter:true,population:8}),seen=[];assert.equal(city.justice.art.length,0);
  city.justice.considerAutonomousGraffiti=c=>seen.push(c.id);city.minute=1440;city.justice.updateMinute();assert.deepEqual(seen,city.citizens.map(c=>c.id));
});

test('surface missions and paint survive graph serialization with ownership and position',()=>{
  const {city,justice,citizen}=fixture();justice.art=[];assert(justice.considerAutonomousGraffiti(citizen));
  const sender=new CityStateGraph(),receiver=new CityStateGraph(),copy=receiver.apply(sender.encode({city}));
  assert.deepEqual(copy.city.citizens[0].graffitiMission,citizen.graffitiMission);assert.equal(copy.city.citizens[0].graffitiMission.artId,undefined);
});

test('cleaning the last surface layer removes paint rather than revealing its duplicate base message',()=>{
  const {city,justice,citizen}=fixture();justice.art=[];assert(justice.considerAutonomousGraffiti(citizen));
  const support=citizen.graffitiMission.surface;Object.assign(citizen.entity,support.approach);citizen.path=[];justice.updateGraffitiMission(citizen);city.minute=citizen.graffitiMission.completeAt;justice.updateGraffitiMission(citizen);
  const piece=justice.art[0],job={id:4,status:'completed',completedBy:1,artId:piece.id,layerId:piece.layers[0].id,fee:500,payerAccountId:'treasury'};
  assert(justice.finishArtworkCleaning(job));assert.equal(piece.entity.destroyed,true);assert.equal(piece.layers.length,0);assert.equal(piece.removedLayers.length,1);assert.equal(piece.debris,undefined);assert.equal(piece.cleanedAt,city.minute);
});


test('surfaces occupied by art or another graffiti mission are not targets',()=>{
  const {city,justice,citizen}=fixture();city.buildings=[];justice.art=[];
  const support=nearbyGraffitiSurfaces(city,citizen)[0];city.citizens.push({graffitiMission:{surface:support}});
  assert(!nearbyGraffitiSurfaces(city,citizen).some(s=>s.key===support.key));city.citizens.pop();
  justice.art.push({entity:{x:support.position.x,y:support.position.y},layers:[]});
  assert(!nearbyGraffitiSurfaces(city,citizen).some(s=>s.key===support.key));
});
