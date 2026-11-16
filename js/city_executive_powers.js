import {SECRETARIATS,SECRETARY_MODE_RANK} from './city_secretariats.js';

export function ensureExecutiveRules(p){
 for(const [key,fallback,max]of [['mayorDecreeDays',3,30],['impeachmentCooldownElections',2,10]])if(!Number.isSafeInteger(p.policy[key])||p.policy[key]<1||p.policy[key]>max)p.policy[key]=fallback;
 p.vetoes??=[];
}
export function decreePowerIncrease(p,type,payload={}){
 ensureExecutiveRules(p);
 // Changes to electoral control or judicial powers require the legislature.
 if(['mayorElectionSystem','entrepreneurCandidates','partyFund','pollMinRate','pollMaxRate','suspend','convict','impeach','confidence','arrestAuthorization','releasePrisoner'].includes(type))return true;
 if(type==='secretaryElection')return (SECRETARY_MODE_RANK[payload.mode]??-1)<(SECRETARY_MODE_RANK[p.policy.secretaryElectionModes?.[payload.office]||'appointed']);
 if(['reelectionLimit','termDays','mayorBudget','impeachmentCooldownElections','dailyPrivatizationLimit'].includes(type))return payload.value>p.policy[type];
 if(['mayorDecreeDays','partyLimit','mayorCandidateLimit','campaignDays','councilRate','councilBudget'].includes(type))return payload.value<p.policy[type];
 if(type==='councilSeats')return payload.value<p.council.seats;
 if(type==='parliamentaryImmunity')return payload.value===true;
 if(type==='cleanRecord')return payload.value===false;
 if(type==='penalCode'){
  const current=p.city.justice.policies.penalCode[payload.crime],rule=payload.rule;
  return !!current&&!!rule&&((current.politicalDisqualification&&!rule.politicalDisqualification)||(current.cassation&&!rule.cassation)||(current.criminal&&rule.criminal===false&&['corruption','investigationFraud'].includes(payload.crime)));
 }
 return false;
}
export function decreeReadyAt(p){
 ensureExecutiveRules(p);
 return (p.lastDecreeAt??p.termStartedAt??p.mandates.current?.startedAt??0)+p.policy.mayorDecreeDays*1440;
}
export function decreeError(p,type,payload,authorId){
 if(authorId!==p.city.economy.mayorId||!p.city.society.citizen(authorId)||p.suspendedExecutive?.citizenId===authorId)return 'Somente o prefeito em exercício pode emitir decreto.';
 if(decreePowerIncrease(p,type,payload))return 'Decreto não pode ampliar poderes, proteção ou controle eleitoral do prefeito; apresente a medida à Câmara.';
 if(p.city.minute<decreeReadyAt(p))return 'O direito a novo decreto ainda está no intervalo aprovado pela Câmara.';
 return null;
}
export function issueDecree(p,type,payload={},authorId=p.city.economy.mayorId){
 const error=decreeError(p,type,payload,authorId);if(error)return p.city.fail(error);
 return p.council.propose(p.city.society.citizen(authorId),type,structuredClone(payload),null,{decree:true});
}
export function impeachmentReady(p,billId=null){
 ensureExecutiveRules(p);
 const last=p.impeachmentProcess;
 if(last&&billId!=null&&last.billId===billId)return true;
 if(p.council.bills.some(b=>['impeach','confidence'].includes(b.type)&&['awaiting-session','proposed','approved','executing'].includes(b.status)))return false;
 return !last||p.termNumber-last.termNumber>=p.policy.impeachmentCooldownElections;
}
export function billSecretariats(p,bill){
 const type=bill.type,payload=bill.payload||{};
 if(type==='economicPolicy'){
  if(['directHiring','jobBoardLimit','interviewGraceMinutes'].includes(payload.key))return ['labor'];
  if(['municipalRentals','municipalRentDiscount'].includes(payload.key))return ['urban_development','social_defense'];
  return ['finance'];
 }
 if(['tax','businessTax','salesTax','inflation','worksBudget','worksTransfer','mayorBudget','councilBudget','partyFund','dailyPrivatizationLimit'].includes(type))return ['finance'];
 if(type==='tradeTax')return ['finance','foreign_relations'];
 if(type==='minimumWage')return ['labor'];
 if(type==='welfare')return ['social_defense'];
 if(type==='roads')return ['urban_development','transport'];
 if(type==='transportPolicy')return ['transport'];
 if(['policeStaffing','penalCode'].includes(type))return ['security'];
 if(type==='prejudiceLaw')return ['social_defense'];
 if(type==='substanceLaw')return ['health','security'];
 if(['cityName','citySlogan','cityFlag'].includes(type))return ['education_culture'];
 if(['build','nationalize','privatize'].includes(type)){
  const buildingType=payload.buildingType||p.city.building(payload.buildingId)?.type||'';
  const offices=['urban_development',...(['nationalize','privatize'].includes(type)?['finance']:[])];
  if(/clinic|hospital|forensic/.test(buildingType))offices.push('health');
  if(/police|prison|court/.test(buildingType))offices.push('security');
  if(/school|library|theater|publisher/.test(buildingType))offices.push('education_culture');
  if(/farm|forestry|clean|waste|recycl|compost|toilet/.test(buildingType))offices.push('environment');
  if(/housing|refectory|kitchen/.test(buildingType))offices.push('social_defense');
  if(/carrier|bike|transport/.test(buildingType))offices.push('transport');
  return offices;
 }
 return [];
}
export function secretaryVeto(p,billId,secretaryId){
 const bill=p.council.bills.find(b=>b.id===billId),holder=p.secretaries?.find(s=>s.citizenId===secretaryId),person=p.city.society.citizen(secretaryId);
 if(!bill||!holder||!person||!['awaiting-sanction','awaiting-secretary-review'].includes(bill.status)||!billSecretariats(p,bill).includes(holder.officeId))return p.city.fail('O secretário só pode vetar uma medida pendente da sua própria área.');
 bill.status='vetoed';bill.vetoedBy=person.id;bill.vetoedAt=p.city.minute;bill.overrideAt=p.city.minute+360;
 const record={billId,secretaryId,officeId:holder.officeId,mayorName:person.entity.properties.name,title:bill.title,termNumber:p.termNumber,minute:p.city.minute,status:'awaiting-override-vote'};
 record.eventId=p.city.log(`${person.entity.properties.name}, da ${SECRETARIATS.find(o=>o.id===holder.officeId)?.short}, vetou ${bill.title}; a Câmara pode derrubar por dois terços.`,'government',[person.id],{kind:'secretary-veto',billId,officeId:holder.officeId}).id;
 p.vetoes.push(record);bill.vetoRecordId=p.vetoes.length-1;return true;
}
export function reviewSecretaryVetoes(p,bill){
 if(bill.vetoOverridden)return false;
 for(const holder of p.secretaries||[]){
  const person=p.city.society.citizen(holder.citizenId);
  if(!person||person.playerControlled||!p.party(person.political?.partyId)||!billSecretariats(p,bill).includes(holder.officeId))continue;
  if(!p.council.preference(person,bill).yes&&secretaryVeto(p,bill.id,person.id))return true;
 }
 return false;
}
