import {canJoin} from './city_party_membership.js';
import {recordLegislativeOpinion,publicPerformance} from './city_party_public_record.js';
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
/** Public standing uses bounded opinion panels; secret crimes never enter these scores. */
export class CityPoliticalStanding {
  constructor(city){this.city=city;this.lastPeriod=null;}
  cases(){const p=this.city.politics;return [...new Map([...p.corruption,...p.scandals].map(r=>[r.id,r])).values()];}
  origins(record){return record.partyAffiliations?.length?record.partyAffiliations:[{citizenId:record.accusedId,partyId:record.partyId}];}
  accepted(c,party){
    for(const record of this.cases())if(this.origins(record).some(a=>a.citizenId===c.id)&&!this.origins(record).some(a=>a.partyId===party.id)){
      record.hostingParties??=[];if(!record.hostingParties.some(a=>a.partyId===party.id&&a.citizenId===c.id))record.hostingParties.push({partyId:party.id,citizenId:c.id,joinedAt:this.city.minute});
    }
    // Preserve hosting consequences even after the detailed case leaves retention.
    for(const origin of this.city.politics.parties)if(origin.id!==party.id)for(const incident of origin.reputationIncidents||[])if(incident.role==='origin'&&incident.proven&&(incident.citizenIds||[incident.citizenId]).includes(c.id)){
      party.reputationIncidents??=[];let host=party.reputationIncidents.find(i=>i.caseId===incident.caseId&&i.role==='host');
      if(!host){host={caseId:incident.caseId,role:'host',citizenId:c.id,citizenIds:[c.id],recordedAt:this.city.minute,occurredAt:incident.occurredAt,penalty:incident.penalty*.08,proven:true};party.reputationIncidents.push(host);const event=this.city.log(`${party.short} acolheu envolvido em escândalo de ${origin.short}; marca reputacional de ${host.penalty.toFixed(2)} pontos.`,'government',[c.id],{kind:'party-hosting-reputation',partyId:party.id,corruptionCaseId:incident.caseId,penalty:host.penalty});host.eventId=event.id;}
    }
    this.lastPeriod=null;
  }
  legislativeOpinion(bill,override=false){recordLegislativeOpinion(this,bill,override);}
  partyReputations(){
    const city=this.city,p=city.politics,adults=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)),living=new Set(adults.map(c=>c.id));
    for(const party of p.parties){party.reputationIncidents??=[];party.publicReputation??=50;}
    for(const record of this.cases()){
      if(record.discoveredAt==null)continue;
      const origins=this.origins(record),reach=(record.awareIds||[]).filter(id=>living.has(id)).length/Math.max(1,adults.length);
      // Record the receiving party even if the crime was only discovered after a move.
      for(const origin of origins){const c=city.society.citizen(origin.citizenId),party=p.party(c?.political?.partyId);if(party&&!origins.some(a=>a.partyId===party.id)){
        record.hostingParties??=[];if(!record.hostingParties.some(a=>a.partyId===party.id&&a.citizenId===c.id))record.hostingParties.push({partyId:party.id,citizenId:c.id,joinedAt:c.political.membershipSince});
      }}
      const affected=[...new Map(origins.filter(a=>a.partyId!=null).map(a=>[a.partyId,{...a,role:'origin'}])).values(),...new Map((record.hostingParties||[]).filter(a=>!origins.some(o=>o.partyId===a.partyId)).map(a=>[a.partyId,{...a,role:'host'}])).values()];
      for(const a of affected){const party=p.party(a.partyId);if(!party)continue;
        let incident=party.reputationIncidents.find(i=>i.caseId===record.id&&i.role===a.role);
        if(!incident){incident={caseId:record.id,role:a.role,citizenId:a.citizenId,recordedAt:city.minute,occurredAt:record.occurredAt,penalty:0,proven:false};party.reputationIncidents.push(incident);}
        incident.citizenIds=[...new Set((a.role==='origin'?origins:record.hostingParties||[]).filter(o=>o.partyId===party.id).map(o=>o.citizenId))];
        const before=incident.penalty,wasProven=incident.proven;
        const penalty=(record.severity||40)*(record.proven?.22:.03)*(.3+.7*reach)*(a.role==='host'?.08:1);
        incident.penalty=record.archived&&!record.proven?0:Math.max(incident.penalty,penalty);incident.proven=!!record.proven;
        if(Math.abs(before-incident.penalty)>=.5||wasProven!==incident.proven||!incident.eventId){
          const kind=a.role==='origin'?'party-scandal-reputation':'party-hosting-reputation';
          const event=city.log(`${party.short}: ${a.role==='origin'?'escândalo ocorrido durante a filiação':'acolhimento de envolvido em escândalo de outro partido'}; marca reputacional de ${incident.penalty.toFixed(2)} pontos.`,'government',[a.citizenId],{kind,partyId:party.id,corruptionCaseId:record.id,penalty:incident.penalty,role:a.role,proven:record.proven});incident.eventId=event.id;
        }
      }
    }
    for(const party of p.parties){const original=party.reputationIncidents.filter(i=>i.role==='origin').reduce((n,i)=>n+i.penalty,0),hosting=party.reputationIncidents.filter(i=>i.role==='host').reduce((n,i)=>n+i.penalty,0),effects=publicPerformance(p,party);
      party.publicReputation=clamp(50+effects.performance+effects.legislative-original-hosting);party.reputationReport={minute:city.minute,baseline:50,...effects,originalPenalty:original,hostingPenalty:hosting,score:party.publicReputation};
    }
  }
  refresh(force=false){
    const city=this.city,p=city.politics,period=Math.floor(city.minute/360);if(!force&&this.lastPeriod===period)return;this.lastPeriod=period;
    const voters=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c));for(const c of voters)p.initializeCitizen(c);
    this.partyReputations();const cases=this.cases().filter(r=>r.discoveredAt!=null),casesByCitizen=new Map();
    for(const record of cases){const item={record,aware:new Set(record.awareIds||[])};for(const id of new Set([record.accusedId,...this.origins(record).map(a=>a.citizenId)])){if(!casesByCitizen.has(id))casesByCitizen.set(id,[]);casesByCitizen.get(id).push(item);}}
    const candidates=voters.filter(c=>c.political.partyId||p.officeHolder(c)||c.political.tenure.mayor||p.active?.candidates.some(n=>n.citizenId===c.id));
    const size=Math.min(64,voters.length),offset=city.day*13%Math.max(1,voters.length),panel=Array.from({length:size},(_,i)=>voters[(offset+Math.floor(i*voters.length/Math.max(1,size)))%voters.length]);
    for(const c of candidates){const s=c.political,components=[{label:'Reputação pública pessoal',points:(city.reputation.score(c,'civic')-50)*.25},{label:'Comunicação e capacidade',points:((c.skills.social||0)-50)*.04+((c.skills.governance||0)-50)*.05},{label:'Balanço dos seus governos',points:p.mandates.recordScore(c.id,null)*.5},{label:'Avaliação como prefeito',points:c.id===city.economy.mayorId?(p.approval-50)*.35:0}];
      let relations=0,ideology=0,memories=0,scandals=0,votes=0;
      const ownVotes=p.parties.flatMap(party=>(party.publicRecords||[]).slice(-24).filter(r=>r.votes?.some(v=>v.citizenId===c.id)));
      for(const voter of panel){const view=city.relationships.view(voter,c);if(view)relations+=(view.trust-50)*.16+(view.affection-20)*.1-(view.resentment||0)*.2;if(voter.id===c.id)relations+=15;else if(city.society.related(voter,c))relations+=5;
        ideology+=(.5-p.distance(voter.political.ideology,s.ideology)/2.8)*8;
        memories+=clamp(voter.political.memories.filter(m=>m.candidateId===c.id&&['campaign-rally','defamation','campaign-accountability','campaign-correction'].includes(m.kind)).reduce((n,m)=>n+(m.effect||0),0),-20,15);
        for(const r of ownVotes){const vote=r.votes.find(v=>v.citizenId===c.id);votes+=(r.individualOpinions?.[voter.id]||0)*(vote.yes?1:-1)*.5;}
        for(const {record:r,aware} of casesByCitizen.get(c.id)||[])if(aware.has(voter.id))scandals-=(r.severity||40)*(r.proven?.3:.04);
      }
      for(const [label,value] of [['Relações e família',relations],['Afinidade das ideias',ideology],['Memória das campanhas',memories],['Votos na Câmara',votes],['Escândalos conhecidos',scandals]])components.push({label,points:value/Math.max(1,panel.length)});
      const raw=50+components.reduce((n,a)=>n+a.points,0);s.popularity=clamp(raw);s.popularityReport={minute:city.minute,score:s.popularity,raw,sampleSize:panel.length,electorate:voters.length,components};
    }
    for(const party of p.parties.filter(a=>a.active)){const {candidate,reason}=this.nomination(party);party.preferredCandidateId=candidate?.id??null;party.nominationReason=reason;}
  }
  compare(a,b){return (b.political?.popularity??50)-(a.political?.popularity??50)||this.city.politics.candidateStrength(b)-this.city.politics.candidateStrength(a)||a.id-b.id;}
  recruitConventionNominee(party){
    const city=this.city,p=city.politics;if(this.nomination(party).candidate)return null;
    const willing=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&p.eligible(c)&&(p.policy.entrepreneurCandidates!==false||(!c.businessIds?.length&&!city.development.projects.some(project=>(project.id===c.startupProjectId||project.accountId===c.accountId)&&!project.cancelled&&project.status!=='completed')))&&!c.political.partyId&&!c.political.foundingProposalId&&c.political.membershipCooldownUntil<=city.minute&&c.political.engagement>.45&&p.distance(c.political.ideology,party.ideology)<.95).sort((a,b)=>p.distance(a.political.ideology,party.ideology)-p.distance(b.political.ideology,party.ideology)||this.compare(a,b));
    const c=willing[0];if(!c||!canJoin(p,c)||!p.join(c,party,'Convite aceito na convenção para disputar a eleição'))return null;
    city.log(`${party.short} convidou ${c.entity.properties.name}, que aceitou se filiar para apresentar uma candidatura.`,'government',[c.id],{kind:'convention-candidate-recruited',partyId:party.id});return c;
  }
  nomination(party){
    const p=this.city.politics,research=p.getResearch?.(),survey=research?.studies.filter(s=>s.mode==='service'&&s.status==='published'&&s.serviceType==='party-candidates'&&s.subjectId===party.id).sort((a,b)=>b.completedAt-a.completedAt)[0],surveyScore=c=>survey?.report?.rows.find(r=>r.citizenId===c.id)?.score,score=c=>surveyScore(c)==null?(c.political?.popularity??50):((c.political?.popularity??50)*.4+surveyScore(c)*.6),possible=party.memberIds.map(id=>this.city.society.citizen(id)).filter(c=>p.canRun(c,'mayor',true)).sort((a,b)=>score(b)-score(a)||this.compare(a,b));
    const incumbent=possible.find(c=>c.id===this.city.economy.mayorId),preferred=possible.find(c=>c.id===party.executiveSuccessorId&&party.executiveSuccessionTerm===p.termNumber);
    return {candidate:incumbent||preferred||possible[0],reason:incumbent?'Preferência do prefeito em exercício':preferred?'Sucessão pelo vice-prefeito':survey?'Melhor combinação entre popularidade e pesquisa contratada':'Maior popularidade no partido'};
  }
  replaceUnavailable(){
    const city=this.city,p=city.politics,e=p.active;if(!e||e.status!=='campaign')return;
    for(const n of e.candidates){const old=city.society.citizen(n.citizenId);if(old&&p.canRun(old,'mayor',true)&&old.political.partyId===n.partyId)continue;
      const party=p.party(n.partyId);if(!party?.active)continue;
      const vice=city.society.citizen(n.viceId),replacement=vice&&vice.political.partyId===party.id&&p.canRun(vice,'mayor',true)?vice:this.nomination(party).candidate;if(!replacement)continue;
      const previousId=n.citizenId,previousName=n.name;n.citizenId=replacement.id;n.name=replacement.entity.properties.name;n.platform=p.platform(replacement);n.popularityAtNomination=replacement.political.popularity;n.nominationReason=replacement===vice?'Sucessão da candidatura pelo vice':'Substituição por maior popularidade';n.promises=p.mandates.program(replacement,party,e.candidates.filter(a=>a!==n).flatMap(a=>a.promises.map(pr=>pr.metric)));delete n.memoryPromises;
      const successor=party.memberIds.map(id=>city.society.citizen(id)).filter(c=>c&&c.id!==replacement.id&&p.canRun(c,'council',true)).sort((a,b)=>this.compare(a,b))[0];n.viceId=successor?.id??null;n.viceName=successor?.entity.properties.name??null;
      e.councilCandidates=e.councilCandidates.filter(c=>c.citizenId!==replacement.id&&c.citizenId!==n.viceId);
      p.campaigns.event(e,`${n.name} substituiu ${previousName} na candidatura de ${party.short}: ${n.nominationReason}.`,'candidate-replaced',[previousId,replacement.id],{partyId:party.id,previousCandidateId:previousId,candidateId:replacement.id,reason:n.nominationReason});
      for(const voter of p.campaigns.audience(Math.max(1,Math.ceil(city.citizens.length*.2))))p.campaigns.hearPromises(voter,n,e,'Substituição da chapa');
    }
  }
}
