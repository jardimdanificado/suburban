import {ASSET_DATA} from './assets_data.js';

export const LEGACY_GLYPH_COUNT=256;
// Keep legacy favorite indices stable when adding tiles from the flag catalog.
export const CITY_SYMBOLS=Object.freeze([
 ...Array.from({length:LEGACY_GLYPH_COUNT},(_,index)=>`favorite-glyph:${index}`),
 ...ASSET_DATA.filter(asset=>/\.png$/i.test(asset.filename)).map(asset=>asset.filename)
]);
export function legacyGlyphIndex(skin){
 const match=/^favorite-glyph:(\d+)$/.exec(skin);
 return match&&Number(match[1])<LEGACY_GLYPH_COUNT?Number(match[1]):null;
}

export function markerPreferences(value={}){
 return {
  icon:Number.isInteger(value?.icon)&&value.icon>=0&&value.icon<CITY_SYMBOLS.length?value.icon:42,
  color:typeof value?.color==='string'&&/^#[0-9a-f]{6}$/i.test(value.color)?value.color:'#ffd84d',
  background:value?.background!==false
 };
}
