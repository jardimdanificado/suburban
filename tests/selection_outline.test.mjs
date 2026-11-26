import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureSmoothNormals, SelectionOutline, openCreatureInfoEntityId } from '../js/selection_outline.js';

function makeAttr(array, itemSize) {
  return {
    array,
    itemSize,
    count: array.length / itemSize,
    getX(i) { return array[i * itemSize]; },
    getY(i) { return array[i * itemSize + 1]; },
    getZ(i) { return array[i * itemSize + 2]; },
  };
}

function mockThree() {
  class Color { constructor(v) { this.value = v; } }
  class Vector2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; } }
  class BufferAttribute { constructor(array, itemSize) { return makeAttr(array, itemSize); } }
  class ShaderMaterial { constructor(opts) { Object.assign(this, opts); } }
  class Matrix4 { copy(m) { this.copied = m; return this; } }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.matrix = new Matrix4();
      this.visible = true;
    }
  }
  return { Color, Vector2, BufferAttribute, ShaderMaterial, Mesh, BackSide: 1 };
}

test('ensureSmoothNormals averages normals at coincident vertices', () => {
  const THREE = mockThree();
  const geometry = {
    attributes: {
      position: makeAttr(new Float32Array([0, 0, 0, 0, 0, 0, 1, 0, 0]), 3),
      normal: makeAttr(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), 3),
    },
    setAttribute(name, attr) { this.attributes[name] = attr; },
  };
  ensureSmoothNormals(THREE, geometry);
  const smooth = geometry.attributes.smoothNormal;
  assert(smooth);
  const invSqrt2 = 1 / Math.sqrt(2);
  assert(Math.abs(smooth.getX(0) - invSqrt2) < 1e-5);
  assert(Math.abs(smooth.getY(0) - invSqrt2) < 1e-5);
  assert(Math.abs(smooth.getX(1) - invSqrt2) < 1e-5);
  assert(Math.abs(smooth.getY(1) - invSqrt2) < 1e-5);
  assert.equal(smooth.getZ(2), 1);
});

test('SelectionOutline pools meshes, selects shader variant, and resets on begin', () => {
  const THREE = mockThree();
  const added = [];
  const outline = new SelectionOutline(THREE, { add(m) { added.push(m); } });
  const plainGeo = {
    attributes: {
      position: makeAttr(new Float32Array([0, 0, 0]), 3),
      normal: makeAttr(new Float32Array([0, 1, 0]), 3),
    },
    setAttribute(name, attr) { this.attributes[name] = attr; },
  };
  const weightGeo = {
    attributes: {
      position: makeAttr(new Float32Array([0, 0, 0]), 3),
      normal: makeAttr(new Float32Array([0, 1, 0]), 3),
      weightMorph: makeAttr(new Float32Array([1, 0, 0]), 3),
    },
    setAttribute(name, attr) { this.attributes[name] = attr; },
  };

  outline.setResolution(800, 600);
  outline.add(plainGeo, { id: 'm1' });
  outline.add(weightGeo, { id: 'm2' }, 0.45);
  assert.equal(added.length, 2);
  assert.equal(added[0].visible, true);
  assert.equal(added[1].material.defines.HAS_WEIGHT_MORPH, 1);
  assert.equal(added[1].material.uniforms.uFat.value, 0.45);
  assert.equal(added[1].material.uniforms.uResolution.value.x, 800);

  outline.begin();
  assert.equal(added[0].visible, false);
  assert.equal(added[1].visible, false);
});

test('openCreatureInfoEntityId depends directly on an open creature info window', () => {
  const citizen = { id: 12, destroyed: false, properties: { citizen: { id: 1 } } };
  const animal = { id: 34, destroyed: false, properties: { cityAnimal: { species: 'capivara' } } };
  const building = { id: 56, destroyed: false, properties: { cityBuilding: { id: 2 } } };

  const cityUI = {
    visible: true,
    manager: {
      windows: [{ state: { selected: building } }, { state: { selected: citizen } }],
      active: { state: { selected: citizen } },
    },
  };
  assert.equal(openCreatureInfoEntityId({ cityUI }), 12);

  // Closing the citizen window hides the outline even if a building window remains open
  cityUI.manager.windows.pop();
  cityUI.manager.active = cityUI.manager.windows[0];
  assert.equal(openCreatureInfoEntityId({ cityUI }), -1);

  // Opening an animal window shows its outline, and hiding cityUI hides it
  const animalWin = { state: { selected: animal } };
  cityUI.manager.windows.push(animalWin);
  cityUI.manager.active = animalWin;
  assert.equal(openCreatureInfoEntityId({ cityUI }), 34);
  cityUI.visible = false;
  assert.equal(openCreatureInfoEntityId({ cityUI }), -1);

  // In character/3P mode (gameUI.active), only an open creature inspect window shows the outline
  const gameUI = {
    active: true,
    desktop: { visible: true, manager: { windows: [{ id: 'survival-profile', state: {} }], active: null } },
  };
  assert.equal(openCreatureInfoEntityId({ gameUI, cityUI }), -1);
  const inspectWin = { id: 'inspect-person-1', state: { inspectedCreatureEntityId: 12 } };
  gameUI.desktop.manager.windows.push(inspectWin);
  gameUI.desktop.manager.active = inspectWin;
  assert.equal(openCreatureInfoEntityId({ gameUI, cityUI }), 12);
});
