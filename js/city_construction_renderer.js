import {surfaceElevation} from './city_terrain.js?v=deep-perf-3';

// Temporary construction surfaces are visual only: the original terrain remains
// available to navigation and is revealed again when the project finishes.
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
  const signature=`${world.revision}:${cells.length}:${cells[0].x}:${cells[0].y}:${cells.at(-1).x}:${cells.at(-1).y}`;
  live.add(project.id);let site=renderer.constructionMeshes.get(project.id);
  const visible=!Number.isFinite(renderer.renderedMinTx)||cells.every(c=>c.x>=renderer.renderedMinTx&&c.x<=renderer.renderedMaxTx+1&&c.y>=renderer.renderedMinTy&&c.y<=renderer.renderedMaxTy+1);
  if(!visible){if(site)site.visible=false;continue;}if(site)site.visible=true;
  if(site&&site.userData.signature!==signature){renderer.scene.remove(site);site.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});renderer.constructionMeshes.delete(project.id);site=null;}
  if(site)continue;
  site=new THREE.Group();site.userData.signature=signature;
  const ground=new THREE.InstancedMesh(new THREE.BoxGeometry(.93,.035,.93),new THREE.MeshLambertMaterial({color:0x9d8059}),cells.length),matrix=new THREE.Matrix4();
  cells.forEach((c,i)=>{matrix.makeTranslation(c.x,surfaceElevation(world,c.x,c.y)+.045,c.y);ground.setMatrixAt(i,matrix);});ground.instanceMatrix.needsUpdate=true;site.add(ground);
  const positions=cells.length===1?[cells[0]]:[cells[0],cells.at(-1)];
  const wood=new THREE.MeshLambertMaterial({color:0x82552e}),stripe=new THREE.MeshLambertMaterial({color:0xe4a436});
  for(const pos of positions){const marker=new THREE.Group(),h=surfaceElevation(world,pos.x,pos.y);marker.position.set(pos.x,h,pos.y);
   for(const dx of [-.27,.27]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.07,.65,.07),wood);leg.position.set(dx,.32,0);marker.add(leg);}
   const plank=new THREE.Mesh(new THREE.BoxGeometry(.78,.22,.09),stripe);plank.position.set(0,.55,0);marker.add(plank);site.add(marker);
  }
  renderer.scene.add(site);renderer.constructionMeshes.set(project.id,site);
 }
 for(const [id,site] of renderer.constructionMeshes)if(!live.has(id)){renderer.scene.remove(site);site.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});renderer.constructionMeshes.delete(id);}
}
