import {drawPartyFlag} from './city_party_flags.js';
import {surfaceElevation} from './city_terrain.js';
function poster(d,onReady=null){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle=d.flag.background;ctx.fillRect(0,0,512,256);ctx.fillStyle=d.flag.foreground;ctx.fillRect(12,12,488,8);ctx.fillRect(12,236,488,8);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 96px sans-serif';if(d.kind==='flag'){drawPartyFlag(ctx,d.flag,18,38,220,170,onReady);ctx.fillStyle=d.flag.foreground;ctx.fillText(String(d.partyNumber).padStart(2,'0'),374,128);}else ctx.fillText(String(d.partyNumber).padStart(2,'0'),256,85);if(d.kind!=='flag'){ctx.font='bold 28px sans-serif';const words=d.candidateName.split(' '),line=[];let y=162;for(const word of words){if(ctx.measureText([...line,word].join(' ')).width>470){ctx.fillText(line.join(' '),256,y);line.length=0;y+=32;}line.push(word);}if(line.length&&y<226)ctx.fillText(line.join(' '),256,y);}
  return canvas;
}
export function syncCampaignDecorations(renderer,THREE,entities,world){
  renderer.campaignMeshes??=new Map();const active=new Set();
  for(const e of entities){const d=e.properties?.campaignDecoration;if(!d||e.destroyed||d.kind==='paint')continue;active.add(e.id);let group=renderer.campaignMeshes.get(e.id);
    if(!group){group=new THREE.Group();const isFlag=d.kind==='flag',w=isFlag?1.4:2.4,h=isFlag?.8:1.2;let texture;const canvas=poster(d,()=>{if(texture){texture.image=poster(d);texture.needsUpdate=true;}});texture=new THREE.CanvasTexture(canvas);texture.magFilter=THREE.NearestFilter;texture.colorSpace=THREE.SRGBColorSpace;
      const sign=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));sign.userData.partyFlagTexture=texture;sign.position.set(isFlag?w*.5:0,isFlag?1.6:1.35,0);group.add(sign);
      if(isFlag){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,2,5),new THREE.MeshLambertMaterial({color:0xa58a60}));pole.position.y=1;group.add(pole);}renderer.scene.add(group);renderer.campaignMeshes.set(e.id,group);
    }
    group.rotation.y=(d.rotation||0)*Math.PI/2;group.position.set(e.x,surfaceElevation(world,e.x,e.y),e.y);
  }
  for(const [id,group]of renderer.campaignMeshes)if(!active.has(id)){renderer.scene.remove(group);group.traverse(o=>{o.userData.partyFlagTexture?.dispose();o.geometry?.dispose();o.material?.dispose();});renderer.campaignMeshes.delete(id);}
}
