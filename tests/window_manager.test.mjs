import test from 'node:test';
import assert from 'node:assert/strict';
import {WindowManager} from '../js/window_manager.js';
import {CityDesktop,CITY_WINDOWS} from '../js/city_desktop.js';
import {ManagementCanvasUI} from '../js/management_ui.js';
import {OptionsPanel} from '../js/options.js';
import {MapEditor} from '../js/map_editor.js';
import {SimulationTime} from '../js/simulation_time.js';
import {setup} from './helpers/city.mjs';

const manager=()=>new WindowManager({width:1100,height:800});
function harness(width=1440,height=900){
  const ctx=new Proxy({}, {get:(target,key)=>key in target?target[key]:key==='measureText'?(s)=>({width:String(s).length*7}):()=>{}});
  globalThis.window={innerWidth:width,innerHeight:height,devicePixelRatio:1};
  globalThis.document={createElement:()=>({style:{},value:'',handlers:{},setAttribute(){},addEventListener(k,v){this.handlers[k]=v;},append(){},remove(){this.removed=true;},focus(){},getContext:()=>ctx})};
  const city=setup(),ui=new ManagementCanvasUI({style:{},clientWidth:width,clientHeight:height,getContext:()=>ctx});
  const desktop=new CityDesktop({city,root:{append(){}},select:(entity,unit)=>desktop.setSelection(entity,unit),camera:(x,y)=>{desktop.cameraTarget={x,y};}});
  const draw=()=>{ui.beginFrame();desktop.drawChrome(ui);desktop.draw(ui);};draw();return{city,ui,desktop,draw};
}

test('opening a window again focuses its existing state without duplicating it',()=>{
  const m=manager(),a=m.open({id:'a',state:{query:'Ana'}}),b=m.open({id:'b'});assert.equal(m.at(b.x+80,b.y+60),b);
  assert.equal(m.open({id:'a'}),a);assert.equal(m.active,a);assert.equal(m.windows.length,2);assert.equal(a.state.query,'Ana');
});
test('caption dragging moves only its window and respects the usable screen',()=>{
  const m=manager(),a=m.open({id:'a'}),b=m.open({id:'b'}),before={x:a.x,y:a.y};
  assert(m.pointerDown(b.x+70,b.y+12));m.pointerMove(2000,2000);m.pointerUp();assert.deepEqual({x:a.x,y:a.y},before);assert(b.x+b.w<=1100);assert(b.y+b.h<=770);assert(!m.pointerMove(20,30));
});
test('resize handles enforce minimum dimensions and keep controls out of the toolbar',()=>{
  const m=manager(),w=m.open({id:'a',minWidth:300,minHeight:220});assert(m.pointerDown(w.x+w.w-4,w.y+w.h-4));m.pointerMove(-2000,-2000);m.pointerUp();assert.equal(w.w,300);assert.equal(w.h,220);assert(w.y>=m.top);
});
test('nearby windows snap their edges when dragged',()=>{
  const m=manager(),a=m.open({id:'a',width:300}),b=m.open({id:'b',width:300});a.x=10;a.y=80;b.x=320;b.y=80;m.snapWindow(b);assert.equal(b.x,a.x+a.w+2);
});
test('pinned windows survive close-all while explicit close and shift-close remain available',()=>{
  const m=manager();m.open({id:'a'});m.open({id:'b'});m.pin('a');m.closeAll();assert.deepEqual(m.windows.map(w=>w.id),['a']);m.closeAll(true);assert.equal(m.windows.length,0);
});
test('shaded windows expose only their caption and restore their complete body',()=>{
  const m=manager(),w=m.open({id:'a'});m.shade('a');assert.equal(m.rect(w).h,26);assert.equal(m.at(w.x+20,w.y+50),undefined);m.shade('a');assert.equal(m.rect(w).h,w.h);
});
test('maximize follows viewport changes and restores the original geometry',()=>{
  const m=manager(),w=m.open({id:'a'}),original={x:w.x,y:w.y,w:w.w,h:w.h};m.maximize('a');assert.equal(w.w,1092);m.viewport(1400,900);assert.equal(w.w,1392);m.maximize('a');assert.deepEqual({x:w.x,y:w.y,w:w.w,h:w.h},original);
});
test('closed windows reopen at their last position and size',()=>{
  const m=manager(),w=m.open({id:'a'});Object.assign(w,{x:110,y:105,w:450,h:400});m.close('a');const reopened=m.open({id:'a'});assert.deepEqual({x:reopened.x,y:reopened.y,w:reopened.w,h:reopened.h},{x:110,y:105,w:450,h:400});
});
test('cascade leaves pinned windows where they are and small viewports keep captions accessible',()=>{
  const m=manager(),a=m.open({id:'a'}),b=m.open({id:'b'});m.pin('a');const pos={x:a.x,y:a.y};m.cascade();assert.deepEqual({x:a.x,y:a.y},pos);m.viewport(390,500);for(const w of[a,b]){assert(w.x>=0&&w.x+w.w<=390);assert(w.y>=m.top&&w.y+w.h<=470);}
});

