import {TERRAIN_TRACK_GLSL,GRASS_TRACK_HOLD,GRASS_TRACK_LIFE} from './terrain_tracks.js?v=grass-soil-carry-1';
// Dense, rooted blade geometry. The terrain stays still; only leaf tips bend.
const BLADES_PER_AXIS = 10;
function hash(x, z, salt = 0) {
  let value = Math.imul(x ^ Math.imul(z, 374761393) ^ salt, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value >>> 0) / 4294967296;
}

// A jittered world-space lattice gives every grass tile equal coverage. Roots
// are sampled on the actual terrain triangles, including slopes and borders.
export function grassRoots(positions,colors,excludedCells=new Set(),options={}){
  const job=grassRootSteps(positions,colors,excludedCells,options);
  let step=job.next();while(!step.done)step=job.next();return step.value;
}
export function* grassRootSteps(positions, colors, excludedCells = new Set(), {bladesPerAxis = BLADES_PER_AXIS,acceptRoot=null} = {}) {
  const axis=Math.max(0,Math.floor(bladesPerAxis));
  if(!axis)return {roots:new Float32Array(),shapes:new Float32Array(),shades:new Float32Array()};
  // Allocate numeric buffers once instead of growing three boxed-number arrays
  // and copying millions of values when a field completes.
  let areaSum=0;
  for(let i=0;i<positions.length;i+=9)areaSum+=Math.max(0,(positions[i+5]-positions[i+2])*(positions[i+6]-positions[i])-(positions[i+3]-positions[i])*(positions[i+8]-positions[i+2]))*.5;
  let capacity=Math.max(16,Math.ceil(areaSum*axis*axis)+32),count=0;
  let roots=new Float32Array(capacity*3),shapes=new Float32Array(capacity*4),shades=new Float32Array(capacity);
  const occupied=new Map();
  for (let i = 0; i < positions.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = positions.slice(i, i + 9);
    const area = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (area < 1e-7) {yield;continue;} // Ignore vertical retaining faces and undersides.
    const minX = Math.floor(Math.min(ax, bx, cx) * axis);
    const maxX = Math.ceil(Math.max(ax, bx, cx) * axis);
    const minZ = Math.floor(Math.min(az, bz, cz) * axis);
    const maxZ = Math.ceil(Math.max(az, bz, cz) * axis);
    for (let z = minZ; z < maxZ; z++) for (let x = minX; x < maxX; x++) {
      const px = (x + .15 + hash(x, z, 17) * .7) / axis;
      const pz = (z + .15 + hash(x, z, 31) * .7) / axis;
      if(acceptRoot&&!acceptRoot(Math.fround(px),Math.fround(pz)))continue;
      const wb = ((pz - az) * (cx - ax) - (px - ax) * (cz - az)) / area;
      const wc = ((bz - az) * (px - ax) - (bx - ax) * (pz - az)) / area;
      const wa = 1 - wb - wc;
      if (wa < -1e-7 || wb < -1e-7 || wc < -1e-7) continue;
      let row=occupied.get(z);
      if(row?.has(x))continue;
      if(excludedCells.size&&excludedCells.has(`${Math.floor(px)},${Math.floor(pz)}`))continue;
      if(!row){row=new Set();occupied.set(z,row);}
      row.add(x);
      const seed = hash(x, z, 71);
      if(count===capacity){
        capacity=Math.ceil(capacity*1.5);
        const nextRoots=new Float32Array(capacity*3),nextShapes=new Float32Array(capacity*4),nextShades=new Float32Array(capacity);
        nextRoots.set(roots);nextShapes.set(shapes);nextShades.set(shades);
        roots=nextRoots;shapes=nextShapes;shades=nextShades;
      }
      roots[count*3]=px;roots[count*3+1]=ay*wa+by*wb+cy*wc-.003;roots[count*3+2]=pz;
      shapes[count*4]=hash(x,z,47)*Math.PI*2;shapes[count*4+1]=.16+seed*.13;
      shapes[count*4+2]=.018+hash(x,z,59)*.012;shapes[count*4+3]=seed*Math.PI*2;
      const ao = colors ? colors[i] * wa + colors[i + 3] * wb + colors[i + 6] * wc : 1;
      shades[count++]=ao*(.88+hash(x,z,83)*.24);
    }
    yield;
  }
  return {roots:roots.slice(0,count*3),shapes:shapes.slice(0,count*4),shades:shades.slice(0,count)};
}

