export const MUSIC_TRACKS = ["data/music/kayoa - suburban.mp3", "data/music/672432__maximebedot__cuba-havana-music-salsa-bodeguita_audio.ogg"];

export class MusicPlayer {
  constructor({ audio = new Audio(), tracks = MUSIC_TRACKS, random = Math.random, schedule = (callback, delay) => globalThis.setTimeout(callback, delay) } = {}) {
    this.audio = audio;
    this.tracks = tracks;
    this.random = random;
    this.schedule = schedule;
    this.waiting = false;
    this.playing = false;
    this.pending = false;
    audio.preload = "auto";
    audio.addEventListener("ended", () => {
      this.playing = false;
      this.audio.removeAttribute("src");
      this.waiting = true;
      const minutes = 7 + Math.floor(this.random() * 8);
      this.schedule(() => {
        this.waiting = false;
        this.start();
      }, minutes * 60_000);
    });
  }

  setMuted(value) { this.audio.muted = value; }
  setVolume(value) { this.audio.volume = value; }

  async start() {
    if (this.waiting || this.playing || this.pending || !this.tracks.length) return;
    this.pending = true;
    if (!this.audio.getAttribute("src")) {
      this.audio.src = this.tracks[Math.floor(this.random() * this.tracks.length)];
    }
    try {
      await this.audio.play();
      this.playing = true;
    } catch {
      // Browsers may require a user gesture before allowing sound.
    } finally {
      this.pending = false;
    }
  }
}
