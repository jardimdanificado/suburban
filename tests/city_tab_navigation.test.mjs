import test from 'node:test';
import assert from 'node:assert/strict';
import { CityDesktop, CITY_WINDOWS } from '../js/city_desktop.js';
import { ManagementCanvasUI } from '../js/management_ui.js';
import { setup } from './helpers/city.mjs';

function harness(width=1440) {
  const ctx=new Proxy({}, {get:(target,key)=>key in target?target[key]:key==='measureText'?s=>({width:String(s).length*7}):()=>{}});
  globalThis.window={innerWidth:width,innerHeight:900,devicePixelRatio:1,location:{search:''}};
  globalThis.document={createElement:()=>({style:{},value:'',setAttribute(){},addEventListener(){},append(){},remove(){},getContext:()=>ctx})};
  const city=setup({starter:true});
  const ui=new ManagementCanvasUI({style:{},clientWidth:width,clientHeight:900,getContext:()=>ctx});
  const desktop=new CityDesktop({city,root:{append(){}},select:entity=>desktop.setSelection(entity),camera(){}});
  const draw=()=>{ui.beginFrame();desktop.drawChrome(ui);desktop.draw(ui);};
  const click=label=>{draw();const tab=ui.regions.findLast(r=>r.label===label);assert(tab,`Visible control: ${label}`);assert.equal(ui.hitTest(tab.x+tab.w/2,tab.y+tab.h/2),tab);ui.clickAt(tab.x+tab.w/2,tab.y+tab.h/2);};
  return {city,desktop,ui,draw,click};
}

test('visible tabs switch content in the same module window',()=>{
  const h=harness(),state=h.desktop.active,count=h.desktop.manager.windows.length;
  h.click('NECESSIDADES');
  assert.equal(state.view(),'needs');assert.equal(h.desktop.active,state);
  h.click('ATIVIDADE');assert.equal(state.view(),'activity');
  assert.equal(h.desktop.manager.windows.length,count);
});

test('government sections and their subviews reuse the government window',()=>{
  const h=harness(),state=h.desktop.openDestination('government','elections',{politicsTab:'approval'}),count=h.desktop.manager.windows.length;
  h.click('DESDE A POSSE');assert.equal(state.approvalView,'changes');
  h.click('Câmara');assert.equal(state.politicsTab,'council');
  state.openPanel({councilView:'members'});assert.equal(state.councilView,'members');
  h.click('TESOURO');assert.equal(state.view(),'finance');
  assert.equal(h.desktop.openDestination('government','contracts'),state);
  assert.equal(state.view(),'contracts');assert.equal(h.desktop.manager.windows.length,count);
});

test('detaching preserves the current nested tab and gives it independent navigation',()=>{
  const h=harness(),source=h.desktop.openDestination('government','elections',{politicsTab:'approval',approvalView:'changes'});
  source.query='governo';source.search.value=source.query;source.scrolls['government:elections']=24;
  const count=h.desktop.manager.windows.length;h.click('Abrir aba atual em outra janela');
  const detached=h.desktop.active;
  assert.notEqual(detached,source);assert.equal(h.desktop.manager.windows.length,count+1);
  assert.equal(detached.politicsTab,'approval');assert.equal(detached.approvalView,'changes');assert.equal(detached.query,'governo');
  assert.equal(detached.scrolls['government:elections'],source.scrolls['government:elections']);
  detached.openPanel({approvalView:'promise'});
  assert.equal(detached.approvalView,'promise');assert.equal(source.approvalView,'changes');
  detached.filters.government='other';assert.notEqual(source.filters.government,'other');
  assert.equal(h.desktop.manager.windows.length,count+1);
});

