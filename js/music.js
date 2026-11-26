export const MUSIC_TRACKS = ["data/music/kayoa - suburban.mp3", 
  "data/music/672432__maximebedot__cuba-havana-music-salsa-bodeguita.ogg",
  "data/music/405031__kyles__cumbia-band-playing-on-stopped-parade-float-in-street-for-40th-anniversary-party-great-song-saravena-colombia-2016.ogg",
  "data/music/219317__felixblume__mexican-mariachis-playing-las-mananitas-on-the-square-garibaldi-in-mexico-city.ogg",
  "data/music/177304__lenguaverde__jarabe-tapatio-mariachi.ogg",
];

export class MusicPlayer {
  constructor({ audio = new Audio(), tracks = MUSIC_TRACKS, random = Math.random, schedule = (callback, delay) => globalThis.setTimeout(callback, delay) } = {}) {
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
    audio.preload = "auto";
    audio.addEventListener("ended", () => {
      this.playing = false;
      this.audio.removeAttribute("src");
      this.waiting = true;
      const minutes = 7 + Math.floor(this.random() * 8);
      this.schedule(() => {
        this.waiting = false;
        if (this.suspended) { this.needsStart = true; return; }
        this.start();
      }, minutes * 60_000);
    });
  }

  setMuted(value) { this.audio.muted = value; }
  setVolume(value) { this.audio.volume = value; }

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
    if (this.suspended || this.waiting || this.playing || this.pending || !this.tracks.length) return;
    this.pending = true;
    if (!this.audio.getAttribute("src")) {
      this.audio.src = this.tracks[Math.floor(this.random() * this.tracks.length)];
    }
    try {
      await this.audio.play();
      this.playing = true;
      if (this.suspended) {
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
