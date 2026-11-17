import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';

for(const [width,depth] of [[2,10],[10,2],[3,12],[12,3]])test(`elongated ${width}x${depth} lot supports construction and its completed building`,()=>{
 const city=setup({starter:true,funded:true}),dev=city.development;
 let lot;
 for(let y=30;y<100&&!lot;y+=4)for(let x=30;x<100&&!lot;x+=4)lot=dev.createPlot(x,y,width,depth);
 assert(lot,'fixture must provide a reachable vacant lot');
 const project=dev.beginProject('treasury',lot.id,'residential',{floors:1,selfBuild:true});
 assert(project,city.lastError);assert.equal(project.width,width);assert.equal(project.depth,depth);
 const building=city.addBuilding('residential',lot.x,lot.y,{width,depth,floors:1,free:true,plotId:lot.id,rotation:project.rotation});
 assert(building,city.lastError);assert.equal(building.width,width);assert.equal(building.depth,depth);
});

test('elongated building support preserves the 64-cell floor area limit',()=>{
 const city=setup({starter:true,funded:true});
 assert.equal(city.addBuilding('residential',8,8,{width:10,depth:7,floors:1,free:true}),null);
 assert.match(city.lastError,/64 células/);
});
