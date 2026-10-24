const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
/** Civilian interests are independent of party discipline and the author's friendships. */
function opinion(city,c,bill){
  const p=city.politics,i=c.political.ideology,e=i.economy,v=bill.payload.value;
  const change=key=>Math.sign(v-(p.policy[key]??0));
  switch(bill.type){
    case'tax':return Math.sign(v-city.taxRate)*(-e*.6-(c.balance<city.currency.price(10000) ? .45 : .15));
    case'businessTax':return change('businessTax')*(-e*.7-(c.businessIds?.length ? .5 : 0));
    case'minimumWage':return change('minimumWage')*(-e*.4+(c.businessIds?.length ? -.65 : .55));
    case'welfare':return Math.sign(v-city.welfare.policy.dailyBudget)*(-e*.55+((c.needs.food<45||!c.homeUnitId) ? .7 : .1));
    case'build':return -.5*e+((bill.payload.buildingType==='popular_housing'&&!c.homeUnitId) ? .8 : .25);
    case'nationalize':return -e;case'privatize':return e;
    case'roads':return .65;case'inflation':return Math.sign(city.currency.policy.dailyLimit-v)*(.2+Math.min(.8,Math.max(0,city.currency.dailyInflation)*40));
    case'partyLimit':return change('partyLimit')*(i.liberty*.7+.1);
    case'reelectionLimit':return -change('reelectionLimit')*(.3+(c.political.criticalSense??.5)*.6);
    case'termDays':return -change('termDays')*(.3+i.liberty*.3);
    case'campaignDays':return change('campaignDays')*((c.personality?.sociability??.5)*.5-(c.traits?.frugality??.5)*.5);
    case'councilRate':case'councilSeats':return Math.sign(v-(bill.type==='councilRate'?p.policy.councilRate:p.council.seats))*(i.liberty*.5-(c.traits?.frugality??.5)*.3);
    case'councilBudget':case'mayorBudget':return -change(bill.type)*(.4+(c.political.criticalSense??.5)*.5);
    case'confidence':return (50-p.approval)/50;
    case'impeach':case'suspend':{const record=p.scandals.find(r=>r.id===bill.payload.caseId);return record?.proven&&record.awareIds?.includes(c.id) ? .6+(record.severity||0)/250 : 0;}
    default:return 0;
  }
}
export function recordLegislativeOpinion(standing,bill,override=false){
  const city=standing.city,p=city.politics,key=`bill:${bill.id}:${override?'override':'vote'}`;
  const voters=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c));
  const size=Math.min(64,voters.length),offset=(Math.imul(bill.id+1,31)>>>0)%Math.max(1,voters.length);
  const panel=Array.from({length:size},(_,i)=>voters[(offset+Math.floor(i*voters.length/Math.max(1,size)))%voters.length]);
  const opinions=panel.map(c=>{p.initializeCitizen(c);return opinion(city,c,bill);});
  const support=opinions.reduce((n,v)=>n+v,0)/Math.max(1,size);
  for(const partyId of new Set(bill.votes.map(v=>v.partyId))){const party=p.party(partyId);if(!party)continue;
    party.publicRecords??=[];if(party.publicRecords.some(r=>r.key===key))continue;
    const votes=bill.votes.filter(v=>v.partyId===partyId),yes=votes.filter(v=>v.yes).length,stance=(yes-(votes.length-yes))/votes.length;
    const points=clamp(support*stance*1.8,-1.8,1.8);
    const record={key,kind:'legislative',billId:bill.id,title:bill.title,minute:city.minute,points,sampleSize:size,support:opinions.filter(v=>v>.05).length,rejection:opinions.filter(v=>v<-.05).length,yes,no:votes.length-yes,votes:votes.map(v=>({...v})),override};
    record.eventId=city.log(`${party.short}: reação pública ${points>=0?'favorável':'desfavorável'} aos votos em “${bill.title}” (${points>=0?'+':''}${points.toFixed(2)} pontos).`,'government',votes.map(v=>v.citizenId),{kind:'party-legislative-reputation',partyId,billId:bill.id,points,sampleSize:size}).id;
    party.publicRecords.push(record);
    if(party.publicRecords.length>96){const removed=party.publicRecords.shift();party.archivedLegislativePoints=clamp((party.archivedLegislativePoints||0)+removed.points,-20,20);}
  }
  standing.lastPeriod=null;
}
export function publicPerformance(p,party){
  party.governmentRecords??=[];
  for(const term of p.mandates.terms.filter(t=>t.partyId===party.id)){
    let row=party.governmentRecords.find(r=>r.termId===term.id);if(!row){row={termId:term.id,mayorId:term.mayorId,title:`Gestão de ${term.mayorName}`,startedAt:term.startedAt};party.governmentRecords.push(row);}
    row.minute=term.endedAt??p.city.minute;row.ended=term.endedAt!=null;
    row.management=clamp((term.outcomes?.points||0)*.35,-12,14);
    row.promises=clamp(term.promises.reduce((n,pr)=>n+(pr.assessment?.points||0),0)/Math.max(1,term.promises.length)*.25,-12,14);
    row.fulfilled=term.promises.filter(pr=>pr.fulfilled).length;row.total=term.promises.length;
  }
  if(party.governmentRecords.length>32)party.governmentRecords.splice(0,party.governmentRecords.length-32);
  const latest=party.governmentRecords.slice(-3),mean=key=>latest.reduce((n,r)=>n+r[key],0)/Math.max(1,latest.length);
  const management=mean('management'),promises=mean('promises'),legislative=clamp((party.archivedLegislativePoints||0)+(party.publicRecords||[]).reduce((n,r)=>n+r.points,0),-20,20);
  return {management,promises,legislative,performance:management+promises};
}
