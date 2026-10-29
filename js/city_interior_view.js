import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
export function applyInteriorCutaway(THREE,group,floor=null,hideWalls=false){
 const interior=floor!=null,key=interior?`inside:${floor}:${hideWalls}`:'facade';if(group.userData.lastInteriorView===key)return;
 const m=new THREE.Matrix4(),hidden=new THREE.Vector3(0,0,0),lowWall=new THREE.Vector3(1,.16,1);
 for(const cells of group.userData.cellMeshes||[]){const levels=cells.userData.interiorFloors||[],base=cells.userData.interiorBaseMatrices||[];for(let i=0;i<levels.length;i++){m.copy(base[i]);if(interior){if(levels[i]!==floor||hideWalls)m.scale(hidden);else{m.scale(lowWall);m.elements[13]=floor*CITY_FLOOR_HEIGHT+CITY_FLOOR_HEIGHT*.08;}}cells.setMatrixAt(i,m);}cells.instanceMatrix.needsUpdate=true;}
 const floors=group.userData.interiorFloors;if(floors){const levels=floors.userData.interiorFloors,base=floors.userData.interiorBaseMatrices;for(let i=0;i<levels.length;i++){m.copy(base[i]);if(interior&&levels[i]!==floor)m.scale(hidden);floors.setMatrixAt(i,m);}floors.instanceMatrix.needsUpdate=true;}
 for(const key of ['interiorCeilings','roof','facade','doorFrames','supports','slab','stairs'])if(group.userData[key])group.userData[key].visible=!interior;
 if(group.userData.roomProps){group.userData.roomProps.visible=interior;for(const prop of group.userData.roomProps.children)prop.visible=interior&&prop.userData.interiorFloor===floor;}
 group.userData.lastInteriorView=key;
}
