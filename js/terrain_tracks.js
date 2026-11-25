import {isDirtRoad,dirtRoadGround,permanentRoadContacts} from './dirt_road_visuals.js';
import {BOAT_HULL_DIMENSIONS,BOAT_CLASSES} from './boat_types.js?v=local-sea-travel-2';
import {TILE_SAND,TILE_WATER,TILE_VOID,TILE_ROAD_GRASS,TILE_ROAD_HILL,TILE_FLOOR,TILE_HILL} from './world_gen.js';
import {MOBILITY_GROUND_CONTACTS} from './city_mobility_models.js?v=ground-contacts-1';
import {ANIMAL_SPECIES} from './animal_catalog.js?v=fauna-scale-2';
export const VEHICLE_CONTACTS = MOBILITY_GROUND_CONTACTS;
const turn = (a,b) => Math.atan2(Math.sin(b-a),Math.cos(b-a));
const contact = (x,z,angle,offset) => ({x:x+Math.cos(angle)*offset[0]+Math.sin(angle)*offset[1],z:z-Math.sin(angle)*offset[0]+Math.cos(angle)*offset[1]});

export function animalTrackProfile(species) {
  const spec = ANIMAL_SPECIES[species] || {};
  const size = spec.size || 0.5;
  if (species === 'boi') return { quad: true, lateral: 0.16, frontZ: 0.31, rearZ: -0.30, width: 0.14, length: 0.16, stride: 0.36, grass: true };
  if (species === 'vaca') return { quad: true, lateral: 0.15, frontZ: 0.30, rearZ: -0.29, width: 0.13, length: 0.15, stride: 0.34, grass: true };
  if (species === 'cavalo') return { quad: true, lateral: 0.145, frontZ: 0.34, rearZ: -0.33, width: 0.13, length: 0.15, stride: 0.42, grass: true };
  if (species === 'anta') return { quad: true, lateral: 0.13, frontZ: 0.24, rearZ: -0.23, width: 0.12, length: 0.14, stride: 0.30, grass: true };
  if (species === 'porco' || species === 'javali') return { quad: true, lateral: 0.115, frontZ: 0.20, rearZ: -0.19, width: 0.085, length: 0.10, stride: 0.24, grass: true };
  if (species === 'ovelha' || species === 'cabra') return { quad: true, lateral: 0.11, frontZ: 0.18, rearZ: -0.17, width: 0.075, length: 0.09, stride: 0.24, grass: true };
  if (species === 'onca' || species === 'lobo_guara' || species === 'veado') return { quad: true, lateral: 0.09, frontZ: 0.19, rearZ: -0.18, width: 0.085, length: 0.105, stride: 0.28, grass: true };
  if (species === 'capivara' || species === 'tamandua') return { quad: true, lateral: 0.10, frontZ: 0.17, rearZ: -0.16, width: 0.08, length: 0.10, stride: 0.22, grass: true };
  if (species === 'jacare') return { quad: true, lateral: 0.17, frontZ: 0.19, rearZ: -0.19, width: 0.095, length: 0.12, stride: 0.24, grass: true };
  if (species === 'ema') return { quad: false, lateral: 0.075, width: 0.09, length: 0.14, stride: 0.34, grass: true };
  if (species === 'garca' || species === 'colhereiro' || species === 'guara') return { quad: false, lateral: 0.045, width: 0.055, length: 0.085, stride: 0.24, grass: false };
  if (species === 'galinha' || species === 'pato') return { quad: false, lateral: 0.038, width: 0.045, length: 0.065, stride: 0.16, grass: false };
  if (spec.canFly) return { quad: false, lateral: Math.max(0.018, size * 0.07), width: Math.max(0.025, size * 0.09), length: Math.max(0.04, size * 0.14), stride: 0.14, grass: false };
  if (species === 'iguana' || species === 'tatu' || species === 'coelho' || species === 'quati' || species === 'macaco' || species === 'mico_leao' || species === 'sagui' || species === 'preguica') {
    return { quad: true, lateral: Math.max(0.035, size * 0.16), frontZ: Math.max(0.05, size * 0.22), rearZ: -Math.max(0.05, size * 0.21), width: Math.max(0.035, size * 0.12), length: Math.max(0.045, size * 0.15), stride: Math.max(0.14, size * 0.38), grass: size >= 0.4 };
  }
  return { quad: false, lateral: Math.max(0.03, size * 0.1), width: Math.max(0.04, size * 0.12), length: Math.max(0.06, size * 0.2), stride: Math.max(0.16, size * 0.4), grass: size >= 0.45 };
}
export const GRASS_TRACK_HOLD = 36, GRASS_TRACK_LIFE = 72, SAND_TRACK_HOLD = 30, SAND_TRACK_LIFE = 55;
export const DEPOSIT_HOLD = 24, DEPOSIT_LIFE = 84;
export function trackStrength(age, hold, life) {
  const t=Math.max(0,Math.min(1,(age-hold)/(life-hold)));
  return 1-t*t*(3-2*t);
}

