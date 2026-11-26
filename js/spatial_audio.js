import { ANIMAL_SPECIES } from './animal_catalog.js';

// Spatial game audio. Every ember (fauna, construction sites, city ambience)
// gets a PannerNode placed at its world position; the listener follows the
// active camera, so panning and distance change as the camera moves.
// Pausing stops every source immediately: no fade, no queued voices.

export const DEFAULT_MANIFEST_URL = 'data/audio/manifest.json';
export const MAX_AUDIBLE_SPEED = 16;
const WATER_TILE = 2;
const SAND_TILE = 3;
const VOID_TILE = 5;
const GRASS_TILES = new Set([0, 9]);
const SWIM_TASKS = new Set(['swim-leisure', 'swim-hygiene', 'swim-exit']);
const TALK_TASKS = new Set(['social', 'visit', 'interview', 'campaign']);
const FORAGE_TASKS = new Set(['forage', 'informal-gardening']);
const BIKE_KINDS = new Set(['bicicleta', 'bicicleta_carga']);
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const FAUNA_VOICE_LIMIT = 3;
const FAUNA_CALL_MAX_DURATION = 5.5;
const MAX_PERSON_VOICES = 32;
const CHANNEL_FILES = {};
// Event kind to positional one-shot. `duration` trims long recordings such as
// the 27 s door latch down to one open.
const EVENT_SOUNDS = {
  construction: { key: 'hammer', gain: 0.5, duration: 2 },
  'project-started': { key: 'hammer', gain: 0.45, duration: 2 },
  'service-contracted': { key: 'hammer', gain: 0.45, duration: 2 },
  'business-founded': { key: 'cash_register', gain: 0.4, duration: 2.2 },
  purchase: { key: 'coins', gain: 0.35, duration: 1.1 },
  'home-lease': { key: 'coins', gain: 0.3, duration: 1.1 },
  'bill-voted': { key: 'gavel', gain: 0.5, duration: 2.5 },
  'council-elected': { key: 'gavel', gain: 0.4, duration: 2.5 },
};

// Same curve as the PannerNode 'inverse' distance model, kept pure so the
// selection code and the tests can reason about loudness without Web Audio.
export function distanceAttenuation(distance, { refDistance = 4, maxDistance = 40, rolloffFactor = 1.2 } = {}) {
  if (!(distance > 0)) return 1;
  if (distance >= maxDistance) return 0;
  const d = Math.max(distance, refDistance);
  return Math.max(0, Math.min(1, refDistance / (refDistance + rolloffFactor * (d - refDistance))));
}

export function isNightHour(hour) {
  if (!Number.isFinite(hour)) return false;
  return hour < 6 || hour >= 19;
}

// The orthographic camera never moves vertically: zoom shrinks the frustum.
// Translate that frustum height into a listening altitude, so zoomed out means
// high above the city (wind, music) and zoomed in means ears on the street.
export function isometricAltitude(zoom) {
  const value = Number.isFinite(zoom) ? Math.max(0.3, Math.min(12, zoom)) : 1.2;
  return (28 / value) * 0.5;
}

// High above the city the wind takes over; at street level it is inaudible.
export function windGain(altitude) {
  if (!Number.isFinite(altitude)) return 0;
  return Math.max(0, Math.min(1, (altitude - 6) / 34)) * 0.7;
}

// Music plays only high above the city (sky view); street level stays silent.
export function musicSkyGain(altitude) {
  if (!Number.isFinite(altitude)) return 0;
  return Math.max(0, Math.min(1, (altitude - 14) / 22));
}

// Ground-level sounds (waves, footsteps, voices, fauna) fade out as the
// camera rises into the sky, leaving only wind and music high above.
export function groundAudibility(altitude) {
  if (!Number.isFinite(altitude)) return 1;
  return Math.max(0, Math.min(1, 1 - (altitude - 12) / 10));
}

// Listener pose in world units. Isometric views listen from the camera focus
// plus the altitude implied by the zoom: zoomed out is high above the city,
// zoomed in drops the ears to street level. Perspective views use the eye.
export function listenerPose(renderer, groundY = 1) {
  if (!renderer) return null;
  const perspective = typeof renderer.isPerspectiveActive === 'function' && renderer.isPerspectiveActive();
  const camera = perspective ? renderer.fpCamera : renderer.camera;
  if (!camera?.position) return null;
  const m = camera.matrixWorld?.elements;
  let fx = 0, fy = 0, fz = -1;
  if (m && m.length >= 11) {
    const length = Math.hypot(m[8], m[9], m[10]) || 1;
    fx = -m[8] / length; fy = -m[9] / length; fz = -m[10] / length;
  }
  if (perspective) {
    const p = camera.position;
    return { x: p.x, y: p.y, z: p.z, fx, fy, fz, altitude: Math.max(0, p.y - groundY) };
  }
  const x = Number(renderer.camX), z = Number(renderer.camY);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  const altitude = isometricAltitude(renderer.zoom);
  let dx = x - camera.position.x, dz = z - camera.position.z;
  const length = Math.hypot(dx, dz);
  if (length > 1e-6) { dx /= length; dz /= length; } else { dx = 0; dz = -1; }
  return { x, y: groundY + altitude, z, fx: dx, fy: 0, fz: dz, altitude };
}

// Square root of horizontal plus vertical separation. Sources sit near the
// ground, so the listener altitude alone can silence the whole city.
function sourceDistance(listener, x, z, sourceY = 1) {
  const vertical = (listener.y ?? sourceY) - sourceY;
  return Math.hypot(x - listener.x, z - listener.z, vertical);
}

