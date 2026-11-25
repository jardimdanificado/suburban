// Conta o vocabulário realmente disponível para o gerador de textos.
//
// Uso: node scripts/contar_vocabulario.mjs
//
// "Lemas" são as palavras que o gerador pode escolher. "Formas" incluem as
// flexões que aparecem no texto: plural dos substantivos e tempos dos verbos.
import { CENAS } from '../js/gerador_textos.js';
import { SUBSTANTIVOS, VERBOS_TRANSITIVOS } from '../js/lexico_sinonimos.js';
import { conjugarVerbo } from '../js/vocabulario.js';

const minuscula = palavra => palavra.toLocaleLowerCase('pt-BR');
const nucleo = frase => minuscula(frase.split(' ')[0]);

const cenas = Object.values(CENAS).flat();
const sujeitos = new Set();
const objetos = new Set();
const verbosDeCena = new Set();
const substantivosDeCena = new Set();
const palavrasDeCena = new Set();

for (const cena of cenas) {
  const sujeito = cena.s.split(' ').slice(1).join(' ');
  if (sujeito) {
    sujeitos.add(sujeito);
    substantivosDeCena.add(nucleo(sujeito));
  }
  verbosDeCena.add(cena.v);
  if (cena.o) {
    objetos.add(cena.o.n);
    substantivosDeCena.add(nucleo(cena.o.n));
  }
  for (const texto of [cena.s, cena.o?.n ?? '', cena.c]) {
    for (const palavra of texto.match(/[\p{L}-]+/gu) ?? []) {
      if (palavra.length > 2) palavrasDeCena.add(minuscula(palavra));
    }
  }
}

const variantesSubstantivo = Object.values(SUBSTANTIVOS).flat();
const variantesVerbo = Object.values(VERBOS_TRANSITIVOS).flat();

const substantivos = new Set([
  ...substantivosDeCena,
  ...Object.keys(SUBSTANTIVOS).map(minuscula),
  ...variantesSubstantivo.map(nucleo),
]);
const verbos = new Set([
  ...verbosDeCena,
  ...Object.keys(VERBOS_TRANSITIVOS).map(minuscula),
  ...variantesVerbo.map(minuscula),
]);

const formasSubstantivo = new Set([...substantivos]);
for (const palavra of substantivos) {
  if (/s$/u.test(palavra)) continue;
  formasSubstantivo.add(`${palavra}s`);
}

const formasVerbo = new Set([...verbos]);
for (const verbo of verbos) {
  if (verbo.includes(' ')) continue;
  for (const tempo of ['presente', 'pretérito-perfeito', 'pretérito-imperfeito', 'futuro', 'condicional', 'subjuntivo-presente']) {
    for (const pessoa of [3, 6]) {
      const forma = conjugarVerbo(verbo, { tempo, pessoa });
      if (forma) formasVerbo.add(forma);
    }
  }
  for (const tempo of ['gerundio', 'participio']) {
    const forma = conjugarVerbo(verbo, { tempo, pessoa: 3 });
    if (forma) formasVerbo.add(forma);
  }
}

console.log(`cenas ${cenas.length}`);
console.log(`sujeitos ${sujeitos.size} | objetos ${objetos.size} | verbos de cena ${verbosDeCena.size}`);
console.log(`palavras de conteúdo nas cenas ${palavrasDeCena.size}`);
console.log(`substantivos no léxico ${Object.keys(SUBSTANTIVOS).length} chaves, ${variantesSubstantivo.length} variantes`);
console.log(`verbos no léxico ${Object.keys(VERBOS_TRANSITIVOS).length} chaves, ${variantesVerbo.length} variantes`);
console.log(`TOTAL substantivos ${substantivos.size} lemas, ${formasSubstantivo.size} formas`);
console.log(`TOTAL verbos ${verbos.size} lemas, ${formasVerbo.size} formas`);
