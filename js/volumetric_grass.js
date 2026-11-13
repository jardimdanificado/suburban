import {TERRAIN_TRACK_GLSL,GRASS_TRACK_HOLD,GRASS_TRACK_LIFE} from './terrain_tracks.js?v=more-sand-2';
// Dense, rooted blade geometry. The terrain stays still; only leaf tips bend.
const BLADES_PER_AXIS = 10;
function hash(x, z, salt = 0) {
  let value = Math.imul(x ^ Math.imul(z, 374761393) ^ salt, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value >>> 0) / 4294967296;
}

// A jittered world-space lattice gives every grass tile equal coverage. Roots
// are sampled on the actual terrain triangles, including slopes and borders.
export function grassRoots(positions, colors, excludedCells = new Set()) {
  const roots = [], shapes = [], shades = [], occupied = new Set();
  for (let i = 0; i < positions.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = positions.slice(i, i + 9);
    const area = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (area < 1e-7) continue; // Ignore vertical retaining faces and undersides.
    const minX = Math.floor(Math.min(ax, bx, cx) * BLADES_PER_AXIS);
    const maxX = Math.ceil(Math.max(ax, bx, cx) * BLADES_PER_AXIS);
    const minZ = Math.floor(Math.min(az, bz, cz) * BLADES_PER_AXIS);
    const maxZ = Math.ceil(Math.max(az, bz, cz) * BLADES_PER_AXIS);
    for (let z = minZ; z < maxZ; z++) for (let x = minX; x < maxX; x++) {
      const key = `${x},${z}`;
      if (occupied.has(key)) continue;
      const px = (x + .15 + hash(x, z, 17) * .7) / BLADES_PER_AXIS;
      const pz = (z + .15 + hash(x, z, 31) * .7) / BLADES_PER_AXIS;
      if (excludedCells.has(`${Math.floor(px)},${Math.floor(pz)}`)) continue;
      const wb = ((pz - az) * (cx - ax) - (px - ax) * (cz - az)) / area;
      const wc = ((bz - az) * (px - ax) - (bx - ax) * (pz - az)) / area;
      const wa = 1 - wb - wc;
      if (wa < -1e-7 || wb < -1e-7 || wc < -1e-7) continue;
      occupied.add(key);
      const seed = hash(x, z, 71);
      roots.push(px, ay * wa + by * wb + cy * wc - .003, pz);
      shapes.push(hash(x, z, 47) * Math.PI * 2, .16 + seed * .13,
        .018 + hash(x, z, 59) * .012, seed * Math.PI * 2);
      const ao = colors ? colors[i] * wa + colors[i + 3] * wb + colors[i + 6] * wc : 1;
      shades.push(ao * (.88 + hash(x, z, 83) * .24));
    }
  }
  return {roots: new Float32Array(roots), shapes: new Float32Array(shapes), shades: new Float32Array(shades)};
}

