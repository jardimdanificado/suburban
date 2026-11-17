import {companyLogo} from './city_company_identity.js';

const SERVICE_TASKS=new Set(['work','manage','construction','clean','cleaning','transport','research','patrol','caregiving']);
export function uniformCompanyId(c){
 if(!SERVICE_TASKS.has(c?.task)||c.informalJobId||c.informalHaulId)return null;
 if(c.task==='manage'&&c.businessIds?.includes(c.targetId))return c.targetId;
 return c.jobId??null;
}
export function companyUniform(c){
 const id=uniformCompanyId(c);
 return id==null?null:c.wardrobe?.find(g=>g.uniformCompanyId===id&&g.condition>0&&!g.discarded)||null;
}

export function companyUniformDemand(city){
 const firms=new Set(city.economy.businesses.map(b=>b.id));let missing=0;
 for(const c of city.citizens){
  if(c.entity.destroyed)continue;
  for(const id of new Set([c.jobId,...(c.businessIds||[])].filter(id=>firms.has(id)))){
   if(!c.wardrobe?.some(g=>g.uniformCompanyId===id&&g.condition>0&&!g.discarded))missing++;
  }
 }
 return missing;
}

/** Paid production and normal freight supply uniforms; no initial garments are minted. */
export function updateCompanyUniforms(city){
 const firms=city.economy.businesses,tailors=firms.filter(b=>b.type==='tailor');
 const staff=new Map();
 for(const c of city.citizens){
  if(c.entity.destroyed)continue;
  for(const id of new Set([c.jobId,...(c.businessIds||[])].filter(id=>id!=null))){
   if(!staff.has(id))staff.set(id,[]);staff.get(id).push(c);
  }
 }
 for(const b of firms){
  companyLogo(city,b);
  const people=staff.get(b.id)||[],missing=people.filter(c=>!c.wardrobe?.some(g=>g.uniformCompanyId===b.id&&g.condition>0&&!g.discarded));
  b.garments??=[];
  for(const c of missing){
   const index=b.garments.findIndex(g=>g.uniformCompanyId===b.id);
   const present=c.indoorLocation?.buildingId===b.id||Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)<2;
   if(index<0||!present)continue;
   const [g]=b.garments.splice(index,1);b.inventory.roupas--;
   g.issuedTo=c.id;g.issuedAt=city.minute;g.ownerHistory??=[];
   g.ownerHistory.push({ownerId:b.accountId,ownerName:b.entity.properties.name,minute:city.minute,event:'uniforme entregue ao funcionário'});
   c.wardrobe??=[];c.wardrobe.push(g);
   city.economy.recordGoods('uniform-issued','roupas',1,b.id,c.id);
  }
  const needed=people.filter(c=>!c.wardrobe?.some(g=>g.uniformCompanyId===b.id&&g.condition>0&&!g.discarded)).length;
  const stocked=b.garments.filter(g=>g.uniformCompanyId===b.id).length;
  const incoming=city.logistics.shipments.filter(s=>s.buyer===b&&!['delivered','cancelled'].includes(s.status)).reduce((n,s)=>n+(s.garments||[]).filter(g=>g.uniformCompanyId===b.id).length,0);
  let ready=0,pending=0;
  for(const tailor of tailors){
   ready+=(tailor.garments||[]).filter(g=>g.uniformCompanyId===b.id).length;
   pending+=(tailor.companyUniformOrders||[]).filter(o=>o.companyId===b.id).reduce((n,o)=>n+o.remaining,0);
  }
  const quantity=Math.max(0,needed-stocked-incoming-ready-pending);
  const tailor=tailors.find(t=>t!==b)||tailors[0];
  if(quantity&&tailor){tailor.companyUniformOrders??=[];tailor.companyUniformOrders.push({companyId:b.id,remaining:quantity});}
  let remaining=Math.max(0,needed-stocked-incoming);
  for(const seller of tailors){
   const garments=(seller.garments||[]).filter(g=>g.uniformCompanyId===b.id).slice(0,remaining);
   if(!garments.length)continue;
   if(seller===b)continue;
   const limit=city.logistics.transportLimit(seller,b),ids=garments.slice(0,limit).map(g=>g.garmentId);
   if(ids.length&&city.logistics.order(seller,b,'roupas',ids.length,city.economy.goods.roupas.price,{purpose:'company-uniforms',garmentIds:ids,reserveBalance:(b.workers?.length||0)*(b.wage||0)*60}))remaining-=ids.length;
  }
 }
}

export function manufactureCompanyUniform(city,tailor,g){
 const order=tailor.companyUniformOrders?.find(o=>o.remaining>0&&city.building(o.companyId)?.active&&!city.building(o.companyId)?.entity.destroyed);
 if(!order)return false;
 const company=city.building(order.companyId),logo=companyLogo(city,company);
 Object.assign(g,{piece:'macacão',style:'uniforme',color:logo.background,uniformCompanyId:company.id,artPrint:{artId:`company-${company.id}`,cacheKey:`company-${company.id}`,companyLogo:logo,message:company.entity.properties.name,color:logo.foreground}});
 order.remaining--;
 tailor.companyUniformOrders=tailor.companyUniformOrders.filter(o=>o.remaining>0);
 return true;
}
