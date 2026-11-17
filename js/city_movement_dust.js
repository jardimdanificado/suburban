// Distance-spaced wheel dust, following the rendered path of land vehicles.
import {VehicleDustField,renderVehicleDust} from './vehicle_dust_field.js?v=ground-dust-5';
import {MOBILITY_GROUND_CONTACTS} from './city_mobility_models.js?v=ground-contacts-1';
import {tileAt,PAVED_ROAD_TILES} from './city_terrain.js';
import {TILE_SAND,TILE_WATER,TILE_VOID} from './world_gen.js';
const local=new WeakMap();
const SAMPLE_DISTANCE=.08;
const CAPACITY=3072;
const PALETTE={sand:[.71,.61,.44],road:[.57,.55,.49],dirt:[.57,.45,.31]};

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
function emit(state,vehicle,x,z,base,surface,speed,dx,dz){
  const boost=Math.min(1,speed/4),palette=PALETTE[surface];
  const contacts=MOBILITY_GROUND_CONTACTS[vehicle.good]||[[0,-.3,.04]];
  const rearZ=Math.min(...contacts.map(c=>c[1]));
  const wheels=contacts.filter(c=>c[1]===rearZ);
  for(const [lateral,longitudinal] of wheels){
    const side=Math.sign(lateral)|| (Math.random()<.5?-1:1);
    const outward=side*(.08+Math.random()*.18),jitter=(Math.random()-.5)*.06;
    state.grains.push({
      x:x+dx*longitudinal+dz*(lateral+jitter),
      z:z+dz*longitudinal-dx*(lateral+jitter),h:base+.06+Math.random()*.03,
      vx:-dx*(.08+boost*.18)-dz*outward,
      vz:-dz*(.08+boost*.18)+dx*outward,
      vh:.045+Math.random()*.035+boost*.025,age:0,
      life:(surface==='road'?.35:.6)+Math.random()*.2,
      size:.18+Math.random()*.07+boost*.08,
      opacity:(surface==='road'?.20:surface==='sand'?.65:.55)*(.75+boost*.25),
      color:palette,seed:Math.random(),
    });
  }
}

export function syncMovementDust(THREE,renderer,world,entities,offsets,dt,enabled=true){
  let state=local.get(renderer);
  if(!enabled||!(dt>0)||!Number.isFinite(dt)||!entities?.length||!renderer?.entityGroup){
    if(state){state.group.visible=false;state.grains.length=0;state.history=new WeakMap();state.field.begin();state.field.end();}
    return;
  }
  if(!state){
    const group=new THREE.Group();group.name='movement-dust';renderer.entityGroup.add(group);
    state={group,field:new VehicleDustField(THREE,group,CAPACITY),grains:[],history:new WeakMap()};local.set(renderer,state);
  }
  if(!state.group.parent)renderer.entityGroup.add(state.group);
  state.group.visible=true;
  state.field.syncLighting(renderer);
  renderVehicleDust(state.grains,Math.min(dt,.1),state.field);

  for(const entity of entities){
    const vehicle=movingVehicle(entity);if(!vehicle)continue;
    // Mobility meshes render at entity coordinates, without citizen crowd offsets.
    const x=entity.x,z=entity.y;
    if(Number.isFinite(renderer.renderedMinTx)&&(x<renderer.renderedMinTx-2||x>renderer.renderedMaxTx+2||z<renderer.renderedMinTy-2||z>renderer.renderedMaxTy+2)){state.history.delete(entity);continue;}
    const previous=state.history.get(entity);
    const history={x,z,remainder:previous?.remainder||0};state.history.set(entity,history);
    if(!previous||dt>.5)continue;
    const distance=Math.hypot(x-previous.x,z-previous.z);
    if(distance>3||distance<1e-4){history.remainder=0;continue;}
    const dx=(x-previous.x)/distance,dz=(z-previous.z)/distance;
    const speed=distance/dt;
    for(let along=SAMPLE_DISTANCE-history.remainder;along<=distance+1e-9;along+=SAMPLE_DISTANCE){
      const px=previous.x+dx*along,pz=previous.z+dz*along;
      const surface=surfaceKind(world,px,pz);if(!surface)continue;
      const map=renderer.currentMap;
      emit(state,vehicle,px,pz,map?renderer.getSurfaceElevation(map,px,pz):0,surface,speed,dx,dz);
    }
    const total=history.remainder+distance;
    history.remainder=Math.max(0,total-Math.floor((total+1e-9)/SAMPLE_DISTANCE)*SAMPLE_DISTANCE);
  }

  if(state.grains.length>CAPACITY)state.grains.splice(0,state.grains.length-CAPACITY);
  renderVehicleDust(state.grains,0,state.field);
}
