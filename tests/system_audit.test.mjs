import test from 'node:test';
import assert from 'node:assert/strict';
import { setup,finishShipment } from './helpers/city.mjs';
import { CityStateGraph,bindCityState } from '../js/city_state.js';
import { INDUSTRIES } from '../js/city_industries.js';
import { GOODS } from '../js/city_economy.js';
import { HISTORY_LIMIT } from '../js/city_history.js';
import { settlementConnected, findTerrainPath } from '../js/city_terrain.js';
import { ROAD_TILES } from '../js/city_terrain.js';
import { World } from '../js/world.js';
import { updateClothes, appearance } from '../js/city_clothing.js';

function firm(city,type){
  const site=city.economy.locateBuilding(type).find(s=>!city.development.overlaps(s.x,s.y,s.width,s.depth));assert(site,type);
  const b=city.addBuilding(type,site.x,site.y,{...site,free:true});assert(b,type);city.economy.activateMunicipalBusiness(b,100000);return b;
}
function goodsAudit(city){for(const good of Object.keys(GOODS))assert.equal(city.economy.initialStock[good]+city.economy.produced[good]-city.economy.consumed[good]-city.economy.lost[good],city.goodsStock(good),good);}

test('publication ownership follows physical freight, cancellation and demolition without duplicating copies',()=>{
  const city=setup({starter:true,population:64}),publisher=firm(city,'publisher'),buyer=firm(city,'market'),author=city.citizens[3];
  const doc=city.publications.stock(publisher,'livros',5);publisher.inventory.livros++;city.economy.initialStock.livros++;
  const first=city.logistics.order(publisher,buyer,'livros',1,0);assert(first);assert.equal(doc.ownerAccountId,first.accountId);goodsAudit(city);
  city.logistics.cancel(first);assert.equal(doc.ownerAccountId,publisher.accountId);goodsAudit(city);
  const shipment=city.logistics.order(publisher,buyer,'livros',1,0);assert(shipment);finishShipment(city,shipment);assert.equal(doc.ownerAccountId,buyer.accountId);goodsAudit(city);
  buyer.entity.destroyed=true;city.reconcile();assert.equal(doc.ownerAccountId,city.buildings[0].accountId);assert.equal(city.buildings[0].inventory.livros,1);goodsAudit(city);
  assert(!city.publications.read(doc.id,author.id)); // A blank book carries no invented content.
});

test('unclaimed personal publications enter the actual public warehouse when their owner leaves',()=>{
  const city=setup({starter:true}),c=city.citizens.find(c=>!city.politics.officeHolder(c)),hall=city.buildings[0];
  const doc=city.publications.stock(hall,'panfletos',1);city.publications.move(doc,c.accountId);city.economy.initialStock.panfletos++;
  goodsAudit(city);c.entity.destroyed=true;city.reconcile();assert.equal(doc.ownerAccountId,hall.accountId);assert.equal(hall.inventory.panfletos,1);goodsAudit(city);
});

test('road planning grows a connected paved network despite access paths sharing an unpaved destination',()=>{
  const city=setup({starter:true,population:64}),hall=city.buildings[0],roads=new Set();
  for(let y=0;y<city.world.height;y++)for(let x=0;x<city.world.width;x++)if(ROAD_TILES.has(city.world.getTile(x,y)))roads.add(`${x},${y}`);
  const b=city.addBuilding('market',10,10,{width:3,depth:3,floors:1,free:true});assert(b);
  for(const p of b.accessPath){const x=Math.floor(p.x),y=Math.floor(p.y);if(!roads.has(`${x},${y}`))city.world.setTile(x,y,0);}
  assert(b.accessPath.some(p=>roads.has(`${Math.floor(p.x)},${Math.floor(p.y)}`)));
  assert(!ROAD_TILES.has(city.world.getTile(Math.floor(b.door.x),Math.floor(b.door.y))));
  city.development.planRoadNetwork(hall,{reserve:0});const project=city.development.projects.find(p=>p.service==='road');assert(project,city.development.roadPlanning?.reason);
  assert(ROAD_TILES.has(city.world.getTile(Math.floor(project.route[0].x),Math.floor(project.route[0].y))));
  assert.equal(project.targetDoor.x,b.door.x);assert(project.materialAccountId);goodsAudit(city);
});

