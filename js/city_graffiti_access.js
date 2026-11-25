import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {interiorRoute} from './city_interior_layout.js?v=route-cache-512-index-1';
import {fitGraffitiToWall,graffitiWallHasWindow,graffitiWallHasBalcony} from './city_graffiti_surfaces.js';

// Upper facades require an actual room and a connected route through the stairs.
export function upperGraffitiSurfaces(city,c,radius=4){
 return [...upperGraffitiSurfaceCandidates(city,c,radius)];
}

// Route validation is expensive in tall buildings. Consumers choosing a single
// surface can stop as soon as they find an accessible wall.
export function* upperGraffitiSurfaceCandidates(city,c,radius=4){
 for(const b of city.buildings){
  if(b.entity.destroyed||b.active===false||b.constructionKind==='open-air'||!b.door||Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y)>radius)continue;
  for(const unit of b.units||[]){
   if(unit.z<1)continue;
   const sides=[unit.y===0,unit.x===b.width-1,unit.y===b.depth-1,unit.x===0];
   for(let side=0;side<4;side++){
    if(!sides[side])continue;
    const dx=[0,1,0,-1][side],dy=[-1,0,1,0][side],x=b.entity.x+unit.x+.5,y=b.entity.y+unit.y+.5;
    const position={x:x+dx*.525,y:y+dy*.525,z:0},accessPoint={x:x+dx*.3,y:y+dy*.3,z:unit.z*CITY_FLOOR_HEIGHT};
    const key=`wall:${b.id}:${side}:${side%2?unit.y+.5:unit.x+.5}:${unit.z}`;
    if(city.justice.art.some(p=>!p.entity.destroyed&&p.support?.key===key)||city.citizens.some(p=>p.graffitiMission?.surface?.key===key))continue;
    if(interiorRoute(b,{...b.door,z:0},accessPoint)===null)continue;
    const support={kind:'street-graffiti',surface:'wall',key,buildingId:b.id,unitId:unit.id,floor:unit.z,side,position,accessPoint,approach:{...b.door},rotation:[Math.PI,Math.PI/2,0,-Math.PI/2][side],width:.86,height:1.64};
    if(graffitiWallHasWindow(b,support)||graffitiWallHasBalcony(b,support))continue;
    fitGraffitiToWall(city,support);yield support;
   }
  }
 }
}

export function reachUpperGraffiti(city,c,mission){
 const support=mission.surface,b=city.building(support.buildingId),room=c.indoorLocation;
 if(room){
  if(room.buildingId!==b.id||room.exiting)return false;
  if(room.path.length)return false;
  return Math.hypot(room.position.x-support.accessPoint.x,room.position.y-support.accessPoint.y,room.position.z-support.accessPoint.z)<.2;
 }
 if(c.path.length||Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)>.2)return false;
 const position={x:c.entity.x,y:c.entity.y,z:0},path=interiorRoute(b,position,support.accessPoint);
 if(path===null){mission.accessFailed=true;return false;}
 c.indoorLocation={buildingId:b.id,unitId:null,targetUnitId:support.unitId,roomType:'circulation',targetRoomType:'graffiti',position,path,floor:0,phase:'walking',task:c.task,layoutRevision:b.layoutRevision||0,enteredAt:city.minute};
 const own=b.ownerId===c.id||b.accountId!=null&&b.accountId===c.accountId||city.units?.get(c.homeUnitId)?.buildingId===b.id;
 if(!own)city.justice.recordTrespassUse(c,b,{id:support.unitId,price:0},'upper-floor-graffiti');
 mission.status='climbing';c.action='Subindo para pintar a fachada';return false;
}
