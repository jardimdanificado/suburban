import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {CharacterGameUI} from '../js/character_game_ui.js';
import {CityDesktop} from '../js/city_desktop.js';
import {ManagementCanvasUI} from '../js/management_ui.js';
import {canControl} from '../js/character_game.js';
import {SimulationTime} from '../js/simulation_time.js';

function harness(width=1360,height=850){
 const text=[],textPositions=[];
 const ctx=new Proxy({}, {get:(o,k)=>k in o?o[k]:k==='measureText'?s=>({width:String(s).length*6}):k==='fillText'?((s,x,y)=>{text.push(s);textPositions.push({text:s,x,y});}):()=>{}});
 globalThis.window={innerWidth:width,innerHeight:height,devicePixelRatio:1};
 globalThis.document={createElement:tag=>({tagName:tag.toUpperCase(),style:{},value:'',hidden:false,handlers:{},setAttribute(){},addEventListener(k,v){this.handlers[k]=v;},append(){},remove(){this.removed=true;},focus(){},getContext:()=>ctx})};
 const city=setup({starter:true,population:24}),calls=[],time=new SimulationTime(),entities=[];let thirdPerson=false,cameraLocked=true,settingsOpened=0;
 const game=new CharacterGameUI({root:{append(){}},getCity:()=>city,command:async(action,options)=>{calls.push([action,options]);return {ok:city.gameAction(action,options),message:city.lastError};},onEnter:()=>{time.setPaused(false);},onSimulation(){},onMenu(){},getCameraLocked:()=>cameraLocked,onCameraLock:()=>{cameraLocked=!cameraLocked;},onSettings:()=>{settingsOpened++;},getEntities:()=>entities,getThirdPerson:()=>thirdPerson,onCamera(){thirdPerson=!thirdPerson;},onPause:()=>time.setPaused(!time.paused),isPaused:()=>time.paused,getSpeed:()=>time.speed,onSpeed:speed=>time.setSpeed(speed)});
 const ui=new ManagementCanvasUI({style:{},clientWidth:width,clientHeight:height,getContext:()=>ctx});
 const draw=()=>{ui.beginFrame();game.draw(ui);};
 const start=async()=>{await game.act('start',{citizenId:city.citizens.find(c=>canControl(city,c)).id});draw();};
 const click=label=>{const r=ui.regions.find(r=>r.label===label);assert(r,`Missing ${label}`);ui.clickAt(r.x+r.w/2,r.y+r.h/2);};
 return {city,game,ui,text,textPositions,calls,time,entities,get settingsOpened(){return settingsOpened;},draw,start,click,isPaused:()=>time.paused};
}

test('gameplay panels share the management desktop, retain independent windows and geometry',async()=>{
 const h=harness();await h.start();assert(h.game.desktop instanceof CityDesktop);assert.equal(h.game.desktop.manager.windows.length,5);h.game.desktop.closeAll(true);
 h.game.toggle('inventory');h.game.toggle('body');h.draw();const manager=h.game.desktop.manager,bag=manager.find('page:survival-inventory');
 assert(h.text.includes('Carregando · 0/8 itens')||h.text.some(t=>t.startsWith('Carregando ·')));assert(h.text.includes('Ferimentos'));assert.equal(manager.windows.length,2);assert(!h.ui.regions.some(r=>r.label==='Abrir aba atual em outra janela'),'Gameplay pages must not expose management navigation');
 manager.raise(bag.id);assert(h.game.desktop.pointerDown(bag.x+50,bag.y+10));h.game.desktop.pointerMove(bag.x+100,bag.y+50);h.game.desktop.pointerUp();const x=bag.x;
 h.draw();h.click('Fechar: Mochila (também com botão direito)');assert(!manager.find(bag.id));h.game.toggle('inventory');assert.equal(manager.find(bag.id).x,x);
 h.draw();const active=manager.active;h.game.key({code:'Escape'});assert(!manager.find(active.id));assert.equal(manager.windows.length,1);
});

