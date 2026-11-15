import {addBuildingRoof} from './city_building_roof.js';
import {HOUSE_STYLES,architectureFor} from './city_culture.js?v=colonial-colored-trim-1';
import {createFarmPlants,syncFarmPlants} from './city_farm_renderer.js';
import {farmCells} from './city_farm_layout.js';
import {buildingGround} from './city_terrain.js?v=entrance-retaining-clearance-1';
import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {furnitureModel} from './city_furniture_models.js?v=no-beach-towels-1';
import {roomFurniture} from './city_furniture_catalog.js?v=fast-speeds-1';

/** Greenhouse decks expose the actual beds on each floor; no decorative yield. */
export function syncVerticalFarm(renderer,THREE,entity,b,world){
 let group=renderer.cityMeshes.get(b.id);
 const architecture=b.architecture||architectureFor(b.type,b.id,world.seed??0),style=HOUSE_STYLES[architecture]||HOUSE_STYLES.modern;
 const signature=`vertical-farm-2:${architecture}:${b.paintRevision||0}:${b.wallColor??''}:${b.crop}:${b.width}:${b.depth}:${b.floors}:${b.layoutRevision||0}`;
 if(group&&group.userData.signature!==signature){renderer.scene.remove(group);const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer.cityMeshes.delete(b.id);group=null;}
 if(!group){
  group=new THREE.Group();group.userData.signature=signature;group.userData.cityBuilding=b;group.userData.floorGroups=[];
  const material=(kind,color)=>renderer.createCityBuildingMaterial?.(kind,color,b.id%32)||new THREE.MeshLambertMaterial({color});
  const wall=material('wall',b.wallColor??style.wall),trim=material('wall',style.trim),deck=material('wall',0x928571),wood=material('wood',0x79553d),accent=material('wood',style.accent),soil=new THREE.MeshLambertMaterial({color:b.crop==='muda_water_lily'?0x427f88:0x59412b});
  const cells=farmCells(b),stairX=Math.floor(b.width/2),stairY=Math.floor(b.depth/2),matrix=new THREE.Matrix4();
  const instances=(level,geometry,material,positions)=>{if(!positions.length){geometry.dispose();return;}const mesh=new THREE.InstancedMesh(geometry,material,positions.length);positions.forEach(([x,y,z],i)=>{matrix.makeTranslation(x,y,z);mesh.setMatrixAt(i,matrix);});mesh.receiveShadow=true;mesh.castShadow=true;level.add(mesh);};
  for(let z=0;z<b.floors;z++){
   const level=new THREE.Group(),floorY=z*CITY_FLOOR_HEIGHT;level.position.y=floorY;group.add(level);group.userData.floorGroups.push(level);
   const slabs=[];for(let y=0;y<b.depth;y++)for(let x=0;x<b.width;x++)if(z===0||x!==stairX||y!==stairY)slabs.push([x+.5,0,y+.5]);
   instances(level,new THREE.BoxGeometry(.99,.1,.99),deck,slabs);
   // Painted masonry piers and cornices match the surrounding city buildings.
   instances(level,new THREE.BoxGeometry(.18,CITY_FLOOR_HEIGHT,.18),wall,[[.09,CITY_FLOOR_HEIGHT/2,.09],[b.width-.09,CITY_FLOOR_HEIGHT/2,.09],[.09,CITY_FLOOR_HEIGHT/2,b.depth-.09],[b.width-.09,CITY_FLOOR_HEIGHT/2,b.depth-.09]]);
   instances(level,new THREE.BoxGeometry(b.width+.06,.12,.16),trim,[[b.width/2,.07,.05],[b.width/2,.07,b.depth-.05],[b.width/2,CITY_FLOOR_HEIGHT-.06,.05],[b.width/2,CITY_FLOOR_HEIGHT-.06,b.depth-.05]]);
   instances(level,new THREE.BoxGeometry(.16,.12,b.depth+.06),trim,[[.05,.07,b.depth/2],[b.width-.05,.07,b.depth/2],[.05,CITY_FLOOR_HEIGHT-.06,b.depth/2],[b.width-.05,CITY_FLOOR_HEIGHT-.06,b.depth/2]]);
   // Open growing galleries keep real crops readable without a separate glass tower style.
   if(z>0){
    instances(level,new THREE.BoxGeometry(b.width-.28,.36,.1),wall,[[b.width/2,.26,.07],[b.width/2,.26,b.depth-.07]]);
    instances(level,new THREE.BoxGeometry(.1,.36,b.depth-.28),wall,[[.07,.26,b.depth/2],[b.width-.07,.26,b.depth/2]]);
    instances(level,new THREE.BoxGeometry(b.width-.2,.055,.12),trim,[[b.width/2,.47,.07],[b.width/2,.47,b.depth-.07]]);
    instances(level,new THREE.BoxGeometry(.12,.055,b.depth-.2),trim,[[.07,.47,b.depth/2],[b.width-.07,.47,b.depth/2]]);
   }
   const posts=[];for(let x=1;x<b.width;x++)posts.push([x,.98,.07],[x,.98,b.depth-.07]);for(let y=1;y<b.depth;y++)posts.push([.07,.98,y],[b.width-.07,.98,y]);
   instances(level,new THREE.BoxGeometry(.065,1.5,.065),accent,posts);
   const beds=cells.filter(u=>(u.z||0)===z);instances(level,new THREE.BoxGeometry(.44,.2,.76),wood,beds.map(u=>[u.x+.35,.12,u.y+.5]));instances(level,new THREE.BoxGeometry(.39,.025,.7),soil,beds.map(u=>[u.x+.35,.23,u.y+.5]));
   if(z<b.floors-1){const stairs=[];for(let i=0;i<10;i++)stairs.push([stairX+.5,(i+1)*CITY_FLOOR_HEIGHT/10-.045,stairY+.08+i*.085]);instances(level,new THREE.BoxGeometry(.72,.09,.09),deck,stairs);}
   for(const u of b.units.filter(u=>u.z===z&&['bathroom','dining'].includes(u.roomType))){for(const item of roomFurniture(b,u)){const model=furnitureModel(THREE,item);model.position.set(item.x,.07,item.y);level.add(model);}if(u.roomType==='bathroom'){const partition=new THREE.Mesh(new THREE.BoxGeometry(.96,1.2,.05),wall);partition.position.set(u.x+.5,.6,u.y+.03);level.add(partition);}}
  }
  const roof=new THREE.Group(),roofY=b.floors*CITY_FLOOR_HEIGHT;
  const slab=new THREE.Mesh(new THREE.BoxGeometry(b.width+.15,.14,b.depth+.15),material('roof',style.roof));slab.position.set(b.width/2,roofY+.03,b.depth/2);slab.castShadow=slab.receiveShadow=true;roof.add(slab);
  addBuildingRoof(THREE,roof,b,material('roof',style.roof),style.roofKind,roofY+.1);
  group.add(roof);group.userData.roof=roof;
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
