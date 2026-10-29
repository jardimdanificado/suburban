import {TAX_CATEGORIES,taxRate} from './city_sales_tax.js';
import {equityShares,offerShares,initializeEquity,nationalizeShares} from './city_equity.js?v=landlord-stock-market-1';
import {syncCorruptionVotes} from './city_corruption_votes.js';
import {ideologicalProfile,policyAffinity,citizenPolicyInterest} from './city_ideology.js';
import {CityCouncilChamber} from './city_council_chamber.js';
import {inviteMembers} from './city_party_membership.js?v=party-name-tags-1';
import { seatBounds, scandalEligible, publicPressure } from './city_political_institutions.js';
import {partyNameAgenda} from './city_party_names.js';
export const BILL_LABELS={entrepreneurCandidates:"Candidatura de empresários",partyFund:'Fundo partidário por eleição',pollMinRate:'Amostra mínima das pesquisas',pollMaxRate:'Amostra máxima das pesquisas',tax:'Imposto salarial',businessTax:'Imposto empresarial',salesTax:'Imposto por ramo',minimumWage:'Salário mínimo',partyLimit:'Limite de partidos',reelectionLimit:'Limite de reeleições',termDays:'Duração do mandato',campaignDays:'Duração da campanha',build:'Construção estatal',worksBudget:'Orçamento de obras do Executivo',worksTransfer:'Transferência para orçamento de obras',nationalize:'Estatização negociada',privatize:'Privatização',inflation:'Controle da inflação',welfare:'Proteção social',roads:'Acesso e iluminação',suspend:'Afastamento temporário do prefeito',convict:'Condenação por corrupção',impeach:'Cassação',confidence:'Impeachment por perda de confiança',councilRate:'Percentual de vereadores na população',councilSeats:'Quantidade de vereadores',councilBudget:'Orçamento salarial da Câmara',mayorBudget:'Salário diário do prefeito'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class CityCouncil {
  constructor(city){this.city=city;this.members=[];this.vacancies=[];this.seats=1;this.bills=[];this.nextId=1;this.lastProposalDay=null;this.leaderId=null;this.leaderElections=[];this.leaderElectionTerm=null;}
  getChamber(){return this.chamber??=new CityCouncilChamber(this.city);}
  bounds(){return seatBounds(this.city);}
  weight(id){return id===this.leaderId?Math.max(2,Math.ceil(this.seats*.05)):1;}
  totalWeight(){return this.seats+(this.members.some(m=>m.citizenId===this.leaderId)?this.weight(this.leaderId)-1:0);}
  electLeader(){
    const chamber=this.getChamber();if(!chamber.open()||!chamber.quorum())return;const people=chamber.present();if(!people.length)return;
    const ballots=people.map(v=>{const choices=people.map(c=>({id:c.id,score:c.skills.governance*.3+(v.political.partyId===c.political.partyId?12*v.political.loyalty:0)+(this.city.relationships.view(v,c)?.trust||0)*.2+(c.traits?.honesty??.5)*6})).sort((a,b)=>b.score-a.score||a.id-b.id);return {voterId:v.id,candidateId:choices[0].id};});
    const ranked=people.map(c=>({id:c.id,votes:ballots.filter(v=>v.candidateId===c.id).length})).sort((a,b)=>b.votes-a.votes||a.id-b.id);this.leaderId=ranked[0].id;this.city.politics.syncGoverningFlag();this.leaderElectionTerm=this.city.politics.termNumber;
    this.leaderElections.push({minute:this.city.minute,term:this.leaderElectionTerm,winnerId:this.leaderId,ballots});if(this.leaderElections.length>32)this.leaderElections.shift();this.city.log('A Câmara elegeu sua presidência para a segunda metade do mandato.','government',[this.leaderId],{kind:'council-president-elected',weight:this.weight(this.leaderId)});
  }
  people(){return this.members.map(m=>this.city.society.citizen(m.citizenId)).filter(Boolean);}
  seat(c,provisional=false) {
    if(!c || this.members.some(m=>m.citizenId===c.id))return;
    const city=this.city;city.politics.releaseDuties(c,'Posse como vereador em dedicação exclusiva');c.role='councilor';
    city.log(`${c.entity.properties.name} tomou posse na Câmara em dedicação exclusiva.`,'government',[c.id],{kind:'councilor-appointed',partyId:c.political.partyId});
    this.members.push({citizenId:c.id,name:c.entity.properties.name,partyId:c.political.partyId,since:city.minute,provisional});
  }
  remove(id,reason='Encerramento da legislatura') {
    const member=this.members.find(m=>m.citizenId===id),c=this.city.society.citizen(id);this.members=this.members.filter(m=>m.citizenId!==id);
    if(id===this.leaderId){this.leaderId=null;this.city.politics.syncGoverningFlag();}
    if(member && !['Encerramento da legislatura','Redimensionamento da Câmara'].includes(reason))this.vacancies.push(member.partyId);
    if(c && member){this.getChamber().release(c);c.role='citizen';c.action='Mandato encerrado; disponível para trabalhar';}
  }
  ensure() {
    const p=this.city.politics;if(!p.parties.length)return;const bounds=this.bounds();p.policy.councilRate??=5;this.seats=Math.max(bounds.min,Math.min(bounds.max,Math.ceil(bounds.population*p.policy.councilRate/100)));while(this.members.length>this.seats)this.remove(this.members.at(-1).citizenId,'Redimensionamento da Câmara');
    // Also migrate sitting councilors from saves made under the former part-time rule.
    for(const c of this.people())if(c.jobId||c.deliveryId||c.cleaningJobId||['work','manage','construction','research','transport'].includes(c.task))p.releaseDuties(c,'Vereança em dedicação exclusiva');
    for(const m of [...this.members])if(!p.eligible(this.city.society.citizen(m.citizenId)))this.remove(m.citizenId,'Vacância da cadeira');
    if(this.members.length>=this.seats)return;
    let candidates=this.city.citizens.filter(c=>p.canRun(c,'council') && c.id!==this.city.economy.mayorId && c.id!==p.viceMayorId && !this.members.some(m=>m.citizenId===c.id));
    if(candidates.length<this.seats-this.members.length){inviteMembers(p,this.seats-this.members.length-candidates.length,'Convite aceito para disputar cadeira disponível na Câmara');candidates=this.city.citizens.filter(c=>p.canRun(c,'council')&&c.id!==this.city.economy.mayorId&&c.id!==p.viceMayorId&&!this.members.some(m=>m.citizenId===c.id));}
    for(const partyId of [...this.vacancies]){const substitute=candidates.filter(c=>c.political.partyId===partyId&&!this.members.some(m=>m.citizenId===c.id)).sort((a,b)=>{const votes=id=>(p.lastResult?.firstRoundElection||p.lastResult)?.ballots.filter(v=>v.councilCandidateId===id).length||0;return votes(b.id)-votes(a.id)||p.candidateStrength(b)-p.candidateStrength(a);})[0];if(substitute&&this.members.length<this.seats){this.seat(substitute,!p.lastResult);this.vacancies.splice(this.vacancies.indexOf(partyId),1);}}
    const groups=p.parties.filter(a=>a.active&&!a.retiring).map(party=>candidates.filter(c=>c.political.partyId===party.id&&!this.members.some(m=>m.citizenId===c.id)).sort((a,b)=>p.candidateStrength(b)-p.candidateStrength(a)));
    // Alternate parties for the provisional chamber; later vacancies use registered suplentes.
    while(this.members.length<this.seats){let added=false;for(const group of groups){const c=group.shift();if(c && this.members.length<this.seats){this.seat(c,true);added=true;}}if(!added)break;}
  }
  elect(election) {
    const city=this.city,p=city.politics;this.leaderId=null;this.leaderElectionTerm=null;for(const m of [...this.members])this.remove(m.citizenId);this.vacancies=[];
    const candidates=election.councilCandidates.filter(c=>p.canRun(city.society.citizen(c.citizenId),'council')&&city.society.citizen(c.citizenId).political.partyId===c.partyId&&c.citizenId!==election.winnerId&&c.citizenId!==p.viceMayorId),allocated=new Map();
    const parties=p.parties.filter(a=>a.active).map(party=>({partyId:party.id,votes:election.ballots.filter(v=>v.councilPartyId===party.id).length,candidates:candidates.filter(c=>c.partyId===party.id).sort((a,b)=>election.ballots.filter(v=>v.councilCandidateId===b.citizenId).length-election.ballots.filter(v=>v.councilCandidateId===a.citizenId).length||a.citizenId-b.citizenId)}));
    for(let i=0;i<this.seats;i++){const next=parties.filter(a=>a.candidates.length&&a.votes>0).sort((a,b)=>b.votes/(1+(allocated.get(b.partyId)||0))-a.votes/(1+(allocated.get(a.partyId)||0))||a.partyId-b.partyId)[0];if(!next)break;const candidate=next.candidates.shift();allocated.set(next.partyId,(allocated.get(next.partyId)||0)+1);this.seat(city.society.citizen(candidate.citizenId));}
    election.councilResult=parties.map(a=>({partyId:a.partyId,votes:a.votes,seats:allocated.get(a.partyId)||0}));
    city.log(`Câmara eleita: ${this.members.length} vereadores, distribuição proporcional por partido e preferência individual.`,'government',this.members.map(m=>m.citizenId),{kind:'council-elected',electionId:election.id});
  }
  propose(author,type,payload={},title=null) {
    const city=this.city,executiveRequest=['worksBudget','worksTransfer'].includes(type)&&author?.id===city.economy.mayorId;if(!author || (!this.members.some(m=>m.citizenId===author.id)&&!executiveRequest) || !BILL_LABELS[type])return null;
    if(['worksBudget','worksTransfer'].includes(type)&&!executiveRequest)return city.fail('Somente o prefeito pode solicitar alteração ou transferência da verba de obras.');
    if(['worksBudget','worksTransfer'].includes(type)&&(!Number.isSafeInteger(payload.value)||payload.value<0||(type==='worksTransfer'&&payload.value===0)))return city.fail('O valor precisa ser um inteiro positivo para transferência e respeitar o limite monetário.');
    if(['pollMinRate','pollMaxRate'].includes(type)){const min=type==='pollMinRate'?5:15,max=type==='pollMinRate'?10:20;if(!Number.isFinite(payload.value)||payload.value<min||payload.value>max)return city.fail(`Limite deve ficar entre ${min}% e ${max}%.`);if(payload.value===(city.politics.policy[type]??(type==='pollMinRate'?5:20)))return city.fail('Esse limite já está em vigor.');title??=`${BILL_LABELS[type]}: ${payload.value}% do eleitorado`; }
    if(type==='councilRate'){if(!Number.isFinite(payload.value)||payload.value<5||payload.value>12.5)return city.fail('Representação deve ficar entre 5% e 12,5% da população.');title??=`Câmara: ${payload.value.toFixed(1)}% da população`;if(Math.abs(payload.value-(city.politics.policy.councilRate??5))<.001)return city.fail('Esse percentual já está em vigor.');}
    if(type==='councilSeats'){const bounds=this.bounds();if(!Number.isSafeInteger(payload.value)||payload.value<bounds.min||payload.value>bounds.max)return city.fail(`Câmara deve ter entre ${bounds.min} e ${bounds.max} vereadores (5% a 12,5% da população).`);}
    if(['councilBudget','mayorBudget','partyFund'].includes(type)&&(!Number.isSafeInteger(payload.value)||payload.value<0))return city.fail('Orçamento salarial deve ser um valor inteiro não negativo.');
    if(type==='suspend'&&(!Number.isInteger(payload.value)||payload.value<1||payload.value>5||payload.targetId!==city.economy.mayorId||!city.politics.scandals.some(r=>r.id===payload.caseId&&r.proven&&(r.accusedId===payload.targetId||r.participantIds?.includes(payload.targetId)))))return city.fail('Afastamento exige prefeito em exercício, prova e prazo de um a cinco dias.');
    if(type==='convict'&&!city.politics.scandals.some(r=>r.id===payload.caseId&&r.proven&&!r.archived&&(r.accusedId===payload.targetId||r.participantIds?.includes(payload.targetId))))return city.fail('A condenação exige provas e ligação com o caso.');
    if(type==='entrepreneurCandidates'){if(typeof payload.value!=='boolean')return city.fail('Escolha permitir ou proibir a candidatura de empresários.');if(payload.value===(city.politics.policy.entrepreneurCandidates!==false))return city.fail('Essa regra já está em vigor.');title??=payload.value?'Permitir candidatura de empresários':'Proibir candidatura de empresários';}
    if(type==='salesTax'&&(!TAX_CATEGORIES[payload.category]||!Number.isFinite(payload.value)||payload.value<0||payload.value>.5))return city.fail('Ramo ou alíquota inválida: escolha um ramo e valor entre 0% e 50%.');
    if(type==='salesTax')title??=`${TAX_CATEGORIES[payload.category].label}: imposto de ${(payload.value*100).toFixed(1)}%`;
    if(type==='privatize'&&payload.percent!=null&&(!Number.isFinite(payload.percent)||payload.percent<=0||payload.percent>100))return city.fail('Percentual de privatização deve ficar entre 0,01% e 100%.');
    if(type==='impeach'&&!city.politics.scandals.some(r=>r.id===payload.caseId&&scandalEligible(city.politics,r)&&(r.accusedId===payload.targetId||r.participantIds?.includes(payload.targetId))))return city.fail('Faltam prova, gravidade ou repercussão popular.');
    if(type==='confidence'&&(city.politics.approval>=20||city.politics.lowApprovalSince==null||city.minute-city.politics.lowApprovalSince<3*1440||payload.targetId!==city.economy.mayorId))return city.fail('Perda de confiança exige aprovação abaixo de 20% por três dias.');
    if(['termDays','campaignDays'].includes(type)){
      if(!Number.isSafeInteger(payload.value)||payload.value<1||payload.value>Math.floor(Number.MAX_SAFE_INTEGER/1440))return city.fail('A duração deve ser um número inteiro positivo de dias.');
      if(payload.value===city.politics.policy[type])return city.fail('Essa duração já está aprovada.');
      const term=type==='termDays'?payload.value:city.politics.policy.termDays,campaign=type==='campaignDays'?payload.value:city.politics.policy.campaignDays;
      if(campaign>=term)return city.fail('A campanha deve durar menos que o mandato.');
      title??=`${BILL_LABELS[type]}: ${payload.value} dias, a partir da próxima gestão`;
    }
    if(this.bills.some(b=>['awaiting-session','proposed','approved','executing','awaiting-sanction','vetoed'].includes(b.status)&&b.type===type&&(type==='build'?b.payload.buildingType===payload.buildingType&&(payload.buildingType!=='farm'||(b.payload.crop||'milho')===(payload.crop||'milho')):['impeach','convict'].includes(type)?b.payload.targetId===payload.targetId&&b.payload.caseId===payload.caseId:['nationalize','privatize'].includes(type)?b.payload.buildingId===payload.buildingId:type==='salesTax'?b.payload.category===payload.category:true)))return null;
    const bill={previousValue:type==='tax'?city.taxRate:type==='businessTax'?city.politics.policy.businessTax:type==='salesTax'?taxRate(city,payload.category):type==='minimumWage'?city.politics.policy.minimumWage:type==='entrepreneurCandidates'?(city.politics.policy.entrepreneurCandidates!==false):type==='partyFund'?(city.politics.policy.partyFund??80000):type==='worksBudget'?(city.politics.policy.worksBudget??city.currency.price(5000000)):undefined,id:this.nextId++,authorId:author.id,authorName:author.entity.properties.name,partyId:author.political.partyId,type,payload:{...payload},title:title||BILL_LABELS[type],executiveRequest,proposedAt:city.minute,voteAt:city.minute+360,status:'awaiting-session',requestedAt:city.minute,votes:[],attempts:0,result:null};
    const e=city.log(`${author.entity.properties.name} encaminhou para apresentação no plenário: ${bill.title}.`,'government',[author.id],{kind:'bill-requested',billId:bill.id,partyId:bill.partyId});bill.eventId=e.id;this.bills.push(bill);
    if(this.bills.length>160){const i=this.bills.findIndex(b=>!['awaiting-session','proposed','approved','executing','awaiting-sanction','vetoed'].includes(b.status));if(i>=0)this.bills.splice(i,1);}
    return bill;
  }
  preference(c,bill) {
    const p=this.city.politics,party=p.party(c.political.partyId),agenda=party.nameAgenda||partyNameAgenda(party.name),e=clamp(party.ideology.economy+agenda.economy*.7,-1,1),state=agenda.state,social=agenda.social,green=agenda.green,own=party.id===bill.partyId,loyal=c.political.loyalty;
    let ideology=0;
    switch(bill.type){case'tax':ideology=-e*Math.sign(bill.payload.value-this.city.taxRate)*1.4;break;case'businessTax':ideology=-e*Math.sign(bill.payload.value-p.policy.businessTax)*1.4;break;case'salesTax':ideology=-(e+.15)*Math.sign(bill.payload.value-taxRate(this.city,bill.payload.category))*1.2+(bill.payload.category==='food'?-.35*Math.sign(bill.payload.value-taxRate(this.city,bill.payload.category)):0);break;case'minimumWage':ideology=-e*Math.sign(bill.payload.value-p.policy.minimumWage);break;case'build':ideology=-e*1.1+state*.65+social*.8+green*.35+.15;break;case'nationalize':ideology=-e*1.35+state*.9+social*.45;break;case'welfare':ideology=-e*1.1+state*.45+social*1.2+.2;break;case'privatize':ideology=e*1.5-state*.8-social*.25;break;case'inflation':ideology=.4+Math.abs(this.city.currency.dailyInflation)*40+(e*.15)-state*.15;break;case'roads':ideology=.8+state*.25+green*.2;break;case'partyLimit':ideology=(party.ideology.liberty+agenda.liberty*.6)*Math.sign(bill.payload.value-p.policy.partyLimit);break;case'reelectionLimit':ideology=Math.sign(bill.payload.value-p.policy.reelectionLimit)*((c.traits?.ambition??.5)*.7-(c.traits?.honesty??.5)*.8+(p.partyOfId(this.city.economy.mayorId)?.id===party.id?.15:-.35)-p.policy.reelectionLimit*.12);break;case'councilRate':ideology=Math.sign(bill.payload.value-(p.policy.councilRate??5))*((c.traits?.ambition??.5)-.45);break;case'councilSeats':ideology=Math.sign(bill.payload.value-this.seats)*((c.traits?.ambition??.5)-.45);break;
    case'partyFund':ideology=Math.sign(bill.payload.value-(p.policy.partyFund??80000))*((c.traits?.ambition??.5)-(c.traits?.honesty??.5)*.7-.15);break;
    case'worksBudget':{const delta=bill.payload.value-(p.policy.worksBudget??this.city.currency.price(5000000));ideology=Math.sign(delta)*((c.traits?.frugality??.5)*.35-(c.traits?.ambition??.5)*.2-.05)-Math.min(1.15,Math.log1p(Math.abs(delta)/Math.max(1,this.city.currency.price(100000)))*.18);break;}
    case'worksTransfer':ideology=.15-Math.log1p(bill.payload.value/Math.max(1,this.city.currency.price(10000)))*.42;break;
    case'councilBudget':case'mayorBudget':ideology=Math.sign(bill.payload.value-p.policy[bill.type])*((c.traits?.ambition??.5)*1.1-(c.traits?.honesty??.5)*.6-.15);break;
    case'suspend':ideology=(c.traits?.honesty??.5)*1.5-(p.partyOfId(bill.payload.targetId)?.id===party.id?loyal:0);break;
    case'confidence':ideology=p.approval<20?1.2-(p.partyOfId(bill.payload.targetId)?.id===party.id?loyal*2:0):-5;break;
    case'convict':case'impeach':{const evidence=p.scandals.find(s=>s.id===bill.payload.caseId&&(bill.type==='convict'?s.proven&&!s.archived:scandalEligible(p,s)));if(!evidence)return {yes:false,reason:'Faltam gravidade, provas ou repercussão'};const ally=p.partyOfId(bill.payload.targetId)?.id===party.id,complicit=evidence.participantIds?.includes(c.id);ideology=(c.traits?.honesty??.5)*1.5+(evidence.severity/100)*.7+(publicPressure(p,evidence)/100)*.6-1.25-(ally?loyal*1.7:0)-(complicit?3:0);break;}}
    const relation=this.city.relationships.view(c,this.city.society.citizen(bill.authorId));
    const personal=c.political.ideology.economy;
    if(bill.type==='termDays'){
      const direction=Math.sign(bill.payload.value-p.policy.termDays),governing=p.partyOfId(this.city.economy.mayorId)?.id===party.id;
      ideology=direction*((c.traits?.ambition??.5)*.8+(governing?(p.approval-50)/80:-.45)-ideologicalProfile(party).liberty*.3-.2);
    }
    if(['pollMinRate','pollMaxRate'].includes(bill.type))ideology=Math.sign(bill.payload.value-(p.policy[bill.type]??(bill.type==='pollMinRate'?5:20)))*((c.traits?.honesty??.5)*.7-(c.traits?.frugality??.5)*.35+.1);
    if(bill.type==='campaignDays')ideology=Math.sign(bill.payload.value-p.policy.campaignDays)*(c.personality.sociability*.8+ideologicalProfile(party).liberty*.3-(c.traits?.frugality??.5)*.5-.15);
    if(['build','nationalize','welfare'].includes(bill.type))ideology=ideology*loyal-personal*(1-loyal);
    if(bill.type==='privatize')ideology=ideology*loyal+personal*(1-loyal);
    const partyLine=policyAffinity(ideologicalProfile(party),this.city,bill.type,bill.payload);
    if(partyLine!==null){const individual=policyAffinity(ideologicalProfile(c),this.city,bill.type,bill.payload);ideology=partyLine*loyal+individual*(1-loyal)+citizenPolicyInterest(this.city,c,bill.type,bill.payload);}
    const pressure=(own ? .15+loyal*.25 : 0)+(relation?.trust||15)/250-(relation?.resentment||0)/180;
    const yes=ideology+pressure+((Math.imul(c.id+17,bill.id+37)>>>0)%100)/250-.2>0;
    return {yes,ideologicalScore:ideology,partyDiscipline:loyal,reason:['impeach','convict'].includes(bill.type)?'Provas, ética e lealdade partidária':`${ideologicalProfile(party).label}; orientação ${Math.round(loyal*100)}%, convicção pessoal e interesses materiais`};
  }
  vote(bill,override=false) {
    const chamber=this.getChamber(),present=chamber.open()?chamber.present():[],presentWeight=present.reduce((n,c)=>n+this.weight(c.id),0),totalWeight=this.totalWeight(),requiredQuorum=Math.floor(totalWeight/2)+1;
    bill.totalChamberWeight=totalWeight;bill.requiredQuorum=requiredQuorum;bill.participationWeight=presentWeight;
    if(!chamber.open()||presentWeight<requiredQuorum){bill.waitingForPlenary=true;bill.waitingForQuorum=true;bill.lastQuorumCheckAt=this.city.minute;return;}
    bill.waitingForPlenary=false;bill.waitingForQuorum=false;bill.plenaryBuildingId=chamber.hall().id;bill.attendance=present.map(c=>({citizenId:c.id,name:c.entity.properties.name,weight:this.weight(c.id),officeUnitId:this.members.find(m=>m.citizenId===c.id)?.officeUnitId??null}));const presentIds=new Set(bill.attendance.map(a=>a.citizenId));bill.absences=this.people().filter(c=>!presentIds.has(c.id)).map(c=>({citizenId:c.id,name:c.entity.properties.name,task:c.task,reason:c.action}));
    const eligible=present.filter(c=>c.id!==bill.payload.targetId||!['impeach','convict','confidence'].includes(bill.type));
    bill.eligibleWeight=eligible.reduce((n,c)=>n+this.weight(c.id),0);
    bill.votes=eligible.map(c=>({citizenId:c.id,name:c.entity.properties.name,partyId:c.political.partyId,weight:this.weight(c.id),...this.preference(c,bill)}));
    bill.yes=bill.votes.filter(v=>v.yes).reduce((n,v)=>n+v.weight,0);bill.no=bill.votes.filter(v=>!v.yes).reduce((n,v)=>n+v.weight,0);
    const supermajority=override||['impeach','convict','confidence'].includes(bill.type),threshold=supermajority?Math.ceil(bill.eligibleWeight*2/3):Math.floor(bill.eligibleWeight/2)+1;
    bill.threshold=threshold;bill.status=bill.yes>=threshold?'approved':override?'veto-maintained':'rejected';bill.votedAt=this.city.minute;if(override)bill.overrideVotes=bill.votes.map(v=>({...v}));
    this.city.log(`${bill.title}: ${bill.status==='approved'?'aprovado':'rejeitado'}, ${bill.yes} a ${bill.no}; quorum ${presentWeight}/${totalWeight} (mínimo ${requiredQuorum}); presentes aptos: ${bill.eligibleWeight}, votos exigidos: ${threshold}.`,'government',bill.votes.map(v=>v.citizenId),{kind:'bill-voted',billId:bill.id,buildingId:bill.plenaryBuildingId,present:bill.attendance.length,absent:bill.absences.length,participationWeight:presentWeight,totalChamberWeight:totalWeight,requiredQuorum,eligibleWeight:bill.eligibleWeight,yes:bill.yes,no:bill.no,threshold,parentEventId:bill.eventId});
    this.city.politics.standing.legislativeOpinion(bill,override);
    if(['impeach','convict'].includes(bill.type))syncCorruptionVotes(this.city.politics,this.city.politics.scandals.find(s=>s.id===bill.payload.caseId));
    if(bill.status==='approved'){if(override||['impeach','convict','confidence'].includes(bill.type)){bill.vetoOverridden=override;this.execute(bill);}else{bill.status='awaiting-sanction';bill.sanctionAt=this.city.minute+360;}}
  }
  transferFirm(bill,nationalize) {
    const city=this.city,b=city.building(bill.payload.buildingId);if(!b?.active || b.entity.destroyed || (['townhall','mint'].includes(b.type)||b.officialJournal))return 'Empresa indisponível';
    if(city.development.projects.some(p=>p.buildingId===b.id&&!p.cancelled&&p.status!=='completed'))return 'Aguardando obra contratada';
    if(nationalize){
      if(!initializeEquity(city,b))return city.lastError||'Imóvel incompatível com estatização';
      return nationalizeShares(city,b,bill)||null;
    }
    const available=equityShares(city,b).find(s=>s.accountId==='treasury')?.points||0,points=Math.round((bill.payload.percent??100)*100);
    if(!Number.isSafeInteger(points)||points<1||points>available)return 'Percentual público indisponível';
    const existing=b.shareOffers?.find(o=>o.billId===bill.id&&o.status==='open');if(existing)return null;
    const offer=offerShares(city,b,'treasury',points,{billId:bill.id});if(!offer)return city.lastError||'Oferta de privatização indisponível';
    bill.shareOfferId=offer.id;return null;
  }
  execute(bill) {
    const city=this.city,p=city.politics,policy=p.policy;bill.attempts++;let wait=null;
    const needs=city.welfare.conditions(),basic=new Set(['super_popular_housing','popular_housing','popular_luxury_housing','popular_refectory','kitchen','farm','bakery','market','greengrocer','builder','quarry','carrier','cleaner','public_toilet','waste_collector','recycler','composting','utility','clinic','mill']);
    if(needs.crisis && (bill.type==='nationalize'||bill.type==='build'&&!basic.has(bill.payload.buildingType))){bill.status='executing';bill.result='Aguardando atendimento das necessidades de alimentação e moradia';return;}
    if(bill.type==='privatize' && needs.crisis && basic.has(city.building(bill.payload.buildingId)?.type)){bill.status='executing';bill.result='Operação essencial preservada durante a emergência social';return;}
    switch(bill.type){
      case'entrepreneurCandidates':policy.entrepreneurCandidates=bill.payload.value;break;
      case'partyFund':p.changePartyFund(bill.payload.value,bill);break;
      case'councilRate':policy.councilRate=clamp(Math.round(bill.payload.value*100)/100,5,12.5);this.ensure();break;
      case'councilSeats':{const bounds=this.bounds();policy.councilRate=clamp(bill.payload.value/Math.max(1,bounds.population)*100,5,12.5);this.seats=Math.max(bounds.min,Math.min(bounds.max,Math.round(bill.payload.value)));while(this.members.length>this.seats)this.remove(this.members.at(-1).citizenId,'Redimensionamento da Câmara');this.ensure();break;}
      case'councilBudget':case'mayorBudget':policy[bill.type]=Math.max(0,Math.round(bill.payload.value));break;
      case'worksBudget':{const target=Math.round(bill.payload.value),account=city.politics.worksAccount(),current=account.balance||0,difference=target-current;if(difference>0){if(city.treasury-difference<needs.reserve||!city.transfer('treasury','works-budget',difference,'Aumento aprovado do orçamento de obras',{billId:bill.id})){wait='Aguardando caixa livre no tesouro para completar a dotação aprovada';break;}}else if(difference<0)city.transfer('works-budget','treasury',-difference,'Redução aprovada do orçamento de obras',{billId:bill.id});policy.worksBudget=account.balance;policy.worksBudgetTarget=target;city.politics.worksBudgetInitialized=true;bill.transferredToWorksBudget=difference;break;}
      case'worksTransfer':{const account=city.politics.worksAccount(),amount=Math.round(bill.payload.value);if(city.treasury-amount<needs.reserve||!city.transfer('treasury','works-budget',amount,'Transferência aprovada para orçamento de obras',{billId:bill.id})){wait='Aguardando caixa livre no tesouro para realizar a transferência aprovada';break;}policy.worksBudget=account.balance;policy.worksBudgetTarget=account.balance;city.politics.worksBudgetInitialized=true;bill.transferredToWorksBudget=amount;break;}
      case'suspend':if(!p.suspendMayor(bill.payload.value,bill.payload.caseId,bill.id)){bill.status='dismissed';bill.result='Afastamento perdeu as condições de execução';return;}break;
      case'confidence':if(!p.impeach(bill.payload.targetId,null,bill.id,true)){bill.status='dismissed';bill.result='Aprovação recuperada ou mandato encerrado';return;}break;
      case'tax':city.taxRate=clamp(bill.payload.value,-.5,.5);break;
      case'businessTax':policy.businessTax=clamp(bill.payload.value,-.2,.5);break;
      case'salesTax':policy.salesTaxes??={};policy.salesTaxes[bill.payload.category]=clamp(bill.payload.value,0,.5);break;
      case'minimumWage':policy.minimumWage=Math.max(1,Math.round(bill.payload.value));break;
      case'partyLimit': {
        const value=Math.max(1,Math.round(bill.payload.value)),active=p.parties.filter(a=>a.active).length;
        if(value<active){
          bill.mergePartyIds??=p.parties.filter(a=>a.active).sort((a,b)=>a.memberIds.length-b.memberIds.length).slice(0,active-value).map(a=>a.id);
          const excess=bill.mergePartyIds.map(id=>p.party(id)).filter(a=>a?.active);
          for(const party of excess)party.retiring=true;
          if(excess.some(a=>this.members.some(m=>m.partyId===a.id)||p.partyOfId(city.economy.mayorId)?.id===a.id)){wait='Fusão ao fim dos mandatos; partidos em retirada não apresentarão novas candidaturas';break;}
          for(const party of excess)p.mergeParty(party);
        }
        policy.partyLimit=value;p.fillParties();break;
      }
      case'reelectionLimit':policy.reelectionLimit=Math.max(0,Math.round(bill.payload.value));break;
      case'termDays':case'campaignDays':{
        const term=bill.type==='termDays'?bill.payload.value:policy.termDays,campaign=bill.type==='campaignDays'?bill.payload.value:policy.campaignDays;
        if(!Number.isSafeInteger(bill.payload.value)||term<2||campaign<1||campaign>=term){wait='Aguardando compatibilidade: campanha de pelo menos um dia e menor que o mandato';break;}
        policy[bill.type]=bill.payload.value;bill.effectiveFromTerm=p.termNumber+1;break;
      }
      case'pollMinRate':case'pollMaxRate':{const min=bill.type==='pollMinRate'?5:15,max=bill.type==='pollMinRate'?10:20;if(!Number.isFinite(bill.payload.value)||bill.payload.value<min||bill.payload.value>max){wait='Parâmetro fora dos limites legais de amostragem';break;}policy[bill.type]=bill.payload.value;break;}
      case'welfare':city.welfare.policy.enabled=true;city.welfare.policy.dailyBudget=Math.max(0,Math.round(bill.payload.value));break;
      case'inflation':city.currency.policy.mode='automatic';city.currency.policy.inflationTarget=Math.max(0,bill.payload.target??.001);city.currency.policy.dailyLimit=Math.max(0,Math.round(bill.payload.value));if(!needs.crisis)city.currency.retire(Math.min(city.currency.price(50000),Math.max(0,city.treasury-Math.max(needs.reserve,city.currency.policy.treasuryReserve))));break;
      case'roads':policy.infrastructurePriority=bill.payload.value;for(const project of city.development.projects)if(project.accountId==='treasury'&&!project.cancelled&&project.status!=='completed'&&project.priority<100){if(project.politicalPriority==null)project.politicalPriority=project.priority||0;project.priority=project.politicalPriority+(bill.payload.value==='lamps'&&project.service==='lamp'||bill.payload.value==='roads'&&['road','road-repair'].includes(project.service)?50:0);}break;
      case'nationalize':wait=this.transferFirm(bill,true);break;
      case'privatize':wait=this.transferFirm(bill,false);break;
      case'build':{if(bill.projectId){const project=city.development.projects.find(pr=>pr.id===bill.projectId);if(project?.status==='completed')break;wait=project?.cancelled?'Projeto cancelado; nova deliberação necessária':'Construção em andamento';break;}
        const type=bill.payload.buildingType;if(!city.buildingTypes[type]){wait='Tipo de obra indisponível';break;}
        if(type!=='farm'&&city.development.projects.filter(pr=>pr.accountId==='treasury'&&pr.service==='building'&&pr.type!=='farm'&&!pr.cancelled&&pr.status!=='completed').length>=3){wait='Aguardando capacidade de execução das obras públicas já contratadas';break;}
        const site=city.development.publicBuildingSite(type);bill.landSearch={...city.development.publicLandReport};
        if(!site){
          if(['super_popular_housing','popular_housing','popular_luxury_housing'].includes(type))for(const building of city.buildings.filter(b=>b.type===type&&!b.entity.destroyed&&b.floors<12&&b.units.every(u=>u.ownerId==='treasury')&&!city.development.projects.some(pr=>pr.buildingId===b.id&&!pr.cancelled&&pr.status!=='completed'))){const floors=Math.min(2,12-building.floors),cost=building.width*building.depth*floors*(2*city.economy.goods.pedra.price+Math.ceil(city.currency.price(12000)*1.5));if(city.treasury<cost+needs.reserve)continue;const project=city.development.beginExpansion('treasury',building.id,{floors});if(project){bill.projectId=project.id;project.priority=95;if(bill.agendaTermId){project.agendaTermId=bill.agendaTermId;project.promiseMetric=bill.promiseMetric;}wait='Ampliação vertical das moradias populares em andamento';break;}}
          wait??=city.development.publicLandReport?.reason||'Procurando terreno público acessível';break;
        }const lot=site.lot;
        const builder=city.development.selectBuilder('treasury',site.door);if(!builder&&type!=='farm'){wait='Aguardando construtora disponível';break;}
        const {width,depth}=site,floors=['super_popular_housing','popular_housing','popular_luxury_housing'].includes(type)?4:1;
        const cost=['farm','quarry'].includes(type)?0:width*depth*floors*(2*city.economy.goods.pedra.price+city.currency.price(12000)*1.5);
        if(city.treasury<cost+site.purchasePrice+city.currency.price(20000)+needs.reserve){wait='Aguardando caixa para terreno e obra sem comprometer alimentação e operação dos serviços';break;}
        if(!city.development.acquirePublicSite(site)){wait='Aguardando compra negociada do terreno anunciado';break;}
        const project=city.development.beginProject('treasury',lot.id,type,{floors,builderId:builder?.id??null,priority:basic.has(type)?95:10,crop:type==='farm'?(bill.payload.crop||'milho'):null,width,depth,rotation:site.rotation});if(!project){wait='Aguardando orçamento e condições de implantação';break;}bill.projectId=project.id;if(bill.agendaTermId){project.agendaTermId=bill.agendaTermId;project.promiseMetric=bill.promiseMetric;project.priority=Math.max(project.priority||0,95);}wait=project.status==='completed'?null:'Construção em andamento';break;}
      case'convict':{const crime=p.scandals.find(s=>s.id===bill.payload.caseId&&s.proven&&!s.archived&&(s.accusedId===bill.payload.targetId||s.participantIds?.includes(bill.payload.targetId)));if(!crime){bill.status='dismissed';bill.result='Provas ou caso indisponíveis';return;}crime.convictedIds??=[];if(!crime.convictedIds.includes(bill.payload.targetId))crime.convictedIds.push(bill.payload.targetId);city.log('Câmara condenou participante de esquema comprovado.','government',[bill.payload.targetId],{kind:'corruption-conviction',corruptionCaseId:crime.id,billId:bill.id});break;}
      case'impeach':if(!p.impeach(bill.payload.targetId,bill.payload.caseId,bill.id)){bill.status='dismissed';bill.result='Provas, repercussão ou mandato não são mais válidos';return;}break;
    }
    bill.result=wait||'Deliberação executada';bill.status=wait?'executing':'executed';
    if(!wait){bill.executedAt=city.minute;city.log(`${bill.title}: execução concluída.`,'government',[bill.authorId],{kind:'bill-executed',billId:bill.id,projectId:bill.projectId,parentEventId:bill.eventId});}
  }
  draft(c) {
    const city=this.city,p=city.politics,party=p.party(c.political.partyId),doctrine=ideologicalProfile(party),e=doctrine.economy,state=doctrine.ownership,social=doctrine.redistribution,metrics=p.mandates.metrics();
    const choices=[['entrepreneurCandidates',{value:p.policy.entrepreneurCandidates===false},p.policy.entrepreneurCandidates===false?'Permitir empresários nas eleições':'Proibir empresários nas eleições'],['tax',{value:clamp(city.taxRate+(e<0?.02:-.02),-.5,.5)},`Imposto salarial de ${(city.taxRate*100).toFixed(0)}% para ${(clamp(city.taxRate+(e<0?.02:-.02),-.5,.5)*100).toFixed(0)}%`],['businessTax',{value:clamp(p.policy.businessTax+(e<0?.02:-.02),-.2,.5)},'Rever a contribuição das empresas'],['minimumWage',{value:p.policy.minimumWage+(e<.2?1:-1)},'Revisar o piso salarial por minuto trabalhado'],['roads',{value:city.random()<.5?'roads':'lamps'},'Priorizar acessos e iluminação das vias movimentadas']];
    const categories=Object.keys(TAX_CATEGORIES),category=categories[(c.id+Math.floor(city.minute/1440))%categories.length],rate=taxRate(city,category);choices.push(['salesTax',{category,value:clamp(rate+(e<0?.02:-.02),0,.5)},`Rever imposto de ${TAX_CATEGORIES[category].label}`]);
    if(city.currency.dailyInflation>city.currency.policy.inflationTarget)choices.push(['inflation',{value:Math.max(0,city.currency.policy.dailyLimit-20000)},'Reduzir emissão diante da inflação acima da meta']);
    if(city.random()<.2)choices.push(['partyFund',{value:Math.max(0,Math.round((p.policy.partyFund??80000)*(city.random()<.5?.9:1.1)))},'Rever o fundo público eleitoral de todos os partidos']);
    if(city.random()<.25){const type=city.random()<.5?'pollMinRate':'pollMaxRate',min=type==='pollMinRate'?5:15,max=type==='pollMinRate'?10:20,value=clamp((p.policy[type]??(type==='pollMinRate'?5:20))+(city.random()<.5?-1:1),min,max);choices.push([type,{value},`Rever ${BILL_LABELS[type].toLowerCase()}: ${value}%`]);}
    if(e<.3||state>.25||social>.2){choices.push(['build',{buildingType:metrics.housed<95?'popular_housing':metrics.fed<95?'popular_refectory':['carrier','cleaner','bank'][c.id%3]},'Construir equipamento ou empresa estatal'],['welfare',{value:city.welfare.policy.dailyBudget+20000},'Ampliar orçamento de proteção social']);const firm=city.economy.businesses.find(b=>b.ownerId&&b.units.every(u=>u.ownerId===`citizen:${b.ownerId}`));if(firm&&(e<-.1||state>.45))choices.push(['nationalize',{buildingId:firm.id},`Negociar estatização de ${firm.entity.properties.name}`]);}
    if(doctrine.green>.6)choices.push(['build',{buildingType:metrics.waste>0?'recycler':'leisure'},'Investimento ambiental e qualidade dos bairros']);
    if(e>.1||state<-.25){choices.push(['welfare',{value:Math.max(0,Math.round(city.welfare.policy.dailyBudget*.9))},'Reavaliar despesas sociais e preservar a reserva']);const firm=city.economy.businesses.find(b=>b.municipal && !(['townhall','mint'].includes(b.type)||b.officialJournal));if(firm)choices.push(['privatize',{buildingId:firm.id},`Privatizar ${firm.entity.properties.name}`]);}
    if(city.random()<.2)choices.push(['partyLimit',{value:p.policy.partyLimit+(party.ideology.liberty>0?1:-1)},'Rever o limite de partidos']);
    if(city.random()<.15)choices.push(['reelectionLimit',{value:p.policy.reelectionLimit+((c.traits?.ambition??.5)>.6?1:-1)},'Rever o limite de reeleições consecutivas']);
    if(city.random()<.2)choices.push(['termDays',{value:Math.max(p.policy.campaignDays+1,p.policy.termDays+((c.traits?.ambition??.5)>.5?2:-2))},null]);
    if(city.random()<.2)choices.push(['campaignDays',{value:Math.max(1,Math.min(p.policy.termDays-1,p.policy.campaignDays+(c.personality.sociability>.6?1:-1)))},null]);
    if(city.random()<.2){const bounds=this.bounds();choices.push(['councilRate',{value:clamp((p.policy.councilRate??5)+(city.random()<.5?-.5:.5),5,12.5)},'Rever representação na Câmara'],['councilBudget',{value:Math.max(0,Math.round(p.policy.councilBudget*(city.random()<.5?.9:1.1)))},'Rever orçamento global dos vereadores'],['mayorBudget',{value:Math.max(0,Math.round(p.policy.mayorBudget*(city.random()<.5?.9:1.1)))},'Rever salário do prefeito']);}
    const profile=ideologicalProfile(party),weighted=choices.map(choice=>({choice,weight:Math.max(.05,1+(policyAffinity(profile,city,choice[0],choice[1])??0)*.8)})),total=weighted.reduce((n,r)=>n+r.weight,0);let roll=city.random()*total,pick=weighted.at(-1).choice;for(const row of weighted){roll-=row.weight;if(roll<=0){pick=row.choice;break;}}return this.propose(c,...pick);
  }
  hourly() {
    this.ensure();this.getChamber().plan();const city=this.city,p=city.politics;
    if(p.termStartedAt!=null&&city.minute>=p.termStartedAt+p.termRules.termMinutes/2&&(!this.leaderId||this.leaderElectionTerm!==p.termNumber))this.electLeader();
    for(const bill of this.bills){
      if(bill.status==='proposed'&&city.minute>=bill.voteAt)this.vote(bill);
      else if(bill.status==='awaiting-sanction'&&city.minute>=bill.sanctionAt){const mayor=city.society.citizen(city.economy.mayorId),opposed=mayor&&!this.preference(mayor,bill).yes;
        if(bill.agendaTermId!==p.mandates.current?.id&&opposed&&(mayor.traits?.ambition??.5)>.65&&city.random()<.12)p.vetoBill(bill.id);else this.execute(bill);}
      else if(bill.status==='vetoed'&&city.minute>=bill.overrideAt)this.vote(bill,true);
      else if(bill.status==='executing'&&city.hour%6===0)this.execute(bill);
    }
    if(this.lastProposalDay!==city.day){this.lastProposalDay=city.day;const people=this.people(),reserve=city.welfare.conditions().reserve,budget=Math.min(p.policy.councilBudget,Math.max(0,city.treasury-reserve)),share=people.length?Math.floor(budget/people.length):0;
      for(const [index,c] of people.entries()){const amount=share+(index<budget-share*people.length?1:0);if(amount)city.transfer('treasury',c.accountId,amount,'Salário diário: orçamento global da Câmara');}
      const mayor=city.society.citizen(city.economy.mayorId),salary=Math.min(p.policy.mayorBudget,Math.max(0,city.treasury-reserve));if(mayor&&salary)city.transfer('treasury',mayor.accountId,salary,'Salário diário do prefeito');
      for(let i=0;i<Math.min(3,people.length);i++){const c=people[(city.day*3+i)%people.length];city.economy.practice(c,'governance',30);this.draft(c);}
    }
  }
}
