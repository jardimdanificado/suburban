export const COLOR_PALETTE=Object.freeze([
 ['vermelho','#bd4545'],['azul','#467cc1'],['verde','#479461'],['amarelo','#dfbf4b'],['laranja','#d78b44'],['roxo','#9164b7'],['rosa','#d78bb1'],['turquesa','#4da8a3'],['branco','#e9e5da'],['preto','#34383e'],['cinza','#90999e'],['marrom','#966d4d'],['bege','#cbb991'],['vinho','#803f55'],['azul-marinho','#344e79'],['verde-oliva','#828d48'],['coral','#df7966'],['lilás','#b3a0d5'],['creme','#e1d4ae'],['ciano','#5fb8d2']
].map(([name,hex])=>Object.freeze({name,hex})));
export const normalizeColor=value=>{if(Number.isInteger(value)&&value>=0&&value<=0xffffff)return `#${value.toString(16).padStart(6,'0')}`;return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():null;};
export function colorName(value){const hex=normalizeColor(value);return COLOR_PALETTE.find(c=>c.hex===hex)?.name||hex||'Sem cor registrada';}
export function initializeColors(c){
 if(c.colorPreferences)return;
 let seed=(Math.imul(c.id+37,2654435761)>>>0)||1;const prefs={};
 for(const {hex}of COLOR_PALETTE){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;prefs[hex]=((seed>>>0)%201-100)/100;}
 c.colorPreferences=Object.freeze(prefs);
}
const colorWeights=new Map();
export function colorAffinity(c,value){
 const hex=normalizeColor(value);if(!c||!hex)return 0;initializeColors(c);if(c.colorPreferences[hex]!=null)return c.colorPreferences[hex];
 let weights=colorWeights.get(hex);
 if(!weights){const rgb=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)),target=rgb(hex),nearest=COLOR_PALETTE.map(p=>({hex:p.hex,d:rgb(p.hex).reduce((n,v,i)=>n+(v-target[i])**2,0)})).sort((a,b)=>a.d-b.d).slice(0,3),total=nearest.reduce((n,p)=>n+1/(p.d+100),0);weights=nearest.map(p=>({hex:p.hex,weight:1/(p.d+100)/total}));colorWeights.set(hex,weights);}
 return weights.reduce((n,p)=>n+c.colorPreferences[p.hex]*p.weight,0);
}
export function favoriteColors(c){initializeColors(c);return [...COLOR_PALETTE].sort((a,b)=>colorAffinity(c,b.hex)-colorAffinity(c,a.hex));}
export function factoryColors(b){return b.paintPalette??=Array.from({length:4},(_,i)=>COLOR_PALETTE[(Math.imul(b.id+7,13)+i*7)%COLOR_PALETTE.length].hex);}
export function buildingColor(b){return b?.wallColor??b?.architectureColor??b?.color;}
