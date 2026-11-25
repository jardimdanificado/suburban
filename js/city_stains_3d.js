// Pixel-grainy wall/plant blood decals and buzzing flies over dirty spots, feces, and feces graffiti.
const local = new WeakMap();

function createSplatterTexture(THREE) {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size * 2 - 1;
      const dy = (y + 0.5) / size * 2 - 1;
      const r = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const lobe = 0.55 + 0.25 * Math.sin(angle * 3 + 0.7) + 0.15 * Math.cos(angle * 5 - 1.1);
      const h = hash(x, y);
      const inCore = r < lobe * 0.72 && h > 0.22;
      const inDrop = r < 0.96 && h > 0.78 + r * 0.16;
      const idx = (y * size + x) * 4;
      if (inCore || inDrop) {
        const shade = 0.72 + hash(x + 19, y + 7) * 0.28;
        data[idx] = Math.round(255 * shade);
        data[idx + 1] = Math.round(255 * shade);
        data[idx + 2] = Math.round(255 * shade);
        data[idx + 3] = Math.round((inCore ? 215 : 175) * (0.7 + h * 0.3));
      }
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

export function syncCombatStains(THREE, renderer, city, map) {
  const sanitation = city?.sanitation;
  const artList = city?.justice?.art;
  const hasStains = !!sanitation?.stains?.size;
  const hasFeces = !!sanitation?.streetFeces?.size;
  const hasFecesArt = !!artList?.some(p => !p.entity?.destroyed && p.materialUsed === 'fezes' && (p.wearProgress || 0) < 1);
  let state = local.get(renderer);
  if (!hasStains && !hasFeces && !hasFecesArt) {
    if (state) {
      state.group.visible = false;
      state.mesh.count = 0;
      state.flyMesh.count = 0;
    }
    return;
  }
  if (!state) {
    const group = new THREE.Group();
    group.name = 'combat-stains';
    const tex = createSplatterTexture(THREE);
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      map: tex,
      transparent: true,
      alphaTest: 0.2,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, 384);
    mesh.frustumCulled = false;

    const flyGeo = new THREE.BoxGeometry(0.025, 0.016, 0.025);
    const flyMat = new THREE.MeshBasicMaterial({ color: 0x16181c });
    const flyMesh = new THREE.InstancedMesh(flyGeo, flyMat, 512);
    flyMesh.frustumCulled = false;

    group.add(mesh, flyMesh);
    renderer.entityGroup.add(group);
    state = {
      group,
      mesh,
      flyMesh,
      revision: -1,
      matrix: new THREE.Matrix4(),
      pos: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      scale: new THREE.Vector3(),
      oneScale: new THREE.Vector3(1, 1, 1),
      color: new THREE.Color(),
    };
    local.set(renderer, state);
  }
  if (!state.group.parent) renderer.entityGroup.add(state.group);
  state.group.visible = true;

  if (state.revision !== (sanitation?.stainRevision ?? 0)) {
    state.revision = sanitation?.stainRevision ?? 0;
    let count = 0;
    for (const stain of sanitation?.stains?.values() || []) {
      if (count >= 384) break;
      // Ground stains are rendered via TerrainTracks' grainy terrainPaintMap residue.
      if (stain.scope === 'street') continue;
      if (stain.scope === 'plant' && stain.plantId != null) {
        const plant = city.nature?.plants?.get?.(stain.plantId);
        if (!plant || plant.entity?.destroyed) continue;
      }
      let building = null;
      if (stain.scope === 'wall' && stain.buildingId != null) {
        building = city.building?.(stain.buildingId);
        if (!building || building.entity?.destroyed) continue;
      }
      const baseH = building?.terrain?.base ?? (map ? renderer.getSurfaceElevation(map, stain.x, stain.y) : 0);
      if (stain.scope === 'wall') {
        const rotY = [0, Math.PI / 2, Math.PI, -Math.PI / 2][stain.side || 0] || 0;
        const nx = [0, 0.015, 0, -0.015][stain.side || 0] || 0;
        const nz = [0.015, 0, -0.015, 0][stain.side || 0] || 0;
        state.pos.set(stain.x + nx, baseH + (stain.z || 0.65), stain.y + nz);
        state.euler.set(0, rotY, (stain.x * 2.1 + stain.y * 3.7) % (Math.PI * 2));
      } else {
        state.pos.set(stain.x, baseH + (stain.z || 0.35), stain.y);
        state.euler.set(0, (stain.x * 3.1 + stain.y * 1.7) % (Math.PI * 2), 0);
      }
      state.quat.setFromEuler(state.euler);
      const s = Math.max(0.45, (stain.radius || 0.35) * 2.1);
      state.scale.set(s, s, s);
      state.matrix.compose(state.pos, state.quat, state.scale);
      state.mesh.setMatrixAt(count, state.matrix);
      state.color.setHex(stain.color ?? (stain.kind === 'blood' ? 0x7a0e14 : 0x5c4228));
      state.mesh.setColorAt(count, state.color);
      count++;
    }
    state.mesh.count = count;
    state.mesh.instanceMatrix.needsUpdate = true;
    if (state.mesh.instanceColor) state.mesh.instanceColor.needsUpdate = true;
  }

  // Flies over feces piles, feces graffiti, and heavy stains
  const clock = renderer.cityAnimalModels?.clock ?? (performance.now() * 0.001);
  let flyCount = 0;
  const emitFlies = (wx, wy, wz, seed, num, spread = 0.24) => {
    for (let i = 0; i < num && flyCount < 512; i++) {
      const t = clock * 5.2 + seed * 1.37 + i * 2.09;
      const r = spread * (0.5 + (i % 3) * 0.28);
      const fx = wx + Math.cos(t + Math.sin(t * 0.7)) * r;
      const fz = wy + Math.sin(t * 1.15 + i) * r;
      const fy = wz + 0.16 + Math.abs(Math.sin(t * 1.8 + i)) * 0.24 + (i % 2) * 0.06;
      state.pos.set(fx, fy, fz);
      state.euler.set(0, t * 2, 0);
      state.quat.setFromEuler(state.euler);
      state.matrix.compose(state.pos, state.quat, state.oneScale);
      state.flyMesh.setMatrixAt(flyCount++, state.matrix);
    }
  };

  for (const [key, pile] of sanitation?.streetFeces || []) {
    if (flyCount >= 512) break;
    if (!pile?.amount || pile.amount < 1) continue;
    const [x, y] = key.split(',').map(Number);
    const wx = x + 0.5, wy = y + 0.5;
    const baseH = map ? renderer.getSurfaceElevation(map, wx, wy) : 0;
    emitFlies(wx, wy, baseH, x * 31 + y, Math.min(7, 3 + Math.floor(pile.amount)), 0.28);
  }

  for (const piece of artList || []) {
    if (flyCount >= 512) break;
    if (piece.entity?.destroyed || piece.materialUsed !== 'fezes' || (piece.wearProgress || 0) >= 1) continue;
    const pos = piece.support?.position || piece.entity;
    if (!pos) continue;
    const b = piece.support?.buildingId != null ? city.building?.(piece.support.buildingId) : null;
    const baseH = b?.terrain?.base ?? (map ? renderer.getSurfaceElevation(map, pos.x, pos.y) : 0);
    const wz = piece.support?.surface === 'wall' ? (pos.z || 0.8) : baseH;
    emitFlies(pos.x, pos.y, wz, piece.id || 1, 5, 0.26);
  }

  for (const stain of sanitation?.stains?.values() || []) {
    if (flyCount >= 512) break;
    if ((stain.amount || 0) < 1.5) continue;
    const b = stain.buildingId != null ? city.building?.(stain.buildingId) : null;
    const baseH = b?.terrain?.base ?? (map ? renderer.getSurfaceElevation(map, stain.x, stain.y) : 0);
    emitFlies(stain.x, stain.y, baseH + (stain.z || 0), stain.x * 17 + stain.y, 4, 0.22);
  }

  state.flyMesh.count = flyCount;
  if (flyCount > 0) state.flyMesh.instanceMatrix.needsUpdate = true;
}
