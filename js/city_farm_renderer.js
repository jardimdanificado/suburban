import {NATURAL_PLANTS} from './plant_catalog.js';
import {createFarmPlantGeometry} from './farm_plant_geometry.js';
import {FARM_CROPS} from './farm_crop_catalog.js';
import {addBotanicalTreeWind,botanicalTreeTextures} from './botanical_trees.js?v=species-colors-3';
import {farmCells,isVerticalFarm} from './city_farm_layout.js';
import {surfaceElevation} from './city_terrain.js?v=entrance-retaining-clearance-1';
import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
export function createFarmPlants(THREE,b){
  const species=FARM_CROPS[b.crop]?.plantSpecies,perennial=FARM_CROPS[b.crop]?.perennial||!!species&&!!(NATURAL_PLANTS[species]?.wood||NATURAL_PLANTS[species]?.tree),capacity=b.units.length*3,group=new THREE.Group(),geometry=createFarmPlantGeometry(THREE,b.crop);
  const textures=botanicalTreeTextures(THREE),material=addBotanicalTreeWind(new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.95,map:textures.map,normalMap:textures.normalMap,alphaTest:.5}));
  material.addEventListener('dispose',()=>{textures.map.dispose();textures.normalMap.dispose();});
  const age=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1);geometry.setAttribute('instanceGrowth',age);
  const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.count=0;mesh.receiveShadow=true;mesh.castShadow=false;group.add(mesh);
  return {group,mesh,age,capacity,perennial,grow:FARM_CROPS[b.crop]?.grow||120};
}
export function syncFarmPlants(renderer,THREE,b,world,plantSet,minute){
  const cells=farmCells(b),growthByCell=new Float32Array(cells.length);let offset=0;
  for(const field of b.fields||[]){const count=Math.min(field.area||12,cells.length-offset),age=field.plantedAt==null?0:Math.max(0,minute-field.plantedAt)*(field.growthMultiplier||1),growth=field.plantedAt==null?(plantSet.perennial&&field.establishedAt!=null?.01:0):Math.max(plantSet.perennial?.01:0,Math.min(1,age/Math.max(1,plantSet.grow)));for(let i=0;i<count;i++)growthByCell[offset+i]=field.harvestedCells?.[i]?(plantSet.perennial?.01:0):growth;offset+=count;if(offset>=cells.length)break;}
  const m=renderer._farmPlantMatrix??=new THREE.Matrix4(),pos=renderer._farmPlantPosition??=new THREE.Vector3(),quat=renderer._farmPlantQuaternion??=new THREE.Quaternion(),scale=renderer._farmPlantScale??=new THREE.Vector3(),axis=renderer._farmPlantAxis??=new THREE.Vector3(0,1,0);
  let n=0;
  for(let i=0;i<cells.length;i++){const growth=growthByCell[i];if(!growth)continue;const u=cells[i];if(plantSet.perennial&&(Math.floor(u.x)%2||Math.floor(u.y)%2))continue;if(isVerticalFarm(b)&&(u.z||0)>(plantSet.visibleFloor??Infinity))continue;const ground=isVerticalFarm(b)?(u.z||0)*CITY_FLOOR_HEIGHT+.2:surfaceElevation(world,b.entity.x+u.x+.5,b.entity.y+u.y+.5);
    for(let j=0;j<(plantSet.perennial?1:3);j++){pos.set(u.x+(isVerticalFarm(b)?.35:.5+(plantSet.perennial?0:(j-1)*.25)),ground+.04,u.y+.5+(isVerticalFarm(b)?(j-1)*.2:plantSet.perennial?0:j%2?.16:-.14));quat.setFromAxisAngle(axis,i*2.4+j*1.7);const size=plantSet.perennial?.95:(.18+.82*growth)*(isVerticalFarm(b)?.65:.85);scale.set(size,size,size);m.compose(pos,quat,scale);plantSet.mesh.setMatrixAt(n,m);plantSet.age.setX(n,growth);n++;}
  }
  plantSet.mesh.count=n;plantSet.mesh.instanceMatrix.needsUpdate=true;plantSet.age.needsUpdate=true;plantSet.mesh.computeBoundingSphere();
  const shader=plantSet.mesh.material.userData.foliageShader;if(shader)shader.uniforms.uSimTick.value=minute;
}

