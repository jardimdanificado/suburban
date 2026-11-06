// Reconstructs the former duplicated shutter geometry for side-by-side GPU measurements.
// It keeps material/object IDs unchanged so sorting and depth ties stay equal.
export function shutterReference(THREE,records){
 const meshes=[...new Set(records.flatMap(r=>[r.dirtyMeshes.opaque,r.dirtyMeshes.glass]))];
 const pairs=meshes.map(mesh=>{
  const original=mesh.geometry,geometry=new THREE.BufferGeometry(),count=original.attributes.position.count;
  for(const [name,a]of Object.entries(original.attributes)){
   const data=new a.array.constructor(a.array.length*2);data.set(a.array);data.set(a.array,a.array.length);
   if(name==='normal')for(let i=a.array.length;i<data.length;i++)data[i]=-data[i];
   geometry.setAttribute(name,new THREE.BufferAttribute(data,a.itemSize,a.normalized));
  }
  const old=original.index?Array.from(original.index.array):Array.from({length:count},(_,i)=>i),indices=old.slice();
  for(let i=0;i<old.length;i+=3)indices.push(count+old[i],count+old[i+2],count+old[i+1]);geometry.setIndex(indices);
  return{mesh,original,geometry};
 });
 return {
  set(optimized){for(const p of pairs){p.mesh.geometry=optimized?p.original:p.geometry;p.mesh.material.forceSinglePass=optimized;const side=optimized?THREE.DoubleSide:THREE.FrontSide;if(p.mesh.material.side!==side){p.mesh.material.side=side;p.mesh.material.needsUpdate=true;}}},
  instances:meshes.filter(m=>!m.material.transparent).reduce((n,m)=>n+m.count,0),
  dispose(){this.set(true);for(const p of pairs)p.geometry.dispose();}
 };
}
