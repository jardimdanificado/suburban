import {createHash} from 'node:crypto';
import {crowdDirection,crowdGroupKey} from '../js/citizen_crowd.js';

const population=Math.max(1,Number(process.env.SUBURBAN_BENCH_POPULATION)||512);
const frames=Math.max(100,Number(process.env.SUBURBAN_BENCH_FRAMES)||3000);
const entities=Array.from({length:population},(_,id)=>{
  const x=(id*37)%64+.2,y=(id*53)%64+.3,angle=(id%8)*Math.PI/4+.03,step=.3+(id%11)*.031;
  return {id,x,y,targetX:x+Math.cos(angle)*step,targetY:y+Math.sin(angle)*step};
});

function legacyFrame(){
  const groups=new Map(),offsets=new Map();
  for(const entity of entities){
    const dx=entity.targetX-entity.x,dy=entity.targetY-entity.y,length=Math.hypot(dx,dy);
    if(length<1e-5)continue;
    const direction=Math.round(Math.atan2(dy,dx)/(Math.PI/4)),key=`${Math.floor(entity.x)},${Math.floor(entity.y)},${direction}`;
    let group=groups.get(key);if(!group)groups.set(key,group=[]);
    group.push({entity,dx:dx/length,dy:dy/length});
  }
  for(const group of groups.values()){
    group.sort((a,b)=>a.entity.id-b.entity.id);
    const columns=Math.ceil(Math.sqrt(group.length)),rows=Math.ceil(group.length/columns);
    const pitch=Math.min(.12,.28/Math.max(.5,Math.hypot((columns-1)/2,(rows-1)/2)));
    for(let index=0;index<group.length;index++){
      const {entity,dx,dy}=group[index],lateral=index%columns-(columns-1)/2,longitudinal=Math.floor(index/columns)-(rows-1)/2;
      offsets.set(entity.id,{x:(dy*lateral+dx*longitudinal)*pitch,y:(-dx*lateral+dy*longitudinal)*pitch});
    }
  }
  return offsets;
}

const groups=new Map(),groupPool=[],itemPool=[],offsets=new Map(),offsetPool=[];
function optimizedFrame(){
  for(const offset of offsets.values())offsetPool.push(offset);
  offsets.clear();
  for(const group of groups.values()){for(const item of group)itemPool.push(item);group.length=0;groupPool.push(group);}
  groups.clear();
  for(const entity of entities){
    let dx=entity.targetX-entity.x,dy=entity.targetY-entity.y,lengthSquared=dx*dx+dy*dy;
    if(lengthSquared<1e-10)continue;
    const length=Math.sqrt(lengthSquared),direction=crowdDirection(dx,dy);
    const key=crowdGroupKey(Math.floor(entity.x),Math.floor(entity.y),direction);
    let group=groups.get(key);if(!group){group=groupPool.pop()||[];groups.set(key,group);}
    const item=itemPool.pop()||{};
    item.entity=entity;item.dx=dx/length;item.dy=dy/length;group.push(item);
  }
  for(const group of groups.values()){
    if(group.length>1)group.sort((a,b)=>a.entity.id-b.entity.id);
    const columns=Math.ceil(Math.sqrt(group.length)),rows=Math.ceil(group.length/columns);
    const pitch=Math.min(.12,.28/Math.max(.5,Math.hypot((columns-1)/2,(rows-1)/2)));
    for(let index=0;index<group.length;index++){
      const {entity,dx,dy}=group[index],lateral=index%columns-(columns-1)/2,longitudinal=Math.floor(index/columns)-(rows-1)/2;
      const offset=offsetPool.pop()||{};
      offset.x=(dy*lateral+dx*longitudinal)*pitch;offset.y=(-dx*lateral+dy*longitudinal)*pitch;offsets.set(entity.id,offset);
    }
  }
  return offsets;
}

const digest=map=>createHash('sha256').update(JSON.stringify(entities.map(({id})=>{
  const point=map.get(id);return [id,Number(point?.x?.toFixed(7)),Number(point?.y?.toFixed(7))];
}))).digest('hex');
for(let i=0;i<100;i++){legacyFrame();optimizedFrame();}
const legacyStart=performance.now();let legacyResult;
for(let i=0;i<frames;i++)legacyResult=legacyFrame();
const legacyMs=performance.now()-legacyStart;
const optimizedStart=performance.now();let optimizedResult;
for(let i=0;i<frames;i++)optimizedResult=optimizedFrame();
const optimizedMs=performance.now()-optimizedStart;
const legacyChecksum=digest(legacyResult),optimizedChecksum=digest(optimizedResult);
console.log(JSON.stringify({population,frames,legacyMs,optimizedMs,speedup:legacyMs/optimizedMs,legacyChecksum,optimizedChecksum,checksumMatches:legacyChecksum===optimizedChecksum}));
