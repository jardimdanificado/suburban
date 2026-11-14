import {TILE_FLOOR,TILE_HILL,TILE_SAND,TILE_ROAD_GRASS,TILE_ROAD_HILL,TILE_ROAD_SAND} from './world_gen.js';

export const isDirtRoad=tile=>tile===TILE_ROAD_GRASS||tile===TILE_ROAD_HILL||tile===TILE_ROAD_SAND;
export function dirtRoadGround(tile){
  return tile===TILE_ROAD_GRASS?TILE_FLOOR:tile===TILE_ROAD_HILL?TILE_HILL:tile===TILE_ROAD_SAND?TILE_SAND:tile;
}

/** Clip permanent contacts to road cells so a foot crossing the verge stays temporary outside. */
export function permanentRoadContacts(stamps,world){
  const result=[];
  for(const stamp of stamps){
    if(stamp.deposit)continue;
    const c=Math.abs(Math.cos(stamp.angle)),s=Math.abs(Math.sin(stamp.angle));
    const rx=(c*stamp.width+s*stamp.length)/2,rz=(s*stamp.width+c*stamp.length)/2;
    for(let z=Math.max(0,Math.floor(stamp.z-rz));z<=Math.min(world.height-1,Math.floor(stamp.z+rz));z++){
      for(let x=Math.max(0,Math.floor(stamp.x-rx));x<=Math.min(world.width-1,Math.floor(stamp.x+rx));x++){
        const tile=world.getTile?world.getTile(x,z):world.map?.[z*world.width+x];
        if(isDirtRoad(tile))result.push({...stamp,clip:[x,z,x+1,z+1]});
      }
    }
  }
  return result;
}
