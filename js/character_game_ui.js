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
  constructor({root,getCity,command,onEnter,onSimulation,onMenu,onCamera,onPause,isPaused,getDirection,getSpeed=()=>1,onSpeed=()=>{},getThirdPerson=()=>false,getEntities=()=>[],getCameraLocked=()=>true,onCameraLock=()=>{},onSettings=()=>{}}){
    Object.assign(this,{getCity,command,onEnter,onSimulation,onMenu,onCamera,onPause,isPaused,getDirection,getSpeed,onSpeed,getThirdPerson,getEntities,getCameraLocked,onCameraLock,onSettings});
    this.keys=new Set();this.choosing=false;this.message='';this.targetKey=null;this.contextOpen=false;this.layoutReady=false;this.savedPanels=null;
    this.desktop=new CityDesktop({city:getCity(),root,select:()=>{},initialModule:null,notifications:false});
    this.element=this.desktop.element;
  }
  get active(){return this.choosing||playing(this.getCity());}
  async act(action,options={}){
    this.worldMenu=null;const result=await this.command(action,options);
    if(result?.ok===false){this.message=result.message||'Ação indisponível.';this.messageUntil=performance.now()+5000;}
    if(result?.ok!==false&&['start','resume','switch'].includes(action)){
      if(action!=='switch'||!this.layoutReady){this.entering=true;this.desktop.closeAll(true);this.entering=false;this.layoutReady=false;}
      this.choosing=false;this.contextOpen=false;this.worldMenu=null;this.keys.clear();this.targetKey=null;this.selectedEntityId=null;this.onEnter();
    }
    if(result?.ok!==false&&action==='simulation'){this.savedPanels=this.desktop.manager.windows.filter(w=>w.id.startsWith('page:survival-')&&w.id!=='page:survival-interaction').map(w=>w.id.slice('page:survival-'.length));this.desktop.closeAll(true);this.layoutReady=false;this.keys.clear();this.contextOpen=false;this.worldMenu=null;this.onSimulation();}
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
  visibleTargets(radius=12){
    const city=this.getCity(),c=controlledCitizen(city),targets=nearbyTargets(city,c,radius,{inspectable:true});
    if(!c||c.indoorLocation)return targets;
    const known=new Set(targets.map(t=>t.entityId));
    for(const entity of this.getEntities()){
      const p=entity.properties;
      if(entity===c.entity||entity.destroyed||known.has(entity.id)||!p?.render||p.species==='effect'||p.citizen||p.cityBuilding||p.cityPlant||p.cityVehicle)continue;
      const distance=Math.hypot(c.entity.x-entity.x,c.entity.y-entity.y);
      if(distance<=radius)targets.push({kind:'object',id:entity.id,entityId:entity.id,point:{x:entity.x,y:entity.y},label:p.name||'Objeto no chão',distance});
    }
    return targets.sort((a,b)=>a.distance-b.distance);
  }
  selectTarget(target){this.targetKey=`${target.kind}:${target.id}`;this.selectedEntityId=target.entityId;}
  dossier(target){return this.desktop.openPage(`inspect-${target.kind}-${target.id}`,{title:`Ficha · ${target.label}`,width:380,height:440,draw:p=>drawTargetDossier(p,this.getCity(),target,id=>this.getEntities().find(e=>e.id===id))});}
  target(){const targets=this.targets();return this.targetKey?targets.find(t=>`${t.kind}:${t.id}`===this.targetKey):targets.find(t=>t.kind!=='person')||targets[0];}
  inspect(entityId,notify=true){
    const target=this.visibleTargets(Infinity).find(t=>t.entityId===entityId);
    if(target){this.selectTarget(target);this.dossier(target);return true;}
    if(notify){this.message='Aproxime-se para interagir. Use WASD para explorar.';this.messageUntil=performance.now()+3000;}return false;
  }
  openWorldMenu(entityId,point,x,y){
    const city=this.getCity(),c=controlledCitizen(city);if(!playing(city)||!c||c.entity.destroyed)return false;
    const self=entityId===c.entity.id,target=self?{kind:'self',id:c.id,entityId,label:name(c)}:this.visibleTargets(Infinity).find(t=>t.entityId===entityId);
    if(target&&!self)this.selectTarget(target);
    this.contextOpen=false;this.worldMenu={entityId:target?entityId:null,self,point:point&&{x:point.x+.5,y:point.y+.5},x,y,index:0,offset:0};return true;
  }
  worldMenuItems(){
    const menu=this.worldMenu;if(!menu)return null;
    const city=this.getCity(),c=controlledCitizen(city);if(!playing(city)||!c||c.entity.destroyed)return null;
    const target=menu.self?{kind:'self',id:c.id,label:name(c)}:menu.entityId!=null?this.visibleTargets(Infinity).find(t=>t.entityId===menu.entityId):null;
    if(menu.entityId!=null&&!target)return null;
    const items=[],add=(label,click,disabled=false,danger=false)=>items.push({label,click,disabled,danger});
    if(menu.self){
      add('Ver personagem',()=>this.openPanel('profile'));add('Abrir mochila',()=>this.openPanel('inventory'));add('Descansar',()=>this.act('rest'));add('Interromper ação',()=>this.act('stop'));
    }else if(target){
      for(const choice of interactionOptions(city,target))add(choice.label,()=>choice.action==='family'?this.toggle('family'):this.act('approach-interact',{kind:target.kind,targetId:target.id,choice:choice.id}));
      if(target.kind==='person')add('Atacar',()=>this.act('approach-interact',{kind:'person',targetId:target.id,choice:'attack'}),false,true);
      if(!c.indoorLocation&&target.point)add('Aproximar-se',()=>this.act('walk',target.point));
      add('Selecionar alvo',()=>this.selectTarget(target));add('Examinar',()=>this.dossier(target));
    }
    if(menu.point&&!c.indoorLocation)add('Caminhar até aqui',()=>this.act('walk',menu.point));
    add('Cancelar',()=>{});
    return {label:target?.label||'Chão',items};
  }
  runWorldMenuItem(item){
    if(!item||item.disabled)return;
    this.worldMenu=null;item.click();
  }
  drawWorldMenu(ui){
    const data=this.worldMenuItems(),menu=this.worldMenu;if(!data){this.worldMenu=null;return;}
    const width=Math.min(ui.width-8,Math.max(220,...data.items.map(item=>ui.textWidth(item.label)+40))),rows=Math.max(1,Math.floor((ui.height-this.desktop.manager.top-this.desktop.manager.bottom-52)/25)),visible=Math.min(rows,data.items.length),height=49+visible*25;
    const x=Math.max(4,Math.min(menu.x,ui.width-width-4)),y=Math.max(this.desktop.manager.top,Math.min(menu.y,ui.height-this.desktop.manager.bottom-height));
    menu.index=Math.min(menu.index,data.items.length-1);menu.offset=Math.max(0,Math.min(menu.offset,data.items.length-visible));menu.bounds={x,y,w:width,h:height,rows:visible,total:data.items.length};
    bevel(ui.ctx,x,y,width,height,{fill:T.paper});ui.regions.push({x,y,w:width,h:height,onClick:null});
    bevel(ui.ctx,x+3,y+3,width-6,20,{fill:T.header});ui.text(ui.fitText('Escolha uma opção'+(data.items.length>visible?' · role para mais':''),width-18),x+9,y+7,T.captionInk);ui.text(ui.fitText(data.label,width-18),x+9,y+27,T.muted);
    for(let row=0;row<visible;row++){
      const index=menu.offset+row,item=data.items[index],label=ui.fitText(item.label+(item.disabled?' · fora de alcance':''),width-24),py=y+46+row*25,hover=ui.pointer&&ui.pointer.x>=x+4&&ui.pointer.x<x+width-4&&ui.pointer.y>=py&&ui.pointer.y<py+23;
      ui.button(x+4,py,width-8,23,label,()=>this.runWorldMenuItem(item),{selected:!item.disabled&&(menu.keyboard?menu.index===index:hover),danger:item.danger&&!item.disabled});
      const region=ui.regions.at(-1);Object.assign(region,{role:'menuitem',disabled:item.disabled});
      if(item.disabled){bevel(ui.ctx,x+4,py,width-8,23,{fill:T.paper});ui.text(label,x+10,py+5,T.muted);}
    }
  }
  scrollAt(x,y,delta){
    const menu=this.worldMenu;if(menu){const b=menu.bounds;if(b&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)menu.offset=Math.max(0,Math.min(b.total-b.rows,menu.offset+Math.sign(delta)*2));return true;}
    return this.desktop.scrollAt(x,y,delta);
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
    if(down&&this.worldMenu){
      const data=this.worldMenuItems();if(!data){this.worldMenu=null;return true;}else if(event.code==='Escape'){this.worldMenu=null;return true;}else if(['ArrowUp','ArrowDown','Enter'].includes(event.code)||/^Digit[1-9]$/.test(event.code)){
        const menu=this.worldMenu;menu.keyboard=true;if(event.code==='Enter')this.runWorldMenuItem(data.items[menu.index]);
        else if(/^Digit/.test(event.code))this.runWorldMenuItem(data.items[menu.offset+Number(event.code.slice(-1))-1]);
        else{const step=event.code==='ArrowUp'?-1:1;menu.index=(menu.index+step+data.items.length)%data.items.length;const rows=menu.bounds?.rows||data.items.length;if(menu.index<menu.offset)menu.offset=menu.index;else if(menu.index>=menu.offset+rows)menu.offset=menu.index-rows+1;}return true;
      }
    }
    if(down&&['Tab','PageDown','PageUp','Home','End','Slash'].includes(event.code))return this.desktop.key(event);
    if(this.choosing){if(down&&event.code==='Escape'){this.desktop.close('page:character');return true;}return false;}
    if((event.ctrlKey||event.metaKey)&&['KeyR','KeyL'].includes(event.code))return false;
    if(['ControlLeft','ControlRight'].includes(event.code)){this.combat=down;return true;}
    if(movingCodes.includes(event.code)||['ShiftLeft','ShiftRight'].includes(event.code)){
      if(this.getCity().characterGame.autonomous){this.keys.clear();if(down&&movingCodes.includes(event.code)){this.message='Desligue a rotina automática na barra inferior para usar WASD.';this.messageUntil=performance.now()+3000;}return true;}
      if(down&&!this.keys.has(event.code)){this.keys.add(event.code);this.contextOpen=false;this.worldMenu=null;this.input();}else if(!down&&this.keys.delete(event.code))this.input();return true;
    }
    if(!down||event.repeat||event.metaKey||event.altKey)return false;
    const actions={KeyO:()=>this.onSettings(),KeyL:()=>this.onCameraLock(),KeyZ:()=>this.onCamera(),KeyC:()=>this.toggle('profile'),KeyV:()=>this.toggle('activity'),KeyT:()=>this.toggle('targets'),KeyB:()=>this.toggle('interactions'),KeyE:()=>this.interact(),KeyI:()=>this.toggle('inventory'),KeyH:()=>this.toggle('body'),KeyU:()=>this.toggle('family'),KeyJ:()=>this.toggle('journal'),KeyP:()=>{this.onPause();},KeyX:()=>{this.keys.clear();this.act('stop');},KeyR:()=>this.act('rest'),KeyF:()=>this.attack(),Space:()=>this.onPause(),Digit1:()=>this.act('eat'),Digit2:()=>this.act('drink'),Escape:()=>{if(this.contextOpen){this.contextOpen=false;}else if(this.desktop.manager.windows.length)this.desktop.close(this.desktop.manager.activeId);else this.toggle('menu');},KeyQ:()=>{
      const targets=this.targets(),index=targets.findIndex(t=>`${t.kind}:${t.id}`===this.targetKey),target=targets[(index+1)%targets.length];if(target)this.selectTarget(target);
    }};
    if(this.contextOpen&&/^Digit[1-9]$/.test(event.code)){
      const target=this.target(),choice=interactionOptions(this.getCity(),target)[Number(event.code.slice(-1))-1];if(choice)this.use(target,choice);return true;
    }
    if(actions[event.code]){actions[event.code]();return true;}return false;
  }
  blur(){this.worldMenu=null;this.combat=false;if(this.keys.size){this.keys.clear();this.input();}}
  pointerDown(x,y,button,ui){
    this.menuDismiss=false;
    if(this.worldMenu){
      const b=this.worldMenu.bounds;if(b&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h){if(button===2){this.worldMenu=null;this.menuDismiss=true;}return true;}
      this.worldMenu=null;if(button===0){this.menuDismiss=true;return true;}
    }
    if(button===2&&this.desktop.rightClick(x,y))return true;
    return this.desktop.pointerDown(x,y)||!!this.desktop.manager.at(x,y)||!!ui.hitTest(x,y)||this.choosing;
  }
  pointerMove(x,y){
    const menu=this.worldMenu;
    if(menu){menu.keyboard=false;const b=menu.bounds,row=b&&Math.floor((y-b.y-46)/25);if(b&&x>=b.x&&x<=b.x+b.w&&row>=0&&row<b.rows)menu.index=menu.offset+row;return true;}
    return this.desktop.pointerMove(x,y);
  }
  pointerUp(x,y,button,ui){
    if(this.menuDismiss){this.menuDismiss=false;return true;}
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
    if(isPlaying&&!this.choosing)this.drawWorldMenu(ui);
  }
  bottomBar(ui,city,c){
    const s=city.characterGame,controls=[];
    for(const speed of [0.25,0.5,1,2,4,8,16])controls.push({w:46,label:`${speed===1?'1.0':speed}×`,click:()=>this.onSpeed(speed),selected:this.getSpeed()===speed});
    controls.push({w:74,label:this.isPaused()?'Continuar':'Pausar',click:()=>this.onPause(),selected:this.isPaused()},
      {w:230,switch:true},{w:170,label:this.getThirdPerson()?'Z · Câmera: 3ª pessoa':'Z · Câmera: isométrica',click:()=>this.onCamera(),selected:this.getThirdPerson()},
      {w:150,label:this.getCameraLocked()?'L · Câmera travada':'L · Câmera livre',click:()=>this.onCameraLock(),selected:this.getCameraLocked()},
      {w:125,label:'O · Configurações',click:()=>this.onSettings()});
    let x=4,y=33;
    for(const control of controls){control.w=Math.min(control.w,ui.width-8);if(x+control.w>ui.width-4){x=4;y+=29;}Object.assign(control,{x,y});x+=control.w+4;}
    const height=y+33,top=ui.height-height;this.desktop.manager.bottom=height+4;
    bevel(ui.ctx,0,top,ui.width,height);ui.regions.push({x:0,y:top,w:ui.width,h:height,onClick:null});
    const stamp=`Dia ${city.day} · ${String(city.hour).padStart(2,'0')}:${String(city.minute%60).padStart(2,'0')}`;
    const summary=`${stamp} · Saúde ${Math.round(c?.needs?.health||0)} · Água ${Math.round(c?.needs?.water||0)} · Energia ${Math.round(c?.needs?.energy||0)} · ${s.manualPending?'Aguardando controle manual':s.autonomous?'Rotina automática':'Controle total'}`;
    const balance=`Saldo ${formatMoney(c?.balance||0)}`,balanceWidth=Math.min(ui.width-24,ui.textWidth(balance)+16),balanceX=ui.width-balanceWidth-4;
    bevel(ui.ctx,4,top+4,Math.max(0,balanceX-8),23,{inset:true,fill:T.paper});ui.text(ui.fitText(summary,balanceX-22),11,top+9,T.ink);
    bevel(ui.ctx,balanceX,top+4,balanceWidth,23,{inset:true,fill:T.paper});ui.text(ui.fitText(balance,balanceWidth-12),balanceX+6,top+9,T.ink);
    for(const control of controls){
      if(control.switch)ui.switch(control.x,top+control.y,control.w,25,'Rotina automática',s.autonomous===true,enabled=>{this.keys.clear();this.act('autonomy',{enabled:s.manualPending?true:enabled});});
      else ui.button(control.x,top+control.y,control.w,25,control.label,control.click,{selected:!!control.selected});
    }
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
      this.family(p,city,c);if(panel==='death')p.button(this.getCameraLocked()?'Liberar câmera [L]':'Travar câmera no personagem [L]',()=>this.onCameraLock());p.button('Configurações [O]',()=>this.onSettings());p.button('Voltar à simulação',()=>this.act('simulation'));return;
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
      p.button(this.getThirdPerson()?'Câmera isométrica [Z]':'Câmera em terceira pessoa [Z]',()=>this.onCamera());p.button(this.getCameraLocked()?'Liberar câmera [L]':'Travar câmera no personagem [L]',()=>this.onCameraLock());p.button('Configurações [O]',()=>this.onSettings());p.button('Voltar à simulação',()=>this.act('simulation'));
      p.heading('Controles');p.note('WASD / setas: mover\nZ: isométrica / 3ª pessoa · L: câmera livre / travada\nBotão direito + arrastar: girar câmera em 3p ou isométrica\nBotão do meio + arrastar: deslocar câmera livre\nO: configurações\nClique: selecionar pessoa ou objeto · chão livre: andar\nBotão direito sem arrastar: menu contextual\nMenu: setas e Enter · Esc ou clique fora: cancelar\nShift: correr\nE: interagir · Q: alternar alvo\nC: personagem · H: corpo · V: atividade\nT: alvos próximos · B: interações próximas\nI: mochila · U: família · J: diário\n1: comer · 2: beber · R: descansar\nCtrl + clique / F: atacar · Espaço / P: pausar\nX: interromper · P: pausar\nTab: alternar janela · Esc: fechar');
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
