/** OBJ snapshots share one geometry per frame and one instanced draw per visible frame. */
export const CITIZEN_MODEL_FRAMES=Object.freeze({idle:[0],run:[0,1,2,3,4],use:[0,1,2]});
const WORK_TASKS=new Set(['work','manage','construction','clean','cleaning','research','campaign','care','caregiving','food','provisions','health','vote','council-session']);
export function citizenAnimation(c,moving=false){
  if(c.ridingVehicleId)return ['patinete','patins','skate'].includes(c.ridingVehicleKind)?'glide':'ride';
  if(moving)return 'run';
  return WORK_TASKS.has(c.task)&&!c.path?.length?'use':'idle';
}
export function citizenFrame(clip,time,phase=0){
  if(clip==='ride')return {clip:'use',frame:1};
  if(clip==='glide')return {clip:'use',frame:1};
  const sequence=clip==='use'?[0,1,2,1]:CITIZEN_MODEL_FRAMES[clip]||[0],fps=clip==='run'?8:4;
  return {clip:clip in CITIZEN_MODEL_FRAMES?clip:'idle',frame:sequence[Math.floor(Math.max(0,time)*fps+phase)%sequence.length]};
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
export const RENDERED_GARMENTS=Object.freeze(['camisa','calça','vestido','casaco','saia','macacão','trapos']);
export function garmentSurface(reference,piece){
  const mask=new Uint8Array(reference.positions.length/9);
  for(let t=0;t<mask.length;t++){
    const i=t*9,p=reference.positions,y=(p[i+1]+p[i+4]+p[i+7])/3;
    const upper=y>=1.03&&y<1.78,lower=y>=.12&&y<1.10;
    mask[t]=Number(piece==='camisa'||piece==='trapos'?upper:piece==='casaco'?y>=.85&&y<1.79:piece==='calça'?lower:piece==='saia'?y>=.53&&y<1.13:piece==='vestido'?y>=.45&&y<1.78:piece==='macacão'?y>=.12&&y<1.78:false);
  }
  return mask;
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
    this.THREE=THREE;this.group=group;this.fetchAsset=fetchAsset;this.baseURL=baseURL;this.frames=new Map();this.outfits=new Map();this.batches=new Map();this.motion=new WeakMap();this.clock=0;this.ready=false;this.error=null;
    this.matrix=new THREE.Matrix4();this.position=new THREE.Vector3();this.scale=new THREE.Vector3();this.quaternion=new THREE.Quaternion();this.axis=new THREE.Vector3(0,1,0);this.color=new THREE.Color();
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
      }
    }
    this.ready=true;return true;
  }
  begin(dt=0,speed=1){this.clock+=Math.max(0,Math.min(.1,dt))*Math.max(0,Math.min(2,speed));for(const batch of this.batches.values())batch.count=0;}
  add(entity,surfaceH,{hidden=false,dimmed=false,perspective=false}={}){
    if(!this.ready)return false;
    const c=entity.properties.citizen;if(!c)return false;
    if(hidden)return true;
    const inside=c.indoorLocation?.position,x=inside?.x??entity.x,y=inside?.y??entity.y;
    let motion=this.motion.get(entity);
    if(!motion){motion={x,y,angle:0,walkDistance:0,hasWalked:false};this.motion.set(entity,motion);}
    const dx=x-motion.x,dy=y-motion.y;
    const moved=dx*dx+dy*dy>1e-7;
    if(moved){motion.angle=Math.atan2(dx,dy);if(!c.ridingVehicleId){motion.walkDistance+=Math.hypot(dx,dy);motion.hasWalked=true;}motion.x=x;motion.y=y;}
    if(c.ridingVehicleId&&c.mobilityTrip){const next=c.path?.[0];if(next)motion.angle=Math.atan2(next.x-entity.x,next.y-entity.y);}
    const clip=citizenAnimation(c,moved||!!c.path?.length&&motion.hasWalked),pose=clip==='run'?{clip:'run',frame:Math.floor(motion.walkDistance*3+(entity.id*13)%17)%CITIZEN_MODEL_FRAMES.run.length}:citizenFrame(clip,this.clock,(entity.id*13)%17),key=`${pose.clip}:${pose.frame}`;
    const garment=c.wardrobe?.[c.wearingIndex||0],piece=RENDERED_GARMENTS.includes(garment?.piece)?garment.piece:null,batchKey=piece?`${key}:${piece}`:key,outfit=piece?this.outfits.get(batchKey):null;
    let batch=this.batches.get(batchKey);if(!batch){batch={count:0,capacity:0,mesh:null,clothingMesh:null};this.batches.set(batchKey,batch);}
    if(batch.count===batch.capacity){
      const capacity=Math.max(32,batch.capacity*2),mesh=new this.THREE.InstancedMesh(outfit?.body||this.frames.get(key),this.material,capacity);mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;
      if(batch.mesh){for(let i=0;i<batch.count;i++){batch.mesh.getMatrixAt(i,this.matrix);mesh.setMatrixAt(i,this.matrix);batch.mesh.getColorAt(i,this.color);mesh.setColorAt(i,this.color);}this.group.remove(batch.mesh);batch.mesh.dispose();}
      this.group.add(mesh);batch.mesh=mesh;
      if(outfit){const clothing=new this.THREE.InstancedMesh(outfit.clothes,this.material,capacity);clothing.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);clothing.frustumCulled=false;clothing.castShadow=false;clothing.receiveShadow=true;
        if(batch.clothingMesh){for(let i=0;i<batch.count;i++){batch.clothingMesh.getMatrixAt(i,this.matrix);clothing.setMatrixAt(i,this.matrix);batch.clothingMesh.getColorAt(i,this.color);clothing.setColorAt(i,this.color);}this.group.remove(batch.clothingMesh);batch.clothingMesh.dispose();}
        this.group.add(clothing);batch.clothingMesh=clothing;
      }batch.capacity=capacity;
    }
    const size=(entity.properties.render.size||1)*(perspective?1.05:1);
    this.position.set(x,surfaceH+(inside?.z||0)+(c.ridingVehicleId? .18:0),y);this.quaternion.setFromAxisAngle(this.axis,motion.angle);this.scale.set(size,size,size);this.matrix.compose(this.position,this.quaternion,this.scale);batch.mesh.setMatrixAt(batch.count,this.matrix);
    this.color.setHex(entity.combatFlash>0?0xff3333:dimmed?0x555555:entity.properties.render.color??0xe8e8e8);batch.mesh.setColorAt(batch.count,this.color);
    if(batch.clothingMesh){batch.clothingMesh.setMatrixAt(batch.count,this.matrix);const raw=garment?.color,hex=typeof raw==='number'?raw:typeof raw==='string'&&/^#[0-9a-f]{6}$/i.test(raw)?parseInt(raw.slice(1),16):0x8d806e;this.color.setHex(entity.combatFlash>0?0xff3333:dimmed?0x555555:hex);if(!dimmed&&entity.combatFlash<=0)this.color.lerp(new this.THREE.Color(0x62584b),Math.min(.72,(garment?.dirt||0)/140));batch.clothingMesh.setColorAt(batch.count,this.color);}batch.count++;return true;
  }
  end(){for(const batch of this.batches.values()){batch.mesh.count=batch.count;if(batch.count){batch.mesh.instanceMatrix.needsUpdate=true;if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;}if(batch.clothingMesh){batch.clothingMesh.count=batch.count;if(batch.count){batch.clothingMesh.instanceMatrix.needsUpdate=true;if(batch.clothingMesh.instanceColor)batch.clothingMesh.instanceColor.needsUpdate=true;}}}}
  clear(){for(const b of this.batches.values()){this.group.remove(b.mesh);b.mesh.dispose();if(b.clothingMesh){this.group.remove(b.clothingMesh);b.clothingMesh.dispose();}}this.batches.clear();this.motion=new WeakMap();this.clock=0;}
}
