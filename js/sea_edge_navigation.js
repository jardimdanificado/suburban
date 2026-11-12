import {TILE_WATER} from './world_gen.js?v=terrain-generation-reset-2-map-default-128';

/** Cardinal water routes from a harbour to the nearest navigable map edge. */
export function createSeaEdgeNavigation(world){
  if(!world?.getTile||!Number.isInteger(world.width)||!Number.isInteger(world.height))return null;
  const {width,height}=world,total=width*height,nextToEdge=new Int32Array(total),queue=new Int32Array(total);nextToEdge.fill(-2);let head=0,tail=0;
  const seed=(x,y)=>{const index=y*width+x;if(world.getTile(x,y)!==TILE_WATER||nextToEdge[index]!==-2)return;nextToEdge[index]=-1;queue[tail++]=index;};
  for(let x=0;x<width;x++){seed(x,0);if(height>1)seed(x,height-1);}
  for(let y=1;y<height-1;y++){seed(0,y);if(width>1)seed(width-1,y);}
  while(head<tail){const index=queue[head++],x=index%width,y=Math.floor(index/width);for(const[dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const next=ny*width+nx;if(nextToEdge[next]!==-2||world.getTile(nx,ny)!==TILE_WATER)continue;nextToEdge[next]=index;queue[tail++]=next;}}
  const indexAt=point=>{const x=Math.floor(point?.x),y=Math.floor(point?.y);return !Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height?-1:y*width+x;};
  return {reachable(point){const index=indexAt(point);return index>=0&&nextToEdge[index]!==-2;},pathFrom(point){const start=indexAt(point);if(start<0||nextToEdge[start]===-2)return null;const path=[];for(let at=start;at>=0;at=nextToEdge[at]){path.push({x:at%width+.5,y:Math.floor(at/width)+.5});if(nextToEdge[at]===-1)break;}return path;}};
}