export function createVolumetricGrassMaterial(THREE, base, time, tracks = null, {details = false} = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: details ? 0xffffff : base?.color?.clone().multiplyScalar(.82) ?? 0x4b6832,
    map: base?.map ?? null, roughness: 1, metalness: 0,
    side: THREE.DoubleSide, transparent: false, depthWrite: true,
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.grassSimTick = time;
    if(tracks)Object.assign(shader.uniforms,tracks);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      ${tracks ? TERRAIN_TRACK_GLSL : ""}
      attribute vec3 grassRoot;
      attribute vec4 grassShape;
      attribute float grassShade;
      ${details ? "attribute vec3 detailColor;" : ""}
      uniform float grassSimTick;
      varying float vBladeHeight;
      varying float vBladeShade;
      ${details ? "varying vec3 vDetailColor;" : ""}
      ${tracks ? "varying vec2 vBladeWorld;" : ""}
    `).replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_MAP
        vMapUv = (mapTransform * vec3(grassRoot.xz / 8.0, 1.0)).xy;
      #endif
    `).replace('#include <begin_vertex>', `#include <begin_vertex>
      float h = position.y;
      float angle = grassShape.x;
      vec2 across = vec2(cos(angle), sin(angle));
      vec2 forward = vec2(-across.y, across.x);
      // Use the canopy's seeded 15–24 simulation-tick pose interval.
      float windSeed = fract(sin(dot(floor(grassRoot.xz * 2.0), vec2(12.9898, 78.233))) * 43758.5453);
      float interval = 15.0 + floor(windSeed * 10.0);
      float windEpoch = floor((grassSimTick + windSeed * 100.0) / interval);
      float bend = h;
      vec2 wind = vec2(.75, .35) * sin(windEpoch * .68 + grassShape.w) * .018;
      transformed = grassRoot + vec3(
        across.x * position.x * grassShape.z + forward.x * (bend * .065 + position.z * grassShape.z) + wind.x * bend,
        h * grassShape.y,
        across.y * position.x * grassShape.z + forward.y * (bend * .065 + position.z * grassShape.z) + wind.y * bend);
      ${tracks ? `float recovery = 1.0 - terrainTrackStrength(grassRoot.xz, ${GRASS_TRACK_HOLD.toFixed(1)}, ${GRASS_TRACK_LIFE.toFixed(1)});
      transformed = grassRoot + (transformed - grassRoot) * recovery;` : ""}
      ${details ? "vDetailColor = h > .72 ? detailColor : vec3(.23,.38,.10);" : ""}
      vBladeHeight = h;
      vBladeShade = grassShade;
      ${tracks ? "vBladeWorld = (modelMatrix * vec4(transformed, 1.0)).xz;" : ""}
    `);
    // Upward shading normals model a soft canopy. They are shared across the
    // field, so terrain triangle boundaries cannot create polygonal lighting.
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      ${tracks ? TERRAIN_TRACK_GLSL : ""}
      varying float vBladeHeight;
      varying float vBladeShade;
      ${details ? "varying vec3 vDetailColor;" : ""}
      ${tracks ? "varying vec2 vBladeWorld;" : ""}
    `).replace('#include <color_fragment>', `#include <color_fragment>
      ${tracks ? `if (terrainTrackStrength(vBladeWorld, ${GRASS_TRACK_HOLD.toFixed(1)}, ${GRASS_TRACK_LIFE.toFixed(1)}) > .98) discard;` : ""}
      ${details ? "diffuseColor.rgb *= vDetailColor * vBladeShade;" : "diffuseColor.rgb *= vBladeShade * mix(vec3(.59, .68, .45), vec3(1.12, 1.10, .92), vBladeHeight);"}
    `).replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      normal = normalize(vNormal);
    `);
  };
  material.customProgramCacheKey = () => `angular-grass-canopy-ticks-v2-details-${details}-tracks-${!!tracks}`;
  return material;
}

export function createVolumetricGrassMesh(THREE, surface, material, {excludedCells, materialKey = 'volumetricGrass'} = {}) {
  const {roots, shapes, shades} = grassRoots(surface.getAttribute('position').array, surface.getAttribute('color')?.array, excludedCells);
  const geometry = new THREE.InstancedBufferGeometry();
  // A rigid triangle has a sharp silhouette without intermediate curved joints.
  const blade=grassBladeSurface();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(blade.positions,3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(blade.normals,3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(blade.uvs,2));
  geometry.setIndex(blade.indices);
  geometry.setAttribute('grassRoot', new THREE.InstancedBufferAttribute(roots, 3));
  geometry.setAttribute('grassShape', new THREE.InstancedBufferAttribute(shapes, 4));
  geometry.setAttribute('grassShade', new THREE.InstancedBufferAttribute(shades, 1));
  geometry.instanceCount = roots.length / 3;
  surface.computeBoundingBox();
  geometry.boundingBox = surface.boundingBox.clone();
  geometry.boundingBox.min.addScalar(-.12);
  geometry.boundingBox.max.add(new THREE.Vector3(.12, .35, .12));
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.terrainMaterialKey = materialKey;
  return mesh;
}

export function grassBladeSurface(){
  return {
    positions:[-1,0,0, 1,0,0, .3,1,0],
    normals:[0,1,0, 0,1,0, 0,1,0],
    uvs:[0,0, 1,0, .65,1],
    indices:[0,1,2],
  };
}
