// =============================================================================
// Brutopolis - Procedural World Generator (Pure JavaScript Port)
// =============================================================================

export const MAP_WIDTH = 128;
export const MAP_HEIGHT = 128;

export const TILE_FLOOR = 0;              // Fertile Grassland / Lowland Plains (h = 1.10)
export const TILE_MOUNTAIN = 1;           // Mountain Massif (h = 5.50 - NO ROADS)
export const TILE_WATER = 2;              // Single Water / Ocean / Lakes (h = 0.0 - NO ROADS)
export const TILE_SAND = 3;               // Sand / Beach Dunes (h = 0.40)
export const TILE_STONE = 4;              // Rocky Ground / Mountain Foothills (h = 3.80 - NO ROADS)
export const TILE_VOID = 5;
export const TILE_ROAD_GRASS = 6;         // Plains Dirt Road (h = 1.10)
export const TILE_ROAD_SAND = 7;          // Sand Dirt Road (h = 0.40)
export const TILE_ROAD_GRASS_STONE = 8;   // Plains Stone Brick Road (h = 1.10)
export const TILE_HILL = 9;               // Highland Earth / Colinas / Montinhas (h = 2.30)
export const TILE_PEAK = 10;              // High Mountain Peak / Cume (h = 7.50 - NO ROADS)
export const TILE_ROAD_SAND_STONE = 11;   // Sand Stone Brick Road (h = 0.40)
export const TILE_ROAD_HILL = 12;         // Hill Dirt Road (h = 2.30)
export const TILE_ROAD_HILL_STONE = 13;   // Hill Stone Brick Road (h = 2.30)

// Cultivated ground retains the exact height class of the replaced tile.
export const FARM_TILES=new Set([14,15,16,17,18,19]);
const FARM_BASE={14:TILE_FLOOR,15:TILE_SAND,16:TILE_HILL,17:TILE_STONE,18:TILE_MOUNTAIN,19:TILE_PEAK};
export const baseTerrainTile=tile=>FARM_BASE[tile]??tile;
export function farmSoilTile(tile){if(FARM_TILES.has(tile))return tile;return ({[TILE_FLOOR]:14,[TILE_SAND]:15,[TILE_HILL]:16,[TILE_STONE]:17,[TILE_MOUNTAIN]:18,[TILE_PEAK]:19})[tile]??null;}

export const MAP_PRESET_ARCHIPELAGO = {
  seed: 0,
  noise_scale: 0.05,
  octaves: 4,
  land_base: 0.78,
  num_islands: 6,
  min_island_radius: 90.0,
  max_island_radius: 170.0,
  water_threshold: 0.35,
  mountain_threshold: 0.70,
  ca_smooth_iterations: 3
};

export const MAP_PRESET_CONTINENT = {
  seed: 0,
  noise_scale: 0.035,
  octaves: 5,
  land_base: 0.94,
  num_islands: 3,
  min_island_radius: 140.0,
  max_island_radius: 240.0,
  water_threshold: 0.33,
  mountain_threshold: 0.72,
  ca_smooth_iterations: 4
};

export const MAP_PRESET_HIGHLANDS = {
  seed: 0,
  noise_scale: 0.06,
  octaves: 4,
  land_base: 0.90,
  num_islands: 4,
  min_island_radius: 100.0,
  max_island_radius: 180.0,
  water_threshold: 0.30,
  mountain_threshold: 0.65,
  ca_smooth_iterations: 2
};

// IDs remain stable. Profiles vary the existing noise and island parameters.
export const MAP_PRESETS = [
  MAP_PRESET_ARCHIPELAGO,
  MAP_PRESET_CONTINENT,
  MAP_PRESET_HIGHLANDS,
  {...MAP_PRESET_CONTINENT,water_threshold:.29,num_islands:2},
  {...MAP_PRESET_ARCHIPELAGO,noise_scale:.035,land_base:.9,water_threshold:.44,num_islands:9},
  {...MAP_PRESET_ARCHIPELAGO,noise_scale:.035,land_base:.9,water_threshold:.43,num_islands:5}
];

let s_rand_seed = 123456789;

function wasm_rand() {
  s_rand_seed = (Math.imul(s_rand_seed, 1103515245) + 12345) & 0x7fffffff;
  return s_rand_seed;
}

