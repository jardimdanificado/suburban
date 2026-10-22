import { WORLD_PRESETS, randomWorldSeed } from './world_settings.js';
import { EVENT_CATEGORIES, relationLabel, SOCIAL_RULES } from './city_society.js';
import { BUILDING_TYPES, NEED_LABELS } from './city_simulation.js';
export const money = value => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export class CityUI {
  constructor({ city, root, select, camera }) {
    this.city = city; this.select = select; this.camera = camera;
    this.tab = 'city'; this.selected = null; this.unitId = null; this.buyerId = city.citizens[0]?.id; this.visible = true;
    this.logCategory = 'all'; this.logCitizenId = null; this.logQuery = ''; this.logLimit = 60; this.logLive = true; this.logBeforeId = Infinity;
    this.lastRefresh = -Infinity; this.pendingBuild = null; this.notice = '';
    this.element = document.createElement('aside');
    this.element.className = 'ui-panel city-panel';
    this.element.setAttribute('aria-label', 'Gestão da cidade');
    root.append(this.element);
    this.element.addEventListener('click', event => this.click(event));
    this.element.addEventListener('change', event => {
      if (event.target.id === 'log-category') { this.logCategory = event.target.value; this.logLimit = 60; event.target.blur(); this.refresh(); }
      if (event.target.id === 'log-citizen') { this.logCitizenId = event.target.value ? Number(event.target.value) : null; this.logLimit = 60; event.target.blur(); this.refresh(); }
      if (event.target.id === 'city-buyer') this.buyerId = Number(event.target.value);
      if (event.target.id === 'city-unit') { this.unitId = event.target.value; this.refresh(); }
    });
    this.element.addEventListener('submit', event => this.submit(event));
    this.refresh();
  }
  setSelection(entity, unitId = null) {
    this.selected = entity; this.unitId = unitId;
    if (entity?.properties.citizen) { this.tab = 'people'; this.buyerId = entity.id; }
    if (entity?.properties.cityBuilding) this.tab = 'buildings';
    this.refresh();
  }
  toggle() { this.visible = !this.visible; this.element.hidden = !this.visible; }
  refresh(now = performance.now()) {
    this.lastRefresh = now;
    const city = this.city, stats = city.stats();
    const scroll = this.element.querySelector('.city-content')?.scrollTop || 0;
    const activeId = this.element.contains(document.activeElement) ? document.activeElement.id : null;
    if (activeId && /^(build-|unit-|world-|city-buyer)/.test(activeId)) return;
    this.element.innerHTML = `<header><span class="city-eyebrow">SIMULAÇÃO URBANA</span><h1>SUBURBAN<span class="city-live">● AO VIVO</span></h1><div class="city-summary"><span>${stats.population} habitantes</span><strong>${money(stats.treasury)}</strong></div></header>
      <nav aria-label="Painéis">${[['city', 'Cidade'], ['people', 'Cidadãos'], ['buildings', 'Imóveis'], ['build', 'Construir'], ['log', 'Histórico']].map(([id, label]) => `<button data-tab="${id}" class="${this.tab === id ? 'active' : ''}">${label}</button>`).join('')}</nav>
      <div class="city-content">${this.notice ? `<p class="city-notice" role="status">${escape(this.notice)}</p>` : ''}${this.content(stats)}</div>
      <footer>1 célula = 1×1×1 · Aluguéis por dia<br>Espaço pausa · +/− velocidade · F3 2D/3D</footer>`;
    this.element.querySelector('.city-content').scrollTop = scroll;
  }
  content(s) {
    const city = this.city;
    if (this.tab === 'city') return `<h2>Uma cidade, muitas vidas</h2><p class="muted">Cada pessoa tem saldo, emprego, moradia e uma rotina própria.</p><div class="city-metrics">${[['Bem-estar', s.happiness + '%'], ['Empregados', `${s.employed}/${s.population}`], ['Sem moradia', s.homeless], ['Vagas totais', s.jobs], ['Espaços', s.units], ['Ocupados', s.occupied], ['Amizades', s.friendships], ['Casais', s.couples], ['Crianças', s.children], ['Nascimentos', s.births]].map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>
      ${this.worldControls()}<h2>Economia local</h2><p>Salários geram imposto de ${Math.round(city.taxRate * 100)}%. A prefeitura recebe aluguéis dos espaços públicos e financia os serviços.</p><p class="muted">Os cidadãos alugam moradia automaticamente e podem comprar o próprio espaço quando têm reservas. Três dias de aluguel em atraso encerram o contrato.</p><h2>Acontecendo agora</h2><ol class="city-events">${city.events.slice(0, 12).map(e => `<li><time>D${Math.floor(e.minute / 1440) + 1} ${String(Math.floor(e.minute % 1440 / 60)).padStart(2, '0')}:${String(e.minute % 60).padStart(2, '0')}</time>${escape(e.message)}</li>`).join('')}</ol>`;
    if (this.tab === 'log') return this.logContent();
    if (this.tab === 'build') return `<h2>Expandir a cidade</h2><p class="muted">Escolha as dimensões ou deixe o gerador variar o prédio. Depois escolha um lote no relevo natural.</p><form id="city-build"><label>Uso<select id="build-type" name="type">${Object.entries(BUILDING_TYPES).map(([id, s]) => `<option value="${id}">${s.label}</option>`).join('')}</select></label><div class="city-dimensions">${[['width', 'Largura', 8], ['depth', 'Profund.', 8], ['floors', 'Altura', 12]].map(([id, label, max]) => `<label>${label}<input id="build-${id}" name="${id}" type="number" min="1" max="${max}" placeholder="Auto"></label>`).join('')}</div><p>Obra: R$ 3,50 por célula. Serviços precisam de R$ 700,00 de capital inicial.</p><button class="primary" type="submit">${this.pendingBuild ? 'Alterar construção' : 'Escolher terreno'}</button></form>${this.pendingBuild ? '<p class="city-notice">Clique em um lote acessível no mapa.</p><button data-cancel>Cancelar construção</button>' : ''}<h2>Como ocupar</h2><p>Prédios cabem em planícies, praias e colinas suaves. Fundações e degraus compensam pequenos desníveis sem alterar o solo. Encostas íngremes, água e ruas são preservadas. O acesso é ligado à cidade por caminhos que seguem o terreno.</p>`;
    if (this.tab === 'people') {
      const c = this.selected?.properties.citizen;
      return `${c && !c.entity.destroyed ? `<div class="city-detail"><h2>${escape(c.entity.properties.name)}</h2><p class="city-status">${escape(c.action)}</p>${this.personSocial(c)}<div class="city-kv"><span>Saldo</span><strong>${money(c.balance)}</strong><span>Salário hoje</span><strong>${money(c.salaryToday)}</strong><span>Trabalho</span><strong>${escape(city.building(c.jobId)?.entity.properties.name || (city.society.isAdult(c) ? 'Desempregado' : 'Criança — sem trabalho'))}</strong><span>Moradia</span><strong>${c.homeUnitId || 'Sem moradia'}</strong></div><h3>Necessidades</h3>${Object.entries(c.needs).map(([id, value]) => `<div class="city-need"><span>${NEED_LABELS[id]}</span><meter min="0" max="100" low="30" high="65" optimum="100" value="${value}">${Math.round(value)}%</meter><small>${Math.round(value)}%</small></div>`).join('')}<button data-focus="${c.id}">Localizar cidadão</button></div>` : '<h2>Cidadãos</h2><p class="muted">Selecione alguém para acompanhar suas necessidades.</p>'}<div class="city-list">${city.citizens.map(c => `<button data-select="${c.id}" class="${this.selected?.id === c.id ? 'active' : ''}"><span>${escape(c.entity.properties.name)}<small>${escape(c.action)}</small></span><strong>${money(c.balance)}</strong></button>`).join('')}</div>`;
    }
    const b = this.selected?.properties.cityBuilding;
    return `${b && !b.entity.destroyed ? this.buildingDetail(b) : '<h2>Patrimônio da cidade</h2><p class="muted">Selecione um prédio para ver cada espaço, negociar e definir os preços.</p>'}<div class="city-list">${city.buildings.map(b => `<button data-select="${b.id}" class="${this.selected?.id === b.id ? 'active' : ''}"><span>${escape(b.entity.properties.name)}<small>${b.width}×${b.depth}×${b.floors} · ${b.units.filter(u => u.tenantId).length}/${b.units.length} ocupados</small></span><span class="building-dot" style="background:#${b.color.toString(16)}"></span></button>`).join('')}</div>`;
  }
  worldControls() {
    const world = this.city.world;
    return `<h2>Terreno da cidade</h2><p class="muted">Semente <strong>${world.seed ?? this.city.initialSeed}</strong> · ${WORLD_PRESETS[world.preset]?.label || 'Terreno natural'}. Ruas e lotes acompanham o relevo, sem terraplanagem.</p><form id="city-world"><label>Paisagem<select name="terrain" id="world-terrain">${Object.entries(WORLD_PRESETS).map(([key, preset]) => `<option value="${key}" ${world.preset === key ? 'selected' : ''}>${preset.label}</option>`).join('')}</select></label><label>Semente<input id="world-seed" name="seed" type="number" min="1" max="2147483647" value="${world.seed ?? this.city.initialSeed}" required></label><div class="city-buttons"><button type="submit">Gerar com semente</button><button type="button" data-random-world>Terreno aleatório</button></div><p class="muted">Gerar um terreno inicia uma nova partida. Use a mesma semente e paisagem para repetir o mapa.</p></form>`;
  }
  startWorld(seed, terrain) {
    const url = new URL(window.location.href); url.searchParams.set('seed', seed); url.searchParams.set('terrain', terrain);
    window.location.assign(url.href);
  }
  eventList(events) {
    return `<ol class="city-events">${events.map(e => `<li class="event-${e.category}"><time>D${Math.floor(e.minute / 1440) + 1} ${String(Math.floor(e.minute % 1440 / 60)).padStart(2, '0')}:${String(e.minute % 60).padStart(2, '0')} · ${EVENT_CATEGORIES[e.category] || 'Cidade'}</time>${escape(e.message)}${e.citizenIds.length ? `<div class="event-people">${e.citizenIds.map(id => { const c = this.city.society.citizen(id); return c ? `<button data-select="${id}">${escape(c.entity.properties.name)}</button>` : ''; }).join('')}</div>` : ''}</li>`).join('')}</ol>`;
  }
  logContent() {
    const events = this.city.getEvents({ category: this.logCategory, citizenId: this.logCitizenId, query: this.logQuery, beforeId: this.logLive ? Infinity : this.logBeforeId, limit: this.logLimit + 1 });
    return `<h2>Histórico geral</h2><p class="muted">Construções, dinheiro, contratos, conversas, vínculos e famílias. Até 5.000 acontecimentos ficam na memória desta partida. Salários são agrupados por pessoa a cada hora.</p><div class="log-filters"><label>Assunto<select id="log-category"><option value="all">Todos os assuntos</option>${Object.entries(EVENT_CATEGORIES).map(([id, label]) => `<option value="${id}" ${this.logCategory === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>Cidadão<select id="log-citizen"><option value="">Toda a cidade</option>${this.city.citizens.map(c => `<option value="${c.id}" ${this.logCitizenId === c.id ? 'selected' : ''}>${escape(c.entity.properties.name)}</option>`).join('')}</select></label></div><form id="city-log-search" class="log-search"><label>Buscar acontecimentos<input id="log-query" name="query" value="${escape(this.logQuery)}" placeholder="Nome, conversa, aluguel…" maxlength="120"></label><button type="submit">Buscar</button></form><div class="city-buttons"><button data-log-live>${this.logLive ? 'Congelar histórico' : 'Retomar atualização'}</button><button data-log-export>Exportar JSON</button></div><p class="muted">${this.logLive ? 'Atualização automática' : 'Histórico congelado; a cidade continua simulando'} · ${this.city.events.length} registros retidos</p>${events.length ? this.eventList(events.slice(0, this.logLimit)) : '<p>Nenhum acontecimento com esses filtros.</p>'}${events.length > this.logLimit ? '<button data-log-more>Mostrar mais</button>' : ''}`;
  }
  personSocial(c) {
    const society = this.city.society;
    const personLink = id => { const person = society.citizen(id); const archived = this.city.accounts.get(`citizen:${id}`); return person ? `<button data-select="${id}">${escape(person.entity.properties.name)}</button>` : escape(archived?.entity?.properties.name || 'Ausente'); };
    const partner = society.citizen(c.partnerId);
    const pregnancy = society.expecting.find(p => p.id === c.expectingId);
    const relations = society.relationsFor(c.id);
    return `<div class="person-family"><div class="city-kv"><span>Idade</span><strong>${society.age(c)} anos · ${society.isAdult(c) ? 'Adulto' : 'Criança'}</strong><span>Vínculo amoroso</span><strong>${partner ? personLink(partner.id) : 'Sem relacionamento'}</strong>${c.parentIds.length ? `<span>Filiação</span><strong>${c.parentIds.map(personLink).join(' ')}</strong>` : ''}${c.childIds.length ? `<span>Filhos</span><strong>${c.childIds.map(personLink).join(' ')}</strong>` : ''}${!society.isAdult(c) ? `<span>Responsável</span><strong>${c.guardianId ? personLink(c.guardianId) : 'Sem responsável'}</strong>` : ''}${pregnancy ? `<span>Família crescendo</span><strong>Filho esperado no dia ${Math.floor(pregnancy.dueAt / 1440) + 1}</strong>` : ''}</div><p class="muted">${society.isAdult(c) ? `${c.personality.wantsRomance ? 'Aberto a relacionamentos' : 'Prefere ficar solteiro'} · ${c.personality.wantsChildren ? 'Deseja ter filhos' : 'Não planeja filhos'}` : 'As despesas são pagas pelo responsável. Crianças pequenas precisam de cuidados em casa.'}</p><h3>Relações pessoais (${relations.length})</h3>${relations.length ? `<div class="relationship-list">${relations.slice(0, 12).map(r => { const id = r.a === c.id ? r.b : r.a; return `<div>${personLink(id)}<small>${relationLabel(r)} · ${r.conversations} conversas</small><span>Afeto ${Math.round(r.affection)} · Confiança ${Math.round(r.trust)} · Familiaridade ${Math.round(r.familiarity)}</span></div>`; }).join('')}</div>` : '<p class="muted">Ainda está conhecendo os vizinhos.</p>'}<button data-person-log="${c.id}">Ver histórico deste cidadão</button></div>`;
  }
  buildingDetail(b) {
    const city = this.city;
    let u = city.units.get(this.unitId);
    if (!u || u.buildingId !== b.id) u = b.units.find(u => !u.tenantId) || b.units[0];
    this.unitId = u.id;
    const owner = city.accounts.get(u.ownerId), tenant = city.accounts.get(u.tenantId);
    return `<div class="city-detail"><h2>${escape(b.entity.properties.name)}</h2><p class="muted">${b.width}×${b.depth}×${b.floors} · ${b.units.length} espaços individuais · desnível ${b.terrain.variation.toFixed(2)}</p><div class="city-kv"><span>Funcionários</span><strong>${b.workers.length}/${b.jobs}</strong><span>Caixa</span><strong>${money(b.balance)}</strong>${b.jobs ? `<span>Salário/hora</span><strong>${money(b.wage * 60)}</strong>` : ''}${b.type === 'market' ? `<span>Alimentos</span><strong>${Math.floor(b.stock)}</strong>` : ''}</div><button data-focus="${b.id}">Localizar prédio</button><h3>Negociar espaço 1×1×1</h3><label>Célula<select id="city-unit">${b.units.map(s => `<option value="${s.id}" ${s.id === u.id ? 'selected' : ''}>X${s.x} Y${s.y} Z${s.z} · ${s.tenantId ? 'Ocupado' : 'Livre'} · ${s.ownerId === 'treasury' ? 'Público' : 'Privado'}</option>`).join('')}</select></label><div class="city-kv"><span>Proprietário</span><strong>${escape(owner?.entity?.properties.name || owner?.name || 'Prefeitura')}</strong><span>Ocupante</span><strong>${escape(tenant?.entity?.properties.name || 'Livre')}</strong><span>Aluguel/dia</span><strong>${money(u.rent)}</strong><span>Venda</span><strong>${money(u.price)}</strong><span>Em atraso</span><strong>${money(u.arrears)}</strong></div><label>Negociar como<select id="city-buyer">${city.citizens.map(c => `<option value="${c.id}" ${c.id === this.buyerId ? 'selected' : ''}>${escape(c.entity.properties.name)} · ${money(c.balance)}</option>`).join('')}</select></label><div class="city-buttons"><button data-rent ${b.type !== 'residential' || u.tenantId || !u.forRent ? 'disabled' : ''}>Alugar</button><button data-buy ${!u.forSale ? 'disabled' : ''}>Comprar</button></div><p class="muted">A compra mantém o inquilino atual. O novo proprietário recebe os próximos aluguéis. Quem mora no próprio espaço não paga aluguel.</p><details><summary>Administrar anúncio</summary><form id="city-prices"><label>Aluguel por dia (R$)<input id="unit-rent" name="rent" type="number" min="0" step="0.01" value="${(u.rent / 100).toFixed(2)}" required></label><label>Preço de venda (R$)<input id="unit-price" name="price" type="number" min="0.01" step="0.01" value="${(u.price / 100).toFixed(2)}" required></label><label class="city-check"><input name="forSale" type="checkbox" ${u.forSale ? 'checked' : ''}> À venda</label><label class="city-check"><input name="forRent" type="checkbox" ${u.forRent ? 'checked' : ''}> Para alugar</label><button type="submit">Salvar anúncio</button></form></details></div>`;
  }
  click(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-random-world')) this.startWorld(randomWorldSeed(), this.element.querySelector('#world-terrain').value);
    if (button.hasAttribute('data-log-live')) { this.logLive = !this.logLive; this.logBeforeId = this.logLive ? Infinity : this.city.nextEventId; }
    if (button.hasAttribute('data-log-more')) this.logLimit += 60;
    if (button.dataset.personLog) { this.tab = 'log'; this.logCitizenId = Number(button.dataset.personLog); this.logCategory = 'all'; this.logQuery = ''; this.logLimit = 60; }
    if (button.hasAttribute('data-log-export')) {
      const blob = new Blob([JSON.stringify({ version: 1, cityMinute: this.city.minute, rules: SOCIAL_RULES, events: this.city.events }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `suburban-historico-dia-${this.city.day}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    if (button.dataset.tab) { this.tab = button.dataset.tab; this.notice = ''; }
    if (button.dataset.select) {
      const id = Number(button.dataset.select);
      this.select(this.city.citizens.find(c => c.id === id)?.entity || this.city.building(id)?.entity);
    }
    if (button.dataset.focus) {
      const id = Number(button.dataset.focus), entity = this.city.citizens.find(c => c.id === id)?.entity || this.city.building(id)?.entity;
      if (entity) this.camera(entity.x, entity.y);
    }
    if (button.hasAttribute('data-cancel')) { this.pendingBuild = null; this.notice = ''; }
    if (button.hasAttribute('data-buy') || button.hasAttribute('data-rent')) {
      const result = button.hasAttribute('data-buy') ? this.city.buyUnit(this.buyerId, this.unitId) : this.city.rentUnit(this.buyerId, this.unitId);
      this.notice = result ? 'Negociação concluída.' : this.city.lastError;
    }
    button.blur(); this.refresh();
  }
  submit(event) {
    event.preventDefault();
    const data = new FormData(event.target);
    if (event.target.id === 'city-world') { this.startWorld(Number(data.get('seed')), data.get('terrain')); return; }
    if (event.target.id === 'city-log-search') { this.logQuery = String(data.get('query') || ''); this.logLimit = 60; }
    else if (event.target.id === 'city-build') {
      this.pendingBuild = { type: data.get('type') };
      for (const field of ['width', 'depth', 'floors']) if (data.get(field)) this.pendingBuild[field] = Number(data.get(field));
      this.notice = 'Clique em terra firme para posicionar o prédio.';
    } else if (event.target.id === 'city-prices') {
      const result = this.city.listUnit(this.unitId, { rent: Math.round(Number(data.get('rent')) * 100), price: Math.round(Number(data.get('price')) * 100), forSale: data.has('forSale'), forRent: data.has('forRent') });
      this.notice = result ? 'Anúncio atualizado.' : this.city.lastError;
    }
    document.activeElement?.blur(); this.refresh();
  }
  placeAt(tile) {
    if (!this.pendingBuild || !tile) return false;
    const { type, ...dimensions } = this.pendingBuild;
    const b = this.city.addBuilding(type, tile.x, tile.y, dimensions);
    this.notice = b ? `${b.entity.properties.name} construído.` : this.city.lastError;
    if (b) { this.pendingBuild = null; this.city.assignHousingAndJobs(); this.select(b.entity); }
    this.refresh();
    return true;
  }
  update(now) {
    this.element.hidden = !this.visible;
    if (this.visible && now - this.lastRefresh > 700 && !this.element.contains(document.activeElement)) this.refresh(now);
  }
}