export function createVolumetricGrassMaterial(THREE, base, time, tracks = null, {details = false} = {}) {
  const material = new THREE.MeshLambertMaterial({
    color: details ? 0xffffff : base?.color?.clone().multiplyScalar(.82) ?? 0x4b6832,
    map: base?.map ?? null,
    side: THREE.DoubleSide, transparent: false, depthWrite: true,
  });
  material.defaultAttributeValues={...material.defaultAttributeValues,grassShelter:[0,0,0,0]};
  material.onBeforeCompile = shader => {
    shader.uniforms.grassSimTick = time;
    if(tracks)Object.assign(shader.uniforms,tracks);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      ${tracks ? TERRAIN_TRACK_GLSL : ""}
      attribute vec3 grassRoot;
      attribute vec4 grassShelter;
      varying vec4 vGrassShelter;
      varying vec2 vShelterWorld;
      attribute vec4 grassShape;
      attribute float grassShade;
      attribute vec3 grassTint;
      varying vec3 vGrassTint;
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
        across.x * position.x * grassShape.z * 1.65 + forward.x * (bend * .065 + position.z * grassShape.z) + wind.x * bend,
        h * grassShape.y,
        across.y * position.x * grassShape.z * 1.65 + forward.y * (bend * .065 + position.z * grassShape.z) + wind.y * bend);
      ${tracks ? `float contactStrength = terrainTrackStrength(grassRoot.xz, ${GRASS_TRACK_HOLD.toFixed(1)}, ${GRASS_TRACK_LIFE.toFixed(1)});
      // Expand grass contact by 2.5 cm while keeping sand imprints unchanged.
      for(int side=0;side<4;side++){
        vec2 offset=side==0?vec2(.025,0.0):side==1?vec2(-.025,0.0):side==2?vec2(0.0,.025):vec2(0.0,-.025);
        contactStrength=max(contactStrength,terrainTrackStrength(grassRoot.xz+offset, ${GRASS_TRACK_HOLD.toFixed(1)}, ${GRASS_TRACK_LIFE.toFixed(1)}));
      }
      float recovery=1.0-contactStrength;
      transformed = grassRoot + (transformed - grassRoot) * recovery;` : ""}
      ${details ? "vDetailColor = h > .72 ? detailColor : vec3(.23,.38,.10);" : ""}
      vGrassShelter=grassShelter;
      vShelterWorld=(modelMatrix*vec4(transformed,1.0)).xz;
      vBladeHeight = h;
      vBladeShade = grassShade;
      vGrassTint = grassTint;
      ${tracks ? "vBladeWorld = (modelMatrix * vec4(transformed, 1.0)).xz;" : ""}
    `);
    // Upward shading normals model a soft canopy. They are shared across the
    // field, so terrain triangle boundaries cannot create polygonal lighting.
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      ${tracks ? TERRAIN_TRACK_GLSL : ""}
      varying vec3 vGrassTint;
      varying vec4 vGrassShelter;
      varying vec2 vShelterWorld;
      varying float vBladeHeight;
      varying float vBladeShade;
      ${details ? "varying vec3 vDetailColor;" : ""}
      ${tracks ? "varying vec2 vBladeWorld;" : ""}
    `).replace('#include <color_fragment>', `#include <color_fragment>
      if(vGrassShelter.z>vGrassShelter.x && all(greaterThanEqual(vShelterWorld,vGrassShelter.xy)) && all(lessThanEqual(vShelterWorld,vGrassShelter.zw)))discard;
      ${tracks ? `if (terrainTrackStrength(vBladeWorld, ${GRASS_TRACK_HOLD.toFixed(1)}, ${GRASS_TRACK_LIFE.toFixed(1)}) > .98) discard;` : ""}
      ${details ? "diffuseColor.rgb *= vDetailColor * vBladeShade;" : "diffuseColor.rgb *= vGrassTint * vBladeShade * mix(vec3(.59, .68, .45), vec3(1.12, 1.10, .92), vBladeHeight);"}
    `).replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      normal = normalize(vNormal);
    `);
  };
  material.customProgramCacheKey = () => `lambert-grass-canopy-ticks-v3-details-${details}-tracks-${!!tracks}`;
  return material;
}

export function createVolumetricGrassMesh(THREE, surface, material, {excludedCells, materialKey = 'volumetricGrass',bladesPerAxis=BLADES_PER_AXIS,rootData=null} = {}) {
  const {roots, shapes, shades} = rootData??grassRoots(surface.getAttribute('position').array, surface.getAttribute('color')?.array, excludedCells,{bladesPerAxis});
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
  geometry.setAttribute('grassTint', new THREE.InstancedBufferAttribute(rootData?.tints??new Float32Array(roots.length).fill(1), 3));
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
