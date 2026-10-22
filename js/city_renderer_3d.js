import { buildingGround } from './city_terrain.js';
// City geometry is built once per building; one instance is exactly one 1×1×1 space.
export function syncCityBuildings(renderer, THREE, entities, world) {
  const map = world.map;
  renderer.cityMeshes ??= new Map();
  const active = new Set();
  for (const entity of entities) {
    const b = entity.properties?.cityBuilding;
    if (!b || entity.destroyed) continue;
    active.add(entity.id);
    let group = renderer.cityMeshes.get(entity.id);
    if (!group) {
      group = new THREE.Group();
      const geometry = new THREE.BoxGeometry(0.97, 0.97, 0.97);
      const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const cells = new THREE.InstancedMesh(geometry, material, b.units.length);
      const matrix = new THREE.Matrix4(), color = new THREE.Color(b.color);
      const windows = [];
      for (let i = 0; i < b.units.length; i++) {
        const u = b.units[i];
        matrix.makeTranslation(u.x + .5, u.z + .5, u.y + .5);
        cells.setMatrixAt(i, matrix);
        cells.setColorAt(i, color.clone().multiplyScalar(0.85 + ((u.z + u.x) % 3) * .07));
        if (u.y === 0) windows.push([u.x + .5, u.z + .56, -.005, .46, .43, .025]);
        if (u.y === b.depth - 1) windows.push([u.x + .5, u.z + .56, b.depth + .005, .46, .43, .025]);
        if (u.x === 0) windows.push([-.005, u.z + .56, u.y + .5, .025, .43, .46]);
        if (u.x === b.width - 1) windows.push([b.width + .005, u.z + .56, u.y + .5, .025, .43, .46]);
      }
      cells.castShadow = true; cells.receiveShadow = true;
      group.add(cells);
      const windowMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x36545a, emissive: 0x1d2c20 }), windows.length);
      windows.forEach(([x, y, z, w, h, d], i) => { matrix.makeScale(w, h, d); matrix.setPosition(x, y, z); windowMesh.setMatrixAt(i, matrix); });
      group.add(windowMesh);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(b.width + .15, .14, b.depth + .15), new THREE.MeshLambertMaterial({ color: 0x506054 }));
      roof.position.set(b.width / 2, b.floors + .03, b.depth / 2); roof.castShadow = true; group.add(roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(.55, .85, .04), new THREE.MeshLambertMaterial({ color: 0x293e35 }));
      door.position.set(Math.floor(b.width / 2) + .5, .43, b.depth + .025); group.add(door);
      const awning = new THREE.Mesh(new THREE.BoxGeometry(1.1, .12, .7), new THREE.MeshLambertMaterial({ color: b.type === 'market' ? 0xdca14b : 0xc9d9a1 }));
      awning.position.set(door.position.x, .98, b.depth + .25); awning.castShadow = true; group.add(awning);
      const highlight = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), new THREE.MeshBasicMaterial({ color: 0xf0e6a1, wireframe: true }));
      highlight.visible = false; group.add(highlight); group.userData.highlight = highlight;
      const supports = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, 1, .2), new THREE.MeshLambertMaterial({ color: 0x68756a }), b.width * b.depth);
      supports.castShadow = true; supports.receiveShadow = true; group.add(supports); group.userData.supports = supports;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(b.width, .12, b.depth), new THREE.MeshLambertMaterial({ color: 0x7e8776 }));
      slab.position.set(b.width / 2, -.06, b.depth / 2); slab.receiveShadow = true; group.add(slab);
      const stairs = new THREE.InstancedMesh(new THREE.BoxGeometry(.8, 1, .23), new THREE.MeshLambertMaterial({ color: 0x7e8776 }), 4);
      stairs.receiveShadow = true; group.add(stairs); group.userData.stairs = stairs;
      group.userData.cells = cells;
      renderer.scene.add(group);
      renderer.cityMeshes.set(entity.id, group);
    }
    if (group.userData.terrainRevision !== (world.revision || 0)) {
      b.terrain = buildingGround(world, entity.x, entity.y, b.width, b.depth);
      const base = b.terrain.base, matrix = new THREE.Matrix4();
      let index = 0;
      for (let y = 0; y < b.depth; y++) for (let x = 0; x < b.width; x++) {
        const ground = renderer.getSurfaceElevation(map, entity.x + x + .5, entity.y + y + .5);
        const height = Math.max(.02, base - ground);
        matrix.makeScale(1, height, 1); matrix.setPosition(x + .5, -height / 2, y + .5);
        group.userData.supports.setMatrixAt(index++, matrix);
      }
      group.userData.supports.instanceMatrix.needsUpdate = true;
      const entrance = renderer.getSurfaceElevation(map, b.door.x, b.door.y);
      for (let i = 0; i < 4; i++) {
        const z = b.depth + (i + .5) * .22;
        const ground = renderer.getSurfaceElevation(map, b.door.x, entity.y + z);
        const top = base - (base - entrance) * (i + 1) / 4;
        const height = Math.max(.025, top - ground);
        matrix.makeScale(1, height, 1); matrix.setPosition(Math.floor(b.width / 2) + .5, ground + height / 2 - base, z);
        group.userData.stairs.setMatrixAt(i, matrix);
      }
      group.userData.stairs.instanceMatrix.needsUpdate = true;
      group.userData.terrainRevision = world.revision || 0;
    }
    group.position.set(entity.x, b.terrain.base, entity.y);
    const unit = b.units.find(u => u.id === renderer.selectedCityUnitId);
    group.userData.highlight.visible = renderer.selectedEntityId === entity.id && !!unit;
    if (unit) group.userData.highlight.position.set(unit.x + .5, unit.z + .5, unit.y + .5);
    group.userData.cells.material.emissive.setHex(renderer.selectedEntityId === entity.id ? 0x26351a : 0x000000);
  }
  for (const [id, group] of renderer.cityMeshes) if (!active.has(id)) {
    renderer.scene.remove(group);
    group.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
    renderer.cityMeshes.delete(id);
  }
}
