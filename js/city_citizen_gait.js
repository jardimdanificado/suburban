// Consume the full traveled distance, but display an adjacent pose per frame.
// No clock throttle: fast interpolation must animate on every moving frame.
// Adjacent poses avoid aliasing when a packet spans a whole animation cycle.
export function advanceCitizenGait(motion, paused=false) {
  if(paused||motion.walkDistance<.25-1e-8)return 0;
  const steps=Math.floor((motion.walkDistance+1e-8)/.25);
  motion.walkFrame++;
  motion.walkDistance=Math.max(0,motion.walkDistance-steps*.25);
  return steps;
}
