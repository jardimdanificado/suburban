// Deterministic CPU workloads; optional argument selects a comparison checkout.
// Browser GPU/pixel checks live in tests/graphics_optimization_preview.html.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.argv[2]?resolve(process.argv[2]):fileURLToPath(new URL('../',import.meta.url));
const moduleAt=name=>import(pathToFileURL(resolve(root,'js',name)).href);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const {constructionSiteCells,cachedConstructionFootprint}=await moduleAt('city_site_footprints.js');
const plots=Array.from({length:200},(_,id)=>({id,x:id%20*12,y:Math.floor(id/20)*12,width:10,depth:10}));
const development={plots,projects:plots.map(p=>({plotId:p.id,service:'building',status:'labor',width:10,depth:10}))},owner={};
const footprint=cachedConstructionFootprint||((_owner,d)=>{const byId=new Map(d.plots.map(p=>[p.id,p])),cells=d.projects.flatMap(p=>constructionSiteCells(p,byId.get(p.plotId)));return {cells,signature:[...new Set(cells.map(p=>`${Math.floor(p.x)},${Math.floor(p.y)}`))].sort().join(';')};});
for(let i=0;i<10;i++)footprint(owner,development);
let started=performance.now(),coverage;for(let i=0;i<200;i++)coverage=footprint(owner,development);
console.log(JSON.stringify({mode:'construction-coverage',root,frames:200,sites:200,cells:coverage.cells.length,ms:performance.now()-started,checksum:hash(coverage.signature)}));

const source=readFileSync(resolve(root,'js/renderer_3d.js'),'utf8');
const scheduler=source.slice(source.indexOf('  advanceTerrainBuilds('),source.indexOf('\n  buildTerrainPlaceholder('));
const Scheduler=new Function(`return class {${scheduler}}`)(),renderer=new Scheduler(),visible=new Set();let steps=0;
Object.assign(renderer,{terrainChunkSize:16,camX:80,camY:80,_terrainPrefetchKeys:new Set(),_terrainBuildJobs:new Map(),cancelTerrainBuild(){throw Error('unexpected cancellation');}});
const world={};for(let y=0;y<12;y++)for(let x=0;x<12;x++){const key=`${x},${y}`;if(x<8&&y<8)visible.add(key);renderer._terrainPrefetchKeys.add(key);renderer._terrainBuildJobs.set(key,{world,steps:{next(){steps++;return {done:false,value:{waitingForRoots:true}};}}});}
for(let i=0;i<20;i++)renderer.advanceTerrainBuilds(world,visible,false,1000);steps=0;
started=performance.now();for(let i=0;i<1000;i++)renderer.advanceTerrainBuilds(world,visible,false,1000);
console.log(JSON.stringify({mode:'terrain-scheduler',root,frames:1000,jobs:renderer._terrainBuildJobs.size,steps,ms:performance.now()-started,checksum:hash([...renderer._terrainBuildJobs.keys()])}));

const {beginTerrainFade,finishTerrainFade,clearTerrainFadeMaterials}=await moduleAt('terrain_quality_fade.js');
let clones=0,copies=0,disposals=0;
class Material{constructor(){this.userData={};this.version=0;}clone(){clones++;return new Material().copy(this);}copy(base){copies++;this.userData=JSON.parse(JSON.stringify(base.userData));return this;}customProgramCacheKey(){return 'terrain';}dispose(){disposals++;}}
const base=new Material(),chunk=()=>({terrain:{parent:{},children:[{material:base}]},water:{children:[]}}),fader={_terrainFadeClock:{value:0},disposeTerrainChunk(c){c.disposed=true;}};
started=performance.now();for(let i=0;i<1000;i++){fader._terrainFadeClock.value=i;const next=chunk();beginTerrainFade(fader,chunk(),next);finishTerrainFade(fader,next._terrainFade);}
console.log(JSON.stringify({mode:'terrain-fade',root,transitions:1000,clones,copies,disposals,ms:performance.now()-started}));clearTerrainFadeMaterials?.(fader);

