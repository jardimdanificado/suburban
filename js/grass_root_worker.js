import {grassRootTints} from './grass_root_tint.js';
import {grassRoots} from './volumetric_grass.js?v=typed-roots-2';
import {grassDetailInstances} from './grass_details.js?v=incremental-details-3';
self.onmessage=({data:{id,positions,colors,excluded,axis,details,tint}})=>{
  const data=grassRoots(positions,colors,new Set(excluded),{bladesPerAxis:axis});
  if(tint)data.tints=grassRootTints(data.roots,tint);
  if(details)data.details=grassDetailInstances(data.roots,data.shades);
  const buffers=[data.roots.buffer,data.shapes.buffer,data.shades.buffer];
  if(data.tints)buffers.push(data.tints.buffer);
  if(data.details)for(const array of Object.values(data.details))buffers.push(array.buffer);
  self.postMessage({id,data},buffers);
};
