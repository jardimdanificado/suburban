import test from 'node:test';
import assert from 'node:assert/strict';
import {syncConstructionDust} from '../js/city_construction_dust.js';

function harness(){
  class Group{constructor(){this.children=[];this.visible=true;}add(child){this.children.push(child);}}
  class BufferAttribute{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.needsUpdate=false;}}
  class BufferGeometry{constructor(){this.attributes={};}setAttribute(name,attribute){this.attributes[name]=attribute;}setDrawRange(start,count){this.drawRange={start,count};}getAttribute(name){return this.attributes[name];}}
  class ShaderMaterial{constructor(options){Object.assign(this,options);}}
  class Points{constructor(geometry,material){this.geometry=geometry;this.material=material;}}
  const THREE={Group,BufferGeometry,BufferAttribute,ShaderMaterial,Points};
  const group=new Group(),renderer={entityGroup:group,currentMap:[],getSurfaceElevation(){return 2;}};
  return {THREE,group,renderer,field(){return group.children[0].children[0];}};
}
function fixture(overrides={}){
  const project={id:'b1',service:'building',status:'building'};
  const entity={x:2.5,y:3.5};
  const citizen={id:7,task:'construction',workProjectId:'b1',entity,...overrides};
  return {projects:[project],city:{citizens:[citizen]}};
}

test('construction grains appear only where a worker is on site',()=>{
  const h=harness(),development=fixture();
  syncConstructionDust(h.THREE,h.renderer,development,1000,.7);
  assert.equal(h.field().geometry.drawRange.count,18);
  assert.equal(h.field().geometry.drawRange.count,18);
});

test('no workers, travelling workers or finished sites raise no dust',()=>{
  const h=harness();
  syncConstructionDust(h.THREE,h.renderer,{projects:[{id:'b1',status:'building'}],city:{citizens:[]}},1000);
  assert.equal(h.field().geometry.drawRange.count,0);
  syncConstructionDust(h.THREE,h.renderer,fixture({path:[{x:8,y:9}]}),1100);
  assert.equal(h.field().geometry.drawRange.count,0);
  const finished=fixture();finished.projects[0].status='completed';
  syncConstructionDust(h.THREE,h.renderer,finished,1200);
  assert.equal(h.field().geometry.drawRange.count,0);
});

test('dust can be disabled',()=>{
  const h=harness();
  syncConstructionDust(h.THREE,h.renderer,fixture(),1000,1,true);
  assert.equal(h.group.children[0].visible,true);
  syncConstructionDust(h.THREE,h.renderer,fixture(),1100,1,false);
  assert.equal(h.group.children[0].visible,false);
});

test('grains dither in screen space and darken at night',()=>{
  const h=harness();
  syncConstructionDust(h.THREE,h.renderer,fixture(),1000,.25);
  const material=h.field().material;
  assert.match(material.fragmentShader,/bayer4\(gl_FragCoord\.xy\)/);
  assert.match(material.fragmentShader,/gl_PointCoord/);
  assert.equal(material.uniforms.uDaylight.value,.25);
  assert.equal(h.field().geometry.drawRange.count,18);
});
