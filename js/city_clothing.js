import {COLOR_PALETTE,colorAffinity,dislikesColor,favoriteColors} from './city_colors.js';
import {companyUniform,manufactureCompanyUniform} from './city_company_uniforms.js';
import {symbolAffinity} from './city_symbols.js';
import {makeClothingPattern} from './city_party_flags.js';
/** Durable garments keep their manufacturer through wholesale transport. */
export const GARMENT_TYPES=['camisa','camisa social','camisa estampada','camiseta','regata','terno','vestido','vestido estampado','casaco','saia','saia longa','macacão','calça','calça social','shorts','bermuda','sunga','biquíni','maiô','luvas','sapatos','botas','boné','cartola','chapéu','chapéu nordestino','chapéu de cangaceiro','chapéu de couro','chapéu de vaqueiro','chapéu de palha pequeno','chapéu de palha médio','chapéu de palha grande'];
export const HEADWEAR_TYPES=new Set(['boné','cartola','chapéu','chapéu nordestino','chapéu de cangaceiro','chapéu de couro','chapéu de vaqueiro','chapéu de palha pequeno','chapéu de palha médio','chapéu de palha grande']);
export const FOOTWEAR_TYPES=new Set(['sapatos','botas']);
export const HANDWEAR_TYPES=new Set(['luvas']);
export const LOWER_BODY_TYPES=new Set(['calça','calça social','shorts','bermuda','saia','saia longa','sunga']);
const ONE_PIECE_TYPES=new Set(['vestido','vestido estampado','macacão','terno','maiô']);
export const CLOTHING_STYLES=['simples','social','esportivo','colorido','clássico','estampado','listrado','floral','sertanejo','festa'];
export const TROPICAL_PRINTS=Object.freeze(['hibisco','palmeiras','folhagem','frutas-tropicais','ondas-caribenhas','flores-miudas']);
export const tropicalPrintFor=(id,seed=0)=>TROPICAL_PRINTS[((Math.imul((Number(id)||0)+1,2654435761)^(Number(seed)||0))>>>0)%TROPICAL_PRINTS.length];
export function seededClothingPattern(id,seed=0,options={}){
  let state=((Math.imul((Number(id)||0)+17,2654435761)^(Number(seed)||0))>>>0)||1;
  const rng={random:()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;}};
  const flag=makeClothingPattern(rng,options);
  return {patternId:`seed-${seed}-${id}`,flag,symbols:flag.emblems.map(e=>e.skin),colors:[...flag.colors],background:flag.background};
}
export function applyPatternToGarment(g,pattern){
  if(!g||!pattern?.flag)return g;
  g.patternFlag=pattern.flag;
  g.patternId=pattern.patternId;
  g.color=pattern.background||pattern.flag.background||g.color;
  g.patternColors=pattern.colors||[...(pattern.flag.colors||[])];
  g.patternSymbols=pattern.symbols||pattern.flag.emblems?.map(e=>e.skin)||[];
  g.style='estampado';
  return g;
}
export function craftClothingPattern(city,b,options={}){
  if(!b)return null;
  b.clothingPatterns??=[];
  const seq=b.clothingPatternSerial=(b.clothingPatternSerial||0)+1;
  const flag=makeClothingPattern(city,options);
  const pattern={
    patternId:`pattern-${b.id}-${seq}`,
    flag,
    symbols:flag.emblems.map(e=>e.skin),
    colors:[...(flag.colors||[flag.background,flag.foreground])],
    background:flag.background,
    createdAt:city?.minute??0,
    creatorBuildingId:b.id,
    creatorName:b.entity?.properties?.name||'Confecção'
  };
  b.clothingPatterns.push(pattern);
  if(b.clothingPatterns.length>24)b.clothingPatterns.splice(0,b.clothingPatterns.length-24);
  if(options.applyToStock&&b.garments?.length){
    const eligible=b.garments.filter(g=>g.reservedPartyId==null&&g.uniformCompanyId==null&&!HEADWEAR_TYPES.has(g.piece)&&!FOOTWEAR_TYPES.has(g.piece)&&!HANDWEAR_TYPES.has(g.piece)&&!LOWER_BODY_TYPES.has(g.piece));
    const target=(Number.isInteger(options.garmentIndex)?b.garments[options.garmentIndex]:null)||eligible.find(g=>!g.patternFlag)||eligible[0];
    if(target){
      target.piece=target.piece==='vestido'||target.piece==='vestido estampado'?'vestido estampado':'camisa estampada';
      applyPatternToGarment(target,pattern);
    }
  }
  return pattern;
}
export function createClothingLine(city,b,options={}){
  if(!b)return null;
  b.clothingLines??=[];
  const seq=b.clothingLineSerial=(b.clothingLineSerial||0)+1;
  const rng=typeof city?.random==='function'?city:{random:Math.random};
  const defaultPieces=['camisa estampada','vestido estampado','camisa','camiseta','vestido','calça','saia','casaco','camisa social','shorts'];
  const patternedPieces=['camisa estampada','vestido estampado'];
  const piece=options.piece&&GARMENT_TYPES.includes(options.piece)?options.piece:(seq%2===1?patternedPieces[(b.id+seq)%patternedPieces.length]:defaultPieces[(b.id+seq*3+Math.floor(rng.random()*defaultPieces.length))%defaultPieces.length]);
  const patterned=['camisa estampada','vestido estampado'].includes(piece);
  const pattern=patterned?craftClothingPattern(city,b,options):null;
  const color=pattern?.background||options.color||COLOR_PALETTE[(b.id+seq*7+Math.floor(rng.random()*COLOR_PALETTE.length))%COLOR_PALETTE.length].hex;
  const style=patterned?'estampado':piece.includes('social')||piece==='terno'?'social':CLOTHING_STYLES[(b.id*3+seq)%5];
  const editionSize=Number.isInteger(options.editionSize)&&options.editionSize>0?options.editionSize:6+((b.id+seq*3)%10);
  const line={
    lineId:`line-${b.id}-${seq}`,
    name:options.name||`Linha #${seq} · ${piece}`,
    piece,
    style,
    color,
    pattern,
    editionSize,
    produced:0,
    createdAt:city?.minute??0,
    creatorBuildingId:b.id,
    creatorName:b.entity?.properties?.name||'Confecção'
  };
  b.clothingLines.push(line);
  if(b.clothingLines.length>24)b.clothingLines.splice(0,b.clothingLines.length-24);
  return line;
}
const preferenceSeeds=new Map();
export const clothingPreference=(id,key)=>{let seed=preferenceSeeds.get(key);if(seed===undefined){seed=[...String(key)].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))|0,17);preferenceSeeds.set(key,seed);}return ((Math.imul(id+71,seed)>>>0)%201-100)/100;};
export function brandPreference(c,id){if(!c||id==null)return 0;c.brandPreferences??={};return c.brandPreferences[id]??=clothingPreference(c.id,`marca:${id}`);}
export function companyPreference(c,b){return b?brandPreference(c,b.id)*2:0;}
function patternColorBonus(c,g,partyIssue){
  const colors=g?.patternColors||g?.patternFlag?.colors;
  if(!colors?.length)return 0;
  const accents=colors.slice(1).filter(Boolean);
  if(!accents.length)return 0;
  let sum=0,penalty=0;
  for(const hex of accents){
    const aff=colorAffinity(c,hex);
    sum+=aff;
    if(aff<=-.65&&!partyIssue)penalty-=25;
  }
  return (sum/accents.length)*8+penalty;
}
function patternSymbolBonus(c,g){
  const raw=g?.patternSymbols||g?.patternFlag?.emblems?.map(e=>e.skin)||g?.artPrint?.partyFlag?.emblems?.map(e=>e.skin)||g?.artPrint?.companyLogo?.emblems?.map(e=>e.skin);
  if(!raw?.length)return 0;
  const unique=[...new Set(raw.filter(Boolean))];
  if(!unique.length)return 0;
  const scores=unique.map(skin=>symbolAffinity(c,skin));
  const best=Math.max(...scores),avg=scores.reduce((a,b)=>a+b,0)/scores.length;
  return best*18+avg*8;
}
export function garmentScore(c,g){const affinity=colorAffinity(c,g.color),patterned=['camisa estampada','vestido estampado'].includes(g.piece),partyIssue=g.partyOwnerId!=null&&g.partyOwnerId===c.political?.partyId,exempt=partyIssue||!!g.municipalKit;return g.condition*.55+(100-(g.dirt||0))*.3+g.quality*.15+clothingPreference(c.id,g.piece)*10+clothingPreference(c.id,g.style)*8+brandPreference(c,g.brandId)*7+affinity*12+patternColorBonus(c,g,exempt)+patternSymbolBonus(c,g)+(patterned?40:0)+(partyIssue?32:0)+(affinity<=-.65&&!exempt?-120:0);}
export function wornGarment(c){return companyUniform(c)||(c?.wearingIndex===-1?null:c?.wardrobe?.[Number.isInteger(c?.wearingIndex)?c.wearingIndex:0]);}
export function wornHeadwear(c){return Number.isInteger(c?.headwearIndex)&&c.headwearIndex>=0?c.wardrobe?.[c.headwearIndex]:null;}
export function wornFootwear(c){return Number.isInteger(c?.footwearIndex)&&c.footwearIndex>=0?c.wardrobe?.[c.footwearIndex]:null;}
export function wornLowerGarment(c){if(companyUniform(c))return null;return Number.isInteger(c?.lowerWearIndex)&&c.lowerWearIndex>=0?c.wardrobe?.[c.lowerWearIndex]:null;}
export function wornHandwear(c){return Number.isInteger(c?.handwearIndex)&&c.handwearIndex>=0?c.wardrobe?.[c.handwearIndex]:null;}
function identifyGarment(city,g){g.garmentId??=`garment-${city.nextGarmentId=(city.nextGarmentId||0)+1}`;g.ownerHistory??=[];return g;}
function changeOwner(city,g,ownerId,ownerName,event){identifyGarment(city,g);const previous=g.ownerHistory.at(-1);if(previous?.ownerId===ownerId)return;g.storedAtFurnitureId=null;g.storedInBuildingId=null;g.ownerHistory.push({ownerId,ownerName,minute:city.minute,event});g.ownerHistory=g.ownerHistory.slice(-16);}
function municipalKitColors(city){
  const flag=city?.municipalIdentity?.flag||city?.politics?.ensureMunicipalIdentity?.()?.flag;
  return {
    top:flag?.background||'#4c655c',
    bottom:flag?.colors?.[1]||flag?.foreground||'#344e79',
    shoes:flag?.colors?.[2]||'#34383e'
  };
}
export function initializeClothes(city,c){
  const kit=municipalKitColors(city);
  if(!c.wardrobe){
    c.wardrobe=[{piece:'camisa',style:'simples',color:kit.top,brandId:null,brandName:'Prefeitura · Kit municipal',quality:35,condition:75,dirt:0,acquiredAt:city.minute,municipalKit:true}];
    changeOwner(city,c.wardrobe[0],c.accountId,c.entity.properties.name,'kit municipal inicial');
    c.clothingUpdatedAt=city.minute;
  }
  if(!c.initialOutfitCompleted){
    c.initialOutfitCompleted=true;
    const add=(piece,color)=>{const g={piece,style:'simples',color,brandId:null,brandName:'Prefeitura · Kit municipal',quality:35,condition:75,dirt:0,acquiredAt:city.minute,municipalKit:true};changeOwner(city,g,c.accountId,c.entity.properties.name,'kit municipal inicial');c.wardrobe.push(g);};
    if(!c.wardrobe.some(g=>LOWER_BODY_TYPES.has(g.piece))&&!c.wardrobe.some(g=>['vestido','vestido estampado','macacão','terno'].includes(g.piece)))add('calça',kit.bottom);
    if(!c.wardrobe.some(g=>FOOTWEAR_TYPES.has(g.piece)))add('sapatos',kit.shoes);
  }
  if((c.visualWardrobePatternVersion??0)<4){
    c.visualWardrobePatternVersion=4;
    let idx=0;
    for(const g of c.wardrobe)if(['camisa estampada','vestido estampado'].includes(g.piece)&&!g.patternFlag&&!g.artPrint)applyPatternToGarment(g,seededClothingPattern(c.id*31+(idx++),city.initialSeed));
  }
  selectClothes(c);
}
const appearanceCache=new WeakMap();
// clothingMood runs on the per-minute happiness pass for every active
// citizen, but the worn garment only changes on the daily wardrobe update
// (updateClothes, c.id%24===city.hour). The fast path therefore reuses the
// derived mood when every input of garmentScore/appearance is unchanged:
// garment identity, piece/style/color/brand/condition/dirt/quality, the
// frozen color-preferences object, the resolved brand preference and the
// party-issue inputs (g.partyOwnerId vs c.political.partyId).
const moodCache=new WeakMap();
export function appearance(c){
  const g=wornGarment(c);if(!g)return 30;
  const old=appearanceCache.get(c),brand=g.brandId==null?0:c.brandPreferences?.[g.brandId];
  if(old&&old.g===g&&old.id===c.id&&old.colors===c.colorPreferences&&Object.isFrozen(c.colorPreferences)&&old.brand===brand&&old.condition===g.condition&&old.dirt===g.dirt&&old.quality===g.quality&&old.piece===g.piece&&old.style===g.style&&old.color===g.color&&old.brandId===g.brandId)return old.score;
  const score=Math.max(0,Math.min(100,garmentScore(c,g)));
  if(Object.isFrozen(c.colorPreferences))appearanceCache.set(c,{g,id:c.id,colors:c.colorPreferences,brand:g.brandId==null?0:c.brandPreferences?.[g.brandId],condition:g.condition,dirt:g.dirt,quality:g.quality,piece:g.piece,style:g.style,color:g.color,brandId:g.brandId,score});
  return score;
}
export const clothingOdor=c=>Math.max(0,Math.min(100,(wornGarment(c)?.dirt||0)-20));
export function clothingMood(c){
  const g=wornGarment(c);
  const cached=moodCache.get(c);
  if(cached&&cached.g===g&&cached.dirt===(g?.dirt||0)&&cached.brand===(g?.brandId==null?0:c.brandPreferences?.[g?.brandId])&&cached.colors===c.colorPreferences&&Object.isFrozen(c.colorPreferences)&&cached.partyOwner===g?.partyOwnerId&&cached.party===c.political?.partyId){
    // The score also reads condition/quality/piece/style/color through the
    // garment identity: identity change invalidates the brand/piece/state
    // guard above even when dirt is identical.
    if(cached.piece===g?.piece&&cached.quality===g?.quality&&cached.condition===g?.condition)return cached.mood;
  }
  const mood=(appearance(c)-50)/12-clothingOdor(c)*.035;
  moodCache.set(c,{g,dirt:g?.dirt||0,piece:g?.piece,quality:g?.quality,condition:g?.condition,brand:g?.brandId==null?0:c.brandPreferences?.[g?.brandId],colors:c.colorPreferences,partyOwner:g?.partyOwnerId,party:c.political?.partyId,mood});
  return mood;
}
export function manufactureClothes(city,b,n){
  b.garments??=[];
  for(let i=0;i<n;i++){
    const serial=b.garmentSerial=(b.garmentSerial||0)+1,orders=[...(b.partyCapOrders||[]).map(source=>({source,...source})),...(b.partyShirtOrders||[]).map(source=>({source,...source}))],order=b.type==='tailor'&&orders.find(o=>o.remaining>0&&city.politics.party(o.partyId)?.active),party=order&&city.politics.party(order.partyId);
    let line=null;
    if(!party){
      line=(b.clothingLines||[]).find(l=>l.produced<l.editionSize)||createClothingLine(city,b);
    }
    const piece=party?(order.piece||'boné'):line.piece;
    const patterned=!party&&['camisa estampada','vestido estampado'].includes(piece);
    const g={piece,style:party?(piece==='camisa estampada'?'estampado':CLOTHING_STYLES[(b.id*3+serial)%5]):line.style,color:party?party.flag.background:line.color,brandId:b.id,brandName:b.entity.properties.name,quality:Math.min(100,40+(b.productionQuality||0)+Math.min(40,(b.workers||[]).length*5)),condition:100,dirt:0,manufacturedAt:city.minute,...(!party?{lineId:line.lineId,lineName:line.name,editionNumber:line.produced+1,editionSize:line.editionSize}:{}),...(party?{reservedPartyId:party.id,partyNumber:party.number,partyFlag:party.flag,...(piece==='camisa estampada'?{artPrint:{artId:`tailor-${b.id}-${serial}`,cacheKey:`party-${party.id}-${party.number}`,kind:'flags',partyNumber:party.number,partyFlag:party.flag,message:party.short,color:party.flag.foreground}}:{})}: {})};
    if(!party){
      if(patterned&&line.pattern)applyPatternToGarment(g,line.pattern);
      line.produced++;
    }
    if(order)order.source.remaining--;
    if(!party)manufactureCompanyUniform(city,b,g);
    identifyGarment(city,g);changeOwner(city,g,b.accountId,b.entity.properties.name,party?'encomenda partidária':'produção');b.garments.push(g);
  }
}
export function clothingOffer(city,c,b){
  initializeClothes(city,c);
  // Annotate legacy stock without adding any physical clothes.
  if((b.garments?.length||0)<(b.inventory.roupas||0))manufactureClothes(city,b,b.inventory.roupas-(b.garments?.length||0));
  if(b.type==='clothing_store'&&(!b.clothingPatterns?.length||(b.garments||[]).some(g=>['camisa estampada','vestido estampado'].includes(g.piece)&&!g.patternFlag&&!g.artPrint))){
    if(!b.clothingPatterns?.length)craftClothingPattern(city,b);
    for(const g of b.garments||[])if(['camisa estampada','vestido estampado'].includes(g.piece)&&!g.patternFlag&&!g.artPrint&&b.clothingPatterns.length)applyPatternToGarment(g,b.clothingPatterns[Math.floor(city.random()*b.clothingPatterns.length)]);
  }
  const price=Math.ceil(city.economy.goods.roupas.price*(b.type==='thrift_store'?.58:b.type==='clothing_store'?1.2:1));
  if(!b.inventory.roupas||c.balance<price+city.currency.price(2500)||city.minute-(c.lastClothingPurchaseAt??-Infinity)<1440)return null;
  const garments=b.garments||[],best=garments.map((g,i)=>({g,i,score:garmentScore(c,g)+(LOWER_BODY_TYPES.has(g.piece)&&!wornLowerGarment(c)?35:HANDWEAR_TYPES.has(g.piece)&&!wornHandwear(c)?28:FOOTWEAR_TYPES.has(g.piece)&&!wornFootwear(c)?30:0)})).filter(({g})=>g.reservedPartyId==null&&g.uniformCompanyId==null&&(g.dirt||0)<8&&!dislikesColor(c,g.color)).sort((a,b)=>b.score-a.score)[0];
  if(!best)return null;
  if(appearance(c)>55&&(c.wardrobe.length>=4||best.score<appearance(c)+12))return null;
  return {good:'roupas',price,garmentIndex:best.i,spec:{use:{need:'leisure',boost:0}}};
}
export function buyClothes(city,c,b,index){const g=b.garments.splice(index,1)[0];if(!g)return false;changeOwner(city,g,c.accountId,c.entity.properties.name,b.type==='thrift_store'?'compra em brechó':'compra em loja');c.wardrobe.push({...g,acquiredAt:city.minute,sellerId:b.id});c.lastClothingPurchaseAt=city.minute;selectClothes(c);return true;}
export function selectClothes(c){if(!c.wardrobe.length){c.wearingIndex=-1;c.lowerWearIndex=-1;c.headwearIndex=-1;c.footwearIndex=-1;c.handwearIndex=-1;return;}const options=c.wardrobe.map((g,i)=>({g,i})).filter(({g})=>g.uniformCompanyId==null&&(!g.storedInBuildingId||c.indoorLocation?.buildingId===g.storedInBuildingId)&&(!dislikesColor(c,g.color)||g.partyOwnerId===c.political?.partyId||g.municipalKit));const body=options.filter(({g})=>!HEADWEAR_TYPES.has(g.piece)&&!FOOTWEAR_TYPES.has(g.piece)&&!HANDWEAR_TYPES.has(g.piece)&&!LOWER_BODY_TYPES.has(g.piece)),head=options.filter(({g})=>HEADWEAR_TYPES.has(g.piece)),feet=options.filter(({g})=>FOOTWEAR_TYPES.has(g.piece)),lower=options.filter(({g})=>LOWER_BODY_TYPES.has(g.piece)),hands=options.filter(({g})=>HANDWEAR_TYPES.has(g.piece));const best=rows=>rows.length?rows.reduce((winner,item)=>garmentScore(c,item.g)>garmentScore(c,c.wardrobe[winner])?item.i:winner,rows[0].i):-1;c.wearingIndex=best(body);c.lowerWearIndex=ONE_PIECE_TYPES.has(c.wardrobe[c.wearingIndex]?.piece)?-1:best(lower);c.headwearIndex=best(head);c.footwearIndex=best(feet);c.handwearIndex=best(hands);applyPlayerOutfit(c);}
export function washWardrobe(c,minute,method='lavanderia'){let count=0;for(const g of c.wardrobe||[])if((g.dirt||0)>=12){g.dirt=0;g.condition=Math.max(0,g.condition-1.2);g.lastWashedAt=minute;g.washingHistory??=[];g.washingHistory.push({minute,method});g.washingHistory=g.washingHistory.slice(-8);count++;}selectClothes(c);return count;}
export function washGarment(g,minute,method='brechó'){if(!g)return false;g.dirt=0;g.condition=Math.max(0,g.condition-1.2);g.lastWashedAt=minute;g.washingHistory??=[];g.washingHistory.push({minute,method});g.washingHistory=g.washingHistory.slice(-8);return true;}
function hasHomeLaundry(city,c){const home=city.housing?.home(c);return !!home&&city.housing.units(home).some(u=>u.roomType==='laundry');}
function sellSurplus(city,c){if(c.wardrobe.length<3)return;const shop=city.economy.businesses.filter(b=>b.type==='thrift_store'&&b.active&&!b.entity.destroyed&&b.inventory.roupas<Math.max(8,b.width*b.depth*4)&&Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y)<12).sort((a,b)=>Math.hypot(a.door.x-c.entity.x,a.door.y-c.entity.y)-Math.hypot(b.door.x-c.entity.x,b.door.y-c.entity.y))[0];if(!shop)return;const index=c.wardrobe.map((g,i)=>({g,i})).filter(({g,i})=>g.partyOwnerId==null&&g.uniformCompanyId==null&&i!==c.wearingIndex&&i!==c.lowerWearIndex&&i!==c.headwearIndex&&i!==c.footwearIndex&&i!==c.handwearIndex).sort((a,b)=>garmentScore(c,a.g)-garmentScore(c,b.g))[0]?.i;if(index==null)return;const g=c.wardrobe[index],price=Math.max(30,Math.round(city.economy.goods.roupas.price*.16*(g.condition||0)/100*(1-(g.dirt||0)*.005)));if(!city.transfer(shop.accountId,c.accountId,price,'Brechó compra roupa usada',{good:'roupas',quantity:1}))return;g.dirt??=0;changeOwner(city,g,shop.accountId,shop.entity.properties.name,'venda para brechó');shop.garments??=[];shop.garments.push(g);shop.inventory.roupas++;c.wardrobe.splice(index,1);city.economy.recordGoods('used-clothing-sale','roupas',1,c.id,shop.id);selectClothes(c);}
function giftSurplus(city,recipient){if((wornGarment(recipient)?.dirt||0)<38&&appearance(recipient)>42)return;const homeless=!recipient.homeUnitId,relations=city.society.relationsFor(recipient.id).filter(r=>r.active!==false).map(r=>city.society.citizen(r.a===recipient.id?r.b:r.a)).filter(c=>c&&!c.entity.destroyed).sort((a,b)=>(city.relationships.view(b,recipient)?.affection||0)-(city.relationships.view(a,recipient)?.affection||0));const candidates=homeless?[...relations,...city.citizens.filter(c=>c!==recipient&&!relations.includes(c)&&Math.hypot(c.entity.x-recipient.entity.x,c.entity.y-recipient.entity.y)<6)]:relations;if(!candidates.length)return;const donor=candidates[0],index=donor.wardrobe?.map((g,i)=>({g,i})).filter(({g,i})=>g.partyOwnerId==null&&g.uniformCompanyId==null&&i!==donor.wearingIndex&&i!==donor.lowerWearIndex&&i!==donor.headwearIndex&&i!==donor.footwearIndex&&i!==donor.handwearIndex&&(g.dirt||0)<12&&g.condition>25&&!dislikesColor(recipient,g.color)).sort((a,b)=>b.g.quality-a.g.quality)[0]?.i;if(index==null)return;const g=donor.wardrobe[index];if(city.random()>(homeless ? .28 : .08))return;const previousScore=wornGarment(recipient)?garmentScore(recipient,wornGarment(recipient)):0,newGift=city.minute-(g.acquiredAt??g.manufacturedAt??0)<3*1440&&g.condition>95&&(g.dirt||0)<5;donor.wardrobe.splice(index,1);selectClothes(donor);changeOwner(city,g,recipient.accountId,recipient.entity.properties.name,homeless?'doação':'presente');recipient.wardrobe.push({...g,acquiredAt:city.minute,giftedBy:donor.id,donated:homeless});selectClothes(recipient);const accepted=(g.dirt||0)<8&&g.condition>45&&garmentScore(recipient,g)>previousScore-4;if(accepted){city.relationships.shift(recipient,donor,{affection:(homeless?6:4)+(newGift?4:0),trust:homeless?5:3,respect:3});recipient.mood=Math.min(25,(recipient.mood||0)+(newGift?5:3));}else{city.relationships.shift(recipient,donor,{resentment:4,affection:-2});recipient.mood=Math.max(-25,(recipient.mood||0)-2);}const event=city.relationships.fact('clothing-gift',donor,recipient,`${donor.entity.properties.name} ${homeless?'doou':'presenteou'} uma roupa ${newGift?'nova':'usada'} a ${recipient.entity.properties.name}${accepted?'':' e a reação foi negativa'}.`,{garmentId:g.garmentId,donation:homeless,accepted,newGift});g.giftEventId=event.id;}
export function updateClothes(city){for(const c of city.citizens){if(c.entity.destroyed||c.id%24!==city.hour)continue;initializeClothes(city,c);const days=Math.max(0,city.minute-c.clothingUpdatedAt)/1440;c.clothingUpdatedAt=city.minute;for(const g of new Set([wornGarment(c),wornLowerGarment(c),wornHandwear(c),c.wardrobe?.find(g=>g.garmentId===c.political?.partyCapId)||wornHeadwear(c),wornFootwear(c),...c.wardrobe.filter(g=>g.uniformCompanyId!=null&&(g.uniformCompanyId===c.jobId||c.businessIds?.includes(g.uniformCompanyId)))]))if(g){g.condition=Math.max(0,g.condition-days*(c.jobId?2.4:1.4)*(1.5-g.quality/150));g.dirt=Math.min(100,(g.dirt||0)+days*(c.jobId?18:11));}for(const item of c.wardrobe){identifyGarment(city,item);if(item.condition<=0&&item.manufacturedAt!=null&&!item.discarded){city.economy.consumed.roupas++;item.discarded=true;city.economy.recordGoods('clothing-worn-out','roupas',1,c.id,null);}}
  c.wardrobe=c.wardrobe.filter(item=>item.condition>0);if(!c.wardrobe.length){const rags={piece:'trapos',style:'simples',brandId:null,brandName:'Sem marca',condition:0,quality:0,dirt:100};changeOwner(city,rags,c.accountId,c.entity.properties.name,'roupa improvisada');c.wardrobe.push(rags);}if(hasHomeLaundry(city,c)&&city.minute-(c.lastLaundryAt||0)>=3*1440){washWardrobe(c,city.minute,'lavanderia doméstica');c.lastLaundryAt=city.minute;}if(c.wardrobe.length>12){c.wardrobe.sort((a,b)=>Number(b.uniformCompanyId!=null)-Number(a.uniformCompanyId!=null)||Number(b.partyOwnerId!=null)-Number(a.partyOwnerId!=null)||garmentScore(c,b)-garmentScore(c,a));for(const item of c.wardrobe.splice(Math.max(12,c.wardrobe.filter(g=>g.uniformCompanyId!=null).length)))if(item.manufacturedAt!=null)city.economy.consumed.roupas++;}selectClothes(c);sellSurplus(city,c);giftSurplus(city,c);}}