// Weighted pick of one animal that is allowed to call right now.
export function chooseFaunaCall({ animals, listener, species = ANIMAL_SPECIES, random = Math.random, now = 0, radius = 22, cooldown = 6, lastCallAt = new Map(), night = false } = {}) {
  if (!listener || !animals) return null;
  const options = [];
  for (const animal of animals) {
    if (!animal || animal.dead || animal.entity?.destroyed) continue;
    const spec = species[animal.species];
    if (!spec) continue;
    if (animal.state === 'sleep') continue;
    const distance = sourceDistance(listener, animal.x, animal.y, (animal.altitude || 0) + 1);
    if (distance > radius) continue;
    if (now - (lastCallAt.get(animal.species) ?? -Infinity) < cooldown) continue;
    const attenuation = distanceAttenuation(distance, { refDistance: 4, maxDistance: radius, rolloffFactor: 1.1 });
    if (attenuation < 0.04) continue;
    let weight = attenuation;
    weight *= spec.canFly ? 1.35 : 0.85;
    if (animal.category === 'livestock') weight *= 0.7;
    if (animal.state === 'flee' || animal.provokedUntil > 0) weight *= 1.6;
    if (night) weight *= spec.bodyPlan === 'owl' || animal.species === 'urubu' ? 1.8 : spec.canFly ? 0.2 : 1;
    options.push({ animal, species: animal.species, x: animal.x, y: animal.altitude || 0, z: animal.y, distance, weight });
  }
  if (!options.length) return null;
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let roll = random() * total;
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option;
  }
  return options[options.length - 1];
}

// Ambience zones for the camera surroundings. Each zone becomes a looping
// positional emitter anchored at the nearest real feature.
export function ambiencePlan({ listener, features = {}, night = false } = {}) {
  if (!listener) return [];
  const zones = [];
  const add = (key, feature, volume, radius) => {
    if (!feature || !Number.isFinite(feature.x) || !Number.isFinite(feature.z)) return;
    const distance = sourceDistance(listener, feature.x, feature.z);
    if (distance > radius) return;
    const gain = volume * distanceAttenuation(distance, { refDistance: 6, maxDistance: radius, rolloffFactor: 0.8 });
    if (gain >= 0.03) zones.push({ key, x: feature.x, z: feature.z, distance, gain });
  };
  add('river', features.water, night ? 0.35 : 0.45, 26);
  add('beach', features.beach, night ? 0.38 : 0.48, 28);
  if (!night) add('forest_birds', features.plants, 0.34, 24);
  add('tree_leaves', features.plants, night ? 0.2 : 0.24, 24);
  add('construction', features.construction, 0.35, 24);
  add('city_street', features.buildings, night ? 0.08 : 0.12, 26);
  zones.sort((a, b) => b.gain - a.gain);
  return zones.slice(0, 4);
}

// Dirt and stone roads take dirt footsteps, sand takes sand footsteps, and
// grass/earth takes grass footsteps. Water and void get no footsteps.
const DIRT_TILES = new Set([6, 7, 8, 11, 12, 13]);
export function footstepSurface(tile) {
  if (!Number.isFinite(tile) || tile === WATER_TILE || tile === VOID_TILE) return null;
  if (tile === SAND_TILE) return 'footsteps_sand';
  return DIRT_TILES.has(tile) ? 'footsteps_dirt' : 'footsteps_grass';
}

// Densest 4x4 tile cell of citizens around the listener. The crowd emitter
// sits on the real group, so walking past a square raises its chatter.
export function crowdCluster(citizens, listener, { radius = 20, cell = 4, limit = 900 } = {}) {
  if (!citizens || !listener) return null;
  const buckets = new Map();
  let scanned = 0;
  for (const citizen of citizens) {
    if (++scanned > limit) break;
    const entity = citizen?.entity;
    if (!entity || entity.destroyed) continue;
    const distance = sourceDistance(listener, entity.x, entity.y);
    if (distance > radius) continue;
    const key = `${Math.floor(entity.x / cell)},${Math.floor(entity.y / cell)}`;
    const talking = !!(citizen.conversation || TALK_TASKS.has(citizen.task)) ? 1 : 0;
    const bucket = buckets.get(key);
    if (bucket) { bucket.count++; bucket.talkCount += talking; bucket.sx += entity.x; bucket.sz += entity.y; }
    else buckets.set(key, { count: 1, talkCount: talking, sx: entity.x, sz: entity.y });
  }
  let best = null;
  for (const bucket of buckets.values()) {
    const score = bucket.count + bucket.talkCount * 2;
    const bestScore = best ? best.count + best.talkCount * 2 : -1;
    if (score > bestScore) best = bucket;
  }
  if (!best) return null;
  return { x: best.sx / best.count, z: best.sz / best.count, count: best.count, talkCount: best.talkCount };
}

function defaultContextFactory() {
  const Constructor = globalThis.AudioContext || globalThis.webkitAudioContext;
  return Constructor ? new Constructor({ latencyHint: 'interactive' }) : null;
}

function defaultMediaFactory(url) {
  const element = new globalThis.Audio();
  element.src = url;
  element.preload = 'auto';
  element.loop = true;
  return element;
}

function setNodePosition(node, x, y, z, smooth = 0) {
  if (node.positionX) {
    const now = node.context.currentTime;
    if (smooth > 0) {
      node.positionX.setTargetAtTime(x, now, smooth);
      node.positionY.setTargetAtTime(y, now, smooth);
      node.positionZ.setTargetAtTime(z, now, smooth);
    } else {
      node.positionX.setValueAtTime(x, now);
      node.positionY.setValueAtTime(y, now);
      node.positionZ.setValueAtTime(z, now);
    }
  } else {
    node.setPosition(x, y, z);
  }
}

