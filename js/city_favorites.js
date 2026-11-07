/** Player-owned presentation preferences. Simulation history remains worker-owned. */
export const FAVORITE_ICONS = ['★','♥','◆','●','▲','✚','⚑'];
export const FAVORITE_COLORS = ['#ffd84d','#ff7b7b','#7bdfff','#91e894','#d4a0ff','#ffffff'];
export const GOVERNMENT_TOPICS = {government:'Governo',election:'Eleições',policy:'Leis e políticas',construction:'Obras públicas',corruption:'Corrupção'};
export function governmentTopic(e){
  const action=e.data?.kind||e.data?.action||e.action||e.kind;
  if(/^(vote|in-person-vote|corruption-evidence|poll-response|interview|campaign-contact)$/.test(action))return null;
  if(e.electionId!=null||/election|mandate|inaugurat/.test(e.kind))return 'election';
  if(e.corruptionCaseId!=null||/corruption|scandal/.test(e.kind))return 'corruption';
  if(e.billId!=null||e.kind==='policy')return 'policy';
  if(e.projectId!=null&&e.accounts?.includes('treasury')&&/conclu|inaugur|bloque|cancel|aprova/i.test(e.message))return 'construction';
  if(e.kind==='government')return 'government';
  return null;
}
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
export class CityFavorites {
  constructor({city,desktop,root,storage,project}){
    Object.assign(this,{city,desktop,storage,project});this.people={};this.limit=20000;this.government=true;this.topics=Object.keys(GOVERNMENT_TOPICS);this.hidden=false;this.lastSignature='';
    try{const saved=JSON.parse(storage?.getItem('suburban.favorite-preferences')||'{}');this.limit=[0,20000,50000,100000,250000].includes(saved.limit)?saved.limit:20000;this.hidden=!!saved.hidden;this.government=saved.government!==false;this.topics=Array.isArray(saved.topics)?saved.topics.filter(t=>t in GOVERNMENT_TOPICS):this.topics;this.pendingWorld=saved;}catch{}
    this.root=el('aside',null,'favorite-hud');root.append(this.root);
    const bar=el('div',null,'favorite-bar');this.toggle=el('button');this.toggle.onclick=()=>{this.hidden=!this.hidden;this.persist();this.refresh(true);};const favorites=el('button','★ Favoritos');favorites.onclick=()=>this.open();const settings=el('button','Filtros');settings.onclick=()=>this.open('settings');bar.append(this.toggle,favorites,settings);
    this.feed=el('div',null,'favorite-feed');this.feed.setAttribute('aria-label','Histórico personalizado');this.feed.setAttribute('role','log');this.root.append(bar,this.feed);
    this.markers=el('div',null,'favorite-markers');root.append(this.markers);
    this.dialog=el('section',null,'favorite-dialog');this.dialog.hidden=true;this.dialog.setAttribute('aria-label','Pessoas favoritas e histórico');this.dialog.setAttribute('role','dialog');this.dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){this.dialog.hidden=true;favorites.focus();}});root.append(this.dialog);
    for(const control of [this.root,this.dialog]){for(const type of ['pointerdown','pointermove','pointerup','pointercancel','click','dblclick','contextmenu','keydown'])control.addEventListener(type,event=>event.stopPropagation());control.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});}
    this.worldKey=this.identity();if(this.pendingWorld?.world===this.worldKey)this.people=this.pendingWorld.people&&typeof this.pendingWorld.people==='object'&&!Array.isArray(this.pendingWorld.people)?this.pendingWorld.people:{};this.sanitize();this.sync();
  }
  identity(){return String(this.city.world?.seed??this.city.seed??'city')+':'+String(this.city.world?.width??'');}
  sanitize(){for(const [id,p] of Object.entries(this.people)){if(!/^\d+$/.test(id)||!p||typeof p!=='object'){delete this.people[id];continue;}p.icon=FAVORITE_ICONS.includes(p.icon)?p.icon:'★';p.color=typeof p.color==='string'&&/^#[0-9a-f]{6}$/i.test(p.color)?p.color:'#ffd84d';p.feed=p.feed!==false;}}
  sync(){this.city.history.configureFavorites(Object.keys(this.people).map(Number),this.limit);}
  persist(sync=false){try{this.storage?.setItem('suburban.favorite-preferences',JSON.stringify({world:this.worldKey,people:this.people,limit:this.limit,hidden:this.hidden,government:this.government,topics:this.topics}));}catch{}if(sync)this.sync();this.lastSignature='';}
  has(id){return !!this.people[id];}
  togglePerson(id){if(this.has(id))delete this.people[id];else this.people[id]={icon:'★',color:'#ffd84d',feed:true};this.persist(true);if(!this.dialog.hidden)this.open();}
  check(text,checked,change){const label=el('label'),input=el('input');input.type='checkbox';input.checked=checked;input.onchange=()=>change(input.checked);label.append(input,document.createTextNode(text));return label;}
  select(values,current,change){const select=el('select');for(const [id,label]of values){const option=el('option',label);option.value=id;select.append(option);}select.value=current;select.onchange=()=>change(select.value);return select;}
  open(tab='people'){
    this.dialog.hidden=false;this.dialog.replaceChildren();const heading=el('header'),title=el('strong','Favoritos e histórico'),close=el('button','Fechar');close.onclick=()=>this.dialog.hidden=true;heading.append(title,close);this.dialog.append(heading);
    const nav=el('nav');for(const [id,label]of [['people','Pessoas'],['settings','Filtros e retenção']]){const b=el('button',label);b.setAttribute('aria-pressed',tab===id);b.onclick=()=>this.open(id);nav.append(b);}this.dialog.append(nav);
    if(tab==='settings'){
      this.dialog.append(this.check('Acontecimentos importantes do governo',this.government,value=>{this.government=value;this.persist();}));
      for(const [id,label]of Object.entries(GOVERNMENT_TOPICS))this.dialog.append(this.check(label,this.topics.includes(id),value=>{this.topics=value?[...this.topics,id]:this.topics.filter(t=>t!==id);this.persist();}));
      const label=el('label','Histórico por favorito ');label.append(this.select([[20000,'20.000 registros (padrão)'],[50000,'50.000 registros'],[100000,'100.000 registros'],[250000,'250.000 registros'],[0,'Sem limite']],this.limit,value=>{this.limit=Number(value);this.persist(true);}));this.dialog.append(label,el('p','A retenção ampliada começa ao favoritar e recupera os eventos ainda disponíveis. Sem limite mantém os novos registros durante esta cidade e usa memória conforme o histórico cresce.'));
      return;
    }
    const search=el('input');search.type='search';search.placeholder='Buscar pessoa para favoritar…';search.setAttribute('aria-label','Buscar pessoas');const results=el('div');search.oninput=()=>{results.replaceChildren();if(!search.value.trim())return;for(const c of this.city.citizens.filter(c=>!c.entity.destroyed&&c.entity.properties.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())).slice(0,30)){const b=el('button',(this.has(c.id)?'★ ':'☆ ')+c.entity.properties.name);b.onclick=()=>this.togglePerson(c.id);results.append(b);}};this.dialog.append(search,results);
    if(!Object.keys(this.people).length)this.dialog.append(el('p','Favorite pela busca acima ou pelo botão na ficha de qualquer cidadão.'));
    for(const [id,pref]of Object.entries(this.people)){
      const c=this.city.society.citizen(Number(id)),row=el('article'),name=el('button',c?.entity.properties.name||`Pessoa #${id}`);
      name.onclick=()=>{if(c)this.desktop.setSelection(c.entity);};
      const icon=this.select(FAVORITE_ICONS.map(v=>[v,v]),pref.icon,value=>{pref.icon=value;this.persist();}),color=el('input');color.type='color';color.value=pref.color;color.oninput=()=>{pref.color=color.value;this.persist();};icon.setAttribute('aria-label','Ícone de '+name.textContent);color.setAttribute('aria-label','Cor de '+name.textContent);
      const history=el('button','Histórico');history.onclick=()=>this.desktop.openDestination('log','overview',{logCitizenId:Number(id),logLimit:200});const remove=el('button','Remover');remove.onclick=()=>this.togglePerson(Number(id));row.append(name,icon,color,this.check('No log de canto',pref.feed,value=>{pref.feed=value;this.persist();}),history,remove);this.dialog.append(row);
    }
  }
  refresh(force=false){
    const identity=this.identity();if(identity!==this.worldKey){this.worldKey=identity;this.people={};this.governmentEvents=new Map();this.feedCursor=0;this.persist(true);this.dialog.hidden=true;}
    this.toggle.textContent=this.hidden?'Mostrar histórico':'Ocultar histórico';this.feed.hidden=this.hidden;this.toggle.setAttribute('aria-expanded',String(!this.hidden));
    const history=this.city.history;this.governmentEvents??=new Map();if(history.nextId<(this.feedCursor||0)){this.governmentEvents.clear();this.feedCursor=0;}if(history.nextId!==this.feedCursor){for(const e of history.entries)if(e.id>=(this.feedCursor||0)&&governmentTopic(e))this.governmentEvents.set(e.id,e);while(this.governmentEvents.size>100)this.governmentEvents.delete(this.governmentEvents.keys().next().value);this.feedCursor=history.nextId;}
    const signature=[history.nextId,history.favoriteRevision,this.hidden,JSON.stringify(this.people),this.government,this.topics.join()].join(':');
    if(force||signature!==this.lastSignature){this.lastSignature=signature;if(!this.hidden){const events=new Map();for(const e of this.governmentEvents.values()){const topic=governmentTopic(e);if(this.government&&this.topics.includes(topic))events.set(e.id,e);}for(const [id,pref]of Object.entries(this.people))if(pref.feed)for(const e of (history.favoriteArchive.get(Number(id))||history.byCitizen.get(Number(id))||[]).slice(-30))events.set(e.id,e);const previousTop=this.feed.scrollTop,previousHeight=this.feed.scrollHeight;this.feed.replaceChildren();for(const e of [...events.values()].sort((a,b)=>b.id-a.id).slice(0,30)){const b=el('button',`D${Math.floor(e.minute/1440)+1} ${String(Math.floor(e.minute%1440/60)).padStart(2,'0')}:${String(Math.floor(e.minute%60)).padStart(2,'0')} · ${e.message}`);b.onclick=()=>this.desktop.openEvent(e.id,e);this.feed.append(b);}if(!events.size)this.feed.append(el('p','Nenhum acontecimento nos filtros escolhidos.'));if(previousTop>0)this.feed.scrollTop=previousTop+Math.max(0,this.feed.scrollHeight-previousHeight);}}
    this.markers.replaceChildren();for(const [id,pref]of Object.entries(this.people)){const c=this.city.society.citizen(Number(id));if(!c||c.entity.destroyed)continue;const pos=this.project(c);if(!pos?.visible)continue;const covered=!this.desktop.hidden&&this.desktop.manager.windows.some(w=>pos.x>=w.x&&pos.x<=w.x+w.w&&pos.y-18>=w.y&&pos.y-18<=w.y+(w.shaded?20:w.h));if(covered)continue;const marker=el('span',pref.icon);marker.style.color=pref.color;marker.style.left=pos.x+'px';marker.style.top=(pos.y-18)+'px';marker.setAttribute('aria-label','Favorito: '+c.entity.properties.name);this.markers.append(marker);}
  }
}
