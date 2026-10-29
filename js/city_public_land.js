import {chooseBuildingSite} from './city_terrain.js?v=public-cleaning-1';
const mines=new Set(['quarry','iron_mine','bauxite_mine']);
function dimensions(lot,type){
  if(type==='farm'||mines.has(type))return [[lot.width,lot.depth]];
  const size=['super_popular_housing','popular_housing','popular_luxury_housing'].includes(type)?3:4,options=[[Math.min(size,lot.width),Math.min(size,lot.depth)],[Math.min(3,lot.width),Math.min(3,lot.depth)],[Math.min(2,lot.width),Math.min(2,lot.depth)]];
  return options.filter(([w,d],i)=>w*d>=4&&options.findIndex(([x,y])=>x===w&&y===d)===i);
}
function compatible(dev,lot,type){return !lot.landingReserved&&!lot.buildingId&&!lot.projectId&&lot.width*lot.depth>=4&&(type==='farm'?dev.isFarmPlot(lot):mines.has(type)?lot.type==='quarry':!['farm','quarry'].includes(lot.type));}
function fit(dev,lot,type){
  for(const [width,depth]of dimensions(lot,type)){
    if(dev.projects.some(project=>project.service==='road'&&!project.cancelled&&project.status!=='completed'&&project.route?.some(point=>point.x>=lot.x&&point.x<lot.x+width&&point.y>=lot.y&&point.y<lot.y+depth)))continue;
    for(let rotation=0;rotation<4;rotation++){
    const site=chooseBuildingSite(dev.city,lot.x,lot.y,width,depth,{plotId:lot.id,type,rotation});if(!site.error)return{lot,width,depth,rotation:site.rotation,door:site.door,purchasePrice:lot.ownerId==='treasury'?0:lot.price};
  }}return null;
}
function spiral(index,cx,cy){
  if(!index)return{x:cx,y:cy};const r=Math.ceil((Math.sqrt(index+1)-1)/2),side=r*2,offset=index-(2*r-1)**2,edge=Math.floor(offset/side),n=offset%side;
  return edge===0?{x:cx-r+n,y:cy-r}:edge===1?{x:cx+r,y:cy-r+n}:edge===2?{x:cx+r-n,y:cy+r}:{x:cx-r,y:cy+r-n};
}
/** Validate existing land first; targeted, bounded searches do not depend on catalogue quotas. */
export function findPublicBuildingSite(dev,type,{allowPurchase=true}={}){
  const city=dev.city;if(!city.buildingTypes[type])return null;
  const category=type==='farm'?'farm':mines.has(type)?'quarry':'urban',report={type,category,checked:0,created:false,reason:''};dev.publicLandReport=report;
  const vacant=dev.plots.filter(lot=>compatible(dev,lot,type));
  for(const lot of vacant.filter(lot=>lot.ownerId==='treasury')){report.checked++;const site=fit(dev,lot,type);if(site){report.reason='Terreno público validado para a implantação.';return site;}}
  // Buying land is negotiated at its advertised price; occupied and unlisted property is excluded.
  if(allowPurchase)for(const lot of vacant.filter(lot=>lot.ownerId!=='treasury'&&lot.forSale&&Number.isSafeInteger(lot.price)&&lot.price>0&&city.accounts.has(lot.ownerId)).sort((a,b)=>a.price-b.price)){
    const site=fit(dev,lot,type);if(site){const floors=['super_popular_housing','popular_housing','popular_luxury_housing'].includes(type)?4:1,cost=type==='farm'||type==='quarry'?city.currency.price(20000):site.width*site.depth*floors*(2*city.economy.goods.pedra.price+Math.ceil(city.currency.price(12000)*1.5))+city.currency.price(20000);if(city.treasury-lot.price-cost<city.welfare.conditions().reserve)continue;report.reason='Terreno privado anunciado disponível para compra negociada.';return site;}
  }
  const states=dev.publicLandSearches??={},state=states[category]??={cursor:0,frontierCursor:0},revision=`${city.structureRevision}:${city.world.revision}:${city.world.parkingRevision||0}:${dev.plots.length}:${city.occupied.size}`;
  if((state.nextAt>city.minute||state.exhausted)&&state.revision===revision){report.reason=state.reason||'Procurando novo terreno acessível fora do catálogo atual.';return null;}state.nextAt=city.minute+60;if(state.revision!==revision)state.exhausted=false;state.revision=revision;
  const sizes=category==='farm'?[[10,10],[8,8]]:category==='quarry'?[[3,3]]:['super_popular_housing','popular_housing','popular_luxury_housing'].includes(type)?[[3,3],[2,2]]:[[4,4],[3,3],[2,2]],center=city.world.spawnCenter||city.spawn;
  let attempts=0;
  const attempt=(x,y)=>{
    if(x<1||y<1||x>=city.world.width-2||y>=city.world.height-2)return null;
    for(const [width,depth]of sizes){if(x+width>=city.world.width-1||y+depth>=city.world.height-1||dev.overlaps(x,y,width,depth))continue;
      const lot=dev.createPlot(x,y,width,depth,{type:category==='urban'?null:category});if(!lot)continue;const site=fit(dev,lot,type);if(site){report.created=true;report.reason='Novo terreno público cadastrado com acesso validado.';city.log(`Novo terreno ${lot.id} cadastrado para ${city.buildingTypes[type].label}.`,'land',[],{kind:'public-land-planned',plotId:lot.id,buildingType:type,x,y});return site;}dev.plots.splice(dev.plots.indexOf(lot),1);
    }return null;
  };
  const anchors=dev.plots.filter(lot=>lot.buildingId||lot.projectId).sort((a,b)=>Math.hypot(b.x-center.x,b.y-center.y)-Math.hypot(a.x-center.x,a.y-center.y)).slice(0,24),frontiers=[];
  for(const lot of anchors){const w=sizes[0][0],d=sizes[0][1];for(const [x,y]of [[lot.x+lot.width+2,lot.y],[lot.x-w-2,lot.y],[lot.x,lot.y+lot.depth+2],[lot.x,lot.y-d-2],[lot.x+lot.width+2,lot.y+lot.depth+2],[lot.x-w-2,lot.y-d-2],[lot.x+lot.width+2,lot.y-d-2],[lot.x-w-2,lot.y+lot.depth+2]])frontiers.push({x,y});}
  for(let i=0;i<Math.min(64,frontiers.length);i++){const point=frontiers[(state.frontierCursor||0)%frontiers.length];state.frontierCursor=(state.frontierCursor||0)+1;attempts++;const site=attempt(point.x,point.y);if(site)return site;}
  // Unlike sparse angular rings, this fallback eventually visits every integer origin on the map.
  const cx=Math.floor(center.x),cy=Math.floor(center.y),radius=Math.max(cx,cy,city.world.width-cx,city.world.height-cy),total=(2*radius+1)**2;
  for(let i=0;i<192;i++){const point=spiral(state.cursor%total,cx,cy);state.cursor=(state.cursor+1)%total;if(state.cursor===0)state.exhausted=true;attempts++;const site=attempt(point.x,point.y);if(site)return site;}
  report.attempts=attempts;state.reason=report.reason=state.exhausted?'Busca completa sem nova área pública compatível; aguardando liberação de espaço ou terreno anunciado para compra.':`Nenhum terreno compatível no catálogo; busca de novas áreas em andamento (${attempts} posições verificadas nesta etapa).`;return null;
}
export function acquirePublicBuildingSite(dev,site){
  if(!site||site.lot.buildingId||site.lot.projectId||site.lot.landingReserved)return false;const city=dev.city,lot=site.lot;if(lot.ownerId==='treasury')return true;
  if(!lot.forSale||lot.price!==site.purchasePrice||city.treasury-lot.price<city.welfare.conditions().reserve)return false;
  const seller=lot.ownerId;if(!city.transfer('treasury',seller,lot.price,'Compra negociada de terreno para obra pública',{plotId:lot.id}))return false;
  city.history.record('ownership',`Prefeitura comprou o terreno ${lot.id} anunciado por ${city.accountName(seller)}.`,['treasury',seller,`plot:${lot.id}`],{kind:'public-land-purchase',plotId:lot.id,amount:lot.price,from:seller,to:'treasury'});lot.ownerId='treasury';lot.forSale=false;lot.forRent=false;return true;
}
