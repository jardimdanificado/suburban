import {economicPolicy} from './city_economic_policies.js';
import {INDUSTRIES} from './city_industries.js';
import {inventoryFree} from './city_inventory.js';
import {ensureExternalAccount} from './city_currency.js';
// External buyers and suppliers use an unlimited account outside the local money supply.
export const EXTERNAL_TRADE_RULES=Object.freeze({minimumFirmStock:24,maximumPerSale:12,maximumSalesPerHour:4,priceFactor:1.1,importPriceFactor:2.25,maximumImportQuantity:24});
const FOREIGN_PART_BRANDS=Object.freeze(['Koyo Motion','Senda Norte','Meridian Works','Rivermark Mobility','Lumen Components','Vento Austral','Orbe Technik','Tamarind Roadworks']);
export const fictionalForeignBrand=good=>FOREIGN_PART_BRANDS[[...good].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261)%FOREIGN_PART_BRANDS.length];
function importDepotArrival(city,anchor,current=null){
 if(!anchor?.door)return {door:current?{...current}:null,direction:{x:1,y:0}};
 const horizontal=(anchor.rotation||0)%2===0,valid=point=>{
  if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;
  if(Math.hypot(point.x-anchor.door.x,point.y-anchor.door.y)<.75)return false;
  return (!city.walkable||city.walkable(Math.floor(point.x),Math.floor(point.y)))&&(!city.findPath||city.findPath(point,anchor.door)!==null);
 };
 if(valid(current)){
  const dx=current.x-anchor.door.x,dy=current.y-anchor.door.y;
  return {door:{...current},direction:Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)}};
 }
 for(const sign of [1,-1])for(const distance of [1,2,3]){
  const direction=horizontal?{x:sign,y:0}:{x:0,y:sign},door={x:anchor.door.x+direction.x*distance,y:anchor.door.y+direction.y*distance};
  if(valid(door))return {door,direction};
 }
 return {door:{...anchor.door},direction:horizontal?{x:1,y:0}:{x:0,y:1}};
}
export function ensureImportDepot(city){
 const economy=city.economy,anchor=city.buildings.find(b=>b.type==='townhall'&&!b.entity.destroyed)||city.buildings.find(b=>!b.entity.destroyed);
 if(economy.importDepot){const depot=economy.importDepot;depot.inventory??={};for(const good of Object.keys(economy.goods))depot.inventory[good]??=0;depot.incoming??={};depot.claims??={};depot.importedUnitPrice??={};depot.inventoryCapacity=Number.MAX_SAFE_INTEGER;if(anchor){const arrival=importDepotArrival(city,anchor,depot.door);depot.door=arrival.door||{...anchor.door};depot.markerDirection=arrival.direction;}for(const seller of economy.externalImporters?.values?.()||[])seller.door={...depot.door};for(const pending of city.logistics?.shipments||[])if(pending.imported&&pending.buyer===depot&&pending.status==='waiting'&&!pending.pickedUp)pending.position={...depot.door};city.accounts.set(depot.accountId||'import-depot',depot);return depot;}
 if(!anchor)return null;
 const arrival=importDepotArrival(city,anchor);
 const depot={id:'import-depot',type:'import_depot',name:'Depósito de importação municipal',active:true,importDepot:true,entity:{id:null,destroyed:false,properties:{name:'Depósito de importação municipal',externalImportDepot:true}},door:arrival.door||{...anchor.door},markerDirection:arrival.direction,inventory:Object.fromEntries(Object.keys(economy.goods).map(g=>[g,0])),incoming:{},inventoryCapacity:Number.MAX_SAFE_INTEGER,balance:0,totalRevenue:0,totalExpenses:0,workers:[],ownerId:null,accountId:'import-depot',claims:{},importedUnitPrice:{}};
 economy.importDepot=depot;city.accounts.set(depot.accountId,depot);return depot;
}
export function importDepotClaim(depot,buyer,good){return Math.max(0,depot?.claims?.[buyer?.id]?.[good]||0);}
function importGate(city,buyer){
 // International cargo is registered at the municipal depot. The foreign
 // supplier is virtual, so placing its door at the map edge only made imports
 // look like they were arriving in empty terrain before the local delivery.
 return city.findPath(buyer.door,buyer.door)!==null?{...buyer.door}:null;
}
export function orderImport(city,buyer,good,quantity,{reserveBalance=0,purpose='import'}={}){
 if(city.substances&&!city.substances.canTrade(good,null,buyer,{quantity}))return false;
 const economy=city.economy,goods=economy.goods[good];if(!goods||!buyer?.active||buyer.entity?.destroyed||quantity<1)return false;
 const depot=ensureImportDepot(city),reservedAtDepot=Object.values(depot?.claims||{}).reduce((n,row)=>n+(row[good]||0),0);if(!depot||(buyer.importIncoming?.[good]||0)>0||reservedAtDepot>0||(depot.incoming?.[good]||0)>0)return false;
 ensureExternalAccount(city,'external-trade','Comércio exterior');
 economy.externalImporters??=new Map();let seller=economy.externalImporters.get(good);
 if(!seller){const door=importGate(city,depot);if(!door)return false;const brand=fictionalForeignBrand(good),id=`import:${good}`;seller={id,type:'external_import',active:true,externalImport:true,importGood:good,importBrand:brand,accountId:'external-trade',name:brand,entity:{id:null,destroyed:false,properties:{name:brand,render:{style:'external_import'},externalImport:true}},door,inventory:Object.fromEntries(Object.keys(economy.goods).map(key=>[key,0])),incoming:{},inventoryCapacity:10000,balance:0,workers:[],ownerId:null};economy.externalImporters.set(good,seller);}
 else seller.door={...depot.door};
 for(const pending of city.logistics.shipments)if(pending.seller===seller&&pending.buyer===depot&&pending.status==='waiting'&&!pending.pickedUp)pending.position={...depot.door};
 const maximum=purpose==='public-meals'?Math.min(10000,Math.max(1,quantity)):EXTERNAL_TRADE_RULES.maximumImportQuantity;
 seller.inventory[good]=(seller.inventory[good]||0)+Math.min(maximum,quantity);
 const amount=Math.min(maximum,quantity),unitPrice=Math.ceil(goods.price*EXTERNAL_TRADE_RULES.importPriceFactor),policy=city.politics?.policy||{},tax=Math.ceil(goods.price*(policy.importTaxes?.[good]??0))*amount,importer=city.economy.businesses.find(b=>b.type==='import_exporter'&&b.active&&!b.entity.destroyed&&b.id!==buyer.id),brokerId=importer?.accountId||'trade-import-export';if(!city.accounts.has(brokerId))city.accounts.set(brokerId,{name:'Comércio exterior · intermediação',balance:0,totalRevenue:0,totalExpenses:0});const brokerFee=Math.ceil(goods.price*amount*.03),serviceFees=[{amount:tax,accountId:'treasury'},{amount:brokerFee,accountId:brokerId}].filter(f=>f.amount>0),shipment=city.logistics.order(seller,depot,good,amount,unitPrice,{purpose,serviceFees,reserveBalance,payerAccountId:buyer.accountId});
 if(!shipment){seller.inventory[good]-=amount;return false;}
 shipment.imported=true;shipment.importBrand=seller.importBrand;shipment.importClaimBuyerId=buyer.id;buyer.importIncoming??={};buyer.importIncoming[good]=(buyer.importIncoming[good]||0)+amount;const landedPrice=Math.ceil(unitPrice+(tax+brokerFee+shipment.fee)/amount);depot.importedUnitPrice[good]=landedPrice;buyer.importedUnitPrice??={};buyer.importedUnitPrice[good]=landedPrice;economy.externalTrade??={sales:0,units:0,revenue:0};economy.externalTrade.imports=(economy.externalTrade.imports||0)+1;economy.externalTrade.importedUnits=(economy.externalTrade.importedUnits||0)+amount;economy.externalTrade.importedGoods??={};economy.externalTrade.importedGoods[good]=(economy.externalTrade.importedGoods[good]||0)+amount;economy.externalTrade.importTariffs=(economy.externalTrade.importTariffs||0)+tax;
 city.log(`Importação contratada: ${amount} ${goods.label} de ${seller.importBrand}, com frete físico, ágio de ${Math.round((EXTERNAL_TRADE_RULES.importPriceFactor-1)*100)}% e tarifa de ${(100*(policy.importTaxes?.[good]??0)).toFixed(0)}%.`,'transport',[],{kind:'import-ordered',shipmentId:shipment.id,good,quantity:amount,brand:seller.importBrand,amount:amount*unitPrice,importTariff:tax,brokerage:brokerFee});return shipment;
}
const EXPORTABLE=['madeira','tabuas','carvao','minerio','ferro','argila','fibras','tecido','ervas','bauxita','aluminio','aco','resina','borracha','rolamentos','quadro','plataforma','rodas','corrente','selim','pecas'];
export function externalTradeHourly(city){
 const municipalSales=municipalSurplusExportsHourly(city);
 const economy=city.economy;ensureExternalAccount(city,'supplier','Economia externa');ensureExternalAccount(city,'external-trade','Comércio exterior');const externalAccounts=['supplier','external-trade'],diplomacySkill=city.politics?.secretaries?.find(row=>row.officeId==='foreign_relations')?.skill||0,salesLimit=EXTERNAL_TRADE_RULES.maximumSalesPerHour+Math.min(4,Math.floor(diplomacySkill/25));
 const businesses=economy.businesses.filter(b=>b.active&&!b.entity.destroyed),totals=new Map();
 for(const good of EXPORTABLE)totals.set(good,businesses.reduce((sum,b)=>sum+(b.inventory[good]||0),0));
 economy.externalTrade??={sales:0,units:0,revenue:0};let sales=0;
 const exporter=businesses.find(b=>b.type==='import_exporter');
 // The export firm first buys local surpluses through ordinary inter-firm
 // contracts and freight. International sales are made from its own warehouse.
 if(exporter){let purchases=0;for(const good of EXPORTABLE){if(purchases>=salesLimit)break;const stock=totals.get(good)||0,demand=economy.market?.[good]?.demand||0,reserve=Math.max(EXTERNAL_TRADE_RULES.minimumFirmStock,Math.ceil(demand*1.25));if(stock<=reserve||inventoryFree(exporter)<=0)continue;const seller=businesses.filter(b=>b!==exporter&&b.inventory[good]>0&&(b.type==='farm'&&b.crop===good||b.type==='bakery'&&good==='pao'||b.type==='mill'&&good==='oleo'||Object.hasOwn(INDUSTRIES[b.type]?.outputs||{},good))).sort((a,b)=>b.inventory[good]-a.inventory[good])[0];if(!seller)continue;let quantity=Math.floor(Math.min(stock-reserve,seller.inventory[good],EXTERNAL_TRADE_RULES.maximumPerSale,inventoryFree(exporter),city.logistics.transportLimit(seller,exporter)));while(quantity>0&&!economy.transferGoods(seller,exporter,good,quantity,economy.goods[good].price))quantity--;if(quantity>0)purchases++;}}
 // Rotate the starting business to avoid consistently favoring the first one.
 const offset=Math.floor(city.minute/60)%Math.max(1,businesses.length);
 for(let i=0;i<businesses.length&&sales<salesLimit;i++){
  const b=exporter||businesses[(i+offset)%businesses.length];if(exporter&&i>0)break;
  for(const good of EXPORTABLE){
   const stock=b.inventory[good]||0,cityStock=totals.get(good)||0,demand=economy.market?.[good]?.demand||0;
   // Keep enough in the firm and city for local customers and production.
   const localReserve=Math.max(EXTERNAL_TRADE_RULES.minimumFirmStock,Math.ceil(demand*1.25));
   const price=Math.max(1,Math.round(economy.goods[good].price*(exporter?1.35:EXTERNAL_TRADE_RULES.priceFactor)));
   const payer=externalAccounts.find(id=>city.accounts.get(id).balance>=price);if(!payer)return sales+municipalSales;
   const quantity=Math.floor(Math.min(stock-EXTERNAL_TRADE_RULES.minimumFirmStock,cityStock-localReserve,EXTERNAL_TRADE_RULES.maximumPerSale,city.accounts.get(payer).balance/price));
   if(quantity<1)continue;
   const gross=quantity*price,tariff=Math.min(gross,Math.ceil(economy.goods[good].price*(city.politics?.policy?.exportTaxes?.[good]??0))*quantity),commission=exporter?.id===b.id?0:Math.min(Math.max(0,gross-tariff),Math.ceil(gross*.03)),brokerId=exporter?.accountId||'trade-import-export';if(commission&&!city.accounts.has(brokerId))city.accounts.set(brokerId,{name:'Comércio exterior · intermediação',balance:0,totalRevenue:0,totalExpenses:0});const amount=gross-tariff-commission;
   if(amount<quantity*economy.goods[good].price||city.accounts.get(payer).balance<gross||!city.transfer(payer,b.accountId,amount,`Exportação: ${economy.goods[good].label}`,{good,quantity,buildingId:b.id})||tariff>0&&!city.transfer(payer,'treasury',tariff,`Tarifa de exportação: ${economy.goods[good].label}`,{good,quantity})||commission>0&&!city.transfer(payer,brokerId,commission,`Comissão de comércio exterior: ${economy.goods[good].label}`,{good,quantity,buildingId:exporter?.id??null}))continue;
   city.vehicles.discardComponents(b,good,quantity);b.inventory[good]-=quantity;economy.consumed[good]+=quantity;totals.set(good,cityStock-quantity);
   economy.recordGoods('export',good,quantity,b.id,null,{gross,exportTariff:tariff,brokerage:commission});economy.externalTrade.sales++;economy.externalTrade.units+=quantity;economy.externalTrade.revenue+=gross;economy.externalTrade.exportTariffs=(economy.externalTrade.exportTariffs||0)+tariff;b.lastSaleAt=city.minute;sales++;break;
  }
 }
 return sales+municipalSales;
}

