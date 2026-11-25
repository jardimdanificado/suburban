import test from 'node:test';
import assert from 'node:assert/strict';
import { pickGraffitiColor, dislikesColor } from '../js/city_colors.js';
import { GRAFFITI_STYLES } from '../js/city_justice.js';
import { graffitiInkColor, syncUrbanArt } from '../js/city_renderer_3d.js';

class Group {
  constructor() {
    this.children = [];
    this.userData = {};
    this.position = { set: (...v) => (this.xyz = v) };
    this.rotation = { y: 0 };
    this.visible = true;
  }
  add(o) { this.children.push(o); }
  traverse(f) { f(this); for (const o of this.children) o.traverse?.(f); }
}
class Mesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.position = { set: (...v) => (this.xyz = v) };
    this.isMesh = true;
  }
  traverse(f) { f(this); }
}
class Geometry { constructor(...args) { this.args = args; } dispose() {} }
class BufferGeometry extends Geometry {
  constructor() { super(); this.attributes = {}; }
  setAttribute(name, value) { this.attributes[name] = value; }
  setIndex(value) { this.index = value; }
  computeVertexNormals() {}
}
class Attribute { constructor(values, size) { this.array = values; this.itemSize = size; } }
class Material { constructor(options = {}) { this.options = options; } dispose() {} }
class Texture { constructor(canvas) { this.canvas = canvas; } }
const THREE = {
  Group, Mesh, BufferGeometry, Float32BufferAttribute: Attribute,
  BoxGeometry: Geometry, PlaneGeometry: Geometry, CylinderGeometry: Geometry,
  SphereGeometry: Geometry, MeshLambertMaterial: Material, CanvasTexture: Texture,
  DoubleSide: 2, SRGBColorSpace: 'srgb'
};

function makeFakeCanvas(recordedFonts = [], recordedColors = []) {
  const canvas = { width: 0, height: 0 };
  const ctx = {
    canvas,
    font: '12px sans-serif',
    textAlign: 'center',
    textBaseline: 'middle',
    direction: 'ltr',
    fillStyle: '#fff',
    strokeStyle: '#fff',
    lineWidth: 1,
    fillRect() {},
    strokeRect() {},
    fillText() {
      recordedFonts.push(ctx.font);
      recordedColors.push(ctx.fillStyle);
    },
    getTransform() { return { transformPoint: p => p }; },
    measureText(text) { return { width: String(text).length * 10 }; },
    getImageData(x, y, width, height) { return { data: new Uint8ClampedArray(width * height * 4) }; },
    putImageData() {},
    drawImage() {},
    rect() {},
    clip() {},
    ellipse() {},
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    bezierCurveTo() {},
    arc() {},
    closePath() {},
    stroke() {},
    fill() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {}
  };
  canvas.getContext = () => ctx;
  return canvas;
}

test('pickGraffitiColor chooses non-disliked RGB colors biased toward tagger taste', () => {
  const citizen = { id: 7 };
  let step = 0;
  const rng = () => ((step = (step * 1664525 + 1013904223) >>> 0) / 4294967296);
  const picked = new Set();
  for (let i = 0; i < 20; i++) {
    const color = pickGraffitiColor(citizen, rng);
    assert.equal(Number.isInteger(color), true);
    assert.ok(color >= 0 && color <= 0xffffff);
    const hex = `#${color.toString(16).padStart(6, '0')}`;
    assert.equal(dislikesColor(citizen, hex), false);
    picked.add(color);
  }
  assert.ok(picked.size > 1, 'tagger should produce varied shades');
});

