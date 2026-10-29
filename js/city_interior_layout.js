import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';

// Logical, renderer-independent walk graph. Nodes are reconstructed from a
// building's rooms and circulation; only immutable geometry is cached.
const layouts=new WeakMap();
const keyOf=(x,y,z)=>`${x},${y},${z}`;
const directions=[[1,0],[-1,0],[0,1],[0,-1]];
export const INTERIOR_ROOM_PROFILES=Object.freeze({
  bedroom:{interaction:'rest',furniture:'bed'},bathroom:{interaction:'toilet',furniture:'toilet-sink',capacity:1},
  dining:{interaction:'eat',furniture:'table-seats',capacity:4},laundry:{interaction:'wash',furniture:'washer'},
  workspace:{interaction:'work',furniture:'workbench-seat',capacity:1},office:{interaction:'work',furniture:'desk-seat',capacity:1},
  plenary:{interaction:'council',furniture:'council-desk-seat',capacity:1},service:{interaction:'service',furniture:'counter',capacity:1},
  treatment:{interaction:'treatment',furniture:'exam-bed',capacity:1},circulation:{interaction:'transit',furniture:null},
  waiting:{interaction:'queue',furniture:null},balcony:{interaction:'leisure',furniture:'balcony-layout'},roof_terrace:{interaction:'leisure',furniture:'roof-layout'},
});

export function interiorLayout(building){
  const cached=layouts.get(building),units=building.units||[],circulation=building.circulation||[];
  if(cached&&cached.revision===(building.layoutRevision||0)&&cached.units===units&&cached.circulation===circulation&&cached.width===building.width&&cached.depth===building.depth&&cached.floors===building.floors&&cached.rotation===(building.rotation||0))return cached.layout;
  const nodes=new Map(),byFloor=Array.from({length:building.floors||1},()=>[]);
  for(const unit of building.units||[]){
    const key=keyOf(unit.x,unit.y,unit.z),node={key,x:unit.x,y:unit.y,z:unit.z,kind:'room',unitId:unit.id,roomType:unit.roomType};
    nodes.set(key,node);byFloor[unit.z]?.push(node);
  }
  for(const cell of building.circulation||[]){
    const key=keyOf(cell.x,cell.y,cell.z);if(nodes.has(key))continue;
    const node={key,x:cell.x,y:cell.y,z:cell.z,kind:'circulation'};nodes.set(key,node);byFloor[cell.z]?.push(node);
  }
  // Narrow/open-air footprints may not have explicit room objects for every
  // tile. Add only missing cells inside the real footprint, never outside it.
  for(let z=0;z<(building.floors||1);z++)for(let y=0;y<building.depth;y++)for(let x=0;x<building.width;x++){
    const key=keyOf(x,y,z);if(nodes.has(key))continue;
    const node={key,x,y,z,kind:'circulation'};nodes.set(key,node);byFloor[z]?.push(node);
  }
  const neighbors=new Map();
  for(const node of nodes.values()){
    const adjacent=[];
    for(const [dx,dy] of directions){const other=nodes.get(keyOf(node.x+dx,node.y+dy,node.z));if(other)adjacent.push(other.key);}
    neighbors.set(node.key,adjacent);
  }
  // A stair is represented by the same footprint cell on each connected
  // floor. If a floor lacks that cell, there is no imaginary vertical route.
  const stairX=Math.max(0,Math.min(building.width-1,Math.floor(building.width/2)));
  const stairY=Math.max(0,Math.min(building.depth-1,Math.floor(building.depth/2)));
  const stairKeys=[];
  for(let z=0;z<(building.floors||1);z++){
    const node=nodes.get(keyOf(stairX,stairY,z));if(!node)continue;
    node.stair=true;stairKeys.push(node.key);
  }
  for(let i=1;i<stairKeys.length;i++){
    const lower=nodes.get(stairKeys[i-1]),upper=nodes.get(stairKeys[i]);
    if(upper.z===lower.z+1){neighbors.get(lower.key).push(upper.key);neighbors.get(upper.key).push(lower.key);}
  }
  const layout={nodes,neighbors,byFloor,stairKeys,routes:new Map()};layouts.set(building,{revision:building.layoutRevision||0,units,circulation,width:building.width,depth:building.depth,floors:building.floors,rotation:building.rotation||0,layout});return layout;
}

