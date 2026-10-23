import { resolveWorldSettings } from './js/world_settings.js';
import { CitySimulation, BUILDING_TYPES } from "./js/city_simulation.js";
import { CityDesktop } from "./js/city_desktop.js";
import { World } from "./js/world.js";
import { Renderer } from "./js/renderer.js";
import { RCT3DRenderer } from "./js/renderer_3d.js";
import { setActiveEntities } from "./js/engine.js";
import { ManagementCanvasUI } from "./js/management_ui.js";
import { MapEditor } from "./js/map_editor.js";
import { SimulationTime } from "./js/simulation_time.js";
import { OptionsPanel } from "./js/options.js";

const root = document.querySelector("#experience");
const canvas2D = document.querySelector("#canvas-2d");
const canvasUI = document.querySelector("#canvas-ui");
const container3D = document.querySelector("#container-3d");
const renderer2D = new Renderer(canvas2D);
const renderer3D = new RCT3DRenderer(container3D);
const worldSettings = resolveWorldSettings(new URLSearchParams(window.location.search));
const world = new World(worldSettings.presetId, worldSettings.seed);
world.preset = worldSettings.preset;
const entities = [];
const legacyUI = new ManagementCanvasUI(canvasUI);
export const time = new SimulationTime();
let optionStorage = null;
try { optionStorage = window.localStorage; } catch {}
export const options = new OptionsPanel({ renderer: renderer3D, time, step: stepSimulation, storage: optionStorage });
export const editor = new MapEditor({ world, entities, destroyEntity });
world.onTileChange = () => {
  renderer3D.lastBuiltCamTileX = -9999;
  renderer3D.forceStaticInstanceUpdate();
};
let nextId = 1;
let previousFrame = performance.now();
let selected = null;
let renderMode = "3d";
let dragging = false;
let pointerDown = null;
let lastPointer = null;
let mousePosition = { x: -1, y: -1 };
let pointerOnUI = false;
let editingGesture = false;
let lastSize = { width: 0, height: 0, dpr: 0 };

export function createEntity({ x = 0, y = 0, properties = {}, ...data }) {
  const entity = { id: nextId++, x, y, destroyed: false, ...data, properties };
  entities.push(entity);
  renderer3D.forceStaticInstanceUpdate();
  return entity;
}

export function destroyEntity(entity) {
  if (entity) {
    entity.destroyed = true;
    if (selected === entity) selected = null;
    renderer3D.forceStaticInstanceUpdate();
  }
}

/** Define the rules and state transitions for this experience. */
export function update(dt, _api) { city.update(dt); }

/** Draw additional experience-specific UI after the framework HUD. */
export function renderUI(ui, _api) {
  drawCitySites(ui);
  for (const c of city.citizens) {
    if (!c.conversation || c.conversation.a !== c.id) continue;
    const other = city.society.citizen(c.conversation.b);
    if (!other) continue;
    const x = (c.entity.x + other.entity.x) / 2, y = (c.entity.y + other.entity.y) / 2;
    let point;
    if (renderMode === '3d') point = renderer3D.projectWorldToScreen(x, y, renderer3D.getSurfaceElevation(world.map, x, y) + 1.1);
    else {
      const size = 16 * renderer2D.getCameraZoom() / (canvas2D.width / root.clientWidth);
      point = { x: root.clientWidth / 2 + (x - renderer2D.getCameraX()) * size, y: root.clientHeight / 2 + (y - renderer2D.getCameraY()) * size - 16 };
    }
    if (!point || point.x < 0 || point.x > ui.width || point.y < 38 || point.y > ui.height - 60) continue;
    ui.ctx.save(); ui.ctx.fillStyle = '#192b24'; ui.ctx.strokeStyle = '#d4b6cd'; ui.ctx.lineWidth = 1;
    ui.ctx.fillRect(point.x - 12, point.y - 9, 25, 16); ui.ctx.strokeRect(point.x - 12, point.y - 9, 25, 16);
    ui.ctx.fillStyle = '#e6d8c2';
    for (let i = 0; i < 3; i++) ui.ctx.fillRect(point.x - 7 + i * 6, point.y - 2, 3, 3);
    ui.ctx.restore();
  }
  cityUI.draw(ui);
}

