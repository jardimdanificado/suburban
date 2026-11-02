// Static facade details have no individual animation or picking. Baking their
// transforms and colors into one mesh preserves the model while avoiding a
// draw call (and shadow draw) for every rail, planter and roof accessory.
export function mergeStaticMeshes(THREE,root){
 const parts=root.children.filter(m=>m.isMesh&&!m.userData.skipStaticMerge&&m.geometry?.attributes?.position&&m.geometry?.attributes?.normal&&!Array.isArray(m.material));
 const batches=new Map();for(const mesh of parts){const key=`${mesh.castShadow?1:0}:${mesh.receiveShadow?1:0}`,batch=batches.get(key)||[];batch.push(mesh);batches.set(key,batch);}
 const materials=new Set();
 for(const batch of batches.values()){
  if(batch.length<2)continue;
  const geometries=[];let vertices=0,valid=true;
  for(const mesh of batch){mesh.updateMatrix();const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(mesh.matrix);const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');if(!position||!normal||position.count!==normal.count){geometry.dispose();valid=false;break;}geometries.push({geometry,color:mesh.material.color});vertices+=position.count;}
  if(!valid){for(const part of geometries)part.geometry.dispose();continue;}
  const positions=new Float32Array(vertices*3),normals=new Float32Array(vertices*3),colors=new Float32Array(vertices*3);let offset=0;
  for(const {geometry,color} of geometries){const pos=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');for(let i=0;i<pos.count;i++){positions[offset]=pos.getX(i);normals[offset]=normal.getX(i);colors[offset++]=color.r;positions[offset]=pos.getY(i);normals[offset]=normal.getY(i);colors[offset++]=color.g;positions[offset]=pos.getZ(i);normals[offset]=normal.getZ(i);colors[offset++]=color.b;}geometry.dispose();}
  const merged=new THREE.BufferGeometry();merged.setAttribute('position',new THREE.BufferAttribute(positions,3));merged.setAttribute('normal',new THREE.BufferAttribute(normals,3));merged.setAttribute('color',new THREE.BufferAttribute(colors,3));merged.computeBoundingSphere();
  const first=batch[0];for(const mesh of batch){root.remove(mesh);mesh.geometry.dispose();materials.add(mesh.material);}
  const result=new THREE.Mesh(merged,new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true}));result.castShadow=first.castShadow;result.receiveShadow=first.receiveShadow;root.add(result);
 }
 const stillUsed=new Set();root.traverse(object=>{if(object.isMesh)for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)stillUsed.add(material);});for(const material of materials)if(!stillUsed.has(material))material.dispose();
}

