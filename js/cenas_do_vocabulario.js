// Banco de cenas gerado a partir do catálogo de js/vocabulario.js.
//
// Não existe frase pronta aqui. O que fica fixo é só a estrutura gramatical:
// sujeito com artigo, verbo no infinitivo, objeto direto opcional e complemento
// preposicional opcional. Todo substantivo, verbo e adjetivo vem do catálogo
// ou do alvo informado por quem chama.
//
// Regras de montagem:
// - candidatas: apenas palavras comuns, da interseção entre o catálogo de
//   js/vocabulario.js e a lista de frequência em js/vocabulario_frequente.js;
// - substantivo: classe "substantivo", gênero conhecido, lema na forma singular
//   e confiança mínima;
// - verbo: infinitivo conferido contra a lista de verbos de fserb/pt-br, em
//   VERBOS_FREQUENTES;
// - adjetivo: formas de js/adjetivos_frequentes.js, já conferidas contra o
//   catálogo e concordadas com o núcleo do sintagma;
// - tema: as etiquetas de classificarTemas filtram sujeito, verbo, objeto e
//   adjetivo, então a combinação continua no assunto pedido;
// - objeto direto só entra com verbo transitivo conhecido do léxico curado;
//   verbo sem essa informação recebe complemento preposicional, que serve para
//   intransitivo e transitivo sem risco de concordância.
//
// As 939 estruturas de js/cenas_padroes.js são realizadas com esse vocabulário,
// então todo padrão das cenas antigas continua alcançável.
import {
  vocabulario,
  classificarPalavraCompleta,
  classificarTemas,
  conjugarVerbo,
} from './vocabulario.js';
import {SUBSTANTIVOS, VERBOS_TRANSITIVOS} from './lexico_sinonimos.js';
import {PALAVRAS_FREQUENTES, VERBOS_FREQUENTES} from './vocabulario_frequente.js';
import {ADJETIVOS_FREQUENTES} from './adjetivos_frequentes.js';
import {GENEROS_FREQUENTES} from './generos_frequentes.js';
import {PADROES} from './cenas_padroes.js';

const TEMAS = [
  'politica', 'cidade', 'trabalho', 'economia', 'moradia', 'familia',
  'alimentacao', 'saude', 'mobilidade', 'educacao_cultura',
  'seguranca_justica', 'meio_ambiente', 'substancias', 'moda',
  'esportes_lazer', 'cotidiano',
];

const PREPOSICOES = ['em', 'com', 'para', 'sem', 'sobre'];
const TRANSITIVOS = new Set(Object.keys(VERBOS_TRANSITIVOS));

const ARTIGO = {
  'm-s': 'o', 'm-p': 'os', 'f-s': 'a', 'f-p': 'as',
};

const ART_INFO = {
  o: {genero: 'm', plural: false},
  os: {genero: 'm', plural: true},
  a: {genero: 'f', plural: false},
  as: {genero: 'f', plural: true},
  um: {genero: 'm', plural: false},
  uns: {genero: 'm', plural: true},
  uma: {genero: 'f', plural: false},
  umas: {genero: 'f', plural: true},
};

const ehPlural = palavra => {
  const chave = String(palavra).toLocaleLowerCase('pt-BR');
  if (/(?:ões|ães|ãos)$/u.test(chave)) return true;
  if (/(?:r|z)es$/u.test(chave)) return true;
  if (/[aeiou]s$/u.test(chave)) return true;
  if (/[aeou]is$/u.test(chave)) return true;
  return false;
};

// O catálogo guarda as formas flexionadas. Antes de inventar um plural, a
// candidata é conferida no catálogo: "irmãos" existe, "irmões" não.
let palavrasDoCatalogo = null;
const existeNoCatalogo = forma => {
  if (!palavrasDoCatalogo) {
    palavrasDoCatalogo = new Set(vocabulario.palavras.map(p => String(p).toLocaleLowerCase('pt-BR')));
  }
  return palavrasDoCatalogo.has(forma);
};

