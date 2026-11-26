const VERTEX_SHADER = `
attribute vec3 smoothNormal;
#ifdef HAS_WEIGHT_MORPH
  attribute vec3 weightMorph;
#endif
#ifdef HAS_SKIRT_MORPH
  attribute vec3 skirtMorph;
#endif
uniform float uFat;
uniform float uOutlinePx;
uniform vec2 uResolution;
void main() {
  vec3 transformed = position;
  #ifdef HAS_WEIGHT_MORPH
    transformed += uFat * weightMorph;
  #endif
  #ifdef HAS_SKIRT_MORPH
    transformed += uFat * skirtMorph;
  #endif
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  vec4 clipPos = projectionMatrix * mvPosition;
  vec3 viewNormal = normalize(normalMatrix * smoothNormal);
  vec3 clipNormal = mat3(projectionMatrix) * viewNormal;
  vec2 screenNormal = clipNormal.xy;
  float len = length(screenNormal);
  if (len > 1e-5) {
    screenNormal /= len;
    clipPos.xy += screenNormal * (uOutlinePx * 2.0 / max(uResolution, vec2(1.0))) * clipPos.w;
  }
  clipPos.z += 0.00002 * clipPos.w;
  gl_Position = clipPos;
}
`;

const FRAGMENT_SHADER = `
uniform vec3 uOutlineColor;
uniform float uOutlineOpacity;
void main() {
  gl_FragColor = vec4(uOutlineColor, uOutlineOpacity);
}
`;

/**
 * Computes and caches per-vertex averaged normals on a BufferGeometry so
 * back-face hull extrusion never splits along hard/faceted edges.
 */
export function ensureSmoothNormals(THREE, geometry) {
  if (!geometry?.attributes?.position || !geometry?.attributes?.normal) return;
  if (geometry.attributes.smoothNormal) return;
  const pos = geometry.attributes.position;
  const norm = geometry.attributes.normal;
  const count = pos.count;
  const smooth = new Float32Array(count * 3);
  const accum = new Map();

  for (let i = 0; i < count; i++) {
    const key = `${Math.round(pos.getX(i) * 10000)}_${Math.round(pos.getY(i) * 10000)}_${Math.round(pos.getZ(i) * 10000)}`;
    let sum = accum.get(key);
    if (!sum) {
      sum = [0, 0, 0];
      accum.set(key, sum);
    }
    sum[0] += norm.getX(i);
    sum[1] += norm.getY(i);
    sum[2] += norm.getZ(i);
  }

  for (let i = 0; i < count; i++) {
    const key = `${Math.round(pos.getX(i) * 10000)}_${Math.round(pos.getY(i) * 10000)}_${Math.round(pos.getZ(i) * 10000)}`;
    const sum = accum.get(key);
    const len = Math.hypot(sum[0], sum[1], sum[2]) || 1;
    smooth[i * 3] = sum[0] / len;
    smooth[i * 3 + 1] = sum[1] / len;
    smooth[i * 3 + 2] = sum[2] / len;
  }

  geometry.setAttribute('smoothNormal', new THREE.BufferAttribute(smooth, 3));
}

/**
 * Renders a screen-space-consistent back-face silhouette outline around the
 * currently selected creature model.
 */
export class SelectionOutline {
  constructor(THREE, parentGroup, { color = 0xffe066, opacity = 0.95, thicknessPx = 2.5 } = {}) {
    this.THREE = THREE;
    this.parentGroup = parentGroup;
    this.pool = [];
    this.count = 0;
    this.materials = new Map();
    this.sharedUniforms = THREE.Color && THREE.Vector2 ? {
      uOutlineColor: { value: new THREE.Color(color) },
      uOutlineOpacity: { value: opacity },
      uOutlinePx: { value: thicknessPx },
      uResolution: { value: new THREE.Vector2(1280, 720) },
      uFat: { value: 0 },
    } : null;
  }

  begin() {
    this.count = 0;
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].visible = false;
    }
  }

  setResolution(width, height) {
    if (!this.sharedUniforms) return;
    this.sharedUniforms.uResolution.value.set(Math.max(1, width), Math.max(1, height));
  }

  getMaterial(variant) {
    let mat = this.materials.get(variant);
    if (mat) return mat;
    const defines = {};
    if (variant === 'weight') defines.HAS_WEIGHT_MORPH = 1;
    else if (variant === 'skirt') defines.HAS_SKIRT_MORPH = 1;
    mat = new this.THREE.ShaderMaterial({
      uniforms: {
        uOutlineColor: this.sharedUniforms.uOutlineColor,
        uOutlineOpacity: this.sharedUniforms.uOutlineOpacity,
        uOutlinePx: this.sharedUniforms.uOutlinePx,
        uResolution: this.sharedUniforms.uResolution,
        uFat: { value: 0 },
      },
      defines,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      side: this.THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      transparent: true,
    });
    this.materials.set(variant, mat);
    return mat;
  }

  add(geometry, matrix, fat = 0) {
    if (!geometry || !this.THREE.ShaderMaterial || !this.THREE.Mesh || !this.sharedUniforms) return;
    ensureSmoothNormals(this.THREE, geometry);
    if (!geometry.attributes?.smoothNormal) return;

    const variant = geometry.attributes.skirtMorph
      ? 'skirt'
      : (geometry.attributes.weightMorph ? 'weight' : 'plain');
    const material = this.getMaterial(variant);
    material.uniforms.uFat.value = fat || 0;

    let mesh = this.pool[this.count];
    if (!mesh) {
      mesh = new this.THREE.Mesh(geometry, material);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 0;
      this.parentGroup.add(mesh);
      this.pool.push(mesh);
    } else {
      mesh.geometry = geometry;
      mesh.material = material;
    }
    mesh.matrix.copy(matrix);
    mesh.matrixWorldNeedsUpdate = true;
    mesh.visible = true;
    this.count++;
  }
}

/**
 * Resolves the entity ID of the creature whose info window is currently open,
 * or -1 when no creature info window is open.
 */
export function openCreatureInfoEntityId({ gameUI, cityUI, city } = {}) {
  if (gameUI?.active) {
    const desktop = gameUI.desktop;
    if (!desktop?.visible) return -1;
    const active = desktop.manager?.active;
    if (active?.state?.inspectedCreatureEntityId > 0) {
      return active.state.inspectedCreatureEntityId;
    }
    const windows = desktop.manager?.windows || [];
    for (let i = windows.length - 1; i >= 0; i--) {
      const id = windows[i]?.state?.inspectedCreatureEntityId;
      if (id > 0) return id;
    }
    return -1;
  }

  if (!cityUI?.visible) return -1;
  const fromWindow = (w) => {
    const ent = w?.state?.selected;
    if (ent && !ent.destroyed && (ent.properties?.citizen || ent.properties?.cityAnimal)) {
      return ent.id;
    }
    const mt = w?.state?.mayorTarget;
    if (mt?.kind === 'person') {
      const citizen = city?.society?.citizen?.(mt.id)
        || city?.citizens?.find?.((item) => item.id === mt.id);
      if (citizen?.entity && !citizen.entity.destroyed) return citizen.entity.id;
    }
    return -1;
  };

  const activeId = fromWindow(cityUI.manager?.active);
  if (activeId > 0) return activeId;
  const windows = cityUI.manager?.windows || [];
  for (let i = windows.length - 1; i >= 0; i--) {
    const id = fromWindow(windows[i]);
    if (id > 0) return id;
  }
  return -1;
}
