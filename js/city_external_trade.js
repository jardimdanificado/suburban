import {INDUSTRIES} from './city_industries.js';
// External customers collect excess ordinary merchandise at the producer.
// The reserve is part of the existing monetary base, so payments are transfers.
export const EXTERNAL_TRADE_RULES=Object.freeze({initialReserveFraction:.02,minimumFirmStock:24,maximumPerSale:12,maximumSalesPerHour:4,priceFactor:1.1,importPriceFactor:2.25,maximumImportQuantity:24});
const FOREIGN_PART_BRANDS=Object.freeze(['Koyo Motion (Japão)','Senda Norte (Chile)','Meridian Works (Suíça)','Rivermark Mobility (Canadá)','Lumen Components (Portugal)','Vento Austral (Argentina)','Orbe Technik (Alemanha)','Tamarind Roadworks (Índia)']);
export const fictionalForeignBrand=good=>FOREIGN_PART_BRANDS[[...good].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261)%FOREIGN_PART_BRANDS.length];
function importGate(city,buyer){
 const {width,height}=city.world,points=[],step=Math.max(1,Math.floor(Math.max(width,height)/32)),target=buyer.door;
 const add=(x,y)=>{x=Math.max(0,Math.min(width-1,x));y=Math.max(0,Math.min(height-1,y));if(city.walkable(x,y)&&!points.some(p=>p.x===x&&p.y===y))points.push({x,y});};
 for(let d=0;d<=32;d++){
  const candidates=[[0,Math.round(target.y)],[width-1,Math.round(target.y)],[Math.round(target.x),0],[Math.round(target.x),height-1]];
  for(const [x,y]of candidates){add(x+(x===0?d:x===width-1?-d:0),y+(y===0?d:y===height-1?-d:0));}
 }
 for(let y=0;y<height;y+=step){add(0,y);add(width-1,y);}for(let x=0;x<width;x+=step){add(x,0);add(x,height-1);}
 points.sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y));
 for(const p of points){const door={x:p.x+.5,y:p.y+.5};if(city.findPath(door,buyer.door)!==null)return door;}return null;
}
export function orderImport(city,buyer,good,quantity){
 const economy=city.economy,goods=economy.goods[good];if(!goods||!buyer?.active||buyer.entity?.destroyed||quantity<1)return false;
 if(!city.accounts.has('external-trade'))city.accounts.set('external-trade',{name:'Comércio exterior',balance:0,totalRevenue:0,totalExpenses:0});
 economy.externalImporters??=new Map();let seller=economy.externalImporters.get(good);
 if(!seller){const door=importGate(city,buyer);if(!door)return false;const brand=fictionalForeignBrand(good),id=`import:${good}`;seller={id,type:'external_import',active:true,externalImport:true,importGood:good,importBrand:brand,accountId:'external-trade',name:brand,entity:{id:null,destroyed:false,properties:{name:brand,render:{style:'external_import'},externalImport:true}},door,inventory:Object.fromEntries(Object.keys(economy.goods).map(key=>[key,0])),incoming:{},inventoryCapacity:10000,balance:0,workers:[],ownerId:null};economy.externalImporters.set(good,seller);}
 if(city.findPath(seller.door,buyer.door)===null){const door=importGate(city,buyer);if(!door)return false;seller.door=door;}
 seller.inventory[good]=(seller.inventory[good]||0)+Math.min(EXTERNAL_TRADE_RULES.maximumImportQuantity,quantity);
 const amount=Math.min(EXTERNAL_TRADE_RULES.maximumImportQuantity,quantity),unitPrice=Math.ceil(goods.price*EXTERNAL_TRADE_RULES.importPriceFactor),policy=city.politics?.policy||{},tax=Math.ceil(goods.price*(policy.importTaxes?.[good]??0))*amount,importer=city.economy.businesses.find(b=>b.type==='import_exporter'&&b.active&&!b.entity.destroyed&&b.id!==buyer.id),brokerId=importer?.accountId||'trade-import-export';if(!city.accounts.has(brokerId))city.accounts.set(brokerId,{name:'Comércio exterior · intermediação',balance:0,totalRevenue:0,totalExpenses:0});const brokerFee=Math.ceil(goods.price*amount*.03),serviceFees=[{amount:tax,accountId:'treasury'},{amount:brokerFee,accountId:brokerId}].filter(f=>f.amount>0),shipment=city.logistics.order(seller,buyer,good,amount,unitPrice,{purpose:'import',serviceFees});
 if(!shipment){seller.inventory[good]-=amount;return false;}
 shipment.imported=true;shipment.importBrand=seller.importBrand;buyer.importedUnitPrice??={};buyer.importedUnitPrice[good]=Math.ceil(unitPrice+(tax+brokerFee+shipment.fee)/amount);economy.externalTrade??={sales:0,units:0,revenue:0};economy.externalTrade.imports=(economy.externalTrade.imports||0)+1;economy.externalTrade.importedUnits=(economy.externalTrade.importedUnits||0)+amount;economy.externalTrade.importTariffs=(economy.externalTrade.importTariffs||0)+tax;
 city.log(`Importação contratada: ${amount} ${goods.label} de ${seller.importBrand}, com frete físico, ágio de ${Math.round((EXTERNAL_TRADE_RULES.importPriceFactor-1)*100)}% e tarifa de ${(100*(policy.importTaxes?.[good]??0)).toFixed(0)}%.`,'transport',[],{kind:'import-ordered',shipmentId:shipment.id,good,quantity:amount,brand:seller.importBrand,amount:amount*unitPrice,importTariff:tax,brokerage:brokerFee});return shipment;
}
const EXPORTABLE=['madeira','tabuas','carvao','minerio','ferro','argila','fibras','tecido','ervas','bauxita','aluminio','aco','resina','borracha','rolamentos','quadro','plataforma','rodas','corrente','selim','pecas'];
export function externalTradeHourly(city){
 const economy=city.economy,externalAccounts=['supplier','external-trade'].filter(id=>(city.accounts.get(id)?.balance||0)>0);if(!externalAccounts.length)return 0;
 const businesses=economy.businesses.filter(b=>b.active&&!b.entity.destroyed),totals=new Map();
 for(const good of EXPORTABLE)totals.set(good,businesses.reduce((sum,b)=>sum+(b.inventory[good]||0),0));
 economy.externalTrade??={sales:0,units:0,revenue:0};let sales=0;
 const exporter=businesses.find(b=>b.type==='import_exporter');
 // The export firm first buys local surpluses through ordinary inter-firm
 // contracts and freight. International sales are made from its own warehouse.
 if(exporter){let purchases=0;for(const good of EXPORTABLE){if(purchases>=EXTERNAL_TRADE_RULES.maximumSalesPerHour)break;const stock=totals.get(good)||0,demand=economy.market?.[good]?.demand||0,reserve=Math.max(EXTERNAL_TRADE_RULES.minimumFirmStock,Math.ceil(demand*1.25));if(stock<=reserve||inventoryFree(exporter)<=0)continue;const seller=businesses.filter(b=>b!==exporter&&b.inventory[good]>0&&(b.type==='farm'&&b.crop===good||b.type==='bakery'&&good==='pao'||b.type==='mill'&&good==='oleo'||Object.hasOwn(INDUSTRIES[b.type]?.outputs||{},good))).sort((a,b)=>b.inventory[good]-a.inventory[good])[0];if(!seller)continue;let quantity=Math.floor(Math.min(stock-reserve,seller.inventory[good],EXTERNAL_TRADE_RULES.maximumPerSale,inventoryFree(exporter),city.logistics.transportLimit(seller,exporter)));while(quantity>0&&!economy.transferGoods(seller,exporter,good,quantity,economy.goods[good].price))quantity--;if(quantity>0)purchases++;}}
 // Rotate the starting business to avoid consistently favoring the first one.
 const offset=Math.floor(city.minute/60)%Math.max(1,businesses.length);
 for(let i=0;i<businesses.length&&sales<EXTERNAL_TRADE_RULES.maximumSalesPerHour;i++){
  const b=exporter||businesses[(i+offset)%businesses.length];if(exporter&&i>0)break;
  for(const good of EXPORTABLE){
   const stock=b.inventory[good]||0,cityStock=totals.get(good)||0,demand=economy.market?.[good]?.demand||0;
   // Keep enough in the firm and city for local customers and production.
   const localReserve=Math.max(EXTERNAL_TRADE_RULES.minimumFirmStock,Math.ceil(demand*1.25));
   const price=Math.max(1,Math.round(economy.goods[good].price*(exporter?1.35:EXTERNAL_TRADE_RULES.priceFactor)));
   const payer=externalAccounts.find(id=>city.accounts.get(id).balance>=price);if(!payer)return sales;
   const quantity=Math.floor(Math.min(stock-EXTERNAL_TRADE_RULES.minimumFirmStock,cityStock-localReserve,EXTERNAL_TRADE_RULES.maximumPerSale,city.accounts.get(payer).balance/price));
   if(quantity<1)continue;
   const gross=quantity*price,tariff=Math.min(gross,Math.ceil(economy.goods[good].price*(city.politics?.policy?.exportTaxes?.[good]??0))*quantity),commission=exporter?.id===b.id?0:Math.min(Math.max(0,gross-tariff),Math.ceil(gross*.03)),brokerId=exporter?.accountId||'trade-import-export';if(commission&&!city.accounts.has(brokerId))city.accounts.set(brokerId,{name:'Comércio exterior · intermediação',balance:0,totalRevenue:0,totalExpenses:0});const amount=gross-tariff-commission;
   if(amount<quantity*economy.goods[good].price||city.accounts.get(payer).balance<gross||!city.transfer(payer,b.accountId,amount,`Exportação: ${economy.goods[good].label}`,{good,quantity,buildingId:b.id})||tariff>0&&!city.transfer(payer,'treasury',tariff,`Tarifa de exportação: ${economy.goods[good].label}`,{good,quantity})||commission>0&&!city.transfer(payer,brokerId,commission,`Comissão de comércio exterior: ${economy.goods[good].label}`,{good,quantity,buildingId:exporter?.id??null}))continue;
   city.vehicles.discardComponents(b,good,quantity);b.inventory[good]-=quantity;economy.consumed[good]+=quantity;totals.set(good,cityStock-quantity);
   economy.recordGoods('export',good,quantity,b.id,null,{gross,exportTariff:tariff,brokerage:commission});economy.externalTrade.sales++;economy.externalTrade.units+=quantity;economy.externalTrade.revenue+=gross;economy.externalTrade.exportTariffs=(economy.externalTrade.exportTariffs||0)+tariff;b.lastSaleAt=city.minute;sales++;break;
  }
 }
 return sales;
}
