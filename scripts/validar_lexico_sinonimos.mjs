// Valida o léxico de variantes usado pelo gerador de textos.
//
// Uso: node scripts/validar_lexico_sinonimos.mjs
//
// O catálogo do jogo guarda lemas, não todas as flexões, e não serve como
// dicionário completo. A validação então:
// - confere o número (singular/plural) pelo lema inferido pelo catálogo;
// - conjuga cada verbo em todos os tempos usados pelo gerador;
// - quando Python e spaCy estão disponíveis, faz a conferência ortográfica
//   com o léxico do modelo pt_core_news_md.
//
// Verbos ficam na lista transitiva porque o gerador só os aplica em cena com
// objeto direto.
import { spawnSync } from 'node:child_process';
import { SUBSTANTIVOS, VERBOS_TRANSITIVOS } from '../js/lexico_sinonimos.js';
import { conjugarVerbo, classificarPalavraCompleta } from '../js/vocabulario.js';

const TEMPOS = [
  'presente', 'pretérito-perfeito', 'pretérito-imperfeito',
  'futuro', 'condicional', 'subjuntivo-presente', 'participio',
];

const primeiraPalavra = texto => texto.split(' ')[0];
const minuscula = texto => texto.toLocaleLowerCase('pt-BR');

// O lema inferido pelo catálogo nem sempre reduz o plural. Nesses casos a
// terminação decide, com exceção das palavras terminadas em s que são
// singulares.
const SINGULARES_EM_S = new Set(['ônibus', 'vírus', 'país', 'gás', 'pires', 'atlas', 'cais', 'lápis']);
const PLURAIS_INVARIAVEIS = new Set(['sem-teto']);
const ehPlural = (palavra, lema) => PLURAIS_INVARIAVEIS.has(minuscula(palavra))
  || lema !== minuscula(palavra)
  || (/s$/u.test(minuscula(palavra)) && !SINGULARES_EM_S.has(minuscula(palavra)));

const erros = [];
const palavras = new Set();

function analisar(palavra, contexto) {
  const info = classificarPalavraCompleta(palavra);
  palavras.add(minuscula(palavra));
  return { ...info, plural: ehPlural(palavra, info.lema) };
}

for (const [chave, variantes] of Object.entries(SUBSTANTIVOS)) {
  if (!Array.isArray(variantes) || !variantes.length) {
    erros.push(`SUBSTANTIVOS.${chave}: lista vazia`);
    continue;
  }
  const origem = analisar(chave, `SUBSTANTIVOS.${chave}`);
  for (const variante of variantes) {
    if (variante === chave) {
      erros.push(`SUBSTANTIVOS.${chave}: variante igual à chave`);
      continue;
    }
    const cabeca = primeiraPalavra(variante);
    const alvo = analisar(cabeca, `SUBSTANTIVOS.${chave} -> ${variante}`);
    if (alvo.lema === origem.lema && !variante.includes(' ')) {
      erros.push(`SUBSTANTIVOS.${chave} -> "${variante}": mesmo lema da chave`);
    }
    if (alvo.plural !== origem.plural) {
      erros.push(`SUBSTANTIVOS.${chave} -> "${variante}": número diferente da chave`);
    }
  }
}

for (const [verbo, variantes] of Object.entries(VERBOS_TRANSITIVOS)) {
  if (!Array.isArray(variantes) || !variantes.length) {
    erros.push(`VERBOS_TRANSITIVOS.${verbo}: lista vazia`);
    continue;
  }
  palavras.add(verbo);
  for (const variante of variantes) {
    if (variante === verbo) {
      erros.push(`VERBOS_TRANSITIVOS.${verbo}: variante igual à chave`);
      continue;
    }
    palavras.add(variante);
    if (!/^[\p{L}]+(?:ar|er|ir|or)$/u.test(variante)) {
      erros.push(`VERBOS_TRANSITIVOS.${verbo} -> "${variante}": não está no infinitivo`);
      continue;
    }
    for (const tempo of TEMPOS) {
      for (const pessoa of tempo === 'participio' ? [3] : [3, 6]) {
        const forma = conjugarVerbo(variante, { tempo, pessoa });
        if (!forma) erros.push(`VERBOS_TRANSITIVOS.${verbo} -> "${variante}": sem forma em ${tempo}`);
        else if (!/^[\p{L}]+$/u.test(forma)) {
          erros.push(`VERBOS_TRANSITIVOS.${verbo} -> "${variante}": forma inválida "${forma}" em ${tempo}`);
        }
      }
    }
  }
}

// Conferência ortográfica opcional. O modelo spaCy não entra no jogo: só
// valida a lista durante o desenvolvimento.
if (erros.length === 0) {
  const script = [
    'import json, sys',
    'import spacy',
    'words = json.load(sys.stdin)',
    'nlp = spacy.load("pt_core_news_md")',
    'json.dump([w for w in words if nlp.vocab[w].is_oov], sys.stdout)',
  ].join('\n');
  const resultado = spawnSync('python3', ['-c', script], {
    input: JSON.stringify([...palavras]),
    encoding: 'utf8',
  });
  if (resultado.error || resultado.status !== 0) {
    console.warn('aviso: conferência ortográfica ignorada (python3 ou spaCy indisponível)');
  } else {
    let foraDoLéxico = [];
    try {
      foraDoLéxico = JSON.parse(resultado.stdout);
    } catch {
      console.warn('aviso: conferência ortográfica sem resposta válida');
    }
    for (const palavra of foraDoLéxico) erros.push(`ortografia: "${palavra}" fora do léxico pt_core_news_md`);
  }
}

for (const erro of erros) console.error(`erro: ${erro}`);

const substantivos = Object.keys(SUBSTANTIVOS).length;
const variantesSubstantivo = Object.values(SUBSTANTIVOS).reduce((total, lista) => total + lista.length, 0);
const verbos = Object.keys(VERBOS_TRANSITIVOS).length;
const variantesVerbo = Object.values(VERBOS_TRANSITIVOS).reduce((total, lista) => total + lista.length, 0);
console.log(`substantivos ${substantivos} (${variantesSubstantivo} variantes), verbos ${verbos} (${variantesVerbo} variantes)`);
console.log(`erros ${erros.length}`);

if (erros.length) process.exitCode = 1;
