import {partyAccount,allocatePartyFunds,changePartyFund,illegalPartyFunding} from './city_party_funds.js';
import {appearance} from './city_clothing.js';
import {CityResearch} from './city_research.js';
import {CityGovernmentAgenda} from './city_government_agenda.js';
import {CityVoting} from './city_voting.js';
import {CityPoliticalStanding} from './city_political_standing.js';
import {CityPartyOrganization,PARTY_ORGANIZATION_RULES} from './city_party_organization.js';
import {makePartyName,partyNameAgenda} from './city_party_names.js';
import {syncPartyColor,membershipProfile,organizeMembership,reviewMembership,campaignContact,canJoin,leaveParty} from './city_party_membership.js';
import { seatBounds, scandalEligible, criticalApproval, organizeScheme, investigateCases } from './city_political_institutions.js';
import { CityPolitics, POLITICAL_PLATFORMS, POLITICS_RULES } from './city_politics.js';
import { makePartyFlag, COUNCIL_INSTITUTIONAL_FLAG } from './city_party_flags.js';
import { CityCouncil } from './city_council.js';
import { CityCampaigns } from './city_campaigns.js';
import { CityMandates, promiseRelevant } from './city_mandates.js';
import { ROAD_TILES, tileAt } from './city_terrain.js';

