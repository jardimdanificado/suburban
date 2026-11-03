const textureCache = new Map();

function randomFrom(seed) {
  let state = (seed >>> 0) || 1;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x100000000);
}

function pixelTexture(THREE, key, draw) {
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, texture);
  return texture;
}

export function caribbeanBuildingSurfaceTextures(THREE, kind = 'plaster', variant = 0) {
  const key = `building-surface:${kind}:${variant}`;
  if (textureCache.has(key)) return textureCache.get(key);
  const size = 32, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const random = randomFrom((variant + 1) * 0x45d9f3b ^ kind.length * 0x9e3779b1);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
  if (kind === 'wood') {
    // Painted planks with worn grain and narrow, recessed board joints.
    for (const x of [0, 8, 16, 24, 31]) {
      ctx.fillStyle = 'rgba(47,39,30,.2)'; ctx.fillRect(x, 0, 1, size);
      ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x + 1, 0, 1, size);
    }
    for (let board = 0; board < 4; board++) {
      const left = board * 8 + 2;
      for (let mark = 0; mark < 7; mark++) {
        const x = left + Math.floor(random() * 5), y = Math.floor(random() * size);
        ctx.fillStyle = random() < .56 ? 'rgba(61,47,34,.12)' : 'rgba(255,255,255,.18)';
        ctx.fillRect(x, y, 1 + Math.floor(random() * 3), 1);
      }
      if (random() < .6) {
        const y = Math.floor(random() * (size - 3));
        ctx.fillStyle = 'rgba(56,43,31,.16)'; ctx.fillRect(left, y, 2 + Math.floor(random() * 3), 1);
      }
    }
  } else {
    // Fine plaster grain, faded paint patches, and a few hairline cracks.
    for (let patch = 0; patch < 12; patch++) {
      const x = Math.floor(random() * size), y = Math.floor(random() * size);
      ctx.fillStyle = random() < .55 ? 'rgba(73,62,48,.045)' : 'rgba(255,255,255,.22)';
      ctx.fillRect(x, y, 2 + Math.floor(random() * 5), 1 + Math.floor(random() * 4));
    }
    for (let fleck = 0; fleck < 72; fleck++) {
      const x = Math.floor(random() * size), y = Math.floor(random() * size);
      ctx.fillStyle = random() < .67 ? 'rgba(76,65,51,.10)' : 'rgba(255,255,255,.24)';
      ctx.fillRect(x, y, random() < .9 ? 1 : 2, 1);
    }
    for (let crack = 0; crack < 3; crack++) {
      let x = Math.floor(random() * size), y = Math.floor(random() * size);
      ctx.fillStyle = 'rgba(63,52,43,.22)';
      for (let step = 0; step < 3 + Math.floor(random() * 4); step++) {
        ctx.fillRect(x, y, 1, 1);
        x = (x + (random() < .5 ? 0 : 1)) % size; y = (y + 1) % size;
      }
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = map.minFilter = THREE.NearestFilter;
  map.generateMipmaps = false;
  map.colorSpace = THREE.SRGBColorSpace;

  // Convert the small luminance changes to shallow relief so the same pixel
  // marks catch light without making painted walls look carved or glossy.
  const rgba = ctx.getImageData(0, 0, size, size).data, heights = new Float32Array(size * size);
  for (let i = 0; i < heights.length; i++) heights[i] = (rgba[i * 4] + rgba[i * 4 + 1] + rgba[i * 4 + 2]) / (3 * 255);
  const normalCanvas = document.createElement('canvas'); normalCanvas.width = normalCanvas.height = size;
  const normalCtx = normalCanvas.getContext('2d'), normalImage = normalCtx.createImageData(size, size), normals = normalImage.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, left = heights[y * size + (x + size - 1) % size], right = heights[y * size + (x + 1) % size];
    const up = heights[((y + size - 1) % size) * size + x], down = heights[((y + 1) % size) * size + x];
    const nx = (left - right) * .65, ny = (up - down) * .65, length = Math.hypot(nx, ny, 1), p = i * 4;
    normals[p] = (nx / length * .5 + .5) * 255; normals[p + 1] = (ny / length * .5 + .5) * 255;
    normals[p + 2] = (1 / length * .5 + .5) * 255; normals[p + 3] = 255;
  }
  normalCtx.putImageData(normalImage, 0, 0);
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.magFilter = normalMap.minFilter = THREE.NearestFilter;
  normalMap.generateMipmaps = false;
  const surface = { map, normalMap };
  textureCache.set(key, surface);
  return surface;
}

