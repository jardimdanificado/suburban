// External customers collect excess ordinary merchandise at the producer.
// The reserve is part of the existing monetary base, so payments are transfers.
export const EXTERNAL_TRADE_RULES=Object.freeze({initialReserveFraction:.02,minimumFirmStock:24,maximumPerSale:12,maximumSalesPerHour:4,priceFactor:1.1});
const EXPORTABLE=['madeira','tabuas','carvao','minerio','ferro','argila','fibras','tecido','ervas','bauxita','aluminio','aco','resina','borracha','rolamentos','quadro','plataforma','rodas','corrente','selim','pecas'];
export function externalTradeHourly(city){
 const economy=city.economy,externalAccounts=['supplier','external-trade'].filter(id=>(city.accounts.get(id)?.balance||0)>0);if(!externalAccounts.length)return 0;
 const businesses=economy.businesses.filter(b=>b.active&&!b.entity.destroyed),totals=new Map();
 for(const good of EXPORTABLE)totals.set(good,businesses.reduce((sum,b)=>sum+(b.inventory[good]||0),0));
 economy.externalTrade??={sales:0,units:0,revenue:0};let sales=0;
 // Rotate the starting business to avoid consistently favoring the first one.
 const offset=Math.floor(city.minute/60)%Math.max(1,businesses.length);
 for(let i=0;i<businesses.length&&sales<EXTERNAL_TRADE_RULES.maximumSalesPerHour;i++){
  const b=businesses[(i+offset)%businesses.length];
  for(const good of EXPORTABLE){
   const stock=b.inventory[good]||0,cityStock=totals.get(good)||0,demand=economy.market?.[good]?.demand||0;
   // Keep enough in the firm and city for local customers and production.
   const localReserve=Math.max(EXTERNAL_TRADE_RULES.minimumFirmStock,Math.ceil(demand*1.25));
   const price=Math.max(1,Math.round(economy.goods[good].price*EXTERNAL_TRADE_RULES.priceFactor));
   const payer=externalAccounts.find(id=>city.accounts.get(id).balance>=price);if(!payer)return sales;
   const quantity=Math.floor(Math.min(stock-EXTERNAL_TRADE_RULES.minimumFirmStock,cityStock-localReserve,EXTERNAL_TRADE_RULES.maximumPerSale,city.accounts.get(payer).balance/price));
   if(quantity<1)continue;
   const amount=quantity*price;
   if(!city.transfer(payer,b.accountId,amount,`Exportação: ${economy.goods[good].label}`,{good,quantity,buildingId:b.id}))continue;
   city.vehicles.discardComponents(b,good,quantity);b.inventory[good]-=quantity;economy.consumed[good]+=quantity;totals.set(good,cityStock-quantity);
   economy.recordGoods('export',good,quantity,b.id,null);economy.externalTrade.sales++;economy.externalTrade.units+=quantity;economy.externalTrade.revenue+=amount;b.lastSaleAt=city.minute;sales++;break;
  }
 }
 return sales;
}
