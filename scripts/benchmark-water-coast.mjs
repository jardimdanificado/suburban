// CPU coast preparation only; this does not measure game FPS or GPU time.
import {sandShoreTileSurface} from '../js/sand_shore.js';
import {cachedShoreFoamTileSurface} from '../js/water_foam.js';
import {sandNormalField} from '../js/sand_surface_lighting.js';
for(const kind of ['open-water','shore']){
 let reads=0;const world={width:128,height:128,revision:1,getTile(x,z){reads++;return x<0||z<0||x>=128||z>=128?5:kind==='shore'&&z<64?3:2;}};
 for(let run=0;run<3;run++){
  reads=0;let triangles=0;const start=performance.now();
  const normals=sandNormalField(world);
  for(let z=48;z<80;z++)for(let x=48;x<80;x++){
   const water=world.getTile(x,z)===2,beach=sandShoreTileSurface(world,x,z,{profileOnly:!water});
   const foam=cachedShoreFoamTileSurface(world,x,z,(x,z)=>world.getTile(x,z)===2,beach,(x,z)=>world.getTile(x,z)===3);
   triangles+=(beach?.positions?.length||0)/9+(foam?.positions?.length||0)/9;
   if(beach?.positions)for(let i=0;i<beach.positions.length;i+=3)normals(beach.positions[i],beach.positions[i+2]);
  }
  console.log(JSON.stringify({kind,run,ms:+(performance.now()-start).toFixed(1),reads,triangles}));
 }
}