const pluralizar = palavra => {
  // Substantivo de plural invariante, como "ônibus" e "lápis".
  if (ehPlural(palavra)) return palavra;
  if (/m$/u.test(palavra)) return palavra.slice(0, -1) + 'ns';
  if (/[rz]$/u.test(palavra)) return palavra + 'es';
  if (/ão$/u.test(palavra)) {
    // "ão" tem três plurais. O catálogo decide entre eles; sem candidata,
    // vale o mais comum.
    const radical = palavra.slice(0, -2);
    for (const termo of ['ãos', 'ães', 'ões']) {
      if (existeNoCatalogo(radical + termo)) return radical + termo;
    }
    return radical + 'ões';
  }
  if (/al$/u.test(palavra)) return palavra.slice(0, -1) + 'is';
  if (/ol$/u.test(palavra)) return palavra.slice(0, -2) + 'óis';
  if (/[uú]l$/u.test(palavra)) return palavra.slice(0, -1) + 'is';
  if (/el$/u.test(palavra)) return palavra.slice(0, -2) + 'éis';
  if (/il$/u.test(palavra)) return palavra.slice(0, -1) + 's';
  // Singular terminado em vogal acentuada + s: "país" fica "países", mas
  // "mês" e "gás" perdem o acento.
  if (/ís$/u.test(palavra)) return palavra.slice(0, -1) + 'ses';
  if (/[áéêó]s$/u.test(palavra)) {
    const base = palavra.slice(0, -1).normalize('NFD').replace(/[\u0300-\u036f]/gu, '');
    return base + 'ses';
  }
  return palavra + 's';
};

const generoDe = palavra => {
  const chave = String(palavra).split(/\s+/u)[0];
  // 1. Mapa do spaCy: cobre as palavras do catálogo e do léxico curado.
  const doMapa = GENEROS_FREQUENTES[chave];
  if (doMapa === 'f' || doMapa === 'm') return doMapa;
  // 2. Classificador do catálogo.
  const bruto = classificarPalavraCompleta(chave).genero;
  if (bruto === 'feminino') return 'f';
  if (bruto === 'masculino') return 'm';
  return null;
};

// Quando o classificador devolve "neutro" (plural em consoante, epiceno), o
// artigo precisa de uma decisão. O léxico curado só compara gênero, então a
// terminação decide: feminino conhecido fica feminino; o resto, masculino.
const FEMININAS = /(?:ção|são|ssão|dade|tude|ice|ez|eza|agem|ância|ência|aria|eria|ura|ia|gem|ade|ude)$/u;

const generoDoLema = palavra => {
  const explicito = generoDe(palavra);
  if (explicito) return explicito;
  return FEMININAS.test(String(palavra).split(/\s+/u)[0]) ? 'f' : 'm';
};

const item = (palavra, generoForcado = null) => {
  const genero = generoForcado || generoDe(palavra);
  if (!genero) return null;
  return {
    nome: String(palavra),
    genero,
    plural: ehPlural(String(palavra).split(/\s+/u)[0]),
  };
};

const comArtigo = ({nome, genero, plural}, maiuscula = false) => {
  const chave = `${genero}-${plural ? 'p' : 's'}`;
  const artigo = ARTIGO[chave];
  return `${maiuscula ? artigo.charAt(0).toLocaleUpperCase('pt-BR') + artigo.slice(1) : artigo} ${nome}`;
};

const objetoDe = ({nome, genero, plural}) => ({
  d: ARTIGO[`${genero}-${plural ? 'p' : 's'}`],
  n: nome,
  g: genero,
});

const contrair = (preposicao, genero, plural) => {
  const feminino = genero === 'f';
  if (preposicao === 'em') return plural ? (feminino ? 'nas' : 'nos') : (feminino ? 'na' : 'no');
  if (preposicao === 'de') return plural ? (feminino ? 'das' : 'dos') : (feminino ? 'da' : 'do');
  if (preposicao === 'por') return plural ? (feminino ? 'pelas' : 'pelos') : (feminino ? 'pela' : 'pelo');
  return null;
};

