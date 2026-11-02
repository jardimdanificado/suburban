import {cornerHeight,surfaceElevation} from './city_terrain.js?v=sidewalk-grade-1';
import {caribbeanGroundSurfaceTextures} from './caribbean_pixel_materials.js?v=ground-realism-2';

// Construction visuals cover the terrain without changing its navigation tiles.
function addFarmSoil(THREE,world,cells,site){
 const positions=[],uvs=[];
 for(const cell of cells){
  const x=Math.floor(cell.x),y=Math.floor(cell.y),h00=cornerHeight(world,x,y)+.025,h10=cornerHeight(world,x+1,y)+.025,h11=cornerHeight(world,x+1,y+1)+.025,h01=cornerHeight(world,x,y+1)+.025;
  positions.push(x,h00,y,x,h01,y+1,x+1,h11,y+1,x,h00,y,x+1,h11,y+1,x+1,h10,y);
  const u0=x/2,u1=(x+1)/2,v0=y/2,v1=(y+1)/2;
  uvs.push(u0,v0,u0,v1,u1,v1,u0,v0,u1,v1,u1,v0);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
 const ground=caribbeanGroundSurfaceTextures(THREE,'construction'),soilMaterial=new THREE.MeshStandardMaterial({map:ground.map,normalMap:ground.normalMap,normalScale:new THREE.Vector2(.38,.38),color:0xffffff,roughness:.94,metalness:0,side:THREE.DoubleSide});
 const soil=new THREE.Mesh(geometry,soilMaterial);soil.receiveShadow=true;site.add(soil);
}
function addSawhorse(THREE,site,world,x,z,axis,{wood,yellow,black}){
 const ground=surfaceElevation(world,x,z),stand=new THREE.Group();stand.position.set(x,ground,z);if(axis==='z')stand.rotation.y=Math.PI/2;
 const beam=(a,b,width,material)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),mesh=new THREE.Mesh(new THREE.BoxGeometry(width,delta.length(),width),material);mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());mesh.castShadow=true;stand.add(mesh);};
 // Two splayed A frames keep the warning board visibly supported from either side.
 for(const side of [-1,1])for(const depth of [-1,1])beam([side*.16,.68,depth*.065],[side*.25,.03,depth*.16],.065,wood);
 for(const side of [-1,1]){const brace=new THREE.Mesh(new THREE.BoxGeometry(.05,.05,.3),wood);brace.position.set(side*.205,.28,0);brace.castShadow=true;stand.add(brace);}
 const board=new THREE.Mesh(new THREE.BoxGeometry(.62,.15,.085),yellow);board.position.y=.72;board.castShadow=true;stand.add(board);
 for(let i=-2;i<=2;i+=2){const stripe=new THREE.Mesh(new THREE.BoxGeometry(.085,.17,.1),black);stripe.position.set(i*.12,.72,.004);stripe.rotation.z=.42;stand.add(stripe);}
 site.add(stand);
}
function addPerimeterPost(THREE,site,world,x,z,wood){
 const post=new THREE.Mesh(new THREE.BoxGeometry(.075,.9,.075),wood);post.position.set(x,surfaceElevation(world,x,z)+.45,z);post.rotation.z=((Math.round(x*13+z*7)%3)-1)*.045;post.castShadow=true;site.add(post);
}
function addConstructionMaterials(THREE,site,world,cells,materials){
 const x0=Math.min(...cells.map(c=>c.x))-.5,x1=Math.max(...cells.map(c=>c.x))+.5,z0=Math.min(...cells.map(c=>c.y))-.5,z1=Math.max(...cells.map(c=>c.y))+.5;
 if(x1-x0<2.7||z1-z0<2.7){addSawhorse(THREE,site,world,(x0+x1)/2,(z0+z1)/2,'x',materials);return;}
 const concrete=new THREE.MeshLambertMaterial({color:0x999b98}),cx=x0+.58,cz=z0+.6,base=surfaceElevation(world,cx,cz);
 // A small pallet with a staggered stack of concrete blocks.
 for(let i=-1;i<=1;i++){const slat=new THREE.Mesh(new THREE.BoxGeometry(.58,.055,.075),materials.wood);slat.position.set(cx,base+.07,cz+i*.17);slat.castShadow=true;site.add(slat);}
 for(let row=0;row<2;row++)for(let col=0;col<3;col++){const block=new THREE.Mesh(new THREE.BoxGeometry(.17,.12,.13),concrete);block.position.set(cx+(col-1)*.19+(row?.08:0),base+.16+row*.12,cz+(col%2?-.08:.08));block.castShadow=true;block.receiveShadow=true;site.add(block);}
 // Planks laid beside the pallet suggest unfinished carpentry work.
 const px=x1-.55,pz=z1-.48,plankBase=surfaceElevation(world,px,pz)+.04;
 for(let i=0;i<3;i++){const plank=new THREE.Mesh(new THREE.BoxGeometry(.72,.07,.09),materials.wood);plank.position.set(px,plankBase+i*.075,pz+(i-1)*.1);plank.rotation.y=i===1?.035:0;plank.castShadow=true;site.add(plank);}
 const innerX=(x0+x1)/2,innerZ=(z0+z1)/2;addSawhorse(THREE,site,world,innerX,innerZ,'x',materials);
}
function addConstructionPerimeter(THREE,world,site,cells){
 if(!cells.length)return;
 const x0=Math.min(...cells.map(c=>c.x))-.5,x1=Math.max(...cells.map(c=>c.x))+.5,z0=Math.min(...cells.map(c=>c.y))-.5,z1=Math.max(...cells.map(c=>c.y))+.5;
 const materials={wood:new THREE.MeshLambertMaterial({color:0x76543a}),yellow:new THREE.MeshLambertMaterial({color:0xf2c328}),black:new THREE.MeshLambertMaterial({color:0x17191a})};
 const edge=(axis,fixed,start,end)=>{
  const length=end-start,step=.42;
  for(let distance=0,index=0;distance<length-1e-6;distance+=step,index++){
   const segment=Math.min(step,length-distance),from=start+distance,to=from+segment,along=(from+to)/2;
   const x0=axis==='x'?from:fixed,z0=axis==='z'?from:fixed,x1=axis==='x'?to:fixed,z1=axis==='z'?to:fixed;
   const h0=surfaceElevation(world,x0,z0)+.66,h1=surfaceElevation(world,x1,z1)+.66;
   const x=axis==='x'?along:fixed,z=axis==='z'?along:fixed,material=index%2?materials.black:materials.yellow;
   const tape=new THREE.Mesh(new THREE.BoxGeometry(axis==='x'?segment:.035,.055,axis==='z'?segment:.035),material);
   tape.position.set(x,(h0+h1)/2,z);
   if(axis==='x')tape.rotation.z=Math.atan2(h1-h0,segment);else tape.rotation.x=-Math.atan2(h1-h0,segment);
   site.add(tape);
  }
  // Terrain steps get a vertical stake where the fence crosses into the
  // neighboring level. The corner stakes already cover both ends of an edge.
  for(let boundary=Math.ceil(start+1e-6);boundary<end-1e-6;boundary++){
   const before=axis==='x'?surfaceElevation(world,boundary-.25,fixed):surfaceElevation(world,fixed,boundary-.25);
   const after=axis==='x'?surfaceElevation(world,boundary+.25,fixed):surfaceElevation(world,fixed,boundary+.25);
   if(Math.abs(after-before)<.08)continue;
   const x=axis==='x'?boundary:fixed,z=axis==='z'?boundary:fixed;
   addPerimeterPost(THREE,site,world,x,z,materials.wood);
  }
 };
 edge('x',z0,x0,x1);edge('x',z1,x0,x1);edge('z',x0,z0,z1);edge('z',x1,z0,z1);
 const corners=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
 for(const [x,z]of corners){addPerimeterPost(THREE,site,world,x,z,materials.wood);const join=new THREE.Mesh(new THREE.BoxGeometry(.045,.055,.045),materials.yellow);join.position.set(x,surfaceElevation(world,x,z)+.66,z);site.add(join);}
 return materials;
}