test('installed campaign materials are consumed once and departing citizens leave no unaccounted goods',()=>{
  const city=setup({starter:true}),materials=city.politics.campaigns.getMaterials(),c=city.citizens[3];
  // A completed installation may also be restored from an older worker snapshot.
  const mission={id:123,electionId:7,status:'completed',kind:'banner',good:'faixas',quantity:1,destination:{buildingId:city.buildings[0].id}};
  city.economy.initialStock.faixas++;materials.missions.push(mission);materials.minute();materials.minute();assert.equal(city.economy.consumed.faixas,1);goodsAudit(city);
  c.campaignInventory={tinta:2};city.economy.initialStock.tinta+=2;
  c.forestrySeeds=1;city.economy.initialStock.sementes++;
  c.wardrobe.push({manufacturedAt:city.minute,condition:90,quality:50});city.economy.initialStock.roupas++;
  goodsAudit(city);c.entity.destroyed=true;city.reconcile();goodsAudit(city);
  assert.equal(city.economy.lost.tinta,2);assert.equal(city.economy.lost.sementes,1);assert.equal(city.economy.lost.roupas,1);
});

test('negative salary tax pays an exact treasury subsidy without creating money',()=>{
  const city=setup(),b=city.economy.businesses.find(b=>b.type==='market'),c=city.citizens.find(c=>!city.politics.officeHolder(c));
  city.taxRate=-.1;const cash=c.balance,treasury=city.treasury,balance=b.balance,supply=city.currency.supply();
  for(let i=0;i<10;i++)assert(city.payWage(c,b,4));
  assert.equal(c.balance-cash,44);assert.equal(treasury-city.treasury,4);assert.equal(balance-b.balance,40);assert.equal(city.currency.supply(),supply);
});

test('scarce wood supplies first batches across competing chains instead of six batches to one buyer',()=>{
  const city=setup({starter:true,population:64}),seller=firm(city,'forestry'),buyers=['paper_mill','charcoal','artisan'].map(type=>firm(city,type));
  seller.inventory.madeira=6;city.economy.initialStock.madeira+=6;city.economy.trade();
  const orders=city.logistics.shipments.filter(s=>s.seller===seller&&s.good==='madeira');assert.equal(orders.length,2);
  assert(orders.every(s=>s.quantity===3));assert.equal(new Set(orders.map(s=>s.buyer.id)).size,2);
  seller.inventory.madeira+=3;city.economy.initialStock.madeira+=3;city.economy.trade();
  assert(buyers.every(b=>b.incoming.madeira>=3));goodsAudit(city);assert.equal(city.currency.supply(),city.currency.netIssued());
});

test('initial production planning includes financed food distribution before optional industrial expansion',()=>{
  const city=setup({starter:true,population:128});city.economy.updateDemand();
  for(const type of ['market','greengrocer']){
    const row=city.economy.productionPlan.find(r=>r.type===type);assert(row?.missing);assert(row.priority>=210);
    assert(city.bank.initialChainCredit({type,initialChain:true}));
  }
});

test('idle citizens retry unavailable shopping offers periodically instead of scanning all firms every minute',()=>{
  const city=setup({starter:true}),c=city.citizens.find(c=>!city.politics.officeHolder(c)&&!c.jobId);for(const k of Object.keys(c.needs))c.needs[k]=95;
  let calls=0;city.economy.consumerOffer=()=>{calls++;return null;};
  city.chooseTask(c);const first=calls;assert(first>0);
  for(let i=0;i<29;i++){city.minute++;city.chooseTask(c);}assert.equal(calls,first);
  city.minute++;city.chooseTask(c);assert(calls>first);
});

test('indexed lamp placement preserves terrain, property, entrance and pedestrian exclusions',()=>{
  const city=setup(),lighting=city.lighting,occupancy=lighting.siteOccupancy(),b=city.buildings[0];
  for(let y=35;y<90;y+=2)for(let x=35;x<90;x+=2){
    assert.equal(lighting.freeSite(x,y,null,occupancy),lighting.freeSite(x,y));
    assert.equal(lighting.freeSite(x,y,b,occupancy),lighting.freeSite(x,y,b));
  }
});