const complementoDe = (preposicao, alvo) => {
  const contraida = contrair(preposicao, alvo.genero, alvo.plural);
  return contraida ? `${contraida} ${alvo.nome}` : `${preposicao} ${comArtigo(alvo)}`;
};

function sorteioDe(seed) {
  let estado = seed >>> 0;
  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 4294967296;
  };
}

const escolhe = (lista, random) => lista[Math.floor(random() * lista.length)];

// ---------------------------------------------------------------------------
// Catálogos filtrados do vocabulário do jogo
// ---------------------------------------------------------------------------

let pools = null;

// O catálogo é pesado: cada lista é montada uma vez e fica em cache enquanto o
// processo viver.
function catalogo() {
  if (pools) return pools;
  const substantivos = new Map();
  const verbos = new Set();
  const adjetivos = new Map();
  const porTema = new Map(TEMAS.map(tema => [
    tema,
    {substantivos: new Map(), verbos: new Set(), adjetivos: new Map()},
  ]));

  for (const palavra of PALAVRAS_FREQUENTES) {
    if (typeof palavra !== 'string') continue;
    if (palavra.length < 4 || palavra.length > 16) continue;
    if (!/^[a-zà-ú]+$/u.test(palavra)) continue;
    const temas = classificarTemas(palavra);
    const info = classificarPalavraCompleta(palavra);
    // Verbo vem da lista conferida, adjetivo vem do recurso próprio; aqui só
    // entram substantivos.
    if (info.classes.includes('verbo')) continue;
    if (info.classes.includes('adjetivo')) continue;
    if (!info.classes.includes('substantivo')) continue;
    if (info.lema !== palavra) continue;
    // O gênero vem do mapa do spaCy, mais seguro que o classificador para
    // casos como "lei", "voz" e "mão".
    const genero = GENEROS_FREQUENTES[palavra];
    if (genero !== 'f' && genero !== 'm') continue;
    substantivos.set(palavra, genero);
    const assuntos = temas.length ? temas : ['cotidiano'];
    for (const tema of assuntos) porTema.get(tema)?.substantivos.set(palavra, genero);
  }

  for (const verbo of VERBOS_FREQUENTES) {
    if (typeof verbo !== 'string') continue;
    if (!conjugarVerbo(verbo, {tempo: 'presente', pessoa: 3})) continue;
    verbos.add(verbo);
    const temas = classificarTemas(verbo);
    const assuntos = temas.length ? temas : ['cotidiano'];
    for (const tema of assuntos) porTema.get(tema)?.verbos.add(verbo);
  }

  // Formas de adjetivo por gênero e número. As invariantes (xs/xp) servem aos
  // dois gêneros.
  const grupos = {
    'm-s': [...new Set([...ADJETIVOS_FREQUENTES.ms, ...ADJETIVOS_FREQUENTES.xs])],
    'f-s': [...new Set([...ADJETIVOS_FREQUENTES.fs, ...ADJETIVOS_FREQUENTES.xs])],
    'm-p': [...new Set([...ADJETIVOS_FREQUENTES.mp, ...ADJETIVOS_FREQUENTES.xp])],
    'f-p': [...new Set([...ADJETIVOS_FREQUENTES.fp, ...ADJETIVOS_FREQUENTES.xp])],
  };
  for (const forma of Object.values(grupos).flat()) {
    if (adjetivos.has(forma)) continue;
    const temas = classificarTemas(forma);
    adjetivos.set(forma, temas);
    const assuntos = temas.length ? temas : ['cotidiano'];
    for (const tema of assuntos) porTema.get(tema)?.adjetivos.set(forma, temas);
  }

  pools = {substantivos, verbos, adjetivos, grupos, porTema};
  return pools;
}

// Nomes próprios entram como sujeito para dar falantes de verdade ao discurso
// direto. Só entram nomes comuns: o nome precisa constar da lista de frequência
// usada para o restante do vocabulário. O gênero não é usado, porque nome
// próprio não leva artigo.
function nomesProprios() {
  const todos = Array.isArray(vocabulario.nomes) ? vocabulario.nomes : [];
  const comuns = new Set(PALAVRAS_FREQUENTES);
  return todos.filter(nome => {
    if (!/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,11}$/u.test(nome)) return false;
    const chave = nome.toLocaleLowerCase('pt-BR')
      .normalize('NFD').replace(/[\u0300-\u036f]/gu, '');
    return comuns.has(chave);
  });
}

