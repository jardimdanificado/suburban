// Two future worker samples keep velocity continuous across packet boundaries.
// The render buffer never predicts beyond known positions, including stops.
// Keep enough delayed samples to absorb worker scheduling and rendering jitter.
// This is a visual-only buffer: simulation time and gameplay remain unchanged.
// Motion samples arrive about every 100 ms. Two intervals smooth worker
// scheduling jitter while keeping citizens close to their simulation position.
export const MOTION_BUFFER_MS=180;
export function queueMotion(sample,x,y,now,{reset=false}={}){
  const points=sample.points??=[];
  if(reset||!points.length){sample.previous=null;points.length=0;points.push({x,y,at:now-MOTION_BUFFER_MS});}
  const last=points.at(-1);
  if(now>last.at)points.push({x,y,at:now});
  else Object.assign(last,{x,y});
  // Prune consumed segments in sampleMotion, not by packet count: bursts must
  // not discard the segment currently being displayed.
  sample.to.x=x;sample.to.y=y;
}
export function sampleMotion(sample,now){
  const points=sample.points,target=now-MOTION_BUFFER_MS;
  if(!points?.length)return true;
  while(points.length>2&&points[1].at<=target)sample.previous=points.shift();
  const a=points[0],b=points[1]||a,t=a===b?1:Math.max(0,Math.min(1,(target-a.at)/(b.at-a.at)));
  const previous=sample.previous,next=points[2];
  const t2=t*t,t3=t2*t,duration=b.at-a.at,h0=2*t3-3*t2+1,h1=t3-2*t2+t,h2=-2*t3+3*t2,h3=t3-t2;
  sample.entity.x=hermiteAxis(previous,a,b,next,'x',duration,h0,h1,h2,h3);
  sample.entity.y=hermiteAxis(previous,a,b,next,'y',duration,h0,h1,h2,h3);
  return target>=points.at(-1).at;
}

function tangent(left,center,right,axis){
 if(!left||!right)return left?(center[axis]-left[axis])/(center.at-left.at):right?(right[axis]-center[axis])/(right.at-center.at):0;
 const h0=center.at-left.at,h1=right.at-center.at,d0=(center[axis]-left[axis])/h0,d1=(right[axis]-center[axis])/h1;
 if(d0*d1<=0)return 0;const w0=2*h1+h0,w1=h1+2*h0;return (w0+w1)/(w0/d0+w1/d1);
}
function hermiteAxis(previous,a,b,next,axis,duration,h0,h1,h2,h3){
 return h0*a[axis]+h1*tangent(previous,a,b===a?null:b,axis)*duration+h2*b[axis]+h3*tangent(a===b?null:a,b,next,axis)*duration;
}

// Rounded visual corners stay inside a quadratic Bezier's control triangle.
// Clearance is cached with each received segment/corner, never scanned per frame.
export function sampleRoundedMotion(sample,now){
 const points=sample.points,target=now-MOTION_BUFFER_MS;
 if(!points?.length)return true;
 while(points.length>2&&points[1].at<=target)sample.previous=points.shift();
 const a=points[0],b=points[1]||a,revision=sample.motionRevision||0;
 if(b.safeAt!==a.at||b.safeRevision!==revision){b.safeAt=a.at;b.safeRevision=revision;b.safe=sample.segmentClear?.(a,b)??true;}
 sample.motionBlocked=!b.safe;if(!b.safe)return false;
 const t=a===b?1:Math.max(0,Math.min(1,(target-a.at)/(b.at-a.at)));
 let x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
 const first=roundedCorner(sample.previous,a,b,revision,sample.cornerClear),second=roundedCorner(a,b,points[2],revision,sample.cornerClear);
 const curve=first&&target>=first.from&&target<=first.to?first:second&&target>=second.from&&target<=second.to?second:null;
 if(curve){
  const q=(target-curve.from)/(curve.to-curve.from),u=1-q;
  x=u*u*curve.start.x+2*u*q*curve.x+q*q*curve.end.x;y=u*u*curve.start.y+2*u*q*curve.y+q*q*curve.end.y;
 }
 sample.entity.x=x;sample.entity.y=y;
 return target>=points.at(-1).at;
}

function roundedCorner(left,center,right,revision,clear){
 if(!left||!right||left===center||center===right)return null;
 if(center.roundLeftAt===left.at&&center.roundRightAt===right.at&&center.roundRevision===revision)return center.round;
 center.roundLeftAt=left.at;center.roundRightAt=right.at;center.roundRevision=revision;center.round=null;
 const ix=center.x-left.x,iy=center.y-left.y,ox=right.x-center.x,oy=right.y-center.y,il=Math.hypot(ix,iy),ol=Math.hypot(ox,oy);
 const cosine=il&&ol?(ix*ox+iy*oy)/(il*ol):1;
 if(il>.0001&&ol>.0001&&cosine<.995&&cosine>-.8){
  const before=center.at-left.at,after=right.at-center.at,window=Math.min(before*.45,after*.45,.24*before/il,.24*after/ol);
  const start={x:center.x-ix*window/before,y:center.y-iy*window/before},end={x:center.x+ox*window/after,y:center.y+oy*window/after};
  if(clear?.(start,center,end)!==false)center.round={start,end,x:center.x,y:center.y,from:center.at-window,to:center.at+window};
 }
 return center.round;
}
