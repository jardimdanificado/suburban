import {World} from '../js/world.js';
import {CitySimulation} from '../js/city_simulation.js';
import {governmentPerformance} from '../js/city_government_performance.js';
const population=Number(process.env.SUBURBAN_ECON_POPULATION)||64,days=Number(process.env.SUBURBAN_ECON_DAYS)||70,seed=Number(process.env.SUBURBAN_ECON_SEED)||1337;
let nextId=1;const world=new World(1,seed,128),city=new CitySimulation({world,population,seed,createEntity:data=>({id:nextId++,destroyed:false,...data})});city.initialize();
const started=performance.now(),snapshots=[];
for(let i=0;i<days*1440;i++){
 city.update(.25);
 if(city.minute%1440===0){const p=governmentPerformance(city),f=city.fiscal.report(),row={day:city.day,population:city.citizens.filter(c=>!c.entity.destroyed).length,treasury:city.treasury,unemployment:Number(p.unemploymentRate.toFixed(2)),vacancies:city.stats().vacancies,approval:Number(city.politics.approval.toFixed(2)),economicHealth:Number(p.economicHealth.toFixed(2)),municipalSolvency:p.municipalSolvency,exports:city.economy.municipalExports?.revenue||0,loans:city.bank.loans.length,privateBanks:city.economy.businesses.filter(b=>b.type==='bank'&&!b.municipal).length,operatingBalance:f.operatingBalance,externalNet:city.currency.externalNet,moneyConserved:city.currency.supply()===city.currency.netIssued()};snapshots.push(row);if(city.day%5===0||city.day===2||city.day===days+1)console.log(JSON.stringify(row));}
}
console.log(JSON.stringify({seed,population,days,elapsedMs:Math.round(performance.now()-started),snapshots}));
