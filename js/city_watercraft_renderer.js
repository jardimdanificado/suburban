import {BOAT_CLASSES} from './city_water_transport.js?v=regional-supply-3';
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
function disposeGroup(renderer,group){renderer.scene.remove(group);group.traverse(object=>{object.geometry?.dispose();if(Array.isArray(object.material))object.material.forEach(material=>material.dispose());else object.material?.dispose();});}
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
  const spec=BOAT_CLASSES[kind],group=new THREE.Group(),hullMaterial=new THREE.MeshLambertMaterial({color:kind==='canoe'?0x795034:kind==='cargo'?0x824c3d:0x9b6448}),deckMaterial=new THREE.MeshLambertMaterial({color:spec.color}),dark=new THREE.MeshLambertMaterial({color:0x343d3a}),sailMaterial=new THREE.MeshLambertMaterial({color:kind==='cargo'?0xe8d2a3:0xf4ead0,side:THREE.DoubleSide});
  const length=kind==='canoe'?1.15:kind==='cargo'?2.05:kind==='ferry'?1.65:1.38,width=kind==='canoe'?.34:kind==='cargo'?.82:kind==='ferry'?.72:.56;
  const hull=new THREE.Mesh(new THREE.CapsuleGeometry(width*.34,length*.34,3,8),hullMaterial);hull.rotation.x=Math.PI/2;hull.scale.set(1,.68,1);hull.position.y=.13;hull.castShadow=true;hull.receiveShadow=true;group.add(hull);
  const deck=new THREE.Mesh(new THREE.BoxGeometry(width,.09,length*.8),deckMaterial);deck.position.y=.25;deck.castShadow=true;group.add(deck);
  // A tapered bow and stern make the silhouette read as a boat from the high camera.
  for(const [z,angle]of [[length*.48,1],[-length*.48,-1]]){const bow=new THREE.Mesh(new THREE.ConeGeometry(width*.36,length*.28,5),hullMaterial);bow.rotation.x=angle*Math.PI/2;bow.position.set(0,.14,z);bow.castShadow=true;group.add(bow);}
  if(kind!=='canoe'){
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(kind==='cargo'?.68:.43,.34,kind==='cargo'?.62:.48),new THREE.MeshLambertMaterial({color:kind==='cargo'?0x554d42:0x414c4d}));cabin.position.set(0,.46,-length*.24);cabin.castShadow=true;group.add(cabin);
    for(const x of [-.16,.16]){const window=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,.025),new THREE.MeshLambertMaterial({color:0x9bd0d0,emissive:0x152829}));window.position.set(x,.53,-length*.24-.25);group.add(window);}
  }
  const mast=(z,height,sailWidth)=>{
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.025,.04,height,6),dark);pole.position.set(0,.3+height/2,z);pole.castShadow=true;group.add(pole);
    const shape=new THREE.Shape();shape.moveTo(-sailWidth*.42,-height*.4);shape.lineTo(sailWidth*.48,-height*.28);shape.lineTo(-sailWidth*.12,height*.48);shape.closePath();
    const sail=new THREE.Mesh(new THREE.ShapeGeometry(shape),sailMaterial);sail.position.set(0,.3+height*.56,z+.035);sail.castShadow=true;group.add(sail);
    const yard=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,sailWidth,5),dark);yard.rotation.z=Math.PI/2;yard.position.set(0,.3+height*.55,z+.05);group.add(yard);
  };
  if(kind!=='canoe'){mast(length*.05,1.45,kind==='cargo'?.88:.7);if(kind==='cargo'||kind==='ferry')mast(length*.3,1.05,.58);}
  if(kind==='cargo')for(const [x,z,color]of [[-.21,.55,0xb66f43],[.21,.55,0xc5a56a],[-.21,.82,0x637b7d],[.21,.82,0xb75b49]]){const crate=new THREE.Mesh(new THREE.BoxGeometry(.32,.22,.23),new THREE.MeshLambertMaterial({color}));crate.position.set(x,.39,z);crate.castShadow=true;group.add(crate);}
  if(kind==='canoe'||kind==='launch')for(const z of [-length*.22,length*.2]){const seat=new THREE.Mesh(new THREE.BoxGeometry(width*.78,.055,.1),dark);seat.position.set(0,.31,z);group.add(seat);}
  group.scale.setScalar(spec.scale);return group;
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

