#!/usr/bin/env node
/**
 * Gera um HTML de pré-visualização de todas as animações em data/animals/.
 *
 * Cada pasta data/animals/<espécie>/<clipe>/ é um clipe e cada <n>.obj é um
 * quadro. O HTML usa um único canvas WebGL e desenha cada cartão visível por
 * scissor, então dezenas de animações rodam sem estourar o limite de contextos
 * WebGL do navegador.
 *
 * Uso:
 *   node scripts/generate_animal_animation_preview.mjs
 *   node scripts/generate_animal_animation_preview.mjs --out docs/animais.html
 *
 * Sirva a raiz do projeto (python3 scripts/serve.py) e abra o arquivo gerado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const animalsDir = path.join(root, 'data', 'animals');
const catalogPath = path.join(root, 'js', 'animal_catalog.js');

const CLIP_LABELS = {
  idle: 'Parado',
  walk: 'Andando',
  eat: 'Comendo',
  sleep: 'Dormindo',
  run: 'Correndo',
  caminhar: 'Caminhando',
  use: 'Usando',
  use_alt: 'Usando (alternativo)',
  acenar: 'Acenando',
  a_postos: 'Em posição',
  boiar: 'Boiando',
  carregar: 'Carregando',
  cavar: 'Cavando',
  chute: 'Chute',
  comemorar: 'Comemorando',
  conversar: 'Conversando',
  dancar: 'Dançando',
  derrotado: 'Derrotado',
  dormindo: 'Dormindo',
  morto: 'Morto',
  murro: 'Murro',
  nadar: 'Nadando',
  sentado_no_banco: 'Sentado no banco',
  sentado_no_chao: 'Sentado no chão',
  varrer: 'Varrendo',
  aplaudir: 'Aplaudindo',
  beber: 'Bebendo',
  carregar_parado: 'Carregando (parado)',
  chorar: 'Chorando',
  colher: 'Colhendo',
  dancar_boba: 'Dança boba',
  dancar_breakdance: 'Breakdance',
  dancar_hiphop: 'Hip hop',
  dancar_macarena: 'Macarena',
  dancar_rumba: 'Rumba',
  dancar_salsa: 'Salsa',
  dancar_samba: 'Samba',
  empurrar_carrinho: 'Empurrando carrinho',
  escalar: 'Escalando',
  patins: 'Patins',
  patinete: 'Patinete',
  pedalar: 'Pedalando',
  pescar: 'Pescando',
  pichar: 'Pichando',
  skate: 'Skate',
  tocar_violao: 'Tocando violão',
};

function readCatalog() {
  const source = fs.readFileSync(catalogPath, 'utf8');
  const species = new Map();
  const re = /([a-z_]+):\s*\{\s*id:\s*'[^']*',\s*label:\s*'([^']+)',\s*scientific:\s*'([^']+)'([^}]*)\}/g;
  for (const match of source.matchAll(re)) {
    const [, id, label, scientific, body] = match;
    const color = Number((body.match(/color:\s*(0x[0-9a-f]+)/) || [])[1]);
    species.set(id, { label, scientific, color: Number.isFinite(color) ? color : null });
  }
  return species;
}

function scanAnimals() {
  const catalog = readCatalog();
  const groups = [];
  for (const species of fs.readdirSync(animalsDir, { withFileTypes: true })) {
    if (!species.isDirectory()) continue;
    const speciesDir = path.join(animalsDir, species.name);
    const clips = [];
    for (const clip of fs.readdirSync(speciesDir, { withFileTypes: true })) {
      if (!clip.isDirectory()) continue;
      const frames = fs.readdirSync(path.join(speciesDir, clip.name))
        .filter(name => /^\d+\.obj$/i.test(name))
        .map(name => Number(name.slice(0, -4)))
        .sort((a, b) => a - b);
      if (!frames.length) continue;
      clips.push({ clip: clip.name, label: CLIP_LABELS[clip.name] || clip.name, frames });
    }
    if (!clips.length) continue;
    const order = ['idle', 'walk', 'eat', 'sleep'];
    clips.sort((a, b) => {
      const ai = order.indexOf(a.clip), bi = order.indexOf(b.clip);
      if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      return a.clip.localeCompare(b.clip, 'pt-BR');
    });
    const meta = catalog.get(species.name);
    groups.push({
      species: species.name,
      label: meta?.label || species.name.replace(/_/g, ' '),
      scientific: meta?.scientific || '',
      color: meta?.color ?? 0xc8bfa8,
      clips,
    });
  }
  groups.sort((a, b) => {
    if (a.species === 'humano') return 1;
    if (b.species === 'humano') return -1;
    return a.label.localeCompare(b.label, 'pt-BR');
  });
  return groups;
}

function resolveOut(argv) {
  const index = argv.indexOf('--out');
  const value = index >= 0 ? argv[index + 1] : '';
  return path.resolve(root, value || 'animal_animation_preview.html');
}

function buildHtml(groups, outFile) {
  const relativeRoot = path.relative(path.dirname(outFile), root).split(path.sep).join('/');
  const assetBase = relativeRoot ? relativeRoot + '/' : '';
  const totalFrames = groups.reduce((sum, group) => sum + group.clips.reduce((n, clip) => n + clip.frames.length, 0), 0);
  const totalClips = groups.reduce((sum, group) => sum + group.clips.length, 0);
  const manifest = {
    assetBase,
    groups,
  };
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pré-visualização das animações dos animais</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #0d1210;
    --panel: #151d19;
    --panel-2: #1b2621;
    --line: #2a3831;
    --text: #e8efe6;
    --muted: #9db0a4;
    --accent: #cdddab;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  header {
    position: sticky;
    top: 0;
    z-index: 3;
    padding: 14px 20px;
    background: rgba(13, 18, 16, .94);
    border-bottom: 1px solid var(--line);
    backdrop-filter: blur(8px);
  }
  h1 { margin: 0 0 2px; font-size: 18px; letter-spacing: .01em; }
  .sub { margin: 0 0 12px; color: var(--muted); font-size: 12px; }
  .controls { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; }
  .controls label { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
  input[type="search"], select {
    background: var(--panel-2);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 6px 8px;
    font: inherit;
  }
  input[type="search"] { width: min(280px, 60vw); }
  input[type="range"] { accent-color: var(--accent); width: 120px; }
  button {
    background: var(--panel-2);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 6px 12px;
    font: inherit;
    cursor: pointer;
  }
  button:hover { border-color: var(--accent); }
  button[aria-pressed="true"] { background: var(--accent); color: #17200f; border-color: var(--accent); }
  main { padding: 20px; }
  .group { margin: 0 0 28px; }
  .group h2 {
    margin: 0 0 2px;
    font-size: 15px;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .group h2 small { color: var(--muted); font-weight: 400; font-size: 12px; font-style: italic; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 12px;
    margin-top: 10px;
  }
  .card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
  }
  .stage {
    aspect-ratio: 4 / 3;
    background:
      radial-gradient(ellipse at 50% 82%, rgba(205, 221, 171, .10), transparent 62%),
      linear-gradient(165deg, #222e27, #121a16);
  }
  .caption {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 9px 8px;
    border-top: 1px solid var(--line);
    font-size: 12px;
  }
  .caption b { font-weight: 600; }
  .caption span { color: var(--muted); }
  .empty { color: var(--muted); padding: 40px 0; text-align: center; }
  .note-box {
    margin: 0 20px 24px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--panel);
    color: var(--muted);
    font-size: 12px;
  }
  .note-box code { color: var(--accent); }
  #viewport {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
    pointer-events: none;
  }
  #error {
    display: none;
    margin: 20px;
    padding: 12px;
    border: 1px solid #a4443a;
    border-radius: 8px;
    background: #2a1412;
    color: #ffd7d2;
  }
  footer { padding: 0 20px 28px; color: var(--muted); font-size: 12px; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<canvas id="viewport" aria-hidden="true"></canvas>
<header>
  <h1>Pré-visualização das animações dos animais</h1>
  <p class="sub">${groups.length} espécies, ${totalClips} clipes, ${totalFrames} quadros OBJ em <code>data/animals/</code> · ${new Date().toISOString().slice(0, 10)}</p>
  <div class="controls">
    <label>Buscar <input id="search" type="search" placeholder="espécie ou animação" autocomplete="off"></label>
    <label>Animação <select id="clipFilter"><option value="">todas</option></select></label>
    <label>Velocidade <input id="speed" type="range" min="0.25" max="2" step="0.25" value="1"></label>
    <button id="pause" type="button" aria-pressed="false">Pausar</button>
    <span id="count" class="sub" style="margin:0"></span>
  </div>
</header>
<div class="note-box" id="serverNote" hidden>
  Esta página precisa ser servida por HTTP para carregar os arquivos OBJ e os módulos. Rode
  <code>python3 scripts/serve.py</code> na raiz do projeto e abra
  <code id="serverUrl"></code>.
</div>
<div id="error" role="alert"></div>
<main id="groups"></main>
<div id="empty" class="empty" hidden>Nenhuma animação corresponde ao filtro.</div>
<footer>Clipes com vários quadros tocam em loop na taxa usada pelo jogo (andando 10 fps, comendo 5 fps, demais 8 fps).</footer>

<script>window.__ANIMAL_PREVIEW__ = ${JSON.stringify(manifest)};</script>
<script type="module">
import * as THREE from "https://esm.sh/three@0.160.0";
import { createAnimalSpeciesTextures } from "./${assetBase}js/animal_textures.js";
import { garmentSurface, carryBoxGeometry, carryBoxAnchor, toolPropGeometry, toolAnchor } from "./${assetBase}js/city_citizen_models.js";
import { mobilityModelGeometry, patinsSkateGeometry } from "./${assetBase}js/city_mobility_models.js";

const manifest = window.__ANIMAL_PREVIEW__;
const assetBase = new URL(manifest.assetBase + "data/animals/", document.baseURI);
const canvas = document.getElementById("viewport");
const groupsEl = document.getElementById("groups");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");
const searchEl = document.getElementById("search");
const clipFilterEl = document.getElementById("clipFilter");
const speedEl = document.getElementById("speed");
const pauseEl = document.getElementById("pause");
const errorEl = document.getElementById("error");

if (location.protocol === "file:") {
  const note = document.getElementById("serverNote");
  note.hidden = false;
  document.getElementById("serverUrl").textContent = new URL(location.pathname.split("/").slice(0, -1).join("/") + "/" + "animal_animation_preview.html").pathname;
}

const totalClips = manifest.groups.reduce((sum, group) => sum + group.clips.length, 0);
const allClips = new Map();
for (const group of manifest.groups) for (const clip of group.clips) allClips.set(clip.clip, clip.label);
for (const [id, label] of [...allClips].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))) {
  const option = document.createElement("option");
  option.value = id;
  option.textContent = label;
  clipFilterEl.append(option);
}

const cards = [];
for (const group of manifest.groups) {
  const section = document.createElement("section");
  section.className = "group";
  section.dataset.species = group.species;
  section.dataset.label = (group.label + " " + group.species).toLowerCase();
  const heading = document.createElement("h2");
  heading.textContent = group.label;
  if (group.scientific) {
    const small = document.createElement("small");
    small.textContent = group.scientific;
    heading.append(small);
  }
  const grid = document.createElement("div");
  grid.className = "grid";
  for (const clip of group.clips) {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.clip = clip.clip;
    const stage = document.createElement("div");
    stage.className = "stage";
    const caption = document.createElement("div");
    caption.className = "caption";
    const name = document.createElement("b");
    name.textContent = clip.label;
    const info = document.createElement("span");
    info.textContent = clip.frames.length + (clip.frames.length === 1 ? " quadro" : " quadros");
    caption.append(name, info);
    card.append(stage, caption);
    grid.append(card);
    cards.push({
      species: group.species,
      color: group.color,
      clip: clip.clip,
      label: clip.label,
      frames: clip.frames,
      stage,
      card,
      scene: null,
      mesh: null,
      material: null,
      shadow: null,
      camera: null,
      geometries: new Map(),
      loading: null,
      initialized: false,
      frame: -1,
    });
  }
  section.append(heading, grid);
  groupsEl.append(section);
}

function parseOBJ(text) {
  const vertices = [];
  const uvs = [];
  const normals = [];
  const triangles = [];
  let hasUV = false;
  const index = (raw, length) => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n === 0) throw Error("OBJ: índice inválido");
    const i = n < 0 ? length + n : n - 1;
    if (i < 0 || i >= length) throw Error("OBJ: índice fora da geometria");
    return i;
  };
  for (const line of text.split(/\\r?\\n/)) {
    const row = line.trim();
    if (!row || row.startsWith("#")) continue;
    const fields = row.split(/\\s+/);
    const tag = fields.shift();
    if (tag === "v" || tag === "vn") {
      (tag === "v" ? vertices : normals).push(fields.slice(0, 3).map(Number));
    } else if (tag === "vt") {
      uvs.push([Number(fields[0]) || 0, Number(fields[1]) || 0]);
    } else if (tag === "f") {
      const face = fields.map(part => {
        const bits = part.split("/");
        const uv = bits[1] ? index(bits[1], uvs.length) : null;
        if (uv != null) hasUV = true;
        return {
          vertex: index(bits[0], vertices.length),
          uv,
          normal: bits[2] ? index(bits[2], normals.length) : null,
        };
      });
      for (let i = 1; i < face.length - 1; i++) triangles.push([face[0], face[i], face[i + 1]]);
    }
  }
  for (let i = triangles.length - 1; i >= 0; i--) {
    const [a, b, c] = triangles[i].map(point => vertices[point.vertex]);
    const u = b.map((n, axis) => n - a[axis]);
    const v = c.map((n, axis) => n - a[axis]);
    const area = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
    if (area < 1e-12) triangles.splice(i, 1);
  }
  const positions = new Float32Array(triangles.length * 9);
  const normalData = new Float32Array(positions.length);
  const uvData = new Float32Array(triangles.length * 6);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let offset = 0;
  let uvOffset = 0;
  for (const face of triangles) {
    const [a, b, c] = face.map(point => vertices[point.vertex]);
    const u = b.map((v, i) => v - a[i]);
    const v = c.map((n, i) => n - a[i]);
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(cross[0], cross[1], cross[2]) || 1;
    const flat = cross.map(n => n / length);
    for (const point of face) {
      const xyz = vertices[point.vertex];
      const normal = point.normal == null ? flat : normals[point.normal];
      const uv = point.uv != null ? uvs[point.uv] : [0, 0];
      uvData[uvOffset++] = uv[0];
      uvData[uvOffset++] = uv[1];
      for (let axis = 0; axis < 3; axis++) {
        positions[offset + axis] = xyz[axis];
        normalData[offset + axis] = normal[axis];
        min[axis] = Math.min(min[axis], xyz[axis]);
        max[axis] = Math.max(max[axis], xyz[axis]);
      }
      offset += 3;
    }
  }
  return { positions, normals: normalData, uvs: uvData, hasUV, triangles: triangles.length, bounds: { min, max } };
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearAlpha(0);
  renderer.autoClear = false;
} catch (error) {
  errorEl.style.display = "block";
  errorEl.textContent = "WebGL indisponível neste navegador: " + error.message;
}

const TOOL_CLIPS = {
  cavar: "shovel",
  colher: "scythe",
  pescar: "rod",
  tocar_violao: "guitar",
  beber: "mug",
  pichar: "spray",
};
const CARRY_CLIPS = new Set(["carregar", "carregar_parado"]);
const VEHICLE_CLIPS = {
  pedalar: { kind: "bicicleta", lift: 0.38, xOffset: 0, zOffset: 0, rotY: 0, color: 0x386b78 },
  patinete: { kind: "patinete", lift: 0.14, xOffset: 0, zOffset: 0, rotY: 0, color: 0x648d82 },
  skate: { kind: "skate", lift: 0.136, xOffset: 0.07, zOffset: 0.02, rotY: -0.42, color: 0x414943 },
  patins: { kind: "patins", lift: 0.09, perFoot: true, color: 0xa3774b },
  empurrar_carrinho: { kind: "carrinho", lift: 0, xOffset: 0, zOffset: 0.88, rotY: 0, color: 0x52645b },
};

const humanoColorsCache = new Map();
function buildHumanoColors(faceCount) {
  if (humanoColorsCache.has(faceCount)) return humanoColorsCache.get(faceCount);
  const shoes = garmentSurface(faceCount, "sapatos");
  const pants = garmentSurface(faceCount, "calça");
  const shirt = garmentSurface(faceCount, "camisa");
  const cSkin = new THREE.Color().setHex(0xd69f76);
  const cShirt = new THREE.Color().setHex(0x4c7ca8);
  const cPants = new THREE.Color().setHex(0x344152);
  const cShoes = new THREE.Color().setHex(0x2b2522);
  const colors = new Float32Array(faceCount * 9);
  for (let t = 0; t < faceCount; t++) {
    const col = shoes[t] ? cShoes : pants[t] ? cPants : shirt[t] ? cShirt : cSkin;
    for (let k = 0; k < 3; k++) {
      const i = t * 9 + k * 3;
      colors[i] = col.r;
      colors[i + 1] = col.g;
      colors[i + 2] = col.b;
    }
  }
  const attr = new THREE.Float32BufferAttribute(colors, 3);
  humanoColorsCache.set(faceCount, attr);
  return attr;
}

let humanoNormPromise = null;
function getHumanoNorm() {
  if (!humanoNormPromise) {
    const url = new URL("humano/idle/0.obj", assetBase);
    humanoNormPromise = fetch(url)
      .then(r => (r.ok ? r.text() : null))
      .then(text => {
        if (!text) return null;
        const data = parseOBJ(text);
        const h = data.bounds.max[1] - data.bounds.min[1];
        if (!(h > 0)) return null;
        const origin = [
          (data.bounds.min[0] + data.bounds.max[0]) / 2,
          data.bounds.min[1],
          (data.bounds.min[2] + data.bounds.max[2]) / 2,
        ];
        return { origin, factor: 1.05 / h };
      })
      .catch(() => null);
  }
  return humanoNormPromise;
}

const propGeoCache = new Map();
function getPropGeometry(kind) {
  if (!propGeoCache.has(kind)) {
    propGeoCache.set(kind, kind === "carry-box" ? carryBoxGeometry(THREE) : toolPropGeometry(THREE, kind));
  }
  return propGeoCache.get(kind);
}

const vehicleGeoCache = new Map();
function getVehicleGeometry(kind) {
  if (!vehicleGeoCache.has(kind)) {
    vehicleGeoCache.set(kind, mobilityModelGeometry(THREE, kind));
  }
  return vehicleGeoCache.get(kind);
}

const propMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide });
const materials = new Map();
function materialFor(species, color, textured) {
  if (species === "humano") {
    if (!materials.has("humano:vertex")) {
      materials.set("humano:vertex", new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }));
    }
    return materials.get("humano:vertex");
  }
  const key = species + (textured ? ":tex" : ":plain");
  if (materials.has(key)) return materials.get(key);
  let material;
  if (textured) {
    try {
      const maps = createAnimalSpeciesTextures(THREE, species);
      material = new THREE.MeshLambertMaterial({ color: 0xffffff, map: maps.map, normalMap: maps.normalMap });
    } catch (error) {
      material = null;
    }
  }
  if (!material) material = new THREE.MeshLambertMaterial({ color: color || 0xc8bfa8 });
  materials.set(key, material);
  return material;
}

let singleSkateGeo = null;
function getSingleSkateGeometry() {
  if (!singleSkateGeo) singleSkateGeo = patinsSkateGeometry(THREE);
  return singleSkateGeo;
}

function footAnchor(data, sideSign) {
  const pos = data.positions;
  const pts = [];
  for (let i = 0; i < pos.length; i += 3) {
    if (pos[i] * sideSign > 0.02) pts.push([pos[i], pos[i + 1], pos[i + 2]]);
  }
  pts.sort((a, b) => a[1] - b[1]);
  const top = pts.slice(0, 12);
  let x = 0, y = 0, z = 0;
  for (const p of top) { x += p[0]; y += p[1]; z += p[2]; }
  const n = top.length || 1;
  return { x: x / n, y: y / n, z: z / n };
}

function positionPropMesh(card, data) {
  if (card.patinsGroup && data) {
    for (const [group, sign] of [[card.patinsGroup.left, 1], [card.patinsGroup.right, -1]]) {
      const f = footAnchor(data, sign);
      group.position.set(f.x, Math.max(0, f.y - 0.01), f.z);
      group.rotation.x = f.y > 0.03 ? 0.32 : 0;
    }
  }
  if (!card.propMesh || !data) return;
  if (CARRY_CLIPS.has(card.clip)) {
    const anchor = carryBoxAnchor(data);
    card.propMesh.position.set(anchor.x || 0, anchor.y || 0.55, anchor.z || 0.2);
    card.propMesh.quaternion.identity();
    return;
  }
  const toolKind = TOOL_CLIPS[card.clip];
  if (toolKind) {
    const anchor = toolAnchor(data, toolKind);
    card.propMesh.position.set(anchor.x || 0, anchor.y || 0.55, anchor.z || 0.2);
    const axis = new THREE.Vector3(anchor.ax || 0, anchor.ay || 1, anchor.az || 0);
    card.propMesh.quaternion.setFromAxisAngle(axis, anchor.angle || 0);
  }
}

function fetchFrame(card, frame) {
  const key = frame;
  if (card.geometries.has(key)) return Promise.resolve(card.geometries.get(key));
  const url = new URL(card.species + "/" + card.clip + "/" + frame + ".obj", assetBase);
  const promise = Promise.all([
    fetch(url).then(response => {
      if (!response.ok) throw Error("Falha em " + url.pathname + " (" + response.status + ")");
      return response.text();
    }),
    card.species === "humano" ? getHumanoNorm() : Promise.resolve(null),
  ])
    .then(([text, norm]) => {
      const data = parseOBJ(text);
      if (norm) {
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < data.positions.length; i++) {
          const axis = i % 3;
          const v = (data.positions[i] - norm.origin[axis]) * norm.factor;
          data.positions[i] = v;
          if (v < min[axis]) min[axis] = v;
          if (v > max[axis]) max[axis] = v;
        }
        data.bounds = { min, max };
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
      if (card.species === "humano") {
        geometry.setAttribute("color", buildHumanoColors(data.triangles));
      } else if (data.hasUV && data.uvs.length === (data.positions.length / 3) * 2 && data.uvs.length) {
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
      }
      geometry.computeBoundingSphere();
      return { geometry, rawData: data, bounds: data.bounds, textured: geometry.hasAttribute("uv") };
    })
    .catch(error => {
      console.warn(error);
      return null;
    });
  card.geometries.set(key, promise);
  return promise;
}

async function initCard(card) {
  if (card.initialized) return;
  card.initialized = true;
  const data = await Promise.resolve(fetchFrame(card, card.frames[0]));
  if (!data) return;
  const scene = new THREE.Scene();
  const material = materialFor(card.species, card.color, data.textured);
  const mesh = new THREE.Mesh(data.geometry, material);
  const vehicleInfo = card.species === "humano" ? VEHICLE_CLIPS[card.clip] : null;
  if (vehicleInfo) mesh.position.y = vehicleInfo.lift;
  scene.add(mesh);

  card.propMesh = null;
  if (card.species === "humano") {
    if (CARRY_CLIPS.has(card.clip)) {
      card.propMesh = new THREE.Mesh(getPropGeometry("carry-box"), propMaterial);
      scene.add(card.propMesh);
      positionPropMesh(card, data.rawData);
    } else if (TOOL_CLIPS[card.clip]) {
      card.propMesh = new THREE.Mesh(getPropGeometry(TOOL_CLIPS[card.clip]), propMaterial);
      scene.add(card.propMesh);
      positionPropMesh(card, data.rawData);
    }
    if (vehicleInfo) {
      const paintMat = new THREE.MeshLambertMaterial({ color: vehicleInfo.color, vertexColors: true, side: THREE.DoubleSide });
      if (vehicleInfo.perFoot) {
        const sg = getSingleSkateGeometry();
        const makeSkate = () => {
          const g = new THREE.Group();
          g.add(new THREE.Mesh(sg.fixed, propMaterial), new THREE.Mesh(sg.paint, paintMat));
          return g;
        };
        const left = makeSkate();
        const right = makeSkate();
        scene.add(left, right);
        card.patinsGroup = { left, right };
        positionPropMesh(card, data.rawData);
      } else {
        const vg = getVehicleGeometry(vehicleInfo.kind);
        const vehicleGroup = new THREE.Group();
        vehicleGroup.add(new THREE.Mesh(vg.fixed, propMaterial), new THREE.Mesh(vg.paint, paintMat));
        vehicleGroup.position.set(vehicleInfo.xOffset || 0, 0, vehicleInfo.zOffset || 0);
        vehicleGroup.rotation.y = vehicleInfo.rotY || 0;
        scene.add(vehicleGroup);
      }
    }
  }

  scene.add(new THREE.HemisphereLight(0xffffff, 0x40503f, 1.8));
  const key = new THREE.DirectionalLight(0xfff1d8, 2.8);
  key.position.set(2.5, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc4ff, .8);
  rim.position.set(-3, 1.5, -2);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, .35));

  const box = new THREE.Box3().setFromObject(scene);
  const sizeVec = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(sizeVec);
  box.getCenter(center);
  const radius = Math.max(0.001, sizeVec.length() / 2);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(radius * .72, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .22, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(center.x, box.min.y + radius * .002, center.z);
  shadow.scale.set(1, sizeVec.z / Math.max(.001, sizeVec.x), 1);
  scene.add(shadow);

  const camera = new THREE.PerspectiveCamera(30, 4 / 3, radius * .02, radius * 40);
  const rect = card.stage.getBoundingClientRect();
  const aspect = Math.max(0.2, rect.width / Math.max(1, rect.height));
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const fit = Math.min(vFov, hFov);
  const distance = radius / Math.sin(fit / 2) * 1.08;
  const direction = new THREE.Vector3(1, .55, 1.35).normalize();
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.lookAt(center);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  card.scene = scene;
  card.mesh = mesh;
  card.material = material;
  card.shadow = shadow;
  card.camera = camera;
  card.frame = card.frames[0];

  for (const frame of card.frames.slice(1)) {
    fetchFrame(card, frame).then(entry => {
      if (!entry) return;
      if (!card.mesh || card.mesh.geometry !== entry.geometry) {
        // Pré-aquece o cache; o quadro só aparece quando o loop o escolher.
      }
    });
  }
}

function fpsFor(clip, frames) {
  if (frames <= 1) return 1;
  if (clip === "walk") return 10;
  if (clip === "eat") return 5;
  return 8;
}

function cardVisible(card) {
  if (card.card.hidden) return false;
  const rect = card.stage.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 1 && rect.height > 1;
}

function applyFilter() {
  const term = searchEl.value.trim().toLowerCase();
  const clip = clipFilterEl.value;
  let shown = 0;
  for (const section of groupsEl.children) {
    let sectionShown = 0;
    const speciesMatch = !term || section.dataset.label.includes(term);
    for (const card of section.querySelectorAll(".card")) {
      const info = cards.find(item => item.card === card);
      const textMatch = speciesMatch || (info && info.label.toLowerCase().includes(term));
      const visible = textMatch && (!clip || card.dataset.clip === clip);
      card.hidden = !visible;
      if (visible) sectionShown++;
    }
    section.hidden = sectionShown === 0;
    shown += sectionShown;
  }
  emptyEl.hidden = shown !== 0;
  countEl.textContent = shown + " de " + cards.length + " animações";
}

searchEl.addEventListener("input", applyFilter);
clipFilterEl.addEventListener("change", applyFilter);
applyFilter();

let paused = false;
pauseEl.addEventListener("click", () => {
  paused = !paused;
  pauseEl.setAttribute("aria-pressed", String(paused));
  pauseEl.textContent = paused ? "Continuar" : "Pausar";
  dirty = true;
});

let speed = 1;
speedEl.addEventListener("input", () => { speed = Number(speedEl.value) || 1; dirty = true; });

let elapsed = 0;
let lastTime = performance.now();
let lastDraw = 0;
let dirty = true;
window.addEventListener("resize", () => { dirty = true; });
window.addEventListener("scroll", () => { dirty = true; }, { passive: true });

function resizeRenderer() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}

function draw() {
  requestAnimationFrame(draw);
  const now = performance.now();
  const dt = Math.min(.1, (now - lastTime) / 1000);
  lastTime = now;
  if (!paused) elapsed += dt * speed;
  if (!renderer) return;
  if (now - lastDraw < 33 && !dirty) return;
  if (paused && !dirty) return;
  dirty = false;
  lastDraw = now;

  resizeRenderer();
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);

  for (const card of cards) {
    if (!cardVisible(card)) continue;
    if (!card.initialized) initCard(card);
    if (!card.scene) continue;
    const rect = card.stage.getBoundingClientRect();
    const x = rect.left;
    const y = window.innerHeight - rect.bottom;
    const width = rect.width;
    const height = rect.height;
    if (width < 2 || height < 2) continue;

    if (card.frames.length > 1) {
      const fps = fpsFor(card.clip, card.frames.length);
      const phase = (card.species.length * 7 + card.clip.length * 3) % card.frames.length;
      const frame = card.frames[Math.floor(elapsed * fps + phase) % card.frames.length];
      if (frame !== card.frame) {
        const entry = card.geometries.get(frame);
        if (entry && entry.then && card.pendingFrame !== frame) {
          card.pendingFrame = frame;
          entry.then(data => {
            card.pendingFrame = null;
            if (data && card.mesh && card.mesh.geometry !== data.geometry) {
              card.mesh.geometry = data.geometry;
              card.mesh.material = materialFor(card.species, card.color, data.textured);
              positionPropMesh(card, data.rawData);
              card.frame = frame;
            }
          });
        }
      }
    }

    card.camera.aspect = width / height;
    card.camera.updateProjectionMatrix();
    renderer.setViewport(x, y, width, height);
    renderer.setScissor(x, y, width, height);
    renderer.clear();
    renderer.render(card.scene, card.camera);
  }
  renderer.setScissorTest(false);
}

if (renderer) {
  resizeRenderer();
  requestAnimationFrame(draw);
} else {
  emptyEl.hidden = false;
  emptyEl.textContent = "Não foi possível iniciar o WebGL.";
}
</script>
</body>
</html>
`;
}

const groups = scanAnimals();
if (!groups.length) {
  console.error('Nenhuma animação encontrada em data/animals/.');
  process.exit(1);
}
const outFile = resolveOut(process.argv.slice(2));
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, buildHtml(groups, outFile));
const clips = groups.reduce((sum, group) => sum + group.clips.length, 0);
const frames = groups.reduce((sum, group) => sum + group.clips.reduce((n, clip) => n + clip.frames.length, 0), 0);
console.log(`Gerado ${path.relative(root, outFile)}: ${groups.length} espécies, ${clips} clipes, ${frames} quadros.`);
console.log(`Abra: http://127.0.0.1:8000/${path.relative(root, outFile).split(path.sep).join('/')}`);
console.log('O servidor é iniciado por você: python3 scripts/serve.py');
