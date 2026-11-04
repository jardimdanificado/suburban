const GRID_STRIDE=2048;
const DIAGONAL_THRESHOLD=Math.SQRT2-1;

/** Preserve the renderer's nearest-octant grouping, including Math.round ties. */
export function crowdDirection(dx,dy){
  const x=Math.abs(dx),y=Math.abs(dy),threshold=DIAGONAL_THRESHOLD;
  const boundaryTolerance=Number.EPSILON*4*Math.max(x,y);
  if(Math.abs(y-x*threshold)<=boundaryTolerance||Math.abs(x-y*threshold)<=boundaryTolerance){
    return Math.round(Math.atan2(dy,dx)/(Math.PI/4));
  }
  if(dx<0){
    if(dy<0){if(y<x*threshold)return -4;if(x<=y*threshold)return -2;return -3;}
    if(y<=x*threshold)return 4;
    if(x<y*threshold)return 2;
    return 3;
  }
  if(dy<0){if(y<=x*threshold)return 0;if(x<y*threshold)return -2;return -1;}
  if(y<x*threshold)return 0;
  if(x<=y*threshold)return 2;
  return 1;
}

/** Numeric keys avoid allocating a cell-direction string for each moving citizen. */
export function crowdGroupKey(tileX,tileY,direction){
  if(!Number.isInteger(tileX)||!Number.isInteger(tileY)||tileX<0||tileY<0||tileX>=GRID_STRIDE||tileY>=GRID_STRIDE){
    return `${tileX},${tileY},${direction}`;
  }
  return (tileX*GRID_STRIDE+tileY)*9+direction+4;
}
