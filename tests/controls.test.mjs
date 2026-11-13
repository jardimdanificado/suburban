import test from "node:test";
import assert from "node:assert/strict";
import { SimulationTime, SPEED_TIERS, FF_SPEED, FF2_SPEED, FF3_SPEED, FF4_SPEED } from "../js/simulation_time.js";
import { OptionsPanel } from "../js/options.js";
import { LegacyCanvasUI } from "../js/legacy_ui.js";
import { WorldClock } from "../js/world.js";

test("all speed tiers advance the world clock and experience with fixed steps", () => {
  for (const speed of SPEED_TIERS) {
    const time = new SimulationTime({now:()=>0});
    const clock = new WorldClock();
    time.setSpeed(speed);
    let calls = 0;
    for (let frame = 0; frame < 60; frame++) time.advance(1 / 60, dt => {
      assert.equal(dt, speed >= FF4_SPEED ? 1 : speed >= FF3_SPEED ? .75 : speed >= FF2_SPEED ? .5 : speed === FF_SPEED ? .25 : 1 / 60);
      calls++;
      clock.tick(dt);
    });
    assert.equal(calls, speed >= 64 ? 256 : 60 * speed);
    assert.equal(time.tick, calls);
    assert(Math.abs(time.elapsed - speed) < 1e-8);
    assert(Math.abs(clock.hour*60 + clock.minute + clock.minuteTimer - speed) < 1e-8);
  }
});

test("simulation produces the same steps at different rendering frame rates", () => {
  const run = fps => {
    const time = new SimulationTime({now:()=>0});
    time.setSpeed(16);
    for (let i = 0; i < fps; i++) time.advance(1 / fps, () => {});
    return time.tick;
  };
  assert.equal(run(30), 960);
  assert.equal(run(144), 960);
});

test('local fallback yields after its CPU budget and bounds catch-up work',()=>{
  let now=0,calls=0;const time=new SimulationTime({now:()=>now});time.setSpeed(32);
  const steps=time.advance(.25,()=>{now+=4;calls++;});
  assert.equal(steps,2);assert.equal(calls,2);assert(time.accumulator<=time.stepSeconds*2);
});

test("pause discards partial steps and suspended-tab time is bounded", () => {
  const time = new SimulationTime({now:()=>0});
  time.advance(1 / 120, () => assert.fail("partial step must wait"));
  time.setPaused(true);
  assert.equal(time.advance(200, () => assert.fail("paused update")), 0);
  time.setPaused(false);
  assert.equal(time.advance(1 / 120, () => assert.fail("pause must clear backlog")), 0);
  assert.equal(time.advance(200, () => {}), 15);
});

test("single-step requires pause and is independent of the selected speed", () => {
  const time = new SimulationTime({now:()=>0});
  time.setSpeed(32);
  assert.equal(time.step(() => assert.fail("running step")), false);
  time.setPaused(true);
  let dt = 0;
  assert.equal(time.step(value => { dt = value; }), true);
  assert.equal(time.tick, 1);
  assert.equal(dt, 1 / 60);
  assert.equal(time.paused, true);
  time.changeSpeed(1);
  assert.equal(time.speed, 64);
  for (let i = 0; i < 20; i++) time.changeSpeed(-1);
  assert.equal(time.speed, SPEED_TIERS[0]);
  assert.throws(() => time.setSpeed(Infinity), RangeError);
});

function rendererMock() {
  return {
    shadowsEnabled: true, wireframeMode: 0, graphicOptions: {},
    setResolutionScale(value) { this.scaleFactor = value; },
    toggleShadows() { this.shadowsEnabled = !this.shadowsEnabled; },
    setShadowQuality(value) { this.shadowQuality = value; },
    toggleWireframe() { this.wireframeMode = (this.wireframeMode + 1) % 3; },
    setGraphicOptions(value) { Object.assign(this.graphicOptions, value); },
  };
}

test("graphics options apply renderer hooks and persist validated preferences", () => {
  let saved = '{"resolution":1,"shadows":false}';
  const storage = { getItem() { return saved; }, setItem(_key, value) { saved = value; } };
  const renderer = rendererMock();
  const panel = new OptionsPanel({ renderer, time: new SimulationTime({now:()=>0}), step() {}, storage });
  assert.equal(renderer.scaleFactor, 1);
  assert.equal(renderer.shadowsEnabled, false);
  panel.apply("wireframe", 2);
  assert.equal(renderer.wireframeMode, 2);
  panel.apply("brightness", 1.25);
  assert.equal(renderer.graphicOptions.brightness, 1.25);
  assert.equal(JSON.parse(saved).brightness, 1.25);
  assert.equal(panel.apply("resolution", 900), false);
  assert.equal(panel.apply("unknown", true), false);
});

