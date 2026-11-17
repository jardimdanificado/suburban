import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../js/renderer_3d.js',import.meta.url),'utf8');
const start=source.indexOf('function addWaterDitherShader(');
const end=source.indexOf('\nexport function applyWindFoliageShader',start);
const addWaterDitherShader=new Function(`${source.slice(start,end)}; return addWaterDitherShader;`)();

const outgoing='vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;';

function materialWithBaseShader(){
  return {
    onBeforeCompile:shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uCaribbeanWaterTime;');
    },
    customProgramCacheKey:()=>'base-water-shader'
  };
}

test('water dither quantizes specular only, leaving the diffuse water color smooth',()=>{
  const material=addWaterDitherShader(materialWithBaseShader());
  assert.equal(material.customProgramCacheKey(),'base-water-shader:water-specular-dither-v4');
  const shader={fragmentShader:`#include <common>
    vec3 totalDiffuse = reflectedLight.directDiffuse;
    vec3 totalSpecular = reflectedLight.directSpecular;
    ${outgoing}
    #include <opaque_fragment>`};
  material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/uniform float uCaribbeanWaterTime;/, 'earlier water shader hooks still run');
  assert.match(shader.fragmentShader,/float getWaterBayer4x4\(vec2 p\)/);
  assert.match(shader.fragmentShader,/smoothstep\(0\.02, 0\.20, waterSpecLuma\)/, 'dither ramps with specular brightness');
  assert.match(shader.fragmentShader,/mix\(24\.0, 7\.0, waterGlare\)/, 'dark specular keeps fine levels');
  assert.match(shader.fragmentShader,/mix\(0\.40, 1\.20, waterGlare\)/, 'dark specular keeps a weak dither');
  assert.match(shader.fragmentShader,/getWaterBayer4x4\(gl_FragCoord\.xy \/ 2\.0\)/, '8x8 blocks only on the glare');
  assert.match(shader.fragmentShader,/totalSpecular = floor\(totalSpecular \* waterSteps \+ waterBayer \+ 0\.5\) \/ waterSteps;/);
  assert(shader.fragmentShader.indexOf('totalSpecular = floor')<shader.fragmentShader.indexOf(outgoing),'specular is quantized before outgoingLight is summed');
  assert.doesNotMatch(shader.fragmentShader,/gl_FragColor\.rgb = floor/,'the base water color is never quantized');
});

test('water dither leaves materials without an outgoingLight line untouched',()=>{
  const material=addWaterDitherShader({onBeforeCompile:()=>{},customProgramCacheKey:()=>''},20,.8,3,40,.2);
  const shader={fragmentShader:'gl_FragColor = vec4( outgoingLight, diffuseColor.a );\n'};
  material.onBeforeCompile(shader);
  assert.doesNotMatch(shader.fragmentShader,/waterSpecLuma|totalSpecular = floor|gl_FragColor\.rgb = floor/);
});