const {BotanicalTreeInstances}=await moduleAt('botanical_trees.js');let matrixUploads=0,growthUploads=0;
class Attribute{constructor(array){this.array=array;this.ranges=[];}setX(i,x){this.array[i]=x;}clearUpdateRanges(){this.ranges=[];}addUpdateRange(start,count){this.ranges.push([start,count]);}set needsUpdate(value){if(value)(this.array.length===1200*16?matrixUploads++:growthUploads++);}}
class Mesh{constructor(geometry,material,capacity){this.geometry=geometry;this.material=material;this.instanceMatrix=new Attribute(new Float32Array(capacity*16));}setMatrixAt(i,m){this.instanceMatrix.array.set(m.elements,i*16);}dispose(){}}
const THREE={InstancedBufferAttribute:Attribute,InstancedMesh:Mesh,MeshDepthMaterial:class{}},group={add(){},remove(){}},trees=new BotanicalTreeInstances(THREE,group,{},1200,()=>({setAttribute(){},dispose(){}}));
const matrices=Array.from({length:1000},(_,id)=>({elements:[1,0,0,0,0,1,0,0,0,0,1,0,id*.1,0,id*.2,1]}));
trees.begin();for(const m of matrices)trees.add('oak',m,.65);trees.end();matrixUploads=growthUploads=0;
started=performance.now();for(let i=0;i<300;i++){trees.begin();for(const m of matrices)trees.add('oak',m,.65);trees.end();}
console.log(JSON.stringify({mode:'static-tree-refresh',root,refreshes:300,trees:1000,matrixUploads,growthUploads,ms:performance.now()-started,checksum:hash(Array.from(trees.batches.get('oak').mesh.instanceMatrix.array))}));trees.clear();

const collisionMethods=source.slice(source.indexOf('  thirdPersonBuildingIndex('),source.indexOf('\n  getSelectedId()'));
class Vector3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}distanceTo(p){return Math.hypot(this.x-p.x,this.y-p.y,this.z-p.z);}}
const Camera=new Function('THREE','CITY_FLOOR_HEIGHT',`return class {${collisionMethods}}`)({Vector3},1.2),camera=new Camera();let surfaceReads=0;
const terrain={revision:1,map:new Uint8Array(128*128)},city={structureRevision:1,buildings:[]};
camera.currentWorld=terrain;camera.currentMap=terrain.map;camera.getSurfaceElevation=()=>{surfaceReads++;return 0;};
const target={x:50,y:1,z:50},desired={x:50,y:2,z:46};let position;
started=performance.now();for(let i=0;i<10000;i++)position=camera.resolveThirdPersonCamera(target,desired,city);
console.log(JSON.stringify({mode:'third-person-collision',root,frames:10000,surfaceReads,ms:performance.now()-started,checksum:hash(position)}));

let rays=0;class Vector2{constructor(x=0,y=0){this.set(x,y);}set(x,y){this.x=x;this.y=y;return this;}}
class Raycaster{setFromCamera(ndc){rays++;this.ray={origin:{x:50,y:10,z:50},intersectPlane(_plane,p){p.x=50+ndc.x*10;p.z=50+ndc.y*10;return p;}};}}
const Viewport=new Function('THREE',`return class {${source.slice(source.indexOf('  terrainViewportBounds()'),source.indexOf('\n  getFullWorldModeName()'))}}`)({Vector3,Vector2,Raycaster,Plane:class{}}),viewport=new Viewport();
Object.assign(viewport,{fpCamera:{far:800,matrixWorld:{elements:new Float64Array(16)},projectionMatrix:{elements:new Float64Array(16)},updateMatrixWorld(){}},mapWidth:128,mapHeight:128,scene:{fog:{far:65}},isPerspectiveActive:()=>true});
let bounds;started=performance.now();for(let i=0;i<10000;i++)bounds=viewport.terrainViewportBounds();
console.log(JSON.stringify({mode:'perspective-viewport',root,frames:10000,rays,ms:performance.now()-started,checksum:hash(bounds)}));
