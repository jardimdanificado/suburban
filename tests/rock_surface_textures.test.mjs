import test from 'node:test';
import assert from 'node:assert/strict';
import { rockSurfacePixels } from '../js/rock_surface_textures.js';

test('rockSurfacePixels generates seamless 128x128 albedo and normal maps for all rock styles', () => {
  for (const style of ['rock', 'mountain', 'peak']) {
    const { size, data, normals } = rockSurfacePixels(style, 0);
    assert.equal(size, 128);
    assert.equal(data.length, 128 * 128 * 4);
    assert.equal(normals.length, 128 * 128 * 4);

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
    assert.ok(maxLuma - minLuma > 35, `${style} should have natural tonal contrast`);
    assert.ok(hasRelief, `${style} normal map should contain rock relief`);
  }
});

test('rockSurfacePixels produces distinct variants', () => {
  const a = rockSurfacePixels('rock', 0);
  const b = rockSurfacePixels('rock', 1);
  let diffs = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i] !== b.data[i]) diffs++;
  }
  assert.ok(diffs > 1000);
});
