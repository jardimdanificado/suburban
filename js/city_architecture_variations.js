import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';

// Decorative features stay above the ground or within the footprint, so they
// never claim road cells or interfere with navigation.
export function addArchitectureVariations(THREE,parent,b){
 const residential=['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing'].includes(b.type),seed=(Math.imul(b.id,2654435761)>>>0),mats=new Map();
 const mat=color=>{if(!mats.has(color))mats.set(color,new THREE.MeshLambertMaterial({color}));return mats.get(color);};
 const box=(w,h,d,x,y,z,color)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const wood=0x80664e,metal=0x566269,green=0x658f50,clay=0xa96748,white=0xe4ddc8;
 if(residential&&b.floors>=2){
  const floor=1+seed%(b.floors-1),y=floor*CITY_FLOOR_HEIGHT,x=.65+(seed%Math.max(1,b.width-1));
  box(.85,.09,.55,x,y+.08,b.depth+.2,wood);box(.85,.05,.045,x,y+.55,b.depth+.45,metal);
  for(const dx of [-.38,0,.38])box(.035,.48,.035,x+dx,y+.31,b.depth+.45,metal);
  if(seed&1){box(.2,.15,.2,x-.19,y+.18,b.depth+.31,clay);box(.16,.22,.16,x-.19,y+.36,b.depth+.31,green);}
 }
 const roof=b.floors*CITY_FLOOR_HEIGHT+.13;
 if(residential&&seed%3===0){
  // Rooftop laundry: a line and several different pieces of cloth.
  for(const x of [.45,b.width-.45])box(.045,.9,.045,x,roof+.45,b.depth*.5,wood);
  box(Math.max(.1,b.width-.9),.025,.025,b.width/2,roof+.84,b.depth*.5,metal);
  for(let i=0;i<3;i++)box(.25,.32,.025,.75+i*.4,roof+.64,b.depth*.5,[white,0x8da6b4,0xd09a86][i]);
 }else if(seed%4===1&&b.width>=2&&b.depth>=2){
  for(const [x,z] of [[.45,.45],[.8,.45],[.45,.8]]){box(.26,.18,.26,x,roof+.09,z,clay);box(.21,.24,.21,x,roof+.28,z,green);}
 }else if(seed%5===2){box(.6,.6,.6,b.width-.5,roof+.3,b.depth-.5,0x78959a);box(.65,.05,.65,b.width-.5,roof+.62,b.depth-.5,metal);}
}
