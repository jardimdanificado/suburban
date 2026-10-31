import {baseTerrainTile} from './world_gen.js?v=deep-perf-3';
import {businessFloors} from './city_business_heights.js';
import {INITIAL_CYCLE_STAGES} from './city_cycle_startup.js?v=initial-cycle-ref-1';
import {buildingEntrance} from './city_building_geometry.js';
import {OFFICE_BUSINESSES} from './city_offices.js?v=office-demand-rollout-1';
import { TILE_FLOOR, TILE_SAND, TILE_HILL, TILE_STONE, TILE_WATER, TILE_VOID, TILE_ROAD_GRASS, TILE_ROAD_GRASS_STONE, TILE_ROAD_SAND, TILE_ROAD_SAND_STONE, TILE_ROAD_HILL, TILE_ROAD_HILL_STONE } from './world_gen.js?v=deep-perf-3';

const heights = [1.1, 5.5, 0, .4, 3.8, 0, 1.1, .4, 1.1, 2.3, 7.5, .4, 2.3, 2.3];
export const ROAD_TILES = new Set([TILE_ROAD_GRASS, TILE_ROAD_GRASS_STONE, TILE_ROAD_SAND, TILE_ROAD_SAND_STONE, TILE_ROAD_HILL, TILE_ROAD_HILL_STONE]);
export const DIRT_ROAD_TILES = new Set([TILE_ROAD_GRASS,TILE_ROAD_SAND,TILE_ROAD_HILL]);
export const PAVED_ROAD_TILES = new Set([TILE_ROAD_GRASS_STONE,TILE_ROAD_SAND_STONE,TILE_ROAD_HILL_STONE]);
export const ROAD_RULES = Object.freeze({dirtCost:.8,pavedCost:.55,degradeAt:30,wearPerCell:.01,hygienePerDirtCell:.025,moodPerDirtCell:.006});
const land = new Set([TILE_FLOOR, TILE_SAND, TILE_HILL, ...ROAD_TILES]);
export const tileKey = (x, y) => `${x},${y}`;
export const tileHeight = tile => heights[baseTerrainTile(tile)] ?? 0;
export function tileAt(world, x, y) { return x < 0 || y < 0 || x >= world.width || y >= world.height ? TILE_VOID : world.getTile(x, y); }
export function bridgeAt(world,x,y){return world.bridgeTiles?.get(tileKey(x,y))||null;}
export function isRoadAt(world,x,y){return ROAD_TILES.has(tileAt(world,x,y))||!!bridgeAt(world,x,y);}
export function flagNightFactor(world){const hour=(world?.clock?.hour??12)+(world?.clock?.minute??0)/60;let glow=0;if(hour<5.5||hour>=19)glow=1;else if(hour<7)glow=1-(hour-5.5)/1.5;else if(hour>17.5)glow=(hour-17.5)/1.5;return 1-.82*Math.max(0,Math.min(1,glow));}
export function terrainWalkable(world, x, y) { return land.has(baseTerrainTile(tileAt(world, x, y)))||!!bridgeAt(world,x,y); }
export function canStep(world, x, y, nx, ny) { const a=bridgeAt(world,x,y)?.height??tileHeight(tileAt(world,x,y)),b=bridgeAt(world,nx,ny)?.height??tileHeight(tileAt(world,nx,ny));return terrainWalkable(world, nx, ny) && Math.abs(a-b) <= 1.25; }
export function roadFor(tile) {
  if ([TILE_FLOOR, TILE_ROAD_GRASS, TILE_ROAD_GRASS_STONE].includes(tile)) return TILE_ROAD_GRASS_STONE;
  if ([TILE_SAND, TILE_ROAD_SAND, TILE_ROAD_SAND_STONE].includes(tile)) return TILE_ROAD_SAND_STONE;
  if ([TILE_HILL, TILE_ROAD_HILL, TILE_ROAD_HILL_STONE].includes(tile)) return TILE_ROAD_HILL_STONE;
  return null;
}
export function dirtRoadFor(tile){
  if([TILE_FLOOR,TILE_ROAD_GRASS,TILE_ROAD_GRASS_STONE].includes(tile))return TILE_ROAD_GRASS;
  if([TILE_SAND,TILE_ROAD_SAND,TILE_ROAD_SAND_STONE].includes(tile))return TILE_ROAD_SAND;
  if([TILE_HILL,TILE_ROAD_HILL,TILE_ROAD_HILL_STONE].includes(tile))return TILE_ROAD_HILL;
  return null;
}
export function roadTravelCost(tile){return PAVED_ROAD_TILES.has(tile)?ROAD_RULES.pavedCost:DIRT_ROAD_TILES.has(tile)?ROAD_RULES.dirtCost:baseTerrainTile(tile)===TILE_HILL?1.6:baseTerrainTile(tile)===TILE_SAND?1.2:1;}
export function wearRoad(world,x,y,amount){
  const tile=tileAt(world,x,y);if(!PAVED_ROAD_TILES.has(tile)||!(amount>0))return;
  const key=tileKey(x,y),condition=Math.max(0,(world.roadCondition?.get(key)??100)-amount);
  const conditions=world.roadCondition??=new Map();
  if(condition<=ROAD_RULES.degradeAt){world.setTile(x,y,dirtRoadFor(tile));conditions.delete(key);}
  else conditions.set(key,condition);
}
export function layDirtPath(world,path){
  for(const p of path){const x=Math.floor(p.x),y=Math.floor(p.y),tile=tileAt(world,x,y);if(ROAD_TILES.has(tile))continue;const road=dirtRoadFor(tile);if(road!==null)world.setTile(x,y,road);}
}
// Match the renderer's interpolated corners, without changing any terrain tile.
const cornerCaches=new WeakMap();
function computeCornerHeight(world,x,y){
  let sum=0,count=0;
  for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++){const tile=tileAt(world,x+dx,y+dy);if(tile!==TILE_WATER&&tile!==TILE_VOID){sum+=tileHeight(tile);count++;}}
  return count?sum/count:0;
}
export function cornerHeight(world,x,y){
  if(!Number.isFinite(world.revision)||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>world.width||y>world.height)return computeCornerHeight(world,x,y);
  let cache=cornerCaches.get(world);
  if(!cache||cache.width!==world.width||cache.height!==world.height){const size=(world.width+1)*(world.height+1);cache={width:world.width,height:world.height,values:new Float64Array(size),marks:new Uint32Array(size),generation:0};cornerCaches.set(world,cache);}
  if(cache.revision!==world.revision){cache.revision=world.revision;cache.generation=(cache.generation+1)>>>0;if(!cache.generation){cache.marks.fill(0);cache.generation=1;}}
  const index=y*(cache.width+1)+x;
  if(cache.marks[index]!==cache.generation){cache.values[index]=computeCornerHeight(world,x,y);cache.marks[index]=cache.generation;}
  return cache.values[index];
}

