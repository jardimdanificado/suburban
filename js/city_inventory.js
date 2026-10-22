/** All quantities and capacities are item counts, including incoming reservations. */
export function inventoryUsed(holder) { return Object.values(holder.inventory || {}).reduce((n, v) => n + v, 0); }
export function incomingItems(holder) { return Object.values(holder.incoming || {}).reduce((n, v) => n + v, 0); }
export function inventoryFree(holder) { return Math.max(0, holder.inventoryCapacity - inventoryUsed(holder) - incomingItems(holder)); }
export function initializeInventory(holder, goods, capacity) {
  holder.inventory = Object.fromEntries(Object.keys(goods).map(g => [g, 0]));
  holder.inventoryCapacity = capacity; holder.incoming = {};
}
export function canStore(holder, good, quantity) { return good in holder.inventory && Number.isSafeInteger(quantity) && quantity >= 0 && inventoryFree(holder) >= quantity; }
