// Gerador de textos em português com concordância explícita.
// As cenas são montadas a partir do catálogo de vocabulário do jogo; este
// arquivo guarda só a estrutura gramatical (tempo, voz, conectores, adjuntos).
import { conjugarVerbo, classificarTemas } from './vocabulario.js';
import { SUBSTANTIVOS, VERBOS_TRANSITIVOS } from './lexico_sinonimos.js';
import { construirBancoDeCenas } from './cenas_do_vocabulario.js';

const TEMAS = [
  'politica', 'cidade', 'trabalho', 'economia', 'moradia', 'familia',
  'alimentacao', 'saude', 'mobilidade', 'educacao_cultura',
  'seguranca_justica', 'meio_ambiente', 'substancias', 'moda',
  'esportes_lazer', 'cotidiano',
];

const ALIASES = new Map(Object.entries({
  arte: 'educacao_cultura',
  cultura: 'educacao_cultura',
  educacao: 'educacao_cultura',
  emprego: 'trabalho',
  habitacao: 'moradia',
  aluguel: 'moradia',
  saude: 'saude',
  health: 'saude',
  alimentacao: 'alimentacao',
  transporte: 'mobilidade',
  justica: 'seguranca_justica',
  seguranca: 'seguranca_justica',
  ambiente: 'meio_ambiente',
  natureza: 'meio_ambiente',
  substancia: 'substancias',
  esporte: 'esportes_lazer',
  esportes: 'esportes_lazer',
  lazer: 'esportes_lazer',
  familia: 'familia',
  cotidiano: 'cotidiano',
  moda: 'moda',
  cidade: 'cidade',
  economia: 'economia',
  politica: 'politica',
}));

const TEMA_FRASE = {
  politica: 'a política',
  cidade: 'a cidade',
  trabalho: 'o trabalho',
  economia: 'a economia',
  moradia: 'a moradia',
  familia: 'a família',
  alimentacao: 'a alimentação',
  saude: 'a saúde',
  mobilidade: 'a mobilidade',
  educacao_cultura: 'a educação e a cultura',
  seguranca_justica: 'a segurança e a justiça',
  meio_ambiente: 'o meio ambiente',
  substancias: 'o uso de substâncias',
  moda: 'a moda',
  esportes_lazer: 'o esporte e o lazer',
  cotidiano: 'o cotidiano',
};

const normalizar = value =>
  String(value ?? '').trim().toLocaleLowerCase('pt-BR')
    .normalize('NFD').replace(/[\u0300-\u036f]/gu, '');

const escolhe = (list, random) => {
  const bruto = Math.floor(Math.max(0, Math.min(0.999999999, random())) * 4294967296) >>> 0;
  let misturado = Math.imul(bruto ^ (bruto >>> 16), 2246822507) >>> 0;
  misturado = Math.imul(misturado ^ (misturado >>> 13), 3266489909) >>> 0;
  misturado = (misturado ^ (misturado >>> 16)) >>> 0;
  return list[Math.floor((misturado / 4294967296) * list.length)];
};

const capitalizar = text =>
  text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1);

const minusculaInicial = text =>
  text.charAt(0).toLocaleLowerCase('pt-BR') + text.slice(1);

// Nome próprio no começo da oração mantém a maiúscula; artigo e pronome
// inicial continuam sendo rebaixados quando a oração entra depois de vírgula.
const minusculaInicialSegura = text =>
  /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+$/u.test(text.split(/\s+/u)[0])
    ? text
    : minusculaInicial(text);

// O banco de cenas é montado a partir do catálogo de js/vocabulario.js.
// Não há frase pronta: só estrutura gramatical e palavras do vocabulário.
// A montagem é preguiçosa porque js/vocabulario.js importa este módulo: com o
// catálogo ainda em inicialização, ler `vocabulario` agora falharia.
let bancoDeCenas = null;
const bancoAtual = () => (bancoDeCenas ||= construirBancoDeCenas());
export const CENAS = new Proxy({}, {
  get: (_, chave) => bancoAtual()[chave],
  has: (_, chave) => chave in bancoAtual(),
  ownKeys: () => Reflect.ownKeys(bancoAtual()),
  getOwnPropertyDescriptor: (_, chave) => {
    const descritor = Object.getOwnPropertyDescriptor(bancoAtual(), chave);
    return descritor ? {...descritor, configurable: true} : undefined;
  },
});
const ADVERBIOS = [
  'de fato', 'aos poucos', 'em geral', 'muitas vezes',
  'cada vez mais', 'quase sempre', 'na prática', 'de imediato',
  'por enquanto', 'a médio prazo', 'em conjunto', 'pouco a pouco',
];

const ADJUNTOS = {
  presente: ['neste momento', 'nesta semana', 'na gestão atual', 'todos os dias'],
  'pretérito-perfeito': ['na semana passada', 'no mês passado', 'durante a reunião'],
  'pretérito-imperfeito': ['naquela época', 'durante anos', 'todos os dias'],
  futuro: ['no próximo mês', 'em breve', 'até o fim do ano'],
  condicional: ['em outra situação', 'com mais recursos'],
  'subjuntivo-presente': ['agora', 'neste momento'],
};

const INTROS = [
  'Na prática', 'No bairro', 'Com o tempo', 'Segundo os moradores',
  'Do ponto de vista local', 'Na avaliação da comunidade', 'Ao longo do ano',
  'No dia a dia', 'Olhando de perto', 'Do lado de cá',
];