function cityPoint(x, y, lift = .1) {
  if (renderMode === '3d') return renderer3D.projectWorldToScreen(x, y, renderer3D.getSurfaceElevation(world.map, x, y) + lift);
  const size = 16 * renderer2D.getCameraZoom() / (canvas2D.width / root.clientWidth);
  return { x: root.clientWidth / 2 + (x - renderer2D.getCameraX()) * size, y: root.clientHeight / 2 + (y - renderer2D.getCameraY()) * size };
}
function drawCitySites(ui) {
  const ctx = ui.ctx; ctx.save();
  for (const p of city.development.plots) {
    if (p.buildingId || (cityUI.tab !== 'land' && cityUI.selectedPlotId !== p.id && !p.projectId)) continue;
    const corners = [[p.x, p.y], [p.x + p.width, p.y], [p.x + p.width, p.y + p.depth], [p.x, p.y + p.depth]].map(([x, y]) => cityPoint(x, y));
    if (corners.some(q => !q)) continue;
    ctx.strokeStyle = p.projectId ? '#f8b800' : p.ownerId === 'treasury' ? '#bcbcbc' : '#40c8f8'; ctx.lineWidth = cityUI.selectedPlotId === p.id ? 3 : 1;
    ctx.setLineDash(p.projectId ? [] : [4, 4]); ctx.beginPath(); corners.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.stroke();
    const point = cityPoint(p.x + p.width / 2, p.y + p.depth / 2);
    if (point) ui.text(`${p.projectId ? 'OBRA' : 'LOTE'} ${p.id}`, point.x - 24, point.y, p.projectId ? '#f8b800' : '#ffffff');
  }
  for (const project of city.development.projects) {
    if (project.service !== 'road' || project.status === 'completed' || project.cancelled) continue;
    const entity = selected && !selected.destroyed ? selected : null;
    const building = entity?.properties.cityBuilding, citizen = entity?.properties.citizen;
    const selectedContract = cityUI.visible && cityUI.active?.selectedProjectId === project.id;
    const selectedBuilder = building?.type === 'builder' && project.builderId === building.id;
    const selectedWorker = citizen?.task === 'construction' && citizen.workProjectId === project.id;
    if (!selectedContract && !selectedBuilder && !selectedWorker) continue;
    ctx.strokeStyle = '#f8b800'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath();
    project.route.forEach((p, i) => { const point = cityPoint(p.x, p.y); if (point) i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y); }); ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const s of city.logistics.shipments) {
    if (['delivered', 'cancelled'].includes(s.status)) continue;
    const courier = city.society.citizen(s.driverId), pos = s.pickedUp && courier ? courier.entity : s.position;
    const point = cityPoint(pos.x, pos.y, .8); if (!point) continue;
    ctx.fillStyle = s.good === 'pedra' ? '#bcbcbc' : '#f8b800'; ctx.fillRect(point.x - 4, point.y - 7, 8, 8); ctx.strokeStyle = '#000000'; ctx.strokeRect(point.x - 4, point.y - 7, 8, 8);
  }
  ctx.restore();
}

const api = {
  world,
  entities,
  ui: legacyUI,
  editor,
  time,
  options,
  step: stepSimulation,
  createEntity,
  destroyEntity,
  get selectedEntity() { return selected; },
  get renderer() { return renderMode === "3d" ? renderer3D : renderer2D; },
};

function togglePause() {
  time.setPaused(!time.paused);
}

function advanceSimulation(dt) {
  update(dt, api);
}

function stepSimulation() {
  return time.step(advanceSimulation);
}

function toggleOptions() {
  cityUI.toggleTool('options',options);
  editor.endStroke();
  editingGesture = dragging = false;
  pointerDown = lastPointer = null;
}

function setRenderMode(mode) {
  renderMode = mode;
  const is3D = mode === "3d";
  container3D.hidden = !is3D;
  canvas2D.hidden = is3D;
  resize();
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = root.clientWidth || window.innerWidth;
  const cssHeight = root.clientHeight || window.innerHeight;
  const width = Math.max(1, Math.floor(cssWidth * dpr));
  const height = Math.max(1, Math.floor(cssHeight * dpr));
  if (lastSize.width === cssWidth && lastSize.height === cssHeight && lastSize.dpr === dpr) return;
  lastSize = { width: cssWidth, height: cssHeight, dpr };
  if (canvas2D.width !== width || canvas2D.height !== height) {
    canvas2D.width = width;
    canvas2D.height = height;
  }
  legacyUI.resize();
  renderer3D.resize(cssWidth, cssHeight);
}

function mapTileAt(x, y) {
  if (renderMode === "3d") return renderer3D.getTileAtScreen(x, y, world);
  const ratio = canvas2D.width / root.clientWidth;
  const tileSize = 16 * renderer2D.getCameraZoom() / ratio;
  return {
    x: Math.floor(renderer2D.getCameraX() + (x - root.clientWidth / 2) / tileSize),
    y: Math.floor(renderer2D.getCameraY() + (y - root.clientHeight / 2) / tileSize),
  };
}

