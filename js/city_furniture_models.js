export function furnitureModel(THREE,item){
 const g=new THREE.Group(),wood=0x86603f,metal=0x727d80,cream=0xe2dfcf;
 const box=(w,h,d,x,y,z,color=wood)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
 const cylinder=(r,h,x,y,z,color=metal)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,8),new THREE.MeshLambertMaterial({color}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
 const type=item.type;
 if(type==='beach_chair'){
  const fabrics=[[0xc95548,0xf0dfbd],[0x347d91,0xe9d6ae],[0x71894c,0xf1d49b],[0x765b91,0xe9d8c0],[0xd18b3e,0xf3e3bd],[0x397264,0xd6c8a7],[0xb84d68,0xf0d9c8],[0x476c9a,0xe3d5b9]],fabric=fabrics[Math.abs(item.variant||0)%fabrics.length],frame=[0x8a6444,0x6b7775,0x9b7751,0x515e61][Math.abs(item.variant||0)%4],pattern=Math.abs(item.variant||0)%4;
  box(.44,.035,.29,0,.3,.035,0xe9dfc7);
  const back=box(.44,.39,.035,0,.56,-.12,0xe9dfc7);back.rotation.x=-.3;
  for(let i=0;i<5;i++){const x=(i-2)*.086,color=pattern===1?(i%2?fabric[0]:fabric[1]):pattern===2?(i<2?fabric[0]:fabric[1]):pattern===3?(i===2?fabric[1]:fabric[0]):(i%2?fabric[1]:fabric[0]);box(.064,.012,.28,x,.323,.035,color);const backStripe=box(.064,.37,.012,x,.56,-.143,color);backStripe.rotation.x=-.3;}
  for(const x of [-.19,.19]){
   const front=box(.035,.42,.035,x,.21,.12,frame),rear=box(.035,.47,.035,x,.23,-.105,frame);front.rotation.z=x<0?-.08:.08;rear.rotation.x=-.28;
   box(.035,.035,.38,x,.35,.005,frame);
  }
  if(item.umbrellaStyle!=null)addBeachUmbrella(THREE,g,item.umbrellaStyle,-.02,-.46);
 }
 else if(type==='beach_ground'){
  if(item.towel){
   const fabrics=[[0xc95548,0xf0dfbd],[0x347d91,0xe9d6ae],[0x71894c,0xf1d49b],[0x765b91,0xe9d8c0],[0xd18b3e,0xf3e3bd],[0x397264,0xd6c8a7],[0xb84d68,0xf0d9c8],[0x476c9a,0xe3d5b9]],fabric=fabrics[Math.abs(item.variant||0)%fabrics.length],accent=fabric[(item.variant||0)%2?0:1];
   box(.94,.025,1.18,0,.024,0,fabric[1]);box(.84,.018,1.08,0,.046,0,fabric[0]);
   for(let stripe=-2;stripe<=2;stripe++)box(.075,.009,1.02,stripe*.15,.057,0,stripe%2?fabric[1]:accent);
   for(const x of [-.48,.48])for(const z of [-.53,.53])box(.035,.018,.035,x,.039,z,fabric[0]);
   if((item.variant||0)%3===0){
    const bag=[0x855d3d,0x55717a,0x9d7048,0x6b596f][Math.abs(item.variant||0)%4];
    box(.28,.14,.19,.48,.09,-.37,bag);box(.24,.025,.17,.48,.172,-.37,fabric[1]);
    const handle=box(.16,.1,.018,.48,.21,-.27,bag);handle.rotation.x=.45;
   }
  }
  if(item.umbrellaStyle!=null)addBeachUmbrella(THREE,g,item.umbrellaStyle,0,-.12);
 }
 else if(type==='chair'||type==='meeting_chair'||type==='council_chair'||type==='bench'){
  const bench=type==='bench',w=bench?.78:.28,seatY=bench?.24:.30,legH=seatY-.025;
  if(bench&&Number.isInteger(item.colonialStyle)){
   const style=item.colonialStyle,seatColor=style===0?0x586c61:style===1?0x815538:style===2?0x714c37:0xc5b99f,frameColor=style===0?0x30383a:style===1?0xddd0b4:style===2?0x37423d:0x96866d;
   for(let slat=0;slat<4;slat++)box(w,.045,.052,0,seatY,(slat-1.5)*.066,seatColor);
   for(const x of [-.31,.31]){
    if(style===1||style===3){box(.12,.24,.3,x,.12,0,frameColor);box(.15,.05,.33,x,.265,0,seatColor);}
    else{for(const z of [-.11,.11])box(.055,.24,.055,x,.12,z,frameColor);box(.055,.06,.28,x,.22,0,frameColor);}
    box(.055,.62,.055,x,.48,-.145,frameColor);
   }
   for(let slat=0;slat<3;slat++)box(w,.07,.045,0,.39+slat*.12,-.145,seatColor);
   if(style===0||style===2)for(const x of [-.36,.36])box(.05,.055,.28,x,.43,-.005,frameColor);
   if(style===1)for(const x of [-.31,.31])box(.11,.09,.09,x,.77,-.145,seatColor);
  }else{
   box(w,.055,.27,0,seatY,0);
   box(w,bench?.28:.30,.045,0,seatY+(bench?.15:.17),-.115);
   for(const x of [-w*.4,w*.4])for(const z of [-.1,.1])box(.04,legH,.04,x,legH/2,z,metal);
  }
  if(item.facing)g.rotation.y=Math.atan2(item.facing.x-item.x,item.facing.y-item.y);
 }
 else if(type==='table'||type==='desk'||type==='counter'||type==='workbench'){const h=type==='counter'?.7:.68;box(.65,.08,.4,0,h,0);for(const x of [-.25,.25])for(const z of [-.13,.13])box(.05,h,.05,x,h/2,z);if(type==='desk')box(.22,.05,.16,.12,h+.08,0,0xd6d1bd);}
 else if(type==='bed'){box(.7,.16,.45,0,.2,0);box(.67,.15,.42,0,.35,0,0xdad4bd);box(.2,.07,.35,-.22,.46,0,cream);box(.04,item.bunk?1:.54,.46,-.36,item.bunk?.5:.27,0);if(item.bunk){box(.7,.12,.45,0,.68,0);box(.67,.12,.42,0,.79,0,0xdad4bd);box(.2,.055,.35,-.22,.9,0,cream);for(const x of [-.31,.31])box(.035,.9,.035,x,.49,0);}}
 else if(type==='cot'||type==='exam_bed'||type==='gurney'){box(.68,.1,.38,0,.42,0,metal);box(.66,.08,.36,0,.51,0,cream);for(const x of [-.27,.27])for(const z of [-.13,.13]){box(.035,.4,.035,x,.2,z,metal);if(type==='gurney')cylinder(.045,.035,x,.05,z,metal);}if(type==='exam_bed')box(.08,.08,.28,-.26,.58,0,cream);}
 else if(type==='crib'){box(.6,.08,.4,0,.24,0,wood);for(const x of [-.3,.3])for(const z of [-.2,.2])box(.035,.46,.035,x,.48,z);for(let x=-.24;x<=.25;x+=.12)box(.025,.38,.025,x,.48,.2,wood);}
 else if(type==='shower'){box(.36,.04,.36,0,.04,0,0x99b9c1);for(const x of [-.18,.18])for(const z of [-.18,.18])box(.025,.8,.025,x,.4,z,metal);box(.36,.035,.36,0,.8,0,0xa8c6cc);cylinder(.045,.05,.1,.65,.1,metal);}
 else if(type==='sofa'){box(.62,.16,.32,0,.25,0,0x657a6d);box(.62,.28,.07,0,.43,-.13,0x53695d);for(const x of [-.3,.3])box(.07,.25,.32,x,.34,0,0x596f63);for(const x of [-.23,.23])box(.035,.2,.035,x,.1,-.1,metal);}
 else if(type==='ballot_booth'){for(const x of [-.2,.2])box(.035,.75,.035,x,.37,0,wood);box(.45,.05,.4,0,.74,0,wood);box(.3,.04,.24,0,.66,.02,0x887d67);}
 else if(type==='evidence_board'){box(.55,.55,.035,0,.95,-.04,0xd5c7a3);for(const [x,y]of [[-.17,.08],[.14,.04],[0,-.12]]){const pin=cylinder(.018,.025,x,.95+y,0,0xa04c44);pin.rotation.x=Math.PI/2;}}
 else if(['filing_cabinet','cabinet','pantry'].includes(type)){box(.28,.72,.3,0,.36,0,type==='pantry'?wood:metal);for(const y of [.2,.4,.6])box(.23,.025,.26,0,y,0,cream);}
 else if(['shelf','bookshelf'].includes(type)){for(const x of [-.24,.24])box(.035,.9,.035,x,.45,0,metal);for(const y of [.18,.44,.7])box(.55,.035,.28,0,y,0,wood);if(type==='bookshelf')for(let i=0;i<5;i++)box(.07,.22,.08,-.18+i*.09,.55,.02,[0x98764f,0x496884,0x9b5852][i%3]);}
 else if(type==='play_mat'){box(.46,.035,.42,0,.025,0,0x7c9a69);for(const [x,z,color]of [[-.12,0,0xe0c156],[.12,0,0x8b6c96],[0,.12,0x608b98]])cylinder(.045,.03,x,.05,z,color);}
 else if(['broom','cleaning_kit','gardening_kit','equipment_locker'].includes(type)){box(type==='broom'?.05:.28,type==='broom'?.8:.6,.08,0,.35,0,type==='gardening_kit'?0x776242:metal);if(type==='broom')box(.22,.08,.08,0,.05,0,wood);}
 else if(type==='podium'){box(.36,.62,.3,0,.31,0,wood);box(.45,.06,.36,0,.66,0,wood);}
 else if(['service_desk','dispatch_desk','evidence_counter','blueprint_table','loading_dock','paint_station','reservoir','tray_table'].includes(type)){const dims=type==='loading_dock'?[.65,.18,.48]:[.52,.66,.36];box(dims[0],.07,dims[1],0,dims[2]===.18?.55:.66,0,type==='reservoir'?0x6696a0:wood);if(type==='reservoir')cylinder(.22,.48,0,.25,0,0x6696a0);else for(const x of [-dims[0]*.38,dims[0]*.38])box(.045,.62,.25,x,.31,0,metal);}
 else if(type==='fridge'){box(.23,.69,.23,0,.35,0,cream);box(.015,.18,.02,.075,.37,.125,metal);box(.23,.02,.01,0,.48,.125,metal);}
 else if(type==='chest'){box(.26,.28,.23,0,.14,0);box(.29,.05,.25,0,.3,0,0x9b764a);box(.035,.07,.025,0,.21,.13,metal);}
 else if(type==='water_cooler'){box(.18,.46,.18,0,.23,0,cream);cylinder(.07,.2,0,.59,0,0x598faa);box(.1,.02,.08,0,.36,.13,metal);}
 else if(type==='toilet'){box(.24,.27,.3,0,.14,0,cream);box(.24,.24,.1,0,.4,-.12,cream);cylinder(.1,.05,0,.3,.03,cream);}
 else if(type==='sink'){box(.29,.13,.23,0,.58,0,cream);box(.035,.16,.035,0,.7,-.08,metal);}
 else if(['furnace','kiln','stove'].includes(type)){box(.62,.64,.4,0,.32,0,0x676463);box(.28,.24,.025,0,.3,.215,0x632d1b);cylinder(.06,.55,.2,.88,-.1);if(type==='stove')for(const x of [-.16,.16])cylinder(.09,.025,x,.66,0,0x242b2e);}
 else if(['vat','composter','tap'].includes(type)){cylinder(.26,.48,0,.26,0,type==='composter'?0x675333:0x8b9d8d);cylinder(.22,.04,0,.51,0,type==='composter'?0x493820:0xb3bba7);box(.04,.46,.04,.3,.25,0,metal);box(.12,.04,.04,.25,.49,0,metal);}
 else if(type==='rack'||type==='coop'){for(const x of [-.3,.3])box(.04,.95,.04,x,.48,0);for(const h of [.2,.52,.84])box(.64,.04,.28,0,h,0);if(type==='rack')for(const x of [-.18,0,.18])box(.12,.25,.07,x,.66,0,0x6f849e);else for(const x of [-.17,.17])box(.2,.12,.22,x,.28,0,0xb39858);}
 else if(type==='washer'){box(.44,.58,.4,0,.29,0,cream);const drum=cylinder(.15,.025,0,.29,.215,0x426374);drum.rotation.x=Math.PI/2;box(.2,.04,.03,0,.53,.215,metal);}
 else if(type==='sewing'){box(.59,.06,.32,0,.67,0);box(.045,.65,.045,-.23,.33,0);box(.045,.65,.045,.23,.33,0);box(.26,.04,.16,0,.72,0,metal);box(.06,.18,.08,-.1,.82,0,0x3f4b4c);box(.27,.07,.08,.01,.93,0,0x3f4b4c);}
 else if(type==='loom'){for(const x of [-.28,.28])box(.055,1,.055,x,.5,0);box(.6,.05,.05,0,1,0);for(let x=-.23;x<.25;x+=.06)box(.012,.67,.015,x,.58,0,0xcab995);box(.5,.04,.12,0,.32,.07);}
 else if(type==='saw'||type==='wheel'||type==='mill'){box(.58,.09,.4,0,.63,0);for(const x of [-.24,.24])box(.06,.59,.25,x,.3,0,metal);const wheel=cylinder(.18,.035,0,.78,0,type==='saw'?0xa9b2b0:0x8c795f);if(type!=='wheel')wheel.rotation.x=Math.PI/2;box(.44,.055,.12,.1,.71,.12,0xb19a69);}
 else if(type==='press'||type==='drill'){box(.55,.1,.42,0,.08,0,metal);for(const x of [-.22,.22])box(.07,.85,.07,x,.5,0,0x72735f);box(.53,.12,.22,0,.98,0,metal);cylinder(.045,.44,0,.69,0);box(.27,.07,.22,0,.44,0,metal);}
 else if(type==='rollers'||type==='lathe'){box(.62,.4,.32,0,.2,0,metal);for(const x of [-.2,.2]){const r=cylinder(.13,.3,x,.55,0,0x9ca9a6);r.rotation.z=Math.PI/2;}box(.06,.16,.06,0,.72,0,0x394e43);}
 else if(type==='welding'||type==='assembly'){box(.65,.1,.4,0,.63,0,metal);for(const x of [-.26,.26])box(.05,.6,.26,x,.3,0);box(.36,.05,.05,0,.82,0,0x4b7782);box(.04,.27,.04,-.18,.76,0,metal);}
 else if(type==='sieve'){box(.63,.12,.4,0,.53,0,metal);for(let x=-.25;x<=.25;x+=.1)box(.02,.03,.38,x,.61,0,0x303b39);box(.06,.5,.06,-.25,.25,0);box(.06,.5,.06,.25,.25,0);}
 else if(type==='lab'||type==='pump'){box(.6,.08,.32,0,.67,0,cream);for(const x of [-.24,.24])box(.05,.65,.05,x,.33,0,metal);for(const x of [-.15,.1])cylinder(.045,.18,x,.8,0,0x5a8e83);}
 else {box(.6,.08,.36,0,.65,0);box(.05,.63,.26,-.23,.32,0);box(.05,.63,.26,.23,.32,0);}
 if(item.visualScale)g.scale.setScalar(item.visualScale);
 return g;
}

