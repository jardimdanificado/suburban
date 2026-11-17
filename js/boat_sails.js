import {partyFlagCanvas} from './city_party_flags.js';
import {TILE_WATER} from './world_gen.js?v=terrain-generation-reset-2-map-default-128';

// Briefly retain motion between worker snapshots; wave bobbing never hoists sails.
export function boatSailsUnderway(group,time,afloat){
 const {x,z}=group.position,previous=group.userData.sailMotion;
 const moved=previous&&Math.hypot(x-previous.x,z-previous.z)>.0001;
 const lastMovedAt=moved?time:previous?.lastMovedAt??-Infinity;
 group.userData.sailMotion={x,z,lastMovedAt};
 return afloat&&time-lastMovedAt<.6;
}
export function syncBoatSails(THREE,city,group,identity,time=performance.now()/1000){
 const sails=group.userData.sails;if(!sails?.length)return;
 const afloat=city.world?.getTile(Math.floor(group.position.x),Math.floor(group.position.z))===TILE_WATER;
 const underway=boatSailsUnderway(group,time,afloat),key=JSON.stringify(identity);
 const changed=group.userData.sailFlagKey!==key;
 for(let index=0;index<sails.length;index++){
  const sail=sails[index],flag=index===0?identity.cityFlag:identity.partyFlag;
  if(changed){
   const material=sail.material;if(material.userData.boatFlag)material.map?.dispose();
   let texture=null;
   if(flag){const canvas=partyFlagCanvas(flag,()=>{if(texture)texture.needsUpdate=true;});texture=new THREE.CanvasTexture(canvas);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;}
   material.map=texture;material.userData.boatFlag=!!texture;material.color.setHex(0xffffff);material.needsUpdate=true;
  }
  sail.scale.y=underway?1:.09;
  sail.position.y=underway?sail.userData.raisedY:sail.userData.furledY;
 }
 group.userData.sailFlagKey=key;group.userData.sailsRaised=underway;
}
