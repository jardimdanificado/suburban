import {headquartersAccount} from './city_party_headquarters.js?v=wardrobe-expansion-1';
import {inventoryFree} from './city_inventory.js';
import {selectClothes} from './city_clothing.js?v=party-apparel-1';

// Caps remain party property while loaned to members. Initial stock is counted
// as initial goods; later stock must be manufactured, paid for and delivered.
export function seedPartyCaps(p,party){
 if(party.initialCapsSeeded&&party.initialPartyShirtsSeeded)return;
 const city=p.city,holder=headquartersAccount(p,party);holder.garments??=[];
 let added=0;for(let i=0;i<10&&!party.initialCapsSeeded;i++){const garmentId=`garment-${city.nextGarmentId=(city.nextGarmentId||0)+1}`;holder.garments.push({garmentId,piece:'boné',style:'simples',color:party.flag.background,brandId:null,brandName:'Equipamento inicial do partido',quality:70,condition:100,dirt:0,manufacturedAt:city.minute,partyOwnerId:party.id,partyNumber:party.number,partyFlag:party.flag,ownerHistory:[{ownerId:holder.accountId,ownerName:party.name,minute:city.minute,event:'patrimônio inicial'}],custodyHistory:[]});added++;}party.initialCapsSeeded=true;
 if(!party.initialPartyShirtsSeeded){for(let i=0;i<10;i++){const garmentId=`garment-${city.nextGarmentId=(city.nextGarmentId||0)+1}`;holder.garments.push({garmentId,piece:'camisa estampada',style:'estampado',color:party.flag.background,brandId:null,brandName:'Confecção partidária',quality:70,condition:100,dirt:0,manufacturedAt:city.minute,partyOwnerId:party.id,partyNumber:party.number,partyFlag:party.flag,artPrint:{artId:`party-${party.id}-${i}`,cacheKey:`party-${party.id}-${party.number}`,kind:'flags',partyNumber:party.number,partyFlag:party.flag,message:party.short,color:party.flag.foreground},ownerHistory:[{ownerId:holder.accountId,ownerName:party.name,minute:city.minute,event:'patrimônio inicial'}],custodyHistory:[]});added++;}party.initialPartyShirtsSeeded=true;}
 holder.inventory.roupas+=added;city.economy.initialStock.roupas=(city.economy.initialStock.roupas||0)+added;
}
export function issuePartyCap(p,party,c){
 if(!party?.active||!c?.political||c.political.partyId!==party.id)return null;
 const holder=headquartersAccount(p,party);let cap=c.wardrobe?.find(g=>g.garmentId===c.political.partyCapId&&g.partyOwnerId===party.id&&g.condition>0);if(!cap){const index=holder.garments?.findIndex(g=>g.piece==='boné'&&(g.partyOwnerId===party.id||g.reservedPartyId===party.id)&&g.condition>0)??-1;if(index>=0&&holder.inventory.roupas>0){cap=holder.garments.splice(index,1)[0];holder.inventory.roupas--;cap.partyOwnerId=party.id;delete cap.reservedPartyId;cap.custodyHistory??=[];cap.custodyHistory.push({citizenId:c.id,minute:p.city.minute,action:'entregue'});c.wardrobe??=[];c.wardrobe.push(cap);c.political.partyCapId=cap.garmentId;}}if(cap){cap.partyNumber??=party.number;cap.partyFlag??=party.flag;}
 c.wardrobe??=[];if(!c.wardrobe.some(g=>g.partyOwnerId===party.id&&g.piece==='camisa estampada'&&g.condition>0)){const shirtIndex=holder.garments?.findIndex(g=>g.piece==='camisa estampada'&&(g.partyOwnerId===party.id||g.reservedPartyId===party.id)&&g.condition>0)??-1;if(shirtIndex>=0&&holder.inventory.roupas>0){const shirt=holder.garments.splice(shirtIndex,1)[0];holder.inventory.roupas--;shirt.partyOwnerId=party.id;delete shirt.reservedPartyId;shirt.custodyHistory??=[];shirt.custodyHistory.push({citizenId:c.id,minute:p.city.minute,action:'entregue'});c.wardrobe.push(shirt);}}
 if(cap||c.wardrobe.some(g=>g.partyOwnerId===party.id&&g.piece==='camisa estampada'))selectClothes(c);return cap||null;
}
export function returnPartyCap(p,party,c){
 const holder=headquartersAccount(p,party);holder.garments??=[];
 for(let i=(c.wardrobe?.length||0)-1;i>=0;i--){const cap=c.wardrobe[i];if(cap.partyOwnerId!==party.id)continue;c.wardrobe.splice(i,1);cap.custodyHistory??=[];cap.custodyHistory.push({citizenId:c.id,minute:p.city.minute,action:'devolvido'});holder.garments.push(cap);holder.inventory.roupas++;}
 if(c.political){c.political.partyCapId=null;c.political.partyShirtId=null;}selectClothes(c);if(c.campaign?.partyId===party.id)c.campaign.capGarmentId=null;
}
export function partyCapsHourly(p,party){
 const city=p.city,holder=headquartersAccount(p,party);holder.garments??=[];
 for(const id of party.memberIds){const c=city.society.citizen(id);if(c)issuePartyCap(p,party,c);}
 const election=p.active;
 if(election?.status==='campaign'){
  const seen=new Set();let remaining=8;
  for(const id of party.memberIds){const member=city.society.citizen(id);if(!member?.political?.partyCapId||member.indoorLocation||member.entity.destroyed)continue;
   for(const voter of city.citizens){if(!remaining)break;if(voter===member||voter.entity.destroyed||voter.indoorLocation||voter.political?.partyId===party.id||seen.has(voter.id)||!city.society.isAdult(voter))continue;const dx=voter.entity.x-member.entity.x,dy=voter.entity.y-member.entity.y;if(dx*dx+dy*dy>4)continue;
    p.initializeCitizen(voter);const affinity=1-p.distance(voter.political.ideology,party.ideology)/2.8,effect=Math.max(-1,Math.min(1.5,(affinity-.35)*2));
    p.remember(voter,{kind:'party-cap',electionId:election.id,partyId:party.id,effect,promiseKey:`party-cap:${election.id}:${party.id}`,description:`Viu ${member.entity.properties.name} usando o boné de ${party.short} na rua.`});seen.add(voter.id);remaining--;
   }if(!remaining)break;
  }
 }
 const loaned=party.memberIds.reduce((n,id)=>{const c=city.society.citizen(id);return n+Number(!!c?.wardrobe?.some(g=>g.partyOwnerId===party.id&&g.piece==='boné'&&g.condition>0));},0),loanedShirts=party.memberIds.reduce((n,id)=>{const c=city.society.citizen(id);return n+Number(!!c?.wardrobe?.some(g=>g.partyOwnerId===party.id&&g.piece==='camisa estampada'&&g.condition>0));},0),stock=holder.garments.filter(g=>g.partyOwnerId===party.id&&g.piece==='boné'||g.reservedPartyId===party.id&&g.piece==='boné').length,shirtStock=holder.garments.filter(g=>g.partyOwnerId===party.id&&g.piece==='camisa estampada'||g.reservedPartyId===party.id&&g.piece==='camisa estampada').length;
 const tailors=city.economy.businesses.filter(b=>b.active&&!b.entity.destroyed&&b.type==='tailor');
 for(const tailor of tailors){const ready=(tailor.garments||[]).filter(g=>g.reservedPartyId===party.id);if(ready.length&&holder.door&&inventoryFree(holder)>0){const quantity=Math.min(ready.length,inventoryFree(holder),24),ids=ready.slice(0,quantity).map(g=>g.garmentId);city.logistics.order(tailor,holder,'roupas',quantity,Math.ceil(city.economy.goods.roupas.price*1.5),{payerAccountId:holder.accountId,purpose:'party-caps',garmentIds:ids});}}
 const queued=tailors.reduce((n,b)=>n+(b.partyCapOrders||[]).filter(o=>o.partyId===party.id).reduce((sum,o)=>sum+o.remaining,0)+(b.garments||[]).filter(g=>g.reservedPartyId===party.id&&g.piece==='boné').length,0),queuedShirts=tailors.reduce((n,b)=>n+(b.partyShirtOrders||[]).filter(o=>o.partyId===party.id).reduce((sum,o)=>sum+o.remaining,0)+(b.garments||[]).filter(g=>g.reservedPartyId===party.id&&g.piece==='camisa estampada').length,0),incoming=city.logistics.shipments.filter(s=>s.buyer===holder&&!['delivered','cancelled'].includes(s.status)).reduce((n,s)=>n+(s.garments||[]).filter(g=>g.partyOwnerId===party.id&&g.piece==='boné').length,0),incomingShirts=city.logistics.shipments.filter(s=>s.buyer===holder&&!['delivered','cancelled'].includes(s.status)).reduce((n,s)=>n+(s.garments||[]).filter(g=>g.partyOwnerId===party.id&&g.piece==='camisa estampada').length,0);
 const missing=Math.max(0,Math.max(10,party.memberIds.length)-loaned-stock-incoming-queued);
 const missingShirts=Math.max(0,Math.max(6,Math.ceil(party.memberIds.length*.6))-loanedShirts-shirtStock-incomingShirts-queuedShirts);
 if(missing&&tailors.length&&holder.balance>=city.economy.goods.roupas.price*1.5){const tailor=tailors[0];tailor.partyCapOrders??=[];tailor.partyCapOrders.push({partyId:party.id,piece:'boné',remaining:missing,requestedAt:city.minute});city.log(`${party.short} encomendou ${missing} bonés partidários à ${tailor.entity.properties.name}.`,'government',[],{kind:'party-cap-order',partyId:party.id,buildingId:tailor.id,quantity:missing});}
 if(missingShirts&&tailors.length&&holder.balance>=city.economy.goods.roupas.price*1.5){const tailor=tailors[0];tailor.partyShirtOrders??=[];tailor.partyShirtOrders.push({partyId:party.id,piece:'camisa estampada',remaining:missingShirts,requestedAt:city.minute});city.log(`${party.short} encomendou ${missingShirts} camisas estampadas com a bandeira do partido à ${tailor.entity.properties.name}.`,'government',[],{kind:'party-shirt-order',partyId:party.id,buildingId:tailor.id,quantity:missingShirts});}
}
