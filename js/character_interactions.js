import {waterIndex} from './city_water.js';
import {controlledCitizen,relatives} from './character_game.js';

export const INTERACTION_REACH=1.8;
const PUBLIC_PLACES=new Set(['townhall','bank','market','bakery','greengrocer','popular_refectory','clinic','hospital','public_toilet','leisure','restaurant']);
export function entryRoom(city,b,c=controlledCitizen(city)){
  if(!b?.active||b.constructionKind==='open-air')return null;
  if(city.housing.home(c)?.buildingId===b.id)return b.units.find(u=>u.roomType==='bedroom');
  if(!PUBLIC_PLACES.has(b.type)&&b.ownerId!==c.id&&c.jobId!==b.id)return null;
  return b.units.find(u=>['service','dining','waiting'].includes(u.roomType))||b.units.find(u=>['workspace','bathroom'].includes(u.roomType));
}
const alive=entity=>entity&&!entity.destroyed;
export function samePlace(a,b){return (a.indoorLocation?.buildingId??null)===(b.indoorLocation?.buildingId??null)&&(a.indoorLocation?.floor??0)===(b.indoorLocation?.floor??0);}
export function nearbyTargets(city,c=controlledCitizen(city),radius=INTERACTION_REACH,{inspectable=false}={}){
  if(!c||!alive(c.entity))return [];
  const targets=[];
  const add=(kind,id,entity,point,label)=>{const distance=Math.hypot(c.entity.x-point.x,c.entity.y-point.y);if(distance<=radius)targets.push({kind,id,entityId:entity.id,point,label,distance});};
  for(const b of city.buildings){
    if((!b.active&&!inspectable)||!alive(b.entity))continue;
    if(c.indoorLocation){if(c.indoorLocation.buildingId===b.id)targets.push({kind:'building',id:b.id,entityId:b.entity.id,point:b.door,label:b.entity.properties.name,distance:0});}
    else add('building',b.id,b.entity,b.door,b.entity.properties.name);
  }
  if(!c.indoorLocation)for(const plant of city.nature.plants.values()){
    if(!alive(plant.entity)||!inspectable&&(plant.buildingId||!Object.keys(city.nature.products(plant)).some(g=>city.nature.productsForFood(g)&&city.nature.stock(plant,g)>0)))continue;
    add('plant',plant.id,plant.entity,{x:plant.x+.5,y:plant.y+.5},plant.entity.properties.name);
  }
  if(!c.indoorLocation){
    const x=Math.floor(c.entity.x),y=Math.floor(c.entity.y),world=city.world,index=waterIndex(world);
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=world.width||ny>=world.height)continue;
      const bodyId=index.labels[ny*world.width+nx];
      if(bodyId>=0){targets.push({kind:'water',id:bodyId,entityId:null,point:{x:c.entity.x,y:c.entity.y},label:'Água sem tratamento',distance:1});break;}
    }
  }
  if(inspectable&&!c.indoorLocation)for(const vehicle of city.vehicles.units.values())if(vehicle.active&&!vehicle.scrapped&&alive(vehicle.entity))add('vehicle',vehicle.id,vehicle.entity,vehicle.entity,vehicle.entity.properties.name);
  for(const other of city.citizens)if(other!==c&&alive(other.entity)&&samePlace(c,other))add('person',other.id,other.entity,other.entity,other.entity.properties.name);
  return targets.sort((a,b)=>a.distance-b.distance||a.id-b.id);
}
export function interactionOptions(city,target,c=controlledCitizen(city)){
  if(!target||!c)return [];
  const choices=[];
  const add=(id,label,action,options={})=>choices.push({id,label,action,options});
  if(target.kind==='water'){add('fill','Encher garrafa · água não tratada','raw-water',{bodyId:target.id});}
  else if(target.kind==='plant'){
    const plant=city.nature.plants.get(target.id);if(!plant)return [];
    for(const good of Object.keys(city.nature.products(plant)))if(city.nature.productsForFood(good)&&city.nature.stock(plant,good)>0)add(`gather:${good}`,`Colher ${city.economy.goods[good].label.toLowerCase()} (${city.nature.stock(plant,good)})`,'gather',{plantId:plant.id,good});
  }else if(target.kind==='person'){
    const person=city.society.citizen(target.id);if(!person)return [];
    add('talk','Conversar','talk',{citizenId:person.id});
    if(relatives(city,c).includes(person))add('family','Ver familiar','family',{citizenId:person.id});
  }else{
    const b=city.building(target.id);if(!b?.active)return [];
    const buildingId=b.id,meal=city.economy.mealOffer(b,c),home=city.housing.home(c);
    if(!c.indoorLocation&&entryRoom(city,b,c))add('enter','Entrar','enter',{buildingId});
    if(c.indoorLocation?.buildingId===buildingId)add('exit','Sair do prédio','exit');
    if(meal)add('meal',`${meal.price?'Comprar':'Receber'} refeição${meal.price?` · ${(meal.price/100).toFixed(2)}`:''}`,'service',{kind:'meal',buildingId});
    if(['townhall','utility','popular_refectory'].includes(b.type))add('water','Encher garrafa','service',{kind:'water',buildingId});
    if(home?.buildingId===buildingId)add('sleep','Dormir na sua cama','sleep');
    if(['clinic','hospital','townhall'].includes(b.type))add('health','Pedir atendimento','service',{kind:'health',buildingId});
    const facilities=[...city.sanitation.facilities.values()].filter(f=>f.buildingId===b.id&&city.sanitation.allowed(c,f));
    if(facilities.length){add('toilet','Usar banheiro','service',{kind:'toilet',buildingId});add('hygiene','Lavar-se','service',{kind:'hygiene',buildingId});}
    if(c.jobId===buildingId||c.businessIds.includes(buildingId))add('work','Iniciar expediente','work');
    else if(!c.jobId&&!c.businessIds.length&&b.jobs>b.workers.length)add('apply','Perguntar por trabalho','apply',{buildingId});
    for(const good of Object.keys(c.inventory||{}))if(c.inventory[good]>0&&city.nature.productsForFood(good)&&['market','greengrocer','bakery','townhall'].includes(b.type))add(`sell:${good}`,`Vender ${city.economy.goods[good].label.toLowerCase()}`,'sell',{buildingId,good});
    for(const h of city.housing.homes.values())if(h.buildingId===buildingId&&city.housing.units(h).every(u=>u.forRent&&!u.tenantId))add(`rent:${h.id}`,`Alugar abrigo · ${(city.housing.rent(h,c)/100).toFixed(2)}/dia`,'home',{homeId:h.id});
  }
  return choices;
}