const PARTICIPIOS = {
  abrir: 'aberto', cobrir: 'coberto', descobrir: 'descoberto',
  escrever: 'escrito', descrever: 'descrito', dizer: 'dito',
  fazer: 'feito', ver: 'visto', vir: 'vindo', ir: 'ido', ser: 'sido',
  estar: 'estado', ter: 'tido', haver: 'havido', pôr: 'posto',
  propor: 'proposto', compor: 'composto', opor: 'oposto',
  dispor: 'disposto', supor: 'suposto', eleger: 'eleito',
  proteger: 'protegido', envolver: 'envolvido', resolver: 'resolvido',
};

// Um verbo aceita passiva quando é transitivo direto no léxico curado. A
// regência vem do léxico, não de uma frase pronta.
const TRANSITIVOS = new Set(Object.keys(VERBOS_TRANSITIVOS));
const PASSIVAVEIS = TRANSITIVOS;

// "Se" pronominal muda o sentido de alguns transitivos. Esta é a única lista
// de exceção da passiva sintética; o resto dos transitivos aceita a forma.
const NAO_PASSIVA_SE = new Set([
  'formar', 'ocupar', 'empregar', 'tratar', 'apresentar', 'reunir', 'sentir',
  'lembrar', 'esquecer', 'mudar', 'tornar', 'chamar', 'manter', 'dedicar',
]);

// Relações de discurso. Cada uma tem conectores próprios e, quando precisa,
// modo subjuntivo. O encadeamento não é sorteio puro: TRANSICOES define quais
// relações combinam com a anterior (causa pede consequência, concessão pede
// réplica), o que evita frases apenas justapostas.
const RELACOES = {
  adicao: { joiners: [' e ', '; ', ', e '] },
  oposicao: { joiners: [', mas ', ', porém, ', ', contudo, ', ', todavia, ', '; ainda assim, '] },
  causa: { joiners: [' porque ', ' já que ', ' pois '] },
  condicao: { joiners: [' se ', ' caso ', ' desde que ', ' antes que '], subjuntivo: true },
  concessao: { joiners: [' embora '], subjuntivo: true },
  tempo: { joiners: [' quando ', ' enquanto ', ' sempre que '], temporal: true },
  conclusao: { joiners: ['; por isso, ', ', por isso, ', ' e, por isso, '] },
  adicaoForte: { joiners: ['. Além disso, ', '. Ao mesmo tempo, '] },
};

const TRANSICOES = {
  afirmacao: ['oposicao', 'causa', 'adicao', 'condicao', 'adicaoForte', 'tempo'],
  adicao: ['oposicao', 'causa', 'condicao', 'tempo'],
  oposicao: ['causa', 'adicaoForte', 'adicao'],
  causa: ['conclusao', 'oposicao', 'adicao'],
  condicao: ['conclusao', 'oposicao', 'adicao'],
  concessao: ['oposicao'],
  tempo: ['oposicao', 'adicao'],
  conclusao: ['oposicao', 'adicaoForte'],
  adicaoForte: ['oposicao', 'causa'],
};

// Registro. As probabilidades mudam a voz, nunca a gramática.
const PERFIS = {
  auto: { passiva: 0.16, clivada: 0.10, passivaSe: 0.08, atribuicao: 0.04, frente: 0.20, inversao: 0.06, negacao: 0.08, adverbio: 0.18, adjunto: 0.35 },
  popular: { passiva: 0.01, clivada: 0, passivaSe: 0, atribuicao: 0, frente: 0.06, inversao: 0.03, negacao: 0.10, adverbio: 0.12, adjunto: 0.18 },
  jornal: { passiva: 0.18, clivada: 0.14, passivaSe: 0.18, atribuicao: 0.10, frente: 0.24, inversao: 0.05, negacao: 0.05, adverbio: 0.12, adjunto: 0.30 },
  oficial: { passiva: 0.30, clivada: 0.04, passivaSe: 0.22, atribuicao: 0.08, frente: 0.10, inversao: 0, negacao: 0.04, adverbio: 0.10, adjunto: 0.22 },
};

// Passiva sintética: todo transitivo direto, menos as exceções pronominais.
const PASSIVA_SE = new Set([...TRANSITIVOS].filter(verbo => !NAO_PASSIVA_SE.has(verbo)));

const DIZER = {
  singular: ['anunciou', 'informou', 'afirmou', 'confirmou', 'prometeu'],
  plural: ['anunciaram', 'informaram', 'afirmaram', 'confirmaram', 'prometeram'],
};

// Complemento iniciado por "de" quase sempre completa o objeto ("a meta do
// mês"), por isso não abre a oração. Só o adjunto locativo e temporal entra.
const ADJUNTO_FRONTAVEL = /^(?:em|no|na|nos|nas|ao|aos|à|às|pelo|pela|pelos|pelas|com|sem|sob|entre|durante|desde|após|antes|até)\b/iu;
const ADJUNTO_INVERSIVEL = /^(?:em|no|na|nos|nas)\b/iu;


