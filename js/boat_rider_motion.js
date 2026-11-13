const classes=[null,'canoe','launch','ferry','cargo'];
export function packBoatRiders(citizens){
 const result=new Float64Array(citizens.length*3);
 citizens.forEach((person,index)=>{result[index*3]=person.id;result[index*3+1]=person.boatVehicleId??0;result[index*3+2]=Math.max(0,classes.indexOf(person.boatClass));});return result;
}
export function applyBoatRiders(city,rows){
 if(!rows)return;
 for(let at=0;at<rows.length;at+=3){
  const person=city.society.citizen(rows[at]);if(!person)continue;
  const old=person.boatVehicleId,next=rows[at+1]||null;
  if(old&&old!==next){const boat=city.vehicles.units.get(old);if(boat?.transportCitizenId===person.id){boat.transportCitizenId=null;boat.driverId=null;}}
  person.boatVehicleId=next;person.boatClass=classes[rows[at+2]]||null;
  if(next){const boat=city.vehicles.units.get(next);if(boat){boat.transportCitizenId=person.id;boat.driverId=person.id;}}
 }
}

// Compact tow state keeps land rigs and carried bicycles current between full graph snapshots.
export function packBoatTows(citizens){
 const active=citizens.filter(c=>c.localBoatTrip),rows=new Float64Array(active.length*4);
 active.forEach((c,i)=>{rows.set([c.id,c.towedBoatId||0,c.towBikeId||0,c.ridingVehicleId||0],i*4);});return rows;
}
export function applyBoatTows(city,rows){
 if(!rows)return;
 for(const person of city.citizens||[]){
  if(!person._boatTowMotion)continue;
  const boat=city.vehicles.units.get(person.towedBoatId),bike=city.vehicles.units.get(person._boatTowRideId);
  if(boat)boat.towedByVehicleId=null;
  if(bike){bike.towedBoatId=null;bike.ferrying=false;if(bike.driverId===person.id)bike.driverId=null;}
  if(person.ridingVehicleId===person._boatTowRideId){person.ridingVehicleId=null;person.ridingVehicleKind=null;}
  person.towedBoatId=null;person.towBikeId=null;person._boatTowMotion=false;person._boatTowRideId=null;
 }
 for(let i=0;i<rows.length;i+=4){
  const person=city.society.citizen(rows[i]);if(!person)continue;
  person._boatTowMotion=true;person.towedBoatId=rows[i+1]||null;person.towBikeId=rows[i+2]||null;person._boatTowRideId=rows[i+3]||null;
  const boat=city.vehicles.units.get(person.towedBoatId),bike=city.vehicles.units.get(person._boatTowRideId);
  if(boat)boat.towedByVehicleId=person.towBikeId;
  if(bike){person.ridingVehicleId=bike.id;person.ridingVehicleKind=bike.good;bike.driverId=person.id;bike.towedBoatId=person.towedBoatId;bike.ferrying=!!person.boatClass;}
 }
}
