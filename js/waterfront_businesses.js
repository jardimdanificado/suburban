import {TILE_WATER} from './world_gen.js?v=terrain-generation-reset-2-map-default-128';
export const WATERFRONT_BUSINESSES=new Set(['boat_shop','boat_workshop']);
export function waterfrontBerth(world,x,y,width,depth){
 const inspect=(landX,landY,waterX,waterY)=>world.getTile(waterX,waterY)===TILE_WATER?{land:{x:landX,y:landY},berth:{x:waterX,y:waterY}}:null;
 for(let offset=0;offset<width;offset++){const point=inspect(x+offset,y,x+offset,y-1)||inspect(x+offset,y+depth-1,x+offset,y+depth);if(point)return point;}
 for(let offset=0;offset<depth;offset++){const point=inspect(x,y+offset,x-1,y+offset)||inspect(x+width-1,y+offset,x+width,y+offset);if(point)return point;}return null;
}
