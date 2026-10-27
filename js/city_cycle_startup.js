import {INDUSTRIES} from './city_industries.js';
// These public premises are part of the foundation, not completed by a production tick.
const targets=['cycle_assembler','cycle_shop','cycle_workshop'];
const producer=new Map();for(const [type,spec]of Object.entries(INDUSTRIES))for(const good of Object.keys(spec.outputs))if(!producer.has(good))producer.set(good,type);
const stages=['farm','mill'],visited=new Set(['farm','mill']);
function visit(type){if(visited.has(type))return;visited.add(type);for(const good of Object.keys(INDUSTRIES[type]?.inputs||{})){const provider=producer.get(good);if(provider)visit(provider);}stages.push(type);}
for(const type of targets)visit(type);
// Cargo-bike and scooter platforms require their own wood/pigment chain.
visit('deck_factory');visit('sports_shoes');
export const INITIAL_CYCLE_STAGES=Object.freeze(stages);
export function fundInitialCycleChain(city){
  for(const type of INITIAL_CYCLE_STAGES){const b=city.buildings.find(b=>b.type===type&&b.initialCycleChain);if(!b)continue;
    city.economy.activateMunicipalBusiness(b,type==='cycle_assembler'||type==='cycle_shop'?200000:100000,type==='farm'?'girassol':null);
    if(['cycle_assembler','cycle_shop','cycle_workshop'].includes(type))continue;
    for(const [good,q]of Object.entries(INDUSTRIES[type]?.inputs||(type==='mill'?{girassol:3}:{}))){const amount=q*3;b.inventory[good]+=amount;city.economy.initialStock[good]+=amount;}
  }
}
