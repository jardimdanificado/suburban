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
