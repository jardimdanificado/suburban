// The bedding and grass cutout share the same seed, position and dimensions.
export function cardboardFootprint(site){
  const seed=Math.imul((site.citizenId||0)+31,2654435761)>>>0;
  const x=site.x+((seed>>>12)%3-1)*.12,z=site.y+((seed>>>14)%3-1)*.12;
  const quarter=(seed>>>16)%4,width=quarter%2?.50:.68,depth=quarter%2?.68:.50;
  return {x,z,angle:quarter*Math.PI/2,minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2};
}
export function syncCardboardGrass(renderer,THREE,city){
  const revision=city?.cardboardRevision||0;
  if(renderer._cardboardGrassCity!==city||renderer._cardboardGrassRevision!==revision){
    renderer._cardboardGrassCity=city;renderer._cardboardGrassRevision=revision;
    const cells=new Map();
    for(const site of city?.cardboardShelters?.values()||[]){
      const box=cardboardFootprint(site);
      for(let z=Math.floor(box.minZ-.2);z<=Math.floor(box.maxZ+.2);z++)for(let x=Math.floor(box.minX-.2);x<=Math.floor(box.maxX+.2);x++){
        const key=`${x},${z}`;let list=cells.get(key);if(!list)cells.set(key,list=[]);list.push(box);
      }
    }
    renderer._cardboardGrassCells=cells;renderer._cardboardGrassMeshes=new WeakSet();
  }
  for(const chunk of renderer.terrainChunks.values())for(const mesh of chunk.terrain.children){
    const geometry=mesh.geometry,roots=geometry?.getAttribute('grassRoot');
    if(!roots||renderer._cardboardGrassMeshes.has(geometry))continue;
    const values=new Float32Array(roots.count*4);
    for(let i=0;i<roots.count;i++){
      const x=roots.getX(i),z=roots.getZ(i),boxes=renderer._cardboardGrassCells.get(`${Math.floor(x)},${Math.floor(z)}`);
      const box=boxes?.find(b=>x>=b.minX-.2&&x<=b.maxX+.2&&z>=b.minZ-.2&&z<=b.maxZ+.2);
      if(box)values.set([box.minX,box.minZ,box.maxX,box.maxZ],i*4);
    }
    geometry.setAttribute('grassShelter',new THREE.InstancedBufferAttribute(values,4));
    renderer._cardboardGrassMeshes.add(geometry);
  }
}