const worldPoint=(building,node)=>{const offset=(node.stair||node.kind!=='room')?0.5:0.18;return {x:building.entity.x+node.x+offset,y:building.entity.y+node.y+offset,z:node.z*CITY_FLOOR_HEIGHT};};
function nearestNode(layout,building,point,z=null){
  const lx=Math.max(0,Math.min(building.width-1,Math.round(point.x-building.entity.x-.5))),ly=Math.max(0,Math.min(building.depth-1,Math.round(point.y-building.entity.y-.5)));
  const floor=z??Math.max(0,Math.min((building.floors||1)-1,Math.round((point.z||0)/CITY_FLOOR_HEIGHT)));
  const direct=layout.nodes.get(keyOf(lx,ly,floor));if(direct)return direct;
  let best=null,bestDistance=Infinity;
  for(const node of layout.nodes.values()){
    if(z!=null&&node.z!==z)continue;
    const p=worldPoint(building,node),distance=(p.x-point.x)**2+(p.y-point.y)**2+((p.z-(point.z||0))*1.3)**2;
    if(distance<bestDistance){bestDistance=distance;best=node;}
  }
  return best;
}

export function interiorRoute(building,from,to){
  const layout=interiorLayout(building),start=nearestNode(layout,building,from),floors=building.floors||1;
  const roofTarget=to.z!=null&&Math.floor(to.z/CITY_FLOOR_HEIGHT)>=floors;
  const goal=roofTarget?layout.nodes.get(`${Math.floor(building.width/2)},${Math.floor(building.depth/2)},${floors-1}`):nearestNode(layout,building,to,to.z!=null?Math.round(to.z/CITY_FLOOR_HEIGHT):null);
  if(!start||!goal)return null;
  const routeKey=`${start.key}>${goal.key}`;let keys=layout.routes.get(routeKey);
  if(!keys){const previous=new Map(),queue=[start.key];previous.set(start.key,null);
    for(let head=0;head<queue.length;head++){
      const key=queue[head];if(key===goal.key)break;
      for(const next of layout.neighbors.get(key)||[])if(!previous.has(next)){previous.set(next,key);queue.push(next);}
    }
    if(!previous.has(goal.key))return null;keys=[];for(let key=goal.key;key!==null;key=previous.get(key))keys.push(key);keys.reverse();layout.routes.set(routeKey,keys);if(layout.routes.size>256)layout.routes.delete(layout.routes.keys().next().value);
  }
  const inside=point=>point.x>=building.entity.x&&point.x<building.entity.x+building.width&&point.y>=building.entity.y&&point.y<building.entity.y+building.depth;
  const path=keys.slice(inside(from)?1:0).map(key=>worldPoint(building,layout.nodes.get(key)));
  if(roofTarget){const stair=worldPoint(building,goal),landing={...stair,z:to.z};if(!path.length||Math.hypot(path.at(-1).x-stair.x,path.at(-1).y-stair.y)>.01)path.push(stair);path.push(landing);if(Math.hypot(to.x-landing.x,to.y-landing.y)>.01)path.push({...to});}
  // Preserve the requested interaction point only inside the destination tile.
  if(path.length&&Math.floor(to.x-building.entity.x)===goal.x&&Math.floor(to.y-building.entity.y)===goal.y)path[path.length-1]={...to};
  if(!inside(to)&&!roofTarget)path.push({...to});
  return path;
}

export function interiorUsePoint(building,unit,kind='generic',slot=0){
  const center=worldPoint(building,{x:unit.x,y:unit.y,z:unit.z});
  const offsets={bathroom:[[-.22,0]],bedroom:[[0,-.22]],dining:[[-.24,.24],[.24,.24],[-.24,-.24],[.24,-.24]],office:[[0,-.23]],plenary:[[0,-.23]],workspace:[[0,-.23]],laundry:[[0,-.23]],service:[[0,-.23]],treatment:[[0,-.23]]};
  const [dx,dy]=(offsets[kind]||[[0,-.23]])[slot%(offsets[kind]||[[0,-.23]]).length];
  return {x:building.entity.x+unit.x+.5+dx,y:building.entity.y+unit.y+.5+dy,z:center.z};
}
