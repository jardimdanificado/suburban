// Moving shadow casters must invalidate cached shadows before the same frame is drawn.
export function trackShadowTransform(renderer,object){
 const next=[object.visible,object.position.x,object.position.y,object.position.z,object.rotation.x,object.rotation.y,object.rotation.z,object.scale.x,object.scale.y,object.scale.z];
 const previous=object.userData.shadowTransform;
 if(!previous||next.some((value,index)=>value!==previous[index]))renderer.watercraftShadowDirty=true;
 object.userData.shadowTransform=next;
}
