export function addTerrainDitherToMaterial(material, side) {
  const blendMaterial = material.clone();
  const compileGround = material.onBeforeCompile;
  const groundProgramKey = material.customProgramCacheKey?.() || '';
  blendMaterial.name = `${material.name || 'terrain'}-blend-${side ? 'b' : 'a'}`;
  blendMaterial.onBeforeCompile = (shader, renderer) => {
    // Material.clone() does not copy onBeforeCompile. Keep the ground's retro
    // lighting/quantization before adding the complementary material mask.
    compileGround?.call(blendMaterial, shader, renderer);
    shader.uniforms.terrainBlendSide = { value: side };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float blendRatio;
varying float vTerrainBlendRatio;
varying vec3 vTerrainBlendWorldPosition;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vTerrainBlendRatio = blendRatio;
vTerrainBlendWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float terrainBlendSide;
varying float vTerrainBlendRatio;
varying vec3 vTerrainBlendWorldPosition;
float terrainBlendNoise(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float terrainBlendRounded = smoothstep(0.0, 1.0, vTerrainBlendRatio);
float terrainBlendChoice = step(terrainBlendNoise(floor(vTerrainBlendWorldPosition.xz * 32.0)), terrainBlendRounded);
if ((terrainBlendSide < 0.5 && terrainBlendChoice > 0.5) || (terrainBlendSide >= 0.5 && terrainBlendChoice < 0.5)) discard;`);
  };
  blendMaterial.customProgramCacheKey = () => `${groundProgramKey}:terrain-clipped-surface-blend-${side}`;
  blendMaterial.polygonOffset = true;
  blendMaterial.polygonOffsetFactor = -1;
  blendMaterial.polygonOffsetUnits = -1;
  blendMaterial.depthWrite = true;
  blendMaterial.transparent = false;
  return blendMaterial;
}
