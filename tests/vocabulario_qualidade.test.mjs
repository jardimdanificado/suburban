import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarFrase,
  gerarDialogoTematico,
  gerarTituloTematico,
  conjugarVerbo,
  classificarPalavraCompleta,
  TEMAS_DO_JOGO,
} from '../js/vocabulario.js';
import { SUBSTANTIVOS, VERBOS_TRANSITIVOS } from '../js/lexico_sinonimos.js';

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const FORMAS_INVENTADAS = /\b(?:sube|ofereca|oferecam|busce|buscem|preferam|pracat\w*|casamat\w*|monarquiar\w*|sindicatariam|nutrifica\w*|arteso\w*|artemet\w*|mobralense)\b/iu;
const PREPOSICAO_SEM_CONTRACAO = /(?<![\p{L}])(?:por|de|em) (?:o|a|os|as)\b/iu;

test('curated generator keeps grammatical forms across every theme and level', () => {
  for (const tema of TEMAS_DO_JOGO) {
    for (const complexidade of ['simples', 'variada', 'complexa']) {
      for (let seed = 0; seed < 60; seed++) {
        const frase = gerarFrase({ tema, random: seeded(seed * 31 + 7), complexidade });
        assert.match(frase, /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/u, `${tema}: ${frase}`);
        assert.match(frase, /\.$/u, `${tema}: ${frase}`);
        assert.doesNotMatch(frase, FORMAS_INVENTADAS, `${tema}: ${frase}`);
        assert.doesNotMatch(frase, PREPOSICAO_SEM_CONTRACAO, `${tema}: ${frase}`);
        if (complexidade === 'simples') assert(frase.length <= 180, `${tema}: ${frase}`);
      }
    }
  }
});

test('dialogue quotes whole sentences and never truncates a clause', () => {
  for (let seed = 0; seed < 20; seed++) {
    const dialogue = gerarDialogoTematico('politica', { random: seeded(seed + 11) });
    assert.match(dialogue.question, /\?$/u, dialogue.question);
    assert.match(dialogue.answer, /[.!]$/u, dialogue.answer);
    assert.equal(dialogue.generated.length, 2);
    for (const sentence of dialogue.generated) assert.match(sentence, /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ].*[^.!?]$/u, sentence);
    assert.doesNotMatch(dialogue.question, /…|\.\.\./u, dialogue.question);
  }
});

test('art titles avoid sentence punctuation and stay varied', () => {
  const random = seeded(71);
  const titles = Array.from({ length: 40 }, () => gerarTituloTematico('arte', { random }));
  assert(titles.every(title => title.length > 0 && !/[.!?;,]|\.\./u.test(title)));
  assert(new Set(titles).size > 20);
});

const primeiraPalavra = texto => texto.split(' ')[0];
const PLURAIS_INVARIAVEIS = new Set(['sem-teto']);
const pluralAparente = palavra => PLURAIS_INVARIAVEIS.has(palavra) || (/s$/u.test(palavra)
  && !['ônibus', 'vírus', 'país', 'gás', 'pires', 'atlas', 'cais', 'lápis'].includes(palavra));

test('lexicon substitutions keep number and conjugate every tense', () => {
  for (const [chave, variantes] of Object.entries(SUBSTANTIVOS)) {
    const pluralChave = pluralAparente(classificarPalavraCompleta(chave).lema) || pluralAparente(chave);
    for (const variante of variantes) {
      const cabeca = primeiraPalavra(variante);
      const pluralVariante = pluralAparente(classificarPalavraCompleta(cabeca).lema) || pluralAparente(cabeca);
      assert.equal(pluralVariante, pluralChave, `${chave} -> ${variante}`);
    }
  }
  for (const [verbo, variantes] of Object.entries(VERBOS_TRANSITIVOS)) {
    for (const variante of variantes) {
      for (const tempo of ['presente', 'pretérito-perfeito', 'pretérito-imperfeito', 'futuro', 'condicional', 'subjuntivo-presente', 'participio']) {
        for (const pessoa of tempo === 'participio' ? [3] : [3, 6]) {
          const forma = conjugarVerbo(variante, { tempo, pessoa });
          assert.match(forma ?? '', /^\p{L}+$/u, `${verbo} -> ${variante} (${tempo}, ${pessoa})`);
        }
      }
    }
  }
});

test('curated variants multiply the sentences for a low seed range', () => {
  const frases = Array.from({ length: 50 }, (_, seed) =>
    gerarFrase({ tema: 'cidade', random: seeded(seed), complexidade: 'simples' }));
  assert(new Set(frases).size >= 30, `apenas ${new Set(frases).size} frases únicas`);
});

test('discourse engine reaches every advanced construction', () => {
  const frases = [];
  for (const tema of TEMAS_DO_JOGO) {
    for (let seed = 0; seed < 40; seed++) {
      frases.push(gerarFrase({ tema, random: seeded(seed * 53 + 17), complexidade: 'complexa' }));
    }
  }
  const padroes = {
    clivada: /^(?:Foi|Foram) .+ que /u,
    passivaSintetica: /(?:^|[;,])\s*\p{L}+-se (?:a|o|as|os)\b/iu,
    atribuicao: /\b(?:anunciou|informou|afirmou|confirmou|prometeu|anunciaram|informaram|afirmaram|confirmaram|prometeram) que (?:vai|vão)\b/u,
    adjuntoFronteado: /^(?:No|Na|Nos|Nas|Em|Com|Sem|Sob|Entre|Durante|Desde|Após|Antes|Até) [^,]+,/u,
    elipseDeSujeito: /,? e (?:\p{L}+ ){0,3}(?:reform|ampli|pint|cobr|contrat|acompanh|oferec|orient|visit|plant|limp|organiz|vend|entreg|discut|fiscaliz|aprov|invest|regulariz|ilumin|ajud|aument|propor|esper|abr)/iu,
    retomada: /\b(?:A administração|A gestão|O executivo|O poder público|O distrito|A metrópole|Os habitantes|Os residentes|A instituição|As instituições|O colegiado|A pasta|A mídia|A companhia|A firma|A indústria|A empreiteira|A associação|Os estudantes|Os docentes|Os agentes|Os ecologistas|Os locatários|Os usuários|Os condutores)\b/u,
  };
  for (const [nome, padrao] of Object.entries(padroes)) {
    assert(frases.some(frase => padrao.test(frase)), `construção ausente: ${nome}`);
  }
});

test('style changes the voice without losing determinism', () => {
  const gerar = (estilo, seed) => gerarFrase({
    tema: 'cidade', random: seeded(seed), complexidade: 'complexa', estilo,
  });
  for (const estilo of ['auto', 'popular', 'jornal', 'oficial']) {
    assert.equal(gerar(estilo, 31), gerar(estilo, 31), `estilo ${estilo} não determinístico`);
  }
  assert.throws(() => gerarFrase({ tema: 'cidade', random: seeded(1), estilo: 'telegráfico' }), RangeError);

  const colher = estilo => Array.from({ length: 80 }, (_, seed) => gerar(estilo, seed * 7 + 1));
  const popular = colher('popular');
  const jornal = colher('jornal');
  assert.notDeepEqual(popular, jornal);
  const avancado = /^(?:Foi|Foram) .+ que |\p{L}+-se (?:a|o|as|os)\b|\b(?:anunciou|informou|afirmou) que vai\b/iu;
  const contar = lista => lista.filter(frase => avancado.test(frase)).length;
  assert(contar(jornal) > contar(popular), 'o registro jornalístico deveria usar mais vozes marcadas');
});


