import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SpatialAudio,
  ambiencePlan,
  chooseFaunaCall,
  crowdCluster,
  distanceAttenuation,
  footstepSurface,
  isNightHour,
  isometricAltitude,
  listenerPose,
  windGain,
} from '../js/spatial_audio.js';
import { MusicPlayer } from '../js/music.js';
import { OptionsPanel } from '../js/options.js';

function param(value = 0) {
  return {
    value,
    setTargetAtTime(value) { this.value = value; },
    setValueAtTime(value) { this.value = value; },
    cancelScheduledValues() {},
  };
}

function fakeContext() {
  const context = {
    currentTime: 1,
    state: 'running',
    sources: [],
    destination: { connect() {} },
    listener: {
      positionX: param(), positionY: param(), positionZ: param(),
      forwardX: param(), forwardY: param(), forwardZ: param(),
      upX: param(), upY: param(), upZ: param(),
    },
    createGain() {
      return { context, gain: param(1), connect() { return this; }, disconnect() {} };
    },
    createPanner() {
      return {
        context, positionX: param(), positionY: param(), positionZ: param(),
        setPosition(x, y, z) { this.x = x; this.y = y; this.z = z; },
        connect() { return this; }, disconnect() {},
      };
    },
    createBufferSource() {
      const source = {
        context, buffer: null, started: false, stopped: false, onended: null,
        connect() { return this; }, disconnect() {},
        start() { this.started = true; },
        stop() { this.stopped = true; },
      };
      context.sources.push(source);
      return source;
    },
    createMediaElementSource(element) {
      return { context, element, connect() { return this; }, disconnect() {} };
    },
    async decodeAudioData() { return { length: 4800, numberOfChannels: 1 }; },
    async resume() {},
    async close() {},
  };
  return context;
}

function fakeAudio() {
  return {
    paused: false, calls: 0, listeners: {},
    addEventListener(type, callback) { this.listeners[type] = callback; },
    getAttribute() { return this.src; },
    removeAttribute() { delete this.src; },
    pause() { this.paused = true; },
    async play() { this.paused = false; this.calls++; },
  };
}

test('isometric listener sits at the camera focus with the zoom altitude', () => {
  const renderer = {
    camX: 10, camY: 20, zoom: 1.2,
    isPerspectiveActive: () => false,
    camera: { position: { x: 40, y: 60, z: 80 }, matrixWorld: { elements: new Array(16).fill(0) } },
  };
  const pose = listenerPose(renderer, 3);
  assert.equal(pose.x, 10);
  assert.equal(pose.z, 20);
  assert.equal(pose.altitude, isometricAltitude(1.2));
  assert.equal(pose.y, 3 + isometricAltitude(1.2));
  assert.ok(Math.abs(Math.hypot(pose.fx, pose.fz) - 1) < 1e-9);
  assert.ok(pose.fx < 0 && pose.fz < 0, 'forward points from the eye towards the focus');
});

test('zoom sets listening altitude and high zoom leaves only wind and music', () => {
  const high = isometricAltitude(0.3);
  const street = isometricAltitude(12);
  assert.ok(high > 40 && street < 2);
  assert.equal(windGain(street), 0);
  assert.ok(windGain(high) > 0.6);
  const mid = windGain(isometricAltitude(1.2));
  assert.ok(mid > 0.05 && mid < 0.2, 'default zoom carries a light breeze');
  // A source five tiles away is out of range from above and loud at street level.
  const far = distanceAttenuation(Math.hypot(5, high - 1), { refDistance: 4, maxDistance: 40, rolloffFactor: 1.2 });
  const near = distanceAttenuation(Math.hypot(5, street - 1), { refDistance: 4, maxDistance: 40, rolloffFactor: 1.2 });
  assert.equal(far, 0);
  assert.ok(near > 0.4);
});

