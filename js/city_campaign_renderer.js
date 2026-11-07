import {drawPartyFlag} from './city_party_flags.js';
import {drawPixelText} from './pixel_text.js?v=pixel-text-1';
import {clothFlagGeometry,animateClothFlag,flagWindTime} from './city_flag_animation.js?v=flag-wind-tick-13';
import {surfaceElevation,flagNightFactor} from './city_terrain.js?v=entrance-retaining-clearance-1';
function drawCandidateModel(ctx,candidate,x,y,w,h,accent){
  const skin=`#${(candidate?.skinColor||candidate?.entity?.properties?.render?.color||0xc78f70).toString(16).padStart(6,'0')}`,garment=candidate?.wardrobe?.[candidate.wearingIndex]||candidate?.wardrobe?.[0],shirt=typeof garment?.color==='number'?`#${garment.color.toString(16).padStart(6,'0')}`:typeof garment?.color==='string'&&/^#[0-9a-f]{6}$/i.test(garment.color)?garment.color:'#345c64',ink='#332d2a',cx=x+w/2;
  ctx.save();ctx.fillStyle=accent;ctx.fillRect(x,y,w,h);ctx.fillStyle='rgba(255,255,255,.14)';ctx.fillRect(x+4,y+4,w-8,h-8);
  // Pixel portrait borrows the candidate's skin and current clothing colors.
  const shoulder=Math.max(5,Math.round(w*.15)),headW=w*.40,headH=h*.38,headX=cx-headW/2,headY=y+h*.16,shirtTop=y+h*.62,shirtW=Math.min(w-shoulder*2,w*(candidate?.bodyWeightKg>90 ? .82 : .68));
  ctx.fillStyle=shirt;ctx.fillRect(cx-shirtW/2,shirtTop,shirtW,h*.38);ctx.fillRect(cx-w*.32,shirtTop+h*.06,w*.64,h*.19);
  ctx.fillStyle=skin;ctx.fillRect(cx-headW*.22,headY+headH*.72,headW*.44,h*.12);ctx.fillRect(headX+2,headY+headH*.2,headW-4,headH*.72);
  ctx.fillStyle=ink;const hairStyle=(candidate?.id||0)%4;ctx.fillRect(headX,headY+headH*.08,headW,headH*.2);if(hairStyle===1)ctx.fillRect(headX,headY+headH*.22,headW*.18,headH*.35);if(hairStyle===2)ctx.fillRect(headX-headW*.08,headY+headH*.12,headW*1.16,headH*.18);if(hairStyle===3){ctx.fillRect(headX-headW*.1,headY+headH*.3,headW*.18,headH*.4);ctx.fillRect(headX+headW*.92,headY+headH*.3,headW*.18,headH*.4);}
  ctx.fillStyle='#211f1e';ctx.fillRect(cx-headW*.2,headY+headH*.49,Math.max(2,w*.045),Math.max(2,h*.035));ctx.fillRect(cx+headW*.12,headY+headH*.49,Math.max(2,w*.045),Math.max(2,h*.035));ctx.fillStyle='#7f3f38';ctx.fillRect(cx-w*.055,headY+headH*.78,w*.11,Math.max(2,h*.035));
  ctx.restore();
}
function poster(d,candidate,onReady=null){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;ctx.fillStyle=d.flag.background;ctx.fillRect(0,0,512,256);ctx.fillStyle=d.flag.foreground;ctx.fillRect(12,12,488,8);ctx.fillRect(12,236,488,8);
  const isFlag=['flag','window_flag','roof_flag'].includes(d.kind);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 96px sans-serif';if(isFlag){drawPartyFlag(ctx,d.flag,18,38,172,160,onReady);drawCandidateModel(ctx,candidate,206,34,118,174,d.flag.background);ctx.fillStyle=d.flag.foreground;drawPixelText(ctx,String(d.partyNumber).padStart(2,'0'),408,108);ctx.font='bold 18px monospace';drawPixelText(ctx,String(d.candidateName||'').slice(0,20),392,202,188);}else{drawPartyFlag(ctx,d.flag,22,30,118,72,onReady);drawCandidateModel(ctx,candidate,352,31,132,174,d.flag.background);drawPixelText(ctx,String(d.partyNumber).padStart(2,'0'),245,100);ctx.font='bold 28px sans-serif';const words=String(d.candidateName||'').split(' '),line=[];let y=166;for(const word of words){if(ctx.measureText([...line,word].join(' ')).width>275){drawPixelText(ctx,line.join(' '),224,y);line.length=0;y+=32;}line.push(word);}if(line.length&&y<226)drawPixelText(ctx,line.join(' '),224,y);}
  return canvas;
}
export function syncCampaignDecorations(renderer,THREE,entities,world){
  renderer.campaignMeshes??=new Map();const active=new Set();
  for(const e of entities){const d=e.properties?.campaignDecoration;if(!d||e.destroyed||d.kind==='paint')continue;if(Number.isFinite(renderer.renderedMinTx)&&(e.x<renderer.renderedMinTx+2||e.x>renderer.renderedMaxTx-1||e.y<renderer.renderedMinTy+2||e.y>renderer.renderedMaxTy-1)){const old=renderer.campaignMeshes.get(e.id);if(old)old.visible=false;active.add(e.id);continue;}active.add(e.id);let group=renderer.campaignMeshes.get(e.id);
     if(!group){group=new THREE.Group();const isWindow=d.kind==='window_flag',isFlag=['flag','window_flag','roof_flag'].includes(d.kind),w=isWindow?.7:isFlag?1.4:2.4,h=isWindow?.45:isFlag?.8:1.2,candidate=renderer.cityDevelopment?.city?.society?.citizen(d.candidateId);let texture;const canvas=poster(d,candidate,()=>{if(texture){texture.image=poster(d,candidate);texture.needsUpdate=true;}});texture=new THREE.CanvasTexture(canvas);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;
      const sign=new THREE.Mesh(isFlag?clothFlagGeometry(THREE,w,h):new THREE.PlaneGeometry(w,h),new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide}));sign.userData.partyFlagTexture=texture;if(isFlag)sign.userData.flutterPhase=0;sign.position.set(isFlag&&!isWindow?w*.5:0,isWindow?0:isFlag?1.6:1.35,0);group.add(sign);
      if(isFlag&&!isWindow){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,2,5),new THREE.MeshLambertMaterial({color:0xa58a60}));pole.position.y=1;group.add(pole);}renderer.scene.add(group);renderer.campaignMeshes.set(e.id,group);
    }
    group.visible=true;if(group.children[0]?.material)group.children[0].material.color.setScalar(flagNightFactor(world));if(['flag','window_flag','roof_flag'].includes(d.kind))animateClothFlag(group.children[0],flagWindTime(renderer),0);group.rotation.y=d.kind==='banner'?(d.rotation||0)*Math.PI/2:0;group.position.set(e.x,d.height??surfaceElevation(world,e.x,e.y),e.y);
  }
  for(const [id,group]of renderer.campaignMeshes)if(!active.has(id)){renderer.scene.remove(group);group.traverse(o=>{o.userData.partyFlagTexture?.dispose();o.geometry?.dispose();o.material?.dispose();});renderer.campaignMeshes.delete(id);}
}