test('chooser uses the shared native search and scroll area, restores pause on cancellation',()=>{
 const h=harness(390,844);h.game.choose();h.draw();assert(h.isPaused());
 const state=h.game.desktop.manager.find('page:character').state;assert(!state.search.hidden);
 state.search.value='__nobody__';state.search.handlers.input();h.draw();assert(h.text.includes('Nenhum adulto disponível com esse nome.'));
 state.search.value='';state.search.handlers.input();h.draw();const z=state.zones[0];assert(z.max>0);assert(h.game.desktop.scrollAt(z.x+20,z.y+20,200));assert(state.scrolls.page>0);
 h.game.key({code:'Escape'});assert(!h.game.choosing);assert(!h.isPaused());
});

test('shared canvas buttons execute the existing character commands and local interactions',async()=>{
 const h=harness();await h.start();const c=h.city.society.citizen(h.city.characterGame.citizenId),hall=h.city.buildings.find(b=>b.type==='townhall');
 Object.assign(c.entity,hall.door);c.pocket.water=0;h.game.interact();h.draw();assert(h.game.desktop.manager.find('page:survival-interaction'));
 const water=h.ui.regions.find(r=>r.label?.includes('Encher garrafa'));assert(water);h.ui.clickAt(water.x+10,water.y+8);await Promise.resolve();assert.equal(h.calls.at(-1)[0],'interact');assert.equal(h.calls.at(-1)[1].choice,'water');
 h.game.toggle('inventory');h.draw();const bag=h.game.desktop.manager.find('page:survival-inventory');assert(bag);h.game.key({code:'KeyD'});assert.equal(h.calls.at(-1)[0],'input');assert.equal(h.calls.at(-1)[1].x,1);h.game.key({code:'KeyD'},false);assert.equal(h.calls.at(-1)[1].x,0);
});

test('gameplay widgets and window controls stay within narrow and wide viewports',async()=>{
 for(const width of [390,1360]){
  const h=harness(width,844);await h.start();
  for(const panel of ['inventory','body','family','journal','menu'])h.game.openPanel(panel);
  h.draw();for(const r of h.ui.regions){assert(r.x>=0&&r.x+r.w<=width,`${r.label}: ${r.x}+${r.w}`);assert(r.y>=0&&r.y+r.h<=844,`${r.label}: ${r.y}+${r.h}`);}
 }
});

test('all gameplay information lives in windows that stay closed until reopened',async()=>{
 const h=harness();await h.start();const manager=h.game.desktop.manager;
 for(const id of ['profile','body','activity','targets','interactions'])assert(manager.find(`page:survival-${id}`));
 manager.closeAll(true);h.text.length=0;h.draw();assert.equal(manager.windows.length,0);assert(h.text.some(t=>t.startsWith('Saldo ')));assert(!h.text.includes('Ferimentos'));
 h.game.key({code:'KeyT'});h.game.key({code:'KeyB'});h.draw();assert(manager.find('page:survival-targets'));assert(manager.find('page:survival-interactions'));
 manager.close('page:survival-body');await h.game.act('simulation');await h.game.act('resume');h.draw();assert(!manager.find('page:survival-body'));assert.equal(manager.windows.length,2);
});

test('nearby lists include all reachable people and actions and remove targets as they move away',async()=>{
 const h=harness();await h.start();const c=h.city.society.citizen(h.city.characterGame.citizenId),others=h.city.citizens.filter(p=>p!==c).slice(0,2);
 c.indoorLocation=null;c.entity.x=5.5;c.entity.y=5.5;for(const person of h.city.citizens)if(person!==c){person.entity.x=50;person.entity.y=50;}for(const [i,person]of others.entries()){person.indoorLocation=null;person.entity.properties.name=`Vizinho ${i+1}`;person.entity.x=c.entity.x+.3+i*.3;person.entity.y=c.entity.y;}
 h.game.desktop.closeAll(true);h.game.openPanel('interactions');h.game.desktop.manager.active.h=750;h.draw();
 for(const person of others)assert(h.text.includes(person.entity.properties.name));assert.equal(h.ui.regions.filter(r=>r.label==='Conversar').length,2);
 const talk=h.ui.regions.filter(r=>r.label==='Conversar')[1];h.ui.clickAt(talk.x+10,talk.y+8);await Promise.resolve();assert.equal(h.calls.at(-1)[1].targetId,others[1].id);
 others[1].entity.x+=30;h.text.length=0;h.draw();assert(!h.text.includes(others[1].entity.properties.name));
});

