import {wickerBasketSurface} from './city_mobility_models.js?v=cargo-box-rear-1';
import {partyFlagCanvas,drawPartyFlag} from './city_party_flags.js';
import {clothFlagGeometry,animateClothFlag} from './city_flag_animation.js?v=flag-wind-tick-13';
import {bodyFatAmount} from './city_body_metrics.js?v=body-morph-4';
import {TROPICAL_PRINTS} from './city_clothing.js?v=party-apparel-1';
/** OBJ snapshots share one geometry per frame and one instanced draw per visible frame. */
export const CITIZEN_MODEL_FRAMES=Object.freeze({idle:[0],run:[0,1,2,3,4],use:[0,1,2],use_alt:[0,1,2],a_postos:[0,1],chute:[0,1],derrotado:[0,1],dormindo:[0],morto:[0],murro:[0,1],sentado_no_banco:[0],sentado_no_chao:[0]});
const citizenHasPath=c=>c?._renderPathActive??!!c?.path?.length;
export function citizenIsSleeping(c){
 if(c?.task!=='energy'||!c.sleep?.active||citizenHasPath(c)||c.mobilityTrip||c.ridingVehicleId||c.deliveryId)return false;
 const s=c.indoorLocation;
 if(s)return s.roomType==='bedroom'&&!s.exiting&&!s.path?.length;
 return !!c.homelessSleepSpot&&!!c.entity&&Math.hypot(c.entity.x-c.homelessSleepSpot.x,c.entity.y-c.homelessSleepSpot.y)<=.3;
}
const WORK_TASKS=new Set(['work','manage','construction','clean','cleaning','research','campaign','care','caregiving','food','provisions','water','hygiene','supplies','shopping','health','vote','council-session','informal-service','informal-frontage','informal-gardening']);
const BIKE_KINDS=new Set(['bicicleta','bicicleta_carga']),GLIDE_KINDS=new Set(['patinete','patins','skate']);
const ALT_USE_TASKS=new Set(['food','workmeal','provisions','toilet','hygiene','water','health','shopping','supplies','care','caregiving','leisure','social','vote']);
const ACTION_CLIPS=new Set(['run','pedal','murro','chute','derrotado']),POSED_SKIRT_FRAMES=new Set(['dormindo:0','morto:0','derrotado:0','derrotado:1']);
const PRINTED_GARMENTS=new Set(['camisa social','camisa estampada','vestido estampado']),PATTERNED_GARMENTS=new Set(['camisa estampada','vestido estampado']),SKIRT_PIECES=new Set(['saia','saia longa']),HAND_PIECES=new Set(['luvas']);
const LOWER_PIECES=new Set(['sapatos','botas','calça','calça social','shorts','bermuda','sunga','saia','saia longa']);
const RENDERED_ACCESSORIES=new Set(['boné','cartola','chapéu','chapéu nordestino','chapéu de cangaceiro','chapéu de couro','chapéu de vaqueiro','chapéu de palha pequeno','chapéu de palha médio','chapéu de palha grande','cesta','sapatos','botas','calça','calça social','shorts','bermuda','sunga','saia','saia longa','luvas']);
export function citizenAnimation(c,moving=false){
  if(c.dead)return 'morto';
  if(c.unconsciousUntil)return 'derrotado';
  if(c.surrenderedUntil)return 'sentado_no_chao';
  if(c.mobilityTrip?.stage==='boarding')return moving?'run':'idle';
  if(c.ridingVehicleId){
    if(c.ridingVehicleKind==='carrinho')return 'run';
    if(BIKE_KINDS.has(c.ridingVehicleKind))return c.ridingAsPassenger?'sentado_no_banco':'seated';
    return GLIDE_KINDS.has(c.ridingVehicleKind)?'glide':'passenger';
  }
  if(moving)return 'run';
  if(c.combatReaction)return 'derrotado';
  if(c.combatAnimation?.clip)return c.combatAnimation.clip;
  if(citizenIsSleeping(c))return 'dormindo';
  if(c.furnitureUse?.pose==='ground_sit')return 'sentado_no_chao';
  if(c.task==='sit'||c.furnitureUse?.type==='bench'||c.furnitureUse?.type==='beach_chair')return 'sentado_no_banco';
  if(c.seated)return 'seated';
  if(c.policePatrol)return 'a_postos';
  const activelyUsingFurniture=!!c.furnitureUse&&!c.furnitureUse.seated;
  const activelyWorkingOutside=!!c.workCell||!!c.forestryJob||!!c.paintWorkId;
  const activelyInsideWork=!!c.indoorLocation?.unitId&&WORK_TASKS.has(c.task);
  const activelyOnGig=!!c.informalJobId&&!citizenHasPath(c);
  const activelyWorking=WORK_TASKS.has(c.task)&&!citizenHasPath(c)&&(activelyUsingFurniture||activelyWorkingOutside||activelyInsideWork||activelyOnGig||c.task==='construction'&&c.workProjectId!=null);
  if(!activelyWorking)return 'idle';
  return ALT_USE_TASKS.has(c.task)?'use_alt':'use';
}
export function citizenFrame(clip,time,phase=0,oneShot=false){
  if(clip==='mount'||clip==='passenger')return {clip:'use',frame:0};
  if(clip==='seated')return {clip:'use',frame:2};
  if(clip==='glide')return {clip:'use',frame:1};
  const sequence=clip==='pedal'?[0,2,4]:clip==='use'?[0,1]:CITIZEN_MODEL_FRAMES[clip]||[0],fps=ACTION_CLIPS.has(clip)?8:4,index=Math.floor(Math.max(0,time)*fps+phase);
  return {clip:clip==='pedal'?'run':clip in CITIZEN_MODEL_FRAMES?clip:'idle',frame:sequence[oneShot?Math.min(index,sequence.length-1):index%sequence.length]};
}
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
export function garmentSurface(reference,piece){
  const mask=new Uint8Array(reference.positions.length/9);
  for(let t=0;t<mask.length;t++){
    const i=t*9,p=reference.positions,y=(p[i+1]+p[i+4]+p[i+7])/3;
    const centerX=(p[i]+p[i+3]+p[i+6])/3;
    const upper=y>=1.00&&y<1.78,legs=y>=.12&&y<1.00,arm=Math.abs(centerX)>.18,hand=arm&&((y<1.18&&Math.abs(centerX)>.36)||y>1.74),longSleeve=upper&&!hand,shortSleeve=upper&&(!arm||y>=1.38),torso=upper&&!arm;
    const swimTop=upper&&(y>1.28||Math.abs(centerX)<.20),swimBottom=y>=.52&&y<.88&&Math.abs(centerX)<.24;
    mask[t]=Number(
      ['camisa','camisa social','camisa estampada','trapos'].includes(piece)?longSleeve:
      piece==='casaco'?longSleeve:
      piece==='camiseta'?shortSleeve:
      piece==='regata'?torso:
      piece==='luvas'?hand:
      piece==='terno'?legs||longSleeve:
      ['calça','calça social'].includes(piece)?legs:
      ['shorts','bermuda'].includes(piece)?y>=.52&&y<1.00:
      piece==='sunga'?y>=.48&&y<.92:
      piece==='biquíni'?swimTop||swimBottom:
      piece==='maiô'?y>=.20&&y<1.78:
      piece==='sapatos'?y<.16:
      piece==='botas'?y<.38:
      piece==='saia'?y>=.52&&y<1.18:
      piece==='saia longa'?y>=.18&&y<1.18:
      ['vestido','vestido estampado'].includes(piece)?y>=.42&&y<1.78:
      piece==='macacão'?legs||longSleeve:false);
  }
  return mask;
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
    return {positions:basket.positions,normals:basket.normals};
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
  return {positions:new Float32Array(positions),normals:new Float32Array(normals)};
}
function partyNumberSurface(THREE,data,number){
  const positions=[],normals=[],p=data.attributes?.position?.array||data.positions;let top=-Infinity,x=0,z=0,n=0;for(let i=1;i<p.length;i+=3)top=Math.max(top,p[i]);for(let i=0;i<p.length;i+=3)if(p[i+1]>=top-.07){x+=p[i];z+=p[i+2];n++;}x/=n||1;z/=n||1;const digits=String(number).slice(-3),height=.036,width=Math.min(.067,height*.64*digits.length),digitW=width/digits.length,thickness=.0045,centerY=top+.018,frontZ=z+.088,segments={0:[0,1,2,4,5,6],1:[2,5],2:[0,2,3,4,6],3:[0,2,3,5,6],4:[1,2,3,5],5:[0,1,3,5,6],6:[0,1,3,4,5,6],7:[0,2,5],8:[0,1,2,3,4,5,6],9:[0,1,2,3,5,6]};
  const rect=(cx,cy,w,h)=>{const a=[cx-w/2,cy-h/2,frontZ],b=[cx+w/2,cy-h/2,frontZ],c=[cx+w/2,cy+h/2,frontZ],d=[cx-w/2,cy+h/2,frontZ];for(const v of [a,b,c,a,c,d]){positions.push(...v);normals.push(0,0,1);}};
  for(let i=0;i<digits.length;i++){const digit=digits[i],cx=x-width/2+digitW*(i+.5),barW=digitW*.68,barH=thickness,sideW=thickness,midY=centerY;for(const seg of segments[digit]||[]){if(seg===0)rect(cx,midY+height*.43,barW,barH);if(seg===3)rect(cx,midY,barW,barH);if(seg===6)rect(cx,midY-height*.43,barW,barH);if(seg===1)rect(cx-barW*.49,midY+height*.22,sideW,height*.38);if(seg===2)rect(cx+barW*.49,midY+height*.22,sideW,height*.38);if(seg===4)rect(cx-barW*.49,midY-height*.22,sideW,height*.38);if(seg===5)rect(cx+barW*.49,midY-height*.22,sideW,height*.38);}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.computeBoundingSphere();return geometry;
}
export function splitGarmentSurface(data,mask,piece=null){
  const body=[],bodyNormals=[],clothes=[],clothesNormals=[];
  for(let t=0;t<data.positions.length/9;t++){
    const selected=mask[t],p=selected?clothes:body,n=selected?clothesNormals:bodyNormals;
    for(let j=0;j<9;j+=3){let x=data.positions[t*9+j],y=data.positions[t*9+j+1],z=data.positions[t*9+j+2];
      if(selected&&['vestido','vestido estampado'].includes(piece)&&y<.99){const fall=Math.max(0,Math.min(1,(.99-y)/.48)),factor=1+.18*fall*fall;x*=factor;z*=factor;}
      p.push(x,y,z);n.push(data.normals[t*9+j],data.normals[t*9+j+1],data.normals[t*9+j+2]);}
  }
  return {body:new Float32Array(body),bodyNormals:new Float32Array(bodyNormals),clothes:new Float32Array(clothes),clothesNormals:new Float32Array(clothesNormals)};
}
export function posedSkirtMask(data,key){
  const p=data.positions,mask=new Uint8Array(p.length/9);let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.length;i+=3)for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],p[i+axis]);max[axis]=Math.max(max[axis],p[i+axis]);}
  const seated=key==='use:2'||key.startsWith('sentado_no_'),lying=['dormindo:0','morto:0','derrotado:0','derrotado:1'].includes(key),span=max.map((v,i)=>v-min[i]),center=min.map((v,i)=>(v+max[i])/2),longAxis=span[0]>span[2]?0:2;
  for(let t=0;t<mask.length;t++){
    const i=t*9,cx=(p[i]+p[i+3]+p[i+6])/3,cy=(p[i+1]+p[i+4]+p[i+7])/3,cz=(p[i+2]+p[i+5]+p[i+8])/3;
    if(seated){const low=min[1]+span[1]*.08,high=min[1]+span[1]*.68;mask[t]=Number(cy>=low&&cy<=high&&Math.abs(cx-center[0])<=span[0]*.48&&Math.abs(cz-center[2])<=span[2]*.49);}
    else if(lying){const along=longAxis===0?cx:cz;mask[t]=Number(Math.abs(along-center[longAxis])<=span[longAxis]*.22);}
  }
  return mask;
}
export function hipKneeSkirtSurface(data,piece){
  const p=data.positions,positions=[],normals=[],values=(items,fraction)=>{items.sort((a,b)=>a-b);return items[Math.floor((items.length-1)*fraction)]||0;},median=items=>values(items,.5),clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const waist=[];for(let i=0;i<p.length;i+=3)if(p[i+1]>=.46&&p[i+1]<=.60&&Math.abs(p[i])<.18)waist.push([p[i],p[i+1],p[i+2]]);
  // OBJ walk poses have uneven vertex density on each side of the waist; keep
  // the waistband on the shared body centerline instead of following that bias.
  const centerX=0,centerZ=median(waist.map(q=>q[2])),topY=(median(waist.map(q=>q[1]))||.52)+.035;
  const sideKnees=[[],[]],long=piece==='saia longa',kneeLow=long?.12:.24,kneeHigh=long?.36:.46;
  for(let i=0;i<p.length;i+=3)if(p[i+1]>=kneeLow&&p[i+1]<=kneeHigh&&Math.abs(p[i]-centerX)<.24&&Math.abs(p[i+2]-centerZ)<.48)sideKnees[p[i]<centerX?0:1].push([p[i],p[i+1],p[i+2]]);
  const topWidth=clamp(values(waist.map(q=>Math.abs(q[0]-centerX)),.92)*1.02,.085,.125),topDepth=clamp(values(waist.map(q=>Math.abs(q[2]-centerZ)),.92)*1.02,.06,.095),hemWidth=Math.min(.17,topWidth*(long?1.32:1.28)+.008),hemDepth=Math.min(.125,topDepth*1.22+.006);
  const knee=sideKnees.map((points,side)=>points.length?[median(points.map(q=>q[0])),median(points.map(q=>q[1])),median(points.map(q=>q[2]))]:[centerX+(side?hemWidth:-hemWidth),long?.18:.30,centerZ]);
  knee[0][0]=centerX-hemWidth;knee[1][0]=centerX+hemWidth;
  knee[0][2]=centerZ+clamp(knee[0][2]-centerZ,-.10,.10);knee[1][2]=centerZ+clamp(knee[1][2]-centerZ,-.10,.10);
  const groinPoints=[];for(let i=0;i<p.length;i+=3)if(p[i+1]>=.36&&p[i+1]<=.52&&Math.abs(p[i]-centerX)<.06&&Math.abs(p[i+2]-centerZ)<.22)groinPoints.push([p[i],p[i+1],p[i+2]]);
  const groin=[median(groinPoints.map(q=>q[0])),median(groinPoints.map(q=>q[1]))||topY-.04,median(groinPoints.map(q=>q[2]))],depth=topDepth+.012,kneeDepth=Math.max(.035,topDepth*.62);
  const topFrontLeft=[centerX-topWidth,topY,centerZ+depth],topFrontRight=[centerX+topWidth,topY,centerZ+depth],topBackLeft=[centerX-topWidth,topY,centerZ-depth],topBackRight=[centerX+topWidth,topY,centerZ-depth];
  const groinFront=[groin[0],groin[1],groin[2]+depth],groinBack=[groin[0],groin[1],groin[2]-depth];
  const kneeFrontLeft=[knee[0][0]-.01,knee[0][1],knee[0][2]+kneeDepth],kneeFrontRight=[knee[1][0]+.01,knee[1][1],knee[1][2]+kneeDepth],kneeBackLeft=[knee[0][0]-.01,knee[0][1],knee[0][2]-kneeDepth],kneeBackRight=[knee[1][0]+.01,knee[1][1],knee[1][2]-kneeDepth];
  const tri=(a,b,c)=>{const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,len=Math.hypot(nx,ny,nz)||1;for(const q of [a,b,c]){positions.push(...q);normals.push(nx/len,ny/len,nz/len);}};
  const fan=(a,b,g,kl,kr)=>{tri(a,b,g);tri(b,kr,g);tri(kr,kl,g);tri(kl,a,g);};
  fan(topFrontLeft,topFrontRight,groinFront,kneeFrontLeft,kneeFrontRight);fan(topBackRight,topBackLeft,groinBack,kneeBackRight,kneeBackLeft);
  tri(topBackLeft,topFrontLeft,kneeFrontLeft);tri(topBackLeft,kneeFrontLeft,kneeBackLeft);tri(topFrontRight,topBackRight,kneeBackRight);tri(topFrontRight,kneeBackRight,kneeFrontRight);
  return {positions:new Float32Array(positions),normals:new Float32Array(normals),topY,centerX,centerZ,topWidth,topDepth,hemWidth,hemDepth,knee,groin};
}
export function hipKneeSkirtBodyMask(data,skirt){
  const p=data.positions,mask=new Uint8Array(p.length/9),{topY,centerX,topWidth,hemWidth,knee}=skirt,hemY=(knee[0][1]+knee[1][1])/2;
  const {centerZ,topDepth,hemDepth}=skirt;
  // Cut only body faces inside the front/back panels, ending at the skirt hem.
  const inside=(x,y,z)=>{if(y<hemY-.018||y>topY+.018)return false;const t=Math.max(0,Math.min(1,(topY-y)/(topY-hemY))),left=centerX-topWidth+(knee[0][0]-(centerX-hemWidth))*t,right=centerX+topWidth+(knee[1][0]-(centerX+hemWidth))*t,front=centerZ+topDepth+(Math.max(knee[0][2],knee[1][2])+hemDepth-centerZ-topDepth)*t,back=centerZ-topDepth+(Math.min(knee[0][2],knee[1][2])-hemDepth-centerZ+topDepth)*t;return x>=left-.018&&x<=right+.018&&z>=back-.018&&z<=front+.018;};
  for(let t=0;t<mask.length;t++){const i=t*9,cx=(p[i]+p[i+3]+p[i+6])/3,cy=(p[i+1]+p[i+4]+p[i+7])/3,cz=(p[i+2]+p[i+5]+p[i+8])/3;mask[t]=Number(inside(cx,cy,cz));}
  return mask;
}
export class CityCitizenModels {
  constructor(THREE,group,{fetchAsset=globalThis.fetch?.bind(globalThis),baseURL=new URL('../data/model/',import.meta.url)}={}){
    this.THREE=THREE;this.group=group;this.fetchAsset=fetchAsset;this.baseURL=baseURL;this.frames=new Map();this.outfits=new Map();this.headwear=new Map();this.headwearBatches=new Map();this.batches=new Map();this.activeBatches=new Set();this.activeHeadwearBatches=new Set();this.motion=new WeakMap();this.bodyShapeCache=new WeakMap();this.appearanceCache=new WeakMap();this.printMaterials=new Map();this.clock=0;this.frameToken=0;this.ready=false;this.error=null;
    this.matrix=new THREE.Matrix4();this.position=new THREE.Vector3();this.scale=new THREE.Vector3();this.quaternion=new THREE.Quaternion();this.axis=new THREE.Vector3(0,1,0);this.lyingRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);this.color=new THREE.Color();
    this.material=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide});this.enableWeightMorph(this.material);this.skirtMaterial=this.enableSkirtMorph(new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide}));this.campaignFlags=new Map();this.campaignFlagMaterials=new Map();this.activeCampaignFlags=new Set();
    this.loading=this.load().catch(error=>{this.error=error.message;console.warn('Modelos dos cidadãos indisponíveis; usando sprites.',error.message);return false;});
  }
  enableWeightMorph(material){
    if(!this.THREE.InstancedBufferAttribute)return material;
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float instanceFat;\nattribute vec2 weightMorph;');
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nfloat ringScaleX = 1.0 + instanceFat * weightMorph.x;\nfloat ringScaleZ = 1.0 + instanceFat * weightMorph.y;\nobjectNormal.x /= ringScaleX;\nobjectNormal.z /= ringScaleZ;\nobjectNormal = normalize(objectNormal);');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x *= ringScaleX;\ntransformed.z *= ringScaleZ;');
    };
    material.customProgramCacheKey=()=> 'citizen-weight-morph-15';
    return material;
  }
  enableSkirtMorph(material){
    if(!this.THREE.InstancedBufferAttribute)return material;
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float instanceFat;');
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nfloat skirtHipNormal = smoothstep(0.30, 0.45, position.y) * (1.0 - smoothstep(0.52, 0.61, position.y));\nfloat skirtNormalFit = 1.0 + instanceFat * (0.28 + skirtHipNormal * 0.16);\nobjectNormal.x /= skirtNormalFit;\nobjectNormal.z /= skirtNormalFit;\nobjectNormal = normalize(objectNormal);');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloat skirtHipFit = smoothstep(0.30, 0.45, transformed.y) * (1.0 - smoothstep(0.52, 0.61, transformed.y));\nfloat skirtVertexFit = 1.0 + instanceFat * (0.28 + skirtHipFit * 0.16);\ntransformed.x *= skirtVertexFit;\ntransformed.z *= skirtVertexFit;');
    };
    material.customProgramCacheKey=()=> 'citizen-skirt-weight-fit-2';
    return material;
  }
  instancedGeometry(source,capacity){
    if(!this.THREE.InstancedBufferAttribute)return source;
    const geometry=source.clone(),positions=geometry.attributes.position;
    const morphFactors=new Float32Array(positions.count*2);
    const smooth=(edge0,edge1,value)=>{const t=Math.max(0,Math.min(1,(value-edge0)/(edge1-edge0)));return t*t*(3-2*t);};
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),ax=Math.abs(x);
      const torso=smooth(.40,.53,y)*(1-smooth(.78,.89,y))*(1-smooth(.12,.19,ax));
      const arm=smooth(.48,.57,y)*(1-smooth(.78,.86,y))*smooth(.09,.16,ax);
      const leg=smooth(.12,.22,y)*(1-smooth(.42,.52,y))*smooth(.05,.12,ax);
      const head=smooth(.83,.91,y)*(1-smooth(1.02,1.10,y))*(1-smooth(.06,.12,ax));
      morphFactors[i*2]=torso*.60+leg*.22;
      morphFactors[i*2+1]=torso*.60+arm*.40+leg*.46+head*.22;
    }
    geometry.setAttribute('weightMorph',new this.THREE.BufferAttribute(morphFactors,2));
    geometry.setAttribute('instanceFat',new this.THREE.InstancedBufferAttribute(new Float32Array(capacity),1));geometry.setAttribute('instancePattern',new this.THREE.InstancedBufferAttribute(new Float32Array(capacity),1));return geometry;
  }
  setInstanceFat(mesh,index,citizen){
    const attribute=mesh.geometry.attributes.instanceFat;if(!attribute)return;
    // Body shape changes with height/weight, not with the render frame. Reuse
    // the per-citizen value and upload the instanced buffer only when needed.
    let shape=this.bodyShapeCache.get(citizen);
    if(!shape||shape.weight!==citizen.bodyWeightKg||shape.height!==citizen.bodyHeightCm){shape={weight:citizen.bodyWeightKg,height:citizen.bodyHeightCm,fat:bodyFatAmount(citizen)};this.bodyShapeCache.set(citizen,shape);}
    if(attribute.array[index]!==shape.fat){attribute.array[index]=shape.fat;mesh.userData.instanceFatDirty=true;}
  }
  setInstancePattern(mesh,index,patternId){
    const attribute=mesh.geometry.attributes.instancePattern;if(!attribute)return;
    const pattern=Math.max(0,TROPICAL_PRINTS.indexOf(patternId));
    if(attribute.array[index]!==pattern){attribute.array[index]=pattern;mesh.userData.instancePatternDirty=true;}
  }
  flushInstancePattern(mesh){const attribute=mesh.geometry.attributes.instancePattern;if(attribute&&mesh.userData.instancePatternDirty){attribute.needsUpdate=true;mesh.userData.instancePatternDirty=false;}}
  setInstanceColor(mesh,index,color){
    const attribute=mesh.instanceColor,offset=index*3;
    if(attribute&&Math.abs(attribute.array[offset]-color.r)<1e-6&&Math.abs(attribute.array[offset+1]-color.g)<1e-6&&Math.abs(attribute.array[offset+2]-color.b)<1e-6)return;
    mesh.setColorAt(index,color);mesh.userData.instanceColorDirty=true;
  }
  appearanceFor(c,entity){
    const wardrobe=c.wardrobe,wearingIndex=c.wearingIndex,garment=wearingIndex===-1?null:wardrobe?.[Number.isInteger(wearingIndex)?wearingIndex:0],lowerIndex=c.lowerWearIndex,lower=Number.isInteger(lowerIndex)&&lowerIndex>=0?wardrobe?.[lowerIndex]:null,headwearIndex=c.headwearIndex,headwear=Number.isInteger(headwearIndex)&&headwearIndex>=0?wardrobe?.[headwearIndex]:null,footwearIndex=c.footwearIndex,footwear=Number.isInteger(footwearIndex)&&footwearIndex>=0?wardrobe?.[footwearIndex]:null,handwearIndex=c.handwearIndex,handwear=Number.isInteger(handwearIndex)&&handwearIndex>=0?wardrobe?.[handwearIndex]:null,capId=c.political?.partyCapId||c.campaign?.capGarmentId,cesta=!!c.equipment?.cesta;
    let appearance=this.appearanceCache.get(c);const currentPartyCap=capId&&!cesta?wardrobe?.find(item=>item.garmentId===capId):null;
    const capStillMatches=!capId||appearance?.capId===capId&&(cesta||currentPartyCap===appearance.partyCap&&currentPartyCap?.garmentId===capId);
    if(appearance&&capStillMatches&&appearance.wardrobe===wardrobe&&appearance.wearingIndex===wearingIndex&&appearance.garment===garment&&appearance.garmentPiece===garment?.piece&&appearance.garmentColor===garment?.color&&appearance.printIdValue===garment?.printId&&appearance.artworkIdValue===garment?.artworkId&&appearance.lowerIndex===lowerIndex&&appearance.lower===lower&&appearance.lowerPiece===lower?.piece&&appearance.lowerColor===lower?.color&&appearance.headwearIndex===headwearIndex&&appearance.headwear===headwear&&appearance.headwearPiece===headwear?.piece&&appearance.headwearColor===headwear?.color&&appearance.footwearIndex===footwearIndex&&appearance.footwear===footwear&&appearance.footwearPiece===footwear?.piece&&appearance.footwearColor===footwear?.color&&appearance.handwearIndex===handwearIndex&&appearance.handwear===handwear&&appearance.handwearPiece===handwear?.piece&&appearance.handwearColor===handwear?.color&&appearance.partyCapPiece===currentPartyCap?.piece&&appearance.partyCapColor===currentPartyCap?.color&&appearance.partyCapNumber===currentPartyCap?.partyNumber&&appearance.partyCapFlag===currentPartyCap?.partyFlag&&appearance.capId===capId&&appearance.cesta===cesta)return appearance;
    const piece=RENDERED_GARMENTS.includes(garment?.piece)?garment.piece:null,printed=PRINTED_GARMENTS.has(piece),patterned=PATTERNED_GARMENTS.has(piece),garmentHex=typeof garment?.color==='number'?`#${garment.color.toString(16).padStart(6,'0')}`:typeof garment?.color==='string'&&/^#[0-9a-f]{6}$/i.test(garment.color)?garment.color:'#8d806e',printId=garment?.printId||TROPICAL_PRINTS[entity.id%TROPICAL_PRINTS.length],garmentMaterial=printed?this.printedMaterial(piece,garmentHex,printId,garment?.artPrint):null,lowerSkirt=SKIRT_PIECES.has(lower?.piece)?lower.piece:null;
    let partyCap=currentPartyCap||null,partyCapIndex=partyCap?wardrobe.indexOf(partyCap):-1;
    const hat=cesta?{piece:'cesta',color:0xb8874f}:partyCap||headwear,items=[hat,footwear,lower,handwear];if(partyCap?.partyNumber!=null)items.push({piece:`party-number-${partyCap.partyNumber}`,color:partyCap.partyFlag?.foreground||'#f7f0dc'});
    appearance={wardrobe,wearingIndex,garment,garmentPiece:garment?.piece,garmentColor:garment?.color,printIdValue:garment?.printId,artworkIdValue:garment?.artworkId,lowerIndex,lower,lowerPiece:lower?.piece,lowerColor:lower?.color,headwearIndex,headwear,headwearPiece:headwear?.piece,headwearColor:headwear?.color,footwearIndex,footwear,footwearPiece:footwear?.piece,footwearColor:footwear?.color,handwearIndex,handwear,handwearPiece:handwear?.piece,handwearColor:handwear?.color,capId,cesta,partyCap,partyCapIndex,partyCapPiece:partyCap?.piece,partyCapColor:partyCap?.color,partyCapNumber:partyCap?.partyNumber,partyCapFlag:partyCap?.partyFlag,piece,printed,patterned,garmentHex,printId,garmentMaterial,lowerSkirt,items};
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
  printedMaterial(piece,baseColor='#ffffff',printId='hibisco',artPrint=null){
    if(artPrint)return this.artworkPrintMaterial(artPrint);
    if(piece==='camisa estampada'||piece==='vestido estampado')return this.tropicalPrintMaterial();
    return this.legacyPrintedMaterial(piece,baseColor,printId);
  }
  artworkPrintMaterial(artPrint){
    const key=`artwork-print:${artPrint.cacheKey||artPrint.artId}`;if(this.printMaterials.has(key))return this.printMaterials.get(key);if(typeof document==='undefined'||!this.THREE.CanvasTexture)return this.material;const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),ink='#352c27',color=/^#[0-9a-f]{6}$/i.test(artPrint.color)?artPrint.color:'#9b5944';ctx.fillStyle='#eee2cc';ctx.fillRect(0,0,128,128);ctx.strokeStyle=ink;ctx.lineWidth=5;ctx.strokeRect(5,5,118,118);
    let texture;if(artPrint.partyFlag){const repaint=()=>{drawPartyFlag(ctx,artPrint.partyFlag,13,13,102,67,()=>{repaint();if(texture)texture.needsUpdate=true;});};repaint();ctx.fillStyle='#f7f0dc';ctx.fillRect(12,84,104,30);ctx.fillStyle=ink;ctx.font='bold 22px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(artPrint.partyNumber??''),64,99,96);}
    else{ctx.fillStyle=color;ctx.fillRect(21,15,86,65);ctx.fillStyle='rgba(255,255,255,.62)';ctx.beginPath();ctx.arc(64,47,22,0,Math.PI*2);ctx.fill();ctx.fillStyle=color;ctx.beginPath();if(artPrint.kind==='flags'){ctx.moveTo(38,31);ctx.lineTo(52,31);ctx.lineTo(45,52);ctx.closePath();ctx.moveTo(58,31);ctx.lineTo(72,31);ctx.lineTo(65,52);ctx.closePath();ctx.moveTo(78,31);ctx.lineTo(92,31);ctx.lineTo(85,52);ctx.closePath();}else if(['statue','monument'].includes(artPrint.kind)){ctx.rect(45,35,38,26);ctx.arc(64,28,10,0,Math.PI*2);}else{ctx.moveTo(39,57);ctx.lineTo(47,39);ctx.lineTo(56,54);ctx.lineTo(67,29);ctx.lineTo(79,55);ctx.lineTo(89,43);ctx.lineTo(96,59);ctx.closePath();}ctx.fill();ctx.fillStyle=ink;ctx.font='bold 11px sans-serif';ctx.textAlign='center';const words=String(artPrint.message||'ARTE').split(/\s+/);let lines=[],line='';for(const word of words){if(line&&ctx.measureText(`${line} ${word}`).width>112){lines.push(line);line=word;}else line=line?`${line} ${word}`:word;}if(line)lines.push(line);for(let i=0;i<Math.min(3,lines.length);i++)ctx.fillText(lines[i],64,91+i*12,112);}
    texture??=new this.THREE.CanvasTexture(canvas);texture.magFilter=this.THREE.NearestFilter;texture.minFilter=this.THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=this.THREE.SRGBColorSpace;const material=this.enableWeightMorph(new this.THREE.MeshLambertMaterial({color:0xffffff,map:texture,side:this.THREE.DoubleSide}));this.printMaterials.set(key,material);return material;
  }
  tropicalPrintMaterial(){
    if(this.printAtlasMaterial)return this.printAtlasMaterial;
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
    const material=this.enableWeightMorph(new this.THREE.MeshLambertMaterial({color:0xffffff,map:texture,side:this.THREE.DoubleSide})),baseCompile=material.onBeforeCompile,baseCacheKey=material.customProgramCacheKey;
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float instancePattern;\nvarying float vCitizenPattern;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCitizenPattern = instancePattern;');
      baseCompile(shader);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vCitizenPattern;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#ifdef USE_MAP\n  vec2 patternUv = vec2((mod(floor(vCitizenPattern + 0.5), 6.0) + fract(vMapUv.x * 2.0)) / 6.0, fract(vMapUv.y * 2.0));\n  vec4 tropicalPattern = texture2D(map, patternUv);\n  diffuseColor.rgb = mix(diffuseColor.rgb, tropicalPattern.rgb * vColor, tropicalPattern.a);\n#endif');
    };
    material.customProgramCacheKey=()=>`${baseCacheKey()}:citizen-print-atlas-1`;
    this.printAtlasMaterial=material;return material;
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
    const material=this.enableWeightMorph(new this.THREE.MeshLambertMaterial({color:0xffffff,map:texture,side:this.THREE.DoubleSide}));this.printMaterials.set(key,material);return material;
  }
  async load(){
    if(!this.fetchAsset)throw Error('Carregamento de OBJ indisponível');
    const entries=await Promise.all(Object.entries(CITIZEN_MODEL_FRAMES).flatMap(([clip,frames])=>frames.map(async frame=>{
      const response=await this.fetchAsset(new URL(`${clip}/${frame}.obj`,this.baseURL));if(!response.ok)throw Error(`Falha em ${clip}/${frame}.obj (${response.status})`);
      return {key:`${clip}:${frame}`,data:parseCitizenOBJ(await response.text())};
    })));
    const references={idle:entries.find(e=>e.key==='idle:0').data,animated:entries.find(e=>e.key==='run:0').data};
    const masks=Object.fromEntries(Object.entries(references).map(([key,data])=>[key,Object.fromEntries(RENDERED_GARMENTS.map(piece=>[piece,garmentSurface(data,piece)]))]));
    const idle=references.idle.bounds,height=idle.max[1]-idle.min[1];if(!(height>0))throw Error('Modelo sem altura');
    const origin=[(idle.min[0]+idle.max[0])/2,Math.min(...entries.map(e=>e.data.bounds.min[1])),(idle.min[2]+idle.max[2])/2],factor=1.05/height;
    for(const {key,data}of entries){const positions=data.positions;for(let i=0;i<positions.length;i++)positions[i]=(positions[i]-origin[i%3])*factor;
      const geometry=new this.THREE.BufferGeometry();geometry.setAttribute('position',new this.THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new this.THREE.Float32BufferAttribute(data.normals,3));geometry.computeBoundingSphere();this.frames.set(key,geometry);
      const source=/^(run|use):/.test(key)?'animated':'idle';
      const skirtCuts={};
      for(const piece of ['saia','saia longa']){
        if(key==='use:2'||key.startsWith('sentado_no_')||POSED_SKIRT_FRAMES.has(key)){
          const mask=posedSkirtMask(data,key);skirtCuts[piece]={mask,parts:splitGarmentSurface(data,mask,piece)};
        }else{
          const surface=hipKneeSkirtSurface(data,piece),mask=hipKneeSkirtBodyMask(data,surface),parts=splitGarmentSurface(data,mask,piece);parts.clothes=surface.positions;parts.clothesNormals=surface.normals;skirtCuts[piece]={mask,parts};
        }
      }
      for(const piece of RENDERED_GARMENTS){
        let parts;
        if(piece==='saia'||piece==='saia longa')parts=skirtCuts[piece].parts;
        else parts=splitGarmentSurface(data,masks[source][piece],piece);
        const make=(positions,normals,withUV=false,hideBack=false)=>{const g=new this.THREE.BufferGeometry();g.setAttribute('position',new this.THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new this.THREE.Float32BufferAttribute(normals,3));if(withUV){let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(let v=0;v<positions.length;v+=3){minX=Math.min(minX,positions[v]);maxX=Math.max(maxX,positions[v]);minY=Math.min(minY,positions[v+1]);maxY=Math.max(maxY,positions[v+1]);}const width=Math.max(.001,maxX-minX),height=Math.max(.001,maxY-minY),uv=new Float32Array(positions.length/3*2);for(let v=0,j=0;v<positions.length;v+=3){uv[j++]=hideBack&&normals[v+2]<-.25?2:(positions[v]-minX)/width;uv[j++]=(positions[v+1]-minY)/height;}g.setAttribute('uv',new this.THREE.Float32BufferAttribute(uv,2));}g.computeBoundingSphere();return g;};
        const printed=PRINTED_GARMENTS.has(piece);
        const garmentMaterial=printed?this.printedMaterial(piece):SKIRT_PIECES.has(piece)?this.skirtMaterial:this.material;
        const outfit={body:make(parts.body,parts.bodyNormals),clothes:make(parts.clothes,parts.clothesNormals,printed,piece==='camisa social'),material:garmentMaterial};
        if(['camisa','camisa social','camisa estampada','camiseta','regata','terno','casaco','trapos'].includes(piece))for(const skirtPiece of SKIRT_PIECES){
          const union=new Uint8Array(skirtCuts[skirtPiece].mask.length),upperMask=masks[source][piece];for(let i=0;i<union.length;i++)union[i]=Number(skirtCuts[skirtPiece].mask[i]||upperMask[i]);
          const combined=splitGarmentSurface(data,union,piece);outfit[skirtPiece==='saia'?'bodyWithSaia':'bodyWithSaiaLonga']=make(combined.body,combined.bodyNormals);
        }
        this.outfits.set(`${key}:${piece}`,outfit);
        if(LOWER_PIECES.has(piece)||HAND_PIECES.has(piece)){const surface=parts.clothes.slice();for(let i=0;i<surface.length;i++)surface[i]+=parts.clothesNormals[i]*.002;this.headwear.set(`${key}:${piece}`,make(surface,parts.clothesNormals));}
      }
      for(const piece of ['boné','cartola','chapéu','chapéu nordestino','chapéu de cangaceiro','chapéu de couro','chapéu de vaqueiro','chapéu de palha pequeno','chapéu de palha médio','chapéu de palha grande','cesta']){const part=headwearSurface(data,piece),g=new this.THREE.BufferGeometry();g.setAttribute('position',new this.THREE.Float32BufferAttribute(part.positions,3));g.setAttribute('normal',new this.THREE.Float32BufferAttribute(part.normals,3));g.computeBoundingSphere();this.headwear.set(`${key}:${piece}`,g);}
    }
    this.ready=true;return true;
  }
  begin(dt=0,speed=1){this.frameToken++;this.animationPaused=speed<=0;this.frameDelta=Math.max(0,Math.min(.1,dt));this.clock+=this.frameDelta*Math.max(0,Math.min(2,speed));this.activeCampaignFlags.clear();for(const batch of this.activeBatches){batch.count=0;if(batch.mesh)batch.mesh.count=0;if(batch.clothingMesh)batch.clothingMesh.count=0;}this.activeBatches.clear();for(const batch of this.activeHeadwearBatches){batch.count=0;if(batch.mesh)batch.mesh.count=0;}this.activeHeadwearBatches.clear();}
  add(entity,surfaceH,{hidden=false,dimmed=false,perspective=false,smoothMovement=false,vehicleAngle=null,visualOffset=null,activeCampaignElectionId=null,activeCampaignStatus=null}={}){
    if(!this.ready)return false;
    const c=entity.properties.citizen;if(!c)return false;
    if(hidden)return true;
    const inside=c.ridingVehicleId?null:c._renderIndoorPosition||c.indoorLocation?.position,posePoint=!citizenHasPath(c)&&!c.indoorLocation?.path?.length&&(c.furnitureUse?.pose==='lying'||c.furnitureUse?.seated)?c.furnitureUse.posePoint:null,x=posePoint?.x??inside?.x??entity.x,y=posePoint?.y??inside?.y??entity.y;
    let motion=this.motion.get(entity);
     if(!motion){motion={x,y,renderX:x,renderY:y,angle:0,renderAngle:0,walkDistance:0,walkFrame:0,lastStepAt:-Infinity};this.motion.set(entity,motion);}
    const dx=x-motion.x,dy=y-motion.y;
    const moved=dx*dx+dy*dy>1e-7;
     if(moved){motion.angle=Math.atan2(dx,dy);if(!this.animationPaused)motion.walkDistance+=Math.hypot(dx,dy);motion.x=x;motion.y=y;}
    if(c.ridingVehicleId&&Number.isFinite(vehicleAngle))motion.angle=vehicleAngle+(c.ridingAsPassenger?Math.PI/2:0);
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
    // Keep quarter-tile footsteps, but present adjacent poses instead of skipping
    // a full animation cycle when a worker snapshot jumps several tiles.
    if(moved&&!this.animationPaused&&motion.walkDistance+1e-8>=.25&&this.clock-motion.lastStepAt>=.1-1e-8){motion.walkFrame++;motion.walkDistance=Math.max(0,motion.walkDistance%.25);motion.lastStepAt=this.clock;}
    // A pending path is not movement. Hold the travel pose between footsteps;
    // work animations still use the simulation's presentation clock.
    const traveling=moved||citizenHasPath(c)||!!c.indoorLocation?.path?.length||!!c.deliveryId||!!c.mobilityTrip&&c.mobilityTrip.stage!=='boarding';
    const sleeping=citizenIsSleeping(c),lying=!sleeping&&!traveling&&c.furnitureUse?.pose==='lying',clip=citizenAnimation(c,traveling),actionState=clip==='murro'||clip==='chute'||clip==='derrotado',actionToken=c.combatAnimation?.sequence??c.combatReaction?.sequence??c.unconsciousUntil??null;
    if(actionState){const token=`${clip}:${actionToken??''}`;if(motion.actionToken!==token){motion.actionToken=token;motion.actionStartedAt=this.clock;}}
    else motion.actionToken=null;
    const animationTime=clip==='run'||clip==='pedal'?motion.walkFrame/8:actionState?this.clock-(motion.actionStartedAt??this.clock):this.clock,pose=citizenFrame(clip,animationTime,actionState?0:(entity.id*13)%17,actionState),key=`${pose.clip}:${pose.frame}`;
    if(!traveling&&!sleeping&&c.facingTarget)motion.angle=Math.atan2(c.facingTarget.x-x,c.facingTarget.y-y);
    const appearance=this.appearanceFor(c,entity),{piece,printed,patterned,garment,garmentHex,printId,garmentMaterial,lower,lowerSkirt}=appearance,outfitKey=piece?`${key}:${piece}`:null,outfit=outfitKey?this.outfits.get(outfitKey):null,skirtOutfit=lowerSkirt?this.outfits.get(`${key}:${lowerSkirt}`):null,batchKey=piece?`${key}:${piece}${printed&&!patterned?`:${garmentHex}:${printId}:${garment?.artworkId||''}`:''}${lowerSkirt?`+${lowerSkirt}`:''}`:lowerSkirt?`${key}:lower:${lowerSkirt}`:key,bodyWithSkirt=lowerSkirt?outfit?.[lowerSkirt==='saia'?'bodyWithSaia':'bodyWithSaiaLonga']:null,bodySource=bodyWithSkirt||skirtOutfit?.body||outfit?.body||this.frames.get(key);
    let batch=this.batches.get(batchKey);if(!batch){batch={count:0,capacity:0,mesh:null,clothingMesh:null};this.batches.set(batchKey,batch);}this.activeBatches.add(batch);
    if(batch.count===batch.capacity){
      // Citizen bodies are already rendered in shared animation/outfit batches.
      // Let the sun light them, but keep hundreds of moving low-poly bodies out
      // of the directional shadow-map pass on mobile GPUs.
      const capacity=Math.max(32,batch.capacity*2),mesh=new this.THREE.InstancedMesh(this.instancedGeometry(bodySource,capacity),this.material,capacity);mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;
      if(batch.mesh){for(let i=0;i<batch.count;i++){batch.mesh.getMatrixAt(i,this.matrix);mesh.setMatrixAt(i,this.matrix);batch.mesh.getColorAt(i,this.color);this.setInstanceColor(mesh,i,this.color);const oldFat=batch.mesh.geometry.attributes.instanceFat,newFat=mesh.geometry.attributes.instanceFat;if(oldFat&&newFat){newFat.array[i]=oldFat.array[i];mesh.userData.instanceFatDirty=true;}const oldPattern=batch.mesh.geometry.attributes.instancePattern,newPattern=mesh.geometry.attributes.instancePattern;if(oldPattern&&newPattern){newPattern.array[i]=oldPattern.array[i];mesh.userData.instancePatternDirty=true;}}if(batch.count){mesh.userData.instanceMatrixDirty=true;mesh.userData.matrixDirtyMin=0;mesh.userData.matrixDirtyMax=batch.count-1;}this.group.remove(batch.mesh);batch.mesh.dispose();}
      this.group.add(mesh);batch.mesh=mesh;
      if(outfit){const clothing=new this.THREE.InstancedMesh(this.instancedGeometry(outfit.clothes,capacity),garmentMaterial||outfit.material||this.material,capacity);clothing.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);clothing.frustumCulled=false;clothing.castShadow=false;clothing.receiveShadow=false;
        if(batch.clothingMesh){for(let i=0;i<batch.count;i++){batch.clothingMesh.getMatrixAt(i,this.matrix);clothing.setMatrixAt(i,this.matrix);batch.clothingMesh.getColorAt(i,this.color);this.setInstanceColor(clothing,i,this.color);const oldFat=batch.clothingMesh.geometry.attributes.instanceFat,newFat=clothing.geometry.attributes.instanceFat;if(oldFat&&newFat){newFat.array[i]=oldFat.array[i];clothing.userData.instanceFatDirty=true;}const oldPattern=batch.clothingMesh.geometry.attributes.instancePattern,newPattern=clothing.geometry.attributes.instancePattern;if(oldPattern&&newPattern){newPattern.array[i]=oldPattern.array[i];clothing.userData.instancePatternDirty=true;}}if(batch.count){clothing.userData.instanceMatrixDirty=true;clothing.userData.matrixDirtyMin=0;clothing.userData.matrixDirtyMax=batch.count-1;}this.group.remove(batch.clothingMesh);batch.clothingMesh.dispose();}
        this.group.add(clothing);batch.clothingMesh=clothing;
      }batch.capacity=capacity;
    }
    const bikeRider=c.ridingVehicleId&&BIKE_KINDS.has(c.ridingVehicleKind),riderLift=bikeRider?(c.ridingAsPassenger?0.23:0.38):c.ridingVehicleId?0.18:0;
    const size=(entity.properties.render.size||1)*(perspective?1.05:1),heightScale=(c.bodyHeightCm||170)/170,positionY=surfaceH+(posePoint?.z??inside?.z??0)+riderLift,bodyIndex=batch.count;
    const transformUnchanged=motion.bodyBatch===batch&&motion.bodyMesh===batch.mesh&&motion.clothingMesh===batch.clothingMesh&&motion.bodyIndex===bodyIndex&&motion.bodyFrame===this.frameToken-1&&motion.bodyX===renderX&&motion.bodyY===positionY&&motion.bodyZ===renderY&&motion.bodyAngle===renderAngle&&motion.bodySize===size&&motion.bodyHeightScale===heightScale&&motion.bodyLying===lying;
    this.position.set(renderX,positionY,renderY);
    let matrixReady=transformUnchanged;
    if(!transformUnchanged){this.quaternion.setFromAxisAngle(this.axis,renderAngle);if(lying)this.quaternion.multiply(this.lyingRotation);this.scale.set(size,size*heightScale,size);this.matrix.compose(this.position,this.quaternion,this.scale);this.setInstanceMatrix(batch.mesh,bodyIndex,this.matrix);motion.bodyBatch=batch;motion.bodyMesh=batch.mesh;motion.clothingMesh=batch.clothingMesh;motion.bodyIndex=bodyIndex;motion.bodyX=renderX;motion.bodyY=positionY;motion.bodyZ=renderY;motion.bodyAngle=renderAngle;motion.bodySize=size;motion.bodyHeightScale=heightScale;motion.bodyLying=lying;matrixReady=true;}
    motion.bodyFrame=this.frameToken;
    this.setInstanceFat(batch.mesh,bodyIndex,c);
    const presence=c.campaignPresence?.electionId===activeCampaignElectionId&&activeCampaignStatus==='campaign'?c.campaignPresence:null;
    const flag=c.campaign?.partyFlag||c.campaign?.flag||presence?.partyFlag;
    if(flag&&!c.ridingVehicleId&&!c.mobilityTrip&&!c.deliveryId){
      const flagKey=JSON.stringify(flag);let carrier=this.campaignFlags.get(entity.id);
      if(!carrier||carrier.flagKey!==flagKey){if(carrier){this.group.remove(carrier.group);carrier.group.traverse(o=>{o.geometry?.dispose();if(o.material!==carrier.material)o.material?.dispose();});}let material=this.campaignFlagMaterials.get(flagKey);if(!material){let texture;const canvas=partyFlagCanvas(flag,()=>{if(texture)texture.needsUpdate=true;});texture=new this.THREE.CanvasTexture(canvas);texture.magFilter=this.THREE.NearestFilter;texture.minFilter=this.THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=this.THREE.SRGBColorSpace;material=new this.THREE.MeshLambertMaterial({map:texture,side:this.THREE.DoubleSide});this.campaignFlagMaterials.set(flagKey,material);}const group=new this.THREE.Group(),pole=new this.THREE.Mesh(new this.THREE.CylinderGeometry(.018,.024,.96,5),new this.THREE.MeshLambertMaterial({color:0x795b3e})),cloth=new this.THREE.Mesh(clothFlagGeometry(this.THREE,.48,.30),material);pole.position.set(-.24,.68,-.19);cloth.position.set(0,1.02,-.25);group.add(pole,cloth);group.userData.cloth=cloth;this.group.add(group);carrier={group,material,flagKey};this.campaignFlags.set(entity.id,carrier);}
      carrier.group.position.copy(this.position);carrier.group.scale.setScalar(size);carrier.group.rotation.y=renderAngle;animateClothFlag(carrier.group.userData.cloth,Math.floor(this.clock*10)/10,(entity.id%19)*.31);this.activeCampaignFlags.add(entity.id);
    }
    this.color.setHex(entity.combatFlash>0?0xff3333:dimmed?0x555555:entity.properties.render.color??0xe8e8e8);this.setInstanceColor(batch.mesh,batch.count,this.color);
    if(batch.clothingMesh){if(!transformUnchanged)this.setInstanceMatrix(batch.clothingMesh,bodyIndex,this.matrix);this.setInstanceFat(batch.clothingMesh,bodyIndex,c);if(patterned)this.setInstancePattern(batch.clothingMesh,bodyIndex,printId);const raw=garment?.color,hex=typeof raw==='number'?raw:typeof raw==='string'&&/^#[0-9a-f]{6}$/i.test(raw)?parseInt(raw.slice(1),16):0x8d806e;this.color.setHex(entity.combatFlash>0?0xff3333:dimmed?0x555555:patterned?hex:printed?0xffffff:presence?.color?Number.parseInt(String(presence.color).replace('#',''),16):hex);if(!dimmed&&entity.combatFlash<=0&&(garment?.dirt||0)>0)this.color.lerp(new this.THREE.Color(0x62584b),Math.min(.72,garment.dirt/140));this.setInstanceColor(batch.clothingMesh,bodyIndex,this.color);}batch.count++;
    const items=appearance.items;
    motion.accessoryTransforms??=[{},{},{},{},{}];
    for(let itemIndex=0;itemIndex<5;itemIndex++){const item=items[itemIndex];if(!item||!RENDERED_ACCESSORIES.has(item.piece)&&!item.piece.startsWith('party-number-')){motion.accessoryTransforms[itemIndex].key=null;continue;}
      const itemKey=`${key}:${item.piece}`,isPartyNumber=item.piece.startsWith('party-number-'),isFittedClothing=LOWER_PIECES.has(item.piece)||HAND_PIECES.has(item.piece);let source=this.headwear.get(itemKey);if(!source&&isPartyNumber){source=partyNumberSurface(this.THREE,this.frames.get(key),item.piece.slice('party-number-'.length));this.headwear.set(itemKey,source);}let head=this.headwearBatches.get(itemKey);
      if(!head){head={count:0,capacity:0,mesh:null};this.headwearBatches.set(itemKey,head);}this.activeHeadwearBatches.add(head);
      if(head.count===head.capacity){
        const capacity=Math.max(32,head.capacity*2),itemMaterial=SKIRT_PIECES.has(item.piece)?this.skirtMaterial:this.material,mesh=new this.THREE.InstancedMesh(isFittedClothing?this.instancedGeometry(source,capacity):source,itemMaterial,capacity);mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;
        if(head.mesh){for(let i=0;i<head.count;i++){head.mesh.getMatrixAt(i,this.matrix);mesh.setMatrixAt(i,this.matrix);head.mesh.getColorAt(i,this.color);this.setInstanceColor(mesh,i,this.color);const oldFat=head.mesh.geometry.attributes.instanceFat,newFat=mesh.geometry.attributes.instanceFat;if(oldFat&&newFat){newFat.array[i]=oldFat.array[i];mesh.userData.instanceFatDirty=true;}}if(head.count){mesh.userData.instanceMatrixDirty=true;mesh.userData.matrixDirtyMin=0;mesh.userData.matrixDirtyMax=head.count-1;}this.group.remove(head.mesh);head.mesh.dispose();}
        this.group.add(mesh);head.mesh=mesh;head.capacity=capacity;this.matrix.compose(this.position,this.quaternion,this.scale);
      }
      const accessoryIndex=head.count,accessoryTransform=motion.accessoryTransforms[itemIndex],accessoryUnchanged=transformUnchanged&&accessoryTransform.key===itemKey&&accessoryTransform.batch===head&&accessoryTransform.mesh===head.mesh&&accessoryTransform.index===accessoryIndex;
      if(!accessoryUnchanged){if(!matrixReady){this.quaternion.setFromAxisAngle(this.axis,renderAngle);if(lying)this.quaternion.multiply(this.lyingRotation);this.scale.set(size,size*heightScale,size);this.matrix.compose(this.position,this.quaternion,this.scale);matrixReady=true;}this.setInstanceMatrix(head.mesh,accessoryIndex,this.matrix);}
      accessoryTransform.key=itemKey;accessoryTransform.batch=head;accessoryTransform.mesh=head.mesh;accessoryTransform.index=accessoryIndex;if(isFittedClothing)this.setInstanceFat(head.mesh,accessoryIndex,c);
      const raw=item.color,hex=typeof raw==='number'?raw:typeof raw==='string'&&/^#[0-9a-f]{6}$/i.test(raw)?parseInt(raw.slice(1),16):0x8d806e;this.color.setHex(entity.combatFlash>0?0xff3333:dimmed?0x555555:hex);if(!dimmed&&entity.combatFlash<=0&&(item.dirt||0)>0)this.color.lerp(new this.THREE.Color(0x62584b),Math.min(.72,item.dirt/140));this.setInstanceColor(head.mesh,head.count,this.color);head.count++;
    }
    return true;
  }
  end(){
    const flushBatch=batch=>{
      batch.mesh.count=batch.count;
      if(batch.count){this.flushInstanceMatrix(batch.mesh);if(batch.mesh.instanceColor&&batch.mesh.userData.instanceColorDirty){batch.mesh.instanceColor.needsUpdate=true;batch.mesh.userData.instanceColorDirty=false;}const fat=batch.mesh.geometry.attributes.instanceFat;if(fat&&batch.mesh.userData.instanceFatDirty){fat.needsUpdate=true;batch.mesh.userData.instanceFatDirty=false;}this.flushInstancePattern(batch.mesh);}
      if(batch.clothingMesh){batch.clothingMesh.count=batch.count;if(batch.count){this.flushInstanceMatrix(batch.clothingMesh);if(batch.clothingMesh.instanceColor&&batch.clothingMesh.userData.instanceColorDirty){batch.clothingMesh.instanceColor.needsUpdate=true;batch.clothingMesh.userData.instanceColorDirty=false;}const fat=batch.clothingMesh.geometry.attributes.instanceFat;if(fat&&batch.clothingMesh.userData.instanceFatDirty){fat.needsUpdate=true;batch.clothingMesh.userData.instanceFatDirty=false;}this.flushInstancePattern(batch.clothingMesh);}}
    };
    for(const batch of this.activeBatches)flushBatch(batch);
    for(const batch of this.activeHeadwearBatches){batch.mesh.count=batch.count;if(batch.count){this.flushInstanceMatrix(batch.mesh);if(batch.mesh.instanceColor&&batch.mesh.userData.instanceColorDirty){batch.mesh.instanceColor.needsUpdate=true;batch.mesh.userData.instanceColorDirty=false;}const fat=batch.mesh.geometry.attributes.instanceFat;if(fat&&batch.mesh.userData.instanceFatDirty){fat.needsUpdate=true;batch.mesh.userData.instanceFatDirty=false;}this.flushInstancePattern(batch.mesh);}}
    for(const [id,carrier]of this.campaignFlags)if(!this.activeCampaignFlags.has(id)){this.group.remove(carrier.group);carrier.group.traverse(o=>{o.geometry?.dispose();if(o.material!==carrier.material)o.material?.dispose();});this.campaignFlags.delete(id);}
  }
  clear(){for(const b of this.batches.values()){this.group.remove(b.mesh);b.mesh.dispose();if(b.clothingMesh){this.group.remove(b.clothingMesh);b.clothingMesh.dispose();}}for(const b of this.headwearBatches.values()){this.group.remove(b.mesh);b.mesh.dispose();}for(const carrier of this.campaignFlags.values()){this.group.remove(carrier.group);carrier.group.traverse(o=>{o.geometry?.dispose();if(o.material!==carrier.material)o.material?.dispose();});}for(const material of this.campaignFlagMaterials.values()){material.map?.dispose();material.dispose();}this.campaignFlags.clear();this.campaignFlagMaterials.clear();this.activeCampaignFlags.clear();this.activeBatches.clear();this.activeHeadwearBatches.clear();this.batches.clear();this.headwearBatches.clear();this.motion=new WeakMap();this.clock=0;}
}
