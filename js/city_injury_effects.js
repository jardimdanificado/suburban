/** Temporary penalties are calculated from wounds, never written into base skills. */
export function injuryMovementFactor(c){
  let factor=1;for(const wound of c?.combatInjuries||[])if(['perna','pé'].includes(wound.region))factor-=wound.severity*.035;else if(wound.region==='costas')factor-=wound.severity*.012;
  return Math.max(.35,factor);
}
export function injuryLoadFactor(c){
  let factor=1;for(const wound of c?.combatInjuries||[])if(['costas','tronco'].includes(wound.region))factor-=wound.severity*.06;else if(['braço','mão'].includes(wound.region))factor-=wound.severity*.025;
  return Math.max(.2,factor);
}
export function injuryWorkFactor(c){
  let factor=1;for(const wound of c?.combatInjuries||[])if(['braço','mão'].includes(wound.region))factor-=wound.severity*.035;else if(['cabeça','costas','tronco'].includes(wound.region))factor-=wound.severity*.025;
  return Math.max(.2,factor);
}
export function injuredCarryCapacity(c,base){return Math.max(1,Math.floor(base*injuryLoadFactor(c)));}