test('distant selected targets have read-only live dossiers without enabling remote actions',async()=>{
 const h=harness();await h.start();const c=h.city.society.citizen(h.city.characterGame.citizenId),other=h.city.citizens.find(p=>p!==c);c.indoorLocation=null;other.indoorLocation=null;
 other.entity.x=c.entity.x+8;other.entity.y=c.entity.y;const target=h.game.visibleTargets().find(t=>t.kind==='person'&&t.id===other.id);assert(target);assert(!h.game.targets().some(t=>t.kind==='person'&&t.id===other.id));
 h.game.selectTarget(target);assert.equal(h.game.target(),undefined);const count=h.calls.length;h.game.interact();assert.equal(h.calls.length,count);
 h.game.desktop.closeAll(true);h.game.dossier(target);h.draw();assert(h.text.includes(other.entity.properties.name));assert(h.text.includes('Idade'));assert.equal(h.calls.length,count);
 assert(!h.ui.regions.some(r=>['Assumir controle','Conversar','Alterar saldo'].includes(r.label)));
 const manager=h.game.desktop.manager;h.game.dossier(target);assert.equal(manager.windows.length,1);other.balance=12345;h.text.length=0;h.draw();assert(h.text.some(t=>t.includes('123,45')));
 other.entity.destroyed=true;h.text.length=0;h.draw();assert(h.text.includes('Esta pessoa morreu.'));
});

test('building and plant dossiers show real world records without management commands',async()=>{
 const h=harness();await h.start();const c=h.city.society.citizen(h.city.characterGame.citizenId),building=h.city.buildings[0],plant=[...h.city.nature.plants.values()][0];assert(plant);
 h.game.desktop.closeAll(true);h.game.dossier({kind:'building',id:building.id,label:building.entity.properties.name});h.draw();assert(h.text.includes(h.city.buildingTypes[building.type].label));assert(h.text.includes('Trabalhadores'));
 h.game.desktop.closeAll(true);c.entity.x=plant.x+.5;c.entity.y=plant.y+.5;c.indoorLocation=null;assert(h.game.visibleTargets().some(t=>t.kind==='plant'&&t.id===plant.id));
 h.game.dossier({kind:'plant',id:plant.id,label:plant.entity.properties.name});h.text.length=0;h.draw();assert(h.text.includes('Espécie'));assert(h.text.includes('Produção disponível'));
});

test('nearby target filters and vehicle dossiers use the same live window system',async()=>{
 const h=harness();await h.start();const c=h.city.society.citizen(h.city.characterGame.citizenId),vehicle=h.city.vehicles.createBoatVehicle('canoe');assert(vehicle);
 c.indoorLocation=null;Object.assign(c.entity,{x:vehicle.entity.x,y:vehicle.entity.y});h.game.desktop.closeAll(true);h.game.openPanel('targets');h.draw();
 const target=h.game.visibleTargets().find(t=>t.kind==='vehicle'&&t.id===vehicle.id);assert(target);const state=h.game.desktop.manager.active.state;assert(!state.search.hidden);
 state.search.value='__nobody__';state.search.handlers.input();h.text.length=0;h.draw();assert(h.text.includes('Nenhum alvo corresponde ao filtro.'));
 h.game.desktop.closeAll(true);h.game.dossier(target);h.draw();assert(h.text.includes('Embarcação'));assert(h.text.includes('Conservação'));assert.equal(h.calls.length,1);
});

test('gameplay clears window tooltips when the pointer returns to the world',async()=>{
 const h=harness();await h.start();const w=h.game.desktop.manager.active;
 h.ui.beginFrame(w.x+w.w-10,w.y+10);h.game.draw(h.ui);assert.equal(h.game.desktop.tooltipElement.hidden,false);
 h.draw();assert.equal(h.game.desktop.tooltipElement.hidden,true);
});

