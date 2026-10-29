import {addBuildingDetails} from './city_building_details.js?v=merged-architecture-1';
import {syncConstructionSites} from './city_construction_renderer.js';
import {syncCityMobility} from './city_mobility_renderer.js';
import {syncCampaignDecorations} from './city_campaign_renderer.js';
import {clothFlagGeometry,animateClothFlag,flagWindTime} from './city_flag_animation.js?v=flag-wind-tick-13';
import {marketFixtures,positionMarketFixtures} from './city_market_model.js';
import {modelSize,buildingPoint,CITY_FLOOR_HEIGHT} from './city_building_geometry.js';
import { partyFlagCanvas } from './city_party_flags.js';
import { HOUSE_STYLES } from './city_culture.js';
import { INDUSTRIES } from './city_industries.js';
import { buildingGround, surfaceElevation, flagNightFactor } from './city_terrain.js?v=business-heights-1';
import {addArchitectureVariations} from './city_architecture_variations.js?v=merged-architecture-1';
import {syncSkybridges} from './city_skybridges.js?v=rooftop-bridges-1';
import {buildingLeisureSpaces} from './city_balconies.js?v=rooftop-bridges-1';
import {mergeStaticMeshes} from './city_static_mesh.js';
function buildingMaterial(renderer,THREE,kind,color){
  return renderer.createCityBuildingMaterial?.(kind,color)||new THREE.MeshLambertMaterial({color});
}
function roomCellGeometry(THREE,facadeMask,openingMask,doorMask=0){
  const g=new THREE.BufferGeometry(),v=[],colors=[],h=CITY_FLOOR_HEIGHT,half=.5,wy=.95,wh=.215,ww=.215;
  const exterior=[1,1,1],interior=[.72,.65,.53];
  const quad=(a,b,c,d,color)=>{for(const point of [a,b,c,a,c,d]){v.push(...point);colors.push(...color);}};
  const wall=(axis,sign,bit)=>{
    const hasWindow=!!(openingMask&bit),hasDoor=!!(doorMask&bit),wallColor=facadeMask&bit?exterior:interior;
    // Exterior faces reach the edge of their tile. Interior partitions stay
    // slightly inset so neighboring rooms do not draw coplanar wall faces.
    const at=sign*(facadeMask&bit?half:half-.015),innerAt=at-sign*.03,lo=wy-wh,hi=wy+wh;
    const face=(plane,color)=>{
      const rect=(a0,a1,y0,y1)=>{if(a1<=a0||y1<=y0)return;if(axis==='z')quad([a0,y0,plane],[a1,y0,plane],[a1,y1,plane],[a0,y1,plane],color);else quad([plane,y0,a0],[plane,y0,a1],[plane,y1,a1],[plane,y1,a0],color);};
      if(hasDoor){rect(-half,-.22,0,1.45);rect(.22,half,0,1.45);rect(-half,half,1.45,h);return;}
      if(!hasWindow){rect(-half,half,0,h);return;}
      rect(-half,half,0,lo);rect(-half,half,hi,h);
      rect(-half,-ww,lo,hi);rect(ww,half,lo,hi);
    };
    face(at,wallColor);
    face(innerAt,interior);
  };
  for(const [bit,axis,sign] of [[1,'z',-1],[2,'z',1],[4,'x',-1],[8,'x',1]])wall(axis,sign,bit);
  g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  // The wall vertices are described from floor level (0..h), while each
  // instance is placed at the floor center. Center the geometry before
  // instancing so every floor occupies exactly one CITY_FLOOR_HEIGHT.
  g.translate(0,-h/2,0);g.computeVertexNormals();return g;
}
// Room coordinates count floors; render their physical height consistently with picking.

