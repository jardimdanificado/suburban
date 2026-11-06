import {furnitureModel} from './city_furniture_models.js?v=no-beach-towels-1';
import {addBuildingDetails} from './city_building_details.js?v=mine-sign-removed-1';
import {drawPixelText} from './pixel_text.js?v=pixel-text-1';
import {syncConstructionSites} from './city_construction_renderer.js?v=ground-realism-2';
import {syncCityMobility} from './city_mobility_renderer.js?v=natural-streets-2';
import {syncCampaignDecorations} from './city_campaign_renderer.js';
import {clothFlagGeometry,animateClothFlag,flagWindTime} from './city_flag_animation.js?v=flag-wind-tick-13';
import {marketFixtures,positionMarketFixtures} from './city_market_model.js?v=greengrocer-fruit-stalls-1';
import {syncStreetMarketStalls} from './city_street_market_renderer.js?v=roadside-ad-placards-1';
import {modelSize,buildingPoint,buildingEntranceDoor,buildingFacadeBannerSupport,CITY_FLOOR_HEIGHT} from './city_building_geometry.js?v=banner-placement-2';
import { partyFlagCanvas,drawPartyFlag } from './city_party_flags.js';
import {citizenIsSleeping} from './city_citizen_models.js?v=campaign-flag-simclock-1';
import { HOUSE_STYLES, architectureFor } from './city_culture.js?v=colonial-colored-trim-1';
import { INDUSTRIES } from './city_industries.js';
import { buildingGround, surfaceElevation, flagNightFactor, isRoadAt } from './city_terrain.js?v=entrance-retaining-clearance-1';
import {quarryDeposits} from './city_terrain.js?v=entrance-retaining-clearance-1';
import {addArchitectureVariations} from './city_architecture_variations.js?v=colonial-colored-trim-1';
import {syncSkybridges} from './city_skybridges.js?v=colonial-street-2';
import {buildingLeisureSpaces} from './city_balconies.js?v=sertanejo-house-styles-1';
import {mergeStaticMeshes} from './city_static_mesh.js?v=static-batch-9';
import {narrativeSceneType,narrativeRoleForParticipant} from './city_art_narratives.js';
const OPEN_PIT_MINES=new Set(['iron_mine','bauxite_mine']);
const EMPTY_FLOORS=new Set();
function buildingMaterial(renderer,THREE,kind,color,variant=0){
  return renderer.createCityBuildingMaterial?.(kind,color,variant)||new THREE.MeshLambertMaterial({color});
}
function buildingTextureVariant(id){let hash=2166136261;for(const char of String(id??''))hash=Math.imul(hash^char.charCodeAt(0),16777619);return (hash>>>0)%32;}
function artworkStreetFacingRotation(world,x,y,seed=0){
  const tx=Math.floor(x),ty=Math.floor(y),directions=[[0,-1,Math.PI],[1,0,Math.PI/2],[0,1,0],[-1,0,-Math.PI/2]],roads=directions.filter(([dx,dy])=>isRoadAt(world,tx+dx,ty+dy));
  return roads.length?roads[((seed>>>0)%roads.length)][2]:null;
}
function facadeLocalCell(building,unit){
  switch((building.rotation||0)%4){
    case 1:return {x:building.depth-1-unit.y,y:unit.x};
    case 2:return {x:building.width-1-unit.x,y:building.depth-1-unit.y};
    case 3:return {x:unit.y,y:building.width-1-unit.x};
    default:return {x:unit.x,y:unit.y};
  }
}
function facadeLocalSide(side,rotation){
  const maps=[
    {back:'back',front:'front',left:'left',right:'right'},
    {back:'right',front:'left',left:'back',right:'front'},
    {back:'front',front:'back',left:'right',right:'left'},
    {back:'left',front:'right',left:'front',right:'back'},
  ];
  return maps[(rotation||0)%4][side];
}
function facadeSideBit(side){return ({back:1,front:2,left:4,right:8})[side]||0;}
function addBuildingRoof(THREE,facade,b,material,kind,baseY){
  if(kind==='gable'){
    const triangle=new THREE.Shape();triangle.moveTo(-b.width/2-.1,0);triangle.lineTo(b.width/2+.1,0);triangle.lineTo(0,.75);triangle.closePath();
    const pitched=new THREE.Mesh(new THREE.ExtrudeGeometry(triangle,{depth:b.depth+.2,bevelEnabled:false}),material);pitched.position.set(b.width/2,baseY,-.1);pitched.castShadow=true;facade.add(pitched);return;
  }
  if(kind==='hip'){
    const pitched=new THREE.Mesh(new THREE.ConeGeometry(1,.75,4),material);pitched.rotation.y=Math.PI/4;
    pitched.scale.set((b.width+.2)/Math.SQRT2,1,(b.depth+.2)/Math.SQRT2);pitched.position.set(b.width/2,baseY+.375,b.depth/2);pitched.castShadow=true;facade.add(pitched);return;
  }
  if(kind==='mansard'){
    const lower=new THREE.Mesh(new THREE.CylinderGeometry(.62,1,.42,4),material);lower.rotation.y=Math.PI/4;
    lower.scale.set((b.width+.2)/Math.SQRT2,1,(b.depth+.2)/Math.SQRT2);lower.position.set(b.width/2,baseY+.21,b.depth/2);lower.castShadow=true;facade.add(lower);
    const upper=new THREE.Mesh(new THREE.ConeGeometry(.62,.42,4),material);upper.rotation.y=Math.PI/4;
    upper.scale.set((b.width+.2)/Math.SQRT2,1,(b.depth+.2)/Math.SQRT2);upper.position.set(b.width/2,baseY+.63,b.depth/2);upper.castShadow=true;facade.add(upper);return;
  }
  if(kind==='shed'){
    const roof=new THREE.Mesh(new THREE.BoxGeometry(b.width+.2,.16,b.depth+.28),material);roof.rotation.x=.18;
    roof.position.set(b.width/2,baseY+.34,b.depth/2);roof.castShadow=true;facade.add(roof);return;
  }
  material.dispose();
}
function roomCellGeometry(THREE,facadeMask,openingMask,doorMask=0){
  const g=new THREE.BufferGeometry(),v=[],uvs=[],colors=[],h=CITY_FLOOR_HEIGHT,half=.5,wy=.96,wh=.4,ww=.17;
  const exterior=[1,1,1],interior=[.72,.65,.53];
  const quad=(a,b,c,d,color,uv)=>{const corners=[[a,uv[0],uv[1]],[b,uv[2],uv[1]],[c,uv[2],uv[3]],[a,uv[0],uv[1]],[c,uv[2],uv[3]],[d,uv[0],uv[3]]];for(const [point,u,vv] of corners){v.push(...point);uvs.push(u,vv);colors.push(...color);}};
  const wall=(axis,sign,bit)=>{
    const hasWindow=!!(openingMask&bit),hasDoor=!!(doorMask&bit),wallColor=facadeMask&bit?exterior:interior;
    // Exterior faces reach the edge of their tile. Interior partitions stay
    // slightly inset so neighboring rooms do not draw coplanar wall faces.
    const at=sign*(facadeMask&bit?half:half-.015),innerAt=at-sign*.03,lo=wy-wh,hi=wy+wh;
    const face=(plane,color)=>{
      const rect=(a0,a1,y0,y1)=>{if(a1<=a0||y1<=y0)return;const uv=[a0+half,y0,a1+half,y1];if(axis==='z')quad([a0,y0,plane],[a1,y0,plane],[a1,y1,plane],[a0,y1,plane],color,uv);else quad([plane,y0,a0],[plane,y0,a1],[plane,y1,a1],[plane,y1,a0],color,uv);};
      if(hasDoor){rect(-half,-.22,0,1.45);rect(.22,half,0,1.45);rect(-half,half,1.45,h);return;}
      if(!hasWindow){rect(-half,half,0,h);return;}
      rect(-half,half,0,lo);rect(-half,half,hi,h);
      rect(-half,-ww,lo,hi);rect(ww,half,lo,hi);
    };
    face(at,wallColor);
    face(innerAt,interior);
  };
  for(const [bit,axis,sign] of [[1,'z',-1],[2,'z',1],[4,'x',-1],[8,'x',1]])wall(axis,sign,bit);
  g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
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
    renderer.scene.add(group);renderer.fecesVisuals=group;renderer.fecesVisualRevision=revision;
  }
  for(const mesh of renderer.fecesVisuals.children)mesh.visible=mesh.userData.fecesArea==='street';
}
function syncCardboardShelters(renderer,THREE,city,world){
  if(!city)return;const shelters=city.cardboardShelters||new Map(),minute=city.minute??0,stageOf=site=>Math.max(0,Math.min(4,Math.floor(Math.max(0,minute-(site.placedAt??minute))/(2*1440)))),signature=[city.cardboardRevision||0,...[...shelters.values()].map(site=>`${site.citizenId}:${stageOf(site)}`)].join('|');
  if(renderer.cardboardVisualSignature!==signature){
    if(renderer.cardboardVisuals){renderer.scene.remove(renderer.cardboardVisuals);renderer.cardboardVisuals.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
    const group=new THREE.Group();
    for(const site of shelters.values()){
      const x=site.x,y=site.y,z=surfaceElevation(world,x,y)+.035,bed=new THREE.Group(),seed=Math.imul((site.citizenId||0)+31,2654435761)>>>0,style=seed%8,stage=stageOf(site),palette=[0x92704b,0x6d6254,0x665d52,0x75634e,0x80684d,0x665e56,0x897052,0x625b50],wood=[0x8e6943,0x70533b,0x9a744b,0x635643][(seed>>>4)%4],canvas=[0x6c7771,0x837c69,0x6b747d,0x8b745a,0x6d625d][(seed>>>8)%5],ox=((seed>>>12)%3-1)*.12,oz=((seed>>>14)%3-1)*.12;
      bed.position.set(x+ox,z,y+oz);bed.rotation.y=((seed>>>16)%4)*Math.PI/2;bed.userData.cardboardTile={x,y};
      const makeMat=(w,d,h,color,px=0,pz=0,py=h/2,rx=0,rz=0)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color}));mesh.position.set(px,py,pz);mesh.rotation.set(rx,0,rz);mesh.castShadow=true;mesh.receiveShadow=true;bed.add(mesh);return mesh;};
      const gableRoof=(left,right,ridge=1.25)=>{makeMat(.40,.68,.045,left,-.19,0,ridge-.10,0,.40);makeMat(.40,.68,.045,right,.19,0,ridge-.10,0,-.40);makeMat(.045,.73,.05,wood,0,0,ridge+.005);};
      const roof=()=>{
        if(stage===2){
          if(style%3===1){makeMat(.78,.70,.05,canvas,0,0,1.11,0,style%2?.18:-.18);makeMat(.18,.34,.035,wood,.24,.16,1.16,0,-.18);}
          else{gableRoof(canvas,style%2?wood:canvas,1.25);makeMat(.27,.23,.025,style%2?canvas:wood,-.25,.16,1.17,0,.40);}
          // Loose cloth tails make this read as a tarp tied over a pole frame.
          makeMat(.72,.035,.15,canvas,0,.33,1.02,-.05,0);
          return;
        }
        const metal=[0x687675,0x818786,0x746d62,0x927a58][(seed>>>20)%4],metalPatch=[0x8d918b,0x746254,0x5e6f70,0xa18a65][(seed>>>23)%4];
        if(style===0||style===5||style===7){
          gableRoof(style===5?metal:canvas,style===7?metalPatch:canvas,1.29);
          makeMat(.30,.26,.025,style===5?canvas:metalPatch,-.23,-.17,1.21,0,.40);makeMat(.27,.22,.025,style===0?metalPatch:wood,.24,.14,1.20,0,-.40);
        }else if(style===1||style===6){
          makeMat(.78,.72,.055,style===1?canvas:metal,0,0,1.08,0,style===1?.20:-.20);
          for(let rib=0;rib<5;rib++)makeMat(.035,.68,.024,rib%2?metalPatch:wood,-.34+rib*.17,0,1.09+(style===1?.20:-.20)*(-.34+rib*.17),0,style===1?.20:-.20);
          makeMat(.16,.23,.03,style===1?metalPatch:canvas,.23,.16,1.15,0,style===1?.20:-.20);
        }else if(style===2||style===3){
          gableRoof(style===2?metal:wood,style===2?metalPatch:canvas,1.30);
          for(let rib=0;rib<6;rib++){
            const px=-.38+rib*.152,side=px<0?1:-1;
            makeMat(.022,.64,.022,rib%3===0?wood:metalPatch,px,0,1.17+(.22-Math.abs(px))*.42,0,side*.40);
          }
        }else{
          gableRoof(canvas,metal,1.25);
          for(let patch=0;patch<4;patch++)makeMat(.20,.17,.03,patch%2?metalPatch:wood,-.25+(patch%2)*.48,-.20+Math.floor(patch/2)*.39,1.16,0,patch%2?-.4:.4);
        }
      };
      // Every stage keeps the original cardboard bedding and grows a distinct
      // one-tile shelter around it as the makeshift home persists.
      makeMat(.68,.50,.035,palette[style]);makeMat(.26,.40,.018,0xb18a5d,-.16,.01,.047);makeMat(.18,.16,.06,0xc6b99c,-.22,-.16,.078);
      if(stage>=1){for(const [px,pz]of [[-.34,-.27],[.34,-.27],[-.34,.27],[.34,.27]])makeMat(.035,.035,.72,wood,px,pz,.36);makeMat(.035,.035,.68,wood,-.34,0,.71);makeMat(.035,.035,.68,wood,.34,0,.71);}
      if(stage>=2){for(const [px,pz]of [[-.34,-.27],[.34,-.27],[-.34,.27],[.34,.27]])makeMat(.035,.035,.30,wood,px,pz,.84);makeMat(.72,.035,.04,wood,0,-.30,.98);makeMat(.72,.035,.04,wood,0,.30,.98);roof();}
      if(stage>=3){
        const wallA=[0x8f7658,0x9a805d,0x786a57,0xa18460][style%4],wallB=[0x6d5d4b,0x82715a,0x9b805d,0x665c50][(style+1)%4];
        makeMat(.055,.48,.60,wallA,-.31,0,.34);makeMat(.055,.48,.60,wallB,.31,0,.34);makeMat(.62,.055,.60,wallB,0,-.24,.34);makeMat(.22,.055,.60,wallA,-.20,.24,.34);makeMat(.22,.055,.60,wallB,.20,.24,.34);
      }
      if(stage>=4){makeMat(.24,.23,.28,0x7a5d40,-.34,.26,.16);makeMat(.26,.25,.035,0x8c7450,-.34,.26,.32);makeMat(.12,.12,.48,wood,.37,.25,.24);makeMat(.16,.16,.08,canvas,.37,.25,.50);}
      mergeStaticMeshes(THREE,bed);group.add(bed);
    }
    renderer.cardboardVisuals=group;renderer.cardboardVisualSignature=signature;renderer.scene.add(group);
  }
  const minX=renderer.renderedMinTx??-Infinity,maxX=renderer.renderedMaxTx??Infinity,minY=renderer.renderedMinTy??-Infinity,maxY=renderer.renderedMaxTy??Infinity;
  for(const bed of renderer.cardboardVisuals.children){const tile=bed.userData.cardboardTile;bed.visible=!!tile&&tile.x>=minX&&tile.x<=maxX+1&&tile.y>=minY&&tile.y<=maxY+1;}
}
function syncCorpseVisuals(renderer,THREE,city,world){
  const justice=city?.justice;if(!justice)return;
  const mortoGeometry=renderer.cityCitizenModels?.frames?.get('morto:0');
  const live=new Set(justice.bodies.filter(b=>b.status!=='cremated').map(b=>b.id)),meshes=renderer.corpseMeshes??=new Map();
  for(const [id,group]of meshes)if(!live.has(id)){renderer.scene.remove(group);group.traverse(o=>{if(o.geometry!==mortoGeometry)o.geometry?.dispose();o.material?.dispose();});meshes.delete(id);}
  const minX=renderer.renderedMinTx??-Infinity,maxX=renderer.renderedMaxTx??Infinity,minY=renderer.renderedMinTy??-Infinity,maxY=renderer.renderedMaxTy??Infinity;
  for(const body of justice.bodies){if(body.status==='cremated')continue;let group=meshes.get(body.id);if(!group){group=new THREE.Group();group.userData.bodyId=body.id;meshes.set(body.id,group);renderer.scene.add(group);}
    if(mortoGeometry&&!group.userData.usesMortoModel){group.traverse(o=>{if(o!==group){o.geometry?.dispose();o.material?.dispose();}});group.clear();const material=new THREE.MeshLambertMaterial({color:0xc49b78}),mesh=new THREE.Mesh(mortoGeometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);group.userData.decompositionMaterial=material;group.userData.usesMortoModel=true;}
    else if(!group.userData.usesMortoModel&&!group.children.length){const cloth=new THREE.MeshLambertMaterial({color:body.status==='autopsy'?0xe6e0d5:0x4b5551}),skin=new THREE.MeshLambertMaterial({color:0xc49b78});const torso=new THREE.Mesh(new THREE.BoxGeometry(.34,.17,.48),cloth);torso.position.y=.12;group.add(torso);const head=new THREE.Mesh(new THREE.SphereGeometry(.115,8,6),skin);head.position.set(0,.14,.34);group.add(head);for(const side of [-1,1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.36),cloth);leg.position.set(side*.105,.08,-.29);group.add(leg);const arm=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.34),cloth);arm.position.set(side*.22,.105,.02);arm.rotation.y=side*.18;group.add(arm);}group.userData.decompositionMaterial=skin;}
    const band=Math.min(3,Math.floor((body.decomposition||0)/25));if(group.userData.decompositionBand!==band){group.userData.decompositionMaterial.color.setHex([0xc49b78,0xaaa080,0x898673,0x686d61][band]);group.userData.decompositionBand=band;}
    const vehicle=body.currentVehicleId?city.vehicles?.units.get(body.currentVehicleId):null,x=vehicle?.x??body.entity.x,y=vehicle?.y??body.entity.y,base=vehicle?(vehicle.altitude??surfaceElevation(world,x,y))+.42:surfaceElevation(world,x,y)+(body.currentInterior?.position.z||body.skybridgeZ||0);group.position.set(x,base+.025,y);group.visible=x>=minX-1&&x<=maxX+1&&y>=minY-1&&y<=maxY+1;
  }
}
function syncImportDepotVisual(renderer){
  const group=renderer.importDepotVisual;if(!group)return;
  renderer.scene.remove(group);group.traverse(object=>{object.geometry?.dispose();if(Array.isArray(object.material))object.material.forEach(material=>material.dispose());else object.material?.dispose();});renderer.importDepotVisual=null;
}
function drawArtNarrative(ctx,narrative){
  const ids=narrative.participantIds.length?narrative.participantIds:[0],count=Math.min(6,ids.length),scene=narrativeSceneType(narrative);
  ctx.strokeStyle='#e9dfc4';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(32,232);ctx.lineTo(480,232);ctx.stroke();
  if(scene==='protest'){ctx.fillStyle='#d8bc86';ctx.fillRect(205,103,102,8);ctx.fillRect(218,111,6,26);ctx.fillRect(288,111,6,26);ctx.fillStyle='#b46f75';ctx.fillRect(220,83,72,20);}
  else if(scene==='election'){ctx.fillStyle='#c9b979';ctx.fillRect(225,133,62,37);ctx.fillStyle='#453f35';ctx.fillRect(251,132,10,4);ctx.fillStyle='#e9dfc4';ctx.beginPath();ctx.moveTo(248,114);ctx.lineTo(275,123);ctx.lineTo(270,137);ctx.lineTo(243,128);ctx.closePath();ctx.fill();}
  else if(scene==='care'){ctx.fillStyle='#8dba9e';ctx.fillRect(247,119,20,52);ctx.fillRect(231,135,52,20);}
  else if(scene==='civic'){ctx.fillStyle='rgba(235,223,196,.38)';ctx.fillRect(211,121,90,51);ctx.beginPath();ctx.moveTo(202,122);ctx.lineTo(256,94);ctx.lineTo(310,122);ctx.closePath();ctx.fill();for(const x of [224,248,272,296]){ctx.fillStyle='#d5c8ad';ctx.fillRect(x,128,7,40);}}
  else if(scene==='conflict'){ctx.strokeStyle='#c5746e';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(224,151);ctx.lineTo(244,139);ctx.moveTo(287,140);ctx.lineTo(306,151);ctx.stroke();ctx.fillStyle='rgba(160,72,66,.25)';ctx.beginPath();ctx.arc(256,154,44,0,Math.PI*2);ctx.fill();}
  else if(scene==='celebration'){ctx.fillStyle='#dfc981';for(const [x,y]of [[218,132],[291,116],[306,153],[203,158],[274,106]]){ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();}}
  else if(scene==='justice'){ctx.strokeStyle='#e2d4b4';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(256,99);ctx.lineTo(256,161);ctx.moveTo(222,112);ctx.lineTo(290,112);ctx.moveTo(235,113);ctx.lineTo(222,143);ctx.lineTo(248,143);ctx.closePath();ctx.moveTo(277,113);ctx.lineTo(264,143);ctx.lineTo(290,143);ctx.closePath();ctx.moveTo(240,163);ctx.lineTo(272,163);ctx.stroke();ctx.fillStyle='rgba(226,212,180,.28)';ctx.fillRect(218,145,34,5);ctx.fillRect(260,145,34,5);}
  else if(scene==='funeral'){ctx.fillStyle='#ead8ad';ctx.fillRect(248,111,16,58);ctx.fillStyle='#d6a66b';ctx.beginPath();ctx.moveTo(256,91);ctx.bezierCurveTo(239,108,244,119,256,121);ctx.bezierCurveTo(269,116,271,104,256,91);ctx.fill();ctx.strokeStyle='#829a78';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(207,166);ctx.quadraticCurveTo(224,143,241,166);ctx.moveTo(271,166);ctx.quadraticCurveTo(288,143,305,166);ctx.stroke();}
  else if(scene==='disaster'){const words=`${narrative.title||''} ${narrative.description||''} ${narrative.source?.message||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(/enchent|inund/.test(words)){ctx.strokeStyle='#74a6bd';ctx.lineWidth=9;for(let y=123;y<=155;y+=16){ctx.beginPath();ctx.moveTo(207,y);ctx.quadraticCurveTo(224,y-9,241,y);ctx.quadraticCurveTo(258,y+9,275,y);ctx.quadraticCurveTo(292,y-9,309,y);ctx.stroke();}}else{ctx.fillStyle='#dc9260';for(const [x,y,r]of [[226,149,19],[247,132,27],[268,147,22],[287,137,16]]){ctx.beginPath();ctx.moveTo(x,y+r);ctx.quadraticCurveTo(x-r,y,x,y-r);ctx.quadraticCurveTo(x+r*.7,y-r*.2,x,y+r);ctx.fill();}ctx.fillStyle='#f0cf79';ctx.beginPath();ctx.moveTo(256,156);ctx.quadraticCurveTo(240,137,257,115);ctx.quadraticCurveTo(273,137,256,156);ctx.fill();}}
  else if(scene==='work'){ctx.strokeStyle='#d8c391';ctx.lineWidth=8;ctx.beginPath();ctx.arc(256,137,27,0,Math.PI*2);ctx.moveTo(256,101);ctx.lineTo(256,115);ctx.moveTo(256,159);ctx.lineTo(256,173);ctx.moveTo(220,137);ctx.lineTo(234,137);ctx.moveTo(278,137);ctx.lineTo(292,137);ctx.moveTo(231,112);ctx.lineTo(241,122);ctx.moveTo(271,152);ctx.lineTo(281,162);ctx.stroke();ctx.fillStyle='#b78a5e';ctx.fillRect(215,161,20,6);ctx.save();ctx.translate(301,128);ctx.rotate(.65);ctx.fillRect(-4,-24,8,54);ctx.restore();}
  else if(scene==='reunion'){ctx.strokeStyle='#d5a389';ctx.lineWidth=7;ctx.beginPath();ctx.arc(235,135,20,Math.PI*.2,Math.PI*1.8);ctx.arc(277,135,20,Math.PI*1.2,Math.PI*.8);ctx.moveTo(250,151);ctx.bezierCurveTo(253,160,259,160,262,151);ctx.stroke();ctx.fillStyle='rgba(226,157,139,.25)';ctx.beginPath();ctx.moveTo(256,164);ctx.bezierCurveTo(224,142,240,126,256,143);ctx.bezierCurveTo(272,126,288,142,256,164);ctx.fill();}
  for(let i=0;i<count;i++){const x=256+(i-(count-1)/2)*62,y=170,role=narrativeRoleForParticipant(narrative,ids[i]);ctx.fillStyle=['#d9a86b','#86a7bd','#b7c58c','#cb9393'][Math.abs(ids[i])%4];ctx.beginPath();ctx.arc(x,y+(role==='victim'?5:0),12,0,Math.PI*2);ctx.fill();ctx.fillRect(x-10,y+16,20,role==='victim'?21:27);ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x-6,y+(role==='victim'?37:43));ctx.lineTo(x-12,229);ctx.moveTo(x+6,y+(role==='victim'?37:43));ctx.lineTo(x+12,229);
    if(role==='leader'){ctx.moveTo(x-10,y+20);ctx.lineTo(x-18,y-3);ctx.moveTo(x+10,y+20);ctx.lineTo(x+18,y+9);}
    else if(role==='witness'){ctx.moveTo(x-10,y+20);ctx.lineTo(x-22,y+33);ctx.moveTo(x+10,y+20);ctx.lineTo(x+26,y+17);}
    else if(role==='rescuer'){ctx.moveTo(x-10,y+20);ctx.lineTo(x-25,y+33);ctx.moveTo(x+10,y+20);ctx.lineTo(x+25,y+33);}
    else if(role==='antagonist'){ctx.moveTo(x-10,y+20);ctx.lineTo(x-2,y+30);ctx.moveTo(x+10,y+20);ctx.lineTo(x+2,y+30);}
    else if(role==='victim'){ctx.moveTo(x-10,y+20);ctx.lineTo(x-23,y+36);ctx.moveTo(x+10,y+20);ctx.lineTo(x+23,y+36);}
    else if(scene==='protest'||scene==='celebration'){ctx.moveTo(x-10,y+20);ctx.lineTo(x-18,y-3);ctx.moveTo(x+10,y+20);ctx.lineTo(x+18,y-3);}
    else{ctx.moveTo(x-10,y+20);ctx.lineTo(x-22,y+33);ctx.moveTo(x+10,y+20);ctx.lineTo(x+22,y+9);}ctx.stroke();}
}
function drawUntitledPainting(ctx,piece){
  const seed=(Math.imul(piece.id+13,2654435761)>>>0),variant=seed%4;
  const palettes=[['#d9b879','#73928a','#496e70','#b7715b','#e7d7b6'],['#e1bd72','#698394','#425a70','#9d6256','#e6d1a6'],['#d7a47c','#799071','#526447','#bd7657','#eee0bd'],['#d8c6a2','#7d8496','#555b73','#bc7661','#eee2c9']],palette=palettes[(seed>>>5)%palettes.length];
  ctx.fillStyle=palette[0];ctx.fillRect(0,0,512,256);
  if(variant===0){ctx.fillStyle=palette[1];ctx.beginPath();ctx.moveTo(0,156);ctx.lineTo(76,90);ctx.lineTo(143,145);ctx.lineTo(236,74);ctx.lineTo(329,147);ctx.lineTo(414,96);ctx.lineTo(512,151);ctx.lineTo(512,256);ctx.lineTo(0,256);ctx.fill();ctx.fillStyle=palette[2];ctx.beginPath();ctx.moveTo(0,180);ctx.lineTo(99,132);ctx.lineTo(185,176);ctx.lineTo(305,117);ctx.lineTo(414,176);ctx.lineTo(512,135);ctx.lineTo(512,256);ctx.lineTo(0,256);ctx.fill();ctx.fillStyle=palette[3];ctx.fillRect(0,190,512,66);ctx.fillStyle=palette[4];ctx.beginPath();ctx.arc(376,70,30,0,Math.PI*2);ctx.fill();for(let row=0;row<4;row++){ctx.fillStyle=row%2?palette[1]:palette[4];ctx.fillRect(0,199+row*13,512,4);}}
  else if(variant===1){ctx.fillStyle=palette[4];ctx.fillRect(0,169,512,87);ctx.fillStyle=palette[2];ctx.fillRect(0,177,512,6);ctx.fillStyle=palette[3];ctx.beginPath();ctx.arc(253,103,46,0,Math.PI*2);ctx.fill();ctx.fillStyle=palette[1];ctx.beginPath();ctx.arc(253,103,29,0,Math.PI*2);ctx.fill();for(let i=0;i<5;i++){const x=78+i*86,h=32+(seed>>>((i*3)%24))%58;ctx.fillStyle=i%2?palette[2]:palette[3];ctx.fillRect(x,169-h,29,h);ctx.fillStyle=palette[4];ctx.fillRect(x+7,177-h,5,8);ctx.fillRect(x+18,177-h,5,8);}}
  else if(variant===2){ctx.fillStyle=palette[2];ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(234,0);ctx.lineTo(512,256);ctx.lineTo(274,256);ctx.closePath();ctx.fill();ctx.fillStyle=palette[3];ctx.beginPath();ctx.arc(177,128,76,0,Math.PI*2);ctx.fill();ctx.fillStyle=palette[4];ctx.beginPath();ctx.arc(177,128,48,0,Math.PI*2);ctx.fill();ctx.fillStyle=palette[1];ctx.beginPath();ctx.moveTo(298,0);ctx.lineTo(512,0);ctx.lineTo(512,150);ctx.lineTo(405,202);ctx.closePath();ctx.fill();ctx.fillStyle=palette[0];for(let i=0;i<5;i++)ctx.fillRect(290+i*36,168-(i%2)*14,22,88);}
  else{ctx.fillStyle=palette[2];ctx.fillRect(0,171,512,85);ctx.fillStyle=palette[1];ctx.beginPath();ctx.moveTo(0,172);ctx.lineTo(92,116);ctx.lineTo(163,174);ctx.lineTo(257,90);ctx.lineTo(365,177);ctx.lineTo(447,120);ctx.lineTo(512,157);ctx.lineTo(512,186);ctx.lineTo(0,186);ctx.fill();ctx.fillStyle=palette[3];for(let i=0;i<7;i++){const x=28+i*76;ctx.beginPath();ctx.ellipse(x,207+(i%3)*12,38,9,(i%2-.5)*.2,0,Math.PI*2);ctx.fill();}ctx.fillStyle=palette[4];ctx.beginPath();ctx.arc(393,66,25,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='rgba(48,39,31,.28)';for(let i=0;i<28;i++){const x=(seed+i*97)%512,y=((seed>>>7)+i*53)%256;ctx.fillRect(x,y,3+(i%5),2+(i%3));}
}
function addNarrativeStatue(THREE,group,piece,face,stone){
  const ids=face.narrative.participantIds.length?face.narrative.participantIds:[piece.subjectId??0],count=Math.min(6,ids.length),scene=narrativeSceneType(face.narrative),width=Math.max(.75,count*.3),base=new THREE.Mesh(new THREE.BoxGeometry(width,.42,.75),stone);base.position.y=.21;group.add(base);
  for(let i=0;i<count;i++){const x=(i-(count-1)/2)*.27,role=narrativeRoleForParticipant(face.narrative,ids[i]),body=new THREE.Mesh(new THREE.CylinderGeometry(.12,.17,.52,7),stone),head=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),stone);body.position.set(x,role==='victim'?.61:.74,0);head.position.set(x,role==='victim'?.99:1.12,0);if(role==='antagonist')body.rotation.z=-.16;group.add(body,head);for(const side of [-1,1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.08,role==='victim'?.24:.35,.1),stone);leg.position.set(x+side*.07,role==='victim'?.27:.42,0);group.add(leg);const raised=role==='leader'&&(side===-1)||!face.narrative.participantRoles?.length&&(scene==='protest'||scene==='celebration');const arm=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.34,6),stone);arm.position.set(x+side*.19,raised?1.02:role==='victim'?.55:.77,0);arm.rotation.z=raised?side*.25:role==='witness'&&side===1?-.1:role==='rescuer'?side*.55:role==='antagonist'?side*.1:side*.82;group.add(arm);}}
}
function addArtPlaque(THREE,group,message){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const ctx=canvas.getContext('2d');ctx.fillStyle='#40372e';ctx.fillRect(0,0,512,160);ctx.fillStyle='#d4bd8e';ctx.fillRect(8,8,496,144);ctx.fillStyle='#3a3025';ctx.fillRect(16,16,480,128);ctx.fillStyle='#f3ead3';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 34px sans-serif';const words=String(message).split(/\s+/);let lines=[],line='';for(const word of words){if(line&&ctx.measureText(`${line} ${word}`).width>440){lines.push(line);line=word;}else line=line?`${line} ${word}`:word;}if(line)lines.push(line);const visible=lines.slice(0,3),lineH=39,start=80-(visible.length-1)*lineH/2;visible.forEach((text,i)=>drawPixelText(ctx,text,256,start+i*lineH,448));const texture=new THREE.CanvasTexture(canvas);texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;const plaque=new THREE.Mesh(new THREE.PlaneGeometry(.72,.3),new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide}));plaque.position.set(0,.48,.39);group.add(plaque);
}
function addArtDisplayStand(THREE,group,{width=1.55,height=1.55,color=0x76543a}={}){
  const wood=new THREE.MeshLambertMaterial({color}),foot=new THREE.MeshLambertMaterial({color:0x51402f});
  for(const x of [-width*.42,width*.42]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.075,height,.075),wood);leg.position.set(x,height/2,0);group.add(leg);const base=new THREE.Mesh(new THREE.BoxGeometry(.22,.08,.2),foot);base.position.set(x,.04,0);group.add(base);}
  for(const y of [.12,.42,height-.12]){const brace=new THREE.Mesh(new THREE.BoxGeometry(width*.9,.06,.07),wood);brace.position.set(0,y,0);group.add(brace);}
}
function artworkWallExists(building,unit,side){
  if(!building||!unit)return false;
  const sides={north:[0,-1,1],east:[1,0,8],south:[0,1,2],west:[-1,0,4]},entry=buildingEntranceDoor(building),chosen=sides[side];if(!chosen)return false;
  const occupied=new Set([...(building.units||[]),...(building.circulation||[])].map(cell=>`${cell.x},${cell.y},${cell.z}`)),[dx,dy,bit]=chosen;
  if(occupied.has(`${unit.x+dx},${unit.y+dy},${unit.z}`))return false;
  if(entry?.unitId===unit.id&&entry.bit===bit)return false;
  if(buildingLeisureSpaces(building).some(space=>space.kind==='balcony'&&space.unitId===unit.id&&space.doorBit===bit))return false;
  if(unit.hasWindow&&unit.id!==entry?.unitId){let facade=0;for(const [x,y,mask]of [[0,-1,1],[1,0,8],[0,1,2],[-1,0,4]])if(!occupied.has(`${unit.x+x},${unit.y+y},${unit.z}`))facade|=mask;let blocked=entry?.unitId===unit.id?entry.bit:0;for(const space of buildingLeisureSpaces(building))if(space.kind==='balcony'&&space.unitId===unit.id)blocked|=space.doorBit;const safe=facade&~blocked,frontBack=safe&3,windowBit=frontBack?(frontBack&2?2:1):(safe&4?4:safe&8?8:0);if(windowBit===bit)return false;}
  return true;
}
function addMountedBanner(THREE,group,face,piece,{standalone=false}={}){
  const color=face.color??piece.color??0x8b4f3d,hex=`#${color.toString(16).padStart(6,'0')}`,frame=new THREE.MeshLambertMaterial({color:0x493d32}),bracket=new THREE.MeshLambertMaterial({color:0x8b795c});
  const width=standalone?.78:1.68,height=standalone?.38:.72;
  if(standalone)addArtDisplayStand(THREE,group,{width:.82,height:1.18});
  const rail=new THREE.Mesh(new THREE.BoxGeometry(width,.075,.09),frame),lowerRail=new THREE.Mesh(new THREE.BoxGeometry(width,.055,.08),frame),back=new THREE.Mesh(new THREE.BoxGeometry(width-.1,height,.055),frame);rail.position.set(0,1.13,.16);lowerRail.position.set(0,.65,.16);back.position.set(0,.89,.16);group.add(rail,lowerRail,back);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');if(face.design)drawArtworkComposition(ctx,face,0,0,512,256);else{ctx.fillStyle='#e8ddc7';ctx.fillRect(0,0,512,256);ctx.fillStyle=hex;ctx.fillRect(14,14,484,228);ctx.strokeStyle='#d6bf8a';ctx.lineWidth=8;ctx.strokeRect(25,25,462,206);ctx.fillStyle='#f5eddf';ctx.textAlign='center';ctx.textBaseline='middle';const words=String(face.message||piece.message).split(/\s+/);let lines=[],line='';ctx.font='bold 48px Georgia,serif';for(const word of words){if(line&&ctx.measureText(`${line} ${word}`).width>420){lines.push(line);line=word;}else line=line?`${line} ${word}`:word;}if(line)lines.push(line);const visible=lines.slice(0,3),lineHeight=57,start=128-(visible.length-1)*lineHeight/2;visible.forEach((value,index)=>drawPixelText(ctx,value,256,start+index*lineHeight,420));}const texture=new THREE.CanvasTexture(canvas);texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;const board=new THREE.Mesh(new THREE.PlaneGeometry(width-.12,height-.08),new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide}));board.position.set(0,.89,.192);group.add(board);
  if(!standalone)for(const x of [-.62,.62]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.055,.07,.31),bracket);arm.position.set(x,1.27,.08);const pin=new THREE.Mesh(new THREE.SphereGeometry(.055,6,5),bracket);pin.position.set(x,1.27,.22);group.add(arm,pin);}
}
function addPartyArtFlag(THREE,group,city,piece){
  const flag=city.politics?.party?.(piece.partyId)?.flag||piece.partyFlag||piece.design;if(!flag)return false;const pole=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,1.3,5),new THREE.MeshLambertMaterial({color:0x76664b}));pole.position.set(-.38,.65,0);group.add(pole);const base=new THREE.Mesh(new THREE.BoxGeometry(.2,.08,.2),new THREE.MeshLambertMaterial({color:0x51402f}));base.position.set(-.38,.04,0);group.add(base);let texture;const canvas=partyFlagCanvas(flag,()=>{if(texture)texture.needsUpdate=true;});texture=new THREE.CanvasTexture(canvas);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;const cloth=new THREE.Mesh(new THREE.PlaneGeometry(.72,.46),new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide}));cloth.position.set(.02,.97,.015);group.add(cloth);if(piece.message){const plaqueCanvas=document.createElement('canvas');plaqueCanvas.width=512;plaqueCanvas.height=96;const ctx=plaqueCanvas.getContext('2d');ctx.fillStyle='#493d32';ctx.fillRect(0,0,512,96);ctx.fillStyle='#f5eddf';ctx.textAlign='center';ctx.textBaseline='middle';drawPixelText(ctx,String(piece.message),256,48,470);const plaqueTexture=new THREE.CanvasTexture(plaqueCanvas);plaqueTexture.magFilter=plaqueTexture.minFilter=THREE.NearestFilter;plaqueTexture.generateMipmaps=false;plaqueTexture.colorSpace=THREE.SRGBColorSpace;const plaque=new THREE.Mesh(new THREE.PlaneGeometry(.88,.16),new THREE.MeshLambertMaterial({map:plaqueTexture,side:THREE.DoubleSide}));plaque.position.set(.04,.54,.018);group.add(plaque);}return true;
}
function drawArtworkComposition(ctx,face,x,y,w,h,{caption=true}={}){
  const design=face.design;if(!design)return false;const artH=caption?h*.76:h,flagW=Math.min(w*.89,(artH-h*.1)*120/76),flagH=flagW*76/120,flagX=x+(w-flagW)/2,flagY=y+h*.05+(artH-h*.1-flagH)/2;ctx.save();ctx.fillStyle='#eadfc9';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#493d32';ctx.lineWidth=Math.max(3,w*.018);ctx.strokeRect(x+2,y+2,w-4,h-4);drawPartyFlag(ctx,design,flagX,flagY,flagW,flagH,()=>drawArtworkComposition(ctx,face,x,y,w,h,{caption}));if(caption){ctx.fillStyle='#493d32';ctx.fillRect(x+w*.04,y+h*.81,w*.92,h*.15);ctx.fillStyle='#f5eddf';ctx.textAlign='center';ctx.textBaseline='middle';drawPixelText(ctx,String(face.message||''),x+w/2,y+h*.885,w*.86);}ctx.restore();return true;
}
export function drawArtworkPreview(ctx,piece){
  const face=piece.layers?.at(-1)||piece;ctx.clearRect(0,0,512,256);
  if(piece.kind==='painting'){
    if(face.design)drawArtworkComposition(ctx,face,0,0,512,256,{caption:false});
    else if(face.narrative){ctx.fillStyle='#665b4b';ctx.fillRect(0,0,512,256);drawArtNarrative(ctx,face.narrative);}
    else drawUntitledPainting(ctx,piece);
    return;
  }
  if(face.design){drawArtworkComposition(ctx,face,0,0,512,256);return;}
  if(['statue','monument'].includes(piece.kind)){
    const stone=`#${(piece.color??0x8a857a).toString(16).padStart(6,'0')}`;ctx.fillStyle='#d8cfbc';ctx.fillRect(0,0,512,256);ctx.fillStyle='#594b3c';ctx.fillRect(158,207,196,18);ctx.fillStyle=stone;
    if(piece.kind==='monument'){ctx.fillRect(204,100,104,107);ctx.fillRect(174,83,164,20);ctx.fillRect(220,61,72,22);}
    else{ctx.fillRect(218,121,76,86);ctx.beginPath();ctx.arc(256,91,38,0,Math.PI*2);ctx.fill();ctx.fillRect(198,194,116,13);}
    return;
  }
  if(piece.kind==='vase'){ctx.fillStyle='#d8cfbc';ctx.fillRect(0,0,512,256);ctx.fillStyle=`#${(piece.color??0xa65c43).toString(16).padStart(6,'0')}`;ctx.fillRect(196,85,120,22);ctx.beginPath();ctx.moveTo(207,105);ctx.lineTo(305,105);ctx.lineTo(289,184);ctx.lineTo(223,184);ctx.closePath();ctx.fill();ctx.fillRect(211,184,82,17);return;}
  ctx.fillStyle=piece.materialUsed==='fezes'?'#67432f':'#e8ddc7';ctx.fillRect(0,0,512,256);ctx.fillStyle=piece.materialUsed==='fezes'?'#f0ddbe':'#493d32';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 38px sans-serif';const words=String(face.message||piece.message||'').split(/\s+/);let lines=[],line='';for(const word of words){if(line&&ctx.measureText(`${line} ${word}`).width>448){lines.push(line);line=word;}else line=line?`${line} ${word}`:word;}if(line)lines.push(line);for(let i=0;i<Math.min(4,lines.length);i++)drawPixelText(ctx,lines[i],256,128+(i-(Math.min(4,lines.length)-1)/2)*44,448);
}
function addVariedStatue(THREE,group,piece,stone){
  const seed=(piece.id*2654435761)>>>0,variant=seed%6,base=new THREE.Mesh(new THREE.BoxGeometry(.62,.12,.62),new THREE.MeshLambertMaterial({color:0x665d51}));base.position.y=.06;group.add(base);
  const add=(geometry,material,x,y,z,sx=1,sy=1,sz=1,rz=0)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.z=rz;group.add(mesh);return mesh;};
  if(variant===0){add(new THREE.CylinderGeometry(.13,.28,1.05,6),stone,0,.66,0,.8,1,1,.12);add(new THREE.SphereGeometry(.23,7,5),stone,0,1.35,0,1,.92,.9);add(new THREE.CylinderGeometry(.3,.16,.12,6),stone,0,1.57,0,1,1,1,.18);}
  else if(variant===1){add(new THREE.BoxGeometry(.38,.72,.32),stone,0,.49,0,1,1,1,.08);add(new THREE.SphereGeometry(.22,7,5),stone,0,1.02,0,1,.95,.9);add(new THREE.CylinderGeometry(.28,.2,.11,7),stone,0,.88,0);}
  else if(variant===2){add(new THREE.ConeGeometry(.31,1.12,5),stone,0,.68,0,1,1,1,.24);add(new THREE.TorusGeometry(.22,.07,5,8),stone,0,1.23,0,1,1,1,.35);add(new THREE.SphereGeometry(.14,6,4),stone,.2,1.38,0);}
  else if(variant===3){add(new THREE.CylinderGeometry(.11,.16,.82,6),stone,0,.48,0,1,1,1,-.18);for(let i=0;i<3;i++){const leaf=add(new THREE.SphereGeometry(.22,6,4),stone,(i-1)*.18,1.03+Math.abs(i-1)*.12,0,.7,1.6,.45,(i-1)*-.55);leaf.rotation.y=(i-1)*.35;}add(new THREE.SphereGeometry(.13,6,4),stone,0,1.52,0,.8,1.25,.6);}
  else if(variant===4){add(new THREE.BoxGeometry(.2,.82,.2),stone,0,.53,0,1,1,1,.08);add(new THREE.BoxGeometry(.72,.18,.2),stone,0,.93,0,1,1,1,-.12);add(new THREE.SphereGeometry(.2,6,4),stone,0,1.25,0,1,1,.9);add(new THREE.ConeGeometry(.24,.35,5),stone,0,1.52,0);}
  else{add(new THREE.CylinderGeometry(.28,.18,.28,7),stone,0,.2,0);add(new THREE.CylinderGeometry(.2,.27,.28,7),stone,0,.48,0,1,1,1,.2);add(new THREE.CylinderGeometry(.27,.18,.28,7),stone,0,.76,0,1,1,1,-.14);add(new THREE.SphereGeometry(.18,6,4),stone,0,1.04,0);}
}
export function syncUrbanArt(renderer,THREE,city,world){
  const justice=city?.justice;if(!justice)return;const meshes=renderer.urbanArtMeshes??=new Map(),live=new Set(justice.art.filter(a=>!a.entity.destroyed||a.debris).map(a=>a.id));
  for(const [id,group]of meshes)if(!live.has(id)){renderer.scene.remove(group);group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();o.material?.map?.dispose();});meshes.delete(id);}
  for(const piece of justice.art){
    if(!piece.flagArtworkCleanupVersion){piece.design=null;for(const layer of piece.layers||[])layer.design=null;piece.flagArtworkCleanupVersion=1;}
    if(piece.entity.destroyed&&!piece.debris||!piece.entity.destroyed&&piece.campaignDecorationId&&!piece.layers.length)continue;
    const face=piece.layers.at(-1)||piece,legacyBannerSupport=!piece.entity.destroyed&&piece.kind==='banner'&&!piece.support&&!piece.campaignDecorationId&&piece.buildingId!=null?buildingFacadeBannerSupport(city.building(piece.buildingId),{isRoadAt:(x,y)=>isRoadAt(world,x,y)}):null;let support=piece.support||legacyBannerSupport;
    if(!piece.entity.destroyed&&support?.kind==='interior-wall'){
      const building=city.building(support.buildingId),unit=city.units.get(support.unitId);
      if(!artworkWallExists(building,unit,support.side)){
        if(building&&unit)support=piece.support={kind:'interior-floor',buildingId:building.id,unitId:unit.id,floor:unit.z};
        else{support=null;piece.support=null;piece.buildingId=null;piece.scene=null;}
      }
    }
    let x=piece.entity.x,y=piece.entity.y,group=meshes.get(piece.id);
    if(support?.kind==='interior-wall'||support?.kind==='interior-floor'){
      if(group){renderer.scene.remove(group);group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();o.material?.map?.dispose();});meshes.delete(piece.id);}
      continue;
    }
    if(!piece.entity.destroyed&&!support&&!piece.campaignDecorationId){
      const tx=Math.floor(x),ty=Math.floor(y),insideBuilding=city.buildings.some(building=>!building.entity.destroyed&&x>=building.entity.x&&x<building.entity.x+building.width&&y>=building.entity.y&&y<building.entity.y+building.depth),needsSidewalk=piece.buildingId==null,invalid=isRoadAt(world,tx,ty)||insideBuilding||needsSidewalk&&!world.hasSidewalk?.(tx,ty);
      if(invalid){const point=city.gigs?.sidewalkArtworkPoint({entity:{x,y}});if(!point){if(group)group.visible=false;continue;}x=piece.x=piece.entity.x=point.x;y=piece.y=piece.entity.y=point.y;}
    }
    const streetFacing=!piece.entity.destroyed&&!support&&!piece.campaignDecorationId&&piece.buildingId==null?artworkStreetFacingRotation(world,x,y,piece.id):null;
    const key=`${piece.id}:${piece.entity.destroyed?'debris':`${piece.layers.length}:${face.message}:${piece.damaged}:${piece.materialUsed||''}:${piece.color??''}:${JSON.stringify(face.narrative||null)}:${JSON.stringify(face.design||null)}`}:${JSON.stringify(support||null)}`;
    if(group?.userData.key!==key){if(group){renderer.scene.remove(group);group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();o.material?.map?.dispose();});}group=new THREE.Group();
      if(piece.entity.destroyed){const seed=(piece.id*2654435761)>>>0,masonry=['statue','monument'].includes(piece.kind),stone=new THREE.MeshLambertMaterial({color:piece.damaged>0?0x716d64:piece.color??0x8a857a}),dark=new THREE.MeshLambertMaterial({color:0x625e57});for(let i=0;i<7;i++){const n=(seed+i*1013904223)>>>0,angle=(n%6283)/1000,radius=.12+((n>>>8)%100)/220,width=.12+((n>>>16)%14)/100,height=masonry?.08+((n>>>20)%18)/100:.018,depth=.12+((n>>>24)%14)/100,fragment=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),i%3===0&&masonry?dark:stone);fragment.position.set(Math.cos(angle)*radius,height*.5,Math.sin(angle)*radius);fragment.rotation.set(masonry?((n>>>4)%80)/100:0,angle,masonry?((n>>>12)%80)/100:0);group.add(fragment);}}
      else if(['statue','monument'].includes(piece.kind)){const palettes={pedra:0x8a857a,argila:0xa76545,ferro:0x55595b,aco:0x89939a,ceramica:0xb97a58,fezes:0x49301f},stone=new THREE.MeshLambertMaterial({color:piece.damaged>0?0x716d64:palettes[piece.materialUsed]??piece.color});if(piece.materialUsed==='fezes'){const base=new THREE.Mesh(new THREE.BoxGeometry(.62,.16,.62),new THREE.MeshLambertMaterial({color:0x55402e}));base.position.y=.08;group.add(base);for(let i=0;i<5;i++){const blob=new THREE.Mesh(new THREE.SphereGeometry(.16+(i%2)*.04,7,5),stone);blob.position.set(((i%3)-1)*.17,.24+Math.floor(i/3)*.13,((i*2)%3-1)*.13);blob.scale.set(1,.72,1);group.add(blob);}}else if(face.narrative)addNarrativeStatue(THREE,group,piece,face,stone);else if(piece.subjectId!=null)addNarrativeStatue(THREE,group,piece,{narrative:{participantIds:[piece.subjectId],participantRoles:[],title:'Retrato'}},stone);else addVariedStatue(THREE,group,piece,stone);addArtPlaque(THREE,group,face.message);}
      else if(piece.kind==='vase'){const ceramic=new THREE.MeshLambertMaterial({color:piece.color??0xa65c43}),dark=new THREE.MeshLambertMaterial({color:0x49352d}),body=new THREE.Mesh(new THREE.CylinderGeometry(.16,.28,.48,9),ceramic),foot=new THREE.Mesh(new THREE.CylinderGeometry(.19,.22,.08,9),dark),rim=new THREE.Mesh(new THREE.CylinderGeometry(.29,.22,.09,9),ceramic),lip=new THREE.Mesh(new THREE.TorusGeometry(.25,.035,6,12),dark);body.position.y=.29;foot.position.y=.04;rim.position.y=.56;lip.position.y=.62;lip.rotation.x=Math.PI/2;group.add(body,foot,rim,lip);for(let i=0;i<5;i++){const bead=new THREE.Mesh(new THREE.SphereGeometry(.045,6,4),i%2?dark:new THREE.MeshLambertMaterial({color:0xe0bf79}));const angle=i*Math.PI*2/5;bead.position.set(Math.cos(angle)*.26,.31,Math.sin(angle)*.26);group.add(bead);}}
      else if(piece.kind==='flags'&&!face.narrative&&!addPartyArtFlag(THREE,group,city,piece)){const compact=!['facade-banner','interior-wall','window'].includes(support?.kind);if(compact)addArtDisplayStand(THREE,group,{width:.82,height:1.18});const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');if(face.design)drawArtworkComposition(ctx,face,0,0,512,256);else{const colors=[0xd84d43,0xe8bd43,0x4d9b67,0x4b78b6,0xbd5a9b];for(let i=0;i<5;i++){const pennant=new THREE.Shape();pennant.moveTo(-.16,.11);pennant.lineTo(.16,.11);pennant.lineTo(0,-.22);pennant.closePath();const mesh=new THREE.Mesh(new THREE.ShapeGeometry(pennant),new THREE.MeshLambertMaterial({color:colors[i],side:THREE.DoubleSide}));mesh.position.set(-.78+i*.39,1.32-Math.abs(2-i)*.035,.018);group.add(mesh);}ctx.fillStyle='#654a35';ctx.fillRect(0,0,512,128);ctx.fillStyle='#f5e5c4';ctx.textAlign='center';ctx.textBaseline='middle';drawPixelText(ctx,String(face.message),256,64,470);}const texture=new THREE.CanvasTexture(canvas);texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;const plaque=new THREE.Mesh(new THREE.PlaneGeometry(compact ? .72 : 1.72,compact ? .34 : .76),new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide}));plaque.position.set(0,compact?.86:.86,.01);group.add(plaque);}
      else if(piece.kind==='banner')addMountedBanner(THREE,group,face,piece,{standalone:!['facade-banner','interior-wall','window'].includes(support?.kind)});
      else if(piece.kind==='painting'&&piece.materialUsed!=='fezes'){
        const compact=!['facade-banner','interior-wall','window'].includes(support?.kind);if(compact)addArtDisplayStand(THREE,group,{width:1.32,height:1.48});
        const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');
        if(face.design)drawArtworkComposition(ctx,face,0,0,512,256,{caption:false});else if(face.narrative){ctx.fillStyle='#665b4b';ctx.fillRect(0,0,512,256);drawArtNarrative(ctx,face.narrative);}else drawUntitledPainting(ctx,piece);
        const texture=new THREE.CanvasTexture(canvas);texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;
        const width=compact?1.14:1.72,height=compact?.72:1.02,frame=new THREE.MeshLambertMaterial({color:0x554332}),canvasMaterial=new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide});
        for(const [w,h,x,y]of [[width,.055,0,height/2],[width,.055,0,-height/2],[.055,height,-width/2,0],[.055,height,width/2,0]]){const rail=new THREE.Mesh(new THREE.BoxGeometry(w,h,.055),frame);rail.position.set(x,1.2+y,.025);group.add(rail);}
        const panel=new THREE.Mesh(new THREE.PlaneGeometry(width-.08,height-.08),canvasMaterial);panel.position.set(0,1.2,.055);group.add(panel);
      }
      else if(piece.materialUsed==='fezes'){const compact=!['facade-banner','interior-wall','window'].includes(support?.kind);if(compact)addArtDisplayStand(THREE,group,{width:.82,height:1.18});const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d'),base=piece.color??0x67432f;for(let i=0;i<18;i++){const seed=(piece.id*2654435761+i*1013904223)>>>0,x=54+(seed%404),y=35+((seed>>>9)%186),rx=7+((seed>>>17)%24),ry=4+((seed>>>23)%15);ctx.fillStyle=`rgba(${(base>>16)&255},${(base>>8)&255},${base&255},${.2+((seed>>>4)%5)*.1})`;ctx.beginPath();ctx.ellipse(x,y,rx,ry,(seed%100)/100,0,Math.PI*2);ctx.fill();}ctx.strokeStyle=`#${base.toString(16).padStart(6,'0')}`;ctx.lineWidth=13;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(70,190);ctx.quadraticCurveTo(180,70,275,155);ctx.quadraticCurveTo(350,220,445,65);ctx.stroke();ctx.fillStyle='#f0ddbe';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 43px sans-serif';drawPixelText(ctx,String(face.message),256,126,455);const texture=new THREE.CanvasTexture(canvas);texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;const panel=new THREE.Mesh(new THREE.PlaneGeometry(compact ? .78 : 2.1,compact ? .38 : 1),new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide,transparent:true,alphaTest:.04,depthWrite:false}));panel.position.y=compact?1:1.05;group.add(panel);}
      else{const compact=!['facade-banner','interior-wall','window'].includes(support?.kind);if(compact)addArtDisplayStand(THREE,group,{width:.82,height:1.18});const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d'),background=`#${(face.color??piece.color).toString(16).padStart(6,'0')}`;if(face.design&&!face.narrative)drawArtworkComposition(ctx,face,0,0,512,256);else{ctx.fillStyle=background;ctx.fillRect(0,0,512,256);ctx.fillStyle='rgba(0,0,0,.23)';ctx.fillRect(14,14,484,228);if(face.narrative)drawArtNarrative(ctx,face.narrative);ctx.fillStyle='#f3ead3';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 42px sans-serif';const words=String(face.message).split(/\s+/);let lines=[],line='';for(const word of words){if(line&&ctx.measureText(`${line} ${word}`).width>440){lines.push(line);line=word;}else line=line?`${line} ${word}`:word;}if(line)lines.push(line);const lineH=52,start=face.narrative?46:128-(lines.length-1)*lineH/2;for(let i=0;i<lines.length&&i<(face.narrative?2:4);i++)drawPixelText(ctx,lines[i],256,start+i*lineH,448);}const texture=new THREE.CanvasTexture(canvas);texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;const material=new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide});const width=compact ? .78 : 2.1,height=compact ? .38 : 1;const panel=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);panel.position.y=compact?1:piece.kind==='graffiti'?1.05:1.35;group.add(panel);if(piece.kind==='banner'){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,1.9,5),new THREE.MeshLambertMaterial({color:0x76664b}));pole.position.set(-width*.52,.95,0);group.add(pole);}}
      group.userData.key=key;group.renderOrder=30;group.traverse(object=>{object.frustumCulled=false;if(object.isMesh)object.renderOrder=30;});meshes.set(piece.id,group);renderer.scene.add(group);
    }
    if(piece.entity.destroyed){
      const debrisX=piece.debris?.x??x,debrisY=piece.debris?.y??y;
      group.position.set(debrisX,surfaceElevation(world,debrisX,debrisY)+.025,debrisY);group.visible=debrisX>=(renderer.renderedMinTx??-Infinity)-2&&debrisX<=(renderer.renderedMaxTx??Infinity)+2&&debrisY>=(renderer.renderedMinTy??-Infinity)-2&&debrisY<=(renderer.renderedMaxTy??Infinity)+2;
    }
    else if(support?.kind==='facade-banner'){
      const building=city.building(support.buildingId),point=support.position;if(!building||building.entity.destroyed||!point){group.visible=false;continue;}
      group.position.set(point.x,(building.terrain?.base??surfaceElevation(world,point.x,point.y))+.7,point.y);group.rotation.y=support.rotation??piece.rotation??0;
      group.visible=point.x>=(renderer.renderedMinTx??-Infinity)-2&&point.x<=(renderer.renderedMaxTx??Infinity)+2&&point.y>=(renderer.renderedMinTy??-Infinity)-2&&point.y<=(renderer.renderedMaxTy??Infinity)+2;
    }
    else if(support?.kind==='skybridge'){
      const bridge=(city.skybridgeLinksForRevision?.()||[]).find(item=>item.id===support.linkId),building=city.building(support.buildingId);if(!bridge||!building||building.entity.destroyed){group.visible=false;continue;}
      group.position.set(x,(building.terrain?.base??surfaceElevation(world,x,y))+(support.position?.z??bridge.height),y);group.rotation.y=bridge.axis==='x'?(piece.rotation||0):(piece.rotation||0)+Math.PI/2;
      group.visible=x>=(renderer.renderedMinTx??-Infinity)-2&&x<=(renderer.renderedMaxTx??Infinity)+2&&y>=(renderer.renderedMinTy??-Infinity)-2&&y<=(renderer.renderedMaxTy??Infinity)+2;
    }
    else if(support?.kind==='roof-terrace'){
      const building=city.building(support.buildingId);if(!building||building.entity.destroyed){group.visible=false;continue;}
      const top=support.position?.z??(building.floors||1)*CITY_FLOOR_HEIGHT+.23;group.position.set(x,(building.terrain?.base??surfaceElevation(world,x,y))+top,y);group.rotation.y=piece.rotation||0;
      group.visible=x>=(renderer.renderedMinTx??-Infinity)-2&&x<=(renderer.renderedMaxTx??Infinity)+2&&y>=(renderer.renderedMinTy??-Infinity)-2&&y<=(renderer.renderedMaxTy??Infinity)+2;
    }
    else if(support?.kind==='window'){
      const building=city.building(support.buildingId),unit=city.units.get(support.unitId),floor=unit?.z??support.floor??0;if(!building||!unit){group.visible=false;continue;}
      const edge=support.side==='north'?{x:unit.x+.5,y:unit.y-.015}:support.side==='east'?{x:unit.x+1.015,y:unit.y+.5}:support.side==='south'?{x:unit.x+.5,y:unit.y+1.015}:{x:unit.x-.015,y:unit.y+.5};
      group.position.set(building.entity.x+edge.x,(building.terrain?.base??surfaceElevation(world,x,y))+floor*CITY_FLOOR_HEIGHT+.55,building.entity.y+edge.y);group.rotation.y=support.rotation??piece.rotation??0;
      group.visible=x>=(renderer.renderedMinTx??-Infinity)-2&&x<=(renderer.renderedMaxTx??Infinity)+2&&y>=(renderer.renderedMinTy??-Infinity)-2&&y<=(renderer.renderedMaxTy??Infinity)+2;
    }
    else{group.position.set(x,surfaceElevation(world,x,y)+.04,y);group.rotation.y=streetFacing??piece.rotation??0;group.visible=!Number.isFinite(renderer.renderedMinTx)||x>=renderer.renderedMinTx-2&&x<=renderer.renderedMaxTx+2&&y>=renderer.renderedMinTy-2&&y<=renderer.renderedMaxTy+2;}
  }
}
export function syncRoadBridges(renderer,THREE,world){
  const bridges=world.roadBridges||[],revision=world.bridgeRevision||0;
  if(renderer.roadBridgeRevision===revision&&renderer.roadBridgeStyleVersion===3)return;
  if(renderer.roadBridgeGroup){renderer.scene.remove(renderer.roadBridgeGroup);renderer.roadBridgeGroup.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  const group=new THREE.Group();
  for(let bridgeIndex=0;bridgeIndex<bridges.length;bridgeIndex++){
    const bridge=bridges[bridgeIndex],variant=((bridgeIndex*7+(bridge.tiles?.length||0))%3),timber=variant===1,painted=variant===2,
      deckColor=timber?0x806047:painted?0xb8a27d:0xb2aa95,railColor=timber?0x493b31:painted?0x426c68:0x343a38,capColor=timber?0xc39a67:painted?0xe1ce9c:0xddd0b4,
      deckMaterial=new THREE.MeshLambertMaterial({color:deckColor}),railMaterial=new THREE.MeshLambertMaterial({color:railColor}),capMaterial=new THREE.MeshLambertMaterial({color:capColor});
    const model=new THREE.Group(),deckParts=new THREE.Group(),decorParts=new THREE.Group();
    const horizontal=bridge.axis==='x',tiles=bridge.tiles||[];
    for(let i=0;i<tiles.length;i++){const tile=tiles[i];
      if(!Number.isInteger(tile.x)||!Number.isInteger(tile.y)||tile.x<0||tile.y<0||tile.x>=world.width||tile.y>=world.height)continue;
      const height=bridge.height??.8,deck=new THREE.Mesh(new THREE.BoxGeometry(horizontal?.98:.86,.2,horizontal?.86:.98),deckMaterial);
      deck.position.set(tile.x+.5,height-.1,tile.y+.5);deck.receiveShadow=true;deck.castShadow=true;deckParts.add(deck);
      if(timber){
        const boardCount=3;for(let board=0;board<boardCount;board++){const offset=(board-(boardCount-1)/2)*.25,plank=new THREE.Mesh(new THREE.BoxGeometry(horizontal?.86:.055,.025,horizontal?.055:.86),capMaterial);plank.position.set(tile.x+.5+(horizontal?0:offset),height+.012,tile.y+.5+(horizontal?offset:0));decorParts.add(plank);}
      }
      for(const side of [-.38,.38]){
        const rail=timber?new THREE.Mesh(new THREE.BoxGeometry(horizontal?.98:.07,.07,horizontal?.07:.98),railMaterial):new THREE.Mesh(new THREE.BoxGeometry(horizontal?.98:.12,.48,horizontal?.12:.98),railMaterial);
        rail.position.set(tile.x+.5+(horizontal?0:side),height+(timber?.28:.14),tile.y+.5+(horizontal?side:0));decorParts.add(rail);
        const cap=new THREE.Mesh(new THREE.BoxGeometry(horizontal?.98:.15,.055,horizontal?.15:.98),capMaterial);cap.position.set(tile.x+.5+(horizontal?0:side),height+(timber?.34:.4),tile.y+.5+(horizontal?side:0));decorParts.add(cap);
        if(timber||i===0||i===tiles.length-1||i%2===0){
          const post=new THREE.Mesh(new THREE.BoxGeometry(horizontal?.09:.12,.62,horizontal?.12:.09),railMaterial);post.position.set(tile.x+.5+(horizontal?0:side),height+.25,tile.y+.5+(horizontal?side:0));decorParts.add(post);
          if(!timber&&i%2===0){const finial=new THREE.Mesh(new THREE.SphereGeometry(.075,6,5),capMaterial);finial.position.set(tile.x+.5+(horizontal?0:side),height+.62,tile.y+.5+(horizontal?side:0));decorParts.add(finial);}
        }
      }
    }
    if(tiles.length){for(const end of [tiles[0],tiles.at(-1)]){const height=bridge.height??.8,abutment=new THREE.Mesh(new THREE.BoxGeometry(horizontal?.24:.95,.42,horizontal?.95:.24),new THREE.MeshLambertMaterial({color:0xc5b99e}));abutment.position.set(end.x+.5,height-.28,end.y+.5);decorParts.add(abutment);}}
    mergeStaticMeshes(THREE,deckParts);mergeStaticMeshes(THREE,decorParts);model.add(deckParts,decorParts);group.add(model);
  }
  renderer.roadBridgeGroup=group;renderer.roadBridgeRevision=revision;renderer.roadBridgeStyleVersion=3;renderer.scene.add(group);
}
// Room coordinates count floors; render their physical height consistently with picking.

function syncBuildingDetailBatch(renderer,THREE,key,active){
  const sources=renderer._buildingDetailSources??=[];sources.length=0;let count=0,signature='';
  for(const [id,group]of renderer.cityMeshes){
    if(!active.has(id)||!group.visible)continue;
    const source=group.userData[key];if(!source)continue;
    sources.push({group,source});count+=source.count;
    signature+=`${id}:${group.position.x},${group.position.y},${group.position.z}:${group.userData.terrainRevision}:${source.id}:${source.count}|`;
  }
  let batch=renderer[key+'Batch'];
  if(!batch){
    const geometry=renderer[key+'BatchGeometry']??=(key==='supports'?new THREE.BoxGeometry(.2,1,.2):key==='stairs'?new THREE.BoxGeometry(.8,1,.22):new THREE.BoxGeometry(1,.06,1));
    const material=renderer[key+'BatchMaterial']??=(key==='supports'?new THREE.MeshLambertMaterial({color:0x68756a}):key==='stairs'?new THREE.MeshLambertMaterial({color:0x9f9076}):new THREE.MeshLambertMaterial({color:0x928571}));
    batch=new THREE.InstancedMesh(geometry,material,Math.max(64,count));batch.count=0;batch.castShadow=key==='supports';batch.receiveShadow=true;batch.frustumCulled=false;renderer.scene.add(batch);renderer[key+'Batch']=batch;
  }
  if(signature===batch.userData.signature)return;
  if(count>batch.instanceMatrix.count){
    const capacity=2**Math.ceil(Math.log2(count)),replacement=new THREE.InstancedMesh(batch.geometry,batch.material,capacity);replacement.count=0;replacement.castShadow=key==='supports';replacement.receiveShadow=true;replacement.frustumCulled=false;renderer.scene.remove(batch);renderer.scene.add(replacement);renderer[key+'Batch']=batch=replacement;
  }
  const matrix=new THREE.Matrix4();let index=0;
  for(const {group,source}of sources)for(let i=0;i<source.count;i++){
    source.getMatrixAt(i,matrix);matrix.elements[12]+=group.position.x;matrix.elements[13]+=group.position.y;matrix.elements[14]+=group.position.z;batch.setMatrixAt(index++,matrix);
  }
  batch.count=count;batch.visible=count>0;batch.userData.signature=signature;
  if(count)batch.instanceMatrix.needsUpdate=true;
}

export function syncCityBuildings(renderer, THREE, entities, world, dt=1/60) {
  renderer.parkPalmWindDecorations??=new Map();
  const oilCarriers=renderer.cityOilCarriers??=new Set();oilCarriers.clear();
  for(const shipment of renderer.cityLogistics?.shipments||[])if(shipment.good==='oleo'&&shipment.pickedUp&&shipment.driverId!=null)oilCarriers.add(shipment.driverId);
  syncConstructionSites(renderer,THREE,world,renderer.cityDevelopment);
  syncCampaignDecorations(renderer,THREE,entities,world);
  syncCityMobility(renderer,THREE,entities,world);
  syncSkybridges(renderer,THREE,entities,world);
  syncRoadBridges(renderer,THREE,world);
  syncCardboardShelters(renderer,THREE,renderer.cityDevelopment?.city,world);
  syncCorpseVisuals(renderer,THREE,renderer.cityDevelopment?.city,world);
  syncImportDepotVisual(renderer,THREE,renderer.cityDevelopment?.city,world);
  syncUrbanArt(renderer,THREE,renderer.cityDevelopment?.city,world);
  syncFecesVisuals(renderer,THREE,renderer.cityDevelopment?.city,world);
  syncStreetBenches(renderer,THREE,world);
  syncBeachLeisureProps(renderer,THREE,world);
  syncStreetMarketStalls(renderer,THREE,world);
  const map = world.map;
  const perspectiveView=!!renderer.isPerspectiveActive?.(),viewMargin=perspectiveView?3:0;
  const inView=(x,y,width=0,depth=0)=>!Number.isFinite(renderer.renderedMinTx) || (perspectiveView
    ?x+width>=renderer.renderedMinTx-viewMargin&&x<=renderer.renderedMaxTx+1+viewMargin&&y+depth>=renderer.renderedMinTy-viewMargin&&y<=renderer.renderedMaxTy+1+viewMargin
    :x>=renderer.renderedMinTx&&x+width<=renderer.renderedMaxTx+1&&y>=renderer.renderedMinTy&&y+depth<=renderer.renderedMaxTy+1);
  renderer.lampMeshes ??= new Map();
  const cityNightLights=renderer.cityNightLights??=[];cityNightLights.length=0;
  const liveBuildings = new Set(entities.filter(e => e.properties?.cityBuilding && !e.destroyed).map(e => e.id));
  const sleepingFloorsByBuilding=new Map();
  for(const entity of entities){
    const citizen=entity.properties?.citizen,location=citizen?.indoorLocation;
    if(!location||!citizenIsSleeping(citizen))continue;
    let floors=sleepingFloorsByBuilding.get(location.buildingId);if(!floors){floors=new Set();sleepingFloorsByBuilding.set(location.buildingId,floors);}
    floors.add(location.floor??0);
  }
  renderer.sleepingFloorsByBuilding=sleepingFloorsByBuilding;
  const liveLamps = new Set();
  for (const post of world.cityLampPosts || []) {
    if (!post.built) continue;
    liveLamps.add(post.id);
    if(!inView(post.x,post.y)){const existing=renderer.lampMeshes.get(post.id);if(existing)existing.visible=false;}
    let lamp = renderer.lampMeshes.get(post.id);
    if(lamp&&lamp.userData.styleVersion!==3){renderer.scene.remove(lamp);lamp.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});renderer.lampMeshes.delete(post.id);lamp=null;}
    if (!lamp) {
      lamp = new THREE.Group();lamp.userData.styleVersion=3;
      let lampHash=0;for(const char of String(post.id))lampHash=Math.imul(lampHash^char.charCodeAt(0),16777619);const variant=(lampHash>>>0)%3,dark=variant===1?0x373a36:variant===2?0x42655f:0x30383a,metal=new THREE.MeshLambertMaterial({color:dark}),gold=new THREE.MeshLambertMaterial({color:variant===2?0xd3ad63:0xb79355}),glassMaterial=new THREE.MeshLambertMaterial({color:variant===2?0xe7c977:0xf1d99b,emissive:0x000000});
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .075, 2, 7), metal); pole.position.y = 1; lamp.add(pole);
      const foot=new THREE.Mesh(new THREE.CylinderGeometry(.11,.14,.13,8),gold);foot.position.y=.08;lamp.add(foot);
      const armPoints=variant===1?[new THREE.Vector3(0,1.82,0),new THREE.Vector3(0,2.05,0),new THREE.Vector3(0,2.18,0)]:[new THREE.Vector3(0,1.8,0),new THREE.Vector3(0,2.08,0),new THREE.Vector3(.18,2.23,0),new THREE.Vector3(.34,2.18,0)];
      const armCurve=new THREE.CatmullRomCurve3(armPoints),arm=new THREE.Mesh(new THREE.TubeGeometry(armCurve,8,.027,5,false),gold);lamp.add(arm);
      const lanternX=variant===1?0:.34,lampTop=new THREE.Group();lampTop.position.set(lanternX,variant===1?2.2:2.14,0);lamp.add(lampTop);
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(.22,.29,.22),glassMaterial);lantern.position.y=.02;lantern.userData.skipStaticMerge=true;lampTop.add(lantern);lamp.userData.lantern = lantern;
      for(const x of [-.115,.115])for(const z of [-.115,.115]){const frame=new THREE.Mesh(new THREE.BoxGeometry(.018,.31,.018),gold);frame.position.set(x,.02,z);lampTop.add(frame);}
      const lanternRoof=new THREE.Mesh(new THREE.ConeGeometry(.19,.16,4),gold);lanternRoof.position.y=.25;lanternRoof.rotation.y=Math.PI/4;lampTop.add(lanternRoof);
      const lanternBase=new THREE.Mesh(new THREE.BoxGeometry(.27,.055,.27),gold);lanternBase.position.y=-.15;lampTop.add(lanternBase);
      const finial=new THREE.Mesh(new THREE.SphereGeometry(.045,6,5),gold);finial.position.y=.35;lampTop.add(finial);
      if(variant===1){const crossbar=new THREE.Mesh(new THREE.BoxGeometry(.42,.035,.035),gold);crossbar.position.y=1.9;lamp.add(crossbar);}
      mergeStaticMeshes(THREE,lampTop);mergeStaticMeshes(THREE,lamp);
      renderer.scene.add(lamp); renderer.lampMeshes.set(post.id, lamp);
    }
    if(lamp.userData.terrainRevision!==world.revision||lamp.userData.x!==post.x||lamp.userData.y!==post.y||lamp.userData.height!==post.height){
      lamp.position.set(post.x,surfaceElevation(world,post.x,post.y)+(post.height||0),post.y);
      Object.assign(lamp.userData,{terrainRevision:world.revision,x:post.x,y:post.y,height:post.height});
    }
    lamp.userData.lantern.material.emissive.setHex(post.lit ? 0xffa52f : 0);
    lamp.visible = inView(post.x,post.y) && (!post.buildingId || liveBuildings.has(post.buildingId));
    if(post.lit&&lamp.visible)cityNightLights.push({x:lamp.position.x,y:lamp.position.y+2.1,z:lamp.position.z,color:0xffbc63,distance:10,decay:2,intensity:2.6,priority:-2,distSq:(post.x-(renderer.camX||0))**2+(post.y-(renderer.camY||0))**2});
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
    if(b.constructionKind!=='open-air'||b.type==='market')b.architecture=architectureFor(b.type,b.id);
    if(!inView(entity.x,entity.y,b.width,b.depth)){const existing=renderer.cityMeshes.get(entity.id);if(existing)existing.visible=false;continue;}
    if ((b.constructionKind === 'open-air' && b.type !== 'market') || b.type === 'greengrocer') { syncOpenAir(renderer, THREE, entity, b, world); continue; }
    let group = renderer.cityMeshes.get(entity.id);
    const bridgeDoors=renderer.skybridgeDoors?.get(b.id),bridgeDoorKey=bridgeDoors?[...bridgeDoors].map(([id,mask])=>`${id}:${mask}`).join('|'):'';
    if (group && (group.userData.buildingStyleVersion!==29 || group.userData.bridgeDoorKey!==bridgeDoorKey || group.userData.floorCount !== b.floors || group.userData.layoutRevision !== (b.layoutRevision||0) || group.userData.rotation !== (b.rotation||0)||group.userData.paintRevision!==(b.paintRevision||0)||group.userData.campaignPaintId!==(b.campaignPaint?.id??null))) {
      renderer.parkPalmWindDecorations.delete(entity.id);
      renderer.cityMeshVisualRevision=(renderer.cityMeshVisualRevision||0)+1;
      renderer.scene.remove(group); group.traverse(object => { object.geometry?.dispose(); object.material?.dispose();object.userData.partyFlagTexture?.dispose();object.userData.mineSignTexture?.dispose();object.userData.marketSignTexture?.dispose(); }); renderer.cityMeshes.delete(entity.id); group = null;
    }
    if (!group) {
      renderer.cityMeshVisualRevision=(renderer.cityMeshVisualRevision||0)+1;
      group = new THREE.Group();group.userData.buildingStyleVersion=29;group.userData.cityBuilding=b;group.userData.bridgeDoorKey=bridgeDoorKey;group.userData.floorCount = b.floors;group.userData.paintRevision=b.paintRevision||0;group.userData.layoutRevision=b.layoutRevision||0;group.userData.rotation=b.rotation||0;group.userData.campaignPaintId=b.campaignPaint?.id??null;
      const material = buildingMaterial(renderer,THREE,'wall',0xffffff,buildingTextureVariant(b.id??entity.id));material.side=THREE.DoubleSide;material.vertexColors=true;material.needsUpdate=true;
      const style = HOUSE_STYLES[b.architecture] || HOUSE_STYLES.modern;
      const residential = ['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing'].includes(b.type),mine=['iron_mine','bauxite_mine','clay_pit','sand_pit'].includes(b.type);
      const matrix = new THREE.Matrix4(), color = new THREE.Color(style.wall);
      const cellMasks=new Map(),windowDetails=[],doorByUnit=new Map(bridgeDoors||[]),occupiedCells=new Set(b.units.map(u=>`${u.x},${u.y},${u.z}`)),leisureSpaces=buildingLeisureSpaces(b),sleepingFloors=sleepingFloorsByBuilding.get(b.id)||new Set();for(const cell of b.circulation||[])occupiedCells.add(`${cell.x},${cell.y},${cell.z}`);
      const entranceDoor=buildingEntranceDoor(b);if(entranceDoor)doorByUnit.set(entranceDoor.unitId,(doorByUnit.get(entranceDoor.unitId)||0)|entranceDoor.bit);
      for(const u of b.units)for(const [dx,dy,bit]of [[0,-1,1],[0,1,2],[-1,0,4],[1,0,8]])if(occupiedCells.has(`${u.x+dx},${u.y+dy},${u.z}`))doorByUnit.set(u.id,(doorByUnit.get(u.id)||0)|bit);
      for(const s of leisureSpaces)if(s.kind==='balcony')doorByUnit.set(s.unitId,(doorByUnit.get(s.unitId)||0)|s.doorBit);
      for (const u of b.units) {
        let facadeMask=0;if(!occupiedCells.has(`${u.x},${u.y-1},${u.z}`))facadeMask|=1;if(!occupiedCells.has(`${u.x},${u.y+1},${u.z}`))facadeMask|=2;if(!occupiedCells.has(`${u.x-1},${u.y},${u.z}`))facadeMask|=4;if(!occupiedCells.has(`${u.x+1},${u.y},${u.z}`))facadeMask|=8;
        const doorMask=doorByUnit.get(u.id)||0,safeWindowSides=facadeMask&~doorMask;
        let openingMask=0;
        if(u.hasWindow&&safeWindowSides&&u.id!==entranceDoor?.unitId){
          const frontBack=safeWindowSides&3;
          if(frontBack)openingMask=frontBack&2?2:1;
          else openingMask=safeWindowSides&4?4:8;
          if(openingMask){
            const sideName=({1:'back',2:'front',4:'left',8:'right'})[openingMask],localSide=facadeLocalSide(sideName,b.rotation),localCell=facadeLocalCell(b,u),along=localSide==='front'||localSide==='back'?localCell.x+.5:localCell.y+.5;
            const coveredByBalcony=leisureSpaces.some(space=>space.kind==='balcony'&&space.floor===u.z&&space.side===localSide&&Math.abs(along-(space.doorAlong??space.along))<=space.width/2+.16);
            if(coveredByBalcony)openingMask=0;
          }
        }
        if(openingMask&&(!(facadeMask&openingMask)||(doorMask&openingMask)))openingMask=0;
        if(openingMask)for(const [bit,side]of [[1,'back'],[2,'front'],[4,'left'],[8,'right']])if(openingMask&bit)windowDetails.push({unit:u,side,openingBit:bit,closed:sleepingFloors.has(u.z)});
        const key=`${facadeMask}:${openingMask}:${doorMask}`,bucket=cellMasks.get(key)||{units:[],facadeMask,openingMask,doorMask};bucket.units.push(u);cellMasks.set(key,bucket);
      }
      group.userData.windowCellKeys=new Set(windowDetails.map(({unit})=>`${unit.x},${unit.y},${unit.z}`));
      group.userData.balconyCellKeys=new Set(leisureSpaces.filter(space=>space.kind==='balcony').map(space=>b.units.find(unit=>unit.id===space.unitId)).filter(Boolean).map(unit=>`${unit.x},${unit.y},${unit.z}`));
      const doorFrames=new THREE.Group(),exteriorDoorFrames=new THREE.Group();group.add(doorFrames,exteriorDoorFrames);group.userData.doorFrames=doorFrames;group.userData.exteriorDoorFrames=exteriorDoorFrames;
      const doorStoneMaterial=new THREE.MeshLambertMaterial({color:style.trim}),doorAccentMaterial=new THREE.MeshLambertMaterial({color:style.accent});
      const addDoorFrame=(root,u,dx,dy)=>{const frame=new THREE.Group();for(const [x,y,w,h]of [[-.27,.78,.09,1.56],[.27,.78,.09,1.56],[0,1.58,.7,.12],[-.32,.08,.13,.16],[.32,.08,.13,.16]]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,.095),doorStoneMaterial);m.position.set(x,y,0);m.castShadow=m.receiveShadow=true;frame.add(m);}const keystone=new THREE.Mesh(new THREE.BoxGeometry(.16,.18,.12),doorAccentMaterial);keystone.position.set(0,1.67,0);keystone.castShadow=keystone.receiveShadow=true;frame.add(keystone);frame.position.set(u.x+.5+dx*.49,u.z*CITY_FLOOR_HEIGHT,u.y+.5+dy*.49);if(dx)frame.rotation.y=Math.PI/2;root.add(frame);};
      for(const u of b.units)for(const [bit,dx,dy]of [[1,0,-1],[2,0,1],[4,-1,0],[8,1,0]])if((doorByUnit.get(u.id)||0)&bit){addDoorFrame(doorFrames,u,dx,dy);if(entranceDoor?.unitId===u.id&&entranceDoor.bit===bit)addDoorFrame(exteriorDoorFrames,u,dx,dy);}
      for(const frames of [doorFrames,exteriorDoorFrames]){for(const frame of [...frames.children]){frame.updateMatrix();for(const mesh of [...frame.children]){mesh.updateMatrix();mesh.matrix.premultiply(frame.matrix);mesh.matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);frames.add(mesh);}frames.remove(frame);}mergeStaticMeshes(THREE,frames);}
      const cellSourcesByFloor=new Map();
      for(const {units,facadeMask,openingMask,doorMask} of cellMasks.values()){
        const source=roomCellGeometry(THREE,facadeMask,openingMask,doorMask);
        for(const unit of units){let list=cellSourcesByFloor.get(unit.z);if(!list)cellSourcesByFloor.set(unit.z,list=[]);list.push({source,unit});}
      }
      let totalCellVertices=0;for(const parts of cellSourcesByFloor.values())for(const {source}of parts)totalCellVertices+=source.attributes.position.count;
      const cellPositions=new Float32Array(totalCellVertices*3),cellNormals=new Float32Array(totalCellVertices*3),cellUvs=new Float32Array(totalCellVertices*2),cellColors=new Float32Array(totalCellVertices*3);let cellVertexOffset=0;
      for(const [floor,parts] of cellSourcesByFloor){
        const floorOffset=floor*CITY_FLOOR_HEIGHT+CITY_FLOOR_HEIGHT/2;
        for(const {source,unit} of parts){
          const sourcePositions=source.attributes.position.array,sourceNormals=source.attributes.normal.array,sourceUvs=source.attributes.uv.array,sourceColors=source.attributes.color.array,count=source.attributes.position.count,positionOffset=cellVertexOffset*3,uvOffset=cellVertexOffset*2;
          cellNormals.set(sourceNormals,positionOffset);cellUvs.set(sourceUvs,uvOffset);
          for(let i=0;i<count;i++){
            const at=i*3,out=positionOffset+at;
            cellPositions[out]=sourcePositions[at]+unit.x+.5;cellPositions[out+1]=sourcePositions[at+1]+floorOffset;cellPositions[out+2]=sourcePositions[at+2]+unit.y+.5;
            cellColors[out]=sourceColors[at]*color.r;cellColors[out+1]=sourceColors[at+1]*color.g;cellColors[out+2]=sourceColors[at+2]*color.b;
          }
          cellVertexOffset+=count;
        }
      }
      const cellGeometry=new THREE.BufferGeometry();
      cellGeometry.setAttribute('position',new THREE.BufferAttribute(cellPositions,3));cellGeometry.setAttribute('normal',new THREE.BufferAttribute(cellNormals,3));
      cellGeometry.setAttribute('uv',new THREE.BufferAttribute(cellUvs,2));cellGeometry.setAttribute('color',new THREE.BufferAttribute(cellColors,3));cellGeometry.computeBoundingSphere();
      const cells=new THREE.Mesh(cellGeometry,material);cells.castShadow=true;cells.receiveShadow=true;
      group.add(cells);const cellMeshes=[cells];
      for(const parts of cellSourcesByFloor.values())for(const {source} of parts)source.dispose();
      group.userData.cellMeshes=cellMeshes;
      const floorCells=[...b.units,...(b.circulation||[])],roomFloors=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.06,1),new THREE.MeshLambertMaterial({color:0x928571}),floorCells.length);
      for(let i=0;i<floorCells.length;i++){const unit=floorCells[i];matrix.makeTranslation(unit.x+.5,unit.z*CITY_FLOOR_HEIGHT-.03,unit.y+.5);roomFloors.setMatrixAt(i,matrix);}
      roomFloors.receiveShadow=true;roomFloors.castShadow=false;group.add(roomFloors);group.userData.roomFloors=roomFloors;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(b.width + .15, .14, b.depth + .15), buildingMaterial(renderer,THREE,'roof',mine?0x454b49:style.roof));
      roof.position.set(b.width / 2, b.floors*CITY_FLOOR_HEIGHT + .03, b.depth / 2); roof.castShadow = true; group.add(roof);group.userData.roof=roof;
      const facade=new THREE.Group(),origin=buildingPoint(b,0,0);facade.rotation.y=(b.rotation||0)*Math.PI/2;facade.position.set(origin.x,0,origin.y);group.add(facade);group.userData.facade=facade;
      {
      const b={...entity.properties.cityBuilding,...modelSize(entity.properties.cityBuilding)};
      if (residential) {
        const roofMaterial = buildingMaterial(renderer,THREE,'roof',style.roof);
        addBuildingRoof(THREE,facade,b,roofMaterial,style.roofKind,b.floors*CITY_FLOOR_HEIGHT+.1);
        if (b.architecture === 'timber') for (let z=0;z<=b.floors;z++) {
          const beam=new THREE.Mesh(new THREE.BoxGeometry(b.width+.04,.07,.08),new THREE.MeshLambertMaterial({color:0x594736}));
          beam.position.set(b.width/2,z*CITY_FLOOR_HEIGHT+.04,b.depth+.025);facade.add(beam);
        }
        if (b.architecture === 'hacienda') {
          for (const x of [.25,b.width-.25]) {const column=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,1.5,6),new THREE.MeshLambertMaterial({color:0xe7d9bf}));column.position.set(x,.75,b.depth+.12);facade.add(column);}
          const porch=new THREE.Mesh(new THREE.BoxGeometry(b.width,.1,.6),buildingMaterial(renderer,THREE,'roof',style.roof));porch.position.set(b.width/2,1.6,b.depth+.1);facade.add(porch);
        }
      } else if(['gable','hip','mansard','shed'].includes(style.roofKind)&&!mine) {
        // Carry the Portuguese clay-tile hipped roof profile across civic,
        // commercial and workshop buildings as well as homes.
        const roofMaterial=buildingMaterial(renderer,THREE,'roof',style.roof);
        addBuildingRoof(THREE,facade,b,roofMaterial,style.roofKind,b.floors*CITY_FLOOR_HEIGHT+.08);
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
          for(const x of [b.width/2-.9,b.width/2+.9]){const column=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,1.5,8),material);column.position.set(x,.75,b.depth+.2);facade.add(column);}
          const pediment=new THREE.Mesh(new THREE.ConeGeometry(1.3,.6,3),material);pediment.rotation.y=Math.PI/2;pediment.position.set(b.width/2,1.7,b.depth+.2);facade.add(pediment);

        }
      }
      addBuildingDetails(THREE,facade,b);
      const shellBuilding=entity.properties.cityBuilding,facadeWindowDetails=windowDetails.map(detail=>{
        const cell=facadeLocalCell(shellBuilding,detail.unit),side=facadeLocalSide(detail.side,shellBuilding.rotation);
        return {...detail,unit:{...detail.unit,...cell},side,openingBit:facadeSideBit(side)};
      });
      const entranceUnit=entranceDoor&&shellBuilding.units.find(unit=>unit.id===entranceDoor.unitId),entrySide=entranceDoor&&({1:'back',2:'front',4:'left',8:'right'})[entranceDoor.bit],localEntrySide=entrySide&&facadeLocalSide(entrySide,shellBuilding.rotation),localEntryCell=entranceUnit&&facadeLocalCell(shellBuilding,entranceUnit),entryDoorDetails=entranceUnit&&localEntryCell?{unit:{...entranceUnit,...localEntryCell},side:localEntrySide,bit:facadeSideBit(localEntrySide)}:null;
      addArchitectureVariations(THREE,facade,b,leisureSpaces,facadeWindowDetails,entryDoorDetails);
      group.userData.portugueseWindowShutters=facade.userData.portugueseWindowShutters||[];
      const entranceX=Math.floor(b.width/2)+.5;
      const awning = new THREE.Mesh(new THREE.BoxGeometry(1.1, .12, .7), new THREE.MeshLambertMaterial({ color: b.type === 'market' ? 0xdca14b : 0xc9d9a1 }));
      const awningColors = { super_popular_housing:0x987f68,popular_luxury_housing:0xb69868,popular_refectory: 0xd88a45, market: 0xdca14b, bakery: 0xc78b52, greengrocer: 0x75a956, clinic: 0xf0eee4, townhall: 0x7693ae, builder: 0xb87c3f, quarry: 0x777f83, luxury_housing: 0xc7a956, popular_housing: 0xa8734d };
      awning.material.color.setHex(awningColors[b.type] ?? 0xc9d9a1);
      if(!mine&&!style.motif&&b.type!=='courthouse'){awning.position.set(entranceX, 1.55, b.depth + .25); awning.castShadow = true; facade.add(awning);}
      }
      mergeStaticMeshes(THREE,facade,{mergeShadowFlags:true,recursive:true,filter:mesh=>{
        const material=mesh.material;
        return material?.isMeshLambertMaterial&&!material.map&&!material.alphaMap&&!material.transparent&&material.opacity===1&&material.alphaTest===0&&material.side===THREE.FrontSide&&material.emissive?.getHex()===0;
      }});
      const highlight = new THREE.Mesh(new THREE.BoxGeometry(1.02, CITY_FLOOR_HEIGHT+.02, 1.02), new THREE.MeshBasicMaterial({ color: 0xf0e6a1, wireframe: true }));
      highlight.visible = false; group.add(highlight); group.userData.highlight = highlight;
      const supports = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, 1, .2), new THREE.MeshLambertMaterial({ color: 0x68756a }), b.width * b.depth);
      supports.castShadow = true; supports.receiveShadow = true; group.add(supports); group.userData.supports = supports;
      const leisureProps=new THREE.Group();
      for(const space of buildingLeisureSpaces(b)){
        const center={x:b.width/2,y:b.depth/2},offsets=space.kind==='roof_terrace'?[[0,0],[.35,0],[-.35,0],[0,.35]]:[[0,0]];
        offsets.forEach(([dx,dy])=>{const worldX=space.position.x+dx,worldY=space.position.y+dy,item={type:'chair',x:worldX-b.entity.x,y:worldY-b.entity.y,z:space.floor,visualScale:.62,facing:{x:center.x,y:center.y}},model=furnitureModel(THREE,item),floorY=space.kind==='roof_terrace'?b.floors*CITY_FLOOR_HEIGHT:space.floor*CITY_FLOOR_HEIGHT;model.position.set(item.x,floorY,item.y);leisureProps.add(model);});
      }
      if(leisureProps.children.length){mergeStaticMeshes(THREE,leisureProps,{recursive:true});group.add(leisureProps);}
      const stairs = new THREE.InstancedMesh(new THREE.BoxGeometry(.8, 1, .22), new THREE.MeshLambertMaterial({ color: 0x9f9076 }), 4);
      stairs.receiveShadow = true; group.add(stairs); group.userData.stairs = stairs;
      group.userData.cells = group.userData.cellMeshes?.[0] || null;
      renderer.decorateCityMaterials?.(group);
      renderer.scene.add(group);
      renderer.cityMeshes.set(entity.id, group);
    }
    group.visible=true;group.userData.cityBuilding=b;
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
      const stairRise=Math.max(.08,base-entrance)/4;
      const entry=buildingEntranceDoor(b),entryUnit=entry&&b.units.find(unit=>unit.id===entry.unitId),worldEntrySide=entry&&({1:'back',2:'front',4:'left',8:'right'})[entry.bit],localEntrySide=worldEntrySide&&facadeLocalSide(worldEntrySide,b.rotation),localEntryCell=entryUnit&&facadeLocalCell(b,entryUnit);
      for (let i = 0; i < 4; i++) {
        const distance=.11+i*.22,along=localEntryCell?(localEntrySide==='front'||localEntrySide==='back'?localEntryCell.x+.5:localEntryCell.y+.5):b.width/2;
        const localPoint=localEntrySide==='back'?{x:along,y:-distance}:localEntrySide==='left'?{x:-distance,y:along}:localEntrySide==='right'?{x:b.width+distance,y:along}:{x:along,y:b.depth+distance};
        const point=buildingPoint(b,localPoint.x,localPoint.y);
        // Separate shallow risers descend from the threshold. A single tall
        // block here overlapped the lower half of the entrance on raised lots.
        const top=base-stairRise*i;
        const sideTurn=localEntrySide==='left'||localEntrySide==='right'?1:0;
        matrix.makeRotationY(((b.rotation||0)+sideTurn)*Math.PI/2);matrix.scale(new THREE.Vector3(1,stairRise,.22/.23));matrix.setPosition(point.x,top-stairRise/2-base,point.y);
        group.userData.stairs.setMatrixAt(i, matrix);
      }
      group.userData.stairs.instanceMatrix.needsUpdate = true;
      group.userData.terrainRevision = world.revision || 0;
    }
    if(group.position.x!==entity.x||group.position.y!==b.terrain.base||group.position.z!==entity.y){group.position.set(entity.x,b.terrain.base,entity.y);renderer.cityMeshVisualRevision=(renderer.cityMeshVisualRevision||0)+1;}
    group.userData.supports.visible=false;group.userData.stairs.visible=false;
    group.userData.doorFrames.visible=false;group.userData.exteriorDoorFrames.visible=true;
    const windowShutters=group.userData.portugueseWindowShutters||[],sleepingFloors=sleepingFloorsByBuilding.get(b.id)||EMPTY_FLOORS,shutterState=[...sleepingFloors].sort((a,b)=>a-b).join(',');
    if(group.userData.shutterState!==shutterState){
      group.userData.shutterState=shutterState;const dirty=new Set();
      for(const shutter of windowShutters){
        shutter.targetAngle=sleepingFloors.has(shutter.floor)?shutter.closedAngle:shutter.openAngle;
        if(Math.abs(shutter.targetAngle-shutter.angle)<=.001)continue;
        shutter.angle=shutter.targetAngle;shutter.writeMatrices();
        for(const mesh of Object.values(shutter.dirtyMeshes))dirty.add(mesh);
      }
      for(const mesh of dirty)mesh.instanceMatrix.needsUpdate=true;
    }
    for(const cells of group.userData.cellMeshes || (group.userData.cells ? [group.userData.cells] : [])){const material=cells.material;material.emissive.setHex(renderer.selectedEntityId===entity.id?0x26351a:0x000000);}
    const unit = renderer.selectedEntityId === entity.id ? b.units.find(u => u.id === renderer.selectedCityUnitId) : null;
    group.userData.highlight.visible = renderer.selectedEntityId === entity.id && !!unit;
    if (unit) group.userData.highlight.position.set(unit.x + .5, unit.z*CITY_FLOOR_HEIGHT + CITY_FLOOR_HEIGHT/2, unit.y + .5);
  }
  for (const [id, group] of renderer.cityMeshes) if (!active.has(id)) {
    renderer.parkPalmWindDecorations.delete(id);
    renderer.scene.remove(group);
    group.traverse(object => { object.geometry?.dispose(); object.material?.dispose();object.userData.partyFlagTexture?.dispose();object.userData.mineSignTexture?.dispose();object.userData.marketSignTexture?.dispose(); });
    renderer.cityMeshes.delete(id);
  }
  const foliageTick=renderer.foliageAnimationTick||0;
  for(const [id,crowns] of renderer.parkPalmWindDecorations){
    if(!renderer.cityMeshes.get(id)?.visible)continue;
    for(const crown of crowns){const phase=crown.userData.windPhase||0,interval=15+Math.floor(phase*10),epoch=Math.floor((foliageTick+phase*100)/interval),breeze=Math.sin(epoch*.68+phase*Math.PI*2),cross=Math.cos(epoch*.52+phase*4.1);crown.rotation.z=breeze*.12;crown.rotation.x=.24+cross*.07;}
  }
  const structureRevision=renderer.cityDevelopment?.city?.structureRevision||0,batchContext=renderer._buildingBatchContext??={};
  if(batchContext.structureRevision!==structureRevision||batchContext.visualRevision!==(renderer.cityMeshVisualRevision||0)||batchContext.terrainRevision!==(world.revision||0)||batchContext.activeCount!==active.size||
    batchContext.minTx!==renderer.renderedMinTx||batchContext.maxTx!==renderer.renderedMaxTx||batchContext.minTy!==renderer.renderedMinTy||batchContext.maxTy!==renderer.renderedMaxTy||batchContext.perspectiveView!==perspectiveView){
    syncBuildingDetailBatch(renderer,THREE,'supports',active);
    syncBuildingDetailBatch(renderer,THREE,'stairs',active);
    batchContext.structureRevision=structureRevision;batchContext.visualRevision=renderer.cityMeshVisualRevision||0;batchContext.terrainRevision=world.revision||0;batchContext.activeCount=active.size;
    batchContext.minTx=renderer.renderedMinTx;batchContext.maxTx=renderer.renderedMaxTx;batchContext.minTy=renderer.renderedMinTy;batchContext.maxTy=renderer.renderedMaxTy;batchContext.perspectiveView=perspectiveView;
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
  const product=new THREE.InstancedMesh(productGeometry,new THREE.MeshLambertMaterial({color:visual.head}),capacity);for(const mesh of [stem,foliage,product]){mesh.castShadow=false;mesh.receiveShadow=false;mesh.count=0;group.add(mesh);}
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
  for(const mesh of [plantSet.stem,plantSet.foliage,plantSet.product]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
}

// Open-air premises follow every patch of the natural surface; no slab, walls or roof.
function syncOpenAir(renderer, THREE, entity, b, world) {
  let group = renderer.cityMeshes.get(entity.id);
  const quarry=b.type==='quarry'||OPEN_PIT_MINES.has(b.type)?quarryDeposits(world,entity.x,entity.y,b.width,b.depth):[];
  const signature=`retail-v8-fruit-stalls:${b.type}:${b.width}:${b.depth}:${b.crop}:${b.layoutRevision||0}:${b.units.length}:${b.rotation||0}:${b.paintRevision||0}:${b.type==='quarry'||OPEN_PIT_MINES.has(b.type)?`${world.revision}:${quarry.map(p=>`${p.x},${p.y}`).join(';')}`:''}`;
  if (group && group.userData.signature !== signature) { renderer.scene.remove(group); group.traverse(o => { o.geometry?.dispose(); o.material?.dispose();o.userData.partyFlagTexture?.dispose();o.userData.mineSignTexture?.dispose();o.userData.marketSignTexture?.dispose(); }); renderer.cityMeshes.delete(entity.id); group = null; }
  if (!group) {
    group = new THREE.Group(); group.userData.signature = signature;
    addBuildingDetails(THREE,group,b,{outdoor:true,ground:surfaceElevation(world,entity.x+b.width/2,entity.y+b.depth/2)});
    const patches = new THREE.InstancedMesh(new THREE.BoxGeometry(.94, .045, .94), new THREE.MeshLambertMaterial({ color: b.type === 'quarry' ? 0x94988d : b.type==='farm'?0x795c3d:['market','greengrocer'].includes(b.type)?0xb5a68d:0x6e7940 }), b.units.length);
    patches.receiveShadow = true;if(b.type==='bike_rack')patches.visible=false;group.add(patches); group.userData.patches = patches;
    if(b.type==='farm'){patches.visible=false;const cropPlants=createFarmPlants(THREE,b);group.add(cropPlants.group);group.userData.cropPlants=cropPlants;}
    if(b.type==='quarry'||OPEN_PIT_MINES.has(b.type)){
      patches.visible=false;
      const rubbleOffsets=[[-.17,-.12],[.16,.13]],geometry=new THREE.DodecahedronGeometry(.2,0),material=new THREE.MeshLambertMaterial({color:0x888b88,flatShading:true}),rubble=new THREE.InstancedMesh(geometry,material,Math.max(1,quarry.length*rubbleOffsets.length)),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3(),colors=b.type==='bauxite_mine'?[0x9b6547,0xb47a50,0x77513d]:b.type==='iron_mine'?[0x666c6c,0x969b98,0x555b5b]:[0x777a78,0x969792,0x656a68];let count=0;
      for(let deposit=0;deposit<quarry.length;deposit++)for(let chip=0;chip<rubbleOffsets.length;chip++){
        const rock=quarry[deposit],offset=rubbleOffsets[chip],size=.8+((rock.x*17+rock.y*31+chip*13)%5)*.12,x=rock.x+.5+offset[0],z=rock.y+.5+offset[1],ground=surfaceElevation(world,x,z);
        position.set(x-entity.x,ground+.2*size*.62,z-entity.y);quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),(rock.x*11+rock.y*7+chip)%6);scale.set(size*1.18,size*.58,size);matrix.compose(position,quaternion,scale);rubble.setMatrixAt(count,matrix);rubble.setColorAt(count,new THREE.Color(colors[(rock.x+rock.y+chip)%colors.length]));count++;
      }
      rubble.count=count;rubble.instanceMatrix.needsUpdate=true;if(rubble.instanceColor)rubble.instanceColor.needsUpdate=true;rubble.castShadow=true;rubble.receiveShadow=true;group.add(rubble);group.userData.quarryRubble=rubble;
      const quarryStyle=HOUSE_STYLES[architectureFor(b.type,b.id)]||HOUSE_STYLES.modern,wood=new THREE.MeshLambertMaterial({color:0x604b36}),paint=new THREE.MeshLambertMaterial({color:quarryStyle.accent??0x9a714b}),iron=new THREE.MeshLambertMaterial({color:0x343a38}),x=Math.max(.7,b.width-1.15),z=.72,ground=surfaceElevation(world,entity.x+x,entity.y+z),hoist=new THREE.Group();
      for(const side of [-.42,.42]){const post=new THREE.Mesh(new THREE.BoxGeometry(.12,1.75,.12),wood);post.position.set(x+side,ground+.87,z);post.castShadow=true;hoist.add(post);const brace=new THREE.Mesh(new THREE.BoxGeometry(.08,1.08,.08),wood);brace.position.set(x+side*.56,ground+.47,z);brace.rotation.z=side>0?-.58:.58;hoist.add(brace);}
      const beam=new THREE.Mesh(new THREE.BoxGeometry(1.08,.15,.16),wood);beam.position.set(x,ground+1.75,z);hoist.add(beam);
      const cap=new THREE.Mesh(new THREE.BoxGeometry(1.22,.11,.22),paint);cap.position.set(x,ground+1.87,z);hoist.add(cap);
      const axle=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.88,8),iron);axle.rotation.z=Math.PI/2;axle.position.set(x,ground+1.37,z);hoist.add(axle);
      const wheel=new THREE.Mesh(new THREE.TorusGeometry(.2,.045,5,10),paint);wheel.position.set(x+.54,ground+1.37,z);wheel.rotation.y=Math.PI/2;hoist.add(wheel);
      const rope=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.86,5),iron);rope.position.set(x,ground+.9,z);hoist.add(rope);
      for(const object of hoist.children){object.castShadow=true;object.receiveShadow=true;}group.add(hoist);
    }
    if(b.type==='farm')addFarmFence(THREE,group,b,world,HOUSE_STYLES[architectureFor(b.type,b.id)]||HOUSE_STYLES.modern);
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
      const parkDecor=new THREE.Group();
      const palmCrowns=[];
      const parkStyle=HOUSE_STYLES[architectureFor(b.type,b.id)]||HOUSE_STYLES.modern,parkVariant=(Math.imul((Number(b.id)||0)+11,2654435761)>>>0)%3,wood=new THREE.MeshLambertMaterial({color:parkVariant===1?0x674732:0x79553d}),palmWood=new THREE.MeshLambertMaterial({color:0x8b6847}),palmGreen=new THREE.MeshLambertMaterial({color:0x397b43}),flowerMats=[0xe85d57,0xf0bb48,0xf0e4c1,0xc64b73].map(color=>new THREE.MeshLambertMaterial({color}));
      const gardenSpots=[[.62,.72],[b.width-.62,.72],[.62,b.depth-.72],[b.width-.62,b.depth-.72]], flowerGeo=new THREE.SphereGeometry(.095,6,5),leafGeo=new THREE.SphereGeometry(1,6,4),trunkGeo=new THREE.CylinderGeometry(.065,.12,1.75,6);
      // Park ground remains natural grass; paths are represented by the shared
      // sidewalk and road network outside the lot, not loose paving slabs.
      // Tropical planting beds mix palms, broad leaves, and bright island flowers.
      for(let bed=0;bed<gardenSpots.length;bed++){
        const [x,z]=gardenSpots[bed],ground=surfaceElevation(world,entity.x+x,entity.y+z),trunk=new THREE.Mesh(trunkGeo,palmWood);trunk.position.set(x,ground+.83,z);trunk.rotation.z=(bed%2?-.13:.12);parkDecor.add(trunk);
        const crown=new THREE.Group(),crownY=ground+1.7;crown.position.set(x,crownY,z);parkDecor.add(crown);
        for(let frond=0;frond<7;frond++){
          const angle=frond*Math.PI*2/7,leaf=new THREE.Mesh(leafGeo,palmGreen);leaf.scale.set(.12,.07,.58);leaf.position.set(Math.sin(angle)*.34,-.12,Math.cos(angle)*.34);leaf.rotation.y=angle;leaf.rotation.x=.24;crown.add(leaf);
        }
        mergeStaticMeshes(THREE,crown);crown.userData.windPhase=((Math.imul((Number(b.id)||0)+bed*31+17,2654435761)>>>0)%1000)/1000;palmCrowns.push(crown);
        for(let shrub=0;shrub<3;shrub++){
          const angle=shrub*Math.PI*2/3+.4,px=x+Math.sin(angle)*.37,pz=z+Math.cos(angle)*.37,base=new THREE.Mesh(leafGeo,new THREE.MeshLambertMaterial({color:[0x42844a,0x57924b,0x397744][shrub]}));base.scale.set(.21,.17,.22);base.position.set(px,ground+.18,pz);parkDecor.add(base);
          const petalMat=flowerMats[(bed+shrub)%flowerMats.length];
          for(let petal=0;petal<5;petal++){const a=petal*Math.PI*2/5,blossom=new THREE.Mesh(flowerGeo,petalMat);blossom.scale.set(.065,.035,.09);blossom.position.set(px+Math.cos(a)*.07,ground+.38,pz+Math.sin(a)*.07);parkDecor.add(blossom);}
          const center=new THREE.Mesh(flowerGeo,flowerMats[1]);center.scale.set(.035,.035,.035);center.position.set(px,ground+.4,pz);parkDecor.add(center);
        }
      }
      // A colonial garden pavilion varies between island thatch and tiled shade.
      const shadeX=b.width/2,shadeZ=Math.min(b.depth-1.2,1.45),postMaterial=palmWood,thatch=new THREE.MeshLambertMaterial({color:0xb99255});
      for(const x of [shadeX-.58,shadeX+.58])for(const z of [shadeZ-.42,shadeZ+.42]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,1.75,5),postMaterial);post.position.set(x,surfaceElevation(world,entity.x+x,entity.y+z)+.875,z);parkDecor.add(post);}
      for(const z of [shadeZ-.42,shadeZ+.42]){const beam=new THREE.Mesh(new THREE.BoxGeometry(1.3,.1,.1),postMaterial);beam.position.set(shadeX,surfaceElevation(world,entity.x+shadeX,entity.y+z)+1.72,z);parkDecor.add(beam);}
      for(let slat=0;slat<6;slat++){const roof=new THREE.Mesh(new THREE.BoxGeometry(.1,.07,1.02),parkVariant===0?thatch:new THREE.MeshLambertMaterial({color:parkStyle.roof}));roof.position.set(shadeX-.52+slat*.208,surfaceElevation(world,entity.x+shadeX,entity.y+shadeZ)+1.82,shadeZ);parkDecor.add(roof);}
      if(parkVariant!==0){const fascia=new THREE.Mesh(new THREE.BoxGeometry(1.42,.12,.08),new THREE.MeshLambertMaterial({color:parkStyle.trim}));fascia.position.set(shadeX,surfaceElevation(world,entity.x+shadeX,entity.y+shadeZ+.45)+1.76,shadeZ+.45);parkDecor.add(fascia);}
      for(let seat=0;seat<2;seat++){
        const x=seat===0?.9:b.width-.9,z=seat===0?b.depth*.55:b.depth*.56,ground=surfaceElevation(world,entity.x+x,entity.y+z),seatColor=parkVariant===1?0x52695d:parkVariant===2?parkStyle.accent:0x79553d;
        for(let slat=0;slat<4;slat++){const plank=new THREE.Mesh(new THREE.BoxGeometry(.78,.045,.055),new THREE.MeshLambertMaterial({color:seatColor}));plank.position.set(x,ground+.3,z+(slat-1.5)*.068);parkDecor.add(plank);}
        for(const legX of [-.29,.29]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.08,.28,.34),parkVariant===1?new THREE.MeshLambertMaterial({color:parkStyle.trim}):wood);leg.position.set(x+legX,ground+.14,z);parkDecor.add(leg);}
        for(const supportX of [-.29,.29]){const backPost=new THREE.Mesh(new THREE.BoxGeometry(.06,.58,.06),wood);backPost.position.set(x+supportX,ground+.57,z-.14);parkDecor.add(backPost);}
        for(let slat=0;slat<3;slat++){const back=new THREE.Mesh(new THREE.BoxGeometry(.78,.06,.045),new THREE.MeshLambertMaterial({color:seatColor}));back.position.set(x,ground+.4+slat*.12,z-.14);parkDecor.add(back);}
        for(const armX of [-.38,.38]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.07,.22,.34),wood);arm.position.set(x+armX,ground+.4,z);parkDecor.add(arm);}
      }
      mergeStaticMeshes(THREE,parkDecor);group.add(parkDecor);renderer.parkPalmWindDecorations.set(entity.id,palmCrowns);
    }
    group.userData.sheds = [];
    if (['quarry', 'farm'].includes(b.type)) {
      const addShed = (unit, kind) => {
        if (!unit) return;
        const style=HOUSE_STYLES[architectureFor(b.type,b.id)]||HOUSE_STYLES.modern,seed=(Math.imul((Number(b.id)||0)+unit.id*13,2654435761)>>>0);
        const shed = new THREE.Group();shed.rotation.y=(b.rotation||0)*Math.PI/2;
        const wallColor=b.wallColors?.[unit.id]||b.wallColor||(kind==='bathroom'?0xd8d5c8:style.wall),trimColor=style.trim??0xe3d5b8;
        const walls = new THREE.Mesh(new THREE.BoxGeometry(.86, CITY_FLOOR_HEIGHT-.12, .86), buildingMaterial(renderer,THREE,kind==='bathroom'?'wall':'wood',wallColor));
        walls.position.set(0, CITY_FLOOR_HEIGHT/2, 0); shed.add(walls);
        const door = new THREE.Mesh(new THREE.BoxGeometry(.42, 1.4, .04), new THREE.MeshLambertMaterial({ color: kind === 'bathroom' ? style.accent??0x346c8b : style.accent??0x533624 }));
        door.position.set(0, .72, .45); shed.add(door);
        for(const [x,y,w,h]of [[-.25,.72,.06,1.44],[.25,.72,.06,1.44],[0,1.47,.56,.07]]){const frame=new THREE.Mesh(new THREE.BoxGeometry(w,h,.07),new THREE.MeshLambertMaterial({color:trimColor}));frame.position.set(x,y,.475);frame.castShadow=true;shed.add(frame);}
        const sign = new THREE.Mesh(new THREE.BoxGeometry(.22, .13, .05), new THREE.MeshLambertMaterial({ color: kind === 'bathroom' ? 0xffffff : style.accent??0xe4c775 }));
        sign.position.set(0, 1.52, .46); shed.add(sign);
        const roofMaterial=new THREE.MeshLambertMaterial({color:style.roof??(kind==='bathroom'?0x677d86:0x796447)}),roofKind=style.roofKind;
        if(roofKind==='gable'){
          const shape=new THREE.Shape();shape.moveTo(-.5,0);shape.lineTo(.5,0);shape.lineTo(0,.34);shape.closePath();const pitched=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.96,bevelEnabled:false}),roofMaterial);pitched.position.set(0,CITY_FLOOR_HEIGHT-.04,-.48);pitched.castShadow=true;shed.add(pitched);
          for(let ridge=0;ridge<4;ridge++){const line=new THREE.Mesh(new THREE.BoxGeometry(.025,.025,.92),new THREE.MeshLambertMaterial({color:trimColor}));line.position.set(-.36+ridge*.24,CITY_FLOOR_HEIGHT+.08,0);shed.add(line);}
        }else{
          const roof=new THREE.Mesh(new THREE.ConeGeometry(.67,.3,4),roofMaterial);roof.position.set(0,CITY_FLOOR_HEIGHT+.12,0);roof.rotation.y=Math.PI/4;shed.add(roof);
          if(seed%2===0){const crest=new THREE.Mesh(new THREE.BoxGeometry(.18,.08,.18),new THREE.MeshLambertMaterial({color:style.accent}));crest.position.set(0,CITY_FLOOR_HEIGHT+.3,0);shed.add(crest);}
        }
        group.add(shed);
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
    });
    for (const { unit, mesh } of group.userData.sheds || []) mesh.position.set(unit.x + .5, surfaceElevation(world, entity.x + unit.x + .5, entity.y + unit.y + .5) + .06, unit.y + .5);
    group.userData.patches.instanceMatrix.needsUpdate = true;
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
  const flag=b.governingFlag,flags=b.type==='townhall'?[{flag,size:2.2,height:1.39,y:2.6},{flag:b.governingPartyFlag,size:.9,height:.57,y:1.35}].filter(row=>row.flag):[{flag,size:1.65,height:1.04,y:1.9}].filter(row=>row.flag),key=flags.length?JSON.stringify(flags.map(row=>row.flag))+':'+(b.rotation||0)+':'+b.floors:null;
  if(group.userData.governingFlagKey===key){for(const material of group.userData.governingFlagMaterials||[])material.color.setScalar(shade);for(const {cloth,phase} of group.userData.governingFlagCloths||[])animateClothFlag(cloth,flagWindTime(renderer),phase);return;}
  const old=group.userData.governingFlagMesh;
  if(old){group.remove(old);old.traverse(o=>{o.geometry?.dispose();o.material?.dispose();o.userData.partyFlagTexture?.dispose();});}
  group.userData.governingFlagKey=key;group.userData.governingFlagMesh=null;group.userData.governingFlagMaterials=[];group.userData.governingFlagCloths=[];
  if(!flags.length)return;
  const mast=new THREE.Group(),roof=b.floors*CITY_FLOOR_HEIGHT+.18;
  const poleHeight=b.type==='townhall'?3.5:2.5,pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,poleHeight,6),new THREE.MeshLambertMaterial({color:0xc8c6b4}));
  pole.position.set(b.width*.5,roof+poleHeight*.5,b.depth*.5);mast.add(pole);
  for(const row of flags){let texture;const canvas=partyFlagCanvas(row.flag,()=>{if(texture)texture.needsUpdate=true;});texture=new THREE.CanvasTexture(canvas);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;const material=new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide,emissive:0x000000});material.color.setScalar(shade);const banner=new THREE.Mesh(clothFlagGeometry(THREE,row.size,row.height),material);banner.rotation.y=Math.PI;animateClothFlag(banner,flagWindTime(renderer),0);banner.userData.partyFlagTexture=texture;banner.position.set(b.width*.5-row.size*.5,roof+row.y,b.depth*.5);mast.add(banner);group.userData.governingFlagMaterials.push(material);group.userData.governingFlagCloths.push({cloth:banner,phase:0});}
  group.add(mast);group.userData.governingFlagMesh=mast;
}

