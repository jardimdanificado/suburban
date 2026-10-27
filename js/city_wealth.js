import {equityShares} from './city_equity.js';
/** Read-only valuation of existing assets; commercial records exclude cash transfers and escrow reservations. */
export const MARKET_HISTORY_LIMIT=600;
const positive=n=>Number.isFinite(n)?Math.max(0,n):0;
const live=b=>b&&!b.entity?.destroyed;
export function marketKind(reason=''){
 if(/reserva|estorno|devolução|voto|propina/i.test(reason))return null;
 if(/^(Compra de espaço|Compra de instalações|Compra de terreno|Compra negociada para estatização|Compra negociada de terreno)/.test(reason))return 'property';
 if(/^(Primeiro aluguel|Aluguel)/.test(reason))return 'rent';
 if(/^(Atacado:|Exportação:)/.test(reason))return 'wholesale';
 if(/^(Compra|Serviço: Venda)/.test(reason))return 'retail';
 if(/^(Serviço|Frete entregue|Água para cuidados)/.test(reason))return 'service';return null;
}
export function recordMarketTransaction(city,from,to,amount,reason,details={},eventId=null){
 const kind=marketKind(reason);if(!kind||!(amount>0)||from===to)return;
 const shipment=city.accounts.get(from)?.seller?city.accounts.get(from):null,payer=shipment?.payerAccountId||from;
 const project=city.development.projects.find(p=>p.feeAccountId===payer||p.materialAccountId===payer),job=city.sanitation.jobs.find(j=>j.accountId===payer),buyer=project?.accountId||job?.payerId||payer;
 const vehicle=details.vehicleId!=null?city.vehicles?.units.get(details.vehicleId):null;
 const row=Object.freeze({id:city.nextMarketTradeId=(city.nextMarketTradeId||0)+1,minute:city.minute,buyer,seller:to,buyerName:city.accountName(buyer),sellerName:city.accountName(to),amount,kind,reason,good:details.good||(kind==='wholesale'?shipment?.good:null)||(/^Compra de (mobilidade|bicicleta)/.test(reason)?vehicle?.good:null)||(/Compra de bandeira/.test(reason)?'bandeiras':/Compra de tinta/.test(reason)?'tinta':null),quantity:details.quantity??(kind==='wholesale'?shipment?.quantity:null)??(/^Compra de (mobilidade|bicicleta|bandeira)/.test(reason)?1:null),shipmentId:details.shipmentId??shipment?.id??null,vehicleId:details.vehicleId??null,buildingId:details.buildingId??null,unitId:details.unitId??null,eventId});
 city.marketHistory??=[];city.marketHistory.push(row);if(city.marketHistory.length>MARKET_HISTORY_LIMIT)city.marketHistory.splice(0,100);
}
export function recentMarketSales(city){
 if(city.marketHistory)return city.marketHistory;
 // Old sessions retain only a bounded cash ledger; do not invent past sales.
 return city.ledger.filter(r=>marketKind(r.reason)&&r.amount>0&&r.from!==r.to).map((r,i)=>({id:`legacy:${i}`,minute:r.minute,buyer:r.from,seller:r.to,buyerName:city.accountName(r.from),sellerName:city.accountName(r.to),amount:r.amount,kind:marketKind(r.reason),reason:r.reason,eventId:r.eventId,good:null,quantity:null}));
}
export function wealthDistribution(values){
 const rows=values.map(positive).sort((a,b)=>a-b),total=rows.reduce((n,v)=>n+v,0),count=rows.length;
 return {total,median:count?(rows[Math.floor((count-1)/2)]+rows[Math.floor(count/2)])/2:0,gini:total&&count?rows.reduce((n,v,i)=>n+(2*(i+1)-count-1)*v,0)/(count*total):0,top10:total?rows.slice(-Math.max(1,Math.ceil(count*.1))).reduce((n,v)=>n+v,0)/total:0,zero:rows.filter(v=>v===0).length};
}
export function buildWealthReport(city){
 const direct=new Map(),assets=[],locations=[],goods=new Map(),claims=[],custody=new Map(),buildings=new Map(city.buildings.filter(live).map(b=>[b.accountId,b]));
 const ensure=id=>{id??='unidentified';if(!direct.has(id)){const a=city.accounts.get(id),b=buildings.get(id),citizen=!!a?.entity?.properties.citizen;direct.set(id,{id,name:city.accountName(id)||'Titular não identificado',type:id==='treasury'?'public':['supplier','external-trade'].includes(id)?'external':citizen?'person':b?'company':String(id).startsWith('party:')?'party':'institution',citizenId:citizen?a.id:null,buildingId:b?.id??null,cash:0,savings:0,reserved:0,inventory:0,property:0,land:0,vehicles:0,durables:0,receivables:0,debt:0,gross:0,net:0,assets:[]});}return direct.get(id);};
 const add=(owner,kind,value,detail={})=>{value=positive(value);if(!value)return;const row=ensure(owner),asset={id:assets.length,ownerId:row.id,kind,value,...detail};row[kind]+=value;row.assets.push(asset.id);assets.push(asset);return asset;};
 for(const p of city.development.projects){if(p.feeAccountId)custody.set(p.feeAccountId,{owner:p.accountId,label:`Reserva do contrato ${p.id}`});if(p.materialAccountId)custody.set(p.materialAccountId,{owner:p.accountId,label:`Materiais e capital da obra ${p.id}`});}
 for(const job of city.sanitation.jobs)custody.set(job.accountId,{owner:job.payerId,label:`Reserva de faxina #${job.id}`});
 for(const s of city.logistics.shipments)custody.set(s.accountId,{owner:s.payerAccountId||s.buyer.accountId,label:`Reserva do frete #${s.id}`});
 custody.set('works-budget',{owner:'treasury',label:'Orçamento municipal de obras'});
 const deposits=new Map([...city.bank.deposits.entries()]);let money=0,externalMoney=0;
 for(const [id,account]of city.accounts){const value=positive(account.balance),deposit=deposits.get(id),escrow=custody.get(id);money+=value;if(['supplier','external-trade'].includes(id))externalMoney+=value;
  add(deposit?.clientId||escrow?.owner||id,deposit?'savings':escrow?'reserved':'cash',value,{label:deposit?'Poupança':escrow?.label||'Dinheiro disponível',location:deposit?city.building(deposit.bankId)?.entity.properties.name||'Banco ausente':escrow?.label||city.accountName(id),accountId:id,buildingId:deposit?.bankId??buildings.get(id)?.id??null});
 }
 for(const c of city.citizens)if(!c.entity.destroyed)ensure(c.accountId);
 const inventory=(holder,owner,label,meta={})=>{
  if(!holder?.inventory)return;let value=0,quantity=0;
  for(const [good,n]of Object.entries(holder.inventory)){if(!(n>0))continue;const price=positive(city.economy.goods[good]?.price),amount=n*price;value+=amount;quantity+=n;
   add(owner,'inventory',amount,{label:city.economy.goods[good]?.label||good,location:label,good,quantity:n,...meta});
   let row=goods.get(good);if(!row){row={good,label:city.economy.goods[good]?.label||good,quantity:0,value:0,price,holders:[]};goods.set(good,row);}row.quantity+=n;row.value+=amount;row.holders.push({ownerId:owner,location:label,quantity:n,value:amount,...meta});
  }if(quantity)locations.push({id:locations.length,ownerId:owner,name:label,value,quantity,...meta});
 };
 for(const b of city.buildings.filter(live)){
  inventory(b,b.accountId,b.entity.properties.name,{buildingId:b.id,x:b.entity.x,y:b.entity.y,placeKind:'building'});
  const owners=new Map();for(const u of b.units){const group=owners.get(u.ownerId)||{value:0,count:0};group.value+=positive(u.price)*Math.min(1,positive(b.condition??100)/100);group.count++;owners.set(u.ownerId,group);}
  for(const [owner,r]of owners)add(owner,'property',r.value,{label:`${r.count} cômodos em ${b.entity.properties.name}`,quantity:r.count,location:b.entity.properties.name,buildingId:b.id,x:b.entity.x,y:b.entity.y});
 }
 for(const plot of city.development.plots)add(plot.ownerId,'land',plot.price,{label:`Terreno #${plot.id} · ${plot.width}×${plot.depth}`,plotId:plot.id,location:`Terreno #${plot.id}`,x:plot.x,y:plot.y});
 for(const project of city.development.projects)inventory(project,project.accountId,project.name||project.id,{projectId:project.id,placeKind:'project',x:project.door.x,y:project.door.y});
 for(const s of city.logistics.shipments)inventory(s,s.seller.accountId,`Frete #${s.id} · ${s.status}`,{shipmentId:s.id,placeKind:'shipment',x:s.position?.x,y:s.position?.y});
 for(const [id,holder]of city.lighting.propertyStores)inventory(holder,holder.accountId,`Abastecimento ${id}`,{placeKind:'lamp',x:holder.door.x,y:holder.door.y});
 for(const c of city.citizens.filter(c=>!c.entity.destroyed)){
  const meta={citizenId:c.id,placeKind:'person',x:c.entity.x,y:c.entity.y};inventory(c.paintBag,c.accountId,`Tinta com ${c.entity.properties.name}`,meta);
  inventory({inventory:c.campaignInventory},c.accountId,`Material de campanha com ${c.entity.properties.name}`,meta);
  inventory({inventory:c.mechanicJob?.parts},city.building(c.mechanicJob?.garageId)?.accountId||c.accountId,`Peças carregadas por ${c.entity.properties.name}`,meta);
  if(c.forestrySeeds)inventory({inventory:{sementes:c.forestrySeeds}},c.accountId,`Sementes com ${c.entity.properties.name}`,meta);
  if(c.forestryJob?.load)inventory({inventory:{madeira:c.forestryJob.load}},city.building(c.forestryJob.buildingId)?.accountId||c.accountId,`Madeira com ${c.entity.properties.name}`,meta);
  for(const g of c.wardrobe||[])if(g.manufacturedAt!=null&&!g.discarded&&g.condition>0)add(c.accountId,'durables',city.economy.goods.roupas.price*g.condition/100,{label:`${g.piece} · ${g.brandName}`,location:c.entity.properties.name,...meta});
  for(const good of ['cesta','carrinho'])if(c.equipment?.[good])add(c.accountId,'durables',city.economy.goods[good].price,{label:city.economy.goods[good].label,location:c.entity.properties.name,...meta});
 }
 for(const j of city.paint.jobs)if(j.materials?.length)inventory({inventory:{tinta:j.materials.reduce((n,l)=>n+l.quantity,0)}},j.payer,`Tinta reservada na pintura #${j.id}`,{buildingId:j.providerId,placeKind:'service'});
 for(const v of city.vehicles.units.values())if(v.active&&!v.scrapped){add(v.ownerAccountId,'vehicles',city.economy.goods[v.good].price*Math.min(1,positive(v.condition)/100),{label:`${city.vehicles.model(v)?.brand||'Veículo'} · #${v.id}`,location:v.status||'Veículo',vehicleId:v.id,x:v.entity?.x,y:v.entity?.y});if(v.mountedFlag)add(v.ownerAccountId,'durables',city.economy.goods.bandeiras.price,{label:`Bandeira no veículo #${v.id}`,vehicleId:v.id,location:'Veículo'});}
 for(const d of city.publications.documents.values())if(!d.lost&&!city.publications.inventoryHolder(d.ownerAccountId))add(d.ownerAccountId,'durables',city.economy.goods[d.good]?.price,{label:d.title||'Publicação',location:city.accountName(d.ownerAccountId),publicationId:d.id});
 const claim=(from,to,amount,label,meta={})=>{amount=positive(amount);if(!amount||from===to)return;ensure(from).debt+=amount;ensure(to).receivables+=amount;claims.push({from,to,amount,label,...meta});};
 for(const l of city.bank.loans)if(!['paid','written-off'].includes(l.status))claim(l.clientId,city.building(l.bankId)?.accountId||`absent-bank:${l.bankId}`,positive(l.remaining)+positive(l.interest),`Empréstimo #${l.id}`,{loanId:l.id});
 for(const b of city.buildings.filter(live)){claim(b.accountId,'treasury',b.businessTaxDue,'Imposto empresarial pendente',{buildingId:b.id});for(const u of b.units)if(u.tenantId)claim(u.rentPayerId||u.tenantId,u.ownerId,u.arrears,'Aluguel atrasado',{buildingId:b.id,unitId:u.id});}
 const categories=['cash','savings','reserved','inventory','property','land','vehicles','durables'];
 for(const row of direct.values()){row.gross=categories.reduce((n,key)=>n+row[key],0);row.net=row.gross+row.receivables-row.debt;}
 const owners=new Map(),control=new Map();
 const owner=id=>{if(!owners.has(id)){const r=ensure(id);owners.set(id,{...r,assets:[],companyEquity:0,companies:[],cash:0,savings:0,reserved:0,inventory:0,property:0,land:0,vehicles:0,durables:0,receivables:0,debt:0,gross:0,net:0});}return owners.get(id);};
 for(const row of [...direct.values()]){
  const b=row.type==='company'?buildings.get(row.id):null;let shares;
  if(b){shares=equityShares(city,b).map(s=>({id:s.accountId,amount:s.points}));}
  else shares=[{id:row.id,amount:1}];
  const total=shares.reduce((n,s)=>n+s.amount,0);control.set(row.id,shares.map(s=>({id:s.id,share:s.amount/total})));
  for(const s of shares){const target=owner(s.id),share=s.amount/total;for(const key of [...categories,'receivables','debt','gross','net'])target[key]+=row[key]*share;if(b){target.companyEquity+=row.net*share;target.companies.push({accountId:row.id,buildingId:b.id,name:row.name,share,value:row.net*share});}else target.assets.push(...row.assets);}
 }
 const places=new Map();for(const asset of assets){const key=asset.buildingId!=null?`building:${asset.buildingId}`:asset.plotId!=null?`plot:${asset.plotId}`:asset.vehicleId!=null?`vehicle:${asset.vehicleId}`:asset.citizenId!=null?`person:${asset.citizenId}`:asset.accountId?`account:${asset.accountId}`:asset.location;
  let p=places.get(key);if(!p){const b=city.building(asset.buildingId);p={id:key,name:b?.entity.properties.name||asset.location||asset.label,value:0,owners:new Set(),kinds:new Set(),assets:[],buildingId:asset.buildingId,plotId:asset.plotId,vehicleId:asset.vehicleId,citizenId:asset.citizenId,x:asset.x??b?.entity.x,y:asset.y??b?.entity.y};places.set(key,p);}p.value+=asset.value;p.owners.add(asset.ownerId);p.kinds.add(asset.kind);p.assets.push(asset.id);
 }
 const living=new Set(city.citizens.filter(c=>!c.entity.destroyed).map(c=>c.accountId)),people=[...owners.values()].filter(r=>r.type==='person'&&living.has(r.id)),totals={money,externalMoney,localMoney:money-externalMoney,realAssets:assets.filter(a=>!['cash','savings','reserved'].includes(a.kind)).reduce((n,a)=>n+a.value,0),gross:[...direct.values()].reduce((n,r)=>n+(r.gross||0),0),receivables:claims.reduce((n,c)=>n+c.amount,0),debt:claims.reduce((n,c)=>n+c.amount,0)};
 return {minute:city.minute,direct,owners,control,assets,locations:[...places.values()].sort((a,b)=>b.value-a.value),stores:locations,goods:[...goods.values()],claims,totals,people:people.sort((a,b)=>b.net-a.net),companies:[...direct.values()].filter(r=>r.type==='company').sort((a,b)=>b.net-a.net),distribution:wealthDistribution(people.map(r=>r.net)),sales:recentMarketSales(city).slice().reverse()};
}
const reportCache=new WeakMap();
export function wealthReport(city,now=performance.now()){const old=reportCache.get(city);if(old&&now-old.at<750&&old.structure===city.structureRevision)return old.report;const report=buildWealthReport(city);reportCache.set(city,{at:now,structure:city.structureRevision,report});return report;}
