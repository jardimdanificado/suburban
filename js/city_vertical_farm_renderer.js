import {createFarmPlants,syncFarmPlants} from './city_farm_renderer.js';
import {farmCells} from './city_farm_layout.js';
import {buildingGround} from './city_terrain.js?v=entrance-retaining-clearance-1';
import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {furnitureModel} from './city_furniture_models.js?v=no-beach-towels-1';
import {roomFurniture} from './city_furniture_catalog.js?v=fast-speeds-1';

/** Greenhouse decks expose the actual beds on each floor; no decorative yield. */
export function syncVerticalFarm(renderer,THREE,entity,b,world){
 let group=renderer.cityMeshes.get(b.id);
 const signature=`vertical-farm-1:${b.crop}:${b.width}:${b.depth}:${b.floors}:${b.layoutRevision||0}`;
 if(group&&group.userData.signature!==signature){renderer.scene.remove(group);const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer.cityMeshes.delete(b.id);group=null;}
 if(!group){
  group=new THREE.Group();group.userData.signature=signature;group.userData.cityBuilding=b;group.userData.floorGroups=[];
  const frame=new THREE.MeshLambertMaterial({color:0x658075}),deck=new THREE.MeshLambertMaterial({color:0xa4afa4}),wood=new THREE.MeshLambertMaterial({color:0x7c6348}),soil=new THREE.MeshLambertMaterial({color:b.crop==='muda_water_lily'?0x427f88:0x59412b}),glass=new THREE.MeshLambertMaterial({color:0x7cbba2,transparent:true,opacity:.17,depthWrite:false,side:THREE.DoubleSide});
  const cells=farmCells(b),stairX=Math.floor(b.width/2),stairY=Math.floor(b.depth/2),matrix=new THREE.Matrix4();
  const instances=(level,geometry,material,positions)=>{if(!positions.length){geometry.dispose();return;}const mesh=new THREE.InstancedMesh(geometry,material,positions.length);positions.forEach(([x,y,z],i)=>{matrix.makeTranslation(x,y,z);mesh.setMatrixAt(i,matrix);});mesh.receiveShadow=true;mesh.castShadow=false;level.add(mesh);};
  for(let z=0;z<b.floors;z++){
   const level=new THREE.Group(),floorY=z*CITY_FLOOR_HEIGHT;level.position.y=floorY;group.add(level);group.userData.floorGroups.push(level);
   const slabs=[];for(let y=0;y<b.depth;y++)for(let x=0;x<b.width;x++)if(z===0||x!==stairX||y!==stairY)slabs.push([x+.5,0,y+.5]);
   instances(level,new THREE.BoxGeometry(.99,.08,.99),deck,slabs);
   instances(level,new THREE.BoxGeometry(.075,CITY_FLOOR_HEIGHT,.075),frame,[[.04,.9,.04],[b.width-.04,.9,.04],[.04,.9,b.depth-.04],[b.width-.04,.9,b.depth-.04]]);
   instances(level,new THREE.BoxGeometry(b.width,.055,.055),frame,[[b.width/2,1.65,.04],[b.width/2,1.65,b.depth-.04]]);
   instances(level,new THREE.BoxGeometry(.055,.055,b.depth),frame,[[.04,1.65,b.depth/2],[b.width-.04,1.65,b.depth/2]]);
   const beds=cells.filter(u=>(u.z||0)===z);instances(level,new THREE.BoxGeometry(.44,.2,.76),wood,beds.map(u=>[u.x+.35,.12,u.y+.5]));instances(level,new THREE.BoxGeometry(.39,.025,.7),soil,beds.map(u=>[u.x+.35,.23,u.y+.5]));
   const pane=new THREE.Mesh(new THREE.PlaneGeometry(b.width,1.45),glass);pane.position.set(b.width/2,.85,.02);level.add(pane);
   if(z<b.floors-1){const stairs=[];for(let i=0;i<10;i++)stairs.push([stairX+.5,(i+1)*CITY_FLOOR_HEIGHT/10-.045,stairY+.08+i*.085]);instances(level,new THREE.BoxGeometry(.72,.09,.09),deck,stairs);}
   for(const u of b.units.filter(u=>u.z===z&&['bathroom','dining'].includes(u.roomType))){for(const item of roomFurniture(b,u)){const model=furnitureModel(THREE,item);model.position.set(item.x,.07,item.y);level.add(model);}if(u.roomType==='bathroom'){const wall=new THREE.Mesh(new THREE.BoxGeometry(.96,1.2,.05),deck);wall.position.set(u.x+.5,.6,u.y+.03);level.add(wall);}}
  }
  const roof=new THREE.Mesh(new THREE.PlaneGeometry(b.width+.12,b.depth+.12),glass);roof.rotation.x=-Math.PI/2;roof.position.set(b.width/2,b.floors*CITY_FLOOR_HEIGHT,b.depth/2);group.add(roof);group.userData.roof=roof;
  const cropPlants=createFarmPlants(THREE,b);group.add(cropPlants.group);group.userData.cropPlants=cropPlants;
  const highlight=new THREE.Mesh(new THREE.BoxGeometry(.98,.07,.98),new THREE.MeshBasicMaterial({color:0xf8b800,wireframe:true}));highlight.visible=false;group.add(highlight);group.userData.highlight=highlight;
  renderer.decorateCityMaterials?.(group);renderer.cityMeshes.set(b.id,group);renderer.scene.add(group);
 }
 if(group.userData.terrainRevision!==(world.revision||0)){b.terrain=buildingGround(world,entity.x,entity.y,b.width,b.depth,b.door);group.userData.terrainRevision=world.revision||0;}
 group.position.set(entity.x,b.terrain.base,entity.y);group.visible=true;
 const unit=renderer.selectedEntityId===b.id?b.units.find(u=>u.id===renderer.selectedCityUnitId):null,visibleFloor=unit?.z??b.floors-1;
 for(const [z,level]of group.userData.floorGroups.entries())level.visible=z<=visibleFloor;
 group.userData.roof.visible=!unit;group.userData.highlight.visible=!!unit;if(unit)group.userData.highlight.position.set(unit.x+.5,unit.z*CITY_FLOOR_HEIGHT+.08,unit.y+.5);
 const minute=world.clock?Math.max(0,world.clock.day-1)*1440+world.clock.hour*60+world.clock.minute:0,key=`${minute}:${visibleFloor}`;
 if(group.userData.farmVisualMinute!==key){group.userData.cropPlants.visibleFloor=visibleFloor;syncFarmPlants(renderer,THREE,b,world,group.userData.cropPlants,minute);group.userData.farmVisualMinute=key;}
}
