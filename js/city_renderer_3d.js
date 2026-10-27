import {addBuildingDetails} from './city_building_details.js?v=building-models-1';
import {syncConstructionSites} from './city_construction_renderer.js';
import {syncCityMobility} from './city_mobility_renderer.js';
import {syncCampaignDecorations} from './city_campaign_renderer.js';
import {marketFixtures,positionMarketFixtures} from './city_market_model.js';
import {modelSize,buildingPoint,CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import { partyFlagCanvas } from './city_party_flags.js';
import { HOUSE_STYLES } from './city_culture.js';
import { INDUSTRIES } from './city_industries.js';
import { buildingGround, surfaceElevation } from './city_terrain.js';
function buildingMaterial(renderer,THREE,kind,color){
  return renderer.createCityBuildingMaterial?.(kind,color)||new THREE.MeshLambertMaterial({color});
}
// Room coordinates count floors; render their physical height consistently with picking.

export function syncCityBuildings(renderer, THREE, entities, world) {
  const selectedPerson=entities.find(e=>e.id===renderer.selectedEntityId)?.properties?.citizen;
  const selectedInteriorId=selectedPerson?.indoorLocation?.buildingId;
  syncConstructionSites(renderer,THREE,world,renderer.cityDevelopment);
  syncCampaignDecorations(renderer,THREE,entities,world);
  syncCityMobility(renderer,THREE,entities,world);
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
  const lightBudget=renderer.rapidCityMode?2:renderer.cityLampLights.length;
  const litNearby = new Set((world.cityLampPosts || []).filter(p => p.lit && (!p.buildingId || liveBuildings.has(p.buildingId))).sort((a, b) => distanceToView(a) - distanceToView(b)).slice(0, lightBudget).map(p => p.id));
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
    if (litNearby.has(post.id) && lamp.visible && lightIndex < lightBudget) { const light = renderer.cityLampLights[lightIndex++]; light.position.copy(lamp.position); light.position.y += 2.1; light.intensity = 2;light.visible=true; }
  }
  for (; lightIndex < renderer.cityLampLights.length; lightIndex++){renderer.cityLampLights[lightIndex].intensity = 0;renderer.cityLampLights[lightIndex].visible=false;}
  for (const [id, mesh] of renderer.lampMeshes) if (!liveLamps.has(id)) { renderer.scene.remove(mesh); mesh.traverse(o => { o.geometry?.dispose(); o.material?.dispose();o.userData.partyFlagTexture?.dispose(); }); renderer.lampMeshes.delete(id); }
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
    if (group && (group.userData.floorCount !== b.floors || group.userData.layoutRevision !== (b.layoutRevision||0) || group.userData.rotation !== (b.rotation||0)||group.userData.paintRevision!==(b.paintRevision||0)||group.userData.campaignPaintId!==(b.campaignPaint?.id??null))) {
      renderer.scene.remove(group); group.traverse(object => { object.geometry?.dispose(); object.material?.dispose();object.userData.partyFlagTexture?.dispose(); }); renderer.cityMeshes.delete(entity.id); group = null;
    }
    if (!group) {
      group = new THREE.Group(); group.userData.floorCount = b.floors;group.userData.paintRevision=b.paintRevision||0;group.userData.layoutRevision=b.layoutRevision||0;group.userData.rotation=b.rotation||0;group.userData.campaignPaintId=b.campaignPaint?.id??null;
      const geometry = new THREE.BoxGeometry(0.97, CITY_FLOOR_HEIGHT-.03, 0.97);
      const material = buildingMaterial(renderer,THREE,b.architecture==='timber'?'wood':'wall',0xffffff);
      const cells = new THREE.InstancedMesh(geometry, material, b.units.length);
      const style = HOUSE_STYLES[b.architecture] || HOUSE_STYLES.modern;
      const residential = ['residential','popular_housing','luxury_housing'].includes(b.type);
      const matrix = new THREE.Matrix4(), color = new THREE.Color(b.campaignPaint?.color||b.wallColor||(residential ? style.wall : b.color));
      const windows = [];
      for (let i = 0; i < b.units.length; i++) {
        const u = b.units[i];
        matrix.makeTranslation(u.x + .5, u.z*CITY_FLOOR_HEIGHT + CITY_FLOOR_HEIGHT/2, u.y + .5);
        cells.setMatrixAt(i, matrix);
        cells.setColorAt(i,b.wallColors?.[u.id]&&!b.campaignPaint?new THREE.Color(b.wallColors[u.id]):color);
        if (u.y === 0) windows.push([u.x + .5, u.z*CITY_FLOOR_HEIGHT + .95, -.005, .46, .43, .025]);
        if (u.y === b.depth - 1) windows.push([u.x + .5, u.z*CITY_FLOOR_HEIGHT + .95, b.depth + .005, .46, .43, .025]);
        if (u.x === 0) windows.push([-.005, u.z*CITY_FLOOR_HEIGHT + .95, u.y + .5, .025, .43, .46]);
        if (u.x === b.width - 1) windows.push([b.width + .005, u.z*CITY_FLOOR_HEIGHT + .95, u.y + .5, .025, .43, .46]);
      }
      cells.castShadow = true; cells.receiveShadow = true;
      group.add(cells);
      const windowMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x36545a, emissive: 0x1d2c20 }), windows.length);
      windows.forEach(([x, y, z, w, h, d], i) => { matrix.makeScale(w, h, d); matrix.setPosition(x, y, z); windowMesh.setMatrixAt(i, matrix); });
      group.add(windowMesh);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(b.width + .15, .14, b.depth + .15), buildingMaterial(renderer,THREE,'roof',style.roof));
      roof.position.set(b.width / 2, b.floors*CITY_FLOOR_HEIGHT + .03, b.depth / 2); roof.castShadow = true; group.add(roof);group.userData.roof=roof;
      const facade=new THREE.Group(),origin=buildingPoint(b,0,0);facade.rotation.y=(b.rotation||0)*Math.PI/2;facade.position.set(origin.x,0,origin.y);group.add(facade);group.userData.facade=facade;
      {
      const b={...entity.properties.cityBuilding,...modelSize(entity.properties.cityBuilding)};
      if (residential) {
        const roofMaterial = buildingMaterial(renderer,THREE,'roof',style.roof);
        if (style.roofKind === 'gable') {
          const triangle = new THREE.Shape(); triangle.moveTo(-b.width/2-.1,0); triangle.lineTo(b.width/2+.1,0); triangle.lineTo(0,.75); triangle.closePath();
          const pitched = new THREE.Mesh(new THREE.ExtrudeGeometry(triangle,{depth:b.depth+.2,bevelEnabled:false}),roofMaterial);
          pitched.position.set(b.width/2,b.floors*CITY_FLOOR_HEIGHT+.1,-.1); pitched.castShadow=true; facade.add(pitched);
        } else if (style.roofKind === 'hip') {
          const pitched = new THREE.Mesh(new THREE.ConeGeometry(1,.75,4),roofMaterial); pitched.rotation.y=Math.PI/4;
          pitched.scale.set((b.width+.2)/Math.SQRT2,1,(b.depth+.2)/Math.SQRT2); pitched.position.set(b.width/2,b.floors*CITY_FLOOR_HEIGHT+.475,b.depth/2); pitched.castShadow=true; facade.add(pitched);
        } else roofMaterial.dispose();
        if (b.architecture === 'timber') for (let z=0;z<=b.floors;z++) {
          const beam=new THREE.Mesh(new THREE.BoxGeometry(b.width+.04,.07,.08),new THREE.MeshLambertMaterial({color:0x594736}));
          beam.position.set(b.width/2,z*CITY_FLOOR_HEIGHT+.04,b.depth+.025);facade.add(beam);
        }
        if (b.architecture === 'hacienda') {
          for (const x of [.25,b.width-.25]) {const column=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,1.5,6),new THREE.MeshLambertMaterial({color:0xe7d9bf}));column.position.set(x,.75,b.depth+.12);facade.add(column);}
          const porch=new THREE.Mesh(new THREE.BoxGeometry(b.width,.1,.6),buildingMaterial(renderer,THREE,'roof',style.roof));porch.position.set(b.width/2,1.6,b.depth+.1);facade.add(porch);
        }
      }
      if(b.type==='council_chamber'){
        const material=new THREE.MeshLambertMaterial({color:0xe1d5b3});for(let i=0;i<4;i++){const column=new THREE.Mesh(new THREE.CylinderGeometry(.08,.11,1.5,6),material);column.position.set(.4+i*(b.width-.8)/3,.75,b.depth+.15);facade.add(column);}
        const sign=new THREE.Mesh(new THREE.BoxGeometry(b.width*.85,.22,.08),new THREE.MeshLambertMaterial({color:0x4c655c}));sign.position.set(b.width/2,1.6,b.depth+.12);facade.add(sign);
      }
      if(['hospital','clinic'].includes(b.type)){
        const red=new THREE.MeshLambertMaterial({color:0xc43e42});for(const [w,h]of [[.75,.22],[.22,.75]]){const cross=new THREE.Mesh(new THREE.BoxGeometry(w,h,.12),red);cross.position.set(b.width/2,1.5,b.depth+.16);facade.add(cross);}
      }
      if(b.type==='park'){
        const trunk=new THREE.MeshLambertMaterial({color:0x79553d}),leaves=new THREE.MeshLambertMaterial({color:0x4f944e});
        for(const x of [.5,b.width-.5]){const tree=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,.85,5),trunk);tree.position.set(x,.45,b.depth+.25);facade.add(tree);const crown=new THREE.Mesh(new THREE.SphereGeometry(.45,6,5),leaves);crown.position.set(x,1,b.depth+.25);facade.add(crown);}
      }
      if(b.type==='sports_center'){
        const board=new THREE.Mesh(new THREE.BoxGeometry(.9,.6,.08),new THREE.MeshLambertMaterial({color:0xeeeeeb}));board.position.set(b.width/2,1.7,b.depth+.2);facade.add(board);
        const hoop=new THREE.Mesh(new THREE.TorusGeometry(.18,.025,5,12),new THREE.MeshLambertMaterial({color:0xc96c35}));hoop.rotation.x=Math.PI/2;hoop.position.set(b.width/2,1.5,b.depth+.43);facade.add(hoop);
      }
      if(b.type==='library'){
        for(let i=0;i<5;i++){const book=new THREE.Mesh(new THREE.BoxGeometry(.14,.45+(i%2)*.1,.15),new THREE.MeshLambertMaterial({color:[0x98764f,0x496884,0x9b5852][i%3]}));book.position.set(b.width/2-.4+i*.2,1.4,b.depth+.15);facade.add(book);}
      }
      if(b.type==='theater'){
        for(const x of [.3,b.width-.3]){const curtain=new THREE.Mesh(new THREE.BoxGeometry(.35,1.4,.15),new THREE.MeshLambertMaterial({color:0x8f3048}));curtain.position.set(x,1,b.depth+.15);facade.add(curtain);}
      }
      const industry=INDUSTRIES[b.type];
      if(industry) {
        const material=new THREE.MeshLambertMaterial({color:b.type==='bank'?0xd5bc76:industry.category==='food'?0xe8ce94:industry.category==='services'?0x81bcb0:0x687a83});
        if(b.type==='research_institute') {
          const board=new THREE.Mesh(new THREE.BoxGeometry(1.6,.85,.1),new THREE.MeshLambertMaterial({color:0xf5f3e9}));board.position.set(b.width/2,1.25,b.depth+.1);facade.add(board);
          for(let i=0;i<4;i++){const bar=new THREE.Mesh(new THREE.BoxGeometry(.2,.15+i*.13,.08),new THREE.MeshLambertMaterial({color:0x355b70}));bar.position.set(b.width/2-.5+i*.32,1+i*.065,b.depth+.18);facade.add(bar);}
          const canopy=new THREE.Mesh(new THREE.BoxGeometry(b.width,.12,.65),material);canopy.position.set(b.width/2,1.85,b.depth+.15);facade.add(canopy);
        } else if(b.type==='bank') {
          for(let i=0;i<3;i++){const column=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,1.5,8),material);column.position.set(.6+i*.65,.75,b.depth+.2);facade.add(column);}
          const pediment=new THREE.Mesh(new THREE.ConeGeometry(1.3,.6,3),material);pediment.rotation.y=Math.PI/2;pediment.position.set(1.25,1.7,b.depth+.2);facade.add(pediment);

        }
      }
      if (b.type === 'mill') {
        const blades = new THREE.Group(); blades.position.set(b.width / 2, b.floors*CITY_FLOOR_HEIGHT + .3, b.depth + .08);
        for (let i = 0; i < 4; i++) { const blade = new THREE.Mesh(new THREE.BoxGeometry(.16, 1.5, .06), new THREE.MeshLambertMaterial({ color: 0xe0cd97 })); blade.rotation.z = i * Math.PI / 2; blades.add(blade); }
        facade.add(blades); group.userData.millBlades = blades;
      }
      addBuildingDetails(THREE,facade,b);
      const door = new THREE.Mesh(new THREE.BoxGeometry(.55, 1.4, .04), new THREE.MeshLambertMaterial({ color: 0x293e35 }));
      door.position.set(Math.floor(b.width / 2) + .5, .70, b.depth + .025); facade.add(door);
      const awning = new THREE.Mesh(new THREE.BoxGeometry(1.1, .12, .7), new THREE.MeshLambertMaterial({ color: b.type === 'market' ? 0xdca14b : 0xc9d9a1 }));
      const awningColors = { popular_refectory: 0xd88a45, market: 0xdca14b, bakery: 0xc78b52, greengrocer: 0x75a956, clinic: 0xf0eee4, townhall: 0x7693ae, builder: 0xb87c3f, quarry: 0x777f83, luxury_housing: 0xc7a956, popular_housing: 0xa8734d };
      awning.material.color.setHex(awningColors[b.type] ?? 0xc9d9a1);
      awning.position.set(door.position.x, 1.55, b.depth + .25); awning.castShadow = true; facade.add(awning);
      }
      const highlight = new THREE.Mesh(new THREE.BoxGeometry(1.02, CITY_FLOOR_HEIGHT+.02, 1.02), new THREE.MeshBasicMaterial({ color: 0xf0e6a1, wireframe: true }));
      highlight.visible = false; group.add(highlight); group.userData.highlight = highlight;
      const supports = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, 1, .2), new THREE.MeshLambertMaterial({ color: 0x68756a }), b.width * b.depth);
      supports.castShadow = true; supports.receiveShadow = true; group.add(supports); group.userData.supports = supports;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(b.width, .12, b.depth), new THREE.MeshLambertMaterial({ color: 0x7e8776 }));
      slab.position.set(b.width / 2, -.06, b.depth / 2); slab.receiveShadow = true; group.add(slab);
      const roomProps = new THREE.Group();
      for (const u of b.units) {
        if(u.roomType==='office'||u.roomType==='plenary'){const desk=new THREE.Mesh(new THREE.BoxGeometry(.55,.12,.32),new THREE.MeshLambertMaterial({color:u.roomType==='plenary'?0x5f4930:0x947a4e}));desk.position.set(u.x+.5,u.z*CITY_FLOOR_HEIGHT+.42,u.y+.4);roomProps.add(desk);const seat=new THREE.Mesh(new THREE.BoxGeometry(.26,.28,.26),new THREE.MeshLambertMaterial({color:0x496759}));seat.position.set(u.x+.5,u.z*CITY_FLOOR_HEIGHT+.2,u.y+.75);roomProps.add(seat);}
        if (u.roomType === 'bathroom') {
          const toilet = new THREE.Mesh(new THREE.BoxGeometry(.30, .38, .34), new THREE.MeshLambertMaterial({ color: 0xf1eee3 }));
          toilet.position.set(u.x + .5, u.z*CITY_FLOOR_HEIGHT + .20, u.y + .5); roomProps.add(toilet);
          const tank = new THREE.Mesh(new THREE.BoxGeometry(.28, .27, .13), new THREE.MeshLambertMaterial({ color: 0xf1eee3 }));
          tank.position.set(u.x + .5, u.z*CITY_FLOOR_HEIGHT + .50, u.y + .35); roomProps.add(tank);
        } else if (u.roomType === 'dining') {
          const table = new THREE.Mesh(new THREE.BoxGeometry(.68, .12, .48), new THREE.MeshLambertMaterial({ color: 0x805638 }));
          table.position.set(u.x + .5, u.z*CITY_FLOOR_HEIGHT + .50, u.y + .5); roomProps.add(table);
          for (const dx of [-.23, .23]) for (const dz of [-.15, .15]) {
            const seat = new THREE.Mesh(new THREE.BoxGeometry(.16, .20, .16), new THREE.MeshLambertMaterial({ color: 0x6a745d }));
            seat.position.set(u.x + .5 + dx, u.z*CITY_FLOOR_HEIGHT + .27, u.y + .5 + dz); roomProps.add(seat);
          }
        }
      }
      if (roomProps.children.length) { roomProps.visible = false; group.add(roomProps); group.userData.roomProps = roomProps; }
      const stairs = new THREE.InstancedMesh(new THREE.BoxGeometry(.8, 1, .23), new THREE.MeshLambertMaterial({ color: 0x7e8776 }), 4);
      stairs.receiveShadow = true; group.add(stairs); group.userData.stairs = stairs;
      group.userData.cells = cells;
      renderer.decorateCityMaterials?.(group);
      renderer.scene.add(group);
      renderer.cityMeshes.set(entity.id, group);
    }
    group.visible=true;
    if(['townhall','council_chamber'].includes(b.type))syncTownhallFlag(group,THREE,b);
    if (group.userData.terrainRevision !== (world.revision || 0)) {
      b.terrain = buildingGround(world, entity.x, entity.y, b.width, b.depth,b.door);
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
      const front=modelSize(b);
      for (let i = 0; i < 4; i++) {
        const point=buildingPoint(b,Math.floor(front.width/2)+.5,front.depth+(i+.5)*.22);
        const ground=renderer.getSurfaceElevation(map,entity.x+point.x,entity.y+point.y);
        const top = base - (base - entrance) * (i + 1) / 4;
        const height = Math.max(.025, top - ground);
        matrix.makeRotationY((b.rotation||0)*Math.PI/2);matrix.scale(new THREE.Vector3(1,height,1));matrix.setPosition(point.x,ground+height/2-base,point.y);
        group.userData.stairs.setMatrixAt(i, matrix);
      }
      group.userData.stairs.instanceMatrix.needsUpdate = true;
      group.userData.terrainRevision = world.revision || 0;
    }
    if (group.userData.millBlades && b.active) group.userData.millBlades.rotation.z = Math.floor((renderer.foliageAnimationTick || 0)/20)*.1;
    group.position.set(entity.x, b.terrain.base, entity.y);
    const cutaway=renderer.selectedEntityId===entity.id||selectedInteriorId===b.id;
    if(group.userData.roomProps)group.userData.roomProps.visible=cutaway;
    if(group.userData.roof)group.userData.roof.visible=!cutaway;
    if(group.userData.facade)group.userData.facade.visible=!cutaway;
    const material=group.userData.cells.material;if(material.transparent!==cutaway){material.transparent=cutaway;material.needsUpdate=true;}material.opacity=cutaway?.18:1;material.depthWrite=!cutaway;
    const unit = renderer.selectedEntityId === entity.id ? b.units.find(u => u.id === renderer.selectedCityUnitId) : null;
    group.userData.highlight.visible = renderer.selectedEntityId === entity.id && !!unit;
    if (unit) group.userData.highlight.position.set(unit.x + .5, unit.z*CITY_FLOOR_HEIGHT + CITY_FLOOR_HEIGHT/2, unit.y + .5);
    group.userData.cells.material.emissive.setHex(renderer.selectedEntityId === entity.id ? 0x26351a : 0x000000);
  }
  for (const [id, group] of renderer.cityMeshes) if (!active.has(id)) {
    renderer.scene.remove(group);
    group.traverse(object => { object.geometry?.dispose(); object.material?.dispose();object.userData.partyFlagTexture?.dispose(); });
    renderer.cityMeshes.delete(id);
  }
}

