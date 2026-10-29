/** OBJ snapshots share one geometry per frame and one instanced draw per visible frame. */
export const CITIZEN_MODEL_FRAMES=Object.freeze({idle:[0],run:[0,1,2,3,4],use:[0,1,2]});
export function citizenIsSleeping(c){
 if(c?.task!=='energy'||c.path?.length||c.mobilityTrip||c.ridingVehicleId||c.deliveryId)return false;
 const s=c.indoorLocation;
 if(s)return s.roomType==='bedroom'&&!s.exiting&&!s.path?.length;
 return c.action==='Dormindo na rua'&&(!c.homelessSleepSpot||Math.hypot(c.entity.x-c.homelessSleepSpot.x,c.entity.y-c.homelessSleepSpot.y)<=.3);
}
const WORK_TASKS=new Set(['work','manage','construction','clean','cleaning','research','campaign','care','caregiving','food','provisions','water','hygiene','supplies','shopping','health','vote','council-session','informal-service','informal-frontage','informal-gardening']);
export function citizenAnimation(c,moving=false){
  if(c.mobilityTrip?.stage==='boarding')return 'mount';
  if(c.ridingVehicleId){
    if(['bicicleta','bicicleta_carga'].includes(c.ridingVehicleKind))return c.mobilityTrip?.stage==='riding'?'pedal':'passenger';
    return ['patinete','patins','skate'].includes(c.ridingVehicleKind)?'glide':'passenger';
  }
  if(moving)return 'run';
  if(c.seated)return 'seated';
  const activelyUsingFurniture=!!c.furnitureUse&&!c.furnitureUse.seated;
  const activelyWorkingOutside=!!c.workCell||!!c.forestryJob||!!c.paintWorkId;
  const activelyInsideWork=!!c.indoorLocation?.unitId&&WORK_TASKS.has(c.task);
  const activelyOnGig=!!c.informalJobId&&!c.path?.length;
  const activelyWorking=WORK_TASKS.has(c.task)&&!c.path?.length&&(activelyUsingFurniture||activelyWorkingOutside||activelyInsideWork||activelyOnGig||c.task==='construction'&&c.workProjectId!=null);
  return activelyWorking?'use':'idle';
}
export function citizenFrame(clip,time,phase=0){
  if(clip==='mount'||clip==='passenger')return {clip:'use',frame:0};
  if(clip==='seated')return {clip:'use',frame:2};
  if(clip==='glide')return {clip:'use',frame:1};
  const sequence=clip==='pedal'?[0,2,4]:clip==='use'?[0,1]:CITIZEN_MODEL_FRAMES[clip]||[0],fps=clip==='run'||clip==='pedal'?8:4;
  return {clip:clip==='pedal'?'run':clip in CITIZEN_MODEL_FRAMES?clip:'idle',frame:sequence[Math.floor(Math.max(0,time)*fps+phase)%sequence.length]};
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
export const RENDERED_GARMENTS=Object.freeze(['camisa','calça','vestido','casaco','saia','macacão','shorts','sapatos','botas','trapos']);
export function garmentSurface(reference,piece){
  const mask=new Uint8Array(reference.positions.length/9);
  for(let t=0;t<mask.length;t++){
    const i=t*9,p=reference.positions,y=(p[i+1]+p[i+4]+p[i+7])/3;
    const upper=y>=1.03&&y<1.78,lower=y>=.12&&y<1.10;
    mask[t]=Number(piece==='camisa'||piece==='trapos'?upper:piece==='casaco'?y>=.85&&y<1.79:piece==='calça'?lower:piece==='shorts'?y>=.55&&y<1.10:piece==='sapatos'?y<.20:piece==='botas'?y<.42:piece==='saia'?y>=.53&&y<1.13:piece==='vestido'?y>=.45&&y<1.78:piece==='macacão'?y>=.12&&y<1.78:false);
  }
  return mask;
}
// Headwear uses a separate mesh so a hat and the main garment can be worn together.
// Its anchor is computed independently for each animated OBJ frame.
export function headwearSurface(data,piece){
  const p=data.positions;let top=-Infinity;for(let i=1;i<p.length;i+=3)top=Math.max(top,p[i]);
  let x=0,z=0,n=0;for(let i=0;i<p.length;i+=3)if(p[i+1]>=top-.07){x+=p[i];z+=p[i+2];n++;}x/=n||1;z/=n||1;
  const positions=[],normals=[],tri=(a,b,c)=>{const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,len=Math.hypot(nx,ny,nz)||1;for(const q of [a,b,c]){positions.push(...q);normals.push(nx/len,ny/len,nz/len);}};
  const ring=(radius,y,i)=>{const angle=i*Math.PI*2/12;return [x+Math.cos(angle)*radius,y,z+Math.sin(angle)*radius];};
  const base=top-.025,height=piece==='chapéu'?.11:.065,radius=piece==='chapéu'?.09:.095;
  for(let i=0;i<12;i++){const a=ring(radius,base,i),b=ring(radius,base,i+1),c=ring(radius*.72,base+height,i+1),d=ring(radius*.72,base+height,i);tri(a,b,c);tri(a,c,d);tri(d,c,[x,base+height,z]);
    if(piece==='chapéu'){const outer=ring(.14,base,i),next=ring(.14,base,i+1);tri(a,outer,next);tri(a,next,b);}}
  if(piece==='boné'){const y=base+.005,a=[x-.075,y,z+.03],b=[x+.075,y,z+.03],c=[x+.085,y,z+.16],d=[x-.085,y,z+.16];tri(a,b,c);tri(a,c,d);}
  return {positions:new Float32Array(positions),normals:new Float32Array(normals)};
}
export function splitGarmentSurface(data,mask){
  const body=[],bodyNormals=[],clothes=[],clothesNormals=[];
  for(let t=0;t<data.positions.length/9;t++){
    const selected=mask[t],p=selected?clothes:body,n=selected?clothesNormals:bodyNormals;
    for(let j=0;j<9;j++){p.push(data.positions[t*9+j]);n.push(data.normals[t*9+j]);}
  }
  return {body:new Float32Array(body),bodyNormals:new Float32Array(bodyNormals),clothes:new Float32Array(clothes),clothesNormals:new Float32Array(clothesNormals)};
}
export class CityCitizenModels {
  constructor(THREE,group,{fetchAsset=globalThis.fetch?.bind(globalThis),baseURL=new URL('../data/model/',import.meta.url)}={}){
    this.THREE=THREE;this.group=group;this.fetchAsset=fetchAsset;this.baseURL=baseURL;this.frames=new Map();this.outfits=new Map();this.headwear=new Map();this.headwearBatches=new Map();this.batches=new Map();this.motion=new WeakMap();this.clock=0;this.ready=false;this.error=null;
    this.matrix=new THREE.Matrix4();this.position=new THREE.Vector3();this.scale=new THREE.Vector3();this.quaternion=new THREE.Quaternion();this.axis=new THREE.Vector3(0,1,0);this.lyingRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);this.color=new THREE.Color();
    this.material=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide});
    this.loading=this.load().catch(error=>{this.error=error.message;console.warn('Modelos dos cidadãos indisponíveis; usando sprites.',error.message);return false;});
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
      const source=key.startsWith('idle:')?'idle':'animated';
      for(const piece of RENDERED_GARMENTS){
        const parts=splitGarmentSurface(data,masks[source][piece]);
        const make=(positions,normals)=>{const g=new this.THREE.BufferGeometry();g.setAttribute('position',new this.THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new this.THREE.Float32BufferAttribute(normals,3));g.computeBoundingSphere();return g;};
        this.outfits.set(`${key}:${piece}`,{body:make(parts.body,parts.bodyNormals),clothes:make(parts.clothes,parts.clothesNormals)});
        if(['sapatos','botas','calça','shorts','saia'].includes(piece)){const surface=parts.clothes.slice();for(let i=0;i<surface.length;i++)surface[i]+=parts.clothesNormals[i]*.003;this.headwear.set(`${key}:${piece}`,make(surface,parts.clothesNormals));}
      }
      for(const piece of ['boné','chapéu']){const part=headwearSurface(data,piece),g=new this.THREE.BufferGeometry();g.setAttribute('position',new this.THREE.Float32BufferAttribute(part.positions,3));g.setAttribute('normal',new this.THREE.Float32BufferAttribute(part.normals,3));g.computeBoundingSphere();this.headwear.set(`${key}:${piece}`,g);}
    }
    this.ready=true;return true;
  }
  begin(dt=0,speed=1){this.animationPaused=speed<=0;this.frameDelta=Math.max(0,Math.min(.1,dt));this.clock+=this.frameDelta*Math.max(0,Math.min(2,speed));for(const batch of this.batches.values())batch.count=0;for(const batch of this.headwearBatches.values())batch.count=0;}
  add(entity,surfaceH,{hidden=false,dimmed=false,perspective=false,vehicleAngle=null}={}){
    if(!this.ready)return false;
    const c=entity.properties.citizen;if(!c)return false;
    if(hidden)return true;
    const inside=c.ridingVehicleId?null:c._renderIndoorPosition||c.indoorLocation?.position,x=inside?.x??entity.x,y=inside?.y??entity.y;
    let motion=this.motion.get(entity);
     if(!motion){motion={x,y,angle:0,walkDistance:0,walkFrame:0,lastStepAt:-Infinity};this.motion.set(entity,motion);}
    const dx=x-motion.x,dy=y-motion.y;
    const moved=dx*dx+dy*dy>1e-7;
     if(moved){motion.angle=Math.atan2(dx,dy);if(!this.animationPaused)motion.walkDistance+=Math.hypot(dx,dy);motion.x=x;motion.y=y;}
    if(c.ridingVehicleId&&Number.isFinite(vehicleAngle))motion.angle=vehicleAngle;
    // Keep quarter-tile footsteps, but present adjacent poses instead of skipping
    // a full animation cycle when a worker snapshot jumps several tiles.
    if(moved&&!this.animationPaused&&motion.walkDistance+1e-8>=.25&&this.clock-motion.lastStepAt>=.1-1e-8){motion.walkFrame++;motion.walkDistance=Math.max(0,motion.walkDistance%.25);motion.lastStepAt=this.clock;}
    // A pending path is not movement. Hold the travel pose between footsteps;
    // work animations still use the simulation's presentation clock.
    const traveling=moved||!!c.path?.length||!!c.deliveryId||!!c.mobilityTrip&&c.mobilityTrip.stage!=='boarding';
    const sleeping=citizenIsSleeping(c),clip=citizenAnimation(c,traveling),animationTime=clip==='run'||clip==='pedal'?motion.walkFrame/8:this.clock,pose=sleeping?{clip:'idle',frame:0}:citizenFrame(clip,animationTime,(entity.id*13)%17),key=`${pose.clip}:${pose.frame}`;
    if(!traveling&&!sleeping&&c.facingTarget)motion.angle=Math.atan2(c.facingTarget.x-x,c.facingTarget.y-y);
    const garment=c.wearingIndex===-1?null:c.wardrobe?.[Number.isInteger(c.wearingIndex)?c.wearingIndex:0],piece=RENDERED_GARMENTS.includes(garment?.piece)?garment.piece:null,batchKey=piece?`${key}:${piece}`:key,outfit=piece?this.outfits.get(batchKey):null;
    let batch=this.batches.get(batchKey);if(!batch){batch={count:0,capacity:0,mesh:null,clothingMesh:null};this.batches.set(batchKey,batch);}
    if(batch.count===batch.capacity){
      const capacity=Math.max(32,batch.capacity*2),mesh=new this.THREE.InstancedMesh(outfit?.body||this.frames.get(key),this.material,capacity);mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
      if(batch.mesh){for(let i=0;i<batch.count;i++){batch.mesh.getMatrixAt(i,this.matrix);mesh.setMatrixAt(i,this.matrix);batch.mesh.getColorAt(i,this.color);mesh.setColorAt(i,this.color);}this.group.remove(batch.mesh);batch.mesh.dispose();}
      this.group.add(mesh);batch.mesh=mesh;
      if(outfit){const clothing=new this.THREE.InstancedMesh(outfit.clothes,this.material,capacity);clothing.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);clothing.frustumCulled=false;clothing.castShadow=true;clothing.receiveShadow=true;
        if(batch.clothingMesh){for(let i=0;i<batch.count;i++){batch.clothingMesh.getMatrixAt(i,this.matrix);clothing.setMatrixAt(i,this.matrix);batch.clothingMesh.getColorAt(i,this.color);clothing.setColorAt(i,this.color);}this.group.remove(batch.clothingMesh);batch.clothingMesh.dispose();}
        this.group.add(clothing);batch.clothingMesh=clothing;
      }batch.capacity=capacity;
    }
    const size=(entity.properties.render.size||1)*(perspective?1.05:1);
    const indoorBed=c.indoorLocation?.roomType==='bedroom';this.position.set(x,surfaceH+(inside?.z||0)+(c.ridingVehicleId? .18:0)+(sleeping?(indoorBed ? .42 : size*.27):0),y);this.quaternion.setFromAxisAngle(this.axis,motion.angle);if(sleeping)this.quaternion.multiply(this.lyingRotation);this.scale.set(size,size,size);this.matrix.compose(this.position,this.quaternion,this.scale);batch.mesh.setMatrixAt(batch.count,this.matrix);
    this.color.setHex(entity.combatFlash>0?0xff3333:dimmed?0x555555:entity.properties.render.color??0xe8e8e8);batch.mesh.setColorAt(batch.count,this.color);
    if(batch.clothingMesh){batch.clothingMesh.setMatrixAt(batch.count,this.matrix);const raw=garment?.color,hex=typeof raw==='number'?raw:typeof raw==='string'&&/^#[0-9a-f]{6}$/i.test(raw)?parseInt(raw.slice(1),16):0x8d806e;this.color.setHex(entity.combatFlash>0?0xff3333:dimmed?0x555555:hex);if(!dimmed&&entity.combatFlash<=0&&(garment?.dirt||0)>0)this.color.lerp(new this.THREE.Color(0x62584b),Math.min(.72,garment.dirt/140));batch.clothingMesh.setColorAt(batch.count,this.color);}batch.count++;
    const capId=c.political?.partyCapId||c.campaign?.capGarmentId,partyCap=capId&&c.wardrobe?.find(g=>g.garmentId===capId),hat=partyCap||(Number.isInteger(c.headwearIndex)&&c.headwearIndex>=0?c.wardrobe?.[c.headwearIndex]:null);
    const footwear=Number.isInteger(c.footwearIndex)&&c.footwearIndex>=0?c.wardrobe?.[c.footwearIndex]:null;
    const lower=Number.isInteger(c.lowerWearIndex)&&c.lowerWearIndex>=0?c.wardrobe?.[c.lowerWearIndex]:null;
    for(const item of [hat,footwear,lower])if(item&&['boné','chapéu','sapatos','botas','calça','shorts','saia'].includes(item.piece)){const itemKey=`${key}:${item.piece}`;let head=this.headwearBatches.get(itemKey);if(!head){head={count:0,capacity:0,mesh:null};this.headwearBatches.set(itemKey,head);}if(head.count===head.capacity){const capacity=Math.max(32,head.capacity*2),mesh=new this.THREE.InstancedMesh(this.headwear.get(itemKey),this.material,capacity);mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;if(head.mesh){for(let i=0;i<head.count;i++){head.mesh.getMatrixAt(i,this.matrix);mesh.setMatrixAt(i,this.matrix);head.mesh.getColorAt(i,this.color);mesh.setColorAt(i,this.color);}this.group.remove(head.mesh);head.mesh.dispose();}this.group.add(mesh);head.mesh=mesh;head.capacity=capacity;this.matrix.compose(this.position,this.quaternion,this.scale);}head.mesh.setMatrixAt(head.count,this.matrix);const raw=item.color,hex=typeof raw==='number'?raw:typeof raw==='string'&&/^#[0-9a-f]{6}$/i.test(raw)?parseInt(raw.slice(1),16):0x8d806e;this.color.setHex(entity.combatFlash>0?0xff3333:dimmed?0x555555:hex);if(!dimmed&&entity.combatFlash<=0&&(item.dirt||0)>0)this.color.lerp(new this.THREE.Color(0x62584b),Math.min(.72,item.dirt/140));head.mesh.setColorAt(head.count++,this.color);}
    return true;
  }
  end(){for(const batch of this.batches.values()){batch.mesh.count=batch.count;if(batch.count){batch.mesh.instanceMatrix.needsUpdate=true;if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;}if(batch.clothingMesh){batch.clothingMesh.count=batch.count;if(batch.count){batch.clothingMesh.instanceMatrix.needsUpdate=true;if(batch.clothingMesh.instanceColor)batch.clothingMesh.instanceColor.needsUpdate=true;}}}for(const batch of this.headwearBatches.values()){batch.mesh.count=batch.count;if(batch.count){batch.mesh.instanceMatrix.needsUpdate=true;if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;}}}
  clear(){for(const b of this.batches.values()){this.group.remove(b.mesh);b.mesh.dispose();if(b.clothingMesh){this.group.remove(b.clothingMesh);b.clothingMesh.dispose();}}for(const b of this.headwearBatches.values()){this.group.remove(b.mesh);b.mesh.dispose();}this.batches.clear();this.headwearBatches.clear();this.motion=new WeakMap();this.clock=0;}
}
