import {grassRootSteps} from './volumetric_grass.js?v=dense-soil-grass-1';

// Root generation advances a few milliseconds per frame. The existing ground
// remains visible, and completed blades keep the original deterministic data.
export class GrassRootJobs{
  constructor(now=()=>performance.now()){this.queue=[];this.running=null;this.now=now;this.worlds=new WeakMap();}
  clear(){
    for(const job of [...this.queue,...(this.running?[this.running]:[])]){job.cell.pending=false;job.cell.listeners.length=0;}
    this.queue.length=0;this.running=null;this.worlds=new WeakMap();
  }
  request(world,key,surface,excludedCells,bladesPerAxis,isAlive,onReady,priority=()=>0){
    let cache=this.worlds.get(world);
    if(!cache||cache.map!==world.map||cache.width!==world.width||cache.height!==world.height){
      cache={map:world.map,width:world.width,height:world.height,entries:new Map()};this.worlds.set(world,cache);
    }
    // The key contains the local terrain version and footprint mask. A road
    // edit elsewhere in the city must not discard this ready lawn.
    let cell=cache.entries.get(key);
    if(!cell){
      if(cache.entries.size>=64)cache.entries.delete(cache.entries.keys().next().value);
      cell={data:null,pending:false,listeners:[]};cache.entries.set(key,cell);
    }
    if(cell.data)return cell.data;
    cell.listeners.push({isAlive,onReady,priority});
    if(!cell.pending){
      cell.pending=true;
      this.queue.push({cell,steps:grassRootSteps(surface.getAttribute('position').array,surface.getAttribute('color')?.array,excludedCells,{bladesPerAxis})});
    }
    return null;
  }
  selectJob(){
    const score=job=>{
      let value=-Infinity;
      for(const listener of job.cell.listeners)if(listener.isAlive())value=Math.max(value,listener.priority());
      return value;
    };
    let best=-1,bestScore=this.running?score(this.running):-Infinity;
    if(this.running&&bestScore===-Infinity){this.running.cell.pending=false;this.running.cell.listeners.length=0;this.running=null;}
    for(let i=this.queue.length-1;i>=0;i--){
      const value=score(this.queue[i]);
      if(value===-Infinity){const dead=this.queue.splice(i,1)[0];dead.cell.pending=false;dead.cell.listeners.length=0;if(best>i)best--;continue;}
      if(value>bestScore||value===bestScore&&best>=0){best=i;bestScore=value;}
    }
    if(best>=0){
      const next=this.queue.splice(best,1)[0];
      if(this.running)this.queue.unshift(this.running);
      this.running=next;
    }
    return this.running;
  }
  advance(budgetMs=3){
    const deadline=this.now()+budgetMs;
    let job=this.selectJob();
    while(this.now()<deadline){
      if(!job)return;
      const step=job.steps.next();if(!step.done)continue;
      job.cell.data=step.value;job.cell.pending=false;this.running=null;
      for(const listener of job.cell.listeners.splice(0))if(listener.isAlive())listener.onReady(step.value);
      job=this.selectJob();
    }
  }
}
