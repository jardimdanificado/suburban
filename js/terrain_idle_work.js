function hasWork(renderer){return !!(renderer._terrainBuildJobs?.size||renderer.grassRootJobs?.running||renderer.grassRootJobs?.queue.length);}
export function stopTerrainIdleWork(renderer){
  const state=renderer._terrainIdleWork;if(!state)return;
  state.stopped=true;
  if(state.handle!=null&&typeof cancelIdleCallback==='function')cancelIdleCallback(state.handle);
  renderer._terrainIdleWork=null;
}
export function scheduleTerrainIdleWork(renderer,world){
  if(renderer.terrainOptimizationsEnabled===false||typeof requestIdleCallback!=='function'||!hasWork(renderer))return;
  let state=renderer._terrainIdleWork;
  if(state&&state.world!==world){stopTerrainIdleWork(renderer);state=null;}
  if(!state)renderer._terrainIdleWork=state={world,handle:null,stopped:false};
  if(state.handle!=null)return;
  state.handle=requestIdleCallback(deadline=>{
    state.handle=null;if(state.stopped)return;
    const budget=deadline.didTimeout?2:Math.min(8,Math.max(0,deadline.timeRemaining()-1));
    if(budget>0){
      const start=performance.now(),visible=renderer.visibleTerrainChunkKeys;
      renderer.advanceTerrainBuilds(world,visible,renderer.wireframeMode===1&&renderer.zoom>=.45,budget);
      const remaining=budget-(performance.now()-start);
      if(remaining>0)renderer.grassRootJobs?.advance(remaining);
    }
    if(hasWork(renderer))scheduleTerrainIdleWork(renderer,world);
  },{timeout:200});
}