// Sparse CPU mirror of contact wear. No GPU readback or whole-map updates.
// Sixteen samples per tile axis resolve individual feet; recovery is lazy.
export class GrassWear {
  constructor(){this.cells=new Map();this.sweep=null;}
  strength(x,z,world,time){
    if(x<0||z<0||x>=world.width||z>=world.height)return 0;
    const key=Math.floor(z*16)*world.width*16+Math.floor(x*16),born=this.cells.get(key);
    if(born===Infinity){
      const tile=world.getTile?world.getTile(Math.floor(x),Math.floor(z)):world.map?.[Math.floor(z)*world.width+Math.floor(x)];
      return isDirtRoad(tile)?1:0;
    }
    return born==null?0:trackStrength(time-born,GRASS_TRACK_HOLD,GRASS_TRACK_LIFE);
  }
  coverage(stamp,world,time){
    const c=Math.cos(stamp.angle),s=Math.sin(stamp.angle);
    let total=0;
    for(const [u,v] of [[0,0],[-.25,0],[.25,0],[0,-.25],[0,.25]]){
      const x=u*stamp.width,z=v*stamp.length;
      total+=this.strength(stamp.x+c*x+s*z,stamp.z-s*x+c*z,world,time);
    }
    return total/5;
  }
  record(stamps,world,time){
    if(!world.width||!world.height)return;
    for(const stamp of stamps){
      if(stamp.noGrassWear)continue;
      const c=Math.cos(stamp.angle),s=Math.sin(stamp.angle),rx=(Math.abs(c)*stamp.width+Math.abs(s)*stamp.length)/2,rz=(Math.abs(s)*stamp.width+Math.abs(c)*stamp.length)/2;
      const minX=Math.max(0,Math.floor((stamp.x-rx)*16)),maxX=Math.min(world.width*16-1,Math.floor((stamp.x+rx)*16));
      const minZ=Math.max(0,Math.floor((stamp.z-rz)*16)),maxZ=Math.min(world.height*16-1,Math.floor((stamp.z+rz)*16));
      for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
        const tx=Math.floor((x+.5)/16),tz=Math.floor((z+.5)/16),tile=world.getTile?world.getTile(tx,tz):world.map?.[tz*world.width+tx];
        if(tile!=null&&dirtRoadGround(tile)!==TILE_FLOOR&&dirtRoadGround(tile)!==TILE_HILL)continue;
        const dx=(x+.5)/16-stamp.x,dz=(z+.5)/16-stamp.z,u=2*(c*dx-s*dz)/stamp.width,v=2*(s*dx+c*dz)/stamp.length;
        if(Math.abs(stamp.kind)>1.5){if(u*u+v*v>1)continue;}
        else if(Math.abs(stamp.kind)>.5){
          const toe=Math.hypot(u/.96,(v-.30)/.70),heel=Math.hypot(u/.73,(v+.66)/.34);
          if(Math.min(toe,heel)>1||u*stamp.kind>.55&&v>-.45&&v<-.05)continue;
        }
        this.cells.set(z*world.width*16+x,isDirtRoad(tile)?Infinity:Math.floor(time*10)/10);
      }
    }
  }
  prune(time,budget=256,world=null){
    this.sweep??=this.cells.entries();
    for(let i=0;i<budget;i++){
      const next=this.sweep.next();if(next.done){this.sweep=null;break;}
      const [key,born]=next.value;
      const x=world?Math.floor((key%(world.width*16))/16):0,z=world?Math.floor(Math.floor(key/(world.width*16))/16):0;
      const removedRoad=born===Infinity&&world&&!isDirtRoad(world.getTile?world.getTile(x,z):world.map?.[z*world.width+x]);
      if(removedRoad||time-born>=GRASS_TRACK_LIFE)this.cells.delete(key);
    }
  }
}

