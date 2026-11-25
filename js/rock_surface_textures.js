// Procedural seamless natural rock surfaces (coastal granite, mountain slate, alpine peak).
// Generates both albedo and height-derived normal maps with toroidal wrapping so
// adjacent terrain tiles and cliff faces connect without grid seams.
const cache = new WeakMap();

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

function hash2(x, y, seed = 0) {
  let n = Math.imul((x | 0) ^ Math.imul(y | 0, 374761393) ^ (seed | 0), 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n >>> 0) / 4294967295;
}

function periodicNoise(u, v, period, seed) {
  const x = u * period;
  const y = v * period;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const x0 = ((ix % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y0 = ((iy % period) + period) % period;
  const y1 = (y0 + 1) % period;
  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);
  return mix(mix(a, b, fx), mix(c, d, fx), fy);
}

function periodicFbm(u, v, basePeriod, octaves, seed) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let period = basePeriod;
  for (let i = 0; i < octaves; i++) {
    sum += periodicNoise(u, v, period, seed + i * 977) * amp;
    norm += amp;
    amp *= 0.5;
    period *= 2;
  }
  return sum / norm;
}

function periodicVoronoi(u, v, cells, jitter, seed) {
  const gx = u * cells;
  const gy = v * cells;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  let nearest = 1e9;
  let second = 1e9;
  let cellId = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = ix + ox;
      const cy = iy + oy;
      const wx = ((cx % cells) + cells) % cells;
      const wy = ((cy % cells) + cells) % cells;
      const px = cx + 0.5 + (hash2(wx, wy, seed + 101) - 0.5) * jitter;
      const py = cy + 0.5 + (hash2(wx, wy, seed + 307) - 0.5) * jitter;
      const dx = gx - px;
      const dy = gy - py;
      const d = Math.hypot(dx, dy);
      if (d < nearest) {
        second = nearest;
        nearest = d;
        cellId = hash2(wx, wy, seed + 613);
      } else if (d < second) {
        second = d;
      }
    }
  }
  return { nearest, edge: second - nearest, cellId };
}

const STYLE_PALETTES = {
  rock: {
    base: [108, 107, 100],
    light: [152, 146, 132],
    dark: [64, 65, 62],
    crevice: [42, 43, 41],
    accent: [128, 108, 82], // weathered ochre / iron-oxide
    moss: [88, 99, 72],     // subtle coastal lichen
    cells: 5,
    strataFreq: 3,
    ridgeStrength: 0.48,
  },
  mountain: {
    base: [84, 88, 90],
    light: [128, 130, 126],
    dark: [47, 51, 54],
    crevice: [29, 32, 35],
    accent: [106, 94, 80],
    moss: [66, 75, 66],
    cells: 6,
    strataFreq: 4,
    ridgeStrength: 0.56,
  },
  peak: {
    base: [132, 136, 139],
    light: [188, 189, 184],
    dark: [78, 84, 90],
    crevice: [48, 53, 59],
    accent: [156, 149, 134],
    moss: [120, 126, 124],
    cells: 7,
    strataFreq: 5,
    ridgeStrength: 0.62,
  },
};

