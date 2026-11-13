import { SPEED_TIERS, speedLabel } from "./simulation_time.js?v=ff3-ff4-steps-1";

const BOOL = [[false, "OFF"], [true, "ON"]];
const effect = (key, label, values, initial) => ({ key, label, values, default: initial, graphic: true });
const GRAPHICS = [
  { key: "resolution", label: "RESOLUCAO", values: [0.25, 0.5, 0.75, 1].map(v => [v, `${v * 100}%`]), default: 0.5 },
  { key: "terrainOptimizations", label: "OTIMIZACOES DE TERRENO", values: BOOL, default: true },
  { key: "smoothMovement", label: "MOVIMENTO SUAVE", values: BOOL, default: true },
  { key: "shadows", label: "SOMBRAS", values: BOOL, default: true },
  { key: "shadowQuality", label: "MAPA SOMBRAS", values: [512, 1024, 2048, 4096].map(v => [v, `${v}`]), default: 512 },
  { key: "wireframe", label: "WIREFRAME", values: [[0, "OFF"], [1, "GRADE"], [2, "TOTAL"]], default: 0 },
  { key: "moonlight", label: "LUZ DA LUA", values: BOOL, default: true, graphic: true },
  { key: "nightLightLimit", label: "LUZES NOTURNAS", values: [32, 64, 128, 256].map(v => [v, `${v}`]), default: 32, graphic: true },
  effect("normalMaps", "NORMAL MAPS", BOOL, true),
];
const INTERFACE = [{key:'showInterventions',label:'CONTROLES DE INTERVENÇÃO',values:BOOL,default:true}];
const EFFECTS = [
  { key: "postEffects", label: "POS EFEITOS", values: BOOL, default: true },
  effect("dofStrength", "PROFUNDIDADE", ["OFF", "LOW", "MED", "HIGH"].map(v => [v, v]), "HIGH"),
  effect("chroma", "ABERRACAO COR", BOOL, true),
  effect("fog", "NEBLINA", ["OFF", "LIGHT", "DENSE", "MIST", "SILENT HILL"].map(v => [v, v]), "LIGHT"),
  effect("waterReflections", "REFLEXO AGUA", BOOL, true),
  effect("godRays", "RAIOS DE SOL", BOOL, true),
  effect("lensFlare", "LENS FLARE", BOOL, true),
  effect("anisotropy", "ANISOTROPIA", [1, 2, 4, 8, 16].map(v => [v, `${v}X`]), 4),
  effect("brightness", "BRILHO", [0.5, 0.75, 1, 1.25, 1.5].map(v => [v, `${v}`]), 1),
  effect("contrast", "CONTRASTE", [0.5, 0.75, 1, 1.25, 1.5].map(v => [v, `${v}`]), 1),
];
export class OptionsPanel {
  constructor({ renderer, time, step, storage = null, onTimeChange = () => {} }) {
    this.renderer = renderer;
    this.time = time;
    this.onTimeChange = onTimeChange;
    this.step = step;
    this.storage = storage;
    this.open = false;
    this.tab = "GRAPHICS";
    this.scroll = 0;
    this.maxScroll = 0;
    this.bounds = null;
    this.values = {};
    this.items = [...GRAPHICS, ...EFFECTS, ...INTERFACE].map(item => item.key === "nightLightLimit" && Number.isFinite(renderer.nightLightLimitCeiling)
      ? { ...item, values: item.values.filter(([value]) => value <= renderer.nightLightLimitCeiling) }
      : item);
    for (const item of this.items) if (!item.values.length) item.values = [[32, "32"]];
    let saved = {};
    try { saved = JSON.parse(storage?.getItem("experience-framework.options") || "{}") || {}; } catch {}
    for (const item of this.items) {
      const previous=saved[item.key];
      const value = item.values.some(([v]) => v === previous) ? previous : item.key==='resolution'&&Number.isFinite(previous) ? item.values.reduce((best,[v])=>Math.abs(v-previous)<=Math.abs(best-previous)?v:best,item.default) : item.default;
      this.apply(item.key, value, false);
    }
  }

  toggle() { this.open = !this.open; }

  apply(key, value, persist = true) {
    const item = this.items.find(row => row.key === key);
    if (!item || !item.values.some(([v]) => v === value)) return false;
    const r = this.renderer;
    if (item.graphic) r.setGraphicOptions({ [key]: value });
    else if (key === "terrainOptimizations") r.setTerrainOptimizations(value);
    else if (key === "resolution") r.setResolutionScale(value);
    else if (key === "shadows" && r.shadowsEnabled !== value) r.toggleShadows();
    else if (key === "shadowQuality") r.setShadowQuality(value);
    else if (key === "wireframe") {
      for (let i = 0; i < 3 && r.wireframeMode !== value; i++) r.toggleWireframe();
    } else if (key === "postEffects") r.postEffectsEnabled = value;
    this.values[key] = value;
    if (persist) {
      try { this.storage?.setItem("experience-framework.options", JSON.stringify(this.values)); } catch {}
    }
    return true;
  }