// Um verbo conjugado não pode repetir a última palavra do sujeito:
// "a casa casa com o casaco" é agramatical por eco. A checagem cobre os
// tempos que o gerador usa.
const FORMAS_DO_VERBO = new Map();
function formasDoVerbo(verbo) {
  if (FORMAS_DO_VERBO.has(verbo)) return FORMAS_DO_VERBO.get(verbo);
  const formas = new Set([verbo]);
  for (const tempo of ['presente', 'pretérito-perfeito', 'pretérito-imperfeito', 'futuro', 'condicional', 'subjuntivo-presente']) {
    for (const numero of ['singular', 'plural']) {
      const forma = conjugarVerbo(verbo, {tempo, pessoa: 3, numero});
      if (forma) formas.add(forma);
    }
  }
  FORMAS_DO_VERBO.set(verbo, formas);
  return formas;
}

function colideComSujeito(sujeito, verbo) {
  const palavras = String(sujeito).toLocaleLowerCase('pt-BR').split(/\s+/u);
  return formasDoVerbo(verbo).has(palavras[palavras.length - 1]);
}

function verboSemEco(sujeito, candidatos, random) {
  for (let tentativa = 0; tentativa < 12; tentativa++) {
    const verbo = escolhe(candidatos, random);
    if (!colideComSujeito(sujeito, verbo)) return verbo;
  }
  return candidatos.find(verbo => !colideComSujeito(sujeito, verbo)) || null;
}

function escolherDoTema(tema, random, tipo = 'substantivos') {
  const dados = catalogo().porTema.get(tema);
  const opcoes = dados ? [...dados[tipo].entries()] : [];
  if (!opcoes.length) return null;
  const [nome, genero] = escolhe(opcoes, random);
  return {nome, genero: genero === 'f' ? 'f' : 'm', plural: ehPlural(nome)};
}

// ---------------------------------------------------------------------------
// Realização das estruturas antigas com o vocabulário do jogo
// ---------------------------------------------------------------------------

const artigoDefinido = (genero, plural) =>
  genero === 'f' ? (plural ? 'as' : 'a') : (plural ? 'os' : 'o');

const artigoIndefinido = (genero, plural) =>
  genero === 'f' ? (plural ? 'umas' : 'uma') : (plural ? 'uns' : 'um');

const formaContraida = (preposicao, artigo) => {
  const info = ART_INFO[artigo];
  if (!info) return null;
  if (preposicao === 'de') return info.plural ? (info.genero === 'f' ? 'das' : 'dos') : (info.genero === 'f' ? 'da' : 'do');
  if (preposicao === 'em') return info.plural ? (info.genero === 'f' ? 'nas' : 'nos') : (info.genero === 'f' ? 'na' : 'no');
  if (preposicao === 'por') return info.plural ? (info.genero === 'f' ? 'pelas' : 'pelos') : (info.genero === 'f' ? 'pela' : 'pelo');
  if (preposicao === 'a') {
    if (info.plural) return info.genero === 'f' ? 'às' : 'aos';
    return info.genero === 'f' ? 'à' : 'ao';
  }
  return null;
};

// Separa a assinatura em segmentos: cada preposição abre um sintagma.
function dividirSegmentos(assinatura) {
  const segmentos = [];
  let atual = {prep: null, tokens: []};
  for (const token of String(assinatura).split(/\s+/u)) {
    if (!token) continue;
    if (token.startsWith('p:')) {
      if (atual.tokens.length) segmentos.push(atual);
      atual = {prep: token.slice(2), tokens: []};
    } else {
      atual.tokens.push(token);
    }
  }
  if (atual.tokens.length || atual.prep) segmentos.push(atual);
  return segmentos;
}

