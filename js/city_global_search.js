import {MANAGEMENT_THEME} from './management_ui.js';
import {roomFurnitureForCity} from './city_furniture_catalog.js';
import {PLANT_SPECIES} from './city_nature.js';
import {POLITICS_SECTIONS} from './city_ui_sections.js';
import {CityUI,TABS, VIEWS, FILTERS} from './city_ui.js?v=justice-panels-1';
import {BUILDING_TYPES} from './city_simulation.js?v=service-capacity-3';

export const normalizeSearch = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const values = collection => collection instanceof Map ? [...collection.values()] : collection || [];
const entityName = record => record.entity?.properties?.name;

/** Search records carry routes, never references to mutable simulation objects. */
export function globalSearchRecords(desktop) {
  const city = desktop.city, records = [];
  const add = (kind, id, label, description, route, aliases = '') => {
    if (!label) return;
    records.push({labelText:normalizeSearch(label),key:`${kind}:${id}`,kind,label:String(label),description:String(description || ''),route,
      text:normalizeSearch(`${kind} ${label} ${description || ''} ${aliases} ${id}`)});
  };
  for (const [tab,label] of desktop.modules) {
    const meta = TABS.find(t => t[0] === tab);
    add('Aba',tab,label,meta?.[3] || 'Abrir seção da cidade',{type:'destination',tab},meta?.[1]);
    for (const [view,title] of VIEWS[tab] || []) add('Painel',`${tab}/${view}`,title,label,{type:'destination',tab,view});
    for (const [filter,title] of FILTERS[tab] || []) if(filter !== 'all') add('Filtro',`${tab}/${filter}`,title,label,{type:'destination',tab,overrides:{filters:{[tab]:filter}}});
  }
  for(const [id,label] of POLITICS_SECTIONS)
    add('Painel',`politics/${id}`,label,'Governo · Política',{type:'destination',tab:'government',view:'elections',overrides:{politicsTab:id}});
  for(const w of desktop.manager.windows) add('Janela',w.id,w.title,'Janela aberta',{type:'window',id:w.id});
  for(const [id,label] of [['options','Opções'],['editor','Editor de mapa'],['center','Centralizar câmera'],['pause','Pausar / continuar'],['speed','Alterar velocidade']])
    add('Comando',id,label,'Ferramentas',{type:'command',id});
  for(const c of city.citizens || []) if(!c.entity.destroyed) add('Pessoa',c.id,entityName(c),`${c.action || ''} · #${c.id}`,{type:'entity',id:c.id,collection:'citizens'},'pessoas cidadãos moradores habitantes');
  const businesses = new Set((city.economy?.businesses || []).map(b=>b.id));
  for(const b of city.buildings || []) if(!b.entity.destroyed) add(businesses.has(b.id)?'Empresa':'Prédio',b.id,entityName(b),`${BUILDING_TYPES[b.type]?.label || b.type} · #${b.id}`,{type:'entity',id:b.id,collection:'buildings'},'imóveis prédios edifícios ' + (businesses.has(b.id)?'empresas negócios':''));
  const roomNames={bedroom:'Quarto',bathroom:'Banheiro',dining:'Refeitório',workspace:'Área da empresa',circulation:'Circulação',office:'Gabinete',plenary:'Plenário',service:'Atendimento',treatment:'Consultório',balcony:'Varanda',roof_terrace:'Cobertura'};
  for(const b of city.buildings || []) if(!b.entity.destroyed) for(const u of b.units || []) {
    const description=`${entityName(b)} · ${u.z+1}º andar · espaço ${u.x+1}, ${u.y+1}`;
    const route={type:'entity',id:b.id,collection:'buildings',unitId:u.id};
    add('Cômodo',u.id,roomNames[u.roomType] || 'Espaço',description,route,'casa unidade');
    for(const f of roomFurnitureForCity(city,b,u)) add('Móvel',f.id,f.label,description,route,'mobília móveis equipamento');
  }
  for(const c of city.citizens || []) if(!c.entity.destroyed) for(const [index,g] of (c.wardrobe || []).entries())
    add('Roupa',`${c.id}/${index}`,g.piece,`${g.brandName || ''} · ${g.style || ''} · ${entityName(c)}`,{type:'entity',id:c.id,collection:'citizens',detailTab:'profile'},'vestuário item');
  for(const p of values(city.nature?.plants)) add('Planta',p.id,`${PLANT_SPECIES[p.species]?.label || p.species} #${p.id}`,`${p.x}, ${p.y}`,{type:'plant',id:p.id},'vegetação árvore');
  for(const [id,g] of Object.entries(city.economy?.goods || {})) add('Item',id,g.label,'Produto · estoques e proprietários',{type:'destination',tab:'market',view:'goods',overrides:{wealthGoodId:id}},'itens produtos mercadorias recursos estoque');
  for(const v of values(city.vehicles?.units)) if(!v.scrapped) {
    const model=city.vehicles.model(v);
    add('Veículo',v.id,`${model?.name || v.good} #${v.id}`,`${model?.brand || ''} · ${city.accountName(v.ownerAccountId || v.holderAccountId)}`,{type:'destination',tab:'transport',view:'vehicles',overrides:{selectedVehicleId:v.id}},'frota bicicleta');
  }
  for(const p of city.development?.plots || []) add('Terreno',p.id,`Terreno ${p.id}`,city.accountName(p.ownerId),{type:'plot',id:p.id},'lote');
  for(const p of city.development?.projects || []) if(!p.cancelled) add('Obra',p.id,p.name || `Obra ${p.id}`,p.status,{type:'contract',id:p.id},'contrato projeto construção');
  for(const p of values(city.politics?.parties)) add('Partido',p.id,p.name,p.short,{type:'party',id:p.id});
  for(const doc of values(city.publications?.documents)) add('Publicação',doc.id,doc.title,city.accountName(doc.ownerAccountId),{type:'destination',tab:'publications',overrides:{selectedPublicationId:doc.id}},'livro jornal panfleto');
  for(const art of city.justice?.art||[])if(!art.entity.destroyed)add('Arte urbana',art.id,art.layers.at(-1)?.message||art.message,`${city.justice.labelArt(art.kind)} · ${art.truth===false?'mensagem falsa':'mensagem pública'}`,{type:'urban-art',id:art.id},'pichação banner estátua monumento pintura');
  for(const record of city.justice?.cases||[])if(!['closed','dismissed'].includes(record.status))add('Ocorrência',record.id,`Caso ${record.id} · ${city.justice.labelCrime(record.type)}`,`${record.status} · severidade ${record.severity}`,{type:'justice-case',id:record.id},'crime polícia investigação BO');
  for(const body of city.justice?.activeBodies()||[])add('Corpo',body.id,body.name,`${body.cause} · ${body.status}`,{type:'corpse',id:body.id},'IML morte autópsia');
  // History is bounded by the simulation's retention limit; search only retained records.
  for(const e of city.history?.query({limit:Infinity}) || city.events || []) add('Evento',e.id,e.message,`Histórico · dia ${Math.floor(e.minute/1440)+1}`,{type:'event',id:e.id},e.category);
  return records;
}

