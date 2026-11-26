import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SpatialAudio,
  ambiencePlan,
  chooseFaunaCall,
  distanceAttenuation,
  isNightHour,
  listenerPose,
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

test('isometric listener sits at the camera focus with the camera-facing direction', () => {
  const renderer = {
    camX: 10, camY: 20,
    isPerspectiveActive: () => false,
    camera: { position: { x: 40, y: 60, z: 80 }, matrixWorld: { elements: new Array(16).fill(0) } },
  };
  const pose = listenerPose(renderer, 3);
  assert.equal(pose.x, 10);
  assert.equal(pose.y, 3);
  assert.equal(pose.z, 20);
  assert.ok(Math.abs(Math.hypot(pose.fx, pose.fz) - 1) < 1e-9);
  assert.ok(pose.fx < 0 && pose.fz < 0, 'forward points from the eye towards the focus');
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
