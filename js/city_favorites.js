/** Player-owned presentation preferences. Simulation history remains worker-owned. */
export const FAVORITE_GLYPH_COUNT = 256;
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
export class CityFavorites {
  constructor({city,desktop,storage}){
    Object.assign(this,{city,desktop,storage});this.people={};this.limit=20000;this.government=true;this.topics=Object.keys(GOVERNMENT_TOPICS);this.hidden=false;this.lastSignature='';
    try{const saved=JSON.parse(storage?.getItem('suburban.favorite-preferences')||'{}');this.limit=[0,20000,50000,100000,250000].includes(saved.limit)?saved.limit:20000;this.hidden=!!saved.hidden;this.government=saved.government!==false;this.topics=Array.isArray(saved.topics)?saved.topics.filter(t=>t in GOVERNMENT_TOPICS):this.topics;this.pendingWorld=saved;}catch{}
    this.worldKey=this.identity();if(this.pendingWorld?.world===this.worldKey)this.people=this.pendingWorld.people&&typeof this.pendingWorld.people==='object'&&!Array.isArray(this.pendingWorld.people)?this.pendingWorld.people:{};this.sanitize();this.sync();
  }
  identity(){return String(this.city.world?.seed??this.city.seed??'city')+':'+String(this.city.world?.width??'');}
  sanitize(){for(const [id,p] of Object.entries(this.people)){if(!/^\d+$/.test(id)||!p||typeof p!=='object'){delete this.people[id];continue;}p.icon=Number.isInteger(p.icon)&&p.icon>=0&&p.icon<FAVORITE_GLYPH_COUNT?p.icon:42;p.color=typeof p.color==='string'&&/^#[0-9a-f]{6}$/i.test(p.color)?p.color:'#ffd84d';p.feed=p.feed!==false;}}
  sync(){this.city.history.configureFavorites(Object.keys(this.people).map(Number),this.limit);}
  persist(sync=false){try{this.storage?.setItem('suburban.favorite-preferences',JSON.stringify({world:this.worldKey,people:this.people,limit:this.limit,hidden:this.hidden,government:this.government,topics:this.topics}));}catch{}if(sync)this.sync();this.lastSignature='';}
  has(id){return !!this.people[id];}
  togglePerson(id){if(this.has(id))delete this.people[id];else this.people[id]={icon:42,color:'#ffd84d',feed:true};this.persist(true);}
  open(tab='people'){
    const module='favorites';
    const view=tab==='settings'?'settings':'people';
    const state=this.desktop.openModule(module);state.showView(view);return state;
  }
  events(){
    const history=this.city.history,events=new Map();
    if(history.nextId<(this.feedCursor||0)){this.governmentEvents?.clear();this.feedCursor=0;}
    this.governmentEvents??=new Map();
    if(history.nextId!==this.feedCursor){for(const e of history.entries)if(e.id>=(this.feedCursor||0)&&governmentTopic(e))this.governmentEvents.set(e.id,e);while(this.governmentEvents.size>100)this.governmentEvents.delete(this.governmentEvents.keys().next().value);this.feedCursor=history.nextId;}
    for(const e of this.governmentEvents.values()){const topic=governmentTopic(e);if(this.government&&this.topics.includes(topic))events.set(e.id,e);}
    for(const [id,pref]of Object.entries(this.people))if(pref.feed)for(const e of (history.favoriteArchive.get(Number(id))||history.byCitizen.get(Number(id))||[]).slice(-30))events.set(e.id,e);
    return [...events.values()].sort((a,b)=>b.id-a.id);
  }
  refresh(force=false){
    const identity=this.identity();if(identity!==this.worldKey){this.worldKey=identity;this.people={};this.governmentEvents=new Map();this.feedCursor=0;this.persist(true);}
    const history=this.city.history,signature=[history.nextId,history.favoriteRevision,JSON.stringify(this.people),this.government,this.topics.join()].join(':');
    if(force||signature!==this.lastSignature)this.lastSignature=signature;
  }
}
