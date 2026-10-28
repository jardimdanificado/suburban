import {headquartersAccount} from './city_party_headquarters.js?v=party-caps-skin-1';
import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {equityShares} from './city_equity.js';

// A room's tenant controls its window; an owner only controls an unoccupied room.
function windowController(city,u){
 const account=u.tenantId||u.occupantId||u.ownerId;if(!account||account==='treasury')return null;
 const holder=city.accounts.get(account);if(holder?.entity?.properties?.citizen)return holder;
 if(u.occupantId===account&&holder?.ownerId)return city.society.citizen(holder.ownerId);
 return null;
}
function roofController(city,b){
 if(b.municipal||b.constructionKind==='open-air'||b.officeTenantOf)return null;
 const shares=b.equityShares?.length?equityShares(city,b):null;
 if(shares){const controlling=shares.find(s=>s.points>5000&&s.accountId.startsWith('citizen:'));return controlling?city.accounts.get(controlling.accountId):null;}
 const ids=new Set(b.units.map(u=>u.ownerId));if(ids.size===1){const owner=city.accounts.get([...ids][0]);if(owner?.entity?.properties?.citizen)return owner;if([...ids][0]===b.accountId&&b.ownerId)return city.society.citizen(b.ownerId);}
 return null;
}
function placement(b,u){
 const x=b.entity.x+u.x+.5,y=b.entity.y+u.y+.5;
 if(u.y===0)return {x,y:b.entity.y-.035,rotation:0};
 if(u.y===b.depth-1)return {x,y:b.entity.y+b.depth+.035,rotation:0};
 if(u.x===0)return {x:b.entity.x-.035,y,rotation:1};
 if(u.x===b.width-1)return {x:b.entity.x+b.width+.035,y,rotation:1};
 return null;
}
function currentRights(city,d){
 const b=city.building(d.buildingId);if(!b||b.entity.destroyed)return false;
 if(d.kind==='window_flag'){const u=city.units.get(d.unitId);return !!u?.hasWindow&&windowController(city,u)?.id===d.controllerId;}
 return roofController(city,b)?.id===d.controllerId;
}
export function maintainPropertyFlags(city,materials){
 for(const d of materials.decorations)if(!d.entity.destroyed&&['window_flag','roof_flag'].includes(d.kind)&&(!city.politics.party(d.partyId)?.active||!currentRights(city,d)))d.entity.destroyed=true;
}
export function planPropertyFlags(city,materials,e){
 if(city.hour<7||city.hour>=21)return;
 const campaigns=city.politics.campaigns,existing=new Set(materials.decorations.filter(d=>!d.entity.destroyed&&d.buildingId).map(d=>d.kind==='window_flag'?`window:${d.unitId}`:d.kind==='roof_flag'?`roof:${d.buildingId}`:null));
 const choices=[];
 for(const b of city.buildings){if(b.entity.destroyed||b.officeTenantOf||b.constructionKind==='open-air')continue;
  const owner=roofController(city,b);if(owner&&!owner.entity.destroyed&&!existing.has(`roof:${b.id}`))choices.push({kind:'roof_flag',b,c:owner,key:`roof:${b.id}`,point:{x:b.entity.x+b.width*.5,y:b.entity.y+b.depth*.5,rotation:b.rotation||0},height:(b.terrain?.base??1)+b.floors*CITY_FLOOR_HEIGHT});
  for(const u of b.units){if(!u.hasWindow||existing.has(`window:${u.id}`))continue;const c=windowController(city,u),point=placement(b,u);if(c&&!c.entity.destroyed&&point)choices.push({kind:'window_flag',b,u,c,key:`window:${u.id}`,point,height:(b.terrain?.base??1)+u.z*CITY_FLOOR_HEIGHT+CITY_FLOOR_HEIGHT*.55});}
 }
 for(const n of e.candidates){const party=city.politics.party(n.partyId);if(!party?.active)continue;const account=headquartersAccount(city.politics,party);
  let installed=0;for(const option of campaigns.sample(choices,Math.min(48,choices.length))){if(installed>=2)break;if(existing.has(option.key))continue;
   const {b,u,c,point}=option;city.politics.initializeCitizen(c);const distance=city.politics.distance(c.political.ideology,party.ideology),member=c.political.partyId===party.id,volunteer=member||(c.political.sympathyPartyId===party.id&&distance<.45),accept=volunteer||city.random()<Math.max(.03,Math.min(.65,.48-distance*.22));if(!accept)continue;
   const seller=account.inventory.bandeiras>0?account:city.economy.businesses.find(b=>b.active&&!b.entity.destroyed&&(b.inventory.bandeiras||0)>0),price=seller===account?0:city.economy.goods.bandeiras.price,fee=volunteer?0:city.currency.price(option.kind==='roof_flag'?1800:650);if(!seller||account.balance<price+fee)continue;
   if(price&&!city.transfer(account.accountId,seller.accountId,price,'Compra de bandeira eleitoral',{partyId:party.id,electionId:e.id,buildingId:b.id}))continue;
   if(fee&&!city.transfer(account.accountId,c.accountId,fee,'Autorização de bandeira eleitoral',{partyId:party.id,electionId:e.id,buildingId:b.id,unitId:u?.id}))continue;
   seller.inventory.bandeiras--;city.economy.consumed.bandeiras++;city.economy.recordGoods('campaign-installation','bandeiras',1,seller.id,b.id,{electionId:e.id,partyId:party.id});
   n.campaignFinance??={received:0,spent:0,donors:[]};n.campaignFinance.spent+=price+fee;
   const d={id:materials.nextId++,kind:option.kind,buildingId:b.id,unitId:u?.id??null,controllerId:c.id,partyId:party.id,partyNumber:party.number,candidateId:n.citizenId,candidateName:n.name,partyName:party.name,flag:party.flag,color:party.flag.background,rotation:point.rotation,height:option.height,voluntary:volunteer,fee,until:e.voteAt+1440,installedAt:city.minute};
   d.entity=city.createEntity({x:point.x,y:point.y,properties:{name:`Bandeira ${party.name} · ${party.number}`,campaignDecoration:d,render:{size:1,color:parseInt(d.color.slice(1),16)}}});materials.decorations.push(d);existing.add(option.key);installed++;
   campaigns.event(e,`${c.entity.properties.name} ${volunteer?'cedeu voluntariamente':'recebeu pagamento por'} ${u?'a janela':'o telhado'} de ${b.entity.properties.name} para bandeira de ${party.short} (${party.number}).`,'campaign-property-flag',[c.id,n.citizenId],{partyId:party.id,buildingId:b.id,unitId:u?.id,fee,voluntary:volunteer,decorationId:d.id});
  }
 }
}
