import {baseTerrainTile,TILE_WATER,TILE_VOID,TILE_ROAD_GRASS,TILE_ROAD_GRASS_STONE,TILE_ROAD_SAND,TILE_ROAD_SAND_STONE,TILE_ROAD_HILL,TILE_ROAD_HILL_STONE} from './world_gen.js?v=deep-perf-3';

const HEIGHTS=[1.1,5.5,0,.4,3.8,0,1.1,.4,1.1,2.3,7.5,.4,2.3,2.3];
const ROADS=new Set([TILE_ROAD_GRASS,TILE_ROAD_GRASS_STONE,TILE_ROAD_SAND,TILE_ROAD_SAND_STONE,TILE_ROAD_HILL,TILE_ROAD_HILL_STONE]);
const CORNERS=[[0,0],[1,0],[1,1],[0,1]];
const EDGES=[{dx:0,dy:-1,a:0,b:1},{dx:1,dy:0,a:1,b:2},{dx:0,dy:1,a:3,b:2},{dx:-1,dy:0,a:0,b:3}];
const caches=new WeakMap();

export const terrainTileHeight=tile=>HEIGHTS[baseTerrainTile(tile)]??0;
const at=(world,x,y)=>x<0||y<0||x>=world.width||y>=world.height?TILE_VOID:world.map?world.map[y*world.width+x]:world.getTile(x,y);
function cacheFor(world){
  let cache=caches.get(world);
  if(!cache||cache.map!==world.map||cache.width!==world.width||cache.height!==world.height){
    const size=(world.width+1)*(world.height+1);
    cache={map:world.map,width:world.width,height:world.height,revision:world.revision,generation:1,values:new Float64Array(size),marks:new Uint32Array(size),roads:new Map(),sidewalks:new Map()};
    caches.set(world,cache);
  }
  if(cache.revision!==world.revision){cache.revision=world.revision;cache.roads.clear();cache.sidewalks.clear();cache.generation=(cache.generation+1)>>>0;if(!cache.generation){cache.marks.fill(0);cache.generation=1;}}
  return cache;
}
function naturalCorner(world,x,y){
  let sum=0,count=0;
  for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++){const tile=at(world,x+dx,y+dy);if(tile!==TILE_WATER&&tile!==TILE_VOID){sum+=terrainTileHeight(tile);count++;}}
  return count?sum/count:0;
}
export function terrainCornerHeight(world,x,y){
  if(!Number.isFinite(world.revision)||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>world.width||y>world.height)return naturalCorner(world,x,y);
  const cache=cacheFor(world),index=y*(world.width+1)+x;
  if(cache.marks[index]!==cache.generation){cache.values[index]=naturalCorner(world,x,y);cache.marks[index]=cache.generation;}
  return cache.values[index];
}

// Only connected streets determine the road grade. An uphill bank beside a
// level road must not pull that road sideways into a ramp.
function connectedRoadCorner(world,x,y,vx,vy){
  const tiles=[at(world,vx-1,vy-1),at(world,vx,vy-1),at(world,vx-1,vy),at(world,vx,vy)];
  let mask=0;for(let i=0;i<4;i++)if(ROADS.has(tiles[i]))mask|=1<<i;
  let component=1<<((y===vy?2:0)+(x===vx?1:0)),previous;
  do{
    previous=component;
    if(component&1)component|=mask&6;
    if(component&2)component|=mask&9;
    if(component&4)component|=mask&9;
    if(component&8)component|=mask&6;
  }while(component!==previous);
  let sum=0,count=0;for(let i=0;i<4;i++)if(component&(1<<i)){sum+=terrainTileHeight(tiles[i]);count++;}
  return sum/count;
}
export function roadSurfaceCorners(world,x,y){
  if(!ROADS.has(at(world,x,y)))return null;
  const cache=Number.isFinite(world.revision)?cacheFor(world):null,key=y*world.width+x;
  if(cache?.roads.has(key))return cache.roads.get(key);
  const north=ROADS.has(at(world,x,y-1)),east=ROADS.has(at(world,x+1,y)),south=ROADS.has(at(world,x,y+1)),west=ROADS.has(at(world,x-1,y));
  const horizontal=east||west,vertical=north||south;
  const corners=CORNERS.map(([dx,dy])=>{
    // Leave the end apron joined to ordinary ground (and building entrances).
    const openEnd=(!horizontal&&!vertical)||(horizontal&&!vertical&&!(dx?east:west))||(vertical&&!horizontal&&!(dy?south:north));
    return openEnd?terrainCornerHeight(world,x+dx,y+dy):connectedRoadCorner(world,x,y,x+dx,y+dy);
  });
  cache?.roads.set(key,corners);
  return corners;
}