const SLOGANS = {
  politica: [
    'Mais voz para o bairro.', 'Orçamento claro, cidade justa.',
    'Participação popular de verdade.', 'Promessa cumprida se constrói com trabalho.',
  ],
  cidade: [
    'Cidade boa é cidade cuidada.', 'Praça viva, bairro forte.',
    'Iluminação e calçada para todos.', 'Obras que chegam a quem precisa.',
  ],
  trabalho: [
    'Emprego digno muda a vida.', 'Salário justo, trabalho seguro.',
    'Qualificação para o futuro.', 'Nenhum trabalhador fica para trás.',
  ],
  economia: [
    'Contas claras, futuro possível.', 'Crédito para quem produz.',
    'Preço justo no mercado do bairro.', 'Renda que circula na comunidade.',
  ],
  moradia: [
    'Moradia digna é direito.', 'Casa popular com saneamento.',
    'Aluguel justo, família segura.', 'Regularização para quem mora.',
  ],
  familia: [
    'Família forte, bairro melhor.', 'Cuidado que começa em casa.',
    'Criança protegida, futuro garantido.', 'Tempo junto faz diferença.',
  ],
  alimentacao: [
    'Comida boa na mesa de todos.', 'Feira local, alimento fresco.',
    'Ninguém deve passar fome.', 'Da horta para o prato.',
  ],
  saude: [
    'Saúde perto de casa.', 'Posto aberto, atendimento humano.',
    'Vacinar é cuidar.', 'Mais médicos, menos fila.',
  ],
  mobilidade: [
    'Ônibus que respeita o passageiro.', 'Calçada segura para todos.',
    'Bicicleta com espaço na cidade.', 'Trânsito que funciona.',
  ],
  educacao_cultura: [
    'Escola pública de qualidade.', 'Cultura no bairro, livro na mão.',
    'Professor valorizado, aluno presente.', 'Arte que abre caminhos.',
  ],
  seguranca_justica: [
    'Segurança com respeito.', 'Justiça que chega ao bairro.',
    'Prevenção antes da violência.', 'Direito para quem mais precisa.',
  ],
  meio_ambiente: [
    'Cidade limpa, água viva.', 'Árvore plantada, sombra garantida.',
    'Reciclar começa em casa.', 'Rio limpo é compromisso.',
  ],
  substancias: [
    'Cuidado em vez de julgamento.', 'Prevenção salva vidas.',
    'Acolhimento para quem precisa.', 'Bebida com responsabilidade.',
  ],
  moda: [
    'Moda local, talento daqui.', 'Roupa boa dura mais.',
    'Costura que gera renda.', 'Estilo com consciência.',
  ],
  esportes_lazer: [
    'Esporte para todas as idades.', 'Praça cheia, cidade viva.',
    'Lazer perto de casa.', 'Jogo limpo, time unido.',
  ],
  cotidiano: [
    'O bairro funciona quando todos participam.', 'Vizinhança que se ajuda.',
    'Pequenos gestos mudam a rua.', 'Cidade boa é feita no dia a dia.',
  ],
};

const TITULOS = [
  'Praça', 'Janela', 'Muro', 'Céu', 'Mar', 'Sombra', 'Luz', 'Silêncio',
  'Tempo', 'Cidade', 'Bairro', 'Noite', 'Manhã', 'Cor', 'Linha', 'Pedra',
  'Água', 'Terra', 'Vento', 'Flor', 'Rosto', 'Gesto', 'Memória', 'Desejo',
  'Horizonte', 'Caminho', 'Encontro', 'Ruído', 'Espelho', 'Raiz', 'Ponte',
  'Quintal', 'Telhado', 'Esquina', 'Feira', 'Rua', 'Voz', 'Sinal', 'Passagem',
  'Árvore', 'Areia', 'Chuva', 'Fogo', 'Sombra', 'Poeira', 'Fresta', 'Varanda',
];

const MODIFICADORES = [
  'sem nome', 'de concreto', 'ao amanhecer', 'sob a chuva', 'em movimento',
  'da periferia', 'azul', 'possível', 'interior', 'na janela', 'depois da feira',
  'antes da noite', 'entre muros', 'sobre telhas', 'de terra e vento',
];

function temasResolvidos(tema) {
  const brutos = Array.isArray(tema) ? tema : [tema || 'cotidiano'];
  const chaves = brutos.map(normalizar);
  const temas = [...new Set(chaves.map(chave => ALIASES.get(chave) || chave))];
  if (!temas.length || temas.some(item => !CENAS[item])) {
    throw new RangeError(`Tema desconhecido: ${tema}`);
  }
  return temas;
}

function sujeitoPlural(sujeito) {
  return /^(os|as|uns|umas|alguns|algumas|muitos|muitas|dois|duas)\b/iu.test(sujeito)
    || /\s+e\s+/u.test(sujeito);
}

function artigoPlural(artigo) {
  return ['os', 'as', 'uns', 'umas'].includes(artigo);
}

function objetoFrase(objeto) {
  return `${objeto.d} ${objeto.n}`;
}

function pluralizar(palavra) {
  if (/m$/u.test(palavra)) return palavra.slice(0, -1) + 'ns';
  if (/[rz]$/u.test(palavra)) return palavra + 'es';
  if (/ão$/u.test(palavra)) return palavra.slice(0, -2) + 'ões';
  if (/[aeou]l$/u.test(palavra)) return palavra.slice(0, -1) + 'is';
  if (/il$/u.test(palavra)) return palavra.slice(0, -1) + 's';
  return palavra + 's';
}

function participioConcordante(verbo, genero, plural) {
  let forma = PARTICIPIOS[verbo] || conjugarVerbo(verbo, { tempo: 'participio' }) || `${verbo}ado`;
  if (genero === 'f' && /o$/u.test(forma)) forma = forma.slice(0, -1) + 'a';
  return plural ? pluralizar(forma) : forma;
}

function agenteContraido(sujeito) {
  const partes = sujeito.match(/^(A|O|As|Os|Um|Uma|Uns|Umas)\s+(.*)$/u);
  if (!partes) return `por ${minusculaInicial(sujeito)}`;
  const mapa = {
    A: 'pela', O: 'pelo', As: 'pelas', Os: 'pelos',
    Um: 'por um', Uma: 'por uma', Uns: 'por uns', Umas: 'por umas',
  };
  return `${mapa[partes[1]]} ${partes[2]}`;
}

