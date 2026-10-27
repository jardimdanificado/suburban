const clamp=n=>Math.max(0,Math.min(100,n));
export const CIVIC_SERVICES={
 hospital:{label:'Hospital',color:0xe6eee8,rent:0,price:160000,jobs:8,skill:'medicine',need:'health',rate:4,slots:4,minStaff:2,inputs:{remedio:1,sabao:1},population:256},
 park:{label:'Parque público',color:0x6caa65,rent:0,price:32000,jobs:2,skill:'care',need:'leisure',rate:1.5,slots:12,minStaff:1,inputs:{},population:128},
 sports_center:{label:'Centro esportivo',color:0x5988b5,rent:0,price:85000,jobs:4,skill:'care',need:'leisure',rate:2.5,slots:6,minStaff:1,inputs:{},population:192},
 library:{label:'Biblioteca',color:0xbf9d66,rent:0,price:65000,jobs:3,skill:'social',need:'leisure',rate:2,slots:8,minStaff:1,inputs:{},population:256},
 theater:{label:'Teatro',color:0xad6975,rent:0,price:105000,jobs:5,skill:'social',need:'leisure',rate:3,slots:8,minStaff:2,inputs:{},population:320},
};
export function civicSpec(b){return CIVIC_SERVICES[b?.type]|| (b?.type==='clinic'?{label:'Clínica',need:'health',rate:2,slots:2,minStaff:1,inputs:{remedio:1}}:b?.type==='leisure'?{label:'Centro de lazer',need:'leisure',rate:1,slots:6,minStaff:1,inputs:{}}:null);}
export function civicStaff(city,b){return b.workers.map(id=>city.society.citizen(id)).filter(c=>c&&!c.entity.destroyed&&c.jobId===b.id&&c.task==='work'&&(b.constructionKind==='open-air'?c.workCell?.buildingId===b.id:c.indoorLocation?.buildingId===b.id&&!!c.indoorLocation.unitId&&!c.indoorLocation.path?.length&&!c.indoorLocation.exiting)&&!c.path.length&&(b.constructionKind==='open-air'?c.workCell?.target&&Math.hypot(c.entity.x-c.workCell.target.x,c.entity.y-c.workCell.target.y)<=.15:Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)<=2));}
const occupancy=new WeakMap();
export function civicStatus(city,b,c=null){
 const spec=civicSpec(b);if(!spec)return null;
 const team=civicStaff(city,b),capacity=team.length>=spec.minStaff?team.length*spec.slots:0;
 let cache=occupancy.get(city);if(cache?.minute!==city.minute){cache={minute:city.minute,counts:new Map()};for(const person of city.citizens)if(!person.entity.destroyed&&person.civicVisit&&['health','leisure','social'].includes(person.task)){const site=city.building(person.civicVisit.buildingId);if(site&&Math.hypot(person.entity.x-site.door.x,person.entity.y-site.door.y)<=2)cache.counts.set(site.id,(cache.counts.get(site.id)||0)+1);}occupancy.set(city,cache);}
  const count=cache.counts.get(b.id)||0,already=c?.civicVisit?.buildingId===b.id&&Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)<=2;
 const inputs=Object.entries(spec.inputs).filter(([g,n])=>(b.inventory[g]||0)<n).map(([g])=>city.economy.goods[g].label),hasTicket=c?.civicVisit?.buildingId===b.id;
 const stocked=(!inputs.length||hasTicket)&&(b.type!=='library'||b.inventory.livros>=1);
 const ready=b.active&&!b.entity.destroyed&&capacity>0&&(count<capacity||already)&&stocked;
 return {spec,team:team.length,capacity,visitors:count,ready,reason:!b.active?'Instalação inativa':!capacity?'Aguardando equipe presente no local':!stocked?b.type==='library'&&b.inventory.livros<1?'Sem livros no acervo':`Faltam ${inputs.join(', ')}`:count>=capacity&&!already?'Lotação esgotada':'Atendimento disponível'};
}
export function civicVisit(city,c,b){
 const status=civicStatus(city,b,c);if(!status)return false;
 if(!status.ready){c.action=status.reason;c.serviceWaitSince??=city.minute;if(city.minute-c.serviceWaitSince>=30){c.task=null;c.targetId=null;c.civicVisit=null;c.serviceWaitSince=null;}return true;}
 c.serviceWaitSince=null;const spec=status.spec;
 if(!c.civicVisit||c.civicVisit.buildingId!==b.id){
   const materials=Object.entries(spec.inputs).reduce((n,[g,q])=>n+city.economy.goods[g].price*q,0),fee=b.ownerId?Math.ceil((materials+city.currency.price(spec.need==='health'?400:100))*1.25):0;
   if(fee&&!city.transfer(c.accountId,b.accountId,fee,`Serviço: ${spec.label}`,{buildingId:b.id})){c.task=null;c.action='Sem dinheiro para o atendimento';return true;}
   for(const [g,n]of Object.entries(spec.inputs)){b.inventory[g]-=n;city.economy.consumed[g]+=n;city.economy.recordGoods('civic-service',g,n,b.id,c.id);}
   c.civicVisit={buildingId:b.id,need:c.task,startedAt:city.minute};const cache=occupancy.get(city);cache.counts.set(b.id,(cache.counts.get(b.id)||0)+1);b.serviceVisits=(b.serviceVisits||0)+1;
   city.history.record('service',`${c.entity.properties.name} iniciou atendimento em ${b.entity.properties.name}.`,[c.accountId,b.accountId],{buildingId:b.id,service:c.task,amount:fee});
 }
 const need=c.task==='social'?'social':spec.need;c.needs[need]=clamp(c.needs[need]+spec.rate);
 if(b.type==='park')c.needs.health=clamp(c.needs.health+.15);
 if(b.type==='sports_center'){c.needs.health=clamp(c.needs.health+.25);c.needs.energy=clamp(c.needs.energy-.1);}
 if(b.type==='library'){city.economy.practice(c,'social',2);c.needs.social=clamp(c.needs.social+.2);}
 c.action=`${spec.need==='health'?'Recebendo cuidados':'Usando'}: ${b.entity.properties.name}`;
 if(c.needs[need]>=95){b.completedVisits=(b.completedVisits||0)+1;const cache=occupancy.get(city);cache.counts.set(b.id,Math.max(0,(cache.counts.get(b.id)||0)-1));c.civicVisit=null;c.task=null;c.servicePaid=null;}
 return true;
}

