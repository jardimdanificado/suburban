import {FARM_TILES} from './world_gen.js?v=deep-perf-3';
import { randomWorldSeed } from './world_settings.js?v=map-default-256-1';
import { roadFor, ROAD_TILES } from './city_terrain.js?v=quarry-outskirts-1';
// =============================================================================
// Brutopolis - World & Environment System (Pure JS Engine)
// =============================================================================

import {
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_FLOOR,
  TILE_MOUNTAIN,
  TILE_WATER,
  TILE_SAND,
  TILE_STONE,
  TILE_VOID,
  TILE_ROAD_GRASS,
  TILE_ROAD_SAND,
  TILE_ROAD_GRASS_STONE,
  TILE_HILL,
  TILE_PEAK,
  TILE_ROAD_SAND_STONE,
  TILE_ROAD_HILL,
  TILE_ROAD_HILL_STONE,
  MAP_PRESET_ARCHIPELAGO,
  MAP_PRESET_CONTINENT,
  MAP_PRESET_HIGHLANDS,
  world_gen_generate,
  world_gen_is_walkable
} from "./world_gen.js?v=deep-perf-3";

const SIDEWALK_TERRAIN=new Set([TILE_FLOOR,TILE_HILL,TILE_SAND]);

export {
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_FLOOR,
  TILE_MOUNTAIN,
  TILE_WATER,
  TILE_SAND,
  TILE_STONE,
  TILE_VOID,
  TILE_ROAD_GRASS,
  TILE_ROAD_SAND,
  TILE_ROAD_GRASS_STONE,
  TILE_HILL,
  TILE_PEAK,
  TILE_ROAD_SAND_STONE,
  TILE_ROAD_HILL,
  TILE_ROAD_HILL_STONE
};

export class WorldClock {
  constructor() {
    this.day = 0;
    this.hour = 0;
    this.minute = 0;
    this.globalLight = 0.18;
    this.minuteTimer = 0;
  }

  reset() {
    this.day = 0;
    this.hour = 0;
    this.minute = 0;
    this.globalLight = 0.18;
    this.minuteTimer = 0;
  }

  tick(dt) {
    this.minuteTimer += dt;
    // 1 real second = 1 game minute
    while (this.minuteTimer >= 1.0) {
      this.minuteTimer -= 1.0;
      this.minute++;
      if (this.minute >= 60) {
        this.minute = 0;
        this.hour++;
        if (this.hour >= 24) {
          this.hour = 0;
          this.day++;
        }
      }
    }

    const timeOfDay = this.hour + this.minute / 60.0;

    // Daylight curve between 5h and 19h
    if (timeOfDay >= 5.0 && timeOfDay <= 19.0) {
      const sunAngle = ((timeOfDay - 5.0) / 14.0) * Math.PI;
      this.globalLight = 0.18 + 0.82 * Math.pow(Math.sin(sunAngle), 0.85);
    } else {
      this.globalLight = 0.18;
    }
  }
}

export class World {
  constructor(presetId = 0, seed = randomWorldSeed(), size = MAP_WIDTH) {
    if(!Number.isInteger(size)||size<128||size>1024)throw new RangeError("Tamanho do mapa deve ficar entre 128 e 1024.");
    this.width = size;
    this.height = size;
    this.clock = new WorldClock();
    this.map = new Uint8Array(this.width * this.height);
    this.roadBridges=[];
    this.bridgeTiles=new Map();
    // Sidewalk surface is independent of the road tile, so road wear cannot erase it.
    this.sidewalkTiles=new Set();
    this.sidewalkTreeTiles=new Set();
    this.generate(presetId, seed);
  }

  generate(presetId = 0, seed = randomWorldSeed()) {
    this.seed = seed;
    this.presetId = presetId;
    this.revision = (this.revision || 0) + 1;
    this.topologyRevision = (this.topologyRevision || 0) + 1;
    this.waterTopologyRevision=(this.waterTopologyRevision||0)+1;
    let cfg = MAP_PRESET_ARCHIPELAGO;
    if (presetId === 1) cfg = MAP_PRESET_CONTINENT;
    else if (presetId === 2) cfg = MAP_PRESET_HIGHLANDS;

    const outCenter = { x: this.width / 2, y: this.height / 2 };
    world_gen_generate(this.map, { ...cfg, seed, width:this.width, height:this.height }, outCenter);
    this.spawnCenter = outCenter;
    this.groups = []; // Clear groups
    this.roadBridges=[];this.bridgeTiles.clear();this.bridgeRevision=(this.bridgeRevision||0)+1;
    this.sidewalkTiles?.clear();
    this.sidewalkTreeTiles?.clear();
    this.clock.reset();
    return outCenter;
  }

