import {furnitureInteraction,roomFurniture} from './city_furniture_catalog.js?v=fast-speeds-1';
import {CITY_FLOOR_HEIGHT,buildingInteriorEntrance} from './city_building_geometry.js';

// Logical, renderer-independent walk graph. Nodes are reconstructed from a
// building's rooms and circulation; only immutable geometry is cached.
const layouts=new WeakMap();
const keyOf=(x,y,z)=>`${x},${y},${z}`;
const directions=[[1,0],[-1,0],[0,1],[0,-1]];
const ROUTE_CACHE_LIMIT=512;
export const INTERIOR_ROOM_PROFILES=Object.freeze({
  bedroom:{interaction:'rest',furniture:'bed'},bathroom:{interaction:'toilet',furniture:'toilet-sink',capacity:1},
  dining:{interaction:'eat',furniture:'table-seats',capacity:4},laundry:{interaction:'wash',furniture:'washer'},
  workspace:{interaction:'work',furniture:'workbench-seat',capacity:1},office:{interaction:'work',furniture:'desk-seat',capacity:1},
  plenary:{interaction:'council',furniture:'council-desk-seat',capacity:1},service:{interaction:'service',furniture:'counter',capacity:1},
  treatment:{interaction:'treatment',furniture:'exam-bed',capacity:1},circulation:{interaction:'transit',furniture:null},
  waiting:{interaction:'queue',furniture:null},balcony:{interaction:'leisure',furniture:'balcony-layout'},roof_terrace:{interaction:'leisure',furniture:'roof-layout'},
});
export function interiorStairAxis(building){return building.depth>=building.width?'y':'x';}

