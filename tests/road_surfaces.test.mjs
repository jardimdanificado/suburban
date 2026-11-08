import test from 'node:test';
import assert from 'node:assert/strict';
import {roadRailingAllowed} from '../js/road_terrain_geometry.js';
import {buildingStairMaterial} from '../js/city_renderer_3d.js';
import {TILE_FLOOR,TILE_SAND,TILE_HILL,TILE_ROAD_GRASS,TILE_ROAD_SAND,TILE_ROAD_HILL,TILE_ROAD_GRASS_STONE,TILE_ROAD_SAND_STONE,TILE_ROAD_HILL_STONE} from '../js/world_gen.js';

test('railings belong only to paved streets, including when a sidewalk is present',()=>{
 const world={width:1,height:1,map:new Uint8Array(1),hasSidewalk:()=>true};
 for(const tile of [TILE_ROAD_GRASS_STONE,TILE_ROAD_SAND_STONE,TILE_ROAD_HILL_STONE]){world.map[0]=tile;assert(roadRailingAllowed(world,0,0));}
 for(const tile of [TILE_FLOOR,TILE_SAND,TILE_HILL,TILE_ROAD_GRASS,TILE_ROAD_SAND,TILE_ROAD_HILL]){world.map[0]=tile;assert.equal(roadRailingAllowed(world,0,0),false);}
});
test('building steps reuse the sidewalk texture without tinting its colors',()=>{
 const map={name:'sidewalk'},THREE={MeshLambertMaterial:class {constructor(spec){Object.assign(this,spec);}}};
 const material=buildingStairMaterial({materials:{terrainSidewalk0:{map}}},THREE);
 assert.equal(material.map,map);assert.equal(material.color,0xffffff);assert(material.dithering);
});
