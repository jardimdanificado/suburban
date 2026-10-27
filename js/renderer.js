import {activityBadge,activityBadgeCanvas,activityBadgeKey} from './city_activity_badges.js';
// =============================================================================
// Brutopolis - Ultra Fast Direct Buffer Canvas 2D Visual Renderer
// =============================================================================

import { ASSET_DATA } from "./assets_data.js";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_FLOOR,
  TILE_MOUNTAIN,
  TILE_WATER,
  TILE_SAND,
  TILE_STONE,
  TILE_ROAD_GRASS,
  TILE_ROAD_SAND,
  TILE_ROAD_GRASS_STONE,
  TILE_HILL,
  TILE_PEAK,
  TILE_ROAD_SAND_STONE,
  TILE_ROAD_HILL,
  TILE_ROAD_HILL_STONE
} from "./world_gen.js";
import { globalWallCoords, resolveWallSkin, getEntitiesInViewport } from "./engine.js";

// Framework scenes can opt into blueprints through their own tools. The base
// renderer has no simulation-specific blueprint provider.
const getClanBlueprintTiles = () => [];

// Cached emote textures
let cachedEmoteTextures = null;
function getEmoteTextures() {
  if (!cachedEmoteTextures) {
    cachedEmoteTextures = [
      findTexture("Emote_Angry.png"),
      findTexture("Emote_Excited.png"),
      findTexture("Emote_Happy.png"),
      findTexture("Emote_Hurt.png"),
      findTexture("Emote_Nerd.png"),
      findTexture("Emote_Sad.png"),
      findTexture("Emote_Serious.png"),
      findTexture("Emote_Sick.png"),
      findTexture("Emote_Sleeping.png"),
      findTexture("Emote_Smug.png"),
      findTexture("Emote_Upset.png"),
      findTexture("Emote_Yarr.png"),
      findTexture("Other_Heart.png"),
      findTexture("Item_Skull.png")
    ];
  }
  return cachedEmoteTextures;
}

// ---------------------------------------------------------------------------
// 32-bit Little-Endian RGBA Color Utilities
// ---------------------------------------------------------------------------

function rgba32(r, g, b, a = 255) {
  return ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
}

function colorScale(c32, s) {
  if (s <= 0) return 0xff000000;
  if (s >= 1.0) return c32;
  const r = Math.min(255, Math.floor((c32 & 0xff) * s));
  const g = Math.min(255, Math.floor(((c32 >> 8) & 0xff) * s));
  const b = Math.min(255, Math.floor(((c32 >> 16) & 0xff) * s));
  const a = (c32 >> 24) & 0xff;
  return ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
}

function hexToRgba32(num, defaultAlpha = 255) {
  if (num === undefined || num === null) return rgba32(255, 255, 255, defaultAlpha);
  const r = (num >>> 0) & 0xff;
  const g = (num >>> 8) & 0xff;
  const b = (num >>> 16) & 0xff;
  let a = (num >>> 24) & 0xff;
  if (a === 0 && defaultAlpha > 0) a = defaultAlpha;
  return rgba32(r, g, b, a);
}

// Keep terrain decoration stable between frames instead of using Math.random,
// which would make the tiles flicker while the camera is rendered.
function shouldRenderTerrainSprite(x, y, tileType) {
  let hash = Math.imul(x ^ Math.imul(y, 374761393), 668265263);
  hash = Math.imul(hash ^ (hash >>> 13) ^ tileType, 1274126177) >>> 0;
  return hash % 100 < 15;
}

// ---------------------------------------------------------------------------
// Asset Texture Manager (16x16 Raw Bitmaps for Fast Direct Software Blit)
// ---------------------------------------------------------------------------

const rawTextures = new Map();
let isAssetsLoaded = false;

function loadAllAssets() {
  if (typeof document === "undefined") return Promise.resolve();
  const promises = [];

  for (const item of ASSET_DATA) {
    const p = new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width || 16;
        c.height = img.height || 16;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        
        const entry = {
          width: c.width,
          height: c.height,
          data: new Uint32Array(imgData.data.buffer),
          u8: imgData.data
        };
        rawTextures.set(item.filename.toLowerCase(), entry);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = `data:image/png;base64,${item.base64}`;
    });
    promises.push(p);
  }

  return Promise.all(promises).then(() => {
    isAssetsLoaded = true;
  });
}

export { rawTextures };

const textureLookupCache = new Map();

export function findTexture(path) {
  if (!path) return null;
  if (textureLookupCache.has(path)) return textureLookupCache.get(path);
  const clean = path.toLowerCase().replace(/\\/g, "/");
  const base = clean.split("/").pop();

  if (rawTextures.has(base)) {
    const res = rawTextures.get(base);
    textureLookupCache.set(path, res);
    return res;
  }
  if (rawTextures.has(clean)) {
    const res = rawTextures.get(clean);
    textureLookupCache.set(path, res);
    return res;
  }

  const baseNoExt = base.replace(/\.png$/, "");
  let found = null;
  for (const [k, tex] of rawTextures.entries()) {
    if (k.includes(baseNoExt)) {
      found = tex;
      break;
    }
  }

  if (!found) {
    if (baseNoExt.includes("grass") || baseNoExt.includes("relva") || baseNoExt.includes("grama")) {
      found = rawTextures.get("feature_grass.png");
    } else if (baseNoExt.includes("mountain") || baseNoExt.includes("montanha") || baseNoExt.includes("boulder")) {
      found = rawTextures.get("feature_boulders.png");
    } else if (baseNoExt.includes("sand") || baseNoExt.includes("areia") || baseNoExt.includes("duna")) {
      found = rawTextures.get("feature_pebbles.png");
    } else if (baseNoExt.includes("oak") || baseNoExt.includes("carvalho") || baseNoExt.includes("arvore")) {
      found = rawTextures.get("feature_tree_full.png");
    } else if (baseNoExt.includes("pine") || baseNoExt.includes("pinheiro")) {
      found = rawTextures.get("feature_tree_pine.png");
    } else if (baseNoExt.includes("willow") || baseNoExt.includes("salgueiro")) {
      found = rawTextures.get("feature_tree_bare.png");
    } else if (baseNoExt.includes("flower") || baseNoExt.includes("flor") || baseNoExt.includes("lily")) {
      found = rawTextures.get("feature_flower.png");
    } else if (baseNoExt.includes("cactus") || baseNoExt.includes("cacto") || baseNoExt.includes("shrub")) {
      found = rawTextures.get("item_herb.png");
    } else if (baseNoExt.includes("seaweed") || baseNoExt.includes("alga")) {
      found = rawTextures.get("feature_web.png");
    } else if (baseNoExt.includes("fruit") || baseNoExt.includes("fruta") || baseNoExt.includes("maca")) {
      found = rawTextures.get("item_fruit.png");
    } else if (baseNoExt.includes("nut") || baseNoExt.includes("acorn") || baseNoExt.includes("seed") || baseNoExt.includes("semente")) {
      found = rawTextures.get("item_egg.png");
    } else if (baseNoExt.includes("poop") || baseNoExt.includes("feces") || baseNoExt.includes("dung") || baseNoExt.includes("fezes")) {
      found = rawTextures.get("item_nugget.png");
    } else if (baseNoExt.includes("wood") || baseNoExt.includes("log") || baseNoExt.includes("stick") || baseNoExt.includes("madeira")) {
      found = rawTextures.get("item_pole.png");
    } else if (baseNoExt.includes("stone") || baseNoExt.includes("rock") || baseNoExt.includes("pedra")) {
      found = rawTextures.get("feature_boulders.png");
    } else if (baseNoExt.includes("meat") || baseNoExt.includes("carne")) {
      found = rawTextures.get("item_steak.png");
    } else if (baseNoExt.includes("campfire") || baseNoExt.includes("fogueira") || baseNoExt.includes("fire")) {
      found = rawTextures.get("other_fire.png");
    }
  }

  textureLookupCache.set(path, found);
  return found;
}

