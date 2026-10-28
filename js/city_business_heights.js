import {INDUSTRIES} from './city_industries.js';

// Extraction sites and agricultural operations use their land horizontally.
const groundOnly=new Set(['farm','quarry','iron_mine','bauxite_mine','clay_pit','sand_pit','forestry','fiber_farm','herb_farm','dairy_farm','poultry','rubber_grove','charcoal','park','bike_rack']);
const commercial=new Set(['bakery','mill','market','greengrocer','builder','carrier','lamp_service','cleaner','waste_collector','recycler','composting','clinic','utility','leisure','popular_refectory']);
const heavyIndustry=new Set(['steel_mill','aluminum_smelter','foundry','glassworks','brickworks','sawmill']);

/** Stable local variation keeps replanning the same plot from changing its budget. */
export function businessFloors(type, seed=0){
 if(groundOnly.has(type)||(!INDUSTRIES[type]&&!commercial.has(type)))return 1;
 let hash=2166136261;for(const ch of `${type}:${seed}`)hash=Math.imul(hash^ch.charCodeAt(0),16777619);
 const roll=(hash>>>0)%100;
 return roll<45?1:roll<85||heavyIndustry.has(type)?2:3;
}

export function businessJobCapacity(type,base,floors){
 if(!base||groundOnly.has(type)||(!INDUSTRIES[type]&&!commercial.has(type)))return base;
 return Math.min(32,base+Math.max(0,floors-1)*Math.max(1,Math.ceil(base/2)));
}
