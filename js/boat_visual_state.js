export function boatVisualPosition(boat){
 const entity=boat?.entity;
 if(Number.isFinite(entity?.x)&&Number.isFinite(entity?.y))return {x:entity.x,y:entity.y};
 if(Number.isFinite(boat?.x)&&Number.isFinite(boat?.y))return {x:boat.x,y:boat.y};
 return null;
}
export function hideLocalBoat(worldVessel,renderedWorldIds,localDriverId){
 if(!worldVessel)return false;
 if(worldVessel.status==='at-sea'||worldVessel.status==='returning')return true;
 if(localDriverId)return false;
 // Registry membership alone does not mean a replacement mesh was rendered.
 return renderedWorldIds.has(worldVessel.id);
}
