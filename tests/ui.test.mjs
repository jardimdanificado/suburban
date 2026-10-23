import test from 'node:test';
import assert from 'node:assert/strict';
import { CityUI } from '../js/city_ui.js';
import { ManagementCanvasUI } from '../js/management_ui.js';
import { LegacyCanvasUI } from '../js/legacy_ui.js';
import { setup } from './helpers/city.mjs';

function harness(width = 1100, height = 800, Renderer = ManagementCanvasUI) {
  const ctx = new Proxy({}, { get: (_, key) => key === 'canvas' ? {} : () => {} });
  globalThis.window = { innerWidth: width, innerHeight: height, devicePixelRatio: 1 };
  globalThis.document = { createElement: () => ({ style: {}, value: '', handlers: {}, setAttribute() {}, addEventListener(type,handler) {this.handlers[type]=handler;}, append() {}, getContext: () => ctx }) };
  const city = setup(), canvas = { clientWidth: width, clientHeight: height, getContext: () => ctx };
  const ui = new Renderer(canvas), labels = [], buttons = [];
  const originalText = ui.text.bind(ui), originalButton = ui.button.bind(ui);
  ui.text = (value, ...args) => { labels.push(String(value)); originalText(value, ...args); };
  ui.button = (x, y, w, h, label, click, state) => { buttons.push({ label, click }); originalButton(x, y, w, h, label, click, state); };
  const inspector = new CityUI({ city, root: { append() {} }, select: entity => inspector.setSelection(entity), camera() {} });
  const draw = () => { labels.length = 0; buttons.length = 0; ui.beginFrame(); inspector.draw(ui); };
  return { city, ui, inspector, labels, buttons, draw };
}

test('native inspector opens citizen dossiers and mobile selection goes straight to the detail', () => {
  const h = harness(390, 844); h.inspector.navigate('people'); h.draw();
  const c = h.city.citizens[0]; h.ui.regions.find(r => r.label === c.entity.properties.name).onClick(); h.draw();
  assert.equal(h.inspector.mobileDetail, true);
  assert(h.labels.includes('NECESSIDADES'));
  assert(!h.labels.some(l => l.startsWith('CIDADÃOS /')));
  h.buttons.find(b => b.label === 'LISTA').click(); h.draw();
  assert(h.labels.some(l => l.startsWith('CIDADÃOS /')));
  assert(h.ui.regions.every(r => r.x >= 0 && r.x + r.w <= 390));
});

test('scrolling inspector blocks camera zoom and clipped controls cannot receive clicks outside their pane', () => {
  const h = harness(); h.inspector.navigate('people'); h.draw();
  const z = h.inspector.zones.find(z=>z.key==='list');
  assert(h.inspector.scrollAt(z.x + 3, z.y + 3, 100000)); h.draw();
  assert.equal(h.inspector.scrolls.list, h.inspector.zones.find(z=>z.key==='list').max);
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
  assert(h.labels.includes('SALDO'));
});

test('inspector works with the original framework UI without clip, box or bar methods', () => {
  const h = harness(1100,800,LegacyCanvasUI);
  h.ui.clip = h.ui.box = h.ui.bar = undefined;
  for (const tab of ['city', 'government', 'land', 'production', 'transport', 'log']) {
    h.inspector.navigate(tab); assert.doesNotThrow(h.draw);
  }
  h.inspector.setSelection(h.city.citizens[0].entity);
  assert.doesNotThrow(h.draw);
  const b = h.city.buildings[0]; h.inspector.setSelection(b.entity, b.units[0].id);
  assert.doesNotThrow(h.draw);
});

test('construction services and municipal road contracts render through the native inspector', () => {
  const h = harness(), builder = h.city.economy.businesses.find(b => b.type === 'builder');
  const road = h.city.development.beginRoad('treasury', { x: 5.5, y: 5.5 }, { x: 12.5, y: 5.5 }); assert(road);
  h.inspector.navigate('land'); assert.doesNotThrow(h.draw);
  h.inspector.setSelection(builder.entity); h.inspector.detailTab = 'services'; assert.doesNotThrow(h.draw);
  assert(h.labels.includes('SERVIÇOS DA CONSTRUTORA'));
  h.inspector.detailTab = 'staff'; h.draw(); assert(h.labels.includes('Refeições fornecidas'));
});

test('panorama alerts open the relevant directory with an applied filter', () => {
  const h=harness(1440,900),c=h.city.citizens[3]; h.city.releaseHome(c); h.draw();
  const metric=h.ui.regions.find(r=>r.label==='SEM MORADIA'); assert(metric); metric.onClick(); h.draw();
  assert.equal(h.inspector.tab,'people'); assert.equal(h.inspector.filter(),'homeless');
  const cards=h.ui.regions.filter(r=>r.label&&h.city.citizens.some(c=>c.entity.properties.name===r.label));
  assert(cards.length); for(const r of cards) assert(!h.city.citizens.find(c=>c.entity.properties.name===r.label).homeUnitId);
});

test('dossiers retain directory search and scroll; back restores context and selection', () => {
  const h=harness(1440,900),[a,b]=h.city.citizens;
  h.inspector.navigate('people'); h.inspector.query='Ana';h.inspector.search.value='Ana';h.inspector.scrolls.list=95;
  h.inspector.setSelection(a.entity);assert.equal(h.inspector.query,'Ana');assert.equal(h.inspector.scrolls.list,95);
  h.inspector.setSelection(b.entity);h.inspector.navigate('production');h.inspector.setView('demand');
  h.inspector.back(); assert.equal(h.inspector.tab,'people');assert.equal(h.inspector.selected,b.entity);assert.equal(h.inspector.query,'Ana');
  h.inspector.back(); assert.equal(h.inspector.selected,a.entity);assert.equal(h.inspector.scrolls.list,95);
  h.draw();h.buttons.find(b=>b.label==='HABILIDADES').click();assert.equal(h.inspector.scrolls.list,Math.min(95,h.inspector.zones.find(z=>z.key==='list').max));
});

