import test from 'node:test';
import assert from 'node:assert/strict';
import {roadSurfaceCorners,roadRetainingFaces,terrainCornerHeight,terrainSurfaceElevation,terrainTileHeight,streetSurfaceCorners,terrainTileSurfaceCorners} from '../js/road_terrain_geometry.js';
import {surfaceElevation} from '../js/city_terrain.js';
import {TILE_FLOOR,TILE_STONE,TILE_SAND,TILE_HILL,TILE_ROAD_GRASS,TILE_ROAD_SAND,TILE_ROAD_HILL,TILE_ROAD_GRASS_STONE,TILE_ROAD_HILL_STONE} from '../js/world_gen.js';

function fixture(){
  const world={width:12,height:10,revision:1,map:new Uint8Array(120).fill(TILE_FLOOR)};
  world.getTile=(x,y)=>world.map[y*world.width+x];
  world.setTile=(x,y,tile)=>{world.map[y*world.width+x]=tile;world.revision++;};
  return world;
}
function road(world){for(let x=2;x<10;x++)world.setTile(x,5,TILE_ROAD_GRASS_STONE);}
const near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

test('a level street cuts a flat shelf into a cross slope and walls seal the actual bank edge',()=>{
  const world=fixture();
  for(let y=0;y<5;y++)for(let x=0;x<12;x++)world.setTile(x,y,TILE_HILL);
  road(world);
  assert.deepEqual(roadSurfaceCorners(world,5,5),[1.1,1.1,1.1,1.1]);
  const faces=roadRetainingFaces(world,5,5);
  assert.equal(faces.length,1);assert.equal(faces[0].side,0);
  assert.deepEqual([faces[0].ax,faces[0].ay,faces[0].bx,faces[0].by],[5,5,6,5]);
  near(faces[0].lowA,1.1);near(faces[0].lowB,1.1);
  near(faces[0].highA,terrainCornerHeight(world,5,5));
  near(faces[0].highB,terrainCornerHeight(world,6,5));
  near(faces[0].highA,1.7);
  near(surfaceElevation(world,5.5,5.5),1.1);
  // The end apron still meets ordinary ground, with no wall across the entrance.
  const end=roadSurfaceCorners(world,2,5);
  near(end[0],terrainCornerHeight(world,2,5));near(end[3],terrainCornerHeight(world,2,6));
  assert(roadRetainingFaces(world,2,5).every(face=>face.side!==3));
});

test('a road only climbs when its connected continuation reaches a higher level',()=>{
  const world=fixture();
  for(let y=0;y<5;y++)for(let x=0;x<12;x++)world.setTile(x,y,TILE_HILL);
  road(world);
  assert.deepEqual(roadSurfaceCorners(world,5,5),[1.1,1.1,1.1,1.1]);
  for(let y=0;y<10;y++)for(let x=6;x<12;x++)world.setTile(x,y,TILE_HILL);
  for(let x=6;x<10;x++)world.setTile(x,5,TILE_ROAD_HILL_STONE);
  const lower=roadSurfaceCorners(world,5,5),upper=roadSurfaceCorners(world,6,5);
  for(let i=0;i<4;i++){near(lower[i],[1.1,1.7,1.7,1.1][i]);near(upper[i],[1.7,2.3,2.3,1.7][i]);}
  near(lower[1],upper[0]);near(lower[2],upper[3]);
  near(surfaceElevation(world,5.5,5.5),1.4);near(surfaceElevation(world,6.5,5.5),2);
  // Both halves of the ramp have side cladding where a bank gap exists.
  assert(roadRetainingFaces(world,5,5).some(face=>face.side===0));
  const taper=roadRetainingFaces(world,6,5).find(face=>face.side===0);
  assert(taper);assert(taper.highA>taper.lowA);near(taper.highB,taper.lowB);
  assert(roadRetainingFaces(world,5,5).every(face=>face.side!==1));
  assert(roadRetainingFaces(world,6,5).every(face=>face.side!==3));
});