export class SpatialAudio {
  constructor({
    renderer = null,
    getCity = () => null,
    getPaused = () => false,
    getSpeed = () => 1,
    groundYAt = () => 1,
    onPauseChange = () => {},
    onAltitudeChange = () => {},
    manifestUrl = DEFAULT_MANIFEST_URL,
    contextFactory = defaultContextFactory,
    mediaFactory = defaultMediaFactory,
    fetchImpl = (...args) => fetch(...args),
    random = Math.random,
    volume = 0.8,
    muted = false,
    maxBufferBytes = MAX_BUFFER_BYTES,
  } = {}) {
    this.renderer = renderer;
    this.getCity = getCity;
    this.getPaused = getPaused;
    this.getSpeed = getSpeed;
    this.groundYAt = groundYAt;
    this.onPauseChange = onPauseChange;
    this.onAltitudeChange = onAltitudeChange;
    this.manifestUrl = manifestUrl;
    this.contextFactory = contextFactory;
    this.mediaFactory = mediaFactory;
    this.fetchImpl = fetchImpl;
    this.random = random;
    this.volume = volume;
    this.muted = muted;
    this.maxBufferBytes = maxBufferBytes;

    this.ctx = null;
    this.master = null;
    this.ready = false;
    this.loading = null;
    this.disposed = false;
    this.paused = null;
    this.animalFiles = {};
    this.worldFiles = {};
    this.buffers = new Map();
    this.bufferBytes = 0;
    this.playing = new Set();
    this.channels = new Map();
    this.voices = new Map();
    this.wind = null;
    this.citizenPositions = new Map();
    this.citizenCooldowns = new Map();
    this.animalCooldowns = new Map();
    this.activeWalkers = new Map();
    this.activePersonVoices = 0;
    this.indoorTrack = new Map();
    this.lastCallAt = new Map();
    this.activeFauna = 0;
    this.faunaTimer = 1.4;
    this.ambienceTimer = 0;
    this.voiceTimer = 0;
    this.doorTimer = 0;
    this.lastAltitude = 0;
    this.lastEventId = null;
  }