export function rockSurfacePixels(style = 'rock', variant = 0, size = 128) {
  const pal = STYLE_PALETTES[style] || STYLE_PALETTES.rock;
  const seed = Math.imul(variant + 1, 0x45d9f3b) ^ Math.imul(style.length + 7, 0x9e3779b1);
  const data = new Uint8ClampedArray(size * size * 4);
  const heights = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const p = idx * 4;

      // Domain warp for natural irregular rock fractures
      const warpU = (periodicFbm(u, v, 3, 3, seed + 17) - 0.5) * 0.16;
      const warpV = (periodicFbm(u + 0.37, v + 0.71, 3, 3, seed + 53) - 0.5) * 0.16;
      const wu = u + warpU;
      const wv = v + warpV;

      // Macro & meso Voronoi rock plates
      const macro = periodicVoronoi(wu, wv, pal.cells, 0.84, seed + 131);
      const meso = periodicVoronoi(wu + 0.19, wv + 0.43, pal.cells * 2, 0.88, seed + 277);

      // Layered strata & ridged rock relief
      const fbm = periodicFbm(wu, wv, 4, 4, seed + 409);
      const strata = Math.sin((wu * 0.7 + wv * pal.strataFreq + fbm * 1.8) * Math.PI * 2) * 0.5 + 0.5;
      const ridged = 1 - Math.abs(periodicFbm(wu + 0.5, wv + 0.2, 6, 3, seed + 601) * 2 - 1);

      // Fracture seams from Voronoi edges
      const macroCrack = clamp(1 - macro.edge / 0.13);
      const mesoCrack = clamp(1 - meso.edge / 0.11) * 0.65;
      const crack = Math.max(macroCrack, mesoCrack * (0.4 + 0.6 * fbm));
      const bevel = clamp(macro.edge / 0.24);

      // Fine crystalline grain
      const fine = hash2(x, y, seed + 907);
      const grain = (fine - 0.5) * 18 + (periodicNoise(u, v, 32, seed + 811) - 0.5) * 12;
      const fleck = fine > 0.985 ? 22 : fine < 0.015 ? -20 : 0;

      // Heightfield: rock plates rise smoothly with ridges, drop sharply in cracks
      const plateHeight = 0.35 + macro.cellId * 0.18 + bevel * 0.22 + ridged * pal.ridgeStrength * 0.28 + strata * 0.10;
      const h = clamp(plateHeight * (1 - crack * 0.72) + (fine - 0.5) * 0.035);
      heights[idx] = h;

      // Color mixing: dark base -> mid rock -> sunlit ridge, plus mineral & lichen patches
      const tone = clamp(0.25 + bevel * 0.35 + fbm * 0.28 + ridged * 0.22 + (macro.cellId - 0.5) * 0.22);
      const r0 = mix(pal.dark[0], pal.base[0], clamp(tone * 1.4));
      const g0 = mix(pal.dark[1], pal.base[1], clamp(tone * 1.4));
      const b0 = mix(pal.dark[2], pal.base[2], clamp(tone * 1.4));

      const hi = clamp((tone - 0.45) * 1.8);
      let r = mix(r0, pal.light[0], hi);
      let g = mix(g0, pal.light[1], hi);
      let b = mix(b0, pal.light[2], hi);

      // Subtle iron-oxide / mineral veining
      const mineralMask = clamp((periodicFbm(u + 0.11, v + 0.63, 4, 2, seed + 733) - 0.54) * 2.6);
      r = mix(r, pal.accent[0], mineralMask * 0.45);
      g = mix(g, pal.accent[1], mineralMask * 0.45);
      b = mix(b, pal.accent[2], mineralMask * 0.45);

      // Subtle lichen/moss on flatter rock foothills
      if (style === 'rock') {
        const mossMask = clamp((periodicFbm(u + 0.73, v + 0.29, 5, 2, seed + 887) - 0.60) * 2.8) * (1 - crack);
        r = mix(r, pal.moss[0], mossMask * 0.38);
        g = mix(g, pal.moss[1], mossMask * 0.38);
        b = mix(b, pal.moss[2], mossMask * 0.38);
      }

      // Darken crevices/cracks
      const ao = crack * 0.78;
      r = mix(r, pal.crevice[0], ao) + grain + fleck;
      g = mix(g, pal.crevice[1], ao) + grain + fleck;
      b = mix(b, pal.crevice[2], ao) + grain + fleck;

      data[p] = clamp(Math.round(r), 0, 255);
      data[p + 1] = clamp(Math.round(g), 0, 255);
      data[p + 2] = clamp(Math.round(b), 0, 255);
      data[p + 3] = 255;
    }
  }

  // Derive smooth wrapped normal map directly from the rock heightfield
  const normals = new Uint8ClampedArray(size * size * 4);
  const strength = style === 'peak' ? 2.4 : style === 'mountain' ? 2.2 : 1.9;
  const hAt = (x, y) => heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = (y * size + x) * 4;
      const dx = (hAt(x + 1, y - 1) + 2 * hAt(x + 1, y) + hAt(x + 1, y + 1) - hAt(x - 1, y - 1) - 2 * hAt(x - 1, y) - hAt(x - 1, y + 1)) * strength;
      const dy = (hAt(x - 1, y + 1) + 2 * hAt(x, y + 1) + hAt(x + 1, y + 1) - hAt(x - 1, y - 1) - 2 * hAt(x, y - 1) - hAt(x + 1, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      normals[p] = (-dx / len * 0.5 + 0.5) * 255;
      normals[p + 1] = (-dy / len * 0.5 + 0.5) * 255;
      normals[p + 2] = (1 / len * 0.5 + 0.5) * 255;
      normals[p + 3] = 255;
    }
  }

  return { size, data, normals };
}

export function rockSurfaceTextures(THREE, style = 'rock', variant = 0) {
  let textures = cache.get(THREE);
  if (!textures) {
    textures = new Map();
    cache.set(THREE, textures);
  }
  const key = `${style}:${variant}`;
  if (textures.has(key)) return textures.get(key);

  const pixels = rockSurfacePixels(style, variant);
  const make = (data, color) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = pixels.size;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(pixels.size, pixels.size);
    image.data.set(data);
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  const result = { map: make(pixels.data, true), normalMap: make(pixels.normals, false) };
  textures.set(key, result);
  return result;
}
