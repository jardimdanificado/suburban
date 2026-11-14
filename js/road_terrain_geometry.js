import {WATER_LEVEL,SAND_WATERLINE_HEIGHT} from './water_surface.js?v=shore-runup-2';
import {baseTerrainTile,TILE_SAND,TILE_STONE,TILE_WATER,TILE_VOID,TILE_ROAD_GRASS,TILE_ROAD_GRASS_STONE,TILE_ROAD_SAND,TILE_ROAD_SAND_STONE,TILE_ROAD_HILL,TILE_ROAD_HILL_STONE} from './world_gen.js?v=terrain-generation-reset-2-map-default-128';

const HEIGHTS=[1.1,5.5,0,.4,3.8,0,1.1,.4,1.1,2.3,7.5,.4,2.3,2.3];
const ROADS=new Set([TILE_ROAD_GRASS,TILE_ROAD_GRASS_STONE,TILE_ROAD_SAND,TILE_ROAD_SAND_STONE,TILE_ROAD_HILL,TILE_ROAD_HILL_STONE]);
const PAVED_ROADS=new Set([TILE_ROAD_GRASS_STONE,TILE_ROAD_SAND_STONE,TILE_ROAD_HILL_STONE]);
export function roadRailingAllowed(world,x,y){
  const tile=at(world,x,y);
  if(ROADS.has(tile))return PAVED_ROADS.has(tile);
  return sidewalkAt(world,x,y)&&[[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>PAVED_ROADS.has(at(world,x+dx,y+dy)));
}
const CORNERS=[[0,0],[1,0],[1,1],[0,1]];
const EDGES=[{dx:0,dy:-1,a:0,b:1},{dx:1,dy:0,a:1,b:2},{dx:0,dy:1,a:3,b:2},{dx:-1,dy:0,a:0,b:3}];
const caches=new WeakMap();

export const terrainTileHeight=tile=>HEIGHTS[baseTerrainTile(tile)]??0;
const at=(world,x,y)=>x<0||y<0||x>=world.width||y>=world.height?TILE_VOID:world.map?world.map[y*world.width+x]:world.getTile(x,y);
function stoneVertexSeed(world,x,y,salt=0){
  let hash=Math.imul((x|0)^((world.seed||0)>>>0)^salt,0x45d9f3b);hash=Math.imul(hash^(hash>>>16)^Math.imul(y|0,0x27d4eb2d),0x45d9f3b);return(hash^(hash>>>16))>>>0;
}
// Broad, continuous relief crosses tile boundaries instead of placing a summit
// at every tile center. Small grain keeps the silhouette from becoming uniform.
function stoneRelief(world,x,y){
  const scale=3.4,u=x/scale,v=y/scale,gx=Math.floor(u),gy=Math.floor(v);
  const smooth=t=>t*t*(3-2*t),sx=smooth(u-gx),sy=smooth(v-gy);
  const sample=(dx,dy)=>stoneVertexSeed(world,gx+dx,gy+dy,0x517cc1b7)/4294967295;
  return ((sample(0,0)*(1-sx)+sample(1,0)*sx)*(1-sy)+(sample(0,1)*(1-sx)+sample(1,1)*sx)*sy-.5)*1.25;
}
function stoneVertexHeight(world,x,y){
  let count=0;for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++)if(baseTerrainTile(at(world,x+dx,y+dy))===TILE_STONE)count++;
  return terrainTileHeight(TILE_STONE)-(4-count)*.08+stoneRelief(world,x,y);
}
function stoneVertexOffset(world,x,y){
  let count=0,cx=0,cz=0;for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++)if(baseTerrainTile(at(world,x+dx,y+dy))===TILE_STONE){count++;cx+=dx+.5;cz+=dy+.5;}
  const inset=count===1?.36:0;
  return {x:cx*inset+(((stoneVertexSeed(world,x,y,0x6d2b79f5)/4294967295)*2)-1)*.11,z:cz*inset+(((stoneVertexSeed(world,x,y,0x1b873593)/4294967295)*2)-1)*.11};
}
export function terrainVertexOffset(world,x,y){
  // Keep vertices shared with streets and sidewalks on the exact grid line.
  // Rocky terrain offsets neighboring vertices for a broken-stone silhouette;
  // carrying that offset through a road edge separates the bank mesh from its
  // retaining face and exposes triangular gaps at the seam.
  for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++)if(ROADS.has(at(world,x+dx,y+dy))||sidewalkAt(world,x+dx,y+dy))return {x:0,z:0};
  for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++)if(baseTerrainTile(at(world,x+dx,y+dy))===TILE_STONE)return stoneVertexOffset(world,x,y);
  return {x:0,z:0};
}
export function terrainTileTouchesStone(world,x,y){
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(baseTerrainTile(at(world,x+dx,y+dy))===TILE_STONE)return true;
  return false;
}
const SAND_MIN_HEIGHT=.34; // Inland sand remains above ordinary wave crests.
function sandVertexHeight(world,x,y){
  const noise=(((stoneVertexSeed(world,x,y,0x3c6ef372)/4294967295)*2)-1);
  const dry=Math.max(SAND_MIN_HEIGHT,terrainTileHeight(TILE_SAND)+noise*.055);
  for(let dz=-1;dz<=0;dz++)for(let dx=-1;dx<=0;dx++){
    const tile=at(world,x+dx,y+dz);
    if(ROADS.has(tile)||baseTerrainTile(tile)===TILE_STONE||sidewalkAt(world,x+dx,y+dz))return dry;
  }
  // Spread the dry approach over three tiles instead of lowering only the
  // last corner. Shared corner heights keep walking, grass and picking aligned.
  let distance=3;
  for(let z=y-3;z<=y+2&&distance>0;z++)for(let tx=x-3;tx<=x+2&&distance>0;tx++){
    if(at(world,tx,z)!==TILE_WATER)continue;
    const dx=Math.max(tx-x,0,x-tx-1),dz=Math.max(z-y,0,y-z-1);
    distance=Math.min(distance,Math.hypot(dx,dz));
  }
  const edge=SAND_WATERLINE_HEIGHT+noise*.003;
  return edge+(dry-edge)*Math.min(1,distance/3);
}
function cacheFor(world){
  let cache=caches.get(world);
  if(!cache||cache.map!==world.map||cache.width!==world.width||cache.height!==world.height){
    const size=(world.width+1)*(world.height+1);
    cache={map:world.map,width:world.width,height:world.height,revision:world.revision,generation:1,values:new Float64Array(size),marks:new Uint32Array(size),roads:new Map(),sidewalks:new Map(),stones:new Map()};
    caches.set(world,cache);
  }
  if(cache.revision!==world.revision){cache.revision=world.revision;cache.roads.clear();cache.sidewalks.clear();cache.stones.clear();cache.generation=(cache.generation+1)>>>0;if(!cache.generation){cache.marks.fill(0);cache.generation=1;}}
  return cache;
}
function naturalCorner(world,x,y){
  let sum=0,count=0;
  for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++){const tx=x+dx,ty=y+dy,tile=at(world,tx,ty);if(tile!==TILE_WATER&&tile!==TILE_VOID){const base=baseTerrainTile(tile);sum+=base===TILE_STONE?stoneVertexHeight(world,x,y):base===TILE_SAND?sandVertexHeight(world,x,y):terrainTileHeight(tile);count++;}}
  return count?sum/count:0;
}
export function terrainCornerHeight(world,x,y){
  if(!Number.isFinite(world.revision)||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>world.width||y>world.height)return naturalCorner(world,x,y);
  const cache=cacheFor(world),index=y*(world.width+1)+x;
  if(cache.marks[index]!==cache.generation){cache.values[index]=naturalCorner(world,x,y);cache.marks[index]=cache.generation;}
  return cache.values[index];
}
// Rocky foothill tiles read better as flat shelves. Keep the surrounding
// grass interpolation intact and let the renderer close the height break with
// a visible stone face.
export function terrainTileSurfaceCorners(world,x,y){
  if(baseTerrainTile(at(world,x,y))!==TILE_STONE)return null;
  return [stoneVertexHeight(world,x,y),stoneVertexHeight(world,x+1,y),stoneVertexHeight(world,x+1,y+1),stoneVertexHeight(world,x,y+1)];
}
export function terrainTileSurfaceVertices(world,x,y){
  const heights=terrainTileSurfaceCorners(world,x,y);if(!heights)return null;
  // Match the road and sidewalk edge exactly. Retaining panels are built on
  // the grid line, so keeping the rocky silhouette offset here opens a wedge
  // between the two meshes at the shared boundary.
  return [[x,y,0],[x+1,y,1],[x+1,y+1,2],[x,y+1,3]].map(([vx,vy,index])=>{const offset=terrainVertexOffset(world,vx,vy);return [vx+offset.x,heights[index],vy+offset.z];});
}