function escolherTempo(level, random) {
  const rolagem = random();
  if (level === 'simples') {
    if (rolagem < 0.7) return 'presente';
    if (rolagem < 0.9) return 'pretérito-perfeito';
    return 'pretérito-imperfeito';
  }
  if (level === 'complexa') {
    if (rolagem < 0.24) return 'presente';
    if (rolagem < 0.44) return 'pretérito-perfeito';
    if (rolagem < 0.6) return 'pretérito-imperfeito';
    if (rolagem < 0.78) return 'futuro';
    return 'condicional';
  }
  if (rolagem < 0.4) return 'presente';
  if (rolagem < 0.62) return 'pretérito-perfeito';
  if (rolagem < 0.75) return 'pretérito-imperfeito';
  if (rolagem < 0.9) return 'futuro';
  return 'condicional';
}

function conjugar(verbo, tempo, plural) {
  const forma = conjugarVerbo(verbo, {
    tempo,
    pessoa: 3,
    numero: plural ? 'plural' : 'singular',
  });
  return forma || verbo;
}

function conjugarFuturoSubjuntivo(verbo, plural) {
  const perfeito = conjugarVerbo(verbo, { tempo: 'pretérito-perfeito', pessoa: 6 });
  if (!perfeito || !perfeito.endsWith('am')) return conjugar(verbo, 'subjuntivo-presente', plural);
  const base = perfeito.slice(0, -2);
  if (plural) return `${base}em`;
  return /(?:air|uir)$/u.test(verbo) ? base.replace(/í/u, 'i') : base;
}

function porFrase(frase) {
  const partes = frase.match(/^(a|o|as|os)\s+(.*)$/u);
  if (!partes) return `por ${frase}`;
  return `${{ a: 'pela', o: 'pelo', as: 'pelas', os: 'pelos' }[partes[1]]} ${partes[2]}`;
}

function deFrase(frase) {
  const partes = frase.match(/^(a|o|as|os)\s+(.*)$/u);
  if (!partes) return `de ${frase}`;
  return `${{ a: 'da', o: 'do', as: 'das', os: 'dos' }[partes[1]]} ${partes[2]}`;
}

function emFrase(frase) {
  const partes = frase.match(/^(a|o|as|os)\s+(.*)$/u);
  if (!partes) return `em ${frase}`;
  return `${{ a: 'na', o: 'no', as: 'nas', os: 'nos' }[partes[1]]} ${partes[2]}`;
}

// Atribuição de fala só combina com ator que pode falar. Em vez de uma lista
// fixa de sujeitos, a decisão usa o próprio vocabulário: nome próprio sempre
// fala; substantivo de assunto político, trabalhista ou de justiça pode falar
// como instituição ("a prefeitura anunciou"). Os demais ficam na voz direta.
const CACHE_FALANTE = new Map();
function podeFalar(sujeito) {
  if (CACHE_FALANTE.has(sujeito)) return CACHE_FALANTE.get(sujeito);
  let resposta = /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+$/u.test(sujeito);
  if (!resposta) {
    const nucleo = sujeito.replace(/^(?:A|O|As|Os|Um|Uma|Uns|Umas)\s+/u, '').split(/\s+/u)[0];
    const temas = classificarTemas(nucleo);
    resposta = temas.includes('politica') || temas.includes('trabalho')
      || temas.includes('seguranca_justica');
  }
  CACHE_FALANTE.set(sujeito, resposta);
  return resposta;
}

// Evita repetir no adjunto uma palavra já usada no objeto ou no complemento:
// "investir mais recursos ... com mais recursos".
function adjuntoDoTempo(cena, tempo, random) {
  const opcoes = ADJUNTOS[tempo] || ADJUNTOS.presente;
  const ocupado = `${cena.o ? objetoFrase(cena.o) : ''} ${cena.c || ''}`.toLocaleLowerCase('pt-BR');
  const palavrasOcupadas = new Set(ocupado.split(/\s+/u).filter(palavra => palavra.length > 3));
  const livres = opcoes.filter(opcao => !opcao.toLocaleLowerCase('pt-BR')
    .split(/\s+/u)
    .some(palavra => palavra.length > 3 && palavrasOcupadas.has(palavra)));
  return livres.length ? escolhe(livres, random) : null;
}

