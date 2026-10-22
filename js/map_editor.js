// Terrain tools are independent of entity behaviors and simulation rules.
export const EDITOR_TILES = [
  [0, "RELVA"], [1, "MONTANHA"], [2, "AGUA"], [3, "AREIA"],
  [4, "PEDRA"], [5, "VAZIO"], [6, "R. RELVA"], [7, "R. AREIA"],
  [8, "P. RELVA"], [9, "COLINA"], [10, "CUME"], [11, "P. AREIA"],
  [12, "R. COLINA"], [13, "P. COLINA"],
];

export class MapEditor {
  constructor({ world, entities, destroyEntity }) {
    this.world = world;
    this.entities = entities;
    this.destroyEntity = destroyEntity;
    this.open = false;
    this.tool = "PAINT";
    this.tile = 0;
    this.brushSize = 1;
    this.tab = "TILES";
    this.prefabs = new Map();
    this.prefabId = null;
    this.page = 0;
    this.lastTile = null;
    this.strokeActive = false;
    this.scroll = 0;
    this.maxScroll = 0;
    this.bounds = null;
  }

  registerPrefab(id, { label = id, create }) {
    if (typeof create !== "function") throw new TypeError("Prefab precisa de uma funcao create(x, y).");
    this.prefabs.set(id, { label, create });
  }

  toggle() {
    this.endStroke();
    this.open = !this.open;
  }

  inBounds(x, y) {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.world.width && y < this.world.height;
  }

  beginStroke(tile) {
    this.endStroke();
    if (!this.open || !tile || !this.inBounds(tile.x, tile.y)) return false;
    this.strokeActive = true;
    this.lastTile = tile;
    this.apply(tile.x, tile.y);
    return true;
  }

  continueStroke(tile) {
    if (!this.strokeActive || !tile || !this.inBounds(tile.x, tile.y)) return;
    if (this.tool === "SPAWN" || this.tool === "SAMPLE") return;
    // Fill the segment between pointer events, including when the pointer moves fast.
    const start = this.lastTile;
    if (!start) {
      this.lastTile = tile;
      this.apply(tile.x, tile.y);
      return;
    }
    const steps = Math.max(Math.abs(tile.x - start.x), Math.abs(tile.y - start.y));
    for (let i = 1; i <= steps; i++) {
      this.apply(Math.round(start.x + (tile.x - start.x) * i / steps), Math.round(start.y + (tile.y - start.y) * i / steps));
    }
    this.lastTile = tile;
  }

  endStroke() {
    this.strokeActive = false;
    this.lastTile = null;
  }