// ---------------------------------------------------------------------------
// Software Blitting Helpers (Fast 32-bit Memory Operations)
// ---------------------------------------------------------------------------

function drawBox32(buf32, fbW, fbH, x, y, w, h, c32) {
  if (w <= 0 || h <= 0) return;
  const x0 = x < 0 ? 0 : x;
  const y0 = y < 0 ? 0 : y;
  const x1 = (x + w) > fbW ? fbW : (x + w);
  const y1 = (y + h) > fbH ? fbH : (y + h);

  const a = (c32 >>> 24) & 0xff;
  if (a === 0) return;

  if (a === 255) {
    for (let py = y0; py < y1; py++) {
      const row = py * fbW;
      for (let px = x0; px < x1; px++) {
        buf32[row + px] = c32;
      }
    }
  } else {
    const alpha = a / 255;
    const inv = 1.0 - alpha;
    const sr = c32 & 0xff;
    const sg = (c32 >> 8) & 0xff;
    const sb = (c32 >> 16) & 0xff;

    for (let py = y0; py < y1; py++) {
      const row = py * fbW;
      for (let px = x0; px < x1; px++) {
        const dst = buf32[row + px];
        const dr = dst & 0xff;
        const dg = (dst >> 8) & 0xff;
        const db = (dst >> 16) & 0xff;
        const outR = (sr * alpha + dr * inv) | 0;
        const outG = (sg * alpha + dg * inv) | 0;
        const outB = (sb * alpha + db * inv) | 0;
        buf32[row + px] = 0xff000000 | (outB << 16) | (outG << 8) | outR;
      }
    }
  }
}

function drawBoxOutline32(buf32, fbW, fbH, x, y, w, h, c32) {
  drawBox32(buf32, fbW, fbH, x, y, w, 1, c32);
  drawBox32(buf32, fbW, fbH, x, y + h - 1, w, 1, c32);
  drawBox32(buf32, fbW, fbH, x, y, 1, h, c32);
  drawBox32(buf32, fbW, fbH, x + w - 1, y, 1, h, c32);
}

