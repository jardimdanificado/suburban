import {MOBILITY_GROUND_CONTACTS} from './city_mobility_models.js?v=ground-contacts-1';
export const VEHICLE_CONTACTS = MOBILITY_GROUND_CONTACTS;
const turn = (a,b) => Math.atan2(Math.sin(b-a),Math.cos(b-a));
const contact = (x,z,angle,offset) => ({x:x+Math.cos(angle)*offset[0]+Math.sin(angle)*offset[1],z:z-Math.sin(angle)*offset[0]+Math.cos(angle)*offset[1]});
export const GRASS_TRACK_HOLD = 12, GRASS_TRACK_LIFE = 24, SAND_TRACK_HOLD = 30, SAND_TRACK_LIFE = 55;
export function trackStrength(age, hold, life) {
  const t=Math.max(0,Math.min(1,(age-hold)/(life-hold)));
  return 1-t*t*(3-2*t);
}

// Distance-based contacts remain identical at different frame rates. Teleports,
// boarding, and entering interiors reset history instead of drawing connectors.
export class TerrainTrackMotion {
  constructor(){this.history=new WeakMap();}
  reset(entity){this.history.delete(entity);}
  move(entity,{x,z,angle=0,vehicle=null,scale=1},time){
    const previous=this.history.get(entity),state={x,z,angle,vehicle,time,remainder:previous?.remainder||0,foot:previous?.foot||0};
    this.history.set(entity,state);
    if(!previous||previous.vehicle!==vehicle||time-previous.time>1)return [];
    const dx=x-previous.x,dz=z-previous.z,distance=Math.hypot(dx,dz),rotation=turn(previous.angle,angle),stamps=[];
    if(distance>3||!Number.isFinite(distance)){state.remainder=0;return stamps;}
    if(vehicle){
      const wheels=VEHICLE_CONTACTS[vehicle];if(!wheels||distance<.001&&Math.abs(rotation)<.005)return stamps;
      const steps=Math.max(1,Math.ceil(Math.max(distance/.06,Math.abs(rotation)/.08)));
      for(let step=1;step<=steps;step++){
        const a=(step-1)/steps,b=step/steps;
        for(const wheel of wheels){
          const from=contact(previous.x+dx*a,previous.z+dz*a,previous.angle+rotation*a,wheel);
          const to=contact(previous.x+dx*b,previous.z+dz*b,previous.angle+rotation*b,wheel);
          const length=Math.hypot(to.x-from.x,to.z-from.z);
          if(length<.0001)continue;
          stamps.push({x:(from.x+to.x)/2,z:(from.z+to.z)/2,angle:Math.atan2(to.x-from.x,to.z-from.z),width:wheel[2],length:length+wheel[2],kind:0});
        }
      }
    }else if(distance>.00001){
      const stride=.25*scale;
      for(let along=stride-state.remainder;along<=distance+1e-8;along+=stride){
        const ratio=along/distance,heading=previous.angle+rotation*ratio,side=state.foot++%2?1:-1;
        stamps.push({x:previous.x+dx*ratio+Math.cos(heading)*side*.075*scale,z:previous.z+dz*ratio-Math.sin(heading)*side*.075*scale,
          angle:heading,width:.10*scale,length:.22*scale,kind:side});
      }
      state.remainder=(state.remainder+distance)%stride;
    }
    return stamps;
  }
}

