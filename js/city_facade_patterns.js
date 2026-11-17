// Repeating floor types keep variation deliberate and stable as a tower grows.
export function buildingFloorDesign(building,floor){
 const seed=Math.imul((building.id||0)+37,2654435761)>>>0;
 const period=2+seed%3,index=Math.max(0,floor-1)%period;
 return {period,index,balconies:index!==1,windowStyle:seed%4};
}

/** Select at most one opening per room, with two solid bays between windows. */
export function buildingFacadeWindowMask(building,unit,availableSides){
 if(!unit.hasWindow||!availableSides)return 0;
 const frontBack=availableSides&3,bit=frontBack?(frontBack&2?2:1):(availableSides&4?4:8);
 const horizontal=!!(bit&3),length=horizontal?building.width:building.depth,along=horizontal?unit.x:unit.y;
 const phase=Math.floor(length/2)%Math.min(3,length);
 return along%3===phase?bit:0;
}
