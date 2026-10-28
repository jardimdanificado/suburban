import {ensureHeadquarters,headquartersAccount} from './city_party_headquarters.js?v=party-caps-skin-1';
/** Party accounts contain transferred currency, never newly created money. */
export function partyAccount(p,party){
  if(!party)return null;
  const accountId=party.accountId??=`party:${party.id}`;
  let account=p.city.accounts.get(accountId);
  if(!account){account={accountId,name:`Fundo partidário: ${party.name}`,balance:0,partyId:party.id};p.city.accounts.set(accountId,account);}
  account.name=`Fundo partidário: ${party.name}`;return account;
}
export function allocatePartyFunds(p,e){
  if(!e)return;const root=e.firstRoundElection||e;
  p.policy.partyFund??=80000;
  if(!root.partyFunding){const parties=p.parties.filter(a=>a.active);root.partyFunding={budget:p.policy.partyFund,partyIds:parties.map(a=>a.id),perParty:Math.floor(p.policy.partyFund/Math.max(1,parties.length)),paidPerParty:0,allocations:[],startedAt:p.city.minute};}
  const f=root.partyFunding; e.partyFunding=f;
  p.pendingPartyFunding??=[];if(f.paidPerParty<f.perParty&&!p.pendingPartyFunding.includes(root))p.pendingPartyFunding.push(root);
  const remaining=f.perParty-f.paidPerParty;if(remaining<=0||!f.partyIds.length)return;
  const available=Math.max(0,p.city.treasury-p.city.welfare.conditions().reserve),portion=Math.min(remaining,Math.floor(available/f.partyIds.length));
  if(portion<=0){f.status='Aguardando caixa após reserva de alimentação e moradia';return;}
  // Preflight the whole equal tranche. No party gets preferential access to scarce cash.
  for(const id of f.partyIds){const party=p.party(id);if(!party)return;partyAccount(p,party);}
  for(const id of f.partyIds){const party=p.party(id),account=partyAccount(p,party);p.city.transfer('treasury',account.accountId,portion,'Fundo partidário eleitoral igualitário',{partyId:id,electionId:root.id});f.allocations.push({partyId:id,amount:portion,minute:p.city.minute});if(!party.active&&account.balance>0)p.city.transfer(account.accountId,'treasury',account.balance,'Devolução de fundo de partido liquidado',{partyId:id,electionId:root.id});}
  f.paidPerParty+=portion;if(f.paidPerParty===f.perParty)p.pendingPartyFunding=p.pendingPartyFunding.filter(a=>a!==root);f.status=f.paidPerParty===f.perParty?'Integralmente distribuído':'Parcela igual paga; saldo aguardando caixa';
}
export function changePartyFund(p,value,bill){
  const old=p.policy.partyFund??80000;p.policy.partyFund=value;if(value===old)return;
  p.partyFundChanges??=[];const points=-Math.sign(value-old)*Math.min(8,2+Math.abs(value-old)/Math.max(1000,old)*10);
  const row={minute:p.city.minute,mayorId:p.city.economy.mayorId,old,value,points,billId:bill.id};p.partyFundChanges.push(row);if(p.partyFundChanges.length>64)p.partyFundChanges.shift();
  for(const c of p.city.citizens)if(!c.entity.destroyed)p.remember(c,{kind:'party-fund-change',candidateId:row.mayorId,partyId:p.partyOfId(row.mayorId)?.id,effect:points,description:`Fundo eleitoral ${value>old?'aumentado: desaprovação':'reduzido: aprovação'} (${old} → ${value}).`});
  p.city.log(`Fundo partidário por eleição: ${old} → ${value}; reação popular ${points>0?'positiva':'negativa'}.`,'government',[row.mayorId],{kind:'party-fund-change',billId:bill.id,oldBudget:old,newBudget:value,points});
}
export function illegalPartyFunding(p){
  const city=p.city;if(p.partyFundCrimeDay===city.day)return;p.partyFundCrimeDay=city.day;
  if(city.random()>.12)return;
  const officials=[city.society.citizen(city.economy.mayorId),...p.council.people()].filter(c=>c&&!c.entity.destroyed&&(c.traits?.honesty??.5)<.35&&p.partyOfId(c.id)?.active);
  const official=officials[Math.floor(city.random()*officials.length)];if(!official)return;
  const party=p.partyOfId(official.id);ensureHeadquarters(p,party);headquartersAccount(p,party);const account=city.accounts.get(party.secretAccountId),firm=city.economy.businesses.find(b=>b.ownerId&&b.balance>city.currency.price(20000)&&city.society.citizen(b.ownerId)?.political?.partyId===party.id),owner=city.society.citizen(firm?.ownerId);
  const from=firm?.accountId||'treasury',balance=city.accounts.get(from)?.balance||0,reserve=from==='treasury'?city.welfare.conditions().reserve:city.currency.price(15000),amount=Math.min(city.currency.price(1500+Math.floor(city.random()*6000)),Math.floor((balance-reserve)*.03));
  if(amount<=0)return;
  const record=p.crime(official,'party-fund-diversion',from,account.accountId,amount,{beneficiaryPartyId:party.id,buildingId:firm?.id,headquartersBuildingId:party.headquarters?.buildingId,participantIds:[official.id,owner?.id].filter(id=>id!=null),roles:[{citizenId:official.id,role:'Articulador do caixa clandestino'},...(owner?[{citizenId:owner.id,role:'Financiador empresarial favorecido'}]:[])]});
  if(record){record.concealment=.7;record.severity=55;record.steps[0].description=firm?'Doação empresarial oculta para o caixa clandestino da sede':'Verba pública desviada para o caixa clandestino da sede';}
}
