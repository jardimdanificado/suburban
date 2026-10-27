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
