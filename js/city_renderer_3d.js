import {roomFurnitureForCity} from './city_furniture_catalog.js';
import {furnitureModel} from './city_furniture_models.js?v=bench-sidewalk-fix-1';
import {applyInteriorCutaway} from './city_interior_view.js';
import {addBuildingDetails} from './city_building_details.js?v=merged-architecture-1';
import {syncConstructionSites} from './city_construction_renderer.js';
import {syncCityMobility} from './city_mobility_renderer.js';
import {syncCampaignDecorations} from './city_campaign_renderer.js';
import {clothFlagGeometry,animateClothFlag,flagWindTime} from './city_flag_animation.js?v=flag-wind-tick-13';
import {marketFixtures,positionMarketFixtures} from './city_market_model.js';
import {modelSize,buildingPoint,buildingEntranceDoor,CITY_FLOOR_HEIGHT} from './city_building_geometry.js?v=building-doorway-opening-1';
import { partyFlagCanvas } from './city_party_flags.js';
import { HOUSE_STYLES } from './city_culture.js';
import { INDUSTRIES } from './city_industries.js';
import { buildingGround, surfaceElevation, flagNightFactor } from './city_terrain.js?v=deep-perf-3';
import {addArchitectureVariations} from './city_architecture_variations.js?v=balcony-door-alignment-2';
import {syncSkybridges} from './city_skybridges.js?v=short-passarelas-bridge-1';
import {buildingLeisureSpaces} from './city_balconies.js?v=balcony-door-alignment-2';
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
function syncFecesVisuals(renderer,THREE,city,world){
  const sanitation=city?.sanitation;if(!sanitation)return;
  const revision=sanitation.fecesRevision||0;
  if(renderer.fecesVisualRevision!==revision){
    if(renderer.fecesVisuals){renderer.scene.remove(renderer.fecesVisuals);const geometries=new Set(),materials=new Set();renderer.fecesVisuals.traverse(o=>{if(o!==renderer.fecesVisuals){if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
    const group=new THREE.Group(),pileGeometry=new THREE.SphereGeometry(.14,7,5),pileMaterial=new THREE.MeshLambertMaterial({color:0x64452e});
    const add=(x,y,z,amount,area,buildingId=null,floor=null)=>{
      const n=Math.max(1,Math.floor(amount)||1),clumps=Math.min(18,n),growth=Math.min(1,Math.log1p(n)/Math.log(19)),overflow=Math.min(3,Math.log1p(Math.max(0,n-18)/6)*.35);
      const base=new THREE.Mesh(pileGeometry,pileMaterial);base.position.set(x,y,z);base.scale.set(.5+growth*.8,.12+growth*.16+overflow*1.6,.5+growth*.8);base.userData={fecesArea:area,buildingId,floor};base.castShadow=true;group.add(base);
      // Each deposit adds visible volume on the same tile. Clumps spread in
      // compact rings and rise in layers; large accumulations keep growing
      // without spilling across neighboring tiles.
      for(let i=0;i<clumps;i++){
        const ring=i===0?0:Math.ceil((Math.sqrt(i+1)-1)/.72),angle=i*2.399963229728653;
        const radius=Math.min(.27,.055+ring*.055),layer=Math.floor(i/7),mesh=new THREE.Mesh(pileGeometry,pileMaterial);
        mesh.position.set(x+Math.cos(angle)*radius,y+.09+layer*(.065+overflow*.12),z+Math.sin(angle)*radius);
        const size=.58+growth*.18;mesh.scale.set(size,.58+growth*.22,size);mesh.userData={fecesArea:area,buildingId,floor};mesh.castShadow=true;group.add(mesh);
      }
    };
    const minX=renderer.renderedMinTx??-Infinity,maxX=renderer.renderedMaxTx??Infinity,minY=renderer.renderedMinTy??-Infinity,maxY=renderer.renderedMaxTy??Infinity;
    for(const [key,pile]of sanitation.streetFeces){const [x,y]=key.split(',').map(Number);if(x<minX||x>maxX||y<minY||y>maxY)continue;add(x+.5,surfaceElevation(world,x+.5,y+.5)+.04,y+.5,pile.amount,'street');}
    for(const b of city.buildings)for(const [key,pile]of b.feces||[]){const unit=b.units.find(u=>`${u.x},${u.y},${u.z}`===key);if(!unit)continue;const x=b.entity.x+unit.x+.5,y=b.entity.y+unit.y+.5;if(x<minX||x>maxX||y<minY||y>maxY)continue;add(x,(b.terrain?.base||0)+unit.z*CITY_FLOOR_HEIGHT+.05,y,pile.amount,'building',b.id,unit.z);}
    renderer.scene.add(group);renderer.fecesVisuals=group;renderer.fecesVisualRevision=revision;
  }
  const view=renderer.cityInteriorView;
  for(const mesh of renderer.fecesVisuals.children)mesh.visible=mesh.userData.fecesArea==='street'||view?.buildingId===mesh.userData.buildingId&&view?.floor===mesh.userData.floor;
}
function syncCardboardShelters(renderer,THREE,city,world){
  if(!city)return;const shelters=city.cardboardShelters||new Map(),revision=city.cardboardRevision||0;
  if(renderer.cardboardVisualRevision!==revision){
    if(renderer.cardboardVisuals){renderer.scene.remove(renderer.cardboardVisuals);renderer.cardboardVisuals.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
    const group=new THREE.Group(),mat=new THREE.MeshLambertMaterial({color:0x92704b}),foldMat=new THREE.MeshLambertMaterial({color:0x604a34});
    for(const site of shelters.values()){
      const x=site.x,y=site.y,z=surfaceElevation(world,x,y)+.035,matBox=new THREE.Mesh(new THREE.BoxGeometry(.78,.045,.58),mat),fold=new THREE.Mesh(new THREE.BoxGeometry(.12,.065,.56),foldMat);
      matBox.position.set(x,z,y);fold.position.set(x-.25,z+.035,y);matBox.rotation.y=(site.citizenId%4)*Math.PI/2;fold.rotation.y=matBox.rotation.y;matBox.receiveShadow=true;fold.castShadow=true;matBox.userData.cardboardTile=fold.userData.cardboardTile={x,y};group.add(matBox,fold);
    }
    renderer.cardboardVisuals=group;renderer.cardboardVisualRevision=revision;renderer.scene.add(group);
  }
  const minX=renderer.renderedMinTx??-Infinity,maxX=renderer.renderedMaxTx??Infinity,minY=renderer.renderedMinTy??-Infinity,maxY=renderer.renderedMaxTy??Infinity;
  for(const mesh of renderer.cardboardVisuals.children){const tile=mesh.userData.cardboardTile;mesh.visible=!!tile&&tile.x>=minX&&tile.x<=maxX+1&&tile.y>=minY&&tile.y<=maxY+1;}
}
function syncCorpseVisuals(renderer,THREE,city,world){
  const justice=city?.justice;if(!justice)return;
  const live=new Set(justice.bodies.filter(b=>b.status!=='cremated').map(b=>b.id)),meshes=renderer.corpseMeshes??=new Map();
  for(const [id,group]of meshes)if(!live.has(id)){renderer.scene.remove(group);group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});meshes.delete(id);}
  const minX=renderer.renderedMinTx??-Infinity,maxX=renderer.renderedMaxTx??Infinity,minY=renderer.renderedMinTy??-Infinity,maxY=renderer.renderedMaxTy??Infinity;
  for(const body of justice.bodies){if(body.status==='cremated')continue;let group=meshes.get(body.id);if(!group){group=new THREE.Group();const cloth=new THREE.MeshLambertMaterial({color:body.status==='autopsy'?0xe6e0d5:0x4b5551}),skin=new THREE.MeshLambertMaterial({color:0xc49b78});const torso=new THREE.Mesh(new THREE.BoxGeometry(.34,.17,.48),cloth);torso.position.y=.12;group.add(torso);const head=new THREE.Mesh(new THREE.SphereGeometry(.115,8,6),skin);head.position.set(0,.14,.34);group.add(head);for(const side of [-1,1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.36),cloth);leg.position.set(side*.105,.08,-.29);group.add(leg);const arm=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.34),cloth);arm.position.set(side*.22,.105,.02);arm.rotation.y=side*.18;group.add(arm);}group.userData.bodyId=body.id;group.userData.skinMaterial=skin;meshes.set(body.id,group);renderer.scene.add(group);}
    const band=Math.min(3,Math.floor((body.decomposition||0)/25));if(group.userData.decompositionBand!==band){group.userData.skinMaterial.color.setHex([0xc49b78,0xaaa080,0x898673,0x686d61][band]);group.userData.decompositionBand=band;}
    const x=body.entity.x,y=body.entity.y;group.position.set(x,surfaceElevation(world,x,y)+(body.currentInterior?.position.z||body.skybridgeZ||0)+.025,y);group.visible=x>=minX-1&&x<=maxX+1&&y>=minY-1&&y<=maxY+1;
  }
}
function drawArtNarrative(ctx,narrative){
  const ids=narrative.participantIds.length?narrative.participantIds:[0],count=Math.min(6,ids.length);
  ctx.strokeStyle='#e9dfc4';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(32,232);ctx.lineTo(480,232);ctx.stroke();
  for(let i=0;i<count;i++){const x=256+(i-(count-1)/2)*62,y=170;ctx.fillStyle=['#d9a86b','#86a7bd','#b7c58c','#cb9393'][Math.abs(ids[i])%4];ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();ctx.fillRect(x-10,y+16,20,27);ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x-6,y+43);ctx.lineTo(x-12,229);ctx.moveTo(x+6,y+43);ctx.lineTo(x+12,229);ctx.moveTo(x-10,y+20);ctx.lineTo(x-22,y+33);ctx.moveTo(x+10,y+20);ctx.lineTo(x+22,y+9);ctx.stroke();}
}
function syncUrbanArt(renderer,THREE,city,world){
  const justice=city?.justice;if(!justice)return;const meshes=renderer.urbanArtMeshes??=new Map(),live=new Set(justice.art.filter(a=>!a.entity.destroyed).map(a=>a.id));
  for(const [id,group]of meshes)if(!live.has(id)){renderer.scene.remove(group);group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();o.material?.map?.dispose();});meshes.delete(id);}
  for(const piece of justice.art){if(piece.entity.destroyed||piece.campaignDecorationId&&!piece.layers.length)continue;const face=piece.layers.at(-1)||piece,key=`${piece.id}:${piece.layers.length}:${face.message}:${piece.damaged}:${JSON.stringify(face.narrative||null)}`;let group=meshes.get(piece.id);
    if(group?.userData.key!==key){if(group){renderer.scene.remove(group);group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();o.material?.map?.dispose();});}group=new THREE.Group();
      if(['statue','monument'].includes(piece.kind)){const stone=new THREE.MeshLambertMaterial({color:piece.damaged>0?0x716d64:piece.color}),base=new THREE.Mesh(new THREE.BoxGeometry(.75,.42,.75),stone),body=new THREE.Mesh(new THREE.CylinderGeometry(.18,.25,.8,7),stone),head=new THREE.Mesh(new THREE.SphereGeometry(.2,8,6),stone);base.position.y=.21;body.position.y=.78;head.position.y=1.32;group.add(base,body,head);}
      else{const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d'),background=`#${(face.color??piece.color).toString(16).padStart(6,'0')}`;ctx.fillStyle=background;ctx.fillRect(0,0,512,256);ctx.fillStyle='rgba(0,0,0,.23)';ctx.fillRect(14,14,484,228);if(face.narrative)drawArtNarrative(ctx,face.narrative);ctx.fillStyle='#f3ead3';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 42px sans-serif';const words=String(face.message).split(/\s+/);let lines=[],line='';for(const word of words){if(line&&ctx.measureText(`${line} ${word}`).width>440){lines.push(line);line=word;}else line=line?`${line} ${word}`:word;}if(line)lines.push(line);const lineH=52,start=face.narrative?46:128-(lines.length-1)*lineH/2;for(let i=0;i<lines.length&&i<(face.narrative?2:4);i++)ctx.fillText(lines[i],256,start+i*lineH,448);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const material=new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide});const width=piece.kind==='flags'?1.4:2.1,height=piece.kind==='flags'?.55:1;const panel=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);panel.position.y=piece.kind==='graffiti'?1.05:1.35;group.add(panel);if(['banner','flags'].includes(piece.kind)){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,1.9,5),new THREE.MeshLambertMaterial({color:0x76664b}));pole.position.set(-width*.52,.95,0);group.add(pole);}}
      group.userData.key=key;group.rotation.y=piece.rotation||0;meshes.set(piece.id,group);renderer.scene.add(group);
    }
    const x=piece.entity.x,y=piece.entity.y;group.position.set(x,surfaceElevation(world,x,y)+.04,y);group.visible=!Number.isFinite(renderer.renderedMinTx)||x>=renderer.renderedMinTx-2&&x<=renderer.renderedMaxTx+2&&y>=renderer.renderedMinTy-2&&y<=renderer.renderedMaxTy+2;
  }
}
export function syncRoadBridges(renderer,THREE,world){
  const bridges=world.roadBridges||[],revision=world.bridgeRevision||0;
  if(renderer.roadBridgeRevision===revision)return;
  if(renderer.roadBridgeGroup){renderer.scene.remove(renderer.roadBridgeGroup);renderer.roadBridgeGroup.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  const group=new THREE.Group(),deckMaterial=new THREE.MeshLambertMaterial({color:0x77766c}),railMaterial=new THREE.MeshLambertMaterial({color:0x524c40});
  for(const bridge of bridges){
    const horizontal=bridge.axis==='x',tiles=bridge.tiles||[];
    for(let i=0;i<tiles.length;i++){const tile=tiles[i];
      if(!Number.isInteger(tile.x)||!Number.isInteger(tile.y)||tile.x<0||tile.y<0||tile.x>=world.width||tile.y>=world.height)continue;
      const height=bridge.height??.8,deck=new THREE.Mesh(new THREE.BoxGeometry(horizontal?.98:.86,.2,horizontal?.86:.98),deckMaterial);
      deck.position.set(tile.x+.5,height-.1,tile.y+.5);deck.receiveShadow=true;deck.castShadow=true;group.add(deck);
      if(i===0||i===tiles.length-1||i%4===0){
        for(const side of [-.38,.38]){const rail=new THREE.Mesh(new THREE.BoxGeometry(horizontal?.98:.07,.7,horizontal?.07:.98),railMaterial);rail.position.set(tile.x+.5+(horizontal?0:side),height+.25,tile.y+.5+(horizontal?side:0));group.add(rail);}
      }
    }
  }
  renderer.roadBridgeGroup=group;renderer.roadBridgeRevision=revision;renderer.scene.add(group);
}
// Room coordinates count floors; render their physical height consistently with picking.

export function syncCityBuildings(renderer, THREE, entities, world) {
  const oilCarriers=renderer.cityOilCarriers??=new Set();oilCarriers.clear();
  for(const shipment of renderer.cityLogistics?.shipments||[])if(shipment.good==='oleo'&&shipment.pickedUp&&shipment.driverId!=null)oilCarriers.add(shipment.driverId);
  syncConstructionSites(renderer,THREE,world,renderer.cityDevelopment);
  syncCampaignDecorations(renderer,THREE,entities,world);
  syncCityMobility(renderer,THREE,entities,world);
  syncSkybridges(renderer,THREE,entities,world);
  syncRoadBridges(renderer,THREE,world);
  syncCardboardShelters(renderer,THREE,renderer.cityDevelopment?.city,world);
  syncCorpseVisuals(renderer,THREE,renderer.cityDevelopment?.city,world);
  syncUrbanArt(renderer,THREE,renderer.cityDevelopment?.city,world);
  syncFecesVisuals(renderer,THREE,renderer.cityDevelopment?.city,world);
  syncStreetBenches(renderer,THREE,world);
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
    const interiorContentKey=b.type==='office_tower'?(b.officeLeases||[]).filter(l=>l.status==='active').map(l=>{const tenant=renderer.cityDevelopment?.city?.building(l.buildingId);return `${tenant?.id}:${tenant?.type}:${tenant?.layoutRevision||0}`;}).join('|'):'';
    const bridgeDoors=renderer.skybridgeDoors?.get(b.id),bridgeDoorKey=bridgeDoors?[...bridgeDoors].map(([id,mask])=>`${id}:${mask}`).join('|'):'';
    if (group && (group.userData.interiorContentKey!==interiorContentKey || group.userData.bridgeDoorKey!==bridgeDoorKey || group.userData.floorCount !== b.floors || group.userData.layoutRevision !== (b.layoutRevision||0) || group.userData.rotation !== (b.rotation||0)||group.userData.paintRevision!==(b.paintRevision||0)||group.userData.campaignPaintId!==(b.campaignPaint?.id??null))) {
      renderer.scene.remove(group); group.traverse(object => { object.geometry?.dispose(); object.material?.dispose();object.userData.partyFlagTexture?.dispose(); }); renderer.cityMeshes.delete(entity.id); group = null;
    }
    if (!group) {
      group = new THREE.Group();group.userData.interiorContentKey=interiorContentKey; group.userData.bridgeDoorKey=bridgeDoorKey;group.userData.floorCount = b.floors;group.userData.paintRevision=b.paintRevision||0;group.userData.layoutRevision=b.layoutRevision||0;group.userData.rotation=b.rotation||0;group.userData.campaignPaintId=b.campaignPaint?.id??null;
      const material = buildingMaterial(renderer,THREE,b.architecture==='timber'?'wood':'wall',0xffffff);material.side=THREE.DoubleSide;material.vertexColors=true;material.needsUpdate=true;
      const style = HOUSE_STYLES[b.architecture] || HOUSE_STYLES.modern;
      const residential = ['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing'].includes(b.type),mine=['iron_mine','bauxite_mine','clay_pit','sand_pit'].includes(b.type);
      const mineWall={iron_mine:0x77736b,bauxite_mine:0x806b62,clay_pit:0x886b58,sand_pit:0x94866a};
      const matrix = new THREE.Matrix4(), color = new THREE.Color(b.campaignPaint?.color||b.wallColor||(mine?mineWall[b.type]:residential ? style.wall : b.color));
      const cellMasks=new Map(),doorByUnit=new Map(bridgeDoors||[]),occupiedCells=new Set(b.units.map(u=>`${u.x},${u.y},${u.z}`));for(const cell of b.circulation||[])occupiedCells.add(`${cell.x},${cell.y},${cell.z}`);
      const entranceDoor=buildingEntranceDoor(b);if(entranceDoor)doorByUnit.set(entranceDoor.unitId,(doorByUnit.get(entranceDoor.unitId)||0)|entranceDoor.bit);
      for(const u of b.units)for(const [dx,dy,bit]of [[0,-1,1],[0,1,2],[-1,0,4],[1,0,8]])if(occupiedCells.has(`${u.x+dx},${u.y+dy},${u.z}`))doorByUnit.set(u.id,(doorByUnit.get(u.id)||0)|bit);
      for(const s of buildingLeisureSpaces(b))if(s.kind==='balcony')doorByUnit.set(s.unitId,(doorByUnit.get(s.unitId)||0)|s.doorBit);
      for (const u of b.units) {
        let facadeMask=0;if(u.y===0)facadeMask|=1;if(u.y===b.depth-1)facadeMask|=2;if(u.x===0)facadeMask|=4;if(u.x===b.width-1)facadeMask|=8;
        const doorMask=doorByUnit.get(u.id)||0,openingMask=u.hasWindow?facadeMask&~doorMask:0,key=`${facadeMask}:${openingMask}:${doorMask}`,bucket=cellMasks.get(key)||[];bucket.push(u);cellMasks.set(key,bucket);
      }
      const doorFrames=new THREE.Group();group.add(doorFrames);group.userData.doorFrames=doorFrames;
      for(const u of b.units)for(const [bit,dx,dy]of [[1,0,-1],[2,0,1],[4,-1,0],[8,1,0]])if((doorByUnit.get(u.id)||0)&bit){const frame=new THREE.Group(),mat=new THREE.MeshLambertMaterial({color:0x9b7653});for(const [x,y,w,h]of [[-.25,.72,.06,1.44],[.25,.72,.06,1.44],[0,1.47,.56,.07]]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,.075),mat);m.position.set(x,y,0);m.castShadow=m.receiveShadow=true;frame.add(m);}frame.position.set(u.x+.5+dx*.49,u.z*CITY_FLOOR_HEIGHT,u.y+.5+dy*.49);if(dx)frame.rotation.y=Math.PI/2;doorFrames.add(frame);}
      for(const frame of [...doorFrames.children]){frame.updateMatrix();for(const mesh of [...frame.children]){mesh.updateMatrix();mesh.matrix.premultiply(frame.matrix);mesh.matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);doorFrames.add(mesh);}doorFrames.remove(frame);}mergeStaticMeshes(THREE,doorFrames);
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
      const floorCells=[...b.units,...(b.circulation||[])],floorGeometry=new THREE.BoxGeometry(1,.06,1),floorMaterial=new THREE.MeshLambertMaterial({color:0x928571}),floors=new THREE.InstancedMesh(floorGeometry,floorMaterial,floorCells.length),ceilings=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.06,1),floorMaterial,floorCells.length),floorLevels=[],floorMatrices=[];
      for(let i=0;i<floorCells.length;i++){const u=floorCells[i];matrix.makeTranslation(u.x+.5,u.z*CITY_FLOOR_HEIGHT-.03,u.y+.5);floors.setMatrixAt(i,matrix);floorMatrices.push(matrix.clone());floorLevels.push(u.z);matrix.makeTranslation(u.x+.5,(u.z+1)*CITY_FLOOR_HEIGHT-.03,u.y+.5);ceilings.setMatrixAt(i,matrix);}
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
        const timber=new THREE.MeshLambertMaterial({color:b.type==='iron_mine'?0x72563d:0x8b6348}),rail=new THREE.MeshLambertMaterial({color:0x555e60});
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
      addBuildingDetails(THREE,facade,b);
      addArchitectureVariations(THREE,facade,b,buildingLeisureSpaces(entity.properties.cityBuilding));
      const entranceX=Math.floor(b.width/2)+.5;
      const awning = new THREE.Mesh(new THREE.BoxGeometry(1.1, .12, .7), new THREE.MeshLambertMaterial({ color: b.type === 'market' ? 0xdca14b : 0xc9d9a1 }));
      const awningColors = { super_popular_housing:0x987f68,popular_luxury_housing:0xb69868,popular_refectory: 0xd88a45, market: 0xdca14b, bakery: 0xc78b52, greengrocer: 0x75a956, clinic: 0xf0eee4, townhall: 0x7693ae, builder: 0xb87c3f, quarry: 0x777f83, luxury_housing: 0xc7a956, popular_housing: 0xa8734d };
      awning.material.color.setHex(awningColors[b.type] ?? 0xc9d9a1);
      if(!mine){awning.position.set(entranceX, 1.55, b.depth + .25); awning.castShadow = true; facade.add(awning);}
      }
      const highlight = new THREE.Mesh(new THREE.BoxGeometry(1.02, CITY_FLOOR_HEIGHT+.02, 1.02), new THREE.MeshBasicMaterial({ color: 0xf0e6a1, wireframe: true }));
      highlight.visible = false; group.add(highlight); group.userData.highlight = highlight;
      const supports = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, 1, .2), new THREE.MeshLambertMaterial({ color: 0x68756a }), b.width * b.depth);
      supports.castShadow = true; supports.receiveShadow = true; group.add(supports); group.userData.supports = supports;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(b.width, .12, b.depth), new THREE.MeshLambertMaterial({ color: 0x7e8776 }));
      slab.position.set(b.width / 2, -.06, b.depth / 2); slab.receiveShadow = true; group.add(slab);group.userData.slab=slab;
      const roomProps = new THREE.Group(),propsByFloor=new Map(),addRoomProp=(u,object)=>{let floor=propsByFloor.get(u.z);if(!floor){floor=new THREE.Group();floor.userData.interiorFloor=u.z;propsByFloor.set(u.z,floor);}floor.add(object);};
      for(const u of b.units)for(const item of roomFurnitureForCity(renderer.cityDevelopment?.city,b,u)){
        const model=furnitureModel(THREE,item);model.position.set(item.x,item.z*CITY_FLOOR_HEIGHT,item.y);model.updateMatrix();
        for(const mesh of [...model.children]){mesh.updateMatrix();mesh.matrix.premultiply(model.matrix);mesh.matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);addRoomProp(u,mesh);}
      }
      for(let z=0;z<Math.max(0,b.floors-1);z++)for(let step=0;step<10;step++){
        const wood=new THREE.Mesh(new THREE.BoxGeometry(.42,.18,.075),new THREE.MeshLambertMaterial({color:0x806448}));
        wood.castShadow=wood.receiveShadow=true;wood.position.set(Math.floor(b.width/2)+.5,z*CITY_FLOOR_HEIGHT+step*.18+.09,Math.floor(b.depth/2)+.18+step*.075);let floor=propsByFloor.get(z);if(!floor){floor=new THREE.Group();floor.userData.interiorFloor=z;propsByFloor.set(z,floor);}floor.add(wood);
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
    group.position.set(entity.x, b.terrain.base, entity.y);
    const interior=renderer.cityInteriorView?.buildingId===b.id&&b.constructionKind!=='open-air',interiorFloor=renderer.cityInteriorView?.floor||0;
    applyInteriorCutaway(THREE,group,interior?interiorFloor:null,renderer.cityInteriorView?.hideWalls!==false);
    for(const cells of group.userData.cellMeshes||[group.userData.cells]){const material=cells.material;material.emissive.setHex(renderer.selectedEntityId===entity.id?0x26351a:0x000000);}
    const unit = renderer.selectedEntityId === entity.id ? b.units.find(u => u.id === renderer.selectedCityUnitId) : null;
    group.userData.highlight.visible = !interior&&renderer.selectedEntityId === entity.id && !!unit;
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
  for(const field of b.fields||[]){const count=Math.min(field.area||12,cells.length-offset),age=field.plantedAt==null?0:Math.max(0,minute-field.plantedAt)*(field.growthMultiplier||1),growth=field.plantedAt==null?0:Math.min(1,age/Math.max(1,plantSet.visual.grow));for(let i=0;i<count;i++)growthByCell[offset+i]=growth;offset+=count;if(offset>=cells.length)break;}
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
    if(b.type==='farm'){patches.visible=false;const cropPlants=createFarmPlants(THREE,b);group.add(cropPlants.group);group.userData.cropPlants=cropPlants;}
    if(b.type==='farm')addFarmFence(THREE,group,b,world);
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
        for(const [x,y,w,h]of [[-.25,.72,.06,1.44],[.25,.72,.06,1.44],[0,1.47,.56,.07]]){const frame=new THREE.Mesh(new THREE.BoxGeometry(w,h,.07),new THREE.MeshLambertMaterial({color:0xa48155}));frame.position.set(x,y,.475);frame.castShadow=true;shed.add(frame);}
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
  const banner=new THREE.Mesh(clothFlagGeometry(THREE,1.65,1.04),material);group.userData.governingFlagCloth=banner;group.userData.governingFlagPhase=0;animateClothFlag(banner,flagWindTime(renderer),0);
  banner.userData.partyFlagTexture=texture;banner.position.set(b.width*.5+.85,roof+1.9,b.depth*.5);mast.add(banner);group.userData.governingFlagMaterial=material;
  group.add(mast);group.userData.governingFlagMesh=mast;
}

