export const WORLD_PRESETS = { archipelago: { id: 0, label: 'Arquipélago' }, continent: { id: 1, label: 'Continente' }, highlands: { id: 2, label: 'Terras altas' } };
export function randomWorldSeed() {
  const values = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
  else values[0] = Math.floor(Math.random() * 0x100000000);
  return values[0] % 2147483646 + 1;
}
export function resolveWorldSettings(params = new URLSearchParams()) {
  const raw = params.get('seed');
  const parsed = raw !== null && /^\d+$/.test(raw) ? Number(raw) : NaN;
  const seed = Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 2147483647 ? parsed : randomWorldSeed();
  const preset = Object.hasOwn(WORLD_PRESETS, params.get('terrain')) ? params.get('terrain') : Object.keys(WORLD_PRESETS)[seed % 3];
  const rawPopulation = params.get('population');
  const parsedPopulation = rawPopulation !== null && /^\d+$/.test(rawPopulation) ? Number(rawPopulation) : NaN;
  const population = Number.isSafeInteger(parsedPopulation) && parsedPopulation >= 1 && parsedPopulation <= 2000 ? parsedPopulation : 512;
  const rawSize=params.get('size'),parsedSize=rawSize!==null&&/^\d+$/.test(rawSize)?Number(rawSize):NaN;
  const size=Number.isSafeInteger(parsedSize)&&parsedSize>=128&&parsedSize<=1024?parsedSize:256;
  return { seed, preset, presetId: WORLD_PRESETS[preset].id, population, size };
}
