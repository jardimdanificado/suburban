import test from 'node:test';
import assert from 'node:assert/strict';
import {syncConstructionDust} from '../js/city_construction_dust.js';

function harness(){
  class Group{constructor(){this.children=[];this.visible=true;}add(child){this.children.push(child);}}
  class BufferAttribute{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.needsUpdate=false;}}
  class BufferGeometry{constructor(){this.attributes={};}setAttribute(name,attribute){this.attributes[name]=attribute;}setDrawRange(start,count){this.drawRange={start,count};}getAttribute(name){return this.attributes[name];}}
  class ShaderMaterial{constructor(options){Object.assign(this,options);}}
  class Points{constructor(geometry,material){this.geometry=geometry;this.material=material;}}
  class Vector3{constructor(x=0,y=0,z=0){this.set(x,y,z);}set(x,y,z){this.point=[x,y,z];return this;}normalize(){return this;}}
  class Color{constructor(value=0xffffff){this.value=value;this.setRGB(((value>>16)&255)/255,((value>>8)&255)/255,(value&255)/255);}setRGB(r,g,b){this.r=r;this.g=g;this.b=b;return this;}}
  const THREE={Group,BufferGeometry,BufferAttribute,ShaderMaterial,Points,Vector3,Color};
  const renderer={entityGroup:new Group(),currentMap:[],getSurfaceElevation(){return 2;},
    sunLight:{color:{r:1,g:.98,b:.92},intensity:1.4,position:{x:40,y:80,z:50},target:{position:{x:0,y:0,z:0}}},
    ambientLight:{color:{r:.86,g:.91,b:.96},intensity:.9}};
  return {THREE,renderer,group:renderer.entityGroup,field(){return renderer.entityGroup.children[0].children[0];}};
}
function fixture(overrides={}){
  const project={id:'b1',service:'building',status:'building'};
  const entity={x:2.5,y:3.5};
  const citizen={id:7,task:'construction',workProjectId:'b1',entity,...overrides};
  return {projects:[project],city:{citizens:[citizen]}};
}

test('construction grains appear only where a worker is on site',()=>{
  const h=harness();
  syncConstructionDust(h.THREE,h.renderer,fixture(),1000,true);
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

test('rewound or stale timestamps clear stuck grains',()=>{
  const h=harness(),development=fixture();
  syncConstructionDust(h.THREE,h.renderer,development,1000);
  assert.equal(h.field().geometry.drawRange.count,18);
  syncConstructionDust(h.THREE,h.renderer,{projects:development.projects,city:{citizens:[]}},900);
  assert.equal(h.field().geometry.drawRange.count,0);
});

test('dust can be disabled',()=>{
  const h=harness();
  syncConstructionDust(h.THREE,h.renderer,fixture(),1000,true);
  assert.equal(h.group.children[0].visible,true);
  syncConstructionDust(h.THREE,h.renderer,fixture(),1100,false);
  assert.equal(h.group.children[0].visible,false);
});

test('grains are lit by scene lights with per-grain normals and dither',()=>{
  const h=harness();
  h.renderer.sunLight.intensity=.32;h.renderer.ambientLight.intensity=.24;
  syncConstructionDust(h.THREE,h.renderer,fixture(),1000);
  const material=h.field().material;
  assert.match(material.fragmentShader,/normalize\(vec3\(p,sqrt\(max\(0\.0,1\.0-r\*r\)\)\)\)/);
  assert.match(material.fragmentShader,/uAmbColor\*uAmbIntensity\+uSunColor\*uSunIntensity\*ndl/);
  assert.match(material.fragmentShader,/bayer4\(gl_FragCoord\.xy\)/);
  assert.equal(material.uniforms.uSunIntensity.value,.32);
  assert.equal(material.uniforms.uAmbIntensity.value,.24);
});
