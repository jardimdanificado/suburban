import { ANIMAL_SPECIES, ANIMAL_SPECIES_IDS } from './animal_catalog.js';
import { tileAt, ROAD_TILES } from './city_terrain.js?v=entrance-retaining-clearance-1';
import { TILE_WATER } from './world_gen.js?v=terrain-generation-reset-2-map-default-128';

export const FAUNA_RULES = Object.freeze({
  maxWildAnimals: 120,
  spawnPerSpeciesMin: 1,
  grazeRestore: 22,
  feedRestore: 45,
  hungerPerMinute: 0.35,
  fleeRadius: 4.5,
  predatorSightRadius: 6.5,
  ranchRadius: 6,
  huntDamage: 45,
});

export const RANCH_ANIMALS = Object.freeze({
  cattle_ranch: ['vaca', 'boi'],
  dairy_farm: ['vaca'],
  pig_farm: ['porco'],
  sheep_farm: ['ovelha', 'cabra'],
  poultry: ['galinha', 'pato'],
});

function hasAdjacentTile(world, x, y, targetTile) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (tileAt(world, x + dx, y + dy) === targetTile) return true;
    }
  }
  return false;
}

/** Bounded wild & domesticated animal simulation sharing habitats with NATURAL_PLANTS. */
export class CityFauna {
  constructor(city) {
    this.city = city;
    this.animals = new Map();
    this.nextAnimalId = 1;
  }