export function syncCityBuildings(renderer, THREE, entities, world) {
  const oilCarriers=renderer.cityOilCarriers??=new Set();oilCarriers.clear();
  for(const shipment of renderer.cityLogistics?.shipments||[])if(shipment.good==='oleo'&&shipment.pickedUp&&shipment.driverId!=null)oilCarriers.add(shipment.driverId);
  syncConstructionSites(renderer,THREE,world,renderer.cityDevelopment);
  syncCampaignDecorations(renderer,THREE,entities,world);
  syncCityMobility(renderer,THREE,entities,world);
  syncSkybridges(renderer,THREE,entities,world);
  const map = world.map;
  const inView=(x,y,width=0,depth=0)=>!Number.isFinite(renderer.renderedMinTx) ||
    x>=renderer.renderedMinTx && x+width<=renderer.renderedMaxTx+1 && y>=renderer.renderedMinTy && y+depth<=renderer.renderedMaxTy+1;
  renderer.lampMeshes ??= new Map();
  const cityNightLights=renderer.cityNightLights??=[];cityNightLights.length=0;
  const liveBuildings = new Set(entities.filter(e => e.properties?.cityBuilding && !e.destroyed).map(e => e.id));
  const liveLamps = new Set();
  for (const post of world.cityLampPosts || []) {
    if (!post.built) continue;
    liveLamps.add(post.id);
    if(!inView(post.x,post.y)){const existing=renderer.lampMeshes.get(post.id);if(existing)existing.visible=false;}
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
    lamp.visible = inView(post.x,post.y) && (!post.buildingId || liveBuildings.has(post.buildingId));
    if(post.lit&&lamp.visible)cityNightLights.push({x:lamp.position.x,y:lamp.position.y+2.1,z:lamp.position.z,color:0xffbc63,distance:6,decay:2,intensity:2.6,priority:-2,distSq:(post.x-(renderer.camX||0))**2+(post.y-(renderer.camY||0))**2});
  }
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
    if (!b || entity.destroyed || b.officeTenantOf) continue;
    active.add(entity.id);
    if(!inView(entity.x,entity.y,b.width,b.depth)){const existing=renderer.cityMeshes.get(entity.id);if(existing)existing.visible=false;continue;}
    if (b.constructionKind === 'open-air') { syncOpenAir(renderer, THREE, entity, b, world); continue; }
    let group = renderer.cityMeshes.get(entity.id);
    const bridgeDoors=renderer.skybridgeDoors?.get(b.id),bridgeDoorKey=bridgeDoors?[...bridgeDoors].map(([id,mask])=>`${id}:${mask}`).join('|'):'';
    if (group && (group.userData.bridgeDoorKey!==bridgeDoorKey || group.userData.floorCount !== b.floors || group.userData.layoutRevision !== (b.layoutRevision||0) || group.userData.rotation !== (b.rotation||0)||group.userData.paintRevision!==(b.paintRevision||0)||group.userData.campaignPaintId!==(b.campaignPaint?.id??null))) {
      renderer.scene.remove(group); group.traverse(object => { object.geometry?.dispose(); object.material?.dispose();object.userData.partyFlagTexture?.dispose(); }); renderer.cityMeshes.delete(entity.id); group = null;
    }
    if (!group) {
      group = new THREE.Group(); group.userData.bridgeDoorKey=bridgeDoorKey;group.userData.floorCount = b.floors;group.userData.paintRevision=b.paintRevision||0;group.userData.layoutRevision=b.layoutRevision||0;group.userData.rotation=b.rotation||0;group.userData.campaignPaintId=b.campaignPaint?.id??null;
      const material = buildingMaterial(renderer,THREE,b.architecture==='timber'?'wood':'wall',0xffffff);material.side=THREE.DoubleSide;material.vertexColors=true;material.needsUpdate=true;
      const style = HOUSE_STYLES[b.architecture] || HOUSE_STYLES.modern;
      const residential = ['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing'].includes(b.type),mine=['iron_mine','bauxite_mine','clay_pit','sand_pit'].includes(b.type);
      const mineWall={iron_mine:0x77736b,bauxite_mine:0x806b62,clay_pit:0x886b58,sand_pit:0x94866a};
      const matrix = new THREE.Matrix4(), color = new THREE.Color(b.campaignPaint?.color||b.wallColor||(mine?mineWall[b.type]:residential ? style.wall : b.color));
      const cellMasks=new Map(),doorByUnit=new Map(bridgeDoors||[]),occupiedCells=new Set(b.units.map(u=>`${u.x},${u.y},${u.z}`));for(const cell of b.circulation||[])occupiedCells.add(`${cell.x},${cell.y},${cell.z}`);
      for(const u of b.units)for(const [dx,dy,bit]of [[0,-1,1],[0,1,2],[-1,0,4],[1,0,8]])if(occupiedCells.has(`${u.x+dx},${u.y+dy},${u.z}`))doorByUnit.set(u.id,(doorByUnit.get(u.id)||0)|bit);
      for(const s of buildingLeisureSpaces(b))if(s.kind==='balcony')doorByUnit.set(s.unitId,(doorByUnit.get(s.unitId)||0)|s.doorBit);
      for (const u of b.units) {
        let facadeMask=0;if(u.y===0)facadeMask|=1;if(u.y===b.depth-1)facadeMask|=2;if(u.x===0)facadeMask|=4;if(u.x===b.width-1)facadeMask|=8;
        const doorMask=doorByUnit.get(u.id)||0,openingMask=u.hasWindow?facadeMask&~doorMask:0,key=`${facadeMask}:${openingMask}:${doorMask}`,bucket=cellMasks.get(key)||[];bucket.push(u);cellMasks.set(key,bucket);
      }
      const cellMeshes=[];
      for(const units of cellMasks.values()){
        const first=units[0],facadeMask=(first.y===0?1:0)|(first.y===b.depth-1?2:0)|(first.x===0?4:0)|(first.x===b.width-1?8:0),doorMask=doorByUnit.get(first.id)||0,openingMask=first.hasWindow?facadeMask&~doorMask:0;
        const cells=new THREE.InstancedMesh(roomCellGeometry(THREE,facadeMask,openingMask,doorMask),material,units.length);cells.castShadow=true;cells.receiveShadow=true;
        const floorIndices=[],baseMatrices=[];
        for(let i=0;i<units.length;i++){const u=units[i];matrix.makeTranslation(u.x+.5,u.z*CITY_FLOOR_HEIGHT+CITY_FLOOR_HEIGHT/2,u.y+.5);cells.setMatrixAt(i,matrix);floorIndices.push(u.z);baseMatrices.push(matrix.clone());cells.setColorAt(i,b.wallColors?.[u.id]&&!b.campaignPaint?new THREE.Color(b.wallColors[u.id]):color);}
        cells.userData.interiorFloors=floorIndices;cells.userData.interiorBaseMatrices=baseMatrices;
        group.add(cells);cellMeshes.push(cells);
      }
      const cells=cellMeshes[0];group.userData.cellMeshes=cellMeshes;
      const floorGeometry=new THREE.BoxGeometry(1,.06,1),floorMaterial=new THREE.MeshLambertMaterial({color:0x928571}),floors=new THREE.InstancedMesh(floorGeometry,floorMaterial,b.units.length),ceilings=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.06,1),floorMaterial,b.units.length),floorLevels=[],floorMatrices=[];
      for(let i=0;i<b.units.length;i++){const u=b.units[i];matrix.makeTranslation(u.x+.5,u.z*CITY_FLOOR_HEIGHT-.03,u.y+.5);floors.setMatrixAt(i,matrix);floorMatrices.push(matrix.clone());floorLevels.push(u.z);matrix.makeTranslation(u.x+.5,(u.z+1)*CITY_FLOOR_HEIGHT-.03,u.y+.5);ceilings.setMatrixAt(i,matrix);}
      floors.receiveShadow=true;ceilings.receiveShadow=true;group.add(floors,ceilings);floors.userData.interiorFloors=floorLevels;floors.userData.interiorBaseMatrices=floorMatrices;group.userData.interiorFloors=floors;group.userData.interiorCeilings=ceilings;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(b.width + .15, .14, b.depth + .15), buildingMaterial(renderer,THREE,'roof',mine?0x454b49:style.roof));
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
      if(mine){
        const timber=new THREE.MeshLambertMaterial({color:b.type==='iron_mine'?0x72563d:0x8b6348}),shadow=new THREE.MeshLambertMaterial({color:0x171d1c}),rail=new THREE.MeshLambertMaterial({color:0x555e60});
        const portal=new THREE.Mesh(new THREE.BoxGeometry(1.35,1.35,.12),shadow);portal.position.set(b.width/2,.68,b.depth+.12);facade.add(portal);
        for(const x of [b.width/2-.72,b.width/2+.72]){const post=new THREE.Mesh(new THREE.BoxGeometry(.12,1.55,.14),timber);post.position.set(x,.78,b.depth+.18);facade.add(post);}
        const lintel=new THREE.Mesh(new THREE.BoxGeometry(1.56,.14,.15),timber);lintel.position.set(b.width/2,1.55,b.depth+.18);facade.add(lintel);
        for(const x of [b.width/2-.5,b.width/2+.5]){const bar=new THREE.Mesh(new THREE.BoxGeometry(.055,.08,.85),rail);bar.position.set(x,.08,b.depth+.62);facade.add(bar);}
        const crossbar=new THREE.Mesh(new THREE.BoxGeometry(1.05,.07,.08),rail);crossbar.position.set(b.width/2,.08,b.depth+.62);facade.add(crossbar);
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
      addArchitectureVariations(THREE,facade,b,buildingLeisureSpaces(entity.properties.cityBuilding));
      const door = new THREE.Mesh(new THREE.BoxGeometry(.55, 1.4, .04), new THREE.MeshLambertMaterial({ color: 0x293e35 }));
      door.position.set(Math.floor(b.width / 2) + .5, .70, b.depth + .025); facade.add(door);
      const awning = new THREE.Mesh(new THREE.BoxGeometry(1.1, .12, .7), new THREE.MeshLambertMaterial({ color: b.type === 'market' ? 0xdca14b : 0xc9d9a1 }));
      const awningColors = { super_popular_housing:0x987f68,popular_luxury_housing:0xb69868,popular_refectory: 0xd88a45, market: 0xdca14b, bakery: 0xc78b52, greengrocer: 0x75a956, clinic: 0xf0eee4, townhall: 0x7693ae, builder: 0xb87c3f, quarry: 0x777f83, luxury_housing: 0xc7a956, popular_housing: 0xa8734d };
      awning.material.color.setHex(awningColors[b.type] ?? 0xc9d9a1);
      if(!mine){awning.position.set(door.position.x, 1.55, b.depth + .25); awning.castShadow = true; facade.add(awning);}
      }
      const highlight = new THREE.Mesh(new THREE.BoxGeometry(1.02, CITY_FLOOR_HEIGHT+.02, 1.02), new THREE.MeshBasicMaterial({ color: 0xf0e6a1, wireframe: true }));
      highlight.visible = false; group.add(highlight); group.userData.highlight = highlight;
      const supports = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, 1, .2), new THREE.MeshLambertMaterial({ color: 0x68756a }), b.width * b.depth);
      supports.castShadow = true; supports.receiveShadow = true; group.add(supports); group.userData.supports = supports;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(b.width, .12, b.depth), new THREE.MeshLambertMaterial({ color: 0x7e8776 }));
      slab.position.set(b.width / 2, -.06, b.depth / 2); slab.receiveShadow = true; group.add(slab);
      const roomProps = new THREE.Group(),propsByFloor=new Map(),addRoomProp=(u,object)=>{let floor=propsByFloor.get(u.z);if(!floor){floor=new THREE.Group();floor.userData.interiorFloor=u.z;propsByFloor.set(u.z,floor);}floor.add(object);};
      for (const u of b.units) {
        if(u.roomType==='office'||u.roomType==='plenary'){const desk=new THREE.Mesh(new THREE.BoxGeometry(.55,.12,.32),new THREE.MeshLambertMaterial({color:u.roomType==='plenary'?0x5f4930:0x947a4e}));desk.position.set(u.x+.5,u.z*CITY_FLOOR_HEIGHT+.42,u.y+.4);addRoomProp(u,desk);const seat=new THREE.Mesh(new THREE.BoxGeometry(.26,.28,.26),new THREE.MeshLambertMaterial({color:0x496759}));seat.position.set(u.x+.5,u.z*CITY_FLOOR_HEIGHT+.2,u.y+.75);addRoomProp(u,seat);}
        if(u.roomType==='workspace'){const bench=new THREE.Mesh(new THREE.BoxGeometry(.58,.14,.36),new THREE.MeshLambertMaterial({color:0x947a4e}));bench.position.set(u.x+.5,u.z*CITY_FLOOR_HEIGHT+.42,u.y+.72);addRoomProp(u,bench);const seat=new THREE.Mesh(new THREE.BoxGeometry(.25,.28,.25),new THREE.MeshLambertMaterial({color:0x596b62}));seat.position.set(u.x+.5,u.z*CITY_FLOOR_HEIGHT+.2,u.y+.30);addRoomProp(u,seat);}
        if(u.roomType==='service'){const counter=new THREE.Mesh(new THREE.BoxGeometry(.72,.62,.24),new THREE.MeshLambertMaterial({color:0x806246}));counter.position.set(u.x+.5,u.z*CITY_FLOOR_HEIGHT+.31,u.y+.72);addRoomProp(u,counter);}
        if(u.roomType==='treatment'){const bed=new THREE.Mesh(new THREE.BoxGeometry(.64,.18,.34),new THREE.MeshLambertMaterial({color:0xd7d1c4}));bed.position.set(u.x+.5,u.z*CITY_FLOOR_HEIGHT+.30,u.y+.5);addRoomProp(u,bed);}
        if(u.roomType==='bedroom'){
          const wood=new THREE.MeshLambertMaterial({color:0x76533b}),linen=new THREE.MeshLambertMaterial({color:0xc9c0aa}),pillow=new THREE.MeshLambertMaterial({color:0xe6dfcf});
          const frame=new THREE.Mesh(new THREE.BoxGeometry(.72,.13,.46),wood);frame.position.set(u.x+.5,u.z*CITY_FLOOR_HEIGHT+.20,u.y+.5);addRoomProp(u,frame);
          const mattress=new THREE.Mesh(new THREE.BoxGeometry(.68,.13,.42),linen);mattress.position.set(u.x+.5,u.z*CITY_FLOOR_HEIGHT+.32,u.y+.5);addRoomProp(u,mattress);
          const cushion=new THREE.Mesh(new THREE.BoxGeometry(.23,.07,.34),pillow);cushion.position.set(u.x+.5,u.z*CITY_FLOOR_HEIGHT+.42,u.y+.32);addRoomProp(u,cushion);
          const headboard=new THREE.Mesh(new THREE.BoxGeometry(.75,.38,.07),wood);headboard.position.set(u.x+.5,u.z*CITY_FLOOR_HEIGHT+.35,u.y+.75);addRoomProp(u,headboard);
        }
        if (u.roomType === 'bathroom') {
          const toilet = new THREE.Mesh(new THREE.BoxGeometry(.30, .38, .34), new THREE.MeshLambertMaterial({ color: 0xf1eee3 }));
          toilet.position.set(u.x + .5, u.z*CITY_FLOOR_HEIGHT + .20, u.y + .5); addRoomProp(u,toilet);
          const tank = new THREE.Mesh(new THREE.BoxGeometry(.28, .27, .13), new THREE.MeshLambertMaterial({ color: 0xf1eee3 }));
          tank.position.set(u.x + .5, u.z*CITY_FLOOR_HEIGHT + .50, u.y + .35); addRoomProp(u,tank);
          const sink=new THREE.Mesh(new THREE.BoxGeometry(.34,.12,.26),new THREE.MeshLambertMaterial({color:0xf1eee3}));sink.position.set(u.x+.5,u.z*CITY_FLOOR_HEIGHT+.52,u.y+.78);addRoomProp(u,sink);
        } else if (u.roomType === 'dining') {
          const table = new THREE.Mesh(new THREE.BoxGeometry(.68, .12, .48), new THREE.MeshLambertMaterial({ color: 0x805638 }));
          table.position.set(u.x + .5, u.z*CITY_FLOOR_HEIGHT + .50, u.y + .5); addRoomProp(u,table);
          for (const dx of [-.23, .23]) for (const dz of [-.15, .15]) {
            const seat = new THREE.Mesh(new THREE.BoxGeometry(.16, .20, .16), new THREE.MeshLambertMaterial({ color: 0x6a745d }));
            seat.position.set(u.x + .5 + dx, u.z*CITY_FLOOR_HEIGHT + .27, u.y + .5 + dz); addRoomProp(u,seat);
          }
        } else if (u.roomType === 'laundry') {
          const washer=new THREE.Mesh(new THREE.BoxGeometry(.55,.72,.5),new THREE.MeshLambertMaterial({color:0xd5d8d2}));washer.position.set(u.x+.5,u.z*CITY_FLOOR_HEIGHT+.38,u.y+.5);addRoomProp(u,washer);const drum=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,.035,12),new THREE.MeshLambertMaterial({color:0x526c73}));drum.rotation.x=Math.PI/2;drum.position.set(u.x+.5,u.z*CITY_FLOOR_HEIGHT+.4,u.y+.24);addRoomProp(u,drum);
        }
      }
      for(let z=0;z<Math.max(0,b.floors-1);z++)for(let step=0;step<10;step++){
        const wood=new THREE.Mesh(new THREE.BoxGeometry(.42,.18,.075),new THREE.MeshLambertMaterial({color:0x806448}));
        wood.position.set(Math.floor(b.width/2)+.5,z*CITY_FLOOR_HEIGHT+step*.18+.09,Math.floor(b.depth/2)+.18+step*.075);let floor=propsByFloor.get(z);if(!floor){floor=new THREE.Group();floor.userData.interiorFloor=z;propsByFloor.set(z,floor);}floor.add(wood);
      }
      for(const [floor,objects]of propsByFloor){mergeStaticMeshes(THREE,objects);objects.visible=false;roomProps.add(objects);}
      if (roomProps.children.length) { roomProps.visible = false; group.add(roomProps); group.userData.roomProps = roomProps; }
      const stairs = new THREE.InstancedMesh(new THREE.BoxGeometry(.8, 1, .23), new THREE.MeshLambertMaterial({ color: 0x7e8776 }), 4);
      stairs.receiveShadow = true; group.add(stairs); group.userData.stairs = stairs;
      group.userData.cells = cells;
      renderer.decorateCityMaterials?.(group);
      renderer.scene.add(group);
      renderer.cityMeshes.set(entity.id, group);
    }
    group.visible=true;
    if(['townhall','council_chamber'].includes(b.type))syncTownhallFlag(renderer,group,THREE,b,flagNightFactor(world));
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
    const interior=renderer.cityInteriorView?.buildingId===b.id&&b.constructionKind!=='open-air',interiorFloor=renderer.cityInteriorView?.floor||0;
    if(group.userData.lastInteriorView!==`${interior}:${interiorFloor}`){
      for(const cells of group.userData.cellMeshes||[]){const floors=cells.userData.interiorFloors||[],base=cells.userData.interiorBaseMatrices||[],m=new THREE.Matrix4();for(let i=0;i<floors.length;i++){m.copy(base[i]);if(interior&&floors[i]!==interiorFloor)m.scale(new THREE.Vector3(1,0,1));cells.setMatrixAt(i,m);}cells.instanceMatrix.needsUpdate=true;}
      const floorMesh=group.userData.interiorFloors;if(floorMesh){const levels=floorMesh.userData.interiorFloors,base=floorMesh.userData.interiorBaseMatrices,m=new THREE.Matrix4();for(let i=0;i<levels.length;i++){m.copy(base[i]);if(interior&&levels[i]!==interiorFloor)m.scale(new THREE.Vector3(1,0,1));floorMesh.setMatrixAt(i,m);}floorMesh.instanceMatrix.needsUpdate=true;}
      if(group.userData.interiorCeilings)group.userData.interiorCeilings.visible=!interior;
      if(group.userData.roomProps){group.userData.roomProps.visible=interior;for(const prop of group.userData.roomProps.children)prop.visible=interior&&prop.userData.interiorFloor===interiorFloor;}
      if(group.userData.roof)group.userData.roof.visible=!interior;
      if(group.userData.facade)group.userData.facade.visible=!interior;
      group.userData.lastInteriorView=`${interior}:${interiorFloor}`;
    }
    for(const cells of group.userData.cellMeshes||[group.userData.cells]){const material=cells.material;material.emissive.setHex(renderer.selectedEntityId===entity.id?0x26351a:0x000000);}
    const unit = renderer.selectedEntityId === entity.id ? b.units.find(u => u.id === renderer.selectedCityUnitId) : null;
    group.userData.highlight.visible = renderer.selectedEntityId === entity.id && !!unit;
    if (unit) group.userData.highlight.position.set(unit.x + .5, unit.z*CITY_FLOOR_HEIGHT + CITY_FLOOR_HEIGHT/2, unit.y + .5);
  }
  for (const [id, group] of renderer.cityMeshes) if (!active.has(id)) {
    renderer.scene.remove(group);
    group.traverse(object => { object.geometry?.dispose(); object.material?.dispose();object.userData.partyFlagTexture?.dispose(); });
    renderer.cityMeshes.delete(id);
  }
}