test('perspective listener uses the eye and the camera forward vector', () => {
  const elements = new Array(16).fill(0);
  elements[0] = 1; elements[5] = 1; elements[10] = 1; elements[15] = 1;
  const renderer = {
    isPerspectiveActive: () => true,
    fpCamera: { position: { x: 1, y: 2, z: 3 }, matrixWorld: { elements } },
  };
  const pose = listenerPose(renderer, 99);
  assert.deepEqual([pose.x, pose.y, pose.z], [1, 2, 3]);
  assert.deepEqual([pose.fx, pose.fy, pose.fz], [-0, -0, -1]);
});

test('distance attenuation matches the inverse distance model', () => {
  assert.equal(distanceAttenuation(0), 1);
  assert.equal(distanceAttenuation(4, { refDistance: 4 }), 1);
  assert.equal(distanceAttenuation(40, { maxDistance: 40 }), 0);
  const near = distanceAttenuation(6, { refDistance: 4, maxDistance: 40, rolloffFactor: 1 });
  const far = distanceAttenuation(18, { refDistance: 4, maxDistance: 40, rolloffFactor: 1 });
  assert.ok(near > far && far > 0);
});

test('fauna calls respect radius, sleep, cooldown and night weighting', () => {
  const listener = { x: 0, y: 2, z: 0 };
  const animals = [
    { species: 'vaca', x: 2, y: 0, entity: {}, state: 'idle' },
    { species: 'galinha', x: 60, y: 0, entity: {}, state: 'idle' },
    { species: 'sabia', x: 1, y: 0, entity: {}, state: 'sleep' },
  ];
  const call = chooseFaunaCall({ animals, listener, random: () => 0, now: 100 });
  assert.equal(call.species, 'vaca');
  assert.equal(chooseFaunaCall({ animals, listener, random: () => 0, now: 100, cooldown: 60, lastCallAt: new Map([['vaca', 80]]) }), null);
  const nightCall = chooseFaunaCall({
    animals: [{ species: 'sabia', x: 1, y: 0, entity: {}, state: 'idle' }],
    listener, random: () => 0, now: 100, night: true,
  });
  assert.equal(nightCall.species, 'sabia');
  assert.ok(nightCall.weight < 1, 'night birds are quieter');
});

test('ambience plan prefers the nearest features and swaps nature at night', () => {
  const listener = { x: 0, y: 2, z: 0 };
  const features = {
    water: { x: 3, z: 0 }, plants: { x: 2, z: 0 }, market: { x: 5, z: 0 },
    construction: { x: 30, z: 0 }, buildings: { x: 4, z: 0 },
  };
  const day = ambiencePlan({ listener, features, night: false });
  assert.deepEqual(day.map(zone => zone.key), ['river', 'market', 'forest_birds']);
  const night = ambiencePlan({ listener, features, night: true });
  assert.deepEqual(night.map(zone => zone.key), ['frogs', 'market', 'night_insects']);
  assert.equal(isNightHour(22), true);
  assert.equal(isNightHour(12), false);
});

test('crowd cluster follows the densest group of citizens and ignores the rest', () => {
  const citizens = [
    { id: 1, entity: { x: 3, y: 3 } },
    { id: 2, entity: { x: 3.4, y: 3.2 } },
    { id: 3, entity: { x: 3.8, y: 2.9 } },
    { id: 4, entity: { x: 14, y: 14 } },
    { id: 5, entity: { x: 60, y: 60 } },
    { id: 6, entity: { x: 3.2, y: 3.1, destroyed: true } },
  ];
  const cluster = crowdCluster(citizens, { x: 0, z: 0 }, { radius: 20 });
  assert.equal(cluster.count, 3);
  assert.ok(Math.hypot(cluster.x - 3.4, cluster.z - 3) < 0.6);
  assert.equal(crowdCluster(citizens, { x: 0, z: 0 }, { radius: 2 }), null);
  assert.equal(crowdCluster([], { x: 0, z: 0 }), null);
});

test('footsteps pick dirt on roads, grass elsewhere and silence on water', () => {
  assert.equal(footstepSurface(0), 'footsteps_grass');
  assert.equal(footstepSurface(6), 'footsteps_dirt');
  assert.equal(footstepSurface(13), 'footsteps_dirt');
  assert.equal(footstepSurface(2), null);
  assert.equal(footstepSurface(undefined), null);
});

