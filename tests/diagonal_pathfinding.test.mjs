import test from 'node:test';
import assert from 'node:assert/strict';
import {findTerrainPath,findSharedTerrainPath,roadTravelCost,tileHeight,terrainWalkable,settlementConnected} from '../js/city_terrain.js';
import {TILE_FLOOR,TILE_WATER,TILE_STONE,TILE_HILL,TILE_ROAD_GRASS_STONE,TILE_SAND} from '../js/world_gen.js';
function fixture(size=8){
 const world={width:size,height:size,revision:1,map:new Uint8Array(size*size).fill(TILE_FLOOR),getTile(x,y){return this.map[y*size+x];}};
 return {world,occupied:new Set(),blocked:new Uint8Array(size*size),obstacleRevision:0};
}
const point=(x,y)=>({x:x+.5,y:y+.5});
function cost(city,start,path){let previous=start,total=0;for(const p of path){const tile=city.world.getTile(Math.floor(p.x),Math.floor(p.y)),last=city.world.getTile(Math.floor(previous.x),Math.floor(previous.y));total+=Math.hypot(p.x-previous.x,p.y-previous.y)*roadTravelCost(tile)+Math.abs(tileHeight(tile)-tileHeight(last))*.7;previous=p;}return total;}
function valid(city,start,path){
 let previous=start;
 const free=(x,y)=>terrainWalkable(city.world,x,y)&&!city.blocked[y*city.world.width+x];
 for(const p of path){const x=Math.floor(previous.x),y=Math.floor(previous.y),nx=Math.floor(p.x),ny=Math.floor(p.y);assert.equal(Math.max(Math.abs(nx-x),Math.abs(ny-y)),1);assert(free(nx,ny));if(x!==nx&&y!==ny)for(const [sx,sy] of [[x,ny],[nx,y]]){assert(free(sx,sy));assert(Math.abs(tileHeight(city.world.getTile(sx,sy))-tileHeight(city.world.getTile(x,y)))<=1.25);assert(Math.abs(tileHeight(city.world.getTile(sx,sy))-tileHeight(city.world.getTile(nx,ny)))<=1.25);}previous=p;}
}
test('open terrain uses four diagonals with geometric cost in A*, forward and reverse fields',()=>{
 for(const shared of [false,true]){const city=fixture(),start=point(1,1),goal=point(5,5);for(let i=0;i<6;i++){const path=shared?findSharedTerrainPath(city,start,goal,city.blocked):findTerrainPath(city.world,start,goal);if(path===undefined)continue;assert.equal(path.length,4);assert(Math.abs(cost(city,start,path)-4*Math.SQRT2)<1e-10);valid(city,start,path);}}
});
test('diagonals never cut occupied, water, stone or cliff corners',()=>{
 for(const barrier of ['occupied',TILE_WATER,TILE_STONE,TILE_HILL])for(const side of [[1,0],[0,1]]){
  const city=fixture(2),start=point(0,0),goal=point(1,1),index=side[1]*2+side[0];
  if(barrier===TILE_HILL)city.world.map.fill(TILE_SAND);
  if(barrier==='occupied'){city.blocked[index]=1;city.occupied.add(side.join(','));}else city.world.map[index]=barrier;
  for(let i=0;i<6;i++){const shared=findSharedTerrainPath(city,start,goal,city.blocked),path=shared===undefined?findTerrainPath(city.world,start,goal,city.occupied):shared;assert.equal(path.length,2);valid(city,start,path);}
 }
 const city=fixture(2);city.blocked[1]=city.blocked[2]=1;city.occupied=new Set(['1,0','0,1']);
 assert.equal(findTerrainPath(city.world,point(0,0),point(1,1),city.occupied),null);
 city.buildings=[{entity:{},door:point(0,0)},{entity:{},door:point(1,1)}];city.walkable=(x,y)=>!city.blocked[y*2+x];
 assert.equal(settlementConnected(city,point(0,0),point(1,1)),false);
});
test('extra blockers, blocked grids and road-only searches protect diagonal sides',()=>{
 const city=fixture(2),start=point(0,0),goal=point(1,1);city.blocked[1]=1;
 assert.equal(findTerrainPath(city.world,start,goal,new Set(),{blockedGrid:city.blocked}).length,2);
 assert.equal(findTerrainPath(city.world,start,goal,new Set(),{extraBlocked:(x,y)=>x===1&&y===0}).length,2);
 city.world.map.fill(TILE_ROAD_GRASS_STONE);city.world.map[1]=TILE_FLOOR;city.world.revision++;
 assert.equal(findTerrainPath(city.world,start,goal,new Set(),{roadOnly:true,preferRoads:false}).length,2);
});
// Independent, exhaustive Dijkstra reference checks distance weighting and asymmetric entering costs.
function reference(city,start,goal){
 const w=city.world.width,n=w*w,d=Array(n).fill(Infinity),done=new Set();d[Math.floor(start.y)*w+Math.floor(start.x)]=0;
 const free=(x,y)=>x>=0&&y>=0&&x<w&&y<w&&terrainWalkable(city.world,x,y)&&!city.blocked[y*w+x];
 while(done.size<n){let k=-1;for(let i=0;i<n;i++)if(!done.has(i)&&(k<0||d[i]<d[k]))k=i;if(k<0||d[k]===Infinity)break;done.add(k);const x=k%w,y=Math.floor(k/w),h=tileHeight(city.world.getTile(x,y));
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(!free(nx,ny))continue;const nh=tileHeight(city.world.getTile(nx,ny));if(Math.abs(h-nh)>1.25)continue;if(dx&&dy&&[[x,ny],[nx,y]].some(([sx,sy])=>!free(sx,sy)||Math.abs(tileHeight(city.world.getTile(sx,sy))-h)>1.25||Math.abs(tileHeight(city.world.getTile(sx,sy))-nh)>1.25))continue;const index=ny*w+nx;d[index]=Math.min(d[index],d[k]+Math.hypot(dx,dy)*roadTravelCost(city.world.getTile(nx,ny))+Math.abs(h-nh)*.7);}
 }
 return d[Math.floor(goal.y)*w+Math.floor(goal.x)];
}
test('A*, shared forward and reverse costs match independent Dijkstra on mixed maps',()=>{
 for(let seed=1;seed<=12;seed++){const city=fixture();let state=seed;for(let i=0;i<64;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;city.world.map[i]=[TILE_FLOOR,TILE_SAND,TILE_ROAD_GRASS_STONE,TILE_WATER,TILE_HILL][state%5];}city.world.map[0]=city.world.map[63]=TILE_FLOOR;
  const start=point(0,0),goal=point(7,7),expected=reference(city,start,goal);
  for(let i=0;i<6;i++){const shared=findSharedTerrainPath(city,start,goal,city.blocked),path=shared===undefined?findTerrainPath(city.world,start,goal,new Set(),{preferRoads:false}):shared;if(expected===Infinity)assert.equal(path,null);else{valid(city,start,path);assert(Math.abs(cost(city,start,path)-expected)<1e-8);}}
  // Distinct origins admit the reverse destination field, independently of the forward field above.
  let checked=0;
  for(let index=1;index<63&&checked<6;index++){const origin=point(index%8,Math.floor(index/8));if(!terrainWalkable(city.world,Math.floor(origin.x),Math.floor(origin.y)))continue;checked++;const shared=findSharedTerrainPath(city,origin,goal,city.blocked);if(shared===undefined)continue;const expectedCost=reference(city,origin,goal);if(expectedCost===Infinity)assert.equal(shared,null);else{valid(city,origin,shared);assert(Math.abs(cost(city,origin,shared)-expectedCost)<1e-8);}}
 }
});

