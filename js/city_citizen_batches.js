/** Batch existing citizen billboard transforms. Picking still uses entity bounds. */
export class CityCitizenBatches {
  constructor(THREE,group,geometry){this.THREE=THREE;this.group=group;this.geometry=geometry;this.batches=new Map();}
  begin(){for(const b of this.batches.values())b.count=0;}
  add(sprite){
    if(!sprite.visible)return;
    const material=sprite.material;
    let b=this.batches.get(material);
    if(!b){b={count:0,capacity:0,mesh:null};this.batches.set(material,b);}
    if(b.count===b.capacity){
      const capacity=Math.max(32,b.capacity*2),mesh=new this.THREE.InstancedMesh(this.geometry,material,capacity);
      mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);mesh.frustumCulled=false;
      mesh.castShadow=sprite.castShadow;mesh.receiveShadow=sprite.receiveShadow;mesh.customDepthMaterial=sprite.customDepthMaterial;mesh.renderOrder=sprite.renderOrder;
      if(b.mesh){for(let i=0;i<b.count;i++){b.mesh.getMatrixAt(i,sprite.matrix);mesh.setMatrixAt(i,sprite.matrix);}this.group.remove(b.mesh);b.mesh.dispose();}
      this.group.add(mesh);b.mesh=mesh;b.capacity=capacity;
    }
    sprite.updateMatrix();b.mesh.setMatrixAt(b.count++,sprite.matrix);sprite.visible=false;
  }
  end(){
    for(const [material,b]of this.batches){
      if(!b.count){this.group.remove(b.mesh);b.mesh.dispose();this.batches.delete(material);continue;}
      b.mesh.count=b.count;b.mesh.instanceMatrix.needsUpdate=true;
    }
  }
  clear(){for(const b of this.batches.values()){this.group.remove(b.mesh);b.mesh.dispose();}this.batches.clear();}
}