export function portugueseClayTileTexture(THREE, baseColor = 0x9b5740, variant = 0) {
  const key=`portuguese-clay-tiles:${baseColor>>>0}:${variant>>>0}`;
  if(textureCache.has(key))return textureCache.get(key);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const color=[(baseColor>>>16)&255,(baseColor>>>8)&255,baseColor&255];
  const shade=(amount)=>`rgb(${color.map(channel=>Math.max(0,Math.min(255,Math.round(channel*amount)))).join(',')})`;
  ctx.fillStyle=shade(.48);ctx.fillRect(0,0,256,256);
  // Overlapping half-round clay tiles, staggered like traditional roof rows.
  for(let row=-1;row<17;row++){
    const y=row*16,offset=(row&1)?8:0;
    for(let col=-1;col<17;col++){
      const x=col*16-offset,tileSeed=(Math.imul((row%16+16)%16+1,0x45d9f3b)^Math.imul((col%16+16)%16+1,0x119de1f3)^variant^baseColor)>>>0,tileRandom=randomFrom(tileSeed),light=.84+tileRandom()*.25;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+16,y);ctx.lineTo(x+16,y+11);
      ctx.quadraticCurveTo(x+8,y+16,x,y+11);ctx.closePath();ctx.fillStyle=shade(light);ctx.fill();
      ctx.fillStyle=shade(1.15);ctx.fillRect(x+2,y+1,2,8);ctx.fillStyle=shade(.66);ctx.fillRect(x+13,y+2,2,9);
      ctx.fillStyle=shade(.53);ctx.fillRect(x+1,y+10,14,2);
      if(tileRandom()>.91){ctx.fillStyle=shade(.76);ctx.fillRect(x+5,y+4,2,1);}
    }
  }
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  // Roofs cover many screen pixels at close range but collapse to a fraction
  // of one tile at distance. Mipmaps prevent the clay rows from aliasing as
  // the camera moves while keeping crisp pixels when magnified.
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.anisotropy=4;texture.colorSpace=THREE.SRGBColorSpace;
  textureCache.set(key,texture);return texture;
}

// Keep the game's 16×16 asset drawing and add only a few climate-worn pixels.
export function weatherPixelTexture(THREE, source, materialKind, variant = 0) {
  if (!source?.image || source.userData?.hasSource === false) return source;
  const key = `weather:${source.uuid}:${materialKind}:${variant}`;
  if (textureCache.has(key)) return textureCache.get(key);
  let repaint = null;
  const texture = pixelTexture(THREE, key, ctx => {
    repaint = () => {
    ctx.clearRect(0, 0, 16, 16);
    ctx.drawImage(source.image, 0, 0, 16, 16);
    const image = ctx.getImageData(0, 0, 16, 16), data = image.data;
    const random = randomFrom((variant + 1) * 0x45d9f3b ^ materialKind.length * 0x9e3779b1);
    const palette = materialKind === 'roof'
      ? [[95, 54, 41], [205, 141, 99], [120, 67, 48]]
      : materialKind === 'stone'
        ? [[127, 118, 102], [194, 174, 139], [96, 99, 91]]
        : materialKind === 'wood'
          ? [[94, 62, 39], [164, 119, 72], [119, 82, 50]]
          : [[133, 120, 97], [205, 190, 159], [155, 143, 118]];
    const paint = (x, y, color, amount) => {
      if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
      const offset = (y * 16 + x) * 4;
      if (data[offset + 3] < 128) return;
      const brightness = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
      if (brightness < 48) return;
      for (let channel = 0; channel < 3; channel++) {
        data[offset + channel] = Math.round(data[offset + channel] * (1 - amount) + color[channel] * amount);
      }
    };
    const flecks = materialKind === 'plaster' ? 9 : 7;
    for (let i = 0; i < flecks; i++) {
      const x = Math.floor(random() * 16), y = Math.floor(random() * 16);
      const shade = palette[Math.floor(random() * palette.length)];
      const amount = .14 + random() * .16;
      paint(x, y, shade, amount);
      if (random() < .34) paint(x + (random() < .5 ? 1 : -1), y, shade, amount * .75);
    }
    ctx.putImageData(image, 0, 0);
    };
    repaint();
  });
  source.addEventListener?.('update', () => { repaint?.(); texture.needsUpdate = true; });
  return texture;
}

