// Share the three unchanged lamp models across posts. Original model nodes
// remain available for visibility, terrain placement and reference comparisons.
export function syncLampBatches(renderer,THREE){
 const lamps=renderer.lampMeshes;if(!lamps)return;
 const batches=renderer.lampBatches??=new Map(),state=renderer._lampBatchState??={};
 const enabled=!renderer.lampBatchReference;let signature='';
 for(const [id,lamp]of lamps){
  if(!lamp.userData.batchParts){
   let hash=0;for(const char of String(id))hash=Math.imul(hash^char.charCodeAt(0),16777619);
   lamp.userData.batchVariant=(hash>>>0)%3;
   const parts=[];lamp.traverse(mesh=>{if(mesh.isMesh&&!mesh.isInstancedMesh)parts.push(mesh);});lamp.userData.batchParts=parts;
  }
  signature+=`${id}:${lamp.id}:${lamp.visible?1:0}:${lamp.position.x},${lamp.position.y},${lamp.position.z}:${lamp.userData.lantern.material.emissive.getHex()}|`;
 }
 if(state.signature===signature&&state.enabled===enabled)return;
 state.signature=signature;state.enabled=enabled;
 for(const lamp of lamps.values())for(const source of lamp.userData.batchParts)source.visible=!enabled;
 for(const mesh of batches.values()){mesh.visible=false;mesh.count=0;}
 if(!enabled)return;
 const groups=new Map();
 for(const lamp of lamps.values()){
  if(!lamp.visible)continue;lamp.updateMatrixWorld(true);
  for(const source of lamp.userData.batchParts){
   const part=source===lamp.userData.lantern?'glass':source.parent===lamp?'base':'head';
   const key=`${lamp.userData.styleVersion}:${lamp.userData.batchVariant}:${part}:${source.material.emissive.getHex()}`;
   let list=groups.get(key);if(!list)groups.set(key,list=[]);list.push(source);
  }
 }
 for(const [key,sources]of groups){
  let mesh=batches.get(key);const first=sources[0];
  if(!mesh){
   mesh=new THREE.InstancedMesh(first.geometry.clone(),first.material.clone(),Math.max(16,2**Math.ceil(Math.log2(sources.length))));
   mesh.name=`city-lamp-${key}`;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.frustumCulled=false;
   renderer.scene.add(mesh);batches.set(key,mesh);
  }else if(sources.length>mesh.instanceMatrix.count){
   const replacement=new THREE.InstancedMesh(mesh.geometry,mesh.material,2**Math.ceil(Math.log2(sources.length)));
   replacement.name=mesh.name;replacement.instanceMatrix.setUsage(THREE.DynamicDrawUsage);replacement.castShadow=mesh.castShadow;replacement.receiveShadow=mesh.receiveShadow;replacement.frustumCulled=false;
   renderer.scene.remove(mesh);mesh.dispose?.();renderer.scene.add(replacement);batches.set(key,mesh=replacement);
  }
  for(let i=0;i<sources.length;i++)mesh.setMatrixAt(i,sources[i].matrixWorld);
  mesh.count=sources.length;mesh.visible=true;mesh.instanceMatrix.needsUpdate=true;
 }
}
