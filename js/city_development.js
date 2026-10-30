import {businessFloors,businessJobCapacity} from './city_business_heights.js';
import {setupOfficeTower} from './city_offices.js?v=office-demand-rollout-1';
import {OFFICE_ONLY_TYPES} from './city_offices.js?v=office-demand-rollout-1';
import {outdoorCellReady,activityRoomReady,finishBuildingOccupants} from './city_interiors.js?v=service-capacity-3';
import {findPublicBuildingSite,acquirePublicBuildingSite} from './city_public_land.js';
import {INDUSTRIES} from './city_industries.js';
import {MIN_PLOT_CELLS} from './city_building_geometry.js';
import { chooseBuildingSite, inspectBuildingSite, findTerrainPath, flatSiteLevel, tileAt, tileHeight, canStep, ROAD_TILES, PAVED_ROAD_TILES, DIRT_ROAD_TILES, pavePath, roadFor, wearRoad, isRoadAt } from './city_terrain.js?v=housing-work-priority-1';
import { initializeInventory, inventoryFree } from './city_inventory.js';

const constructionDispatch = new WeakMap();
export const DEVELOPMENT_RULES = { landPerCell: 4000, stonePerCell: 2, laborPerCell: 3, constructionFeePerCell: 12000, roadStonePerTile: 1, roadLaborPerTile: 2, roadFeePerTile: 8000, bridgeStonePerTile:4,bridgeLaborPerTile:6,bridgeFeePerTile:40000,bridgeHeight:.8,municipalMultiplier: 1.5, wearInterval: 30 * 1440, repairThreshold: 60 };
export class CityDevelopment {
  constructor(city) { this.city = city; this.plots = []; this.projects = []; this.nextPlotId = 1; this.nextProjectId = 1; }
  publicBuildingSite(type,options={}){return findPublicBuildingSite(this,type,options);}
  acquirePublicSite(site){return acquirePublicBuildingSite(this,site);}
  clientCitizen(accountId) { return accountId === 'treasury' ? this.city.economy.citizen(this.city.economy.mayorId) : this.ownerCitizen(accountId); }
  selectBuilder(clientId, door, builderId = null, {allowTerrainAccess=false}={}) {
    const candidates=this.city.economy.businesses.filter(b => b.type === 'builder' && (!builderId || b.id === builderId) && b.accountId !== clientId && (this.city.economy.connected(b, { id: `site:${door.x}:${door.y}`, door }) || allowTerrainAccess&&findTerrainPath(this.city.world,b.door,door,this.city.occupied)!==null));
    if(candidates.length<2)return candidates[0]||null;
    // A comparator can run dozens of times: count the project backlog once,
    // rather than scanning every project twice for every pair of contractors.
    const loads=new Map();for(const p of this.projects)if(!p.cancelled&&p.status!=='completed')loads.set(p.builderId,(loads.get(p.builderId)||0)+1);
    return candidates.sort((a,b)=>(clientId==='treasury'?Number(b.favorUntil>this.city.minute&&b.favoredBy===this.city.economy.mayorId)-Number(a.favorUntil>this.city.minute&&a.favoredBy===this.city.economy.mayorId):0)||(loads.get(a.id)||0)-(loads.get(b.id)||0)||this.city.reputation.providerPenalty(a)-this.city.reputation.providerPenalty(b)||a.id-b.id)[0]||null;
  }
  serviceOffers(builderId) {
    const b = this.city.building(builderId);
    if (!b?.active || b.type !== 'builder') return [];
    return [{ service: 'building', label: 'Empreendimento sob medida', feePerCell: this.city.currency.price(DEVELOPMENT_RULES.constructionFeePerCell) }, { service: 'road', label: 'Construção de estrada', feePerCell: this.city.currency.price(DEVELOPMENT_RULES.roadFeePerTile) }, { service:'bridge',label:'Ponte sobre água',feePerCell:this.city.currency.price(DEVELOPMENT_RULES.bridgeFeePerTile) }, { service: 'expansion', label: 'Ampliação de edifício', feePerCell: this.city.currency.price(DEVELOPMENT_RULES.constructionFeePerCell) }];
  }
  registerService(accountId, builder, details) {
    const city = this.city, owner = this.clientCitizen(accountId);
    if (!owner || !builder || !Number.isSafeInteger(details.stone) || details.stone < 1) return null;
    const project = { id: `project:${this.nextProjectId++}`, accountId, ownerId: owner.id, builderId: builder.id, active: true, status: 'materials', startedAt: city.minute, cancelled: false, labor: 0, plotId: null, ...details };
    const priority=city.politics?.policy?.infrastructurePriority;
    if(accountId==='treasury' && (priority==='lamps' && project.service==='lamp'||priority==='roads' && ['road','bridge','road-repair'].includes(project.service))){project.politicalPriority=project.priority||0;project.priority=project.politicalPriority+50;}
    initializeInventory(project, city.economy.goods, project.stone + 48);
    project.feeAccountId = `construction-fee:${project.id}`;
    city.accounts.set(project.feeAccountId, { name: `Contrato ${project.id}`, balance: 0 });
    const ordinaryFee = project.fee;
    project.fee = accountId === 'treasury' ? Math.ceil(ordinaryFee * DEVELOPMENT_RULES.municipalMultiplier) : ordinaryFee;
    const materialCost = details.stone * city.economy.goods.pedra.price;
    project.requiredBudget = project.fee + materialCost;
    const ordinaryMaterialCost = materialCost;
    if ((city.accounts.get(accountId)?.balance || 0) < project.fee + ordinaryMaterialCost) { city.accounts.delete(project.feeAccountId); return null; }
    if (!city.transfer(accountId, project.feeAccountId, project.fee, 'Reserva do serviço de construção', {projectId:project.id})) { city.accounts.delete(project.feeAccountId); return null; }
    this.projects.push(project);
    city.log(`${city.accountName(accountId)} contratou ${builder.entity.properties.name}: ${project.name}.`, 'construction', [owner.id, builder.ownerId].filter(Boolean), { kind: 'service-contracted', projectId: project.id, service: project.service, fee: project.fee, buildingIds:[builder.id], accounts:[accountId,builder.accountId] });
    return project;
  }
  roadAccessTiles(){
    const allowed=new Set();
    for(const b of this.city.buildings)if(!b.entity.destroyed)for(const p of b.accessPath||[]){const x=Math.floor(p.x),y=Math.floor(p.y);if(!this.city.occupied.has(`${x},${y}`))allowed.add(`${x},${y}`);}
    const blocked=allowed.blockedPlots=new Set();
    for(const p of this.plots)for(let y=p.y;y<p.y+p.depth;y++)for(let x=p.x;x<p.x+p.width;x++){const k=`${x},${y}`;if(!allowed.has(k))blocked.add(k);}
    return allowed;
  }
  roadPlotBlocked(x,y,access){return access.blockedPlots?access.blockedPlots.has(`${x},${y}`):this.plots.some(p=>x>=p.x&&y>=p.y&&x<p.x+p.width&&y<p.y+p.depth)&&!access.has(`${x},${y}`);}
  beginRoad(accountId, start, end, { builderId = null,maxTiles=Infinity,priority=0 } = {}) {
    const city=this.city;
    if(!start||!end||![start.x,start.y,end.x,end.y].every(Number.isFinite)||!(maxTiles>0))return null;
    const access=this.roadAccessTiles();
    const path=findTerrainPath(city.world,start,end,city.occupied,{extraBlocked:(x,y)=>this.roadPlotBlocked(x,y,access)});if(path===null)return null;
    const full=[{x:Math.floor(start.x)+.5,y:Math.floor(start.y)+.5},...path];
    const indexes=full.map((p,i)=>!isRoadAt(city.world,Math.floor(p.x),Math.floor(p.y))?i:-1).filter(i=>i>=0).slice(0,maxTiles);
    if(!indexes.length)return null;
    const last=indexes.at(-1),next=full[last+1],includeNext=next&&isRoadAt(city.world,Math.floor(next.x),Math.floor(next.y));
    const route=full.slice(Math.max(0,indexes[0]-1),last+1+(includeNext?1:0)),tiles=route.filter(p=>!isRoadAt(city.world,Math.floor(p.x),Math.floor(p.y)));
    if(tiles.some(p=>this.roadPlotBlocked(Math.floor(p.x),Math.floor(p.y),access))||this.projects.some(p=>p.service==='road'&&!p.cancelled&&p.status!=='completed'&&p.status!=='blocked'&&p.path.some(t=>tiles.some(n=>n.x===t.x&&n.y===t.y))))return null;
    const builder=this.selectBuilder(accountId,tiles[0],builderId,{allowTerrainAccess:true});
    const project=this.registerService(accountId,builder,{service:'road',type:'road',name:`Estrada de ${tiles.length} células`,path:tiles,route,plotAccessTiles:route.filter(p=>access.has(`${Math.floor(p.x)},${Math.floor(p.y)}`)).map(p=>`${Math.floor(p.x)},${Math.floor(p.y)}`),door:{...tiles[0]},priority,stone:tiles.length*DEVELOPMENT_RULES.roadStonePerTile,requiredLabor:tiles.length*DEVELOPMENT_RULES.roadLaborPerTile,fee:tiles.length*city.currency.price(DEVELOPMENT_RULES.roadFeePerTile)});
    if(project){project.requiredBudget=project.fee+project.stone*city.economy.goods.pedra.price;project.targetDoor={...end};}
    return project;
  }
  beginBridge(accountId,start,end,{builderId=null,priority=0}={}){
    const city=this.city,world=city.world;if(!start||!end||![start.x,start.y,end.x,end.y].every(Number.isFinite))return null;
    const sx=Math.floor(start.x),sy=Math.floor(start.y),ex=Math.floor(end.x),ey=Math.floor(end.y),horizontal=sy===ey,vertical=sx===ex;if(horizontal===vertical)return null;
    const dx=Math.sign(ex-sx),dy=Math.sign(ey-sy),span=Math.abs(ex-sx)+Math.abs(ey-sy),maxSpan=Math.min(96,Math.max(world.width,world.height)-2);if(span<3||span>maxSpan)return null;
    const access=this.roadAccessTiles(),tiles=[],route=[{x:sx+.5,y:sy+.5}];let x=sx+dx,y=sy+dy;
    while(x!==ex||y!==ey){if(x<0||y<0||x>=world.width||y>=world.height||tileAt(world,x,y)!==2||world.bridgeTiles?.has(`${x},${y}`)||city.occupied.has(`${x},${y}`)||this.roadPlotBlocked(x,y,access))return null;tiles.push({x,y});route.push({x:x+.5,y:y+.5});x+=dx;y+=dy;}
    if(!tiles.length||tileAt(world,sx,sy)===2||tileAt(world,ex,ey)===2||city.occupied.has(`${sx},${sy}`)||city.occupied.has(`${ex},${ey}`))return null;
    const height=DEVELOPMENT_RULES.bridgeHeight;if(Math.abs(tileHeight(tileAt(world,sx,sy))-height)>1.25||Math.abs(tileHeight(tileAt(world,ex,ey))-height)>1.25)return null;
    const waterKeys=new Set(tiles.map(p=>`${p.x},${p.y}`)),duplicate=this.projects.some(p=>p.service==='bridge'&&!p.cancelled&&p.status!=='completed'&&(p.path||[]).some(t=>waterKeys.has(`${Math.floor(t.x)},${Math.floor(t.y)}`)));if(duplicate)return null;
    const builder=this.selectBuilder(accountId,{x:sx+.5,y:sy+.5},builderId,{allowTerrainAccess:true});if(builderId&&!builder)return null;
    const stone=tiles.length*DEVELOPMENT_RULES.bridgeStonePerTile,fee=tiles.length*city.currency.price(DEVELOPMENT_RULES.bridgeFeePerTile),project=this.registerService(accountId,builder,{service:'bridge',type:'road',name:`Ponte de ${tiles.length} células`,axis:horizontal?'x':'y',height,bridgeStart:{x:sx,y:sy},bridgeEnd:{x:ex,y:ey},path:tiles.map(p=>({x:p.x+.5,y:p.y+.5})),route,door:{x:sx+.5,y:sy+.5},priority,stone,requiredLabor:tiles.length*DEVELOPMENT_RULES.bridgeLaborPerTile,fee});
    if(project)project.requiredBudget=project.fee+stone*city.economy.goods.pedra.price;
    return project;
  }
  beginExpansion(accountId, buildingId, { floors = 1, builderId = null } = {}) {
    const b = this.city.building(buildingId);
    if (!b || b.constructionKind !== 'building' || !Number.isInteger(floors) || floors < 1 || b.floors + floors > 12 || !b.units.every(u => u.ownerId === accountId) || this.projects.some(p => p.buildingId === buildingId && p.service === 'expansion' && !p.cancelled && p.status !== 'completed')) return null;
    const builder = this.selectBuilder(accountId, b.door, builderId), cells = b.width * b.depth * floors;
    const project = this.registerService(accountId, builder, { service: 'expansion', type: b.type, name: `Ampliação de ${b.entity.properties.name}`, buildingId, plotId: b.plotId, baseFloors: b.floors, floors, targetFloors: b.floors + floors, door: { ...b.door }, stone: cells * DEVELOPMENT_RULES.stonePerCell, requiredLabor: cells * DEVELOPMENT_RULES.laborPerCell, fee: cells * this.city.currency.price(DEVELOPMENT_RULES.constructionFeePerCell) });
    const lot = this.plots.find(p => p.id === b.plotId); if (project && lot) lot.projectId = project.id;
    return project;
  }
  completeService(project) {
    const city = this.city;
    if (project.status === 'completed' || project.cancelled || project.inventory.pedra < project.stone || project.labor < project.requiredLabor) return null;
    let result;
    if (project.service === 'lamp') {
      result = city.lighting.completePost(project);
      if (!result) { project.status = 'blocked'; project.error = 'Local do poste indisponível.'; return null; }
    } else if (project.service === 'bridge') {
      const route=project.route||[],water=route.slice(1,-1),start=route[0],end=route.at(-1),sx=Math.floor(start?.x),sy=Math.floor(start?.y),ex=Math.floor(end?.x),ey=Math.floor(end?.y);
      if(!start||!end||!(sx===ex||sy===ey)||water.length!==project.path.length||water.some(p=>tileAt(city.world,Math.floor(p.x),Math.floor(p.y))!==2||city.world.bridgeTiles?.has(`${Math.floor(p.x)},${Math.floor(p.y)}`)||city.occupied.has(`${Math.floor(p.x)},${Math.floor(p.y)}`))||tileAt(city.world,sx,sy)===2||tileAt(city.world,ex,ey)===2){project.status='blocked';project.error='O vão da ponte deixou de ser uma travessia reta e livre sobre água.';return null;}
      const bridge={id:`bridge:${project.id}`,axis:project.axis,height:project.height||DEVELOPMENT_RULES.bridgeHeight,tiles:project.path.map(p=>({x:Math.floor(p.x),y:Math.floor(p.y)})),start:{x:sx,y:sy},end:{x:ex,y:ey},projectId:project.id};
      city.world.roadBridges??=[];city.world.bridgeTiles??=new Map();city.world.roadBridges.push(bridge);for(const tile of bridge.tiles)city.world.bridgeTiles.set(`${tile.x},${tile.y}`,{id:bridge.id,height:bridge.height});city.world.bridgeRevision=(city.world.bridgeRevision||0)+1;city.world.topologyRevision=(city.world.topologyRevision||0)+1;city.world.revision=(city.world.revision||0)+1;result=project;
    } else if (project.service === 'road' || project.service === 'road-repair') {
      const access=new Set([...(project.plotAccessTiles||[]),...this.roadAccessTiles()]);
      if (project.route.some(t => this.roadPlotBlocked(Math.floor(t.x),Math.floor(t.y),access)) || project.route.some(p => !city.walkable(Math.floor(p.x), Math.floor(p.y))) || project.route.some((p, i, route) => i && !canStep(city.world, Math.floor(route[i - 1].x), Math.floor(route[i - 1].y), Math.floor(p.x), Math.floor(p.y)))) { project.status = 'blocked'; project.error = 'Trajeto deixou de ser acessível.'; return null; }
      pavePath(city.world, project.route); result = project;
      if (project.service === 'road-repair') for (const p of project.route) { const x = Math.floor(p.x), y = Math.floor(p.y), tile = tileAt(city.world, x, y); if (ROAD_TILES.has(tile)) { city.world.setTile(x, y, roadFor(tile)); city.world.roadCondition?.set(`${x},${y}`, 100); } }
      if (project.service === 'road') project.service = 'road';
    } else {
      const b = city.building(project.buildingId);
      if (!b || (project.service === 'expansion' && b.floors !== project.baseFloors)) { project.status = 'blocked'; project.error = 'Edifício foi removido ou alterado durante a obra.'; return null; }
      if (project.service === 'repair') { b.condition = 100; b.repairNeeded = false; }
      else {
      if (project.service === 'expansion') for (let z = b.floors; z < project.targetFloors; z++) city.housing.addFloor(b, z, project.accountId);
      city.sanitation.setupBuilding(b);
      city.sanitation.setupBusinessRooms(b);
      if (project.service === 'expansion') {
      b.floors = project.targetFloors;if(b.type==='office_tower')setupOfficeTower(city,b); b.inventoryCapacity += b.width * b.depth * project.floors * 16;
      if(b.type==='townhall')b.jobs+=project.floors;else b.jobs=Math.min(32,b.jobs+businessJobCapacity(b.type,2,project.targetFloors)-businessJobCapacity(b.type,2,project.baseFloors)); b.geometryRevision = (b.geometryRevision || 0) + 1;
      if(['super_popular_housing','popular_housing','popular_luxury_housing'].includes(b.type)&&project.accountId==='treasury')city.housing.assign();
      }
      }
      const lot = this.plots.find(p => p.id === b.plotId); if (lot) lot.projectId = null;
      result = b;
    }
    project.inventory.pedra -= project.stone; city.economy.consumed.pedra += project.stone;
    city.economy.recordGoods(project.service, 'pedra', project.stone, project.id, project.buildingId || null);
    project.status = 'completed'; project.error = null; project.completedAt = city.minute;
    city.reputation.completed(city.building(project.builderId), null, 'obra concluída', {projectId:project.id});
    city.transfer(project.feeAccountId, city.building(project.builderId)?.accountId || project.accountId, project.fee, 'Serviço de construção', {projectId:project.id});
    const account = city.accounts.get(project.accountId); if (account?.entity?.properties.cityBuilding) account.totalExpenses += project.fee;
    city.history.record('service',`${project.name}: serviço concluído.`,[project.accountId,city.building(project.builderId)?.accountId,city.building(project.buildingId)?.accountId],{amount:project.fee,projectId:project.id,service:project.service,stone:project.stone});
    if(project.materialAccountId){const balance=city.accounts.get(project.materialAccountId)?.balance||0;if(balance)city.transfer(project.materialAccountId,project.accountId,balance,'Devolução da reserva não utilizada da infraestrutura',{projectId:project.id});}
    city.workMeals.closeSite(project, project.service === 'expansion' ? result : null);
    city.log(`${project.name} concluída por ${city.building(project.builderId)?.entity.properties.name || 'construtora'}.`, 'construction', [project.ownerId], { kind: 'service-completed', projectId: project.id, service: project.service, buildingIds:[project.builderId,project.buildingId].filter(id=>id!=null), accounts:[project.accountId] });
    return result;
  }
  planPublicWorks() {
    const city = this.city, hall = city.buildings.find(b => b.type === 'townhall' && !b.entity.destroyed);
    if(hall&&this.clientCitizen('treasury'))city.officialJournal?.ensure();
    if (!hall || !this.clientCitizen('treasury') || city.treasury < city.currency.price(100000)) return;
    this.planBasicHousing();
    const needs=city.welfare.conditions();
    const activePublic = this.projects.filter(p => p.accountId === 'treasury' && !p.cancelled && p.status !== 'completed');
    const targetFloors = Math.min(6, 2 + Math.floor((city.citizens.length + city.economy.businesses.length * 2) / 36));
    if (!needs.crisis && !needs.homeless && city.hour%6===0 && hall.floors < targetFloors && !activePublic.some(p => p.service === 'expansion')) this.beginExpansion('treasury', hall.id);
    const housing = city.buildings.filter(b => ['residential', 'super_popular_housing', 'popular_housing', 'popular_luxury_housing', 'luxury_housing'].includes(b.type)).length;
    if (housing < 1 && !activePublic.some(p => ['residential', 'super_popular_housing', 'popular_housing', 'popular_luxury_housing', 'luxury_housing'].includes(p.type))) {
      const lot = this.plots.find(p => p.ownerId === 'treasury' && !p.projectId && !p.buildingId && p.width >= 3 && p.depth >= 3 && p.width<=8 && p.depth<=8 && !['quarry','farm'].includes(p.type));
      if (lot) this.beginProject('treasury', lot.id, 'super_popular_housing', { floors: 3 });
    }
    if (city.citizens.some(c => c.needs.food < 35) && city.treasury > city.currency.price(500000) && !city.buildings.some(b => b.type === 'popular_refectory') && !activePublic.some(p => p.type === 'popular_refectory')) {
      const lot = this.plots.find(p => p.ownerId === 'treasury' && !p.projectId && !p.buildingId && p.width >= 3 && p.depth >= 3 && p.width<=8 && p.depth<=8 && !['quarry','farm'].includes(p.type));
      if (lot) this.beginProject('treasury', lot.id, 'popular_refectory');
    }
    if (city.stats().homeless >= 5 && !city.buildings.some(b => ['super_popular_housing','popular_housing','popular_luxury_housing'].includes(b.type)) && !this.projects.some(p => ['super_popular_housing','popular_housing','popular_luxury_housing'].includes(p.type) && !p.cancelled && p.status !== 'completed') && city.treasury > city.currency.price(5000000)) {
      const lot = this.plots.find(p => p.ownerId === 'treasury' && !p.projectId && !p.buildingId && p.width >= 3 && p.depth >= 3 && p.width<=8 && p.depth<=8 && !['quarry','farm'].includes(p.type));
      if (lot) this.beginProject('treasury', lot.id, 'super_popular_housing', { floors: 3 });
    }
    if (city.economy.businesses.length >= 5 && city.treasury > city.currency.price(500000) && !city.buildings.some(b => b.type === 'public_toilet') && !this.projects.some(p => p.type === 'public_toilet' && !p.cancelled && p.status !== 'completed')) { const lot = this.plots.find(p => p.ownerId === 'treasury' && !p.projectId && !p.buildingId && p.width >= 3 && p.depth >= 3 && p.width<=8 && p.depth<=8 && !['quarry','farm'].includes(p.type)); if (lot) this.beginProject('treasury', lot.id, 'public_toilet'); }
    this.planRoadNetwork(hall,needs);
    const repairable = city.buildings.filter(b => b.repairNeeded && !this.projects.some(p => p.service === 'repair' && p.buildingId === b.id && p.status !== 'completed' && !p.cancelled));
    if (city.treasury > city.currency.price(500000)) for (const b of repairable) if (this.beginRepair('treasury', b.id)) break;
    const damagedRoad = this.cityRoadNeedsRepair();
    if (damagedRoad.length && city.random() < .01 && city.treasury > city.currency.price(1000000) && !this.projects.some(p => p.service === 'road-repair' && p.status !== 'completed' && !p.cancelled)) this.beginRoadRepair('treasury', damagedRoad.sort((a,b)=>city.trafficScore([b])-city.trafficScore([a])).slice(0, 12));
  }
  planRoadNetwork(hall,needs){
    const city=this.city,pending=this.projects.filter(p=>['road','bridge'].includes(p.service)&&!p.cancelled&&p.status!=='completed'&&p.status!=='blocked');
    if(pending.length>=2){this.roadPlanning={reason:'Duas frentes de rua em execução.',pending:pending.length};return;}
    const perTile=DEVELOPMENT_RULES.roadStonePerTile*city.economy.goods.pedra.price+Math.ceil(city.currency.price(DEVELOPMENT_RULES.roadFeePerTile)*DEVELOPMENT_RULES.municipalMultiplier),margin=city.currency.price(12000);
    const tiles=Math.min(8,Math.floor((city.treasury-needs.reserve-margin)/perTile));
    if(tiles<1){this.roadPlanning={reason:'Caixa aguardando orçamento para trecho de rua, após reserva social.',required:perTile+margin};return;}
    const network=new Map(),queue=[];
    const addRoad=(x,y,origin=false)=>{x=Math.floor(x);y=Math.floor(y);const k=`${x},${y}`;if((!isRoadAt(city.world,x,y)&&!origin)||network.has(k)||!city.walkable(x,y))return;network.set(k,{x:x+.5,y:y+.5});queue.push({x,y});};
    addRoad(hall.door.x,hall.door.y,true);
    for(let head=0;head<queue.length;head++){const {x,y}=queue[head];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])if(canStep(city.world,x,y,x+dx,y+dy))addRoad(x+dx,y+dy);}
    const targets=[...network.values()];
    const buildings=city.buildings.filter(b=>!b.entity.destroyed&&b.id!==hall.id&&!network.has(`${Math.floor(b.door.x)},${Math.floor(b.door.y)}`)).map(b=>({b,traffic:city.trafficScore(b.accessPath||[])}));
    // Busy dirt shortcuts also qualify for paving, even after every door has a paved connection.
    const doors=new Set(buildings.map(({b})=>`${Math.floor(b.door.x)},${Math.floor(b.door.y)}`));
    for(const [key,traffic]of city.traffic)if(traffic>=8&&!doors.has(key)){const [x,y]=key.split(',').map(Number);if(DIRT_ROAD_TILES.has(tileAt(city.world,x,y)))buildings.push({b:{id:`traffic:${key}`,door:{x:x+.5,y:y+.5}},traffic});}
    buildings.sort((a,b)=>b.traffic-a.traffic||String(a.b.id).localeCompare(String(b.b.id),undefined,{numeric:true}));
    if(!targets.length){this.roadPlanning={reason:'Aguardando definição do primeiro trecho conectado à rua da prefeitura.'};return;}
    const offset=(this.roadCursor||0)%Math.max(1,buildings.length),options=buildings.slice(offset).concat(buildings.slice(0,offset)).slice(0,8);
    let attemptedBridge=false;for(const {b} of options){
      let target=targets[0],bestDistance=Infinity;for(const point of targets){const d=(point.x-b.door.x)**2+(point.y-b.door.y)**2;if(d<bestDistance){bestDistance=d;target=point;}}
      const landRoute=findTerrainPath(city.world,target,b.door,city.occupied,{limit:Math.min(12000,Math.max(3000,bestDistance*12))});
      if(!attemptedBridge&&landRoute&&landRoute.length>Math.max(18,Math.sqrt(bestDistance)*1.8)){
        attemptedBridge=true;
        const bridgeProject=this.planBridgeShortcut(targets,b.door,landRoute.length);
        if(bridgeProject){const id=`materials:${bridgeProject.id}`,budget=bridgeProject.stone*city.economy.goods.pedra.price+margin;city.accounts.set(id,{name:`Materiais de ${bridgeProject.name}`,balance:0});if(city.transfer('treasury',id,budget,'Reserva de pedras e frete para ponte',{projectId:bridgeProject.id}))bridgeProject.materialAccountId=id;else city.accounts.delete(id);this.roadPlanning={reason:'Ponte reta priorizada para encurtar o desvio pela água.',projectId:bridgeProject.id,buildingId:b.id};return;}
      }
      const project=this.beginRoad('treasury',target,b.door,{maxTiles:tiles,priority:110});
      if(!project)continue;
      const id=`materials:${project.id}`,budget=project.stone*city.economy.goods.pedra.price+margin;
      city.accounts.set(id,{name:`Materiais de ${project.name}`,balance:0});
      if(city.transfer('treasury',id,budget,'Reserva de pedras e frete para rua',{projectId:project.id}))project.materialAccountId=id;else city.accounts.delete(id);
      this.roadPlanning={reason:'Trecho priorizado por circulação, com materiais financiados.',projectId:project.id,buildingId:b.id};return;
    }
    this.roadCursor=offset+options.length;this.roadPlanning={reason:'Procurando acesso com trecho ainda sem pavimentação.'};
  }
  planBridgeShortcut(network,goal,detourLength){
    const city=this.city,world=city.world,starts=network.slice().sort((a,b)=>(a.x-goal.x)**2+(a.y-goal.y)**2-((b.x-goal.x)**2+(b.y-goal.y)**2)).slice(0,20),candidates=[];
    for(const start of starts){const sx=Math.floor(start.x),sy=Math.floor(start.y);if(!isRoadAt(world,sx,sy))continue;
      for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){let x=sx,y=sy,shoreDistance=0;while(shoreDistance<8){const nx=x+dx,ny=y+dy;if(tileAt(world,nx,ny)===2)break;if(!city.walkable(nx,ny))break;x=nx;y=ny;shoreDistance++;}if(tileAt(world,x+dx,y+dy)!==2)continue;const bank={x,y},water=[];x+=dx;y+=dy;
        while(x>=0&&y>=0&&x<world.width&&y<world.height&&tileAt(world,x,y)===2&&water.length<96){water.push({x,y});x+=dx;y+=dy;}
        if(water.length<2||water.length>96||x<0||y<0||x>=world.width||y>=world.height)continue;
        const end={x:x+.5,y:y+.5};candidates.push({start:{x:bank.x+.5,y:bank.y+.5},end,waterLength:water.length,shoreDistance});
      }
    }
    candidates.sort((a,b)=>a.waterLength+a.shoreDistance+Math.hypot(a.end.x-goal.x,a.end.y-goal.y)-(b.waterLength+b.shoreDistance+Math.hypot(b.end.x-goal.x,b.end.y-goal.y)));
    for(const candidate of candidates.slice(0,6)){const access=findTerrainPath(world,candidate.end,goal,city.occupied,{limit:5000});if(!access)continue;const estimate=candidate.waterLength+candidate.shoreDistance+access.length;if(estimate>=detourLength*.78||detourLength-estimate<12)continue;const project=this.beginBridge('treasury',candidate.start,candidate.end,{priority:125});if(project)return project;}
    return null;
  }
  planBasicHousing() {
    const city=this.city,needs=city.welfare.conditions(),pending=this.projects.filter(p=>!p.cancelled&&p.status!=='completed');
    const vacant=[...city.housing.homes.values()].filter(h=>city.housing.isSocial(h)&&city.housing.hasBathroom(h)&&city.housing.units(h).some(u=>u.roomType==='bedroom')&&city.housing.units(h).every(u=>!u.tenantId)&&!city.housing.residents(h).length).length;
    const queued=pending.filter(p=>['super_popular_housing','popular_housing','popular_luxury_housing'].includes(p.type)&&p.service==='building');
    const expansions=pending.filter(p=>['super_popular_housing','popular_housing','popular_luxury_housing'].includes(p.type)&&p.service==='expansion');
    const planned=[...queued,...expansions].reduce((n,p)=>{const b=city.building(p.buildingId),perimeter=Math.max(0,2*(p.width??b?.width??0)+2*(p.depth??b?.depth??0)-4),floors=p.floors||0;if(p.type==='popular_luxury_housing')return n+floors;if(p.type==='popular_housing')return n+Math.max(0,perimeter-1)*floors;return n+Math.max(0,perimeter*floors-(p.service==='building'?1:0));},0);
    // With emergency housing on a short construction milestone, several
    // funded sites can advance together instead of leaving hundreds unhoused.
    const limit=Math.max(2,Math.min(8,Math.ceil(needs.homeless/64)));
    if(needs.homeless<=vacant+planned || queued.length+expansions.length>=limit)return;
    const expandable=city.buildings.filter(b=>['super_popular_housing','popular_housing','popular_luxury_housing'].includes(b.type)&&!b.entity.destroyed&&b.floors<12&&b.units.every(u=>u.ownerId==='treasury')&&!pending.some(p=>p.buildingId===b.id));
    expandable.sort((a,b)=>a.floors-b.floors||a.id-b.id);
    for(const b of expandable){
      const perimeter=2*b.width+2*b.depth-4,perFloor=b.type==='popular_luxury_housing'?1:Math.max(1,perimeter-(b.type==='popular_housing'?1:0)),floors=Math.min(2,12-b.floors,Math.ceil((needs.homeless-vacant-planned)/perFloor));
      const cells=b.width*b.depth*floors,cost=cells*DEVELOPMENT_RULES.stonePerCell*city.economy.goods.pedra.price+Math.ceil(cells*city.currency.price(DEVELOPMENT_RULES.constructionFeePerCell)*DEVELOPMENT_RULES.municipalMultiplier);
      if(city.treasury<cost+needs.reserve)continue;
      const project=this.beginExpansion('treasury',b.id,{floors});if(project){project.priority=needs.homeless>needs.population*.3?150:100;return;}
    }
    const lots=this.plots.filter(p=>p.ownerId==='treasury'&&!p.projectId&&!p.buildingId&&!['farm','quarry'].includes(p.type)&&p.width>=3&&p.depth>=3).sort((a,b)=>Math.hypot(a.x-city.spawn.x,a.y-city.spawn.y)-Math.hypot(b.x-city.spawn.x,b.y-city.spawn.y));
    for(const lot of lots.slice(0,8)){
      const width=Math.min(5,lot.width),depth=Math.min(5,lot.depth),cells=width*depth*4,cost=cells*DEVELOPMENT_RULES.stonePerCell*city.economy.goods.pedra.price+Math.ceil(cells*city.currency.price(DEVELOPMENT_RULES.constructionFeePerCell)*1.5);
      if(city.treasury<cost+needs.reserve)continue;
      const project=this.beginProject('treasury',lot.id,needs.homeless>needs.population*.5?'super_popular_housing':'popular_housing',{width,depth,floors:4,priority:needs.homeless>needs.population*.3?150:95});if(project)break;
    }
  }
  cityRoadNeedsRepair() {
    const out = [];
    for (const [key, condition] of this.city.world.roadCondition || []) {
      if (condition > DEVELOPMENT_RULES.repairThreshold) continue;
      const [x, y] = key.split(',').map(Number);
      if (PAVED_ROAD_TILES.has(tileAt(this.city.world, x, y))) out.push({ x: x + .5, y: y + .5 });
    }
    return out;
  }
  beginRepair(accountId, buildingId, {preventive=false}={}) {
    const b = this.city.building(buildingId);
    if (!b || !b.repairNeeded&&(!preventive||(b.condition??100)>=95)) return null;
    const cells = b.width * b.depth, builder = this.selectBuilder(accountId, b.door);
    return this.registerService(accountId, builder, { service: 'repair', type: b.type, name: `Reparo de ${b.entity.properties.name}`, buildingId, plotId: b.plotId, door: { ...b.door }, stone: Math.max(2, Math.ceil(cells * .25)), requiredLabor: Math.max(4, Math.ceil(cells * .75)), fee: cells * this.city.currency.price(2500) });
  }
  beginRoadRepair(accountId, path, { builderId = null } = {}) {
    if (!path?.length) return null;
    const builder = this.selectBuilder(accountId, path[0], builderId);
    return this.registerService(accountId, builder, { service: 'road-repair', type: 'road', name: `Reparo de ${path.length} trechos de estrada`, path, route: path, door: { ...path[0] }, stone: path.length, requiredLabor: path.length * DEVELOPMENT_RULES.roadLaborPerTile, fee: path.length * this.city.currency.price(2500) });
  }
  homeCount(buildingId) { return [...this.city.housing.homes.values()].filter(h => h.buildingId === buildingId).length; }
  updateWear() {
    const city = this.city;
    if (city.minute % DEVELOPMENT_RULES.wearInterval !== 0) return;
    for (const b of city.buildings.filter(b => !b.entity.destroyed)) {
      b.condition = Math.max(0, (b.condition ?? 100) - (b.constructionKind === 'open-air' ? 2 : 1));
      b.repairNeeded = b.condition <= DEVELOPMENT_RULES.repairThreshold;
    }
    if (city.world.map) for (let y = 0; y < city.world.height; y++) for (let x = 0; x < city.world.width; x++) {
      const tile = tileAt(city.world, x, y);
      if (PAVED_ROAD_TILES.has(tile) && city.random() < .015) wearRoad(city.world,x,y,10);
    }
  }
  ownerCitizen(accountId) {
    const account = this.city.accounts.get(accountId);
    if (account?.entity?.destroyed) return null;
    if (account?.municipal) return this.city.economy.citizen(this.city.economy.mayorId);
    return account?.entity?.properties.citizen ? this.city.society.citizen(account.id) : this.city.economy.citizen(account?.ownerId);
  }
  attachBuilding(b, ownerId = 'treasury') {
    const lot = { id: this.nextPlotId++, x: b.entity.x, y: b.entity.y, width: b.width, depth: b.depth, door: { ...b.door }, ownerId, price: b.width * b.depth * this.city.currency.price(DEVELOPMENT_RULES.landPerCell), forSale: false, forRent: false, rent: 0, buildingId: b.id, projectId: null };
    this.plots.push(lot); b.plotId = lot.id; return lot;
  }
  overlaps(x, y, width, depth, exceptId = null) {
    return this.plots.some(p => p.id !== exceptId && x - 1 < p.x + p.width && x + width + 1 > p.x && y - 1 < p.y + p.depth && y + depth + 1 > p.y);
  }
  isFarmPlot(plot) {
    if (plot.type === 'quarry' || plot.width < 8 || plot.depth < 8) return false;
    let fertile = 0;
    for (let y = plot.y; y < plot.y + plot.depth; y++) for (let x = plot.x; x < plot.x + plot.width; x++) {
      if ([0, 9].includes(tileAt(this.city.world, x, y))) fertile++;
    }
    return fertile >= plot.width * plot.depth * .75;
  }
  createPlot(x, y, width = 4, depth = 4, { type = null } = {}) {
    if (![x, y, width, depth].every(Number.isInteger) || width < 1 || depth < 1 || width*depth < MIN_PLOT_CELLS || width > 20 || depth > 20 || this.overlaps(x, y, width, depth)) return null;
    if (this.projects.some(p => p.service === 'road' && !p.cancelled && p.status !== 'completed' && p.route.some(t => t.x >= x && t.x < x + width && t.y >= y && t.y < y + depth))) return null;
    if (!type) for (let yy = y; yy < y + depth; yy++) for (let xx = x; xx < x + width; xx++) if (tileAt(this.city.world, xx, yy) === 4) type = 'quarry';
    if (type === 'farm' && !this.isFarmPlot({ x, y, width, depth, type })) return null;
    const terrain = inspectBuildingSite(this.city, x, y, width, depth, { type });
    const level = flatSiteLevel(this.city.world, x, y, width, depth);
    if (terrain.error) return null;
    const hall = this.city.buildings[0];
    if(hall){
      const blocked=new Set(this.city.occupied);
      for(const p of [...this.plots,{x,y,width,depth}])for(let yy=p.y;yy<p.y+p.depth;yy++)for(let xx=p.x;xx<p.x+p.width;xx++)blocked.add(`${xx},${yy}`);
      if(findTerrainPath(this.city.world,terrain.door,hall.door,blocked,{limit:4096})===null)return null;
    }
    const p = { id: this.nextPlotId++, x, y, width, depth, type, door: terrain.door, level, ownerId: 'treasury', price: width * depth * this.city.currency.price(DEVELOPMENT_RULES.landPerCell), forSale: true, forRent: false, rent: 0, buildingId: null, projectId: null };
    this.plots.push(p); return p;
  }
  ensureQuarryPlot(){
    if(this.plots.some(p=>p.ownerId==='treasury'&&p.type==='quarry'&&!p.buildingId&&!p.projectId))return;
    const city=this.city;if(this.nextQuarrySearchAt>city.minute)return;this.nextQuarrySearchAt=city.minute+60;
    const center=city.world.spawnCenter||city.spawn,total=Math.max(32,Math.ceil(Math.max(city.world.width||64,city.world.height||64)/6)*32);
    for(let i=0;i<48;i++){const index=(this.quarryPlotCursor||0)%total;this.quarryPlotCursor=index+1;const radius=8+Math.floor(index/32)*6,angle=index%32*Math.PI/16,x=Math.floor(center.x+Math.cos(angle)*radius),y=Math.floor(center.y+Math.sin(angle)*radius);if(tileAt(city.world,x,y)!==4)continue;if(this.createPlot(x-1,y-1,3,3,{type:'quarry'}))return;}
  }
  ensurePlots(count = 18) {
    const available = () => this.plots.filter(p => !p.landingReserved && !p.buildingId && !p.projectId && p.ownerId === 'treasury');
    const ruralTarget = 3;
    const supply = () => {
      const plots = available();
      return { rural: plots.filter(p => this.isFarmPlot(p)).length, urban: plots.filter(p => !['farm','quarry'].includes(p.type) && p.width <= 8 && p.depth <= 8).length };
    };
    let stock = supply();
    // A full urban catalogue must never stop the search for agricultural land.
    if (stock.urban >= count && stock.rural >= ruralTarget) return;
    if (this.nextPlotSearchAt > this.city.minute) return;
    this.nextPlotSearchAt = this.city.minute + 60;
    const budget = this.hasSearchedPlots ? 24 : 96;
    this.hasSearchedPlots = true;
    const ruralSizes = [[10, 10], [8, 12], [12, 12], [16, 12], [8, 8]];
    const urbanSizes = [[4, 5], [6, 6], [5, 7], [4, 4]];
    const center = this.city.world.spawnCenter;
    const maxRadius = Math.max(this.city.world.width, this.city.world.height) * .65;
    const radii = [];
    for (let r = 8; r < maxRadius; r += 6) { radii.push(r); if (r + 30 < maxRadius) radii.push(r + 30); }
    const rings = [...new Set(radii)], total = rings.length * 32;
    const start = (this.plotSearchCursor || 0) % total;
    for (let offsetIndex = 0; offsetIndex < Math.min(total, budget); offsetIndex++) {
      const index = (start + offsetIndex) % total;
      this.plotSearchCursor = (index + 1) % total;
      const radius = rings[Math.floor(index / 32)], step = index % 32;
      const angle = step * Math.PI / 16 + (this.city.initialSeed % 11) * .07;
      const x = Math.floor(center.x + Math.cos(angle) * radius), y = Math.floor(center.y + Math.sin(angle) * radius);
      let created = null;
      if (stock.rural < ruralTarget) for (const [width, depth] of ruralSizes) {
        created = this.createPlot(x, y, width, depth, { type: 'farm' });
        if (created) break;
      }
      if (!created && stock.urban < count) {
        const offset = this.nextPlotId % urbanSizes.length;
        for (let i = 0; i < urbanSizes.length; i++) {
          const [width, depth] = urbanSizes[(offset + i) % urbanSizes.length];
          created = this.createPlot(x, y, width, depth);
          if (created) break;
        }
      }
      if (created) stock = supply();
      if (stock.urban >= count && stock.rural >= ruralTarget) return;
    }
  }

  buyPlot(accountId, plotId) {
    const p = this.plots.find(p => p.id === plotId), a = this.city.accounts.get(accountId);
    if (!p || !a || !p.forSale || p.ownerId === accountId || p.projectId || (!a.entity?.properties.citizen && a.type !== 'builder')) return this.city.fail('Terreno indisponível para compra.');
    if (!this.city.transfer(accountId, p.ownerId, p.price, 'Compra de terreno')) return this.city.fail('Saldo insuficiente para comprar o terreno.');
    this.city.history.record('ownership',`Terreno ${p.id}: ${this.city.accountName(p.ownerId)} → ${this.city.accountName(accountId)}.`,[p.ownerId,accountId,`plot:${p.id}`],{plotId:p.id,amount:p.price});
    p.ownerId = accountId; p.forSale = p.forRent = false;
    this.city.log(`${this.city.accountName(accountId)} comprou o terreno ${p.id}.`, 'land', this.ownerCitizen(accountId) ? [this.ownerCitizen(accountId).id] : [], { kind: 'land-purchase', plotId }); return p;
  }
  listPlot(accountId, plotId, { price, rent = 0, forSale = false, forRent = false }) {
    const p = this.plots.find(p => p.id === plotId);
    if (!p || p.ownerId !== accountId || p.projectId || !Number.isSafeInteger(price) || price < 1 || !Number.isSafeInteger(rent) || rent < 0) return false;
    Object.assign(p, { price, rent, forSale: p.ownerId === 'treasury' || !!forSale, forRent: p.ownerId !== 'treasury' && !!forRent }); return true;
  }
  beginProject(accountId, plotId, type, { kind = ['farm','quarry','park','bike_rack'].includes(type) ? 'open-air' : 'building', floors = null, crop = null, sell = false, width = null, depth = null, builderId = null, selfBuild = false, priority = 0, micro = false, rotation = null } = {}) {
    if(OFFICE_ONLY_TYPES.has(type))return this.city.fail('Esta atividade precisa ocupar um andar em um empresarial.');
    const city = this.city, p = this.plots.find(p => p.id === plotId), owner = this.clientCitizen(accountId);
    const autoFloors=floors===null;
    floors ??= ['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing','office_tower'].includes(type)?3:businessFloors(type,plotId);
    if ((kind === 'open-air' && !['farm', 'quarry', 'park', 'bike_rack', 'leisure', 'market', 'greengrocer'].includes(type)) || !p || p.ownerId !== accountId || p.buildingId || p.projectId || !owner || !city.buildingTypes[type] || !['open-air', 'building'].includes(kind) || !Number.isInteger(floors) || floors < 1 || floors > 8 || (type === 'farm' && (!city.economy.crops[crop] || kind !== 'open-air'))) return null;
    width ??= p.width; depth ??= p.depth;
    if(width*depth<MIN_PLOT_CELLS||p.width*p.depth<MIN_PLOT_CELLS)return city.fail('Terrenos e prédios precisam de pelo menos 4 células de área.');
    if ((p.type === 'quarry' && !['quarry','iron_mine','bauxite_mine'].includes(type)) || (p.type==='farm' && type!=='farm')) return null;
    if (![width, depth].every(Number.isInteger) || width < 1 || depth < 1 || width*depth<MIN_PLOT_CELLS || p.width*p.depth<MIN_PLOT_CELLS || width > p.width || depth > p.depth || (kind==='building' && (width>8 || depth>8))) return null;
    const terrain=chooseBuildingSite(city,p.x,p.y,width,depth,{plotId,type,rotation});if(terrain.error)return null;
    floors = kind === 'open-air' ? 1 : floors;
    const builder = selfBuild ? null : this.selectBuilder(accountId, terrain.door, builderId);
    if (builderId && !builder) return null;
    if(autoFloors&&kind==='building')while(floors>1){const cells=width*depth*floors,stone=cells*DEVELOPMENT_RULES.stonePerCell,fee=builder?cells*city.currency.price(DEVELOPMENT_RULES.constructionFeePerCell):0,cost=stone*city.economy.goods.pedra.price+(accountId==='treasury'?Math.ceil(fee*DEVELOPMENT_RULES.municipalMultiplier):fee)+city.currency.price(micro?2000:20000);if((city.accounts.get(accountId)?.balance||0)>=cost)break;floors--;}
    const cells = width * depth * floors, stone = kind === 'open-air' ? (['park','bike_rack'].includes(type)?Math.ceil(cells/4):0) : cells * DEVELOPMENT_RULES.stonePerCell;
    const fee = builder && stone ? cells * this.city.currency.price(DEVELOPMENT_RULES.constructionFeePerCell) : 0;
    const publicFee = accountId === 'treasury' ? Math.ceil(fee * DEVELOPMENT_RULES.municipalMultiplier) : fee;
    if ((city.accounts.get(accountId)?.balance || 0) < stone * city.economy.goods.pedra.price + publicFee + city.currency.price(micro?2000:20000)) return null;
    const project = { id: `project:${this.nextProjectId++}`, micro, accountId, ownerId: owner.id, name: `Obra no terreno ${p.id}`, priority, service: 'building', rotation:terrain.rotation, width, depth, plotId, type, crop, kind, floors, sell, stone, labor: 0, requiredLabor: stone ? cells * DEVELOPMENT_RULES.laborPerCell : 0, builderId: builder?.id || null, fee, active: true, door: terrain.door, status: stone ? 'materials' : 'ready', startedAt: city.minute, cancelled: false };
    initializeInventory(project, city.economy.goods, stone + 48);
    project.feeAccountId = `construction-fee:${project.id}`;
    city.accounts.set(project.feeAccountId, { name: `Caução da obra ${project.id}`, balance: 0 });
    if (accountId === 'treasury' && fee) project.fee = publicFee;
    if (!city.transfer(accountId, project.feeAccountId, project.fee, 'Reserva do serviço de construção', {projectId:project.id})) { city.accounts.delete(project.feeAccountId); return null; }
    this.projects.push(project); p.projectId = project.id;p.door={...terrain.door};
    city.clearCardboardSheltersForArea?.(p.x,p.y,width,depth);
    city.log(`${owner.entity.properties.name} iniciou ${city.buildingTypes[type].label} no terreno ${p.id}: ${stone} pedras.`, 'construction', [owner.id], { kind: 'project-started', projectId: project.id, plotId });
    if (!stone) this.complete(project);
    return project;
  }
  complete(project) {
    if (project.status === 'completed' || project.cancelled || project.inventory.pedra < project.stone || project.labor < project.requiredLabor) return null;
    if (['lamp', 'road', 'bridge', 'road-repair', 'repair', 'expansion'].includes(project.service)) return this.completeService(project);
    const p = this.plots.find(p => p.id === project.plotId), city = this.city;
    const b = city.addBuilding(project.type, p.x, p.y, { width: project.width ?? p.width, depth: project.depth ?? p.depth, floors: project.floors, plotId: p.id, ownerAccountId: project.accountId, kind: project.kind, materialSource: project,rotation:project.rotation??0 });
    if(b&&project.micro)b.micro=true;
    if(b&&project.officialJournal){b.officialJournal=true;b.newsGenre='política';b.entity.properties.name='Jornal Oficial do Município';}
    if(b&&project.equityPartners)b.equityPartners=project.equityPartners;
    if (!b) { project.status = 'blocked'; project.error = city.lastError; return null; }
    city.reputation.completed(city.building(project.builderId), null, 'edifício concluído', {projectId:project.id});
    p.buildingId = b.id; p.projectId = null; project.status = 'completed'; project.error = null; project.completedAt = city.minute;
    if(project.landlordDevelopment&&project.loanId){const loan=city.bank.loans.find(item=>item.id===project.loanId);if(loan){loan.collateralHomeIds=[...city.housing.homes.values()].filter(home=>home.buildingId===b.id).map(home=>home.id);loan.collateralHomeId=loan.collateralHomeIds[0]||null;}}
    city.transfer(project.feeAccountId, this.city.building(project.builderId)?.accountId || project.accountId, project.fee, 'Serviço de construção', {projectId:project.id});
    const account = city.accounts.get(project.accountId); if (account?.entity?.properties.cityBuilding) account.totalExpenses += project.fee;
    if(project.materialAccountId)city.transfer(project.materialAccountId,b.accountId,city.accounts.get(project.materialAccountId)?.balance||0,'Capital operacional reservado da nova empresa');
    if (['residential', 'super_popular_housing', 'popular_housing', 'popular_luxury_housing', 'luxury_housing'].includes(project.type) || project.sell) {
      for (const u of b.units) { u.occupantId = null; u.forSale = ['super_popular_housing','popular_housing','popular_luxury_housing'].includes(project.type) && project.accountId==='treasury'?false:project.accountId === 'treasury' || project.sell; u.forRent = project.accountId !== 'treasury' && !project.sell; }
    } else if (project.accountId === 'treasury') city.economy.activateMunicipalBusiness(b, b.type==='council_chamber'||project.materialAccountId?0:city.currency.price(b.type==='bank'?300000:50000), project.crop);
    else city.economy.activateBusiness(b, this.ownerCitizen(project.accountId), project.crop, false);
    city.history.record('service',`Construção de ${b.entity.properties.name} concluída.`,[project.accountId,city.building(project.builderId)?.accountId,b.accountId],{amount:project.fee,projectId:project.id,stone:project.stone});
    city.workMeals.closeSite(project, b);finishBuildingOccupants(city,b);
    if(b.type==='council_chamber')city.politics.syncGoverningFlag();
    if(['super_popular_housing','popular_housing','popular_luxury_housing'].includes(b.type) && project.accountId==='treasury')city.housing.assign();
    city.log(`${b.entity.properties.name} concluído no terreno ${p.id}.`, 'construction', [project.ownerId], { kind: 'project-completed', buildingId: b.id, plotId: p.id, projectId:project.id }); return b;
  }
  executionReport(){
    const city=this.city,projects=this.projects.filter(p=>!p.cancelled&&p.status!=='completed'),people=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c));
    return {unemployed:people.filter(c=>!c.jobId&&!c.businessIds.length&&!c.deliveryId).length,ready:projects.filter(p=>p.inventory.pedra>=p.stone).length,waiting:projects.filter(p=>p.inventory.pedra<p.stone).length,unfunded:projects.filter(p=>(p.materialFundingGap||0)>0).length,working:people.filter(c=>c.task==='construction'&&!c.path.length).length,travelling:people.filter(c=>c.task==='construction'&&c.path.length).length,extraction:city.economy.businesses.filter(b=>b.type==='quarry').reduce((n,b)=>n+city.economy.quarryStatus(b).daily,0)};
  }
  materialBudget(project){
    const remaining=Math.max(0,project.stone-(project.inventory.pedra||0)-(project.incoming.pedra||0)),capital=project.startupCapital||0,freight=this.city.currency.price(['road','bridge','road-repair','repair','lamp'].includes(project.service)?12000:24000);
    return {remaining,capital,freight,target:remaining*this.city.economy.goods.pedra.price+capital+freight};
  }
  ensureMaterialBudget(project){
    const city=this.city;
    if(project.service==='building'&&project.startupCapital==null&&(INDUSTRIES[project.type]||['farm','bakery','market','greengrocer','builder','carrier','cleaner','waste_collector','quarry','recycler','paid_toilet','mill'].includes(project.type)))project.startupCapital=city.currency.price(project.type==='bank'?2000000:project.type==='research_institute'?100000:60000);
    const budget=this.materialBudget(project);if(!budget.remaining){project.materialFundingGap=0;return true;}
    let id=project.materialAccountId,account=id&&city.accounts.get(id);
    if(!account){id=`materials:${project.id}`;account={name:`Materiais de ${project.name}`,balance:0};city.accounts.set(id,account);project.materialAccountId=id;}
    let gap=Math.max(0,budget.target-account.balance);project.materialFundingGap=gap;if(!gap)return true;
    const payer=city.accounts.get(project.accountId);if(!payer)return false;
    const reserve=project.accountId==='treasury'?city.welfare.conditions().reserve:city.currency.price(1500);
    if(payer.balance-reserve<gap&&payer.entity?.properties.citizen&&payer.creditAllowed!==false&&city.buildingTypes[project.type]){
      city.bank.developmentBanks();
      for(const bank of city.bank.available()){const amount=Math.max(0,gap-Math.max(0,payer.balance-reserve));if(!amount)break;const loan=city.bank.lendForBusiness(bank,payer,amount,{type:project.type,crop:project.crop,initialChain:!!project.productionChain||city.economy.demands.some(d=>d.type===project.type&&(project.type!=='farm'||d.crop===project.crop)),completionDraw:true,projectId:project.id,score:180,budget:gap});if(loan){loan.projectId=project.id;project.loanId=loan.id;break;}}
    }
    const payment=Math.min(gap,Math.max(0,payer.balance-reserve));
    if(payment>0)city.transfer(project.accountId,id,payment,'Complemento do orçamento de materiais da obra',{projectId:project.id});
    gap=Math.max(0,budget.target-account.balance);project.materialFundingGap=gap;
    return gap===0;
  }
  requestMaterials(project) {
    if (project.cancelled || project.status === 'completed' || project.waitingForCouncilContract) return;
    this.ensureMaterialBudget(project);
    let need=project.stone-project.inventory.pedra-(project.incoming.pedra||0),orders=0;
    const city=this.city,stock=city.economy.businesses.filter(b=>b.type==='quarry'||b.type==='recycler');
    for(const quarry of stock){
      while(need>0&&orders<4){
        const account=city.accounts.get(project.materialAccountId||project.accountId),spendable=Math.max(0,(account?.balance||0)-(project.startupCapital||0)),affordable=Math.floor(Math.max(0,spendable-city.currency.price(1200))/city.economy.goods.pedra.price);
        const qty=Math.min(city.logistics.transportLimit(quarry,project),need,quarry.inventory.pedra,inventoryFree(project),affordable);if(qty<=0)break;
        const sanitation=['waste_collector','recycler','composting'].includes(project.type);
        const shipment=city.logistics.order(quarry,project,'pedra',qty,city.economy.goods.pedra.price,{payerAccountId:project.materialAccountId||project.accountId,purpose:sanitation?'sanitation':project.priority>=100?'critical-infrastructure':project.service==='lamp'?'lamp-construction':'trade'});
        if(!shipment)break;need-=qty;orders++;
      }
    }
    project.materialStatus=project.inventory.pedra>=project.stone?'Pedras entregues':need<=0?'Pedras em transporte':project.materialFundingGap>0?'Orçamento de materiais precisa de complemento':!stock.some(b=>b.inventory.pedra>0)?'Extração ainda não disponibilizou pedras':'Compra ou transporte aguardando atendimento';
  }
  work(project, c) {
    if (!project || project.cancelled || project.status === 'completed') return false;
    if (project.inventory.pedra < project.stone) return false;
    if(['work','manage'].includes(c.task)){c.task='construction';c.workProjectId=project.id;c.targetId=project.builderId||c.targetId;}
    const plot=this.plots.find(p=>p.id===project.plotId),parallel=project.service==='building'||project.service==='expansion';
    let assignment=parallel?c.constructionAssignment:null;
    if(parallel&&(!assignment||assignment.projectId!==project.id||assignment.labor>=DEVELOPMENT_RULES.laborPerCell)){
      const next=project.nextWorkCellIndex??Math.floor(project.labor/Math.max(1,DEVELOPMENT_RULES.laborPerCell));
      project.nextWorkCellIndex=next+1;
      const cells=Math.max(1,(project.width||plot?.width||1)*(project.depth||plot?.depth||1)*(project.floors||1));
      assignment=c.constructionAssignment={projectId:project.id,index:next%cells,labor:0};
    }
    const index=assignment?assignment.index:Math.max(0,Math.floor(project.labor/Math.max(1,DEVELOPMENT_RULES.laborPerCell)));
    if(project.service==='expansion'){
      const building=this.city.building(project.buildingId),cells=building?.units.filter(u=>u.z===building.floors-1&&!['bathroom','dining'].includes(u.roomType));
      if(cells?.length&&!activityRoomReady(this.city,c,building,cells[index%cells.length],'workspace'))return true;
    }else{
      const tile=project.service==='bridge'?project.door:['road','road-repair'].includes(project.service)?project.path[Math.min(project.path.length-1,Math.floor(project.labor/DEVELOPMENT_RULES.roadLaborPerTile))]:plot?{x:plot.x+(index%(project.width||plot.width))+.5,y:plot.y+Math.floor(index/(project.width||plot.width))%(project.depth||plot.depth)+.5}:project.door;
      if(!outdoorCellReady(this.city,c,{id:project.id,entity:{x:0,y:0}},{id:`${project.id}:${index}`,x:tile.x-.5,y:tile.y-.5,z:plot?Math.floor(index/((project.width||plot.width)*(project.depth||plot.depth))):0},true))return true;
    }
    const previousLabor=project.labor;
    project.status = 'building'; project.labor = Math.min(project.requiredLabor, project.labor + 1 + c.skills.construction / 50);
    if(assignment)assignment.labor+=project.labor-previousLabor;
    if (project.service === 'road' || project.service === 'road-repair') { const tile = project.path[Math.min(project.path.length - 1, Math.floor(project.labor / DEVELOPMENT_RULES.roadLaborPerTile))]; project.door = { ...tile }; }
    this.city.economy.practice(c, 'construction'); this.complete(project); return true;
  }
  projectFor(c, business = null) {
    let dispatch=constructionDispatch.get(this);
    if(!dispatch||dispatch.minute!==this.city.minute){
      const assigned=new Map();for(const worker of this.city.citizens)if(!worker.entity.destroyed&&worker.task==='construction')assigned.set(worker.workProjectId,(assigned.get(worker.workProjectId)||0)+1);
      const people=this.city.citizens.filter(person=>!person.entity.destroyed),homeless=people.reduce((n,person)=>n+Number(!person.homeUnitId),0),housingCrisis=homeless>=Math.max(12,people.length*.1);
      const projects=this.projects.filter(p=>p.status!=='blocked'&&p.labor<p.requiredLabor&&!p.waitingForCouncilContract&&!p.cancelled&&p.status!=='completed'&&p.inventory.pedra>=p.stone&&(p.service!=='lamp'||!!p.builderId));
      const housing=projects.filter(p=>p.accountId==='treasury'&&['super_popular_housing','popular_housing','popular_luxury_housing'].includes(p.type)).sort((a,b)=>(b.priority||0)-(a.priority||0)||a.startedAt-b.startedAt||String(a.id).localeCompare(String(b.id)));
      dispatch={minute:this.city.minute,assigned,projects,housingCrisis,priorityHousingId:housing[0]?.id};
      constructionDispatch.set(this,dispatch);
    }
    let selected=null,selectedPriority=-Infinity,selectedCrew=Infinity;
    for(const p of dispatch.projects){
      const owned=!p.builderId&&(p.accountId===c.accountId||p.accountId==='treasury'&&p.ownerId===c.id),builderJob=business?.type==='builder'&&(p.builderId===business.id||p.accountId===business.accountId);
      if(!owned&&!builderJob||p.status==='blocked'||p.labor>=p.requiredLabor||p.waitingForCouncilContract||p.cancelled||p.status==='completed'||p.inventory.pedra<p.stone)continue;
      const crew=dispatch.assigned.get(p.id)||0,limit=Math.max(1,Math.min(6,Math.ceil(Math.max(0,p.requiredLabor-p.labor)/30)));if(crew>=limit)continue;
      const housingPriority=dispatch.housingCrisis&&p.accountId==='treasury'&&['super_popular_housing','popular_housing','popular_luxury_housing'].includes(p.type)?(p.id===dispatch.priorityHousingId?500:250):0;
      const score=housingPriority+(p.priority||0)+(p.service==='lamp'?Math.min(80,Math.max(0,this.city.minute-p.startedAt)/60*2):0)+Math.min(160,(this.city.minute-p.startedAt)/60);
      if(score>selectedPriority||score===selectedPriority&&(crew<selectedCrew||crew===selectedCrew&&p.startedAt<selected?.startedAt)){selected=p;selectedPriority=score;selectedCrew=crew;}
    }
    return selected;
  }
  reserveConstruction(project){const dispatch=constructionDispatch.get(this);if(dispatch?.minute===this.city.minute)dispatch.assigned.set(project.id,(dispatch.assigned.get(project.id)||0)+1);}
  balanceContracts() {
    const builders=this.city.economy.businesses.filter(b=>b.type==='builder' && (b.workers.length || this.city.economy.workingOwner(b)));
    if(builders.length<2)return;
    const load=new Map(builders.map(b=>[b.id,0])),dispatched=new Set(this.city.citizens.filter(c=>!c.entity.destroyed&&c.task==='construction').map(c=>c.workProjectId));
    const projects=this.projects.filter(p=>!p.cancelled && p.status!=='completed' && p.builderId);
    for(const p of projects.filter(p=>p.labor>0||dispatched.has(p.id)))load.set(p.builderId,(load.get(p.builderId)||0)+Math.max(0,p.requiredLabor-p.labor));
    for(const p of projects.filter(p=>p.labor===0&&!dispatched.has(p.id)).sort((a,b)=>(b.priority||0)-(a.priority||0)||a.startedAt-b.startedAt)) {
      const options=builders.filter(b=>b.accountId!==p.accountId && this.city.economy.connected(b,{id:`site:${p.door.x}:${p.door.y}`,door:p.door}));
      options.sort((a,b)=>(load.get(a.id)||0)/Math.max(1,a.workers.length+(a.ownerId?1:0))-(load.get(b.id)||0)/Math.max(1,b.workers.length+(b.ownerId?1:0))||a.id-b.id);
      const next=options[0];if(!next)continue;
      if(p.builderId!==next.id){p.builderId=next.id;this.city.history.record('service',`Contrato ${p.id} atribuído a ${next.entity.properties.name} antes do início do trabalho.`,[p.accountId,next.accountId],{projectId:p.id});}
      load.set(next.id,(load.get(next.id)||0)+p.requiredLabor);
    }
  }
  updateHourly() {
    this.ensurePlots();
    this.updateWear();
    this.planPublicWorks();
    const emergency=this.city.welfare.conditions().crisis,basic=new Set(['super_popular_housing','popular_housing','popular_luxury_housing','popular_refectory','public_toilet','kitchen','farm','bakery','market','greengrocer','mill','builder','quarry','carrier','cleaner','recycler','composting','waste_collector']);
    for (const p of [...this.projects].sort((a, b) => (b.priority||0)-(a.priority||0)||Number(a.service === 'lamp') - Number(b.service === 'lamp'))) {
      const defer=emergency&&p.accountId==='treasury'&&p.priority<90&&!basic.has(p.type)&&p.service!=='road-repair';
      p.waitingForBasicNeeds=defer;
      if(!defer)this.requestMaterials(p);
      if(p.status==='blocked')this.complete(p);
    }
    const city=this.city,living=city.citizens.filter(c=>!c.entity.destroyed),emergencyHomeless=living.reduce((n,c)=>n+Number(!c.homeUnitId),0);
    if(emergencyHomeless>=Math.max(12,living.length*.1))for(const p of this.projects){
      if(p.accountId!=='treasury'||!['super_popular_housing','popular_housing','popular_luxury_housing'].includes(p.type)||p.cancelled||p.status==='completed')continue;
      // Emergency homes still require real materials and site work, but the
      // normal three labor units per cell made their first completion arrive
      // days after the shelter crisis began. Keep crews doing real site work,
      // but let emergency housing open after an initial construction phase.
      const cells=(p.width||1)*(p.depth||1)*(p.floors||1);p.requiredLabor=Math.min(p.requiredLabor,Math.ceil(cells*.1));
      if(p.inventory.pedra>=p.stone&&p.labor>=p.requiredLabor)this.complete(p);
    }
    // Builders develop housing for sale; individual investors prefer premises for their own firms.
    const homeless = this.city.citizens.filter(c => !c.homeUnitId).length;
    const housingProjects = this.projects.filter(p => p.type === 'residential' && !p.cancelled && p.status !== 'completed');
    const availableHomes = [...this.city.housing.homes.values()].filter(h => this.city.housing.units(h).every(u => !u.tenantId && (u.forSale || u.forRent))).length;
    if (homeless + 3 > availableHomes && !housingProjects.length) {
      const builder = this.city.economy.businesses.find(b => b.type === 'builder');
      const p = this.plots.filter(p => p.ownerId === 'treasury' && p.forSale && !p.buildingId && !p.projectId && p.width<=8 && p.depth<=8 && !['quarry','farm'].includes(p.type)).sort((a, b) => Math.abs(a.width * a.depth - 16) - Math.abs(b.width * b.depth - 16))[0];
      if (builder && p) {
        const owner = this.city.economy.citizen(builder.ownerId);
        if (owner && builder.balance < 50000 && owner.balance > 90000) this.city.transfer(owner.accountId, builder.accountId, 70000, 'Aporte para empreendimento imobiliário');
        if (builder.balance > p.price + 40000 && this.buyPlot(builder.accountId, p.id)) this.beginProject(builder.accountId, p.id, 'residential', { floors: 3, sell: true });
      }
    }
  }
  reconcile() {
    this.city.economy.appointMayor();
    for (const p of this.plots) if (p.buildingId && !this.city.building(p.buildingId)) { p.buildingId = null; p.forSale = true; }
    for (const project of this.projects) if (project.builderId && !this.city.building(project.builderId) && project.status !== 'completed' && !project.cancelled) { project.builderId = null; this.city.transfer(project.feeAccountId, project.accountId, this.city.accounts.get(project.feeAccountId)?.balance || 0, 'Estorno de contrato de construtora encerrada'); project.fee = 0; }
    for (const project of this.projects) if ((project.accountId === 'treasury' || this.city.accounts.get(project.accountId)?.municipal) && this.clientCitizen(project.accountId)) project.ownerId = this.clientCitizen(project.accountId).id;
    for (const p of this.projects) if (!p.cancelled && p.status !== 'completed' && ((p.service === 'expansion' && !this.city.building(p.buildingId)) || !this.clientCitizen(p.accountId) || (p.accountId !== 'treasury' && !this.city.society.citizen(p.ownerId)))) {
      this.city.transfer(p.feeAccountId, 'treasury', this.city.accounts.get(p.feeAccountId)?.balance || 0, 'Estorno de obra cancelada');
      p.cancelled = true; p.active = false; p.status = 'cancelled';
      if(p.materialAccountId){for(const shipment of this.city.logistics.shipments)if(shipment.buyer===p && !['delivered','cancelled'].includes(shipment.status))this.city.logistics.cancel(shipment);this.city.transfer(p.materialAccountId,this.city.accounts.has(p.accountId)?p.accountId:'treasury',this.city.accounts.get(p.materialAccountId)?.balance||0,'Estorno de capital de empreendimento cancelado');}
      const lot = this.plots.find(l => l.id === p.plotId); if (lot) { lot.projectId = null; if (p.service !== 'expansion') { lot.ownerId = 'treasury'; lot.forSale = true; } }
      const hall = this.city.buildings.find(b => b.type === 'townhall');
      for (const [good, qty] of Object.entries(p.inventory)) { const stored = Math.min(qty, hall ? inventoryFree(hall) : 0); if (hall) hall.inventory[good] += stored; this.city.economy.lost[good] += qty - stored; p.inventory[good] = 0; }
    }
    for (const lot of this.plots) if (lot.ownerId !== 'treasury' && !this.ownerCitizen(lot.ownerId)) { lot.ownerId = 'treasury'; lot.forSale = true; lot.forRent = false; }
  }
}
