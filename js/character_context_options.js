import {ownsBusiness,ownsProperty,playerGoods,playerRecipes,playerSalePrice,PLAYER_FURNITURE} from './character_player_actions.js';
import {demolitionIssue} from './city_player_property.js';
import {formatMoney} from './city_ui_format.js';

/** Context choices bind every command to the clicked record; prices and permissions stay authoritative. */
export function playerContextOptions(city,target,c,values={}){
  const choices=[],quantity=values.quantity??1,amount=values.amount??10000;
  const add=(id,label,action,options={},extra={})=>choices.push({id,label,action,options,context:true,...extra});
  const goods=playerGoods(city),carried=goods.filter(g=>c.inventory?.[g]>0),validQuantity=Number.isSafeInteger(quantity)&&quantity>0&&quantity<=999,validAmount=Number.isSafeInteger(amount)&&amount>0;
  const item=g=>city.economy.goods[g].label.toLowerCase(),q=validQuantity?quantity:1;
  if(target.kind==='person'){
    const person=city.society.citizen(target.id);if(!person)return choices;
    if(city.society.isAdult(person)&&!city.society.related(c,person)){
      if(c.partnerId===person.id){
        if(city.society.getRelation(c,person)?.marriedAt==null)add('marry','Propor casamento','marry',{citizenId:person.id});
        add('plan-child','Planejar filhos juntos','plan-child',{citizenId:person.id});
        add('separate','Terminar relacionamento','separate',{citizenId:person.id},{confirm:true});
      }else{add('flirt','Flertar','flirt',{citizenId:person.id});add('propose','Propor namoro','propose',{citizenId:person.id});}
    }
    for(const good of carried)add(`gift:${good}`,`Dar ${q} ${item(good)}`,'give-good',{citizenId:person.id,good,quantity},{input:'quantity',disabled:!validQuantity});
  }else if(target.kind==='object'){
    const entity=city.playerGroundItems?.find(e=>e.id===target.id&&!e.destroyed);
    if(entity)add('pickup',`Recolher ${q} ${item(entity.properties.playerItem.good)}`,'pickup-good',{entityId:entity.id,quantity},{input:'quantity',disabled:!validQuantity});
  }else if(target.kind==='building'){
    const b=city.building(target.id);if(!b?.active)return choices;
    const buildingId=b.id,own=ownsBusiness(c,b)||ownsProperty(city,c,b);
    if(b.type==='bank'){
      for(const [action,label]of [['bank-deposit','Depositar'],['bank-withdraw','Sacar'],['bank-loan','Solicitar empréstimo de']])add(action,`${label} ${formatMoney(validAmount?amount:0)}`,action,{buildingId,amount},{input:'amount',disabled:!validAmount});
      for(const loan of city.bank.loans.filter(l=>l.bankId===b.id&&l.clientId===c.accountId&&!['paid','written-off','foreclosed'].includes(l.status)))add(`repay:${loan.id}`,`Amortizar dívida #${loan.id} · ${formatMoney(validAmount?amount:0)}`,'bank-repay',{buildingId,loanId:loan.id,amount},{input:'amount',disabled:!validAmount});
    }
    for(const good of goods){
      if(b.inventory[good]>0){
        if(own)add(`take:${good}`,`Retirar ${q} ${item(good)} do estoque`,'take-good',{buildingId,good,quantity},{input:'quantity',disabled:!validQuantity});
        else add(`buy:${good}`,`Comprar ${q} ${item(good)} · ${formatMoney(playerSalePrice(city,b,good)*q)}`,'buy-good',{buildingId,good,quantity},{input:'quantity',disabled:!validQuantity});
      }
      if(c.inventory?.[good]>0){
        if(own)add(`store:${good}`,`Guardar ${q} ${item(good)} no estoque`,'store-good',{buildingId,good,quantity},{input:'quantity',disabled:!validQuantity});
        else if(city.economy.accepts(b,good))add(`sell-good:${good}`,`Vender ${q} ${item(good)} · ${formatMoney(city.economy.goods[good].price*q)}`,'sell-good',{buildingId,good,quantity},{input:'quantity',disabled:!validQuantity});
      }
    }
    for(const garment of b.garments||[])if(['tailor','clothing_store','thrift_store'].includes(b.type))add(`clothes:${garment.garmentId}`,`Comprar ${garment.piece} · ${formatMoney(city.economy.goods.roupas.price)}`,'buy-clothes',{buildingId,garmentId:garment.garmentId});
    for(const v of city.vehicles.units.values())if(!v.active&&!v.scrapped&&v.holderAccountId===b.accountId&&['cycle_shop','cycle_assembler','boat_shop','shipyard'].includes(b.type))add(`vehicle:${v.id}`,`Comprar ${city.economy.goods[v.good].label.toLowerCase()} #${v.id} · ${formatMoney(city.vehicles.vehiclePrice(v))}`,'buy-vehicle',{buildingId,vehicleId:v.id});
    if(playerRecipes(city,c).some(([type])=>type===b.type))add('craft',`Fabricar um lote · ${city.buildingTypes[b.type].label}`,'craft',{buildingId,type:b.type});
    for(const home of city.housing.homes.values())if(home.buildingId===buildingId&&city.housing.units(home).length&&city.housing.units(home).every(u=>u.forSale&&u.ownerId!==c.accountId))add(`buy-home:${home.id}`,`Comprar moradia · ${formatMoney(city.housing.price(home))}`,'buy-home',{buildingId,homeId:home.id},{confirm:true});
    if(own){
      add('repair','Contratar reforma','repair',{buildingId});
      if(ownsProperty(city,c,b)){add('expand','Contratar ampliação de um andar','expand',{buildingId,floors:1},{confirm:true});if(!demolitionIssue(city,c,b))add('demolish','Contratar demolição','demolish',{buildingId,confirmed:true},{confirm:true});}
      if(ownsBusiness(c,b)){
        add('fund',`Aportar ${formatMoney(validAmount?amount:0)} na empresa`,'fund-business',{buildingId,amount},{input:'amount',disabled:!validAmount});
        for(const person of city.citizens)if(person.career?.applications?.some(a=>a.buildingId===b.id&&a.status==='análise'))add(`hire:${person.id}`,`Selecionar candidato: ${person.entity.properties.name}`,'hire-applicant',{buildingId,citizenId:person.id});
        for(const id of b.workers){const worker=city.society.citizen(id);if(worker)add(`dismiss:${id}`,`Dispensar ${worker.entity.properties.name}`,'dismiss',{buildingId,citizenId:id},{confirm:true});}
      }
    }
    const unit=city.units.get(values.unitId);
    if(unit?.buildingId===buildingId&&c.indoorLocation?.buildingId===buildingId){
      add(`room:${unit.id}`,`Ir para este cômodo · andar ${unit.z+1}`,'explore-room',{unitId:unit.id});
      if(!['circulation','bathroom','cell'].includes(unit.roomType)&&(unit.ownerId===c.accountId||own||city.housing.units(city.housing.home(c)||{unitIds:[]}).includes(unit))){
        if(c.inventory.moveis>0)for(const [type,spec]of Object.entries(PLAYER_FURNITURE))add(`furnish:${type}`,`Instalar ${spec.label.toLowerCase()} neste cômodo`,'furnish',{buildingId,unitId:unit.id,type});
        for(const furniture of unit.playerFurniture||[])add(`unfurnish:${furniture.id}`,`Retirar ${furniture.label.toLowerCase()}`,'unfurnish',{buildingId,unitId:unit.id,furnitureId:furniture.id});
      }
    }
    if(['council_chamber','townhall'].includes(b.type)&&city.politics.council.members.some(m=>m.citizenId===c.id)){
      add('attend-council','Participar da sessão na Câmara','attend-council');
      for(const bill of city.politics.council.bills.filter(b=>['awaiting-session','proposed','vetoed'].includes(b.status)))for(const yes of [true,false])add(`vote:${bill.id}:${yes}`,`Votar ${yes?'sim':'não'}: ${bill.title}`,'council-vote',{billId:bill.id,yes});
    }
    if(b.type==='townhall'&&c.id===city.economy.mayorId)for(const bill of city.politics.council.bills.filter(b=>b.status==='awaiting-sanction'))for(const [action,label]of [['sanction','Sancionar'],['veto','Vetar']])add(`${action}:${bill.id}`,`${label}: ${bill.title}`,action,{billId:bill.id});
  }
  return choices;
}
