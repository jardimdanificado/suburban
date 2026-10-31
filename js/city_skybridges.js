import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {terrainWalkable} from './city_terrain.js?v=deep-perf-3';

// One deterministic source of truth feeds both pedestrian routing and the renderer.
export function skybridgeLinks(buildings,world){
 const physical=buildings.map(e=>e.properties?.cityBuilding||e).filter(b=>b&&!b.entity?.destroyed&&b.constructionKind==='building'),candidates=physical.filter(b=>!b.officeTenantOf&&b.floors>=2&&b.terrain),connections=new Map(),links=[];
  const makeLink=(a,b,axis)=>{
  const horizontal=axis==='x',aAlong=horizontal?a.entity.x:a.entity.y,bAlong=horizontal?b.entity.x:b.entity.y,aLength=horizontal?a.width:a.depth,bLength=horizontal?b.width:b.depth,gap=bAlong-(aAlong+aLength),spanMax=5;
  if(gap<1||gap>spanMax||(connections.get(b.id)||0)>=4||Math.abs(a.terrain.base-b.terrain.base)>.25)return null;
  const aAcross=horizontal?a.entity.y:a.entity.x,bAcross=horizontal?b.entity.y:b.entity.x,aAcrossLength=horizontal?a.depth:a.width,bAcrossLength=horizontal?b.depth:b.width,low=Math.max(aAcross,bAcross),high=Math.min(aAcross+aAcrossLength,bAcross+bAcrossLength);if(high-low<1)return null;
  const x0=horizontal?a.entity.x+a.width:a.entity.x,y0=horizontal?a.entity.y:a.entity.y+a.depth,x1=horizontal?b.entity.x:b.entity.x,y1=horizontal?b.entity.y+b.depth:b.entity.y;
  for(let lane=Math.floor(low);lane<high;lane++){
   const blocked=physical.some(other=>other.id!==a.id&&other.id!==b.id&&(
    horizontal?other.entity.x<x1&&other.entity.x+other.width>x0&&lane>=other.entity.y&&lane<other.entity.y+other.depth:
    other.entity.y<y1&&other.entity.y+other.depth>y0&&lane>=other.entity.x&&lane<other.entity.x+other.width));if(blocked)continue;
   const au=horizontal?a.units.find(u=>u.z===1&&u.x===a.width-1&&u.y===lane-a.entity.y&&u.roomType!=='bathroom'):a.units.find(u=>u.z===1&&u.y===a.depth-1&&u.x===lane-a.entity.x&&u.roomType!=='bathroom');
   const bu=horizontal?b.units.find(u=>u.z===1&&u.x===0&&u.y===lane-b.entity.y&&u.roomType!=='bathroom'):b.units.find(u=>u.z===1&&u.y===0&&u.x===lane-b.entity.x&&u.roomType!=='bathroom');if(!au||!bu)continue;
   const start=horizontal?{x:x0+.5,y:lane+.5}:{x:lane+.5,y:y0+.5},end=horizontal?{x:x1-.5,y:lane+.5}:{x:lane+.5,y:y1-.5},offset=horizontal?{x:0,y:1}:{x:1,y:0},startAccess={x:start.x+offset.x,y:start.y+offset.y},endAccess={x:end.x+offset.x,y:end.y+offset.y};
   if(!terrainWalkable(world,Math.floor(start.x),Math.floor(start.y))||!terrainWalkable(world,Math.floor(end.x),Math.floor(end.y))||!terrainWalkable(world,Math.floor(startAccess.x),Math.floor(startAccess.y))||!terrainWalkable(world,Math.floor(endAccess.x),Math.floor(endAccess.y)))continue;
   const id=`skybridge:${axis}:${a.id}:${b.id}:${lane}`;return {id,axis,aId:a.id,bId:b.id,lane,x0,x1,y0,y1,gap,y:horizontal?lane+.5:undefined,height:CITY_FLOOR_HEIGHT,auId:au.id,buId:bu.id,start,end,startAccess,endAccess};
  }
  return null;
 };
 for(const axis of ['x']){
  const ordered=candidates.slice().sort((a,b)=>(axis==='x'?a.entity.x-b.entity.x:a.entity.y-b.entity.y)||a.entity.x-b.entity.x||a.id-b.id);
  for(let i=0;i<ordered.length&&links.length<64;i++){
   const a=ordered[i];if((connections.get(a.id)||0)>=4)continue;let selected=null;
   for(let j=i+1;j<ordered.length;j++){
    const b=ordered[j],gap=b.entity.x-a.entity.x-a.width;if(gap>5)break;
    const link=makeLink(a,b,axis);if(!link)continue;if(gap<=5){selected=link;break;}selected=link;
   }
   if(selected){links.push(selected);connections.set(selected.aId,(connections.get(selected.aId)||0)+1);connections.set(selected.bId,(connections.get(selected.bId)||0)+1);}
  }
 }
 return links;
}

