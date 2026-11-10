import test from 'node:test';
import assert from 'node:assert/strict';
import {trackShadowTransform} from '../js/dynamic_shadow_updates.js';
const boat=()=>({visible:true,position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1},userData:{}});
test('a moving boat invalidates its shadow on every changed frame',()=>{
 const renderer={},object=boat();trackShadowTransform(renderer,object);assert(renderer.watercraftShadowDirty);
 renderer.watercraftShadowDirty=false;trackShadowTransform(renderer,object);assert.equal(renderer.watercraftShadowDirty,false);
 for(let frame=1;frame<5;frame++){renderer.watercraftShadowDirty=false;object.position.x=frame;trackShadowTransform(renderer,object);assert(renderer.watercraftShadowDirty);}
});
test('boat rotation, flotation and visibility also invalidate the cached shadow',()=>{
 const renderer={},object=boat();trackShadowTransform(renderer,object);
 for(const change of [()=>object.rotation.y=1,()=>object.position.y=.2,()=>object.visible=false]){renderer.watercraftShadowDirty=false;change();trackShadowTransform(renderer,object);assert(renderer.watercraftShadowDirty);}
});