export function surfaceBounds(world, x, y, width, depth) {
  let min = Infinity, max = -Infinity;
  for (let yy = y; yy <= y + depth; yy++) for (let xx = x; xx <= x + width; xx++) {
    const height = cornerHeight(world, xx, yy); min = Math.min(min, height); max = Math.max(max, height);
  }
  return { min, max, variation: max - min, base: max + .06 };
}
export function surfaceElevation(world, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y), u = x - tx, v = y - ty;
  return cornerHeight(world, tx, ty) * (1 - u) * (1 - v) + cornerHeight(world, tx + 1, ty) * u * (1 - v) + cornerHeight(world, tx, ty + 1) * (1 - u) * v + cornerHeight(world, tx + 1, ty + 1) * u * v;
}
/** A saleable plot has one elevation, including its interpolated surface and entrance. */
export function flatSiteLevel(world, x, y, width, depth) {
  const level = tileHeight(tileAt(world, x, y));
  for (let yy = y; yy < y + depth; yy++) for (let xx = x; xx < x + width; xx++) {
    if (!terrainWalkable(world, xx, yy) || tileHeight(tileAt(world, xx, yy)) !== level) return null;
  }
  const surface = surfaceBounds(world, x, y, width, depth);
  const doorLevel = tileHeight(tileAt(world, x + Math.floor(width / 2), y + depth));
  return surface.variation < .001 && Math.abs(surface.min - level) < .001 && doorLevel === level ? level : null;
}
export function buildingGround(world, x, y, width, depth, entrance = null) {
  const terrain = surfaceBounds(world, x, y, width, depth);
  const door = entrance||buildingEntrance(x,y,width,depth);
  return { ...terrain, base: Math.max(terrain.base, surfaceElevation(world, door.x, door.y) + .06), door };
}
// One synchronous investment round often tests the same lot for many trades.
// Keep this scratch state outside the city graph and discard it after the round.
const buildingSiteSearches=new WeakMap();
export function beginBuildingSiteSearch(city,stats=null){
  const previous=buildingSiteSearches.get(city),search={signature:null,orientations:new Map(),blocked:new Map(),stats};
  buildingSiteSearches.set(city,search);
  return ()=>{if(previous)buildingSiteSearches.set(city,previous);else buildingSiteSearches.delete(city);};
}
const copyBuildingSite=site=>({...site,...(site.door?{door:{...site.door}}:{}),...(site.access?{access:site.access.map(p=>({...p}))}:{})});
export function chooseBuildingSite(city,x,y,width,depth,{plotId=null,type=null,rotation=null}={}){
  if(rotation!==null&&(!Number.isInteger(rotation)||rotation<0||rotation>3))return {error:'Rotação inválida.'};
  const first=rotation??Math.floor(city.random()*4),hub=city.buildings.find(b=>!b.entity.destroyed)?.door;
  const search=buildingSiteSearches.get(city);
  if(search?.stats)search.stats.calls=(search.stats.calls||0)+1;
  if(search){
    const signature=`${city.world.revision||0}:${city.world.bridgeRevision||0}:${city.obstacleRevision||0}:${city.occupied.size}:${city.world.parkingTiles?.size||0}:${city.world.width}:${city.world.height}:${hub?.x}:${hub?.y}:`+city.development.plots.map(p=>`${p.id},${p.x},${p.y},${p.width},${p.depth}`).join(';');
    if(signature!==search.signature){search.signature=signature;search.orientations.clear();search.blocked.clear();}
  }
  const footprint=`${x},${y},${width},${depth},${plotId}`,category=['quarry','iron_mine','bauxite_mine'].includes(type)?'quarry':type==='farm'?'farm':'building';
  let error='Nenhuma orientação permite acesso ao terreno.',accessBlocked=search?.blocked.get(footprint)||null;
  for(let attempt=0;attempt<(rotation===null?4:1);attempt++){
    const turn=(first+attempt)%4,key=`${footprint}:${category}:${turn}`,cached=search?.orientations.get(key);
    if(cached){if(search.stats)search.stats.orientationHits=(search.stats.orientationHits||0)+1;if(cached.inaccessible)continue;if(cached.error){error=cached.error;continue;}return copyBuildingSite(cached);}
    if(search?.stats)search.stats.inspections=(search.stats.inspections||0)+1;
    const site=inspectBuildingSite(city,x,y,width,depth,{plotId,type,rotation:turn});
    if(site.error){error=site.error;search?.orientations.set(key,site);continue;}
    if(hub&&!accessBlocked){
      // Plot boundaries are fixed throughout this search. Rasterize once instead
      // of scanning every registered plot for every neighbor visited by A*.
      const mapWidth=city.world.width,mapHeight=city.world.height;accessBlocked=new Uint8Array(mapWidth*mapHeight);
      for(const cell of city.occupied){const comma=cell.indexOf(','),cx=Number(cell.slice(0,comma)),cy=Number(cell.slice(comma+1));if(cx>=0&&cy>=0&&cx<mapWidth&&cy<mapHeight)accessBlocked[cy*mapWidth+cx]=1;}
      const mark=(px,py,w,d)=>{const x0=Math.max(0,px),x1=Math.min(mapWidth,px+w);if(x0>=x1)return;for(let yy=Math.max(0,py);yy<Math.min(mapHeight,py+d);yy++)accessBlocked.fill(1,yy*mapWidth+x0,yy*mapWidth+x1);};
      mark(x,y,width,depth);for(const p of city.development.plots)if(p.id!==plotId)mark(p.x,p.y,p.width,p.depth);
      search?.blocked.set(footprint,accessBlocked);
    }
    if(hub&&search?.stats)search.stats.pathSearches=(search.stats.pathSearches||0)+1;
    const access=hub?findTerrainPath(city.world,site.door,hub,city.occupied,{blockedGrid:accessBlocked,preferRoads:false}):[];
    if(access!==null){const result={...site,access};search?.orientations.set(key,result);return search?copyBuildingSite(result):result;}
    search?.orientations.set(key,{inaccessible:true});
  }
  return {error};
}

