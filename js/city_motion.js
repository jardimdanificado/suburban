// A short render buffer spans worker packets (normally 100 ms). Never predict
// beyond received positions: stops and route changes remain authoritative.
export const MOTION_BUFFER_MS=160;
export function queueMotion(sample,x,y,now,{reset=false}={}){
  const points=sample.points??=[];
  if(reset||!points.length){points.length=0;points.push({x,y,at:now-MOTION_BUFFER_MS});}
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
  while(points.length>2&&points[1].at<=target)points.shift();
  const a=points[0],b=points[1]||a,t=a===b?1:Math.max(0,Math.min(1,(target-a.at)/(b.at-a.at)));
  sample.entity.x=a.x+(b.x-a.x)*t;sample.entity.y=a.y+(b.y-a.y)*t;
  return target>=points.at(-1).at;
}