export function planCivicServices(city){
 if(city.economy.lastCivicPlanningDay===city.day)return false;city.economy.lastCivicPlanningDay=city.day;
 const needs=city.welfare.conditions();if(needs.foodDays<1||needs.hungry>needs.population*.25||city.development.projects.filter(p=>CIVIC_SERVICES[p.type]&&!p.cancelled&&p.status!=='completed').length>=2)return false;
 city.politics.fundInitialWorksBudget();
 for(const [type,spec]of Object.entries(CIVIC_SERVICES)){
   const present=city.buildings.filter(b=>b.type===type&&!b.entity.destroyed).length,pending=city.development.projects.some(p=>p.type===type&&!p.cancelled&&p.status!=='completed');
   if(pending||present>=Math.max(1,Math.ceil(city.citizens.length/spec.population)))continue;
   if(city.politics.startPublicWork(type))return true;
 }
 return false;
}
export function renderCivicServices(ui,p){
 const city=ui.city,sites=city.buildings.filter(b=>!b.entity.destroyed&&civicSpec(b)),rows=sites.map(b=>({b,status:civicStatus(city,b)}));
 p.heading('SAÚDE, LAZER E CULTURA');p.metrics([['INSTALAÇÕES',sites.length],['VAGAS EM ATENDIMENTO',rows.reduce((n,r)=>n+r.status.capacity,0)],['VISITAS CONCLUÍDAS',sites.reduce((n,b)=>n+(b.completedVisits||0),0)]]);
 p.note('Atendimento depende de equipe presente e capacidade disponível. Clínicas e hospitais consomem remédios; bibliotecas precisam de livros reais no acervo. Serviços públicos são gratuitos.');
 p.table([{label:'Instalação',weight:2},{label:'Equipe'},{label:'Ocupação'},{label:'Condição',weight:3}],rows.filter(({b})=>ui.matches(b.entity.properties.name+' '+civicSpec(b).label)).map(({b,status:s})=>({cells:[b.entity.properties.name,s.team,`${s.visitors}/${s.capacity}`,s.reason],click:()=>ui.openBuilding(b.id)})));
 p.heading('NOVOS ESPAÇOS');for(const [type,spec]of Object.entries(CIVIC_SERVICES)){
   p.kv(spec.label,`${sites.filter(b=>b.type===type).length} em operação · ${city.development.projects.filter(o=>o.type===type&&!o.cancelled&&o.status!=='completed').length} em construção`);
   p.button(`SOLICITAR OBRA: ${spec.label}`,()=>city.politics.startPublicWork(type));
 }
}