export function inspectBuildingSite(city, x, y, width, depth, { plotId = null, type = null, rotation = 0 } = {}) {
  if (city.development?.overlaps(x, y, width, depth, plotId)) return { error: 'Este espaço já pertence a um terreno cadastrado.' };
  const { world, occupied } = city;
  const quarry = type === 'quarry' || type === 'iron_mine' || type === 'bauxite_mine';
  for (let yy = y - 1; yy <= y + depth; yy++) for (let xx = x - 1; xx <= x + width; xx++) {
    if (occupied.has(tileKey(xx, yy))) return { error: 'Deixe uma célula livre entre os prédios.' };
    if (xx >= x && xx < x + width && yy >= y && yy < y + depth) {
      if (!terrainWalkable(world, xx, yy) && !(quarry && tileAt(world, xx, yy) === TILE_STONE)) return { error: 'O prédio precisa caber em terra firme, fora da água e das encostas rochosas.' };
      if (ROAD_TILES.has(tileAt(world, xx, yy))||world.parkingTiles?.has(tileKey(xx,yy))) return { error: 'A construção não pode ocupar uma rua.' };
    }
  }
  let door = buildingEntrance(x,y,width,depth,rotation);
  if (quarry || type === 'farm') {
    if (quarry && world.map && !quarryDeposits(world, x, y, width, depth).length) return { error: 'A área da pedreira precisa ocupar rochas.' };
    const doors = [door];
    for (let dx = 0; dx < width; dx++) { doors.push({ x: x + dx + .5, y: y + depth + .5 }, { x: x + dx + .5, y: y - .5 }); }
    for (let dy = 0; dy < depth; dy++) { doors.push({ x: x - .5, y: y + dy + .5 }, { x: x + width + .5, y: y + dy + .5 }); }
    door = doors.find(p => terrainWalkable(world, Math.floor(p.x), Math.floor(p.y)) && !occupied.has(tileKey(Math.floor(p.x), Math.floor(p.y))));
    if (!door) return { error: quarry ? 'A pedreira precisa de uma entrada acessível junto às rochas.' : 'A fazenda precisa de uma entrada acessível em terra firme.' };
  }
  if (!terrainWalkable(world, Math.floor(door.x), Math.floor(door.y))) return { error: 'A entrada precisa ter acesso por terra firme.' };
  const terrain = buildingGround(world, x, y, width, depth,door);
  if (!quarry && type !== 'farm' && (terrain.variation > 1.3 || terrain.base - tileHeight(tileAt(world, Math.floor(door.x), Math.floor(door.y))) > 1.65)) return { error: 'Encosta muito íngreme. Escolha um lote menor ou outro trecho do terreno.' };
  return { ...terrain, door, rotation };
}

