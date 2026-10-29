import {partyFlagCanvas} from './city_party_flags.js';
import {clothFlagGeometry,animateClothFlag,flagWindTime} from './city_flag_animation.js?v=flag-wind-tick-13';
import {surfaceElevation,flagNightFactor} from './city_terrain.js?v=public-cleaning-1';
const colors={bicicleta:0x397e99,bicicleta_carga:0xbd793c,patinete:0x62a69a,patins:0xd5b345,skate:0x765038};
const inView=(r,x,y,margin=4)=>!Number.isFinite(r.renderedMinTx)||x-margin>=r.renderedMinTx&&x+margin<=r.renderedMaxTx+1&&y-margin>=r.renderedMinTy&&y+margin<=r.renderedMaxTy+1;
function batch(renderer,THREE,key,makeGeometry,makeMaterial,capacity){
  renderer.mobilityBatches??=new Map();let b=renderer.mobilityBatches.get(key);
  if(!b||b.capacity<capacity){const geometry=b?.geometry||makeGeometry(),material=b?.material||makeMaterial();if(b){renderer.scene.remove(b.mesh);b.mesh.dispose();}
    const count=Math.max(32,2**Math.ceil(Math.log2(Math.max(1,capacity)))),mesh=new THREE.InstancedMesh(geometry,material,count);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;renderer.scene.add(mesh);b={mesh,geometry,material,capacity:count};renderer.mobilityBatches.set(key,b);
  }return b;
}
export function syncCityMobility(renderer,THREE,entities,world){
  const vehicles=entities.filter(e=>!e.destroyed&&e.properties?.cityVehicle&&inView(renderer,e.x,e.y,1));
  if(!vehicles.length){
    for(const b of renderer.mobilityBatches?.values()||[])b.mesh.count=0;
    for(const [id,g] of renderer.cycleFlags||[]){renderer.scene.remove(g);g.traverse(o=>{o.geometry?.dispose();if(o.material&&!o.material.map)o.material.dispose();});renderer.cycleFlags.delete(id);}
    return;
  }
  const matrix=renderer._mobilityMatrix??=new THREE.Matrix4(),position=renderer._mobilityPosition??=new THREE.Vector3(),quaternion=renderer._mobilityQuaternion??=new THREE.Quaternion(),scale=renderer._mobilityScale??=new THREE.Vector3(),color=renderer._mobilityColor??=new THREE.Color(),axis=renderer._mobilityAxis??=new THREE.Vector3(0,1,0);
  const place=(mesh,index,x,y,z,sx,sy,sz,angle=0,tint=null)=>{position.set(x,y,z);quaternion.setFromAxisAngle(axis,angle);scale.set(sx,sy,sz);matrix.compose(position,quaternion,scale);mesh.setMatrixAt(index,matrix);if(tint!=null)mesh.setColorAt(index,color.setHex(tint));};
  const body=batch(renderer,THREE,'cycle-frames',()=>new THREE.BoxGeometry(1,1,1),()=>new THREE.MeshLambertMaterial({color:0xffffff}),vehicles.length*7),wheel=batch(renderer,THREE,'cycle-wheels',()=>new THREE.TorusGeometry(.22,.035,5,12),()=>new THREE.MeshLambertMaterial({color:0x252725}),vehicles.length*8);let n=0,w=0;
  for(const e of vehicles){const v=e.properties.cityVehicle,h=surfaceElevation(world,e.x,e.y),angle=v.angle||0,tint=v.color?parseInt(v.color.slice(1),16):colors[v.good]||0x52879a;
    const part=(dx,dy,dz,sx,sy,sz,color=tint)=>place(body.mesh,n++,e.x+dx*Math.cos(angle)+dz*Math.sin(angle),h+dy,e.y-dx*Math.sin(angle)+dz*Math.cos(angle),sx,sy,sz,angle,color);
    const tire=(dx,dz,size=1)=>place(wheel.mesh,w++,e.x+dx*Math.cos(angle)+dz*Math.sin(angle),h+.23*size,e.y-dx*Math.sin(angle)+dz*Math.cos(angle),size,size,size,angle+Math.PI/2);
    if(['bicicleta','bicicleta_carga'].includes(v.good)){
      part(0,.42,0,.08,.08,.65);part(0,.54,-.2,.08,.26,.08);part(0,.54,.2,.08,.26,.08);part(0,.64,-.12,.24,.08,.26,0x343437);part(0,.8,.35,.5,.05,.06,0x777777);tire(0,-.42);tire(0,.42);
      if(v.good==='bicicleta_carga'){part(0,.46,-.6,.55,.25,.44);tire(.24,-.5);}
    }else if(v.good==='patinete'){
      part(0,.18,0,.24,.08,.72);part(0,.52,.3,.05,.65,.05,0x777777);part(0,.85,.3,.5,.05,.05);tire(0,-.3,.55);tire(0,.3,.55);
    }else if(v.good==='skate'){
      part(0,.18,0,.32,.07,.85);for(const x of [-.18,.18])for(const z of [-.3,.3])tire(x,z,.4);
    }else{
      for(const x of [-.18,.18]){part(x,.21,0,.18,.22,.38);for(const z of [-.18,-.06,.06,.18])tire(x,z,.3);}
    }
  }
  syncCycleFlags(renderer,THREE,vehicles,world,entities);
  body.mesh.count=n;wheel.mesh.count=w;body.mesh.instanceMatrix.needsUpdate=true;wheel.mesh.instanceMatrix.needsUpdate=true;if(body.mesh.instanceColor)body.mesh.instanceColor.needsUpdate=true;
}

