export const OFFICE_BUSINESSES=new Set(['newsroom','research_institute','publisher','bank','builder','carrier','lamp_service','cleaner','clinic','library','clothing_store','thrift_store','pharmacy','sports_shop']);
export const OFFICE_ONLY_TYPES=new Set(['newsroom','research_institute','publisher','bank']);
export function officeSpaceDemand(city){
 const firms=city.economy.businesses,towers=firms.filter(b=>b.type==='office_tower'),vacant=towers.reduce((n,b)=>n+officeFloors(city,b).filter(f=>!f.tenantId&&f.units.length&&f.units.every(u=>u.forRent)).length,0);
 const researchTarget=city.politics.getResearch().demand().required||1;
 const missingFirms=[...OFFICE_ONLY_TYPES].reduce((n,type)=>n+Math.max(0,(type==='research_institute'?researchTarget:1)-firms.filter(b=>b.type===type).length),0);
 const headquarters=city.politics.parties.filter(p=>p.active).length;
 const projects=city.development.projects.filter(p=>p.type==='office_tower'&&!p.cancelled&&p.status!=='completed'),planned=projects.reduce((n,p)=>n+(p.floors||3),0),needed=missingFirms+headquarters;
 return {vacant,planned,needed,missing:Math.max(0,needed-vacant-planned),missingFirms,headquarters};
}
export function ownsOfficeTower(tower,founder){
 if(!tower||!founder||tower.municipal)return false;
 if(tower.equityShares?.length)return (tower.equityShares.find(s=>s.accountId===founder.accountId)?.points||0)>5000;
 return tower.units.length>0&&tower.units.every(u=>u.ownerId===founder.accountId||u.ownerId===tower.accountId&&tower.ownerId===founder.id);
}
export function officeFloors(city,tower){
 const rows=Array.from({length:tower.floors},(_,floor)=>({floor,units:[],tenantId:null,tenant:undefined,rent:0}));
 for(const unit of tower.units){const row=Number.isInteger(unit.z)?rows[unit.z]:null;if(!row)continue;row.units.push(unit);row.rent+=unit.rent;if(!row.tenantId&&unit.occupantId&&unit.occupantId!==tower.accountId)row.tenantId=unit.occupantId;}
 for(const row of rows)row.tenant=city.accounts.get(row.tenantId);
 return rows;
}
// Scoped to one synchronous founding search, which ends on the first lease.
// Do not retain this snapshot across rentals, ownership changes or later ticks.
export function prepareOfficeSearch(city){
 const towers=city.economy.businesses.filter(b=>b.type==='office_tower'),floors=new Map(towers.map(t=>[t.id,officeFloors(city,t)])),vacantFloors=new Map(towers.map(t=>[t.id,floors.get(t.id).filter(f=>!f.tenantId&&f.units.every(u=>u.forRent))]));
 return {towers,floors,vacantFloors,ownership:new Map(),vacant:towers.reduce((n,t)=>n+vacantFloors.get(t.id).length,0),reserved:city.politics.parties.filter(p=>p.active&&p.headquarters?.kind!=='office').length};
}
function searchOwnsOffice(tower,founder,search){
 if(!search)return ownsOfficeTower(tower,founder);
 let owned=search.ownership.get(founder.accountId);if(!owned)search.ownership.set(founder.accountId,owned=new Map());
 if(!owned.has(tower.id))owned.set(tower.id,ownsOfficeTower(tower,founder));return owned.get(tower.id);
}
export function setupOfficeTower(city,tower){if(tower.type!=='office_tower')return;for(const u of tower.units){if(u.occupantId&&u.occupantId!==tower.accountId)continue;u.occupantId=null;u.tenantId=null;u.forSale=false;u.forRent=true;}tower.officeLeases??=[];}
export function officeStartupCost(city,founder,search=null){let best=Infinity;for(const tower of search?.towers||city.economy.businesses)if(tower.type==='office_tower')for(const floor of search?.vacantFloors.get(tower.id)||officeFloors(city,tower))if(floor.units.length&&(search||!floor.tenantId&&floor.units.every(u=>u.forRent)))best=Math.min(best,city.currency.price(20000)+(searchOwnsOffice(tower,founder,search)?0:Math.max(city.currency.price(100),floor.rent)));return best;}
export function createMunicipalOffice(city,tower,floor,type,budget=0){
 const spec=city.buildingTypes[type],row=officeFloors(city,tower).find(r=>r.floor===floor);if(!tower?.active||tower.type!=='office_tower'||!OFFICE_BUSINESSES.has(type)||!spec||!row||row.tenantId||!row.units.length||!row.units.every(u=>u.forRent))return null;
 const entity=city.createEntity({x:tower.entity.x,y:tower.entity.y,properties:{name:city.life.buildingName(spec.label),species:'city-building',render:{color:spec.color,style:type}}});
 const b={id:entity.id,entity,type,constructionKind:'building',rotation:tower.rotation,width:tower.width,depth:tower.depth,floors:tower.floors,color:spec.color,condition:100,units:[],balance:0,jobs:spec.jobs||2,wage:5,stock:0,workers:[],terrain:tower.terrain,door:{...tower.door},accessPath:tower.accessPath,officeTenantOf:tower.id,officeFloor:floor};
 city.reputation.setup(b);city.economy.setupBuilding(b);b.accountId=`business:${b.id}`;entity.properties.cityBuilding=b;city.accounts.set(b.accountId,b);city.buildings.push(b);city.buildingsById.set(b.id,b);
 for(const source of row.units){const u={...source,id:`office:${b.id}:${source.x}:${source.y}:${floor}`,buildingId:b.id,ownerId:tower.accountId,tenantId:null,occupantId:b.accountId,rent:0,price:0,forSale:false,forRent:false,homeId:null,activityReservedIds:[]};b.units.push(u);city.units.set(u.id,u);source.occupantId=b.accountId;source.forRent=false;}
 city.economy.activateMunicipalBusiness(b,budget);const lease={buildingId:b.id,floor,rent:0,ownerOccupied:true,startedAt:city.minute,lastPaidAt:city.minute,arrears:0,missedDays:0,status:'active'};tower.officeLeases??=[];tower.officeLeases.push(lease);b.officeLease=lease;
 city.sanitation.setupBuilding(b);city.sanitation.setupBusinessRooms(b);for(const u of b.units){const original=row.units.find(x=>x.x===u.x&&x.y===u.y);if(original)original.roomType=u.roomType;}tower.layoutRevision=(tower.layoutRevision||0)+1;city.structureRevision++;return b;
}
export function rentOffice(city,towerId,floor,type,founderId){
 const tower=city.building(towerId),founder=city.society.citizen(founderId),spec=city.buildingTypes[type];
 if(!tower?.active||tower.entity.destroyed||tower.type!=='office_tower'||!OFFICE_BUSINESSES.has(type)||!founder||!city.politics.canOwnBusiness(founder)||!spec)return city.fail('Empresarial, atividade ou responsável indisponível.');
 const row=officeFloors(city,tower).find(f=>f.floor===floor);if(!row||row.tenantId||!row.units.length||!row.units.every(u=>u.forRent))return city.fail('Andar indisponível para locação.');
 const own=ownsOfficeTower(tower,founder),rent=own?0:Math.max(city.currency.price(100),row.rent),capital=city.currency.price(20000);if(founder.balance<rent+capital)return city.fail('Saldo insuficiente para primeiro aluguel e capital de operação.');
 const entity=city.createEntity({x:tower.entity.x,y:tower.entity.y,properties:{name:city.life.buildingName(spec.label),species:'city-building',render:{color:spec.color,style:type}}});
 const b={id:entity.id,entity,type,constructionKind:'building',rotation:tower.rotation,width:tower.width,depth:tower.depth,floors:tower.floors,color:spec.color,condition:100,units:[],balance:0,jobs:spec.jobs||2,wage:5,stock:0,workers:[],terrain:tower.terrain,door:{...tower.door},accessPath:tower.accessPath,officeTenantOf:tower.id,officeFloor:floor};
 city.reputation.setup(b);city.economy.setupBuilding(b);b.accountId=`business:${b.id}`;entity.properties.cityBuilding=b;city.accounts.set(b.accountId,b);city.buildings.push(b);city.buildingsById.set(b.id,b);
 for(const source of row.units){const u={...source,id:`office:${b.id}:${source.x}:${source.y}:${floor}`,buildingId:b.id,ownerId:tower.accountId,tenantId:null,occupantId:b.accountId,rent:0,price:0,forSale:false,forRent:false,homeId:null,activityReservedIds:[]};b.units.push(u);city.units.set(u.id,u);source.occupantId=b.accountId;source.forRent=false;}
 if(rent)city.transfer(founder.accountId,tower.accountId,rent,'Primeiro aluguel empresarial',{buildingId:tower.id,tenantBuildingId:b.id,floor});if(rent)city.recordBusinessRevenue(tower,rent);city.economy.activateBusiness(b,founder,null,true);
 const lease={buildingId:b.id,floor,rent,ownerOccupied:own,startedAt:city.minute,lastPaidAt:city.minute,arrears:0,missedDays:0,status:'active'};tower.officeLeases??=[];tower.officeLeases.push(lease);b.officeLease=lease;city.sanitation.setupBuilding(b);city.sanitation.setupBusinessRooms(b);for(const u of b.units){const original=row.units.find(x=>x.x===u.x&&x.y===u.y);if(original)original.roomType=u.roomType;}tower.layoutRevision=(tower.layoutRevision||0)+1;city.structureRevision++;
 city.log(`${b.entity.properties.name} ${own?'ocupou seu próprio':'alugou o'} ${floor+1}º andar de ${tower.entity.properties.name}.`,'business',[founder.id],{kind:'office-lease',buildingId:tower.id,tenantBuildingId:b.id,floor,rent,ownerOccupied:own});return b;
}
export function rentAvailableOffice(city,type,founder,{ownOnly=false,search=null}={}){
 if(!OFFICE_BUSINESSES.has(type))return null;
 const towers=(search?.towers||city.economy.businesses).filter(b=>b.type==='office_tower'&&(!ownOnly||searchOwnsOffice(b,founder,search))).sort((a,b)=>Number(searchOwnsOffice(b,founder,search))-Number(searchOwnsOffice(a,founder,search)));
 // Keep enough vacant floors for parties that still have only a provisional
 // town-hall desk. Otherwise ordinary firms can consume every initial seat.
 const vacant=search&&!ownOnly?search.vacant:towers.reduce((n,b)=>n+(search?search.vacantFloors.get(b.id).length:officeFloors(city,b).filter(f=>!f.tenantId&&f.units.every(u=>u.forRent)).length),0),reserved=search?.reserved??city.politics.parties.filter(p=>p.active&&p.headquarters?.kind!=='office').length;
 if(vacant<=reserved)return null;
 for(const tower of towers)for(const floor of search?.vacantFloors.get(tower.id)||officeFloors(city,tower))if((search||!floor.tenantId&&floor.units.every(u=>u.forRent))&&founder.balance>=(searchOwnsOffice(tower,founder,search)?0:Math.max(city.currency.price(100),floor.rent))+city.currency.price(20000)){const b=rentOffice(city,tower.id,floor.floor,type,founder.id);if(b)return b;}
 return null;
}
export function collectOfficeRents(city){
 for(const tower of city.buildings.filter(b=>b.type==='office_tower'&&!b.entity.destroyed))for(const lease of tower.officeLeases||[]){if(lease.status!=='active'||lease.lastPaidAt===city.minute)continue;const firm=city.building(lease.buildingId);if(!firm?.active||firm.entity.destroyed){endOfficeLease(city,tower,lease,'Empresa encerrada');continue;}const amount=lease.rent+lease.arrears;if(city.transfer(firm.accountId,tower.accountId,amount,'Aluguel empresarial',{buildingId:tower.id,tenantBuildingId:firm.id,floor:lease.floor})){firm.totalExpenses+=amount;city.recordBusinessRevenue(tower,amount);lease.arrears=0;lease.missedDays=0;lease.lastPaidAt=city.minute;}else{lease.arrears+=lease.rent;lease.missedDays++;if(lease.missedDays>=3)endOfficeLease(city,tower,lease,'Despejo por falta de pagamento');}}
}
export function endOfficeLease(city,tower,lease,reason){
 if(lease.status!=='active')return;lease.status='ended';lease.endedAt=city.minute;lease.reason=reason;const b=city.building(lease.buildingId);
 for(const u of tower.units.filter(u=>u.z===lease.floor&&u.occupantId===b?.accountId)){u.occupantId=null;u.forRent=true;}
 if(b){for(const shipment of city.logistics.shipments)if(shipment.seller===b||shipment.buyer===b)city.logistics.cancel(shipment);for(const c of city.citizens)if(c.targetId===b.id){c.task=null;c.targetId=null;c.path=[];}const recipient=city.society.citizen(b.ownerId)?.accountId||'treasury';if(b.balance>0)city.transfer(b.accountId,recipient,b.balance,'Liquidação de empresa locatária',{buildingId:b.id});for(const [good,quantity] of Object.entries(b.inventory||{})){if(quantity>0){city.economy.lost[good]=(city.economy.lost[good]||0)+quantity;city.publications.loseStock(b,good,quantity);city.vehicles.loseStock(b,good,quantity);b.inventory[good]=0;}}for(const id of [...b.workers]){const c=city.society.citizen(id);if(c)city.economy.leaveJob(c,reason);}const owner=city.society.citizen(b.ownerId);if(owner)owner.businessIds=owner.businessIds.filter(id=>id!==b.id);b.active=false;b.entity.destroyed=true;}
 city.log(`${tower.entity.properties.name}: ${reason}.`,'business',[],{kind:'office-lease-ended',buildingId:tower.id,tenantBuildingId:lease.buildingId,floor:lease.floor});
}