function montarOracao(cena, random, {
  level = 'variada', subjuntivo = false, modoSubjuntivo = 'presente',
  tempoFixo = null, permitirAdjunto = true, intro = false, estilo = 'auto',
  permitirPassiva = true, permitirFronteamento = true, meta = null,
} = {}) {
  const perfil = PERFIS[estilo] || PERFIS.auto;
  const plural = sujeitoPlural(cena.s);
  const tempo = tempoFixo || (subjuntivo ? (modoSubjuntivo === 'futuro' ? 'futuro-subjuntivo' : 'subjuntivo-presente') : escolherTempo(level, random));
  const passiva = permitirPassiva && Boolean(cena.o) && !subjuntivo && level !== 'simples'
    && PASSIVAVEIS.has(cena.v) && random() < perfil.passiva;
  const negacao = !subjuntivo && level !== 'simples' && random() < perfil.negacao ? 'não ' : '';
  const adverbio = !subjuntivo && level !== 'simples' && random() < perfil.adverbio
    ? `${escolhe(ADVERBIOS, random)} `
    : '';
  const adjuntoOpcao = permitirAdjunto && !subjuntivo && level !== 'simples' && random() < perfil.adjunto
    ? adjuntoDoTempo(cena, tempo, random)
    : null;
  const adjunto = adjuntoOpcao ? ` ${adjuntoOpcao}` : '';
  // Adjunto preposicional vai para a frente e rende outra ordem sintática:
  // "No conselho municipal, a prefeitura aprovou o orçamento".
  const frente = permitirFronteamento && !passiva && !intro && !subjuntivo
    && level !== 'simples' && permitirAdjunto && Boolean(cena.c)
    && ADJUNTO_FRONTAVEL.test(cena.c) && random() < perfil.frente;

  let oracao;
  if (passiva) {
    const objeto = cena.o;
    const objetoPlural = artigoPlural(objeto.d);
    const sujeito = objetoFrase(objeto);
    const auxiliar = conjugar('ser', tempo, objetoPlural);
    const participio = participioConcordante(cena.v, objeto.g, objetoPlural);
    const complemento = cena.c ? ` ${cena.c}` : '';
    oracao = `${sujeito} ${adverbio}${negacao}${auxiliar} ${participio} ${agenteContraido(cena.s)}${complemento}${adjunto}`;
  } else {
    const verbo = tempo === 'futuro-subjuntivo' ? conjugarFuturoSubjuntivo(cena.v, plural) : conjugar(cena.v, tempo, plural);
    const objeto = cena.o ? ` ${objetoFrase(cena.o)}` : '';
    const complemento = cena.c && !frente ? ` ${cena.c}` : '';
    oracao = `${cena.s} ${adverbio}${negacao}${verbo}${objeto}${complemento}${adjunto}`;
  }

  if (frente) oracao = `${minusculaInicial(cena.c)}, ${minusculaInicialSegura(oracao)}`;
  if (meta) Object.assign(meta, {
    tipo: passiva ? 'passiva' : 'ativa',
    tempo,
    sujeito: cena.s,
    frente,
  });
  if (!intro) return oracao;
  return `${escolhe(INTROS, random)}, ${minusculaInicial(oracao)}`;
}

// Remove o sujeito da oração para coordenar dois predicados com elipse:
// "A prefeitura reformou a praça e ampliou a ciclovia".
function semSujeito(oracao, sujeito) {
  return oracao.startsWith(`${sujeito} `) ? oracao.slice(sujeito.length + 1) : oracao;
}

// "Foi a prefeitura que reformou a praça": destaca o agente e muda a ordem.
function montarClivada(cena, random, opts) {
  const oracao = montarOracao(cena, random, {
    ...opts, intro: false, permitirPassiva: false, permitirFronteamento: false, meta: null,
  });
  const copula = sujeitoPlural(cena.s) ? 'Foram' : 'Foi';
  return `${copula} ${minusculaInicial(cena.s)} que ${semSujeito(oracao, cena.s)}`;
}

// Passiva sintética: "Reformou-se a praça". O verbo concorda com o paciente.
function montarPassivaSe(cena, random) {
  const tempo = escolhe(['presente', 'pretérito-perfeito', 'pretérito-imperfeito'], random);
  const plural = artigoPlural(cena.o.d);
  const verbo = conjugar(cena.v, tempo, plural);
  const complemento = cena.c ? ` ${cena.c}` : '';
  const adjuntoOpcao = random() < 0.22 ? adjuntoDoTempo(cena, tempo, random) : null;
  const adjunto = adjuntoOpcao ? ` ${adjuntoOpcao}` : '';
  return `${verbo}-se ${objetoFrase(cena.o)}${complemento}${adjunto}`;
}

// Atribuição de fala: "A prefeitura anunciou que vai reformar a praça".
function montarAtribuicao(cena, random) {
  const plural = sujeitoPlural(cena.s);
  const verboFala = escolhe(plural ? DIZER.plural : DIZER.singular, random);
  const auxiliar = plural ? 'vão' : 'vai';
  const complemento = cena.c ? ` ${cena.c}` : '';
  return `${cena.s} ${verboFala} que ${auxiliar} ${cena.v} ${objetoFrase(cena.o)}${complemento}`;
}

// Inversão locativa: "No parque, caminham os moradores".
function montarInversao(cena, random, opts) {
  const plural = sujeitoPlural(cena.s);
  const tempo = escolherTempo(opts.level || 'variada', random);
  const verbo = conjugar(cena.v, tempo, plural);
  return `${minusculaInicial(cena.c)}, ${verbo} ${minusculaInicial(cena.s)}`;
}

// Escolhe a construção sintática da primeira oração. As formas avançadas só
// entram em oração principal: depois de um conector elas soariam artificiais.
function realizarOracao(cena, random, opts = {}) {
  const perfil = PERFIS[opts.estilo] || PERFIS.auto;
  if ((opts.level || 'variada') === 'simples' || opts.subjuntivo) {
    return montarOracao(cena, random, opts);
  }
  const rolagem = random();
  const limiteClivada = perfil.clivada;
  const limiteSe = limiteClivada + perfil.passivaSe;
  const limiteAtribuicao = limiteSe + perfil.atribuicao;
  const limiteInversao = limiteAtribuicao + perfil.inversao;
  if (rolagem < limiteClivada) {
    if (opts.meta) opts.meta.tipo = 'clivada';
    return montarClivada(cena, random, opts);
  }
  if (rolagem < limiteSe && cena.o && PASSIVA_SE.has(cena.v)) {
    if (opts.meta) opts.meta.tipo = 'passiva-se';
    return montarPassivaSe(cena, random);
  }
  if (rolagem < limiteAtribuicao && cena.o) {
    // A atribuição exige ator que possa falar. Quando a cena sorteada não
    // serve, procura outra do mesmo tema em vez de perder a construção.
    const falante = podeFalar(cena.s)
      ? cena
      : (opts.cenas || []).find(outra => outra.o && podeFalar(outra.s));
    if (falante) {
      if (opts.meta) opts.meta.tipo = 'atribuicao';
      return montarAtribuicao(falante, random);
    }
  }
  if (rolagem < limiteInversao && !cena.o && cena.c && ADJUNTO_INVERSIVEL.test(cena.c)) {
    if (opts.meta) opts.meta.tipo = 'inversao';
    return montarInversao(cena, random, opts);
  }
  return montarOracao(cena, random, opts);
}

