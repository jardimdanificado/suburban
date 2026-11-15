import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainSurfaceNormals} from '../js/terrain_surface_normals.js';
const pixels=fn=>Uint8ClampedArray.from({length:8*8*4},(_,i)=>i%4===3?255:fn(Math.floor(i/4)%8,Math.floor(i/32)));
test('flat stone color produces no invented relief',()=>{
 const normals=terrainSurfaceNormals(pixels(()=>100),8,8);
 for(let p=0;p<normals.length;p+=4)assert.deepEqual([...normals.slice(p,p+4)],[128,128,255,255]);
});
test('pixel checkerboard does not turn into a lighting grid',()=>{
 const normals=terrainSurfaceNormals(pixels((x,y)=>(x+y)%2?255:0),8,8);
 for(let p=0;p<normals.length;p+=4)assert.deepEqual([...normals.slice(p,p+4)],[128,128,255,255]);
});
test('relief follows visible features symmetrically along both axes',()=>{
 const x=terrainSurfaceNormals(pixels(x=>x*30),8,8),y=terrainSurfaceNormals(pixels((x,y)=>y*30),8,8),p=(3*8+3)*4;
 assert.ok(x[p]<128);assert.equal(x[p+1],128);assert.equal(y[p],128);assert.equal(x[p],y[p+1]);assert.equal(x[p+2],y[p+2]);assert.ok(x[p+2]>=250);
 assert.deepEqual(x,terrainSurfaceNormals(pixels(x=>x*30),8,8));
});
