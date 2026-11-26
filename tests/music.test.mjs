import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicPlayer } from '../js/music.js';
import { OptionsPanel } from '../js/options.js';

function audioStub() {
  return {
    listeners: {}, calls: 0,
    addEventListener(type, callback) { this.listeners[type] = callback; },
    getAttribute() { return this.src; },
    removeAttribute() { delete this.src; },
    async play() { this.calls++; },
  };
}

for (const [random, minutes, track] of [[0, 7, 'a.mp3'], [0.999, 14, 'b.mp3']]) {
  test(`music waits ${minutes} minutes after ending, then selects a track`, async () => {
    const audio = audioStub();
    let callback, delay;
    const music = new MusicPlayer({ audio, tracks: ['a.mp3', 'b.mp3'], random: () => random,
      schedule: (cb, ms) => { callback = cb; delay = ms; } });
    await music.start();
    assert.equal(audio.src, track);
    await music.start();
    assert.equal(audio.calls, 1);
    audio.listeners.ended();
    assert.equal(delay, minutes * 60_000);
    await music.start();
    assert.equal(audio.calls, 1);
    callback();
    await Promise.resolve();
    assert.equal(audio.calls, 2);
    assert.equal(audio.src, track);
  });
}

test('blocked autoplay retries on the next start', async () => {
  const audio = audioStub();
  audio.play = async () => { if (++audio.calls === 1) throw new Error('NotAllowedError'); };
  const music = new MusicPlayer({ audio });
  await music.start();
  assert.equal(music.playing, false);
  await music.start();
  assert.equal(music.playing, true);
});

test('audio settings restore, apply immediately, and persist', () => {
  const audio = audioStub();
  const music = new MusicPlayer({ audio });
  let saved = JSON.stringify({ musicMuted: true, musicVolume: 0.25 });
  const renderer = new Proxy({}, { get: () => () => {} });
  const panel = new OptionsPanel({ renderer, time: { setFastForwardEnabled() {} }, music,
    storage: { getItem: () => saved, setItem: (_, value) => { saved = value; } } });
  assert.equal(audio.muted, true);
  assert.equal(audio.volume, 0.25);
  panel.apply('musicMuted', false);
  panel.apply('musicVolume', 0.75);
  assert.equal(audio.muted, false);
  assert.equal(audio.volume, 0.75);
  assert.equal(JSON.parse(saved).musicVolume, 0.75);
});

test('default timer uses the global receiver required by browser timers', () => {
  const original = globalThis.setTimeout;
  let delay;
  globalThis.setTimeout = function (_callback, milliseconds) {
    if (this !== globalThis) throw new TypeError('Illegal invocation');
    delay = milliseconds;
  };
  try {
    const audio = audioStub();
    const music = new MusicPlayer({ audio, random: () => 0 });
    audio.listeners.ended();
    assert.equal(delay, 7 * 60_000);
    assert.equal(music.waiting, true);
  } finally {
    globalThis.setTimeout = original;
  }
});

test('skyOnly music stays silent at ground level and plays only when entering the sky', async () => {
  const audio = audioStub();
  audio.paused = true;
  audio.pause = () => { audio.paused = true; };
  audio.play = async () => { audio.paused = false; audio.calls++; };
  const music = new MusicPlayer({ audio, tracks: ['sky.mp3'], skyOnly: true });
  music.setVolume(0.5);
  await music.start();
  assert.equal(audio.calls, 0, 'does not start on the ground');
  assert.equal(audio.volume, 0);

  music.setSkyFactor(0.5);
  await Promise.resolve();
  assert.equal(audio.calls, 1, 'starts when entering the sky');
  assert.equal(audio.volume, 0.25);

  music.setSkyFactor(0);
  assert.equal(audio.paused, true, 'pauses when returning to street level');
  assert.equal(audio.volume, 0);

  music.setSkyFactor(1);
  assert.equal(audio.calls, 2, 'resumes when returning to the sky');
  assert.equal(audio.volume, 0.5);
});