function criarContexto(tema, random) {
  const usados = new Set();
  const registrar = singular => {
    usados.add(singular);
    usados.add(pluralizar(singular));
  };
  return {
    tema,
    random,
    usados,
    escolherSubstantivo(plural) {
      const dados = catalogo().porTema.get(tema);
      const doTema = dados ? [...dados.substantivos.entries()] : [];
      const global = [...catalogo().substantivos.entries()];
      const tentar = lista => {
        for (let i = 0; i < 24 && lista.length; i++) {
          const [nome, genero] = escolhe(lista, random);
          const superficie = plural ? pluralizar(nome) : nome;
          if (usados.has(nome) || usados.has(superficie)) continue;
          registrar(nome);
          return {nome, genero: genero === 'f' ? 'f' : 'm', plural: Boolean(plural)};
        }
        return null;
      };
      const escolhido = tentar(doTema) || tentar(global);
      if (escolhido) return escolhido;
      // Último recurso: aceita a repetição em vez de perder a estrutura.
      const lista = doTema.length ? doTema : global;
      if (!lista.length) return null;
      const [nome, genero] = escolhe(lista, random);
      registrar(nome);
      return {nome, genero: genero === 'f' ? 'f' : 'm', plural: Boolean(plural)};
    },
    escolherAdjetivo(nucleo) {
      const chave = nucleo ? `${nucleo.genero}-${nucleo.plural ? 'p' : 's'}` : null;
      const grupo = nucleo && catalogo().grupos[chave] ? catalogo().grupos[chave] : [];
      if (!grupo.length) return null;
      const doTema = grupo.filter(forma => {
        const temas = catalogo().adjetivos.get(forma) || [];
        return temas.includes(tema);
      });
      const lista = doTema.length ? doTema : grupo;
      for (let i = 0; i < 16; i++) {
        const forma = escolhe(lista, random);
        if (nucleo && forma === nucleo.nome) continue;
        if (usados.has(forma)) continue;
        usados.add(forma);
        return forma;
      }
      return escolhe(lista, random);
    },
    escolherVerboInfinitivo() {
      const dados = catalogo().porTema.get(tema);
      const doTema = dados ? [...dados.verbos] : [];
      const lista = doTema.length ? doTema : [...catalogo().verbos];
      return lista.length ? escolhe(lista, random) : null;
    },
  };
}

function realizarSegmento(segmento, ctx, nucleoBase = null) {
  const {tokens} = segmento;
  const indiceNucleo = tokens.findIndex(token => token === 'n' || token === 'N');
  const temNucleo = indiceNucleo >= 0;
  let nucleo = null;
  if (temNucleo) {
    const artigoPlural = tokens.some(token => token === 'A' || token === 'I');
    const artigoSingular = tokens.some(token => token === 'a' || token === 'i');
    let plural = tokens[indiceNucleo] === 'N';
    if (artigoPlural) plural = true;
    else if (artigoSingular) plural = false;
    nucleo = ctx.escolherSubstantivo(plural);
    if (!nucleo) return null;
  }
  // Adjetivo sem substantivo no próprio sintagma é predicado e concorda com o
  // sujeito: "a rua passa cheia", "as famílias almoçam juntas".
  const alvoAdjetivo = nucleo || nucleoBase;

  const palavras = [];
  let artigo = null;
  let indefinido = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === 'a' || token === 'A' || token === 'i' || token === 'I') {
      if (!nucleo) continue;
      const indef = token === 'i' || token === 'I';
      const plural = token === 'A' || token === 'I' || nucleo.plural;
      const valor = indef
        ? artigoIndefinido(nucleo.genero, plural)
        : artigoDefinido(nucleo.genero, plural);
      if (!artigo) {
        artigo = valor;
        indefinido = indef;
      }
      palavras.push(valor);
      continue;
    }
    if (token === 'n' || token === 'N') {
      if (i === indiceNucleo) {
        palavras.push(nucleo.plural ? pluralizar(nucleo.nome) : nucleo.nome);
      } else {
        const adjetivo = ctx.escolherAdjetivo(alvoAdjetivo);
        if (adjetivo) palavras.push(adjetivo);
      }
      continue;
    }
    if (token === 'j') {
      const adjetivo = ctx.escolherAdjetivo(alvoAdjetivo);
      if (adjetivo) palavras.push(adjetivo);
      continue;
    }
    if (token.startsWith('f:')) {
      palavras.push(token.slice(2));
      continue;
    }
    if (token === 'V') {
      const verbo = ctx.escolherVerboInfinitivo();
      if (!verbo) return null;
      palavras.push(verbo);
      continue;
    }
  }

  if (!palavras.length) return null;
  const prep = segmento.prep;
  if (!prep) return {texto: palavras.join(' '), nucleo, artigo, indefinido};
  if (artigo && !indefinido) {
    const contraida = formaContraida(prep, artigo);
    if (contraida) {
      const resto = palavras.slice(1).join(' ');
      return {texto: resto ? `${contraida} ${resto}` : contraida, nucleo, artigo: null, indefinido: false};
    }
  }
  return {texto: `${prep} ${palavras.join(' ')}`, nucleo, artigo: null, indefinido: false};
}

