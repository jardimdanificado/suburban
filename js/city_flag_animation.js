export function clothFlagGeometry(THREE,width,height){
  const geometry=new THREE.PlaneGeometry(width,height,10,4);
  geometry.userData.flagBasePositions=geometry.attributes.position.array.slice();
  return geometry;
}
export function animateClothFlag(mesh,time,phase=0){
  const geometry=mesh?.geometry,positions=geometry?.attributes?.position,base=geometry?.userData?.flagBasePositions;
  if(!positions||!base)return;
  const width=geometry.parameters?.width||1,vertices=positions.count;
  for(let i=0;i<vertices;i++){
    const x=base[i*3],y=base[i*3+1],t=Math.max(0,Math.min(1,(x+width/2)/width));
    positions.array[i*3]=x;positions.array[i*3+1]=y;
    positions.array[i*3+2]=base[i*3+2]+Math.sin(time*4.2+x*5.5+y*2.7+phase)*.12*t*t;
  }
  positions.needsUpdate=true;geometry.computeVertexNormals();
}

export function flagWindTime(renderer){
  return Math.floor((renderer?.foliageAnimationTick||0)/20)*.1;
}
