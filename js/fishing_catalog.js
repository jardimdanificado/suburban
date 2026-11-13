// Habitat is a game rule: water connected to a map edge is marine.
export const FISH_SPECIES=Object.freeze({
 tilapia:{label:'Tilápia',price:360,salinity:'fresh',zone:'shore'},
 pacu:{label:'Pacu',price:520,salinity:'fresh',zone:'middle'},
 robalo:{label:'Robalo',price:620,salinity:'salt',zone:'shore'},
 cavala:{label:'Cavala',price:580,salinity:'salt',zone:'middle'},
});
export const FISH_GOODS={...Object.fromEntries(Object.entries(FISH_SPECIES).map(([id,{label,price}])=>[id,{label,price}])),vara_pesca:{label:'Vara de pesca',price:2600},file_peixe:{label:'Filé de peixe',price:750},marmita_peixe:{label:'Marmita de peixe',price:1250}};
export const FISHING_RULES=Object.freeze({labor:6,basket:3,stock:6,regrowMinutes:90,rodCatches:80});
