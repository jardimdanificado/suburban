import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
export function applyInteriorCutaway(THREE,group,floor=null,hideWalls=false){
 const interior=floor!=null,key=interior?`inside:${floor}:${hideWalls}`:'facade';if(group.userData.lastInteriorView===key)return;
 const m=new THREE.Matrix4(),hidden=new THREE.Vector3(0,0,0),lowWall=new THREE.Vector3(1,.16,1);
 for(const cells of group.userData.cellMeshes||[]){
  if(Number.isInteger(cells.userData.combinedCellFloor)){
   const level=cells.userData.combinedCellFloor;cells.visible=!interior||level===floor;
   cells.scale.y=interior&&level===floor&&hideWalls?0.16:1;
   cells.position.y=level*CITY_FLOOR_HEIGHT+(interior&&level===floor&&hideWalls?CITY_FLOOR_HEIGHT*.08:CITY_FLOOR_HEIGHT/2);
   continue;
  }
  const levels=cells.userData.interiorFloors||[],base=cells.userData.interiorBaseMatrices||[];for(let i=0;i<levels.length;i++){m.copy(base[i]);if(interior){if(levels[i]!==floor||hideWalls)m.scale(hidden);else{m.scale(lowWall);m.elements[13]=floor*CITY_FLOOR_HEIGHT+CITY_FLOOR_HEIGHT*.08;}}cells.setMatrixAt(i,m);}cells.instanceMatrix.needsUpdate=true;
 }
 const floors=group.userData.interiorFloors;if(floors){const levels=floors.userData.interiorFloors,base=floors.userData.interiorBaseMatrices;for(let i=0;i<levels.length;i++){m.copy(base[i]);if(interior&&levels[i]!==floor)m.scale(hidden);floors.setMatrixAt(i,m);}floors.instanceMatrix.needsUpdate=true;}
 for(const key of ['interiorCeilings','roof','facade','supports','slab','stairs'])if(group.userData[key])group.userData[key].visible=!interior;
 if(group.userData.doorFrames)group.userData.doorFrames.visible=interior;
 if(group.userData.exteriorDoorFrames)group.userData.exteriorDoorFrames.visible=!interior;
 if(group.userData.roomProps){group.userData.roomProps.visible=interior;for(const prop of group.userData.roomProps.children)prop.visible=interior&&prop.userData.interiorFloor===floor;}
 group.userData.lastInteriorView=key;
}
export function interiorViewForLocation(location,building){
 if(!location||location.exiting||!building||building.destroyed||building.entity?.destroyed)return null;
 const floor=location.position?Math.max(0,Math.floor((location.position.z||0)/CITY_FLOOR_HEIGHT+.001)):location.floor??building.officeFloor??0;
 return {buildingId:building.officeTenantOf||building.id,floor,hideWalls:true};
}
export function syncThirdPersonInteriorView(renderer,targetEnt){
 const citizen=targetEnt?.properties?.citizen,location=citizen?.indoorLocation,building=location&&renderer.cityDevelopment?.city?.building(location.buildingId);
 const next=renderer.isThirdPersonActive()?interiorViewForLocation(location,building):null;
 if(next){
  if(!renderer.thirdPersonInteriorOverride){renderer.thirdPersonSavedInteriorView=renderer.cityInteriorView;renderer.thirdPersonInteriorOverride=true;}
  renderer.cityInteriorView=next;
 }else if(renderer.thirdPersonInteriorOverride){
  renderer.cityInteriorView=renderer.thirdPersonSavedInteriorView;renderer.thirdPersonSavedInteriorView=null;renderer.thirdPersonInteriorOverride=false;
 }
}