const pathWorkspaces = new WeakMap();
const pathTerrainGrids = new WeakMap();
const pathDirections = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const tileCosts=(()=>{const values=new Float64Array(256);for(let tile=0;tile<values.length;tile++)values[tile]=roadTravelCost(tile);return values;})();
function terrainPathGrid(world){
  let grid=pathTerrainGrids.get(world);if(grid&&grid.revision===(world.revision||0)&&grid.width===world.width&&grid.height===world.height)return grid;
  const size=world.width*world.height,tiles=new Uint8Array(size),walkable=new Uint8Array(size),roads=new Uint8Array(size),elevations=new Float32Array(size),source=world.map;
  for(let i=0;i<size;i++){const tile=baseTerrainTile(source?source[i]:world.getTile(i%world.width,Math.floor(i/world.width)));tiles[i]=tile;walkable[i]=land.has(tile)?1:0;roads[i]=ROAD_TILES.has(tile)?1:0;elevations[i]=tileHeight(tile);}
  for(const [key,bridge]of world.bridgeTiles||[]){const comma=key.indexOf(','),x=Number(key.slice(0,comma)),y=Number(key.slice(comma+1)),index=y*world.width+x;if(x>=0&&y>=0&&x<world.width&&y<world.height){walkable[index]=1;roads[index]=1;elevations[index]=bridge.height;}}
  grid={revision:world.revision||0,width:world.width,height:world.height,tiles,walkable,roads,elevations};pathTerrainGrids.set(world,grid);return grid;
}
function heapPush(w,node,cost,score){
  let cap=w.heapNodes.length;if(w.heapLength===cap){cap=Math.max(64,cap*2);const nodes=new Int32Array(cap),costs=new Float64Array(cap),scores=new Float64Array(cap);nodes.set(w.heapNodes);costs.set(w.heapCosts);scores.set(w.heapScores);w.heapNodes=nodes;w.heapCosts=costs;w.heapScores=scores;}
  const nodes=w.heapNodes,costs=w.heapCosts,scores=w.heapScores;let i=w.heapLength++;
  while(i>0){const p=(i-1)>>1;if(scores[p]<=score)break;nodes[i]=nodes[p];costs[i]=costs[p];scores[i]=scores[p];i=p;}
  nodes[i]=node;costs[i]=cost;scores[i]=score;
}
function heapPop(w){
  const nodes=w.heapNodes,costs=w.heapCosts,scores=w.heapScores,first=nodes[0];w.poppedCost=costs[0];const last=w.heapLength-1;w.heapLength=last;if(!last)return first;
  const node=nodes[last],cost=costs[last],score=scores[last];let i=0;
  while(i*2+1<last){let child=i*2+1;if(child+1<last&&scores[child+1]<scores[child])child++;if(scores[child]>=score)break;nodes[i]=nodes[child];costs[i]=costs[child];scores[i]=scores[child];i=child;}
  nodes[i]=node;costs[i]=cost;scores[i]=score;return first;
}

