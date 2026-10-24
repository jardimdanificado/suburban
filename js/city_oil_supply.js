import {LIGHTING_RULES} from './city_lighting.js';
/** Daily lighting consumption: one oil unit supplies twelve lamp-hours. */
export function oilSupply(economy){
  const city=economy.city,firms=economy.businesses,sites=[...city.lighting.sites.values()].filter(p=>p.status!=='cancelled');
  const built=sites.filter(p=>p.built),forecast=Math.min(sites.length-built.length,LIGHTING_RULES.maxActiveSites*2),daily=built.length+forecast;
  const empty=built.filter(p=>p.fuel<=0).length,oilStock=city.goodsStock('oleo'),sunflowerStock=city.goodsStock('girassol');
  const oilRequired=Math.max(0,daily+Math.ceil(Math.max(0,daily+empty-oilStock)/2)),sunflowerRequired=oilRequired*3;
  const farms=firms.filter(b=>b.type==='farm'&&b.crop==='girassol'),mills=firms.filter(b=>b.type==='mill');
  const pending=city.development.projects.filter(p=>!p.cancelled&&p.status!=='completed');
  const farmDaily=farms.reduce((n,b)=>n+economy.farmCapacity(b).daily,0),farmPotential=farms.reduce((n,b)=>n+economy.farmCapacity(b,true).daily,0);
  const farmPlanned=pending.filter(p=>p.type==='farm'&&p.crop==='girassol').reduce((n,p)=>{const area=Math.max(1,p.width*p.depth-2),staff=Math.max(1,Math.ceil(area/36)),labor=area*120/12;return n+Math.floor(area*540/(Math.max(180,labor/staff)+180));},0);
  const millDaily=mills.reduce((n,b)=>n+(b.workers.length+(economy.citizen(b.ownerId)?1:0))*240/8,0);
  const millPotential=mills.reduce((n,b)=>n+(b.jobs+(economy.citizen(b.ownerId)?1:0))*240/8,0),millPlanned=pending.filter(p=>p.type==='mill').length*60;
  const bottleneck=daily===0?'Sem consumo de iluminação previsto':farmPotential+farmPlanned<sunflowerRequired?'Faltam lavouras de girassol':farmDaily<sunflowerRequired&&farmPotential>=sunflowerRequired?'Lavouras precisam de trabalhadores ou tempo para crescer':millPotential+millPlanned<oilRequired?'Falta capacidade de prensagem':millDaily<oilRequired?'Moinhos precisam de trabalhadores':sunflowerStock<3&&oilStock<daily?'Girassol ainda não chegou aos moinhos':oilStock<daily?'Moagem ou transporte de óleo em andamento':'Reserva de óleo suficiente';
  return {minute:city.minute,built:built.length,forecast,empty,daily,oilRequired,sunflowerRequired,oilStock,sunflowerStock,farmDaily,farmPotential,farmPlanned,millDaily,millPotential,millPlanned,bottleneck};
}
export function investOilChain(economy){
  const city=economy.city,r=economy.lightingSupplyReport=oilSupply(economy),needs=city.welfare.conditions();
  if(!r.daily||needs.foodDays<1&&needs.hungry>needs.population*.3)return false;
  const cropMissing=r.farmPotential+r.farmPlanned+Math.min(r.sunflowerStock,Math.ceil(r.sunflowerRequired/2))<r.sunflowerRequired;
  const type=cropMissing?'farm':r.millPotential+r.millPlanned<r.oilRequired?'mill':null;
  if(!type)return false;
  const crop=type==='farm'?'girassol':null,pending=city.development.projects.filter(p=>!p.cancelled&&p.status!=='completed');
  if(pending.some(p=>p.type===type&&(type!=='farm'||p.crop===crop)))return false;
  if(city.treasury<needs.reserve+economy.quote(type)+city.currency.price(100000))return false;
  city.development.ensurePlots();
  const lots=city.development.plots.filter(p=>p.ownerId==='treasury'&&!p.buildingId&&!p.projectId&&(type==='farm'?city.development.isFarmPlot(p):p.width<=8&&p.depth<=8&&!['farm','quarry'].includes(p.type)));
  for(const lot of lots.slice(0,12)){
    const project=city.development.beginProject('treasury',lot.id,type,{crop,width:type==='farm'?lot.width:Math.min(3,lot.width),depth:type==='farm'?lot.depth:Math.min(3,lot.depth),floors:1,priority:180});
    if(project){economy.lastOilIntervention={minute:city.minute,type,crop,projectId:project.id};city.log(`Abastecimento da iluminação priorizou ${type==='farm'?'uma lavoura de girassol':'um moinho de óleo'}.`,'production',[],{kind:'lighting-supply-priority',projectId:project.id,requiredOil:r.oilRequired,requiredSunflower:r.sunflowerRequired});return true;}
  }
  return false;
}