// A timestamp atlas is painted only where new contacts arrive. Old marks fade
// in the terrain shaders, without rebuilding chunks or uploading a world mask.
export function createTerrainTrackUniforms(THREE){
  const empty=new THREE.DataTexture(new Uint8Array(4),1,1,THREE.RGBAFormat);empty.needsUpdate=true;
  return {terrainTrackMap:{value:empty},terrainTrackWorldSize:{value:new THREE.Vector2(1,1)},terrainTrackTexel:{value:new THREE.Vector2(1,1)},terrainTrackTime:{value:0}};
}
export const TERRAIN_TRACK_GLSL = `
  uniform sampler2D terrainTrackMap;
  uniform vec2 terrainTrackWorldSize;
  uniform float terrainTrackTime;
  uniform vec2 terrainTrackTexel;
  float terrainTrackStrength(vec2 world, float hold, float life) {
    vec2 uv = world / terrainTrackWorldSize;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
    vec4 mark = texture2D(terrainTrackMap, uv);
    float born = dot(floor(mark.rgb * 255.0 + .5), vec3(65536.0, 256.0, 1.0)) * .1;
    return mark.a * (1.0 - smoothstep(hold, life, max(0.0, terrainTrackTime - born)));
  }
`;
function addGroundTracksToMaterial(material,uniforms,grass){
  const hold=grass?GRASS_TRACK_HOLD:SAND_TRACK_HOLD,life=grass?GRASS_TRACK_LIFE:SAND_TRACK_LIFE;
  const compile=material.onBeforeCompile,cacheKey=material.customProgramCacheKey.bind(material);
  const programKey=cacheKey();
  material.onBeforeCompile=shader=>{
    compile?.call(material,shader);Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vTrackWorld;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvTrackWorld = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec2 vTrackWorld;\n${TERRAIN_TRACK_GLSL}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
        float imprint = terrainTrackStrength(vTrackWorld, ${hold.toFixed(1)}, ${life.toFixed(1)});
        vec2 texel = terrainTrackTexel;
        float lip = terrainTrackStrength(vTrackWorld + texel * vec2(.8, .8), ${hold.toFixed(1)}, ${life.toFixed(1)}) - imprint;
        ${grass ? 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.065, .046, .025), imprint * .72);' : 'diffuseColor.rgb *= 1.0 - imprint * .32 + lip * .12;'}
      `);
  };
  material.customProgramCacheKey=()=>`${programKey}|ground-contact-tracks-v2-${grass}`;
}

export function addSandTracksToMaterial(material,uniforms){addGroundTracksToMaterial(material,uniforms,false);}
export function addGrassTracksToMaterial(material,uniforms){addGroundTracksToMaterial(material,uniforms,true);}

export class TerrainTracks {
  constructor(THREE,uniforms){
    this.THREE=THREE;this.uniforms=uniforms;this.empty=uniforms.terrainTrackMap.value;this.motion=new TerrainTrackMotion();
    this.scene=new THREE.Scene();this.camera=new THREE.Camera();this.time=0;
    this.material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false,
      uniforms:{...uniforms},vertexShader:`
        attribute vec4 contactShape; attribute vec2 contactInfo; varying vec2 vContact; varying float vContactKind;
        uniform vec2 terrainTrackWorldSize;
        void main(){
          vContact=position.xy; vContactKind=contactInfo.y;
          vec2 local=position.xy * contactShape.zw * .5;
          float c=cos(contactInfo.x),s=sin(contactInfo.x);
          vec2 world=contactShape.xy + vec2(c*local.x+s*local.y,-s*local.x+c*local.y);
          gl_Position=vec4(world / terrainTrackWorldSize * 2.0 - 1.0,0.0,1.0);
        }`,fragmentShader:`
        uniform float terrainTrackTime; varying vec2 vContact; varying float vContactKind;
        void main(){
          if(abs(vContactKind)>.5){
            vec2 p=vContact;
            // Rounded toe, narrower heel, and a small arch cut on the inner side.
            float toe=length(vec2(p.x/.96,(p.y-.30)/.70));
            float heel=length(vec2(p.x/.73,(p.y+.66)/.34));
            if(min(toe,heel)>1.0 || p.x*vContactKind>.55 && p.y>-.45 && p.y<-.05)discard;
          }
          float ticks=floor(terrainTrackTime*10.0);
          vec3 packed=vec3(floor(ticks/65536.0),floor(mod(ticks,65536.0)/256.0),mod(ticks,256.0));
          gl_FragColor=vec4(packed/255.0,1.0);
        }`});
  }
  clear(){
    this.target?.dispose();this.target=null;this.world=null;this.time=0;this.motion=new TerrainTrackMotion();
    this.uniforms.terrainTrackMap.value=this.empty;this.uniforms.terrainTrackTime.value=0;
  }
  ensureWorld(renderer,world){
    if(this.world===world&&this.width===world.width&&this.height===world.height)return;
    this.clear();this.world=world;this.width=world.width;this.height=world.height;
    const T=this.THREE,limit=Math.min(4096,renderer.capabilities.maxTextureSize);
    this.target=new T.WebGLRenderTarget(Math.min(limit,world.width*32),Math.min(limit,world.height*32),{
      minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});
    this.uniforms.terrainTrackMap.value=this.target.texture;this.uniforms.terrainTrackWorldSize.value.set(world.width,world.height);
    this.uniforms.terrainTrackTexel.value.set(world.width/this.target.width,world.height/this.target.height);
    const old=renderer.getRenderTarget(),color=renderer.getClearColor(new T.Color()).clone(),alpha=renderer.getClearAlpha();
    renderer.setRenderTarget(this.target);renderer.setClearColor(0,0);renderer.clear();renderer.setClearColor(color,alpha);renderer.setRenderTarget(old);
  }
  paint(renderer,stamps){
    if(!stamps.length)return;
    const T=this.THREE;
    if(!this.mesh||this.capacity<stamps.length){
      if(this.mesh){this.scene.remove(this.mesh);this.mesh.geometry.dispose();}
      this.capacity=2**Math.ceil(Math.log2(Math.max(64,stamps.length)));
      const geometry=new T.InstancedBufferGeometry();
      geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));geometry.setIndex([0,1,2,0,2,3]);
      geometry.setAttribute('contactShape',new T.InstancedBufferAttribute(new Float32Array(this.capacity*4),4).setUsage(T.DynamicDrawUsage));
      geometry.setAttribute('contactInfo',new T.InstancedBufferAttribute(new Float32Array(this.capacity*2),2).setUsage(T.DynamicDrawUsage));
      this.mesh=new T.Mesh(geometry,this.material);this.mesh.frustumCulled=false;this.scene.add(this.mesh);
    }
    const shape=this.mesh.geometry.getAttribute('contactShape'),info=this.mesh.geometry.getAttribute('contactInfo');
    stamps.forEach((s,i)=>{shape.setXYZW(i,s.x,s.z,s.width,s.length);info.setXY(i,s.angle,s.kind);});
    shape.needsUpdate=info.needsUpdate=true;this.mesh.geometry.instanceCount=stamps.length;
    const old=renderer.getRenderTarget(),autoClear=renderer.autoClear,shadowUpdate=renderer.shadowMap.autoUpdate,shadowNeedsUpdate=renderer.shadowMap.needsUpdate;
    renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
    renderer.setRenderTarget(this.target);renderer.render(this.scene,this.camera);renderer.setRenderTarget(old);
    renderer.autoClear=autoClear;renderer.shadowMap.autoUpdate=shadowUpdate;renderer.shadowMap.needsUpdate=shadowNeedsUpdate;
  }
  update(renderer,world,entities,dt,models,offsets,bounds){
    this.ensureWorld(renderer,world);this.time+=Math.max(0,dt);this.uniforms.terrainTrackTime.value=this.time;
    if(dt<=0)return;
    const stamps=[];
    for(const entity of entities){
      const citizen=entity.properties?.citizen,vehicle=entity.properties?.cityVehicle;
      if(!citizen&&!vehicle)continue;
      const elevated=citizen&&(citizen.skybridgeZ>0||citizen._renderIndoorPosition?.z>0||citizen.furnitureUse?.seated||citizen.furnitureUse?.pose==='lying');
      if(entity.destroyed||citizen&&(citizen.ridingVehicleId||citizen.indoorLocation||elevated)||vehicle&&(vehicle.boatClass||vehicle.ferrying||vehicle.scrapped)) {this.motion.reset(entity);continue;}
      const motion=citizen&&models?.motion?.get(entity),visible=motion&&Number.isFinite(motion.bodyX)&&Number.isFinite(motion.bodyZ)&&motion.bodyFrame===models.frameToken;
      const offset=offsets?.get(entity.id),x=visible?motion.bodyX:entity.x+(offset?.x||0),z=visible?motion.bodyZ:entity.y+(offset?.y||0);
      if(bounds&&(x<bounds.renderedMinTx-2||x>bounds.renderedMaxTx+2||z<bounds.renderedMinTy-2||z>bounds.renderedMaxTy+2)){this.motion.reset(entity);continue;}
      const angle=vehicle?vehicle.angle||0:motion?.renderAngle||0;
      stamps.push(...this.motion.move(entity,{x,z,angle,vehicle:vehicle?.good||null,scale:motion?.bodySize||1},this.time));
    }
    this.paint(renderer,stamps);
  }
}
