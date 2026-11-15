import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/renderer_3d.js',import.meta.url),'utf8');
const method=source.slice(source.indexOf('  terrainViewportBounds()'),source.indexOf('\n  getFullWorldModeName()'));
function fixture(perspective){
 let rays=0;
 class Vector3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}distanceTo(p){return Math.hypot(this.x-p.x,this.y-p.y,this.z-p.z);}}
 class Vector2{set(x,y){this.x=x;this.y=y;return this;}}
 class Raycaster{setFromCamera(ndc,camera){rays++;this.ray={origin:{x:50,y:10,z:50},intersectPlane(_plane,p){p.x=50+ndc.x*10+camera.matrixWorld.elements[12];p.z=50+ndc.y*10;p.y=0;return camera.sky?null:p;},at(reach,p){p.x=50+ndc.x*reach;p.z=50+ndc.y*reach;return p;}};}}
 const Klass=new Function('THREE',`return class {${method}}`)({Vector3,Vector2,Raycaster,Plane:class{}}),renderer=new Klass();
 const camera={matrixWorld:{elements:new Float64Array(16)},projectionMatrix:{elements:new Float64Array(16)},updateMatrixWorld(){},far:120};
 Object.assign(renderer,{camera,fpCamera:camera,mapWidth:128,mapHeight:128,scene:{fog:{far:65}},isPerspectiveActive:()=>perspective});
 return {renderer,camera,rays:()=>rays};
}
for(const perspective of [false,true])test(`viewport caches identical camera matrices and preserves loading margins: perspective=${perspective}`,()=>{
 const {renderer,camera,rays}=fixture(perspective),margin=perspective?8:4;
 const original=renderer.terrainViewportBounds();assert.deepEqual(original,{minTx:40-margin,maxTx:60+margin,minTy:40-margin,maxTy:60+margin});assert.equal(rays(),4);
 for(let i=0;i<100;i++)assert.equal(renderer.terrainViewportBounds(),original);assert.equal(rays(),4);
 camera.matrixWorld.elements[12]=2;assert.equal(renderer.terrainViewportBounds().minTx,42-margin);assert.equal(rays(),8);
 camera.projectionMatrix.elements[0]=2;renderer.terrainViewportBounds();assert.equal(rays(),12);
 renderer.mapWidth=50;assert.equal(renderer.terrainViewportBounds().maxTx,49);assert.equal(rays(),16);
 if(perspective){renderer.scene.fog.far=5;renderer.terrainViewportBounds();assert.equal(rays(),20);camera.far=3;renderer.terrainViewportBounds();assert.equal(rays(),24);}
 camera.sky=true;camera.matrixWorld.elements[13]=1;
 const sky=renderer.terrainViewportBounds();if(!perspective)assert.deepEqual(sky,{minTx:0,maxTx:49,minTy:0,maxTy:127});else assert.ok(sky.minTx<=sky.maxTx);
});
