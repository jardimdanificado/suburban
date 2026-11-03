import {initializeBodyMetrics} from './city_body_metrics.js?v=body-morph-4';

export const PREJUDICE_TYPES=Object.freeze({
  racismo:{label:'Racismo',crimeLabel:'Discriminação racial',severity:85},
  homofobia:{label:'Homofobia',crimeLabel:'Discriminação por orientação sexual',severity:85},
  transfobia:{label:'Transfobia e preconceito contra pessoas não binárias',crimeLabel:'Discriminação por identidade de gênero',severity:85},
  machismo:{label:'Machismo',crimeLabel:'Discriminação de gênero',severity:80},
  preconceitoBaixaEstatura:{label:'Preconceito contra pessoas baixas',crimeLabel:'Discriminação por baixa estatura',severity:70},
  preconceitoAltaEstatura:{label:'Preconceito contra pessoas altas',crimeLabel:'Discriminação por alta estatura',severity:70},
  gordofobia:{label:'Gordofobia',crimeLabel:'Discriminação por peso corporal',severity:80},
  magrofobia:{label:'Preconceito contra pessoas magras',crimeLabel:'Discriminação por peso corporal',severity:70}
});
export const PREJUDICE_CRIME_TYPES=Object.freeze(Object.fromEntries(Object.entries(PREJUDICE_TYPES).map(([id,item])=>[id,item.crimeLabel])));
const clamp=(n,min=-1,max=1)=>Math.max(min,Math.min(max,n));
const hash=(id,key,seed=0)=>{let n=(Math.imul((Number(id)||0)+131,2654435761)^seed)>>>0;for(const char of key)n=Math.imul(n^char.charCodeAt(0),2246822519)>>>0;n^=n>>>16;return n>>>0;};
export function initializePrejudices(c,seed=0){
  if(!c)return {};
  if(c.prejudiceProfileVersion===1&&c.prejudices)return c.prejudices;
  c.prejudices??={};
  for(const type of Object.keys(PREJUDICE_TYPES))if(!c.prejudices[type]){
    const roll=hash(c.id,type,seed)%1000;if(roll>=100)continue;
    const target=type==='racismo'?(roll%2?'pele-escura':'pele-clara'):type==='homofobia'?'nao-hetero':type==='transfobia'?'nao-binario':type==='machismo'?'mulher':type==='preconceitoBaixaEstatura'?'baixa':type==='preconceitoAltaEstatura'?'alta':type==='gordofobia'?'gorda':'magra';
    c.prejudices[type]={target,strength:.35+((hash(c.id,`${type}:intensity`,seed)%1000)/1000)*.65};
  }
  c.prejudiceProfileVersion=1;return c.prejudices;
}
function racialGroup(c){const color=Number(c?.skinColor)||0xf5d6c2,r=color>>16&255,g=color>>8&255,b=color&255,luminance=(.2126*r+.7152*g+.0722*b)/255;return luminance<.55?'pele-escura':'pele-clara';}
function bmi(c){initializeBodyMetrics(c,c?.bodyMetricsSeed||0);const height=(c.bodyHeightCm||170)/100;return (c.bodyWeightKg||65)/(height*height);}
export function prejudiceGroup(c,type){
  if(!c)return null;
  if(type==='racismo')return racialGroup(c);
  if(type==='homofobia')return ['homo','bi'].includes(c.socialProfile?.orientation)?'nao-hetero':'hetero';
  if(type==='transfobia')return c.socialProfile?.gender==='nonbinary'?'nao-binario':'binario';
  if(type==='machismo')return c.socialProfile?.gender==='woman'?'mulher':'outro';
  if(type==='preconceitoBaixaEstatura'||type==='preconceitoAltaEstatura')initializeBodyMetrics(c,c.bodyMetricsSeed||0);
  if(type==='preconceitoBaixaEstatura')return c.bodyHeightCm<160?'baixa':'outra';
  if(type==='preconceitoAltaEstatura')return c.bodyHeightCm>184?'alta':'outra';
  if(type==='gordofobia')return bmi(c)>=30?'gorda':'outra';
  if(type==='magrofobia')return bmi(c)<18.5?'magra':'outra';
  return null;
}
export function prejudiceAgainst(observer,target){
  initializePrejudices(observer,observer?.bodyMetricsSeed||0);let total=0;
  for(const [type,bias]of Object.entries(observer?.prejudices||{}))if(bias?.target===prejudiceGroup(target,type))total+=bias.strength||0;
  return Math.min(1.5,total);
}
export function prejudicesInCommon(a,b){
  initializePrejudices(a,a?.bodyMetricsSeed||0);initializePrejudices(b,b?.bodyMetricsSeed||0);let total=0;
  for(const [type,bias]of Object.entries(a?.prejudices||{})){const other=b?.prejudices?.[type];if(other&&other.target===bias.target)total+=Math.min(bias.strength||0,other.strength||0);}
  return Math.min(1.5,total);
}
export function prejudiceAgainstTypes(observer,target){
  initializePrejudices(observer,observer?.bodyMetricsSeed||0);
  return Object.entries(observer?.prejudices||{}).filter(([type,bias])=>bias?.target===prejudiceGroup(target,type)).map(([type,bias])=>({type,strength:bias.strength||0})).sort((a,b)=>b.strength-a.strength);
}
export function prejudiceLawSupport(c,type){
  initializePrejudices(c,c?.bodyMetricsSeed||0);const traits=c?.traits||{},bias=c?.prejudices?.[type]?.strength||0,target=prejudiceGroup(c,type),isTarget=target&&target!=='outra'&&target!=='outro'&&target!=='hetero'&&target!=='binario'&&target!=='pele-intermediaria';
  return clamp(.25+((traits.empathy??.5)-.5)*.9+((traits.openness??.5)-.5)*.7-bias*1.8+(isTarget ? .6 : 0));
}
export function prejudiceCandidateAffinity(voter,candidate){
  const shared=prejudicesInCommon(voter,candidate),hostility=prejudiceAgainst(voter,candidate);
  return clamp(shared*7-hostility*9,-16,12);
}
