import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {travellerPalmSurface} from '../js/traveller_palm.js';
import {cursorLightPlacement} from '../js/cursor_light.js';

test('traveller tree has a narrow upright trunk and a wide, thin planar fan of paddles',()=>{
 const {positions,colors,uvs}=travellerPalmSurface();assert.equal(positions.length,colors.length);assert.equal(uvs.length,positions.length/3*2);
 assert.ok(positions.every(Number.isFinite));assert.ok(positions.length/9<800);
 let left=0,right=0,top=0;
 for(let i=0;i<positions.length;i+=3){const [x,y,z]=positions.slice(i,i+3);assert.ok(y>=0);assert.ok(Math.abs(z)<.15);top=Math.max(top,y);
   if(y<1.2)assert.ok(Math.abs(x)<.16,'basal trunk stays narrow');
   if(x< -1.5)left++;if(x>1.5)right++;
 }
 assert.ok(top>3.8&&top<4.5);assert.ok(left>100&&right>100,'leaves spread to both sides in one plane');
});
test('cursor light clears tall towers while preserving ground beam size and falloff',()=>{
 const axis={x:0,y:-.6,z:-.8},near=cursorLightPlacement(10,3,20,axis,12),tower=cursorLightPlacement(10,3,20,axis,180);
 assert.ok(near.y>=63);assert.ok(tower.y>=192);assert.ok(tower.distance>near.distance);
 for(const lamp of [near,tower]){
   const distance=(lamp.y-3)/.6;
   assert.ok(Math.abs(Math.tan(lamp.angle)*distance-Math.tan(.4)*18)<1e-8);
   assert.ok(Math.abs(lamp.intensity/Math.pow(distance,1.4)-22/Math.pow(18,1.4))<1e-8);
   assert.ok(Math.abs((lamp.z-20)/distance-.8)<1e-8);
 }
});
test('actual camera setter accepts closer zoom and retains both clamps',()=>{
 const source=readFileSync(new URL('../js/renderer_3d.js',import.meta.url),'utf8');
 const low=Number(source.match(/MIN_CAMERA_ZOOM = ([\d.]+)/)[1]),high=Number(source.match(/MAX_CAMERA_ZOOM = ([\d.]+)/)[1]);
 const method=source.slice(source.indexOf('  setCamera(x, y, zoom) {'),source.indexOf('\n  getCameraX()'));
 const klass=new Function('MIN_CAMERA_ZOOM','MAX_CAMERA_ZOOM',`return class {${method}}`)(low,high),renderer=new klass();renderer.mapWidth=100;renderer.mapHeight=100;
 renderer.setCamera(3,4,10);assert.equal(renderer.zoom,10);renderer.setCamera(3,4,100);assert.equal(renderer.zoom,high);
 renderer.setCamera(3,4,.01);assert.equal(renderer.zoom,low);
});
