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
  piece.support.surface = 'wall';
  assert.equal(graffitiInkColor(city, piece, { color: 0x7a6550 }), 0xffffff);

  // Too-bright color on light hacienda wall falls back to dark ink for contrast
  building.architecture = 'hacienda';
  assert.equal(graffitiInkColor(city, piece, { color: 0xfefefe }), 0x1b1a20);
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
