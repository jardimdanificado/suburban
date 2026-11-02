import {surfaceElevation} from './city_terrain.js?v=quarry-outskirts-1';
import {mergeStaticMeshes} from './city_static_mesh.js?v=static-batch-3';

const AWNING_COLORS=[0xb64f42,0x3e7778,0xd3a849,0x55734b,0x496b89,0xa45e83,0xb56c42,0x6e6553];
const TYPE_COLORS={market:0xc35d43,greengrocer:0x4f8547,bakery:0xc58b42,restaurant:0x9a5b46,clothing_store:0x6e7b99,sports_shop:0x527e83,thrift_store:0x8b6d8c,pharmacy:0x5e8b82,artisan:0x9a6349,publisher:0x6f6e9b,cycle_shop:0x62766e};
const GOODS_COLORS={pao:[0xc68a42,0xe2ba6d,0x9d6333],frutas:[0xc9503d,0x76a348,0xe1b23e],peixe:[0x8eb5b7,0x547982,0xd8c8a4],roupas:[0xc45f57,0x557b9b,0xd4ad53],livros:[0x775744,0x60738b,0x9a5e54],moveis:[0x9a6d4d,0x73503c,0x546b5d],flores:[0xc95676,0xe1b846,0x668d52],default:[0xd18a45,0x63844d,0xb85440]};
const hashValue=value=>{let hash=2166136261;for(const char of String(value??''))hash=Math.imul(hash^char.charCodeAt(0),16777619);return hash>>>0;};

function stallGroup(THREE,site,vendor,business){
 const group=new THREE.Group(),seed=hashValue(`${site.id}:${vendor.businessId}`),variant=seed%4,wood=variant===1?0x674c37:variant===2?0x75513a:0x835c3d,trim=variant===3?0xf0d9ad:0xe6d1ad,canopy=TYPE_COLORS[business?.type]||AWNING_COLORS[seed%AWNING_COLORS.length],accent=AWNING_COLORS[(seed>>>5)%AWNING_COLORS.length],products=[];
 const box=(w,h,d,x,y,z,color)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color}));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};

 // Folded striped cloth, scalloped front valance, and light timber frame.
 for(const x of [-.46,.46])for(const z of [-.34,.34])box(.055,1.9,.055,x,.95,z,wood);
 for(const z of [-.37,.37])box(.98,.06,.06,0,1.88,z,wood);
 for(let stripe=0;stripe<6;stripe++)box(.164,.08,.76,-.41+stripe*.164,1.98,0,stripe%2?trim:canopy);
 for(let stripe=0;stripe<6;stripe++)box(.164,.12,.08,-.41+stripe*.164,1.88,.39,stripe%2?trim:canopy);

 // Counter top and two open crates keep the seller visible behind the goods.
 for(const x of [-.36,.36])for(const z of [-.18,.37])box(.045,.64,.045,x,.32,z,wood);
 for(let plank=0;plank<4;plank++)box(.96,.045,.13,0,.68,.06+plank*.12,plank%2?wood:trim);
 for(const x of [-.29,.29]){
  box(.29,.18,.26,x,.81,.1,0x91683f);
  box(.29,.035,.035,x,.90,-.035,trim);box(.29,.035,.035,x,.90,.235,trim);
 }
 box(.22,.16,.2,-.34,.83,-.24,0x79543a);box(.12,.1,.12,-.34,.96,-.24,variant%2?0xb6a06c:0x67828a);

 const stock=Object.entries(business?.inventory||{}).filter(([,quantity])=>quantity>0).sort((a,b)=>b[1]-a[1]);
 const preferred=business?.type==='greengrocer'?['frutas','verduras','maca','goiaba','tomate','banana']:business?.type==='bakery'?['pao','bolo','biscoito']:business?.type==='publisher'?['livros','panfletos']:business?.type==='clothing_store'||business?.type==='thrift_store'?['roupas','tecido']:business?.type==='artisan'?['cestas','moveis']:business?.type==='restaurant'?['refeicoes','pao','frutas']:[];
 let goods=stock.map(([good])=>good).filter(good=>preferred.includes(good));if(!goods.length)goods=preferred.length?preferred:stock.map(([good])=>good);
 const firstGood=String(goods[0]||'').toLocaleLowerCase('pt-BR'),palette=GOODS_COLORS[goods[0]]||Object.entries(GOODS_COLORS).find(([key])=>key!=='default'&&firstGood.includes(key))?.[1]||GOODS_COLORS.default;
 for(let i=0;i<11;i++){
  const row=i<6?0:1,col=i%6,x=-.31+col*.124,z=row===0?.01:.25,y=.94+(row===0?0:.02),color=palette[(i+(seed>>>7))%palette.length];
  products.push({x,y,z,color,scale:.72+(i%3)*.12});
 }
 const productGeometry=new THREE.DodecahedronGeometry(.105,0),produce=new THREE.InstancedMesh(productGeometry,new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true}),products.length),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),color=new THREE.Color();
 products.forEach((product,index)=>{position.set(product.x,product.y,product.z);scale.setScalar(product.scale);matrix.compose(position,new THREE.Quaternion(),scale);produce.setMatrixAt(index,matrix);produce.setColorAt(index,color.setHex(product.color));});
 produce.instanceMatrix.needsUpdate=true;if(produce.instanceColor)produce.instanceColor.needsUpdate=true;produce.castShadow=true;produce.receiveShadow=true;group.add(produce);

 // A painted shop sign makes neighboring vendors read as distinct businesses.
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');
 ctx.fillStyle=`#${canopy.toString(16).padStart(6,'0')}`;ctx.fillRect(0,0,256,64);ctx.fillStyle='#f4e9cf';ctx.fillRect(4,4,248,56);
 ctx.fillStyle=`#${canopy.toString(16).padStart(6,'0')}`;ctx.font='bold 24px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
 const label=String(vendor.name||'FEIRA').toLocaleUpperCase('pt-BR');ctx.fillText(label.length>20?`${label.slice(0,18)}…`:label,128,32,232);
 const texture=new THREE.CanvasTexture(canvas);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(.86,.22),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));sign.position.set(0,1.58,.405);sign.userData.marketSignTexture=texture;sign.userData.skipStaticMerge=true;group.add(sign);
 for(const x of [-.48,.48]){box(.07,.12,.07,x,1.59,.4,wood);box(.06,.06,.06,x,1.68,.4,accent);}
 mergeStaticMeshes(THREE,group);group.userData.marketSignTexture=texture;group.userData.marketStockCount=stock.length;group.userData.marketSeed=seed;return group;
}

