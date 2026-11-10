import {partyFlagCanvas} from './city_party_flags.js';
import {mobilityModelGeometry} from './city_mobility_models.js?v=cargo-box-rear-1';
import {clothFlagGeometry,animateClothFlag,flagWindTime} from './city_flag_animation.js?v=flag-wind-tick-13';
import {surfaceElevation,flagNightFactor} from './city_terrain.js?v=entrance-retaining-clearance-1';
const colors={bicicleta:0x386b78,bicicleta_carga:0x9b603f,carrinho:0x52645b,patinete:0x648d82,patins:0xa3774b,skate:0x414943};
const inView=(r,x,y,margin=4)=>!Number.isFinite(r.renderedMinTx)||x-margin>=r.renderedMinTx&&x+margin<=r.renderedMaxTx+1&&y-margin>=r.renderedMinTy&&y+margin<=r.renderedMaxTy+1;
function batch(renderer,THREE,key,makeGeometry,makeMaterial,capacity){
  renderer.mobilityBatches??=new Map();let b=renderer.mobilityBatches.get(key);
  if(!b||b.capacity<capacity){const geometry=b?.geometry||makeGeometry(),material=b?.material||makeMaterial();if(b){renderer.scene.remove(b.mesh);b.mesh.dispose();}
    const count=Math.max(32,2**Math.ceil(Math.log2(Math.max(1,capacity)))),mesh=new THREE.InstancedMesh(geometry,material,count);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;renderer.scene.add(mesh);b={mesh,geometry,material,capacity:count};renderer.mobilityBatches.set(key,b);
  }return b;
}
export function syncCityMobility(renderer,THREE,entities,world){
  renderer.mobilityBatches??=new Map();
  const vehicles=entities.filter(e=>!e.destroyed&&e.properties?.cityVehicle&&!e.properties.cityVehicle.boatClass&&inView(renderer,e.x,e.y,1));
  if(!vehicles.length){
    for(const b of renderer.mobilityBatches?.values()||[])b.mesh.count=0;
    for(const [id,g] of renderer.cycleFlags||[]){renderer.scene.remove(g);g.traverse(o=>{o.geometry?.dispose();if(o.material&&!o.material.map)o.material.dispose();});renderer.cycleFlags.delete(id);}
    return;
  }
  const matrix=renderer._mobilityMatrix??=new THREE.Matrix4(),position=renderer._mobilityPosition??=new THREE.Vector3(),quaternion=renderer._mobilityQuaternion??=new THREE.Quaternion(),scale=renderer._mobilityScale??=new THREE.Vector3(),color=renderer._mobilityColor??=new THREE.Color(),axis=renderer._mobilityAxis??=new THREE.Vector3(0,1,0);
  const pitchAxis=renderer._mobilityPitchAxis??=new THREE.Vector3(1,0,0),pitchRotation=renderer._mobilityPitch??=new THREE.Quaternion();
  renderer.mobilityTemplates??=new Map();
  for(const b of renderer.mobilityBatches.values())b.mesh.count=0;
  const groups=new Map();for(const e of vehicles){const kind=e.properties.cityVehicle.good;if(!groups.has(kind))groups.set(kind,[]);groups.get(kind).push(e);}
  for(const [kind,list]of groups){
    let model=renderer.mobilityTemplates.get(kind);if(!model){model=mobilityModelGeometry(THREE,kind);renderer.mobilityTemplates.set(kind,model);}
    const makeMaterial=()=>new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true,side:THREE.DoubleSide});
    const fixed=batch(renderer,THREE,`cycle-detail-${kind}`,()=>model.fixed,makeMaterial,list.length);
    const painted=batch(renderer,THREE,`cycle-paint-${kind}`,()=>model.paint,makeMaterial,list.length);
    for(let i=0;i<list.length;i++){
      const e=list[i],v=e.properties.cityVehicle,angle=v.angle||0,h=surfaceElevation(world,e.x,e.y);
      const along=kind==='carrinho'?.3:.42,dx=Math.sin(angle)*along,dz=Math.cos(angle)*along;
      const pitch=Math.atan2(surfaceElevation(world,e.x+dx,e.y+dz)-surfaceElevation(world,e.x-dx,e.y-dz),along*2);
      position.set(e.x,h,e.y);scale.set(1,1,1);quaternion.setFromAxisAngle(axis,angle);pitchRotation.setFromAxisAngle(pitchAxis,-pitch);quaternion.multiply(pitchRotation);matrix.compose(position,quaternion,scale);
      fixed.mesh.setMatrixAt(i,matrix);painted.mesh.setMatrixAt(i,matrix);
      const tint=typeof v.color==='number'?v.color:typeof v.color==='string'&&/^#[0-9a-f]{6}$/i.test(v.color)?parseInt(v.color.slice(1),16):colors[kind]||0x52879a;
      painted.mesh.setColorAt(i,color.setHex(tint));
    }
    for(const b of [fixed,painted]){b.mesh.count=list.length;b.mesh.instanceMatrix.needsUpdate=true;if(b.mesh.instanceColor)b.mesh.instanceColor.needsUpdate=true;}
  }
  syncCycleFlags(renderer,THREE,vehicles,world,entities);
}

function syncCycleFlags(renderer,THREE,vehicles,world,entities){
 renderer.cycleFlags??=new Map();renderer.cycleFlagMaterials??=new Map();const live=new Set(),riders=new Map(entities.filter(e=>e.properties?.citizen?.ridingVehicleId).map(e=>[e.properties.citizen.id,e.properties.citizen]));
 for(const e of vehicles){const v=e.properties.cityVehicle,rider=v.driverId&&riders.get(v.driverId);const campaign=rider?.task==='campaign'&&rider.campaignInventory?.bandeiras>0?rider.campaign:null;
  const flag=v.mountedFlag?.flag||campaign?.flag;if(!flag)continue;live.add(v.id);const key=JSON.stringify(flag);let material=renderer.cycleFlagMaterials.get(key);
   if(!material){let texture;const canvas=partyFlagCanvas(flag,()=>{if(texture)texture.needsUpdate=true;});texture=new THREE.CanvasTexture(canvas);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;material=new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide,emissive:0x000000});renderer.cycleFlagMaterials.set(key,material);}material.color.setScalar(flagNightFactor(world));
  let g=renderer.cycleFlags.get(v.id);if(!g){g=new THREE.Group();const pole=new THREE.Mesh(new THREE.CylinderGeometry(.015,.02,1.25,4),new THREE.MeshLambertMaterial({color:0xa5a59a}));pole.position.y=.625;g.add(pole);const cloth=new THREE.Mesh(clothFlagGeometry(THREE,.7,.44),material);cloth.position.set(.35,1.05,0);g.add(cloth);g.userData.cloth=cloth;renderer.scene.add(g);renderer.cycleFlags.set(v.id,g);}
   g.userData.cloth.material=material;animateClothFlag(g.userData.cloth,flagWindTime(renderer),0);g.position.set(e.x,surfaceElevation(world,e.x,e.y)+.25,e.y);g.rotation.y=0;
 }
 for(const [id,g]of renderer.cycleFlags)if(!live.has(id)){renderer.scene.remove(g);g.traverse(o=>{o.geometry?.dispose();if(o.material&&!o.material.map)o.material.dispose();});renderer.cycleFlags.delete(id);}
}
