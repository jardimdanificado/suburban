import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {career,contract,qualification,apply,recordWork,reviewMarket,renderResume,workEfficiency,reviewWages} from '../js/city_employment.js';
import {CityStateGraph,bindCityState} from '../js/city_state.js';
function fixture(){
 const city=setup({starter:true,population:48}),b=city.buildings.find(b=>b.type==='quarry');
 const c=city.citizens.find(c=>!city.politics.officeHolder(c)&&!c.businessIds.length);
 city.economy.leaveJob(c);career(c).applications=[];city.economy.configureEmployment(b.id,{minSkill:0,minExperienceMinutes:0,minRating:0});
 return {city,b,c};
}
test('companies have individual salary bases, respect the minimum and accept employment policy changes',()=>{
 const {city,b}=fixture(),other=city.buildings.find(f=>f.type==='builder');
 assert.notEqual(b.baseWage,other.baseWage);
 city.economy.configureEmployment(b.id,{baseWage:1,minSkill:20,minExperienceMinutes:480,minRating:60,allowTraining:false});
 assert(b.wage>=city.currency.price(city.politics.policy.minimumWage));assert.equal(b.hiringPolicy.minExperienceMinutes,480);
});
test('experience requires paid work and references survive termination and journal trimming',()=>{
 const {city,b,c}=fixture();c.jobId=b.id;b.workers.push(c.id);city.history.employment(c,b,'contratação');
 const before=totalMoney(city);for(let i=0;i<65;i++){city.minute++;assert(city.payWage(c,b));}
 const row=career(c).jobs.at(-1);assert.equal(row.workedMinutes,65);assert.equal(career(c).worked.mining,65);assert(row.rating>50);assert.equal(totalMoney(city),before);
 city.economy.leaveJob(c,'Mudança de carreira');assert.equal(row.endedAt,city.minute);assert.equal(row.reason,'Mudança de carreira');
 assert.equal(qualification(city,c,b).experience,65);
});
test('higher pay improves motivation and efficiency; lack of payment never grants experience',()=>{
 const {city,b,c}=fixture(),other=city.citizens.find(x=>x.id!==c.id&&!city.politics.officeHolder(x));
 c.jobId=other.jobId=b.id;const floor=city.currency.price(city.politics.policy.minimumWage||5);
 for(let i=0;i<100;i++){city.minute++;recordWork(city,c,b,floor,true);recordWork(city,other,b,floor*3,true);}
 assert(career(other).motivation>career(c).motivation);assert(workEfficiency(other,b)>workEfficiency(c,b));
 const worked=career(c).worked.mining;city.minute++;recordWork(city,c,b,floor,false);assert.equal(career(c).worked.mining,worked);
});
test('strict recruitment rejects unproven experience and entry-level jobs allow training',()=>{
 const {city,b,c}=fixture();city.minute=600;
 city.economy.configureEmployment(b.id,{minSkill:90,minExperienceMinutes:480,minRating:60,allowTraining:false});
 const a=apply(city,c,b);assert.equal(a.status,'reprovado');assert.match(a.reason,/experiência comprovada/);
 city.economy.configureEmployment(b.id,{minExperienceMinutes:0,minRating:0,allowTraining:true});assert(qualification(city,c,b).trainee);
});
test('employed candidates wait for selection and switch only after a better offer is approved',()=>{
 const {city,b,c}=fixture(),old=city.buildings.find(x=>x.type==='builder');city.minute=600;
 for(const person of city.citizens)if(person!==c){city.economy.leaveJob(person);if(!city.politics.officeHolder(person))person.businessIds=[-1];}
 for(const f of city.buildings){f.workers=f.workers.filter(id=>id===city.economy.mayorId);f.jobs=f.workers.length;}
 c.jobId=old.id;old.workers.push(c.id);old.jobs=old.workers.length;b.jobs=1;
 city.economy.configureEmployment(old.id,{baseWage:5});city.economy.configureEmployment(b.id,{baseWage:20});
 city.economy.staffEssentials=()=>{};career(c).nextSearchAt=0;
 reviewMarket(city,[b]);const application=career(c).applications.at(-1);assert.equal(application.status,'análise');
 city.economy.hire();assert.equal(c.jobId,old.id);
 city.minute+=61;city.economy.hire();assert.equal(c.jobId,b.id);assert.equal(application.status,'aprovado');assert(!old.workers.includes(c.id));assert.equal(b.workers.filter(id=>id===c.id).length,1);
});
test('resume renders career and selection records without relying on old events',()=>{
 const {city,b,c}=fixture();contract(city,c,b);apply(city,c,b);const labels=[];
 const p=Object.fromEntries(['heading','meter','note','button','kv','record'].map(k=>[k,(...args)=>labels.push(args.join(' '))]));
 renderResume({city,openBuilding(){}},p,c,String);assert(labels.some(s=>s.includes('CURRÍCULO')));assert(labels.some(s=>s.includes(b.entity.properties.name)));assert(labels.some(s=>s.includes('PROCESSOS SELETIVOS')));
});
test('career records and company requirements survive worker serialization',()=>{
 const {city,b,c}=fixture();c.jobId=b.id;recordWork(city,c,b,b.wage,true);city.economy.configureEmployment(b.id,{minExperienceMinutes:100});
 const writer=new CityStateGraph(),reader=new CityStateGraph(),root=reader.apply(writer.encode({city}));bindCityState(root.city);
 assert.equal(root.city.society.citizen(c.id).career.jobs.at(-1).workedMinutes,1);assert.equal(root.city.building(b.id).hiringPolicy.minExperienceMinutes,100);
});

test('persistent vacancies raise company offers only with sustainable payroll cash',()=>{
 const {city,b}=fixture();b.jobs=b.workers.length+1;reviewWages(city,b);const base=b.baseWage;
 city.minute+=1440;b.balance=0;reviewWages(city,b);assert.equal(b.baseWage,base);
 city.minute+=1440;assert(city.transfer('treasury',b.accountId,1000000,'Fixture wage competition'));
 reviewWages(city,b);assert(b.baseWage>base);const revised=b.baseWage;reviewWages(city,b);assert.equal(b.baseWage,revised);
});
