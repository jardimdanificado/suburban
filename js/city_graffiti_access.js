import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {fitGraffitiToWall,graffitiWallHasWindow,graffitiWallHasBalcony,graffitiWallHasDoor} from './city_graffiti_surfaces.js';
import {GRAFFITI_TILE_WIDTH} from './city_graffiti_size.js';

const MAX_UPPER_WALL_TILES=12;
const UPPER_WALL_SHAPES=[[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,9],[9,7],[2,2],[3,3],[4,4],[5,5],[7,4],[7,7]];

// Upper facades require an actual room. The painter reaches them by climbing the
// exterior wall from its base, so no interior route is needed.
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
    const position={x:x+dx*.525,y:y+dy*.525,z:0},wallBase={x:x+dx*.66,y:y+dy*.66},accessPoint={x:x+dx*.3,y:y+dy*.3,z:unit.z*CITY_FLOOR_HEIGHT};
    const key=`wall:${b.id}:${side}:${side%2?unit.y+.5:unit.x+.5}:${unit.z}`;
    if(city.justice.art.some(p=>!p.entity.destroyed&&p.support?.key===key)||city.citizens.some(p=>p.graffitiMission?.surface?.key===key))continue;
    if(!city.walkable(Math.floor(wallBase.x),Math.floor(wallBase.y)))continue;
    const support={kind:'street-graffiti',surface:'wall',key,buildingId:b.id,unitId:unit.id,floor:unit.z,side,position,accessPoint,approach:wallBase,rotation:[Math.PI,Math.PI/2,0,-Math.PI/2][side],width:GRAFFITI_TILE_WIDTH,height:1.64,tileWidth:1,tileHeight:1};
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
// already validated for windows and balconies.
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

export function climbingFallChance(floor){
 return .001+.001*Math.max(1,floor||1);
}
export function climbingFallDamage(height,floor){
 return Math.round(8+Math.max(0,height||0)*8+Math.max(1,floor||1)*6);
}
export function reachUpperGraffiti(city,c,mission){
 const support=mission.surface,dx=[0,1,0,-1][support.side]||0,dy=[-1,0,1,0][support.side]||0;
 const wallBase=support.approach||{x:support.position.x+dx*.14,y:support.position.y+dy*.14};
 if(!c.climbing){
  if(c.path.length)return false;
  if(Math.hypot(c.entity.x-wallBase.x,c.entity.y-wallBase.y)>.28){
   const path=city.findPath(c.entity,wallBase);
   if(path===null){mission.accessFailed=true;return false;}
   c.path=path.length?path:[wallBase];return false;
  }
  const floor=Math.max(1,support.floor||1);
  const targetZ=Math.max(.5,floor*CITY_FLOOR_HEIGHT-.55);
  c.climbing={phase:'up',targetZ,floor,z:0,x:wallBase.x,y:wallBase.y,facingX:support.position.x,facingY:support.position.y,lastMinute:city.minute,dtMoved:false};
  c.path=[];c.facingTarget={x:support.position.x,y:support.position.y};
  mission.status='climbing';c.action='Escalando a parede para pichar';return false;
 }
 c.path=[];
 c.entity.x=c.climbing.x;c.entity.y=c.climbing.y;
 c.facingTarget={x:c.climbing.facingX,y:c.climbing.facingY};
 if(c.climbing.phase==='painting')return true;
 if(!c.climbing.dtMoved&&city.minute>c.climbing.lastMinute){
  const mins=Math.max(1,city.minute-c.climbing.lastMinute);
  const step=(c.climbing.phase==='down'?-2.2:1.85)*mins;
  c.climbing.z=Math.max(0,Math.min(c.climbing.targetZ,c.climbing.z+step));
 }
 c.climbing.lastMinute=city.minute;c.climbing.dtMoved=false;
 const currentFloor=Math.max(1,Math.ceil(c.climbing.z/CITY_FLOOR_HEIGHT));
 if(c.climbing.z>0&&city.random()<climbingFallChance(currentFloor)){
  const fallHeight=c.climbing.z,damage=climbingFallDamage(fallHeight,currentFloor);
  c.climbing=null;c.skybridgeZ=0;c.facingTarget=null;
  c.needs.health=Math.max(0,(c.needs.health??100)-damage);
  if(c.needs.health<=0){c.dead=true;c.diedAt=city.minute;c.action='Morreu ao cair da parede';}
  else{c.unconsciousUntil=city.minute+10+currentFloor*4;c.action=`Caiu do ${currentFloor}º andar (-${damage} saúde)`;}
  city.sanitation?.soilCitizen?.(c,'sangue',5+currentFloor*3,null,'legs');
  city.log?.(`${c.entity.properties.name} escorregou e caiu do ${currentFloor}º andar ao escalar para pichar (dano ${damage}).`,'justice',[c.id],{kind:'graffiti-fall',floor:currentFloor,damage,height:fallHeight});
  mission.accessFailed=true;return false;
 }
 if(c.climbing.phase==='up'&&c.climbing.z>=c.climbing.targetZ){c.climbing.phase='painting';return true;}
 if(c.climbing.phase==='down'&&c.climbing.z<=0){c.climbing=null;c.skybridgeZ=0;c.facingTarget=null;return true;}
 c.action=c.climbing.phase==='down'?'Descendo da parede após pichar':`Escalando o ${currentFloor}º andar para pichar`;
 return false;
}