const CROP_VISUALS={
  girassol:{height:1.05,grow:180,foliage:0x4b8736,head:0xffd34f,leaf:'broad',produce:'flower'},
  trigo:{height:.82,grow:120,foliage:0x71963d,head:0xd7bb70,leaf:'blade',produce:'grain'},
  arroz:{height:.7,grow:150,foliage:0x6f9d45,head:0xc9b977,leaf:'blade',produce:'grain'},
  milho:{height:1,grow:100,foliage:0x528c3a,head:0xe5c742,leaf:'corn',produce:'ear'},
  feijao:{height:.48,grow:150,foliage:0x529447,head:0x78ac52,leaf:'bush',produce:'pod'},
  alface:{height:.34,grow:75,foliage:0x6fae4b,head:0x95c866,leaf:'rosette',produce:'head'},
  tomate:{height:.52,grow:100,foliage:0x4b813d,head:0xc94335,leaf:'bush',produce:'fruit'},
  mandioca:{height:.68,grow:200,foliage:0x4d8241,head:0xb18d58,leaf:'broad',produce:'root'},
  cebola:{height:.42,grow:140,foliage:0x649346,head:0xd3c27a,leaf:'blade',produce:'bulb'},
  coentro:{height:.38,grow:80,foliage:0x63a74f,head:0x8cba62,leaf:'fine',produce:'none'},
  maca:{height:.72,grow:180,foliage:0x437e39,head:0xc9573f,leaf:'bush',produce:'fruit'},
  goiaba:{height:.72,grow:160,foliage:0x49813d,head:0xc8764d,leaf:'bush',produce:'fruit'},
  default:{height:.5,grow:120,foliage:0x669b48,head:0x8bb75e,leaf:'bush',produce:'fruit'},
};
function createFarmPlants(THREE,b){
  const visual=CROP_VISUALS[b.crop]||CROP_VISUALS.default,capacity=b.units.length*(visual.height>.7?2:3),group=new THREE.Group();
  const stem=new THREE.InstancedMesh(new THREE.CylinderGeometry(.018,.032,1,5),new THREE.MeshLambertMaterial({color:0x63883b}),capacity);
  const leafGeometry=visual.leaf==='blade'?new THREE.ConeGeometry(.07,.34,4):visual.leaf==='corn'?new THREE.ConeGeometry(.1,.55,4):visual.leaf==='fine'?new THREE.ConeGeometry(.045,.24,5):new THREE.SphereGeometry(1,6,4);
  const foliage=new THREE.InstancedMesh(leafGeometry,new THREE.MeshLambertMaterial({color:visual.foliage}),capacity);
  const productGeometry=visual.produce==='grain'?new THREE.ConeGeometry(.5,1,5):visual.produce==='ear'?new THREE.CylinderGeometry(.42,.5,1,6):visual.produce==='flower'?new THREE.CylinderGeometry(.5,.5,.14,10):new THREE.SphereGeometry(1,6,4);
  const product=new THREE.InstancedMesh(productGeometry,new THREE.MeshLambertMaterial({color:visual.head}),capacity);for(const mesh of [stem,foliage,product]){mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.count=0;group.add(mesh);}
  return {group,stem,foliage,product,capacity,visual};
}
function syncFarmPlants(renderer,THREE,b,world,plantSet,minute){
  const cells=b.units.filter(u=>!['bathroom','dining'].includes(u.roomType)),growthByCell=new Float32Array(cells.length);let offset=0;
  for(const field of b.fields||[]){const count=Math.min(field.area||12,cells.length-offset),age=field.plantedAt==null?0:Math.max(0,minute-field.plantedAt),growth=field.plantedAt==null?0:Math.min(1,age/Math.max(1,plantSet.visual.grow));for(let i=0;i<count;i++)growthByCell[offset+i]=growth;offset+=count;if(offset>=cells.length)break;}
  const m=renderer._farmPlantMatrix??=new THREE.Matrix4(),pos=renderer._farmPlantPosition??=new THREE.Vector3(),quat=renderer._farmPlantQuaternion??=new THREE.Quaternion(),scale=renderer._farmPlantScale??=new THREE.Vector3(),axis=renderer._farmPlantAxis??=new THREE.Vector3(0,1,0),plantsPerCell=plantSet.visual.height>.7?2:3;
  let n=0,produceCount=0;
  for(let i=0;i<cells.length;i++){const growth=growthByCell[i];if(!growth)continue;const u=cells[i],height=plantSet.visual.height*(.12+.88*growth),ground=surfaceElevation(world,b.entity.x+u.x+.5,b.entity.y+u.y+.5);
    for(let j=0;j<plantsPerCell;j++){const x=u.x+.5+(j-(plantsPerCell-1)/2)*.22,z=u.y+.5+((j%2)?-.13:.13),lean=(j-1)*.08,stemH=height*(.78+(j%2)*.18);pos.set(x,ground+.05+stemH/2,z);quat.setFromAxisAngle(axis,lean);scale.set(1,stemH,1);m.compose(pos,quat,scale);plantSet.stem.setMatrixAt(n,m);
      const leafH=ground+.05+height*(plantSet.visual.leaf==='bush'||plantSet.visual.leaf==='rosette'?.58:.62);pos.set(x,leafH,z);quat.setFromAxisAngle(axis,lean*.6);scale.set(.09*growth,height*(plantSet.visual.leaf==='bush'||plantSet.visual.leaf==='rosette'?.48:.52),.09*growth);m.compose(pos,quat,scale);plantSet.foliage.setMatrixAt(n,m);
      if(plantSet.visual.produce!=='none'&&growth>.48){const productH=ground+.05+height*.88;pos.set(x,productH,z);quat.setFromAxisAngle(axis,0);const kind=plantSet.visual.produce,size=kind==='flower'?.14:kind==='grain'?.065:kind==='ear'?.07:.07;scale.set(size,kind==='flower'?.8:kind==='grain'?.22:kind==='ear'?.2:size*1.15,size);m.compose(pos,quat,scale);plantSet.product.setMatrixAt(produceCount++,m);}
      n++;
    }
  }
  plantSet.stem.count=plantSet.foliage.count=n;plantSet.product.count=produceCount;
  for(const mesh of [plantSet.stem,plantSet.foliage,plantSet.product])mesh.instanceMatrix.needsUpdate=true;
}

