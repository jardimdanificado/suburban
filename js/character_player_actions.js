import {equipCarriedWeapon} from './city_economy.js';
import {qualification,career} from './city_employment.js';
import {carryCapacity} from './city_markets.js?v=market-one-pass-1';
import {inventoryFree,inventoryUsed} from './city_inventory.js';
import {INDUSTRIES} from './city_industries.js';
import {VEHICLE_SPECS} from './city_vehicles.js?v=shared-crossings-1';
import {planBoatTrip} from './city_boat_towing.js?v=shared-crossings-1';
import {wearGarment,buyClothes} from './city_clothing.js?v=party-apparel-1';
import {roomFurniture} from './city_furniture_catalog.js';
import {samePlace} from './character_interactions.js';
import {beginPlayerDemolition,playerPropertyAccount} from './city_player_property.js';

export const PLAYER_ACTIONS=new Set(['buy-clothes','hire-applicant','marry','buy-good','sell-good','give-good','store-good','take-good','drop-good','pickup-good','equip','unequip','wear','craft','buy-plot','build','expand','repair','demolish','furnish','unfurnish','found-business','fund-business','employment','dismiss','price','buy-stock','buy-shares','offer-shares','buy-home','bank-deposit','bank-withdraw','bank-loan','bank-repay','buy-vehicle','ride-vehicle','leave-vehicle','flirt','propose','separate','plan-child','leave-job','political-ambition','join-party','bill','veto','public-work','works-transfer','work-project','attend-council','council-vote','sanction']);
export const PLAYER_FURNITURE={chair:{label:'Cadeira',seated:true},table:{label:'Mesa'},sofa:{label:'Sofá',seated:true},chest:{label:'Baú',storage:'clothes'},fridge:{label:'Geladeira',storage:'food'},bed:{label:'Cama',sleeping:true}};
const live=b=>b&&!b.entity?.destroyed;
const free=holder=>{if(holder.entity?.properties?.citizen)holder.inventoryCapacity??=carryCapacity(holder);return inventoryFree(holder);};
const quantity=n=>Number.isSafeInteger(n)&&n>0&&n<=999;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function ownsBusiness(c,b){return !!b&&!b.municipal&&b.ownerId===c.id;}
export function ownsProperty(city,c,b){return !!playerPropertyAccount(city,c,b);}
export function playerGoods(city){return Object.keys(city.economy.goods).filter(g=>!VEHICLE_SPECS[g]&&g!=='roupas'&&!['bandeiras','faixas','livros','jornais','panfletos'].includes(g));}
export function playerRecipes(city,c){return Object.entries(INDUSTRIES).filter(([type,spec])=>Object.keys(spec.inputs||{}).length&&Object.keys(spec.outputs||{}).length&&!Object.keys(spec.outputs).some(g=>VEHICLE_SPECS[g]||g==='roupas')&&city.buildings.some(b=>b.type===type&&b.active&&live(b)&&(b.ownerId===c.id||b.workers.includes(c.id))));}
function record(city,c,action,details={}){city.log(`${c.entity.properties.name}: ${action}.`,'economy',[c.id],{kind:'player-action',action,...details});}
function nearbyBuilding(city,c,b){return live(b)&&b.active&&(c.indoorLocation?c.indoorLocation.buildingId===b.id:distance(c.entity,b.door)<=1.8);}
function nearbyPerson(c,p){return live(p)&&p!==c&&samePlace(c,p)&&distance(c.indoorLocation?.position||c.entity,p.indoorLocation?.position||p.entity)<=1.8;}
function availableGoods(city,c,good,n){return playerGoods(city).includes(good)&&quantity(n)&&(c.inventory[good]||0)>=n;}
function putGoods(city,from,to,good,n,kind){city.vehicles.moveStock(from,to,good,n);from.inventory[good]-=n;if(!from.inventory[good]&&from.equipment?.weapon?.good===good)delete from.equipment.weapon;to.inventory[good]=(to.inventory[good]||0)+n;city.economy.recordGoods(kind,good,n,from.id,to.id);}
function fail(city,text){return city.fail(text);}

