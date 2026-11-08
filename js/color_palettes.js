export const COLOR_PALETTES = [
  ['ORIGINAL', 'ORIGINAL'],
  ['LATIN', 'LATINA'], ['EUROPE', 'EUROPEIA'], ['ASIA', 'ASIATICA'],
  ['MEDITERRANEAN', 'MEDITERRANEA'], ['NORDIC', 'NORDICA'],
  ['BRAZIL', 'BRASIL'], ['MEXICO', 'MEXICO'], ['CARIBBEAN', 'CARIBE'],
  ['ANDES', 'ANDES'], ['JAPAN', 'JAPAO'], ['INDIA', 'INDIA'],
  ['MAGHREB', 'MAGREBE'], ['WEST_AFRICA', 'AFRICA OESTE'],
  ['PORTUGAL', 'PORTUGAL'], ['FRANCE', 'FRANCA'], ['ITALY', 'ITALIA'],
  ['GREECE', 'GRECIA'], ['BRITAIN', 'REINO UNIDO'], ['CHINA', 'CHINA'],
  ['KOREA', 'COREIA'], ['THAILAND', 'TAILANDIA'],
];
export const colorPaletteIndex = id => Math.max(0, COLOR_PALETTES.findIndex(([key]) => key === id));
export const COLOR_PALETTE_GLSL = `
uniform int uMaterialPalette;
vec3 applyRegionalPalette(vec3 color, vec3 materialColor) {
  if(uMaterialPalette == 0) return color;
  float luma=dot(color,vec3(0.2126,0.7152,0.0722));
  float hi=max(max(materialColor.r,materialColor.g),materialColor.b),lo=min(min(materialColor.r,materialColor.g),materialColor.b);
  bool green=materialColor.g>materialColor.r*1.06 && materialColor.g>materialColor.b*1.02;
  bool blue=materialColor.b>materialColor.r*1.08;
  bool red=materialColor.r>materialColor.g*1.22 && materialColor.r>materialColor.b*1.18;
  bool gold=materialColor.r>materialColor.b*1.18 && materialColor.g>materialColor.b*1.15 && materialColor.g>materialColor.r*0.62;
  vec3 foliage=vec3(0.22,0.58,0.31),warm=vec3(0.82,0.48,0.29),cool=vec3(0.30,0.50,0.73),neutral=vec3(0.70,0.66,0.57);
  if(uMaterialPalette==1){foliage=vec3(0.36,0.59,0.39);warm=vec3(0.75,0.39,0.28);cool=vec3(0.35,0.53,0.72);neutral=vec3(0.79,0.72,0.60);}
  else if(uMaterialPalette==2){foliage=vec3(0.48,0.59,0.39);warm=vec3(0.66,0.34,0.26);cool=vec3(0.34,0.46,0.62);neutral=vec3(0.78,0.75,0.68);}
  else if(uMaterialPalette==3){foliage=vec3(0.20,0.58,0.39);warm=vec3(0.84,0.28,0.19);cool=vec3(0.20,0.39,0.71);neutral=vec3(0.88,0.80,0.66);}
  else if(uMaterialPalette==4){foliage=vec3(0.40,0.59,0.31);warm=vec3(0.82,0.46,0.31);cool=vec3(0.20,0.50,0.76);neutral=vec3(0.91,0.84,0.70);}
  else if(uMaterialPalette==5){foliage=vec3(0.37,0.55,0.48);warm=vec3(0.67,0.46,0.37);cool=vec3(0.42,0.60,0.70);neutral=vec3(0.82,0.87,0.86);}
  else if(uMaterialPalette==6){foliage=vec3(0.12,0.57,0.30);warm=vec3(0.93,0.43,0.20);cool=vec3(0.10,0.67,0.76);neutral=vec3(0.96,0.82,0.59);}
  else if(uMaterialPalette==7){foliage=vec3(0.28,0.56,0.29);warm=vec3(0.84,0.24,0.16);cool=vec3(0.11,0.57,0.67);neutral=vec3(0.94,0.77,0.53);}
  else if(uMaterialPalette==8){foliage=vec3(0.13,0.56,0.34);warm=vec3(0.91,0.41,0.31);cool=vec3(0.09,0.62,0.75);neutral=vec3(0.95,0.86,0.69);}
  else if(uMaterialPalette==9){foliage=vec3(0.34,0.56,0.32);warm=vec3(0.78,0.39,0.25);cool=vec3(0.35,0.53,0.67);neutral=vec3(0.82,0.69,0.50);}
  else if(uMaterialPalette==10){foliage=vec3(0.22,0.50,0.36);warm=vec3(0.87,0.24,0.20);cool=vec3(0.22,0.34,0.64);neutral=vec3(0.91,0.86,0.77);}
  else if(uMaterialPalette==11){foliage=vec3(0.28,0.58,0.35);warm=vec3(0.91,0.55,0.17);cool=vec3(0.13,0.52,0.58);neutral=vec3(0.91,0.82,0.64);}
  else if(uMaterialPalette==12){foliage=vec3(0.37,0.52,0.34);warm=vec3(0.76,0.43,0.30);cool=vec3(0.25,0.48,0.66);neutral=vec3(0.86,0.80,0.67);}
  else if(uMaterialPalette==13){foliage=vec3(0.24,0.51,0.32);warm=vec3(0.78,0.36,0.22);cool=vec3(0.22,0.49,0.63);neutral=vec3(0.82,0.70,0.52);}
  else if(uMaterialPalette==14){foliage=vec3(0.30,0.57,0.33);warm=vec3(0.81,0.41,0.27);cool=vec3(0.24,0.48,0.68);neutral=vec3(0.88,0.81,0.68);}
  else if(uMaterialPalette==15){foliage=vec3(0.37,0.55,0.38);warm=vec3(0.76,0.34,0.27);cool=vec3(0.34,0.47,0.67);neutral=vec3(0.86,0.83,0.76);}
  else if(uMaterialPalette==16){foliage=vec3(0.43,0.58,0.35);warm=vec3(0.82,0.45,0.28);cool=vec3(0.22,0.50,0.76);neutral=vec3(0.95,0.88,0.73);}
  else if(uMaterialPalette==17){foliage=vec3(0.34,0.55,0.35);warm=vec3(0.78,0.43,0.30);cool=vec3(0.20,0.47,0.72);neutral=vec3(0.94,0.89,0.78);}
  else if(uMaterialPalette==18){foliage=vec3(0.39,0.54,0.36);warm=vec3(0.72,0.39,0.30);cool=vec3(0.34,0.48,0.66);neutral=vec3(0.85,0.84,0.79);}
  else if(uMaterialPalette==19){foliage=vec3(0.35,0.51,0.36);warm=vec3(0.76,0.35,0.27);cool=vec3(0.31,0.43,0.61);neutral=vec3(0.87,0.83,0.75);}
  else if(uMaterialPalette==20){foliage=vec3(0.25,0.53,0.39);warm=vec3(0.82,0.29,0.20);cool=vec3(0.25,0.39,0.69);neutral=vec3(0.91,0.86,0.76);}
  else if(uMaterialPalette==21){foliage=vec3(0.20,0.55,0.36);warm=vec3(0.82,0.39,0.22);cool=vec3(0.11,0.49,0.68);neutral=vec3(0.93,0.84,0.67);}
  vec3 pigment=neutral;
  if(green) pigment=foliage;
  else if(blue) pigment=cool;
  else if(red) pigment=mix(warm,vec3(0.75,0.18,0.16),0.38);
  else if(gold) pigment=warm;
  if(hi-lo<0.045) pigment=neutral;
  // Change hue while retaining each pixel's original luminance. This keeps
  // masonry, foliage and ground texture instead of flattening them into bands.
  float originalLuma=max(luma,0.0);
  float pigmentLuma=max(dot(pigment,vec3(0.2126,0.7152,0.0722)),0.001);
  vec3 targetPigment=pigment*(originalLuma/pigmentLuma);
  float targetPeak=max(max(targetPigment.r,targetPigment.g),targetPigment.b);
  float highlightHeadroom=(1.0-originalLuma)/max(targetPeak-originalLuma,0.001);
  // Make each regional palette clearly readable while keeping the source
  // luminance and detail. The headroom cap prevents bright materials clipping.
  float tintStrength=min(0.84,clamp(highlightHeadroom,0.0,1.0));
  vec3 colorAtOriginalLuma=color;
  float sourceLuma=max(dot(colorAtOriginalLuma,vec3(0.2126,0.7152,0.0722)),0.001);
  colorAtOriginalLuma*=originalLuma/sourceLuma;
  return mix(colorAtOriginalLuma,targetPigment,tintStrength);
}
`;
