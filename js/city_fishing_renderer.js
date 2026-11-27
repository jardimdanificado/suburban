import {surfaceElevation} from './city_terrain.js?v=entrance-retaining-clearance-1';
import {furnitureModel} from './city_furniture_models.js?v=no-beach-towels-1';

export function fishingRodModel(){return null;}
function remove(renderer,group){renderer.scene.remove(group);group.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});}
export function syncCityFishing(renderer){
 if(!renderer?.fishingVisuals?.size)return;
 for(const [id,group]of renderer.fishingVisuals){remove(renderer,group);renderer.fishingVisuals.delete(id);}
}
