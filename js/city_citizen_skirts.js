import {CITIZEN_BODY_FACE_COUNT} from './city_garment_faces.js?v=shared-anatomical-faces-2';

// Anatomical face groups, shared by every cleaned OBJ pose. Quad groups are
// used for landmarks because some exports choose a different quad diagonal.
const range=(start,end)=>Array.from({length:end-start+1},(_,i)=>start+i);
const PELVIS=[...range(48,53),...range(62,65)];
const THIGH=range(1,8),KNEE=range(44,47),SHIN=range(54,61),FOOT=range(35,43);
const MIRROR=123,SIDES=16,FAT_MIN=-.42,FAT_MAX=1.8;
const add=(a,b)=>a.map((n,i)=>n+b[i]);
const sub=(a,b)=>a.map((n,i)=>n-b[i]);
const mul=(a,s)=>a.map(n=>n*s);
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=a=>Math.hypot(...a);
const unit=a=>{const n=length(a);if(n<1e-10)throw Error('Eixo anatômico da saia degenerado');return mul(a,1/n);};
const mean=items=>mul(items.reduce((sum,p)=>add(sum,p),[0,0,0]),1/items.length);
const blend=(a,b,t)=>({p:add(mul(a.p,1-t),mul(b.p,t)),d:add(mul(a.d,1-t),mul(b.d,t))});
const sample=(a,fat)=>add(a.p,mul(a.d,fat));

function landmarks(data,morphVertex){
  if(data.positions.length/9!==CITIZEN_BODY_FACE_COUNT)throw Error('Topologia incompatível com a saia');
  const vertices=new Map(),faces=[];
  for(let face=0;face<CITIZEN_BODY_FACE_COUNT;face++){
    const ids=[];
    for(let corner=0;corner<3;corner++){
      const offset=face*9+corner*3,p=Array.from(data.positions.subarray(offset,offset+3)),id=p.join(',');
      if(!vertices.has(id))vertices.set(id,{p,d:morphVertex(p)});
      ids.push(id);
    }
    faces.push(ids);
  }
  const members=ids=>new Set(ids.flatMap(face=>faces[face]));
  const intersect=(...sets)=>{
    const found=[...sets[0]].filter(id=>sets.every(set=>set.has(id)));
    if(found.length!==1)throw Error(`Âncora anatômica da saia inválida: ${found.length} vértices`);
    return vertices.get(found[0]);
  };
  const leg=offset=>{
    const group=ids=>members(ids.map(id=>id+offset)),pelvis=group(PELVIS),knee=group(KNEE),foot=group(FOOT);
    const backOuter=group([1,2]),backInner=group([3,4]),frontInner=group([5,6]),frontOuter=group([7,8]);
    const ring=set=>({outer:intersect(backOuter,frontOuter,set),back:intersect(backOuter,backInner,set),inner:intersect(backInner,frontInner,set),front:intersect(frontInner,frontOuter,set)});
    const frontCalfInner=group([54,55]),frontCalfOuter=group([56,57]),backCalfInner=group([58,59]),backCalfOuter=group([60,61]);
    const hip=ring(pelvis),upperKnee=ring(knee);
    const lowerKnee={outer:upperKnee.outer,inner:upperKnee.inner,front:intersect(group([46,47]),frontCalfInner,frontCalfOuter),back:intersect(group([44,45]),backCalfInner,backCalfOuter)};
    const ankle={front:intersect(frontCalfInner,frontCalfOuter,foot),inner:intersect(frontCalfInner,backCalfInner,foot),back:intersect(backCalfInner,backCalfOuter,foot),outer:intersect(frontCalfOuter,backCalfOuter,foot)};
    return {hip,upperKnee,lowerKnee,ankle};
  };
  const left=leg(0),right=leg(MIRROR),pelvisFaces=[...PELVIS,...PELVIS.map(id=>id+MIRROR)],edgeCount=new Map();
  for(const face of pelvisFaces)for(let i=0;i<3;i++){
    const edge=[faces[face][i],faces[face][(i+1)%3]].sort(),id=JSON.stringify(edge);
    const entry=edgeCount.get(id)||{edge,count:0};entry.count++;edgeCount.set(id,entry);
  }
  const hipIds=new Set([...Object.values(left.hip),...Object.values(right.hip)].map(a=>a.p.join(','))),boundary=new Map();
  for(const {edge,count} of edgeCount.values())if(count===1&&!edge.some(id=>hipIds.has(id))){
    for(let i=0;i<2;i++){const neighbors=boundary.get(edge[i])||[];neighbors.push(edge[1-i]);boundary.set(edge[i],neighbors);}
  }
  if(boundary.size!==8||[...boundary.values()].some(neighbors=>neighbors.length!==2))throw Error('Cós da saia sem contorno anatômico fechado');
  const front=intersect(new Set(boundary.keys()),members([64,65]),members([187,188]));
  const frontId=front.p.join(','),leftFront=members([51,52,53]);
  const waist=[front],visited=new Set([frontId]);let current=frontId;
  while(waist.length<8){
    const next=boundary.get(current).find(id=>!visited.has(id)&&(waist.length>1||leftFront.has(id)));
    if(!next)throw Error('Ordem do cós da saia inválida');
    visited.add(next);waist.push(vertices.get(next));current=next;
  }
  return {left,right,waist};
}