function realizarAssinatura(assinatura, ctx, nucleoBase = null) {
  const segmentos = dividirSegmentos(assinatura);
  const pedacos = [];
  let nucleo = null;
  let artigo = null;
  for (const segmento of segmentos) {
    const r = realizarSegmento(segmento, ctx, nucleoBase);
    if (!r) return null;
    if (!nucleo && r.nucleo) nucleo = r.nucleo;
    if (!artigo && r.artigo) artigo = r.artigo;
    if (r.texto) pedacos.push(r.texto);
  }
  if (!pedacos.length) return null;
  const texto = pedacos.join(' ');
  return {
    texto,
    nucleo,
    artigo,
    resto: artigo ? texto.slice(artigo.length + 1) : texto,
  };
}

const TRANSITIVOS_POR_TEMA = new Map();
function transitivosDoTema(tema) {
  if (TRANSITIVOS_POR_TEMA.has(tema)) return TRANSITIVOS_POR_TEMA.get(tema);
  const lista = [...TRANSITIVOS].filter(verbo => classificarTemas(verbo).includes(tema));
  TRANSITIVOS_POR_TEMA.set(tema, lista);
  return lista;
}

function escolherTransitivo(sujeito, tema, random) {
  const preferidos = transitivosDoTema(tema);
  const candidatos = preferidos.length ? preferidos : [...TRANSITIVOS];
  return verboSemEco(sujeito, candidatos, random);
}

function escolherVerbo(sujeito, tema, random) {
  const dados = catalogo().porTema.get(tema);
  const doTema = dados ? [...dados.verbos] : [];
  const candidatos = doTema.length ? doTema : [...catalogo().verbos];
  if (!candidatos.length) return null;
  return verboSemEco(sujeito, candidatos, random);
}

function capitalizar(texto) {
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1);
}

// Realiza um padrão estrutural: escolhe substantivos, adjetivos e verbo com o
// vocabulário do tema e monta a cena no mesmo formato do gerador.
function cenaDoPadrao(padrao, tema, random) {
  const ctx = criarContexto(tema, random);
  const sujeito = realizarAssinatura(padrao.s, ctx);
  if (!sujeito || !sujeito.nucleo || !sujeito.artigo) return null;
  const s = capitalizar(sujeito.texto);

  let objeto = null;
  if (padrao.o) {
    const realizado = realizarAssinatura(padrao.o, ctx, sujeito.nucleo);
    if (!realizado || !realizado.nucleo || !realizado.artigo) return null;
    objeto = {d: realizado.artigo, n: realizado.resto, g: realizado.nucleo.genero};
  }

  let complemento = '';
  if (padrao.c) {
    const realizado = realizarAssinatura(padrao.c, ctx, sujeito.nucleo);
    if (!realizado) return null;
    complemento = realizado.texto;
  }

  const verbo = padrao.t === 't'
    ? escolherTransitivo(s, tema, random)
    : escolherVerbo(s, tema, random);
  if (!verbo) return null;
  return {s, v: verbo, o: objeto, c: complemento};
}