// Many residents travel to the same few doors. Expand a reverse shortest-path
// tree once per popular destination, then reuse its next steps for each origin.
// One-off requests keep A*. Destination and origin caches have separate cell budgets.
const sharedDestinations=new WeakMap();
function makeSharedField(size,root,requests=0){
  const field={requests,costs:new Float64Array(size),next:new Int32Array(size),closed:new Uint8Array(size),heapNodes:new Int32Array(0),heapCosts:new Float64Array(0),heapScores:new Float64Array(0),heapLength:0};
  field.costs.fill(Infinity);field.next.fill(-1);field.costs[root]=0;heapPush(field,root,0,0);return field;
}
function countRouteRequest(requests,key){
  const count=(requests.get(key)||0)+1;
  if(requests.size>=512&&!requests.has(key))requests.delete(requests.keys().next().value);
  requests.set(key,count);return count;
}
export function findSharedTerrainPath(city,start,goal,blockedGrid){
  const world=city.world,width=world.width,height=world.height,size=width*height;
  const sx=Math.floor(start.x),sy=Math.floor(start.y),gx=Math.floor(goal.x),gy=Math.floor(goal.y);
  if(sx<0||sy<0||gx<0||gy<0||sx>=width||gx>=width||sy>=height||gy>=height)return null;
  const origin=sy*width+sx,destination=gy*width+gx,terrain=terrainPathGrid(world);
  if(blockedGrid[origin])return undefined;
  if(!terrain.walkable[origin]||!terrain.walkable[destination]||blockedGrid[destination])return null;
  const revision=`${world.revision||0}:${city.obstacleRevision||0}:${city.occupied.size}:${width}:${height}`,profile=city._pathSearchProfile;
  let cache=sharedDestinations.get(city);
  if(!cache||cache.revision!==revision){
    cache={revision,requests:new Map(),sourceRequests:new Map(),fields:new Map(),sources:new Map()};sharedDestinations.set(city,cache);
    if(profile)profile.fieldResets=(profile.fieldResets||0)+1;
  }
  const sourceRequests=countRouteRequest(cache.sourceRequests,origin);
  let field=cache.fields.get(destination),reverse=true;
  if(field)field.requests++;
  else{
    field=cache.sources.get(origin);
    if(field){reverse=false;cache.sources.delete(origin);cache.sources.set(origin,field);}
  }
  if(!field){
    const requests=countRouteRequest(cache.requests,destination);
    if(requests>=4){
      const capacity=Math.max(1,Math.min(16,Math.floor(1048576/size)));
      let admit=cache.fields.size<capacity;
      if(!admit){
        let victim=null,fewest=Infinity;for(const [key,item]of cache.fields)if(item.requests<fewest){victim=key;fewest=item.requests;}
        if(requests>fewest+4){cache.fields.delete(victim);admit=true;}
      }
      if(admit){field=makeSharedField(size,destination,requests);cache.fields.set(destination,field);if(profile)profile.destinationFields=(profile.destinationFields||0)+1;}
    }
    // A citizen comparing many services (or bridge entrances) also repeats one
    // origin with different goals. Reuse that forward search even when none of
    // those destinations qualifies for the popular-destination cache.
    if(!field&&sourceRequests>=3){
      const capacity=Math.max(1,Math.min(4,Math.floor(262144/size)));
      if(cache.sources.size>=capacity)cache.sources.delete(cache.sources.keys().next().value);
      field=makeSharedField(size,origin);cache.sources.set(origin,field);reverse=false;if(profile)profile.sourceFields=(profile.sourceFields||0)+1;
    }
  }
  if(!field)return undefined;
  const target=reverse?origin:destination;
  while(!field.closed[target]&&field.heapLength){
    const current=heapPop(field),cost=field.poppedCost;
    if(field.closed[current]||cost!==field.costs[current])continue;
    field.closed[current]=1;
    const x=current%width,y=Math.floor(current/width),heightHere=terrain.elevations[current];
    const enteringCost=terrain.roads[current]?ROAD_RULES.pavedCost:tileCosts[terrain.tiles[current]];
    for(const [dx,dy]of pathDirections){
      const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;
      const neighbor=ny*width+nx,climb=Math.abs(heightHere-terrain.elevations[neighbor]);
      if(field.closed[neighbor]||!terrain.walkable[neighbor]||blockedGrid[neighbor]||climb>1.25)continue;
      const edgeCost=reverse?enteringCost:terrain.roads[neighbor]?ROAD_RULES.pavedCost:tileCosts[terrain.tiles[neighbor]],candidate=cost+edgeCost+climb*.7;
      if(candidate>=field.costs[neighbor])continue;
      field.costs[neighbor]=candidate;field.next[neighbor]=current;heapPush(field,neighbor,candidate,candidate);
    }
  }
  if(!field.closed[target])return null;
  const path=[];
  if(reverse){for(let current=origin;current!==destination;){current=field.next[current];path.push({x:current%width+.5,y:Math.floor(current/width)+.5});}}
  else{for(let current=destination;current!==origin;current=field.next[current])path.push({x:current%width+.5,y:Math.floor(current/width)+.5});path.reverse();}
  return path;
}

