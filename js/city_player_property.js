import {equityShares} from './city_equity.js';
import {inventoryUsed,incomingItems} from './city_inventory.js';

export function playerPropertyAccount(city,c,b){
  if(!c||!b||!b.units.length)return null;
  if(b.units.every(u=>u.ownerId===c.accountId))return c.accountId;
  if(!b.municipal&&b.ownerId===c.id&&equityShares(city,b).every(s=>s.accountId===c.accountId)&&b.units.every(u=>u.ownerId===b.accountId))return b.accountId;
  return null;
}

/** Demolition keeps titles, pending obligations and occupied rooms intact until the site is vacated. */
export function demolitionIssue(city,c,b,projectId=null){
  if(!b||b.entity.destroyed||b.municipal||['townhall','mint','council_chamber'].includes(b.type))return 'Este imóvel não pode ser demolido pelo personagem.';
  const lot=city.development.plots.find(p=>p.id===b.plotId);
  if(!lot||![c?.accountId,b.accountId].includes(lot.ownerId)||!playerPropertyAccount(city,c,b)||b.equityShares&&equityShares(city,b).some(s=>s.accountId!==c.accountId))return 'A demolição exige propriedade integral do terreno, imóvel e empresa.';
  if(city.citizens.some(p=>!p.entity.destroyed&&(p.indoorLocation?.buildingId===b.id||city.housing.home(p)?.buildingId===b.id))||b.workers.length||city.buildings.some(p=>p.officeTenantOf===b.id&&!p.entity.destroyed))return 'Desocupe a residência, os escritórios e os postos de trabalho antes de demolir.';
  if(b.shareOffers?.some(o=>o.status==='open'&&o.remaining>0))return 'Cancele as ofertas de participação antes de demolir.';
  if(inventoryUsed(b)||incomingItems(b)||b.litter||b.units.some(u=>u.playerFurniture?.length))return 'Esvazie os estoques e retire os móveis adicionais antes de demolir.';
  if(city.development.projects.some(p=>p.id!==projectId&&[p.buildingId,p.builderId].includes(b.id)&&!p.cancelled&&p.status!=='completed')||city.logistics.shipments.some(s=>[s.sellerId,s.buyerId].includes(b.id)&&!['delivered','cancelled'].includes(s.status))||city.gigs.jobs.some(j=>j.buildingId===b.id&&['open','working'].includes(j.status)))return 'Conclua os contratos e entregas vinculados ao imóvel.';
  if([...city.bank.deposits.values()].some(d=>d.bankId===b.id&&d.balance>0)||city.bank.loans.some(l=>l.bankId===b.id&&!['paid','written-off','foreclosed'].includes(l.status)))return 'Encerre os depósitos e contratos bancários antes de demolir.';
  if([...city.vehicles.units.values()].some(v=>v.ownerAccountId===b.accountId&&!v.scrapped))return 'Transfira a frota da empresa antes de demolir.';
  if(city.bank.loans.some(l=>[c.accountId,b.accountId].includes(l.clientId)&&!['paid','written-off'].includes(l.status)&&(l.collateralHomeId||l.collateralHomeIds?.length||l.clientId===b.accountId)))return 'Quite as dívidas garantidas pelo imóvel ou pela empresa antes de demolir.';
  return null;
}
export function beginPlayerDemolition(city,c,b,confirmed){
  const issue=demolitionIssue(city,c,b);if(issue)return city.fail(issue);
  if(!confirmed)return city.fail('Confirme a demolição: o edifício será removido após o serviço, sem recuperar seus materiais.');
  let builder=city.development.selectBuilder(c.accountId,b.door);
  if(builder?.id===b.id)builder=city.buildings.filter(other=>other.id!==b.id&&other.type==='builder').map(other=>city.development.selectBuilder(c.accountId,b.door,other.id)).find(Boolean);
  if(!builder)return city.fail('Contrate outra construtora para demolir este imóvel.');
  const cells=b.width*b.depth*b.floors;
  const project=city.development.registerService(playerPropertyAccount(city,c,b),builder,{service:'demolition',type:b.type,name:`Demolição de ${b.entity.properties.name}`,buildingId:b.id,targetPlotId:b.plotId,door:{...b.door},stone:0,requiredLabor:cells*4,fee:cells*city.currency.price(500)});
  return project||city.fail('Contrate uma construtora acessível e reserve o pagamento da demolição.');
}
export function completePlayerDemolition(city,project){
  const c=city.society.citizen(project.ownerId),b=city.building(project.buildingId),issue=demolitionIssue(city,c,b,project.id);
  if(issue){project.status='blocked';project.error=issue;return null;}
  if(b.balance>0&&!city.transfer(b.accountId,c.accountId,b.balance,'Encerramento de imóvel demolido',{buildingId:b.id}))return null;
  for(const u of b.units)city.units.delete(u.id);
  for(const [id,home]of city.housing.homes)if(home.buildingId===b.id)city.housing.homes.delete(id);
  for(const [id,facility]of city.sanitation.facilities)if(facility.buildingId===b.id)city.sanitation.removeFacility(id);
  for(let y=b.entity.y;y<b.entity.y+b.depth;y++)for(let x=b.entity.x;x<b.entity.x+b.width;x++)city.occupied.delete(`${x},${y}`);
  const lot=city.development.plots.find(p=>p.id===b.plotId);if(lot){lot.buildingId=null;lot.projectId=null;}
  c.businessIds=c.businessIds.filter(id=>id!==b.id);b.active=false;b.entity.destroyed=true;
  city.structureRevision=(city.structureRevision||0)+1;city.obstacleRevision=(city.obstacleRevision||0)+1;
  return b;
}
