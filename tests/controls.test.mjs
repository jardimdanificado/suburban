import test from "node:test";
import assert from "node:assert/strict";
import { SimulationTime, SPEED_TIERS } from "../js/simulation_time.js";
import { OptionsPanel } from "../js/options.js";
import { LegacyCanvasUI } from "../js/legacy_ui.js";
import { WorldClock } from "../js/world.js";

test("all speed tiers advance the world clock and experience with fixed steps", () => {
  for (const speed of SPEED_TIERS) {
    const time = new SimulationTime();
    const clock = new WorldClock();
    time.setSpeed(speed);
    let calls = 0;
    for (let frame = 0; frame < 60; frame++) time.advance(1 / 60, dt => {
      assert.equal(dt, 1 / 60);
      calls++;
      clock.tick(dt);
    });
    assert.equal(calls, 60 * speed);
    assert.equal(time.tick, calls);
    assert(Math.abs(time.elapsed - speed) < 1e-8);
    assert(Math.abs(clock.minute + clock.minuteTimer - speed) < 1e-8);
  }
});

test("simulation produces the same steps at different rendering frame rates", () => {
  const run = fps => {
    const time = new SimulationTime();
    time.setSpeed(16);
    for (let i = 0; i < fps; i++) time.advance(1 / fps, () => {});
    return time.tick;
  };
  assert.equal(run(30), 960);
  assert.equal(run(144), 960);
});

test("pause discards partial steps and suspended-tab time is bounded", () => {
  const time = new SimulationTime();
  time.advance(1 / 120, () => assert.fail("partial step must wait"));
  time.setPaused(true);
  assert.equal(time.advance(200, () => assert.fail("paused update")), 0);
  time.setPaused(false);
  assert.equal(time.advance(1 / 120, () => assert.fail("pause must clear backlog")), 0);
  assert.equal(time.advance(200, () => {}), 15);
});

test("single-step requires pause and is independent of the selected speed", () => {
  const time = new SimulationTime();
  time.setSpeed(32);
  assert.equal(time.step(() => assert.fail("running step")), false);
  time.setPaused(true);
  let dt = 0;
  assert.equal(time.step(value => { dt = value; }), true);
  assert.equal(time.tick, 1);
  assert.equal(dt, 1 / 60);
  assert.equal(time.paused, true);
  time.changeSpeed(1);
  assert.equal(time.speed, 32);
  for (let i = 0; i < 20; i++) time.changeSpeed(-1);
  assert.equal(time.speed, 0.5);
  assert.throws(() => time.setSpeed(Infinity), RangeError);
});

function rendererMock() {
  return {
    shadowsEnabled: true, wireframeMode: 0, graphicOptions: {},
    setResolutionScale(value) { this.scaleFactor = value; },
    setFullWorld(value) { this.renderFullWorld = value; },
    forceStaticInstanceUpdate() { this.invalidated = true; },
    toggleShadows() { this.shadowsEnabled = !this.shadowsEnabled; },
    setShadowQuality(value) { this.shadowQuality = value; },
    toggleWireframe() { this.wireframeMode = (this.wireframeMode + 1) % 3; },
    setGraphicOptions(value) { Object.assign(this.graphicOptions, value); },
  };
}

test("graphics options apply renderer hooks and persist validated preferences", () => {
  let saved = '{"resolution":0.75,"shadows":false,"distance":"bad"}';
  const storage = { getItem() { return saved; }, setItem(_key, value) { saved = value; } };
  const renderer = rendererMock();
  const panel = new OptionsPanel({ renderer, time: new SimulationTime(), step() {}, storage });
  assert.equal(renderer.scaleFactor, 0.75);
  assert.equal(renderer.shadowsEnabled, false);
  assert.equal(renderer.max3DRenderDistance, 64);
  panel.apply("distance", 0);
  assert.equal(renderer.renderFullWorld, true);
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
  const panel = new OptionsPanel({ renderer: rendererMock(), time: new SimulationTime(), step() {}, storage });
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
  const time = new SimulationTime();
  const renderer = rendererMock();
  const panel = new OptionsPanel({ renderer, time, step: () => time.step(() => {}) });
  panel.open = true;
  ui.beginFrame(); panel.draw(ui);
  ui.clickAt(190, 138);
  assert.equal(renderer.scaleFactor, 0.75);
  ui.clickAt(125, 80);
  assert.equal(panel.tab, "EFFECTS");
  ui.beginFrame(); panel.draw(ui);
  panel.scrollAt(30, 150, 1000);
  ui.beginFrame(); panel.draw(ui);
  const bottom = panel.bounds.y + panel.bounds.h - 6;
  for (const region of ui.regions.slice(6)) assert(region.y + region.h <= bottom);
  ui.clickAt(235, 80);
  assert.equal(panel.tab, "TIME");
  ui.beginFrame(); panel.draw(ui);
  ui.clickAt(230, 138);
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