/** Municipal exports sell actual uncommitted inventory, never emergency food or contract materials. */
export function municipalSurplusExportsHourly(city){
 if(!economicPolicy(city,'exportMunicipal'))return 0;
 const economy=city.economy,population=city.citizens.filter(c=>!c.entity.destroyed).length,days=economicPolicy(city,'exportReserveDays'),foods=new Set(city.workMeals.foodGoods()),goods=new Set([...EXPORTABLE,'pedra',...foods]),totals=new Map();
 ensureExternalAccount(city,'municipal-export-buyers','Compradores externos de excedentes municipais');
 for(const good of goods)totals.set(good,city.goodsStock(good));
 let sales=0;economy.municipalExports??={revenue:0,remitted:0,units:0};
 const firms=city.buildings.filter(b=>b.active&&!b.entity.destroyed&&(b.accountId==='treasury'||b.municipal)&&!b.officeTenantOf);
 for(const b of firms)for(const good of goods){
  if(sales>=4)return sales;const stock=b.inventory?.[good]||0;if(!stock||b.importedUnitPrice?.[good])continue;
  const demand=economy.market?.[good]?.demand||0,contracts=city.development.projects.filter(p=>!p.cancelled&&p.status!=='completed').reduce((n,p)=>n+Math.max(0,(good==='pedra'?p.stone||0:0)-(p.inventory?.[good]||0)-(p.incoming?.[good]||0)),0),reserve=Math.max(foods.has(good)?population*6*days:24,demand*days,contracts),surplus=Math.max(0,(totals.get(good)||0)-reserve),quantity=Math.floor(Math.min(stock-12,surplus,economicPolicy(city,'exportLotLimit')));
  if(quantity<=0)continue;const amount=Math.max(1,Math.floor(economy.goods[good].price*quantity*1.1));
  if(!city.transfer('municipal-export-buyers',b.accountId,amount,`Exportação: excedente municipal de ${economy.goods[good].label}`,{buildingId:b.id,good,quantity,municipalExport:true}))continue;
  b.inventory[good]-=quantity;totals.set(good,(totals.get(good)||0)-quantity);economy.consumed[good]=(economy.consumed[good]||0)+quantity;economy.recordGoods('export',good,quantity,b.id,null,{municipalExport:true,amount});
  let remitted=b.accountId==='treasury'?amount:0;
  if(b.accountId!=='treasury'&&!(b.equityShares||[]).some(s=>s.accountId!=='treasury')){const transfer=Math.min(Math.floor(amount*economicPolicy(city,'municipalRevenueShare')),Math.max(0,b.balance-city.fiscal.businessReserve(b)));if(transfer&&city.transfer(b.accountId,'treasury',transfer,'Resultado de empresa municipal: exportação de excedentes',{buildingId:b.id,good,quantity})){remitted=transfer;b.fiscalDistributedProfit=(b.fiscalDistributedProfit||0)+transfer;}}
  economy.externalTrade??={sales:0,units:0,revenue:0};economy.externalTrade.sales++;economy.externalTrade.units+=quantity;economy.externalTrade.revenue+=amount;economy.municipalExports.revenue+=amount;economy.municipalExports.remitted+=remitted;economy.municipalExports.units+=quantity;sales++;
  city.log(`Excedente municipal exportado: ${quantity} ${economy.goods[good].label}; reserva local e materiais de obras preservados.`,'economy',[],{kind:'municipal-surplus-export',buildingId:b.id,good,quantity,amount,remitted});
 }
 return sales;
}
