// Isolated CPU benchmark for the per-frame night-light blocker path.
// The legacy frame rebuilds and serializes every building box each frame; the
// current renderer reuses those boxes until structure/terrain revisions change.
// It does not measure WebGL draw time or a full game frame.
import {createHash} from 'node:crypto';
import {NightLighting} from '../js/night_lighting.js';
import {cachedLightBlockerBoxes} from '../js/light_blocker_cache.js';
import {CITY_FLOOR_HEIGHT} from '../js/city_building_geometry.js';

class Vector{constructor(...values){this.set(...values);}set(...values){this.values=values;return this;}}
class Matrix{constructor(){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];}}
class Texture{constructor(data,width,height){this.image={data,width,height};this.version=0;}set needsUpdate(value){if(value)this.version++;}dispose(){this.disposed=true;}}
const THREE={Vector2:Vector,Vector4:Vector,Matrix4:Matrix,DataTexture:Texture};
const camera={matrixWorld:new Matrix(),matrixWorldInverse:new Matrix(),updateMatrixWorld(){}};
const scene={traverseVisible(visit){for(const material of materials)visit({material});}};
const materials=Array.from({length:1000},()=>({isMeshLambertMaterial:true,onBeforeCompile(){},customProgramCacheKey(){return 'test';}}));
const buildings=Array.from({length:1000},(_,id)=>({
  type:id%53===0?'quarry':id%71===0?'farm':'residential',
  constructionKind:id%97===0?'open-air':'building',
  width:2+(id%4),depth:2+(id%3),floors:1+(id%5),terrain:{base:(id%7)*.1},
  entity:{id,x:(id%32)*2,y:Math.floor(id/32)*2,destroyed:id%199===0},
}));
const city={structureRevision:12,buildings};
const LEGACY_STEPS=1200,STATIC_STEPS=1200;

function legacyBoxes(){
  return buildings
    .filter(b=>!b.entity.destroyed&&b.constructionKind!=='open-air'&&b.type!=='quarry')
    .map(b=>{const x=b.entity.x,z=b.entity.y,base=b.terrain?.base??0;
      return {min:[x,base,z],max:[x+b.width,base+(b.floors||1)*CITY_FLOOR_HEIGHT,z+b.depth]};});
}
function lights(count){
  return Array.from({length:count},(_,id)=>({
    visible:true,intensity:2,distance:12,decay:1.6,
    position:{x:(id%16)*4,y:3,z:Math.floor(id/16)*6},
    color:{r:1,g:.6,b:.3},
  }));
}
function legacyFrame(sources,boxes){
  const signature=JSON.stringify(boxes);
  if(signature!==legacyFrame.signature){legacyFrame.signature=signature;legacyFrame.changed=true;}
  scene.traverseVisible(object=>{for(const material of [].concat(object.material))void material;});
  return boxes.length;
}
function newFrame(night,sources,boxes){
  night.update(sources,camera,scene,boxes);
  return night.grid.count;
}
function time(fn){
  const started=performance.now();let result;
  for(let i=0;i<LEGACY_STEPS;i++)result=fn();
  return {ms:performance.now()-started,result};
}
const night=new NightLighting(THREE),cachedBoxes=cachedLightBlockerBoxes({},city,{},()=>0,12),daySources=[];
legacyFrame(daySources,legacyBoxes());
for(let i=0;i<50;i++){newFrame(night,daySources,cachedBoxes);legacyFrame(daySources,legacyBoxes());}
const dayLegacy=time(()=>legacyFrame(daySources,legacyBoxes()));
const dayNew=time(()=>newFrame(night,daySources,cachedBoxes));

const nightSources=lights(32),nightBoxes=cachedLightBlockerBoxes({},city,{},()=>0,12);
night.update(nightSources,camera,scene,nightBoxes);
legacyFrame(nightSources,legacyBoxes());
const nightLegacy=time(()=>legacyFrame(nightSources,legacyBoxes()));
const nightNew=time(()=>newFrame(night,nightSources,nightBoxes));
const digest=createHash('sha256').update(Buffer.from(night.blockers.image.data.buffer)).digest('hex');
console.log(JSON.stringify({
  mode:'night-light-blockers',buildings:buildings.length,lights:32,frames:LEGACY_STEPS,
  dayLegacyMs:dayLegacy.ms,dayCacheMs:dayNew.ms,dayReduction:1-dayNew.ms/dayLegacy.ms,
  nightLegacyMs:nightLegacy.ms,nightCacheMs:nightNew.ms,nightReduction:1-nightNew.ms/nightLegacy.ms,
  blockerChecksum:digest,
}));
