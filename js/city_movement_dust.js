// Fine grains behind moving land vehicles, on any land surface.
import {DustField,renderGrains} from './dust_field.js';
import {tileAt,PAVED_ROAD_TILES} from './city_terrain.js';
import {TILE_SAND,TILE_WATER,TILE_VOID} from './world_gen.js';
const local=new WeakMap();
const EMIT_INTERVAL=70;
const PALETTE={sand:[.93,.85,.69],road:[.86,.84,.79],dirt:[.85,.76,.6]};

function surfaceKind(world,x,z){
  if(!world)return 'dirt';
  const tile=tileAt(world,Math.floor(x),Math.floor(z));
  if(tile===TILE_WATER||tile===TILE_VOID)return null;
  if(tile===TILE_SAND)return 'sand';
  return PAVED_ROAD_TILES.has(tile)?'road':'dirt';
}
function movingVehicle(entity){
  const vehicle=entity.properties?.cityVehicle;
  if(entity.destroyed||!vehicle||vehicle.boatClass||vehicle.ferrying||vehicle.scrapped||!vehicle.driverId)return null;
  return vehicle;
}
function emit(state,vehicle,x,z,base,surface,speed){
  const palette=PALETTE[surface],boost=Math.min(1,speed/6);
  const back=vehicle.angle+Math.PI;
  for(let i=0;i<14;i++){
    const spread=(Math.random()-.5)*1.2,angle=back+spread;
    state.grains.push({
      x:x+Math.cos(back)*.22+Math.cos(angle)*Math.random()*.2,
      z:z+Math.sin(back)*.22+Math.sin(angle)*Math.random()*.2,
      h:base+.08+Math.random()*.16,
      vx:Math.cos(angle)*(.1+Math.random()*.3)*boost,vz:Math.sin(angle)*(.1+Math.random()*.3)*boost,
      vh:.1+Math.random()*.25,age:0,life:1+Math.random()*.9,
      size:(1.2+Math.random()*1.4)*(.75+boost*.4),color:palette,seed:Math.random(),
    });
  }
}

export function syncMovementDust(THREE,renderer,world,entities,offsets,dt,daylight=1,enabled=true){
  let state=local.get(renderer);
  if(!enabled||!(dt>0)||!entities?.length||!renderer?.entityGroup){
    if(state)state.group.visible=false;
    return;
  }
  if(!state){
    const group=new THREE.Group();group.name='movement-dust';renderer.entityGroup.add(group);
    state={group,field:new DustField(THREE,group,3072),grains:[],history:new WeakMap(),time:0};local.set(renderer,state);
  }
  if(!state.group.parent)renderer.entityGroup.add(state.group);
  state.group.visible=true;
  state.field.setDaylight(daylight);state.time+=dt*1000;

  for(const entity of entities){
    const vehicle=movingVehicle(entity);if(!vehicle)continue;
    const offset=offsets?.get(entity.id),x=entity.x+(offset?.x||0),z=entity.y+(offset?.y||0);
    if(Number.isFinite(renderer.renderedMinTx)&&(x<renderer.renderedMinTx-2||x>renderer.renderedMaxTx+2||z<renderer.renderedMinTy-2||z>renderer.renderedMaxTy+2)){state.history.delete(entity);continue;}
    const previous=state.history.get(entity),history={x,z,time:state.time,emittedAt:previous?.emittedAt??-Infinity};state.history.set(entity,history);
    if(!previous||state.time-previous.time>800)continue;
    const distance=Math.hypot(x-previous.x,z-previous.z);
    if(distance>3||distance<1e-4)continue;
    if(state.time-history.emittedAt<EMIT_INTERVAL)continue;
    history.emittedAt=state.time;
    const surface=surfaceKind(world,x,z);if(!surface)continue;
    const map=renderer.currentMap;
    emit(state,vehicle,x,z,map?renderer.getSurfaceElevation(map,x,z):0,surface,distance/Math.max(dt,1e-3));
  }

  if(state.grains.length>3000)state.grains.splice(0,state.grains.length-3000);
  renderGrains(state.grains,dt,state.field);
}