// Ideological starting points; names are generated separately from word pools.
export const PARTY_FAMILIES=[[-1,.2,.35],[-.65,.3,.2],[-.4,.65,1],[-.2,.3,.45],[.05,.05,.25],[.7,.7,.15],[.6,-.75,.1],[1,1,.25]];
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
export class CityGovernment extends CityPolitics {
  constructor(city){super(city);this.termNumber=0;this.parties=[];this.nextPartyId=1;this.policy={termDays:12,campaignDays:3,partyLimit:8,reelectionLimit:1,minimumWage:5,pollMinRate:5,pollMaxRate:20,businessTax:0,infrastructurePriority:'traffic',councilBudget:9600,mayorBudget:3000,councilRate:5,partyFund:80000};this.termRules=Object.freeze({termMinutes:POLITICS_RULES.termMinutes,campaignMinutes:POLITICS_RULES.campaignMinutes});this.council=new CityCouncil(city);this.mandates=new CityMandates(city);this.campaigns=new CityCampaigns(city);this.research=new CityResearch(city);this.organization=new CityPartyOrganization(city);this.standing=new CityPoliticalStanding(city);this.voting=new CityVoting(city);this.agenda=new CityGovernmentAgenda(city);this.corruption=[];this.scandals=[];this.nextCaseId=1;this.lastDaily=null;this.viceMayorId=null;this.vetoes=[];this.lowApprovalSince=null;this.suspendedExecutive=null;}
  partyAccount(party){return partyAccount(this,party);}
  changePartyFund(value,bill){return changePartyFund(this,value,bill);}
  getResearch(){return this.research??=new CityResearch(this.city);}
  assignPartyNumbers(){for(const party of this.parties.filter(p=>!p.active)){if(!Number.isInteger(party.number)||party.number<10||party.number>99)party.number=10+party.id*17%90;party.ballotLabel=`${party.number} · ${party.short}`;}const used=new Set();for(const party of this.parties.filter(p=>p.active)){if(!Number.isInteger(party.number)||party.number<10||party.number>99||used.has(party.number)){const free=Array.from({length:90},(_,i)=>10+(i+party.id*17)%90).find(n=>!used.has(n));party.number=free??null;}if(party.number!=null)used.add(party.number);party.ballotLabel=`${party.number??'—'} · ${party.short}`;}}
  party(id){return this.parties.find(p=>p.id===id);}
  partyOfId(id){return this.party(this.city.society.citizen(id)?.political?.partyId);}
  syncGoverningFlag(){
    for(const b of this.city.buildings)if(['townhall','council_chamber'].includes(b.type)&&!b.entity.destroyed){const party=this.partyOfId(b.type==='townhall'?this.city.economy.mayorId:this.council.leaderId);b.governingPartyId=party?.id??null;b.governingPartyName=party?.name??null;b.governingFlag=party?.flag??(b.type==='council_chamber'?COUNCIL_INSTITUTIONAL_FLAG:null);b.governingFlagDescription=party?`Bandeira de ${party.name}`:b.type==='council_chamber'?'Bandeira institucional: presidência ainda não eleita':null;}
  }
  platform(c){const party=this.party(c?.political?.partyId),agenda=party?(party.nameAgenda||partyNameAgenda(party.name)):null,e=clamp((party?.ideology.economy??c?.political?.ideology.economy??0)+(agenda?.economy||0)*.7,-1,1);return e<-.3||(agenda?.social||0)>.25||(agenda?.state||0)>.4?'social':e>.3||(agenda?.state||0)<-.3?'thrift':'balanced';}
  officeHolder(c){return !!c&&(c.id===this.city.economy.mayorId||c.id===this.viceMayorId||c.id===this.suspendedExecutive?.citizenId||this.council.members.some(m=>m.citizenId===c.id));}
  submitBill(type,payload={},authorId=null){const author=this.city.society.citizen(authorId)||this.council.people()[0];if(!author||!this.council.members.some(m=>m.citizenId===author.id))return this.city.fail('Selecione um vereador em exercício.');if(['tax','businessTax','minimumWage','partyLimit','reelectionLimit','termDays','campaignDays','pollMinRate','pollMaxRate','inflation','welfare','councilSeats','councilRate','councilBudget','mayorBudget','partyFund'].includes(type)&&!Number.isFinite(payload.value))return this.city.fail('Valor de proposta inválido.');if(['nationalize','privatize'].includes(type)&&!this.city.building(payload.buildingId))return this.city.fail('Empresa indisponível.');if(type==='impeach'&&!this.scandals.some(s=>s.id===payload.caseId&&(s.accusedId===payload.targetId||s.participantIds?.includes(payload.targetId))&&scandalEligible(this,s)))return this.city.fail('Cassação exige provas, gravidade e grande repercussão popular.');this.city.lastError='';const proposal=this.council.propose(author,type,payload);return proposal===false?false:proposal||(this.city.lastError?null:this.city.fail('Já existe proposta semelhante em tramitação ou o tipo é inválido.'));}
  canOwnBusiness(c){return c&&!c.entity.destroyed&&this.city.society.isAdult(c)&&!this.officeHolder(c);}
  initializeCitizen(c){if(c.political){membershipProfile(this,c);return;}const t=c.traits||{},bias=((Math.imul(c.id+113,2246822519)>>>0)%1001)/500-1;c.political={ideology:Object.freeze({economy:clamp(((t.frugality??.5)-(t.empathy??.5))*1.4+bias*.75,-1,1),liberty:clamp(((t.openness??.5)-.5)*1.4+(((c.id*31)%101)/50-1)*.6,-1,1),green:clamp((t.empathy??.5)*.5+((c.id*17)%101)/200,0,1)}),partyId:null,criticalSense:Math.min(1,.2+(t.openness??.5)*.35+this.city.random()*.35),loyalty:0,memories:[],blockedUntilTerm:0,tenure:{},bribes:[],lastPoliticalTalkAt:-Infinity};membershipProfile(this,c);}
  eligible(c){return super.eligible(c)&&(!c.political||c.political.blockedUntilTerm<=this.termNumber);}
  isProvisionalMayor(c=this.city.society.citizen(this.city.economy.mayorId)){return !!c&&c.id===this.provisionalMayorId&&c.id===this.city.economy.mayorId&&this.termNumber===0;}
  canRun(c,office='mayor',nextTerm=false){if(!super.eligible(c))return false;if(office==='mayor'&&nextTerm&&this.termNumber===0&&c.id===this.provisionalMayorId)return false;this.initializeCitizen(c);if(!this.party(c.political.partyId)?.active||this.party(c.political.partyId).retiring)return false;const record=c.political.tenure[office],term=this.termNumber+(nextTerm?1:0);if(c.political.blockedUntilTerm>term)return false;return !record||record.lastTerm<term-1||record.count<1+this.policy.reelectionLimit;}
  distance(a,b){return Math.abs(a.economy-b.economy)+Math.abs(a.liberty-b.liberty)*.35+Math.abs(a.green-b.green)*.3;}
  remember(c,record){this.initializeCitizen(c);const memory={minute:this.city.minute,...record};if(memory.promises)memory.promises=Object.freeze(memory.promises);const key=record.termId?`term:${record.termId}`:record.promiseKey||null;if(key){const i=c.political.memories.findIndex(m=>m.key===key);if(i>=0)c.political.memories.splice(i,1);memory.key=key;}c.political.memories.push(Object.freeze(memory));if(c.political.memories.length>48){const i=c.political.memories.findIndex(m=>!['campaign-promise','government-record','proven-scandal'].includes(m.kind));c.political.memories.splice(i>=0?i:0,1);}}
  createParty({initial=false,proposalId=null}={}){
    if(this.parties.filter(p=>p.active).length>=this.policy.partyLimit)return null;
    const proposal=this.organization.proposals.find(r=>r.id===proposalId);
    if(initial?this.parties.length>=PARTY_ORGANIZATION_RULES.initialParties:!proposal||proposal.status!=='approved'||proposal.partyId!=null)return null;
    const id=this.nextPartyId++,[economy,liberty,green]=PARTY_FAMILIES[[0,2,5,6][(id-1)%4]];
    const ideology=proposal?.ideology||Object.freeze({economy,liberty,green});
    const naming=proposal?Object.fromEntries(['name','short','nameFlavor','nameCore','nameVersion'].map(key=>[key,proposal[key]])):makePartyName(this.city,ideology,this.parties,id);
    const party={id,...naming,ideology,nameAgenda:naming.nameAgenda||partyNameAgenda(naming.name),parentPartyId:proposal?.parentPartyId??null,approvalId:proposalId,flag:makePartyFlag(this.city,id-1),active:true,memberIds:[],leaderId:null,successorIds:[],history:[],foundedAt:this.city.minute};
    this.parties.push(party);this.partyAccount(party);this.assignPartyNumbers();this.city.log(`${party.name} foi registrado.`,'government',proposal?.founderIds||[],{kind:'party-founded',partyId:id,partyProposalId:proposalId});return party;
  }
  fillParties(){
    if(this.initialPartiesCreated||this.parties.length){this.initialPartiesCreated=true;return;}
    this.initialPartiesCreated=true;const target=Math.min(PARTY_ORGANIZATION_RULES.initialParties,this.policy.partyLimit);
    while(this.parties.length<target)if(!this.createParty({initial:true}))break;
  }
  liquidateEmptyParties(){
    const living=new Map(this.parties.filter(p=>p.active).map(p=>[p.id,[]]));
    for(const c of this.city.citizens)if(!c.entity.destroyed&&living.has(c.political?.partyId))living.get(c.political.partyId).push(c.id);
    for(const party of this.parties){if(!party.active)continue;const members=living.get(party.id)||[];if(party.memberIds.length!==members.length||party.memberIds.some((id,i)=>id!==members[i]))party.memberIds=members;if(members.length)continue;
      const account=this.partyAccount(party);if(account.balance>0)this.city.transfer(account.accountId,'treasury',account.balance,'Liquidação de fundo partidário',{partyId:party.id});party.active=false;party.retiring=false;party.liquidatedAt=this.city.minute;party.leaderId=null;party.successorIds=[];
      party.history.push(Object.freeze({minute:this.city.minute,description:'Liquidado por ausência de filiados vivos.'}));
      this.city.log(`${party.name} foi liquidado por não ter filiados vivos.`,'government',[],{kind:'party-liquidated',partyId:party.id});
    }
  }
  join(c,party,reason='Afinidade ideológica'){this.initializeCitizen(c);if(!party?.active||!canJoin(this,c))return false;const old=this.party(c.political.partyId);if(old?.id===party.id)return true;if(old){old.memberIds=old.memberIds.filter(id=>id!==c.id);c.political.lastPartyId=old.id;c.political.lastPartyDepartureAt=this.city.minute;}c.political.partyId=party.id;syncPartyColor(this,c);c.political.membershipSince=this.city.minute;c.political.loyalty=Math.max(.3,c.political.engagement*.7);if(!party.memberIds.includes(c.id))party.memberIds.push(c.id);for(const m of this.council.members)if(m.citizenId===c.id)m.partyId=party.id;this.remember(c,{kind:'party-membership',partyId:party.id,description:`Filiação a ${party.short}: ${reason}.`});this.standing.accepted(c,party);if(c.id===this.city.economy.mayorId||c.id===this.council.leaderId)this.syncGoverningFlag();return true;}
  campaignContact(voter,nomination,election,source){campaignContact(this,voter,nomination,election,source);}