// ---------------------------------------------------------------------------
// Cenas montadas diretamente dos catálogos (escala e cobertura do léxico)
// ---------------------------------------------------------------------------

// Cena com objeto direto. Só usa verbo transitivo do léxico curado, então a
// regência está garantida.
function cenaTransitiva(random, {tema, sujeito = null, verbo = null} = {}) {
  const objeto = escolherDoTema(tema, random);
  if (!objeto) return null;
  const sujeitoEscolhido = sujeito || escolherDoTema(tema, random);
  if (!sujeitoEscolhido) return null;
  if (sujeitoEscolhido.nome === objeto.nome) return null;
  const s = comArtigo(sujeitoEscolhido, true);
  const verboEscolhido = verbo && TRANSITIVOS.has(verbo) && !colideComSujeito(s, verbo)
    ? verbo
    : verboSemEco(s, [...TRANSITIVOS], random);
  if (!verboEscolhido) return null;
  return { s, v: verboEscolhido, o: objetoDe(objeto), c: '' };
}

// Cena sem objeto direto: serve para qualquer verbo do catálogo e usa um
// complemento preposicional, que não exige informação de regência.
function cenaPreposicional(random, {tema, sujeito = null, verbo = null} = {}) {
  const sujeitoEscolhido = sujeito || escolherDoTema(tema, random);
  if (!sujeitoEscolhido) return null;
  const preposicao = escolhe(PREPOSICOES, random);
  let alvo = escolherDoTema(tema, random);
  if (!alvo) return null;
  let tentativas = 0;
  while (alvo.nome === sujeitoEscolhido.nome && tentativas++ < 8) {
    alvo = escolherDoTema(tema, random);
  }
  if (alvo.nome === sujeitoEscolhido.nome) return null;
  const s = comArtigo(sujeitoEscolhido, true);
  const verboEscolhido = verbo && !colideComSujeito(s, verbo)
    ? verbo
    : verboSemEco(s, [...catalogo().verbos], random);
  if (!verboEscolhido) return null;
  return {
    s,
    v: verboEscolhido,
    o: null,
    c: complementoDe(preposicao, alvo),
  };
}

function cenaNome(nome, random, {tema}) {
  const usaObjeto = random() < 0.6;
  if (usaObjeto) {
    const objeto = escolherDoTema(tema, random);
    if (!objeto) return null;
    const verbo = verboSemEco(nome, [...TRANSITIVOS], random);
    if (!verbo) return null;
    return { s: nome, v: verbo, o: objetoDe(objeto), c: '' };
  }
  const alvo = escolherDoTema(tema, random);
  if (!alvo) return null;
  const verbo = verboSemEco(nome, [...catalogo().verbos], random);
  if (!verbo) return null;
  return {
    s: nome,
    v: verbo,
    o: null,
    c: complementoDe(escolhe(PREPOSICOES, random), alvo),
  };
}

// Tema principal de uma palavra, para escolher em qual banco a cena entra.
function temaDaPalavra(palavra, fallback = 'cidade') {
  const temas = classificarTemas(palavra.split(/\s+/u)[0]);
  return temas.find(tema => TEMAS.includes(tema)) || fallback;
}

