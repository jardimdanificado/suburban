import test from 'node:test';
import assert from 'node:assert/strict';
import { shackSurfacePixels } from '../js/shack_surface_textures.js';

test('shackSurfacePixels generates 64x64 albedo and normal maps for cardboard, plywood, tarp, and corrugated', () => {
  for (const kind of ['cardboard', 'plywood', 'tarp', 'corrugated']) {
    const { size, data, normals } = shackSurfacePixels(kind, 0);
    assert.equal(size, 64);
    assert.equal(data.length, 64 * 64 * 4);
    assert.equal(normals.length, 64 * 64 * 4);

    let minLuma = 255;
    let maxLuma = 0;
    let hasRelief = false;
    for (let i = 0; i < size * size; i++) {
      const p = i * 4;
      assert.equal(data[p + 3], 255);
      assert.equal(normals[p + 3], 255);
      const luma = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      minLuma = Math.min(minLuma, luma);
      maxLuma = Math.max(maxLuma, luma);
      if (Math.abs(normals[p] - 128) > 8 || Math.abs(normals[p + 1] - 128) > 8) hasRelief = true;
    }
    assert.ok(maxLuma - minLuma > 25, `${kind} should have visible texture contrast`);
    assert.ok(hasRelief, `${kind} normal map should contain surface relief`);
  }
});
