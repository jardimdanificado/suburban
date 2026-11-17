// A building chooses one composition; its floor types repeat within that family.
export function buildingFacadeComposition(building){
 const seed=Math.imul((building.id||0)+37,2654435761)>>>0;
 return {family:(seed>>>8)%4,period:2+seed%3,windowStyle:seed%4};
}

export function buildingFloorDesign(building,floor){
 const {family,period,windowStyle}=buildingFacadeComposition(building),index=Math.max(0,floor-1)%period;
 return {period,index,balconies:index!==1,windowStyle:(windowStyle+(index===2?1:0))%4,family};
}

/** Some buildings leave one secondary facade plain on a repeating floor type. */
export function buildingBlankFacadeMask(building,floor){
 if(floor<1||building.width<2||building.depth<2)return 0;
 const seed=Math.imul((building.id||0)+37,2654435761)>>>0;
 if((seed>>>16)%3!==0||buildingFloorDesign(building,floor).index!==1)return 0;
 // Keep the entrance facade active. Bits rotate from model space to world space.
 const sides=[[1,4,2,8],[4,2,8,1],[8,1,4,2]];
 return sides[(seed>>>20)%3][(building.rotation||0)%4];
}

/** Size window groups to each facade, including both exposed faces of corner rooms. */
export function buildingFacadeWindowMask(building,unit,availableSides){
 if(!unit.hasWindow||!availableSides)return 0;
 const {family}=buildingFacadeComposition(building);
 availableSides&=~buildingBlankFacadeMask(building,unit.z);
 let mask=0;
 for(const bit of [1,2,4,8]){
  if(!(availableSides&bit))continue;
  const horizontal=!!(bit&3),length=horizontal?building.width:building.depth,along=horizontal?unit.x:unit.y;
  const density=[.6,.75,.5,.67][family],count=length<=2?length:Math.min(length-1,Math.max(2,Math.ceil(length*density)));
  // Evenly spaced groups keep openings on small fronts and solid bays on larger walls.
  for(let i=0;i<count;i++){
   const bay=count===1?Math.floor(length/2):Math.round(i*(length-1)/(count-1));
   if(along===bay){mask|=bit;break;}
  }
 }
 return mask;
}
