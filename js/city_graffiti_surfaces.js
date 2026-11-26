import {CITY_FLOOR_HEIGHT,buildingEntranceDoor} from './city_building_geometry.js?v=banner-placement-2';
import {buildingLeisureSpaces} from './city_balconies.js?v=sertanejo-house-styles-1';
import {buildingFacadeWindowMask} from './city_facade_patterns.js';
import {surfaceElevation,tileAt,terrainWalkable,PAVED_ROAD_TILES} from './city_terrain.js?v=entrance-retaining-clearance-1';
import {roadRetainingFaces} from './road_terrain_geometry.js?v=stone-road-edge-seam-1';
import {GRAFFITI_TILE_WIDTH,GRAFFITI_WALL_TILE_HEIGHT} from './city_graffiti_size.js';

export const graffitiCameraFocus=support=>support?.kind==='street-graffiti'?{zoom:8,...(support.surface!=='ground'?{yaw:support.rotation||0}:{})}:undefined;
export const graffitiSurfaceLabel=support=>({wall:'Muro / parede externa',ground:'Chão',retaining:'Arrimo'})[support?.surface]||'Superfície urbana';
// A wide piece covers as many adjacent wall tiles as share the same wall band
// (all solid or all below a window). Large lots also merge floor tiles into
// 2x2, 4x4, 7x9 and larger rectangles.
const MAX_WIDE_GRAFFITI_TILES=12;
const WALL_TILE_WIDTH=GRAFFITI_TILE_WIDTH;
const WIDE_WALL_PREFERENCE=.75;
// Formatos procurados em cada canto superior esquerdo. Retângulos maiores que
// o formato máximo continuam sendo oferecidos pelo retângulo máximo do lote.
const GROUND_SHAPES=[[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],[7,9],[9,7],[7,7],[8,8],[9,9]];
const edges=[{dx:0,dy:-1,rotation:Math.PI},{dx:1,dy:0,rotation:Math.PI/2},{dx:0,dy:1,rotation:0},{dx:-1,dy:0,rotation:-Math.PI/2}];
const inside=(b,x,y)=>!b.entity.destroyed&&x>=b.entity.x&&x<b.entity.x+b.width&&y>=b.entity.y&&y<b.entity.y+b.depth;
const publicGround=(city,x,y)=>terrainWalkable(city.world,x,y)&&!city.buildings.some(b=>inside(b,x+.5,y+.5));

export function graffitiWallHasWindow(building,support){
  const ids=Array.isArray(support?.unitIds)?support.unitIds:[],
    units=ids.length?ids.map(id=>(building.units||[]).find(u=>u.id===id)).filter(Boolean):null;
  if(units?.length)return units.some(unit=>wallUnitHasWindow(building,unit,support.side,support.floor??0));
  const edge=edges[support.side],p=support.position,
    x=Math.floor(p.x-building.entity.x-edge.dx*.05),y=Math.floor(p.y-building.entity.y-edge.dy*.05),
    unit=(building.units||[]).find(u=>u.z===(support.floor??0)&&u.x===x&&u.y===y);
  return wallUnitHasWindow(building,unit,support.side,support.floor??0);
}

function wallUnitHasWindow(building,unit,side,floor=0){
  if(!unit?.hasWindow)return false;
  const entrance=buildingEntranceDoor(building);if(floor===0&&entrance?.unitId===unit.id)return false;
  const occupied=new Set([...(building.units||[]),...(building.circulation||[])].map(u=>`${u.x},${u.y},${u.z}`));
  let safe=0;
  for(const [dx,dy,bit] of [[0,-1,1],[0,1,2],[-1,0,4],[1,0,8]])if(!occupied.has(`${unit.x+dx},${unit.y+dy},${unit.z}`))safe|=bit;
  for(const space of buildingLeisureSpaces(building))if(space.kind==='balcony'&&space.unitId===unit.id)safe&=~space.doorBit;
  const opening=buildingFacadeWindowMask(building,unit,safe);
  return !!(opening&[1,8,2,4][side]);
}