// Reachability does not need a shortest path for every pair of businesses.
// Label the settlement's walkable components once per obstacle/terrain change.
// A component touching the edge may connect outside the window: fall back to A*.
const settlementComponents = new WeakMap();
export function settlementConnected(city, a, b) {
  const world=city.world,revision=`${world.topologyRevision??world.revision}:${city.obstacleRevision||0}:${city.occupied.size}`;
  let cache=settlementComponents.get(city);
  if(!cache||cache.revision!==revision){
    let x0=world.width-1,y0=world.height-1,x1=0,y1=0;
    for(const building of city.buildings){if(building.entity.destroyed)continue;const {x,y}=building.door;x0=Math.min(x0,Math.floor(x));y0=Math.min(y0,Math.floor(y));x1=Math.max(x1,Math.floor(x));y1=Math.max(y1,Math.floor(y));}
    x0=Math.max(0,x0-24);y0=Math.max(0,y0-24);x1=Math.min(world.width-1,x1+24);y1=Math.min(world.height-1,y1+24);
    const width=x1-x0+1,height=y1-y0+1;
    cache={revision,x0,y0,x1,y1,width,height,labels:width*height<=262144?new Uint32Array(width*height):null,sealed:[false],next:1};
    settlementComponents.set(city,cache);
  }
  const {x0,y0,x1,y1,width,labels}=cache;
  if(!labels)return null;
  const point=p=>{const x=Math.floor(p.x),y=Math.floor(p.y);return x<x0||y<y0||x>x1||y>y1||!city.walkable(x,y)?null:{x,y,index:(y-y0)*width+x-x0};};
  const start=point(a),goal=point(b);if(!start||!goal)return null;
  function component(p){
    if(labels[p.index])return labels[p.index];
    const label=cache.next++,queue=[p.index];labels[p.index]=label;let sealed=true;
    for(let head=0;head<queue.length;head++){
      const index=queue[head],x=index%width+x0,y=Math.floor(index/width)+y0;
      if(x===x0&&x0>0||y===y0&&y0>0||x===x1&&x1<world.width-1||y===y1&&y1<world.height-1)sealed=false;
      for(const [dx,dy]of pathDirections){const nx=x+dx,ny=y+dy,ni=(ny-y0)*width+nx-x0;
        if(nx<x0||ny<y0||nx>x1||ny>y1||labels[ni]||!city.walkable(nx,ny)||!canStep(world,x,y,nx,ny))continue;
        labels[ni]=label;queue.push(ni);
      }
    }
    cache.sealed[label]=sealed;return label;
  }
  const ac=component(start),bc=component(goal);
  return ac===bc?true:cache.sealed[ac]||cache.sealed[bc]?false:null;
}

