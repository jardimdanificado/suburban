import {vegetationColor} from './vegetation_color.js';
// Species silhouettes share mesh builders, not a scaled generic crown. Geometry
// is built once per species; all planted and wild specimens use GPU instances.
const broad=(height,radius,leaf,bark,extra={})=>({kind:'broad',height,radius,leaf,bark,leafLength:.29,leafWidth:.105,...extra});
export const BOTANICAL_TREE_MODELS=Object.freeze({
  oak:broad(3.15,1.35,0x618541,0x68503a,{roots:true,shape:'lobed',leafWidth:.14}),
  mango:broad(3.15,1.55,0x4e7838,0x655141,{shape:'lance',leafLength:.38,leafWidth:.075,fruit:[0xe6a143,.12,.17,.11]}),
  guava:broad(2.65,1.03,0x73984b,0xa28b64,{fork:true,fruit:[0xc4bc69,.11,.12,.11]}),
  jackfruit:broad(3.55,1.18,0x3e713e,0x766249,{shape:'oval',leafLength:.34,fruit:[0x8b9d43,.17,.31,.17],cauliflory:true}),
  breadfruit:broad(3.15,1.35,0x568448,0x8a8664,{shape:'lobed',leafLength:.49,leafWidth:.21,fruit:[0x86a34b,.17,.2,.17]}),
  avocado:broad(3.35,1.27,0x456e3d,0x756348,{shape:'lance',leafLength:.37,fruit:[0x467141,.09,.16,.09],pear:true}),
  tamarind:broad(3.2,1.55,0x7c934c,0x6e5b43,{shape:'compound',droop:.24,fruit:[0x986a43,.055,.2,.05],pods:true}),
  cacao:broad(2.55,1.04,0x397044,0x86745b,{shape:'lance',leafLength:.45,leafWidth:.13,fruit:[0xb7773d,.105,.24,.105],cauliflory:true}),
  soursop:broad(2.7,1.08,0x4b7b42,0x7e7453,{leafLength:.34,fruit:[0x83a253,.14,.21,.14],pear:true}),
  ackee:broad(3.25,1.3,0x658944,0x7b6b4d,{shape:'compound',fruit:[0xcc5139,.13,.15,.12],splitFruit:true}),
  lime:broad(2.25,.95,0x6f8d3c,0x76664c,{leafLength:.21,leafWidth:.085,fruit:[0xa2b741,.085,.085,.085]}),
  allspice:broad(3.25,1.06,0x4f7742,0x9a8a72,{leafLength:.29,fruit:[0x756345,.045,.045,.045]}),
  flamboyant:broad(3.25,1.95,0x568038,0x827057,{shape:'compound',umbrella:true,bloom:0xed613c,flowers:3,pods:true,fruit:[0x71513b,.045,.31,.04]}),
  sea_grape:broad(2.45,1.32,0x7a9456,0x95826b,{shape:'round',leafLength:.29,leafWidth:.18,fork:true,fruit:[0x805a80,.055,.065,.055],grapes:true}),
  tropical_almond:broad(3.75,1.48,0x688c47,0x9a8c70,{tiered:true,leafLength:.4,leafWidth:.17,autumn:true}),
  mangrove:broad(2.95,1.12,0x4a7648,0x827d62,{stilt:true,leafLength:.27,leafWidth:.105}),
  willow:broad(3.45,1.55,0x89a368,0x7a7053,{weeping:true,shape:'lance',leafLength:.26,leafWidth:.045}),
  birch:broad(3.9,.92,0x9bb866,0xd7d5ba,{fork:true,birch:true,leafLength:.19,leafWidth:.085,droop:.24}),
  maple:broad(3.15,1.35,0xc66b39,0x796447,{shape:'maple',leafLength:.28,leafWidth:.17}),
  cherry_blossom:broad(2.9,1.32,0x739054,0x725341,{fork:true,bloom:0xf0b3c6,flowers:12,leafLength:.2}),
  pau_brasil:broad(3.25,1.26,0x527c43,0x8d5a47,{shape:'compound',bloom:0xe3bd46,flowers:3}),
  yellow_ipe:broad(3.45,1.4,0x7c944b,0x8c7958,{shape:'maple',bloom:0xf0c532,flowers:13,sparse:true}),
  quaresmeira:broad(2.95,1.22,0x537a48,0x8c7960,{bloom:0x9d61b9,flowers:8,leafLength:.3,leafWidth:.115}),
  manaca_serra:broad(2.85,1.14,0x64864d,0x97876e,{bloom:0xd4a3d0,mixedBloom:true,flowers:9}),
  sibipiruna:broad(3.7,1.5,0x6e9247,0x8b7b60,{shape:'compound',umbrella:true,bloom:0xdfc653,flowers:3}),
  pau_ferro:broad(3.65,1.32,0x537d42,0xb6a384,{shape:'compound',mottled:true,fork:true}),
  pitanga:broad(2.35,1.03,0x557e41,0x8d775a,{leafLength:.2,leafWidth:.065,fruit:[0xc34432,.07,.065,.07],ribbed:true}),
  jabuticaba:broad(2.85,1.08,0x4f7841,0x9b8268,{fork:true,leafLength:.22,leafWidth:.065,fruit:[0x483348,.065,.065,.065],cauliflory:true,grapes:true}),
  frangipani:broad(2.6,1.25,0x73984b,0xa99e7e,{fork:true,succulent:true,sparse:true,leafLength:.47,leafWidth:.115,bloom:0xf3e3b6,flowers:5}),
  clusia:broad(2.6,1.15,0x507d48,0x9c8d6b,{fork:true,shape:'round',leafLength:.3,leafWidth:.15}),
  berry:broad(1.8,.92,0x73934c,0x927951,{shape:'lobed',leafLength:.23,leafWidth:.12,fruit:[0x73465e,.045,.09,.045],grapes:true}),
  pine:{kind:'pine',height:4.05,radius:1.12,leaf:0x456d4b,bark:0x866c4c},
  royal_palm:{kind:'pinnate',height:4.4,length:1.85,leaf:0x618c42,bark:0xaba78b,shaft:true},
  jeriva_palm:{kind:'pinnate',height:3.8,length:1.7,leaf:0x638541,bark:0x9b8b6c,droop:1.15,fruit:[0xd7a046,.065,.075,.065]},
  areca_palm:{kind:'pinnate',height:2.55,length:1.23,leaf:0x769c4f,bark:0xb0a35b,clump:true},
  buriti_palm:{kind:'fan',height:3.95,length:1.08,leaf:0x6e9149,bark:0x877458,divided:true},
  licuala_palm:{kind:'fan',height:.48,length:.7,leaf:0x508549,bark:0x837458},
  banana:{kind:'banana',height:1.95,leaf:0x629344,bark:0x9d9b62},
  papaya:{kind:'papaya',height:2.65,leaf:0x628d48,bark:0xa7a485},
  monstera:{kind:'aroid',height:1.05,leaf:0x427b4d,bark:0x719054,split:true},
  guaimbe:{kind:'aroid',height:1.2,leaf:0x52834b,bark:0x7d9660}
});
const TAU=Math.PI*2;
const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,s)=>a.map(v=>v*s),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/(Math.hypot(...a)||1));
const rgb=vegetationColor;
function builder(seed){
  const positions=[],colors=[],uvs=[],flex=[],parts=[],woodMask=[];
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const triangle=(a,b,c,color,wood=false,part=0,bend=[0,0,0],uv=[[0,0],[.5,1],[1,0]])=>{
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    if((uy*vz-uz*vy)**2+(uz*vx-ux*vz)**2+(ux*vy-uy*vx)**2<1e-18)return;
    positions.push(...a,...b,...c);colors.push(...color,...color,...color);flex.push(...bend);parts.push(part,part,part);const mask=wood===true?1:0;woodMask.push(mask,mask,mask);
    for(const [u,v] of uv)uvs.push((wood===true?.022:wood===2?.69:.355)+u*.285,v);
  };
  const tube=(a,b,r0,r1,color,sides=5)=>{
    const axis=unit(add(b,mul(a,-1))),u=unit(cross(axis,Math.abs(axis[1])>.95?[1,0,0]:[0,1,0])),v=cross(axis,u);
    const point=(p,r,i)=>add(p,add(mul(u,Math.cos(i/sides*TAU)*r),mul(v,Math.sin(i/sides*TAU)*r)));
    for(let i=0;i<sides;i++){
      const p=point(a,r0,i),q=point(b,r1,i),r=point(b,r1,i+1),s=point(a,r0,i+1),tone=.88+random()*.17,col=mul(color,tone);
      triangle(p,q,r,col,true,0,[0,0,0],[[i/sides,0],[i/sides,1],[(i+1)/sides,1]]);
      triangle(p,r,s,col,true,0,[0,0,0],[[i/sides,0],[(i+1)/sides,1],[(i+1)/sides,0]]);
      if(sides>5&&r1>.03)triangle(b,r,q,col,true);
    }
  };
  const ellipsoid=(center,size,color,part=0,sides=6,bands=3,organic=false)=>{
    const point=(i,j)=>{
      const phi=j/bands*Math.PI,theta=i/sides*TAU,phase=center[0]*2.7+center[1]*1.3+center[2];
      const warp=organic?1+.14*Math.sin(theta*3+phi*2+phase)+.1*Math.cos(theta*5-phi*3):1;
      const lift=organic?Math.sin(phi)*Math.sin(theta*3+phase)*.19:0;
      return add(center,[size[0]*Math.sin(phi)*Math.cos(theta)*warp,size[1]*(Math.cos(phi)+lift),size[2]*Math.sin(phi)*Math.sin(theta)*warp]);
    };
    for(let j=0;j<bands;j++)for(let i=0;i<sides;i++){
      const a=point(i,j),b=point(i+1,j),c=point(i+1,j+1),d=point(i,j+1),col=mul(color,.87+random()*.19);
      triangle(a,b,c,col,organic?2:false,part);triangle(a,c,d,col,organic?2:false,part);
    }
  };
  const blade=(a,b,width,color,{shape='oval',part=0,fold=.12,segments=3}={})=>{
    const delta=add(b,mul(a,-1)),side=unit(cross(delta,Math.abs(unit(delta)[1])>.94?[0,0,1]:[0,1,0]));
    const normal=unit(cross(side,delta));
    if(shape==='maple'){
      const outline=[[0,0],[.28,-.32],[.29,-.8],[.49,-.5],[.7,-1],[.74,-.36],[1,0],[.74,.36],[.7,1],[.49,.5],[.29,.8],[.28,.32]];
      const center=add(mix(a,b,.52),mul(normal,width*.15));
      const point=([t,w])=>add(mix(a,b,t),mul(side,w*width));
      for(let i=0;i<outline.length;i++)triangle(center,point(outline[i]),point(outline[(i+1)%outline.length]),color,false,part,[.5,outline[i][0],outline[(i+1)%outline.length][0]]);
      return;
    }
    const section=t=>{
      let w=Math.pow(Math.sin(t*Math.PI),shape==='lance'?.9:.65)*width;
      if(shape==='lobed'||shape==='maple')w*=.56+.44*Math.cos(t*Math.PI*(shape==='maple'?6:10))**2;
      const mid=add(mix(a,b,t),[0,-Math.sin(t*Math.PI)*Math.hypot(...delta)*.08,0]);
      return [add(mid,mul(side,-w)),add(mid,mul(normal,w*fold)),add(mid,mul(side,w))];
    };
    for(let i=0;i<segments;i++){
      const t=i/segments,t1=(i+1)/segments,p=section(t),q=section(t1),tone=.9+random()*.19,col=mul(color,tone);
      for(let half=0;half<2;half++){
        const uv0=[half*.5,t],uv1=[half*.5,t1],uv2=[(half+1)*.5,t1],uv3=[(half+1)*.5,t];
        triangle(p[half],q[half],q[half+1],col,false,part,[t,t1,t1],[uv0,uv1,uv2]);
        triangle(p[half],q[half+1],p[half+1],col,false,part,[t,t1,t],[uv0,uv2,uv3]);
      }
    }
  };
  const flower=(p,size,color)=>{
    for(let i=0;i<5;i++){
      const angle=i/5*TAU,tip=add(p,[Math.cos(angle)*size,size*.16,Math.sin(angle)*size]);
      const side=[-Math.sin(angle)*size*.45,0,Math.cos(angle)*size*.45];
      triangle(p,add(tip,side),tip,color,false,2,[0,.35,.6]);triangle(p,tip,add(tip,mul(side,-1)),color,false,2,[0,.6,.35]);
    }
    ellipsoid(add(p,[0,size*.12,0]),[size*.15,size*.11,size*.15],rgb(0xe9c85c),2,5,2);
  };
  return {positions,colors,uvs,flex,parts,woodMask,random,triangle,tube,ellipsoid,blade,flower};
}
function compound(b,a,end,width,color){
  const d=add(end,mul(a,-1)),side=unit(cross(d,[0,1,0]));
  b.triangle(a,end,add(end,[.004,.002,.004]),mul(color,.85),true);
  for(let i=1;i<=5;i++)for(const sign of [-1,1]){
    const root=mix(a,end,i/6),tip=add(root,add(mul(side,width*sign),mul(d,.09)));
    const mid=mix(root,tip,.5),edge=mul(unit(cross(add(tip,mul(root,-1)),[0,1,0])),width*.34);
    b.triangle(root,add(mid,edge),tip,color,false,0,[0,.5,1]);b.triangle(root,tip,add(mid,mul(edge,-1)),mul(color,.92),false,0,[0,1,.5]);
  }
}
function broadTree(b,s){
  const bark=rgb(s.bark),green=rgb(s.leaf),h=s.height,rootY=s.stilt?.65:0,trunkTop=h*(s.tiered?.88:.66);
  const trunkRadius=s.succulent?.12:s.birch?.065:.13;
  const axis=[[0,rootY,0],[.055,h*.3,-.035],[-.035,trunkTop,.055]];
  for(let i=0;i<2;i++)b.tube(axis[i],axis[i+1],trunkRadius*(1-i*.22),trunkRadius*(.76-i*.28),bark,7);
  if(s.fork)b.tube([0,h*.18,0],[-.23,h*.7,.12],trunkRadius*.7,.04,bark,6);
  if(s.roots||s.stilt)for(let i=0;i<6;i++){
    const a=i/6*TAU,end=[Math.cos(a)*(s.stilt?.85:.42),0,Math.sin(a)*(s.stilt?.85:.42)];
    b.tube([0,s.stilt?h*.43:.24,0],mix([0,.3,0],end,.55),s.stilt?.065:.11,.045,bark,5);
    b.tube(mix([0,.3,0],end,.55),end,.045,.012,bark,5);
  }
  if(s.birch||s.mottled)for(let i=0;i<14;i++){
    const y=.13+i*trunkTop/15,angle=i*2.399,r=trunkRadius*(1-.4*y/trunkTop)+.006;
    const a=[.015+Math.cos(angle)*r,y,Math.sin(angle)*r],d=[Math.cos(angle+.8)*r,y+.035,Math.sin(angle+.8)*r];
    b.triangle(a,d,add(a,[0,.035+(i%3)*.02,0]),rgb(s.birch?0x5f6158:0x74694c),true);
  }
  // Dense, folded leaves fill the branch volume directly. No solid generic
  // crown is exposed between species-specific leaf clusters.
  const layers=s.tiered?4:3,branches=5;
  for(let layer=0;layer<layers;layer++)for(let branch=0;branch<branches;branch++){
    const angle=branch/branches*TAU+layer*.85+(b.random()-.5)*.4;
    const level=layer/(layers-1),spread=s.radius*(s.tiered?1-level*.62:s.umbrella?.94-level*.22:.72+Math.sin(level*Math.PI)*.18);
    const crownY=s.tiered?h*(.4+level*.49):s.umbrella?h*(.76+level*.14):h*(.57+level*.34);
    const end=[Math.cos(angle)*spread,crownY+(b.random()-.5)*.16,Math.sin(angle)*spread*.9];
    const joint=[end[0]*.42,s.umbrella?h*.65:crownY*.84,end[2]*.42];
    b.tube([axis[1][0],s.tiered?crownY-.12:h*.4,axis[1][2]],joint,trunkRadius*.56,.037,bark,5);
    b.tube(joint,end,.037,s.succulent?.026:.012,bark,4);
    if(s.weeping){
      for(let strand=0;strand<5;strand++){
        const start=add(end,[(strand-2)*.11,.03,(b.random()-.5)*.28]),bottom=add(start,[Math.cos(angle)*.16,-(.75+b.random()*.75),Math.sin(angle)*.16]);
        b.tube(start,bottom,.007,.002,mul(green,.7),3);
        for(let leaf=0;leaf<10;leaf++){
          const root=mix(start,bottom,leaf/10);b.blade(root,add(root,[(b.random()-.5)*.18,-s.leafLength,(b.random()-.5)*.18]),s.leafWidth,green,{shape:'lance',segments:2});
        }
      }
      continue;
    }
    const leafCount=s.sparse?6:s.shape==='compound'?(s.bloom?(s.umbrella?8:9):11):s.bloom?12:['lobed','maple'].includes(s.shape)?(s.fruit?11:14):22;
    for(let leaf=0;leaf<leafCount;leaf++){
      const a=leaf*2.399+b.random(),r=.12+b.random()*.32;
      const root=add(mix(joint,end,.25+b.random()*.85),[Math.cos(a)*r,(b.random()-.35)*.48,Math.sin(a)*r]);
      const length=s.shape==='compound'?.65:s.leafLength;
      const tip=add(root,[Math.cos(a)*length,(b.random()-.65)*length*.8-(s.droop||0),Math.sin(a)*length]);
      const twig=mix(joint,end,.65),edge=add(root,[.003,.002,.003]);b.triangle(twig,root,edge,bark,true);
      const col=s.autumn&&leaf%9===0?rgb(0xbc7549):mul(green,.84+b.random()*.3);
      if(s.shape==='compound')compound(b,root,tip,.2,col);
      else b.blade(root,tip,s.leafWidth,col,{shape:s.shape,segments:['lobed','maple'].includes(s.shape)?5:3});
    }
    if(s.bloom)for(let flower=0;flower<Math.min(8,s.flowers||4);flower++){
      const a=flower*2.399,r=.13+b.random()*.35,point=add(end,[Math.cos(a)*r,.1+b.random()*.24,Math.sin(a)*r]);
      const color=s.mixedBloom?[0xf0e1df,0xd296c8,0x9d69ba][flower%3]:s.bloom;
      b.flower(point,s.sparse?.125:.085,rgb(color));
    }
    if(s.fruit&&!s.cauliflory&&branch%2===0){
      const count=s.grapes?5:1;
      for(let i=0;i<count;i++){
        const p=add(end,[(i%2)*.09-.05,-.17-i*.065,.08]),[color,rx,ry,rz]=s.fruit;
        b.ellipsoid(p,[rx,ry,rz],rgb(color),1,s.ribbed?8:6,3);
        if(s.pear)b.ellipsoid(add(p,[0,ry*.72,0]),[rx*.52,ry*.52,rz*.52],rgb(color),1,5,3);
        if(s.splitFruit)b.ellipsoid(add(p,[rx*.7,0,0]),[rx*.44,ry*.5,rz*.48],rgb(0x332c22),1,5,3);
      }
    }
  }
  if(s.cauliflory){
    const [color,rx,ry,rz]=s.fruit;
    for(let i=0;i<(s.grapes?28:7);i++){
      const angle=i*2.399,y=h*(.24+(i%7)*.065),r=trunkRadius+rx*.6;
      b.ellipsoid([Math.cos(angle)*r,y,Math.sin(angle)*r],[rx,ry,rz],rgb(color),1,7,4);
    }
  }
}
function pineTree(b,s){
  const green=rgb(s.leaf),bark=rgb(s.bark),h=s.height;
  b.tube([0,0,0],[0,h,0],.15,.012,bark,7);
  for(let tier=0;tier<6;tier++){const y=.9+tier*.48,r=s.radius*(1-tier*.145);b.ellipsoid([0,y+.17,0],[r*.93,.31,r*.93],mul(green,.82+tier*.025),0,9,5,true);}
  for(let tier=0;tier<6;tier++)for(let branch=0;branch<5;branch++){
    const a=branch/5*TAU+tier*.7,y=.9+tier*.48,r=s.radius*(1-tier*.145),end=[Math.cos(a)*r,y+.1,Math.sin(a)*r];
    b.tube([0,y+.16,0],end,.035,.005,bark,4);
    for(let tuft=0;tuft<4;tuft++){
      const p=mix([0,y+.2,0],end,(tuft+1)/4);
      for(let needle=0;needle<5;needle++){
        const angle=a+(needle-2)*.45,tip=add(p,[Math.cos(angle)*.28,.14+(needle%2)*.06,Math.sin(angle)*.28]);
        b.blade(p,tip,.035,mul(green,.78+tier*.045+b.random()*.15),{shape:'lance',segments:2});
      }
    }
  }
}
function pinnateCrown(b,center,s,length,count){
  const green=rgb(s.leaf);
  for(let leaf=0;leaf<count;leaf++){
    const angle=leaf/count*TAU+.24,rise=.35+(leaf%3)*.23,drop=s.droop||.72;
    const point=t=>add(center,[Math.cos(angle)*length*t,Math.sin(t*Math.PI)*rise-drop*t*t,Math.sin(angle)*length*t]);
    for(let i=0;i<4;i++)b.tube(point(i/4),point((i+1)/4),.016*(1-i*.17),.009, mul(green,.88),3);
    const side=[-Math.sin(angle),0,Math.cos(angle)];
    for(let pair=1;pair<13;pair++)for(const sign of [-1,1]){
      const t=pair/14,root=point(t),reach=Math.sin(t*Math.PI)*length*.34;
      const tip=add(root,add(mul(side,reach*sign),[Math.cos(angle)*length*.08,-.12-(s.droop||0)*.1,Math.sin(angle)*length*.08]));
      b.blade(root,tip,.065+(1-t)*.035,mul(green,.85+b.random()*.24),{shape:'lance',segments:2});
    }
  }
}
function palms(b,s){
  const bark=rgb(s.bark),stems=s.clump?4:1;
  for(let stem=0;stem<stems;stem++){
    const angle=stem*2.399,spread=s.clump?.19:0,base=[Math.cos(angle)*spread,0,Math.sin(angle)*spread];
    const height=s.height*(s.clump?.72+stem*.075:1),lean=s.clump?.25:.07;
    const top=add(base,[Math.cos(angle)*lean,height,Math.sin(angle)*lean]),radius=s.clump?.045:s.kind==='fan'&&s.divided?.16:s.kind==='fan'?.07:.12;
    const rings=s.kind==='fan'&&s.divided?16:10;
    for(let ring=0;ring<rings;ring++){
      const t=ring/rings,t1=(ring+1)/rings,swelling=s.shaft?1+Math.sin(t*Math.PI)*.38:1;
      b.tube(mix(base,top,t),mix(base,top,t1),radius*swelling,radius*swelling*.94,mul(bark,ring%2?.83:1),7);
    }
    if(s.kind==='pinnate'){
      if(s.shaft)b.tube(add(top,[0,-.55,0]),add(top,[0,.22,0]),radius*.87,radius*.69,rgb(0x6e8e51),7);
      pinnateCrown(b,add(top,[0,s.shaft?.17:0,0]),s,s.length,s.clump?6:11);
      if(s.fruit)for(let i=0;i<18;i++)b.ellipsoid(add(top,[.18+Math.sin(i)*.08,-.12-i*.025,Math.cos(i)*.1]),s.fruit.slice(1),rgb(s.fruit[0]),1,5,3);
    }else{
      for(let leaf=0;leaf<(s.divided?10:7);leaf++){
        const a=leaf*2.399,petiole=s.divided?.75:.5;
        const root=add(top,[Math.cos(a)*petiole,.2+(leaf%3)*.19,Math.sin(a)*petiole]);
        b.tube(top,root,.018,.011,rgb(0x7e9952),4);
        const horizontal=[-Math.sin(a),0,Math.cos(a)],up=unit([Math.cos(a)*.5,1,Math.sin(a)*.5]),green=rgb(s.leaf);
        const rim=t=>{
          const theta=(t-.5)*(s.divided?Math.PI*1.6:Math.PI*1.85),radius=s.length*(s.divided&&Math.round(t*24)%2?.7:1);
          return add(root,add(mul(horizontal,Math.sin(theta)*radius),mul(up,(Math.cos(theta)+.25)*radius)));
        };
        for(let sector=0;sector<24;sector++){
          const a0=rim(sector/24),a1=rim((sector+1)/24),ridge=mix(root,rim((sector+.5)/24),.9);
          ridge[1]+=.055;
          b.triangle(root,a0,ridge,mul(green,.82+(sector%2)*.2),false,0,[0,1,.8]);
          b.triangle(root,ridge,a1,mul(green,.9+(sector%2)*.15),false,0,[0,.8,1]);
        }
      }
    }
  }
}
function bananaTree(b,s){
  const green=rgb(s.leaf),h=s.height;
  for(let ring=0;ring<9;ring++)b.tube([0,ring*h/9,0],[.025,(ring+1)*h/9,.025],.18-ring*.008,.17-ring*.008,rgb(ring%3===0?0x9b865d:s.bark),7);
  for(let leaf=0;leaf<10;leaf++){
    const a=leaf*2.399,length=1.1+(leaf%3)*.2,rise=.24+(leaf%4)*.2,start=[0,h-.15+(leaf%2)*.08,0];
    const point=(t,side=0)=>add(start,[Math.cos(a)*length*t-Math.sin(a)*side,Math.sin(t*Math.PI)*rise-.52*t*t,Math.sin(a)*length*t+Math.cos(a)*side]);
    for(let i=0;i<5;i++)b.tube(point(i/5),point((i+1)/5),.018,.009,mul(green,1.12),3);
    for(let section=0;section<10;section++)for(const sign of [-1,1]){
      const t=.16+section*.084,t1=Math.min(1,t+(section%4===1?.079:.084)),w=Math.sin((t-.16)/.84*Math.PI)*.25,w1=Math.sin((t1-.16)/.84*Math.PI)*.25*(section%4===1?.91:1);
      b.triangle(point(t),point(t,sign*w),point(t1,sign*w1),mul(green,.85+(leaf%3)*.09),false,0,[t,t,t1]);
      b.triangle(point(t),point(t1,sign*w1),point(t1),green,false,0,[t,t1,t1]);
    }
  }
  b.tube([0,h-.15,0],[.42,h-.7,.15],.025,.014,rgb(0x72834a),4);
  for(let hand=0;hand<4;hand++)for(let fruit=0;fruit<6;fruit++){
    const angle=fruit/6*TAU,p=[.42+Math.cos(angle)*.095,h-.55-hand*.11,.15+Math.sin(angle)*.095];
    b.ellipsoid(p,[.035,.105,.035],rgb(hand%2?0xc4b94c:0xabb746),1,5,3);
  }
  b.ellipsoid([.42,h-1.02,.15],[.07,.14,.07],rgb(0x86475c),1,6,3);
}
function papayaTree(b,s){
  const h=s.height,green=rgb(s.leaf);
  for(let ring=0;ring<12;ring++)b.tube([0,ring*h/12,0],[0,(ring+1)*h/12,0],.105-ring*.002,.104-ring*.002,rgb(ring%3?0xa7a485:0x837e60),7);
  for(let leaf=0;leaf<11;leaf++){
    const angle=leaf*2.399,length=.74+(leaf%3)*.1,origin=[0,h-.12-(leaf%3)*.08,0],p=add(origin,[Math.cos(angle)*length,.12+(leaf%3)*.12,Math.sin(angle)*length]);
    b.tube(origin,p,.012,.007,rgb(0x8e9b57),4);
    for(let lobe=0;lobe<7;lobe++){
      const a=angle+lobe/7*TAU;b.blade(p,add(p,[Math.cos(a)*.36,.015,Math.sin(a)*.36]),.065,green,{shape:'lobed',segments:5});
    }
  }
  for(let fruit=0;fruit<9;fruit++){
    const angle=fruit*2.399;b.ellipsoid([Math.cos(angle)*.17,h-.28-(fruit%3)*.14,Math.sin(angle)*.17],[.09,.19,.09],rgb(fruit%3===0?0xd9a047:0x7c9b47),1,7,4);
  }
}
function aroid(b,s){
  const green=rgb(s.leaf);
  for(let leaf=0;leaf<11;leaf++){
    const angle=leaf*2.399,h=s.height*(.45+(leaf%4)*.17),root=[Math.cos(angle)*.24,h,Math.sin(angle)*.24],dir=[Math.cos(angle),-.2,Math.sin(angle)];
    b.tube([0,.03,0],root,.018,.009,rgb(s.bark),4);
    const length=s.split?.65:.75,side=[-Math.sin(angle),0,Math.cos(angle)];
    b.tube(root,add(root,mul(dir,length)),.009,.004,mul(green,1.1),3);
    // Separate lamina fingers leave real openings instead of painted holes.
    if(s.split){
      const point=(t,w)=>add(root,add(mul(dir,length*t),mul(side,w)));
      const quad=(a,c,d,e)=>{b.triangle(a,c,d,green,false,0,[.2,.7,.7]);b.triangle(a,d,e,green,false,0,[.2,.7,.2]);};
      for(let rib=0;rib<6;rib++)for(const sign of [-1,1]){
        const t=rib/6,t1=(rib+1)/6,w=Math.sin(t*Math.PI)*.32*sign,w1=Math.sin(t1*Math.PI)*.32*sign;
        quad(point(t,0),point(t,w*.32),point(t1,w1*.32),point(t1,0));
        quad(point(t,w*.73),point(t,w),point(t1,w1),point(t1,w1*.73));
        const tm=t+(t1-t)*.28,wm=Math.sin(tm*Math.PI)*.32*sign;
        quad(point(t,w*.32),point(t,w*.73),point(tm,wm*.73),point(tm,wm*.32));
      }
      continue;
    }
    b.blade(root,add(root,mul(dir,length)),.075,green,{segments:5});
    for(let rib=0;rib<6;rib++)for(const sign of [-1,1]){
      const t=.09+rib*.135,p=add(root,mul(dir,length*t)),width=Math.sin(t*Math.PI)*.28;
      const end=add(p,add(mul(side,width*sign),mul(dir,.12)));
      b.blade(p,end,s.split?.07:.045,green,{shape:'lance',segments:3});
    }
  }
}
export function botanicalTreeSurface(species){
  const s=BOTANICAL_TREE_MODELS[species];if(!s)return null;
  let seed=2166136261;for(const c of species)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
  const b=builder(seed);
  if(s.kind==='broad')broadTree(b,s);else if(s.kind==='pine')pineTree(b,s);
  else if(['pinnate','fan'].includes(s.kind))palms(b,s);else if(s.kind==='banana')bananaTree(b,s);
  else if(s.kind==='papaya')papayaTree(b,s);else aroid(b,s);
  return {positions:b.positions,colors:b.colors,uvs:b.uvs,flex:b.flex,parts:b.parts,woodMask:b.woodMask};
}
export function createBotanicalTreeGeometry(THREE,species){
  const surface=botanicalTreeSurface(species);if(!surface)return null;
  const geometry=new THREE.BufferGeometry();
  for(const [name,data,size] of [['position',surface.positions,3],['color',surface.colors,3],['uv',surface.uvs,2],['treeFlex',surface.flex,1],['treePart',surface.parts,1],['treeWood',surface.woodMask,1]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,size));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

// A single bark/leaf/crown atlas supplies fine grain and normals without alpha cards.
// UV islands stay inside their strip, so normal filtering cannot cross materials.
export function botanicalTreeTextures(THREE){
  const size=192,tall=128,canvas=document.createElement('canvas');canvas.width=size;canvas.height=tall;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,tall),height=new Float32Array(size*tall);
  let seed=1327;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<tall;y++)for(let x=0;x<128;x++){
    const u=(x%64)/63,v=y/127,wood=x<64;
    const vein=Math.exp(-(((u-.5)*65)**2))+Math.max(0,Math.cos((v*13-Math.abs(u-.5)*8)*TAU))**18*.35;
    const grain=wood?Math.sin(u*TAU*11+Math.sin(v*TAU*2)*.6)*.14+random()*.18:vein*.12+random()*.08;
    height[y*size+x]=grain;const value=Math.round(wood?194+grain*85:222+grain*80),index=(y*size+x)*4;
    image.data.set([value,value,Math.max(0,value-(wood?7:2)),255],index);
  }
  // Leaf islands perforate the interior crown surfaces. Overlapping shells
  // retain depth while their visible faces read as foliage, never smooth blobs.
  for(let leaf=0;leaf<155;leaf++){
    const cx=random()*64,cy=random()*tall,angle=random()*TAU,len=5+random()*8,width=2.3+random()*3;
    const co=Math.cos(angle),si=Math.sin(angle),tone=.76+random()*.24;
    for(let dy=-13;dy<=13;dy++)for(let dx=-13;dx<=13;dx++){
      const u=(dx*co+dy*si)/len,v=(-dx*si+dy*co)/width;
      if(Math.abs(u)>1||Math.abs(v)>1-Math.abs(u)*.78||u*u+v*v>1)continue;
      const x=128+((Math.round(cx+dx)%64)+64)%64,y=((Math.round(cy+dy)%tall)+tall)%tall,index=(y*size+x)*4;
      const relief=(1-u*u-v*v)*.4+(Math.abs(v)<.12?.12:0),value=Math.round((200+relief*110)*tone);
      image.data.set([value,value,Math.max(0,value-5),255],index);height[y*size+x]=relief;
    }
  }
  ctx.putImageData(image,0,0);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const normalCanvas=document.createElement('canvas');normalCanvas.width=size;normalCanvas.height=tall;const nc=normalCanvas.getContext('2d'),normal=nc.createImageData(size,tall);
  for(let y=0;y<tall;y++)for(let x=0;x<size;x++){
    const lo=Math.floor(x/64)*64,hi=lo+63,at=(xx,yy)=>height[((yy+tall)%tall)*size+Math.max(lo,Math.min(hi,xx))];
    const n=unit([(at(x-1,y)-at(x+1,y))*1.2,(at(x,y-1)-at(x,y+1))*1.2,1]);
    normal.data.set([...n.map(v=>Math.round((v*.5+.5)*255)),255],(y*size+x)*4);
  }
  nc.putImageData(normal,0,0);const normalMap=new THREE.CanvasTexture(normalCanvas);
  map.magFilter=normalMap.magFilter=THREE.NearestFilter;return {map,normalMap};
}
export function addBotanicalTreeWind(material){
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey?.()||'';
  material.customProgramCacheKey=()=>key+':botanical-tree-1';
  material.onBeforeCompile=shader=>{
    previous?.call(material,shader);shader.uniforms.uSimTick={value:0};material.userData.foliageShader=shader;
    shader.vertexShader='attribute float treeFlex;\nattribute float treePart;\nattribute float instanceGrowth;\nuniform float uSimTick;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float treeSeed=fract(sin(dot(instanceMatrix[3].xz,vec2(12.9898,78.233)))*43758.5453);
      float treeEpoch=floor((uSimTick+treeSeed*100.0)/(15.0+floor(treeSeed*10.0)));
      float treeGust=sin(treeEpoch*2.17+treeSeed*6.28);
      transformed.x+=treeFlex*treeGust*.028;
      transformed.z+=treeFlex*cos(treeEpoch*1.71+treeSeed*6.28)*.018;
      if(treePart>0.5&&instanceGrowth<0.8)transformed=vec3(0.0);
    `);
  };
  return material;
}

export class BotanicalTreeInstances {
  constructor(THREE,group,material,capacity=1200){this.THREE=THREE;this.group=group;this.material=material;this.capacity=capacity;this.batches=new Map();
    this.shadowMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
    this.shadowMaterial.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float treeWood;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nif(treeWood<0.5)transformed=vec3(0.0);');
    };
    this.shadowMaterial.customProgramCacheKey=()=> 'botanical-wood-shadow-1';
  }
  begin(){for(const batch of this.batches.values())batch.used=0;}
  add(species,matrix,growth=1){
    if(species==='tree')species='oak';
    if(!BOTANICAL_TREE_MODELS[species])return false;
    let batch=this.batches.get(species);
    if(!batch){
      const {THREE}=this,geometry=createBotanicalTreeGeometry(THREE,species);
      const age=new THREE.InstancedBufferAttribute(new Float32Array(this.capacity).fill(1),1);
      geometry.setAttribute('instanceGrowth',age);
      const mesh=new THREE.InstancedMesh(geometry,this.material,this.capacity);
      mesh.name=`botanical:${species}`;mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=true;mesh.customDepthMaterial=this.shadowMaterial;
      this.group.add(mesh);batch={mesh,age,used:0};this.batches.set(species,batch);
    }
    if(batch.used>=this.capacity)return true;
    batch.mesh.setMatrixAt(batch.used,matrix);batch.age.setX(batch.used,growth);batch.used++;return true;
  }
  end(){
    for(const {mesh,age,used} of this.batches.values()){
      mesh.count=used;
      if(!used)continue;
      mesh.instanceMatrix.clearUpdateRanges();mesh.instanceMatrix.addUpdateRange(0,used*16);mesh.instanceMatrix.needsUpdate=true;
      age.clearUpdateRanges();age.addUpdateRange(0,used);age.needsUpdate=true;
    }
  }
  setMaterial(material){this.material=material;for(const {mesh} of this.batches.values())mesh.material=material;}
  clear(){for(const {mesh} of this.batches.values()){this.group.remove(mesh);mesh.geometry.dispose();mesh.dispose();}this.batches.clear();}
}
