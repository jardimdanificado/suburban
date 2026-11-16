import {syncBoatSails} from './boat_sails.js';
import {partyFlagCanvas} from './city_party_flags.js';
import {clothFlagGeometry,animateClothFlag,flagWindTime} from './city_flag_animation.js?v=flag-wind-tick-13';
import {BOAT_HULL_DIMENSIONS} from './boat_types.js?v=local-sea-travel-2';

export function boatFlagIdentity(city,coordinator,vessel,person=null){
  const homeId=vessel?.homeCityId,currentId=city.worldPort?.cityId||city.id;
  const home=homeId&&homeId!==currentId?coordinator?.cities?.get(homeId)?.city:city;
  const local=vessel?.localVehicleId!=null?home?.vehicles?.units?.get(vessel.localVehicleId):vessel;
  const owner=person||home?.accounts?.get(local?.ownerAccountId)?.entity?.properties?.citizen||(local?.ownerAccountId!=null?home?.citizens?.find(c=>c.accountId===local.ownerAccountId):null);
  const party=owner?.political?.partyId!=null?home?.politics?.party(owner.political.partyId):null;
  return {cityFlag:home?.municipalIdentity?.flag||null,partyFlag:party?.active?party.flag:null};
}
function clearFlags(group){
  const old=group.userData.boatFlags;if(!old)return;
  group.remove(old);old.traverse(object=>{object.geometry?.dispose();object.material?.map?.dispose();object.material?.dispose();});
}
export function syncBoatFlags(renderer,THREE,city,group){
  const vessel=group.userData.worldVesselSelection?.vessel||group.userData.flagVessel;
  const identity=boatFlagIdentity(city,renderer.worldCoordinator,vessel,group.userData.flagOwner),key=JSON.stringify(identity);
  if(group.userData.boatFlagKey!==key){
    clearFlags(group);group.userData.boatFlagKey=key;
    const flags=new THREE.Group();group.userData.boatFlags=flags;group.add(flags);
    if(identity.cityFlag){
      const kind=group.userData.kind||'canoe',canoe=kind==='canoe',height=canoe ? .85 : 1.15,width=canoe ? .48 : .65;
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.012,.016,height,6),new THREE.MeshLambertMaterial({color:0xb5a780}));pole.position.y=height/2;flags.add(pole);
      const add=(flag,w,y)=>{
        let texture;const canvas=partyFlagCanvas(flag,()=>{if(texture)texture.needsUpdate=true;});
        texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
        const material=new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide});
        material.userData.boatFlag=true;
        const cloth=new THREE.Mesh(clothFlagGeometry(THREE,w,w*76/120),material);cloth.position.set(w/2,y,0);flags.add(cloth);
      };
      add(identity.cityFlag,width,height-width*76/240);
      if(identity.partyFlag)add(identity.partyFlag,width*.6,height-width*76/120-.13);
      flags.position.set(0,.28,-BOAT_HULL_DIMENSIONS[kind].length*.38);
    }
  }
  syncBoatSails(THREE,city,group,identity);
  const flags=group.userData.boatFlags;
  // Keep the stern attachment, but cancel the hull heading so cloth follows
  // the same world-space wind direction as the municipal flags (rotation PI).
  if(flags)flags.rotation.y=Math.PI-group.rotation.y;
  for(const child of flags?.children||[])animateClothFlag(child,flagWindTime(renderer));
}
