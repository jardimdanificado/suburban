// Shared, deterministic procedural maps. No downloaded assets or per-frame work.
const caches=new WeakMap();
export function boatTextureData(kind,size=128){
  const color=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),height=new Float32Array(size*size);
  const tau=Math.PI*2;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,i=y*size+x;
    const grain=Math.sin(tau*(u*12+Math.sin(v*tau*2)*.18));
    const seam=(x%(size/8))<1;
    height[i]=kind==='wood'?(seam?-.5:grain*.12+Math.sin(tau*(u*29+v*3))*.035):kind==='cloth'?(Math.cos(tau*u*16)+Math.cos(tau*v*16))*.09:(seam||y%(size/4)<1?-.18:Math.sin(tau*(u*43+v*37))*.025);
    const value=Math.round(195+height[i]*170);
    color.set([value,kind==='wood'?Math.round(value*.88):value,kind==='wood'?Math.round(value*.7):value,255],i*4);
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const sample=(a,b)=>height[((b+size)%size)*size+(a+size)%size];
    const dx=(sample(x-1,y)-sample(x+1,y))*1.8,dy=(sample(x,y-1)-sample(x,y+1))*1.8,length=Math.hypot(dx,dy,1);
    normal.set([Math.round((dx/length*.5+.5)*255),Math.round((dy/length*.5+.5)*255),Math.round((1/length*.5+.5)*255),255],(y*size+x)*4);
  }
  return {color,normal};
}
export function boatMaterial(THREE,kind,color,options={}){
  let cache=caches.get(THREE);if(!cache)caches.set(THREE,cache=new Map());
  let maps=cache.get(kind);
  if(!maps){
    const data=boatTextureData(kind),texture=bytes=>{const map=new THREE.DataTexture(bytes,128,128,THREE.RGBAFormat);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;return map;};
    maps={map:texture(data.color),normalMap:texture(data.normal)};maps.map.colorSpace=THREE.SRGBColorSpace;cache.set(kind,maps);
  }
  return new THREE.MeshStandardMaterial({color,...maps,roughness:kind==='wood'?.78:kind==='cloth'?.95:.42,metalness:kind==='metal'?.35:0,normalScale:new THREE.Vector2(.45,.45),...options});
}
