const DURATION=.4;
export function finishTerrainFade(renderer,fade){
  if(!fade||fade.finished)return;
  fade.finished=true;
  for(const [mesh,material]of fade.originals)mesh.material=material;
  for(const material of fade.materials)material.dispose();
  fade.old._terrainFade=fade.next._terrainFade=null;
  renderer._terrainFades?.delete(fade);
  if(!fade.old.disposed)renderer.disposeTerrainChunk(fade.old);
}
export function beginTerrainFade(renderer,old,next){
  if(renderer.terrainOptimizationsEnabled===false||!old?.terrain.parent)return false;
  finishTerrainFade(renderer,old._terrainFade);
  const clock=renderer._terrainFadeClock??={value:performance.now()/1000};
  const fade={old,next,started:clock.value,originals:[],materials:[]};
  const decorate=(chunk,incoming)=>{
    const cache=new Map();
    for(const group of [chunk.terrain,chunk.water])for(const mesh of group.children){
      const base=mesh.material;if(!base?.clone||Array.isArray(base))continue;
      let material=cache.get(base);
      if(!material){
        material=base.clone();material.defaultAttributeValues=base.defaultAttributeValues;cache.set(base,material);fade.materials.push(material);
        const compile=base.onBeforeCompile,key=base.customProgramCacheKey();
        material.onBeforeCompile=shader=>{
          compile?.call(material,shader);
          shader.uniforms.terrainFadeTime=clock;
          shader.uniforms.terrainFadeStart={value:fade.started};
          shader.uniforms.terrainFadeIncoming={value:incoming?1:0};
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
