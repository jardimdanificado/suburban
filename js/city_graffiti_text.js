import {gerarFraseTematica} from './gerador_frases.js';

export function graffitiMessage(city,c,{protest=false,targetName=null}={}){
  const themes=['cidade'];
  if(c.homeUnitId===null)themes.push('moradia');
  if(c.needs?.food<42)themes.push('alimentacao');
  if(c.needs?.health<45)themes.push('saude');
  if(protest)themes.push('politica');
  const sentence=gerarFraseTematica(themes,{random:()=>city.random(),complexidade:'simples'});
  const suffix=targetName?` · ${String(targetName).trim().slice(0,60)}`:'',limit=180-suffix.length;
  const message=sentence.length<=limit?sentence:sentence.slice(0,limit-1).replace(/\s+\S*$/u,'').replace(/[.,;:!?]+$/u,'')+'.';
  return message+suffix;
}
