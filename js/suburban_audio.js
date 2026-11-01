const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const BUILTIN_EVENTS = {
  "ui.click": { bus: "ui", waveform: "square", frequency: 620, duration: 0.035, gain: 0.055, endFrequency: 420 },
  "ui.confirm": { bus: "ui", waveform: "triangle", frequency: 520, duration: 0.11, gain: 0.075, endFrequency: 880 },
  "city.place": { bus: "sfx", waveform: "triangle", frequency: 190, duration: 0.16, gain: 0.12, endFrequency: 360 },
  "city.alert": { bus: "sfx", waveform: "sawtooth", frequency: 310, duration: 0.24, gain: 0.08, endFrequency: 180 },
};

/** Small event based audio runtime for Suburban, built on the browser Web Audio API. */
export class SuburbanAudio {
  constructor({ storage = null, storageKey = "suburban.audio" } = {}) {
    this.storage = storage;
    this.storageKey = storageKey;
    this.context = null;
    this.master = null;
    this.buses = new Map();
    this.events = new Map(Object.entries(BUILTIN_EVENTS));
    this.buffers = new Map();
    this.instances = new Set();
    this.parameters = new Map();
    this.listener = { x: 0, y: 0, z: 0, forwardX: 0, forwardY: 0, forwardZ: -1, upX: 0, upY: 1, upZ: 0 };
    this.volumes = { master: 0.8, music: 0.65, ambience: 0.65, sfx: 0.8, ui: 0.65 };
    try {
      const saved = JSON.parse(storage?.getItem(storageKey) || "{}");
      for (const bus of Object.keys(this.volumes)) {
        if (Number.isFinite(saved[bus])) this.volumes[bus] = clamp(saved[bus], 0, 1);
      }
    } catch {}
  }

  registerEvent(name, definition) {
    if (!name || !definition || typeof definition !== "object") return false;
    this.events.set(String(name), { bus: "sfx", waveform: "sine", frequency: 440, duration: 0.12, gain: 0.1, ...definition });
    return true;
  }

  async loadBank(manifest, { baseUrl = "" } = {}) {
    if (!manifest || typeof manifest !== "object" || !manifest.events || typeof manifest.events !== "object") {
      throw new TypeError("Banco de áudio inválido: esperado um objeto com events.");
    }
    await this.unlock();
    const loaded = [];
    await Promise.all(Object.entries(manifest.events).map(async ([name, definition]) => {
      this.registerEvent(name, definition);
      if (!definition.src) return;
      const response = await fetch(new URL(definition.src, baseUrl || document.baseURI));
      if (!response.ok) throw new Error(`Falha ao carregar áudio ${name}: HTTP ${response.status}`);
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      this.buffers.set(name, buffer);
      loaded.push(name);
    }));
    return loaded;
  }

  setParameter(name, value) {
    if (name) this.parameters.set(String(name), Number(value) || 0);
  }

  getParameter(name) { return this.parameters.get(String(name)) ?? 0; }

  setListener(x = 0, y = 0) {
    // Backward-compatible 2D map coordinates: map Y is the scene's Z axis.
    this.setListener3D(x, 0, y);
  }

  setListener3D(x = 0, y = 0, z = 0, orientation = {}) {
    this.listener = {
      x: Number(x) || 0, y: Number(y) || 0, z: Number(z) || 0,
      forwardX: Number(orientation.forwardX) || 0,
      forwardY: Number(orientation.forwardY) || 0,
      forwardZ: Number.isFinite(orientation.forwardZ) ? orientation.forwardZ : -1,
      upX: Number(orientation.upX) || 0,
      upY: Number.isFinite(orientation.upY) ? orientation.upY : 1,
      upZ: Number(orientation.upZ) || 0,
    };
    const listener = this.context?.listener;
    if (!listener) return;
    const now = this.context.currentTime;
    const set = (param, value) => param?.setTargetAtTime(value, now, 0.025);
    set(listener.positionX, this.listener.x); set(listener.positionY, this.listener.y); set(listener.positionZ, this.listener.z);
    set(listener.forwardX, this.listener.forwardX); set(listener.forwardY, this.listener.forwardY); set(listener.forwardZ, this.listener.forwardZ);
    set(listener.upX, this.listener.upX); set(listener.upY, this.listener.upY); set(listener.upZ, this.listener.upZ);
  }

  setBusVolume(bus, volume, persist = true) {
    if (!(bus in this.volumes) || !Number.isFinite(Number(volume))) return false;
    this.volumes[bus] = clamp(Number(volume), 0, 1);
    const target = bus === "master" ? this.master : this.buses.get(bus);
    if (target && this.context) target.gain.setTargetAtTime(this.volumes[bus], this.context.currentTime, 0.015);
    if (persist) {
      try { this.storage?.setItem(this.storageKey, JSON.stringify(this.volumes)); } catch {}
    }
    return true;
  }

