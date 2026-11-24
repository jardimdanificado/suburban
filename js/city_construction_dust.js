// Fine grains kicked up only where a worker is active on a construction site.
import {DustField,renderGrains} from './dust_field.js?v=grain-dust-6';
const local=new WeakMap();
const EMIT_INTERVAL=.12;
const PALETTE=[[.91,.83,.67],[.84,.76,.6],[.95,.88,.73]];

function emit(state,x,z,base){
  for(let i=0;i<18;i++){
    const angle=Math.random()*Math.PI*2,rad=Math.random()*.35;
    state.grains.push({
      x:x+Math.cos(angle)*rad,z:z+Math.sin(angle)*rad,h:base+.1+Math.random()*.16,
      vx:Math.cos(angle)*(.16+Math.random()*.34),vz:Math.sin(angle)*(.16+Math.random()*.34),vh:.2+Math.random()*.3,
      age:0,life:1+Math.random()*.7,size:1.2+Math.random()*1.2,
      color:PALETTE[Math.floor(Math.random()*PALETTE.length)],seed:Math.random(),
    });
  }
}

export function syncConstructionDust(THREE,renderer,development,time,enabled=true){
  let state=local.get(renderer);
  if(!enabled||!development?.projects?.length){
    if(state){state.group.visible=false;state.grains.length=0;state.field.begin();state.field.end();}
    return;
  }
  if(!state){
    const group=new THREE.Group();group.name='construction-dust';renderer.entityGroup.add(group);
    state={group,field:new DustField(THREE,group),grains:[],lastEmit:new WeakMap(),time};local.set(renderer,state);
  }
  if(!state.group.parent)renderer.entityGroup.add(state.group);
  state.group.visible=true;
  state.field.syncLighting(renderer);
  const delta=(time-state.time)*.001;state.time=time;
  const invalid=!Number.isFinite(delta)||delta<0||delta>.5;
  if(invalid){state.grains.length=0;state.lastEmit=new WeakMap();}
  const dt=invalid?.016:Math.max(.008,Math.min(.06,delta));

  const workers=new Map();
  for(const citizen of development.city?.citizens||[]){
    if(citizen.task!=='construction'||citizen.workProjectId==null||citizen._renderPathActive||citizen.path?.length)continue;
    const entity=citizen.entity;if(!entity||entity.destroyed)continue;
    const x=entity.x,y=entity.y;
    if(Number.isFinite(renderer.renderedMinTx)&&(x<renderer.renderedMinTx-1||x>renderer.renderedMaxTx+1||y<renderer.renderedMinTy-1||y>renderer.renderedMaxTy+1))continue;
    let list=workers.get(citizen.workProjectId);if(!list)workers.set(citizen.workProjectId,list=[]);
    list.push({citizen,x,y});
  }

  const projects=new Map(development.projects.map(project=>[project.id,project]));
  for(const [projectId,crew]of workers){
    const project=projects.get(projectId);
    if(!project||project.cancelled||project.status==='completed'||project.status==='blocked'||project.service==='road'||project.service==='road-repair'||project.type==='road')continue;
    const map=renderer.currentMap;
    for(const worker of crew){
      if(time-(state.lastEmit.get(worker.citizen)??-Infinity)<EMIT_INTERVAL*1000)continue;
      state.lastEmit.set(worker.citizen,time);
      emit(state,worker.x,worker.y,map?renderer.getSurfaceElevation(map,worker.x,worker.y):0);
    }
  }

  renderGrains(state.grains,dt,state.field);
}
