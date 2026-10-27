import {initializeColors} from './city_colors.js';
// Adapted from Brutopolis' inherited surnames, individual traits and house-style catalogue.
// Pure data/helpers keep these features usable both in the worker and the UI.
export const TRAIT_LABELS = { diligence: 'Dedicação', empathy: 'Empatia', honesty: 'Honestidade', skepticism: 'Ceticismo', riskTolerance: 'Tolerância a risco', frugality: 'Frugalidade', ambition: 'Ambição' };
export const HOUSE_STYLES = {
  adobe: { label: 'Alvenaria de barro', wall: 0xd2965a, roof: 0x945c42, roofKind: 'gable' },
  cottage: { label: 'Casa de pedra', wall: 0xc8c8c8, roof: 0x626d70, roofKind: 'hip' },
  timber: { label: 'Chalé de madeira', wall: 0xa8794d, roof: 0x594736, roofKind: 'gable' },
  hacienda: { label: 'Casarão com varanda', wall: 0xf0e6d2, roof: 0xa7684e, roofKind: 'hip' },
  modern: { label: 'Fachada contemporânea', wall: 0xd7dfdb, roof: 0x506054, roofKind: 'flat' },
};
export function initializeCharacter(city, citizen) {
  let colorSeed = (Math.imul(citizen.id + 37, 2654435761) ^ city.initialSeed) >>> 0 || 1;
  initializeColors(citizen, () => {
    colorSeed = (Math.imul(colorSeed, 1664525) + 1013904223) >>> 0;
    return colorSeed / 4294967296;
  });
  citizen.traits = Object.freeze(Object.fromEntries(Object.keys(TRAIT_LABELS).map(id => [id, .1 + city.random() * .8])));
  citizen.savingsRate = Math.round((.05 + citizen.traits.frugality * .4) * 100) / 100;
}
export function architectureFor(type, id) {
  const pool = ['super_popular_housing','popular_housing'].includes(type) ? ['adobe','cottage','modern'] : ['popular_luxury_housing','luxury_housing'].includes(type) ? ['hacienda','modern','cottage'] : ['adobe','cottage','timber','hacienda','modern'];
  return pool[((Math.imul(id + 19, 2654435761) >>> 0) % pool.length)];
}
