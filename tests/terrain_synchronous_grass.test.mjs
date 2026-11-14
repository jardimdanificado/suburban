import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../js/renderer_3d.js',import.meta.url),'utf8');
const start=source.indexOf('if(this.terrainOptimizationsEnabled===false||this._terrainSynchronousBuild){');
assert.notEqual(start,-1);
const end=source.indexOf('}else{',start);
const build=new Function('THREE','geom','materialKey','zoomDetail','chunk','createVolumetricGrassMesh','tintGrass','createGrassDetailsMesh',source.slice(start,end)+'}');

for(const mode of [{terrainOptimizationsEnabled:false},{_terrainSynchronousBuild:true}]){
  for(const smallDetails of [true,false]){
    test(`synchronous grass builds without worker data: ${JSON.stringify(mode)}, details=${smallDetails}`,()=>{
      const grass={},details={},added=[];
      const owner={...mode,materials:{volumetricGrass:{},grassDetails:{}},_grassExclusionCells:new Set()};
      let tinted=false,detailCalls=0;
      build.call(owner,{}, {},'volumetricGrass',{grassAxis:10,smallDetails},{terrain:{add:mesh=>added.push(mesh)}},
        ()=>grass,mesh=>{assert.equal(mesh,grass);tinted=true;},
        (three,mesh,material,prepared)=>{
          detailCalls++;
          assert.equal(mesh,grass);
          assert.equal(material,owner.materials.grassDetails);
          assert.equal(prepared,undefined,'synchronous details derive from the grass mesh');
          return details;
        });
      assert.equal(tinted,true);
      assert.equal(detailCalls,smallDetails?1:0);
      assert.deepEqual(added,smallDetails?[grass,details]:[grass]);
    });
  }
}
