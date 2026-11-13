// Small pixel textures retain real leaf and papery-bract detail at close range.
export function floweringShrubSurfaceTextures(THREE,bracts=false){
  const size=64,shade=new Float32Array(size*size),height=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x%16)/15,v=(y%16)/15;
    const vein=Math.abs(u-.5),branches=Math.abs(((v*4+Math.abs(u-.5)*2)%1)-.5);
    const edge=Math.abs(u-.5)+Math.abs(v-.5)*.55;
    const seed=((x*73+y*151+(x^y)*17)%47)/47;
    const leaf=edge<.48;
    const relief=bracts?.42+Math.sin(u*18+v*7)*.10+seed*.08:leaf?.58+Math.sin(u*Math.PI)*.16:.18;
    height[y*size+x]=relief+(vein<.045?.15:0)+(branches<.05?.055:0);
    shade[y*size+x]=bracts?.66+seed*.18+Math.sin(u*18+v*7)*.08:leaf?.76+seed*.18:.52+seed*.12;
  }
  const color=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=y*size+x,j=i*4,s=shade[i];
    color.set([s*255,s*255,s*255,255],j);
    const dx=(height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size])*.65;
    const dy=(height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x])*.65;
    const length=Math.hypot(dx,dy,1);
    normal.set([(-dx/length*.5+.5)*255,(-dy/length*.5+.5)*255,(1/length*.5+.5)*255,255],j);
  }
  const texture=data=>{const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
  const map=texture(color);map.colorSpace=THREE.SRGBColorSpace;
  return {map,normalMap:texture(normal)};
}
export function floweringShrubLeavesGeometry(THREE){
  const positions=[],uvs=[];
  for(const [x,y,z,r]of [[0,.30,0,.32],[-.25,.27,.04,.25],[.23,.34,-.06,.27],[-.08,.48,-.18,.24],[.07,.46,.22,.22]]){
    const geometry=new THREE.DodecahedronGeometry(r);geometry.scale(1.12,.86,1.08);geometry.translate(x,y,z);
    positions.push(...geometry.getAttribute('position').array);uvs.push(...geometry.getAttribute('uv').array);geometry.dispose();
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();return geometry;
}

export function floweringShrubFlowersGeometry(THREE){
  const positions=[],uvs=[];
  const triangle=(a,b,c)=>{positions.push(...a,...b,...c);uvs.push(0,0,1,0,.5,1);};
  for(const [x,y,z]of [[-.15,.48,.12],[.15,.52,-.08],[0,.58,.10],[-.22,.38,-.12],[.20,.40,.15]]){
    for(let petal=0;petal<3;petal++){
      const a=petal*Math.PI*2/3,c=Math.cos(a),s=Math.sin(a);
      const point=(out,side,up)=>[x+c*out-s*side,y+up,z+s*out+c*side];
      const root=point(0,0,0),left=point(.055,-.047,.022),right=point(.055,.047,.022),tip=point(.115,0,.07),ridge=point(.055,0,.05);
      triangle(root,left,ridge);triangle(left,tip,ridge);triangle(tip,right,ridge);triangle(right,root,ridge);
    }
    triangle([x-.012,y+.012,z-.012],[x+.012,y+.012,z-.012],[x,y+.025,z+.012]);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();return geometry;
}
