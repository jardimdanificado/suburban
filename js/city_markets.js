import { INDUSTRIES, MEAL_COMPONENTS, KITCHEN_RECIPES } from './city_industries.js';
import { inventoryFree } from './city_inventory.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function carryCapacity(c){return c?.equipment?.carrinho?72:c?.equipment?.cesta?36:24;}
export function updateMarket(economy){
  const city=economy.city,people=city.citizens.filter(c=>!c.entity.destroyed),firms=economy.businesses;
  economy.market??={};
  for(const good of Object.keys(economy.goods)){
    const previous=economy.market[good]||{multiplier:1},food=city.workMeals.foodGoods().includes(good),likes=people.reduce((n,c)=>n+Math.max(0,c.foodPreferences?.[good]||0),0);
    const consumer=Object.values(INDUSTRIES).find(spec=>spec.use&&spec.outputs[good]);
    const wants=consumer?people.filter(c=>['livros','panfletos'].includes(good)?!city.publications.owned(c.accountId).some(d=>d.good===good&&d.entries.length<city.publications.capacity(d)):good==='cesta'||good==='carrinho'?carryCapacity(c)<(good==='carrinho'?72:36):c.needs[consumer.use.need]<80).length:0;
    const retail=food?people.length*.3+likes*.8:wants*.35;
    const demand=retail+(good==='oleo'?(economy.lightingSupplyReport?.oilRequired||0):0)+firms.reduce((n,b)=>n+(b.inputDemand?.[good]||0),0)+city.development.projects.filter(p=>!p.cancelled&&p.status!=='completed').reduce((n,p)=>n+(good==='pedra'?Math.max(0,p.stone-(p.inventory.pedra||0)-(p.incoming.pedra||0)):0),0);
    const stock=city.buildings.filter(b=>b.active&&!b.entity.destroyed).reduce((n,b)=>n+(b.inventory[good]||0),0);
    const target=demand>0?clamp((demand+12)/(stock+12),.55,2.5):stock>24?.65:1;
    const multiplier=Math.round(clamp(previous.multiplier+clamp(target-previous.multiplier,-.035,.035),.55,2.5)*1000)/1000;
    economy.market[good]={multiplier,demand,stock,likes,updatedAt:city.minute};
  }
}
export function planSupplyChains(economy){
  const city=economy.city,firms=economy.businesses;
  economy.supplyAgreements=(economy.supplyAgreements||[]).filter(a=>a.until>city.minute&&city.building(a.sellerId)?.active&&city.building(a.buyerId)?.active);
  for(const buyer of firms){for(const good of Object.keys(buyer.inputDemand||{})){
    if(!buyer.inputDemand[good]||economy.supplyAgreements.some(a=>a.buyerId===buyer.id&&a.good===good))continue;
    const sellers=firms.filter(b=>b!==buyer&&((b.type==='farm'&&b.crop===good)||INDUSTRIES[b.type]?.outputs[good]||b.type==='bakery'&&good==='pao'||b.type==='mill'&&good==='oleo'));
    const seller=sellers.sort((a,b)=>(b.inventory[good]||0)-(a.inventory[good]||0)||Math.hypot(a.door.x-buyer.door.x,a.door.y-buyer.door.y)-Math.hypot(b.door.x-buyer.door.x,b.door.y-buyer.door.y))[0];
    if(!seller||!economy.connected(seller,buyer))continue;
    const agreement={id:`supply:${seller.id}:${buyer.id}:${good}:${city.day}`,sellerId:seller.id,buyerId:buyer.id,good,unitPrice:Math.max(1,Math.round(economy.goods[good].price*.95)),signedAt:city.minute,until:city.minute+2*1440,ownerIds:[seller.ownerId,buyer.ownerId].filter(id=>id!=null)};
    economy.supplyAgreements.push(agreement);city.history.record('business','Acordo de fornecimento entre empresas para uma etapa da cadeia produtiva.',[seller.accountId,buyer.accountId],{buildingIds:[seller.id,buyer.id],good,unitPrice:agreement.unitPrice,until:agreement.until});
  }}
  if(economy.supplyAgreements.length>256)economy.supplyAgreements.length=256;
}
export function kitchenWork(economy,b,c){
  const ready=KITCHEN_RECIPES.filter(r=>Object.entries(r.inputs).every(([g,n])=>b.inventory[g]>=n)&&b.inventory[r.good]<48&&inventoryFree(b)>=Math.max(0,r.quantity-Object.values(r.inputs).reduce((n,v)=>n+v,0)));
  const recipe=ready.sort((a,d)=>b.inventory[a.good]-b.inventory[d.good])[0];if(!recipe)return false;
  b.cookingLabor=(b.cookingLabor||0)+1+(c.skills.baking||0)/80;if(b.cookingLabor<recipe.labor)return true;b.cookingLabor-=recipe.labor;
  for(const [good,quantity] of Object.entries(recipe.inputs)){b.inventory[good]-=quantity;economy.consumed[good]+=quantity;economy.recordGoods('recipe-input',good,quantity,b.id,null);}
  b.inventory[recipe.good]+=recipe.quantity;economy.produced[recipe.good]+=recipe.quantity;economy.recordGoods('production',recipe.good,recipe.quantity,null,b.id);
  b.lastRecipe=recipe.good;return true;
}
export function preparedOffer(economy,b,c=null,affordable=false){
  const foods=Object.keys(MEAL_COMPONENTS).filter(g=>(b.inventory[g]||0)>0&&(!affordable||!c||['townhall','popular_refectory'].includes(b.type)||economy.goods[g].price<=(economy.city.accounts.get(economy.city.payerFor(c))?.balance||0)));
  const good=foods.sort((a,d)=>economy.mealTaste(c,{good:d,ingredients:MEAL_COMPONENTS[d].ingredients})-economy.mealTaste(c,{good:a,ingredients:MEAL_COMPONENTS[a].ingredients}))[0];
  if(!good)return null;return {good,quantity:1,inputs:{[good]:1},ingredients:MEAL_COMPONENTS[good].ingredients,quality:MEAL_COMPONENTS[good].quality,price:['townhall','popular_refectory'].includes(b.type)?0:economy.goods[good].price};
}
export function bootstrapEnterprise(economy){
  const city=economy.city;if(economy.lastBootstrapDay===city.day)return false;economy.lastBootstrapDay=city.day;
  const people=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!city.politics.officeHolder(c)&&!c.jobId&&!c.businessIds.length&&!c.startupProjectId&&c.balance>=city.currency.price(500)).sort((a,b)=>b.balance-a.balance);
  if(!people.length)return false;
  const options=economy.demands.filter(d=>d.score>=30&&['market','artisan','kitchen','carrier','cleaner','waste_collector'].includes(d.type)).sort((a,b)=>b.score-a.score);
  for(const option of options){
    const founder=people[0],partners=people.slice(0,6),open=option.type==='market',capital=city.currency.price(2000),cost=capital+city.currency.price(4*4000)+(open?0:8*economy.goods.pedra.price+city.currency.price(4*12000));
    const pooled=partners.reduce((n,c)=>n+Math.max(0,c.balance-city.currency.price(500)),0);let loan=null;if(pooled<cost){const bank=city.bank.available()[0];if(bank)loan=city.bank.lendForBusiness(bank,founder,cost-pooled,{type:option.type,score:option.score,budget:cost});if(!loan)continue;}
    let lot=city.development.plots.find(p=>p.ownerId===founder.accountId&&!p.projectId&&!p.buildingId&&p.width*p.depth===4);
    if(!lot){for(let radius=6;radius<=26&&!lot;radius+=4)for(let i=0;i<12&&!lot;i++){const angle=i*Math.PI/6,x=Math.floor(city.spawn.x+Math.cos(angle)*radius),y=Math.floor(city.spawn.y+Math.sin(angle)*radius);const shapes=[[2,2],[4,1],[1,4]],first=Math.floor(city.random()*shapes.length);for(let shape=0;shape<shapes.length&&!lot;shape++){const [width,depth]=shapes[(first+shape)%shapes.length];const candidate=city.development.createPlot(x,y,width,depth);if(candidate)lot=candidate;}}}
    if(!lot){if(loan)city.bank.cancelBusinessLoan(loan);continue;}
    const contributions=[];let missing=Math.max(0,cost-founder.balance);
    for(const donor of partners.slice(1)){const amount=Math.min(missing,Math.max(0,donor.balance-city.currency.price(500)));if(amount&&city.transfer(donor.accountId,founder.accountId,amount,'Quota de capital de empreendimento conjunto')){contributions.push({citizenId:donor.id,amount});missing-=amount;}}
    if(lot.ownerId==='treasury')lot=city.development.buyPlot(founder.accountId,lot.id);
    const project=lot&&city.development.beginProject(founder.accountId,lot.id,option.type,{width:lot.width,depth:lot.depth,floors:1,kind:open?'open-air':'building',micro:true});
    if(!project){for(const item of contributions)city.transfer(founder.accountId,`citizen:${item.citizenId}`,item.amount,'Devolução de capital: empreendimento não iniciado');if(loan)city.bank.cancelBusinessLoan(loan);continue;}
    const shares=[{citizenId:founder.id,amount:Math.max(1,cost-contributions.reduce((n,a)=>n+a.amount,0))},...contributions];project.equityPartners=shares;const building=city.building(project.buildingId)||city.buildings.find(b=>b.plotId===project.plotId);if(building)building.equityPartners=shares;else founder.startupProjectId=project.id;
    city.log('Moradores sem ocupação reuniram poupança para iniciar um pequeno empreendimento.','business',partners.map(c=>c.id),{kind:'cooperative-startup',projectId:project.id,type:option.type});return true;
  }
  return false;
}
