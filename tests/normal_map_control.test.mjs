import test from 'node:test';
import assert from 'node:assert/strict';
import {NormalMapControl} from '../js/normal_map_control.js';
function material(map={}){const listeners={};return {normalMap:map,normalScale:{x:.38,y:.38},map:{color:true},needsUpdate:false,addEventListener:(event,callback)=>listeners[event]=callback,dispose(){listeners.dispose?.();}};}
test('toggle restores the exact normal textures and preserves color and strength',()=>{
 const control=new NormalMapControl(),m=material(),map=m.normalMap,color=m.map;control.register(m);control.setEnabled(false);assert.equal(m.normalMap,null);assert.equal(m.needsUpdate,true);assert.equal(m.map,color);control.setEnabled(true);assert.equal(m.normalMap,map);assert.deepEqual(m.normalScale,{x:.38,y:.38});
});
test('new materials inherit disabled setting, including material arrays',()=>{
 const control=new NormalMapControl(false),farm=material(),wood=material(),flat=material(null),maps=[farm.normalMap,wood.normalMap];
 control.registerGroup({traverse(visit){visit({material:[farm,wood]});visit({material:flat});visit({});}});assert.equal(farm.normalMap,null);assert.equal(wood.normalMap,null);control.register(farm);control.setEnabled(true);assert.equal(farm.normalMap,maps[0]);assert.equal(wood.normalMap,maps[1]);assert.equal(flat.normalMap,null);
});
test('disposed materials leave registry without disposing shared textures',()=>{
 const control=new NormalMapControl(),map={dispose(){throw Error('Texture must survive toggle');}},a=material(map),b=material(map);control.register(a);control.register(b);control.register(a);assert.equal(control.materials.size,2);a.dispose();assert.equal(control.materials.size,1);control.setEnabled(false);control.setEnabled(true);assert.equal(b.normalMap,map);
});
test('unchanged setting does not recompile materials',()=>{
 const control=new NormalMapControl(),m=material();control.register(m);control.setEnabled(true);assert.equal(m.needsUpdate,false);
});
