// Procedural textures and height-derived normal maps for informal favela shelters:
// corrugated cardboard (papelão), rough plywood (madeirite), woven tarp (lona),
// and corrugated metal sheets (zinco).
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

export function shackSurfacePixels(kind = 'cardboard', variant = 0, size = 64) {
  const data = new Uint8ClampedArray(size * size * 4);
  const heights = new Float32Array(size * size);
  const seed = Math.imul(variant + 1, 0x45d9f3b) ^ Math.imul(kind.length + 3, 0x9e3779b1);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const p = idx * 4;
      const fine = hash2(x, y, seed + 19);
      let lum = 225;
      let h = 0.5;
      let tintR = 1;
      let tintG = 1;
      let tintB = 1;

      if (kind === 'cardboard') {
        // Corrugated kraft cardboard: visible parallel flute ribs, fibrous speckle, fold creases
        const flute = Math.sin(u * Math.PI * 2 * 10) * 0.5 + 0.5;
        const fiber = periodicNoise(u, v, 16, seed + 71) * 0.6 + periodicNoise(u, v, 32, seed + 113) * 0.4;
        const crease = Math.abs(((v + 0.25) % 0.5) - 0.25) < 0.03 ? 1 : 0;
        const tape = u > 0.36 && u < 0.52 && v > 0.1 && v < 0.85 ? 0.4 : 0;
        h = clamp(0.4 + flute * 0.34 + (fiber - 0.5) * 0.16 - crease * 0.3 + tape * 0.1 + (fine - 0.5) * 0.06);
        lum = 198 + flute * 34 + (fiber - 0.5) * 34 - crease * 60 + tape * 26 + (fine - 0.5) * 18;
        tintR = 1.05;
        tintG = 0.96;
        tintB = 0.84;
      } else if (kind === 'plywood') {
        // Rough madeirite plywood: elongated wood grain, knots, board seams
        const grain = periodicNoise(u * 0.5 + periodicNoise(u, v, 4, seed + 31) * 0.18, v * 4, 8, seed + 59);
        const knotDist = Math.hypot((u - 0.34) * 1.4, (v - 0.62) * 2.2);
        const knot = clamp(1 - knotDist / 0.15);
        const seam = (y % 32 <= 1 || x % 32 <= 1) ? 1 : 0;
        h = clamp(0.46 + (grain - 0.5) * 0.38 - knot * 0.26 - seam * 0.32 + (fine - 0.5) * 0.07);
        lum = 204 + (grain - 0.5) * 56 - knot * 60 - seam * 68 + (fine - 0.5) * 16;
        tintR = 1.03;
        tintG = 0.94;
        tintB = 0.84;
      } else if (kind === 'tarp') {
        // Woven plastic/canvas tarp: cross-hatch weave + diagonal fold creases
        const weaveX = Math.sin(u * Math.PI * 2 * 16) * 0.5 + 0.5;
        const weaveY = Math.sin(v * Math.PI * 2 * 16) * 0.5 + 0.5;
        const weave = (weaveX + weaveY) * 0.5;
        const fold = Math.sin((u * 2 + v * 3 + periodicNoise(u, v, 4, seed + 97) * 0.8) * Math.PI * 2) * 0.5 + 0.5;
        const scuff = periodicNoise(u, v, 8, seed + 139);
        h = clamp(0.35 + weave * 0.28 + fold * 0.32 + (fine - 0.5) * 0.05);
        lum = 196 + weave * 28 + fold * 38 + (scuff - 0.5) * 26 + (fine - 0.5) * 12;
      } else {
        // Corrugated metal sheet (zinco): deep ribs + rust/oxide streaks
        const rib = Math.sin(u * Math.PI * 2 * 7) * 0.5 + 0.5;
        const rustNoise = periodicNoise(u, v, 6, seed + 211);
        const rust = clamp((rustNoise - 0.52) * 2.8);
        h = clamp(0.16 + rib * 0.74 + (fine - 0.5) * 0.05 - rust * 0.08);
        lum = 182 + rib * 64 + (fine - 0.5) * 16;
        tintR = mix(0.95, 1.18, rust);
        tintG = mix(0.98, 0.70, rust);
        tintB = mix(1.03, 0.52, rust);
      }

      heights[idx] = h;
      data[p] = clamp(Math.round(lum * tintR), 0, 255);
      data[p + 1] = clamp(Math.round(lum * tintG), 0, 255);
      data[p + 2] = clamp(Math.round(lum * tintB), 0, 255);
      data[p + 3] = 255;
    }
  }

  const normals = new Uint8ClampedArray(size * size * 4);
  const strength = kind === 'corrugated' ? 3.2 : kind === 'plywood' ? 2.1 : kind === 'cardboard' ? 2.2 : 1.7;
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

export function shackSurfaceTextures(THREE, kind = 'cardboard', variant = 0) {
  let textures = cache.get(THREE);
  if (!textures) {
    textures = new Map();
    cache.set(THREE, textures);
  }
  const key = `${kind}:${variant}`;
  if (textures.has(key)) return textures.get(key);

  const pixels = shackSurfacePixels(kind, variant);
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
