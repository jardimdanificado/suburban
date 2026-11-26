export const MUSIC_TRACKS = ["data/music/kayoa - suburban.mp3", 
  "data/music/672432__maximebedot__cuba-havana-music-salsa-bodeguita.ogg",
  "data/music/405031__kyles__cumbia-band-playing-on-stopped-parade-float-in-street-for-40th-anniversary-party-great-song-saravena-colombia-2016.ogg",
  "data/music/219317__felixblume__mexican-mariachis-playing-las-mananitas-on-the-square-garibaldi-in-mexico-city.ogg",
  "data/music/177304__lenguaverde__jarabe-tapatio-mariachi.ogg",
];

export class MusicPlayer {
  constructor({ audio = new Audio(), tracks = MUSIC_TRACKS, random = Math.random, schedule = (callback, delay) => globalThis.setTimeout(callback, delay), skyOnly = false } = {}) {
    this.audio = audio;
    this.tracks = tracks;
    this.random = random;
    this.schedule = schedule;
    this.waiting = false;
    this.playing = false;
    this.pending = false;
    this.suspended = false;
    this.resumePlayback = false;
    this.needsStart = false;
    this.baseVolume = 1;
    this.skyFactor = skyOnly ? 0 : 1;
    audio.preload = "auto";
    audio.addEventListener("ended", () => {
      this.playing = false;
      this.audio.removeAttribute("src");
      this.waiting = true;
      const minutes = 7 + Math.floor(this.random() * 8);
      this.schedule(() => {
        this.waiting = false;
        if (this.suspended || this.skyFactor <= 0) { this.needsStart = true; return; }
        this.start();
      }, minutes * 60_000);
    });
  }

  setMuted(value) { this.audio.muted = value; }
  setVolume(value) {
    this.baseVolume = Math.max(0, Math.min(1, Number(value) || 0));
    this.audio.volume = this.baseVolume * this.skyFactor;
  }

  setSkyFactor(factor) {
    const next = Math.max(0, Math.min(1, Number(factor) || 0));
    if (next === this.skyFactor) return;
    const wasInSky = this.skyFactor > 0;
    this.skyFactor = next;
    this.audio.volume = this.baseVolume * next;
    if (next <= 0) {
      if (wasInSky && this.audio.paused !== true) {
        this.resumePlayback = true;
        this.audio.pause?.();
      }
      return;
    }
    if (this.suspended) return;
    if (this.needsStart) {
      this.needsStart = false;
      this.start();
      return;
    }
    if (!this.playing) {
      this.start();
    } else if (this.resumePlayback || this.audio.paused) {
      this.resumePlayback = false;
      this.audio.play().catch(() => {});
    }
  }

  // Pause must silence music on the same frame as the simulation pause.
  pause() {
    if (this.suspended) return;
    this.suspended = true;
    if (this.audio.paused !== true) {
      this.resumePlayback = true;
      this.audio.pause?.();
    }
  }

  resume() {
    if (!this.suspended) return;
    this.suspended = false;
    if (this.skyFactor <= 0) return;
    if (this.needsStart) {
      this.needsStart = false;
      this.start();
      return;
    }
    if (this.resumePlayback) {
      this.resumePlayback = false;
      if (this.playing) this.audio.play().catch(() => {});
    }
  }

  async start() {
    if (this.suspended || this.skyFactor <= 0 || this.waiting || this.playing || this.pending || !this.tracks.length) return;
    this.pending = true;
    if (!this.audio.getAttribute("src")) {
      this.audio.src = this.tracks[Math.floor(this.random() * this.tracks.length)];
    }
    try {
      await this.audio.play();
      this.playing = true;
      if (this.suspended || this.skyFactor <= 0) {
        this.audio.pause?.();
        this.resumePlayback = true;
      }
    } catch {
      // Browsers may require a user gesture before allowing sound.
    } finally {
      this.pending = false;
    }
  }
}