function random_seed(seed) {
  if (!seed) seed = 123456789;
  s_rand_seed = seed >>> 0;
  const iters = (seed % 17) + 1;
  for (let i = 0; i < iters; i++) wasm_rand();
}

function random_int(min_val, max_val) {
  if (min_val >= max_val) return min_val;
  const range = (max_val - min_val + 1) >>> 0;
  return min_val + (wasm_rand() % range);
}

let s_noise_seed = 12345;

function hash2(x, y) {
  let h = (Math.imul(x, 1619) + Math.imul(y, 31337) + Math.imul(s_noise_seed, 6971)) >>> 0;
  h ^= h >>> 17;
  h = Math.imul(h, 0xbf324c81) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0x9a7ed521) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function vnoise_at(x, y) {
  return (hash2(x, y) & 0xFFFF) / 65535.0;
}

function bilerp(a, b, c, d, tx, ty) {
  const ab = a + (b - a) * tx;
  const cd = c + (d - c) * tx;
  return ab + (cd - ab) * ty;
}

function smoothstep(t) {
  return t * t * (3.0 - 2.0 * t);
}

function vnoise(fx, fy) {
  let xi = Math.floor(fx);
  let yi = Math.floor(fy);
  const tx = smoothstep(fx - xi);
  const ty = smoothstep(fy - yi);
  const a = vnoise_at(xi, yi);
  const b = vnoise_at(xi + 1, yi);
  const c = vnoise_at(xi, yi + 1);
  const d = vnoise_at(xi + 1, yi + 1);
  return bilerp(a, b, c, d, tx, ty);
}

function fbm(fx, fy, octaves) {
  let value = 0.0;
  let amp = 0.5;
  let freq = 1.0;
  let max_v = 0.0;
  for (let i = 0; i < octaves; i++) {
    value += vnoise(fx * freq, fy * freq) * amp;
    max_v += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return value / max_v;
}

function island_falloff(dx, dy, radius) {
  const d = dx * dx + dy * dy;
  const r = radius * radius;
  if (d >= r) return 0.0;
  const t = 1.0 - d / r;
  return t * t * (3.0 - 2.0 * t);
}

let s_hmap = new Float32Array(0);
let tmp_ca = new Uint8Array(0);
let tmp_ca_vertical = new Uint8Array(0);

function ca_smooth(map, iterations, MAP_WIDTH, MAP_HEIGHT) {
  if(tmp_ca.length!==map.length)tmp_ca=new Uint8Array(map.length);
  if(tmp_ca_vertical.length!==map.length)tmp_ca_vertical=new Uint8Array(map.length);
  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const yOffset=y*MAP_WIDTH,upOffset=(y-1)*MAP_WIDTH,downOffset=(y+1)*MAP_WIDTH;
      for(let x=0;x<MAP_WIDTH;x++){let count=map[yOffset+x]!==TILE_WATER;if(y>0&&map[upOffset+x]!==TILE_WATER)count++;if(y+1<MAP_HEIGHT&&map[downOffset+x]!==TILE_WATER)count++;tmp_ca_vertical[yOffset+x]=count;}
      for (let x = 0; x < MAP_WIDTH; x++) {
        let land=tmp_ca_vertical[yOffset+x];
        if(x>0)land+=tmp_ca_vertical[yOffset+x-1];
        if(x+1<MAP_WIDTH)land+=tmp_ca_vertical[yOffset+x+1];
        const idx = yOffset + x;
        const cur = map[idx];
        if (cur !== TILE_WATER) {
          tmp_ca[idx] = land >= 4 ? cur : TILE_WATER;
        } else {
          tmp_ca[idx] = land >= 6 ? TILE_FLOOR : cur;
        }
      }
    }
    map.set(tmp_ca);
  }
}

export function world_gen_is_walkable(map, x, y, move_type = 1, MAP_WIDTH = Math.sqrt(map.length), MAP_HEIGHT = MAP_WIDTH) {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false;
  const t = map[y * MAP_WIDTH + x];
  if (t === TILE_VOID) return false;
  if (move_type === 3) return true; // Fly
  if (move_type === 2) return t === TILE_WATER; // Aquatic
  if (move_type === 1) return t !== TILE_WATER; // Terrestrial
  return false;
}

