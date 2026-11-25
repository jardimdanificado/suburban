import { ANIMAL_SPECIES, ANIMAL_SPECIES_IDS } from './animal_catalog.js?v=fauna-scale-2';
import { NATURAL_PLANTS } from './plant_catalog.js';
import { BOTANICAL_TREE_MODELS } from './botanical_trees.js?v=species-colors-3';
import { CITY_FLOOR_HEIGHT } from './city_building_geometry.js?v=banner-placement-2';
import { buildingLeisureSpaces } from './city_balconies.js?v=sertanejo-house-styles-1';
import { tileAt, ROAD_TILES } from './city_terrain.js?v=entrance-retaining-clearance-1';
import { TILE_WATER } from './world_gen.js?v=terrain-generation-reset-2-map-default-128';

export const FAUNA_RULES = Object.freeze({
  maxWildAnimals: 180,
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
const faunaTreeCache=new WeakMap();
const faunaCitizenCache=new WeakMap();
function getFaunaCitizenGrid(city){
  const citizens=city.citizens||[];
  let cached=faunaCitizenCache.get(city);
  if(cached&&cached.minute===city.minute&&cached.count===citizens.length)return cached.buckets;
  const buckets=new Map();
  for(let i=0;i<citizens.length;i++){
    const c=citizens[i];if(c.dead||!c.entity||c.entity.destroyed)continue;
    const bx=Math.floor(c.entity.x/12),by=Math.floor(c.entity.y/12),key=((bx&0xFFFF)<<16)|(by&0xFFFF);
    let list=buckets.get(key);if(!list){list=[];buckets.set(key,list);}
    list.push(c);
  }
  faunaCitizenCache.set(city,{minute:city.minute,count:citizens.length,buckets});
  return buckets;
}
function getFaunaTreeGrid(city){
  const plants=city.nature?.plants;if(!plants)return null;
  const rev=`${plants.size}:${city.world?.revision||0}:${city.nature?.revision||0}`;
  let cached=faunaTreeCache.get(city);
  if(cached&&cached.rev===rev)return cached.buckets;
  const buckets=new Map();
  for(const plant of plants.values()){
    if(plant.entity?.destroyed||plant.stage!=='mature')continue;
    const spec=NATURAL_PLANTS[plant.species];if(!spec||!(spec.wood>0))continue;
    const bx=Math.floor(plant.x/12),by=Math.floor(plant.y/12),key=((bx&0xFFFF)<<16)|(by&0xFFFF);
    let list=buckets.get(key);if(!list){list=[];buckets.set(key,list);}
    list.push(plant);
  }
  faunaTreeCache.set(city,{rev,buckets});
  return buckets;
}

export class CityFauna {
  constructor(city) {
    this.city = city;
    this.animals = new Map();
    this.nests = new Map();
    this.grazedTiles = new Map();
    this.grazeRevision = 0;
    this.nextAnimalId = 1;
    this.nextNestId = 1;
  }

  placeNest({ x, y, z = 1.8, surface = 'tree', buildingId = null, plantId = null, species = 'sabia', ownerId = null, eggs = 2 } = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (!['tree', 'balcony', 'fence', 'roof'].includes(surface)) return null;
    const spec = ANIMAL_SPECIES[species] || {};
    const id = `nest:${this.nextNestId++}`;
    const entity = this.city.createEntity({
      x,
      y,
      properties: {
        name: `Ninho de ${(spec.label || species).toLowerCase()}`,
        species,
        render: { size: 0.45 },
      },
    });
    const nest = {
      id,
      entityId: entity.id,
      entity,
      x,
      y,
      z,
      surface,
      buildingId,
      plantId,
      species,
      ownerId,
      eggs,
      createdAt: this.city.minute,
    };
    entity.properties.cityNest = nest;
    this.nests.set(nest.id, nest);
    return nest;
  }

  removeNest(nest) {
    if (!nest) return;
    this.nests.delete(nest.id);
    if (nest.entity) nest.entity.destroyed = true;
    if (nest.ownerId != null) {
      const owner = this.animals.get(nest.ownerId);
      if (owner && owner.nestId === nest.id) owner.nestId = null;
    }
  }

  pruneOrphanedNests() {
    for (const nest of this.nests.values()) {
      if (nest.entity?.destroyed) {
        this.removeNest(nest);
        continue;
      }
      if (nest.plantId != null) {
        const plant = this.city.nature?.plants?.get?.(nest.plantId);
        if (!plant || plant.entity?.destroyed) {
          this.removeNest(nest);
          continue;
        }
        const spot = this.treePerchSpot(plant, nest.entityId || nest.ownerId || plant.id || 1);
        const trunkDist = Math.hypot(nest.x - (plant.x + 0.5), nest.y - (plant.y + 0.5));
        if (trunkDist < 0.22 || (nest.z || 0) < spot.z * 0.75) {
          nest.x = spot.x;
          nest.y = spot.y;
          nest.z = spot.z;
          if (nest.entity) {
            nest.entity.x = spot.x;
            nest.entity.y = spot.y;
          }
        }
      }
      if (nest.buildingId != null && this.city.building) {
        const b = this.city.building(nest.buildingId);
        if (!b || b.entity?.destroyed) {
          this.removeNest(nest);
        }
      }
    }
  }

  treePerchSpot(plant, seed = plant?.id || 1) {
    if (!plant || plant.entity?.destroyed) return { x: 0, y: 0, z: 0, surface: 'tree', plantId: null };
    const species = plant.species || plant.entity?.properties?.species || '';
    const model = BOTANICAL_TREE_MODELS[species];
    const renderSize = plant.entity?.properties?.render?.size || 1;
    const savedVisual = plant.visualScale ?? plant.entity?.properties?.cityPlant?.visualScale;
    const visualScale = Number.isFinite(savedVisual)
      ? savedVisual
      : (0.76 + (Math.abs(Math.sin(plant.x * 12.9898 + plant.y * 78.233 + species.length * 0.31) * 43758.5453) % 1) * 0.52);
    const totalScale = renderSize * visualScale;
    const isPalm = model?.kind === 'pinnate' || model?.kind === 'fan' || model?.kind === 'papaya' || species.includes('palm');
    const baseHeight = model?.height || (species === 'coconut_palm' ? 3.2 : species === 'traveller_palm' ? 2.8 : 3.15);
    const H = baseHeight * totalScale;
    const z = isPalm ? Math.max(1.4, H * 0.90) : Math.max(1.2, H * 0.72);
    const offsetR = isPalm
      ? Math.max(0.28, Math.min(0.55, (model?.length || 1.3) * totalScale * 0.30))
      : Math.max(0.32, Math.min(0.95, (model?.radius || 1.2) * totalScale * 0.48));
    const angle = ((Number(seed) || 1) * 2.399963 + plant.x * 0.73 + plant.y * 1.17) % (Math.PI * 2);
    return {
      x: plant.x + 0.5 + Math.cos(angle) * offsetR,
      y: plant.y + 0.5 + Math.sin(angle) * offsetR,
      z,
      surface: 'tree',
      plantId: plant.id,
    };
  }

  treeCanopyAltitude(plant) {
    return this.treePerchSpot(plant).z;
  }

  findTreeSpot(x, y, maxDist = 10) {
    const buckets=getFaunaTreeGrid(this.city);if(!buckets)return null;
    const r=Math.ceil(maxDist/12),cx=Math.floor(x/12),cy=Math.floor(y/12);
    let best = null, bestDist2 = maxDist*maxDist;
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      const list=buckets.get((((cx+dx)&0xFFFF)<<16)|((cy+dy)&0xFFFF));if(!list)continue;
      for(let i=0;i<list.length;i++){
        const plant=list[i];if(plant.entity?.destroyed||plant.stage!=='mature')continue;
        const model=BOTANICAL_TREE_MODELS[plant.species];
        if(model&&model.height<1.8)continue;
        const px=plant.x+0.5-x,py=plant.y+0.5-y,d2=px*px+py*py;
        if(d2<bestDist2){bestDist2=d2;best=plant;}
      }
    }
    return best;
  }

  urbanPenalty(x, y) {
    let penalty = 0;
    for (const b of this.city.buildings || []) {
      if (b.entity?.destroyed) continue;
      const cx = b.entity.x + (b.width || 3) * 0.5, cy = b.entity.y + (b.depth || 3) * 0.5;
      if (Math.abs(cx - x) >= 12 || Math.abs(cy - y) >= 12) continue;
      const d = Math.hypot(cx - x, cy - y);
      if (d < 12) penalty += (12 - d);
    }
    const buckets=getFaunaCitizenGrid(this.city),bx=Math.floor(x/12),by=Math.floor(y/12);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const list=buckets.get((((bx+dx)&0xFFFF)<<16)|((by+dy)&0xFFFF));if(!list)continue;
      for(let i=0;i<list.length;i++){
        const c=list[i];if(c.dead||!c.entity||c.entity.destroyed)continue;
        const cx=c.entity.x-x,cy=c.entity.y-y;if(Math.abs(cx)>=8||Math.abs(cy)>=8)continue;
        const d=Math.hypot(cx,cy);if(d<8)penalty+=(8-d)*1.5;
      }
    }
    return penalty;
  }

  surfacePerchCandidates(bx, by, maxDist = 16) {
    const candidates = [];
    const tree = this.findTreeSpot(bx, by, maxDist);
    if (tree) candidates.push(this.treePerchSpot(tree, Math.floor(bx * 7 + by * 13) || tree.id));
    for (const b of this.city.buildings || []) {
      if (b.entity?.destroyed || !b.entity) continue;
      const cx = b.entity.x + (b.width || 3) * 0.5, cy = b.entity.y + (b.depth || 3) * 0.5;
      if (Math.hypot(cx - bx, cy - by) > maxDist) continue;
      if (['farm', 'park', 'cattle_ranch', 'dairy_farm', 'sheep_farm', 'pig_farm', 'poultry', 'hay_farm'].includes(b.type)) {
        // Exact fence post cap position (skipping gate area around b.door)
        const px = b.entity.x + 0.04, py = b.entity.y + 0.04;
        if (!b.door || Math.hypot(px - b.door.x, py - b.door.y) >= 1.4) {
          candidates.push({ x: px, y: py, z: 0.8, surface: 'fence', buildingId: b.id });
        }
      } else if (b.constructionKind !== 'open-air') {
        const balconies = b.units?.length ? buildingLeisureSpaces(b).filter(s => s.kind === 'balcony') : [];
        for (const bal of balconies) {
          candidates.push({ x: b.entity.x + bal.position.x, y: b.entity.y + bal.position.y, z: bal.position.z + 0.02, surface: 'balcony', buildingId: b.id });
        }
        // Roof eave/edge at exact CITY_FLOOR_HEIGHT so it sits on the roof, never inside a gable or floating
        candidates.push({ x: b.entity.x + 0.35, y: b.entity.y + 0.35, z: (b.floors || 1) * CITY_FLOOR_HEIGHT + 0.12, surface: 'roof', buildingId: b.id });
      }
    }
    return candidates;
  }

  tryBuildNest(bird) {
    if (!bird || bird.nestId && this.nests.has(bird.nestId)) return this.nests.get(bird.nestId);
    const candidates = this.surfacePerchCandidates(bird.x, bird.y, 16);
    if (!candidates.length) return null;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const nest = this.placeNest({ ...pick, species: bird.species, ownerId: bird.id, eggs: 1 + Math.floor(Math.random() * 3) });
    if (nest) bird.nestId = nest.id;
    return nest;
  }

  grazeCell(tx, ty, duration = 90, exactX = tx + 0.5, exactZ = ty + 0.5, radius = 0.38) {
    const key = `${tx},${ty}`;
    const due = this.city.minute + duration;
    const patch = { x: exactX, z: exactZ, r2: radius * radius, due };
    if (!this.grazedTiles.has(key)) {
      this.grazedTiles.set(key, patch);
      this.grazeRevision++;
    } else {
      this.grazedTiles.set(key, patch);
    }
  }

  canOccupy(x, y, species, buildingId = null, altitude = 0) {
    const spec = ANIMAL_SPECIES[species];
    if (!spec) return false;
    const city = this.city, world = city.world;
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= world.width || iy >= world.height) return false;
    if (spec.canFly && altitude > 0.5) return true;
    const tile = tileAt(world, ix, iy);
    if (!spec.terrain.includes(tile)) return false;
    if (ROAD_TILES.has(tile) || world.hasSidewalk?.(ix, iy)) return false;
    const key = `${ix},${iy}`;
    if (city.occupied?.has(key)) return false;
    if (city.development?.plots?.some(p => (buildingId == null || p.buildingId !== buildingId) && ix >= p.x && ix < p.x + p.width && iy >= p.y && iy < p.y + p.depth)) return false;
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
    if (!options.force && !this.canOccupy(x, y, species, options.buildingId ?? null)) return null;
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
      tamed: !!options.tamed,
      ownerId: options.ownerId ?? null,
      accountId: options.accountId ?? null,
      role: spec.role || 'companion',
      riderId: null,
      x: entity.x,
      y: entity.y,
      altitude: 0,
      targetAltitude: 0,
      inTreePlantId: null,
      nestId: null,
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
        if (!spec.canFly && this.urbanPenalty(x + 0.5, y + 0.5) > 6 && attempt < target * 25) continue;
        if (this.spawn(x, y, species)) spawned++;
      }
    }
  }

  findGrazeSpot(animal) {
    const spec = ANIMAL_SPECIES[animal.species];
    if (!spec?.grazesGrass) return null;
    const ranch = animal.buildingId != null ? this.city.building?.(animal.buildingId) : null;
    const cx = Math.floor(animal.x), cy = Math.floor(animal.y);
    for (let attempt = 0; attempt < 12; attempt++) {
      const tx = ranch
        ? Math.floor(ranch.entity.x + 0.5 + Math.random() * Math.max(1, ranch.width - 1))
        : cx + Math.floor(Math.random() * 7) - 3;
      const ty = ranch
        ? Math.floor(ranch.entity.y + 0.5 + Math.random() * Math.max(1, ranch.depth - 1))
        : cy + Math.floor(Math.random() * 7) - 3;
      const tile = tileAt(this.city.world, tx, ty);
      if ((tile === 0 || tile === 9) && !this.grazedTiles.has(`${tx},${ty}`) && this.canOccupy(tx, ty, animal.species, animal.buildingId)) {
        return { x: tx + 0.5, y: ty + 0.5 };
      }
    }
    return null;
  }

  nearbyThreat(animal) {
    const spec = ANIMAL_SPECIES[animal.species];
    const radius = spec.temperament === 'predator' ? FAUNA_RULES.predatorSightRadius : FAUNA_RULES.fleeRadius;
    const buckets=getFaunaCitizenGrid(this.city),r=Math.ceil(radius/12),bx=Math.floor(animal.x/12),by=Math.floor(animal.y/12);
    let closest = null, bestDist2 = radius * radius;
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      const list=buckets.get((((bx+dx)&0xFFFF)<<16)|((by+dy)&0xFFFF));if(!list)continue;
      for(let i=0;i<list.length;i++){
        const c=list[i];if(c.dead||!c.entity||c.entity.destroyed)continue;
        const cx=c.entity.x-animal.x,cy=c.entity.y-animal.y,d2=cx*cx+cy*cy;
        if(d2<bestDist2){bestDist2=d2;closest={x:c.entity.x,y:c.entity.y,kind:'citizen',citizen:c,dist:Math.sqrt(d2)};}
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
      if (this.canOccupy(nx, ny, animal.species, animal.buildingId, animal.altitude || 0)) {
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
    const avoidUrban = !animal.tamed && animal.category === 'wild' && !spec.canFly;
    let best = null, bestPenalty = Infinity;
    for (let attempt = 0; attempt < 12; attempt++) {
      const tx = ranch
        ? ranch.entity.x + 0.6 + Math.random() * Math.max(1, ranch.width - 1.2)
        : Math.floor(animal.x) + Math.floor(Math.random() * 19) - 9 + 0.5;
      const ty = ranch
        ? ranch.entity.y + 0.6 + Math.random() * Math.max(1, ranch.depth - 1.2)
        : Math.floor(animal.y) + Math.floor(Math.random() * 19) - 9 + 0.5;
      if (Math.hypot(tx - animal.x, ty - animal.y) < 1.2) continue;
      const ok = spec.nearWater ? this.matchesHabitat(Math.floor(tx), Math.floor(ty), animal.species) : this.canOccupy(tx, ty, animal.species, animal.buildingId);
      if (!ok) continue;
      if (!avoidUrban) return { x: tx, y: ty };
      const p = this.urbanPenalty(tx, ty);
      if (p < bestPenalty) { bestPenalty = p; best = { x: tx, y: ty }; if (p === 0) break; }
    }
    return best;
  }

  markDead(animal, action = 'Abatido', minute = this.city.minute) {
    if (!animal) return;
    const spec = ANIMAL_SPECIES[animal.species] || {};
    const food = Math.max(25, Math.round((spec.size || 0.8) * 100));
    animal.dead = true;
    animal.deadAt = animal.deadAt ?? minute;
    animal.altitude = 0;
    animal.targetAltitude = 0;
    animal.inTreePlantId = null;
    animal.targetX = null;
    animal.targetY = null;
    animal.state = 'sleep';
    animal.action = action;
    if (animal.carcassFood == null) {
      animal.carcassFood = food;
      animal.carcassMaxFood = food;
    }
  }

  findCarcass(eater, maxDist = 16) {
    let closest = null, bestDist = maxDist;
    for (const a of this.animals.values()) {
      if (a === eater || !a.dead || a.entity?.destroyed || (a.carcassFood ?? 0) <= 0) continue;
      const d = Math.hypot(a.x - eater.x, a.y - eater.y);
      if (d < bestDist) { bestDist = d; closest = a; }
    }
    return closest ? { animal: closest, dist: bestDist } : null;
  }

  feedOnCarcass(eater, carcass) {
    if (!eater || !carcass || !carcass.dead || carcass.entity?.destroyed || (carcass.carcassFood ?? 0) <= 0) return false;
    const bite = Math.min(carcass.carcassFood, 25);
    carcass.carcassFood -= bite;
    eater.hunger = Math.min(100, eater.hunger + bite * 1.4);
    eater.state = 'eat';
    eater.action = `Comendo carcaça de ${ANIMAL_SPECIES[carcass.species]?.label?.toLowerCase() || 'animal'}`;
    eater.targetX = null;
    eater.targetY = null;
    eater.targetCarcassId = null;
    eater.stateTimer = 2.5;
    if (carcass.carcassFood <= 0) {
      carcass.entity.destroyed = true;
      this.animals.delete(carcass.id);
    }
    return true;
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

    if (animal.riderId != null) return;

    // 0. Tamed companion follows owner
    if (animal.tamed && animal.role === 'companion' && animal.ownerId != null) {
      const owner = this.city.society?.citizen?.(animal.ownerId) || this.city.citizens?.find(c => c.id === animal.ownerId);
      if (owner && !owner.dead && owner.entity && !owner.entity.destroyed) {
        const dist = Math.hypot(owner.entity.x - animal.x, owner.entity.y - animal.y);
        if (dist > 3.0) {
          animal.state = 'walk';
          animal.action = 'Acompanhando tutor';
          animal.targetX = owner.entity.x;
          animal.targetY = owner.entity.y;
          animal.stateTimer = 2.5;
          return;
        }
      }
    }

    // 1. Immediate threat / predator reaction (wild/untamed only)
    const threat = animal.tamed ? null : this.nearbyThreat(animal);
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

    // 1.9 Scavenge carcasses (carnivores and omnivores)
    if ((spec.diet === 'carnivore' || spec.diet === 'omnivore') && animal.hunger < 85 && animal.stateTimer <= 0) {
      const carcass = this.findCarcass(animal, 16);
      if (carcass) {
        if (carcass.dist < 1.2) {
          this.feedOnCarcass(animal, carcass.animal);
          return;
        }
        animal.inTreePlantId = null;
        animal.state = 'walk';
        animal.action = 'Indo comer carcaça';
        animal.targetX = carcass.animal.x;
        animal.targetY = carcass.animal.y;
        animal.targetCarcassId = carcass.animal.id;
        animal.stateTimer = 3.0;
        return;
      }
    }

    // 2. Predator hunting wild prey
    if (spec.temperament === 'predator' && animal.hunger < 65) {
      const prey = this.findPrey(animal);
      if (prey) {
        if (prey.dist < 1.2) {
          this.markDead(prey.animal, 'Abatido');
          this.feedOnCarcass(animal, prey.animal);
          animal.action = `Devora ${ANIMAL_SPECIES[prey.animal.species]?.label?.toLowerCase() || 'presa'}`;
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

    // 2.5 Arboreal animals climb mature timber trees to eat and sleep
    if (spec.arboreal && animal.stateTimer <= 0) {
      const tree = this.findTreeSpot(animal.x, animal.y, 12);
      if (tree) {
        const tx = tree.x + 0.5, ty = tree.y + 0.5;
        const dist = Math.hypot(tx - animal.x, ty - animal.y);
        if (dist <= 0.9) {
          animal.inTreePlantId = tree.id;
          animal.targetAltitude = this.treeCanopyAltitude(tree);
          animal.altitude = animal.targetAltitude;
          animal.targetX = null;
          animal.targetY = null;
          if (isNight || animal.hunger >= 75) {
            animal.state = 'sleep';
            animal.action = 'Dormindo na árvore';
            animal.stateTimer = 5 + Math.random() * 5;
          } else {
            animal.state = 'eat';
            animal.action = 'Alimentando-se na copa';
            animal.stateTimer = 3.5 + Math.random() * 2.5;
          }
          return;
        }
        animal.altitude = 0;
        animal.targetAltitude = 0;
        animal.inTreePlantId = null;
        animal.state = 'walk';
        animal.action = 'Indo para árvore';
        animal.targetX = tx;
        animal.targetY = ty;
        animal.targetTreeId = tree.id;
        animal.stateTimer = 5.0;
        return;
      }
      animal.altitude = 0;
      animal.targetAltitude = 0;
      animal.inTreePlantId = null;
    }

    // 2.6 Flying birds build nests, fly, and perch
    if (spec.canFly && animal.stateTimer <= 0) {
      if (!animal.nestId && Math.random() < 0.25) this.tryBuildNest(animal);
      const nest = animal.nestId ? this.nests.get(animal.nestId) : null;
      if (isNight && nest) {
        const d = Math.hypot(nest.x - animal.x, nest.y - animal.y);
        if (d <= 0.8) {
          animal.altitude = nest.z;
          animal.state = 'sleep';
          animal.action = 'No ninho';
          animal.targetX = null;
          animal.targetY = null;
          animal.stateTimer = 6 + Math.random() * 6;
          return;
        }
        animal.state = 'walk';
        animal.action = 'Voando para o ninho';
        animal.targetX = nest.x;
        animal.targetY = nest.y;
        animal.targetAltitude = Math.max(2.2, nest.z);
        animal.stateTimer = 4.0;
        return;
      }
      if (!isNight && Math.random() < 0.7) {
        const perches = this.surfacePerchCandidates(animal.x, animal.y, 18);
        if (perches.length && Math.random() < 0.78) {
          const perch = perches[Math.floor(Math.random() * perches.length)];
          animal.state = 'walk';
          animal.action = 'Voando para poleiro';
          animal.targetX = perch.x;
          animal.targetY = perch.y;
          animal.perchAltitude = perch.z;
          animal.targetAltitude = Math.max(2.2, perch.z + 0.8);
          animal.stateTimer = 4.5;
          return;
        }
        for (let attempt = 0; attempt < 10; attempt++) {
          const fx = Math.max(1, Math.min(this.city.world.width - 2, Math.floor(animal.x) + Math.floor(Math.random() * 25) - 12 + 0.5));
          const fy = Math.max(1, Math.min(this.city.world.height - 2, Math.floor(animal.y) + Math.floor(Math.random() * 25) - 12 + 0.5));
          if (!this.canOccupy(fx, fy, animal.species, animal.buildingId, 0)) continue;
          animal.state = 'walk';
          animal.action = 'Voando';
          animal.targetX = fx;
          animal.targetY = fy;
          animal.perchAltitude = 0;
          animal.targetAltitude = 2.2 + Math.random() * 1.4;
          animal.stateTimer = 4.5;
          return;
        }
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
      const tx = Math.floor(animal.x), ty = Math.floor(animal.y), tile = tileAt(this.city.world, tx, ty);
      if (spec.grazesGrass) {
        if ((tile === 0 || tile === 9) && !this.grazedTiles.has(`${tx},${ty}`) && Math.random() < 0.65) {
          this.grazeCell(tx, ty, 90, animal.x, animal.y);
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
    this.pruneOrphanedNests();

    for (const animal of this.animals.values()) {
      if (animal.dead || animal.entity?.destroyed) {
        animal.altitude = 0;
        animal.targetAltitude = 0;
        animal.inTreePlantId = null;
        continue;
      }
      const spec = ANIMAL_SPECIES[animal.species];
      if (animal.riderId != null) {
        const rider = this.city.society?.citizen?.(animal.riderId) || this.city.citizens?.find(c => c.id === animal.riderId);
        if (!rider || rider.dead || rider.entity?.destroyed || rider.ridingAnimalId !== animal.id) {
          animal.riderId = null;
          animal.state = 'idle';
        } else {
          const dx = rider.entity.x - animal.x, dy = rider.entity.y - animal.y;
          const moved = Math.hypot(dx, dy) > 0.002;
          if (moved) animal.angle = Math.atan2(dx, dy);
          animal.x = rider.entity.x;
          animal.y = rider.entity.y;
          animal.entity.x = rider.entity.x;
          animal.entity.y = rider.entity.y;
          animal.altitude = 0;
          animal.targetAltitude = 0;
          animal.inTreePlantId = null;
          animal.state = moved ? 'walk' : 'idle';
          animal.action = 'Servindo de montaria';
          continue;
        }
      }
      if (animal.inTreePlantId != null) {
        const hostTree = this.city.nature?.plants?.get?.(animal.inTreePlantId);
        const onTree = hostTree && !hostTree.entity?.destroyed && Math.hypot(hostTree.x + 0.5 - animal.x, hostTree.y + 0.5 - animal.y) <= 1.2 && (animal.state === 'eat' || animal.state === 'sleep');
        if (!onTree) {
          animal.inTreePlantId = null;
          animal.altitude = 0;
          animal.targetAltitude = 0;
          if (!hostTree || hostTree.entity?.destroyed) animal.state = 'idle';
        }
      }
      animal.stateTimer = Math.max(0, (animal.stateTimer ?? 0) - stepDt);
      animal.thinkTimer = (animal.thinkTimer ?? 0) - stepDt;

      if (animal.thinkTimer <= 0) {
        animal.thinkTimer = 0.4 + Math.random() * 0.5;
        this.decideBehavior(animal, isNight);
      }

      if (!spec?.canFly && animal.inTreePlantId == null) {
        animal.altitude = 0;
        animal.targetAltitude = 0;
      }

      if (animal.state === 'eat') {
        animal.hunger = Math.min(100, animal.hunger + 8 * stepDt);
      }

      // Smoothly ascend or descend toward targetAltitude
      const targetAlt = animal.targetAltitude ?? animal.altitude ?? 0;
      if (Math.abs((animal.altitude || 0) - targetAlt) > 0.01) {
        const diff = targetAlt - (animal.altitude || 0);
        const step = Math.min(Math.abs(diff), 2.2 * stepDt);
        animal.altitude = (animal.altitude || 0) + Math.sign(diff) * step;
      }

      if (animal.targetX != null && (animal.state === 'walk' || animal.state === 'flee')) {
        const spec = ANIMAL_SPECIES[animal.species];
        if (spec?.canFly) {
          const distLeft = Math.hypot(animal.targetX - animal.x, animal.targetY - animal.y);
          const destAlt = animal.action === 'Voando para poleiro' ? (animal.perchAltitude ?? 1.5) : animal.action === 'Voando para o ninho' ? (this.nests.get(animal.nestId)?.z ?? 1.8) : 0.25;
          animal.targetAltitude = distLeft < 1.8 ? destAlt : Math.max(animal.targetAltitude || 0, destAlt + 0.6, 2.2);
        }
        const arrived = this.moveTowards(animal, animal.targetX, animal.targetY, animal.state === 'flee' ? 1.75 : 1.0, stepDt);
        if (arrived) {
          animal.targetX = null;
          animal.targetY = null;
          if (animal.action === 'Voando para poleiro') {
            animal.targetAltitude = animal.perchAltitude ?? 1.5;
            animal.state = 'idle';
            animal.action = 'Empoleirado';
            animal.stateTimer = 3.0 + Math.random() * 4.0;
            animal.thinkTimer = 0.5;
          } else if (animal.action === 'Indo comer carcaça' && animal.targetCarcassId != null) {
            const carcass = this.animals.get(animal.targetCarcassId);
            if (!this.feedOnCarcass(animal, carcass)) {
              animal.targetCarcassId = null;
              animal.state = 'idle';
              animal.action = 'Observando';
              animal.stateTimer = 1.0;
            }
            animal.targetAltitude = 0;
            animal.thinkTimer = 0.5;
          } else if (animal.action === 'Indo para árvore' && spec?.arboreal) {
            const tree = animal.targetTreeId != null ? this.city.nature?.plants?.get?.(animal.targetTreeId) : this.findTreeSpot(animal.x, animal.y, 2);
            animal.inTreePlantId = tree?.id ?? null;
            animal.targetAltitude = tree ? this.treeCanopyAltitude(tree) : 0;
            animal.altitude = animal.targetAltitude;
            animal.state = tree ? 'eat' : 'idle';
            animal.action = tree ? 'Alimentando-se na copa' : 'Observando';
            animal.stateTimer = 3.5 + Math.random() * 2.5;
            animal.thinkTimer = 0.5;
          } else if (animal.action === 'Voando para o ninho' && animal.nestId && this.nests.has(animal.nestId)) {
            const nest = this.nests.get(animal.nestId);
            animal.targetAltitude = nest.z;
            animal.state = 'sleep';
            animal.action = 'No ninho';
            animal.stateTimer = 6.0;
            animal.thinkTimer = 0.5;
          } else if (animal.action === 'Procurando pasto') {
            this.grazeCell(Math.floor(animal.x), Math.floor(animal.y), 90, animal.x, animal.y);
            animal.targetAltitude = 0;
            animal.state = 'eat';
            animal.action = 'Pastando grama';
            animal.stateTimer = 3.0 + Math.random() * 2.0;
            animal.thinkTimer = 0.5;
          } else {
            const overWater = tileAt(this.city.world, Math.floor(animal.x), Math.floor(animal.y)) === TILE_WATER;
            if (spec?.canFly && overWater) {
              animal.targetAltitude = 2.4;
              animal.thinkTimer = 0.1;
            } else {
              animal.targetAltitude = 0;
              animal.state = 'idle';
              animal.action = 'Observando';
              animal.stateTimer = 0.8 + Math.random() * 1.2;
              animal.thinkTimer = 0.3;
            }
          }
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
      const target = Math.min(6, Math.max(2, Math.floor(((b.width || 4) * (b.depth || 4)) / 8)));
      const bx = b.entity.x, by = b.entity.y, bw = Math.max(2, b.width || 4), bd = Math.max(2, b.depth || 4);
      for (let attempt = 0; attempt < 20 && count < target; attempt++) {
        const species = speciesList[count % speciesList.length];
        const x = Math.floor(bx + 0.5 + Math.random() * (bw - 1));
        const y = Math.floor(by + 0.5 + Math.random() * (bd - 1));
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
      this.markDead(target, 'Abatido', this.city.minute);
      const spec = ANIMAL_SPECIES[target.species];
      const bag = lodge?.inventory || (hunter.inventory ??= {});
      for (const [good, qty] of Object.entries(spec?.products || {})) {
        bag[good] = (bag[good] || 0) + qty;
      }
      return { status: 'harvested', animal: target, products: spec?.products || {} };
    }
    return { status: 'wounded', animal: target, health: target.health };
  }

  tameAnimal(citizen, animal) {
    if (!citizen || !animal || animal.dead || animal.entity?.destroyed) return false;
    const spec = ANIMAL_SPECIES[animal.species];
    if (!spec?.tameable) return false;
    animal.tamed = true;
    animal.category = 'tamed';
    animal.ownerId = citizen.id;
    animal.accountId = citizen.accountId || null;
    animal.role = spec.role || 'companion';
    animal.state = 'idle';
    animal.action = animal.role === 'mount' ? 'Montaria domesticada' : 'Companhia';
    animal.targetX = null;
    animal.targetY = null;
    citizen.animalIds ??= [];
    if (!citizen.animalIds.includes(animal.id)) citizen.animalIds.push(animal.id);
    return true;
  }

  mountAnimal(citizen, animal) {
    if (!citizen || !animal || animal.dead || animal.entity?.destroyed) return false;
    if (!animal.tamed || animal.role !== 'mount') return false;
    if (animal.riderId != null && animal.riderId !== citizen.id) return false;
    if (citizen.ridingAnimalId != null && citizen.ridingAnimalId !== animal.id) this.dismountAnimal(citizen);
    animal.riderId = citizen.id;
    animal.state = 'idle';
    animal.action = 'Servindo de montaria';
    animal.targetX = null;
    animal.targetY = null;
    citizen.ridingAnimalId = animal.id;
    return true;
  }

  dismountAnimal(citizen) {
    if (!citizen || citizen.ridingAnimalId == null) return false;
    const animal = this.animals.get(citizen.ridingAnimalId);
    if (animal && animal.riderId === citizen.id) {
      animal.riderId = null;
      animal.state = 'idle';
      animal.action = 'Montaria em repouso';
    }
    citizen.ridingAnimalId = null;
    return true;
  }

  mountSpeedFor(citizen) {
    if (citizen?.ridingAnimalId == null) return 1;
    const animal = this.animals.get(citizen.ridingAnimalId);
    if (!animal || animal.dead || animal.riderId !== citizen.id) return 1;
    return ANIMAL_SPECIES[animal.species]?.mountSpeed || 1.5;
  }

  tradeAnimal(seller, buyer, animal, price = null) {
    if (!buyer || !animal || animal.dead || animal.entity?.destroyed) return false;
    const spec = ANIMAL_SPECIES[animal.species];
    const amount = price ?? spec?.marketPrice ?? 4000;
    const buyerAcc = buyer.accountId;
    const sellerAcc = seller?.accountId || animal.accountId || 'treasury';
    if (!buyerAcc || !this.city.transfer?.(buyerAcc, sellerAcc, amount, `Compra de ${spec?.label || animal.species}`)) {
      return false;
    }
    if (animal.riderId != null) {
      const prevRider = this.city.society?.citizen?.(animal.riderId) || this.city.citizens?.find(c => c.id === animal.riderId);
      if (prevRider) this.dismountAnimal(prevRider);
    }
    if (seller?.animalIds) seller.animalIds = seller.animalIds.filter(id => id !== animal.id);
    animal.tamed = true;
    animal.category = 'tamed';
    animal.ownerId = buyer.id;
    animal.accountId = buyerAcc;
    animal.role = spec?.role || 'companion';
    buyer.animalIds ??= [];
    if (!buyer.animalIds.includes(animal.id)) buyer.animalIds.push(animal.id);
    return true;
  }

  updateMinute() {
    const minute = this.city.minute;
    if (minute % 15 === 0) this.syncRanches();
    for (const [key, patch] of this.grazedTiles) {
      const due = patch?.due ?? patch;
      if (minute >= due) {
        this.grazedTiles.delete(key);
        this.grazeRevision++;
      }
    }
    const hour = Math.floor((minute % 1440) / 60);
    const isNight = hour >= 22 || hour < 5;

    for (const [id, animal] of this.animals) {
      if (animal.entity?.destroyed) { this.animals.delete(id); continue; }
      if (animal.dead) {
        if ((animal.carcassFood != null && animal.carcassFood <= 0) || (animal.deadAt != null && minute - animal.deadAt >= 120)) {
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
          this.markDead(animal, 'Morto por inanição', minute);
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
