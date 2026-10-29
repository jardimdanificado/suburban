// Static facade details have no individual animation or picking. Baking their
// transforms and colors into one mesh preserves the model while avoiding a
// draw call (and shadow draw) for every rail, planter and roof accessory.
export function mergeStaticMeshes(THREE,root){
 const parts=root.children.filter(m=>m.isMesh&&m.geometry?.attributes?.position&&m.geometry?.attributes?.normal&&!Array.isArray(m.material));
 if(parts.some(m=>m.castShadow!==parts[0].castShadow||m.receiveShadow!==parts[0].receiveShadow))return;
 if(parts.length<2)return;
 const geometries=[];let vertices=0;
 for(const mesh of parts){mesh.updateMatrix();const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(mesh.matrix);const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');if(!position||!normal||position.count!==normal.count){geometry.dispose();for(const part of geometries)part.geometry.dispose();return;}geometries.push({geometry,color:mesh.material.color});vertices+=position.count;}
 const positions=new Float32Array(vertices*3),normals=new Float32Array(vertices*3),colors=new Float32Array(vertices*3);let offset=0;
 for(const {geometry,color} of geometries){const pos=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');for(let i=0;i<pos.count;i++){positions[offset]=pos.getX(i);normals[offset]=normal.getX(i);colors[offset++]=color.r;positions[offset]=pos.getY(i);normals[offset]=normal.getY(i);colors[offset++]=color.g;positions[offset]=pos.getZ(i);normals[offset]=normal.getZ(i);colors[offset++]=color.b;}geometry.dispose();}
 const merged=new THREE.BufferGeometry();merged.setAttribute('position',new THREE.BufferAttribute(positions,3));merged.setAttribute('normal',new THREE.BufferAttribute(normals,3));merged.setAttribute('color',new THREE.BufferAttribute(colors,3));merged.computeBoundingSphere();
 const materials=new Set();for(const mesh of parts){root.remove(mesh);mesh.geometry.dispose();materials.add(mesh.material);}for(const material of materials)material.dispose();
 const result=new THREE.Mesh(merged,new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true}));result.castShadow=parts[0].castShadow;result.receiveShadow=parts[0].receiveShadow;root.add(result);
}

