// Stable individual skin tones; inheritance is a game mechanic, not a genetic model.
const tones=[0xf5d6c2,0xeac0a5,0xd6a17f,0xbd8260,0x9b6549,0x784a34,0x543427,0x39251f];
function hash(id,seed){let n=(Math.imul((Number(id)||0)+131,2654435761)^(seed||0))>>>0;n^=n>>>16;n=Math.imul(n,2246822519)>>>0;return (n^(n>>>13))>>>0;}
function blend(a,b){let result=0;for(const shift of [16,8,0])result|=Math.round(((a>>shift&255)+(b>>shift&255))/2)<<shift;return result;}
export function skinColorFor(city,id,parentIds=[]){
 const roll=hash(id,city.initialSeed),parents=parentIds.map(parentId=>city.accounts.get(`citizen:${parentId}`)).filter(Boolean).slice(0,2);
 const parentColor=p=>Number.isInteger(p.skinColor)?p.skinColor:tones[hash(p.id,city.initialSeed)%tones.length];
 if(parents.length>=2){const a=parentColor(parents[0]),b=parentColor(parents[1]),choice=roll%10;return choice<8?blend(a,b):choice===8?a:b;}
 if(parents.length===1)return parentColor(parents[0]);
 return tones[roll%tones.length];
}
export function ensureSkinColor(city,c){if(!Number.isInteger(c.skinColor))c.skinColor=skinColorFor(city,c.id,c.parentIds||[]);c.entity.properties.render.color=c.skinColor;return c.skinColor;}
