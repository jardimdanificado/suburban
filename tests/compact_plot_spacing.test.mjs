import test from 'node:test';
import assert from 'node:assert/strict';
import {CityDevelopment} from '../js/city_development.js';
import {WorldClock} from '../js/world.js';

function fixture(){
 const world={width:128,height:128,spawnCenter:{x:64,y:64},clock:new WorldClock(),revision:0,getTile(x,y){return x>=0&&y>=0&&x<128&&y<128?0:5;}};
 const city={world,minute:0,day:1,occupied:new Set(),buildings:[],currency:{price:n=>n}};
 const dev=new CityDevelopment(city);city.development=dev;return {city,dev};
}
function gap(a,b){return Math.max(a.x-b.x-b.width,b.x-a.x-a.width,a.y-b.y-b.depth,b.y-a.y-a.depth);}

test('compact catalogue leaves room for opposing balconies and pedestrian passage',()=>{
 const {dev}=fixture();dev.ensurePlots(18);
 const urban=dev.plots.filter(p=>p.type!=='farm'&&p.type!=='quarry');
 assert.equal(urban.length,18,'ample flat land must supply the full catalogue');
 for(let i=0;i<urban.length;i++)for(let j=0;j<i;j++)assert(gap(urban[i],urban[j])>=3,`parcels ${urban[i].id} and ${urban[j].id} leave only ${gap(urban[i],urban[j])} cells`);
});

test('spacing detects nearby plots across spatial index bucket boundaries',()=>{
 const {dev}=fixture();const first=dev.createPlot(6,16,3,3);assert(first);
 assert.equal(dev.createPlot(10,16,3,3),null);
 assert.equal(dev.createPlot(11,16,3,3),null);
 assert(dev.createPlot(12,16,3,3));
 assert.equal(dev.removePlot(first),true);
 assert(dev.createPlot(6,16,3,3));
});

test('legacy registered parcels remain valid without moving existing property',()=>{
 const {dev}=fixture();dev.plots.push({id:1,x:6,y:16,width:3,depth:3},{id:2,x:10,y:16,width:3,depth:3});
 assert.equal(dev.overlaps(6,16,3,3,1),false);
 assert.equal(dev.overlaps(10,16,3,3,2),false);
 assert.equal(dev.overlaps(14,16,3,3),true);
});

test('public works register a spaced frontier parcel when the catalogue is occupied',()=>{
 const {city,dev}=fixture();city.buildingTypes={clinic:{label:'Clínica'}};city.log=()=>{};
 const occupied=dev.createPlot(64,64,3,3);occupied.buildingId=1;
 const site=dev.publicBuildingSite('clinic');assert(site,dev.publicLandReport?.reason);
 assert(dev.publicLandReport.created);assert(gap(occupied,site.lot)>=3);
});

test('urban catalogue includes narrow and wide parcels and counts elongated lots as stock',()=>{
 const {city,dev}=fixture();dev.ensurePlots(18);
 const urban=dev.plots.filter(p=>!['farm','quarry'].includes(p.type));
 assert(urban.some(p=>p.width===2&&p.depth===10));
 assert(urban.some(p=>p.width===10&&p.depth===2));
 assert(new Set(urban.map(p=>`${p.width}x${p.depth}`)).size>=6);
 const count=dev.plots.length;city.minute=120;dev.ensurePlots(18);
 assert.equal(dev.plots.length,count,'elongated plots must count toward the existing supply');
});