test('directories and multiple citizen dossiers remain open with independent filters and scroll',()=>{
  const h=harness(),directory=h.desktop.openModule('people');for(const c of h.city.citizens.slice(0,8))h.city.releaseHome(c);directory.setFilter('homeless');directory.scrolls.list=80;
  for(const c of h.city.citizens.slice(0,2))h.desktop.setSelection(c.entity);h.draw();
  assert(h.desktop.manager.find('module:people'));assert.equal(h.desktop.manager.windows.filter(w=>w.id.startsWith('person:')).length,2);assert.equal(directory.filter(),'homeless');assert.equal(directory.scrolls.list,80);
  h.desktop.setSelection(h.city.citizens[0].entity);assert.equal(h.desktop.manager.windows.filter(w=>w.id.startsWith('person:')).length,2);
});
test('links from a panorama open and filter the destination without replacing the panorama',()=>{
  const h=harness(),panorama=h.desktop.manager.find('module:city').state;panorama.go('people',{filter:'homeless'});assert.equal(h.desktop.manager.find('module:people').state.filter(),'homeless');assert.equal(panorama.tab,'city');
});
test('underlying native inputs are hidden whenever a higher window covers them',()=>{
  const h=harness(),a=h.desktop.openModule('people');h.draw();const lower=h.desktop.manager.find('module:people');const b=h.desktop.openModule('economy'),upper=h.desktop.manager.find('module:economy');Object.assign(upper,{x:lower.x,y:lower.y,w:lower.w,h:lower.h});h.draw();assert(a.search.hidden);assert(!b.search.hidden);
  h.desktop.close(upper.id);h.draw();assert(!a.search.hidden);
});
test('pointer gestures and scrollbars act only on the topmost window',()=>{
  const h=harness();h.desktop.openModule('people');h.draw();const w=h.desktop.manager.active,z=w.state.zones.find(z=>z.key==='list');assert(z.max>0);
  assert(h.desktop.pointerDown(z.x+z.w-5,z.y+20));h.desktop.pointerMove(z.x+z.w-5,z.y+80);h.desktop.pointerUp();assert(w.state.scrolls.list>0);
  const start=w.x;assert(h.desktop.pointerDown(w.x+70,w.y+10));h.desktop.pointerMove(w.x+110,w.y+10);h.desktop.pointerUp();assert.notEqual(w.x,start);
});
test('utilities share the window manager and options remain non-modal',()=>{
  const h=harness(),options=new OptionsPanel({renderer:new Proxy({}, {get:()=>()=>{}}),time:new SimulationTime(),step(){}}),editor=new MapEditor({world:h.city.world,entities:[],destroyEntity(){}});
  h.desktop.openTool('options',options);h.desktop.openTool('editor',editor);h.draw();assert(h.desktop.manager.find('tool:options'));assert(h.desktop.manager.find('tool:editor'));assert.equal(options.open,true);assert.equal(editor.open,true);
  h.desktop.close('tool:editor');assert.equal(editor.open,false);h.draw();
});
test('every management window renders on narrow screens with all interactive regions in bounds',()=>{
  const h=harness(390,844);for(const [id]of CITY_WINDOWS){h.desktop.openModule(id);assert.doesNotThrow(h.draw);for(const r of h.ui.regions)assert(r.x>=0&&r.x+r.w<=390,`${id}: ${r.label}`);}
  h.desktop.closeAll(true);h.draw();assert.equal(h.desktop.visible,false);h.desktop.openModule('people');h.draw();assert(h.desktop.visible);
});
test('minimap clicks centralize the camera and keyboard shortcuts respect pinned windows',()=>{
  const h=harness();h.desktop.openModule('map');h.draw();const r=h.ui.regions.find(r=>r.label==='Navegar no mapa');assert(r);h.ui.clickAt(r.x+r.w/2,r.y+r.h/2);assert(Math.abs(h.desktop.cameraTarget.x-h.city.world.width/2)<1);
  h.desktop.manager.pin('module:map');h.desktop.key({code:'Delete'});assert.deepEqual(h.desktop.manager.windows.map(w=>w.id),['module:map']);h.desktop.key({code:'Delete',shiftKey:true});assert.equal(h.desktop.manager.windows.length,0);
});

