import {carryCapacity} from './city_markets.js?v=market-one-pass-1';
import {playerAction,playerActivityMinute} from './character_player_actions.js';
import {markerPreferences,CITY_SYMBOLS} from './city_symbols.js';
import {nearbyTargets,interactionOptions,samePlace,entryRoom} from './character_interactions.js';
import {canStep} from './city_terrain.js?v=entrance-retaining-clearance-1';
import {activityRoomReady,syncCitizenInterior} from './city_interiors.js';
import {invalidateActivitySearch} from './city_activity_search.js';
import {interiorRoute} from './city_interior_layout.js?v=route-cache-512-index-1';
import {apply,routeToInterview} from './city_employment.js';
import {pocket,POCKET_RULES} from './city_supplies.js';
import {interruptSleep,sleepMinute} from './city_sleep.js';

const live=c=>c&&!c.entity.destroyed&&!c.worldMigrationPending;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function movementVector(x,y,yaw=Math.PI/4){
  const length=Math.hypot(x,y)||1,cos=Math.cos(yaw),sin=Math.sin(yaw);
  return {x:Math.max(-1,Math.min(1,(x*cos+y*sin)/length)),y:Math.max(-1,Math.min(1,(-x*sin+y*cos)/length))};
}
export const playing=city=>city.characterGame?.mode==='play';
export const isPlayedCitizen=(city,c)=>playing(city)&&city.characterGame.citizenId===c?.id;
export const controlledCitizen=city=>{const id=city.characterGame?.citizenId;return id==null?undefined:city.society.citizen(id)||city.accounts.get(`citizen:${id}`);};
export function relatives(city,c=controlledCitizen(city)){
  if(!c)return [];
  const remembered=!live(c)&&city.characterGame?.citizenId===c.id?city.characterGame.familyIds||[]:[];
  const ids=new Set([c.partnerId,...c.parentIds||[],...c.childIds||[],...remembered]);
  return city.citizens.filter(other=>other.id!==c.id&&live(other)&&city.society.isAdult(other)&&(ids.has(other.id)||other.parentIds?.includes(c.id)));
}
export function canControl(city,c){
  return live(c)&&city.society.isAdult(c)&&!c.custody&&!c.workMeal&&!c.campaign&&!c.researchAssignment&&!c.funeralBodyId&&!c.custodyEscort&&!c.custodyWaterDelivery&&!c.policeAudit&&!c.policeOversight&&!c.policeRestitution&&!c.policeArrestEscort&&!c.policePatrol&&!c.policeInvestigation&&!c.policeResponse&&!c.deliveryId&&!c.cleaningJobId&&!c.informalJobId&&!c.worldBoatCrew&&!c.ridingVehicleId&&!c.mobilityTrip&&!c.skybridgeTransit;
}
function message(city,text){const s=city.characterGame;s.message=text;s.journal.push({minute:city.minute,text});if(s.journal.length>30)s.journal.shift();}
function release(city,c){
  if(!c)return;
  interruptSleep(city,c);
  if(c.conversation){const other=city.society.citizen(c.conversation.a===c.id?c.conversation.b:c.conversation.a);if(other)other.conversation=null;c.conversation=null;}
  c.task=null;c.targetId=null;c.path=[];c.servicePaid=null;c.forageJob=null;c.workCell=null;
  city.furniture.release(c);c._nextTaskAt=0;
  const location=c.indoorLocation;
  if(location&&!location.exiting){
    location.path=[];
    const room=city.units.get(location.targetUnitId||location.unitId);
    if(room?.activityReservedIds?.includes(c.id)){room.activityReservedIds=room.activityReservedIds.filter(id=>id!==c.id);invalidateActivitySearch(city,room.buildingId);}
  }
}
function restore(city){
  const s=city.characterGame,c=controlledCitizen(city);
  if(c){if((!s.autonomous||s.intent)&&!c.deliveryId&&!c.cleaningJobId)release(city,c);c.playerControlled=false;c.playerManaged=s.previous.managed;c.playerPoliticalAmbition=s.previous.politics;}
}
function possess(city,c){
  c.inventoryCapacity??=carryCapacity(c);
  const s=city.characterGame;s.previous={managed:c.playerManaged,politics:c.playerPoliticalAmbition};
  s.autonomous??=false;s.manualPending=false;
  if(!s.autonomous)release(city,c);c.playerControlled=!s.autonomous;c.playerManaged=true;c.playerPoliticalAmbition=s.previous.politics??false;if(!s.autonomous&&c.indoorLocation&&!c.indoorLocation.exiting){c.task='player-explore';c.targetId=c.indoorLocation.buildingId;}
  s.familyIds=relatives(city,c).map(person=>person.id);
  s.citizenId=c.id;s.mode='play';s.status='alive';s.intent=null;s.input={x:0,y:0};s.message='Você decide. O tempo e as necessidades continuam passando.';
}
function stop(city,c){release(city,c);if(c.indoorLocation&&!c.indoorLocation.exiting){c.task='player-explore';c.targetId=c.indoorLocation.buildingId;}city.characterGame.intent=null;city.characterGame.input={x:0,y:0};c.action='Aguardando sua decisão';}
function route(city,c,point,kind,targetId=null,extra={}){
  const path=city.findPath(c.entity,point);
  if(path===null)return city.fail('Não existe caminho acessível até esse lugar.');
  stop(city,c);
  c.path=path;
  if(!path.length&&distance(c.entity,point)>.15)c.path=[{x:point.x,y:point.y}];
  c.targetId=targetId;c.task='player-walk';
  city.characterGame.intent={kind,targetId,point:{x:point.x,y:point.y},startedAt:city.minute,...extra};
  c.action='Indo ao destino escolhido';return true;
}
function syncControl(city,c){
  const s=city.characterGame;c.playerControlled=!s.autonomous||!!s.intent;
  if(s.autonomous&&!s.intent&&c.task?.startsWith('player-')){c.task=null;c.targetId=null;c._nextTaskAt=0;}
}
function reservedActivity(city,c){return !canControl(city,c)||c.serviceQueue||c.mechanicJob||c.paintWorkId||c.fishingJob||c.sharedBoatRide;}
function setAutonomy(city,c,enabled){
  const s=city.characterGame;
  if(!enabled&&reservedActivity(city,c)){
    s.manualPending=true;message(city,'Controle manual solicitado. Aguardando concluir o transporte ou serviço em andamento.');return true;
  }
  if(enabled){
    if(!s.autonomous&&!reservedActivity(city,c)&&!c.sleep?.active)release(city,c);
    s.autonomous=true;s.manualPending=false;s.intent=null;s.input={x:0,y:0};c.playerControlled=false;c._nextTaskAt=0;
    message(city,'Rotina automática ligada. Você pode dar ordens pontuais; a rotina continua quando terminarem.');
  }else{
    stop(city,c);s.autonomous=false;s.manualPending=false;c.playerControlled=true;
    message(city,'Controle total ligado. Use WASD para andar e escolha como cuidar das necessidades.');
  }
  return true;
}
export function gameAction(city,action,options={}){
  const result=performGameAction(city,action,options),s=city.characterGame,c=controlledCitizen(city);
  if(playing(city)&&live(c)&&s.autonomous)syncControl(city,c);
  return result;
}
function performGameAction(city,action,options={}){
  city.lastError='';if(!options||typeof options!=='object')return city.fail('Ação inválida.');
  if((action==='start'||action==='resume')&&city.mayorCampaign?.mode==='play')return city.fail('Encerre o modo prefeito antes de controlar um personagem.');
  if(action==='start'){
    const c=city.society.citizen(options.citizenId);
    if(!canControl(city,c))return city.fail('Escolha um adulto livre, fora de transporte e serviço reservado.');
    if(playing(city))return city.fail('Você já controla uma pessoa.');
    city.characterGame??={version:1,mode:'simulation',citizenId:null,journal:[],startedAt:city.minute,earned:0,collected:0,meals:0,previous:{}};
    possess(city,c);message(city,`Você assumiu ${c.entity.properties.name}. Nenhum dinheiro ou item foi criado.`);return true;
  }
  const s=city.characterGame;if(!s)return city.fail('Entre no modo de jogo primeiro.');
  if(action==='resume'){
    const c=controlledCitizen(city);if(!canControl(city,c))return city.fail('Este personagem não está disponível para controle.');
    if(!playing(city))possess(city,c);return true;
  }
  if(action==='simulation'){if(playing(city))restore(city);s.mode='simulation';s.input={x:0,y:0};s.intent=null;return true;}
  if(action==='switch'){
    const next=relatives(city).find(c=>c.id===options.citizenId);
    if(!next||!canControl(city,next))return city.fail('Escolha um familiar adulto disponível.');
    restore(city);possess(city,next);message(city,`Agora você controla ${next.entity.properties.name}. O familiar anterior voltou à sua rotina.`);return true;
  }
  const c=controlledCitizen(city);
  if(!playing(city)||!live(c))return city.fail('Não há personagem vivo sob seu controle.');
  if(action==='marker'){
    if(
      ('icon' in options&&(!Number.isInteger(options.icon)||options.icon<0||options.icon>=CITY_SYMBOLS.length))||
      ('color' in options&&(typeof options.color!=='string'||!/^#[0-9a-f]{6}$/i.test(options.color)))||
      ('background' in options&&typeof options.background!=='boolean')
    )return city.fail('Opções de marcador inválidas.');
    s.marker=markerPreferences({...s.marker,...options});return true;
  }
  if((c.ridingVehicleId||c.mobilityTrip||c.localBoatTrip||c.sharedBoatRide)&&!['leave-vehicle','simulation'].includes(action))return city.fail('Desembarque antes de iniciar outra ação.');
  if(action==='autonomy'){
    if(typeof options.enabled!=='boolean')return city.fail('Escolha ligar ou desligar a rotina automática.');
    return setAutonomy(city,c,options.enabled);
  }
  if(s.autonomous&&action==='input'){
    if(options.x!==0||options.y!==0)return city.fail('Desligue a rotina automática para usar WASD.');
    s.input={x:0,y:0};return true;
  }
  if(action!=='leave-vehicle'&&s.autonomous&&reservedActivity(city,c))return city.fail('Aguarde o transporte ou serviço em andamento antes de dar outra ordem.');
  if(c.custody||(c.unconsciousUntil||0)>city.minute||(c.surrenderedUntil||0)>city.minute||c.combatFlee?.status==='running')return city.fail('Prisão, ferimentos ou rendição impedem esta ação.');
  if(c.deliveryId||c.cleaningJobId)return city.fail('Conclua o serviço reservado ou volte à simulação para devolver a autonomia.');
  const b=city.building(options.buildingId);
  switch(action){
    case 'approach-interact':{
      const target=nearbyTargets(city,c,Infinity,{inspectable:true}).find(t=>t.id===options.targetId&&t.kind===options.kind);
      const values=options.values||{};
      const attack=options.kind==='person'&&options.choice==='attack';
      if(!target||!attack&&!interactionOptions(city,target,c,values).some(choice=>choice.id===options.choice&&choice.action!=='family'&&!choice.disabled))return city.fail('Essa interação não está disponível.');
      const reach=attack?1.6:1.8;
      if(target.distance<=reach)return gameAction(city,attack?'attack':'interact',attack?{citizenId:target.id}:{kind:target.kind,targetId:target.id,choice:options.choice,values});
      if(c.indoorLocation)return city.fail('Aproxime-se do alvo dentro do prédio para interagir.');
      return route(city,c,target.point,'approach',target.id,{targetKind:target.kind,choice:options.choice,interactionValues:values,nextPathAt:city.minute+2});
    }
    case 'interact':{
      const target=nearbyTargets(city,c).find(t=>t.id===options.targetId&&t.kind===options.kind);
      if(!target)return city.fail('Aproxime-se para interagir.');
      const choice=interactionOptions(city,target,c,options.values||{}).find(choice=>choice.id===options.choice&&!choice.disabled);
      if(!choice||choice.action==='family')return city.fail('Essa interação não está disponível.');
      return gameAction(city,choice.action,choice.options);
    }
    case 'raw-water':{
      const target=nearbyTargets(city,c).find(t=>t.kind==='water'&&t.id===options.bodyId);
      if(!target)return city.fail('Aproxime-se da margem.');
      const p=pocket(c),quantity=POCKET_RULES.waterCapacity-p.water;if(quantity<=0)return city.fail('Sua garrafa já está cheia.');
      city.water.reconcile();const risk=city.water.contamination(target.id,c.entity);
      p.water=POCKET_RULES.waterCapacity;p.waterContamination=risk;p.waterSource='Água sem tratamento';p.receivedWater+=quantity;city.water.draw(target.id,quantity);
      message(city,`Garrafa cheia com água não tratada (${risk.toFixed(0)}% de contaminação). Beber pode prejudicar sua saúde.`);return true;
    }
    case 'sleep-here':
      if(c.indoorLocation)return city.fail('Use uma cama ou saia para dormir ao relento.');
      stop(city,c);s.intent={kind:'sleep',street:true,point:{x:c.entity.x,y:c.entity.y}};message(city,'Dormindo ao relento. Você continua exposto e sem abrigo.');return true;
    case 'rest':stop(city,c);s.intent={kind:'rest'};c.action='Descansando no lugar';return true;
    case 'talk':{
      const other=city.society.citizen(options.citizenId);
      if(!other||!samePlace(c,other)||distance(c.entity,other.entity)>1.8)return city.fail('Aproxime-se para conversar.');
      stop(city,c);s.intent={kind:'talk',targetId:other.id,progress:0};c.action=`Conversando com ${other.entity.properties.name}`;return true;
    }
    case 'enter':{
      if(!b?.active||b.entity.destroyed||b.constructionKind==='open-air'||distance(c.entity,b.door)>1.8)return city.fail('Aproxime-se de uma entrada acessível.');
      const room=entryRoom(city,b,c)||(options.force===true?b.units.find(u=>!['cell','circulation','bathroom'].includes(u.roomType)):null);
      if(!room)return city.fail('Esta entrada não oferece acesso ao público.');
      stop(city,c);s.intent={kind:'enter',targetId:b.id,roomId:room.id,unauthorized:!entryRoom(city,b,c)};c.task='player-enter';c.targetId=b.id;return true;
    }
    case 'explore-room':{
      const location=c.indoorLocation,b=location&&city.building(location.buildingId),room=city.units.get(options.unitId);
      if(!b||!room||room.buildingId!==b.id||room.roomType==='cell')return city.fail('Escolha um cômodo acessível no prédio atual.');
      const path=interiorRoute(city.building(b.officeTenantOf)||b,location.position,{x:b.entity.x+room.x+.5,y:b.entity.y+room.y+.5,z:room.z*1.8});
      if(path===null)return city.fail('Não existe passagem até este cômodo.');
      stop(city,c);location.path=path;location.targetUnitId=room.id;location.targetRoomType=room.roomType;c.task='player-explore';c.targetId=b.id;s.intent={kind:'player-room'};return true;
    }
    case 'exit':{
      if(!c.indoorLocation)return city.fail('Você já está do lado de fora.');
      stop(city,c);c.task=null;c.targetId=null;s.intent={kind:'exit'};syncCitizenInterior(city,c);return true;
    }
    case 'stop':stop(city,c);return true;
    case 'input':{
      const x=Number(options.x),y=Number(options.y);if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1||Math.abs(y)>1)return city.fail('Direção inválida.');
      if(x||y){if(s.intent?.kind!=='manual')stop(city,c);s.intent={kind:'manual'};c.path=[];if(c.indoorLocation&&!c.indoorLocation.exiting)c.indoorLocation.path=[];}else if(s.intent?.kind==='manual'){c.path=[];if(c.indoorLocation&&!c.indoorLocation.exiting)c.indoorLocation.path=[];c.task=c.indoorLocation&&!c.indoorLocation.exiting?'player-explore':null;s.intent=null;}
      s.input={x,y,run:options.run===true};return true;
    }
    case 'walk':{
      const x=Number(options.x),y=Number(options.y);if(!Number.isFinite(x)||!Number.isFinite(y)||!city.walkable(Math.floor(x),Math.floor(y)))return city.fail('Destino bloqueado.');
      return route(city,c,{x,y},'walk');
    }
    case 'eat':{
      const p=pocket(c),good=options.good;
      if(good){if(!city.nature.eat(c,good))return city.fail('Esse alimento não está no seu inventário.');}
      else if(p.food.length){const meal=p.food.shift();for(const [g,q]of Object.entries(meal.inputs)){city.economy.consumed[g]+=q;city.economy.recordGoods('consumption',g,q,meal.sourceId,c.id);}city.economy.enjoyMeal(c,meal);c.needs.food=Math.min(100,c.needs.food+30+Math.max(1,meal.quality||1)*4);}
      else if(c.provisions>0){c.provisions--;c.needs.food=Math.min(100,c.needs.food+34);}
      else {const edible=Object.keys(c.inventory||{}).find(g=>c.inventory[g]>0&&city.nature.productsForFood(g));if(!edible||!city.nature.eat(c,edible))return city.fail('Sem comida. Colha alimentos ou compre uma refeição.');}
      s.meals++;message(city,'Você comeu um alimento que carregava.');return true;
    }
    case 'drink':{
      const p=pocket(c);if(p.water<1)return city.fail('Garrafa vazia. Procure uma fonte de água.');
      p.water--;c.needs.water=Math.min(100,c.needs.water+40);c.needs.health=Math.max(0,c.needs.health-(p.waterContamination||0)*.12);message(city,'Você bebeu uma porção de água.');return true;
    }
    case 'gather':{
      const plant=city.nature.plants.get(options.plantId),good=options.good;
      if(!plant||plant.entity.destroyed||plant.buildingId||!city.nature.productsForFood(good)||!city.nature.stock(plant,good))return city.fail('Essa planta não possui alimento silvestre disponível.');
      return route(city,c,{x:plant.x+.5,y:plant.y+.5},'gather',null,{plantId:plant.id,good,progress:0});
    }
    case 'sleep':{
      const home=city.housing.home(c),building=home&&city.building(home.buildingId);
      if(building)return route(city,c,building.door,'sleep',building.id);
      stop(city,c);if(!city.routeHomelessToSleep(c))return city.fail('Não existe lugar seguro para descansar aqui.');
      s.intent={kind:'sleep',startedAt:city.minute};message(city,'Dormir na rua recupera menos energia e deixa você exposto.');return true;
    }
    case 'service':{
      const kinds=['meal','water','hygiene','toilet','health'];if(!kinds.includes(options.kind)||!b?.active||b.entity.destroyed)return city.fail('Serviço indisponível.');
      if(options.kind==='meal'&&!city.economy.mealOffer(b,c))return city.fail('Este estabelecimento não possui refeição em estoque.');
      if(options.kind==='water'&&!['townhall','utility','popular_refectory'].includes(b.type))return city.fail('Este lugar não fornece água tratada.');
      if(options.kind==='health'&&!['clinic','hospital','townhall'].includes(b.type))return city.fail('Este lugar não oferece atendimento de saúde.');
      if(['hygiene','toilet'].includes(options.kind)&&!city.sanitation.facilities.size)return city.fail('Nenhuma instalação sanitária disponível.');
      return route(city,c,b.door,options.kind,b.id);
    }
    case 'work':{
      const employer=city.building(c.jobId)||c.businessIds.map(id=>city.building(id)).find(b=>b?.active);
      if(!employer?.active)return city.fail('Você precisa conseguir um emprego primeiro.');
      if(city.hour<8||city.hour>=17)return city.fail('O expediente vai das 08h às 17h.');
      return route(city,c,employer.door,'work',employer.id,{salaryStart:c.salaryToday||0});
    }
    case 'apply':
      if(c.jobId||c.businessIds.length)return city.fail('Você já possui ocupação.');
      if(!b?.active||b.entity.destroyed||b.workers.length>=b.jobs)return city.fail('Essa vaga não está disponível.');
      return route(city,c,b.door,'apply',b.id);
    case 'home':{
      const home=city.housing.homes.get(options.homeId),building=home&&city.building(home.buildingId);
      if(!building)return city.fail('Moradia indisponível.');
      return route(city,c,building.door,'home',building.id,{homeId:home.id});
    }
    case 'sell':
      if(!b?.active||!city.economy.goods[options.good]||!(c.inventory?.[options.good]>0))return city.fail('Escolha produto e comprador disponíveis.');
      return route(city,c,b.door,'sell',b.id,{good:options.good});
    case 'attack':{
      const target=city.society.citizen(options.citizenId);
      if(!live(target)||target===c||distance(c.entity,target.entity)>1.6)return city.fail('Aproxime-se da pessoa antes de atacar.');
      if(city.minute<(s.nextAttackAt||0))return city.fail('Recupere o fôlego antes de atacar novamente.');
      stop(city,c);const result=city.justice.combatEncounter(c,target,{forced:true});
      if(!result)return city.fail('O alvo não pode ser atingido desta posição.');
      s.nextAttackAt=city.minute+4;message(city,'Você iniciou uma agressão. Ferimentos, testemunhas e consequências legais são reais.');return true;
    }
    default:return playerAction(city,c,action,options,{stop,route});
  }
}
function finish(city,c,text){stop(city,c);if(city.characterGame.autonomous)syncControl(city,c);if(text)message(city,text);}
export function characterMinute(city,c){
  if(!playing(city)||city.characterGame.citizenId!==c.id)return false;
  const s=city.characterGame,intent=s.intent;
  if(!intent){if(s.autonomous)return false;c.action='Aguardando sua decisão';return true;}
  if(s.autonomous&&!reservedActivity(city,c)&&['walk','work','gather','rest','talk','enter','approach'].includes(intent.kind)&&city.urgentNeed(c)){
    finish(city,c,'A ordem foi interrompida para cuidar de uma necessidade urgente.');return false;
  }
  if(intent.kind==='approach'){
    const target=nearbyTargets(city,c,Infinity,{inspectable:true}).find(t=>t.id===intent.targetId&&t.kind===intent.targetKind),attack=intent.targetKind==='person'&&intent.choice==='attack';
    if(!target||!attack&&!interactionOptions(city,target,c,intent.interactionValues||{}).some(choice=>choice.id===intent.choice&&choice.action!=='family'&&!choice.disabled)){finish(city,c,'O alvo ou a ação não está mais disponível.');return true;}
    if(target.distance<=(attack?1.6:1.8)){
      stop(city,c);
      const ok=gameAction(city,attack?'attack':'interact',attack?{citizenId:target.id}:{kind:target.kind,targetId:target.id,choice:intent.choice,values:intent.interactionValues});
      if(!ok)finish(city,c,city.lastError||'Não foi possível executar a ação.');return true;
    }
    if(!c.path.length||city.minute>=intent.nextPathAt&&distance(target.point,intent.point)>1.2){
      const path=city.findPath(c.entity,target.point);
      if(!path?.length){finish(city,c,'Não existe caminho acessível até o alvo.');return true;}
      c.path=path;intent.point={x:target.point.x,y:target.point.y};intent.nextPathAt=city.minute+2;
    }
    c.action='Aproximando-se para executar a ação';return true;
  }
  if(playerActivityMinute(city,c,{finish}))return true;
  if(intent.kind==='player-action'&&!c.path.length){
    const action=intent.playerAction,options=intent.options;stop(city,c);
    const ok=gameAction(city,action,options);if(!ok)finish(city,c,city.lastError||'Ação indisponível.');else if(!s.intent)message(city,'Ação concluída.');return true;
  }
  if(intent.kind==='manual'||c.path.length||c.indoorLocation?.path?.length)return true;
  if(intent.kind==='player-room'){finish(city,c,'Você chegou ao cômodo escolhido.');return true;}
  if(intent.kind==='rest'){c.needs.energy=Math.min(100,c.needs.energy+.2);c.action='Descansando no lugar';if(s.autonomous&&c.needs.energy>=90)finish(city,c,'Descanso concluído. Retomando a rotina automática.');return true;}
  if(intent.kind==='talk'){const other=city.society.citizen(intent.targetId);if(!other||!samePlace(c,other)||distance(c.entity,other.entity)>2){finish(city,c,'A conversa terminou.');return true;}c.needs.social=Math.min(100,c.needs.social+.8);if(++intent.progress>=8){city.relationships.greet(c,other,true);c.lastConversationAt=other.lastConversationAt=city.minute;finish(city,c,'Conversa encerrada.');}return true;}
  if(intent.kind==='exit'){if(!c.indoorLocation)finish(city,c,'Você saiu do prédio.');return true;}
  if(intent.kind==='enter'){const building=city.building(intent.targetId),room=city.units.get(intent.roomId);if(!building||!room){finish(city,c,'Entrada indisponível.');return true;}if(activityRoomReady(city,c,building,room,room.roomType==='bedroom'?'bedroom':'service')){if(intent.unauthorized)city.justice.crimeRecord('trespass',c.id,building.ownerId??null,{buildingId:building.id,purpose:'player-exploration',position:{...c.indoorLocation.position},scene:{buildingId:building.id,floor:c.indoorLocation.floor}});s.intent=null;c.task='player-explore';c.targetId=building.id;c.action='Explorando o interior';}return true;}
  const b=city.building(intent.targetId);
  if(['meal','water','apply','home','sell'].includes(intent.kind)&&(!b?.active||b.entity.destroyed)){finish(city,c,'O destino não está disponível.');return true;}
  if(!intent.arrived&&intent.point&&distance(c.entity,intent.point)>1.7&&!c.indoorLocation){finish(city,c,'O caminho foi interrompido antes de chegar.');return true;}
  intent.arrived=true;
  if(intent.kind==='walk'){finish(city,c,'Você chegou ao destino.');return true;}
  if(intent.kind==='gather'){
    const plant=city.nature.plants.get(intent.plantId);
    if(!plant||distance(c.entity,{x:plant.x+.5,y:plant.y+.5})>1.6){finish(city,c,'A coleta foi interrompida.');return true;}
    c.action='Colhendo alimento silvestre';if(++intent.progress<6)return true;
    const q=city.nature.collect(c,plant,intent.good,3);s.collected+=q;finish(city,c,q?`Você colheu ${q} ${city.economy.goods[intent.good].label}. Escolha quando comer ou vender.`:'A planta não possui mais alimento disponível.');return true;
  }
  if(intent.kind==='meal'){
    const offer=city.economy.mealOffer(b,c),p=pocket(c);
    if(!offer||p.food.length+(c.provisions||0)>=POCKET_RULES.foodCapacity||!city.transfer(c.accountId,b.accountId,offer.price,'Compra de refeição pelo jogador')){finish(city,c,'Compra recusada: confira estoque, espaço na mochila e dinheiro.');return true;}
    for(const [g,q]of Object.entries(offer.inputs))b.inventory[g]-=q;
    b.lastSaleAt=city.minute;
    city.history.record('sale',`Refeição guardada por ${c.entity.properties.name}.`,[c.accountId,b.accountId],{amount:offer.price,meal:offer.good,ingredients:{...offer.inputs}});
    p.food.push({good:offer.good,inputs:{...offer.inputs},quality:offer.quality||1,sourceId:b.id,packedAt:city.minute});
    finish(city,c,'Refeição guardada na mochila. Você decide quando comer.');return true;
  }
  if(intent.kind==='water'){
    const p=pocket(c),quantity=POCKET_RULES.waterCapacity-p.water,cost=b.type==='utility'?city.currency.price(35)*quantity:0;
    if(quantity>0&&city.transfer(c.accountId,b.accountId,cost,'Água para a garrafa do jogador')){p.water=POCKET_RULES.waterCapacity;p.waterContamination=0;p.waterSource=b.entity.properties.name;p.receivedWater+=quantity;finish(city,c,'Garrafa cheia. Você decide quando beber.');}
    else finish(city,c,quantity?'Não foi possível pagar pela água.':'Sua garrafa já está cheia.');return true;
  }
  if(intent.kind==='apply'){
    const application=apply(city,c,b);
    if(!application||application.status!=='análise'){finish(city,c,application?.reason||'A candidatura não foi aceita.');return true;}
    s.intent={kind:'interview',application};message(city,`Entrevista marcada. Aguarde o atendimento: ${application.company}.`);return true;
  }
  if(intent.kind==='interview'){
    if(c.jobId){finish(city,c,'Contratado. Agora escolha quando ir trabalhar.');return true;}
    const application=intent.application;
    if(!application||application.status!=='análise'){finish(city,c,application?.reason||'A seleção foi encerrada.');return true;}
    if(application.submittedAt!=null){c.action='Currículo entregue; aguardando o resultado da seleção';return true;}
    routeToInterview(city,c);return true;
  }
  if(intent.kind==='home'){
    const home=city.housing.homes.get(intent.homeId),ok=home&&city.housing.rentHome(c,home);
    finish(city,c,ok?'Você alugou a moradia. Agora pode voltar para dormir.':'Aluguel indisponível: confira preço e ocupação.');return true;
  }
  if(intent.kind==='sell'){
    const q=city.nature.sell(c,b,intent.good,Math.min(3,c.inventory[intent.good]||0));
    finish(city,c,q?`Você vendeu ${q} ${city.economy.goods[intent.good].label}.`:'O comprador não possui caixa ou espaço.');return true;
  }
  if(intent.kind==='sleep'){
    if(intent.street||!c.homeUnitId){c.task='energy';sleepMinute(city,c,{street:true});}
    else {c.task='energy';c.targetId=city.housing.home(c)?.buildingId;city.performTask(c);}
    if(!c.task)finish(city,c,'Você acordou.');return true;
  }
  if(['hygiene','toilet'].includes(intent.kind)){
    if(!intent.routed){c.task=null;c.targetId=null;const facility=[...city.sanitation.facilities.values()].find(f=>f.buildingId===b?.id&&city.sanitation.allowed(c,f)&&city.units.get(f.unitId)?.roomType==='bathroom');if(!facility){finish(city,c,'Não há banheiro acessível disponível.');return true;}c.task=intent.kind;c.targetId=b.id;if(intent.kind==='toilet')c.toiletTargetId=facility.id;else c.hygieneTargetId=facility.id;intent.routed=true;}
    if(!c.path.length)city.performTask(c);if(!c.task)finish(city,c,'Cuidados pessoais concluídos.');return true;
  }
  if(intent.kind==='work'){
    if(c.deliveryId||c.cleaningJobId)return true;
    if(!b?.active||city.hour<8||city.hour>=17){finish(city,c,'O expediente terminou.');return true;}
    c.targetId=b.id;c.task=b.ownerId===c.id?'manage':'work';city.performTask(c);
    const paid=Math.max(0,(c.salaryToday||0)-(intent.salaryStart||0));s.earned+=paid;intent.salaryStart=c.salaryToday||0;
    if(!c.task)finish(city,c,'Trabalho interrompido. Confira suas condições e o caixa do empregador.');return true;
  }
  if(intent.kind==='health'){c.task='health';c.targetId=b?.id;city.performTask(c);if(!c.task)finish(city,c,'Atendimento encerrado.');return true;}
  return true;
}
export function characterMovement(city,dt=1/60){
  if(!playing(city))return;
  const c=controlledCitizen(city),s=city.characterGame;
  if(!live(c)||c.custody||(c.unconsciousUntil||0)>city.minute||(c.surrenderedUntil||0)>city.minute||c.combatFlee?.status==='running')return;
  if(s.autonomous||s.intent?.kind!=='manual')return;
  const {x,y}=s.input,len=Math.hypot(x,y);if(!len)return;
  const dx=x/len,dy=y/len;
  if(c.indoorLocation&&!c.indoorLocation.exiting){
    const location=c.indoorLocation,building=city.building(location.buildingId),shell=building&&city.building(building.officeTenantOf)||building;
    const target={x:location.position.x+dx*.35,y:location.position.y+dy*.35,z:location.position.z};
    if(!shell||target.x<shell.entity.x||target.y<shell.entity.y||target.x>=shell.entity.x+shell.width||target.y>=shell.entity.y+shell.depth)return;
    const path=interiorRoute(shell,location.position,target);
    const length=path?.reduce((n,p,i)=>{const from=i?path[i-1]:location.position;return n+Math.hypot(p.x-from.x,p.y-from.y,(p.z||0)-(from.z||0));},0);
    if(path&&length<.8){const room=building.units.find(u=>u.z===Math.floor(target.z/1.8)&&u.x===Math.floor(target.x-building.entity.x)&&u.y===Math.floor(target.y-building.entity.y));if(room){location.targetUnitId=room.id;location.targetRoomType=room.roomType;}location.path=path;c.task='player-explore';c.targetId=building.id;c.action='Explorando o interior';}
  }else if(!c.indoorLocation){
    c.path=[];
    const clear=(from,to)=>{
      const ax=Math.floor(from.x),ay=Math.floor(from.y),bx=Math.floor(to.x),by=Math.floor(to.y);
      return city.walkable(bx,by)&&canStep(city.world,ax,ay,bx,by)&&(ax===bx||ay===by||city.walkable(bx,ay)&&city.walkable(ax,by));
    };
    let point={x:c.entity.x,y:c.entity.y};
    for(let d=0;d<Math.max(.65,dt*8);d+=.2){
      let next={x:point.x+dx*.2,y:point.y+dy*.2};
      if(!clear(point,next)){
        const horizontal={x:point.x+dx*.2,y:point.y},vertical={x:point.x,y:point.y+dy*.2};
        if(dx&&dy&&clear(point,horizontal))next=horizontal;
        else if(dx&&dy&&clear(point,vertical))next=vertical;
        else break;
      }
      c.path.push(next);point=next;
    }
    c.task='player-walk';c.targetId=null;c.action=s.input.run&&c.needs.energy>12?'Correndo':'Caminhando';
  }
  const movers=city._movingCitizens??=[];if(!movers.includes(c))movers.push(c);
}
export function updateCharacterGame(city){
  const s=city.characterGame;if(!s||!playing(city))return;
  const c=controlledCitizen(city);
  if(live(c)){
    s.familyIds=relatives(city,c).map(person=>person.id);
    if(s.manualPending&&!reservedActivity(city,c))setAutonomy(city,c,false);
    syncControl(city,c);
  }
  if(!live(c)&&s.status!=='dead'){s.status='dead';s.intent=null;s.input={x:0,y:0};message(city,'Seu personagem morreu. Escolha um familiar vivo ou retorne à simulação.');}
}
