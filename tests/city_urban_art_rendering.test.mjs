import test from 'node:test';
import assert from 'node:assert/strict';
import {syncUrbanArt} from '../js/city_renderer_3d.js';

class Group{constructor(){this.children=[];this.userData={};this.position={set:(...v)=>this.xyz=v};this.rotation={y:0};this.visible=true;}add(o){this.children.push(o);}traverse(f){f(this);for(const o of this.children)o.traverse?.(f);}}
class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material;this.position={set:(...v)=>this.xyz=v};this.isMesh=true;}traverse(f){f(this);}}
class Geometry{constructor(...args){this.args=args;}dispose(){}}
class Material{constructor(options={}){this.options=options;}dispose(){}}
class Texture{constructor(canvas){this.canvas=canvas;}}
const THREE={Group,Mesh,BoxGeometry:Geometry,PlaneGeometry:Geometry,CylinderGeometry:Geometry,SphereGeometry:Geometry,MeshLambertMaterial:Material,CanvasTexture:Texture,DoubleSide:2,SRGBColorSpace:'srgb'};
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
