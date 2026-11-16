import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {mayorDecisions,mayorTargetAt,renderMayorTarget,mayorStatus} from '../js/city_mayor_play.js';
import {renderMayorCampaign} from '../js/city_mayor_ui.js';
import {CityDesktop} from '../js/city_desktop.js';
import {findPublicBuildingSite} from '../js/city_public_land.js';
const start=()=>{const city=setup({starter:true,population:24});assert(city.mayorAction('start'),city.lastError);assert(city.mayorAction('confirmReview',{kind:'government'}));return city;};
function page(){
  const buttons=[],headings=[];
  const p=new Proxy({button(label,click){buttons.push({label,click});},buttons(rows){buttons.push(...rows);},heading(text){headings.push(text);}}, {get:(object,key)=>object[key]||(()=>{})});
  return {p,buttons,headings};
}
const state=city=>({city,mayorDesk:true,matches:()=>true,selectControl(){},resetScroll(){},openPanel(){}});

test('map designation contracts the chosen lot; invalid locations never fall back or spend funds',()=>{
  const city=start();city.politics.fundInitialWorksBudget();
  const site=city.development.publicBuildingSite('clinic');assert(site);
  const {lot}=site,cash=totalMoney(city),treasury=city.treasury,budget=city.politics.ensureWorksBudget(),plots=city.development.plots.length;
  assert(!city.mayorAction('build',{type:'clinic',plotId:-1}));
  assert.equal(city.treasury,treasury);assert.equal(city.politics.ensureWorksBudget(),budget);assert.equal(city.development.plots.length,plots);
  const project=city.mayorAction('build',{type:'clinic',plotId:lot.id});assert(project,city.lastError);assert.equal(project.plotId,lot.id);
  const after=city.treasury;
  assert(!city.mayorAction('build',{type:'clinic',plotId:lot.id}));assert.equal(city.treasury,after);
  assert.equal(totalMoney(city),cash);
  assert.deepEqual(mayorTargetAt(city,{x:lot.x,y:lot.y}),{kind:'project',id:project.id});
  assert.equal(mayorTargetAt(city,{x:-10,y:-10}),null);
});

test('selected private land must be advertised; incompatible land cannot be used',()=>{
  const city=start(),site=city.development.publicBuildingSite('clinic'),lot=site.lot;
  lot.ownerId=city.citizens[0].accountId;lot.forSale=false;
  const treasury=city.treasury;
  assert.equal(findPublicBuildingSite(city.development,'clinic',{plotId:lot.id}),null);assert.equal(city.treasury,treasury);
  lot.ownerId='treasury';lot.type='farm';
  assert.equal(findPublicBuildingSite(city.development,'clinic',{plotId:lot.id}),null);
});

test('building context sends an actual funding order to the selected municipal business',()=>{
  const city=start(),b=city.buildings.find(b=>city.fiscal.municipal(b)),ui=state(city),render=page();
  ui.mayorTarget={kind:'building',id:b.id};renderMayorTarget(ui,render.p);
  const fund=render.buttons.find(button=>button.label.startsWith('CUSTEAR'));assert(fund);
  const balance=b.balance,treasury=city.treasury;fund.click();
  assert.equal(b.balance,balance+city.currency.price(10000));assert.equal(city.treasury,treasury-city.currency.price(10000));
  assert.equal(city.mayorCampaign.orders.at(-1).buildingId,b.id);
});

test('project context prioritizes the chosen job and reflects real construction progress',()=>{
  const city=start();city.politics.fundInitialWorksBudget();const project=city.mayorAction('build',{type:'clinic'});assert(project);
  const ui=state(city),render=page();ui.mayorTarget={kind:'project',id:project.id};renderMayorTarget(ui,render.p);
  render.buttons.find(button=>button.label==='URGENTE').click();assert.equal(project.priority,200);
  assert.equal(project.labor||0,0);assert.notEqual(project.status,'completed');
});

test('decision queue follows actual pending laws and disappears after a decision',()=>{
  const city=start(),bill=city.mayorAction('bill',{type:'worksTransfer',value:10000});assert(bill);bill.status='awaiting-sanction';
  assert(mayorDecisions(city).some(task=>task.billId===bill.id));
  const ui=state(city),render=page();ui.mayorView='agenda';renderMayorCampaign(ui,render.p);
  render.buttons.find(button=>button.label==='SANCIONAR').click();
  assert(!mayorDecisions(city).some(task=>task.billId===bill.id));
});

test('focused work sections preserve commands without stacking unrelated directories',()=>{
  const city=start(),ui=state(city);ui.mayorView='build';
  const cases=[['new','CONTRATAR EM LOCAL AUTOMÁTICO'],['queue',null],['access',null],['expand','AMPLIAR PREFEITURA (+1 ANDAR)'],['firm','ABRIR EMPRESA MUNICIPAL'],['offices',null],['programs','PAVIMENTAÇÃO PRIORITÁRIA']];
  for(const [section,label] of cases){
    ui.mayorSection=section;const render=page();renderMayorCampaign(ui,render.p);
    if(label)assert(render.buttons.some(button=>button.label===label),section);
    if(section!=='programs')assert(!render.buttons.some(button=>button.label==='PAVIMENTAÇÃO PRIORITÁRIA'),section);
    if(section!=='firm')assert(!render.buttons.some(button=>button.label==='ABRIR EMPRESA MUNICIPAL'),section);
  }
  for(const section of ['services','shares','programs']){ui.mayorView='operations';ui.mayorSection=section;renderMayorCampaign(ui,page().p);}
  for(const taxView of ['income','sectors','trade']){ui.mayorView='policies';ui.mayorPolicyView='tax';ui.mayorTaxView=taxView;renderMayorCampaign(ui,page().p);}
});

