import {gerarFraseTematica} from '../js/gerador_frases.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {nearbyGraffitiSurfaces,graffitiSurfaceVertices,graffitiSurfaceExists,graffitiCameraFocus,fitGraffitiToWall,graffitiWallHasWindow} from '../js/city_graffiti_surfaces.js';
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
  const support=citizen.graffitiMission.surface;assert.equal(support.kind,'street-graffiti');assert.equal(citizen.graffitiMission.completeAt,null);assert.equal(citizen.graffitiMission.message,gerarFraseTematica(['cidade'],{random:()=>.05,complexidade:'simples'}));
  citizen.entity.x=support.approach.x;citizen.entity.y=support.approach.y;citizen.path=[];
  justice.updateGraffitiMission(citizen);assert(citizen.graffitiMission.completeAt>city.minute);
  city.minute=citizen.graffitiMission.completeAt;
  assert.equal(justice.updateGraffitiMission(citizen),true);const tag=justice.art[0];
  assert.equal(tag.layers.length,1);assert.equal(tag.layers[0].creatorId,1);assert.equal(tag.layers[0].caseId,7);assert.equal(citizen.lastGraffitiAt,city.minute);assert.equal(tag.support.kind,'street-graffiti');assert.equal(tag.scene.buildingId,null);assert.equal(piece.layers.length,0);
  assert.equal(justice.considerAutonomousGraffiti(citizen),false);
});

