export const CITY_FLOOR_HEIGHT=1.8;
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
export function buildingEntranceDoor(b){
  if(!b?.door||!b.entity||!Array.isArray(b.units))return null;
  const x=Math.floor(b.door.x-b.entity.x),y=Math.floor(b.door.y-b.entity.y);
  for(const unit of b.units){if(unit.z!==0)continue;const dx=x-unit.x,dy=y-unit.y;if(Math.abs(dx)+Math.abs(dy)!==1)continue;
    const bit=dx===0?(dy<0?1:2):(dx<0?4:8);return {unitId:unit.id,bit};
  }
  return null;
}
