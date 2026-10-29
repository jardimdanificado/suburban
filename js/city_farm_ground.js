import {farmSoilTile} from './world_gen.js?v=furniture-farms-fertilizer-1';
export function cultivateFarmTerrain(city,b){
 if(b.type!=='farm')return;for(const u of b.units){const x=Math.floor(b.entity.x+u.x),y=Math.floor(b.entity.y+u.y),old=city.world.getTile(x,y),soil=farmSoilTile(old);if(soil!=null&&soil!==old)city.world.setTile(x,y,soil);}
 b.farmSoilReady=true;
}
