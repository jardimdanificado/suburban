import test from 'node:test';
import assert from 'node:assert/strict';
import {gerarFrase,gerarFraseTematica,gerarSloganPartidario,gerarDialogoTematico} from '../js/gerador_frases.js';
import {TEMAS_DO_JOGO} from '../js/vocabulario.js';

function seeded(seed){let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}

test('sentence generation stays deterministic for each complexity level',()=>{
  for(const complexidade of ['simples','variada','complexa']){
    const options={tema:['cidade','politica'],complexidade};
    assert.equal(gerarFrase({...options,random:seeded(11)}),gerarFrase({...options,random:seeded(11)}));
  }
});

test('simple sentences stay short and add no coordination',()=>{
  const sentences=Array.from({length:40},(_,seed)=>gerarFrase({tema:'cidade',random:seeded(seed),complexidade:'simples'}));
  assert(sentences.every(sentence=>sentence.length<=180));
  assert(sentences.every(sentence=>!/; |\. Além disso, |\. Ao mesmo tempo, | porque | enquanto | embora /.test(sentence)));
});

test('complex sentences chain clauses with varied connectives',()=>{
  const connectives=/ e | mas | porém, | contudo, | todavia, | ainda assim, | porque | já que | pois | por isso, | assim, | quando | enquanto | sempre que | se | caso | desde que | embora | antes que |; |\. Além disso, |\. Ao mesmo tempo, |: /;
  const sentences=Array.from({length:40},(_,seed)=>gerarFrase({tema:'politica',random:seeded(seed),complexidade:'complexa'}));
  assert(sentences.every(sentence=>connectives.test(sentence)));
  assert(new Set(sentences).size>20);
});

test('passive and adjunct phrases use contractions instead of bare prepositions',()=>{
  for(const complexidade of ['variada','complexa'])for(let seed=0;seed<60;seed++){
    const sentence=gerarFrase({tema:'cidade',random:seeded(seed),complexidade});
    assert.doesNotMatch(sentence,/\b(?:por|de|em) (?:o|a|os|as)\b/u);
  }
});

test('core nouns keep gender agreement across themes',()=>{
  const wrong=['o cidade','a prefeito','um cidade','uma bairro','o família','a governo','o escola','a hospital','o casa','a projeto','o reunião','a partido','o lei','a mercado','o água','a dinheiro','o saúde','a remédio','a aluno'];
  for(const theme of TEMAS_DO_JOGO)for(let seed=0;seed<12;seed++){
    const sentence=gerarFrase({tema:theme,random:seeded(seed),complexidade:'variada'});
    for(const phrase of wrong)assert.doesNotMatch(sentence,new RegExp(`(?<![\\p{L}])${phrase}(?![\\p{L}])`,'iu'));
  }
});

test('thematic helpers keep working with the richer grammar',()=>{
  const options={tema:['cidade','moradia'],random:seeded(5),complexidade:'complexa'};
  assert.match(gerarFraseTematica(options.tema,options),/\.$/u);
  assert.match(gerarSloganPartidario({random:seeded(6),complexidade:'variada'}),/\.$/u);
  const dialogue=gerarDialogoTematico('politica',{random:seeded(7)});
  assert(dialogue.question.length>10&&dialogue.answer.length>10);
  assert(Array.isArray(dialogue.generated)&&dialogue.generated.length===2);
});
