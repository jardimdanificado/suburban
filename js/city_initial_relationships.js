import {SOCIAL_RULES} from './city_society.js';

/** Founding residents arrive with a shared past, rather than meeting as strangers. */
export function populateFoundingCommunity(city,arrivalTiles){
 const singles=30,groups=[],groupSize=40;
 for(let index=0;index<city.initialPopulation;index++){
  const offset=index-singles,slot=offset<0?-1:offset%groupSize,base=index-slot;
  let options={};
  if(slot>=0){
   const group=Math.floor(offset/groupSize),sameGender=group%2===0?'woman':'man';
   const ages=[60,58,37,35,32,33,7,11,5,34,9,25,22,28,31,26,42,36,24,45];
   const parents=slot===2||slot===4?[base,base+1]:slot===6||slot===7?[base+2,base+3]:slot===8?[base+4,base+5]:slot===10?[base+9]:[];
   const gender=slot===0||slot===2?'man':slot===1||slot===3?'woman':slot===4||slot===5?sameGender:null;
   options={age:(ages[slot]??20+(slot*7)%26)+Math.floor(city.random()*3),parentIds:parents.map(i=>city.citizens[i].id),...(gender?{gender,nameGender:gender==='man'?'masculino':'feminino',orientation:slot===4||slot===5?'homo':'hetero',wantsRomance:true}:{})};
   if(slot===0)groups.push(base);
  }
  const position=arrivalTiles[index%arrivalTiles.length],person=city.addCitizen(position.x,position.y,index,options);
  for(const id of person.parentIds)city.society.citizen(id).childIds.push(person.id);
  if(city.society.isAdult(person))person.guardianId=null;
 }
 const year=1440*SOCIAL_RULES.daysPerYear;
 const bond=(a,b,kind)=>{
  const relation=city.society.getRelation(a,b,true);
  const sharedYears=Math.min(1+Math.floor(city.random()*8),city.society.age(a),city.society.age(b));
  relation.since=city.minute-sharedYears*year;
  relation.familiarity=60+Math.floor(city.random()*40);
  relation.conversations=20+Math.floor(city.random()*180);
  for(const person of [a,b]){
   const view=relation.views[person.id];
   Object.assign(view,kind==='rival'?{affection:-10-city.random()*20,trust:15,respect:45,resentment:35+city.random()*20,status:'rival'}:{affection:60+city.random()*30,trust:60+city.random()*30,respect:55+city.random()*30,status:'close',wasFriend:true});
   view.lastStatusAt=relation.since;
  }
  city.relationships.sync(relation);return relation;
 };
 for(const base of groups){
  const members=city.citizens.slice(base,base+groupSize);
  // Materialize extended family contacts after the whole genealogy exists.
  for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++)if(city.society.related(members[i],members[j]))bond(members[i],members[j],'family');
  for(const slot of [0,2,4]){
   const a=members[slot],b=members[slot+1];if(!b||!city.society.canPartner(a,b))continue;
   const relation=bond(a,b,'partner');a.partnerId=b.id;b.partnerId=a.id;
   relation.partnerSince=relation.since;
   for(const person of [a,b])relation.views[person.id].romance='partner';
   city.relationships.sync(relation);
  }
 }
 // Bounded cross-family contacts keep startup work linear in population.
 const adults=city.citizens.filter(person=>city.society.isAdult(person));
 for(let index=0;index<adults.length;index++)for(const [distance,kind]of [[1,'friend'],[5,'rival']]){
  const a=adults[index],b=adults[(index+distance)%adults.length];
  if(a===b||city.society.getRelation(a,b)||city.society.related(a,b))continue;
  bond(a,b,kind);
 }
 city.familyIndexDirty=true;city.indexFamilies();
}