// Open-air premises follow every patch of the natural surface; no slab, walls or roof.
function syncOpenAir(renderer, THREE, entity, b, world) {
  let group = renderer.cityMeshes.get(entity.id);
  const signature=`retail-v2:${b.type}:${b.width}:${b.depth}:${b.crop}:${b.layoutRevision||0}:${b.units.length}:${b.rotation||0}:${b.paintRevision||0}`;
  if (group && group.userData.signature !== signature) { renderer.scene.remove(group); group.traverse(o => { o.geometry?.dispose(); o.material?.dispose();o.userData.partyFlagTexture?.dispose(); }); renderer.cityMeshes.delete(entity.id); group = null; }
  if (!group) {
    group = new THREE.Group(); group.userData.signature = signature;
    addBuildingDetails(THREE,group,b,{outdoor:true,ground:surfaceElevation(world,entity.x+b.width/2,entity.y+b.depth/2)});
    const patches = new THREE.InstancedMesh(new THREE.BoxGeometry(.94, .045, .94), new THREE.MeshLambertMaterial({ color: b.type === 'quarry' ? 0x94988d : ['market','greengrocer'].includes(b.type)?0xb5a68d:0x6e7940 }), b.units.length);
    patches.receiveShadow = true; group.add(patches); group.userData.patches = patches;
    const rows = ['farm','quarry'].includes(b.type)?new THREE.InstancedMesh(new THREE.BoxGeometry(.06, .08, .70), new THREE.MeshLambertMaterial({ color: b.type === 'quarry' ? 0xb0b8ba : b.crop === 'girassol' ? 0xffce30 : 0x9bbd50 }), b.units.length * 3):null;
    if(rows)group.add(rows);group.userData.rows=rows;
    if(['market','greengrocer'].includes(b.type)){const fixtures=marketFixtures(THREE,b);group.add(fixtures);group.userData.retailFixtures=fixtures;}
    if(b.type==='bike_rack'){
      const metal=new THREE.MeshLambertMaterial({color:0x89999e});
      for(let z=.5;z<b.depth;z++)for(let x=.5;x<b.width;x++){
        const h=surfaceElevation(world,entity.x+x,entity.y+z);
        for(const dx of [-.18,.18]){const rail=new THREE.Mesh(new THREE.BoxGeometry(.04,.65,.04),metal);rail.position.set(x+dx,h+.325,z);group.add(rail);}
        const top=new THREE.Mesh(new THREE.BoxGeometry(.4,.04,.04),metal);top.position.set(x,h+.65,z);group.add(top);
      }
      const sign=new THREE.Mesh(new THREE.BoxGeometry(.6,.35,.06),new THREE.MeshLambertMaterial({color:0x326c94}));sign.position.set(.25,surfaceElevation(world,entity.x,entity.y)+1,.1);group.add(sign);
    }
    if(b.type==='park'){
      for(const [x,z]of [[.7,.7],[b.width-.7,b.depth-.7]]){
        const ground=surfaceElevation(world,entity.x+x,entity.y+z),wood=new THREE.MeshLambertMaterial({color:0x79553d});
        const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,.8,5),wood);trunk.position.set(x,ground+.4,z);group.add(trunk);
        const crown=new THREE.Mesh(new THREE.SphereGeometry(.5,6,5),new THREE.MeshLambertMaterial({color:0x4f944e}));crown.position.set(x,ground+1,z);group.add(crown);
        const bench=new THREE.Mesh(new THREE.BoxGeometry(.7,.15,.3),wood);bench.position.set(x,ground+.25,Math.min(b.depth-.2,z+.6));group.add(bench);
      }
    }
    group.userData.sheds = [];
    if (['quarry', 'farm'].includes(b.type)) {
      const addShed = (unit, kind) => {
        if (!unit) return;
        const shed = new THREE.Group();shed.rotation.y=(b.rotation||0)*Math.PI/2;
        const walls = new THREE.Mesh(new THREE.BoxGeometry(.86, CITY_FLOOR_HEIGHT-.12, .86), buildingMaterial(renderer,THREE,kind==='bathroom'?'wall':'wood',b.wallColors?.[unit.id]||b.wallColor||(kind==='bathroom'?0xd8d5c8:0xa8794d)));
        walls.position.set(0, CITY_FLOOR_HEIGHT/2, 0); shed.add(walls);
        const door = new THREE.Mesh(new THREE.BoxGeometry(.42, 1.4, .04), new THREE.MeshLambertMaterial({ color: kind === 'bathroom' ? 0x346c8b : 0x533624 }));
        door.position.set(0, .72, .45); shed.add(door);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(.22, .13, .05), new THREE.MeshLambertMaterial({ color: kind === 'bathroom' ? 0xffffff : 0xe4c775 }));
        sign.position.set(0, 1.52, .46); shed.add(sign);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(.67, .28, 4), new THREE.MeshLambertMaterial({ color: kind === 'bathroom' ? 0x677d86 : 0x796447 }));
        roof.position.set(0, CITY_FLOOR_HEIGHT+.14, 0); roof.rotation.y = Math.PI / 4; shed.add(roof); group.add(shed);
        group.userData.sheds.push({ unit, mesh: shed });
      };
      addShed(b.units.find(u => u.roomType === 'bathroom'), 'bathroom');
      addShed(b.units.find(u => u.roomType === 'dining'), 'dining');
    }
    const highlight = new THREE.Mesh(new THREE.BoxGeometry(1.02, .10, 1.02), new THREE.MeshBasicMaterial({ color: 0xf8b800, wireframe: true }));
    highlight.visible = false; group.add(highlight); group.userData.highlight = highlight;
    renderer.decorateCityMaterials?.(group);
    renderer.cityMeshes.set(entity.id, group); renderer.scene.add(group);
  }
  group.visible=true;
  if (group.userData.terrainRevision !== (world.revision || 0)) {
    b.terrain = buildingGround(world, entity.x, entity.y, b.width, b.depth,b.door);
    const matrix = new THREE.Matrix4();
    b.units.forEach((u, i) => {
      const ground = surfaceElevation(world, entity.x + u.x + .5, entity.y + u.y + .5);
      matrix.makeTranslation(u.x + .5, ground + .035, u.y + .5); group.userData.patches.setMatrixAt(i, matrix);
      if(group.userData.rows)for (let r = 0; r < 3; r++) { matrix.makeTranslation(u.x + .2 + r * .3, ground + .08, u.y + .5); group.userData.rows.setMatrixAt(i * 3 + r, matrix); }
    });
    for (const { unit, mesh } of group.userData.sheds || []) mesh.position.set(unit.x + .5, surfaceElevation(world, entity.x + unit.x + .5, entity.y + unit.y + .5) + .06, unit.y + .5);
    group.userData.patches.instanceMatrix.needsUpdate = true;if(group.userData.rows)group.userData.rows.instanceMatrix.needsUpdate=true;
    if(group.userData.retailFixtures)positionMarketFixtures(THREE,group.userData.retailFixtures,b,u=>surfaceElevation(world,entity.x+u.x+.5,entity.y+u.y+.5)+.06);
    group.userData.terrainRevision = world.revision || 0;
  }
  group.position.set(entity.x, 0, entity.y);
  const unit = renderer.selectedEntityId === entity.id ? b.units.find(u => u.id === renderer.selectedCityUnitId) : null;
  group.userData.highlight.visible = renderer.selectedEntityId === entity.id && !!unit;
  if (unit) group.userData.highlight.position.set(unit.x + .5, surfaceElevation(world, entity.x + unit.x + .5, entity.y + unit.y + .5) + .08, unit.y + .5);
  group.userData.patches.material.emissive.setHex(renderer.selectedEntityId === entity.id ? 0x26351a : 0);
}

