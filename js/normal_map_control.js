/** Dynamic materials share the graphics option without rebuilding their geometry. */
export class NormalMapControl {
 constructor(enabled=true){this.enabled=enabled;this.materials=new Map();}
 register(material){
  if(!material||this.materials.has(material)||!material.normalMap)return material;
  this.materials.set(material,material.normalMap);
  material.addEventListener('dispose',()=>this.materials.delete(material));
  if(!this.enabled){material.normalMap=null;material.needsUpdate=true;}
  return material;
 }
 registerGroup(group){group?.traverse(object=>{for(const material of [object.material].flat())this.register(material);});}
 setEnabled(enabled){
  enabled=enabled!==false;if(enabled===this.enabled)return;
  this.enabled=enabled;
  for(const [material,map]of this.materials){material.normalMap=enabled?map:null;material.needsUpdate=true;}
 }
}