test('failed chance retries after one hour, without a week-long lockout',()=>{
  const {city,justice,citizen,piece}=fixture();city.random=()=>.5;
  assert.equal(justice.considerAutonomousGraffiti(citizen,piece),false);city.random=()=>.05;city.minute+=59;
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
  const records=[],headings=[],selected=[],cameras=[];
  const panel=new Proxy({heading:title=>headings.push(title),record:(...args)=>records.push(args)},{get:(target,key)=>target[key]||(()=>{})});
  renderUrbanArt({city,view:()=> 'overview',matches:()=>true,camera:(...args)=>cameras.push(args),host:{setSelection:entity=>selected.push(entity)}},panel);
  assert(headings.includes('PICHAÇÕES'));const tag=records.find(([title,description])=>title.startsWith('Pichação · Artista')&&description.includes('Meu pixo'));
  assert(tag);assert.match(tag[1],/Prédio/);tag[2]();assert.equal(selected[0],piece.entity);assert.deepEqual(cameras[0].slice(0,2),[piece.entity.x,piece.entity.y]);
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


test('street graffiti location zooms in and faces the painted side, including saved rotations',()=>{
  for(const surface of ['wall','retaining','ground']){
    const {city,piece}=fixture(),rotation=Math.PI;
    piece.kind='graffiti';piece.support={kind:'street-graffiti',surface,rotation};piece.layers=[{id:1,creatorId:1,message:'Meu pixo',minute:1440}];
    const records=[],actions=[],panel=new Proxy({record:(...args)=>records.push(args)},{get:(target,key)=>target[key]||(()=>{})});
    renderUrbanArt({city,view:()=> 'overview',matches:()=>true,camera:(...args)=>actions.push(['camera',...args]),host:{setSelection:()=>actions.push(['selection'])}},panel);
    records.find(([title])=>title.startsWith('Pichação · Artista'))[2]();
    assert.deepEqual(actions[0],['camera',piece.entity.x,piece.entity.y,{zoom:8,...(surface!=='ground'?{yaw:rotation}:{})}]);assert.equal(actions[1][0],'selection');
  }
  assert.equal(graffitiCameraFocus({kind:'facade-banner'}),undefined);
});

test('fecal protest missions also generate their text through the vocabulary grammar',()=>{
  const {city,justice,citizen}=fixture();citizen.homeUnitId=null;citizen.needs={food:20,health:90,safety:90,social:90};
  city.buildings[0].door={x:4.5,y:3.5};city.buildings[0].municipal=true;
  city.sanitation={streetFeces:new Map([['2,1',{amount:1,jobId:null}]])};
  city.gigs.frontagePoint=()=>({x:4.5,y:3.5});city.politics={parties:[]};city.economy={businesses:[]};
  assert(justice.considerFecesGraffiti());
  const expected=gerarFraseTematica(['cidade','moradia','alimentacao','politica'],{random:()=>.05,complexidade:'simples'});
  assert.equal(citizen.graffitiMission.message,`${expected} · Prefeitura`);
});

test('wall graffiti fills solid walls and clears only actual ground-floor windows',()=>{
 const {city,citizen,justice}=fixture();const building=city.buildings[0];building.terrain={base:1.16};building.door=null;building.type='townhall';
 building.units=[{id:1,x:0,y:0,z:0,hasWindow:true},{id:2,x:1,y:0,z:0,hasWindow:true},{id:3,x:0,y:1,z:0,hasWindow:true},{id:4,x:1,y:1,z:0,hasWindow:true}];
 const wall=nearbyGraffitiSurfaces(city,{entity:{x:5,y:5}},8).filter(s=>s.surface==='wall');
 assert.deepEqual(new Set(wall.map(s=>s.side)),new Set([0,1,2,3]));
 for(const support of wall){
  assert(support.position.z-support.height/2>building.terrain.base);
  if(graffitiWallHasWindow(building,support))assert(support.position.z+support.height/2<building.terrain.base+.49,'paint must stay below the window frame');
  else assert.equal(support.height,1.64,'solid walls use the whole ground-floor height');
 }
 assert(wall.some(s=>graffitiWallHasWindow(building,s)));assert(wall.some(s=>!graffitiWallHasWindow(building,s)));
 const support=wall.find(s=>graffitiWallHasWindow(building,s));support.position.z=building.terrain.base+.65;support.height=.65;
 const piece={entity:{destroyed:false},support};justice.art=[piece];const revision=justice.artRevision;
 justice.updateStreetGraffitiSupports();assert.equal(piece.entity.destroyed,false);
 assert(support.position.z+support.height/2<building.terrain.base+.49);
 assert.equal(justice.artRevision,revision+1);assert.equal(fitGraffitiToWall(city,support),false);
 for(const unit of building.units)unit.hasWindow=false;
 assert(fitGraffitiToWall(city,support));assert.equal(support.height,1.64);
});

test('moderate-risk citizens can paint by day and repeat after a day, but not while busy',()=>{
 const {city,justice,citizen}=fixture();citizen.traits={honesty:.3,riskTolerance:.55};citizen.skills.artistic=5;
 city.hour=12;city.random=()=>.1;citizen.lastGraffitiAt=city.minute-1439;
 assert.equal(justice.considerAutonomousGraffiti(citizen),false);city.minute++;
 assert.equal(justice.considerAutonomousGraffiti(citizen),true);
 citizen.graffitiMission=null;citizen.task='work';city.minute+=60;
 assert.equal(justice.considerAutonomousGraffiti(citizen),false);
});

test('political graffiti carries its named target, party and known scandal through painting',()=>{
 const {city,justice,citizen}=fixture();justice.art=[];
 const target={id:9,entity:{properties:{name:'Prefeito Fulano'}},political:{partyId:2}};
 city.society.citizen=id=>id===9?target:id===citizen.id?citizen:null;
 city.politics={parties:[{id:2,active:true,short:'PCC',number:45}]};
 citizen.political={memories:[{kind:'proven-scandal',candidateId:9,partyId:2,caseId:17}]};
 assert.equal(justice.considerAutonomousGraffiti(citizen),true);
 assert.match(citizen.graffitiMission.message,/Fulano: ladrão · PCC 45/);
 const support=citizen.graffitiMission.surface;citizen.entity.x=support.approach.x;citizen.entity.y=support.approach.y;citizen.path=[];
 justice.updateGraffitiMission(citizen);city.minute=citizen.graffitiMission.completeAt;
 justice.updateGraffitiMission(citizen);const art=justice.art[0];
 assert.equal(art.subjectId,9);assert.equal(art.partyId,2);assert.equal(art.corruptionCaseId,17);
 assert.equal(art.politicalKind,'corruption');assert.equal(art.layers[0].message,art.message);
});

test('a blocked approach does not destroy paint while its physical wall remains',()=>{
 const {city,justice}=fixture();const support=nearbyGraffitiSurfaces(city,{entity:{x:4.5,y:3.5}}).find(s=>s.surface==='wall');
 const piece={entity:{destroyed:false},support};justice.art=[piece];
 city.buildings.push({id:20,entity:{x:Math.floor(support.approach.x),y:Math.floor(support.approach.y)},width:1,depth:1});
 justice.updateStreetGraffitiSupports();assert.equal(piece.entity.destroyed,false);
 city.buildings[0].entity.destroyed=true;justice.updateStreetGraffitiSupports();assert.equal(piece.entity.destroyed,true);
});

test('destroyed catalogue entries cannot move the camera',()=>{
 const {city,piece}=fixture();piece.entity.destroyed=true;piece.damageHistory=[];city.justice.labelArt=()=> 'uma pichação';
 const records=[],camera=[],panel=new Proxy({record:(...args)=>records.push(args)},{get:(target,key)=>target[key]||(()=>{})});
 renderUrbanArt({city,view:()=> 'damage',matches:()=>true,camera:(...args)=>camera.push(args),host:{setSelection:()=>{}}},panel);
 const row=records.find(([title])=>title.includes(piece.message));assert(row);row[2]?.();assert.deepEqual(camera,[]);
});