// Retomada por descrição definida, mantendo o artigo da cena:
// "A prefeitura ... A administração ...". Evita repetir o sujeito inteiro.
function retomadaDe(sujeito, random) {
  const partes = sujeito.match(/^(A|O|As|Os|Um|Uma|Uns|Umas)\s+(.+)$/u);
  if (!partes) return null;
  const opcoes = SUBSTANTIVOS[partes[2].split(' ')[0].toLocaleLowerCase('pt-BR')];
  if (!opcoes || !opcoes.length) return null;
  return `${partes[1]} ${escolhe(opcoes, random)}`;
}

function escolherRelacao(anterior, random, usadas) {
  const opcoes = TRANSICOES[anterior] || TRANSICOES.afirmacao;
  const disponiveis = opcoes.filter(relacao => !usadas.has(relacao));
  return escolhe(disponiveis.length ? disponiveis : opcoes, random);
}


function cenasDosTemas(temas) {
  return temas.flatMap(tema => CENAS[tema]);
}

// Troca a palavra-chave da cena por uma variante do léxico. No sujeito o
// núcleo é sempre o token seguinte ao artigo, então a busca não avança para o
// modificador preposicional ("O cinema de rua" não vira "O cinema de via").
// No objeto, a busca percorre os tokens porque o núcleo pode vir depois de um
// adjetivo ou de outro substantivo.
const PREPOSICOES_DO_SINTAGMA = new Set([
  'a', 'à', 'ao', 'aos', 'às', 'com', 'como', 'contra', 'de', 'do', 'da',
  'dos', 'das', 'desde', 'em', 'entre', 'na', 'nas', 'no', 'nos', 'para',
  'pel', 'pela', 'pelas', 'pelo', 'pelos', 'por', 'sem', 'sob', 'sobre',
]);

function trocarCabeca(tokens, inicio, random, limite = tokens.length) {
  for (let i = inicio; i < limite; i++) {
    const token = tokens[i];
    if (typeof token !== 'string') continue;
    if (PREPOSICOES_DO_SINTAGMA.has(token.toLocaleLowerCase('pt-BR'))) break;
    const opcoes = SUBSTANTIVOS[token.toLocaleLowerCase('pt-BR')];
    if (!opcoes) continue;
    const copia = tokens.slice();
    copia[i] = escolhe(opcoes, random);
    return removerRepeticoes(copia.join(' '));
  }
  return tokens.join(' ');
}

// Uma variante com modificador pode repetir a palavra seguinte da cena:
// "programas sociais" -> "benefícios sociais sociais". Remove só a repetição
// imediatamente vizinha, sem mexer no resto do sintagma.
function removerRepeticoes(texto) {
  const palavras = texto.split(' ');
  const saida = [];
  for (const palavra of palavras) {
    if (saida.length
      && saida[saida.length - 1].toLocaleLowerCase('pt-BR') === palavra.toLocaleLowerCase('pt-BR')) continue;
    saida.push(palavra);
  }
  return saida.join(' ');
}

// Aplica uma variante por campo, com chance independente. O verbo só troca em
// cena com objeto direto: a lista é de transitivos diretos.
function aplicarVariantes(cena, random) {
  const sujeito = random() < 0.5
    ? trocarCabeca(cena.s.split(' '), 1, random, 2)
    : cena.s;
  const verbo = cena.o && VERBOS_TRANSITIVOS[cena.v] && random() < 0.45
    ? escolhe(VERBOS_TRANSITIVOS[cena.v], random)
    : cena.v;
  const objeto = cena.o && random() < 0.4
    ? { ...cena.o, n: trocarCabeca(cena.o.n.split(' '), 0, random) }
    : cena.o;
  return { s: sujeito, v: verbo, o: objeto, c: cena.c };
}

// Palavras de conteúdo servem para não repetir o mesmo substantivo em duas
// orações: "o trânsito mudou ... o crescimento do trânsito".
const PALAVRAS_FUNCIONAIS = new Set([
  'para', 'pelo', 'pela', 'pelos', 'pelas', 'com', 'sem', 'entre', 'durante',
  'desde', 'após', 'antes', 'sobre', 'mais', 'menos', 'todos', 'todas',
  'cada', 'muito', 'muita', 'muitos', 'muitas', 'outro', 'outra', 'outros',
  'outras', 'novo', 'nova', 'novos', 'novas', 'local', 'locais', 'atual',
  'atuais', 'central', 'centrais', 'público', 'pública', 'públicos',
  'públicas', 'popular', 'populares', 'comunitário', 'comunitária',
  'comunitários', 'comunitárias', 'municipal', 'municipais', 'estadual',
  'estaduais', 'federal', 'federais', 'grande', 'grandes', 'pequeno',
  'pequena', 'pequenos', 'pequenas', 'melhor', 'melhores', 'pior', 'piores',
]);

