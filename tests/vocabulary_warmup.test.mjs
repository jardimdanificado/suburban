// Warm-up must only move work earlier, never change generated text.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const root=resolve(new URL('..',import.meta.url).pathname),moduleUrl=pathToFileURL(resolve(root,'js/vocabulario.js')).href;
const sample=warm=>`
import {createHash} from 'node:crypto';
const vocabulary=await import(${JSON.stringify(moduleUrl)});
${warm?'vocabulary.aquecerCatalogos();':''}
let seed=1794658272;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),digest=createHash('sha256');
for(let index=0;index<18;index++){
  const theme=vocabulary.TEMAS_DO_JOGO[index%vocabulary.TEMAS_DO_JOGO.length];
  digest.update(vocabulary.gerarFrase({tema:theme,random,complexidade:['simples','variada','complexa'][index%3]}));
  if(index%6===0)digest.update(vocabulary.gerarTituloTematico(theme,{random}));
}
process.stdout.write(digest.digest('hex'));
`;
const run=warm=>execFileSync(process.execPath,['--input-type=module','-e',sample(warm)],{cwd:root,encoding:'utf8'});

test('warming the catalogs does not change generated phrases',()=>{
  assert.equal(run(true),run(false));
});

test('warming twice keeps the same theme lists',()=>{
  const repeated=execFileSync(process.execPath,['--input-type=module','-e',`
const vocabulary=await import(${JSON.stringify(moduleUrl)});
vocabulary.aquecerCatalogos();vocabulary.aquecerCatalogos();
let seed=1794658272;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),first=vocabulary.gerarFrase({tema:'cidade',random,complexidade:'complexa'});
vocabulary.aquecerCatalogos();
seed=1794658272;const second=vocabulary.gerarFrase({tema:'cidade',random,complexidade:'complexa'});
process.stdout.write(first===second?'same':'changed');
`],{cwd:root,encoding:'utf8'});
  assert.equal(repeated,'same');
});