export function searchGlobal(records, query, kind = '', limit = 80) {
  const words=normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  return records.filter(r=>(!kind || r.kind===kind)&&words.every(w=>r.text.includes(w)))
    .map((r,index)=>({r,index,score:words.length ? ((r.labelText ?? normalizeSearch(r.label))===words.join(' ')?0:(r.labelText ?? normalizeSearch(r.label)).startsWith(words.join(' '))?1:words.every(w=>(r.labelText ?? normalizeSearch(r.label)).includes(w))?2:3):0}))
    .sort((a,b)=>a.score-b.score || a.index-b.index).slice(0,limit).map(v=>v.r);
}

export function activateGlobalResult(desktop, result) {
  const r=result.route, city=desktop.city;
  if(r.type==='window') {const w=desktop.manager.find(r.id);if(!w)return false;desktop.hidden=false;desktop.element.hidden=false;desktop.manager.raise(w.id);if(w.shaded)desktop.manager.shade(w.id);return true;}
  if(r.type==='entity') {const record=city[r.collection]?.find(v=>v.id===r.id&&!v.entity.destroyed);if(!record)return false;desktop.select(record.entity,r.unitId);if(r.detailTab&&desktop.active)desktop.active.detailTab=r.detailTab;desktop.camera?.(record.entity.x,record.entity.y);return true;}
  if(r.type==='plant') {const plant=city.nature?.plants.get(r.id);if(!plant)return false;desktop.openDestination('city','nature',{selectedPlantId:r.id});desktop.camera?.(plant.x,plant.y);return true;}
  if(r.type==='destination') {const state=desktop.openDestination(r.tab,r.view, {selected:null,query:'',recordWindow:false,wealthAccountId:null,wealthLocationId:null,wealthGoodId:null,marketSaleId:null,selectedPublicationId:null,selectedVehicleId:null,selectedShipmentId:null,selectedPlotId:null,selectedProjectId:null,billId:null,termId:null,pollId:null,electionId:null,studyId:null,...r.overrides});state.search.value='';return true;}
  if(r.type==='command') {desktop.controls[r.id]?.();return true;}
  if(r.type==='plot') {if(!city.development.plots.some(p=>p.id===r.id))return false;desktop.setPlotSelection(r.id);return true;}
  if(r.type==='party') return !!desktop.openParty(r.id);
  if(r.type==='contract') return !!desktop.openContract(r.id);
  if(r.type==='event') {if(!city.history.get(r.id))return false;desktop.openEvent(r.id);return true;}
  if(r.type==='urban-art'){const art=city.justice?.art.find(a=>a.id===r.id&&!a.entity.destroyed);if(!art)return false;desktop.openDestination('city','arts');desktop.camera?.(art.entity.x,art.entity.y);return true;}
  if(r.type==='justice-case'){const record=city.justice?.cases.find(c=>c.id===r.id);if(!record)return false;desktop.openDestination('city','arts');if(record.position)desktop.camera?.(record.position.x,record.position.y);return true;}
  if(r.type==='corpse'){const body=city.justice?.bodies.find(b=>b.id===r.id&&b.status!=='cremated');if(!body)return false;desktop.openDestination('sanitation','deaths');desktop.camera?.(body.entity.x,body.entity.y);return true;}
  return false;
}