  mergeParty(party){const destination=this.parties.filter(p=>p.active&&p.id!==party.id).sort((a,b)=>this.distance(party.ideology,a.ideology)-this.distance(party.ideology,b.ideology))[0];if(!destination)return;for(const id of [...party.memberIds]){const c=this.city.society.citizen(id);if(c){if(this.officeHolder(c)||this.distance(c.political.ideology,destination.ideology)<.8)this.join(c,destination,'Fusão aprovada pela Câmara');else leaveParty(this,c,'Não concordou com a fusão aprovada pela Câmara');}}const account=this.partyAccount(party);if(account.balance)this.city.transfer(account.accountId,this.partyAccount(destination).accountId,account.balance,'Transferência de fundo por fusão partidária',{partyId:party.id,destinationPartyId:destination.id});party.active=false;party.mergedInto=destination.id;party.history.push(Object.freeze({minute:this.city.minute,description:`Fusão com ${destination.short}`}));}
  organize(){this.assignPartyNumbers();
    for(const party of this.parties)if((party.nameVersion||0)<3){const previousName=party.name;Object.assign(party,makePartyName(this.city,party.ideology,this.parties,party.id,{parentParty:this.party(party.parentPartyId)}));party.history.push(Object.freeze({minute:this.city.minute,previousName,description:`Nome registrado: ${party.name}`}));}
    this.fillParties();const adults=this.city.citizens.filter(c=>!c.entity.destroyed&&this.city.society.isAdult(c));for(const c of adults)this.initializeCitizen(c);
    organizeMembership(this,adults);this.liquidateEmptyParties();this.standing.refresh(true);
    for(const party of this.parties.filter(p=>p.active)){party.memberIds=party.memberIds.filter(id=>this.city.society.citizen(id));const leaders=party.memberIds.map(id=>this.city.society.citizen(id)).filter(c=>this.eligible(c)).sort((a,b)=>this.standing.compare(a,b)),old=party.leaderId;party.leaderId=leaders[0]?.id??null;party.successorIds=leaders.slice(1,5).map(c=>c.id);if(old!==party.leaderId){party.history.push(Object.freeze({minute:this.city.minute,leaderId:party.leaderId,description:`Liderança: ${leaders[0]?.entity.properties.name||'vaga'}`}));if(party.history.length>24)party.history.shift();}}
  }
  candidateStrength(c){return c.skills.governance+(c.traits?.ambition??.5)*20+this.city.reputation.score(c,'civic')*.2;}
  releaseDuties(c,reason){if(c.mobilityTrip)this.city.vehicles.releaseTrip(c);if(c.deliveryId){const s=this.city.logistics.shipments.find(s=>s.id===c.deliveryId);if(s){if(s.pickedUp)s.position={x:c.entity.x,y:c.entity.y};this.city.logistics.releaseDriver(s);s.status='waiting';}}if(c.researchAssignment){const research=this.getResearch(),study=research.studies.find(s=>s.id===c.researchAssignment.studyId),session=study?.sessions.find(s=>s.id===c.researchAssignment.sessionId);if(session)research.releaseAgent(study,session,reason);else c.researchAssignment=null;}this.city.sanitation.releaseCitizen(c);this.city.economy.leaveJob(c,reason);c.workMeal=null;c.campaign=null;c.task=null;c.path=[];}
  ensureMayor(){
    const city=this.city,current=city.society.citizen(city.economy.mayorId);
    if(current){const mayor=super.ensureMayor();this.syncGoverningFlag();return mayor;}
    this.organize();
    const successor=[this.viceMayorId,this.council.leaderId].map(id=>city.society.citizen(id)).find(c=>c&&super.eligible(c)&&(!c.political||c.political.blockedUntilTerm<=this.termNumber));
    if(successor){if(successor.id===this.viceMayorId&&!this.suspendedExecutive){const party=this.party(successor.political.partyId);if(party){party.executiveSuccessorId=successor.id;party.executiveSuccessionTerm=this.termNumber;}}if(this.suspendedExecutive)this.takeActingOffice(successor,'Substituição durante afastamento');else{if(successor.id===this.viceMayorId)this.viceMayorId=null;this.takeOffice(successor,'Sucessão constitucional');}return successor;}
    const governing=this.mandates.current?.partyId??this.vacancyPartyId,candidates=city.citizens.filter(c=>this.canRun(c));
    candidates.sort((a,b)=>Number(b.political.partyId===governing)-Number(a.political.partyId===governing)||this.candidateStrength(b)-this.candidateStrength(a));
    const c=candidates[0];if(!c){this.syncGoverningFlag();return null;}if(this.suspendedExecutive)this.takeActingOffice(c,'Substituição provisória durante afastamento');else this.takeOffice(c,'Posse provisória');this.vacancyPartyId=null;
    if(this.nextElectionAt===null){this.termStartedAt=city.minute;this.nextElectionAt=city.minute+this.termRules.termMinutes;this.baseline=this.conditions();}else this.nextElectionAt=Math.min(this.nextElectionAt,city.minute+this.termRules.campaignMinutes);
    if(!this.lastResult&&!this.viceMayorId){const vice=this.city.citizens.filter(v=>v.id!==c.id&&this.canRun(v)&&v.political.partyId===c.political.partyId).sort((a,b)=>this.candidateStrength(b)-this.candidateStrength(a))[0];if(vice){this.viceMayorId=vice.id;vice.role='vice-mayor';this.council.remove(vice.id,'Vice-prefeitura provisória');}}this.council.ensure();return c;
  }
  takeOffice(c,reason,election=null){if(this.provisionalMayorId==null&&this.termNumber===0&&!this.mandates.terms.length&&!election){this.provisionalMayorId=c.id;c.wasProvisionalMayor=true;reason='Posse como prefeito provisório da fundação';}this.lowApprovalSince=null;this.initializeCitizen(c);if(!c.political.partyId)this.organize();this.mandates.finish(reason);this.council.remove(c.id,'Posse na prefeitura');this.releaseDuties(c,reason);super.takeOffice(c,reason,election);const old=c.political.tenure.mayor;c.political.tenure.mayor={count:old&&old.lastTerm===this.termNumber?old.count:old&&old.lastTerm===this.termNumber-1?old.count+1:1,lastTerm:this.termNumber};const party=this.party(c.political.partyId),nomination=election?.candidates.find(p=>p.citizenId===c.id);this.mandates.start(c,party,nomination?.promises||this.mandates.program(c,party),election?.id??null);if(this.isProvisionalMayor(c)){c.role='provisional-mayor';this.mandates.current.provisional=true;}this.syncGoverningFlag();}
  roadConnected(b){return !!b.accessPath?.length && b.accessPath.every(p=>p&&ROAD_TILES.has(tileAt(this.city.world,Math.floor(p.x),Math.floor(p.y))));}
  beginElection(){this.nextElectionAt=this.voting.schedule(this.nextElectionAt??this.city.minute);this.organize();const city=this.city,candidates=[],councilCandidates=[],campaignMetrics=this.mandates.metrics();
    for(const party of this.parties.filter(p=>p.active&&!p.retiring)){const {candidate:leader,reason:nominationReason}=this.standing.nomination(party);if(leader)candidates.push({citizenId:leader.id,name:leader.entity.properties.name,partyId:party.id,partyNumber:party.number,popularityAtNomination:leader.political.popularity,nominationReason,platform:this.platform(leader),promises:this.mandates.program(leader,party,candidates.flatMap(n=>n.promises.map(pr=>pr.metric)),campaignMetrics),endorsementPartyIds:[party.id]});for(const c of party.memberIds.map(id=>city.society.citizen(id)).filter(c=>this.canRun(c,'council',true)&&c.id!==leader?.id).sort((a,b)=>this.candidateStrength(b)-this.candidateStrength(a)).slice(0,this.council.seats))councilCandidates.push({citizenId:c.id,name:c.entity.properties.name,partyId:party.id,partyNumber:party.number});}
    for(const nomination of candidates){const vice=councilCandidates.filter(n=>n.partyId===nomination.partyId).sort((a,b)=>this.standing.compare(city.society.citizen(a.citizenId),city.society.citizen(b.citizenId)))[0];nomination.viceId=vice?.citizenId??null;nomination.viceName=vice?.name??null;}
    const viceIds=new Set(candidates.map(n=>n.viceId));for(let i=councilCandidates.length-1;i>=0;i--)if(viceIds.has(councilCandidates[i].citizenId))councilCandidates.splice(i,1);
    for(const party of this.parties.filter(p=>p.active&&!candidates.some(c=>c.partyId===p.id))){const ally=candidates.slice().sort((a,b)=>this.distance(party.ideology,this.party(a.partyId).ideology)-this.distance(party.ideology,this.party(b.partyId).ideology))[0];if(ally)ally.endorsementPartyIds.push(party.id);}
    const election={id:this.nextId++,round:1,startedAt:city.minute,voteAt:this.nextElectionAt,candidates,councilCandidates,status:'campaign',ballots:[],ranking:[],polls:[],events:[],lastCampaignDay:null,calendarRules:this.termRules};election.eventId=city.log(`Eleição ${election.id}: ${candidates.length} chapas, ${councilCandidates.length} candidaturas à Câmara e ${this.termRules.campaignMinutes/1440} dias de campanha.`,'government',candidates.map(c=>c.citizenId),{kind:'election-opened',electionId:election.id}).id;this.active=election;allocatePartyFunds(this,election);this.campaigns.daily(election);
  }
  beginRunoff(first,finalists){
    const city=this.city,duration=Math.max(1,Math.floor((first.voteAt-first.startedAt)/2));
    // A runoff campaign lasts half the first round, including loaded elections.
    let voteAt=this.voting.schedule(city.minute+duration);if(voteAt-duration<=city.minute)voteAt+=1440;const startedAt=voteAt-duration;
    const candidates=finalists.map(n=>({...n,promises:n.promises.map(pr=>({...pr})),endorsementPartyIds:[n.partyId]}));
    for(const party of this.parties.filter(p=>p.active&&!candidates.some(n=>n.partyId===p.id))){const ally=candidates.slice().sort((a,b)=>this.distance(party.ideology,this.party(a.partyId).ideology)-this.distance(party.ideology,this.party(b.partyId).ideology))[0];if(ally)ally.endorsementPartyIds.push(party.id);}
    const e={id:this.nextId++,round:2,firstRoundId:first.id,firstRoundElection:first,startedAt,voteAt,calendarRules:first.calendarRules||this.termRules,candidates,councilCandidates:[],status:'scheduled',ballots:[],ranking:[],polls:[],events:[],lastCampaignDay:null};
    first.runoffId=e.id;this.active=e;this.nextElectionAt=e.voteAt;
    e.eventId=city.log(`Segundo turno: ${candidates.map(n=>n.name).join(' e ')}. Campanha de ${duration/1440} dias, a partir do dia ${Math.floor(startedAt/1440)+1}.`,'government',candidates.map(n=>n.citizenId),{kind:'runoff-scheduled',electionId:e.id,firstRoundId:first.id}).id;
  }
  voterAssessment(voter,candidate,platform,nomination=null){this.initializeCitizen(voter);this.initializeCitizen(candidate);const city=this.city,party=this.party(candidate.political.partyId),relation=city.relationships.view(voter,candidate),reasons=[],add=(reason,value)=>reasons.push({reason,value});
    const exposure=(voter.political.candidateContacts?.[`${this.active?.id}:${candidate.id}`]||voter.political.candidateContacts?.[`${this.active?.firstRoundId}:${candidate.id}`]),known=voter===candidate?1:Math.min(1,(exposure?.count||0)*.22+(relation?.trust? .25:0)+(voter.political.partyId===party.id?.25:0));
    add('conhecimento da candidatura',known*20-12);add('apresentação e credibilidade',(appearance(candidate)-50)*.08);add('capacidade administrativa',candidate.skills.governance*(.08+known*.16));add('reputação',(city.reputation.score(candidate,'civic')-50)*(.06+known*.12));add('popularidade pessoal',((candidate.political.popularity??50)-50)*.3);add('reputação do partido',((party.publicReputation??50)-50)*.3);add('ideologia',(2.8-this.distance(voter.political.ideology,party.ideology))*9);
    if(voter.political.partyId===party.id||nomination?.endorsementPartyIds.includes(voter.political.partyId))add('partido',12*voter.political.loyalty);if(relation)add('afinidade',relation.affection*.09+relation.trust*.08-relation.resentment*.12);if(city.society.related(voter,candidate)&&voter!==candidate)add('família',12);
    const opinion=voter.political.support?.[party.id];if(opinion?.score)add('convencimento de campanha',opinion.score*.6);
    const record=this.mandates.recordScore(candidate.id,party.id);if(record)add('balanço do governo',record);if(candidate.id===city.economy.mayorId){add('aprovação do governo',(this.approval-50)*.6);const t=this.mandates.current,elapsed=t?Math.min(1,(city.minute-t.startedAt)/this.termRules.termMinutes):0;const unmet=t?.promises.filter(pr=>!pr.fulfilled).length||0;add('cobrança de promessas não cumpridas',-unmet*elapsed*(3+(voter.political.criticalSense??.5)*4));if(voter.needs.food<30)add('fome durante o governo',-25);if(!voter.homeUnitId)add('falta de moradia durante o governo',-15);}
    const knowsProgram=voter.political.partyId===party.id||voter.political.memories.some(m=>m.kind==='campaign-promise'&&m.electionId===this.active?.id&&m.candidateId===candidate.id);
    for(const promise of knowsProgram?nomination?.promises||[]:[]){const relevant=promiseRelevant(city,voter,promise.metric),attention=promise.attention??.4,credibility=clamp(.45+candidate.skills.governance/250+(candidate.traits?.honesty??.5)*.25+record/100-(voter.political.criticalSense??.5)*.2,.15,1.2);add(`projeto ${promise.ambitionLabel?.toLowerCase()||'proposto'}: ${promise.title}`,((relevant?4:1)+attention*(relevant?10:4))*credibility);}
    for(const m of voter.political.memories.filter(m=>m.electionId===this.active?.id&&(m.candidateId===candidate.id||m.partyId===party.id)))add(m.kind==='defamation'?'acusação de campanha':m.kind==='campaign-rally'?'campanha conjunta':'proposta e campanha',(m.effect||0)*(m.candidateId===candidate.id?1:.25));
    const scandals=this.scandals.filter(s=>s.proven&&s.accusedId===candidate.id&&(s.awareIds?.includes(voter.id)||voter.political.memories.some(m=>m.caseId===s.id)));if(scandals.length)add('corrupção comprovada',-scandals.reduce((n,s)=>n+(s.severity||40)*.45,0));const bribe=voter.political.bribes.find(b=>b.electionId===this.active?.id&&b.candidateId===candidate.id&&b.accepted);if(bribe)add('venda de voto',bribe.commitment?55:3);if(voter.id===candidate.id)add('candidatura própria',8);
    const ordered=reasons.slice().sort((a,b)=>b.value-a.value);return {score:reasons.reduce((n,r)=>n+r.value,0)+((Math.imul(voter.id+7,Math.imul(candidate.id+31,2654435761))>>>0)%1001)/100-5,reasons:ordered.slice(0,6),reason:ordered.find(r=>!['capacidade administrativa','reputação'].includes(r.reason))?.reason||'capacidade administrativa'};
  }
  voterScore(voter,candidate,platform){return this.voterAssessment(voter,candidate,platform,this.active?.candidates.find(n=>n.citizenId===candidate.id)).score;}
  intentions(voter,candidates=this.active?.candidates||[]){return candidates.map(n=>{const c=this.city.society.citizen(n.citizenId);return c&&this.party(n.partyId)?.active&&this.canRun(c,'mayor',true)?{...this.voterAssessment(voter,c,n.platform,n),candidateId:c.id,partyId:n.partyId}:null;}).filter(Boolean).sort((a,b)=>b.score-a.score||a.candidateId-b.candidateId);}
  vote(){
    const city=this.city,e=this.active;if(!e||!e.readyToFinish)return;this.mandates.update(true);
    const eligible=this.voting.available(e),eligibleIds=new Set(eligible.map(n=>n.citizenId));
    e.ranking=e.candidates.map(n=>({...n,votes:e.mayorCounts?.[n.citizenId]||0,eligible:eligibleIds.has(n.citizenId)})).sort((a,b)=>b.votes-a.votes||((city.society.citizen(b.citizenId)?.skills.governance||0)-(city.society.citizen(a.citizenId)?.skills.governance||0))||a.citizenId-b.citizenId);
    e.councilRanking=e.councilCandidates.map(n=>({...n,votes:e.councilCounts?.[n.citizenId]||0})).sort((a,b)=>b.votes-a.votes||a.citizenId-b.citizenId);
    e.turnout=e.ballots.length;e.invalidMayoralVotes=e.ballots.filter(b=>b.candidateId!=null&&!eligibleIds.has(b.candidateId)).length;e.completedAt=city.minute;e.approval=this.approval;
    const winner=e.ranking.find(n=>n.eligible&&n.votes>0);
    if(e.cancellationReason||!winner){e.status='cancelled';e.cancellationReason??='Nenhum voto válido para uma candidatura elegível.';this.lastResult=e;this.retain(e);this.active=null;if(e.round===2){this.beginRunoff(e.firstRoundElection,e.candidates);return;}const target=city.minute+this.termRules.campaignMinutes;this.nextElectionAt=this.voting.schedule(target);if(this.nextElectionAt<target)this.nextElectionAt+=1440;city.log(`Eleição ${e.id} adiada: ${e.cancellationReason}`,'government',[],{kind:'election-postponed',electionId:e.id});return;}
    e.validMayoralVotes=e.ranking.filter(n=>n.eligible).reduce((sum,n)=>sum+n.votes,0);
    const finalists=e.ranking.filter(n=>n.eligible).slice(0,2);
    if((e.round||1)===1&&finalists.length===2&&winner.votes*2<=e.validMayoralVotes){
      e.status='runoff-required';e.finalistIds=finalists.map(n=>n.citizenId);this.campaigns.event(e,`Segundo turno confirmado: ${winner.votes}/${e.validMayoralVotes} votos válidos para a chapa mais votada; ${finalists.map(n=>n.name).join(' e ')} seguem na disputa.`,'runoff-required',e.finalistIds,{validVotes:e.validMayoralVotes});this.lastResult=e;this.retain(e);this.beginRunoff(e,finalists);return;
    }
    e.tieBroken=(e.round===2&&finalists.length===2&&finalists[0].votes===finalists[1].votes);
    e.winnerId=winner.citizenId;e.winnerName=winner.name;e.viceWinnerId=winner.viceId;e.viceWinnerName=winner.viceName;e.status='completed';
    this.termNumber++;this.termRules=Object.freeze({termMinutes:this.policy.termDays*1440,campaignMinutes:this.policy.campaignDays*1440});this.takeOffice(city.society.citizen(winner.citizenId),'Eleição municipal',e);
    const previousVice=city.society.citizen(this.viceMayorId);if(previousVice&&previousVice.id!==city.economy.mayorId)previousVice.role='citizen';this.viceMayorId=this.eligible(city.society.citizen(winner.viceId))?winner.viceId:null;this.suspendedExecutive=null;
    const vice=city.society.citizen(this.viceMayorId);e.viceWinnerId=vice?.id??null;e.viceWinnerName=vice?.entity.properties.name??null;if(vice){vice.role='vice-mayor';this.council.remove(vice.id,'Posse na vice-prefeitura');}
    const legislature=e.firstRoundElection||e,legislativeResult=e.round===2?{...legislature,winnerId:winner.citizenId}:legislature;this.council.seats=legislature.councilSeats??this.council.seats;this.council.elect(legislativeResult);legislature.councilResult=legislativeResult.councilResult;e.councilResult=legislature.councilResult;
    e.electedCouncilors=this.council.members.map(m=>Object.freeze({...m,votes:legislature.councilCounts[m.citizenId]||0}));
    legislature.electedCouncilors=e.electedCouncilors;
    for(const member of this.council.people()){const old=member.political.tenure.council;member.political.tenure.council={count:old&&old.lastTerm===this.termNumber-1?old.count+1:1,lastTerm:this.termNumber};}
    this.applyPlatform(winner.platform,e);city.log(`${winner.name} (${this.party(winner.partyId).short}) venceu com ${winner.votes}/${e.turnout} votos presenciais.`,'government',[winner.citizenId],{kind:'election-completed',electionId:e.id,winnerId:winner.citizenId});
    this.lastResult=e;this.retain(e);this.active=null;this.termStartedAt=city.minute;this.nextElectionAt=this.voting.schedule(e.voteAt+this.termRules.termMinutes);this.baseline=this.conditions();
  }
  applyPlatform(id,election){const program=POLITICAL_PLATFORMS[id],author=this.council.people().find(c=>c.political.partyId===this.partyOfId(election.winnerId)?.id)||this.council.people()[0];if(!author)return;this.council.propose(author,'tax',{value:program.taxRate},`Programa eleito: imposto de ${Math.round(program.taxRate*100)}%`);this.council.propose(author,'welfare',{value:program.dailyBudget},'Programa eleito: orçamento social');this.council.propose(author,'inflation',{value:program.dailyLimit},'Programa eleito: teto de emissão');election.proposedPolicy={...program};}
  crime(accused,type,from,to,amount,details={}){
    if(from===to||!Number.isFinite(amount)||amount<=0)return null;
    const id=this.nextCaseId,reason=type==='vote-buying'?'Compra ilegal de voto':type==='poll-rigging'?'Pagamento clandestino por manipulação de pesquisa':'Desvio de recursos';
    if(!this.city.transfer(from,to,amount,reason,{...details,politicianId:accused.id,corruptionCaseId:id}))return null;
    const record={...details,id:this.nextCaseId++,participantIds:details.participantIds||[accused.id,details.voterId].filter(id=>id!=null),severity:type==='vote-buying'?25:40,awareIds:[],concealment:.4,accusedId:accused.id,partyId:accused.political.partyId,type,from,to,amount,occurredAt:this.city.minute,discoveredAt:null,proven:false};
    record.partyAffiliations=[...new Set([record.accusedId,...record.participantIds])].filter(id=>id!==record.voterId).map(id=>({citizenId:id,partyId:this.city.society.citizen(id)?.political?.partyId??null}));record.hostingParties=[];
    record.steps=[this.corruptionStep(from,to,amount,reason)];
    record.evidenceEventId=this.city.history.record('government','Movimentação financeira vinculada a investigação.',[from,to],{...details,kind:'corruption-evidence',corruptionCaseId:id,amount}).id;
    this.corruption.push(record);if(this.corruption.length>128)this.corruption.shift();return record;
  }
  corruptionStep(from,to,amount,description){return {minute:this.city.minute,from,to,fromName:this.city.accountName(from),toName:this.city.accountName(to),amount,description,eventId:this.city.ledger.at(-1)?.eventId};}