  async load() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const response = await this.fetchImpl(this.manifestUrl, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Manifesto de áudio indisponível (${response.status}).`);
      const manifest = await response.json();
      for (const [species, entry] of Object.entries(manifest.animals || {})) this.animalFiles[species] = entry.local_file;
      for (const [key, entry] of Object.entries(manifest.world || {})) this.worldFiles[key] = entry.local_file;
      this.ready = true;
      return manifest;
    })();
    try { return await this.loading; } finally { this.loading = null; }
  }

  get available() { return this.ready; }

  ensureContext() {
    if (this.ctx || this.disposed) return this.ctx;
    try { this.ctx = this.contextFactory(); } catch { return null; }
    if (!this.ctx) return null;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  async unlock() {
    const context = this.ensureContext();
    if (!context) return;
    try {
      if (context.state === 'suspended') await context.resume();
    } catch {}
    // Media-element loops rejected before the first gesture must be retried.
    for (const channel of this.channels.values()) {
      if (!channel.element.paused) continue;
      channel.element.play().catch(() => {});
    }
    for (const voice of this.voices.values()) {
      if (!voice.element.paused) continue;
      voice.element.play().catch(() => {});
    }
    if (this.wind?.element.paused) this.wind.element.play().catch(() => {});
  }

  setMuted(value) {
    this.muted = !!value;
    this.applyMasterGain();
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    this.applyMasterGain();
  }

  applyMasterGain() {
    if (!this.master || !this.ctx) return;
    const value = this.muted ? 0 : this.volume;
    this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.04);
  }

  setPaused(paused) {
    paused = !!paused;
    if (paused === this.paused) return false;
    this.paused = paused;
    if (paused) this.silenceSources();
    else this.resumeLoops();
    this.onPauseChange(paused);
    return true;
  }

  // Pause resumed: loops restart on the same frame, and a suspended audio
  // context gets one more chance to run.
  resumeLoops() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume?.().catch?.(() => {});
    for (const channel of this.channels.values()) {
      if (channel.element.paused) channel.element.play().catch(() => {});
    }
    for (const voice of this.voices.values()) {
      if (voice.element.paused) voice.element.play().catch(() => {});
    }
    const wind = this.wind;
    if (wind && wind.element.paused && windGain(this.lastAltitude || 0) > 0.02) {
      wind.element.play().catch(() => {});
    }
  }

  // Hard stop: every buffer source is stopped on the spot and every loop is
  // paused. Nothing decays through a fade, so pause is truly silent.
  silenceSources() {
    for (const handle of this.playing) {
      handle.silenced = true;
      try { handle.source.stop(0); } catch {}
    }
    this.playing.clear();
    this.activeFauna = 0;
    this.activePersonVoices = 0;
    const now = this.ctx?.currentTime ?? 0;
    for (const channel of this.channels.values()) {
      try {
        channel.gain.gain.cancelScheduledValues(now);
        channel.gain.gain.setValueAtTime(0, now);
      } catch {}
      try { channel.element.pause(); } catch {}
    }
    for (const voice of this.voices.values()) {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(0, now);
      } catch {}
      try { voice.element.pause(); } catch {}
    }
    if (this.wind) {
      try {
        this.wind.gain.gain.cancelScheduledValues(now);
        this.wind.gain.gain.setValueAtTime(0, now);
      } catch {}
      try { this.wind.element.pause(); } catch {}
    }
    this.faunaTimer = 0.8;
    this.ambienceTimer = 0;
    this.voiceTimer = 0;
    this.doorTimer = 0;
  }

  update(dt = 0) {
    if (this.disposed) return;
    this.setPaused(this.getPaused());
    if (this.paused) return;
    const context = this.ensureContext();
    if (!context || context.state === 'suspended') return;
    if ((this.getSpeed() || 1) > MAX_AUDIBLE_SPEED) { this.silenceSources(); return; }
    const renderer = this.renderer;
    const perspective = typeof renderer?.isPerspectiveActive === 'function' && renderer.isPerspectiveActive();
    const refX = perspective ? Number(renderer?.fpCamera?.position?.x) : Number(renderer?.camX);
    const refZ = perspective ? Number(renderer?.fpCamera?.position?.z) : Number(renderer?.camY);
    const ground = this.groundYAt(Number.isFinite(refX) ? refX : 0, Number.isFinite(refZ) ? refZ : 0) + 1.2;
    const pose = listenerPose(renderer, ground);
    if (!pose) return;
    this.lastAltitude = pose.altitude;
    this.onAltitudeChange(pose.altitude);
    this.updateListener(pose);
    this.updateWind(pose);
    this.updateAmbience(dt, pose);
    this.updateFauna(dt, pose);
    this.updateCitizenVoices(dt, pose);
    this.pollCityEvents(pose);
  }

  updateListener(pose) {
    const listener = this.ctx.listener;
    const now = this.ctx.currentTime;
    if (listener.positionX) {
      listener.positionX.setTargetAtTime(pose.x, now, 0.04);
      listener.positionY.setTargetAtTime(pose.y, now, 0.04);
      listener.positionZ.setTargetAtTime(pose.z, now, 0.04);
      if (listener.forwardX) {
        listener.forwardX.setTargetAtTime(pose.fx, now, 0.04);
        listener.forwardY.setTargetAtTime(pose.fy, now, 0.04);
        listener.forwardZ.setTargetAtTime(pose.fz, now, 0.04);
        listener.upX.setTargetAtTime(0, now, 0.04);
        listener.upY.setTargetAtTime(1, now, 0.04);
        listener.upZ.setTargetAtTime(0, now, 0.04);
      } else {
        listener.setOrientation(pose.fx, pose.fy, pose.fz, 0, 1, 0);
      }
    } else {
      listener.setPosition(pose.x, pose.y, pose.z);
      listener.setOrientation(pose.fx, pose.fy, pose.fz, 0, 1, 0);
    }
  }

  // Wind is the altitude layer: not positional, because above the city it
  // comes from everywhere. Zooming in fades it out to nothing.
  updateWind(pose) {
    if (!this.ready) return;
    const gain = windGain(pose.altitude);
    if (gain <= 0.005 && !this.wind) return;
    const wind = this.ensureWind();
    if (!wind) return;
    wind.gain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.5);
    if (wind.element.paused && gain > 0.02) wind.element.play().catch(() => {});
  }

  ensureWind() {
    if (this.wind) return this.wind;
    const url = this.worldFiles.wind_forest;
    if (!url || !this.ctx) return null;
    let element;
    try { element = this.mediaFactory(url); } catch { return null; }
    element.loop = true;
    const source = this.ctx.createMediaElementSource(element);
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.master);
    this.wind = { element, source, gain };
    return this.wind;
  }

  updateFauna(dt, pose) {
    this.faunaTimer -= dt;
    if (this.faunaTimer > 0) return;
    this.faunaTimer = 1.8 + this.random() * 2.4;
    const groundScale = groundAudibility(pose.altitude);
    if (groundScale <= 0.01 || this.activeFauna >= FAUNA_VOICE_LIMIT) return;
    const animals = this.getCity()?.fauna?.animals;
    if (!animals?.size) return;
    const night = isNightHour(this.getCity()?.hour);
    const call = chooseFaunaCall({
      animals: animals.values(),
      listener: pose,
      random: this.random,
      now: this.ctx.currentTime,
      lastCallAt: this.lastCallAt,
      radius: 16,
      cooldown: 8,
      night,
    });
    if (!call) return;
    this.lastCallAt.set(call.species, this.ctx.currentTime);
    this.playFauna(call, groundScale);
  }

  async playFauna(call, groundScale = 1) {
    const file = this.animalFiles[call.species];
    if (!file) return;
    this.activeFauna++;
    let buffer;
    try { buffer = await this.loadBuffer(file); } catch { this.activeFauna--; return; }
    if (this.paused || this.disposed || !this.ctx) { this.activeFauna--; return; }
    const spec = ANIMAL_SPECIES[call.species];
    const gain = (spec?.category === 'livestock' ? 0.45 : 0.55) * (call.animal?.state === 'flee' ? 1.2 : 1) * groundScale;
    const y = this.groundYAt(call.x, call.z) + (call.y || 0) + 0.45;
    const bufferDuration = Number(buffer?.duration) || 0;
    const offset = bufferDuration > FAUNA_CALL_MAX_DURATION + 1
      ? this.random() * Math.min(bufferDuration - FAUNA_CALL_MAX_DURATION, bufferDuration * 0.7)
      : 0;
    this.playBuffer(buffer, { x: call.x, y, z: call.z, gain, kind: 'fauna', duration: FAUNA_CALL_MAX_DURATION, offset });
  }

  // Each person and animal emits individual positional sounds (footsteps per
  // surface, swimming splashes, individual voices, foraging/grazing) at their
  // own world coordinates rather than sharing one muddied crowd loop.
  updateCitizenVoices(dt, pose) {
    this.doorTimer = Math.max(0, this.doorTimer - dt);
    this.voiceTimer -= dt;
    if (this.voiceTimer > 0) return;
    const stepDt = 0.25;
    this.voiceTimer = stepDt;
    const city = this.getCity();
    const citizens = city?.citizens;
    const world = city?.world;
    const candidates = [];
    if (Array.isArray(citizens) && citizens.length) {
      let scanned = 0;
      for (const citizen of citizens) {
        if (++scanned > 4000) break;
        const entity = citizen?.entity;
        if (!entity || entity.destroyed) continue;
        const id = citizen.id ?? entity.id;
        const previous = this.citizenPositions.get(id);
        const indoor = citizen.indoorLocation?.buildingId ?? citizen.indoorLocation?.id ?? null;
        this.citizenPositions.set(id, { x: entity.x, y: entity.y, indoor });
        if (!previous) continue;
        if (indoor !== previous.indoor && indoor != null && previous.indoor == null && this.doorTimer <= 0) {
          const distance = Math.hypot(entity.x - pose.x, entity.y - pose.z);
          if (distance <= 15) {
            this.doorTimer = 0.9;
            this.playWorldOneShot('door', entity.x, entity.y, 0.3, 1.8);
          }
        }
        if (indoor != null || citizen.dead || citizen.custody || citizen.climbing) continue;
        const y = this.groundYAt(entity.x, entity.y) + 0.12;
        const distance = sourceDistance(pose, entity.x, entity.y, y);
        const groundScale = groundAudibility(pose.altitude);
        if (groundScale <= 0.01 || distance > 15) continue;

        let cooldowns = this.citizenCooldowns.get(id);
        if (!cooldowns) {
          cooldowns = { step: this.random() * 0.3, swim: this.random() * 0.6, talk: this.random() * 1.5, forage: this.random() * 1.0, bike: this.random() * 0.8, work: this.random() * 1.2 };
          this.citizenCooldowns.set(id, cooldowns);
        }
        cooldowns.step = Math.max(0, cooldowns.step - stepDt);
        cooldowns.swim = Math.max(0, cooldowns.swim - stepDt);
        cooldowns.talk = Math.max(0, cooldowns.talk - stepDt);
        cooldowns.forage = Math.max(0, cooldowns.forage - stepDt);
        cooldowns.bike = Math.max(0, cooldowns.bike - stepDt);
        cooldowns.work = Math.max(0, cooldowns.work - stepDt);

        const moved = Math.hypot(entity.x - previous.x, entity.y - previous.y);
        if (citizen.ridingVehicleId) {
          if (BIKE_KINDS.has(citizen.ridingVehicleKind) && moved >= 0.05 && cooldowns.bike <= 0 && this.worldFiles.bike) {
            cooldowns.bike = 1.4 + this.random() * 1.6;
            candidates.push({ distance, key: 'bike', x: entity.x, y, z: entity.y, gain: 0.38 * groundScale, duration: 0.95, rate: 0.94 + this.random() * 0.12 });
          }
          continue;
        }
        if (citizen.swimming || SWIM_TASKS.has(citizen.task)) {
          if (cooldowns.swim <= 0) {
            cooldowns.swim = 0.85 + this.random() * 0.9;
            const splashKey = this.pickWorldKey(['water_splash', 'water_splash_2', 'water_splash_3']) || 'water_splash';
            candidates.push({ distance, key: splashKey, x: entity.x, y, z: entity.y, gain: 0.38 * groundScale, duration: 0.65, rate: 0.9 + this.random() * 0.2 });
          }
          continue;
        }
        if (citizen.conversation || TALK_TASKS.has(citizen.task)) {
          if (cooldowns.talk <= 0) {
            cooldowns.talk = 1.8 + this.random() * 2.2;
            const female = citizen.sex === 'F' || citizen.gender === 'female' || (typeof id === 'number' && id % 2 === 0);
            const pool = female ? ['voice_female', 'voice_female_2'] : ['voice_male'];
            if (this.worldFiles.voice_laugh && this.random() < 0.16) pool.unshift('voice_laugh');
            const voiceKey = this.pickWorldKey(pool) || (female ? 'voice_female' : 'voice_male');
            candidates.push({ distance, key: voiceKey, x: entity.x, y: y + 1.2, z: entity.y, gain: 0.42 * groundScale, duration: 1.1 + this.random() * 0.9, rate: 0.92 + this.random() * 0.16 });
          }
        }
        if (FORAGE_TASKS.has(citizen.task) && cooldowns.forage <= 0) {
          cooldowns.forage = 1.4 + this.random() * 1.6;
          candidates.push({ distance, key: 'grazing', x: entity.x, y, z: entity.y, gain: 0.32 * groundScale, duration: 0.85, rate: 0.95 + this.random() * 0.1 });
        }
        if (cooldowns.work <= 0 && moved < 0.04) {
          if (citizen.task === 'construction' && citizen.workProjectId != null) {
            cooldowns.work = 1.5 + this.random() * 1.5;
            candidates.push({ distance, key: this.pickWorldKey(['hammer', 'saw']) || 'hammer', x: entity.x, y, z: entity.y, gain: 0.34 * groundScale, duration: 0.9, rate: 0.95 + this.random() * 0.1 });
          } else if (citizen.forestryJob?.stage === 'cut' && this.worldFiles.wood_chop) {
            cooldowns.work = 1.6 + this.random() * 1.4;
            candidates.push({ distance, key: 'wood_chop', x: entity.x, y, z: entity.y, gain: 0.34 * groundScale, duration: 0.9, rate: 0.95 + this.random() * 0.1 });
          }
        }
        if (moved >= 0.04 && cooldowns.step <= 0) {
          let tile = null;
          if (world?.map && Number.isFinite(world.width)) {
            tile = world.map[Math.floor(entity.y) * world.width + Math.floor(entity.x)];
          }
          const surface = footstepSurface(tile);
          if (surface) {
            cooldowns.step = 0.36 + this.random() * 0.16;
            const stepKey = surface === 'footsteps_grass'
              ? (this.pickWorldKey(['footsteps_grass', 'footsteps_grass_2', 'footsteps_grass_3']) || surface)
              : surface === 'footsteps_dirt'
                ? (this.pickWorldKey(['footsteps_dirt', 'footsteps_dirt_2', 'footsteps_dirt_3']) || surface)
                : (this.pickWorldKey(['footsteps_sand', 'footsteps_sand_2', 'footsteps_sand_3']) || surface);
            candidates.push({ distance, key: stepKey, x: entity.x, y, z: entity.y, gain: 0.45 * groundScale, duration: 0.34, rate: 0.92 + this.random() * 0.16 });
            if (GRASS_TILES.has(tile) && this.random() < 0.45) {
              const foliageKey = this.pickWorldKey(['grass_rustle', 'bush_rustle']);
              if (foliageKey) {
                candidates.push({ distance, key: foliageKey, x: entity.x, y, z: entity.y, gain: 0.24 * groundScale, duration: 0.45, rate: 0.95 + this.random() * 0.15 });
              }
            }
          }
        }
      }
    }

    const animals = city?.fauna?.animals;
    const groundScale = groundAudibility(pose.altitude);
    if (animals?.size && groundScale > 0.01) {
      for (const [aid, animal] of animals.entries()) {
        if (!animal || animal.dead || animal.entity?.destroyed) continue;
        const y = this.groundYAt(animal.x, animal.y) + 0.15;
        const distance = sourceDistance(pose, animal.x, animal.y, y);
        if (distance > 15) continue;
        let cd = this.animalCooldowns.get(aid);
        if (!cd) {
          cd = { graze: this.random() * 1.5, rustle: this.random() * 1.0 };
          this.animalCooldowns.set(aid, cd);
        }
        cd.graze = Math.max(0, cd.graze - stepDt);
        cd.rustle = Math.max(0, cd.rustle - stepDt);
        if ((animal.state === 'graze' || animal.state === 'forage' || animal.state === 'eat') && cd.graze <= 0) {
          cd.graze = 1.6 + this.random() * 1.8;
          candidates.push({ distance, key: 'grazing', x: animal.x, y, z: animal.y, gain: 0.32 * groundScale, duration: 0.9, rate: 0.9 + this.random() * 0.2 });
        } else if ((animal.state === 'walk' || animal.state === 'flee') && cd.rustle <= 0 && world?.map && Number.isFinite(world.width)) {
          const tile = world.map[Math.floor(animal.y) * world.width + Math.floor(animal.x)];
          if (GRASS_TILES.has(tile)) {
            cd.rustle = 0.7 + this.random() * 0.8;
            const foliageKey = this.pickWorldKey(['grass_rustle', 'bush_rustle']) || 'grass_rustle';
            candidates.push({ distance, key: foliageKey, x: animal.x, y, z: animal.y, gain: 0.24 * groundScale, duration: 0.5, rate: 0.95 + this.random() * 0.15 });
          }
        }
      }
    }

    candidates.sort((a, b) => a.distance - b.distance);
    for (const item of candidates) {
      if (this.activePersonVoices >= MAX_PERSON_VOICES) break;
      this.playWorldGrain(item.key, item.x, item.y, item.z, item);
    }

    if (this.citizenPositions.size > 4096 && Array.isArray(citizens)) {
      for (const id of this.citizenPositions.keys()) {
        if (!citizens.some(citizen => (citizen.id ?? citizen.entity?.id) === id)) {
          this.citizenPositions.delete(id);
          this.citizenCooldowns.delete(id);
        }
      }
    }
  }

  pickWorldKey(keys) {
    const available = keys.filter(key => this.worldFiles[key]);
    if (!available.length) return null;
    return available[Math.floor(this.random() * available.length)];
  }

  playWorldGrain(key, x, y, z, { gain = 0.4, duration = 0.4, rate = 1 } = {}) {
    const file = this.worldFiles[key];
    if (!file || this.paused || this.activePersonVoices >= MAX_PERSON_VOICES) return;
    this.activePersonVoices++;
    this.loadBuffer(file)
      .then(buffer => {
        if (this.paused || this.disposed) { this.activePersonVoices = Math.max(0, this.activePersonVoices - 1); return; }
        const bufferDuration = Number(buffer?.duration) || 0;
        const offset = bufferDuration > duration + 0.5 ? this.random() * Math.max(0, bufferDuration - duration) : 0;
        const handle = this.playBuffer(buffer, { x, y, z, gain, kind: 'person', duration, offset, playbackRate: rate });
        if (!handle) this.activePersonVoices = Math.max(0, this.activePersonVoices - 1);
      })
      .catch(() => { this.activePersonVoices = Math.max(0, this.activePersonVoices - 1); });
  }

  ensureVoice(file) {
    const existing = this.voices.get(file);
    if (existing) return existing;
    const url = this.worldFiles[file];
    if (!url || !this.ctx) return null;
    let element;
    try { element = this.mediaFactory(url); } catch { return null; }
    element.loop = true;
    const source = this.ctx.createMediaElementSource(element);
    const panner = this.ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 3;
    panner.maxDistance = 16;
    // Distance attenuation is already applied to voice.gain; keep the panner
    // for 3D stereo panning only so zoomed views do not double-attenuate.
    panner.rolloffFactor = 0;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(panner);
    panner.connect(gain);
    gain.connect(this.master);
    const voice = { file, element, source, panner, gain };
    this.voices.set(file, voice);
    return voice;
  }

  updateAmbience(dt, pose) {
    const now = this.ctx.currentTime;
    this.ambienceTimer -= dt;
    if (this.ambienceTimer > 0 || !this.ready) return;
    this.ambienceTimer = 0.35;
    const groundScale = groundAudibility(pose.altitude);
    const city = this.getCity();
    const plan = groundScale <= 0.01 ? [] : ambiencePlan({
      listener: pose,
      features: this.collectFeatures(city, pose),
      night: isNightHour(city?.hour),
    });
    const wanted = new Set(plan.map(zone => zone.key));
    for (const zone of plan) {
      const channel = this.ensureChannel(zone.key);
      if (!channel) continue;
      const y = this.groundYAt(zone.x, zone.z) + 0.8;
      setNodePosition(channel.panner, zone.x, y, zone.z, 0.25);
      channel.gain.gain.setTargetAtTime(zone.gain * groundScale, now, 0.4);
      if (channel.element.paused) channel.element.play().catch(() => {});
    }
    // Silence only: the element keeps running muted. Pausing it would need a
    // fresh play() when the camera returns, and a rejected play would leave
    // the loop dead for good.
    for (const [key, channel] of this.channels) {
      if (wanted.has(key)) continue;
      channel.gain.gain.setTargetAtTime(0, now, 0.25);
    }
  }

  ensureChannel(key) {
    const existing = this.channels.get(key);
    if (existing) return existing;
    const url = this.worldFiles[CHANNEL_FILES[key] || key];
    if (!url || !this.ctx) return null;
    let element;
    try { element = this.mediaFactory(url); } catch { return null; }
    element.loop = true;
    const source = this.ctx.createMediaElementSource(element);
    const panner = this.ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 6;
    panner.maxDistance = 40;
    // ambiencePlan already computes 3D distance attenuation on channel.gain.
    panner.rolloffFactor = 0;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(panner);
    panner.connect(gain);
    gain.connect(this.master);
    const channel = { key, element, source, panner, gain };
    this.channels.set(key, channel);
    return channel;
  }

  collectFeatures(city, pose) {
    const features = {};
    const world = city?.world;
    if (world?.map && Number.isFinite(world.width) && Number.isFinite(world.height)) {
      const radius = 26;
      let bestWater = null, bestWaterDist = Infinity;
      let bestBeach = null, bestBeachDist = Infinity;
      const x0 = Math.max(0, Math.floor(pose.x - radius));
      const x1 = Math.min(world.width - 1, Math.ceil(pose.x + radius));
      const z0 = Math.max(0, Math.floor(pose.z - radius));
      const z1 = Math.min(world.height - 1, Math.ceil(pose.z + radius));
      const touchesSand = (tx, tz) => {
        for (let dz = -2; dz <= 2; dz += 2) {
          const nz = tz + dz;
          if (nz < 0 || nz >= world.height) continue;
          for (let dx = -2; dx <= 2; dx += 2) {
            const nx = tx + dx;
            if (nx >= 0 && nx < world.width && world.map[nz * world.width + nx] === SAND_TILE) return true;
          }
        }
        return false;
      };
      for (let z = z0; z <= z1; z += 2) {
        for (let x = x0; x <= x1; x += 2) {
          if (world.map[z * world.width + x] !== WATER_TILE) continue;
          const distance = Math.hypot(x + 0.5 - pose.x, z + 0.5 - pose.z);
          if (touchesSand(x, z)) {
            if (distance < bestBeachDist) { bestBeachDist = distance; bestBeach = { x: x + 0.5, z: z + 0.5 }; }
          } else if (distance < bestWaterDist) {
            bestWaterDist = distance; bestWater = { x: x + 0.5, z: z + 0.5 };
          }
        }
      }
      if (bestWater) features.water = bestWater;
      if (bestBeach) features.beach = bestBeach;
    }

    const plants = city?.nature?.plants;
    if (plants?.size) {
      let best = null, bestDistance = Infinity, scanned = 0;
      for (const plant of plants.values()) {
        if (++scanned > 4000) break;
        if (plant.entity?.destroyed) continue;
        const distance = Math.hypot(plant.x - pose.x, plant.y - pose.z);
        if (distance < bestDistance) { bestDistance = distance; best = { x: plant.x, z: plant.y }; }
      }
      if (best) features.plants = best;
    }

    const buildings = city?.buildings;
    if (Array.isArray(buildings)) {
      let nearest = null, nearestDistance = Infinity;
      for (const building of buildings) {
        const entity = building?.entity;
        if (!entity || entity.destroyed) continue;
        const distance = Math.hypot(entity.x - pose.x, entity.y - pose.z);
        if (distance < nearestDistance) { nearestDistance = distance; nearest = { x: entity.x, z: entity.y }; }
      }
      if (nearest) features.buildings = nearest;
    }

    const crowd = crowdCluster(city?.citizens, pose);
    if (crowd) features.crowd = crowd;

    const grassRustle = { count: 0, sx: 0, sz: 0 };
    const grazing = { count: 0, sx: 0, sz: 0 };
    if (Array.isArray(city?.citizens)) {
      let cCount = 0;
      for (const citizen of city.citizens) {
        if (++cCount > 900) break;
        const entity = citizen?.entity;
        if (!entity || entity.destroyed || citizen.indoorLocation || citizen.dead || citizen.ridingVehicleId) continue;
        if (sourceDistance(pose, entity.x, entity.y) > 20) continue;
        if (FORAGE_TASKS.has(citizen.task)) {
          grazing.count++; grazing.sx += entity.x; grazing.sz += entity.y;
        }
        if (world?.map && Number.isFinite(world.width)) {
          const tile = world.map[Math.floor(entity.y) * world.width + Math.floor(entity.x)];
          if (GRASS_TILES.has(tile) && (citizen.path?.length || FORAGE_TASKS.has(citizen.task))) {
            grassRustle.count++; grassRustle.sx += entity.x; grassRustle.sz += entity.y;
          }
        }
      }
    }
    const animals = city?.fauna?.animals;
    if (animals?.size) {
      for (const animal of animals.values()) {
        if (!animal || animal.dead || animal.entity?.destroyed) continue;
        if (sourceDistance(pose, animal.x, animal.y) > 20) continue;
        if (animal.state === 'graze' || animal.state === 'forage' || animal.state === 'eat') {
          grazing.count++; grazing.sx += animal.x; grazing.sz += animal.y;
        }
        if (world?.map && Number.isFinite(world.width)) {
          const tile = world.map[Math.floor(animal.y) * world.width + Math.floor(animal.x)];
          if (GRASS_TILES.has(tile) && (animal.state === 'walk' || animal.state === 'flee' || animal.state === 'graze')) {
            grassRustle.count++; grassRustle.sx += animal.x; grassRustle.sz += animal.y;
          }
        }
      }
    }
    if (grazing.count > 0) features.grazing = { x: grazing.sx / grazing.count, z: grazing.sz / grazing.count, count: grazing.count };
    if (grassRustle.count > 0) features.grassRustle = { x: grassRustle.sx / grassRustle.count, z: grassRustle.sz / grassRustle.count, count: grassRustle.count };

    const projects = city?.development?.projects;
    if (Array.isArray(projects)) {
      let nearest = null, nearestDistance = Infinity;
      for (const project of projects) {
        if (!project || project.cancelled || project.status !== 'building') continue;
        const position = this.projectPosition(city, project);
        if (!position) continue;
        const distance = Math.hypot(position.x - pose.x, position.z - pose.z);
        if (distance < nearestDistance) { nearestDistance = distance; nearest = position; }
      }
      if (nearest && nearestDistance <= 26) features.construction = nearest;
    }
    return features;
  }

  projectPosition(city, project) {
    if (project.door && Number.isFinite(project.door.x) && Number.isFinite(project.door.y)) {
      return { x: project.door.x, z: project.door.y };
    }
    if (project.buildingId != null) {
      const building = city.building?.(project.buildingId);
      if (building?.entity) return { x: building.entity.x, z: building.entity.y };
    }
    if (project.plotId != null) {
      const plot = city.development?.plots?.find(row => row.id === project.plotId);
      if (plot) return { x: plot.x + plot.width / 2, z: plot.y + plot.depth / 2 };
    }
    return null;
  }

  // Gameplay one-shots: construction starts hammer, a business opening rings
  // the register, a purchase clinks coins, a plenary vote hits the gavel.
  // Historical events are skipped on the first poll; the id window survives
  // trims of the event feed.
  pollCityEvents(pose) {
    if (groundAudibility(pose.altitude) <= 0.01) return;
    const events = this.getCity()?.events;
    if (!Array.isArray(events) || !events.length) return;
    const newest = events[events.length - 1];
    if (this.lastEventId === null) {
      this.lastEventId = newest?.id ?? 0;
      return;
    }
    const played = [];
    for (let index = events.length - 1; index >= 0 && played.length < 3; index--) {
      const event = events[index];
      const id = event?.id ?? 0;
      if (id <= this.lastEventId) break;
      const kind = event.kind || event.data?.kind;
      if (!EVENT_SOUNDS[kind]) continue;
      const position = this.eventPosition(event, pose);
      if (!position) continue;
      if (Math.hypot(position.x - pose.x, position.z - pose.z) > 30) continue;
      played.push({ kind, position });
    }
    this.lastEventId = newest?.id ?? this.lastEventId;
    for (const { kind, position } of played.reverse()) {
      const sound = EVENT_SOUNDS[kind];
      this.playWorldOneShot(sound.key, position.x, position.z, sound.gain, sound.duration);
    }
  }

  eventPosition(event, pose = null) {
    const data = event.data || event;
    const city = this.getCity();
    if (data.projectId != null) {
      const project = city?.development?.projects?.find(row => row.id === data.projectId);
      if (project) {
        const position = this.projectPosition(city, project);
        if (position) return position;
      }
    }
    const buildingId = data.buildingId ?? (Array.isArray(data.buildingIds) ? data.buildingIds[0] : null);
    if (buildingId != null) {
      const building = city?.building?.(buildingId);
      if (building?.entity && !building.entity.destroyed) return { x: building.entity.x, z: building.entity.y };
    }
    if (data.unitId != null && Array.isArray(city?.buildings)) {
      for (const building of city.buildings) {
        if (!building?.entity || building.entity.destroyed) continue;
        if (building.units?.some(unit => unit.id === data.unitId)) {
          return { x: building.entity.x, z: building.entity.y };
        }
      }
    }
    const kind = event.kind || data.kind;
    if (kind === 'bill-voted' || kind === 'council-elected') {
      const hall = city?.buildings?.find(b => b?.entity && !b.entity.destroyed && (b.type === 'city_hall' || b.type === 'council' || b.municipal));
      if (hall) return { x: hall.entity.x, z: hall.entity.y };
      if (pose) return { x: pose.x, z: pose.z };
    }
    return null;
  }

  playWorldOneShot(key, x, z, gain = 0.5, duration = 0) {
    const file = this.worldFiles[key];
    if (!file || this.paused) return;
    const y = this.groundYAt(x, z) + 0.7;
    this.loadBuffer(file)
      .then(buffer => {
        if (this.paused || this.disposed) return;
        this.playBuffer(buffer, { x, y, z, gain, kind: 'world', duration });
      })
      .catch(() => {});
  }

  async loadBuffer(file) {
    const cached = this.buffers.get(file);
    if (cached) {
      this.buffers.delete(file);
      this.buffers.set(file, cached);
      return cached.buffer;
    }
    const response = await this.fetchImpl(file);
    if (!response.ok) throw new Error(`Som indisponível: ${file}`);
    const bytes = await response.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(bytes);
    const size = buffer.length * buffer.numberOfChannels * 4;
    this.buffers.set(file, { buffer, size });
    this.bufferBytes += size;
    while (this.bufferBytes > this.maxBufferBytes && this.buffers.size > 1) {
      const [oldestKey, oldest] = this.buffers.entries().next().value;
      if (oldestKey === file) break;
      this.buffers.delete(oldestKey);
      this.bufferBytes -= oldest.size;
    }
    return buffer;
  }

  playBuffer(buffer, { x, y, z, gain = 1, kind = 'world', duration = 0, offset = 0, playbackRate = 1 } = {}) {
    const context = this.ctx;
    if (!context || this.paused) return null;
    const source = context.createBufferSource();
    source.buffer = buffer;
    if (source.playbackRate && Number.isFinite(playbackRate) && playbackRate > 0) {
      source.playbackRate.value = playbackRate;
    }
    const level = context.createGain();
    level.gain.value = Math.max(0, Math.min(1, gain));
    let tail = level;
    let panner = null;
    if (Number.isFinite(x) && Number.isFinite(z)) {
      panner = context.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'inverse';
      panner.refDistance = 2.5;
      panner.maxDistance = 18;
      panner.rolloffFactor = 2.0;
      setNodePosition(panner, x, Number.isFinite(y) ? y : 1, z);
      source.connect(panner);
      panner.connect(level);
    } else {
      source.connect(level);
    }
    tail.connect(this.master);
    const handle = { source, panner, level, kind };
    this.playing.add(handle);
    source.onended = () => {
      this.playing.delete(handle);
      if (kind === 'fauna' && !handle.silenced) this.activeFauna = Math.max(0, this.activeFauna - 1);
      if (kind === 'person' && !handle.silenced) this.activePersonVoices = Math.max(0, this.activePersonVoices - 1);
      try { level.disconnect(); panner?.disconnect(); } catch {}
    };
    const bufferDuration = Number(buffer?.duration) || 0;
    const startOffset = bufferDuration > 0 && offset > 0 ? Math.min(offset, Math.max(0, bufferDuration - 0.1)) : 0;
    const maxAvailable = bufferDuration > 0 ? Math.max(0.05, bufferDuration - startOffset) : duration;
    const playDuration = duration > 0 ? Math.min(duration, maxAvailable || duration) : 0;
    if (playDuration > 0 && playDuration < (bufferDuration || Infinity)) {
      const fadeOutAt = context.currentTime + Math.max(0.05, playDuration - Math.min(0.25, playDuration * 0.35));
      level.gain.setTargetAtTime(0, fadeOutAt, 0.06);
    }
    source.start(0, startOffset, playDuration > 0 ? playDuration : undefined);
    return handle;
  }

  dispose() {
    this.disposed = true;
    this.silenceSources();
    for (const channel of this.channels.values()) {
      try { channel.source.disconnect(); } catch {}
      try { channel.panner.disconnect(); } catch {}
      try { channel.gain.disconnect(); } catch {}
      channel.element.src = '';
    }
    this.channels.clear();
    for (const voice of this.voices.values()) {
      try { voice.source.disconnect(); } catch {}
      try { voice.panner.disconnect(); } catch {}
      try { voice.gain.disconnect(); } catch {}
      voice.element.src = '';
    }
    this.voices.clear();
    if (this.wind) {
      try { this.wind.source.disconnect(); } catch {}
      try { this.wind.gain.disconnect(); } catch {}
      this.wind.element.src = '';
      this.wind = null;
    }
    this.citizenPositions.clear();
    this.citizenCooldowns.clear();
    this.animalCooldowns.clear();
    this.activeWalkers.clear();
    this.indoorTrack.clear();
    this.ctx?.close?.();
    this.ctx = null;
  }
}
