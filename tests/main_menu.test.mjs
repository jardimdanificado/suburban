import test from 'node:test';
import assert from 'node:assert/strict';
import { MainMenu, SUBURBAN_PRESETS, MAP_SIZES, POPULATION_PRESETS } from '../js/main_menu.js';

test('MainMenu initializes with proper default states and scenarios', () => {
  const world = { spawnCenter: { x: 128, y: 128 } };
  const worldSettings = { preset: 'archipelago', size: 256, population: 512, seed: 482910 };
  const menu = new MainMenu({ world, worldSettings });

  assert.equal(menu.isActive(), true);
  assert.equal(menu.hasActiveGame, false);
  assert.equal(menu.screen, 'TITLE');
  assert.equal(menu.selectedPreset, 'archipelago');
  assert.equal(menu.selectedSize, 256);
  assert.equal(menu.selectedPopulation, 512);
  assert.equal(menu.selectedSeed, 482910);
  assert.equal(SUBURBAN_PRESETS.length, 3);
  assert.equal(MAP_SIZES.length, 3);
  assert.equal(POPULATION_PRESETS.length, 4);
});

test('MainMenu transitions between screens and handles lifecycle', () => {
  const world = { spawnCenter: { x: 128, y: 128 } };
  const worldSettings = { preset: 'continent', size: 256, population: 512, seed: 12345 };
  let started = false;
  const menu = new MainMenu({
    world,
    worldSettings,
    onStartGame: () => { started = true; }
  });

  assert.equal(menu.isActive(), true);
  menu.close();
  assert.equal(menu.isActive(), false);
  assert.equal(menu.hasActiveGame, true);

  menu.open();
  assert.equal(menu.isActive(), true);
  assert.equal(menu.screen, 'TITLE');

  menu.toggle();
  assert.equal(menu.isActive(), false);
});

test('MainMenu key navigation and shortcuts', () => {
  const world = { spawnCenter: { x: 100, y: 100 } };
  const worldSettings = { preset: 'highlands', size: 128, population: 256, seed: 999 };
  let started = false;
  const menu = new MainMenu({
    world,
    worldSettings,
    onStartGame: () => { started = true; }
  });

  // Enter starts game from TITLE
  const enterConsumed = menu.key({ code: 'Enter', preventDefault: () => {} });
  assert.equal(enterConsumed, true);
  assert.equal(started, true);
  assert.equal(menu.isActive(), false);

  // Open menu again
  menu.open();
  assert.equal(menu.screen, 'TITLE');

  // KeyO opens options
  menu.key({ code: 'KeyO', preventDefault: () => {} });
  assert.equal(menu.screen, 'OPTIONS');

  // Escape from OPTIONS returns to TITLE
  menu.key({ code: 'Escape', preventDefault: () => {} });
  assert.equal(menu.screen, 'TITLE');

  // KeyN opens scenarios
  menu.key({ code: 'KeyN', preventDefault: () => {} });
  assert.equal(menu.screen, 'SCENARIOS');

  // Escape from SCENARIOS returns to TITLE
  menu.key({ code: 'Escape', preventDefault: () => {} });
  assert.equal(menu.screen, 'TITLE');

  // Escape from TITLE when hasActiveGame closes menu
  menu.key({ code: 'Escape', preventDefault: () => {} });
  assert.equal(menu.isActive(), false);
});

test('MainMenu camera drift produces smooth animated positions', () => {
  const world = { spawnCenter: { x: 200, y: 300 } };
  const worldSettings = { preset: 'archipelago', size: 256, population: 512, seed: 100 };
  const menu = new MainMenu({ world, worldSettings });

  const cam0 = menu.getCameraDrift(200, 300);
  assert.equal(typeof cam0.x, 'number');
  assert.equal(typeof cam0.y, 'number');
  assert.equal(cam0.zoom, 1.35);

  menu.update(2.5);
  const cam1 = menu.getCameraDrift(200, 300);
  assert.notEqual(cam0.x, cam1.x);
});

test('MainMenu pointer hitTest and click registration', () => {
  const world = { spawnCenter: { x: 0, y: 0 } };
  const worldSettings = { preset: 'archipelago', size: 256, population: 512, seed: 1 };
  const menu = new MainMenu({ world, worldSettings });

  let clicked = false;
  menu.registerRegion(10, 20, 100, 50, () => { clicked = true; }, 'test-button');

  assert.equal(menu.hitTest(5, 5), null);
  assert.notEqual(menu.hitTest(50, 40), null);

  const consumed = menu.pointerUp(50, 40);
  assert.equal(consumed, true);
  assert.equal(clicked, true);
});