export function world_gen_generate(map, config, outCenter = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 }) {
  const MAP_WIDTH = config?.width ?? Math.sqrt(map.length), MAP_HEIGHT = config?.height ?? MAP_WIDTH;
  if(!Number.isInteger(MAP_WIDTH)||!Number.isInteger(MAP_HEIGHT)||MAP_WIDTH*MAP_HEIGHT!==map.length)throw new RangeError("Dimensões do mapa inválidas");
  if(s_hmap.length!==map.length){s_hmap=new Float32Array(map.length);tmp_ca=new Uint8Array(map.length);}
  const cfg = Object.assign({}, MAP_PRESET_ARCHIPELAGO, config || {});

  const scale = Math.min(MAP_WIDTH, MAP_HEIGHT) / 1024;
  cfg.min_island_radius *= scale; cfg.max_island_radius *= scale;
  random_seed(cfg.seed > 0 ? cfg.seed : 1337);
  s_noise_seed = wasm_rand();

  const MAX_ISLAND_CENTROIDS = 16;
  let n_islands = cfg.num_islands > 0 ? cfg.num_islands : 4;
  if (n_islands > MAX_ISLAND_CENTROIDS) n_islands = MAX_ISLAND_CENTROIDS;

  const islands = [];
  islands.push({
    cx: MAP_WIDTH / 2,
    cy: MAP_HEIGHT / 2,
    radius: cfg.max_island_radius
  });

  for (let i = 1; i < n_islands; i++) {
    const margin = Math.min(40, Math.floor(Math.min(MAP_WIDTH, MAP_HEIGHT)*.08));
    islands.push({
      cx: margin + random_int(0, Math.floor(MAP_WIDTH - 2 * margin)),
      cy: margin + random_int(0, Math.floor(MAP_HEIGHT - 2 * margin)),
      radius: cfg.min_island_radius + random_int(0, Math.floor(cfg.max_island_radius - cfg.min_island_radius + 1.0))
    });
  }

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const yOffset = y * MAP_WIDTH;
    for (let x = 0; x < MAP_WIDTH; x++) {
      const nx = x * cfg.noise_scale;
      const ny = y * cfg.noise_scale;
      const n = fbm(nx, ny, cfg.octaves);

      let falloff = 0.0;
      for (let i = 0; i < n_islands; i++) {
        const dx = x - islands[i].cx;
        const dy = y - islands[i].cy;
        const f = island_falloff(dx, dy, islands[i].radius);
        if (f > falloff) falloff = f;
      }

      // Keep terrain across the map while islands add broad coastal variation.
      const base = Math.max(0, Math.min(1, cfg.land_base ?? 0.78));
      s_hmap[yOffset + x] = n * (base + (1 - base) * falloff);
    }
  }

  // Broad grassland plains cover the majority of land, with gentle rolling hills,
  // rocky foothills around mountain ranges, and high summits only at the peaks.
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const yOffset = y * MAP_WIDTH;
    for (let x = 0; x < MAP_WIDTH; x++) {
      const h = s_hmap[yOffset + x];
      const idx = yOffset + x;

      if (h < cfg.water_threshold) {
        map[idx] = TILE_WATER;
      } else if (h >= 0.88) {
        map[idx] = TILE_PEAK;     // Rare High Mountain Peak (h = 7.50)
      } else if (h >= 0.76) {
        map[idx] = TILE_MOUNTAIN; // Mountain Massif (h = 5.50)
      } else if (h >= 0.66) {
        map[idx] = TILE_STONE;    // Rocky Foothills (h = 3.80)
      } else if (h >= 0.50) {
        map[idx] = TILE_HILL;     // Rolling Hills / Montinhas (h = 2.30)
      } else {
        map[idx] = TILE_FLOOR;    // Broad Fertile Grass Plains (h = 1.10)
      }
    }
  }

  if (cfg.ca_smooth_iterations > 0) {
    ca_smooth(map, cfg.ca_smooth_iterations, MAP_WIDTH, MAP_HEIGHT);
  }

  // 2. Post-process Biome Borders: beaches extend two tiles inland, with
  // a softly varying third tile so the shoreline does not form a hard ring.
  tmp_ca.set(map);
  const shore_distance=new Uint8Array(map.length);shore_distance.fill(255);
  for(let idx=0;idx<map.length;idx++)if(tmp_ca[idx]===TILE_WATER)shore_distance[idx]=0;
  for(let distance=1;distance<=3;distance++){
    const previous=shore_distance.slice();
    for(let y=0;y<MAP_HEIGHT;y++)for(let x=0;x<MAP_WIDTH;x++){
      const idx=y*MAP_WIDTH+x,tile=tmp_ca[idx];
      if(previous[idx]!==255||(tile!==TILE_FLOOR&&tile!==TILE_HILL))continue;
      let touchesPreviousLayer=false;
      for(let dy=-1;dy<=1&&!touchesPreviousLayer;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;
        if(nx<0||ny<0||nx>=MAP_WIDTH||ny>=MAP_HEIGHT)continue;
        if(previous[ny*MAP_WIDTH+nx]===distance-1){touchesPreviousLayer=true;break;}
      }
      if(touchesPreviousLayer)shore_distance[idx]=distance;
    }
  }
  const coastNoiseScale=Math.max(.008,cfg.noise_scale*.35);
  for(let y=0;y<MAP_HEIGHT;y++)for(let x=0;x<MAP_WIDTH;x++){
    const idx=y*MAP_WIDTH+x,distance=shore_distance[idx],tile=tmp_ca[idx];
    if((tile===TILE_FLOOR||tile===TILE_HILL)&&(distance<=2||(distance===3&&fbm(x*coastNoiseScale,y*coastNoiseScale,2)>.48)))map[idx]=TILE_SAND;
  }

  // Find center walkable spawn
  let center_x = Math.floor(MAP_WIDTH / 2);
  let center_y = Math.floor(MAP_HEIGHT / 2);
  for (let r = 0; r < 60; r++) {
    let found = false;
    for (let dy = -r; dy <= r && !found; dy++) {
      for (let dx = -r; dx <= r && !found; dx++) {
        if (world_gen_is_walkable(map, center_x + dx, center_y + dy, 1, MAP_WIDTH, MAP_HEIGHT)) {
          center_x += dx;
          center_y += dy;
          found = true;
        }
      }
    }
    if (found) break;
  }

  outCenter.x = center_x;
  outCenter.y = center_y;
  try{ensureMaritimeSpawn(map, MAP_WIDTH, MAP_HEIGHT, outCenter);}
  catch(error){
    // Expose the noise field's natural lowlands when a dry seed has no sea
    // access. Never carve a border channel or insert a founding island.
    const attempt=config?._maritimeAttempt||0;
    if(attempt>=20)throw error;
    return world_gen_generate(map,{...config,water_threshold:cfg.water_threshold+.015,_maritimeAttempt:attempt+1},outCenter);
  }
  return outCenter;
}

