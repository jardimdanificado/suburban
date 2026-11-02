import {cultivateFarmTerrain} from './city_farm_ground.js';
import {furnitureInteraction,roomFurniture} from './city_furniture_catalog.js?v=wall-clearance-3';
import {ROAD_TILES,tileAt} from './city_terrain.js?v=quarry-outskirts-1';
import {TILE_SAND,TILE_WATER} from './world_gen.js?v=deep-perf-3';
function furnitureFacingAngle(city,furniture){
 const tx=Math.floor(furniture.x),ty=Math.floor(furniture.y),beach=furniture.kind==='beach_chair'||furniture.kind==='beach_ground';
 if(beach){
  for(let radius=1;radius<=12;radius++){
   let nearest=null,nearestDistance=Infinity;
   for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dy))!==radius||tileAt(city.world,tx+dx,ty+dy)!==TILE_WATER)continue;
    const distance=dx*dx+dy*dy;if(distance<nearestDistance){nearestDistance=distance;nearest={x:dx,y:dy};}
   }
   if(nearest)return Math.atan2(nearest.x,nearest.y);
  }
 }
 let nearestRoad=null,nearestRoadDistance=Infinity;
 for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])if(ROAD_TILES.has(tileAt(city.world,tx+dx,ty+dy))){const distance=dx*dx+dy*dy;if(distance<nearestRoadDistance){nearestRoadDistance=distance;nearestRoad={x:dx,y:dy};}}
 if(nearestRoad)return Math.atan2(nearestRoad.x,nearestRoad.y);
 return Number.isFinite(furniture.angle)?furniture.angle:0;
}
export class CityFurniture{
 constructor(city){this.city=city;this.benches=[];this.nextId=1;this.benchLayoutVersion=5;}
 reconcile(){const city=this.city,candidates=new Map();
  // Saved cities from the earlier layout may have benches sitting on roads.
  // Rebuild that layout once so the new placement rules also fix existing saves.
  if((this.benchLayoutVersion||0)<5){for(const c of city.citizens)if(c.seatId)this.release(c);this.benches=[];this.nextId=1;this.benchLayoutVersion=5;}
  const removed=new Set(this.benches.filter(b=>!city.walkable(Math.floor(b.x),Math.floor(b.y))).map(b=>b.id));if(removed.size){for(const c of city.citizens)if(c.seatId&&removed.has(Number(c.seatId.split(':')[0]))){this.release(c);c.path=[];if(c.task==='sit')c.task=null;}this.benches=this.benches.filter(b=>!removed.has(b.id));}
  for(const bench of this.benches)bench.angle=furnitureFacingAngle(city,bench);
  for(const b of city.buildings)if(b.type==='farm'&&!b.farmSoilReady)cultivateFarmTerrain(city,b);
  for(const b of city.buildings)for(const p of [b.door,...(b.accessPath||[])])candidates.set(`${Math.floor(p.x)},${Math.floor(p.y)}`,p);
  for(const [key,count]of city.traffic)if(count>5){const [x,y]=key.split(',').map(Number);candidates.set(key,{x:x+.5,y:y+.5});}
  const limit=Math.min(128,Math.max(4,Math.ceil(city.citizens.length/12)));if(this.benches.length>=limit)return;
  for(const p of candidates.values()){
   const rx=Math.floor(p.x),ry=Math.floor(p.y);if(!ROAD_TILES.has(tileAt(city.world,rx,ry)))continue;
   for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=rx+dx,y=ry+dy,tile=tileAt(city.world,x,y);
    const occupiedByBuilding=city.buildings.some(b=>x>=b.entity.x&&x<b.entity.x+b.width&&y>=b.entity.y&&y<b.entity.y+b.depth);
    if(!city.walkable(x,y)||ROAD_TILES.has(tile)||city.occupied.has(`${x},${y}`)||occupiedByBuilding||this.benches.some(b=>Math.hypot(b.x-x-.5,b.y-y-.5)<5)||city.buildings.some(b=>Math.hypot(b.door.x-x-.5,b.door.y-y-.5)<1.5))continue;
    // Keep the complete bench footprint inside this single non-road tile.
    // Benches face the street; beach seating faces the nearest water tile.
    const beach=tile===TILE_SAND,id=this.nextId++,beachGround=beach&&id%4===0,bench={id,x:x+.5,y:y+.5,angle:Math.atan2(-dx,-dy),kind:beach?(beachGround?'beach_ground':'beach_chair'):'bench',seats:beach?[null]:[null,null],builtAt:city.minute};bench.angle=furnitureFacingAngle(city,bench);this.benches.push(bench);break;
   }if(this.benches.length>=limit)break;
  }
 }
 release(c){if(c.seatId){const [id,slot]=c.seatId.split(':').map(Number),b=this.benches.find(b=>b.id===id);if(b?.seats[slot]===c.id)b.seats[slot]=null;}c.seatId=null;c.seated=false;c.furnitureUse=null;}
 claimBench(c,origin=c.entity,maxDistance=14){
  if(c.seatId){const [id,slot]=c.seatId.split(':').map(Number),bench=this.benches.find(b=>b.id===id);if(bench?.seats[slot]===c.id)return {bench,point:this.seatPoint(bench,slot)};}
  for(const bench of [...this.benches].sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y))){if(Math.hypot(bench.x-origin.x,bench.y-origin.y)>maxDistance)continue;
   for(let slot=0;slot<(bench.seats?.length||0);slot++){const who=this.city.society.citizen(bench.seats[slot]);if(who&&!who.entity.destroyed&&who.seatId===`${bench.id}:${slot}`)continue;const point=this.seatPoint(bench,slot),path=this.city.findPath(c.entity,point);if(path===null)continue;
    // Pathfinding ends at the tile center. Add the actual seat position so the
    // citizen reaches the bench instead of stopping a few tenths of a tile away.
    const end=path.at(-1)||c.entity;if(Math.hypot(end.x-point.x,end.y-point.y)>.04)path.push({...point});
    bench.seats[slot]=c.id;c.seatId=`${bench.id}:${slot}`;return {bench,point,path};}
  }return null;
 }
 seatPoint(b,slot){const offset=b.kind==='bench'?(slot===0?-.18:.18):0;return {x:b.x+Math.cos(b.angle)*offset,y:b.y-Math.sin(b.angle)*offset};}
 queueSeat(c,b){const seat=this.claimBench(c,b.door,10);if(!seat)return false;const distance=Math.hypot(c.entity.x-seat.point.x,c.entity.y-seat.point.y);if(distance>.15&&!c.path.length)c.path=seat.path||this.city.findPath(c.entity,seat.point)||[];return true;}
 waitForInputs(c,b,reason='Aguardando matéria-prima'){
  const city=this.city,resume=c.task,seat=this.claimBench(c,c.entity,14);c.workWait={employerId:b.id,resume,retryAt:city.minute+12,reason};c.task='work-wait';c.targetId=b.id;
  if(seat){c.path=seat.path||city.findPath(c.entity,seat.point)||[];c.action='Indo aguardar no banco mais próximo';return true;}
  if(b.constructionKind!=='open-air'){const path=city.findPath(c.entity,b.door);if(path!==null){c.path=path;c.action='Indo aguardar dentro da empresa';return true;}}
  c.task=null;c.workWait=null;return false;
 }
 routeLeisure(c){if(c.needs.leisure>=85)return false;const seat=this.claimBench(c,c.entity,10);if(!seat)return false;c.task='sit';c.targetId=null;c.path=seat.path||[];c.sitUntil=this.city.minute+30;c.action='Indo descansar no banco';return true;}
 advanceWait(c){const city=this.city,b=city.building(c.workWait?.employerId);if(!b||!b.active||city.minute>=c.workWait.retryAt||city.urgentNeed(c)||city.hour<8||city.hour>=17){this.release(c);c.task=null;c.workWait=null;c.path=[];return;}
  if(c.seatId||c.indoorLocation?.buildingId===b.id&&!c.indoorLocation.path?.length){c.action=c.workWait.reason+(c.seatId?' · sentado no banco':' · dentro da empresa');if(c.jobId===b.id)city.payWage(c,b);}
 }
 syncCitizen(c){
  if(c.workWait&&c.task!=='work-wait')c.workWait=null;
  if(!c.seatId&&!c.indoorLocation){if(c.seated||c.furnitureUse){c.seated=false;c.furnitureUse=null;}return;}
  if(c.seatId){if(!['sit','work-wait','food','workmeal','supplies','toilet'].includes(c.task)||c.entity.destroyed){this.release(c);return;}const [id,slot]=c.seatId.split(':').map(Number),b=this.benches.find(b=>b.id===id),point=b&&this.seatPoint(b,slot);c.seated=!!point&&!c.path.length&&Math.hypot(c.entity.x-point.x,c.entity.y-point.y)<.14;if(c.seated){const beach=['beach_chair','beach_ground'].includes(b.kind),groundPose=b.kind==='beach_ground'?(b.id%2?'ground_sit':'lying'):null;c.furnitureUse={id:`bench:${c.seatId}`,type:'bench',label:b.kind==='beach_chair'?'Cadeira de praia':b.kind==='beach_ground'?'Descanso na praia':'Banco',seated:true,...(groundPose?{pose:groundPose}:{})};c.facingTarget={x:c.entity.x+Math.sin(b.angle),y:c.entity.y+Math.cos(b.angle)};c.action=c.task==='work-wait'?'Aguardando sentado':b.kind==='beach_chair'?'Descansando na cadeira de praia':b.kind==='beach_ground'?(groundPose==='lying'?'Deitado na areia':'Sentado na areia'):'Descansando sentado no banco';}return;}
  const s=c.indoorLocation,u=this.city.units.get(s?.unitId),b=this.city.building(s?.buildingId);c.seated=false;c.furnitureUse=null;
  if(c.task==='outdoor_leisure'&&c.outdoorLeisure&&b?.id===c.outdoorLeisure.buildingId&&!s.exiting&&!s.path?.length){const visit=c.outdoorLeisure,position=visit.position||s.position,center={x:b.entity.x+b.width/2,y:b.entity.y+b.depth/2};c.seated=true;c.furnitureUse={id:`${visit.spaceId}:seat:${visit.slot}`,type:'chair',label:visit.kind==='balcony'?'Cadeira da varanda':'Cadeira da cobertura',seated:true,pose:'seated',slot:visit.slot,posePoint:{x:position.x,y:position.y,z:position.z??s.position?.z??0}};c.facingTarget=center;return;}
  if(!s||s.exiting||s.path?.length||!u||!b)return;
  const useTask=c.workMeal?'workmeal':c.task,use=furnitureInteraction(b,u,s.targetRoomType,s.furnitureSlot??Math.max(0,(u.activityReservedIds||[]).indexOf(c.id)),useTask);if(use&&(!s.furnitureId||s.furnitureId===use.item.id)){c.furnitureUse={id:use.item.id,type:use.item.type,label:use.item.label,stationId:use.taskStation?.id||use.item.id,stationType:use.taskStation?.type||use.item.type,stationLabel:use.taskStation?.label||use.item.label,seated:!!use.item.seated,pose:use.pose,slot:use.slot,posePoint:use.posePoint};c.seated=!!use.item.seated;c.facingTarget=use.facing;}else {c.seated=false;c.furnitureUse=null;}
  const home=this.city.housing.home(c);if(home?.buildingId===b.id)this.storeAtHome(c,b,home);
 }
 storeAtHome(c,b,home){
  const rooms=this.city.housing.units(home),items=rooms.filter(u=>u.id===c.indoorLocation?.unitId).flatMap(u=>roomFurniture(b,u)),chest=items.find(f=>f.storage==='clothes'),fridge=items.find(f=>f.storage==='food');
  if(chest)for(const [i,g]of (c.wardrobe||[]).entries()){const worn=[c.wearingIndex,c.lowerWearIndex,c.headwearIndex,c.footwearIndex].includes(i);g.storedAtFurnitureId=worn?null:chest.id;g.storedInBuildingId=worn?null:b.id;}
  if(!fridge||!c.pocket)return;b.homeFoodStores??=new Map();let store=b.homeFoodStores.get(c.id);if(!store){store={ownerId:c.id,homeId:home.id,furnitureId:fridge.id,meals:[]};b.homeFoodStores.set(c.id,store);}
  while(c.pocket.food.length>2&&store.meals.length<12)store.meals.push(c.pocket.food.pop());
  while(c.pocket.food.length<2&&store.meals.length)c.pocket.food.push(store.meals.shift());
 }
 storedGoods(good){let amount=0;for(const b of this.city.buildings)for(const store of b.homeFoodStores?.values()||[])for(const meal of store.meals)amount+=meal.inputs[good]||0;return amount;}
}
