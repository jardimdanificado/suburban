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

  // KeyN triggers onOpenNewGame and closes main menu
  let newGameOpened = false;
  menu.onOpenNewGame = () => { newGameOpened = true; };
  menu.key({ code: 'KeyN', preventDefault: () => {} });
  assert.equal(newGameOpened, true);
  assert.equal(menu.isActive(), false);

  // KeyO triggers onOpenOptions and closes main menu
  menu.open();
  let optionsOpened = false;
  menu.onOpenOptions = () => { optionsOpened = true; };
  menu.key({ code: 'KeyO', preventDefault: () => {} });
  assert.equal(optionsOpened, true);
  assert.equal(menu.isActive(), false);

  // Escape from TITLE when hasActiveGame closes menu
  menu.open();
  menu.hasActiveGame = true;
  menu.key({ code: 'Escape', preventDefault: () => {} });
  assert.equal(menu.isActive(), false);
});

test('MainMenu window is draggable by its title bar caption', () => {
  const world = { spawnCenter: { x: 0, y: 0 } };
  const worldSettings = { preset: 'archipelago', size: 256, population: 512, seed: 1 };
  const menu = new MainMenu({ world, worldSettings });

  // Simulate drawing on an 800x600 screen to set window bounds
  menu.currentWindowRect = { x: 240, y: 200, w: 320, h: 160 };
  menu.windowPos = { x: 240, y: 200 };

  // Click on caption bar (y between 200 and 222)
  assert.equal(menu.hitCaption(260, 210), true);
  const dragStarted = menu.pointerDown(260, 210);
  assert.equal(dragStarted, true);
  assert(menu.dragGesture !== null);

  // Drag 50px right and 30px down
  menu.pointerMove(310, 240);
  assert.equal(menu.windowPos.x, 290);
  assert.equal(menu.windowPos.y, 230);

  // Release mouse
  const released = menu.pointerUp(310, 240);
  assert.equal(released, true);
  assert.equal(menu.dragGesture, null);
});