test('turns and junctions share corner elevations across every connected road edge',()=>{
  for(let mask=1;mask<16;mask++){
    const world=fixture(),cells=[[5,4],[6,4],[5,5],[6,5]];
    for(let i=0;i<4;i++)if(mask&(1<<i))world.setTile(...cells[i],i%2?TILE_ROAD_HILL_STONE:TILE_ROAD_GRASS_STONE);
    for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
      if(!(mask&(1<<i))||!(mask&(1<<j)))continue;
      const [x,y]=cells[i],[nx,ny]=cells[j];
      if(Math.abs(x-nx)+Math.abs(y-ny)!==1)continue;
      const a=roadSurfaceCorners(world,x,y),b=roadSurfaceCorners(world,nx,ny);
      if(nx>x){near(a[1],b[0]);near(a[2],b[3]);}
      else {near(a[3],b[0]);near(a[2],b[1]);}
    }
  }
});

test('crossing bank and ramp profiles taper to zero instead of creating an upright slab',()=>{
  const world=fixture();road(world);
  for(let x=0;x<12;x++)world.setTile(x,4,x<5?TILE_SAND:TILE_HILL);
  const faces=roadRetainingFaces(world,4,5).filter(face=>face.side===0);
  assert.equal(faces.length,2);
  near(faces[0].bx,faces[1].ax);near(faces[0].by,faces[1].ay);
  near(faces[0].lowB,faces[0].highB);near(faces[1].lowA,faces[1].highA);
  for(const face of faces){
    const middleX=(face.ax+face.bx)/2,t=middleX-4,ground=terrainCornerHeight(world,4,5)*(1-t)+terrainCornerHeight(world,5,5)*t;
    near((face.highA+face.highB)/2,Math.max(1.1,ground));
    near((face.lowA+face.lowB)/2,Math.min(1.1,ground));
  }
});

test('paving wear keeps the road profile and retaining walls on dirt roads',()=>{
  const world=fixture();road(world);
  for(let x=0;x<12;x++)world.setTile(x,4,TILE_HILL);
  const before=roadSurfaceCorners(world,5,5),faces=roadRetainingFaces(world,5,5);
  world.setTile(5,5,TILE_ROAD_GRASS);
  assert(faces.length>0);assert.deepEqual(roadSurfaceCorners(world,5,5),before);assert.deepEqual(roadRetainingFaces(world,5,5),faces);
  world.setTile(5,5,TILE_ROAD_GRASS_STONE);assert.deepEqual(roadRetainingFaces(world,5,5),faces);
  world.setTile(5,5,TILE_ROAD_GRASS);
  world.setTile(6,5,TILE_ROAD_HILL_STONE);
  assert(roadSurfaceCorners(world,5,5)[1]>before[1]);
  const flat=fixture();road(flat);assert.equal(roadRetainingFaces(flat,5,5).length,0);
});

test('walking height follows the actual mesh triangles even on a non-planar terrain tile',()=>{
  const world=fixture();world.setTile(6,4,TILE_HILL);
  near(terrainSurfaceElevation(world,5.5,5.5),1.1);
  near(terrainSurfaceElevation(world,5.75,5.25),1.25);
  near(surfaceElevation(world,5.75,5.25),1.25);
});


test('unbuilt dirt roads cut the same shelf and retaining wall as paving',()=>{
  const world=fixture();
  for(let y=0;y<5;y++)for(let x=0;x<12;x++)world.setTile(x,y,TILE_HILL);
  for(let x=2;x<10;x++)world.setTile(x,5,TILE_ROAD_GRASS);
  const dirtFaces=roadRetainingFaces(world,5,5);
  assert(dirtFaces.length>0);near(terrainSurfaceElevation(world,5.5,5.5),1.1);
  road(world);assert.deepEqual(roadRetainingFaces(world,5,5),dirtFaces);near(terrainSurfaceElevation(world,5.5,5.5),1.1);
});

