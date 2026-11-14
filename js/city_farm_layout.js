import {FARM_CROPS} from './farm_crop_catalog.js';
import {NATURAL_PLANTS} from './plant_catalog.js';

/** Large tree and palm silhouettes need an outdoor orchard, including cuttings. */
export function canFarmVertically(crop){
 const spec=FARM_CROPS[crop];if(!spec)return false;
 const plant=NATURAL_PLANTS[spec.plantSpecies];
 return !spec.perennial&&!(plant&&(plant.wood>0||['tree','palm','fan_palm'].includes(plant.form)||plant.tree&&!plant.form));
}
export const isVerticalFarm=b=>b?.type==='farm'&&b.constructionKind==='building';
export const farmSiteType=(type,kind)=>type==='farm'&&kind==='building'?'building':type;
export function farmCells(b){return b.units.filter(u=>!['bathroom','dining','circulation'].includes(u.roomType));}
export function plannedFarmArea(width,depth,floors=1,kind='open-air'){
 return Math.max(0,kind==='building'?(width-1)*depth*floors-1:width*depth-2);
}
