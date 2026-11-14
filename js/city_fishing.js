import {FISH_SPECIES,FISHING_RULES} from './fishing_catalog.js';
import {TILE_WATER} from './world_gen.js?v=terrain-generation-reset-2-map-default-128';
import {tileAt,tileHeight,surfaceElevation} from './city_terrain.js?v=entrance-retaining-clearance-1';
import {inventoryFree} from './city_inventory.js';
import {boatAccessAccounts,planBoatTrip} from './city_boat_towing.js?v=shared-crossings-1';

const steps=[[1,0],[-1,0],[0,1],[0,-1]],habitats=new WeakMap();
const isWater=(world,x,y)=>x>=0&&y>=0&&x<world.width&&y<world.height&&world.getTile(x,y)===TILE_WATER;
export function fishingWaters(world){
 const previous=habitats.get(world);if(previous?.revision===(world.revision||0))return previous;
 const {width,height}=world,size=width*height,bodyAt=new Int32Array(size).fill(-1),distance=new Int32Array(size).fill(-1),bodies=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const start=y*width+x;if(bodyAt[start]>=0||!isWater(world,x,y))continue;
  const id=bodies.length,cells=[start],shores=[];let open=false;bodyAt[start]=id;
  for(let i=0;i<cells.length;i++){const cell=cells[i],cx=cell%width,cy=Math.floor(cell/width);if(cx===0||cy===0||cx===width-1||cy===height-1)open=true;
   let shore=false;for(const [dx,dy]of steps){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const next=ny*width+nx;
    if(!isWater(world,nx,ny)){shore=true;continue;}if(bodyAt[next]<0){bodyAt[next]=id;cells.push(next);}
   }if(shore){distance[cell]=1;shores.push(cell);}
  }
  for(let i=0;i<shores.length;i++){const cell=shores[i],cx=cell%width,cy=Math.floor(cell/width);for(const [dx,dy]of steps){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const next=ny*width+nx;if(bodyAt[next]===id&&distance[next]<0){distance[next]=distance[cell]+1;shores.push(next);}}}
  bodies.push({id,salinity:open?'salt':'fresh',cells});
 }
 const result={revision:world.revision||0,bodyAt,distance,bodies};habitats.set(world,result);return result;
}
export function fishHabitat(world,x,y){
 x=Math.floor(x);y=Math.floor(y);if(!isWater(world,x,y))return null;
 const data=fishingWaters(world),cell=y*world.width+x,body=data.bodies[data.bodyAt[cell]],zone=data.distance[cell]<0||data.distance[cell]>=3?'middle':'shore';
 return {bodyId:body.id,salinity:body.salinity,zone,species:Object.keys(FISH_SPECIES).filter(g=>FISH_SPECIES[g].salinity===body.salinity&&FISH_SPECIES[g].zone===zone)};
}
// Alternative species are substitutes, never four mandatory ingredients in one batch.
export function fishSupplyInputs(economy){
 const available=new Set();for(const body of fishingWaters(economy.city.world).bodies)for(const good of Object.keys(FISH_SPECIES))if(FISH_SPECIES[good].salinity===body.salinity&&(FISH_SPECIES[good].zone==='shore'||body.cells.some(cell=>fishingWaters(economy.city.world).distance[cell]>=3)))available.add(good);
 const goods=[...available].sort((a,b)=>economy.businesses.reduce((n,firm)=>n+(firm.inventory[b]||0)-(firm.inventory[a]||0),0));
 return goods.length?{[goods[0]]:1}:{};
}
export function fishingSiteNearby(city,point){
 return shorePoints(city).some(shore=>Math.hypot(shore.x-point.x,shore.y-point.y)<=48);
}
function stock(city,point){
 city.world.fishStocks??=new Map();const key=`${Math.floor(point.x)},${Math.floor(point.y)}`,row=city.world.fishStocks.get(key)||{amount:FISHING_RULES.stock,minute:city.minute};
 const elapsed=Math.max(0,city.minute-row.minute);row.amount=Math.min(FISHING_RULES.stock,row.amount+elapsed/FISHING_RULES.regrowMinutes);row.minute=city.minute;city.world.fishStocks.set(key,row);return row;
}
function waterPath(world,from,to){
 const sx=Math.floor(from.x),sy=Math.floor(from.y),gx=Math.floor(to.x),gy=Math.floor(to.y),width=world.width;
 if(!isWater(world,sx,sy)||!isWater(world,gx,gy))return null;
 const start=sy*width+sx,target=gy*width+gx,queue=[start],parent=new Map([[start,-1]]);
 for(let i=0;i<queue.length;i++){const cell=queue[i];if(cell===target){const path=[];for(let at=cell;at!==start;at=parent.get(at))path.push({x:at%width+.5,y:Math.floor(at/width)+.5});return path.reverse();}
  const x=cell%width,y=Math.floor(cell/width);for(const [dx,dy]of steps){const nx=x+dx,ny=y+dy,next=ny*width+nx;if(isWater(world,nx,ny)&&!parent.has(next)){parent.set(next,cell);queue.push(next);}}
 }return null;
}
function shorePoints(city,bodyId=null){
 const data=fishingWaters(city.world),points=[];
 for(const body of data.bodies){if(bodyId!==null&&body.id!==bodyId)continue;for(const cell of body.cells){if(data.distance[cell]!==1)continue;const x=cell%city.world.width,y=Math.floor(cell/city.world.width);
  for(const [dx,dy]of steps){const tx=x+dx,ty=y+dy;if(city.walkable(tx,ty)&&tileHeight(tileAt(city.world,tx,ty))<=1.25)points.push({x:tx+.5,y:ty+.5,water:{x:x+.5,y:y+.5}});}
 }}return points;
}
function route(city,c,point){const path=city.findPath(c.entity,point,{allowBoats:false});if(path===null)return false;c.path=path;if(!path.length||Math.hypot(path.at(-1).x-point.x,path.at(-1).y-point.y)>.001)c.path.push({x:point.x,y:point.y});return true;}
function idlePose(c){c.fishingPose=null;c.seated=false;}
function releaseBoat(city,c){const boat=city.vehicles?.units.get(c.fishingJob?.boatId);if(boat?.fishingCitizenId===c.id){boat.fishingCitizenId=null;boat.driverId=null;boat.transportCitizenId=null;boat.status='Canoa disponível após a pesca';}c.boatClass=null;c.boatVehicleId=null;}
function returnFromWater(city,c){
 const job=c.fishingJob,boat=city.vehicles?.units.get(job.boatId);if(!boat)return false;
 const points=shorePoints(city,fishHabitat(city.world,boat.x,boat.y)?.bodyId).sort((a,b)=>Math.hypot(a.x-boat.x,a.y-boat.y)-Math.hypot(b.x-boat.x,b.y-boat.y));
 for(const shore of points){const path=waterPath(city.world,boat,shore.water);if(path!==null){job.shore=shore;job.stage='sail-return';job.waterPath=path;idlePose(c);c.path=[];return true;}}return false;
}
function chooseSite(city,b,c){
 const accounts=boatAccessAccounts(city,c);accounts.add(b.accountId);
 const boats=[...(city.vehicles?.units.values()||[])].filter(v=>v.boatClass==='canoe'&&v.active&&!v.scrapped&&!v.driverId&&!v.transportCitizenId&&!v.mechanicId&&!v.localTripCitizenId&&!v.fishingCitizenId&&!v.worldFleetReserved&&(v.condition??100)>15&&accounts.has(v.ownerAccountId)).sort((a,d)=>Math.hypot(a.x-c.entity.x,a.y-c.entity.y)-Math.hypot(d.x-c.entity.x,d.y-c.entity.y));
 for(const boat of boats.slice(0,4)){
  const habitat=fishHabitat(city.world,boat.x,boat.y),shores=shorePoints(city,habitat?.bodyId??null).sort((a,d)=>Math.hypot(a.x-boat.x,a.y-boat.y)-Math.hypot(d.x-boat.x,d.y-boat.y));
  for(const shore of shores.slice(0,16)){
   if(Math.hypot(shore.x-b.door.x,shore.y-b.door.y)>48)continue;
   const body=fishingWaters(city.world).bodies[fishHabitat(city.world,shore.water.x,shore.water.y).bodyId],middle=body.cells.filter(cell=>fishingWaters(city.world).distance[cell]>=3).map(cell=>({x:cell%city.world.width+.5,y:Math.floor(cell/city.world.width)+.5})).filter(p=>stock(city,p).amount>=1).sort((a,d)=>Math.hypot(a.x-shore.water.x,a.y-shore.water.y)-Math.hypot(d.x-shore.water.x,d.y-shore.water.y));
   const point=middle[0];if(!point)continue;
   if(habitat){if(Math.hypot(boat.x-shore.x,boat.y-shore.y)>1.6||!route(city,c,shore))continue;
    boat.fishingCitizenId=c.id;boat.driverId=c.id;delete boat.waterRoute;c.fishingJob={buildingId:b.id,stage:'board',boatId:boat.id,shore,point,labor:0};return true;
   }
   const path=planBoatTrip(city,c.entity,shore,{boat,relocate:true,serviceAccountId:b.accountId});
   if(!path)continue;c.path=path;c.fishingJob={buildingId:b.id,stage:'tow',boatId:boat.id,shore,point,labor:0};return true;
  }
 }
 const shores=shorePoints(city).filter(p=>Math.hypot(p.x-b.door.x,p.y-b.door.y)<=48&&stock(city,p.water).amount>=1).sort((a,d)=>Math.hypot(a.x-c.entity.x,a.y-c.entity.y)-Math.hypot(d.x-c.entity.x,d.y-c.entity.y));
 for(const shore of shores.slice(0,32)){if([...city.citizens].some(other=>other.id!==c.id&&other.fishingJob?.stage==='fish'&&Math.hypot(other.entity.x-shore.x,other.entity.y-shore.y)<.7))continue;if(route(city,c,shore)){c.fishingJob={buildingId:b.id,stage:'approach',shore,point:shore.water,labor:0};return true;}}
 return false;
}
function equip(city,b,c){
 if(!c.fishingRod?.remaining){if(!(b.inventory.vara_pesca>0))return false;b.inventory.vara_pesca--;c.fishingRod={remaining:FISHING_RULES.rodCatches,buildingId:b.id};city.economy.recordGoods('fishing-equipment','vara_pesca',1,b.id,c.id);}
 if(!c.fishingChair&&(b.inventory.moveis||0)>0){b.inventory.moveis--;c.fishingChair={buildingId:b.id};city.economy.recordGoods('fishing-equipment','moveis',1,b.id,c.id);}return true;
}
export function fishingWork(city,b,c){
 if(c.path.length||c.localBoatTrip)return true;
 let job=c.fishingJob;
 if(!job){
  if(!equip(city,b,c)){c.action='Aguardando vara de pesca';return false;}
  if(inventoryFree(b)<1){c.action='Estoque da pesca cheio';return false;}
  if(c.fishingCatch&&Object.values(c.fishingCatch.goods).some(n=>n>0)){c.fishingJob={buildingId:c.fishingCatch.buildingId,stage:'deliver'};const origin=city.building(c.fishingCatch.buildingId);if(origin)route(city,c,origin.door);return true;}
  if(!chooseSite(city,b,c)){c.action='Sem ponto de pesca acessível';return false;}return true;
 }
 const origin=city.building(job.buildingId)||b;
 if(job.stage==='deliver'){
  if(Math.hypot(c.entity.x-origin.door.x,c.entity.y-origin.door.y)>.25){route(city,c,origin.door);return true;}
  for(const [good,amount]of Object.entries(c.fishingCatch?.goods||{})){const n=Math.min(amount,inventoryFree(origin));if(n>0){origin.inventory[good]=(origin.inventory[good]||0)+n;c.fishingCatch.goods[good]-=n;city.economy.recordGoods('fishing-delivery',good,n,c.id,origin.id);}}
  if(Object.values(c.fishingCatch?.goods||{}).some(n=>n>0)){c.action='Aguardando espaço para descarregar pescado';return false;}
  c.fishingCatch=null;c.fishingJob=null;c.action='Descarregando pescado na colônia';return true;
 }
 if(['tow','board','sail','sail-return','land'].includes(job.stage))return true;
 if(job.stage==='approach')job.stage='fish';
 if(job.stage!=='fish')return true;
 const habitat=fishHabitat(city.world,job.point.x,job.point.y),near=job.boatId?Math.hypot(c.entity.x-job.point.x,c.entity.y-job.point.y)<.2:Math.hypot(c.entity.x-job.shore.x,c.entity.y-job.shore.y)<.2;
 if(!habitat||!near){idlePose(c);if(job.boatId)returnFromWater(city,c);else c.fishingJob=null;return false;}
 c.fishingPose={chair:!job.boatId&&!!c.fishingChair,boat:!!job.boatId,water:job.point,salinity:habitat.salinity,zone:habitat.zone};
 c.action=`Pescando · água ${habitat.salinity==='fresh'?'doce':'salgada'} · ${habitat.zone==='shore'?'margem':'miolo'}`;
 const reserve=stock(city,job.point),total=Object.values(c.fishingCatch?.goods||{}).reduce((n,a)=>n+a,0);
 if(reserve.amount<1||total>=FISHING_RULES.basket||!c.fishingRod?.remaining){
  idlePose(c);if(job.boatId)returnFromWater(city,c);else{job.stage='deliver';route(city,c,origin.door);}return true;
 }
 job.labor+=(1+(c.skills?.fishing||0)/80);if(job.labor<FISHING_RULES.labor)return true;job.labor-=FISHING_RULES.labor;
 const good=habitat.species[Math.floor((city.random?.()??.5)*habitat.species.length)];reserve.amount--;c.fishingCatch??={buildingId:origin.id,goods:{}};c.fishingCatch.goods[good]=(c.fishingCatch.goods[good]||0)+1;c.fishingRod.remaining--;
 city.economy.produced[good]=(city.economy.produced[good]||0)+1;city.economy.recordGoods('fishing-catch',good,1,null,c.id,{buildingId:origin.id,salinity:habitat.salinity,zone:habitat.zone,x:job.point.x,y:job.point.y});c.fishingCaughtAt=city.minute;
 if(c.fishingRod.remaining<=0){city.economy.consumed.vara_pesca++;c.fishingRod=null;}
 return true;
}
function moveBoat(city,c,boat,point,distance){const dx=point.x-c.entity.x,dy=point.y-c.entity.y,len=Math.hypot(dx,dy),travel=Math.min(distance,len),ratio=travel/(len||1);c.entity.x+=dx*ratio;c.entity.y+=dy*ratio;boat.x=c.entity.x;boat.y=c.entity.y;boat.angle=len?Math.atan2(dx,dy):boat.angle;boat.distance=(boat.distance||0)+travel;boat.altitude=surfaceElevation(city.world,boat.x,boat.y);if(boat.entity){boat.entity.x=boat.x;boat.entity.y=boat.y;boat.entity.altitude=boat.altitude;}return {done:len<=distance,travel};}
export function advanceFishing(city,c,dt){
 const job=c.fishingJob;if(!job){if(c.fishingPose)idlePose(c);return false;}
 if(c.dead||c.entity.destroyed){releaseBoat(city,c);idlePose(c);c.fishingJob=null;return false;}
 const b=city.building(job.buildingId),valid=!c.dead&&!c.entity.destroyed&&!c.workMeal&&!c.conversation&&!c.custody&&b?.active&&['work','manage'].includes(c.task)&&c.targetId===job.buildingId&&(city.hour==null||city.hour>=8&&city.hour<17),boat=city.vehicles?.units.get(job.boatId);
 if(job.stage==='tow'&&c.localBoatTrip){if(!valid){idlePose(c);c.fishingJob=null;}return false;}
 if(!valid&&!job.cancelled){idlePose(c);job.cancelled=true;if(boat&&job.stage==='board'&&isWater(city.world,Math.floor(c.entity.x),Math.floor(c.entity.y))){job.stage='land';c.path=[];return true;}if(boat&&c.boatClass){if(!returnFromWater(city,c))return true;}else{releaseBoat(city,c);c.fishingJob=null;return false;}}
 if(job.stage==='tow'){
  if(c.localBoatTrip||c.path?.length)return false;
  if(!boat?.active||Math.hypot(boat.x-job.shore.x,boat.y-job.shore.y)>.3){c.fishingJob=null;return false;}
  // The previous trip put the physical hull at the launch point.
  boat.fishingCitizenId=c.id;boat.driverId=c.id;job.stage='board';
 }
 if(job.stage==='board'){
  if(c.mobilityTrip||c.ridingVehicleId)return false;
  if(c.path.length)return false;
  if(!boat?.active||boat.fishingCitizenId!==c.id){c.fishingJob=null;return false;}
  const launch=isWater(city.world,Math.floor(boat.x),Math.floor(boat.y))?{x:boat.x,y:boat.y}:job.shore.water,dx=launch.x-c.entity.x,dy=launch.y-c.entity.y,len=Math.hypot(dx,dy),travel=Math.min(len,dt*2);
  if(!isWater(city.world,Math.floor(boat.x),Math.floor(boat.y))){const moved=moveBoat(city,c,boat,launch,travel);if(!moved.done)return true;}
  else{c.entity.x+=dx/(len||1)*travel;c.entity.y+=dy/(len||1)*travel;if(len>travel+.001)return true;}
  c.boatClass='canoe';c.boatVehicleId=boat.id;boat.transportCitizenId=c.id;job.waterPath=waterPath(city.world,launch,job.point);if(job.waterPath===null){returnFromWater(city,c);return true;}job.stage='sail';
 }
 if(job.stage==='sail'||job.stage==='sail-return'){
  if(!boat?.active||boat.scrapped){idlePose(c);return true;}
  let remaining=Math.max(0,dt)*3.2;
  while(remaining>0&&job.waterPath?.length){const p=job.waterPath[0];if(!isWater(city.world,Math.floor(p.x),Math.floor(p.y))){returnFromWater(city,c);break;}const moved=moveBoat(city,c,boat,p,remaining);remaining-=moved.travel;if(moved.done)job.waterPath.shift();else break;}
  if(!job.waterPath?.length){if(job.stage==='sail')job.stage='fish';else job.stage='land';}return true;
 }
 if(job.stage==='land'){
  const p=job.shore,dx=p.x-c.entity.x,dy=p.y-c.entity.y,len=Math.hypot(dx,dy),travel=Math.min(len,Math.max(0,dt)*2);c.entity.x+=dx/(len||1)*travel;c.entity.y+=dy/(len||1)*travel;
  if(len<=travel+.001){releaseBoat(city,c);idlePose(c);if(job.cancelled){c.fishingJob=null;c.path=[];}else{job.stage='deliver';route(city,c,b.door);}}return true;
 }
 if(job.stage==='fish')return !!job.boatId;
 return false;
}
