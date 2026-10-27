// Entity coordinates remain the outdoor navigation anchor. Indoor location is
// explicit so blocked building tiles never become pathfinding starting points.
const INDOOR_TASKS = new Set(['work','manage','shopping','food','water','health','energy','hygiene','toilet','care','caregiving','provisions','workmeal','council-session','vote','clean','leisure','social']);
const OUTDOOR_WORK = new Set(['farm','quarry','forestry']);

export function syncCitizenInterior(city, c) {
  let b, room;
  if(c.mobilityTrip||c.ridingVehicleId){c.indoorLocation=null;return;}
  const task = c.workMeal ? 'workmeal' : c.task;
  const previous=c.indoorLocation, targetId=c.workMeal?.siteId ?? c.targetId;
  if(!previous&&(c.entity.destroyed||c.path.length||c.deliveryId||!INDOOR_TASKS.has(task)))return;
  // Most residents who entered a room stay there across many render frames.
  // Keep that stable case O(1): avoid resolving the destination and searching
  // the building's rooms until their task, target, layout, or position changes.
  if(previous && !c.entity.destroyed && !c.path.length && !c.deliveryId && previous.task===task && previous.buildingId===targetId && previous.toiletTargetId===c.toiletTargetId) {
    const current=city.building(previous.buildingId);
    if(current && !current.entity.destroyed && previous.layoutRevision===(current.layoutRevision||0) && Math.hypot(c.entity.x-current.door.x,c.entity.y-current.door.y)<=1.5)return;
  }
  if (!c.entity.destroyed && !c.path.length && !c.deliveryId && INDOOR_TASKS.has(task)) {
    b = city.building(targetId);
    if (b && Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)<=1.5) {
      if ((['work','manage'].includes(task) && OUTDOOR_WORK.has(b.type)) || (b.constructionKind==='open-air'&&!['toilet','hygiene','food','workmeal'].includes(task))) b = null;
    } else b = null;
  }
  if (!b) { c.indoorLocation = null; return; }
  const layoutRevision=b.layoutRevision||0;
  if(previous?.buildingId===b.id && previous.task===task && previous.layoutRevision===layoutRevision && previous.toiletTargetId===c.toiletTargetId)return;
  const roomType = task==='toilet'||task==='hygiene' ? 'bathroom'
    : ['food','workmeal','provisions'].includes(task) ? 'dining'
    : task==='council-session' ? 'plenary'
    : ['energy','care','caregiving'].includes(task) ? 'bedroom' : 'workspace';
  if(task==='toilet') room=city.units.get(city.sanitation.facilities.get(c.toiletTargetId)?.unitId);
  if(!room && ['energy','care','provisions','hygiene'].includes(task)) {
    const home=city.housing.home(c);
    if(home?.buildingId===b.id)room=home.unitIds.map(id=>city.units.get(id)).find(u=>u?.roomType===roomType);
    if(!room) { const unit=city.units.get(c.homeUnitId); if(unit?.buildingId===b.id)room=unit; }
  }
  room ||= b.units.find(u=>u.roomType===roomType) || b.units.find(u=>!['bathroom','dining'].includes(u.roomType)) || b.units[0];
  c.indoorLocation={buildingId:b.id,unitId:room?.id??null,floor:room?.z??0,roomType:room?.roomType??roomType,task,layoutRevision,toiletTargetId:c.toiletTargetId,enteredAt:previous?.buildingId===b.id?previous.enteredAt:city.minute};
}