export function syncConstructionSites(renderer,THREE,world,development){
 if(!development)return;
 renderer.constructionMeshes??=new Map();
 const plots=new Map(development.plots.map(p=>[p.id,p])),live=new Set();
 for(const project of development.projects){
  if(project.cancelled||project.status==='completed')continue;
  const plot=plots.get(project.plotId),route=project.path||project.route;
  let cells=[];
  if(project.service==='building'&&plot){for(let y=plot.y;y<plot.y+Math.min(plot.depth,project.depth||plot.depth);y++)for(let x=plot.x;x<plot.x+Math.min(plot.width,project.width||plot.width);x++)cells.push({x:x+.5,y:y+.5});}
  else if((project.service==='road'||project.service==='bridge'||project.service==='road-repair')&&route)cells=route.map(p=>({x:Math.floor(p.x)+.5,y:Math.floor(p.y)+.5}));
  else if(project.door)cells=[{x:project.door.x,y:project.door.y}];
  if(!cells.length)continue;
  const terrainRevision=world.topologyRevision??world.revision??0,signature=`${terrainRevision}:${world.bridgeRevision??0}:${project.service}:${cells.map(c=>`${c.x},${c.y}`).join(';')}`;
  live.add(project.id);let site=renderer.constructionMeshes.get(project.id);
  const visible=!Number.isFinite(renderer.renderedMinTx)||cells.every(c=>c.x>=renderer.renderedMinTx&&c.x<=renderer.renderedMaxTx+1&&c.y>=renderer.renderedMinTy&&c.y<=renderer.renderedMaxTy+1);
  if(!visible){if(site)site.visible=false;continue;}if(site)site.visible=true;
  if(site&&site.userData.signature!==signature){renderer.scene.remove(site);site.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});renderer.constructionMeshes.delete(project.id);site=null;}
  if(site)continue;
  site=new THREE.Group();site.userData.signature=signature;
  addFarmSoil(THREE,world,cells,site);
  if(project.service==='building'){const materials=addConstructionPerimeter(THREE,world,site,cells);addConstructionMaterials(THREE,site,world,cells,materials);}
  renderer.scene.add(site);renderer.constructionMeshes.set(project.id,site);
 }
 for(const [id,site]of renderer.constructionMeshes)if(!live.has(id)){renderer.scene.remove(site);site.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});renderer.constructionMeshes.delete(id);}
}
