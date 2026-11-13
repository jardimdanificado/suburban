import test from 'node:test';
import assert from 'node:assert/strict';
import {grassRoots, createVolumetricGrassMaterial} from '../js/volumetric_grass.js';

const tile = (x = 0, z = 0) => [x, 0, z, x, 0, z+1, x+1, 0, z+1, x, 0, z, x+1, 0, z+1, x+1, 0, z];
test('every grass tile has 100 unique roots, independent of chunk boundaries', () => {
  const a = grassRoots(tile()), b = grassRoots(tile(1));
  const both = grassRoots([...tile(), ...tile(1)]);
  assert.equal(a.roots.length / 3, 100);
  assert.equal(b.roots.length / 3, 100);
  assert.deepEqual(both.roots, new Float32Array([...a.roots, ...b.roots]));
  assert.equal(new Set(Array.from({length:100}, (_,i)=>`${a.roots[i*3]},${a.roots[i*3+2]}`)).size, 100);
  assert.ok(a.roots.every(Number.isFinite));
});
test('roots follow the exact sloped surface and never grow on vertical walls', () => {
  const positions = tile().map((value, i, all) => i % 3 === 1 ? all[i-1] * .4 + all[i+1] * .7 : value);
  const {roots} = grassRoots(positions);
  assert.equal(roots.length / 3, 100);
  for (let i=0;i<roots.length;i+=3) assert.ok(Math.abs(roots[i+1] - (roots[i]*.4 + roots[i+2]*.7 - .003)) < 1e-6);
  assert.equal(grassRoots([0,0,0, 0,1,0, 1,1,0]).roots.length, 0);
});
test('grass shader moves leaf tips, retains roots, and has no shells or random cutouts', () => {
  class Material { constructor(options) {Object.assign(this, options);} }
  const time = {value: 3};
  const material = createVolumetricGrassMaterial({MeshStandardMaterial: Material, DoubleSide: 2}, null, time);
  const shader = {uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <normal_fragment_begin>'};
  material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.grassSimTick, time);
  assert.ok(shader.vertexShader.includes('float bend = h;'));
  assert.ok(shader.vertexShader.includes('transformed = grassRoot'));
  assert.ok(!shader.fragmentShader.includes('discard'));
  assert.ok(!shader.fragmentShader.includes('cameraPosition'));
  assert.ok(!shader.vertexShader.includes('grassLayer'));
  assert.ok(shader.fragmentShader.includes('normal = normalize(vNormal)'));
  assert.equal(material.depthWrite, true);
});

test('grass inherits the tile texture and tint, with darker shading', () => {
  class Material { constructor(options) {Object.assign(this, options);} }
  const tint = {factor: 1, clone(){return {...this};}, multiplyScalar(value){this.factor *= value;return this;}};
  const map = {name:'terrain texture'};
  const material = createVolumetricGrassMaterial({MeshStandardMaterial: Material, DoubleSide: 2}, {color:tint,map}, {value:0});
  assert.equal(material.map,map);
  assert.equal(material.color.factor,.82);
  assert.equal(tint.factor,1,'the terrain material itself must stay unchanged');
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <uv_vertex>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <normal_fragment_begin>'};
  material.onBeforeCompile(shader);
  assert.ok(shader.vertexShader.includes('grassRoot.xz / 8.0'),'sample the same world-space texture coordinates as the ground');
});

test('grass wind holds seeded canopy poses using simulation ticks, without continuous-time sway',()=>{
 class Material{constructor(options){Object.assign(this,options);}}
 const tick={value:12},material=createVolumetricGrassMaterial({MeshStandardMaterial:Material,DoubleSide:2},null,tick);
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <normal_fragment_begin>'};
 material.onBeforeCompile(shader);
 assert.equal(shader.uniforms.grassSimTick,tick);
 assert.ok(shader.vertexShader.includes('15.0 + floor(windSeed * 10.0)'));
 assert.ok(shader.vertexShader.includes('floor((grassSimTick + windSeed * 100.0) / interval)'));
 assert.ok(shader.vertexShader.includes('sin(windEpoch *'));
 assert.ok(!shader.vertexShader.includes('sin(grassSimTick'));
});
test('each angular blade has only one triangle, two fixed roots and a sharp offset tip',async()=>{
 const {grassBladeSurface}=await import('../js/volumetric_grass.js');
 const blade=grassBladeSurface();assert.equal(blade.positions.length,9);assert.deepEqual(blade.indices,[0,1,2]);
 assert.equal(blade.positions[1],0);assert.equal(blade.positions[4],0);assert.equal(blade.positions[7],1);
 assert.ok(blade.positions[6]>0&&blade.positions[6]<1);assert.equal(blade.normals.length,blade.positions.length);
 assert.ok(blade.positions.every(Number.isFinite));
});
