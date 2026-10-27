export function electPartyLeader(government,party){
 const city=government.city,members=party.memberIds.map(id=>city.society.citizen(id)).filter(c=>c&&!c.entity.destroyed&&city.society.isAdult(c)&&c.political?.partyId===party.id),candidates=members.filter(c=>government.eligible(c));
 if(!candidates.length){party.leaderId=null;party.successorIds=[];return null;}
 const votes=members.map(v=>{const choices=candidates.map(c=>{const r=city.relationships.view(v,c),affinity=1-government.distance(v.political.ideology,c.political.ideology)/2.8;return {id:c.id,score:(c.political.popularity??50)*.3+government.candidateStrength(c)*.18+affinity*12+((r?.trust??50)-50)*.16+((r?.affection??50)-50)*.12+(v.id===c.id?4:0)+(c.id===party.leaderId?1.5:0)};}).sort((a,b)=>b.score-a.score||a.id-b.id);return {voterId:v.id,candidateId:choices[0].id};});
 const ranking=candidates.map(c=>({id:c.id,votes:votes.filter(v=>v.candidateId===c.id).length,popularity:c.political.popularity??50})).sort((a,b)=>b.votes-a.votes||b.popularity-a.popularity||a.id-b.id);
 party.leaderId=ranking[0].id;party.successorIds=ranking.slice(1,5).map(r=>r.id);party.leaderElectionTerm=government.termNumber;
 const election={minute:city.minute,term:government.termNumber,winnerId:party.leaderId,votes,ranking};party.leaderElections??=[];party.leaderElections.push(election);if(party.leaderElections.length>24)party.leaderElections.shift();
 party.history.push(Object.freeze({minute:city.minute,leaderId:party.leaderId,description:`Liderança eleita pelos filiados: ${city.accountName(`citizen:${party.leaderId}`)} (${ranking[0].votes}/${votes.length} votos).`}));if(party.history.length>24)party.history.shift();
 city.log(`${party.short} elegeu sua liderança com ${votes.length} votos internos.`,'government',members.map(c=>c.id),{kind:'party-leader-elected',partyId:party.id,winnerId:party.leaderId,voters:votes.length});return election;
}
