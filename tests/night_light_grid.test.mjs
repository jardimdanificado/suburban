import test from 'node:test';
import assert from 'node:assert/strict';
import {NightLightGrid,NIGHT_GRID_SIDE,NIGHT_LIGHT_CAPACITY} from '../js/night_light_grid.js';
const light=(x,z,r=10)=>({visible:true,intensity:2,distance:r,decay:1.8,position:{x,y:3,z},color:{r:1,g:.5,b:.25}});
function candidates(g,x,z){
 const cx=Math.floor((x-g.originX)/g.cellSize),cz=Math.floor((z-g.originZ)/g.cellSize);
 if(cx<0||cz<0||cx>=g.width||cz>=g.height)return [];
 const at=(cz*NIGHT_GRID_SIDE+cx)*4,offset=g.cells[at],count=g.cells[at+1];
 return Array.from({length:count},(_,i)=>g.indices[(offset+i)*4]);
}
test('local lists retain every contributing light over negative coordinates, cell edges and large worlds',()=>{
 for(const span of [120,3000]){
  const lights=Array.from({length:256},(_,i)=>light(((i*73)%257-128)*span/128,((i*137)%257-128)*span/128,2+i%33));
  const g=new NightLightGrid();g.update(lights);
  assert.ok(g.width<=NIGHT_GRID_SIDE&&g.height<=NIGHT_GRID_SIDE);
  for(let i=0;i<lights.length;i++){
   const l=lights[i];for(let j=0;j<16;j++){
    const a=j*Math.PI/8,r=l.distance*.9999,x=l.position.x+Math.cos(a)*r,z=l.position.z+Math.sin(a)*r;
    assert.ok(candidates(g,x,z).includes(i),`missing light ${i} at ${x},${z}`);
   }
  }
 }
});
test('overlapping 256 lights are not truncated and resizing/reusing the grid clears old lists',()=>{
 const g=new NightLightGrid(),sources=Array.from({length:NIGHT_LIGHT_CAPACITY},()=>light(0,0,34));
 g.update(sources);assert.equal(g.maxCellLights,256);assert.equal(candidates(g,0,0).length,256);
 assert.ok(g.indices.length>4096);
 g.update([light(100,100,2)]);assert.deepEqual(candidates(g,100,100),[0]);assert.deepEqual(candidates(g,0,0),[]);
 g.update([]);assert.equal(g.count,0);assert.equal(g.references,0);
});
test('inactive lights are excluded and linear color/intensity, radius and decay are preserved',()=>{
 const g=new NightLightGrid(),a=light(10,20),off=light(0,0);off.visible=false;
 const dark=light(0,0);dark.intensity=0;g.update([off,a,dark]);
 assert.equal(g.count,1);assert.deepEqual([...g.lights.slice(0,4)],[10,3,20,10]);
 const at=NIGHT_LIGHT_CAPACITY*4;assert.deepEqual([...g.lights.slice(at,at+3)],[2,1,.5]);assert.ok(Math.abs(g.lights[at+3]-1.8)<1e-6);
});