/** Commands run in the authoritative simulation; the UI supplies IDs, never actors or prices. */
export function playerAction(city,c,action,o,{stop,route}){
  if(!PLAYER_ACTIONS.has(action))return fail(city,'Ação desconhecida.');
  const b=city.building(o.buildingId),n=o.quantity??1,good=o.good,s=city.characterGame;
  if(c.mobilityTrip||c.ridingVehicleId||c.localBoatTrip||c.sharedBoatRide){
    if(action!=='leave-vehicle')return fail(city,'Desembarque antes de iniciar outra ação.');
  }
  // Physical transactions can queue a walk; all availability and ownership checks run again on arrival.
  const physical=['buy-clothes','buy-good','sell-good','store-good','take-good','buy-home','bank-deposit','bank-withdraw','bank-loan','bank-repay','buy-vehicle','craft','furnish','unfurnish'];
  if(physical.includes(action)&&b&&!nearbyBuilding(city,c,b)){
    if(c.indoorLocation)return fail(city,'Saia deste prédio antes de procurar outro estabelecimento.');
    return route(city,c,b.door,'player-action',b.id,{playerAction:action,options:{...o}});
  }
  switch(action){
    case 'buy-clothes':{
      const index=b?.garments?.findIndex(g=>g.garmentId===o.garmentId),garment=b?.garments?.[index];
      if(!nearbyBuilding(city,c,b)||!['tailor','clothing_store','thrift_store'].includes(b.type)||!garment||!(b.inventory.roupas>0)||c.wardrobe.length>=12)return fail(city,'Peça indisponível ou guarda-roupa cheio.');
      const price=city.economy.goods.roupas.price;
      if(!city.transfer(c.accountId,b.accountId,price,'Serviço: Venda de roupas',{good:'roupas',quantity:1}))return fail(city,'Saldo insuficiente.');
      b.inventory.roupas--;buyClothes(city,c,b,index);city.recordBusinessRevenue(b,price);city.economy.recordGoods('player-clothes', 'roupas',1,b.id,c.id);return true;
    }
    case 'buy-good':{
      if(!nearbyBuilding(city,c,b)||!quantity(n)||!playerGoods(city).includes(good)||!(b.inventory[good]>=n)||free(c)<n)return fail(city,'Confira produto, estoque, quantidade e espaço na mochila.');
      const unit=playerSalePrice(city,b,good),price=unit*n;
      if(!Number.isSafeInteger(price)||price<1||!city.transfer(c.accountId,b.accountId,price,'Serviço: Compra pessoal de mercadoria',{good,quantity:n,buildingId:b.id}))return fail(city,'Saldo insuficiente para esta compra.');
      putGoods(city,b,c,good,n,'player-purchase');city.recordBusinessRevenue(b,price);return true;
    }
    case 'sell-good':{
      if(!nearbyBuilding(city,c,b)||!availableGoods(city,c,good,n)||!city.economy.accepts(b,good)||free(b)<n)return fail(city,'O estabelecimento não compra esse produto ou não possui espaço.');
      const price=city.economy.goods[good].price*n;
      if(!city.transfer(b.accountId,c.accountId,price,'Compra de mercadoria do jogador',{good,quantity:n}))return fail(city,'O comprador não possui caixa suficiente.');
      putGoods(city,c,b,good,n,'player-sale');b.totalExpenses=(b.totalExpenses||0)+price;return true;
    }
    case 'give-good':{
      const p=city.society.citizen(o.citizenId);
      if(!nearbyPerson(c,p)||!availableGoods(city,c,good,n)||free(p)<n)return fail(city,'Aproxime-se de uma pessoa com espaço para receber o item.');
      putGoods(city,c,p,good,n,'player-gift');city.relationships.shift(p,c,{affection:Math.min(3,n),trust:1});city.relationships.fact('gift',c,p,`${c.entity.properties.name} presenteou ${p.entity.properties.name} com ${n} ${city.economy.goods[good].label}.`);return true;
    }
    case 'store-good':case 'take-good':{
      if(!nearbyBuilding(city,c,b)||!ownsBusiness(c,b)&&!ownsProperty(city,c,b)||!quantity(n)||!playerGoods(city).includes(good))return fail(city,'Use um depósito de sua propriedade.');
      const from=action==='store-good'?c:b,to=action==='store-good'?b:c;
      if(!(from.inventory[good]>=n)||free(to)<n)return fail(city,'Estoque ou capacidade insuficientes.');
      putGoods(city,from,to,good,n,'player-storage');return true;
    }
    case 'drop-good':{
      if(c.indoorLocation)return fail(city,'Saia do prédio para deixar objetos no chão.');
      if(!availableGoods(city,c,good,n))return fail(city,'Quantidade indisponível na mochila.');
      const entity=city.createEntity({x:c.entity.x,y:c.entity.y,properties:{name:`${n} ${city.economy.goods[good].label}`,species:'item',item:{quantity:n},playerItem:{good,ownerId:c.accountId},render:{skin:'Item_Nugget.png',color:0xc3a875}}});
      city.playerGroundItems??=[];city.playerGroundItems.push(entity);city.vehicles.moveStock(c,entity,good,n);c.inventory[good]-=n;if(!c.inventory[good]&&c.equipment?.weapon?.good===good)delete c.equipment.weapon;city.economy.recordGoods('player-drop',good,n,c.id,entity.id);return true;
    }
    case 'pickup-good':{
      const entity=city.playerGroundItems?.find(e=>e.id===o.entityId&&!e.destroyed),g=entity?.properties.playerItem.good,q=entity?.properties.item.quantity;
      if(!entity||c.indoorLocation||distance(c.entity,entity)>1.8||!quantity(n)||n>q||free(c)<n)return fail(city,'Aproxime-se do objeto e confira quantidade e espaço.');
      city.vehicles.moveStock(entity,c,g,n);entity.properties.item.quantity-=n;c.inventory[g]=(c.inventory[g]||0)+n;
      if(!entity.properties.item.quantity){entity.destroyed=true;city.playerGroundItems=city.playerGroundItems.filter(e=>e!==entity);}else entity.properties.name=`${entity.properties.item.quantity} ${city.economy.goods[g].label}`;
      city.economy.recordGoods('player-pickup',g,n,entity.id,c.id);return true;
    }
    case 'equip':case 'unequip':{
      if(['porrete','barra_ferro','faca','garrucha'].includes(good)){
        if(action==='equip')return equipCarriedWeapon(c,good)||fail(city,'Leve a arma na mochila antes de equipar.');
        if(c.equipment?.weapon?.good!==good)return fail(city,'Esta arma não está equipada.');
        c.storedWeaponEquipment??={};c.storedWeaponEquipment[good]=c.equipment.weapon;delete c.equipment.weapon;return true;
      }
      if(!['cesta','carrinho'].includes(good))return fail(city,'Escolha uma cesta ou um carrinho.');
      c.equipment??={};
      if(action==='equip'){
        if(c.equipment[good]||!(c.inventory[good]>=1))return fail(city,'Equipamento indisponível ou já equipado.');
        c.inventory[good]--;c.equipment[good]=true;c.playerEquipped??={};c.playerEquipped[good]=true;
      }else{
        if(!c.equipment[good])return fail(city,'Este equipamento não está em uso.');
        c.equipment[good]=false;const newCapacity=carryCapacity(c);
        if(inventoryUsed(c)+1>newCapacity){c.equipment[good]=true;return fail(city,'Esvazie a mochila antes de retirar o equipamento.');}
        c.inventory[good]=(c.inventory[good]||0)+1;if(c.playerEquipped)delete c.playerEquipped[good];c.inventoryCapacity=newCapacity;
      }
      c.inventoryCapacity=carryCapacity(c);return true;
    }
    case 'wear':{
      return wearGarment(c,o.index)||fail(city,'Esta peça não está disponível no seu guarda-roupa.');
    }
    case 'craft':{
      const spec=INDUSTRIES[o.type];
      if(!nearbyBuilding(city,c,b)||b.type!==o.type||!ownsBusiness(c,b)&&c.jobId!==b.id||!playerRecipes(city,c).some(([type])=>type===o.type))return fail(city,'Use a oficina onde você trabalha ou uma oficina própria.');
      if(Object.entries(spec.inputs).some(([g,q])=>(c.inventory[g]||0)<q))return fail(city,'Leve todos os insumos da receita na mochila.');
      const used=Object.values(spec.inputs).reduce((a,q)=>a+q,0),out=Object.values(spec.outputs).reduce((a,q)=>a+q,0);
      if(free(c)+used<out)return fail(city,'A mochila não comporta os produtos desta receita.');
      stop(city,c);s.intent={kind:'player-craft',buildingId:b.id,type:o.type,progress:0};c.action=`Fabricando ${spec.label}`;return true;
    }
    case 'buy-plot':return city.development.buyPlot(c.accountId,o.plotId);
    case 'build':{
      if(city.politics.officeHolder(c)&&!['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing'].includes(o.type))return fail(city,'Seu cargo impede abrir uma empresa privada.');
      if(!city.buildingTypes[o.type]||['townhall','mint','council_chamber'].includes(o.type))return fail(city,'Escolha uma obra privada ou use a gestão pública.');
      if(![o.width,o.depth,o.floors].every(Number.isSafeInteger))return fail(city,'Informe dimensões e andares inteiros.');
      return city.development.beginProject(c.accountId,o.plotId,o.type,{width:o.width,depth:o.depth,floors:o.floors,crop:o.crop||null})||fail(city,'Confira terreno próprio, capital, dimensões, acesso e construtora.');
    }
    case 'expand':
      if(!ownsProperty(city,c,b)||!Number.isSafeInteger(o.floors)||o.floors<1||o.floors>8||b.floors+o.floors>12)return fail(city,'Escolha um imóvel próprio e uma ampliação de até 12 andares.');
      return city.development.beginExpansion(playerPropertyAccount(city,c,b),b.id,{floors:o.floors})||fail(city,'Ampliação indisponível: confira caixa e contratos existentes.');
    case 'repair':
      if(!ownsProperty(city,c,b)&&!ownsBusiness(c,b))return fail(city,'Escolha um imóvel próprio.');
      return city.development.beginRepair(playerPropertyAccount(city,c,b)||b.accountId,b.id,{preventive:true})||fail(city,'Reforma indisponível: confira caixa, acesso e contratos.');
    case 'demolish':return beginPlayerDemolition(city,c,b,o.confirmed===true);
    case 'furnish':case 'unfurnish':{
      const u=city.units.get(o.unitId),home=city.housing.home(c);
      if(!nearbyBuilding(city,c,b)||!u||u.buildingId!==b.id||![c.accountId,playerPropertyAccount(city,c,b)].includes(u.ownerId)&&!(home?.buildingId===b.id&&city.housing.units(home).includes(u)))return fail(city,'Escolha um cômodo da sua residência ou propriedade.');
      if(['circulation','bathroom','cell'].includes(u.roomType)||b.type==='farm'&&b.constructionKind==='building'&&u.roomType==='workspace'||['builder','carrier','waste_collector','recycler','lamp_service'].includes(b.type)&&u.z===0&&u.x===Math.floor(b.door.x-b.entity.x)&&u.y===Math.floor(b.door.y-b.entity.y))return fail(city,'Mantenha escadas, circulação e instalações sanitárias livres.');
      u.playerFurniture??=[];
      if(action==='unfurnish'){
        const i=u.playerFurniture.findIndex(f=>f.id===o.furnitureId);if(i<0||free(c)<1)return fail(city,'Móvel indisponível ou mochila cheia.');
        u.playerFurniture.splice(i,1);c.inventory.moveis=(c.inventory.moveis||0)+1;
      }else{
        const spec=PLAYER_FURNITURE[o.type];if(!spec||!(c.inventory.moveis>=1))return fail(city,'Leve uma unidade de móveis para mobiliar.');
        if(u.playerFurniture.length>=1)return fail(city,'Este cômodo já recebeu um móvel adicional. Retire-o antes de trocar.');
        const items=roomFurniture(b,u),positions=[{x:.5,y:.9},{x:.12,y:.9},{x:.88,y:.9},{x:.12,y:.5},{x:.88,y:.5},{x:.5,y:.12}];
        const point=positions.find(p=>!items.some(f=>Math.abs(u.x+p.x-f.x)<.11+(f.footprint?.width||.4)/2+.025&&Math.abs(u.y+p.y-f.y)<.08+(f.footprint?.depth||.3)/2+.025));
        if(!point)return fail(city,'Este cômodo não possui espaço livre para outro móvel.');
        const serial=city.nextPlayerFurnitureId=(city.nextPlayerFurnitureId||0)+1;
        u.playerFurniture.push({id:`player-furniture:${serial}`,unitId:u.id,roomType:u.roomType,type:o.type,x:u.x+point.x,y:u.y+point.y,z:u.z,label:spec.label,visualScale:.5,footprint:{width:.22,depth:.16},...spec});c.inventory.moveis--;
      }
      b.layoutRevision=(b.layoutRevision||0)+1;b.geometryRevision=(b.geometryRevision||0)+1;return true;
    }
    case 'found-business':
      if(city.politics.officeHolder(c))return fail(city,'Seu cargo impede administrar uma nova empresa.');
      if(!city.buildingTypes[o.type]||['townhall','mint','council_chamber'].includes(o.type))return fail(city,'Atividade privada inválida.');
      return city.economy.foundBusiness(c.id,o.type,o.crop||null,{compact:true})||fail(city,city.lastError||'Capital, instalações ou terreno insuficientes.');
    case 'fund-business':
      if(!ownsBusiness(c,b)||(!Number.isSafeInteger(o.amount)||o.amount<1))return fail(city,'Escolha sua empresa e um aporte positivo em centavos.');
      return city.transfer(c.accountId,b.accountId,o.amount,'Aporte do proprietário jogador')||fail(city,'Saldo insuficiente.');
    case 'employment':
      if(!ownsBusiness(c,b))return fail(city,'Você não administra esta empresa.');
      if(!Number.isFinite(o.baseWage)||o.baseWage<1||o.baseWage>1000)return fail(city,'Salário base inválido.');
      if(!city.economy.configureEmployment(b.id,{baseWage:o.baseWage,minSkill:o.minSkill??0,allowTraining:o.allowTraining===true}))return false;
      b.playerHiring=o.manualHiring===true;return true;
    case 'hire-applicant':{
      const person=city.society.citizen(o.citizenId),application=person&&career(person).applications.find(a=>a.buildingId===b?.id&&a.status==='análise');
      if(!ownsBusiness(c,b)||!application||!qualification(city,person,b).eligible)return fail(city,'Escolha um candidato inscrito que cumpra os requisitos da vaga.');
      b.playerHiring=true;application.employerApproved=true;return true;
    }
    case 'dismiss':{
      const worker=city.society.citizen(o.citizenId);if(!ownsBusiness(c,b)||!worker||worker.jobId!==b.id)return fail(city,'Escolha um funcionário da sua empresa.');
      city.economy.leaveJob(worker,'Dispensa pelo proprietário');return true;
    }
    case 'price':
      if(!ownsBusiness(c,b)||!playerGoods(city).includes(good)||!Number.isSafeInteger(o.amount)||o.amount<1||o.amount>city.economy.goods[good].price*10)return fail(city,'Preço inválido: informe até dez vezes o preço de referência.');
      b.playerPrices??={};b.playerPrices[good]=o.amount;return true;
    case 'buy-stock':{
      const seller=city.building(o.sellerId);
      if(!ownsBusiness(c,b)||!live(seller)||seller.id===b.id||!playerGoods(city).includes(good)||!quantity(n))return fail(city,'Fornecedor, produto ou quantidade inválidos.');
      return city.logistics.order(seller,b,good,n,playerSalePrice(city,seller,good))||fail(city,'Confira estoque, caixa, depósito e caminho para a entrega.');
    }
    case 'buy-shares':
      if(!live(b)||(!Number.isSafeInteger(o.points)||o.points<1||o.points>10000))return fail(city,'Oferta de participação inválida.');
      return city.economy.buyShares(b.id,o.offerId,c.accountId,o.points)||fail(city,'Confira oferta, preço e saldo.');
    case 'offer-shares':
      if(!live(b)||!Number.isSafeInteger(o.points)||o.points<1||o.points>10000)return fail(city,'Participação inválida.');
      return city.economy.offerShares(b.id,c.accountId,o.points)||fail(city,'Você não possui participação disponível para esta oferta.');
    case 'buy-home':{
      const home=city.housing.homes.get(o.homeId);
      if(!home||!nearbyBuilding(city,c,city.building(home.buildingId)))return fail(city,'Aproxime-se da moradia.');
      return city.housing.buyHome(c,home)||fail(city,'Compra indisponível: confira oferta, reserva pessoal e saldo.');
    }
    case 'bank-deposit':case 'bank-withdraw':case 'bank-loan':case 'bank-repay':{
      if(!nearbyBuilding(city,c,b)||b.type!=='bank'||!Number.isSafeInteger(o.amount)||o.amount<1)return fail(city,'Procure um banco e informe um valor positivo em centavos.');
      if(action==='bank-repay')return city.bank.repay(b,c.accountId,o.loanId,o.amount)||fail(city,'Confira dívida, saldo e valor restante.');
      const method={'bank-deposit':'deposit','bank-withdraw':'withdraw','bank-loan':'lend'}[action];
      return city.bank[method](b,c.accountId,o.amount)||fail(city,'Operação recusada: confira saldo, atendimento, liquidez e limite de crédito.');
    }
    case 'buy-vehicle':{
      const v=city.vehicles.units.get(o.vehicleId),seller=v&&(city.buildings.find(b=>b.accountId===v.holderAccountId)|| (v.holderAccountId===city.worldPort.accountId?city.worldPort:null));
      if(!v||!nearbyBuilding(city,c,seller)||v.active&&!v.forSale)return fail(city,'Procure o estabelecimento que oferece este veículo.');
      return city.vehicles.buyVehicle(c.accountId,v.id)||fail(city,'Veículo indisponível ou saldo insuficiente.');
    }
    case 'ride-vehicle':{
      const v=city.vehicles.units.get(o.vehicleId),goal={x:o.x,y:o.y};
      const accounts=new Set([c.accountId,...c.businessIds.map(id=>city.building(id)?.accountId)]);
      if(!live(v)||!v.active||v.scrapped||!accounts.has(city.vehicles.accessAccount(v))||!Number.isFinite(goal.x)||!Number.isFinite(goal.y)||!city.walkable(Math.floor(goal.x),Math.floor(goal.y))||c.indoorLocation)return fail(city,'Escolha seu veículo, um destino terrestre acessível e saia do prédio.');
      if(v.boatClass){
        const path=planBoatTrip(city,c.entity,goal,{boat:v});if(!path)return fail(city,'Não existe trajeto navegável até esse destino.');
        stop(city,c);c.path=path;s.intent={kind:'player-ride',vehicleId:v.id};return true;
      }
      const approach=city.vehicles.groundPath(c.entity,v),onward=city.vehicles.groundPath(v,goal);
      if(approach===null||onward===null)return fail(city,'Não existe caminho para este veículo ou destino.');
      stop(city,c);if(!city.vehicles.startServiceTrip(c,v,goal))return fail(city,'Veículo ocupado, reservado ou sem condições de uso.');
      s.intent={kind:'player-ride',vehicleId:v.id};return true;
    }
    case 'leave-vehicle':
      if(!c.mobilityTrip&&!c.ridingVehicleId&&!c.localBoatTrip&&!c.sharedBoatRide)return fail(city,'Você não está em um veículo.');
      city.vehicles.releaseTrip(c);if(c.localBoatTrip||c.sharedBoatRide)return fail(city,'Aguarde uma margem segura para desembarcar.');stop(city,c);return true;
    case 'flirt':case 'propose':case 'marry':case 'separate':case 'plan-child':{
      const p=city.society.citizen(o.citizenId);
      if(!nearbyPerson(c,p)||!city.society.isAdult(p))return fail(city,'Converse pessoalmente com um adulto no mesmo ambiente.');
      if(action==='marry'){
        const relation=city.society.getRelation(c,p);
        if(c.partnerId!==p.id||!relation||relation.marriedAt!=null||!city.relationships.readyForFamily(c,p))return fail(city,'A união exige um relacionamento recíproco com afeto e confiança.');
        relation.marriedAt=city.minute;city.relationships.fact('partnership',c,p,`${c.entity.properties.name} e ${p.entity.properties.name} formalizaram sua união por decisão recíproca.`,{marriage:true});return true;
      }
      if(action==='separate')return city.relationships.endPartnership(c,p,'decisão do personagem jogador')||fail(city,'Vocês não possuem relacionamento.');
      if(action==='plan-child')return city.society.planChild(c,p)||fail(city,'O casal ainda não reúne desejo mútuo, vínculo, saúde, moradia e recursos para ter filhos.');
      if(action==='propose')return city.relationships.proposePartnership(c,p)||fail(city,'A proposta exige interesse recíproco, confiança e respeito ao prazo após uma recusa.');
      return city.relationships.romance(c,p)||fail(city,'A aproximação não foi possível: confira compatibilidade, vínculo e prazo após uma recusa.');
    }
    case 'leave-job':if(!c.jobId)return fail(city,'Você não possui emprego.');stop(city,c);city.economy.leaveJob(c,'Pedido de demissão do jogador');return true;
    case 'political-ambition':
      if(typeof o.enabled!=='boolean')return fail(city,'Escolha aceitar ou recusar candidaturas.');
      c.playerPoliticalAmbition=o.enabled;s.previous.politics=o.enabled;record(city,c,o.enabled?'aceitou candidaturas políticas':'recusou novas candidaturas');return true;
    case 'join-party':{
      const party=city.politics.party(o.partyId);if(!party?.active||city.politics.officeHolder(c))return fail(city,'Escolha um partido ativo enquanto estiver sem mandato.');
      return city.politics.join(c,party,'Filiação escolhida pelo jogador')||fail(city,'A filiação não está disponível neste momento.');
    }
    case 'bill':
      if(!city.politics.council.members.some(m=>m.citizenId===c.id)&&!(c.id===city.economy.mayorId&&['worksBudget','worksTransfer'].includes(o.type)))return fail(city,'Conquiste o mandato exigido para apresentar esta proposta.');
      return city.politics.submitBill(o.type,o.payload||{},c.id);
    case 'sanction':{
      const bill=city.politics.council.bills.find(b=>b.id===o.billId);
      if(c.id!==city.economy.mayorId||bill?.status!=='awaiting-sanction')return fail(city,'Somente o prefeito pode sancionar um projeto aprovado.');
      return city.politics.council.execute(bill)||true;
    }
    case 'veto':
      if(c.id!==city.economy.mayorId)return fail(city,'Somente o prefeito pode vetar.');
      return city.politics.vetoBill(o.billId);
    case 'public-work':
      if(c.id!==city.economy.mayorId)return fail(city,'Somente o prefeito pode contratar obras públicas.');
      return city.politics.startPublicWork(o.type,o.crop||'milho',{vertical:o.vertical===true,floors:o.floors??null})||fail(city,'Obra indisponível: confira orçamento, terreno e demanda.');
    case 'works-transfer':
      if(c.id!==city.economy.mayorId||!Number.isSafeInteger(o.amount)||o.amount<1)return fail(city,'Somente o prefeito pode solicitar uma transferência válida.');
      return city.politics.submitBill('worksTransfer',{value:o.amount},c.id);
    case 'attend-council':{
      const council=city.politics.council,chamber=council.getChamber(),hall=chamber.hall();
      if(!council.members.some(m=>m.citizenId===c.id)||!hall||!chamber.workHours())return fail(city,'Compareça como vereador entre 8h e 17h.');
      return route(city,c,hall.door,'player-council',hall.id);
    }
    case 'council-vote':{
      const council=city.politics.council,bill=council.bills.find(b=>b.id===o.billId);
      if(!council.members.some(m=>m.citizenId===c.id)||!bill||!['awaiting-session','proposed','vetoed'].includes(bill.status)||typeof o.yes!=='boolean')return fail(city,'Escolha um projeto pendente e exerça seu próprio mandato.');
      bill.playerVotes??={};bill.playerVotes[c.id]=o.yes;return true;
    }
    case 'work-project':{
      const project=city.development.projects.find(p=>p.id===o.projectId&&!p.cancelled&&p.status!=='completed');
      if(!project||project.builderId!==c.jobId&&project.accountId!==c.accountId)return fail(city,'Escolha uma obra própria ou contratada pelo seu empregador.');
      return route(city,c,project.door,'player-project',null,{projectId:project.id});
    }
  }
}
export function playerSalePrice(city,b,good){return b.playerPrices?.[good]??Math.ceil(city.economy.goods[good].price*1.12);}

