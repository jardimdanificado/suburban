import {activityBadge,activityBadgeCanvas,activityBadgeKey} from './city_activity_badges.js';
import {surfaceElevation} from './city_terrain.js?v=public-cleaning-1';
export function syncCityActivityBadges(renderer,THREE,entities,world){
  const sprites=renderer.cityActivitySprites??=new Map(),materials=renderer.cityActivityMaterials??=new Map(),active=new Set();
  if(renderer.showActivityBadges===false){for(const sprite of sprites.values())renderer.scene.remove(sprite);sprites.clear();return;}
  for(const e of entities){const c=e.properties?.citizen;if(!c||e.destroyed)continue;
    if(Number.isFinite(renderer.renderedMinTx)&&(e.x<renderer.renderedMinTx-3||e.x>renderer.renderedMaxTx+3||e.y<renderer.renderedMinTy-3||e.y>renderer.renderedMaxTy+3))continue;
    const badge=activityBadge(c);if(!badge)continue;active.add(e.id);const key=activityBadgeKey(badge);let material=materials.get(key);
    if(!material){let texture;const canvas=activityBadgeCanvas(badge,()=>{if(texture)texture.needsUpdate=true;});texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false});materials.set(key,material);}
    let sprite=sprites.get(e.id);if(!sprite){sprite=new THREE.Sprite(material);sprite.scale.set(.85,.85,1);sprite.renderOrder=35;renderer.scene.add(sprite);sprites.set(e.id,sprite);}sprite.material=material;const size=Math.max(.85,Math.min(2,.4/(renderer.zoom||1)));sprite.scale.set(size,size,1);sprite.position.set(e.x,surfaceElevation(world,e.x,e.y)+2.05,e.y);
  }
  for(const [id,sprite]of sprites)if(!active.has(id)){renderer.scene.remove(sprite);sprites.delete(id);}
  // A map regeneration must not leave textures from every former party resident.
  if(materials.size>64){const used=new Set([...sprites.values()].map(s=>s.material));for(const [key,material]of materials)if(!used.has(material)){material.map?.dispose();material.dispose();materials.delete(key);}}
}
