import {CityUI,money} from './city_ui.js';
import {WindowManager} from './window_manager.js';
import {MANAGEMENT_THEME as T,bevel} from './management_ui.js';
import {tycoonIcon} from './tycoon_icons.js';
import {clipCanvasRegion} from './canvas_widgets.js';

export const CITY_WINDOWS=[['city','Cidade'],['government','Governo'],['people','Cidadãos'],['land','Terrenos e obras'],['buildings','Imóveis'],['economy','Empresas'],['production','Produção'],['transport','Transportes'],['sanitation','Saneamento'],['publications','Livros e panfletos'],['corruption','Corrupção'],['log','Histórico'],['map','Mapa da cidade']];
const sizes={election:[610,510],publications:[580,540],corruption:[570,480],map:[320,330],city:[680,470],government:[640,500],people:[390,480],land:[550,440],buildings:[350,440],economy:[410,480],production:[600,450],transport:[510,440],sanitation:[570,450],log:[530,450]};
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

/** OpenTTD-style desktop: directories, records and tools have independent windows. */
export class CityDesktop {
  constructor({city,root,select,camera,controls={}}){
    Object.assign(this,{city,select,camera,controls});this.manager=new WindowManager();this.hidden=false;this.tooltip=null;this.menuOpen=false;this.lastSelected=null;this.electionNotices=new Set();this.lastElectionResultId=city.politics.lastResult?.id??null;
    this.element=document.createElement('div');this.element.className='city-desktop-inputs';root.append(this.element);this.openModule('city');
    this.tooltipElement=document.createElement('div');this.tooltipElement.className='city-tooltip';this.tooltipElement.setAttribute('role','tooltip');this.tooltipElement.hidden=true;root.append(this.tooltipElement);
  }
  get visible(){return !this.hidden&&this.manager.windows.length>0;}
  get active(){return this.manager.active?.state;}
  get tab(){return this.active?.tab||'city';}
  get unitId(){return this.active?.unitId||null;}
  set unitId(id){if(this.active)this.active.unitId=id;}
  get selectedPlotId(){return this.active?.selectedPlotId||null;}
  get selected(){return this.active?.selected||null;}
  set notice(value){const state=this.manager.find('module:city')?.state;if(state)state.notice=value;}
  create(id,tab,{title=null,entity=null,unitId=null,kind='module'}={}){
    const existing=this.manager.find(id);if(existing){this.manager.raise(id);if(existing.shaded)this.manager.shade(id);this.hidden=false;return existing.state;}
    const state=new CityUI({city:this.city,root:this.element,select:this.select,camera:this.camera,host:this});state.tab=tab;
    const[w,h]=kind==='inspector'?[540,500]:kind==='dossier'?[470,520]:sizes[tab]||[460,420],near=this.manager.active;
    const window=this.manager.open({id,title:title||CITY_WINDOWS.find(t=>t[0]===tab)?.[1]||'Cidade',width:w,height:h,minWidth:kind==='dossier'?340:300,minHeight:200,state,near:kind==='dossier'||kind==='inspector'||kind==='section'?near:null});window.kind=kind;state.windowId=id;
    if(entity)state.setSelection(entity,unitId);this.hidden=false;
    for(const input of[state.search,state.seed,state.filterInput,state.sortInput,state.publicationDraft])input.addEventListener('pointerdown',()=>this.manager.raise(id));
    return state;
  }
  openSection(source,overrides={}){
    const tab=overrides.tab||source.tab,id=`section:${this.sectionSerial=(this.sectionSerial||0)+1}`;
    const dossier=!!source.selected&&tab===source.tab;
    const state=this.create(id,tab,{kind:dossier?'dossier':'section',entity:dossier?source.selected:null,unitId:dossier?source.unitId:null});
    // Copy the observer's choices, never the DOM, simulation objects or caches.
    for(const [key,value] of Object.entries(source))if(key!=='windowId'&&(/(?:Id|Tab|View|Page)$/.test(key)||['query','logCategory','logReference','logLive','logLimit','logKind','publicationContentType','publicCrop'].includes(key)))if(value===null||['string','number','boolean'].includes(typeof value))state[key]=value;
    for(const key of ['views','filters','sorts','scrolls','helpOpen','journalFilters','journalPages'])if(source[key])state[key]={...source[key]};
    state.tab=tab;state.selected=dossier?source.selected:null;Object.assign(state,overrides);state.sectionWindow=true;state.search.value=state.query||'';if(tab==='government'&&state.politicsTab==='promises')state.termId??=this.city.politics.mandates.current?.id??this.city.politics.mandates.terms.at(-1)?.id;
    if(source.eventSnapshot)state.eventSnapshot=source.eventSnapshot;
    const window=this.manager.find(id);window.title=state.sectionTitle();return state;
  }
  openElection(id,view='count'){
    const gov=this.city.politics,e=[gov.active,gov.lastResult,...gov.elections].find(e=>e?.id===id);if(!e)return;
    const label={polls:'Pesquisas eleitorais',count:'Votação e apuração',results:'Resultado eleitoral'}[view];
    const state=this.create(`election:${id}:${view}`,'election',{title:`${label} · eleição ${id}`});state.electionId=id;state.electionView=view;state.electionSnapshot=e;return state;
  }
  syncElectionNotices(){
    const gov=this.city.politics;
    if(this.lastElectionNoticeMinute!=null&&this.city.minute<this.lastElectionNoticeMinute){this.electionNotices.clear();this.lastElectionResultId=gov.lastResult?.id??null;}this.lastElectionNoticeMinute=this.city.minute;
    const active=gov.active;
    if(active){const view=active.status==='campaign'?'polls':['voting','counting'].includes(active.status)?'count':null,key=`${active.id}:${view}`;if(view&&!this.electionNotices.has(key)){this.electionNotices.add(key);this.openElection(active.id,view);}}
    if(gov.lastResult&&gov.lastResult.id!==this.lastElectionResultId){this.lastElectionResultId=gov.lastResult.id;this.openElection(gov.lastResult.id,'results');}
  }
  openEvent(id,snapshot=null){const state=this.create(`event:${id}`,'event',{title:`Inspetor do evento #${id}`,kind:'inspector'});state.selectedEventId=id;state.eventSnapshot??=snapshot||this.city.history.get(id);return state;}
  openCorruption(id){if(id==null)return this.openModule('corruption');const state=this.create(`corruption:${id}`,'corruption-case',{title:`Corrupção · caso #${id}`,kind:'inspector'});state.corruptionCaseId=id;state.corruptionSnapshot??=this.city.politics.corruption.find(r=>r.id===id)||this.city.politics.scandals.find(r=>r.id===id);return state;}
  toggleTool(id,tool){const current=this.manager.find(`tool:${id}`);if(current){this.close(current.id);return;}return this.openTool(id,tool);}
  openTool(id,tool){
    const existing=this.manager.find(`tool:${id}`);if(existing){this.manager.raise(existing.id);return existing.state;}
    const title=id==='options'?'Opções':'Editor de mapa',element=document.createElement('div');this.element.append(element);
    const state={tab:id,element,zones:[],drawFloating:(ui,w)=>{tool.floatingBounds={x:w.x,y:w.y,w:w.w,h:w.h-18};clipCanvasRegion(ui,w.x+3,w.y+26,w.w-6,w.h-44,()=>tool.draw(ui));},scrollAt:(x,y,d)=>tool.scrollAt(x,y,d),key:()=>false,onClose:()=>{tool.open=false;tool.floatingBounds=null;tool.bounds=null;tool.endStroke?.();}};
    const w=this.manager.open({id:`tool:${id}`,title,width:id==='options'?460:330,height:id==='options'?390:380,minWidth:300,minHeight:210,state});w.kind='tool';tool.open=true;this.hidden=false;return state;
  }
  toggleModule(tab){const current=this.manager.find(`module:${tab}`);if(current)return this.close(current.id);return this.openModule(tab);}
  openModule(tab){const state=this.create(`module:${tab}`,tab);state.visible=true;return state;}
  navigate(tab){return this.openModule(tab);}
  setView(id){this.active?.setView?.(id);}
  setFilter(id){this.active?.setFilter?.(id);}
  setSelection(entity,unitId=null){
    for(const window of this.manager.windows)window.state.selectedProjectId=null;
    if(!entity)this.lastSelected=null;
    if(entity?.properties?.cityPlant){const state=this.openModule('city');state.setView('nature');state.selectedPlantId=entity.id;this.lastSelected=entity;return;}
    if(!entity)return;const citizen=entity.properties?.citizen,building=entity.properties?.cityBuilding;if(!citizen&&!building)return;
    const state=this.create(`${citizen?'person':'building'}:${entity.id}`,citizen?'people':'buildings',{title:entity.properties.name,entity,unitId,kind:'dossier'});
    if(unitId){state.unitId=unitId;state.detailTab='units';}this.lastSelected=entity;
  }
  setPlotSelection(id){const state=this.openModule('land');state.selectedPlotId=id;state.setView('plots');return state;}
  toggle(){if(!this.manager.windows.length){this.openModule('city');return;}this.hidden=!this.hidden;this.element.hidden=this.hidden;}
  close(id){const w=this.manager.close(id);if(w){w.state.onClose?.();w.state.element.remove?.();w.state.visible=false;}return w;}
  closeAll(all=false){for(const w of [...this.manager.windows])if(all||!w.pinned)this.close(w.id);}
  pointerDown(x,y){if(this.menuOpen){const b=this.menuBounds;if(b&&x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h)return false;this.menuOpen=false;}if(!this.visible)return false;const w=this.manager.at(x,y);const z=w&&!this.manager.resizeAt(w,x,y)&&!w.shaded&&w.state.zones?.find(z=>z.max>0&&x>=z.x+z.w-12&&x<=z.x+z.w&&y>=z.y&&y<=z.y+z.h);if(z){this.manager.raise(w.id);const thumb=Math.max(16,z.h*z.h/(z.h+z.max));this.scrollGesture={id:w.id,key:z.key,y,start:w.state.scrolls[z.key]||0,max:z.max,track:Math.max(1,z.h-thumb)};return true;}if(w?.state.selected&&w.state.selected!==this.lastSelected){this.lastSelected=w.state.selected;this.select(w.state.selected,w.state.unitId);}return this.manager.pointerDown(x,y);}
  pointerMove(x,y){if(this.scrollGesture){const g=this.scrollGesture,w=this.manager.find(g.id);if(w)w.state.scrolls[g.key]=Math.max(0,Math.min(g.max,g.start+(y-g.y)/g.track*g.max));return true;}return this.manager.pointerMove(x,y);}
  pointerUp(){const scroll=!!this.scrollGesture;this.scrollGesture=null;return this.manager.pointerUp()||scroll;}
  doubleClick(x,y){const w=this.manager.at(x,y);if(w&&this.manager.caption(w,x,y)){this.manager.shade(w.id);return true;}return false;}
  scrollAt(x,y,delta){if(this.menuOpen&&this.menuBounds){const b=this.menuBounds;if(x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h){this.menuScroll=Math.max(0,Math.min(b.max,(this.menuScroll||0)+delta));return true;}}if(!this.visible)return false;const w=this.manager.at(x,y);return w?!w.shaded&&(w.state.scrollAt(x,y,delta)||true):false;}
  key(event){
    if(event.code==='KeyC'&&!event.repeat){this.openModule('city');return true;}
    if(event.code==='Tab'&&this.manager.windows.length>1){this.manager.raise((event.shiftKey?this.manager.windows.at(-2):this.manager.windows[0]).id);return true;}
    if(event.code==='Delete'){this.closeAll(!!event.shiftKey);return true;}
    if(!this.visible)return false;
    if(event.code==='Escape'&&this.menuOpen){this.menuOpen=false;return true;}
    if(event.code==='Escape'){const w=[...this.manager.windows].reverse().find(w=>!w.pinned);if(w)this.close(w.id);return true;}
    if(event.code==='Slash'){this.active?.search?.focus?.();return true;}
    if(['PageDown','PageUp','Home','End','Backspace'].includes(event.code))return this.active?.key(event)||false;return false;
  }
  drawChrome(ui,{clockText='',paused=false,speed=1,renderMode='3d'}={}){
    this.manager.viewport(ui.width,ui.height);this.tooltip=null;bevel(ui.ctx,0,0,ui.width,34,{fill:'#b4b4a4'});
    const buttons=[['pause',paused?'Continuar':'Pausar',this.controls.pause,paused],['fast',`Velocidade ${speed}×`,this.controls.speed],['settings','Opções',this.controls.options],...CITY_WINDOWS.map(([id,label])=>[id,label,()=>this.toggleModule(id),this.manager.windows.some(w=>w.id===`module:${id}`)]),['center','Centralizar mapa',this.controls.center],['editor','Editor de mapa',this.controls.editor],['windows','Organizar janelas',()=>{this.menuOpen=!this.menuOpen;},this.menuOpen],['3d','Vista 3D',()=>this.controls.render?.('3d'),renderMode==='3d'],['2d','Vista 2D',()=>this.controls.render?.('2d'),renderMode==='2d']];
    const size=30,max=Math.max(1,Math.floor((ui.width-8)/size));
    this.toolbarButtons=buttons;const shown=max>=buttons.length?buttons:buttons.slice(0,Math.max(1,max-1)).concat([['windows','Todas as ferramentas',()=>{this.menuOpen=!this.menuOpen;},this.menuOpen]]);
    let x=Math.max(4,Math.floor((ui.width-shown.length*size)/2));
    for(const[icon,label,click,selected]of shown){ui.button(x,2,size-1,30,'',click||(()=>{}),{selected});const s=1.5;tycoonIcon(ui.ctx,icon,x+(size-16*s)/2,5,s);ui.regions.at(-1).label=label;if(ui.pointer?.x>=x&&ui.pointer.x<x+size&&ui.pointer.y>=0&&ui.pointer.y<34)this.tooltip={text:label,x,y:36};x+=size;}
    const y=ui.height-27;bevel(ui.ctx,0,y,ui.width,27,{fill:'#b4b4a4'});const s=this.city.stats();ui.text(clockText,10,y+6,T.ink);
    if(ui.width>580)ui.text(`${s.population} habitantes  |  ${paused?'Pausado':speed+'×'}  |  ${this.manager.windows.length} janelas`,Math.max(160,Math.floor(ui.width/2)-180),y+6,T.ink);
    const cash=money(this.city.treasury);ui.text(cash,ui.width-ui.textWidth(cash)-12,y+6,T.ink);
  }
  frame(ui,w){
    const r=this.manager.rect(w),active=this.manager.activeId===w.id,ctx=ui.ctx;ctx.save();ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(r.x+3,r.y+3,r.w,r.h);ctx.restore();bevel(ctx,r.x,r.y,r.w,r.h,{fill:'#c6c6b1'});
    ui.regions.push({...r,onClick:()=>this.manager.raise(w.id)});
    bevel(ctx,w.x+1,w.y+1,w.w-2,24,{fill:active?'#537a9e':'#9b9e8c'});
    if(w.state.sectionWindow)w.title=w.state.sectionTitle();
    const title=w.title;ctx.save();ctx.beginPath();ctx.rect(w.x+8,w.y+3,w.w-114,20);ctx.clip();ctx.font=ui.font(1,true);ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillStyle=active?'#ffffff':'#222a24';ctx.fillText(title,w.x+8,w.y+13);ctx.restore();
    ui.regions.push({x:w.x+4,y:w.y+2,w:w.w-108,h:22,onClick:()=>this.manager.raise(w.id),label:`Mover: ${title}`});
    ui.button(w.x+w.w-101,w.y+2,24,22,w.pinned?'●':'○',()=>this.manager.pin(w.id),{selected:w.pinned});ui.regions.at(-1).label=`Fixar: ${title}`;
    ui.button(w.x+w.w-76,w.y+2,24,22,w.shaded?'▣':'−',()=>this.manager.shade(w.id));ui.regions.at(-1).label=`Recolher: ${title}`;
    ui.button(w.x+w.w-51,w.y+2,24,22,w.maximized?'↙':'↗',()=>this.manager.maximize(w.id));ui.regions.at(-1).label=`Ampliar: ${title}`;
    ui.button(w.x+w.w-26,w.y+2,24,22,'×',()=>this.close(w.id));ui.regions.at(-1).label=`Fechar: ${title}`;
    if(!w.shaded){if(w.state.tab==='map')this.drawMap(ui,w);else w.state.drawFloating(ui,w);if(!w.maximized){const handle=this.manager.resizeHandle(w);ctx.fillStyle=T.muted;for(let i=0;i<3;i++)ctx.fillRect(handle.x+handle.w-3-i*4,handle.y+handle.h-3-i*4,2,2+i*4);ui.regions.push({...handle,label:`Redimensionar: ${title}`,onClick:null});}ui.text(w.pinned?'Fixada':'',w.x+6,w.y+w.h-17,T.muted);}
    else {w.state.element.hidden=true;w.state.zones=[];}
  }
  draw(ui){
    this.syncElectionNotices();
    const point=ui.pointer,hover=point&&this.manager.at(point.x,point.y),resize=hover&&this.manager.resizeAt(hover,point.x,point.y);if(ui.canvas.style)ui.canvas.style.cursor=this.manager.gesture?.kind==='resize'||resize?'nwse-resize':this.manager.gesture?.kind==='move'||hover&&this.manager.caption(hover,point.x,point.y)?'move':'default';
    this.element.hidden=!this.visible;if(this.visible){for(const [i,w] of this.manager.windows.entries()){const rect=this.manager.rect(w),covered=this.manager.windows.slice(i+1).some(above=>{const r=this.manager.rect(above);return r.x<=rect.x&&r.y<=rect.y&&r.x+r.w>=rect.x+rect.w&&r.y+r.h>=rect.y+rect.h;});if(covered){w.state.element.hidden=true;w.state.zones=[];continue;}w.state.element.hidden=false;this.frame(ui,w);}this.occludeInputs();const hit=point&&ui.hitTest(point.x,point.y);if(hit?.label){const key=hit.label;if(this.hoverHint?.key!==key)this.hoverHint={key,since:performance.now()};if(/^(Fechar|Fixar|Recolher|Ampliar|Redimensionar):/.test(key)||performance.now()-this.hoverHint.since>600)this.tooltip={text:key,x:point.x,y:point.y+24};}else this.hoverHint=null;}
    if(this.menuOpen){for(const w of this.manager.windows)for(const input of[w.state.search,w.state.seed,w.state.filterInput,w.state.sortInput,w.state.publicationDraft].filter(Boolean))input.hidden=true;this.drawMenu(ui);}
    this.tooltipElement.hidden=!this.tooltip||this.menuOpen||!!this.manager.gesture;
    if(!this.tooltipElement.hidden){const {text,x,y}=this.tooltip,w=Math.min(440,ui.width-8,Math.ceil(ui.textWidth(text))+18);this.tooltipElement.textContent=text;Object.assign(this.tooltipElement.style,{left:`${Math.max(4,Math.min(x,ui.width-w-4))}px`,top:`${Math.max(0,Math.min(y,ui.height-190))}px`,width:`${w}px`});}
  }
  drawMap(ui,w){
    const state=w.state,world=this.city.world;state.zones=[];for(const input of[state.search,state.seed,state.filterInput,state.sortInput,state.publicationDraft])input.hidden=true;
    this.mapCanvas??=document.createElement('canvas');
    if(this.mapRevision!==world.revision||this.mapCanvas.width!==world.width){
      this.mapCanvas.width=world.width;this.mapCanvas.height=world.height;const ctx=this.mapCanvas.getContext('2d'),colors=['#7b9748','#4776a3','#66786a','#baad76','#adaba1','#263f49','#797965','#92905d','#797b65','#8caa61','#ae9c73','#5d705c','#a6a88a','#67805d'];
      for(let y=0;y<world.height;y++)for(let x=0;x<world.width;x++){ctx.fillStyle=colors[world.getTile(x,y)]||'#748d51';ctx.fillRect(x,y,1,1);}this.mapRevision=world.revision;
    }
    const size=Math.min(w.w-20,w.h-85),x=w.x+(w.w-size)/2,y=w.y+34;bevel(ui.ctx,x-2,y-2,size+4,size+4,{inset:true});ui.ctx.save();ui.ctx.imageSmoothingEnabled=false;ui.ctx.drawImage(this.mapCanvas,x,y,size,size);ui.ctx.restore();
    for(const b of this.city.buildings){ui.ctx.fillStyle=b.type==='residential'?'#f6e8aa':'#e47f56';ui.ctx.fillRect(x+b.entity.x/world.width*size,y+b.entity.y/world.height*size,Math.max(2,b.width/world.width*size),Math.max(2,b.depth/world.height*size));}
    for(const c of this.city.citizens){ui.ctx.fillStyle='#'+(c.entity.properties.render.color&0xffffff).toString(16).padStart(6,'0');ui.ctx.fillRect(x+c.entity.x/world.width*size,y+c.entity.y/world.height*size,2,2);}
    ui.regions.push({x,y,w:size,h:size,label:'Navegar no mapa',onClick:point=>{if(point)this.camera(Math.max(0,Math.min(world.width,(point.x-x)/size*world.width)),Math.max(0,Math.min(world.height,(point.y-y)/size*world.height)));}});
    ui.text('Clique para centralizar a câmera.',w.x+9,y+size+10,T.ink);
  }
  occludeInputs(){
    const windows=this.manager.windows;
    windows.forEach((w,i)=>{for(const input of[w.state.search,w.state.seed,w.state.filterInput,w.state.sortInput,w.state.publicationDraft].filter(Boolean)){
      if(input.hidden)continue;const rect={x:parseFloat(input.style.left),y:parseFloat(input.style.top),w:parseFloat(input.style.width),h:20};let visible=[rect];
      for(const above of windows.slice(i+1)){
        const cover=this.manager.rect(above);visible=visible.flatMap(part=>{
          if(!intersects(part,cover))return[part];const x=Math.max(part.x,cover.x),y=Math.max(part.y,cover.y),right=Math.min(part.x+part.w,cover.x+cover.w),bottom=Math.min(part.y+part.h,cover.y+cover.h);
          return[{x:part.x,y:part.y,w:part.w,h:y-part.y},{x:part.x,y:bottom,w:part.w,h:part.y+part.h-bottom},{x:part.x,y,w:x-part.x,h:bottom-y},{x:right,y,w:part.x+part.w-right,h:bottom-y}].filter(r=>r.w>0&&r.h>0);
        });
      }
      if(!visible.length)input.hidden=true;
      else if(visible.length!==1||visible[0].w!==rect.w||visible[0].h!==rect.h){const path=visible.map(r=>`M ${r.x-rect.x} ${r.y-rect.y} h ${r.w} v ${r.h} h ${-r.w} Z`).join(' ');input.style.clipPath=`path("${path}")`;}
    }});
  }
  drawMenu(ui){
    const width=Math.min(330,ui.width-12),height=Math.min(ui.height-78,90+this.toolbarButtons.length*29),x=ui.width-width-6,y=46;bevel(ui.ctx,x,y,width,height);ui.regions.push({x,y,w:width,h:height,onClick:null});
    const actions=[['Organizar em cascata',()=>this.manager.cascade()],['Fechar não fixadas (Del)',()=>this.closeAll()],['Fechar todas (Shift+Del)',()=>this.closeAll(true)],...this.toolbarButtons.filter(b=>b[0]!=='windows').map(([,label,click])=>[label,click])];
    this.menuScroll=Math.max(0,Math.min(this.menuScroll||0,Math.max(0,actions.length*29-height+8)));
    const start=ui.regions.length;ui.ctx.save();ui.ctx.beginPath();ui.ctx.rect(x+3,y+3,width-6,height-6);ui.ctx.clip();
    actions.forEach(([label,click],i)=>{const py=y+4+i*29-this.menuScroll;if(py+27>y&&py<y+height)ui.button(x+4,py,width-8,27,label,()=>{click?.();this.menuOpen=false;});});ui.ctx.restore();
    const rows=ui.regions.splice(start);for(const r of rows){const top=Math.max(y+3,r.y),bottom=Math.min(y+height-3,r.y+r.h);if(bottom>top)ui.regions.push({...r,y:top,h:bottom-top});}this.menuBounds={x,y,w:width,h:height,max:Math.max(0,actions.length*29-height+8)};
  }
}
