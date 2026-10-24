import {inviteMembers} from './city_party_membership.js';
import { seatBounds, scandalEligible, publicPressure } from './city_political_institutions.js';
export const BILL_LABELS={tax:'Imposto salarial',businessTax:'Imposto empresarial',minimumWage:'Salário mínimo',partyLimit:'Limite de partidos',reelectionLimit:'Limite de reeleições',termDays:'Duração do mandato',campaignDays:'Duração da campanha',build:'Construção estatal',nationalize:'Estatização negociada',privatize:'Privatização',inflation:'Controle da inflação',welfare:'Proteção social',roads:'Acesso e iluminação',suspend:'Afastamento temporário do prefeito',impeach:'Cassação',confidence:'Impeachment por perda de confiança',councilRate:'Percentual de vereadores na população',councilSeats:'Quantidade de vereadores',councilBudget:'Orçamento salarial da Câmara',mayorBudget:'Salário diário do prefeito'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class CityCouncil {
  constructor(city){this.city=city;this.members=[];this.vacancies=[];this.seats=1;this.bills=[];this.nextId=1;this.lastProposalDay=null;this.leaderId=null;this.leaderElections=[];this.leaderElectionTerm=null;}
  bounds(){return seatBounds(this.city);}
  weight(id){return id===this.leaderId?Math.max(2,Math.ceil(this.seats*.05)):1;}
  totalWeight(){return this.seats+(this.members.some(m=>m.citizenId===this.leaderId)?this.weight(this.leaderId)-1:0);}
  electLeader(){
    const people=this.people();if(!people.length)return;
    const ballots=people.map(v=>{const choices=people.map(c=>({id:c.id,score:c.skills.governance*.3+(v.political.partyId===c.political.partyId?12*v.political.loyalty:0)+(this.city.relationships.view(v,c)?.trust||0)*.2+(c.traits?.honesty??.5)*6})).sort((a,b)=>b.score-a.score||a.id-b.id);return {voterId:v.id,candidateId:choices[0].id};});
    const ranked=people.map(c=>({id:c.id,votes:ballots.filter(v=>v.candidateId===c.id).length})).sort((a,b)=>b.votes-a.votes||a.id-b.id);this.leaderId=ranked[0].id;this.leaderElectionTerm=this.city.politics.termNumber;
    this.leaderElections.push({minute:this.city.minute,term:this.leaderElectionTerm,winnerId:this.leaderId,ballots});if(this.leaderElections.length>32)this.leaderElections.shift();this.city.log('A Câmara elegeu sua presidência para a segunda metade do mandato.','government',[this.leaderId],{kind:'council-president-elected',weight:this.weight(this.leaderId)});
  }
  people(){return this.members.map(m=>this.city.society.citizen(m.citizenId)).filter(Boolean);}
  seat(c,provisional=false) {
    if(!c || this.members.some(m=>m.citizenId===c.id))return;
    const city=this.city;c.role='councilor';
    city.log(`${c.entity.properties.name} tomou posse na Câmara, mantendo sua ocupação profissional.`,'government',[c.id],{kind:'councilor-appointed',partyId:c.political.partyId});
    this.members.push({citizenId:c.id,name:c.entity.properties.name,partyId:c.political.partyId,since:city.minute,provisional});
  }
  remove(id,reason='Encerramento da legislatura') {
    const member=this.members.find(m=>m.citizenId===id),c=this.city.society.citizen(id);this.members=this.members.filter(m=>m.citizenId!==id);
    if(id===this.leaderId)this.leaderId=null;
    if(member && !['Encerramento da legislatura','Redimensionamento da Câmara'].includes(reason))this.vacancies.push(member.partyId);
    if(c && member)c.role='citizen';
  }
  ensure() {
    const p=this.city.politics;if(!p.parties.length)return;const bounds=this.bounds();p.policy.councilRate??=5;this.seats=Math.max(bounds.min,Math.min(bounds.max,Math.ceil(bounds.population*p.policy.councilRate/100)));while(this.members.length>this.seats)this.remove(this.members.at(-1).citizenId,'Redimensionamento da Câmara');
    // Release the full-time hall assignments created by the previous council model.
    const hall=this.city.buildings.find(b=>b.type==='townhall'&&!b.entity.destroyed);
    if(!this.partTimeMigrated){if(hall){hall.jobs=2;for(const c of this.people())if(c.jobId===hall.id)this.city.economy.leaveJob(c,'Vereança passa a funcionar em tempo parcial');}this.partTimeMigrated=true;}
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
    const city=this.city;if(!author || !this.members.some(m=>m.citizenId===author.id) || !BILL_LABELS[type])return null;
    if(type==='councilRate'){if(!Number.isFinite(payload.value)||payload.value<5||payload.value>12.5)return city.fail('Representação deve ficar entre 5% e 12,5% da população.');title??=`Câmara: ${payload.value.toFixed(1)}% da população`;if(Math.abs(payload.value-(city.politics.policy.councilRate??5))<.001)return city.fail('Esse percentual já está em vigor.');}
    if(type==='councilSeats'){const bounds=this.bounds();if(!Number.isSafeInteger(payload.value)||payload.value<bounds.min||payload.value>bounds.max)return city.fail(`Câmara deve ter entre ${bounds.min} e ${bounds.max} vereadores (5% a 12,5% da população).`);}
    if(['councilBudget','mayorBudget'].includes(type)&&(!Number.isSafeInteger(payload.value)||payload.value<0))return city.fail('Orçamento salarial deve ser um valor inteiro não negativo.');
    if(type==='suspend'&&(!Number.isInteger(payload.value)||payload.value<1||payload.value>5||payload.targetId!==city.economy.mayorId||!city.politics.scandals.some(r=>r.id===payload.caseId&&r.proven&&(r.accusedId===payload.targetId||r.participantIds?.includes(payload.targetId)))))return city.fail('Afastamento exige prefeito em exercício, prova e prazo de um a cinco dias.');
    if(type==='impeach'&&!city.politics.scandals.some(r=>r.id===payload.caseId&&scandalEligible(city.politics,r)&&(r.accusedId===payload.targetId||r.participantIds?.includes(payload.targetId))))return city.fail('Faltam prova, gravidade ou repercussão popular.');
    if(type==='confidence'&&(city.politics.approval>=20||city.politics.lowApprovalSince==null||city.minute-city.politics.lowApprovalSince<3*1440||payload.targetId!==city.economy.mayorId))return city.fail('Perda de confiança exige aprovação abaixo de 20% por três dias.');
    if(['termDays','campaignDays'].includes(type)){
      if(!Number.isSafeInteger(payload.value)||payload.value<1||payload.value>Math.floor(Number.MAX_SAFE_INTEGER/1440))return city.fail('A duração deve ser um número inteiro positivo de dias.');
      if(payload.value===city.politics.policy[type])return city.fail('Essa duração já está aprovada.');
      const term=type==='termDays'?payload.value:city.politics.policy.termDays,campaign=type==='campaignDays'?payload.value:city.politics.policy.campaignDays;
      if(campaign>=term)return city.fail('A campanha deve durar menos que o mandato.');
      title??=`${BILL_LABELS[type]}: ${payload.value} dias, a partir da próxima gestão`;
    }
    if(this.bills.some(b=>['proposed','approved','executing','awaiting-sanction','vetoed'].includes(b.status)&&b.type===type&&(type==='build'?b.payload.buildingType===payload.buildingType&&(payload.buildingType!=='farm'||(b.payload.crop||'milho')===(payload.crop||'milho')):type==='impeach'?b.payload.targetId===payload.targetId:true)))return null;
    const bill={id:this.nextId++,authorId:author.id,authorName:author.entity.properties.name,partyId:author.political.partyId,type,payload:{...payload},title:title||BILL_LABELS[type],proposedAt:city.minute,voteAt:city.minute+360,status:'proposed',votes:[],attempts:0,result:null};
    const e=city.log(`${author.entity.properties.name} propôs: ${bill.title}.`,'government',[author.id],{kind:'bill-proposed',billId:bill.id,partyId:bill.partyId});bill.eventId=e.id;this.bills.push(bill);
    if(this.bills.length>160){const i=this.bills.findIndex(b=>!['proposed','approved','executing','awaiting-sanction','vetoed'].includes(b.status));if(i>=0)this.bills.splice(i,1);}
    return bill;
  }
  preference(c,bill) {
    const p=this.city.politics,party=p.party(c.political.partyId),e=party.ideology.economy,own=party.id===bill.partyId,loyal=c.political.loyalty;
    let ideology=0;
    switch(bill.type){case'tax':ideology=-e*Math.sign(bill.payload.value-this.city.taxRate)*1.4;break;case'businessTax':ideology=-e*Math.sign(bill.payload.value-p.policy.businessTax)*1.4;break;case'minimumWage':ideology=-e*Math.sign(bill.payload.value-p.policy.minimumWage);break;case'build':case'nationalize':case'welfare':ideology=-e*1.4+.25;break;case'privatize':ideology=e*1.5;break;case'inflation':ideology=.4+Math.abs(this.city.currency.dailyInflation)*40;break;case'roads':ideology=.8;break;case'partyLimit':ideology=party.ideology.liberty*Math.sign(bill.payload.value-p.policy.partyLimit);break;case'reelectionLimit':ideology=Math.sign(bill.payload.value-p.policy.reelectionLimit)*((c.traits?.ambition??.5)*.7-(c.traits?.honesty??.5)*.8+(p.partyOfId(this.city.economy.mayorId)?.id===party.id?.15:-.35)-p.policy.reelectionLimit*.12);break;case'councilRate':ideology=Math.sign(bill.payload.value-(p.policy.councilRate??5))*((c.traits?.ambition??.5)-.45);break;case'councilSeats':ideology=Math.sign(bill.payload.value-this.seats)*((c.traits?.ambition??.5)-.45);break;
    case'councilBudget':case'mayorBudget':ideology=Math.sign(bill.payload.value-p.policy[bill.type])*((c.traits?.ambition??.5)*1.1-(c.traits?.honesty??.5)*.6-.15);break;
    case'suspend':ideology=(c.traits?.honesty??.5)*1.5-(p.partyOfId(bill.payload.targetId)?.id===party.id?loyal:0);break;
    case'confidence':ideology=p.approval<20?1.2-(p.partyOfId(bill.payload.targetId)?.id===party.id?loyal*2:0):-5;break;
    case'impeach':{const evidence=p.scandals.find(s=>s.id===bill.payload.caseId&&scandalEligible(p,s));if(!evidence)return {yes:false,reason:'Faltam gravidade, provas ou repercussão'};const ally=p.partyOfId(bill.payload.targetId)?.id===party.id,complicit=evidence.participantIds?.includes(c.id);ideology=(c.traits?.honesty??.5)*1.5+(evidence.severity/100)*.7+(publicPressure(p,evidence)/100)*.6-1.25-(ally?loyal*1.7:0)-(complicit?3:0);break;}}
    const relation=this.city.relationships.view(c,this.city.society.citizen(bill.authorId));
    const personal=c.political.ideology.economy;
    if(bill.type==='termDays'){
      const direction=Math.sign(bill.payload.value-p.policy.termDays),governing=p.partyOfId(this.city.economy.mayorId)?.id===party.id;
      ideology=direction*((c.traits?.ambition??.5)*.8+(governing?(p.approval-50)/80:-.45)-party.ideology.liberty*.3-.2);
    }
    if(bill.type==='campaignDays')ideology=Math.sign(bill.payload.value-p.policy.campaignDays)*(c.personality.sociability*.8+party.ideology.liberty*.3-(c.traits?.frugality??.5)*.5-.15);
    if(['build','nationalize','welfare'].includes(bill.type))ideology=ideology*loyal-personal*(1-loyal);
    if(bill.type==='privatize')ideology=ideology*loyal+personal*(1-loyal);
    const pressure=(own ? .3+loyal*.7 : 0)+(relation?.trust||15)/250-(relation?.resentment||0)/180;
    const yes=ideology+pressure+((Math.imul(c.id+17,bill.id+37)>>>0)%100)/250-.2>0;
    return {yes,reason:bill.type==='impeach'?'Provas, ética e lealdade partidária':own&&loyal>.5?'Orientação do partido e programa':'Ideologia, interesse público e vínculo com o autor'};
  }
  vote(bill,override=false) {
    const eligible=this.people().filter(c=>c.id!==bill.payload.targetId||!['impeach','confidence'].includes(bill.type));
    bill.votes=eligible.map(c=>({citizenId:c.id,name:c.entity.properties.name,partyId:c.political.partyId,weight:this.weight(c.id),...this.preference(c,bill)}));
    bill.yes=bill.votes.filter(v=>v.yes).reduce((n,v)=>n+v.weight,0);bill.no=bill.votes.filter(v=>!v.yes).reduce((n,v)=>n+v.weight,0);
    const threshold=override||['impeach','confidence'].includes(bill.type)?Math.ceil(this.totalWeight()*2/3):Math.floor(this.totalWeight()/2)+1;
    bill.threshold=threshold;bill.status=bill.yes>=threshold?'approved':override?'veto-maintained':'rejected';bill.votedAt=this.city.minute;if(override)bill.overrideVotes=bill.votes.map(v=>({...v}));
    this.city.log(`${bill.title}: ${bill.status==='approved'?'aprovado':'rejeitado'}, ${bill.yes} a ${bill.no}; exigidos ${threshold} votos ponderados.`,'government',bill.votes.map(v=>v.citizenId),{kind:'bill-voted',billId:bill.id,yes:bill.yes,no:bill.no,threshold,parentEventId:bill.eventId});
    this.city.politics.standing.legislativeOpinion(bill,override);
    if(bill.status==='approved'){if(override||['impeach','confidence'].includes(bill.type)){bill.vetoOverridden=override;this.execute(bill);}else{bill.status='awaiting-sanction';bill.sanctionAt=this.city.minute+360;}}
  }
  transferFirm(bill,nationalize) {
    const city=this.city,b=city.building(bill.payload.buildingId);if(!b?.active || b.entity.destroyed || ['townhall','mint'].includes(b.type))return 'Empresa indisponível';
    if(city.development.projects.some(p=>p.buildingId===b.id&&!p.cancelled&&p.status!=='completed'))return 'Aguardando obra contratada';
    const old=city.society.citizen(b.ownerId);
    if(nationalize) {
      if(!old)return 'Já não existe proprietário privado';
      if(!b.units.every(u=>u.ownerId===old.accountId))return 'Propriedade fracionada impede a compra integral';
      const price=Math.max(city.currency.price(10000),b.units.reduce((n,u)=>n+u.price,0)+(city.development.plots.find(p=>p.id===b.plotId)?.price||0)+Math.max(0,b.balance));
      if((old.traits?.frugality??.5)>.8 && bill.attempts<3)return 'Proprietário negociando a venda';
      if(!city.transfer('treasury',old.accountId,price,'Compra negociada para estatização',{billId:bill.id,buildingId:b.id}))return 'Aguardando caixa municipal';
      old.businessIds=old.businessIds.filter(id=>id!==b.id);b.ownerId=null;b.municipal=true;
      for(const u of b.units){u.ownerId='treasury';u.forSale=false;u.forRent=false;}
      const lot=city.development.plots.find(p=>p.id===b.plotId);if(lot){lot.ownerId='treasury';lot.forSale=false;}
      city.history.ownership(b,old.accountId,'treasury',{action:'nationalization',amount:price,billId:bill.id});
    } else {
      if(!b.municipal)return 'Já não é uma estatal';
      const buyer=city.citizens.filter(c=>city.politics.canOwnBusiness(c)).sort((a,b)=>b.balance-a.balance).find(c=>c.balance>=city.economy.premisesPrice(b)+city.currency.price(30000));
      if(!buyer)return 'Aguardando comprador com recursos';
      for(const u of b.units)u.forSale=true;
      if(!city.economy.purchasePremises(b,buyer,b.crop,{billId:bill.id}))return 'Compra não concluída';
    }
    return null;
  }
  execute(bill) {
    const city=this.city,p=city.politics,policy=p.policy;bill.attempts++;let wait=null;
    const needs=city.welfare.conditions(),basic=new Set(['popular_housing','popular_refectory','kitchen','farm','bakery','market','greengrocer','builder','quarry','carrier','cleaner','public_toilet','waste_collector','recycler','composting','utility','clinic','mill']);
    if(needs.crisis && (bill.type==='nationalize'||bill.type==='build'&&!basic.has(bill.payload.buildingType))){bill.status='executing';bill.result='Aguardando atendimento das necessidades de alimentação e moradia';return;}
    if(bill.type==='privatize' && needs.crisis && basic.has(city.building(bill.payload.buildingId)?.type)){bill.status='executing';bill.result='Operação essencial preservada durante a emergência social';return;}
    switch(bill.type){
      case'councilRate':policy.councilRate=clamp(Math.round(bill.payload.value*100)/100,5,12.5);this.ensure();break;
      case'councilSeats':{const bounds=this.bounds();policy.councilRate=clamp(bill.payload.value/Math.max(1,bounds.population)*100,5,12.5);this.seats=Math.max(bounds.min,Math.min(bounds.max,Math.round(bill.payload.value)));while(this.members.length>this.seats)this.remove(this.members.at(-1).citizenId,'Redimensionamento da Câmara');this.ensure();break;}
      case'councilBudget':case'mayorBudget':policy[bill.type]=Math.max(0,Math.round(bill.payload.value));break;
      case'suspend':if(!p.suspendMayor(bill.payload.value,bill.payload.caseId,bill.id)){bill.status='dismissed';bill.result='Afastamento perdeu as condições de execução';return;}break;
      case'confidence':if(!p.impeach(bill.payload.targetId,null,bill.id,true)){bill.status='dismissed';bill.result='Aprovação recuperada ou mandato encerrado';return;}break;
      case'tax':city.taxRate=clamp(bill.payload.value,-.5,.5);break;
      case'businessTax':policy.businessTax=clamp(bill.payload.value,-.2,.5);break;
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
      case'welfare':city.welfare.policy.enabled=true;city.welfare.policy.dailyBudget=Math.max(0,Math.round(bill.payload.value));break;
      case'inflation':city.currency.policy.mode='automatic';city.currency.policy.inflationTarget=Math.max(0,bill.payload.target??.001);city.currency.policy.dailyLimit=Math.max(0,Math.round(bill.payload.value));if(!needs.crisis)city.currency.retire(Math.min(city.currency.price(50000),Math.max(0,city.treasury-Math.max(needs.reserve,city.currency.policy.treasuryReserve))));break;
      case'roads':policy.infrastructurePriority=bill.payload.value;for(const project of city.development.projects)if(project.accountId==='treasury'&&!project.cancelled&&project.status!=='completed'&&project.priority<100){if(project.politicalPriority==null)project.politicalPriority=project.priority||0;project.priority=project.politicalPriority+(bill.payload.value==='lamps'&&project.service==='lamp'||bill.payload.value==='roads'&&['road','road-repair'].includes(project.service)?50:0);}break;
      case'nationalize':wait=this.transferFirm(bill,true);break;
      case'privatize':wait=this.transferFirm(bill,false);break;
      case'build':{if(bill.projectId){const project=city.development.projects.find(pr=>pr.id===bill.projectId);if(project?.status==='completed')break;wait=project?.cancelled?'Projeto cancelado; nova deliberação necessária':'Construção em andamento';break;}
        const type=bill.payload.buildingType;if(!city.buildingTypes[type]){wait='Tipo de obra indisponível';break;}
        if(type!=='farm'&&city.development.projects.filter(pr=>pr.accountId==='treasury'&&pr.service==='building'&&pr.type!=='farm'&&!pr.cancelled&&pr.status!=='completed').length>=3){wait='Aguardando capacidade de execução das obras públicas já contratadas';break;}
        city.development.ensurePlots();
        const lot=city.development.plots.find(l=>l.ownerId==='treasury'&&!l.buildingId&&!l.projectId&&l.width>=3&&l.depth>=3&&(type==='farm'?city.development.isFarmPlot(l):['quarry','iron_mine'].includes(type)?l.type==='quarry':l.width<=8&&l.depth<=8&&!['farm','quarry'].includes(l.type)));
        if(!lot){wait='Aguardando terreno público adequado';break;}
        const builder=city.development.selectBuilder('treasury',lot.door||{x:lot.x,y:lot.y});if(!builder&&type!=='farm'){wait='Aguardando construtora disponível';break;}
        const width=type==='popular_housing'?3:['farm','quarry'].includes(type)?lot.width:Math.min(4,lot.width),depth=type==='popular_housing'?3:['farm','quarry'].includes(type)?lot.depth:Math.min(4,lot.depth),floors=type==='popular_housing'?4:1;
        const cost=['farm','quarry'].includes(type)?0:width*depth*floors*(2*city.economy.goods.pedra.price+city.currency.price(12000)*1.5);
        if(city.treasury<cost+needs.reserve){wait='Aguardando caixa sem comprometer alimentação e operação dos serviços';break;}
        const project=city.development.beginProject('treasury',lot.id,type,{floors,builderId:builder?.id??null,priority:basic.has(type)?95:10,crop:type==='farm'?(bill.payload.crop||'milho'):null,width,depth});if(!project){wait='Aguardando orçamento e condições de implantação';break;}bill.projectId=project.id;if(bill.agendaTermId){project.agendaTermId=bill.agendaTermId;project.promiseMetric=bill.promiseMetric;project.priority=Math.max(project.priority||0,95);}wait=project.status==='completed'?null:'Construção em andamento';break;}
      case'impeach':if(!p.impeach(bill.payload.targetId,bill.payload.caseId,bill.id)){bill.status='dismissed';bill.result='Provas, repercussão ou mandato não são mais válidos';return;}break;
    }
    bill.result=wait||'Deliberação executada';bill.status=wait?'executing':'executed';
    if(!wait){bill.executedAt=city.minute;city.log(`${bill.title}: execução concluída.`,'government',[bill.authorId],{kind:'bill-executed',billId:bill.id,projectId:bill.projectId,parentEventId:bill.eventId});}
  }
  draft(c) {
    const city=this.city,p=city.politics,party=p.party(c.political.partyId),e=party.ideology.economy,metrics=p.mandates.metrics();
    const choices=[['tax',{value:clamp(city.taxRate+(e<0?.02:-.02),-.5,.5)},`Imposto salarial de ${(city.taxRate*100).toFixed(0)}% para ${(clamp(city.taxRate+(e<0?.02:-.02),-.5,.5)*100).toFixed(0)}%`],['businessTax',{value:clamp(p.policy.businessTax+(e<0?.02:-.02),-.2,.5)},'Rever a contribuição das empresas'],['minimumWage',{value:p.policy.minimumWage+(e<.2?1:-1)},'Revisar o piso salarial por minuto trabalhado'],['inflation',{value:Math.max(0,city.currency.policy.dailyLimit-20000)},'Reduzir emissão e retirar moeda excedente'],['roads',{value:city.random()<.5?'roads':'lamps'},'Priorizar acessos e iluminação das vias movimentadas']];
    if(e<.3){choices.push(['build',{buildingType:metrics.housed<95?'popular_housing':metrics.fed<95?'popular_refectory':['carrier','cleaner','bank'][c.id%3]},'Construir equipamento ou empresa estatal'],['welfare',{value:city.welfare.policy.dailyBudget+20000},'Ampliar orçamento de proteção social']);const firm=city.economy.businesses.find(b=>b.ownerId&&b.units.every(u=>u.ownerId===`citizen:${b.ownerId}`));if(firm)choices.push(['nationalize',{buildingId:firm.id},`Negociar estatização de ${firm.entity.properties.name}`]);}
    if(e>.1){const firm=city.economy.businesses.find(b=>b.municipal && !['townhall','mint'].includes(b.type));if(firm)choices.push(['privatize',{buildingId:firm.id},`Privatizar ${firm.entity.properties.name}`]);}
    if(city.random()<.2)choices.push(['partyLimit',{value:p.policy.partyLimit+(party.ideology.liberty>0?1:-1)},'Rever o limite de partidos']);
    if(city.random()<.15)choices.push(['reelectionLimit',{value:p.policy.reelectionLimit+((c.traits?.ambition??.5)>.6?1:-1)},'Rever o limite de reeleições consecutivas']);
    if(city.random()<.2)choices.push(['termDays',{value:Math.max(p.policy.campaignDays+1,p.policy.termDays+((c.traits?.ambition??.5)>.5?2:-2))},null]);
    if(city.random()<.2)choices.push(['campaignDays',{value:Math.max(1,Math.min(p.policy.termDays-1,p.policy.campaignDays+(c.personality.sociability>.6?1:-1)))},null]);
    if(city.random()<.2){const bounds=this.bounds();choices.push(['councilRate',{value:clamp((p.policy.councilRate??5)+(city.random()<.5?-.5:.5),5,12.5)},'Rever representação na Câmara'],['councilBudget',{value:Math.max(0,Math.round(p.policy.councilBudget*(city.random()<.5?.9:1.1)))},'Rever orçamento global dos vereadores'],['mayorBudget',{value:Math.max(0,Math.round(p.policy.mayorBudget*(city.random()<.5?.9:1.1)))},'Rever salário do prefeito']);}
    const pick=choices[Math.floor(city.random()*choices.length)];return this.propose(c,...pick);
  }
  hourly() {
    this.ensure();const city=this.city,p=city.politics;
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
