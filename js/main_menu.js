import { MANAGEMENT_THEME, bevel, readableLabel } from './management_ui.js';
import { WORLD_PRESETS, randomWorldSeed } from './world_settings.js';

const T = MANAGEMENT_THEME;

export const SUBURBAN_PRESETS = [
  {
    id: 'archipelago',
    presetId: 0,
    name: 'Arquipélago Central',
    badge: 'Ilhas & Canais',
    desc: 'Ilhas costeiras interligadas por canais navegáveis. Foco em balsas, logística aquática e pontes.',
    seed: 482910,
    color: T.blue
  },
  {
    id: 'continent',
    presetId: 1,
    name: 'Planície Continental',
    badge: 'Metrópole & Indústria',
    desc: 'Extenso território contínuo de planície. Ideal para malha viária expansiva, ferrovias e indústrias.',
    seed: 819234,
    color: T.green
  },
  {
    id: 'highlands',
    presetId: 2,
    name: 'Terras Altas',
    badge: 'Montanhas & Vales',
    desc: 'Topografia alpina com vales e encostas íngremes. Desafios de relevo e pontes elevadas.',
    seed: 671203,
    color: T.gold
  }
];

export const MAP_SIZES = [
  { size: 128, label: '128 × 128', tag: 'Pequeno' },
  { size: 256, label: '256 × 256', tag: 'Normal' },
  { size: 512, label: '512 × 512', tag: 'Grande' }
];

export const POPULATION_PRESETS = [
  { pop: 128, label: '128', tag: 'Vila' },
  { pop: 256, label: '256', tag: 'Povoado' },
  { pop: 512, label: '512', tag: 'Cidade' },
  { pop: 1024, label: '1024', tag: 'Metrópole' }
];

/**
 * OpenTTD-styled Main Menu for Suburban Chronicles.
 * Compact, floating, draggable window over the live 3D city.
 */
export class MainMenu {
  constructor({
    world,
    worldSettings,
    options,
    renderer,
    time,
    onStartGame,
    onStartNewCity,
    onOpenNewGame,
    onOpenOptions
  }) {
    this.world = world;
    this.worldSettings = worldSettings;
    this.options = options;
    this.renderer = renderer;
    this.time = time;
    this.onStartGame = onStartGame;
    this.onStartNewCity = onStartNewCity;
    this.onOpenNewGame = onOpenNewGame;
    this.onOpenOptions = onOpenOptions;

    this.active = true;
    this.hasActiveGame = false;
    this.screen = 'TITLE';

    // World generation parameters
    this.selectedPreset = worldSettings.preset || 'archipelago';
    this.selectedSize = worldSettings.size || 256;
    this.selectedPopulation = worldSettings.population || 512;
    this.selectedSeed = worldSettings.seed || 482910;

    // Draggable window coordinates
    this.windowPos = { x: null, y: null };
    this.genWindowPos = { x: null, y: null };
    this.dragGesture = null;

    // Cinematic camera drift over the live city
    this.driftTime = 0;
    this.camBaseX = world.spawnCenter?.x || 128;
    this.camBaseY = world.spawnCenter?.y || 128;

    this.regions = [];
    this.pointer = { x: -1, y: -1 };
    this.currentWindowRect = null;
  }

  isActive() {
    return this.active;
  }

  open() {
    this.active = true;
    this.screen = 'TITLE';
  }

  close() {
    this.active = false;
    this.hasActiveGame = true;
    this.dragGesture = null;
  }

  toggle() {
    if (this.active) {
      if (this.hasActiveGame) this.close();
    } else {
      this.open();
    }
  }

  update(dt) {
    if (!this.active) return;
    this.driftTime += dt;
  }

  getCameraDrift(baseX, baseY) {
    const t = this.driftTime * 0.08;
    const radius = 7.5;
    const x = (baseX || this.camBaseX) + Math.sin(t) * radius;
    const y = (baseY || this.camBaseY) + Math.cos(t * 0.70) * (radius * 0.65);
    return { x, y, zoom: 1.30 };
  }