test('citizen walkers get positional footstep loops that pause stops', async () => {
  const context = fakeContext();
  const elements = [];
  const citizens = Array.from({ length: 5 }, (_, index) => ({
    id: index + 1,
    entity: { x: index, y: 0, destroyed: false },
    indoorLocation: null,
  }));
  const audio = new SpatialAudio({
    contextFactory: () => context,
    getCity: () => ({ citizens, world: { map: new Uint8Array(32 * 32), width: 32, height: 32 } }),
    renderer: { camX: 0, camY: 0, isPerspectiveActive: () => false, camera: { position: { x: 10, y: 10, z: 10 } } },
    groundYAt: () => 0,
    mediaFactory: url => {
      const element = fakeAudio();
      element.src = url;
      elements.push(element);
      return element;
    },
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          animals: {},
          world: {
            footsteps_grass: { local_file: 'data/audio/world/footsteps_grass.ogg' },
            footsteps_dirt: { local_file: 'data/audio/world/footsteps_dirt.ogg' },
          },
        };
      },
    }),
  });
  await audio.load();
  audio.update(0.4);
  assert.equal(audio.voices.size, 0, 'the first sample only records positions');
  for (const citizen of citizens) citizen.entity.x += 0.4;
  audio.update(0.4);
  assert.equal(audio.voices.size, 3, 'only the nearest walkers keep a loop');
  assert.ok([...audio.voices.values()].every(voice => voice.element.paused === false));
  audio.setPaused(true);
  assert.ok([...audio.voices.values()].every(voice => voice.element.paused === true));
  assert.equal(elements.length > 0, true);
});

test('a citizen entering a building plays the door one-shot', async () => {
  const context = fakeContext();
  const citizens = [{ id: 1, entity: { x: 2, y: 2, destroyed: false }, indoorLocation: null }];
  let fetches = 0;
  const audio = new SpatialAudio({
    contextFactory: () => context,
    getCity: () => ({ citizens, world: { map: new Uint8Array(32 * 32), width: 32, height: 32 }, building: () => ({ entity: { x: 2, y: 2 } }) }),
    renderer: { camX: 0, camY: 0, isPerspectiveActive: () => false, camera: { position: { x: 10, y: 10, z: 10 } } },
    groundYAt: () => 0,
    fetchImpl: async () => { fetches++; return { ok: true, async json() { return { animals: {}, world: { door: { local_file: 'data/audio/world/door.ogg' } } }; }, async arrayBuffer() { return new ArrayBuffer(8); } }; },
  });
  await audio.load();
  audio.update(0.4);
  citizens[0].indoorLocation = { buildingId: 7 };
  audio.update(0.4);
  assert.equal(fetches, 2, 'manifest plus one door download');
  for (let index = 0; index < 5; index++) await Promise.resolve();
  assert.equal(audio.playing.size, 1);
});

test('zoomed out raises the wind layer and zooming in fades it to silence', async () => {
  const context = fakeContext();
  const elements = [];
  const renderer = {
    camX: 0, camY: 0, zoom: 0.4,
    isPerspectiveActive: () => false,
    camera: { position: { x: 10, y: 10, z: 10 } },
  };
  const audio = new SpatialAudio({
    contextFactory: () => context,
    renderer,
    getCity: () => null,
    groundYAt: () => 0,
    mediaFactory: url => {
      const element = fakeAudio();
      element.src = url;
      elements.push(element);
      return element;
    },
    fetchImpl: async () => ({
      ok: true,
      async json() { return { animals: {}, world: { wind_forest: { local_file: 'data/audio/world/wind_forest.ogg' } } }; },
    }),
  });
  await audio.load();
  audio.update(0.4);
  assert.ok(audio.wind, 'wind layer exists above the city');
  assert.equal(audio.wind.element.paused, false);
  assert.ok(audio.wind.gain.gain.value > 0.5);
  renderer.zoom = 12;
  audio.update(0.4);
  assert.equal(audio.wind.gain.gain.value, 0, 'street level silences the wind');
  renderer.zoom = 0.4;
  audio.update(0.4);
  audio.setPaused(true);
  assert.equal(audio.wind.element.paused, true, 'pause stops the wind loop');
  audio.setPaused(false);
  audio.update(0.4);
  assert.equal(audio.wind.element.paused, false);
});

