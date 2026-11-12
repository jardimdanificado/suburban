import {TILE_WATER} from './world_gen.js?v=terrain-generation-reset-2-map-default-128';
import {canStep,terrainWalkable} from './city_terrain.js?v=entrance-retaining-clearance-1';
import {BOAT_CLASSES} from './boat_types.js?v=local-sea-travel-2';
export {BOAT_CLASSES} from './boat_types.js?v=local-sea-travel-2';

const DIRS=[[1,0],[0,1],[-1,0],[0,-1]],idx=(x,y,w)=>y*w+x;
const tilePoint=(index,w)=>({x:index%w+.5,y:Math.floor(index/w)+.5});

function landSearch(city,start){
  const{width:w,height:h}=city.world,total=w*h,sx=Math.floor(start.x),sy=Math.floor(start.y);
  if(sx<0||sy<0||sx>=w||sy>=h||!terrainWalkable(city.world,sx,sy))return null;
  const startIndex=idx(sx,sy,w),seen=new Uint8Array(total),previous=new Int32Array(total);previous.fill(-1);
  const queue=new Int32Array(total),shore=[];let head=0,tail=0;seen[startIndex]=1;queue[tail++]=startIndex;
  while(head<tail){const current=queue[head++],x=current%w,y=Math.floor(current/w);let berth=-1;
    for(const[dx,dy]of DIRS){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const next=idx(nx,ny,w),tile=city.world.getTile(nx,ny);
      if(tile===TILE_WATER){if(berth<0)berth=next;continue;}
      if(seen[next]||!city.walkable(nx,ny)||!canStep(city.world,x,y,nx,ny))continue;seen[next]=1;previous[next]=current;queue[tail++]=next;
    }
    if(berth>=0)shore.push({land:current,water:berth});
  }
  return{shore,previous,startIndex};
}

function landPath(search,end){const path=[];for(let at=end;at>=0;at=search.previous[at]){path.push(at);if(at===search.startIndex)break;}if(path.at(-1)!==search.startIndex)return null;path.reverse();return path;}

function seaPath(city,sourceShores,targetShores){
  const{width:w,height:h}=city.world,total=w*h;
  const seen=new Uint8Array(total),previous=new Int32Array(total),source=new Int32Array(total);previous.fill(-1);source.fill(-1);const queue=new Int32Array(total);let head=0,tail=0;
  for(let i=0;i<sourceShores.length;i++){const cell=sourceShores[i].water;if(seen[cell])continue;seen[cell]=1;source[cell]=i;queue[tail++]=cell;}
  while(head<tail){const current=queue[head++];if(targetShores.has(current)){const path=[];for(let at=current;at>=0;at=previous[at]){path.push(at);if(previous[at]<0)break;}path.reverse();return{path,sourceIndex:source[current]};}
    const x=current%w,y=Math.floor(current/w);for(const[dx,dy]of DIRS){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const next=idx(nx,ny,w);if(seen[next]||city.world.getTile(nx,ny)!==TILE_WATER)continue;seen[next]=1;previous[next]=current;source[next]=source[current];queue[tail++]=next;}
  }return null;
}

export function findBoatPath(city,start,goal){
  const revision=`${city.world.revision||0}:${city.structureRevision||0}:${city.obstacleRevision||0}:${city.occupied.size}`;
  if(city._boatPathCacheRevision!==revision){city._boatPathCacheRevision=revision;city._boatPathCache=new Map();}
  const citizen=start.properties?.citizen,shipment=citizen?.deliveryId&&city.logistics?.shipments.find(item=>item.id===citizen.deliveryId),required=Math.max(1,citizen?.deliveryLoad||start.properties?.vehicle?.ferryLoad||shipment?.quantity||1);
  const fleetKey=[...(city.vehicles?.units?.values?.()||[])].filter(v=>v.boatClass).map(v=>`${v.id},${Math.floor(v.x)},${Math.floor(v.y)},${v.active},${v.worldFleetReserved},${v.driverId},${v.transportCitizenId},${v.scrapped}`).join(';');
  const key=`${fleetKey}:${Math.floor(start.x)},${Math.floor(start.y)}:${Math.floor(goal.x)},${Math.floor(goal.y)}:${required}`;
  if(city._boatPathCache.has(key)){const route=city._boatPathCache.get(key);return route===null?null:route.slice();}
  const remember=route=>{const limit=Math.max(256,Math.min(2048,(city.citizens?.length||128)*2));if(city._boatPathCache.size>=limit)city._boatPathCache.delete(city._boatPathCache.keys().next().value);city._boatPathCache.set(key,route);return route===null?null:route.slice();};
  const startTileX=Math.floor(start.x),startTileY=Math.floor(start.y),alreadyAfloat=city.world.getTile(startTileX,startTileY)===TILE_WATER;
  const from=alreadyAfloat
    ?{shore:[{land:-1,water:idx(startTileX,startTileY,city.world.width)}],previous:null,startIndex:-1}
    :landSearch(city,start),to=landSearch(city,goal);
  if(!from||!to||!from.shore.length||!to.shore.length)return remember(null);
  const available=[...(city.vehicles?.units?.values?.()||[])].filter(v=>v.boatClass&&v.active&&!v.scrapped&&!v.worldFleetReserved&&!v.driverId&&!v.transportCitizenId&&BOAT_CLASSES[v.boatClass].capacity>=required);
  if(!alreadyAfloat)from.shore=from.shore.filter(shore=>available.some(v=>{const point=tilePoint(shore.water,city.world.width);return Math.hypot(v.x-point.x,v.y-point.y)<=1.5;}));
  if(!from.shore.length)return remember(null);
  const destinations=new Set(to.shore.map(entry=>entry.water)),sea=seaPath(city,from.shore,destinations);if(!sea)return remember(null);
  const sourceShore=Number.isInteger(sea.sourceIndex)&&sea.sourceIndex>=0?from.shore[sea.sourceIndex]:null,water=sea.path;
  if(!sourceShore||!water?.length)return remember(null);
  const first=sourceShore.land<0?[]:landPath(from,sourceShore.land),lastTarget=to.shore.find(candidate=>candidate.water===water.at(-1)),last=lastTarget&&landPath(to,lastTarget.land);if(!first||!last)return remember(null);
  const best={first,water,last};
  const boardingPoint=tilePoint(best.water[0],city.world.width),kind=alreadyAfloat?citizen?.boatClass:available.find(v=>Math.hypot(v.x-boardingPoint.x,v.y-boardingPoint.y)<=1.5&&BOAT_CLASSES[v.boatClass].maxWaterTiles>=best.water.length)?.boatClass;
  if(!kind)return remember(null);
  const points=[];for(const index of best.first.slice(1))points.push(tilePoint(index,city.world.width));
  for(const index of best.water)points.push({...tilePoint(index,city.world.width),boatClass:kind});
  // The route reaches land from a water tile, so include the shoreline tile
  // itself before following the path back toward the destination.
  for(const index of best.last.reverse())points.push(tilePoint(index,city.world.width));
  return remember(points);
}
