import {wickerBasketSurface} from './city_mobility_models.js?v=cargo-box-rear-1';
import {partyFlagCanvas} from './city_party_flags.js';
import {clothFlagGeometry,animateClothFlag} from './city_flag_animation.js?v=flag-wind-tick-13';
/** OBJ snapshots share one geometry per frame and one instanced draw per visible frame. */
export const CITIZEN_MODEL_FRAMES=Object.freeze({idle:[0],run:[0,1,2,3,4],use:[0,1,2],use_alt:[0,1,2],a_postos:[0,1],chute:[0,1],derrotado:[0,1],dormindo:[0],morto:[0],murro:[0,1],sentado_no_banco:[0],sentado_no_chao:[0]});
export function citizenIsSleeping(c){
 if(c?.task!=='energy'||!c.sleep?.active||c.path?.length||c.mobilityTrip||c.ridingVehicleId||c.deliveryId)return false;
 const s=c.indoorLocation;
 if(s)return s.roomType==='bedroom'&&!s.exiting&&!s.path?.length;
 return !!c.homelessSleepSpot&&!!c.entity&&Math.hypot(c.entity.x-c.homelessSleepSpot.x,c.entity.y-c.homelessSleepSpot.y)<=.3;
}
const WORK_TASKS=new Set(['work','manage','construction','clean','cleaning','research','campaign','care','caregiving','food','provisions','water','hygiene','supplies','shopping','health','vote','council-session','informal-service','informal-frontage','informal-gardening']);
export function citizenAnimation(c,moving=false){
  if(c.dead)return 'morto';
  if(c.unconsciousUntil)return 'derrotado';
  if(c.surrenderedUntil)return 'sentado_no_chao';
  if(c.mobilityTrip?.stage==='boarding')return 'mount';
  if(c.ridingVehicleId){
    if(c.ridingVehicleKind==='carrinho')return 'run';
    if(['bicicleta','bicicleta_carga'].includes(c.ridingVehicleKind))return c.mobilityTrip?.stage==='riding'?'pedal':'passenger';
    return ['patinete','patins','skate'].includes(c.ridingVehicleKind)?'glide':'passenger';
  }
  if(moving)return 'run';
  if(c.combatReaction)return 'derrotado';
  if(c.combatAnimation?.clip)return c.combatAnimation.clip;
  if(citizenIsSleeping(c))return 'dormindo';
  if(c.furnitureUse?.pose==='ground_sit')return 'sentado_no_chao';
  if(c.task==='sit'||c.furnitureUse?.type==='bench')return 'sentado_no_banco';
  if(c.seated)return 'seated';
  if(c.policePatrol)return 'a_postos';
  const activelyUsingFurniture=!!c.furnitureUse&&!c.furnitureUse.seated;
  const activelyWorkingOutside=!!c.workCell||!!c.forestryJob||!!c.paintWorkId;
  const activelyInsideWork=!!c.indoorLocation?.unitId&&WORK_TASKS.has(c.task);
  const activelyOnGig=!!c.informalJobId&&!c.path?.length;
  const activelyWorking=WORK_TASKS.has(c.task)&&!c.path?.length&&(activelyUsingFurniture||activelyWorkingOutside||activelyInsideWork||activelyOnGig||c.task==='construction'&&c.workProjectId!=null);
  if(!activelyWorking)return 'idle';
  return ['food','workmeal','provisions','toilet','hygiene','water','health','shopping','supplies','care','caregiving','leisure','social','vote'].includes(c.task)?'use_alt':'use';
}
export function citizenFrame(clip,time,phase=0,oneShot=false){
  if(clip==='mount'||clip==='passenger')return {clip:'use',frame:0};
  if(clip==='seated')return {clip:'use',frame:2};
  if(clip==='glide')return {clip:'use',frame:1};
  const sequence=clip==='pedal'?[0,2,4]:clip==='use'?[0,1]:CITIZEN_MODEL_FRAMES[clip]||[0],fps=['run','pedal','murro','chute','derrotado'].includes(clip)?8:4,index=Math.floor(Math.max(0,time)*fps+phase);
  return {clip:clip==='pedal'?'run':clip in CITIZEN_MODEL_FRAMES?clip:'idle',frame:sequence[oneShot?Math.min(index,sequence.length-1):index%sequence.length]};
}
export function parseCitizenOBJ(text){
  const vertices=[],normals=[],triangles=[];
  const index=(raw,length)=>{const n=Number(raw);if(!Number.isInteger(n)||n===0)throw Error('OBJ: índice inválido');const i=n<0?length+n:n-1;if(i<0||i>=length)throw Error('OBJ: índice fora da geometria');return i;};
  for(const line of text.split(/\r?\n/)){
    const row=line.trim();if(!row||row.startsWith('#'))continue;const fields=row.split(/\s+/),tag=fields.shift();
    if(tag==='v'||tag==='vn'){const v=fields.slice(0,3).map(Number);if(v.length!==3||!v.every(Number.isFinite))throw Error('OBJ: coordenadas inválidas');(tag==='v'?vertices:normals).push(v);}
    else if(tag==='f'){
      if(fields.length<3)throw Error('OBJ: face incompleta');
      const face=fields.map(part=>{const bits=part.split('/');return {vertex:index(bits[0],vertices.length),normal:bits[2]?index(bits[2],normals.length):null};});
      for(let i=1;i<face.length-1;i++)triangles.push([face[0],face[i],face[i+1]]);
    }
  }
  if(!triangles.length)throw Error('OBJ: modelo sem faces');
  const positions=new Float32Array(triangles.length*9),normalData=new Float32Array(positions.length),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let offset=0;
  for(const face of triangles){
    const [a,b,c]=face.map(p=>vertices[p.vertex]),u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...cross)||1,flat=cross.map(v=>v/length);
    for(const point of face){const xyz=vertices[point.vertex],normal=point.normal==null?flat:normals[point.normal];for(let axis=0;axis<3;axis++){positions[offset+axis]=xyz[axis];normalData[offset+axis]=normal[axis];min[axis]=Math.min(min[axis],xyz[axis]);max[axis]=Math.max(max[axis],xyz[axis]);}offset+=3;}
  }
  return {positions,normals:normalData,bounds:{min,max},triangles:triangles.length};
}
// Partition the animated surface itself: covered body faces are replaced, never layered.
export const RENDERED_GARMENTS=Object.freeze(['camisa','camisa social','camisa estampada','terno','calça','calça social','vestido','vestido estampado','casaco','saia','saia longa','macacão','shorts','bermuda','sunga','biquíni','maiô','sapatos','botas','trapos']);
export function garmentSurface(reference,piece){
  const mask=new Uint8Array(reference.positions.length/9);
  for(let t=0;t<mask.length;t++){
    const i=t*9,p=reference.positions,y=(p[i+1]+p[i+4]+p[i+7])/3;
    const upper=y>=1.00&&y<1.78,legs=y>=.12&&y<1.00;
    const centerX=(p[i]+p[i+3]+p[i+6])/3;
    const swimTop=upper&&(y>1.28||Math.abs(centerX)<.20),swimBottom=y>=.52&&y<.88&&Math.abs(centerX)<.24;
    const suit=legs||upper;
    mask[t]=Number(
      ['camisa','camisa social','camisa estampada','trapos'].includes(piece)?upper:
      piece==='casaco'?upper:
      piece==='terno'?suit:
      ['calça','calça social'].includes(piece)?legs:
      ['shorts','bermuda'].includes(piece)?y>=.52&&y<1.00:
      piece==='sunga'?y>=.48&&y<.92:
      piece==='biquíni'?swimTop||swimBottom:
      piece==='maiô'?y>=.20&&y<1.78:
      piece==='sapatos'?y<.16:
      piece==='botas'?y<.38:
      piece==='saia'?y>=.52&&y<1.00:
      piece==='saia longa'?y>=.18&&y<1.00:
      ['vestido','vestido estampado'].includes(piece)?y>=.42&&y<1.78:
      piece==='macacão'?y>=.12&&y<1.78:false);
  }
  return mask;
}
// Headwear uses a separate mesh so a hat and the main garment can be worn together.
// Its anchor is computed independently for each animated OBJ frame.
export function headwearSurface(data,piece){
  const p=data.positions;let top=-Infinity;for(let i=1;i<p.length;i+=3)top=Math.max(top,p[i]);
  let x=0,z=0,n=0;for(let i=0;i<p.length;i+=3)if(p[i+1]>=top-.07){x+=p[i];z+=p[i+2];n++;}x/=n||1;z/=n||1;
  const positions=[],normals=[],tri=(a,b,c)=>{const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,len=Math.hypot(nx,ny,nz)||1;for(const q of [a,b,c]){positions.push(...q);normals.push(nx/len,ny/len,nz/len);}};
  const ring=(radius,y,i,tilt=0)=>{const angle=i*Math.PI*2/16;return [x+Math.cos(angle)*radius,y+Math.sin(angle)*tilt,z+Math.sin(angle)*radius];};
  const base=top-.025;
  if(piece==='cesta'){
    const basket=wickerBasketSurface({x,y:base+.012,z,width:.25,depth:.22,height:.13,segments:12,courses:4});
    return {positions:basket.positions,normals:basket.normals};
  }
  const hat=piece==='cartola'?{brim:.145,crown:.086,height:.21,top:.072,tilt:0}:
    piece==='chapéu de cangaceiro'?{brim:.155,crown:.083,height:.13,top:.025,tilt:.018}:
    piece==='chapéu nordestino'?{brim:.17,crown:.09,height:.12,top:.035,tilt:0}:
    piece==='chapéu de couro'?{brim:.145,crown:.09,height:.10,top:.045,tilt:-.012}:
    piece==='chapéu de vaqueiro'?{brim:.205,crown:.078,height:.105,top:.064,tilt:.025}:
    piece==='chapéu de palha grande'?{brim:.225,crown:.082,height:.095,top:.065,tilt:.012}:
    piece==='chapéu de palha pequeno'?{brim:.145,crown:.078,height:.09,top:.064,tilt:0}:
    piece==='chapéu de palha médio'?{brim:.18,crown:.08,height:.095,top:.066,tilt:.006}:
    piece==='boné'?{brim:.105,crown:.082,height:.07,top:.065,tilt:0}:
    {brim:.16,crown:.08,height:.11,top:.06,tilt:0};
  const slices=16,crownTop=base+hat.height;
  for(let i=0;i<slices;i++){
    const a=ring(hat.crown,base,i),b=ring(hat.crown,base,i+1),c=ring(hat.top,crownTop,i+1),d=ring(hat.top,crownTop,i);
    tri(a,b,c);tri(a,c,d);tri(d,c,[x,crownTop,z]);
    const outerA=ring(hat.brim,base,i,hat.tilt),outerB=ring(hat.brim,base,i+1,hat.tilt);
    tri(a,outerA,outerB);tri(a,outerB,b);
    if(piece==='chapéu de cangaceiro'&&i%4===0){const star=[x+Math.cos(i*Math.PI*2/slices)*hat.crown*1.02,base+.025,z+Math.sin(i*Math.PI*2/slices)*hat.crown*1.02];tri(a,star,b);}
  }
  if(piece==='boné'){const y=base+.005,a=[x-.075,y,z+.035],b=[x+.075,y,z+.035],c=[x+.085,y,z+.16],d=[x-.085,y,z+.16];tri(a,b,c);tri(a,c,d);}
  return {positions:new Float32Array(positions),normals:new Float32Array(normals)};
}
export function splitGarmentSurface(data,mask,piece=null){
  const body=[],bodyNormals=[],clothes=[],clothesNormals=[];
  for(let t=0;t<data.positions.length/9;t++){
    const selected=mask[t],p=selected?clothes:body,n=selected?clothesNormals:bodyNormals;
    for(let j=0;j<9;j+=3){let x=data.positions[t*9+j],y=data.positions[t*9+j+1],z=data.positions[t*9+j+2];
      if(selected&&['saia','saia longa','vestido','vestido estampado'].includes(piece)&&y<.99){const length=piece==='saia longa'?.82:.48,flare=piece==='saia longa'?.42:piece.startsWith('vestido')?.18:.30,fall=Math.max(0,Math.min(1,(.99-y)/length)),factor=1+flare*fall*fall;x*=factor;z*=factor;}
      p.push(x,y,z);n.push(data.normals[t*9+j],data.normals[t*9+j+1],data.normals[t*9+j+2]);}
  }
  return {body:new Float32Array(body),bodyNormals:new Float32Array(bodyNormals),clothes:new Float32Array(clothes),clothesNormals:new Float32Array(clothesNormals)};
}
export class CityCitizenModels {
  constructor(THREE,group,{fetchAsset=globalThis.fetch?.bind(globalThis),baseURL=new URL('../data/model/',import.meta.url)}={}){
    this.THREE=THREE;this.group=group;this.fetchAsset=fetchAsset;this.baseURL=baseURL;this.frames=new Map();this.outfits=new Map();this.headwear=new Map();this.headwearBatches=new Map();this.batches=new Map();this.motion=new WeakMap();this.printMaterials=new Map();this.clock=0;this.ready=false;this.error=null;
    this.matrix=new THREE.Matrix4();this.position=new THREE.Vector3();this.scale=new THREE.Vector3();this.quaternion=new THREE.Quaternion();this.axis=new THREE.Vector3(0,1,0);this.lyingRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);this.color=new THREE.Color();
    this.material=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide});this.enableWeightMorph(this.material);this.campaignFlags=new Map();this.campaignFlagMaterials=new Map();this.activeCampaignFlags=new Set();
    this.loading=this.load().catch(error=>{this.error=error.message;console.warn('Modelos dos cidadãos indisponíveis; usando sprites.',error.message);return false;});
  }
  enableWeightMorph(material){
    if(!this.THREE.InstancedBufferAttribute)return material;
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float instanceFat;');
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nfloat normalTorso = smoothstep(0.46, 0.65, position.y) * (1.0 - smoothstep(0.92, 1.12, position.y));\nfloat normalGirth = instanceFat * normalTorso;\nobjectNormal.x /= 1.0 + normalGirth * 0.48;\nobjectNormal.z /= 1.0 + normalGirth * 0.30;\nobjectNormal = normalize(objectNormal);');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloat torso = smoothstep(0.46, 0.65, transformed.y) * (1.0 - smoothstep(0.92, 1.12, transformed.y));\nfloat girth = instanceFat * torso;\ntransformed.x *= 1.0 + girth * 0.48;\ntransformed.z *= 1.0 + girth * 0.30;\ntransformed.z += max(girth, 0.0) * 0.045;');
    };
    material.customProgramCacheKey=()=> 'citizen-weight-morph-1';
    return material;
  }
  instancedGeometry(source,capacity){
    if(!this.THREE.InstancedBufferAttribute)return source;
    const geometry=source.clone();geometry.setAttribute('instanceFat',new this.THREE.InstancedBufferAttribute(new Float32Array(capacity),1));return geometry;
  }
  setInstanceFat(mesh,index,citizen){
    const attribute=mesh.geometry.attributes.instanceFat;if(!attribute)return;
    const height=(citizen.bodyHeightCm||170)/100,weight=citizen.bodyWeightKg||24*height*height,bmi=weight/(height*height),fat=Math.max(-.45,Math.min(.9,(bmi-22)/14));
    attribute.array[index]=fat;
  }
  printedMaterial(piece){
    if(this.printMaterials.has(piece))return this.printMaterials.get(piece);
    if(typeof document==='undefined'||!this.THREE.CanvasTexture)return this.material;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,64,64);
    if(piece==='camisa social'){
      ctx.fillStyle='#555';ctx.beginPath();ctx.moveTo(28,8);ctx.lineTo(36,8);ctx.lineTo(35,17);ctx.lineTo(39,43);ctx.lineTo(32,57);ctx.lineTo(25,43);ctx.lineTo(29,17);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#777';ctx.lineWidth=3;ctx.strokeRect(45,25,10,12);
    }else if(piece==='vestido estampado'){
      ctx.strokeStyle='#999';ctx.lineWidth=2;for(let x=-64;x<128;x+=12){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+64,64);ctx.stroke();}
      ctx.fillStyle='#bbb';for(let y=8;y<64;y+=16)for(let x=8;x<64;x+=16){ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();}
    }else{
      ctx.fillStyle='#999';for(let y=5;y<64;y+=14)for(let x=5;x<64;x+=14){ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='#ccc';for(let y=12;y<64;y+=28)for(let x=12;x<64;x+=28){ctx.fillRect(x-1,y-5,2,10);ctx.fillRect(x-5,y-1,10,2);}
    }
    const texture=new this.THREE.CanvasTexture(canvas);texture.wrapS=this.THREE.ClampToEdgeWrapping;texture.wrapT=this.THREE.ClampToEdgeWrapping;texture.magFilter=this.THREE.NearestFilter;texture.minFilter=this.THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=this.THREE.SRGBColorSpace;
    const material=this.enableWeightMorph(new this.THREE.MeshLambertMaterial({color:0xffffff,map:texture,side:this.THREE.DoubleSide}));this.printMaterials.set(piece,material);return material;
  }
  async load(){
    if(!this.fetchAsset)throw Error('Carregamento de OBJ indisponível');
    const entries=await Promise.all(Object.entries(CITIZEN_MODEL_FRAMES).flatMap(([clip,frames])=>frames.map(async frame=>{
      const response=await this.fetchAsset(new URL(`${clip}/${frame}.obj`,this.baseURL));if(!response.ok)throw Error(`Falha em ${clip}/${frame}.obj (${response.status})`);
      return {key:`${clip}:${frame}`,data:parseCitizenOBJ(await response.text())};
    })));
    const references={idle:entries.find(e=>e.key==='idle:0').data,animated:entries.find(e=>e.key==='run:0').data};
    const masks=Object.fromEntries(Object.entries(references).map(([key,data])=>[key,Object.fromEntries(RENDERED_GARMENTS.map(piece=>[piece,garmentSurface(data,piece)]))]));
    const idle=references.idle.bounds,height=idle.max[1]-idle.min[1];if(!(height>0))throw Error('Modelo sem altura');
    const origin=[(idle.min[0]+idle.max[0])/2,Math.min(...entries.map(e=>e.data.bounds.min[1])),(idle.min[2]+idle.max[2])/2],factor=1.05/height;
    for(const {key,data}of entries){const positions=data.positions;for(let i=0;i<positions.length;i++)positions[i]=(positions[i]-origin[i%3])*factor;
      const geometry=new this.THREE.BufferGeometry();geometry.setAttribute('position',new this.THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new this.THREE.Float32BufferAttribute(data.normals,3));geometry.computeBoundingSphere();this.frames.set(key,geometry);
      const source=/^(run|use):/.test(key)?'animated':'idle';
      for(const piece of RENDERED_GARMENTS){
        const parts=splitGarmentSurface(data,masks[source][piece],piece);
        const make=(positions,normals,withUV=false,hideBack=false)=>{const g=new this.THREE.BufferGeometry();g.setAttribute('position',new this.THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new this.THREE.Float32BufferAttribute(normals,3));if(withUV){let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(let v=0;v<positions.length;v+=3){minX=Math.min(minX,positions[v]);maxX=Math.max(maxX,positions[v]);minY=Math.min(minY,positions[v+1]);maxY=Math.max(maxY,positions[v+1]);}const width=Math.max(.001,maxX-minX),height=Math.max(.001,maxY-minY),uv=new Float32Array(positions.length/3*2);for(let v=0,j=0;v<positions.length;v+=3){uv[j++]=hideBack&&normals[v+2]<-.25?2:(positions[v]-minX)/width;uv[j++]=(positions[v+1]-minY)/height;}g.setAttribute('uv',new this.THREE.Float32BufferAttribute(uv,2));}g.computeBoundingSphere();return g;};
        const printed=['camisa social','camisa estampada','vestido estampado'].includes(piece);
        this.outfits.set(`${key}:${piece}`,{body:make(parts.body,parts.bodyNormals),clothes:make(parts.clothes,parts.clothesNormals,printed,piece==='camisa social'),material:printed?this.printedMaterial(piece):this.material});
        if(['sapatos','botas','calça','calça social','shorts','bermuda','sunga','saia','saia longa'].includes(piece)){const surface=parts.clothes.slice();for(let i=0;i<surface.length;i++)surface[i]+=parts.clothesNormals[i]*.002;this.headwear.set(`${key}:${piece}`,make(surface,parts.clothesNormals));}
      }
      for(const piece of ['boné','cartola','chapéu','chapéu nordestino','chapéu de cangaceiro','chapéu de couro','chapéu de vaqueiro','chapéu de palha pequeno','chapéu de palha médio','chapéu de palha grande','cesta']){const part=headwearSurface(data,piece),g=new this.THREE.BufferGeometry();g.setAttribute('position',new this.THREE.Float32BufferAttribute(part.positions,3));g.setAttribute('normal',new this.THREE.Float32BufferAttribute(part.normals,3));g.computeBoundingSphere();this.headwear.set(`${key}:${piece}`,g);}
    }
    this.ready=true;return true;
  }
  begin(dt=0,speed=1){this.animationPaused=speed<=0;this.frameDelta=Math.max(0,Math.min(.1,dt));this.clock+=this.frameDelta*Math.max(0,Math.min(2,speed));this.activeCampaignFlags.clear();for(const batch of this.batches.values())batch.count=0;for(const batch of this.headwearBatches.values())batch.count=0;}
  add(entity,surfaceH,{hidden=false,dimmed=false,perspective=false,smoothMovement=false,vehicleAngle=null,activeCampaignElectionId=null,activeCampaignStatus=null}={}){
    if(!this.ready)return false;
    const c=entity.properties.citizen;if(!c)return false;
    if(hidden)return true;
    const inside=c.ridingVehicleId?null:c._renderIndoorPosition||c.indoorLocation?.position,posePoint=!c.path?.length&&!c.indoorLocation?.path?.length&&(c.furnitureUse?.pose==='lying'||c.furnitureUse?.seated)?c.furnitureUse.posePoint:null,x=posePoint?.x??inside?.x??entity.x,y=posePoint?.y??inside?.y??entity.y;
    let motion=this.motion.get(entity);
     if(!motion){motion={x,y,renderX:x,renderY:y,angle:0,renderAngle:0,walkDistance:0,walkFrame:0,lastStepAt:-Infinity};this.motion.set(entity,motion);}
    const dx=x-motion.x,dy=y-motion.y;
    const moved=dx*dx+dy*dy>1e-7;
     if(moved){motion.angle=Math.atan2(dx,dy);if(!this.animationPaused)motion.walkDistance+=Math.hypot(dx,dy);motion.x=x;motion.y=y;}
    if(c.ridingVehicleId&&Number.isFinite(vehicleAngle))motion.angle=vehicleAngle;
    let renderX=x,renderY=y,renderAngle=motion.angle;
    if(smoothMovement){
      const alpha=1-Math.exp(-Math.max(0.001,this.frameDelta||0.016)*14);
      motion.renderX+=(x-motion.renderX)*alpha;motion.renderY+=(y-motion.renderY)*alpha;
      const angleDelta=Math.atan2(Math.sin(motion.angle-motion.renderAngle),Math.cos(motion.angle-motion.renderAngle));
      motion.renderAngle+=angleDelta*alpha;
      renderX=motion.renderX;renderY=motion.renderY;renderAngle=motion.renderAngle;
    }else{motion.renderX=x;motion.renderY=y;motion.renderAngle=motion.angle;}
    if(c.furnitureUse?.type==='bench'&&c.furnitureUse.seated){renderX+=Math.sin(renderAngle)*.16;renderY+=Math.cos(renderAngle)*.16;}
    // Keep quarter-tile footsteps, but present adjacent poses instead of skipping
    // a full animation cycle when a worker snapshot jumps several tiles.
    if(moved&&!this.animationPaused&&motion.walkDistance+1e-8>=.25&&this.clock-motion.lastStepAt>=.1-1e-8){motion.walkFrame++;motion.walkDistance=Math.max(0,motion.walkDistance%.25);motion.lastStepAt=this.clock;}
    // A pending path is not movement. Hold the travel pose between footsteps;
    // work animations still use the simulation's presentation clock.
    const traveling=moved||!!c.path?.length||!!c.indoorLocation?.path?.length||!!c.deliveryId||!!c.mobilityTrip&&c.mobilityTrip.stage!=='boarding';
    const sleeping=citizenIsSleeping(c),lying=!sleeping&&!traveling&&c.furnitureUse?.pose==='lying',clip=citizenAnimation(c,traveling),actionState=['murro','chute','derrotado'].includes(clip),actionToken=c.combatAnimation?.sequence??c.combatReaction?.sequence??c.unconsciousUntil??null;
    if(actionState){const token=`${clip}:${actionToken??''}`;if(motion.actionToken!==token){motion.actionToken=token;motion.actionStartedAt=this.clock;}}
    else motion.actionToken=null;
    const animationTime=clip==='run'||clip==='pedal'?motion.walkFrame/8:actionState?this.clock-(motion.actionStartedAt??this.clock):this.clock,pose=citizenFrame(clip,animationTime,actionState?0:(entity.id*13)%17,actionState),key=`${pose.clip}:${pose.frame}`;
    if(!traveling&&!sleeping&&c.facingTarget)motion.angle=Math.atan2(c.facingTarget.x-x,c.facingTarget.y-y);
    const garment=c.wearingIndex===-1?null:c.wardrobe?.[Number.isInteger(c.wearingIndex)?c.wearingIndex:0],piece=RENDERED_GARMENTS.includes(garment?.piece)?garment.piece:null,batchKey=piece?`${key}:${piece}`:key,outfit=piece?this.outfits.get(batchKey):null;
    let batch=this.batches.get(batchKey);if(!batch){batch={count:0,capacity:0,mesh:null,clothingMesh:null};this.batches.set(batchKey,batch);}
    if(batch.count===batch.capacity){
      const capacity=Math.max(32,batch.capacity*2),mesh=new this.THREE.InstancedMesh(this.instancedGeometry(outfit?.body||this.frames.get(key),capacity),this.material,capacity);mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
      if(batch.mesh){for(let i=0;i<batch.count;i++){batch.mesh.getMatrixAt(i,this.matrix);mesh.setMatrixAt(i,this.matrix);batch.mesh.getColorAt(i,this.color);mesh.setColorAt(i,this.color);const oldFat=batch.mesh.geometry.attributes.instanceFat,newFat=mesh.geometry.attributes.instanceFat;if(oldFat&&newFat)newFat.array[i]=oldFat.array[i];}this.group.remove(batch.mesh);batch.mesh.dispose();}
      this.group.add(mesh);batch.mesh=mesh;
      if(outfit){const clothing=new this.THREE.InstancedMesh(this.instancedGeometry(outfit.clothes,capacity),outfit.material||this.material,capacity);clothing.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);clothing.frustumCulled=false;clothing.castShadow=true;clothing.receiveShadow=true;
        if(batch.clothingMesh){for(let i=0;i<batch.count;i++){batch.clothingMesh.getMatrixAt(i,this.matrix);clothing.setMatrixAt(i,this.matrix);batch.clothingMesh.getColorAt(i,this.color);clothing.setColorAt(i,this.color);const oldFat=batch.clothingMesh.geometry.attributes.instanceFat,newFat=clothing.geometry.attributes.instanceFat;if(oldFat&&newFat)newFat.array[i]=oldFat.array[i];}this.group.remove(batch.clothingMesh);batch.clothingMesh.dispose();}
        this.group.add(clothing);batch.clothingMesh=clothing;
      }batch.capacity=capacity;
    }
    const size=(entity.properties.render.size||1)*(perspective?1.05:1);
    this.position.set(renderX,surfaceH+(posePoint?.z??inside?.z??0)+(c.ridingVehicleId? .18:0),renderY);this.quaternion.setFromAxisAngle(this.axis,renderAngle);if(lying)this.quaternion.multiply(this.lyingRotation);this.scale.set(size,size*(c.bodyHeightCm||170)/170,size);this.matrix.compose(this.position,this.quaternion,this.scale);batch.mesh.setMatrixAt(batch.count,this.matrix);this.setInstanceFat(batch.mesh,batch.count,c);
    const presence=c.campaignPresence?.electionId===activeCampaignElectionId&&activeCampaignStatus==='campaign'?c.campaignPresence:null;
    const flag=c.campaign?.partyFlag||c.campaign?.flag||presence?.partyFlag;
    if(flag&&!c.ridingVehicleId&&!c.mobilityTrip&&!c.deliveryId){
      const flagKey=JSON.stringify(flag);let carrier=this.campaignFlags.get(entity.id);
      if(!carrier||carrier.flagKey!==flagKey){if(carrier){this.group.remove(carrier.group);carrier.group.traverse(o=>{o.geometry?.dispose();if(o.material!==carrier.material)o.material?.dispose();});}let material=this.campaignFlagMaterials.get(flagKey);if(!material){let texture;const canvas=partyFlagCanvas(flag,()=>{if(texture)texture.needsUpdate=true;});texture=new this.THREE.CanvasTexture(canvas);texture.magFilter=this.THREE.NearestFilter;texture.minFilter=this.THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=this.THREE.SRGBColorSpace;material=new this.THREE.MeshLambertMaterial({map:texture,side:this.THREE.DoubleSide});this.campaignFlagMaterials.set(flagKey,material);}const group=new this.THREE.Group(),pole=new this.THREE.Mesh(new this.THREE.CylinderGeometry(.018,.024,1.18,5),new this.THREE.MeshLambertMaterial({color:0x795b3e})),cloth=new this.THREE.Mesh(clothFlagGeometry(this.THREE,.48,.30),material);pole.position.set(-.24,.59,0);cloth.position.set(0,1.02,0);group.add(pole,cloth);group.userData.cloth=cloth;this.group.add(group);carrier={group,material,flagKey};this.campaignFlags.set(entity.id,carrier);}
      carrier.group.position.copy(this.position);carrier.group.scale.setScalar(size);carrier.group.rotation.y=0;animateClothFlag(carrier.group.userData.cloth,Math.floor(this.clock*10)/10,(entity.id%19)*.31);this.activeCampaignFlags.add(entity.id);
    }
    this.color.setHex(entity.combatFlash>0?0xff3333:dimmed?0x555555:entity.properties.render.color??0xe8e8e8);batch.mesh.setColorAt(batch.count,this.color);
    if(batch.clothingMesh){batch.clothingMesh.setMatrixAt(batch.count,this.matrix);this.setInstanceFat(batch.clothingMesh,batch.count,c);const raw=garment?.color,hex=typeof raw==='number'?raw:typeof raw==='string'&&/^#[0-9a-f]{6}$/i.test(raw)?parseInt(raw.slice(1),16):0x8d806e;this.color.setHex(entity.combatFlash>0?0xff3333:dimmed?0x555555:presence?.color?Number.parseInt(String(presence.color).replace('#',''),16):hex);if(!dimmed&&entity.combatFlash<=0&&(garment?.dirt||0)>0)this.color.lerp(new this.THREE.Color(0x62584b),Math.min(.72,garment.dirt/140));batch.clothingMesh.setColorAt(batch.count,this.color);}batch.count++;
    const capId=c.political?.partyCapId||c.campaign?.capGarmentId,partyCap=capId&&c.wardrobe?.find(g=>g.garmentId===capId),wornHat=partyCap||(Number.isInteger(c.headwearIndex)&&c.headwearIndex>=0?c.wardrobe?.[c.headwearIndex]:null),hat=c.equipment?.cesta?{piece:'cesta',color:0xb8874f}:wornHat;
    const footwear=Number.isInteger(c.footwearIndex)&&c.footwearIndex>=0?c.wardrobe?.[c.footwearIndex]:null;
    const lower=Number.isInteger(c.lowerWearIndex)&&c.lowerWearIndex>=0?c.wardrobe?.[c.lowerWearIndex]:null;
    for(const item of [hat,footwear,lower])if(item&&['boné','cartola','chapéu','chapéu nordestino','chapéu de cangaceiro','chapéu de couro','chapéu de vaqueiro','chapéu de palha pequeno','chapéu de palha médio','chapéu de palha grande','cesta','sapatos','botas','calça','calça social','shorts','bermuda','sunga','saia','saia longa'].includes(item.piece)){const itemKey=`${key}:${item.piece}`;let head=this.headwearBatches.get(itemKey);if(!head){head={count:0,capacity:0,mesh:null};this.headwearBatches.set(itemKey,head);}if(head.count===head.capacity){const capacity=Math.max(32,head.capacity*2),mesh=new this.THREE.InstancedMesh(this.headwear.get(itemKey),this.material,capacity);mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;if(head.mesh){for(let i=0;i<head.count;i++){head.mesh.getMatrixAt(i,this.matrix);mesh.setMatrixAt(i,this.matrix);head.mesh.getColorAt(i,this.color);mesh.setColorAt(i,this.color);}this.group.remove(head.mesh);head.mesh.dispose();}this.group.add(mesh);head.mesh=mesh;head.capacity=capacity;this.matrix.compose(this.position,this.quaternion,this.scale);}head.mesh.setMatrixAt(head.count,this.matrix);const raw=item.color,hex=typeof raw==='number'?raw:typeof raw==='string'&&/^#[0-9a-f]{6}$/i.test(raw)?parseInt(raw.slice(1),16):0x8d806e;this.color.setHex(entity.combatFlash>0?0xff3333:dimmed?0x555555:hex);if(!dimmed&&entity.combatFlash<=0&&(item.dirt||0)>0)this.color.lerp(new this.THREE.Color(0x62584b),Math.min(.72,item.dirt/140));head.mesh.setColorAt(head.count++,this.color);}
    return true;
  }
  end(){for(const batch of this.batches.values()){batch.mesh.count=batch.count;if(batch.count){batch.mesh.instanceMatrix.needsUpdate=true;if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;const fat=batch.mesh.geometry.attributes.instanceFat;if(fat)fat.needsUpdate=true;}if(batch.clothingMesh){batch.clothingMesh.count=batch.count;if(batch.count){batch.clothingMesh.instanceMatrix.needsUpdate=true;if(batch.clothingMesh.instanceColor)batch.clothingMesh.instanceColor.needsUpdate=true;const fat=batch.clothingMesh.geometry.attributes.instanceFat;if(fat)fat.needsUpdate=true;}}}for(const batch of this.headwearBatches.values()){batch.mesh.count=batch.count;if(batch.count){batch.mesh.instanceMatrix.needsUpdate=true;if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;}}for(const [id,carrier]of this.campaignFlags)if(!this.activeCampaignFlags.has(id)){this.group.remove(carrier.group);carrier.group.traverse(o=>{o.geometry?.dispose();if(o.material!==carrier.material)o.material?.dispose();});this.campaignFlags.delete(id);}}
  clear(){for(const b of this.batches.values()){this.group.remove(b.mesh);b.mesh.dispose();if(b.clothingMesh){this.group.remove(b.clothingMesh);b.clothingMesh.dispose();}}for(const b of this.headwearBatches.values()){this.group.remove(b.mesh);b.mesh.dispose();}for(const carrier of this.campaignFlags.values()){this.group.remove(carrier.group);carrier.group.traverse(o=>{o.geometry?.dispose();if(o.material!==carrier.material)o.material?.dispose();});}for(const material of this.campaignFlagMaterials.values()){material.map?.dispose();material.dispose();}this.campaignFlags.clear();this.campaignFlagMaterials.clear();this.activeCampaignFlags.clear();this.batches.clear();this.headwearBatches.clear();this.motion=new WeakMap();this.clock=0;}
}
