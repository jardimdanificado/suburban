import {promiseRelevant} from './city_mandates.js';
import {ensureSkinColor} from './city_skin.js';
import {returnPartyCap} from './city_party_caps.js?v=party-caps-skin-1';
// Party membership is a minority commitment; electoral support is personal and reversible.
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export const MEMBERSHIP_RULES=Object.freeze({maxShare:.4,contactInterval:180,cooldownDays:3});
export function membershipProfile(p,c){
  const s=c.political,t=c.traits||{};
  s.engagement??=clamp((t.ambition??.5)*.4+(t.openness??.5)*.25+c.personality.sociability*.15+((c.id*37)%101)/500);
  s.independence??=clamp(.45+(s.criticalSense??.5)*.35+((c.id*19)%101)/500);
  s.popularity??=50;s.support??={};s.membershipSince??=p.city.minute;s.membershipCooldownUntil??=0;
  if(!s.partyId)s.loyalty=0;
  syncPartyColor(p,c);
  return s;
}
export function syncPartyColor(p,c){
  const name=c.entity?.properties?.name;
  if(name){
    c.political.displayNameBase??=name.replace(/\s+\([^()]+\)$/,'');
    const short=p.party(c.political.partyId)?.short;
    c.entity.properties.name=short?`${c.political.displayNameBase} (${short})`:c.political.displayNameBase;
  }
  ensureSkinColor(p.city,c);
}
function updateSympathy(s){const best=Object.entries(s.support).sort((a,b)=>b[1].score-a[1].score)[0];s.sympathyPartyId=best&&best[1].score>4?Number(best[0]):null;}
const adults=p=>p.city.citizens.filter(c=>!c.entity.destroyed&&p.city.society.isAdult(c));
export function canJoin(p,c){const people=adults(p);return !!c.political.partyId||people.filter(v=>v.political?.partyId&&p.party(v.political.partyId)?.active).length<Math.floor(people.length*MEMBERSHIP_RULES.maxShare);}
export function leaveParty(p,c,reason){
  const s=membershipProfile(p,c),old=p.party(s.partyId);if(!old)return false;
  returnPartyCap(p,old,c);old.memberIds=old.memberIds.filter(id=>id!==c.id);s.lastPartyId=old.id;s.lastPartyDepartureAt=p.city.minute;s.partyId=null;syncPartyColor(p,c);s.loyalty=0;s.membershipCooldownUntil=p.city.minute+1440*MEMBERSHIP_RULES.cooldownDays;
  p.remember(c,{kind:'party-departure',partyId:old.id,description:`Desfiliou-se de ${old.short}: ${reason}.`});
  return true;
}
export function inviteMembers(p,count,reason,onlyParty=null){
  const parties=p.parties.filter(a=>a.active&&!a.retiring&&(!onlyParty||a.id===onlyParty.id));if(!parties.length)return;
  const pool=adults(p).filter(c=>!c.political.partyId&&!c.political.foundingProposalId&&c.political.membershipCooldownUntil<=p.city.minute);
  const options=pool.map(c=>{const party=parties.slice().sort((a,b)=>p.distance(c.political.ideology,a.ideology)-p.distance(c.political.ideology,b.ideology))[0];return {c,party,score:c.political.engagement*30+p.candidateStrength(c)*.3-p.distance(c.political.ideology,party.ideology)*15};}).sort((a,b)=>b.score-a.score||a.c.id-b.c.id);
  for(const row of options){if(count<=0||!canJoin(p,row.c))break;if(p.join(row.c,row.party,reason))count--;}
}
export function organizeMembership(p,people){
  // Older sessions automatically affiliated everybody. Preserve officials and a
  // small nucleus while releasing the automatic affiliations once on migration.
  if(!p.membershipModelVersion){
    if(people.filter(c=>c.political.partyId).length>people.length*.5){const keep=new Set(people.filter(c=>p.officeHolder(c)).map(c=>c.id));for(const party of p.parties){const nucleus=people.filter(c=>c.political.partyId===party.id).sort((a,b)=>b.political.engagement-a.political.engagement).slice(0,2);for(const c of nucleus)keep.add(c.id);}for(const c of people)if(c.political.partyId&&!keep.has(c.id))leaveParty(p,c,'Fim da filiação automática; eleitor independente');}
    p.membershipModelVersion=1;
  }
  for(const c of people)if(c.political.partyId&&!p.party(c.political.partyId)?.active)leaveParty(p,c,'Partido encerrado');
  for(const party of p.parties.filter(a=>a.active&&!a.retiring&&!a.membershipSeeded)){inviteMembers(p,Math.max(0,2-party.memberIds.length),'Convite aceito para organizar o núcleo partidário',party);party.membershipSeeded=true;if(party.initialParty&&!party.founderIds?.length){party.founderIds=party.memberIds.slice(0,2);}}
  if(!p.membershipSeeded){const seats=Math.ceil(p.city.citizens.length*(p.policy.councilRate??5)/100),target=Math.min(Math.floor(people.length*.3),p.parties.filter(a=>a.active).length*2+seats);inviteMembers(p,Math.max(0,target-people.filter(c=>c.political.partyId).length),'Interesse em participar da organização política local');p.membershipSeeded=true;}
}
export function campaignContact(p,voter,nomination,election,source){
  p.initializeCitizen(voter);const s=membershipProfile(p,voter),party=p.party(nomination.partyId),candidate=p.city.society.citizen(nomination.citizenId);if(!party||!candidate)return;
  let opinion=s.support[party.id];
  if(!opinion){const keys=Object.keys(s.support);if(keys.length>=16){const oldest=keys.sort((a,b)=>s.support[a].lastContact-s.support[b].lastContact)[0];delete s.support[oldest];}opinion=s.support[party.id]={score:0,contacts:0,lastContact:-Infinity};}
  const cycleId=election.firstRoundId??election.id;if(opinion.cycleId!==cycleId){opinion.score*=.25;opinion.contacts=0;opinion.lastContact=-Infinity;opinion.cycleId=cycleId;}
  if(p.city.minute-opinion.lastContact<MEMBERSHIP_RULES.contactInterval)return;
  const proximity=1-p.distance(s.ideology,party.ideology)/2.8,relation=p.city.relationships.view(voter,candidate),record=p.mandates.recordScore(candidate.id,party.id);
  const relevant=nomination.promises.filter(pr=>promiseRelevant(p.city,voter,pr.metric)).length;
  const knownScandals=p.scandals.filter(r=>r.partyId===party.id&&r.proven&&r.awareIds?.includes(voter.id)).reduce((n,r)=>n+(r.severity||40)/100,0);
  const ambitionAttention=nomination.promises.reduce((n,pr)=>n+(pr.attention??.4),0);
  const effect=ambitionAttention*2*(1-s.criticalSense*.5)+(proximity-.6)*10+Math.min(3,relevant)*1.2+Math.tanh(record/30)*2+((relation?.trust??50)-50)*.035-knownScandals*8;
  opinion.score=clamp(opinion.score+effect*(1-s.criticalSense*.4),-25,30);opinion.contacts++;opinion.lastContact=p.city.minute;opinion.electionId=election.id;opinion.source=source;
  updateSympathy(s);
  // Persuasion usually changes the vote. Joining requires sustained interest,
  // ideological affinity and a separate, deliberately uncommon commitment.
  if(!s.partyId&&!s.foundingProposalId&&s.membershipCooldownUntil<=p.city.minute&&s.engagement>.6&&opinion.contacts>=3&&opinion.score>22&&proximity>.65&&p.city.random()<.04*(1-s.independence)&&canJoin(p,voter))p.join(voter,party,'Aproximação voluntária após conversas e propostas de campanha');
}
export function reviewMembership(p){
  if(p.membershipReviewDay===p.city.day)return;p.membershipReviewDay=p.city.day;
  for(const c of adults(p)){
    p.initializeCitizen(c);const s=membershipProfile(p,c),party=p.party(s.partyId);
    for(const opinion of Object.values(s.support))opinion.score*=.96;updateSympathy(s);
    if(!party?.active)continue;
    const distance=p.distance(s.ideology,party.ideology),memories=s.memories.filter(m=>m.partyId===party.id&&p.city.minute-m.minute<5*1440);
    const criticism=memories.reduce((n,m)=>n+(m.effect||0),0),scandals=p.scandals.filter(r=>r.partyId===party.id&&r.proven&&r.awareIds?.includes(c.id)).reduce((n,r)=>n+(r.severity||40)/100,0);
    const record=p.mandates.recordScore(null,party.id),governing=p.partyOfId(p.city.economy.mayorId)?.id===party.id;
    const target=clamp(((party.publicReputation??50)-50)/300+.5+(1-distance/2.8)*.25+record/100+clamp(criticism/80,-.4,.15)-scandals*.25+(governing?(p.approval-50)/150:0),.02,.95);
    s.loyalty=clamp(s.loyalty+(target-s.loyalty)*.18);
    if(!p.officeHolder(c)&&s.loyalty<.25&&p.city.minute-s.membershipSince>2*1440)leaveParty(p,c,scandals?'Decepção com corrupção conhecida':'Divergências, promessas e balanço do partido');
  }
}
