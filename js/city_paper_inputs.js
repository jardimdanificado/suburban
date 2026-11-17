/** Hemp and wood are alternative feedstocks, never simultaneous requirements. */
export function paperMillInputs(city,b){
 const legal=city.substances?.law('canhamo')?.regime!=='prohibited';
 const available=legal&&((b.inventory.canhamo||0)>=4||(b.inventory.madeira||0)<3&&city.economy.businesses.some(s=>s!==b&&(s.inventory.canhamo||0)>=4));
 return available?{canhamo:4}:{madeira:3};
}
