// Vertex colors are linear, just like THREE.Color(hex). Passing raw sRGB
// channels to a color attribute lifts shadows and washes out the leaf palette.
export function vegetationColor(hex){
  return [hex>>>16&255,hex>>>8&255,hex&255].map(value=>{
    const channel=value/255;
    return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;
  });
}
