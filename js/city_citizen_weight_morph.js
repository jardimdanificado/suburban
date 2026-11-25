import {CITIZEN_BODY_FACE_COUNT} from './city_garment_faces.js?v=shared-anatomical-faces-2';

const range=(start,end)=>Array.from({length:end-start+1},(_,i)=>start+i);
const MIRROR=123;
const FOOT=[0,...range(35,43)];
const SHIN=range(54,61);
const KNEE=range(44,47);
const THIGH=range(1,8);
const HAND=range(82,93);
const FOREARM=range(66,73);
const ELBOW=range(94,97);
const UPPERARM=range(74,81);
const SHOULDER=range(98,104);
const HEAD_NECK=[...range(11,34),121];
const TORSO=[9,10,...range(48,53),...range(62,65),...range(105,120),122];

const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=a=>Math.hypot(a[0],a[1],a[2]);
const unit=a=>{const n=length(a);return n>1e-10?mul(a,1/n):[0,1,0];};
const mean=items=>{const s=[0,0,0];for(const p of items){s[0]+=p[0];s[1]+=p[1];s[2]+=p[2];}return mul(s,1/(items.length||1));};
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const smooth=(lo,hi,v)=>{const t=clamp((v-lo)/(hi-lo),0,1);return t*t*(3-2*t);};

function perpTo(v,origin,axis){
  const rel=sub(v,origin),axial=dot(rel,axis);
  return {axial,radial:sub(rel,mul(axis,axial))};
}

function segProj(v,a,b){
  const ab=sub(b,a),len2=dot(ab,ab);
  const t=len2>1e-10?clamp(dot(sub(v,a),ab)/len2,0,1):0;
  const proj=add(a,mul(ab,t));
  return {t,proj,radial:sub(v,proj)};
}

/**
 * Computes a pose-invariant 3D per-vertex weight displacement lookup for a
 * cleaned 246-triangle citizen pose. Limbs expand radially around their local
 * bone centerlines, torso expands around the spine axis, and feet remain rigid
 * so bent legs, raised arms, and lifted feet never shear or spike.
 */