test('MainMenu camera drift produces smooth animated positions', () => {
  const world = { spawnCenter: { x: 200, y: 300 } };
  const worldSettings = { preset: 'archipelago', size: 256, population: 512, seed: 100 };
  const menu = new MainMenu({ world, worldSettings });

  const cam0 = menu.getCameraDrift(200, 300);
  assert.equal(typeof cam0.x, 'number');
  assert.equal(typeof cam0.y, 'number');
  assert.equal(typeof cam0.zoom, 'number');

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

test('MainMenu draws all screens with ManagementCanvasUI primitives without error', () => {
  const world = { spawnCenter: { x: 128, y: 128 } };
  const worldSettings = { preset: 'archipelago', size: 256, population: 512, seed: 100 };
  const options = { values: { resolution: 0.5, shadows: true, distance: 64, postEffects: true, wireframe: 0 }, apply() {} };
  const menu = new MainMenu({ world, worldSettings, options });

  const mockCtx = {
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    beginPath() {},
    rect() {},
    clip() {},
    measureText: () => ({ width: 50 }),
    createLinearGradient: () => ({ addColorStop() {} })
  };

  const mockUi = {
    ctx: mockCtx,
    width: 800,
    height: 600,
    font: (scale, bold) => `${bold ? 'bold' : 'normal'} 11px sans-serif`,
    text(val, x, y) { mockCtx.fillText(val, x, y); },
    textWidth: () => 50,
    fitText: (val) => String(val),
    button(x, y, w, h, label, onClick, opts) {
      mockUi.regions.push({ x, y, w, h, label, onClick });
    },
    regions: []
  };

  mockUi.regions = [];
  assert.doesNotThrow(() => menu.draw(mockUi));
  assert(mockUi.regions.length > 0, "Should register interactive buttons");

  // Verify that TITLE screen has 'Novo Jogo…', 'Opções…', '×' and no 'Cenários' or 'Editor'
  assert(mockUi.regions.some(r => r.label === 'Novo Jogo…'), "TITLE should have 'Novo Jogo…'");
  assert(mockUi.regions.some(r => r.label === 'Opções…'), "TITLE should have 'Opções…'");
  assert(mockUi.regions.some(r => r.label === '×'), "TITLE should always have close button '×'");
  assert.equal(mockUi.regions.some(r => r.label.includes('Cenários')), false, "No button should mention Cenários");
  assert.equal(mockUi.regions.some(r => r.label.includes('Editor')), false, "No button should mention Editor");

  // Verify clicking Novo Jogo triggers onOpenNewGame
  let newGameClicked = false;
  menu.onOpenNewGame = () => { newGameClicked = true; };
  const njBtn = mockUi.regions.find(r => r.label === 'Novo Jogo…');
  njBtn.onClick();
  assert.equal(newGameClicked, true);

  // Verify clicking Opções triggers onOpenOptions
  let optionsClicked = false;
  menu.onOpenOptions = () => { optionsClicked = true; };
  const optBtn = mockUi.regions.find(r => r.label === 'Opções…');
  optBtn.onClick();
  assert.equal(optionsClicked, true);
});

test('MainMenu applyAndStartNewCity triggers onStartNewCity callback without page reload', () => {
  const world = { spawnCenter: { x: 100, y: 100 } };
  const worldSettings = { preset: 'archipelago', size: 256, population: 512, seed: 12345 };
  let startParams = null;
  const menu = new MainMenu({
    world,
    worldSettings,
    onStartNewCity: (params) => {
      startParams = params;
    }
  });

  menu.selectedPreset = 'continent';
  menu.selectedSize = 512;
  menu.selectedPopulation = 1024;
  menu.selectedSeed = 998877;

  menu.applyAndStartNewCity();

  assert.equal(menu.isActive(), false);
  assert.deepEqual(startParams, {
    preset: 'continent',
    seed: 998877,
    size: 512,
    population: 1024
  });
});

test('CityDesktop.openNewGame opens a dedicated Novo Jogo window without opening Government menu', async () => {
  const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => {} });
  globalThis.window = { innerWidth: 1024, innerHeight: 768, location: { search: '' } };
  globalThis.document = {
    createElement: () => ({
      style: {},
      value: '',
      setAttribute() {},
      addEventListener() {},
      append() {},
      remove() {},
      reportValidity: () => true,
      getContext: () => ctx
    })
  };
  const { CityDesktop } = await import('../js/city_desktop.js');
  const mockCity = {
    world: { preset: 'archipelago', seed: 12345, width: 256, revision: 1 },
    initialSeed: 12345,
    initialPopulation: 512,
    politics: { lastResult: null },
    stats: () => ({ population: 512, treasury: 100000 })
  };
  const mockRoot = { append() {} };
  let startCityParams = null;
  const desktop = new CityDesktop({
    city: mockCity,
    root: mockRoot,
    select() {},
    camera() {},
    controls: {
      startNewCity: (p) => { startCityParams = p; }
    }
  });

  // Call openNewGame
  const state = desktop.openNewGame();
  assert(state, 'openNewGame returns state');
  assert.equal(state.tab, 'newgame');

  const win = desktop.manager.find('tool:newgame');
  assert(win, 'tool:newgame window was opened');
  assert.equal(win.title, 'Novo Jogo');
  assert.notEqual(win.id, 'module:government');

  // Verify worldGeneration method exists and runs
  const pageEntries = [];
  const mockPage = {
    heading(h) { pageEntries.push(['heading', h]); },
    note(n, c) { pageEntries.push(['note', n]); },
    kv(k, v) { pageEntries.push(['kv', k, v]); },
    space() {},
    button(label, click) { pageEntries.push(['button', label, click]); },
    x: 0, y: 0, top: 0, bottom: 500, w: 300
  };
  state.worldGeneration(mockPage);

  // Check expected entries from worldGeneration
  assert(pageEntries.some(([type, text]) => type === 'heading' && text === 'GERAÇÃO DE TERRENO'));
  assert(pageEntries.some(([type, text]) => type === 'heading' && text === 'PRÓXIMA CIDADE'));
  assert(pageEntries.some(([type, text]) => type === 'button' && text.startsWith('PAISAGEM:')));
  assert(pageEntries.some(([type, text]) => type === 'button' && text.startsWith('PROFILER NO PRÓXIMO MUNDO:')));
  assert(pageEntries.some(([type, text]) => type === 'button' && text === 'GERAR COM ESTA SEMENTE'));
  assert(pageEntries.some(([type, text]) => type === 'button' && text === 'GERAR TERRENO ALEATÓRIO'));

  // Test clicking GERAR COM ESTA SEMENTE triggers startNewCity in-place
  state.seed.value = '777888';
  state.populationInput.value = '350';
  state.mapSizeInput.value = '256';
  const genBtn = pageEntries.find(([type, text]) => type === 'button' && text === 'GERAR COM ESTA SEMENTE');
  genBtn[2](); // invoke click

  assert.deepEqual(startCityParams, {
    preset: 'archipelago',
    seed: 777888,
    size: 256,
    population: 350
  });
});


