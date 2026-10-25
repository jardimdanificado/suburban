// Entity coordinates remain the outdoor navigation anchor. Indoor location is
// explicit so blocked building tiles never become pathfinding starting points.
const INDOOR_TASKS = new Set(['work','manage','shopping','food','water','health','energy','hygiene','toilet','care','caregiving','provisions','workmeal','council-session','vote','clean','leisure','social']);
const OUTDOOR_WORK = new Set(['farm','quarry','forestry']);

export function syncCitizenInterior(city, c) {
  let b, room;
  const task = c.workMeal ? 'workmeal' : c.task;
  if (!c.entity.destroyed && !c.path.length && !c.deliveryId && INDOOR_TASKS.has(task)) {
    b = city.building(c.workMeal?.siteId ?? c.targetId);
    if (b && Math.hypot(c.entity.x-b.door.x,c.entity.y-b.door.y)<=1.5) {
      if (['work','manage'].includes(task) && (OUTDOOR_WORK.has(b.type) || b.constructionKind==='open-air')) b = null;
    } else b = null;
  }
  if (!b) { c.indoorLocation = null; return; }
  const previous=c.indoorLocation;
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
