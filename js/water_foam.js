// Shore-local distance keeps the moving foam front aligned to every coast orientation.
export function addShoreFoamShader(material){
  const compile=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    compile(shader);
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      varying vec2 vFoamUV; varying vec2 vFoamWorld;`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
      vFoamUV=uv; vFoamWorld=position.xz;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform float uCaribbeanWaterTime;
      varying vec2 vFoamUV; varying vec2 vFoamWorld;
      float foamHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float foamNoise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(foamHash(i),foamHash(i+vec2(1,0)),f.x),mix(foamHash(i+vec2(0,1)),foamHash(i+vec2(1,1)),f.x),f.y);
      }`)
      .replace('#include <color_fragment>',`#include <color_fragment>
      float distanceToShore=vFoamUV.y;
      float noise=foamNoise(vFoamWorld*9.0+vec2(uCaribbeanWaterTime*.18,0.0));
      float surge=.48+.22*sin(uCaribbeanWaterTime*1.15+foamNoise(vFoamWorld*1.7)*2.0);
      float front=surge+(noise-.5)*.27;
      float crest=1.0-smoothstep(.025,.16,abs(distanceToShore-front));
      float wash=(1.0-smoothstep(.0,front,distanceToShore))*.32;
      float bubbles=smoothstep(.32,.65,foamNoise(vFoamWorld*38.0));
      diffuseColor.a *= (crest*.8+wash)*(.35+.65*bubbles)*smoothstep(0.0,.06,distanceToShore)*(1.0-smoothstep(.85,1.0,distanceToShore));
      if(diffuseColor.a<.025)discard;`);
  };
  material.customProgramCacheKey=()=> 'shore-foam-surge-v2';
  return material;
}
