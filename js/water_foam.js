// Shore-local distance keeps the moving foam front aligned to every coast orientation.
export const FOAM_WIDTH = .68;
export function shoreFoamSurface(tx,ty,side){
  const positions=[],uvs=[],inward=[];
  const direction=side===0?[0,1]:side===1?[0,-1]:side===2?[1,0]:[-1,0];
  const point=(along,d)=>side===0?[tx+along,ty+d]:side===1?[tx+along,ty+1-d]:side===2?[tx+d,ty+along]:[tx+1-d,ty+along];
  // Cross-shore subdivisions let raised crests roll instead of lifting a flat strip.
  for(let a=0;a<8;a++)for(let d=0;d<6;d++){
    const corners=[[a,d],[a,d+1],[a+1,d+1],[a,d],[a+1,d+1],[a+1,d]];
    if(side===1||side===2){[corners[1],corners[2]]=[corners[2],corners[1]];[corners[4],corners[5]]=[corners[5],corners[4]];}
    for(const [u,v]of corners){
      const p=point(u/8,.008+v/6*(FOAM_WIDTH-.008));
      positions.push(p[0],.09,p[1]);uvs.push(u/8,v/6);inward.push(...direction);
    }
  }
  return {positions,uvs,inward};
}
const FOAM_FIELD=`
  float foamHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float foamNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(foamHash(i),foamHash(i+vec2(1,0)),f.x),mix(foamHash(i+vec2(0,1)),foamHash(i+vec2(1,1)),f.x),f.y);
  }
  float foamFront(vec2 p){return .51+.19*sin(uCaribbeanWaterTime*1.15+foamNoise(p*1.7)*2.0)+(foamNoise(p*9.0+vec2(uCaribbeanWaterTime*.18,0.0))-.5)*.18;}
  float foamLift(vec2 p,float d){
    float crest=1.0-smoothstep(.0,.25,abs(d-foamFront(p)));
    return crest*crest*.17+sin(d*16.0-uCaribbeanWaterTime*1.6)*.018*sin(d*3.14159);
  }
`;
export function addShoreFoamShader(material){
  const compile=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    compile(shader);
    shader.vertexShader=shader.vertexShader.replace('uniform float uCaribbeanWaterTime;','');
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      uniform float uCaribbeanWaterTime;
      attribute vec2 foamInward;
      varying vec2 vFoamUV; varying vec2 vFoamWorld;
      ${FOAM_FIELD}`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
      vFoamUV=uv; vFoamWorld=position.xz;`)
      .replace('#include <project_vertex>',`
      transformed.y += foamLift(position.xz,uv.y);
      #include <project_vertex>`)
      .replace('#include <defaultnormal_vertex>',`
      float slope=(foamLift(position.xz+foamInward*.015,uv.y+.022)-foamLift(position.xz-foamInward*.015,uv.y-.022))/.03;
      objectNormal=normalize(objectNormal+vec3(-foamInward.x*slope,0.0,-foamInward.y*slope));
      #include <defaultnormal_vertex>`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform float uCaribbeanWaterTime;
      varying vec2 vFoamUV; varying vec2 vFoamWorld;
      ${FOAM_FIELD}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
      float d=vFoamUV.y,front=foamFront(vFoamWorld);
      float crest=1.0-smoothstep(.07,.27,abs(d-front));
      float wash=(1.0-smoothstep(.0,front+.12,d))*.62;
      float backwash=(1.0-smoothstep(.02,.10,abs(d-front*.42)))*.35;
      float bubbles=smoothstep(.25,.68,foamNoise(vFoamWorld*38.0));
      diffuseColor.rgb *= mix(vec3(.70,.87,.86),vec3(1.18,1.18,1.12),crest);
      diffuseColor.a *= min(1.0,crest*1.45+wash+backwash)*(.65+.35*bubbles)*smoothstep(0.0,.025,d)*(1.0-smoothstep(.86,1.0,d));
      if(diffuseColor.a<.025)discard;`);
  };
  material.customProgramCacheKey=()=> 'shore-foam-raised-surge-v3';
  return material;
}
