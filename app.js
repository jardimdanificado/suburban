import { CitySimulationBridge } from './js/city_sim_bridge.js?v=mine-rack-social-1';
import { resolveWorldSettings } from './js/world_settings.js';
import { CitySimulation, BUILDING_TYPES } from "./js/city_simulation.js";
import { CityDesktop } from "./js/city_desktop.js";
import { World } from "./js/world.js";
import { RCT3DRenderer } from "./js/renderer_3d.js?v=clothes-laundry-1";
import { setActiveEntities } from "./js/engine.js";
import { ManagementCanvasUI } from "./js/management_ui.js";
import { MapEditor } from "./js/map_editor.js";
import { SimulationTime } from "./js/simulation_time.js";
import { OptionsPanel } from "./js/options.js?v=no-action-badges-1";

const root = document.querySelector("#experience");
const canvasUI = document.querySelector("#canvas-ui");
const container3D = document.querySelector("#container-3d");
const renderer3D = new RCT3DRenderer(container3D);
const worldSettings = resolveWorldSettings(new URLSearchParams(window.location.search));
const world = new World(worldSettings.presetId, worldSettings.seed, worldSettings.size);
world.preset = worldSettings.preset;
const entities = [];
const legacyUI = new ManagementCanvasUI(canvasUI);
export const time = new SimulationTime();
let optionStorage = null;
try { optionStorage = window.localStorage; } catch {}
export const options = new OptionsPanel({ renderer: renderer3D, time, step: stepSimulation, storage: optionStorage });
export const editor = new MapEditor({ world, entities, destroyEntity });
world.onTileChange = () => {
  renderer3D.terrainDirty = true;
  renderer3D.forceStaticInstanceUpdate();
};
let nextId = 1;
let simulationBridge = null;
let previousFrame = performance.now();
let lastRenderedAt = previousFrame;
let lastUiDrawnAt = previousFrame;
let lastUiPointerX = -1, lastUiPointerY = -1;
let rapidResolution = null;
// Opt-in diagnostics, readable without exposing mutable simulation objects to the browser.
const profiling = new URLSearchParams(window.location.search).has('profile');
const frameMetrics = { started: performance.now(), count: 0, simulation: 0, index: 0, scene: 0, ui: 0, cpu: 0, max: 0, terrain:0, city:0, renderEntities:0, entityLoop:0, entityRest:0, citizenClass:0, citizenSurface:0, citizenBody:0, webgl:0 };
const performanceOutput=profiling?document.createElement('output'):null;
if(performanceOutput){performanceOutput.id='performance-stats';Object.assign(performanceOutput.style,{position:'absolute',bottom:'30px',right:'8px',maxWidth:'560px',padding:'8px',font:'12px monospace',color:'#fff',background:'#17221de6',zIndex:'9999',pointerEvents:'none',whiteSpace:'pre-wrap'});root.append(performanceOutput);}


let selected = null;
const renderMode = "3d";
let dragging = false;
let pointerDown = null;
let rightClickConsumed = false;
let lastPointer = null;
const touchPointers = new Map();
let pinchGesture = null;
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
  if (simulationBridge?.active && entity) { simulationBridge.command('destroy', [entity]); return; }
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
  cityUI.draw(ui);
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
  get renderer() { return renderer3D; },
};

function togglePause() {
  time.setPaused(!time.paused);
}

function advanceSimulation(dt) {
  update(dt, api);
}

function stepSimulation() {
  if (simulationBridge?.active) return simulationBridge.step();
  return time.step(advanceSimulation);
}

function toggleOptions() {
  cityUI.toggleTool('options',options);
  editor.endStroke();
  editingGesture = dragging = false;
  pointerDown = lastPointer = null;
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = root.clientWidth || window.innerWidth;
  const cssHeight = root.clientHeight || window.innerHeight;
  if (lastSize.width === cssWidth && lastSize.height === cssHeight && lastSize.dpr === dpr) return;
  lastSize = { width: cssWidth, height: cssHeight, dpr };
  legacyUI.resize();
  renderer3D.resize(cssWidth, cssHeight);
}

function mapTileAt(x, y) { return renderer3D.getTileAtScreen(x, y, world); }