  registerRegion(x, y, w, h, onClick, label = '') {
    this.regions.push({ x, y, w, h, onClick, label });
  }

  hitTest(x, y) {
    return this.regions.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) || null;
  }

  hitCaption(x, y) {
    if (!this.currentWindowRect) return false;
    const { x: wx, y: wy, w: ww } = this.currentWindowRect;
    // Window title bar caption area (excluding close button area)
    return y >= wy && y < wy + 22 && x >= wx + 4 && x < wx + ww - 24;
  }

  pointerDown(x, y) {
    this.pointer = { x, y };

    // Check if clicked the window caption bar to start dragging
    if (this.hitCaption(x, y)) {
      const activePos = this.screen === 'TITLE' ? this.windowPos : this.genWindowPos;
      this.dragGesture = {
        startX: x,
        startY: y,
        winStartX: activePos.x,
        winStartY: activePos.y
      };
      return true;
    }

    return !!this.hitTest(x, y);
  }

  pointerMove(x, y) {
    this.pointer = { x, y };

    // Window dragging in progress
    if (this.dragGesture) {
      const dx = x - this.dragGesture.startX;
      const dy = y - this.dragGesture.startY;
      const activePos = this.screen === 'TITLE' ? this.windowPos : this.genWindowPos;
      activePos.x = this.dragGesture.winStartX + dx;
      activePos.y = this.dragGesture.winStartY + dy;
      return;
    }
  }

  pointerUp(x, y) {
    if (this.dragGesture) {
      this.dragGesture = null;
      return true;
    }

    const region = this.hitTest(x, y);
    if (region && typeof region.onClick === 'function') {
      region.onClick({ x, y });
      return true;
    }
    return false;
  }

  clickAt(x, y) {
    return this.pointerUp(x, y);
  }

  key(event) {
    if (!this.active) return false;

    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      this.close();
      if (typeof this.onStartGame === 'function') this.onStartGame();
      return true;
    }
    if (event.code === 'KeyN') {
      event.preventDefault();
      this.close();
      if (typeof this.onOpenNewGame === 'function') {
        this.onOpenNewGame();
      }
      return true;
    }
    if (event.code === 'KeyO') {
      event.preventDefault();
      this.close();
      if (typeof this.onOpenOptions === 'function') {
        this.onOpenOptions();
      }
      return true;
    }
    if (event.code === 'Escape') {
      event.preventDefault();
      this.close();
      if (typeof this.onStartGame === 'function') this.onStartGame();
      return true;
    }

    return false;
  }

  draw(ui) {
    if (!this.active) return;
    this.regions = [];

    const ctx = ui.ctx;
    const width = ui.width;
    const height = ui.height;
    const isMobile = width <= 680;

    ctx.save();

    // Subtle edge framing vignette letting the live city shine through
    const vignette = ctx.createLinearGradient(0, 0, 0, height);
    vignette.addColorStop(0, 'rgba(12, 18, 14, 0.45)');
    vignette.addColorStop(0.25, 'rgba(16, 22, 18, 0.12)');
    vignette.addColorStop(0.75, 'rgba(16, 22, 18, 0.18)');
    vignette.addColorStop(1, 'rgba(10, 15, 12, 0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    this.drawOpenTTDMainMenu(ui, width, height, isMobile);

    // Cursor update: show 'move' hand if hovering over the draggable caption
    if (ui.canvas?.style) {
      if (this.dragGesture || this.hitCaption(this.pointer.x, this.pointer.y)) {
        ui.canvas.style.cursor = 'move';
      } else {
        ui.canvas.style.cursor = 'default';
      }
    }

    this.regions = [...ui.regions];

    ctx.restore();
  }

  /**
   * Compact, floating, draggable OpenTTD main menu window.
   */
  drawOpenTTDMainMenu(ui, width, height, isMobile) {
    const ctx = ui.ctx;

    const winW = Math.min(280, width - 24);
    const winH = 124;

    // Initialize or constrain window position
    if (this.windowPos.x === null || this.windowPos.y === null) {
      this.windowPos.x = Math.floor((width - winW) / 2);
      this.windowPos.y = Math.floor((height - winH) / 2);
    }
    this.windowPos.x = Math.max(4, Math.min(width - winW - 4, this.windowPos.x));
    this.windowPos.y = Math.max(4, Math.min(height - winH - 4, this.windowPos.y));

    const winX = this.windowPos.x;
    const winY = this.windowPos.y;
    this.currentWindowRect = { x: winX, y: winY, w: winW, h: winH };

    // 1. Draggable Window Box
    bevel(ctx, winX, winY, winW, winH, { fill: T.face });

    // Window Caption Bar (draggable!)
    ctx.fillStyle = T.header;
    ctx.fillRect(winX + 2, winY + 2, winW - 4, 22);
    ctx.fillStyle = T.headerLight;
    ctx.fillRect(winX + 2, winY + 2, winW - 4, 1);

    ctx.save();
    ctx.font = ui.font(1, true);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = T.captionInk;
    ctx.fillText('Suburban Chronicles', winX + 8, winY + 13);
    ctx.restore();

    // Close button (×) - always visible in the title bar
    ui.button(winX + winW - 22, winY + 3, 18, 18, '×', () => {
      this.close();
      if (typeof this.onStartGame === 'function') this.onStartGame();
    });

    // 2. Buttons
    let btnY = winY + 28;
    const btnW = winW - 16;
    const btnX = winX + 8;
    const btnH = 26;

    // Button: Continuar Cidade / Iniciar Cidade
    if (this.hasActiveGame) {
      ui.button(btnX, btnY, btnW, btnH, '▶ Continuar Cidade', () => {
        this.close();
        if (typeof this.onStartGame === 'function') this.onStartGame();
      }, { selected: true });
    } else {
      ui.button(btnX, btnY, btnW, btnH, '▶ Iniciar Cidade', () => {
        this.close();
        if (typeof this.onStartGame === 'function') this.onStartGame();
      }, { selected: true });
    }
    btnY += 30;

    // Button: Novo Jogo…
    ui.button(btnX, btnY, btnW, btnH, 'Novo Jogo…', () => {
      this.close();
      if (typeof this.onOpenNewGame === 'function') {
        this.onOpenNewGame();
      }
    });
    btnY += 30;

    // Button: Opções…
    ui.button(btnX, btnY, btnW, btnH, 'Opções…', () => {
      this.close();
      if (typeof this.onOpenOptions === 'function') {
        this.onOpenOptions();
      }
    });
  }

  /**
   * Draggable OpenTTD World Generation Dialog.
   * Matches the content and fields of Governo > Terreno.
   */
  drawWorldGenerationDialog(ui, width, height, isMobile) {
    const ctx = ui.ctx;
    const mw = Math.min(340, width - 24);
    const mh = 268;

    // Initialize or constrain window position
    if (this.genWindowPos.x === null || this.genWindowPos.y === null) {
      this.genWindowPos.x = Math.floor((width - mw) / 2);
      this.genWindowPos.y = Math.floor((height - mh) / 2);
    }
    this.genWindowPos.x = Math.max(4, Math.min(width - mw - 4, this.genWindowPos.x));
    this.genWindowPos.y = Math.max(4, Math.min(height - mh - 4, this.genWindowPos.y));

    const mx = this.genWindowPos.x;
    const my = this.genWindowPos.y;
    this.currentWindowRect = { x: mx, y: my, w: mw, h: mh };

    bevel(ctx, mx, my, mw, mh, { fill: T.face });

    // Caption Bar (draggable!)
    ctx.fillStyle = T.header;
    ctx.fillRect(mx + 2, my + 2, mw - 4, 22);
    ctx.fillStyle = T.headerLight;
    ctx.fillRect(mx + 2, my + 2, mw - 4, 1);

    ctx.save();
    ctx.font = ui.font(1, true);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = T.captionInk;
    ctx.fillText('Novo Jogo · Terreno e geração', mx + 10, my + 13);
    ctx.restore();

    // Close button (×)
    ui.button(mx + mw - 22, my + 3, 18, 18, '×', () => {
      this.screen = 'TITLE';
    });

    let curY = my + 30;
    const contentW = mw - 24;
    const contentX = mx + 12;

    // 1. Paisagem Button (matches Governo > Terreno: PAISAGEM: <nome>)
    const presetLabel = WORLD_PRESETS[this.selectedPreset]?.label || 'Arquipélago';
    ui.button(contentX, curY, contentW, 26, `PAISAGEM: ${presetLabel.toUpperCase()}`, () => {
      const keys = Object.keys(WORLD_PRESETS);
      this.selectedPreset = keys[(keys.indexOf(this.selectedPreset) + 1) % keys.length];
    });
    curY += 32;

    // 2. Semente do próximo mapa (matches Governo > Terreno)
    ui.text('Semente do próximo mapa', contentX, curY, T.ink);
    curY += 15;
    const seedBoxW = contentW - 90;
    bevel(ctx, contentX, curY, seedBoxW, 24, { inset: true, fill: T.paper });
    ui.text(String(this.selectedSeed), contentX + 8, curY + 5, T.ink);

    ui.button(contentX + seedBoxW + 6, curY, 84, 24, 'Aleatório', () => {
      this.selectedSeed = randomWorldSeed();
    });
    curY += 30;

    // 3. Cidadãos iniciais (1 a 2.000) (matches Governo > Terreno)
    ui.text('Cidadãos iniciais (1 a 2.000)', contentX, curY, T.ink);
    curY += 15;
    const popBtnW = Math.floor((contentW - 12) / 4);
    for (let i = 0; i < POPULATION_PRESETS.length; i++) {
      const ps = POPULATION_PRESETS[i];
      const bx = contentX + i * (popBtnW + 4);
      const isSel = this.selectedPopulation === ps.pop;
      ui.button(bx, curY, popBtnW, 24, String(ps.pop), () => {
        this.selectedPopulation = ps.pop;
      }, { selected: isSel });
    }
    curY += 30;

    // 4. Tamanho do mapa (128 a 1024 células por lado) (matches Governo > Terreno)
    ui.text('Tamanho do mapa (128 a 1024 células por lado)', contentX, curY, T.ink);
    curY += 15;
    const sizeBtnW = Math.floor((contentW - 8) / 3);
    for (let i = 0; i < MAP_SIZES.length; i++) {
      const ms = MAP_SIZES[i];
      const bx = contentX + i * (sizeBtnW + 4);
      const isSel = this.selectedSize === ms.size;
      ui.button(bx, curY, sizeBtnW, 24, ms.label, () => {
        this.selectedSize = ms.size;
      }, { selected: isSel });
    }
    curY += 32;

    // 5. Action Buttons (matches Governo > Terreno: GERAR COM ESTA SEMENTE, GERAR TERRENO ALEATÓRIO, Cancelar)
    ui.button(contentX, curY, contentW, 26, 'GERAR COM ESTA SEMENTE', () => {
      this.applyAndStartNewCity();
    }, { selected: true });
    curY += 28;

    const halfW = Math.floor((contentW - 6) / 2);
    ui.button(contentX, curY, halfW, 24, 'GERAR ALEATÓRIO', () => {
      this.selectedSeed = randomWorldSeed();
      this.applyAndStartNewCity();
    });

    ui.button(contentX + halfW + 6, curY, halfW, 24, 'Cancelar', () => {
      this.screen = 'TITLE';
    });
  }

  applyAndStartNewCity() {
    this.close();
    if (typeof this.onStartNewCity === 'function') {
      this.onStartNewCity({
        preset: this.selectedPreset,
        seed: this.selectedSeed,
        size: this.selectedSize,
        population: this.selectedPopulation
      });
      return;
    }

    if (typeof this.onStartGame === 'function') {
      this.onStartGame();
    }
  }
}
