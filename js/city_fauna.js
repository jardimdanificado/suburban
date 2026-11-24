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
      hunger: options.hunger ?? (45 + Math.floor(Math.random() * 35)),
      health: 100,
      provokedUntil: 0,
      dead: false,
      deadAt: null,
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

  moveTowards(animal, tx, ty, speedScale = 1, dt = 0.016) {
    const spec = ANIMAL_SPECIES[animal.species];
    const dx = tx - animal.x, dy = ty - animal.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.12) return true;
    const step = Math.min(dist, (spec?.speed || 1) * 3.0 * speedScale * dt);
    const baseAngle = Math.atan2(dx, dy);
    for (const offset of [0, 0.55, -0.55, 1.1, -1.1, 1.65, -1.65]) {
      const a = baseAngle + offset;
      const nx = animal.x + Math.sin(a) * step;
      const ny = animal.y + Math.cos(a) * step;
      if (this.canOccupy(nx, ny, animal.species)) {
        animal.x = nx;
        animal.y = ny;
        animal.entity.x = nx;
        animal.entity.y = ny;
        animal.angle = a;
        return dist - step < 0.14 && offset === 0;
      }
    }
    animal.targetX = null;
    animal.targetY = null;
    return true;
  }

  findRoamTarget(animal) {
    const spec = ANIMAL_SPECIES[animal.species];
    const ranch = animal.buildingId != null ? this.city.building?.(animal.buildingId) : null;
    const anchorX = ranch ? (ranch.door?.x ?? ranch.entity.x) : animal.x;
    const anchorY = ranch ? (ranch.door?.y ?? ranch.entity.y) : animal.y;
    const maxR = ranch ? FAUNA_RULES.ranchRadius : 9;
    for (let attempt = 0; attempt < 12; attempt++) {
      const tx = Math.floor(anchorX) + Math.floor(Math.random() * (maxR * 2 + 1)) - maxR + 0.5;
      const ty = Math.floor(anchorY) + Math.floor(Math.random() * (maxR * 2 + 1)) - maxR + 0.5;
      if (Math.hypot(tx - animal.x, ty - animal.y) < 1.5) continue;
      if (spec.nearWater ? this.matchesHabitat(Math.floor(tx), Math.floor(ty), animal.species) : this.canOccupy(tx, ty, animal.species)) {
        return { x: tx, y: ty };
      }
    }
    return null;
  }

  findPrey(predator) {
    let closest = null, bestDist = 14;
    for (const a of this.animals.values()) {
      if (a === predator || a.dead || a.entity?.destroyed || a.category !== 'wild') continue;
      const sp = ANIMAL_SPECIES[a.species];
      if (!sp || sp.temperament === 'predator') continue;
      const d = Math.hypot(a.x - predator.x, a.y - predator.y);
      if (d < bestDist) { bestDist = d; closest = a; }
    }
    return closest ? { animal: closest, dist: bestDist } : null;
  }

  decideBehavior(animal, isNight) {
    const spec = ANIMAL_SPECIES[animal.species];
    if (!spec) return;
    const minute = this.city.minute;

    // 1. Immediate threat / predator reaction
    const threat = this.nearbyThreat(animal);
    if (threat && (spec.temperament === 'shy' || (spec.temperament === 'docile' && threat.dist < 2.5))) {
      const dx = animal.x - threat.x, dy = animal.y - threat.y;
      const len = Math.hypot(dx, dy) || 1;
      animal.state = 'flee';
      animal.action = 'Fugindo de morador';
      animal.targetX = animal.x + (dx / len) * 6;
      animal.targetY = animal.y + (dy / len) * 6;
      animal.stateTimer = 2.5;
      return;
    }

    if (threat && (animal.provokedUntil > minute || (spec.temperament === 'predator' && animal.hunger < 35))) {
      animal.state = 'walk';
      animal.action = 'Atacando ameaça';
      animal.targetX = threat.x;
      animal.targetY = threat.y;
      animal.stateTimer = 2.0;
      if (threat.dist < 1.3 && threat.citizen && !threat.citizen.dead) {
        threat.citizen.needs.health = Math.max(0, (threat.citizen.needs.health ?? 100) - 8);
        animal.hunger = Math.min(100, animal.hunger + 15);
      }
      return;
    }

    // 2. Predator hunting wild prey
    if (spec.temperament === 'predator' && animal.hunger < 65) {
      const prey = this.findPrey(animal);
      if (prey) {
        if (prey.dist < 1.2) {
          prey.animal.dead = true;
          prey.animal.state = 'sleep';
          prey.animal.action = 'Abatido';
          animal.state = 'eat';
          animal.action = `Devora ${ANIMAL_SPECIES[prey.animal.species]?.label?.toLowerCase() || 'presa'}`;
          animal.targetX = null;
          animal.targetY = null;
          animal.hunger = Math.min(100, animal.hunger + 40);
          animal.stateTimer = 3.0;
          return;
        }
        animal.state = 'walk';
        animal.action = `Caçando ${ANIMAL_SPECIES[prey.animal.species]?.label?.toLowerCase() || 'presa'}`;
        animal.targetX = prey.animal.x;
        animal.targetY = prey.animal.y;
        animal.stateTimer = 2.0;
        return;
      }
    }

    if (animal.stateTimer > 0) return;

    // 3. Sleep at night
    if (isNight && spec.temperament !== 'predator' && Math.random() < 0.45) {
      animal.state = 'sleep';
      animal.action = 'Dormindo';
      animal.targetX = null;
      animal.targetY = null;
      animal.stateTimer = 8 + Math.random() * 8;
      return;
    }

    // 4. Graze grass or forage for non-predators
    if (spec.temperament !== 'predator' && animal.hunger < 82) {
      const tile = tileAt(this.city.world, Math.floor(animal.x), Math.floor(animal.y));
      if (spec.grazesGrass) {
        if ((tile === 0 || tile === 9) && Math.random() < 0.65) {
          animal.state = 'eat';
          animal.action = 'Pastando grama';
          animal.targetX = null;
          animal.targetY = null;
          animal.stateTimer = 3.0 + Math.random() * 2.0;
          return;
        }
        const spot = this.findGrazeSpot(animal);
        if (spot) {
          animal.state = 'walk';
          animal.action = 'Procurando pasto';
          animal.targetX = spot.x;
          animal.targetY = spot.y;
          animal.stateTimer = 4.0;
          return;
        }
      } else if (Math.random() < 0.55) {
        animal.state = 'eat';
        animal.action = 'Forrageando';
        animal.targetX = null;
        animal.targetY = null;
        animal.stateTimer = 2.5 + Math.random() * 2.0;
        return;
      }
    }

    // 5. Roam or brief rest
    if (Math.random() < 0.78) {
      const target = this.findRoamTarget(animal);
      if (target) {
        animal.state = 'walk';
        animal.action = animal.buildingId != null ? 'Circulando no pasto' : 'Explorando o habitat';
        animal.targetX = target.x;
        animal.targetY = target.y;
        animal.stateTimer = 4.5;
        return;
      }
    }
    animal.state = 'idle';
    animal.action = 'Observando';
    animal.targetX = null;
    animal.targetY = null;
    animal.stateTimer = 1.2 + Math.random() * 1.8;
  }

  update(dt = 0.016) {
    if (!dt || dt <= 0) return;
    const stepDt = Math.min(0.25, dt);
    const hour = Math.floor((this.city.minute % 1440) / 60);
    const isNight = hour >= 22 || hour < 5;

    for (const animal of this.animals.values()) {
      if (animal.dead || animal.entity?.destroyed) continue;
      animal.stateTimer = Math.max(0, (animal.stateTimer ?? 0) - stepDt);
      animal.thinkTimer = (animal.thinkTimer ?? 0) - stepDt;

      if (animal.thinkTimer <= 0) {
        animal.thinkTimer = 0.4 + Math.random() * 0.5;
        this.decideBehavior(animal, isNight);
      }

      if (animal.state === 'eat') {
        animal.hunger = Math.min(100, animal.hunger + 8 * stepDt);
      }

      if (animal.targetX != null && (animal.state === 'walk' || animal.state === 'flee')) {
        const arrived = this.moveTowards(animal, animal.targetX, animal.targetY, animal.state === 'flee' ? 1.75 : 1.0, stepDt);
        if (arrived) {
          animal.targetX = null;
          animal.targetY = null;
          animal.state = 'idle';
          animal.action = 'Observando';
          animal.stateTimer = 0.8 + Math.random() * 1.2;
          animal.thinkTimer = 0.3;
        }
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
      target.deadAt = this.city.minute;
      target.state = 'sleep';
      target.action = 'Abatido';
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

    for (const [id, animal] of this.animals) {
      if (animal.entity?.destroyed) { this.animals.delete(id); continue; }
      if (animal.dead) {
        if (animal.deadAt != null && minute - animal.deadAt >= 120) {
          animal.entity.destroyed = true;
          this.animals.delete(id);
        }
        continue;
      }
      if (animal.state === 'eat') {
        animal.hunger = Math.min(100, animal.hunger + 8);
      } else {
        animal.hunger = Math.max(0, animal.hunger - FAUNA_RULES.hungerPerMinute);
      }
      if (animal.hunger <= 0) {
        animal.health = Math.max(0, (animal.health ?? 100) - 2.5);
        if (animal.health <= 0) {
          animal.dead = true;
          animal.deadAt = minute;
          animal.state = 'sleep';
          animal.action = 'Morto por inanição';
          animal.targetX = null;
          animal.targetY = null;
          continue;
        }
      } else if (animal.hunger > 50 && animal.health < 100) {
        animal.health = Math.min(100, animal.health + 0.5);
      }
      if (animal.stateTimer <= 0 || animal.thinkTimer == null) {
        this.decideBehavior(animal, isNight);
      }
    }
  }
}
