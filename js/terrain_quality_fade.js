const DURATION=.4;
const MAX_IDLE_MATERIALS=128;
// Material.clone() copies userData through JSON.stringify, so a shader stored
// there (foliage/water) would serialize its uniform textures and break the
// reference. Share the original userData instead.
function copyMaterial(base,material=null){
  const userData=base.userData;
  if(!userData||typeof userData!=='object')return material?material.copy(base):base.clone();
  base.userData={};
  try{material=material?material.copy(base):base.clone();}finally{base.userData=userData;}
  material.userData=userData;
  return material;
}
// Retaining idle materials also retains Three's compiled programs between fades.
// Each simultaneous use owns its uniforms; overlapping chunks never share clocks.
function borrowMaterial(renderer,base,clock,started,incoming){
  const pool=renderer._terrainFadeMaterialPool??={byBase:new Map(),idle:new Set()};
  const available=pool.byBase.get(base),compile=base.onBeforeCompile,key=base.customProgramCacheKey();
  let slot=available?.pop();
  if(available&&!available.length)pool.byBase.delete(base);
  if(slot){
    pool.idle.delete(slot);
    copyMaterial(base,slot.material);
    if(slot.version!==base.version||slot.key!==key||slot.compile!==compile)slot.material.needsUpdate=true;
  }else slot={base,material:copyMaterial(base),start:{value:0},incoming:{value:0}};
  slot.version=base.version;slot.key=key;slot.compile=compile;slot.start.value=started;slot.incoming.value=incoming?1:0;
  const material=slot.material;
  material.defaultAttributeValues=base.defaultAttributeValues;
  material.onBeforeCompile=shader=>{
    compile?.call(material,shader);
    shader.uniforms.terrainFadeTime=clock;
    shader.uniforms.terrainFadeStart=slot.start;
    shader.uniforms.terrainFadeIncoming=slot.incoming;
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform float terrainFadeTime;
      uniform float terrainFadeStart;
      uniform float terrainFadeIncoming;
    `).replace('void main() {',`void main() {
      float blend=clamp((terrainFadeTime-terrainFadeStart)/${DURATION.toFixed(1)},0.0,1.0);
      float pattern=fract(dot(floor(gl_FragCoord.xy),vec2(.75487766,.5698403)));
      if(terrainFadeIncoming>.5?pattern>=blend:pattern<blend)discard;
    `);
  };
  material.customProgramCacheKey=()=>key+'|terrain-quality-fade-v1';
  return slot;
}
function returnMaterial(renderer,slot){
  const pool=renderer._terrainFadeMaterialPool;
  if(pool.idle.size>=MAX_IDLE_MATERIALS){
    const oldest=pool.idle.values().next().value;
    pool.idle.delete(oldest);
    const list=pool.byBase.get(oldest.base);list.splice(list.indexOf(oldest),1);
    if(!list.length)pool.byBase.delete(oldest.base);
    oldest.material.dispose();
  }
  let list=pool.byBase.get(slot.base);
  if(!list)pool.byBase.set(slot.base,list=[]);
  list.push(slot);pool.idle.add(slot);
}
export function clearTerrainFadeMaterials(renderer){
  for(const fade of renderer._terrainFades||[])finishTerrainFade(renderer,fade);
  for(const slot of renderer._terrainFadeMaterialPool?.idle||[])slot.material.dispose();
  renderer._terrainFadeMaterialPool=null;
}
export function finishTerrainFade(renderer,fade){
  if(!fade||fade.finished)return;
  fade.finished=true;
  for(const [mesh,material]of fade.originals)mesh.material=material;
  for(const slot of fade.slots)returnMaterial(renderer,slot);
  fade.old._terrainFade=fade.next._terrainFade=null;
  renderer._terrainFades?.delete(fade);
  if(!fade.old.disposed)renderer.disposeTerrainChunk(fade.old);
}
export function beginTerrainFade(renderer,old,next){
  if(renderer.terrainOptimizationsEnabled===false||!old?.terrain.parent)return false;
  finishTerrainFade(renderer,old._terrainFade);
  const clock=renderer._terrainFadeClock??={value:performance.now()/1000};
  const fade={old,next,started:clock.value,originals:[],materials:[],slots:[]};
  const decorate=(chunk,incoming)=>{
    const cache=new Map();
    for(const group of [chunk.terrain,chunk.water])for(const mesh of group.children){
      const base=mesh.material;if(!base?.clone||Array.isArray(base))continue;
      let material=cache.get(base);
      if(!material){
        const slot=borrowMaterial(renderer,base,clock,fade.started,incoming);
        material=slot.material;cache.set(base,material);fade.materials.push(material);fade.slots.push(slot);
      }
      fade.originals.push([mesh,base]);mesh.material=material;
    }
  };
  decorate(old,false);decorate(next,true);
  old._terrainFade=next._terrainFade=fade;
  (renderer._terrainFades??=new Set()).add(fade);
  return true;
}
export function advanceTerrainFades(renderer,now=performance.now()/1000){
  if(renderer._terrainFadeClock)renderer._terrainFadeClock.value=now;
  for(const fade of renderer._terrainFades||[])if(now-fade.started>=DURATION||fade.next.disposed)finishTerrainFade(renderer,fade);
}