function syncCycleFlags(renderer,THREE,vehicles,world,entities){
 renderer.cycleFlags??=new Map();renderer.cycleFlagMaterials??=new Map();const live=new Set(),riders=new Map(entities.filter(e=>e.properties?.citizen?.ridingVehicleId).map(e=>[e.properties.citizen.id,e.properties.citizen]));
 for(const e of vehicles){const v=e.properties.cityVehicle,rider=v.driverId&&riders.get(v.driverId);const campaign=rider?.task==='campaign'&&rider.campaignInventory?.bandeiras>0?rider.campaign:null;
  const flag=v.mountedFlag?.flag||campaign?.flag;if(!flag)continue;live.add(v.id);const key=JSON.stringify(flag);let material=renderer.cycleFlagMaterials.get(key);
   if(!material){let texture;const canvas=partyFlagCanvas(flag,()=>{if(texture)texture.needsUpdate=true;});texture=new THREE.CanvasTexture(canvas);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;material=new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide,emissive:0x000000});renderer.cycleFlagMaterials.set(key,material);}material.color.setScalar(flagNightFactor(world));
  let g=renderer.cycleFlags.get(v.id);if(!g){g=new THREE.Group();const pole=new THREE.Mesh(new THREE.CylinderGeometry(.015,.02,1.25,4),new THREE.MeshLambertMaterial({color:0xa5a59a}));pole.position.y=.625;g.add(pole);const cloth=new THREE.Mesh(clothFlagGeometry(THREE,.7,.44),material);cloth.position.set(.35,1.05,0);g.add(cloth);g.userData.cloth=cloth;renderer.scene.add(g);renderer.cycleFlags.set(v.id,g);}
   g.userData.cloth.material=material;animateClothFlag(g.userData.cloth,flagWindTime(renderer),(v.id||0)*.91);g.position.set(e.x,surfaceElevation(world,e.x,e.y)+.25,e.y);g.rotation.y=v.angle||0;
 }
 for(const [id,g]of renderer.cycleFlags)if(!live.has(id)){renderer.scene.remove(g);g.traverse(o=>{o.geometry?.dispose();if(o.material&&!o.material.map)o.material.dispose();});renderer.cycleFlags.delete(id);}
}
