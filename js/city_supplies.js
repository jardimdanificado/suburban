export const POCKET_RULES=Object.freeze({foodCapacity:4,waterCapacity:6,foodLow:1,waterLow:1,eatAt:60,drinkAt:65});
export function pocket(c){return c.pocket??={food:[],water:0,waterContamination:0,waterSource:null,receivedMeals:0,receivedWater:0};}
export class CitySupplies{
 constructor(city){this.city=city;this.basketsDistributed=0;this.mealsDistributed=0;this.waterDistributed=0;}
 useCarried(c){const p=pocket(c),city=this.city,n=c.needs;
  if(n.water<POCKET_RULES.drinkAt&&p.water>0){p.water--;n.water=Math.min(100,n.water+40);const risk=p.waterContamination||0;if(risk>0){n.health=Math.max(0,n.health-risk*.12);c.mood=Math.max(-25,(c.mood||0)-risk*.025);}c.lastDrink={minute:city.minute,source:p.waterSource,contamination:risk};c.action='Bebendo água da garrafa';}
  if(n.food>=POCKET_RULES.eatAt)return;
  const meal=p.food.shift();if(meal){const dining=c.indoorLocation?.roomType==='dining',quality=meal.quality+(dining?.5:0);for(const [g,q]of Object.entries(meal.inputs))city.economy.consumed[g]+=q;city.economy.enjoyMeal(c,meal);n.food=Math.min(100,n.food+30+quality*4);c.lastMealQuality=quality;c.lastPocketMealAt=city.minute;c.action=dining?'Comendo sua refeição no refeitório':'Comendo a comida que carregava';if(dining)c.mood=Math.min(25,(c.mood||0)+2);}
  else if(c.provisions>0){c.provisions--;n.food=Math.min(100,n.food+34);c.action='Comendo uma provisão que carregava';}
 }
 low(c){const p=pocket(c);return {food:p.food.length+(c.provisions||0)<=POCKET_RULES.foodLow,water:p.water<=POCKET_RULES.waterLow};}
 route(c){const city=this.city,p=pocket(c),low=this.low(c);if(!low.food&&!low.water||!city.society.isAdult(c)||city.minute<(p.retryAt||0))return false;
  const urgent=city.urgentNeed(c);if(urgent&&!['food','water'].includes(urgent)||!urgent&&(city.hour<6||city.hour>=22))return false;
  if(c.deliveryId||c.cleaningJobId||c.informalJobId||c.mobilityTrip||c.ridingVehicleId||c.workMeal)return false;
  const needWater=low.water,needFood=low.food;
  const options=[];for(const b of city.buildings){if(!b.active||b.entity.destroyed)continue;const water=needWater&&['townhall','utility','popular_refectory'].includes(b.type),meal=needFood&&city.economy.mealOffer(b,c);if(!water&&!meal)continue;const price=water&&b.type==='utility'?city.currency.price(35):0;if(price>(city.accounts.get(city.payerFor(c))?.balance||0))continue;const dist=Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y),score=dist+(needWater&&!water?30:0)+(needFood&&!meal?25:0)+(meal?meal.price/Math.max(1,city.currency.price(100))*.3-city.economy.mealTaste(c,meal)*5:0);options.push({b,score});}
  options.sort((a,b)=>a.score-b.score);for(const {b}of options){const path=city.findPath(c.entity,b.door);if(path===null)continue;c.task='supplies';c.targetId=b.id;c.path=path;c.action='Repondo comida de bolso e água antes de acabarem';p.retryAt=city.minute+30;return true;}
  p.retryAt=city.minute+30;if(needWater&&c.needs.water<45)return this.routeLake(c);return false;
 }
 routeLake(c){const shore=this.city.water.nearestShore(c);if(!shore)return false;c.lakeCollection={bodyId:shore.bodyId,point:shore.point};c.task='lake-water';c.targetId=null;c.path=shore.path;c.action='Buscando água de lago como último recurso';return true;}
 arrive(c){const city=this.city,b=city.building(c.targetId),p=pocket(c);if(!b?.active){c.task=null;return;}
  let meals=0;while(p.food.length+(c.provisions||0)<POCKET_RULES.foodCapacity){const offer=city.economy.mealOffer(b,c);if(!offer||!city.transfer(city.payerFor(c),b.accountId,offer.price,'Alimento para levar',{good:offer.good,quantity:offer.quantity||1}))break;
   for(const [g,q]of Object.entries(offer.inputs))b.inventory[g]-=q;
   p.food.push({good:offer.good,inputs:{...offer.inputs},quality:offer.quality||1,ingredients:offer.ingredients?{...offer.ingredients}:null,sourceId:b.id,packedAt:city.minute});meals++;b.lastSaleAt=city.minute;
   city.history.record('sale',`${c.entity.properties.name} comprou ou retirou comida para levar.`,[c.accountId,b.accountId],{amount:offer.price,good:offer.good,quantity:offer.quantity||1,packedMeal:true});
  }
  let water=0;if(['townhall','utility','popular_refectory'].includes(b.type)){water=POCKET_RULES.waterCapacity-p.water;const fee=b.type==='utility'?city.currency.price(35)*water:0;if(water>0&&city.transfer(city.payerFor(c),b.accountId,fee,'Enchimento de garrafas de água')){p.water=POCKET_RULES.waterCapacity;p.waterContamination=0;p.waterSource=b.entity.properties.name;p.receivedWater+=water;}else water=0;}
  if(b.type==='popular_refectory'&&(meals||water)){this.basketsDistributed++;this.mealsDistributed+=meals;this.waterDistributed+=water;p.receivedMeals+=meals;p.lastBasketAt=city.minute;city.history.record('service',`Cesta básica retirada por ${c.entity.properties.name}: ${meals} refeições e ${water} porções de água.`,[c.accountId,b.accountId,'treasury'],{citizenIds:[c.id],buildingId:b.id,meals,water,kind:'basic-basket'});}
  c.task=null;c.targetId=null;c.path=[];p.retryAt=city.minute+(meals||water?30:10);c.action=meals||water?'Reservas de comida e água repostas':'Estoque indisponível; buscando outro fornecedor';this.useCarried(c);
 }
 collectLake(c){const city=this.city,p=pocket(c),site=c.lakeCollection;if(!site||c.path.length)return;if(Math.hypot(c.entity.x-site.point.x,c.entity.y-site.point.y)>.7){c.task=null;return;}
  const water=POCKET_RULES.waterCapacity-p.water,risk=city.water.contamination(site.bodyId,site.point);p.water=POCKET_RULES.waterCapacity;p.waterContamination=risk;p.waterSource='Lago sem tratamento';city.water.draw(site.bodyId,water);c.task=null;c.lakeCollection=null;c.action='Coletou água não tratada do lago';city.history.record('service',`${c.entity.properties.name} coletou água de lago com ${risk.toFixed(1)}% de contaminação.`,[c.accountId],{kind:'lake-water',water,contamination:risk});this.useCarried(c);
 }
 carriedGoods(good){let n=0;for(const c of this.city.citizens)if(!c.entity.destroyed)for(const meal of c.pocket?.food||[])n+=meal.inputs[good]||0;return n;}
}