test('bottom bar displays real balances, selects speeds through 16× and toggles real autonomy',async()=>{
 const h=harness();await h.start();const c=h.city.society.citizen(h.city.characterGame.citizenId);c.balance=12345;h.text.length=0;h.draw();assert(h.text.some(t=>t.includes('Saldo R$')&&t.includes('123,45')));assert(h.textPositions.filter(t=>t.text.startsWith('Saldo R$')).every(t=>t.x>h.ui.width/2));
 assert.deepEqual(h.ui.regions.filter(r=>/^[\d.]+×$/.test(r.label)).map(r=>r.label),['0.25×','0.5×','1.0×','2×','4×','8×','16×']);
 for(const [label,speed]of [['0.25×',.25],['0.5×',.5],['1.0×',1],['2×',2],['4×',4],['8×',8],['16×',16]]){h.click(label);assert.equal(h.time.speed,speed);h.draw();}
 h.click('Rotina automática');await Promise.resolve();h.draw();assert(h.city.characterGame.autonomous);assert(!c.playerControlled);assert(h.ui.regions.find(r=>r.role==='switch').checked);
 const commands=h.calls.length;h.game.key({code:'KeyD'});h.game.key({code:'KeyD'},false);assert.equal(h.calls.length,commands,'WASD must not send manual commands during autonomy');
 h.click('Rotina automática');await Promise.resolve();h.draw();assert(!h.city.characterGame.autonomous);assert(c.playerControlled);assert(!h.ui.regions.find(r=>r.role==='switch').checked);
 assert.equal(typeof h.game.drawEntry,'undefined');
});


test('gameplay exposes third person and mouse selection of people, buildings and ground objects',async()=>{
 const h=harness();await h.start();h.game.desktop.closeAll(true);
 h.click('Z · Câmera: isométrica');h.draw();assert(h.game.getThirdPerson());h.game.key({code:'KeyZ'});assert(!h.game.getThirdPerson());
 const c=h.city.society.citizen(h.city.characterGame.citizenId),other=h.city.citizens.find(p=>p!==c);c.indoorLocation=null;other.indoorLocation=null;
 other.entity.x=c.entity.x+20;other.entity.y=c.entity.y;
 assert(h.game.inspect(other.entity.id));assert.equal(h.game.targetKey,`person:${other.id}`);assert.equal(h.game.selectedEntityId,other.entity.id);assert(h.game.desktop.manager.find(`page:inspect-person-${other.id}`));
 const b=h.city.buildings[0];assert(h.game.inspect(b.entity.id));assert.equal(h.game.targetKey,`building:${b.id}`);
 const item={id:999999,x:c.entity.x+.5,y:c.entity.y,properties:{name:'Madeira caída',species:'item',resourceType:'wood',render:{},item:{quantity:2}}};h.entities.push(item);
 assert(h.game.inspect(item.id));h.draw();assert(h.text.includes('Madeira caída'));assert(h.text.includes('Objeto no chão'));assert(h.text.includes('Quantidade'));
 assert(h.game.visibleTargets().some(t=>t.entityId===item.id));item.destroyed=true;assert(!h.game.inspect(item.id,false));
 const count=h.calls.length;assert(!h.game.inspect(-1,false));assert.equal(h.calls.length,count);
});


test('gameplay can detach either projection and open settings from its controls and keyboard',async()=>{
 const h=harness();await h.start();h.game.desktop.closeAll(true);h.draw();
 h.click('L · Câmera travada');assert(!h.game.getCameraLocked());h.draw();h.click('Z · Câmera: isométrica');assert(h.game.getThirdPerson());assert(!h.game.getCameraLocked());
 h.game.key({code:'KeyL'});assert(h.game.getCameraLocked());assert(h.game.getThirdPerson());h.draw();h.click('O · Configurações');assert.equal(h.settingsOpened,1);h.game.key({code:'KeyO'});assert.equal(h.settingsOpened,2);
});