test('compact navigation hides text inputs, scrolls on short screens and closes with Escape', () => {
  const h=harness(390,550);h.inspector.navigate('government');h.inspector.setView('world');h.inspector.menuOpen=true;h.draw();
  assert(h.inspector.search.hidden);assert(h.inspector.seed.hidden);const z=h.inspector.zones.find(z=>z.key==='navigation');assert(z.max>0);
  h.inspector.scrollAt(z.x+4,z.y+4,10000);h.draw();assert(h.buttons.some(b=>b.label==='HISTÓRICO'));
  h.buttons.find(b=>b.label==='HISTÓRICO').click();assert.equal(h.inspector.tab,'log');assert.equal(h.inspector.menuOpen,false);
  h.inspector.menuOpen=true;h.inspector.key({code:'Escape'});assert.equal(h.inspector.menuOpen,false);assert(h.inspector.visible);
});

test('every module and subview renders with bounded interactive regions on desktop and phone', () => {
  const views={city:['overview','needs','activity'],government:['overview','contracts','finance','world'],land:['plots','projects'],production:['stocks','demand','flow'],transport:['active','finished'],sanitation:['facilities','cleaning','waste','deaths'],log:['overview']};
  for(const [width,height] of [[1440,900],[390,844]]){
    const h=harness(width,height);h.ui.clip=h.ui.box=h.ui.bar=undefined;
    for(const [tab,subviews] of Object.entries(views))for(const view of subviews){
      h.inspector.navigate(tab);h.inspector.setView(view);assert.doesNotThrow(h.draw,`${tab}/${view}`);
      for(const r of h.ui.regions){assert(Number.isFinite(r.x+r.y+r.w+r.h));assert(r.x>=0&&r.x+r.w<=width,`${tab}/${view} horizontal overflow`);}
      assert.equal(!h.inspector.seed.hidden,tab==='government'&&view==='world');
    }
  }
});

test('building plans select floors and perimeter rooms without offering the interior core', () => {
  const h=harness(1440,900),b=h.city.buildings.find(b=>b.type==='residential');
  h.inspector.setSelection(b.entity,b.units[0].id);h.draw();assert(h.labels.includes('PLANTA DOS ESPAÇOS'));
  h.buttons.find(b=>b.label==='2º ANDAR').click();h.draw();assert.equal(h.city.units.get(h.inspector.unitId).z,1);
  const roomButtons=h.buttons.filter(b=>['Q','B','E'].includes(b.label));assert.equal(roomButtons.length,b.units.filter(u=>u.z===1).length);
  roomButtons.at(-1).click();const selected=h.city.units.get(h.inspector.unitId);assert(selected.x===0||selected.y===0||selected.x===b.width-1||selected.y===b.depth-1);
});

test('company dossier links stay in the companies directory and sanitation keeps facility detail accessible', () => {
  const h=harness(1440,900),company=h.city.economy.businesses[0];h.inspector.navigate('economy');h.inspector.setSelection(company.entity);h.draw();assert.equal(h.inspector.tab,'economy');
  h.inspector.navigate('sanitation');h.draw();const f=[...h.city.sanitation.facilities.values()][0];h.inspector.selectedFacilityId=f.id;h.draw();
  assert(h.labels.includes('BANHEIRO SELECIONADO'));assert(h.labels.indexOf('BANHEIRO SELECIONADO')<h.labels.indexOf('CONDIÇÃO DOS BANHEIROS'));
});


test('opening a project plot leaves the works view and back restores it', () => {
  const h=harness();h.inspector.navigate('land');h.inspector.setView('projects');const plot=h.city.development.plots[0];
  h.inspector.setPlotSelection(plot.id);assert.equal(h.inspector.view(),'plots');assert.equal(h.inspector.selectedPlotId,plot.id);
  h.inspector.back();assert.equal(h.inspector.view(),'projects');
});


test('native filter and sorting selectors update directories and hide behind compact navigation', () => {
  const h=harness(390,844);h.inspector.navigate('people');h.draw();
  assert(!h.inspector.filterInput.hidden);assert(!h.inspector.sortInput.hidden);
  h.inspector.filterInput.value='homeless';h.inspector.filterInput.handlers.change();assert.equal(h.inspector.filter(),'homeless');
  h.inspector.sortInput.value='cash';h.inspector.sortInput.handlers.change();assert.equal(h.inspector.sorts.people,'cash');
  h.inspector.menuOpen=true;h.draw();assert(h.inspector.filterInput.hidden);assert(h.inspector.sortInput.hidden);
  h.inspector.menuOpen=false;h.inspector.setSelection(h.city.citizens[0].entity);h.draw();assert(h.inspector.filterInput.hidden);assert(h.inspector.sortInput.hidden);
});

test('classic controls preserve hit testing and clipping with proportional text and accented labels', () => {
  const h=harness();let clicks=0;h.ui.beginFrame();h.ui.panel(10,10,300,180,'Administração da cidade');
  h.ui.clip(20,50,180,70,()=>h.ui.button(20,90,180,40,'Próximo cidadão',()=>clicks++));
  assert(h.ui.clickAt(40,100));assert.equal(clicks,1);h.ui.clickAt(40,125);assert.equal(clicks,1);assert.equal(h.ui.hitTest(40,125).onClick,null);
  assert.match(h.ui.font(),/12px Arial/);assert.doesNotThrow(()=>h.ui.text('João, maçã, feijão e R$ 1.234,56',20,40));
});
