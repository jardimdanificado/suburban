import test from 'node:test';
import assert from 'node:assert/strict';
import {nearbyGraffitiSurfaces,graffitiSurfaceVertices} from '../js/city_graffiti_surfaces.js';
import {syncUrbanArt} from '../js/city_renderer_3d.js';

class Group{constructor(){this.children=[];this.userData={};this.position={set:(...v)=>this.xyz=v};this.rotation={y:0};this.visible=true;}add(o){this.children.push(o);}traverse(f){f(this);for(const o of this.children)o.traverse?.(f);}}
class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material;this.position={set:(...v)=>this.xyz=v};this.isMesh=true;}traverse(f){f(this);}}
class Geometry{constructor(...args){this.args=args;}dispose(){}}
class BufferGeometry extends Geometry{constructor(){super();this.attributes={};}setAttribute(name,value){this.attributes[name]=value;}setIndex(value){this.index=value;}computeVertexNormals(){}}
class Attribute{constructor(values,size){this.array=values;this.itemSize=size;}}
class Material{constructor(options={}){this.options=options;}dispose(){}}
class Texture{constructor(canvas){this.canvas=canvas;}}
const THREE={Group,Mesh,BufferGeometry,Float32BufferAttribute:Attribute,BoxGeometry:Geometry,PlaneGeometry:Geometry,CylinderGeometry:Geometry,SphereGeometry:Geometry,MeshLambertMaterial:Material,CanvasTexture:Texture,DoubleSide:2,SRGBColorSpace:'srgb'};
function fakeCanvas(){const canvas={width:0,height:0},ctx={canvas,font:'12px sans-serif',textAlign:'center',textBaseline:'middle',direction:'ltr',fillStyle:'#fff',fillRect(){},strokeRect(){},fillText(){},measureText(text){return {width:String(text).length*10};},getImageData(x,y,width,height){return{data:new Uint8ClampedArray(width*height*4)};},putImageData(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},bezierCurveTo(){},arc(){},closePath(){},stroke(){},fill(){},save(){},restore(){},translate(){},rotate(){}};canvas.getContext=()=>ctx;return canvas;}
function artwork(id,support){return {id,kind:'banner',message:`Obra ${id}`,color:0x445566,entity:{x:8+id,y:10,destroyed:false},x:8+id,y:10,buildingId:support.buildingId,rotation:0,layers:[{id:1,message:`Obra ${id}`,color:0x445566}],support};}

test('urban artworks render at their physical interior and skybridge supports',()=>{
 const originalDocument=globalThis.document;globalThis.document={createElement:()=>fakeCanvas()};
 try{
  const building={id:3,entity:{x:8,y:9,destroyed:false},terrain:{base:2},floors:2},unit={id:30,buildingId:3,x:1,y:1,z:1};
  const interior=artwork(1,{kind:'interior-wall',buildingId:3,unitId:30,floor:1,side:'north'}),linkArt=artwork(2,{kind:'skybridge',buildingId:3,linkId:'bridge:3:4',position:{z:1.8}}),city={justice:{art:[interior,linkArt]},building:id=>id===3?building:null,units:new Map([[30,unit]]),skybridgeLinksForRevision:()=>[{id:'bridge:3:4',axis:'x',height:1.8}]};
  const renderer={scene:{children:[],add(o){this.children.push(o);},remove(o){this.children=this.children.filter(item=>item!==o);}},cityInteriorView:{buildingId:3,floor:1},renderedMinTx:0,renderedMaxTx:32,renderedMinTy:0,renderedMaxTy:32};
  syncUrbanArt(renderer,THREE,city,{getTile:()=>0});
  const inside=renderer.urbanArtMeshes.get(interior.id),elevated=renderer.urbanArtMeshes.get(linkArt.id);
  assert(inside&&elevated,'both artworks must produce scene objects');assert.equal(inside.visible,true);assert.equal(elevated.visible,true);
  assert.deepEqual(inside.xyz,[9.5,3.84,10.08]);assert.deepEqual(elevated.xyz,[10,3.8,10]);
  assert(inside.children.some(child=>child.isMesh),'the interior work must contain visible artwork geometry');assert(elevated.children.some(child=>child.isMesh),'the elevated work must contain visible artwork geometry');
 }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});


test('graffiti replaces decorative painting, flag and vase faces with its visible message',()=>{
 const originalDocument=globalThis.document,canvases=[];
 globalThis.document={createElement:()=>{const canvas=fakeCanvas(),ctx=canvas.getContext('2d');canvas.paints=[];ctx.fillRect=()=>canvas.paints.push(ctx.fillStyle);canvases.push(canvas);return canvas;}};
 try{
  const pieces=['painting','flags','vase'].map((kind,index)=>({...artwork(index+1,{kind:'facade-banner',buildingId:3,position:{x:10+index,y:10},rotation:0}),kind,layers:[{id:1,kind:'graffiti',message:'Meu pixo',color:0xb64335}]}));
  const city={justice:{art:pieces},building:()=>({entity:{destroyed:false},terrain:{base:0}})},renderer={scene:{add(){},remove(){}}};
  syncUrbanArt(renderer,THREE,city,{getTile:()=>0});
  for(const piece of pieces){const group=renderer.urbanArtMeshes.get(piece.id);assert.equal(group.visible,true);assert(group.children.some(child=>child.material?.options?.map?.canvas.paints.includes('#b64335')),`${piece.kind} must display the graffiti face`);}
 }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});


test('street graffiti renders directly on ground, walls and retaining faces without stands or relocation',()=>{
 const originalDocument=globalThis.document;globalThis.document={createElement:()=>fakeCanvas()};
 try{
  const building={id:3,width:2,depth:2,entity:{x:4,y:4},door:{x:5.5,y:6.5}},world={width:16,height:16,revision:0,getTile:(x,y)=>x>=7?9:x===6?8:0};
  const city={world,buildings:[building],justice:{art:[]},building:id=>id===3?building:null,walkable:()=>true};
  const supports=nearbyGraffitiSurfaces(city,{entity:{x:5.5,y:2.5}}),chosen=['ground','wall','retaining'].map(type=>supports.find(s=>s.surface===type));assert(chosen.every(Boolean));
  city.justice.art=chosen.map((support,index)=>({id:index+1,kind:'graffiti',message:'A RUA É NOSSA',color:0x222128,entity:{x:support.position.x,y:support.position.y},support,layers:[],buildingId:support.buildingId??null}));
  const renderer={scene:{add(){},remove(){}}};syncUrbanArt(renderer,THREE,city,world);
  for(const piece of city.justice.art){const group=renderer.urbanArtMeshes.get(piece.id);assert.equal(group.visible,true);assert.deepEqual(group.xyz,[0,0,0]);assert.equal(group.children.length,1,'paint must not produce a stand or backing board');const mesh=group.children[0];assert.deepEqual(mesh.geometry.attributes.position.array,graffitiSurfaceVertices(world,piece.support));assert.equal(mesh.material.options.transparent,true);assert.equal(mesh.material.options.depthWrite,false);assert.equal(piece.entity.x,piece.support.position.x);}
  building.entity.destroyed=true;syncUrbanArt(renderer,THREE,city,world);const wall=city.justice.art.find(p=>p.support.surface==='wall');assert.equal(renderer.urbanArtMeshes.get(wall.id).visible,false);
 }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});