test('right-click person menu approaches distant targets and opens dossiers only on examine',async()=>{
 const h=harness();await h.start();h.game.desktop.closeAll(true);const c=h.city.society.citizen(h.city.characterGame.citizenId),other=h.city.citizens.find(p=>p!==c);c.indoorLocation=null;other.indoorLocation=null;other.entity.x=c.entity.x+.5;other.entity.y=c.entity.y;
 h.game.openWorldMenu(other.entity.id,{x:5,y:5},500,300);h.draw();assert.equal(h.game.desktop.manager.windows.length,0);assert(h.ui.regions.some(r=>r.role==='menuitem'&&r.label==='Conversar'));
 h.click('Conversar');await Promise.resolve();assert.equal(h.calls.at(-1)[0],'approach-interact');assert.equal(h.calls.at(-1)[1].targetId,other.id);assert.equal(h.city.characterGame.intent.kind,'talk');assert.equal(h.game.worldMenu,null);
 c.entity.x=5.5;c.entity.y=5.5;other.entity.x=15.5;other.entity.y=5.5;h.game.openWorldMenu(other.entity.id,null,500,300);h.draw();const talk=h.ui.regions.find(r=>r.role==='menuitem'&&r.label==='Conversar');assert(!talk.disabled);h.ui.clickAt(talk.x+5,talk.y+5);await Promise.resolve();assert.equal(h.city.characterGame.intent.kind,'approach');
 h.game.openWorldMenu(other.entity.id,null,500,300);h.draw();
 h.click('Examinar');assert(h.game.desktop.manager.find(`page:inspect-person-${other.id}`));assert.equal(h.game.worldMenu,null);
});

test('right-click ground menu sends one movement order and outside dismissal never clicks through',async()=>{
 const h=harness();await h.start();h.game.desktop.closeAll(true);const c=h.city.society.citizen(h.city.characterGame.citizenId);c.indoorLocation=null;
 h.game.openWorldMenu(-1,{x:5,y:6},500,300);h.draw();const before=h.calls.length;assert(h.game.pointerDown(900,400,0,h.ui));h.game.pointerUp(900,400,0,h.ui);assert.equal(h.calls.length,before);assert.equal(h.game.worldMenu,null);
 h.game.openWorldMenu(-1,{x:5,y:6},500,300);h.draw();h.click('Andar até aqui');await Promise.resolve();assert.equal(h.calls.length,before+1);assert.deepEqual(h.calls.at(-1),['walk',{x:5.5,y:6.5}]);assert.equal(h.game.worldMenu,null);
});

test('context menus fit the viewport, support keyboard and cancel when targets disappear',async()=>{
 const h=harness(390,844);await h.start();h.game.desktop.closeAll(true);const c=h.city.society.citizen(h.city.characterGame.citizenId);c.indoorLocation=null;
 h.game.openWorldMenu(c.entity.id,null,389,843);h.draw();const b=h.game.worldMenu.bounds;assert(b.x>=0&&b.x+b.w<=390);assert(b.y>=h.game.desktop.manager.top&&b.y+b.h<=844-h.game.desktop.manager.bottom);
 h.game.key({code:'ArrowDown'});h.game.key({code:'Enter'});assert(h.game.desktop.manager.find('page:survival-inventory'));assert.equal(h.game.worldMenu,null);
 h.game.openWorldMenu(-1,{x:1,y:1},20,80);h.game.key({code:'Escape'});assert.equal(h.game.worldMenu,null);
 const other=h.city.citizens.find(p=>p!==c);other.indoorLocation=null;other.entity.x=c.entity.x+.5;other.entity.y=c.entity.y;h.game.openWorldMenu(other.entity.id,null,20,80);other.entity.destroyed=true;h.draw();assert.equal(h.game.worldMenu,null);
});

test('building context menu executes the shared supply action and objects expose read-only examination',async()=>{
 const h=harness();await h.start();h.game.desktop.closeAll(true);const c=h.city.society.citizen(h.city.characterGame.citizenId),hall=h.city.buildings.find(b=>b.type==='townhall');c.indoorLocation=null;Object.assign(c.entity,hall.door);
 h.game.openWorldMenu(hall.entity.id,null,500,300);h.draw();h.click('Encher garrafa');await Promise.resolve();assert.deepEqual(h.calls.at(-1),['approach-interact',{kind:'building',targetId:hall.id,choice:'water'}]);
 const item={id:999999,x:c.entity.x+.5,y:c.entity.y,properties:{name:'Madeira caída',resourceType:'wood',species:'item',render:{}}};h.entities.push(item);h.game.openWorldMenu(item.id,null,500,300);h.draw();assert(h.ui.regions.some(r=>r.role==='menuitem'&&r.label==='Examinar'));assert(!h.ui.regions.some(r=>r.role==='menuitem'&&r.label==='Encher garrafa'));h.click('Examinar');assert(h.game.desktop.manager.find(`page:inspect-object-${item.id}`));
});