function onPointerDown(event) {
  if (event.target.closest(".ui-toolbar, .ui-panel")) return;
  const rect = root.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  pointerOnUI = !!legacyUI.hitTest(x, y);
  root.setPointerCapture?.(event.pointerId);
  pointerDown = { x: event.clientX, y: event.clientY };
  lastPointer = pointerDown;
  if (cityUI.pointerDown(x,y)) { pointerOnUI=true; return; }
  if (pointerOnUI) return;
  if (event.button === 0 && editor.open) {
    editingGesture = true;
    editor.beginStroke(mapTileAt(x, y));
    return;
  }
  dragging = true;
}

function onPointerMove(event) {
  const rect = root.getBoundingClientRect();
  mousePosition = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  if (cityUI.pointerMove(mousePosition.x,mousePosition.y)) return;
  if (editingGesture) {
    if (legacyUI.hitTest(mousePosition.x, mousePosition.y)) editor.lastTile = null;
    else editor.continueStroke(mapTileAt(mousePosition.x, mousePosition.y));
    return;
  }
  if (pointerOnUI && lastPointer) {
    if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) >= 6) {
      cityUI.scrollAt(pointerDown.x - rect.left, pointerDown.y - rect.top, lastPointer.y - event.clientY);
    }
    lastPointer = { x: event.clientX, y: event.clientY };
    return;
  }
  if (!dragging || !lastPointer) return;
  const dx = event.clientX - lastPointer.x;
  const dy = event.clientY - lastPointer.y;
  const zoom = renderMode === "3d" ? renderer3D.getCameraZoom() : renderer2D.getCameraZoom();
  const camera = renderMode === "3d" ? renderer3D : renderer2D;
  if (renderMode === "3d") {
    const factor = 56 / (zoom * Math.max(100, root.clientHeight));
    camera.setCamera(camera.getCameraX() - (dx * 0.70710678 + dy * 1.22474487) * factor,
      camera.getCameraY() - (-dx * 0.70710678 + dy * 1.22474487) * factor);
  } else {
    const factor = (canvas2D.width / root.clientWidth) / (16 * zoom);
    camera.setCamera(camera.getCameraX() - dx * factor, camera.getCameraY() - dy * factor);
  }
  lastPointer = { x: event.clientX, y: event.clientY };
}

function onPointerUp(event) {
  if (event.target.closest(".ui-panel")) return;
  const rect = root.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (cityUI.pointerUp()) {
    dragging=editingGesture=pointerOnUI=false;pointerDown=lastPointer=null;return;
  }
  if (editingGesture) {
    editor.endStroke();
  } else if (pointerOnUI && pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) < 6) {
    if (event.button === 0) legacyUI.clickAt(x, y);
  } else if (event.button === 0 && pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) < 4) {
    const id = renderMode === "3d"
      ? renderer3D.selectAt(event.clientX, event.clientY, entities, world)
      : renderer2D.selectAt((event.clientX - rect.left) * canvas2D.width / rect.width, (event.clientY - rect.top) * canvas2D.height / rect.height, entities);
    selectEntity(entities.find((entity) => entity.id === id) || null, renderMode === "3d" ? renderer3D.selectedCityUnitId : null);
    if (id == null || id === -1) {
      const tile = mapTileAt(x, y), lot = tile && city.development.plots.find(p => !p.buildingId && tile.x >= p.x && tile.x < p.x + p.width && tile.y >= p.y && tile.y < p.y + p.depth);
      if (lot) cityUI.setPlotSelection(lot.id);
    }
  }
  dragging = false;
  editingGesture = false;
  pointerOnUI = false;
  pointerDown = null;
  lastPointer = null;
}

root.addEventListener("pointerdown", onPointerDown);
root.addEventListener("pointermove", onPointerMove);
root.addEventListener("pointerup", onPointerUp);
root.addEventListener("dblclick",event=>{const rect=root.getBoundingClientRect();if(cityUI.doubleClick(event.clientX-rect.left,event.clientY-rect.top))event.preventDefault();});
root.addEventListener("pointercancel", () => {
  cityUI.pointerUp();
  editor.endStroke();
  editingGesture = dragging = pointerOnUI = false;
  pointerDown = lastPointer = null;
});
root.addEventListener("contextmenu", (event) => event.preventDefault());
root.addEventListener("wheel", (event) => {
  if (event.target.closest(".ui-panel")) return;
  const rect = root.getBoundingClientRect();
  if(cityUI.scrollAt(event.clientX-rect.left,event.clientY-rect.top,event.deltaY)){event.preventDefault();return;}
  if (legacyUI.hitTest(event.clientX - rect.left, event.clientY - rect.top)) return;
  event.preventDefault();
  const renderer = renderMode === "3d" ? renderer3D : renderer2D;
  const zoom = renderer.getCameraZoom() * (event.deltaY < 0 ? 1.12 : 0.89);
  renderer.setCamera(renderer.getCameraX(), renderer.getCameraY(), zoom);
}, { passive: false });

