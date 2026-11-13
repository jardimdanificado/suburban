import {grassRoots} from './volumetric_grass.js?v=meadow-accents-1';
function random(x,z,salt){const n=Math.sin(x*127.1+z*311.7+salt*74.7)*43758.5453;return n-Math.floor(n);}
export function beachShellInstances(positions,excludedCells){
  const roots=grassRoots(positions,undefined,excludedCells).roots,shells=[];
  for(let i=0;i<roots.length;i+=3){
    const x=roots[i],z=roots[i+2];
    if(random(x,z,21)>.00065)continue;
    shells.push({x,y:roots[i+1]+.012,z,angle:random(x,z,22)*Math.PI*2,size:.065+random(x,z,23)*.04,tint:random(x,z,24)});
  }
  return shells;
}
export function beachShellSurface(){
  const positions=[],colors=[];
  const triangle=(a,b,c,tone)=>{positions.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(tone,tone*.91,tone*.78);};
  const center=[0,.10,-.28];
  // A raised middle vertex on each radial rib makes a small scallop shell.
  for(let rib=0;rib<7;rib++){
    const angle=i=>-.42*Math.PI+i/7*.84*Math.PI;
    const edge=i=>[Math.sin(angle(i))*.52,0,Math.cos(angle(i))*.62];
    const a=edge(rib),b=edge(rib+1),ridge=[(a[0]+b[0])*.5,.10,(a[2]+b[2])*.5];
    triangle(center,a,ridge,.94);triangle(center,ridge,b,.76);
  }
  return {positions,colors};
}
export function createBeachShellMesh(THREE,surface,material,excludedCells){
  const shells=beachShellInstances(surface.getAttribute('position').array,excludedCells);
  if(!shells.length)return null;
  const shape=beachShellSurface(),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(shape.positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(shape.colors,3));geometry.computeVertexNormals();
  const mesh=new THREE.InstancedMesh(geometry,material,shells.length),matrix=new THREE.Matrix4(),scale=new THREE.Matrix4(),color=new THREE.Color();
  shells.forEach((shell,i)=>{
    matrix.makeRotationY(shell.angle);scale.makeScale(shell.size,shell.size,shell.size);matrix.multiply(scale);matrix.setPosition(shell.x,shell.y,shell.z);mesh.setMatrixAt(i,matrix);
    mesh.setColorAt(i,color.setRGB(1,.90+shell.tint*.10,.84+shell.tint*.16));
  });
  mesh.receiveShadow=true;mesh.computeBoundingSphere();mesh.userData.terrainMaterialKey='beachShells';return mesh;
}