test('road construction can keep cardinal routes while pedestrians use diagonals',()=>{
 const city=fixture(),start=point(0,0),goal=point(7,7);
 const path=findTerrainPath(city.world,start,goal,new Set(),{allowDiagonal:false});assert.equal(path.length,14);
 let previous=start;for(const p of path){assert.equal(Math.abs(p.x-previous.x)+Math.abs(p.y-previous.y),1);previous=p;}
});

test('simulation moves diagonally at the same physical speed as cardinal movement',async()=>{
 const {CitySimulation}=await import('../js/city_simulation.js');
 const {bodyMovementSpeedFactor}=await import('../js/city_body_metrics.js');
 const distances=[];
 for(const goal of [point(5,1),point(5,5)]){
  const {world}=fixture(),citizen={entity:point(1,1),path:findTerrainPath(world,point(1,1),goal),task:'walk',bodyHeightCm:170,bodyWeightKg:64};
  const city=Object.assign(Object.create(CitySimulation.prototype),{world,accumulator:0,minute:0,_movingCitizens:[citizen],vehicles:{activeCount:0,update(){}},society:{isAdult:()=>true},justice:{mobilityFactor:()=>1},walkable:()=>true});
  city.update(.1);const distance=Math.hypot(citizen.entity.x-1.5,citizen.entity.y-1.5);assert(Math.abs(distance-.4*bodyMovementSpeedFactor(citizen))<1e-10);distances.push(distance);
 }
 assert(Math.abs(distances[0]-distances[1])<1e-10);
});
