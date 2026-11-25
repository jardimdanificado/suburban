import {chooseBuildingSite} from './city_terrain.js?v=entrance-retaining-clearance-1';
const mines=new Set(['quarry','iron_mine','bauxite_mine']);
function dimensions(lot,type,vertical=false,compact=false){
  if(type==='farm'&&!vertical||mines.has(type))return [[lot.width,lot.depth]];
  if(vertical&&!compact){
    const raw=[[Math.min(6,lot.width),Math.min(6,lot.depth)],[Math.min(5,lot.width),Math.min(5,lot.depth)],[Math.min(4,lot.width),Math.min(6,lot.depth)],[Math.min(6,lot.width),Math.min(4,lot.depth)],[Math.min(4,lot.width),Math.min(4,lot.depth)],[Math.min(3,lot.width),Math.min(3,lot.depth)],[Math.min(2,lot.width),Math.min(2,lot.depth)]];
    return raw.filter(([w,d],i)=>w*d>=4&&raw.findIndex(([x,y])=>x===w&&y===d)===i);
  }
  const size=compact?3:['super_popular_housing','popular_housing','popular_luxury_housing'].includes(type)?3:4,options=[[Math.min(size,lot.width),Math.min(size,lot.depth)],[Math.min(3,lot.width),Math.min(3,lot.depth)],[Math.min(2,lot.width),Math.min(2,lot.depth)]];
  return options.filter(([w,d],i)=>w*d>=4&&options.findIndex(([x,y])=>x===w&&y===d)===i);
}
function compatible(dev,lot,type,vertical=false){return !lot.landingReserved&&!lot.buildingId&&!lot.projectId&&lot.width*lot.depth>=4&&(type==='farm'&&!vertical?dev.isFarmPlot(lot):mines.has(type)?lot.type==='quarry':!['farm','quarry'].includes(lot.type));}
function fit(dev,lot,type,vertical=false){
  for(const [width,depth]of dimensions(lot,type,vertical,dev.compactPlanning)){
    if(dev.projects.some(project=>project.service==='road'&&!project.cancelled&&project.status!=='completed'&&project.route?.some(point=>point.x>=lot.x&&point.x<lot.x+width&&point.y>=lot.y&&point.y<lot.y+depth)))continue;
    for(let rotation=0;rotation<4;rotation++){
    const site=chooseBuildingSite(dev.city,lot.x,lot.y,width,depth,{plotId:lot.id,type:vertical?'building':type,rotation});if(!site.error)return{lot,width,depth,rotation:site.rotation,door:site.door,purchasePrice:lot.ownerId==='treasury'?0:lot.price};
  }}return null;
}
function spiral(index,cx,cy){
  if(!index)return{x:cx,y:cy};const r=Math.ceil((Math.sqrt(index+1)-1)/2),side=r*2,offset=index-(2*r-1)**2,edge=Math.floor(offset/side),n=offset%side;
  return edge===0?{x:cx-r+n,y:cy-r}:edge===1?{x:cx+r,y:cy-r+n}:edge===2?{x:cx+r-n,y:cy+r}:{x:cx-r,y:cy+r-n};
}
/** Validate existing land first; targeted, bounded searches do not depend on catalogue quotas. */
export function findPublicBuildingSite(dev,type,{allowPurchase=true,kind=null,plotId=null}={}){
  const city=dev.city;if(!city.buildingTypes[type])return null;
  const vertical=type==='farm'&&kind==='building',category=type==='farm'&&!vertical?'farm':mines.has(type)?'quarry':'urban',report={type,category,checked:0,created:false,reason:''};dev.publicLandReport=report;
  if(plotId!==null){
    const lot=dev.plots.find(lot=>lot.id===plotId);
    if(!lot||!compatible(dev,lot,type,vertical)){report.reason='O terreno escolhido está ocupado ou é incompatível com esta obra.';return null;}
    if(lot.ownerId!=='treasury'&&(!allowPurchase||!lot.forSale||!Number.isSafeInteger(lot.price)||lot.price<=0||!city.accounts.has(lot.ownerId))){report.reason='O terreno escolhido não está disponível para compra municipal.';return null;}
    const site=fit(dev,lot,type,vertical);
    report.checked=1;report.reason=site?'Terreno escolhido validado.':'O terreno escolhido não tem acesso ou espaço para esta obra.';
    return site;
  }
  const centerPoint=city.world.spawnCenter||city.spawn,distance=lot=>Math.hypot(lot.x-centerPoint.x,lot.y-centerPoint.y);
  const vacant=dev.plots.filter(lot=>compatible(dev,lot,type,vertical));
  if(dev.compactPlanning)vacant.sort((a,b)=>distance(a)-distance(b)||a.width*a.depth-b.width*b.depth);
  for(const lot of vacant.filter(lot=>lot.ownerId==='treasury')){report.checked++;const site=fit(dev,lot,type,vertical);if(site){report.reason='Terreno público validado para a implantação.';return site;}}
  // Buying land is negotiated at its advertised price; occupied and unlisted property is excluded.
  if(allowPurchase)for(const lot of vacant.filter(lot=>lot.ownerId!=='treasury'&&lot.forSale&&Number.isSafeInteger(lot.price)&&lot.price>0&&city.accounts.has(lot.ownerId)).sort((a,b)=>a.price-b.price)){
    const site=fit(dev,lot,type,vertical);if(site){const floors=vertical?3:['super_popular_housing','popular_housing','popular_luxury_housing'].includes(type)?4:1,cost=type==='farm'&&!vertical||type==='quarry'?city.currency.price(20000):site.width*site.depth*floors*(2*city.economy.goods.pedra.price+Math.ceil(city.currency.price(12000)*1.5))+city.currency.price(20000);if(city.treasury-lot.price-cost<city.welfare.conditions().reserve)continue;report.reason='Terreno privado anunciado disponível para compra negociada.';return site;}
  }
  const states=dev.publicLandSearches??={},state=states[category]??={cursor:0,frontierCursor:0},revision=`${city.structureRevision}:${city.world.revision}:${city.world.parkingRevision||0}:${dev.plots.length}:${city.occupied.size}`;
  if((state.nextAt>city.minute||state.exhausted)&&state.revision===revision){report.reason=state.reason||'Procurando novo terreno acessível fora do catálogo atual.';return null;}state.nextAt=city.minute+60;if(state.revision!==revision)state.exhausted=false;state.revision=revision;
  const sizes=category==='urban'&&dev.compactPlanning?[[3,3],[2,3],[3,2],[2,2]]:category==='farm'?[[10,10],[8,8]]:category==='quarry'?[[3,3]]:vertical?[[6,6],[5,5],[4,4],[3,3],[2,2]]:['super_popular_housing','popular_housing','popular_luxury_housing'].includes(type)?[[3,3],[2,2]]:[[4,4],[3,3],[2,2]],center=city.world.spawnCenter||city.spawn;
  let attempts=0;
  const attempt=(x,y)=>{
    if(x<1||y<1||x>=city.world.width-2||y>=city.world.height-2)return null;
    for(const [width,depth]of sizes){if(x+width>=city.world.width-1||y+depth>=city.world.height-1||dev.overlaps(x,y,width,depth))continue;
      const lot=dev.createPlot(x,y,width,depth,{type:category==='urban'?null:category});if(!lot)continue;const site=fit(dev,lot,type,vertical);if(site){report.created=true;report.reason='Novo terreno público cadastrado com acesso validado.';city.log(`Novo terreno ${lot.id} cadastrado para ${city.buildingTypes[type].label}.`,'land',[],{kind:'public-land-planned',plotId:lot.id,buildingType:type,x,y});return site;}dev.removePlot(lot);
    }return null;
  };
  const anchors=dev.plots.filter(lot=>lot.buildingId||lot.projectId).sort((a,b)=>(dev.compactPlanning?1:-1)*(Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y))).slice(0,24),frontiers=[];
  for(const lot of anchors){const w=sizes[0][0],d=sizes[0][1],gap=Math.max(2,dev.plotSpacing);for(const [x,y]of [[lot.x+lot.width+gap,lot.y],[lot.x-w-gap,lot.y],[lot.x,lot.y+lot.depth+gap],[lot.x,lot.y-d-gap],[lot.x+lot.width+gap,lot.y+lot.depth+gap],[lot.x-w-gap,lot.y-d-gap],[lot.x+lot.width+gap,lot.y-d-gap],[lot.x-w-gap,lot.y+lot.depth+gap]])frontiers.push({x,y});}
  for(let i=0;i<Math.min(64,frontiers.length);i++){const point=frontiers[(state.frontierCursor||0)%frontiers.length];state.frontierCursor=(state.frontierCursor||0)+1;attempts++;const site=attempt(point.x,point.y);if(site)return site;}
  // Reach open land beyond the central catalogue before probing small gaps.
  const spacedBudget=dev.compactPlanning?64:0,stride=Math.max(...sizes.map(([w,d])=>Math.max(w,d)))+dev.plotSpacing;
  const spacedRadius=Math.ceil(Math.max(center.x,center.y,city.world.width-center.x,city.world.height-center.y)/stride),spacedTotal=(2*spacedRadius+1)**2;
  for(let i=0;i<spacedBudget;i++){
    const point=spiral((state.spacedCursor||0)%spacedTotal,0,0);state.spacedCursor=(state.spacedCursor||0)+1;attempts++;
    const site=attempt(Math.floor(center.x)+point.x*stride,Math.floor(center.y)+point.y*stride);if(site)return site;
  }
  // Unlike sparse angular rings, this fallback eventually visits every integer origin on the map.
  const cx=Math.floor(center.x),cy=Math.floor(center.y),radius=Math.max(cx,cy,city.world.width-cx,city.world.height-cy),total=(2*radius+1)**2;
  for(let i=0;i<192-spacedBudget;i++){const point=spiral(state.cursor%total,cx,cy);state.cursor=(state.cursor+1)%total;if(state.cursor===0)state.exhausted=true;attempts++;const site=attempt(point.x,point.y);if(site)return site;}
  report.attempts=attempts;state.reason=report.reason=state.exhausted?'Busca completa sem nova área pública compatível; aguardando liberação de espaço ou terreno anunciado para compra.':`Nenhum terreno compatível no catálogo; busca de novas áreas em andamento (${attempts} posições verificadas nesta etapa).`;return null;
}
export function acquirePublicBuildingSite(dev,site){
  if(!site||site.lot.buildingId||site.lot.projectId||site.lot.landingReserved)return false;const city=dev.city,lot=site.lot;if(lot.ownerId==='treasury')return true;
  if(!lot.forSale||lot.price!==site.purchasePrice||city.treasury-lot.price<city.welfare.conditions().reserve)return false;
  const seller=lot.ownerId;if(!city.transfer('treasury',seller,lot.price,'Compra negociada de terreno para obra pública',{plotId:lot.id}))return false;
  city.history.record('ownership',`Prefeitura comprou o terreno ${lot.id} anunciado por ${city.accountName(seller)}.`,['treasury',seller,`plot:${lot.id}`],{kind:'public-land-purchase',plotId:lot.id,amount:lot.price,from:seller,to:'treasury'});lot.ownerId='treasury';lot.forSale=false;lot.forRent=false;return true;
}