const legPoints=(left,right)=>[blend(left.front,right.front,.5),left.front,left.outer,left.back,blend(left.back,right.back,.5),right.back,right.outer,right.front];
const blendRing=(a,b,t)=>a.map((p,i)=>blend(p,b[i],t));
function frameFor(up,previous){
  const rightProjected=sub(previous.right,mul(up,dot(previous.right,up)));
  const right=length(rightProjected)>1e-6?unit(rightProjected):unit(cross(up,previous.forward));
  return {right,up,forward:unit(cross(right,up))};
}

// A circumscribed support polygon, rather than a circle or a box, keeps the
// skirt close to both legs without cutting through the body's angular mesh.
// Taking the chord of the support function at the two allowed weight extremes
// bounds every intermediate weight as well (the support function is convex).
function fittedRing(anchors,frame,clearance){
  const support=fat=>Array.from({length:SIDES},(_,i)=>{
    const angle=i*2*Math.PI/SIDES,normal=add(mul(frame.right,Math.cos(angle)),mul(frame.forward,Math.sin(angle)));
    let owner=anchors[0],height=-Infinity;
    for(const anchor of anchors){const h=dot(sample(anchor,fat),normal);if(h>height){height=h;owner=anchor;}}
    return {height:height+clearance,axial:dot(sample(owner,fat),frame.up)};
  });
  const solve=supports=>supports.map((a,i)=>{
    const b=supports[(i+1)%SIDES],angle=i*2*Math.PI/SIDES,next=(i+1)*2*Math.PI/SIDES,det=Math.sin(next-angle);
    const x=(a.height*Math.sin(next)-Math.sin(angle)*b.height)/det,z=(Math.cos(angle)*b.height-a.height*Math.cos(next))/det;
    return add(add(mul(frame.right,x),mul(frame.forward,z)),mul(frame.up,(a.axial+b.axial)/2));
  });
  const low=solve(support(FAT_MIN)),high=solve(support(FAT_MAX));
  const vertices=low.map((p,i)=>{const d=mul(sub(high[i],p),1/(FAT_MAX-FAT_MIN));return {p:sub(p,mul(d,FAT_MIN)),d};});
  return {vertices,anchors,frame,clearance};
}

function boundWaist(waist,ring){
  const {right,forward,up}=ring.frame,center=mean(waist.map(a=>a.p));
  const projected=waist.map(a=>{const p=sub(a.p,center);return [dot(p,right),dot(p,forward)];});
  const cross2=(a,b)=>a[0]*b[1]-a[1]*b[0];
  const inner=ring.vertices.map(outer=>{
    const relative=sub(outer.p,center),direction=[dot(relative,right),dot(relative,forward)];
    let hit=null;
    for(let edge=0;edge<waist.length;edge++){
      const a=projected[edge],b=projected[(edge+1)%waist.length],delta=[b[0]-a[0],b[1]-a[1]],det=cross2(direction,delta);
      if(Math.abs(det)<1e-10)continue;
      const distance=cross2(a,delta)/det,t=cross2(a,direction)/det;
      if(distance>=0&&t>=-1e-8&&t<=1+1e-8){hit={...blend(waist[edge],waist[(edge+1)%waist.length],Math.max(0,Math.min(1,t))),edge};break;}
    }
    if(!hit)throw Error('Cós da saia sem vínculo com a cintura');
    // Preserve the non-planar waist edge in bent/seated poses. Averaging the
    // axial height here would leave an opening between the top and the skirt.
    outer.p=add(outer.p,mul(up,dot(sub(hit.p,outer.p),up)));
    outer.d=add(outer.d,mul(up,dot(sub(hit.d,outer.d),up)));
    return hit;
  });
  return inner;
}