test('citizen dossier tabs stay together and can be explicitly detached',()=>{
  const h=harness();h.desktop.setSelection(h.city.citizens[0].entity);
  const state=h.desktop.active,count=h.desktop.manager.windows.length;
  state.openPanel({detailTab:'skills'});assert.equal(h.desktop.active,state);
  assert.equal(h.desktop.manager.windows.length,count);
  const detached=state.openCurrentInWindow();assert.equal(detached.selected,state.selected);
  assert.equal(detached.detailTab,'skills');assert.equal(h.desktop.manager.windows.length,count+1);
  detached.openPanel({detailTab:'history'});assert.equal(state.detailTab,'skills');
});

test('detaching art commissions preserves the chosen narrative without sharing the form fields',()=>{
  const h=harness(),source=h.desktop.openDestination('city','arts');source.artworkNarrativeInput.value='invented';source.artworkEventInput.value='42';source.artworkDraft.value='A história da praça';
  const detached=source.openCurrentInWindow();assert.equal(detached.artworkNarrativeInput.value,'invented');assert.equal(detached.artworkEventInput.value,'42');assert.equal(detached.artworkDraft.value,'A história da praça');
  detached.artworkNarrativeInput.value='none';assert.equal(source.artworkNarrativeInput.value,'invented');assert.doesNotThrow(h.draw);
});

test('election notices and views share one window per election',()=>{
  const h=harness();h.city.politics.active={id:900,round:1};
  const state=h.desktop.openElection(900,'polls'),count=h.desktop.manager.windows.length;
  assert.equal(h.desktop.openElection(900,'count'),state);
  assert.equal(state.electionView,'count');assert.equal(h.desktop.manager.windows.length,count);
  state.openPanel({electionView:'results'});assert.equal(state.electionView,'results');
  assert.equal(h.desktop.manager.windows.length,count);
});

test('tabbed modules render within narrow windows',()=>{
  const h=harness(390);
  for(const [id] of CITY_WINDOWS){
    h.desktop.openModule(id);assert.doesNotThrow(h.draw);
    for(const r of h.ui.regions)assert(r.x>=0&&r.x+r.w<=390,`${id}: ${r.label}`);
  }
  h.desktop.openDestination('government','elections',{politicsTab:'approval'});assert.doesNotThrow(h.draw);
  for(const r of h.ui.regions)assert(r.x>=0&&r.x+r.w<=390,r.label);
});

test('toolbar buttons open and close modules directly while only utilities keep menus',()=>{
  const h=harness();h.draw();
  assert.deepEqual(h.desktop.menuGroups.map(g=>g.id),['tools','windows']);
  for(const [tab,label] of CITY_WINDOWS){
    const existing=h.desktop.manager.find(`module:${tab}`);
    h.click(label);assert.equal(h.desktop.menuOpen,false);
    if(existing)assert.equal(h.desktop.manager.find(existing.id),undefined);
    else{assert(h.desktop.manager.find(`module:${tab}`));h.click(label);assert.equal(h.desktop.manager.find(`module:${tab}`),undefined);}
  }
});

test('a toolbar button works on the first click while a dropdown is open',()=>{
  const h=harness();h.click('Ferramentas — menu');assert(h.desktop.menuOpen);
  const button=h.ui.regions.findLast(r=>r.label==='Cidadãos');assert(button);
  const x=button.x+button.w/2,y=button.y+button.h/2;
  assert.equal(h.desktop.pointerDown(x,y),false);h.desktop.pointerUp();
  h.ui.clickAt(x,y);assert.equal(h.desktop.menuOpen,false);
  assert(h.desktop.manager.find('module:people'));
});

test('remaining dropdowns still switch with keyboard navigation',()=>{
  const h=harness();h.click('Ferramentas — menu');
  assert(h.desktop.menuKey({code:'ArrowRight'}));assert.equal(h.desktop.menuId,'windows');
  assert(h.desktop.menuKey({code:'ArrowRight'}));assert.equal(h.desktop.menuId,'tools');
  assert(h.desktop.menuKey({code:'Escape'}));assert.equal(h.desktop.menuOpen,false);
});
