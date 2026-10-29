import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {ROAD_TILES,tileAt,terrainWalkable} from './city_terrain.js?v=deep-perf-3';

// One deterministic source of truth feeds both pedestrian routing and the renderer.
export function skybridgeLinks(buildings,world){
 // The bridge prototype uses local east/west door bits. Until rotated facade
 // masks are modeled here too, only attach it to buildings facing that axis.
 const candidates=buildings.map(e=>e.properties?.cityBuilding||e).filter(b=>b&&!b.entity?.destroyed&&!b.officeTenantOf&&b.constructionKind==='building'&&b.floors>=2&&b.terrain&&(b.rotation||0)===0).sort((a,b)=>a.entity.x-b.entity.x||a.entity.y-b.entity.y||a.id-b.id),used=new Set(),links=[];
 for(let i=0;i<candidates.length&&links.length<24;i++){const a=candidates[i];if(used.has(a.id))continue;
  for(let j=i+1;j<candidates.length;j++){const b=candidates[j],gap=b.entity.x-(a.entity.x+a.width);if(gap>5)break;if(gap<2||used.has(b.id)||Math.abs(a.terrain.base-b.terrain.base)>.25)continue;
   const low=Math.max(a.entity.y,b.entity.y),high=Math.min(a.entity.y+a.depth,b.entity.y+b.depth);if(high-low<1)continue;
   const row=Math.floor((low+high)/2),z=row+.5,x0=a.entity.x+a.width,x1=b.entity.x;
   const au=a.units.find(u=>u.z===1&&u.x===a.width-1&&u.y===row-a.entity.y&&u.roomType!=='bathroom'),bu=b.units.find(u=>u.z===1&&u.x===0&&u.y===row-b.entity.y&&u.roomType!=='bathroom');if(!au||!bu)continue;
   let crossesRoad=false;for(let x=Math.floor(x0);x<Math.ceil(x1);x++)if(ROAD_TILES.has(tileAt(world,x,row))){crossesRoad=true;break;}if(!crossesRoad)continue;
   const id=`skybridge:${a.id}:${b.id}:${row}`,start={x:x0+.5,y:z},end={x:x1-.5,y:z},startAccess={x:start.x,y:z+1},endAccess={x:end.x,y:z+1};
   if(!terrainWalkable(world,Math.floor(start.x),Math.floor(start.y))||!terrainWalkable(world,Math.floor(end.x),Math.floor(end.y))||!terrainWalkable(world,Math.floor(startAccess.x),Math.floor(startAccess.y))||!terrainWalkable(world,Math.floor(endAccess.x),Math.floor(endAccess.y)))continue;
   links.push({id,aId:a.id,bId:b.id,row,x0,x1,gap,y:z,height:CITY_FLOOR_HEIGHT,auId:au.id,buId:bu.id,start,end,startAccess,endAccess});used.add(a.id);used.add(b.id);break;
  }
 }
 return links;
}

// Elevated links use separate pedestrian waypoints and leave the road tiles open.
export function syncSkybridges(renderer,THREE,entities,world){
 const city=renderer.cityDevelopment?.city,revision=city?.structureRevision??entities.length,key=`${revision}:${world.revision??0}`;
 const updateVisibility=()=>{for(const bridge of renderer.skybridgeGroup?.children||[]){const p=bridge.userData.bounds;bridge.visible=!Number.isFinite(renderer.renderedMinTx)||p.x0>=renderer.renderedMinTx&&p.x1<=renderer.renderedMaxTx+1&&p.z>=renderer.renderedMinTy&&p.z<=renderer.renderedMaxTy+1;}};
 if(renderer.skybridgeRevision===key){updateVisibility();return;}renderer.skybridgeRevision=key;
 if(renderer.skybridgeGroup){renderer.scene.remove(renderer.skybridgeGroup);renderer.skybridgeGroup.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
 const group=new THREE.Group();renderer.skybridgeGroup=group;renderer.scene.add(group);renderer.skybridgeDoors=new Map();
 const addDoor=(building,unitId,bit)=>{let doors=renderer.skybridgeDoors.get(building.id);if(!doors)renderer.skybridgeDoors.set(building.id,doors=new Map());doors.set(unitId,(doors.get(unitId)||0)|bit);};
 const byId=new Map(entities.map(e=>[e.properties?.cityBuilding?.id,e.properties?.cityBuilding]).filter(x=>x[0]!=null));
 for(const link of skybridgeLinks(entities,world)){
   const a=byId.get(link.aId),b=byId.get(link.bId),bridge=new THREE.Group(),mid=(link.x0+link.x1)/2,height=a.terrain.base+link.height+.07;
   bridge.userData={id:link.id,bounds:{x0:link.x0,x1:link.x1,z:link.y}};group.add(bridge);
   const deck=new THREE.Mesh(new THREE.BoxGeometry(link.gap+.12,.14,.72),new THREE.MeshLambertMaterial({color:0x8c9892}));deck.position.set(mid,height,link.y);deck.castShadow=true;deck.receiveShadow=true;bridge.add(deck);
   for(const side of [-.32,.32]){const rail=new THREE.Mesh(new THREE.BoxGeometry(link.gap+.12,.07,.045),new THREE.MeshLambertMaterial({color:0x637579}));rail.position.set(mid,height+.66,link.y+side);bridge.add(rail);for(let k=0;k<=Math.ceil(link.gap);k++){const post=new THREE.Mesh(new THREE.BoxGeometry(.04,.66,.04),new THREE.MeshLambertMaterial({color:0x637579}));post.position.set(link.x0+link.gap*k/Math.ceil(link.gap),height+.33,link.y+side);bridge.add(post);}}
   addDoor(a,link.auId,8);addDoor(b,link.buId,4);
 }
 updateVisibility();
}
