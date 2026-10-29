import {CityCampaignMaterials} from './city_campaign_materials.js';
import {describePromise} from './city_mandates.js';
import { ROAD_TILES, tileAt } from './city_terrain.js?v=initial-cycle-ref-1';
import {issuePartyCap} from './city_party_caps.js?v=party-caps-skin-1';

export class CityCampaigns {
  constructor(city){this.city=city;this.lastRallyHour=null;}
  streetPoints(limit=48,origin=null){
    const city=this.city,hour=Math.floor(city.minute/60);
    if(this.trafficPointHour!==hour){this.trafficPointCache=[...city.traffic].sort((a,b)=>b[1]-a[1]).map(([key])=>{const [x,y]=key.split(',').map(Number);return {x:x+.5,y:y+.5};}).filter(p=>ROAD_TILES.has(tileAt(city.world,Math.floor(p.x),Math.floor(p.y))));this.trafficPointHour=hour;}
    const traffic=this.trafficPointCache||[];
    const revision=city.world.revision??0;
    if(this.roadPointRevision!==revision){const points=[];for(let y=0;y<city.world.height;y++)for(let x=0;x<city.world.width;x++)if(ROAD_TILES.has(tileAt(city.world,x,y)))points.push({x:x+.5,y:y+.5});this.roadPointCache=points;this.roadPointRevision=revision;}
    const roads=this.roadPointCache||[],points=[...traffic,...roads.filter((_,i)=>i%4===0)];
    if(origin)points.sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y));
    const spread=[];for(const point of points)if(spread.every(p=>Math.hypot(p.x-point.x,p.y-point.y)>=3)){spread.push(point);if(spread.length>=limit)break;}return spread;
  }
  getMaterials(){return this.materials??=new CityCampaignMaterials(this.city);}
  sample(rows,size){const pool=rows.slice();for(let i=0;i<Math.min(size,pool.length);i++){const j=i+Math.floor(this.city.random()*(pool.length-i));[pool[i],pool[j]]=[pool[j],pool[i]];}return pool.slice(0,size);}
  audience(size){const rows=this.city.citizens.filter(c=>!c.entity.destroyed&&this.city.society.isAdult(c)),independent=rows.filter(c=>!c.political?.partyId),first=this.sample(independent,Math.ceil(size*.85)),selected=new Set(first.map(c=>c.id));return first.concat(this.sample(rows.filter(c=>!selected.has(c.id)),Math.max(0,size-first.length)));}
  event(election,message,kind,ids=[],details={}){const event=this.city.log(message,'government',ids,{kind,electionId:election.id,...details});election.events.push({eventId:event.id,minute:this.city.minute,message,kind,...details});if(election.events.length>120)election.events.shift();const author=this.city.society.citizen(ids[0]);if(author&&['campaign-program','campaign-defamation','campaign-accountability','campaign-rally'].includes(kind))this.city.publications.preserveEvent(author,event,'propaganda');return event;}
  hearPromises(voter,nomination,election,source='Programa divulgado') {
    const p=this.city.politics,party=p.party(nomination.partyId);if(!party?.active||!this.city.society.citizen(nomination.citizenId))return;p.campaignContact(voter,nomination,election,source);
    voter.political.candidateContacts??={};const keys=Object.keys(voter.political.candidateContacts);if(keys.length>=96){const oldest=keys.sort((a,b)=>voter.political.candidateContacts[a].minute-voter.political.candidateContacts[b].minute)[0];delete voter.political.candidateContacts[oldest];}for(const [key,value]of Object.entries(voter.political.candidateContacts))if(value.electionId!==election.id&&this.city.minute-value.minute>30*1440)delete voter.political.candidateContacts[key];const contactKey=`${election.id}:${nomination.citizenId}`,old=voter.political.candidateContacts[contactKey];
    if(!old||this.city.minute-old.minute>=20){voter.political.candidateContacts[contactKey]={electionId:election.id,candidateId:nomination.citizenId,partyId:nomination.partyId,count:(old?.count||0)+1,minute:this.city.minute,source};election.contactedIds??=new Set();election.contactedIds.add(voter.id);}
    nomination.memoryPromises??=Object.freeze(nomination.promises.map(pr=>Object.freeze({title:pr.title,metric:pr.metric,baseline:pr.campaignBaseline,target:pr.target,attention:pr.attention,ambitionLabel:pr.ambitionLabel})));
    p.remember(voter,{kind:'campaign-promise',electionId:election.id,partyId:party.id,candidateId:nomination.citizenId,promiseKey:`promises:${election.id}:${nomination.citizenId}`,description:nomination.promises.length?`${source}: ${nomination.name} (${party.short}) prometeu ${nomination.promises.map(describePromise).join('; ')}.`:`${source}: conheceu ${nomination.name}, candidatura à Câmara por ${party.short}.`,effect:1,promises:nomination.memoryPromises});
  }
  poll(election){return this.city.politics.getResearch().request(election);}
  defame(nomination,election) {
    const city=this.city,p=city.politics,candidate=city.society.citizen(nomination.citizenId);if(!candidate||city.random()>(1-(candidate.traits?.honesty??.5))*.65)return;
    const opponents=election.candidates.filter(c=>c.citizenId!==nomination.citizenId);if(!opponents.length)return;const target=opponents[Math.floor(city.random()*opponents.length)];
    const accusations=['vai desviar o óleo dos postes','pretende abandonar as moradias populares','esconde um acordo para encarecer a comida','vai fechar as empresas e acabar com os empregos'];
    const claim=`${nomination.name} espalhou a alegação falsa de que ${target.name} ${accusations[Math.floor(city.random()*accusations.length)]}.`;
    const event=this.event(election,claim,'campaign-defamation',[nomination.citizenId,target.citizenId],{truth:false,accuserId:nomination.citizenId,targetId:target.citizenId});
    const listeners=this.sample(city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)),Math.max(1,Math.ceil(city.citizens.length*.12)));
    for(const listener of listeners){p.initializeCitizen(listener);const believes=city.random()<Math.max(.05,.65-(listener.political.criticalSense??.5)*.4-(p.distance(listener.political.ideology,p.party(target.partyId).ideology)<.4?.15:0));p.remember(listener,{kind:'defamation',electionId:election.id,partyId:target.partyId,candidateId:target.citizenId,accuserId:nomination.citizenId,eventId:event.id,believes,truth:false,effect:believes?-8:0,description:`Ouviu a acusação não comprovada contra ${target.name}; ${believes?'acreditou':'desconfiou'}.`});}
  }
  criticize(nomination,election){
    const city=this.city,p=city.politics,targets=election.candidates.filter(n=>n.citizenId!==nomination.citizenId);if(!targets.length)return;
    const target=targets[Math.floor(city.random()*targets.length)],scandal=p.scandals.filter(s=>s.proven&&(s.accusedId===target.citizenId||s.participantIds?.includes(target.citizenId))).sort((a,b)=>(b.severity||0)-(a.severity||0))[0];
    const term=p.mandates.terms.filter(t=>t.mayorId===target.citizenId||t.partyId===target.partyId).at(-1),broken=term?.promises.filter(pr=>!pr.fulfilled).sort((a,b)=>a.progress-b.progress)[0];
    if(!scandal&&!broken)return;
    const message=scandal?`${nomination.name} divulgou documentos de ${scandal.type}, envolvendo ${target.name} e ${(scandal.participantIds||[]).length} participantes.`:`${nomination.name} cobrou de ${target.name} o governo de ${term.mayorName}${term.mayorId!==target.citizenId?' de seu partido':''}: “${broken.title}”: início ${broken.baseline}, situação ${broken.current}, meta ${broken.target}.`;
    const event=this.event(election,message,'campaign-accountability',[nomination.citizenId,target.citizenId],{truth:true,targetId:target.citizenId,caseId:scandal?.id,termId:term?.id,metric:broken?.metric});
    for(const voter of this.sample(city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)),Math.ceil(city.citizens.length*.2))){p.initializeCitizen(voter);const loyalty=voter.political.partyId===target.partyId?voter.political.loyalty:0,critical=.5+(voter.political.criticalSense??.5)*.7-loyalty*.35;
      p.remember(voter,{kind:'campaign-accountability',electionId:election.id,candidateId:target.citizenId,partyId:target.partyId,caseId:scandal?.id,eventId:event.id,truth:true,effect:-(scandal?15:10+(broken?.attention??.4)*8)*critical,description:message});
      if(scandal){scandal.awareIds??=[];if(!scandal.awareIds.includes(voter.id))scandal.awareIds.push(voter.id);}
    }
  }
  factCheck(election) {
    const p=this.city.politics;
    for(const c of this.sample(this.city.citizens.filter(c=>!c.entity.destroyed&&c.political),Math.min(24,this.city.citizens.length))){const index=c.political.memories.findIndex(m=>m.electionId===election.id&&m.kind==='defamation'&&m.believes&&this.city.minute-m.minute>=360);if(index<0||this.city.random()>(c.political.criticalSense??.5)*.4)continue;const old=c.political.memories[index];c.political.memories[index]=Object.freeze({...old,believes:false,effect:0,corrected:true,description:'Verificou que a acusação de campanha era falsa.'});p.remember(c,{kind:'campaign-correction',electionId:election.id,candidateId:old.accuserId,effect:-5,description:'Perdeu confiança em quem difundiu uma mentira eleitoral.'});this.event(election,`${c.entity.properties.name} contestou uma mentira eleitoral.`,'campaign-fact-check',[c.id,old.accuserId],{parentEventId:old.eventId});}
  }
  buyVotes(nomination,election) {
    const city=this.city,p=city.politics,candidate=city.society.citizen(nomination.citizenId);if(!candidate||(candidate.traits?.honesty??.5)>.5||city.random()>.45)return;
    const targets=this.sample(city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&c.id!==candidate.id&&c.balance<city.currency.price(15000)&&!c.political?.bribes.some(b=>b.electionId===election.id)),3);
    for(const voter of targets){p.initializeCitizen(voter);const accepted=city.random()<Math.max(.02,.8-(voter.traits?.honesty??.5)*.7+(voter.needs.food<35?.15:0)),amount=city.currency.price(500+Math.floor(city.random()*1500));if(!accepted||p.partyAccount(p.party(nomination.partyId)).balance<amount)continue;const crime=p.crime(candidate,'vote-buying',p.partyAccount(p.party(nomination.partyId)).accountId,voter.accountId,amount,{electionId:election.id,voterId:voter.id});if(!crime)continue;const commitment=city.random()<.25+(voter.traits?.honesty??.5)*.5;voter.political.bribes.push(Object.freeze({electionId:election.id,candidateId:candidate.id,amount,accepted:true,commitment,caseId:crime.id}));if(voter.political.bribes.length>12)voter.political.bribes.shift();p.remember(voter,{kind:'vote-selling',electionId:election.id,candidateId:candidate.id,description:`Recebeu R$ ${(amount/100).toFixed(2)} por uma promessa ilegal de voto; o voto continua individual.`,effect:0});}
  }
  recruit(n,e){
    const city=this.city,p=city.politics,party=p.party(n.partyId);if(!party||city.hour<7||city.hour>=21)return;
    const active=city.citizens.filter(c=>c.campaign?.electionId===e.id&&c.campaign.partyId===party.id).length;
    if(active>=Math.max(2,Math.min(6,Math.ceil(city.citizens.length/100))))return;
    const essential=new Set(['food','water','health','energy','hygiene','toilet','provisions','care','caregiving','workmeal','construction','vote','council-session','research','interview']);
    const essentialWork=new Set(['farm','bakery','kitchen','popular_refectory','builder','quarry','carrier','utility','clinic','mill','cleaner','waste_collector']);
    const candidates=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!p.officeHolder(c)&&!c.campaign&&!c.mobilityTrip&&!c.ridingVehicleId&&!c.deliveryId&&!c.cleaningJobId&&!c.conversation&&!c.workMeal&&!essential.has(c.task)&&!city.urgentNeed(c)&&Math.min(c.needs.food,c.needs.water,c.needs.energy,c.needs.toilet)>35&&(!['work','manage'].includes(c.task)||!essentialWork.has(city.building(c.jobId)?.type)&&!c.businessIds.some(id=>essentialWork.has(city.building(id)?.type)))&&p.distance(c.political?.ideology||party.ideology,party.ideology)<1.7);
    candidates.sort((a,b)=>Number(b.political?.partyId===party.id)-Number(a.political?.partyId===party.id)+(b.skills.social-a.skills.social)/300);
    const points=this.streetPoints(1);
    if(!points.length)return;
    for(const c of candidates.slice(0,8)){
      const localPoints=this.streetPoints(12,c.entity);let dest,path;
      const occupied=city.citizens.filter(other=>other.campaign?.destination&&other.campaign.electionId===e.id).map(other=>other.campaign.destination);
      const spread=localPoints.slice().sort((a,b)=>Math.min(30,...occupied.map(p=>Math.hypot(p.x-b.x,p.y-b.y)))-Math.min(30,...occupied.map(p=>Math.hypot(p.x-a.x,p.y-a.y))));
      for(let i=0;i<Math.min(12,spread.length);i++){const option=spread[i],route=city.findPath(c.entity,option);if(route!==null&&route.length<=60){dest=option;path=route;break;}}
      if(!dest)continue;
      const volunteer=c.political?.partyId===party.id&&(c.political.loyalty||0)>.6,fee=volunteer?0:city.currency.price(900);
      if(fee&&!city.transfer(p.partyAccount(party).accountId,c.accountId,fee,'Serviço: turno de campanha de rua',{electionId:e.id,partyId:party.id,workerId:c.id}))continue;
      n.campaignFinance??={received:0,spent:0,donors:[]};n.campaignFinance.spent+=fee;
      c.campaignInventory??={};
      if(!c.campaignInventory.bandeiras){const shop=city.economy.businesses.find(b=>b.active&&b.inventory.bandeiras>0);if(shop&&p.partyAccount(party).balance>=city.economy.goods.bandeiras.price&&city.transfer(p.partyAccount(party).accountId,shop.accountId,city.economy.goods.bandeiras.price,'Compra de bandeira para militante',{electionId:e.id,partyId:party.id})){shop.inventory.bandeiras--;n.campaignFinance.spent+=city.economy.goods.bandeiras.price;c.campaignInventory.bandeiras=1;city.economy.recordGoods('campaign-pickup','bandeiras',1,shop.id,c.id);}}
      const capGarmentId=issuePartyCap(p,party,c)?.garmentId||null;
      c.path=path;c.task='campaign';c.targetId=null;c.campaign={type:'canvass',electionId:e.id,candidateId:n.citizenId,partyId:party.id,partyNumber:party.number,speechColor:party.flag.background,partyFlag:party.flag,flag:c.campaignInventory.bandeiras?party.flag:null,capGarmentId,until:Math.min(e.voteAt,city.minute+240),destination:dest,fee};
      e.streetCampaign??={turns:0,paid:0};e.streetCampaign.turns++;e.streetCampaign.paid+=fee;
      c.action=`Campanha de rua: ${n.name}, ${party.number}`;break;
    }
  }
  rally(nomination,election) {
    const city=this.city,p=city.politics,party=p.party(nomination.partyId);if(!party?.active)return 0;
    const eligible=city.citizens.filter(c=>(c.political?.partyId===party.id||c.campaign?.partyId===party.id)&&!['paid','membership'].includes(c.campaign?.type)&&!p.officeHolder(c)&&!c.mobilityTrip&&!c.ridingVehicleId&&!c.entity.destroyed&&(!c.path.length||c.task==='campaign')&&!c.conversation&&!c.deliveryId&&!c.cleaningJobId&&!c.workMeal&&!['work','construction','manage','caregiving','food','provisions','water','energy','health','toilet','hygiene','care','workmeal'].includes(c.task)&&!city.urgentNeed(c));
    const participants=this.sample(eligible,6).sort((a,b)=>(b.campaignInventory?.bandeiras||0)-(a.campaignInventory?.bandeiras||0));if(!participants.length)return 0;
    const routes=this.streetPoints(12,participants[0].entity);if(!routes.length)return 0;
    const destination=routes[Math.floor(city.random()*Math.min(4,routes.length))],gathering=this.streetPoints(24,destination).filter(point=>Math.hypot(point.x-destination.x,point.y-destination.y)<=5),planned=[];
    for(const c of participants){const point=gathering[planned.length%Math.max(1,gathering.length)]||destination,path=city.findPath(c.entity,point);if(path!==null&&path.length<=60)planned.push({c,path,point});}if(!planned.length)return 0;
    const event=this.event(election,`Bandeiraço ${party.short}: ${election.round===2?'campanha de segundo turno para prefeitura':'campanha conjunta para prefeitura e Câmara'}; ${planned.length} participantes a caminho.`,'campaign-rally',planned.map(r=>r.c.id),{partyId:party.id,candidateId:nomination.citizenId,x:destination.x,y:destination.y});
    for(const {c,path,point}of planned){const capGarmentId=issuePartyCap(p,party,c)?.garmentId||null;c.path=path;c.task='campaign';c.campaign={type:'rally',electionId:election.id,candidateId:nomination.citizenId,partyId:party.id,partyNumber:party.number,partyFlag:party.flag,flag:c.campaignInventory?.bandeiras?party.flag:null,capGarmentId,until:Math.min(election.voteAt,city.minute+240),destination:point,eventId:event.id};c.action=`Bandeiraço ${party.short}`;}return planned.length;
  }
  arrive(c) {
    if(c.campaign?.type==='paid')return this.getMaterials().work(c);
    if(c.campaign?.type==='membership')return this.city.politics.organization.arrive(c);
    const city=this.city,p=city.politics,campaign=c.campaign,e=p.active;if(!campaign||!e||e.status!=='campaign'||e.id!==campaign.electionId||city.minute>=campaign.until||city.urgentNeed(c)){c.campaign=null;c.task=null;return;}
    c.action=`${campaign.flag||campaign.type==='rally'?'Bandeiraço':'Conversa de campanha'} ${p.party(campaign.partyId).short}: apresentando propostas`;
    if(city.minute-(campaign.lastOutreachAt??-Infinity)<30)return;campaign.lastOutreachAt=city.minute;
    const nomination=e.candidates.find(n=>n.citizenId===campaign.candidateId);if(!nomination)return;
    for(const voter of city.citizens.filter(v=>!v.entity.destroyed&&!v.indoorLocation&&city.society.isAdult(v)&&Math.hypot(v.entity.x-c.entity.x,v.entity.y-c.entity.y)<5).slice(0,16)){this.hearPromises(voter,nomination,e,campaign.flag?'Bandeiraço de rua':'Conversa de campanha na rua');const council=e.councilCandidates.filter(n=>n.partyId===nomination.partyId);if(council.length){const n=council[(voter.id+c.id+Math.floor(city.minute/30))%council.length];this.hearPromises(voter,{...n,promises:[],endorsementPartyIds:[n.partyId]},e,'Candidato a vereador apresentado na rua');}p.remember(voter,{kind:'campaign-rally',electionId:e.id,partyId:nomination.partyId,candidateId:nomination.citizenId,promiseKey:`rally:${e.id}:${nomination.citizenId}`,effect:3,description:e.round===2?'Conheceu a chapa do segundo turno num bandeiraço.':'Conheceu a chapa conjunta para prefeitura e Câmara num bandeiraço.'});}
  }
  conversation(a,b) {
    const p=this.city.politics,e=p.active;const scandal=p.scandals.find(s=>s.awareIds?.includes(a.id)&&!s.awareIds.includes(b.id));if(scandal&&this.city.random()<.2){scandal.awareIds.push(b.id);p.remember(b,{kind:scandal.proven?'proven-scandal':'corruption-rumor',candidateId:scandal.accusedId,partyId:scandal.partyId,caseId:scandal.id,effect:scandal.proven?-10:-2,description:'Debateu uma denúncia de corrupção numa conversa.'});}if(!e||e.status!=='campaign'||this.city.random()>.2||!this.city.society.isAdult(a)||!this.city.society.isAdult(b))return;
    p.initializeCitizen(a);p.initializeCitizen(b);const nomination=e.candidates.find(n=>n.endorsementPartyIds.includes(a.political.partyId??a.political.sympathyPartyId));if(nomination)this.hearPromises(b,nomination,e,`Conversa com ${a.entity.properties.name}`);
  }
  daily(election) {
    const day=Math.floor((this.city.minute-election.startedAt)/1440);if(election.lastCampaignDay===day)return;election.lastCampaignDay=day;
    for(const nomination of election.candidates.filter(n=>this.city.politics.party(n.partyId)?.active&&this.city.society.citizen(n.citizenId))){const candidate=this.city.society.citizen(nomination.citizenId);if(candidate)this.event(election,`${nomination.name} apresentou o programa: ${nomination.promises.map(describePromise).join('; ')}.`,'campaign-program',[nomination.citizenId],{candidateId:nomination.citizenId,partyId:nomination.partyId,truth:true,promises:nomination.promises.map(pr=>({...pr}))});const audience=this.audience(Math.max(1,Math.ceil(this.city.citizens.length*.2)));for(const c of audience)this.hearPromises(c,nomination,election);this.defame(nomination,election);this.criticize(nomination,election);this.buyVotes(nomination,election);}
    this.getMaterials().plan(election);this.poll(election);
  }
  hourly(election){for(const c of this.city.citizens)if(c.campaign&&(this.city.minute>=c.campaign.until||this.city.urgentNeed(c))){if(c.campaign.type==='paid')this.getMaterials().release(c,'Necessidade pessoal ou fim do turno');else{c.campaign=null;if(c.task==='campaign'){c.task=null;c.path=[];}}}if(this.city.minute>=election.voteAt)return;for(const n of election.candidates)this.recruit(n,election);this.daily(election);this.getMaterials().plan(election);this.city.politics.getResearch().request(election);this.factCheck(election);const hour=Math.floor(this.city.minute/60);if(this.lastRallyHour!==hour&&this.city.hour>=7&&this.city.hour<20&&this.city.hour%3===0){this.lastRallyHour=hour;for(const nomination of this.sample(election.candidates,2))this.rally(nomination,election);}}
}
