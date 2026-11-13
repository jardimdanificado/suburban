import test from 'node:test';
import assert from 'node:assert/strict';
import {constructionSiteCells,grassExclusionCells} from '../js/city_site_footprints.js';
import {grassRoots} from '../js/volumetric_grass.js';
const tile=(x,z)=>[x,0,z,x,0,z+1,x+1,0,z+1,x,0,z,x+1,0,z+1,x+1,0,z];

test('grass stays outside entire farms, active works and road works',()=>{
  const farm={type:'farm',entity:{x:0,y:0},width:2,depth:2};
  const plot={x:2,y:0,width:4,depth:4};
  const project={service:'building',width:2,depth:2,status:'materials'};
  const road={service:'road',route:[{x:4.5,y:.5}],status:'labor'};
  const sites=[...constructionSiteCells(project,plot),...constructionSiteCells(road)];
  const excluded=grassExclusionCells([farm],sites);
  assert.equal(excluded.size,9,'four farm cells, four construction cells, one road cell');
  const surface=[];
  for(let z=0;z<2;z++)for(let x=0;x<6;x++)surface.push(...tile(x,z));
  const {roots}=grassRoots(surface,null,excluded);
  assert.equal(roots.length/3,300);
  for(let i=0;i<roots.length;i+=3)assert.ok(!excluded.has(`${Math.floor(roots[i])},${Math.floor(roots[i+2])}`));
});
test('finished or cancelled works release coverage; destroyed farms no longer exclude land',()=>{
  const project={service:'building',status:'materials'},plot={x:0,y:0,width:1,depth:1};
  const roots=()=>grassRoots(tile(0,0),null,grassExclusionCells([],constructionSiteCells(project,plot))).roots.length/3;
  assert.equal(roots(),0);
  project.status='completed';assert.equal(roots(),100);
  project.status='cancelled';assert.equal(roots(),100);
  project.status='materials';project.cancelled=true;assert.equal(roots(),100);
  assert.equal(grassExclusionCells([{type:'farm',entity:{x:0,y:0,destroyed:true},width:2,depth:2}],[]).size,0);
});
test('site masks use project dimensions and exact repair and lamp cells',()=>{
  assert.equal(constructionSiteCells({service:'building',width:1,depth:2},{x:0,y:0,width:4,depth:4}).length,2);
  assert.deepEqual(constructionSiteCells({service:'road-repair',path:[{x:3.1,y:4.8}]}),[{x:3.5,y:4.5}]);
  assert.deepEqual(constructionSiteCells({service:'lamp',door:{x:2.5,y:3.5}}),[{x:2.5,y:3.5}]);
});
test('finished buildings and paved open-air lots clear grass while parks retain their lawn',()=>{
 const buildings=[
  {id:1,type:'residential',entity:{x:0,y:0},width:2,depth:2},
  {id:2,type:'market',constructionKind:'open-air',entity:{x:2,y:0},width:2,depth:2},
  {id:3,type:'park',constructionKind:'open-air',entity:{x:4,y:0},width:2,depth:2},
 ];
 const excluded=grassExclusionCells(buildings,[]);assert.equal(excluded.size,8);
 const surface=[];for(let y=0;y<2;y++)for(let x=0;x<6;x++)surface.push(...tile(x,y));
 const {roots}=grassRoots(surface,null,excluded);assert.equal(roots.length/3,400);
 for(let i=0;i<roots.length;i+=3)assert(roots[i]>=4,'only the park has grass');
 buildings[0].entity.destroyed=true;assert.equal(grassExclusionCells(buildings,[]).size,4);
});
test('building coverage signature changes for construction, demolition and footprint resizing',async()=>{
 const {grassExclusionSignature}=await import('../js/city_site_footprints.js');
 const buildings=[{id:1,type:'residential',entity:{x:0,y:0},width:2,depth:2}],empty=grassExclusionSignature([]),initial=grassExclusionSignature(buildings);
 assert.notEqual(initial,empty);buildings[0].width=3;assert.notEqual(grassExclusionSignature(buildings),initial);
 buildings[0].entity.destroyed=true;assert.equal(grassExclusionSignature(buildings),empty);
 buildings[0].entity.destroyed=false;buildings[0].type='park';assert.equal(grassExclusionSignature(buildings),empty);
});

test('quarries, iron mines and parks retain grass while farms and buildings exclude it',()=>{
 const lots=['quarry','iron_mine','park','farm','residential'].map((type,i)=>({id:i,type,entity:{x:i,y:0},width:1,depth:1}));
 const excluded=grassExclusionCells(lots,[]);assert.deepEqual([...excluded].sort(),['3,0','4,0']);
 const surface=lots.flatMap((_,i)=>tile(i,0)),roots=grassRoots(surface,null,excluded).roots;
 assert.equal(roots.length/3,300);
});
