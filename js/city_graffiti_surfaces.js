import {buildingEntranceDoor} from './city_building_geometry.js?v=banner-placement-2';
import {buildingLeisureSpaces} from './city_balconies.js?v=sertanejo-house-styles-1';
import {surfaceElevation,tileAt,terrainWalkable} from './city_terrain.js?v=entrance-retaining-clearance-1';
import {roadRetainingFaces} from './road_terrain_geometry.js?v=stone-road-edge-seam-1';

export const graffitiCameraFocus=support=>support?.kind==='street-graffiti'?{zoom:8,...(support.surface!=='ground'?{yaw:support.rotation||0}:{})}:undefined;
export const graffitiSurfaceLabel=support=>({wall:'Muro / parede externa',ground:'Chão',retaining:'Arrimo'})[support?.surface]||'Superfície urbana';
const edges=[{dx:0,dy:-1,rotation:Math.PI},{dx:1,dy:0,rotation:Math.PI/2},{dx:0,dy:1,rotation:0},{dx:-1,dy:0,rotation:-Math.PI/2}];
const inside=(b,x,y)=>!b.entity.destroyed&&x>=b.entity.x&&x<b.entity.x+b.width&&y>=b.entity.y&&y<b.entity.y+b.depth;
const publicGround=(city,x,y)=>terrainWalkable(city.world,x,y)&&!city.buildings.some(b=>inside(b,x+.5,y+.5));

export function graffitiWallHasWindow(building,support){
  const units=building.units||[],edge=edges[support.side],p=support.position;
  const x=Math.floor(p.x-building.entity.x-edge.dx*.05),y=Math.floor(p.y-building.entity.y-edge.dy*.05);
  const unit=units.find(u=>u.z===0&&u.x===x&&u.y===y);if(!unit?.hasWindow)return false;
  const entrance=buildingEntranceDoor(building);if(entrance?.unitId===unit.id)return false;
  const occupied=new Set([...units,...(building.circulation||[])].map(u=>`${u.x},${u.y},${u.z}`));
  let safe=0;
  for(const [dx,dy,bit] of [[0,-1,1],[0,1,2],[-1,0,4],[1,0,8]])if(!occupied.has(`${x+dx},${y+dy},0`))safe|=bit;
  for(const space of buildingLeisureSpaces(building))if(space.kind==='balcony'&&space.unitId===unit.id)safe&=~space.doorBit;
  const opening=safe&3?(safe&2?2:1):safe&4?4:safe&8?8:0;
  return opening===[1,8,2,4][support.side];
}

// Use the full ground-floor wall unless its actual opening needs clearance.
export function fitGraffitiToWall(city,support){
  if(support?.kind!=='street-graffiti'||support.surface!=='wall')return false;
  const b=city.building(support.buildingId);if(!b||b.entity.destroyed)return false;
  const base=b.terrain?.base??surfaceElevation(city.world,support.position.x,support.position.y),window=graffitiWallHasWindow(b,support),z=base+(window ? .25 : .9),height=window ? .42 : 1.64;
  if(support.position.z===z&&support.height===height)return false;
  support.position={...support.position,z};support.height=height;return true;
}

