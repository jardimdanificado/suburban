import {drawPartyFlag} from './city_party_flags.js';
import {clothFlagGeometry,animateClothFlag,flagWindTime} from './city_flag_animation.js?v=flag-wind-tick-13';
import {surfaceElevation,flagNightFactor} from './city_terrain.js?v=deep-perf-3';
function poster(d,onReady=null){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle=d.flag.background;ctx.fillRect(0,0,512,256);ctx.fillStyle=d.flag.foreground;ctx.fillRect(12,12,488,8);ctx.fillRect(12,236,488,8);
  const isFlag=['flag','window_flag','roof_flag'].includes(d.kind);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 96px sans-serif';if(isFlag){drawPartyFlag(ctx,d.flag,18,38,220,170,onReady);ctx.fillStyle=d.flag.foreground;ctx.fillText(String(d.partyNumber).padStart(2,'0'),374,128);}else ctx.fillText(String(d.partyNumber).padStart(2,'0'),256,85);if(!isFlag){ctx.font='bold 28px sans-serif';const words=d.candidateName.split(' '),line=[];let y=162;for(const word of words){if(ctx.measureText([...line,word].join(' ')).width>470){ctx.fillText(line.join(' '),256,y);line.length=0;y+=32;}line.push(word);}if(line.length&&y<226)ctx.fillText(line.join(' '),256,y);}
  return canvas;
}
export function syncCampaignDecorations(renderer,THREE,entities,world){
  renderer.campaignMeshes??=new Map();const active=new Set();
  syncCampaignSpeakers(renderer,THREE,entities,world);
  for(const e of entities){const d=e.properties?.campaignDecoration;if(!d||e.destroyed||d.kind==='paint')continue;if(Number.isFinite(renderer.renderedMinTx)&&(e.x<renderer.renderedMinTx+2||e.x>renderer.renderedMaxTx-1||e.y<renderer.renderedMinTy+2||e.y>renderer.renderedMaxTy-1)){const old=renderer.campaignMeshes.get(e.id);if(old)old.visible=false;active.add(e.id);continue;}active.add(e.id);let group=renderer.campaignMeshes.get(e.id);
     if(!group){group=new THREE.Group();const isWindow=d.kind==='window_flag',isFlag=['flag','window_flag','roof_flag'].includes(d.kind),w=isWindow?.7:isFlag?1.4:2.4,h=isWindow?.45:isFlag?.8:1.2;let texture;const canvas=poster(d,()=>{if(texture){texture.image=poster(d);texture.needsUpdate=true;}});texture=new THREE.CanvasTexture(canvas);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;
      const sign=new THREE.Mesh(isFlag?clothFlagGeometry(THREE,w,h):new THREE.PlaneGeometry(w,h),new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide}));sign.userData.partyFlagTexture=texture;if(isFlag)sign.userData.flutterPhase=0;sign.position.set(isFlag&&!isWindow?w*.5:0,isWindow?0:isFlag?1.6:1.35,0);group.add(sign);
       if(isFlag&&!isWindow){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,2,5),new THREE.MeshLambertMaterial({color:0xa58a60}));pole.position.y=1;group.add(pole);}(renderer.constructionGroup||renderer.scene).add(group);renderer.campaignMeshes.set(e.id,group);
    }
    group.visible=true;if(group.children[0]?.material)group.children[0].material.color.setScalar(flagNightFactor(world));if(['flag','window_flag','roof_flag'].includes(d.kind))animateClothFlag(group.children[0],flagWindTime(renderer),0);group.rotation.y=0;group.position.set(e.x,d.height??surfaceElevation(world,e.x,e.y),e.y);
  }
   for(const [id,group]of renderer.campaignMeshes)if(!active.has(id)){group.parent?.remove(group);group.traverse(o=>{o.userData.partyFlagTexture?.dispose();o.geometry?.dispose();o.material?.dispose();});renderer.campaignMeshes.delete(id);}
}

// A speech bubble is an observation aid; physical flags still require cloth.
function syncCampaignSpeakers(renderer,THREE,entities,world){
  renderer.campaignSpeakers??=new Map();renderer.campaignSpeechMaterials??=new Map();const live=new Set();
  for(const e of entities){const c=e.properties?.citizen,m=c?.campaign;if(Number.isFinite(renderer.renderedMinTx)&&(e.x<renderer.renderedMinTx||e.x>renderer.renderedMaxTx||e.y<renderer.renderedMinTy||e.y>renderer.renderedMaxTy))continue;if(e.destroyed||c?.task!=='campaign'||m?.type!=='canvass'||m.flag||c.path.length||c.ridingVehicleId)continue;
     live.add(e.id);const id=`${m.partyId}:${m.partyNumber}:${m.speechColor}`;let material=renderer.campaignSpeechMaterials.get(id);
    if(!material){const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle=m.speechColor||'#ece9db';ctx.fillRect(2,2,124,48);ctx.beginPath();ctx.moveTo(30,49);ctx.lineTo(30,63);ctx.lineTo(44,49);ctx.fill();ctx.fillStyle='#ffffff';ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.fillText(String(m.partyNumber).padStart(2,'0'),64,38);const map=new THREE.CanvasTexture(canvas);map.magFilter=THREE.NearestFilter;material=new THREE.SpriteMaterial({map,depthTest:true});renderer.campaignSpeechMaterials.set(id,material);}
     let sprite=renderer.campaignSpeakers.get(e.id);if(!sprite){sprite=new THREE.Sprite(material);sprite.scale.set(.9,.45,1);(renderer.categoryOtherGroup||renderer.scene).add(sprite);renderer.campaignSpeakers.set(e.id,sprite);}sprite.material=material;sprite.position.set(e.x,surfaceElevation(world,e.x,e.y)+1.5,e.y);
  }
   for(const [id,sprite]of renderer.campaignSpeakers)if(!live.has(id)){sprite.parent?.remove(sprite);renderer.campaignSpeakers.delete(id);}
}
