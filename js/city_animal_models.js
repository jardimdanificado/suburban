import { ANIMAL_CLIPS, ANIMAL_SPECIES, ANIMAL_SPECIES_IDS } from './animal_catalog.js';
import { parseCitizenOBJ } from './city_citizen_models.js';

export function animalAnimation(animal, moving = false) {
  if (!animal) return 'idle';
  if (animal.dead || animal.state === 'sleep') return 'sleep';
  if (moving) return 'walk';
  if (animal.state === 'eat') return 'eat';
  return 'idle';
}

export function animalFrame(clip, time, phase = 0, speed = 1, gait = null) {
  const frames = ANIMAL_CLIPS[clip] || ANIMAL_CLIPS.idle;
  if (frames.length === 1) return { clip, frame: frames[0] };
  if (clip === 'walk' && gait != null) {
    return { clip, frame: frames[Math.floor(Math.max(0, gait)) % frames.length] };
  }
  const fps = clip === 'walk' ? 10 * Math.max(0.7, Math.min(1.6, speed)) : clip === 'eat' ? 5 : 1;
  const index = Math.floor(Math.max(0, time) * fps + phase) % frames.length;
  return { clip, frame: frames[index] };
}

export class CityAnimalModels {
  constructor(THREE, group, options = {}) {
    this.THREE = THREE;
    this.group = group;
    this.decorateMaterial = options.decorateMaterial || null;
    this.fetchAsset = options.fetchAsset || (url => fetch(url));
    this.baseURL = options.baseURL || new URL('../data/animals/', import.meta.url);
    this.frames = new Map();
    this.batches = new Map();
    this.activeBatches = new Set();
    this.motion = new WeakMap();
    this.clock = 0;
    this.frameDelta = 0.016;
    this.ready = false;
    this.error = null;
    this.material = new THREE.MeshLambertMaterial({ color: 0xffffff });
    if (this.decorateMaterial) this.decorateMaterial(this.material);
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
    this.axis = new THREE.Vector3(0, 1, 0);
    this.color = new THREE.Color();
    this.loading = options.autoLoad === false ? Promise.resolve(false) : this.load();
  }

  async load() {
    try {
      const tasks = [];
      for (const species of ANIMAL_SPECIES_IDS) {
        for (const [clip, frames] of Object.entries(ANIMAL_CLIPS)) {
          for (const frame of frames) {
            tasks.push((async () => {
              const response = await this.fetchAsset(new URL(`${species}/${clip}/${frame}.obj`, this.baseURL));
              if (!response.ok) throw Error(`Falha em ${species}/${clip}/${frame}.obj (${response.status})`);
              const data = parseCitizenOBJ(await response.text());
              const geometry = new this.THREE.BufferGeometry();
              geometry.setAttribute('position', new this.THREE.Float32BufferAttribute(data.positions, 3));
              geometry.setAttribute('normal', new this.THREE.Float32BufferAttribute(data.normals, 3));
              geometry.computeBoundingSphere();
              this.frames.set(`${species}:${clip}:${frame}`, geometry);
            })());
          }
        }
      }
      await Promise.all(tasks);
      this.ready = true;
      return true;
    } catch (error) {
      this.error = error;
      this.ready = false;
      return false;
    }
  }

  begin(dt = 0, speed = 1) {
    this.frameDelta = Math.max(0, Math.min(0.1, dt));
    this.clock += this.frameDelta * Math.max(0, Math.min(2, speed));
    for (const batch of this.activeBatches) {
      batch.count = 0;
      if (batch.mesh) batch.mesh.count = 0;
    }
    this.activeBatches.clear();
  }

  add(entity, surfaceH = 0, options = {}) {
    if (!this.ready) return false;
    const animal = entity?.properties?.cityAnimal;
    if (!animal || entity.destroyed) return false;
    const species = animal.species;
    const spec = ANIMAL_SPECIES[species];
    if (!spec) return false;

    let motion = this.motion.get(entity);
    if (!motion) {
      motion = { x: entity.x, y: entity.y, lastSimX: entity.x, lastSimY: entity.y, gait: 0, moving: false, angle: animal.angle || 0 };
      this.motion.set(entity, motion);
    }
    const simStep = Math.hypot(entity.x - motion.lastSimX, entity.y - motion.lastSimY);
    motion.lastSimX = entity.x;
    motion.lastSimY = entity.y;
    const alpha = 1 - Math.exp(-Math.max(0.001, this.frameDelta || 0.016) * 20);
    motion.x = entity.x;
    motion.y = entity.y;
    motion.moving = (animal._renderMoving !== undefined ? animal._renderMoving : (animal.state === 'walk' || animal.state === 'flee')) && simStep > 0.0008;
    if (motion.moving) motion.gait += (simStep * 12) / Math.max(0.45, spec.size || 0.8);

    const targetAngle = animal.angle ?? motion.angle;
    let deltaAngle = targetAngle - motion.angle;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    motion.angle += deltaAngle * alpha;

    const clip = animalAnimation(animal, motion.moving);
    const phase = ((entity.id || 0) % 17) * 0.37;
    const { frame } = animalFrame(clip, this.clock, phase, spec.speed || 1, motion.gait);
    const key = `${species}:${clip}:${frame}`;
    const source = this.frames.get(key) || this.frames.get(`${species}:idle:0`);
    if (!source) return false;

    let batch = this.batches.get(key);
    if (!batch) {
      batch = { count: 0, capacity: 0, mesh: null };
      this.batches.set(key, batch);
    }
    this.activeBatches.add(batch);
    if (batch.count === batch.capacity) {
      const capacity = Math.max(16, batch.capacity * 2);
      const mesh = new this.THREE.InstancedMesh(source, this.material, capacity);
      mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      if (batch.mesh) {
        for (let i = 0; i < batch.count; i++) {
          batch.mesh.getMatrixAt(i, this.matrix);
          mesh.setMatrixAt(i, this.matrix);
          batch.mesh.getColorAt(i, this.color);
          mesh.setColorAt(i, this.color);
        }
        this.group.remove(batch.mesh);
        batch.mesh.dispose();
      }
      this.group.add(mesh);
      batch.mesh = mesh;
      batch.capacity = capacity;
    }

    const size = (entity.properties.render?.size ?? spec.size ?? 1) * (options.perspective ? 1.05 : 1);
    this.position.set(motion.x, surfaceH, motion.y);
    this.quaternion.setFromAxisAngle(this.axis, motion.angle);
    this.scale.set(size, size, size);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    batch.mesh.setMatrixAt(batch.count, this.matrix);
    this.color.setHex(entity.properties.render?.color ?? spec.color ?? 0xd9d2c5);
    if (options.selected) this.color.offsetHSL?.(0, -0.1, 0.22);
    batch.mesh.setColorAt(batch.count, this.color);
    batch.count++;
    return true;
  }

  end() {
    for (const batch of this.activeBatches) {
      if (!batch.mesh) continue;
      batch.mesh.count = batch.count;
      if (batch.count > 0) {
        batch.mesh.instanceMatrix.needsUpdate = true;
        if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  clear() {
    for (const batch of this.batches.values()) {
      if (batch.mesh) {
        this.group.remove(batch.mesh);
        batch.mesh.dispose();
      }
    }
    this.batches.clear();
    this.activeBatches.clear();
    this.motion = new WeakMap();
    this.clock = 0;
  }
}