export function findTerrainPath(world, start, goal, blocked = new Set(), { limit = 30000, extraBlocked = null,preferRoads=true,roadOnly=false,blockedGrid=null } = {}) {
  const sx = Math.floor(start.x), sy = Math.floor(start.y), gx = Math.floor(goal.x), gy = Math.floor(goal.y);
  if(sx<0||sy<0||gx<0||gy<0||sx>=world.width||gx>=world.width||sy>=world.height||gy>=world.height)return null;
  const terrain=terrainPathGrid(world),startKey=sy*world.width+sx,goalKey=gy*world.width+gx;
  if (!terrain.walkable[startKey] || !terrain.walkable[goalKey] || blocked.has(tileKey(gx, gy))) return null;
  // Search the much smaller street network first. Keep off-road shortcuts when
  // following the streets would cost more than a near-direct walk on flat land.
  if(preferRoads&&!extraBlocked&&terrain.roads[startKey]&&terrain.roads[goalKey]){
    const direct=Math.abs(gx-sx)+Math.abs(gy-sy),roadPath=findTerrainPath(world,start,goal,blocked,{limit:Math.min(limit,Math.max(128,direct*24)),preferRoads:false,roadOnly:true,blockedGrid});
    if(roadPath){let cost=0,previous=startKey;for(const p of roadPath){const x=Math.floor(p.x),y=Math.floor(p.y),key=y*world.width+x,tile=terrain.tiles[key];cost+=(terrain.roads[key]?ROAD_RULES.pavedCost:tileCosts[tile])+Math.abs(terrain.elevations[key]-terrain.elevations[previous])*.7;previous=key;}
      if(cost<=direct*1.05)return roadPath;
    }
  }
  const width = world.width, size = width * world.height;
  let workspace = pathWorkspaces.get(world);
  if (!workspace || workspace.costs.length !== size) {
    workspace = { costs: new Float64Array(size), parents: new Int32Array(size), marks: new Uint32Array(size), generation: 0,heapNodes:new Int32Array(0),heapCosts:new Float64Array(0),heapScores:new Float64Array(0),heapLength:0 };
    pathWorkspaces.set(world, workspace);
  }
  workspace.generation = (workspace.generation + 1) >>> 0;
  if (!workspace.generation) { workspace.marks.fill(0); workspace.generation = 1; }
  const { costs, parents, marks, generation } = workspace;
  workspace.heapLength=0;costs[startKey] = 0; marks[startKey] = generation;
  heapPush(workspace,startKey,0,0);
  let visited = 0;
  while (workspace.heapLength && visited++ < limit) {
    const k=heapPop(workspace),currentCost=workspace.poppedCost;
    if (marks[k] !== generation || currentCost !== costs[k]) continue;
    if (k === goalKey) {
      const path = []; let step = goalKey;
      while (step !== startKey) { path.push({ x: step % width + .5, y: Math.floor(step / width) + .5 }); step = parents[step]; }
      return path.reverse();
    }
    const currentHeight=terrain.elevations[k],cx=k%width,cy=Math.floor(k/width);
    for (const [dx, dy] of pathDirections) {
      const x=cx+dx,y=cy+dy;if(x<0||y<0||x>=width||y>=world.height)continue;const nextKey=y*width+x,tile=terrain.tiles[nextKey],height=terrain.elevations[nextKey];
      if (!terrain.walkable[nextKey] || Math.abs(currentHeight-height)>1.25 || (blockedGrid?blockedGrid[nextKey]!==0:blocked.has(tileKey(x, y))) || extraBlocked?.(x, y)) continue;
      if(roadOnly&&!terrain.roads[nextKey])continue;
      const cost = currentCost + (terrain.roads[nextKey]?ROAD_RULES.pavedCost:tileCosts[tile]) + Math.abs(height-currentHeight) * .7;
      if (marks[nextKey] === generation && cost >= costs[nextKey]) continue;
      marks[nextKey] = generation; costs[nextKey] = cost; parents[nextKey] = k;
      heapPush(workspace,nextKey,cost,cost+(Math.abs(gx-x)+Math.abs(gy-y))*.55);
    }

  }
  return null;
}

export function hasSettlementAccess(world, door, x, y, width, depth) {
  const start = [Math.floor(door.x), Math.floor(door.y)], queue = [start], seen = new Set([tileKey(...start)]);
  for (let head = 0; head < queue.length && seen.size < 256; head++) {
    const [cx, cy] = queue[head];
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, key = tileKey(nx, ny);
      if (seen.has(key) || (nx >= x && nx < x + width && ny >= y && ny < y + depth) || !canStep(world, cx, cy, nx, ny)) continue;
      seen.add(key); queue.push([nx, ny]);
    }
  }
  return seen.size >= 256;
}

