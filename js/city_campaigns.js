import { ROAD_TILES, tileAt } from './city_terrain.js';

export class CityCampaigns {
  constructor(city){this.city=city;this.lastRallyHour=null;}
  sample(rows,size){const pool=rows.slice();for(let i=0;i<Math.min(size,pool.length);i++){const j=i+Math.floor(this.city.random()*(pool.length-i));[pool[i],pool[j]]=[pool[j],pool[i]];}return pool.slice(0,size);}
  event(election,message,kind,ids=[],details={}){const event=this.city.log(message,'government',ids,{kind,electionId:election.id,...details});election.events.push({eventId:event.id,minute:this.city.minute,message,kind,...details});if(election.events.length>120)election.events.shift();return event;}
  hearPromises(voter,nomination,election,source='Programa divulgado') {
    const p=this.city.politics,party=p.party(nomination.partyId);
    nomination.memoryPromises??=Object.freeze(nomination.promises.map(pr=>Object.freeze({title:pr.title,metric:pr.metric,baseline:pr.campaignBaseline,target:pr.target})));
    p.remember(voter,{kind:'campaign-promise',electionId:election.id,partyId:party.id,candidateId:nomination.citizenId,promiseKey:`promises:${election.id}:${nomination.citizenId}`,description:`${source}: ${nomination.name} (${party.short}) prometeu ${nomination.promises.map(pr=>pr.title.toLowerCase()).join('; ')}.`,effect:1,promises:nomination.memoryPromises});
  }
  poll(election) {
    const city=this.city,p=city.politics,electorate=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)),cityPopulation=city.citizens.filter(c=>!c.entity.destroyed).length,size=Math.max(1,Math.ceil(cityPopulation*.1)),sample=this.sample(electorate,Math.min(size,electorate.length)),responses=[];
    for(const voter of sample){const scores=p.intentions(voter),top=scores[0];if(!top)continue;const margin=top.score-(scores[1]?.score??0),knows=margin>=8||voter.political.memories.some(m=>m.electionId===election.id&&m.candidateId===top.candidateId),decided=knows&&city.random()<Math.min(.97,.55+margin/80);
      const approval=Math.max(0,Math.min(100,voter.happiness*.65+(voter.homeUnitId?12:0)+(voter.needs.food>=30?12:0)+(voter.jobId||voter.businessIds.length?11:0)+(p.mandates.current?.score||0)*10));
      const rejected=scores.filter(s=>s.score<40||voter.political.memories.some(m=>m.candidateId===s.candidateId&&(m.kind==='proven-scandal'||m.kind==='defamation'&&m.believes&&!m.corrected))).map(s=>s.candidateId);
      responses.push(Object.freeze({citizenId:voter.id,name:voter.entity.properties.name,candidateId:decided?top.candidateId:null,leaningId:top.candidateId,decided,reason:decided?top.reason:'ainda avaliando propostas e alternativas',approval:Math.round(approval),rejectedIds:Object.freeze(rejected),reasons:Object.freeze(top.reasons.map(r=>Object.freeze({...r})))}));
    }
    const n=responses.length,results=election.candidates.map(c=>({candidateId:c.citizenId,name:c.name,partyId:c.partyId,intentions:responses.filter(r=>r.candidateId===c.citizenId).length,rejections:responses.filter(r=>r.rejectedIds.includes(c.citizenId)).length}));
    const finite=electorate.length>1?Math.sqrt((electorate.length-n)/(electorate.length-1)):0;
    const poll={id:election.polls.length+1,minute:city.minute,population:electorate.length,cityPopulation,sampleSize:n,sampleFraction:n/Math.max(1,electorate.length),responses,results,undecided:responses.filter(r=>!r.decided).length,approval:n?responses.reduce((s,r)=>s+r.approval,0)/n:0,marginOfError:n?1.96*Math.sqrt(.25/n)*finite*100:0};
    election.polls.push(poll);this.event(election,`Pesquisa ${poll.id}: ${n}/${electorate.length} adultos sorteados, ${poll.undecided} indecisos. Estimativa amostral, sem antecipar a urna.`,'election-poll',[],{pollId:poll.id,sampleSize:n});return poll;
  }
  defame(nomination,election) {
    const city=this.city,p=city.politics,candidate=city.society.citizen(nomination.citizenId);if(!candidate||city.random()>(1-(candidate.traits?.honesty??.5))*.65)return;
    const opponents=election.candidates.filter(c=>c.citizenId!==nomination.citizenId);if(!opponents.length)return;const target=opponents[Math.floor(city.random()*opponents.length)];
    const accusations=['vai desviar o óleo dos postes','pretende abandonar as moradias populares','esconde um acordo para encarecer a comida','vai fechar as empresas e acabar com os empregos'];
    const claim=`${nomination.name} espalhou a alegação falsa de que ${target.name} ${accusations[Math.floor(city.random()*accusations.length)]}.`;
    const event=this.event(election,claim,'campaign-defamation',[nomination.citizenId,target.citizenId],{truth:false,accuserId:nomination.citizenId,targetId:target.citizenId});
    const listeners=this.sample(city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)),Math.max(1,Math.ceil(city.citizens.length*.12)));
    for(const listener of listeners){p.initializeCitizen(listener);const believes=city.random()<Math.max(.05,.65-(listener.traits?.skepticism??.5)*.4-(p.distance(listener.political.ideology,p.party(target.partyId).ideology)<.4?.15:0));p.remember(listener,{kind:'defamation',electionId:election.id,partyId:target.partyId,candidateId:target.citizenId,accuserId:nomination.citizenId,eventId:event.id,believes,truth:false,effect:believes?-8:0,description:`Ouviu a acusação não comprovada contra ${target.name}; ${believes?'acreditou':'desconfiou'}.`});}
  }
  factCheck(election) {
    const p=this.city.politics;
    for(const c of this.sample(this.city.citizens.filter(c=>!c.entity.destroyed&&c.political),Math.min(24,this.city.citizens.length))){const index=c.political.memories.findIndex(m=>m.electionId===election.id&&m.kind==='defamation'&&m.believes&&this.city.minute-m.minute>=360);if(index<0||this.city.random()>(c.traits?.skepticism??.5)*.4)continue;const old=c.political.memories[index];c.political.memories[index]=Object.freeze({...old,believes:false,effect:0,corrected:true,description:'Verificou que a acusação de campanha era falsa.'});p.remember(c,{kind:'campaign-correction',electionId:election.id,candidateId:old.accuserId,effect:-5,description:'Perdeu confiança em quem difundiu uma mentira eleitoral.'});this.event(election,`${c.entity.properties.name} contestou uma mentira eleitoral.`,'campaign-fact-check',[c.id,old.accuserId],{parentEventId:old.eventId});}
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
    const event=this.event(election,`Bandeiraço ${party.short}: campanha conjunta para prefeitura e Câmara.`,'campaign-rally',participants.map(c=>c.id),{partyId:party.id,x:destination.x,y:destination.y});let paths=0;
    for(const c of participants){if(paths++>=3)break;const path=city.findPath(c.entity,destination);if(path===null)continue;c.path=path;c.task='campaign';c.campaign={electionId:election.id,candidateId:nomination.citizenId,partyId:party.id,flag:party.flag,until:city.minute+120,destination,eventId:event.id};c.action=`Bandeiraço ${party.short}`;}
  }
  arrive(c) {
    const city=this.city,p=city.politics,campaign=c.campaign,e=p.active;if(!campaign||!e||e.id!==campaign.electionId||city.minute>=campaign.until||city.urgentNeed(c)){c.campaign=null;c.task=null;return;}
    c.action=`Bandeiraço ${p.party(campaign.partyId).short}: apresentando propostas`;
    if(city.minute-(campaign.lastOutreachAt??-Infinity)<30)return;campaign.lastOutreachAt=city.minute;
    const nomination=e.candidates.find(n=>n.citizenId===campaign.candidateId);if(!nomination)return;
    for(const voter of city.citizens.filter(v=>!v.entity.destroyed&&city.society.isAdult(v)&&Math.hypot(v.entity.x-c.entity.x,v.entity.y-c.entity.y)<5).slice(0,16)){this.hearPromises(voter,nomination,e,'Bandeiraço de rua');p.remember(voter,{kind:'campaign-rally',electionId:e.id,partyId:nomination.partyId,candidateId:nomination.citizenId,promiseKey:`rally:${e.id}:${nomination.citizenId}`,effect:3,description:'Conheceu a chapa conjunta para prefeitura e Câmara num bandeiraço.'});}
  }
  conversation(a,b) {
    const p=this.city.politics,e=p.active;if(!e||this.city.random()>.2||!this.city.society.isAdult(a)||!this.city.society.isAdult(b))return;
    p.initializeCitizen(a);p.initializeCitizen(b);const nomination=e.candidates.find(n=>n.endorsementPartyIds.includes(a.political.partyId));if(nomination)this.hearPromises(b,nomination,e,`Conversa com ${a.entity.properties.name}`);
  }
  daily(election) {
    const day=Math.min(2,Math.floor((this.city.minute-election.startedAt)/1440));if(election.lastCampaignDay===day)return;election.lastCampaignDay=day;
    for(const nomination of election.candidates){const audience=this.sample(this.city.citizens.filter(c=>!c.entity.destroyed&&this.city.society.isAdult(c)),Math.max(1,Math.ceil(this.city.citizens.length*.2)));for(const c of audience)this.hearPromises(c,nomination,election);this.defame(nomination,election);this.buyVotes(nomination,election);}
    this.poll(election);
  }
  hourly(election){for(const c of this.city.citizens)if(c.campaign&&(this.city.minute>=c.campaign.until||this.city.urgentNeed(c))){c.campaign=null;if(c.task==='campaign'){c.task=null;c.path=[];}}if(this.city.minute>=election.voteAt)return;this.daily(election);this.factCheck(election);const hour=Math.floor(this.city.minute/60);if(this.lastRallyHour!==hour&&this.city.hour>=7&&this.city.hour<20&&this.city.hour%3===0){this.lastRallyHour=hour;for(const nomination of this.sample(election.candidates,2))this.rally(nomination,election);}}
}