  scrollAt(x, y, delta) {
    const b = this.bounds;
    if (!this.open || !b || x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) return false;
    this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll + delta));
    return true;
  }

  draw(ui) {
    if (!this.open) return;
    const floating=this.floatingBounds;
    const w=floating?.w ?? Math.min(568,ui.width-16), h=floating?.h ?? Math.max(100,Math.min(460,ui.height-120));
    const x=floating?.x ?? Math.floor((ui.width-w)/2), y=floating?.y ?? 40;
    this.bounds = { x, y, w, h };
    if(!floating){
      ui.regions.push({x:0,y:34,w:ui.width,h:ui.height-34,onClick:null});
      ui.ctx.save();ui.ctx.fillStyle='rgba(0,0,0,.75)';ui.ctx.fillRect(0,34,ui.width,ui.height-34);ui.ctx.restore();ui.panel(x,y,w,h,'OPCOES','');
    }
    ui.button(floating ? x+8 : x+w-126, floating ? y+h-32 : y+4, 88, 20, "PADROES", () => {
      for (const item of this.items) this.apply(item.key, item.default);
    });
    if(!floating)ui.button(x+w-32,y+4,26,20,"X",()=>this.toggle());
    if (this.tab === "HISTORY") this.tab = "GRAPHICS";
    const effectsAvailable = !!(this.renderer.isThirdPersonActive?.() ||
      (this.renderer.isFirstPersonActive?.() && this.renderer.fpEntityId == null));
    if (!effectsAvailable && this.tab === "VISUAL") this.tab = "GRAPHICS";
    const tabs = [["GRAPHICS", "GRAFICOS"]];
    if (effectsAvailable) tabs.push(["VISUAL", "EFEITOS"]);
    tabs.push(["TIME", "TEMPO"], ["INTERFACE", "INTERFACE"]);
    tabs.forEach(([id, label], i) => {
      const bw = Math.floor((w - 32) / tabs.length);
      ui.button(x + 8 + i * (bw + 4), y + 30, bw, 24, label, () => { this.tab = id; this.scroll = 0; }, { selected: this.tab === id });
    });
    const rows = this.tab === "INTERFACE" ? INTERFACE : this.tab === "GRAPHICS" ? this.items.filter(item => GRAPHICS.some(graphic => graphic.key === item.key)) : this.items.filter(item => EFFECTS.some(effect => effect.key === item.key));
    const contentY = y + 62, bottom = y + h - (floating?40:6);
    const first = ui.regions.length;
    ui.ctx.save(); ui.ctx.beginPath(); ui.ctx.rect(x + 4, contentY, w - 8, Math.max(0, bottom - contentY)); ui.ctx.clip();
    if (this.tab === "TIME") {
      const columns = Math.max(1, Math.floor((w - 24) / 64));
      this.maxScroll = Math.max(0, 160 + Math.ceil(SPEED_TIERS.length / columns) * 28 - (bottom - contentY));
      this.scroll = Math.min(this.scroll, this.maxScroll);
      const base = contentY - this.scroll;
      ui.text("VELOCIDADE", x + 12, base + 8, "#f8b800");
      SPEED_TIERS.forEach((value, i) => ui.button(x + 12 + i % columns * 64, base + 24 + Math.floor(i / columns) * 28, 60, 24,
        speedLabel(value), () => { this.time.setSpeed(value); this.onTimeChange(this.time); }, { selected: this.time.speed === value }));
      const after = base + 30 + Math.ceil(SPEED_TIERS.length / columns) * 28;
      ui.button(x + 12, after, 118, 24, this.time.paused ? "CONTINUAR" : "PAUSAR", () => { this.time.setPaused(!this.time.paused); this.onTimeChange(this.time); });
      ui.button(x + 138, after, 90, 24, "PASSO", () => this.step());
      ui.text("ESPACO: PAUSA\n-/+: VELOCIDADE\n.: UM PASSO QUANDO PAUSADO\nff: AVANÇO COM DETALHE REDUZIDO\nff2: DETALHES PESSOAIS EM MENOR FREQUÊNCIA", x + 12, after + 42);
    } else {
      const headingHeight = this.tab === "VISUAL" ? 0 : 22;
      this.maxScroll = Math.max(0, rows.length * 30 + headingHeight - (bottom - contentY));
      this.scroll = Math.min(this.scroll, this.maxScroll);
      if (headingHeight) ui.text("AJUSTES DO RENDERIZADOR 3D", x + 12, contentY + 4 - this.scroll, "#3cbcfc");
      rows.forEach((row, i) => {
        const ry = contentY + headingHeight + i * 30 - this.scroll;
        if (ry + 30 < contentY || ry > bottom) return;
        ui.text(row.label, x + 12, ry + 6);
        const current = this.values[row.key];
        const exactIndex = row.values.findIndex(([v]) => v === current);
        const index = exactIndex >= 0 ? exactIndex : row.values.reduce((best, [value], i) =>
          Math.abs(value - current) < Math.abs(row.values[best][0] - current) ? i : best, 0);
        const valueWidth = Math.min(150, Math.floor(w * 0.42));
        const bx = x + w - valueWidth - 12;
        ui.button(bx, ry, valueWidth, 24, row.values[index][1], () => this.apply(row.key, row.values[(index + 1) % row.values.length][0]));
      });
    }
    ui.ctx.restore();
    if(this.maxScroll>0){const height=bottom-contentY,thumb=Math.max(16,height*height/(height+this.maxScroll)),top=contentY+(height-thumb)*this.scroll/this.maxScroll;ui.ctx.fillStyle='#817d6b';ui.ctx.fillRect(x+w-7,contentY,5,height);ui.ctx.fillStyle='#e5dfcb';ui.ctx.fillRect(x+w-7,top,5,thumb);ui.regions.push({x:x+w-12,y:contentY,w:12,h:height,onClick:()=>{this.scroll=this.scroll>=this.maxScroll?0:Math.min(this.maxScroll,this.scroll+height*.7);}});}
    const regions = ui.regions.splice(first);
    for (const region of regions) {
      const top = Math.max(contentY, region.y), end = Math.min(bottom, region.y + region.h);
      if (end > top) ui.regions.push({ ...region, y: top, h: end - top });
    }
  }
}
