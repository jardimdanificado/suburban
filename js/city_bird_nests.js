// Low-poly woven bird nests with eggs rendered on trees, balconies, fences, and roofs.
const local = new WeakMap();

export function syncBirdNests(THREE, renderer, fauna, map) {
  let state = local.get(renderer);
  if (!fauna?.nests?.size) {
    if (state) {
      state.group.visible = false;
      state.cups.count = 0;
      state.eggs.count = 0;
    }
    return;
  }
  if (!state) {
    const group = new THREE.Group();
    group.name = 'bird-nests';
    const cupGeo = new THREE.CylinderGeometry(0.18, 0.12, 0.1, 7);
    const cupMat = new THREE.MeshLambertMaterial({ color: 0x6b4b2a });
    const eggGeo = new THREE.DodecahedronGeometry(0.04, 0);
    const eggMat = new THREE.MeshLambertMaterial({ color: 0xeee8d5 });
    const cups = new THREE.InstancedMesh(cupGeo, cupMat, 128);
    const eggs = new THREE.InstancedMesh(eggGeo, eggMat, 384);
    cups.frustumCulled = false;
    eggs.frustumCulled = false;
    group.add(cups, eggs);
    renderer.entityGroup.add(group);
    state = { group, cups, eggs, matrix: new THREE.Matrix4(), pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1) };
    local.set(renderer, state);
  }
  if (!state.group.parent) renderer.entityGroup.add(state.group);
  state.group.visible = true;

  const city = renderer.cityDevelopment?.city;
  let cupCount = 0, eggCount = 0;
  for (const nest of fauna.nests.values()) {
    if (cupCount >= 128) break;
    if (nest.entity?.destroyed) continue;
    if (nest.plantId != null) {
      const plant = city?.nature?.plants?.get?.(nest.plantId);
      if (!plant || plant.entity?.destroyed) continue;
    }
    const building = nest.buildingId != null ? city?.building?.(nest.buildingId) : null;
    if (nest.buildingId != null && city?.building && (!building || building.entity?.destroyed)) continue;
    const baseH = building?.terrain?.base ?? (map ? renderer.getSurfaceElevation(map, nest.x, nest.y) : 0);
    const y = baseH + (nest.z || 0);
    state.pos.set(nest.x, y + 0.05, nest.y);
    state.matrix.compose(state.pos, state.quat, state.scale);
    state.cups.setMatrixAt(cupCount++, state.matrix);
    const numEggs = Math.min(3, nest.eggs || 0);
    for (let i = 0; i < numEggs && eggCount < 384; i++) {
      const a = (i / Math.max(1, numEggs)) * Math.PI * 2;
      state.pos.set(nest.x + Math.cos(a) * 0.05, y + 0.1, nest.y + Math.sin(a) * 0.05);
      state.matrix.compose(state.pos, state.quat, state.scale);
      state.eggs.setMatrixAt(eggCount++, state.matrix);
    }
  }
  state.cups.count = cupCount;
  state.eggs.count = eggCount;
  state.cups.instanceMatrix.needsUpdate = true;
  state.eggs.instanceMatrix.needsUpdate = true;
}
