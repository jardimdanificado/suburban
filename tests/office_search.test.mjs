import test from 'node:test';
import assert from 'node:assert/strict';
import {officeFloors,prepareOfficeSearch,officeStartupCost,rentAvailableOffice} from '../js/city_offices.js';
import {CityEconomy} from '../js/city_economy.js';

function fixture(){
 const units=Array.from({length:24},(_,i)=>({z:i%3,ownerId:'citizen:1',occupantId:i%3===2?'business:9':null,rent:10+i,forRent:i%3!==2}));
 const tower={id:1,type:'office_tower',active:true,municipal:false,accountId:'business:1',entity:{destroyed:false},floors:3,units};
 const founders=[{id:1,accountId:'citizen:1',balance:100,entity:{destroyed:false},businessIds:[]},{id:2,accountId:'citizen:2',balance:100,entity:{destroyed:false},businessIds:[]}];
 const city={buildings:[tower],citizens:founders,accounts:new Map(),currency:{price:n=>n},politics:{parties:[],canOwnBusiness:()=>true}};
 const economy=Object.assign(Object.create(CityEconomy.prototype),{city,demands:[{type:'newsroom',score:100}]});city.economy=economy;
 return {city,economy,tower,founders};
}

test('office grouping preserves unit order, occupied floors and rents',()=>{
 const {city,tower}=fixture(),rows=officeFloors(city,tower);
 for(const row of rows){const expected=tower.units.filter(u=>u.z===row.floor);assert.deepEqual(row.units,expected);assert.equal(row.rent,expected.reduce((n,u)=>n+u.rent,0));assert.equal(row.tenantId,row.floor===2?'business:9':null);}
});

test('a scoped office search matches live startup budgets and reservation checks',()=>{
 const {city,founders}=fixture(),search=prepareOfficeSearch(city);
 for(const founder of founders){assert.equal(officeStartupCost(city,founder,search),officeStartupCost(city,founder));assert.equal(rentAvailableOffice(city,'newsroom',founder,{search}),null);assert.equal(rentAvailableOffice(city,'newsroom',founder),null);}
 city.politics.parties=[{active:true},{active:true}];const reserved=prepareOfficeSearch(city);
 assert.equal(reserved.vacant,reserved.reserved);assert.equal(rentAvailableOffice(city,'newsroom',founders[0],{search:reserved}),null);
});

test('investment never borrows for office floors reserved for headquarters',()=>{
 const {city,economy}=fixture();city.politics.parties=[{active:true},{active:true}];
 city.bank={available(){throw Error('No business loan should be attempted without a rentable floor');}};
 assert.equal(economy.investInOfficeBusiness(),false);
});
