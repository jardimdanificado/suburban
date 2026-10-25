import {surfaceElevation} from './city_terrain.js';
const colors={carro:0x397e99,caminhao:0xbd793c,onibus:0xd5b345,carruagem:0x765038};
const inView=(r,x,y,margin=4)=>!Number.isFinite(r.renderedMinTx)||x>=r.renderedMinTx-margin&&x<=r.renderedMaxTx+margin&&y>=r.renderedMinTy-margin&&y<=r.renderedMaxTy+margin;
function batch(renderer,THREE,key,makeGeometry,makeMaterial,capacity){
  renderer.mobilityBatches??=new Map();let b=renderer.mobilityBatches.get(key);
  if(!b||b.capacity<capacity){const geometry=b?.geometry||makeGeometry(),material=b?.material||makeMaterial();if(b){renderer.scene.remove(b.mesh);b.mesh.dispose();}
    const count=Math.max(32,2**Math.ceil(Math.log2(Math.max(1,capacity)))),mesh=new THREE.InstancedMesh(geometry,material,count);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;renderer.scene.add(mesh);b={mesh,geometry,material,capacity:count};renderer.mobilityBatches.set(key,b);
  }return b;
}
export function syncCityMobility(renderer,THREE,entities,world){
  const matrix=renderer._mobilityMatrix??=new THREE.Matrix4(),position=renderer._mobilityPosition??=new THREE.Vector3(),quaternion=renderer._mobilityQuaternion??=new THREE.Quaternion(),scale=renderer._mobilityScale??=new THREE.Vector3(),color=renderer._mobilityColor??=new THREE.Color(),axis=renderer._mobilityAxis??=new THREE.Vector3(0,1,0);
  const place=(mesh,index,x,y,z,sx,sy,sz,angle=0,tint=null)=>{position.set(x,y,z);quaternion.setFromAxisAngle(axis,angle);scale.set(sx,sy,sz);matrix.compose(position,quaternion,scale);mesh.setMatrixAt(index,matrix);if(tint!=null)mesh.setColorAt(index,color.setHex(tint));};
  const vehicles=entities.filter(e=>!e.destroyed&&e.properties?.cityVehicle&&inView(renderer,e.x,e.y,Math.max(4,e.properties.cityVehicle.altitude||0)));
  const body=batch(renderer,THREE,'bodies',()=>new THREE.BoxGeometry(1,1,1),()=>new THREE.MeshLambertMaterial({color:0xffffff}),vehicles.length),cab=batch(renderer,THREE,'cabins',()=>new THREE.BoxGeometry(1,1,1),()=>new THREE.MeshLambertMaterial({color:0x375362}),vehicles.length),wheel=batch(renderer,THREE,'wheels',()=>new THREE.BoxGeometry(1,1,1),()=>new THREE.MeshLambertMaterial({color:0x242723}),vehicles.length*6),horse=batch(renderer,THREE,'horses',()=>new THREE.BoxGeometry(1,1,1),()=>new THREE.MeshLambertMaterial({color:0x704635}),vehicles.length),rotor=batch(renderer,THREE,'rotors',()=>new THREE.BoxGeometry(1,1,1),()=>new THREE.MeshLambertMaterial({color:0xaecddd}),vehicles.length*4),shadow=batch(renderer,THREE,'air-shadows',()=>new THREE.BoxGeometry(1,1,1),()=>new THREE.MeshBasicMaterial({color:0x17252b,transparent:true,opacity:.22,depthWrite:false}),vehicles.length);let n=0,w=0,horses=0,rotors=0;
  for(const e of vehicles){const v=e.properties.cityVehicle,large=v.good==='onibus'||v.good==='caminhao',length=large?1.6:1.15,h=v.altitude??surfaceElevation(world,e.x,e.y),angle=v.angle||0,tint=colors[v.good]+((v.manufacturerId*31)%20)*0x010100;
    place(body.mesh,n,e.x,h+.3,e.y,.72,.42,length,angle,tint);place(cab.mesh,n++,e.x,h+.58,e.y,.62,.3,large?length*.7:length*.5,angle);
    place(shadow.mesh,n-1,e.x,surfaceElevation(world,e.x,e.y)+.015,e.y,.9,.01,length*1.1,angle);
    for(const dx of [-.62,.62])for(const dz of [-length*.33,length*.33]){const px=e.x+dx*Math.cos(angle)+dz*Math.sin(angle),py=e.y-dx*Math.sin(angle)+dz*Math.cos(angle);place(rotor.mesh,rotors++,px,h+.65,py,.58,.035,.1,angle+(v.journey?performance.now()*.025:0));}
    for(const z of [-length*.32,length*.32])for(const x of [-.38,.38]){const px=e.x+x*Math.cos(angle)+z*Math.sin(angle),py=e.y-x*Math.sin(angle)+z*Math.cos(angle);place(wheel.mesh,w++,px,h+.17,py,.16,.25,.24,angle);}
    if(v.good==='carruagem')place(horse.mesh,horses++,e.x+Math.sin(angle)*.95,h+.45,e.y+Math.cos(angle)*.95,.4,.55,.75,angle);
  }
  for(const b of [body,cab,wheel,horse,rotor,shadow])b.mesh.instanceMatrix.needsUpdate=true;body.mesh.count=n;cab.mesh.count=n;wheel.mesh.count=w;horse.mesh.count=horses;rotor.mesh.count=rotors;shadow.mesh.count=n;if(body.mesh.instanceColor)body.mesh.instanceColor.needsUpdate=true;
}