test('space pauses gameplay without attacking, including when a target is nearby',async()=>{
 const h=harness();await h.start();const before=h.calls.length;assert(!h.isPaused());h.game.key({code:'Space'});assert(h.isPaused());assert.equal(h.calls.length,before);h.game.key({code:'Space',repeat:true});assert(h.isPaused());h.game.key({code:'Space'});assert(!h.isPaused());
});

test('character marker uses the favorite editor and saves symbol, color and background controls',async()=>{
 for(const width of [390,1360]){
  const h=harness(width,844);await h.start();h.game.desktop.closeAll(true);h.game.openPanel('profile');h.draw();h.click('Personalizar símbolo');h.draw();
  const editor=h.game.desktop.manager.find('page:survival-marker').state;
  assert.equal(typeof editor.markerEditor,'function');
  const toggle=h.ui.regions.find(r=>r.label?.includes('Mostrar fundo do símbolo'));assert(toggle);
  h.ui.clickAt(toggle.x+10,toggle.y+8);await Promise.resolve();
  assert.equal(h.city.characterGame.marker.background,false);h.draw();
  h.click('Símbolo 17');await Promise.resolve();assert.equal(h.city.characterGame.marker.icon,17);
  h.draw();const color=editor.favoriteColorInputs.player;color.value='#334455';color.oninput();await Promise.resolve();
  assert.equal(h.city.characterGame.marker.color,'#334455');
  h.draw();for(const region of h.ui.regions.filter(r=>r.label?.startsWith('Símbolo ')))assert(region.x>=0&&region.x+region.w<=width);
 }
});

test('life and management exposes every workflow with native fields and hides inputs between pages',async()=>{
 const h=harness();await h.start();h.game.desktop.closeAll(true);h.game.key({code:'KeyG'},true);h.draw();
 const state=h.game.desktop.manager.find('page:survival-actions').state;assert(state);
 const before=h.calls.length;
 for(const tab of ['trade','items','property','business','bank','vehicles','social','work','explore','politics']){
  state.playerForm.tab=tab;state.resetScroll();h.draw();assert.equal(h.calls.length,before,'Drawing a workflow must not send commands');
 }
 state.playerForm.tab='trade';state.resetScroll();h.draw();const visible=state.inputs.filter(i=>!i.hidden);assert(visible.some(i=>i.type==='number'));assert(visible.some(i=>i.tagName==='SELECT'||i.tagName==='select'||i.getAttribute?.('aria-label')?.startsWith('player:'))||Object.keys(state.dynamicSelects).length>0);
 const moneyInput=state.dynamicSelects['player:tradeQuantity'];assert(moneyInput);state.playerForm.tab='social';h.draw();assert(moneyInput.hidden);
 h.game.desktop.close('page:survival-actions');assert(!state.visible);assert(!h.game.desktop.manager.find('page:survival-actions'));
});

test('life and management stays within mobile and desktop viewports',async()=>{
 for(const [width,height]of [[390,844],[1440,900]]){
  const h=harness(width,height);await h.start();h.game.desktop.closeAll(true);h.game.openPanel('actions');h.draw();const state=h.game.desktop.manager.active.state;
  for(const tab of ['trade','items','property','business','bank','vehicles','social','work','explore','politics']){
   state.playerForm.tab=tab;state.resetScroll();h.draw();
   for(const region of h.ui.regions)if(region.w>0&&region.h>0){assert(region.x>=0&&region.y>=0,`${tab}: negative widget`);assert(region.x+region.w<=width+1,`${tab}: widget exceeds width`);assert(region.y+region.h<=height+1,`${tab}: widget exceeds height`);}
  }
 }
});

