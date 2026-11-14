// Vertex colors are linear, just like THREE.Color(hex). Passing raw sRGB
// channels to a color attribute lifts shadows and washes out the leaf palette.
export function vegetationColor(hex){
  return [hex>>>16&255,hex>>>8&255,hex&255].map(value=>{
    const channel=value/255;
    return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;
  });
}

// Leaf palettes need the stronger chroma of the established coconut/water-lily
// art. Adjust saturation in display space before decoding, preserving each
// species' hue, including the warm foliage of maple and tropical almond.
export function foliageColor(hex){
  const channels=[hex>>>16&255,hex>>>8&255,hex&255].map(value=>value/255);
  const peak=Math.max(...channels),range=peak-Math.min(...channels);
  const saturation=range>0?Math.min(1.45,peak*.955/range):1;
  return channels.map(value=>{
    const channel=(peak-(peak-value)*saturation)*.97;
    return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;
  });
}
