import {terrainWalkable} from './city_terrain.js?v=entrance-retaining-clearance-1';
import {TILE_WATER} from './world_gen.js?v=terrain-generation-reset-2-map-default-128';
export function mooringPosition(world,berth,occupied=[],radius=1){
 if(!world?.getTile||!berth)return null;
 const queue=[{x:Math.floor(berth.x),y:Math.floor(berth.y)}],seen=new Set();
 for(let head=0;head<queue.length;head++){
  const p=queue[head],key=`${p.x},${p.y}`;if(seen.has(key))continue;seen.add(key);
  if(p.x<0||p.y<0||p.x>=world.width||p.y>=world.height||world.getTile(p.x,p.y)!==TILE_WATER)continue;
  const point={x:p.x+.5,y:p.y+.5};
  if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>terrainWalkable(world,p.x+dx,p.y+dy))&&Math.hypot(point.x-berth.x-.5,point.y-berth.y-.5)>=radius+2&&occupied.every(other=>Math.hypot(point.x-other.x,point.y-other.y)>=radius+(other.radius||1)+1))return point;
  for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]])queue.push({x:p.x+dx,y:p.y+dy});
 }return null;
}
