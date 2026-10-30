import test from 'node:test';
import assert from 'node:assert/strict';
import {globalSearchRecords,searchGlobal,activateGlobalResult} from '../js/city_global_search.js';
import {CITY_WINDOWS} from '../js/city_desktop.js';
import {WindowManager} from '../js/window_manager.js';
import {setup} from './helpers/city.mjs';

function fixture(){
  const city=setup({starter:true}),calls=[],manager=new WindowManager();
  const desktop={city,modules:CITY_WINDOWS,manager,element:{hidden:true},hidden:true,
    select:e=>calls.push(['select',e.id]),camera:(x,y)=>calls.push(['camera',x,y]),
    openDestination:(...args)=>{calls.push(['destination',...args]);return {search:{value:'old'}};},
    controls:{pause:()=>calls.push(['pause'])},setPlotSelection:id=>calls.push(['plot',id]),
    openEvent:id=>calls.push(['event',id])};
  return {city,desktop,calls};
}
test('search indexes real city records and every module, view and open window',()=>{
  const {city,desktop}=fixture();city.log('Registro exclusivo da busca','city');
  desktop.manager.open({id:'open:1',title:'Minha janela'});
  const records=globalSearchRecords(desktop);
  for(const kind of ['Pessoa','Prédio','Empresa','Item','Terreno','Partido','Evento','Aba','Painel','Janela','Comando'])assert(records.some(r=>r.kind===kind),kind);
  for(const [tab] of CITY_WINDOWS)assert(records.some(r=>r.route.tab===tab));
  assert(searchGlobal(records,'registro exclusivo').some(r=>r.kind==='Evento'));
  assert(searchGlobal(records,'Minha janela').some(r=>r.route.id==='open:1'));
  const c=city.citizens[0];assert(searchGlobal(records,c.entity.properties.name)[0].route.id===c.id);
});
test('search ignores accents and case, matches multiple words, prioritizes names, and supports type filters',()=>{
  const {desktop}=fixture(),records=globalSearchRecords(desktop);
  const result=searchGlobal(records,'PRODUCAO');assert(result.length);assert.equal(result[0].label,'Produção');
  assert(searchGlobal(records,'estoques proprietarios','Item').length>0);
  assert(searchGlobal(records,'estoques proprietarios','Item').every(r=>r.kind==='Item'));
  assert.deepEqual(searchGlobal(records,'qqqnaoexiste'),[]);
  assert.equal(searchGlobal(records,'','',3).length,3);
});
test('results open entities on the map, goods details, windows and commands',()=>{
  const {city,desktop,calls}=fixture(),records=globalSearchRecords(desktop);
  const person=records.find(r=>r.kind==='Pessoa');assert(activateGlobalResult(desktop,person));
  assert.deepEqual(calls[0],['select',person.route.id]);assert.equal(calls[1][0],'camera');
  const item=records.find(r=>r.kind==='Item');activateGlobalResult(desktop,item);
  assert.equal(calls.at(-1)[1],'market');assert.equal(calls.at(-1)[3].wealthGoodId,item.route.overrides.wealthGoodId);
  const w=desktop.manager.open({id:'existing',title:'Aberta'});w.shaded=true;
  activateGlobalResult(desktop,{route:{type:'window',id:w.id}});assert.equal(w.shaded,false);assert.equal(desktop.hidden,false);assert.equal(desktop.element.hidden,false);
  activateGlobalResult(desktop,records.find(r=>r.route.type==='command'&&r.route.id==='pause'));assert.equal(calls.at(-1)[0],'pause');
  city.citizens.find(c=>c.id===person.route.id).entity.destroyed=true;assert.equal(activateGlobalResult(desktop,person),false);
  desktop.manager.close(w.id);assert.equal(activateGlobalResult(desktop,{route:{type:'window',id:w.id}}),false);
});

// Minimal DOM for exercising focus and event handling without a WebGL renderer.
function dom(){
  const doc={activeElement:null};
  doc.createElement=tag=>({tagName:tag.toUpperCase(),style:{},children:[],handlers:{},attrs:{},value:'',hidden:false,
    classList:{toggle(){}},setAttribute(k,v){this.attrs[k]=v;},
    append(...els){for(const el of els){el.parentElement=this;this.children.push(el);}},
    replaceChildren(...els){this.children=[];this.append(...els);},
    addEventListener(k,v){this.handlers[k]=v;},focus(){doc.activeElement=this;},select(){},scrollIntoView(){},
    querySelectorAll(){return this.children.flatMap(el=>[...(['BUTTON','INPUT','SELECT'].includes(el.tagName)?[el]:[]),...el.querySelectorAll()]);}
  });
  globalThis.document=doc;globalThis.window={location:{search:''}};return doc;
}