// Distance-based contacts remain identical at different frame rates. Teleports,
// boarding, and entering interiors reset history instead of drawing connectors.
export class TerrainTrackMotion {
  constructor(){this.history=new WeakMap();}
  reset(entity){this.history.delete(entity);}
  move(entity,{x,z,angle=0,vehicle=null,scale=1,hull=null,animalProfile=null},time){
    const previous=this.history.get(entity),state={x,z,angle,vehicle,time,remainder:previous?.remainder||0,foot:previous?.foot||0};
    this.history.set(entity,state);
    if(!previous||previous.vehicle!==vehicle||time-previous.time>1)return [];
    const dx=x-previous.x,dz=z-previous.z,distance=Math.hypot(dx,dz),rotation=turn(previous.angle,angle),stamps=[];
    if(distance>3||!Number.isFinite(distance)){state.remainder=0;return stamps;}
    if(hull){
      if(distance<.001&&Math.abs(rotation)<.005)return stamps;
      const steps=Math.max(1,Math.ceil(Math.max(distance/.08,Math.abs(rotation)/.08)));
      for(let step=1;step<=steps;step++){const ratio=step/steps;stamps.push({x:previous.x+dx*ratio,z:previous.z+dz*ratio,angle:previous.angle+rotation*ratio,width:hull.width,length:hull.length,kind:2,carryDistance:Math.max(distance,Math.abs(rotation)*Math.hypot(hull.width,hull.length)/2)/steps});}
    }else if(vehicle){
      const wheels=VEHICLE_CONTACTS[vehicle];if(!wheels||distance<.001&&Math.abs(rotation)<.005)return stamps;
      const steps=Math.max(1,Math.ceil(Math.max(distance/.06,Math.abs(rotation)/.08)));
      for(let step=1;step<=steps;step++){
        const a=(step-1)/steps,b=step/steps;
        for(const [wheelIndex,wheel] of wheels.entries()){
          const from=contact(previous.x+dx*a,previous.z+dz*a,previous.angle+rotation*a,wheel);
          const to=contact(previous.x+dx*b,previous.z+dz*b,previous.angle+rotation*b,wheel);
          const length=Math.hypot(to.x-from.x,to.z-from.z);
          if(length<.0001)continue;
          stamps.push({x:(from.x+to.x)/2,z:(from.z+to.z)/2,angle:Math.atan2(to.x-from.x,to.z-from.z),width:wheel[2],length:length+wheel[2],kind:0,carryContact:wheelIndex,carryDistance:length});
        }
      }
    }else if(animalProfile&&distance>.00001){
      const stride=animalProfile.stride;
      for(let along=stride-state.remainder;along<=distance+1e-8;along+=stride){
        const ratio=along/distance,heading=previous.angle+rotation*ratio,side=state.foot++%2?1:-1;
        const bx=previous.x+dx*ratio,bz=previous.z+dz*ratio;
        if(animalProfile.quad){
          const front=contact(bx,bz,heading,[side*animalProfile.lateral,animalProfile.frontZ]);
          const rear=contact(bx,bz,heading,[-side*animalProfile.lateral,animalProfile.rearZ]);
          stamps.push({x:front.x,z:front.z,angle:heading,width:animalProfile.width,length:animalProfile.length,kind:side,noGrassWear:!animalProfile.grass});
          stamps.push({x:rear.x,z:rear.z,angle:heading,width:animalProfile.width,length:animalProfile.length,kind:-side,noGrassWear:!animalProfile.grass});
        }else{
          const foot=contact(bx,bz,heading,[side*animalProfile.lateral,0]);
          stamps.push({x:foot.x,z:foot.z,angle:heading,width:animalProfile.width,length:animalProfile.length,kind:side,noGrassWear:!animalProfile.grass});
        }
      }
      state.remainder=(state.remainder+distance)%stride;
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


// Sand stays on each shoe for only three contacts after leaving the beach.
// Wheels and dragged hulls shed their load over .75 world units of contact travel.
export class SandCarry {
  constructor(){this.history=new WeakMap();}
  reset(entity){this.history.delete(entity);}
  contacts(entity,stamps,world,sourceTiles=[TILE_SAND],kind='sand',sourceAmount=null){
    if(!stamps.length)return [];
    const shoes=this.history.get(entity)||new Map(),deposits=[];
    this.history.set(entity,shoes);
    for(const stamp of stamps){
      const walking=Math.abs(stamp.kind)===1;
      const x=Math.floor(stamp.x),z=Math.floor(stamp.z),foot=walking?(stamp.kind<0?0:1):stamp.kind===2?'hull':`wheel:${stamp.carryContact}`;
      const capacity=walking?3:.75,state=shoes.get(foot)||{remaining:0,load:0};
      shoes.set(foot,state);
      const tile=x<0||z<0||x>=world.width||z>=world.height?TILE_VOID:(world.getTile?world.getTile(x,z):world.map?.[z*world.width+x]);
      if(sourceTiles.includes(dirtRoadGround(tile))){state.remaining=capacity;state.load=Math.max(0,Math.min(1,sourceAmount?sourceAmount(stamp,tile):1));continue;}
      if(tile===TILE_WATER||tile===TILE_VOID){state.remaining=0;continue;}
      if(state.remaining>0){
        const amount=state.remaining;
        state.remaining=Math.max(0,state.remaining-(walking?1:stamp.carryDistance||0));
        // Stable contact hash: probability and grains do not change with FPS.
        const chance=Math.sin(stamp.x*127.1+stamp.z*311.7+(walking?foot:stamp.carryContact||0)*74.7)*43758.5453;
        const load=amount/capacity*state.load;
        if(load>0&&chance-Math.floor(chance)<.8)deposits.push({...stamp,deposit:kind==='dirt'?-load:load});
      }
    }
    return deposits;
  }
}

export class PaintCarry {
  constructor(){this.history=new WeakMap();}
  reset(entity){this.history.delete(entity);}
  contacts(entity,stamps,world,groundArt=[],onStep=null){
    if(!stamps.length)return [];
    const shoes=this.history.get(entity),deposits=[];
    if(!shoes&&!groundArt.length)return deposits;
    const map=shoes||new Map();
    if(!shoes)this.history.set(entity,map);
    for(const stamp of stamps){
      const walking=Math.abs(stamp.kind)===1;
      const foot=walking?(stamp.kind<0?0:1):stamp.kind===2?'hull':`wheel:${stamp.carryContact}`;
      const capacity=walking?3:.75;
      let state=map.get(foot);
      let stepped=null;
      for(let i=0;i<groundArt.length;i++){
        const item=groundArt[i],w=item.width||.86,h=item.height||.86;
        const u=(stamp.x-item.x)/w+.5,v=(stamp.z-item.y)/h+.5;
        if(u>=0&&u<=1&&v>=0&&v<=1){stepped=item;onStep?.(item,u,v,stamp);break;}
      }
      if(stepped){
        if(!state){state={remaining:0,load:0,color:0xffffff};map.set(foot,state);}
        state.remaining=capacity;state.load=1;state.color=stepped.inkColor??0xffffff;
        continue;
      }
      if(!state||state.remaining<=0)continue;
      const x=Math.floor(stamp.x),z=Math.floor(stamp.z);
      const tile=x<0||z<0||x>=world.width||z>=world.height?TILE_VOID:(world.getTile?world.getTile(x,z):world.map?.[z*world.width+x]);
      if(tile===TILE_WATER||tile===TILE_VOID){state.remaining=0;continue;}
      const amount=state.remaining;
      state.remaining=Math.max(0,state.remaining-(walking?1:stamp.carryDistance||0));
      const load=amount/capacity*state.load;
      if(load>0)deposits.push({...stamp,paintColor:state.color,paintLoad:load});
    }
    return deposits;
  }
}

// A timestamp atlas is painted only where new contacts arrive. Old marks fade
// in the terrain shaders, without rebuilding chunks or uploading a world mask.
export function createTerrainTrackUniforms(THREE){
  const empty=new THREE.DataTexture(new Uint8Array(4),1,1,THREE.RGBAFormat);empty.needsUpdate=true;
  return {terrainTrackMap:{value:empty},terrainPermanentTrackMap:{value:empty},terrainPaintMap:{value:empty},terrainTrackWorldSize:{value:new THREE.Vector2(1,1)},terrainTrackTexel:{value:new THREE.Vector2(1,1)},terrainTrackTime:{value:0}};
}
export const TERRAIN_TRACK_GLSL = `
  uniform sampler2D terrainTrackMap;
  uniform sampler2D terrainPermanentTrackMap;
  uniform sampler2D terrainPaintMap;
  uniform vec2 terrainTrackWorldSize;
  uniform float terrainTrackTime;
  uniform vec2 terrainTrackTexel;
  float terrainTrackStrength(vec2 world, float hold, float life) {
    vec2 uv = world / terrainTrackWorldSize;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
    vec4 mark = texture2D(terrainTrackMap, uv);
    float born = dot(floor(mark.rgb * 255.0 + .5), vec3(65536.0, 256.0, 1.0)) * .1;
    return max(step(.1,texture2D(terrainPermanentTrackMap, uv).r), step(.001, mark.a) * (1.0 - smoothstep(hold, life, max(0.0, terrainTrackTime - born))));
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
        vec4 deposit = texture2D(terrainTrackMap, vTrackWorld / terrainTrackWorldSize);
        float permanentDeposit = texture2D(terrainPermanentTrackMap, vTrackWorld / terrainTrackWorldSize).r;
        float depositBorn = dot(floor(deposit.rgb * 255.0 + .5), vec3(65536.0,256.0,1.0)) * .1;
        float sand = deposit.a * (1.0-step(.75,deposit.a)) * (1.0-smoothstep(${DEPOSIT_HOLD.toFixed(1)},${DEPOSIT_LIFE.toFixed(1)},terrainTrackTime-depositBorn));
        float dirt = step(.60,deposit.a)*(1.0-step(.75,deposit.a))*(1.0-smoothstep(${DEPOSIT_HOLD.toFixed(1)},${DEPOSIT_LIFE.toFixed(1)},terrainTrackTime-depositBorn));
        sand = max(sand,step(.25,permanentDeposit)*(1.0-step(.55,permanentDeposit))*(.2+1.5*(permanentDeposit-.3)));
        dirt = max(dirt,step(.55,permanentDeposit));
        float imprint = terrainTrackStrength(vTrackWorld, ${hold.toFixed(1)}, ${life.toFixed(1)});
        vec2 texel = terrainTrackTexel;
        float lip = terrainTrackStrength(vTrackWorld + texel * vec2(.8, .8), ${hold.toFixed(1)}, ${life.toFixed(1)}) - imprint;
        ${grass===null ? '' : grass ? 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.065, .046, .025), imprint * .72);' : 'diffuseColor.rgb *= 1.0 - imprint * .32 + lip * .12;'}
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.64,.49,.26), sand * 1.85);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.34,.23,.12), dirt * 1.35);
        vec4 paintMark = texture2D(terrainPaintMap, vTrackWorld / terrainTrackWorldSize);
        diffuseColor.rgb = mix(diffuseColor.rgb, paintMark.rgb, paintMark.a * .85);
      `);
  };
  material.customProgramCacheKey=()=>`${programKey}|ground-contact-tracks-v9-${grass}`;
}

