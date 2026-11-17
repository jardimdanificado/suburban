import test from 'node:test';
import assert from 'node:assert/strict';
import { StartupLoading } from '../js/startup_loading.js';

function harness() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (target, key) => {
      if (key in target) return target[key];
      return (...args) => { calls.push([key, ...args]); };
    },
    set: (target, key, value) => { target[key] = value; return true; }
  });
  const canvas = { style: {}, parentNode: null, addEventListener() {}, getContext: () => ctx, remove() { this.removed = true; } };
  globalThis.document = { createElement: () => canvas };
  globalThis.window = { innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1, addEventListener() {} };
  globalThis.requestAnimationFrame = () => 0;
  const root = { clientWidth: 1000, clientHeight: 700, append(el) { el.parentNode = root; } };
  const loading = new StartupLoading({ root });
  return { loading, ctx, calls, canvas, root };
}

test('startup loading opens one centered floating window through the window manager', () => {
  const { loading } = harness();
  assert.equal(loading.closed, false);
  assert.equal(loading.window.id, 'startup-loading');
  assert.equal(loading.window.title, 'Suburban Chronicles');
  assert.equal(loading.manager.windows.length, 1);
  assert.equal(loading.window.x, (1000 - loading.window.w) / 2);
  assert.equal(loading.window.y, (700 - loading.window.h) / 2);
});

test('stage updates label and clamps progress to the 0..1 range', () => {
  const { loading } = harness();
  loading.stage('Gerando terreno…', 0.4);
  assert.equal(loading.stageLabel, 'Gerando terreno…');
  assert.equal(loading.progress, 0.4);
  loading.stage(null, 5);
  assert.equal(loading.progress, 1);
  loading.stage('Iniciando…', -3);
  assert.equal(loading.progress, 0);
  assert.equal(loading.stageLabel, 'Iniciando…');
});

test('draw renders the progress bar with a width proportional to progress', () => {
  const { loading, calls } = harness();
  calls.length = 0;
  loading.stage('Carregando…', 0.5);
  const inner = loading.window.w - 24;
  const barFills = calls.filter(([op, x, , width, height]) => op === 'fillRect' && height === 12 && width > 0 && width < inner - 6);
  assert(barFills.some(([, , , width]) => Math.abs(width - (inner - 6) * 0.5) < 0.01));
});

test('close removes the overlay and suppresses drawing until reopened', () => {
  const { loading, calls, canvas } = harness();
  loading.close();
  assert.equal(loading.closed, true);
  assert.equal(canvas.removed, true);
  calls.length = 0;
  loading.draw();
  assert.equal(calls.length, 0);
  loading.open();
  assert.equal(loading.closed, false);
  assert.equal(canvas.removed, true);
  loading.stage('Pronto…', 1);
  assert(calls.some(([op]) => op === 'fillRect'));
});

test('simulation preparation keeps loading open until the worker checkpoint completes', async () => {
  const loading = new StartupLoading();
  loading.open();
  const events = [];
  loading.paint = async () => { events.push('paint'); };
  let finish;
  const checkpoint = new Promise(resolve => { finish = resolve; });
  let ready = false;
  const pending = loading.prepareSimulation({ active: true, checkpoint() { events.push('checkpoint'); return checkpoint; } });
  pending.then(() => { ready = true; });
  await Promise.resolve();
  assert.deepEqual(events, ['paint', 'checkpoint']);
  assert.equal(loading.stageLabel, 'Aquecendo simulação e vocabulário…');
  assert.equal(loading.closed, false);
  assert.equal(ready, false);
  finish();
  await pending;
  assert.equal(ready, true);
});

test('simulation preparation permits local fallback when the worker is unavailable or fails', async () => {
  const loading = new StartupLoading();
  loading.paint = async () => {};
  await loading.prepareSimulation({ active: false, checkpoint() { assert.fail('inactive worker'); } });
  await loading.prepareSimulation({ active: true, checkpoint: async () => { throw new Error('worker failed'); } });
});
