import { TILE_WATER } from './world_gen.js?v=terrain-generation-reset-2-map-default-128';

// 24 low-poly species (wild Brazilian/tropical fauna + livestock) sharing habitats with NATURAL_PLANTS.
export const ANIMAL_SPECIES = Object.freeze({
  // --- Pecuária / Domesticáveis (também podem ocorrer soltos ou em pastos) ---
  vaca: {
    id: 'vaca', label: 'Vaca', scientific: 'Bos taurus',
    category: 'livestock', bodyPlan: 'bovine', diet: 'herbivore', temperament: 'docile',
    grazesGrass: true, terrain: [0, 9], speed: 0.9, size: 1.0,
    color: 0xd9d2c5, accentColor: 0x3b2c22, maxWild: 6,
    products: { leite: 4, carne_bovina: 6, couro: 3 },
  },
  boi: {
    id: 'boi', label: 'Boi', scientific: 'Bos taurus indicus',
    category: 'livestock', bodyPlan: 'ox', diet: 'herbivore', temperament: 'defensive',
    grazesGrass: true, terrain: [0, 9], speed: 0.95, size: 1.12,
    color: 0x8f5633, accentColor: 0xe6dcc8, maxWild: 5,
    products: { carne_bovina: 8, couro: 4 },
  },
  cavalo: {
    id: 'cavalo', label: 'Cavalo', scientific: 'Equus ferus caballus',
    category: 'livestock', bodyPlan: 'equine', diet: 'herbivore', temperament: 'shy',
    grazesGrass: true, terrain: [0, 9], speed: 1.75, size: 1.08,
    color: 0x7c4a2d, accentColor: 0x261a14, maxWild: 4,
    products: { couro: 3 },
  },
  porco: {
    id: 'porco', label: 'Porco', scientific: 'Sus scrofa domesticus',
    category: 'livestock', bodyPlan: 'pig', diet: 'omnivore', temperament: 'docile',
    grazesGrass: false, terrain: [0, 9], speed: 1.0, size: 0.72,
    color: 0xe5a29c, accentColor: 0xc27b76, maxWild: 5,
    products: { carne_suina: 5, couro: 2 },
  },
  ovelha: {
    id: 'ovelha', label: 'Ovelha', scientific: 'Ovis aries',
    category: 'livestock', bodyPlan: 'sheep', diet: 'herbivore', temperament: 'shy',
    grazesGrass: true, terrain: [0, 9], speed: 1.0, size: 0.78,
    color: 0xf0ece1, accentColor: 0x3a322c, maxWild: 5,
    products: { la: 3, carne_ovina: 4, couro: 2 },
  },
  cabra: {
    id: 'cabra', label: 'Cabra', scientific: 'Capra hircus',
    category: 'livestock', bodyPlan: 'goat', diet: 'herbivore', temperament: 'docile',
    grazesGrass: true, terrain: [0, 9], speed: 1.15, size: 0.76,
    color: 0xc8b294, accentColor: 0x4b3b2c, maxWild: 5,
    products: { leite: 2, carne_caprina: 4, couro: 2 },
  },
  galinha: {
    id: 'galinha', label: 'Galinha', scientific: 'Gallus gallus domesticus',
    category: 'livestock', bodyPlan: 'chicken', diet: 'omnivore', temperament: 'shy',
    grazesGrass: false, terrain: [0, 9], speed: 0.85, size: 0.42,
    color: 0xf4eee0, accentColor: 0xc8372d, maxWild: 6,
    products: { ovos: 3, carne_ave: 2, penas: 2 },
  },
  pato: {
    id: 'pato', label: 'Pato', scientific: 'Anas platyrhynchos',
    category: 'livestock', bodyPlan: 'duck', diet: 'omnivore', temperament: 'shy',
    grazesGrass: false, terrain: [0, 3, TILE_WATER], nearWater: true, speed: 0.9, size: 0.44,
    color: 0x5c7f57, accentColor: 0xd98a2b, maxWild: 6,
    products: { ovos: 2, carne_ave: 2, penas: 2 },
  },

  // --- Fauna Silvestre (habitats naturais compartilhados com NATURAL_PLANTS) ---
  capivara: {
    id: 'capivara', label: 'Capivara', scientific: 'Hydrochoerus hydrochaeris',
    category: 'wild', bodyPlan: 'capybara', diet: 'herbivore', temperament: 'docile',
    grazesGrass: true, terrain: [0, 3], nearWater: true, speed: 0.95, size: 0.72,
    color: 0x8b6241, accentColor: 0x5c3e28, maxWild: 8,
    products: { carne_caca: 4, couro: 2 },
  },
  anta: {
    id: 'anta', label: 'Anta', scientific: 'Tapirus terrestris',
    category: 'wild', bodyPlan: 'tapir', diet: 'herbivore', temperament: 'shy',
    grazesGrass: true, terrain: [0, 9], speed: 1.1, size: 0.95,
    color: 0x574840, accentColor: 0x3b302a, maxWild: 4,
    products: { carne_caca: 6, couro: 3 },
  },
  veado: {
    id: 'veado', label: 'Veado-catingueiro', scientific: 'Subulo gouazoubira',
    category: 'wild', bodyPlan: 'deer', diet: 'herbivore', temperament: 'shy',
    grazesGrass: true, terrain: [0, 9], speed: 1.85, size: 0.88,
    color: 0xa66e44, accentColor: 0xebdcc7, maxWild: 6,
    products: { carne_caca: 5, couro: 3 },
  },
  javali: {
    id: 'javali', label: 'Queixada', scientific: 'Tayassu pecari',
    category: 'wild', bodyPlan: 'boar', diet: 'omnivore', temperament: 'defensive',
    grazesGrass: false, terrain: [0, 9], speed: 1.3, size: 0.75,
    color: 0x453b36, accentColor: 0xdcd3c4, maxWild: 6,
    products: { carne_caca: 5, couro: 2 },
  },
  tatu: {
    id: 'tatu', label: 'Tatu-bola', scientific: 'Tolypeutes tricinctus',
    category: 'wild', bodyPlan: 'armadillo', diet: 'omnivore', temperament: 'shy',
    grazesGrass: false, terrain: [0, 3, 9], speed: 0.75, size: 0.45,
    color: 0x7c6a58, accentColor: 0x534538, maxWild: 6,
    products: { carne_caca: 2 },
  },
  tamandua: {
    id: 'tamandua', label: 'Tamanduá-bandeira', scientific: 'Myrmecophaga tridactyla',
    category: 'wild', bodyPlan: 'anteater', diet: 'omnivore', temperament: 'defensive',
    grazesGrass: false, terrain: [0, 9], speed: 0.95, size: 0.84,
    color: 0x4a433e, accentColor: 0xd8d1c5, maxWild: 4,
    products: { carne_caca: 3, couro: 2 },
  },
  preguica: {
    id: 'preguica', label: 'Bicho-preguiça', scientific: 'Bradypus tridactylus',
    category: 'wild', bodyPlan: 'sloth', diet: 'herbivore', temperament: 'docile',
    arboreal: true, grazesGrass: false, terrain: [0, 9], nearTree: true, speed: 0.14, size: 0.52,
    color: 0x8f8371, accentColor: 0x595043, maxWild: 4,
    products: { carne_caca: 2 },
  },
  macaco: {
    id: 'macaco', label: 'Macaco-prego', scientific: 'Sapajus libidinosus',
    category: 'wild', bodyPlan: 'monkey', diet: 'omnivore', temperament: 'shy',
    arboreal: true, grazesGrass: false, terrain: [0, 9], nearTree: true, speed: 1.45, size: 0.5,
    color: 0x6b4b32, accentColor: 0xcab092, maxWild: 6,
    products: { carne_caca: 2 },
  },
  mico_leao: {
    id: 'mico_leao', label: 'Mico-leão-dourado', scientific: 'Leontopithecus rosalia',
    category: 'wild', bodyPlan: 'monkey', diet: 'omnivore', temperament: 'shy',
    arboreal: true, grazesGrass: false, terrain: [0, 9], nearTree: true, speed: 1.5, size: 0.4,
    color: 0xe29224, accentColor: 0x9c4d14, maxWild: 4,
    products: { carne_caca: 1 },
  },
  sagui: {
    id: 'sagui', label: 'Sagui-de-tufos-brancos', scientific: 'Callithrix jacchus',
    category: 'wild', bodyPlan: 'monkey', diet: 'omnivore', temperament: 'shy',
    arboreal: true, grazesGrass: false, terrain: [0, 9], nearTree: true, speed: 1.55, size: 0.34,
    color: 0x8e867c, accentColor: 0xf4f0e8, maxWild: 5,
    products: { carne_caca: 1 },
  },
  quati: {
    id: 'quati', label: 'Quati', scientific: 'Nasua nasua',
    category: 'wild', bodyPlan: 'coati', diet: 'omnivore', temperament: 'shy',
    arboreal: true, grazesGrass: false, terrain: [0, 9], nearTree: true, speed: 1.3, size: 0.52,
    color: 0x8b5b36, accentColor: 0x2d231c, maxWild: 5,
    products: { carne_caca: 2, couro: 1 },
  },
  iguana: {
    id: 'iguana', label: 'Iguana-verde', scientific: 'Iguana iguana',
    category: 'wild', bodyPlan: 'iguana', diet: 'herbivore', temperament: 'shy',
    arboreal: true, grazesGrass: false, terrain: [0, 9], nearTree: true, speed: 0.95, size: 0.58,
    color: 0x4f9442, accentColor: 0x2d5e28, maxWild: 4,
    products: { carne_caca: 2, couro: 1 },
  },
  onca: {
    id: 'onca', label: 'Onça-pintada', scientific: 'Panthera onca',
    category: 'wild', bodyPlan: 'jaguar', diet: 'carnivore', temperament: 'predator',
    grazesGrass: false, terrain: [0, 9], speed: 1.9, size: 0.96,
    color: 0xd2973e, accentColor: 0x2a1f18, maxWild: 3,
    products: { carne_caca: 4, couro: 4 },
  },
  lobo_guara: {
    id: 'lobo_guara', label: 'Lobo-guará', scientific: 'Chrysocyon brachyurus',
    category: 'wild', bodyPlan: 'maned_wolf', diet: 'carnivore', temperament: 'predator',
    grazesGrass: false, terrain: [0, 9], speed: 1.7, size: 0.85,
    color: 0xb85828, accentColor: 0x261d19, maxWild: 4,
    products: { carne_caca: 3, couro: 2 },
  },
  jacare: {
    id: 'jacare', label: 'Jacaré-do-papo-amarelo', scientific: 'Caiman latirostris',
    category: 'wild', bodyPlan: 'caiman', diet: 'carnivore', temperament: 'predator',
    grazesGrass: false, terrain: [0, 3, TILE_WATER], nearWater: true, speed: 0.85, size: 0.92,
    color: 0x4b5c38, accentColor: 0xc2b869, maxWild: 5,
    products: { carne_caca: 4, couro: 4 },
  },
  garca: {
    id: 'garca', label: 'Garça-branca', scientific: 'Ardea alba',
    category: 'wild', bodyPlan: 'heron', diet: 'carnivore', temperament: 'shy',
    canFly: true, grazesGrass: false, terrain: [0, 3], nearWater: true, speed: 1.05, size: 0.65,
    color: 0xf4f5f0, accentColor: 0xe29f2d, maxWild: 6,
    products: { penas: 3, carne_ave: 2 },
  },
  tucano: {
    id: 'tucano', label: 'Tucano-toco', scientific: 'Ramphastos toco',
    category: 'wild', bodyPlan: 'toucan', diet: 'omnivore', temperament: 'shy',
    canFly: true, grazesGrass: false, terrain: [0, 9], nearTree: true, speed: 1.25, size: 0.44,
    color: 0x1e1f24, accentColor: 0xeb841e, maxWild: 6,
    products: { penas: 2, carne_ave: 1 },
  },
  arara: {
    id: 'arara', label: 'Arara-azul', scientific: 'Anodorhynchus hyacinthinus',
    category: 'wild', bodyPlan: 'macaw', diet: 'herbivore', temperament: 'shy',
    canFly: true, grazesGrass: false, terrain: [0, 9], nearTree: true, speed: 1.35, size: 0.48,
    color: 0x1f59b8, accentColor: 0xe6c32c, maxWild: 6,
    products: { penas: 3, carne_ave: 1 },
  },
  ema: {
    id: 'ema', label: 'Ema', scientific: 'Rhea americana',
    category: 'wild', bodyPlan: 'rhea', diet: 'herbivore', temperament: 'shy',
    grazesGrass: true, terrain: [0, 9], speed: 1.65, size: 0.92,
    color: 0x8d8374, accentColor: 0xcac2b4, maxWild: 5,
    products: { ovos: 3, penas: 3, carne_ave: 4 },
  },
  coelho: {
    id: 'coelho', label: 'Tapiti', scientific: 'Sylvilagus brasiliensis',
    category: 'wild', bodyPlan: 'rabbit', diet: 'herbivore', temperament: 'shy',
    grazesGrass: true, terrain: [0, 9], speed: 1.4, size: 0.38,
    color: 0x9c7b5c, accentColor: 0xe5dcd0, maxWild: 8,
    products: { carne_caca: 2, couro: 1 },
  },
  // --- 20 espécies de pássaros ---
  bem_te_vi: { id: 'bem_te_vi', label: 'Bem-te-vi', scientific: 'Pitangus sulphuratus', category: 'wild', bodyPlan: 'songbird', diet: 'omnivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 9], speed: 1.4, size: 0.3, color: 0xe8c432, accentColor: 0x3b2c22, maxWild: 6, products: { penas: 1 } },
  sabia: { id: 'sabia', label: 'Sabiá-laranjeira', scientific: 'Turdus rufiventris', category: 'wild', bodyPlan: 'songbird', diet: 'omnivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 9], speed: 1.35, size: 0.3, color: 0x8a6d56, accentColor: 0xd97428, maxWild: 6, products: { penas: 1 } },
  beija_flor: { id: 'beija_flor', label: 'Beija-flor-tesoura', scientific: 'Eupetomena macroura', category: 'wild', bodyPlan: 'hummingbird', diet: 'herbivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 9], speed: 1.8, size: 0.22, color: 0x228b6b, accentColor: 0x2446a8, maxWild: 6, products: { penas: 1 } },
  cardeal: { id: 'cardeal', label: 'Cardeal-do-nordeste', scientific: 'Paroaria dominicana', category: 'wild', bodyPlan: 'songbird', diet: 'herbivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 9], speed: 1.35, size: 0.28, color: 0xdedad0, accentColor: 0xd12c24, maxWild: 5, products: { penas: 1 } },
  canario: { id: 'canario', label: 'Canário-da-terra', scientific: 'Sicalis flaveola', category: 'wild', bodyPlan: 'songbird', diet: 'herbivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 9], speed: 1.4, size: 0.26, color: 0xf2c929, accentColor: 0xd98a1e, maxWild: 6, products: { penas: 1 } },
  periquito: { id: 'periquito', label: 'Periquito-rico', scientific: 'Brotogeris tirica', category: 'wild', bodyPlan: 'parrot', diet: 'herbivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 9], nearTree: true, speed: 1.5, size: 0.3, color: 0x4ca638, accentColor: 0xe6d645, maxWild: 6, products: { penas: 1 } },
  papagaio: { id: 'papagaio', label: 'Papagaio-verdadeiro', scientific: 'Amazona aestiva', category: 'wild', bodyPlan: 'parrot', diet: 'herbivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 9], nearTree: true, speed: 1.45, size: 0.38, color: 0x3b9636, accentColor: 0xe8c42a, maxWild: 5, products: { penas: 2 } },
  coruja: { id: 'coruja', label: 'Coruja-buraqueira', scientific: 'Athene cunicularia', category: 'wild', bodyPlan: 'owl', diet: 'carnivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 9], speed: 1.4, size: 0.36, color: 0x8f7152, accentColor: 0xf0e4ce, maxWild: 4, products: { penas: 2 } },
  gaviao: { id: 'gaviao', label: 'Gavião-carijó', scientific: 'Rupornis magnirostris', category: 'wild', bodyPlan: 'raptor', diet: 'carnivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 9], speed: 1.75, size: 0.44, color: 0x6b5c4d, accentColor: 0xd9ccb8, maxWild: 4, products: { penas: 2 } },
  urubu: { id: 'urubu', label: 'Urubu-de-cabeça-preta', scientific: 'Coragyps atratus', category: 'wild', bodyPlan: 'raptor', diet: 'carnivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 3, 9], speed: 1.5, size: 0.52, color: 0x26262a, accentColor: 0x45454c, maxWild: 5, products: { penas: 2 } },
  pica_pau: { id: 'pica_pau', label: 'Pica-pau', scientific: 'Dryocopus lineatus', category: 'wild', bodyPlan: 'woodpecker', diet: 'omnivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 9], nearTree: true, speed: 1.4, size: 0.34, color: 0x28282c, accentColor: 0xc92b24, maxWild: 5, products: { penas: 1 } },
  pombo: { id: 'pombo', label: 'Pombo-asa-branca', scientific: 'Patagioenas picazuro', category: 'wild', bodyPlan: 'songbird', diet: 'herbivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 9], speed: 1.4, size: 0.34, color: 0x8e8692, accentColor: 0xeae8ee, maxWild: 7, products: { penas: 1, carne_ave: 1 } },
  rolinha: { id: 'rolinha', label: 'Rolinha-roxa', scientific: 'Columbina talpacoti', category: 'wild', bodyPlan: 'songbird', diet: 'herbivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 9], speed: 1.35, size: 0.26, color: 0xa66e58, accentColor: 0x6b483d, maxWild: 7, products: { penas: 1 } },
  martim_pescador: { id: 'martim_pescador', label: 'Martim-pescador', scientific: 'Megaceryle torquata', category: 'wild', bodyPlan: 'kingfisher', diet: 'carnivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 3], nearWater: true, speed: 1.65, size: 0.34, color: 0x456b8c, accentColor: 0xc45e2d, maxWild: 4, products: { penas: 1 } },
  colhereiro: { id: 'colhereiro', label: 'Colhereiro-americano', scientific: 'Platalea ajaja', category: 'wild', bodyPlan: 'spoonbill', diet: 'carnivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 3], nearWater: true, speed: 1.2, size: 0.58, color: 0xe88ca5, accentColor: 0xc94f72, maxWild: 4, products: { penas: 2 } },
  guara: { id: 'guara', label: 'Guará-vermelho', scientific: 'Eudocimus ruber', category: 'wild', bodyPlan: 'spoonbill', diet: 'carnivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 3], nearWater: true, speed: 1.25, size: 0.52, color: 0xd9342b, accentColor: 0x2a1f1e, maxWild: 4, products: { penas: 2 } },
  sanhaco: { id: 'sanhaco', label: 'Sanhaço-cinzento', scientific: 'Tangara sayaca', category: 'wild', bodyPlan: 'songbird', diet: 'herbivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 9], speed: 1.45, size: 0.28, color: 0x7ea2b8, accentColor: 0x4f7896, maxWild: 6, products: { penas: 1 } },
  tie_sangue: { id: 'tie_sangue', label: 'Tiê-sangue', scientific: 'Ramphocelus bresilius', category: 'wild', bodyPlan: 'songbird', diet: 'herbivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 9], nearTree: true, speed: 1.4, size: 0.28, color: 0xd42222, accentColor: 0x1e1c1e, maxWild: 5, products: { penas: 1 } },
  joao_de_barro: { id: 'joao_de_barro', label: 'João-de-barro', scientific: 'Furnarius rufus', category: 'wild', bodyPlan: 'songbird', diet: 'omnivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 9], speed: 1.35, size: 0.28, color: 0xb56b38, accentColor: 0xe8dcc8, maxWild: 6, products: { penas: 1 } },
  andorinha: { id: 'andorinha', label: 'Andorinha', scientific: 'Pygochelidon cyanoleuca', category: 'wild', bodyPlan: 'swallow', diet: 'omnivore', temperament: 'shy', canFly: true, grazesGrass: false, terrain: [0, 9], speed: 1.9, size: 0.24, color: 0x28385e, accentColor: 0xf0eee8, maxWild: 7, products: { penas: 1 } },
});

const MOUNT_SPECIES = { cavalo: 2.25, boi: 1.55, vaca: 1.45, anta: 1.6, ema: 1.9 };
// Target world heights scaled to game units where human (1.70m) = 1.05 and 1 floor (2.91m) = 1.80.
const ANIMAL_SCALES = {
  cavalo: 0.78, boi: 0.66, vaca: 0.69, anta: 0.67, ema: 0.62,
  onca: 0.49, veado: 0.56, jacare: 0.59, lobo_guara: 0.48, tamandua: 0.57,
  ovelha: 0.57, cabra: 0.5, javali: 0.58, porco: 0.63, capivara: 0.52,
  garca: 0.54, colhereiro: 0.47, guara: 0.38, urubu: 0.58, gaviao: 0.45,
  iguana: 0.27, quati: 0.33, macaco: 0.45, preguica: 0.45, coruja: 0.43,
  arara: 0.42, tucano: 0.41, papagaio: 0.45, galinha: 0.41, pato: 0.42,
  tatu: 0.37, mico_leao: 0.26, coelho: 0.3, pica_pau: 0.34, martim_pescador: 0.36,
  pombo: 0.41, periquito: 0.31, sagui: 0.2, bem_te_vi: 0.33, sabia: 0.33,
  cardeal: 0.3, sanhaco: 0.29, tie_sangue: 0.29, joao_de_barro: 0.3,
  canario: 0.25, rolinha: 0.3, andorinha: 0.3, beija_flor: 0.27,
};
const ANIMAL_PRICES = {
  cavalo: 18000, boi: 14000, vaca: 12000, anta: 11000, ema: 8500,
  onca: 16000, lobo_guara: 12500, arara: 9500, tucano: 7500, jacare: 9000,
  veado: 7200, ovelha: 6500, cabra: 6200, porco: 5800, capivara: 4500,
  macaco: 6800, tamandua: 6000, preguica: 5500, javali: 5200, garca: 4800,
  tatu: 3200, pato: 2600, galinha: 2400, coelho: 2200,
};
for (const [id, spec] of Object.entries(ANIMAL_SPECIES)) {
  spec.tameable = true;
  spec.role = MOUNT_SPECIES[id] ? 'mount' : 'companion';
  spec.mountSpeed = MOUNT_SPECIES[id] || 0;
  spec.marketPrice = ANIMAL_PRICES[id] || 4000;
  if (ANIMAL_SCALES[id]) spec.size = ANIMAL_SCALES[id];
}

export const ANIMAL_CLIPS = Object.freeze({
  idle: [0],
  walk: [0, 1, 2, 3, 4, 5, 6, 7],
  eat: [0, 1, 2, 3, 4, 5],
  sleep: [0],
});

export const ANIMAL_SPECIES_IDS = Object.freeze(Object.keys(ANIMAL_SPECIES));

export const ANIMAL_GOODS = Object.freeze({
  feno: { label: 'Feno e capim', price: 120 },
  racao_bovina: { label: 'Ração bovina', price: 260 },
  racao_aves: { label: 'Ração de aves', price: 220 },
  racao_suina: { label: 'Ração suína', price: 240 },
  carne_bovina: { label: 'Carne bovina', price: 780 },
  carne_suina: { label: 'Carne suína', price: 680 },
  carne_ovina: { label: 'Carne ovina', price: 720 },
  carne_caprina: { label: 'Carne caprina', price: 700 },
  carne_ave: { label: 'Carne de ave', price: 520 },
  carne_caca: { label: 'Carne de caça', price: 640 },
  couro: { label: 'Couro bruto', price: 480 },
  couro_curtido: { label: 'Couro curtido', price: 1150 },
  la: { label: 'Lã natural', price: 420 },
  penas: { label: 'Penas', price: 190 },
  arco_caca: { label: 'Arco de caça', price: 2400 },
  churrasco: { label: 'Churrasco', price: 1100 },
  marmita_carne: { label: 'Marmita de carne', price: 1350 },
});
