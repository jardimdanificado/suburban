export function syncCorruptionVotes(p,record){
 if(!record?.proven)return;
 const city=p.city,people=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)),aware=new Set(record.awareIds||[]),reach=people.length?people.filter(c=>aware.has(c.id)).length/people.length:0;
 for(const bill of p.council.bills.filter(b=>['impeach','convict'].includes(b.type)&&b.payload.caseId===record.id&&b.votedAt!=null)){
  const votes=bill.votes||[],severity=record.severity||40,key=`corruption-vote:${bill.id}`;
  for(const voter of people){if(!aware.has(voter.id))continue;p.initializeCitizen(voter);if(voter.political.memories.some(m=>m.key===key))continue;p.remember(voter,{kind:'corruption-vote',promiseKey:key,caseId:record.id,billId:bill.id,politicianId:bill.payload.targetId,votes:Object.freeze(votes.map(v=>Object.freeze({citizenId:v.citizenId,partyId:v.partyId,yes:v.yes}))),severity,description:`Soube como os vereadores votaram no caso de corrupção #${record.id}.`});}
  const change=reach-(bill.corruptionVoteReach||0);if(change){for(const vote of votes)city.reputation.observe(`citizen:${vote.citizenId}`,'civic',(vote.yes?1:-1)*severity*.12*change,'voto em caso de corrupção conhecido',{billId:bill.id,corruptionCaseId:record.id});bill.corruptionVoteReach=reach;}
  for(const partyId of new Set(votes.map(v=>v.partyId))){const party=p.party(partyId);if(!party)continue;party.publicRecords??=[];let row=party.publicRecords.find(r=>r.key===key);const cast=votes.filter(v=>v.partyId===partyId),stance=cast.reduce((n,v)=>n+(v.yes?1:-1),0)/cast.length;if(!row){row={key,kind:'corruption-vote',billId:bill.id,caseId:record.id,title:bill.title,minute:bill.votedAt,votes:cast.map(v=>({...v}))};party.publicRecords.push(row);}row.points=stance*reach*severity*.06;row.reach=reach;}
  p.standing.lastPeriod=null;
 }
}