export function graffitiWallHasBalcony(building,support){
  const floor=support?.floor??0,sideBit=[1,8,2,4][support?.side];
  const ids=Array.isArray(support?.unitIds)?support.unitIds:support?.unitId!=null?[support.unitId]:[];
  const spaces=buildingLeisureSpaces(building).filter(s=>s.kind==='balcony');
  if(!spaces.length)return false;
  // Unit ids identify the floor already; a merged piece can include several.
  if(ids.some(id=>spaces.some(s=>s.unitId===id&&(s.doorBit==null||s.doorBit===sideBit))))return true;
  const edge=edges[support?.side],p=support?.position;
  if(!edge||!p)return false;
  const x=Math.floor(p.x-building.entity.x-edge.dx*.05),y=Math.floor(p.y-building.entity.y-edge.dy*.05);
  const unit=(building.units||[]).find(u=>u.z===floor&&u.x===x&&u.y===y);
  return !!unit&&spaces.some(s=>s.unitId===unit.id&&(s.doorBit==null||s.doorBit===sideBit));
}

export function graffitiWallHasDoor(building,support){
  if((support?.floor??0)!==0)return false;
  const p=support?.position,a=support?.approach;
  if(building.door){
    if(a&&Math.hypot(a.x-building.door.x,a.y-building.door.y)<1.05)return true;
    if(p&&Math.hypot(p.x-building.door.x,p.y-building.door.y)<1.05)return true;
  }
  const entrance=buildingEntranceDoor(building);
  if(!entrance)return false;
  const sideBit=[1,8,2,4][support?.side];
  const ids=Array.isArray(support?.unitIds)?support.unitIds:support?.unitId!=null?[support.unitId]:[];
  if(ids.includes(entrance.unitId)&&entrance.bit===sideBit)return true;
  const edge=edges[support?.side];
  if(!edge||!p)return false;
  const x=Math.floor(p.x-building.entity.x-edge.dx*.05),y=Math.floor(p.y-building.entity.y-edge.dy*.05);
  const unit=(building.units||[]).find(u=>u.z===0&&u.x===x&&u.y===y);
  return unit?.id===entrance.unitId&&entrance.bit===sideBit;
}

// Use the full wall unless its actual opening needs clearance.
export function fitGraffitiToWall(city,support){
  if(support?.kind!=='street-graffiti'||support.surface!=='wall')return false;
  // A merged piece already carries the height of every floor it covers.
  if((support.tileHeight||1)>1||(support.floorSpan||1)>1)return false;
  const b=city.building(support.buildingId);if(!b||b.entity.destroyed)return false;
  const base=b.terrain?.base??surfaceElevation(city.world,support.position.x,support.position.y),window=graffitiWallHasWindow(b,support),z=base+(support.floor??0)*CITY_FLOOR_HEIGHT+(window ? .25 : .9),height=window ? .42 : 1.64;
  if(support.position.z===z&&support.height===height)return false;
  support.position={...support.position,z};support.height=height;return true;
}