  refresh() {
    this.clock.reset();
  }

  getTile(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return TILE_VOID;
    return this.map[y * this.width + x];
  }

  getTileName(t) {
    if(FARM_TILES.has(t))return "Terra cultivada";
    switch (t) {
      case TILE_FLOOR: return "Planície Fértil";
      case TILE_MOUNTAIN: return "Montanha";
      case TILE_WATER: return "Água";
      case TILE_SAND: return "Areia / Praia";
      case TILE_STONE: return "Pedra / Encosta";
      case TILE_HILL: return "Colina";
      case TILE_PEAK: return "Cume / Pico";
      case TILE_ROAD_GRASS: return "Estrada de Barro (Planície)";
      case TILE_ROAD_SAND: return "Estrada de Barro (Areia)";
      case TILE_ROAD_HILL: return "Estrada de Barro (Colina)";
      case TILE_ROAD_GRASS_STONE: return "Estrada de Pedra (Planície)";
      case TILE_ROAD_SAND_STONE: return "Estrada de Pedra (Areia)";
      case TILE_ROAD_HILL_STONE: return "Estrada de Pedra (Colina)";
      default: return "Vazio";
    }
  }

  setTile(x, y, tile) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const previous=this.map[y * this.width + x];
    if (previous === tile) return;
    const sidewalkKey=y*this.width+x;
    if(this.sidewalkTiles?.has(sidewalkKey)&&!SIDEWALK_TERRAIN.has(tile)){this.sidewalkTiles.delete(sidewalkKey);this.sidewalkTreeTiles?.delete(sidewalkKey);}
    if((previous===TILE_WATER)!==(tile===TILE_WATER))this.waterTopologyRevision=(this.waterTopologyRevision||0)+1;
    // Paving changes travel cost, but not reachability or terrain elevation.
    if(roadFor(previous)===null||roadFor(previous)!==roadFor(tile))this.topologyRevision=(this.topologyRevision||0)+1;
    this.map[y * this.width + x] = tile;
    // A sidewalk belongs to the street edge. Remove any now unsupported
    // sidewalk panels when a road is paved, erased, or rerouted.
    for(const [dx,dy] of [[0,0],[0,-1],[1,0],[0,1],[-1,0]]){
      const sx=x+dx,sy=y+dy,key=sy*this.width+sx;
      if(this.sidewalkTiles?.has(key)&&!this.hasSidewalk(sx,sy))this.removeSidewalk(sx,sy);
    }
    this.revision++;
    if (typeof this.onTileChange === "function") {
      this.onTileChange(x, y, tile);
    }
  }

  setSidewalk(x,y,{tree=false}={}) {
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=this.width||y<0||y>=this.height)return false;
    const tile=this.getTile(x,y);
    if(!SIDEWALK_TERRAIN.has(tile))return false;
    if(!this.adjacentRoad(x,y))return false;
    const sidewalks=this.sidewalkTiles??=new Set(),treeTiles=this.sidewalkTreeTiles??=new Set(),key=y*this.width+x;
    if(sidewalks.has(key)&&treeTiles.has(key)===tree)return false;
    sidewalks.add(key);if(tree)treeTiles.add(key);else treeTiles.delete(key);
    this.revision=(this.revision||0)+1;
    this.onTileChange?.(x,y,tile);
    return true;
  }

  adjacentRoad(x,y) {
    return [[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>ROAD_TILES.has(this.getTile(x+dx,y+dy)));
  }

  hasSidewalk(x,y) {
    return Number.isInteger(x)&&Number.isInteger(y)&&this.sidewalkTiles?.has(y*this.width+x)&&this.adjacentRoad(x,y);
  }

  removeSidewalk(x,y) {
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=this.width||y<0||y>=this.height)return false;
    const key=y*this.width+x,removed=this.sidewalkTiles?.delete(key)||false;
    this.sidewalkTreeTiles?.delete(key);
    if(removed){this.revision=(this.revision||0)+1;this.onTileChange?.(x,y,this.getTile(x,y));}
    return removed;
  }

  isWalkable(x, y, moveType = 1) {
    return world_gen_is_walkable(this.map, x, y, moveType, this.width, this.height);
  }
}