test('clothes retain their brand, improve appearance and enter consumption only when worn out',()=>{
  const city=setup({starter:true,population:64}),tailor=firm(city,'tailor'),c=city.citizens.find(c=>!city.politics.officeHolder(c));
  const n=INDUSTRIES.tailor.inputs.tecido;tailor.inventory.tecido=n;city.economy.initialStock.tecido+=n;tailor.productionLabor=100;
  city.economy.productionWork(tailor,c);assert(tailor.garments.length>0);
  city.transfer('treasury',c.accountId,100000,'Fixture wardrobe budget');c.wardrobe[0].condition=1;
  const before=appearance(c);c.entity.x=tailor.door.x;c.entity.y=tailor.door.y;
  assert(city.economy.buyConsumerGood(c,tailor));assert(appearance(c)>before);
  const garment=c.wardrobe.find(g=>g.manufacturedAt!=null);assert.equal(garment.brandId,tailor.id);goodsAudit(city);
  garment.condition=0;city.minute=Math.ceil(city.minute/1440)*1440+(c.id%24)*60;updateClothes(city);
  assert.equal(city.economy.consumed.roupas,1);goodsAudit(city);
});

test('newspapers consume physical paper and retain editorial facts within their page capacity',()=>{
  const city=setup({starter:true,population:64}),b=firm(city,'newsroom'),editor=city.citizens[3];b.newsGenre='política';
  const original=city.log('A prefeitura inaugurou uma obra pública.','government',[editor.id]);
  b.inventory.papel=5;city.economy.initialStock.papel+=5;b.productionLabor=100;
  assert(city.economy.productionWork(b,editor));const doc=city.publications.owned(b.accountId).find(d=>d.good==='jornais');
  assert(doc);assert(doc.pages>=3&&doc.pages<=5);assert(doc.entries.length<=doc.pages*2);
  assert(doc.entries.some(e=>e.sourceEventId===original.id));assert.equal(city.economy.consumed.papel,doc.pages);goodsAudit(city);
});

test('research agents interview nearby unique voters and publish an approximate funded poll',()=>{
  const city=setup({starter:true,population:64}),p=city.politics;
  city.minute=8*60;p.nextElectionAt=city.minute+3*1440;p.beginElection();const e=p.active;assert(e);
  const institute=firm(city,'research_institute'),agent=city.citizens.find(c=>!p.officeHolder(c));
  city.economy.leaveJob(agent);agent.jobId=institute.id;institute.workers=[agent.id];agent.traits={...agent.traits,honesty:1};
  const research=p.getResearch(),s=research.createStudy(e,institute,{key:'mayor',label:'Prefeitura',organizerId:city.economy.mayorId}),hall=city.buildings[0];
  assert(s.funded>=s.budget);s.sites=[{...hall.door,label:'Praça de entrevistas',quota:s.target,interviews:0,flow:1}];
  for(const c of city.citizens){c.entity.x=hall.door.x;c.entity.y=hall.door.y;c.path=[];c.task=null;for(const k of Object.keys(c.needs))c.needs[k]=95;}
  research.dispatch(s);assert.equal(s.sessions.length,1);
  for(let i=0;i<110&&s.responses.length<s.target;i++){city.minute++;research.fieldWork(agent);}
  assert.equal(s.responses.length,s.target);assert.equal(new Set(s.responses.map(r=>r.citizenId)).size,s.target);
  assert(research.publish(s,e));const poll=e.polls.at(-1);assert(poll.marginOfError>0);assert(poll.sampleSize>=s.minimum&&poll.sampleSize<=s.maximum);
  assert(poll.responses.every(r=>r.agentId===agent.id&&typeof r.reason==='string'));assert.equal(city.currency.supply(),city.currency.netIssued());
});