function addBeachUmbrella(THREE,group,style,x,z){
 const palettes=[[0xc95146,0xf0dfc3],[0x347a8a,0xf3dfb4],[0x66844b,0xe7d49e],[0x755890,0xeee0c9],[0xd18b43,0xf3e3bd],[0x397264,0xd6c8a7],[0xb84d68,0xf0d9c8],[0x476c9a,0xe3d5b9]],colors=palettes[Math.abs(style)%palettes.length],make=(geometry,color,px,py,pz)=>{const m=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({color}));m.position.set(px,py,pz);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
 make(new THREE.CylinderGeometry(.025,.032,1.75,7),0x74614c,x,.88,z);
 make(new THREE.CylinderGeometry(.11,.1,.045,8),0x776a58,x,.035,z);
 const canopyY=1.78,segments=8;
 for(let i=0;i<segments;i++){
  const start=i*Math.PI*2/segments,geometry=new THREE.ConeGeometry(.68,.2,1,1,false,start,Math.PI*2/segments),panel=make(geometry,i%2?colors[1]:colors[0],x,canopyY,z);
 }
 make(new THREE.SphereGeometry(.055,6,4),0xd9c89e,x,canopyY+.105,z);
 for(let i=0;i<4;i++){const angle=i*Math.PI/2,spoke=make(new THREE.BoxGeometry(.55,.018,.022),0x706654,x,canopyY-.075,z);spoke.rotation.y=angle;}
}
