import test from 'node:test';
import assert from 'node:assert/strict';
import {syncMovementDust} from '../js/city_movement_dust.js';

function harness({tile=8,vehicle=null}={}){
  class Group{constructor(){this.children=[];this.visible=true;}add(child){this.children.push(child);}}
  class BufferAttribute{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.needsUpdate=false;}}
  class BufferGeometry{constructor(){this.attributes={};}setAttribute(name,attribute){this.attributes[name]=attribute;}setDrawRange(start,count){this.drawRange={start,count};}getAttribute(name){return this.attributes[name];}}
  class ShaderMaterial{constructor(options){Object.assign(this,options);}}
  class Points{constructor(geometry,material){this.geometry=geometry;this.material=material;}}
  class Vector3{constructor(x=0,y=0,z=0){this.set(x,y,z);}set(x,y,z){this.point=[x,y,z];return this;}normalize(){return this;}}
  class Color{constructor(value=0xffffff){this.value=value;}setRGB(r,g,b){this.r=r;this.g=g;this.b=b;return this;}}
  const THREE={Group,BufferGeometry,BufferAttribute,ShaderMaterial,Points,Vector3,Color};
  const group=new Group(),renderer={entityGroup:group,currentMap:[],getSurfaceElevation(){return 1;},
    sunLight:{color:{r:1,g:1,b:1},intensity:1.4,position:{x:40,y:80,z:50},target:{position:{x:0,y:0,z:0}}},
    ambientLight:{color:{r:.86,g:.91,b:.96},intensity:.9}};
  const world={width:100,height:100,getTile(){return tile;}};
  const entity={id:1,x:5,y:5,properties:vehicle?{cityVehicle:{good:vehicle,driverId:2,angle:0}}:{citizen:{}}};
  return {THREE,group,renderer,world,entity,step(distance,dt){entity.x+=distance;syncMovementDust(THREE,renderer,world,[entity],null,dt);},field(){return group.children[0].children[0];}};
}

test('land vehicles leave a grain trail at any speed on any land surface',()=>{
  for(const tile of [0,3,8]){
    const h=harness({tile,vehicle:'carrinho'});
    h.step(0,.1);assert.equal(h.field().geometry.drawRange.count,0);
    h.step(.1,.1);assert(h.field().geometry.drawRange.count>0);
  }
});

test('people, boats and stopped vehicles leave no dust',()=>{
  const person=harness();person.step(0,.1);person.step(.8,.1);assert.equal(person.field().geometry.drawRange.count,0);
  const boat=harness({vehicle:'canoa'});boat.entity.properties.cityVehicle.boatClass='canoa';boat.step(0,.1);boat.step(.8,.1);assert.equal(boat.field().geometry.drawRange.count,0);
  const stopped=harness({vehicle:'bicicleta'});stopped.step(0,.1);stopped.step(0,.1);assert.equal(stopped.field().geometry.drawRange.count,0);
});

test('dust can be disabled',()=>{
  const h=harness({vehicle:'bicicleta'});
  h.step(0,.1);h.step(.4,.1);
  assert.equal(h.group.children[0].visible,true);
  syncMovementDust(h.THREE,h.renderer,h.world,[h.entity],null,.1,false);
  assert.equal(h.group.children[0].visible,false);
});

test('grains carry per-particle color and seed for variation',()=>{
  const h=harness({vehicle:'bicicleta'});
  h.step(0,.1);h.step(.4,.1);
  const field=h.field();
  assert.equal(field.geometry.getAttribute('aColor').array.length,3072*3);
  assert(new Set(Array.from(field.geometry.getAttribute('aSeed').array.slice(0,6))).size>1);
});

function positions(h){return Array.from(h.field().geometry.getAttribute('position').array.slice(0,h.field().geometry.drawRange.count*3));}

test('wheel dust follows displacement even when vehicle angle is stale',()=>{
  const h=harness({vehicle:'carrinho'});
  h.entity.properties.cityVehicle.angle=Math.PI;
  h.step(0,.1);h.step(.4,.1);
  const points=positions(h);
  for(let i=0;i<points.length;i+=3){
    assert(points[i]<=h.entity.x+.25);
    assert(Math.abs(points[i+2]-h.entity.y)<.36);
    assert(points[i+1]>=1&&points[i+1]<1.1);
  }
  assert(points.some((v,i)=>i%3===2&&v<5));
  assert(points.some((v,i)=>i%3===2&&v>5));
});

test('distance spacing keeps emission count stable across frame rates',()=>{
  const a=harness({vehicle:'carrinho'}),b=harness({vehicle:'carrinho'});
  a.step(0,.01);b.step(0,.01);
  a.step(.4,.1);
  for(let i=0;i<4;i++)b.step(.1,.025);
  assert.equal(a.field().geometry.drawRange.count,b.field().geometry.drawRange.count);
});

test('teleports and re-enabling dust do not create connecting trails',()=>{
  const h=harness({vehicle:'carrinho'});
  h.step(0,.1);h.step(10,.1);
  assert.equal(h.field().geometry.drawRange.count,0);
  syncMovementDust(h.THREE,h.renderer,h.world,[h.entity],null,.1,false);
  h.step(1,.1);
  assert.equal(h.field().geometry.drawRange.count,0);
});

test('dust uses vehicle coordinates rather than citizen crowd offsets',()=>{
  const h=harness({vehicle:'bicicleta'}),offsets=new Map([[1,{x:20,y:20}]]);
  syncMovementDust(h.THREE,h.renderer,h.world,[h.entity],offsets,.1);
  h.entity.x+=.2;
  syncMovementDust(h.THREE,h.renderer,h.world,[h.entity],offsets,.1);
  const points=positions(h);
  assert(points.length>0);
  for(let i=0;i<points.length;i+=3){assert(points[i]<6);assert(Math.abs(points[i+2]-5)<.1);}
});

test('clouds expand, fade smoothly and expire without leftover particles',async()=>{
  const {renderVehicleDust}=await import('../js/vehicle_dust_field.js?v=soft-dust-1');
  const particle={x:0,z:0,h:0,vx:0,vz:0,vh:.1,age:0,life:1,size:.2,color:[1,1,1],seed:.5,opacity:.3};
  const particles=[particle],samples=[];
  const field={begin(){},end(){},add(x,y,z,size,color,seed,opacity){samples.push({size,opacity,y});}};
  renderVehicleDust(particles,0,field);
  assert.equal(samples.at(-1).opacity,0);
  renderVehicleDust(particles,.15,field);const young=samples.at(-1);
  renderVehicleDust(particles,.6,field);const old=samples.at(-1);
  assert(old.size>young.size);assert(old.opacity<young.opacity);assert(old.opacity>0);assert(old.y>young.y);
  renderVehicleDust(particles,.3,field);assert.equal(particles.length,0);
});
