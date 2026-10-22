import { SKILLS, CROPS, GOODS, JOB_SKILL } from './city_economy.js';
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
      <nav aria-label="Painéis">${[['city', 'Cidade'], ['people', 'Cidadãos'], ['buildings', 'Imóveis'], ['economy', 'Economia'], ['log', 'Histórico']].map(([id, label]) => `<button data-tab="${id}" class="${this.tab === id ? 'active' : ''}">${label}</button>`).join('')}</nav>
      <div class="city-content">${this.notice ? `<p class="city-notice" role="status">${escape(this.notice)}</p>` : ''}${this.content(stats)}</div>
      <footer>1 célula = 1×1×1 · Aluguéis por dia<br>Espaço pausa · +/− velocidade · F3 2D/3D</footer>`;
    this.element.querySelector('.city-content').scrollTop = scroll;
  }
  content(s) {
    const city = this.city;
    if (this.tab === 'city') return `<h2>Uma cidade, muitas vidas</h2><p class="muted">Cada pessoa tem saldo, emprego, moradia e uma rotina própria.</p><div class="city-metrics">${[['Bem-estar', s.happiness + '%'], ['Empregados', `${s.employed}/${s.population}`], ['Sem moradia', s.homeless], ['Vagas totais', s.jobs], ['Espaços', s.units], ['Ocupados', s.occupied], ['Amizades', s.friendships], ['Casais', s.couples], ['Crianças', s.children], ['Nascimentos', s.births]].map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>
      ${this.governmentSummary()}${this.worldControls()}<h2>Economia local</h2><p>A prefeitura vende imóveis e nunca cobra aluguel. Proprietários privados decidem entre ocupar, vender ou alugar. Os empresários investem e contratam conforme demanda, habilidades e vínculos.</p><p class="muted">Salários geram imposto de ${Math.round(city.taxRate * 100)}%. Toda a comida das lojas vem de fazendas e padarias locais. Cada morador trouxe três refeições para a fase inicial.</p><h2>Acontecendo agora</h2><ol class="city-events">${city.events.slice(0, 12).map(e => `<li><time>D${Math.floor(e.minute / 1440) + 1} ${String(Math.floor(e.minute % 1440 / 60)).padStart(2, '0')}:${String(e.minute % 60).padStart(2, '0')}</time>${escape(e.message)}</li>`).join('')}</ol>`;
    if (this.tab === 'economy') return this.economyContent();
    if (this.tab === 'log') return this.logContent();
    if (this.tab === 'build') return `<h2>Expandir a cidade</h2><p class="muted">Escolha as dimensões ou deixe o gerador variar o prédio. Depois escolha um lote no relevo natural.</p><form id="city-build"><label>Uso<select id="build-type" name="type">${Object.entries(BUILDING_TYPES).map(([id, s]) => `<option value="${id}">${s.label}</option>`).join('')}</select></label><div class="city-dimensions">${[['width', 'Largura', 8], ['depth', 'Profund.', 8], ['floors', 'Altura', 12]].map(([id, label, max]) => `<label>${label}<input id="build-${id}" name="${id}" type="number" min="1" max="${max}" placeholder="Auto"></label>`).join('')}</div><p>Obra: R$ 3,50 por célula. Serviços precisam de R$ 700,00 de capital inicial.</p><button class="primary" type="submit">${this.pendingBuild ? 'Alterar construção' : 'Escolher terreno'}</button></form>${this.pendingBuild ? '<p class="city-notice">Clique em um lote acessível no mapa.</p><button data-cancel>Cancelar construção</button>' : ''}<h2>Como ocupar</h2><p>Prédios cabem em planícies, praias e colinas suaves. Fundações e degraus compensam pequenos desníveis sem alterar o solo. Encostas íngremes, água e ruas são preservadas. O acesso é ligado à cidade por caminhos que seguem o terreno.</p>`;
    if (this.tab === 'people') {
      const c = this.selected?.properties.citizen;
      return `${c && !c.entity.destroyed ? `<div class="city-detail"><h2>${escape(c.entity.properties.name)}</h2><p class="city-status">${escape(c.action)}</p>${this.personEconomy(c)}${this.personSocial(c)}<div class="city-kv"><span>Saldo</span><strong>${money(c.balance)}</strong><span>Salário hoje</span><strong>${money(c.salaryToday)}</strong><span>Trabalho</span><strong>${escape(city.building(c.jobId)?.entity.properties.name || (c.businessIds.length ? 'Empresário' : city.society.isAdult(c) ? 'Desempregado' : 'Criança — sem trabalho'))}</strong><span>Moradia</span><strong>${c.homeUnitId || 'Sem moradia'}</strong></div><h3>Necessidades</h3>${Object.entries(c.needs).map(([id, value]) => `<div class="city-need"><span>${NEED_LABELS[id]}</span><meter min="0" max="100" low="30" high="65" optimum="100" value="${value}">${Math.round(value)}%</meter><small>${Math.round(value)}%</small></div>`).join('')}<button data-focus="${c.id}">Localizar cidadão</button></div>` : '<h2>Cidadãos</h2><p class="muted">Selecione alguém para acompanhar suas necessidades.</p>'}<div class="city-list">${city.citizens.map(c => `<button data-select="${c.id}" class="${this.selected?.id === c.id ? 'active' : ''}"><span>${escape(c.entity.properties.name)}<small>${escape(c.action)}</small></span><strong>${money(c.balance)}</strong></button>`).join('')}</div>`;
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
  governmentSummary() {
    const mayor = this.city.economy.citizen(this.city.economy.mayorId);
    return `<h2>Governo autônomo</h2><p>${mayor ? `<button data-select="${mayor.id}">Prefeito: ${escape(mayor.entity.properties.name)}</button>` : 'Prefeitura sem titular'}</p><p class="muted">O prefeito é um cidadão com rotina, habilidades e vínculos. O caixa municipal é separado de seu dinheiro pessoal.</p>`;
  }
  economyContent() {
    const economy = this.city.economy;
    return `${this.governmentSummary()}<h2>Economia em observação</h2><p>${this.city.stats().wealthy} ricos · ${economy.businesses.length} empresas privadas. Moradia, investimentos, contratos e contratações são decididos pelos cidadãos.</p><h3>Oportunidades e gargalos</h3><div class="relationship-list">${economy.demands.filter(d => d.score > 0).slice(0, 12).map(d => `<div><strong>${BUILDING_TYPES[d.type].label}${d.crop ? ` · ${CROPS[d.crop].label}` : ''}</strong><small>Demanda ${Math.round(d.score)} · ${escape(d.reason)}</small>${d.required !== undefined ? `<span>Necessidade/dia ${d.required} · capacidade estimada ${d.supply} · estoque ${d.stock}</span>` : ''}</div>`).join('') || '<p>Capacidade atual atende à demanda estimada.</p>'}</div><h3>Cadeia de alimentos</h3><p class="muted">Fazendas → mercados e hortifrutis. Trigo → padarias → pão e mercados. Transferências só acontecem entre empresas conectadas por terra. Uma refeição consome três unidades de alimento.</p><div class="city-kv">${Object.entries(GOODS).map(([good, spec]) => `<span>${spec.label}</span><strong>${economy.produced[good]} produzidos · ${economy.consumed[good]} usados</strong>`).join('')}</div><h3>Empresas</h3><div class="city-list">${economy.businesses.map(b => `<button data-select="${b.id}"><span>${escape(b.entity.properties.name)}${b.crop ? ` · ${CROPS[b.crop].label}` : ''}<small>${escape(economy.citizen(b.ownerId)?.entity.properties.name || 'Sem proprietário')} · ${b.workers.length}/${b.jobs} funcionários</small></span><strong>${money(b.balance)}</strong></button>`).join('')}</div>`;
  }
  personEconomy(c) {
    return `<h3>Perfil econômico</h3><div class="city-kv"><span>Perfil</span><strong>${c.wealthTier === 'wealthy' ? 'Rico / investidor' : 'Trabalhador'}</strong><span>Papel</span><strong>${c.id === this.city.economy.mayorId ? 'Prefeito' : c.businessIds.length ? 'Empresário' : 'Morador'}</strong><span>Imóveis próprios</span><strong>${[...this.city.units.values()].filter(u => u.ownerId === c.accountId).length}</strong><span>Provisões da chegada</span><strong>${c.provisions} refeições</strong></div>${c.businessIds.length ? `<p>Empresas: ${c.businessIds.map(id => this.city.building(id)).filter(Boolean).map(b => `<button data-select="${b.id}">${escape(b.entity.properties.name)}</button>`).join(' ')}</p>` : ''}<h3>Habilidades — aprendizado pela prática</h3>${Object.entries(c.skills).map(([skill, value]) => `<div class="city-need"><span>${SKILLS[skill]}</span><meter min="0" max="100" value="${value}"></meter><small>${value.toFixed(1)}</small></div>`).join('')}`;
  }
  buildingDetail(b) {
    const city = this.city, economy = city.economy;
    let u = city.units.get(this.unitId);
    if (!u || u.buildingId !== b.id) u = b.units.find(u => !u.tenantId) || b.units[0];
    this.unitId = u.id;
    const owner = city.accounts.get(u.ownerId), tenant = city.accounts.get(u.tenantId || u.occupantId);
    const founder = economy.citizen(b.ownerId);
    return `<div class="city-detail"><h2>${escape(b.entity.properties.name)}</h2><p class="muted">${b.width}×${b.depth}×${b.floors} · ${b.units.length} espaços individuais · desnível ${b.terrain.variation.toFixed(2)}</p><div class="city-kv"><span>Operação</span><strong>${b.active ? 'Em atividade' : b.type === 'residential' ? 'Moradias' : 'Instalações à venda'}</strong><span>Empresa de</span><strong>${founder ? `<button data-select="${founder.id}">${escape(founder.entity.properties.name)}</button>` : 'Serviço público / sem empresa'}</strong><span>Funcionários</span><strong>${b.workers.length}/${b.jobs}</strong><span>Caixa</span><strong>${money(b.balance)}</strong><span>Receitas acumuladas</span><strong>${money(b.totalRevenue)}</strong><span>Despesas acumuladas</span><strong>${money(b.totalExpenses)}</strong>${b.jobs ? `<span>Salário base/hora</span><strong>${money(b.wage * 60)} + habilidade</strong>` : ''}${b.crop ? `<span>Cultivo</span><strong>${CROPS[b.crop].label}</strong><span>Sementes</span><strong>${b.seedStock}</strong>` : ''}</div>${b.crop ? `<p class="muted">${b.fields.map((f, i) => `Talhão ${i + 1}: ${f.plantedAt === null ? 'aguarda plantio' : `${Math.round(f.labor)}/120 de trabalho · ${Math.min(CROPS[b.crop].grow, city.minute - f.plantedAt)}/${CROPS[b.crop].grow} min de crescimento`}`).join('<br>')}</p>` : ''}${b.active && b.inventory ? `<h3>Estoque real</h3><div class="city-kv">${Object.entries(GOODS).map(([g, spec]) => `<span>${spec.label}</span><strong>${b.inventory[g]}</strong>`).join('')}</div>` : ''}${b.inputDemand && Object.keys(b.inputDemand).length ? `<h3>Insumos procurados</h3><p>${Object.entries(b.inputDemand).filter(([, qty]) => qty > 0).map(([g, qty]) => `${GOODS[g].label}: ${qty}`).join(' · ') || 'Estoque suficiente'}</p>` : ''}${b.workers.length ? `<h3>Equipe</h3><div class="city-list">${b.workers.map(id => economy.citizen(id)).filter(Boolean).map(c => `<button data-select="${c.id}">${escape(c.entity.properties.name)}<small>${SKILLS[JOB_SKILL[b.type]]}: ${(c.skills[JOB_SKILL[b.type]] || 0).toFixed(1)}</small></button>`).join('')}</div>` : ''}<button data-focus="${b.id}">Localizar prédio</button><h3>Propriedade de cada espaço</h3><label>Célula<select id="city-unit">${b.units.map(s => `<option value="${s.id}" ${s.id === u.id ? 'selected' : ''}>X${s.x} Y${s.y} Z${s.z} · ${s.tenantId || s.occupantId ? 'Ocupado' : 'Livre'} · ${s.ownerId === 'treasury' ? 'Público' : 'Privado'}</option>`).join('')}</select></label><div class="city-kv"><span>Proprietário</span><strong>${escape(owner?.entity?.properties.name || owner?.name || 'Prefeitura')}</strong><span>Ocupante</span><strong>${escape(tenant?.entity?.properties.name || 'Livre')}</strong><span>Aluguel/dia</span><strong>${u.ownerId === 'treasury' ? 'Prefeitura não aluga' : money(u.rent)}</strong><span>Preço de venda</span><strong>${money(u.price)}</strong><span>Anúncio</span><strong>${u.forSale ? 'À venda' : u.forRent ? 'Para alugar' : 'Uso próprio / ocupado'}</strong><span>Em atraso</span><strong>${money(u.arrears)}</strong></div><p class="muted">O proprietário decide o anúncio e o destino do imóvel. A prefeitura mantém seus espaços à venda e não celebra aluguéis.</p></div>`;
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
