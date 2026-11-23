// CPU-only benchmark for the lazy grammar-catalog warm-up.
// It times aquecerCatalogos() and checks that generated phrases are unchanged.
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
// Each process warms the caches once, so repeat the command to average runs.
const root=resolve(process.argv[2]||'.'),runs=Math.max(1,Number(process.env.SUBURBAN_BENCH_RUNS)||1),sentences=Math.max(1,Number(process.env.SUBURBAN_BENCH_SENTENCES)||400);
const vocabulary=await import(pathToFileURL(resolve(root,'js/vocabulario.js')).href);
const {aquecerCatalogos,gerarFrase,gerarTituloTematico,TEMAS_DO_JOGO,classificarPalavraCompleta}=vocabulary;
let seed=1794658272;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const digest=createHash('sha256'),timings=[];
for(let run=0;run<runs;run++){
  const started=performance.now();aquecerCatalogos();timings.push(performance.now()-started);
  digest.update(`run:${run}`);
  for(let index=0;index<sentences;index++){
    const theme=TEMAS_DO_JOGO[index%TEMAS_DO_JOGO.length];
    digest.update(gerarFrase({tema:theme,random,complexidade:['simples','variada','complexa'][index%3]}));
    if(index%8===0)digest.update(gerarTituloTematico(theme,{random}));
  }
  for(const word of ['cidade','trabalho','democracia','camisa','caminhar','ligeiramente'])digest.update(JSON.stringify(classificarPalavraCompleta(word)));
}
timings.sort((a,b)=>a-b);
console.log(JSON.stringify({mode:'vocabulary-warmup',root,runs,sentences,ms:timings[Math.floor(timings.length/2)],totalMs:timings.reduce((sum,value)=>sum+value,0),checksum:digest.digest('hex')}));
