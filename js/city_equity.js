import {ideologicalProfile} from './city_ideology.js';
const TOTAL=10000;
const living=(city,id)=>{const a=city.accounts.get(id);return id==='treasury'||!!a?.entity?.properties?.citizen&&!a.entity.destroyed;};
export function privatizationQuota(city){
 const p=city.politics,day=Math.floor(city.minute/1440);
 p.policy.dailyPrivatizationLimit??=1;
 if(p.privatizationQuotaDay!==day){p.privatizationQuotaDay=day;p.privatizedTodayPoints=0;}
 const limit=Math.max(0,Math.min(10,p.policy.dailyPrivatizationLimit)),allowed=Math.round(limit*100);
 return {day,limit,allowed,sold:Math.max(0,p.privatizedTodayPoints||0),remaining:Math.max(0,allowed-(p.privatizedTodayPoints||0))};
}
function privatizationReaction(city,b,points,treasuryBefore){
 const mayor=city.society.citizen(city.economy.mayorId);if(!mayor)return;
 const needs=city.welfare.conditions(),urgent=!!needs.crisis||treasuryBefore<needs.reserve;
 for(const c of city.citizens){
  if(c.entity.destroyed||!city.society.isAdult(c))continue;
  const profile=ideologicalProfile(c),effect=(profile.economy*.7-profile.ownership*.65-profile.regulation*.15+(urgent?1.6:0))*(points/100)*.45;
  city.politics.remember(c,{kind:'policy-reaction',candidateId:mayor.id,partyId:mayor.political?.partyId??null,effect,truth:true,description:`Privatização de ${b.entity.properties.name}${urgent?' durante uma emergência fiscal':''}.`});
 }
}
export function equityShares(city,b){
 if(b.equityShares?.length)return b.equityShares;
 const partners=(b.equityPartners||[]).filter(s=>s.amount>0&&city.accounts.has(`citizen:${s.citizenId}`));
 if(partners.length){const total=partners.reduce((n,s)=>n+s.amount,0);let used=0;return partners.map((s,i)=>{const points=i===partners.length-1?TOTAL-used:Math.floor(s.amount/total*TOTAL);used+=points;return {accountId:`citizen:${s.citizenId}`,points};}).filter(s=>s.points);}
 return [{accountId:b.municipal||!b.ownerId?'treasury':`citizen:${b.ownerId}`,points:TOTAL}];
}
export function equityValue(city,b){
 const property=b.units.reduce((n,u)=>n+(u.ownerId===b.accountId||!b.equityShares?u.price||0:0),0),lot=city.development.plots.find(p=>p.id===b.plotId),land=lot&&(lot.ownerId===b.accountId||!b.equityShares)?lot.price||0:0;
 const stock=Object.entries(b.inventory||{}).reduce((n,[good,q])=>n+Math.max(0,q)*(city.economy.goods[good]?.price||0),0);
 const debt=city.bank.loans.filter(l=>l.clientId===b.accountId&&!['paid','written-off'].includes(l.status)).reduce((n,l)=>n+(l.remaining||0)+(l.interest||0),0);
 return Math.max(city.currency.price(10000),Math.floor(property+land+Math.max(0,b.balance)+stock-debt));
}
function control(city,b){
 const shares=b.equityShares,municipal=(shares.find(s=>s.accountId==='treasury')?.points||0)>TOTAL/2;
 const leader=municipal?null:shares.filter(s=>s.accountId.startsWith('citizen:')&&living(city,s.accountId)&&city.politics.canOwnBusiness(city.accounts.get(s.accountId))).sort((a,c)=>c.points-a.points||a.accountId.localeCompare(c.accountId))[0];
 const old=city.society.citizen(b.ownerId),next=leader?city.accounts.get(leader.accountId):null;
 if(old&&old!==next)old.businessIds=old.businessIds.filter(id=>id!==b.id);
 b.ownerId=next?.id??null;b.municipal=municipal;
 if(next&&!next.businessIds.includes(b.id)){if(next.jobId)city.economy.leaveJob(next,'Assumiu gestão de empresa');next.businessIds.push(b.id);}
}
export function initializeEquity(city,b){
 if(b.equityShares?.length)return true;
 const original=b.municipal||!b.ownerId?'treasury':`citizen:${b.ownerId}`;
 if(b.units.some(u=>u.ownerId!==original&&u.ownerId!==b.accountId))return city.fail('O imóvel possui espaços de outros proprietários; não é possível incorporá-lo ao capital da empresa.');
 const lot=city.development.plots.find(p=>p.id===b.plotId);if(lot&&lot.ownerId!==original&&lot.ownerId!==b.accountId)return city.fail('O terreno pertence a outra conta e não pode ser incorporado à empresa.');
 b.equityShares=equityShares(city,b).map(s=>({...s}));b.equityPartners=null;b.shareOffers??=[];b.shareHistory??=[];
 for(const u of b.units){u.ownerId=b.accountId;u.forSale=false;u.forRent=false;}
 if(lot){lot.ownerId=b.accountId;lot.forSale=false;lot.forRent=false;}
 control(city,b);return true;
}
export function offerShares(city,b,sellerId,points,{billId=null,capitalRaise=false}={}){
 if(!b?.active||b.entity.destroyed||['townhall','mint'].includes(b.type)||b.officialJournal)return city.fail('Empresa indisponível para negociação.');
 if(!Number.isSafeInteger(points)||points<1||points>TOTAL)return city.fail('Informe um percentual válido de 0,01% a 100%.');
 const shares=equityShares(city,b),owned=shares.find(s=>s.accountId===sellerId)?.points||0,reserved=(b.shareOffers||[]).filter(o=>o.status==='open'&&o.sellerId===sellerId).reduce((n,o)=>n+o.remaining,0);
 if(points>owned-reserved)return city.fail('A participação disponível é menor que a quantidade solicitada.');
 const valuation=equityValue(city,b);if(!initializeEquity(city,b))return null;
 const offer={id:(b.nextShareOfferId??1),sellerId,points,remaining:points,valuation,createdAt:city.minute,status:'open',billId,capitalRaise:!!capitalRaise};b.nextShareOfferId=offer.id+1;b.shareOffers.push(offer);
 city.log(capitalRaise?`${city.accountName(sellerId)} abriu captação para ${b.entity.properties.name} em troca de ${(points/100).toFixed(2)}% de participação.`:`${city.accountName(sellerId)} colocou ${(points/100).toFixed(2)}% de ${b.entity.properties.name} à venda.`,'business',[],{kind:capitalRaise?'share-capital-raise':'share-offer',buildingId:b.id,offerId:offer.id,billId,points,valuation,capitalRaise:!!capitalRaise});return offer;
}
export function buyShares(city,b,offerId,buyerId,points){
 const offer=b?.shareOffers?.find(o=>o.id===offerId&&o.status==='open'),buyer=city.accounts.get(buyerId);
 if(!offer||!b.active||b.entity.destroyed||!buyer||!living(city,buyerId)||buyerId===offer.sellerId)return city.fail('Oferta ou comprador indisponível.');
 if(!Number.isSafeInteger(points)||points<1||points>offer.remaining)return city.fail('Quantidade fora do saldo da oferta.');
 const publicPrivatization=offer.sellerId==='treasury',quota=publicPrivatization?privatizationQuota(city):null;
 if(quota){points=Math.min(points,quota.remaining);if(points<1)return city.fail('A cota diária de privatização já foi usada.');}
 const seller=b.equityShares.find(s=>s.accountId===offer.sellerId);if(!seller||seller.points<points)return city.fail('O vendedor não possui mais essa participação.');
 const treasuryBefore=city.treasury,price=Math.max(1,Math.ceil(offer.valuation*points/TOTAL)),recipient=offer.capitalRaise?b.accountId:offer.sellerId;if(!Number.isSafeInteger(price)||!city.transfer(buyerId,recipient,price,offer.capitalRaise?'Aporte de capital por venda de participação':'Compra de participação empresarial',{buildingId:b.id,offerId,points}))return city.fail('Saldo insuficiente para comprar a participação.');
 seller.points-=points;let acquired=b.equityShares.find(s=>s.accountId===buyerId);if(!acquired){acquired={accountId:buyerId,points:0};b.equityShares.push(acquired);}acquired.points+=points;b.equityShares=b.equityShares.filter(s=>s.points>0);offer.remaining-=points;if(!offer.remaining)offer.status='sold';
 const event={minute:city.minute,from:offer.sellerId,to:buyerId,points,price,offerId,billId:offer.billId,capitalRaise:!!offer.capitalRaise};b.shareHistory.push(event);if(b.shareHistory.length>160)b.shareHistory.shift();city.history.ownership(b,offer.sellerId,buyerId,{action:offer.capitalRaise?'capital-raise':'share-purchase',amount:price,points,offerId,billId:offer.billId});if(quota){city.politics.privatizedTodayPoints=quota.sold+points;privatizationReaction(city,b,points,treasuryBefore);}control(city,b);return event;
}
export function cancelShareOffer(city,b,offerId,sellerId){const offer=b?.shareOffers?.find(o=>o.id===offerId&&o.status==='open'&&o.sellerId===sellerId);if(!offer)return city.fail('Oferta indisponível.');offer.status='cancelled';offer.cancelledAt=city.minute;return true;}
export function tradeSharesHourly(city){
 for(const b of city.economy.businesses){
  // Let healthy private firms and commercial landlords float a small block of
  // equity periodically, so the exchange has real recurring inventory.
  const eligible=b.active&&!b.entity.destroyed&&!b.municipal&&(b.type==='office_tower'||b.totalRevenue>0&&b.balance>city.currency.price(10000));
  if(eligible&&(b.lastMarketOfferingAt==null||city.minute-b.lastMarketOfferingAt>=10080)&&!(b.shareOffers||[]).some(o=>o.status==='open')){
   const holders=equityShares(city,b).filter(s=>s.accountId!=='treasury'&&s.accountId.startsWith('citizen:')).sort((a,z)=>z.points-a.points),seller=holders[0];
   if(seller&&seller.points>=500){const offer=offerShares(city,b,seller.accountId,Math.min(500,seller.points));if(offer){b.lastMarketOfferingAt=city.minute;offer.marketFloat=true;}}
  }
  const offers=(b.shareOffers||[]).filter(o=>o.status==='open');for(const open of offers)if(open.capitalRaise&&city.minute-(open.lastRepricedAt??open.createdAt)>=1440){open.valuation=Math.max(Math.floor(open.valuation*.88),Math.floor(equityValue(city,b)*.5));open.lastRepricedAt=city.minute;}
  const offer=offers[0];if(!offer)continue;
  const buyers=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&c.accountId!==offer.sellerId&&c.balance>city.currency.price(20000)).sort((a,d)=>d.balance-a.balance||a.id-d.id);
  for(const c of buyers.slice(0,8)){const budget=Math.max(0,Math.floor((c.balance-city.currency.price(20000))*.2)),points=Math.min(offer.remaining,500,Math.floor(budget*TOTAL/offer.valuation));if(points>0)buyShares(city,b,offer.id,c.accountId,points);if(offer.status!=='open')break;}
 }
}
export function distributeShareDividends(city,b){
 if(!b.equityShares?.length)return 0;const profit=Math.max(0,b.totalRevenue-b.totalExpenses-(b.dividends||0)-(b.fiscalDistributedProfit||0)),dividend=Math.min(Math.floor(profit*.35),Math.max(0,b.balance-city.fiscal.businessReserve(b)));let paid=0;
 for(const share of b.equityShares){const amount=Math.floor(dividend*share.points/TOTAL);if(amount&&city.transfer(b.accountId,share.accountId,amount,'Distribuição de lucros por participação',{buildingId:b.id,points:share.points})){paid+=amount;b.dividends=(b.dividends||0)+amount;}}
 return paid;
}
export function inheritShares(city,c,heir){
 for(const b of city.economy.businesses){if(!b.equityShares?.length&&b.equityPartners?.some(s=>s.citizenId===c.id))initializeEquity(city,b);if(!b.equityShares?.length)continue;const share=b.equityShares.find(s=>s.accountId===c.accountId);if(!share)continue;const to=heir?.accountId||'treasury',points=share.points,existing=b.equityShares.find(s=>s.accountId===to);if(existing){existing.points+=points;b.equityShares=b.equityShares.filter(s=>s!==share);}else share.accountId=to;for(const o of b.shareOffers||[])if(o.sellerId===c.accountId&&o.status==='open')o.status='cancelled';b.shareHistory??=[];b.shareHistory.push({minute:city.minute,from:c.accountId,to,points,price:0,reason:'inheritance'});city.history.ownership(b,c.accountId,to,{action:'share-inheritance',points});control(city,b);}
}
export function nationalizeShares(city,b,bill){
 if(!b.equityShares?.length)return null;const privateShares=b.equityShares.filter(s=>s.accountId!=='treasury');if(!privateShares.length)return 'Empresa já pertence integralmente à prefeitura';const valuation=equityValue(city,b),payments=privateShares.map(s=>({s,amount:Math.max(1,Math.ceil(valuation*s.points/TOTAL))})),total=payments.reduce((n,p)=>n+p.amount,0);
 if(city.treasury<total||!city.fiscal.allows(total,'Compra de participações para estatização',{buildingId:b.id,billId:bill.id}))return 'Aguardando caixa municipal';
 for(const {s,amount} of payments){if(!city.transfer('treasury',s.accountId,amount,'Compra de participações para estatização',{buildingId:b.id,billId:bill.id,points:s.points}))return 'Compra não concluída';b.shareHistory.push({minute:city.minute,from:s.accountId,to:'treasury',points:s.points,price:amount,billId:bill.id});city.history.ownership(b,s.accountId,'treasury',{action:'nationalization',amount,points:s.points,billId:bill.id});}
 b.equityShares=[{accountId:'treasury',points:TOTAL}];for(const offer of b.shareOffers||[])if(offer.status==='open')offer.status='cancelled';control(city,b);return '';
}

export function liquidateShareCash(city,b){
 if(!b.equityShares?.length)return false;const balance=b.balance,shares=b.equityShares;let paid=0;
 for(let i=0;i<shares.length;i++){const share=shares[i],amount=i===shares.length-1?balance-paid:Math.floor(balance*share.points/TOTAL),recipient=city.accounts.has(share.accountId)?share.accountId:'treasury';if(amount&&city.transfer(b.accountId,recipient,amount,'Liquidação de participação empresarial',{buildingId:b.id,points:share.points}))paid+=amount;}
 return true;
}
