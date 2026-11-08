/** Player-owned presentation preferences. Only people have map markers. */
export const FAVORITE_GLYPH_COUNT=256;
export const GOVERNMENT_TOPICS={government:'Governo',election:'Eleições',policy:'Leis e políticas',construction:'Obras públicas',corruption:'Corrupção',intervention:'Intervenções'};
export const HISTORY_FILTER_GROUPS={
 politics:{label:'Política',types:{'politics.votes':'Votações e resultados','politics.party-reaction':'Reação popular aos votos das bancadas','politics.person-reaction':'Reação popular e reputação de cada político','politics.legislation':'Tramitação, execução e vetos de leis','politics.elections':'Eleição, apuração e mandatos','politics.campaign':'Campanhas e mobilização','politics.research':'Pesquisas e divulgação de resultados','politics.interviews':'Entrevistas e contatos eleitorais','politics.parties':'Filiação, organização e relações partidárias','politics.corruption':'Corrupção e investigações políticas','politics.government':'Demais acontecimentos do governo'}},
 interventions:{label:'Intervenções',types:{'interventions.orders':'Ordens do jogador','interventions.finance':'Financiamento e transferências','interventions.effects':'Execução, consequências e serviços relacionados'}},
 economy:{label:'Economia e trabalho',types:{'economy.finance':'Demais pagamentos e transferências','economy.payroll':'Salários e remuneração','economy.taxes':'Impostos e arrecadação','economy.credit':'Crédito e dívidas','economy.trade':'Compras, vendas e serviços','economy.employment':'Emprego, vagas e carreiras','economy.production':'Produção e transporte','economy.reputation':'Reputação profissional e comercial'}},
 city:{label:'Cidade e vida cotidiana',types:{'city.construction':'Obras, terrenos e propriedade','city.justice':'Segurança, justiça e prisões','city.art':'Arte e publicações','city.social':'Família, relações e convívio','city.activity':'Atividades individuais dos favoritos','city.environment':'Natureza, saneamento e necessidades','city.other':'Outros acontecimentos'}}
};
const ALL_TYPES=Object.values(HISTORY_FILTER_GROUPS).flatMap(group=>Object.keys(group.types));
const QUIET_TYPES=['politics.party-reaction','politics.person-reaction'];
const actionOf=e=>String(e.data?.kind||e.data?.action||e.action||e.kind||'');
export function interventionEventType(e){
 const action=actionOf(e);if(e.interventionId==null&&e.data?.interventionId==null&&action!=='observer-intervention')return null;
 return /finance|sale|credit/.test(e.kind||e.category||'')?'interventions.finance':action==='observer-intervention'?'interventions.orders':'interventions.effects';
}
export function historyEventType(e){
 const action=actionOf(e),kind=e.kind||e.category||'';
 if(/party-legislative-reputation|party-vote-reaction/.test(action))return 'politics.party-reaction';
 if(/politician.*reaction|individual.*vote.*reaction|vote.*reaction|policy-reaction|corruption-vote/.test(action)||kind==='reputation'&&e.billId!=null)return 'politics.person-reaction';
 const intervention=interventionEventType(e);if(intervention)return intervention;
 if(/bill-voted|council-vote|politician-vote/.test(action))return 'politics.votes';
 if(e.corruptionCaseId!=null||/corruption|scandal/.test(action))return 'politics.corruption';
 if(e.billId!=null||kind==='policy'||/bill-|decree|law-|policy/.test(action))return 'politics.legislation';
 if(/interview|poll-response|campaign-contact/.test(action))return 'politics.interviews';
 if(/poll|research/.test(action))return 'politics.research';
 if(/campaign/.test(action))return 'politics.campaign';
 if(e.electionId!=null||/election|mandate|inaugurat|in-person-vote/.test(action))return 'politics.elections';
 if(/party|membership/.test(action))return 'politics.parties';
 if(kind==='government')return 'politics.government';
 if(kind==='reputation')return 'economy.reputation';
 if(kind==='finance'&&/salário|salario|remunera/i.test(e.reason||e.data?.reason||''))return 'economy.payroll';
 if(kind==='finance'&&/imposto|tribut|tarifa/i.test(e.reason||e.data?.reason||''))return 'economy.taxes';
 if(kind==='finance')return 'economy.finance';if(kind==='credit')return 'economy.credit';
 if(/employment|work|career/.test(kind))return 'economy.employment';
 if(/sale|service|economy/.test(kind))return 'economy.trade';
 if(/production|transport|delivery|shipment/.test(kind+' '+action))return 'economy.production';
 if(/construction|ownership|housing/.test(kind))return 'city.construction';
 if(/art|publication|book|pamphlet/.test(action))return 'city.art';
 if(/justice|safety|custody|forensic/.test(kind))return 'city.justice';
 if(/activity/.test(kind))return 'city.activity';
 if(/social|family|relationship/.test(kind))return 'city.social';
 if(/nature|sanitation|needs|health/.test(kind))return 'city.environment';
 return 'city.other';
}
export function governmentTopic(e){
 const action=actionOf(e);
 if(e.interventionId!=null||e.data?.interventionId!=null||action==='observer-intervention')return 'intervention';
 if(/^(vote|in-person-vote|corruption-evidence|poll-response|interview|campaign-contact)$/.test(action))return null;
 if(e.electionId!=null||/election|mandate|inaugurat/.test(e.kind))return 'election';
 if(e.corruptionCaseId!=null||/corruption|scandal/.test(e.kind))return 'corruption';
 if(e.billId!=null||e.kind==='policy')return 'policy';
 if(e.projectId!=null&&e.accounts?.includes('treasury')&&/conclu|inaugur|bloque|cancel|aprova/i.test(e.message))return 'construction';
 if(e.kind==='government')return 'government';return null;
}
const validCollection=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
export class CityFavorites{
 constructor({city,desktop,storage}){
  Object.assign(this,{city,desktop,storage});this.people={};this.businesses={};this.parties={};this.limit=20000;this.eventLimit=250;this.government=true;this.topics=Object.keys(GOVERNMENT_TOPICS);this.types=ALL_TYPES.filter(type=>!QUIET_TYPES.includes(type));this.filters={politicianId:null,partyId:null,billId:null,interventionId:null,days:0};this.hidden=false;this.lastSignature='';
  try{const saved=JSON.parse(storage?.getItem('suburban.favorite-preferences')||'{}');this.limit=[0,20000,50000,100000,250000].includes(saved.limit)?saved.limit:20000;this.eventLimit=Number.isSafeInteger(saved.eventLimit)&&saved.eventLimit>=0&&saved.eventLimit<=1000000?saved.eventLimit:250;this.hidden=!!saved.hidden;this.government=saved.government!==false;this.topics=Array.isArray(saved.topics)?saved.topics.filter(t=>t in GOVERNMENT_TOPICS):this.topics;if(Array.isArray(saved.types))this.types=saved.types.filter(type=>ALL_TYPES.includes(type));this.pendingWorld=saved;}catch{}
  this.worldKey=this.identity();if(this.pendingWorld?.world===this.worldKey)for(const key of ['people','businesses','parties'])this[key]=validCollection(this.pendingWorld[key]);if(this.pendingWorld?.world===this.worldKey)for(const key of Object.keys(this.filters)){const value=this.pendingWorld.filters?.[key];if(Number.isSafeInteger(value)&&value>=0)this.filters[key]=value;}this.sanitize();this.sync();
 }
 identity(){return String(this.city.world?.seed??this.city.seed??'city')+':'+String(this.city.world?.width??'');}
 sanitize(){
  for(const [id,p]of Object.entries(this.people)){if(!/^\d+$/.test(id)||!p||typeof p!=='object'){delete this.people[id];continue;}p.icon=Number.isInteger(p.icon)&&p.icon>=0&&p.icon<FAVORITE_GLYPH_COUNT?p.icon:42;p.color=typeof p.color==='string'&&/^#[0-9a-f]{6}$/i.test(p.color)?p.color:'#ffd84d';p.feed=p.feed!==false;}
  for(const key of ['businesses','parties'])for(const [id,p]of Object.entries(this[key])){if(!/^\d+$/.test(id)||!p||typeof p!=='object'){delete this[key][id];continue;}this[key][id]={feed:p.feed!==false};}
 }
 sync(){this.city.history.configureFavorites(Object.keys(this.people).map(Number),this.limit,[...Object.keys(this.businesses).map(id=>`business:${id}`),...Object.keys(this.parties).map(id=>`party:${id}`)]);}
 persist(sync=false){try{this.storage?.setItem('suburban.favorite-preferences',JSON.stringify({world:this.worldKey,people:this.people,businesses:this.businesses,parties:this.parties,limit:this.limit,eventLimit:this.eventLimit,hidden:this.hidden,government:this.government,topics:this.topics,types:this.types,filters:this.filters}));}catch{}if(sync)this.sync();this.lastSignature='';}
 has(id){return !!this.people[id];}
 togglePerson(id){if(this.has(id))delete this.people[id];else this.people[id]={icon:42,color:'#ffd84d',feed:true};this.persist(true);}
 hasBusiness(id){return !!this.businesses[id];}
 hasParty(id){return !!this.parties[id];}
 toggleBusiness(id){this.toggleTracked('businesses',id);}
 toggleParty(id){this.toggleTracked('parties',id);}
 toggleTracked(key,id){if(!Number.isInteger(id))return;if(this[key][id])delete this[key][id];else this[key][id]={feed:true};this.persist(true);}
 setType(type,enabled){if(!ALL_TYPES.includes(type))return;this.types=enabled?[...new Set([...this.types,type])]:this.types.filter(t=>t!==type);this.persist();}
 setEventLimit(value){
  if(!['number','string'].includes(typeof value)||typeof value==='string'&&!value.trim())return false;
  value=Number(value);if(!Number.isSafeInteger(value)||value<0||value>1000000)return false;
  this.eventLimit=value;this.feedCursor=0;this.persist();return true;
 }
 open(tab='people'){const state=this.desktop.openModule('favorites');state.showView(['settings','businesses','parties'].includes(tab)?tab:'people');return state;}
 matchesScope(e){
  const f=this.filters,partyIds=[...(e.partyIds||[]),e.partyId,...(e.accounts||[]).filter(id=>/^party:\d+$/.test(id)).map(id=>Number(id.slice(6)))];
  return (!f.days||e.minute>=this.city.minute-f.days*1440)&&(!f.politicianId||(e.citizenIds||[]).includes(f.politicianId)||e.politicianId===f.politicianId)&&(!f.partyId||partyIds.includes(f.partyId))&&(!f.billId||e.billId===f.billId)&&(!f.interventionId||e.interventionId===f.interventionId||e.data?.interventionId===f.interventionId);
 }
 events(){
  this.refresh();if(this.eventCacheSignature===this.lastSignature)return this.eventCache;
  const history=this.city.history,events=new Map(),accept=e=>this.matchesScope(e)&&this.types.includes(historyEventType(e))&&(!interventionEventType(e)||this.types.includes(interventionEventType(e)));
  if(history.nextId<(this.feedCursor||0)){this.governmentEvents?.clear();this.feedCursor=0;}
  this.governmentEvents??=new Map();
  if(history.nextId!==this.feedCursor){
   const incoming=new Map();for(const e of history.entries)if(e.id>=(this.feedCursor||0)&&governmentTopic(e)){const type=historyEventType(e);let rows=incoming.get(type);if(!rows)incoming.set(type,rows=[]);rows.push(e);}
   for(const [type,rows]of incoming){const merged=new Map((this.governmentEvents.get(type)||[]).map(e=>[e.id,e]));for(const e of rows)merged.set(e.id,e);this.governmentEvents.set(type,[...merged.values()].sort((a,b)=>a.id-b.id));}
   for(const [type,rows]of this.governmentEvents)if(this.eventLimit&&rows.length>this.eventLimit)this.governmentEvents.set(type,rows.slice(-this.eventLimit));this.feedCursor=history.nextId;
  }
  for(const rows of this.governmentEvents.values())for(const e of rows){if(this.government&&this.topics.includes(governmentTopic(e))&&accept(e))events.set(e.id,e);}
  const add=(key,pref,fallback)=>{if(!pref.feed)return;const rows=history.favoriteArchive.get(key)||fallback||[];let count=0;for(let i=rows.length-1;i>=0&&(!this.eventLimit||count<this.eventLimit);i--)if(accept(rows[i])){events.set(rows[i].id,rows[i]);count++;}};
  for(const [id,pref]of Object.entries(this.people))add(Number(id),pref,history.byCitizen.get(Number(id)));
  for(const [id,pref]of Object.entries(this.businesses))add(`business:${id}`,pref,history.byBuilding.get(Number(id)));
  for(const [id,pref]of Object.entries(this.parties))add(`party:${id}`,pref,history.byReference.get(`partyId:${id}`));
  this.eventCacheSignature=this.lastSignature;const sorted=[...events.values()].sort((a,b)=>b.id-a.id);return this.eventCache=this.eventLimit?sorted.slice(0,this.eventLimit):sorted;
 }
 refresh(force=false){
  const identity=this.identity();if(identity!==this.worldKey){this.worldKey=identity;this.people={};this.businesses={};this.parties={};this.filters={politicianId:null,partyId:null,billId:null,interventionId:null,days:0};this.governmentEvents=new Map();this.feedCursor=0;this.persist(true);}
  const history=this.city.history,signature=[this.worldKey,this.eventLimit,this.filters.days?this.city.minute:0,history.nextId,history.favoriteRevision,JSON.stringify([this.people,this.businesses,this.parties]),this.government,this.topics.join(),this.types.join(),JSON.stringify(this.filters)].join(':');if(force||signature!==this.lastSignature)this.lastSignature=signature;
 }
}