  investigate(){investigateCases(this);}
  updateApproval(){criticalApproval(this);}
  takeActingOffice(c,reason){this.council.remove(c.id,'Exercício temporário da prefeitura');this.releaseDuties(c,reason);super.takeOffice(c,reason);this.syncGoverningFlag();c.actingMayor=true;this.lowApprovalSince=null;}
  suspendMayor(days,caseId,billId){
    const city=this.city,mayor=city.society.citizen(city.economy.mayorId),proof=this.scandals.find(s=>s.id===caseId&&s.proven&&(s.accusedId===mayor?.id||s.participantIds?.includes(mayor?.id)));
    if(!mayor||!proof||this.suspendedExecutive||!Number.isInteger(days)||days<1||days>5)return false;
    const successor=[this.viceMayorId,this.council.leaderId].map(id=>city.society.citizen(id)).find(c=>c&&c.id!==mayor.id&&this.eligible(c));if(!successor)return false;
    this.suspendedExecutive={citizenId:mayor.id,until:Math.min(this.nextElectionAt,city.minute+days*1440),viceId:this.viceMayorId,termNumber:this.termNumber,billId,caseId};this.takeActingOffice(successor,'Afastamento temporário do prefeito');return true;
  }
  resumeExecutive(){
    const s=this.suspendedExecutive;if(!s)return;const city=this.city,original=city.society.citizen(s.citizenId),acting=city.society.citizen(city.economy.mayorId);
    if(!original||original.political.blockedUntilTerm>this.termNumber){this.suspendedExecutive=null;if(acting){acting.actingMayor=false;if(this.viceMayorId===acting.id)this.viceMayorId=null;this.takeOffice(acting,'Conversão do afastamento em sucessão definitiva');}return;}
    if(city.minute<s.until||this.termNumber!==s.termNumber||city.minute>=this.nextElectionAt)return;
    this.suspendedExecutive=null;if(acting)acting.actingMayor=false;super.takeOffice(original,'Retorno após afastamento temporário');this.syncGoverningFlag();this.viceMayorId=this.eligible(city.society.citizen(s.viceId))?s.viceId:null;const vice=city.society.citizen(this.viceMayorId);if(vice)vice.role='vice-mayor';this.lowApprovalSince=null;
  }
  vetoBill(billId){
    const bill=this.council.bills.find(b=>b.id===billId),mayor=this.city.society.citizen(this.city.economy.mayorId);
    if(!bill||!mayor||bill.status!=='awaiting-sanction'||['impeach','confidence'].includes(bill.type))return this.city.fail('Projeto não está no prazo de veto.');
    bill.status='vetoed';bill.vetoedBy=mayor.id;bill.vetoedAt=this.city.minute;bill.overrideAt=this.city.minute+360;this.vetoes.push({billId,mayorId:mayor.id,minute:this.city.minute});if(this.vetoes.length>48)this.vetoes.shift();
    for(const c of this.city.citizens.filter(c=>!c.entity.destroyed))this.remember(c,{kind:'mayor-veto',candidateId:mayor.id,partyId:mayor.political.partyId,effect:-18,description:`Prefeito vetou: ${bill.title}.`});
    this.city.log(`Prefeito vetou ${bill.title}; Câmara poderá derrubar o veto por dois terços.`,'government',[mayor.id],{kind:'bill-vetoed',billId});this.updateApproval();return true;
  }
  impeach(targetId,caseId,billId,confidence=false){
    const city=this.city,c=city.society.citizen(targetId),proof=this.scandals.find(s=>s.id===caseId&&(s.accusedId===targetId||s.participantIds?.includes(targetId))&&scandalEligible(this,s));
    if(!c||!this.officeHolder(c)||(!confidence&&!proof)||(confidence&&(targetId!==city.economy.mayorId||this.approval>=20||this.lowApprovalSince==null||city.minute-this.lowApprovalSince<3*1440)))return false;
    if(!confidence){c.political.blockedUntilTerm=this.termNumber+3;c.political.disqualifiedAt=city.minute;proof.impeached=true;proof.impeachedIds??=[];proof.impeachedIds.push(c.id);}
    const mayor=city.economy.mayorId===c.id;if(mayor){if(!c.actingMayor||!this.suspendedExecutive)this.mandates.finish('Impeachment');city.economy.mayorId=null;if(this.suspendedExecutive&&this.viceMayorId===c.id)this.viceMayorId=null;this.releaseDuties(c,'Impeachment');}else if(this.viceMayorId===c.id)this.viceMayorId=null;else this.council.remove(c.id,'Cassação por corrupção');c.role='citizen';
    city.log(`${c.entity.properties.name} perdeu o mandato${confidence?' por perda de confiança popular':'; impedimento nas próximas duas eleições'}.`,'government',[c.id],{kind:'politician-impeached',corruptionCaseId:caseId,billId,blockedUntilTerm:c.political.blockedUntilTerm});if(mayor)this.ensureMayor();return true;
  }
  daily(){this.organize();this.mandates.update();reviewMembership(this);this.liquidateEmptyParties();
    if(!this.city.society.citizen(this.viceMayorId))this.viceMayorId=null;
    for(const c of [this.city.society.citizen(this.city.economy.mayorId),this.city.society.citizen(this.viceMayorId),...this.council.people()].filter(Boolean))if((c.traits?.honesty??.5)<.45&&this.city.random()<.035)organizeScheme(this,c);
    for(const b of this.city.economy.businesses.filter(b=>b.ownerId)){const revenue=Math.max(0,b.totalRevenue-(b.politicalTaxRevenue||0));b.politicalTaxRevenue=b.totalRevenue;const value=Math.floor(revenue*Math.abs(this.policy.businessTax));if(!value)continue;const from=this.policy.businessTax<0?'treasury':b.accountId,to=this.policy.businessTax<0?b.accountId:'treasury';this.city.transfer(from,to,Math.min(value,this.city.accounts.get(from)?.balance||0),this.policy.businessTax<0?'Subsídio empresarial':'Imposto empresarial');}
  }
  hourly(){this.policy.partyFund??=80000;for(const party of this.parties)this.partyAccount(party);for(const pending of [...(this.pendingPartyFunding||[])])allocatePartyFunds(this,pending);allocatePartyFunds(this,this.active);illegalPartyFunding(this);this.syncGoverningFlag();this.liquidateEmptyParties();this.resumeExecutive();this.ensureMayor();if(this.lastDaily!==this.city.day){this.lastDaily=this.city.day;this.daily();}this.agenda.hourly();this.mandates.update();this.updateApproval();this.council.hourly();this.getResearch().ensureSupply();this.organization.hourly();this.investigate();this.assignPartyNumbers();this.standing.refresh();this.standing.replaceUnavailable();if(this.nextElectionAt===null)return;if(!this.active)this.nextElectionAt=this.voting.schedule(this.nextElectionAt);if(!this.active&&this.city.minute>=this.nextElectionAt-this.termRules.campaignMinutes)this.beginElection();if(this.active?.status==='scheduled'&&this.city.minute>=this.active.startedAt)this.active.status='campaign';if(this.active?.status==='campaign')this.campaigns.hourly(this.active);}
}
