// The initial mobility sector contains a final assembler only. Parts factories
// emerge in response to local demand; missing components can be imported.
export const INITIAL_CYCLE_STAGES=Object.freeze(['cycle_assembler']);
export function fundInitialCycleChain(city){
  for(const type of INITIAL_CYCLE_STAGES){const b=city.buildings.find(b=>b.type===type&&b.initialCycleChain);if(!b)continue;
    if(!b.active)city.economy.activateMunicipalBusiness(b,200000);
  }
}
