// Narrow, bent blades, rooted in a small irregular patch rather than crossed leaves.
export function groundGrassSurface(){
  const positions=[],colors=[];
  const triangle=(a,b,c)=>{for(const p of [a,b,c]){positions.push(...p);const t=Math.max(0,Math.min(1,p[1]/.23));colors.push(.66+t*.27,.77+t*.23,.49+t*.22);}};
  for(let i=0;i<7;i++){
    const angle=i*2.39996323,radius=.025+(i%3)*.025,lean=.035+(i%4)*.015,height=.12+((i*7)%9)*.012,width=.009+(i%3)*.003;
    const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,dx=Math.cos(angle+.6),dz=Math.sin(angle+.6),wx=-dz*width,wz=dx*width;
    const a=[x-wx,0,z-wz],b=[x+wx,0,z+wz];
    const c=[x+dx*lean*.35-wx*.62,height*.62,z+dz*lean*.35-wz*.62],d=[x+dx*lean*.35+wx*.62,height*.62,z+dz*lean*.35+wz*.62];
    const tip=[x+dx*lean,height,z+dz*lean];
    triangle(a,b,d);triangle(a,d,c);triangle(c,d,tip);
  }
  return {positions:new Float32Array(positions),colors:new Float32Array(colors)};
}