test('desktop reuses the local orders window, keeps inspector access, and toolbar stays compact and clickable',t=>{
  const oldDocument=globalThis.document,oldWindow=globalThis.window;
  t.after(()=>{globalThis.document=oldDocument;globalThis.window=oldWindow;});
  const ctx=new Proxy({measureText:text=>({width:String(text).length*6})},{get:(object,key)=>object[key]||(()=>{})});
  globalThis.window={innerWidth:1024,innerHeight:768,location:{search:''}};
  globalThis.document={createElement:()=>({style:{},value:'',setAttribute(){},addEventListener(){},append(){},remove(){},getContext:()=>ctx})};
  const city=start(),desktop=new CityDesktop({city,root:{append(){}},initialModule:null}),b=city.buildings.find(b=>city.fiscal.municipal(b));
  desktop.setSelection(b.entity);assert.equal(desktop.active.mayorTarget.id,b.id);
  desktop.setSelection(city.townhall().entity);assert.equal(desktop.manager.windows.length,1);
  desktop.inspectMayorEntity(b.entity);assert(desktop.manager.windows.some(w=>w.state.selected===b.entity));
  const ui={ctx,width:1024,height:768,regions:[],pointer:{x:-1,y:-1},text(){},textWidth:text=>String(text).length*6,fitText:text=>text,button(x,y,w,h,label,onClick){this.regions.push({x,y,w,h,label,onClick});}};
  desktop.drawChrome(ui,{});
  assert(desktop.manager.windows.every(w=>w.id==='page:mayor-notice'),'campaign entry clears observer windows');
  const construct=ui.regions.find(region=>region.label==='Construir');assert(construct);
  const top=[...desktop.menuBarRegions].reverse().find(region=>construct.x+2>=region.x&&construct.x+2<=region.x+region.w&&construct.y+2>=region.y&&construct.y+2<=region.y+region.h);
  assert.equal(top.onClick,construct.onClick);construct.onClick();assert.equal(desktop.active.mayorView,'build');assert.equal(desktop.manager.top,34);
  desktop.armMayorPlot({type:'clinic',crop:'milho'});assert(desktop.hidden);
  const lot=city.development.publicBuildingSite('clinic').lot;assert(desktop.mayorMapClick({x:lot.x,y:lot.y}));
  assert.equal(desktop.active.mayorTarget.id,lot.id);assert.equal(desktop.active.mayorBuildingType,'clinic');assert.equal(desktop.mayorMapOrder,null);
  assert(!desktop.hidden);
  assert.match(mayorStatus(desktop),/Aprovação/);
  desktop.armMayorPlot({type:'clinic'});assert.match(mayorStatus(desktop),/Esc cancela/);
  desktop.armMayorPlot({mode:'rally'});assert(desktop.mayorMapClick({x:10,y:11}));
  assert.deepEqual(desktop.active.mayorTarget,{kind:'rally',point:{x:10.5,y:11.5}});
  const bill=city.mayorAction('bill',{type:'worksTransfer',value:10000});assert(bill);bill.status='awaiting-sanction';
  let paused=false;desktop.controls={isPaused:()=>paused,setPaused:value=>{paused=value;}};
  desktop.hidden=true;desktop.syncMayorDecisionWindows();assert(!paused,'council windows do not pause simulation');
  assert.equal(desktop.active.mayorDecisionKey,`bill:${bill.id}`);assert(!desktop.close(desktop.manager.active.id));
  assert(city.mayorAction('sanction',{billId:bill.id}));desktop.syncMayorDecisionWindows();
  desktop.syncMayorNotices();const notice=desktop.manager.find('page:mayor-notice');
  if(notice){const id=notice.state.mayorNoticeId;desktop.close(notice.id);assert(desktop.mayorReadNotices.has(id));}
  const expiring=city.mayorAction('bill',{type:'worksBudget',value:100000});assert(expiring);expiring.status='awaiting-sanction';expiring.sanctionAt=city.minute+1;
  desktop.syncMayorDecisionWindows();const expiringWindow=desktop.manager.active.id;assert(!paused);
  desktop.controls.pauseForCouncilBills=()=>true;desktop.syncMayorDecisionWindows();assert(paused);
  desktop.controls.pauseForCouncilBills=()=>false;desktop.syncMayorDecisionWindows();assert(!paused);
  city.update(.25);desktop.syncMayorDecisionWindows();assert(!desktop.manager.find(expiringWindow));assert(expiring.tacitSanction);assert(!paused);
  city.mayorCampaign.governmentConfirmedKey=null;city.update(0);desktop.syncMayorDecisionWindows(paused);
  assert(paused);const required=desktop.manager.active;assert(required.state.mayorDecisionKey.startsWith('government:'));
  assert(!desktop.close(required.id));desktop.hidden=true;desktop.syncMayorDecisionWindows(paused);assert(!desktop.hidden);
  assert(city.mayorAction('confirmReview',{kind:'government'}));desktop.syncMayorDecisionWindows(paused);assert(!paused);assert(!desktop.manager.find(required.id));
  paused=true;city.mayorCampaign.governmentConfirmedKey=null;city.update(0);desktop.syncMayorDecisionWindows(paused);
  assert(city.mayorAction('confirmReview',{kind:'government'}));desktop.syncMayorDecisionWindows(paused);assert(paused,'an existing manual pause is preserved');
});