function addFarmFence(THREE,group,b,world){
 const wood=new THREE.MeshLambertMaterial({color:0x9b7950}),fence=new THREE.Group();
 const segment=(x1,z1,x2,z2)=>{const mx=(x1+x2)/2,mz=(z1+z2)/2;if(Math.hypot(b.entity.x+mx-b.door.x,b.entity.y+mz-b.door.y)<1.35)return;const h1=surfaceElevation(world,b.entity.x+x1,b.entity.y+z1),h2=surfaceElevation(world,b.entity.x+x2,b.entity.y+z2);
  const post=new THREE.Mesh(new THREE.BoxGeometry(.075,.7,.075),wood);post.position.set(x1,h1+.35,z1);fence.add(post);
  for(const y of [.25,.55]){const rail=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(x2-x1,z2-z1,h2-h1),.055,.055),wood);rail.position.set(mx,(h1+h2)/2+y,mz);rail.rotation.y=-Math.atan2(z2-z1,x2-x1);rail.rotation.z=Math.atan2(h2-h1,Math.hypot(x2-x1,z2-z1));fence.add(rail);}
 };
 for(let x=0;x<b.width;x++){segment(x+.04,.04,Math.min(b.width-.04,x+1+.04),.04);segment(x+.04,b.depth-.04,Math.min(b.width-.04,x+1+.04),b.depth-.04);}for(let y=0;y<b.depth;y++){segment(.04,y+.04,.04,Math.min(b.depth-.04,y+1+.04));segment(b.width-.04,y+.04,b.width-.04,Math.min(b.depth-.04,y+1+.04));}for(const m of fence.children)m.castShadow=m.receiveShadow=true;mergeStaticMeshes(THREE,fence);group.add(fence);
}
function syncStreetBenches(renderer,THREE,world){
 const furniture=renderer.cityDevelopment?.city?.furniture;if(!furniture)return;const meshes=renderer.streetBenchMeshes??=new Map(),active=new Set(furniture.benches.map(b=>b.id));for(const [id,g]of meshes)if(!active.has(id)){renderer.scene.remove(g);g.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});meshes.delete(id);}
 for(const b of furniture.benches){let g=meshes.get(b.id);if(!g){g=furnitureModel(THREE,{type:'bench'});mergeStaticMeshes(THREE,g);g.rotation.y=b.angle;g.position.set(b.x,surfaceElevation(world,b.x,b.y)+.02,b.y);renderer.scene.add(g);meshes.set(b.id,g);}g.visible=b.x>=(renderer.renderedMinTx??0)&&b.x<=(renderer.renderedMaxTx??world.width)&&b.y>=(renderer.renderedMinTy??0)&&b.y<=(renderer.renderedMaxTy??world.height);}
}