  async unlock() {
    if (typeof window === "undefined" || !window.AudioContext) return false;
    if (!this.context) {
      this.context = new window.AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volumes.master;
      this.master.connect(this.context.destination);
      for (const name of ["music", "ambience", "sfx", "ui"]) {
        const gain = this.context.createGain();
        gain.gain.value = this.volumes[name];
        gain.connect(this.master);
        this.buses.set(name, gain);
      }
      this.setListener3D(this.listener.x, this.listener.y, this.listener.z, this.listener);
    }
    if (this.context.state === "suspended") await this.context.resume();
    return this.context.state === "running";
  }

  play(name, options = {}) {
    const definition = this.events.get(String(name));
    if (!definition || !this.context || this.context.state !== "running") return null;
    const maxDistance = Math.max(1, Number(options.maxDistance ?? definition.maxDistance ?? 40));
    const position = options.spatial ? (Number.isFinite(options.z)
      ? { x: Number(options.x) || 0, y: Number(options.y) || 0, z: Number(options.z) || 0 }
      : { x: Number(options.x) || 0, y: Number(options.height) || 0, z: Number(options.y) || 0 }) : null;
    const context = this.context;
    const bus = this.buses.get(definition.bus) || this.buses.get("sfx");
    const buffer = this.buffers.get(String(name));
    const source = buffer ? context.createBufferSource() : context.createOscillator();
    const envelope = context.createGain();
    const panner = position ? context.createPanner() : context.createStereoPanner();
    const now = context.currentTime;
    const pitch = Number(options.pitch ?? (this.parameters.has("pitch") ? this.getParameter("pitch") : 1));
    const loop = !!(options.loop ?? definition.loop);
    const duration = loop ? null : clamp(Number(options.duration) || (buffer ? buffer.duration / Math.max(0.05, pitch) : Number(definition.duration) || 0.12), 0.015, 600);
    const baseFrequency = Number(definition.frequency) || 440;
    const volume = clamp(Number(options.volume ?? 1), 0, 2);
    const peak = Math.max(0.0001, (Number(definition.gain) || 0.1) * volume);

    if (buffer) {
      source.buffer = buffer;
      source.loop = loop;
      source.playbackRate.setValueAtTime(clamp(pitch, 0.05, 4), now);
    } else {
      const frequency = clamp(baseFrequency * pitch, 30, 16000);
      const endFrequency = clamp(Number(definition.endFrequency ?? frequency) * pitch, 30, 16000);
      source.type = ["sine", "square", "sawtooth", "triangle"].includes(definition.waveform) ? definition.waveform : "sine";
      source.frequency.setValueAtTime(frequency, now);
      source.frequency.exponentialRampToValueAtTime(endFrequency, now + (duration || 0.12));
    }
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(peak, now + Math.min(0.012, (duration || 0.12) * 0.25));
    if (duration) envelope.gain.setValueAtTime(peak, Math.max(now + 0.012, now + duration - 0.02));
    if (!loop) envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    if (position) {
      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.refDistance = Math.max(0.01, Number(options.refDistance ?? definition.refDistance ?? 1));
      panner.maxDistance = maxDistance;
      panner.rolloffFactor = Math.max(0, Number(options.rolloffFactor ?? definition.rolloffFactor ?? 1));
      panner.setPosition(position.x, position.y, position.z);
    } else panner.pan.value = 0;
    source.connect(envelope);
    envelope.connect(panner);
    panner.connect(bus);
    source.start(now);
    if (!loop) source.stop(now + duration + 0.01);

    let stopped = false;
    const instance = {
      name: String(name),
      stop: (fade = 0.03) => {
        if (stopped) return;
        stopped = true;
        const stopAt = context.currentTime + Math.max(0, fade);
        envelope.gain.cancelScheduledValues(context.currentTime);
        envelope.gain.setTargetAtTime(0.0001, context.currentTime, Math.max(0.001, fade / 4));
        source.stop(stopAt + 0.02);
      },
    };
    this.instances.add(instance);
    source.onended = () => { this.instances.delete(instance); source.disconnect(); envelope.disconnect(); panner.disconnect(); };
    return instance;
  }

  stopAll(fade = 0.03) { for (const instance of [...this.instances]) instance.stop(fade); }
}

export const suburbanAudio = new SuburbanAudio({ storage: (() => { try { return window.localStorage; } catch { return null; } })() });
