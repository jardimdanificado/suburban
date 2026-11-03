export const CITY_FLOOR_HEIGHT=1.8;
export function cityBuildingPickVerticalBounds({constructionKind,type,floors=1,base=0,surfaceBase=base}){
  // Quarries are outdoor, ground-level work sites. Keep their picking volume
  // close to the visible surface even if a stale save or caller reports them
  // as a regular building with one floor.
  if(constructionKind==='open-air'||type==='quarry'){
    const height=['market','greengrocer'].includes(type)?CITY_FLOOR_HEIGHT+.1:.14;
    return {base:surfaceBase,top:surfaceBase+height};
  }
  return {base,top:base+floors*CITY_FLOOR_HEIGHT};
}
export const MIN_PLOT_CELLS=4;
export const ROTATION_LABELS=['Sul','Leste','Norte','Oeste'];
export function modelSize(b){return (b.rotation||0)%2?{width:b.depth,depth:b.width}:{width:b.width,depth:b.depth};}
// Quarter turns around a rectangular footprint; unit coordinates remain world-aligned.
export function buildingPoint(b,x,y){
  switch(b.rotation||0){case 1:return {x:y,y:b.depth-x};case 2:return {x:b.width-x,y:b.depth-y};case 3:return {x:b.width-y,y:x};default:return {x,y};}
}
export function buildingEntrance(x,y,width,depth,rotation=0){
  const b={width,depth,rotation},size=modelSize(b),p=buildingPoint(b,Math.floor(size.width/2)+.5,size.depth+.5);
  return {x:x+p.x,y:y+p.y};
}
export function buildingFacadeBannerSupport(b){
  if(!b?.entity)return null;const size=modelSize(b),x=b.entity.x,y=b.entity.y,w=size.width,d=size.depth,door=b.door,distances=door?[['north',Math.abs(door.y-y)],['east',Math.abs(door.x-(x+w))],['south',Math.abs(door.y-(y+d))],['west',Math.abs(door.x-x)]]:[],side=distances.length?distances.sort((a,z)=>a[1]-z[1])[0][0]:'south',clamp=(value,min,max)=>min>max?(min+max)/2:Math.max(min,Math.min(max,value)),margin=.72,doorX=door?.x??x+w/2,doorY=door?.y??y+d/2;
  let point;if(side==='north')point={x:clamp(doorX,x+margin,x+w-margin),y:y-.025};else if(side==='east')point={x:x+w+.025,y:clamp(doorY,y+margin,y+d-margin)};else if(side==='south')point={x:clamp(doorX,x+margin,x+w-margin),y:y+d+.025};else point={x:x-.025,y:clamp(doorY,y+margin,y+d-margin)};
  return {kind:'facade-banner',buildingId:b.id,side,rotation:({north:Math.PI,east:Math.PI/2,south:0,west:-Math.PI/2})[side],position:point};
}
export function buildingEntranceDoor(b){
  if(!b?.door||!b.entity||!Array.isArray(b.units))return null;
  const x=Math.floor(b.door.x-b.entity.x),y=Math.floor(b.door.y-b.entity.y);
  for(const unit of b.units){if(unit.z!==0)continue;const dx=x-unit.x,dy=y-unit.y;if(Math.abs(dx)+Math.abs(dy)!==1)continue;
    const bit=dx===0?(dy<0?1:2):(dx<0?4:8);return {unitId:unit.id,bit};
  }
  return null;
}
export function buildingInteriorEntrance(b){
  const doorway=buildingEntranceDoor(b),unit=doorway&&b.units.find(candidate=>candidate.id===doorway.unitId);
  if(!unit)return null;
  const x=b.entity.x+unit.x+.5,y=b.entity.y+unit.y+.5,centerX=b.entity.x+b.width/2,centerY=b.entity.y+b.depth/2,dx=centerX-x,dy=centerY-y,distance=Math.hypot(dx,dy)||1;
  return {x:x+dx/distance*.35,y:y+dy/distance*.35,z:0};
}