function drawSpriteTinted32(buf32, fbW, fbH, tex, x, y, sx, sy, fg32, bg32, light = 1.0) {
  if (!tex || sx <= 0 || sy <= 0) return;
  const texData = tex.data;
  const texW = tex.width;
  const texH = tex.height;

  let drawFg = fg32;
  let drawBg = bg32;

  if (light < 1.0) {
    drawFg = colorScale(fg32, light);
    drawBg = colorScale(bg32, light);
  }

  const bgAlpha = (drawBg >>> 24) & 0xff;

  // Fast 1:1 scale path
  if (sx === 16 && sy === 16 && texW === 16 && texH === 16 && x >= 0 && x + 16 <= fbW && y >= 0 && y + 16 <= fbH) {
    for (let dy = 0; dy < 16; dy++) {
      const fbIdx = (y + dy) * fbW + x;
      const texRow = dy * 16;
      for (let dx = 0; dx < 16; dx++) {
        const p = texData[texRow + dx];
        const a = (p >>> 24) & 0xff;
        if (a < 32) continue;

        const pr = p & 0xff;
        const pg = (p >> 8) & 0xff;
        const pb = (p >> 16) & 0xff;

        if (pr > 128 || pg > 128 || pb > 128) {
          buf32[fbIdx + dx] = drawFg;
        } else if (bgAlpha > 0) {
          buf32[fbIdx + dx] = drawBg;
        }
      }
    }
    return;
  }

  // General scaled blit
  for (let dy = 0; dy < sy; dy++) {
    const py = y + dy;
    if (py < 0 || py >= fbH) continue;
    let iy = Math.floor((dy * texH) / sy);
    if (iy >= texH) iy = texH - 1;
    const texRow = iy * texW;
    const fbRow = py * fbW;

    for (let dx = 0; dx < sx; dx++) {
      const px = x + dx;
      if (px < 0 || px >= fbW) continue;
      let ix = Math.floor((dx * texW) / sx);
      if (ix >= texW) ix = texW - 1;

      const p = texData[texRow + ix];
      const a = (p >>> 24) & 0xff;
      if (a < 32) continue;

      const pr = p & 0xff;
      const pg = (p >> 8) & 0xff;
      const pb = (p >> 16) & 0xff;

      if (pr > 128 || pg > 128 || pb > 128) {
        buf32[fbRow + px] = drawFg;
      } else if (bgAlpha > 0) {
        buf32[fbRow + px] = drawBg;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main Renderer Class (Direct Framebuffer Blitting)
// ---------------------------------------------------------------------------

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.ctx.imageSmoothingEnabled = false;

    this.width = canvas.width || 800;
    this.height = canvas.height || 600;

    this.imageData = this.ctx.createImageData(this.width, this.height);
    this.buf32 = new Uint32Array(this.imageData.data.buffer);

    this.camX = 256.0;
    this.camY = 256.0;
    this.zoom = 1.0;
    this.selectedEntityId = -1;
    this.isPaused = false;
    this.targetTps = 60;
    this.waterTime = 0.0;

    this.initPromise = loadAllAssets();
  }

  setCamera(x, y, zoom) {
    this.camX = x;
    this.camY = y;
    if (typeof zoom === "number") {
      this.zoom = Math.max(0.2, Math.min(8.0, zoom));
    }
  }

  getCameraX() { return this.camX; }
  getCameraY() { return this.camY; }
  getCameraZoom() { return this.zoom; }

  getViewportBounds() {
    const width = this.width || 800;
    const height = this.height || 600;
    const tileSize = Math.max(1, 16 * this.zoom);
    const halfVisW = (width / tileSize) * 0.5 + 2;
    const halfVisH = (height / tileSize) * 0.5 + 2;
    return {
      minTx: Math.max(0, Math.floor(this.camX - halfVisW)),
      maxTx: Math.min(MAP_WIDTH - 1, Math.ceil(this.camX + halfVisW)),
      minTy: Math.max(0, Math.floor(this.camY - halfVisH)),
      maxTy: Math.min(MAP_HEIGHT - 1, Math.ceil(this.camY + halfVisH))
    };
  }

  selectEntity(id) { this.selectedEntityId = id; }
  getSelectedId() { return this.selectedEntityId; }

  setPaused(p) { this.isPaused = !!p; }
  isSimPaused() { return this.isPaused; }

  setTps(tps) { this.targetTps = Math.max(1, Math.min(360, tps)); }
  getTps() { return this.targetTps; }

  selectAt(screenX, screenY, entities) {
    const width = this.width;
    const height = this.height;
    if (!width || !height) return -1;

    const tileSize = Math.max(1, 16 * this.zoom);
    const centerX = width / 2;
    const centerY = height / 2;

    const fx = this.camX + (screenX - centerX) / tileSize;
    const fy = this.camY + (screenY - centerY) / tileSize;

    function getFootprint(e) {
      if (!e || !e.properties) return [1, 1];
      const p = e.properties;
      if (p.cityBuilding) return [p.cityBuilding.width, p.cityBuilding.depth];
      if (p.house) {
        const w = p.house.footprintW || (p.house.footprint ? Number(p.house.footprint.split("x")[0]) : 1) || 1;
        const h = p.house.footprintH || (p.house.footprint ? Number(p.house.footprint.split("x")[1]) : 1) || 1;
        return [w, h];
      }
      if (p.leaderHouse) return [3, 3];
      if (p.warehouse || p.slaughterhouse || p.kitchen || p.artisan_hut) return [2, 2];
      return [1, 1];
    }

    // Pass 1: exact tile hit (including multi-tile structures like houses, warehouses, leader palaces)
    for (const e of entities) {
      if (e.destroyed || !e.properties?.render || (e.properties.citizen?.indoorLocation||e.properties.citizen?.ridingVehicleId)) continue;
      const [fpW, fpH] = getFootprint(e);
      if (fx >= e.x && fx < e.x + fpW && fy >= e.y && fy < e.y + fpH) {
        this.selectedEntityId = e.id;
        return e.id;
      }
    }

    // Pass 2: nearest within 1.5 radius
    let closestDist = 1.5;
    let foundId = -1;
    for (const e of entities) {
      if (e.destroyed || !e.properties?.render || (e.properties.citizen?.indoorLocation||e.properties.citizen?.ridingVehicleId)) continue;
      const [fpW, fpH] = getFootprint(e);
      const dx = (e.x + fpW * 0.5) - fx;
      const dy = (e.y + fpH * 0.5) - fy;
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < closestDist) {
        closestDist = d;
        foundId = e.id;
      }
    }

    this.selectedEntityId = foundId;
    return foundId;
  }

  render(world, entities, time, dt, simSpeed = 1.0) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (width === 0 || height === 0) return;

    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;
      this.imageData = this.ctx.createImageData(width, height);
      this.buf32 = new Uint32Array(this.imageData.data.buffer);
    }

    if (!this.isPaused) {
      this.waterTime += Math.min(dt, 0.25) * 2.0 * Math.max(0, simSpeed);
    }

    const buf32 = this.buf32;
    const tileSize = Math.max(1, 16 * this.zoom);
    const centerScreenX = Math.floor(width / 2);
    const centerScreenY = Math.floor(height / 2);

    // 1. Visible map boundaries
    const halfVisW = (width / tileSize) * 0.5 + 2;
    const halfVisH = (height / tileSize) * 0.5 + 2;

    const minTx = Math.max(0, Math.floor(this.camX - halfVisW));
    const maxTx = Math.min(MAP_WIDTH - 1, Math.ceil(this.camX + halfVisW));
    const minTy = Math.max(0, Math.floor(this.camY - halfVisH));
    const maxTy = Math.min(MAP_HEIGHT - 1, Math.ceil(this.camY + halfVisH));

    // 2D Mode is always 100% brightly lit and visible 24/7 (no night darkening)
    const globalLight = 1.0;

    // 2. Cached tile textures
    const texFloor = findTexture("Feature_Grass.png");
    const texMountain = findTexture("Feature_Stone_C.png");
    const texWater = findTexture("Feature_Waves.png");
    const texSand = findTexture("Feature_Pebbles.png");
    const texStone = findTexture("Feature_Stone_B.png");

    const colFloorFg = rgba32(140, 200, 110);
    const colFloorBg = rgba32(35, 65, 30);
    const colMountainFg = rgba32(180, 175, 170);
    const colMountainBg = rgba32(70, 65, 65);
    const colSandFg = rgba32(95, 78, 35);
    const colSandBg = rgba32(235, 205, 115);
    const colStoneFg = rgba32(165, 165, 175);
    const colStoneBg = rgba32(55, 55, 62);
    const colWaterFg = rgba32(80, 150, 240);
    const colWaterBg = rgba32(20, 45, 90);

    const map = world.map;

    // 3. Render Terrain Tiles
    for (let ty = minTy; ty <= maxTy; ty++) {
      const screenY = centerScreenY + Math.floor((ty - this.camY) * tileSize);
      const yOffset = ty * MAP_WIDTH;

      for (let tx = minTx; tx <= maxTx; tx++) {
        const screenX = centerScreenX + Math.floor((tx - this.camX) * tileSize);
        const t = map[yOffset + tx];

        let tex = texFloor;
        let fg = colFloorFg;
        let bg = colFloorBg;

        if (t === TILE_WATER) {
          tex = texWater;

          // Animacao de onda fluida independente da velocidade da simulacao
          const spatialFreq = 0.8;
          const wave = Math.sin(this.waterTime * 2.0 + tx * spatialFreq + ty * (spatialFreq * 0.6)) * 0.1;
          const waveScale = Math.max(0.5, Math.min(1.5, 1.0 + wave));

          fg = rgba32(Math.round(80 * waveScale), Math.round(150 * waveScale), Math.round(240 * waveScale));
          bg = colWaterBg;
        } else if (t === TILE_FLOOR) {
          tex = texFloor;
          fg = colFloorFg;
          bg = colFloorBg;
        } else if (t === TILE_HILL) {
          tex = findTexture("Feature_Grass.png");
          fg = rgba32(55, 95, 40);
          bg = rgba32(35, 65, 25);
        } else if (t === TILE_SAND) {
          tex = texSand;
          fg = colSandFg;
          bg = colSandBg;
        } else if (t === TILE_STONE) {
          tex = texStone;
          fg = colStoneFg;
          bg = colStoneBg;
        } else if (t === TILE_MOUNTAIN) {
          tex = texMountain;
          fg = colMountainFg;
          bg = colMountainBg;
        } else if (t === TILE_PEAK) {
          tex = findTexture("Feature_Stone_C.png");
          fg = rgba32(170, 170, 180);
          bg = rgba32(95, 95, 105);
        } else if (t === TILE_ROAD_GRASS || t === TILE_ROAD_SAND || t === TILE_ROAD_HILL) {
          tex = findTexture("Feature_Stone_B.png");
          fg = rgba32(155, 118, 83);
          bg = rgba32(100, 75, 48);
        } else if (t === TILE_ROAD_GRASS_STONE || t === TILE_ROAD_SAND_STONE || t === TILE_ROAD_HILL_STONE) {
          tex = findTexture("Feature_Brick_A.png");
          fg = rgba32(150, 150, 160);
          bg = rgba32(80, 80, 90);
        }

        // Most grass and hill tiles are kept clean unless sampled
        if ((t === TILE_FLOOR || t === TILE_HILL || t === TILE_SAND) && !shouldRenderTerrainSprite(tx, ty, t)) {
          tex = null;
          fg = bg;
        }

        if (tex) {
          drawBox32(buf32, width, height, screenX, screenY, tileSize, tileSize, colorScale(bg, globalLight));
          drawSpriteTinted32(buf32, width, height, tex, screenX, screenY, tileSize, tileSize, fg, bg, globalLight);
        } else {
          drawBox32(buf32, width, height, screenX, screenY, tileSize, tileSize, colorScale(fg, globalLight));
        }
      }
    }

    // 3.5. Render Planned Clan House Blueprints
    const visibleEntities = getEntitiesInViewport(minTx - 1, maxTx + 1, minTy - 1, maxTy + 1,0,this._visibleEntitiesArray??=([]));
    const clanGroups = new Map();
    const occupiedHouseTiles = new Set();
    for (let i = 0; i < visibleEntities.length; i++) {
      const ve = visibleEntities[i];
      if (!ve || ve.destroyed) continue;
      if (ve.properties?.group && ve.properties.group.id) {
        clanGroups.set(ve.properties.group.id, ve.properties.group);
      }
      if (ve.properties?.house || ve.properties?.render?.skin === "Feature_Wood.png" || ve.properties?.name?.includes("Casa")) {
        occupiedHouseTiles.add(`${Math.floor(ve.x)}_${Math.floor(ve.y)}`);
      }
    }

    if (clanGroups.size > 0) {
      const houseTex = findTexture("Feature_Wood.png");
      for (const group of clanGroups.values()) {
        if (!group || !group.claimedZones) continue;
        const bpTiles = getClanBlueprintTiles(group);
        for (let b = 0; b < bpTiles.length; b++) {
          const bp = bpTiles[b];
          if (bp.type === "house" && bp.x >= minTx && bp.x <= maxTx && bp.y >= minTy && bp.y <= maxTy) {
            const tileKey = `${bp.x}_${bp.y}`;
            if (!occupiedHouseTiles.has(tileKey)) {
              const sx = centerScreenX + Math.floor((bp.x - this.camX) * tileSize);
              const sy = centerScreenY + Math.floor((bp.y - this.camY) * tileSize);
              drawBoxOutline32(buf32, width, height, sx, sy, tileSize, tileSize, rgba32(200, 160, 60));
              // Corner pegs
              drawBox32(buf32, width, height, sx, sy, 2, 2, rgba32(240, 190, 80));
              drawBox32(buf32, width, height, sx + tileSize - 2, sy, 2, 2, rgba32(240, 190, 80));
              drawBox32(buf32, width, height, sx, sy + tileSize - 2, 2, 2, rgba32(240, 190, 80));
              drawBox32(buf32, width, height, sx + tileSize - 2, sy + tileSize - 2, 2, 2, rgba32(240, 190, 80));
              occupiedHouseTiles.add(tileKey);
            }
          }
        }
      }
    }

    // 4. Render Dropped Items & Entities (Fast Viewport Culling)
    const emoteTextures = getEmoteTextures(),campaignPosters=[],activityMarkers=[];

    for (let i = 0; i < visibleEntities.length; i++) {
      const e = visibleEntities[i];
      if (!e || e.destroyed || !e.properties || !e.properties.render || (e.properties.citizen?.indoorLocation||e.properties.citizen?.ridingVehicleId)) continue;

      const r = e.properties.render;
      const isItem = !e.properties.life && (!!e.properties.edible || !!e.properties.resourceType || !!e.properties.germination || e.properties.species === "item");

      const sx = centerScreenX + Math.floor((e.x - this.camX) * tileSize);
      const sy = centerScreenY + Math.floor((e.y - this.camY) * tileSize);

      if(e.properties.cityVehicle){const v=e.properties.cityVehicle,bike=['bicicleta','bicicleta_carga'].includes(v.good),horizontal=Math.abs(Math.sin(v.angle||0))>.5,len=Math.max(5,Math.floor(tileSize*(bike?1:.65))),thin=Math.max(2,Math.floor(tileSize*.16)),color=hexToRgba32(({bicicleta:0x397e99,bicicleta_carga:0xbd793c,patins:0xd5b345,skate:0x765038})[v.good]||0x52879a,255);drawBox32(buf32,width,height,sx-(horizontal?len:thin)/2,sy-(horizontal?thin:len)/2,horizontal?len:thin,horizontal?thin:len,color);for(const sign of [-1,1])drawBox32(buf32,width,height,sx+(horizontal?sign*len*.4:0)-2,sy+(horizontal?0:sign*len*.4)-2,4,4,rgba32(35,43,46));continue;}

      if(e.properties.campaignDecoration){const d=e.properties.campaignDecoration;if(d.kind==='paint')continue;const bg=hexToRgba32(parseInt(d.flag.background.slice(1),16),255),fg=hexToRgba32(parseInt(d.flag.foreground.slice(1),16),255),fw=Math.max(8,Math.floor(tileSize*(d.kind==='flag'?1.2:2))),fh=Math.max(5,Math.floor(fw*.5));drawBox32(buf32,width,height,sx,sy-fh,fw,fh,bg);drawBox32(buf32,width,height,sx,sy-fh,fw,1,fg);drawBox32(buf32,width,height,sx,sy-fh,1,fh+Math.floor(tileSize),rgba32(115,92,60));if(tileSize>=10)campaignPosters.push({d,x:sx,y:sy-fh,w:fw,h:fh});continue;}
      if (e.properties.cityBuilding) {
        const b = e.properties.cityBuilding;
        const color = hexToRgba32(b.campaignPaint?parseInt(b.campaignPaint.color.slice(1),16):b.architectureColor || b.color, 255);
        for (let y = 0; y < b.depth; y++) for (let x = 0; x < b.width; x++) {
          const px = Math.floor(sx + x * tileSize), py = Math.floor(sy + y * tileSize);
          drawBox32(buf32, width, height, px + 1, py + 1, Math.floor(tileSize) - 2, Math.floor(tileSize) - 2, colorScale(color, globalLight));
          drawBox32(buf32, width, height, px + Math.floor(tileSize * .25), py + Math.floor(tileSize * .25), Math.floor(tileSize * .45), Math.floor(tileSize * .35), rgba32(60, 83, 77));
        }
        if(['market','greengrocer'].includes(b.type))for(let y=0;y<b.depth;y++)for(let x=0;x<b.width;x++){
          const px=Math.floor(sx+x*tileSize),py=Math.floor(sy+y*tileSize),band=Math.max(1,Math.floor(tileSize/4));
          for(let stripe=0;stripe<4;stripe++)drawBox32(buf32,width,height,px+stripe*band,py+1,band,Math.max(2,Math.floor(tileSize*.42)),stripe%2?rgba32(238,222,182):b.type==='market'?rgba32(194,79,56):rgba32(69,127,74));
          drawBox32(buf32,width,height,px+2,py+Math.floor(tileSize*.65),Math.max(2,Math.floor(tileSize)-4),Math.max(1,Math.floor(tileSize*.18)),rgba32(154,111,57));
        }
        if(b.constructionKind!=='open-air'){
          const turn=b.rotation||0,dx=[0,1,0,-1][turn],dy=[1,0,-1,0][turn];
          const px=Math.floor(sx+(b.door.x-e.x-dx*.6)*tileSize),py=Math.floor(sy+(b.door.y-e.y-dy*.6)*tileSize);
          drawBox32(buf32,width,height,px-(turn%2?1:Math.floor(tileSize*.2)),py-(turn%2?Math.floor(tileSize*.2):1),turn%2?2:Math.max(2,Math.floor(tileSize*.4)),turn%2?Math.max(2,Math.floor(tileSize*.4)):2,rgba32(38,51,47));
        }
        if(['townhall','council_chamber'].includes(b.type)&&b.governingFlag){
          const f=b.governingFlag,fw=Math.max(10,Math.floor(tileSize*1.65)),fh=Math.max(6,Math.floor(fw*.63));
          const fx=Math.floor(sx+b.width*tileSize*.5),fy=Math.floor(sy+b.depth*tileSize*.5-tileSize*2.5);
          const fg=hexToRgba32(parseInt(f.foreground.slice(1),16),255),bg=hexToRgba32(parseInt(f.background.slice(1),16),255);
          drawBox32(buf32,width,height,fx-1,fy,2,Math.floor(tileSize*2.5),rgba32(200,198,180));
          drawBox32(buf32,width,height,fx+1,fy,fw,fh,bg);
          if(f.pattern===1)drawBox32(buf32,width,height,fx+1,fy+Math.floor(fh*.42),fw,Math.max(1,Math.floor(fh*.16)),fg);
          if(f.pattern===2)for(let row=0;row<fh;row++)drawBox32(buf32,width,height,fx+1,fy+row,Math.max(1,Math.floor(fw*.5*(1-Math.abs(row*2/fh-1)))),1,fg);
          const emblem=findTexture(f.skin);
          if(emblem)drawSpriteTinted32(buf32,width,height,emblem,fx+1+Math.floor(fw*.3),fy+Math.floor(fh*.12),Math.floor(fw*.4),Math.floor(fh*.76),fg,bg,globalLight);
        }
        if (this.selectedEntityId === e.id) drawBoxOutline32(buf32, width, height, sx, sy, Math.floor(b.width * tileSize), Math.floor(b.depth * tileSize), rgba32(248, 220, 120));
        continue;
      }

      if (e.properties.cityPlant) {
        const plant=e.properties.cityPlant,size=r.size||1,w=Math.max(3,Math.floor(tileSize*size)),cx=Math.floor(sx+tileSize/2),cy=Math.floor(sy+tileSize/2);
        drawBox32(buf32,width,height,cx-1,cy,2,Math.max(2,w/2|0),rgba32(100,72,45));
        drawBox32(buf32,width,height,cx-(w/2|0),cy-(w/2|0),w,Math.max(3,w*.7|0),hexToRgba32(r.color,255));
        if(this.selectedEntityId===e.id)drawBoxOutline32(buf32,width,height,sx,sy,Math.floor(tileSize),Math.floor(tileSize),rgba32(248,220,120));
        continue;
      }
      const badge=activityBadge(e.properties?.citizen);if(badge)activityMarkers.push({badge,x:sx+tileSize*.5,y:sy-4});
      const campaign=e.properties?.citizen?.campaign;
      if(campaign?.type==='canvass'&&!campaign.flag&&e.properties.citizen.task==='campaign'&&!e.properties.citizen.path.length){const size=Math.max(5,Math.floor(tileSize*.65)),color=hexToRgba32(parseInt((campaign.speechColor||'#eeeeee').slice(1),16),255);drawBox32(buf32,width,height,Math.floor(sx),Math.floor(sy-size),size,size,color);drawBox32(buf32,width,height,Math.floor(sx+size*.2),Math.floor(sy),2,2,color);}
      if(campaign?.flag && e.properties.citizen.task==='campaign') {
        const f=campaign.flag,fg=hexToRgba32(parseInt(f.foreground.slice(1),16),255),bg=hexToRgba32(parseInt(f.background.slice(1),16),255);
        const fw=Math.max(6,Math.floor(tileSize*.8)),fh=Math.max(5,Math.floor(tileSize*.55)),fx=sx+Math.floor(tileSize*.5),fy=sy-fh;
        drawBox32(buf32,width,height,fx-1,fy,1,fh+Math.floor(tileSize*.7),fg);
        drawBox32(buf32,width,height,fx,fy,fw,fh,bg);
        const emblem=findTexture(f.skin);
        if(emblem)drawSpriteTinted32(buf32,width,height,emblem,fx,fy,fw,fh,fg,bg,globalLight);
      }
      if (isItem) {
        // Dropped Item - Solid background color, no shadow, matching original WASM renderer
        const itemFg = r.color !== undefined ? hexToRgba32(r.color, 255) : rgba32(255, 255, 255, 255);
        const itemBg = r.backcolor !== undefined ? hexToRgba32(r.backcolor, 255) : rgba32(40, 40, 40, 255);

        const itemTex = findTexture(r.skin || "Item_Egg.png");
        if (itemTex) {
          drawSpriteTinted32(buf32, width, height, itemTex, sx, sy, tileSize, tileSize, itemFg, itemBg, globalLight);
        } else {
          drawBox32(buf32, width, height, sx, sy, tileSize, tileSize, itemFg);
        }
      } else {
        // Creature / Humanoid / Structure Color resolution (uses Clan group contrasting colors if member/structure)
        let entFg = r.color !== undefined ? hexToRgba32(r.color, 255) : rgba32(240, 240, 240);
        let entBg = r.backcolor !== undefined ? hexToRgba32(r.backcolor, 0) : rgba32(20, 20, 20, 0);

        // Group / Clan palette override
        let entGroup = e.properties.group;
        if (!entGroup && e.properties.house?.ownerId) {
          const owner = entities.find ? entities.find(m => m.id === e.properties.house.ownerId) : null;
          if (owner?.properties?.group) entGroup = owner.properties.group;
        }
        if (entGroup && entGroup.color) {
          entFg = hexToRgba32(entGroup.color, 255);
          if (entGroup.backcolor) {
            entBg = hexToRgba32(entGroup.backcolor, 255);
          }
        }

        if (e.combatFlash > 0) {
          entFg = rgba32(255, 60, 60);
          entBg = rgba32(255, 255, 255);
        }

        // Walls, Doors/Gates, Houses, Warehouses, Wells, Campfires, Roads and Structures rendering
        const isRoad = !e.properties.life && (!!e.properties.road || e.properties.name?.includes("Estrada") || e.properties.name?.includes("Rua") || e.properties.name?.includes("Encaixe"));
        const isWarehouse = !isRoad && (!!e.properties.warehouse || e.properties.name?.includes("Armazém") || e.properties.name?.includes("Depósito"));
        const isSlaughterhouse = !isRoad && !isWarehouse && (!!e.properties.slaughterhouse || e.properties.name?.includes("Abatedouro"));
        const isKitchen = !isRoad && !isWarehouse && !isSlaughterhouse && (!!e.properties.kitchen || e.properties.name?.includes("Cozinha"));
        const isWell = !isRoad && !isWarehouse && !isSlaughterhouse && !isKitchen && (!!e.properties.well || !!e.properties.isWell || e.properties.name?.includes("Poço") || e.properties.name?.includes("Well"));
        const isCampfire = !isRoad && !isWarehouse && !isSlaughterhouse && !isKitchen && !isWell && (!!e.properties.campfire || e.properties.name?.includes("Campfire") || e.properties.name?.includes("Fogueira"));
        const isDoor = !isWarehouse && !isSlaughterhouse && !isKitchen && !isWell && !isCampfire && !isRoad && !!e.properties.door;
        const isHouse = !isWarehouse && !isSlaughterhouse && !isKitchen && !isWell && !isCampfire && !isRoad && !e.properties.edible && !e.properties.resourceType && !e.properties.germination && e.properties.species !== "item" && (!!e.properties.house || (e.properties.species === "structure" && r.skin === "Feature_Wood.png"));
        const isWall = !isDoor && !isHouse && !isWarehouse && !isSlaughterhouse && !isKitchen && !isWell && !isCampfire && !isRoad && !e.properties.edible && !e.properties.resourceType && !e.properties.germination && (r.skin?.startsWith("Wall_") || e.properties.name?.includes("Muralha") || e.properties.name?.includes("Wall") || (e.properties.structure && !e.properties.isWell && !e.properties.well));
        let entSkin = r.skin || "Human_Knight_M.png";
        if (isRoad) {
          const isSnap = !!e.properties?.road?.isSnapPoint || e.properties?.name?.includes("Encaixe");
          entSkin = isSnap ? "Feature_Pebbles.png" : "Feature_Stone_B.png";
          entFg = isSnap ? rgba32(216, 186, 128) : rgba32(155, 118, 83);
        } else if (isWarehouse) {
          const whVar = e.properties.warehouse?.variant || 0;
          entSkin = whVar === 1 ? "Feature_Brick_A.png" : "Feature_Wood.png";
          if (whVar === 1) entFg = rgba32(190, 190, 190);
        } else if (isSlaughterhouse) {
          const shVar = e.properties.slaughterhouse?.variant || 0;
          entSkin = shVar === 1 ? "Feature_Brick_A.png" : "Feature_Wood.png";
          entFg = rgba32(220, 70, 70);
        } else if (isKitchen) {
          const kitVar = e.properties.kitchen?.variant || 0;
          entSkin = kitVar === 1 ? "Feature_Wood.png" : "Feature_Brick_A.png";
          entFg = rgba32(245, 160, 60);
        } else if (isWell) {
          entSkin = "Feature_Cauldron.png";
          entFg = rgba32(60, 188, 252);
        } else if (isCampfire) {
          entSkin = "Feature_Campfire.png";
        } else if (isDoor) {
          if (e.isConstructed === false) {
            entSkin = "Feature_Wood.png";
          } else {
            entSkin = e.properties.door.isOpen ? "Feature_Door_Open.png" : "Feature_Door_Closed.png";
          }
        } else if (isHouse) {
          const isOverWater = (world && world.getTile(Math.floor(e.x), Math.floor(e.y)) === 2) || (!!e.properties?.house?.isPlatform);
          const hVar = e.properties?.house?.houseVariant || 0;
          if (isOverWater) {
            entSkin = "Feature_Wood.png";
            entFg = rgba32(150, 100, 50);
          } else {
            // 10 distinct house styles
            switch (hVar) {
              case 0: entSkin = "Feature_Wood.png"; entFg = rgba32(212, 163, 115); break; // Wood Cabin
              case 1: entSkin = "Feature_Brick_A.png"; entFg = rgba32(200, 200, 200); break; // Stone Cottage
              case 2: entSkin = "Feature_Wood.png"; entFg = rgba32(230, 200, 110); break; // Thatched Hut
              case 3: entSkin = "Feature_Wood.png"; entFg = rgba32(139, 90, 43); break; // Log Lodge
              case 4: entSkin = "Feature_Brick_B.png"; entFg = rgba32(240, 230, 210); break; // Half-Timbered
              case 5: entSkin = "Feature_Brick_B.png"; entFg = rgba32(210, 150, 90); break; // Mud Brick Adobe
              case 6: entSkin = "Feature_Wood.png"; entFg = rgba32(150, 130, 120); break; // Mountain Stilt
              case 7: entSkin = "Feature_Wood.png"; entFg = rgba32(160, 100, 50); break; // Longhouse
              case 8: entSkin = "Feature_Stone_B.png"; entFg = rgba32(245, 245, 220); break; // Bone Ossuary
              case 9: entSkin = "Feature_Brick_A.png"; entFg = rgba32(180, 120, 80); break; // Watchtower Villa
              default: entSkin = "Feature_Wood.png"; break;
            }
          }
        } else if (isWall) {
          const wStyle = e.wallStyle || e.properties?.wallStyle || "stone";
          if (e.isConstructed === false) {
            entSkin = "Feature_Brick_A.png";
          } else if (wStyle === "bone") {
            entSkin = "Feature_Stone_B.png";
          } else if (wStyle === "wood") {
            entSkin = "Feature_Wood.png";
          } else if (wStyle === "mixed") {
            entSkin = "Feature_Brick_B.png";
          } else {
            entSkin = "Feature_Brick_A.png";
          }
        }
        const entTex = findTexture(entSkin);
        let fpW = 1, fpH = 1;
        if (isHouse) {
          fpW = e.properties.house?.footprintW || (e.properties.house?.footprint ? Number(e.properties.house.footprint.split("x")[0]) : 1) || 1;
          fpH = e.properties.house?.footprintH || (e.properties.house?.footprint ? Number(e.properties.house.footprint.split("x")[1]) : 1) || 1;
        } else if (e.properties.leaderHouse) {
          fpW = 3; fpH = 3;
        } else if (isWarehouse || isSlaughterhouse || isKitchen) {
          fpW = 2; fpH = 2;
        }
        const renderW = Math.max(1, Math.floor(fpW * tileSize * (r.size || 1)));
        const renderH = Math.max(1, Math.floor(fpH * tileSize * (r.size || 1)));

        if (entTex) {
          drawSpriteTinted32(buf32, width, height, entTex, sx, sy, renderW, renderH, entFg, entBg, globalLight);
        } else {
          drawBox32(buf32, width, height, sx + 2, sy + 2, renderW - 4, renderH - 4, entFg);
        }

        // Health bar (HP = Brain Condition for conscious creatures; health/energy for flora/inanimate)
        let hp = 0;
        let maxHp = 100;
        let isCreatureBrain = false;
        if (e.properties.brain) {
          hp = e.properties.brain.condition;
          maxHp = e.properties.brain.maxCondition || 100;
          isCreatureBrain = true;
        } else if (e.properties.life) {
          hp = e.properties.life.energy;
          maxHp = e.properties.life.max;
        }

        if (maxHp > 0 && hp < maxHp && hp > 0) {
          const barW = tileSize;
          const barH = tileSize > 16 ? 3 : 2;
          const barY = sy - barH - 2;
          drawBox32(buf32, width, height, sx, barY, barW, barH, rgba32(50, 10, 10));
          const fillW = Math.max(1, Math.floor((hp / maxHp) * barW));
          const hpColor = isCreatureBrain ? rgba32(230, 60, 60) : rgba32(80, 220, 80);
          drawBox32(buf32, width, height, sx, barY, fillW, barH, hpColor);
        }

        // Construction Progress indicator (renders for houses, walls, gates being built)
        let buildProgress = null;
        if (e.properties.house && !e.properties.house.isCompleted) {
          const h = e.properties.house;
          const cur = (h.woodCurrent || 0) + (h.stoneCurrent || 0);
          const total = (h.woodCost || 3) + (h.stoneCost || 2);
          buildProgress = Math.min(1.0, Math.max(0.0, cur / total));
        } else if (e.isConstructed === false) {
          if (e.woodCost) {
            buildProgress = Math.min(1.0, Math.max(0.0, (e.woodCurrent || 0) / e.woodCost));
          } else if (e.stoneCost) {
            buildProgress = Math.min(1.0, Math.max(0.0, (e.stoneCurrent || 0) / e.stoneCost));
          }
        }

        if (buildProgress !== null) {
          const cBarW = tileSize;
          const cBarH = tileSize > 16 ? 3 : 2;
          const cBarY = sy - cBarH - 2;
          drawBox32(buf32, width, height, sx, cBarY, cBarW, cBarH, rgba32(30, 30, 50));
          const cFillW = Math.max(1, Math.floor(buildProgress * cBarW));
          // Bright cyan/amber construction bar
          drawBox32(buf32, width, height, sx, cBarY, cFillW, cBarH, rgba32(50, 210, 240));
        }

        // Emote bubble & Held Items per hand
        let emoteTex = null;
        if (e.properties?.life?.isSleeping) {
          emoteTex = emoteTextures[8]; // Sleeping Zzz
        } else if (e.emote >= 0 && e.emote < emoteTextures.length) {
          emoteTex = emoteTextures[e.emote];
        } else if (e.motor === 5) emoteTex = emoteTextures[0]; // Attack -> Angry
        else if (e.motor === 4) emoteTex = emoteTextures[8]; // Sleep -> Sleeping
        else if (e.motor === 6) emoteTex = emoteTextures[10]; // Flee -> Upset
        else if (e.motor === 7) emoteTex = emoteTextures[2]; // Socialize -> Happy

        // Detect items held in all hands/arms
        const heldItems = [];
        for (const [k, p] of Object.entries(e.properties || {})) {
          if ((k.toLowerCase().includes("arm") || k.toLowerCase().includes("hand")) && p && p.heldItem) {
            heldItems.push(p.heldItem);
          }
        }
        if (e.properties?.heldItem) heldItems.push(e.properties.heldItem);
        if (e.properties?.equipment?.mainHand) heldItems.push(e.properties.equipment.mainHand);
        if (e.properties?.equipment?.offHand) heldItems.push(e.properties.equipment.offHand);

        if (tileSize >= 12 && (emoteTex || heldItems.length > 0)) {
          const iconSize = Math.floor(tileSize * 0.48);
          let iconX = sx + tileSize - iconSize;
          const iconY = sy - iconSize - 1;

          if (emoteTex) {
            const isSleeping = !!e.properties?.life?.isSleeping;
            const tintFg = isSleeping ? rgba32(100, 200, 255) : ((e.emote === 12) ? rgba32(255, 60, 120) : (e.emote === 13) ? rgba32(255, 40, 40) : rgba32(255, 240, 100));
            drawSpriteTinted32(buf32, width, height, emoteTex, iconX, iconY, iconSize, iconSize, tintFg, rgba32(0, 0, 0, 0), 1.0);
            iconX -= (iconSize + 2);
          }

          for (let h = 0; h < heldItems.length; h++) {
            const it = heldItems[h];
            const itSkin = it.skin || (it.resourceType === "stone" ? "Item_Stone.png" : it.resourceType === "wood" ? "Item_Wood.png" : "Item_Seed.png");
            const itTex = findTexture(itSkin);
            if (itTex) {
              const itFg = it.color !== undefined ? it.color : 0xffffffff;
              drawSpriteTinted32(buf32, width, height, itTex, iconX, iconY, iconSize, iconSize, itFg, rgba32(0, 0, 0, 0), 1.0);
              iconX -= (iconSize + 2);
            }
          }
        }

        // Sleeping Energy Recovery Bar (Cyan/Blue bar below sleeping entity)
        if (e.properties?.life?.isSleeping) {
          const l = e.properties.life;
          const sBarW = tileSize;
          const sBarH = tileSize > 16 ? 3 : 2;
          const sBarY = sy + tileSize + 1;
          drawBox32(buf32, width, height, sx, sBarY, sBarW, sBarH, rgba32(10, 30, 50));
          const sFillW = Math.max(1, Math.floor((l.energy / l.max) * sBarW));
          drawBox32(buf32, width, height, sx, sBarY, sFillW, sBarH, rgba32(60, 180, 255));
        }
      }
    }

    // 5. Final Pass: Selection Box Overlay (Guaranteed to render ON TOP of all entity sprites)
    if (this.selectedEntityId > 0) {
      for (let i = 0; i < visibleEntities.length; i++) {
        const e = visibleEntities[i];
        if (e && !e.destroyed && e.id === this.selectedEntityId) {
          const sx = centerScreenX + Math.floor((e.x - this.camX) * tileSize);
          const sy = centerScreenY + Math.floor((e.y - this.camY) * tileSize);
          const selectColor = rgba32(255, 215, 0);
          const p = e.properties || {};
          let fpW = 1, fpH = 1;
          if (p.house) {
            fpW = p.house.footprintW || (p.house.footprint ? Number(p.house.footprint.split("x")[0]) : 1) || 1;
            fpH = p.house.footprintH || (p.house.footprint ? Number(p.house.footprint.split("x")[1]) : 1) || 1;
          } else if (p.leaderHouse) {
            fpW = 3; fpH = 3;
          } else if (p.warehouse || p.slaughterhouse || p.kitchen || p.artisan_hut) {
            fpW = 2; fpH = 2;
          }
          const selW = fpW * tileSize;
          const selH = fpH * tileSize;
          drawBoxOutline32(buf32, width, height, sx - 2, sy - 2, selW + 4, selH + 4, selectColor);
          drawBoxOutline32(buf32, width, height, sx - 3, sy - 3, selW + 6, selH + 6, selectColor);
          break;
        }
      }
    }

    // 6. Blit final 32-bit buffer straight to Canvas in 1 call (60 FPS even on Zoomout)
    this.ctx.putImageData(this.imageData, 0, 0);
    this.cityActivityCanvases??=new Map();for(const marker of activityMarkers){const key=activityBadgeKey(marker.badge);let canvas=this.cityActivityCanvases.get(key);if(!canvas){canvas=activityBadgeCanvas(marker.badge);this.cityActivityCanvases.set(key,canvas);}const size=Math.max(13,Math.min(26,tileSize*1.1));this.ctx.drawImage(canvas,marker.x-size/2,marker.y-size,size,size);}if(this.cityActivityCanvases.size>64){const used=new Set(activityMarkers.map(m=>activityBadgeKey(m.badge)));for(const key of this.cityActivityCanvases.keys())if(!used.has(key))this.cityActivityCanvases.delete(key);}
    if(campaignPosters.length){const ctx=this.ctx;ctx.save();ctx.textAlign='center';ctx.textBaseline='top';for(const poster of campaignPosters){const {d,x,y,w,h}=poster;ctx.fillStyle=d.flag.foreground;ctx.font=`bold ${Math.max(7,Math.min(14,h*.55))}px sans-serif`;ctx.fillText(String(d.partyNumber),x+w/2,y+1,w-2);if(d.kind==='banner'&&h>=12){ctx.font=`${Math.max(6,Math.min(10,h*.35))}px sans-serif`;ctx.fillText(d.candidateName,x+w/2,y+h*.6,w-2);}}ctx.restore();}
  }

  projectWorldToScreen(worldX, worldY, elevation = 0) {
    const centerScreenX = Math.floor(this.width / 2);
    const centerScreenY = Math.floor(this.height / 2);
    const sx = centerScreenX + Math.floor((worldX - this.camX) * this.tileSize);
    const sy = centerScreenY + Math.floor((worldY - this.camY) * this.tileSize) - Math.floor(elevation * this.tileSize);
    return {
      x: sx,
      y: sy,
      visible: sx >= -80 && sx <= this.width + 80 && sy >= -80 && sy <= this.height + 80
    };
  }
}
