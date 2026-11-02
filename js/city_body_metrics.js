/** Stable physical traits plus gradual weight changes driven by food balance. */
export function initializeBodyMetrics(c,seed=0){
  const id=Number.isFinite(c?.id)?c.id:0;
  c.bodyMetricsSeed??=seed;
  if(!Number.isFinite(c.bodyHeightCm)){const heightSeed=(Math.imul(id+137,3266489917)^seed)>>>0;c.bodyHeightCm=148+(heightSeed%481)/10;}
  if(!Number.isFinite(c.bodyWeightKg)){const physiqueSeed=(Math.imul(id+31,2246822519)^seed)>>>0,bmi=17+(physiqueSeed%2601)/100;c.bodyWeightKg=bmi*(c.bodyHeightCm/100)**2;}
  c.bodyFoodNeedTotal??=0;c.bodyFoodNeedMinutes??=0;
  return c;
}
export function bodyFatAmount(c){
  initializeBodyMetrics(c,c.bodyMetricsSeed||0);
  const height=c.bodyHeightCm/100,bmi=c.bodyWeightKg/(height*height);
  return Math.max(-.48,Math.min(1.1,(bmi-22)/12));
}