test('structure context identifies the clicked building, falls back to its footprint and walks to its entrance',async()=>{
 const h=harness();await h.start();h.game.desktop.closeAll(true);const c=h.city.society.citizen(h.city.characterGame.citizenId),b=h.city.buildings.find(b=>b.type==='townhall');c.indoorLocation=null;b.entity.properties.name='Mercado da esquina';
 h.game.openWorldMenu(-1,{x:b.entity.x,y:b.entity.y},500,300);h.text.length=0;h.draw();assert.equal(h.game.worldMenuItems().label,'Mercado da esquina');assert(h.text.includes('Mercado da esquina'));assert.equal(h.game.worldMenuItems().items[0].label,'Andar até aqui');
 h.click('Andar até aqui');await Promise.resolve();assert.deepEqual(h.calls.at(-1),['walk',b.door]);assert.equal(h.game.desktop.manager.windows.length,0);
});

test('context purchase uses the clicked stock, editable quantity and physical arrival without opening management',async()=>{
 const h=harness();await h.start();h.game.desktop.closeAll(true);const c=h.city.society.citizen(h.city.characterGame.citizenId),b=h.city.buildings.find(b=>b.type==='townhall');c.indoorLocation=null;c.entity.x=b.door.x+6;c.entity.y=b.door.y;b.inventory.madeira=4;c.inventory.madeira=0;c.balance=20000;
 h.game.openWorldMenu(b.entity.id,null,200,160);h.draw();const input=h.game.contextInputs.quantity;assert(input&&!input.hidden);input.value='2';input.handlers.input();h.draw();const row=h.game.worldMenuItems().items.find(i=>i.label.startsWith('Comprar 2 madeira'));assert(row);const cash=c.balance;h.game.runWorldMenuItem(row);await Promise.resolve();assert.equal(h.game.desktop.manager.windows.length,0);assert.equal(c.balance,cash);assert.equal(b.inventory.madeira,4);assert.equal(h.city.characterGame.intent.kind,'approach');assert(h.game.contextInputs.quantity.hidden);
 c.path=[];Object.assign(c.entity,b.door);const {characterMinute}=await import('../js/character_game.js');characterMinute(h.city,c);assert.equal(c.inventory.madeira,2);assert.equal(b.inventory.madeira,2);assert(c.balance<cash);
});

test('bank context accepts an exact amount, deposits in the clicked bank and closes native fields',async()=>{
 const h=harness(390,844);await h.start();h.game.desktop.closeAll(true);const c=h.city.society.citizen(h.city.characterGame.citizenId),b=h.city.bank.available()[0];c.indoorLocation=null;Object.assign(c.entity,b.door);c.balance=20000;
 h.game.openWorldMenu(b.entity.id,null,389,843);h.draw();const input=h.game.contextInputs.amount;assert(input&&!input.hidden);input.value='12.34';input.handlers.input();h.draw();const row=h.game.worldMenuItems().items.find(i=>i.label.startsWith('Depositar'));assert(row.label.includes('12,34'));const before=c.balance;h.game.runWorldMenuItem(row);await Promise.resolve();assert.equal(c.balance,before-1234);assert.equal(h.city.bank.deposits.get(`deposit:${b.id}:${c.accountId}`).balance,1234);assert(input.hidden);assert.equal(h.game.desktop.manager.windows.length,0);
});

test('context native fields stay bounded, reject invalid quantities and hide on escape and target removal',async()=>{
 const h=harness(390,844);await h.start();h.game.desktop.closeAll(true);const c=h.city.society.citizen(h.city.characterGame.citizenId),b=h.city.buildings.find(b=>b.type==='townhall');c.indoorLocation=null;b.inventory.madeira=3;
 h.game.openWorldMenu(b.entity.id,null,389,843);h.draw();const input=h.game.contextInputs.quantity;assert(!input.hidden);const x=parseFloat(input.style.left),y=parseFloat(input.style.top),w=parseFloat(input.style.width);assert(x>=0&&x+w<=390&&y>=h.game.desktop.manager.top&&y+20<=844-h.game.desktop.manager.bottom);
 input.value='-2';input.handlers.input();h.draw();const row=h.game.worldMenuItems().items.find(i=>i.label.startsWith('Comprar')&&i.label.includes('madeira'));assert(row.disabled);const before=h.calls.length;h.game.runWorldMenuItem(row);assert.equal(h.calls.length,before);
 input.handlers.keydown({code:'Escape'});assert.equal(h.game.worldMenu,null);assert(input.hidden);
 h.game.openWorldMenu(b.entity.id,null,50,90);h.draw();b.entity.destroyed=true;h.draw();assert.equal(h.game.worldMenu,null);assert(input.hidden);
});

