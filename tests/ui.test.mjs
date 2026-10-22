import test from 'node:test';
import assert from 'node:assert/strict';
import { CityUI } from '../js/city_ui.js';
import { LegacyCanvasUI } from '../js/legacy_ui.js';
import { setup } from './helpers/city.mjs';

function harness(width = 1100, height = 800) {
  const ctx = new Proxy({}, { get: (_, key) => key === 'canvas' ? {} : () => {} });
  globalThis.window = { innerWidth: width, innerHeight: height, devicePixelRatio: 1 };
  globalThis.document = { createElement: () => ({ style: {}, value: '', setAttribute() {}, addEventListener() {}, append() {}, getContext: () => ctx }) };
  const city = setup(), canvas = { clientWidth: width, clientHeight: height, getContext: () => ctx };
  const ui = new LegacyCanvasUI(canvas), labels = [], buttons = [];
  const originalText = ui.text.bind(ui), originalButton = ui.button.bind(ui);
  ui.text = (value, ...args) => { labels.push(String(value)); originalText(value, ...args); };
  ui.button = (x, y, w, h, label, click, state) => { buttons.push({ label, click }); originalButton(x, y, w, h, label, click, state); };
  const inspector = new CityUI({ city, root: { append() {} }, select: entity => inspector.setSelection(entity), camera() {} });
  const draw = () => { labels.length = 0; buttons.length = 0; ui.beginFrame(); inspector.draw(ui); };
  return { city, ui, inspector, labels, buttons, draw };
}

test('native inspector opens citizen dossiers and mobile selection goes straight to the detail', () => {
  const h = harness(390, 844); h.inspector.navigate('people'); h.draw();
  const c = h.city.citizens[0]; h.buttons.find(b => b.label === c.entity.properties.name).click(); h.draw();
  assert.equal(h.inspector.mobileDetail, true);
  assert(h.labels.includes('NECESSIDADES'));
  assert(!h.labels.some(l => l.startsWith('CIDADÃOS /')));
  h.buttons.find(b => b.label === 'LISTA').click(); h.draw();
  assert(h.labels.some(l => l.startsWith('CIDADÃOS /')));
  assert(h.ui.regions.every(r => r.x >= 0 && r.x + r.w <= 390));
});

test('scrolling inspector blocks camera zoom and clipped controls cannot receive clicks outside their pane', () => {
  const h = harness(); h.inspector.navigate('people'); h.draw();
  const z = h.inspector.zones[0];
  assert(h.inspector.scrollAt(z.x + 3, z.y + 3, 100000)); h.draw();
  assert.equal(h.inspector.scrolls.list, h.inspector.zones[0].max);
  assert.equal(h.inspector.scrollAt(0, 0, 300), false);
  let clicked = false; h.ui.regions = [];
  h.ui.clip(10, 20, 100, 100, () => h.ui.button(10, 0, 100, 40, 'clipped', () => { clicked = true; }));
  assert.equal(h.ui.clickAt(30, 10), false);
  assert.equal(h.ui.clickAt(30, 25), true); assert(clicked);
});

test('history freeze keeps its snapshot while the city adds events and resumes live', () => {
  const h = harness(); h.inspector.navigate('log'); h.draw();
  h.buttons.find(b => b.label === 'CONGELAR HISTÓRICO').click();
  const count = h.inspector.frozenEvents.length;
  h.city.log('Evento posterior ao congelamento', 'city'); h.draw();
  assert.equal(h.inspector.frozenEvents.length, count);
  assert(!h.labels.includes('Evento posterior ao congelamento'));
  h.buttons.find(b => b.label === 'RETOMAR AO VIVO').click(); h.draw();
  assert(h.labels.includes('Evento posterior ao congelamento'));
});

test('map cell selection opens ownership detail and switching dossiers resets unrelated tabs', () => {
  const h = harness(); const b = h.city.buildings[0], u = b.units[0];
  h.inspector.setSelection(b.entity, u.id); h.draw();
  assert.equal(h.inspector.detailTab, 'units'); assert.equal(h.inspector.unitId, u.id);
  h.inspector.setSelection(h.city.citizens[0].entity); h.draw();
  assert.equal(h.inspector.detailTab, 'profile');
  assert(h.labels.includes('Saldo pessoal'));
});

test('inspector works with the original framework UI without clip, box or bar methods', () => {
  const h = harness();
  h.ui.clip = h.ui.box = h.ui.bar = undefined;
  for (const tab of ['city', 'government', 'production', 'log']) {
    h.inspector.navigate(tab); assert.doesNotThrow(h.draw);
  }
  h.inspector.setSelection(h.city.citizens[0].entity);
  assert.doesNotThrow(h.draw);
  const b = h.city.buildings[0]; h.inspector.setSelection(b.entity, b.units[0].id);
  assert.doesNotThrow(h.draw);
});
