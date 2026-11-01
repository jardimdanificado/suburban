import { vocabulario, classificarPalavra, converterParaSingular } from './vocabulario.js';

// O léxico vem integralmente do catálogo. Como vocabulario.js não marca classe
// gramatical nem semântica por palavra, inferimos gênero e flexões pela forma.
const palavrasDoCatalogo = new Set(vocabulario.palavras.map(p => String(p).toLocaleLowerCase('pt-BR')));
const substantivosDoCatalogo = [...palavrasDoCatalogo].flatMap(lema => {
  if (!/^[\p{L}]{3,18}$/u.test(lema) || /(?:ar|er|ir)$/u.test(lema)) return [];
  const genero = classificarPalavra(lema) === 'feminino' ? 'f' : classificarPalavra(lema) === 'masculino' ? 'm' : null;
  if (!genero) return [];
  const plural = pluralizar(lema);
  if (!palavrasDoCatalogo.has(plural)) return [];
  return [{ lema, plural, genero, tags:['substantivo'] }];
});

const infinitivosDoCatalogo = [...palavrasDoCatalogo].filter(p => /^[\p{L}]{3,18}(?:ar|er|ir)$/u.test(p));
const verbos = infinitivosDoCatalogo.map(lema => ({
  lema,
  presente:[flexionarVerbo(lema,'presente',false),flexionarVerbo(lema,'presente',true)],
  passado:[flexionarVerbo(lema,'passado',false),flexionarVerbo(lema,'passado',true)],
  sujeitos:['substantivo'], objetos:['substantivo'],
}));

function pluralizar(lema) {
  if (/(r|z)$/u.test(lema)) return `${lema}es`;
  if (/m$/u.test(lema)) return `${lema.slice(0,-1)}ns`;
  if (/ão$/u.test(lema)) return `${lema.slice(0,-2)}ões`;
  if (/[aeou]l$/u.test(lema)) return `${lema.slice(0,-1)}is`;
  if (/il$/u.test(lema)) return `${lema.slice(0,-1)}s`;
  return `${lema}s`;
}

function flexionarVerbo(lema, tempo, plural) {
  const terminacao=lema.slice(-2), radical=lema.slice(0,-2);
  if (tempo==='presente') return `${radical}${terminacao==='ar'?(plural?'am':'a'):plural?'em':'e'}`;
  return `${radical}${terminacao==='ar'?(plural?'aram':'ou'):terminacao==='er'?(plural?'eram':'eu'):(plural?'iram':'iu')}`;
}

const adjetivos = [
  ['bonito','bonita','bonitos','bonitas',['pessoa','animal','lugar','natureza','planta','comércio','comida','bebida','texto','objeto','som']],
  ['alegre','alegre','alegres','alegres',['pessoa','animal']],
  ['curioso','curiosa','curiosos','curiosas',['pessoa','animal']],
  ['calmo','calma','calmos','calmas',['pessoa','animal','lugar','natureza']],
  ['quieto','quieta','quietos','quietas',['pessoa','animal','lugar']],
  ['antigo','antiga','antigos','antigas',['lugar','objeto','texto','comércio']],
  ['pequeno','pequena','pequenos','pequenas',['pessoa','animal','lugar','planta','comida','objeto']],
  ['grande','grande','grandes','grandes',['pessoa','animal','lugar','natureza','planta','comércio','comida','bebida','texto','objeto']],
  ['cheiroso','cheirosa','cheirosos','cheirosas',['planta','comida','bebida']],
  ['fresco','fresca','frescos','frescas',['natureza','comida','bebida']],
  ['doce','doce','doces','doces',['comida','bebida','som']],
  ['forte','forte','fortes','fortes',['pessoa','animal','natureza','bebida','som']],
  ['colorido','colorida','coloridos','coloridas',['lugar','planta','objeto']],
  ['amigável','amigável','amigáveis','amigáveis',['pessoa','animal']],
  ['justo','justa','justos','justas',['pessoa','lugar','texto','objeto']],
  ['livre','livre','livres','livres',['pessoa','lugar','texto']],
  ['unido','unida','unidos','unidas',['pessoa','lugar']],
  ['digno','digna','dignos','dignas',['pessoa','lugar','texto']],
  ['seguro','segura','seguros','seguras',['pessoa','lugar']],
  ['próspero','próspera','prósperos','prósperas',['pessoa','lugar','comércio']],
  ['distante','distante','distantes','distantes',['lugar','natureza']],
];
const adjData = adjetivos.map(([ms, fs, mp, fp, tags]) => ({ formas:[ms,fs,mp,fp], tags }));