/** A single fitted skirt construction for standing, walking, seated and lying poses. */
export function fittedSkirtSurface(data,piece,morphVertex=()=>[0,0,0]){
  const long=piece==='saia longa',{left,right,waist}=landmarks(data,morphVertex);
  const hip=legPoints(left.hip,right.hip),knee=legPoints(left.upperKnee,right.upperKnee),lowerKnee=legPoints(left.lowerKnee,right.lowerKnee),ankle=legPoints(left.ankle,right.ankle);
  const sections=[waist,...[.3,.65,1].map(t=>blendRing(waist,hip,t)),...[.35,.7,1].map(t=>blendRing(hip,knee,t))];
  if(long)sections.push(blendRing(knee,lowerKnee,.5),lowerKnee,...[.35,.7,1].map(t=>blendRing(lowerKnee,ankle,t)));
  const rightAxis=unit(sub(waist[6].p,waist[2].p)),upAxis=unit(cross(sub(waist[0].p,waist[4].p),rightAxis));
  let frame={right:rightAxis,up:upAxis,forward:unit(cross(rightAxis,upAxis))};
  const centers=sections.map(anchors=>mean(anchors.map(a=>a.p))),rings=[];
  for(let i=0;i<sections.length;i++){
    if(i>0){const tangent=sub(centers[Math.max(0,i-1)],centers[Math.min(sections.length-1,i+1)]);if(length(tangent)>1e-6)frame=frameFor(unit(tangent),frame);}
    const t=i/(sections.length-1),clearance=.0035+.0015*t*t;
    rings.push(fittedRing(sections[i],frame,clearance));
  }
  const waistInner=boundWaist(waist,rings[0]);
  const positions=[],normals=[],morphDeltas=[],normalLinear=[],normalQuadratic=[];
  const triangle=(a,b,c)=>{
    const u=sub(b.p,a.p),v=sub(c.p,a.p),du=sub(b.d,a.d),dv=sub(c.d,a.d),normal=cross(u,v),area=length(normal);
    if(area<1e-11)return;
    const linear=mul(add(cross(du,v),cross(u,dv)),1/area),quadratic=mul(cross(du,dv),1/area),n=mul(normal,1/area);
    for(const point of [a,b,c]){positions.push(...point.p);normals.push(...n);morphDeltas.push(...point.d);normalLinear.push(...linear);normalQuadratic.push(...quadratic);}
  };
  for(let row=0;row<rings.length-1;row++)for(let i=0;i<SIDES;i++){
    const next=(i+1)%SIDES,a=rings[row].vertices[i],b=rings[row].vertices[next],c=rings[row+1].vertices[next],d=rings[row+1].vertices[i];
    triangle(a,b,c);triangle(a,c,d);
  }
  // A narrow inner lip closes the clearance at the waistband without capping
  // the garment or hiding any torso, head or hand faces.
  for(let i=0;i<SIDES;i++){
    const next=(i+1)%SIDES,arc=[waistInner[i]];let edge=waistInner[i].edge;
    // Keep every original waist corner in the inner boundary; connecting only
    // sampled points would cut across a non-planar waist in seated poses.
    while(edge!==waistInner[next].edge){edge=(edge+1)%waist.length;arc.push(waist[edge]);}
    arc.push(waistInner[next]);
    triangle(waistInner[i],rings[0].vertices[next],rings[0].vertices[i]);
    for(let j=0;j<arc.length-1;j++)triangle(arc[j],arc[j+1],rings[0].vertices[next]);
  }
  // Preserve a fitted inner lining over the covered body. Otherwise removing
  // thigh skin leaves hollow leg openings through which the inside of the
  // blouse becomes visible when seated. No panel caps across the two legs.
  const covered=[...PELVIS,...THIGH,...(long?[...KNEE,...SHIN]:[])];
  for(const face of [...covered,...covered.map(id=>id+MIRROR)]){
    const points=[0,1,2].map(corner=>{const p=Array.from(data.positions.subarray(face*9+corner*3,face*9+corner*3+3));return {p,d:morphVertex(p)};});
    triangle(points[0],points[2],points[1]);
  }
  const bodyMask=new Uint8Array(CITIZEN_BODY_FACE_COUNT);
  for(const face of covered){bodyMask[face]=1;bodyMask[face+MIRROR]=1;}
  return {positions:new Float32Array(positions),normals:new Float32Array(normals),morphDeltas:new Float32Array(morphDeltas),normalLinear:new Float32Array(normalLinear),normalQuadratic:new Float32Array(normalQuadratic),bodyMask,rings,waistInner};
}
