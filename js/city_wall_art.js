import {makePartyFlag,mutateMunicipalFlag} from './city_party_flags.js';

// Persist the composition, not a canvas. Rendering and save/load keep the same art.
export function ensureWallArtDesign(piece,citySeed=0){
  if(piece.wallDesign)return piece.wallDesign;
  let state=(Math.imul((piece.id||0)+1,2654435761)^(Number(citySeed)||0)^Math.imul((piece.createdAt||0)+1,1013904223))>>>0;
  const city={random:()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;}};
  const identity={name:piece.message||'Arte',short:piece.message||'Arte',slogan:piece.message||'Arte'};
  let design=makePartyFlag(city,piece.id||0,[],identity);
  if(!design.emblems.length)design=mutateMunicipalFlag(city,design,{type:'add-symbol'},identity);
  piece.wallDesign=Object.freeze({...design,emblems:Object.freeze(design.emblems.map(emblem=>Object.freeze({...emblem,backgroundMode:'transparent'})))});return piece.wallDesign;
}
