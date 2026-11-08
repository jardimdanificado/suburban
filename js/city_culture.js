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
const PORTUGUESE_COLONIAL_PALETTES=[
  {id:'cal',label:'Cal e azul de azulejo',wall:0xe8dfc9,roof:0x874a38,accent:0x315b78,trim:0xf7edda},
  {id:'ocre',label:'Ocre queimado',wall:0xc48b52,roof:0x754336,accent:0x344e67,trim:0xe4c995},
  {id:'verde',label:'Verde colonial',wall:0x87956d,roof:0x68483b,accent:0x384d43,trim:0xd6c79f},
  {id:'rosa',label:'Rosa antigo',wall:0xc77f78,roof:0x71483f,accent:0x3c526a,trim:0xe5c9ac},
  {id:'amarelo',label:'Amarelo açafrão',wall:0xd8b34e,roof:0x80503b,accent:0x315e79,trim:0xf0d995},
  {id:'azul',label:'Azul caiado',wall:0x7798a5,roof:0x514e4b,accent:0x344d67,trim:0xd7d1bc},
  {id:'terracota',label:'Terracota',wall:0xb8644d,roof:0x493c37,accent:0xd6b66d,trim:0xe1bf9c},
  {id:'violeta',label:'Violeta mineral',wall:0x8b718a,roof:0x51434a,accent:0xd0a35f,trim:0xd8c6ad},
  {id:'cal_cobalto',label:'Cal branca e azul-cobalto',wall:0xf5f1e6,roof:0x874a38,accent:0x245887,trim:0x4b83ae},
  {id:'cal_terracota',label:'Cal branca e terracota',wall:0xf4efe3,roof:0x754336,accent:0xb64f3b,trim:0x934536},
];
const PORTUGUESE_COLONIAL_FORMS=[
  {id:'sobrado',label:'Sobrado de sacadas',roofKind:'hip'},
  {id:'pombalino',label:'Fachada pombalina',roofKind:'flat'},
  {id:'barroco',label:'Portal barroco',roofKind:'mansard'},
  {id:'rural',label:'Casa-grande rural',roofKind:'gable'},
  {id:'quinta',label:'Quinta senhorial',roofKind:'hip'},
  {id:'terrea',label:'Casa térrea urbana',roofKind:'hip'},
  {id:'azulejo',label:'Casa de fachada azulejada',roofKind:'gable'},
  {id:'acores',label:'Casa açoriana',roofKind:'gable'},
  {id:'mercantil',label:'Sobrado mercantil',roofKind:'gable'},
];
const PORTUGUESE_COLONIAL_STYLES=Object.fromEntries(PORTUGUESE_COLONIAL_FORMS.flatMap(form=>PORTUGUESE_COLONIAL_PALETTES.map(palette=>[
  `portuguese_colonial_${form.id}_${palette.id}`,
  {label:`${form.label} · ${palette.label}`,wall:palette.wall,roof:palette.roof,accent:palette.accent,trim:palette.trim,roofKind:form.roofKind,motif:'portuguese_colonial',colonialForm:form.id},
])));
const PORTUGUESE_COLONIAL_PALETTE_IDS=PORTUGUESE_COLONIAL_PALETTES.map(palette=>palette.id);
const DUTCH_COLONIAL_PALETTES=[
  {id:'delft',label:'Azul Delft',wall:0x527997,roof:0x493e39,accent:0xd2b36c,trim:0xe6d9bd},
  {id:'garnet',label:'Vermelho-garnet',wall:0x9d5147,roof:0x483d38,accent:0xe2bf72,trim:0xe2cbb0},
  {id:'mustard',label:'Amarelo mostarda',wall:0xc39b45,roof:0x55463d,accent:0x426b69,trim:0xe4d2ad},
  {id:'malachite',label:'Verde-malaquita',wall:0x55796a,roof:0x443f39,accent:0xc69a5d,trim:0xd7c8aa},
  {id:'coral',label:'Coral de Willemstad',wall:0xc8705c,roof:0x56433d,accent:0x3e6479,trim:0xe7d3b7},
  {id:'indigo',label:'Índigo e areia',wall:0x445d78,roof:0x453c3b,accent:0xc9a35e,trim:0xdac8a8},
];
const DUTCH_COLONIAL_FORMS=[
  {id:'stepped',label:'Frontão escalonado',roofKind:'gable'},
  {id:'neck',label:'Frontão de pescoço',roofKind:'gable'},
  {id:'curved',label:'Frontão curvo caribenho',roofKind:'gable'},
  {id:'straight',label:'Frontão reto oitocentista',roofKind:'mansard'},
  {id:'gallery',label:'Casa-galeria de Willemstad',roofKind:'hip'},
  {id:'shed_gallery',label:'Galeria com telhado de uma água',roofKind:'shed'},
  {id:'dormer',label:'Frontão com águas-furtadas',roofKind:'gable'},
];
const DUTCH_COLONIAL_STYLES=Object.fromEntries(DUTCH_COLONIAL_FORMS.flatMap(form=>DUTCH_COLONIAL_PALETTES.map(palette=>[
  `dutch_colonial_${form.id}_${palette.id}`,
  {label:`Colonial holandês · ${form.label} · ${palette.label}`,wall:palette.wall,roof:palette.roof,accent:palette.accent,trim:palette.trim,roofKind:form.roofKind,motif:'dutch_colonial',dutchForm:form.id},
])));
const SERTANEJO_PALETTES=[
  {id:'cal',label:'Cal e barro',wall:0xe4d7bf,roof:0x81503a,accent:0xa65e43,trim:0xf1e5ce},
  {id:'umbu',label:'Verde umbuzeiro',wall:0xb4ad79,roof:0x664b3c,accent:0x556e50,trim:0xe1d0ac},
  {id:'barro',label:'Barro vermelho',wall:0xc58c59,roof:0x754536,accent:0x52717a,trim:0xe5c99b},
  {id:'anil',label:'Azul anil',wall:0x839da0,roof:0x55463d,accent:0x355a76,trim:0xe4d8c1},
  {id:'mandacaru',label:'Amarelo mandacaru',wall:0xd4b45e,roof:0x76503d,accent:0x6a7952,trim:0xefe0bd},
];
const SERTANEJO_FORMS=[
  {id:'taipa',label:'Casa de taipa caiada',roofKind:'gable'},
  {id:'alpendre',label:'Casa sertaneja com alpendre',roofKind:'hip'},
  {id:'fazenda',label:'Casa de fazenda do sertão',roofKind:'gable'},
  {id:'platibanda',label:'Casa urbana com platibanda',roofKind:'flat'},
  {id:'pedra',label:'Casa de pedra do semiárido',roofKind:'hip'},
];
const SERTANEJO_STYLES=Object.fromEntries(SERTANEJO_FORMS.flatMap(form=>SERTANEJO_PALETTES.map(palette=>[
  `sertanejo_${form.id}_${palette.id}`,
  {label:`${form.label} · ${palette.label}`,wall:palette.wall,roof:palette.roof,accent:palette.accent,trim:palette.trim,roofKind:form.roofKind,motif:'sertanejo',sertanejoForm:form.id},
])));
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
  ...PORTUGUESE_COLONIAL_STYLES,
  ...DUTCH_COLONIAL_STYLES,
  ...SERTANEJO_STYLES,
  courthouse_neoclassical:{label:'Tribunal neoclássico',wall:0xd2c7b2,roof:0x514b43,accent:0x596a70,trim:0xf0e8d9,roofKind:'flat'},
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
export function architectureFor(type, id, citySeed = 0) {
  if(type==='courthouse')return 'courthouse_neoclassical';
  const numericId=Number(id)||0,seedValue=Number(citySeed)>>>0;
  const seed=(Math.imul(numericId+29,2246822519)^(seedValue?Math.imul(seedValue+1,3266489917):0))>>>0;
  const paletteSeed=(Math.imul(numericId+19,2654435761)^(seedValue?Math.imul(seedValue+37,1597334677):0))>>>0;
  const familyRoll=seed%20;
  if(familyRoll<11){const form=DUTCH_COLONIAL_FORMS[seed%DUTCH_COLONIAL_FORMS.length],palette=DUTCH_COLONIAL_PALETTES[paletteSeed%DUTCH_COLONIAL_PALETTES.length];return `dutch_colonial_${form.id}_${palette.id}`;}
  if(familyRoll>=18){const form=SERTANEJO_FORMS[(seed>>>4)%SERTANEJO_FORMS.length],palette=SERTANEJO_PALETTES[paletteSeed%SERTANEJO_PALETTES.length];return `sertanejo_${form.id}_${palette.id}`;}
  const forms=type==='luxury_housing'||type==='popular_luxury_housing'?['quinta','barroco','sobrado','azulejo']:
    ['townhall','council_chamber','courthouse','bank'].includes(type)?['pombalino','barroco','sobrado','mercantil']:
    ['residential','popular_housing','super_popular_housing'].includes(type)?['sobrado','terrea','azulejo','acores','pombalino','quinta']:
    ['sobrado','mercantil','azulejo','acores','pombalino','rural'];
  const form=forms[seed%forms.length],palette=PORTUGUESE_COLONIAL_PALETTE_IDS[paletteSeed%PORTUGUESE_COLONIAL_PALETTE_IDS.length];
  return `portuguese_colonial_${form}_${palette}`;
}
