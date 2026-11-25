export const COLOR_PALETTE=Object.freeze([
 ['vermelho','#bd4545'],['azul','#467cc1'],['verde','#479461'],['amarelo','#dfbf4b'],['laranja','#d78b44'],['roxo','#9164b7'],['rosa','#d78bb1'],['turquesa','#4da8a3'],['branco','#e9e5da'],['preto','#34383e'],['cinza','#90999e'],['marrom','#966d4d'],['bege','#cbb991'],['vinho','#803f55'],['azul-marinho','#344e79'],['verde-oliva','#828d48'],['coral','#df7966'],['lilás','#b3a0d5'],['creme','#e1d4ae'],['ciano','#5fb8d2']
].map(([name,hex])=>Object.freeze({name,hex})));
export const normalizeColor=value=>{if(Number.isInteger(value)&&value>=0&&value<=0xffffff)return `#${value.toString(16).padStart(6,'0')}`;return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():null;};
export function colorName(value){const hex=normalizeColor(value);return COLOR_PALETTE.find(c=>c.hex===hex)?.name||hex||'Sem cor registrada';}
const rgb=value=>[1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
function affinityFromAnchors(anchors,hex){
 const target=rgb(hex);
 return Math.max(-.75,...anchors.map(anchor=>{
  const distance=Math.sqrt(rgb(anchor.hex).reduce((n,value,i)=>n+(value-target[i])**2,0));
  return Math.max(-.75,anchor.weight-distance/240);
 }));
}
export function initializeColors(c,random){
 if(c.colorPreferences){
  if(!c.dislikedColors){const leastLiked=Object.entries(c.colorPreferences).sort((a,b)=>a[1]-b[1]).slice(0,3);c.dislikedColors=Object.freeze(leastLiked.map(([hex])=>hex));c.colorPreferences=Object.freeze({...c.colorPreferences,...Object.fromEntries(leastLiked.map(([hex,value])=>[hex,Math.min(value,-.82)]))});}
  return;
 }
 if(!random){let seed=(Math.imul((c.id||0)+37,2654435761)>>>0)||1;random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
 const count=1+Math.floor(random()*3),anchors=[],available=[...COLOR_PALETTE];
 while(anchors.length<count){const color=available.splice(Math.floor(random()*available.length),1)[0];anchors.push({hex:color.hex,weight:.88+random()*.12});}
 const dislikedCount=2+Math.floor(random()*4),disliked=[],remaining=available.filter(color=>!anchors.some(anchor=>anchor.hex===color.hex));
 while(disliked.length<dislikedCount)disliked.push(remaining.splice(Math.floor(random()*remaining.length),1)[0].hex);
 c.colorPreferenceAnchors=anchors;
 c.dislikedColors=Object.freeze(disliked);
 c.colorPreferences=Object.freeze(Object.fromEntries(COLOR_PALETTE.map(({hex})=>[
  hex,anchors.some(anchor=>anchor.hex===hex)?Math.max(.78,...anchors.filter(anchor=>anchor.hex===hex).map(anchor=>anchor.weight)):
   disliked.includes(hex)?-.82-random()*.18:Math.max(-.48,Math.min(.42,affinityFromAnchors(anchors,hex)-.48))
 ])));
}
export function dislikesColor(c,value){return colorAffinity(c,value)<=-.65;}
const colorWeights=new Map();
export function colorAffinity(c,value){
 const hex=normalizeColor(value);if(!c||!hex)return 0;initializeColors(c);if(c.colorPreferences[hex]!=null)return c.colorPreferences[hex];
 let weights=colorWeights.get(hex);
 if(!weights){const target=rgb(hex),nearest=COLOR_PALETTE.map(p=>({hex:p.hex,d:rgb(p.hex).reduce((n,v,i)=>n+(v-target[i])**2,0)})).sort((a,b)=>a.d-b.d).slice(0,3),total=nearest.reduce((n,p)=>n+1/(p.d+100),0);weights=nearest.map(p=>({hex:p.hex,weight:1/(p.d+100)/total}));colorWeights.set(hex,weights);}
 return weights.reduce((n,p)=>n+c.colorPreferences[p.hex]*p.weight,0);
}
export function favoriteColors(c){initializeColors(c);return [...COLOR_PALETTE].sort((a,b)=>colorAffinity(c,b.hex)-colorAffinity(c,a.hex));}
export function factoryColors(b){return b.paintPalette??=Array.from({length:4},(_,i)=>COLOR_PALETTE[(Math.imul(b.id+7,13)+i*7)%COLOR_PALETTE.length].hex);}
export function buildingColor(b){return b?.wallColor??b?.architectureColor??b?.color;}
function rgbToHsl(r,g,b){
 r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;
 if(max===min)return [0,0,l];
 const d=max-min,s=l>.5?d/(2-max-min):d/(max+min);
 let h=max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4;
 return [h/6,s,l];
}
function hslToRgb(h,s,l){
 h=((h%1)+1)%1;
 if(s===0){const v=Math.round(l*255);return [v,v,v];}
 const hue2rgb=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};
 const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
 return [Math.round(hue2rgb(p,q,h+1/3)*255),Math.round(hue2rgb(p,q,h)*255),Math.round(hue2rgb(p,q,h-1/3)*255)];
}
export function pickGraffitiColor(c,random=Math.random){
 if(!c)return 0x222128;
 const ranked=favoriteColors(c),pool=ranked.slice(0,Math.min(6,ranked.length));
 const chosen=pool[Math.floor(random()*pool.length)]||ranked[0];
 if(!chosen?.hex)return 0x222128;
 const [r0,g0,b0]=rgb(chosen.hex),[h0,s0]=rgbToHsl(r0,g0,b0);
 // Map the tagger's preferred hue into vivid spray-paint colors across any lightness.
 for(let attempt=0;attempt<6;attempt++){
  const hueShift=(random()-.5)*.18+(random()<.12?.5:0);
  const sat=Math.max(.58,Math.min(1,s0*.65+.45+(random()-.5)*.22));
  const light=.24+random()*.58;
  const [r,g,b]=hslToRgb(h0+hueShift,sat,light);
  const intColor=(r<<16)|(g<<8)|b;
  if(!dislikesColor(c,`#${intColor.toString(16).padStart(6,'0')}`))return intColor;
 }
 return parseInt(chosen.hex.slice(1),16);
}
