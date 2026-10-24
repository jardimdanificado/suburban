import { HOUSE_STYLES } from './city_culture.js';
import { INDUSTRIES } from './city_industries.js';
import { buildingGround, surfaceElevation } from './city_terrain.js';
// City geometry is built once per building; one instance is exactly one 1×1×1 space.
export function syncCityBuildings(renderer, THREE, entities, world) {
  const map = world.map;
  const inView=(x,y,width=0,depth=0)=>!Number.isFinite(renderer.renderedMinTx) ||
    x+width>=renderer.renderedMinTx-8 && x<=renderer.renderedMaxTx+8 && y+depth>=renderer.renderedMinTy-8 && y<=renderer.renderedMaxTy+8;
  renderer.lampMeshes ??= new Map();
  // A fixed light pool prevents shader recompilation and unbounded GPU work per post.
  if (!renderer.cityLampLights) {
    renderer.cityLampLights = Array.from({ length: 8 }, () => {
      const light = new THREE.PointLight(0xffbc63, 0, 5, 2); renderer.scene.add(light); return light;
    });
  }
  const liveBuildings = new Set(entities.filter(e => e.properties?.cityBuilding && !e.destroyed).map(e => e.id));
  const liveLamps = new Set(); let lightIndex = 0;
  const distanceToView = p => (p.x - (renderer.camX || 0)) ** 2 + (p.y - (renderer.camY || 0)) ** 2;
  const litNearby = new Set((world.cityLampPosts || []).filter(p => p.lit && (!p.buildingId || liveBuildings.has(p.buildingId))).sort((a, b) => distanceToView(a) - distanceToView(b)).slice(0, 8).map(p => p.id));
  for (const post of world.cityLampPosts || []) {
    if (!post.built) continue;
    liveLamps.add(post.id);
    if(!inView(post.x,post.y)){const existing=renderer.lampMeshes.get(post.id);if(existing)existing.visible=false;continue;}
    let lamp = renderer.lampMeshes.get(post.id);
    if (!lamp) {
      lamp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .07, 2, 6), new THREE.MeshLambertMaterial({ color: 0x424b42 })); pole.position.y = 1; lamp.add(pole);
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(.25, .35, .25), new THREE.MeshLambertMaterial({ color: 0xe3b65f })); lantern.position.y = 2.08; lamp.add(lantern); lamp.userData.lantern = lantern;
      renderer.scene.add(lamp); renderer.lampMeshes.set(post.id, lamp);
    }
    if(lamp.userData.terrainRevision!==world.revision||lamp.userData.x!==post.x||lamp.userData.y!==post.y||lamp.userData.height!==post.height){
      lamp.position.set(post.x,surfaceElevation(world,post.x,post.y)+(post.height||0),post.y);
      Object.assign(lamp.userData,{terrainRevision:world.revision,x:post.x,y:post.y,height:post.height});
    }
    lamp.userData.lantern.material.emissive.setHex(post.lit ? 0xffa52f : 0);
    lamp.visible = !post.buildingId || liveBuildings.has(post.buildingId);
    if (litNearby.has(post.id) && lamp.visible && lightIndex < renderer.cityLampLights.length) { const light = renderer.cityLampLights[lightIndex++]; light.position.copy(lamp.position); light.position.y += 2.1; light.intensity = 2; }
  }
  for (; lightIndex < renderer.cityLampLights.length; lightIndex++) renderer.cityLampLights[lightIndex].intensity = 0;
  for (const [id, mesh] of renderer.lampMeshes) if (!liveLamps.has(id)) { renderer.scene.remove(mesh); mesh.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); renderer.lampMeshes.delete(id); }
  renderer.lampSiteMeshes ??= new Map();
  const sites = new Set();
  for (const site of world.cityLampSites || []) {
    if (site.built || site.status === 'cancelled') continue;
    sites.add(site.id);
    if(!inView(site.x,site.y)){const existing=renderer.lampSiteMeshes.get(site.id);if(existing)existing.visible=false;continue;}
    let marker = renderer.lampSiteMeshes.get(site.id);
    if (!marker) {
      marker = new THREE.Mesh(new THREE.BoxGeometry(.9, .12, .9), new THREE.MeshLambertMaterial({ color: 0xc69543 }));
      renderer.scene.add(marker); renderer.lampSiteMeshes.set(site.id, marker);
    }
    marker.visible=true;
    marker.position.set(site.x, surfaceElevation(world, site.x, site.y) + .08, site.y);
  }
  for (const [id, marker] of renderer.lampSiteMeshes) if (!sites.has(id)) { renderer.scene.remove(marker); marker.geometry.dispose(); marker.material.dispose(); renderer.lampSiteMeshes.delete(id); }
  renderer.cityMeshes ??= new Map();
  const active = new Set();
  for (const entity of entities) {
    const b = entity.properties?.cityBuilding;
    if (!b || entity.destroyed) continue;
    active.add(entity.id);
    if(!inView(entity.x,entity.y,b.width,b.depth)){const existing=renderer.cityMeshes.get(entity.id);if(existing)existing.visible=false;continue;}
    if (b.constructionKind === 'open-air') { syncOpenAir(renderer, THREE, entity, b, world); continue; }
    let group = renderer.cityMeshes.get(entity.id);
    if (group && (group.userData.floorCount !== b.floors || group.userData.layoutRevision !== (b.layoutRevision||0))) {
      renderer.scene.remove(group); group.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); }); renderer.cityMeshes.delete(entity.id); group = null;
    }
    if (!group) {
      group = new THREE.Group(); group.userData.floorCount = b.floors;group.userData.layoutRevision=b.layoutRevision||0;
      const geometry = new THREE.BoxGeometry(0.97, 0.97, 0.97);
      const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const cells = new THREE.InstancedMesh(geometry, material, b.units.length);
      const style = HOUSE_STYLES[b.architecture] || HOUSE_STYLES.modern;
      const residential = ['residential','popular_housing','luxury_housing'].includes(b.type);
      const matrix = new THREE.Matrix4(), color = new THREE.Color(residential ? style.wall : b.color);
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
      const roof = new THREE.Mesh(new THREE.BoxGeometry(b.width + .15, .14, b.depth + .15), new THREE.MeshLambertMaterial({ color: style.roof }));
      roof.position.set(b.width / 2, b.floors + .03, b.depth / 2); roof.castShadow = true; group.add(roof);
      if (residential) {
        const roofMaterial = new THREE.MeshLambertMaterial({color:style.roof});
        if (style.roofKind === 'gable') {
          const triangle = new THREE.Shape(); triangle.moveTo(-b.width/2-.1,0); triangle.lineTo(b.width/2+.1,0); triangle.lineTo(0,.75); triangle.closePath();
          const pitched = new THREE.Mesh(new THREE.ExtrudeGeometry(triangle,{depth:b.depth+.2,bevelEnabled:false}),roofMaterial);
          pitched.position.set(b.width/2,b.floors+.1,-.1); pitched.castShadow=true; group.add(pitched);
        } else if (style.roofKind === 'hip') {
          const pitched = new THREE.Mesh(new THREE.ConeGeometry(1,.75,4),roofMaterial); pitched.rotation.y=Math.PI/4;
          pitched.scale.set((b.width+.2)/Math.SQRT2,1,(b.depth+.2)/Math.SQRT2); pitched.position.set(b.width/2,b.floors+.475,b.depth/2); pitched.castShadow=true; group.add(pitched);
        } else roofMaterial.dispose();
        if (b.architecture === 'timber') for (let z=0;z<=b.floors;z++) {
          const beam=new THREE.Mesh(new THREE.BoxGeometry(b.width+.04,.07,.08),new THREE.MeshLambertMaterial({color:0x594736}));
          beam.position.set(b.width/2,z+.04,b.depth+.025);group.add(beam);
        }
        if (b.architecture === 'hacienda') {
          for (const x of [.25,b.width-.25]) {const column=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,.95,6),new THREE.MeshLambertMaterial({color:0xe7d9bf}));column.position.set(x,.48,b.depth+.12);group.add(column);}
          const porch=new THREE.Mesh(new THREE.BoxGeometry(b.width,.1,.6),new THREE.MeshLambertMaterial({color:style.roof}));porch.position.set(b.width/2,1,b.depth+.1);group.add(porch);
        }
      }
      const industry=INDUSTRIES[b.type];
      if(industry) {
        const material=new THREE.MeshLambertMaterial({color:b.type==='bank'?0xd5bc76:industry.category==='food'?0xe8ce94:industry.category==='services'?0x81bcb0:0x687a83});
        if(b.type==='bank') {
          for(let i=0;i<3;i++){const column=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,1.5,8),material);column.position.set(.6+i*.65,.75,b.depth+.2);group.add(column);}
          const pediment=new THREE.Mesh(new THREE.ConeGeometry(1.3,.6,3),material);pediment.rotation.y=Math.PI/2;pediment.position.set(1.25,1.7,b.depth+.2);group.add(pediment);
        } else {
          const tank=new THREE.Mesh(industry.category==='industry'?new THREE.CylinderGeometry(.35,.45,1.2,8):new THREE.BoxGeometry(1,.7,.6),material);
          tank.position.set(b.width*.65,b.floors+.6,b.depth*.5);group.add(tank);
          if(industry.category==='industry'){const chimney=new THREE.Mesh(new THREE.CylinderGeometry(.13,.2,1.8,6),material);chimney.position.set(.6,b.floors+.9,.6);group.add(chimney);}
          else {const sign=new THREE.Mesh(new THREE.BoxGeometry(1.3,.3,.08),material);sign.position.set(b.width/2,1.3,b.depth+.09);group.add(sign);}
        }
      }
      if (b.type === 'mill') {
        const blades = new THREE.Group(); blades.position.set(b.width / 2, b.floors + .3, b.depth + .08);
        for (let i = 0; i < 4; i++) { const blade = new THREE.Mesh(new THREE.BoxGeometry(.16, 1.5, .06), new THREE.MeshLambertMaterial({ color: 0xe0cd97 })); blade.rotation.z = i * Math.PI / 2; blades.add(blade); }
        group.add(blades); group.userData.millBlades = blades;
      }
      const door = new THREE.Mesh(new THREE.BoxGeometry(.55, .85, .04), new THREE.MeshLambertMaterial({ color: 0x293e35 }));
      door.position.set(Math.floor(b.width / 2) + .5, .43, b.depth + .025); group.add(door);
      const awning = new THREE.Mesh(new THREE.BoxGeometry(1.1, .12, .7), new THREE.MeshLambertMaterial({ color: b.type === 'market' ? 0xdca14b : 0xc9d9a1 }));
      const awningColors = { popular_refectory: 0xd88a45, market: 0xdca14b, bakery: 0xc78b52, greengrocer: 0x75a956, clinic: 0xf0eee4, townhall: 0x7693ae, builder: 0xb87c3f, quarry: 0x777f83, luxury_housing: 0xc7a956, popular_housing: 0xa8734d };
      awning.material.color.setHex(awningColors[b.type] ?? 0xc9d9a1);
      awning.position.set(door.position.x, .98, b.depth + .25); awning.castShadow = true; group.add(awning);
      const highlight = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), new THREE.MeshBasicMaterial({ color: 0xf0e6a1, wireframe: true }));
      highlight.visible = false; group.add(highlight); group.userData.highlight = highlight;
      const supports = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, 1, .2), new THREE.MeshLambertMaterial({ color: 0x68756a }), b.width * b.depth);
      supports.castShadow = true; supports.receiveShadow = true; group.add(supports); group.userData.supports = supports;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(b.width, .12, b.depth), new THREE.MeshLambertMaterial({ color: 0x7e8776 }));
      slab.position.set(b.width / 2, -.06, b.depth / 2); slab.receiveShadow = true; group.add(slab);
      const roomProps = new THREE.Group();
      for (const u of b.units) {
        if (u.roomType === 'bathroom') {
          const toilet = new THREE.Mesh(new THREE.BoxGeometry(.30, .38, .34), new THREE.MeshLambertMaterial({ color: 0xf1eee3 }));
          toilet.position.set(u.x + .5, u.z + .20, u.y + .5); roomProps.add(toilet);
          const tank = new THREE.Mesh(new THREE.BoxGeometry(.28, .27, .13), new THREE.MeshLambertMaterial({ color: 0xf1eee3 }));
          tank.position.set(u.x + .5, u.z + .50, u.y + .35); roomProps.add(tank);
        } else if (u.roomType === 'dining') {
          const table = new THREE.Mesh(new THREE.BoxGeometry(.68, .12, .48), new THREE.MeshLambertMaterial({ color: 0x805638 }));
          table.position.set(u.x + .5, u.z + .50, u.y + .5); roomProps.add(table);
          for (const dx of [-.23, .23]) for (const dz of [-.15, .15]) {
            const seat = new THREE.Mesh(new THREE.BoxGeometry(.16, .20, .16), new THREE.MeshLambertMaterial({ color: 0x6a745d }));
            seat.position.set(u.x + .5 + dx, u.z + .27, u.y + .5 + dz); roomProps.add(seat);
          }
        }
      }
      if (roomProps.children.length) { roomProps.visible = false; group.add(roomProps); group.userData.roomProps = roomProps; }
      const stairs = new THREE.InstancedMesh(new THREE.BoxGeometry(.8, 1, .23), new THREE.MeshLambertMaterial({ color: 0x7e8776 }), 4);
      stairs.receiveShadow = true; group.add(stairs); group.userData.stairs = stairs;
      group.userData.cells = cells;
      renderer.scene.add(group);
      renderer.cityMeshes.set(entity.id, group);
    }
    group.visible=true;
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
    if (group.userData.millBlades && b.active) group.userData.millBlades.rotation.z += .005;
    group.position.set(entity.x, b.terrain.base, entity.y);
    if (group.userData.roomProps) group.userData.roomProps.visible = renderer.selectedEntityId === entity.id;
    const unit = renderer.selectedEntityId === entity.id ? b.units.find(u => u.id === renderer.selectedCityUnitId) : null;
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

