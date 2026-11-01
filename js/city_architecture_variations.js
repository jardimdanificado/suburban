import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {HOUSE_STYLES} from './city_culture.js?v=restored-building-styles-1';
import {INDUSTRIES} from './city_industries.js';

import {mergeStaticMeshes} from './city_static_mesh.js?v=mine-sign-1';

// These additions are architectural meshes, not extra simulated rooms. They
// sit on the roof or above head height and never reserve street tiles.
export function addArchitectureVariations(THREE,parent,b,spaces=[]){
 const residential=['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing'].includes(b.type),civic=['townhall','council_chamber'].includes(b.type),industrial=['builder','mill','sawmill','foundry','steel_mill','brickworks','glassworks','paper_mill','weaving','cycle_assembler','rubberworks'].includes(b.type)||INDUSTRIES[b.type]?.category==='industry';
 const seed=(Math.imul(b.id+37,2654435761)>>>0),variant=seed%15,mats=new Map(),root=new THREE.Group();parent.add(root);
 const mat=color=>{if(!mats.has(color))mats.set(color,new THREE.MeshLambertMaterial({color}));return mats.get(color);};
 const box=(w,h,d,x,y,z,color)=>{if(w<=0||h<=0||d<=0)return;const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
 const cylinder=(r,h,x,y,z,color)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,8),mat(color));m.position.set(x,y,z);m.castShadow=true;root.add(m);return m;};
 const style=HOUSE_STYLES[b.architecture]||HOUSE_STYLES.modern,roofColor=style.roof,wood=0x80644b,metal=0x52656a,cream=0xe3d8bb,green=0x59834e,clay=0xb77856,roof=b.floors*CITY_FLOOR_HEIGHT,front=b.depth,roofX=b.roofX??0,roofY=b.roofY??0,roofWidth=b.roofWidth??b.width,roofDepth=b.roofDepth??b.depth;
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
  if(['gingerbread','island_cottage','shotgun','chattel_house','colonial_veranda','pastel_cottage','veranda_duplex','stilt_house','breezeway_house','coral_gable','wraparound_veranda','st_lucia_villa'].includes(b.architecture)){
   const porchDepth=['shotgun','stilt_house','wraparound_veranda'].includes(b.architecture)?.78:.62,porchY=1.72,postXs=[.28,b.width-.28];
   box(b.width+.16,.12,porchDepth,b.width/2,porchY,front+porchDepth*.42,roofColor);
   for(const x of postXs){box(.11,1.68,.11,x,.84,front+porchDepth*.75,wood);box(.2,.1,.2,x,1.7,front+porchDepth*.75,cream);}
   box(b.width-.36,.07,.07,b.width/2,.72,front+porchDepth*.94,wood);
   const railCount=Math.max(2,Math.floor(b.width/.42));for(let i=0;i<=railCount;i++)box(.045,.62,.045,.18+i*(b.width-.36)/railCount,.39,front+porchDepth*.94,cream);
   for(let col=0;col<b.width;col++)if((col+variant)%2===0){
    const x=col+.5;for(const side of [-1,1])box(.12,.52,.11,x+side*.34,1.08,front+.14,variant%2?0x4c7573:0x9b5f4e);
    if(b.architecture==='gingerbread')for(const side of [-1,1])box(.25,.07,.12,x+side*.4,1.43,front+.2,cream);
   }
   if(b.architecture==='gingerbread')for(let i=0;i<Math.min(7,b.width*2);i++)box(.07,.2,.07,.2+i*(b.width-.4)/Math.max(1,Math.min(7,b.width*2)-1),1.82,front+.31,i%2?0xe7cb9e:0xc47768);
  }
  if(b.architecture==='coastal_concrete'){
   for(const x of [.12,b.width-.12])box(.12,.32,b.depth+.08,x,roof+.12,b.depth/2,cream);
   const cistern=new THREE.Mesh(new THREE.CylinderGeometry(.38,.4,.72,8),mat(0x879a91));cistern.position.set(b.width*.72,roof+.55,b.depth*.68);cistern.castShadow=true;root.add(cistern);
   for(let col=0;col<b.width;col+=2){box(.62,.72,.1,col+.5,.98,front+.15,variant%2?0x597e79:0x8c6555);box(.72,.09,.15,col+.5,1.38,front+.19,cream);}
  }
  // Fifteen facade treatments add recognizable island details: shutters,
  // jalousie screens, painted brackets, breeze blocks and deep shade eaves.
  const facadePalette=[0x42847c,0xd4775e,0xe3bd63,0x657d9a,0xa45d54,0x71936c,0x9e7798,0xc78358,0x528d91,0xdda77e,0x6d7d54,0x8498a6,0xb75f56,0x5e8173,0xd0ad59];
  if(variant%3===0){for(let col=0;col<b.width;col++){const x=col+.5;for(let floor=0;floor<b.floors;floor++)if((col+floor+variant)%2===0){box(.12,.5,.1,x-.34,floor*CITY_FLOOR_HEIGHT+.9,front+.14,facadePalette[variant]);box(.12,.5,.1,x+.34,floor*CITY_FLOOR_HEIGHT+.9,front+.14,facadePalette[(variant+3)%15]);}}}
  else if(variant%3===1){const count=Math.max(2,b.width*2);for(let i=0;i<count;i++){const x=.2+i*Math.max(.1,(b.width-.4)/(count-1));box(.075,.34,.07,x,1.08,front+.16,facadePalette[variant]);box(.23,.055,.12,x,1.29,front+.19,cream);}}
  else{for(const x of [.22,b.width-.22]){box(.14,1.25,.14,x,.62,front+.1,facadePalette[variant]);box(.34,.12,.2,x,1.28,front+.14,cream);}}
  if(style.roofKind==='flat'){
   // A sizable roof garden or shaded terrace, inside the roof footprint.
   const y=roof+.17;
   for(const z of [roofY+.12,roofY+roofDepth-.12])box(roofWidth-.2,.38,.1,roofX+roofWidth/2,y+.19,z,cream);
   for(const x of [roofX+.12,roofX+roofWidth-.12])box(.1,.38,roofDepth-.2,x,y+.19,roofY+roofDepth/2,cream);
   box(.8,.12,.36,roofX+roofWidth*.25,y+.35,roofY+roofDepth*.72,wood);for(const x of [roofX+roofWidth*.25-.3,roofX+roofWidth*.25+.3])box(.08,.32,.3,x,y+.16,roofY+roofDepth*.72,wood);
   box(.42,.1,.42,roofX+roofWidth*.73,y+.42,roofY+roofDepth*.72,cream);box(.07,.4,.07,roofX+roofWidth*.73,y+.2,roofY+roofDepth*.72,metal);
   if(variant===0||variant===3){
    for(const x of [roofX+.45,roofX+roofWidth-.45])for(const z of [roofY+.45,roofY+roofDepth-.45]){box(.13,1.35,.13,x,y+.7,z,wood);box(.6,.24,.45,x,y+.12,z,clay);box(.5,.42,.35,x,y+.42,z,green);}
    for(const z of [roofY+.45,roofY+roofDepth-.45])box(Math.max(.2,roofWidth-.9),.12,.12,roofX+roofWidth/2,y+1.4,z,wood);
    for(let i=0;i<4;i++)box(.1,.09,Math.max(.3,roofDepth-.9),roofX+.55+i*Math.max(.15,(roofWidth-1.1)/3),y+1.48,roofY+roofDepth/2,wood);
   }else{
    for(const x of [roofX+.4,roofX+roofWidth-.4])box(.07,1.15,.07,x,y+.58,roofY+roofDepth*.5,wood);
    box(Math.max(.1,roofWidth-.8),.04,.04,roofX+roofWidth/2,y+1.1,roofY+roofDepth*.5,metal);
    for(let i=0;i<4;i++)box(.3,.5,.035,roofX+.65+i*Math.max(.28,(roofWidth-1.3)/3),y+.84,roofY+roofDepth*.5,[cream,0x9eb9c7,0xc7836d,0xe0c773][i]);
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
  }else if(['police_station','jail','crematorium','iml','courthouse','council_oversight_office'].includes(b.type)){
   const palettes={police_station:[0x526e70,0xe1d5b8],jail:[0x766d61,0xb9a88c],crematorium:[0xa7755d,0xe8d9bd],iml:[0x68838a,0xe5e4d8],courthouse:[0x9c7b58,0xe2d5b7],council_oversight_office:[0x65827e,0xded4b7]},[accent,light]=palettes[b.type];
   const porch=Math.min(.7,b.depth*.24),frontZ=b.depth+porch*.55;
   box(b.width+.12,.13,porch,b.width/2,1.72,frontZ,variant%2?accent:style.roof);
   for(const x of [.3,b.width-.3]){cylinder(.08,1.65,x,.82,frontZ+porch*.34,light);box(.18,.1,.18,x,1.68,frontZ+porch*.34,accent);}
   box(b.width-.35,.07,.07,b.width/2,.76,frontZ+porch*.72,accent);
   if(b.type==='police_station'){
    box(b.width*.36,.68,b.depth*.36,b.width*.76,roof+.33,b.depth*.25,light);box(b.width*.42,.15,b.depth*.42,b.width*.76,roof+.76,b.depth*.25,accent);
    for(const x of [b.width*.3,b.width*.7])box(.44,.13,.18,x,1.94,b.depth+.11,variant%2?light:0x63877d);
   }else if(b.type==='jail'){
    for(let i=0;i<Math.max(4,b.width*2);i++){const x=.24+i*(b.width-.48)/(Math.max(4,b.width*2)-1);box(.045,.68,.06,x,1.05,b.depth+.19,accent);}
    box(b.width*.28,.58,b.depth*.3,b.width*.76,roof+.3,b.depth*.24,accent);box(b.width*.34,.12,b.depth*.36,b.width*.76,roof+.66,b.depth*.24,light);
   }else if(b.type==='crematorium'){
    const stackX=b.width*.76,stackZ=b.depth*.25;box(.38,1.25,.38,stackX,roof+.62,stackZ,accent);box(.52,.12,.52,stackX,roof+1.3,stackZ,light);
    for(const x of [.42,b.width/2,b.width-.42])box(.08,.72,.08,x,1.02,b.depth+.18,light);
   }else if(b.type==='iml'){
    box(b.width*.34,.92,.18,b.width*.72,roof+.5,b.depth*.25,light);box(b.width*.42,.13,.25,b.width*.72,roof+1,b.depth*.25,accent);
    for(let i=0;i<5;i++)box(.26,.08,.1,.35+i*.34,1.98,b.depth+.15,variant%2?light:0x9fb1a9);
   }else{
    for(let i=0;i<4;i++)cylinder(.075,1.65,.38+i*(b.width-.76)/3,.82,b.depth+.17,light);
    const pediment=new THREE.Mesh(new THREE.ConeGeometry(Math.max(.7,b.width*.48),.48,3),mat(accent));pediment.rotation.y=Math.PI/2;pediment.position.set(b.width/2,1.86,b.depth+.16);root.add(pediment);
   }
   const signColors=[0xd88d63,0x5d8c83,0xe1bd70,0x72879a];box(Math.min(1.1,b.width*.52),.16,.06,b.width/2,2.15,b.depth+.17,signColors[variant%signColors.length]);
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
