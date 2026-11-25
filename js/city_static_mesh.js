// Static facade details have no individual animation or picking. Baking their
// transforms and colors into one mesh preserves the model while avoiding a
// draw call (and shadow draw) for every rail, planter and roof accessory.
 export function mergeStaticMeshes(THREE,root,{filter=null,mergeShadowFlags=false,recursive=false}={}){
 if(recursive)root.updateMatrixWorld(true);
 const visibleThroughRoot=mesh=>{for(let parent=mesh.parent;parent&&parent!==root;parent=parent.parent)if(!parent.visible)return false;return true;};
 const parts=[];
 const collect=object=>{for(const child of object.children){if(child.isMesh&&!child.isInstancedMesh&&!child.userData.skipStaticMerge&&child.visible&&visibleThroughRoot(child)&&child.geometry?.attributes?.position&&child.geometry?.attributes?.normal&&!Array.isArray(child.material)&&(!filter||filter(child)))parts.push(child);if(recursive&&!child.isMesh)collect(child);}};
 collect(root);
 const rootInverse=recursive?root.matrixWorld.clone().invert():null;
 const batches=new Map();for(const mesh of parts){const m=mesh.material,key=`${mergeShadowFlags?mesh.castShadow?1:0:`${mesh.castShadow?1:0}:${mesh.receiveShadow?1:0}`}:${m.side}:${m.flatShading?1:0}:${m.map?.uuid||''}:${m.normalMap?.uuid||''}:${m.roughness??''}:${m.metalness??''}`,batch=batches.get(key)||[];batch.push(mesh);batches.set(key,batch);}
 const materials=new Set();
 for(const batch of batches.values()){
  if(batch.length<2)continue;
  const geometries=[];let vertices=0,valid=true,hasUv=true;
  for(const mesh of batch){const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();let transform;if(recursive){mesh.updateMatrixWorld(true);transform=rootInverse.clone().multiply(mesh.matrixWorld);}else{mesh.updateMatrix();transform=mesh.matrix;}geometry.applyMatrix4(transform);const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');if(!position||!normal||position.count!==normal.count){geometry.dispose();valid=false;break;}if(!uv||uv.count!==position.count)hasUv=false;geometries.push({geometry,color:mesh.material.color,vertexColors:mesh.material.vertexColors});vertices+=position.count;}
  if(!valid){for(const part of geometries)part.geometry.dispose();continue;}
  const positions=new Float32Array(vertices*3),normals=new Float32Array(vertices*3),colors=new Float32Array(vertices*3),uvs=hasUv?new Float32Array(vertices*2):null;let offset=0,uvOffset=0;
  for(const {geometry,color,vertexColors} of geometries){const pos=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=hasUv?geometry.getAttribute('uv'):null,sourceColor=vertexColors?geometry.getAttribute('color'):null;for(let i=0;i<pos.count;i++){const r=sourceColor?.getX(i)??1,g=sourceColor?.getY(i)??r,b=sourceColor?.getZ(i)??r;positions[offset]=pos.getX(i);normals[offset]=normal.getX(i);colors[offset++]=color.r*r;positions[offset]=pos.getY(i);normals[offset]=normal.getY(i);colors[offset++]=color.g*g;positions[offset]=pos.getZ(i);normals[offset]=normal.getZ(i);colors[offset++]=color.b*b;if(uv){uvs[uvOffset++]=uv.getX(i);uvs[uvOffset++]=uv.getY(i);}}geometry.dispose();}
  const merged=new THREE.BufferGeometry();merged.setAttribute('position',new THREE.BufferAttribute(positions,3));merged.setAttribute('normal',new THREE.BufferAttribute(normals,3));merged.setAttribute('color',new THREE.BufferAttribute(colors,3));if(uvs)merged.setAttribute('uv',new THREE.BufferAttribute(uvs,2));merged.computeBoundingSphere();
  const first=batch[0],fm=first.material;for(const mesh of batch){mesh.removeFromParent();mesh.geometry.dispose();materials.add(mesh.material);}
  const matOpts={color:0xffffff,vertexColors:true,side:fm.side,flatShading:fm.flatShading};
  if(fm.map){matOpts.map=fm.map;matOpts.dithering=!!fm.dithering;}
  if(fm.normalMap){matOpts.normalMap=fm.normalMap;if(fm.normalScale)matOpts.normalScale=fm.normalScale;}
  const MatClass=(fm.map||fm.normalMap)&&THREE.MeshStandardMaterial?THREE.MeshStandardMaterial:THREE.MeshLambertMaterial;
  if(MatClass===THREE.MeshStandardMaterial){matOpts.roughness=fm.roughness??0.85;matOpts.metalness=fm.metalness??0;}
  const result=new THREE.Mesh(merged,new MatClass(matOpts));result.castShadow=first.castShadow;result.receiveShadow=mergeShadowFlags?batch.some(mesh=>mesh.receiveShadow):first.receiveShadow;root.add(result);
 }
 const stillUsed=new Set();root.traverse(object=>{if(object.isMesh)for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)stillUsed.add(material);});for(const material of materials)if(!stillUsed.has(material))material.dispose();
}

