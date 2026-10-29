export function furnitureModel(THREE,item){
 const g=new THREE.Group(),wood=0x86603f,metal=0x727d80,cream=0xe2dfcf;
 const box=(w,h,d,x,y,z,color=wood)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
 const cylinder=(r,h,x,y,z,color=metal)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,8),new THREE.MeshLambertMaterial({color}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
 const type=item.type;
 if(type==='chair'||type==='bench'){const w=type==='bench'?.82:.28;box(w,.07,.27,0,.43,0);box(w,.38,.055,0,.65,-.13);for(const x of [-w*.4,w*.4])for(const z of [-.1,.1])box(.045,.4,.045,x,.2,z,metal);if(item.facing)g.rotation.y=Math.atan2(item.facing.x-item.x,item.facing.y-item.y);}
 else if(type==='table'||type==='desk'||type==='counter'||type==='workbench'){const h=type==='counter'?.7:.68;box(.65,.08,.4,0,h,0);for(const x of [-.25,.25])for(const z of [-.13,.13])box(.05,h,.05,x,h/2,z);if(type==='desk')box(.22,.05,.16,.12,h+.08,0,0xd6d1bd);}
 else if(type==='bed'){box(.7,.16,.45,0,.2,0);box(.67,.15,.42,0,.35,0,0xdad4bd);box(.2,.07,.35,-.22,.46,0,cream);box(.04,.54,.46,-.36,.27,0);}
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
 return g;
}
