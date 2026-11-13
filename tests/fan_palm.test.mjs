import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CityNature,PLANT_SPECIES} from '../js/city_nature.js';

function fixture(species='licuala_palm'){
 const city={structureRevision:0,world:{},economy:{produced:{madeira:0},buySeeds(){}},log:()=>({id:1})},nature=new CityNature(city);
 const tree={id:1,species,x:2,y:2,stage:'mature',entity:{properties:{species,render:{}}}};
 nature.plants.set(1,tree);nature.tiles.set('2,2',tree);
 const worker={id:2,entity:{x:2.5,y:2.5,properties:{name:'Trabalhador'}},skills:{agriculture:0}};
 return {city,nature,tree,worker,building:{id:3,door:{x:2.5,y:2.5}}};
}

test('fan palms cannot be harvested or selected for timber, including saved cut jobs',()=>{
 const {city,nature,tree,worker,building}=fixture();assert.equal(PLANT_SPECIES.licuala_palm.wood,0);
 assert.equal(nature.forestryTree(building),undefined);
 assert.equal(nature.harvest(building,tree,worker),false);assert(nature.plants.has(tree.id));assert(!tree.entity.destroyed);assert.equal(city.economy.produced.madeira,0);
 worker.forestryJob={buildingId:building.id,treeId:tree.id,x:2.5,y:2.5,stage:'cut',labor:100};
 assert.equal(nature.forestryWork(building,worker),false);assert.equal(worker.forestryJob,null);assert(nature.plants.has(tree.id));
});

test('timber palms still produce their configured wood',()=>{
 const {city,nature,tree,worker,building}=fixture('coconut_palm');
 assert(nature.harvest(building,tree,worker));assert.equal(city.economy.produced.madeira,PLANT_SPECIES.coconut_palm.wood);assert(tree.entity.destroyed);assert(!nature.plants.has(tree.id));
});

// Execute the renderer's actual palm branch with matrices that capture instance transforms.
const source=readFileSync(new URL('../js/renderer_3d.js',import.meta.url),'utf8');
const branch=source.slice(source.indexOf("else if(e.properties.species==='traveller_palm'&&travellerPalmCount<this.maxInstances){"),source.indexOf('else if (isTree && !isPine && !isPalm'));
const render=new Function('e','r','mMatrix','scaleMatrix','getTreeVisualScale',`let palmCount=0,fanPalmCount=0,palmFrondCount=0,travellerPalmCount=0;const surfaceH=2,isPalm=true;if(false){} ${branch}`);
class Matrix{
 makeRotationY(){this.scale=[1,1,1];return this;}
 makeScale(...scale){this.scale=scale;return this;}
 multiply(matrix){this.scale=matrix.scale.slice();return this;}
 setPosition(...position){this.position=position;return this;}
}
function transforms(species){
 const captured={},mesh=key=>({setMatrixAt(index,matrix){captured[key]={scale:matrix.scale.slice(),position:matrix.position.slice()};}});
 const renderer={maxInstances:10,instTravellerPalms:mesh('traveller'),instPalmTrunks:mesh('trunk'),instFanPalmFronds:mesh('fan'),instPalmFronds:mesh('fronds')};
 const entity={x:4,y:5,properties:{species,cityPlant:{form:PLANT_SPECIES[species].form}}};
 render.call(renderer,entity,{size:1},new Matrix(),new Matrix(),()=>1);return captured;
}
test('fan palms have a short basal stem and broad fans near ground; tall palms retain height',()=>{
 const low=transforms('licuala_palm'),coconut=transforms('coconut_palm'),traveller=transforms('traveller_palm');
 assert(low.trunk.scale[1]*4.05<.4);assert(low.fan.position[1]+low.fan.scale[1]*4.56-2<1.1);
 assert(low.fan.position[1]+low.fan.scale[1]*3.05>=2);assert.equal(low.fan.scale[0],1);assert.equal(low.fan.scale[2],1);
 assert(Math.abs(low.fan.position[1]+low.fan.scale[1]*3.05-(2+low.trunk.scale[1]*4.05))<.01);
 assert.deepEqual(coconut.trunk.scale,[1,1,1]);assert.deepEqual(coconut.fronds.scale,[1,1,1]);assert.deepEqual(traveller.traveller.scale,[1,1,1]);assert.equal(traveller.fan,undefined);assert.equal(traveller.trunk,undefined);
});