export function pavePath(world, path) {
  for (const p of path) { const x = Math.floor(p.x), y = Math.floor(p.y), tile = tileAt(world, x, y), road = roadFor(tile); if (road !== null && road !== tile) {world.setTile(x, y, road);(world.roadCondition??=new Map()).set(tileKey(x,y),100);} }
}

export function generateSettlement(city) {
  const { world } = city;
  const origin = { ...world.spawnCenter };
  let hub = null;
  const hallFloors=Math.min(8,Math.max(2,Math.ceil((city.initialPopulation||0)/80)));
  // Build civic/essential premises and a final assembler only; component makers
  // are demand-driven businesses instead of a guaranteed starter supply chain.
  const officeTypes=['builder','bank','carrier','newsroom','research_institute','research_institute','publisher'].filter(type=>OFFICE_BUSINESSES.has(type));
  const specs = [['townhall', 4, 4, hallFloors], ['office_tower', 3, 3, officeTypes.length+5], ['quarry', 4, 4, 1], ['mint', 3, 3, 1], ['bike_rack',4,2,1], ['cycle_assembler',3,3,businessFloors('cycle_assembler','startup')], ['bike_rack',4,2,1], ['public_toilet',4,4,4], ['popular_refectory',4,4,4], ['cleaner',3,3,businessFloors('cleaner','startup')]];
  for (const [type, w, d, h] of specs) {
    const angle = city.random() * Math.PI * 2, radius = hub ? (type==='bike_rack'?4+city.random()*3:8+city.random()*13) : 0;
    const preferred = { x: (hub?.x ?? origin.x) + Math.cos(angle) * radius, y: (hub?.y ?? origin.y) + Math.sin(angle) * radius };
    let placed = null;
    for (const searchRadius of [24, 48, 96]) {
      const candidates = [];
      const center = hub || origin;
      for (let y = Math.max(1, Math.floor(center.y - searchRadius)); y < Math.min(world.height - d - 1, center.y + searchRadius); y++) for (let x = Math.max(1, Math.floor(center.x - searchRadius)); x < Math.min(world.width - w - 1, center.x + searchRadius); x++) {
        const site = inspectBuildingSite(city, x, y, w, d, { type });
        if (site.error) continue;
        if (type === 'quarry' && world.map && !quarryDeposits(world, x, y, w, d).length) continue;
        const score = Math.hypot(x - preferred.x, y - preferred.y) + site.variation * 8 + city.random() * 3 + (flatSiteLevel(world, x, y, w, d) === null ? 10000 : 0);
        candidates.push({ x, y, score });
      }
      candidates.sort((a, b) => a.score - b.score);
      for (const candidate of candidates.slice(0, 100)) {
        placed = city.addBuilding(type, candidate.x, candidate.y, { width: w, depth: d, floors: h, free: true });
        if (placed) break;
      }
      if (placed) break;
    }
    if(!placed&&INITIAL_CYCLE_STAGES.includes(type)){(city.initialCycleSitesMissing??=[]).push(type);continue;}
    if(placed&&INITIAL_CYCLE_STAGES.includes(type))placed.initialCycleChain=true;
    if(placed&&type==='office_tower')placed.initialOfficeTypes=officeTypes;
    if (!placed) throw new Error(`Não há terreno acessível para ${type}. Experimente outra semente.`);
    if (!hub) { hub = { ...placed.door }; city.spawn = { ...hub }; }
  }
  const xs = city.buildings.map(b => b.entity.x + b.width / 2), ys = city.buildings.map(b => b.entity.y + b.depth / 2);
  world.spawnCenter = { x: Math.round(xs.reduce((a, b) => a + b) / xs.length), y: Math.round(ys.reduce((a, b) => a + b) / ys.length) };
  city.bounds = { minX: Math.min(...xs) - 12, maxX: Math.max(...xs) + 12, minY: Math.min(...ys) - 12, maxY: Math.max(...ys) + 12 };
}

// Extraction is tied to rocky tiles inside the quarry footprint.
export function quarryDeposits(world, x, y, width, depth) {
  const deposits = [];
  for (let yy = y; yy < y + depth; yy++) for (let xx = x; xx < x + width; xx++) {
    if (tileAt(world, xx, yy) === TILE_STONE) deposits.push({ x: xx, y: yy });
  }
  return deposits;
}