export function caribbeanGroundTexture(THREE, kind = 'farm', variant = 0) {
  return pixelTexture(THREE, `ground:${kind}:${variant}`, ctx => {
    const random = randomFrom((variant + 1) * 0x27d4eb2d ^ kind.length * 0x165667b1);
    const farm = kind === 'farm';
    const colors = farm
      ? ['#796044', '#8b6d4d', '#9d7a52', '#a8875d', '#6f563e']
      : ['#766d5b', '#817660', '#8c8067', '#97896e', '#6f6859', '#a09275'];
    ctx.fillStyle = colors[1]; ctx.fillRect(0, 0, 16, 16);
    if (farm) {
      for (let i = 0; i < 46; i++) {
        ctx.fillStyle = colors[Math.floor(random() * colors.length)];
        ctx.fillRect(Math.floor(random() * 16), Math.floor(random() * 16), random() < .8 ? 1 : 2, 1);
      }
      for (let row = 2; row < 16; row += 5) {
        let x = 0, y = row;
        while (x < 16) {
          const width = 2 + Math.floor(random() * 4);
          ctx.fillStyle = colors[4]; ctx.fillRect(x, y, width, 1);
          ctx.fillStyle = colors[2]; ctx.fillRect(x + 1, y + 1, Math.max(1, width - 2), 1);
          x += width;
          y += random() < .25 ? 1 : 0;
        }
      }
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#737d4d' : '#8a8b58';
        const x = Math.floor(random() * 16), y = Math.floor(random() * 16);
        ctx.fillRect(x, y, 1, 2);
      }
    } else {
      // Quiet packed earth: irregular low-contrast clumps, no parallel wheel lines.
      for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
        const chance = random();
        if (chance < .42) continue;
        ctx.fillStyle = colors[chance > .93 ? 5 : chance > .72 ? 0 : chance > .57 ? 2 : 1];
        const x = gx * 2 + Math.floor(random() * 2), y = gy * 2 + Math.floor(random() * 2);
        ctx.fillRect(x, y, chance > .9 ? 2 : 1, 1);
        if (chance > .87) ctx.fillRect(x, (y + 1) % 16, 1, 1);
      }
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 ? '#77715f' : '#a09275';
        ctx.fillRect(Math.floor(random() * 16), Math.floor(random() * 16), 1, 1);
      }
    }
  });
}