function palavrasConteudo(cena) {
  const texto = `${cena.s} ${cena.o ? `${cena.o.d} ${cena.o.n}` : ''} ${cena.c || ''}`;
  return new Set(texto
    .toLocaleLowerCase('pt-BR')
    .split(/[^\p{L}\p{N}-]+/u)
    .filter(palavra => palavra.length > 4 && !PALAVRAS_FUNCIONAIS.has(palavra)));
}

function cenaDoMesmoSujeito(cenas, sujeitoBase, usadas, random) {
  const opcoes = cenas.filter(cena => cena.s === sujeitoBase && !usadas.has(cena));
  return opcoes.length ? escolhe(opcoes, random) : null;
}

// Em oposição e concessão, outro ator rende mais sentido que o mesmo. Em
// qualquer relação, evita repetir palavra de conteúdo da cena anterior.
function escolherCenaParaRelacao(cenas, usadas, relacao, baseAtual, random) {
  const livres = cenas.filter(cena => !usadas.has(cena));
  let pool = livres.length ? livres : cenas;
  const anteriores = palavrasConteudo(baseAtual);
  const semRepeticao = pool.filter(cena =>
    ![...palavrasConteudo(cena)].some(palavra => anteriores.has(palavra)));
  if (semRepeticao.length) pool = semRepeticao;
  if ((relacao === 'oposicao' || relacao === 'concessao') && pool.length > 1) {
    const opostas = pool.filter(cena => cena.s !== baseAtual.s);
    if (opostas.length) return escolhe(opostas, random);
  }
  return escolhe(pool, random);
}

export function gerarFrase({ tema = null, random = Math.random, complexidade = 'variada', estilo = 'auto', alvo = null } = {}) {
  if (typeof random !== 'function') throw new TypeError('random precisa ser uma função');
  if (!PERFIS[estilo]) throw new RangeError(`Estilo desconhecido: ${estilo}`);
  const temas = temasResolvidos(tema);
  const cenas = cenasDosTemas(temas);
  if (!cenas.length) throw new RangeError(`Os temas ${temas.join(', ')} não têm cenas suficientes`);
  const level = complexidade === 'simples' ? 'simples' : complexidade === 'complexa' ? 'complexa' : 'variada';
  const usadas = new Set();
  const relacoesUsadas = new Set();

  const alvoLimpo = typeof alvo === 'string' ? alvo.trim().replace(/\s+/gu, ' ').slice(0, 56) : '';
  let primeiraBase = escolhe(cenas, random);
  // O alvo entra como sujeito da primeira oração, sem artigo: nome de pessoa,
  // partido ou apelido. O resto da cena (verbo, objeto, complemento) continua
  // vindo do vocabulário.
  if (alvoLimpo) primeiraBase = {...primeiraBase, s: alvoLimpo};
  usadas.add(primeiraBase);
  const primeira = aplicarVariantes(primeiraBase, random);
  const meta = {};
  let frase = realizarOracao(primeira, random, {
    level, estilo, meta, cenas,
    intro: level !== 'simples' && random() < 0.08,
  });
  let baseAtual = primeiraBase;
  let sujeitoAtual = meta.sujeito || primeira.s;
  let tempoAtual = meta.tempo || null;
  let podeElidir = meta.tipo === 'ativa' && Boolean(tempoAtual);
  let relacaoAnterior = 'afirmacao';

  const extras = level === 'simples' ? 0 : level === 'complexa' ? (random() < 0.45 ? 2 : 1) : (random() < 0.55 ? 1 : 0);
  for (let i = 0; i < extras; i++) {
    const relacao = escolherRelacao(relacaoAnterior, random, relacoesUsadas);
    relacoesUsadas.add(relacao);
    relacaoAnterior = relacao;

    // Mesmo ator: coordena os predicados e cala o sujeito repetido.
    if (relacao === 'adicao' && podeElidir && tempoAtual && random() < 0.6) {
      const parBase = cenaDoMesmoSujeito(cenas, baseAtual.s, usadas, random);
      if (parBase) {
        usadas.add(parBase);
        const par = aplicarVariantes(parBase, random);
        const oracao = montarOracao({ ...par, s: sujeitoAtual }, random, {
          level, estilo, tempoFixo: tempoAtual,
          permitirPassiva: false, permitirFronteamento: false, permitirAdjunto: false,
        });
        frase += ` e ${minusculaInicial(semSujeito(oracao, sujeitoAtual))}`;
        baseAtual = parBase;
        podeElidir = true;
        continue;
      }
    }

    const grupo = RELACOES[relacao];
    let conector = escolhe(grupo.joiners, random);
    // Sem tempo conhecido (clivada, atribuição, inversão), "ao mesmo tempo"
    // não tem com o que concordar; a adição simples serve melhor.
    if (conector === '. Ao mesmo tempo, ' && !tempoAtual) conector = '. Além disso, ';
    const base = escolherCenaParaRelacao(cenas, usadas, relacao, baseAtual, random);
    usadas.add(base);
    let cena = aplicarVariantes(base, random);

    // O ator volta: retoma por descrição definida em vez de repetir o nome.
    if (base.s === baseAtual.s && relacao !== 'adicao' && random() < 0.5) {
      const retomada = retomadaDe(sujeitoAtual, random);
      if (retomada) cena = { ...cena, s: retomada };
    }

    let subjuntivo = Boolean(grupo.subjuntivo);
    let modoSubjuntivo = 'presente';
    let tempoFixo = null;
    if (grupo.subjuntivo) modoSubjuntivo = conector === ' se ' ? 'futuro' : 'presente';
    if (grupo.temporal) {
      if (conector === ' enquanto ') {
        subjuntivo = false;
        tempoFixo = 'presente';
      } else {
        subjuntivo = true;
        modoSubjuntivo = 'futuro';
      }
    }

    // "Ao mesmo tempo" exige simultaneidade: a oração herda o tempo da
    // anterior em vez de sortear outro.
    if (conector === '. Ao mesmo tempo, ' && tempoAtual && !tempoAtual.includes('subjuntivo')) {
      subjuntivo = false;
      tempoFixo = tempoAtual;
    }

    const metaExtra = {};
    const oracao = montarOracao(cena, random, {
      level, estilo, subjuntivo, modoSubjuntivo, tempoFixo, meta: metaExtra,
      permitirAdjunto: false,
    });
    frase += `${conector}${minusculaInicial(oracao)}`;
    baseAtual = base;
    sujeitoAtual = cena.s;
    tempoAtual = metaExtra.tempo || tempoFixo;
    podeElidir = metaExtra.tipo === 'ativa' && !subjuntivo && Boolean(tempoAtual);
  }

  return `${capitalizar(frase)}.`;
}

