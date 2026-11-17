// Exports every vocabulary entry as one classified CSV row.
// Classification comes from vocabulario.js itself; no manual per-word editing.
import {createWriteStream} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {vocabulario,classificarPalavraCompleta,iterarPalavrasClassificadas} from '../js/vocabulario.js';

const here=dirname(fileURLToPath(import.meta.url)),out=resolve(here,'../data/vocabulario.csv');
await mkdir(dirname(out),{recursive:true});
const stream=createWriteStream(out,{encoding:'utf8'});
const csv=value=>{const text=String(value??'');return /[",\n]/u.test(text)?`"${text.replace(/"/gu,'""')}"`:text;};
const prefixos=vocabulario.prefixos.map(word=>word.toLocaleLowerCase('pt-BR')),sufixos=vocabulario.sufixos.map(word=>word.toLocaleLowerCase('pt-BR'));
const header=['palavra','origem','lema','classe','classes','genero','numero','tema','vertente','confianca','prefixo','sufixo','composto','proprio','sigla','abstrato','acao','agente','tags'];
stream.write(header.join(',')+'\n');

function tagFor(word,info){
  const key=word.toLocaleLowerCase('pt-BR'),prefix=prefixos.find(item=>item.length>=2&&key.startsWith(item)&&key.length>item.length+3)||'',suffix=sufixos.find(item=>key.endsWith(item)&&key.length>item.length+2)||'';
  const abstract=/(?:ção|são|ssão|dade|tude|ência|ância|ismo|mento)$/u.test(key),action=/(?:ção|são|mento|agem)$/u.test(key),agent=/(?:dor|tor|eiro|ista|or)$/u.test(key);
  return {prefix,suffix,abstract,action,agent,tags:[abstract?'abstrato':'',action?'acao':'',agent?'agente':'',prefix?`prefixo:${prefix}`:'',suffix?`sufixo:${suffix}`:''].filter(Boolean).join('|')};
}
function row(palavra,origem,info){
  const derived=tagFor(palavra,info);
  return [palavra,origem,info.lema,info.classePrincipal,info.classes.join('|'),info.genero,palavra.endsWith('s')?'plural':'singular',info.temas.join('|'),info.vertentePolitica||'',info.confianca,derived.prefix,derived.suffix,palavra.includes('-')?'1':'0',info.classes.includes('substantivo próprio provável')?'1':'0',info.classes.includes('abreviação/sigla')?'1':'0',derived.abstract?'1':'0',derived.action?'1':'0',derived.agent?'1':'0',derived.tags].map(csv).join(',')+'\n';
}
for(const info of iterarPalavrasClassificadas())stream.write(row(info.palavra,'palavra',info));
for(const name of vocabulario.nomes)stream.write(row(name,'nome',classificarPalavraCompleta(name)));
stream.end();
await new Promise(resolve=>stream.on('finish',resolve));
console.log(`CSV escrito: ${out}`);