/** Timed work rechecks inputs at completion; cancellation never destroys a reserved recipe. */
export function playerActivityMinute(city,c,{finish}){
  const s=city.characterGame,intent=s.intent;
  if(intent?.kind==='player-ride'){
    if(!c.path.length&&!c.mobilityTrip&&!c.ridingVehicleId&&!c.localBoatTrip&&!c.sharedBoatRide)finish(city,c,'Viagem concluída.');
    return true;
  }
  if(intent?.kind==='player-council'){
    const chamber=city.politics.council.getChamber(),hall=chamber.hall();
    if(!chamber.workHours()||!city.politics.council.members.some(m=>m.citizenId===c.id)||!hall){finish(city,c,'Expediente legislativo encerrado.');return true;}
    if(c.path.length)return true;
    c.task='council-session';c.targetId=hall.id;c.councilSession??={buildingId:hall.id,startedAt:city.minute};chamber.arrive(c);return true;
  }
  if(intent?.kind==='player-project'){
    const project=city.development.projects.find(p=>p.id===intent.projectId);
    if(!project||project.cancelled||project.status==='completed'){finish(city,c,'Trabalho na obra encerrado.');return true;}
    if(c.path.length)return true;
    if(!intent.arrived&&distance(c.entity,project.door)>1.8){finish(city,c,'Aproxime-se do canteiro para trabalhar.');return true;}
    intent.arrived=true;
    if(project.builderId!==c.jobId&&project.accountId!==c.accountId){finish(city,c,'Você deixou de participar desta obra.');return true;}
    const builder=city.building(project.builderId),employee=c.jobId===builder?.id&&builder.ownerId!==c.id;
    if(city.hour<8||city.hour>=17||employee&&builder.balance<builder.wage){finish(city,c,'Trabalho encerrado: confira expediente e caixa do empregador.');return true;}
    if(city.development.work(project,c)){if(employee)city.payWage(c,builder,builder.wage);c.action='Trabalhando na obra';}else c.action='Aguardando materiais da obra';return true;
  }
  if(intent?.kind!=='player-craft')return false;
  const b=city.building(intent.buildingId),spec=INDUSTRIES[intent.type];
  if(!spec||!nearbyBuilding(city,c,b)||!ownsBusiness(c,b)&&c.jobId!==b?.id){finish(city,c,'Fabricação interrompida: oficina indisponível.');return true;}
  c.action=`Fabricando ${spec.label}`;
  if(++intent.progress<Math.max(1,spec.labor||10))return true;
  const used=Object.values(spec.inputs).reduce((a,q)=>a+q,0),out=Object.values(spec.outputs).reduce((a,q)=>a+q,0);
  if(Object.entries(spec.inputs).some(([g,q])=>(c.inventory[g]||0)<q)||free(c)+used<out){finish(city,c,'Fabricação interrompida: faltam insumos ou espaço.');return true;}
  for(const [g,q]of Object.entries(spec.inputs)){city.vehicles.loseStock(c,g,q);c.inventory[g]-=q;city.economy.consumed[g]=(city.economy.consumed[g]||0)+q;city.economy.recordGoods('player-craft-input',g,q,c.id,null);}
  for(const [g,q]of Object.entries(spec.outputs)){c.inventory[g]=(c.inventory[g]||0)+q;city.economy.produced[g]=(city.economy.produced[g]||0)+q;city.economy.recordGoods('player-craft-output',g,q,null,c.id);}
  city.vehicles.produced(c,spec.outputs);
  city.economy.practice(c,spec.skill||'craft',Math.max(1,spec.labor||10));finish(city,c,'Fabricação concluída. Os produtos estão na mochila.');return true;
}