test('sand road edges stay flush with the dune instead of growing see-through slivers',()=>{
  const world={width:12,height:10,revision:1,map:new Uint8Array(120).fill(TILE_SAND)};
  world.getTile=(x,y)=>world.map[y*world.width+x];
  world.setTile=(x,y,tile)=>{world.map[y*world.width+x]=tile;world.revision++;};
  for(let x=2;x<10;x++)world.setTile(x,5,TILE_ROAD_SAND);
  for(let x=3;x<8;x++){
    near(terrainCornerHeight(world,x,5),terrainTileHeight(TILE_SAND));
    assert.deepEqual(roadRetainingFaces(world,x,5),[],'a flat sand road needs no centimetre-high wall');
  }
  // Dune grain survives on corners that do not touch an engineered seam.
  assert([3,4,5,6].some(x=>Math.abs(terrainCornerHeight(world,x,4)-terrainTileHeight(TILE_SAND))>1e-6));
});

test('a paved street ending at a dirt road has no railing face on the shared edge',()=>{
  const world=fixture();
  for(let y=0;y<5;y++)for(let x=0;x<12;x++)world.setTile(x,y,TILE_HILL);
  for(let x=2;x<10;x++)world.setTile(x,5,x<6?TILE_ROAD_HILL:TILE_ROAD_GRASS_STONE);
  // Railing layout passes ownsSharedBoundary=()=>true, skipping shared street edges.
  assert(roadRetainingFaces(world,6,5,()=>true).every(face=>face.side!==3),'west edge toward dirt has no railing face');
  assert(roadRetainingFaces(world,5,5,()=>true).every(face=>face.side!==1),'dirt side has no railing face on the shared edge');
  assert(roadRetainingFaces(world,5,5).some(face=>face.side===0),'dirt road keeps its own bank retaining wall');
});


test('retaining panels interpolate each street profile along the shared edge',()=>{
  const world=fixture();
  road(world);world.sidewalkTiles=new Set([4*world.width+5,4*world.width+6]);
  for(let x=2;x<6;x++)world.setTile(x,3,TILE_ROAD_HILL_STONE);
  world.setTile(5,5,TILE_FLOOR);
  const edges=[[0,1],[1,2],[3,2],[0,3]],opposites=[[3,2],[0,3],[0,1],[1,2]],offsets=[[0,-1],[1,0],[0,1],[-1,0]];
  let checked=0;
  for(let y=0;y<world.height;y++)for(let x=0;x<world.width;x++){
    const surface=streetSurfaceCorners(world,x,y);if(!surface)continue;
    for(const face of roadRetainingFaces(world,x,y)){
      const [dx,dy]=offsets[face.side],other=streetSurfaceCorners(world,x+dx,y+dy);if(!other)continue;
      const [a,b]=edges[face.side],[c,d]=opposites[face.side];
      for(const [t,low,high] of [[face.from,face.lowA,face.highA],[face.to,face.lowB,face.highB]]){
        const first=surface[a]+(surface[b]-surface[a])*t,second=other[c]+(other[d]-other[c])*t;
        near(low,Math.min(first,second));near(high,Math.max(first,second));
      }
      checked++;
    }
  }
  assert(checked>0);
});

test('retaining walls meet the rendered stone shelf instead of averaged ground',()=>{
  const world=fixture();road(world);world.setTile(5,4,TILE_STONE);
  const stone=terrainTileSurfaceCorners(world,5,4),face=roadRetainingFaces(world,5,5).find(face=>face.side===0);
  assert(face);near(face.highA,stone[3]);near(face.highB,stone[2]);
});


test('sidewalk shelves beside dirt roads still close every exposed bank edge',()=>{
  const world=fixture();world.sidewalkTiles=new Set([4*world.width+5]);
  for(let x=2;x<10;x++)world.setTile(x,5,TILE_ROAD_GRASS);
  for(let x=0;x<12;x++)world.setTile(x,3,TILE_HILL);
  const surface=streetSurfaceCorners(world,5,4);
  assert(surface);
  const faces=roadRetainingFaces(world,5,4),north=faces.find(face=>face.side===0);
  assert(north,'sidewalk shelf must close its bank even without adjacent paving');
  near(north.lowA,surface[0]);near(north.lowB,surface[1]);
  near(north.highA,terrainCornerHeight(world,5,4));near(north.highB,terrainCornerHeight(world,6,4));
  assert.deepEqual(roadRetainingFaces(world,5,5),[],'dirt road itself remains natural');
});
