import {TILE_WATER} from './world_gen.js?v=deep-perf-3';
const DIRECTIONS=[[1,0],[-1,0],[0,1],[0,-1]];
const indexes=new WeakMap(),clamp=n=>Math.max(0,Math.min(100,n));
export function waterIndex(world){
 let cached=indexes.get(world);if(cached&&cached.map===world.map&&cached.width===world.width&&cached.height===world.height&&cached.revision===(world.waterTopologyRevision||0))return cached;
 const {width,height}=world,size=width*height,labels=new Int32Array(size);labels.fill(-1);const bodies=[],tile=(x,y)=>world.map?world.map[y*width+x]:world.getTile(x,y);
 for(let i=0;i<size;i++){const x=i%width,y=Math.floor(i/width);if(labels[i]!==-1||tile(x,y)!==TILE_WATER)continue;
  const id=bodies.length,queue=[i],shores=new Set();labels[i]=id;
  for(let head=0;head<queue.length;head++){const n=queue[head],px=n%width,py=Math.floor(n/width);for(const [dx,dy] of DIRECTIONS){const nx=px+dx,ny=py+dy,k=ny*width+nx;if(nx<0||ny<0||nx>=width||ny>=height)continue;if(tile(nx,ny)===TILE_WATER){if(labels[k]===-1){labels[k]=id;queue.push(k);}}else shores.add(k);}}
  bodies.push({id:i,area:queue.length,shores:[...shores]});
 }
 cached={map:world.map,width,height,revision:world.waterTopologyRevision||0,labels,bodies};indexes.set(world,cached);return cached;
}
export function waterPollutionAt(world,x,y){const index=waterIndex(world),id=index.labels[Math.floor(y)*world.width+Math.floor(x)];return world.waterBodies?.[id]?.pollution||0;}
export function waterTint(pollution){const t=clamp(pollution)/100,clean=[.086,.408,.659],algae=[.23,.43,.27],sewage=[.35,.25,.12],a=t<.5?clean:algae,b=t<.5?algae:sewage,k=t<.5?t*2:(t-.5)*2;return a.map((n,i)=>n+(b[i]-n)*k);}
export class CityWater{
 constructor(city){this.city=city;this.bodies=[];this.drawn=0;}
 reconcile(){const index=waterIndex(this.city.world);if(this.topologyKey===`${index.revision}:${index.width}:${index.height}:${index.bodies.length}`&&this.bodies.length===index.bodies.length){this.city.world.waterBodies=this.bodies;return index;}
  const old=new Map(this.bodies.map(b=>[b.id,b]));this.bodies=index.bodies.map(b=>old.get(b.id)||{id:b.id,area:b.area,volume:b.area*1000,pollutants:0,pollution:0});this.topologyKey=`${index.revision}:${index.width}:${index.height}:${index.bodies.length}`;this.city.world.waterBodies=this.bodies;return index;
 }
 hourly(){const city=this.city,index=this.reconcile(),loads=new Map();
  const runoff=(x,y,amount)=>{const near=new Map();for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++){const distance=Math.hypot(dx,dy);if(distance>6)continue;const px=x+dx,py=y+dy;if(px<0||py<0||px>=city.world.width||py>=city.world.height)continue;const id=index.labels[py*city.world.width+px];if(id>=0)near.set(id,Math.max(near.get(id)||0,1/(1+distance)));}for(const [id,factor]of near)loads.set(id,(loads.get(id)||0)+amount*factor);};
  for(const [key,pile]of city.sanitation.streetFeces){const [x,y]=key.split(',').map(Number);runoff(x,y,pile.amount*50);}
  for(const b of city.buildings){if(b.entity.destroyed)continue;if(b.litter)runoff(Math.floor(b.door.x),Math.floor(b.door.y),b.litter*8);for(const [key,pile]of b.feces||[]){const [x,y]=key.split(',').map(Number);runoff(Math.floor(b.entity.x+x),Math.floor(b.entity.y+y),pile.amount*12);}}
  let changed=false;for(const [i,b]of this.bodies.entries()){const previous=Math.round(b.pollution);b.pollutants=Math.max(0,b.pollutants*.985+(loads.get(i)||0));b.pollution=clamp(b.pollutants/Math.max(1,b.volume)*100);if(Math.round(b.pollution)!==previous)changed=true;}
  if(changed)city.world.waterPollutionRevision=(city.world.waterPollutionRevision||0)+1;
 }
 nearestShore(c){const city=this.city,index=this.reconcile();let best=null,score=Infinity;
  for(let id=0;id<index.bodies.length;id++)for(const n of index.bodies[id].shores){const x=n%city.world.width,y=Math.floor(n/city.world.width),d=Math.hypot(c.entity.x-x-.5,c.entity.y-y-.5);if(d>=score||!city.walkable(x,y))continue;const point={x:x+.5,y:y+.5},path=city.findPath(c.entity,point);if(path===null)continue;score=d;best={bodyId:id,point,path};}return best;
 }
 contamination(bodyId,point){const body=this.bodies[bodyId];let local=0;for(const [key,pile]of this.city.sanitation.streetFeces){const [x,y]=key.split(',').map(Number),d=Math.hypot(x+.5-point.x,y+.5-point.y);if(d<7)local+=pile.amount*(7-d)/7;}return clamp(4+(body?.pollution||0)+Math.min(65,local*3));}
 draw(bodyId,quantity){const b=this.bodies[bodyId];if(!b)return;const old=b.volume;b.volume=Math.max(1,b.volume-quantity);b.pollutants*=b.volume/old;this.drawn+=quantity;}
}
