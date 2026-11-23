import {NightLightGrid,NIGHT_LIGHT_CAPACITY,NIGHT_GRID_SIDE,NIGHT_INDEX_WIDTH} from './night_light_grid.js';

const declarations = `
uniform sampler2D nightLightData;
uniform sampler2D nightLightCells;
uniform sampler2D nightLightIndices;
uniform int nightLightCount;
uniform sampler2D nightLightBlockers;
uniform float nightLightBlockerWidth;
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
      // Test the open segment: the receiving facade must not shadow itself.
      vec3 nightRay = nightWorldPosition - (nightLightCameraWorld * vec4(nightPosition.xyz, 1.0)).xyz;
      vec3 nightStart = nightWorldPosition - nightRay;
      float nightBlockerCount = texture2D(nightLightBlockers, vec2(0.5 / nightLightBlockerWidth, (nightIndex + 0.5) / 256.0)).w;
      bool nightBlocked = false;
      for (int blocker = 0; blocker < 1024; blocker++) {
        if (float(blocker) >= nightBlockerCount) break;
        vec2 uv = vec2((float(blocker) * 2.0 + 0.5) / nightLightBlockerWidth, (nightIndex + 0.5) / 256.0);
        vec3 lo = texture2D(nightLightBlockers, uv).xyz;
        vec3 hi = texture2D(nightLightBlockers, uv + vec2(1.0 / nightLightBlockerWidth, 0.0)).xyz;
        vec3 safeRay = mix(vec3(1e-7), nightRay, step(vec3(1e-7), abs(nightRay)));
        vec3 a = (lo - nightStart) / safeRay, b = (hi - nightStart) / safeRay;
        vec3 nearHit = min(a, b), farHit = max(a, b);
        float enter = max(max(nearHit.x, nearHit.y), nearHit.z);
        float leave = min(min(farHit.x, farHit.y), farHit.z);
        float endpointBias = 0.04 / max(length(nightRay), 0.04);
        if (max(enter, endpointBias) < min(leave, 1.0 - endpointBias)) { nightBlocked = true; break; }
      }
      if (nightBlocked) continue;
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
    this.blockers=this.texture(new Float32Array(256*8),2,256);
    this.uniforms={
      nightLightBlockers:{value:this.blockers},nightLightBlockerWidth:{value:2},
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
  updateBlockers(boxes,lightsChanged) {
    const revision=boxes?.revision;
    // The renderer reuses the same box list until city structure or terrain
    // changes, so a matching revision needs no serialization or comparison.
    if(revision!==undefined&&boxes===this.blockerSource&&revision===this.blockerRevision&&!lightsChanged)return;
    const signature=revision!==undefined?`${revision}:${boxes.length}`:JSON.stringify(boxes);
    this.blockerSource=boxes;this.blockerRevision=revision;
    if(!lightsChanged&&signature===this.blockerSignature)return;
    this.blockerSignature=signature;
    const lists=[];let width=2;
    for(let i=0;i<this.grid.count;i++){
      const at=i*4,[x,y,z,r]=this.grid.lights.subarray(at,at+4);
      const nearby=boxes.filter(b=>Math.hypot(Math.max(b.min[0]-x,0,x-b.max[0]),Math.max(b.min[1]-y,0,y-b.max[1]),Math.max(b.min[2]-z,0,z-b.max[2]))<r);
      lists.push(nearby);width=Math.max(width,nearby.length*2);
    }
    // Grow rows to fit every candidate; never silently drop an occluder.
    const data=new Float32Array(width*256*4);
    for(let i=0;i<lists.length;i++){
      for(let j=0;j<lists[i].length;j++){const at=(i*width+j*2)*4;data.set(lists[i][j].min,at);data.set(lists[i][j].max,at+4);}
      data[i*width*4+3]=lists[i].length;
    }
    const old=this.blockers.image.data;
    if(old.length===data.length&&data.every((v,i)=>v===old[i]))return;
    if(old.length!==data.length){this.blockers.dispose();this.blockers=this.texture(data,width,256);this.uniforms.nightLightBlockers.value=this.blockers;}
    else {old.set(data);this.blockers.needsUpdate=true;}
    this.uniforms.nightLightBlockerWidth.value=width;
  }
  update(sources,camera,scene,blockers=[]) {
    const g=this.grid,changed=g.update(sources);
    this.uniforms.nightLightCount.value=g.count;
    // Daytime and unlit interiors have no candidates. Skip blocker rebuilds
    // and the full scene material scan until a light actually exists.
    if(!g.count)return;
    this.updateBlockers(blockers,changed);
    camera.updateMatrixWorld();
    this.uniforms.nightLightCameraWorld.value=camera.matrixWorld;
    {
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
  dispose(){this.data.dispose();this.cells.dispose();this.indices.dispose();this.blockers.dispose();}
}

export function hasOutdoorTorch(entity) {
  const p=entity.properties;
  if(!p||p.citizen?.indoorLocation)return false;
  return [p.arm_left?.heldItem,p.arm_right?.heldItem,p.heldItem]
    .some(item=>item?.resourceType==='torch'&&item.fuel>0);
}