test('partial overlap clips native fields rather than losing their visible half',()=>{
  const h=harness(),state=h.desktop.openModule('people');h.draw();const lower=h.desktop.manager.active;
  const upperState=h.desktop.openModule('economy'),upper=h.desktop.manager.active;
  upper.x=lower.x+180;upper.y=lower.y;h.draw();assert(!state.search.hidden);assert(state.search.style.clipPath.startsWith('path('));
  h.desktop.close(upper.id);h.draw();assert.equal(state.search.style.clipPath,'');assert(upperState);
});

test('floating options scroll, move and yield focus to other windows',()=>{
  const h=harness(),options=new OptionsPanel({renderer:new Proxy({}, {get:()=>()=>{}}),time:new SimulationTime(),step(){}});
  h.desktop.openTool('options',options);options.tab='EFFECTS';h.draw();const w=h.desktop.manager.active;
  assert(h.desktop.scrollAt(w.x+80,w.y+120,120));assert(options.scroll>0);
  const start=w.x;assert(h.desktop.pointerDown(w.x+90,w.y+12));h.desktop.pointerMove(w.x+140,w.y+12);h.desktop.pointerUp();assert.equal(w.x,start+50);
  h.desktop.openModule('people');h.draw();assert.equal(h.desktop.manager.active.id,'module:people');assert(options.open);
  h.desktop.close('tool:options');assert.equal(options.open,false);assert.equal(options.bounds,null);
});

test('tooltips use a separate overlay and disappear when the pointer leaves the toolbar',()=>{
  const h=harness();h.desktop.openModule('people');
  h.ui.beginFrame(450,10);h.desktop.drawChrome(h.ui);h.desktop.draw(h.ui);
  assert.equal(h.desktop.tooltipElement.hidden,false);assert(h.desktop.tooltipElement.textContent);assert(h.desktop.tooltipElement.style.left);
  h.ui.beginFrame(-1,-1);h.desktop.drawChrome(h.ui);h.desktop.draw(h.ui);assert.equal(h.desktop.tooltipElement.hidden,true);
});

test('caption controls sit together on the right and never initiate a window drag',()=>{
  for(const width of [390,1440]){
    const h=harness(width,800),w=h.desktop.manager.active;h.draw();
    const controls=['Fixar','Recolher','Ampliar','Fechar'].map(label=>h.ui.regions.find(r=>r.label===`${label}: ${w.title}`));
    assert(controls.every(Boolean));
    for(let i=0;i<controls.length;i++){
      const r=controls[i];assert(r.x>=w.x+w.w-101);assert(r.x+r.w<=w.x+w.w);
      if(i)assert(controls[i-1].x+controls[i-1].w<r.x);
      assert.equal(h.desktop.manager.caption(w,r.x+r.w/2,r.y+r.h/2),false);
    }
    assert(h.desktop.manager.caption(w,w.x+8,w.y+12));
    controls.at(-1).onClick();assert.equal(h.desktop.manager.find(w.id),undefined);
  }
});

test('toolbar buttons toggle their dialogs while internal navigation keeps existing dialogs open',()=>{
  const h=harness();
  const click=()=>{h.draw();const button=h.ui.regions.find(r=>r.label==='Cidadãos');assert(button);button.onClick();};
  click();assert(h.desktop.manager.find('module:people'));
  h.desktop.manager.pin('module:people');click();assert.equal(h.desktop.manager.find('module:people'),undefined);
  click();const state=h.desktop.manager.find('module:people').state;
  h.desktop.openModule('people');assert.equal(h.desktop.manager.find('module:people').state,state);
  click();assert.equal(h.desktop.manager.find('module:people'),undefined);
});
