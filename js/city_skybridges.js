import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {ROAD_TILES,tileAt} from './city_terrain.js?v=business-heights-1';

// Elevated architectural links do not occupy or block their street tiles.
export function syncSkybridges(renderer,THREE,entities,world){
 const city=renderer.cityDevelopment?.city,revision=city?.structureRevision??entities.length,key=`${revision}:${world.revision??0}`;
 const updateVisibility=()=>{for(const bridge of renderer.skybridgeGroup?.children||[]){const p=bridge.userData.bounds;bridge.visible=!Number.isFinite(renderer.renderedMinTx)||p.x0>=renderer.renderedMinTx&&p.x1<=renderer.renderedMaxTx+1&&p.z>=renderer.renderedMinTy&&p.z<=renderer.renderedMaxTy+1;}};
 if(renderer.skybridgeRevision===key){updateVisibility();return;}renderer.skybridgeRevision=key;
 if(renderer.skybridgeGroup){renderer.scene.remove(renderer.skybridgeGroup);renderer.skybridgeGroup.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
 const group=new THREE.Group();renderer.skybridgeGroup=group;renderer.scene.add(group);renderer.skybridgeDoors=new Map();
 const addDoor=(building,unit,bit)=>{let doors=renderer.skybridgeDoors.get(building.id);if(!doors)renderer.skybridgeDoors.set(building.id,doors=new Map());doors.set(unit.id,(doors.get(unit.id)||0)|bit);};
 const buildings=entities.map(e=>e.properties?.cityBuilding).filter(b=>b&&!b.entity.destroyed&&!b.officeTenantOf&&b.constructionKind==='building'&&b.floors>=2&&b.terrain).sort((a,b)=>a.entity.x-b.entity.x),used=new Set();let built=0;
 for(let i=0;i<buildings.length&&built<24;i++){const a=buildings[i];if(used.has(a.id))continue;
  for(let j=i+1;j<buildings.length;j++){const b=buildings[j],gap=b.entity.x-(a.entity.x+a.width);if(gap>5)break;if(gap<1||used.has(b.id)||Math.abs(a.terrain.base-b.terrain.base)>.25)continue;
   const low=Math.max(a.entity.y,b.entity.y),high=Math.min(a.entity.y+a.depth,b.entity.y+b.depth);if(high-low<1)continue;const z=Math.floor((low+high)/2)+.5,x0=a.entity.x+a.width,x1=b.entity.x,mid=(x0+x1)/2;
   const au=a.units.find(u=>u.z===1&&u.x===a.width-1&&u.y===Math.floor(z-a.entity.y)&&u.roomType!=='bathroom'),bu=b.units.find(u=>u.z===1&&u.x===0&&u.y===Math.floor(z-b.entity.y)&&u.roomType!=='bathroom');if(!au||!bu)continue;
   let crossesRoad=false;for(let x=Math.floor(x0);x<Math.ceil(x1);x++)if(ROAD_TILES.has(tileAt(world,x,Math.floor(z)))){crossesRoad=true;break;}if(!crossesRoad)continue;
   const bridge=new THREE.Group();bridge.userData.bounds={x0,x1,z};group.add(bridge);
   const height=a.terrain.base+CITY_FLOOR_HEIGHT+.07,deck=new THREE.Mesh(new THREE.BoxGeometry(gap+.12,.14,.72),new THREE.MeshLambertMaterial({color:0x8c9892}));deck.position.set(mid,height,z);deck.castShadow=true;deck.receiveShadow=true;bridge.add(deck);
   for(const side of [-.32,.32]){const rail=new THREE.Mesh(new THREE.BoxGeometry(gap+.12,.07,.045),new THREE.MeshLambertMaterial({color:0x637579}));rail.position.set(mid,height+.66,z+side);bridge.add(rail);for(let k=0;k<=Math.ceil(gap);k++){const post=new THREE.Mesh(new THREE.BoxGeometry(.04,.66,.04),new THREE.MeshLambertMaterial({color:0x637579}));post.position.set(x0+gap*k/Math.ceil(gap),height+.33,z+side);bridge.add(post);}}
   addDoor(a,au,8);addDoor(b,bu,4);
   for(const x of [x0,x1]){for(const dz of [-.27,.27]){const frame=new THREE.Mesh(new THREE.BoxGeometry(.08,1.45,.06),new THREE.MeshLambertMaterial({color:0x637579}));frame.position.set(x,height+.72,z+dz);bridge.add(frame);}const top=new THREE.Mesh(new THREE.BoxGeometry(.08,.07,.6),new THREE.MeshLambertMaterial({color:0x637579}));top.position.set(x,height+1.45,z);bridge.add(top);}
   used.add(a.id);used.add(b.id);built++;break;
  }
 }
 updateVisibility();
}