export function syncCityWatercraft(renderer,THREE,city,world){
  if(!city)return;
  renderer.worldPortVisuals??=new Map();const livePorts=new Set();
  const port=city.worldPort,origin=port?.door||{x:port?.x??world.spawnCenter?.x??0,y:port?.y??world.spawnCenter?.y??0},shore=port?.berth?{door:origin,berth:port.berth}:nearestShore(world,origin),effectivePort=port&&shore?{...port,door:shore.door,berth:shore.berth}:port,portKey=port?`${port.cityId||city.id||''}:${port.id}`:null;if(port?.active&&effectivePort){livePorts.add(portKey);let dock=renderer.worldPortVisuals.get(portKey);if(!dock){dock=makeDock(THREE,{...effectivePort,world});renderer.worldPortVisuals.set(portKey,dock);renderer.scene.add(dock);}dock.visible=true;}
  for(const[id,group]of renderer.worldPortVisuals)if(!livePorts.has(id)){disposeGroup(renderer,group);renderer.worldPortVisuals.delete(id);}
  renderer.portVesselVisuals??=new Map();const coordinator=renderer.worldCoordinator,portId=port?.cityId?`${port.cityId}:port`:null,portPosition=effectivePort?.berth||effectivePort?.door,moored=portId?[...(coordinator?.vessels?.values?.()||[])].filter(vessel=>vessel.currentPortId===portId&&['idle','reserved'].includes(vessel.status)):[],docked=moored,liveVessels=new Set();
  const door=effectivePort?.door||port||{x:0,y:0},berth=effectivePort?.berth||{x:door.x,y:door.y+1},dx=berth.x-door.x,dy=berth.y-door.y,length=Math.hypot(dx,dy)||1,awayX=dx/length,awayY=dy/length,sideX=-awayY,sideY=awayX;
  docked.forEach((vessel,index)=>{const id=vessel.id,kind=BOAT_CLASSES[vessel.classId]?vessel.classId:'cargo';liveVessels.add(id);const group=boatVisual(renderer,THREE,id,kind),spread=(index-(docked.length-1)/2)*.62,x=(portPosition?.x??port.x)+.5+awayX*1.05+sideX*spread,y=(portPosition?.y??port.y)+.5+awayY*1.05+sideY*spread;
    group.position.set(x,surfaceElevation(world,x,y)+.15,y);group.rotation.y=Math.atan2(awayX,awayY);group.visible=true;});
  for(const vessel of city.vehicles?.units?.values?.()||[]){if(vessel.scrapped||!vessel.boatClass||vessel.entity?.destroyed)continue;const id=`city-vehicle:${vessel.id}`,group=boatVisual(renderer,THREE,id,vessel.boatClass),x=vessel.entity?.x??vessel.x,y=vessel.entity?.y??vessel.y;liveVessels.add(id);group.position.set(x,surfaceElevation(world,x,y)+.15,y);group.rotation.y=vessel.angle||0;group.visible=!Number.isFinite(renderer.renderedMinTx)||x>=renderer.renderedMinTx-4&&x<=renderer.renderedMaxTx+5&&y>=renderer.renderedMinTy-4&&y<=renderer.renderedMaxTy+5;}
  const worldMinute=Number.isFinite(coordinator?.minute)?coordinator.minute:0;
  for(const transfer of coordinator?.transfers?.values?.()||[]){
    if(!['departing','in-transit','arriving'].includes(transfer.status))continue;
    const progress=clamp01((worldMinute-transfer.departureMinute)/Math.max(1,transfer.arrivalMinute-transfer.departureMinute)),atOrigin=progress<.5,cityId=atOrigin?transfer.originCityId:transfer.destinationCityId;
    if(cityId!==port?.cityId)continue;
    const route=edgeRoute(renderer,coordinator,city,world,cityId);if(!route)continue;const localProgress=atOrigin?progress*2:(progress-.5)*2,points=atOrigin?route:route.slice().reverse(),position=routePoint(points,localProgress);if(!position)continue;
    const vessel=coordinator.vessels.get(transfer.vesselId),kind=BOAT_CLASSES[vessel?.classId]?vessel.classId:'cargo',id=`voyage:${transfer.id}`,group=boatVisual(renderer,THREE,id,kind);group.userData.worldVesselSelection={key:id,vessel,transfer,route,phase:atOrigin?'saindo da cidade':'chegando à cidade',x:position.x,y:position.y};
    liveVessels.add(id);group.position.set(position.x,surfaceElevation(world,position.x,position.y)+.16,position.y);group.rotation.y=position.angle;group.visible=true;
  }
  for(const vessel of coordinator?.vessels?.values?.()||[]){
    if(vessel.status!=='returning'||!Number.isFinite(vessel.returnMinute))continue;
    const route=coordinator.routes.get(vessel.routeId);if(!route)continue;
    const travelMinutes=Math.max(1,route.travelMinutes),progress=clamp01((worldMinute-(vessel.returnMinute-travelMinutes))/travelMinutes),atDestination=progress<.5,cityId=atDestination?route.destinationCityId:route.originCityId;
    if(cityId!==port?.cityId)continue;
    const points=edgeRoute(renderer,coordinator,city,world,cityId);if(!points)continue;const localProgress=atDestination?progress*2:(progress-.5)*2,travelPath=atDestination?points:points.slice().reverse(),position=routePoint(travelPath,localProgress);if(!position)continue;
    const kind=BOAT_CLASSES[vessel.classId]?vessel.classId:'cargo',id=`return:${vessel.id}`,group=boatVisual(renderer,THREE,id,kind);group.userData.worldVesselSelection={key:id,vessel,transfer:null,route,phase:atDestination?'retornando ao porto de origem':'retornando do mar',x:position.x,y:position.y};
    liveVessels.add(id);group.position.set(position.x,surfaceElevation(world,position.x,position.y)+.16,position.y);group.rotation.y=position.angle;group.visible=true;
  }
  for(const[id,group]of renderer.portVesselVisuals){if(!liveVessels.has(id)){disposeGroup(renderer,group);renderer.portVesselVisuals.delete(id);continue;}group.userData.selectionRing&&(group.userData.selectionRing.visible=renderer.selectedEntityId===`world-vessel:${id}`);}
  renderer.boatCitizenVisuals??=new Map();
  const people=city.citizens.filter(person=>!person.entity.destroyed&&person.boatClass&&!person.boatVehicleId&&person.entity.x>=0&&person.entity.y>=0),live=new Set();
  for(const person of people){const id=person.id,kind=person.boatClass;live.add(id);let group=renderer.boatCitizenVisuals.get(id);
    if(!group||group.userData.kind!==kind){if(group)disposeGroup(renderer,group);group=makeBoatModel(THREE,kind);group.userData.kind=kind;renderer.boatCitizenVisuals.set(id,group);renderer.scene.add(group);}
    const next=person.path?.[0],dx=next?next.x-person.entity.x:0,dy=next?next.y-person.entity.y:0;group.position.set(person.entity.x,surfaceElevation(world,person.entity.x,person.entity.y)+.13,person.entity.y);group.visible=!Number.isFinite(renderer.renderedMinTx)||person.entity.x>=renderer.renderedMinTx-3&&person.entity.x<=renderer.renderedMaxTx+4&&person.entity.y>=renderer.renderedMinTy-3&&person.entity.y<=renderer.renderedMaxTy+4;if(dx||dy)group.rotation.y=Math.atan2(dx,dy);
  }
  for(const[id,group]of renderer.boatCitizenVisuals)if(!live.has(id)){disposeGroup(renderer,group);renderer.boatCitizenVisuals.delete(id);}
}
