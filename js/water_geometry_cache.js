// Terrain-derived mesh data depends on terrain and its explicit cache key, not time.
// A weak owner and one revision keep old worlds and old terrain collectible.
const worlds=new WeakMap();
export function cachedWaterGeometry(world,kind,key,build){
  if(!Number.isFinite(world.revision))return build();
  let cache=worlds.get(world);
  if(!cache||cache.revision!==world.revision||cache.map!==world.map||cache.width!==world.width||cache.height!==world.height){
    cache={revision:world.revision,map:world.map,width:world.width,height:world.height,kinds:new Map()};worlds.set(world,cache);
  }
  let entries=cache.kinds.get(kind);if(!entries)cache.kinds.set(kind,entries={values:new Map(),empty:new Set()});
  if(entries.values.has(key))return entries.values.get(key);
  if(entries.empty.has(key))return null;
  const result=build();
  if(result===null){
    if(entries.empty.size>=8192)entries.empty.delete(entries.empty.values().next().value);
    entries.empty.add(key);
  }else{
    // Bound retained arrays when exploring a large map. Empty sea tiles use
    // a separate cheap set so they cannot evict useful shoreline meshes.
    if(entries.values.size>=(kind==='grass-roots'?16:512))entries.values.delete(entries.values.keys().next().value);
    entries.values.set(key,result);
  }
  return result;
}
