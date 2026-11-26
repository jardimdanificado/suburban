import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {upperGraffitiSurfaces,upperGraffitiSurfaceCandidates} from '../js/city_graffiti_access.js';
import {fitGraffitiToWall,graffitiSurfaceExists} from '../js/city_graffiti_surfaces.js';

function fixture(){
 const unit={id:10,buildingId:9,x:0,y:0,z:1,roomType:'circulation',hasWindow:false};
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

test('upper walls retain floor height, exclude windows/balconies, and disappear when their floor is removed',()=>{
 const {city,c,building}=fixture(),surfaces=upperGraffitiSurfaces(city,c);
 assert(surfaces.length);const support=surfaces.find(s=>s.side===0);
 assert.equal(support.floor,1);assert.equal(support.height,1.64);assert.equal(support.position.z,2.7);
 assert.equal(graffitiSurfaceExists(city,support),true);fitGraffitiToWall(city,support);assert.equal(support.position.z,2.7);
 building.units[0].hasWindow=true;
 assert.equal(upperGraffitiSurfaces(city,c).some(s=>s.side===0),false,'windowed upper wall must be excluded');
 assert.equal(graffitiSurfaceExists(city,support),false);
 building.units[0].hasWindow=false;
 building.floors=1;assert.equal(graffitiSurfaceExists(city,support),false);
});

test('upper walls are offered even without an interior stair route',()=>{
 const {city,c,building}=fixture();building.circulation=[];
 assert(upperGraffitiSurfaces(city,c).length,'climbing the exterior must not require an interior route');
});

for(const kind of ['graffiti','painting'])test(`${kind} requires climbing the facade before painting and then climbing down`,()=>{
 const {city,c,records}=fixture();assert.equal(city.justice.considerAutonomousGraffiti(c),true);
 const mission=c.graffitiMission;assert(mission.surface.accessPoint);mission.artKind=kind;
 // Walk the first leg to the wall base; the climb begins once the path empties.
 for(let guard=0;guard<20&&!c.climbing;guard++){
  city.justice.updateGraffitiMission(c);
  if(c.climbing)break;
  assert(c.path.length,'upper mission must route to the wall base');
  const last=c.path.at(-1);c.entity.x=last.x;c.entity.y=last.y;c.path=[];city.minute++;
 }
 assert(c.climbing,'the painter must start climbing the wall');
 assert.equal(c.indoorLocation,undefined);
 assert.equal(records.filter(r=>r.type==='trespass').length,0);
 for(let guard=0;guard<80&&!city.justice.art.length;guard++){
  city.justice.updateGraffitiMission(c);
  if(mission.completeAt!=null)city.minute=mission.completeAt;
  else city.minute++;
 }
 assert.equal(city.justice.art.length,1);assert.equal(city.justice.art[0].kind,kind);assert(city.justice.art[0].support.position.z>1.8);
 assert.equal(records.filter(r=>r.type==='graffiti').length,1);
 for(let guard=0;guard<40&&c.climbing;guard++){city.minute++;city.justice.updateGraffitiMission(c);}
 assert.equal(c.climbing,null);assert.equal(c.skybridgeZ,0);assert.equal(c.graffitiMission,null);
});

test('residents climb their own facade without an invasion record',()=>{
 const {city,c,records}=fixture();c.homeUnitId=10;assert.equal(city.justice.considerAutonomousGraffiti(c),true);
 for(let guard=0;guard<20&&!c.climbing;guard++){
  city.justice.updateGraffitiMission(c);
  if(c.climbing)break;
  const last=c.path.at(-1);c.entity.x=last.x;c.entity.y=last.y;c.path=[];city.minute++;
 }
 assert(c.climbing);assert.equal(c.indoorLocation,undefined);assert.equal(records.filter(r=>r.type==='trespass').length,0);
});

test('interruption during the climb cancels painting and clears the elevation',()=>{
 const {city,c}=fixture();assert.equal(city.justice.considerAutonomousGraffiti(c),true);
 for(let guard=0;guard<20&&!c.climbing;guard++){
  city.justice.updateGraffitiMission(c);
  if(c.climbing)break;
  const last=c.path.at(-1);c.entity.x=last.x;c.entity.y=last.y;c.path=[];city.minute++;
 }
 assert(c.climbing);city.minute++;city.justice.updateGraffitiMission(c);assert(c.climbing.z>0);
 city.urgentNeed=()=> 'energy';city.justice.updateGraffitiMission(c);
 assert.equal(c.graffitiMission,null);assert.equal(city.justice.art.length,0);
 assert.equal(c.climbing,null);assert.equal(c.skybridgeZ,0);
});

test('single-floor buildings provide no upper targets',()=>{
 const {city,c,building}=fixture();building.floors=1;building.units=[];
 assert.deepEqual(upperGraffitiSurfaces(city,c),[]);
});
