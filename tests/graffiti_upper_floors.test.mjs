import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {upperGraffitiSurfaces,upperGraffitiSurfaceCandidates} from '../js/city_graffiti_access.js';
import {fitGraffitiToWall,graffitiSurfaceExists} from '../js/city_graffiti_surfaces.js';
import {syncCitizenInterior,advanceCitizenInterior} from '../js/city_interiors.js?v=citizen-access-1';

function fixture(){
 const unit={id:10,buildingId:9,x:0,y:0,z:1,roomType:'circulation',hasWindow:true};
 const building={id:9,ownerId:99,accountId:99,width:3,depth:3,floors:3,door:{x:5.5,y:7.5},entity:{x:4,y:4,properties:{name:'Prédio'}},units:[unit],circulation:[],terrain:{base:0}};
 for(let z=0;z<3;z++)for(let y=0;y<3;y++)for(let x=0;x<3;x++)if(!(x===0&&y===0&&z===1))building.circulation.push({x,y,z});
 const c={id:1,accountId:1,task:'leisure',entity:{x:5.5,y:7.5,properties:{name:'Artista'}},traits:{honesty:.1,riskTolerance:.8},skills:{artistic:20},path:[],needs:{}};
 let nextId=1;const records=[];
 const city={minute:1440,hour:22,buildings:[building],citizens:[c],units:new Map([[unit.id,unit]]),world:{width:16,height:16,getTile:()=>8},building:id=>id===9?building:null,walkable:()=>true,findPath:()=>[],urgentNeed:()=>false,random:()=>.05,society:{isAdult:()=>true,citizen:()=>c},currency:{price:n=>n},createEntity:data=>({...data,id:nextId++}),log:()=>({id:nextId++}),gigs:{jobs:[]},accountName:()=>null};
 city.justice=new CityJustice(city);city.justice.crimeRecord=(type,actor,victim,details)=>{const record={id:nextId++,type,details};records.push(record);return record;};
 return {city,c,building,unit,records};
}

test('upper wall search preserves candidate order and stops before unused buildings',()=>{
 const {city,c}=fixture(),expected=upperGraffitiSurfaces(city,c);
 assert.deepEqual([...upperGraffitiSurfaceCandidates(city,c)],expected);
 city.buildings.push({get entity(){throw Error('unused building inspected');}});
 const candidates=upperGraffitiSurfaceCandidates(city,c);
 assert.deepEqual(candidates.next().value,expected[0]);
 candidates.return();
});

test('upper walls retain floor height and window clearance, and disappear when their floor is removed',()=>{
 const {city,c,building}=fixture(),surfaces=upperGraffitiSurfaces(city,c);
 assert(surfaces.length);const support=surfaces.find(s=>s.side===0);
 assert.equal(support.floor,1);assert.equal(support.height,.42);assert.equal(support.position.z,2.05);
 assert.equal(graffitiSurfaceExists(city,support),true);fitGraffitiToWall(city,support);assert.equal(support.position.z,2.05);
 building.units[0].hasWindow=false;fitGraffitiToWall(city,support);assert.equal(support.height,1.64);assert.equal(support.position.z,2.7);
 building.floors=1;assert.equal(graffitiSurfaceExists(city,support),false);
});

for(const kind of ['graffiti','painting'])test(`${kind} requires walking upstairs before painting and then leaves through the door`,()=>{
 const {city,c,records}=fixture();assert.equal(city.justice.considerAutonomousGraffiti(c),true);
 const mission=c.graffitiMission;assert(mission.surface.accessPoint);mission.artKind=kind;c.path=[];
 city.justice.updateGraffitiMission(c);assert(c.indoorLocation.path.length);assert.equal(mission.completeAt,null);
 assert.equal(records.filter(r=>r.type==='trespass').length,1);
 syncCitizenInterior(city,c);assert.equal(c.indoorLocation.exiting,undefined);
 city.justice.updateGraffitiMission(c);assert.equal(city.justice.art.length,0);
 advanceCitizenInterior(city,c,100);assert.equal(c.indoorLocation.floor,1);
 city.justice.updateGraffitiMission(c);assert(mission.completeAt>city.minute);
 city.minute=mission.completeAt;city.justice.updateGraffitiMission(c);
 assert.equal(city.justice.art.length,1);assert.equal(city.justice.art[0].kind,kind);assert(city.justice.art[0].support.position.z>1.8);
 assert.equal(records.filter(r=>r.type==='graffiti').length,1);assert.equal(c.graffitiMission,null);
 syncCitizenInterior(city,c);assert.equal(c.indoorLocation.exiting,true);
 advanceCitizenInterior(city,c,100);assert.equal(c.indoorLocation,null);
});

test('residents can access their own building without an invasion record',()=>{
 const {city,c,records}=fixture();c.homeUnitId=10;city.justice.considerAutonomousGraffiti(c);c.path=[];city.justice.updateGraffitiMission(c);
 assert(c.indoorLocation);assert.equal(records.filter(r=>r.type==='trespass').length,0);
});

test('interruption upstairs cancels painting and preserves the physical exit route',()=>{
 const {city,c}=fixture();city.justice.considerAutonomousGraffiti(c);c.path=[];city.justice.updateGraffitiMission(c);
 advanceCitizenInterior(city,c,100);city.urgentNeed=()=> 'energy';city.justice.updateGraffitiMission(c);
 assert.equal(c.graffitiMission,null);assert.equal(city.justice.art.length,0);
 syncCitizenInterior(city,c);assert.equal(c.indoorLocation.exiting,true);
 advanceCitizenInterior(city,c,100);assert.equal(c.indoorLocation,null);
});

test('single-floor buildings provide no upper targets',()=>{
 const {city,c,building}=fixture();building.floors=1;building.units=[];
 assert.deepEqual(upperGraffitiSurfaces(city,c),[]);
});
