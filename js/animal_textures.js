import { ANIMAL_SPECIES } from './animal_catalog.js';

const SPECIES_PATTERNS = {
  vaca: { base: [232, 224, 210], accent: [48, 36, 28], pattern: 'spots', bump: 0.35 },
  boi: { base: [148, 86, 48], accent: [74, 42, 24], pattern: 'shoulder', bump: 0.4 },
  cavalo: { base: [128, 74, 42], accent: [38, 24, 18], pattern: 'mane_socks', bump: 0.35 },
  porco: { base: [232, 166, 158], accent: [196, 122, 118], pattern: 'mottled', bump: 0.25 },
  ovelha: { base: [242, 238, 226], accent: [212, 204, 188], pattern: 'wool', bump: 0.9 },
  cabra: { base: [204, 182, 148], accent: [78, 60, 44], pattern: 'stripe', bump: 0.45 },
  galinha: { base: [244, 238, 224], accent: [200, 56, 44], pattern: 'feathers_comb', bump: 0.5 },
  pato: { base: [92, 128, 86], accent: [218, 138, 44], pattern: 'mallard', bump: 0.45 },
  capivara: { base: [138, 98, 64], accent: [88, 60, 38], pattern: 'fur', bump: 0.55 },
  anta: { base: [88, 72, 64], accent: [56, 44, 38], pattern: 'fur', bump: 0.4 },
  veado: { base: [168, 110, 68], accent: [236, 222, 200], pattern: 'fawn', bump: 0.35 },
  javali: { base: [70, 60, 54], accent: [214, 204, 188], pattern: 'bristle', bump: 0.65 },
  tatu: { base: [126, 108, 88], accent: [80, 66, 52], pattern: 'armor', bump: 0.95 },
  tamandua: { base: [74, 66, 62], accent: [224, 218, 206], pattern: 'band', bump: 0.55 },
  preguica: { base: [144, 132, 112], accent: [88, 96, 74], pattern: 'shaggy', bump: 0.7 },
  macaco: { base: [108, 76, 50], accent: [204, 176, 146], pattern: 'belly', bump: 0.45 },
  onca: { base: [212, 152, 62], accent: [42, 30, 22], pattern: 'rosettes', bump: 0.35 },
  lobo_guara: { base: [186, 88, 40], accent: [38, 28, 24], pattern: 'mane_socks', bump: 0.45 },
  jacare: { base: [74, 94, 54], accent: [194, 184, 102], pattern: 'scales', bump: 0.95 },
  garca: { base: [244, 246, 240], accent: [226, 160, 44], pattern: 'feathers', bump: 0.4 },
  tucano: { base: [30, 32, 38], accent: [238, 136, 28], pattern: 'toucan', bump: 0.35 },
  arara: { base: [32, 92, 188], accent: [232, 198, 44], pattern: 'feathers', bump: 0.45 },
  ema: { base: [142, 132, 116], accent: [204, 196, 182], pattern: 'feathers', bump: 0.55 },
  coelho: { base: [158, 124, 92], accent: [232, 222, 208], pattern: 'belly', bump: 0.45 },
  mico_leao: { base: [226, 146, 36], accent: [156, 77, 20], pattern: 'mane_socks', bump: 0.5 },
  sagui: { base: [142, 134, 124], accent: [244, 240, 232], pattern: 'stripe', bump: 0.45 },
  quati: { base: [139, 91, 54], accent: [45, 35, 28], pattern: 'armor', bump: 0.45 },
  iguana: { base: [79, 148, 66], accent: [45, 94, 40], pattern: 'scales', bump: 0.85 },
  bem_te_vi: { base: [232, 196, 50], accent: [59, 44, 34], pattern: 'stripe', bump: 0.4 },
  sabia: { base: [138, 109, 86], accent: [217, 116, 40], pattern: 'belly', bump: 0.4 },
  beija_flor: { base: [34, 139, 107], accent: [36, 70, 168], pattern: 'feathers', bump: 0.35 },
  cardeal: { base: [222, 218, 208], accent: [209, 44, 36], pattern: 'toucan', bump: 0.4 },
  canario: { base: [242, 201, 41], accent: [217, 138, 30], pattern: 'feathers', bump: 0.35 },
  periquito: { base: [76, 166, 56], accent: [230, 214, 69], pattern: 'feathers', bump: 0.4 },
  papagaio: { base: [59, 150, 54], accent: [232, 196, 42], pattern: 'feathers', bump: 0.4 },
  coruja: { base: [143, 113, 82], accent: [240, 228, 206], pattern: 'spots', bump: 0.5 },
  gaviao: { base: [107, 92, 77], accent: [217, 204, 184], pattern: 'armor', bump: 0.45 },
  urubu: { base: [38, 38, 42], accent: [69, 69, 76], pattern: 'feathers', bump: 0.45 },
  pica_pau: { base: [40, 40, 44], accent: [201, 43, 36], pattern: 'stripe', bump: 0.45 },
  pombo: { base: [142, 134, 146], accent: [234, 232, 238], pattern: 'feathers', bump: 0.4 },
  rolinha: { base: [166, 110, 88], accent: [107, 72, 61], pattern: 'feathers', bump: 0.4 },
  martim_pescador: { base: [69, 107, 140], accent: [196, 94, 45], pattern: 'belly', bump: 0.4 },
  colhereiro: { base: [232, 140, 165], accent: [201, 79, 114], pattern: 'feathers', bump: 0.4 },
  guara: { base: [217, 52, 43], accent: [42, 31, 30], pattern: 'feathers', bump: 0.4 },
  sanhaco: { base: [126, 162, 184], accent: [79, 120, 150], pattern: 'feathers', bump: 0.4 },
  tie_sangue: { base: [212, 34, 34], accent: [30, 28, 30], pattern: 'feathers', bump: 0.4 },
  joao_de_barro: { base: [181, 107, 56], accent: [232, 220, 200], pattern: 'belly', bump: 0.4 },
  andorinha: { base: [40, 56, 94], accent: [240, 238, 232], pattern: 'belly', bump: 0.35 },
};

