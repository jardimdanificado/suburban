import {clothFlagGeometry} from './city_flag_animation.js?v=flag-wind-tick-13';
// These four anatomical crown triangles share exactly one vertex in every OBJ
// pose. Using their common vertex cannot drift onto a raised hand or a hat.
export const HEAD_CROWN_FACES=Object.freeze([17,19,140,142]);
export function citizenHeadAttachment(data){
  const p=data.positions,n=data.normals;
  for(let vertex=0;vertex<3;vertex++){
    const start=HEAD_CROWN_FACES[0]*9+vertex*3,position={x:p[start],y:p[start+1],z:p[start+2]},normal={x:0,y:0,z:0};let found=0;
    for(const face of HEAD_CROWN_FACES){
      for(let i=face*9;i<face*9+9;i+=3)if(p[i]===position.x&&p[i+1]===position.y&&p[i+2]===position.z){normal.x+=n[i];normal.y+=n[i+1];normal.z+=n[i+2];found++;break;}
    }
    if(found===HEAD_CROWN_FACES.length){const length=Math.hypot(normal.x,normal.y,normal.z)||1;normal.x/=length;normal.y/=length;normal.z/=length;return {position,normal};}
  }
  throw Error('Modelo sem vértice anatômico compartilhado na coroa da cabeça');
}
export function createHeadFlag(THREE,material){
  const group=new THREE.Group(),mount=new THREE.Group();group.matrixAutoUpdate=false;
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.008,.012,.40,5),new THREE.MeshLambertMaterial({color:0x795b3e}));pole.position.set(0,.19,0);
  const cloth=new THREE.Mesh(clothFlagGeometry(THREE,.24,.16),material);cloth.position.set(.12,.30,0);
  mount.add(pole,cloth);group.add(mount);group.userData.mount=mount;group.userData.cloth=cloth;group.userData.pole=pole;return group;
}
