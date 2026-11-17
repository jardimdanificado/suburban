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
    h.step(.1,.1);assert.equal(h.field().geometry.drawRange.count,14);
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