export function gerarFraseTematica(tema, { random = Math.random, complexidade = 'variada', estilo = 'auto', alvo = null } = {}) {
  if (!tema) throw new RangeError(`Tema desconhecido: ${tema}`);
  temasResolvidos(tema);
  return gerarFrase({ tema, random, complexidade, estilo, alvo });
}

export function gerarTituloTematico(tema = 'arte', { random = Math.random } = {}) {
  if (typeof random !== 'function') throw new TypeError('random precisa ser uma função');
  temasResolvidos(tema);
  const primeiro = escolhe(TITULOS, random);
  const rolagem = random();
  if (rolagem < 0.24) return primeiro;
  if (rolagem < 0.58) return `${primeiro} ${escolhe(MODIFICADORES, random)}`;
  if (rolagem < 0.82) {
    let segundo = escolhe(TITULOS, random);
    if (segundo === primeiro) segundo = escolhe(TITULOS, random);
    return `${primeiro} · ${segundo}`;
  }
  return `${primeiro} ${escolhe(MODIFICADORES, random)}`;
}

export function gerarSloganPartidario({ random = Math.random } = {}) {
  if (typeof random !== 'function') throw new TypeError('random precisa ser uma função');
  const tema = escolhe(TEMAS, random);
  return escolhe(SLOGANS[tema], random);
}

export function gerarDialogoTematico(tema, {
  random = Math.random,
  perguntaAnterior = null,
  interlocutor = 'a outra candidatura',
  assunto = null,
  complexidade = 'complexa',
} = {}) {
  if (typeof random !== 'function') throw new TypeError('random precisa ser uma função');
  const temas = temasResolvidos(tema);
  const assuntoFrase = assunto || TEMA_FRASE[temas[0]] || 'o tema';
  const semente = gerarFrase({ tema: temas, random, complexidade: 'simples' }).replace(/[.!?]+$/u, '');
  const detalhe = gerarFrase({ tema: temas, random, complexidade: 'simples' }).replace(/[.!?]+$/u, '');
  const sementeMin = minusculaInicial(semente);
  const detalheMin = minusculaInicial(detalhe);
  const perguntas = [
    `Como ${interlocutor} pretende responder ${porFrase(assuntoFrase)}, quando ${sementeMin}?`,
    `Que proposta concreta ${interlocutor} apresenta para ${assuntoFrase}?`,
    `${interlocutor}, o que muda para os moradores quando ${sementeMin}?`,
    `Onde começa e onde termina a responsabilidade ${deFrase(interlocutor)} ${porFrase(assuntoFrase)}?`,
    `Se ${sementeMin}, que decisão ${interlocutor} tomaria primeiro sobre ${assuntoFrase}?`,
    `O que ${interlocutor} faria diante do fato de que ${sementeMin}?`,
    `${interlocutor}, como ${assuntoFrase} se relaciona com o fato de que ${sementeMin}?`,
    `Que evidência sustenta a proposta ${deFrase(interlocutor)} para ${assuntoFrase}?`,
  ];
  const respostas = [
    `Sobre “${semente}”, minha resposta é direta: ${detalheMin}.`,
    `A pergunta toca ${emFrase(assuntoFrase)}. Primeiro, ${sementeMin}. Depois, ${detalheMin}.`,
    `Não vou fugir do tema: ${sementeMin}. Além disso, ${detalheMin}.`,
    `Há duas partes nessa pergunta. A primeira é ${assuntoFrase}; a segunda aparece quando ${sementeMin}.`,
    `Concordo com a preocupação, mas proponho olhar também para isto: ${sementeMin}. E ainda: ${detalheMin}.`,
    `O ponto central é a consequência para a vida comum. ${semente}; ao mesmo tempo, ${detalheMin}.`,
    `Minha resposta não cabe num slogan: ${sementeMin}. Se levarmos a pergunta a sério, ${detalheMin}.`,
    `Vejo o problema assim: ${sementeMin}. A solução começa quando ${detalheMin}.`,
  ];
  const pergunta = perguntaAnterior || capitalizar(escolhe(perguntas, random));
  return {
    question: pergunta,
    answer: escolhe(respostas, random),
    generated: [semente, detalhe],
    theme: temas[0],
  };
}

// Aquece o banco de cenas no startup (após a carga circular de vocabulario.js)
// para evitar o engasgo de ~1s na primeira frase ou pichação durante o jogo.
export function aquecerCatalogos() { bancoAtual(); }
