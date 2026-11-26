import { ANIMAL_SPECIES } from './animal_catalog.js';

const SPECIES_PATTERNS = {
  vaca: { base: [236, 230, 218], accent: [46, 36, 30], belly: [242, 238, 228], muzzle: [212, 160, 154], pattern: 'spots', bump: 0.25 },
  boi: { base: [146, 84, 46], accent: [68, 38, 22], belly: [164, 108, 68], muzzle: [54, 40, 34], pattern: 'shoulder', bump: 0.3 },
  cavalo: { base: [134, 78, 44], accent: [36, 24, 18], belly: [150, 96, 58], muzzle: [52, 38, 32], pattern: 'mane_socks', bump: 0.25 },
  porco: { base: [228, 164, 154], accent: [192, 122, 114], belly: [236, 182, 174], muzzle: [214, 132, 128], pattern: 'mottled', bump: 0.2 },
  ovelha: { base: [242, 238, 226], accent: [204, 196, 178], face: [68, 58, 50], pattern: 'wool', bump: 0.65 },
  cabra: { base: [206, 186, 152], accent: [74, 58, 44], belly: [224, 210, 184], pattern: 'stripe', bump: 0.35 },
  galinha: { base: [242, 234, 218], accent: [198, 52, 42], wing: [220, 206, 182], beak: [222, 162, 46], pattern: 'feathers_comb', bump: 0.35 },
  pato: { base: [122, 112, 98], accent: [38, 108, 72], wing: [92, 86, 78], beak: [226, 148, 42], pattern: 'mallard', bump: 0.3 },
  capivara: { base: [136, 96, 62], accent: [86, 58, 36], belly: [154, 114, 78], muzzle: [64, 46, 34], pattern: 'fur', bump: 0.4 },
  anta: { base: [88, 74, 66], accent: [54, 44, 38], belly: [112, 96, 86], muzzle: [62, 50, 44], pattern: 'fur', bump: 0.3 },
  veado: { base: [168, 108, 64], accent: [238, 226, 204], belly: [232, 218, 194], pattern: 'fawn', bump: 0.25 },
  javali: { base: [72, 60, 54], accent: [148, 132, 116], belly: [88, 74, 66], muzzle: [118, 86, 82], pattern: 'bristle', bump: 0.5 },
  tatu: { base: [128, 110, 90], accent: [78, 64, 50], belly: [164, 144, 122], pattern: 'armor', bump: 0.75 },
  tamandua: { base: [74, 66, 60], accent: [226, 218, 204], belly: [84, 74, 68], pattern: 'band', bump: 0.4 },
  preguica: { base: [146, 134, 114], accent: [90, 98, 74], face: [212, 198, 174], pattern: 'shaggy', bump: 0.5 },
  macaco: { base: [110, 76, 48], accent: [204, 174, 142], belly: [206, 176, 146], pattern: 'belly', bump: 0.35 },
  onca: { base: [214, 152, 58], accent: [40, 28, 20], belly: [236, 212, 168], pattern: 'rosettes', bump: 0.28 },
  lobo_guara: { base: [188, 88, 38], accent: [36, 26, 22], belly: [206, 122, 68], pattern: 'mane_socks', bump: 0.35 },
  jacare: { base: [72, 94, 52], accent: [44, 58, 32], belly: [186, 176, 104], pattern: 'scales', bump: 0.75 },
  garca: { base: [244, 246, 240], accent: [216, 220, 212], beak: [228, 156, 42], pattern: 'feathers', bump: 0.28 },
  tucano: { base: [28, 30, 36], accent: [238, 134, 26], throat: [242, 202, 48], beak: [242, 136, 24], pattern: 'toucan', bump: 0.25 },
  arara: { base: [30, 92, 188], accent: [232, 196, 42], wing: [24, 132, 198], beak: [42, 40, 44], pattern: 'feathers', bump: 0.32 },
  ema: { base: [142, 132, 116], accent: [198, 190, 174], belly: [176, 166, 150], pattern: 'feathers', bump: 0.42 },
  coelho: { base: [158, 124, 92], accent: [232, 222, 208], belly: [234, 224, 210], muzzle: [208, 148, 146], pattern: 'belly', bump: 0.35 },
  mico_leao: { base: [226, 144, 34], accent: [158, 76, 20], belly: [238, 170, 58], pattern: 'mane_socks', bump: 0.38 },
  sagui: { base: [140, 132, 122], accent: [242, 238, 230], belly: [178, 170, 158], pattern: 'stripe', bump: 0.35 },
  quati: { base: [142, 94, 56], accent: [42, 32, 26], belly: [182, 138, 96], pattern: 'ringed_tail', bump: 0.35 },
  iguana: { base: [78, 148, 64], accent: [42, 92, 38], belly: [156, 194, 114], pattern: 'scales', bump: 0.65 },
  bem_te_vi: { base: [118, 94, 62], accent: [240, 202, 48], belly: [238, 198, 46], pattern: 'stripe', bump: 0.3 },
  sabia: { base: [136, 108, 84], accent: [216, 114, 40], belly: [216, 114, 40], pattern: 'belly', bump: 0.3 },
  beija_flor: { base: [34, 138, 106], accent: [36, 72, 170], wing: [28, 96, 86], pattern: 'feathers', bump: 0.25 },
  cardeal: { base: [222, 218, 208], accent: [208, 42, 34], throat: [208, 42, 34], beak: [212, 168, 84], pattern: 'toucan', bump: 0.3 },
  canario: { base: [242, 200, 40], accent: [214, 136, 28], wing: [226, 178, 34], pattern: 'feathers', bump: 0.28 },
  periquito: { base: [76, 166, 56], accent: [230, 214, 68], wing: [56, 128, 48], pattern: 'feathers', bump: 0.3 },
  papagaio: { base: [58, 150, 54], accent: [232, 196, 42], wing: [44, 118, 46], beak: [58, 54, 52], pattern: 'feathers', bump: 0.3 },
  coruja: { base: [142, 112, 82], accent: [238, 226, 204], belly: [226, 212, 188], pattern: 'spots', bump: 0.38 },
  gaviao: { base: [108, 92, 76], accent: [216, 202, 182], belly: [212, 198, 178], pattern: 'barred_hawk', bump: 0.35 },
  urubu: { base: [36, 36, 40], accent: [68, 68, 76], beak: [122, 116, 108], pattern: 'feathers', bump: 0.32 },
  pica_pau: { base: [38, 38, 42], accent: [204, 42, 34], belly: [232, 228, 218], pattern: 'stripe', bump: 0.32 },
  pombo: { base: [142, 136, 148], accent: [232, 230, 236], wing: [112, 108, 120], pattern: 'feathers', bump: 0.3 },
  rolinha: { base: [166, 110, 88], accent: [106, 72, 60], wing: [134, 88, 70], pattern: 'feathers', bump: 0.3 },
  martim_pescador: { base: [68, 106, 140], accent: [196, 94, 44], belly: [196, 94, 44], pattern: 'belly', bump: 0.3 },
  colhereiro: { base: [232, 140, 165], accent: [200, 78, 114], wing: [214, 104, 138], pattern: 'feathers', bump: 0.3 },
  guara: { base: [216, 52, 42], accent: [42, 30, 30], wing: [188, 40, 34], pattern: 'feathers', bump: 0.3 },
  sanhaco: { base: [126, 162, 184], accent: [78, 120, 150], wing: [96, 136, 166], pattern: 'feathers', bump: 0.3 },
  tie_sangue: { base: [212, 34, 34], accent: [30, 28, 30], wing: [36, 32, 34], pattern: 'feathers', bump: 0.3 },
  joao_de_barro: { base: [180, 106, 56], accent: [232, 220, 200], belly: [230, 218, 198], pattern: 'belly', bump: 0.3 },
  andorinha: { base: [40, 56, 94], accent: [240, 238, 232], belly: [240, 238, 232], pattern: 'belly', bump: 0.28 },
};

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

