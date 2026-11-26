import {smoothCitizenNormals} from './city_citizen_shading.js';
import {citizenHeadAttachment,createHeadFlag} from './city_head_flag.js';
import {advanceCitizenGait} from './city_citizen_gait.js';
import {wickerBasketSurface,cargoCrateSurface} from './city_mobility_models.js?v=cargo-box-rear-1';
import {partyFlagCanvas,drawPartyFlag} from './city_party_flags.js';
import {clothFlagGeometry,animateClothFlag} from './city_flag_animation.js?v=flag-wind-tick-13';
import {bodyFatAmount} from './city_body_metrics.js?v=citizen-access-1';
import {TROPICAL_PRINTS,wornGarment,wornLowerGarment} from './city_clothing.js?v=party-apparel-1';
import {CITIZEN_BODY_FACE_COUNT,CITIZEN_GARMENT_FACES} from './city_garment_faces.js?v=shared-anatomical-faces-2';
import {fittedSkirtSurface} from './city_citizen_skirts.js?v=anatomical-dress-skirt-1';
import {createPoseWeightMorph,computeWeightMorphAttributes} from './city_citizen_weight_morph.js?v=anatomical-3d-morph-1';
/** OBJ snapshots share one geometry per frame and one instanced draw per visible frame. */
export const CITIZEN_MODEL_FRAMES=Object.freeze({idle:[0],run:[0,1,2,3,4],caminhar:[0,1,2,3,4,5],andar_lento:[0,1,2,3,4,5],use:[0,1,2],use_alt:[0,1,2],a_postos:[0,1],chute:[0,1],derrotado:[0,1],dormindo:[0],morto:[0],murro:[0,1],sentado_no_banco:[0],sentado_no_chao:[0],acenar:[0,1,2,3,4,5],comemorar:[0,1,2,3],conversar:[0,1,2,3],cavar:[0,1,2,3],colher:[0,1,2,3],aplaudir:[0,1,2,3,4,5],beber:[0,1,2,3],pescar:[0],chorar:[0,1,2,3],tocar_violao:[0,1,2,3],escalar:[0,1,2,3,4,5],pichar:[0,1,2,3],dancar_samba:[0,1,2,3,4,5,6,7,8,9],dancar_salsa:[0,1,2,3,4,5,6,7,8,9],dancar_rumba:[0,1,2,3,4,5,6,7,8,9],dancar_hiphop:[0,1,2,3,4,5,6,7,8,9],dancar_boba:[0,1,2,3,4,5,6,7,8,9],dancar_breakdance:[0,1,2,3,4,5,6,7,8,9],dancar_macarena:[0,1,2,3,4,5,6,7,8,9],nadar:[0,1,2,3,4,5],boiar:[0,1,2,3],carregar:[0,1,2,3,4,5],carregar_parado:[0,1,2,3],droga_cafe_andar:[0,1,2,3,4,5],droga_cafe_idle:[0,1,2,3],droga_alcool_andar:[0,1,2,3,4,5],droga_alcool_idle:[0,1,2,3],droga_folha_coca_andar:[0,1,2,3,4,5],droga_folha_coca_idle:[0,1,2,3],droga_tabaco_andar:[0,1,2,3,4,5],droga_tabaco_idle:[0,1,2,3],droga_cannabis_andar:[0,1,2,3,4,5],droga_cannabis_idle:[0,1,2,3],droga_coca_andar:[0,1,2,3,4,5],droga_coca_idle:[0,1,2,3],droga_cubensis_andar:[0,1,2,3,4,5],droga_cubensis_idle:[0,1,2,3],droga_amanita_andar:[0,1,2,3,4,5],droga_amanita_idle:[0,1,2,3],droga_peyote_andar:[0,1,2,3,4,5],droga_peyote_idle:[0,1,2,3],droga_trombeta_anjo_andar:[0,1,2,3,4,5],droga_trombeta_anjo_idle:[0,1,2,3]});
const citizenHasPath=c=>c?._renderPathActive??!!c?.path?.length;
export function citizenIsSleeping(c){
 if(c?.task!=='energy'||!c.sleep?.active||citizenHasPath(c)||c.mobilityTrip||c.ridingVehicleId||c.deliveryId)return false;
 const s=c.indoorLocation;
 if(s)return s.roomType==='bedroom'&&!s.exiting&&!s.path?.length;
 return !!c.homelessSleepSpot&&!!c.entity&&Math.hypot(c.entity.x-c.homelessSleepSpot.x,c.entity.y-c.homelessSleepSpot.y)<=.3;
}
const WORK_TASKS=new Set(['work','manage','construction','clean','cleaning','research','campaign','care','caregiving','food','provisions','water','hygiene','supplies','shopping','health','vote','council-session','informal-service','informal-frontage','informal-gardening','fishing']);
const CASUAL_WALK_TASKS=new Set(['walk','leisure','social','visit','shopping','street-market-shopping']);
const BIKE_KINDS=new Set(['bicicleta','bicicleta_carga']),GLIDE_KINDS=new Set(['patinete','patins','skate']);
const ALT_USE_TASKS=new Set(['food','workmeal','provisions','toilet','hygiene','water','health','shopping','supplies','care','caregiving','leisure','social','vote']);
const DANCE_CLIPS=Object.freeze(['dancar_samba','dancar_salsa','dancar_rumba','dancar_hiphop','dancar_boba','dancar_breakdance','dancar_macarena']);
const SUBSTANCE_PRIORITY=Object.freeze(['trombeta_anjo','amanita','cubensis','peyote','coca','alcool','cannabis','folha_coca','tabaco','cafe']);
function activeSubstanceEffect(c){
  const effects=c?.substanceState?.effects;
  if(!effects?.length)return null;
  for(const id of SUBSTANCE_PRIORITY)if(effects.some(e=>e?.id===id))return id;
  return null;
}
const TOOL_CLIPS=Object.freeze({cavar:'shovel',colher:'scythe',pescar:'rod',tocar_violao:'guitar',beber:'mug',pichar:'spray'});
const ACTION_CLIPS=new Set(['run','caminhar','andar_lento','pedal','murro','chute','derrotado','nadar','carregar','escalar']);
const PRINTED_GARMENTS=new Set(['camisa social','camisa estampada','vestido estampado']),PATTERNED_GARMENTS=new Set(['camisa estampada','vestido estampado']),DRESS_PIECES=new Set(['vestido','vestido estampado']),SKIRT_PIECES=new Set(['saia','saia longa']),HAND_PIECES=new Set(['luvas']);
const COMBINABLE_GARMENTS=new Set(['camisa','camiseta','regata','terno','casaco','trapos','macacão']);
const HEADWEAR_PIECES=new Set(['boné','cartola','chapéu','chapéu nordestino','chapéu de cangaceiro','chapéu de couro','chapéu de vaqueiro','chapéu de palha pequeno','chapéu de palha médio','chapéu de palha grande','cesta']);
const LOWER_PIECES=new Set(['sapatos','botas','calça','calça social','shorts','bermuda','sunga','saia','saia longa']);
const RENDERED_ACCESSORIES=new Set(['boné','cartola','chapéu','chapéu nordestino','chapéu de cangaceiro','chapéu de couro','chapéu de vaqueiro','chapéu de palha pequeno','chapéu de palha médio','chapéu de palha grande','cesta','sapatos','botas','calça','calça social','shorts','bermuda','sunga','saia','saia longa','luvas']);
export function citizenAnimation(c,moving=false,inWater=undefined){
  if(c.dead)return 'morto';
  if(c.unconsciousUntil)return 'derrotado';
  if(c.surrenderedUntil)return 'sentado_no_chao';
  if(c.mobilityTrip?.stage==='boarding')return moving?'run':'idle';
  if(c.ridingVehicleId){
    if(c.ridingVehicleKind==='carrinho')return 'run';
    if(BIKE_KINDS.has(c.ridingVehicleKind))return c.ridingAsPassenger?'sentado_no_banco':'seated';
    return GLIDE_KINDS.has(c.ridingVehicleKind)?'glide':'passenger';
  }
  if(c.climbing)return c.climbing.phase==='painting'?'pichar':'escalar';
  const substance=activeSubstanceEffect(c);
  if(inWater!==undefined?inWater:c.swimming)return moving?'nadar':'boiar';
  if(moving){
    if(c.deliveryId||c.forestryJob?.stage==='return'||c.carryLoad)return 'carregar';
    if(substance&&CITIZEN_MODEL_FRAMES[`droga_${substance}_andar`])return `droga_${substance}_andar`;
    if(c.task==='combat-flee'||c.task==='police-response'||c.running||(c.playerControlled&&c.playerRunning))return 'run';
    if(c.task==='outdoor_leisure'||c.task==='swim-leisure'||(c.needs?.energy??100)<25)return 'andar_lento';
    if(CASUAL_WALK_TASKS.has(c.task))return 'caminhar';
    return 'run';
  }
  if(c.fishingPose)return c.fishingPose.chair||c.fishingPose.boat?'sentado_no_banco':'sentado_no_chao';
  if(c.combatReaction)return 'derrotado';
  if(c.combatAnimation?.clip)return c.combatAnimation.clip;
  if(citizenIsSleeping(c))return 'dormindo';
  if(c.furnitureUse?.pose==='ground_sit')return 'sentado_no_chao';
  if(c.task==='sit'&&c.seated||c.furnitureUse?.type==='bench'||c.furnitureUse?.type==='beach_chair')return 'sentado_no_banco';
  if(c.seated)return 'seated';
  if(c.policePatrol)return 'a_postos';
  if(c.graffitiMission?.status==='painting')return 'pichar';
  if(c.deliveryId||c.forestryJob?.stage==='return'||c.carryLoad)return 'carregar_parado';
  if(c.conversation)return 'conversar';
  if(c.celebrating||c.task==='celebrate')return 'comemorar';
  if(c.clapping||c.task==='clap')return 'aplaudir';
  if(c.playingGuitar||c.task==='music')return 'tocar_violao';
  if(c.dancing||c.task==='dance')return c.danceStyle&&CITIZEN_MODEL_FRAMES[c.danceStyle]?c.danceStyle:DANCE_CLIPS[(c.id||0)%DANCE_CLIPS.length];
  if(c.waving||c.task==='wave')return 'acenar';
  if(c.crying)return 'chorar';
  const activelyUsingFurniture=!!c.furnitureUse&&!c.furnitureUse.seated;
  const activelyWorkingOutside=!!c.workCell||!!c.forestryJob||!!c.paintWorkId;
  const activelyInsideWork=!!c.indoorLocation?.unitId&&WORK_TASKS.has(c.task);
  const activelyOnGig=!!c.informalJobId&&!citizenHasPath(c);
  const activelyWorking=WORK_TASKS.has(c.task)&&!citizenHasPath(c)&&(activelyUsingFurniture||activelyWorkingOutside||activelyInsideWork||activelyOnGig||c.task==='construction'&&c.workProjectId!=null);
  if(!activelyWorking)return substance&&CITIZEN_MODEL_FRAMES[`droga_${substance}_idle`]?`droga_${substance}_idle`:(c.mood??0)<=-15?'chorar':'idle';
  if(c.task==='water'||c.task==='drink')return 'beber';
  if(c.task==='fishing')return 'pescar';
  if(c.task==='farm'||c.forestryJob?.stage==='plant'||c.task==='informal-gardening')return 'colher';
  if(c.task==='construction'||c.forestryJob?.stage==='cut')return 'cavar';
  if(c.task==='campaign')return 'acenar';
  return ALT_USE_TASKS.has(c.task)?'use_alt':'use';
}
export function citizenFrame(clip,time,phase=0,oneShot=false){
  if(clip==='mount'||clip==='passenger')return FRAME_POSES.use[0];
  if(clip==='seated')return FRAME_POSES.use[2];
  if(clip==='glide')return FRAME_POSES.use[1];
  const sequence=clip==='pedal'?[0,2,4]:clip==='use'?[0,1]:CITIZEN_MODEL_FRAMES[clip]||CITIZEN_MODEL_FRAMES.idle,poseClip=clip==='pedal'?'run':clip in CITIZEN_MODEL_FRAMES?clip:'idle';
  if(sequence.length===1)return FRAME_POSES[poseClip][sequence[0]];
  const fps=clip==='andar_lento'?5:clip==='caminhar'?6.5:clip.endsWith('_andar')?6:ACTION_CLIPS.has(clip)?8:clip.startsWith('dancar_')?5:clip==='conversar'?2.5:4,index=Math.floor(Math.max(0,time)*fps+phase),frame=sequence[oneShot?Math.min(index,sequence.length-1):index%sequence.length];
  return FRAME_POSES[poseClip][frame]||{clip:poseClip,frame};
}
const FRAME_POSES=Object.fromEntries(Object.entries(CITIZEN_MODEL_FRAMES).map(([clip,frames])=>[clip,Object.fromEntries(frames.map(frame=>[frame,Object.freeze({clip,frame})]))]));
export function parseCitizenOBJ(text){
  const vertices=[],normals=[],triangles=[];
  const index=(raw,length)=>{const n=Number(raw);if(!Number.isInteger(n)||n===0)throw Error('OBJ: índice inválido');const i=n<0?length+n:n-1;if(i<0||i>=length)throw Error('OBJ: índice fora da geometria');return i;};
  for(const line of text.split(/\r?\n/)){
    const row=line.trim();if(!row||row.startsWith('#'))continue;const fields=row.split(/\s+/),tag=fields.shift();
    if(tag==='v'||tag==='vn'){const v=fields.slice(0,3).map(Number);if(v.length!==3||!v.every(Number.isFinite))throw Error('OBJ: coordenadas inválidas');(tag==='v'?vertices:normals).push(v);}
    else if(tag==='f'){
      if(fields.length<3)throw Error('OBJ: face incompleta');
      const face=fields.map(part=>{const bits=part.split('/');return {vertex:index(bits[0],vertices.length),normal:bits[2]?index(bits[2],normals.length):null};});
      for(let i=1;i<face.length-1;i++)triangles.push([face[0],face[i],face[i+1]]);
    }
  }
  // Several exports pad each real triangle with a zero-area triangle whose
  // vertices repeat. Remove that padding to recover the shared anatomical
  // face order (246 useful faces in every supplied pose).
  for(let i=triangles.length-1;i>=0;i--){
    const [a,b,c]=triangles[i].map(point=>vertices[point.vertex]);
    const u=b.map((n,axis)=>n-a[axis]),v=c.map((n,axis)=>n-a[axis]);
    const area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);
    if(area<1e-12)triangles.splice(i,1);
  }
  if(!triangles.length)throw Error('OBJ: modelo sem faces');
  const positions=new Float32Array(triangles.length*9),normalData=new Float32Array(positions.length),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let offset=0;
  for(const face of triangles){
    const [a,b,c]=face.map(p=>vertices[p.vertex]),u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...cross)||1,flat=cross.map(v=>v/length);
    for(const point of face){const xyz=vertices[point.vertex],normal=point.normal==null?flat:normals[point.normal];for(let axis=0;axis<3;axis++){positions[offset+axis]=xyz[axis];normalData[offset+axis]=normal[axis];min[axis]=Math.min(min[axis],xyz[axis]);max[axis]=Math.max(max[axis],xyz[axis]);}offset+=3;}
  }
  return {positions,normals:normalData,bounds:{min,max},triangles:triangles.length};
}
// Partition the animated surface itself: covered body faces are replaced, never layered.
export const RENDERED_GARMENTS=Object.freeze(['camisa','camisa social','camisa estampada','camiseta','regata','terno','calça','calça social','vestido','vestido estampado','casaco','saia','saia longa','macacão','shorts','bermuda','sunga','biquíni','maiô','sapatos','botas','luvas','trapos']);
export function garmentSurface(faceCount,piece){
  if(faceCount!==CITIZEN_BODY_FACE_COUNT)throw Error(`Topologia de roupa incompatível: ${faceCount} faces`);
  const mask=new Uint8Array(faceCount);
  for(const face of CITIZEN_GARMENT_FACES[piece]||[])mask[face]=1;
  return mask;
}
const smoothWeight=(low,high,value)=>{const t=Math.max(0,Math.min(1,(value-low)/(high-low)));return t*t*(3-2*t);};
export function citizenVertexWeightMorph(x,y){
  const smooth=smoothWeight,ax=Math.abs(x);
  const torso=smooth(.40,.53,y)*(1-smooth(.78,.89,y))*(1-smooth(.12,.19,ax));
  const arm=smooth(.48,.57,y)*(1-smooth(.78,.86,y))*smooth(.09,.16,ax);
  const leg=smooth(.12,.22,y)*(1-smooth(.42,.52,y))*smooth(.05,.12,ax);
  const head=smooth(.83,.91,y)*(1-smooth(1.02,1.10,y))*(1-smooth(.06,.12,ax));
  return [torso*.60+leg*.22,torso*.60+arm*.40+leg*.46+head*.22];
}
export function citizenVertexWeightDelta(point){
  const [x,z]=citizenVertexWeightMorph(point[0],point[1]);return [point[0]*x,0,point[2]*z];
}
// Headwear uses a separate mesh so a hat and the main garment can be worn together.
// Its anchor is computed independently for each animated OBJ frame.
export function headwearSurface(data,piece){
  const p=data.positions;let top=-Infinity;for(let i=1;i<p.length;i+=3)top=Math.max(top,p[i]);
  let x=0,z=0,n=0;for(let i=0;i<p.length;i+=3)if(p[i+1]>=top-.07){x+=p[i];z+=p[i+2];n++;}
  x/=n||1;z/=n||1;
  const positions=[],normals=[],tri=(a,b,c)=>{const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,len=Math.hypot(nx,ny,nz)||1;for(const q of [a,b,c]){positions.push(...q);normals.push(nx/len,ny/len,nz/len);}};
  const ring=(radius,y,i,tilt=0)=>{const angle=i*Math.PI*2/16;return [x+Math.cos(angle)*radius,y+Math.sin(angle)*tilt,z+Math.sin(angle)*radius];};
  const base=top-.025;
  if(piece==='cesta'){
    const basket=wickerBasketSurface({x,y:base+.012,z,width:.25,depth:.22,height:.13,segments:12,courses:4});
    const anchor={x,y:base+.012,z},positions=basket.positions;
    for(let i=0;i<positions.length;i+=3){positions[i]-=anchor.x;positions[i+1]-=anchor.y;positions[i+2]-=anchor.z;}
    return {positions,normals:basket.normals,anchor};
  }
  const hat=piece==='cartola'?{brim:.145,crown:.086,height:.21,top:.072,tilt:0}:
    piece==='chapéu de cangaceiro'?{brim:.155,crown:.083,height:.13,top:.025,tilt:.018}:
    piece==='chapéu nordestino'?{brim:.17,crown:.09,height:.12,top:.035,tilt:0}:
    piece==='chapéu de couro'?{brim:.145,crown:.09,height:.10,top:.045,tilt:-.012}:
    piece==='chapéu de vaqueiro'?{brim:.205,crown:.078,height:.105,top:.064,tilt:.025}:
    piece==='chapéu de palha grande'?{brim:.225,crown:.082,height:.095,top:.065,tilt:.012}:
    piece==='chapéu de palha pequeno'?{brim:.145,crown:.078,height:.09,top:.064,tilt:0}:
    piece==='chapéu de palha médio'?{brim:.18,crown:.08,height:.095,top:.066,tilt:.006}:
    piece==='boné'?{brim:.105,crown:.082,height:.07,top:.065,tilt:0}:
    {brim:.16,crown:.08,height:.11,top:.06,tilt:0};
  const slices=16,crownTop=base+hat.height;
  for(let i=0;i<slices;i++){
    const a=ring(hat.crown,base,i),b=ring(hat.crown,base,i+1),c=ring(hat.top,crownTop,i+1),d=ring(hat.top,crownTop,i);
    tri(a,b,c);tri(a,c,d);tri(d,c,[x,crownTop,z]);
    const outerA=ring(hat.brim,base,i,hat.tilt),outerB=ring(hat.brim,base,i+1,hat.tilt);
    tri(a,outerA,outerB);tri(a,outerB,b);
    if(piece==='chapéu de cangaceiro'&&i%4===0){const star=[x+Math.cos(i*Math.PI*2/slices)*hat.crown*1.02,base+.025,z+Math.sin(i*Math.PI*2/slices)*hat.crown*1.02];tri(a,star,b);}
  }
  if(piece==='boné'){const y=base+.005,a=[x-.075,y,z+.035],b=[x+.075,y,z+.035],c=[x+.085,y,z+.16],d=[x-.085,y,z+.16];tri(a,b,c);tri(a,c,d);}
  for(let i=0;i<positions.length;i+=3){positions[i]-=x;positions[i+1]-=base;positions[i+2]-=z;}
  return {positions:new Float32Array(positions),normals:new Float32Array(normals),anchor:{x,y:base,z}};
}
function partyNumberSurface(THREE,data,number){
  const positions=[],normals=[],p=data.attributes?.position?.array||data.positions;let top=-Infinity,x=0,z=0,n=0;for(let i=1;i<p.length;i+=3)top=Math.max(top,p[i]);for(let i=0;i<p.length;i+=3)if(p[i+1]>=top-.07){x+=p[i];z+=p[i+2];n++;}x/=n||1;z/=n||1;const digits=String(number).slice(-3),height=.036,width=Math.min(.067,height*.64*digits.length),digitW=width/digits.length,thickness=.0045,centerY=top+.018,frontZ=z+.088,segments={0:[0,1,2,4,5,6],1:[2,5],2:[0,2,3,4,6],3:[0,2,3,5,6],4:[1,2,3,5],5:[0,1,3,5,6],6:[0,1,3,4,5,6],7:[0,2,5],8:[0,1,2,3,4,5,6],9:[0,1,2,3,5,6]};
  const rect=(cx,cy,w,h)=>{const a=[cx-w/2,cy-h/2,frontZ],b=[cx+w/2,cy-h/2,frontZ],c=[cx+w/2,cy+h/2,frontZ],d=[cx-w/2,cy+h/2,frontZ];for(const v of [a,b,c,a,c,d]){positions.push(...v);normals.push(0,0,1);}};
  for(let i=0;i<digits.length;i++){const digit=digits[i],cx=x-width/2+digitW*(i+.5),barW=digitW*.68,barH=thickness,sideW=thickness,midY=centerY;for(const seg of segments[digit]||[]){if(seg===0)rect(cx,midY+height*.43,barW,barH);if(seg===3)rect(cx,midY,barW,barH);if(seg===6)rect(cx,midY-height*.43,barW,barH);if(seg===1)rect(cx-barW*.49,midY+height*.22,sideW,height*.38);if(seg===2)rect(cx+barW*.49,midY+height*.22,sideW,height*.38);if(seg===4)rect(cx-barW*.49,midY-height*.22,sideW,height*.38);if(seg===5)rect(cx+barW*.49,midY-height*.22,sideW,height*.38);}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.computeBoundingSphere();return geometry;
}
function carryBoxGeometry(THREE){
  const data=cargoCrateSurface();
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));g.computeBoundingSphere();return g;
}
function carryBoxAnchor(data){
  const pos=data.positions;let x=0,y=0,z=0,count=0;
  for(const base of [82,205])for(let f=base;f<base+12;f++)for(let c=0;c<3;c++){const i=f*9+c*3;x+=pos[i];y+=pos[i+1];z+=pos[i+2];count++;}
  return {x:x/(count||1),y:y/(count||1)+.03,z:z/(count||1)+.04};
}
function handCenter(pos,base){
  let x=0,y=0,z=0,count=0;
  for(let f=base;f<base+12;f++)for(let c=0;c<3;c++){const i=f*9+c*3;x+=pos[i];y+=pos[i+1];z+=pos[i+2];count++;}
  return [x/(count||1),y/(count||1),z/(count||1)];
}
function toolAnchor(data,kind){
  const l=handCenter(data.positions,82),r=handCenter(data.positions,205);
  if(kind==='mug'||kind==='spray')return {x:r[0],y:r[1]+.02,z:r[2]+.02,ax:0,ay:1,az:0,angle:0};
  if(kind==='rod')return {x:r[0],y:r[1]+.01,z:r[2]+.02,ax:1,ay:0,az:0,angle:-.42};
  const mx=(l[0]+r[0])*.5,my=(l[1]+r[1])*.5,mz=(l[2]+r[2])*.5;
  if(kind==='guitar')return {x:mx,y:my-.02,z:mz+.05,ax:0,ay:0,az:1,angle:-.52};
  return {x:mx,y:my,z:mz+.02,ax:1,ay:0,az:0,angle:.36};
}
function toolPropGeometry(THREE,kind){
  const p=[],n=[],col=[];
  const box=(cx,cy,cz,w,h,d,hex)=>{
    const hw=w/2,hh=h/2,hd=d/2,cr=((hex>>16)&255)/255,cg=((hex>>8)&255)/255,cb=(hex&255)/255;
    const q=(a,b,c,e,nx,ny,nz)=>{for(const v of [a,b,c,a,c,e]){p.push(...v);n.push(nx,ny,nz);col.push(cr,cg,cb);}};
    q([cx-hw,cy-hh,cz+hd],[cx+hw,cy-hh,cz+hd],[cx+hw,cy+hh,cz+hd],[cx-hw,cy+hh,cz+hd],0,0,1);
    q([cx+hw,cy-hh,cz-hd],[cx-hw,cy-hh,cz-hd],[cx-hw,cy+hh,cz-hd],[cx+hw,cy+hh,cz-hd],0,0,-1);
    q([cx-hw,cy+hh,cz+hd],[cx+hw,cy+hh,cz+hd],[cx+hw,cy+hh,cz-hd],[cx-hw,cy+hh,cz-hd],0,1,0);
    q([cx-hw,cy-hh,cz-hd],[cx+hw,cy-hh,cz-hd],[cx+hw,cy-hh,cz+hd],[cx-hw,cy-hh,cz+hd],0,-1,0);
    q([cx+hw,cy-hh,cz+hd],[cx+hw,cy-hh,cz-hd],[cx+hw,cy+hh,cz-hd],[cx+hw,cy+hh,cz+hd],1,0,0);
    q([cx-hw,cy-hh,cz-hd],[cx-hw,cy-hh,cz+hd],[cx-hw,cy+hh,cz+hd],[cx-hw,cy+hh,cz-hd],-1,0,0);
  };
  if(kind==='shovel'){
    box(0,.04,0,.028,.56,.028,0x8a5e3b);
    box(0,.33,0,.09,.026,.028,0x6e472b);
    box(0,-.30,.01,.13,.15,.018,0x6d777d);
  }else if(kind==='scythe'){
    box(0,.02,0,.028,.62,.028,0x8a5e3b);
    box(.08,-.28,.02,.18,.045,.014,0x7b858b);
    box(.17,-.26,.04,.07,.035,.012,0x9aa4aa);
  }else if(kind==='rod'){
    box(0,.02,.04,.024,.024,.14,0x7d5333);
    box(0,.06,.34,.014,.014,.52,0x4a3b2c);
    box(0,.08,.62,.009,.009,.12,0x8c7a62);
  }else if(kind==='guitar'){
    box(-.04,0,0,.20,.14,.065,0xa86434);
    box(.08,0,0,.13,.11,.065,0xb8723e);
    box(.02,0,.035,.045,.045,.006,0x2a1b12);
    box(.24,0,.01,.24,.032,.024,0x6e4324);
    box(.37,0,.01,.055,.044,.026,0x3c2618);
  }else if(kind==='mug'){
    box(0,0,0,.065,.08,.065,0xc7b293);
    box(.04,0,0,.024,.045,.018,0xa69072);
    box(0,.042,0,.056,.008,.056,0xf2eadc);
  }else if(kind==='spray'){
    box(0,0,0,.048,.105,.048,0xd6453a);
    box(0,.062,0,.032,.022,.032,0xdfe6ea);
    box(0,.076,.012,.014,.012,.018,0x2b3036);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeBoundingSphere();return g;
}
export function splitGarmentSurface(data,mask,piece=null){
  const body=[],bodyNormals=[],clothes=[],clothesNormals=[];
  for(let t=0;t<data.positions.length/9;t++){
    const selected=mask[t],p=selected?clothes:body,n=selected?clothesNormals:bodyNormals;
    for(let j=0;j<9;j+=3){let x=data.positions[t*9+j],y=data.positions[t*9+j+1],z=data.positions[t*9+j+2];
      p.push(x,y,z);n.push(data.normals[t*9+j],data.normals[t*9+j+1],data.normals[t*9+j+2]);}
  }
  return {body:new Float32Array(body),bodyNormals:new Float32Array(bodyNormals),clothes:new Float32Array(clothes),clothesNormals:new Float32Array(clothesNormals)};
}
export class CityCitizenModels {
  constructor(THREE,group,{fetchAsset=globalThis.fetch?.bind(globalThis),baseURL=new URL('../data/animals/humano/',import.meta.url),decorateMaterial=()=>{}}={}){
    this.THREE=THREE;this.group=group;this.decorateMaterial=decorateMaterial;this.fetchAsset=fetchAsset;this.baseURL=baseURL;this.frames=new Map();this.outfits=new Map();this.headwear=new Map();this.headwearAnchors=new Map();this.carryAnchors=new Map();this.headAttachments=new Map();this.headwearBatches=new Map();this.batches=new Map();this.activeBatches=new Set();this.activeHeadwearBatches=new Set();this.motion=new WeakMap();this.bodyShapeCache=new WeakMap();this.appearanceCache=new WeakMap();this.printMaterials=new Map();this.combinedSurfaces=new WeakMap();this.clock=0;this.frameToken=0;this.ready=false;this.error=null;
    this.matrix=new THREE.Matrix4();this.accessoryMatrix=new THREE.Matrix4();this.position=new THREE.Vector3();this.accessoryOffset=new THREE.Vector3();this.scale=new THREE.Vector3();this.quaternion=new THREE.Quaternion();this.axis=new THREE.Vector3(0,1,0);this.headFlagNormal=new THREE.Vector3();this.lyingRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);this.color=new THREE.Color();this.dirtColor=new THREE.Color(0x62584b);this.activeDirtColor=new THREE.Color(0x62584b);this.dirtPalette={sangue:0x7a1216,bosta:0x4e3618,barro:0x4a3520,terra:0x6b5338,tinta:0x3b78b8};this.flyCount=0;this.flyCapacity=0;this.flyMesh=null;this.swimFoamCount=0;this.swimFoamCapacity=0;this.swimFoamMesh=null;
    this.material=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide});this.enableWeightMorph(this.material);this.combinedMaterial=this.enableWeightMorph(new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide}));const morphCompile=this.combinedMaterial.onBeforeCompile;this.combinedMaterial.onBeforeCompile=shader=>{morphCompile(shader);shader.vertexShader=shader.vertexShader.replace('attribute vec3 weightMorph;','attribute vec3 weightMorph;\nattribute float citizenSurfaceType;\nattribute vec3 instanceGarmentColor;\nvarying float vCitizenSurfaceType;\nvarying vec3 vCitizenGarmentColor;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCitizenSurfaceType = citizenSurfaceType;\nvCitizenGarmentColor = instanceGarmentColor;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vCitizenSurfaceType;\nvarying vec3 vCitizenGarmentColor;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vCitizenGarmentColor, vCitizenSurfaceType);');};this.combinedMaterial.customProgramCacheKey=()=> 'citizen-combined-surface-weight-morph-2';this.dressMaterial=this.enableDressMorph(new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide}));this.skirtMaterial=this.enableSkirtMorph(new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide}));this.campaignFlags=new Map();this.campaignFlagMaterials=new Map();this.activeCampaignFlags=new Set();
    // Bias fitted face materials in depth instead of moving each triangle
    // along its flat normal, which tears open seams around knees and ankles.
    this.fittedMaterial=this.enableWeightMorph(new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
    this.footwearMaterial=this.enableWeightMorph(new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
    for(const material of [this.material,this.combinedMaterial,this.dressMaterial,this.skirtMaterial,this.fittedMaterial,this.footwearMaterial])this.decorateMaterial(material);
    this.loading=this.load().catch(error=>{this.error=error.message;console.warn('Modelos dos cidadãos indisponíveis; usando sprites.',error.message);return false;});
  }
  applyPixelDirtShader(shader){
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec3 citizenBodyPos;\nattribute vec4 instanceDirt;\nattribute vec4 instanceDirtZoneA;\nattribute vec4 instanceDirtZoneB;\nvarying vec4 vCitizenDirt;\nvarying vec4 vCitizenDirtZoneA;\nvarying vec4 vCitizenDirtZoneB;\nvarying vec3 vCitizenLocalPos;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvCitizenDirt = instanceDirt;\nvCitizenDirtZoneA = instanceDirtZoneA;\nvCitizenDirtZoneB = instanceDirtZoneB;\nvCitizenLocalPos = citizenBodyPos;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec4 vCitizenDirt;\nvarying vec4 vCitizenDirtZoneA;\nvarying vec4 vCitizenDirtZoneB;\nvarying vec3 vCitizenLocalPos;')
      .replace('#include <color_fragment>',`#include <color_fragment>
if (vCitizenDirt.a > 0.05) {
  float y = vCitizenLocalPos.y, x = vCitizenLocalPos.x, z = vCitizenLocalPos.z;
  float feetMask = smoothstep(0.14 + vCitizenDirtZoneA.x * 0.40, 0.08 + vCitizenDirtZoneA.x * 0.40, y) * step(0.01, vCitizenDirtZoneA.x);
  float armMask = step(0.10, abs(x)) * step(0.45, y) * step(y, 0.88) * vCitizenDirtZoneA.y;
  float headMask = step(0.84, y) * vCitizenDirtZoneA.z;
  float seatMask = (step(z, 0.04) * step(0.38, y) * step(y, 0.58) + step(0.24, y) * step(y, 0.48) * step(z, 0.07)) * vCitizenDirtZoneA.w;
  float backMask = step(z, -0.01) * step(0.44, y) * step(y, 0.88) * vCitizenDirtZoneB.x;
  float sideMask = step(x, -0.05) * step(0.18, y) * step(y, 0.92) * vCitizenDirtZoneB.y;
  float torsoMask = step(abs(x), 0.14) * step(0.50, y) * step(y, 0.86) * vCitizenDirtZoneB.z;
  float zoneWeight = clamp(max(max(feetMask, armMask), max(max(headMask, seatMask), max(max(backMask, sideMask), max(torsoMask, vCitizenDirtZoneB.w)))), 0.0, 1.0);
  if (zoneWeight > 0.02) {
    vec3 pCell = floor(vCitizenLocalPos * 32.0);
    float h = fract(sin(dot(pCell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float h2 = fract(sin(dot(floor(vCitizenLocalPos * 14.0), vec3(41.13, 19.7, 73.9))) * 29431.7);
    float threshold = clamp(zoneWeight * (0.28 + vCitizenDirt.a * 0.48), 0.0, 0.78);
    float speck = step(1.0 - threshold, h * 0.72 + h2 * 0.28);
    diffuseColor.rgb = mix(diffuseColor.rgb, vCitizenDirt.rgb, zoneWeight * vCitizenDirt.a * 0.18);
    diffuseColor.rgb = mix(diffuseColor.rgb, vCitizenDirt.rgb * (0.72 + 0.35 * h2), speck * 0.94);
  }
}`);
  }
  enableWeightMorph(material){
    if(!this.THREE.InstancedBufferAttribute)return material;
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float instanceFat;\nattribute vec3 weightMorph;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed += instanceFat * weightMorph;');
      this.applyPixelDirtShader(shader);
    };
    material.customProgramCacheKey=()=> 'citizen-weight-morph-18';
    return material;
  }
  enableSkirtMorph(material){
    if(!this.THREE.InstancedBufferAttribute)return material;
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float instanceFat;\nattribute vec3 skirtMorph;\nattribute vec3 skirtNormalLinear;\nattribute vec3 skirtNormalQuadratic;');
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal = normalize(objectNormal + instanceFat * skirtNormalLinear + instanceFat * instanceFat * skirtNormalQuadratic);');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed += instanceFat * skirtMorph;');
      this.applyPixelDirtShader(shader);
    };
    material.customProgramCacheKey=()=> 'citizen-skirt-anatomical-fit-4';
    return material;
  }
  enableDressMorph(material){
    return this.enableSkirtMorph(material);
  }
  instancedGeometry(source,capacity){
    if(!this.THREE.InstancedBufferAttribute)return source;
    const geometry=source.clone();
    geometry.setAttribute('instanceFat',new this.THREE.InstancedBufferAttribute(new Float32Array(capacity),1));geometry.setAttribute('instancePattern',new this.THREE.InstancedBufferAttribute(new Float32Array(capacity),1));geometry.setAttribute('instanceDirt',new this.THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4));geometry.setAttribute('instanceDirtZoneA',new this.THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4));geometry.setAttribute('instanceDirtZoneB',new this.THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4));if(source.userData.citizenCombinedSurface)geometry.setAttribute('instanceGarmentColor',new this.THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3));return geometry;
  }
  combinedCitizenSurface(body,clothes){
    let byClothes=this.combinedSurfaces.get(body);if(!byClothes)this.combinedSurfaces.set(body,byClothes=new WeakMap());let cached=byClothes.get(clothes);if(cached)return cached;
    const bodyPositions=body.attributes.position.array,clothingPositions=clothes.attributes.position.array,bodyNormals=body.attributes.normal.array,clothingNormals=clothes.attributes.normal.array,bodyCanonical=body.attributes.citizenBodyPos?.array||bodyPositions,clothingCanonical=clothes.attributes.citizenBodyPos?.array||clothingPositions,positions=new Float32Array(bodyPositions.length+clothingPositions.length),canonical=new Float32Array(positions.length),normals=new Float32Array(positions.length),weightMorph=new Float32Array(positions.length),weightNormalLinear=new Float32Array(positions.length),weightNormalQuadratic=new Float32Array(positions.length),surface=new Float32Array(positions.length/3),bodyVertices=bodyPositions.length/3;
    positions.set(bodyPositions);positions.set(clothingPositions,bodyPositions.length);canonical.set(bodyCanonical);canonical.set(clothingCanonical,bodyPositions.length);normals.set(bodyNormals);normals.set(clothingNormals,bodyNormals.length);
    if(body.attributes.weightMorph)weightMorph.set(body.attributes.weightMorph.array);if(clothes.attributes.weightMorph)weightMorph.set(clothes.attributes.weightMorph.array,bodyPositions.length);
    if(body.attributes.weightNormalLinear)weightNormalLinear.set(body.attributes.weightNormalLinear.array);if(clothes.attributes.weightNormalLinear)weightNormalLinear.set(clothes.attributes.weightNormalLinear.array,bodyPositions.length);
    if(body.attributes.weightNormalQuadratic)weightNormalQuadratic.set(body.attributes.weightNormalQuadratic.array);if(clothes.attributes.weightNormalQuadratic)weightNormalQuadratic.set(clothes.attributes.weightNormalQuadratic.array,bodyPositions.length);
    for(let i=bodyVertices;i<positions.length/3;i++)surface[i]=1;
    const geometry=new this.THREE.BufferGeometry();geometry.setAttribute('position',new this.THREE.BufferAttribute(positions,3));geometry.setAttribute('citizenBodyPos',new this.THREE.BufferAttribute(canonical,3));geometry.setAttribute('normal',new this.THREE.BufferAttribute(normals,3));geometry.setAttribute('weightMorph',new this.THREE.BufferAttribute(weightMorph,3));geometry.setAttribute('weightNormalLinear',new this.THREE.BufferAttribute(weightNormalLinear,3));geometry.setAttribute('weightNormalQuadratic',new this.THREE.BufferAttribute(weightNormalQuadratic,3));geometry.setAttribute('citizenSurfaceType',new this.THREE.BufferAttribute(surface,1));geometry.computeBoundingSphere();geometry.userData.citizenCombinedSurface=true;byClothes.set(clothes,geometry);return geometry;
  }
  setInstanceGarmentColor(mesh,index,color){
    const attribute=mesh.geometry.attributes.instanceGarmentColor;if(!attribute)return;const offset=index*3;
    if(Math.abs(attribute.array[offset]-color.r)<1e-6&&Math.abs(attribute.array[offset+1]-color.g)<1e-6&&Math.abs(attribute.array[offset+2]-color.b)<1e-6)return;
    attribute.array[offset]=color.r;attribute.array[offset+1]=color.g;attribute.array[offset+2]=color.b;mesh.userData.instanceGarmentColorDirty=true;
  }
  bodyShapeFor(citizen){
    let shape=this.bodyShapeCache.get(citizen);
    if(!shape||shape.weight!==citizen.bodyWeightKg||shape.height!==citizen.bodyHeightCm){shape={weight:citizen.bodyWeightKg,height:citizen.bodyHeightCm,fat:bodyFatAmount(citizen)};this.bodyShapeCache.set(citizen,shape);}
    return shape;
  }
  setInstanceFat(mesh,index,shape){
    const attribute=mesh.geometry.attributes.instanceFat;if(!attribute)return;
    // The per-citizen shape is looked up once and shared by body, clothing,
    // and fitted accessories for this render frame.
    if(attribute.array[index]!==shape.fat){attribute.array[index]=shape.fat;mesh.userData.instanceFatDirty=true;}
  }
  setInstancePattern(mesh,index,patternId){
    const attribute=mesh.geometry.attributes.instancePattern;if(!attribute)return;
    const pattern=Math.max(0,TROPICAL_PRINTS.indexOf(patternId));
    if(attribute.array[index]!==pattern){attribute.array[index]=pattern;mesh.userData.instancePatternDirty=true;}
  }
  flushInstancePattern(mesh){const attribute=mesh.geometry.attributes.instancePattern;if(attribute&&mesh.userData.instancePatternDirty){attribute.needsUpdate=true;mesh.userData.instancePatternDirty=false;}}
  setInstanceDirt(mesh,index,color,level01,zones=null){
    const attribute=mesh.geometry.attributes.instanceDirt;if(!attribute)return;const o=index*4,a=attribute.array;
    const za=mesh.geometry.attributes.instanceDirtZoneA?.array,zb=mesh.geometry.attributes.instanceDirtZoneB?.array;
    const f=zones?Math.min(1,((zones.feet||0)+(zones.legs||0)*1.3)/150):0;
    const ar=zones?Math.min(1,(zones.arms||0)/60):0,hd=zones?Math.min(1,(zones.head||0)/60):0,st=zones?Math.min(1,(zones.seat||0)/60):0;
    const bk=zones?Math.min(1,(zones.back||0)/60):0,sd=zones?Math.min(1,(zones.side||0)/60):0,tr=zones?Math.min(1,(zones.torso||0)/70):0;
    const hasSpecific=f>0||ar>0||hd>0||st>0||bk>0||sd>0||tr>0;
    const gn=hasSpecific?0:level01*.55;
    a[o]=color.r;a[o+1]=color.g;a[o+2]=color.b;a[o+3]=level01;mesh.userData.instanceDirtDirty=true;
    if(za){za[o]=f;za[o+1]=ar;za[o+2]=hd;za[o+3]=st;}
    if(zb){zb[o]=bk;zb[o+1]=sd;zb[o+2]=tr;zb[o+3]=gn;}
  }
  flushInstanceDirt(mesh){
    for(const name of ['instanceDirt','instanceDirtZoneA','instanceDirtZoneB']){
      const attribute=mesh.geometry.attributes[name];
      if(attribute&&mesh.userData.instanceDirtDirty)attribute.needsUpdate=true;
    }
    mesh.userData.instanceDirtDirty=false;
  }
  setInstanceColor(mesh,index,color){
    const attribute=mesh.instanceColor,offset=index*3;
    if(attribute&&Math.abs(attribute.array[offset]-color.r)<1e-6&&Math.abs(attribute.array[offset+1]-color.g)<1e-6&&Math.abs(attribute.array[offset+2]-color.b)<1e-6)return;
    mesh.setColorAt(index,color);mesh.userData.instanceColorDirty=true;
  }
  appearanceFor(c,entity){
    const wardrobe=c.wardrobe,wearingIndex=c.wearingIndex,garment=wornGarment(c),lowerIndex=c.lowerWearIndex,lower=wornLowerGarment(c),headwearIndex=c.headwearIndex,headwear=Number.isInteger(headwearIndex)&&headwearIndex>=0?wardrobe?.[headwearIndex]:null,footwearIndex=c.footwearIndex,footwear=Number.isInteger(footwearIndex)&&footwearIndex>=0?wardrobe?.[footwearIndex]:null,handwearIndex=c.handwearIndex,handwear=Number.isInteger(handwearIndex)&&handwearIndex>=0?wardrobe?.[handwearIndex]:null,capId=c.political?.partyCapId||c.campaign?.capGarmentId,cesta=!!c.equipment?.cesta;
    let appearance=this.appearanceCache.get(c),currentPartyCap=null;
    if(capId&&!cesta){
      const cachedCap=appearance?.capId===capId?appearance.partyCap:null,cachedIndex=appearance?.partyCapIndex;
      currentPartyCap=cachedCap&&wardrobe?.[cachedIndex]===cachedCap&&cachedCap.garmentId===capId?cachedCap:wardrobe?.find(item=>item.garmentId===capId)||null;
    }
    const capStillMatches=!capId||appearance?.capId===capId&&(cesta||currentPartyCap===appearance.partyCap&&currentPartyCap?.garmentId===capId);
    if(appearance&&capStillMatches&&appearance.wardrobe===wardrobe&&appearance.wearingIndex===wearingIndex&&appearance.garment===garment&&appearance.garmentPiece===garment?.piece&&appearance.garmentColor===garment?.color&&appearance.printIdValue===garment?.printId&&appearance.patternIdValue===garment?.patternId&&appearance.patternFlagValue===garment?.patternFlag&&appearance.artPrintValue===garment?.artPrint&&appearance.artworkIdValue===garment?.artworkId&&appearance.lowerIndex===lowerIndex&&appearance.lower===lower&&appearance.lowerPiece===lower?.piece&&appearance.lowerColor===lower?.color&&appearance.headwearIndex===headwearIndex&&appearance.headwear===headwear&&appearance.headwearPiece===headwear?.piece&&appearance.headwearColor===headwear?.color&&appearance.footwearIndex===footwearIndex&&appearance.footwear===footwear&&appearance.footwearPiece===footwear?.piece&&appearance.footwearColor===footwear?.color&&appearance.handwearIndex===handwearIndex&&appearance.handwear===handwear&&appearance.handwearPiece===handwear?.piece&&appearance.handwearColor===handwear?.color&&appearance.partyCapPiece===currentPartyCap?.piece&&appearance.partyCapColor===currentPartyCap?.color&&appearance.partyCapNumber===currentPartyCap?.partyNumber&&appearance.partyCapFlag===currentPartyCap?.partyFlag&&appearance.capId===capId&&appearance.cesta===cesta)return appearance;
    const piece=RENDERED_GARMENTS.includes(garment?.piece)?garment.piece:null,hasPatternFlag=!!garment?.patternFlag,printed=PRINTED_GARMENTS.has(piece)||!!garment?.artPrint?.companyLogo||hasPatternFlag,patterned=PATTERNED_GARMENTS.has(piece)&&!garment?.artPrint&&!hasPatternFlag,garmentHex=typeof garment?.color==='number'?`#${garment.color.toString(16).padStart(6,'0')}`:typeof garment?.color==='string'&&/^#[0-9a-f]{6}$/i.test(garment.color)?garment.color:'#8d806e',printId=garment?.printId||TROPICAL_PRINTS[entity.id%TROPICAL_PRINTS.length],garmentMaterial=printed?this.printedMaterial(piece,garmentHex,printId,garment?.artPrint,garment?.patternFlag,garment?.patternId):null,lowerSkirt=SKIRT_PIECES.has(lower?.piece)?lower.piece:null;
    let partyCap=currentPartyCap||null,partyCapIndex=partyCap?wardrobe.indexOf(partyCap):-1;
    const hat=cesta?{piece:'cesta',color:0xb8874f}:partyCap||headwear,items=[hat,footwear,lower,handwear].filter(Boolean);if(partyCap?.partyNumber!=null)items.push({piece:`party-number-${partyCap.partyNumber}`,color:partyCap.partyFlag?.foreground||'#f7f0dc'});
    const colorHex=raw=>typeof raw==='number'?raw:typeof raw==='string'&&/^#[0-9a-f]{6}$/i.test(raw)?parseInt(raw.slice(1),16):0x8d806e;
    appearance={wardrobe,wearingIndex,garment,garmentPiece:garment?.piece,garmentColor:garment?.color,garmentColorHex:colorHex(garmentHex),printIdValue:garment?.printId,patternIdValue:garment?.patternId,patternFlagValue:garment?.patternFlag,artPrintValue:garment?.artPrint,artworkIdValue:garment?.artworkId,lowerIndex,lower,lowerPiece:lower?.piece,lowerColor:lower?.color,headwearIndex,headwear,headwearPiece:headwear?.piece,headwearColor:headwear?.color,footwearIndex,footwear,footwearPiece:footwear?.piece,footwearColor:footwear?.color,handwearIndex,handwear,handwearPiece:handwear?.piece,handwearColor:handwear?.color,capId,cesta,partyCap,partyCapIndex,partyCapPiece:partyCap?.piece,partyCapColor:partyCap?.color,partyCapNumber:partyCap?.partyNumber,partyCapFlag:partyCap?.partyFlag,piece,printed,patterned,garmentHex,printId,garmentMaterial,lowerSkirt,items,itemColorHexes:items.map(item=>colorHex(item?.color))};
    this.appearanceCache.set(c,appearance);return appearance;
  }
  setInstanceMatrix(mesh,index,matrix){
    const attribute=mesh.instanceMatrix,offset=index*16,elements=matrix.elements;
    let changed=false;
    for(let i=0;i<16;i++)if(Math.abs(attribute.array[offset+i]-elements[i])>1e-6){changed=true;break;}
    if(!changed)return;
    mesh.setMatrixAt(index,matrix);mesh.userData.instanceMatrixDirty=true;
    mesh.userData.matrixDirtyMin=Math.min(mesh.userData.matrixDirtyMin??index,index);
    mesh.userData.matrixDirtyMax=Math.max(mesh.userData.matrixDirtyMax??index,index);
  }
  flushInstanceMatrix(mesh){
    if(!mesh.userData.instanceMatrixDirty)return;
    const attribute=mesh.instanceMatrix,min=mesh.userData.matrixDirtyMin,max=mesh.userData.matrixDirtyMax;
    if(typeof attribute.addUpdateRange==='function'&&Number.isFinite(min)&&Number.isFinite(max))attribute.addUpdateRange(min*16,(max-min+1)*16);
    attribute.needsUpdate=true;mesh.userData.instanceMatrixDirty=false;mesh.userData.matrixDirtyMin=null;mesh.userData.matrixDirtyMax=null;
  }
  printedMaterial(piece,baseColor='#ffffff',printId='hibisco',artPrint=null,patternFlag=null,patternId=null){
    const dress=DRESS_PIECES.has(piece);
    if(patternFlag)return this.clothingPatternMaterial(patternFlag,dress,patternId||printId);
    if(artPrint)return this.artworkPrintMaterial(artPrint,dress);
    if(piece==='camisa estampada'||piece==='vestido estampado')return this.tropicalPrintMaterial(dress);
    return this.legacyPrintedMaterial(piece,baseColor,printId);
  }
  clothingPatternMaterial(patternFlag,dress=false,patternKey=null){
    const key=`clothing-pattern:${dress?'dress:':''}${patternKey||patternFlag.patternId||JSON.stringify(patternFlag)}`;
    if(this.printMaterials.has(key))return this.printMaterials.get(key);
    if(typeof document==='undefined'||!this.THREE.CanvasTexture)return this.material;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    let texture;
    const repaint=()=>{drawPartyFlag(ctx,patternFlag,0,0,128,128,()=>{repaint();if(texture)texture.needsUpdate=true;},{border:false});};
    repaint();
    texture=new this.THREE.CanvasTexture(canvas);texture.magFilter=this.THREE.NearestFilter;texture.minFilter=this.THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=this.THREE.SRGBColorSpace;
    const repeat=Math.max(1,Number(patternFlag.tileRepeat)||1);
    if(repeat>1&&this.THREE.RepeatWrapping!=null){texture.wrapS=this.THREE.RepeatWrapping;texture.wrapT=this.THREE.RepeatWrapping;texture.repeat?.set?.(repeat,repeat);}
    const material=(dress?this.enableDressMorph.bind(this):this.enableWeightMorph.bind(this))(new this.THREE.MeshLambertMaterial({color:0xffffff,map:texture,side:this.THREE.DoubleSide}));
    this.decorateMaterial(material);this.printMaterials.set(key,material);return material;
  }
  artworkPrintMaterial(artPrint,dress=false){
    const key=`artwork-print:${dress?'dress:':''}${artPrint.cacheKey||artPrint.artId}`;if(this.printMaterials.has(key))return this.printMaterials.get(key);if(typeof document==='undefined'||!this.THREE.CanvasTexture)return this.material;const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d',{willReadFrequently:!!artPrint.partyFlag}),ink='#352c27',color=/^#[0-9a-f]{6}$/i.test(artPrint.color)?artPrint.color:'#9b5944';ctx.fillStyle=artPrint.companyLogo?.background||'#eee2cc';ctx.fillRect(0,0,128,128);ctx.strokeStyle=ink;ctx.lineWidth=5;ctx.strokeRect(5,5,118,118);
    let texture;if(artPrint.partyFlag||artPrint.companyLogo){const repaint=()=>{drawPartyFlag(ctx,artPrint.partyFlag||artPrint.companyLogo,13,13,102,67,()=>{repaint();if(texture)texture.needsUpdate=true;});};repaint();ctx.fillStyle='#f7f0dc';ctx.fillRect(12,84,104,30);ctx.fillStyle=ink;ctx.font='bold 22px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(artPrint.companyLogo?artPrint.message:artPrint.partyNumber??''),64,99,96);}
    else{ctx.fillStyle=color;ctx.fillRect(21,15,86,65);ctx.fillStyle='rgba(255,255,255,.62)';ctx.beginPath();ctx.arc(64,47,22,0,Math.PI*2);ctx.fill();ctx.fillStyle=color;ctx.beginPath();if(artPrint.kind==='flags'){ctx.moveTo(38,31);ctx.lineTo(52,31);ctx.lineTo(45,52);ctx.closePath();ctx.moveTo(58,31);ctx.lineTo(72,31);ctx.lineTo(65,52);ctx.closePath();ctx.moveTo(78,31);ctx.lineTo(92,31);ctx.lineTo(85,52);ctx.closePath();}else if(['statue','monument'].includes(artPrint.kind)){ctx.rect(45,35,38,26);ctx.arc(64,28,10,0,Math.PI*2);}else{ctx.moveTo(39,57);ctx.lineTo(47,39);ctx.lineTo(56,54);ctx.lineTo(67,29);ctx.lineTo(79,55);ctx.lineTo(89,43);ctx.lineTo(96,59);ctx.closePath();}ctx.fill();ctx.fillStyle=ink;ctx.font='bold 11px sans-serif';ctx.textAlign='center';const words=String(artPrint.message||'ARTE').split(/\s+/);let lines=[],line='';for(const word of words){if(line&&ctx.measureText(`${line} ${word}`).width>112){lines.push(line);line=word;}else line=line?`${line} ${word}`:word;}if(line)lines.push(line);for(let i=0;i<Math.min(3,lines.length);i++)ctx.fillText(lines[i],64,91+i*12,112);}
    texture??=new this.THREE.CanvasTexture(canvas);texture.magFilter=this.THREE.NearestFilter;texture.minFilter=this.THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=this.THREE.SRGBColorSpace;const material=(dress?this.enableDressMorph.bind(this):this.enableWeightMorph.bind(this))(new this.THREE.MeshLambertMaterial({color:0xffffff,map:texture,side:this.THREE.DoubleSide}));this.decorateMaterial(material);this.printMaterials.set(key,material);return material;
  }
  tropicalPrintMaterial(dress=false){
    const cacheKey=dress?'dressPrintAtlasMaterial':'printAtlasMaterial';if(this[cacheKey])return this[cacheKey];
    if(typeof document==='undefined'||!this.THREE.CanvasTexture)return this.material;
    const tileSize=128,canvas=document.createElement('canvas');canvas.width=tileSize*TROPICAL_PRINTS.length;canvas.height=tileSize;
    const ctx=canvas.getContext('2d');
    for(let i=0;i<TROPICAL_PRINTS.length;i++){
      const id=TROPICAL_PRINTS[i],source=this.legacyPrintedMaterial('camisa estampada','#ffffff',id).map.image;
      const tile=document.createElement('canvas');tile.width=tile.height=tileSize;const tileCtx=tile.getContext('2d');tileCtx.drawImage(source,0,0);
      const image=tileCtx.getImageData(0,0,tileSize,tileSize),pixels=image.data;
      for(let p=0;p<pixels.length;p+=4){const alpha=255-Math.min(pixels[p],pixels[p+1],pixels[p+2]);if(alpha<12){pixels[p+3]=0;continue;}pixels[p]=Math.min(255,Math.round(pixels[p]*255/alpha));pixels[p+1]=Math.min(255,Math.round(pixels[p+1]*255/alpha));pixels[p+2]=Math.min(255,Math.round(pixels[p+2]*255/alpha));pixels[p+3]=alpha;}
      tileCtx.putImageData(image,0,0);ctx.drawImage(tile,i*tileSize,0);
    }
    for(const id of TROPICAL_PRINTS){const key=`camisa estampada:#ffffff:${id}`,temporary=this.printMaterials.get(key);if(temporary){temporary.map?.dispose();temporary.dispose();this.printMaterials.delete(key);}}
    const texture=new this.THREE.CanvasTexture(canvas);texture.magFilter=this.THREE.NearestFilter;texture.minFilter=this.THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=this.THREE.SRGBColorSpace;
    const material=(dress?this.enableDressMorph.bind(this):this.enableWeightMorph.bind(this))(new this.THREE.MeshLambertMaterial({color:0xffffff,map:texture,side:this.THREE.DoubleSide})),baseCompile=material.onBeforeCompile,baseCacheKey=material.customProgramCacheKey;
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float instancePattern;\nvarying float vCitizenPattern;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCitizenPattern = instancePattern;');
      baseCompile(shader);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vCitizenPattern;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#ifdef USE_MAP\n  vec2 patternUv = vec2((mod(floor(vCitizenPattern + 0.5), 6.0) + fract(vMapUv.x * 2.0)) / 6.0, fract(vMapUv.y * 2.0));\n  vec4 tropicalPattern = texture2D(map, patternUv);\n  diffuseColor.rgb = mix(diffuseColor.rgb, tropicalPattern.rgb * vColor, tropicalPattern.a);\n#endif');
    };
    material.customProgramCacheKey=()=>`${baseCacheKey()}:citizen-print-atlas-1`;
    this.decorateMaterial(material);this[cacheKey]=material;return material;
  }
  legacyPrintedMaterial(piece,baseColor='#ffffff',printId='hibisco'){
    const baseHex=typeof baseColor==='number'?`#${baseColor.toString(16).padStart(6,'0')}`:typeof baseColor==='string'&&/^#[0-9a-f]{6}$/i.test(baseColor)?baseColor:'#ffffff',patternId=TROPICAL_PRINTS.includes(printId)?printId:'hibisco',key=`${piece}:${baseHex}:${patternId}`;
    if(this.printMaterials.has(key))return this.printMaterials.get(key);
    if(typeof document==='undefined'||!this.THREE.CanvasTexture)return this.material;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),rgb=[1,3,5].map(i=>parseInt(baseHex.slice(i,i+2),16)),luminance=(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)/255,ink=luminance>.5?'#17495c':'#f7edce',leaf=luminance>.5?'#17633f':'#66d99a',leafLight=luminance>.5?'#2e9862':'#a4efb9',coral=luminance>.5?'#cf365f':'#ff7585',sun=luminance>.5?'#efb932':'#ffe26b',lagoon=luminance>.5?'#168a91':'#65e0d3';ctx.fillStyle=baseHex;ctx.fillRect(0,0,128,128);
    const flower=(x,y,r,petal=coral,center=sun)=>{ctx.fillStyle=petal;for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.ellipse(x+Math.cos(a)*r*.64,y+Math.sin(a)*r*.64,r*.38,r*.7,a,0,Math.PI*2);ctx.fill();}ctx.fillStyle=center;ctx.beginPath();ctx.arc(x,y,r*.27,0,Math.PI*2);ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=Math.max(1,r*.1);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+r*.58,y-r*.18);ctx.stroke();ctx.fillStyle=sun;ctx.beginPath();ctx.arc(x+r*.62,y-r*.2,r*.11,0,Math.PI*2);ctx.fill();};
    const tropicalLeaf=(x,y,length,angle,color=leaf)=>{ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(length*.45,-length*.18,length,0);ctx.quadraticCurveTo(length*.48,length*.22,0,0);ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(length*.48,length*.02,length,0);ctx.stroke();ctx.restore();};
    const palm=(x,y,scale=1,angle=0)=>{ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.strokeStyle=leafLight;ctx.lineWidth=3*scale;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(10*scale,-15*scale,2*scale,-48*scale);ctx.stroke();for(let side of [-1,1])for(let i=0;i<5;i++){const t=i/5,px=2*scale+side*t*5*scale,py=-8*scale-t*39*scale;ctx.strokeStyle=i%2?leaf:leafLight;ctx.lineWidth=2*scale;ctx.beginPath();ctx.moveTo(px,py);ctx.quadraticCurveTo(px+side*12*scale,py-3*scale,px+side*25*scale,py+side*5*scale);ctx.stroke();}ctx.restore();};
    const pineapple=(x,y,scale=1)=>{ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle=sun;ctx.beginPath();ctx.ellipse(0,6,11,17,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=2;for(let d=-10;d<=10;d+=8){ctx.beginPath();ctx.moveTo(d,-6);ctx.lineTo(d+8,18);ctx.stroke();}for(let d=-10;d<=10;d+=10){ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(d,-23);ctx.lineTo(4,-9);ctx.fillStyle=leaf;ctx.fill();}ctx.restore();};
    if(piece==='camisa social'){
      ctx.fillStyle='#374052';ctx.beginPath();ctx.moveTo(56,16);ctx.lineTo(72,16);ctx.lineTo(70,34);ctx.lineTo(78,86);ctx.lineTo(64,114);ctx.lineTo(50,86);ctx.lineTo(58,34);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#a8a39a';ctx.lineWidth=6;ctx.strokeRect(90,50,20,24);
    }else if(patternId==='ondas-caribenhas'){
      for(let row=-1;row<6;row++){const y=row*27;for(const [color,phase]of [[lagoon,0],[ink,9],[leafLight,18]]){ctx.strokeStyle=color;ctx.lineWidth=8;ctx.beginPath();for(let x=-8;x<=136;x+=4){const py=y+phase+Math.sin((x+row*11)/18)*8;if(x===-8)ctx.moveTo(x,py);else ctx.lineTo(x,py);}ctx.stroke();}}
      for(const x of [22,86]){ctx.fillStyle=sun;ctx.beginPath();ctx.arc(x,30+(x%3)*14,8,0,Math.PI*2);ctx.fill();}
    }else if(patternId==='palmeiras'){
      palm(28,60,.82,-.14);palm(95,127,.9,Math.PI);palm(112,31,.62,.65);tropicalLeaf(13,105,34,-.35,leaf);tropicalLeaf(66,67,30,.5,leafLight);
    }else if(patternId==='folhagem'){
      for(let row=0;row<3;row++)for(let col=0;col<3;col++){const x=col*54+12+(row%2)*20,y=row*52+12;tropicalLeaf(x,y,37,-.65+(col%2)*.5,(row+col)%2?leaf:leafLight);tropicalLeaf(x+15,y+17,32,.7,leaf);ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+22,y-15);ctx.stroke();if((row+col)%2===0){ctx.fillStyle=coral;ctx.beginPath();ctx.arc(x+28,y+25,4,0,Math.PI*2);ctx.fill();}}
    }else if(patternId==='frutas-tropicais'){
      pineapple(30,40,.92);pineapple(99,108,.76);for(const [x,y,scale]of [[91,38,.8],[37,104,.75],[99,72,.56]]){ctx.fillStyle=coral;ctx.beginPath();ctx.ellipse(x,y,12*scale,18*scale,-.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-13*scale);ctx.quadraticCurveTo(x+9*scale,y-26*scale,x+17*scale,y-20*scale);ctx.stroke();tropicalLeaf(x+5*scale,y-16*scale,15*scale,-.5,leafLight);}
    }else if(patternId==='flores-miudas'){
      for(let y=12,row=0;y<136;y+=30,row++)for(let x=10+(row%2)*15;x<136;x+=30){flower(x,y,8,(row%2)?coral:sun,(x+y)%2?ink:leafLight);tropicalLeaf(x+7,y+12,13,.7,leaf);}
    }else{
      for(let y=24,row=0;y<152;y+=64,row++)for(let x=28+(row%2)*37;x<152;x+=72){flower(x,y,22,coral,sun);tropicalLeaf(x-28,y+22,29,-.8,leaf);tropicalLeaf(x+27,y+24,25,.55,leafLight);}
    }
    const texture=new this.THREE.CanvasTexture(canvas);texture.wrapS=this.THREE.ClampToEdgeWrapping;texture.wrapT=this.THREE.ClampToEdgeWrapping;texture.magFilter=this.THREE.NearestFilter;texture.minFilter=this.THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=this.THREE.SRGBColorSpace;
    const material=this.enableWeightMorph(new this.THREE.MeshLambertMaterial({color:0xffffff,map:texture,side:this.THREE.DoubleSide}));this.decorateMaterial(material);this.printMaterials.set(key,material);return material;
  }
  async load(){
    if(!this.fetchAsset)throw Error('Carregamento de OBJ indisponível');
    const entries=await Promise.all(Object.entries(CITIZEN_MODEL_FRAMES).flatMap(([clip,frames])=>frames.map(async frame=>{
      const response=await this.fetchAsset(new URL(`${clip}/${frame}.obj`,this.baseURL));if(!response.ok)throw Error(`Falha em ${clip}/${frame}.obj (${response.status})`);
      return {key:`${clip}:${frame}`,data:parseCitizenOBJ(await response.text())};
    })));
    // All cleaned exports preserve the anatomical face order. One face set per
    // garment follows the chest, thighs, hands and feet through every pose.
    for(const {key,data} of entries)if(data.triangles!==CITIZEN_BODY_FACE_COUNT)throw Error(`Topologia de roupa incompatível em ${key}: ${data.triangles} faces`);
    const masks=Object.fromEntries(RENDERED_GARMENTS.map(piece=>[piece,garmentSurface(CITIZEN_BODY_FACE_COUNT,piece)]));
    const idleIdx=entries.findIndex(e=>e.key==='idle:0');if(idleIdx>0){const [idleEntry]=entries.splice(idleIdx,1);entries.unshift(idleEntry);}
    const idle=entries[0].data.bounds,height=idle.max[1]-idle.min[1];if(!(height>0))throw Error('Modelo sem altura');
    const origin=[(idle.min[0]+idle.max[0])/2,Math.min(...entries.map(e=>e.data.bounds.min[1])),(idle.min[2]+idle.max[2])/2],factor=1.05/height;
    let idleBodyPos=null;
    const attachCanonicalBodyPos=(geometry,pos,ref=null)=>{const src=ref&&ref.length===pos.length?ref:pos;geometry.setAttribute('citizenBodyPos',new this.THREE.Float32BufferAttribute(src,3));return geometry;};
    const attachElevatedBodyPos=(geometry,yShift=0.92)=>{const pos=geometry.attributes.position.array,elev=new Float32Array(pos.length);elev.set(pos);for(let i=1;i<elev.length;i+=3)elev[i]+=yShift;geometry.setAttribute('citizenBodyPos',new this.THREE.Float32BufferAttribute(elev,3));return geometry;};
    for(const {key,data}of entries){const positions=data.positions;for(let i=0;i<positions.length;i++)positions[i]=(positions[i]-origin[i%3])*factor;
      if(key==='idle:0')idleBodyPos=new Float32Array(positions);
      const morphVertex=createPoseWeightMorph(data);
      const attachment=citizenHeadAttachment(data);
      const attachPt=attachment.position;
      let bestDist=Infinity,bestDelta=[0,0,0];
      for(let i=0;i<positions.length;i+=3){const dx=positions[i]-attachPt.x,dy=positions[i+1]-attachPt.y,dz=positions[i+2]-attachPt.z,d2=dx*dx+dy*dy+dz*dz;if(d2<bestDist){bestDist=d2;bestDelta=morphVertex([positions[i],positions[i+1],positions[i+2]]);}}
      attachment.morphDelta=bestDelta;
      this.headAttachments.set(key,attachment);
      data.normals=smoothCitizenNormals(positions,data.normals).normals;
      const attachWeightMorph=(geometry,pos,norm)=>{
        const attrs=computeWeightMorphAttributes(pos,morphVertex);
        const smoothed=smoothCitizenNormals(pos,norm,[attrs.weightNormalLinear,attrs.weightNormalQuadratic]);
        geometry.setAttribute('weightMorph',new this.THREE.Float32BufferAttribute(attrs.weightMorph,3));
        geometry.setAttribute('weightNormalLinear',new this.THREE.Float32BufferAttribute(smoothed.derivatives[0],3));
        geometry.setAttribute('weightNormalQuadratic',new this.THREE.Float32BufferAttribute(smoothed.derivatives[1],3));
      };
      const geometry=new this.THREE.BufferGeometry();geometry.setAttribute('position',new this.THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new this.THREE.Float32BufferAttribute(data.normals,3));attachCanonicalBodyPos(geometry,positions,idleBodyPos);attachWeightMorph(geometry,positions,data.normals);geometry.computeBoundingSphere();this.frames.set(key,geometry);
      const skirtCuts={};
      for(const piece of ['saia','saia longa']){
        const surface=fittedSkirtSurface(data,piece,morphVertex),mask=surface.bodyMask,parts=splitGarmentSurface(data,mask,piece);
        const smooth=smoothCitizenNormals(surface.positions,surface.normals,[surface.normalLinear,surface.normalQuadratic]);
        surface.normals=smooth.normals;[surface.normalLinear,surface.normalQuadratic]=smooth.derivatives;
        parts.clothes=surface.positions;parts.clothesNormals=surface.normals;skirtCuts[piece]={mask,parts,surface};
      }
      const dressSkirt=skirtCuts.saia.surface,dressMask=new Uint8Array(CITIZEN_BODY_FACE_COUNT),dressTopMask=new Uint8Array(CITIZEN_BODY_FACE_COUNT);
      for(let i=0;i<dressMask.length;i++){dressMask[i]=Number(Boolean(masks.camisa[i]||dressSkirt.bodyMask[i]));dressTopMask[i]=Number(Boolean(masks.camisa[i]&&!dressSkirt.bodyMask[i]));}
      const dressBody=splitGarmentSurface(data,dressMask),dressTop=splitGarmentSurface(data,dressTopMask),dressPositions=new Float32Array(dressTop.clothes.length+dressSkirt.positions.length),dressNormals=new Float32Array(dressPositions.length),dressWeightMorph=new Float32Array(dressPositions.length),dressWeightNormalLinear=new Float32Array(dressPositions.length),dressWeightNormalQuadratic=new Float32Array(dressPositions.length),dressMorph=new Float32Array(dressPositions.length),dressNormalLinear=new Float32Array(dressPositions.length),dressNormalQuadratic=new Float32Array(dressPositions.length);
      dressPositions.set(dressTop.clothes);dressPositions.set(dressSkirt.positions,dressTop.clothes.length);dressNormals.set(dressTop.clothesNormals);dressNormals.set(dressSkirt.normals,dressTop.clothesNormals.length);
      const dressTopMorph=computeWeightMorphAttributes(dressTop.clothes,morphVertex);
      const dressTopSmooth=smoothCitizenNormals(dressTop.clothes,dressTop.clothesNormals,[dressTopMorph.weightNormalLinear,dressTopMorph.weightNormalQuadratic]);
      dressWeightMorph.set(dressTopMorph.weightMorph);dressWeightNormalLinear.set(dressTopSmooth.derivatives[0]);dressWeightNormalQuadratic.set(dressTopSmooth.derivatives[1]);
      dressMorph.set(dressTopMorph.weightMorph);dressNormalLinear.set(dressTopSmooth.derivatives[0]);dressNormalQuadratic.set(dressTopSmooth.derivatives[1]);
      dressMorph.set(dressSkirt.morphDeltas,dressTop.clothes.length);dressNormalLinear.set(dressSkirt.normalLinear,dressTop.clothes.length);dressNormalQuadratic.set(dressSkirt.normalQuadratic,dressTop.clothes.length);
      const dressAttrs={weightMorph:dressWeightMorph,weightNormalLinear:dressWeightNormalLinear,weightNormalQuadratic:dressWeightNormalQuadratic,skirtMorph:dressMorph,skirtNormalLinear:dressNormalLinear,skirtNormalQuadratic:dressNormalQuadratic};
      for(const piece of RENDERED_GARMENTS){
        let parts;
        if(piece==='saia'||piece==='saia longa')parts=skirtCuts[piece].parts;
        else if(DRESS_PIECES.has(piece))parts={body:dressBody.body,bodyNormals:dressBody.bodyNormals,clothes:dressPositions,clothesNormals:dressNormals};
        else parts=splitGarmentSurface(data,masks[piece],piece);
        const idleOutfit=key==='idle:0'?null:this.outfits.get(`idle:0:${piece}`);
        const make=(positions,normals,withUV=false,hideBack=false,attributes=null,skipWeightMorph=false,refPositions=null)=>{const g=new this.THREE.BufferGeometry();g.setAttribute('position',new this.THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new this.THREE.Float32BufferAttribute(normals,3));attachCanonicalBodyPos(g,positions,refPositions);if(withUV){let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(let v=0;v<positions.length;v+=3){minX=Math.min(minX,positions[v]);maxX=Math.max(maxX,positions[v]);minY=Math.min(minY,positions[v+1]);maxY=Math.max(maxY,positions[v+1]);}const width=Math.max(.001,maxX-minX),height=Math.max(.001,maxY-minY),uv=new Float32Array(positions.length/3*2);for(let v=0,j=0;v<positions.length;v+=3){uv[j++]=hideBack&&normals[v+2]<-.25?2:(positions[v]-minX)/width;uv[j++]=(positions[v+1]-minY)/height;}g.setAttribute('uv',new this.THREE.Float32BufferAttribute(uv,2));}if(attributes)for(const [name,array]of Object.entries(attributes))g.setAttribute(name,new this.THREE.Float32BufferAttribute(array,3));else if(!skipWeightMorph)attachWeightMorph(g,positions,normals);g.computeBoundingSphere();return g;};
        const printed=PRINTED_GARMENTS.has(piece);
        const garmentMaterial=printed?this.printedMaterial(piece):DRESS_PIECES.has(piece)?this.dressMaterial:SKIRT_PIECES.has(piece)?this.skirtMaterial:this.material;
        const outfit={body:make(parts.body,parts.bodyNormals,false,false,null,false,idleOutfit?.body?.attributes?.position?.array),clothes:make(parts.clothes,parts.clothesNormals,printed||piece==='macacão',piece==='camisa social',DRESS_PIECES.has(piece)?dressAttrs:null,SKIRT_PIECES.has(piece),idleOutfit?.clothes?.attributes?.position?.array),material:garmentMaterial};
        if(SKIRT_PIECES.has(piece)){
          const surface=skirtCuts[piece].surface;
          outfit.clothes.setAttribute('skirtMorph',new this.THREE.Float32BufferAttribute(surface.morphDeltas,3));
          outfit.clothes.setAttribute('skirtNormalLinear',new this.THREE.Float32BufferAttribute(surface.normalLinear,3));
          outfit.clothes.setAttribute('skirtNormalQuadratic',new this.THREE.Float32BufferAttribute(surface.normalQuadratic,3));
        }
        if(['camisa','camisa social','camisa estampada','camiseta','regata','terno','casaco','trapos'].includes(piece))for(const skirtPiece of SKIRT_PIECES){
          const union=new Uint8Array(skirtCuts[skirtPiece].mask.length),tucked=new Uint8Array(union.length),upperMask=masks[piece];
          for(let i=0;i<union.length;i++){union[i]=Number(skirtCuts[skirtPiece].mask[i]||upperMask[i]);tucked[i]=Number(upperMask[i]&&!skirtCuts[skirtPiece].mask[i]);}
          const combined=splitGarmentSurface(data,union,piece);outfit[skirtPiece==='saia'?'bodyWithSaia':'bodyWithSaiaLonga']=make(combined.body,combined.bodyNormals,false,false,null,false,idleOutfit?.[skirtPiece==='saia'?'bodyWithSaia':'bodyWithSaiaLonga']?.attributes?.position?.array);
          const top=splitGarmentSurface(data,tucked,piece);outfit[skirtPiece==='saia'?'clothesWithSaia':'clothesWithSaiaLonga']=make(top.clothes,top.clothesNormals,printed,piece==='camisa social',null,false,idleOutfit?.[skirtPiece==='saia'?'clothesWithSaia':'clothesWithSaiaLonga']?.attributes?.position?.array);
        }
        this.outfits.set(`${key}:${piece}`,outfit);
        if(LOWER_PIECES.has(piece)||HAND_PIECES.has(piece))this.headwear.set(`${key}:${piece}`,outfit.clothes);
      }
      for(const piece of HEADWEAR_PIECES){const part=headwearSurface(data,piece),anchorKey=`${key}:${piece}`;this.headwearAnchors.set(anchorKey,part.anchor);if(!this.headwear.has(`static:${piece}`)){const g=new this.THREE.BufferGeometry();g.setAttribute('position',new this.THREE.Float32BufferAttribute(part.positions,3));g.setAttribute('normal',new this.THREE.Float32BufferAttribute(part.normals,3));attachElevatedBodyPos(g,0.92);g.computeBoundingSphere();this.headwear.set(`static:${piece}`,g);}}
      if(key.startsWith('carregar:')||key.startsWith('carregar_parado:')){this.carryAnchors.set(key,carryBoxAnchor(data));if(!this.headwear.has('static:carry-box'))this.headwear.set('static:carry-box',attachElevatedBodyPos(carryBoxGeometry(this.THREE),0.55));}
      const toolKind=TOOL_CLIPS[key.split(':')[0]];
      if(toolKind){this.carryAnchors.set(key,toolAnchor(data,toolKind));if(!this.headwear.has(`static:tool:${toolKind}`))this.headwear.set(`static:tool:${toolKind}`,attachElevatedBodyPos(toolPropGeometry(this.THREE,toolKind),0.55));}
    }
    this.ready=true;return true;
  }
  citizenDirtVisual(c,garmentDirt=0){
    const hygieneDirt=Math.max(0,100-(c?.needs?.hygiene??100)),sources=c?.dirtSources;
    let topKind=null,topAmount=0,sourceTotal=0;
    if(sources)for(const [kind,val]of Object.entries(sources)){const n=val||0;sourceTotal+=n;if(n>topAmount){topAmount=n;topKind=kind;}}
    const level=Math.min(100,Math.max(garmentDirt||0,hygieneDirt*.85,sourceTotal));
    const hex=topKind?(topKind==='tinta'?(c.dirtTintColor??this.dirtPalette.tinta):(this.dirtPalette[topKind]??0x62584b)):0x62584b;
    return {level,hex};
  }
  begin(dt=0,speed=1,simTick=null){this.frameToken++;this.animationPaused=speed<=0;this.frameDelta=Math.max(0,Math.min(.1,dt));this.clock+=this.frameDelta*Math.max(0,Math.min(2,speed));this.campaignFlagTime=Number.isFinite(simTick)?Math.floor(simTick/20)*.1:Math.floor(this.clock*3)/10;this.activeCampaignFlags.clear();this.flyCount=0;if(this.flyMesh)this.flyMesh.count=0;this.swimFoamCount=0;if(this.swimFoamMesh)this.swimFoamMesh.count=0;for(const batch of this.activeBatches){batch.count=0;if(batch.mesh)batch.mesh.count=0;if(batch.clothingMesh)batch.clothingMesh.count=0;}this.activeBatches.clear();for(const batch of this.activeHeadwearBatches){batch.count=0;if(batch.mesh)batch.mesh.count=0;}this.activeHeadwearBatches.clear();}
  add(entity,surfaceH,{hidden=false,dimmed=false,perspective=false,smoothMovement=false,vehicleAngle=null,visualOffset=null,indoorBounds=null,activeCampaignElectionId=null,activeCampaignStatus=null,inWater=undefined,waterSurfaceY=null,outline=null}={}){
    if(!this.ready)return false;
    const c=entity.properties.citizen;if(!c)return false;
    if(hidden)return true;
    const inside=c.ridingVehicleId?null:c._renderIndoorPosition||c.indoorLocation?.position,posePoint=!citizenHasPath(c)&&!c.indoorLocation?.path?.length&&(c.furnitureUse?.pose==='lying'||c.furnitureUse?.seated)?c.furnitureUse.posePoint:null;
    let x=posePoint?.x??inside?.x??entity.x,y=posePoint?.y??inside?.y??entity.y;const bodyShape=this.bodyShapeFor(c);
    // Large body morphs can cross the exterior wall when an indoor route
    // passes close to a window. Keep the rendered body inside the shell while
    // moving as well as while stationary; simulation coordinates stay intact.
    if(inside&&indoorBounds&&!c.indoorLocation?.exiting){
      const desiredMargin=Math.min(.47,.28+Math.max(0,bodyShape.fat)*.105);
      if(bodyShape.fat>.35){
        const marginX=Math.min(desiredMargin,Math.max(0,(indoorBounds.maxX-indoorBounds.minX)/2-.02));
        const marginY=Math.min(desiredMargin,Math.max(0,(indoorBounds.maxY-indoorBounds.minY)/2-.02));
        const minX=indoorBounds.minX+marginX,maxX=indoorBounds.maxX-marginX,minY=indoorBounds.minY+marginY,maxY=indoorBounds.maxY-marginY;
        x=Math.max(minX,Math.min(maxX,x));y=Math.max(minY,Math.min(maxY,y));
      }
    }
    let motion=this.motion.get(entity);
     if(!motion){motion={x,y,renderX:x,renderY:y,angle:0,renderAngle:0,walkDistance:0,walkFrame:0};this.motion.set(entity,motion);}
    const dx=x-motion.x,dy=y-motion.y;
    const moved=dx*dx+dy*dy>1e-7;
     if(moved){motion.angle=Math.atan2(dx,dy);if(!this.animationPaused)motion.walkDistance+=Math.hypot(dx,dy);motion.x=x;motion.y=y;}
    if(c.ridingVehicleId&&Number.isFinite(vehicleAngle))motion.angle=vehicleAngle+(c.ridingAsPassenger?Math.PI/2:0);
    if(!citizenHasPath(c)&&!c.indoorLocation?.path?.length&&c.facingTarget)motion.angle=Math.atan2(c.facingTarget.x-x,c.facingTarget.y-y);
    if(c.fishingPose)motion.angle=Math.atan2(c.fishingPose.water.x-x,c.fishingPose.water.y-y);
    let renderX=x,renderY=y,renderAngle=motion.angle;
    // Vehicle entities already receive bridge interpolation; smoothing riders
    // a second time leaves them visibly trailing their vehicle.
    if(smoothMovement&&!c.ridingVehicleId){
      const alpha=1-Math.exp(-Math.max(0.001,this.frameDelta||0.016)*14);
      motion.renderX+=(x-motion.renderX)*alpha;motion.renderY+=(y-motion.renderY)*alpha;
      const angleDelta=Math.atan2(Math.sin(motion.angle-motion.renderAngle),Math.cos(motion.angle-motion.renderAngle));
      motion.renderAngle+=angleDelta*alpha;
      renderX=motion.renderX;renderY=motion.renderY;renderAngle=motion.renderAngle;
    }else{motion.renderX=x;motion.renderY=y;motion.renderAngle=motion.angle;}
    if(visualOffset){renderX+=visualOffset.x;renderY+=visualOffset.y;}
    if((c.furnitureUse?.type==='bench'||c.furnitureUse?.type==='beach_chair')&&c.furnitureUse.seated){renderX+=Math.sin(renderAngle)*.16;renderY+=Math.cos(renderAngle)*.16;}
    // Match gait to the distance displayed, including high-speed interpolation.
    if(moved)advanceCitizenGait(motion,this.animationPaused);
    // Keep the travel pose for the full route, including frames between
    // simulation movement updates. A sit task can be assigned before arrival.
    // Once a seat is confirmed, stale delivery/mobility flags must not turn
    // the seated body back into the walking one at the seat anchor.
    const settledFurniture=!!c.furnitureUse?.seated||c.furnitureUse?.pose==='lying';
    const traveling=citizenHasPath(c)||!!c.indoorLocation?.path?.length||!settledFurniture&&(moved||!!c.deliveryId||!!c.mobilityTrip&&c.mobilityTrip.stage!=='boarding');
    const sleeping=citizenIsSleeping(c),lying=!sleeping&&!traveling&&c.furnitureUse?.pose==='lying',clip=citizenAnimation(c,traveling,inWater),actionState=clip==='murro'||clip==='chute'||clip==='derrotado',actionToken=c.combatAnimation?.sequence??c.combatReaction?.sequence??c.unconsciousUntil??null;
    // The seated OBJ pose puts the legs in the same vertical bands used by
    // the standing-body fat mask. Cap its morph so those vertices do not
    // balloon sideways while sitting; standing citizens retain the full shape.
    const poseBodyShape=clip==='sentado_no_banco'&&bodyShape.fat>.9?{...bodyShape,fat:.9}:bodyShape;
    if(actionState){const token=`${clip}:${actionToken??''}`;if(motion.actionToken!==token){motion.actionToken=token;motion.actionStartedAt=this.clock;}}
    else motion.actionToken=null;
    const animationTime=(clip==='run'||clip==='caminhar'||clip==='andar_lento'||clip==='pedal'||clip.endsWith('_andar'))?motion.walkFrame/8:actionState?this.clock-(motion.actionStartedAt??this.clock):this.clock,pose=citizenFrame(clip,animationTime,actionState?0:(entity.id*13)%17,actionState),key=`${pose.clip}:${pose.frame}`;
    if(c.climbing){motion.angle=Math.atan2(c.climbing.facingX-x,c.climbing.facingY-y);renderAngle=motion.angle;}
    else if(!traveling&&!sleeping&&c.facingTarget)motion.angle=Math.atan2(c.facingTarget.x-x,c.facingTarget.y-y);
    const appearance=this.appearanceFor(c,entity),{piece,printed,patterned,garment,garmentHex,garmentColorHex,printId,garmentMaterial,lower,lowerSkirt,itemColorHexes}=appearance;
    let poseBatch=motion.poseBatches?.get(key);if(!poseBatch){poseBatch=new Map();motion.poseBatches??=new Map();motion.poseBatches.set(key,poseBatch);}
    let resolved=poseBatch.get(appearance);if(!resolved){const outfitKey=piece?`${key}:${piece}`:null,outfit=outfitKey?this.outfits.get(outfitKey):null,skirtOutfit=lowerSkirt?this.outfits.get(`${key}:${lowerSkirt}`):null,bodyWithSkirt=lowerSkirt?outfit?.[lowerSkirt==='saia'?'bodyWithSaia':'bodyWithSaiaLonga']:null,bodySource=bodyWithSkirt||skirtOutfit?.body||outfit?.body||this.frames.get(key),clothingSource=(lowerSkirt?outfit?.[lowerSkirt==='saia'?'clothesWithSaia':'clothesWithSaiaLonga']:null)||outfit?.clothes,combine=!!(outfit&&COMBINABLE_GARMENTS.has(piece)&&!printed&&!lowerSkirt&&this.THREE.InstancedBufferAttribute),combinedSource=combine?this.combinedCitizenSurface(bodySource,clothingSource):null,batchKey=`${piece?`${key}:${piece}:${garmentMaterial?.uuid||'shared'}${lowerSkirt?`+${lowerSkirt}`:''}`:lowerSkirt?`${key}:lower:${lowerSkirt}`:key}${combine?':combined':''}`;resolved={batchKey,outfit,bodySource,clothingSource,combinedSource};poseBatch.set(appearance,resolved);}
    const {batchKey,outfit,bodySource,clothingSource,combinedSource}=resolved;
    let batch=this.batches.get(batchKey);if(!batch){batch={count:0,capacity:0,mesh:null,clothingMesh:null,combined:!!combinedSource};this.batches.set(batchKey,batch);}this.activeBatches.add(batch);
    if(batch.count===batch.capacity){
      // Citizen bodies are already rendered in shared animation/outfit batches.
      // Let the sun light them, but keep hundreds of moving low-poly bodies out
      // of the directional shadow-map pass on mobile GPUs.
      const capacity=Math.max(32,batch.capacity*2),mesh=new this.THREE.InstancedMesh(this.instancedGeometry(combinedSource||bodySource,capacity),combinedSource?this.combinedMaterial:this.material,capacity);mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;
      if(batch.mesh){for(let i=0;i<batch.count;i++){batch.mesh.getMatrixAt(i,this.matrix);mesh.setMatrixAt(i,this.matrix);batch.mesh.getColorAt(i,this.color);this.setInstanceColor(mesh,i,this.color);const oldFat=batch.mesh.geometry.attributes.instanceFat,newFat=mesh.geometry.attributes.instanceFat;if(oldFat&&newFat){newFat.array[i]=oldFat.array[i];mesh.userData.instanceFatDirty=true;}const oldPattern=batch.mesh.geometry.attributes.instancePattern,newPattern=mesh.geometry.attributes.instancePattern;if(oldPattern&&newPattern){newPattern.array[i]=oldPattern.array[i];mesh.userData.instancePatternDirty=true;}const oldGarment=batch.mesh.geometry.attributes.instanceGarmentColor,newGarment=mesh.geometry.attributes.instanceGarmentColor;if(oldGarment&&newGarment){newGarment.array.set(oldGarment.array.subarray(i*3,i*3+3),i*3);mesh.userData.instanceGarmentColorDirty=true;}}if(batch.count){mesh.userData.instanceMatrixDirty=true;mesh.userData.matrixDirtyMin=0;mesh.userData.matrixDirtyMax=batch.count-1;}this.group.remove(batch.mesh);batch.mesh.dispose();}
      this.group.add(mesh);batch.mesh=mesh;
      if(outfit&&!combinedSource){const clothing=new this.THREE.InstancedMesh(this.instancedGeometry(clothingSource,capacity),garmentMaterial||outfit.material||this.material,capacity);clothing.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);clothing.frustumCulled=false;clothing.castShadow=false;clothing.receiveShadow=false;
        if(batch.clothingMesh){for(let i=0;i<batch.count;i++){batch.clothingMesh.getMatrixAt(i,this.matrix);clothing.setMatrixAt(i,this.matrix);batch.clothingMesh.getColorAt(i,this.color);this.setInstanceColor(clothing,i,this.color);const oldFat=batch.clothingMesh.geometry.attributes.instanceFat,newFat=clothing.geometry.attributes.instanceFat;if(oldFat&&newFat){newFat.array[i]=oldFat.array[i];clothing.userData.instanceFatDirty=true;}const oldPattern=batch.clothingMesh.geometry.attributes.instancePattern,newPattern=clothing.geometry.attributes.instancePattern;if(oldPattern&&newPattern){newPattern.array[i]=oldPattern.array[i];clothing.userData.instancePatternDirty=true;}}if(batch.count){clothing.userData.instanceMatrixDirty=true;clothing.userData.matrixDirtyMin=0;clothing.userData.matrixDirtyMax=batch.count-1;}this.group.remove(batch.clothingMesh);batch.clothingMesh.dispose();}
        this.group.add(clothing);batch.clothingMesh=clothing;
      }batch.capacity=capacity;
    }
    const bikeRider=c.ridingVehicleId&&BIKE_KINDS.has(c.ridingVehicleKind),riderLift=bikeRider?(c.ridingAsPassenger?0.23:0.38):c.ridingVehicleId?0.18:0;
    const size=(entity.properties.render.size||1)*(perspective?1.05:1),heightScale=(c.bodyHeightCm||170)/170,baseSurfaceH=waterSurfaceY!=null&&(clip==='nadar'||clip==='boiar')?(clip==='boiar'?waterSurfaceY-0.77*size*heightScale:waterSurfaceY-0.32*size):surfaceH,positionY=baseSurfaceH+(posePoint?.z??inside?.z??0)+riderLift,bodyIndex=batch.count;
    const transformUnchanged=motion.bodyBatch===batch&&motion.bodyMesh===batch.mesh&&motion.clothingMesh===batch.clothingMesh&&motion.bodyIndex===bodyIndex&&motion.bodyFrame===this.frameToken-1&&motion.bodyX===renderX&&motion.bodyY===positionY&&motion.bodyZ===renderY&&motion.bodyAngle===renderAngle&&motion.bodySize===size&&motion.bodyHeightScale===heightScale&&motion.bodyLying===lying;
    this.position.set(renderX,positionY,renderY);
    // Accessory meshes can change batch/index even while the body keeps its
    // previous instance transform. Rebuild this citizen's matrix before an
    // accessory uses it; otherwise it inherits the matrix left by the prior
    // citizen added to the batch.
    let matrixReady=false;
    if(!transformUnchanged){this.quaternion.setFromAxisAngle(this.axis,renderAngle);if(lying)this.quaternion.multiply(this.lyingRotation);this.scale.set(size,size*heightScale,size);this.matrix.compose(this.position,this.quaternion,this.scale);this.setInstanceMatrix(batch.mesh,bodyIndex,this.matrix);motion.bodyBatch=batch;motion.bodyMesh=batch.mesh;motion.clothingMesh=batch.clothingMesh;motion.bodyIndex=bodyIndex;motion.bodyX=renderX;motion.bodyY=positionY;motion.bodyZ=renderY;motion.bodyAngle=renderAngle;motion.bodySize=size;motion.bodyHeightScale=heightScale;motion.bodyLying=lying;matrixReady=true;}
    motion.bodyFrame=this.frameToken;
    if(!transformUnchanged||motion.bodyFatToken!==poseBodyShape.fat){this.setInstanceFat(batch.mesh,bodyIndex,poseBodyShape);motion.bodyFatToken=poseBodyShape.fat;}
    const presence=c.campaignPresence?.electionId===activeCampaignElectionId&&activeCampaignStatus==='campaign'?c.campaignPresence:null;
    const flag=c.campaign?.partyFlag||c.campaign?.flag||presence?.partyFlag;
    if(flag&&!c.ridingVehicleId&&!c.mobilityTrip&&!c.deliveryId){
      const flagKey=JSON.stringify(flag);let carrier=this.campaignFlags.get(entity.id);
      if(!carrier||carrier.flagKey!==flagKey){if(carrier){this.group.remove(carrier.group);carrier.group.traverse(o=>{o.geometry?.dispose();if(o.material!==carrier.material)o.material?.dispose();});}let material=this.campaignFlagMaterials.get(flagKey);if(!material){let texture;const canvas=partyFlagCanvas(flag,()=>{if(texture)texture.needsUpdate=true;});texture=new this.THREE.CanvasTexture(canvas);texture.magFilter=this.THREE.NearestFilter;texture.minFilter=this.THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=this.THREE.SRGBColorSpace;material=new this.THREE.MeshLambertMaterial({map:texture,side:this.THREE.DoubleSide});this.campaignFlagMaterials.set(flagKey,material);}const group=createHeadFlag(this.THREE,material);this.group.add(group);carrier={group,material,flagKey};this.campaignFlags.set(entity.id,carrier);}
      if(!matrixReady){this.quaternion.setFromAxisAngle(this.axis,renderAngle);if(lying)this.quaternion.multiply(this.lyingRotation);this.scale.set(size,size*heightScale,size);this.matrix.compose(this.position,this.quaternion,this.scale);matrixReady=true;}
      const attachment=this.headAttachments.get(key),point=attachment.position,normal=attachment.normal,delta=attachment.morphDelta||citizenVertexWeightDelta([point.x,point.y,point.z]),mount=carrier.group.userData.mount;
      mount.position.set(point.x+poseBodyShape.fat*delta[0],point.y+poseBodyShape.fat*delta[1],point.z+poseBodyShape.fat*delta[2]);this.headFlagNormal.copy(normal).normalize();mount.quaternion.setFromUnitVectors(this.axis,this.headFlagNormal);
      carrier.group.matrix.copy(this.matrix);carrier.group.matrixWorldNeedsUpdate=true;
      animateClothFlag(carrier.group.userData.cloth,this.campaignFlagTime??Math.floor(this.clock*3)/10,(entity.id%19)*.31);this.activeCampaignFlags.add(entity.id);
    }
    const dz=c.dirtZones,zoneToken=dz?`${Math.round(dz.feet||0)}:${Math.round(dz.legs||0)}:${Math.round(dz.arms||0)}:${Math.round(dz.head||0)}:${Math.round(dz.seat||0)}:${Math.round(dz.back||0)}:${Math.round(dz.side||0)}:${Math.round(dz.torso||0)}`:'';
    const combatFlash=entity.combatFlash>0,garmentDirt=garment?.dirt||0,dirtVisual=this.citizenDirtVisual(c,garmentDirt),dirtMix=dirtVisual.level>22?Math.min(.68,(dirtVisual.level-22)/145):0,dirtToken=`${Math.round(dirtVisual.level)}:${dirtVisual.hex}:${zoneToken}`,dirtLevel01=dirtVisual.level>22?Math.min(1,(dirtVisual.level-22)/78):0;
    const bodyColorToken=combatFlash?'flash':dimmed?'dim':`${entity.properties.render.color??0xe8e8e8}:${dirtToken}`;
    if(!transformUnchanged||motion.bodyColorToken!==bodyColorToken){this.color.setHex(combatFlash?0xff3333:dimmed?0x555555:entity.properties.render.color??0xe8e8e8);this.setInstanceColor(batch.mesh,batch.count,this.color);this.activeDirtColor.setHex(dirtVisual.hex);this.setInstanceDirt(batch.mesh,batch.count,this.activeDirtColor,dimmed||combatFlash?0:dirtLevel01,dz);motion.bodyColorToken=bodyColorToken;}
    const presenceColor=presence?.color,clothingColorUnchanged=transformUnchanged&&motion.clothingColorAppearance===appearance&&motion.clothingColorDirt===dirtToken&&motion.clothingColorCombat===combatFlash&&motion.clothingColorDimmed===dimmed&&motion.clothingColorPresence===presenceColor;
    if(batch.clothingMesh){if(!transformUnchanged)this.setInstanceMatrix(batch.clothingMesh,bodyIndex,this.matrix);if(!transformUnchanged||motion.clothingFatToken!==poseBodyShape.fat){this.setInstanceFat(batch.clothingMesh,bodyIndex,poseBodyShape);motion.clothingFatToken=poseBodyShape.fat;}if(patterned&&(!transformUnchanged||motion.bodyPatternToken!==printId)){this.setInstancePattern(batch.clothingMesh,bodyIndex,printId);motion.bodyPatternToken=printId;}if(!clothingColorUnchanged){this.color.setHex(combatFlash?0xff3333:dimmed?0x555555:patterned?garmentColorHex:printed?0xffffff:presenceColor?Number.parseInt(String(presenceColor).replace('#',''),16):garmentColorHex);this.setInstanceColor(batch.clothingMesh,bodyIndex,this.color);this.activeDirtColor.setHex(dirtVisual.hex);this.setInstanceDirt(batch.clothingMesh,bodyIndex,this.activeDirtColor,dimmed||combatFlash?0:dirtLevel01,dz);}}
    else if(batch.combined&&!clothingColorUnchanged){this.color.setHex(combatFlash?0xff3333:dimmed?0x555555:presenceColor?Number.parseInt(String(presenceColor).replace('#',''),16):garmentColorHex);this.setInstanceGarmentColor(batch.mesh,bodyIndex,this.color);this.activeDirtColor.setHex(dirtVisual.hex);this.setInstanceDirt(batch.mesh,bodyIndex,this.activeDirtColor,dimmed||combatFlash?0:dirtLevel01,dz);}
    if(batch.clothingMesh||batch.combined){motion.clothingColorAppearance=appearance;motion.clothingColorDirt=dirtToken;motion.clothingColorCombat=combatFlash;motion.clothingColorDimmed=dimmed;motion.clothingColorPresence=presenceColor;}
    batch.count++;
    if(outline){
      if(!matrixReady){this.quaternion.setFromAxisAngle(this.axis,renderAngle);if(lying)this.quaternion.multiply(this.lyingRotation);this.scale.set(size,size*heightScale,size);this.matrix.compose(this.position,this.quaternion,this.scale);matrixReady=true;}
      outline.add(combinedSource||bodySource,this.matrix,poseBodyShape.fat);
      if(outfit&&!combinedSource)outline.add(clothingSource,this.matrix,poseBodyShape.fat);
    }
    const items=appearance.items;
    motion.accessoryTransforms??=[];
    for(let itemIndex=0;itemIndex<items.length;itemIndex++){const item=items[itemIndex];motion.accessoryTransforms[itemIndex]??={};if(!RENDERED_ACCESSORIES.has(item.piece)&&!item.piece.startsWith('party-number-')){motion.accessoryTransforms[itemIndex].key=null;continue;}
      const itemKey=`${key}:${item.piece}`,isPartyNumber=item.piece.startsWith('party-number-'),isStaticHeadwear=HEADWEAR_PIECES.has(item.piece),isFittedClothing=LOWER_PIECES.has(item.piece)||HAND_PIECES.has(item.piece);let source=this.headwear.get(isStaticHeadwear?`static:${item.piece}`:itemKey);if(!source&&isPartyNumber){source=partyNumberSurface(this.THREE,this.frames.get(key),item.piece.slice('party-number-'.length));this.headwear.set(itemKey,source);}const batchKey=isStaticHeadwear?item.piece:itemKey;let head=this.headwearBatches.get(batchKey);
      if(!head){head={count:0,capacity:0,mesh:null};this.headwearBatches.set(batchKey,head);}this.activeHeadwearBatches.add(head);
      if(head.count===head.capacity){
        const capacity=Math.max(32,head.capacity*2),itemMaterial=SKIRT_PIECES.has(item.piece)?this.skirtMaterial:['sapatos','botas'].includes(item.piece)?this.footwearMaterial:isFittedClothing?this.fittedMaterial:this.material,mesh=new this.THREE.InstancedMesh(isFittedClothing?this.instancedGeometry(source,capacity):source,itemMaterial,capacity);mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;
        if(head.mesh){for(let i=0;i<head.count;i++){head.mesh.getMatrixAt(i,this.matrix);mesh.setMatrixAt(i,this.matrix);head.mesh.getColorAt(i,this.color);this.setInstanceColor(mesh,i,this.color);const oldFat=head.mesh.geometry.attributes.instanceFat,newFat=mesh.geometry.attributes.instanceFat;if(oldFat&&newFat){newFat.array[i]=oldFat.array[i];mesh.userData.instanceFatDirty=true;}}if(head.count){mesh.userData.instanceMatrixDirty=true;mesh.userData.matrixDirtyMin=0;mesh.userData.matrixDirtyMax=head.count-1;}this.group.remove(head.mesh);head.mesh.dispose();}
        this.group.add(mesh);head.mesh=mesh;head.capacity=capacity;this.matrix.compose(this.position,this.quaternion,this.scale);
      }
      const accessoryIndex=head.count,accessoryTransform=motion.accessoryTransforms[itemIndex],accessoryUnchanged=transformUnchanged&&accessoryTransform.key===itemKey&&accessoryTransform.batch===head&&accessoryTransform.mesh===head.mesh&&accessoryTransform.index===accessoryIndex,accessoryColorSlotUnchanged=accessoryTransform.batch===head&&accessoryTransform.mesh===head.mesh&&accessoryTransform.index===accessoryIndex;
      if(!accessoryUnchanged){if(!matrixReady){this.quaternion.setFromAxisAngle(this.axis,renderAngle);if(lying)this.quaternion.multiply(this.lyingRotation);this.scale.set(size,size*heightScale,size);this.matrix.compose(this.position,this.quaternion,this.scale);matrixReady=true;}if(isStaticHeadwear){const anchor=this.headwearAnchors.get(itemKey);this.accessoryOffset.set(anchor?.x||0,anchor?.y||0,anchor?.z||0).applyMatrix4(this.matrix);this.accessoryMatrix.copy(this.matrix).setPosition(this.accessoryOffset);this.setInstanceMatrix(head.mesh,accessoryIndex,this.accessoryMatrix);}else this.setInstanceMatrix(head.mesh,accessoryIndex,this.matrix);}
      accessoryTransform.key=itemKey;accessoryTransform.batch=head;accessoryTransform.mesh=head.mesh;accessoryTransform.index=accessoryIndex;if(isFittedClothing&&(!accessoryUnchanged||accessoryTransform.fatToken!==poseBodyShape.fat)){this.setInstanceFat(head.mesh,accessoryIndex,poseBodyShape);accessoryTransform.fatToken=poseBodyShape.fat;}
      const hex=itemColorHexes[itemIndex],itemDirt=Math.max(item.dirt||0,dirtVisual.level),itemDirtToken=`${Math.round(itemDirt)}:${dirtVisual.hex}`,accessoryColorUnchanged=accessoryColorSlotUnchanged&&accessoryTransform.colorItem===item&&accessoryTransform.colorHex===hex&&accessoryTransform.colorDirt===itemDirtToken&&accessoryTransform.colorCombat===combatFlash&&accessoryTransform.colorDimmed===dimmed;if(!accessoryColorUnchanged){this.color.setHex(combatFlash?0xff3333:dimmed?0x555555:hex);this.setInstanceColor(head.mesh,head.count,this.color);this.activeDirtColor.setHex(dirtVisual.hex);this.setInstanceDirt(head.mesh,head.count,this.activeDirtColor,dimmed||combatFlash?0:Math.min(1,itemDirt/100),dz);accessoryTransform.colorItem=item;accessoryTransform.colorHex=hex;accessoryTransform.colorDirt=itemDirtToken;accessoryTransform.colorCombat=combatFlash;accessoryTransform.colorDimmed=dimmed;}head.count++;
      if(outline){
        if(isStaticHeadwear&&accessoryUnchanged){const anchor=this.headwearAnchors.get(itemKey);this.accessoryOffset.set(anchor?.x||0,anchor?.y||0,anchor?.z||0).applyMatrix4(this.matrix);this.accessoryMatrix.copy(this.matrix).setPosition(this.accessoryOffset);}
        outline.add(source,isStaticHeadwear?this.accessoryMatrix:this.matrix,isFittedClothing?poseBodyShape.fat:0);
      }
    }
    if((clip==='carregar'||clip==='carregar_parado')&&this.headwear.has('static:carry-box')){
      const source=this.headwear.get('static:carry-box');
      if(!this.carryBoxMaterial){const mat=new this.THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true,side:this.THREE.DoubleSide});this.decorateMaterial(mat);this.carryBoxMaterial=mat;}
      let boxBatch=this.headwearBatches.get('carry-box');
      if(!boxBatch){boxBatch={count:0,capacity:0,mesh:null};this.headwearBatches.set('carry-box',boxBatch);}
      this.activeHeadwearBatches.add(boxBatch);
      if(boxBatch.count===boxBatch.capacity){
        const capacity=Math.max(16,boxBatch.capacity*2),mesh=new this.THREE.InstancedMesh(source,this.carryBoxMaterial,capacity);
        mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;
        if(boxBatch.mesh){for(let i=0;i<boxBatch.count;i++){boxBatch.mesh.getMatrixAt(i,this.matrix);mesh.setMatrixAt(i,this.matrix);boxBatch.mesh.getColorAt(i,this.color);this.setInstanceColor(mesh,i,this.color);}mesh.userData.instanceMatrixDirty=true;mesh.userData.matrixDirtyMin=0;mesh.userData.matrixDirtyMax=boxBatch.count-1;this.group.remove(boxBatch.mesh);boxBatch.mesh.dispose();}
        this.group.add(mesh);boxBatch.mesh=mesh;boxBatch.capacity=capacity;
      }
      if(!matrixReady){this.quaternion.setFromAxisAngle(this.axis,renderAngle);if(lying)this.quaternion.multiply(this.lyingRotation);this.scale.set(size,size*heightScale,size);this.matrix.compose(this.position,this.quaternion,this.scale);matrixReady=true;}
      const anchor=this.carryAnchors.get(key);
      this.accessoryOffset.set(anchor?.x||0,anchor?.y||.55,(anchor?.z||.2)+Math.max(0,poseBodyShape.fat)*.07).applyMatrix4(this.matrix);
      this.accessoryMatrix.copy(this.matrix).setPosition(this.accessoryOffset);
      this.setInstanceMatrix(boxBatch.mesh,boxBatch.count,this.accessoryMatrix);
      this.color.setHex(combatFlash?0xff3333:dimmed?0x555555:c.forestryJob?.stage==='return'?0xd8c3a5:0xffffff);
      this.setInstanceColor(boxBatch.mesh,boxBatch.count,this.color);
      boxBatch.count++;
    }
    const toolKind=TOOL_CLIPS[clip];
    if(toolKind&&this.headwear.has(`static:tool:${toolKind}`)){
      const source=this.headwear.get(`static:tool:${toolKind}`);
      if(!this.carryBoxMaterial){const mat=new this.THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true,side:this.THREE.DoubleSide});this.decorateMaterial(mat);this.carryBoxMaterial=mat;}
      const batchKey=`tool:${toolKind}`;
      let toolBatch=this.headwearBatches.get(batchKey);
      if(!toolBatch){toolBatch={count:0,capacity:0,mesh:null};this.headwearBatches.set(batchKey,toolBatch);}
      this.activeHeadwearBatches.add(toolBatch);
      if(toolBatch.count===toolBatch.capacity){
        const capacity=Math.max(16,toolBatch.capacity*2),mesh=new this.THREE.InstancedMesh(source,this.carryBoxMaterial,capacity);
        mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;
        if(toolBatch.mesh){for(let i=0;i<toolBatch.count;i++){toolBatch.mesh.getMatrixAt(i,this.matrix);mesh.setMatrixAt(i,this.matrix);toolBatch.mesh.getColorAt(i,this.color);this.setInstanceColor(mesh,i,this.color);}mesh.userData.instanceMatrixDirty=true;mesh.userData.matrixDirtyMin=0;mesh.userData.matrixDirtyMax=toolBatch.count-1;this.group.remove(toolBatch.mesh);toolBatch.mesh.dispose();}
        this.group.add(mesh);toolBatch.mesh=mesh;toolBatch.capacity=capacity;
      }
      if(!matrixReady){this.quaternion.setFromAxisAngle(this.axis,renderAngle);if(lying)this.quaternion.multiply(this.lyingRotation);this.scale.set(size,size*heightScale,size);this.matrix.compose(this.position,this.quaternion,this.scale);matrixReady=true;}
      const anchor=this.carryAnchors.get(key);
      this.accessoryOffset.set(anchor?.x||0,anchor?.y||.55,anchor?.z||.2).applyMatrix4(this.matrix);
      this.propAxis??=new this.THREE.Vector3();
      this.propLocalQuat??=new this.THREE.Quaternion();
      this.propQuat??=new this.THREE.Quaternion();
      this.propAxis.set(anchor?.ax||0,anchor?.ay||1,anchor?.az||0);
      this.propLocalQuat.setFromAxisAngle(this.propAxis,anchor?.angle||0);
      this.propQuat.setFromAxisAngle(this.axis,renderAngle);
      if(lying)this.propQuat.multiply(this.lyingRotation);
      this.propQuat.multiply(this.propLocalQuat);
      this.accessoryMatrix.compose(this.accessoryOffset,this.propQuat,this.scale);
      this.setInstanceMatrix(toolBatch.mesh,toolBatch.count,this.accessoryMatrix);
      this.color.setHex(combatFlash?0xff3333:dimmed?0x555555:0xffffff);
      this.setInstanceColor(toolBatch.mesh,toolBatch.count,this.color);
      toolBatch.count++;
    }
    if((c.dead||dirtVisual.level>=78)&&!dimmed&&this.THREE.BoxGeometry&&this.THREE.MeshBasicMaterial){
      const fliesPerCitizen=c.dead?6:Math.min(6,3+Math.floor((dirtVisual.level-78)/8));
      if(this.flyCount+fliesPerCitizen>this.flyCapacity){
        const cap=Math.max(64,(this.flyCapacity||32)*2),geo=new this.THREE.BoxGeometry(.025,.016,.025),mat=new this.THREE.MeshBasicMaterial({color:0x16181c}),mesh=new this.THREE.InstancedMesh(geo,mat,cap);
        mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);mesh.frustumCulled=false;
        if(this.flyMesh){for(let i=0;i<this.flyCount;i++){this.flyMesh.getMatrixAt(i,this.matrix);mesh.setMatrixAt(i,this.matrix);}this.group.remove(this.flyMesh);this.flyMesh.geometry.dispose();this.flyMesh.material.dispose();}
        this.group.add(mesh);this.flyMesh=mesh;this.flyCapacity=cap;
      }
      const baseFlyY=c.dead?surfaceH+.22:surfaceH+.85*size*heightScale;
      for(let i=0;i<fliesPerCitizen;i++){
        const t=this.clock*5.2+(entity.id||0)*1.37+i*2.09,r=.18+(i%3)*.09;
        const fx=renderX+Math.cos(t+Math.sin(t*.7))*r,fz=renderY+Math.sin(t*1.15+i)*r,fy=baseFlyY+Math.abs(Math.sin(t*1.8+i))*.24+(i%2)*.06;
        this.position.set(fx,fy,fz);this.quaternion.setFromAxisAngle(this.axis,t*2);this.scale.set(1,1,1);this.matrix.compose(this.position,this.quaternion,this.scale);
        this.flyMesh.setMatrixAt(this.flyCount++,this.matrix);
      }
    }
    if((clip==='nadar'||clip==='boiar')&&!dimmed&&this.THREE.BoxGeometry&&(this.THREE.MeshLambertMaterial||this.THREE.MeshBasicMaterial)){
      const floating=clip==='boiar',foamCount=floating?4:6;
      if(this.swimFoamCount+foamCount>this.swimFoamCapacity){
        const cap=Math.max(64,(this.swimFoamCapacity||32)*2),geo=new this.THREE.BoxGeometry(.22,.008,.22);
        const Mat=this.THREE.MeshLambertMaterial||this.THREE.MeshBasicMaterial;
        const mat=new Mat({color:0xe2f5f2,transparent:false,depthWrite:false,dithering:true});
        mat.onBeforeCompile=shader=>{
          shader.vertexShader=shader.vertexShader
            .replace('#include <common>',`#include <common>
varying vec2 vFoamLocal;
varying vec2 vFoamWorld;`)
            .replace('#include <begin_vertex>',`#include <begin_vertex>
vFoamLocal = position.xz / 0.11;
vec4 foamWorldPos = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
foamWorldPos = instanceMatrix * foamWorldPos;
#endif
foamWorldPos = modelMatrix * foamWorldPos;
vFoamWorld = foamWorldPos.xz;`);
          shader.fragmentShader=shader.fragmentShader
            .replace('#include <common>',`#include <common>
varying vec2 vFoamLocal;
varying vec2 vFoamWorld;`)
            .replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
float r = length(vFoamLocal);
vec2 fp = vFoamWorld * 18.0;
float n = 0.5 + 0.25 * sin(fp.x * 1.7 + sin(fp.y * 1.3)) + 0.25 * cos(fp.y * 2.1 - sin(fp.x * 1.1));
float density = smoothstep(0.96, 0.16, r + (n - 0.5) * 0.36);
if (density <= 0.04) discard;
vec2 dCell = mod(floor(gl_FragCoord.xy), 4.0);
float dIdx = dCell.x + dCell.y * 4.0;
float bayer = (
  dIdx < 1.0 ? 0.5 : dIdx < 2.0 ? 8.5 : dIdx < 3.0 ? 2.5 : dIdx < 4.0 ? 10.5 :
  dIdx < 5.0 ? 12.5 : dIdx < 6.0 ? 4.5 : dIdx < 7.0 ? 14.5 : dIdx < 8.0 ? 6.5 :
  dIdx < 9.0 ? 3.5 : dIdx < 10.0 ? 11.5 : dIdx < 11.0 ? 1.5 : dIdx < 12.0 ? 9.5 :
  dIdx < 13.0 ? 15.5 : dIdx < 14.0 ? 7.5 : dIdx < 15.0 ? 13.5 : 5.5
) / 16.0;
if (density < bayer) discard;`);
        };
        mat.customProgramCacheKey=()=> 'citizen-swim-foam-dither-2';
        this.decorateMaterial(mat);
        const mesh=new this.THREE.InstancedMesh(geo,mat,cap);
        mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.renderOrder=2;
        if(this.swimFoamMesh){for(let i=0;i<this.swimFoamCount;i++){this.swimFoamMesh.getMatrixAt(i,this.matrix);mesh.setMatrixAt(i,this.matrix);}this.group.remove(this.swimFoamMesh);this.swimFoamMesh.geometry.dispose();this.swimFoamMesh.material.dispose();}
        this.group.add(mesh);this.swimFoamMesh=mesh;this.swimFoamCapacity=cap;
      }
      const foamY=(waterSurfaceY??(surfaceH+.32))+.014,fwdX=Math.sin(renderAngle),fwdZ=Math.cos(renderAngle),sideX=fwdZ,sideZ=-fwdX,baseT=this.clock*(floating?2.0:3.6)+(entity.id||0)*.73;
      for(let i=0;i<foamCount;i++){
        const phase=(baseT+i/foamCount)%1,side=i%2===0?1:-1;
        const along=floating?(i<2?.12:-.12)*(.7+phase*.4):(i<2?.12-phase*.18:i<4?-.08-phase*.32:-.26-phase*.36);
        const lat=floating?side*(.16+phase*.12):side*(.15+phase*.16+Math.sin(baseT*2+i)*.03);
        const s=(1-phase*.55)*(.85+.35*Math.sin(baseT+i))*size;
        this.position.set(renderX+fwdX*along+sideX*lat,foamY,renderY+fwdZ*along+sideZ*lat);
        this.quaternion.setFromAxisAngle(this.axis,renderAngle+i*.4);
        this.scale.set(s,1,s);
        this.matrix.compose(this.position,this.quaternion,this.scale);
        this.swimFoamMesh.setMatrixAt(this.swimFoamCount++,this.matrix);
      }
    }
    return true;
  }
  end(){
    const flushBatch=batch=>{
      batch.mesh.count=batch.count;
      if(batch.count){this.flushInstanceMatrix(batch.mesh);if(batch.mesh.instanceColor&&batch.mesh.userData.instanceColorDirty){batch.mesh.instanceColor.needsUpdate=true;batch.mesh.userData.instanceColorDirty=false;}const fat=batch.mesh.geometry.attributes.instanceFat;if(fat&&batch.mesh.userData.instanceFatDirty){fat.needsUpdate=true;batch.mesh.userData.instanceFatDirty=false;}const garmentColor=batch.mesh.geometry.attributes.instanceGarmentColor;if(garmentColor&&batch.mesh.userData.instanceGarmentColorDirty){garmentColor.needsUpdate=true;batch.mesh.userData.instanceGarmentColorDirty=false;}this.flushInstancePattern(batch.mesh);this.flushInstanceDirt(batch.mesh);}
      if(batch.clothingMesh){batch.clothingMesh.count=batch.count;if(batch.count){this.flushInstanceMatrix(batch.clothingMesh);if(batch.clothingMesh.instanceColor&&batch.clothingMesh.userData.instanceColorDirty){batch.clothingMesh.instanceColor.needsUpdate=true;batch.clothingMesh.userData.instanceColorDirty=false;}const fat=batch.clothingMesh.geometry.attributes.instanceFat;if(fat&&batch.clothingMesh.userData.instanceFatDirty){fat.needsUpdate=true;batch.clothingMesh.userData.instanceFatDirty=false;}this.flushInstancePattern(batch.clothingMesh);this.flushInstanceDirt(batch.clothingMesh);}}
    };
    for(const batch of this.activeBatches)flushBatch(batch);
    for(const batch of this.activeHeadwearBatches){batch.mesh.count=batch.count;if(batch.count){this.flushInstanceMatrix(batch.mesh);if(batch.mesh.instanceColor&&batch.mesh.userData.instanceColorDirty){batch.mesh.instanceColor.needsUpdate=true;batch.mesh.userData.instanceColorDirty=false;}const fat=batch.mesh.geometry.attributes.instanceFat;if(fat&&batch.mesh.userData.instanceFatDirty){fat.needsUpdate=true;batch.mesh.userData.instanceFatDirty=false;}this.flushInstancePattern(batch.mesh);this.flushInstanceDirt(batch.mesh);}}
    if(this.flyMesh){this.flyMesh.count=this.flyCount;if(this.flyCount>0)this.flyMesh.instanceMatrix.needsUpdate=true;}
    if(this.swimFoamMesh){this.swimFoamMesh.count=this.swimFoamCount;if(this.swimFoamCount>0)this.swimFoamMesh.instanceMatrix.needsUpdate=true;}
    for(const [id,carrier]of this.campaignFlags)if(!this.activeCampaignFlags.has(id)){this.group.remove(carrier.group);carrier.group.traverse(o=>{o.geometry?.dispose();if(o.material!==carrier.material)o.material?.dispose();});this.campaignFlags.delete(id);}
  }
  clear(){for(const b of this.batches.values()){this.group.remove(b.mesh);b.mesh.dispose();if(b.clothingMesh){this.group.remove(b.clothingMesh);b.clothingMesh.dispose();}}for(const b of this.headwearBatches.values()){this.group.remove(b.mesh);b.mesh.dispose();}if(this.flyMesh){this.group.remove(this.flyMesh);this.flyMesh.geometry.dispose();this.flyMesh.material.dispose();this.flyMesh=null;this.flyCapacity=0;this.flyCount=0;}if(this.swimFoamMesh){this.group.remove(this.swimFoamMesh);this.swimFoamMesh.geometry.dispose();this.swimFoamMesh.material.dispose();this.swimFoamMesh=null;this.swimFoamCapacity=0;this.swimFoamCount=0;}for(const carrier of this.campaignFlags.values()){this.group.remove(carrier.group);carrier.group.traverse(o=>{o.geometry?.dispose();if(o.material!==carrier.material)o.material?.dispose();});}for(const material of this.campaignFlagMaterials.values()){material.map?.dispose();material.dispose();}this.campaignFlags.clear();this.campaignFlagMaterials.clear();this.activeCampaignFlags.clear();this.activeBatches.clear();this.activeHeadwearBatches.clear();this.batches.clear();this.headwearBatches.clear();this.motion=new WeakMap();this.clock=0;}
}
