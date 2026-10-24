/** Retail stalls share one instanced mesh per premises, including striped canopies. */
export function marketFixtures(THREE,b){
  const units=b.units.filter(u=>!['bathroom','dining'].includes(u.roomType)),count=Math.min(12,units.length),parts=[];
  const color=b.type==='greengrocer'?0x49854b:0xc75840;
  for(let i=0;i<count;i++){
    const unit=units[Math.floor(i*units.length/count)],add=(x,y,z,w,h,d,tint)=>parts.push({unit,x,y,z,w,h,d,tint});
    for(let stripe=0;stripe<4;stripe++)add(-.36+stripe*.24,1.12,0,.24,.10,.96,stripe%2?0xf3e4bd:color);
    for(const x of [-.4,.4])add(x,.57,-.32,.055,1.08,.055,0x765536);
    add(0,.48,.16,.86,.12,.46,0x946638);
    for(let crate=0;crate<3;crate++){const x=-.27+crate*.27;add(x,.60,.16,.23,.15,.32,0xb58a4f);add(x,.70,.16,.17,.10,.22,[0xd85a32,0x72a43e,0xe9c45c][crate]);}
    add(0,.88,-.34,.55,.18,.055,color);
  }
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0xffffff}),parts.length);
  mesh.userData.parts=parts;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
export function positionMarketFixtures(THREE,mesh,b,ground){
  const matrix=new THREE.Matrix4(),turn=(b.rotation||0)*Math.PI/2,cos=Math.cos(turn),sin=Math.sin(turn),color=new THREE.Color();
  mesh.userData.parts.forEach((p,i)=>{
    matrix.makeRotationY(turn);matrix.scale(new THREE.Vector3(p.w,p.h,p.d));
    matrix.setPosition(p.unit.x+.5+p.x*cos+p.z*sin,ground(p.unit)+p.y,p.unit.y+.5-p.x*sin+p.z*cos);
    mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.setHex(p.tint));
  });mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
}
