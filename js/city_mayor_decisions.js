/** Government reviews block time; council approvals remain actionable only during the veto deadline. */
export function pendingMayorDecisions(city){
  const s=city.mayorCampaign;if(s?.mode!=='play'||s.status!=='active')return [];
  const rows=[];
  if(s.governmentReview)rows.push({key:`government:${s.governmentReview.key}`,kind:'government',title:s.governmentReview.initial?'Assumir a prefeitura':'Formar o novo governo'});
  if(s.programReview)rows.push({key:`program:${s.programReview.key}`,kind:'program',title:'Escolher promessas de campanha'});
  for(const bill of city.politics.council.bills)if(bill.status==='awaiting-sanction'&&city.minute<(bill.sanctionAt??Infinity))rows.push({key:`bill:${bill.id}`,kind:'bill',billId:bill.id,title:'Projeto aprovado: sanção ou veto'});
  return rows;
}
export const mayorDecisionBlocked=city=>pendingMayorDecisions(city).some(d=>d.kind!=='bill');
function choices(city,person,party,existing=[]){
  const generated=city.politics.mandates.program(person,party,[],undefined,{choices:true});
  return [...existing,...generated].filter((p,i,all)=>all.findIndex(other=>other.metric===p.metric)===i).map(p=>({...p}));
}
export function syncMayorReviews(city){
  const s=city.mayorCampaign,p=city.politics,term=p.mandates.current,mayor=city.society.citizen(city.economy.mayorId);
  if(!mayor||mayor.political?.partyId!==s.partyId)return;
  for(const bill of p.council.bills)if(bill.status==='awaiting-sanction'&&city.minute>=bill.sanctionAt){
    bill.sanctionedAt=city.minute;bill.tacitSanction=true;p.council.execute(bill);
  }
  const key=`${term?.id??p.termNumber}:${mayor.id}`;
  if(s.governmentConfirmedKey!==key&&s.governmentReview?.key!==key){
    s.governmentReview={key,termId:term?.id,mayorId:mayor.id,initial:s.governmentConfirmedKey==null,choices:choices(city,mayor,p.party(s.partyId),term?.promises||[]),selected:(term?.promises||[]).map(pr=>pr.metric).slice(0,3)};
  }
  const election=p.active,n=election?.candidates?.find(n=>n.partyId===s.partyId);
  const programKey=n?`${election.id}:${n.citizenId}`:null;
  if(!n||!['scheduled','campaign'].includes(election.status))s.programReview=null;
  else if(s.programConfirmedKey!==programKey&&s.programReview?.key!==programKey){
    const person=city.society.citizen(n.citizenId);
    if(person)s.programReview={key:programKey,electionId:election.id,candidateId:n.citizenId,choices:choices(city,person,p.party(s.partyId),n.promises),selected:n.promises.map(pr=>pr.metric).slice(0,3)};
  }
}
export function selectReviewPromises(city,kind,metrics){
  const review=kind==='government'?city.mayorCampaign.governmentReview:city.mayorCampaign.programReview;
  if(!review||!Array.isArray(metrics)||metrics.length>3||new Set(metrics).size!==metrics.length||metrics.some(metric=>!review.choices.some(p=>p.metric===metric)))return city.fail('Escolha de uma a três promessas disponíveis, sem repetição.');
  review.selected=[...metrics];return true;
}
export function confirmMayorReview(city,kind){
  const s=city.mayorCampaign,p=city.politics,review=kind==='government'?s.governmentReview:s.programReview;
  if(!review||!review.selected.length||!selectReviewPromises(city,kind,review.selected))return city.fail('Escolha as promessas antes de confirmar.');
  const promises=review.selected.map(metric=>({...review.choices.find(pr=>pr.metric===metric)}));
  if(kind==='government'){
    const term=p.mandates.current;
    if(!term||term.id!==review.termId||city.economy.mayorId!==review.mayorId)return city.fail('A composição do governo mudou; revise a posse.');
    const base=p.mandates.metrics();
    term.promises=promises.map(pr=>({...pr,baseline:base[pr.metric],current:base[pr.metric],progress:0,fulfilled:false,fulfilledAt:null,assessment:null,execution:null}));
    term.playerProgram=true;p.mandates.update(true);s.governmentConfirmedKey=review.key;s.governmentReview=null;
  }else{
    const election=p.active,n=election?.candidates.find(n=>n.citizenId===review.candidateId&&n.partyId===s.partyId);
    if(!n||election.id!==review.electionId||!['campaign','scheduled'].includes(election.status))return city.fail('Esta candidatura já não aceita um novo programa.');
    n.promises=promises;delete n.memoryPromises;s.programConfirmedKey=review.key;s.programReview=null;
    p.campaigns.event(election,`${n.name} definiu o programa escolhido pelo jogador: ${promises.map(pr=>pr.title).join('; ')}.`,'campaign-program',[n.citizenId],{partyId:s.partyId});
  }
  return true;
}