export function syncStreetMarketStalls(renderer,THREE,world){
 const city=renderer.cityDevelopment?.city,active=new Set(),markets=city?.economy?.streetMarkets||[];
 renderer.streetMarketStallMeshes??=new Map();
 const open=city&&city.hour>=8&&city.hour<17&&city.economy.streetMarketsDay===city.day;
 if(open)for(const site of markets)for(const vendor of site.vendors||[]){
  const id=`${site.id}:${vendor.businessId}`;active.add(id);const x=vendor.position.x,y=vendor.position.y;
  let mesh=renderer.streetMarketStallMeshes.get(id);const business=city.building(vendor.businessId),signature=`${vendor.name}:${business?.type||''}:${city.day}`;
  if(mesh&&mesh.userData.signature!==signature){renderer.scene.remove(mesh);mesh.traverse(o=>{o.geometry?.dispose();if(o!==mesh&&o.material?.map===mesh.userData.marketSignTexture)o.material.dispose();else o.material?.dispose();o.userData.marketSignTexture?.dispose();});renderer.streetMarketStallMeshes.delete(id);mesh=null;}
  if(!mesh){mesh=stallGroup(THREE,site,vendor,business);mesh.userData.signature=signature;renderer.streetMarketStallMeshes.set(id,mesh);renderer.scene.add(mesh);}
  const dx=site.x-x,dy=site.y-y,angle=Math.hypot(dx,dy)>.1?Math.atan2(dx,dy):((hashValue(id)%4)*Math.PI/2);
  // Keep the real vendor at their assigned spot, just behind the counter.
  // The stall faces inward toward the market gathering point.
  const stallX=x+Math.sin(angle)*.55,stallY=y+Math.cos(angle)*.55;
  mesh.rotation.y=angle;mesh.position.set(stallX,surfaceElevation(world,stallX,stallY),stallY);
  mesh.visible=!Number.isFinite(renderer.renderedMinTx)||(x>=renderer.renderedMinTx-1&&x<=renderer.renderedMaxTx+1&&y>=renderer.renderedMinTy-1&&y<=renderer.renderedMaxTy+1);
 }
 for(const [id,mesh]of renderer.streetMarketStallMeshes)if(!active.has(id)){renderer.scene.remove(mesh);mesh.traverse(o=>{o.geometry?.dispose();o.material?.dispose();o.userData.marketSignTexture?.dispose();});renderer.streetMarketStallMeshes.delete(id);}
}