// Search only nearby surfaces. Every candidate includes a separate standing point:
// paint belongs on the surface, while the person must remain on reachable ground.
export function nearbyGraffitiSurfaces(city,c,radius=4){
  const candidates=[],cx=Math.floor(c.entity.x),cy=Math.floor(c.entity.y),world=city.world;
  if(!world?.getTile||!Number.isFinite(world.width)||!Number.isFinite(world.height))return candidates;
  const add=(surface,key,position,approach,extra={})=>{
    if(Math.hypot(approach.x-c.entity.x,approach.y-c.entity.y)>radius||!city.walkable(Math.floor(approach.x),Math.floor(approach.y)))return;
    if(city.justice.art.some(piece=>!piece.entity.destroyed&&(piece.support?.key===key||Math.hypot(piece.entity.x-position.x,piece.entity.y-position.y)<1.1)))return;
    if(city.citizens?.some(person=>person.graffitiMission?.surface?.key===key))return;
    const support={kind:'street-graffiti',surface,key,position,approach,...extra};
    fitGraffitiToWall(city,support);candidates.push(support);
  };
  for(let y=Math.max(0,cy-radius);y<=Math.min(world.height-1,cy+radius);y++)for(let x=Math.max(0,cx-radius);x<=Math.min(world.width-1,cx+radius);x++){
    if(publicGround(city,x,y)){
      add('ground',`ground:${x},${y}`,{x:x+.5,y:y+.5,z:surfaceElevation(world,x+.5,y+.5)},{x:x+.5,y:y+.5},{tileX:x,tileY:y,width:.86,height:.86});
    }
    for(const face of roadRetainingFaces(world,x,y)){
      const edge=edges[face.side],mx=(face.ax+face.bx)/2,my=(face.ay+face.by)/2,low=Math.max(face.lowA,face.lowB),high=Math.min(face.highA,face.highB),length=Math.hypot(face.bx-face.ax,face.by-face.ay);
      if(high-low<.35||length<.45)continue;
      for(const direction of [1,-1]){
        const approach={x:mx+edge.dx*.5*direction,y:my+edge.dy*.5*direction};
        if(!publicGround(city,Math.floor(approach.x),Math.floor(approach.y)))continue;
        const standing=surfaceElevation(world,approach.x,approach.y),height=Math.min(.65,high-low-.08),z=Math.max(low+.04+height/2,Math.min(standing+.7,high-.04-height/2));
        if(z+height/2>high-.02||z-standing>1.4||z-standing<.15)continue;
        add('retaining',`retaining:${x},${y}:${face.side}:${face.from}:${face.to}`,{x:mx+edge.dx*.012*direction,y:my+edge.dy*.012*direction,z},approach,{tileX:x,tileY:y,side:face.side,from:face.from,to:face.to,rotation:edge.rotation+(direction<0?Math.PI:0),width:Math.min(.86,length-.08),height});
      }
    }
  }
  for(const b of city.buildings){
    if(b.entity.destroyed||b.constructionKind==='open-air'||b.active===false||!b.width||!b.depth)continue;
    if(b.entity.x>cx+radius+1||b.entity.y>cy+radius+1||b.entity.x+b.width<cx-radius||b.entity.y+b.depth<cy-radius)continue;
    for(let side=0;side<4;side++){
      const edge=edges[side],horizontal=side%2===0,length=horizontal?b.width:b.depth;
      for(let offset=.5;offset<length;offset++){
        const x=b.entity.x+(horizontal?offset:side===1?b.width:0),y=b.entity.y+(horizontal?side===2?b.depth:0:offset),approach={x:x+edge.dx*.5,y:y+edge.dy*.5};
        if(b.door&&Math.hypot(approach.x-b.door.x,approach.y-b.door.y)<.9)continue;
        if(!publicGround(city,Math.floor(approach.x),Math.floor(approach.y)))continue;
        const base=b.terrain?.base??surfaceElevation(world,x,y),standing=surfaceElevation(world,approach.x,approach.y),z=base+.25;
        if(z-standing<.05||z-standing>1.4)continue;
        add('wall',`wall:${b.id}:${side}:${offset}`,{x:x+edge.dx*.025,y:y+edge.dy*.025,z},approach,{buildingId:b.id,side,rotation:edge.rotation,width:.86,height:.42});
      }
    }
  }
  // Prefer walls and retaining faces; ground remains a valid independent target.
  return candidates.sort((a,b)=>Number(a.surface==='ground')-Number(b.surface==='ground')||Math.hypot(a.approach.x-c.entity.x,a.approach.y-c.entity.y)-Math.hypot(b.approach.x-c.entity.x,b.approach.y-c.entity.y));
}

export function graffitiSurfaceExists(city,support){
  if(support?.kind!=='street-graffiti')return false;
  if(support.surface==='wall'){
    const b=city.building(support.buildingId);if(!b||b.entity.destroyed)return false;
    const edge=edges[support.side],boundary=support.side===0?b.entity.y:support.side===1?b.entity.x+b.width:support.side===2?b.entity.y+b.depth:b.entity.x;
    return Math.abs((support.side%2?support.position.x-edge.dx*.025:support.position.y-edge.dy*.025)-boundary)<.01;
  }
  if(support.surface==='ground')return publicGround(city,support.tileX,support.tileY)&&tileAt(city.world,support.tileX,support.tileY)!==undefined;
  return roadRetainingFaces(city.world,support.tileX,support.tileY).some(face=>face.side===support.side&&Math.abs(face.from-support.from)<.001&&Math.abs(face.to-support.to)<.001&&support.position.z-support.height/2>=Math.max(face.lowA,face.lowB)&&support.position.z+support.height/2<=Math.min(face.highA,face.highB));
}

// World-space vertices make ground paint follow the same terrain triangles as
// the street. Vertical paint sits just outside its wall, without a display stand.
export function graffitiSurfaceVertices(world,support){
  const {position:p,width:w,height:h}=support;
  if(support.surface==='ground')return [[p.x-w/2,p.y-h/2],[p.x+w/2,p.y-h/2],[p.x+w/2,p.y+h/2],[p.x-w/2,p.y+h/2]].flatMap(([x,y])=>[x,surfaceElevation(world,x,y)+.018,y]);
  const dx=Math.cos(support.rotation||0)*w/2,dy=-Math.sin(support.rotation||0)*w/2;
  return [p.x-dx,p.z-h/2,p.y-dy,p.x+dx,p.z-h/2,p.y+dy,p.x+dx,p.z+h/2,p.y+dy,p.x-dx,p.z+h/2,p.y-dy];
}
