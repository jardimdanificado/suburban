import {BOTANICAL_TREE_MODELS,botanicalMeshBuilder,createBotanicalTreeGeometry} from './botanical_trees.js?v=species-colors-3';
import {createTravellerPalmGeometry} from './traveller_palm.js?v=ravenala-colors-3';
import {foliageColor,vegetationColor} from './vegetation_color.js';
import {NATURAL_PLANTS} from './plant_catalog.js';
import {FARM_CROPS} from './farm_crop_catalog.js';
const TAU=Math.PI*2;
const grain=new Set(['arroz','trigo','cevada','milho','cana']);
const mushrooms=new Set(['cubensis','amanita']);
/** Authored crop silhouettes, one shared mesh per species and GPU instances. */
export function farmPlantSurface(good){
 if(!FARM_CROPS[good])return null;
 let seed=7;for(const c of good)seed=(Math.imul(seed,31)+c.charCodeAt(0))>>>0;
 const species=FARM_CROPS[good].plantSpecies,natural=NATURAL_PLANTS[species];
 const b=botanicalMeshBuilder(seed),leaf=foliageColor(0x35872b),light=foliageColor(0x74ab35),stem=foliageColor(0x598735),gold=vegetationColor(0xd8ae46);
 const point=(r,h,a)=>[Math.cos(a)*r,h,Math.sin(a)*r];
 const leaves=(h,count,width,length)=>{for(let i=0;i<count;i++){const a=i*2.399,h0=h*(.2+.65*i/count),p=point(.02,h0,a),q=point(length,h0+.06,a);b.tube([0,h0,0],p,.009,.005,stem);b.blade(p,q,width,i%2?leaf:light,{shape:'lance',segments:4,fold:.25});}};
 if(species==='water_lily'){
  for(let i=0;i<3;i++){const a=i*2.4,p=point(i*.12,.04,a);b.ellipsoid(p,[.23,.012,.23],leaf,0,14,2);for(let j=0;j<12;j++){const angle=j*TAU/12;b.blade([p[0],.05,p[2]],[p[0]+Math.cos(angle)*.18,.07,p[2]+Math.sin(angle)*.18],.008,light,{segments:2});}}b.flower([0,.09,0],.09,vegetationColor(0xf4bdd9));
 }else if(species==='coconut_palm'){
  b.tube([0,0,0],[.04,.6,0],.045,.03,vegetationColor(0x7a512b),8);
  for(let i=0;i<9;i++){const a=i*2.4,end=point(.42,.57,a);b.tube([.04,.6,0],end,.01,.002,stem);for(let j=1;j<9;j++){const t=j/9,p=[.04+(end[0]-.04)*t,.6+(end[1]-.6)*t+.13*Math.sin(t*Math.PI),end[2]*t];for(const side of [-1,1])b.blade(p,[p[0]+Math.cos(a+side*1.25)*.17*(1-t*.5),p[1]-.08,p[2]+Math.sin(a+side*1.25)*.17*(1-t*.5)],.016,leaf,{shape:'lance',segments:3});}}
  for(let i=0;i<4;i++)b.ellipsoid(point(.05,.55,i*2.4),[.035,.05,.035],vegetationColor(0x72912d),2,6,3);
 }else if(natural&&['foliage','flowering'].includes(natural.form||'flowering')){
  const flowering=natural.form!=='foliage',height=.35+(seed%7)*.045,count=flowering?9:15;
  for(let i=0;i<count;i++){const a=i*2.4,p=point(.09+(i%3)*.06,height*(.45+(i%5)*.11),a);b.tube([0,0,0],p,.008,.004,stem);b.blade([p[0]*.35,p[1]*.6,p[2]*.35],[p[0]*1.3,p[1]+.07,p[2]*1.3],.035+(seed%5)*.01,i%3?leaf:light,{shape:seed%2?'lance':'oval',fold:.3,segments:4});if(flowering&&i%2===0)b.flower(p,.035+(i%3)*.008,vegetationColor([0xe53543,0xf0be28,0xc447c4,0xf28629,0xf5e8c0][seed%5]));}
 }else if(mushrooms.has(good)){
  for(let i=0;i<4;i++){const a=i*2.4,h=.16+i*.045,p=point(i*.045,0,a),top=[p[0],h,p[2]],color=vegetationColor(good==='amanita'?0xc53924:0xa57c42);b.tube(p,top,.023,.018,vegetationColor(0xdccca6),7);b.ellipsoid(top,[h*.46,h*.18,h*.46],color,0,10,4);b.ellipsoid([p[0],h-.012,p[2]],[h*.43,.009,h*.43],vegetationColor(0xc4ac86),0,10,2);
   if(good==='amanita')for(let j=0;j<9;j++){const angle=j*2.4,r=h*.31*Math.sqrt((j+1)/10);b.ellipsoid([p[0]+Math.cos(angle)*r,h+h*.15,p[2]+Math.sin(angle)*r],[.009,.006,.009],vegetationColor(0xf2e8ce),0,5,2);}
  }
 }else if(good==='peyote'||good==='agave'){
  if(good==='peyote'){for(let i=0;i<9;i++)b.ellipsoid(point(.065,.07,i*TAU/9),[.045,.08,.045],foliageColor(0x43865c),0,6,3);b.flower([0,.15,0],.028,vegetationColor(0xf19bb7));}
  else for(let i=0;i<26;i++){const a=i*2.4;b.blade([0,.02,0],point(.25+(.12*(i%3)),.12+(i%5)*.09,a),.035,leaf,{shape:'lance',fold:.4,segments:4});}
 }else if(grain.has(good)){
  const corn=good==='milho',cane=good==='cana',height=corn?1.05:cane?1.2:.7;
  for(let k=0;k<(corn||cane?2:5);k++){
   const a=k*2.4,p=point(k*.035,0,a),h=height*(.85+b.random()*.2);b.tube(p,[p[0],h,p[2]],.012,.006,stem,5);
   for(let i=0;i<5;i++){const angle=i*2.4+k,y=h*(.15+i*.14);b.blade([p[0],y,p[2]],[p[0]+Math.cos(angle)*(corn?.38:.2),y+.1,p[2]+Math.sin(angle)*(corn?.38:.2)],corn?.04:.012,leaf,{shape:'lance',segments:4});}
   if(corn)b.ellipsoid([p[0]+.07,h*.62,p[2]],[.045,.13,.045],gold,2,7,4);
   else if(!cane)for(let i=0;i<8;i++){const angle=i*2.4,tip=[p[0]+Math.cos(angle)*.025,h+i*.012,p[2]+Math.sin(angle)*.025];b.ellipsoid(tip,[.012,.025,.012],gold,2,5,2);b.tube(tip,[tip[0]+Math.cos(angle)*.035,tip[1]+.07,tip[2]+Math.sin(angle)*.035],.0015,0,gold,3);}
  }
 }else if(good==='alface'||good==='cebola'){
  for(let i=0;i<22;i++){const a=i*2.399,r=.13+.05*(i%3),h=.06+.025*(i%5);b.blade([0,.015,0],point(r,h,a),good==='alface'?.085:.009,i%3?leaf:light,{shape:'oval',segments:4,fold:.45});}
  if(good==='cebola')b.ellipsoid([0,.025,0],[.07,.06,.07],vegetationColor(0xc9a06a),2,8,4);
 }else if(good==='girassol'){
  b.tube([0,0,0],[.025,.85,0],.023,.012,stem);leaves(.7,7,.07,.23);
  for(let i=0;i<18;i++){const a=i*TAU/18;b.blade([.025,.85,0],[.025+Math.cos(a)*.16,.85+Math.sin(a)*.16,.015],.035,vegetationColor(0xf5c42b),{part:2,segments:3});}
  b.ellipsoid([.025,.85,.022],[.075,.075,.025],vegetationColor(0x583b1d),2,10,4);
 }else{
  const cannabis=good==='flor_cannabis',cassava=good==='mandioca',trumpet=good==='trombeta_anjo',height=trumpet?.9:good==='folha_tabaco'?.75:good==='coentro'?.32:good==='lupulo'?.85:good==='uva'?.5:good==='folha_coca'?.72:good==='grao_cafe'?.68:.6;
  b.tube([0,0,0],[.02,height,0],.023,.006,stem);
  if(cannabis||cassava){for(let i=0;i<9;i++){const a=i*2.4,p=point(.07,.12+i*.045,a);b.tube([0,p[1]-.03,0],p,.009,.005,stem);for(let j=-3;j<=3;j++){const angle=a+j*.3;b.blade(p,[p[0]+Math.cos(angle)*(.23-Math.abs(j)*.035),p[1]+.12,p[2]+Math.sin(angle)*(.23-Math.abs(j)*.035)],cannabis?.016:.025,leaf,{shape:cannabis?'lobed':'lance',segments:5});}}}
  else leaves(height,good==='coentro'?23:12,good==='folha_tabaco'?.075:.04,good==='folha_tabaco'?.28:.19);
  if(trumpet){for(let i=0;i<5;i++){const a=i*2.4,p=point(.15,.45+i*.07,a),q=[p[0],p[1]-.22,p[2]];b.tube([0,p[1]+.06,0],p,.007,.004,stem);b.tube(p,q,.012,.065,vegetationColor(0xf2d7a0),8);b.flower(q,.075,vegetationColor(0xf8deb1));}}
  else if(['tomate','maca','goiaba','grao_cafe','uva','lupulo','feijao'].includes(good)){for(let i=0;i<12;i++){const a=i*2.4,p=point(.12,.2+(i%5)*.06,a),pod=good==='feijao',color=vegetationColor(good==='tomate'||good==='maca'?0xd43822:good==='uva'?0x673286:good==='grao_cafe'?0xb32921:0x94b53a);b.ellipsoid(p,[pod?.014:.03,pod?.08:.035,.025],color,2,6,3);}}
 }
 return {positions:b.positions,colors:b.colors,uvs:b.uvs,flex:b.flex,parts:b.parts,woodMask:b.woodMask};
}
export function createFarmPlantGeometry(THREE,good){
 const spec=FARM_CROPS[good];if(!spec)return null;
 const species=spec.plantSpecies;
 let geometry=good==='maca'?createBotanicalTreeGeometry(THREE,'apple',{...BOTANICAL_TREE_MODELS.guava,height:2.5,radius:.95,leaf:0x397a2d,fruit:[0xc72d22,.095,.11,.095]}):species==='traveller_palm'?createTravellerPalmGeometry(THREE):species?createBotanicalTreeGeometry(THREE,species):null;
 if(geometry){geometry.computeBoundingBox();const height=geometry.boundingBox.max.y-geometry.boundingBox.min.y;geometry.scale(1.6/Math.max(height,.1),1.6/Math.max(height,.1),1.6/Math.max(height,.1));for(const name of ['treeFlex','treePart','treeWood'])if(!geometry.getAttribute(name))geometry.setAttribute(name,new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count),1));return geometry;}
 const surface=farmPlantSurface(good),g=new THREE.BufferGeometry();
 for(const [name,data,size]of [['position',surface.positions,3],['color',surface.colors,3],['uv',surface.uvs,2],['treeFlex',surface.flex,1],['treePart',surface.parts,1],['treeWood',surface.woodMask,1]])g.setAttribute(name,new THREE.Float32BufferAttribute(data,size));
 g.computeVertexNormals();g.computeBoundingSphere();return g;
}
