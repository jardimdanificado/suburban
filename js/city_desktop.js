import {desktopMenus} from './city_desktop_menus.js';
import {CityUI,money} from './city_ui.js';
import {WindowManager} from './window_manager.js';
import {MANAGEMENT_THEME as T,bevel} from './management_ui.js';
import {tycoonIcon} from './tycoon_icons.js';
import {clipCanvasRegion} from './canvas_widgets.js';

export const CITY_WINDOWS=[['city','Cidade'],['government','Governo'],['people','Cidadãos'],['land','Terrenos e obras'],['buildings','Imóveis'],['economy','Empresas'],['market','Mercado e riquezas'],['production','Produção'],['transport','Transportes'],['sanitation','Saneamento'],['publications','Jornais e livros'],['corruption','Corrupção'],['log','Histórico'],['map','Mapa da cidade']];
const sizes={market:[700,500],party:[560,570],contract:[530,500],'poll-response':[560,560],'party-organization':[560,500],election:[610,510],publications:[580,540],corruption:[570,480],map:[320,330],city:[680,470],government:[640,500],people:[390,480],land:[550,440],buildings:[350,440],economy:[410,480],production:[600,450],transport:[510,440],sanitation:[570,450],log:[530,450]};
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

/** OpenTTD-style desktop with tabbed modules and optional detached views. */
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
    for(const input of[state.search,state.seed,state.populationInput,state.filterInput,state.sortInput,state.publicationDraft])input.addEventListener('pointerdown',()=>this.manager.raise(id));
    return state;
  }
  openPanel(source,overrides={},{separate=false}={}){
    const tab=overrides.tab||source.tab,properties={};
    for(const [key,value] of Object.entries(source))if(key!=='windowId'&&(/(?:Id|Tab|View)$/.test(key)||['logCategory','logReference','logLive','logKind','publicCrop','recordWindow','employmentStatus','employmentPage','employmentCandidatesPage','employmentApplicationAt'].includes(key)))if(value===null||['string','number','boolean'].includes(typeof value))properties[key]=value;
    properties.filters={...source.filters,...overrides.filters};properties.sorts={...source.sorts};properties.views={...source.views,...overrides.views};Object.assign(properties,overrides);properties.tab=tab;
    if(!separate){
      const sameWindow=source.windowId&&tab===source.tab;
      const state=sameWindow?source:this.openModule(tab);
      if(sameWindow)state.remember();
      Object.assign(state,properties);state.resetScroll();state.search.value=state.query;
      const window=this.manager.find(state.windowId);if(window&&window.kind!=='module')window.title=state.sectionTitle();
      return state;
    }
    const dossier=!!source.selected&&tab===source.tab,entity=dossier?source.selected:null;
    const view=properties.views[tab]||'overview',politics=properties.politicsTab||'overview';
    const keys=entity?['detailTab','memoryView']:tab==='government'&&view==='elections'?['politicsTab',...(politics==='approval'?['approvalView']:politics==='council'?['councilView','billId']:politics==='promises'?['termId','mandateView']:politics==='polls'?['electionId','pollId']:['institutes','research-services'].includes(politics)?['studyId','researchServiceType']:[])]:tab==='election'?['electionId','electionView','electionDetailView']:tab==='event'?['selectedEventId','eventTab']:tab==='corruption-case'?['corruptionCaseId','corruptionTab']:tab==='poll-response'?['electionId','pollId','pollResponseCitizenId']:tab==='log'?['logReference','logCitizenId','logBuildingId','logAccountId','logCategory']:tab==='market'?['wealthAccountId','wealthLocationId','wealthGoodId','marketSaleId']:tab==='economy'?['employmentCompanyId','employmentCitizenId','employmentApplicationAt','employmentStatus','employmentPage','employmentCandidatesPage']:tab==='production'?['demandTab']:tab==='party-organization'?['partyOrganizationView','partyProposalId']:tab==='publications'?['selectedPublicationId','publicationTab','publicationSourceEventId']:tab==='land'?['selectedPlotId']:['partyId','projectId','contractPlotId'];
    const defaults={approvalView:'summary',councilView:'bills',mandateView:'promise',eventTab:'summary',corruptionTab:'summary',detailTab:'profile',demandTab:'opportunities'};for(const key of keys)if(properties[key]==null&&defaults[key])properties[key]=defaults[key];
    this.detachedSerial=(this.detachedSerial||0)+1;
    const id=`panel:${this.detachedSerial}:${JSON.stringify([tab,view,entity?.id??null,properties.filters?.[tab]||'all',...keys.map(key=>properties[key]??null)])}`;
    const existing=this.manager.find(id);if(existing){this.manager.raise(id);if(existing.shaded)this.manager.shade(id);this.hidden=false;return existing.state;}
    const state=this.create(id,tab,{kind:dossier?'dossier':'section',entity,unitId:dossier?source.unitId:null});
    Object.assign(state,properties);state.selected=entity;state.sectionWindow=true;state.scrolls={...source.scrolls};state.query=source.query||'';state.search.value=state.query;
    state.seed.value=source.seed?.value??state.seed.value;state.populationInput.value=source.populationInput?.value??state.populationInput.value;
    state.publicationDraft.value=source.publicationDraft?.value??state.publicationDraft.value;
    if(source.frozenEvents)state.frozenEvents=[...source.frozenEvents];
    if(source.eventSnapshot)state.eventSnapshot=source.eventSnapshot;if(source.electionSnapshot)state.electionSnapshot=source.electionSnapshot;
    const window=this.manager.find(id);window.title=state.sectionTitle();return state;
  }
  openDestination(tab,view='overview',overrides={}){return this.openPanel({tab,views:{[tab]:view},filters:{[tab]:'all'},sorts:{}},overrides);}
  setMenu(id){this.menuOpen=true;this.menuId=id;this.menuScroll=0;this.menuIndex=-1;this.menuKeyboard=false;this.menuBounds=null;}
  closeMenu(){this.menuOpen=false;this.menuBounds=null;this.menuIndex=-1;}
  toggleMenu(id){if(this.menuOpen&&this.menuId===id)this.closeMenu();else this.setMenu(id);}
  menuItems(){const group=this.menuGroups?.find(g=>g.id===this.menuId);return typeof group?.items==='function'?group.items():group?.items||[];}
  activateMenu(item){if(!item||item.separator||item.disabled?.())return;this.closeMenu();item.click?.();}
  menuKey(event){
    if(!this.menuOpen)return false;const code=event.code;
    if(code==='Escape'){this.closeMenu();return true;}
    if(['ArrowLeft','ArrowRight','Tab'].includes(code)){const groups=this.menuGroups,index=groups.findIndex(g=>g.id===this.menuId);this.setMenu(groups[(index+(code==='ArrowRight'||code==='Tab'&&!event.shiftKey?1:groups.length-1))%groups.length].id);return true;}
    const items=this.menuItems(),available=items.map((item,index)=>!item.separator&&!item.disabled?.()?index:null).filter(i=>i!=null);
    if(['ArrowDown','ArrowUp','Home','End'].includes(code)){
      const index=available.indexOf(this.menuIndex);this.menuIndex=code==='Home'?available[0]:code==='End'?available.at(-1):index<0?(code==='ArrowDown'?available[0]:available.at(-1)):available[(index+(code==='ArrowDown'?1:available.length-1))%available.length];this.menuKeyboard=true;
      const top=items.slice(0,this.menuIndex).reduce((n,item)=>n+(item.separator?8:24),0),height=(this.menuBounds?.h||300)-8;
      if(top<this.menuScroll)this.menuScroll=top;else if(top+24>this.menuScroll+height)this.menuScroll=top+24-height;return true;
    }
    if(code==='Enter'||code==='Space'){this.activateMenu(items[this.menuIndex>=0?this.menuIndex:available[0]]);return true;}return false;
  }
  openParty(id){const party=this.city.politics.party(id);if(!party)return;const state=this.create(`party:${id}`,'party',{title:`${party.short} · ${party.name}`,kind:'section'});state.partyId=id;return state;}
  openContract(id){const project=this.city.development.projects.find(p=>p.id===id);if(!project)return;const state=this.create(`contract:${id}`,'contract',{title:`Contrato · ${project.name}`,kind:'section'});state.projectId=id;return state;}
  openElection(id,view='count'){
    const gov=this.city.politics,e=[gov.active,gov.lastResult,...gov.elections].find(e=>e?.id===id);if(!e)return;
    const state=this.create(`election:${id}`,'election',{title:`Eleição ${id} · ${e.round||1}º turno`});state.electionId=id;state.electionView=view;state.electionSnapshot=e;return state;
  }
  syncElectionNotices(){
    const gov=this.city.politics;
    if(this.lastElectionNoticeMinute!=null&&this.city.minute<this.lastElectionNoticeMinute){this.electionNotices.clear();this.lastElectionResultId=gov.lastResult?.id??null;}this.lastElectionNoticeMinute=this.city.minute;
    const active=gov.active;
    if(active){const view=['campaign','scheduled'].includes(active.status)?'polls':['voting','counting'].includes(active.status)?'count':null,key=`${active.id}:${view}`;if(view&&!this.electionNotices.has(key)){this.electionNotices.add(key);this.openElection(active.id,view);}}
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
    if(!entity)return;const citizen=entity.properties?.citizen,building=entity.properties?.cityBuilding;if(!citizen&&!building&&!entity.properties?.cityVehicle)return;
    if(entity.properties.cityVehicle){const state=this.create(`vehicle:${entity.id}`,'transport',{title:entity.properties.name,entity,kind:'dossier'});this.lastSelected=entity;return;}
    const state=this.create(`${citizen?'person':'building'}:${entity.id}`,citizen?'people':'buildings',{title:entity.properties.name,entity,unitId,kind:'dossier'});
    if(unitId){state.unitId=unitId;state.detailTab='units';}this.lastSelected=entity;
  }
  setPlotSelection(id){const state=this.create(`plot:${id}`,'land',{title:`Terreno ${id}`,kind:'section'});state.selectedPlotId=id;state.recordWindow=true;state.setView('plots');return state;}
  toggle(){if(!this.manager.windows.length){this.openModule('city');return;}this.hidden=!this.hidden;this.element.hidden=this.hidden;}
  close(id){const w=this.manager.close(id);if(w){w.state.onClose?.();w.state.element.remove?.();w.state.visible=false;}return w;}
  closeAll(all=false){for(const w of [...this.manager.windows])if(all||!w.pinned)this.close(w.id);}
  pointerDown(x,y){
    if(this.menuOpen){const b=this.menuBounds,toolbarButton=this.menuBarRegions?.some(r=>r.onClick&&x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);if(toolbarButton||b&&x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h)return false;this.closeMenu();this.menuDismissGesture=true;return true;}
    if(!this.visible)return false;const w=this.manager.at(x,y),z=w&&!this.manager.resizeAt(w,x,y)&&!w.shaded&&w.state.zones?.find(z=>z.max>0&&x>=z.x+z.w-12&&x<=z.x+z.w&&y>=z.y&&y<=z.y+z.h);
    if(z){this.manager.raise(w.id);const thumb=Math.max(16,z.h*z.h/(z.h+z.max));this.scrollGesture={id:w.id,key:z.key,y,start:w.state.scrolls[z.key]||0,max:z.max,track:Math.max(1,z.h-thumb)};return true;}
    if(w?.state.selected&&w.state.selected!==this.lastSelected){this.lastSelected=w.state.selected;this.select(w.state.selected,w.state.unitId);}return this.manager.pointerDown(x,y);
  }
  pointerMove(x,y){
    if(this.menuOpen){this.menuKeyboard=false;const anchor=this.menuAnchors?.find(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);if(anchor&&anchor.id!==this.menuId)this.setMenu(anchor.id);return true;}
    if(this.scrollGesture){const g=this.scrollGesture,w=this.manager.find(g.id);if(w)w.state.scrolls[g.key]=Math.max(0,Math.min(g.max,g.start+(y-g.y)/g.track*g.max));return true;}return this.manager.pointerMove(x,y);
  }
  pointerUp(){if(this.menuDismissGesture){this.menuDismissGesture=false;return true;}const scroll=!!this.scrollGesture;this.scrollGesture=null;return this.manager.pointerUp()||scroll;}
  rightClick(x,y){
    if(this.menuOpen){this.closeMenu();return true;}
    if(!this.visible)return false;const window=this.manager.at(x,y);if(!window)return false;
    this.close(window.id);return true;
  }
  doubleClick(x,y){const w=this.manager.at(x,y);if(w&&this.manager.caption(w,x,y)){this.manager.shade(w.id);return true;}return false;}
  scrollAt(x,y,delta){
    if(this.menuOpen){const b=this.menuBounds;if(b&&x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h)this.menuScroll=Math.max(0,Math.min(b.max,(this.menuScroll||0)+delta));return true;}
    if(!this.visible)return false;const w=this.manager.at(x,y);return w?!w.shaded&&(w.state.scrollAt(x,y,delta)||true):false;
  }
  key(event){
    if(this.menuKey(event))return true;
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
    this.chromeState={clockText,paused,speed,renderMode};this.menuGroups??=desktopMenus(this);this.tooltip=null;this.menuAnchors=[];
    let x=4,barY=2;const controls=[[paused?'play':'pause',paused?'Continuar':'Pausar',this.controls.pause,paused],['fast',`Velocidade ${speed}×`,this.controls.speed,false]];
    const entries=[
      ...controls.map(([icon,label,click,selected])=>({icon,label,click:()=>{this.closeMenu();click?.();},selected,w:29})),
      ...CITY_WINDOWS.map(([tab,label])=>({label,icon:tab,w:29,click:()=>{this.closeMenu();this.toggleModule(tab);},selected:!this.hidden&&!!this.manager.find(`module:${tab}`)})),
      ...this.menuGroups.map(g=>({id:g.id,label:g.label,icon:g.id==='tools'?'settings':'windows',w:36,click:()=>this.toggleMenu(g.id),selected:this.menuOpen&&this.menuId===g.id}))
    ];
    const placed=[];for(const entry of entries){if(x>4&&x+entry.w>ui.width-4){x=4;barY+=30;}placed.push({...entry,x,y:barY});x+=entry.w+2;}
    for(const rowY of new Set(placed.map(entry=>entry.y))){const row=placed.filter(entry=>entry.y===rowY),end=Math.max(...row.map(entry=>entry.x+entry.w)),offset=Math.max(0,Math.floor((ui.width-end-4)/2));for(const entry of row)entry.x+=offset;}
    const barHeight=barY+32;this.manager.top=barHeight;this.manager.viewport(ui.width,ui.height);bevel(ui.ctx,0,0,ui.width,barHeight,{fill:T.face});
    // Registered after window content as well, so the menu bar remains above all panels.
    const barRegion={x:0,y:0,w:ui.width,h:barHeight,onClick:null};this.menuBarRegions=[barRegion];ui.regions.push(barRegion);
    for(const entry of placed){ui.button(entry.x,entry.y,entry.w,28,'',entry.click||(()=>{}),{selected:entry.selected});
      tycoonIcon(ui.ctx,entry.icon,entry.x+4,entry.y+5,1);
      if(entry.id){const ax=entry.x+entry.w-10,ay=entry.y+18;ui.ctx.fillStyle=T.ink;for(let i=0;i<3;i++)ui.ctx.fillRect(ax+i,ay+i,5-i*2,1);this.menuAnchors.push({id:entry.id,x:entry.x,y:entry.y,w:entry.w,h:28});}
      if(ui.pointer?.x>=entry.x&&ui.pointer.x<entry.x+entry.w&&ui.pointer.y>=entry.y&&ui.pointer.y<entry.y+28)this.tooltip={text:entry.id?`${entry.label} ▾`:entry.label,x:entry.x,y:barHeight+3};
      ui.regions.at(-1).label=entry.id?`${entry.label} — menu`:entry.label;this.menuBarRegions.push(ui.regions.at(-1));
    }
    const y=ui.height-27;bevel(ui.ctx,0,y,ui.width,27,{fill:T.face});const s=this.city.stats(),cash=money(this.city.treasury),cashW=Math.min(190,ui.width*.42,Math.max(120,ui.textWidth(cash)+26)),dateW=Math.min(225,ui.width-cashW-12,Math.max(120,ui.textWidth(clockText)+24));
    bevel(ui.ctx,3,y+3,dateW,21,{inset:true,fill:T.paper});ui.text(ui.fitText(clockText,dateW-14),10,y+7,T.ink);
    const right=ui.width-cashW-3;bevel(ui.ctx,right,y+3,cashW,21,{inset:true,fill:T.paper});const shownCash=ui.fitText(cash,cashW-16);ui.text(shownCash,right+cashW-ui.textWidth(shownCash)-8,y+7,T.ink);
    const middle=right-dateW-12;if(middle>80){bevel(ui.ctx,dateW+6,y+3,middle,21,{inset:true,fill:T.paper});const status=paused?'Pausado':`${s.population} habitantes · ${speed}× · ${this.manager.windows.length} janelas`;ui.text(ui.fitText(status,middle-12),dateW+12,y+7,paused?T.red:T.ink);}

  }
  frame(ui,w){
    const r=this.manager.rect(w),active=this.manager.activeId===w.id,ctx=ui.ctx;ctx.save();ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(r.x+3,r.y+3,r.w,r.h);ctx.restore();bevel(ctx,r.x,r.y,r.w,r.h,{fill:T.face});
    ui.regions.push({...r,onClick:()=>this.manager.raise(w.id)});
    bevel(ctx,w.x+1,w.y+1,w.w-2,20,{fill:active?T.header:T.inactiveHeader});
    if(w.state.sectionWindow)w.title=w.state.sectionTitle();
    const title=w.title;ctx.save();ctx.beginPath();ctx.rect(w.x+5,w.y+3,w.w-92,16);ctx.clip();ctx.font=ui.font(1,true);ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillStyle=T.captionInk;ctx.fillText(title,w.x+5+(w.w-92)/2,w.y+11);ctx.restore();
    ui.regions.push({x:w.x+4,y:w.y+2,w:w.w-88,h:18,onClick:()=>this.manager.raise(w.id),label:`Mover: ${title}`});
    ui.button(w.x+w.w-83,w.y+2,20,18,w.pinned?'●':'○',()=>this.manager.pin(w.id),{selected:w.pinned});ui.regions.at(-1).label=`Fixar: ${title}`;
    ui.button(w.x+w.w-62,w.y+2,20,18,w.shaded?'▣':'−',()=>this.manager.shade(w.id));ui.regions.at(-1).label=`Recolher: ${title}`;
    ui.button(w.x+w.w-41,w.y+2,20,18,w.maximized?'↙':'↗',()=>this.manager.maximize(w.id));ui.regions.at(-1).label=`Ampliar: ${title}`;
    ui.button(w.x+w.w-20,w.y+2,18,18,'×',()=>this.close(w.id));ui.regions.at(-1).label=`Fechar: ${title} (também com botão direito)`;
    if(!w.shaded){const previousState=ui.windowState;ui.windowState=w.state;w.state.windowLinks=[];try{if(w.state.tab==='map')this.drawMap(ui,w);else w.state.drawFloating(ui,w);}finally{ui.windowState=previousState;}if(w.state.openCurrentInWindow&&w.state.tab!=='map'){ui.button(w.x+w.w-177,w.y+w.h-20,154,18,'DESTACAR ABA ↗',()=>w.state.openCurrentInWindow());ui.regions.at(-1).label='Abrir aba atual em outra janela';}if(!w.maximized){const handle=this.manager.resizeHandle(w);ctx.fillStyle=T.muted;for(let i=0;i<3;i++)ctx.fillRect(handle.x+handle.w-3-i*4,handle.y+handle.h-3-i*4,2,2+i*4);ui.regions.push({...handle,label:`Redimensionar: ${title}`,onClick:null});}ui.text(w.pinned?'Fixada':'',w.x+6,w.y+w.h-17,T.muted);}
    else {w.state.element.hidden=true;w.state.zones=[];}
  }
  draw(ui){
    this.syncElectionNotices();
    const point=ui.pointer,hover=point&&this.manager.at(point.x,point.y),resize=hover&&this.manager.resizeAt(hover,point.x,point.y);if(ui.canvas.style)ui.canvas.style.cursor=this.manager.gesture?.kind==='resize'||resize?'nwse-resize':this.manager.gesture?.kind==='move'||hover&&this.manager.caption(hover,point.x,point.y)?'move':'default';
    if(this.element.hidden===this.visible)this.element.hidden=!this.visible;if(this.visible){for(const [i,w] of this.manager.windows.entries()){const rect=this.manager.rect(w),covered=this.manager.windows.slice(i+1).some(above=>{const r=this.manager.rect(above);return r.x<=rect.x&&r.y<=rect.y&&r.x+r.w>=rect.x+rect.w&&r.y+r.h>=rect.y+rect.h;});if(covered){w.state.element.hidden=true;w.state.zones=[];continue;}if(w.state.element.hidden)w.state.element.hidden=false;this.frame(ui,w);}this.occludeInputs();const hit=point&&ui.hitTest(point.x,point.y);if(hit?.label){const key=hit.label;if(this.hoverHint?.key!==key)this.hoverHint={key,since:performance.now()};if(/^(Fechar|Fixar|Recolher|Ampliar|Redimensionar):/.test(key)||performance.now()-this.hoverHint.since>600)this.tooltip={text:key,x:point.x,y:point.y+24};}else this.hoverHint=null;}
    ui.regions.push(...(this.menuBarRegions||[]));
    if(this.menuOpen){for(const w of this.manager.windows)for(const input of[w.state.search,w.state.seed,w.state.populationInput,w.state.filterInput,w.state.sortInput,w.state.publicationDraft].filter(Boolean))input.hidden=true;this.drawMenu(ui);}
    this.tooltipElement.hidden=!this.tooltip||this.menuOpen||!!this.manager.gesture;
    if(!this.tooltipElement.hidden){const {text,x,y}=this.tooltip,w=Math.min(440,ui.width-8,Math.ceil(ui.textWidth(text))+18);this.tooltipElement.textContent=text;Object.assign(this.tooltipElement.style,{left:`${Math.max(4,Math.min(x,ui.width-w-4))}px`,top:`${Math.max(0,Math.min(y,ui.height-190))}px`,width:`${w}px`});}
  }
  drawMap(ui,w){
    const state=w.state,world=this.city.world;state.zones=[];for(const input of[state.search,state.seed,state.populationInput,state.filterInput,state.sortInput,state.publicationDraft])input.hidden=true;
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
    windows.forEach((w,i)=>{for(const input of[w.state.search,w.state.seed,w.state.populationInput,w.state.filterInput,w.state.sortInput,w.state.publicationDraft].filter(Boolean)){
      if(input.hidden)continue;const rect={x:parseFloat(input.style.left),y:parseFloat(input.style.top),w:parseFloat(input.style.width),h:20};let visible=[rect];
      for(const above of windows.slice(i+1)){
        const cover=this.manager.rect(above);visible=visible.flatMap(part=>{
          if(!intersects(part,cover))return[part];const x=Math.max(part.x,cover.x),y=Math.max(part.y,cover.y),right=Math.min(part.x+part.w,cover.x+cover.w),bottom=Math.min(part.y+part.h,cover.y+cover.h);
          return[{x:part.x,y:part.y,w:part.w,h:y-part.y},{x:part.x,y:bottom,w:part.w,h:part.y+part.h-bottom},{x:part.x,y,w:x-part.x,h:bottom-y},{x:right,y,w:part.x+part.w-right,h:bottom-y}].filter(r=>r.w>0&&r.h>0);
        });
      }
      if(!visible.length)input.hidden=true;
      else{const partial=visible.length!==1||visible[0].w!==rect.w||visible[0].h!==rect.h,path=partial?visible.map(r=>`M ${r.x-rect.x} ${r.y-rect.y} h ${r.w} v ${r.h} h ${-r.w} Z`).join(' '):'',clip=partial?`path("${path}")`:'';if(input.style.clipPath!==clip)input.style.clipPath=clip;}
    }});
  }
  drawMenu(ui){
    const items=this.menuItems(),anchor=this.menuAnchors.find(r=>r.id===this.menuId)||{x:4,y:2,w:80,h:28};
    const desiredWidth=Math.max(260,...items.filter(i=>!i.separator).map(i=>Math.ceil(ui.textWidth(i.label))+45)),width=Math.min(ui.width-8,420,desiredWidth);
    const contentHeight=items.reduce((n,item)=>n+(item.separator?8:24),0),x=Math.max(4,Math.min(anchor.x,ui.width-width-4)),y=Math.max(this.manager.top,anchor.y+anchor.h);
    const height=Math.min(contentHeight+8,Math.max(40,ui.height-y-31));this.menuScroll=Math.max(0,Math.min(this.menuScroll||0,contentHeight-height+8));this.menuBounds={x,y,w:width,h:height,max:Math.max(0,contentHeight-height+8)};
    ui.ctx.fillStyle='rgba(0,0,0,.25)';ui.ctx.fillRect(x+3,y+3,width,height);bevel(ui.ctx,x,y,width,height,{fill:T.paper});ui.regions.push({x,y,w:width,h:height,label:'Menu '+(this.menuGroups.find(g=>g.id===this.menuId)?.label||''),onClick:null});
    clipCanvasRegion(ui,x+3,y+3,width-6,height-6,()=>{
      let offset=0;for(const [index,item]of items.entries()){
        const py=y+4+offset-this.menuScroll,h=item.separator?8:24;offset+=h;if(py+h<=y+3||py>=y+height-3)continue;
        if(item.separator){ui.ctx.fillStyle=T.line;ui.ctx.fillRect(x+9,py+3,width-18,1);continue;}
        const disabled=!!item.disabled?.(),hover=!this.menuKeyboard&&ui.pointer?.x>=x+3&&ui.pointer.x<x+width-3&&ui.pointer.y>=py&&ui.pointer.y<py+h,selected=!disabled&&(hover||this.menuKeyboard&&index===this.menuIndex);
        if(hover&&!disabled)this.menuIndex=index;
        ui.ctx.fillStyle=selected?T.selected:T.paper;ui.ctx.fillRect(x+4,py,width-8,h);ui.text(ui.fitText(item.label,width-46),x+24,py+6,disabled?T.shadow:T.ink);
        if(item.checked?.())ui.text('✓',x+8,py+6,T.blue);
        ui.regions.push({x:x+4,y:py,w:width-8,h,label:item.label,onClick:disabled?null:()=>this.activateMenu(item)});
      }
    });
    if(this.menuBounds.max>0){const track=height-8,thumb=Math.max(14,track*track/contentHeight),ty=y+4+(track-thumb)*this.menuScroll/this.menuBounds.max;ui.ctx.fillStyle=T.track;ui.ctx.fillRect(x+width-7,y+4,3,track);ui.ctx.fillStyle=T.muted;ui.ctx.fillRect(x+width-7,ty,3,thumb);}
  }
}