export function addSandDepositsToMaterial(material,uniforms){addGroundTracksToMaterial(material,uniforms,null);}
export function addSandTracksToMaterial(material,uniforms){addGroundTracksToMaterial(material,uniforms,false);}
export function addGrassTracksToMaterial(material,uniforms){addGroundTracksToMaterial(material,uniforms,true);}

export class TerrainTracks {
  constructor(THREE,uniforms){
    this.THREE=THREE;this.uniforms=uniforms;this.empty=uniforms.terrainTrackMap.value;this.motion=new TerrainTrackMotion();this.sandCarry=new SandCarry();this.dirtCarry=new SandCarry();this.paintCarry=new PaintCarry();this.grassWear=new GrassWear();
    this.scene=new THREE.Scene();this.paintScene=new THREE.Scene();this.camera=new THREE.Camera();this.time=0;
    this.permanentRoadTiles=new Map();
    this.paintMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,transparent:true,toneMapped:false,
      uniforms:{...uniforms},vertexShader:`
        attribute vec4 contactShape; attribute vec2 contactInfo; attribute vec4 paintRgba;
        varying vec4 vPaintRgba; varying vec2 vContact; varying float vContactKind;
        uniform vec2 terrainTrackWorldSize;
        void main(){
          vPaintRgba=paintRgba; vContact=position.xy; vContactKind=contactInfo.y;
          vec2 local=position.xy * contactShape.zw * .5;
          float c=cos(contactInfo.x),s=sin(contactInfo.x);
          vec2 world=contactShape.xy + vec2(c*local.x+s*local.y,-s*local.x+c*local.y);
          gl_Position=vec4(world / terrainTrackWorldSize * 2.0 - 1.0,0.0,1.0);
        }`,fragmentShader:`
        varying vec4 vPaintRgba; varying vec2 vContact; varying float vContactKind;
        void main(){
          if(abs(vContactKind)>1.5){if(abs(vContact.x)>sqrt(max(0.0,1.0-vContact.y*vContact.y)))discard;}
          else if(abs(vContactKind)>.5){vec2 p=vContact;float toe=length(vec2(p.x/.96,(p.y-.30)/.70)),heel=length(vec2(p.x/.73,(p.y+.66)/.34));if(min(toe,heel)>1.0||p.x*vContactKind>.55&&p.y>-.45&&p.y<-.05)discard;}
          float grain=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);
          if(grain>vPaintRgba.a*1.15)discard;
          gl_FragColor=vPaintRgba;
        }`});
    this.material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,blending:THREE.NoBlending,blendEquation:THREE.MaxEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,toneMapped:false,
      uniforms:{...uniforms,permanentPass:{value:0}},vertexShader:`
        attribute vec4 contactClip; varying vec4 vContactClip; varying vec2 vContactWorld;
        attribute vec4 contactShape; attribute vec2 contactInfo; attribute float depositAmount; varying float vDeposit; varying vec2 vContact; varying float vContactKind;
        uniform vec2 terrainTrackWorldSize;
        void main(){
          vDeposit=depositAmount; vContact=position.xy; vContactKind=contactInfo.y;
          vec2 local=position.xy * contactShape.zw * .5;
          float c=cos(contactInfo.x),s=sin(contactInfo.x);
          vec2 world=contactShape.xy + vec2(c*local.x+s*local.y,-s*local.x+c*local.y);
          vContactWorld=world;vContactClip=contactClip;
          gl_Position=vec4(world / terrainTrackWorldSize * 2.0 - 1.0,0.0,1.0);
        }`,fragmentShader:`
        uniform float permanentPass; varying vec4 vContactClip; varying vec2 vContactWorld;
        uniform float terrainTrackTime; varying float vDeposit; varying vec2 vContact; varying float vContactKind;
        void main(){
          if(permanentPass>.5 && (any(lessThan(vContactWorld,vContactClip.xy))||any(greaterThanEqual(vContactWorld,vContactClip.zw))))discard;
          if(permanentPass>1.5){gl_FragColor=vec4(0.0);return;}
          if(abs(vContactKind)>1.5){
            // Pointed bow and stern follow the dragged hull, not a tire rectangle.
            if(abs(vContact.x)>sqrt(max(0.0,1.0-vContact.y*vContact.y)))discard;
          }else if(abs(vContactKind)>.5){
            vec2 p=vContact;
            // Rounded toe, narrower heel, and a small arch cut on the inner side.
            float toe=length(vec2(p.x/.96,(p.y-.30)/.70));
            float heel=length(vec2(p.x/.73,(p.y+.66)/.34));
            if(min(toe,heel)>1.0 || p.x*vContactKind>.55 && p.y>-.45 && p.y<-.05)discard;
          }
          if(vDeposit!=0.0){
            float grain=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);
            if(grain>.50*abs(vDeposit))discard;
          }
          if(permanentPass>.5){
            // Ordered codes keep residue colors above ordinary footprints in one channel.
            // Maximum blending prevents later footsteps from erasing carried soil or sand.
            float mark=vDeposit>0.0?.3+.2*vDeposit:vDeposit<0.0?.6+.14*abs(vDeposit):.2;
            gl_FragColor=vec4(mark,mark,mark,1.0);return;
          }
          float ticks=floor(terrainTrackTime*10.0);
          vec3 packed=vec3(floor(ticks/65536.0),floor(mod(ticks,65536.0)/256.0),mod(ticks,256.0));
          gl_FragColor=vec4(packed/255.0,vDeposit>0.0?.2+.3*vDeposit:vDeposit<0.0?.6+.14*abs(vDeposit):1.0);
        }`});
  }
  clear(){
    this.target?.dispose();this.target=null;this.permanentTarget?.dispose();this.permanentTarget=null;this.paintTarget?.dispose();this.paintTarget=null;this.permanentRoadTiles=new Map();this.roadRevision=null;this.world=null;this.time=0;this.motion=new TerrainTrackMotion();this.sandCarry=new SandCarry();this.dirtCarry=new SandCarry();this.paintCarry=new PaintCarry();this.grassWear=new GrassWear();
    this.uniforms.terrainTrackMap.value=this.empty;this.uniforms.terrainPermanentTrackMap.value=this.empty;if(this.uniforms.terrainPaintMap)this.uniforms.terrainPaintMap.value=this.empty;this.uniforms.terrainTrackTime.value=0;
  }
  ensureWorld(renderer,world){
    if(this.world===world&&this.width===world.width&&this.height===world.height)return;
    this.clear();this.world=world;this.width=world.width;this.height=world.height;
    const T=this.THREE,limit=Math.min(4096,renderer.capabilities.maxTextureSize);
    this.target=new T.WebGLRenderTarget(Math.min(limit,world.width*32),Math.min(limit,world.height*32),{
      minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});
    this.permanentTarget=new T.WebGLRenderTarget(Math.min(limit,world.width*32),Math.min(limit,world.height*32),{
      format:renderer.capabilities.isWebGL2?T.RedFormat:T.RGBAFormat,
      minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});
    this.paintTarget=new T.WebGLRenderTarget(Math.min(limit,world.width*32),Math.min(limit,world.height*32),{
      minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});
    this.uniforms.terrainPermanentTrackMap.value=this.permanentTarget.texture;
    if(this.uniforms.terrainPaintMap)this.uniforms.terrainPaintMap.value=this.paintTarget.texture;
    this.uniforms.terrainTrackMap.value=this.target.texture;this.uniforms.terrainTrackWorldSize.value.set(world.width,world.height);
    this.uniforms.terrainTrackTexel.value.set(world.width/this.target.width,world.height/this.target.height);
    const old=renderer.getRenderTarget(),color=renderer.getClearColor(new T.Color()).clone(),alpha=renderer.getClearAlpha();
    renderer.setRenderTarget(this.permanentTarget);renderer.setClearColor(0,0);renderer.clear();renderer.setRenderTarget(this.paintTarget);renderer.clear();renderer.setRenderTarget(this.target);renderer.clear();renderer.setClearColor(color,alpha);renderer.setRenderTarget(old);
  }
  paintPaint(renderer,stamps){
    if(!stamps.length||!this.paintTarget)return;
    const T=this.THREE;
    if(!this.paintMesh||this.paintCapacity<stamps.length){
      if(this.paintMesh){this.paintScene.remove(this.paintMesh);this.paintMesh.geometry.dispose();}
      this.paintCapacity=2**Math.ceil(Math.log2(Math.max(64,stamps.length)));
      const geometry=new T.InstancedBufferGeometry();
      geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));geometry.setIndex([0,1,2,0,2,3]);
      geometry.setAttribute('contactShape',new T.InstancedBufferAttribute(new Float32Array(this.paintCapacity*4),4).setUsage(T.DynamicDrawUsage));
      geometry.setAttribute('contactInfo',new T.InstancedBufferAttribute(new Float32Array(this.paintCapacity*2),2).setUsage(T.DynamicDrawUsage));
      geometry.setAttribute('paintRgba',new T.InstancedBufferAttribute(new Float32Array(this.paintCapacity*4),4).setUsage(T.DynamicDrawUsage));
      this.paintMesh=new T.Mesh(geometry,this.paintMaterial);this.paintMesh.frustumCulled=false;this.paintScene.add(this.paintMesh);
    }
    const shape=this.paintMesh.geometry.getAttribute('contactShape'),info=this.paintMesh.geometry.getAttribute('contactInfo'),rgba=this.paintMesh.geometry.getAttribute('paintRgba');
    const toLinear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
    stamps.forEach((s,i)=>{const scale=Math.abs(s.kind)===1?.55:.7;shape.setXYZW(i,s.x,s.z,s.width*scale,s.length*scale);info.setXY(i,s.angle,s.kind);const c=s.paintColor??0xffffff;rgba.setXYZW(i,toLinear((c>>16&255)/255),toLinear((c>>8&255)/255),toLinear((c&255)/255),Math.max(.12,Math.min(.85,s.paintLoad??.7)));});
    shape.needsUpdate=info.needsUpdate=rgba.needsUpdate=true;this.paintMesh.geometry.instanceCount=stamps.length;
    const old=renderer.getRenderTarget(),autoClear=renderer.autoClear,shadowUpdate=renderer.shadowMap.autoUpdate,shadowNeedsUpdate=renderer.shadowMap.needsUpdate;
    renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
    renderer.setRenderTarget(this.paintTarget);renderer.render(this.paintScene,this.camera);renderer.setRenderTarget(old);
    renderer.autoClear=autoClear;renderer.shadowMap.autoUpdate=shadowUpdate;renderer.shadowMap.needsUpdate=shadowNeedsUpdate;
  }
  erasePaint(renderer,erases){
    if(!erases?.length||!this.paintTarget)return;
    const T=this.THREE;
    if(!this.paintMesh||this.paintCapacity<erases.length)return;
    const shape=this.paintMesh.geometry.getAttribute('contactShape'),info=this.paintMesh.geometry.getAttribute('contactInfo'),rgba=this.paintMesh.geometry.getAttribute('paintRgba');
    erases.forEach((e,i)=>{const r=(e.radius||.5)*2.4;shape.setXYZW(i,e.x,e.y,r,r);info.setXY(i,0,2);rgba.setXYZW(i,0,0,0,0);});
    shape.needsUpdate=info.needsUpdate=rgba.needsUpdate=true;this.paintMesh.geometry.instanceCount=erases.length;
    const old=renderer.getRenderTarget(),autoClear=renderer.autoClear,shadowUpdate=renderer.shadowMap.autoUpdate,shadowNeedsUpdate=renderer.shadowMap.needsUpdate,prevBlend=this.paintMaterial.blending;
    renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
    this.paintMaterial.blending=T.NoBlending;
    renderer.setRenderTarget(this.paintTarget);renderer.render(this.paintScene,this.camera);renderer.setRenderTarget(old);
    this.paintMaterial.blending=prevBlend;
    renderer.autoClear=autoClear;renderer.shadowMap.autoUpdate=shadowUpdate;renderer.shadowMap.needsUpdate=shadowNeedsUpdate;
  }
  paint(renderer,stamps,target=this.target,permanentPass=0){
    if(!stamps.length)return;
    const T=this.THREE;
    if(!this.mesh||this.capacity<stamps.length){
      if(this.mesh){this.scene.remove(this.mesh);this.mesh.geometry.dispose();}
      this.capacity=2**Math.ceil(Math.log2(Math.max(64,stamps.length)));
      const geometry=new T.InstancedBufferGeometry();
      geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));geometry.setIndex([0,1,2,0,2,3]);
      geometry.setAttribute('contactClip',new T.InstancedBufferAttribute(new Float32Array(this.capacity*4),4).setUsage(T.DynamicDrawUsage));
      geometry.setAttribute('contactShape',new T.InstancedBufferAttribute(new Float32Array(this.capacity*4),4).setUsage(T.DynamicDrawUsage));
      geometry.setAttribute('depositAmount',new T.InstancedBufferAttribute(new Float32Array(this.capacity),1).setUsage(T.DynamicDrawUsage));
      geometry.setAttribute('contactInfo',new T.InstancedBufferAttribute(new Float32Array(this.capacity*2),2).setUsage(T.DynamicDrawUsage));
      this.mesh=new T.Mesh(geometry,this.material);this.mesh.frustumCulled=false;this.scene.add(this.mesh);
    }
    const clip=this.mesh.geometry.getAttribute('contactClip'),shape=this.mesh.geometry.getAttribute('contactShape'),info=this.mesh.geometry.getAttribute('contactInfo');
    stamps.forEach((s,i)=>{clip.setXYZW(i,...(s.clip||[0,0,0,0]));shape.setXYZW(i,s.x,s.z,s.width,s.length);info.setXY(i,s.angle,s.kind);this.mesh.geometry.getAttribute('depositAmount').setX(i,s.deposit||0);});
    this.mesh.geometry.getAttribute('depositAmount').needsUpdate=true;clip.needsUpdate=shape.needsUpdate=info.needsUpdate=true;this.mesh.geometry.instanceCount=stamps.length;
    const old=renderer.getRenderTarget(),autoClear=renderer.autoClear,shadowUpdate=renderer.shadowMap.autoUpdate,shadowNeedsUpdate=renderer.shadowMap.needsUpdate;
    renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
    this.material.uniforms.permanentPass.value=permanentPass;
    this.material.blending=permanentPass===1?T.CustomBlending:T.NoBlending;
    renderer.setRenderTarget(target);renderer.render(this.scene,this.camera);renderer.setRenderTarget(old);
    this.material.uniforms.permanentPass.value=0;this.material.blending=T.NoBlending;
    renderer.autoClear=autoClear;renderer.shadowMap.autoUpdate=shadowUpdate;renderer.shadowMap.needsUpdate=shadowNeedsUpdate;
  }
  update(renderer,world,entities,dt,models,offsets,bounds,city=null){
    this.sandCarry ||= new SandCarry();this.dirtCarry ||= new SandCarry();this.paintCarry ||= new PaintCarry();this.grassWear ||= new GrassWear();
    this.ensureWorld(renderer,world);this.time+=Math.max(0,dt);this.uniforms.terrainTrackTime.value=this.time;
    if(dt<=0)return;
    let groundArt=[];
    const artList=city?.justice?.art;
    if(artList?.length){
      const artRev=`${city.justice.artRevision||0}:${artList.length}`;
      if(!this._groundArtCache||this._groundArtCache.rev!==artRev){
        const items=[];
        for(let i=0;i<artList.length;i++){
          const piece=artList[i];
          if(piece.entity?.destroyed||piece.support?.kind!=='street-graffiti'||piece.support.surface!=='ground'||(piece.wearProgress||0)>=1)continue;
          const face=piece.layers?.at(-1)||piece;
          items.push({piece,x:piece.support.position?.x??piece.entity.x,y:piece.support.position?.y??piece.entity.y,width:piece.support.width||.86,height:piece.support.height||.86,inkColor:piece.renderedInkColor??face.color??piece.color??0xffffff});
        }
        this._groundArtCache={rev:artRev,items};
      }
      groundArt=this._groundArtCache.items;
      for(let i=0;i<groundArt.length;i++){const item=groundArt[i];if(item.piece.renderedInkColor!=null)item.inkColor=item.piece.renderedInkColor;}
    }
    const groundSources=[...groundArt];
    if(city?.sanitation?.stains?.size){
      for(const stain of city.sanitation.stains.values()){
        if(stain.scope==='street'&&stain.kind==='blood'&&stain.amount>0){
          groundSources.push({stain,dirtKind:'sangue',x:stain.x,y:stain.y,width:stain.radius*2,height:stain.radius*2,inkColor:stain.color??0x8c1118});
        }
      }
    }
    if(city?.sanitation?.streetFeces?.size){
      for(const [key,pile] of city.sanitation.streetFeces){
        if(!pile?.amount)continue;
        const [fx,fy]=key.split(',').map(Number);
        groundSources.push({fecesKey:key,dirtKind:'bosta',x:fx+.5,y:fy+.5,width:.7,height:.7,inkColor:0x4e3618});
      }
    }
    const stamps=[],paintStamps=[];
    if(city?.sanitation?.stains?.size){
      for(const stain of city.sanitation.stains.values()){
        if(stain.scope==='street'&&stain.kind==='blood'&&!stain._paintedToTerrain){
          stain._paintedToTerrain=true;
          const r=stain.radius||.35,c=stain.color??0x7a0e14;
          paintStamps.push({x:stain.x,z:stain.y,width:r*1.8,length:r*1.8,angle:0,kind:2,paintColor:c,paintLoad:.62});
          for(let d=0;d<4;d++){
            const a=d*1.57+stain.x*3.1,off=r*(.55+.35*(d%2)),dr=r*(.55+.25*(d%2));
            paintStamps.push({x:stain.x+Math.cos(a)*off,z:stain.y+Math.sin(a)*off,width:dr,length:dr,angle:a,kind:2,paintColor:c,paintLoad:.45});
          }
        }
      }
    }
    const onStepGroundSource=(item,u,v,stamp,citizen)=>{
      if(item.piece){
        const p=item.piece;p.groundSmudges??=[];
        p.groundSmudges.push({u,v,dx:Math.sin(stamp.angle),dz:Math.cos(stamp.angle),kind:stamp.kind});
        if(p.groundSmudges.length>48)p.groundSmudges.shift();
        p.wearProgress=Math.min(1,(p.wearProgress||0)+(Math.abs(stamp.kind)===1?.025:.045));
        p._smudgeSteps=(p._smudgeSteps||0)+1;
        if(p._smudgeSteps===1||p._smudgeSteps%4===0||p.wearProgress>=1){p.smudgeRevision=(p.smudgeRevision||0)+1;if(p.wearProgress>=1)this._groundArtCache=null;}
        if(citizen)city?.sanitation?.soilCitizen?.(citizen,'tinta',1.0,item.inkColor,'arms');
      }else if(item.dirtKind&&citizen){
        city?.sanitation?.soilCitizen?.(citizen,item.dirtKind,item.dirtKind==='bosta'?1.5:1.2,null,'feet');
      }
    };
    this._mudStainCooldown??=new Map();
    for(const entity of entities){
      const citizen=entity.properties?.citizen,vehicle=entity.properties?.cityVehicle,animal=entity.properties?.cityAnimal;
      if(!citizen&&!vehicle&&!animal)continue;
      const elevated=citizen&&(citizen.skybridgeZ>0||citizen._renderIndoorPosition?.z>0||citizen.furnitureUse?.seated||citizen.furnitureUse?.pose==='lying');
      const animalElevated=animal&&((animal.altitude||0)>0.12||animal.dead);
      if(entity.destroyed||animalElevated||citizen&&(citizen.ridingVehicleId||citizen.indoorLocation||elevated)||vehicle&&(vehicle.boatClass&&!vehicle.towedByVehicleId||vehicle.ferrying||vehicle.scrapped)) {this.motion.reset(entity);this.sandCarry.reset(entity);this.dirtCarry.reset(entity);this.paintCarry.reset(entity);continue;}
      const motion=citizen&&models?.motion?.get(entity),visible=motion&&Number.isFinite(motion.bodyX)&&Number.isFinite(motion.bodyZ)&&motion.bodyFrame===models.frameToken;
      const offset=offsets?.get(entity.id),x=visible?motion.bodyX:entity.x+(offset?.x||0),z=visible?motion.bodyZ:entity.y+(offset?.y||0);
      if(bounds&&(x<bounds.renderedMinTx-2||x>bounds.renderedMaxTx+2||z<bounds.renderedMinTy-2||z>bounds.renderedMaxTy+2)){this.motion.reset(entity);this.sandCarry.reset(entity);this.dirtCarry.reset(entity);this.paintCarry.reset(entity);continue;}
      const angle=vehicle?vehicle.angle||0:animal?animal.angle||0:motion?.renderAngle||0;
      const previous=this.motion.history.get(entity);
      if(!previous||previous.vehicle!==(vehicle?.good||null)||this.time-previous.time>1||Math.hypot(x-previous.x,z-previous.z)>3){this.sandCarry.reset(entity);this.dirtCarry.reset(entity);this.paintCarry.reset(entity);}
      const dimensions=vehicle?.towedByVehicleId&&BOAT_HULL_DIMENSIONS[vehicle.boatClass],hull=dimensions?{width:dimensions.width*(vehicle.boatClass==='canoe'?1:BOAT_CLASSES[vehicle.boatClass].scale),length:dimensions.length*(vehicle.boatClass==='canoe'?1:BOAT_CLASSES[vehicle.boatClass].scale)}:null;
      const animalProfile=animal?animalTrackProfile(animal.species):null;
      const scale=animal?(ANIMAL_SPECIES[animal.species]?.size||.5):(motion?.bodySize||1);
      const contacts=this.motion.move(entity,{x,z,angle,vehicle:vehicle?.good||null,scale,hull,animalProfile},this.time);
      stamps.push(...contacts);
      stamps.push(...this.sandCarry.contacts(entity,contacts,world));
      const dirtDeposits=this.dirtCarry.contacts(entity,contacts,world,[TILE_ROAD_GRASS,TILE_ROAD_HILL,TILE_FLOOR,TILE_HILL],'dirt',
        stamp=>this.grassWear.coverage(stamp,world,this.time));
      stamps.push(...dirtDeposits);
      if(dirtDeposits.length&&city?.sanitation?.addStain){
        for(const d of dirtDeposits){
          const tx=Math.floor(d.x),tz=Math.floor(d.z),ck=`${tx},${tz}`;
          const last=this._mudStainCooldown.get(ck)??-Infinity;
          if(this.time-last>20){
            const tile=world.getTile?world.getTile(tx,tz):world.map?.[tz*world.width+tx];
            if(isDirtRoad(tile)||tile===TILE_ROAD_GRASS||tile===TILE_ROAD_HILL){
              this._mudStainCooldown.set(ck,this.time);
              city.sanitation.addStain({kind:'mud',scope:'street',x:d.x,y:d.z,radius:.45,amount:.5});
            }
          }
        }
      }
      if(citizen&&contacts.length){
        const tx=Math.floor(x),tz=Math.floor(z),tile=world.getTile?world.getTile(tx,tz):world.map?.[tz*world.width+tx];
        if(dirtDeposits.length)city?.sanitation?.soilCitizen?.(citizen,'barro',.06,null,'feet');
        else if(tile===TILE_ROAD_GRASS||tile===TILE_ROAD_HILL||tile===TILE_HILL)city?.sanitation?.soilCitizen?.(citizen,'terra',.025,null,'feet');
      }
      if(groundSources.length||this.paintCarry.history.has(entity)){
        paintStamps.push(...this.paintCarry.contacts(entity,contacts,world,groundSources,(item,u,v,stamp)=>onStepGroundSource(item,u,v,stamp,citizen)));
      }
      this.grassWear.record(contacts,world,this.time);
    }
    this.grassWear.prune(this.time,256,world);
    this.paint(renderer,stamps);
    if(paintStamps.length&&this.paintPaint)this.paintPaint(renderer,paintStamps);
    if(city?.sanitation?.pendingTerrainErases?.length&&this.erasePaint){
      const erases=city.sanitation.pendingTerrainErases.splice(0,64);
      this.erasePaint(renderer,erases);
    }
    const permanent=permanentRoadContacts(stamps,world);
    this.permanentRoadTiles??=new Map();
    for(const stamp of permanent){const [x,z]=stamp.clip;this.permanentRoadTiles.set(z*world.width+x,{x,z});}
    this.paint(renderer,permanent,this.permanentTarget,1);
    if(this.roadRevision!==world.revision){
      this.roadRevision=world.revision;const removed=[];
      for(const [key,{x,z}] of this.permanentRoadTiles){
        const tile=world.getTile?world.getTile(x,z):world.map?.[key];
        if(!isDirtRoad(tile)){removed.push({x:x+.5,z:z+.5,width:1,length:1,angle:0,kind:0,clip:[x,z,x+1,z+1]});this.permanentRoadTiles.delete(key);}
      }
      this.paint(renderer,removed,this.permanentTarget,2);
    }
  }
}