function hash2i(ix, iy, seed) {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2i(ix, iy, seed);
  const b = hash2i(ix + 1, iy, seed);
  const c = hash2i(ix, iy + 1, seed);
  const d = hash2i(ix + 1, iy + 1, seed);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}

function fbm(x, y, seed, octaves = 3) {
  let sum = 0, amp = 0.55, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 31) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function mixRGB(a, b, t) {
  const k = clamp01(t);
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

function shadeRGB(rgb, mul) {
  return [
    Math.max(0, Math.min(255, Math.round(rgb[0] * mul))),
    Math.max(0, Math.min(255, Math.round(rgb[1] * mul))),
    Math.max(0, Math.min(255, Math.round(rgb[2] * mul))),
  ];
}

export function generateAnimalTextureData(species, size = 128) {
  const spec = ANIMAL_SPECIES[species] || {};
  const cfg = SPECIES_PATTERNS[species] || {
    base: [((spec.color ?? 0xc8bfa8) >> 16) & 255, ((spec.color ?? 0xc8bfa8) >> 8) & 255, (spec.color ?? 0xc8bfa8) & 255],
    accent: [((spec.accentColor ?? 0x4a3b2c) >> 16) & 255, ((spec.accentColor ?? 0x4a3b2c) >> 8) & 255, (spec.accentColor ?? 0x4a3b2c) & 255],
    pattern: 'fur',
    bump: 0.35,
  };
  const seed = species.split('').reduce((s, ch, i) => s + ch.charCodeAt(0) * (i + 3), 17);
  const diffuse = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;

      // Directional organic fur/feather grain
      const macro = fbm(u * 6.5, v * 6.5, seed + 5, 2);
      const furGrain = fbm(u * 22, v * 46, seed + 19, 2);
      const fine = valueNoise(u * 52, v * 52, seed + 41);

      let rgb = mixRGB(cfg.base, cfg.accent, (macro - 0.5) * 0.16 + (furGrain - 0.5) * 0.12);
      let h = 0.45 + furGrain * 0.35 + fine * 0.12;

      // Anatomical masks in normalized animal UV space (u: tail->nose, v: feet->back)
      const bellyMask = smoothstep(0.16, 0.30, u) * (1 - smoothstep(0.56, 0.72, u))
        * smoothstep(0.22, 0.32, v) * (1 - smoothstep(0.42, 0.54, v));
      const dorsalMask = smoothstep(0.54, 0.78, v);
      const hoofMask = 1 - smoothstep(0.05, 0.11, v);

      switch (cfg.pattern) {
        case 'spots': {
          const patch = fbm(u * 4.8 + macro * 0.4, v * 4.8 + macro * 0.4, seed + 101, 3);
          const spotT = smoothstep(0.53, 0.61, patch);
          rgb = mixRGB(rgb, cfg.accent, spotT * 0.94);
          if (cfg.belly) rgb = mixRGB(rgb, cfg.belly, bellyMask * (1 - spotT * 0.7) * 0.55);
          if (cfg.muzzle) {
            const muz = smoothstep(0.82, 0.92, u) * (1 - smoothstep(0.48, 0.62, v));
            rgb = mixRGB(rgb, cfg.muzzle, muz * 0.9);
          }
          h = 0.48 + furGrain * 0.26;
          break;
        }
        case 'rosettes': {
          const gx = u * 9.5 + (macro - 0.5) * 0.5, gy = v * 9.5 + (macro - 0.5) * 0.5;
          const cx = Math.floor(gx) + 0.5 + (hash2i(Math.floor(gx), Math.floor(gy), seed + 7) - 0.5) * 0.36;
          const cy = Math.floor(gy) + 0.5 + (hash2i(Math.floor(gx), Math.floor(gy), seed + 13) - 0.5) * 0.36;
          const d = Math.hypot(gx - cx, gy - cy);
          const ring = smoothstep(0.16, 0.24, d) * (1 - smoothstep(0.32, 0.41, d));
          const centerWarm = (1 - smoothstep(0.12, 0.22, d)) * 0.35;
          const bodyArea = smoothstep(0.14, 0.28, v);
          rgb = mixRGB(rgb, [186, 118, 38], centerWarm * bodyArea);
          rgb = mixRGB(rgb, cfg.accent, ring * (0.65 + 0.35 * bodyArea));
          if (cfg.belly) rgb = mixRGB(rgb, cfg.belly, bellyMask * 0.78);
          h = 0.48 + furGrain * 0.28;
          break;
        }
        case 'scales': {
          const sx = u * 20 + (Math.floor(v * 20) % 2) * 0.5;
          const sy = v * 20;
          const fx = (sx - Math.floor(sx)) - 0.5, fy = (sy - Math.floor(sy)) - 0.5;
          const scaleBump = clamp01(1 - Math.hypot(fx, fy) * 1.45);
          const dorsalRidge = smoothstep(0.56, 0.74, v) * smoothstep(0.12, 0.25, u) * (1 - smoothstep(0.75, 0.9, u));
          rgb = mixRGB(rgb, cfg.accent, (1 - scaleBump) * 0.48 + dorsalRidge * 0.45);
          if (cfg.belly) rgb = mixRGB(rgb, cfg.belly, bellyMask * 0.85);
          h = 0.25 + scaleBump * 0.65 + dorsalRidge * 0.1;
          break;
        }
        case 'armor': {
          const inShell = smoothstep(0.24, 0.32, u) * (1 - smoothstep(0.68, 0.78, u)) * smoothstep(0.22, 0.32, v);
          const bandWave = Math.sin(u * 64 + Math.sin(v * 10) * 0.6);
          const groove = smoothstep(0.35, 0.75, bandWave) * inShell;
          rgb = mixRGB(rgb, cfg.accent, groove * 0.72);
          if (cfg.belly) rgb = mixRGB(rgb, cfg.belly, bellyMask * (1 - inShell * 0.8) * 0.7);
          h = inShell ? (0.78 - groove * 0.52) : (0.42 + furGrain * 0.22);
          break;
        }
        case 'ringed_tail': {
          const tail = 1 - smoothstep(0.22, 0.36, u);
          const ring = smoothstep(0.2, 0.65, Math.sin(u * 58)) * tail;
          const mask = smoothstep(0.72, 0.82, u) * smoothstep(0.46, 0.58, v) * (1 - smoothstep(0.68, 0.76, v));
          rgb = mixRGB(rgb, cfg.accent, ring * 0.88 + mask * 0.65);
          if (cfg.belly) rgb = mixRGB(rgb, cfg.belly, bellyMask * 0.65);
          h = 0.46 + furGrain * 0.32;
          break;
        }
        case 'barred_hawk': {
          const breast = smoothstep(0.48, 0.62, u) * (1 - smoothstep(0.74, 0.84, u)) * (1 - smoothstep(0.55, 0.68, v));
          const bar = smoothstep(0.25, 0.65, Math.sin(v * 68 + u * 8));
          rgb = mixRGB(rgb, cfg.belly || cfg.accent, breast * (0.45 + bar * 0.45));
          const feather = smoothstep(0.3, 0.7, Math.sin(u * 42 + Math.cos(v * 24) * 0.7));
          rgb = mixRGB(rgb, cfg.accent, (1 - breast) * feather * 0.24);
          h = 0.52 - feather * 0.16 + furGrain * 0.16;
          break;
        }
        case 'wool': {
          const isFace = smoothstep(0.70, 0.80, u);
          const isLegs = 1 - smoothstep(0.18, 0.26, v);
          const fleeceArea = (1 - isFace) * (1 - isLegs);
          const curl = 0.5 + 0.5 * Math.sin(u * 46 + macro * 5) * Math.cos(v * 46 + furGrain * 4);
          rgb = mixRGB(rgb, cfg.accent, fleeceArea * (1 - curl) * 0.45);
          if (cfg.face) rgb = mixRGB(rgb, cfg.face, Math.max(isFace, isLegs * 0.9) * 0.88);
          h = fleeceArea ? (0.35 + curl * 0.6) : (0.42 + furGrain * 0.15);
          break;
        }
        case 'band': {
          const diag = Math.abs((u - 0.54) - (v - 0.5) * 0.55);
          const whiteStripe = (1 - smoothstep(0.06, 0.10, diag)) * smoothstep(0.20, 0.32, v);
          const blackBand = (1 - smoothstep(0.02, 0.055, diag)) * smoothstep(0.20, 0.32, v);
          rgb = mixRGB(rgb, cfg.accent, whiteStripe * 0.95);
          rgb = mixRGB(rgb, [34, 30, 28], blackBand * 0.9);
          h = 0.46 + furGrain * 0.34;
          break;
        }
        case 'mane_socks': {
          const socks = 1 - smoothstep(0.16, 0.24, v);
          const mane = smoothstep(0.50, 0.60, u) * (1 - smoothstep(0.76, 0.86, u)) * smoothstep(0.60, 0.72, v);
          const muzzle = cfg.muzzle ? smoothstep(0.84, 0.94, u) * (1 - smoothstep(0.56, 0.68, v)) : 0;
          rgb = mixRGB(rgb, cfg.accent, Math.max(socks, mane) * 0.9);
          if (cfg.muzzle) rgb = mixRGB(rgb, cfg.muzzle, muzzle * 0.8);
          if (cfg.belly) rgb = mixRGB(rgb, cfg.belly, bellyMask * 0.45);
          h = 0.46 + furGrain * 0.3;
          break;
        }
        case 'fawn': {
          const flank = smoothstep(0.22, 0.34, u) * (1 - smoothstep(0.62, 0.72, u)) * smoothstep(0.38, 0.50, v) * (1 - smoothstep(0.62, 0.72, v));
          const spotCell = valueNoise(u * 18, v * 18, seed + 55);
          const fawnSpot = smoothstep(0.68, 0.78, spotCell) * flank;
          const tailWhite = (1 - smoothstep(0.08, 0.16, u)) * smoothstep(0.36, 0.52, v);
          rgb = mixRGB(rgb, cfg.belly || cfg.accent, Math.max(bellyMask * 0.85, tailWhite * 0.9));
          rgb = mixRGB(rgb, cfg.accent, fawnSpot * 0.82);
          h = 0.48 + furGrain * 0.25;
          break;
        }
        case 'toucan': {
          const throat = smoothstep(0.54, 0.62, u) * (1 - smoothstep(0.74, 0.82, u)) * smoothstep(0.34, 0.46, v) * (1 - smoothstep(0.64, 0.74, v));
          const beak = smoothstep(0.76, 0.82, u);
          const beakTip = smoothstep(0.92, 0.97, u);
          if (cfg.throat) rgb = mixRGB(rgb, cfg.throat, throat * 0.95);
          rgb = mixRGB(rgb, cfg.beak || cfg.accent, beak * 0.96);
          rgb = mixRGB(rgb, [24, 24, 28], beakTip * 0.88);
          h = beak > 0.5 ? 0.52 : (0.48 + furGrain * 0.24);
          break;
        }
        case 'mallard': {
          const head = smoothstep(0.66, 0.74, u) * smoothstep(0.46, 0.56, v);
          const collar = smoothstep(0.62, 0.65, u) * (1 - smoothstep(0.66, 0.69, u)) * smoothstep(0.42, 0.58, v);
          const beak = smoothstep(0.84, 0.89, u) * (1 - smoothstep(0.62, 0.72, v));
          const wing = smoothstep(0.24, 0.36, u) * (1 - smoothstep(0.58, 0.66, u)) * smoothstep(0.36, 0.58, v);
          rgb = mixRGB(rgb, cfg.wing || cfg.base, wing * 0.65);
          rgb = mixRGB(rgb, cfg.accent, head * (1 - beak) * 0.95);
          rgb = mixRGB(rgb, [242, 240, 234], collar * 0.9);
          rgb = mixRGB(rgb, cfg.beak || cfg.accent, beak * 0.96);
          h = 0.48 + furGrain * 0.25;
          break;
        }
        case 'feathers':
        case 'feathers_comb': {
          const featherArc = Math.sin(u * 40 + Math.cos(v * 26) * 0.8) * 0.5 + 0.5;
          const wing = smoothstep(0.22, 0.34, u) * (1 - smoothstep(0.60, 0.68, u)) * smoothstep(0.34, 0.58, v);
          if (cfg.wing) rgb = mixRGB(rgb, cfg.wing, wing * 0.72);
          rgb = mixRGB(rgb, cfg.accent, featherArc * 0.16 * (1 - wing * 0.4));
          if (cfg.pattern === 'feathers_comb') {
            const comb = smoothstep(0.70, 0.78, u) * (1 - smoothstep(0.86, 0.92, u)) * smoothstep(0.72, 0.82, v);
            const wattle = smoothstep(0.76, 0.84, u) * (1 - smoothstep(0.88, 0.94, u)) * (1 - smoothstep(0.46, 0.54, v)) * smoothstep(0.34, 0.42, v);
            rgb = mixRGB(rgb, cfg.accent, Math.max(comb, wattle) * 0.95);
          }
          if (cfg.beak) {
            const beak = smoothstep(0.85, 0.91, u);
            rgb = mixRGB(rgb, cfg.beak, beak * 0.92);
          }
          h = 0.55 - featherArc * 0.2 + furGrain * 0.18;
          break;
        }
        case 'stripe': {
          const dorsalLine = smoothstep(0.68, 0.82, v) * (1 - smoothstep(0.84, 0.92, u));
          const browStripe = smoothstep(0.62, 0.72, u) * (1 - smoothstep(0.86, 0.94, u)) * smoothstep(0.58, 0.66, v) * (1 - smoothstep(0.72, 0.80, v));
          rgb = mixRGB(rgb, cfg.accent, Math.max(dorsalLine, browStripe) * 0.82);
          if (cfg.belly) rgb = mixRGB(rgb, cfg.belly, bellyMask * 0.78);
          h = 0.48 + furGrain * 0.28;
          break;
        }
        case 'belly': {
          rgb = mixRGB(rgb, cfg.belly || cfg.accent, bellyMask * 0.86);
          if (cfg.muzzle) {
            const muz = smoothstep(0.84, 0.93, u) * (1 - smoothstep(0.52, 0.64, v));
            rgb = mixRGB(rgb, cfg.muzzle, muz * 0.75);
          }
          h = 0.48 + furGrain * 0.28;
          break;
        }
        case 'shoulder': {
          const shoulder = smoothstep(0.46, 0.58, u) * (1 - smoothstep(0.74, 0.84, u)) * smoothstep(0.42, 0.72, v);
          rgb = mixRGB(rgb, cfg.accent, shoulder * 0.65);
          if (cfg.belly) rgb = mixRGB(rgb, cfg.belly, bellyMask * 0.55);
          if (cfg.muzzle) rgb = mixRGB(rgb, cfg.muzzle, smoothstep(0.84, 0.93, u) * 0.7);
          h = 0.48 + furGrain * 0.28;
          break;
        }
        case 'bristle': {
          const crest = smoothstep(0.62, 0.78, v) * smoothstep(0.28, 0.42, u) * (1 - smoothstep(0.72, 0.84, u));
          const tusk = smoothstep(0.85, 0.93, u) * smoothstep(0.36, 0.46, v) * (1 - smoothstep(0.52, 0.58, v));
          rgb = mixRGB(rgb, [46, 38, 34], crest * 0.65);
          if (cfg.muzzle) rgb = mixRGB(rgb, cfg.muzzle, smoothstep(0.84, 0.94, u) * (1 - smoothstep(0.50, 0.62, v)) * 0.8);
          rgb = mixRGB(rgb, [224, 214, 194], tusk * 0.92);
          h = 0.45 + furGrain * 0.4;
          break;
        }
        case 'shaggy': {
          const faceMask = smoothstep(0.70, 0.80, u) * smoothstep(0.44, 0.56, v) * (1 - smoothstep(0.72, 0.82, v));
          const moss = smoothstep(0.56, 0.72, macro) * dorsalMask;
          rgb = mixRGB(rgb, cfg.accent, moss * 0.65);
          if (cfg.face) rgb = mixRGB(rgb, cfg.face, faceMask * 0.85);
          h = 0.42 + furGrain * 0.45;
          break;
        }
        case 'mottled': {
          const blotch = smoothstep(0.52, 0.68, macro);
          rgb = mixRGB(rgb, cfg.accent, blotch * 0.48);
          if (cfg.muzzle) rgb = mixRGB(rgb, cfg.muzzle, smoothstep(0.84, 0.94, u) * (1 - smoothstep(0.48, 0.62, v)) * 0.85);
          if (cfg.belly) rgb = mixRGB(rgb, cfg.belly, bellyMask * 0.45);
          h = 0.48 + furGrain * 0.2;
          break;
        }
        default: {
          if (cfg.belly) rgb = mixRGB(rgb, cfg.belly, bellyMask * 0.55);
          if (cfg.muzzle) rgb = mixRGB(rgb, cfg.muzzle, smoothstep(0.84, 0.94, u) * (1 - smoothstep(0.48, 0.62, v)) * 0.75);
          h = 0.46 + furGrain * 0.32;
        }
      }

      // Subtle natural countershading & hooves/claws
      const counterShade = 1.04 - dorsalMask * 0.10 - hoofMask * 0.14;
      rgb = mixRGB(rgb, [46, 38, 34], hoofMask * 0.45);

      // Subtle dark eye + tiny specular glint near head
      const eyeD = Math.hypot((u - 0.76) * 1.1, v - 0.62);
      if (eyeD < 0.036) {
        const eyeT = 1 - smoothstep(0.016, 0.036, eyeD);
        rgb = mixRGB(rgb, [20, 18, 18], eyeT * 0.92);
        const glint = Math.hypot(u - 0.768, v - 0.628);
        if (glint < 0.011) rgb = mixRGB(rgb, [235, 235, 240], 0.65);
      }

      const [r, g, b] = shadeRGB(rgb, counterShade);
      const idx = (y * size + x) * 4;
      diffuse[idx] = r;
      diffuse[idx + 1] = g;
      diffuse[idx + 2] = b;
      diffuse[idx + 3] = 255;
      height[y * size + x] = h;
    }
  }

  // Tangent-space normal map with gentle organic relief
  const normal = new Uint8Array(size * size * 4);
  const strength = 0.85 * (cfg.bump ?? 0.35) * (size / 64);
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

export function createAnimalSpeciesTextures(THREE, species, size = 128) {
  const { diffuse, normal } = generateAnimalTextureData(species, size);
  const filter = THREE.LinearFilter ?? THREE.NearestFilter;
  const makeTex = (data, srgb) => {
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.magFilter = filter;
    tex.minFilter = filter;
    tex.wrapS = THREE.ClampToEdgeWrapping ?? THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping ?? THREE.RepeatWrapping;
    if (srgb && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };
  return {
    map: makeTex(diffuse, true),
    normalMap: makeTex(normal, false),
  };
}