// Choose a land component touching ocean connected to the map edge, rather
// than accepting an inland lake as a working international harbor.
export function ensureMaritimeSpawn(map,width,height,outCenter){
  const total=map.length,sea=new Uint8Array(total),seen=new Uint8Array(total),queue=new Int32Array(total);let head=0,tail=0;
  const addSea=i=>{if(map[i]===TILE_WATER&&!sea[i]){sea[i]=1;queue[tail++]=i;}};
  for(let x=0;x<width;x++){addSea(x);addSea((height-1)*width+x);}
  for(let y=0;y<height;y++){addSea(y*width);addSea(y*width+width-1);}
  const neighbors=(i,visit)=>{const x=i%width,y=Math.floor(i/width);if(x>0)visit(i-1);if(x+1<width)visit(i+1);if(y>0)visit(i-width);if(y+1<height)visit(i+width);};
  while(head<tail)neighbors(queue[head++],addSea);
  let bestSize=0,best=null;
  const walkable=i=>map[i]===TILE_FLOOR||map[i]===TILE_SAND||map[i]===TILE_HILL;
  const landHeight=i=>map[i]===TILE_SAND?.4:map[i]===TILE_HILL?2.3:1.1;
  for(let start=0;start<total;start++){
    if(seen[start]||!walkable(start))continue;
    head=0;tail=1;queue[0]=start;seen[start]=1;let coast=false,nearest=start,distance=Infinity;
    while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width),d=(x-width/2)**2+(y-height/2)**2;if(d<distance){distance=d;nearest=i;}
      neighbors(i,j=>{if(sea[j])coast=true;if(!seen[j]&&walkable(j)&&Math.abs(landHeight(i)-landHeight(j))<=1.25){seen[j]=1;queue[tail++]=j;}});
    }
    if(coast&&tail>bestSize){bestSize=tail;best=nearest;}
  }
  if(best===null)throw new Error('Terreno sem costa navegável para fundar a cidade.');
  outCenter.x=best%width;outCenter.y=Math.floor(best/width);
}
