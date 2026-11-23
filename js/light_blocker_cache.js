// Conservative building boxes used by the night-light occlusion grid.
// Buildings only change position when the city structure changes; terrain can
// change the base height. Rebuild the list only when one of those revisions
// changes, then let NightLighting compare its own texture contents.
import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';

export function cachedLightBlockerBoxes(cache,city,map,getSurfaceElevation,revision=0){
  const token=`${revision}:${city?.structureRevision??0}`;
  if(cache&&cache.city===city&&cache.map===map&&cache.revision===token)return cache.boxes;
  const boxes=[];
  for(const b of city?.buildings||[]){
    const entity=b.entity;
    if(!entity||entity.destroyed||b.constructionKind==='open-air'||b.type==='quarry')continue;
    const x=entity.x,z=entity.y,base=b.terrain?.base??getSurfaceElevation(map,x,z);
    boxes.push({min:[x,base,z],max:[x+b.width,base+(b.floors||1)*CITY_FLOOR_HEIGHT,z+b.depth]});
  }
  // The revision lets NightLighting skip serializing unchanged boxes.
  boxes.revision=token;
  if(cache){cache.city=city;cache.map=map;cache.revision=token;cache.boxes=boxes;}
  return boxes;
}
