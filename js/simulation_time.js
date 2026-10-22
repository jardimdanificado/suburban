export const SPEED_TIERS = [0.5, 1, 2, 4, 8, 16, 32];

/** Fixed simulation steps keep experience rules independent of rendering FPS. */
export class SimulationTime {
  constructor() {
    this.speed = 1;
    this.paused = false;
    this.tick = 0;
    this.elapsed = 0;
    this.stepSeconds = 1 / 60;
    this.accumulator = 0;
  }

  setPaused(value) {
    this.paused = !!value;
    this.accumulator = 0;
  }

  setSpeed(value) {
    if (!SPEED_TIERS.includes(value)) throw new RangeError("Velocidade de simulacao invalida.");
    this.speed = value;
  }

  changeSpeed(direction) {
    const index = SPEED_TIERS.indexOf(this.speed);
    this.setSpeed(SPEED_TIERS[Math.max(0, Math.min(SPEED_TIERS.length - 1, index + Math.sign(direction)))]);
  }

  runStep(update) {
    this.tick++;
    this.elapsed += this.stepSeconds;
    update(this.stepSeconds);
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
    let count = 0;
    while (this.accumulator + 1e-10 >= this.stepSeconds) {
      this.accumulator = Math.max(0, this.accumulator - this.stepSeconds);
      this.runStep(update);
      count++;
      if (this.paused) break;
    }
    return count;
  }
}
