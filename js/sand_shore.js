import {WATER_LEVEL} from './water_surface.js?v=shore-runup-2';
import {TILE_SAND,TILE_WATER} from './world_gen.js';
import {terrainCornerHeight,terrainTileTouchesStone,terrainSurfaceElevation} from './road_terrain_geometry.js?v=low-water-shore-4';
export const BEACH_RAMP_WIDTH=3.20;
export const BEACH_BED_HEIGHT=-.30;

export function isSlopingBeachTile(world,x,z){
  return x>=0&&z>=0&&x<world.width&&z<world.height&&world.getTile(x,z)===TILE_SAND&&!world.hasSidewalk?.(x,z)&&!terrainTileTouchesStone(world,x,z);
}

// One joined beach apron per water tile. The original dry shore is its upper
// edge; the far end continues below the water instead of closing with a wall.
export function sandShoreTileSurface(world,tx,ty,{profileOnly=false}={}){
  const at=(x,z)=>x<0||z<0||x>=world.width||z>=world.height?null:world.getTile(x,z);
  if(at(tx,ty)!==TILE_WATER&&!(profileOnly&&isSlopingBeachTile(world,tx,ty)))return null;
  const segments=[];
  const edge=(ax,az,bx,bz)=>segments.push([ax,az,bx,bz,terrainCornerHeight(world,ax,az),terrainCornerHeight(world,bx,bz)]);
  const radius=Math.ceil(Math.min(BEACH_RAMP_WIDTH,1.4));
  for(let z=ty-radius;z<=ty+radius;z++)for(let x=tx-radius;x<=tx+radius;x++){
    if(at(x,z)!==TILE_WATER)continue;
    if(isSlopingBeachTile(world,x,z-1))edge(x,z,x+1,z);
    if(isSlopingBeachTile(world,x,z+1))edge(x,z+1,x+1,z+1);
    if(isSlopingBeachTile(world,x-1,z))edge(x,z,x,z+1);
    if(isSlopingBeachTile(world,x+1,z))edge(x+1,z,x+1,z+1);
  }
  if(!segments.length)return null;
  const sample=(px,pz)=>{
    let distance=Infinity,bankHeight=0,count=0;
    for(const [ax,az,bx,bz,ha,hb]of segments){
      const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz)));
      const d=Math.hypot(px-ax-dx*t,pz-az-dz*t),height=ha+(hb-ha)*t;
      if(d<distance-1e-8){distance=d;bankHeight=height;count=1;}
      else if(Math.abs(d-distance)<1e-8){bankHeight+=height;count++;}
    }
    bankHeight/=count;
    const depth=Math.min(1,distance/BEACH_RAMP_WIDTH);
    const height=bankHeight+(BEACH_BED_HEIGHT-bankHeight)*depth;
    const groundHeight=at(Math.floor(px),Math.floor(pz))===TILE_WATER?height:terrainSurfaceElevation(world,px,pz);
    return {distance,groundHeight,shiftPerHeight:BEACH_RAMP_WIDTH/(bankHeight-BEACH_BED_HEIGHT),height,
      waterline:BEACH_RAMP_WIDTH*Math.max(0,(bankHeight-WATER_LEVEL)/(bankHeight-BEACH_BED_HEIGHT))};
  };
  if(profileOnly)return {sample};
  const positions=[],uvs=[],shades=[],steps=12,grid=[];
  for(let z=0;z<=steps;z++)for(let x=0;x<=steps;x++){
    const px=tx+x/steps,pz=ty+z/steps,s=sample(px,pz);
    grid.push({x:px,z:pz,...s});
  }
  if(grid.every(p=>p.distance>Math.min(BEACH_RAMP_WIDTH,1.4)))return null;
  for(let z=0;z<steps;z++)for(let x=0;x<steps;x++){
    const a=z*(steps+1)+x,b=a+steps+1;
    for(const i of [a,b,b+1,a,b+1,a+1]){
      const p=grid[i];positions.push(p.x,p.height,p.z);uvs.push(p.x/8,p.z/8);
      const wet=.75+.25*Math.min(1,Math.max(0,(p.height-WATER_LEVEL)/.3));shades.push(wet,wet,wet);
    }
  }
  return {positions,uvs,shades,sample};
}
