export const FF_SPEED = 64;
export const FF2_SPEED = 128;
// Simulation LOD enters below the classic ff tier: at these speeds the
// per-city-minute budget of the worker (16 ms cadence / 14 ms deadline) is
// already thinner than the measured ~25 ms of a full-detail minute (512
// residents), yet the label/tier stays numeric so saves and UI stay stable.
export const FF_LOD_SPEED = 32;
export const FF3_SPEED = 192;
export const FF4_SPEED = 256;
export const SPEED_TIERS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, FF_SPEED, FF2_SPEED, FF3_SPEED, FF4_SPEED];
export const speedLabel = speed => speed === FF4_SPEED ? 'ff4' : speed === FF3_SPEED ? 'ff3' : speed === FF2_SPEED ? 'ff2' : speed === FF_SPEED ? 'ff' : `${speed}×`;

/** Fixed simulation steps keep experience rules independent of rendering FPS. */
export class SimulationTime {
  constructor({now=()=>performance.now()}={}) {
    this.now=now;
    this.speed = 1;
    this.fastForwardEnabled = false;
    this.paused = false;
    this.tick = 0;
    this.elapsed = 0;
    this.stepSeconds = 1 / 60;
    this.accumulator = 0;
    this.effectiveSpeed = null;
    this.progressSample = null;
  }

  setPaused(value) {
    this.paused = !!value;
    this.effectiveSpeed = null;
    this.progressSample = null;
    this.accumulator = 0;
  }

  get speedTiers() {
    return this.fastForwardEnabled ? SPEED_TIERS : SPEED_TIERS.filter(speed => speed < FF_SPEED);
  }

  setFastForwardEnabled(value) {
    this.fastForwardEnabled = !!value;
    if (!this.fastForwardEnabled && this.speed >= FF_SPEED) this.setSpeed(32);
  }

  cycleSpeed() {
    const tiers = this.speedTiers;
    this.setSpeed(tiers[(tiers.indexOf(this.speed) + 1) % tiers.length]);
  }

  setSpeed(value) {
    if (!SPEED_TIERS.includes(value)) throw new RangeError("Velocidade de simulacao invalida.");
    this.speed = !this.fastForwardEnabled && value >= FF_SPEED ? 32 : value;
    this.effectiveSpeed = null;
    this.progressSample = null;
  }

  observeProgress(elapsed) {
    const now=this.now(),sample=this.progressSample;
    if(!Number.isFinite(elapsed))return;
    if(!sample||elapsed<sample.elapsed){this.progressSample={now,elapsed};return;}
    if(now-sample.now>=1000){this.effectiveSpeed=(elapsed-sample.elapsed)/((now-sample.now)/1000);this.progressSample={now,elapsed};}
  }

  changeSpeed(direction) {
    const tiers = this.speedTiers;
    const index = tiers.indexOf(this.speed);
    this.setSpeed(tiers[Math.max(0, Math.min(tiers.length - 1, index + Math.sign(direction)))]);
  }

  runStep(update, dt = this.stepSeconds) {
    this.tick++;
    this.elapsed += dt;
    update(dt);
    this.observeProgress(this.elapsed);
  }

  step(update) {
    if (!this.paused) return false;
    this.runStep(update);
    return true;
  }

  advance(realDt, update) {
    if (this.paused || !Number.isFinite(realDt) || realDt <= 0) return 0;
    // A suspended browser tab does not generate minutes of catch-up work.
    this.accumulator += Math.min(realDt, 0.25) * this.speed;
    const step = this.speed >= FF4_SPEED ? 1 : this.speed >= FF3_SPEED ? .75 : this.speed >= FF2_SPEED ? .5 : this.speed === FF_SPEED ? .25 : this.stepSeconds;
    let count = 0;
    const deadline = this.now() + 6;
    while (this.accumulator + 1e-10 >= step && count < 120 && this.now() < deadline) {
      this.accumulator = Math.max(0, this.accumulator - step);
      this.runStep(update, step);
      count++;
      if (this.paused) break;
    }
    // The local fallback also yields to rendering instead of compounding a slow frame.
    this.accumulator = Math.min(this.accumulator, step * 2);
    return count;
  }
}