export function moveGarments(from,to,n,ids=null){from.garments??=[];to.garments??=[];if(!ids){to.garments.push(...from.garments.splice(0,n));return;}const wanted=new Set(ids);for(let i=0;i<from.garments.length&&wanted.size;){const g=from.garments[i];if(wanted.delete(g.garmentId)){to.garments.push(g);from.garments.splice(i,1);}else i++;}}

function applyPlayerOutfit(c){
  for(const [slot,id]of Object.entries(c.playerOutfit||{})){
    const index=c.wardrobe.findIndex(g=>g.garmentId===id&&g.uniformCompanyId==null&&!g.discarded&&g.condition>0&&(!g.storedInBuildingId||g.storedInBuildingId===c.indoorLocation?.buildingId));
    if(index>=0)c[slot]=index;
  }
  if(ONE_PIECE_TYPES.has(c.wardrobe[c.wearingIndex]?.piece))c.lowerWearIndex=-1;
}
export function wearGarment(c,index){
  const g=c.wardrobe?.[index];
  if(!Number.isInteger(index)||!g||g.uniformCompanyId!=null||g.discarded||g.condition<=0||g.garmentId==null||g.storedInBuildingId&&g.storedInBuildingId!==c.indoorLocation?.buildingId)return false;
  const slot=HEADWEAR_TYPES.has(g.piece)?'headwearIndex':FOOTWEAR_TYPES.has(g.piece)?'footwearIndex':HANDWEAR_TYPES.has(g.piece)?'handwearIndex':LOWER_BODY_TYPES.has(g.piece)?'lowerWearIndex':'wearingIndex';
  c.playerOutfit??={};c.playerOutfit[slot]=g.garmentId;applyPlayerOutfit(c);return true;
}
