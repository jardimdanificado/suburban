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

export function symbolIndex(value){
 if(Number.isInteger(value))return value>=0&&value<CITY_SYMBOLS.length?value:-1;
 if(typeof value==='string')return CITY_SYMBOLS.indexOf(value);
 return -1;
}

export function initializeSymbols(c,random){
 if(!c)return;
 if(Array.isArray(c.favoriteSymbols)&&c.favoriteSymbols.length){
  if(!Array.isArray(c.dislikedSymbols))c.dislikedSymbols=Object.freeze([]);
  return;
 }
 if(!random){
  let seed=(Math.imul((c.id||0)+53,2654435761)>>>0)||1;
  random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 }
 const total=CITY_SYMBOLS.length;
 const favCount=Math.min(total,2+Math.floor(random()*3));
 const favorites=[];
 while(favorites.length<favCount){
  const idx=Math.floor(random()*total);
  if(!favorites.includes(idx))favorites.push(idx);
 }
 const dislikedCount=Math.min(total-favorites.length,2+Math.floor(random()*3));
 const disliked=[];
 while(disliked.length<dislikedCount){
  const idx=Math.floor(random()*total);
  if(!favorites.includes(idx)&&!disliked.includes(idx))disliked.push(idx);
 }
 c.favoriteSymbols=Object.freeze(favorites);
 c.dislikedSymbols=Object.freeze(disliked);
}

export function favoriteSymbols(c){
 if(!c)return [];
 initializeSymbols(c);
 return c.favoriteSymbols.map(index=>({index,skin:CITY_SYMBOLS[index]}));
}

export function symbolAffinity(c,value){
 const index=symbolIndex(value);
 if(!c||index<0)return 0;
 initializeSymbols(c);
 const favPos=c.favoriteSymbols.indexOf(index);
 if(favPos>=0)return Math.max(.75,1-favPos*.08);
 if(c.dislikedSymbols?.includes(index))return -.8;
 const hash=Math.imul((c.id||0)+19,(index+1)*2654435761)>>>0;
 return ((hash%71)-35)/100;
}