function midpoint(a,b){return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
function pointerDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function moveCameraByPointer(dx,dy,zoom){
  const factor=56/(zoom*Math.max(100,root.clientHeight));
  renderer3D.setCamera(renderer3D.getCameraX()-(dx*.70710678+dy*1.22474487)*factor,renderer3D.getCameraY()-(-dx*.70710678+dy*1.22474487)*factor,zoom);
}

function onPointerDown(event) {
  if(event.button===2){
    rightClickConsumed=false;const rect=root.getBoundingClientRect();
    if(cityUI.rightClick(event.clientX-rect.left,event.clientY-rect.top)){event.preventDefault();rightClickConsumed=true;cityUI.pointerUp();dragging=editingGesture=pointerOnUI=false;pointerDown=lastPointer=null;return;}
  }
  if (event.target.closest(".ui-toolbar, .ui-panel")) return;
  const rect = root.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  pointerOnUI = !!legacyUI.hitTest(x, y);
  root.setPointerCapture?.(event.pointerId);
  if(event.pointerType==='touch'&&!pointerOnUI){
    touchPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(touchPointers.size>=2){
      const [a,b]=[...touchPointers.values()],renderer=renderer3D;
      pinchGesture={distance:Math.max(1,pointerDistance(a,b)),center:midpoint(a,b),zoom:renderer.getCameraZoom()};
      dragging=false;editingGesture=false;pointerOnUI=false;pointerDown=lastPointer=null;
      event.preventDefault();return;
    }
  }
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
  if(event.pointerType==='touch'&&touchPointers.has(event.pointerId)){
    touchPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pinchGesture&&touchPointers.size>=2){
      const [a,b]=[...touchPointers.values()],center=midpoint(a,b),distance=pointerDistance(a,b),renderer=renderer3D;
      const previousZoom=renderer.getCameraZoom(),zoom=previousZoom*distance/Math.max(1,pinchGesture.distance);
      moveCameraByPointer(center.x-pinchGesture.center.x,center.y-pinchGesture.center.y,zoom);
      pinchGesture={distance:Math.max(1,distance),center,zoom:renderer.getCameraZoom()};
      event.preventDefault();return;
    }
  }
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
  moveCameraByPointer(dx,dy,renderer3D.getCameraZoom());
  lastPointer = { x: event.clientX, y: event.clientY };
}