// Open-air premises follow every patch of the natural surface; no slab, walls or roof.
function syncOpenAir(renderer, THREE, entity, b, world) {
  let group = renderer.cityMeshes.get(entity.id);
  const signature=`${b.crop}:${b.layoutRevision||0}:${b.units.length}`;
  if (group && group.userData.signature !== signature) { renderer.scene.remove(group); group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); renderer.cityMeshes.delete(entity.id); group = null; }
  if (!group) {
    group = new THREE.Group(); group.userData.signature = signature;
    const patches = new THREE.InstancedMesh(new THREE.BoxGeometry(.94, .045, .94), new THREE.MeshLambertMaterial({ color: b.type === 'quarry' ? 0x94988d : 0x6e7940 }), b.units.length);
    patches.receiveShadow = true; group.add(patches); group.userData.patches = patches;
    const rows = new THREE.InstancedMesh(new THREE.BoxGeometry(.06, .08, .70), new THREE.MeshLambertMaterial({ color: b.type === 'quarry' ? 0xb0b8ba : b.crop === 'girassol' ? 0xffce30 : 0x9bbd50 }), b.units.length * 3);
    group.add(rows); group.userData.rows = rows;
    group.userData.sheds = [];
    if (['quarry', 'farm'].includes(b.type)) {
      const addShed = (unit, kind) => {
        if (!unit) return;
        const shed = new THREE.Group();
        const walls = new THREE.Mesh(new THREE.BoxGeometry(.86, .72, .86), new THREE.MeshLambertMaterial({ color: kind === 'bathroom' ? 0xd8d5c8 : 0xa8794d }));
        walls.position.set(0, .5, 0); shed.add(walls);
        const door = new THREE.Mesh(new THREE.BoxGeometry(.42, .65, .04), new THREE.MeshLambertMaterial({ color: kind === 'bathroom' ? 0x346c8b : 0x533624 }));
        door.position.set(0, .35, .45); shed.add(door);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(.22, .13, .05), new THREE.MeshLambertMaterial({ color: kind === 'bathroom' ? 0xffffff : 0xe4c775 }));
        sign.position.set(0, .80, .46); shed.add(sign);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(.67, .28, 4), new THREE.MeshLambertMaterial({ color: kind === 'bathroom' ? 0x677d86 : 0x796447 }));
        roof.position.set(0, 1.1, 0); roof.rotation.y = Math.PI / 4; shed.add(roof); group.add(shed);
        group.userData.sheds.push({ unit, mesh: shed });
      };
      addShed(b.units.find(u => u.roomType === 'bathroom'), 'bathroom');
      addShed(b.units.find(u => u.roomType === 'dining'), 'dining');
    }
    const highlight = new THREE.Mesh(new THREE.BoxGeometry(1.02, .10, 1.02), new THREE.MeshBasicMaterial({ color: 0xf8b800, wireframe: true }));
    highlight.visible = false; group.add(highlight); group.userData.highlight = highlight;
    renderer.cityMeshes.set(entity.id, group); renderer.scene.add(group);
  }
  group.visible=true;
  if (group.userData.terrainRevision !== (world.revision || 0)) {
    b.terrain = buildingGround(world, entity.x, entity.y, b.width, b.depth);
    const matrix = new THREE.Matrix4();
    b.units.forEach((u, i) => {
      const ground = surfaceElevation(world, entity.x + u.x + .5, entity.y + u.y + .5);
      matrix.makeTranslation(u.x + .5, ground + .035, u.y + .5); group.userData.patches.setMatrixAt(i, matrix);
      for (let r = 0; r < 3; r++) { matrix.makeTranslation(u.x + .2 + r * .3, ground + .08, u.y + .5); group.userData.rows.setMatrixAt(i * 3 + r, matrix); }
    });
    for (const { unit, mesh } of group.userData.sheds || []) mesh.position.set(unit.x + .5, surfaceElevation(world, entity.x + unit.x + .5, entity.y + unit.y + .5) + .06, unit.y + .5);
    group.userData.patches.instanceMatrix.needsUpdate = true; group.userData.rows.instanceMatrix.needsUpdate = true;
    group.userData.terrainRevision = world.revision || 0;
  }
  group.position.set(entity.x, 0, entity.y);
  const unit = renderer.selectedEntityId === entity.id ? b.units.find(u => u.id === renderer.selectedCityUnitId) : null;
  group.userData.highlight.visible = renderer.selectedEntityId === entity.id && !!unit;
  if (unit) group.userData.highlight.position.set(unit.x + .5, surfaceElevation(world, entity.x + unit.x + .5, entity.y + unit.y + .5) + .08, unit.y + .5);
  group.userData.patches.material.emissive.setHex(renderer.selectedEntityId === entity.id ? 0x26351a : 0);
}
