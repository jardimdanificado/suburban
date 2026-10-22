import { clipCanvasRegion, canvasBox, canvasBar } from './canvas_widgets.js';
import { SKILLS, CROPS, GOODS, JOB_SKILL } from './city_economy.js';
import { WORLD_PRESETS, randomWorldSeed } from './world_settings.js';
import { EVENT_CATEGORIES, relationLabel, SOCIAL_RULES } from './city_society.js';
import { BUILDING_TYPES, NEED_LABELS } from './city_simulation.js';
export const money = value => ((value || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const C = { gold: '#f8b800', gray: '#bcbcbc', green: '#58d854', red: '#ff6060', cyan: '#40c8f8', pink: '#f878b8' };
const TABS = [['city', 'CIDADE'], ['government', 'GOVERNO'], ['people', 'PESSOAS'], ['buildings', 'IMOVEIS'], ['economy', 'EMPRESAS'], ['production', 'PRODUCAO'], ['log', 'HISTORICO']];
const stamp = minute => `D${Math.floor(minute / 1440) + 1} ${String(Math.floor(minute % 1440 / 60)).padStart(2, '0')}:${String(Math.floor(minute % 60)).padStart(2, '0')}`;
const name = entity => entity?.properties?.name || 'Ausente';
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const trim = (value, width) => { const s = String(value); const n = Math.max(1, Math.floor(width / 8)); return s.length > n ? s.slice(0, Math.max(0, n - 3)) + '...' : s; };

/** Simulation inspector built with the framework's original bitmap/NES widgets. */
export class CityUI {
  constructor({ city, root, select, camera }) {
    Object.assign(this, { city, select, camera, tab: 'city', selected: null, unitId: null, visible: true, expanded: false, notice: '' });
    this.scrolls = {}; this.zones = []; this.query = ''; this.detailTab = 'profile'; this.mobileDetail = false; this.logLimit = 80;
    this.logCategory = 'all'; this.logCitizenId = null; this.logLive = true;
    this.frozenEvents = null;
    this.element = document.createElement('div'); this.element.className = 'city-inputs ui-panel'; root.append(this.element);
    this.search = document.createElement('input'); this.search.type = 'search'; this.search.placeholder = 'Buscar nomes, ações ou registros...'; this.search.setAttribute('aria-label', 'Pesquisar no observatório');
    this.search.addEventListener('input', () => { this.query = this.search.value; this.logLimit = 80; this.resetScroll(); });
    this.search.addEventListener('keydown', e => { if (e.key === 'Escape') { this.search.blur(); e.stopPropagation(); } });
    this.seed = document.createElement('input'); this.seed.type = 'number'; this.seed.min = '1'; this.seed.max = '2147483647'; this.seed.value = city.world.seed ?? city.initialSeed; this.seed.setAttribute('aria-label', 'Semente do próximo terreno');
    this.element.append(this.search, this.seed);
    this.terrain = city.world.preset || Object.keys(WORLD_PRESETS)[0];
  }
  resetScroll() { this.scrolls = {}; }
  navigate(tab) { if (this.tab !== tab) this.detailTab = 'profile'; this.tab = tab; this.query = ''; this.search.value = ''; this.mobileDetail = false; this.resetScroll(); }
  setSelection(entity, unitId = null) {
    this.selected = entity; this.unitId = unitId; this.detailTab = 'profile'; this.visible = true;
    if (entity?.properties.citizen) this.navigate('people');
    if (entity?.properties.cityBuilding) { this.navigate('buildings'); if (unitId) this.detailTab = 'units'; }
    this.mobileDetail = !!entity;
  }
  toggle() { this.visible = !this.visible; this.element.hidden = !this.visible; }
  openCitizen(id) { const c = this.city.society.citizen(id); if (c) this.select(c.entity); }
  openBuilding(id) { const b = this.city.building(id); if (b) this.select(b.entity); }
  personLog(id) { this.navigate('log'); this.logCitizenId = id; }
  matches(value) { return normalize(value).includes(normalize(this.query)); }
  scrollAt(x, y, delta) {
    if (this.element.hidden || !this.visible) return false;
    const z = this.zones.find(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
    if (!z) return false;
    this.scrolls[z.key] = Math.max(0, Math.min(z.max, (this.scrolls[z.key] || 0) + delta)); return true;
  }
  key(event) {
    if (event.code === 'KeyC' && !event.repeat) { this.toggle(); return true; }
    if (!this.visible) return false;
    if (event.code === 'Escape') { this.toggle(); return true; }
    if (event.code === 'Slash') { this.search.focus(); return true; }
    if (['PageDown', 'PageUp', 'Home', 'End'].includes(event.code)) {
      const z = this.zones.at(-1); if (!z) return false;
      this.scrolls[z.key] = event.code === 'Home' ? 0 : event.code === 'End' ? z.max : Math.max(0, Math.min(z.max, (this.scrolls[z.key] || 0) + z.h * (event.code === 'PageUp' ? -1 : 1))); return true;
    }
    return false;
  }
  inputAt(input, x, y, w) { Object.assign(input.style, { left: `${x}px`, top: `${y}px`, width: `${w}px` }); input.hidden = false; }
  draw(ui) {
    this.element.hidden = !this.visible;
    this.seed.hidden = true; this.zones = [];
    if (!this.visible) return;
    const w = Math.min(ui.width - 12, this.expanded ? 1120 : 792), x = ui.width - w - 6, y = 42;
    const h = Math.max(160, ui.height - y - 80);
    this.bounds = { x, y, w, h };
    ui.panel(x, y, w, h, trim('SUBURBAN / OBSERVATORIO', w - 130), '');
    ui.button(x + w - 92, y + 5, 50, 24, this.expanded ? '><' : '<>', () => { this.expanded = !this.expanded; });
    ui.button(x + w - 36, y + 5, 28, 24, 'X', () => this.toggle(), { danger: true });
    let tx = x + 8, ty = y + 34;
    for (const [id, label] of TABS) {
      const bw = label.length * 8 + 24;
      if (tx + bw > x + w - 8) { tx = x + 8; ty += 28; }
      ui.button(tx, ty, bw, 24, label, () => this.navigate(id), { selected: this.tab === id }); tx += bw + 4;
    }
    const sy = ty + 32;
    this.inputAt(this.search, x + 10, sy, w - 20);
    let by = sy + 36;
    const listMode = ['people', 'buildings', 'economy'].includes(this.tab);
    if (listMode && w < 700) {
      const bw = Math.floor((w - 24) / 2);
      ui.button(x + 10, by, bw, 26, 'LISTA', () => { this.mobileDetail = false; }, { selected: !this.mobileDetail });
      ui.button(x + 14 + bw, by, bw, 26, 'FICHA', () => { this.mobileDetail = true; }, { selected: this.mobileDetail });
      by += 34;
    }
    const bh = Math.max(24, y + h - by - 25);
    const s = this.city.stats();
    ui.text(trim(`${stamp(this.city.minute)} | ${s.population} HAB | CAIXA ${money(s.treasury)}`, w - 20), x + 10, y + h - 15, C.gray);
    if (listMode && w >= 700) {
      const lw = 232;
      this.pane(ui, 'list', x + 10, by, lw, bh, p => this.directory(p));
      this.pane(ui, `detail:${this.selected?.id}:${this.detailTab}`, x + lw + 22, by, w - lw - 32, bh, p => this.detail(p));
    } else this.pane(ui, this.tab + ':' + this.detailTab, x + 10, by, w - 20, bh, p => {
      if (listMode) { if (this.mobileDetail) this.detail(p); else this.directory(p); }
      else this.content(p);
    });
  }
  pane(ui, key, x, y, w, h, draw) {
    const scroll = this.scrolls[key] || 0;
    const p = new Page(ui, x, y - scroll, w - 14, y, y + h);
    clipCanvasRegion(ui, x, y, w, h, () => draw(p));
    const height = p.y - (y - scroll), max = Math.max(0, height - h);
    this.scrolls[key] = Math.min(scroll, max); this.zones.push({ key, x, y, w, h, max });
    if (max > 0) {
      ui.ctx.fillStyle = '#303030'; ui.ctx.fillRect(x + w - 8, y, 6, h);
      const thumb = Math.max(16, h * h / height), top = y + (h - thumb) * Math.min(scroll, max) / max;
      ui.ctx.fillStyle = C.gold; ui.ctx.fillRect(x + w - 8, top, 6, thumb);
      ui.regions.push({ x: x + w - 12, y, w: 12, h, onClick: () => { this.scrolls[key] = scroll >= max ? 0 : Math.min(max, scroll + h * .7); } });
    }
  }
  directory(p) {
    if (this.tab === 'people') {
      p.heading(`CIDADÃOS / ${this.city.citizens.length}`);
      p.note('Nome / saldo / atividade. Clique para abrir a ficha.');
      const people = this.city.citizens.filter(c => this.matches(`${name(c.entity)} ${c.action} ${c.profession}`));
      for (const c of people) p.card(name(c.entity), `${money(c.balance)} | ${c.action}`, () => this.openCitizen(c.id), this.selected?.id === c.id);
      if (!people.length) p.note('Nenhum cidadão encontrado.');
    } else {
      const businesses = this.tab === 'economy';
      const buildings = businesses ? this.city.economy.businesses : this.city.buildings.filter(b => !b.entity.destroyed);
      p.heading(`${businesses ? 'EMPRESAS' : 'PRÉDIOS'} / ${buildings.length}`);
      if (businesses) p.button('DEMANDAS E OPORTUNIDADES', () => this.navigate('production'));
      const filtered = buildings.filter(b => this.matches(`${name(b.entity)} ${BUILDING_TYPES[b.type].label} ${CROPS[b.crop]?.label || ''}`));
      for (const b of filtered) p.card(name(b.entity), `${BUILDING_TYPES[b.type].label} | ${businesses ? money(b.balance) : b.units.length + ' células'}`, () => this.openBuilding(b.id), this.selected?.id === b.id);
      if (!filtered.length) p.note('Nenhum prédio encontrado.');
    }
  }
  detail(p) {
    const c = this.selected?.properties.citizen, b = this.selected?.properties.cityBuilding;
    if (this.tab === 'people' && c && this.city.society.citizen(c.id)) return this.citizen(p, c);
    if (this.tab !== 'people' && b && !b.entity.destroyed) return this.building(p, b);
    p.heading('FICHA DE OBSERVAÇÃO'); p.note('Selecione um item na lista ou clique em uma pessoa ou prédio no mapa.');
    if (this.tab === 'economy') this.demands(p);
  }
  dossierTabs(p, tabs) {
    p.buttons(tabs.map(([id, label]) => ({ label, selected: this.detailTab === id, click: () => { this.detailTab = id; this.resetScroll(); } })));
    p.space(8);
  }
  citizen(p, c) {
    const city = this.city, society = city.society;
    p.heading(name(c.entity), C.gold); p.note(`#${c.id} | ${society.age(c)} anos | ${c.id === city.economy.mayorId ? 'Prefeito' : c.wealthTier === 'wealthy' ? 'Investidor' : 'Morador'}`);
    p.button('LOCALIZAR NO MAPA', () => { this.camera(c.entity.x, c.entity.y); this.visible = false; });
    this.dossierTabs(p, [['profile', 'PERFIL'], ['skills', 'HABILIDADES'], ['family', 'VÍNCULOS'], ['assets', 'FINANÇAS']]);
    if (this.detailTab === 'profile') {
      p.heading('ROTINA ATUAL'); p.note(c.action, C.cyan);
      p.kv('Felicidade', `${Math.round(c.happiness)}%`); p.kv('Saldo pessoal', money(c.balance)); p.kv('Provisões', `${c.provisions} refeições`);
      p.heading('NECESSIDADES'); for (const [id, value] of Object.entries(c.needs)) p.meter(NEED_LABELS[id], value);
      const home = city.units.get(c.homeUnitId); p.heading('MORADIA');
      if (home) { p.kv('Célula', home.id); p.kv('Regime', home.ownerId === c.accountId ? 'Proprietário' : 'Inquilino'); p.button(name(city.building(home.buildingId)?.entity), () => this.openBuilding(home.buildingId)); }
      else p.note('Sem moradia', C.red);
    } else if (this.detailTab === 'skills') {
      p.heading('TRABALHO'); const job = city.building(c.jobId);
      if (job) p.button(name(job.entity), () => this.openBuilding(job.id));
      else p.note(c.businessIds.length ? 'Empresário' : society.isAdult(c) ? 'Sem emprego' : 'Criança');
      p.kv('Salário recebido hoje', money(c.salaryToday)); p.note('As habilidades aumentam com a prática e influenciam contratação e remuneração.');
      for (const [id, v] of Object.entries(c.skills)) p.meter(SKILLS[id], v, C.cyan);
    } else if (this.detailTab === 'family') {
      p.heading('FAMÍLIA', C.pink);
      const link = (label, id) => { const person = society.citizen(id); p.note(label); if (person) p.button(name(person.entity), () => this.openCitizen(id)); else p.note(city.accountName(`citizen:${id}`)); };
      if (c.partnerId) link('Companheiro(a)', c.partnerId); else p.note('Sem relacionamento amoroso.');
      for (const id of c.parentIds) link('Filiação', id);
      for (const id of c.childIds) link('Filho(a)', id);
      if (!society.isAdult(c)) link('Responsável', c.guardianId);
      const pregnancy = society.expecting.find(e => e.id === c.expectingId); if (pregnancy) p.note(`Filho esperado: ${stamp(pregnancy.dueAt)}`, C.pink);
      p.note(`${c.personality.wantsRomance ? 'Aberto a relacionamentos' : 'Prefere ficar solteiro'} / ${c.personality.wantsChildren ? 'Deseja ter filhos' : 'Não planeja filhos'}`);
      const relations = society.relationsFor(c.id); p.heading(`VÍNCULOS / ${relations.length}`);
      for (const r of relations) { const other = r.a === c.id ? r.b : r.a; p.button(name(society.citizen(other)?.entity), () => this.openCitizen(other)); p.note(`${relationLabel(r)} | ${r.conversations} conversas`); p.meter('Afeto', r.affection, C.pink); p.meter('Confiança', r.trust, C.cyan); p.meter('Familiaridade', r.familiarity); }
      if (!relations.length) p.note('Ainda está conhecendo os vizinhos.');
    } else {
      p.heading('CONTA PESSOAL'); p.kv('Dinheiro disponível', money(c.balance)); p.kv('Salário hoje', money(c.salaryToday));
      const units = [...city.units.values()].filter(u => u.ownerId === c.accountId);
      p.kv('Imóveis próprios', units.length); p.kv('Valor anunciado total', money(units.reduce((s, u) => s + u.price, 0)));
      p.kv('Aluguel contratado/dia', money(units.filter(u => u.tenantId && u.tenantId !== c.accountId).reduce((s, u) => s + u.rent, 0)));
      p.heading('EMPRESAS'); for (const id of c.businessIds) { const b = city.building(id); if (b) p.button(name(b.entity), () => this.openBuilding(id)); }
      p.heading('MOVIMENTAÇÕES RECENTES'); this.transactions(p, c.accountId);
    }
    p.button('VER HISTÓRICO DESTA PESSOA', () => this.personLog(c.id));
  }
  building(p, b) {
    const city = this.city;
    p.heading(name(b.entity)); p.note(`${BUILDING_TYPES[b.type].label} | ${b.width}x${b.depth}x${b.floors} | ${b.units.length} células`);
    p.button('LOCALIZAR NO MAPA', () => { this.camera(b.entity.x, b.entity.y); this.visible = false; });
    this.dossierTabs(p, [['profile', 'OPERAÇÃO'], ['stock', 'ESTOQUE'], ['staff', 'EQUIPE'], ['units', 'CÉLULAS']]);
    if (this.detailTab === 'profile') {
      p.kv('Situação', b.active ? 'Em atividade' : b.type === 'residential' ? 'Residencial' : 'Instalação disponível');
      p.note('Proprietário da empresa'); if (b.ownerId) p.button(name(city.economy.citizen(b.ownerId)?.entity), () => this.openCitizen(b.ownerId)); else p.note('Serviço público / sem empresa');
      p.kv('Caixa operacional', money(b.balance)); p.kv('Receita acumulada', money(b.totalRevenue)); p.kv('Despesas acumuladas', money(b.totalExpenses)); p.kv('Dividendos pagos', money(b.dividends));
      p.kv('Equipe', `${b.workers.length}/${b.jobs}`); p.kv('Desnível do terreno', Number(b.terrain.variation).toFixed(2));
      p.heading('MOVIMENTAÇÕES RECENTES'); this.transactions(p, b.accountId);
    } else if (this.detailTab === 'stock') {
      p.heading('INVENTÁRIO REAL'); for (const [id, spec] of Object.entries(GOODS)) p.kv(spec.label, b.inventory?.[id] || 0);
      if (b.crop) { p.heading(`CULTIVO / ${CROPS[b.crop].label}`); p.kv('Sementes', b.seedStock); for (const [i, f] of b.fields.entries()) { p.note(`Talhão ${i + 1}: ${f.plantedAt === null ? 'aguarda plantio' : 'em crescimento'}`); p.meter('Trabalho', f.labor / 120 * 100); p.meter('Crescimento', f.plantedAt === null ? 0 : (city.minute - f.plantedAt) / CROPS[b.crop].grow * 100); } }
      if (b.type === 'bakery') p.note('Receita: trigo transformado em pão pelo trabalho da equipe.');
      p.heading('INSUMOS PROCURADOS'); const missing = Object.entries(b.inputDemand || {}).filter(([, qty]) => qty > 0);
      for (const [id, qty] of missing) p.kv(GOODS[id].label, qty); if (!missing.length) p.note('Nenhum insumo pendente.');
      p.kv('Ocorrências de falta', b.stockouts);
    } else if (this.detailTab === 'staff') {
      p.kv('Postos ocupados', `${b.workers.length}/${b.jobs}`); p.kv('Salário base/hora', money(b.wage * 60));
      p.note('Contratação: habilidade 75%, confiança 15%, afeto 10%. O salário também considera habilidade.');
      for (const id of b.workers) { const c = city.economy.citizen(id); if (!c) continue; p.button(name(c.entity), () => this.openCitizen(id)); p.meter(SKILLS[JOB_SKILL[b.type]] || 'Habilidade', c.skills[JOB_SKILL[b.type]] || 0, C.cyan); }
      if (!b.workers.length) p.note('Nenhum funcionário contratado.');
    } else {
      p.note('Cada célula tem dono, ocupação, preço e contrato independentes. A prefeitura sempre vende seus espaços; nunca os aluga.');
      let u = city.units.get(this.unitId); if (u?.buildingId !== b.id) u = b.units[0]; this.unitId = u?.id || null;
      if (u) { p.heading(`CÉLULA ${u.x},${u.y},${u.z}`); p.kv('Proprietário', city.accountName(u.ownerId)); this.accountLink(p, u.ownerId);
        p.kv('Ocupante', u.tenantId || u.occupantId ? city.accountName(u.tenantId || u.occupantId) : 'Livre'); this.accountLink(p, u.tenantId || u.occupantId);
        p.kv('Venda', money(u.price)); p.kv('Aluguel/dia', u.ownerId === 'treasury' ? 'Prefeitura não aluga' : money(u.rent)); p.kv('Em atraso', money(u.arrears)); p.kv('Anúncio', u.forSale ? 'À venda' : u.forRent ? 'Para alugar' : 'Uso próprio / ocupado'); }
      p.heading(`TODOS OS ESPAÇOS / ${b.units.length}`);
      for (const cell of b.units) p.card(`X${cell.x} Y${cell.y} Z${cell.z} | ${cell.ownerId === 'treasury' ? 'Público' : 'Privado'}`, `${cell.tenantId || cell.occupantId ? 'Ocupado' : 'Livre'} | ${money(cell.price)}`, () => { this.unitId = cell.id; }, cell.id === u?.id);
    }
  }
  accountLink(p, id) { if (String(id).startsWith('citizen:')) p.button('ABRIR FICHA DO MORADOR', () => this.openCitizen(Number(id.split(':')[1]))); }
  transactions(p, account) {
    const rows = this.city.ledger.filter(l => l.from === account || l.to === account).slice(-18).reverse();
    for (const l of rows) { p.note(`${stamp(l.minute)} | ${l.reason}`); p.note(`${l.to === account ? '+' : '-'}${money(l.amount)} | ${this.city.accountName(l.to === account ? l.from : l.to)}`, l.to === account ? C.green : C.red); }
    if (!rows.length) p.note('Nenhuma movimentação registrada.');
  }
  demands(p) {
    p.heading('DEMANDAS E OPORTUNIDADES'); p.note('Os investidores respondem à demanda e aos insumos que faltam na cadeia produtiva.');
    for (const d of this.city.economy.demands.filter(d => d.score > 0)) {
      p.heading(`${BUILDING_TYPES[d.type].label}${d.crop ? ' / ' + CROPS[d.crop].label : ''}`, C.cyan);
      p.kv('Índice de demanda', Math.round(d.score)); p.note(d.reason);
      if (d.required !== undefined) { p.kv('Necessidade/dia', d.required); p.kv('Capacidade estimada/dia', d.supply); p.kv('Estoque', d.stock); }
    }
  }
  content(p) {
    const city = this.city, s = city.stats();
    if (this.notice) p.note(this.notice, C.red);
    if (this.tab === 'city') {
      p.heading('PANORAMA DA SIMULAÇÃO'); p.note('Acompanhe os habitantes e as decisões autônomas da cidade.');
      p.metrics([['HABITANTES', s.population], ['FELICIDADE', `${Math.round(s.happiness)}%`], ['EMPREGADOS', s.employed], ['SEM MORADIA', s.homeless], ['EMPRESAS', s.businesses], ['CRIANÇAS', s.children], ['CASAIS', s.couples], ['AMIZADES', s.friendships], ['CÉLULAS', s.units], ['OCUPADAS', s.occupied]]);
      p.heading('ATENÇÃO DA CIDADE');
      const hungry = city.citizens.filter(c => c.needs.food < 30), unemployed = city.citizens.filter(c => city.society.isAdult(c) && !c.jobId && !c.businessIds.length);
      p.note(`${hungry.length} pessoas com alimentação abaixo de 30%`, hungry.length ? C.red : C.green); p.note(`${unemployed.length} adultos sem trabalho ou empresa`, unemployed.length ? C.gold : C.green);
      p.button('ACOMPANHAR PRODUÇÃO E DEMANDA', () => this.navigate('production'));
      p.heading('ACONTECIMENTOS RECENTES'); this.events(p, city.events.filter(e => this.matches(e.message)).slice(0, 10));
    } else if (this.tab === 'government') {
      p.heading('GOVERNO AUTÔNOMO'); const mayor = city.economy.citizen(city.economy.mayorId);
      if (mayor) p.button(`PREFEITO: ${name(mayor.entity)}`, () => this.openCitizen(mayor.id));
      p.note('O prefeito é um cidadão. O caixa municipal é separado da conta pessoal dele.');
      p.kv('Tesouro municipal', money(city.treasury)); p.kv('Alíquota de impostos', `${Math.round(city.taxRate * 100)}%`);
      const units = [...city.units.values()].filter(u => u.ownerId === 'treasury'); p.kv('Espaços públicos', units.length); p.kv('Espaços públicos à venda', units.filter(u => u.forSale).length);
      p.note('Política imobiliária: a prefeitura vende; os proprietários privados decidem se vendem ou alugam.', C.gold);
      p.heading('MOVIMENTAÇÕES DO TESOURO'); this.transactions(p, 'treasury');
      p.heading('GERAÇÃO DE TERRENO'); p.note(`Mapa atual: semente ${city.world.seed ?? city.initialSeed} / ${WORLD_PRESETS[city.world.preset]?.label || 'Natural'}. Construções acompanham o relevo.`);
      p.note('Semente do próximo mapa');
      // Keep seed editor reachable even when its content scrolls out of the viewport.
      const iy = p.y; p.space(34);
      if (iy >= p.top && iy + 28 <= p.bottom) this.inputAt(this.seed, p.x, iy, p.w);
      p.button(`PAISAGEM: ${WORLD_PRESETS[this.terrain].label}`, () => { const keys = Object.keys(WORLD_PRESETS); this.terrain = keys[(keys.indexOf(this.terrain) + 1) % keys.length]; });
      p.note('Gerar terreno reinicia a simulação e descarta a cidade atual.', C.red);
      p.button('GERAR COM ESTA SEMENTE', () => { if (this.seed.reportValidity()) this.startWorld(Number(this.seed.value), this.terrain); });
      p.button('GERAR TERRENO ALEATÓRIO', () => this.startWorld(randomWorldSeed(), this.terrain));
    } else if (this.tab === 'production') {
      p.heading('CADEIA DE ABASTECIMENTO'); p.note('Fazendas > mercados e hortifrutis > refeições. Trigo > padarias > pão. Cada refeição consome 3 unidades. Empresas negociam somente quando há conexão por terra.');
      p.heading('PRODUÇÃO / CONSUMO / ESTOQUE'); p.note('Totais acumulados da cidade. Consumo inclui insumos de transformação.');
      for (const [g, spec] of Object.entries(GOODS)) { const stock = city.buildings.reduce((n, b) => n + (!b.entity.destroyed ? b.inventory?.[g] || 0 : 0), 0); p.kv(spec.label, `${city.economy.produced[g]} / ${city.economy.consumed[g]} / ${stock}`); }
      p.kv('Tentativas de refeição sem oferta', city.economy.failedMeals);
      this.demands(p);
      p.heading('MOVIMENTAÇÕES DE MERCADORIAS');
      const kinds = { trade: 'Comércio', consumption: 'Consumo', sowing: 'Plantio', harvest: 'Colheita', 'recipe-input': 'Insumo de receita', baking: 'Panificação' };
      for (const l of city.economy.goodsLedger.slice(-20).reverse()) {
        p.note(`${stamp(l.minute)} | ${GOODS[l.good]?.label || l.good} x${l.quantity} | ${kinds[l.kind] || l.kind}`, C.cyan);
        const origin = city.building(l.from)?.entity, destination = city.building(l.to)?.entity || city.society.citizen(l.to)?.entity;
        p.note(`${origin ? name(origin) : 'Produção'} > ${destination ? name(destination) : 'Uso na produção'}`);
      }
    } else if (this.tab === 'log') this.log(p);
  }
  events(p, events) {
    for (const e of events) { p.note(`${stamp(e.minute)} / ${EVENT_CATEGORIES[e.category] || e.category}`, C.gold); p.note(e.message); for (const id of e.citizenIds || []) { const c = this.city.society.citizen(id); if (c) p.button(name(c.entity), () => this.openCitizen(id)); } p.space(8); }
    if (!events.length) p.note('Nenhum acontecimento encontrado.');
  }
  log(p) {
    p.heading('HISTÓRICO GERAL');
    p.button(`ASSUNTO: ${EVENT_CATEGORIES[this.logCategory] || 'Todos'}`, () => { const keys = ['all', ...Object.keys(EVENT_CATEGORIES)]; this.logCategory = keys[(keys.indexOf(this.logCategory) + 1) % keys.length]; this.resetScroll(); });
    p.button(this.logCitizenId ? `PESSOA: ${name(this.city.society.citizen(this.logCitizenId)?.entity)} / LIMPAR` : 'PESSOAS: TODA A CIDADE', () => { this.logCitizenId = null; this.resetScroll(); });
    p.button(this.logLive ? 'CONGELAR HISTÓRICO' : 'RETOMAR AO VIVO', () => { this.logLive = !this.logLive; this.frozenEvents = this.logLive ? null : [...this.city.events]; });
    p.button('EXPORTAR REGISTROS EM JSON', () => this.exportLog());
    p.note(`${this.logLive ? 'Ao vivo' : 'Congelado; a simulação continua'} | ${this.city.events.length}/5000 registros retidos`);
    const rows = (this.logLive ? this.city.events : this.frozenEvents || []).filter(e => (this.logCategory === 'all' || this.logCategory === e.category) && (!this.logCitizenId || e.citizenIds.includes(this.logCitizenId)) && this.matches(e.message));
    p.kv('Resultados dos filtros', rows.length); this.events(p, rows.slice(0, this.logLimit)); if (rows.length > this.logLimit) p.button('CARREGAR MAIS REGISTROS', () => { this.logLimit += 80; });
  }
  exportLog() {
    const events = (this.logLive ? this.city.events : this.frozenEvents || []).filter(e => (this.logCategory === 'all' || this.logCategory === e.category) && (!this.logCitizenId || e.citizenIds.includes(this.logCitizenId)) && this.matches(e.message));
    const blob = new Blob([JSON.stringify({ version: 1, cityMinute: this.city.minute, rules: SOCIAL_RULES, events }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `suburban-historico-dia-${this.city.day}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  startWorld(seed, terrain) { const url = new URL(window.location.href); url.searchParams.set('seed', seed); url.searchParams.set('terrain', terrain); window.location.assign(url.href); }
}

/** Small flowing layout; offscreen rows are measured but never drawn or registered. */
class Page {
  constructor(ui, x, y, w, top, bottom) { Object.assign(this, { ui, x, y, w, top, bottom }); }
  space(h = 12) { this.y += h; }
  visible(h) { return this.y + h > this.top && this.y < this.bottom; }
  heading(value, color = C.gold) { this.space(12); this.note(String(value).toUpperCase(), color); this.space(4); }
  note(value, color = C.gray) {
    const max = Math.max(1, Math.floor(this.w / 8));
    for (const paragraph of String(value ?? '').split('\n')) {
      let line = '';
      for (let word of paragraph.split(' ')) {
        if (line.length + word.length + 1 > max && line) { this.line(line, color); line = ''; }
        while (word.length > max) { if (line) { this.line(line, color); line = ''; } this.line(word.slice(0, max), color); word = word.slice(max); }
        line += (line ? ' ' : '') + word;
      }
      this.line(line, color);
    }
    this.space(5);
  }
  line(value, color) { if (this.visible(14)) this.ui.text(value, this.x, this.y, color); this.y += 14; }
  kv(label, value) {
    if ((String(label).length + String(value).length + 3) * 8 > this.w) { this.note(label); this.note(value, '#ffffff'); return; }
    if (this.visible(22)) { this.ui.text(label, this.x, this.y, C.gray); this.ui.text(value, this.x + this.w - String(value).length * 8, this.y, '#ffffff'); } this.y += 22;
  }
  button(label, click, selected = false) { if (this.visible(28)) this.ui.button(this.x, this.y, this.w, 28, trim(label, this.w - 32), click, { selected }); this.y += 34; }
  buttons(items) {
    let dx = 0;
    for (const item of items) { const w = Math.min(this.w, item.label.length * 8 + 28);
      if (dx + w > this.w) { dx = 0; this.y += 32; }
      if (this.visible(26)) this.ui.button(this.x + dx, this.y, w, 26, trim(item.label, w - 28), item.click, { selected: item.selected });
      dx += w + 4;
    }
    this.y += 34;
  }
  card(title, subtitle, click, selected) { this.button(title, click, selected); this.note(subtitle, selected ? C.gold : C.gray); this.space(3); }
  meter(label, value, color) { this.note(label); if (this.visible(20)) canvasBar(this.ui, this.x, this.y, this.w, 20, Math.max(0, Math.min(100, value || 0)), 100, '', color || (value < 30 ? C.red : value < 65 ? C.gold : C.green)); this.y += 29; }
  metrics(items) {
    const cols = this.w >= 440 ? 3 : 2, gap = 8, cw = Math.floor((this.w - gap * (cols - 1)) / cols);
    for (let i = 0; i < items.length; i += cols) { if (this.visible(62)) for (let j = 0; j < cols && i + j < items.length; j++) { const [label, value] = items[i + j], x = this.x + j * (cw + gap); canvasBox(this.ui, x, this.y, cw, 62); this.ui.text(trim(label, cw - 16), x + 8, this.y + 10, C.gray); this.ui.text(trim(value, (cw - 16) / 2), x + 8, this.y + 31, C.gold, 2); } this.y += 70; }
  }
}
