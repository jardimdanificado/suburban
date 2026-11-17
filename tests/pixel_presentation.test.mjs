import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/renderer_3d.js',import.meta.url),'utf8');
const methods=source.slice(source.indexOf('  updateRendererResolution() {'),source.indexOf('  setTerrainOptimizations(enabled) {'));
const Renderer=new Function(`return class {${methods}}`)();
function setup(dpr){
 const r=new Renderer();
 r.width=393;r.height=851;r.scaleFactor=.5;
 r.renderer={domElement:{style:{}},setPixelRatio(v){this.ratio=v;},setSize(...v){this.size=v;},setRenderTarget(v){this.target=v;},render(...v){this.draw=v;}};
 r.renderTarget={setSize(...v){this.size=v;}};
 r.presentationTarget={setSize(...v){this.size=v;}};
 r.presentationScene={};r.postCamera={};
 globalThis.window={devicePixelRatio:dpr};
 r.updateRendererResolution();return r;
}
test('dense displays use native output without increasing scene resolution',()=>{
 const previous=globalThis.window;
 try{
  for(const dpr of [2,2.625,3]){
   const r=setup(dpr);
   assert.deepEqual(r.renderer.size,[Math.round(393*dpr),Math.round(851*dpr),false]);
   assert.deepEqual(r.renderTarget.size,[196,425]);
   assert.deepEqual(r.presentationTarget.size,[196,425]);
   assert.equal(r.renderer.ratio,1);
   r.presentPixels();
   assert.equal(r.renderer.target,null);
   assert.deepEqual(r.renderer.draw,[r.presentationScene,r.postCamera]);
   r.width=851;r.height=393;r.scaleFactor=1;r.updateRendererResolution();
   assert.deepEqual(r.presentationTarget.size,[851,393]);
   assert.deepEqual(r.renderer.size,[Math.round(851*dpr),Math.round(393*dpr),false]);
  }
 }finally{globalThis.window=previous;}
});
test('desktop density retains existing low-resolution framebuffer and skips copy',()=>{
 const previous=globalThis.window;
 try{
  const r=setup(1);
  assert.deepEqual(r.renderer.size,[196,425,false]);
  r.presentPixels();assert.equal(r.renderer.draw,undefined);
 }finally{globalThis.window=previous;}
});
test('final copy preserves pixels and both camera paths route through it',()=>{
 const presentation=source.slice(source.indexOf('    this.presentationTarget ='),source.indexOf('    const canvasDom = this.renderer.domElement;'));
 assert.match(presentation,/minFilter: THREE.NearestFilter/);
 assert.match(presentation,/magFilter: THREE.NearestFilter/);
 assert.match(presentation,/toneMapped: false/);
 assert.equal(source.split('this.renderer.setRenderTarget(this.pixelPresentationEnabled ? this.presentationTarget : null);').length-1,2);
 assert.match(source,/this\.presentPixels\(\);/);
});