test('campaigns can select real street stages before traffic statistics accumulate',()=>{
  const city=setup({starter:true,population:64}),p=city.politics,campaigns=p.campaigns;
  city.minute=8*60;p.nextElectionAt=city.minute+3*1440;p.beginElection();const election=p.active,nomination=election.candidates[0],party=p.party(nomination.partyId);
  city.transfer('treasury',p.partyAccount(party).accountId,1000000,'Verba de teste para campanha');
  for(const c of city.citizens)for(const need of Object.keys(c.needs))c.needs[need]=95;
  city.traffic.clear();
  assert(campaigns.streetPoints(8).length>0);
  campaigns.recruit(nomination,election);
  assert(election.streetCampaign?.turns>0);
  assert(city.citizens.some(c=>c.campaign?.electionId===election.id&&c.task==='campaign'&&c.path.length<=60));
  const research=city.politics.getResearch();
  assert(research.sites(3).length<=1);
  assert(research.sites(30).length<=4);
});

test('both required campaign polls have an organizer even when the council has no formal leader',()=>{
  const city=setup({starter:true,population:64}),p=city.politics;
  city.minute=8*60;p.nextElectionAt=city.minute+3*1440;p.beginElection();
  const institute=firm(city,'research_institute'),research=p.getResearch();p.council.leaderId=null;
  research.request(p.active);
  assert.equal(p.active.requiredPolls.length,2);
  assert(p.active.requiredPolls.every(row=>row.studyId!=null));
  assert.equal(p.active.requiredPolls[1].organizerId,p.council.people()[0]?.id??city.economy.mayorId);
  assert.equal(research.studies.filter(s=>s.electionId===p.active.id).length,2);
  research.studies.forEach(s=>s.status='published');city.minute=p.active.voteAt-60;research.request(p.active);
  assert.equal(research.studies.filter(s=>s.electionId===p.active.id).length,2);
  assert(institute.active);
});

test('settlement connectivity agrees with routes and invalidates blocked components',()=>{
  const city=setup({starter:true}),a=city.buildings[0],b=city.buildings[1];
  assert.equal(settlementConnected(city,a.door,b.door),true);
  for(let y=0;y<city.world.height;y++)city.world.setTile(Math.floor(b.door.x)+1,y,2);
  const other={x:Math.floor(b.door.x)+2.5,y:b.door.y};
  const connected=settlementConnected(city,b.door,other);
  assert.equal(connected??(findTerrainPath(city.world,b.door,other,city.occupied)!==null),false);
  city.world.setTile(Math.floor(b.door.x)+1,Math.floor(b.door.y),0);
  assert.equal(settlementConnected(city,b.door,other),true);
});

test('paving preserves reachability revision while water and regenerated maps invalidate it',()=>{
  const world=new World(1,1337),{x,y}=world.spawnCenter;
  world.setTile(x,y,0);const revision=world.topologyRevision;
  world.setTile(x,y,8);assert.equal(world.topologyRevision,revision);
  world.setTile(x,y,2);assert.equal(world.topologyRevision,revision+1);
  world.generate(1,42);assert(world.topologyRevision>revision+1);
});

test('campaign property permissions skip public accounts without citizen entities',()=>{
  const city=setup(),p=city.politics,party=p.parties.find(p=>p.active),candidate=city.society.citizen(party.memberIds[0]);
  for(const b of city.buildings){b.active=true;b.municipal=false;for(const u of b.units)u.ownerId='treasury';}
  assert.equal(p.campaigns.getMaterials().property({partyId:party.id,citizenId:candidate.id}),null);
});

test('critical healthcare interrupts rest before a homeless sleeper dies',()=>{
  const city=setup({starter:true}),c=city.citizens[3],hall=city.buildings[0];
  Object.keys(c.needs).forEach(k=>c.needs[k]=90);c.needs.energy=0;c.needs.health=0;
  c.entity.x=hall.door.x;c.entity.y=hall.door.y;c.task='energy';c.targetId=hall.id;c.path=[];
  for(let i=0;i<150;i++)city.update(.25);
  assert(!c.entity.destroyed);assert(c.needs.health>20);assert.equal(city.life.deathCount,0);
});

