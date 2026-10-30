export const FUNERAL_SERVICES=Object.freeze({
 iml:{inputs:{sabao:1},minutes:90,skill:'forensics'},
 crematorium:{inputs:{carvao:3},minutes:120,skill:'care'},
});
export const funeralSpec=b=>FUNERAL_SERVICES[b?.type]||null;
