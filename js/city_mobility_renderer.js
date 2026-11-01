import {partyFlagCanvas} from './city_party_flags.js';
import {clothFlagGeometry,animateClothFlag,flagWindTime} from './city_flag_animation.js?v=flag-wind-tick-13';
import {surfaceElevation,flagNightFactor} from './city_terrain.js?v=mine-adjacent-1';
const colors={bicicleta:0x397e99,bicicleta_carga:0xbd793c,patinete:0x62a69a,patins:0xd5b345,skate:0x765038};
const inView=(r,x,y,margin=4)=>!Number.isFinite(r.renderedMinTx)||x-margin>=r.renderedMinTx&&x+margin<=r.renderedMaxTx+1&&y-margin>=r.renderedMinTy&&y+margin<=r.renderedMaxTy+1;
function batch(renderer,THREE,key,makeGeometry,makeMaterial,capacity){
  renderer.mobilityBatches??=new Map();let b=renderer.mobilityBatches.get(key);
  if(!b||b.capacity<capacity){const geometry=b?.geometry||makeGeometry(),material=b?.material||makeMaterial();if(b){renderer.scene.remove(b.mesh);b.mesh.dispose();}
    const count=Math.max(32,2**Math.ceil(Math.log2(Math.max(1,capacity)))),mesh=new THREE.InstancedMesh(geometry,material,count);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;renderer.scene.add(mesh);b={mesh,geometry,material,capacity:count};renderer.mobilityBatches.set(key,b);
  }return b;
}
function paintReflectionEnvironment(renderer,THREE){
  if(renderer.cyclePaintEnvironment||typeof document==='undefined')return renderer.cyclePaintEnvironment||null;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');
  const sky=ctx.createLinearGradient(0,0,0,256);sky.addColorStop(0,'#647b91');sky.addColorStop(.28,'#b7c9d2');sky.addColorStop(.47,'#f6f0df');sky.addColorStop(.53,'#b3b1a1');sky.addColorStop(1,'#343b3b');ctx.fillStyle=sky;ctx.fillRect(0,0,512,256);
  const softbox=ctx.createLinearGradient(0,55,0,165);softbox.addColorStop(0,'rgba(255,255,255,0)');softbox.addColorStop(.45,'rgba(255,255,255,.92)');softbox.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=softbox;ctx.fillRect(70,55,76,110);
  const second=ctx.createLinearGradient(0,75,0,150);second.addColorStop(0,'rgba(220,236,246,0)');second.addColorStop(.5,'rgba(220,236,246,.78)');second.addColorStop(1,'rgba(220,236,246,0)');ctx.fillStyle=second;ctx.fillRect(340,75,54,75);
  const texture=new THREE.CanvasTexture(canvas);texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;renderer.cyclePaintEnvironment=texture;return texture;
}
function vehiclePaintFinish(v){
  if(['metallic','gloss','satin','matte'].includes(v.paintFinish))return v.paintFinish;
  const pick=(Math.imul(v.id||1,2654435761)>>>0)%100;return pick<34?'metallic':pick<56?'gloss':pick<82?'satin':'matte';
}
const PAINT_FINISHES={
  metallic:{roughness:.24,metalness:.72,clearcoat:.95,clearcoatRoughness:.13,envMapIntensity:1.45},
  gloss:{roughness:.2,metalness:.12,clearcoat:.9,clearcoatRoughness:.16,envMapIntensity:.72},
  satin:{roughness:.42,metalness:.16,clearcoat:.42,clearcoatRoughness:.32,envMapIntensity:.42},
  matte:{roughness:.9,metalness:0,clearcoat:0,clearcoatRoughness:1,envMapIntensity:0}
};
export function syncCityMobility(renderer,THREE,entities,world){
  renderer.mobilityBatches??=new Map();
  const vehicles=entities.filter(e=>!e.destroyed&&e.properties?.cityVehicle&&inView(renderer,e.x,e.y,1));
  if(!vehicles.length){
    for(const b of renderer.mobilityBatches?.values()||[])b.mesh.count=0;
    for(const [id,g] of renderer.cycleFlags||[]){renderer.scene.remove(g);g.traverse(o=>{o.geometry?.dispose();if(o.material&&!o.material.map)o.material.dispose();});renderer.cycleFlags.delete(id);}
    return;
  }
  const matrix=renderer._mobilityMatrix??=new THREE.Matrix4(),position=renderer._mobilityPosition??=new THREE.Vector3(),quaternion=renderer._mobilityQuaternion??=new THREE.Quaternion(),scale=renderer._mobilityScale??=new THREE.Vector3(),color=renderer._mobilityColor??=new THREE.Color(),axis=renderer._mobilityAxis??=new THREE.Vector3(0,1,0);
  const place=(mesh,index,x,y,z,sx,sy,sz,angle=0,tint=null)=>{position.set(x,y,z);quaternion.setFromAxisAngle(axis,angle);scale.set(sx,sy,sz);matrix.compose(position,quaternion,scale);mesh.setMatrixAt(index,matrix);if(tint!=null)mesh.setColorAt(index,color.setHex(tint));};
  const envMap=paintReflectionEnvironment(renderer,THREE),bodyCounts=new Map(),bodyMeshes=new Map(),finishPopulation=new Map();
  const daylight=flagNightFactor(world),reflectionDay=Math.max(0,Math.min(1,(daylight-.18)/.82)),reflectionFactor=reflectionDay*reflectionDay;
  for(const e of vehicles){const finish=vehiclePaintFinish(e.properties.cityVehicle);finishPopulation.set(finish,(finishPopulation.get(finish)||0)+1);}
  for(const [key,b]of renderer.mobilityBatches)if(key==='cycle-frames'||key.startsWith('cycle-frames-'))b.mesh.count=0;
  const bodyFor=finish=>{
    let body=bodyMeshes.get(finish);if(body)return body;
    const style=PAINT_FINISHES[finish],capacity=Math.max(32,finishPopulation.get(finish)*7);
    body=batch(renderer,THREE,`cycle-frames-${finish}`,()=>new THREE.BoxGeometry(1,1,1),()=>new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:style.roughness,metalness:style.metalness,clearcoat:style.clearcoat,clearcoatRoughness:style.clearcoatRoughness,envMap:style.envMapIntensity?envMap:null,envMapIntensity:style.envMapIntensity}),capacity);
    bodyCounts.set(finish,0);bodyMeshes.set(finish,body);return body;
  };
  const wheel=batch(renderer,THREE,'cycle-wheels',()=>new THREE.TorusGeometry(.22,.035,5,12),()=>new THREE.MeshLambertMaterial({color:0x252725}),vehicles.length*8);let w=0;
  for(const e of vehicles){const v=e.properties.cityVehicle,h=surfaceElevation(world,e.x,e.y),angle=v.angle||0,tint=v.color?parseInt(v.color.slice(1),16):colors[v.good]||0x52879a,finish=vehiclePaintFinish(v),body=bodyFor(finish);
    const part=(dx,dy,dz,sx,sy,sz,color=tint)=>{const index=bodyCounts.get(finish);bodyCounts.set(finish,index+1);place(body.mesh,index,e.x+dx*Math.cos(angle)+dz*Math.sin(angle),h+dy,e.y-dx*Math.sin(angle)+dz*Math.cos(angle),sx,sy,sz,angle,color);};
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
  for(const [finish,body]of bodyMeshes){const style=PAINT_FINISHES[finish];body.material.envMapIntensity=style.envMapIntensity*reflectionFactor;body.material.clearcoat=style.clearcoat*reflectionFactor;body.mesh.count=bodyCounts.get(finish);body.mesh.instanceMatrix.needsUpdate=true;if(body.mesh.instanceColor)body.mesh.instanceColor.needsUpdate=true;}
  wheel.mesh.count=w;wheel.mesh.instanceMatrix.needsUpdate=true;
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