test("unavailable browser storage does not break settings", () => {
  const storage = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } };
  const panel = new OptionsPanel({ renderer: rendererMock(), time: new SimulationTime({now:()=>0}), step() {}, storage });
  assert.doesNotThrow(() => panel.apply("shadows", false));
});

function canvasUI(width = 320, height = 400) {
  const context = new Proxy({}, { get(target, key) { return target[key] ?? (() => {}); } });
  globalThis.window = { innerWidth: width, innerHeight: height, devicePixelRatio: 1 };
  globalThis.document = { createElement() { return { getContext() { return context; } }; } };
  return new LegacyCanvasUI({ clientWidth: width, clientHeight: height, width: 0, height: 0, getContext() { return context; } });
}

test("options canvas buttons change settings and time, with clipped scrolling", () => {
  const ui = canvasUI();
  const time = new SimulationTime({now:()=>0});
  const renderer = rendererMock();
  const panel = new OptionsPanel({ renderer, time, step: () => time.step(() => {}) });
  panel.open = true;
  ui.beginFrame(); panel.draw(ui);
  ui.clickAt(190, 138);
  assert.equal(renderer.scaleFactor, 0.75);
  const tabWidth=Math.floor((panel.bounds.w-32)/5);
  ui.clickAt(panel.bounds.x+8+2*(tabWidth+4)+tabWidth/2,panel.bounds.y+42);
  assert.equal(panel.tab, "TIME");
  ui.beginFrame(); panel.draw(ui);
  panel.scrollAt(30, 150, 1000);
  ui.beginFrame(); panel.draw(ui);
  const bottom = panel.bounds.y + panel.bounds.h - 6;
  for (const region of ui.regions.slice(6)) assert(region.y + region.h <= bottom);
  ui.beginFrame(); panel.draw(ui);
  panel.scroll=0;ui.beginFrame();panel.draw(ui);
  const columns=Math.max(1,Math.floor((panel.bounds.w-24)/64)),index=SPEED_TIERS.indexOf(4);
  ui.clickAt(panel.bounds.x+12+(index%columns)*64+30,panel.bounds.y+62+24+Math.floor(index/columns)*28+12);
  assert.equal(time.speed, 4);
});

test("small-screen toolbar retains every time control on a second row", () => {
  const ui = canvasUI(320, 400);
  ui.beginFrame();
  let clicked = 0;
  ui.drawActionBar(["EDITOR", "INSPEC", "CENTRO", "OPCOES"].map(label => ({ label })), {
    timeControls: ["PAUSA", "-", "0.5X", "+", "PASSO"].map(label => ({ label, onClick() { clicked++; } })),
  });
  assert.equal(ui.regions.length, 9);
  const last = ui.regions.at(-1);
  assert(last.x + last.w <= 312);
  ui.clickAt(last.x + 4, last.y + 4);
  assert.equal(clicked, 1);
});

test('effective speed reports elapsed simulation per real second and resets on mode change',()=>{
 let now=0;const time=new SimulationTime({now:()=>now});time.setSpeed(64);
 time.observeProgress(10);now=2000;time.observeProgress(34);assert.equal(time.effectiveSpeed,12);
 time.setSpeed(32);assert.equal(time.effectiveSpeed,null);time.setPaused(true);assert.equal(time.progressSample,null);
});

test('smooth movement defaults on and the toggle persists across app sessions',()=>{
 let saved='{}';const storage={getItem(){return saved;},setItem(_key,value){saved=value;}};
 const make=()=>new OptionsPanel({renderer:rendererMock(),time:new SimulationTime({now:()=>0}),step(){},storage});
 const panel=make();assert.equal(panel.values.smoothMovement,true);
 assert.equal(panel.items.find(item=>item.key==='smoothMovement').label,'MOVIMENTO SUAVE');
 assert.equal(panel.apply('smoothMovement',false),true);assert.equal(JSON.parse(saved).smoothMovement,false);
 const reopened=make();assert.equal(reopened.values.smoothMovement,false);
 reopened.apply('smoothMovement',true);assert.equal(make().values.smoothMovement,true);
});