function onPointerUp(event) {
  if(event.pointerType==='touch'&&touchPointers.has(event.pointerId)){
    touchPointers.delete(event.pointerId);
    if(pinchGesture){
      pinchGesture=null;pointerDown=null;pointerOnUI=false;editingGesture=false;
      if(touchPointers.size){dragging=true;lastPointer={...touchPointers.values().next().value};}
      else{dragging=false;lastPointer=null;}
      cityUI.pointerUp();event.preventDefault();return;
    }
  }
  if(event.button===2&&rightClickConsumed){rightClickConsumed=false;event.preventDefault();return;}
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
    const id = renderer3D.selectAt(event.clientX, event.clientY, entities, world);
    selectEntity(entities.find((entity) => entity.id === id) || null, renderer3D.selectedCityUnitId);
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
  rightClickConsumed=false;
  cityUI.pointerUp();
  editor.endStroke();
  editingGesture = dragging = pointerOnUI = false;
  touchPointers.clear();pinchGesture=null;
  pointerDown = lastPointer = null;
});
root.addEventListener("contextmenu", (event) => event.preventDefault());
root.addEventListener("wheel", (event) => {
  if (event.target.closest(".ui-panel")) return;
  const rect = root.getBoundingClientRect();
  if(cityUI.scrollAt(event.clientX-rect.left,event.clientY-rect.top,event.deltaY)){event.preventDefault();return;}
  if (legacyUI.hitTest(event.clientX - rect.left, event.clientY - rect.top)) return;
  event.preventDefault();
  const renderer = renderer3D;
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
  const frameStarted = profiling ? performance.now() : 0;
  resize();
  const dt = Math.min((now - previousFrame) / 1000, 0.25);
  previousFrame = now;
  if (simulationBridge?.active) { simulationBridge.control(); simulationBridge.interpolate(now); }
  else time.advance(dt, advanceSimulation);
  const rapidMode=simulationBridge?.active&&time.speed>=16&&city.citizens.length>=512;
  renderer3D.rapidCityMode=rapidMode;
  if(rapidMode&&now-lastRenderedAt<40){requestAnimationFrame(frame);return;}
  if(renderMode==='3d'){
    if(rapidMode&&rapidResolution===null){rapidResolution=renderer3D.resolutionScale;if(rapidResolution>.25)renderer3D.setResolutionScale(.25);}
    else if(!rapidMode&&rapidResolution!==null){renderer3D.setResolutionScale(rapidResolution);rapidResolution=null;}
  }
  if(renderer3D.renderer.shadowMap.enabled===rapidMode&&renderer3D.shadowsEnabled){
    renderer3D.renderer.shadowMap.enabled=!rapidMode;
    renderer3D.renderer.shadowMap.needsUpdate=true;
  }
  const renderDt=Math.min((now-lastRenderedAt)/1000,.25);lastRenderedAt=now;
  const paused = time.paused;
  renderer3D.setPaused(paused);
  renderer3D.simTick = time.tick;
  const simulationEnded = profiling ? performance.now() : 0;
  setActiveEntities(entities);
  const indexEnded = profiling ? performance.now() : 0;
  renderer3D.selectedCityUnitId = selected?.properties.cityBuilding ? cityUI.unitId : null;
  renderer3D.cityDevelopment=city.development;
  renderer3D.profileFrame=profiling;renderer3D.render(world, entities, time.elapsed, renderDt, paused ? 0 : time.speed);
  const sceneEnded = profiling ? performance.now() : 0;
  const pointerX = mousePosition.x;
  const pointerY = mousePosition.y;
  const drawInterface=!rapidMode||now-lastUiDrawnAt>=125||pointerX!==lastUiPointerX||pointerY!==lastUiPointerY||cityUI.manager.gesture||cityUI.scrollGesture;
  if(drawInterface){
  lastUiDrawnAt=now;lastUiPointerX=pointerX;lastUiPointerY=pointerY;
  legacyUI.beginFrame(pointerX, pointerY);
  const clockText = `D${String(world.clock.day).padStart(2, "0")} ${String(world.clock.hour).padStart(2, "0")}:${String(world.clock.minute).padStart(2, "0")}`;
  cityUI.drawChrome(legacyUI,{clockText,paused,speed:time.speed,renderMode});
  const hoverTile = editor.open && mousePosition.x >= 0 ? mapTileAt(mousePosition.x, mousePosition.y) : null;

  if (!legacyUI.hitTest(mousePosition.x, mousePosition.y)) {
    legacyUI.ctx.save();legacyUI.ctx.beginPath();legacyUI.ctx.rect(0,cityUI.manager.top,legacyUI.width,Math.max(0,legacyUI.height-cityUI.manager.top-27));legacyUI.ctx.clip();
    editor.drawPreview(legacyUI, hoverTile, (x, y) => {
      const elevation = renderer3D.getSurfaceElevation(world.map, x, y);
      return renderer3D.projectWorldToScreen(x, y, elevation + 0.05);
    });
    legacyUI.ctx.restore();
  }
  renderUI(legacyUI, api);

  cityUI.element.hidden = !cityUI.visible;
  }
  if (profiling) {
    const ended=performance.now(),cpu=ended-frameStarted;
    frameMetrics.count++;frameMetrics.simulation+=simulationEnded-frameStarted;frameMetrics.index+=indexEnded-simulationEnded;
    frameMetrics.scene+=sceneEnded-indexEnded;frameMetrics.ui+=ended-sceneEnded;frameMetrics.cpu+=cpu;frameMetrics.max=Math.max(frameMetrics.max,cpu);
    if(renderMode==='3d'&&renderer3D.frameProfile){frameMetrics.terrain+=renderer3D.frameProfile.terrain;frameMetrics.city+=renderer3D.frameProfile.city;frameMetrics.renderEntities+=renderer3D.frameProfile.entities;frameMetrics.entityLoop+=renderer3D.frameProfile.entityLoop;frameMetrics.entityRest+=renderer3D.frameProfile.entityRest;frameMetrics.citizenClass+=renderer3D.frameProfile.citizenClass;frameMetrics.citizenSurface+=renderer3D.frameProfile.citizenSurface;frameMetrics.citizenBody+=renderer3D.frameProfile.citizenBody;frameMetrics.webgl+=renderer3D.frameProfile.webgl;}
    if(ended-frameMetrics.started>=1000){
      const count=frameMetrics.count;
      root.dataset.performance=JSON.stringify({fps:count*1000/(ended-frameMetrics.started),cpuMs:frameMetrics.cpu/count,maxCpuMs:frameMetrics.max,simulationMs:frameMetrics.simulation/count,indexMs:frameMetrics.index/count,sceneMs:frameMetrics.scene/count,uiMs:frameMetrics.ui/count,sceneParts:{terrainMs:frameMetrics.terrain/count,cityMs:frameMetrics.city/count,entitiesMs:frameMetrics.renderEntities/count,entityLoopMs:frameMetrics.entityLoop/count,entityRestMs:frameMetrics.entityRest/count,citizenClassMs:frameMetrics.citizenClass/count,citizenSurfaceMs:frameMetrics.citizenSurface/count,citizenBodyMs:frameMetrics.citizenBody/count,webglMs:frameMetrics.webgl/count},worker:simulationBridge?.metrics,citizenBatches:renderer3D.cityCitizenBatches?.batches.size,batchedCitizens:[...(renderer3D.cityCitizenBatches?.batches.values()||[])].reduce((sum,b)=>sum+b.count,0),drawCalls:renderer3D.renderer.info.render.calls,triangles:renderer3D.renderer.info.render.triangles,geometries:renderer3D.renderer.info.memory.geometries,entities:entities.length,minute:city.minute});
      performanceOutput.textContent=root.dataset.performance;
      Object.assign(frameMetrics,{started:ended,count:0,simulation:0,index:0,scene:0,ui:0,cpu:0,max:0,terrain:0,city:0,renderEntities:0,entityLoop:0,entityRest:0,citizenClass:0,citizenSurface:0,citizenBody:0,webgl:0});
    }
  }
  requestAnimationFrame(frame);
}

{
  const { x, y } = world.spawnCenter;
  renderer3D.setCamera(x, y, 1.2);
  resize();
  previousFrame = performance.now();
  lastRenderedAt = previousFrame;
  requestAnimationFrame(frame);
}

function selectEntity(entity, unitId = null) {
  selected = entity;
  renderer3D.selectEntity(entity?.id ?? -1);
  cityUI.setSelection(entity, unitId);
  window.dispatchEvent(new CustomEvent("experience:select", { detail: selected }));
}

export const city = new CitySimulation({ world, createEntity, population: worldSettings.population });
let cityGenerationError = null;
try { city.initialize(); } catch (error) {
  cityGenerationError = error.message;
  city.log(error.message, 'city', [], { kind: 'generation-failed' });
  city.syncClock();
}
export const cityUI = new CityDesktop({ city, root, select: selectEntity, controls: {
  pause:togglePause, speed:()=>time.setSpeed(time.speed===32?0.5:time.speed*2), options:toggleOptions, editor:()=>cityUI.toggleTool("editor",editor),
  center:()=>{renderer3D.setCamera(world.spawnCenter.x,world.spawnCenter.y);},
}, camera(x, y) {
  renderer3D.setCamera(x, y);
} });
if (cityGenerationError) cityUI.notice = cityGenerationError;
for (const [type, spec] of Object.entries(BUILDING_TYPES)) {
  editor.registerPrefab(type, { label: spec.label, create: (x, y) => city.addBuilding(type, x, y)?.entity });
}

// Background simulation starts after UI/editor bindings exist. Commands are serialized by the worker.
simulationBridge = new CitySimulationBridge({ city, entities, nextId, time,
  noticeTarget: () => cityUI.active,
  notice: (message,target) => { if(target)target.notice=message;else cityUI.notice=message; },
  changed: ({ terrain, entities: changedEntities }) => {
    nextId = simulationBridge.state.nextId;
    if (terrain) world.onTileChange?.();
    if (changedEntities) renderer3D.forceStaticInstanceUpdate();
    if (selected?.destroyed) selectEntity(null);
  },
});
