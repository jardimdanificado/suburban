import test from 'node:test';
import assert from 'node:assert/strict';
import {smoothCitizenNormals} from '../js/city_citizen_shading.js';

test('coincident corners share smooth lighting while creases and opposite linings remain distinct',()=>{
  const positions=new Float32Array(12),normals=new Float32Array([0,1,0,.6,.8,0,0,-1,0,0,0,1]);
  const original=normals.slice(),smooth=smoothCitizenNormals(positions,normals).normals;
  assert.deepEqual(normals,original);
  for(let axis=0;axis<3;axis++)assert(Math.abs(smooth[axis]-smooth[3+axis])<1e-6);
  assert(smooth[0]>0&&smooth[1]<1);
  assert.deepEqual([...smooth.slice(6,9)],[0,-1,0]);
  assert.deepEqual([...smooth.slice(9,12)],[0,0,1]);
  for(let i=0;i<smooth.length;i+=3)assert(Math.abs(Math.hypot(...smooth.slice(i,i+3))-1)<1e-6);
});
test('animated normal derivatives use the same smoothing weights as the rest pose',()=>{
  const positions=new Float32Array(6),normals=new Float32Array([0,1,0,.6,.8,0]),linear=new Float32Array([1,2,3,4,5,6]),quadratic=new Float32Array([2,3,4,5,6,7]);
  const smooth=smoothCitizenNormals(positions,normals,[linear,quadratic]),length=Math.hypot(.6,1.8);
  for(let i=0;i<6;i++){
    assert(Math.abs(smooth.derivatives[0][i]-[5,7,9][i%3]/length)<1e-6);
    assert(Math.abs(smooth.derivatives[1][i]-[7,9,11][i%3]/length)<1e-6);
  }
});
test('nearby separate surfaces keep independent normals',()=>{
  const smooth=smoothCitizenNormals(new Float32Array([0,0,0,.001,0,0]),new Float32Array([0,1,0,.6,.8,0])).normals;
  assert.deepEqual([...smooth],[0,1,0,Math.fround(.6),Math.fround(.8),0]);
});