// Open-air premises follow every patch of the natural surface; no slab, walls or roof.
function syncOpenAir(renderer, THREE, entity, b, world) {
  let group = renderer.cityMeshes.get(entity.id);
  const signature=`retail-v2:${b.type}:${b.width}:${b.depth}:${b.crop}:${b.layoutRevision||0}:${b.units.length}:${b.rotation||0}:${b.paintRevision||0}`;
  if (group && group.userData.signature !== signature) { renderer.scene.remove(group); group.traverse(o => { o.geometry?.dispose(); o.material?.dispose();o.userData.partyFlagTexture?.dispose(); }); renderer.cityMeshes.delete(entity.id); group = null; }
  if (!group) {
    group = new THREE.Group(); group.userData.signature = signature;
    addBuildingDetails(THREE,group,b,{outdoor:true,ground:surfaceElevation(world,entity.x+b.width/2,entity.y+b.depth/2)});
    const patches = new THREE.InstancedMesh(new THREE.BoxGeometry(.94, .045, .94), new THREE.MeshLambertMaterial({ color: b.type === 'quarry' ? 0x94988d : b.type==='farm'?0x795c3d:['market','greengrocer'].includes(b.type)?0xb5a68d:0x6e7940 }), b.units.length);
    patches.receiveShadow = true; group.add(patches); group.userData.patches = patches;
    const rows = b.type==='quarry'?new THREE.InstancedMesh(new THREE.BoxGeometry(.06, .08, .70), new THREE.MeshLambertMaterial({ color:0xb0b8ba }), b.units.length * 3):null;
    if(rows)group.add(rows);group.userData.rows=rows;
    if(b.type==='farm'){const cropPlants=createFarmPlants(THREE,b);group.add(cropPlants.group);group.userData.cropPlants=cropPlants;}
    if(['market','greengrocer'].includes(b.type)){const fixtures=marketFixtures(THREE,b);group.add(fixtures);group.userData.retailFixtures=fixtures;}
    if(b.type==='bike_rack'){
      const metal=new THREE.MeshLambertMaterial({color:0x89999e});
      for(let z=.5;z<b.depth;z++)for(let x=.5;x<b.width;x++){
        const h=surfaceElevation(world,entity.x+x,entity.y+z);
        for(const dx of [-.18,.18]){const rail=new THREE.Mesh(new THREE.BoxGeometry(.04,.65,.04),metal);rail.position.set(x+dx,h+.325,z);group.add(rail);}
        const top=new THREE.Mesh(new THREE.BoxGeometry(.4,.04,.04),metal);top.position.set(x,h+.65,z);group.add(top);
      }
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
  if(b.type==='farm'&&group.userData.cropPlants){const minute=world.clock?Math.max(0,world.clock.day-1)*1440+world.clock.hour*60+world.clock.minute:0;if(group.userData.farmVisualMinute!==minute){syncFarmPlants(renderer,THREE,b,world,group.userData.cropPlants,minute);group.userData.farmVisualMinute=minute;}}
  const unit = renderer.selectedEntityId === entity.id ? b.units.find(u => u.id === renderer.selectedCityUnitId) : null;
  group.userData.highlight.visible = renderer.selectedEntityId === entity.id && !!unit;
  if (unit) group.userData.highlight.position.set(unit.x + .5, surfaceElevation(world, entity.x + unit.x + .5, entity.y + unit.y + .5) + .08, unit.y + .5);
  group.userData.patches.material.emissive.setHex(renderer.selectedEntityId === entity.id ? 0x26351a : 0);
}

function syncTownhallFlag(renderer,group,THREE,b,shade=1){
  const flag=b.governingFlag,key=flag?JSON.stringify(flag)+':'+(b.rotation||0)+':'+b.floors:null;
  if(group.userData.governingFlagKey===key){group.userData.governingFlagMaterial?.color.setScalar(shade);animateClothFlag(group.userData.governingFlagCloth,flagWindTime(renderer),group.userData.governingFlagPhase||0);return;}
  const old=group.userData.governingFlagMesh;
  if(old){group.remove(old);old.traverse(o=>{o.geometry?.dispose();o.material?.dispose();o.userData.partyFlagTexture?.dispose();});}
  group.userData.governingFlagKey=key;group.userData.governingFlagMesh=null;group.userData.governingFlagMaterial=null;group.userData.governingFlagCloth=null;
  if(!flag)return;
  const mast=new THREE.Group(),roof=b.floors*CITY_FLOOR_HEIGHT+.18;
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,2.5,6),new THREE.MeshLambertMaterial({color:0xc8c6b4}));
  pole.position.set(b.width*.5,roof+1.25,b.depth*.5);mast.add(pole);
  let texture;
  const canvas=partyFlagCanvas(flag,()=>{if(texture)texture.needsUpdate=true;});
  texture=new THREE.CanvasTexture(canvas);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide,emissive:0x000000});material.color.setScalar(shade);
  const banner=new THREE.Mesh(clothFlagGeometry(THREE,1.65,1.04),material);group.userData.governingFlagCloth=banner;group.userData.governingFlagPhase=(b.id||0)*.73;animateClothFlag(banner,flagWindTime(renderer),group.userData.governingFlagPhase);
  banner.userData.partyFlagTexture=texture;banner.rotation.y=(b.rotation||0)*Math.PI/2;banner.position.set(b.width*.5+.85*Math.cos(banner.rotation.y),roof+1.9,b.depth*.5-.85*Math.sin(banner.rotation.y));mast.add(banner);group.userData.governingFlagMaterial=material;
  group.add(mast);group.userData.governingFlagMesh=mast;
}
