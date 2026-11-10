import {BOAT_CLASSES} from './city_water_transport.js?v=regional-supply-3';
import {surfaceElevation} from './city_terrain.js?v=entrance-retaining-clearance-1';
import {TILE_WATER} from './world_gen.js?v=terrain-generation-reset-2-map-default-128';

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
  const spec=BOAT_CLASSES[kind],group=new THREE.Group(),hullMaterial=new THREE.MeshLambertMaterial({color:kind==='canoe'?0x795034:kind==='cargo'?0x824c3d:0x9b6448}),deckMaterial=new THREE.MeshLambertMaterial({color:spec.color}),dark=new THREE.MeshLambertMaterial({color:0x343d3a});
  const hull=new THREE.Mesh(new THREE.CapsuleGeometry(.23,.72,3,8),hullMaterial);hull.rotation.x=Math.PI/2;hull.scale.set(kind==='canoe'?.66:kind==='cargo'?1.7:kind==='ferry'?1.3:1,.65,kind==='cargo'?1.65:1);hull.position.y=.13;hull.castShadow=true;group.add(hull);
  const deck=new THREE.Mesh(new THREE.BoxGeometry(kind==='canoe'?.35:kind==='cargo'?1.1:.7,.09,kind==='canoe'?1.1:kind==='cargo'?2.1:1.45),deckMaterial);deck.position.y=.25;group.add(deck);
  if(kind!=='canoe'){const cabin=new THREE.Mesh(new THREE.BoxGeometry(kind==='cargo'?.65:.38,.38,kind==='cargo'?.65:.42),dark);cabin.position.set(0,.48,-.32);group.add(cabin);}
  if(kind!=='canoe'){const mast=new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,1.55,5),dark);mast.position.set(0,1.27,.12);mast.castShadow=true;group.add(mast);const sail=new THREE.Mesh(new THREE.BoxGeometry(kind==='cargo'?1.12:.86,1.05,.1),new THREE.MeshLambertMaterial({color:kind==='cargo'?0xf0d89f:0xfff0cb,emissive:0x000000}));sail.position.set(0,1.53,.12);sail.castShadow=true;group.add(sail);}
  if(kind==='canoe'||kind==='launch')for(const z of [-.22,.28]){const seat=new THREE.Mesh(new THREE.BoxGeometry(.42,.06,.1),dark);seat.position.set(0,.31,z);group.add(seat);}
  group.scale.setScalar(spec.scale);return group;
}
function boatVisual(renderer,THREE,id,kind){
  let group=renderer.portVesselVisuals.get(id);
  if(group&&group.userData.kind!==kind){disposeGroup(renderer,group);renderer.portVesselVisuals.delete(id);group=null;}
  if(!group){group=makeBoatModel(THREE,kind);group.userData.kind=kind;renderer.portVesselVisuals.set(id,group);renderer.scene.add(group);}
  return group;
}
const clamp01=value=>Math.max(0,Math.min(1,value));

