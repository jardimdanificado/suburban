import {surfaceElevation} from './city_terrain.js?v=entrance-retaining-clearance-1';
import {furnitureModel} from './city_furniture_models.js?v=no-beach-towels-1';

export function fishingRodModel(THREE){
 const group=new THREE.Group(),blank=new THREE.Group();group.add(blank);group.userData.blank=blank;
 const wood=new THREE.MeshLambertMaterial({color:0x8e653d}),tip=new THREE.MeshLambertMaterial({color:0x394b49}),metal=new THREE.MeshLambertMaterial({color:0xa5b3b2});
 // The local +Z axis points toward the float; the pivot stays in the fisher's hands.
 for(let i=0;i<3;i++){const segment=new THREE.Mesh(new THREE.CylinderGeometry(.009-i*.002,.014-i*.003,.7,6),i===2?tip:wood);segment.rotation.x=Math.PI/2;segment.position.z=.35+i*.7;blank.add(segment);}
 const reel=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.045,8),metal);reel.rotation.z=Math.PI/2;reel.position.set(.045,-.035,.18);blank.add(reel);
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xd2d8ce,transparent:true,opacity:.85}));group.add(line);group.userData.line=line;
 const float=new THREE.Mesh(new THREE.SphereGeometry(.035,6,4),new THREE.MeshLambertMaterial({color:0xef7947}));group.add(float);group.userData.float=float;group.userData.fishingRod=true;return group;
}
function remove(renderer,group){renderer.scene.remove(group);group.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});}
export function syncCityFishing(renderer,THREE,city,world){
 renderer.fishingVisuals??=new Map();const live=new Set(),time=(renderer.animationPaused?0:performance.now()/1000);
 for(const c of city?.citizens||[]){const pose=c.fishingPose;if(!pose||c.dead||c.entity.destroyed||c.path?.length)continue;live.add(c.id);
  const key=`${!!pose.chair}:${!!pose.boat}`;let group=renderer.fishingVisuals.get(c.id);
  if(group&&group.userData.poseKey!==key){remove(renderer,group);renderer.fishingVisuals.delete(c.id);group=null;}
  if(!group){group=new THREE.Group();group.userData.poseKey=key;group.userData.rod=fishingRodModel(THREE);group.add(group.userData.rod);
   if(pose.chair){const chair=furnitureModel(THREE,{type:'chair',visualScale:1.6});group.add(chair);group.userData.chair=chair;}
   // Bent forearms hold the raised rod in both seated poses.
   const skin=new THREE.MeshLambertMaterial({color:c.skinColor||0xc18b65});for(const x of [-.12,.12]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.065,.065,.31),skin);arm.position.set(x,pose.boat?.52:pose.chair?.88:.47,.23);arm.rotation.x=-.3;group.add(arm);}
   renderer.scene.add(group);renderer.fishingVisuals.set(c.id,group);
  }
  const vessel=city.vehicles?.units.get(c.boatVehicleId),angle=pose.boat?(vessel?.angle||0)+Math.PI/2:Math.atan2(pose.water.x-c.entity.x,pose.water.y-c.entity.y),ground=surfaceElevation(world,c.entity.x,c.entity.y);
  group.position.set(c.entity.x,ground,c.entity.y);group.rotation.y=angle;
  const rod=group.userData.rod,scale=pose.boat?.65:1,handHeight=pose.boat?.53:pose.chair?.9:.5;rod.scale.setScalar(scale);rod.position.set(0,handHeight,.3);
  const lifting=city.minute-(c.fishingCaughtAt??-Infinity)<1,tilt=-.38-(lifting?.32:0)+Math.sin(time*1.4+c.id)*.035;rod.userData.blank.rotation.x=tilt;
  const tip=new THREE.Vector3(0,0,2.1).applyAxisAngle(new THREE.Vector3(1,0,0),tilt),floatX=c.entity.x+Math.sin(angle)*(.3+2.4*scale),floatZ=c.entity.y+Math.cos(angle)*(.3+2.4*scale),floatY=(surfaceElevation(world,floatX,floatZ)-ground-handHeight)/scale+.025;
  const points=rod.userData.line.geometry.attributes.position;points.setXYZ(0,tip.x,tip.y,tip.z);points.setXYZ(1,0,floatY,2.4);points.needsUpdate=true;rod.userData.line.geometry.computeBoundingSphere();rod.userData.float.position.set(0,floatY+Math.sin(time*2)*.012,2.4);
 }
 for(const [id,group]of renderer.fishingVisuals)if(!live.has(id)){remove(renderer,group);renderer.fishingVisuals.delete(id);}
}
