import test from 'node:test';
import assert from 'node:assert/strict';
import {INTERIOR_ROOM_PROFILES,interiorLayout,interiorRoute,interiorUsePoint} from '../js/city_interior_layout.js';
import {roomFurniture} from '../js/city_furniture_catalog.js';

function building({width=4,depth=3,floors=2,rotation=0}={}){
  const units=[];for(let z=0;z<floors;z++)for(let y=0;y<depth;y++)for(let x=0;x<width;x++)units.push({id:`b:${x}:${y}:${z}`,x,y,z,roomType:(x+y+z)%3===0?'bathroom':'workspace'});
  return {id:'b',entity:{x:10,y:20},width,depth,floors,rotation,layoutRevision:1,units,circulation:[]};
}

test('layout cache is stable and invalidates when the building layout changes',()=>{
  const b=building(),first=interiorLayout(b);assert.equal(interiorLayout(b),first);
  b.layoutRevision++;assert.notEqual(interiorLayout(b),first);
});

test('routes stay inside narrow footprints and connect floors through a stair node',()=>{
  const b=building({width:1,depth:4,floors:3});for(const unit of b.units)unit.roomType='circulation';const start={x:10.5,y:20.5,z:0},target=interiorUsePoint(b,b.units.find(u=>u.z===2&&u.y===3),'bathroom');
  const route=interiorRoute(b,start,target);assert.ok(Array.isArray(route));assert.ok(route.some(p=>p.z>0));assert.deepEqual(route.at(-1),target);
  for(const p of route){assert.ok(p.x>=10&&p.x<11);assert.ok(p.y>=20&&p.y<24);assert.ok(p.z>=0&&p.z<3*1.8);}
});

test('every supported quarter-turn keeps routes deterministic and interaction points in footprint',()=>{
  for(let rotation=0;rotation<4;rotation++){
    const b=building({width:3,depth:2,floors:2,rotation}),room=b.units.find(u=>u.z===1&&u.roomType==='bathroom'),target=interiorUsePoint(b,room,'bathroom');
    assert.deepEqual(interiorRoute(b,{x:10.5,y:20.5,z:0},target),interiorRoute(b,{x:10.5,y:20.5,z:0},target));
    assert.ok(target.x>=10&&target.x<13&&target.y>=20&&target.y<22);
  }
});

test('every room activity used by citizens has an explicit interaction and furniture profile',()=>{
  const required=['bedroom','bathroom','dining','laundry','workspace','office','plenary','service','treatment','circulation','waiting','balcony','roof_terrace'];
  for(const type of required){const profile=INTERIOR_ROOM_PROFILES[type];assert.ok(profile,`missing room profile: ${type}`);assert.ok(profile.interaction);assert.ok('furniture'in profile);}
});

test('fine navigation keeps furniture footprints blocked even beside the building entrance',()=>{
  const b={id:'entry',entity:{x:10,y:20},width:1,depth:1,floors:1,layoutRevision:1,type:'bank',door:{x:10,y:20.5},units:[{id:'entry:office',x:0,y:0,z:0,roomType:'office'}],circulation:[]};
  const layout=interiorLayout(b),scale=layout.scale;
  for(const unit of b.units)for(const item of roomFurniture(b,unit)){
    const w=item.footprint?.width||.4,d=item.footprint?.depth||.3;
    for(const node of layout.walkNodes.values()){
      if(node.floor!==unit.z||node.x<10+unit.x||node.x>=11+unit.x||node.y<20+unit.y||node.y>=21+unit.y)continue;
      const overlaps=Math.abs(node.x-(10+item.x))<w/2&&Math.abs(node.y-(20+item.y))<d/2;
      const stairLanding=node.localX===Math.floor(b.width/2)*scale+Math.floor(scale/2)&&node.localY===Math.floor(b.depth/2)*scale+Math.floor(scale/2);
      assert.ok(!overlaps||stairLanding,`walk node overlaps ${item.label} in ${unit.id}`);
    }
  }
});