// Each panel closes the actual gap between the road mesh and the bank mesh.
// Splitting where the two profiles cross avoids a slab above either surface.
const sidewalkAt=(world,x,y)=>{
  if(!world.sidewalkTiles?.has(y*world.width+x))return false;
  return [[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>ROADS.has(at(world,x+dx,y+dy)));
};
export function sidewalkSurfaceCorners(world,x,y){
  if(!sidewalkAt(world,x,y))return null;
  const cache=Number.isFinite(world.revision)?cacheFor(world):null,key=y*world.width+x;
  if(cache?.sidewalks.has(key))return cache.sidewalks.get(key);
  const sums=[0,0,0,0],counts=[0,0,0,0],add=(indices,values)=>indices.forEach((index,i)=>{sums[index]+=values[i];counts[index]++;});
  const north=roadSurfaceCorners(world,x,y-1),east=roadSurfaceCorners(world,x+1,y),south=roadSurfaceCorners(world,x,y+1),west=roadSurfaceCorners(world,x-1,y);
  // Match only the shared edge. Opposing streets can have different ramp
  // heights, so their edges must remain independent instead of being averaged.
  if(north)add([0,1],[north[3],north[2]]);
  if(south)add([3,2],[south[0],south[1]]);
  if(west)add([0,3],[west[1],west[2]]);
  if(east)add([1,2],[east[0],east[3]]);
  const corners=sums.map((sum,i)=>counts[i]?sum/counts[i]:NaN),coords=[[0,0],[1,0],[1,1],[0,1]];
  const extend=(target,source)=>{if(!Number.isFinite(corners[target])&&Number.isFinite(corners[source]))corners[target]=corners[source];};
  if(north&&!south){extend(3,0);extend(2,1);}else if(south&&!north){extend(0,3);extend(1,2);}
  if(west&&!east){extend(1,0);extend(2,3);}else if(east&&!west){extend(0,1);extend(3,2);}
  for(let i=0;i<4;i++)if(!Number.isFinite(corners[i])){
    let nearest=Infinity,total=0,count=0;
    for(let j=0;j<4;j++)if(Number.isFinite(corners[j])){const distance=Math.abs(coords[i][0]-coords[j][0])+Math.abs(coords[i][1]-coords[j][1]);if(distance<nearest){nearest=distance;total=corners[j];count=1;}else if(distance===nearest){total+=corners[j];count++;}}
    corners[i]=count?total/count:terrainCornerHeight(world,x+coords[i][0],y+coords[i][1]);
  }
  cache?.sidewalks.set(key,corners);return corners;
}
export function streetSurfaceCorners(world,x,y){return roadSurfaceCorners(world,x,y)||sidewalkSurfaceCorners(world,x,y);}

export function roadRetainingFaces(world,x,y){
  const surface=streetSurfaceCorners(world,x,y);if(!surface)return [];
  const faces=[];
  for(let side=0;side<EDGES.length;side++){
    const edge=EDGES[side],nx=x+edge.dx,ny=y+edge.dy,neighbor=at(world,nx,ny),neighborIsStreet=ROADS.has(neighbor)||sidewalkAt(world,nx,ny);
    if(world.bridgeTiles?.has(`${nx},${ny}`))continue;
    const [ax,ay]=CORNERS[edge.a],[bx,by]=CORNERS[edge.b];
    if(neighborIsStreet){
      if(ny*world.width+nx<y*world.width+x)continue;
      const other=streetSurfaceCorners(world,nx,ny);if(!other)continue;
      const opposite=side===0?[3,2]:side===1?[0,3]:side===2?[0,1]:[1,2],surfaceA=surface[edge.a],surfaceB=surface[edge.b],otherA=other[opposite[0]],otherB=other[opposite[1]],deltaA=otherA-surfaceA,deltaB=otherB-surfaceB;
      if(Math.max(Math.abs(deltaA),Math.abs(deltaB))<.015)continue;
      const cuts=deltaA*deltaB<0?[0,deltaA/(deltaA-deltaB),1]:[0,1];
      for(let i=1;i<cuts.length;i++){
        const from=cuts[i-1],to=cuts[i],a=surfaceA+(otherA-surfaceA)*from,b=surfaceA+(otherA-surfaceA)*to,c=surfaceB+(otherB-surfaceB)*from,d=surfaceB+(otherB-surfaceB)*to;
        faces.push({side,from,to,ax:x+ax+(bx-ax)*from,ay:y+ay+(by-ay)*from,bx:x+ax+(bx-ax)*to,by:y+ay+(by-ay)*to,lowA:Math.min(a,c),lowB:Math.min(b,d),highA:Math.max(a,c),highB:Math.max(b,d)});
      }
      continue;
    }
    const waterOrVoid=neighbor===TILE_WATER||neighbor===TILE_VOID,base=waterOrVoid?0.08:null,groundA=base??terrainCornerHeight(world,x+ax,y+ay),groundB=base??terrainCornerHeight(world,x+bx,y+by),surfaceA=surface[edge.a],surfaceB=surface[edge.b];
    const deltaA=groundA-surfaceA,deltaB=groundB-surfaceB;
    if(Math.max(Math.abs(deltaA),Math.abs(deltaB))<.02)continue;
    const cuts=deltaA*deltaB<0?[0,deltaA/(deltaA-deltaB),1]:[0,1];
    for(let i=1;i<cuts.length;i++){
      const from=cuts[i-1],to=cuts[i],ra=surfaceA+(surfaceB-surfaceA)*from,rb=surfaceA+(surfaceB-surfaceA)*to,ga=groundA+(groundB-groundA)*from,gb=groundA+(groundB-groundA)*to;
      faces.push({side,from,to,ax:x+ax+(bx-ax)*from,ay:y+ay+(by-ay)*from,bx:x+ax+(bx-ax)*to,by:y+ay+(by-ay)*to,lowA:Math.min(ra,ga),lowB:Math.min(rb,gb),highA:Math.max(ra,ga),highB:Math.max(rb,gb)});
    }
  }
  return faces;
}

export function terrainSurfaceElevation(world,x,y){
  const tx=Math.floor(x),ty=Math.floor(y);if(at(world,tx,ty)===TILE_WATER)return .08;
  const surface=streetSurfaceCorners(world,tx,ty),u=x-tx,v=y-ty;
  const h00=surface?surface[0]:terrainCornerHeight(world,tx,ty),h10=surface?surface[1]:terrainCornerHeight(world,tx+1,ty),h11=surface?surface[2]:terrainCornerHeight(world,tx+1,ty+1),h01=surface?surface[3]:terrainCornerHeight(world,tx,ty+1);
  // Use the same diagonal as the rendered triangles, including non-planar turns.
  return u<=v?h00*(1-v)+h01*(v-u)+h11*u:h00*(1-u)+h10*(u-v)+h11*v;
}
