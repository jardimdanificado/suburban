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
