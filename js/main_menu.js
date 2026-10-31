import { drawText8x8, drawText8x8Centered, drawNESBox, drawNESButton } from './legacy_ui.js';
import { WORLD_PRESETS, randomWorldSeed } from './world_settings.js';

export const SUBURBAN_PRESETS = [
  {
    id: 'archipelago',
    presetId: 0,
    name: 'ARQUIPÉLAGO CENTRAL',
    badge: 'ILHAS & PONTES',
    desc: 'Ilhas costeiras interligadas. Desafio de logística aquática, transporte de cargas por balsa e conexão viária por pontes.',
    seed: 482910,
    color: '#3cbcfc'
  },
  {
    id: 'continent',
    presetId: 1,
    name: 'PLANÍCIE CONTINENTAL',
    badge: 'METRÓPOLE & EXPANSÃO',
    desc: 'Vasto território plano. Ideal para zoneamento planejado de distritos industriais, avenidas estruturantes e ampla malha habitacional.',
    seed: 819234,
    color: '#58d854'
  },
  {
    id: 'highlands',
    presetId: 2,
    name: 'TERRAS ALTAS',
    badge: 'MONTANHAS & VALES',
    desc: 'Topografia sinuosa com desníveis e vales alpinos. Obras viárias em encostas, contenção e microclimas urbanos.',
    seed: 671203,
    color: '#f8b800'
  }
];

export const MAP_SIZES = [
  { size: 128, label: '128×128', tag: 'COMPACTO' },
  { size: 256, label: '256×256', tag: 'PADRÃO' },
  { size: 512, label: '512×512', tag: 'GRANDE' }
];

export const POPULATION_PRESETS = [
  { pop: 128, label: '128', tag: 'VILA' },
  { pop: 256, label: '256', tag: 'POVOADO' },
  { pop: 512, label: '512', tag: 'CIDADE' },
  { pop: 1024, label: '1024', tag: 'METRÓPOLE' }
];

/**
 * Main Menu for Suburban Chronicles.
 * Features a cinematic atmospheric backdrop, retro-classic typographic title,
 * city scenario presets, graphics options integration, and smooth camera drift.
 */
export class MainMenu {
  constructor({
    world,
    worldSettings,
    options,
    renderer,
    time,
    onStartGame,
    onApplySettings
  }) {
    this.world = world;
    this.worldSettings = worldSettings;
    this.options = options;
    this.renderer = renderer;
    this.time = time;
    this.onStartGame = onStartGame;
    this.onApplySettings = onApplySettings;

    this.active = true;
    this.hasActiveGame = false;
    this.screen = 'TITLE'; // 'TITLE' | 'SCENARIOS' | 'OPTIONS' | 'ABOUT'

    // Scenario creation state
    this.selectedPreset = worldSettings.preset || 'archipelago';
    this.selectedSize = worldSettings.size || 256;
    this.selectedPopulation = worldSettings.population || 512;
    this.selectedSeed = worldSettings.seed || 482910;

    // Camera drift state
    this.driftTime = 0;
    this.camBaseX = world.spawnCenter?.x || 128;
    this.camBaseY = world.spawnCenter?.y || 128;

    // Interactive regions
    this.regions = [];
    this.pointer = { x: -1, y: -1 };
  }

  isActive() {
    return this.active;
  }

  open() {
    this.active = true;
    this.screen = 'TITLE';
    if (this.time) {
      this.previousSpeed = this.time.speed;
      this.previousPaused = this.time.paused;
    }
  }

  close() {
    this.active = false;
    this.hasActiveGame = true;
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
    const t = this.driftTime * 0.12;
    const radius = 9.0;
    const x = (baseX || this.camBaseX) + Math.sin(t) * radius;
    const y = (baseY || this.camBaseY) + Math.cos(t * 0.75) * (radius * 0.7);
    return { x, y, zoom: 1.35 };
  }

  registerRegion(x, y, w, h, onClick, label = '') {
    this.regions.push({ x, y, w, h, onClick, label });
  }

