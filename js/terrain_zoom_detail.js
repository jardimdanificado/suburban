// Fine geometry disappears below a few screen pixels. Keep the same ground
// textures and height field; only the visible mesh density changes with zoom.
const CLOSE=Object.freeze({band:2,grassAxis:24,smallDetails:true,coastSteps:4,waterSteps:2,beachSteps:12,foamSteps:8});
const MID=Object.freeze({band:1,grassAxis:12,smallDetails:false,coastSteps:2,waterSteps:2,beachSteps:6,foamSteps:4});
const FAR=Object.freeze({band:0,grassAxis:0,smallDetails:false,coastSteps:1,waterSteps:1,beachSteps:3,foamSteps:2});
export function terrainZoomDetail(zoom,perspective=false){
  if(perspective||zoom>=.85)return CLOSE;
  return zoom>=.55?MID:FAR;
}
