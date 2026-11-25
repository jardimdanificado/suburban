// Buzzing flies over dirty spots, feces piles, feces graffiti, and heavy ground stains.
const local = new WeakMap();

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
      state.flyMesh.count = 0;
    }
    return;
  }
  if (!state) {
    const group = new THREE.Group();
    group.name = 'dirty-place-flies';
    const flyGeo = new THREE.BoxGeometry(0.025, 0.016, 0.025);
    const flyMat = new THREE.MeshBasicMaterial({ color: 0x16181c });
    const flyMesh = new THREE.InstancedMesh(flyGeo, flyMat, 512);
    flyMesh.frustumCulled = false;
    group.add(flyMesh);
    renderer.entityGroup.add(group);
    state = {
      group,
      flyMesh,
      matrix: new THREE.Matrix4(),
      pos: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      oneScale: new THREE.Vector3(1, 1, 1),
    };
    local.set(renderer, state);
  }
  if (!state.group.parent) renderer.entityGroup.add(state.group);
  state.group.visible = true;

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