export function createPoseWeightMorph(data){
  if(data.positions.length/9!==CITIZEN_BODY_FACE_COUNT)throw Error('Topologia incompatível com o morph corporal');
  const verts=new Map(),faces=[];
  for(let face=0;face<CITIZEN_BODY_FACE_COUNT;face++){
    const keys=[];
    for(let corner=0;corner<3;corner++){
      const offset=face*9+corner*3,p=[data.positions[offset],data.positions[offset+1],data.positions[offset+2]],k=p.join(',');
      if(!verts.has(k))verts.set(k,p);
      keys.push(k);
    }
    faces.push(keys);
  }
  const vertsOf=(ids,offset=0)=>{const s=new Set();for(const id of ids)for(const k of faces[id+offset])s.add(k);return s;};
  const intersect=(a,b)=>[...a].filter(x=>b.has(x));
  const centerOf=keys=>mean(keys.map(k=>verts.get(k)));

  const side=offset=>{
    const footV=vertsOf(FOOT,offset),shinV=vertsOf(SHIN,offset),kneeV=vertsOf(KNEE,offset),thighV=vertsOf(THIGH,offset);
    const handV=vertsOf(HAND,offset),forearmV=vertsOf(FOREARM,offset),elbowV=vertsOf(ELBOW,offset),upperArmV=vertsOf(UPPERARM,offset),shoulderV=vertsOf(SHOULDER,offset);
    const torsoV=vertsOf(TORSO,offset);
    return {
      footV,shinV,kneeV,thighV,handV,forearmV,elbowV,upperArmV,shoulderV,
      hipCenter:centerOf(intersect(thighV,torsoV)),
      kneeCenter:mul(add(centerOf(intersect(thighV,kneeV)),centerOf(intersect(shinV,kneeV))),0.5),
      ankleCenter:centerOf(intersect(shinV,footV)),
      shoulderCenter:centerOf(intersect(upperArmV,shoulderV)),
      elbowCenter:mul(add(centerOf(intersect(upperArmV,elbowV)),centerOf(intersect(forearmV,elbowV))),0.5),
      wristCenter:centerOf(intersect(forearmV,handV)),
    };
  };

  const L=side(0),R=side(MIRROR);
  const allTorsoV=new Set([...vertsOf(TORSO,0),...vertsOf(TORSO,MIRROR),...vertsOf(SHOULDER,0),...vertsOf(SHOULDER,MIRROR)]);
  const allHeadV=new Set([...vertsOf(HEAD_NECK,0),...vertsOf(HEAD_NECK,MIRROR)]);
  const neckRing=new Set(intersect(allHeadV,allTorsoV));
  const neckCenter=centerOf([...neckRing]);
  const pelvisCenter=mul(add(L.hipCenter,R.hipCenter),0.5);
  const spineVec=sub(neckCenter,pelvisCenter),spineLen=length(spineVec)||1,spineAxis=mul(spineVec,1/spineLen);
  const headCenter=centerOf([...allHeadV]);
  const headAxis=unit(sub(headCenter,neckCenter));

  const torsoWeight=s=>{
    const belly=smooth(0.0,0.45,s)*(1-smooth(0.45,0.95,s));
    return 0.36*(1-smooth(0.75,1.0,s))+0.12*smooth(0.75,1.0,s)+0.18*belly;
  };

  const shoulderShiftL=mul(perpTo(L.shoulderCenter,pelvisCenter,spineAxis).radial,0.34);
  const shoulderShiftR=mul(perpTo(R.shoulderCenter,pelvisCenter,spineAxis).radial,0.34);
  const hipShiftL=mul(perpTo(L.hipCenter,pelvisCenter,spineAxis).radial,0.36);
  const hipShiftR=mul(perpTo(R.hipCenter,pelvisCenter,spineAxis).radial,0.36);

  const deltas=new Map();
  for(const [k,v]of verts){
    let d=[0,0,0];
    const inFoot=L.footV.has(k)||R.footV.has(k);
    const inShin=L.shinV.has(k)||R.shinV.has(k);
    const inKnee=L.kneeV.has(k)||R.kneeV.has(k);
    const inThigh=L.thighV.has(k)||R.thighV.has(k);
    const inHand=L.handV.has(k)||R.handV.has(k);
    const inForearm=L.forearmV.has(k)||R.forearmV.has(k);
    const inElbow=L.elbowV.has(k)||R.elbowV.has(k);
    const inUpperArm=L.upperArmV.has(k)||R.upperArmV.has(k);

    if(neckRing.has(k)){
      d=mul(perpTo(v,neckCenter,headAxis).radial,0.12);
    }else if(allTorsoV.has(k)){
      const {axial,radial}=perpTo(v,pelvisCenter,spineAxis);
      d=mul(radial,torsoWeight(axial/spineLen));
    }else if(allHeadV.has(k)){
      d=mul(perpTo(v,headCenter,headAxis).radial,0.12);
    }else if(inThigh||inKnee||inShin){
      const isL=L.thighV.has(k)||L.kneeV.has(k)||L.shinV.has(k);
      const S=isL?L:R,hipShift=isL?hipShiftL:hipShiftR;
      if(inFoot){
        d=mul(sub(v,S.ankleCenter),0.05);
      }else if(inThigh&&!inKnee){
        const {t,radial}=segProj(v,S.hipCenter,S.kneeCenter);
        d=add(mul(hipShift,1-0.5*t),mul(radial,0.36*(1-t)+0.26*t));
      }else if(inKnee){
        d=add(mul(hipShift,0.5),mul(sub(v,S.kneeCenter),0.26));
      }else{
        const {t,radial}=segProj(v,S.kneeCenter,S.ankleCenter);
        d=add(mul(hipShift,0.5*(1-t)),mul(radial,0.26*(1-t)+0.05*t));
      }
    }else if(inFoot){
      d=[0,0,0];
    }else if(inUpperArm||inElbow||inForearm){
      const isL=L.upperArmV.has(k)||L.elbowV.has(k)||L.forearmV.has(k);
      const S=isL?L:R,shShift=isL?shoulderShiftL:shoulderShiftR;
      if(inHand){
        d=add(shShift,mul(sub(v,S.wristCenter),0.06));
      }else if(inUpperArm&&!inElbow){
        const {t,radial}=segProj(v,S.shoulderCenter,S.elbowCenter);
        d=add(shShift,mul(radial,0.34*(1-t)+0.26*t));
      }else if(inElbow){
        d=add(shShift,mul(sub(v,S.elbowCenter),0.26));
      }else{
        const {t,radial}=segProj(v,S.elbowCenter,S.wristCenter);
        d=add(shShift,mul(radial,0.26*(1-t)+0.06*t));
      }
    }else if(inHand){
      const isL=L.handV.has(k);
      const S=isL?L:R,shShift=isL?shoulderShiftL:shoulderShiftR;
      d=add(shShift,mul(sub(v,S.wristCenter),0.06));
    }
    deltas.set(k,d);
  }
  return point=>deltas.get(`${point[0]},${point[1]},${point[2]}`)||[0,0,0];
}

/**
 * Computes per-vertex 3D displacement and exact linear/quadratic normal
 * derivatives for a triangle soup subset of a posed citizen mesh.
 */
export function computeWeightMorphAttributes(positions,morphVertex){
  const count=positions.length/3;
  const weightMorph=new Float32Array(positions.length);
  const weightNormalLinear=new Float32Array(positions.length);
  const weightNormalQuadratic=new Float32Array(positions.length);
  for(let i=0;i<count;i+=3){
    const pts=[0,1,2].map(c=>{const at=(i+c)*3;return [positions[at],positions[at+1],positions[at+2]];});
    const ds=pts.map(morphVertex);
    const u=sub(pts[1],pts[0]),v=sub(pts[2],pts[0]),du=sub(ds[1],ds[0]),dv=sub(ds[2],ds[0]);
    const area=length(cross(u,v));
    const linear=area>1e-11?mul(add(cross(du,v),cross(u,dv)),1/area):[0,0,0];
    const quadratic=area>1e-11?mul(cross(du,dv),1/area):[0,0,0];
    for(let c=0;c<3;c++){
      const at=(i+c)*3;
      weightMorph.set(ds[c],at);
      weightNormalLinear.set(linear,at);
      weightNormalQuadratic.set(quadratic,at);
    }
  }
  return {weightMorph,weightNormalLinear,weightNormalQuadratic};
}