test('a long toilet journey yields to urgent healthcare before arrival',()=>{
  const city=setup({starter:true}),c=city.citizens[3],hall=city.buildings[0];
  Object.keys(c.needs).forEach(k=>c.needs[k]=90);c.needs.health=3;c.needs.toilet=0;c.needs.energy=0;
  c.entity.x=hall.door.x+1;c.entity.y=hall.door.y;c.task='toilet';c.targetId=hall.id;
  c.path=Array.from({length:80},(_,i)=>({x:hall.door.x+i+2,y:hall.door.y}));
  city.update(.25);assert.equal(c.task,'health');assert(c.path.length<5);
  for(let i=0;i<150;i++)city.update(.25);assert(!c.entity.destroyed);assert(c.needs.health>20);
});

test('housing resident index follows moves, dependents, release and same-minute worker updates',()=>{
  const city=setup(),housing=city.housing,c=city.citizens[3],home=housing.home(c);
  assert(home);assert(housing.residents(home).includes(c));
  const index=housing.residentsByHome;housing.residents(home);assert.equal(housing.residentsByHome,index);
  const child=city.addCitizen(c.entity.x,c.entity.y,100,{age:0,parentIds:[c.id],grant:false});
  assert(housing.houseChild(child,c));assert(housing.residents(home).includes(child));
  housing.release(c);assert(!housing.residents(home).includes(c));assert(!housing.residents(home).includes(child));
  housing.residents(home);bindCityState(city);assert.equal(housing.residentsByHome,null);
});

test('all industrial transformations consume real inputs, conserve goods and stop without stock',()=>{
  const city=setup({starter:true,population:64}),c=city.citizens.find(c=>!city.politics.officeHolder(c));
  const specialized=new Set(['kitchen','forestry','iron_mine','bank','research_institute','clothing_store']);
  for(const [type,spec] of Object.entries(INDUSTRIES)){
    if(specialized.has(type))continue;
    const site=city.economy.locateBuilding(type).find(s=>!city.development.overlaps(s.x,s.y,s.width,s.depth));assert(site,type);
    const b=city.addBuilding(type,site.x,site.y,{...site,free:true});assert(b,type);city.economy.activateMunicipalBusiness(b,100000);
    // Seed a documented fixture inventory, including the alternative artisan/flag/publisher recipes.
    const inputs={...spec.inputs,...(type==='artisan'?{madeira:5,fibras:2}:type==='flagmaker'?{tecido:3,madeira:1}:type==='newsroom'?{papel:5}:{} )};
    for(const [good,n]of Object.entries(inputs)){b.inventory[good]+=n;city.economy.initialStock[good]+=n;}
    const before=Object.values(b.inventory).reduce((n,v)=>n+v,0);b.productionLabor=100;b.replantingAt=-Infinity;
    assert(city.economy.productionWork(b,c),type);
    assert(Object.keys(spec.outputs).some(g=>b.inventory[g]>0),type);
    assert(before>0||Object.values(b.inventory).some(n=>n>0),type);
    for(const good of Object.keys(GOODS))assert.equal(city.economy.initialStock[good]+city.economy.produced[good]-city.economy.consumed[good]-city.economy.lost[good],city.goodsStock(good),`${type}: ${good}`);
    if(Object.keys(spec.inputs).length){for(const good of Object.keys(spec.inputs)){city.economy.lost[good]+=b.inventory[good];b.inventory[good]=0;}assert.equal(city.economy.productionWork(b,c),false,`${type} without inputs`);}
  }
});

test('worker snapshots preserve inventories, money, prototypes and independent cached housing lookups',()=>{
  const city=setup({starter:true,population:64}),source=new CityStateGraph(),mirror=new CityStateGraph(),root={city,nextId:10000};
  let state=mirror.apply(structuredClone(source.encode(root)));bindCityState(state.city);
  for(let i=0;i<120;i++)city.update(.25);
  state=mirror.apply(structuredClone(source.encode(root)));bindCityState(state.city);
  assert.equal(state.city.minute,city.minute);assert.equal(state.city.currency.supply(),city.currency.supply());
  assert.equal(state.city.politics.council.seats,city.politics.council.seats);
  for(const good of Object.keys(GOODS))assert.equal(state.city.goodsStock(good),city.goodsStock(good),good);
  assert.equal(state.city.citizens.length,city.citizens.length);assert.equal(state.city.life.deathCount,0);
  assert.equal(state.city.housing.residentsByHome,null);
});

