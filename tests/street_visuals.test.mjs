import test from 'node:test';
import assert from 'node:assert/strict';
import {streetSurfacePixels} from '../js/street_surface_textures.js';
import {groundGrassSurface} from '../js/ground_grass_geometry.js';
import {mobilityModelSurface,wickerBasketSurface} from '../js/city_mobility_models.js';
import {syncCityMobility} from '../js/city_mobility_renderer.js';

test('granite uses mostly cool natural stone with sparse warm mineral seams and reproducible relief',()=>{
  const a=streetSurfacePixels('pavedRoad',2),b=streetSurfacePixels('pavedRoad',2);
  assert.deepEqual(a,b);assert.notDeepEqual(a.data,streetSurfacePixels('pavedRoad',1).data);
  let cool=0,warm=0,relief=0;
  for(let i=0;i<a.data.length;i+=4){const r=a.data[i],g=a.data[i+1],blue=a.data[i+2];if(blue>r+5)cool++;if(r>blue+14&&r>g+8)warm++;if(Math.abs(a.normals[i]-128)>8)relief++;assert.equal(a.data[i+3],255);}
  const pixels=a.size*a.size;
  assert(cool>pixels*.55);assert(warm>pixels*.002&&warm<pixels*.06);assert(relief>pixels*.04);
});
test('sidewalk slabs are lighter and much quieter than the street',()=>{
  const road=streetSurfacePixels('pavedRoad'),walk=streetSurfacePixels('sidewalk');
  const stats=pixels=>{let n=0,sum=0,squares=0;for(let i=0;i<pixels.data.length;i+=4){const v=(pixels.data[i]+pixels.data[i+1]+pixels.data[i+2])/3;sum+=v;squares+=v*v;n++;}return {mean:sum/n,variance:squares/n-(sum/n)**2};};
  const r=stats(road),w=stats(walk);assert(w.mean>r.mean+60);assert(w.variance<r.variance*.12);
});
test('grass is a small patch of narrow, rooted blades with finite non-degenerate triangles',()=>{
  const {positions,colors}=groundGrassSurface();assert.equal(positions.length,colors.length);assert(positions.every(Number.isFinite));
  const heights=positions.filter((_,i)=>i%3===1);assert(Math.max(...heights)<.24);assert.equal(Math.min(...heights),0);
  assert(positions.length/9<30,'keep the instanced patch inexpensive');
  for(let i=0;i<positions.length;i+=9){
    const ux=positions[i+3]-positions[i],uy=positions[i+4]-positions[i+1],uz=positions[i+5]-positions[i+2],vx=positions[i+6]-positions[i],vy=positions[i+7]-positions[i+1],vz=positions[i+8]-positions[i+2];
    assert(Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)>1e-7);
  }
});
test('all six transport models have grounded wheels, independent paint and bounded geometry',()=>{
  for(const kind of ['bicicleta','bicicleta_carga','carrinho','patinete','skate','patins']){
    const model=mobilityModelSurface(kind);let triangles=0,minY=Infinity;
    for(const surface of Object.values(model)){
      assert(surface.positions.length>0);assert.equal(surface.normals.length,surface.positions.length);assert.equal(surface.colors.length,surface.positions.length);
      assert(surface.positions.every(Number.isFinite));assert(surface.normals.every(Number.isFinite));
      triangles+=surface.positions.length/9;
      for(let i=1;i<surface.positions.length;i+=3)minY=Math.min(minY,surface.positions[i]);
    }
    assert(minY>=-.01&&minY<.01,`${kind} touches the ground`);assert(triangles<4500,`${kind}: ${triangles} triangles`);
    assert(model.paint.colors.every(v=>v===1),'the body paint must not recolor tires or wicker');
  }
});
test('a woven basket has an open mouth and a physical bottom instead of a solid lid',()=>{
  const p=wickerBasketSurface().positions;let highestCenter=-Infinity;
  for(let i=0;i<p.length;i+=9){
    const [ax,ay,az,bx,by,bz,cx,cy,cz]=p.slice(i,i+9),den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
    if(Math.abs(den)<1e-10)continue;
    const a=((bz-cz)*(-cx)+(cx-bx)*(-cz))/den,b=((cz-az)*(-cx)+(ax-cx)*(-cz))/den,c=1-a-b;
    if(a>=0&&b>=0&&c>=0)highestCenter=Math.max(highestCenter,a*ay+b*by+c*cy);
  }
  assert(Number.isFinite(highestCenter));assert(highestCenter<.025,'a ray through the open mouth reaches the woven floor');
});

class Vector3{set(x,y,z){Object.assign(this,{x,y,z});return this;}}
class Quaternion{setFromAxisAngle(axis,angle){this.angle=angle;return this;}multiply(){return this;}}
class Matrix4{compose(position){this.position={...position};return this;}}
class Color{setHex(value){this.value=value;return this;}}
class BufferGeometry{constructor(){this.attributes={};}setAttribute(name,value){this.attributes[name]=value;}computeBoundingSphere(){}}
class Attribute{constructor(array,itemSize){Object.assign(this,{array,itemSize});}}
class InstancedMesh{constructor(geometry,material,capacity){Object.assign(this,{geometry,material,capacity,instanceMatrix:{setUsage(){}},matrices:[],colors:[]});}setMatrixAt(i,m){this.matrices[i]={...m.position};}setColorAt(i,c){this.colors[i]=c.value;this.instanceColor??={};}dispose(){}}
const THREE={Vector3,Quaternion,Matrix4,Color,BufferGeometry,Float32BufferAttribute:Attribute,InstancedMesh,MeshLambertMaterial:class{},DoubleSide:2,DynamicDrawUsage:1};
test('a thousand bicycles share two batches and disappear cleanly when removed from view',()=>{
  const added=[],renderer={scene:{add:m=>added.push(m),remove(){}}},world={width:64,height:64,map:new Uint8Array(4096),revision:1,getTile:()=>0};
  const entities=Array.from({length:1024},(_,i)=>({x:i%32+1.5,y:Math.floor(i/32)+1.5,properties:{cityVehicle:{id:i,good:'bicicleta',color:'#a83c47'}}}));
  syncCityMobility(renderer,THREE,entities,world);assert.equal(added.length,2);
  const paint=renderer.mobilityBatches.get('cycle-paint-bicicleta').mesh;assert.equal(paint.count,1024);assert.equal(paint.colors[0],0xa83c47);assert.equal(paint.matrices[0].y,1.1);
  syncCityMobility(renderer,THREE,entities.slice(0,12),world);assert.equal(paint.count,12);assert.equal(added.length,2);
  syncCityMobility(renderer,THREE,[],world);assert([...renderer.mobilityBatches.values()].every(b=>b.mesh.count===0));
});
