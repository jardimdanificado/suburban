import {headquartersAccount} from './city_party_headquarters.js?v=party-caps-skin-1';
import {inventoryFree} from './city_inventory.js';
import {selectClothes} from './city_clothing.js?v=party-caps-skin-1';

// Caps remain party property while loaned to members. Initial stock is counted
// as initial goods; later stock must be manufactured, paid for and delivered.
export function seedPartyCaps(p,party){
 if(party.initialCapsSeeded)return;
 const city=p.city,holder=headquartersAccount(p,party);holder.garments??=[];
 for(let i=0;i<10;i++){const garmentId=`garment-${city.nextGarmentId=(city.nextGarmentId||0)+1}`;holder.garments.push({garmentId,piece:'boné',style:'simples',color:party.flag.background,brandId:null,brandName:'Equipamento inicial do partido',quality:70,condition:100,dirt:0,manufacturedAt:city.minute,partyOwnerId:party.id,ownerHistory:[{ownerId:holder.accountId,ownerName:party.name,minute:city.minute,event:'patrimônio inicial'}],custodyHistory:[]});}
 holder.inventory.roupas+=10;city.economy.initialStock.roupas=(city.economy.initialStock.roupas||0)+10;party.initialCapsSeeded=true;
}
export function issuePartyCap(p,party,c){
 if(!party?.active||!c?.political||c.political.partyId!==party.id)return null;
 const current=c.wardrobe?.find(g=>g.garmentId===c.political.partyCapId&&g.partyOwnerId===party.id&&g.condition>0);if(current)return current;
 const holder=headquartersAccount(p,party),index=holder.garments?.findIndex(g=>g.piece==='boné'&&(g.partyOwnerId===party.id||g.reservedPartyId===party.id)&&g.condition>0)??-1;if(index<0||holder.inventory.roupas<1)return null;
 const cap=holder.garments.splice(index,1)[0];holder.inventory.roupas--;cap.partyOwnerId=party.id;delete cap.reservedPartyId;cap.custodyHistory??=[];cap.custodyHistory.push({citizenId:c.id,minute:p.city.minute,action:'entregue'});c.wardrobe??=[];c.wardrobe.push(cap);c.political.partyCapId=cap.garmentId;selectClothes(c);return cap;
}
export function returnPartyCap(p,party,c){
 const holder=headquartersAccount(p,party);holder.garments??=[];
 for(let i=(c.wardrobe?.length||0)-1;i>=0;i--){const cap=c.wardrobe[i];if(cap.partyOwnerId!==party.id)continue;c.wardrobe.splice(i,1);cap.custodyHistory??=[];cap.custodyHistory.push({citizenId:c.id,minute:p.city.minute,action:'devolvido'});holder.garments.push(cap);holder.inventory.roupas++;}
 if(c.political)c.political.partyCapId=null;selectClothes(c);if(c.campaign?.partyId===party.id)c.campaign.capGarmentId=null;
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
 const loaned=party.memberIds.reduce((n,id)=>{const c=city.society.citizen(id);return n+Number(!!c?.wardrobe?.some(g=>g.partyOwnerId===party.id&&g.condition>0));},0),stock=holder.garments.filter(g=>g.partyOwnerId===party.id||g.reservedPartyId===party.id).length;
 const tailors=city.economy.businesses.filter(b=>b.active&&!b.entity.destroyed&&b.type==='tailor');
 for(const tailor of tailors){const ready=(tailor.garments||[]).filter(g=>g.reservedPartyId===party.id);if(ready.length&&holder.door&&inventoryFree(holder)>0){const quantity=Math.min(ready.length,inventoryFree(holder),24),ids=ready.slice(0,quantity).map(g=>g.garmentId);city.logistics.order(tailor,holder,'roupas',quantity,Math.ceil(city.economy.goods.roupas.price*1.5),{payerAccountId:holder.accountId,purpose:'party-caps',garmentIds:ids});}}
 const queued=tailors.reduce((n,b)=>n+(b.partyCapOrders||[]).filter(o=>o.partyId===party.id).reduce((sum,o)=>sum+o.remaining,0)+(b.garments||[]).filter(g=>g.reservedPartyId===party.id).length,0);
 const missing=Math.max(0,Math.max(10,party.memberIds.length)-loaned-stock-(holder.incoming.roupas||0)-queued);
 if(missing&&tailors.length&&holder.balance>=city.economy.goods.roupas.price*1.5){const tailor=tailors[0];tailor.partyCapOrders??=[];tailor.partyCapOrders.push({partyId:party.id,remaining:missing,requestedAt:city.minute});city.log(`${party.short} encomendou ${missing} bonés na cor do partido à ${tailor.entity.properties.name}.`,'government',[],{kind:'party-cap-order',partyId:party.id,buildingId:tailor.id,quantity:missing});}
}
