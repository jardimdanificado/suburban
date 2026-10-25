/** Durable garments keep their manufacturer through wholesale transport. */
export const GARMENT_TYPES=['camisa','calça','vestido','casaco','saia','macacão'];
export const CLOTHING_STYLES=['simples','social','esportivo','colorido','clássico'];
export const clothingPreference=(id,key)=>((Math.imul(id+71,[...String(key)].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))|0,17))>>>0)%201-100)/100;
export function brandPreference(c,id){if(!c||id==null)return 0;c.brandPreferences??={};return c.brandPreferences[id]??=clothingPreference(c.id,`marca:${id}`);}
export function companyPreference(c,b){return b?brandPreference(c,b.id)*2:0;}
export function garmentScore(c,g){return g.condition*.65+g.quality*.2+clothingPreference(c.id,g.piece)*10+clothingPreference(c.id,g.style)*8+brandPreference(c,g.brandId)*7;}
export function initializeClothes(city,c){
  if(c.wardrobe)return;
  c.wardrobe=[{piece:'camisa',style:CLOTHING_STYLES[c.id%5],brandId:null,brandName:'Roupa de chegada',quality:45,condition:65,acquiredAt:city.minute}];
  c.clothingUpdatedAt=city.minute;
}
export function appearance(c){const g=c.wardrobe?.[c.wearingIndex||0];return g?Math.max(0,Math.min(100,garmentScore(c,g))):40;}
export function clothingMood(c){return (appearance(c)-50)/12;}
export function manufactureClothes(city,b,n){b.garments??=[];for(let i=0;i<n;i++){const serial=b.garmentSerial=(b.garmentSerial||0)+1;b.garments.push({piece:GARMENT_TYPES[(b.id+serial)%6],style:CLOTHING_STYLES[(b.id*3+serial)%5],brandId:b.id,brandName:b.entity.properties.name,quality:Math.min(100,40+(b.productionQuality||0)+Math.min(40,(b.workers||[]).length*5)),condition:100,manufacturedAt:city.minute});}}
export function clothingOffer(city,c,b){
  initializeClothes(city,c);
  // Annotate legacy stock without adding any physical clothes.
  if((b.garments?.length||0)<(b.inventory.roupas||0))manufactureClothes(city,b,b.inventory.roupas-(b.garments?.length||0));
  const price=Math.ceil(city.economy.goods.roupas.price*(b.type==='clothing_store'?1.2:1));
  if(!b.inventory.roupas||c.balance<price+city.currency.price(2500)||city.minute-(c.lastClothingPurchaseAt??-Infinity)<1440)return null;
  const garments=b.garments||[],best=garments.map((g,i)=>({g,i,score:garmentScore(c,g)})).sort((a,b)=>b.score-a.score)[0];
  if(!best)return null;
  if(appearance(c)>55&&(c.wardrobe.length>=4||best.score<appearance(c)+12))return null;
  return {good:'roupas',price,garmentIndex:best.i,spec:{use:{need:'leisure',boost:0}}};
}
export function buyClothes(city,c,b,index){const g=b.garments.splice(index,1)[0];if(!g)return false;c.wardrobe.push({...g,acquiredAt:city.minute,sellerId:b.id});c.lastClothingPurchaseAt=city.minute;selectClothes(c);return true;}
function selectClothes(c){c.wearingIndex=c.wardrobe.reduce((best,g,i)=>garmentScore(c,g)>garmentScore(c,c.wardrobe[best])?i:best,0);}
export function updateClothes(city){for(const c of city.citizens){if(c.entity.destroyed||c.id%24!==city.hour)continue;initializeClothes(city,c);const days=Math.max(0,city.minute-c.clothingUpdatedAt)/1440;c.clothingUpdatedAt=city.minute;const g=c.wardrobe[c.wearingIndex||0];if(g)g.condition=Math.max(0,g.condition-days*(c.jobId?2.4:1.4)*(1.5-g.quality/150));for(const item of c.wardrobe)if(item.condition<=0&&item.manufacturedAt!=null&&!item.discarded){city.economy.consumed.roupas++;item.discarded=true;city.economy.recordGoods('clothing-worn-out','roupas',1,c.id,null);}
  c.wardrobe=c.wardrobe.filter(g=>g.condition>0);if(!c.wardrobe.length)c.wardrobe.push({piece:'trapos',style:'simples',brandId:null,brandName:'Sem marca',condition:0,quality:0});selectClothes(c);if(c.wardrobe.length>8){c.wardrobe.sort((a,b)=>garmentScore(c,b)-garmentScore(c,a));for(const item of c.wardrobe.splice(8))if(item.manufacturedAt!=null)city.economy.consumed.roupas++;}selectClothes(c);}}
export function moveGarments(from,to,n){from.garments??=[];to.garments??=[];to.garments.push(...from.garments.splice(0,n));}
