// Street bench poses can start and end between the larger graph snapshots.
export function packBenchSeats(citizens){
 const rows=[];
 for(const c of citizens)if(c.seatId&&c.seated&&c.furnitureUse?.type==='bench'&&!c.path?.length&&!c.indoorLocation){
  rows.push({id:c.id,use:{...c.furnitureUse,posePoint:c.furnitureUse.posePoint&&{...c.furnitureUse.posePoint}},facing:c.facingTarget&&{...c.facingTarget}});
 }
 return rows;
}
export function applyBenchSeats(city,rows){
 if(!rows)return;
 for(const c of city.citizens||[])if(c.furnitureUse?.id?.startsWith('bench:')){c.seated=false;c.furnitureUse=null;}
 for(const row of rows){
  const c=city.society.citizen(row.id);if(!c)continue;
  c.seated=true;c.furnitureUse=row.use;c.facingTarget=row.facing;
  // A confirmed outdoor seat supersedes an earlier indoor journey snapshot.
  c.indoorLocation=null;c.mobilityTrip=null;c.ridingVehicleId=null;
 }
}