// Search only nearby surfaces. Every candidate includes a separate standing point:
// paint belongs on the surface, while the person must remain on reachable ground.
export function nearbyGraffitiSurfaces(city,c,radius=4){
  const candidates=[],cx=Math.floor(c.entity.x),cy=Math.floor(c.entity.y),world=city.world;
  if(!world?.getTile||!Number.isFinite(world.width)||!Number.isFinite(world.height))return candidates;
  const add=(surface,key,position,approach,extra={})=>{
    if(Math.hypot(approach.x-c.entity.x,approach.y-c.entity.y)>radius||!city.walkable(Math.floor(approach.x),Math.floor(approach.y)))return false;
    const width=extra.width||.86,height=extra.height||.86;
    // Ground paint is an axis-aligned rectangle; wall paint is a strip along a
    // facade. Both must reject any piece or reserved mission that intersects.
    const overlaps=(other)=>{
      if(!other||other.surface!==surface)return false;
      if(other.key===key)return true;
      if(surface==='ground'){
        const ow=other.width||.86,oh=other.height||.86;
        return Math.abs(other.position.x-position.x)<(width+ow)/2-.01&&Math.abs(other.position.y-position.y)<(height+oh)/2-.01;
      }
      return (width>WALL_TILE_WIDTH+.001||(other.width||.86)>WALL_TILE_WIDTH+.001)&&
        Math.hypot(other.position.x-position.x,other.position.y-position.y)<(width+(other.width||.86))/2-.01;
    };
    if(city.justice.art.some(piece=>!piece.entity.destroyed&&(overlaps(piece.support)||Math.hypot(piece.entity.x-position.x,piece.entity.y-position.y)<1.1)))return false;
    if(city.citizens?.some(person=>overlaps(person.graffitiMission?.surface)))return false;
    const support={kind:'street-graffiti',surface,key,position,approach,...extra};
    fitGraffitiToWall(city,support);candidates.push(support);return true;
  };
  const groundTiles=[],groundEligible=new Set();
  for(let y=Math.max(0,cy-radius);y<=Math.min(world.height-1,cy+radius);y++)for(let x=Math.max(0,cx-radius);x<=Math.min(world.width-1,cx+radius);x++){
    if(publicGround(city,x,y)&&PAVED_ROAD_TILES.has(tileAt(world,x,y))){
      groundTiles.push({x,y});groundEligible.add(`${x},${y}`);
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
  // Each top-left corner of a paved block grows one rectangle. The preset
  // shapes keep 4x4 and 7x9 available; the maximal rectangle covers larger lots.
  const span=Math.max(1,2*radius+1);
  for(const {x,y} of groundTiles){
    if(groundEligible.has(`${x-1},${y}`)||groundEligible.has(`${x},${y-1}`))continue;
    let maxW=0;while(maxW<span&&groundEligible.has(`${x+maxW},${y}`))maxW++;
    let maxH=0;
    grow:while(maxH<span){
      for(let dx=0;dx<maxW;dx++)if(!groundEligible.has(`${x+dx},${y+maxH}`))break grow;
      maxH++;
    }
    if(!maxW||!maxH)continue;
    const shapes=GROUND_SHAPES.slice();
    if(!shapes.some(([w,h])=>w===maxW&&h===maxH))shapes.push([maxW,maxH]);
    for(const [w,h] of shapes){
      if(w>maxW||h>maxH)continue;
      const position={x:x+w/2,y:y+h/2,z:surfaceElevation(world,x+w/2,y+h/2)};
      let approach={x:x+.5,y:y+.5},best=Infinity;
      for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++){
        const px=x+dx+.5,py=y+dy+.5,distance=Math.hypot(px-c.entity.x,py-c.entity.y);
        if(distance<best){best=distance;approach={x:px,y:py};}
      }
      add('ground',`ground:${x},${y}:${w}x${h}`,position,approach,{tileX:x,tileY:y,tileWidth:w,tileHeight:h,width:w*WALL_TILE_WIDTH,height:h*WALL_TILE_WIDTH});
    }
  }
  // Single tiles remain available when a mural rectangle is blocked by art.
  for(const {x,y} of groundTiles){
    add('ground',`ground:${x},${y}`,{x:x+.5,y:y+.5,z:surfaceElevation(world,x+.5,y+.5)},{x:x+.5,y:y+.5},{tileX:x,tileY:y,tileWidth:1,tileHeight:1,width:WALL_TILE_WIDTH,height:WALL_TILE_WIDTH});
  }
  for(const b of city.buildings){
    if(b.entity.destroyed||b.constructionKind==='open-air'||b.active===false||!b.width||!b.depth)continue;
    if(b.entity.x>cx+radius+1||b.entity.y>cy+radius+1||b.entity.x+b.width<cx-radius||b.entity.y+b.depth<cy-radius)continue;
    for(let side=0;side<4;side++){
      const edge=edges[side],horizontal=side%2===0,length=horizontal?b.width:b.depth,segments=[];
      for(let offset=.5;offset<length;offset++){
        const x=b.entity.x+(horizontal?offset:side===1?b.width:0),y=b.entity.y+(horizontal?side===2?b.depth:0:offset),approach={x:x+edge.dx*.5,y:y+edge.dy*.5};
        if(b.door&&Math.hypot(approach.x-b.door.x,approach.y-b.door.y)<1.05)continue;
        if(!publicGround(city,Math.floor(approach.x),Math.floor(approach.y)))continue;
        const base=b.terrain?.base??surfaceElevation(world,x,y),standing=surfaceElevation(world,approach.x,approach.y),z=base+.25;
        if(z-standing<.05||z-standing>1.4)continue;
        const position={x:x+edge.dx*.025,y:y+edge.dy*.025,z},key=`wall:${b.id}:${side}:${offset}`,
          unit=(b.units||[]).find(u=>u.z===0&&u.x===Math.floor(position.x-b.entity.x-edge.dx*.05)&&u.y===Math.floor(position.y-b.entity.y-edge.dy*.05)),
          probe={kind:'street-graffiti',surface:'wall',key,buildingId:b.id,side,rotation:edge.rotation,position,approach,width:WALL_TILE_WIDTH,height:.42,...(unit?{unitIds:[unit.id]}:{})};
        if(graffitiWallHasWindow(b,probe)||graffitiWallHasBalcony(b,probe)||graffitiWallHasDoor(b,probe))continue;
        fitGraffitiToWall(city,probe);
        const segment={offset,position:probe.position,approach,key,height:probe.height,unitId:unit?.id??null};
        segments.push(segment);
        const added=add('wall',key,segment.position,approach,{buildingId:b.id,side,rotation:edge.rotation,width:WALL_TILE_WIDTH,height:segment.height,tileWidth:1,tileHeight:1,...(Number.isInteger(segment.unitId)?{unitIds:[segment.unitId]}:{})});
        segment.added=added;
      }
      // Merge 2..MAX_WIDE_GRAFFITI_TILES neighbours whose wall band is identical, so multi-tile
      // pieces never cross a window line or a terrain step.
      for(let span=2;span<=Math.min(MAX_WIDE_GRAFFITI_TILES,segments.length);span++){
        for(let i=0;i+span<=segments.length;i++){
          const slice=segments.slice(i,i+span);
          if(slice.some(s=>!s.added))continue;
          const first=slice[0];
          let contiguous=true;
          for(let k=1;k<slice.length;k++){
            if(Math.abs(slice[k].offset-slice[k-1].offset-1)>1e-6||Math.abs(slice[k].position.z-first.position.z)>.001||Math.abs(slice[k].height-first.height)>.001){contiguous=false;break;}
          }
          if(!contiguous)continue;
          const unitIds=slice.map(s=>s.unitId).filter((id,index,list)=>Number.isInteger(id)&&list.indexOf(id)===index);
          const avg=fn=>slice.reduce((sum,s)=>sum+fn(s),0)/span;
          add('wall',`wall:${b.id}:${side}:${slice.map(s=>s.offset).join('+')}`,
            {x:avg(s=>s.position.x),y:avg(s=>s.position.y),z:first.position.z},
            {x:avg(s=>s.approach.x),y:avg(s=>s.approach.y)},
            {buildingId:b.id,side,rotation:edge.rotation,width:WALL_TILE_WIDTH*span,height:first.height,tileWidth:span,tileHeight:1,...(unitIds.length?{unitIds}:{})});
        }
      }
    }
  }
  // Prefer full-height multi-tile walls (wider wins over single tiles); deprioritize low below-window strips.
  const rank=s=>{
    const tiles=Math.max(1,Math.round((s.width||WALL_TILE_WIDTH)/WALL_TILE_WIDTH)),distance=Math.hypot(s.approach.x-c.entity.x,s.approach.y-c.entity.y);
    if(s.surface==='ground')return distance-Math.sqrt((s.width||WALL_TILE_WIDTH)*(s.height||WALL_TILE_WIDTH))*.35;
    return distance-(s.surface==='wall'?(tiles-1)*WIDE_WALL_PREFERENCE:0)+(s.surface==='wall'&&(s.height||1)<1?2.5:0);
  };
  return candidates.sort((a,b)=>Number(a.surface==='ground')-Number(b.surface==='ground')||rank(a)-rank(b));
}

export function graffitiSurfaceExists(city,support){
  if(support?.kind!=='street-graffiti')return false;
  if(support.surface==='wall'){
    const b=city.building(support.buildingId),floors=b?.floors||1,topo=(support.floor??0)+(support.tileHeight||1)-1;
    if(!b||b.entity.destroyed||(support.floor??0)>=floors||topo>=floors||support.unitId!=null&&!b.units?.some(u=>u.id===support.unitId)||support.unitIds?.some(id=>!b.units?.some(u=>u.id===id)))return false;
    if(graffitiWallHasWindow(b,support)||graffitiWallHasBalcony(b,support)||graffitiWallHasDoor(b,support))return false;
    const edge=edges[support.side],boundary=support.side===0?b.entity.y:support.side===1?b.entity.x+b.width:support.side===2?b.entity.y+b.depth:b.entity.x;
    return Math.abs((support.side%2?support.position.x-edge.dx*.025:support.position.y-edge.dy*.025)-boundary)<.01;
  }
  if(support.surface==='ground'){
    const largura=Math.max(1,support.tileWidth||1),altura=Math.max(1,support.tileHeight||1);
    for(let dy=0;dy<altura;dy++)for(let dx=0;dx<largura;dx++){
      const x=support.tileX+dx,y=support.tileY+dy;
      if(!PAVED_ROAD_TILES.has(tileAt(city.world,x,y))||tileAt(city.world,x,y)===undefined||!publicGround(city,x,y))return false;
    }
    return true;
  }
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
