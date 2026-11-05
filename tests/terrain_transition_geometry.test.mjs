import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainTransitionTriangles,sampleTerrainQuad} from '../js/terrain_transition_geometry.js';
import {addTerrainDitherToMaterial} from '../js/terrain_transition_material.js';

test('transition halves preserve ground planes, upward winding and one-eighth width',()=>{
  const corners=[[0,0,0],[1,1,0],[1,.3,1],[0,2,1]];
  for(const [axis,min,max]of [[0,.875,1],[0,0,.125],[2,.875,1],[2,0,.125]]){
    const triangles=terrainTransitionTriangles(corners,axis,min,max);
    let area=0;
    for(const[a,b,c]of triangles){
      const twiceArea=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
      assert.ok(twiceArea>0,'triangle must face upward');
      area+=twiceArea/2;
      for(const point of[a,b,c]){
        assert.ok(point[axis]>=min-1e-12&&point[axis]<=max+1e-12);
        assert.ok(Math.abs(point[1]-sampleTerrainQuad(corners.map(p=>p[1]),point[0],point[2]))<1e-12,'clipped vertex must stay on the original ground surface');
      }
    }
    assert.ok(Math.abs(area-.125)<1e-12,'half-band must cover exactly one eighth of the tile');
  }
});

test('transition materials retain the ground lighting shader and its program identity',()=>{
  const source={
    name:'ground',clone:()=>({}),customProgramCacheKey:()=> 'retro-ground-v1',
    onBeforeCompile(shader){shader.uniforms.retroSteps={value:24};shader.fragmentShader+='\n// original ground lighting';},
  };
  for(const side of[0,1]){
    const material=addTerrainDitherToMaterial(source,side);
    const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <clipping_planes_fragment>'};
    material.onBeforeCompile(shader);
    assert.equal(shader.uniforms.retroSteps.value,24);
    assert.ok(shader.fragmentShader.includes('// original ground lighting'));
    assert.equal(shader.uniforms.terrainBlendSide.value,side);
    assert.ok(material.customProgramCacheKey().includes('retro-ground-v1'));
  }
});