  hitTest(x, y) {
    return this.regions.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) || null;
  }

  pointerDown(x, y) {
    this.pointer = { x, y };
    return !!this.hitTest(x, y);
  }

  pointerMove(x, y) {
    this.pointer = { x, y };
  }

  pointerUp(x, y) {
    const region = this.hitTest(x, y);
    if (region && typeof region.onClick === 'function') {
      region.onClick();
      return true;
    }
    return false;
  }

  clickAt(x, y) {
    return this.pointerUp(x, y);
  }

  key(event) {
    if (!this.active) return false;

    if (this.screen === 'TITLE') {
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        this.close();
        if (typeof this.onStartGame === 'function') this.onStartGame();
        return true;
      }
      if (event.code === 'KeyO') {
        event.preventDefault();
        this.screen = 'OPTIONS';
        return true;
      }
      if (event.code === 'KeyN') {
        event.preventDefault();
        this.screen = 'SCENARIOS';
        return true;
      }
      if (event.code === 'Escape' && this.hasActiveGame) {
        event.preventDefault();
        this.close();
        return true;
      }
    } else {
      if (event.code === 'Escape') {
        event.preventDefault();
        this.screen = 'TITLE';
        return true;
      }
      if (this.screen === 'SCENARIOS' && event.code === 'KeyR') {
        event.preventDefault();
        this.selectedSeed = randomWorldSeed();
        return true;
      }
    }

    return true; // Consume keys when in menu to prevent background shortcuts
  }

  draw(ui) {
    if (!this.active) return;
    this.regions = [];

    const ctx = ui.ctx;
    const width = ui.width;
    const height = ui.height;
    const isMobile = width <= 680;
    const isSmall = width < 960;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // 1. Atmospheric Cinematic Vignette
    const vignette = ctx.createLinearGradient(0, 0, 0, height);
    vignette.addColorStop(0, 'rgba(8, 14, 12, 0.82)');
    vignette.addColorStop(0.25, 'rgba(12, 18, 15, 0.35)');
    vignette.addColorStop(0.70, 'rgba(12, 18, 15, 0.45)');
    vignette.addColorStop(1, 'rgba(8, 14, 12, 0.88)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    // Subtle edge borders
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, width, 2);
    ctx.fillRect(0, height - 2, width, 2);

    if (this.screen === 'TITLE') {
      this.drawTitleScreen(ctx, width, height, isMobile, isSmall);
    } else if (this.screen === 'SCENARIOS') {
      this.drawScenariosModal(ctx, width, height, isMobile, isSmall);
    } else if (this.screen === 'OPTIONS') {
      this.drawOptionsModal(ctx, width, height, isMobile, isSmall);
    } else if (this.screen === 'ABOUT') {
      this.drawAboutModal(ctx, width, height, isMobile, isSmall);
    }

    ctx.restore();
  }

  drawTitleScreen(ctx, width, height, isMobile, isSmall) {
    const titleTopY = isMobile ? 32 : isSmall ? 52 : 72;
    const subScale = isMobile ? 2 : isSmall ? 3 : 4;
    const chronScale = isMobile ? 3 : isSmall ? 5 : 6;
    const shadowOffset = isMobile ? 2 : 3;

    // 1. "SUBURBAN" in crisp off-white with dark drop shadow
    drawText8x8Centered('SUBURBAN', titleTopY, '#f4f1e8', subScale, '#000000', shadowOffset, width);

    // 2. "CHRONICLES" in vibrant municipal gold
    const chronY = titleTopY + (subScale * 8) + (isMobile ? 6 : 10);
    drawText8x8Centered('CHRONICLES', chronY, '#e7bd59', chronScale, '#000000', shadowOffset + 1, width);

    // 3. Subtitle / Tagline
    const subY = chronY + (chronScale * 8) + (isMobile ? 8 : 12);
    drawText8x8Centered('"SIMULAÇÃO URBANA & GESTÃO SOCIAL"', subY, '#3cbcfc', 1, '#000000', 1, width);

    // 4. Central Action Menu Box
    const menuBoxW = Math.min(420, width - 36);
    const menuBoxX = Math.floor((width - menuBoxW) / 2);
    let curY = subY + (isMobile ? 22 : 32);

    // Button: CONTINUAR CIDADE (if active game session)
    if (this.hasActiveGame) {
      drawNESButton(menuBoxX, curY, menuBoxW, 34, 'CONTINUAR CIDADE', true, false);
      this.registerRegion(menuBoxX, curY, menuBoxW, 34, () => {
        this.close();
      }, 'Continuar cidade ativa');
      curY += 40;
    } else {
      // Button: INICIAR CIDADE (primary)
      drawNESButton(menuBoxX, curY, menuBoxW, 34, 'INICIAR CIDADE', true, false);
      this.registerRegion(menuBoxX, curY, menuBoxW, 34, () => {
        this.close();
        if (typeof this.onStartGame === 'function') this.onStartGame();
      }, 'Iniciar simulação da cidade atual');
      curY += 40;
    }

    // Button: NOVA CIDADE & CENÁRIOS
    drawNESButton(menuBoxX, curY, menuBoxW, 32, 'NOVA CIDADE & CENÁRIOS', false, false);
    this.registerRegion(menuBoxX, curY, menuBoxW, 32, () => {
      this.screen = 'SCENARIOS';
    }, 'Escolher cenários ou novo mapa');
    curY += 38;

    // Button: CONFIGURAÇÕES GRÁFICAS
    drawNESButton(menuBoxX, curY, menuBoxW, 30, 'CONFIGURAÇÕES', false, false);
    this.registerRegion(menuBoxX, curY, menuBoxW, 30, () => {
      this.screen = 'OPTIONS';
    }, 'Ajustar opções gráficas e tela');
    curY += 36;

    // Button: SOBRE & CONTROLES
    drawNESButton(menuBoxX, curY, menuBoxW, 28, 'SOBRE & CONTROLES', false, false);
    this.registerRegion(menuBoxX, curY, menuBoxW, 28, () => {
      this.screen = 'ABOUT';
    }, 'Guia de controles e simulação');
    curY += 36;

    // 5. Quick Settings Row: Sombras & Resolução
    const halfW = Math.floor((menuBoxW - 8) / 2);
    const shadowsOn = this.options?.values?.shadows !== false;
    const shadowsLabel = shadowsOn ? 'SOMBRAS: ATIVAS' : 'SOMBRAS: OFF';
    drawNESButton(menuBoxX, curY, halfW, 26, shadowsLabel, shadowsOn, false);
    this.registerRegion(menuBoxX, curY, halfW, 26, () => {
      if (this.options) this.options.apply('shadows', !shadowsOn);
    }, 'Alternar sombras 3D');

    const resVal = this.options?.values?.resolution || 0.25;
    const resLabel = `RES: ${Math.round(resVal * 100)}%`;
    drawNESButton(menuBoxX + halfW + 8, curY, halfW, 26, resLabel, resVal >= 0.5, false);
    this.registerRegion(menuBoxX + halfW + 8, curY, halfW, 26, () => {
      if (this.options) {
        const nextRes = resVal === 0.25 ? 0.5 : resVal === 0.5 ? 1.0 : 0.25;
        this.options.apply('resolution', nextRes);
      }
    }, 'Alternar escala de resolução');
    curY += 34;

    // 6. Current World Info Badge
    const currentPresetObj = SUBURBAN_PRESETS.find(p => p.id === this.worldSettings?.preset) || SUBURBAN_PRESETS[0];
    const infoText = `MAPA: ${currentPresetObj.name} | POP: ${this.worldSettings?.population || 512} | TAM: ${this.worldSettings?.size || 256}²`;
    drawText8x8Centered(infoText, curY + 6, '#8bb698', 1, '#000000', 1, width);

    // 7. Footer
    const footY = height - 22;
    const footText = 'Suburban Chronicles · [ENTER/ESPAÇO] Jogar · [ESC] Menu · [O] Opções';
    drawText8x8Centered(footText, footY, '#68786e', 1, '#000000', 1, width);
  }

  drawScenariosModal(ctx, width, height, isMobile, isSmall) {
    const mw = Math.min(680, width - 24);
    const mh = Math.min(520, height - 36);
    const mx = Math.floor((width - mw) / 2);
    const my = Math.floor((height - mh) / 2);

    // Modal Background Box
    ctx.fillStyle = 'rgba(10, 16, 13, 0.96)';
    ctx.fillRect(mx, my, mw, mh);
    drawNESBox(mx, my, mw, mh);

    // Header Title
    drawText8x8('FUNDAR NOVA CIDADE · CENÁRIOS', mx + 16, my + 14, '#e7bd59', 1);

    // Back Button (Top Right)
    const backBtnW = 110;
    drawNESButton(mx + mw - backBtnW - 12, my + 10, backBtnW, 22, '← VOLTAR', false, true);
    this.registerRegion(mx + mw - backBtnW - 12, my + 10, backBtnW, 22, () => {
      this.screen = 'TITLE';
    }, 'Voltar ao menu');

    let curY = my + 44;

    // 1. Scenario Presets Selection
    drawText8x8('1. SELECIONE O CENÁRIO DE TERRENO:', mx + 16, curY, '#3cbcfc', 1);
    curY += 14;

    const cardW = Math.floor((mw - 32 - (SUBURBAN_PRESETS.length - 1) * 8) / SUBURBAN_PRESETS.length);
    for (let i = 0; i < SUBURBAN_PRESETS.length; i++) {
      const p = SUBURBAN_PRESETS[i];
      const cx = mx + 16 + i * (cardW + 8);
      const isSelected = this.selectedPreset === p.id;
      const cardH = 92;

      // Card box
      ctx.save();
      ctx.fillStyle = isSelected ? '#1c2822' : '#121a16';
      ctx.fillRect(cx, curY, cardW, cardH);
      ctx.strokeStyle = isSelected ? p.color : '#3b4840';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(cx + 0.5, curY + 0.5, cardW - 1, cardH - 1);

      // Card Header
      drawText8x8(p.name, cx + 8, curY + 8, isSelected ? '#ffffff' : '#cbc1a7', 1);
      drawText8x8(p.badge, cx + 8, curY + 20, p.color, 1);

      // Card Desc (wrapped/shortened)
      const descLine1 = p.desc.slice(0, 26);
      const descLine2 = p.desc.slice(26, 52);
      drawText8x8(descLine1, cx + 8, curY + 36, '#889988', 1);
      drawText8x8(descLine2, cx + 8, curY + 46, '#889988', 1);

      // Select indicator
      if (isSelected) {
        drawText8x8('▶ SELECIONADO', cx + 8, curY + cardH - 18, '#e7bd59', 1);
      } else {
        drawText8x8('CLIQUE P/ ESCOLHER', cx + 8, curY + cardH - 18, '#586b5e', 1);
      }
      ctx.restore();

      this.registerRegion(cx, curY, cardW, cardH, () => {
        this.selectedPreset = p.id;
        this.selectedSeed = p.seed;
      }, `Escolher cenário ${p.name}`);
    }

    curY += 104;

    // 2. Map Dimensions
    drawText8x8('2. DIMENSÕES DO MAPA:', mx + 16, curY, '#3cbcfc', 1);
    curY += 14;
    let sx = mx + 16;
    for (const ms of MAP_SIZES) {
      const isSel = this.selectedSize === ms.size;
      const btnW = 120;
      drawNESButton(sx, curY, btnW, 24, `${ms.label} [${ms.tag}]`, isSel, false);
      this.registerRegion(sx, curY, btnW, 24, () => {
        this.selectedSize = ms.size;
      }, `Tamanho ${ms.label}`);
      sx += btnW + 8;
    }

    curY += 36;

    // 3. Initial Population
    drawText8x8('3. POPULAÇÃO INICIAL:', mx + 16, curY, '#3cbcfc', 1);
    curY += 14;
    let popX = mx + 16;
    for (const ps of POPULATION_PRESETS) {
      const isSel = this.selectedPopulation === ps.pop;
      const btnW = 110;
      drawNESButton(popX, curY, btnW, 24, `${ps.label} [${ps.tag}]`, isSel, false);
      this.registerRegion(popX, curY, btnW, 24, () => {
        this.selectedPopulation = ps.pop;
      }, `População ${ps.label}`);
      popX += btnW + 8;
    }

    curY += 36;

    // 4. Seed and Randomizer
    drawText8x8('4. SEMENTE DO MUNDO (SEED):', mx + 16, curY, '#3cbcfc', 1);
    curY += 14;

    // Seed display box
    const seedBoxW = 200;
    ctx.save();
    ctx.fillStyle = '#080d0a';
    ctx.fillRect(mx + 16, curY, seedBoxW, 24);
    ctx.strokeStyle = '#445548';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 16.5, curY + 0.5, seedBoxW - 1, 23);
    drawText8x8(`SEED: ${this.selectedSeed}`, mx + 24, curY + 8, '#fcee21', 1);
    ctx.restore();

    // Randomize Seed Button
    const randBtnW = 150;
    drawNESButton(mx + 16 + seedBoxW + 8, curY, randBtnW, 24, '🎲 RANDOMIZAR', false, false);
    this.registerRegion(mx + 16 + seedBoxW + 8, curY, randBtnW, 24, () => {
      this.selectedSeed = randomWorldSeed();
    }, 'Gerar semente aleatória');

    curY += 46;

    // Bottom Action Buttons: FUNDAR CIDADE
    const startW = Math.min(320, mw - 32);
    const startX = mx + Math.floor((mw - startW) / 2);
    drawNESButton(startX, my + mh - 44, startW, 32, '★ FUNDAR CIDADE ★', true, false);
    this.registerRegion(startX, my + mh - 44, startW, 32, () => {
      this.applyAndStartNewCity();
    }, 'Gerar e iniciar nova cidade');
  }

  drawOptionsModal(ctx, width, height, isMobile, isSmall) {
    const mw = Math.min(620, width - 24);
    const mh = Math.min(480, height - 36);
    const mx = Math.floor((width - mw) / 2);
    const my = Math.floor((height - mh) / 2);

    ctx.fillStyle = 'rgba(10, 16, 13, 0.96)';
    ctx.fillRect(mx, my, mw, mh);
    drawNESBox(mx, my, mw, mh);

    // Title & Back
    drawText8x8('CONFIGURAÇÕES GRÁFICAS & DESEMPENHO', mx + 16, my + 14, '#e7bd59', 1);
    const backBtnW = 110;
    drawNESButton(mx + mw - backBtnW - 12, my + 10, backBtnW, 22, '← VOLTAR', false, true);
    this.registerRegion(mx + mw - backBtnW - 12, my + 10, backBtnW, 22, () => {
      this.screen = 'TITLE';
    }, 'Voltar ao menu');

    let curY = my + 44;

    // Row: Resolução
    const currentRes = this.options?.values?.resolution || 0.25;
    drawText8x8('RESOLUÇÃO DE RENDERIZAÇÃO:', mx + 16, curY, '#3cbcfc', 1);
    curY += 12;
    const resOptions = [
      { val: 0.25, label: '25% (RÁPIDO)' },
      { val: 0.50, label: '50% (EQUILIBRADO)' },
      { val: 1.00, label: '100% (ALTA DEF)' }
    ];
    let rx = mx + 16;
    for (const ro of resOptions) {
      const isSel = currentRes === ro.val;
      const bw = 160;
      drawNESButton(rx, curY, bw, 22, ro.label, isSel, false);
      this.registerRegion(rx, curY, bw, 22, () => {
        if (this.options) this.options.apply('resolution', ro.val);
      }, `Resolução ${ro.label}`);
      rx += bw + 8;
    }
    curY += 32;

    // Row: Sombras 3D
    const currentShadows = this.options?.values?.shadows !== false;
    drawText8x8('SOMBRAS EM TEMPO REAL:', mx + 16, curY, '#3cbcfc', 1);
    curY += 12;
    const shadowOpts = [
      { val: true, label: 'LIGADAS' },
      { val: false, label: 'DESLIGADAS' }
    ];
    let sx = mx + 16;
    for (const so of shadowOpts) {
      const isSel = currentShadows === so.val;
      const bw = 120;
      drawNESButton(sx, curY, bw, 22, so.label, isSel, false);
      this.registerRegion(sx, curY, bw, 22, () => {
        if (this.options) this.options.apply('shadows', so.val);
      }, `Sombras ${so.label}`);
      sx += bw + 8;
    }
    curY += 32;

    // Row: Distância de Renderização
    const currentDist = this.options?.values?.distance || 64;
    drawText8x8('DISTÂNCIA DE VISÃO (TILES):', mx + 16, curY, '#3cbcfc', 1);
    curY += 12;
    const distOpts = [
      { val: 36, label: '36 T' },
      { val: 48, label: '48 T' },
      { val: 64, label: '64 T' },
      { val: 96, label: '96 T' },
      { val: 0, label: 'TOTAL' }
    ];
    let dx = mx + 16;
    for (const do_ of distOpts) {
      const isSel = currentDist === do_.val;
      const bw = 80;
      drawNESButton(dx, curY, bw, 22, do_.label, isSel, false);
      this.registerRegion(dx, curY, bw, 22, () => {
        if (this.options) this.options.apply('distance', do_.val);
      }, `Distância ${do_.label}`);
      dx += bw + 6;
    }
    curY += 32;

    // Row: Pós-Efeitos e Neblina
    const currentPost = this.options?.values?.postEffects !== false;
    drawText8x8('PÓS-PROCESSAMENTO GRÁFICO:', mx + 16, curY, '#3cbcfc', 1);
    curY += 12;
    const postOpts = [
      { val: true, label: 'ATIVADO' },
      { val: false, label: 'DESATIVADO' }
    ];
    let px = mx + 16;
    for (const po of postOpts) {
      const isSel = currentPost === po.val;
      const bw = 120;
      drawNESButton(px, curY, bw, 22, po.label, isSel, false);
      this.registerRegion(px, curY, bw, 22, () => {
        if (this.options) this.options.apply('postEffects', po.val);
      }, `Pós-processamento ${po.label}`);
      px += bw + 8;
    }
    curY += 32;

    // Row: Wireframe & Diagnóstico
    const currentWire = this.options?.values?.wireframe || 0;
    drawText8x8('MODO WIREFRAME (GRADE):', mx + 16, curY, '#3cbcfc', 1);
    curY += 12;
    const wireOpts = [
      { val: 0, label: 'OFF' },
      { val: 1, label: 'GRADE' },
      { val: 2, label: 'TOTAL' }
    ];
    let wx = mx + 16;
    for (const wo of wireOpts) {
      const isSel = currentWire === wo.val;
      const bw = 90;
      drawNESButton(wx, curY, bw, 22, wo.label, isSel, false);
      this.registerRegion(wx, curY, bw, 22, () => {
        if (this.options) this.options.apply('wireframe', wo.val);
      }, `Wireframe ${wo.label}`);
      wx += bw + 6;
    }

    // Bottom confirmation button
    const okW = 160;
    const okX = mx + Math.floor((mw - okW) / 2);
    drawNESButton(okX, my + mh - 38, okW, 26, 'CONCLUÍDO', true, false);
    this.registerRegion(okX, my + mh - 38, okW, 26, () => {
      this.screen = 'TITLE';
    }, 'Confirmar e voltar');
  }

  drawAboutModal(ctx, width, height, isMobile, isSmall) {
    const mw = Math.min(620, width - 24);
    const mh = Math.min(460, height - 36);
    const mx = Math.floor((width - mw) / 2);
    const my = Math.floor((height - mh) / 2);

    ctx.fillStyle = 'rgba(10, 16, 13, 0.96)';
    ctx.fillRect(mx, my, mw, mh);
    drawNESBox(mx, my, mw, mh);

    // Title & Back
    drawText8x8('SOBRE O SUBURBAN CHRONICLES', mx + 16, my + 14, '#e7bd59', 1);
    const backBtnW = 110;
    drawNESButton(mx + mw - backBtnW - 12, my + 10, backBtnW, 22, '← VOLTAR', false, true);
    this.registerRegion(mx + mw - backBtnW - 12, my + 10, backBtnW, 22, () => {
      this.screen = 'TITLE';
    }, 'Voltar ao menu');

    let curY = my + 44;

    // About description
    drawText8x8('SISTEMA DE SIMULAÇÃO URBANA:', mx + 16, curY, '#3cbcfc', 1);
    curY += 12;
    const aboutLines = [
      'Suburban Chronicles é um simulador de gestão urbana sistêmica,',
      'onde cada habitante possui rotina física, moradia, trabalho e voto.',
      'A cidade opera em ciclos econômicos de produção, transporte logístico,',
      'serviços de saúde, saneamento, moradia social e eleições municipais.'
    ];
    for (const l of aboutLines) {
      drawText8x8(l, mx + 16, curY, '#cbc1a7', 1);
      curY += 11;
    }

    curY += 14;

    // Controls table
    drawText8x8('ATALHOS & COMANDOS:', mx + 16, curY, '#3cbcfc', 1);
    curY += 14;
    const controls = [
      ['ARRASTAR MOUSE / TOQUE', 'Mover a câmera pelo mapa'],
      ['RODA DO MOUSE / PINÇA', 'Aproximar ou afastar zoom'],
      ['BOTÃO DIREITO', 'Inspeção rápida / fechar janelas'],
      ['ESPAÇO', 'Pausar ou despausar simulação'],
      ['+  /  -', 'Aumentar ou diminuir velocidade (1× a 32×)'],
      ['CTRL + K', 'Busca geral de cidadãos e prédios'],
      ['TECLA O', 'Painel de Opções Gráficas'],
      ['TECLA S', 'Editor de Terreno e Prefabs'],
      ['ESC', 'Menu Principal / Pausa / Voltar']
    ];

    for (const [key, desc] of controls) {
      drawText8x8(key.padEnd(26, ' '), mx + 16, curY, '#fcee21', 1);
      drawText8x8(desc, mx + 230, curY, '#e2dac1', 1);
      curY += 12;
    }

    // Bottom Return button
    const okW = 160;
    const okX = mx + Math.floor((mw - okW) / 2);
    drawNESButton(okX, my + mh - 38, okW, 26, 'ENTENDIDO', true, false);
    this.registerRegion(okX, my + mh - 38, okW, 26, () => {
      this.screen = 'TITLE';
    }, 'Voltar ao menu');
  }

  applyAndStartNewCity() {
    const isMatchingCurrent =
      this.selectedPreset === this.worldSettings?.preset &&
      this.selectedSeed === this.worldSettings?.seed &&
      this.selectedSize === this.worldSettings?.size &&
      this.selectedPopulation === this.worldSettings?.population;

    if (isMatchingCurrent) {
      this.close();
      if (typeof this.onStartGame === 'function') this.onStartGame();
      return;
    }

    // Reload with exact new query parameters for a clean procedural generation
    const url = new URL(window.location.href);
    url.searchParams.set('terrain', this.selectedPreset);
    url.searchParams.set('seed', String(this.selectedSeed));
    url.searchParams.set('size', String(this.selectedSize));
    url.searchParams.set('population', String(this.selectedPopulation));
    url.searchParams.set('autostart', '1');
    window.location.href = url.toString();
  }
}
