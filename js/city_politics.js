// Municipal adaptation of Brutopolis' candidate ranking, voter details and political history.
export const POLITICS_RULES = { termMinutes: 12 * 1440, campaignMinutes: 3 * 1440, maxCandidates: 8, retainedElections: 24 };
export const POLITICAL_PLATFORMS = {
  social: { label: 'Proteção social', taxRate: .18, dailyBudget: 160000, dailyLimit: 80000 },
  balanced: { label: 'Serviços e equilíbrio', taxRate: .1, dailyBudget: 100000, dailyLimit: 60000 },
  thrift: { label: 'Tributos menores e reserva', taxRate: .03, dailyBudget: 60000, dailyLimit: 40000 },
};
export class CityPolitics {
  constructor(city) {
    this.city=city;this.elections=[];this.active=null;this.nextId=1;this.termStartedAt=null;this.nextElectionAt=null;
    this.approval=50;this.lastResult=null;this.baseline=null;
  }
  platform(c) { return (c.traits?.empathy??.5)-(c.traits?.frugality??.5)>.15?'social':(c.traits?.frugality??.5)-(c.traits?.empathy??.5)>.15?'thrift':'balanced'; }
  eligible(c) { return c && !c.entity.destroyed && this.city.society.isAdult(c) && !c.businessIds.length && !this.city.development.projects.some(p=>p.id===c.startupProjectId && !p.cancelled && p.status!=='completed'); }
  ensureMayor() {
    const city=this.city, current=city.society.citizen(city.economy.mayorId);
    if(current) {
      const hall=city.buildings.find(b=>b.type==='townhall' && !b.entity.destroyed);
      if(hall && current.jobId!==hall.id){city.economy.leaveJob(current,'Retorno à sede municipal');current.jobId=hall.id;if(!hall.workers.includes(current.id))hall.workers.push(current.id);}
      return current;
    }
    const candidate=city.citizens.filter(c=>this.eligible(c)).sort((a,b)=>b.skills.governance-a.skills.governance || a.id-b.id)[0];
    if(!candidate)return null;
    this.takeOffice(candidate, 'Posse provisória');
    if(this.nextElectionAt===null) {this.termStartedAt=city.minute;this.nextElectionAt=city.minute+POLITICS_RULES.termMinutes;this.baseline=this.conditions();}
    else this.nextElectionAt=Math.min(this.nextElectionAt,city.minute+1440);
    return candidate;
  }
  takeOffice(c,reason,election=null) {
    const city=this.city, old=city.society.citizen(city.economy.mayorId);
    if(old && old.id!==c.id){old.role='citizen';city.economy.leaveJob(old,'Encerramento do mandato');}
    if(c.deliveryId){const shipment=city.logistics.shipments.find(s=>s.id===c.deliveryId);if(shipment){if(shipment.pickedUp)shipment.position={x:c.entity.x,y:c.entity.y};city.logistics.releaseDriver(shipment);shipment.status='waiting';}}
    city.sanitation.releaseCitizen(c);city.economy.leaveJob(c,reason);c.workMeal=null;
    city.economy.mayorId=c.id;c.role='mayor';
    const hall=city.buildings.find(b=>b.type==='townhall' && !b.entity.destroyed);
    if(hall){c.jobId=hall.id;if(!hall.workers.includes(c.id))hall.workers.push(c.id);city.history.employment(c,hall,'posse na prefeitura',reason);}
    city.log(`${c.entity.properties.name} assumiu a prefeitura: ${reason.toLowerCase()}.`,'government',[old?.id,c.id].filter(id=>id!=null),{kind:'mayor-appointed',buildingId:hall?.id,electionId:election?.id});
  }
  conditions() {
    const city=this.city,people=city.citizens.filter(c=>!c.entity.destroyed),n=Math.max(1,people.length);
    return { happiness:people.reduce((s,c)=>s+c.happiness,0)/n, homeless:people.filter(c=>!c.homeUnitId).length/n,
      hunger:people.filter(c=>c.needs.food<30).length/n, employment:people.filter(c=>c.jobId||c.businessIds.length).length/n };
  }
  updateApproval() {
    const now=this.conditions(),base=this.baseline||now;
    this.approval=Math.max(0,Math.min(100,now.happiness*.55+(1-now.homeless)*15+(1-now.hunger)*15+now.employment*15+(now.happiness-base.happiness)*.5));
  }
  beginElection() {
    const city=this.city;
    const possible=city.citizens.filter(c=>this.eligible(c));
    possible.sort((a,b)=>(b.skills.governance+(b.traits?.ambition??.5)*20+city.reputation.score(b,'civic')*.2)-(a.skills.governance+(a.traits?.ambition??.5)*20+city.reputation.score(a,'civic')*.2)||a.id-b.id);
    const candidates=possible.slice(0,POLITICS_RULES.maxCandidates);
    const incumbent=city.society.citizen(city.economy.mayorId);
    if(this.eligible(incumbent) && !candidates.includes(incumbent)) {if(candidates.length===POLITICS_RULES.maxCandidates)candidates.pop();candidates.push(incumbent);}
    const election={id:this.nextId++,startedAt:city.minute,voteAt:this.nextElectionAt,candidates:candidates.map(c=>({citizenId:c.id,name:c.entity.properties.name,platform:this.platform(c)})),status:'campaign',ballots:[],ranking:[]};
    const event=city.log(`Eleição municipal ${election.id}: ${candidates.length} candidaturas; votação no dia ${Math.floor(election.voteAt/1440)+1}.`,'government',candidates.map(c=>c.id),{kind:'election-opened',electionId:election.id});
    election.eventId=event.id;this.active=election;
  }
  voterScore(voter,candidate,platform) {
    const city=this.city,relation=city.relationships.view(voter,candidate),preferred=this.platform(voter);
    const civic=city.reputation.score(candidate,'civic'),honesty=candidate.traits?.honesty??.5;
    return candidate.skills.governance*.45+civic*.25+(relation?.trust??15)*.1+honesty*8+
      (preferred===platform?16:0)+(voter.id===candidate.id?8:0)+
      (candidate.id===city.economy.mayorId?(this.approval-50)*.5:0)+
      // Each voter has a stable personal tie-break, without rerolling preferences every frame.
      ((Math.imul(voter.id+7,candidate.id+31)>>>0)%101)/100;
  }
  vote() {
    const city=this.city,election=this.active;if(!election)return;
    const candidates=election.candidates.filter(p=>this.eligible(city.society.citizen(p.citizenId)));
    if(!candidates.length){election.status='cancelled';this.retain(election);this.active=null;this.nextElectionAt=city.minute+1440;city.log('Eleição adiada: nenhuma candidatura elegível.','government',[],{kind:'election-postponed',electionId:election.id});return;}
    const counts=new Map(candidates.map(c=>[c.citizenId,0]));
    for(const voter of city.citizens.filter(c=>city.society.isAdult(c) && !c.entity.destroyed)) {
      const scores=candidates.map(p=>({citizenId:p.citizenId,score:this.voterScore(voter,city.society.citizen(p.citizenId),p.platform)})).sort((a,b)=>b.score-a.score || a.citizenId-b.citizenId);
      const chosen=scores[0];counts.set(chosen.citizenId,counts.get(chosen.citizenId)+1);
      const ballot={citizenId:voter.id,name:voter.entity.properties.name,candidateId:chosen.citizenId,score:chosen.score};election.ballots.push(ballot);
      city.history.record('government',`${voter.entity.properties.name} votou em ${city.accountName(`citizen:${chosen.citizenId}`)}.`,[voter.accountId],{action:'vote',electionId:election.id,candidateId:chosen.citizenId,score:chosen.score,parentEventId:election.eventId});
    }
    election.ranking=candidates.map(c=>({...c,votes:counts.get(c.citizenId)})).sort((a,b)=>b.votes-a.votes||city.society.citizen(b.citizenId).skills.governance-city.society.citizen(a.citizenId).skills.governance||a.citizenId-b.citizenId);
    const winner=election.ranking[0];election.winnerId=winner.citizenId;election.completedAt=city.minute;election.status='completed';
    election.turnout=election.ballots.length;election.approval=this.approval;
    this.takeOffice(city.society.citizen(winner.citizenId),'Eleição municipal',election);
    this.applyPlatform(winner.platform,election);
    city.log(`${winner.name} venceu a eleição ${election.id} com ${winner.votes} de ${election.turnout} votos. Desempates: administração pública, depois cadastro.`,'government',election.candidates.map(c=>c.citizenId),{kind:'election-completed',electionId:election.id,winnerId:winner.citizenId,votes:winner.votes,turnout:election.turnout,parentEventId:election.eventId});
    this.lastResult=election;this.retain(election);this.active=null;this.termStartedAt=city.minute;this.nextElectionAt=city.minute+POLITICS_RULES.termMinutes;this.baseline=this.conditions();
  }
  applyPlatform(id,election) {
    const city=this.city,p=POLITICAL_PLATFORMS[id];
    city.taxRate=p.taxRate;city.welfare.policy.dailyBudget=p.dailyBudget;city.welfare.policy.enabled=true;city.currency.policy.dailyLimit=p.dailyLimit;
    election.appliedPolicy={...p};
    city.history.record('government',`Programa eleito aplicado: ${p.label}; imposto ${Math.round(p.taxRate*100)}%, benefícios R$ ${(p.dailyBudget/100).toFixed(2)}/dia e teto de emissão R$ ${(p.dailyLimit/100).toFixed(2)}/dia.`,['treasury',`citizen:${election.winnerId}`],{action:'elected-policy',electionId:election.id,...p});
  }
  retain(election) {this.elections.push(election);if(this.elections.length>POLITICS_RULES.retainedElections)this.elections.shift();}
  hourly() {
    this.ensureMayor();this.updateApproval();
    if(this.nextElectionAt===null)return;
    if(!this.active && this.city.minute>=this.nextElectionAt-POLITICS_RULES.campaignMinutes)this.beginElection();
    if(this.active && this.city.minute>=this.active.voteAt)this.vote();
  }
}
