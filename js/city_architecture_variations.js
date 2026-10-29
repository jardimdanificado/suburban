import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {HOUSE_STYLES} from './city_culture.js';
import {INDUSTRIES} from './city_industries.js';

import {mergeStaticMeshes} from './city_static_mesh.js';

// These additions are architectural meshes, not extra simulated rooms. They
// sit on the roof or above head height and never reserve street tiles.
export function addArchitectureVariations(THREE,parent,b,spaces=[]){
 const residential=['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing'].includes(b.type),civic=['townhall','council_chamber'].includes(b.type),industrial=['builder','mill','sawmill','foundry','steel_mill','brickworks','glassworks','paper_mill','weaving','cycle_assembler','rubberworks'].includes(b.type)||INDUSTRIES[b.type]?.category==='industry';
 const seed=(Math.imul(b.id+37,2654435761)>>>0),variant=seed%5,mats=new Map(),root=new THREE.Group();parent.add(root);
 const mat=color=>{if(!mats.has(color))mats.set(color,new THREE.MeshLambertMaterial({color}));return mats.get(color);};
 const box=(w,h,d,x,y,z,color)=>{if(w<=0||h<=0||d<=0)return;const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
 const cylinder=(r,h,x,y,z,color)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,8),mat(color));m.position.set(x,y,z);m.castShadow=true;root.add(m);return m;};
 const style=HOUSE_STYLES[b.architecture]||HOUSE_STYLES.modern,roofColor=style.roof,wood=0x80644b,metal=0x52656a,cream=0xe3d8bb,green=0x59834e,clay=0xb77856,roof=b.floors*CITY_FLOOR_HEIGHT,front=b.depth;
 const balcony=space=>{
  const {floor,side,width,depth,planters}=space,along=space.doorAlong??space.along,y=floor*CITY_FLOOR_HEIGHT,axisX=side==='front'||side==='back',normal=side==='front'?1:side==='back'?-1:side==='left'?-1:1;
  const wall=side==='front'?b.depth:side==='back'?0:side==='left'?0:b.width,center=wall+normal*depth/2,edge=wall+normal*(depth+.04);
  if(axisX){box(width,.13,depth+.08,along,y+.06,center,roofColor);box(width,.085,.07,along,y+.7,edge,metal);
   for(const dx of [-width/2+.04,width/2-.04])box(.07,.68,depth,along+dx,y+.37,wall+normal*depth/2,metal);
   const count=Math.floor(width/.5);for(let n=0;n<=count;n++)box(.045,.64,.045,along-width/2+n*width/Math.max(1,count),y+.37,edge,metal);
   if(planters)for(const dx of [-width*.28,width*.28]){box(.38,.22,.24,along+dx,y+.19,wall+normal*(depth-.12),clay);box(.32,.3,.22,along+dx,y+.43,wall+normal*(depth-.12),green);}
  }else{box(depth+.08,.13,width,center,y+.06,along,roofColor);box(.07,.085,width,edge,y+.7,along,metal);
   for(const dz of [-width/2+.04,width/2-.04])box(depth,.68,.07,wall+normal*depth/2,y+.37,along+dz,metal);
   const count=Math.floor(width/.5);for(let n=0;n<=count;n++)box(.045,.64,.045,edge,y+.37,along-width/2+n*width/Math.max(1,count),metal);
   if(planters)for(const dz of [-width*.28,width*.28]){box(.24,.22,.38,wall+normal*(depth-.12),y+.19,along+dz,clay);box(.22,.3,.32,wall+normal*(depth-.12),y+.43,along+dz,green);}
  }
  return {y,axisX,wall,normal};
 };
 const furnishedBalcony=space=>{
  const pos=balcony(space),{y,axisX,wall,normal}=pos,door=space.doorAlong;
  if(axisX){for(const dx of [-.25,.25])box(.06,1.45,.08,door+dx,y+.725,wall+normal*.04,wood);box(.55,.07,.08,door,y+1.47,wall+normal*.04,wood);box(.28,.35,.28,door+(space.along<=door?1:-1)*Math.max(.18,space.width*.3),y+.3,wall+normal*space.depth*.66,0x8c7358);}
  else{for(const dz of [-.25,.25])box(.08,1.45,.06,wall+normal*.04,y+.725,door+dz,wood);box(.08,.07,.55,wall+normal*.04,y+1.47,door,wood);box(.28,.35,.28,wall+normal*space.depth*.66,y+.3,door+(space.along<=door?1:-1)*Math.max(.18,space.width*.3),0x8c7358);}
 };
 if(residential){
  // Several recognizable silhouettes, rather than one tiny accessory.
  for(const space of spaces.filter(s=>s.kind==='balcony'))furnishedBalcony(space);
  // Distinct horizontal floor bands leave the window openings unobstructed.
  if(variant===2||variant===4)for(let floor=1;floor<b.floors;floor++)box(b.width+.1,.12,.16,b.width/2,floor*CITY_FLOOR_HEIGHT+.12,front+.045,variant===2?cream:roofColor);
  for(let floor=0;floor<b.floors;floor++)for(let col=0;col<b.width;col++){
   const x=col+.5,y=floor*CITY_FLOOR_HEIGHT;if(spaces.some(s=>s.kind==='balcony'&&s.floor===floor&&['front','back'].includes(s.side)&&Math.abs(s.doorAlong-x)<.1))continue;
   if((col+floor+variant)%3===0){box(.52,.12,.22,x,y+.62,front+.13,clay);box(.4,.18,.18,x,y+.76,front+.14,green);}
   else if((col+variant)%4===0){const awning=box(.65,.08,.32,x,y+1.32,front+.16,variant%2?0xb97a60:0x90a6a0);if(awning)awning.rotation.x=.15;}
  }
  if(style.roofKind==='flat'){
   // A sizable roof garden or shaded terrace, inside the roof footprint.
   const y=roof+.17;
   for(const z of [.12,b.depth-.12])box(b.width-.2,.38,.1,b.width/2,y+.19,z,cream);
   for(const x of [.12,b.width-.12])box(.1,.38,b.depth-.2,x,y+.19,b.depth/2,cream);
   box(.8,.12,.36,b.width*.25,y+.35,b.depth*.72,wood);for(const x of [b.width*.25-.3,b.width*.25+.3])box(.08,.32,.3,x,y+.16,b.depth*.72,wood);
   box(.42,.1,.42,b.width*.73,y+.42,b.depth*.72,cream);box(.07,.4,.07,b.width*.73,y+.2,b.depth*.72,metal);
   if(variant===0||variant===3){
    for(const x of [.45,b.width-.45])for(const z of [.45,b.depth-.45]){box(.13,1.35,.13,x,y+.7,z,wood);box(.6,.24,.45,x,y+.12,z,clay);box(.5,.42,.35,x,y+.42,z,green);}
    for(const z of [.45,b.depth-.45])box(Math.max(.2,b.width-.9),.12,.12,b.width/2,y+1.4,z,wood);
    for(let i=0;i<4;i++)box(.1,.09,Math.max(.3,b.depth-.9),.55+i*Math.max(.15,(b.width-1.1)/3),y+1.48,b.depth/2,wood);
   }else{
    for(const x of [.4,b.width-.4])box(.07,1.15,.07,x,y+.58,b.depth*.5,wood);
    box(Math.max(.1,b.width-.8),.04,.04,b.width/2,y+1.1,b.depth*.5,metal);
    for(let i=0;i<4;i++)box(.3,.5,.035,.65+i*Math.max(.28,(b.width-1.3)/3),y+.84,b.depth*.5,[cream,0x9eb9c7,0xc7836d,0xe0c773][i]);
   }
  }else{
   // Brick chimneys and visible roof dormers differ by building, without
   // placing an extra room over the real attic.
   box(.35,1.05,.35,b.width*.24,roof+.72,b.depth*.35,clay);box(.46,.12,.46,b.width*.24,roof+1.26,b.depth*.35,metal);
   if(variant%2===0){box(.9,.65,.55,b.width*.67,roof+.45,b.depth*.45,cream);box(1,.14,.7,b.width*.67,roof+.82,b.depth*.45,roofColor);}
  }
 }else if(!civic){
  if(b.type==='office_tower'){
   // Recessed terraces and projecting canopies make office buildings legible.
   for(const space of spaces.filter(s=>s.kind==='balcony'))furnishedBalcony(space);
   box(Math.max(.6,b.width*.7),.2,Math.max(.6,b.depth*.65),b.width/2,roof+.22,b.depth/2,metal);
   for(const x of [.4,b.width-.4])for(const z of [.4,b.depth-.4])box(.1,.85,.1,x,roof+.7,z,metal);
   box(b.width-.5,.12,b.depth-.5,b.width/2,roof+1.15,b.depth/2,0x9db8b8);
  }else if(industrial){
   // Large roof equipment and alternating shed forms identify workshops.
   if(variant===0||variant===2){const count=1+seed%2;for(let i=0;i<count;i++){const x=b.width*(i+1)/(count+1);cylinder(.25,1.75,x,roof+.98,b.depth*.48,metal);cylinder(.34,.16,x,roof+1.88,b.depth*.48,cream);}}
   else if(variant===1){for(const x of [b.width*.3,b.width*.7]){cylinder(.38,1.15,x,roof+.68,b.depth*.5,0x9aabb0);cylinder(.43,.13,x,roof+1.3,b.depth*.5,metal);}}
   else {box(Math.max(.8,b.width*.65),1.1,Math.max(.65,b.depth*.45),b.width*.5,roof+.67,b.depth*.5,variant===3?0xb97559:0x7d9598);box(Math.max(.9,b.width*.72),.15,Math.max(.75,b.depth*.53),b.width*.5,roof+1.3,b.depth*.5,metal);}
   box(Math.max(.8,b.width*.55),.35,Math.max(.65,b.depth*.36),b.width*.5,roof+.29,b.depth*.7,0x89999a);
   for(const space of spaces.filter(s=>s.kind==='balcony'))furnishedBalcony(space);
  }else{
   // Repeated facade projections and a roof canopy give small services a
   // recognizable profile without covering their existing windows.
   for(const space of spaces.filter(s=>s.kind==='balcony'))furnishedBalcony(space);
   box(Math.max(.7,b.width*.7),.2,Math.max(.7,b.depth*.55),b.width/2,roof+.22,b.depth/2,metal);
   for(const x of [.45,b.width-.45])box(.1,1.05,.1,x,roof+.7,b.depth*.5,wood);
   box(Math.max(.8,b.width-.6),.12,Math.max(.6,b.depth*.5),b.width/2,roof+1.25,b.depth*.5,variant%2?0xc98964:0x83a59b);
  }
 }
 mergeStaticMeshes(THREE,root);
}
