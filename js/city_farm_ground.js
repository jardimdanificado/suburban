import {farmSoilTile} from './world_gen.js?v=terrain-generation-reset-2-map-default-128';
export function farmSurfaceTile(tile,inFarm){return inFarm?(farmSoilTile(tile)??tile):tile;}
export function cultivateFarmTerrain(city,b){
 if(b.type!=='farm')return;
 for(let y=Math.floor(b.entity.y);y<Math.ceil(b.entity.y+b.depth);y++)for(let x=Math.floor(b.entity.x);x<Math.ceil(b.entity.x+b.width);x++){const old=city.world.getTile(x,y),soil=farmSoilTile(old);if(soil!=null&&soil!==old)city.world.setTile(x,y,soil);}
 b.farmSoilReady=true;
}
