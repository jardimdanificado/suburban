import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {interiorRoute} from './city_interior_layout.js?v=route-cache-512-index-1';
import {fitGraffitiToWall,graffitiWallHasWindow,graffitiWallHasBalcony,graffitiWallHasDoor} from './city_graffiti_surfaces.js';
import {GRAFFITI_TILE_WIDTH} from './city_graffiti_size.js';

const MAX_UPPER_WALL_TILES=12;
const UPPER_WALL_SHAPES=[[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,9],[9,7],[2,2],[3,3],[4,4],[5,5],[7,4],[7,7]];

// Upper facades require an actual room and a connected route through the stairs.
export function upperGraffitiSurfaces(city,c,radius=4){
 return [...upperGraffitiSurfaceCandidates(city,c,radius)];
}

// Route validation is expensive in tall buildings. Consumers choosing a single
// surface can stop as soon as they find an accessible wall.
export function* upperGraffitiSurfaceCandidates(city,c,radius=4){
 for(const b of city.buildings){
  if(b.entity.destroyed||b.active===false||b.constructionKind==='open-air'||!b.door||Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y)>radius)continue;
  const records=[];
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
    const support={kind:'street-graffiti',surface:'wall',key,buildingId:b.id,unitId:unit.id,floor:unit.z,side,position,accessPoint,approach:{...b.door},rotation:[Math.PI,Math.PI/2,0,-Math.PI/2][side],width:GRAFFITI_TILE_WIDTH,height:1.64,tileWidth:1,tileHeight:1};
    if(graffitiWallHasWindow(b,support)||graffitiWallHasBalcony(b,support))continue;
    fitGraffitiToWall(city,support);
    records.push({support,unit,side,floor:unit.z,offset:side%2?unit.y+.5:unit.x+.5});
    yield support;
   }
  }
  yield* mergedUpperWallSupports(b,records);
 }
}

// The upper facade can also expose rectangles: adjacent rooms on the same
// floor widen the piece, and consecutive solid floors stack it. Every tile was
// already validated for windows, balconies and a real interior route.
function* mergedUpperWallSupports(b,records){
 const bySide=[[],[],[],[]];
 for(const record of records)bySide[record.side].push(record);
 for(let side=0;side<4;side++){
  const list=bySide[side];
  if(list.length<2)continue;
  const byKey=new Map(list.map(record=>[`${record.floor}:${record.offset}`,record]));
  for(const start of list){
   if(byKey.has(`${start.floor-1}:${start.offset}`)||byKey.has(`${start.floor}:${start.offset-1}`))continue;
   let maxW=0;while(maxW<MAX_UPPER_WALL_TILES&&byKey.has(`${start.floor}:${start.offset+maxW}`))maxW++;
   let maxH=1;
   if((start.support.height||0)>=1){
    maxH=0;
    grow:while(maxH<MAX_UPPER_WALL_TILES){
     const floor=start.floor+maxH;
     for(let dx=0;dx<maxW;dx++){
      const record=byKey.get(`${floor}:${start.offset+dx}`);
      if(!record||Math.abs((record.support.height||0)-(start.support.height||0))>.001)break grow;
     }
     maxH++;
    }
   }
   const shapes=UPPER_WALL_SHAPES.slice();
   if(!shapes.some(([w,h])=>w===maxW&&h===maxH))shapes.push([maxW,maxH]);
   for(const [w,h] of shapes){
    if(w<1||h<1||w>maxW||h>maxH||w*h<=1)continue;
    const rowStart=start.support.position,rowEnd=byKey.get(`${start.floor}:${start.offset+w-1}`).support.position,inside=[];
    let valid=true;
    for(let dy=0;dy<h&&valid;dy++)for(let dx=0;dx<w;dx++){
     const record=byKey.get(`${start.floor+dy}:${start.offset+dx}`);
     if(!record||Math.abs((record.support.height||0)-(start.support.height||0))>.001){valid=false;break;}
     inside.push(record);
    }
    if(!valid)continue;
    const minZ=Math.min(...inside.map(record=>record.support.position.z-record.support.height/2)),
      maxZ=Math.max(...inside.map(record=>record.support.position.z+record.support.height/2)),
      unitIds=[...new Set(inside.map(record=>record.unit.id))];
    const support={kind:'street-graffiti',surface:'wall',key:`wall:${b.id}:${side}:${start.offset}+${w}x${h}:${start.floor}`,buildingId:b.id,unitId:start.unit.id,unitIds,floor:start.floor,side,accessPoint:start.support.accessPoint,approach:start.support.approach,rotation:start.support.rotation,position:{x:(rowStart.x+rowEnd.x)/2,y:(rowStart.y+rowEnd.y)/2,z:(minZ+maxZ)/2},width:GRAFFITI_TILE_WIDTH*w,height:maxZ-minZ,tileWidth:w,tileHeight:h};
    if(graffitiWallHasWindow(b,support)||graffitiWallHasBalcony(b,support)||graffitiWallHasDoor(b,support))continue;
    yield support;
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
