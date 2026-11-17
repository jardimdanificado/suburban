import test from 'node:test';
import assert from 'node:assert/strict';
import {CityEconomy} from '../js/city_economy.js';

function fixture(){
 const owner=(id,balance,rentalPreference,extra={})=>({id,accountId:`person:${id}`,balance,rentalPreference,homeUnitId:null,age:30,entity:{destroyed:false},...extra});
 const citizens=[owner(1,2400,.9),owner(2,5000,.9),owner(3,5000,.5),owner(4,5000,.9,{age:10}),owner(5,2400,.9,{entity:{destroyed:true}})];
 const sites=new Map(['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing','market'].map((type,i)=>[i+1,{id:i+1,type}]));
 const units=new Map();
 const add=(id,ownerId,buildingId=1,extra={})=>units.set(id,{id,ownerId,buildingId,tenantId:null,forSale:false,forRent:false,...extra});
 for(let i=1;i<=5;i++)for(const c of citizens)add(`${c.id}:${i}`,c.accountId,i);
 add('occupied','person:1',1,{tenantId:'tenant',forRent:true});
 add('home','person:1');citizens[0].homeUnitId='home';
 add('commercial','person:1',6);add('missing','person:1',99);add('municipal','treasury');
 const city={citizens,units,buildings:[],traffic:new Map(),bank:{daily(){}},society:{isAdult:c=>c.age>=18},building:id=>sites.get(id)};
 const economy=Object.assign(Object.create(CityEconomy.prototype),{city,municipalPolicy(){},investInHousing(){},assignHomes(){},updateDemand(){}});
 return {city,economy};
}

test('daily listings preserve owner liquidity, preference and all residential categories in one registry pass',()=>{
 const {city,economy}=fixture(),values=city.units.values.bind(city.units);let passes=0;
 city.units.values=function*(){passes++;yield*values();};
 economy.daily();assert.equal(passes,1);
 for(let i=1;i<=5;i++){
  assert.deepEqual([city.units.get(`1:${i}`).forSale,city.units.get(`1:${i}`).forRent],[true,false]);
  assert.deepEqual([city.units.get(`2:${i}`).forSale,city.units.get(`2:${i}`).forRent],[false,true]);
  assert.deepEqual([city.units.get(`3:${i}`).forSale,city.units.get(`3:${i}`).forRent],[true,false]);
  for(const id of [4,5])assert.deepEqual([city.units.get(`${id}:${i}`).forSale,city.units.get(`${id}:${i}`).forRent],[false,false]);
 }
 for(const id of ['home','commercial','missing','municipal'])assert.deepEqual([city.units.get(id).forSale,city.units.get(id).forRent],[false,false]);
 assert.deepEqual([city.units.get('occupied').forSale,city.units.get('occupied').forRent],[false,true]);
});

test('daily listings rebuild ownership after a transfer and use current balances and preferences',()=>{
 const {city,economy}=fixture();economy.daily();
 const unit=city.units.get('1:1');unit.ownerId='person:2';
 economy.daily();assert.deepEqual([unit.forSale,unit.forRent],[false,true]);
 city.citizens[1].balance=1000;economy.daily();assert.deepEqual([unit.forSale,unit.forRent],[true,false]);
 city.citizens[1].balance=5000;city.citizens[1].rentalPreference=.75;
 economy.daily();assert.deepEqual([unit.forSale,unit.forRent],[false,true]);
 city.citizens[1].homeUnitId=unit.id;unit.forSale=unit.forRent=false;
 economy.daily();assert.deepEqual([unit.forSale,unit.forRent],[false,false]);
});
