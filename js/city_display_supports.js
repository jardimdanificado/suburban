// One upright post meets the backing board and extends through the display's
// four-centimeter terrain clearance so it cannot hover above the ground.
export function addGroundDisplayPost(THREE,group,{height=1.2,z=0,color=0x76543a}={}){
  const post=new THREE.Mesh(new THREE.BoxGeometry(.075,height+.04,.075),new THREE.MeshLambertMaterial({color}));
  post.position.set(0,(height-.04)/2,z);post.castShadow=true;post.receiveShadow=true;
  post.userData??={};post.userData.groundDisplayPost=true;group.add(post);return post;
}
