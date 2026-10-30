/** Added domains do not consume the established world-seed random sequence. */
export const JUSTICE_SKILLS=Object.freeze(['artistic','combat','investigation','forensics','law']);
export function ensureJusticeSkills(c,index,seed,{newborn=false}={}){
  c.skills??={};
  for(const [i,skill]of JUSTICE_SKILLS.entries())if(!Number.isFinite(c.skills[skill])){
    const hash=(Math.imul(c.id+1,2654435761)^Math.imul(i+17,1597334677)^seed)>>>0;
    c.skills[skill]=newborn?0:2+hash/4294967296*16+(index%JUSTICE_SKILLS.length===i?15:0);
  }
}