export function interiorLayout(building){
  const cached=layouts.get(building),units=building.units||[],circulation=building.circulation||[];
  if(cached&&cached.revision===(building.layoutRevision||0)&&cached.units===units&&cached.circulation===circulation&&cached.width===building.width&&cached.depth===building.depth&&cached.floors===building.floors&&cached.rotation===(building.rotation||0))return cached.layout;
  const nodes=new Map(),byFloor=Array.from({length:building.floors||1},()=>[]),unitsByCell=new Map((building.units||[]).map(u=>[keyOf(u.x,u.y,u.z),u]));
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
  // Refined quarter-tile navigation adds real furniture footprints to the
  // room graph. The coarse graph above remains useful for floor/room lookup;
  // paths use only walk nodes and never cut through a declared prop volume.
  const walkNodes=new Map(),walkNodesByFloor=Array.from({length:building.floors||1},()=>[]),walkNeighbors=new Map(),walkBlocked=new Set(),scale=4;
  for(let z=0;z<(building.floors||1);z++)for(let y=0;y<building.depth;y++)for(let x=0;x<building.width;x++){
    const unit=unitsByCell.get(keyOf(x,y,z));
    if(unit)for(const item of roomFurniture(building,unit)){
      const fx=item.x-x,fy=item.y-y,w=item.footprint?.width||.4,d=item.footprint?.depth||.3;
      for(let sy=0;sy<scale;sy++)for(let sx=0;sx<scale;sx++){const px=(sx+.5)/scale,py=(sy+.5)/scale;if(Math.abs(px-fx)<w/2&&Math.abs(py-fy)<d/2)walkBlocked.add(`${x*scale+sx},${y*scale+sy},${z}`);}
    }
  }
  // Keep one landing clear for the visible stairwell in compact footprints.
  // The rendered stairs occupy this circulation point; treating it as blocked
  // by a decorative workstation would create a phantom connected floor graph.
  const stairTileX=Math.floor(building.width/2),stairTileY=Math.floor(building.depth/2),gridStairX=stairTileX*scale+Math.floor(scale/2),gridStairY=stairTileY*scale+Math.floor(scale/2);
  if((building.floors||1)>1)for(let z=0;z<(building.floors||1);z++)walkBlocked.delete(`${gridStairX},${gridStairY},${z}`);
  const door=building.door;if(door){const sideDistances=[['left',Math.abs(door.x-building.entity.x)],['right',Math.abs(door.x-(building.entity.x+building.width))],['north',Math.abs(door.y-building.entity.y)],['south',Math.abs(door.y-(building.entity.y+building.depth))]],side=sideDistances.sort((a,b)=>a[1]-b[1])[0][0];
    // Only the actual ground-floor doorway is an opening in the exterior wall.
    // Keep furniture solid beyond that threshold; routes must go around it.
    for(let offset=0;offset<=1;offset++){
      if(side==='south'||side==='north'){const gx=Math.max(0,Math.min(building.width*scale-1,Math.floor((door.x-building.entity.x)*scale)))+offset-1,gy=side==='south'?building.depth*scale-1:0;walkBlocked.delete(`${gx},${gy},0`);}
      else {const gy=Math.max(0,Math.min(building.depth*scale-1,Math.floor((door.y-building.entity.y)*scale)))+offset-1,gx=side==='right'?building.width*scale-1:0;walkBlocked.delete(`${gx},${gy},0`);}
    }
  }
  // Internal doors are centered in the room boundary. Clear only the quarter
  // tiles covered by the visible opening, preserving furniture immediately
  // beside it and keeping narrow floor plans connected.
  for(let z=0;z<(building.floors||1);z++)for(let y=0;y<building.depth;y++)for(let x=0;x<building.width;x++){
    for(const [dx,dy]of [[1,0],[0,1]])if(x+dx<building.width&&y+dy<building.depth){
      for(let offset=1;offset<=2;offset++){
        if(dx){for(const gx of [x*scale+scale-1,(x+1)*scale])walkBlocked.delete(`${gx},${y*scale+offset},${z}`);}
        else {for(const gy of [y*scale+scale-1,(y+1)*scale])walkBlocked.delete(`${x*scale+offset},${gy},${z}`);}
      }
    }
  }
  for(let z=0;z<(building.floors||1);z++)for(let y=0;y<building.depth*scale;y++)for(let x=0;x<building.width*scale;x++){
    const tileX=Math.floor(x/scale),tileY=Math.floor(y/scale),key=`${x},${y},${z}`;if(walkBlocked.has(key))continue;
    const node={key,x:building.entity.x+(x+.5)/scale,y:building.entity.y+(y+.5)/scale,z:z*CITY_FLOOR_HEIGHT,localX:x,localY:y,floor:z};walkNodes.set(key,node);walkNodesByFloor[z].push(node);
  }
  for(const node of walkNodes.values()){
    const adjacent=[];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const key=`${node.localX+dx},${node.localY+dy},${node.floor}`;if(walkNodes.has(key))adjacent.push(key);}walkNeighbors.set(node.key,adjacent);
  }
  for(let z=0;z<(building.floors||1)-1;z++){
    const lower=`${gridStairX},${gridStairY},${z}`,upper=`${gridStairX},${gridStairY},${z+1}`;
    if(walkNodes.has(lower)&&walkNodes.has(upper)){walkNeighbors.get(lower).push(upper);walkNeighbors.get(upper).push(lower);}
  }
  const layout={nodes,neighbors,byFloor,stairKeys,routes:new Map(),walkRoutes:new Map(),walkNodes,walkNodesByFloor,walkNeighbors,scale};layouts.set(building,{revision:building.layoutRevision||0,units,circulation,width:building.width,depth:building.depth,floors:building.floors,rotation:building.rotation||0,layout});return layout;
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
  const outside=from.x<building.entity.x||from.x>=building.entity.x+building.width||from.y<building.entity.y||from.y>=building.entity.y+building.depth;
  if(outside&&(from.z||0)<CITY_FLOOR_HEIGHT/2){
    const entry=buildingInteriorEntrance(building);
    if(entry){
      const remaining=interiorRoute(building,entry,to);if(remaining===null)return null;
      const door=Object.freeze({x:building.door.x,y:building.door.y,z:0}),approach=Math.hypot(from.x-door.x,from.y-door.y)>1e-6?[door]:[];
      return [...approach,Object.freeze(entry),...remaining];
    }
  }
  const layout=interiorLayout(building),floors=building.floors||1,scale=layout.scale,roofTarget=to.z!=null&&Math.floor(to.z/CITY_FLOOR_HEIGHT)>=floors;
  // keyAt/nearest candidates must reach the lookup through the same keyAt;
  // nearest then picks the first strictly smallest distance squared. The
  // all-floor fallback uses walkNodesByFloor.flat(): per-floor arrays are
  // already in floor-major walk-node order, so the selected winner and the
  // tie rule are the same as the previous values() scan. The BFS neighbor
  // order below is untouched.
  const keyAt=p=>{
    const floor=Math.max(0,Math.min(floors-1,Math.round((p.z||0)/CITY_FLOOR_HEIGHT)));
    const x=Math.max(0,Math.min(building.width*scale-1,Math.floor((p.x-building.entity.x)*scale)));
    const y=Math.max(0,Math.min(building.depth*scale-1,Math.floor((p.y-building.entity.y)*scale)));
    return `${x},${y},${floor}`;};
  const nearest=(p,floor=null)=>{
    let key=keyAt(p);if((floor==null||layout.walkNodes.get(key)?.floor===floor)&&layout.walkNodes.has(key))return key;
    let best=null,distance=Infinity;
    const candidates=floor==null?layout.walkNodesByFloor.flat():layout.walkNodesByFloor[floor]||[];
    for(const node of candidates){const d=(node.x-p.x)**2+(node.y-p.y)**2+((node.z-(p.z||0))*1.3)**2;if(d<distance){best=node.key;distance=d;}}
    return best;
  };
  const targetFloor=roofTarget?floors-1:to.z!=null?Math.round(to.z/CITY_FLOOR_HEIGHT):null;
  const start=nearest(from);
  const wantedGoal=roofTarget?nearest({x:building.entity.x+(Math.floor(building.width/2)+.5),y:building.entity.y+(Math.floor(building.depth/2)+.5),z:(floors-1)*CITY_FLOOR_HEIGHT},floors-1):nearest(to,targetFloor);
  if(!start||!wantedGoal)return null;
  const requestedKey=`${start}>${wantedGoal}`;let keys=layout.routes.get(requestedKey),goal=wantedGoal;
  if(!keys){const previous=new Map([[start,null]]),queue=[start];let reached=start===goal;for(let head=0;head<queue.length&&!reached;head++){const key=queue[head];for(const next of layout.walkNeighbors.get(key)||[])if(!previous.has(next)){previous.set(next,key);queue.push(next);if(next===goal){reached=true;break;}}}
    if(!previous.has(goal)){let best=null,distance=Infinity;for(const key of previous.keys()){const node=layout.walkNodes.get(key);if(targetFloor!=null&&node.floor!==targetFloor)continue;const d=(node.x-to.x)**2+(node.y-to.y)**2+((node.z-(to.z||0))*1.3)**2;if(d<distance){best=key;distance=d;}}goal=best;}
    if(!goal||!previous.has(goal))return null;keys=[];for(let key=goal;key!==null;key=previous.get(key))keys.push(key);keys.reverse();const routeKey=`${start}>${goal}`;layout.routes.set(routeKey,keys);if(layout.routes.size>ROUTE_CACHE_LIMIT)layout.routes.delete(layout.routes.keys().next().value);
  }
  const inside=p=>p.x>=building.entity.x&&p.x<building.entity.x+building.width&&p.y>=building.entity.y&&p.y<building.entity.y+building.depth;
  const routeKey=`${start}>${goal}`;let stairPath=layout.walkRoutes.get(routeKey);
  if(!stairPath){
    const route=keys.map(key=>{const p=layout.walkNodes.get(key);return {x:p.x,y:p.y,z:p.z};});
    // Cache the compressed, stair-expanded path. Callers receive their own
    // array below, so shifting waypoints never mutates this shared geometry.
    const compressed=[];for(let i=0;i<route.length;i++){const prev=route[i-1],cur=route[i],next=route[i+1];if(!prev||!next||prev.z!==cur.z||next.z!==cur.z||((cur.x-prev.x)*(next.y-cur.y)!==(cur.y-prev.y)*(next.x-cur.x)))compressed.push(cur);}
    stairPath=[];for(let i=0;i<compressed.length;i++){
      const a=compressed[i],b=compressed[i+1];stairPath.push(a);
      if(b&&a.z!==b.z){const low=Math.min(a.z,b.z),direction=b.z>a.z?1:-1,baseFloor=Math.round(low/CITY_FLOOR_HEIGHT),axis=interiorStairAxis(building),centerX=building.entity.x+Math.floor(building.width/2)+.5,centerY=building.entity.y+Math.floor(building.depth/2)+.5;
        const steps=Array.from({length:10},(_,step)=>({x:axis==='x'?centerX-.32+step*.075:centerX,y:axis==='y'?centerY-.32+step*.075:centerY,z:baseFloor*CITY_FLOOR_HEIGHT+step*.18+.09}));if(direction<0)steps.reverse();stairPath.push(...steps);
      }
    }
    if(compressed.length)stairPath.push(compressed.at(-1));
    // Shared waypoints are geometry, not moving positions. Freezing them
    // also lets worker snapshots reuse their already-synchronized records.
    for(const p of stairPath)Object.freeze(p);
    layout.walkRoutes.set(routeKey,stairPath);if(layout.walkRoutes.size>ROUTE_CACHE_LIMIT)layout.walkRoutes.delete(layout.walkRoutes.keys().next().value);
  }
  const path=stairPath.slice(inside(from)?1:0);
  if(roofTarget){const stair=Object.freeze({x:building.entity.x+Math.floor(building.width/2)+.5,y:building.entity.y+Math.floor(building.depth/2)+.5,z:(floors-1)*CITY_FLOOR_HEIGHT}),landing=Object.freeze({...stair,z:to.z});if(!path.length||Math.hypot(path.at(-1).x-stair.x,path.at(-1).y-stair.y)>.01)path.push(stair);path.push(landing);if(Math.hypot(to.x-landing.x,to.y-landing.y)>.01)path.push(Object.freeze({...to}));}
  if(path.length){if(inside(to)&&!roofTarget)path[path.length-1]=Object.freeze({...to});else if(!roofTarget)path.push(Object.freeze({...to}));}
  else if(!inside(to)&&!roofTarget)path.push(Object.freeze({...to}));
  return path;
}

export function interiorUsePoint(building,unit,kind='generic',slot=0,task=null){
  const furniture=furnitureInteraction(building,unit,kind,slot,task);if(furniture)return {...furniture.point};
  const center=worldPoint(building,{x:unit.x,y:unit.y,z:unit.z});
  const offsets={bathroom:[[-.22,0]],bedroom:[[0,-.22]],dining:[[-.24,.24],[.24,.24],[-.24,-.24],[.24,-.24]],office:[[0,-.23]],plenary:[[0,-.23]],workspace:[[0,-.23]],laundry:[[0,-.23]],service:[[0,-.23]],treatment:[[0,-.23]]};
  const [dx,dy]=(offsets[kind]||[[0,-.23]])[slot%(offsets[kind]||[[0,-.23]]).length];
  return {x:building.entity.x+unit.x+.5+dx,y:building.entity.y+unit.y+.5+dy,z:center.z};
}
