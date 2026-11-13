import {grassRootSteps} from './volumetric_grass.js?v=typed-roots-2';

// Browsers generate roots in a module worker; incremental steps provide a fallback.
// Root generation advances a few milliseconds per frame. The existing ground
// remains visible, and completed blades keep the original deterministic data.
export class GrassRootJobs{
  constructor(now=()=>performance.now()){this.queue=[];this.running=null;this.now=now;this.worlds=new WeakMap();this.worker=null;this.workerFailed=false;this.serial=0;}
  clear(){
    this.worker?.terminate();this.worker=null;this.workerJob=null;this.serial++;
    for(const job of [...this.queue,...(this.running?[this.running]:[])]){job.cell.pending=false;job.cell.listeners.length=0;}
    this.queue.length=0;this.running=null;this.worlds=new WeakMap();
  }
  request(world,key,surface,excludedCells,bladesPerAxis,isAlive,onReady,priority=()=>0,options={}){
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
      const job={cell,positions:surface.getAttribute('position').array,colors:surface.getAttribute('color')?.array,excludedCells,axis:bladesPerAxis,details:options.details,tint:options.tint,steps:grassRootSteps(surface.getAttribute('position').array,surface.getAttribute('color')?.array,excludedCells,{bladesPerAxis})};
      this.queue.push(job);this.startWorker(job);
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
  startWorker(job){
    if(this.workerFailed||typeof Worker==='undefined')return false;
    try{
      if(!this.worker){
        const worker=this.worker=new Worker(new URL('./grass_root_worker.js',import.meta.url),{type:'module'});
        this.worker.onmessage=({data:{id,data}})=>{
          const active=this.workerJob;if(!active||active.id!==id)return;
          active.result=data;this.workerJob=null;
          // Prepare the next field while the main thread installs this one.
          const pending=this.queue.filter(job=>!job.sent&&!job.result&&job.cell.listeners.some(listener=>listener.isAlive()));
          pending.sort((a,b)=>Math.max(...b.cell.listeners.filter(l=>l.isAlive()).map(l=>l.priority()))-Math.max(...a.cell.listeners.filter(l=>l.isAlive()).map(l=>l.priority())));
          if(pending[0])this.startWorker(pending[0]);
        };
        this.worker.onerror=event=>{
          if(this.worker!==worker)return;
          this.workerError=event?.message;
          this.workerFailed=true;this.worker?.terminate();this.worker=null;
          if(this.workerJob)this.workerJob.sent=false;
          this.workerJob=null;
        };
      }
      if(job.sent)return true;
      if(this.workerJob)return true;
      job.id=++this.serial;job.sent=true;this.workerJob=job;
      const positions=job.positions.slice(),colors=job.colors?.slice();
      this.worker.postMessage({id:job.id,positions,colors,excluded:[...job.excludedCells],axis:job.axis,details:job.details,tint:job.tint},[positions.buffer,...(colors?[colors.buffer]:[])]);
      return true;
    }catch(error){
      this.workerError=String(error);this.workerFailed=true;this.worker?.terminate();this.worker=null;this.workerJob=null;job.sent=false;
      return false;
    }
  }
  advance(budgetMs=3){
    const deadline=this.now()+budgetMs;
    let job=this.selectJob();
    while(this.now()<deadline){
      if(!job)return;
      if(!job.result){
        if(this.startWorker(job))return;
        const step=job.steps.next();if(!step.done)continue;
        job.result=step.value;
      }
      // Installation iterators share the deadline instead of running an entire
      // lawn's tinting and detail generation in one completion callback.
      if(!job.delivery)job.delivery=this.deliver(job);
      if(!job.delivery.next().done)continue;
      job.cell.data=job.result;job.cell.pending=false;this.running=null;
      job=this.selectJob();
    }
  }
  *deliver(job){
    for(const listener of job.cell.listeners)if(listener.isAlive()){
      const installation=listener.onReady(job.result);
      if(installation?.next)while(listener.isAlive()&&!installation.next().done)yield;
    }
    job.cell.listeners.length=0;
  }
}
