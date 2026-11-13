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
