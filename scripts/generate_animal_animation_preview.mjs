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

function parseUVs(text) {
  const uvs = [];
  const faceUVs = [];
  for (const line of text.split(/\\r?\\n/)) {
    const row = line.trim();
    if (!row || row.startsWith("#")) continue;
    const parts = row.split(/\\s+/);
    const tag = parts.shift();
    if (tag === "vt") uvs.push([Number(parts[0]) || 0, Number(parts[1]) || 0]);
    else if (tag === "f" && parts.length >= 3) {
      const idx = parts.map(part => {
        const vt = part.split("/")[1];
        return vt ? Math.max(0, Number(vt) - 1) : 0;
      });
      for (let i = 1; i < idx.length - 1; i++) faceUVs.push([idx[0], idx[i], idx[i + 1]]);
    }
  }
  const out = new Float32Array(faceUVs.length * 6);
  let offset = 0;
  for (const tri of faceUVs) for (const vi of tri) {
    const uv = uvs[vi] || [0, 0];
    out[offset++] = uv[0];
    out[offset++] = uv[1];
  }
  return out;
}

function parseOBJ(text) {
  const vertices = [];
  const normals = [];
  const triangles = [];
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
      const value = fields.slice(0, 3).map(Number);
      (tag === "v" ? vertices : normals).push(value);
    } else if (tag === "f") {
      const face = fields.map(part => {
        const bits = part.split("/");
        return {
          vertex: index(bits[0], vertices.length),
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
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let offset = 0;
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
      for (let axis = 0; axis < 3; axis++) {
        positions[offset + axis] = xyz[axis];
        normalData[offset + axis] = normal[axis];
        min[axis] = Math.min(min[axis], xyz[axis]);
        max[axis] = Math.max(max[axis], xyz[axis]);
      }
      offset += 3;
    }
  }
  return { positions, normals: normalData, uvs: parseUVs(text), bounds: { min, max } };
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

const materials = new Map();
function materialFor(species, color, textured) {
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

function fetchFrame(card, frame) {
  const key = frame;
  if (card.geometries.has(key)) return Promise.resolve(card.geometries.get(key));
  const url = new URL(card.species + "/" + card.clip + "/" + frame + ".obj", assetBase);
  const promise = fetch(url)
    .then(response => {
      if (!response.ok) throw Error("Falha em " + url.pathname + " (" + response.status + ")");
      return response.text();
    })
    .then(text => {
      const data = parseOBJ(text);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
      if (data.uvs.length === (data.positions.length / 3) * 2 && data.uvs.length) {
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
      }
      geometry.computeBoundingSphere();
      return { geometry, bounds: data.bounds, textured: geometry.hasAttribute("uv") };
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
  scene.add(mesh);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x40503f, 1.8));
  const key = new THREE.DirectionalLight(0xfff1d8, 2.8);
  key.position.set(2.5, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc4ff, .8);
  rim.position.set(-3, 1.5, -2);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, .35));

  const { min, max } = data.bounds;
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const center = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  const radius = Math.max(0.001, Math.hypot(size[0], size[1], size[2]) / 2);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(radius * .72, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .22, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(center.x, min[1] + radius * .002, center.z);
  shadow.scale.set(1, size[2] / Math.max(.001, size[0]), 1);
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