/** Uses the same window frame, canvas records and native inputs as every directory. */
export class CityGlobalSearch extends CityUI {
  constructor(desktop,root) {
    super({city:desktop.city,root,select:desktop.select,camera:desktop.camera,host:desktop});
    this.desktop=desktop;this.tab='global-search';this.windowId='tool:global-search';this.kindFilter='';this.openCurrentInWindow=null;
    this.search.placeholder='Pessoas, prédios, itens, abas…';this.search.setAttribute('aria-label','Pesquisar qualquer coisa');
    this.filterInput.setAttribute('aria-label','Tipo de resultado');
    this.search.addEventListener('input',()=>this.refresh());
    // Replace the directory's category handler with the global type filter.
    this.setFilter=value=>{this.kindFilter=value;this.refresh();};
    for(const input of [this.search,this.filterInput]) {
      input.addEventListener('pointerdown',()=>desktop.manager.raise(this.windowId));
      input.addEventListener('keydown',event=>{
        // Text editing must not reach directory or city shortcuts (C, /, Backspace…).
        event.stopPropagation();
        if(event.isComposing)return;
        if((event.ctrlKey||event.metaKey)&&event.code==='KeyK'){event.preventDefault();this.search.focus();this.search.select();return;}
        if(event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
        if(event.code==='Escape'||event.key==='Escape'){event.preventDefault();desktop.close(this.windowId);}
        else if(input===this.search&&['ArrowDown','ArrowUp','Enter'].includes(event.code||event.key)){
          if(this.key(event))event.preventDefault();
        }
      });
    }
    this.onClose=()=>{this.visible=false;desktop.globalSearch=null;};
  }
  open(){
    this.desktop.closeMenu();
    const w=this.desktop.manager.open({id:this.windowId,title:'Busca geral',width:600,height:520,minWidth:300,minHeight:200,state:this});w.kind='tool';
    if(w.shaded)this.desktop.manager.shade(w.id);
    this.desktop.hidden=false;this.desktop.element.hidden=false;this.element.hidden=false;this.visible=true;
    this.records=globalSearchRecords(this.desktop);this.refresh();this.search.hidden=false;this.search.focus();this.search.select();
  }
  refresh(){this.rows=searchGlobal(this.records||[],this.search.value,this.kindFilter,81);this.more=this.rows.length>80;this.rows=this.rows.slice(0,80);this.index=0;this.scrolls.results=0;}
  choose(index){
    this.index=Math.max(0,Math.min(this.rows.length-1,index));
    const h=this.resultHeight||200,top=this.index*32,scroll=this.scrolls.results||0;
    if(top<scroll)this.scrolls.results=top;else if(top+32>scroll+h-8)this.scrolls.results=top+32-h+8;
  }
  key(event){
    const code=event.code||event.key;
    if(['ArrowDown','ArrowUp'].includes(code)){this.choose(this.index+(code==='ArrowDown'?1:-1));return true;}
    if(code==='Enter'){this.activate(this.rows[this.index]);return true;}
    return super.key(event);
  }
  activate(row){
    if(!row)return;
    if(activateGlobalResult(this.desktop,row)){if(row.route.type!=='window'||row.route.id!==this.windowId)this.desktop.close(this.windowId);}
    else{this.records=globalSearchRecords(this.desktop);this.refresh();this.notice='Este registro não está mais disponível. Resultados atualizados.';}
  }
  drawFloating(ui,w){
    this.beginInputs();this.zones=[];
    const x=w.x+9,y=w.y+28,width=w.w-18,filterWidth=Math.min(140,Math.floor(width*.4));
    this.inputAt(this.search,x,y,width-filterWidth-6);
    this.nativeSelect(this.filterInput,{top:y,bottom:y+20},[['','Todos os tipos'],...[...new Set(this.records.map(r=>r.kind))].map(k=>[k,k])],this.kindFilter,x+width-filterWidth,y,filterWidth);
    const status=this.notice||(this.rows.length?`${this.more?'Primeiros ':''}${this.rows.length} resultados${this.more?' · refine a busca':''}`:'Nenhum resultado. Tente outro nome ou tipo.');
    ui.text(ui.fitText(status,width),x,y+27,MANAGEMENT_THEME.muted);
    this.resultHeight=Math.max(24,w.h-105);
    this.pane(ui,'results',x,y+46,width,this.resultHeight,p=>p.rows(this.rows,(row,index)=>p.record(row.label,`${row.kind} · ${row.description}`,()=>this.activate(row),index===this.index)));
    ui.text(ui.fitText('↑ ↓ escolher · Enter abrir · Esc fechar',width),x,w.y+w.h-23,MANAGEMENT_THEME.muted);
    this.finishInputs();
  }
}