  scrollAt(x, y, delta) {
    const b = this.bounds;
    if (!this.open || !b || x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) return false;
    this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll + delta));
    return true;
  }

  apply(cx, cy) {
    if (!this.inBounds(cx, cy)) return;
    if (this.tool === "SAMPLE") {
      this.tile = this.world.getTile(cx, cy);
      this.tool = "PAINT";
      this.endStroke();
      return;
    }
    if (this.tool === "SPAWN") {
      this.prefabs.get(this.prefabId)?.create(cx, cy);
      return;
    }
    const half = Math.floor(this.brushSize / 2);
    if (this.tool === "REMOVE") {
      for (const entity of [...this.entities]) {
        if (!entity.destroyed && Math.abs(Math.floor(entity.x) - cx) <= half && Math.abs(Math.floor(entity.y) - cy) <= half) {
          this.destroyEntity(entity);
        }
      }
    } else if (this.tool === "PAINT") {
      for (let y = cy - half; y <= cy + half; y++) {
        for (let x = cx - half; x <= cx + half; x++) {
          if (this.inBounds(x, y) && this.world.getTile(x, y) !== this.tile) this.world.setTile(x, y, this.tile);
        }
      }
    }
  }

  drawPreview(ui, tile, project) {
    if (!this.open || !tile || !this.inBounds(tile.x, tile.y)) return;
    const half = this.tool === "SPAWN" || this.tool === "SAMPLE" ? 0 : Math.floor(this.brushSize / 2);
    const corners = [[tile.x - half, tile.y - half], [tile.x + half + 1, tile.y - half],
      [tile.x + half + 1, tile.y + half + 1], [tile.x - half, tile.y + half + 1]].map(([x, y]) => project(x, y));
    if (corners.some((point) => !point)) return;
    ui.ctx.save();
    ui.ctx.strokeStyle = this.tool === "REMOVE" ? "#ff6060" : "#f8b800";
    ui.ctx.lineWidth = 2;
    ui.ctx.beginPath();
    corners.forEach((point, i) => i ? ui.ctx.lineTo(point.x, point.y) : ui.ctx.moveTo(point.x, point.y));
    ui.ctx.closePath();
    ui.ctx.stroke();
    ui.ctx.restore();
  }

  draw(ui, hoverTile) {
    if (!this.open) return;
    const x = 12, top = 46, w = Math.min(336, ui.width - 24);
    const h = Math.max(80, Math.min(358, ui.height - 100));
    this.bounds = { x, y: top, w, h };
    this.maxScroll = Math.max(0, 324 - h);
    this.scroll = Math.min(this.scroll, this.maxScroll);
    const y = top - this.scroll;
    ui.panel(x, top, w, h, "EDITOR DE MAPA", "");
    ui.button(x + w - 30, top + 4, 24, 20, "X", () => this.toggle());
    const firstBodyRegion = ui.regions.length;
    ui.ctx.save();
    ui.ctx.beginPath();
    ui.ctx.rect(x + 3, top + 26, w - 6, h - 29);
    ui.ctx.clip();
    ui.button(x + 8, y + 29, 116, 22, "TERRENO", () => { this.tab = "TILES"; }, { selected: this.tab === "TILES" });
    ui.button(x + 130, y + 29, 116, 22, "OBJETOS", () => { this.tab = "OBJECTS"; }, { selected: this.tab === "OBJECTS" });
    const colW = Math.floor((w - 24) / 3);
    if (this.tab === "TILES") {
      EDITOR_TILES.forEach(([id, label], index) => {
        ui.button(x + 8 + index % 3 * (colW + 4), y + 58 + Math.floor(index / 3) * 26, colW, 22, label,
          () => { this.tile = id; this.tool = "PAINT"; }, { selected: this.tool === "PAINT" && this.tile === id });
      });
    } else {
      const prefabs = [...this.prefabs.entries()];
      const perPage = 4;
      const pages = Math.max(1, Math.ceil(prefabs.length / perPage));
      this.page = Math.min(this.page, pages - 1);
      if (!prefabs.length) ui.text("REGISTRE OBJETOS VIA\neditor.registerPrefab()", x + 10, y + 65);
      prefabs.slice(this.page * perPage, (this.page + 1) * perPage).forEach(([id, prefab], i) => {
        ui.button(x + 8, y + 58 + i * 26, w - 16, 22, prefab.label.slice(0, Math.floor((w - 40) / 8)),
          () => { this.prefabId = id; this.tool = "SPAWN"; }, { selected: this.tool === "SPAWN" && this.prefabId === id });
      });
      ui.button(x + 8, y + 162, 38, 22, "<", () => { this.page = (this.page + pages - 1) % pages; });
      ui.text(`${this.page + 1}/${pages}`, x + 54, y + 169);
      ui.button(x + w - 46, y + 162, 38, 22, ">", () => { this.page = (this.page + 1) % pages; });
    }
    [["PAINT", "PINTAR"], ["SAMPLE", "PIPETA"], ["REMOVE", "REMOVER"]].forEach(([tool, label], i) => {
      ui.button(x + 8 + i * (colW + 4), y + 194, colW, 22, label, () => { this.tool = tool; }, { selected: this.tool === tool });
    });
    ui.text("PINCEL:", x + 10, y + 226, "#f8b800");
    [1, 3, 5, 9].forEach((size, i) => {
      const bw = Math.floor((w - 28) / 4);
      ui.button(x + 8 + i * (bw + 4), y + 240, bw, 22, `${size}X${size}`, () => { this.brushSize = size; }, { selected: this.brushSize === size });
    });
    ui.text(hoverTile ? `X:${hoverTile.x} Y:${hoverTile.y}` : "FORA DO MAPA", x + 10, y + 276, "#58d854");
    ui.text("ESQ: EDITAR | DIR: MOVER\nS: FECHAR", x + 10, y + 296);
    ui.ctx.restore();
    // Clip hit regions as well as drawing when the panel scrolls on small screens.
    const body = ui.regions.splice(firstBodyRegion);
    for (const region of body) {
      const start = Math.max(region.y, top + 26);
      const end = Math.min(region.y + region.h, top + h - 3);
      if (end > start) ui.regions.push({ ...region, y: start, h: end - start });
    }
  }
}
