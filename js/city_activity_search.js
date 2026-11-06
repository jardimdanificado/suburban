// Shared only during a synchronous interior pass. A full set of rooms stays
// full until a reservation changes; queued citizens need not rescan it.
const passes=new WeakMap();
export function beginActivitySearch(city){passes.set(city,{revision:0,buildings:new Map(),full:new WeakMap()});}
export function endActivitySearch(city){passes.delete(city);}
export function invalidateActivitySearch(city,buildingId){const pass=passes.get(city);if(!pass)return;if(buildingId==null)pass.revision++;else pass.buildings.set(buildingId,(pass.buildings.get(buildingId)||0)+1);}
export function findActivityRoom(city,c,b,choices,kind,available){
  if(!choices.length)return undefined;
  const pass=passes.get(city),location=c.indoorLocation;
  // An existing reservation makes availability specific to this citizen.
  if(!pass||location?.targetUnitId||location?.unitId||c.serviceQueue?.unitId)return choices.find(available);
  let kinds=pass.full.get(choices);const revision=pass.buildings.get(b.id)||0,cached=kinds?.get(kind);
  if(cached?.global===pass.revision&&cached.building===revision)return undefined;
  const room=choices.find(available);
  if(!room){if(!kinds)pass.full.set(choices,kinds=new Map());kinds.set(kind,{global:pass.revision,building:pass.buildings.get(b.id)||0});}
  return room;
}
