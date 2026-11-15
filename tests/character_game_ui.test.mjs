import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {CharacterGameUI} from '../js/character_game_ui.js';
import {CityDesktop} from '../js/city_desktop.js';
import {ManagementCanvasUI} from '../js/management_ui.js';
import {canControl} from '../js/character_game.js';
import {SimulationTime} from '../js/simulation_time.js';

function harness(width=1360,height=850){
 const text=[];
 const ctx=new Proxy({}, {get:(o,k)=>k in o?o[k]:k==='measureText'?s=>({width:String(s).length*6}):k==='fillText'?(s)=>text.push(s):()=>{}});
 globalThis.window={innerWidth:width,innerHeight:height,devicePixelRatio:1};
 globalThis.document={createElement:tag=>({tagName:tag.toUpperCase(),style:{},value:'',hidden:false,handlers:{},setAttribute(){},addEventListener(k,v){this.handlers[k]=v;},append(){},remove(){this.removed=true;},focus(){},getContext:()=>ctx})};
 const city=setup({starter:true,population:24}),calls=[],time=new SimulationTime();
 const game=new CharacterGameUI({root:{append(){}},getCity:()=>city,command:async(action,options)=>{calls.push([action,options]);return {ok:city.gameAction(action,options),message:city.lastError};},onEnter:()=>{time.setPaused(false);},onSimulation(){},onMenu(){},onCamera(){},onPause:()=>time.setPaused(!time.paused),isPaused:()=>time.paused,getSpeed:()=>time.speed,onSpeed:speed=>time.setSpeed(speed)});
 const ui=new ManagementCanvasUI({style:{},clientWidth:width,clientHeight:height,getContext:()=>ctx});
 const draw=()=>{ui.beginFrame();game.draw(ui);};
 const start=async()=>{await game.act('start',{citizenId:city.citizens.find(c=>canControl(city,c)).id});draw();};
 const click=label=>{const r=ui.regions.find(r=>r.label===label);assert(r,`Missing ${label}`);ui.clickAt(r.x+r.w/2,r.y+r.h/2);};
 return {city,game,ui,text,calls,time,draw,start,click,isPaused:()=>time.paused};
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

test('bottom bar displays real balances, selects exactly three speeds and toggles real autonomy',async()=>{
 const h=harness();await h.start();const c=h.city.society.citizen(h.city.characterGame.citizenId);c.balance=12345;h.text.length=0;h.draw();assert(h.text.some(t=>t.includes('Saldo R$')&&t.includes('123,45')));
 assert.deepEqual(h.ui.regions.filter(r=>/^[\d.]+×$/.test(r.label)).map(r=>r.label),['0.25×','0.5×','1.0×']);
 for(const [label,speed]of [['0.25×',.25],['0.5×',.5],['1.0×',1]]){h.click(label);assert.equal(h.time.speed,speed);h.draw();}
 h.click('Rotina automática');await Promise.resolve();h.draw();assert(h.city.characterGame.autonomous);assert(!c.playerControlled);assert(h.ui.regions.find(r=>r.role==='switch').checked);
 const commands=h.calls.length;h.game.key({code:'KeyD'});h.game.key({code:'KeyD'},false);assert.equal(h.calls.length,commands,'WASD must not send manual commands during autonomy');
 h.click('Rotina automática');await Promise.resolve();h.draw();assert(!h.city.characterGame.autonomous);assert(c.playerControlled);assert(!h.ui.regions.find(r=>r.role==='switch').checked);
 assert.equal(typeof h.game.drawEntry,'undefined');
});
