// CPU root generation only. GPU/frame time also depends on the visible world.
import {grassRoots} from '../js/volumetric_grass.js';
import {terrainZoomDetail} from '../js/terrain_zoom_detail.js';
const size=32,positions=[];
for(let z=0;z<size;z++)for(let x=0;x<size;x++)positions.push(x,0,z,x,0,z+1,x+1,0,z+1,x,0,z,x+1,0,z+1,x+1,0,z);
for(const zoom of [2,.7,.3]){
 const lod=terrainZoomDetail(zoom),start=performance.now(),grass=grassRoots(positions,undefined,undefined,{bladesPerAxis:lod.grassAxis});
 console.log(JSON.stringify({zoom,tiles:size*size,blades:grass.roots.length/3,rootGenerationMs:+(performance.now()-start).toFixed(2),foamTrianglesPerTile:2*lod.foamSteps**2,beachTrianglesPerTile:2*lod.beachSteps**2}));
}