window.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName) || event.target?.isContentEditable) return;
  if (cityUI.key(event)) { event.preventDefault(); return; }
  if (event.code === "Space" && !event.repeat) {
    event.preventDefault();
    togglePause();
  }
  if (event.code === "F3") { event.preventDefault(); setRenderMode(renderMode === "3d" ? "2d" : "3d"); }
  if (event.code === "KeyO" && !event.repeat) toggleOptions();
  if(event.code==="KeyS"&&!event.repeat)cityUI.toggleTool("editor",editor);
  if (event.code === "Escape") {
    if (options.open) options.toggle();
    else if (editor.open) editor.toggle();
  }
  if (["Minus", "NumpadSubtract"].includes(event.code)) { event.preventDefault(); time.changeSpeed(-1); }
  if (["Equal", "NumpadAdd"].includes(event.code)) { event.preventDefault(); time.changeSpeed(1); }
  if (event.code === "Period" && !event.repeat) stepSimulation();
});
window.addEventListener("resize", resize);

function frame(now) {
  resize();
  const dt = Math.min((now - previousFrame) / 1000, 0.25);
  previousFrame = now;
  time.advance(dt, advanceSimulation);
  const paused = time.paused;
  renderer3D.setPaused(paused);
  renderer2D.setPaused(paused);
  renderer3D.simTick = time.tick;
  setActiveEntities(entities);
  renderer3D.selectedCityUnitId = selected?.properties.cityBuilding ? cityUI.unitId : null;
  if (renderMode === "3d") renderer3D.render(world, entities, time.elapsed, dt, paused ? 0 : time.speed);
  else renderer2D.render(world, entities, time.elapsed, dt, paused ? 0 : time.speed);
  const pointerX = mousePosition.x;
  const pointerY = mousePosition.y;
  legacyUI.beginFrame(pointerX, pointerY);
  const clockText = `D${String(world.clock.day).padStart(2, "0")} ${String(world.clock.hour).padStart(2, "0")}:${String(world.clock.minute).padStart(2, "0")}`;
  cityUI.drawChrome(legacyUI,{clockText,paused,speed:time.speed,renderMode});
  const hoverTile = editor.open && mousePosition.x >= 0 ? mapTileAt(mousePosition.x, mousePosition.y) : null;

  if (!legacyUI.hitTest(mousePosition.x, mousePosition.y)) {
    editor.drawPreview(legacyUI, hoverTile, (x, y) => {
      if (renderMode === "3d") {
        const elevation = renderer3D.getSurfaceElevation(world.map, x, y);
        return renderer3D.projectWorldToScreen(x, y, elevation + 0.05);
      }
      const size = 16 * renderer2D.getCameraZoom() / (canvas2D.width / root.clientWidth);
      return { x: root.clientWidth / 2 + (x - renderer2D.getCameraX()) * size,
        y: root.clientHeight / 2 + (y - renderer2D.getCameraY()) * size };
    });
  }
  renderUI(legacyUI, api);

  cityUI.element.hidden = !cityUI.visible;
  requestAnimationFrame(frame);
}

renderer2D.initPromise.then(() => {
  const { x, y } = world.spawnCenter;
  renderer2D.setCamera(x, y, 1.4);
  renderer3D.setCamera(x, y, 1.2);
  resize();
  previousFrame = performance.now();
  requestAnimationFrame(frame);
});

function selectEntity(entity, unitId = null) {
  selected = entity;
  renderer2D.selectEntity(entity?.id ?? -1);
  renderer3D.selectEntity(entity?.id ?? -1);
  cityUI.setSelection(entity, unitId);
  window.dispatchEvent(new CustomEvent("experience:select", { detail: selected }));
}

export const city = new CitySimulation({ world, createEntity });
let cityGenerationError = null;
try { city.initialize(); } catch (error) {
  cityGenerationError = error.message;
  city.log(error.message, 'city', [], { kind: 'generation-failed' });
  city.syncClock();
}
export const cityUI = new CityDesktop({ city, root, select: selectEntity, controls: {
  pause:togglePause, speed:()=>time.setSpeed(time.speed===32?0.5:time.speed*2), options:toggleOptions, editor:()=>cityUI.toggleTool("editor",editor), render:setRenderMode,
  center:()=>{renderer3D.setCamera(world.spawnCenter.x,world.spawnCenter.y);renderer2D.setCamera(world.spawnCenter.x,world.spawnCenter.y);},
}, camera(x, y) {
  renderer2D.setCamera(x, y); renderer3D.setCamera(x, y);
} });
if (cityGenerationError) cityUI.notice = cityGenerationError;
for (const [type, spec] of Object.entries(BUILDING_TYPES)) {
  editor.registerPrefab(type, { label: spec.label, create: (x, y) => city.addBuilding(type, x, y)?.entity });
}
