import {initializeColors} from './city_colors.js';
// Adapted from Brutopolis' inherited surnames, individual traits and house-style catalogue.
// Pure data/helpers keep these features usable both in the worker and the UI.
export const TRAIT_LABELS = { diligence: 'Dedicação', empathy: 'Empatia', honesty: 'Honestidade', skepticism: 'Ceticismo', riskTolerance: 'Tolerância a risco', frugality: 'Frugalidade', ambition: 'Ambição' };
export const HOUSE_STYLES = {
  adobe: { label: 'Alvenaria de barro', wall: 0xd2965a, roof: 0x945c42, roofKind: 'gable' },
  cottage: { label: 'Casa de pedra', wall: 0xc8c8c8, roof: 0x626d70, roofKind: 'hip' },
  timber: { label: 'Chalé de madeira', wall: 0xa8794d, roof: 0x594736, roofKind: 'gable' },
  hacienda: { label: 'Casarão com varanda', wall: 0xf0e6d2, roof: 0xa7684e, roofKind: 'hip' },
  gingerbread: { label: 'Casa caribenha de madeira', wall: 0xe5b597, roof: 0x3d7776, roofKind: 'gable' },
  island_cottage: { label: 'Casa de praia com alpendre', wall: 0xf1d8ae, roof: 0x986247, roofKind: 'hip' },
  shotgun: { label: 'Casa estreita com galeria', wall: 0xd7a9ae, roof: 0x426c73, roofKind: 'gable' },
  coastal_concrete: { label: 'Casa costeira de concreto', wall: 0xb9d1bf, roof: 0x777d77, roofKind: 'flat' },
  chattel_house: { label: 'Casa chattel caribenha', wall: 0xe9bd69, roof: 0x527b79, roofKind: 'gable' },
  colonial_veranda: { label: 'Casa colonial com varanda', wall: 0xf0dfbd, roof: 0x9a5b43, roofKind: 'hip' },
  coral_stone: { label: 'Casa de pedra coralina', wall: 0xd8c5a2, roof: 0x6c7771, roofKind: 'hip' },
  pastel_cottage: { label: 'Casa pastel de ilha', wall: 0x9fc8c1, roof: 0x526c79, roofKind: 'gable' },
  veranda_duplex: { label: 'Sobrado com varanda', wall: 0xd9a78d, roof: 0x526b67, roofKind: 'hip' },
  courtyard_house: { label: 'Casa de pátio tropical', wall: 0xe8d7b7, roof: 0x9b684e, roofKind: 'flat' },
  stilt_house: { label: 'Casa sobre pilotis', wall: 0xd8bb83, roof: 0x496f70, roofKind: 'gable' },
  breezeway_house: { label: 'Casa ventilada de ilha', wall: 0xd2d0ac, roof: 0x65867c, roofKind: 'hip' },
  coral_gable: { label: 'Casa coral com frontão', wall: 0xe8b5a0, roof: 0x6a7776, roofKind: 'gable' },
  tin_roof_cottage: { label: 'Casa de telhado metálico', wall: 0xe3cfaa, roof: 0x677d80, roofKind: 'gable' },
  island_rowhouse: { label: 'Casa geminada caribenha', wall: 0xc7d1a2, roof: 0x8a5c48, roofKind: 'hip' },
  wraparound_veranda: { label: 'Casa com varanda envolvente', wall: 0xf0d9b2, roof: 0x537b73, roofKind: 'hip' },
  art_deco_island: { label: 'Casa art déco tropical', wall: 0xe1c9a7, roof: 0x4f7977, roofKind: 'flat' },
  hillside_villa: { label: 'Vila tropical escalonada', wall: 0xe6d4b2, roof: 0x9a674b, roofKind: 'hip' },
  st_lucia_villa: { label: 'Vila crioula colorida', wall: 0xb4d2bd, roof: 0x9a604b, roofKind: 'gable' },
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
  const caribbean=['gingerbread','island_cottage','shotgun','coastal_concrete','chattel_house','colonial_veranda','coral_stone','pastel_cottage','veranda_duplex','courtyard_house','stilt_house','breezeway_house','coral_gable','tin_roof_cottage','island_rowhouse','wraparound_veranda','art_deco_island','hillside_villa','st_lucia_villa'];
  const pool = type==='super_popular_housing' ? ['shotgun','island_cottage','chattel_house','pastel_cottage','island_rowhouse','coastal_concrete','gingerbread']
    : type==='popular_housing' ? ['gingerbread','shotgun','chattel_house','pastel_cottage','breezeway_house','island_rowhouse','coastal_concrete','coral_gable']
    : type==='popular_luxury_housing' ? ['hacienda','colonial_veranda','veranda_duplex','courtyard_house','art_deco_island','st_lucia_villa','coastal_concrete','wraparound_veranda']
    : type==='luxury_housing' ? ['hacienda','wraparound_veranda','hillside_villa','colonial_veranda','coral_stone','courtyard_house','art_deco_island','st_lucia_villa']
    : [...caribbean,'adobe','cottage','timber','hacienda','modern'];
  return pool[((Math.imul(id + 19, 2654435761) >>> 0) % pool.length)];
}
