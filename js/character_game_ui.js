import {playing,controlledCitizen,canControl,relatives} from './character_game.js';
import {nearbyTargets,interactionOptions} from './character_interactions.js';
import {formatMoney} from './city_ui_format.js';
import {inventoryUsed} from './city_inventory.js';
import {CityDesktop} from './city_desktop.js';
import {MANAGEMENT_THEME as T,bevel} from './management_ui.js';
import {drawTargetDossier,targetKindLabel} from './character_game_inspectors.js';

const name=c=>c?.entity?.properties?.name||'Sem nome';
const meters=[['health','Saúde'],['food','Alimentação'],['water','Água'],['energy','Energia'],['hygiene','Higiene'],['toilet','Banheiro']];
const titles={profile:'Personagem',activity:'Atividade e ações',targets:'Alvos próximos',interactions:'Interações próximas',inventory:'Mochila',body:'Condição física',family:'Família',journal:'Diário',menu:'Pausa e opções',death:'Fim desta vida',interaction:'Interagir'};
const movingCodes=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];

/** Gameplay uses the same canvas widgets, native fields and desktop windows as management. */
export class CharacterGameUI {
  constructor({root,getCity,command,onEnter,onSimulation,onMenu,onCamera,onPause,isPaused,getDirection,getSpeed=()=>1,onSpeed=()=>{}}){
    Object.assign(this,{getCity,command,onEnter,onSimulation,onMenu,onCamera,onPause,isPaused,getDirection,getSpeed,onSpeed});
    this.keys=new Set();this.choosing=false;this.message='';this.targetKey=null;this.contextOpen=false;this.layoutReady=false;this.savedPanels=null;
    this.desktop=new CityDesktop({city:getCity(),root,select:()=>{},initialModule:null,notifications:false});
    this.element=this.desktop.element;
  }
  get active(){return this.choosing||playing(this.getCity());}
  track(point){this.marker=point;}
  async act(action,options={}){
    const result=await this.command(action,options);
    if(result?.ok===false){this.message=result.message||'Ação indisponível.';this.messageUntil=performance.now()+5000;}
    if(result?.ok!==false&&['start','resume','switch'].includes(action)){
      if(action!=='switch'||!this.layoutReady){this.entering=true;this.desktop.closeAll(true);this.entering=false;this.layoutReady=false;}
      this.choosing=false;this.contextOpen=false;this.keys.clear();this.onEnter();
    }
    if(result?.ok!==false&&action==='simulation'){this.savedPanels=this.desktop.manager.windows.filter(w=>w.id.startsWith('page:survival-')&&w.id!=='page:survival-interaction').map(w=>w.id.slice('page:survival-'.length));this.desktop.closeAll(true);this.layoutReady=false;this.keys.clear();this.contextOpen=false;this.onSimulation();}
    return result;
  }
  choose(){
    if(this.choosing){this.desktop.manager.raise('page:character');return;}
    this.chooserPaused=!this.isPaused();if(this.chooserPaused)this.onPause();
    this.choosing=true;this.onMenu(false);this.desktop.city=this.getCity();
    const state=this.desktop.openPage('character',{title:'Quem vai sobreviver?',width:560,height:600,search:'Buscar pessoa…',draw:(p,state)=>this.roster(p,state),onClose:()=>{
      this.choosing=false;if(!this.entering&&this.chooserPaused&&this.isPaused())this.onPause();this.chooserPaused=false;
    }});
    state.search.setAttribute('aria-label','Buscar personagem');
  }
  toggle(panel){
    const id=`page:survival-${panel}`;
    if(this.desktop.manager.find(id)){this.desktop.close(id);return;}
    this.contextOpen=false;this.openPanel(panel);
  }
  openPanel(panel){
    const searchable=['targets','interactions'].includes(panel);
    const state=this.desktop.openPage(`survival-${panel}`,{title:titles[panel],width:panel==='inventory'?430:['profile','activity','body'].includes(panel)?280:340,height:({profile:225,activity:230,body:310,targets:260,interactions:310})[panel]||400,search:searchable?'Filtrar por nome ou tipo…':false,draw:(p,state)=>this.content(panel,p,state),onClose:()=>{if(panel==='interaction')this.contextOpen=false;}});
    if(searchable)state.search.setAttribute('aria-label',`${titles[panel]}: filtrar`);return state;
  }
  input(){
    const x=Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'));
    const y=Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'));
    this.command('input',{...(this.getDirection?.(x,y)||{x,y}),run:this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')});
  }
  targets(){return nearbyTargets(this.getCity());}
  visibleTargets(){return nearbyTargets(this.getCity(),controlledCitizen(this.getCity()),12,{inspectable:true});}
  selectTarget(target){this.targetKey=`${target.kind}:${target.id}`;}
  dossier(target){return this.desktop.openPage(`inspect-${target.kind}-${target.id}`,{title:`Ficha · ${target.label}`,width:380,height:440,draw:p=>drawTargetDossier(p,this.getCity(),target)});}
  target(){const targets=this.targets();return this.targetKey?targets.find(t=>`${t.kind}:${t.id}`===this.targetKey):targets.find(t=>t.kind!=='person')||targets[0];}
  inspect(entityId){
    const target=this.visibleTargets().find(t=>t.entityId===entityId);
    if(target){this.selectTarget(target);this.dossier(target);return true;}
    this.message='Aproxime-se para interagir. Use WASD para explorar.';this.messageUntil=performance.now()+3000;return false;
  }
  interact(){
    const target=this.target();if(!target){this.message='Nada ao alcance. Aproxime-se de uma porta, planta ou pessoa.';this.messageUntil=performance.now()+3000;return;}
    const choices=interactionOptions(this.getCity(),target);
    if(choices.length===1)this.use(target,choices[0]);else{this.contextOpen=!this.contextOpen;}
  }
  use(target,choice){
    if(choice.action==='family'){this.toggle('family');return;}
    this.contextOpen=false;this.act('interact',{kind:target.kind,targetId:target.id,choice:choice.id});
  }
  attack(entityId=null){
    const targets=this.targets().filter(t=>t.kind==='person'&&t.distance<=1.6),target=targets.find(t=>t.entityId===entityId)||(!entityId&&targets[0]);
    if(target)this.act('attack',{citizenId:target.id});else{this.message='Ninguém ao alcance do golpe.';this.messageUntil=performance.now()+2500;}
  }
  key(event,down=true){
    if(!this.active||/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName))return false;
    if(down&&['Tab','PageDown','PageUp','Home','End','Slash'].includes(event.code))return this.desktop.key(event);
    if(this.choosing){if(down&&event.code==='Escape'){this.desktop.close('page:character');return true;}return false;}
    if((event.ctrlKey||event.metaKey)&&['KeyR','KeyL'].includes(event.code))return false;
    if(['ControlLeft','ControlRight'].includes(event.code)){this.combat=down;return true;}
    if(movingCodes.includes(event.code)||['ShiftLeft','ShiftRight'].includes(event.code)){
      if(this.getCity().characterGame.autonomous){this.keys.clear();if(down&&movingCodes.includes(event.code)){this.message='Desligue a rotina automática na barra inferior para usar WASD.';this.messageUntil=performance.now()+3000;}return true;}
      if(down&&!this.keys.has(event.code)){this.keys.add(event.code);this.contextOpen=false;this.input();}else if(!down&&this.keys.delete(event.code))this.input();return true;
    }
    if(!down||event.repeat||event.metaKey||event.altKey)return false;
    const actions={KeyC:()=>this.toggle('profile'),KeyV:()=>this.toggle('activity'),KeyT:()=>this.toggle('targets'),KeyB:()=>this.toggle('interactions'),KeyE:()=>this.interact(),KeyI:()=>this.toggle('inventory'),KeyH:()=>this.toggle('body'),KeyU:()=>this.toggle('family'),KeyJ:()=>this.toggle('journal'),KeyP:()=>{this.onPause();},KeyX:()=>{this.keys.clear();this.act('stop');},KeyR:()=>this.act('rest'),KeyF:()=>this.attack(),Space:()=>this.attack(),Digit1:()=>this.act('eat'),Digit2:()=>this.act('drink'),Escape:()=>{if(this.contextOpen){this.contextOpen=false;}else if(this.desktop.manager.windows.length)this.desktop.close(this.desktop.manager.activeId);else this.toggle('menu');},KeyQ:()=>{
      const targets=this.targets(),index=targets.findIndex(t=>`${t.kind}:${t.id}`===this.targetKey),target=targets[(index+1)%targets.length];if(target)this.targetKey=`${target.kind}:${target.id}`;
    }};
    if(this.contextOpen&&/^Digit[1-9]$/.test(event.code)){
      const target=this.target(),choice=interactionOptions(this.getCity(),target)[Number(event.code.slice(-1))-1];if(choice)this.use(target,choice);return true;
    }
    if(actions[event.code]){actions[event.code]();return true;}return false;
  }
  blur(){this.combat=false;if(this.keys.size){this.keys.clear();this.input();}}
  pointerDown(x,y,button,ui){
    if(button===2&&this.desktop.rightClick(x,y))return true;
    return this.desktop.pointerDown(x,y)||!!this.desktop.manager.at(x,y)||!!ui.hitTest(x,y)||this.choosing;
  }
  pointerUp(x,y,button,ui){
    const gesture=this.desktop.pointerUp();if(!gesture&&button===0)ui.clickAt(x,y);return true;
  }
  draw(ui,now=performance.now()){
    const city=this.getCity(),s=city.characterGame,c=controlledCitizen(city),isPlaying=playing(city);
    this.desktop.city=city;this.element.hidden=!this.active;
    if(!this.active){this.desktop.tooltipElement.hidden=true;return;}
    const manager=this.desktop.manager;manager.bottom=4;
    if(isPlaying&&!this.choosing)this.bottomBar(ui,city,c);
    if(isPlaying&&!this.choosing)this.launcher(ui);else manager.top=12;
    manager.viewport(ui.width,ui.height);
    if(this.marker?.visible&&isPlaying){const {x,y}=this.marker;ui.text('Você',x-12,y-16,T.light);}
    if(isPlaying){
      const dead=!c||c.entity.destroyed||s.status==='dead';
      if(dead&&this.deathCitizenId!==s.citizenId){this.deathCitizenId=s.citizenId;this.openPanel('death');}
      if(!this.layoutReady&&!this.choosing)this.setupLayout(ui);
      this.updateNotice(s,now);
      const target=!dead&&this.target();
      if(this.contextOpen&&target&&!manager.find('page:survival-interaction'))this.openPanel('interaction');
      else if((!this.contextOpen||!target)&&manager.find('page:survival-interaction'))this.desktop.close('page:survival-interaction');
    }
    if(this.choosing){
      ui.ctx.fillStyle='rgba(0,0,0,.4)';ui.ctx.fillRect(0,0,ui.width,ui.height);
      ui.regions.push({x:0,y:0,w:ui.width,h:ui.height,onClick:null});
    }
    manager.viewport(ui.width,ui.height);this.desktop.tooltip=null;this.desktop.draw(ui);
  }
  bottomBar(ui,city,c){
    const s=city.characterGame,compact=ui.width<580,height=compact?96:68,top=ui.height-height;
    this.desktop.manager.bottom=height+4;
    bevel(ui.ctx,0,top,ui.width,height);ui.regions.push({x:0,y:top,w:ui.width,h:height,onClick:null});
    const stamp=`Dia ${city.day} · ${String(city.hour).padStart(2,'0')}:${String(city.minute%60).padStart(2,'0')}`;
    const summary=`Saldo ${formatMoney(c?.balance||0)} · ${stamp} · Saúde ${Math.round(c?.needs?.health||0)} · Água ${Math.round(c?.needs?.water||0)} · Energia ${Math.round(c?.needs?.energy||0)} · ${s.manualPending?'Aguardando controle manual':s.autonomous?'Rotina automática':'Controle total'}`;
    bevel(ui.ctx,4,top+4,ui.width-8,23,{inset:true,fill:T.paper});ui.text(ui.fitText(summary,ui.width-22),11,top+9,T.ink);
    for(const [i,speed]of [0.25,0.5,1].entries())ui.button(4+i*61,top+33,58,25,`${speed===1?'1.0':speed}×`,()=>this.onSpeed(speed),{selected:this.getSpeed()===speed});
    ui.button(190,top+33,74,25,this.isPaused()?'Continuar':'Pausar',()=>this.onPause(),{selected:this.isPaused()});
    ui.switch(compact?4:272,top+(compact?63:33),Math.min(300,ui.width-(compact?8:280)),25,'Rotina automática',s.autonomous===true,enabled=>{
      this.keys.clear();this.act('autonomy',{enabled:s.manualPending?true:enabled});
    });
  }
  launcher(ui){
    const tools=[['profile','C · Personagem'],['body','H · Corpo'],['activity','V · Atividade'],['targets','T · Alvos'],['interactions','B · Interações'],['inventory','I · Mochila'],['family','U · Família'],['journal','J · Diário'],['menu','Esc · Opções']];
    let x=4,y=3;const buttons=[];
    for(const [panel,label]of tools){const w=Math.min(ui.width-8,Math.ceil(ui.textWidth(label))+18);if(x+w>ui.width-4){x=4;y+=26;}buttons.push({x,y,w,panel,label});x+=w+3;}
    const h=y+27;bevel(ui.ctx,0,0,ui.width,h);ui.regions.push({x:0,y:0,w:ui.width,h,onClick:null});
    for(const b of buttons)ui.button(b.x,b.y,b.w,23,b.label,()=>this.toggle(b.panel),{selected:!!this.desktop.manager.find(`page:survival-${b.panel}`)});
    this.desktop.manager.top=h+4;
  }
  setupLayout(ui){
    const manager=this.desktop.manager,top=manager.top+4,bottom=ui.height-manager.bottom;
    const positions={profile:[8,top],activity:[8,top+238],body:[ui.width-288,top],targets:[8,bottom-260],interactions:[ui.width-348,bottom-310]};
    for(const panel of this.savedPanels||['profile','body','activity','targets','interactions']){
      const id=`page:survival-${panel}`,saved=manager.saved.has(id);this.openPanel(panel);const w=manager.find(id);
      if(!saved&&ui.width>=1000&&positions[panel]){[w.x,w.y]=positions[panel];manager.constrain(w);}
    }
    this.layoutReady=true;
  }
  updateNotice(s,now){
    if(s.message&&s.message!==this.lastSystemNotice){this.lastSystemNotice=s.message;this.lastNotice=s.message;}
    if(this.message&&now<this.messageUntil&&this.messageUntil!==this.noticedMessageUntil){this.noticedMessageUntil=this.messageUntil;this.lastNotice=this.message;}
  }
  status(city,c){
    const s=city.characterGame;
    return !c||c.entity.destroyed||s.status==='dead'?'Você morreu':c.custody?'Detido':c.unconsciousUntil>city.minute?'Inconsciente':c.sleep?.active?'Dormindo':s.intent?.kind==='gather'?'Coletando':s.intent?.kind==='rest'?'Descansando':s.autonomous&&!s.intent?c.action||'Rotina automática':this.combat?'Em guarda':s.input?.run&&s.intent?.kind==='manual'?'Correndo':s.intent?.kind==='manual'?'Caminhando':s.intent?'Em atividade':'Explorando';
  }
  nearbyList(p,actions=false,query=''){
    const city=this.getCity(),reachable=this.targets(),filter=query.trim().toLocaleLowerCase('pt-BR'),targets=(actions?reachable:this.visibleTargets()).filter(t=>`${t.label} ${targetKindLabel(t)}`.toLocaleLowerCase('pt-BR').includes(filter)),reachableKeys=new Set(reachable.map(t=>`${t.kind}:${t.id}`));
    p.note(actions?'Todas as ações disponíveis ao alcance. A lista acompanha seu movimento.':'Pessoas, construções, plantas e veículos a até 12 metros, no mesmo ambiente.');
    if(!targets.length){if(filter){p.note('Nenhum alvo corresponde ao filtro.');return;}p.note(actions?'Nenhuma interação ao alcance. Aproxime-se de uma porta, planta ou pessoa.':'Nenhum alvo próximo.');return;}
    const selected=this.targetKey;
    for(const target of targets){
      const key=`${target.kind}:${target.id}`,choices=actions?interactionOptions(city,target):[];
      p.heading(target.label);p.note(`${targetKindLabel(target)} · ${target.distance.toFixed(1)} metros${key===selected?' · Selecionado':''}`);
      p.buttons([{label:'Ver ficha',click:()=>this.dossier(target)},...(!actions?[{label:'Selecionar alvo',selected:key===selected,click:()=>this.selectTarget(target)}]:[])]);
      if(actions){if(!choices.length)p.note('Sem ações disponíveis.');for(const choice of choices)p.button(choice.label,()=>{this.selectTarget(target);this.use(target,choice);});}
      else p.note(reachableKeys.has(key)?'Ao alcance para interagir [E].':'Sem ações ao alcance; consulte a ficha.');
      p.space(8);
    }
  }
  roster(p,state){
    const city=this.getCity(),query=state.query.trim().toLocaleLowerCase('pt-BR');
    p.note('Uma pessoa por vez. A cidade continua funcionando quando você assume o controle.');
    const people=city.citizens.filter(c=>canControl(city,c)&&(!query||name(c).toLocaleLowerCase('pt-BR').includes(query)));
    if(!people.length)p.note('Nenhum adulto disponível com esse nome.');
    p.rows(people,person=>{
      p.card(name(person),`${city.society.age(person)} anos · ${formatMoney(person.balance)}\n${person.homeUnitId?'Tem abrigo':'Sem abrigo'} · ${person.jobId?'Empregado':'Sem emprego'}\n${person.provisions||0} provisões · água ${person.pocket?.water||0}/6 · saúde ${Math.round(person.needs.health)}`,()=>this.act('start',{citizenId:person.id}),false);
      p.button('Sobreviver com esta pessoa',()=>this.act('start',{citizenId:person.id}));p.space(8);
    },114);
    p.button('Voltar à simulação',()=>this.desktop.close('page:character'));
  }
  content(panel,p,state={}){
    const city=this.getCity(),s=city.characterGame,c=controlledCitizen(city),target=this.target();
    if(panel==='profile'){
      p.heading(name(c));p.kv('Data',`Dia ${city.day} · ${String(city.hour).padStart(2,'0')}:${String(city.minute%60).padStart(2,'0')}`);
      p.kv('Saldo',formatMoney(c?.balance||0));p.kv('Estado',this.status(city,c));p.kv('Tempo',this.isPaused()?'Pausado':'Em andamento');p.kv('Controle',s.manualPending?'Aguardando concluir atividade':s.autonomous?'Rotina automática':'Total · WASD');return;
    }
    if(panel==='targets')return this.nearbyList(p,false,state.query);
    if(panel==='interactions')return this.nearbyList(p,true,state.query);
    if(panel==='activity'){
      p.note(c?.action||this.status(city,c));
      if(s.intent?.kind==='gather')p.meter('Coleta',100*(s.intent.progress||0)/6);
      if(s.intent)p.button('X · Cancelar ação',()=>{this.keys.clear();this.act('stop');});
      if(s.intent?.kind==='rest'&&!c?.indoorLocation)p.button('Dormir no chão',()=>this.act('sleep-here'));
      p.buttons([{label:`1 · Comer (${(c?.provisions||0)+(c?.pocket?.food?.length||0)})`,click:()=>this.act('eat')},{label:`2 · Água (${c?.pocket?.water||0}/6)`,click:()=>this.act('drink')},{label:'R · Descansar',click:()=>this.act('rest')}]);
      const selected=this.visibleTargets().find(t=>`${t.kind}:${t.id}`===this.targetKey)||target;
      if(selected){p.heading('Alvo selecionado');p.note(`${selected.label} · ${selected.distance.toFixed(1)} metros`);if(target)p.button('E · Interagir',()=>this.interact());else p.note('Este alvo não oferece uma ação ao alcance.');p.button('Ver ficha do alvo',()=>this.dossier(selected));}
      if(this.lastNotice){p.heading('Último aviso');p.note(this.lastNotice);}return;
    }
    if(panel==='inventory')return this.inventory(p,city,c,target);
    if(panel==='body')return this.body(p,c);
    if(panel==='family'||panel==='death'){
      p.note(panel==='death'?'A cidade continua. Assuma um familiar sobrevivente ou retorne à simulação.':'Uma pessoa sob controle. Cada familiar mantém seus próprios bens e rotina.');
      this.family(p,city,c);if(panel==='death')p.button('Voltar à simulação',()=>this.act('simulation'));return;
    }
    if(panel==='interaction'){
      if(!target){p.note('Nada ao alcance.');return;}
      p.heading(target.label);p.note(`${target.distance.toFixed(1)} metros · Q alterna o alvo`);p.button('Ver ficha',()=>this.dossier(target));
      interactionOptions(city,target).forEach((choice,i)=>p.button(`${i+1}. ${choice.label}`,()=>this.use(target,choice)));return;
    }
    if(panel==='journal'){
      p.note(`${s.meals} refeições · ${s.collected} alimentos colhidos · ${formatMoney(s.earned)} em salários`);
      for(const e of [...s.journal].reverse()){p.heading(`Dia ${Math.floor(e.minute/1440)+1} · ${String(Math.floor(e.minute%1440/60)).padStart(2,'0')}:${String(e.minute%60).padStart(2,'0')}`);p.note(e.text);}return;
    }
    if(panel==='menu'){
      p.button(this.isPaused()?'Continuar o tempo [P]':'Pausar o tempo [P]',()=>this.onPause());
      p.button('Alternar câmera',()=>this.onCamera());p.button('Voltar à simulação',()=>this.act('simulation'));
      p.heading('Controles');p.note('WASD / setas: mover\nShift: correr\nE: interagir · Q: alternar alvo\nC: personagem · H: corpo · V: atividade\nT: alvos próximos · B: interações próximas\nI: mochila · U: família · J: diário\n1: comer · 2: beber · R: descansar\nCtrl + clique / F / Espaço: atacar\nX: interromper · P: pausar\nTab: alternar janela · Esc: fechar');
    }
  }
  inventory(p,city,c,target){
    if(!c)return;
    const food=(c.provisions||0)+(c.pocket?.food?.length||0),goods=Object.entries(c.inventory||{}).filter(([,q])=>q>0);
    p.heading(`Carregando · ${inventoryUsed(c)}/${c.inventoryCapacity||'—'} itens`);
    p.kv('Refeições / provisões',food);if(food)p.button('Comer',()=>this.act('eat'));
    p.kv('Garrafa',`${c.pocket?.water||0}/6`);p.button('Beber',()=>this.act('drink'));
    for(const [good,q]of goods){p.kv(city.economy.goods[good]?.label||good,q);if(city.nature.productsForFood(good))p.button(`Comer ${city.economy.goods[good]?.label||good}`,()=>this.act('eat',{good}));}
    p.heading('Ao alcance');
    if(!target){p.note('Nada ao alcance. Aproxime-se de uma planta, entrada ou estabelecimento.');return;}
    p.note(`${target.label} · ${target.distance.toFixed(1)} metros`);
    const choices=interactionOptions(city,target).filter(choice=>['gather','service','sell','raw-water'].includes(choice.action));
    if(!choices.length)p.note('Nenhum suprimento disponível aqui.');
    for(const choice of choices)p.button(choice.label,()=>this.use(target,choice));
  }
  body(p,c){
    if(!c)return;for(const [key,label]of meters)p.meter(label,c.needs[key]);
    p.heading('Ferimentos');const injuries=c.combatInjuries||[];
    if(!injuries.length)p.note('Nenhum ferimento registrado.');
    for(const w of injuries)p.status(w.region||'Ferimento',`Gravidade ${Math.round(w.severity||0)} · ${w.bleedingRate>0&&!w.bleedingStoppedAt?'Sangrando':'Sem sangramento ativo'}`,T.red);
    p.note('Procure atendimento próximo se estiver ferido. Descansar recupera energia, mas não substitui uma noite de sono.');
  }
  family(p,city,c){
    const people=relatives(city,c);if(!people.length)p.note('Nenhum familiar adulto disponível.');
    for(const person of people){p.heading(name(person));p.note(`Saúde ${Math.round(person.needs.health)} · ${person.homeUnitId?'abrigado':'sem abrigo'}`);if(canControl(city,person))p.button('Assumir controle',()=>this.act('switch',{citizenId:person.id}));else p.note('Ocupado ou indisponível.');}
  }
}
