// Shared by rendering, shoreline geometry and surface-height queries.
export const WATER_LEVEL = -.04;
export const SAND_WATERLINE_HEIGHT = -.025;

export const WATER_WAVE_GLSL = `
  float caribbeanWaveHeight(vec2 p) {
    float waves = sin(p.x * 1.55 + p.y * .82 + uCaribbeanWaterTime * 1.15) * .035
      + sin(p.x * .72 - p.y * 1.7 - uCaribbeanWaterTime * .82) * .026
      + cos(p.x * .35 + p.y * .45 + uCaribbeanWaterTime * .5) * .018;
    return max(-.035, waves);
  }
`;

/** CPU counterpart of caribbeanWaveHeight, used to seat boats on rendered waves. */
export function waterWaveHeight(x,z,time){
  return Math.max(-.035,Math.sin(x*1.55+z*.82+time*1.15)*.035
    +Math.sin(x*.72-z*1.7-time*.82)*.026
    +Math.cos(x*.35+z*.45+time*.5)*.018);
}