function addFarmFence(THREE,group,b,world,style){
 const variant=(Math.imul((Number(b.id)||0)+13,2654435761)>>>0)%3,postColor=style?.motif==='dutch_colonial'?0xdbc9a6:variant===1?0xbdb092:0x82583d,railColor=style?.motif==='dutch_colonial'?style.accent:variant===2?0x5e7960:0x9b7950,wood=new THREE.MeshLambertMaterial({color:railColor}),stone=new THREE.MeshLambertMaterial({color:postColor}),fence=new THREE.Group(),postGeometry=variant===1?new THREE.CylinderGeometry(.06,.09,.7,6):new THREE.BoxGeometry(.075,.7,.075),capGeometry=variant===1?new THREE.ConeGeometry(.08,.12,4):new THREE.BoxGeometry(.12,.08,.12),capMaterial=new THREE.MeshLambertMaterial({color:style?.trim??0xe3d5b8}),fenceMaterial=variant===1?stone:wood;
 const post=(x,y,z)=>{const m=new THREE.Mesh(postGeometry,variant===1?stone:wood);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;fence.add(m);const cap=new THREE.Mesh(capGeometry,capMaterial);cap.position.set(x,y+.4,z);fence.add(cap);};
 const placedPosts=new Set(),postOnce=(x,y,z)=>{const key=`${x.toFixed(3)},${z.toFixed(3)}`;if(placedPosts.has(key))return;placedPosts.add(key);post(x,y,z);};
 const base=(x1,z1,x2,z2,y)=>{if(variant!==2)return;const length=Math.hypot(x2-x1,z2-z1),m=new THREE.Mesh(new THREE.BoxGeometry(length,.2,.13),stone);m.position.set((x1+x2)/2,y,(z1+z2)/2);m.rotation.y=-Math.atan2(z2-z1,x2-x1);fence.add(m);};
 const segment=(x1,z1,x2,z2)=>{const mx=(x1+x2)/2,mz=(z1+z2)/2;if(Math.hypot(b.entity.x+mx-b.door.x,b.entity.y+mz-b.door.y)<1.35)return;const h1=surfaceElevation(world,b.entity.x+x1,b.entity.y+z1),h2=surfaceElevation(world,b.entity.x+x2,b.entity.y+z2);
  postOnce(x1,h1+.35,z1);postOnce(x2,h2+.35,z2);base(x1,z1,x2,z2,(h1+h2)/2+.12);
  for(const y of [.25,.55]){const rail=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(x2-x1,z2-z1,h2-h1),.055,.055),fenceMaterial);rail.position.set(mx,(h1+h2)/2+y,mz);rail.rotation.y=-Math.atan2(z2-z1,x2-x1);rail.rotation.z=Math.atan2(h2-h1,Math.hypot(x2-x1,z2-z1));fence.add(rail);}
 };
 for(let x=0;x<b.width;x++){segment(x+.04,.04,Math.min(b.width-.04,x+1+.04),.04);segment(x+.04,b.depth-.04,Math.min(b.width-.04,x+1+.04),b.depth-.04);}for(let y=0;y<b.depth;y++){segment(.04,y+.04,.04,Math.min(b.depth-.04,y+1+.04));segment(b.width-.04,y+.04,b.width-.04,Math.min(b.depth-.04,y+1+.04));}for(const m of fence.children)m.castShadow=m.receiveShadow=true;mergeStaticMeshes(THREE,fence);group.add(fence);
}
function syncStreetBenches(renderer,THREE,world){
 const furniture=renderer.cityDevelopment?.city?.furniture;if(!furniture)return;const meshes=renderer.streetBenchMeshes??=new Map(),active=new Set(furniture.benches.map(b=>b.id));for(const [id,g]of meshes)if(!active.has(id)){renderer.scene.remove(g);g.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});meshes.delete(id);}
 for(const b of furniture.benches){let g=meshes.get(b.id);if(g&&g.userData.colonialVersion!==5){renderer.scene.remove(g);g.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});meshes.delete(b.id);g=null;}if(!g){let styleHash=0;for(const char of String(b.id))styleHash=Math.imul(styleHash^char.charCodeAt(0),16777619);const style=(styleHash>>>0)%8;g=furnitureModel(THREE,{type:'bench',colonialStyle:style%4,variant:style});g.userData.colonialVersion=5;mergeStaticMeshes(THREE,g);renderer.scene.add(g);meshes.set(b.id,g);}if(g.userData.terrainRevision!==(world.revision||0)||g.position.x!==b.x||g.position.z!==b.y){g.position.set(b.x,surfaceElevation(world,b.x,b.y)+.02,b.y);g.userData.terrainRevision=world.revision||0;}g.rotation.y=b.angle;g.visible=b.x>=(renderer.renderedMinTx??0)&&b.x<=(renderer.renderedMaxTx??world.width)&&b.y>=(renderer.renderedMinTy??0)&&b.y<=(renderer.renderedMaxTy??world.height);}
}
function syncBeachLeisureProps(renderer,THREE,world){
 const citizens=renderer.cityDevelopment?.city?.citizens||[],props=renderer.beachLeisureProps??=new Map(),active=new Map();
 for(const c of citizens){const setup=c.beachLeisure;if(!c.entity.destroyed&&c.task==='beach_leisure'&&setup&&!c.path?.length)active.set(c.id,{c,setup});}
 for(const [id,g]of props)if(!active.has(id)){renderer.scene.remove(g);g.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});props.delete(id);}
 for(const [id,{setup}]of active){let g=props.get(id);const styleKey=`${setup.kind}:${setup.variant}:${setup.umbrellaStyle}`;if(g&&g.userData.styleKey!==styleKey){renderer.scene.remove(g);g.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});props.delete(id);g=null;}
  if(!g){g=furnitureModel(THREE,{type:setup.kind,variant:setup.variant,umbrellaStyle:setup.umbrellaStyle});mergeStaticMeshes(THREE,g);g.userData.styleKey=styleKey;renderer.scene.add(g);props.set(id,g);}
  g.position.set(setup.x,surfaceElevation(world,setup.x,setup.y)+.02,setup.y);g.rotation.y=setup.angle;g.visible=setup.x>=(renderer.renderedMinTx??0)&&setup.x<=(renderer.renderedMaxTx??world.width)&&setup.y>=(renderer.renderedMinTy??0)&&setup.y<=(renderer.renderedMaxTy??world.height);
 }
}
