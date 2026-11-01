import {initializeColors} from './city_colors.js';
const CARIBBEAN_FORMS=[
  {id:'gingerbread',label:'Renda gingerbread',motif:'gingerbread',roofKind:'gable'},
  {id:'chattel',label:'Casa chattel elevada',motif:'chattel',roofKind:'gable'},
  {id:'shotgun',label:'Galeria shotgun',motif:'shotgun',roofKind:'gable'},
  {id:'stilt',label:'Casa de pilotis',motif:'stilt',roofKind:'hip'},
  {id:'coral',label:'Pedra coralina',motif:'coral',roofKind:'hip'},
  {id:'breeze',label:'Blocos de brisa',motif:'breeze',roofKind:'flat'},
  {id:'colonial',label:'Varanda colonial',motif:'colonial',roofKind:'hip'},
  {id:'art_deco',label:'Art déco tropical',motif:'art_deco',roofKind:'flat'},
  {id:'courtyard',label:'Pátio caribenho',motif:'courtyard',roofKind:'flat'},
  {id:'tin',label:'Telha metálica insular',motif:'tin',roofKind:'gable'},
];
const CARIBBEAN_PALETTES=[
  {id:'laguna',label:'Azul-laguna',wall:0x76b9b3,roof:0x386f73,accent:0xf1d8a6,trim:0xffedc9},
  {id:'goiaba',label:'Rosa-goiaba',wall:0xe7a39b,roof:0x8d4e56,accent:0xf0ca83,trim:0xffe3cf},
  {id:'manga',label:'Manga madura',wall:0xe7bd67,roof:0x557d78,accent:0xc86f55,trim:0xffedbd},
  {id:'hibisco',label:'Hibisco coral',wall:0xd77969,roof:0x496e72,accent:0xf0c985,trim:0xffe2bd},
  {id:'menta',label:'Menta costeira',wall:0xb4d3ad,roof:0x586f66,accent:0xd98870,trim:0xf4e5bd},
];
const CARIBBEAN_ARCHITECTURE=Object.fromEntries(CARIBBEAN_FORMS.flatMap(form=>CARIBBEAN_PALETTES.map(palette=>[
  `caribe_${form.id}_${palette.id}`,
  {label:`${form.label} · ${palette.label}`,wall:palette.wall,roof:palette.roof,accent:palette.accent,trim:palette.trim,roofKind:form.roofKind,motif:form.motif},
])));
const CARIBBEAN_ARCHITECTURE_IDS=Object.keys(CARIBBEAN_ARCHITECTURE);
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
  ...CARIBBEAN_ARCHITECTURE,
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
  const popular=['super_popular_housing','popular_housing'].includes(type),luxury=['popular_luxury_housing','luxury_housing'].includes(type);
  const legacyPool=popular?caribbean.filter(style=>!['hacienda','hillside_villa','art_deco_island'].includes(style)):luxury?caribbean.filter(style=>!['shotgun','chattel_house','stilt_house'].includes(style)):caribbean;
  const pool=[...legacyPool,...CARIBBEAN_ARCHITECTURE_IDS,...(popular?['adobe','cottage']:luxury?['hacienda','art_deco_island','modern']:['adobe','cottage','timber','hacienda','modern'])];
  return pool[((Math.imul(id + 19, 2654435761) >>> 0) % pool.length)];
}