test('public housing keeps a funded slot while industrial projects are pending',()=>{
  const city=setup({starter:true,population:64});
  for(const type of ['paper_mill','weaving','sawmill']){
    const plot=city.development.plots.find(p=>!p.buildingId&&!p.projectId&&!['farm','quarry'].includes(p.type));assert(plot);
    assert(city.development.beginProject('treasury',plot.id,type,{width:3,depth:3,floors:1,priority:150}));
  }
  city.development.planBasicHousing();const homes=city.development.projects.filter(p=>p.type==='popular_housing');
  assert.equal(homes.length,1);assert.equal(homes[0].priority,150);
  assert(city.treasury>=city.welfare.conditions().reserve);
});

test('navigation caches survive unrelated social revisions and invalidate when obstacles change',()=>{
  const city=setup({starter:true,population:64}),[a,b]=city.buildings;
  const first=city.findPath(a.door,b.door),length=first.length;first.shift();assert.equal(city.findPath(a.door,b.door).length,length);
  const original=city.findPath;let calls=0;city.findPath=function(...args){calls++;return original.apply(this,args);};
  assert(city.economy.connected(a,b));city.structureRevision++;assert(city.economy.connected(a,b));assert.equal(calls,0);
  const key=`${Math.floor(b.door.x)},${Math.floor(b.door.y)}`;city.occupied.add(key);city.obstacleRevision++;
  assert.equal(city.economy.connected(a,b),false);assert.equal(calls,1);
  city.occupied.delete(key);city.obstacleRevision++;assert(city.economy.connected(a,b));
});

test('savings remain fully reserved and lending and repayment conserve currency',()=>{
  const city=setup({starter:true,population:64}),bank=city.buildings.find(b=>b.type==='bank'),c=city.citizens.find(c=>c.jobId&&!city.politics.officeHolder(c));
  city.transfer('treasury',c.accountId,10000,'Fixture savings');const supply=city.currency.supply(),capital=bank.balance;
  assert(city.bank.deposit(bank,c.accountId,2000));assert.equal(city.bank.savings(c.accountId),2000);assert.equal(bank.balance,capital);
  assert(city.bank.withdraw(bank,c.accountId,500));assert.equal(city.bank.savings(c.accountId),1500);
  assert.equal(city.bank.withdraw(null,c.accountId,10),false);assert.equal(city.bank.withdraw(bank,c.accountId,2000),false);
  const loan=city.bank.lend(bank,c.accountId,1000);assert(loan);assert.equal(city.bank.lend(bank,c.accountId,1000),false);
  city.minute+=1440;city.bank.daily();assert(loan.remaining<1000);assert.equal(city.currency.supply(),supply);
});

test('physical pamphlets preserve original events after journal eviction and enforce page capacity',()=>{
  const city=setup({starter:true}),author=city.citizens[3],other=city.citizens[4],hall=city.buildings[0];
  const doc=city.publications.stock(hall,'panfletos',1);hall.inventory.panfletos++;city.economy.initialStock.panfletos++;
  hall.inventory.panfletos--;city.publications.move(doc,author.accountId);
  const event=city.log('Registro original permanente.','city',[author.id],{kind:'audit-original'});
  assert(city.publications.write(doc.id,author.id,{eventId:event.id,type:'event'}));
  assert.equal(city.publications.write(doc.id,other.id,{text:'Sem autorização'}),null);
  assert(city.publications.write(doc.id,author.id,{text:'Segunda informação'}));
  assert.equal(city.publications.write(doc.id,author.id,{text:'Terceira informação'}),null);
  for(let i=0;i<HISTORY_LIMIT+600;i++)city.log(`Retenção ${i}`);
  assert.equal(city.history.get(event.id),undefined);assert.equal(city.publications.eventSnapshot(event.id).message,event.message);
  const graph=new CityStateGraph(),mirror=new CityStateGraph(),state=mirror.apply(structuredClone(graph.encode({city,nextId:10000})));bindCityState(state.city);
  assert.equal(state.city.publications.eventSnapshot(event.id).data.kind,'audit-original');
});
