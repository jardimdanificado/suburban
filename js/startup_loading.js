import { WindowManager } from './window_manager.js';
import { MANAGEMENT_THEME as T, bevel } from './management_ui.js';

const FONT = '11px Tahoma, Verdana, sans-serif';
const FONT_BOLD = '600 11px Tahoma, Verdana, sans-serif';
const SPINNER = ['|', '/', '—', '\\'];

/** Floating progress window used while the world and city are built. */
export class StartupLoading {
  constructor({ root = null, title = 'Suburban Chronicles' } = {}) {
    this.root = root;
    this.title = title;
    this.stageLabel = 'Iniciando…';
    this.progress = 0;
    this.closed = true;
    this.looping = false;
    this.manager = new WindowManager({ top: 8, bottom: 8 });
    this.window = this.manager.open({
      id: 'startup-loading', title, width: 420, height: 150, minWidth: 320, minHeight: 140
    });
    this.canvas = null;
    this.ctx = null;
    this.width = 1100;
    this.height = 800;
    if (typeof document !== 'undefined' && this.root) this.open();
  }

  open() {
    this.closed = false;
    if (!this.canvas && typeof document !== 'undefined' && this.root) this.attach();
    this.startLoop();
    this.draw();
    return this;
  }

  close() {
    this.closed = true;
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    return this;
  }

  stage(label, progress) {
    if (label != null) this.stageLabel = label;
    if (progress != null) this.progress = Math.max(0, Math.min(1, progress));
    this.draw();
    return this;
  }

  /** Resolves after at least one browser paint so the current stage is visible. */
  paint() {
    const raf = globalThis.requestAnimationFrame;
    if (typeof raf !== 'function') return Promise.resolve();
    return new Promise(resolve => raf(() => raf(() => resolve())));
  }

  async prepareSimulation(bridge) {
    this.stage('Aquecendo simulação e vocabulário…', 0.9);
    await this.paint();
    if (!bridge?.active) return;
    try {
      // The checkpoint arrives after worker initialization and vocabulary warmup.
      await bridge.checkpoint();
    } catch {
      // The bridge reports worker failures and restores local simulation itself.
    }
  }

  attach() {
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, {
      position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '9999', touchAction: 'none'
    });
    this.root.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    if (typeof window !== 'undefined' && !this.resizeBound) {
      this.resizeBound = true;
      window.addEventListener('resize', () => { this.resize(); this.draw(); });
    }
    const swallow = event => event.stopPropagation();
    this.canvas.addEventListener('pointerdown', event => {
      swallow(event);
      if (this.manager.pointerDown(event.clientX, event.clientY)) this.draw();
    });
    this.canvas.addEventListener('pointermove', event => {
      swallow(event);
      if (this.manager.pointerMove(event.clientX, event.clientY)) this.draw();
    });
    this.canvas.addEventListener('pointerup', event => { swallow(event); this.manager.pointerUp(); this.draw(); });
  }

  resize() {
    if (!this.ctx) return;
    this.width = this.root?.clientWidth || globalThis.innerWidth || 1100;
    this.height = this.root?.clientHeight || globalThis.innerHeight || 800;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.manager.viewport(this.width, this.height);
    if (!this.centered) {
      const w = this.window;
      w.x = (this.width - w.w) / 2;
      w.y = (this.height - w.h) / 2;
      this.manager.constrain(w);
      this.centered = true;
    }
  }

  startLoop() {
    const raf = globalThis.requestAnimationFrame;
    if (this.looping || typeof raf !== 'function') return;
    this.looping = true;
    const tick = () => {
      if (this.closed) { this.looping = false; return; }
      this.draw();
      raf(tick);
    };
    raf(tick);
  }

  draw(ui = null) {
    const ctx = ui?.ctx || this.ctx;
    if (!ctx || this.closed) return;
    const width = ui?.width || this.width;
    const height = ui?.height || this.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(10, 15, 12, 0.55)';
    ctx.fillRect(0, 0, width, height);
    const w = this.window, r = this.manager.rect(w);
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(r.x + 3, r.y + 3, r.w, r.h);
    ctx.restore();
    bevel(ctx, r.x, r.y, r.w, r.h, { fill: T.face });
    bevel(ctx, w.x + 1, w.y + 1, w.w - 2, 20, { fill: T.header });
    ctx.save();
    ctx.font = FONT_BOLD;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = T.captionInk;
    ctx.fillText(this.title, w.x + w.w / 2, w.y + 11);
    ctx.restore();
    const x = w.x + 12, inner = w.w - 24;
    const spin = SPINNER[Math.floor((globalThis.performance?.now?.() ?? Date.now()) / 180) % SPINNER.length];
    ctx.save();
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = T.ink;
    ctx.fillText(this.stageLabel, x, w.y + 40);
    ctx.textAlign = 'right';
    ctx.fillText(spin, x + inner, w.y + 40);
    ctx.restore();
    const barY = w.y + 56, barH = 18, pct = Math.max(0, Math.min(1, this.progress));
    bevel(ctx, x, barY, inner, barH, { inset: true, fill: T.track });
    ctx.fillStyle = T.blue;
    ctx.fillRect(x + 3, barY + 3, Math.max(0, (inner - 6) * pct), barH - 6);
    ctx.save();
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillStyle = T.ink;
    ctx.fillText(`${Math.round(pct * 100)}%`, x + inner, w.y + 96);
    ctx.restore();
  }
}
