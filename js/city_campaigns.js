import {describePromise} from './city_mandates.js';
import { ROAD_TILES, tileAt } from './city_terrain.js';

export class CityCampaigns {
  constructor(city){this.city=city;this.lastRallyHour=null;}
  sample(rows,size){const pool=rows.slice();for(let i=0;i<Math.min(size,pool.length);i++){const j=i+Math.floor(this.city.random()*(pool.length-i));[pool[i],pool[j]]=[pool[j],pool[i]];}return pool.slice(0,size);}
  audience(size){const rows=this.city.citizens.filter(c=>!c.entity.destroyed&&this.city.society.isAdult(c)),independent=rows.filter(c=>!c.political?.partyId),first=this.sample(independent,Math.ceil(size*.85)),selected=new Set(first.map(c=>c.id));return first.concat(this.sample(rows.filter(c=>!selected.has(c.id)),Math.max(0,size-first.length)));}
  event(election,message,kind,ids=[],details={}){const event=this.city.log(message,'government',ids,{kind,electionId:election.id,...details});election.events.push({eventId:event.id,minute:this.city.minute,message,kind,...details});if(election.events.length>120)election.events.shift();const author=this.city.society.citizen(ids[0]);if(author&&['campaign-program','campaign-defamation','campaign-accountability','campaign-rally'].includes(kind))this.city.publications.preserveEvent(author,event,'propaganda');return event;}
  hearPromises(voter,nomination,election,source='Programa divulgado') {
    const p=this.city.politics,party=p.party(nomination.partyId);if(!party?.active||!this.city.society.citizen(nomination.citizenId))return;p.campaignContact(voter,nomination,election,source);
    nomination.memoryPromises??=Object.freeze(nomination.promises.map(pr=>Object.freeze({title:pr.title,metric:pr.metric,baseline:pr.campaignBaseline,target:pr.target,attention:pr.attention,ambitionLabel:pr.ambitionLabel})));
    p.remember(voter,{kind:'campaign-promise',electionId:election.id,partyId:party.id,candidateId:nomination.citizenId,promiseKey:`promises:${election.id}:${nomination.citizenId}`,description:`${source}: ${nomination.name} (${party.short}) prometeu ${nomination.promises.map(describePromise).join('; ')}.`,effect:1,promises:nomination.memoryPromises});
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
    for(const voter of targets){p.initializeCitizen(voter);const accepted=city.random()<Math.max(.02,.8-(voter.traits?.honesty??.5)*.7+(voter.needs.food<35?.15:0)),amount=city.currency.price(500+Math.floor(city.random()*1500));if(!accepted||candidate.balance<amount)continue;const crime=p.crime(candidate,'vote-buying',candidate.accountId,voter.accountId,amount,{electionId:election.id,voterId:voter.id});if(!crime)continue;const commitment=city.random()<.25+(voter.traits?.honesty??.5)*.5;voter.political.bribes.push(Object.freeze({electionId:election.id,candidateId:candidate.id,amount,accepted:true,commitment,caseId:crime.id}));if(voter.political.bribes.length>12)voter.political.bribes.shift();p.remember(voter,{kind:'vote-selling',electionId:election.id,candidateId:candidate.id,description:`Recebeu R$ ${(amount/100).toFixed(2)} por uma promessa ilegal de voto; o voto continua individual.`,effect:0});}
  }
  rally(nomination,election) {
    const city=this.city,p=city.politics,party=p.party(nomination.partyId),eligible=city.citizens.filter(c=>c.political?.partyId===party.id&&!c.entity.destroyed&&!c.path.length&&!c.conversation&&!c.deliveryId&&!c.cleaningJobId&&!c.workMeal&&!['work','construction','manage','caregiving','food','provisions','water','energy','health','toilet','hygiene','care','workmeal'].includes(c.task)&&!city.urgentNeed(c));
    const participants=this.sample(eligible,6);if(!participants.length)return;
    // Reach real street tiles; don't teleport workers away from their jobs.
    const routes=[...city.traffic.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([key])=>{const [x,y]=key.split(',').map(Number);return {x:x+.5,y:y+.5};}).filter(pos=>ROAD_TILES.has(tileAt(city.world,Math.floor(pos.x),Math.floor(pos.y))));
    if(!routes.length)return;const destination=routes[Math.floor(city.random()*Math.min(4,routes.length))];
    const event=this.event(election,`Bandeiraço ${party.short}: ${election.round===2?'campanha de segundo turno para prefeitura':'campanha conjunta para prefeitura e Câmara'}.`,'campaign-rally',participants.map(c=>c.id),{partyId:party.id,candidateId:nomination.citizenId,x:destination.x,y:destination.y});let paths=0;
    for(const c of participants){if(paths++>=3)break;const path=city.findPath(c.entity,destination);if(path===null)continue;c.path=path;c.task='campaign';c.campaign={electionId:election.id,candidateId:nomination.citizenId,partyId:party.id,flag:party.flag,until:city.minute+120,destination,eventId:event.id};c.action=`Bandeiraço ${party.short}`;}
  }
  arrive(c) {
    if(c.campaign?.type==='membership')return this.city.politics.organization.arrive(c);
    const city=this.city,p=city.politics,campaign=c.campaign,e=p.active;if(!campaign||!e||e.status!=='campaign'||e.id!==campaign.electionId||city.minute>=campaign.until||city.urgentNeed(c)){c.campaign=null;c.task=null;return;}
    c.action=`Bandeiraço ${p.party(campaign.partyId).short}: apresentando propostas`;
    if(city.minute-(campaign.lastOutreachAt??-Infinity)<30)return;campaign.lastOutreachAt=city.minute;
    const nomination=e.candidates.find(n=>n.citizenId===campaign.candidateId);if(!nomination)return;
    for(const voter of city.citizens.filter(v=>!v.entity.destroyed&&city.society.isAdult(v)&&Math.hypot(v.entity.x-c.entity.x,v.entity.y-c.entity.y)<5).slice(0,16)){this.hearPromises(voter,nomination,e,'Bandeiraço de rua');p.remember(voter,{kind:'campaign-rally',electionId:e.id,partyId:nomination.partyId,candidateId:nomination.citizenId,promiseKey:`rally:${e.id}:${nomination.citizenId}`,effect:3,description:e.round===2?'Conheceu a chapa do segundo turno num bandeiraço.':'Conheceu a chapa conjunta para prefeitura e Câmara num bandeiraço.'});}
  }
  conversation(a,b) {
    const p=this.city.politics,e=p.active;const scandal=p.scandals.find(s=>s.awareIds?.includes(a.id)&&!s.awareIds.includes(b.id));if(scandal&&this.city.random()<.2){scandal.awareIds.push(b.id);p.remember(b,{kind:scandal.proven?'proven-scandal':'corruption-rumor',candidateId:scandal.accusedId,partyId:scandal.partyId,caseId:scandal.id,effect:scandal.proven?-10:-2,description:'Debateu uma denúncia de corrupção numa conversa.'});}if(!e||e.status!=='campaign'||this.city.random()>.2||!this.city.society.isAdult(a)||!this.city.society.isAdult(b))return;
    p.initializeCitizen(a);p.initializeCitizen(b);const nomination=e.candidates.find(n=>n.endorsementPartyIds.includes(a.political.partyId??a.political.sympathyPartyId));if(nomination)this.hearPromises(b,nomination,e,`Conversa com ${a.entity.properties.name}`);
  }
  daily(election) {
    const day=Math.floor((this.city.minute-election.startedAt)/1440);if(election.lastCampaignDay===day)return;election.lastCampaignDay=day;
    for(const nomination of election.candidates.filter(n=>this.city.politics.party(n.partyId)?.active&&this.city.society.citizen(n.citizenId))){const candidate=this.city.society.citizen(nomination.citizenId);if(candidate)this.event(election,`${nomination.name} apresentou o programa: ${nomination.promises.map(describePromise).join('; ')}.`,'campaign-program',[nomination.citizenId],{candidateId:nomination.citizenId,partyId:nomination.partyId,truth:true,promises:nomination.promises.map(pr=>({...pr}))});const audience=this.audience(Math.max(1,Math.ceil(this.city.citizens.length*.2)));for(const c of audience)this.hearPromises(c,nomination,election);this.defame(nomination,election);this.criticize(nomination,election);this.buyVotes(nomination,election);}
    this.poll(election);
  }
  hourly(election){for(const c of this.city.citizens)if(c.campaign&&(this.city.minute>=c.campaign.until||this.city.urgentNeed(c))){c.campaign=null;if(c.task==='campaign'){c.task=null;c.path=[];}}if(this.city.minute>=election.voteAt)return;this.daily(election);this.city.politics.getResearch().request(election);this.factCheck(election);const hour=Math.floor(this.city.minute/60);if(this.lastRallyHour!==hour&&this.city.hour>=7&&this.city.hour<20&&this.city.hour%3===0){this.lastRallyHour=hour;for(const nomination of this.sample(election.candidates,2))this.rally(nomination,election);}}
}
