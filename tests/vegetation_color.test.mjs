import test from 'node:test';
import assert from 'node:assert/strict';
import {vegetationColor,foliageColor} from '../js/vegetation_color.js';
import {travellerPalmSurface} from '../js/traveller_palm.js';
import {botanicalTreeSurface} from '../js/botanical_trees.js';

test('vegetation vertex colors use the same sRGB decoding as material hex colors',()=>{
  assert.deepEqual(vegetationColor(0),[0,0,0]);
  assert.deepEqual(vegetationColor(0xffffff),[1,1,1]);
  for(const value of vegetationColor(0x808080))assert.ok(Math.abs(value-.21586050011389926)<1e-12);
  assert.ok(vegetationColor(0x010203)[0]<.001);
  const [r,g,b]=vegetationColor(0x478d32);
  assert.ok(g/r>4);assert.ok(g/b>8);
});
test('traveller palm uses the coconut green reference with its existing tonal variation',()=>{
  const {colors}=travellerPalmSurface(),reference=foliageColor(0x478d32);
  let blades=0;
  for(let i=0;i<colors.length;i+=3){
    const tone=colors[i+1]/reference[1];
    if(tone<.81||tone>1)continue;
    if(Math.abs(colors[i]/reference[0]-tone)<1e-10&&Math.abs(colors[i+2]/reference[2]-tone)<1e-10)blades++;
  }
  assert.ok(blades>1000);
});
test('new palm leaf colors retain dark saturated channels instead of pastel linear values',()=>{
  const {colors,woodMask}=botanicalTreeSurface('royal_palm');
  const leaves=woodMask.flatMap((wood,i)=>wood?[]:[colors.slice(i*3,i*3+3)]);
  assert.ok(leaves.length>100);
  assert.ok(leaves.every(([r,g,b])=>g/r>2&&g/b>4));
  assert.ok(leaves.every(([,g])=>g<.35));
});


test('foliage palette adds chroma and deeper values while retaining warm and green species hues',()=>{
  for(const hex of [0x618c42,0x478d32,0x73984b,0xc66b39]){
    const original=vegetationColor(hex),leaf=foliageColor(hex);
    const saturation=color=>1-Math.min(...color)/Math.max(...color);
    assert.ok(saturation(leaf)>saturation(original));
    assert.ok(Math.max(...leaf)<Math.max(...original));
    assert.ok(leaf.every(value=>value>=0&&value<=1));
    assert.equal(leaf.indexOf(Math.max(...leaf)),original.indexOf(Math.max(...original)));
  }
});
