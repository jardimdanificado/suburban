import {ASSET_DATA} from './assets_data.js';
import {POLITICAL_POSITIONS} from './city_ideology.js';

// Theme tags reuse the game's established vocabulary themes. Political
// positions stay empty for imagery that has no explicit partisan meaning.
const THEMES=Object.freeze({
  POLITICA:'politica', CIDADE:'cidade', TRABALHO:'trabalho', ECONOMIA:'economia',
  MORADIA:'moradia', FAMILIA:'familia', ALIMENTACAO:'alimentacao', SAUDE:'saude',
  MOBILIDADE:'mobilidade', CULTURA:'educacao_cultura', JUSTICA:'seguranca_justica',
  AMBIENTE:'meio_ambiente', SUBSTANCIAS:'substancias', MODA:'moda',
  LAZER:'esportes_lazer', COTIDIANO:'cotidiano'
});
const ALL_POSITIONS=Object.freeze([...POLITICAL_POSITIONS]);
const add=(...themes)=>[...new Set(themes)];
const has=(name,...patterns)=>patterns.some(pattern=>pattern.test(name));

function classifySprite(filename){
  const name=filename.replace(/\.png$/i,'');let themes=[],politicalPositions=[],politicalAffinity={economy:0,liberty:0,green:0};
  if(name.startsWith('Creature_'))themes=add(THEMES.AMBIENTE);
  else if(name.startsWith('Emote_'))themes=add(THEMES.COTIDIANO,...has(name,/Hurt|Sick|Sleeping/i)?[THEMES.SAUDE]:[]);
  else if(name.startsWith('Human_')){
    themes=add(THEMES.COTIDIANO);
    if(has(name,/Child/))themes.push(THEMES.FAMILIA);
    if(has(name,/Elder/))themes.push(THEMES.FAMILIA,THEMES.SAUDE);
    if(has(name,/Ruler/)){themes.push(THEMES.POLITICA);politicalPositions=ALL_POSITIONS;politicalAffinity={economy:0,liberty:-.55,green:0};}
    if(has(name,/Archer|Assassin|Guard|Knight|Pirate|Thief/))themes.push(THEMES.JUSTICA);
    if(has(name,/Cultist|Monk|Necromancer|Phantom|Priest|Wizard|Lunatic/))themes.push(THEMES.CULTURA);
    themes=add(...themes);
  }else if(name.startsWith('Feature_')){
    themes=add(THEMES.CIDADE);
    if(has(name,/Bed|Bookcase|Cupboard|Stool|Table/))themes.push(THEMES.MORADIA);
    if(has(name,/Brick|Door|Pillar|Stairs|Block/))themes.push(THEMES.MORADIA);
    if(has(name,/Boulders|Flower|Grass|Pebbles|Stone|Tree|Waves|Web/))themes.push(THEMES.AMBIENTE);
    if(has(name,/Altar|Pyre|Tombstone/))themes.push(THEMES.CULTURA);
    if(has(name,/Beartrap|Trap|Trapdoor/))themes.push(THEMES.JUSTICA);
    if(has(name,/Sign/)){themes.push(THEMES.POLITICA);politicalPositions=ALL_POSITIONS;politicalAffinity={economy:0,liberty:.35,green:0};}
    themes=add(...themes);
  }else if(name.startsWith('Item_')){
    themes=add(THEMES.COTIDIANO);
    if(has(name,/Beer|Bottle|Jug|Vial/))themes.push(THEMES.ALIMENTACAO,THEMES.SUBSTANCIAS);
    if(has(name,/Bread|Candy|Cheese|Cupcake|Drumstick|Egg|Fish|Fruit|Kebab|Mushroom|Plate|Pot|Steak|Vegetable/))themes.push(THEMES.ALIMENTACAO);
    if(has(name,/Herb|Leaf|Pipes/))themes.push(THEMES.AMBIENTE,THEMES.SUBSTANCIAS);
    if(has(name,/Axe|Bow|Bracers|Club|Dagger|Hammer|Pickaxe|Rod|Shield|Shovel|Spear|Staff|Sword/))themes.push(THEMES.TRABALHO,THEMES.JUSTICA);
    if(has(name,/Bag|Cart|Ship/))themes.push(THEMES.MOBILIDADE,THEMES.ECONOMIA);
    if(has(name,/Belt|Boots|Chainmail|Cloak|Glasses|Gloves|Hat|Helm|Hood|Necklace|Pants|Ring|Tunic/))themes.push(THEMES.MODA);
    if(has(name,/Book|Drum|Harp|Letter|Lute|Scroll|Xylophone/))themes.push(THEMES.CULTURA);
    if(has(name,/Coins|Gem|Nugget/)){themes.push(THEMES.ECONOMIA);politicalPositions=ALL_POSITIONS;politicalAffinity={economy:.65,liberty:0,green:0};}
    if(has(name,/Key/))themes.push(THEMES.CIDADE,THEMES.MORADIA);
    if(has(name,/Ankh|Bone|Corpse|Eyeball|Fossil|Skull|Urn/))themes.push(THEMES.SAUDE);
    themes=add(...themes);
  }else if(name.startsWith('Other_')){
    themes=add(THEMES.COTIDIANO);
    if(has(name,/Attack|Dead|Defend|Target|Warning/))themes.push(THEMES.JUSTICA);
    if(has(name,/Arcane|Divine|Emanation|Music/))themes.push(THEMES.CULTURA);
    if(has(name,/Fire|Ice|Lightning|Moon|Poison|Sleep|Star|Sun|Water/))themes.push(THEMES.AMBIENTE);
    themes=add(...themes);
  }else if(name.startsWith('Overworld_'))themes=add(THEMES.CIDADE,THEMES.MORADIA);
  else if(name.startsWith('Wall_'))themes=add(THEMES.CIDADE,THEMES.MORADIA);
  else if(name==='Scroll-O-Sprites-by-Quale')themes=[];

  if(themes.includes(THEMES.AMBIENTE))politicalAffinity.green=Math.max(politicalAffinity.green,.72);
  if(themes.includes(THEMES.TRABALHO))politicalAffinity.economy=Math.min(politicalAffinity.economy,-.28);
  if(themes.includes(THEMES.JUSTICA))politicalAffinity.liberty=Math.min(politicalAffinity.liberty,-.2);
  if(themes.includes(THEMES.CULTURA))politicalAffinity.liberty=Math.max(politicalAffinity.liberty,.18);
  return Object.freeze({filename,themes:Object.freeze(themes),politicalPositions:Object.freeze(politicalPositions),politicalMeaning:politicalPositions.length?'transversal':'none',politicalAffinity:Object.freeze(politicalAffinity)});
}

export const SPRITE_CLASSIFICATIONS=Object.freeze(Object.fromEntries(
  ASSET_DATA.filter(asset=>/\.png$/i.test(asset.filename)).map(asset=>[asset.filename,classifySprite(asset.filename)])
));
export const SPRITE_CLASSIFICATION_COUNT=Object.keys(SPRITE_CLASSIFICATIONS).length;
export function classifySpriteName(filename){return SPRITE_CLASSIFICATIONS[filename]||null;}
