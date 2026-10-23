import { SANITATION_RULES } from './city_sanitation.js';
import { inventoryUsed, inventoryFree, incomingItems } from './city_inventory.js';
import { MANAGEMENT_THEME as T, readableLabel, bevel } from './management_ui.js';
import { clipCanvasRegion } from './canvas_widgets.js';
import { UIPage as Page, UI_COLORS as C, fitText as trim } from './city_ui_widgets.js';
import { SKILLS, CROPS, GOODS, JOB_SKILL } from './city_economy.js';
import { WORLD_PRESETS, randomWorldSeed } from './world_settings.js';
import { EVENT_CATEGORIES, relationLabel, SOCIAL_RULES } from './city_society.js';
import { BUILDING_TYPES, NEED_LABELS } from './city_simulation.js';
export const money = value => ((value || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const TABS = [
  ['city', 'PANORAMA', 'CIDADE', 'A cidade em um olhar: habitantes, sustento e atividade.'],
  ['government', 'GOVERNO', 'CIDADE', 'Prefeito, patrimônio público e orçamento municipal.'],
  ['people', 'PESSOAS', 'HABITANTES', 'Rotinas, necessidades, famílias e condições de vida.'],
  ['land', 'TERRENOS', 'TERRITÓRIO', 'Terrenos, contratos e a expansão sobre o relevo.'],
  ['buildings', 'IMÓVEIS', 'TERRITÓRIO', 'Edifícios, moradias e seus espaços negociáveis.'],
  ['economy', 'EMPRESAS', 'ECONOMIA', 'Negócios, equipes e as finanças de quem produz.'],
  ['production', 'PRODUÇÃO', 'ECONOMIA', 'Estoques, consumo e oportunidades na cadeia produtiva.'],
  ['transport', 'TRANSPORTES', 'ECONOMIA', 'Cargas reais: da reserva à entrega.'],
  ['sanitation', 'SANEAMENTO', 'VIDA URBANA', 'Banheiros, serviços de limpeza e ciclo dos resíduos.'],
  ['log', 'HISTÓRICO', 'VIDA URBANA', 'Os acontecimentos e as decisões de cada pessoa.'],
];
const VIEWS = {
  city: [['overview', 'PANORAMA'], ['needs', 'NECESSIDADES'], ['activity', 'ATIVIDADE']],
  government: [['overview', 'GOVERNO'], ['contracts', 'CONTRATOS'], ['finance', 'TESOURO'], ['world', 'TERRENO']],
  land: [['plots', 'TERRENOS'], ['projects', 'OBRAS']],
  production: [['stocks', 'ESTOQUES'], ['demand', 'DEMANDAS'], ['flow', 'MOVIMENTAÇÕES']],
  transport: [['active', 'EM ANDAMENTO'], ['finished', 'ENCERRADOS']],
  sanitation: [['facilities', 'BANHEIROS'], ['cleaning', 'FAXINA'], ['waste', 'RESÍDUOS'], ['deaths', 'MORTES']],
};
const FILTERS = {
  people: [['all','TODOS'], ['homeless','SEM CASA'], ['unemployed','SEM TRABALHO'], ['critical','EM RISCO'], ['food','COM FOME'], ['children','CRIANÇAS']],
  buildings: [['all','TODOS'], ['residential','MORADIAS'], ['public','PÚBLICOS'], ['private','PRIVADOS']],
  economy: [['all','TODAS'], ['food','ALIMENTAÇÃO'], ['services','SERVIÇOS'], ['industry','INDÚSTRIA']],
  land: [['all','TODOS'], ['sale','À VENDA'], ['built','EDIFICADOS'], ['works','EM OBRAS']],
  sanitation: [['all','TODOS'], ['public','GRATUITOS'], ['paid','PAGOS'], ['private','PRIVADOS'], ['dirty','SUJOS']],
};
const stamp = minute => `D${Math.floor(minute / 1440) + 1} ${String(Math.floor(minute % 1440 / 60)).padStart(2, '0')}:${String(Math.floor(minute % 60)).padStart(2, '0')}`;
const name = entity => entity?.properties?.name || 'Ausente';
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Management windows for observing the city and navigating its records. */
export class CityUI {
  constructor({ city, root, select, camera, host = null }) {
    Object.assign(this, { city, select, camera, host, tab: 'city', selected: null, unitId: null, visible: true, expanded: false, notice: '' });
    this.scrolls = {}; this.zones = []; this.query = ''; this.detailTab = 'profile'; this.mobileDetail = false; this.logLimit = 80;
    this.logCategory = 'all'; this.logCitizenId = null; this.logLive = true;
    this.frozenEvents = null; this.views = {}; this.filters = {}; this.sorts = {}; this.history = []; this.menuOpen = false; this.helpOpen = {};
    this.element = document.createElement('div'); this.element.className = 'city-inputs ui-panel'; root.append(this.element);
    this.search = document.createElement('input'); this.search.type = 'search'; this.search.placeholder = 'Pesquisar...'; this.search.setAttribute('aria-label', 'Pesquisar no observatório');
    this.search.addEventListener('input', () => { this.query = this.search.value; this.logLimit = 80; this.resetScroll(); });
    this.search.addEventListener('keydown', e => { if (e.key === 'Escape') { this.search.blur(); e.stopPropagation(); } });
    this.seed = document.createElement('input'); this.seed.type = 'number'; this.seed.min = '1'; this.seed.max = '2147483647'; this.seed.value = city.world.seed ?? city.initialSeed; this.seed.setAttribute('aria-label', 'Semente do próximo terreno');
    this.filterInput=document.createElement('select');this.filterInput.setAttribute('aria-label','Filtrar registros');this.filterInput.addEventListener('change',()=>this.setFilter(this.filterInput.value));
    this.sortInput=document.createElement('select');this.sortInput.setAttribute('aria-label','Ordenar registros');this.sortInput.addEventListener('change',()=>{this.sorts[this.tab]=this.sortInput.value;this.resetScroll();});
    this.element.append(this.search,this.seed,this.filterInput,this.sortInput);
    this.terrain = city.world.preset || Object.keys(WORLD_PRESETS)[0];
  }
  resetScroll() { this.scrolls = {}; }
  remember() {
    this.history.push({ tab: this.tab, selected: this.selected, selectedPlotId: this.selectedPlotId, unitId: this.unitId, detailTab: this.detailTab, mobileDetail: this.mobileDetail, query: this.query, views: { ...this.views }, filters: { ...this.filters }, scrolls: { ...this.scrolls } });
    if (this.history.length > 40) this.history.shift();
  }
  back() {
    const state = this.history.pop(); if (!state) return;
    if (state.selected !== this.selected) { const trail=[...this.history]; this.select(state.selected,state.unitId); this.history=trail; }
    Object.assign(this, state); this.search.value = this.query; this.menuOpen = false;
  }
  navigate(tab) {
    if (this.tab !== tab) { this.remember(); this.detailTab = 'profile'; }
    this.tab = tab; this.query = ''; this.search.value = ''; this.mobileDetail = false; this.menuOpen = false; this.resetScroll();
  }
  go(tab,{filter=null,view=null}={}) {
    const target=this.host?this.host.openModule(tab):this;if(!this.host)this.navigate(tab);if(filter)target.setFilter(filter);if(view)target.setView(view);return target;
  }
  view() { return this.views[this.tab] || VIEWS[this.tab]?.[0][0] || 'overview'; }
  setView(id) { this.views[this.tab] = id; this.resetScroll(); }
  filter() { return this.filters[this.tab] || 'all'; }
  setFilter(id) { this.filters[this.tab] = id; this.resetScroll(); }
  setSelection(entity, unitId = null) {
    if (entity !== this.selected || unitId !== this.unitId) this.remember();
    const target = entity?.properties.citizen ? 'people' : entity?.properties.cityBuilding ? (this.tab === 'economy' && this.city.economy.businesses.some(b=>b.id===entity.id) ? 'economy' : 'buildings') : this.tab;
    const sameDirectory = this.tab === target, listScroll = this.scrolls.list || 0;
    this.tab = target; this.selected = entity; this.unitId = unitId; this.detailTab = unitId ? 'units' : 'profile'; this.visible = true;
    this.mobileDetail = !!entity; if (!sameDirectory) { this.query = ''; this.search.value = ''; } this.menuOpen = false; this.resetScroll(); if (sameDirectory) this.scrolls.list=listScroll;
  }
  toggle() { this.visible = !this.visible; this.element.hidden = !this.visible; }
  setPlotSelection(id) { if(this.host)return this.host.setPlotSelection(id); if(this.tab==='land')this.remember(); this.navigate('land'); this.selectedPlotId = id; this.setView('plots'); this.visible = true; }
  openCitizen(id) { const c = this.city.society.citizen(id); if (c) this.select(c.entity); }
  openBuilding(id) { const b = this.city.building(id); if (b) this.select(b.entity); }
  personLog(id) { this.go('log').logCitizenId = id; }
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
    if (event.code === 'Escape') { if (this.menuOpen) this.menuOpen = false; else this.toggle(); return true; }
    if (event.code === 'Backspace' && this.history.length) { this.back(); return true; }
    if (event.code === 'Slash') { this.search.focus(); return true; }
    if (['PageDown', 'PageUp', 'Home', 'End'].includes(event.code)) {
      const z = this.zones.at(-1); if (!z) return false;
      this.scrolls[z.key] = event.code === 'Home' ? 0 : event.code === 'End' ? z.max : Math.max(0, Math.min(z.max, (this.scrolls[z.key] || 0) + z.h * (event.code === 'PageUp' ? -1 : 1))); return true;
    }
    return false;
  }
  inputAt(input, x, y, w) { Object.assign(input.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, clipPath:'' }); input.hidden = false; }
  drawFloating(ui,window) {
    this.floating=true;this.floatingDossier=window.kind==='dossier';this.element.hidden=false;this.visible=true;this.zones=[];
    for(const input of [this.search,this.seed,this.filterInput,this.sortInput])input.hidden=true;
    this.bounds={x:window.x,y:window.y,w:window.w,h:window.h};if(window.shaded)return;
    const x=window.x+5,w=window.w-10,bottom=window.y+window.h-19;let y=window.y+31;
    if(!this.floatingDossier){
      const search=this.tab!=='city'||this.view()!=='overview';
      if(search){this.search.placeholder=this.tab==='people'?'Buscar pessoa…':'Pesquisar…';this.inputAt(this.search,x+5,y,w-10);y+=28;}
      const views=VIEWS[this.tab];if(views){const p=new Page(ui,x+4,y,w-8,y,bottom);p.buttons(views.map(([id,label])=>({label,selected:this.view()===id,click:()=>this.setView(id)})));y=p.y;}
    }
    this.pane(ui,this.floatingDossier?`detail:${this.selected?.id}:${this.detailTab}`:['people','buildings','economy'].includes(this.tab)?'list':this.tab+':'+this.view(),x,y,w,Math.max(24,bottom-y),p=>{
      if(this.floatingDossier)this.detail(p);else if(['people','buildings','economy'].includes(this.tab))this.directory(p);else this.content(p);
    });
  }
  draw(ui) {
    this.element.hidden=!this.visible;for(const input of [this.search,this.seed,this.filterInput,this.sortInput])input.hidden=true;this.zones=[];
    if(!this.visible)return;
    const w=Math.min(ui.width-12,this.expanded?ui.width-24:1088),x=ui.width-w-6,y=42,h=Math.max(140,ui.height-y-(ui.width<700?78:48)),desktop=w>=940;
    this.bounds={x,y,w,h};this.layout={desktop,compact:w<700};const info=TABS.find(t=>t[0]===this.tab)||TABS[0];
    ui.panel(x,y,w,h,'Suburban — Administração da cidade','');ui.button(x+w-92,y+4,50,22,this.expanded?'><':'<>',()=>{this.expanded=!this.expanded;});ui.button(x+w-36,y+4,28,22,'X',()=>this.toggle(),{danger:true});
    const navWidth=desktop?158:0;
    if(desktop)this.pane(ui,'navigation',x+8,y+36,navWidth-12,h-68,p=>{p.y=this.navigation(ui,p.x,p.y,p.w,p.top,p.bottom);});
    const bx=x+navWidth+16,bw=w-navWidth-32;let by=y+39;
    if(desktop){ui.text(info[1],bx,by,T.ink,2);if(this.history.length)ui.button(bx+bw-92,by,92,26,'< VOLTAR',()=>this.back());by+=38;}
    else{ui.button(bx,by,78,28,'MENU',()=>{this.menuOpen=!this.menuOpen;},{selected:this.menuOpen});ui.text(trim(info[1],bw-122),bx+90,by+6,T.ink);if(this.history.length)ui.button(bx+bw-28,by,28,28,'<',()=>this.back());by+=38;}
    const listMode=['people','buildings','economy'].includes(this.tab),split=listMode&&bw>=680;
    this.search.placeholder=this.tab==='people'?'Buscar nome ou atividade…':this.tab==='log'?'Buscar acontecimento…':'Pesquisar nesta janela…';this.inputAt(this.search,bx,by,split?254:bw);by+=38;
    const views=VIEWS[this.tab];if(views){const row=new Page(ui,bx,by,bw,by,y+h-24);row.buttons(views.map(([id,label])=>({label,selected:this.view()===id,click:()=>this.setView(id)})));by=row.y;}
    if(listMode&&!split){const tw=Math.floor((bw-6)/2);ui.button(bx,by,tw,28,'LISTA',()=>{this.mobileDetail=false;},{selected:!this.mobileDetail});ui.button(bx+tw+6,by,tw,28,'FICHA',()=>{this.mobileDetail=true;},{selected:this.mobileDetail});by+=38;}
    const bh=Math.max(16,y+h-by-29);
    if(split){this.pane(ui,'list',bx,by,254,bh,p=>this.directory(p));this.pane(ui,`detail:${this.selected?.id}:${this.detailTab}`,bx+268,by,bw-268,bh,p=>this.detail(p));}
    else this.pane(ui,listMode?(this.mobileDetail?`detail:${this.selected?.id}:${this.detailTab}`:'list'):this.tab+':'+this.view(),bx,by,bw,bh,p=>{if(listMode){if(this.mobileDetail)this.detail(p);else this.directory(p);}else this.content(p);});
    const s=this.city.stats(),footer=bw>600?`${stamp(this.city.minute)}  •  ${s.population} habitantes  •  Tesouro: ${money(s.treasury)}`:`${stamp(this.city.minute)}  •  ${s.population} habitantes`;
    ui.text(trim(footer,w-28),x+14,y+h-22,T.muted);
    if(this.menuOpen&&!desktop){
      for(const input of[this.search,this.seed,this.filterInput,this.sortInput])input.hidden=true;this.zones=[];const my=y+74,mh=h-102;
      ui.panel(bx-3,my,bw+6,mh,'Janelas da cidade','');this.pane(ui,'navigation',bx+6,my+34,bw-12,mh-42,p=>{p.y=this.navigation(ui,p.x,p.y,p.w,p.top,p.bottom);});
    }
  }
  navigation(ui, x, y, w, top, bottom) {
    const p = new Page(ui,x,y,w,top,bottom); let group='';
    for (const [id,label,section] of TABS) {
      if(group!==section){ p.space(10); p.note(section,C.muted); group=section; }
      p.button(label,()=>this.go(id),this.tab===id);
    }
    return p.y;
  }
  nativeSelect(input,p,options,value,x=p.x,y=p.y,w=p.w) {
    const signature=JSON.stringify(options);if(input.optionSignature!==signature){input.innerHTML=options.map(([id,label])=>`<option value="${id}">${readableLabel(label)}</option>`).join('');input.optionSignature=signature;}
    input.value=value;if(y>=p.top&&y+24<=p.bottom)this.inputAt(input,x,y,w);
  }
  filterButtons(p) {
    const options=FILTERS[this.tab];if(!options)return;p.note('Mostrar',T.muted);this.nativeSelect(this.filterInput,p,options,this.filter(),p.x,p.y,Math.min(p.w,320));p.space(30);
  }
  pane(ui, key, x, y, w, h, draw) {
    const scroll = this.scrolls[key] || 0;
    bevel(ui.ctx,x,y,w,h,{inset:true,fill:key==='navigation'?T.face:T.paper});
    const p = new Page(ui, x+8, y+4 - scroll, w - 30, y+4, y + h-4);
    clipCanvasRegion(ui, x+3, y+3, w-6, h-6, () => draw(p));
    const height = p.y - (y+4 - scroll), max = Math.max(0, height - h+8);
    this.scrolls[key] = Math.min(scroll, max); this.zones.push({ key, x, y, w, h, max });
    if (max > 0) {
      ui.ctx.fillStyle = T.track; ui.ctx.fillRect(x + w - 8, y, 6, h);
      const thumb = Math.max(16, h * h / height), top = y + (h - thumb) * Math.min(scroll, max) / max;
      bevel(ui.ctx,x+w-11,top,9,thumb);
      ui.regions.push({ x: x + w - 12, y, w: 12, h, onClick: () => { this.scrolls[key] = scroll >= max ? 0 : Math.min(max, scroll + h * .7); } });
    }
  }
  directory(p) {
    const city=this.city, people=this.tab==='people', business=this.tab==='economy';
    p.heading(people ? `CIDADÃOS / ${city.citizens.length}` : `${business?'EMPRESAS':'PRÉDIOS'} / ${business?city.economy.businesses.length:city.buildings.length}`);
    const sorts=people?[['name','NOME'],['cash','SALDO'],['needs','NECESSIDADE']]:[['name','NOME'],['cash','CAIXA']];
    const sort=this.sorts[this.tab]||'name';
    const cw=Math.floor((p.w-8)/2),iy=p.y+17;
    if(p.visible(18)){p.ui.text('Mostrar',p.x,p.y,T.muted);p.ui.text('Ordenar',p.x+cw+8,p.y,T.muted);}
    this.nativeSelect(this.filterInput,p,FILTERS[this.tab],this.filter(),p.x,iy,cw);this.nativeSelect(this.sortInput,p,sorts,sort,p.x+cw+8,iy,cw);p.space(47);
    const filter=this.filter();
    if(people){
      const rows=city.citizens.filter(c=>this.matches(`${name(c.entity)} ${c.action} ${c.profession}`)).filter(c=>filter==='all'||filter==='homeless'&&!c.homeUnitId||filter==='unemployed'&&city.society.isAdult(c)&&!c.jobId&&!c.businessIds.length||filter==='critical'&&Math.min(...Object.values(c.needs))<20||filter==='food'&&c.needs.food<30||filter==='children'&&!city.society.isAdult(c));
      rows.sort((a,b)=>sort==='cash'?b.balance-a.balance:sort==='needs'?Math.min(...Object.values(a.needs))-Math.min(...Object.values(b.needs)):name(a.entity).localeCompare(name(b.entity),'pt-BR'));
      p.note(`${rows.length} resultados`,C.muted);
      for(const c of rows){const critical=Math.min(...Object.values(c.needs))<20,role=c.id===city.economy.mayorId?'Prefeito':!city.society.isAdult(c)?'Criança':c.businessIds.length?'Empresário':city.building(c.jobId)?.entity.properties.name||'Sem trabalho';
        p.card(name(c.entity),`${city.society.age(c)} anos / ${money(c.balance)}
${c.homeUnitId?role:'SEM MORADIA'}
${c.action}`,()=>this.openCitizen(c.id),this.selected?.id===c.id,critical?C.red:!c.homeUnitId?C.gold:C.green);
      }
      if(!rows.length)p.note('Nenhuma pessoa com estes filtros.');
    } else {
      const food=['farm','bakery','market','greengrocer'],services=['cleaner','carrier','paid_toilet','waste_collector'],rows=(business?city.economy.businesses:city.buildings.filter(b=>!b.entity.destroyed)).filter(b=>this.matches(`${name(b.entity)} ${BUILDING_TYPES[b.type].label} ${CROPS[b.crop]?.label||''}`)).filter(b=>filter==='all'||filter==='residential'&&b.type==='residential'||filter==='public'&&!b.ownerId&&b.type!=='residential'||filter==='private'&&!!b.ownerId||filter==='food'&&food.includes(b.type)||filter==='services'&&services.includes(b.type)||filter==='industry'&&['builder','quarry','recycler'].includes(b.type));
      rows.sort((a,b)=>sort==='cash'?b.balance-a.balance:name(a.entity).localeCompare(name(b.entity),'pt-BR'));p.note(`${rows.length} resultados`,C.muted);
      for(const b of rows)p.card(name(b.entity),`${CROPS[b.crop]?.label||BUILDING_TYPES[b.type].label}
${business?money(b.balance)+' / '+b.workers.length+' funcionários':b.units.length+' espaços / '+b.floors+' andares'}`,()=>this.openBuilding(b.id),this.selected?.id===b.id,b.active?C.green:b.type==='residential'?C.cyan:C.gold);
      if(!rows.length)p.note('Nenhuma instalação com estes filtros.');
    }
  }
  detail(p) {
    const c = this.selected?.properties.citizen, b = this.selected?.properties.cityBuilding;
    if (this.tab === 'people' && c && this.city.society.citizen(c.id)) return this.citizen(p, c);
    if (this.tab !== 'people' && b && !b.entity.destroyed) return this.building(p, b);
    p.heading('FICHA DE OBSERVAÇÃO'); p.note('Selecione alguém na lista para acompanhar sua rotina, seus vínculos e suas finanças. A seleção no mapa também abre a ficha.');
    if (this.tab === 'economy') this.demands(p);
  }
  dossierTabs(p, tabs) {
    p.buttons(tabs.map(([id, label]) => ({ label, selected: this.detailTab === id, click: () => { this.detailTab = id; for(const key of Object.keys(this.scrolls)) if(key.startsWith('detail:'))delete this.scrolls[key]; } })));
    p.space(8);
  }
  homeLabel(id) {
    const home=this.city.housing.homes.get(id);if(!home)return 'Sem moradia';
    const homes=[...this.city.housing.homes.values()].filter(h=>h.buildingId===home.buildingId),room=this.city.units.get(home.unitIds[0]);
    return `Casa ${homes.indexOf(home)+1} / ${(room?.z||0)+1}º andar`;
  }
  citizen(p, c) {
    const city = this.city, society = city.society;
    if(!this.floatingDossier)p.heading(name(c.entity), C.gold); p.note(`${society.age(c)} anos | ${c.id === city.economy.mayorId ? 'Prefeito' : c.businessIds.length ? 'Empresário' : 'Morador'}`);
    p.button('LOCALIZAR NO MAPA', () => { this.camera(c.entity.x, c.entity.y); if(!this.host)this.visible = false; });
    this.dossierTabs(p, [['profile', 'PERFIL'], ['skills', 'HABILIDADES'], ['family', 'VÍNCULOS'], ['assets', 'FINANÇAS']]);
    if (this.detailTab === 'profile') {
      p.heading('ROTINA ATUAL'); p.note(c.action, C.cyan);
      p.metrics([['FELICIDADE',`${Math.round(c.happiness)}%`,c.happiness<30?C.red:C.green],['SALDO',money(c.balance),C.gold]]); p.kv('Provisões', `${c.provisions} refeições`); p.kv('Estado da moradia', c.homeUnitId ? 'Abrigado' : 'Morando na rua');
      p.heading('NECESSIDADES'); p.meters(Object.entries(c.needs).map(([id,value])=>[NEED_LABELS[id],value]));
      const home = city.units.get(c.homeUnitId), dwelling = city.housing.home(c); p.heading('MORADIA');
      if (dwelling) { p.kv('Casa', this.homeLabel(dwelling.id)); p.kv('Cômodos', city.housing.units(dwelling).map(u => u.roomType === 'bathroom' ? 'Banheiro' : 'Quarto').join(' + ')); p.kv('Aluguel total/dia', money(city.housing.rent(dwelling, c))); p.kv('Valor de compra da casa', money(city.housing.price(dwelling))); }
      p.note('Moradia e alimentação dependem da renda e das reservas. A falta de pagamento por três dias pode encerrar o aluguel.', C.gray);
      if (home) { p.kv('Espaço',`${home.x+1}, ${home.y+1} / ${home.z+1}º andar`); p.kv('Regime', home.ownerId === c.accountId ? 'Proprietário' : home.tenantId !== c.accountId && dwelling ? 'Moradia compartilhada' : 'Inquilino'); p.button(name(city.building(home.buildingId)?.entity), () => this.openBuilding(home.buildingId)); }
      else p.note('Sem moradia', C.red);
    } else if (this.detailTab === 'skills') {
      p.heading('TRABALHO'); const job = city.building(c.jobId);
      if (job) p.button(name(job.entity), () => this.openBuilding(job.id));
      else p.note(c.businessIds.length ? 'Empresário' : society.isAdult(c) ? 'Sem emprego' : 'Criança');
      p.kv('Salário recebido hoje', money(c.salaryToday)); p.kv('Vale-alimentação hoje', money(c.mealAllowanceToday)); p.note('As habilidades aumentam com a prática e influenciam contratação e remuneração.');
      p.meters(Object.entries(c.skills).map(([id,v])=>[SKILLS[id],v,C.cyan]));
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
    if(!this.floatingDossier)p.heading(name(b.entity)); p.note(`${BUILDING_TYPES[b.type].label} | ${b.width}x${b.depth}x${b.floors} | ${b.units.length} células`);
    p.button('LOCALIZAR NO MAPA', () => { this.camera(b.entity.x, b.entity.y); if(!this.host)this.visible = false; });
    this.dossierTabs(p, [['profile', 'OPERAÇÃO'], ['stock', 'ESTOQUE'], ['staff', 'EQUIPE'], ...(b.type === 'builder' ? [['services', 'SERVIÇOS']] : []), ['units', 'CÉLULAS']]);
    if (this.detailTab === 'profile') {
      p.kv('Tipo de ocupação', b.constructionKind === 'open-air' ? 'Ar livre / no nível do solo' : 'Edifício');
      p.button(`TERRENO ${b.plotId}`, () => this.setPlotSelection(b.plotId));
      p.kv('Situação', b.active ? 'Em atividade' : b.type === 'residential' ? 'Residencial' : 'Instalação disponível');
      if(b.type==='mint'){p.kv('Emitido hoje',money(city.currency.issuedToday));p.kv('Inflação acumulada',`${((city.currency.priceIndex-1)*100).toFixed(2)}%`);p.note('A emissão entra no tesouro e depende de um funcionário trabalhando nesta instalação.');}
      p.note('Proprietário da empresa'); if (b.ownerId) p.button(name(city.economy.citizen(b.ownerId)?.entity), () => this.openCitizen(b.ownerId)); else p.note(b.municipal?'Empresa municipal / patrimônio público':'Serviço público');
      p.metrics([['CAIXA',money(b.balance),b.balance<1000?C.red:C.gold],['EQUIPE',`${b.workers.length}/${b.jobs}`,C.cyan]]); p.kv('Receita acumulada', money(b.totalRevenue)); p.kv('Despesas acumuladas', money(b.totalExpenses)); p.kv('Dividendos pagos', money(b.dividends));
      p.kv('Equipe', `${b.workers.length}/${b.jobs}`); p.kv('Desnível do terreno', Number(b.terrain.variation).toFixed(2)); p.kv('Circulação comum', `${b.circulation?.length || 0} células sem imóveis`);
      p.heading('MOVIMENTAÇÕES RECENTES'); this.transactions(p, b.accountId);
    } else if (this.detailTab === 'stock') {
      p.heading('INVENTÁRIO REAL'); p.kv('Capacidade', `${inventoryUsed(b)}/${b.inventoryCapacity} itens`); p.kv('Reservado para recebimento', incomingItems(b)); p.kv('Espaço livre', inventoryFree(b)); p.meter('Ocupação do armazém', inventoryUsed(b) / b.inventoryCapacity * 100, inventoryFree(b) < 12 ? C.red : C.cyan); for (const [id, spec] of Object.entries(GOODS)) p.kv(spec.label, b.inventory?.[id] || 0);
      if (b.type === 'quarry') p.kv('Reserva mineral restante', b.stoneReserve || 0);
      if (b.crop) { p.heading(`CULTIVO / ${CROPS[b.crop].label}`); p.kv('Sementes', b.seedStock); for (const [i, f] of b.fields.entries()) { p.note(`Talhão ${i + 1}: ${f.plantedAt === null ? 'aguarda plantio' : 'em crescimento'}`); p.meter('Trabalho', f.labor / 120 * 100); p.meter('Crescimento', f.plantedAt === null ? 0 : (city.minute - f.plantedAt) / CROPS[b.crop].grow * 100); } }
      if (b.type === 'bakery') p.note('Receita: trigo transformado em pão pelo trabalho da equipe.');
      p.heading('INSUMOS PROCURADOS'); const missing = Object.entries(b.inputDemand || {}).filter(([, qty]) => qty > 0);
      for (const [id, qty] of missing) p.kv(GOODS[id].label, qty); if (!missing.length) p.note('Nenhum insumo pendente.');
      p.kv('Ocorrências de falta', b.stockouts);
    } else if (this.detailTab === 'staff') {
      p.kv('Postos ocupados', `${b.workers.length}/${b.jobs}`); p.kv('Salário base/hora', money(b.wage * 60));
      p.heading('ALIMENTAÇÃO DOS FUNCIONÁRIOS'); p.kv('Refeições fornecidas', b.mealsServed); p.kv('Compras para refeições', money(b.mealPurchaseCost)); p.kv('Vales pagos', `${b.vouchersIssued} / ${money(b.foodVoucherCost)}`);
      p.note('A empresa compra alimentos para a sede e os canteiros. Sem refeição no local, o vale é de pelo menos R$ 30 ou seis vezes o preço da refeição, por atendimento.');
      p.note('Contratação: habilidade 75%, confiança 15%, afeto 10%. O salário também considera habilidade.');
      for (const id of b.workers) { const c = city.economy.citizen(id); if (!c) continue; p.button(name(c.entity), () => this.openCitizen(id)); p.meter(SKILLS[JOB_SKILL[b.type]] || 'Habilidade', c.skills[JOB_SKILL[b.type]] || 0, C.cyan); }
      if (!b.workers.length) p.note('Nenhum funcionário contratado.');
    } else if (this.detailTab === 'services' && b.type === 'builder') {
      p.heading('SERVIÇOS DA CONSTRUTORA');
      for (const offer of city.development.serviceOffers(b.id)) { p.note(offer.label, C.cyan); p.kv('Mão de obra por célula', money(offer.feePerCell)); }
      p.note('Contratos de prédios sob medida definem largura, profundidade e andares dentro do terreno. Materiais, fretes e serviço são pagos pelo contratante; o serviço só é liberado após a conclusão.');
      this.contracts(p, city.development.projects.filter(o => o.builderId === b.id).slice(-20).reverse());
    } else {
      p.note('Espaços na fachada; miolo de circulação comum. Cada cômodo tem seu contrato. A prefeitura vende e nunca aluga.');
      let u = city.units.get(this.unitId); if (u?.buildingId !== b.id) u = b.units[0]; this.unitId = u?.id || null;
      this.unitMap(p,b,u);
      if (u) { p.heading(`ESPAÇO ${u.x+1}, ${u.y+1} / ${u.z+1}º ANDAR`); p.kv('Cômodo', { bedroom: 'Quarto', bathroom: 'Banheiro', workspace: 'Área da empresa' }[u.roomType]); if (u.homeId) p.kv('Casa', this.homeLabel(u.homeId)); p.kv('Proprietário', city.accountName(u.ownerId)); this.accountLink(p, u.ownerId);
        p.kv('Ocupante', u.tenantId || u.occupantId ? city.accountName(u.tenantId || u.occupantId) : 'Livre'); this.accountLink(p, u.tenantId || u.occupantId);
        p.kv('Venda', money(u.price)); p.kv('Aluguel/dia', u.ownerId === 'treasury' ? 'Prefeitura não aluga' : money(u.rent)); p.kv('Em atraso', money(u.arrears)); p.kv('Anúncio', u.forSale ? 'À venda' : u.forRent ? 'Para alugar' : 'Uso próprio / ocupado'); }

    }
  }
  unitMap(p,b,selected) {
    p.heading('PLANTA DOS ESPAÇOS');
    p.buttons(Array.from({length:b.floors},(_,z)=>({label:`${z+1}º ANDAR`,selected:(selected?.z||0)===z,click:()=>{this.unitId=b.units.find(u=>u.z===z)?.id||null;}})));
    const size=Math.min(38,Math.floor(p.w/b.width)),height=b.depth*size,at=p.y;
    if(p.visible(height))for(let y=0;y<b.depth;y++)for(let x=0;x<b.width;x++){
      const u=b.units.find(u=>u.x===x&&u.y===y&&u.z===(selected?.z||0)),px=p.x+x*size,py=at+y*size;
      if(u){
        const label={bedroom:'Q',bathroom:'B',workspace:'E'}[u.roomType]||'E';
        p.ui.button(px,py,size-3,size-3,label,()=>{this.unitId=u.id;},{selected:u.id===selected?.id});
        p.ui.ctx.fillStyle=u.tenantId||u.occupantId?C.green:u.forSale?C.gold:C.cyan;p.ui.ctx.fillRect(px+4,py+size-8,size-11,2);
      }else{p.ui.ctx.fillStyle=C.surface;p.ui.ctx.fillRect(px,py,size-3,size-3);p.ui.text('::',px+Math.max(1,(size-19)/2),py+Math.max(1,(size-11)/2),C.muted);}
    }
    p.space(height+12);p.note('Q quarto / B banheiro / E empresa / :: circulação',C.muted);p.note('Verde: ocupado / amarelo: à venda / azul: privado',C.muted);
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
    if (this.notice) p.note(this.notice, C.red);
    const render = { city: 'overview', government: 'government', production: 'production', land: 'land', transport: 'transport', sanitation: 'sanitation', log: 'log' }[this.tab];
    if (render) this[render](p);
  }
  overview(p) {
    const city=this.city,s=city.stats(), view=this.view();
    if(view==='overview'){
      p.metrics([
        ['HABITANTES',s.population,C.cyan,`${s.children} crianças`,()=>this.go('people')],
        ['FELICIDADE',`${Math.round(s.happiness)}%`,s.happiness<40?C.red:C.green,'média da cidade',()=>this.setView('needs')],
        ['SEM MORADIA',s.homeless,s.homeless?C.red:C.green,'pessoas sem casa',()=>this.go('people',{filter:'homeless'})],
        ['TESOURO',money(s.treasury),C.gold,'caixa municipal',()=>this.go('government')],
      ]);
      p.columns(q=>{
        q.heading('ATENÇÃO DA CIDADE');
        const hungry=city.citizens.filter(c=>c.needs.food<30), critical=city.citizens.filter(c=>Math.min(c.needs.food,c.needs.water,c.needs.health)<20),dirty=[...city.sanitation.facilities.values()].filter(f=>f.cleanliness<25);
        q.card(`${hungry.length} PESSOAS COM FOME`,'Alimentação abaixo de 30%',()=>this.go('people',{filter:'food'}),false,hungry.length?C.red:C.green);
        q.card(`${critical.length} EM RISCO`,'Água, comida ou saúde em nível crítico',()=>this.go('people',{filter:'critical'}),false,critical.length?C.red:C.green);
        q.card(`${dirty.length} BANHEIROS SUJOS`,'Limpeza abaixo de 25%',()=>this.go('sanitation',{filter:'dirty'}),false,dirty.length?C.gold:C.green);
      },q=>{
        q.heading('A CIDADE EM MOVIMENTO');
        q.kv('Empregados / vagas',`${s.employed} / ${s.jobs}`);q.kv('Empresas ativas',s.businesses);
        q.kv('Obras em andamento',city.development.projects.filter(o=>!o.cancelled&&o.status!=='completed').length);
        q.kv('Cargas em andamento',city.logistics.shipments.filter(o=>!['delivered','cancelled'].includes(o.status)).length);
        q.kv('Entregas concluídas',city.logistics.delivered);q.kv('Casais / amizades',`${s.couples} / ${s.friendships}`);q.kv('Nascimentos / mortes',`${s.births} / ${s.deaths}`);
        q.button('ACOMPANHAR AS OBRAS',()=>this.go('land',{view:'projects'}));q.button('VER ABASTECIMENTO',()=>this.go('production'));
      });
      p.heading('ÚLTIMOS ACONTECIMENTOS');this.events(p,city.events.filter(e=>this.matches(e.message)).slice(0,2),false);p.button('ABRIR HISTÓRICO COMPLETO',()=>this.go('log'));
    } else if(view==='needs'){
      p.heading('CONDIÇÕES DE VIDA');
      p.meters(Object.entries(NEED_LABELS).map(([key,label])=>[label,city.citizens.reduce((n,c)=>n+c.needs[key],0)/Math.max(1,s.population)]));
      p.heading('PESSOAS QUE PRECISAM DE ATENÇÃO');
      const rows=city.citizens.filter(c=>Math.min(...Object.values(c.needs))<30).sort((a,b)=>Math.min(...Object.values(a.needs))-Math.min(...Object.values(b.needs)));
      for(const c of rows){const need=Object.entries(c.needs).sort((a,b)=>a[1]-b[1])[0];p.card(name(c.entity),`${NEED_LABELS[need[0]]}: ${Math.round(need[1])}% / ${c.action}`,()=>this.openCitizen(c.id),false,C.red);}
      if(!rows.length)p.note('Todos os habitantes estão com necessidades acima de 30%.',C.green);
    } else {p.heading('ATIVIDADE DA CIDADE');this.events(p,city.events.filter(e=>this.matches(e.message)).slice(0,30));}
  }
  monetaryPolicy(p) {
    const currency=this.city.currency,mint=this.city.buildings.find(b=>b.type==='mint'&&!b.entity.destroyed);
    p.heading('MOEDA E INFLAÇÃO');
    p.kv('Dinheiro emitido',money(currency.issued));p.kv('Emitido hoje',money(currency.issuedToday));
    p.kv('Inflação diária',`${(currency.dailyInflation*100).toFixed(2)}%`);p.kv('Inflação acumulada',`${((currency.priceIndex-1)*100).toFixed(2)}%`);
    p.note('A casa da moeda deposita a emissão no tesouro. A expansão monetária eleva gradualmente os preços. Dinheiro guardado e contratos já reservados mantêm seu valor nominal.');
    if(mint)p.button('ABRIR CASA DA MOEDA',()=>this.openBuilding(mint.id));
  }
  government(p) {
    const city=this.city,view=this.view(),mayor=city.economy.citizen(city.economy.mayorId),hall=city.buildings.find(b=>b.type==='townhall');
    if(view==='overview'){
      p.heading('GOVERNO AUTÔNOMO');
      if(mayor)p.card(name(mayor.entity),'Prefeito / cidadão da cidade',()=>this.openCitizen(mayor.id),false,C.gold);
      p.metrics([['TESOURO',money(city.treasury),C.gold],['REFEIÇÕES',Math.floor(city.economy.inventory(hall)/3),C.green],['IMPOSTOS',`${Math.round(city.taxRate*100)}%`,C.cyan]]);
      this.monetaryPolicy(p);
      p.heading('PATRIMÔNIO PÚBLICO');const units=[...city.units.values()].filter(u=>u.ownerId==='treasury');p.kv('Espaços públicos',units.length);p.kv('Espaços à venda',units.filter(u=>u.forSale).length);
      p.note('O município vende imóveis e terrenos; nunca aluga. O prefeito tem rotina e conta pessoal, separadas do tesouro.');
      p.heading('RESERVA DE EMERGÊNCIA');p.kv('Alimentos disponíveis',`${city.economy.inventory(hall)} itens`);p.note('Reserva finita para os habitantes até a cadeia alimentar se estabelecer.');
      if(hall)p.button('ABRIR PREFEITURA',()=>this.openBuilding(hall.id));
    } else if(view==='contracts'){p.heading('CONTRATOS MUNICIPAIS');this.contracts(p,city.development.projects.filter(o=>o.accountId==='treasury').slice(-30).reverse());}
    else if(view==='finance'){this.monetaryPolicy(p);p.heading('MOVIMENTAÇÕES DO TESOURO');p.metrics([['DISPONÍVEL',money(city.treasury),C.gold]]);this.transactions(p,'treasury');}
    else {
      p.heading('GERAÇÃO DE TERRENO');p.note(`Mapa atual: ${WORLD_PRESETS[city.world.preset]?.label||'Natural'}`);p.kv('Semente atual',city.world.seed??city.initialSeed);
      p.heading('PRÓXIMA CIDADE');p.note('Semente do próximo mapa');const iy=p.y;p.space(30);if(iy>=p.top&&iy+24<=p.bottom)this.inputAt(this.seed,p.x,iy,p.w);
      p.button(`PAISAGEM: ${WORLD_PRESETS[this.terrain].label}`,()=>{const keys=Object.keys(WORLD_PRESETS);this.terrain=keys[(keys.indexOf(this.terrain)+1)%keys.length];});
      p.note('Gerar terreno reinicia a simulação e descarta a cidade atual.',C.red);
      p.button('GERAR COM ESTA SEMENTE',()=>{if(this.seed.reportValidity())this.startWorld(Number(this.seed.value),this.terrain);});p.button('GERAR TERRENO ALEATÓRIO',()=>this.startWorld(randomWorldSeed(),this.terrain));
    }
  }
  production(p) {
    const city=this.city,view=this.view();
    if(view==='demand'){this.demands(p);return;}
    if(view==='stocks'){
      p.heading('ESTOQUES E TRANSFORMAÇÕES');
      p.note('Produção e consumo acumulados. Estoque inclui prédios, obras, cargas e resíduos espalhados.');
      const rows=Object.entries(GOODS).filter(([g,spec])=>this.matches(spec.label)).map(([g,spec])=>({cells:[spec.label,city.economy.produced[g],city.economy.consumed[g],city.goodsStock(g)],color:city.goodsStock(g)?C.gray:C.red}));
      p.table([{label:'Produto',weight:2},{label:'Produzido'},{label:'Consumido'},{label:'Estoque'}],rows);
      p.kv('Refeições sem oferta',city.economy.failedMeals);
      p.heading('ORIGEM E DESTINO');
      p.table([{label:'Produto',weight:2},{label:'Inicial'},{label:'Em frete'},{label:'Nas obras'}],Object.entries(GOODS).filter(([,spec])=>this.matches(spec.label)).map(([g,spec])=>({cells:[spec.label,city.economy.initialStock[g],city.logistics.shipments.reduce((n,s)=>n+s.inventory[g],0),city.development.projects.reduce((n,s)=>n+s.inventory[g],0)]})));
      p.note('Fazendas > lojas > refeições. Trigo > padarias > pão. Pedreira ou reciclagem > obra > prédio. As entregas precisam chegar para liberar o estoque.');
    } else {
      p.heading('MOVIMENTAÇÕES DE MERCADORIAS');
      const kinds={dispatch:'Carga reservada',delivery:'Entrega',mining:'Extração',construction:'Construção',road:'Estrada',expansion:'Ampliação','workplace-meal':'Refeição da empresa',waste:'Lixo gerado','recycling-input':'Processamento','recycling-output':'Pedra reciclada',consumption:'Consumo',sowing:'Plantio',harvest:'Colheita','recipe-input':'Insumo',baking:'Panificação'};
      for(const l of city.economy.goodsLedger.slice(-60).reverse().filter(l=>this.matches(`${GOODS[l.good]?.label} ${kinds[l.kind]||l.kind}`))){p.heading(`${GOODS[l.good]?.label||l.good} x${l.quantity}`,C.cyan);p.note(`${stamp(l.minute)} / ${kinds[l.kind]||l.kind}`);const origin=city.building(l.from),target=city.building(l.to)||city.society.citizen(l.to);p.note(`${origin?name(origin.entity):'Produção'} > ${target?name(target.entity):'Consumo ou transformação'}`);}
    }
  }
  land(p) {
    const city=this.city,dev=city.development,selected=dev.plots.find(l=>l.id===this.selectedPlotId);
    if(this.view()==='projects'){
      p.heading('OBRAS EM ANDAMENTO');const active=dev.projects.filter(o=>o.status!=='completed'&&!o.cancelled);this.contracts(p,active);
      p.heading('OBRAS ENCERRADAS');this.contracts(p,dev.projects.filter(o=>o.status==='completed'||o.cancelled).slice(-15).reverse());return;
    }
    p.metrics([['TERRENOS',dev.plots.length,C.cyan],['À VENDA',dev.plots.filter(l=>l.forSale&&!l.buildingId).length,C.gold],['EM OBRAS',dev.projects.filter(o=>!o.cancelled&&o.status!=='completed').length,C.green]]);
    if(selected){
      p.heading(`TERRENO ${selected.id}`,C.cyan);p.columns(q=>{q.kv('Dimensões',`${selected.width}x${selected.depth}`);q.kv('Nível',selected.level===undefined?'Instalação inicial':selected.level.toFixed(2));q.kv('Proprietário',city.accountName(selected.ownerId));},q=>{q.kv('Venda',selected.forSale?money(selected.price):'Não anunciado');q.kv('Locação',selected.ownerId==='treasury'?'Prefeitura não aluga':selected.forRent?money(selected.rent)+'/dia':'Não anunciado');});
      p.buttons([{label:'LOCALIZAR',click:()=>{this.camera(selected.x+selected.width/2,selected.y+selected.depth/2);if(!this.host)this.visible=false;}},...(selected.buildingId?[{label:'ABRIR IMÓVEL',click:()=>this.openBuilding(selected.buildingId)}]:[]),{label:'FECHAR FICHA',click:()=>{this.selectedPlotId=null;this.resetScroll();}}]);
    }
    this.filterButtons(p);const f=this.filter(),lots=dev.plots.filter(l=>this.matches(`${l.id} ${city.accountName(l.ownerId)} ${city.building(l.buildingId)?.entity.properties.name||''}`)).filter(l=>f==='all'||f==='sale'&&l.forSale&&!l.buildingId||f==='built'&&l.buildingId||f==='works'&&l.projectId);
    p.heading('CADASTRO DE TERRENOS');p.table([{label:'Terreno'},{label:'Proprietário',weight:2},{label:'Área'},{label:'Situação',weight:1.5}],lots.map(l=>({cells:[`Lote ${l.id}`,city.accountName(l.ownerId),`${l.width}x${l.depth}`,l.buildingId?'Edificado':l.projectId?'Em obras':l.forSale?money(l.price):'Disponível'],selected:l.id===this.selectedPlotId,click:()=>{this.selectedPlotId=l.id;this.resetScroll();}})));
  }
  contracts(p, projects) {
    const city=this.city;
    for(const o of projects){
      const label=o.service==='building'?`${BUILDING_TYPES[o.type]?.label||o.type} / lote ${o.plotId}`:o.name;
      p.card(label,`${o.cancelled?'Cancelado':o.status==='completed'?'Concluído':o.status==='materials'?'Aguardando materiais':'Em construção'} / serviço ${money(o.fee)}`,()=>{if(o.plotId)this.setPlotSelection(o.plotId);else{this.camera(o.door.x,o.door.y);if(!this.host)this.visible=false;}},false,o.cancelled?C.red:o.status==='completed'?C.green:C.gold);
      p.columns(q=>{q.kv('Contratante',city.accountName(o.accountId));q.kv('Construtora',city.building(o.builderId)?.entity.properties.name||'Construção própria');},q=>{q.kv('Pedras entregues',`${o.status==='completed'?o.stone:o.inventory.pedra}/${o.stone}`);q.kv('Pedras em transporte',o.incoming.pedra||0);});
      if(o.service==='building')p.kv('Projeto',`${o.width}x${o.depth}x${o.floors} / ${o.sell?'para venda':'uso próprio'}`);if(o.service==='expansion')p.kv('Andares',`${o.baseFloors} > ${o.targetFloors}`);if(o.service==='road')p.kv('Extensão',`${o.path.length} tiles`);
      p.meter('Trabalho concluído',o.requiredLabor?o.labor/o.requiredLabor*100:100);if(o.error)p.note(o.error,C.red);p.space(8);
    }
    if(!projects.length)p.note('Nenhum contrato nesta situação.');
  }
  transport(p) {
    const city=this.city,system=city.logistics,pending=system.shipments.filter(s=>!['delivered','cancelled'].includes(s.status));
    p.metrics([['EM ANDAMENTO',pending.length,C.gold],['ENTREGUES',system.delivered,C.green],['ITENS EM FRETE',pending.reduce((n,s)=>n+s.quantity,0),C.cyan]]);
    const states={waiting:'Aguardando coleta','in-transit':'Em trânsito','waiting-space':'Sem espaço',delivered:'Entregue',cancelled:'Cancelado'};
    const rows=(this.view()==='active'?pending:system.shipments.filter(s=>['delivered','cancelled'].includes(s.status)).slice(-40).reverse()).filter(s=>this.matches(`${s.id} ${GOODS[s.good].label} ${s.seller.entity?.properties.name} ${s.buyer.entity?.properties.name||s.buyer.name}`));
    p.heading(this.view()==='active'?'CARGAS EM ANDAMENTO':'ENTREGAS E CANCELAMENTOS');
    for(const s of rows){
      p.heading(`FRETE ${s.id} / ${GOODS[s.good].label} x${s.quantity}`,s.status==='delivered'?C.green:s.status==='cancelled'?C.red:C.gold);
      p.note(states[s.status],C.cyan);p.note(`${s.seller.entity?.properties.name||s.seller.name} > ${s.buyer.entity?.properties.name||s.buyer.name}`);
      p.columns(q=>{q.kv('Mercadoria',money(s.cost));q.kv('Frete',money(s.fee));if(s.serviceFee)q.kv('Serviço de coleta',money(s.serviceFee));},q=>{q.kv('Operador',city.building(s.carrierId)?.entity.properties.name||'Transporte próprio');q.kv('Trajeto',`${s.routeLength} tiles`);});
      const driver=city.society.citizen(s.driverId);p.buttons([...(city.building(s.seller.id)?[{label:'ORIGEM',click:()=>this.openBuilding(s.seller.id)}]:[]),...(city.building(s.buyer.id)?[{label:'DESTINO',click:()=>this.openBuilding(s.buyer.id)}]:[]),...(driver?[{label:'TRANSPORTADOR',click:()=>this.openCitizen(driver.id)}]:[])]);
      p.note(`${stamp(s.createdAt)}${s.completedAt?' / conclusão '+stamp(s.completedAt):''}`,C.muted);
    }
    if(!rows.length)p.note(this.view()==='active'?'Nenhuma carga em andamento.':'Ainda não há entregas ou cancelamentos.');
  }
  sanitation(p) {
    const city=this.city,system=city.sanitation,view=this.view(),facilities=[...system.facilities.values()],dirty=facilities.filter(f=>f.cleanliness<25),jobs=system.jobs.filter(j=>!['completed','cancelled'].includes(j.status));
    if(view==='deaths'){
      p.metrics([['MORTES',city.life.deathCount,C.red],['NASCIMENTOS',city.society.birthCount,C.green]]);p.heading('MORTES E SOBREVIVÊNCIA');
      p.table([{label:'Pessoa',weight:2},{label:'Causa',weight:1.5},{label:'Idade'},{label:'Momento',weight:1.5}],city.life.deaths.slice(-80).reverse().filter(d=>this.matches(`${d.name} ${d.cause}`)).map(d=>({cells:[d.name,d.cause,`${d.age} anos`,stamp(d.minute)],color:C.red})),{empty:'Nenhuma morte registrada.'});return;
    }
    if(view==='cleaning'){
      p.metrics([['EM SERVIÇO',jobs.length,C.cyan],['CONCLUÍDAS',system.cleaned,C.green],['BANHEIROS SUJOS',dirty.length,C.gold]]);
      p.note('Gratuitos: uma limpeza por semana. Pagos: a cada três horas. Privados: a cada dia. O serviço depende de dinheiro e trabalhador disponível.');
      p.heading('SERVIÇOS DE FAXINA');
      for(const job of [...jobs,...system.jobs.filter(j=>['completed','cancelled'].includes(j.status)).slice(-15).reverse()]){
        const f=system.facilities.get(job.facilityId),b=f&&city.building(f.buildingId),provider=city.building(job.providerId),worker=city.society.citizen(job.workerId);
        p.heading(`FAXINA ${job.id}`,job.status==='completed'?C.green:C.cyan);p.note(b?name(b.entity):'Instalação removida');p.kv('Situação',{waiting:'Aguardando equipe',working:'Em execução',completed:'Concluída',cancelled:'Cancelada'}[job.status]);p.kv('Pagamento',money(job.fee));p.kv('Contratante',city.accountName(job.payerId));
        p.buttons([...(provider?[{label:name(provider.entity),click:()=>this.openBuilding(provider.id)}]:[]),...(worker?[{label:name(worker.entity),click:()=>this.openCitizen(worker.id)}]:[])]);
      }
      if(!system.jobs.length)p.note('Nenhum serviço solicitado ainda.');return;
    }
    if(view==='waste'){
      p.metrics([['LIXO NA CIDADE',city.goodsStock('lixo'),C.gold],['PROCESSADO',city.economy.consumed.lixo,C.green],['ESPALHADO',city.buildings.reduce((n,b)=>n+(b.litter||0),0),C.red]]);
      p.heading('CICLO DOS RESÍDUOS');p.note('Banheiro > coleta > transporte > reciclagem > pedra. Duas unidades de lixo geram uma pedra com trabalho.');
      p.table([{label:'Instalação',weight:2},{label:'No estoque'},{label:'Espalhado'}],city.buildings.filter(b=>(b.inventory.lixo||b.litter)&&this.matches(name(b.entity))).sort((a,b)=>(b.inventory.lixo+b.litter)-(a.inventory.lixo+a.litter)).map(b=>({cells:[name(b.entity),b.inventory.lixo,b.litter||0],click:()=>{this.openBuilding(b.id);this.detailTab='stock';},color:b.litter?C.red:C.gray})));
      p.heading('COLETA E PROCESSAMENTO');for(const b of city.economy.businesses.filter(b=>['waste_collector','recycler'].includes(b.type)))p.card(name(b.entity),`${BUILDING_TYPES[b.type].label} / ${b.workers.length} funcionários`,()=>this.openBuilding(b.id),false,C.green);return;
    }
    p.metrics([['BANHEIROS',facilities.length,C.cyan],['SUJOS',dirty.length,dirty.length?C.red:C.green],['LIMPEZAS',system.cleaned,C.green]]);this.filterButtons(p);
    const access={home:'Moradia privada',employees:'Funcionários',public:'Público gratuito',paid:'Público pago'},filter=this.filter();
    const rows=facilities.filter(f=>this.matches(`${city.building(f.buildingId)?.entity.properties.name} ${access[f.access]} ${f.homeId||''}`)).filter(f=>filter==='all'||filter==='public'&&f.access==='public'||filter==='paid'&&f.access==='paid'||filter==='private'&&['home','employees'].includes(f.access)||filter==='dirty'&&f.cleanliness<25).sort((a,b)=>a.cleanliness-b.cleanliness);
    const selected=system.facilities.get(this.selectedFacilityId);
    if(selected){
      const f=selected,b=city.building(f.buildingId),interval=f.access==='public'?SANITATION_RULES.freeCleaningInterval:f.access==='paid'?SANITATION_RULES.paidCleaningInterval:SANITATION_RULES.privateCleaningInterval;
      p.heading('BANHEIRO SELECIONADO',C.cyan);p.kv('Prédio',name(b?.entity));if(f.homeId)p.kv('Moradia',this.homeLabel(f.homeId));p.kv('Acesso',access[f.access]);p.meter('Limpeza',f.cleanliness);p.kv('Utilizações',f.uses);p.kv('Última limpeza',stamp(f.lastCleanedAt));p.kv('Próxima limpeza permitida',stamp(f.lastCleanedAt+interval));p.kv('Serviço',f.cleaningJobId?`Faxina ${f.cleaningJobId}`:'Sem solicitação');
      if(b)p.button('ABRIR INSTALAÇÃO',()=>{this.select(b.entity);this.unitId=f.unitId;this.detailTab='units';});
    }
    p.heading('CONDIÇÃO DOS BANHEIROS');
    p.table([{label:'Instalação',weight:2},{label:'Acesso',weight:1.7},{label:'Limpeza'},{label:'Uso'}],rows.map(f=>({cells:[name(city.building(f.buildingId)?.entity),access[f.access],`${Math.round(f.cleanliness)}%`,f.price?money(f.price):'Grátis'],color:f.cleanliness<25?C.red:f.cleanliness<65?C.gold:C.green,selected:this.selectedFacilityId===f.id,click:()=>{this.selectedFacilityId=f.id;this.resetScroll();}})));
    p.note('Casas: moradores e amigos próximos. Empresas: funcionários e dono. Gratuitos são livres, mesmo imundos. Pagos exigem o valor da entrada.');
  }
  events(p, events, links=true) {
    for(const e of events){
      const color=e.category==='death'?C.red:e.category==='family'||e.category==='relationship'?C.pink:e.category==='production'||e.category==='transport'?C.cyan:C.gold;
      p.heading(`${stamp(e.minute)} / ${EVENT_CATEGORIES[e.category]||e.category}`,color);p.note(e.message,T.ink);
      if(links){const people=(e.citizenIds||[]).map(id=>this.city.society.citizen(id)).filter(Boolean);p.buttons(people.map(c=>({label:name(c.entity),click:()=>this.openCitizen(c.id)})));}
    }
    if(!events.length)p.note('Nenhum acontecimento encontrado.');
  }
  log(p) {
    p.buttons([{label:this.logLive?'CONGELAR HISTÓRICO':'RETOMAR AO VIVO',selected:!this.logLive,click:()=>{this.logLive=!this.logLive;this.frozenEvents=this.logLive?null:[...this.city.events];}},{label:'EXPORTAR JSON',click:()=>this.exportLog()}]);
    p.heading('FILTRAR POR ASSUNTO');p.buttons([['all','TODOS'],...Object.entries(EVENT_CATEGORIES)].map(([id,label])=>({label:String(label).toUpperCase(),selected:this.logCategory===id,click:()=>{this.logCategory=id;this.resetScroll();}})));
    if(this.logCitizenId)p.button(`PESSOA: ${name(this.city.society.citizen(this.logCitizenId)?.entity)} / LIMPAR`,()=>{this.logCitizenId=null;this.resetScroll();});
    const rows=(this.logLive?this.city.events:this.frozenEvents||[]).filter(e=>(this.logCategory==='all'||this.logCategory===e.category)&&(!this.logCitizenId||e.citizenIds.includes(this.logCitizenId))&&this.matches(e.message));
    p.heading(`${rows.length} ACONTECIMENTOS / ${this.logLive?'AO VIVO':'CONGELADO'}`);p.note(this.logLive?'Registros mais recentes primeiro.':'A visualização está congelada; a simulação continua.',C.muted);
    this.events(p,rows.slice(0,this.logLimit));if(rows.length>this.logLimit)p.button('CARREGAR MAIS REGISTROS',()=>{this.logLimit+=80;});
  }
  exportLog() {
    const events = (this.logLive ? this.city.events : this.frozenEvents || []).filter(e => (this.logCategory === 'all' || this.logCategory === e.category) && (!this.logCitizenId || e.citizenIds.includes(this.logCitizenId)) && this.matches(e.message));
    const blob = new Blob([JSON.stringify({ version: 1, cityMinute: this.city.minute, rules: SOCIAL_RULES, events }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `suburban-historico-dia-${this.city.day}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  startWorld(seed, terrain) { const url = new URL(window.location.href); url.searchParams.set('seed', seed); url.searchParams.set('terrain', terrain); window.location.assign(url.href); }
}
