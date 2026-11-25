// Instanced 3D blood and mud stains on streets, building walls, and plants.
const local = new WeakMap();

export function syncCombatStains(THREE, renderer, city, map) {
  const sanitation = city?.sanitation;
  let state = local.get(renderer);
  if (!sanitation?.stains?.size) {
    if (state) {
      state.group.visible = false;
      state.mesh.count = 0;
    }
    return;
  }
  if (!state) {
    const group = new THREE.Group();
    group.name = 'combat-stains';
    const geo = new THREE.CircleGeometry(0.5, 7);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, 384);
    mesh.frustumCulled = false;
    group.add(mesh);
    renderer.entityGroup.add(group);
    state = {
      group,
      mesh,
      revision: -1,
      matrix: new THREE.Matrix4(),
      pos: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      scale: new THREE.Vector3(),
      color: new THREE.Color(),
    };
    local.set(renderer, state);
  }
  if (!state.group.parent) renderer.entityGroup.add(state.group);
  state.group.visible = true;
  if (state.revision === sanitation.stainRevision) return;
  state.revision = sanitation.stainRevision;

  let count = 0;
  for (const stain of sanitation.stains.values()) {
    if (count >= 384) break;
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
      const nx = [0, 0.025, 0, -0.025][stain.side || 0] || 0;
      const nz = [0.025, 0, -0.025, 0][stain.side || 0] || 0;
      state.pos.set(stain.x + nx, baseH + (stain.z || 0.65), stain.y + nz);
      state.euler.set(0, rotY, 0);
    } else if (stain.scope === 'plant') {
      state.pos.set(stain.x, baseH + (stain.z || 0.35), stain.y);
      state.euler.set(0, (stain.x * 3.1 + stain.y * 1.7) % (Math.PI * 2), 0);
    } else {
      state.pos.set(stain.x, baseH + 0.018, stain.y);
      state.euler.set(-Math.PI / 2, 0, (stain.x * 2.3 + stain.y * 4.1) % (Math.PI * 2));
    }
    state.quat.setFromEuler(state.euler);
    const s = Math.max(0.25, stain.radius || 0.42);
    state.scale.set(s, s, s);
    state.matrix.compose(state.pos, state.quat, state.scale);
    state.mesh.setMatrixAt(count, state.matrix);
    state.color.setHex(stain.color ?? (stain.kind === 'blood' ? 0x8c1118 : 0x5c4228));
    state.mesh.setColorAt(count, state.color);
    count++;
  }
  state.mesh.count = count;
  state.mesh.instanceMatrix.needsUpdate = true;
  if (state.mesh.instanceColor) state.mesh.instanceColor.needsUpdate = true;
}
