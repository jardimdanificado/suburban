import {gerarFraseTematica} from '../js/gerador_frases.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {nearbyGraffitiSurfaces,graffitiSurfaceVertices,graffitiSurfaceExists,graffitiCameraFocus,fitGraffitiToWall,graffitiWallHasWindow} from '../js/city_graffiti_surfaces.js';
import {upperGraffitiSurfaces} from '../js/city_graffiti_access.js';
import {CityStateGraph} from '../js/city_state.js';
import {setup} from './helpers/city.mjs';
import {renderUrbanArt} from '../js/city_justice_ui.js';

function fixture(){
  const citizen={id:1,jobId:9,businessIds:[9],task:'leisure',entity:{x:2.5,y:1.5,properties:{name:'Artista'}},traits:{honesty:.1,riskTolerance:.8},skills:{artistic:20},path:[]};
  const piece={id:1,kind:'painting',message:'Original',creatorId:2,entity:{x:2.5,y:2.5},buildingId:9,support:{kind:'facade-banner',buildingId:9},layers:[],createdAt:0};
  const building={id:9,width:2,depth:2,door:{x:5.5,y:6.5},entity:{x:4,y:4,properties:{name:'Prédio'}}};
  let nextId=1;const city={minute:1440,hour:22,buildings:[building],world:{width:16,height:16,getTile:()=>8},createEntity:data=>({...data,id:nextId++}),citizens:[citizen],society:{isAdult:()=>true,citizen:id=>id===1?citizen:null},building:id=>id===9?building:null,walkable:()=>true,findPath:()=>[],urgentNeed:()=>false,random:()=>.05,log:()=>({id:1}),currency:{price:n=>n},gigs:{jobs:[]},accountName:()=>null};
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

test('wall graffiti fills solid walls and excludes windows, balconies and doors',()=>{
 const {city}=fixture();const building=city.buildings[0];building.terrain={base:1.16};building.door={x:4.5,y:3.5};building.type='townhall';
 building.units=[{id:1,x:0,y:0,z:0,hasWindow:true},{id:2,x:1,y:0,z:0,hasWindow:false},{id:3,x:0,y:1,z:0,hasWindow:false},{id:4,x:1,y:1,z:0,hasWindow:false}];
 const wall=nearbyGraffitiSurfaces(city,{entity:{x:5,y:5}},8).filter(s=>s.surface==='wall');
 assert.ok(wall.length>0);
 for(const support of wall){
  assert(support.position.z-support.height/2>building.terrain.base);
  assert.equal(graffitiWallHasWindow(building,support),false,'windowed walls must be excluded');
  assert.equal(support.height,1.64,'solid walls use the whole ground-floor height');
  assert.ok(Math.hypot(support.approach.x-building.door.x,support.approach.y-building.door.y)>=1.05,'doorway walls must be excluded');
 }
});

test('wide wall graffiti spans two tiles only when both wall bands match',()=>{
 const {city,citizen,justice}=fixture(),building=city.buildings[0];
 building.terrain={base:1.16};building.door=null;building.type='townhall';
 building.units=[{id:1,x:0,y:0,z:0,hasWindow:false},{id:2,x:1,y:0,z:0,hasWindow:false},{id:3,x:0,y:1,z:0,hasWindow:false},{id:4,x:1,y:1,z:0,hasWindow:false}];
 justice.art=[];
 const wide=nearbyGraffitiSurfaces(city,{entity:{x:5,y:5}},8).filter(s=>s.surface==='wall'&&s.width>1);
 assert.equal(wide.length,4,'each 2-tile facade exposes one merged wall');
 for(const support of wide){
  assert.equal(support.width,1.72);assert.equal(support.unitIds.length,2);assert.equal(support.height,1.64);
  assert.equal(graffitiSurfaceExists(city,support),true);
  const vertices=graffitiSurfaceVertices(city.world,support);
  assert.ok(Math.abs(Math.hypot(vertices[3]-vertices[0],vertices[5]-vertices[2])-support.width)<1e-6,'wide paint covers the requested width');
 }
 building.units[0].hasWindow=true;
 const updated=nearbyGraffitiSurfaces(city,{entity:{x:5,y:5}},8).filter(s=>s.surface==='wall'&&s.width>1);
 assert(!updated.some(s=>s.unitIds?.includes(1)&&s.unitIds?.includes(2)),'a windowed tile cannot merge with a solid neighbour');
 for(const support of updated){
  const bands=support.unitIds.map(id=>graffitiWallHasWindow(building,{unitIds:[id],side:support.side,floor:support.floor??0}));
  assert.ok(bands.every(Boolean)||bands.every(value=>!value),'only wall bands with the same height merge');
 }
});

test('citizens prefer a wide wall when both tiles share the same height',()=>{
 const {city,citizen,justice}=fixture(),building=city.buildings[0];
 building.terrain={base:1.16};building.door=null;building.type='townhall';
 building.units=[{id:1,x:0,y:0,z:0,hasWindow:false},{id:2,x:1,y:0,z:0,hasWindow:false},{id:3,x:0,y:1,z:0,hasWindow:false},{id:4,x:1,y:1,z:0,hasWindow:false}];
 justice.art=[];citizen.entity={x:4.5,y:3.5};citizen.path=[];
 assert.equal(justice.considerAutonomousGraffiti(citizen),true);
 const support=citizen.graffitiMission.surface;
 assert.equal(support.surface,'wall');assert(support.width>1,'the wide wall wins over its single tiles');assert.equal(support.unitIds.length,2);
});

test('a wide wall blocks overlapping single-tile targets for other painters',()=>{
 const {city,citizen,justice}=fixture(),building=city.buildings[0];
 building.terrain={base:1.16};building.door=null;building.type='townhall';
 building.units=[{id:1,x:0,y:0,z:0,hasWindow:false},{id:2,x:1,y:0,z:0,hasWindow:false},{id:3,x:0,y:1,z:0,hasWindow:false},{id:4,x:1,y:1,z:0,hasWindow:false}];
 justice.art=[];citizen.entity={x:5,y:5};
 const wide=nearbyGraffitiSurfaces(city,citizen,8).find(s=>s.surface==='wall'&&s.width>1);
 city.citizens.push({graffitiMission:{surface:wide}});
 const surfaces=nearbyGraffitiSurfaces(city,citizen,8).filter(s=>s.surface==='wall'&&s.side===wide.side);
 assert(!surfaces.some(s=>Math.hypot(s.position.x-wide.position.x,s.position.y-wide.position.y)<(s.width+wide.width)/2-.01),'no painter takes a slice of the wide wall');
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

test('an artist with prejudice paints a hateful slur against a matching nearby victim',()=>{
 const {city,citizen,justice}=fixture();justice.art=[];
 const target={id:2,skinColor:0x241a12,gender:'f',entity:{x:2.5,y:2.5,destroyed:false,properties:{name:'Vizinha'}},needs:{}};
 city.citizens.push(target);
 citizen.prejudices={racismo:{target:'pele-escura',strength:.9}};citizen.prejudiceProfileVersion=1;
 assert.equal(justice.considerAutonomousGraffiti(citizen),true);
 const mission=citizen.graffitiMission;
 assert.equal(mission.prejudiceType,'racismo');assert.equal(mission.subjectId,2);assert.match(mission.message,/VIZINHA/);
 const support=mission.surface;citizen.entity.x=support.approach.x;citizen.entity.y=support.approach.y;citizen.path=[];
 justice.updateGraffitiMission(citizen);city.minute=mission.completeAt;
 assert.equal(justice.updateGraffitiMission(citizen),true);
 const art=justice.art[0];
 assert.equal(art.subjectId,2);assert.equal(art.prejudiceType,'racismo');assert(art.hateCaseId!=null);
});

test('hateful graffiti records the prejudice crime alongside the graffiti case',()=>{
  const {city,justice}=fixture(),calls=[];
  justice.crimeRecord=(type,offenderId,victimId,details)=>{const record={id:101+calls.length,evidence:[],details:{}};justice.cases.push(record);calls.push({type,offenderId,victimId,details});return record;};
  const layer=justice.defaceArtwork(1,1,'texto',{prejudiceType:'racismo'});
  assert.equal(layer.caseId,101);assert.equal(layer.hateCaseId,102);
  assert.equal(justice.art[0].prejudiceType,'racismo');assert.equal(justice.art[0].hateCaseId,102);
  assert.equal(justice.caseRecord(101).details.hateCaseId,102);assert.equal(justice.caseRecord(101).details.prejudiceType,'racismo');
  assert(justice.caseRecord(101).evidence.some(item=>item.kind==='hate-graffiti'&&item.artId===1&&item.graffitiCaseId===101));
  assert(justice.caseRecord(102).evidence.some(item=>item.kind==='hate-graffiti'&&item.artId===1&&item.graffitiCaseId===101));
  assert(calls.some(call=>call.type==='racismo'&&call.details.discriminatoryAct===true&&call.details.prejudiceType==='racismo'&&call.details.graffitiCaseId===101));
});

test('targeted hate graffiti enters the prejudice incident flow',()=>{
  const {city,justice,citizen,piece}=fixture(),calls=[];
  piece.subjectId=citizen.id;
  justice.recordPrejudiceAct=(actor,target,type,strength,witnessIds,options)=>{calls.push({actor,target,type,strength,witnessIds,options});return {id:5,crimeCaseId:77};};
  justice.cases.push({id:77,evidence:[],details:{}});
  const record=justice.recordHateGraffiti(piece,citizen,{prejudiceType:'racismo',message:'texto'});
  assert.equal(record.id,77);assert.equal(piece.hateCaseId,77);assert.equal(piece.hateIncidentId,5);
  assert.equal(calls.length,1);assert.equal(calls[0].target,citizen);assert.equal(calls[0].type,'racismo');
  assert.equal(calls[0].options.ignoreCooldown,true);assert.equal(calls[0].options.evidence.kind,'hate-graffiti');
  assert(record.evidence.some(item=>item.kind==='hate-graffiti'&&item.artId===1));
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

test('large paved lots expose 4x4 and 7x9 floor pieces and reject a hole in the rectangle',()=>{
 const world={width:32,height:32,getTile:()=>8};
 const city={world,buildings:[],citizens:[],justice:{art:[]},walkable:()=>true,random:()=>.1};
 const citizen={entity:{x:12.5,y:12.5}};
 const surfaces=nearbyGraffitiSurfaces(city,citizen,4).filter(s=>s.surface==='ground');
 for(const [w,h] of [[4,4],[7,9]]){
  const support=surfaces.find(s=>s.tileWidth===w&&s.tileHeight===h);
  assert(support,`${w}x${h} ground rectangle must be offered`);
  assert.equal(support.width,.86*w);assert.equal(support.height,.86*h);assert.equal(graffitiSurfaceExists(city,support),true);
 }
 const mural=surfaces.find(s=>s.tileWidth===7&&s.tileHeight===9);
 world.getTile=(x,y)=>x===12&&y===12?0:8;
 assert.equal(graffitiSurfaceExists(city,mural),false,'one unpaved tile invalidates the whole mural');
});

test('wide walls keep growing past four tiles while every band matches',()=>{
 const building={id:9,width:6,depth:2,door:null,terrain:{base:1.16},entity:{x:4,y:4,properties:{name:'Prédio'}},floors:1,units:[]};
 for(let y=0;y<2;y++)for(let x=0;x<6;x++)building.units.push({id:y*6+x+1,x,y,z:0,hasWindow:false});
 const city={world:{width:32,height:32,getTile:()=>8},buildings:[building],citizens:[],justice:{art:[]},walkable:()=>true,random:()=>.1,building:id=>id===9?building:null};
 const wall=nearbyGraffitiSurfaces(city,{entity:{x:7,y:2.5}},8).filter(s=>s.surface==='wall');
 assert(wall.some(s=>s.side===0&&s.tileWidth===6&&Math.abs(s.width-.86*6)<1e-6),'a six-tile facade must expose one six-tile wall');
 assert(wall.some(s=>s.side===0&&s.tileWidth===4),'four-tile wall must remain available');
 assert(wall.every(s=>graffitiSurfaceExists(city,s)));
});

test('upper facades merge adjacent rooms and consecutive solid floors into rectangles',()=>{
 const building={id:9,ownerId:99,accountId:99,width:3,depth:3,floors:4,door:{x:5.5,y:7.5},entity:{x:4,y:4,properties:{name:'Prédio'}},units:[],circulation:[],terrain:{base:0}};
 let id=10;
 for(let z=1;z<=2;z++)for(const [x,y] of [[0,0],[1,0]])building.units.push({id:id++,buildingId:9,x,y,z,roomType:'living',hasWindow:false});
 for(let z=0;z<3;z++)for(let y=0;y<3;y++)for(let x=0;x<3;x++){
  if(z<=2&&y===0&&x<2)continue;
  building.circulation.push({x,y,z});
 }
 const c={id:1,accountId:1,task:'leisure',entity:{x:5.5,y:7.5,properties:{name:'Artista'}},traits:{honesty:.1,riskTolerance:.8},skills:{artistic:20},path:[],needs:{}};
 const city={minute:1440,hour:22,buildings:[building],citizens:[c],units:new Map(building.units.map(unit=>[unit.id,unit])),world:{width:32,height:32,getTile:()=>8},building:id=>id===9?building:null,walkable:()=>true,findPath:()=>[],urgentNeed:()=>false,random:()=>.05,society:{isAdult:()=>true,citizen:()=>c},currency:{price:n=>n},createEntity:data=>({...data,id:id++}),log:()=>({id:id++}),gigs:{jobs:[]},accountName:()=>null,justice:{art:[]}};
 const merged=upperGraffitiSurfaces(city,c,8).find(s=>s.side===0&&s.tileWidth===2&&s.tileHeight===2);
 assert(merged,'two rooms on two solid floors must merge');
 assert.equal(merged.width,1.72);assert.equal(Math.round(merged.height*100)/100,3.44);assert.equal(graffitiSurfaceExists(city,merged),true);
});

test('a large graffiti message survives the artwork creation limit',()=>{
 const {city,justice}=fixture(),support={kind:'street-graffiti',surface:'ground',tileX:0,tileY:0,tileWidth:7,tileHeight:9,width:.86*7,height:.86*9,position:{x:5,y:5,z:0},approach:{x:5,y:5}};
 const message='A cidade inteira cobra a obra prometida. '.repeat(8).trim();
 assert(message.length>180);
 const piece=justice.createArtwork({kind:'graffiti',message,creatorId:1,x:5,y:5,support});
 assert.equal(piece.message,message,'large surfaces keep the full text');
});

test('ground graffiti requires a paved road, excluding grass, dirt roads and unpaved sidewalk',()=>{
 const {city,citizen}=fixture();city.buildings=[];
 for(const tile of [0,1,3,6,7,9]){
  city.world.getTile=()=>tile;city.world.hasSidewalk=()=>true;
  assert(!nearbyGraffitiSurfaces(city,citizen).some(s=>s.surface==='ground'),`tile ${tile} must not allow floor paint`);
 }
 city.world.getTile=()=>8;const support=nearbyGraffitiSurfaces(city,citizen).find(s=>s.surface==='ground');assert(support);
 city.world.getTile=()=>0;assert.equal(graffitiSurfaceExists(city,support),false);
});

test('commissioned outdoor paintings use a real wall and complete through the outdoor worker route',()=>{
 const city=setup({starter:true,funded:true,population:8}),b=city.buildings.find(b=>b.active&&b.constructionKind!=='open-air'&&b.municipal&&b.units?.length);
 const job=city.gigs.createArtworkOrder('treasury',b.id,{kind:'painting',message:'Mural',supportKind:'exterior-wall'});
 assert(job);assert.equal(job.artworkSupport,null);assert.equal(job.artworkFacadeSupport.surface,'wall');assert.equal(job.scope,'outdoor');
 const artist=city.citizens[0];artist.needs={food:100,energy:100,health:100,water:100};artist.entity.x=job.point.x;artist.entity.y=job.point.y;artist.path=[];
 city.gigs.candidates=()=>[artist];city.gigs.consumeArtworkMaterial=()=>true;city.urgentNeed=()=>false;
 city.minute=600+job.id%3;job.required=.1;city.gigs.updateMinute();
 assert.equal(job.status,'completed');const art=city.justice.art.find(a=>a.id===job.artworkId);assert(art);
 assert.equal(art.kind,'painting');assert.equal(art.support.surface,'wall');
 assert.equal(art.entity.x,art.support.position.x);assert.equal(art.entity.y,art.support.position.y);assert.equal(art.scene.buildingId,null);
});

test('spontaneous paintings can be created directly on nearby walls',()=>{
 const city=setup({starter:true,population:8}),b=city.buildings.find(b=>b.active&&b.constructionKind!=='open-air'&&b.units?.length),artist=city.citizens[0];
 city.minute=660;city.random=()=>.12;city.urgentNeed=()=>false;city.justice.art=[];
 Object.assign(artist,{task:'leisure',path:[],graffitiMission:null});artist.skills.artistic=100;artist.needs.energy=100;artist.needs.health=100;
 artist.entity.x=b.entity.x+.5;artist.entity.y=b.entity.y-.5;
 const art=city.gigs.postSpontaneousArtwork();assert(art);assert.equal(art.kind,'painting');assert.equal(art.support.surface,'wall');assert.equal(art.buildingId,b.id);
 assert.equal(art.entity.x,art.support.position.x);assert.equal(art.entity.y,art.support.position.y);
});