test('clicked interior room exposes its own floor and walking command without a room selector',async()=>{
 const h=harness();await h.start();h.game.desktop.closeAll(true);const c=h.city.society.citizen(h.city.characterGame.citizenId),b=h.city.buildings.find(b=>b.floors>1),u=b.units.find(u=>u.z>0&&u.roomType!=='cell');assert(u);c.indoorLocation={buildingId:b.id,position:{x:b.entity.x+.5,y:b.entity.y+.5,z:0},floor:0,path:[]};
 h.game.openWorldMenu(b.entity.id,null,250,100,{unitId:u.id});h.draw();assert.equal(h.game.worldMenuItems().label,b.entity.properties.name);const row=h.game.worldMenuItems().items.find(i=>i.label===`Andar até aqui · andar ${u.z+1}`);assert(row);h.game.runWorldMenuItem(row);await Promise.resolve();assert.deepEqual(h.calls.at(-1),['explore-room',{unitId:u.id}]);assert.equal(h.game.desktop.manager.windows.length,0);
});

test('vehicle context chooses a destination with the next ground click instead of coordinate forms',async()=>{
 const h=harness();await h.start();h.game.desktop.closeAll(true);const c=h.city.society.citizen(h.city.characterGame.citizenId),v=h.city.vehicles.createBoatVehicle('canoe');v.ownerAccountId=c.accountId;c.indoorLocation=null;
 h.game.openWorldMenu(v.entity.id,null,20,90);const row=h.game.worldMenuItems().items.find(i=>i.label.startsWith('Viajar com este veículo'));assert(row);h.game.runWorldMenuItem(row);assert.equal(h.game.destinationVehicleId,v.id);assert.equal(h.game.desktop.manager.windows.length,0);
 await h.game.act('walk',{x:5.5,y:6.5});assert.deepEqual(h.calls.at(-1),['ride-vehicle',{x:5.5,y:6.5,vehicleId:v.id}]);assert.equal(h.game.destinationVehicleId,null);
 h.game.openWorldMenu(v.entity.id,null,20,90);h.game.runWorldMenuItem(h.game.worldMenuItems().items.find(i=>i.label.startsWith('Viajar com este veículo')));h.game.key({code:'Escape'});assert.equal(h.game.destinationVehicleId,null);
});

test('context relationship actions confirm in place and never open a social management panel',async()=>{
 const h=harness();await h.start();h.game.desktop.closeAll(true);const c=h.city.society.citizen(h.city.characterGame.citizenId),person=h.city.citizens.find(p=>p!==c&&h.city.society.isAdult(p)&&!h.city.society.related(c,p));c.indoorLocation=person.indoorLocation=null;Object.assign(person.entity,{x:c.entity.x,y:c.entity.y});c.partnerId=person.id;person.partnerId=c.id;
 h.game.openWorldMenu(person.entity.id,null,20,90);const row=h.game.worldMenuItems().items.find(i=>i.label==='Terminar relacionamento');assert(row);const before=h.calls.length;h.game.runWorldMenuItem(row);assert.equal(h.calls.length,before);assert.equal(h.game.desktop.manager.windows.length,0);const confirm=h.game.worldMenuItems().items.find(i=>i.label.startsWith('Confirmar:'));assert(confirm);h.game.runWorldMenuItem(confirm);await Promise.resolve();assert.equal(h.calls.at(-1)[1].choice,'separate');assert.equal(h.game.worldMenu,null);
});
