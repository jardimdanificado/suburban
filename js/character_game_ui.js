import {playing,controlledCitizen,canControl,relatives} from './character_game.js';
import {nearbyTargets,interactionOptions} from './character_interactions.js';
import {formatMoney} from './city_ui_format.js';
import {inventoryUsed} from './city_inventory.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const name=c=>c?.entity?.properties?.name||'Sem nome';
const meters=[['health','Saúde','+'],['food','Alimentação','F'],['water','Água','A'],['energy','Energia','E'],['hygiene','Higiene','H'],['toilet','Banheiro','B']];
const movingCodes=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
export class CharacterGameUI {
  constructor({root,getCity,command,onEnter,onSimulation,onMenu,onCamera,onPause,isPaused,getDirection}){
    Object.assign(this,{getCity,command,onEnter,onSimulation,onMenu,onCamera,onPause,isPaused,getDirection});
    this.panel=null;this.keys=new Set();this.choosing=false;this.lastDraw=0;this.message='';this.actionMap=new Map();this.targetKey=null;
    this.element=document.createElement('section');this.element.className='character-game';this.element.setAttribute('aria-label','Sobrevivência');root.append(this.element);
    this.marker=document.createElement('div');this.marker.className='character-marker';this.marker.textContent='Você';this.marker.hidden=true;root.append(this.marker);
    for(const event of ['pointerdown','pointermove','pointerup','wheel','contextmenu','dblclick'])this.element.addEventListener(event,e=>{if(e.target.closest('button,.survival-panel,.character-chooser'))e.stopPropagation();});
    this.element.addEventListener('click',e=>{const b=e.target.closest('[data-game]');if(b){e.stopPropagation();this.actionMap.get(b.dataset.game)?.();}});
    this.element.addEventListener('input',e=>{if(e.target.matches('[data-search]')){this.query=e.target.value;this.draw(true);}});
  }
  set html(value){
    if(this.lastHTML===value)return;this.lastHTML=value;
    const template=document.createElement('template');template.innerHTML=value;
    const patch=(current,next)=>{
      if(current.nodeType!==next.nodeType||current.nodeName!==next.nodeName){current.replaceWith(next.cloneNode(true));return;}
      if(current.nodeType===Node.TEXT_NODE){if(current.textContent!==next.textContent)current.textContent=next.textContent;return;}
      for(const attribute of [...current.attributes])if(!next.hasAttribute(attribute.name))current.removeAttribute(attribute.name);
      for(const attribute of next.attributes)if(current.getAttribute(attribute.name)!==attribute.value)current.setAttribute(attribute.name,attribute.value);
      patchChildren(current,next);
    };
    const patchChildren=(current,next)=>{
      const children=[...current.childNodes],incoming=[...next.childNodes];
      for(let i=0;i<Math.max(children.length,incoming.length);i++){
        if(!incoming[i])children[i].remove();else if(!children[i])current.append(incoming[i].cloneNode(true));else patch(children[i],incoming[i]);
      }
    };
    patchChildren(this.element,template.content);
  }
  button(text,click,cls='',title=''){
    const id=String(this.actionMap.size);this.actionMap.set(id,click);
    return `<button type="button" class="${cls}" data-game="${id}"${title?` title="${escape(title)}"`:''}>${escape(text)}</button>`;
  }
  track(point){this.marker.hidden=!point?.visible||!playing(this.getCity());if(!this.marker.hidden){this.marker.style.left=`${point.x}px`;this.marker.style.top=`${point.y}px`;}}
  async act(action,options={}){
    const result=await this.command(action,options);
    if(result?.ok===false){this.message=result.message||'Ação indisponível.';this.messageUntil=performance.now()+5000;}
    if(result?.ok!==false&&['start','resume','switch'].includes(action)){this.choosing=false;this.panel=null;this.contextOpen=false;this.keys.clear();this.onEnter();}
    if(result?.ok!==false&&action==='simulation'){this.keys.clear();this.panel=null;this.onSimulation();}
    this.draw(true);return result;
  }
  choose(){this.chooserPaused=!this.isPaused();if(this.chooserPaused)this.onPause();this.choosing=true;this.query='';this.onMenu(false);this.draw(true);}
  toggle(panel){this.panel=this.panel===panel?null:panel;this.contextOpen=false;this.draw(true);}
  input(){
    const x=Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'));
    const y=Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'));
    this.command('input',{...(this.getDirection?.(x,y)||{x,y}),run:this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')});
  }
  targets(){return nearbyTargets(this.getCity());}
  target(){const targets=this.targets();return targets.find(t=>`${t.kind}:${t.id}`===this.targetKey)||targets.find(t=>t.kind!=='person')||targets[0];}
  inspect(entityId){
    const target=this.targets().find(t=>t.entityId===entityId);
    if(target){this.targetKey=`${target.kind}:${target.id}`;this.contextOpen=true;this.draw(true);return true;}
    this.message='Aproxime-se para interagir. Use WASD para explorar.';this.messageUntil=performance.now()+3000;this.draw(true);return false;
  }
  interact(){
    const target=this.target();if(!target){this.message='Nada ao alcance. Aproxime-se de uma porta, planta ou pessoa.';this.messageUntil=performance.now()+3000;this.draw(true);return;}
    const choices=interactionOptions(this.getCity(),target);
    if(choices.length===1)this.use(target,choices[0]);else{this.contextOpen=!this.contextOpen;this.draw(true);}
  }
  use(target,choice){
    if(choice.action==='family'){this.toggle('family');return;}
    this.contextOpen=false;this.act('interact',{kind:target.kind,targetId:target.id,choice:choice.id});
  }
  attack(entityId=null){
    const targets=this.targets().filter(t=>t.kind==='person'&&t.distance<=1.6),target=targets.find(t=>t.entityId===entityId)||(!entityId&&targets[0]);
    if(target)this.act('attack',{citizenId:target.id});else{this.message='Ninguém ao alcance do golpe.';this.messageUntil=performance.now()+2500;this.draw(true);}
  }
  key(event,down=true){
    if(!playing(this.getCity())||/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName))return false;
    if((event.ctrlKey||event.metaKey)&&['KeyR','KeyL'].includes(event.code))return false;
    if(['ControlLeft','ControlRight'].includes(event.code)){this.combat=down;this.draw(true);return true;}
    if(movingCodes.includes(event.code)||['ShiftLeft','ShiftRight'].includes(event.code)){
      if(down&&!this.keys.has(event.code)){this.keys.add(event.code);this.contextOpen=false;this.input();}else if(!down&&this.keys.delete(event.code))this.input();return true;
    }
    if(!down||event.repeat||event.metaKey||event.altKey)return false;
    const actions={KeyE:()=>this.interact(),KeyI:()=>this.toggle('inventory'),KeyH:()=>this.toggle('body'),KeyU:()=>this.toggle('family'),KeyJ:()=>this.toggle('journal'),KeyP:()=>{this.onPause();this.draw(true);},KeyX:()=>{this.keys.clear();this.act('stop');},KeyR:()=>this.act('rest'),KeyF:()=>this.attack(),Space:()=>this.attack(),Digit1:()=>this.act('eat'),Digit2:()=>this.act('drink'),Escape:()=>{if(this.contextOpen){this.contextOpen=false;this.draw(true);}else this.toggle('menu');},KeyQ:()=>{
      const targets=this.targets(),index=targets.findIndex(t=>`${t.kind}:${t.id}`===this.targetKey),target=targets[(index+1)%targets.length];if(target)this.targetKey=`${target.kind}:${target.id}`;this.draw(true);
    }};
    if(this.contextOpen&&/^Digit[1-9]$/.test(event.code)){
      const target=this.target(),choice=interactionOptions(this.getCity(),target)[Number(event.code.slice(-1))-1];if(choice)this.use(target,choice);return true;
    }
    if(actions[event.code]){actions[event.code]();return true;}return false;
  }
  blur(){this.combat=false;if(this.keys.size){this.keys.clear();this.input();}}
  draw(force=false,now=performance.now()){
    if(!force&&(this.choosing||now-this.lastDraw<160))return;this.lastDraw=now;
    const active=document.activeElement,focused=active?.matches?.('[data-search]'),selection=focused?active.selectionStart:null;
    const city=this.getCity(),s=city.characterGame,c=controlledCitizen(city),isPlaying=playing(city);
    this.actionMap.clear();this.element.classList.toggle('is-playing',isPlaying);this.element.classList.toggle('is-choosing',this.choosing);
    if(!isPlaying&&!this.choosing){this.html=`<div class="character-entry">${this.button(s?'Continuar personagem':'Jogar neste mundo',()=>s?this.act('resume'):this.choose(),'primary')}${s?this.button('Escolher outra pessoa',()=>this.choose()):''}</div>`;return;}
    if(this.choosing){
      const people=city.citizens.filter(person=>canControl(city,person)&&(!this.query||name(person).toLowerCase().includes(this.query.toLowerCase()))).slice(0,36);
      this.html=`<div class="character-shade"></div><div class="character-chooser"><div class="survival-kicker">SUBURBAN / SOBREVIVÊNCIA</div><h1>Quem vai sobreviver?</h1><p>Uma pessoa. Uma mochila. Uma cidade que não espera por você.</p><input data-search aria-label="Buscar personagem" placeholder="Buscar pessoa…" value="${escape(this.query||'')}"><div class="character-roster">${people.map(person=>`<article><h3>${escape(name(person))}</h3><p>${city.society.age(person)} anos · ${escape(formatMoney(person.balance))}</p><p>${person.homeUnitId?'Tem abrigo':'Sem abrigo'} · ${person.jobId?'Empregado':'Sem emprego'}</p><small>${person.provisions||0} provisões · água ${person.pocket?.water||0}/6 · saúde ${Math.round(person.needs.health)}</small>${this.button('Sobreviver com esta pessoa',()=>this.act('start',{citizenId:person.id}),'primary')}</article>`).join('')}</div><footer>${this.button('Voltar à simulação',()=>{this.choosing=false;if(this.chooserPaused&&this.isPaused())this.onPause();this.chooserPaused=false;this.draw(true);})}<span>WASD: mover · Shift: correr · E: interagir · I: mochila</span></footer>${this.message?`<p role="alert">${escape(this.message)}</p>`:''}</div>`;
      if(focused){const input=this.element.querySelector('[data-search]');input.focus();input.setSelectionRange(selection,selection);}return;
    }
    const dead=!c||c.entity.destroyed||s.status==='dead',target=!dead&&this.target(),choices=target?interactionOptions(city,target):[];
    const danger=c&&(c.combatInjuries?.some(w=>w.bleedingRate>0&&!w.bleedingStoppedAt)||c.needs.health<25);
    const bars=meters.map(([key,label,icon])=>{const value=Math.round(c?.needs[key]||0);return `<div class="survival-meter ${value<25?'critical':value<50?'low':''}" title="${label}: ${value}"><b>${icon}</b><progress aria-label="${label}" max="100" value="${value}"></progress><small>${value}</small></div>`;}).join('');
    const status=dead?'Você morreu':c.custody?'Detido':c.unconsciousUntil>city.minute?'Inconsciente':c.sleep?.active?'Dormindo':s.intent?.kind==='gather'?'Coletando':s.intent?.kind==='rest'?'Descansando':this.combat?'Em guarda':s.input?.run&&s.intent?.kind==='manual'?'Correndo':s.intent?.kind==='manual'?'Caminhando':s.intent?'Em atividade':'Explorando';
    let panel=this.panel;
    if(dead)panel='death';
    const titles={inventory:'Mochila',body:'Condição física',family:'Família',journal:'Diário',menu:'Pausa e opções',death:'Fim desta vida'};
    let content='';
    if(panel==='inventory')content=this.inventory(city,c,target);
    if(panel==='body')content=this.body(city,c);
    if(panel==='family'||panel==='death')content=`${dead?'<p>A cidade continua. Assuma um familiar sobrevivente ou retorne à simulação.</p>':'<p>Uma pessoa sob controle. Cada familiar mantém seus próprios bens e rotina.</p>'}${this.family(city,c)}${dead?this.button('Voltar à simulação',()=>this.act('simulation')):''}`;
    if(panel==='journal')content=`<p>${s.meals} refeições · ${s.collected} alimentos colhidos · ${formatMoney(s.earned)} em salários</p>${[...s.journal].reverse().map(e=>`<article class="survival-log"><small>Dia ${Math.floor(e.minute/1440)+1} · ${String(Math.floor(e.minute%1440/60)).padStart(2,'0')}:${String(e.minute%60).padStart(2,'0')}</small><p>${escape(e.text)}</p></article>`).join('')}`;
    if(panel==='menu')content=`${this.button(this.isPaused?.()?'Continuar o tempo [P]':'Pausar o tempo [P]',()=>{this.onPause();this.draw(true);})}${this.button('Alternar câmera',()=>this.onCamera())}${this.button('Voltar à simulação',()=>this.act('simulation'))}<p>WASD / setas: mover<br>Shift: correr<br>E: interagir · Q: alternar alvo<br>I: mochila · H: corpo · U: família<br>1: comer · 2: beber · R: descansar<br>Ctrl + clique / F / Espaço: atacar<br>X: interromper · P: pausar</p>`;
    const current=this.message&&now<this.messageUntil?this.message:s.message;
    if(current!==this.lastNotice){this.lastNotice=current;this.noticeAt=now;}
    const toast=current&&now-(this.noticeAt||0)<4500;
    this.html=`<header class="survival-top"><div class="survival-identity"><span class="survival-kicker">DIA ${city.day} / ${String(city.hour).padStart(2,'0')}:${String(city.minute%60).padStart(2,'0')}</span><strong>${escape(name(c))}</strong><small>${escape(formatMoney(c?.balance||0))} · ${status}</small></div><div class="survival-mode">${this.isPaused?.()?'<span>PAUSADO [P]</span>':''}${danger?'<span class="survival-alert">FERIDO · H</span>':''}${this.button('Esc',()=>this.toggle('menu'),'survival-small','Opções')}</div></header><nav class="survival-tools">${[['inventory','I','Mochila'],['body','H','Corpo'],['family','U','Família'],['journal','J','Diário']].map(([key,shortcut,label])=>this.button(`${shortcut}  ${label}`,()=>this.toggle(key),panel===key?'selected':'')).join('')}</nav><aside class="survival-vitals">${bars}</aside>${panel?`<section class="survival-panel ${panel==='inventory'?'inventory-panel':''}"><header><h2>${titles[panel]}</h2>${this.button('×',()=>{this.panel=null;this.draw(true);},'survival-close','Fechar')}</header>${content}</section>`:''}${!dead&&this.contextOpen&&target?`<section class="survival-interaction"><header><strong>${escape(target.label)}</strong><small>${target.distance.toFixed(1)} m · Q alterna alvo</small></header>${choices.map((choice,i)=>this.button(`${i+1}. ${choice.label}`,()=>this.use(target,choice))).join('')}</section>`:''}${!dead&&target&&!panel&&!this.contextOpen?`<div class="survival-prompt">${this.button(`E  ${target.label}`,()=>this.interact())}<small>${target.kind==='plant'?'Coletar alimento':target.kind==='person'?'Conversar':target.kind==='water'?'Encher garrafa · risco de contaminação':'Explorar / interagir'} · ${target.distance.toFixed(1)} m · Q troca alvo</small></div>`:''}${!dead&&s.intent&&!['manual','walk'].includes(s.intent.kind)?`<div class="survival-activity"><span>${escape(c.action||status)}</span>${s.intent.kind==='gather'?`<progress max="6" value="${s.intent.progress||0}"></progress>`:''}${s.intent.kind==='rest'&&!c.indoorLocation?this.button('Dormir no chão',()=>this.act('sleep-here')):''}${this.button('X · Cancelar',()=>{this.keys.clear();this.act('stop');})}</div>`:''}<footer class="survival-bottom"><div class="survival-hotbar">${this.button(`1  Comer · ${(c?.provisions||0)+(c?.pocket?.food?.length||0)}`,()=>this.act('eat'))}${this.button(`2  Água · ${c?.pocket?.water||0}/6`,()=>this.act('drink'))}${this.button('R  Descansar',()=>this.act('rest'))}</div><span>WASD mover · Shift correr · E interagir · Ctrl + clique atacar · P pausar</span></footer>${toast?`<div class="survival-toast ${this.message===current?'error':''}" role="status">${escape(current)}</div>`:''}`;
  }
  inventory(city,c,target){
    if(!c)return '';
    const food=(c.provisions||0)+(c.pocket?.food?.length||0),goods=Object.entries(c.inventory||{}).filter(([,q])=>q>0);
    const rows=[`<article class="survival-item"><span>Refeições / provisões <b>×${food}</b></span>${food?this.button('Comer',()=>this.act('eat')):'<small>Vazio</small>'}</article>`,`<article class="survival-item"><span>Garrafa <b>${c.pocket?.water||0}/6</b></span>${this.button('Beber',()=>this.act('drink'))}</article>`,...goods.map(([good,q])=>`<article class="survival-item"><span>${escape(city.economy.goods[good]?.label||good)} <b>×${q}</b></span>${city.nature.productsForFood(good)?this.button('Comer',()=>this.act('eat',{good})):''}</article>`)];
    const choices=target?interactionOptions(city,target):[];
    return `<div class="survival-inventory-grid"><div><div class="survival-section-label">CARREGANDO · ${inventoryUsed(c)}/${c.inventoryCapacity||'—'} itens</div>${rows.join('')}</div><div><div class="survival-section-label">AO ALCANCE</div>${target?`<h3>${escape(target.label)}</h3><small>${target.distance.toFixed(1)} metros</small>${choices.filter(choice=>['gather','service','sell','raw-water'].includes(choice.action)).map(choice=>this.button(choice.label,()=>this.use(target,choice))).join('')||'<p>Nenhum suprimento disponível aqui.</p>'}`:'<p>Nada ao alcance. Explore a cidade e aproxime-se de uma planta, entrada ou estabelecimento.</p>'}</div></div>`;
  }
  body(city,c){
    if(!c)return '';
    const injuries=c.combatInjuries||[];
    return `<div class="survival-body">${meters.map(([key,label])=>`<p><span>${label}</span><b>${Math.round(c.needs[key])}/100</b></p>`).join('')}</div><h3>Ferimentos</h3>${injuries.length?injuries.map(w=>`<article class="survival-log"><strong>${escape(w.region||'Ferimento')}</strong><p>Gravidade ${Math.round(w.severity||0)} · ${w.bleedingRate>0&&!w.bleedingStoppedAt?'Sangrando':'Sem sangramento ativo'}</p></article>`).join(''):'<p>Nenhum ferimento registrado.</p>'}<p>Procure atendimento próximo se estiver ferido. Descansar recupera energia, mas não substitui uma noite de sono.</p>`;
  }
  family(city,c){
    const people=relatives(city,c);
    return people.length?people.map(person=>`<article class="survival-log"><h3>${escape(name(person))}</h3><p>Saúde ${Math.round(person.needs.health)} · ${person.homeUnitId?'abrigado':'sem abrigo'}</p>${canControl(city,person)?this.button('Assumir controle',()=>this.act('switch',{citizenId:person.id})):'<small>Ocupado ou indisponível</small>'}</article>`).join(''):'<p>Nenhum familiar adulto disponível.</p>';
  }
}
