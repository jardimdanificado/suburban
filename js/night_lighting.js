import {NightLightGrid,NIGHT_LIGHT_CAPACITY,NIGHT_GRID_SIDE,NIGHT_INDEX_WIDTH} from './night_light_grid.js';

const declarations = `
uniform sampler2D nightLightData;
uniform sampler2D nightLightCells;
uniform sampler2D nightLightIndices;
uniform int nightLightCount;
uniform vec4 nightLightGrid;
uniform vec2 nightLightGridSize;
uniform vec2 nightLightIndexSize;
uniform mat4 nightLightCameraWorld;
`;
const lighting = `
#if defined( RE_Direct )
if (nightLightCount > 0) {
  vec3 nightWorldPosition = (nightLightCameraWorld * vec4(geometryPosition, 1.0)).xyz;
  vec2 nightCell = floor((nightWorldPosition.xz - nightLightGrid.xy) / nightLightGrid.z);
  if (all(greaterThanEqual(nightCell, vec2(0.0))) && all(lessThan(nightCell, nightLightGridSize))) {
    vec2 nightRange = texture2D(nightLightCells, (nightCell + 0.5) / ${NIGHT_GRID_SIDE}.0).xy;
    for (int nightI = 0; nightI < ${NIGHT_LIGHT_CAPACITY}; nightI++) {
      if (float(nightI) >= nightRange.y) break;
      float nightOffset = nightRange.x + float(nightI);
      vec2 nightIndexUV = (vec2(mod(nightOffset, nightLightIndexSize.x), floor(nightOffset / nightLightIndexSize.x)) + 0.5) / nightLightIndexSize;
      float nightIndex = texture2D(nightLightIndices, nightIndexUV).r;
      vec4 nightPosition = texture2D(nightLightData, vec2((nightIndex + 0.5) / ${NIGHT_LIGHT_CAPACITY}.0, 0.25));
      vec3 nightDelta = nightPosition.xyz - geometryPosition;
      float nightDistanceSq = dot(nightDelta, nightDelta);
      if (nightDistanceSq >= nightPosition.w * nightPosition.w) continue;
      #if defined( LAMBERT ) || defined( PHONG ) || ( defined( STANDARD ) && !defined( USE_CLEARCOAT ) && !defined( USE_TRANSMISSION ) )
        if (dot(geometryNormal, nightDelta) <= 0.0) continue;
      #endif
      vec4 nightColor = texture2D(nightLightData, vec2((nightIndex + 0.5) / ${NIGHT_LIGHT_CAPACITY}.0, 0.75));
      float nightInverseDistance = inversesqrt(max(nightDistanceSq, 1e-20));
      directLight.direction = nightDelta * nightInverseDistance;
      #ifdef LEGACY_LIGHTS
        float nightAttenuation = getDistanceAttenuation(nightDistanceSq * nightInverseDistance, nightPosition.w, nightColor.a);
      #else
        // Algebraically identical attenuation using squared distances; reuse
        // the normalization above instead of taking another square root.
        float nightCutoffRatio = nightDistanceSq / (nightPosition.w * nightPosition.w);
        float nightWindow = saturate(1.0 - nightCutoffRatio * nightCutoffRatio);
        float nightAttenuation = nightWindow * nightWindow / max(pow(nightDistanceSq, nightColor.a * 0.5), 0.01);
      #endif
      directLight.color = nightColor.rgb * nightAttenuation;
      directLight.visible = true;
      RE_Direct(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
    }
  }
}
#endif
`;

