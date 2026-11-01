const WOOD=0x986c43,WICKER=0xb88d58,STEEL=0x6b7475,RUBBER=0x292d2c,LEATHER=0x49392e;
const linear=c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
const rgb=hex=>[linear(hex>>>16&255),linear(hex>>>8&255),linear(hex&255)];
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,n)=>a.map(v=>v*n);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/(Math.hypot(...a)||1));
class Surface{
  constructor(){this.positions=[];this.normals=[];this.colors=[];}
  tri(a,b,c,color,normals=null){const n=normals||[unit(cross(sub(b,a),sub(c,a)))],tint=rgb(color);for(const [i,p]of [a,b,c].entries()){this.positions.push(...p);this.normals.push(...(n.length===1?n[0]:n[i]));this.colors.push(...tint);}}
  quad(a,b,c,d,color){this.tri(a,b,c,color);this.tri(a,c,d,color);}
  box(x,y,z,w,h,d,color){
    const p=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*w/2,y+b*h/2,z+c*d/2]);
    for(const [a,b,c,d]of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])this.quad(p[a],p[b],p[c],p[d],color);
  }
  tube(a,b,r,color,sides=6){
    const axis=unit(sub(b,a)),u=unit(cross(axis,Math.abs(axis[1])>.9?[1,0,0]:[0,1,0])),v=cross(axis,u);
    for(let i=0;i<sides;i++){
      const t=i*Math.PI*2/sides,next=(i+1)*Math.PI*2/sides,n=add(mul(u,Math.cos(t)),mul(v,Math.sin(t))),m=add(mul(u,Math.cos(next)),mul(v,Math.sin(next)));
      const p=add(a,mul(n,r)),q=add(a,mul(m,r)),s=add(b,mul(m,r)),t2=add(b,mul(n,r));
      this.tri(p,q,s,color,[n,m,m]);this.tri(p,s,t2,color,[n,m,n]);
    }
  }
  ring(x,y,z,r,tube,color,segments=20,sides=5){
    const point=(theta,phi)=>[x+tube*Math.cos(phi),y+(r+tube*Math.sin(phi))*Math.cos(theta),z+(r+tube*Math.sin(phi))*Math.sin(theta)];
    const normal=(theta,phi)=>[Math.cos(phi),Math.sin(phi)*Math.cos(theta),Math.sin(phi)*Math.sin(theta)];
    for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){
      const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments,c=j*Math.PI*2/sides,d=(j+1)*Math.PI*2/sides;
      this.tri(point(a,c),point(b,c),point(b,d),color,[normal(a,c),normal(b,c),normal(b,d)]);
      this.tri(point(a,c),point(b,d),point(a,d),color,[normal(a,c),normal(b,d),normal(a,d)]);
    }
  }
  data(){return {positions:new Float32Array(this.positions),normals:new Float32Array(this.normals),colors:new Float32Array(this.colors)};}
}
function wheel(s,x,z,r=.205){
  const y=r+.024;
  s.ring(x,y,z,r,.022,RUBBER);
  for(const dx of [-.013,.013])s.ring(x+dx,y,z,r-.012,.007,0xbaa17c,20,4);
  s.ring(x,y,z,r-.031,.008,0xb4b8b2,20,4);
  s.tube([x-.035,y,z],[x+.035,y,z],.014,STEEL);
  for(let i=0;i<8;i++){const t=i*Math.PI/4;s.tube([x+(i%2?.016:-.016),y,z],[x,y+Math.cos(t)*(r-.035),z+Math.sin(t)*(r-.035)],.0028,0xadb4af,3);}
}
function basket(s,x,y,z,width=.34,depth=.27,height=.23,segments=16,courses=12){
  const point=(i,t,extra=0)=>{const angle=i*Math.PI*2/segments,scale=.72+t*.28;return [x+Math.cos(angle)*(width*.5*scale+extra),y+t*height,z+Math.sin(angle)*(depth*.5*scale+extra)];};
  for(let row=0;row<=courses;row++){
    const t=row/courses;
    for(let i=0;i<segments;i++){
      const a=point(i,t,(i%2?.0015:-.0015)*(row%2?1:-1)),b=point(i+1,t),half=height/courses*.38;
      if(row===courses)s.tube(a,b,.011,WICKER,4);
      else s.quad([a[0],a[1]-half,a[2]],[b[0],b[1]-half,b[2]],[b[0],b[1]+half,b[2]],[a[0],a[1]+half,a[2]],row%2?0xc5a16a:WICKER);
    }
  }
  for(let i=0;i<segments;i++)s.tube(point(i,0),point(i,1),.0048,i%3?WICKER:0x977143,4);
  // The bottom is also woven. No solid lid or cube hides the open interior.
  for(let i=-3;i<=3;i++){
    const f=i/4,span=Math.sqrt(1-f*f);
    s.tube([x-width*.36*span,y+.004,z+f*depth*.36],[x+width*.36*span,y+.004,z+f*depth*.36],.0045,0x9e7849,4);
    s.tube([x+f*width*.36,y+.008,z-depth*.36*span],[x+f*width*.36,y+.008,z+depth*.36*span],.0045,0xbe975e,4);
  }
}
export function wickerBasketSurface({x=0,y=0,z=0,width=.34,depth=.27,height=.23,segments=16,courses=12}={}){
  const surface=new Surface();basket(surface,x,y,z,width,depth,height,segments,courses);return surface.data();
}
function woodenCrate(s,x,y,z,w,d,h){
  for(let i=0;i<5;i++)s.box(x+(i-2)*w/5,y,z,w/5-.007,.032,d,i%2?0x9c7046:0xad8051);
  for(let course=0;course<3;course++){
    const cy=y+.045+course*(h-.04)/3,ch=(h-.04)/3-.008;
    for(const sign of [-1,1]){s.box(x+sign*(w/2-.014),cy,z,.028,ch,d,course%2?WOOD:0xac7f50);s.box(x,cy,z+sign*(d/2-.014),w,ch,.028,course%2?0xa27548:0xb18b5b);}
  }
  for(const dx of [-1,1])for(const dz of [-1,1]){
    s.box(x+dx*(w/2-.025),y+h*.48,z+dz*(d/2-.025),.035,h,.035,0x654a35);
    s.box(x+dx*(w/2+.002),y+h*.48,z+dz*(d/2-.04),.009,h*.86,.032,0x4c5654);
  }
}
function saddle(s){
  const outline=[[-.065,-.34],[.065,-.34],[.085,-.28],[.035,-.12],[-.035,-.12],[-.085,-.28]];
  for(let i=0;i<outline.length;i++){
    const [x,z]=outline[i],[nx,nz]=outline[(i+1)%outline.length];
    s.tri([0,.695,-.25],[nx,.676,nz],[x,.676,z],LEATHER);
    s.quad([x,.65,z],[nx,.65,nz],[nx,.676,nz],[x,.676,z],0x352c26);
  }
}
function skateDeck(s,y,width,depth,thickness,color){
  const points=[];
  for(let end=0;end<2;end++)for(let i=0;i<=6;i++){
    const angle=end*Math.PI+i*Math.PI/6,x=Math.cos(angle)*width/2,z=(end?-1:1)*(depth-width)/2+Math.sin(angle)*width/2;
    points.push([x,y+Math.max(0,(Math.abs(z)-depth*.28)/depth)*.11,z]);
  }
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],bottomA=[a[0],a[1]-thickness,a[2]],bottomB=[b[0],b[1]-thickness,b[2]];
    s.tri([0,y,0],b,a,color);s.tri([0,y-thickness,0],bottomA,bottomB,color);s.quad(a,b,bottomB,bottomA,color);
  }
}
function bicycle(s,p,cargo){
  const rear=[0,.229,-.43],bb=[0,.29,-.07],seat=[0,.60,-.20],head=[0,.64,.24],lowerHead=[0,.45,.29],front=[0,.229,.43];
  for(const [a,b]of [[rear,seat],[seat,bb],[bb,rear],[bb,lowerHead],[seat,head],[head,lowerHead]])p.tube(a,b,.018,0xffffff);
  if(!cargo)for(const side of [-.028,.028])p.tube([side,lowerHead[1],lowerHead[2]],[side,front[1],front[2]],.012,0xffffff);
  s.tube(seat,[0,.66,-.22],.011,STEEL);saddle(s);
  s.tube(head,[0,.78,.30],.012,STEEL);
  for(const sign of [-1,1]){
    s.tube([0,.78,.30],[sign*.17,.78,.28],.012,STEEL);
    s.tube([sign*.17,.78,.28],[sign*.21,.76,.21],.017,LEATHER);
    s.tube([sign*.05,.29,-.07],[sign*.09,.23,sign*.035-.07],.009,STEEL);
    s.box(sign*.11,.23,sign*.035-.07,.10,.025,.055,0x393f3a);
    s.tube([sign*.10,.28,-.42],[sign*.10,.55,-.44],.007,STEEL);
  }
  s.box(0,.55,-.44,.20,.025,.30,STEEL);
  s.ring(.03,.29,-.07,.043,.006,0x969b91,14,4);
  s.tube([.032,.333,-.07],[.032,.246,-.43],.004,0x747975,4);
  s.tube([.032,.247,-.07],[.032,.213,-.43],.004,0x747975,4);
  if(cargo){
    wheel(s,0,-.43);wheel(s,-.32,.63,.16);wheel(s,.32,.63,.16);
    p.tube([0,.29,-.07],[0,.27,.65],.025,0xffffff);p.tube([-.32,.185,.63],[.32,.185,.63],.022,0xffffff);
    p.tube(lowerHead,[0,.27,.36],.02,0xffffff);p.tube([0,.27,.63],[0,.185,.63],.022,0xffffff);
    woodenCrate(s,0,.33,.56,.58,.60,.25);
    basket(s,0,.565,-.47,.31,.25,.19);
  }else{
    wheel(s,0,-.43);wheel(s,0,.43);
    basket(s,0,.64,.48);
    for(const dx of [-.065,.065]){
      s.tube([dx,.58,.34],[dx,.67,.39],.007,STEEL);
      s.box(dx,.76,.356,.018,.08,.009,0x6c5038);
    }
    // Short painted mudguards, following each wheel instead of squared bars.
    for(const z of [-.43,.43])for(let i=0;i<9;i++){
      const a=-1.1+i*2.2/9,b=-1.1+(i+1)*2.2/9;
      p.tube([0,.229+Math.cos(a)*.245,z+Math.sin(a)*.245],[0,.229+Math.cos(b)*.245,z+Math.sin(b)*.245],.015,0xffffff,5);
    }
  }
}
export function mobilityModelSurface(kind){
  const s=new Surface(),p=new Surface();
  if(kind==='bicicleta'||kind==='bicicleta_carga')bicycle(s,p,kind==='bicicleta_carga');
  else if(kind==='carrinho'){
    wheel(s,-.33,.24,.16);wheel(s,.33,.24,.16);
    woodenCrate(s,0,.35,.22,.58,.73,.27);
    for(const x of [-.315,.315]){
      p.tube([x,.26,.50],[x,.53,-.64],.023,0xffffff,6);
      s.tube([x,.53,-.64],[x,.55,-.78],.027,LEATHER,6);
      p.tube([x,.32,-.10],[x,.035,-.17],.018,0xffffff,5);
    }
    p.tube([-.33,.185,.24],[.33,.185,.24],.024,0xffffff);
  }else if(kind==='patinete'){
    wheel(s,0,-.28,.055);wheel(s,0,.28,.055);
    p.box(0,.12,0,.20,.035,.61,0xffffff);s.box(0,.141,-.02,.15,.009,.43,0x5d645c);
    p.tube([0,.09,.28],[0,.73,.23],.017,0xffffff);
    s.tube([-.19,.75,.22],[.19,.75,.22],.014,STEEL);
    for(const x of [-.15,.15])s.box(x,.75,.22,.085,.035,.04,LEATHER);
    basket(s,0,.51,.34,.22,.17,.17,12,8);
  }else if(kind==='skate'){
    skateDeck(s,.13,.25,.66,.035,0xb68a55);skateDeck(p,.136,.225,.625,.006,0xffffff);
    for(const z of [-.22,.22]){s.tube([-.13,.067,z],[.13,.067,z],.015,STEEL);for(const x of [-.14,.14])s.ring(x,.052,z,.031,.019,0xceae7d,12,5);}
  }else{
    for(const x of [-.13,.13]){
      p.box(x,.16,0,.13,.15,.25,0xffffff);p.box(x,.24,-.065,.125,.15,.11,0xffffff);
      s.box(x,.086,0,.145,.025,.27,0x685445);
      for(let i=0;i<4;i++)s.box(x,.24-i*.017,.075-i*.027,.092,.008,.012,0xd2c4a4);
      for(const dx of [-.078,.078])for(const z of [-.083,.083])s.ring(x+dx,.045,z,.027,.016,0xc6a277,10,5);
    }
  }
  return {fixed:s.data(),paint:p.data()};
}
export function mobilityModelGeometry(THREE,kind){
  const surface=mobilityModelSurface(kind),result={};
  for(const key of ['fixed','paint']){
    const geometry=new THREE.BufferGeometry(),data=surface[key];
    for(const [name,values]of [['position',data.positions],['normal',data.normals],['color',data.colors]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,3));
    geometry.computeBoundingSphere();result[key]=geometry;
  }
  return result;
}
