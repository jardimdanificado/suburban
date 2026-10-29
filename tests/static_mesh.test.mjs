import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeStaticMeshes} from '../js/city_static_mesh.js';
class Attribute{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.count=array.length/itemSize;}getX(i){return this.array[i*3];}getY(i){return this.array[i*3+1];}getZ(i){return this.array[i*3+2];}}
class Geometry{constructor(){this.attributes={};}setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k];}clone(){const g=new Geometry();for(const [k,v] of Object.entries(this.attributes))g.setAttribute(k,new Attribute(v.array.slice(),v.itemSize));return g;}applyMatrix4(m){const p=this.attributes.position.array;for(let i=0;i<p.length;i+=3){p[i]+=m.x;p[i+1]+=m.y;p[i+2]+=m.z;}}computeBoundingSphere(){}dispose(){this.disposed=true;}}
class Material{constructor(opts={}){this.color=opts.color||{r:1,g:1,b:1};this.vertexColors=opts.vertexColors;}dispose(){this.disposed=true;}}
class Mesh{constructor(geometry,material){this.isMesh=true;this.geometry=geometry;this.material=material;this.position={x:0,y:0,z:0};this.castShadow=false;this.receiveShadow=false;}updateMatrix(){this.matrix={...this.position};}}
const THREE={BufferGeometry:Geometry,BufferAttribute:Attribute,Mesh,MeshLambertMaterial:Material};
const geometry=()=>{const g=new Geometry();g.setAttribute('position',new Attribute(new Float32Array([0,0,0,1,0,0,0,1,0]),3));g.setAttribute('normal',new Attribute(new Float32Array([0,0,1,0,0,1,0,0,1]),3));return g;};
test('static mesh batching preserves geometry, transforms, colors and shadows',()=>{
 const red=new Material({color:{r:1,g:0,b:0}}),blue=new Material({color:{r:0,g:0,b:1}}),a=new Mesh(geometry(),red),b=new Mesh(geometry(),blue);a.castShadow=b.castShadow=true;b.position.x=4;
 const root={children:[a,b],remove(o){this.children.splice(this.children.indexOf(o),1);},add(o){this.children.push(o);}};mergeStaticMeshes(THREE,root);
 assert.equal(root.children.length,1);const mesh=root.children[0],pos=mesh.geometry.attributes.position.array,color=mesh.geometry.attributes.color.array;
 assert.equal(pos.length,18);assert.equal(pos[9],4);assert.deepEqual([...color.slice(0,3)],[1,0,0]);assert.deepEqual([...color.slice(9,12)],[0,0,1]);assert(mesh.castShadow);assert(a.geometry.disposed&&b.geometry.disposed&&red.disposed&&blue.disposed);
});
