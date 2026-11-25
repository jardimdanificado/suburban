import {syncBoatFlags} from './boat_flags.js';
import {boatMaterial} from './boat_materials.js';
import {waterWaveHeight} from './water_surface.js?v=shore-runup-2';
import {BOAT_HULL_DIMENSIONS} from './boat_types.js?v=local-sea-travel-2';
import {boatVisualPosition,hideLocalBoat} from './boat_visual_state.js';
import {trackShadowTransform} from './dynamic_shadow_updates.js';
import {mooringPosition} from './harbor_berths.js';
import {BOAT_CLASSES} from './city_water_transport.js?v=regional-supply-4';
import {surfaceElevation} from './city_terrain.js?v=entrance-retaining-clearance-1';
import {TILE_WATER} from './world_gen.js?v=terrain-generation-reset-2-map-default-128';
import {createSeaEdgeNavigation} from './sea_edge_navigation.js?v=sea-edge-routes-1';

const dockWood=0x735033,ropeColor=0xb49a6f;
function nearestShore(world,origin){
  if(!world?.getTile)return null;let best=null,bestDistance=Infinity;
  for(let y=1;y<world.height-1;y++)for(let x=1;x<world.width-1;x++){
    if(world.getTile(x,y)===TILE_WATER)continue;
    for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const waterX=x+dx,waterY=y+dy;if(world.getTile(waterX,waterY)!==TILE_WATER)continue;const distance=(x-origin.x)**2+(y-origin.y)**2;if(distance<bestDistance){bestDistance=distance;best={door:{x,y},berth:{x:waterX,y:waterY}};}}
  }
  return best;
}
function disposeGroup(renderer,group){renderer.watercraftShadowDirty=true;renderer.scene.remove(group);group.traverse(object=>{object.geometry?.dispose();if(Array.isArray(object.material))object.material.forEach(material=>material.dispose());else {if(object.material?.userData?.boatFlag)object.material.map?.dispose();object.material?.dispose();}});}
function makeDock(THREE,port){
  const group=new THREE.Group(),wood=new THREE.MeshLambertMaterial({color:dockWood}),dark=new THREE.MeshLambertMaterial({color:0x493a2b}),rope=new THREE.MeshLambertMaterial({color:ropeColor});
  const door=port.door||{x:port.x,y:port.y},berth=port.berth||{x:door.x,y:door.y+1},dx=berth.x-door.x,dy=berth.y-door.y;
  group.position.set(door.x+.5,surfaceElevation(port.world,door.x+.5,door.y+.5),door.y+.5);group.rotation.y=Math.atan2(dx,dy);
  const deck=new THREE.Mesh(new THREE.BoxGeometry(1.65,.16,3.1),wood);deck.position.set(0,.42,1.02);deck.receiveShadow=true;deck.castShadow=true;group.add(deck);
  for(const x of [-.66,.66])for(const z of [-.18,.62,1.42,2.22]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.075,.09,.78,6),dark);post.position.set(x,.12,z);post.castShadow=true;group.add(post);}
  for(const x of [-.79,.79]){const rail=new THREE.Mesh(new THREE.BoxGeometry(.08,.12,2.65),wood);rail.position.set(x,.62,1.05);group.add(rail);}
  const bollard=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,.27,6),rope);bollard.position.set(.48,.62,.15);group.add(bollard);
  const lamp=new THREE.Mesh(new THREE.BoxGeometry(.16,.48,.16),dark);lamp.position.set(-.55,.72,2.25);group.add(lamp);
  const light=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),new THREE.MeshLambertMaterial({color:0xf0ce7d,emissive:0x6b4b1c}));light.position.set(-.55,1.02,2.25);group.add(light);
  return group;
}
function makeBoatModel(THREE,kind){
  const spec=BOAT_CLASSES[kind],group=new THREE.Group(),hullMaterial=boatMaterial(THREE,kind==='canoe'?'wood':'metal',kind==='canoe'?0xa47a48:kind==='cargo'?0x344b58:kind==='ferry'?0x246b72:0xeee7d4),deckMaterial=boatMaterial(THREE,'wood',0xc5a777),dark=boatMaterial(THREE,'metal',0x303c40);
  const {length,width}=BOAT_HULL_DIMENSIONS[kind];
  const outline=new THREE.Shape();outline.moveTo(0,length*.5);outline.lineTo(width*.38,length*.28);outline.lineTo(width*.5,length*.08);outline.lineTo(width*.5,-length*.36);outline.lineTo(width*.36,-length*.46);outline.lineTo(kind==='canoe'?0:-width*.36,-length*.46);outline.lineTo(-width*.5,-length*.36);outline.lineTo(-width*.5,length*.08);outline.lineTo(-width*.38,length*.28);outline.closePath();
  const geometry=new THREE.ExtrudeGeometry(outline,{depth:.19,bevelEnabled:false,steps:1,curveSegments:12});geometry.rotateX(Math.PI/2);
  const hull=new THREE.Mesh(geometry,hullMaterial);hull.position.y=.24;hull.castShadow=true;hull.receiveShadow=true;group.add(hull);
  const deck=new THREE.Mesh(new THREE.ShapeGeometry(outline,12),deckMaterial);deck.rotation.x=-Math.PI/2;deck.rotation.z=Math.PI;deck.scale.set(.86,.9,1);deck.position.y=.245;deck.receiveShadow=true;group.add(deck);
  // A tapered bow and stern make the silhouette read as a boat from the high camera.
  const rimPoints=outline.getPoints(48).map(p=>new THREE.Vector3(p.x,.28,p.y));
  const rim=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPoints,true),64,.018,5,true),dark);group.add(rim);
  if(kind==='canoe'){
    const paddle=new THREE.Mesh(new THREE.BoxGeometry(.035,.035,length*.68),deckMaterial);paddle.position.set(width*.25,.34,0);paddle.rotation.y=.18;group.add(paddle);
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.13,.035,.32),deckMaterial);blade.position.set(width*.25+Math.sin(.18)*length*.29,.34,Math.cos(.18)*length*.29);blade.rotation.y=.18;group.add(blade);
  }
  if(kind!=='canoe'){
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(kind==='cargo'?.68:.43,.34,kind==='cargo'?.62:.48),boatMaterial(THREE,'metal',kind==='cargo'?0xe4dcc4:0xf2eee0));cabin.position.set(0,.46,-length*.24);cabin.castShadow=true;group.add(cabin);
    for(const x of [-.16,.16]){const window=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,.025),new THREE.MeshLambertMaterial({color:0x9bd0d0,emissive:0x152829}));window.position.set(x,.53,-length*.24-.25);group.add(window);}
  }
  const mast=(z,height,sailWidth)=>{
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.025,.04,height,6),dark);pole.position.set(0,.3+height/2,z);pole.castShadow=true;group.add(pole);
    const sailGeometry=new THREE.PlaneGeometry(sailWidth,height*.72,12,8),positions=sailGeometry.attributes.position,uv=sailGeometry.attributes.uv;
    for(let i=0;i<positions.count;i++){const u=uv.getX(i),v=uv.getY(i);positions.setXYZ(i,positions.getX(i)*(.65+.35*(1-v)),positions.getY(i),Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*.08);}
    sailGeometry.computeVertexNormals();
    const sail=new THREE.Mesh(sailGeometry,boatMaterial(THREE,'cloth',0xffffff,{side:THREE.DoubleSide}));sail.userData.raisedY=.3+height*.56;sail.userData.furledY=.3+height*.9;sail.position.set(0,sail.userData.furledY,z+.035);sail.scale.y=.09;sail.castShadow=true;group.add(sail);
    (group.userData.sails??=[]).push(sail);
    const yard=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,sailWidth,5),dark);yard.rotation.z=Math.PI/2;yard.position.set(0,.3+height*.55,z+.05);group.add(yard);
  };
  if(kind!=='canoe'){mast(length*.05,1.45,kind==='cargo'?.88:.7);if(kind==='cargo'||kind==='ferry')mast(length*.3,1.05,.58);}
  if(kind==='canoe'||kind==='launch')for(const z of [-length*.22,length*.2]){const seat=new THREE.Mesh(new THREE.BoxGeometry(width*.78,.055,.1),dark);seat.position.set(0,.31,z);group.add(seat);}
  if(kind!=='canoe'){
    for(const x of [-width*.48,width*.48])for(const z of [-length*.25,length*.22]){
      const fender=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.16,8),dark);fender.position.set(x,.2,z);group.add(fender);
      const post=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.19,6),deckMaterial);post.position.set(x,.36,z);group.add(post);
    }
    for(const x of [-width*.48,width*.48]){const rail=new THREE.Mesh(new THREE.BoxGeometry(.018,.018,length*.54),deckMaterial);rail.position.set(x,.45,-length*.015);group.add(rail);}
  }
  group.scale.setScalar(kind==='canoe'?1:spec.scale);group.updateMatrixWorld(true);group.userData.floatHeight=-new THREE.Box3().setFromObject(hull).min.y-.025;return group;
}
function makeCarriedCycle(THREE,good){
  const group=new THREE.Group(),metal=new THREE.MeshLambertMaterial({color:good==='bicicleta_carga'?0x8e583a:0x455a62}),rubber=new THREE.MeshLambertMaterial({color:0x252b2b}),wheelGeometry=new THREE.TorusGeometry(.095,.018,4,8);
  for(const z of [-.17,.17]){const wheel=new THREE.Mesh(wheelGeometry,rubber);wheel.rotation.y=Math.PI/2;wheel.position.set(.02,.42,z);group.add(wheel);}
  const rod=(a,b,r=.018)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),5),metal);mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());group.add(mesh);};
  rod([.02,.42,-.17],[.02,.42,.17]);rod([.02,.42,-.17],[.02,.67,0]);rod([.02,.67,0],[.02,.42,.17]);rod([.02,.42,.17],[.02,.64,.2]);
  group.scale.setScalar(good==='bicicleta_carga'?.78:.68);group.position.set(.34,.12,.38);return group;
}
function boatVisual(renderer,THREE,id,kind){
  let group=renderer.portVesselVisuals.get(id);
  if(group&&group.userData.kind!==kind){disposeGroup(renderer,group);renderer.portVesselVisuals.delete(id);group=null;}
  if(!group){group=makeBoatModel(THREE,kind);group.userData.kind=kind;const ring=new THREE.Mesh(new THREE.RingGeometry(.62,.82,20),new THREE.MeshBasicMaterial({color:0xffe178,side:THREE.DoubleSide,transparent:true,opacity:.95,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.035;ring.visible=false;ring.userData.worldVesselSelectionRing=true;group.add(ring);group.userData.selectionRing=ring;renderer.portVesselVisuals.set(id,group);renderer.scene.add(group);}
  return group;
}
const clamp01=value=>Math.max(0,Math.min(1,value));
function edgeRoute(renderer,coordinator,city,world,cityId){
  const session=coordinator?.cities?.get(cityId),targetCity=session?.city||(cityId===city.worldPort?.cityId?city:null),targetWorld=targetCity?.world||session?.world,targetPort=targetCity?.worldPort;
  if(!targetWorld||!targetPort?.berth)return null;
  if(Array.isArray(targetPort.edgeRoute)&&targetPort.edgeRoute.length>1&&(targetPort.edgeRouteRevision??0)===(targetWorld.revision||0))return targetPort.edgeRoute;
  renderer.seaEdgeRouteCache??=new Map();const key=`${cityId}:${targetWorld.revision||0}:${targetPort.berth.x},${targetPort.berth.y}`,cached=renderer.seaEdgeRouteCache.get(key);if(cached)return cached;
  const route=createSeaEdgeNavigation(targetWorld)?.pathFrom(targetPort.berth)||null;if(route)renderer.seaEdgeRouteCache.set(key,route);return route;
}
function routePoint(path,progress){
  if(!path?.length)return null;const position=clamp01(progress)*(path.length-1),index=Math.min(path.length-2,Math.floor(position)),fraction=position-index,a=path[index]||path[0],b=path[index+1]||a;return{x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,angle:Math.atan2(b.x-a.x,b.y-a.y)};
}
export function boatSurfaceY(renderer,world,x,y,group){
  const floatHeight=group.userData.floatHeight||0;
  const base=surfaceElevation(world,x,y);if(world?.getTile?.(Math.floor(x),Math.floor(y))!==TILE_WATER)return base+floatHeight;
  const time=renderer.waterTime||0,draft=.08*(group.scale?.y??1);
  return base+waterWaveHeight(x,y,time)+floatHeight-draft;
}
export function placeBoatOnSurface(renderer,world,x,y,angle,group,boatClass){
  const floatHeight=group.userData.floatHeight||0;
  if(!world||world?.getTile?.(Math.floor(x),Math.floor(y))===TILE_WATER){
    group.position.set(x,boatSurfaceY(renderer,world,x,y,group),y);
    group.rotation.order='YXZ';
    group.rotation.set(0,angle,0);
    return;
  }
  const dims=BOAT_HULL_DIMENSIONS[boatClass]||BOAT_HULL_DIMENSIONS.canoe||{width:.68,length:2.1};
  const scale=group.scale?.x||1,halfLen=Math.max(.35,dims.length*scale*.42),halfWid=Math.max(.18,dims.width*scale*.42);
  const sinA=Math.sin(angle),cosA=Math.cos(angle);
  const hBow=surfaceElevation(world,x+sinA*halfLen,y+cosA*halfLen);
  const hStern=surfaceElevation(world,x-sinA*halfLen,y-cosA*halfLen);
  const hRight=surfaceElevation(world,x+cosA*halfWid,y-sinA*halfWid);
  const hLeft=surfaceElevation(world,x-cosA*halfWid,y+sinA*halfWid);
  const centerH=surfaceElevation(world,x,y);
  const maxTilt=.55;
  const pitch=Math.max(-maxTilt,Math.min(maxTilt,-Math.atan2(hBow-hStern,2*halfLen)));
  const roll=Math.max(-maxTilt,Math.min(maxTilt,Math.atan2(hRight-hLeft,2*halfWid)));
  const groundY=Math.max(centerH,(hBow+hStern)*.325+centerH*.35);
  group.position.set(x,groundY+floatHeight,y);
  group.rotation.order='YXZ';
  group.rotation.set(pitch,angle,roll);
}

export function syncCityWatercraft(renderer,THREE,city,world){
  if(!city)return;
  renderer.worldPortVisuals??=new Map();const livePorts=new Set();
  const port=city.worldPort,origin=port?.door||{x:port?.x??world.spawnCenter?.x??0,y:port?.y??world.spawnCenter?.y??0},shore=port?.berth?{door:origin,berth:port.berth}:nearestShore(world,origin),effectivePort=port&&shore?{...port,door:shore.door,berth:shore.berth}:port,portKey=port?`${port.cityId||city.id||''}:${port.id}`:null;if(port?.active&&effectivePort){livePorts.add(portKey);let dock=renderer.worldPortVisuals.get(portKey);if(!dock){dock=makeDock(THREE,{...effectivePort,world});renderer.worldPortVisuals.set(portKey,dock);renderer.scene.add(dock);}dock.visible=true;}
  for(const business of city.buildings||[]){if(!business.active||business.entity.destroyed||!business.waterfront)continue;const key=`${port?.cityId}:business:${business.id}`;livePorts.add(key);let dock=renderer.worldPortVisuals.get(key);if(!dock){dock=makeDock(THREE,{door:business.waterfront.land,berth:business.waterfront.berth,world});renderer.worldPortVisuals.set(key,dock);renderer.scene.add(dock);}dock.visible=true;}
  for(const[id,group]of renderer.worldPortVisuals)if(!livePorts.has(id)){disposeGroup(renderer,group);renderer.worldPortVisuals.delete(id);}
  renderer.portVesselVisuals??=new Map();const coordinator=renderer.worldCoordinator,portId=port?.cityId?`${port.cityId}:port`:null,portPosition=effectivePort?.berth||effectivePort?.door,moored=portId?[...(coordinator?.vessels?.values?.()||[])].filter(vessel=>vessel.currentPortId===portId&&['idle','reserved'].includes(vessel.status)&&!(vessel.homeCityId===port?.cityId&&city.vehicles?.units?.get(vessel.localVehicleId)?.driverId)):[],docked=moored,liveVessels=new Set();
  const door=effectivePort?.door||port||{x:0,y:0},berth=effectivePort?.berth||{x:door.x,y:door.y+1},dx=berth.x-door.x,dy=berth.y-door.y,length=Math.hypot(dx,dy)||1,awayX=dx/length,awayY=dy/length,sideX=-awayY,sideY=awayX;
  const occupied=[...(city.vehicles?.units?.values?.()||[])].filter(v=>v.boatClass&&!v.scrapped&&!docked.some(ship=>ship.localVehicleId===v.id&&ship.homeCityId===port.cityId)).map(v=>({x:v.x,y:v.y,radius:(v.pickLength||2)/2}));
  renderer.vesselMoorings??=new Map();
  docked.forEach(vessel=>{const id=vessel.id,kind=BOAT_CLASSES[vessel.classId]?vessel.classId:'cargo',group=boatVisual(renderer,THREE,id,kind),radius=kind==='cargo'?3:kind==='ferry'?2:1.5,transfer=coordinator.transfers.get(vessel.transferId),docking=transfer&&coordinator.minute>=transfer.departureMinute-1&&(!coordinator.ports.get(portId)?.dockedVesselId||coordinator.ports.get(portId).dockedVesselId===id);
    const local=vessel.homeCityId===port.cityId?city.vehicles?.units?.get(vessel.localVehicleId):null;let point=docking?{x:berth.x+.5,y:berth.y+.5}:local?boatVisualPosition(local):renderer.vesselMoorings.get(`${portId}:${id}`);
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)){point=mooringPosition(world,berth,occupied,radius);if(point)renderer.vesselMoorings.set(`${portId}:${id}`,point);}
    if(!point)return;occupied.push({...point,radius});liveVessels.add(id);group.position.set(point.x,boatSurfaceY(renderer,world,point.x,point.y,group),point.y);group.rotation.y=Math.atan2(awayX,awayY);group.visible=true;
    group.userData.worldVesselSelection={key:id,vessel,transfer,route:coordinator.routes.get(vessel.routeId),phase:docking?'Atracado para embarque':'Aguardando em vaga de fundeio',x:point.x,y:point.y};
  });
  for(const vessel of city.vehicles?.units?.values?.()||[]){if(vessel.scrapped||!vessel.boatClass||vessel.entity?.destroyed)continue;
    // A privately owned boat has one world-coordinator representation. Drawing
    // its stale city-vehicle transform as well created a second hull at its old
    // position, making the ship appear to jump between that point and the port.
    const worldRepresentation=[...(coordinator?.vessels?.values?.()||[])].find(item=>item.homeCityId===(port?.cityId||city.id)&&item.localVehicleId===vessel.id);
    if(hideLocalBoat(worldRepresentation,liveVessels,vessel.driverId))continue;
    const id=`city-vehicle:${vessel.id}`,group=boatVisual(renderer,THREE,id,vessel.boatClass),passenger=Number.isSafeInteger(vessel.transportCitizenId)?city.society?.citizen(vessel.transportCitizenId):null,carried=passenger?.ridingVehicleId?city.vehicles?.units?.get(passenger.ridingVehicleId):null;if(carried?.ferrying){group.userData.carriedCycle??=makeCarriedCycle(THREE,carried.good);group.userData.carriedCycle.visible=true;}else if(group.userData.carriedCycle)group.userData.carriedCycle.visible=false;group.userData.flagVessel=vessel;const x=vessel.entity?.x??vessel.x,y=vessel.entity?.y??vessel.y;liveVessels.add(id);placeBoatOnSurface(renderer,world,x,y,vessel.angle||0,group,vessel.boatClass);group.visible=true;
    const towBike=vessel.towedByVehicleId&&city.vehicles.units.get(vessel.towedByVehicleId);
    if(towBike){
      group.userData.towline??=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:ropeColor}));
      const line=group.userData.towline;if(!line.parent)group.add(line);
      const dx=(towBike.entity?.x??towBike.x)-x,dz=(towBike.entity?.y??towBike.y)-y,angle=group.rotation.y,scale=group.scale.x||1;
      const positions=line.geometry.attributes.position;positions.setXYZ(0,0,.18,BOAT_HULL_DIMENSIONS[vessel.boatClass].length*.4);positions.setXYZ(1,(Math.cos(angle)*dx-Math.sin(angle)*dz)/scale,.25,(Math.sin(angle)*dx+Math.cos(angle)*dz)/scale);positions.needsUpdate=true;line.geometry.computeBoundingSphere();line.visible=true;
    }else if(group.userData.towline)group.userData.towline.visible=false;
  }
  const worldMinute=Number.isFinite(coordinator?.minute)?coordinator.minute:0;
  for(const transfer of coordinator?.transfers?.values?.()||[]){
    if(!['departing','in-transit','arriving'].includes(transfer.status))continue;
    const progress=clamp01((worldMinute-transfer.departureMinute)/Math.max(1,transfer.arrivalMinute-transfer.departureMinute)),atOrigin=progress<.5,cityId=atOrigin?transfer.originCityId:transfer.destinationCityId;
    if(cityId!==port?.cityId)continue;
    const route=edgeRoute(renderer,coordinator,city,world,cityId);if(!route)continue;const berthBusy=!atOrigin&&coordinator.ports.get(portId)?.dockedVesselId&&coordinator.ports.get(portId).dockedVesselId!==transfer.vesselId;const localProgress=atOrigin?progress*2:(progress-.5)*2,points=atOrigin?route:route.slice().reverse(),position=berthBusy&&progress>=.95?mooringPosition(world,berth,occupied,2):routePoint(points,localProgress);if(!position)continue;position.angle??=0;if(berthBusy)occupied.push({...position,radius:2});
    const vessel=coordinator.vessels.get(transfer.vesselId),kind=BOAT_CLASSES[vessel?.classId]?vessel.classId:'cargo',id=`voyage:${transfer.id}`,group=boatVisual(renderer,THREE,id,kind);group.userData.worldVesselSelection={key:id,vessel,transfer,route,phase:atOrigin?'saindo da cidade':'chegando à cidade',x:position.x,y:position.y};
    liveVessels.add(id);group.position.set(position.x,boatSurfaceY(renderer,world,position.x,position.y,group),position.y);group.rotation.y=position.angle;group.visible=true;
  }
  for(const vessel of coordinator?.vessels?.values?.()||[]){
    if(vessel.status!=='returning'||!Number.isFinite(vessel.returnMinute))continue;
    const route=coordinator.routes.get(vessel.routeId);if(!route)continue;
    const travelMinutes=Math.max(1,route.travelMinutes),progress=clamp01((worldMinute-(vessel.returnMinute-travelMinutes))/travelMinutes),atDestination=progress<.5,cityId=atDestination?route.destinationCityId:route.originCityId;
    if(cityId!==port?.cityId)continue;
    const points=edgeRoute(renderer,coordinator,city,world,cityId);if(!points)continue;const localProgress=atDestination?progress*2:(progress-.5)*2,travelPath=atDestination?points:points.slice().reverse(),position=routePoint(travelPath,localProgress);if(!position)continue;
    const kind=BOAT_CLASSES[vessel.classId]?vessel.classId:'cargo',id=`return:${vessel.id}`,group=boatVisual(renderer,THREE,id,kind);const returningTrip=coordinator.transfers.get(vessel.lastTransferId);group.userData.worldVesselSelection={key:id,vessel,transfer:returningTrip,route,phase:atDestination?'retornando ao porto de origem':'retornando do mar',x:position.x,y:position.y};
    liveVessels.add(id);group.position.set(position.x,boatSurfaceY(renderer,world,position.x,position.y,group),position.y);group.rotation.y=position.angle;group.visible=true;
  }
  for(const[id,group]of renderer.portVesselVisuals){if(!liveVessels.has(id)){disposeGroup(renderer,group);renderer.portVesselVisuals.delete(id);continue;}group.userData.selectionRing&&(group.userData.selectionRing.visible=renderer.selectedEntityId===`world-vessel:${id}`);}
  renderer.boatCitizenVisuals??=new Map();
  const people=city.citizens.filter(person=>!person.entity.destroyed&&person.boatClass&&!person.boatVehicleId&&person.entity.x>=0&&person.entity.y>=0),live=new Set();
  for(const person of people){const id=person.id,kind=person.boatClass;live.add(id);let group=renderer.boatCitizenVisuals.get(id);
    if(!group||group.userData.kind!==kind){if(group)disposeGroup(renderer,group);group=makeBoatModel(THREE,kind);group.userData.kind=kind;renderer.boatCitizenVisuals.set(id,group);renderer.scene.add(group);}
    group.userData.flagOwner=person;const next=person.path?.[0],dx=next?next.x-person.entity.x:0,dy=next?next.y-person.entity.y:0;const angle=(dx||dy)?Math.atan2(dx,dy):(group.rotation.y||0);placeBoatOnSurface(renderer,world,person.entity.x,person.entity.y,angle,group,kind);group.visible=true;
  }
  for(const[id,group]of renderer.boatCitizenVisuals)if(!live.has(id)){disposeGroup(renderer,group);renderer.boatCitizenVisuals.delete(id);}
  for(const group of [...renderer.portVesselVisuals.values(),...renderer.boatCitizenVisuals.values()])syncBoatFlags(renderer,THREE,city,group);
  for(const group of renderer.portVesselVisuals.values())trackShadowTransform(renderer,group);
  for(const group of renderer.boatCitizenVisuals.values())trackShadowTransform(renderer,group);

}