test('pause stops every playing source immediately and notifies once', () => {
  const context = fakeContext();
  const changes = [];
  const audio = new SpatialAudio({
    contextFactory: () => context,
    onPauseChange: paused => changes.push(paused),
  });
  audio.ensureContext();
  const handle = audio.playBuffer({ duration: 10 }, { x: 1, y: 1, z: 1, gain: 0.5 });
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].started, true);
  assert.equal(audio.playing.size, 1);
  assert.equal(audio.setPaused(true), true);
  assert.equal(context.sources[0].stopped, true);
  assert.equal(audio.playing.size, 0);
  assert.deepEqual(changes, [true]);
  assert.equal(audio.setPaused(true), false);
  assert.deepEqual(changes, [true]);
});

test('paused updates never create sources or fetch audio', async () => {
  const context = fakeContext();
  let fetches = 0;
  const audio = new SpatialAudio({
    contextFactory: () => context,
    getPaused: () => true,
    getCity: () => ({ fauna: { animals: new Map([[1, { species: 'vaca', x: 1, y: 1, entity: {}, state: 'idle' }]]) } }),
    renderer: { camX: 1, camY: 1, isPerspectiveActive: () => false, camera: { position: { x: 5, y: 5, z: 5 } } },
    fetchImpl: async url => { if (url !== 'data/audio/manifest.json') fetches++; return { ok: true, async json() { return { animals: {}, world: {} }; } }; },
  });
  await audio.load();
  audio.update(1);
  assert.equal(fetches, 0);
  assert.equal(context.sources.length, 0);
});

test('manifest mapping exposes species and world keys', async () => {
  const audio = new SpatialAudio({
    contextFactory: () => fakeContext(),
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          animals: { vaca: { local_file: 'data/audio/animals/vaca.ogg' } },
          world: { river: { local_file: 'data/audio/world/river.ogg' } },
        };
      },
    }),
  });
  await audio.load();
  assert.equal(audio.available, true);
  assert.equal(audio.animalFiles.vaca, 'data/audio/animals/vaca.ogg');
  assert.equal(audio.worldFiles.river, 'data/audio/world/river.ogg');
});

test('music pauses and resumes with the simulation, and a pending wait resumes once', async () => {
  const audio = fakeAudio();
  let callback;
  const music = new MusicPlayer({
    audio,
    tracks: ['a.mp3'],
    random: () => 0,
    schedule: cb => { callback = cb; },
  });
  await music.start();
  assert.equal(music.playing, true);
  music.pause();
  assert.equal(audio.paused, true);
  music.resume();
  assert.equal(audio.paused, false);
  assert.equal(audio.calls, 2);

  // A track that ends during the pause must not start until resume.
  audio.listeners.ended();
  music.pause();
  callback();
  assert.equal(audio.calls, 2);
  assert.equal(music.needsStart, true);
  music.resume();
  await Promise.resolve();
  assert.equal(music.needsStart, false);
  assert.equal(audio.calls, 3);
});

test('options apply and persist sound-effect mute and volume', () => {
  const applied = [];
  const audio = { setMuted: value => applied.push(['muted', value]), setVolume: value => applied.push(['volume', value]) };
  let saved = '{"sfxMuted":true,"sfxVolume":0.5}';
  const storage = { getItem: () => saved, setItem: (_key, value) => { saved = value; } };
  const renderer = new Proxy({}, { get: () => () => {} });
  const panel = new OptionsPanel({ renderer, time: { setFastForwardEnabled() {} }, music: null, audio, storage });
  assert.deepEqual(applied, [['muted', true], ['volume', 0.5]]);
  panel.apply('sfxMuted', false);
  panel.apply('sfxVolume', 1);
  assert.deepEqual(applied.slice(-2), [['muted', false], ['volume', 1]]);
  assert.equal(JSON.parse(saved).sfxVolume, 1);
});