export function construirBancoDeCenas() {
  const random = sorteioDe(0x9e3779b9);
  const banco = Object.fromEntries(TEMAS.map(tema => [tema, []]));
  const nomes = nomesProprios();
  const adicionar = (tema, cena) => {
    if (cena) banco[tema].push(cena);
  };

  // 1. Estruturas antigas: cada padrão de cada tema vira uma cena com
  // substantivos, adjetivos e verbo do vocabulário.
  for (const tema of TEMAS) {
    for (const padrao of PADROES[tema] || []) {
      adicionar(tema, cenaDoPadrao(padrao, tema, random));
    }
  }

  // 2. Objeto direto para cada verbo transitivo curado.
  for (const verbo of TRANSITIVOS) {
    const tema = escolhe(TEMAS, random);
    adicionar(tema, cenaTransitiva(random, {tema, verbo}));
  }

  // 3. Cena preposicional para cada verbo do catálogo, no assunto sorteado.
  for (const verbo of catalogo().verbos) {
    const tema = escolhe(TEMAS, random);
    adicionar(tema, cenaPreposicional(random, {tema, verbo}));
  }

  // 4. Cobertura do léxico curado: todo substantivo aparece como sujeito.
  for (const chave of Object.keys(SUBSTANTIVOS)) {
    const sujeito = item(chave, generoDoLema(chave));
    if (!sujeito) continue;
    const tema = temaDaPalavra(chave);
    adicionar(tema, cenaPreposicional(random, {tema, sujeito}));
  }

  // 5. Toda variante curada aparece como objeto de um verbo transitivo. O
  // gênero vem da chave: o léxico garante que a variante mantém o mesmo.
  for (const [chave, variantes] of Object.entries(SUBSTANTIVOS)) {
    const genero = generoDoLema(chave);
    for (const variante of variantes) {
      const objeto = item(variante, genero);
      if (!objeto) continue;
      const tema = temaDaPalavra(variante);
      const sujeito = escolherDoTema(tema, random);
      if (!sujeito || sujeito.nome === objeto.nome) continue;
      const s = comArtigo(sujeito, true);
      const verbo = verboSemEco(s, [...TRANSITIVOS], random);
      if (!verbo) continue;
      adicionar(tema, {s, v: verbo, o: objetoDe(objeto), c: ''});
    }
  }

  // 6. Pares de mesmo sujeito para a elipse do sujeito. Cada tema ganha pares
  // de verbos do léxico curado, sem verbo fixo. O motor acha o par pela
  // igualdade do sujeito e cala o ator repetido.
  for (const tema of TEMAS) {
    for (let i = 0; i < 6; i++) {
      const sujeito = escolherDoTema(tema, random)
        || item(escolhe(Object.keys(SUBSTANTIVOS), random), null);
      if (!sujeito) continue;
      const doTema = transitivosDoTema(tema);
      const lista = doTema.length >= 2 ? doTema : [...TRANSITIVOS];
      if (lista.length < 2) continue;
      const s = comArtigo(sujeito, true);
      const escolhidos = new Set();
      for (let tentativa = 0; tentativa < 24 && escolhidos.size < 2; tentativa++) {
        const verbo = escolhe(lista, random);
        if (colideComSujeito(s, verbo)) continue;
        escolhidos.add(verbo);
      }
      for (const verbo of escolhidos) {
        const objeto = escolherDoTema(tema, random);
        if (!objeto) continue;
        adicionar(tema, {s, v: verbo, o: objetoDe(objeto), c: ''});
      }
    }
  }

  // 7. Nomes próprios como falantes, com objeto e sem objeto.
  const falantes = nomes.length ? nomes : ['Fulano'];
  for (const tema of TEMAS) {
    for (let i = 0; i < 4; i++) {
      const nome = escolhe(falantes, random);
      adicionar(tema, cenaNome(nome, random, {tema}));
    }
  }

  // 8. Todo substantivo comum do catálogo entra como sujeito em alguma cena,
  // para o banco não depender só do léxico curado.
  for (const [nome, genero] of catalogo().substantivos) {
    const sujeito = {nome, genero, plural: ehPlural(nome)};
    const tema = temaDaPalavra(nome, escolhe(TEMAS, random));
    adicionar(tema, cenaPreposicional(random, {tema, sujeito}));
  }

  // 9. Varredura dos temas para garantir verbo, sujeito e complemento de cada
  // assunto mesmo quando o catálogo tem poucas palavras etiquetadas.
  for (const tema of TEMAS) {
    for (let i = 0; i < 40; i++) {
      adicionar(tema, cenaPreposicional(random, {tema}));
      adicionar(tema, cenaTransitiva(random, {tema}));
    }
  }

  return banco;
}

export {TEMAS as TEMAS_DAS_CENAS, comArtigo, contrair, ehPlural, pluralizar};
