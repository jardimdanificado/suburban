import {renderMobility,renderVehicle,renderAssembly} from './city_vehicles_ui.js';
import {appearance,GARMENT_TYPES,CLOTHING_STYLES,brandPreference,clothingPreference} from './city_clothing.js';
import {newsroomGenre} from './city_newspapers.js';
import {renderPartyOrganizationWindow} from './city_party_organization_ui.js';
import {renderPartyDossier,renderContractDossier,renderPollResponseDossier} from './city_government_records_ui.js';
import {renderElectionMonitor} from './city_election_ui.js';
import {sectionTitle} from './city_ui_sections.js';
import {renderGovernmentDashboard} from './city_ui_dashboard.js';
import {ROTATION_LABELS} from './city_building_geometry.js';
import { renderPublications } from './city_publications_ui.js';
import { renderCorruptionDirectory, renderCorruptionInspector, corruptionCases } from './city_corruption_ui.js';
import {renderEventInspector} from './city_event_inspector.js';
import { formatMoney } from './city_ui_format.js';
import { carryCapacity } from './city_markets.js';
import { renderPolitics, renderCitizenPolitics, renderPoliticsNavigation } from './city_politics_ui.js';
import { BOND_LABELS, ROMANCE_LABELS, ORIENTATION_LABELS, GENDER_LABELS, RELATIONSHIP_RULES } from './city_relationships.js';
import { TRAIT_LABELS, HOUSE_STYLES } from './city_culture.js';
import { REPUTATION_LABELS } from './city_reputation.js';
import { PLANT_SPECIES, NATURE_RULES } from './city_nature.js';
import { HISTORY_LIMIT } from './city_history.js';
import { INDUSTRIES } from './city_industries.js';
import { SANITATION_RULES } from './city_sanitation.js';
import { inventoryUsed, inventoryFree, incomingItems } from './city_inventory.js';
import { MANAGEMENT_THEME as T, readableLabel, bevel } from './management_ui.js';
import { clipCanvasRegion } from './canvas_widgets.js';
import { UIPage as Page, UI_COLORS as C, fitText as trim } from './city_ui_widgets.js';
import { SKILLS, CROPS, GOODS, JOB_SKILL } from './city_economy.js';
import { WORLD_PRESETS, randomWorldSeed } from './world_settings.js';
import { EVENT_CATEGORIES, relationLabel, SOCIAL_RULES } from './city_society.js';
import { BUILDING_TYPES, NEED_LABELS } from './city_simulation.js';
export const money = formatMoney;
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
  city: [['overview', 'PANORAMA'], ['needs', 'NECESSIDADES'], ['activity', 'ATIVIDADE'], ['nature','VEGETAÇÃO']],
  government: [['overview', 'PREFEITURA'], ['elections','POLÍTICA'], ['contracts', 'CONTRATOS'], ['finance', 'TESOURO'], ['world', 'TERRENO']],
  land: [['plots', 'TERRENOS'], ['projects', 'OBRAS']],
  production: [['stocks', 'ESTOQUES'], ['demand', 'DEMANDAS'], ['flow', 'MOVIMENTAÇÕES'], ['lighting','ILUMINAÇÃO']],
  transport: [['active', 'FRETES'], ['finished', 'ENCERRADOS'], ['vehicles','FROTA'], ['lines','ÔNIBUS'], ['models','MODELOS'], ['airspace','TRÁFEGO AÉREO']],
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
    this.worksBudgetInput=document.createElement('input');this.worksBudgetInput.type='number';this.worksBudgetInput.min='0';this.worksBudgetInput.step='1';this.worksBudgetInput.value='5000000';this.worksBudgetInput.setAttribute('aria-label','Novo orçamento de obras solicitado');
    this.worksTransferInput=document.createElement('input');this.worksTransferInput.type='number';this.worksTransferInput.min='1';this.worksTransferInput.step='1';this.worksTransferInput.value='250000';this.worksTransferInput.setAttribute('aria-label','Valor da transferência solicitada para obras');
    this.populationInput = document.createElement('input'); this.populationInput.type = 'number'; this.populationInput.min = '1'; this.populationInput.max = '2000'; this.populationInput.step = '1'; this.populationInput.value = String(city.initialPopulation ?? 512); this.populationInput.setAttribute('aria-label', 'Número de cidadãos da próxima cidade');
    this.filterInput=document.createElement('select');this.filterInput.setAttribute('aria-label','Filtrar registros');this.filterInput.addEventListener('change',()=>this.setFilter(this.filterInput.value));
    this.sortInput=document.createElement('select');this.sortInput.setAttribute('aria-label','Ordenar registros');this.sortInput.addEventListener('change',()=>{this.sorts[this.tab]=this.sortInput.value;this.resetScroll();});
    this.publicationDraft=document.createElement('input');this.publicationDraft.type='text';this.publicationDraft.maxLength=1200;this.publicationDraft.placeholder='Escreva um relato, informação, anúncio ou invenção…';this.publicationDraft.setAttribute('aria-label','Conteúdo a escrever no livro ou panfleto');
    this.element.append(this.search,this.seed,this.populationInput,this.filterInput,this.sortInput,this.publicationDraft,this.worksBudgetInput,this.worksTransferInput);
    this.terrain = city.world.preset || Object.keys(WORLD_PRESETS)[0];
  }
  resetScroll() { this.scrolls = {}; }
  cachedList(key,build){
    this.listCache??=new Map();const signature=`${this.city.minute}:${this.city.structureRevision}:${this.city._uiRevision||0}:${this.query}:${this.filter()}:${this.sorts[this.tab]}:${Math.floor(performance.now()/250)}`;
    const old=this.listCache.get(key);if(old?.signature===signature)return old.rows;const rows=build();if(this.listCache.size>=32&&!this.listCache.has(key))this.listCache.delete(this.listCache.keys().next().value);this.listCache.set(key,{signature,rows});return rows;
  }
  section(p,key,title,render,initial=false){const open=this.helpOpen[key]??initial;p.disclosure(title,open,()=>{this.helpOpen[key]=!open;});if(open)render(p);}

  remember() {
    const route={};for(const key of ['politicsTab','approvalView','councilView','mandateView','memoryView','demandTab','stockView','projectView','selectedShipmentId','selectedVehicleId','publicationSourceEventId','eventTab','corruptionTab','publicationTab','partyOrganizationView','electionDetailView','billId','termId','pollId','electionId','studyId','partyProposalId','selectedPublicationId','recordWindow'])route[key]=this[key];
    this.history.push({ ...route, tab: this.tab, selected: this.selected, selectedPlotId: this.selectedPlotId, unitId: this.unitId, detailTab: this.detailTab, mobileDetail: this.mobileDetail, query: this.query, views: { ...this.views }, filters: { ...this.filters }, scrolls: { ...this.scrolls } });
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
    if(this.host&&(filter||view))return this.openPanel({tab,views:{[tab]:view||VIEWS[tab]?.[0][0]||'overview'},filters:{[tab]:filter||'all'}});
    const target=this.host?this.host.openModule(tab):this;if(!this.host)this.navigate(tab);if(filter!==null)target.setFilter(filter);if(view!==null)target.setView(view);return target;
  }
  sectionTitle(){return sectionTitle(this);}
  openPanel(overrides={}){return this.host?this.host.openPanel(this,overrides):Object.assign(this,overrides);}
  showView(id){return this.openPanel({views:{...this.views,[this.tab]:id},...(this.tab==='government'&&id==='elections'?{politicsTab:this.politicsTab||'overview'}:{} )});}
  openCurrentInWindow(){if(!this.host)return;return this.host.openPanel(this,{tab:this.tab,views:{...this.views},filters:{...this.filters},sorts:{...this.sorts}},{separate:true});}
  openParty(id){return this.host?.openParty(id);}
  openContract(id){return this.host?.openContract(id);}
  openHistory(reference=null,overrides={}){return this.openPanel({tab:'log',query:'',selected:null,logCategory:'all',logReference:reference,logCitizenId:null,logBuildingId:null,logAccountId:null,logLimit:80,logLive:true,scrolls:{},...overrides});}
  view() { return this.views[this.tab] || VIEWS[this.tab]?.[0][0] || 'overview'; }
  setView(id) { this.selectedProjectId=null; this.views[this.tab] = id; this.resetScroll(); }
  filter() { return this.filters[this.tab] || 'all'; }
  setFilter(id) { this.filters[this.tab] = id; this.resetScroll(); }
  setSelection(entity, unitId = null) {
    if (entity !== this.selected || unitId !== this.unitId) this.remember();
    const target = entity?.properties.cityVehicle?'transport':entity?.properties.citizen ? 'people' : entity?.properties.cityBuilding ? (this.tab === 'economy' && this.city.economy.businesses.some(b=>b.id===entity.id) ? 'economy' : 'buildings') : this.tab;
    const sameDirectory = this.tab === target, listScroll = this.scrolls.list || 0;
    this.tab = target; this.selected = entity; this.unitId = unitId; this.detailTab = unitId ? 'units' : 'profile'; this.visible = true;
    this.mobileDetail = !!entity; if (!sameDirectory) { this.query = ''; this.search.value = ''; } this.menuOpen = false; this.resetScroll(); if (sameDirectory) this.scrolls.list=listScroll;
  }
  toggle() { this.visible = !this.visible; this.element.hidden = !this.visible; }
  setPlotSelection(id) { if(this.host)return this.host.setPlotSelection(id); if(this.tab==='land')this.remember(); this.navigate('land'); this.selectedPlotId = id; this.setView('plots'); this.visible = true; }
  openCitizen(id) { const c = this.city.society.citizen(id); if (c) this.select(c.entity); }
  openBuilding(id) { const b = this.city.building(id); if (b) this.select(b.entity); }
  personLog(id) { this.openHistory(null,{logCitizenId:id}); }
  matches(value) { if(!this.query)return true;if(this.normalizedQuerySource!==this.query){this.normalizedQuerySource=this.query;this.normalizedQuery=normalize(this.query);}return normalize(value).includes(this.normalizedQuery); }
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
  beginInputs(){this.frameInputs??=new Set();this.frameInputs.clear();}
  finishInputs(){for(const input of[this.search,this.seed,this.populationInput,this.filterInput,this.sortInput,this.publicationDraft,this.worksBudgetInput,this.worksTransferInput]){const hidden=!this.frameInputs?.has(input);if(input.hidden!==hidden)input.hidden=hidden;}}
  inputAt(input,x,y,w){this.frameInputs?.add(input);const signature=`${x}:${y}:${w}`;if(input.layoutSignature!==signature){Object.assign(input.style,{left:`${x}px`,top:`${y}px`,width:`${w}px`});input.layoutSignature=signature;}if(input.hidden)input.hidden=false;}
  drawFloating(ui,window) {
    this.floating=true;this.politicsNavigationPinned=false;this.floatingDossier=window.kind==='dossier';if(this.element.hidden)this.element.hidden=false;this.visible=true;this.zones=[];this.beginInputs();
    this.bounds={x:window.x,y:window.y,w:window.w,h:window.h};if(window.shaded){this.finishInputs();return;}
    const x=window.x+5,w=window.w-10,bottom=window.y+window.h-21;let y=window.y+25;
    if(!this.floatingDossier){
      const search=!['event','corruption-case'].includes(this.tab)&&(this.tab!=='city'||this.view()!=='overview')&&(this.tab!=='government'||this.view()!=='overview');
      if(search){this.search.placeholder=this.tab==='people'?'Buscar pessoa…':'Pesquisar…';this.inputAt(this.search,x+5,y,w-10);y+=23;}
      const views=VIEWS[this.tab];if(views){const p=new Page(ui,x+4,y,w-8,y,bottom);p.links(views.map(([id,label])=>({label,selected:this.view()===id,click:()=>this.showView(id)})));y=p.y;}
      if(this.tab==='government'&&this.view()==='elections'){const nav=new Page(ui,x+4,y,w-8,y,bottom);renderPoliticsNavigation(this,nav);y=nav.y;this.politicsNavigationPinned=true;}
    }
    this.pane(ui,this.floatingDossier?`detail:${this.selected?.id}:${this.detailTab}`:['people','buildings','economy'].includes(this.tab)?'list':this.tab+':'+this.view(),x,y,w,Math.max(24,bottom-y),p=>{
      if(this.floatingDossier)this.detail(p);else if(['people','buildings','economy'].includes(this.tab))this.directory(p);else this.content(p);
    });this.finishInputs();
  }
  draw(ui) {
    this.politicsNavigationPinned=false;
    this.element.hidden=!this.visible;this.beginInputs();this.zones=[];
    if(!this.visible){this.finishInputs();return;}
    const w=Math.min(ui.width-12,this.expanded?ui.width-24:1088),x=ui.width-w-6,y=42,h=Math.max(140,ui.height-y-(ui.width<700?78:48)),desktop=w>=940;
    this.bounds={x,y,w,h};this.layout={desktop,compact:w<700};const info=TABS.find(t=>t[0]===this.tab)||TABS[0];
    ui.panel(x,y,w,h,'Suburban — Administração da cidade','');ui.button(x+w-92,y+4,50,22,this.expanded?'><':'<>',()=>{this.expanded=!this.expanded;});ui.button(x+w-36,y+4,28,22,'X',()=>this.toggle(),{danger:true});
    const navWidth=desktop?158:0;
    if(desktop)this.pane(ui,'navigation',x+8,y+36,navWidth-12,h-68,p=>{p.y=this.navigation(ui,p.x,p.y,p.w,p.top,p.bottom);});
    const bx=x+navWidth+16,bw=w-navWidth-32;let by=y+39;
    if(desktop){ui.text(info[1],bx,by,T.ink,2);if(this.host&&!this.sectionWindow)ui.button(bx+bw-112,by,108,26,'↗ OUTRA JANELA',()=>this.openCurrentInWindow());if(this.history.length)ui.button(bx+bw-218,by,92,26,'< VOLTAR',()=>this.back());by+=38;}
    else{ui.button(bx,by,78,28,'MENU',()=>{this.menuOpen=!this.menuOpen;},{selected:this.menuOpen});ui.text(trim(info[1],bw-160),bx+90,by+6,T.ink);if(this.host&&!this.sectionWindow)ui.button(bx+bw-(this.history.length?94:62),by,62,28,'↗',()=>this.openCurrentInWindow());if(this.history.length)ui.button(bx+bw-28,by,28,28,'<',()=>this.back());by+=38;}
    const listMode=['people','buildings','economy'].includes(this.tab),split=listMode&&bw>=680;
    this.search.placeholder=this.tab==='people'?'Buscar nome ou atividade…':this.tab==='log'?'Buscar acontecimento…':'Pesquisar nesta janela…';this.inputAt(this.search,bx,by,split?254:bw);by+=38;
    const views=VIEWS[this.tab];if(views){const row=new Page(ui,bx,by,bw,by,y+h-24);row.links(views.map(([id,label])=>({label,selected:this.view()===id,click:()=>this.showView(id)})));by=row.y;}
    if(listMode&&!split){const tw=Math.floor((bw-6)/2);ui.button(bx,by,tw,28,'LISTA',()=>{this.mobileDetail=false;},{selected:!this.mobileDetail});ui.button(bx+tw+6,by,tw,28,'FICHA',()=>{this.mobileDetail=true;},{selected:this.mobileDetail});by+=38;}
    const bh=Math.max(16,y+h-by-29);
    if(split){this.pane(ui,'list',bx,by,254,bh,p=>this.directory(p));this.pane(ui,`detail:${this.selected?.id}:${this.detailTab}`,bx+268,by,bw-268,bh,p=>this.detail(p));}
    else this.pane(ui,listMode?(this.mobileDetail?`detail:${this.selected?.id}:${this.detailTab}`:'list'):this.tab+':'+this.view(),bx,by,bw,bh,p=>{if(listMode){if(this.mobileDetail)this.detail(p);else this.directory(p);}else this.content(p);});
    const s=this.city.stats(),footer=bw>600?`${stamp(this.city.minute)}  •  ${s.population} habitantes  •  Tesouro: ${money(s.treasury)}`:`${stamp(this.city.minute)}  •  ${s.population} habitantes`;
    ui.text(trim(footer,w-28),x+14,y+h-22,T.muted);
    if(this.menuOpen&&!desktop){
      this.frameInputs.clear();this.zones=[];const my=y+74,mh=h-102;
      ui.panel(bx-3,my,bw+6,mh,'Janelas da cidade','');this.pane(ui,'navigation',bx+6,my+34,bw-12,mh-42,p=>{p.y=this.navigation(ui,p.x,p.y,p.w,p.top,p.bottom);});
    }this.finishInputs();
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
    if(document.activeElement!==input&&input.value!==value)input.value=value;if(y>=p.top&&y+20<=p.bottom)this.inputAt(input,x,y,w);
  }
  filterButtons(p) {
    const options=FILTERS[this.tab];if(!options)return;p.note('Mostrar',T.muted);this.nativeSelect(this.filterInput,p,options,this.filter(),p.x,p.y,Math.min(p.w,320));p.space(24);
  }
  pane(ui, key, x, y, w, h, draw) {
    const scroll = this.scrolls[key] || 0;
    bevel(ui.ctx,x,y,w,h,{inset:true,fill:key==='navigation'?T.face:T.paper});
    const p = new Page(ui, x+8, y+4 - scroll, w - 22, y+4, y + h-4);
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
    const cw=Math.floor((p.w-6)/2),iy=p.y+13;
    if(p.visible(18)){p.ui.text('Mostrar',p.x,p.y,T.muted);p.ui.text('Ordenar',p.x+cw+6,p.y,T.muted);}
    this.nativeSelect(this.filterInput,p,FILTERS[this.tab],this.filter(),p.x,iy,cw);this.nativeSelect(this.sortInput,p,sorts,sort,p.x+cw+6,iy,cw);p.space(36);
    const filter=this.filter();
    if(people){
      const rows=this.cachedList('people',()=>{const rows=city.citizens.filter(c=>this.matches(`${name(c.entity)} ${c.action} ${c.profession}`)).filter(c=>filter==='all'||filter==='homeless'&&!c.homeUnitId||filter==='unemployed'&&city.society.isAdult(c)&&!c.jobId&&!c.businessIds.length||filter==='critical'&&Math.min(...Object.values(c.needs))<20||filter==='food'&&c.needs.food<30||filter==='children'&&!city.society.isAdult(c));
      rows.sort((a,b)=>sort==='cash'?b.balance-a.balance:sort==='needs'?Math.min(...Object.values(a.needs))-Math.min(...Object.values(b.needs)):name(a.entity).localeCompare(name(b.entity),'pt-BR'));return rows;});
      p.note(`${rows.length} resultados`,C.muted);
      p.rows(rows,c=>{const critical=Math.min(...Object.values(c.needs))<20,role=c.id===city.economy.mayorId?(city.politics.isProvisionalMayor(c)?'Prefeito provisório':'Prefeito'):c.id===city.politics.viceMayorId?'Vice-prefeito':!city.society.isAdult(c)?'Criança':c.businessIds.length?'Empresário':city.building(c.jobId)?.entity.properties.name||'Sem trabalho';
        p.record(name(c.entity),`${city.society.age(c)} anos · ${c.homeUnitId?role:'Sem casa · '+role}`,()=>this.openCitizen(c.id),this.selected?.id===c.id,{value:money(c.balance),color:critical?C.red:!c.homeUnitId?C.gold:C.green});
      });
      if(!rows.length)p.note('Nenhuma pessoa com estes filtros.');
    } else {
      const residences=['residential','popular_housing','luxury_housing'],food=['farm','bakery','market','greengrocer','popular_refectory'],services=['cleaner','carrier','paid_toilet','public_toilet','waste_collector'],rows=this.cachedList(`buildings:${business}`,()=>{const rows=(business?city.economy.businesses:city.buildings.filter(b=>!b.entity.destroyed)).filter(b=>this.matches(`${name(b.entity)} ${BUILDING_TYPES[b.type].label} ${CROPS[b.crop]?.label||''}`)).filter(b=>filter==='all'||filter==='residential'&&residences.includes(b.type)||filter==='public'&&!b.ownerId&&!residences.includes(b.type)||filter==='private'&&!!b.ownerId||filter==='food'&&(food.includes(b.type)||INDUSTRIES[b.type]?.category==='food')||filter==='services'&&(services.includes(b.type)||INDUSTRIES[b.type]?.category==='services')||filter==='industry'&&(['builder','quarry','recycler','mill'].includes(b.type)||INDUSTRIES[b.type]?.category==='industry'));
      rows.sort((a,b)=>sort==='cash'?b.balance-a.balance:name(a.entity).localeCompare(name(b.entity),'pt-BR'));return rows;});p.note(`${rows.length} resultados`,C.muted);
      p.rows(rows,b=>p.record(name(b.entity),`${CROPS[b.crop]?.label||BUILDING_TYPES[b.type].label} · ${business?b.workers.length+'/'+b.jobs+' na equipe':b.units.length+' espaços'}`,()=>this.openBuilding(b.id),this.selected?.id===b.id,{value:business?money(b.balance):b.floors+' andares',color:b.active?C.green:residences.includes(b.type)?C.cyan:C.gold}));
      if(!rows.length)p.note('Nenhuma instalação com estes filtros.');
    }
  }
  detail(p) {
    if(this.selected?.properties.cityVehicle)return renderVehicle(this,p,this.selected.properties.cityVehicle);
    const c = this.selected?.properties.citizen, b = this.selected?.properties.cityBuilding;
    if (this.tab === 'people' && c && this.city.society.citizen(c.id)) return this.citizen(p, c);
    if (this.tab !== 'people' && b && !b.entity.destroyed) return this.building(p, b);
    p.heading('FICHA DE OBSERVAÇÃO'); p.note('Selecione alguém na lista para acompanhar sua rotina, seus vínculos e suas finanças. A seleção no mapa também abre a ficha.');
    if (this.tab === 'economy') this.demands(p);
  }
  dossierTabs(p, tabs) {
    p.links(tabs.map(([id, label]) => ({ label, selected: this.detailTab === id, click:()=>this.openPanel({detailTab:id}) })));
    p.space(3);
  }
  homeLabel(id) {
    const home=this.city.housing.homes.get(id);if(!home)return 'Sem moradia';
    const homes=[...this.city.housing.homes.values()].filter(h=>h.buildingId===home.buildingId),room=this.city.units.get(home.unitIds[0]);
    return `Casa ${homes.indexOf(home)+1} / ${(room?.z||0)+1}º andar`;
  }
  citizen(p, c) {
    const city = this.city, society = city.society;
    if(!this.floatingDossier)p.heading(name(c.entity), C.gold); p.note(`${society.age(c)} anos · ${c.id===city.economy.mayorId?(city.politics.isProvisionalMayor(c)?'Prefeito provisório':'Prefeito'):c.businessIds.length?'Empresário':'Morador'} · Carga: ${carryCapacity(c)} itens`);
    p.button('LOCALIZAR NO MAPA', () => { this.camera(c.entity.x, c.entity.y); if(!this.host)this.visible = false; });
    this.dossierTabs(p, [['profile', 'PERFIL'], ['skills', 'TRABALHO'], ['family', 'VÍNCULOS'], ['memories','MEMÓRIAS'], ['politics','POLÍTICA'], ['assets', 'CONTA'], ['history', 'HISTÓRICO']]);
    if (this.detailTab === 'profile') {

      p.heading('ROTINA ATUAL'); p.note(c.action, C.cyan);
      if(c.ridingVehicleId)p.button('VER VEÍCULO EM USO',()=>this.openPanel({tab:'transport',views:{transport:'vehicles'},selectedVehicleId:c.ridingVehicleId,selected:null}));
      this.section(p,'personalVehicles','Veículos próprios',()=>{for(const v of city.vehicles.units.values())if(v.active&&v.ownerAccountId===c.accountId)p.record(city.vehicles.model(v)?.name||v.good,`${v.condition.toFixed(0)}% de conservação · ${v.fuel.toFixed(0)} células de autonomia`,()=>this.openPanel({tab:'transport',views:{transport:'vehicles'},selectedVehicleId:v.id,selected:null}));});
      const inside=city.building(c.indoorLocation?.buildingId);
      if(inside){p.kv('Localização',`Dentro de ${name(inside.entity)} · ${c.indoorLocation.floor+1}º andar`);p.kv('Cômodo',{bedroom:'Quarto',bathroom:'Banheiro',dining:'Refeitório',plenary:'Plenário',office:'Gabinete',workspace:'Área da empresa'}[c.indoorLocation.roomType]||'Interior');p.button('VER PRÉDIO ATUAL',()=>this.openBuilding(inside.id));}
      p.metrics([['FELICIDADE',`${Math.round(c.happiness)}%`,c.happiness<30?C.red:C.green],['SALDO',money(c.balance),C.gold]]); p.kv('Provisões', `${c.provisions} refeições`); p.kv('Estado da moradia', c.homeUnitId ? 'Abrigado' : 'Morando na rua');
      p.heading('NECESSIDADES'); p.meters(Object.entries(c.needs).map(([id,value])=>[NEED_LABELS[id],value]));
      const home = city.units.get(c.homeUnitId), dwelling = city.housing.home(c); p.heading('MORADIA');
      if (dwelling) { p.kv('Casa', this.homeLabel(dwelling.id)); p.kv('Cômodos', city.housing.units(dwelling).map(u => ({ bathroom: 'Banheiro', dining: 'Refeitório', bedroom: 'Quarto' }[u.roomType] || 'Espaço')).join(' + ')); p.kv('Aluguel total/dia', money(city.housing.rent(dwelling, c))); p.kv(city.housing.isSocial(dwelling)?'Regime':'Valor de compra da casa',city.housing.isSocial(dwelling)?'Ocupação social gratuita':money(city.housing.price(dwelling))); }
      p.note(city.housing.isSocial(dwelling)?'Moradia popular municipal: ocupação gratuita, sem cobrança de aluguel e sem transferência de propriedade.':'Moradia e alimentação dependem da renda e das reservas. A falta de pagamento por três dias pode encerrar o aluguel.', C.gray);
      if (home) { p.kv('Espaço',`${home.x+1}, ${home.y+1} / ${home.z+1}º andar`); p.kv('Regime', city.housing.isSocial(dwelling)?'Moradia social gratuita':home.ownerId === c.accountId ? 'Proprietário' : home.tenantId !== c.accountId && dwelling ? 'Moradia compartilhada' : 'Inquilino'); p.button(name(city.building(home.buildingId)?.entity), () => this.openBuilding(home.buildingId)); }
      else p.note('Sem moradia', C.red);
      this.section(p,'wardrobe','Roupas, aparência e marcas',()=>{p.meter('Apresentação',appearance(c));p.note('Roupa bem conservada e de um estilo preferido melhora o bem-estar e a credibilidade; a experiência e a reputação continuam importantes.');p.kv('Preferências por peças',GARMENT_TYPES.map(g=>`${g}: ${Math.round(clothingPreference(c.id,g)*100)}`).join(' · '));p.kv('Preferências por estilos',CLOTHING_STYLES.map(g=>`${g}: ${Math.round(clothingPreference(c.id,g)*100)}`).join(' · '));for(const [i,g]of (c.wardrobe||[]).entries())p.record(`${i===(c.wearingIndex||0)?'Vestindo: ':''}${g.piece} · ${g.style}`,`${g.brandName} · conservação ${g.condition.toFixed(0)}% · qualidade ${g.quality.toFixed(0)}%`,g.brandId?()=>this.openBuilding(g.brandId):()=>{});for(const b of city.economy.businesses.filter(b=>['tailor','clothing_store'].includes(b.type)).slice(0,12))p.kv(`Afinidade: ${b.entity.properties.name}`,`${brandPreference(c,b.id)>0?'Gosta':'Não gosta'} (${Math.round(brandPreference(c,b.id)*100)})`);});
      this.section(p,'personality','Identidade, personalidade e reputação',()=>{p.heading('IDENTIDADE E PERSONALIDADE');
      p.kv('Gênero',GENDER_LABELS[c.socialProfile.gender]);p.kv('Interesse romântico',ORIENTATION_LABELS[c.socialProfile.orientation]);
      p.kv('Luto',city.relationships.moodEffect(c)<0?'Em luto':'Sem perda recente');p.kv('Sobrenomes da família',(c.surnames||[]).join(' / '));
      p.meters(Object.entries(TRAIT_LABELS).map(([id,label])=>[label,(c.traits?.[id]??.5)*100,C.cyan]));
      p.note('Dedicação afeta aprendizado e contratação; empatia, honestidade e ceticismo afetam encontros; risco influencia investimentos; frugalidade afeta poupança e preço da refeição; ambição influencia candidaturas.');
      this.reputationPanel(p,c);
      if(c.lastSocialEventId)p.button('ÚLTIMA INTERAÇÃO SOCIAL',()=>this.openEvent(c.lastSocialEventId));
      });this.section(p,'foodPreferences','Preferências alimentares',()=>{p.heading('PREFERÊNCIAS ALIMENTARES');
      for (const [good, value] of Object.entries(c.foodPreferences || {}).filter(([g]) => GOODS[g] && !['girassol','trigo'].includes(g))) p.kv(GOODS[good].label, value > .2 ? `Gosta (${Math.round(value * 100)})` : value < -.2 ? `Não gosta (${Math.round(value * 100)})` : 'Neutro');
      if (c.lastMealTaste !== undefined) p.kv('Última refeição', c.lastMealTaste >= 0 ? 'Agradou ao paladar' : 'Desagradou ao paladar');});
    } else if (this.detailTab === 'skills') {
      p.heading('HISTÓRICO DE EMPREGO');
      for(const entry of city.history.rows(c.accountId,'employment').slice(-8).reverse()){p.note(`${stamp(entry.minute)} | ${entry.message}`);p.kv('Salário base/hora na ocasião',money(entry.wage*60));}
      p.heading('TRABALHO'); const job = city.building(c.jobId);
      if (job) p.button(name(job.entity), () => this.openBuilding(job.id));
      else p.note(c.businessIds.length ? 'Empresário' : society.isAdult(c) ? 'Sem emprego' : 'Criança');
      p.kv('Salário líquido hoje', money(c.salaryToday));p.kv('Imposto retido hoje',money(c.taxPaidToday||0));p.kv('Complemento municipal hoje',money(c.wageSubsidyToday||0)); p.kv('Vale-alimentação hoje', money(c.mealAllowanceToday)); p.note('As habilidades aumentam com a prática e influenciam contratação e remuneração.');
      p.meters(Object.entries(c.skills).map(([id,v])=>[SKILLS[id],v,C.cyan]));
    } else if (this.detailTab === 'history') {
      this.journal(p,c.accountId);
    } else if (this.detailTab === 'family') {
      p.heading('FAMÍLIA', C.pink);
      const link = (label, id) => { const person = society.citizen(id); p.note(label); if (person) p.button(name(person.entity), () => this.openCitizen(id)); else p.note(city.accountName(`citizen:${id}`)); };
      if (c.partnerId) link('Companheiro(a)', c.partnerId); else p.note('Sem relacionamento amoroso.');
      for (const id of c.parentIds) link('Filiação', id);
      for (const id of c.childIds) link('Filho(a)', id);
      if (!society.isAdult(c)) link('Responsável', c.guardianId);
      const pregnancy = society.expecting.find(e => e.id === c.expectingId); if (pregnancy) p.note(`Filho esperado: ${stamp(pregnancy.dueAt)}`, C.pink);
      p.note(`${c.personality.wantsRomance ? 'Aberto a relacionamentos' : 'Prefere ficar solteiro'} / ${c.personality.wantsChildren ? 'Deseja ter filhos' : 'Não planeja filhos'}`);
      this.relationshipPanel(p,c);
    } else if (this.detailTab === 'memories') {
      this.socialMemories(p,c);
    } else if (this.detailTab === 'politics') {
      renderCitizenPolitics(this,p,c);
      p.windowLink('INTERVIR NA IMAGEM E NA CAMPANHA',()=>this.openPanel({tab:'government',views:{government:'elections'},politicsTab:'interventions',interventionTargetId:c.id,interventionView:'opinion'}));
      if(city.politics.canRun(c,'mayor',true)){p.buttons([{label:'PESQUISAR PRIORIDADES PARA PROMESSAS',click:()=>city.politics.getResearch().commissionService(c.accountId,'public-priorities',c.id)},{label:'PESQUISAR MINHA APROVAÇÃO',click:()=>city.politics.getResearch().commissionService(c.accountId,'candidate-potential',c.id)}]);}
    } else {
      p.heading('CONTA PESSOAL'); p.kv('Dinheiro disponível', money(c.balance)); p.kv('Salário líquido hoje', money(c.salaryToday));p.kv('Complemento municipal hoje',money(c.wageSubsidyToday||0));p.kv('Complementos recebidos',money(c.wageSubsidyTotal||0));if(c.wageSubsidyUnpaidToday)p.kv('Complemento não pago por falta de caixa',money(c.wageSubsidyUnpaidToday));p.kv('Benefícios recebidos',money(c.benefitsReceived||0));p.kv('Poupança total',money(city.bank.savings(c.accountId)));
      p.buttons([{label:`POUPAR ${Math.round((c.savingsRate??.2)*100)}% DO EXCEDENTE`,click:()=>{city.setCitizenFinance(c.id,{savingsRate:(c.savingsRate??.2)>=.5?0:(c.savingsRate??.2)+.1});}},{label:c.creditAllowed===false?'CRÉDITO AUTOMÁTICO: NÃO':'CRÉDITO AUTOMÁTICO: SIM',click:()=>{city.setCitizenFinance(c.id,{creditAllowed:c.creditAllowed===false});}}]);
      const units = [...city.units.values()].filter(u => u.ownerId === c.accountId);
      p.kv('Imóveis próprios', units.length); p.kv('Valor anunciado total', money(units.reduce((s, u) => s + u.price, 0)));
      p.kv('Aluguel contratado/dia', money(units.filter(u => u.tenantId && u.tenantId !== c.accountId).reduce((s, u) => s + u.rent, 0)));
      const banks=city.buildings.filter(b=>b.type==='bank' && !b.entity.destroyed);
      for(const bank of banks) {
        const deposit=city.bank.deposits.get(`deposit:${bank.id}:${c.accountId}`);
        p.heading(name(bank.entity));p.kv('Seu depósito',money(deposit?.balance||0));p.kv('Rendimentos recebidos',money(deposit?.interestEarned||0));
        p.buttons([{label:'DEPOSITAR R$ 100',click:()=>{if(!city.bank.deposit(bank,c.accountId,10000))this.notice='Depósito indisponível: confira saldo e operação do banco.';}},{label:'SACAR DEPÓSITO',click:()=>city.bank.withdraw(bank,c.accountId,deposit?.balance||0)},{label:'PEDIR R$ 100',click:()=>{if(!city.bank.lend(bank,c.accountId,10000))this.notice='Crédito indisponível: é preciso ter renda, limite e caixa no banco.';}}]);
      }
      for(const loan of city.bank.loans.filter(l=>l.clientId===c.accountId)) {
        p.heading(`EMPRÉSTIMO ${loan.id}`);p.kv('Finalidade',loan.purpose==='business'?`Abertura de empresa / ${loan.installments||180} parcelas`:'Subsistência / 30 parcelas');if(loan.projectId)p.kv('Obra financiada',loan.projectId);p.kv('Banco',city.accountName(`business:${loan.bankId}`));
        if(loan.initialChain){p.kv('Linha de crédito','Primeira instalação da cadeia produtiva');p.kv('Carência',loan.operatingStartedAt==null?'Durante a construção':city.day<loan.dueDay&&loan.paid===0?`Até o dia ${loan.dueDay}`:`${loan.graceDays} dias após a abertura`);p.kv('Recursos do refinanciamento municipal',money(loan.publicRefinance||0));}
        p.kv('Principal a pagar',money(loan.remaining));p.kv('Juros pendentes',money(loan.interest));p.kv('Total pago',money(loan.paid));p.kv('Parcela de principal/dia',money(loan.dailyPayment));p.kv('Dias consecutivos em atraso',loan.missed);
        p.kv('Contrato',({active:'Ativo',paid:'Quitado',arrears:'Em atraso','written-off':'Encerrado com perda'})[loan.status]);p.kv('Taxa contratada/dia',`${(loan.rate*100).toFixed(2)}%`);
      }
      p.heading('EMPRESAS'); for (const id of c.businessIds) { const b = city.building(id); if (b) p.button(name(b.entity), () => this.openBuilding(id)); }
      p.heading('MOVIMENTAÇÕES RECENTES'); this.transactions(p, c.accountId);
    }
    p.button('LIVROS E PANFLETOS DESTA PESSOA',()=>{const state=this.go('publications');state.publicationOwner=c.accountId;state.selectedPublicationId=null;state.resetScroll();});
    p.button('VER HISTÓRICO DESTA PESSOA', () => this.personLog(c.id));
  }
  building(p, b) {
    const city = this.city;
    if(!this.floatingDossier)p.heading(name(b.entity)); p.note(`${BUILDING_TYPES[b.type].label} | ${b.width}x${b.depth}x${b.floors} | ${b.units.length} células`);
    p.button('LOCALIZAR NO MAPA', () => { this.camera(b.entity.x, b.entity.y); if(!this.host)this.visible = false; });
    this.dossierTabs(p, [['profile', 'OPERAÇÃO'], ['stock', 'ESTOQUE'], ['staff', 'EQUIPE'], ['finance','FINANÇAS'], ['infrastructure','ESTRUTURA'], ...(b.type === 'builder' ? [['services', 'SERVIÇOS']] : []), ['units', 'CÉLULAS'], ['history','HISTÓRICO']]);
    if (this.detailTab === 'profile') {
      p.metrics([['CAIXA',money(b.balance),b.balance<1000?C.red:C.cyan],['EQUIPE',`${b.workers.length}/${b.jobs}`,C.cyan]]);
      p.status(b.active?'EM ATIVIDADE':['residential','popular_housing','luxury_housing'].includes(b.type)?'MORADIA':'INSTALAÇÃO DISPONÍVEL',b.entity.properties.name,b.active?C.green:C.cyan);
      const missing=b.active&&INDUSTRIES[b.type]?Object.entries(INDUSTRIES[b.type].inputs).filter(([g,n])=>(b.inventory[g]||0)<n):[];
      if(missing.length)p.status('AGUARDANDO INSUMOS',missing.map(([g,n])=>`${GOODS[g].label}: ${b.inventory[g]||0}/${n}${b.incoming[g]?' · '+b.incoming[g]+' a receber':''}`).join(' · '),C.gold,()=>this.openPanel({detailTab:'stock'}));
      if(b.active&&b.jobs>0&&!b.workers.length&&!b.ownerId)p.status('SEM EQUIPE','Nenhum funcionário contratado para operar esta instalação.',C.red,()=>this.openPanel({detailTab:'staff'}));
      if(b.type==='council_chamber')p.kv('Bandeira da sede',b.governingFlagDescription||'Presidência ainda não eleita');
      const occupants=city.citizens.filter(c=>c.indoorLocation?.buildingId===b.id);
      this.section(p,'inside',`Pessoas no interior (${occupants.length})`,()=>{p.kv('Presentes',occupants.length);for(const c of occupants)p.record(name(c.entity),`${c.action} · ${c.indoorLocation.floor+1}º andar`,()=>this.openCitizen(c.id));});
      if(b.type==='newsroom'){p.kv('Linha editorial',newsroomGenre(b));p.kv('Última edição',b.newsEditionDay??'Ainda não impressa');p.kv('Exemplares produzidos hoje',b.newsPrintedDay===city.day?b.newsCopies:0);p.note(b.officialJournal?'Jornal obrigatório, custeado pela prefeitura. Cada edição usa quatro folhas e preserva até oito atos públicos; inclui votos individuais.':'Papel chega por transporte. Cada cópia consome 3–5 folhas; anúncios pagos são identificados no acervo.');p.button('ACERVO DO JORNAL',()=>this.openPanel({tab:'publications',publicationOwner:b.accountId,selectedPublicationId:null}));}

      const industry=INDUSTRIES[b.type];
      if(b.type==='automaker')renderAssembly(this,p,b);
      if(['engine_factory','chassis_factory','bodyworks','tire_factory','transmission_factory','automotive_glass','upholstery'].includes(b.type)){p.kv('Revisão da peça produzida',b.partDesign||1);p.button('INICIAR NOVA REVISÃO DA PEÇA',()=>city.vehicles.revisePart(b.id));}
      if(b.type==='dealership')for(const v of [...city.vehicles.units.values()].filter(v=>!v.active&&!v.scrapped&&v.holderAccountId===b.accountId))p.record(`${city.vehicles.model(v)?.brand} · ${city.vehicles.model(v)?.name}`,money(city.vehicles.vehiclePrice(v)),()=>this.openPanel({tab:'transport',views:{transport:'vehicles'},selectedVehicleId:v.id,selected:null}));
      if(b.type==='quarry')p.kv('Pedra restante nos depósitos',city.economy.quarryStatus(b).remaining);
      if(b.type==='forestry'){const trees=[...city.nature.plants.values()].filter(t=>t.buildingId===b.id);p.kv('Árvores cultivadas / maduras',`${trees.length} / ${trees.filter(t=>t.stage==='mature').length}`);p.kv('Sementes disponíveis',b.seedStock);p.note('Os trabalhadores cortam árvores no local, replantam com sementes e carregam a madeira até o depósito.');for(const c of city.citizens.filter(c=>c.forestryJob?.buildingId===b.id))p.card(name(c.entity),`${c.action} · ${c.forestryJob.load||0} madeiras em transporte`,()=>this.openCitizen(c.id));}
      if(b.type==='council_chamber'){const chamber=city.politics.council.getChamber();p.kv('Plenário',`${b.width*b.depth} células no térreo`);p.kv('Gabinetes / vereadores',`${chamber.officeCount||0} / ${city.politics.council.members.length}`);for(const member of city.politics.council.members.filter(m=>city.units.get(m.officeUnitId)?.buildingId===b.id))p.record(member.name,`Gabinete ${member.officeUnitId}`,()=>this.select(b.entity,member.officeUnitId));}
      if(b.type==='research_institute'){
        const studies=city.politics.getResearch().studies.filter(s=>s.instituteId===b.id),current=studies.find(s=>s.mode==='service'&&s.status==='collecting');p.kv('Pesquisas publicadas / em coleta',`${studies.filter(s=>s.status==='published').length} / ${studies.filter(s=>['funding','collecting'].includes(s.status)).length}`);p.kv('Trabalho da próxima pesquisa',current?`${current.responses.length}/${current.target} entrevistas`:'Sem contrato em execução');p.note('Institutos atendem pesquisas eleitorais e contratos anuais de opinião pública, aprovação de candidatos e demanda de mercado.');
        p.windowLink('COLETAS, FINANCIADORES E ENTREVISTADORES',()=>this.openPanel({tab:'government',views:{government:'elections'},politicsTab:'institutes',studyId:null}));
        for(const s of studies.slice(-3).reverse())p.record(`Coleta #${s.id}`,`${s.responses.length}/${s.target} entrevistas · ${money(s.funded)} recebidos`,()=>this.openPanel({tab:'government',views:{government:'elections'},politicsTab:'institutes',studyId:s.id}));
      }
      if(b.ownerId&&b.type!=='research_institute'&&INDUSTRIES[b.type]){p.button('CONTRATAR PESQUISA DE DEMANDA',()=>city.politics.getResearch().commissionService(b.accountId,'market-demand',b.id));const reports=city.politics.getResearch().studies.filter(s=>s.serviceType==='market-demand'&&s.subjectId===b.id&&s.status==='published').slice(-1);for(const report of reports)p.record(`Pesquisa de mercado #${report.id}`,`${report.report?.rows?.[0]?.label||'Relatório disponível'} · amostra ${report.report?.sampleSize||report.target}`,()=>this.openPanel({tab:'government',views:{government:'elections'},politicsTab:'research-services',studyId:report.id}));}
      if(b.type==='publisher'){p.kv('Páginas por novo livro',b.bookPages||5);p.note('Cada livro consome uma folha por página; panfletos consomem uma folha. Dois registros por página.');p.buttons([2,5,10,20,32].map(pages=>({label:`${pages} PÁGINAS`,selected:(b.bookPages||5)===pages,click:()=>city.publications.configure(b.id,pages)})));}
      if(industry){p.heading('CADEIA PRODUTIVA');p.note(industry.impact);p.note('Insumos: '+(Object.entries(industry.inputs).map(([g,n])=>`${n} ${GOODS[g].label}`).join(', ')||'Trabalho e recursos locais'));p.note('Produtos: '+(Object.entries(industry.outputs).map(([g,n])=>`${n} ${GOODS[g].label}`).join(', ')||'Crédito e guarda de depósitos'));if(b.type==='bank'){const line=city.bank.developmentLines?.find(l=>l.bankId===b.id);if(line){p.kv('Refinanciamento municipal recebido',money(line.principal));p.kv('Dívida do banco com o município',money(line.remaining));p.kv('Devolvido ao município',money(line.repaid));}p.kv('Depósitos protegidos',money([...city.bank.deposits.values()].filter(d=>d.bankId===b.id).reduce((n,d)=>n+d.balance,0)));p.kv('Crédito a receber',money(city.bank.loans.filter(l=>l.bankId===b.id && !['paid','written-off'].includes(l.status)).reduce((n,l)=>n+l.remaining+l.interest,0)));p.note(`Novos empréstimos: ${(city.bank.policy.loanRate*100).toFixed(2)}% ao dia; poupança: ${(city.bank.policy.savingsRate*100).toFixed(2)}% ao dia. Prazos: 30 parcelas para subsistência; 180 para empresas; 240 para iniciar cadeias, com carência durante a obra e 14 dias após a abertura. Depósitos são protegidos; rendimentos dependem do caixa do banco.`);}}
      p.kv('Arquitetura',HOUSE_STYLES[b.architecture]?.label||'Padrão');this.reputationPanel(p,b);
      if(b.type==='forestry'){const plants=[...city.nature.plants.values()].filter(t=>t.buildingId===b.id);p.kv('Árvores cultivadas',plants.length);p.kv('Maduras',plants.filter(t=>t.stage==='mature').length);p.kv('Sementes em germinação',city.nature.seeds.filter(t=>t.buildingId===b.id).length);p.note('Cada lote de madeira consome uma árvore madura a até 14 tiles. O corte replanta uma semente; árvores novas levam de 3 a 4 dias para crescer.');}
      p.kv('Tipo de ocupação', b.constructionKind === 'open-air' ? 'Ar livre / no nível do solo' : 'Edifício');
      p.button(`TERRENO ${b.plotId}`, () => this.setPlotSelection(b.plotId));
      p.kv('Situação', b.active ? 'Em atividade' : b.type === 'residential' ? 'Residencial' : 'Instalação disponível');
      if(b.type==='mint'){p.kv('Emitido hoje',money(city.currency.issuedToday));p.kv('Inflação acumulada',`${((city.currency.priceIndex-1)*100).toFixed(2)}%`);p.note('A emissão entra no tesouro e depende de um funcionário trabalhando nesta instalação.');}
      p.note('Proprietário da empresa'); if (b.ownerId) p.button(name(city.economy.citizen(b.ownerId)?.entity), () => this.openCitizen(b.ownerId)); else p.note(b.municipal?'Empresa municipal / patrimônio público':'Serviço público');

      if(b.type==='popular_housing'){const social=[...city.housing.homes.values()].filter(h=>h.buildingId===b.id && city.housing.isSocial(h));if(social.length){p.heading('OCUPAÇÃO SOCIAL');p.kv('Famílias abrigadas / moradias',`${social.filter(h=>city.housing.residents(h).length>0).length} / ${social.length}`);p.kv('Moradores',city.citizens.filter(c=>!c.entity.destroyed && social.some(h=>h.id===c.homeId)).length);p.kv('Adultos sem teto na cidade',city.citizens.filter(c=>!c.entity.destroyed && city.society.isAdult(c) && !c.homeUnitId).length);p.note('Ocupação gratuita com propriedade municipal. Famílias sem teto com dependentes e menos recursos têm prioridade.');}}
    } else if(this.detailTab==='finance'){
      p.heading('FINANÇAS E PROPRIEDADE');
      for(const loan of city.bank.loans.filter(l=>l.clientId===b.accountId&&l.purpose==='vehicle')){p.kv(`Crédito do veículo ${loan.vehicleId}`,money(loan.remaining+loan.interest));p.kv('Parcela diária',money(loan.dailyPayment));}
      p.metrics([[b.type==='townhall'?'SALDO MUNICIPAL':'CAIXA',money(b.balance),b.balance<1000?C.red:C.gold],['EQUIPE',`${b.workers.length}/${b.jobs}`,C.cyan]]); p.kv(b.type==='townhall'?'Entradas acumuladas':'Receita acumulada', money(b.totalRevenue)); p.kv(b.type==='townhall'?'Saídas acumuladas':'Despesas acumuladas', money(b.totalExpenses)); if(b.type==='townhall')p.note('Este saldo é o tesouro municipal, o mesmo exibido na barra. Recebe impostos e emissão e paga obras, benefícios e despesas da sede. Reservas de contratos já saíram do saldo disponível.');else p.kv('Dividendos pagos', money(b.dividends));
      const agreements=(city.economy.supplyAgreements||[]).filter(a=>a.buyerId===b.id||a.sellerId===b.id);if(agreements.length){p.heading('ACORDOS DE FORNECIMENTO');for(const a of agreements)p.note(`${GOODS[a.good].label}: ${city.accountName(city.building(a.sellerId)?.accountId)} → ${city.accountName(city.building(a.buyerId)?.accountId)}, ${money(a.unitPrice)}/unidade`);}if(b.equityPartners?.length){p.heading('SÓCIOS E CAPITAL');for(const share of b.equityPartners)p.note(`${city.accountName(`citizen:${share.citizenId}`)}: ${money(share.amount)}`);}
      p.heading('MOVIMENTAÇÕES RECENTES'); this.transactions(p, b.accountId);
    } else if(this.detailTab==='infrastructure'){
      p.heading('ESTRUTURA E SERVIÇOS DO IMÓVEL');
      p.kv('Andares / limite de ampliação',`${b.floors} / 12`);
      p.meter('Conservação',b.condition??100);
      const post = [...city.lighting.sites.values()].find(post => post.buildingId === b.id && !post.public && post.status !== 'cancelled');
      if (post) { p.kv('Responsável pela iluminação', city.accountName(post.payerId)); p.kv('Iluminação do imóvel', !post.built ? post.projectId ? 'Em construção' : 'Aguarda contratação' : post.lit ? 'Aceso' : post.fuel > 0 ? 'Apagado / dia' : 'Sem óleo'); p.kv('Óleo no poste', `${post.fuel} horas de iluminação`); }
      p.kv('Orientação da fachada',`${ROTATION_LABELS[b.rotation||0]} · ${(b.rotation||0)*90}°`);
      p.kv('Desnível do terreno',Number(b.terrain?.variation||0).toFixed(2));
      p.kv('Circulação comum',`${b.circulation?.length||0} células`);
      const facilities=[...city.sanitation.facilities.values()].filter(f=>f.buildingId===b.id);
      p.heading('BANHEIROS');
      if(!facilities.length)p.note('Nenhum banheiro cadastrado.');
      for(const f of facilities)p.meter(`Banheiro ${f.id} · limpeza`,f.cleanliness);
      p.heading('OBRAS NO IMÓVEL');
      const works=city.development.projects.filter(o=>o.buildingId===b.id&&!o.cancelled&&o.status!=='completed');
      if(!works.length)p.note('Nenhuma ampliação ou reparo em andamento.');
      for(const o of works)p.record(o.name,o.error||o.status,()=>this.openContract(o.id));
    } else if (this.detailTab === 'stock') {
      p.heading('INVENTÁRIO REAL'); p.kv('Capacidade', `${inventoryUsed(b)}/${b.inventoryCapacity} itens`); p.kv('Reservado para recebimento', incomingItems(b)); p.kv('Espaço livre', inventoryFree(b)); p.meter('Ocupação do armazém', inventoryUsed(b) / b.inventoryCapacity * 100, inventoryFree(b) < 12 ? C.red : C.cyan); for (const [id, spec] of Object.entries(GOODS)) p.kv(spec.label, b.inventory?.[id] || 0);
      if (b.type === 'quarry') p.kv('Reserva mineral restante', b.stoneReserve || 0);
      if(b.type==='farm'){const farm=city.economy.farmCapacity(b);p.heading('ÁREA E CAPACIDADE AGRÍCOLA');p.kv('Área total / cultivada',`${b.width*b.depth} / ${farm.area} tiles`);p.kv('Talhões',farm.fields);p.kv('Funcionários / postos totais',`${b.workers.length} / ${farm.jobs}`);p.kv('Colheita com todos os talhões',`${farm.harvest} unidades`);p.kv('Potencial estimado/dia',`${farm.daily} unidades`);p.note('Estimativa para 480 minutos de trabalho. Sementes, crescimento, equipe, refeições, transporte e capacidade do armazém limitam a produção real.');}
      if (b.crop) { p.heading(`CULTIVO / ${CROPS[b.crop].label}`); p.kv('Sementes', b.seedStock); for (const [i, f] of b.fields.entries()) { p.note(`Talhão ${i + 1}: ${f.plantedAt === null ? 'aguarda plantio' : 'em crescimento'}`); p.meter('Trabalho', f.labor / (f.requiredLabor||120) * 100); p.meter('Crescimento', f.plantedAt === null ? 0 : (city.minute - f.plantedAt) / CROPS[b.crop].grow * 100); } }
      if (b.type === 'bakery') p.note('Receita: trigo transformado em pão pelo trabalho da equipe.');
      p.heading('INSUMOS PROCURADOS'); const missing = Object.entries(b.inputDemand || {}).filter(([, qty]) => qty > 0);
      for (const [id, qty] of missing) p.kv(GOODS[id].label, qty); if (!missing.length) p.note('Nenhum insumo pendente.');
      p.kv('Ocorrências de falta', b.stockouts);
    } else if (this.detailTab === 'history') {
      this.journal(p,b.accountId);
    } else if (this.detailTab === 'staff') {
      p.kv('Postos ocupados', `${b.workers.length}/${b.jobs}`); p.kv('Salário base/hora', money(b.wage * 60));
      p.heading('ALIMENTAÇÃO DOS FUNCIONÁRIOS'); p.kv('Refeições fornecidas', b.mealsServed); p.kv('Compras para refeições', money(b.mealPurchaseCost)); p.kv('Vales pagos', `${b.vouchersIssued} / ${money(b.foodVoucherCost)}`); p.kv('Qualidade das refeições', b.mealQuality || 1);
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
      p.note('Espaços na fachada; miolo de circulação comum. Moradias populares municipais oferecem ocupação social gratuita; os demais imóveis mantêm seus contratos de compra ou aluguel.');
      let u = city.units.get(this.unitId); if (u?.buildingId !== b.id) u = b.units[0]; this.unitId = u?.id || null;
      this.unitMap(p,b,u);
      if (u) { p.heading(`ESPAÇO ${u.x+1}, ${u.y+1} / ${u.z+1}º ANDAR`); p.kv('Cômodo', { bedroom: 'Quarto', bathroom: 'Banheiro', dining: 'Refeitório', workspace: 'Área da empresa' }[u.roomType]); if (u.homeId) p.kv('Casa', this.homeLabel(u.homeId)); p.kv('Proprietário', city.accountName(u.ownerId)); this.accountLink(p, u.ownerId);
        p.kv('Ocupante', u.tenantId || u.occupantId ? city.accountName(u.tenantId || u.occupantId) : 'Livre'); this.accountLink(p, u.tenantId || u.occupantId);
        const social=city.housing.isSocial(city.housing.homes.get(u.homeId));p.kv('Venda',social?'Patrimônio público / sem venda':money(u.price)); p.kv('Aluguel/dia',social?'Gratuito':u.ownerId === 'treasury' ? 'Prefeitura não aluga' : money(u.rent)); p.kv('Em atraso', money(u.arrears)); p.kv('Anúncio',social?(u.tenantId?'Ocupação social':'Vaga social'):u.forSale ? 'À venda' : u.forRent ? 'Para alugar' : 'Uso próprio / ocupado'); }

    }
  }
  unitMap(p,b,selected) {
    p.heading('PLANTA DOS ESPAÇOS');
    p.buttons(Array.from({length:b.floors},(_,z)=>({label:`${z+1}º ANDAR`,selected:(selected?.z||0)===z,click:()=>{this.unitId=b.units.find(u=>u.z===z)?.id||null;}})));
    const size=Math.min(38,Math.floor(p.w/b.width)),height=b.depth*size,at=p.y;
    if(p.visible(height))for(let y=0;y<b.depth;y++)for(let x=0;x<b.width;x++){
      const u=b.units.find(u=>u.x===x&&u.y===y&&u.z===(selected?.z||0)),px=p.x+x*size,py=at+y*size;
      if(u){
        const label={bedroom:'Q',bathroom:'B',dining:'R',workspace:'E'}[u.roomType]||'E';
        p.ui.button(px,py,size-3,size-3,label,()=>{this.unitId=u.id;},{selected:u.id===selected?.id});
        p.ui.ctx.fillStyle=u.tenantId||u.occupantId?C.green:u.forSale?C.gold:C.cyan;p.ui.ctx.fillRect(px+4,py+size-8,size-11,2);
      }else{p.ui.ctx.fillStyle=C.surface;p.ui.ctx.fillRect(px,py,size-3,size-3);p.ui.text('::',px+Math.max(1,(size-19)/2),py+Math.max(1,(size-11)/2),C.muted);}
    }
    p.space(height+12);p.note('Q quarto / B banheiro / E empresa / :: circulação',C.muted);p.note('Verde: ocupado / amarelo: à venda / azul: privado',C.muted);
  }
  journal(p,account) {
    this.journalFilters??={};this.journalPages??={};
    const kind=this.journalFilters[account]||'all';
    const options=[['all','TODOS'],['employment','EMPREGO'],['ownership','PROPRIETÁRIOS'],['housing','MORADIA'],['sale','VENDAS'],['service','SERVIÇOS'],['production','PRODUÇÃO'],['credit','CRÉDITO'],['finance','FINANÇAS'],['policy','POLÍTICAS'],['social','CONVÍVIO'],['relationship','VÍNCULOS'],['reputation','REPUTAÇÃO'],['government','GOVERNO'],['nature','VEGETAÇÃO'],['transport','FRETES'],['construction','OBRAS'],['family','FAMÍLIA']];
    p.heading('HISTÓRICO DETALHADO');
    const pending=[...this.city.history.pendingFinance.values()].filter(row=>row.from===account || row.to===account);
    if(pending.length)p.note(`Folha da hora atual: ${pending.reduce((n,row)=>n+row.transactions,0)} pagamentos em consolidação. Valores já movimentaram as contas.`,C.muted);
    this.section(p,`journalFilters:${account}`,`Filtrar histórico: ${options.find(([id])=>id===kind)?.[1]||kind}`,()=>p.buttons(options.map(([id,label])=>({label,selected:kind===id,click:()=>{this.journalFilters[account]=id;this.journalPages[account]=0;this.helpOpen[`journalFilters:${account}`]=false;this.resetScroll();}}))));
    const rows=this.cachedList(`journal:${account}:${kind}`,()=>this.city.history.rows(account,kind).filter(e=>this.matches(e.message)).reverse());
    const pages=Math.max(1,Math.ceil(rows.length/20)),page=Math.min(this.journalPages[account]||0,pages-1);
    p.note(`${rows.length} registros disponíveis / página ${page+1} de ${pages}`);
    p.kv('Ocorrências desde a fundação',this.city.history.journals.get(account)?.total||0);
    this.section(p,'historyRetention','Sobre a retenção dos registros',()=>p.note(`Até 2.000 por categoria e pessoa/empresa dentro dos ${HISTORY_LIMIT.toLocaleString('pt-BR')} eventos recentes da cidade. Contadores totais são preservados.`));
    p.button('ABRIR REGISTROS VINCULADOS',()=>{const target=this.go('log');target.logCitizenId=null;target.logBuildingId=null;target.logAccountId=account;target.logReference=null;target.selectedEventId=null;});
    p.rows(rows.slice(page*20,page*20+20),entry=>p.record(entry.message,`${stamp(entry.minute)} · ${options.find(([id])=>id===entry.kind)?.[1]||entry.kind}`,()=>this.openEvent(entry.id),false,{value:entry.amount!==undefined?money(entry.amount):'',color:C.cyan}));
    p.buttons([{label:'ANTERIOR',click:()=>{this.journalPages[account]=Math.max(0,page-1);}},{label:'PRÓXIMA',click:()=>{this.journalPages[account]=Math.min(pages-1,page+1);}}]);
    if(!rows.length)p.note('Nenhum registro nesta categoria.');
  }
  policyAction(message, action) {
    action();
    this.city.setPolicies({ taxRate: this.city.taxRate, currency: { ...this.city.currency.policy },
      bank: { ...this.city.bank.policy }, welfare: { ...this.city.welfare.policy } }, message);
  }
  accountLink(p, id) { if (String(id).startsWith('citizen:')) p.button('ABRIR FICHA DO MORADOR', () => this.openCitizen(Number(id.split(':')[1]))); }
  transactions(p, account) {
    const rows = this.city.ledger.filter(l => l.from === account || l.to === account).slice(-18).reverse();
    p.table([{label:'Quando',weight:.7},{label:'Movimentação',weight:2},{label:'Valor',weight:1}],rows.map(l=>({cells:[stamp(l.minute),l.reason,`${l.to===account?'+':'−'}${money(l.amount)}`],color:l.to===account?C.green:C.red})),{empty:'Nenhuma movimentação registrada.'});
  }
  demands(p) {
    const mode=this.demandTab||'opportunities';p.links([['opportunities','Oportunidades'],['prices','Preços'],['agreements','Acordos'],['chains','Cadeias produtivas']].map(([id,label])=>({label,selected:id===mode,click:()=>this.openPanel({demandTab:id})})));
    if(mode==='chains'){
      const execution=this.city.development.executionReport();p.metrics([['SEM OCUPAÇÃO',execution.unemployed],['OBRAS PRONTAS P/ TRABALHO',execution.ready],['AGUARDANDO PEDRA',execution.waiting]]);p.kv('Construtores no canteiro / em deslocamento',`${execution.working} / ${execution.travelling}`);p.kv('Obras com orçamento insuficiente',execution.unfunded);if(this.city.development.roadPlanning)p.note('Ruas: '+this.city.development.roadPlanning.reason);
      p.heading('ETAPAS DA PRODUÇÃO');p.note('A procura por produtos finais planeja também os fornecedores. Etapas ausentes ganham prioridade com o tempo de espera.');
      const rows=(this.city.economy.productionPlan||[]).filter(r=>this.matches(`${BUILDING_TYPES[r.type]?.label} ${CROPS[r.crop]?.label||''} ${r.reason}`)),selected=rows.find(r=>`${r.type}:${r.crop||''}`===this.selectedDemandKey);
      if(selected){p.heading(BUILDING_TYPES[selected.type].label);p.note(selected.reason);p.note(selected.response?.state||selected.state);p.kv('Instaladas / em construção',`${selected.current} / ${selected.planned}`);if(selected.response?.projectId)p.button('ABRIR OBRA',()=>this.openContract(selected.response.projectId));}
      p.table([{label:'Etapa',weight:2},{label:'Situação',weight:3},{label:'Prioridade'}],rows.map(r=>({cells:[`${BUILDING_TYPES[r.type]?.label}${r.crop?' · '+CROPS[r.crop].label:''}`,r.response?.state||r.state,Math.round(r.priority)],selected:r===selected,click:()=>{this.selectedDemandKey=`${r.type}:${r.crop||''}`;this.resetScroll();}})));return;
    }
    if(mode==='prices'){p.heading('PREÇOS E MERCADO');const rows=Object.entries(this.city.economy.market||{}).filter(([,r])=>r.demand>0||r.stock>0).filter(([g])=>this.matches(GOODS[g].label));p.table([{label:'Produto',weight:1.7},{label:'Preço'},{label:'Oferta'},{label:'Procura'}],rows.map(([g,r])=>({cells:[GOODS[g].label,money(this.city.economy.goods[g].price),Math.round(r.stock),Math.round(r.demand)]})));return;}
    if(mode==='agreements'){p.heading('ACORDOS ENTRE EMPRESAS');const city=this.city;p.table([{label:'Produto'},{label:'Fornecedor',weight:1.5},{label:'Comprador',weight:1.5},{label:'Preço'}],(city.economy.supplyAgreements||[]).map(a=>({cells:[GOODS[a.good].label,name(city.building(a.sellerId)?.entity),name(city.building(a.buyerId)?.entity),money(a.unitPrice)],click:()=>this.openBuilding(a.buyerId)})));return;}
    p.heading('DEMANDAS E OPORTUNIDADES');const rows=this.city.economy.demands.filter(d=>d.score>0&&this.matches(`${BUILDING_TYPES[d.type].label} ${CROPS[d.crop]?.label||''}`));

    const d=rows.find(row=>row.type+':'+(row.crop||'')===this.selectedDemandKey);if(d){p.heading('DETALHES DA OPORTUNIDADE');p.note(d.reason);if(d.response){p.kv('Resposta',d.response.state);if(d.response.projectId)p.kv('Projeto',d.response.projectId);}if(d.required!==undefined){p.kv('Necessidade',d.required);p.kv('Capacidade estimada',d.supply);p.kv('Estoque',d.stock);}}else p.note('Selecione uma oportunidade para ver capacidade, estoque e resposta.');
    p.rows(rows,d=>{const key=d.type+':'+(d.crop||''),selected=this.selectedDemandKey===key;p.record(`${BUILDING_TYPES[d.type].label}${d.crop?' / '+CROPS[d.crop].label:''}`,d.response?.state||d.reason,()=>{this.selectedDemandKey=key;this.resetScroll();},selected,{value:Math.round(d.score)+' pts',color:d.score>=100?C.red:C.cyan});});
  }
  content(p) {
    if(this.tab==='party-organization'){renderPartyOrganizationWindow(this,p);return;}
    if(this.tab==='party'){renderPartyDossier(this,p);return;}if(this.tab==='contract'){renderContractDossier(this,p);return;}if(this.tab==='poll-response'){renderPollResponseDossier(this,p);return;}
    if(this.tab==='election'){renderElectionMonitor(this,p);return;}
    if (this.notice) p.note(this.notice, C.red);
    const render = { city: 'overview', government: 'government', production: 'production', land: 'land', transport: 'transport', sanitation: 'sanitation', log: 'log',event:'eventInspector',publications:'publications',corruption:'corruptionDirectory','corruption-case':'corruptionInspector' }[this.tab];
    if (render) this[render](p);
  }
  overview(p) {
    const city=this.city,s=city.stats(), view=this.view();
    if(view==='nature'){this.naturePanel(p);return;}
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
        q.kv('Empregados / postos totais',`${s.employed} / ${s.jobs}`);q.kv('Vagas abertas',s.vacancies);q.kv('Empresas ativas',s.businesses);
        q.kv('Obras em andamento',city.development.projects.filter(o=>!o.cancelled&&o.status!=='completed').length);
        q.kv('Cargas em andamento',city.logistics.shipments.filter(o=>!['delivered','cancelled'].includes(o.status)).length);
        q.kv('Entregas concluídas',city.logistics.delivered);q.kv('Casais / amizades',`${s.couples} / ${s.friendships}`);q.kv('Nascimentos / mortes',`${s.births} / ${s.deaths}`);
        q.button('ACOMPANHAR AS OBRAS',()=>this.go('land',{view:'projects'}));q.button('VER ABASTECIMENTO',()=>this.go('production'));
      });
      p.heading('ÚLTIMOS ACONTECIMENTOS');this.events(p,this.recentCityEvents(2));p.button('ABRIR HISTÓRICO COMPLETO',()=>this.go('log'));
    } else if(view==='needs'){
      p.heading('CONDIÇÕES DE VIDA');
      p.meters(Object.entries(NEED_LABELS).map(([key,label])=>[label,city.citizens.reduce((n,c)=>n+c.needs[key],0)/Math.max(1,s.population)]));
      p.heading('PESSOAS QUE PRECISAM DE ATENÇÃO');
      const rows=city.citizens.filter(c=>Math.min(...Object.values(c.needs))<30).sort((a,b)=>Math.min(...Object.values(a.needs))-Math.min(...Object.values(b.needs)));
      for(const c of rows){const need=Object.entries(c.needs).sort((a,b)=>a[1]-b[1])[0];p.card(name(c.entity),`${NEED_LABELS[need[0]]}: ${Math.round(need[1])}% / ${c.action}`,()=>this.openCitizen(c.id),false,C.red);}
      if(!rows.length)p.note('Todos os habitantes estão com necessidades acima de 30%.',C.green);
    } else {p.heading('ATIVIDADE DA CIDADE');this.events(p,this.recentCityEvents(30));}
  }
  monetaryPolicy(p) {
    const currency=this.city.currency,mint=this.city.buildings.find(b=>b.type==='mint'&&!b.entity.destroyed);
    const bank=this.city.bank,welfare=this.city.welfare;
    p.metrics([['TESOURO',money(this.city.treasury),C.gold],['INFLAÇÃO DIÁRIA',`${(currency.dailyInflation*100).toFixed(2)}%`,currency.dailyInflation>.001?C.red:C.green],['POUPANÇA',money([...bank.deposits.values()].reduce((n,d)=>n+d.balance,0)),C.cyan],['BENEFÍCIOS HOJE',money(welfare.spentToday),C.blue]]);
    this.section(p,'financeCurrency','Moeda e inflação',()=>{
    p.heading('INDICADORES MONETÁRIOS');
    p.kv('Dinheiro emitido',money(currency.issued));p.kv('Emitido hoje',money(currency.issuedToday));
    p.kv('Inflação diária',`${(currency.dailyInflation*100).toFixed(2)}%`);p.kv('Inflação acumulada',`${((currency.priceIndex-1)*100).toFixed(2)}%`);
    p.kv('Emissão líquida',money(currency.netIssued()));p.kv('Moeda retirada',money(currency.burned));
    p.kv('Modo de emissão',({automatic:'Automático',capped:'Cota fixa',paused:'Pausado'})[currency.policy.mode]);
    p.buttons([['automatic','AUTOMÁTICO'],['capped','COTA FIXA'],['paused','PAUSAR EMISSÃO']].map(([mode,label])=>({label,selected:currency.policy.mode===mode,click:()=>this.policyAction(`Política monetária: ${label}.`,()=>{currency.policy.mode=mode;})})));
    p.kv('Teto de emissão/dia',money(currency.policy.dailyLimit));
    p.buttons([{label:'REDUZIR COTA',click:()=>this.policyAction('Cota de emissão reduzida.',()=>{currency.policy.dailyLimit=Math.max(0,currency.policy.dailyLimit-10000);})},{label:'AUMENTAR COTA',click:()=>this.policyAction('Cota de emissão aumentada.',()=>{currency.policy.dailyLimit=Math.min(500000,currency.policy.dailyLimit+10000);})},{label:'RETIRAR R$ 1.000',click:()=>{if(!currency.retire(100000))this.notice='É preciso preservar a reserva do tesouro e a base monetária mínima.';}}]);
    p.note(`Automático: suspende emissão com inflação diária acima de ${(currency.policy.inflationTarget*100).toFixed(2)}% ou tesouro acima da reserva de ${money(currency.policy.treasuryReserve)}.`);
    },true);
    this.section(p,'financeBank','Crédito e poupança',()=>{
    p.kv('Poupança protegida',money([...bank.deposits.values()].reduce((n,d)=>n+d.balance,0)));p.kv('Juros de novos empréstimos/dia',`${(bank.policy.loanRate*100).toFixed(2)}%`);p.kv('Rendimento da poupança/dia',`${(bank.policy.savingsRate*100).toFixed(2)}%`);
    p.buttons([{label:bank.policy.creditEnabled?'SUSPENDER NOVO CRÉDITO':'LIBERAR CRÉDITO',click:()=>this.policyAction('Política de crédito alterada.',()=>{bank.policy.creditEnabled=!bank.policy.creditEnabled;})},{label:'JUROS +0,05%',click:()=>this.policyAction('Juros de novos empréstimos elevados.',()=>{bank.policy.loanRate=Math.min(.01,bank.policy.loanRate+.0005);})},{label:'JUROS -0,05%',click:()=>this.policyAction('Juros de novos empréstimos reduzidos.',()=>{bank.policy.loanRate=Math.max(0,bank.policy.loanRate-.0005);})}]);
    p.buttons([{label:'POUPANÇA +0,01%',click:()=>this.policyAction('Rendimento da poupança elevado.',()=>{bank.policy.savingsRate=Math.min(.005,bank.policy.savingsRate+.0001);})},{label:'POUPANÇA -0,01%',click:()=>this.policyAction('Rendimento da poupança reduzido.',()=>{bank.policy.savingsRate=Math.max(0,bank.policy.savingsRate-.0001);})}]);
    },false);
    this.section(p,'financeTax','Impostos e subsídios salariais',()=>{
    p.kv(this.city.taxRate<0?'Subsídio sobre salários':'Imposto sobre salários',`${Math.round(this.city.taxRate*100)}%`);p.note('Alíquota de -50% a +50%. Negativa: a empresa paga o salário bruto e a prefeitura acrescenta o percentual ao trabalhador.');p.kv('Subsídios salariais pagos hoje',money(this.city.wageSubsidies.paidToday));p.kv('Total de subsídios salariais',money(this.city.wageSubsidies.totalPaid));if(this.city.wageSubsidies.unpaidToday)p.kv('Não pago hoje por falta de caixa',money(this.city.wageSubsidies.unpaidToday));
    p.buttons([{label:'IMPOSTO +1%',click:()=>this.policyAction('Imposto salarial aumentado.',()=>{this.city.taxRate=Math.min(.5,Math.round((this.city.taxRate+.01)*100)/100);})},{label:'IMPOSTO -1%',click:()=>this.policyAction('Imposto salarial reduzido.',()=>{this.city.taxRate=Math.max(-.5,Math.round((this.city.taxRate-.01)*100)/100);})}]);
    },false);
    this.section(p,'financeBenefits','Benefícios municipais',()=>{
    p.kv('Orçamento diário',money(welfare.policy.dailyBudget));p.kv('Pago hoje',money(welfare.spentToday));p.kv('Pago desde a fundação',money(welfare.totalPaid));p.kv('Piso por adulto',money(welfare.policy.householdFloor));
    p.buttons([{label:welfare.policy.enabled?'PAUSAR BENEFÍCIOS':'ATIVAR BENEFÍCIOS',click:()=>this.policyAction('Programa de benefícios alterado.',()=>{welfare.policy.enabled=!welfare.policy.enabled;})},{label:'ORÇAMENTO +R$ 100',click:()=>this.policyAction('Orçamento de benefícios ampliado.',()=>{welfare.policy.dailyBudget+=10000;})},{label:'ORÇAMENTO -R$ 100',click:()=>this.policyAction('Orçamento de benefícios reduzido.',()=>{welfare.policy.dailyBudget=Math.max(0,welfare.policy.dailyBudget-10000);})}]);
    p.note('Benefícios consideram saldo, poupança e dependentes; têm teto diário e preservam a reserva do tesouro. Cidadãos com renda podem buscar crédito antes de recorrer ao benefício.');
    p.note('A casa da moeda deposita a emissão no tesouro. A expansão monetária eleva gradualmente os preços. Dinheiro guardado e contratos já reservados mantêm seu valor nominal.');
    },false);
    this.section(p,'financeHistory','Histórico monetário',()=>{p.table([{label:'Dia'},{label:'Inflação'},{label:'Poupança'},{label:'Crédito'}],currency.history.slice(-10).reverse().map(h=>({cells:[h.day,`${(h.inflation*100).toFixed(2)}%`,money(h.savings||0),money(h.credit||0)]})));},false);
    if(mint)p.button('ABRIR CASA DA MOEDA',()=>this.openBuilding(mint.id));
  }
  government(p) {
    const city=this.city,view=this.view(),mayor=city.economy.citizen(city.economy.mayorId),hall=city.buildings.find(b=>b.type==='townhall');
    if(view==='elections'){this.electionsPanel(p);return;}
    if(view==='overview'){
      renderGovernmentDashboard(this,p);
      if(!this.host)for(const [title,items] of [['GESTÃO',[['Avaliação do governo','approval'],['Promessa e plano de governo','promises'],['Governo e regras','overview'],['Intervenções','interventions']]],['INSTITUIÇÕES',[['Partidos','parties'],['Câmara e projetos','council'],['Institutos de pesquisa','institutes'],['Pesquisas não eleitorais','research-services']]],['ELEIÇÕES',[['Campanha','campaign'],['Pesquisas eleitorais','polls'],['Resultados','results']]],['FISCALIZAÇÃO',[['Escândalos e investigações','scandals']]]]){p.heading(title);p.links(items.map(([label,politicsTab])=>({label,click:()=>this.openPanel({views:{government:'elections'},politicsTab})})));}
      if(!this.host){p.heading('ADMINISTRAÇÃO');p.links([['Contratos','contracts'],['Tesouro e política monetária','finance'],['Terreno e geração','world']].map(([label,view])=>({label,click:()=>this.showView(view)})));}
      if(hall)p.button('DOSSIÊ DA PREFEITURA',()=>this.openBuilding(hall.id));
    } else if(view==='contracts'){p.heading('CONTRATOS MUNICIPAIS');this.contracts(p,this.cachedList(`municipal-contracts:${this.contractPlotId||'all'}`,()=>city.development.projects.filter(o=>this.contractPlotId?o.plotId===this.contractPlotId:o.accountId==='treasury').slice().sort((a,b)=>Number(a.cancelled||a.status==='completed')-Number(b.cancelled||b.status==='completed')||Number(b.status==='blocked')-Number(a.status==='blocked')||b.startedAt-a.startedAt)));}
    else if(view==='finance'){this.monetaryPolicy(p);p.heading('MOVIMENTAÇÕES DO TESOURO');p.metrics([['DISPONÍVEL',money(city.treasury),C.gold]]);this.journal(p,'treasury');}
    else {
      p.heading('GERAÇÃO DE TERRENO');p.note(`Mapa atual: ${WORLD_PRESETS[city.world.preset]?.label||'Natural'}`);p.kv('Semente atual',city.world.seed??city.initialSeed);
      p.heading('PRÓXIMA CIDADE');p.note('Semente do próximo mapa');let iy=p.y;p.space(24);if(iy>=p.top&&iy+20<=p.bottom)this.inputAt(this.seed,p.x,iy,p.w);
      p.note('Cidadãos iniciais (1 a 2.000)');iy=p.y;p.space(24);if(iy>=p.top&&iy+20<=p.bottom)this.inputAt(this.populationInput,p.x,iy,p.w);
      p.button(`PAISAGEM: ${WORLD_PRESETS[this.terrain].label}`,()=>{const keys=Object.keys(WORLD_PRESETS);this.terrain=keys[(keys.indexOf(this.terrain)+1)%keys.length];});
      p.note('Gerar terreno reinicia a simulação e descarta a cidade atual.',C.red);
      p.button('GERAR COM ESTA SEMENTE',()=>{if(this.seed.reportValidity()&&this.populationInput.reportValidity())this.startWorld(Number(this.seed.value),this.terrain,Number(this.populationInput.value));});p.button('GERAR TERRENO ALEATÓRIO',()=>{if(this.populationInput.reportValidity())this.startWorld(randomWorldSeed(),this.terrain,Number(this.populationInput.value));});
    }
  }
  production(p) {
    if(this.view()==='lighting'){
      const city=this.city,posts=[...city.lighting.sites.values()].filter(l=>l.status!=='cancelled');p.heading('ILUMINAÇÃO E ABASTECIMENTO');p.metrics([['CONSTRUÍDOS',posts.filter(l=>l.built).length],['ACESOS',posts.filter(l=>l.lit).length],['SEM ÓLEO',posts.filter(l=>l.built&&!l.fuel).length],['EM PLANEJAMENTO',posts.filter(l=>!l.built).length]]);
      const supply=city.economy.lightingSupplyReport;if(supply){p.kv('Óleo para a iluminação',`${supply.daily} unidades/dia · reserva atual ${supply.oilStock}`);p.kv('Girassol necessário / capacidade com equipe',`${Math.ceil(supply.sunflowerRequired)} / ${supply.farmDaily} por dia`);p.kv('Moagem com equipe / meta com reserva',`${supply.millDaily} / ${supply.oilRequired} por dia`);p.note(`Gargalo: ${supply.bottleneck}.`);}
      p.note('A prefeitura paga postes públicos; proprietários pagam os particulares. Pedras, construção, óleo e abastecimento têm trabalho e transporte reais.');
      p.table([{label:'Local'},{label:'Responsável',weight:1.4},{label:'Óleo (h)'},{label:'Situação',weight:2}],posts.filter(l=>this.matches(`${l.id} ${l.supplyStatus||''}`)).map(l=>({cells:[`${Math.floor(l.x)}, ${Math.floor(l.y)}`,l.public?'Prefeitura':city.accountName(l.payerId),l.fuel,l.built?l.supplyStatus||'Aguardando abastecimento':l.projectId?'Em construção':'Aguardando contratação'],click:()=>this.camera(l.x,l.y)})));return;
    }

    const city=this.city,view=this.view();
    if(view==='demand'){this.demands(p);return;}
    if(view==='stocks'){
      p.heading('ESTOQUES E CADEIAS PRODUTIVAS');
      const stocks=this.cachedList('stock-summary',()=>Object.entries(GOODS).map(([id,spec])=>({id,label:spec.label,stock:city.goodsStock(id),produced:city.economy.produced[id]||0,consumed:city.economy.consumed[id]||0,price:city.economy.goods[id]?.price??spec.price,initial:city.economy.initialStock[id]||0,freight:city.logistics.shipments.reduce((n,s)=>n+(s.inventory[id]||0),0),works:city.development.projects.reduce((n,s)=>n+(s.inventory[id]||0),0)})));
      p.metrics([['PRODUTOS',stocks.length],['SEM ESTOQUE',stocks.filter(g=>!g.stock).length,C.gold],['REFEIÇÕES SEM OFERTA',city.economy.failedMeals,C.red]]);
      const mode=this.stockView||'all';
      p.links([['all','TODOS'],['available','COM ESTOQUE'],['empty','SEM ESTOQUE']].map(([id,label])=>({label,selected:id===mode,click:()=>this.openPanel({stockView:id})})));
      const rows=stocks.filter(g=>this.matches(g.label)&&(mode==='all'||mode==='available'&&g.stock>0||mode==='empty'&&!g.stock));
      p.table([{label:'Produto',weight:2},{label:'Estoque'},{label:'Produzido'},{label:'Consumido'},{label:'Preço'}],rows.map(g=>({cells:[g.label,g.stock,g.produced,g.consumed,money(g.price)],color:g.stock?C.gray:C.red})));
      this.section(p,'stockOrigins','Origem, transporte e materiais nas obras',()=>{
        p.table([{label:'Produto',weight:2},{label:'Inicial'},{label:'Em frete'},{label:'Nas obras'}],rows.map(g=>({cells:[g.label,g.initial,g.freight,g.works]})));
        p.note('O estoque total inclui prédios, obras, cargas e resíduos. Mercadorias reservadas só ficam disponíveis no destino após a entrega.');
      });

    } else {
      p.heading('MOVIMENTAÇÕES DE MERCADORIAS');
      const kinds={dispatch:'Carga reservada',delivery:'Entrega',mining:'Extração',construction:'Construção',road:'Estrada',expansion:'Ampliação','workplace-meal':'Refeição da empresa',waste:'Lixo gerado','recycling-input':'Processamento','recycling-output':'Pedra reciclada',consumption:'Consumo',sowing:'Plantio',harvest:'Colheita','recipe-input':'Insumo',baking:'Panificação'};
      const rows=city.economy.goodsLedger.slice(-100).reverse().filter(l=>this.matches(`${GOODS[l.good]?.label} ${kinds[l.kind]||l.kind} ${name(city.building(l.from)?.entity)} ${name(city.building(l.to)?.entity)}`));
      p.metrics([['MOVIMENTAÇÕES',rows.length],['JANELA',`${Math.min(100,city.economy.goodsLedger.length)} mais recentes`]]);
      p.table([{label:'Quando'},{label:'Mercadoria',weight:1.6},{label:'Etapa',weight:1.3},{label:'Origem → destino',weight:2}],rows.map(l=>{const origin=city.building(l.from),target=city.building(l.to)||city.society.citizen(l.to);return{cells:[stamp(l.minute),`${GOODS[l.good]?.label||l.good} × ${l.quantity}`,kinds[l.kind]||l.kind,`${origin?name(origin.entity):'Produção'} → ${target?name(target.entity):'Consumo / transformação'}`],click:()=>{const building=city.building(l.to)||origin;if(building)this.openBuilding(building.id);}};}),{empty:'Nenhuma movimentação de mercadoria encontrada.'});
    }
  }
  land(p) {
    const city=this.city,dev=city.development,selected=dev.plots.find(l=>l.id===this.selectedPlotId);
    if(this.view()==='projects'){
      const active=dev.projects.filter(o=>o.status!=='completed'&&!o.cancelled),finished=dev.projects.filter(o=>o.status==='completed'||o.cancelled),mode=this.projectView||'active';
      p.metrics([['EM ANDAMENTO',active.length],['BLOQUEADAS',active.filter(o=>o.status==='blocked').length,C.red],['CONCLUÍDAS',finished.filter(o=>!o.cancelled).length,C.green]]);
      p.links([['active','EM ANDAMENTO'],['blocked','BLOQUEADAS'],['finished','ENCERRADAS']].map(([id,label])=>({label,selected:id===mode,click:()=>this.openPanel({projectView:id})})));
      this.contracts(p,mode==='finished'?finished.slice().reverse():mode==='blocked'?active.filter(o=>o.status==='blocked'):active);return;
    }
    p.note('Área mínima de terrenos e novas obras: 4 células no chão (2×2, 4×1 ou 1×4). Fachadas recebem orientações aleatórias com acesso por terra firme.');
    p.metrics([['TERRENOS',dev.plots.length,C.cyan],['À VENDA',dev.plots.filter(l=>l.forSale&&!l.buildingId).length,C.gold],['EM OBRAS',dev.projects.filter(o=>!o.cancelled&&o.status!=='completed').length,C.green]]);
    if(selected){
      const levelLabel=Number.isFinite(selected.level)?selected.level.toFixed(2):selected.level===null?'Relevo natural / nível variável':'Instalação inicial';
      p.heading(`TERRENO ${selected.id}`,C.cyan);p.columns(q=>{q.kv('Dimensões',`${selected.width}x${selected.depth}`);q.kv('Nível',levelLabel);q.kv('Proprietário',city.accountName(selected.ownerId));},q=>{q.kv('Venda',selected.forSale?money(selected.price):'Não anunciado');q.kv('Locação',selected.ownerId==='treasury'?'Prefeitura não aluga':selected.forRent?money(selected.rent)+'/dia':'Não anunciado');});
      p.buttons([{label:'LOCALIZAR',click:()=>{this.camera(selected.x+selected.width/2,selected.y+selected.depth/2);if(!this.host)this.visible=false;}},...(selected.buildingId?[{label:'ABRIR IMÓVEL',click:()=>this.openBuilding(selected.buildingId)}]:[]),{label:'CONTRATOS DO TERRENO',click:()=>this.openPanel({tab:'government',views:{government:'contracts'},contractPlotId:selected.id})}]);
    }
    if(this.recordWindow)return;
    this.filterButtons(p);const f=this.filter(),lots=dev.plots.filter(l=>this.matches(`${l.id} ${city.accountName(l.ownerId)} ${city.building(l.buildingId)?.entity.properties.name||''}`)).filter(l=>f==='all'||f==='sale'&&l.forSale&&!l.buildingId||f==='built'&&l.buildingId||f==='works'&&l.projectId);
    p.heading('CADASTRO DE TERRENOS');p.table([{label:'Terreno'},{label:'Proprietário',weight:2},{label:'Área'},{label:'Situação',weight:1.5}],lots.map(l=>({cells:[`Lote ${l.id}`,city.accountName(l.ownerId),`${l.width}x${l.depth}`,l.buildingId?'Edificado':l.projectId?'Em obras':l.forSale?money(l.price):'Disponível'],selected:l.id===this.selectedPlotId,click:()=>this.setPlotSelection(l.id)})));
  }
  contracts(p, projects) {
    p.table([{label:'Contrato',weight:2},{label:'Situação',weight:1.5},{label:'Valor'}],projects.filter(o=>this.matches(`${o.name} ${BUILDING_TYPES[o.type]?.label||o.type}`)).map(o=>({cells:[o.name,o.cancelled?'Cancelado':o.status==='completed'?'Concluído':o.status==='blocked'?'Bloqueado':o.status==='materials'?'Aguardando materiais':'Em andamento',money(o.fee)],color:o.status==='blocked'?C.red:C.gray,click:()=>this.openContract(o.id)})));
  }
  transport(p) {
    if(['vehicles','lines','models','airspace'].includes(this.view())){renderMobility(this,p);return;}
    const city=this.city,system=city.logistics,pending=system.shipments.filter(s=>!['delivered','cancelled'].includes(s.status));
    p.metrics([['EM ANDAMENTO',pending.length,C.gold],['ENTREGUES',system.delivered,C.green],['ITENS EM FRETE',pending.reduce((n,s)=>n+s.quantity,0),C.cyan]]);
    this.section(p,'transportDemand','Demanda, capacidade e causas dos atrasos',()=>{
    const demand=system.demandMetrics();p.heading('DEMANDA POR TRANSPORTE');p.kv('Cargas aguardando / transporte próprio',`${demand.waiting} / ${demand.ownHauls}`);p.kv('Transportadores disponíveis',demand.drivers);p.kv('Cargas bloqueadas por armazém cheio',demand.waitingSpace);p.kv('Espera mais antiga',`${Math.round(demand.oldest)} min`);p.kv('Trabalho pendente / capacidade diária',`${demand.work} / ${demand.capacity} min`);p.kv('Lamparinas sem atendimento',demand.lampRequests);p.kv('Índice de demanda',Math.round(demand.score));
    });
    const states={waiting:'Aguardando coleta','in-transit':'Em trânsito','waiting-space':'Sem espaço',delivered:'Entregue',cancelled:'Cancelado'};
    const rows=(this.view()==='active'?pending:system.shipments.filter(s=>['delivered','cancelled'].includes(s.status)).slice(-40).reverse()).filter(s=>this.matches(`${s.id} ${GOODS[s.good].label} ${s.seller.entity?.properties.name} ${s.buyer.entity?.properties.name||s.buyer.name}`));
    p.heading(this.view()==='active'?'CARGAS EM ANDAMENTO':'ENTREGAS E CANCELAMENTOS');
    const selected=system.shipments.find(s=>s.id===this.selectedShipmentId);
    if(selected){
      p.button('VOLTAR À LISTA DE CARGAS',()=>this.openPanel({selectedShipmentId:null}));
      const s=selected;
      p.heading(`FRETE ${s.id} / ${GOODS[s.good].label} x${s.quantity}`,s.status==='delivered'?C.green:s.status==='cancelled'?C.red:C.gold);
      p.note(states[s.status],C.cyan);p.note(`${s.seller.entity?.properties.name||s.seller.name} > ${s.buyer.entity?.properties.name||s.buyer.name}`);
      p.columns(q=>{q.kv('Mercadoria',money(s.cost));q.kv('Frete',money(s.fee));if(s.serviceFee)q.kv('Serviço de coleta',money(s.serviceFee));},q=>{q.kv('Operador',city.building(s.carrierId)?.entity.properties.name||'Transporte próprio');q.kv('Trajeto',`${s.routeLength} tiles`);});
      const driver=city.society.citizen(s.driverId);p.buttons([...(city.building(s.seller.id)?[{label:'ORIGEM',click:()=>this.openBuilding(s.seller.id)}]:[]),...(city.building(s.buyer.id)?[{label:'DESTINO',click:()=>this.openBuilding(s.buyer.id)}]:[]),...(driver?[{label:'TRANSPORTADOR',click:()=>this.openCitizen(driver.id)}]:[])]);
      p.note(`${stamp(s.createdAt)}${s.completedAt?' / conclusão '+stamp(s.completedAt):''}`,C.muted);
      return;
    }
    p.rows(rows,s=>p.record(`#${s.id} · ${GOODS[s.good].label} × ${s.quantity}`,`${s.seller.entity?.properties.name||s.seller.name} → ${s.buyer.entity?.properties.name||s.buyer.name}`,()=>this.openPanel({selectedShipmentId:s.id}),false,{value:states[s.status]||s.status,color:s.status==='waiting-space'?C.red:s.status==='delivered'?C.green:C.cyan}));
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
      const waste=system.wasteMetrics();
      p.metrics([['LIXO NA CIDADE',waste.total,C.gold],['PROCESSADO',waste.processed,C.green],['COLETADO / ENTREGUE',system.collected,C.cyan]]);
      p.heading('ETAPAS DO CICLO');p.kv('Aguardando coleta',waste.awaiting);p.kv('Em transporte de coleta',waste.collecting);p.kv('Armazenado nas coletoras',waste.atCollectors);p.kv('A caminho das processadoras',waste.transferring);p.kv('No estoque das processadoras',waste.atProcessors);p.kv('Espalhado',city.buildings.reduce((n,b)=>n+(b.litter||0),0));
      p.note('A equipe da coletora busca o lixo e entrega às processadoras. Reciclagem: 2 lixos → 1 pedra. Compostagem: 4 lixos → 2 adubos. Ambas exigem trabalho e insumos entregues.');
      p.table([{label:'Instalação',weight:2},{label:'No estoque'},{label:'Espalhado'}],city.buildings.filter(b=>(b.inventory.lixo||b.litter)&&this.matches(name(b.entity))).sort((a,b)=>(b.inventory.lixo+b.litter)-(a.inventory.lixo+a.litter)).map(b=>({cells:[name(b.entity),b.inventory.lixo,b.litter||0],click:()=>{this.openBuilding(b.id);this.detailTab='stock';},color:b.litter?C.red:C.gray})));
      p.heading('COLETA E PROCESSAMENTO');
      for(const b of city.economy.businesses.filter(b=>['waste_collector','recycler','composting'].includes(b.type))) {
        const owner=city.economy.citizen(b.ownerId),crew=b.workers.length+(owner?1:0),minimum=b.type==='composting'?4:2;
        const status=!crew?'Sem equipe':!owner && b.balance<b.wage?'Sem caixa para salários':b.type==='waste_collector'?inventoryFree(b)<2?'Estoque lotado':b.inventory.lixo?'Aguardando entrega à processadora':'Aguardando coleta':b.inventory.lixo<minimum?(b.incoming.lixo?'Lixo em transporte':'Sem lixo suficiente'):'Insumo disponível para processamento';
        p.card(name(b.entity),`${BUILDING_TYPES[b.type].label} / ${crew} profissionais / ${status}`,()=>this.openBuilding(b.id),false,status==='Sem equipe'||status==='Sem caixa para salários'?C.red:C.green);
        p.kv('Lixo no estoque / a receber',`${b.inventory.lixo} / ${b.incoming.lixo||0}`);p.kv('Lixo processado',b.wasteProcessed||0);
        if(b.type==='recycler')p.kv('Pedras produzidas',b.recycledStone||0);
        if(b.type==='composting')p.kv('Adubo produzido',b.compostProduced||0);
      }
      return;
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
  relationshipPanel(p,c) {
    const society=this.city.society,all=society.relationsFor(c.id),filter=this.socialFilter||'all';
    const categories=[['all','TODOS'],['friends','AMIZADES'],['conflicts','CONFLITOS'],['romance','ROMANCE'],['family','FAMÍLIA'],['work','TRABALHO'],['archived','AUSENTES']];
    p.heading('VÍNCULOS PESSOAIS');p.buttons(categories.map(([id,label])=>({label,selected:filter===id,click:()=>{this.socialFilter=id;this.socialPage=0;this.socialRelationId=null;this.resetScroll();}})));
    const rows=all.filter(r=>{const v=r.views[c.id],other=r.a===c.id?r.b:r.a;return this.matches(r.names[other]) && (filter==='all'||filter==='friends'&&['friend','close','confidant'].includes(v.status)||filter==='conflicts'&&['enemy','rival','estranged'].includes(v.status)||filter==='romance'&&v.romance!=='none'||filter==='family'&&v.kinship||filter==='work'&&(r.contexts.includes('coworkers')||r.mentorId)||filter==='archived'&&r.active===false);});
    const page=Math.min(this.socialPage||0,Math.max(0,Math.ceil(rows.length/10)-1));
    p.note(`${rows.length} vínculos / página ${page+1}. Sentimentos são individuais; amizade e romance são dimensões separadas.`);
    const contexts={family:'Família',coworkers:'Colegas de trabalho',household:'Mesmo domicílio',neighbors:'Vizinhança'};
    for(const r of rows.slice(page*10,page*10+10)) {
      const other=r.a===c.id?r.b:r.a,v=r.views[c.id],back=r.views[other];
      p.card(r.names[other],`Vê como: ${BOND_LABELS[v.status]} / É visto como: ${BOND_LABELS[back.status]}\n${r.active===false?'Ausente ou falecido / ':''}${r.contexts.map(id=>contexts[id]||id).join(' / ')}`,()=>{this.socialRelationId=r.id;this.resetScroll();},this.socialRelationId===r.id,['enemy','rival','estranged'].includes(v.status)?C.red:C.cyan);
    }
    p.buttons([{label:'ANTERIOR',click:()=>{this.socialPage=Math.max(0,page-1);}},{label:'PRÓXIMA',click:()=>{this.socialPage=page+1;}}]);
    const selected=rows.find(r=>r.id===this.socialRelationId)||rows[0];
    if(selected){
      const other=selected.a===c.id?selected.b:selected.a;
      p.heading(`RELAÇÃO COM ${selected.names[other]}`);p.kv('Primeiro contato',stamp(selected.since));p.kv('Último contato',stamp(selected.lastContact));p.kv('Conversas',selected.conversations);
      if(selected.mentorId)p.kv('Mentoria',`${selected.names[selected.mentorId]} oferece orientação`);
      const show=(observer,target)=>{const v=selected.views[observer];p.heading(`${selected.names[observer]} → ${selected.names[target]}`);p.kv('Vínculo',BOND_LABELS[v.status]);p.kv('Dimensão romântica',ROMANCE_LABELS[v.romance]);p.kv('Afeto',`${Math.round(v.affection)} / de -100 a +100`);p.meters([['Confiança',v.trust,C.cyan],['Respeito',v.respect,C.green],['Ressentimento',v.resentment,C.red],['Receio',v.fear,C.gold]]);if(v.romance!=='none')p.meter('Atração',v.attraction,C.pink);if(v.favorsOwed)p.kv('Ajuda recebida a retribuir',v.favorsOwed);};
      show(c.id,other);show(other,c.id);
      if(society.citizen(other))p.button('ABRIR FICHA DA OUTRA PESSOA',()=>this.openCitizen(other));
      p.button('MEMÓRIAS DESTE VÍNCULO',()=>{this.memoryPersonId=other;this.detailTab='memories';this.memoryPage=0;this.resetScroll();});
    }
    if(!rows.length)p.note('Nenhum vínculo corresponde ao filtro.');
  }
  socialMemories(p,c) {
    p.heading('MEMÓRIAS E CRENÇAS');
    p.note(`Até ${RELATIONSHIP_RULES.memories} recordações e ${RELATIONSHIP_RULES.beliefs} histórias ouvidas por pessoa. Crenças podem estar erradas; o conhecimento se espalha nos encontros.`);
    if(this.memoryPersonId)p.button(`FILTRANDO VÍNCULO: ${this.city.accountName(`citizen:${this.memoryPersonId}`)} / LIMPAR`,()=>{this.memoryPersonId=null;this.memoryPage=0;this.resetScroll();});
    p.links([['memories','RECORDAÇÕES'],['beliefs','HISTÓRIAS OUVIDAS'],['grief','LUTO']].map(([id,label])=>({label,selected:(this.memoryView||'memories')===id,click:()=>this.openPanel({memoryView:id})})));
    if(this.memoryView==='grief') {
      for(const g of c.social.grief){p.heading(g.name,C.pink);p.kv('Perda',stamp(g.startedAt));p.kv('Recuperação prevista',stamp(g.until));p.kv('Intensidade atual',Math.round(g.strength*Math.max(0,(g.until-this.city.minute)/(g.until-g.startedAt))));}
      if(!c.social.grief.length)p.note('Sem luto recente.');
      if(c.social.comfortUntil>this.city.minute)p.note('Apoio emocional recebido está amenizando o luto.',C.green);
      return;
    }
    const belief=this.memoryView==='beliefs',rows=[...(belief?c.social.beliefs:c.social.memories)].reverse().filter(m=>(!this.memoryPersonId||[m.actorId,m.targetId,m.aboutId,m.otherId,m.sourceId].includes(this.memoryPersonId))&&this.matches(m.description));
    const page=Math.min(this.memoryPage||0,Math.max(0,Math.ceil(rows.length/8)-1));
    for(const m of rows.slice(page*8,page*8+8)) {
      p.heading(`${stamp(m.heardAt??m.minute)} / ${m.kind==='publication'?'LEITURA':belief?m.corrected?'CORRIGIU A OPINIÃO':m.believes?'ACREDITA':'TEM DÚVIDAS':m.firsthand?m.truth?'PARTICIPOU OU PRESENCIOU':'CONHECE A INVENÇÃO':'OUVIU UMA CORREÇÃO'}`,belief&&m.corrected?C.green:C.cyan);
      p.note(m.description);
      if(belief){p.kv('Fonte',this.city.accountName(`citizen:${m.sourceId}`));p.kv(m.corrected?'Confiança na correção':'Confiança na narrativa',`${m.confidence}%`);p.kv('Repasses',m.hops);}
      if(m.eventId)p.button(`VER ORIGEM #${m.eventId}`,()=>this.openEvent(m.eventId));
    }
    p.note(`${rows.length} registros / página ${page+1}`);p.buttons([{label:'ANTERIOR',click:()=>{this.memoryPage=Math.max(0,page-1);}},{label:'PRÓXIMA',click:()=>{this.memoryPage=page+1;}}]);
    if(!rows.length)p.note('Nenhuma memória corresponde ao filtro.');
  }
  reputationPanel(p,subject) {
    p.heading('REPUTAÇÃO');p.meters(Object.entries(REPUTATION_LABELS).map(([id,label])=>[label,this.city.reputation.score(subject,id),C.cyan]));
    p.note('Entregas, faxinas e obras concluídas afetam a confiança no prestador. Parcelas pagas ou atrasadas afetam crédito. A reputação participa da escolha de fornecedores, contratação e limites bancários.');
  }
  naturePanel(p) {
    const nature=this.city.nature,plants=[...nature.plants.values()];
    p.heading('VEGETAÇÃO E REPLANTIO');
    p.metrics([['PLANTAS',plants.length,C.green],['SEMENTES',nature.seeds.length,C.gold],['GERMINAÇÕES',nature.germinated,C.cyan],['CORTES',nature.harvested,C.gold]]);
    p.note(`Sementes germinam após ${NATURE_RULES.germinationMinutes/60} horas. Árvores crescem em 3–4 dias; amoreiras em um dia. Limites: ${NATURE_RULES.maxPlants} plantas e ${NATURE_RULES.maxSeeds} sementes. Estradas, lotes e instalações impedem o crescimento.`);
    for(const [id,spec] of Object.entries(PLANT_SPECIES))p.kv(spec.label,`${plants.filter(t=>t.species===id).length} plantas / ${spec.grow/1440} dias de crescimento`);
    const stage={seedling:'Muda',young:'Jovem',mature:'Madura'};
    const rows=plants.filter(t=>this.matches(`${PLANT_SPECIES[t.species].label} ${stage[t.stage]}`));
    const page=Math.min(this.naturePage||0,Math.max(0,Math.ceil(rows.length/30)-1));
    p.table([{label:'Espécie'},{label:'Estágio'},{label:'Posição'},{label:'Cultivo'}],rows.slice(page*30,page*30+30).map(t=>({cells:[PLANT_SPECIES[t.species].label,stage[t.stage],`${t.x}, ${t.y}`,t.buildingId?name(this.city.building(t.buildingId)?.entity):'Natural'],click:()=>{this.camera(t.x,t.y);this.selectedPlantId=t.id;}})));
    p.buttons([{label:'ANTERIOR',click:()=>{this.naturePage=Math.max(0,page-1);}},{label:'PRÓXIMA',click:()=>{this.naturePage=page+1;}}]);
    const selected=nature.plants.get(this.selectedPlantId);
    if(selected){p.heading(PLANT_SPECIES[selected.species].label);p.kv('Plantio',stamp(selected.plantedAt));p.kv('Maturidade',stamp(selected.plantedAt+PLANT_SPECIES[selected.species].grow));if(selected.buildingId)p.button('ABRIR CULTIVADOR',()=>this.openBuilding(selected.buildingId));}
    p.button('HISTÓRICO DA VEGETAÇÃO',()=>{this.go('log').logCategory='nature';});
  }
  electionsPanel(p) { renderPolitics(this,p); }
  openEvent(id){const snapshot=this.city.history.get(id)||this.frozenEvents?.find(e=>e.id===id)||this.city.publications.eventSnapshot(id);if(this.host)return this.host.openEvent(id,snapshot);this.remember();this.tab='event';this.selectedEventId=id;this.eventSnapshot=snapshot;this.resetScroll();}
  openCorruption(id){if(this.host)return this.host.openCorruption(id);this.remember();this.tab='corruption-case';this.corruptionCaseId=id;this.corruptionSnapshot=corruptionCases(this.city.politics).find(r=>r.id===id);this.resetScroll();}
  publications(p){renderPublications(this,p);}
  corruptionDirectory(p){renderCorruptionDirectory(this,p);}
  corruptionInspector(p){renderCorruptionInspector(this,p);}
  eventInspector(p){renderEventInspector(this,p);}
  events(p, events) {
    p.rows(events,e=>{
      const color=e.category==='death'?C.red:e.category==='family'||e.category==='relationship'?C.pink:e.category==='production'||e.category==='transport'?C.cyan:C.gold;
      p.record(e.message,`${stamp(e.minute)} · ${EVENT_CATEGORIES[e.category]||e.category}${e.relatedEventIds?.length?' · Registros vinculados':''}`,()=>this.openEvent(e.id),this.selectedEventId===e.id,{value:e.amount!==undefined?money(e.amount):'',color});
    });
    if(!events.length)p.note('Nenhum acontecimento encontrado.');
  }

  recentCityEvents(limit=30) {
    const rows=[];
    for(let i=this.city.events.length-1;i>=0&&rows.length<limit;i--){const event=this.city.events[i];if(this.matches(event.message))rows.push(event);}
    return rows;
  }

  eventRows(limit=Infinity) {
    const signature=[this.logLive?this.city.history.nextId:this.frozenEvents?.[0]?.id,limit,this.logCategory,this.logCitizenId,this.logBuildingId,this.logAccountId,this.logReference,this.query,this.logLive].join('|');
    if(this.eventQueryKey===signature)return this.eventQueryRows;
    this.eventQueryKey=signature;
    const options={category:this.logCategory,citizenId:this.logCitizenId,buildingId:this.logBuildingId??null,accountId:this.logAccountId??null,reference:this.logReference,query:this.query,limit};
    this.eventQueryRows=this.logLive?this.city.history.query(options):(this.frozenEvents||[]).filter(e=>(this.logCategory==='all'||e.category===this.logCategory)&&(!this.logCitizenId||e.citizenIds.includes(this.logCitizenId))&&(!this.logBuildingId||e.buildingIds.includes(this.logBuildingId))&&(!this.logAccountId||e.accounts.includes(this.logAccountId))&&(!this.logReference||this.city.history.references(e).includes(this.logReference))&&this.matches(e.message)).slice(0,limit);
    return this.eventQueryRows;
  }
  log(p) {
    p.buttons([{label:this.logLive?'CONGELAR HISTÓRICO':'RETOMAR AO VIVO',selected:!this.logLive,click:()=>{this.logLive=!this.logLive;this.frozenEvents=this.logLive?null:this.city.history.query({limit:Infinity});}},{label:'EXPORTAR JSON',click:()=>this.exportLog()}]);
    p.heading('FILTRAR POR ASSUNTO');p.buttons([['all','TODOS'],...Object.entries(EVENT_CATEGORIES)].map(([id,label])=>({label:String(label).toUpperCase(),selected:this.logCategory===id,click:()=>{this.logCategory=id;this.resetScroll();}})));
    for(const [key,label] of [['logCitizenId','PESSOA'],['logBuildingId','PRÉDIO'],['logAccountId','CONTA'],['logReference','OPERAÇÃO']])if(this[key]!=null)p.button(`${label}: ${this[key]} / LIMPAR`,()=>{this[key]=null;this.resetScroll();});
    const rows=this.eventRows(this.logLimit+1);
    p.heading(`${Math.min(rows.length,this.logLimit)} REGISTROS / ${this.logLive?'AO VIVO':'CONGELADO'}`);
    p.note(`Eventos recentes primeiro; retenção global de ${HISTORY_LIMIT.toLocaleString('pt-BR')}, além de até 512 aguardando descarte. ${this.city.history.total.toLocaleString('pt-BR')} registrados desde a fundação; ${this.city.history.dropped.toLocaleString('pt-BR')} descartados.`,C.muted);
    this.events(p,rows.slice(0,this.logLimit));if(rows.length>this.logLimit)p.button('CARREGAR MAIS REGISTROS',()=>{this.logLimit+=80;});
  }
  exportLog() {
    const events=this.eventRows();
    const pendingFinance=this.logLive && ['all','finance'].includes(this.logCategory) && !this.logReference ? [...this.city.history.pendingFinance.values()].filter(row=>
      (!this.logCitizenId || [row.from,row.to].includes(`citizen:${this.logCitizenId}`)) &&
      (!this.logBuildingId || [row.from,row.to].includes(this.city.building(this.logBuildingId)?.accountId)) &&
      (!this.logAccountId || [row.from,row.to].includes(this.logAccountId)) &&
      this.matches(`${row.reason} ${this.city.accountName(row.from)} ${this.city.accountName(row.to)}`)) : [];
    const blob=new Blob([JSON.stringify({version:2,cityMinute:this.city.minute,total:this.city.history.total,dropped:this.city.history.dropped,retention:HISTORY_LIMIT,filters:{category:this.logCategory,citizenId:this.logCitizenId,buildingId:this.logBuildingId,accountId:this.logAccountId,reference:this.logReference,query:this.query},events,pendingFinance},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`suburban-historico-dia-${this.city.day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  startWorld(seed, terrain, population = this.city.initialPopulation ?? 512) { const url = new URL(window.location.href); url.searchParams.set('seed', seed); url.searchParams.set('terrain', terrain); url.searchParams.set('population', population); window.location.assign(url.href); }
}
