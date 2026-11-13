// Select existing rooted grass samples: slopes, lot exclusions and chunk borders
// therefore follow exactly the same coverage as the lawn, without another scan.
function random(x,z,salt){const n=Math.sin(x*127.1+z*311.7+salt*74.7)*43758.5453;return n-Math.floor(n);}
export function grassDetailInstances(roots,shades){
  const positions=[],shapes=[],colors=[],lighting=[];
  const palette=[[.96,.84,.33],[.90,.89,.77],[.63,.42,.73],[.86,.51,.55]];
  for(let i=0;i<roots.length;i+=3){
    const x=roots[i],z=roots[i+2],patch=random(Math.floor(x/3),Math.floor(z/3),8);
    const seed=random(x,z,1);
    if(seed>.00015+patch*.00045)continue;
    const dry=random(x,z,2)<.32,color=dry?[.57,.46,.24]:palette[Math.floor(random(x,z,3)*palette.length)];
    positions.push(x,roots[i+1],z);
    shapes.push(random(x,z,4)*Math.PI*2,.30+random(x,z,5)*.14,dry?.025:.055,random(x,z,6)*Math.PI*2);
    colors.push(...color);lighting.push(shades[i/3]);
  }
  return {roots:new Float32Array(positions),shapes:new Float32Array(shapes),colors:new Float32Array(colors),shades:new Float32Array(lighting)};
}
export function grassDetailSurface(){
  const positions=[];
  // Stem and two angular leaves, topped by a shallow five-petal cup.
  const triangle=(...points)=>positions.push(...points.flat());
  triangle([-.08,0,0],[.08,0,0],[0,.90,0]);
  triangle([0,.35,0],[-.7,.60,.10],[0,.56,0]);
  triangle([0,.48,0],[.65,.68,-.08],[0,.65,0]);
  for(let p=0;p<5;p++){
    const a=p*Math.PI*2/5,b=a+Math.PI/5,c=a+Math.PI*2/5;
    triangle([0,.86,0],[Math.cos(a)*.4,.94,Math.sin(a)*.4],[Math.cos(b),1,Math.sin(b)]);
    triangle([0,.86,0],[Math.cos(b),1,Math.sin(b)],[Math.cos(c)*.4,.94,Math.sin(c)*.4]);
  }
  return positions;
}
export function createGrassDetailsMesh(THREE,grass,material){
  const data=grassDetailInstances(grass.geometry.getAttribute('grassRoot').array,grass.geometry.getAttribute('grassShade').array);
  if(!data.roots.length)return null;
  const geometry=new THREE.InstancedBufferGeometry(),positions=grassDetailSurface();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(positions.map((_,i)=>i%3===1?1:0),3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));
  for(const [name,array,size]of [['grassRoot',data.roots,3],['grassShape',data.shapes,4],['grassShade',data.shades,1],['detailColor',data.colors,3]])geometry.setAttribute(name,new THREE.InstancedBufferAttribute(array,size));
  geometry.instanceCount=data.roots.length/3;
  geometry.boundingBox=grass.geometry.boundingBox.clone();geometry.boundingBox.max.y+=.15;
  geometry.boundingSphere=geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;mesh.userData.terrainMaterialKey='grassDetails';return mesh;
}
