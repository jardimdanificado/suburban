import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {grassRootTints} from '../js/grass_root_tint.js';
import {TILE_FLOOR,TILE_HILL} from '../js/world_gen.js';
const source=readFileSync(new URL('../js/renderer_3d.js',import.meta.url),'utf8');
const start=source.indexOf('const tintGrass='),end=source.indexOf('    const terrainSurfaceGeometries',start);
const expression=source.slice(start,end).trim().replace('const tintGrass=','');
test('grass tint keeps the original smooth blend with tile reads bounded by chunk area',()=>{
 let reads=0;const tile=(x,z)=>(x+z)%2===0?TILE_FLOOR:TILE_HILL;
 const world={getTile(x,z){reads++;return tile(x,z);}};
 const colors={[TILE_FLOOR]:{r:1,g:1,b:1},[TILE_HILL]:{r:.55,g:.65,b:.4}};
 const owner={materials:Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,{color}]))};
 const apply=new Function('world','TILE_FLOOR','TILE_HILL','minTx','maxTx','minTy','maxTy','return '+expression).call(owner,world,TILE_FLOOR,TILE_HILL,0,3,0,3);
 const count=4*4*576,actual=new Float32Array(count*3),base={r:.82,g:.82,b:.82};
 const rootX=i=>(i%96+.4)/24,rootZ=i=>(Math.floor(i/96)+.6)/24;
 const mesh={material:{color:base},geometry:{getAttribute(key){return key==='grassRoot'?{count,getX:rootX,getZ:rootZ}:{setXYZ(i,r,g,b){actual.set([r,g,b],i*3);}};}}};
 const field=apply(mesh);
 const roots=new Float32Array(count*3);for(let i=0;i<count;i++){roots[i*3]=rootX(i);roots[i*3+2]=rootZ(i);}
 const workerTints=grassRootTints(roots,field);
 for(let i=0;i<actual.length;i++)assert.ok(Math.abs(workerTints[i]-actual[i])<1e-6);
 assert.equal(reads,36,'sample each surrounding tile once, rather than four reads per blade');
 for(let i=0;i<count;i++){
  const x=rootX(i)-.5,z=rootZ(i)-.5,tx=Math.floor(x),tz=Math.floor(z),u=x-tx,v=z-tz,a=u*u*(3-2*u),b=v*v*(3-2*v);
  const expected=[0,0,0];
  for(const [dx,dz,w]of [[0,0,(1-a)*(1-b)],[1,0,a*(1-b)],[0,1,(1-a)*b],[1,1,a*b]]){
   const color=colors[tile(tx+dx,tz+dz)];expected[0]+=color.r*w;expected[1]+=color.g*w;expected[2]+=color.b*w;
  }
  for(let c=0;c<3;c++)assert(Math.abs(actual[i*3+c]-expected[c])<1e-6);
 }
});