test('graffitiInkColor preserves high-contrast custom colors and enforces contrast when too low', () => {
  const building = { architecture: 'timber' }; // dark wall
  const city = { building: () => building };
  const piece = {
    color: 0xffe040, // bright yellow: high contrast on dark surfaces
    support: { kind: 'street-graffiti', surface: 'retaining', buildingId: 3 }
  };
  assert.equal(graffitiInkColor(city, piece), 0xffe040);
  piece.support.surface = 'ground';
  assert.equal(graffitiInkColor(city, piece), 0xffe040);
  piece.support.surface = 'wall';
  assert.equal(graffitiInkColor(city, piece), 0xffe040);

  // Dark color on dark retaining/ground falls back to white; medium brown on timber falls back to white
  piece.support.surface = 'ground';
  assert.equal(graffitiInkColor(city, piece, { color: 0x222128 }), 0xffffff);
  // Saturated custom low-contrast color preserves its hue by lifting lightness
  const lifted = graffitiInkColor(city, piece, { color: 0x882244 });
  assert.notEqual(lifted, 0xffffff);
  assert.notEqual(lifted, 0x882244);
  assert.ok((lifted >> 16 & 255) > (lifted >> 8 & 255), 'lifted rose preserves red dominance');
  piece.support.surface = 'wall';
  assert.notEqual(graffitiInkColor(city, piece, { color: 0x7a6550 }), 0x7a6550);

  // Too-bright color on light hacienda wall darkens for contrast
  building.architecture = 'hacienda';
  const darkened = graffitiInkColor(city, piece, { color: 0xfefefe });
  assert.ok(darkened < 0x909090, `expected darkened ink on light wall, got ${darkened.toString(16)}`);
  // Dark blue on light hacienda wall is preserved
  assert.equal(graffitiInkColor(city, piece, { color: 0x1e3a8a }), 0x1e3a8a);
});

