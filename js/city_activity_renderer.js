import {activityBadge,activityBadgeCanvas,activityBadgeKey} from './city_activity_badges.js';
import {drawFavoriteSymbol} from './city_party_flags.js';
import {markerPreferences} from './city_symbols.js';
import {surfaceElevation} from './city_terrain.js?v=entrance-retaining-clearance-1';
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

function favoriteGlyphCanvas(glyph,color,background,onReady){
  const canvas=document.createElement('canvas');canvas.width=40;canvas.height=40;const ctx=canvas.getContext('2d');
  if(background){ctx.fillStyle='#18232ddd';ctx.beginPath();ctx.arc(20,20,18,0,Math.PI*2);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke();}
  const redraw=()=>{drawFavoriteSymbol(ctx,glyph,13,13,'#17140f',2);drawFavoriteSymbol(ctx,glyph,11,11,color,2);onReady?.();};
  drawFavoriteSymbol(ctx,glyph,13,13,'#17140f',2,redraw);drawFavoriteSymbol(ctx,glyph,11,11,color,2,redraw);return canvas;
}

/** Favorite markers use the game's 8×8 glyph atlas as depth-tested world sprites. */
export function syncCityFavoriteMarkers(renderer,THREE,city,world){
  const sprites=renderer.cityFavoriteSprites??=new Map(),materials=renderer.cityFavoriteMaterials??=new Map(),active=new Set();
  if(renderer.showFavoriteBadges===false||!city){for(const sprite of sprites.values())sprite.visible=false;return;}
  const preferences=new Map(Object.entries(renderer.cityFavorites?.people||{}));
  const playedId=city.characterGame?.mode==='play'?city.characterGame.citizenId:null;
  if(playedId!=null)preferences.set(String(playedId),markerPreferences(city.characterGame.marker));
  for(const [rawId,pref]of preferences){
    const citizen=city.society.citizen(Number(rawId)),entity=citizen?.entity;
    const played=Number(rawId)===playedId;
    if(!entity||entity.destroyed||!played&&(citizen.indoorLocation||citizen.ridingVehicleId))continue;
    if(Number.isFinite(renderer.renderedMinTx)&&(entity.x<renderer.renderedMinTx-2||entity.x>renderer.renderedMaxTx+2||entity.y<renderer.renderedMinTy-2||entity.y>renderer.renderedMaxTy+2))continue;
    if(renderer.isFirstPersonActive?.()&&Number(entity.id)===Number(renderer.fpEntityId))continue;
    const {icon:glyph,color,background}=markerPreferences(pref),key=`${glyph}:${color}:${background}`;
    let material=materials.get(key);
    if(!material){let texture;const canvas=favoriteGlyphCanvas(glyph,color,background,()=>{if(texture)texture.needsUpdate=true;});texture=new THREE.CanvasTexture(canvas);texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;material=new THREE.SpriteMaterial({map:texture,transparent:true,alphaTest:.05,depthTest:true,depthWrite:false});materials.set(key,material);}
    let sprite=sprites.get(entity.id);if(!sprite){sprite=new THREE.Sprite(material);sprite.renderOrder=36;renderer.scene.add(sprite);sprites.set(entity.id,sprite);}
    sprite.visible=true;sprite.material=material;
    const offset=renderer._citizenRenderOffsets?.get(entity.id),location=citizen.indoorLocation,point=location?.position||citizen._renderIndoorPosition,x=(point?.x??entity.x)+(offset?.x||0),z=(point?.y??entity.y)+(offset?.y||0),building=location&&city.building(location.buildingId),surface=(location&&building?building.terrain?.base??surfaceElevation(world,x,z):surfaceElevation(world,x,z))+(point?.z||0),zoom=renderer.zoom||1,size=Math.max(.85,Math.min(2,.4/zoom));
    const compact=played&&renderer.isThirdPersonActive?.(),markerSize=compact ? .28 : size;
    sprite.scale.set(markerSize,markerSize,1);sprite.position.set(x,surface+(compact?1.45:2.05),z);active.add(entity.id);
  }
  for(const [id,sprite]of sprites)if(!active.has(id))sprite.visible=false;
  if(materials.size>128){const used=new Set([...sprites.values()].filter(sprite=>sprite.visible).map(sprite=>sprite.material));for(const [key,material]of materials)if(!used.has(material)){material.map?.dispose();material.dispose();materials.delete(key);}}
}
