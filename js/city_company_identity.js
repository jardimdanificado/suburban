import {makePartyFlag,drawPartyFlag} from './city_party_flags.js';

/** Company marks share the flag catalog, with a private deterministic random stream. */
export function companyLogo(city,b){
 if(b.logo)return b.logo;
 let seed=2166136261;
 for(const ch of `${city.initialSeed??0}:company:${b.id}`)seed=Math.imul(seed^ch.charCodeAt(0),16777619)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const name=b.entity.properties.name,subject={name,short:name,slogan:'',number:null};
 let logo;
 do{logo=makePartyFlag({random},b.id,[],subject);}while(!logo.emblems.length);
 b.logo=logo;return logo;
}

export function renderCompanyLogo(p,logo,width=Math.min(p.w,150)){
 const height=width*76/120;
 if(p.visible(height+8))drawPartyFlag(p.ui.ctx,logo,p.x,p.y,width,height);
 p.y+=height+8;
}