  canOccupy(x, y, species) {
    const spec = ANIMAL_SPECIES[species];
    if (!spec) return false;
    const city = this.city, world = city.world;
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= world.width || iy >= world.height) return false;
    const tile = tileAt(world, ix, iy);
    if (!spec.terrain.includes(tile)) return false;
    if (ROAD_TILES.has(tile) || world.hasSidewalk?.(ix, iy)) return false;
    const key = `${ix},${iy}`;
    if (city.occupied?.has(key)) return false;
    if (city.development?.plots?.some(p => ix >= p.x && ix < p.x + p.width && iy >= p.y && iy < p.y + p.depth)) return false;
    return true;
  }

  matchesHabitat(x, y, species) {
    const spec = ANIMAL_SPECIES[species];
    if (!this.canOccupy(x, y, species)) return false;
    const ix = Math.floor(x), iy = Math.floor(y);
    if (spec.nearWater && tileAt(this.city.world, ix, iy) !== TILE_WATER && !hasAdjacentTile(this.city.world, ix, iy, TILE_WATER)) {
      return false;
    }
    if (spec.nearTree && this.city.nature?.plants?.size) {
      let nearTree = false;
      for (const plant of this.city.nature.plants.values()) {
        if (!plant.entity?.destroyed && plant.entity?.properties?.tree && Math.hypot(plant.x - ix, plant.y - iy) <= 5) {
          nearTree = true;
          break;
        }
      }
      if (!nearTree) return false;
    }
    return true;
  }

  spawn(x, y, species, options = {}) {
    const spec = ANIMAL_SPECIES[species];
    if (!spec) return null;
    if (!options.force && !this.canOccupy(x, y, species)) return null;
    if (!options.livestock && this.wildCount() >= FAUNA_RULES.maxWildAnimals) return null;

    const city = this.city;
    const entity = city.createEntity({
      x: Math.floor(x) + 0.5,
      y: Math.floor(y) + 0.5,
      properties: {
        name: spec.label,
        species,
        animal: true,
        brain: { animal: true },
        render: { color: spec.color, size: spec.size },
      },
    });
    const animal = {
      id: entity.id,
      animalId: `animal:${this.nextAnimalId++}`,
      entity,
      species,
      category: options.livestock ? 'livestock' : 'wild',
      buildingId: options.buildingId ?? null,
      x: entity.x,
      y: entity.y,
      angle: Math.random() * Math.PI * 2,
      state: 'idle', // idle | walk | eat | sleep | flee
      stateUntil: city.minute + 3,
      targetX: null,
      targetY: null,
      hunger: options.hunger ?? 75,
      health: 100,
      provokedUntil: 0,
      dead: false,
      bornAt: city.minute,
    };
    entity.properties.cityAnimal = animal;
    this.animals.set(animal.id, animal);
    return animal;
  }

  wildCount(species = null) {
    let count = 0;
    for (const a of this.animals.values()) {
      if (a.dead || a.entity?.destroyed || a.category !== 'wild') continue;
      if (!species || a.species === species) count++;
    }
    return count;
  }

  initialize() {
    if (this.animals.size > 0) return;
    const world = this.city.world;
    if (!world?.width || !world?.height) return;

    for (const species of ANIMAL_SPECIES_IDS) {
      const spec = ANIMAL_SPECIES[species];
      const target = Math.min(spec.maxWild || 4, Math.max(1, Math.round((world.width * world.height) / 4096 * (spec.maxWild || 3))));
      let spawned = 0;
      for (let attempt = 0; attempt < target * 40 && spawned < target && this.wildCount() < FAUNA_RULES.maxWildAnimals; attempt++) {
        const x = Math.floor(Math.random() * world.width);
        const y = Math.floor(Math.random() * world.height);
        if (!this.matchesHabitat(x, y, species)) continue;
        if (this.spawn(x, y, species)) spawned++;
      }
    }
  }

  findGrazeSpot(animal) {
    const spec = ANIMAL_SPECIES[animal.species];
    if (!spec?.grazesGrass) return null;
    const cx = Math.floor(animal.x), cy = Math.floor(animal.y);
    for (let attempt = 0; attempt < 10; attempt++) {
      const tx = cx + Math.floor(Math.random() * 7) - 3;
      const ty = cy + Math.floor(Math.random() * 7) - 3;
      const tile = tileAt(this.city.world, tx, ty);
      if ((tile === 0 || tile === 9) && this.canOccupy(tx, ty, animal.species)) {
        return { x: tx + 0.5, y: ty + 0.5 };
      }
    }
    return null;
  }

  nearbyThreat(animal) {
    const spec = ANIMAL_SPECIES[animal.species];
    const radius = spec.temperament === 'predator' ? FAUNA_RULES.predatorSightRadius : FAUNA_RULES.fleeRadius;
    let closest = null, bestDist = radius;
    for (const c of this.city.citizens || []) {
      if (c.dead || !c.entity || c.entity.destroyed) continue;
      const d = Math.hypot(c.entity.x - animal.x, c.entity.y - animal.y);
      if (d < bestDist) {
        bestDist = d;
        closest = { x: c.entity.x, y: c.entity.y, kind: 'citizen', citizen: c, dist: d };
      }
    }
    return closest;
  }

  moveTowards(animal, tx, ty, speedScale = 1, dt = 0.45) {
    const spec = ANIMAL_SPECIES[animal.species];
    const dx = tx - animal.x, dy = ty - animal.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.08) return true;
    const step = Math.min(dist, (spec?.speed || 1) * speedScale * dt);
    const nx = animal.x + (dx / dist) * step;
    const ny = animal.y + (dy / dist) * step;
    if (this.canOccupy(nx, ny, animal.species)) {
      animal.x = nx;
      animal.y = ny;
      animal.entity.x = nx;
      animal.entity.y = ny;
      animal.angle = Math.atan2(dx, dy);
      return dist - step < 0.1;
    }
    animal.targetX = null;
    animal.targetY = null;
    return true;
  }

  update(dt = 0.016) {
    if (!dt || dt <= 0) return;
    const stepDt = Math.min(0.25, dt);
    for (const animal of this.animals.values()) {
      if (animal.dead || animal.entity?.destroyed) continue;
      if (animal.targetX == null || (animal.state !== 'walk' && animal.state !== 'flee')) continue;
      const arrived = this.moveTowards(animal, animal.targetX, animal.targetY, animal.state === 'flee' ? 1.85 : 1.15, stepDt);
      if (arrived) {
        animal.targetX = null;
        animal.targetY = null;
        animal.state = 'idle';
        animal.stateUntil = this.city.minute + 1;
      }
    }
  }

  syncRanches() {
    for (const b of this.city.buildings || []) {
      if (!b.active || b.entity?.destroyed) continue;
      const speciesList = RANCH_ANIMALS[b.type];
      if (!speciesList) continue;
      let count = 0;
      for (const a of this.animals.values()) {
        if (!a.dead && !a.entity?.destroyed && a.buildingId === b.id) count++;
      }
      const target = Math.min(4, Math.max(2, (b.units?.length || 1) * 2));
      const bx = b.door?.x ?? b.entity.x;
      const by = b.door?.y ?? b.entity.y;
      for (let attempt = 0; attempt < 16 && count < target; attempt++) {
        const species = speciesList[count % speciesList.length];
        const x = Math.floor(bx) + Math.floor(Math.random() * 5) - 2;
        const y = Math.floor(by) + Math.floor(Math.random() * 5) - 2;
        if (this.spawn(x, y, species, { livestock: true, buildingId: b.id })) count++;
      }
    }
  }

  feedLivestock(building, feedGood = 'racao_bovina') {
    if (!building?.inventory || !(building.inventory[feedGood] > 0)) return 0;
    let fed = 0;
    for (const a of this.animals.values()) {
      if (a.dead || a.entity?.destroyed || a.buildingId !== building.id || a.hunger >= 85) continue;
      if (!(building.inventory[feedGood] > 0)) break;
      building.inventory[feedGood]--;
      a.hunger = Math.min(100, a.hunger + FAUNA_RULES.feedRestore);
      a.state = 'eat';
      a.stateUntil = this.city.minute + 2;
      fed++;
    }
    return fed;
  }

  huntNearest(hunter, { species = null, maxDist = 14, lodge = null } = {}) {
    if (!hunter?.entity || hunter.entity.destroyed) return null;
    let target = null, bestDist = maxDist;
    for (const a of this.animals.values()) {
      if (a.dead || a.entity?.destroyed || a.category !== 'wild') continue;
      if (species && a.species !== species) continue;
      const d = Math.hypot(a.x - hunter.entity.x, a.y - hunter.entity.y);
      if (d < bestDist) { bestDist = d; target = a; }
    }
    if (!target) return null;
    if (bestDist > 1.8) {
      return { status: 'tracking', animal: target, dist: bestDist };
    }
    const weaponBoost = (hunter.inventory?.arco_caca > 0 || lodge?.inventory?.arco_caca > 0) ? 2 : 1;
    target.health -= FAUNA_RULES.huntDamage * weaponBoost;
    target.provokedUntil = this.city.minute + 10;
    if (target.health <= 0) {
      target.dead = true;
      target.state = 'sleep';
      const spec = ANIMAL_SPECIES[target.species];
      const bag = lodge?.inventory || (hunter.inventory ??= {});
      for (const [good, qty] of Object.entries(spec?.products || {})) {
        bag[good] = (bag[good] || 0) + qty;
      }
      return { status: 'harvested', animal: target, products: spec?.products || {} };
    }
    return { status: 'wounded', animal: target, health: target.health };
  }

  updateMinute() {
    const minute = this.city.minute;
    if (minute % 15 === 0) this.syncRanches();
    const hour = Math.floor((minute % 1440) / 60);
    const isNight = hour >= 22 || hour < 5;

    for (const animal of this.animals.values()) {
      if (animal.dead || animal.entity?.destroyed) continue;
      const spec = ANIMAL_SPECIES[animal.species];
      if (!spec) continue;

      animal.hunger = Math.max(0, animal.hunger - FAUNA_RULES.hungerPerMinute);

      // Threat / predator check
      const threat = this.nearbyThreat(animal);
      if (threat && (spec.temperament === 'shy' || (spec.temperament === 'docile' && threat.dist < 2.5))) {
        const dx = animal.x - threat.x, dy = animal.y - threat.y;
        const len = Math.hypot(dx, dy) || 1;
        animal.state = 'flee';
        animal.targetX = animal.x + (dx / len) * 4;
        animal.targetY = animal.y + (dy / len) * 4;
        animal.stateUntil = minute + 2;
      } else if (threat && (animal.provokedUntil > minute || (spec.temperament === 'predator' && animal.hunger < 35))) {
        animal.state = 'walk';
        animal.targetX = threat.x;
        animal.targetY = threat.y;
        animal.stateUntil = minute + 2;
        if (threat.dist < 1.2 && threat.citizen && !threat.citizen.dead) {
          threat.citizen.needs.health = Math.max(0, (threat.citizen.needs.health ?? 100) - 8);
          animal.hunger = Math.min(100, animal.hunger + 15);
        }
      }

      if (animal.state === 'flee' || (animal.targetX != null && animal.state === 'walk')) {
        if (minute >= animal.stateUntil) {
          animal.targetX = null;
          animal.targetY = null;
          animal.state = 'idle';
          animal.stateUntil = minute + 1;
        }
        continue;
      }

      if (animal.state === 'eat') {
        if (minute >= animal.stateUntil) {
          animal.hunger = Math.min(100, animal.hunger + FAUNA_RULES.grazeRestore);
          animal.state = 'idle';
          animal.stateUntil = minute + 1;
        }
        continue;
      }

      if (minute < animal.stateUntil) continue;

      // Decide next action
      if (isNight && spec.temperament !== 'predator' && Math.random() < 0.55) {
        animal.state = 'sleep';
        animal.stateUntil = minute + 6 + Math.floor(Math.random() * 8);
      } else if (spec.grazesGrass && animal.hunger < 82) {
        const tile = tileAt(this.city.world, Math.floor(animal.x), Math.floor(animal.y));
        if ((tile === 0 || tile === 9) && Math.random() < 0.55) {
          animal.state = 'eat';
          animal.stateUntil = minute + 2;
        } else {
          const spot = this.findGrazeSpot(animal);
          if (spot) {
            animal.state = 'walk';
            animal.targetX = spot.x;
            animal.targetY = spot.y;
            animal.stateUntil = minute + 5;
          } else {
            animal.state = 'idle';
            animal.stateUntil = minute + 1;
          }
        }
      } else if (Math.random() < 0.8) {
        const tx = Math.floor(animal.x) + Math.floor(Math.random() * 13) - 6 + 0.5;
        const ty = Math.floor(animal.y) + Math.floor(Math.random() * 13) - 6 + 0.5;
        if (this.canOccupy(tx, ty, animal.species)) {
          animal.state = 'walk';
          animal.targetX = tx;
          animal.targetY = ty;
          animal.stateUntil = minute + 6;
        } else {
          animal.state = 'idle';
          animal.stateUntil = minute + 1;
        }
      } else {
        animal.state = 'idle';
        animal.stateUntil = minute + 1 + Math.floor(Math.random() * 2);
      }
    }
  }
}
