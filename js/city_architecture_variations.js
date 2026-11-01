import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import {HOUSE_STYLES} from './city_culture.js?v=portuguese-colonial-forms-6';
import {INDUSTRIES} from './city_industries.js';

import {mergeStaticMeshes} from './city_static_mesh.js?v=mine-sign-1';

// These additions are architectural meshes, not extra simulated rooms. They
// sit on the roof or above head height and never reserve street tiles.
export function addArchitectureVariations(THREE,parent,b,spaces=[],windowDetails=[],entryDoorDetails=null){
 const residential=['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing'].includes(b.type),civic=['townhall','council_chamber'].includes(b.type),industrial=['builder','mill','sawmill','foundry','steel_mill','brickworks','glassworks','paper_mill','weaving','cycle_assembler','rubberworks'].includes(b.type)||INDUSTRIES[b.type]?.category==='industry';
 const seed=(Math.imul(b.id+37,2654435761)>>>0),variant=seed%15,mats=new Map(),root=new THREE.Group(),windowControls=new THREE.Group(),windowShutters=[];parent.add(root,windowControls);
 const mat=color=>{if(!mats.has(color))mats.set(color,new THREE.MeshLambertMaterial({color}));return mats.get(color);};
 const box=(w,h,d,x,y,z,color)=>{if(w<=0||h<=0||d<=0)return;const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
 const cylinder=(r,h,x,y,z,color)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,8),mat(color));m.position.set(x,y,z);m.castShadow=true;root.add(m);return m;};
 const style=HOUSE_STYLES[b.architecture]||HOUSE_STYLES.modern,roofColor=style.roof,wood=0x543b2e,metal=0x303b43,cream=style.trim??0xfff3df,green=0x59834e,clay=0xb77856,roof=b.floors*CITY_FLOOR_HEIGHT,front=b.depth,roofX=b.roofX??0,roofY=b.roofY??0,roofWidth=b.roofWidth??b.width,roofDepth=b.roofDepth??b.depth;
 const balcony=space=>{
  const {floor,side,width,depth,planters}=space,along=space.doorAlong??space.along,y=floor*CITY_FLOOR_HEIGHT,axisX=side==='front'||side==='back',normal=side==='front'?1:side==='back'?-1:side==='left'?-1:1,colonial=style.motif==='portuguese_colonial',deckColor=colonial?(colonialForm==='rural'?0x76533b:colonialForm==='quinta'?0xd1c09e:0xc9b99d):roofColor,railColor=colonial&&colonialForm==='rural'?0x76533b:metal;
  const wall=side==='front'?b.depth:side==='back'?0:side==='left'?0:b.width,center=wall+normal*depth/2,edge=wall+normal*(depth+.04);
  if(axisX){box(width,.13,depth+.08,along,y+.06,center,deckColor);box(width,.085,.07,along,y+.7,edge,railColor);
   for(const dx of [-width/2+.04,width/2-.04])box(.07,.68,depth,along+dx,y+.37,wall+normal*depth/2,colonial?cream:railColor);
   const count=Math.floor(width/(colonial?.34:.5));for(let n=0;n<=count;n++){const x=along-width/2+n*width/Math.max(1,count);box(colonial?.035:.045,.64,.045,x,y+.37,edge,railColor);if(colonial&&n<count)box(.12,.1,.045,x+width/Math.max(1,count)*.5,y+.37,edge,railColor);}
   if(planters)for(const dx of [-width*.28,width*.28]){box(.38,.22,.24,along+dx,y+.19,wall+normal*(depth-.12),clay);box(.32,.3,.22,along+dx,y+.43,wall+normal*(depth-.12),green);}
  }else{box(depth+.08,.13,width,center,y+.06,along,deckColor);box(.07,.085,width,edge,y+.7,along,railColor);
   for(const dz of [-width/2+.04,width/2-.04])box(depth,.68,.07,wall+normal*depth/2,y+.37,along+dz,colonial?cream:railColor);
   const count=Math.floor(width/(colonial?.34:.5));for(let n=0;n<=count;n++){const z=along-width/2+n*width/Math.max(1,count);box(.045,.64,colonial?.035:.045,edge,y+.37,z,railColor);if(colonial&&n<count)box(.045,.1,.12,edge,y+.37,z+width/Math.max(1,count)*.5,railColor);}
   if(planters)for(const dz of [-width*.28,width*.28]){box(.24,.22,.38,wall+normal*(depth-.12),y+.19,along+dz,clay);box(.22,.3,.32,wall+normal*(depth-.12),y+.43,along+dz,green);}
  }
  return {y,axisX,wall,normal};
 };
 const furnishedBalcony=space=>{
  const pos=balcony(space),{y,axisX,wall,normal}=pos,door=space.doorAlong,postColor=style.motif==='portuguese_colonial'?(colonialForm==='rural'?0x76533b:colonialForm==='barroco'?style.accent:metal):wood,capColor=style.motif==='portuguese_colonial'?(colonialForm==='quinta'?style.accent:cream):wood;
  if(axisX){for(const dx of [-.25,.25])box(.06,1.45,.08,door+dx,y+.725,wall+normal*.04,postColor);box(.55,.07,.08,door,y+1.47,wall+normal*.04,capColor);box(.28,.35,.28,door+(space.along<=door?1:-1)*Math.max(.18,space.width*.3),y+.3,wall+normal*space.depth*.66,0x8c7358);}
  else{for(const dz of [-.25,.25])box(.08,1.45,.06,wall+normal*.04,y+.725,door+dz,postColor);box(.08,.07,.55,wall+normal*.04,y+1.47,door,capColor);box(.28,.35,.28,wall+normal*space.depth*.66,y+.3,door+(space.along<=door?1:-1)*Math.max(.18,space.width*.3),0x8c7358);}
 };
 const motif=style.motif,accent=style.accent??clay,trim=style.trim??cream,colonialForm=style.colonialForm??style.dutchForm??'sobrado';
 if(!residential&&style.motif){
  box(b.width+.12,.11,.16,b.width/2,1.58,front+.08,trim);
  if(motif==='gingerbread')for(let i=0;i<Math.max(3,Math.floor(b.width*1.5));i++){const x=.12+i*(b.width-.24)/Math.max(2,Math.floor(b.width*1.5)-1);box(.07,.2,.07,x,1.8,front+.16,i%2?accent:roofColor);box(.19,.055,.08,x,1.92,front+.16,trim);}
  else if(motif==='chattel'||motif==='shotgun')for(let x=.4;x<b.width-.12;x+=.8){for(const side of [-1,1])box(.09,.48,.09,x+side*.29,1.05,front+.15,accent);box(.7,.07,.13,x,1.31,front+.17,trim);}
  else if(motif==='stilt')for(const x of [.22,b.width-.22]){box(.12,1.15,.12,x,.58,front+.12,accent);box(.19,.1,.19,x,1.17,front+.12,trim);}
  else if(motif==='coral')for(const x of [.13,b.width-.13])for(let row=0;row<4;row++)box(.15,.2,.1,x,.36+row*.32,front+.1,row%2?accent:trim);
  else if(motif==='breeze')for(let i=0;i<Math.max(3,Math.floor(b.width*1.3));i++){const x=.16+i*(b.width-.32)/Math.max(2,Math.floor(b.width*1.3)-1);if(i%2===0){box(.18,.18,.1,x,.82,front+.16,accent);box(.18,.18,.1,x,1.1,front+.16,trim);}}
  else if(motif==='colonial')for(const x of [.25,b.width-.25]){cylinder(.075,1.5,x,.78,front+.16,trim);box(.17,.1,.17,x,1.55,front+.16,accent);}
  else if(motif==='art_deco')for(const x of [.18,b.width-.18]){box(.13,1.8,.14,x,.9,front+.12,accent);box(.24,.1,.2,x,1.75,front+.13,trim);}
  else if(motif==='courtyard'){for(const x of [.2,b.width-.2])box(.08,.6,.08,x,1.3,front+.15,accent);box(b.width-.3,.08,.12,b.width/2,1.65,front+.15,trim);}
  else if(motif==='tin')for(let i=0;i<=Math.max(3,Math.floor(b.width/.3));i++){const x=.12+i*(b.width-.24)/Math.max(3,Math.floor(b.width/.3));box(.035,.12,.18,x,1.65,front+.12,i%2?accent:trim);}
 }
 if(residential){
  // Several recognizable silhouettes, rather than one tiny accessory.
  for(const space of spaces.filter(s=>s.kind==='balcony'))furnishedBalcony(space);
  if(motif==='gingerbread'){
   const porch=.72;box(b.width+.12,.1,porch,b.width/2,1.68,front+porch*.42,roofColor);
   for(const x of [.22,b.width-.22]){box(.09,1.62,.09,x,.81,front+porch*.76,wood);box(.18,.09,.18,x,1.65,front+porch*.76,trim);}
   for(let i=0;i<Math.max(3,Math.floor(b.width*2));i++){const x=.12+i*(b.width-.24)/Math.max(2,Math.floor(b.width*2)-1);box(.07,.22,.07,x,1.88,front+.18,i%2?accent:trim);box(.2,.055,.08,x,1.99,front+.18,roofColor);}
   for(let floor=0;floor<b.floors;floor++)for(let x=.35;x<b.width-.2;x+=1.15){box(.07,.28,.08,x,floor*CITY_FLOOR_HEIGHT+1.05,front+.15,accent);box(.36,.055,.08,x,floor*CITY_FLOOR_HEIGHT+1.21,front+.15,trim);}
  }else if(motif==='chattel'){
   const porch=.58;box(b.width+.14,.1,porch,b.width/2,1.58,front+porch*.42,roofColor);
   for(const x of [.2,b.width-.2]){box(.1,1.54,.1,x,.77,front+porch*.78,wood);box(.15,.11,.15,x,1.56,front+porch*.78,trim);}
   for(let i=0;i<Math.max(3,Math.floor(b.width*2));i++){const x=.16+i*(b.width-.32)/Math.max(2,Math.floor(b.width*2)-1);box(.055,.55,.07,x,.35,front+.12,i%2?accent:trim);}
   for(let floor=0;floor<b.floors;floor++)for(let x=.45;x<b.width-.2;x+=1.1){box(.11,.42,.09,x-.34,floor*CITY_FLOOR_HEIGHT+.94,front+.14,accent);box(.11,.42,.09,x+.34,floor*CITY_FLOOR_HEIGHT+.94,front+.14,accent);}
  }else if(motif==='shotgun'){
   const porch=Math.max(.62,Math.min(.9,b.depth*.28));box(b.width+.16,.11,porch,b.width/2,1.72,front+porch*.42,roofColor);
   const count=Math.max(2,Math.floor(b.width/.8));for(let i=0;i<=count;i++){const x=.16+i*(b.width-.32)/count;box(.07,1.68,.08,x,.84,front+porch*.76,wood);box(.15,.1,.15,x,1.7,front+porch*.76,trim);}
   box(b.width-.3,.07,.07,b.width/2,.72,front+porch*.94,accent);
   for(let x=.4;x<b.width-.2;x+=1.05)for(const side of [-1,1])box(.085,.42,.09,x+side*.34,.98,front+.15,accent);
  }else if(motif==='stilt'){
   for(const x of [.24,b.width-.24])for(const z of [.22,b.depth-.22]){box(.12,1.12,.12,x,.55,z,wood);box(.2,.11,.2,x,1.12,z,trim);}
   for(const x of [.32,b.width-.32]){box(.09,1.25,.09,x,.62,front+.1,accent);box(.09,1.25,.09,x,.62,.1,accent);}
   const porch=.68;box(b.width+.12,.1,porch,b.width/2,1.45,front+porch*.42,roofColor);
   for(let i=0;i<=Math.max(2,Math.floor(b.width/.5));i++){const x=.15+i*(b.width-.3)/Math.max(2,Math.floor(b.width/.5));box(.04,.56,.045,x,1.15,front+porch*.88,trim);}
  }else if(motif==='coral'){
   for(const x of [.12,b.width-.12])for(let floor=0;floor<b.floors;floor++)for(let row=0;row<4;row++)box(.16,.22,.1,x,floor*CITY_FLOOR_HEIGHT+.32+row*.36,front+.08,row%2?accent:trim);
   for(let x=.3;x<b.width-.15;x+=.9){box(.48,.08,.11,x,1.52,front+.1,accent);box(.34,.055,.13,x,1.62,front+.1,trim);}
   box(b.width+.1,.12,.34,b.width/2,.22,front+.05,roofColor);
  }else if(motif==='breeze'){
   for(let floor=0;floor<b.floors;floor++){
    const y=floor*CITY_FLOOR_HEIGHT+.43,columns=Math.max(3,Math.floor(b.width*1.5));
    for(let i=0;i<columns;i++){const x=.15+i*(b.width-.3)/Math.max(1,columns-1);if(i%2===0){box(.16,.18,.1,x,y,front+.14,accent);box(.16,.18,.1,x,y+.27,front+.14,trim);}}
   }
   for(const x of [.16,b.width-.16])box(.12,b.floors*CITY_FLOOR_HEIGHT,.12,x,b.floors*CITY_FLOOR_HEIGHT/2,front+.05,trim);
   box(b.width+.12,.12,.52,b.width/2,1.68,front+.22,roofColor);
  }else if(motif==='colonial'){
   const porch=Math.min(.74,Math.max(.5,b.depth*.24));box(b.width+.16,.12,porch,b.width/2,1.7,front+porch*.4,roofColor);
   const count=Math.max(2,Math.floor(b.width/1.2));for(let i=0;i<=count;i++){const x=.22+i*(b.width-.44)/count;cylinder(.075,1.62,x,.82,front+porch*.78,trim);box(.18,.1,.18,x,1.65,front+porch*.78,accent);}
   box(b.width-.3,.075,.07,b.width/2,.75,front+porch*.94,accent);
   for(let x=.4;x<b.width-.2;x+=1.05){box(.11,.36,.1,x-.34,1.05,front+.13,accent);box(.11,.36,.1,x+.34,1.05,front+.13,accent);box(.82,.07,.16,x,1.27,front+.15,trim);}
  }else if(motif==='art_deco'){
   for(const x of [.2,b.width-.2]){box(.14,b.floors*CITY_FLOOR_HEIGHT,.15,x,b.floors*CITY_FLOOR_HEIGHT/2,front+.06,accent);box(.25,.12,.2,x,b.floors*CITY_FLOOR_HEIGHT-.18,front+.07,trim);}
   const width=Math.min(1.25,b.width-.3);for(let tier=0;tier<4;tier++)box(Math.max(.25,width-tier*.18,.1),.1,.14,b.width/2,1.32+tier*.15,front+.13, tier%2?trim:accent);
   for(let x=.32;x<b.width-.1;x+=1.15)for(let floor=0;floor<b.floors;floor++){box(.09,.68,.1,x,floor*CITY_FLOOR_HEIGHT+.92,front+.14,accent);box(.22,.08,.13,x,floor*CITY_FLOOR_HEIGHT+1.28,front+.16,trim);}
  }else if(motif==='courtyard'){
   const pergolaY=roof+.35;
   for(const x of [.25,b.width-.25]){box(.11,1.2,.11,x,roof+.6,b.depth*.6,wood);box(.2,.12,.2,x,roof+1.16,b.depth*.6,accent);}
   for(let i=0;i<Math.max(3,Math.floor(b.width/.45));i++){const x=.2+i*(b.width-.4)/Math.max(2,Math.floor(b.width/.45)-1);box(.055,.07,b.depth*.35,x,pergolaY,b.depth*.6,trim);}
   box(b.width+.1,.1,.36,b.width/2,1.7,front+.18,roofColor);
   for(let x=.4;x<b.width-.2;x+=1.1){box(.38,.18,.24,x,.42,front+.14,accent);box(.3,.22,.2,x,.62,front+.14,green);}
  }else if(motif==='tin'){
   for(let i=0;i<=Math.max(3,Math.floor(b.width/.28));i++){const x=.12+i*(b.width-.24)/Math.max(3,Math.floor(b.width/.28));box(.035,.08,.52,x,b.floors*CITY_FLOOR_HEIGHT+.04,b.depth/2,metal);}
   box(b.width+.16,.1,.2,b.width/2,1.62,front+.08,accent);
   for(const x of [.2,b.width-.2]){box(.12,.18,.18,x,1.49,front+.1,trim);box(.08,.65,.08,x,.33,front+.12,wood);}
   for(let floor=0;floor<b.floors;floor++)for(let x=.42;x<b.width-.1;x+=1.15){box(.1,.38,.08,x-.32,floor*CITY_FLOOR_HEIGHT+.92,front+.14,accent);box(.1,.38,.08,x+.32,floor*CITY_FLOOR_HEIGHT+.92,front+.14,accent);}
  }
  // Distinct horizontal floor bands leave the window openings unobstructed.
  if(motif!=='portuguese_colonial'&&(variant===2||variant===4))for(let floor=1;floor<b.floors;floor++)box(b.width+.1,.12,.16,b.width/2,floor*CITY_FLOOR_HEIGHT+.12,front+.045,variant===2?cream:roofColor);
  if(motif!=='portuguese_colonial')for(let floor=0;floor<b.floors;floor++)for(let col=0;col<b.width;col++){
   const x=col+.5,y=floor*CITY_FLOOR_HEIGHT;if(spaces.some(s=>s.kind==='balcony'&&s.floor===floor&&['front','back'].includes(s.side)&&Math.abs(s.doorAlong-x)<.1))continue;
   if((col+floor+variant)%3===0){box(.52,.12,.22,x,y+.62,front+.13,clay);box(.4,.18,.18,x,y+.76,front+.14,green);}
   else if((col+variant)%4===0){const awning=box(.65,.08,.32,x,y+1.32,front+.16,variant%2?0xb97a60:0x90a6a0);if(awning)awning.rotation.x=.15;}
  }
  if(motif!=='portuguese_colonial'&&['gingerbread','island_cottage','shotgun','chattel_house','colonial_veranda','pastel_cottage','veranda_duplex','stilt_house','breezeway_house','coral_gable','wraparound_veranda','st_lucia_villa'].includes(b.architecture)){
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
  if(motif!=='portuguese_colonial'&&b.architecture==='coastal_concrete'){
   for(const x of [.12,b.width-.12])box(.12,.32,b.depth+.08,x,roof+.12,b.depth/2,cream);
   const cistern=new THREE.Mesh(new THREE.CylinderGeometry(.38,.4,.72,8),mat(0x879a91));cistern.position.set(b.width*.72,roof+.55,b.depth*.68);cistern.castShadow=true;root.add(cistern);
   for(let col=0;col<b.width;col+=2){box(.62,.72,.1,col+.5,.98,front+.15,variant%2?0x597e79:0x8c6555);box(.72,.09,.15,col+.5,1.38,front+.19,cream);}
  }
  // Fifteen facade treatments add recognizable island details: shutters,
  // jalousie screens, painted brackets, breeze blocks and deep shade eaves.
  const facadePalette=[0x42847c,0xd4775e,0xe3bd63,0x657d9a,0xa45d54,0x71936c,0x9e7798,0xc78358,0x528d91,0xdda77e,0x6d7d54,0x8498a6,0xb75f56,0x5e8173,0xd0ad59];
  if(motif!=='portuguese_colonial'&&variant%3===0){for(let col=0;col<b.width;col++){const x=col+.5;for(let floor=0;floor<b.floors;floor++)if((col+floor+variant)%2===0){box(.12,.5,.1,x-.34,floor*CITY_FLOOR_HEIGHT+.9,front+.14,facadePalette[variant]);box(.12,.5,.1,x+.34,floor*CITY_FLOOR_HEIGHT+.9,front+.14,facadePalette[(variant+3)%15]);}}}
  else if(motif!=='portuguese_colonial'&&variant%3===1){const count=Math.max(2,b.width*2);for(let i=0;i<count;i++){const x=.2+i*Math.max(.1,(b.width-.4)/(count-1));box(.075,.34,.07,x,1.08,front+.16,facadePalette[variant]);box(.23,.055,.12,x,1.29,front+.19,cream);}}
  else if(motif!=='portuguese_colonial'){for(const x of [.22,b.width-.22]){box(.14,1.25,.14,x,.62,front+.1,facadePalette[variant]);box(.34,.12,.2,x,1.28,front+.14,cream);}}
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
 if(motif==='portuguese_colonial'||motif==='dutch_colonial'){
  const dutch=motif==='dutch_colonial',colonialForm=dutch?style.dutchForm:style.colonialForm;
  // Frames are emitted only for the wall cutout selected by the renderer.
  const shutterPanelMaterial=new THREE.MeshLambertMaterial({color:style.accent}),shutterSlatMaterial=new THREE.MeshLambertMaterial({color:style.trim});
  const frontShutterGeometry=new THREE.BoxGeometry(.2,.76,.045),frontSlatGeometry=new THREE.BoxGeometry(.2,.035,.07),sideShutterGeometry=new THREE.BoxGeometry(.045,.76,.2),sideSlatGeometry=new THREE.BoxGeometry(.07,.035,.2);
  const addShutter=(pivotX,pivotY,pivotZ,geometry,slatGeometry,shutterSide,normal,axis,closed,floor)=>{
  const pivot=new THREE.Group();pivot.position.set(pivotX,pivotY,pivotZ);windowControls.add(pivot);
   const glass=new THREE.Mesh(axis==='front'?new THREE.BoxGeometry(.135,.66,.012):new THREE.BoxGeometry(.012,.66,.135),new THREE.MeshLambertMaterial({color:0x91bac3,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide}));
   glass.position.set(axis==='front'?-shutterSide*.1:normal*.014,0,axis==='front'?normal*.014:-shutterSide*.1);pivot.add(glass);
   const panel=new THREE.Mesh(geometry,shutterPanelMaterial);panel.position.set(axis==='front'?-shutterSide*.1:normal*.035,0,axis==='front'?normal*.035:-shutterSide*.1);pivot.add(panel);
   for(let slat=0;slat<4;slat++){
    const louver=new THREE.Mesh(slatGeometry,shutterSlatMaterial);louver.position.set(axis==='front'?-shutterSide*.1:normal*.065,-.24+slat*.16,axis==='front'?normal*.065:-shutterSide*.1);pivot.add(louver);
   }
   const openAngle=axis==='front'?shutterSide*normal*Math.PI*.44:-shutterSide*normal*Math.PI*.44;
   pivot.rotation.y=closed?0:openAngle;windowShutters.push({pivot,floor,closedAngle:0,openAngle});
  };
  for(const {unit:u,side,openingBit,closed=false} of windowDetails){
   const expectedBit=({back:1,front:2,left:4,right:8})[side];
   if(!u.hasWindow||openingBit!==expectedBit)continue;
   const floorY=u.z*CITY_FLOOR_HEIGHT,centerY=floorY+.96;
   if(side==='front'||side==='back'){
    const sign=side==='front'?1:-1,z=u.y+(sign>0?1:0)+sign*.055,x=u.x+.5;
    box(.05,.88,.14,x-.19,centerY,z+sign*.025,style.trim);box(.05,.88,.14,x+.19,centerY,z+sign*.025,style.trim);
    box(.42,.07,.15,x,floorY+1.46,z+sign*.02,style.trim);box(.42,.07,.15,x,floorY+.46,z+sign*.02,style.trim);
    for(const shutterSide of [-1,1])addShutter(x+shutterSide*.18,centerY,z+sign*.04,frontShutterGeometry,frontSlatGeometry,shutterSide,sign,'front',closed,u.z);
    // A shallow tiled hood and small iron brackets shade the opening.
    const hoodDepth=colonialForm==='rural'?.34:.27,hoodWidth=dutch?.46:colonialForm==='barroco'?.5:.46;
    box(hoodWidth,.06,hoodDepth,x,floorY+1.55,z+sign*hoodDepth*.5,roofColor);
    for(const bracketSide of [-1,1])box(.045,colonialForm==='rural'?.2:.14,hoodDepth*.6,x+bracketSide*hoodWidth*.38,floorY+1.46,z+sign*hoodDepth*.55,metal);
    if(colonialForm==='barroco')for(const direction of [-1,1]){const hood=box(.22,.045,.08,x+direction*.13,floorY+1.62,z+sign*.1,style.trim);hood.rotation.z=-direction*.42;}
    if(colonialForm==='pombalino')box(.58,.04,.11,x,floorY+1.63,z+sign*.07,style.accent);
    if(colonialForm==='quinta')cylinder(.075,.035,x,floorY+1.61,z+sign*.09,style.accent);
   }else{
    const sign=side==='right'?1:-1,x=u.x+(sign>0?1:0)+sign*.055,z=u.y+.5;
    box(.14,.88,.05,x+sign*.025,centerY,z-.19,style.trim);box(.14,.88,.05,x+sign*.025,centerY,z+.19,style.trim);
    box(.14,.07,.42,x+sign*.02,floorY+1.46,z,style.trim);box(.14,.07,.42,x+sign*.02,floorY+.46,z,style.trim);
    for(const shutterSide of [-1,1])addShutter(x+sign*.04,centerY,z+shutterSide*.18,sideShutterGeometry,sideSlatGeometry,shutterSide,sign,'side',closed,u.z);
    const hoodDepth=dutch?.27:colonialForm==='rural'?.34:.27,hoodWidth=dutch?.46:colonialForm==='barroco'?.5:.46;
    box(hoodDepth,.06,hoodWidth,x+sign*hoodDepth*.5,floorY+1.55,z,roofColor);
    for(const bracketSide of [-1,1])box(hoodDepth*.6,colonialForm==='rural'?.2:.14,.045,x+sign*hoodDepth*.55,floorY+1.46,z+bracketSide*hoodWidth*.38,metal);
    if(colonialForm==='barroco')for(const direction of [-1,1]){const hood=box(.08,.045,.22,x+sign*.1,floorY+1.62,z+direction*.13,style.trim);hood.rotation.z=-direction*.42;}
    if(colonialForm==='pombalino')box(.11,.04,.58,x+sign*.07,floorY+1.63,z,style.accent);
    if(colonialForm==='quinta')cylinder(.075,.035,x+sign*.09,floorY+1.61,z,style.accent);
   }
   if(u.z===0&&(u.x+u.y)%2===0){
    if(side==='front'||side==='back'){
     const sign=side==='front'?1:-1,z=u.y+(sign>0?1:0)+sign*.16,x=u.x+.5;
     box(.42,.035,.04,x,.51,z,metal);box(.42,.035,.04,x,.75,z,metal);
     for(let rail=0;rail<4;rail++)box(.03,.25,.04,x-.16+rail*.105,.63,z,metal);
    }else{
     const sign=side==='right'?1:-1,x=u.x+(sign>0?1:0)+sign*.16,z=u.y+.5;
     box(.04,.035,.42,x,.51,z,metal);box(.04,.035,.42,x,.75,z,metal);
     for(let rail=0;rail<4;rail++)box(.04,.25,.03,x,.63,z-.16+rail*.105,metal);
    }
   }
  }
  if(dutch){
   const gableZ=front+.13,baseY=roof+.17;
   if(style.dutchForm==='stepped'){
    for(let tier=0;tier<4;tier++)for(const side of [-1,1]){
     const x=b.width/2+side*Math.max(.12,b.width*.4-tier*.12),y=baseY+tier*.15;
     box(.22,.11,.13,x,y,gableZ,tier%2?style.trim:style.accent);
     box(.28,.065,.14,x-side*.12,y-.06,gableZ,style.trim);
    }
    box(.24,.14,.14,b.width/2,baseY+.6,gableZ,style.trim);
   }else if(style.dutchForm==='neck'){
    box(b.width*.58,.12,.13,b.width/2,baseY,gableZ,style.trim);
    box(b.width*.38,.14,.13,b.width/2,baseY+.13,gableZ,style.accent);
    box(b.width*.2,.22,.14,b.width/2,baseY+.31,gableZ,style.trim);
    box(.28,.1,.15,b.width/2,baseY+.53,gableZ,style.accent);
   }else if(style.dutchForm==='curved'){
    for(let tier=0;tier<4;tier++){
     const width=b.width*(.82-tier*.16),y=baseY+tier*.13;
     box(width,.075,.13,b.width/2,y,gableZ,tier%2?style.trim:style.accent);
    }
    for(const side of [-1,1])cylinder(.07,.12,b.width/2+side*.13,baseY+.47,gableZ,style.trim);
   }else if(style.dutchForm==='straight'){
    box(b.width*.86,.12,.14,b.width/2,baseY,gableZ,style.trim);
    for(const x of [.2,b.width-.2])box(.11,.2,.15,x,baseY+.12,gableZ,style.accent);
   }else if(style.dutchForm==='gallery'){
    const porch=Math.min(.58,b.depth*.18),porchZ=front+porch*.58;
    box(b.width+.08,.1,porch,b.width/2,1.68,front+porch*.42,style.roof);
    for(const x of [.24,b.width-.24]){box(.1,1.58,.1,x,.8,porchZ,style.trim);box(.17,.09,.17,x,1.62,porchZ,style.accent);}
    box(Math.max(.4,b.width-.42),.055,.06,b.width/2,.72,porchZ+.08,style.accent);
   }
  }else if(colonialForm==='azulejo'){
   box(b.width,.22,.045,b.width/2,.2,front+.025,style.accent);
   for(let i=0;i<Math.floor(b.width/.22);i++)box(.1,.12,.055,.12+i*.22,.2,front+.06,i%2?style.trim:style.accent);
  }else if(colonialForm==='acores'){
   for(const x of [.12,b.width-.12])for(let row=0;row<Math.ceil(roof/.42);row++)box(.19,.2,.16,x,.24+row*.42,front+.08,row%2?style.trim:style.accent);
  }else if(colonialForm==='mercantil'){
   box(b.width*.82,.16,.09,b.width/2,1.72,front+.12,style.accent);
   for(const x of [.18,b.width-.18])box(.09,.62,.12,x,1.29,front+.13,style.trim);
  }else if(colonialForm==='terrea'){
   box(b.width+.06,.08,.18,b.width/2,1.72,front+.08,style.accent);
  }
  // Colonial cornices are continuous around the whole footprint, at every
  // storey and along the roofline. Each profile is built as four overlapping
  // runs so the corners stay joined instead of disappearing on side walls.
  const corniceTiers=dutch?
   [{rise:0,height:.055,projection:.09,color:style.trim},{rise:.055,height:.04,projection:.13,color:style.accent}]:
   colonialForm==='barroco'?
   [{rise:0,height:.065,projection:.1,color:style.trim},{rise:.065,height:.045,projection:.15,color:style.accent},{rise:.11,height:.055,projection:.12,color:style.trim}]:
   colonialForm==='rural'?
   [{rise:0,height:.07,projection:.12,color:style.trim},{rise:.07,height:.035,projection:.1,color:style.accent}]:
   colonialForm==='pombalino'?
   [{rise:0,height:.05,projection:.08,color:style.trim},{rise:.05,height:.04,projection:.12,color:style.trim}]:
   colonialForm==='quinta'?
   [{rise:0,height:.055,projection:.11,color:style.accent},{rise:.055,height:.055,projection:.16,color:style.trim}]:
   [{rise:0,height:.055,projection:.1,color:style.trim},{rise:.055,height:.04,projection:.14,color:style.trim}];
  const addCornice=y=>{
   for(const tier of corniceTiers){
    const depth=.14+tier.projection,centerOffset=(tier.projection-.14)/2,cy=y+tier.rise+tier.height/2;
    box(b.width+tier.projection*2,tier.height,depth,b.width/2,cy,b.depth+centerOffset,tier.color);
    box(b.width+tier.projection*2,tier.height,depth,b.width/2,cy,-centerOffset,tier.color);
    box(depth,tier.height,b.depth+tier.projection*2, -centerOffset,cy,b.depth/2,tier.color);
    box(depth,tier.height,b.depth+tier.projection*2, b.width+centerOffset,cy,b.depth/2,tier.color);
   }
  };
  for(let floor=1;floor<b.floors;floor++)addCornice(floor*CITY_FLOOR_HEIGHT+.02);
  addCornice(roof-.2);
  box(b.width+.12,.18,.2,b.width/2,.09,front+.04,style.accent);
  for(const x of [.09,b.width-.09])box(.15,roof,.14,x,roof/2,front+.045,style.trim);
  if(colonialForm==='pombalino'){
   for(const x of [.18,b.width-.18])box(.1,roof,.12,x,roof/2,front+.11,style.accent);
   box(b.width+.08,.2,.16,b.width/2,roof+.16,front+.04,style.trim);
   for(let i=0;i<=Math.floor(b.width/.32);i++){const x=.18+i*(b.width-.36)/Math.max(1,Math.floor(b.width/.32));box(.07,.22,.07,x,roof+.28,front+.05,style.trim);}
  }else if(colonialForm==='barroco'){
   const pediment=new THREE.Mesh(new THREE.ConeGeometry(Math.max(.38,b.width*.25),.44,3),mat(style.accent));pediment.position.set(b.width/2,roof+.35,front+.08);root.add(pediment);
   box(Math.min(1.5,b.width*.7),.08,.12,b.width/2,roof+.13,front+.08,style.trim);
  }else if(colonialForm==='quinta'){
   box(Math.min(1.6,b.width*.72),.09,.14,b.width/2,roof+.16,front+.07,style.accent);
   for(const x of [.28,b.width-.28])box(.16,.3,.16,x,roof+.29,front+.08,style.trim);
  }
  // Door plaques and entrance canopies require a real ground-floor doorway.
  const entryUnit=entryDoorDetails?.unit,entrySide=entryDoorDetails?.side,validEntry=!!entryUnit&&!!entrySide;
  if(validEntry){
   const entryAlongLength=entrySide==='front'||entrySide==='back'?b.width:b.depth,doorAlong=entrySide==='front'||entrySide==='back'?entryUnit.x+.5:entryUnit.y+.5,plaqueAlong=Math.max(.2,Math.min(entryAlongLength-.2,doorAlong+(doorAlong<entryAlongLength/2?.42:-.42))),entryNormal=entrySide==='front'?1:entrySide==='back'?-1:entrySide==='left'?-1:1;
   if(!dutch){
    if(entrySide==='front'||entrySide==='back')box(.28,.36,.07,plaqueAlong,.28,(entrySide==='front'?b.depth:0)+entryNormal*.11,0xfff8e8);
    else box(.07,.36,.28,(entrySide==='right'?b.width:0)+entryNormal*.11,.28,plaqueAlong,0xfff8e8);
    for(let row=0;row<3;row++)for(let col=0;col<2;col++){
     const u=plaqueAlong-.075+col*.15,y=.18+row*.1;
     if(entrySide==='front'||entrySide==='back'){const z=(entrySide==='front'?b.depth:0)+entryNormal*.155;box(.04,.035,.085,u,y,z,style.accent);box(.085,.018,.085,u,y+.03,z+entryNormal*.002,style.accent);}
     else{const x=(entrySide==='right'?b.width:0)+entryNormal*.155;box(.085,.035,.04,x,y,u,style.accent);box(.085,.018,.085,x+entryNormal*.002,y+.03,u,style.accent);}
    }
   }
   const wall=entrySide==='front'?b.depth:entrySide==='back'?0:entrySide==='right'?b.width:0,available=Math.max(.4,Math.min(1.45,Math.min(doorAlong,entryAlongLength-doorAlong)*2-.1)),canopyDepth=colonialForm==='rural'?.76:.56,canopyY=1.77;
   if(entrySide==='front'||entrySide==='back'){
    box(available,.09,canopyDepth,doorAlong,canopyY,wall+entryNormal*canopyDepth/2,roofColor);
    for(const side of [-1,1]){const end=doorAlong+side*(available/2-.035);box(.07,.12,canopyDepth+.025,end,canopyY,wall+entryNormal*canopyDepth/2,style.trim);box(.06,.25,.2,doorAlong+side*available*.36,canopyY-.12,wall+entryNormal*canopyDepth*.66,metal);}
    if(colonialForm==='rural')for(const side of [-1,1]){const post=doorAlong+side*(available/2-.06);box(.1,1.68,.1,post,.84,wall+entryNormal*canopyDepth*.82,style.trim);box(.2,.1,.2,post,1.67,wall+entryNormal*canopyDepth*.82,style.accent);}
    if(colonialForm==='quinta')box(available*.72,.08,.1,doorAlong,canopyY+.08,wall+entryNormal*.04,style.trim);
   }else{
    box(canopyDepth,.09,available,wall+entryNormal*canopyDepth/2,canopyY,doorAlong,roofColor);
    for(const side of [-1,1]){const end=doorAlong+side*(available/2-.035);box(canopyDepth+.025,.12,.07,wall+entryNormal*canopyDepth/2,canopyY,end,style.trim);box(.2,.25,.06,wall+entryNormal*canopyDepth*.66,canopyY-.12,doorAlong+side*available*.36,metal);}
    if(colonialForm==='rural')for(const side of [-1,1]){const post=doorAlong+side*(available/2-.06);box(.1,1.68,.1,wall+entryNormal*canopyDepth*.82,.84,post,style.trim);box(.2,.1,.2,wall+entryNormal*canopyDepth*.82,1.67,post,style.accent);}
    if(colonialForm==='quinta')box(.1,.08,available*.72,wall+entryNormal*.04,canopyY+.08,doorAlong,style.trim);
   }
  }
 }
 parent.userData.portugueseWindowShutters=windowShutters;
 mergeStaticMeshes(THREE,root);
}
