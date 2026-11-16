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
