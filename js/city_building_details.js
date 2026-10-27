import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js';

// Small architectural details are part of the model, not floating labels.
const THEMES={
 bakery:'bread',kitchen:'pot',popular_refectory:'pot',flour_mill:'silo',pasta_factory:'pasta',cannery:'jars',cheesemaker:'cheese',dairy_farm:'milk',poultry:'eggs',
 builder:'crane',carrier:'cargo',waste_collector:'bins',cleaner:'brush',recycler:'recycling',composting:'compost',
 sawmill:'logs',forestry:'logs',charcoal:'kiln',iron_mine:'ore',bauxite_mine:'ore',foundry:'furnace',steel_mill:'furnace',aluminum_smelter:'furnace',clay_pit:'clay',sand_pit:'sand',brickworks:'bricks',glassworks:'glass',
 toolmaker:'tools',artisan:'basket',furniture:'chair',pottery:'pottery',paper_mill:'paper',publisher:'books',newsroom:'newspaper',
 weaving:'fabric',fiber_farm:'fabric',flagmaker:'fabric',tailor:'fabric',clothing_store:'fabric',paintworks:'paint',soapworks:'soap',pharmacy:'medicine',herb_farm:'plant',
 rubber_grove:'rubber',rubberworks:'rubber',bearing_factory:'bearing',frame_factory:'frame',deck_factory:'deck',tire_factory:'wheel',chain_factory:'chain',safety_equipment:'helmet',saddle_factory:'saddle',cycle_parts:'tools',sports_shoes:'boot',skate_workshop:'deck',cycle_assembler:'frame',cycle_shop:'wheel',cycle_workshop:'wheel',bicycle_rental:'wheel',sports_shop:'ball',
 utility:'water',mint:'coins',bank:'bank',townhall:'civic',council_chamber:'civic',research_institute:'research',clinic:'medical',hospital:'medical',library:'books',theater:'theater',sports_center:'ball',leisure:'ball',public_toilet:'water',paid_toilet:'water',
 residential:'home',popular_housing:'housing',luxury_housing:'luxury',market:'market',greengrocer:'plant',mill:'mill',farm:'farm',quarry:'quarry',bike_rack:'wheel',park:'plant'
};
export function addBuildingDetails(THREE,parent,b,{ground=0,outdoor=false}={}){
 const kind=THEMES[b.type];if(!kind)return;
 const root=new THREE.Group(),roof=outdoor?ground:(b.floors||1)*CITY_FLOOR_HEIGHT+.12;
 root.position.set(b.width/2,roof,b.depth/2);parent.add(root);
 const mats=new Map();const mat=c=>{if(!mats.has(c))mats.set(c,new THREE.MeshLambertMaterial({color:c}));return mats.get(c);};
 const box=(w,h,d,x,y,z,c)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,y,z);root.add(m);return m;};
 const cyl=(r1,r2,h,x,y,z,c,segments=8)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),mat(c));m.position.set(x,y,z);root.add(m);return m;};
 const ball=(r,x,y,z,c)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(r,8,6),mat(c));m.position.set(x,y,z);root.add(m);return m;};
 const wheel=(x,y,z,r=.38,c=0x444d4c)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(r,.055,5,12),mat(c));m.position.set(x,y,z);root.add(m);return m;};
 const wood=0x8c603c,metal=0x707f82,cream=0xe8dcc0,green=0x638955;
 switch(kind){
 case'bread':ball(.42,0,.32,0,0xd6a260).scale.set(1.4,.65,.65);for(const x of [-.25,0,.25])box(.04,.03,.35,x,.6,0,cream).rotation.z=.35;break;
 case'pot':cyl(.38,.3,.45,0,.24,0,metal);cyl(.42,.42,.07,0,.49,0,0x414f4d);cyl(.04,.04,.12,0,.59,0,cream);break;
 case'silo':cyl(.34,.34,1.1,0,.55,0,0xbda179);cyl(0,.4,.35,0,1.25,0,0x75665a);break;
 case'pasta':for(const x of [-.25,0,.25])cyl(.06,.06,.8,x,.43,0,0xe6bf6b);break;
 case'jars':for(const x of [-.28,0,.28]){cyl(.12,.12,.4,x,.21,0,0x82a47d);cyl(.13,.13,.05,x,.44,0,0xd3bd86);}break;
 case'cheese':{const m=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,.22,3),mat(0xe8c755));m.position.y=.15;m.rotation.y=.5;root.add(m);break;}
 case'milk':cyl(.23,.23,.55,0,.3,0,cream);cyl(.12,.12,.12,0,.64,0,metal);break;
 case'eggs':for(const x of [-.2,0,.2])ball(.15,x,.18,0,cream).scale.y=1.4;break;
 case'crane':box(.12,1.45,.12,-.4,.72,0,0xd4a33b);box(1.45,.12,.12,.2,1.38,0,0xd4a33b);box(.04,.65,.04,.78,1.03,0,metal);break;
 case'cargo':for(const [x,y] of [[-.28,.2],[.3,.2],[0,.62]])box(.5,.4,.48,x,y,0,wood);break;
 case'bins':for(const x of [-.28,.28]){box(.42,.6,.43,x,.3,0,0x678075);box(.46,.06,.46,x,.63,0,0x404f4d);}break;
 case'brush':box(.12,.9,.12,0,.55,0,wood).rotation.z=-.4;box(.52,.22,.18,.2,.12,0,0xb9a46f);break;
 case'recycling':for(let i=0;i<3;i++){const m=box(.6,.12,.15,0,.5,0,green);m.rotation.z=i*Math.PI*2/3;}break;
 case'compost':box(.9,.25,.75,0,.13,0,wood);for(const x of [-.2,.2])ball(.27,x,.38,0,0x67633f);break;
 case'logs':for(const [x,y] of [[-.24,.17],[.24,.17],[0,.48]]){const m=cyl(.17,.17,.9,x,y,0,wood,7);m.rotation.x=Math.PI/2;}break;
 case'kiln':cyl(.45,.5,.6,0,.3,0,0x5c5650);cyl(.09,.09,.35,0,.77,0,metal);break;
 case'ore':case'clay':case'sand':for(const [x,r] of [[-.25,.28],[.18,.36],[.4,.2]])ball(r,x,r*.65,0,kind==='ore'?(b.type==='bauxite_mine'?0xb87652:0x7f8585):kind==='clay'?0xa7684c:0xd2bb83).scale.y=.7;break;
 case'furnace':box(.75,.8,.7,0,.4,0,b.type==='steel_mill'?0x6e5045:b.type==='aluminum_smelter'?0x8b9696:0x67625e);cyl(.13,.18,.9,.2,1.2,0,0x505657);if(b.type==='steel_mill')cyl(.11,.15,.65,-.25,1.1,0,0x505657);box(.27,.25,.03,0,.33,.36,0xe68a3d);break;
 case'bricks':for(const [x,y] of [[-.22,.1],[.22,.1],[0,.32]])box(.4,.2,.25,x,y,0,0xb25e45);break;
 case'glass':for(const x of [-.24,0,.24])box(.12,.7,.45,x,.4,0,0x83b9be);break;
 case'tools':box(.12,.8,.12,0,.45,0,wood).rotation.z=.5;box(.5,.18,.18,-.2,.8,0,metal);break;
 case'basket':cyl(.4,.3,.4,0,.25,0,wood);wheel(0,.55,0,.3,0xb9996b).scale.set(1,.7,1);break;
 case'chair':box(.55,.09,.45,0,.45,0,wood);box(.55,.55,.09,0,.74,-.2,wood);for(const x of [-.21,.21])box(.06,.45,.06,x,.22,.15,wood);break;
 case'pottery':cyl(.25,.34,.46,0,.25,0,0xb97852);cyl(.27,.27,.06,0,.5,0,0x8f5944);break;
 case'paper':for(const x of [-.26,0,.26]){const m=cyl(.14,.14,.7,x,.16,0,cream);m.rotation.x=Math.PI/2;}break;
 case'books':case'newspaper':for(let i=0;i<4;i++)box(.16,.5,.35,(i-1.5)*.19,.28,0,kind==='newspaper'?cream:[0x9a5849,0x4d7381,0xa38753,0x668864][i]);break;
 case'fabric':for(const x of [-.25,0,.25]){const m=cyl(.13,.13,.65,x,.18,0,x===0?0xb65b69:0x7d9bb0);m.rotation.x=Math.PI/2;}if(b.type==='flagmaker'){box(.05,.9,.05,.45,.5,0,wood);box(.45,.3,.04,.68,.75,0,0xc75650);}else if(b.type==='tailor'||b.type==='clothing_store')box(.52,.43,.06,0,.68,0,b.type==='tailor'?0x9b6f82:0x6c8eac);break;
 case'paint':for(const x of [-.25,.25]){cyl(.2,.2,.36,x,.2,0,x<0?0xc35e51:0x537ea4);cyl(.21,.21,.04,x,.4,0,cream);}break;
 case'soap':for(const x of [-.22,.22])box(.36,.2,.26,x,.14,0,0xc7d6b6);break;
 case'medicine':box(.18,.65,.15,0,.38,0,0xc84848);box(.6,.18,.15,0,.38,0,0xc84848);break;
 case'plant':cyl(.24,.3,.32,0,.16,0,0xa26e4a);for(const x of [-.17,0,.17])ball(.2,x,.48,0,green);break;
 case'rubber':case'wheel':wheel(0,.48,0,.38,0x343b3a);if(kind==='wheel'){box(.65,.04,.04,0,.48,0,metal);box(.04,.65,.04,0,.48,0,metal);if(b.type==='cycle_workshop')box(.1,.7,.1,.55,.4,0,metal).rotation.z=.35;if(b.type==='bicycle_rental')wheel(-.65,.48,0,.3,0x343b3a);}break;
 case'bearing':wheel(0,.45,0,.3,metal);wheel(0,.45,0,.13,metal);break;
 case'frame':for(const [x,y,angle] of [[-.24,.42,-.6],[.24,.42,.6],[0,.2,Math.PI/2]]){const m=box(.07,.65,.07,x,y,0,metal);m.rotation.z=angle;}if(b.type==='cycle_assembler'){wheel(-.55,.24,0,.22);wheel(.55,.24,0,.22);}break;
 case'deck':box(1,.12,.35,0,.27,0,wood);for(const x of [-.35,.35])wheel(x,.12,0,.09,0x343b3a);break;
 case'chain':for(const x of [-.3,0,.3])wheel(x,.3,0,.15,metal);break;
 case'helmet':ball(.36,0,.31,0,0xd15c4f).scale.y=.65;box(.72,.08,.52,0,.25,0,0x565d5b);break;
 case'saddle':ball(.34,0,.42,0,0x50413a).scale.set(1,.35,.65);box(.08,.36,.08,0,.2,0,metal);break;
 case'boot':box(.3,.5,.25,0,.3,0,0x555d67);box(.45,.18,.3,.08,.1,.05,0x555d67);break;
 case'ball':ball(.34,0,.35,0,0xe1bd72);break;
 case'water':cyl(.34,.34,.65,0,.38,0,0x6094ac);cyl(.37,.37,.08,0,.73,0,metal);break;
 case'coins':for(let i=0;i<4;i++)cyl(.3,.3,.08,0,.06+i*.09,0,0xd1b459);break;
 case'bank':case'civic':{const m=new THREE.Mesh(new THREE.ConeGeometry(.65,.4,4),mat(0xb5a57e));m.rotation.y=Math.PI/4;m.position.y=.25;root.add(m);break;}
 case'research':wheel(0,.5,0,.28,metal);box(.08,.45,.08,.32,.2,0,metal).rotation.z=.8;break;
 case'medical':box(.18,.65,.15,0,.4,0,0xc84242);box(.65,.18,.15,0,.4,0,0xc84242);break;
 case'theater':for(const x of [-.3,.3])box(.3,.7,.18,x,.4,0,0x963d4e);break;
 case'home':box(.24,.5,.24,-.35,.25,0,0x8c7967);break;
 case'housing':for(const x of [-.35,.35])box(.35,.16,.25,x,.18,0,0x868f80);break;
 case'luxury':cyl(.38,.38,.1,0,.08,0,0xe1c67b);ball(.25,0,.36,0,0x6a9e85);break;
 case'market':box(1,.15,.65,0,.4,0,0xd7a24d);for(const x of [-.4,.4])box(.07,.4,.07,x,.2,0,wood);break;
 case'quarry':for(const x of [-.3,.2])ball(.32,x,.22,0,0x949a96).scale.y=.65;break;
 case'farm':case'mill':break;
 }
}