const determinantes = {
  definido: { m:['o','os'], f:['a','as'] },
  indefinido: { m:['um','uns'], f:['uma','umas'] },
  demonstrativo: { m:['este','estes'], f:['esta','estas'] },
  demonstrativoDistal: { m:['aquele','aqueles'], f:['aquela','aquelas'] },
};
const adverbiosFrasais = ['às vezes','de repente','com frequência','em silêncio'];
const conectores = ['e','enquanto'];
const escolher = (lista, random) => lista[Math.floor(Math.max(0,Math.min(0.999999999,random()))*lista.length)];
const combina = (a,b) => a.includes('substantivo') || a.some(tag => b.includes(tag));
const plural = (random) => random() < 0.24;
const tempoAleatorio = (random) => random() < 0.68 ? 'presente' : 'passado';

function sintagmaNominal(nome, random, { adjetivo = true } = {}) {
  const isPlural = plural(random);
  const artigoTipo = escolher(Object.keys(determinantes), random);
  const artigo = determinantes[artigoTipo][nome.genero][isPlural ? 1 : 0];
  const forma = isPlural ? nome.plural : nome.lema;
  let modificador = '';
  if (adjetivo && random() < 0.42) {
    const escolhas = adjData.filter(adj => combina(nome.tags,adj.tags));
    if (escolhas.length) {
      const adj = escolher(escolhas,random);
      const indice = (isPlural ? 2 : 0) + (nome.genero === 'f' ? 1 : 0);
      modificador = ` ${adj.formas[indice]}`;
    }
  }
  return { texto:`${artigo} ${forma}${modificador}`, plural:isPlural, genero:nome.genero, nome };
}

function formaDoVerbo(verb, numero, tempo) {
  if (tempo === 'presente') return verb.presente[numero ? 1 : 0];
  return verb.passado[numero ? 1 : 0];
}

function gerarOracao(nomes, random) {
  const tempo = tempoAleatorio(random);
  if (!nomes.length || !verbos.length) throw new RangeError('O catálogo precisa conter substantivos e verbos flexionáveis');
  const verb = escolher(verbos,random);
  const sujeito = sintagmaNominal(escolher(nomes,random),random);
  const verbo = formaDoVerbo(verb,sujeito.plural,tempo);
  return `${sujeito.texto} ${verbo} ${sintagmaNominal(escolher(nomes,random),random).texto}`;
}

/** Gera uma frase por regras gramaticais com combinações novas a cada chamada. */
export function gerarFrase({ random = Math.random, substantivos: extras = [], somenteExtras = false } = {}) {
  if (typeof random !== 'function') throw new TypeError('random precisa ser uma função');
  const nomes = [...(somenteExtras?[]:substantivosDoCatalogo),...extras].filter(nome => nome && palavrasDoCatalogo.has(nome.lema?.toLocaleLowerCase('pt-BR')) && palavrasDoCatalogo.has(nome.plural?.toLocaleLowerCase('pt-BR')) && typeof nome.lema === 'string' && typeof nome.plural === 'string' && ['m','f'].includes(nome.genero) && Array.isArray(nome.tags) && nome.tags.length);
  if (!nomes.length) throw new RangeError('O léxico não tem substantivos válidos');
  const primeira = gerarOracao(nomes,random);
  const abertura = random() < 0.23 ? `${escolher(adverbiosFrasais,random)}, ` : '';
  if (random() < 0.12) {
    const segunda = gerarOracao(nomes,random);
    return `${abertura}${primeira} ${escolher(conectores,random)} ${segunda}.`;
  }
  return `${abertura}${primeira}.`;
}

/** Mantém a API usada pelo jogo; o tema não restringe o léxico. */
export function gerarFraseTematica(tema,{random=Math.random}={}){
  if(!['arte','politica'].includes(tema))throw new RangeError(`Tema de frase desconhecido: ${tema}`);
  return gerarFrase({random});
}

/** Transforma uma palavra combinada em lexema que a gramática pode flexionar. */
export function criarSubstantivoCombinado(palavra1, palavra2, { genero, tags } = {}) {
  if (!['masculino','feminino'].includes(genero)) throw new TypeError('Informe genero como masculino ou feminino');
  if (!Array.isArray(tags) || !tags.length) throw new TypeError('Informe tags semânticas para o substantivo');
  const lema = vocabulario.combinar(palavra1,palavra2,'eufonia',genero,'singular');
  const formaPlural = vocabulario.combinar(palavra1,palavra2,'eufonia',genero,'plural');
  const classeDetectada = classificarPalavra(lema);
  const generoEsperado = genero === 'feminino' ? 'feminino' : 'masculino';
  if (classeDetectada !== generoEsperado || converterParaSingular(formaPlural) !== lema) {
    throw new RangeError('A combinação não produziu formas coerentes de gênero e número');
  }
  return { lema, plural:formaPlural, genero:genero === 'feminino' ? 'f' : 'm', classeDetectada, tags:[...new Set(tags)] };
}