function syncTownhallFlag(group,THREE,b){
  const flag=b.governingFlag,key=flag?JSON.stringify(flag)+':'+(b.rotation||0)+':'+b.floors:null;
  if(group.userData.governingFlagKey===key)return;
  const old=group.userData.governingFlagMesh;
  if(old){group.remove(old);old.traverse(o=>{o.geometry?.dispose();o.material?.dispose();o.userData.partyFlagTexture?.dispose();});}
  group.userData.governingFlagKey=key;group.userData.governingFlagMesh=null;
  if(!flag)return;
  const mast=new THREE.Group(),roof=b.floors*CITY_FLOOR_HEIGHT+.18;
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,2.5,6),new THREE.MeshLambertMaterial({color:0xc8c6b4}));
  pole.position.set(b.width*.5,roof+1.25,b.depth*.5);mast.add(pole);
  let texture;
  const canvas=partyFlagCanvas(flag,()=>{if(texture)texture.needsUpdate=true;});
  texture=new THREE.CanvasTexture(canvas);texture.magFilter=THREE.NearestFilter;texture.colorSpace=THREE.SRGBColorSpace;
  const banner=new THREE.Mesh(new THREE.PlaneGeometry(1.65,1.04),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
  banner.userData.partyFlagTexture=texture;banner.rotation.y=(b.rotation||0)*Math.PI/2;banner.position.set(b.width*.5+.85*Math.cos(banner.rotation.y),roof+1.9,b.depth*.5-.85*Math.sin(banner.rotation.y));mast.add(banner);
  group.add(mast);group.userData.governingFlagMesh=mast;
}