// Shared edge vertices keep independently rebuilt chunks watertight. Eight
// coarse facets replace the flat tile lid without adding objects or materials.
export function terrainStoneSurface(world,x,y){
  if(baseTerrainTile(at(world,x,y))!==TILE_STONE)return null;
  const cache=Number.isFinite(world.revision)?cacheFor(world):null,key=y*world.width+x;
  if(cache?.stones.has(key))return cache.stones.get(key);
  const corners=terrainTileSurfaceVertices(world,x,y),ring=[];
  for(let i=0;i<4;i++){
    const a=corners[i],b=corners[(i+1)%4];
    // Boundary midpoints stay on the existing retaining and cliff panels.
    // Interior edges share their seeded ridge with the adjacent rock tile.
    // Collinear midpoints avoid a repeated ridge along each tile boundary.
    ring.push(a,[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]);
  }
  const u=.34+(stoneVertexSeed(world,x,y,0x165667b1)/4294967295)*.32;
  const v=.34+(stoneVertexSeed(world,x,y,0x85ebca6b)/4294967295)*.32;
  const weights=[(1-u)*(1-v),u*(1-v),u*v,(1-u)*v];
  const centerHeight=corners.reduce((sum,p,i)=>sum+weights[i]*(p[1]-stoneRelief(world,x+CORNERS[i][0],y+CORNERS[i][1])),0)+stoneRelief(world,x+u,y+v);
  const center=[x+u,centerHeight,y+v];
  const surface={ring,center};cache?.stones.set(key,surface);return surface;
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
export function streetSurfaceCorners(world,x,y){
  const tile=at(world,x,y);
  // Unpaved paths follow the natural surface instead of cutting an engineered shelf.
  if(ROADS.has(tile)&&!PAVED_ROADS.has(tile))return null;
  return roadSurfaceCorners(world,x,y)||sidewalkSurfaceCorners(world,x,y);
}

export function roadRetainingFaces(world,x,y,ownsSharedBoundary=null){
  if(!roadRailingAllowed(world,x,y))return [];
  const surface=streetSurfaceCorners(world,x,y);if(!surface)return [];
  const faces=[];
  for(let side=0;side<EDGES.length;side++){
    const edge=EDGES[side],nx=x+edge.dx,ny=y+edge.dy,neighbor=at(world,nx,ny),neighborIsStreet=!!streetSurfaceCorners(world,nx,ny);
    const [ax,ay]=CORNERS[edge.a],[bx,by]=CORNERS[edge.b];
    if(neighborIsStreet){
      if(roadRailingAllowed(world,nx,ny)&&(ownsSharedBoundary?!ownsSharedBoundary(nx,ny):ny*world.width+nx<y*world.width+x))continue;
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
    const waterOrVoid=neighbor===TILE_WATER||neighbor===TILE_VOID,base=neighbor===TILE_WATER?WATER_LEVEL:waterOrVoid?0.08:null,groundA=base??terrainCornerHeight(world,x+ax,y+ay),groundB=base??terrainCornerHeight(world,x+bx,y+by),surfaceA=surface[edge.a],surfaceB=surface[edge.b];
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
  const tx=Math.floor(x),ty=Math.floor(y);if(at(world,tx,ty)===TILE_WATER)return WATER_LEVEL;
  const street=streetSurfaceCorners(world,tx,ty),stone=!street&&terrainStoneSurface(world,tx,ty);
  if(stone){
    for(let i=0;i<8;i++){
      const a=stone.center,b=stone.ring[i],c=stone.ring[(i+1)%8],den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
      if(Math.abs(den)<1e-9)continue;
      const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(y-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(y-c[2]))/den;
      if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)return u*a[1]+v*b[1]+(1-u-v)*c[1];
    }
  }
  const surface=street||terrainTileSurfaceCorners(world,tx,ty),u=x-tx,v=y-ty;
  const h00=surface?surface[0]:terrainCornerHeight(world,tx,ty),h10=surface?surface[1]:terrainCornerHeight(world,tx+1,ty),h11=surface?surface[2]:terrainCornerHeight(world,tx+1,ty+1),h01=surface?surface[3]:terrainCornerHeight(world,tx,ty+1);
  // Use the same diagonal as the rendered triangles, including non-planar turns.
  return u<=v?h00*(1-v)+h01*(v-u)+h11*u:h00*(1-u)+h10*(u-v)+h11*v;
}