export function syncCityWatercraft(renderer,THREE,city,world){
  if(!city)return;
  renderer.worldPortVisuals??=new Map();const livePorts=new Set();
  const port=city.worldPort,origin=port?.door||{x:port?.x??world.spawnCenter?.x??0,y:port?.y??world.spawnCenter?.y??0},shore=port?.berth?{door:origin,berth:port.berth}:nearestShore(world,origin),effectivePort=port&&shore?{...port,door:shore.door,berth:shore.berth}:port,portKey=port?`${port.cityId||city.id||''}:${port.id}`:null;if(port?.active&&effectivePort){livePorts.add(portKey);let dock=renderer.worldPortVisuals.get(portKey);if(!dock){dock=makeDock(THREE,{...effectivePort,world});renderer.worldPortVisuals.set(portKey,dock);renderer.scene.add(dock);}dock.visible=true;}
  for(const[id,group]of renderer.worldPortVisuals)if(!livePorts.has(id)){disposeGroup(renderer,group);renderer.worldPortVisuals.delete(id);}
  renderer.portVesselVisuals??=new Map();const coordinator=renderer.worldCoordinator,portId=port?.cityId?`${port.cityId}:port`:null,portPosition=effectivePort?.berth||effectivePort?.door,moored=portId?[...(coordinator?.vessels?.values?.()||[])].filter(vessel=>vessel.currentPortId===portId&&['idle','reserved'].includes(vessel.status)):[],docked=moored,liveVessels=new Set();
  const door=effectivePort?.door||port||{x:0,y:0},berth=effectivePort?.berth||{x:door.x,y:door.y+1},dx=berth.x-door.x,dy=berth.y-door.y,length=Math.hypot(dx,dy)||1,awayX=dx/length,awayY=dy/length,sideX=-awayY,sideY=awayX;
  docked.forEach((vessel,index)=>{const id=vessel.id,kind=BOAT_CLASSES[vessel.classId]?vessel.classId:'cargo';liveVessels.add(id);const group=boatVisual(renderer,THREE,id,kind),spread=(index-(docked.length-1)/2)*.62,x=(portPosition?.x??port.x)+.5+awayX*1.05+sideX*spread,y=(portPosition?.y??port.y)+.5+awayY*1.05+sideY*spread;
    group.position.set(x,surfaceElevation(world,x,y)+.15,y);group.rotation.y=Math.atan2(awayX,awayY);group.visible=true;});
  for(const vessel of city.vehicles?.units?.values?.()||[]){if(!vessel.active||vessel.scrapped||!vessel.boatClass||vessel.entity?.destroyed)continue;const id=`city-vehicle:${vessel.id}`,group=boatVisual(renderer,THREE,id,vessel.boatClass);liveVessels.add(id);group.position.set(vessel.x,surfaceElevation(world,vessel.x,vessel.y)+.15,vessel.y);group.rotation.y=vessel.angle||0;group.visible=!Number.isFinite(renderer.renderedMinTx)||vessel.x>=renderer.renderedMinTx-4&&vessel.x<=renderer.renderedMaxTx+5&&vessel.y>=renderer.renderedMinTy-4&&vessel.y<=renderer.renderedMaxTy+5;}
  const worldMinute=Number.isFinite(coordinator?.minute)?coordinator.minute:0;
  for(const transfer of coordinator?.transfers?.values?.()||[]){
    if(!['departing','in-transit','arriving'].includes(transfer.status))continue;
    const progress=clamp01((worldMinute-transfer.departureMinute)/Math.max(1,transfer.arrivalMinute-transfer.departureMinute)),atOrigin=progress<.5,cityId=atOrigin?transfer.originCityId:transfer.destinationCityId;
    if(cityId!==port?.cityId)continue;
    const vessel=coordinator.vessels.get(transfer.vesselId),kind=BOAT_CLASSES[vessel?.classId]?vessel.classId:'cargo',id=`voyage:${transfer.id}`,group=boatVisual(renderer,THREE,id,kind),distance=.8+(atOrigin?progress:1-progress)*3.5,sign=atOrigin?1:-1,x=berth.x+.5+awayX*distance,y=berth.y+.5+awayY*distance;
    liveVessels.add(id);group.position.set(x,surfaceElevation(world,x,y)+.16,y);group.rotation.y=Math.atan2(awayX*sign,awayY*sign);group.visible=true;
  }
  for(const vessel of coordinator?.vessels?.values?.()||[]){
    if(vessel.status!=='returning'||!Number.isFinite(vessel.returnMinute))continue;
    const route=coordinator.routes.get(vessel.routeId);if(!route)continue;
    const travelMinutes=Math.max(1,route.travelMinutes),progress=clamp01((worldMinute-(vessel.returnMinute-travelMinutes))/travelMinutes),atDestination=progress<.5,cityId=atDestination?route.destinationCityId:route.originCityId;
    if(cityId!==port?.cityId)continue;
    const kind=BOAT_CLASSES[vessel.classId]?vessel.classId:'cargo',id=`return:${vessel.id}`,distance=.8+(atDestination?progress:1-progress)*3.5,sign=atDestination?1:-1,x=berth.x+.5+awayX*distance,y=berth.y+.5+awayY*distance,group=boatVisual(renderer,THREE,id,kind);
    liveVessels.add(id);group.position.set(x,surfaceElevation(world,x,y)+.16,y);group.rotation.y=Math.atan2(awayX*sign,awayY*sign);group.visible=true;
  }
  for(const[id,group]of renderer.portVesselVisuals)if(!liveVessels.has(id)){disposeGroup(renderer,group);renderer.portVesselVisuals.delete(id);}
  renderer.boatCitizenVisuals??=new Map();
  const people=city.citizens.filter(person=>!person.entity.destroyed&&person.boatClass&&!person.boatVehicleId&&person.entity.x>=0&&person.entity.y>=0),live=new Set();
  for(const person of people){const id=person.id,kind=person.boatClass;live.add(id);let group=renderer.boatCitizenVisuals.get(id);
    if(!group||group.userData.kind!==kind){if(group)disposeGroup(renderer,group);group=makeBoatModel(THREE,kind);group.userData.kind=kind;renderer.boatCitizenVisuals.set(id,group);renderer.scene.add(group);}
    const next=person.path?.[0],dx=next?next.x-person.entity.x:0,dy=next?next.y-person.entity.y:0;group.position.set(person.entity.x,surfaceElevation(world,person.entity.x,person.entity.y)+.13,person.entity.y);group.visible=!Number.isFinite(renderer.renderedMinTx)||person.entity.x>=renderer.renderedMinTx-3&&person.entity.x<=renderer.renderedMaxTx+4&&person.entity.y>=renderer.renderedMinTy-3&&person.entity.y<=renderer.renderedMaxTy+4;if(dx||dy)group.rotation.y=Math.atan2(dx,dy);
  }
  for(const[id,group]of renderer.boatCitizenVisuals)if(!live.has(id)){disposeGroup(renderer,group);renderer.boatCitizenVisuals.delete(id);}
}
