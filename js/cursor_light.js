// Keep the lamp above towers, preserving the old footprint and apparent falloff
// at the ground as the source moves farther away along the camera ray.
export function cursorLightPlacement(x,y,z,axis,roofHeight=0){
  const vertical=Math.max(.15,-axis.y),height=Math.max(60,roofHeight+12-y),distance=height/vertical;
  const ratio=distance/18;
  return {x:x-axis.x*distance,y:y+height,z:z-axis.z*distance,
    distance:28*ratio,angle:Math.atan(Math.tan(.4)/ratio),intensity:22*Math.pow(ratio,1.4)};
}