function hash2d(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function mixRGB(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function generateAnimalTextureData(species, size = 32) {
  const spec = ANIMAL_SPECIES[species] || {};
  const cfg = SPECIES_PATTERNS[species] || {
    base: [((spec.color ?? 0xc8bfa8) >> 16) & 255, ((spec.color ?? 0xc8bfa8) >> 8) & 255, (spec.color ?? 0xc8bfa8) & 255],
    accent: [((spec.accentColor ?? 0x4a3b2c) >> 16) & 255, ((spec.accentColor ?? 0x4a3b2c) >> 8) & 255, (spec.accentColor ?? 0x4a3b2c) & 255],
    pattern: 'fur',
    bump: 0.4,
  };
  const seed = species.split('').reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const diffuse = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const noise = hash2d(x, y, seed);
      const cellNoise = hash2d(Math.floor(x / 3), Math.floor(y / 3), seed + 13);
      let t = 0;
      let h = noise * 0.35;

      switch (cfg.pattern) {
        case 'spots':
          t = cellNoise > 0.64 ? 0.92 : 0.05 * noise;
          h = 0.5 + noise * 0.25;
          break;
        case 'rosettes': {
          const rx = (x % 6) - 2.5, ry = (y % 6) - 2.5;
          const d = Math.hypot(rx, ry);
          t = (d > 1.2 && d < 2.3 && cellNoise > 0.25) ? 0.9 : 0.08 * noise;
          h = 0.5 + noise * 0.25;
          break;
        }
        case 'scales': {
          const sx = (x + (y % 4 >= 2 ? 2 : 0)) % 4;
          const sy = y % 4;
          const edge = sx === 0 || sy === 0;
          t = v < 0.28 ? 0.85 : edge ? 0.35 : 0.05;
          h = edge ? 0.2 : 0.85 + noise * 0.15;
          break;
        }
        case 'armor': {
          const band = y % 4 === 0;
          t = band ? 0.85 : 0.15 * noise;
          h = band ? 0.15 : 0.9;
          break;
        }
        case 'wool': {
          const tuft = Math.sin(x * 1.3) * Math.cos(y * 1.3);
          t = tuft > 0.2 ? 0.65 : 0.1;
          h = 0.5 + tuft * 0.45 + noise * 0.1;
          break;
        }
        case 'band': {
          const diag = Math.abs((u - 0.55) - (v - 0.5) * 0.6);
          t = diag < 0.12 ? 0.95 : 0.1 * noise;
          h = 0.45 + noise * 0.35;
          break;
        }
        case 'mane_socks':
          t = (v < 0.22 || (u > 0.65 && v > 0.65)) ? 0.9 : 0.1 * noise;
          h = 0.5 + noise * 0.35;
          break;
        case 'fawn':
          t = v < 0.25 ? 0.85 : (cellNoise > 0.78 && v > 0.4) ? 0.7 : 0.08 * noise;
          h = 0.5 + noise * 0.25;
          break;
        case 'toucan':
          t = u > 0.62 ? 0.95 : 0.05 * noise;
          h = 0.5 + noise * 0.2;
          break;
        case 'mallard':
          t = u > 0.68 ? (v > 0.62 ? 0.85 : 0.15) : v < 0.3 ? 0.45 : 0.12 * noise;
          h = 0.45 + (y % 2) * 0.25 + noise * 0.15;
          break;
        case 'feathers':
        case 'feathers_comb': {
          const barb = ((x + (y % 2) * 2) % 4 === 0) ? 0.25 : 0;
          t = (cfg.pattern === 'feathers_comb' && u > 0.72 && v > 0.72) ? 0.95 : barb * 0.5 + noise * 0.1;
          h = 0.6 - barb + noise * 0.2;
          break;
        }
        case 'stripe':
          t = v > 0.78 ? 0.85 : 0.15 * noise;
          h = 0.45 + noise * 0.35;
          break;
        case 'belly':
          t = v < 0.28 ? 0.82 : 0.12 * noise;
          h = 0.45 + noise * 0.3;
          break;
        default:
          t = noise * 0.28;
          h = 0.4 + noise * 0.45;
      }

      const [r, g, b] = mixRGB(cfg.base, cfg.accent, Math.max(0, Math.min(1, t)));
      const idx = (y * size + x) * 4;
      diffuse[idx] = r;
      diffuse[idx + 1] = g;
      diffuse[idx + 2] = b;
      diffuse[idx + 3] = 255;
      height[y * size + x] = h;
    }
  }

  // Convert heightfield into tangent-space normal map
  const normal = new Uint8Array(size * size * 4);
  const strength = 2.4 * (cfg.bump ?? 0.45);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size, xp = (x + 1) % size;
      const ym = (y - 1 + size) % size, yp = (y + 1) % size;
      const dx = (height[y * size + xp] - height[y * size + xm]) * strength;
      const dy = (height[yp * size + x] - height[ym * size + x]) * strength;
      const len = Math.hypot(-dx, -dy, 1) || 1;
      const idx = (y * size + x) * 4;
      normal[idx] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      normal[idx + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      normal[idx + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      normal[idx + 3] = 255;
    }
  }

  return { size, diffuse, normal };
}

export function createAnimalSpeciesTextures(THREE, species) {
  const { size, diffuse, normal } = generateAnimalTextureData(species, 32);
  const makeTex = (data, srgb) => {
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    if (srgb && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };
  return {
    map: makeTex(diffuse, true),
    normalMap: makeTex(normal, false),
  };
}