test('street graffiti renders all font styles including irregular mixed letter sizes', () => {
  const originalDocument = globalThis.document;
  const fonts = [];
  globalThis.document = { createElement: () => makeFakeCanvas(fonts) };
  try {
    const building = { id: 3, width: 2, depth: 2, architecture: 'hacienda', entity: { x: 4, y: 4, destroyed: false }, terrain: { base: 0 }, floors: 1 };
    const world = { width: 16, height: 16, revision: 0, getTile: () => 0 };
    const pieces = GRAFFITI_STYLES.map((style, index) => ({
      id: index + 1,
      kind: 'graffiti',
      graffitiStyle: style,
      message: 'A Rua Vive',
      color: 0x225588,
      entity: { x: 4.5, y: 3.9, destroyed: false },
      support: {
        kind: 'street-graffiti',
        surface: 'wall',
        buildingId: 3,
        side: 0,
        position: { x: 4.5, y: 3.975, z: 0.9 },
        width: 0.86,
        height: 1.64,
        rotation: 0
      },
      layers: []
    }));
    const city = {
      world,
      buildings: [building],
      justice: { art: pieces },
      building: () => building
    };
    const renderer = { scene: { add() {}, remove() {} }, renderedMinTx: 0, renderedMaxTx: 16, renderedMinTy: 0, renderedMaxTy: 16 };
    syncUrbanArt(renderer, THREE, city, world);
    for (const piece of pieces) {
      const group = renderer.urbanArtMeshes.get(piece.id);
      assert.ok(group, `style ${piece.graffitiStyle} must render`);
      assert.equal(group.children.length, 1);
    }
    const distinctFonts = new Set(fonts);
    assert.ok(distinctFonts.size >= 4, `expected varied fonts/sizes, got ${distinctFonts.size}`);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('cleaning an active graffiti layer smears and fades pixels progressively', () => {
  const originalDocument = globalThis.document;
  let putCalls = 0;
  let lastAlphaSum = Infinity;
  globalThis.document = {
    createElement: () => {
      const canvas = makeFakeCanvas();
      const ctx = canvas.getContext('2d');
      ctx.getImageData = (x, y, w, h) => {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let py = 100; py < 140; py++) {
          for (let px = 60; px < 180; px++) {
            const idx = (py * w + px) * 4;
            data[idx] = 255; data[idx + 1] = 200; data[idx + 2] = 50; data[idx + 3] = 255;
          }
        }
        return { data };
      };
      ctx.putImageData = img => {
        if (img.data.length !== 256 * 256 * 4) return;
        putCalls++;
        let sum = 0;
        for (let i = 3; i < img.data.length; i += 4) sum += img.data[i];
        lastAlphaSum = sum;
      };
      return canvas;
    }
  };
  try {
    const building = { id: 3, width: 2, depth: 2, architecture: 'timber', entity: { x: 4, y: 4, destroyed: false }, terrain: { base: 0 }, floors: 1 };
    const world = { width: 16, height: 16, revision: 0, getTile: () => 0 };
    const piece = {
      id: 9,
      kind: 'graffiti',
      graffitiStyle: 'bomb',
      message: 'Poder Popular',
      color: 0xffd040,
      entity: { x: 4.5, y: 3.9, destroyed: false },
      support: { kind: 'street-graffiti', surface: 'wall', buildingId: 3, side: 0, position: { x: 4.5, y: 3.975, z: 0.9 }, width: 0.86, height: 1.64, rotation: 0 },
      layers: [{ id: 1, kind: 'graffiti', message: 'Poder Popular', color: 0xffd040, graffitiStyle: 'bomb' }]
    };
    const job = { kind: 'art-cleaning', artId: 9, layerId: 1, status: 'working', progress: 9, required: 18 };
    const city = { world, buildings: [building], justice: { art: [piece] }, gigs: { jobs: [job] }, building: () => building };
    const renderer = { scene: { add() {}, remove() {} }, renderedMinTx: 0, renderedMaxTx: 16, renderedMinTy: 0, renderedMaxTy: 16 };

    syncUrbanArt(renderer, THREE, city, world);
    assert.equal(putCalls, 1);
    const earlyAlpha = lastAlphaSum;
    assert.ok(earlyAlpha > 0 && earlyAlpha !== (40 * 120 * 255), 'early cleaning partially smears and fades ink');

    job.progress = 17;
    syncUrbanArt(renderer, THREE, city, world);
    assert.equal(putCalls, 2);
    assert.ok(lastAlphaSum < earlyAlpha, 'further scrubbing removes even more ink');
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('walking across ground graffiti smudges the paint and leaves colored footprints on shoes', async () => {
  const { TerrainTracks, TerrainTrackMotion, SandCarry, PaintCarry } = await import('../js/terrain_tracks.js');
  const tracker = Object.create(TerrainTracks.prototype);
  const painted = [];
  const paintFootprints = [];
  Object.assign(tracker, {
    time: 0,
    motion: new TerrainTrackMotion(),
    sandCarry: new SandCarry(),
    dirtCarry: new SandCarry(),
    paintCarry: new PaintCarry(),
    grassWear: { coverage: () => 0, record() {}, prune() {} },
    uniforms: { terrainTrackTime: { value: 0 } },
    ensureWorld() {},
    paint(_r, stamps) { painted.push(...stamps); },
    paintPaint(_r, stamps) { paintFootprints.push(...stamps); }
  });
  const world = { width: 16, height: 16, revision: 0, getTile: () => 8 };
  const groundPiece = {
    id: 42,
    kind: 'graffiti',
    message: 'Rua Viva',
    color: 0x33ddff,
    renderedInkColor: 0x33ddff,
    entity: { x: 5.5, y: 5.5, destroyed: false },
    support: { kind: 'street-graffiti', surface: 'ground', position: { x: 5.5, y: 5.5, z: 0 }, width: 0.86, height: 0.86 },
    layers: []
  };
  const city = { justice: { art: [groundPiece] } };
  const walker = { id: 1, x: 5.0, y: 5.5, properties: { citizen: {} } };

  // Start outside, then walk across the ground graffiti at (5.5, 5.5) and continue past it
  tracker.update({}, world, [walker], 0.1, null, null, null, city);
  walker.x = 5.6;
  tracker.update({}, world, [walker], 0.1, null, null, null, city);
  assert.ok((groundPiece.groundSmudges?.length || 0) >= 1, 'footsteps on ground graffiti record smudges');
  assert.ok((groundPiece.smudgeRevision || 0) >= 1);
  assert.ok((groundPiece.wearProgress || 0) > 0);

  // Walk further off the graffiti: shoes shed colored paint footprints
  walker.x = 6.8;
  tracker.update({}, world, [walker], 0.1, null, null, null, city);
  assert.ok(paintFootprints.length >= 1, 'shoes carry graffiti paint onto adjacent ground');
  assert.ok(paintFootprints.every(s => s.paintColor === 0x33ddff && s.paintLoad > 0));
});