// Same Three.js direct-light equation, with a small local list per fragment.
// Moving/changing lights updates textures, never NUM_POINT_LIGHTS or shaders.
export class NightLighting {
  constructor(THREE) {
    this.THREE=THREE;this.grid=new NightLightGrid();this.materials=new WeakSet();
    this.viewLights=new Float32Array(this.grid.lights.length);
    this.lastView=new Float64Array(16).fill(NaN);
    this.data=this.texture(this.viewLights,NIGHT_LIGHT_CAPACITY,2);
    this.cells=this.texture(this.grid.cells,NIGHT_GRID_SIDE,NIGHT_GRID_SIDE);
    this.indices=this.texture(this.grid.indices,NIGHT_INDEX_WIDTH,1);
    this.uniforms={
      nightLightData:{value:this.data},nightLightCells:{value:this.cells},nightLightIndices:{value:this.indices},
      nightLightCount:{value:0},nightLightGrid:{value:new THREE.Vector4()},
      nightLightGridSize:{value:new THREE.Vector2()},nightLightIndexSize:{value:new THREE.Vector2(NIGHT_INDEX_WIDTH,1)},
      nightLightCameraWorld:{value:new THREE.Matrix4()}
    };
  }
  texture(data,width,height) {
    const t=new this.THREE.DataTexture(data,width,height,this.THREE.RGBAFormat,this.THREE.FloatType);
    t.minFilter=t.magFilter=this.THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;
    return t;
  }
  decorate(material) {
    if(!material||this.materials.has(material))return;
    if(!(material.isMeshLambertMaterial||material.isMeshPhongMaterial||material.isMeshStandardMaterial||material.isMeshToonMaterial))return;
    this.materials.add(material);
    const before=material.onBeforeCompile,key=material.customProgramCacheKey();
    material.onBeforeCompile=(shader,renderer)=>{
      before.call(material,shader,renderer);
      Object.assign(shader.uniforms,this.uniforms);
      // Terrain variants preserve their source material's shader hook. That
      // hook may already install these lights; cloning must not inject twice.
      if(shader.fragmentShader.includes('uniform sampler2D nightLightData;'))return;
      shader.fragmentShader=declarations+shader.fragmentShader.replace('#include <lights_fragment_begin>','#include <lights_fragment_begin>\n'+lighting);
    };
    material.customProgramCacheKey=()=>`${key}:local-night-lights-v1`;
    material.needsUpdate=true;
  }
  update(sources,camera,scene) {
    const g=this.grid,changed=g.update(sources);
    camera.updateMatrixWorld();
    this.uniforms.nightLightCount.value=g.count;
    this.uniforms.nightLightCameraWorld.value=camera.matrixWorld;
    if(g.count){
      // Transform each source once on the CPU, as Three.js does. Per-fragment
      // matrix multiplication would repeat this work for every nearby light.
      const m=camera.matrixWorldInverse.elements;
      let cameraChanged=false;for(let i=0;i<16;i++)if(this.lastView[i]!==m[i]){cameraChanged=true;this.lastView[i]=m[i];}
      if(changed||cameraChanged){
        this.viewLights.set(g.lights);
        for(let i=0;i<g.count;i++){
          const at=i*4,x=g.lights[at],y=g.lights[at+1],z=g.lights[at+2];
          this.viewLights[at]=m[0]*x+m[4]*y+m[8]*z+m[12];
          this.viewLights[at+1]=m[1]*x+m[5]*y+m[9]*z+m[13];
          this.viewLights[at+2]=m[2]*x+m[6]*y+m[10]*z+m[14];
        }
        this.data.needsUpdate=true;
      }
      this.uniforms.nightLightGrid.value.set(g.originX,g.originZ,g.cellSize,0);
      this.uniforms.nightLightGridSize.value.set(g.width,g.height);
      if(this.indices.image.data!==g.indices){
        this.indices.dispose();this.indices=this.texture(g.indices,NIGHT_INDEX_WIDTH,g.indices.length/(NIGHT_INDEX_WIDTH*4));
        this.uniforms.nightLightIndices.value=this.indices;
        this.uniforms.nightLightIndexSize.value.set(this.indices.image.width,this.indices.image.height);
      }
      if(changed)this.cells.needsUpdate=this.indices.needsUpdate=true;
    }
    scene.traverseVisible(object=>{
      if(Array.isArray(object.material)){for(const m of object.material)this.decorate(m);}
      else this.decorate(object.material);
    });
  }
  dispose(){this.data.dispose();this.cells.dispose();this.indices.dispose();}
}
