// Natural granite, with mineral grain and occasional iron-oxide seams.
// Generated once; the colour and relief maps share the same stone boundaries.
const cache=new WeakMap();
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
function hash(x,y,seed=0){let n=Math.imul(x^Math.imul(y,374761393)^seed,668265263);n=Math.imul(n^(n>>>13),1274126177);return (n>>>0)/4294967295;}
const mix=(a,b,t)=>a+(b-a)*t;
export function streetSurfacePixels(style,variant=0,size=style==='sidewalk'?128:256){
  const data=new Uint8ClampedArray(size*size*4),heights=new Float32Array(size*size);
  const palette=[[68,75,96],[82,78,103],[63,72,91],[103,101,116],[75,84,104],[116,108,116],[89,92,108],[72,78,99]];
  const stones=Array.from({length:12},(_,i)=>({color:palette[Math.floor(hash(i,2,variant+17)*palette.length)],rust:hash(i,7,variant+61)<.32,phase:hash(i,9,variant+31)*6.28}));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const index=y*size+x,p=index*4,fine=hash(x,y,variant*93+5);
    if(style==='sidewalk'){
      const slabX=Math.floor(x/(size/2)),slabY=Math.floor(y/(size/2));
      const localX=x%(size/2),localY=y%(size/2),edge=Math.min(localX,localY,size/2-1-localX,size/2-1-localY);
      const joint=edge<1.6||Math.min(localX,size/2-localX)<1.2||Math.min(localY,size/2-localY)<1.2;
      const slab=hash(slabX,slabY,variant+97),base=slab>.72?[177,176,168]:slab<.18?[161,166,164]:[169,171,165];
      const grain=(fine-.5)*7+(hash(Math.floor(x/5),Math.floor(y/5),variant+311)-.5)*3;
      const wear=(1-clamp(edge/8))*(-4)+Math.sin(x*.052+y*.018+slab*8)*1.5;
      const shade=joint?-17:wear;
      data[p]=base[0]+grain+shade;data[p+1]=base[1]+grain+shade;data[p+2]=base[2]+grain+shade;
      const subtleVein=Math.max(0,1-Math.abs((localY+Math.sin(localX*.075+slab*9)*5)-24)/2.2)*clamp((slab-.56)*2.4);
      for(let c=0;c<3;c++)data[p+c]=mix(data[p+c],[188,177,157][c],subtleVein*.12);
      heights[index]=joint?.40:.49+clamp(edge/8)*.045+(fine-.5)*.018;
    }else{
      const rowHeight=size/4,pitch=size/3,row=Math.floor(y/rowHeight),shift=(row&1)*pitch*.5;
      const column=Math.floor((x+shift)/pitch),localX=(x+shift)%pitch,localY=y%rowHeight,stone=stones[row*3+column%3];
      const nx=localX/pitch,ny=localY/rowHeight;
      const waviness=(Math.sin(ny*14+stone.phase)+Math.sin(ny*31+stone.phase*1.7))*.85;
      const wavinessY=(Math.sin(nx*16+stone.phase*1.3)+Math.sin(nx*29+stone.phase))*.62;
      const chip=Math.sin(localY*.46+stone.phase)*.65+hash(Math.floor(localY/3),column,row+variant)*1.3;
      const distance=Math.min(localX-1.5-chip+waviness,pitch-localX-1.5-chip-waviness,localY-1.8+wavinessY,rowHeight-localY-1.8-wavinessY);
      const bevel=clamp(distance/5),crown=Math.sin(nx*Math.PI)*Math.sin(ny*Math.PI);
      if(distance<0){data[p]=43+fine*8;data[p+1]=45+fine*8;data[p+2]=49+fine*8;heights[index]=.04;}
      else{
        const grain=(fine-.5)*25+(hash(Math.floor(localX/2),Math.floor(localY/2),row*33+variant)-.5)*16;
        const fleck=fine>.978?32:fine<.018?-28:0;
        const light=.70+bevel*.26+crown*.12;
        const veinY=rowHeight*(.45+Math.sin(localX/pitch*5+stone.phase)*.13)+Math.sin(localX*.21+stone.phase)*1.2;
        const vein=stone.rust?clamp(1-Math.abs(localY-veinY)/2.1)*clamp((hash(Math.floor(localX/9),row,variant+201)-.24)*2):0;
        const rust=vein*.72;
        for(let c=0;c<3;c++)data[p+c]=mix(stone.color[c]*light+grain+fleck,[189,137,88][c],rust);
        heights[index]=.08+bevel*.55+crown*.035+(fine-.5)*.018;
      }
    }
    data[p+3]=255;
  }
  const normals=new Uint8ClampedArray(data.length);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=y*size+x,p=i*4;
    const nx=(heights[y*size+(x-1+size)%size]-heights[y*size+(x+1)%size])*2.1;
    const ny=(heights[((y-1+size)%size)*size+x]-heights[((y+1)%size)*size+x])*2.1;
    const length=Math.hypot(nx,ny,1);
    normals[p]=(nx/length*.5+.5)*255;normals[p+1]=(ny/length*.5+.5)*255;normals[p+2]=(.5/length+.5)*255;normals[p+3]=255;
  }
  return {size,data,normals};
}
export function streetSurfaceTextures(THREE,style,variant){
  let textures=cache.get(THREE);if(!textures){textures=new Map();cache.set(THREE,textures);}
  const key=`${style}:${variant}`;if(textures.has(key))return textures.get(key);
  const pixels=streetSurfacePixels(style,variant);
  const make=(data,color)=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=pixels.size;
    const ctx=canvas.getContext('2d'),image=ctx.createImageData(pixels.size,pixels.size);image.data.set(data);ctx.putImageData(image,0,0);
    const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;
    if(color)texture.colorSpace=THREE.SRGBColorSpace;
    return texture;
  };
  const result={map:make(pixels.data,true),normalMap:make(pixels.normals,false)};textures.set(key,result);return result;
}
