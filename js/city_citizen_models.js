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
export class CityCitizenModels {
  constructor(THREE,group,{fetchAsset=globalThis.fetch?.bind(globalThis),baseURL=new URL('../data/model/',import.meta.url)}={}){
    this.THREE=THREE;this.group=group;this.fetchAsset=fetchAsset;this.baseURL=baseURL;this.frames=new Map();this.batches=new Map();this.motion=new WeakMap();this.clock=0;this.ready=false;this.error=null;
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
    const idle=entries.find(e=>e.key==='idle:0').data.bounds,height=idle.max[1]-idle.min[1];if(!(height>0))throw Error('Modelo sem altura');
    const origin=[(idle.min[0]+idle.max[0])/2,Math.min(...entries.map(e=>e.data.bounds.min[1])),(idle.min[2]+idle.max[2])/2],factor=1.05/height;
    for(const {key,data}of entries){const positions=data.positions;for(let i=0;i<positions.length;i++)positions[i]=(positions[i]-origin[i%3])*factor;
      const geometry=new this.THREE.BufferGeometry();geometry.setAttribute('position',new this.THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new this.THREE.Float32BufferAttribute(data.normals,3));geometry.computeBoundingSphere();this.frames.set(key,geometry);
    }
    this.ready=true;return true;
  }
  begin(dt=0,speed=1){this.clock+=Math.max(0,Math.min(.1,dt))*Math.max(0,Math.min(2,speed));for(const batch of this.batches.values())batch.count=0;}
  add(entity,surfaceH,{hidden=false,dimmed=false,perspective=false}={}){
    if(!this.ready)return false;
    const c=entity.properties.citizen;if(!c)return false;
    if(hidden||c.indoorLocation)return true;
    let motion=this.motion.get(entity);
    if(!motion){motion={x:entity.x,y:entity.y,angle:0,walkDistance:0,hasWalked:false};this.motion.set(entity,motion);}
    const dx=entity.x-motion.x,dy=entity.y-motion.y;
    const moved=dx*dx+dy*dy>1e-7;
    if(moved){motion.angle=Math.atan2(dx,dy);if(!c.ridingVehicleId){motion.walkDistance+=Math.hypot(dx,dy);motion.hasWalked=true;}motion.x=entity.x;motion.y=entity.y;}
    if(c.ridingVehicleId&&c.mobilityTrip){const next=c.path?.[0];if(next)motion.angle=Math.atan2(next.x-entity.x,next.y-entity.y);}
    const clip=citizenAnimation(c,moved||!!c.path?.length&&motion.hasWalked),pose=clip==='run'?{clip:'run',frame:Math.floor(motion.walkDistance*3+(entity.id*13)%17)%CITIZEN_MODEL_FRAMES.run.length}:citizenFrame(clip,this.clock,(entity.id*13)%17),key=`${pose.clip}:${pose.frame}`;
    let batch=this.batches.get(key);if(!batch){batch={count:0,capacity:0,mesh:null};this.batches.set(key,batch);}
    if(batch.count===batch.capacity){
      const capacity=Math.max(32,batch.capacity*2),mesh=new this.THREE.InstancedMesh(this.frames.get(key),this.material,capacity);mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;
      if(batch.mesh){for(let i=0;i<batch.count;i++){batch.mesh.getMatrixAt(i,this.matrix);mesh.setMatrixAt(i,this.matrix);batch.mesh.getColorAt(i,this.color);mesh.setColorAt(i,this.color);}this.group.remove(batch.mesh);batch.mesh.dispose();}
      this.group.add(mesh);batch.mesh=mesh;batch.capacity=capacity;
    }
    const size=(entity.properties.render.size||1)*(perspective?1.05:1);
    this.position.set(entity.x,surfaceH+(c.ridingVehicleId? .18:0),entity.y);this.quaternion.setFromAxisAngle(this.axis,motion.angle);this.scale.set(size,size,size);this.matrix.compose(this.position,this.quaternion,this.scale);batch.mesh.setMatrixAt(batch.count,this.matrix);
    this.color.setHex(entity.combatFlash>0?0xff3333:dimmed?0x555555:entity.properties.render.color??0xe8e8e8);batch.mesh.setColorAt(batch.count++,this.color);return true;
  }
  end(){for(const batch of this.batches.values()){batch.mesh.count=batch.count;if(batch.count){batch.mesh.instanceMatrix.needsUpdate=true;if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;}}}
  clear(){for(const b of this.batches.values()){this.group.remove(b.mesh);b.mesh.dispose();}this.batches.clear();this.motion=new WeakMap();this.clock=0;}
}