export function caribbeanGroundSurfaceTextures(THREE, kind='farm', variant=0){
  const key=`ground-real:${kind}:${variant}`;if(textureCache.has(key))return textureCache.get(key);
  const size=512,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size),data=image.data,heights=new Float32Array(size*size);
  let seed=variant+1;for(const char of kind)seed=Math.imul(seed^char.charCodeAt(0),16777619);
  const hash=(x,y,salt=0)=>{let n=Math.imul((x^Math.imul(y,374761393)^salt^seed),668265263);n=Math.imul(n^(n>>>13),1274126177);return (n^(n>>>16))>>>0;};
  const wrap=(v,n)=>(v%n+n)%n;
  const noise=(x,y,cells,salt)=>{
    const gx=x/size*cells,gy=y/size*cells,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;
    const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    const a=hash(wrap(ix,cells),wrap(iy,cells),salt)/4294967295,b=hash(wrap(ix+1,cells),wrap(iy,cells),salt)/4294967295,c=hash(wrap(ix,cells),wrap(iy+1,cells),salt)/4294967295,d=hash(wrap(ix+1,cells),wrap(iy+1,cells),salt)/4294967295;
    return (a+(b-a)*sx)*(1-sy)+(c+(d-c)*sx)*sy;
  };
  const farm=kind==='farm',dark=farm?[72,53,36]:[82,69,53],light=farm?[145,112,75]:[151,127,93];
  const cells=farm?22:27,cellSize=size/cells;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const gx=Math.floor(x/cellSize),gy=Math.floor(y/cellSize);let nearest=Infinity,second=Infinity,seedTone=.5;
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
      const cx=wrap(gx+ox,cells),cy=wrap(gy+oy,cells),jitterX=.5+(hash(cx,cy,17)/4294967295-.5)*.48,jitterY=.5+(hash(cx,cy,29)/4294967295-.5)*.48;
      let dx=x-(cx*cellSize+cellSize*jitterX),dy=y-(cy*cellSize+cellSize*jitterY);dx-=Math.round(dx/size)*size;dy-=Math.round(dy/size)*size;
      const distance=Math.hypot(dx,dy);if(distance<nearest){second=nearest;nearest=distance;seedTone=hash(cx,cy,43)/4294967295;}else if(distance<second)second=distance;
    }
    const fine=noise(x,y,112,307),grain=noise(x,y,220,401),edgeGap=second-nearest;
    const seam=edgeGap<1.05+(noise(x,y,80,419)-.5)*.65?1:0;
    let relief=(seedTone-.5)*.38+(fine-.5)*.12+(grain-.5)*.055-seam*.13;
    let furrow=0;
    if(farm){
      const warp=(noise(x,y,5,503)-.5)*.12,phase=y/size*6+warp+Math.sin(x/size*Math.PI*2)*.025,line=Math.abs(Math.sin(phase*Math.PI*2));
      furrow=line<.055?.11:line<.12?.055:line<.2?-.025:0;
      relief-=furrow;
    }else{
      // Loose construction earth has broad tamped patches and scattered aggregate.
      if(grain>.965)relief+=.12;else if(grain<.045)relief-=.09;
    }
    const value=Math.max(0,Math.min(1,.53+relief+(grain-.5)*.08)),fleck=grain>.988?9:grain<.012?-8:0,index=y*size+x,p=index*4;
    for(let channel=0;channel<3;channel++)data[p+channel]=Math.round((dark[channel]+(light[channel]-dark[channel])*value+fleck)/3)*3;
    data[p+3]=255;heights[index]=relief+(grain-.5)*.045-furrow*.42;
  }
  ctx.putImageData(image,0,0);
  const normalCanvas=document.createElement('canvas');normalCanvas.width=normalCanvas.height=size;
  const nctx=normalCanvas.getContext('2d'),normalImage=nctx.createImageData(size,size),normalData=normalImage.data;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const p=(y*size+x)*4,left=heights[y*size+(x-1+size)%size],right=heights[y*size+(x+1)%size],up=heights[((y-1+size)%size)*size+x],down=heights[((y+1)%size)*size+x];
    const nx=(left-right)*1.2,ny=(up-down)*1.2,length=Math.hypot(nx,ny,1);
    normalData[p]=(nx/length*.5+.5)*255;normalData[p+1]=(ny/length*.5+.5)*255;normalData[p+2]=(1/length*.5+.5)*255;normalData[p+3]=255;
  }
  nctx.putImageData(normalImage,0,0);
  const make=(source,color)=>{const texture=new THREE.CanvasTexture(source);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=8;if(color)texture.colorSpace=THREE.SRGBColorSpace;return texture;};
  const result={map:make(canvas,true),normalMap:make(normalCanvas,false)};textureCache.set(key,result);return result;
}
