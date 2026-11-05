// Clip the existing ground triangles instead of stretching a new quad over
// their diagonal. Intersections stay on the original triangle's plane.
function clipPlane(polygon, axis, boundary, keepGreater) {
  const result = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const insideA = keepGreater ? a[axis] >= boundary : a[axis] <= boundary;
    const insideB = keepGreater ? b[axis] >= boundary : b[axis] <= boundary;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (boundary - a[axis]) / (b[axis] - a[axis]);
      result.push(a.map((value, component) => value + (b[component] - value) * t));
    }
  }
  return result;
}

export function terrainTransitionTriangles(corners, axis, min, max) {
  const triangles = [];
  for (const source of [[corners[0], corners[3], corners[2]], [corners[0], corners[2], corners[1]]]) {
    const polygon = clipPlane(clipPlane(source, axis, min, true), axis, max, false);
    for (let i = 1; i + 1 < polygon.length; i++) {
      const a = polygon[0], b = polygon[i], c = polygon[i + 1];
      const areaY = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      if (areaY > 1e-10) triangles.push([a, b, c]);
    }
  }
  return triangles;
}

export function sampleTerrainQuad(values, u, v) {
  return u <= v
    ? values[0] * (1 - v) + values[3] * (v - u) + values[2] * u
    : values[0] * (1 - u) + values[1] * (u - v) + values[2] * v;
}