test('search is a managed window that moves, resizes, shades and remembers its geometry',async()=>{
  const doc=dom(),{CityDesktop}=await import('../js/city_desktop.js'),city=setup({starter:true});
  const desktop=new CityDesktop({city,root:doc.createElement('div'),select(){},camera(){}});
  desktop.openGlobalSearch();const search=desktop.globalSearch,w=desktop.manager.find('tool:global-search');
  assert.equal(w.state,search);assert.equal(doc.activeElement,search.search);
  const before={x:w.x,y:w.y,w:w.w,h:w.h};
  assert(desktop.pointerDown(w.x+60,w.y+10));desktop.pointerMove(w.x+100,w.y+40);desktop.pointerUp();assert.notEqual(w.x,before.x);
  assert(desktop.pointerDown(w.x+w.w-8,w.y+w.h-8));desktop.pointerMove(w.x+w.w+60,w.y+w.h+40);desktop.pointerUp();assert(w.w>before.w);
  const geometry={x:w.x,y:w.y,w:w.w,h:w.h};desktop.manager.shade(w.id);desktop.openGlobalSearch();assert.equal(w.shaded,false);assert.equal(desktop.manager.windows.filter(w=>w.id==='tool:global-search').length,1);
  search.search.value='estoques proprietarios';search.kindFilter='Item';search.refresh();assert(search.rows.length);assert(search.rows.every(r=>r.kind==='Item'));
  search.key({code:'ArrowDown'});assert.equal(search.index,1);search.key({code:'ArrowUp'});assert.equal(search.index,0);
  desktop.close(w.id);assert.equal(desktop.globalSearch,null);desktop.openGlobalSearch();const reopened=desktop.manager.find(w.id);assert.deepEqual({x:reopened.x,y:reopened.y,w:reopened.w,h:reopened.h},geometry);
});

test('all native inputs start hidden and unused analytics filters are hidden after every frame',async()=>{
  dom();const {CityUI}=await import('../js/city_ui.js'),city=setup({starter:true});
  const state=new CityUI({city,root:document.createElement('div'),select(){},camera(){}});
  assert(state.inputs.includes(state.analyticsTypeInput));assert(state.inputs.every(input=>input.hidden));
  state.beginInputs();state.inputAt(state.analyticsTypeInput,20,50,100);state.finishInputs();assert.equal(state.analyticsTypeInput.hidden,false);
  state.beginInputs();state.finishInputs();assert.equal(state.analyticsTypeInput.hidden,true);
});

test('search navigation uses actual desktop dossiers and clears prior item details',async()=>{
  dom();const {CityDesktop}=await import('../js/city_desktop.js');const city=setup({starter:true});
  const desktop=new CityDesktop({city,root:document.createElement('div'),select:(entity,unit)=>desktop.setSelection(entity,unit),camera(){}});
  let records=globalSearchRecords(desktop);const room=records.find(r=>r.kind==='Cômodo');
  activateGlobalResult(desktop,room);assert.equal(desktop.unitId,room.route.unitId);assert.equal(desktop.active.detailTab,'units');
  const item=records.find(r=>r.kind==='Item');activateGlobalResult(desktop,item);assert.equal(desktop.tab,'market');assert.equal(desktop.active.wealthGoodId,item.route.overrides.wealthGoodId);
  activateGlobalResult(desktop,records.find(r=>r.kind==='Aba'&&r.route.tab==='market'));assert.equal(desktop.active.wealthGoodId,null);assert.equal(desktop.active.view(),'overview');
  const person=records.find(r=>r.kind==='Pessoa');activateGlobalResult(desktop,person);assert.equal(desktop.selected.id,person.route.id);assert.equal(desktop.active.detailTab,'profile');
  desktop.openGlobalSearch();assert.equal(desktop.globalSearch.element.parentElement,desktop.element);
});

test('typing in global search preserves letters and native editing without invoking window shortcuts',async()=>{
  const doc=dom(),{CityDesktop}=await import('../js/city_desktop.js'),city=setup({starter:true});
  const desktop=new CityDesktop({city,root:doc.createElement('div'),select(){},camera(){}});desktop.openGlobalSearch();
  const search=desktop.globalSearch,id=desktop.manager.activeId;
  for(const code of ['KeyC','KeyO','KeyS','Slash','Backspace','Home','End','Space','ArrowLeft','ArrowRight','Delete']){
    let prevented=false,stopped=false;
    search.search.handlers.keydown({code,key:code,preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});
    assert.equal(prevented,false,`${code} must keep its native text behavior`);assert(stopped);assert.equal(search.visible,true);assert.equal(desktop.manager.activeId,id);
  }
  let prevented=false;search.search.handlers.keydown({code:'ArrowDown',preventDefault(){prevented=true;},stopPropagation(){}});
  assert(prevented);assert.equal(search.index,1);
  prevented=false;search.search.handlers.keydown({code:'KeyC',ctrlKey:true,preventDefault(){prevented=true;},stopPropagation(){}});assert.equal(prevented,false,'copy remains native');
  search.search.handlers.keydown({code:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(desktop.manager.find(id),undefined);
});
