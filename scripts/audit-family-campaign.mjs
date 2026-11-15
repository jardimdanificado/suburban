import {World} from '../js/world.js';
import {CitySimulation} from '../js/city_simulation.js';
import {familyOffers,familyBusinesses,familyMembers} from '../js/city_family_campaign.js';

// Play through public family commands only. Production, construction, walking,
// needs, hiring and delivery all advance through the actual simulation.
const seed=Number(process.env.SUBURBAN_FAMILY_SEED)||1337;
const population=Number(process.env.SUBURBAN_FAMILY_POPULATION)||24;
const days=Number(process.env.SUBURBAN_FAMILY_DAYS)||7;
let id=0;
const world=new World(1,seed,128);
const city=new CitySimulation({world,population,seed,startFoundingWorks:true,createEntity:data=>({id:++id,destroyed:false,...data})});
city.initialize();
const leader=city.citizens.find(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)&&!c.businessIds.length);
if(!leader||!city.familyAction('start',{citizenId:leader.id,profile:'artisan'}))throw Error(city.lastError||'No eligible campaign founder');
if(!city.familyAction('found',{type:'farm'}))throw Error(city.lastError);
const foundingFarm=familyBusinesses(city).find(b=>b.type==='farm');
if(foundingFarm)city.familyAction('fund',{buildingId:foundingFarm.id,amount:50000});
let homeProject=null,lastDay=city.day,firstDeliveryAt=null;
const checkpoints=[];
for(let i=0;i<days*1440;i++){
  const state=city.familyCampaign,farms=familyBusinesses(city).filter(b=>b.type==='farm'&&b.crop==='milho');
  if(city.minute%10===0){
    const offer=familyOffers(city).find(o=>o.good==='milho');
    if(offer&&farms[0]&&!state.contracts.some(r=>r.status==='active'))city.familyAction('accept',{offerId:offer.id,buildingId:farms[0].id});
    for(const r of state.contracts.filter(r=>r.status==='active')){
      const b=city.building(r.sellerId);if(b?.inventory[r.good]>0)city.familyAction('dispatch',{contractId:r.id});
    }
    if(!homeProject&&state.contracts.some(r=>r.status==='completed')){
      const ownLot=city.development.plots.find(p=>p.ownerId===leader.accountId&&!p.buildingId&&!p.projectId&&!['farm','quarry'].includes(p.type));
      const lot=ownLot||city.development.plots.filter(p=>p.forSale&&p.ownerId==='treasury'&&!p.buildingId&&!p.projectId&&!['farm','quarry'].includes(p.type)&&p.width>=2&&p.depth>=2).sort((a,b)=>a.price-b.price)[0];
      const budget=city.currency.price(450000)+(ownLot?0:lot?.price||0);
      if(lot&&leader.balance>=budget&&(ownLot||city.familyAction('buyPlot',{plotId:lot.id}))){
        const project=city.familyAction('build',{plotId:lot.id,type:'residential'});
        if(project)homeProject=project.id;
      }
    }
    const home=[...city.housing.homes.values()].find(h=>city.housing.units(h).every(u=>u.ownerId===leader.accountId));
    if(home&&!leader.homeUnitId)city.familyAction('home',{homeId:home.id});
  }
  city.update(.25);
  firstDeliveryAt??=state.contracts.find(r=>r.status==='completed')?.closedAt??null;
  if(city.currency.supply()!==city.currency.netIssued())throw Error(`Money conservation failed at ${city.minute}`);
  if(city.day!==lastDay||state.wonAt!=null){
    lastDay=city.day;
    const point={day:city.day,minute:city.minute,contracts:state.contracts.map(r=>({id:r.id,status:r.status,delivered:r.delivered})),progress:state.progress,homeProject:city.development.projects.find(p=>p.id===homeProject)?.status,family:familyMembers(city).map(c=>({id:c.id,home:!!c.homeUnitId,food:Math.round(c.needs.food),health:Math.round(c.needs.health)}))};
    checkpoints.push(point);console.log(JSON.stringify(point));
  }
  if(state.wonAt!=null)break;
}
const result={seed,population,minute:city.minute,status:city.familyCampaign.status,firstDeliveryAt,wonAt:city.familyCampaign.wonAt,homeProject,progress:city.familyCampaign.progress,moneyConserved:city.currency.supply()===city.currency.netIssued()};
console.log(JSON.stringify({result,checkpoints}));
if(firstDeliveryAt==null)process.exitCode=1;