// Elevated links use separate pedestrian waypoints and leave the road tiles open.
export function syncSkybridges(renderer,THREE,entities,world){
 const city=renderer.cityDevelopment?.city,revision=city?.structureRevision??entities.length,key=`${revision}:${world.revision??0}`;
 const updateVisibility=()=>{for(const bridge of renderer.skybridgeGroup?.children||[]){const p=bridge.userData.bounds;bridge.visible=!Number.isFinite(renderer.renderedMinTx)||p.x1>=renderer.renderedMinTx&&p.x0<=renderer.renderedMaxTx+1&&p.y1>=renderer.renderedMinTy&&p.y0<=renderer.renderedMaxTy+1;}};
 if(renderer.skybridgeRevision===key){updateVisibility();return;}renderer.skybridgeRevision=key;
 if(renderer.skybridgeGroup){renderer.skybridgeGroup.parent?.remove(renderer.skybridgeGroup);renderer.skybridgeGroup.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
 const group=new THREE.Group();renderer.skybridgeGroup=group;(renderer.constructionGroup||renderer.scene).add(group);renderer.skybridgeDoors=new Map();
 const addDoor=(building,unitId,bit)=>{let doors=renderer.skybridgeDoors.get(building.id);if(!doors)renderer.skybridgeDoors.set(building.id,doors=new Map());doors.set(unitId,(doors.get(unitId)||0)|bit);};
 // `entities` is the camera's visible subset. Derive the network from the
 // complete city so endpoints outside the current viewport still exist and
 // the bridge does not depend on which area was rendered first.
 const buildings=city?.buildings||entities.map(e=>e.properties?.cityBuilding).filter(Boolean),byId=new Map(buildings.map(b=>[b.id,b]));
 for(const link of skybridgeLinks(buildings,world)){
   const a=byId.get(link.aId),b=byId.get(link.bId),bridge=new THREE.Group(),midX=(link.start.x+link.end.x)/2,midY=(link.start.y+link.end.y)/2,height=a.terrain.base+link.height-.07,horizontal=link.axis==='x';
   bridge.userData={id:link.id,bounds:{x0:Math.min(link.start.x,link.end.x),x1:Math.max(link.start.x,link.end.x),y0:Math.min(link.start.y,link.end.y),y1:Math.max(link.start.y,link.end.y)}};group.add(bridge);
   const deck=new THREE.Mesh(new THREE.BoxGeometry(horizontal?link.gap+.12:.72,.14,horizontal?.72:link.gap+.12),new THREE.MeshLambertMaterial({color:0x8c9892}));deck.position.set(midX,height,midY);deck.castShadow=true;deck.receiveShadow=true;bridge.add(deck);
   const railMaterial=new THREE.MeshLambertMaterial({color:0x637579}),postGeometry=new THREE.BoxGeometry(.04,.66,.04),postMatrices=new THREE.Matrix4(),postCount=Math.max(2,Math.ceil(link.gap/4)+1),posts=new THREE.InstancedMesh(postGeometry,railMaterial,postCount*2);let postIndex=0;
   for(const side of [-.32,.32]){const rail=new THREE.Mesh(new THREE.BoxGeometry(horizontal?link.gap+.12:.045,.07,horizontal?.045:link.gap+.12),railMaterial);rail.position.set(midX+(horizontal?0:side),height+.66,midY+(horizontal?side:0));bridge.add(rail);for(let k=0;k<postCount;k++){const t=k/(postCount-1),x=link.start.x+(link.end.x-link.start.x)*t+(horizontal?0:side),y=link.start.y+(link.end.y-link.start.y)*t+(horizontal?side:0);postMatrices.makeTranslation(x,height+.33,y);posts.setMatrixAt(postIndex++,postMatrices);}}
   posts.instanceMatrix.needsUpdate=true;posts.castShadow=true;posts.frustumCulled=false;bridge.add(posts);
   addDoor(a,link.auId,horizontal?8:2);addDoor(b,link.buId,horizontal?4:1);
 }
 updateVisibility();
}
