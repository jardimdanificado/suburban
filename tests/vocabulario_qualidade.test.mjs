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
import { CENAS } from '../js/gerador_textos.js';

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const FORMAS_INVENTADAS = /\b(?:sube|ofereca|oferecam|busce|buscem|preferam|pracat\w*|casamat\w*|monarquiar\w*|sindicatariam|nutrifica\w*|arteso\w*|artemet\w*|mobralense)\b/iu;
const PREPOSICAO_SEM_CONTRACAO = /(?<![\p{L}])(?:por|de|em) (?:o|a|os|as)(?=\s)/iu;

test('curated generator keeps grammatical forms across every theme and level', () => {
  for (const tema of TEMAS_DO_JOGO) {
    for (const complexidade of ['simples', 'variada', 'complexa']) {
      for (let seed = 0; seed < 60; seed++) {
        const frase = gerarFrase({ tema, random: seeded(seed * 31 + 7), complexidade });
        assert.match(frase, /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/u, `${tema}: ${frase}`);
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

test('verbs in -air and -uir keep the hiatus in every tense', () => {
  const formas = {
    atrair: ['atrai', 'atraem', 'atraiu', 'atraíram', 'atraía', 'atraíam', 'atraia', 'atraiam', 'atraído'],
    distribuir: ['distribui', 'distribuem', 'distribuiu', 'distribuíram', 'distribuía', 'distribuíam', 'distribua', 'distribuam', 'distribuído'],
    instruir: ['instrui', 'instruem', 'instruiu', 'instruíram', 'instruía', 'instruíam', 'instrua', 'instruam', 'instruído'],
  };
  for (const [verbo, esperadas] of Object.entries(formas)) {
    const produzidas = [
      conjugarVerbo(verbo, { tempo: 'presente', pessoa: 3 }),
      conjugarVerbo(verbo, { tempo: 'presente', pessoa: 6 }),
      conjugarVerbo(verbo, { tempo: 'pretérito-perfeito', pessoa: 3 }),
      conjugarVerbo(verbo, { tempo: 'pretérito-perfeito', pessoa: 6 }),
      conjugarVerbo(verbo, { tempo: 'pretérito-imperfeito', pessoa: 3 }),
      conjugarVerbo(verbo, { tempo: 'pretérito-imperfeito', pessoa: 6 }),
      conjugarVerbo(verbo, { tempo: 'subjuntivo-presente', pessoa: 3 }),
      conjugarVerbo(verbo, { tempo: 'subjuntivo-presente', pessoa: 6 }),
      conjugarVerbo(verbo, { tempo: 'participio', pessoa: 3 }),
    ];
    assert.deepEqual(produzidas, esperadas, verbo);
  }
});

test('orthographic changes survive the subjunctive and first person', () => {
  const formas = {
    forçar: ['force', 'forcem', 'forcei'],
    alcançar: ['alcance', 'alcancem', 'alcancei'],
    pagar: ['pague', 'paguem', 'paguei'],
    ficar: ['fique', 'fiquem', 'fiquei'],
    vencer: ['vença', 'vençam', 'venci'],
    eleger: ['eleja', 'elejam', 'elegi'],
    dirigir: ['dirija', 'dirijam', 'dirigi'],
    seguir: ['siga', 'sigam', 'segui'],
    conseguir: ['consiga', 'consigam', 'consegui'],
    passear: ['passeie', 'passeiem', 'passeei'],
  };
  for (const [verbo, esperadas] of Object.entries(formas)) {
    const produzidas = [
      conjugarVerbo(verbo, { tempo: 'subjuntivo-presente', pessoa: 3 }),
      conjugarVerbo(verbo, { tempo: 'subjuntivo-presente', pessoa: 6 }),
      conjugarVerbo(verbo, { tempo: 'pretérito-perfeito', pessoa: 1 }),
    ];
    assert.deepEqual(produzidas, esperadas, verbo);
  }
});

test('compound verbs follow their irregular base', () => {
  const formas = {
    conter: ['contém', 'contêm', 'conteve', 'continha', 'contenha', 'contido'],
    manter: ['mantém', 'mantêm', 'manteve', 'mantinha', 'mantenha', 'mantido'],
    obter: ['obtém', 'obtêm', 'obteve', 'obtinha', 'obtenha', 'obtido'],
    convir: ['convém', 'convêm', 'conveio', 'convinha', 'convenha', 'convindo'],
    prever: ['prevê', 'preveem', 'previu', 'previa', 'preveja', 'previsto'],
    desfazer: ['desfaz', 'desfazem', 'desfez', 'desfazia', 'desfaça', 'desfeito'],
    reunir: ['reúne', 'reúnem', 'reuniu', 'reunia', 'reúna', 'reunido'],
  };
  for (const [verbo, esperadas] of Object.entries(formas)) {
    const produzidas = [
      conjugarVerbo(verbo, { tempo: 'presente', pessoa: 3 }),
      conjugarVerbo(verbo, { tempo: 'presente', pessoa: 6 }),
      conjugarVerbo(verbo, { tempo: 'pretérito-perfeito', pessoa: 3 }),
      conjugarVerbo(verbo, { tempo: 'pretérito-imperfeito', pessoa: 3 }),
      conjugarVerbo(verbo, { tempo: 'subjuntivo-presente', pessoa: 3 }),
      conjugarVerbo(verbo, { tempo: 'participio', pessoa: 3 }),
    ];
    assert.deepEqual(produzidas, esperadas, verbo);
  }
});

test('requerer keeps its irregular present', () => {
  const casos = [
    ['presente', 1, 'requeiro'],
    ['presente', 3, 'requer'],
    ['presente', 4, 'requeremos'],
    ['presente', 6, 'requerem'],
    ['subjuntivo-presente', 1, 'requeira'],
    ['subjuntivo-presente', 6, 'requeiram'],
    ['pretérito-perfeito', 1, 'requeri'],
    ['pretérito-perfeito', 3, 'requereu'],
    ['pretérito-perfeito', 6, 'requereram'],
  ];
  for (const [tempo, pessoa, esperada] of casos) {
    assert.equal(conjugarVerbo('requerer', { tempo, pessoa }), esperada, `${tempo} ${pessoa}`);
  }
});

test('stem-changing -ir verbs keep the change', () => {
  const casos = [
    ['servir', 'presente', 1, 'sirvo'],
    ['servir', 'presente', 6, 'servem'],
    ['servir', 'subjuntivo-presente', 3, 'sirva'],
    ['preferir', 'presente', 1, 'prefiro'],
    ['preferir', 'presente', 6, 'preferem'],
    ['preferir', 'subjuntivo-presente', 3, 'prefira'],
    ['medir', 'presente', 1, 'meço'],
    ['medir', 'subjuntivo-presente', 3, 'meça'],
    ['impedir', 'subjuntivo-presente', 3, 'impeça'],
    ['vestir', 'presente', 1, 'visto'],
    ['vestir', 'subjuntivo-presente', 3, 'vista'],
    ['aderir', 'presente', 3, 'adere'],
    ['aderir', 'subjuntivo-presente', 6, 'adiram'],
    ['prevenir', 'presente', 3, 'previne'],
    ['prevenir', 'presente', 6, 'previnem'],
    ['prevenir', 'subjuntivo-presente', 3, 'previna'],
  ];
  for (const [verbo, tempo, pessoa, esperada] of casos) {
    assert.equal(conjugarVerbo(verbo, { tempo, pessoa }), esperada, `${verbo} ${tempo} ${pessoa}`);
  }
});

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

const minuscula = palavra => palavra.toLocaleLowerCase('pt-BR');
const cenasDoGerador = Object.values(CENAS).flat();
const artigosFemininos = new Set(['a', 'as', 'uma', 'umas']);
const artigosMasculinos = new Set(['o', 'os', 'um', 'uns']);

function generoDasCenas() {
  const mapa = new Map();
  const conflitos = new Set();
  const registrar = (palavra, genero) => {
    const chave = minuscula(palavra);
    if (!chave) return;
    if (mapa.has(chave) && mapa.get(chave) !== genero) conflitos.add(chave);
    else mapa.set(chave, genero);
  };
  for (const cena of cenasDoGerador) {
    const partes = cena.s.split(' ');
    if (artigosFemininos.has(minuscula(partes[0]))) registrar(partes[1], 'f');
    else if (artigosMasculinos.has(minuscula(partes[0]))) registrar(partes[1], 'm');
    if (cena.o) {
      const artigo = minuscula(cena.o.d);
      const palavra = cena.o.n.split(' ')[0];
      if (artigosFemininos.has(artigo)) registrar(palavra, 'f');
      else if (artigosMasculinos.has(artigo)) registrar(palavra, 'm');
    }
  }
  return { mapa, conflitos };
}

test('scene bank and lexicon reach the planned scale', () => {
  assert(cenasDoGerador.length >= 1200, `cenas: ${cenasDoGerador.length}`);
  const sujeitos = new Set();
  const objetos = new Set();
  const verbos = new Set();
  const substantivos = new Set();
  for (const cena of cenasDoGerador) {
    const sujeito = cena.s.split(' ').slice(1).join(' ');
    sujeitos.add(sujeito);
    substantivos.add(minuscula(sujeito.split(' ')[0]));
    verbos.add(cena.v);
    if (cena.o) {
      objetos.add(cena.o.n);
      substantivos.add(minuscula(cena.o.n.split(' ')[0]));
    }
  }
  for (const [chave, variantes] of Object.entries(SUBSTANTIVOS)) {
    substantivos.add(minuscula(chave));
    for (const variante of variantes) substantivos.add(minuscula(variante.split(' ')[0]));
  }
  for (const [chave, variantes] of Object.entries(VERBOS_TRANSITIVOS)) {
    verbos.add(minuscula(chave));
    for (const variante of variantes) verbos.add(minuscula(variante));
  }
  assert(sujeitos.size >= 600, `sujeitos: ${sujeitos.size}`);
  assert(objetos.size >= 800, `objetos: ${objetos.size}`);
  assert(substantivos.size >= 1750, `substantivos: ${substantivos.size}`);
  assert(verbos.size >= 900, `verbos: ${verbos.size}`);
});

test('every lexicon key is reachable from a scene', () => {
  const tokensDasCenas = new Set();
  const verbosComObjeto = new Set();
  for (const cena of cenasDoGerador) {
    for (const texto of [cena.s, cena.o?.n ?? '', cena.c]) {
      for (const palavra of texto.match(/[\p{L}-]+/gu) ?? []) tokensDasCenas.add(minuscula(palavra));
    }
    if (cena.o) verbosComObjeto.add(cena.v);
  }
  for (const chave of Object.keys(SUBSTANTIVOS)) {
    assert(tokensDasCenas.has(minuscula(chave)), `substantivo fora de cena: ${chave}`);
  }
  for (const chave of Object.keys(VERBOS_TRANSITIVOS)) {
    assert(verbosComObjeto.has(chave), `verbo sem cena com objeto: ${chave}`);
  }
});

test('noun variants keep the gender the scene article expects', () => {
  const { mapa, conflitos } = generoDasCenas();
  for (const [chave, variantes] of Object.entries(SUBSTANTIVOS)) {
    const generoChave = mapa.get(chave);
    if (!generoChave || conflitos.has(chave)) continue;
    for (const variante of variantes) {
      const palavra = minuscula(variante.split(' ')[0]);
      if (conflitos.has(palavra)) continue;
      const generoVariante = mapa.get(palavra);
      if (generoVariante && generoVariante !== generoChave) {
        assert.fail(`${chave} (${generoChave}) -> ${variante} (${generoVariante})`);
      }
    }
  }
});

test('generated text keeps words and contractions clean across many seeds', () => {
  const repeticoes = /(?<![\p{L}])(\p{L}+) \1(?![\p{L}])/iu;
  const contracao = /(?<![\p{L}])(?:por|de|em) (?:o|a|os|as)(?=\s)/iu;
  const espacos = /  | [.,;:!?]/u;
  for (const tema of TEMAS_DO_JOGO) {
    for (let seed = 0; seed < 120; seed++) {
      const frase = gerarFrase({ tema, random: seeded(seed * 61 + 11), complexidade: 'complexa' });
      assert.doesNotMatch(frase, repeticoes, frase);
      assert.doesNotMatch(frase, contracao, frase);
      assert.doesNotMatch(frase, espacos, frase);
    }
  }
});
