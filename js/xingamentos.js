// Xingamentos políticos, de conduta e palavrões para pichações e discussões.
//
// O repertório é curado e não inclui ataques a grupos protegidos: não entram
// slurs raciais, homofóbicos, transfóbicos, capacitistas, gordofóbicos ou de
// gênero. Discurso de ódio não é gerado por este módulo. O jogo o representa
// por categoria (prejudiceType) e o sistema de justiça aplica o crime
// correspondente a partir de PREJUDICE_CRIME_TYPES.
import {PREJUDICE_CRIME_TYPES} from './city_prejudice.js?v=discrimination-laws-1';
import {ofensasDaCategoria} from './xingamentos_preconceito.js';

const entrada = (id, m, f, tipos, generoFixo = null) => Object.freeze({
  id,
  m,
  f,
  tipos: Object.freeze(tipos),
  generoFixo,
});

// `generoFixo` existe para substantivos de gênero fixo: "o lixo", "a bosta".
// Quando é null, o artigo e o possessivo seguem o gênero do alvo.
export const XINGAMENTOS = Object.freeze([
  // Conduta, crime e violência.
  entrada('ladrao', 'ladrão', 'ladra', ['conduta', 'politica', 'eleitoral']),
  entrada('corrupto', 'corrupto', 'corrupta', ['conduta', 'politica']),
  entrada('bandido', 'bandido', 'bandida', ['conduta', 'violencia']),
  entrada('assassino', 'assassino', 'assassina', ['violencia']),
  entrada('criminoso', 'criminoso', 'criminosa', ['violencia']),
  entrada('delinquente', 'delinquente', 'delinquente', ['conduta', 'violencia']),
  entrada('meliante', 'meliante', 'meliante', ['conduta', 'violencia']),
  entrada('mentiroso', 'mentiroso', 'mentirosa', ['conduta', 'eleitoral']),
  entrada('safado', 'safado', 'safada', ['carater']),
  entrada('canalha', 'canalha', 'canalha', ['carater']),
  entrada('pilantra', 'pilantra', 'pilantra', ['carater']),
  entrada('sem-vergonha', 'sem-vergonha', 'sem-vergonha', ['carater']),
  entrada('vigarista', 'vigarista', 'vigarista', ['conduta']),
  entrada('estelionatario', 'estelionatário', 'estelionatária', ['conduta']),
  entrada('traidor', 'traidor', 'traidora', ['carater', 'eleitoral']),
  entrada('vendido', 'vendido', 'vendida', ['politica', 'eleitoral']),
  entrada('lacaio', 'lacaio', 'lacaia', ['politica']),
  entrada('marionete', 'marionete', 'marionete', ['politica']),
  entrada('fantoche', 'fantoche', 'fantoche', ['politica']),
  entrada('boneco', 'boneco', 'boneca', ['politica']),
  entrada('testa-de-ferro', 'testa de ferro', 'testa de ferro', ['politica', 'conduta']),
  entrada('aproveitador', 'aproveitador', 'aproveitadora', ['carater']),
  entrada('sanguessuga', 'sanguessuga', 'sanguessuga', ['carater']),
  entrada('parasita', 'parasita', 'parasita', ['carater']),
  entrada('chupim', 'chupim', 'chupim', ['carater']),
  entrada('encostado', 'encostado', 'encostada', ['carater']),
  entrada('vagabundo', 'vagabundo', 'vagabunda', ['carater', 'conduta']),
  entrada('preguicoso', 'preguiçoso', 'preguiçosa', ['carater']),
  entrada('irresponsavel', 'irresponsável', 'irresponsável', ['conduta']),
  entrada('trapaceiro', 'trapaceiro', 'trapaceira', ['conduta']),
  entrada('trambiqueiro', 'trambiqueiro', 'trambiqueira', ['conduta']),
  entrada('embusteiro', 'embusteiro', 'embusteira', ['conduta']),
  entrada('charlatao', 'charlatão', 'charlatã', ['conduta']),
  entrada('enganador', 'enganador', 'enganadora', ['conduta']),
  entrada('desonesto', 'desonesto', 'desonesta', ['carater']),
  entrada('caluniador', 'caluniador', 'caluniadora', ['conduta']),
  entrada('difamador', 'difamador', 'difamadora', ['conduta']),
  entrada('manipulador', 'manipulador', 'manipuladora', ['carater']),
  entrada('chantagista', 'chantagista', 'chantagista', ['conduta']),
  entrada('contrabandista', 'contrabandista', 'contrabandista', ['conduta']),
  entrada('traficante', 'traficante', 'traficante', ['violencia']),
  entrada('miliciano', 'miliciano', 'miliciana', ['violencia']),
  entrada('pistoleiro', 'pistoleiro', 'pistoleira', ['violencia']),
  entrada('jagunco', 'jagunço', 'jagunça', ['violencia']),
  entrada('capanga', 'capanga', 'capanga', ['violencia']),

  // Política e eleição.
  entrada('incompetente', 'incompetente', 'incompetente', ['politica']),
  entrada('fracassado', 'fracassado', 'fracassada', ['politica']),
  entrada('oportunista', 'oportunista', 'oportunista', ['politica', 'eleitoral']),
  entrada('demagogo', 'demagogo', 'demagoga', ['politica', 'eleitoral']),
  entrada('ditador', 'ditador', 'ditadora', ['politica']),
  entrada('tirano', 'tirano', 'tirana', ['politica']),
  entrada('golpista', 'golpista', 'golpista', ['politica']),
  entrada('populista', 'populista', 'populista', ['politica']),
  entrada('entreguista', 'entreguista', 'entreguista', ['politica']),
  entrada('comunista', 'comunista', 'comunista', ['politica']),
  entrada('fascista', 'fascista', 'fascista', ['politica']),
  entrada('neoliberal', 'neoliberal', 'neoliberal', ['politica']),
  entrada('reacionario', 'reacionário', 'reacionária', ['politica']),
  entrada('elitista', 'elitista', 'elitista', ['politica']),
  entrada('oligarca', 'oligarca', 'oligarca', ['politica']),
  entrada('burocrata', 'burocrata', 'burocrata', ['politica']),
  entrada('tecnocrata', 'tecnocrata', 'tecnocrata', ['politica']),
  entrada('autoritario', 'autoritário', 'autoritária', ['politica']),
  entrada('opressor', 'opressor', 'opressora', ['politica']),
  entrada('explorador', 'explorador', 'exploradora', ['politica']),
  entrada('usurpador', 'usurpador', 'usurpadora', ['politica']),
  entrada('palhaco', 'palhaço', 'palhaça', ['politica', 'carater']),
  entrada('trapalhao', 'trapalhão', 'trapalhona', ['politica']),

  // Covardia e fraqueza.
  entrada('covarde', 'covarde', 'covarde', ['covardia']),
  entrada('frango', 'frango', 'franga', ['covardia']),
  entrada('frouxo', 'frouxo', 'frouxa', ['covardia']),
  entrada('medroso', 'medroso', 'medrosa', ['covardia']),
  entrada('bundao', 'bundão', 'bundona', ['covardia', 'profano']),
  entrada('mole', 'mole', 'mole', ['covardia']),
  entrada('molenga', 'molenga', 'molenga', ['covardia']),

  // Estupidez e falta de noção.
  entrada('otario', 'otário', 'otária', ['carater', 'profano']),
  entrada('babaca', 'babaca', 'babaca', ['carater', 'profano']),
  entrada('idiota', 'idiota', 'idiota', ['carater', 'profano']),
  entrada('imbecil', 'imbecil', 'imbecil', ['carater', 'profano']),
  entrada('burro', 'burro', 'burra', ['estupidez']),
  entrada('tapado', 'tapado', 'tapada', ['estupidez']),
  entrada('lerdo', 'lerdo', 'lerda', ['estupidez']),
  entrada('panaca', 'panaca', 'panaca', ['estupidez']),
  entrada('trouxa', 'trouxa', 'trouxa', ['estupidez']),
  entrada('tonto', 'tonto', 'tonta', ['estupidez']),
  entrada('abobalhado', 'abobalhado', 'abobalhada', ['estupidez']),
  entrada('pateta', 'pateta', 'pateta', ['estupidez']),
  entrada('besta', 'besta', 'besta', ['estupidez']),
  entrada('jumento', 'jumento', 'jumenta', ['estupidez']),
  entrada('ignorante', 'ignorante', 'ignorante', ['estupidez']),
  entrada('incapaz', 'incapaz', 'incapaz', ['estupidez']),
  entrada('inutil', 'inútil', 'inútil', ['estupidez']),
  entrada('imprestavel', 'imprestável', 'imprestável', ['estupidez']),
  entrada('desqualificado', 'desqualificado', 'desqualificada', ['estupidez']),
  entrada('amador', 'amador', 'amadora', ['estupidez']),
  entrada('mediocre', 'medíocre', 'medíocre', ['estupidez']),
  entrada('patetico', 'patético', 'patética', ['estupidez']),
  entrada('ridiculo', 'ridículo', 'ridícula', ['estupidez']),

  // Caráter e convivência.
  entrada('arrogante', 'arrogante', 'arrogante', ['carater']),
  entrada('prepotente', 'prepotente', 'prepotente', ['carater']),
  entrada('cinico', 'cínico', 'cínica', ['carater']),
  entrada('hipocrita', 'hipócrita', 'hipócrita', ['carater']),
  entrada('falso', 'falso', 'falsa', ['carater']),
  entrada('narcisista', 'narcisista', 'narcisista', ['carater']),
  entrada('egoista', 'egoísta', 'egoísta', ['carater']),
  entrada('esnobe', 'esnobe', 'esnobe', ['carater']),
  entrada('mesquinho', 'mesquinho', 'mesquinha', ['carater']),
  entrada('sovina', 'sovina', 'sovina', ['carater']),
  entrada('invejoso', 'invejoso', 'invejosa', ['carater']),
  entrada('fofoqueiro', 'fofoqueiro', 'fofoqueira', ['carater']),
  entrada('intrigante', 'intrigante', 'intrigante', ['carater']),
  entrada('folgado', 'folgado', 'folgada', ['carater']),
  entrada('abusado', 'abusado', 'abusada', ['carater']),
  entrada('metido', 'metido', 'metida', ['carater']),
  entrada('convencido', 'convencido', 'convencida', ['carater']),
  entrada('petulante', 'petulante', 'petulante', ['carater']),
  entrada('insolente', 'insolente', 'insolente', ['carater']),
  entrada('descarado', 'descarado', 'descarada', ['carater']),
  entrada('cara-de-pau', 'cara de pau', 'cara de pau', ['carater']),
  entrada('sem-carater', 'sem-caráter', 'sem-caráter', ['carater']),
  entrada('sem-nocao', 'sem noção', 'sem noção', ['carater']),
  entrada('chato', 'chato', 'chata', ['carater']),
  entrada('grosseiro', 'grosseiro', 'grosseira', ['carater']),
  entrada('mal-educado', 'mal-educado', 'mal-educada', ['carater']),
  entrada('desbocado', 'desbocado', 'desbocada', ['carater']),
  entrada('atrevido', 'atrevido', 'atrevida', ['carater']),
  entrada('desprezivel', 'desprezível', 'desprezível', ['desprezo']),
  entrada('miseravel', 'miserável', 'miserável', ['desprezo']),
  entrada('repugnante', 'repugnante', 'repugnante', ['desprezo']),

  // Aparência e higiene (sem atacar traços protegidos).
  entrada('porco', 'porco', 'porca', ['desprezo']),
  entrada('porcalhao', 'porcalhão', 'porcalhona', ['desprezo']),
  entrada('fedorento', 'fedorento', 'fedorenta', ['desprezo']),
  entrada('imundo', 'imundo', 'imunda', ['desprezo']),
  entrada('nojento', 'nojento', 'nojenta', ['desprezo']),
  entrada('asqueroso', 'asqueroso', 'asquerosa', ['desprezo']),

  // Palavrões e baixaria.
  entrada('arrombado', 'arrombado', 'arrombada', ['profano']),
  entrada('escroto', 'escroto', 'escrota', ['profano']),
  entrada('cuzao', 'cuzão', 'cuzona', ['profano']),
  entrada('corno', 'corno', 'corna', ['profano']),
  entrada('sacana', 'sacana', 'sacana', ['profano']),
  entrada('tarado', 'tarado', 'tarada', ['profano']),
  entrada('pervertido', 'pervertido', 'pervertida', ['profano']),
  entrada('depravado', 'depravado', 'depravada', ['profano']),
  entrada('devasso', 'devasso', 'devassa', ['profano']),
  entrada('punheteiro', 'punheteiro', 'punheteira', ['profano']),
  entrada('broxa', 'broxa', 'broxa', ['profano']),
  entrada('filho-da-puta', 'filho da puta', 'filha da puta', ['profano']),

  // Desprezo geral, com gênero fixo.
  entrada('lixo', 'lixo', 'lixo', ['desprezo'], 'm'),
  entrada('verme', 'verme', 'verme', ['desprezo'], 'm'),
  entrada('urubu', 'urubu', 'urubu', ['desprezo'], 'm'),
  entrada('abutre', 'abutre', 'abutre', ['desprezo'], 'm'),
  entrada('bosta', 'bosta', 'bosta', ['desprezo', 'profano'], 'f'),
  entrada('merda', 'merda', 'merda', ['desprezo', 'profano'], 'f'),
  entrada('escoria', 'escória', 'escória', ['desprezo'], 'f'),
  entrada('rale', 'ralé', 'ralé', ['desprezo'], 'f'),
  entrada('gentalha', 'gentalha', 'gentalha', ['desprezo'], 'f'),
  entrada('anta', 'anta', 'anta', ['estupidez'], 'f'),
  entrada('mula', 'mula', 'mula', ['estupidez'], 'f'),
  entrada('hiena', 'hiena', 'hiena', ['desprezo'], 'f'),
  entrada('barata', 'barata', 'barata', ['desprezo'], 'f'),
  entrada('peste', 'peste', 'peste', ['desprezo'], 'f'),
  entrada('praga', 'praga', 'praga', ['desprezo'], 'f'),
]);

export const INTENSIFICADORES = Object.freeze([
  'do caralho',
  'de merda',
  'da porra',
  'pra caralho',
  'de bosta',
  'do inferno',
  'do cacete',
  'de cu',
  'do cu',
  'no cu',
  'que pariu',
  'dos infernos',
  'do demônio',
  'da desgraça',
  'de quinta categoria',
  'de meia-tigela',
]);

export const PREDICADOS = Object.freeze([
  'roubou o povo',
  'enganou o povo',
  'vendeu a cidade',
  'mentiu na campanha',
  'traiu os eleitores',
  'fugiu do debate',
  'não fez nada',
  'só apareceu na eleição',
  'não entregou nada',
  'sumiu com a verba',
  'nomeou os amigos',
  'comprou o mandato',
  'perseguiu os críticos',
  'mandou prender inocente',
  'aumentou o próprio salário',
  'cortou a merenda',
  'sujou a cidade',
  'quebrou a cidade',
  'vendeu a saúde',
  'privatizou tudo',
  'não escuta ninguém',
  'foge da imprensa',
  'não devolveu nada',
  'só rouba',
]);

export const MODELOS = Object.freeze([
  'e',
  'possessivo',
  'seco',
  'fora',
  'abaixo',
  'ninguem',
  'naoPresta',
  'manchete',
  'duplo',
  'predicado',
  'triplo',
  'interrogacao',
  'sigla',
]);

export const MODELOS_PRECONCEITO = Object.freeze(MODELOS.filter(modelo => modelo !== 'predicado'));

export const CATEGORIAS_DE_ODIO = Object.freeze(Object.keys(PREJUDICE_CRIME_TYPES));

const escolhe = (lista, random) => lista[Math.min(lista.length - 1, Math.floor(random() * lista.length))];
const normalizarRandom = random => typeof random === 'function' ? random : Math.random;
const normalizarGenero = genero => genero === 'f' || genero === 'feminino' || genero === 'mulher';

function limitarTexto(texto, limite) {
  const limpo = String(texto ?? '').replace(/\s+/gu, ' ').trim();
  if (limpo.length <= limite) return limpo;
  return limpo.slice(0, limite).replace(/\s+\S*$/u, '').trim();
}

export function limitarXingamento(texto, limite = 180) {
  return limitarTexto(texto, limite);
}

// Monta o texto a partir de uma lista já filtrada. Mantém o mesmo sorteio
// para xingamento comum e para ofensa de categoria preconceituosa.
function montarXingamento({nome, feminino, entradas, escolhido, chance, sorteio, limite, pixacao, categoriaTipo = null}) {
  const entradaEscolhida = escolhe(entradas, sorteio);
  const insulto = feminino ? entradaEscolhida.f : entradaEscolhida.m;
  const generoArtigo = entradaEscolhida.generoFixo || (feminino ? 'f' : 'm');
  const artigo = generoArtigo === 'f' ? 'uma' : 'um';
  const possessivo = generoArtigo === 'f' ? 'sua' : 'seu';

  const podeIntensificar = escolhido !== 'predicado' && sorteio() < chance;
  const intensificador = podeIntensificar ? escolhe(INTENSIFICADORES, sorteio) : '';
  const sufixo = intensificador ? ` ${intensificador}` : '';

  let adicionais = [];
  if (escolhido === 'duplo' || escolhido === 'triplo') {
    const outras = entradas.filter(item => item.id !== entradaEscolhida.id);
    const quantos = escolhido === 'triplo' ? 2 : 1;
    while (adicionais.length < quantos && outras.length) {
      const [escolhida] = outras.splice(Math.min(outras.length - 1, Math.floor(sorteio() * outras.length)), 1);
      adicionais.push(feminino ? escolhida.f : escolhida.m);
    }
    if (adicionais.length < (escolhido === 'triplo' ? 2 : 1)) {
      escolhido = adicionais.length ? 'duplo' : 'e';
    }
  }

  let texto;
  switch (escolhido) {
    case 'e':
      texto = `${nome} é ${artigo} ${insulto}${sufixo}`;
      break;
    case 'possessivo':
      texto = `${nome}, ${possessivo} ${insulto}${sufixo}`;
      break;
    case 'seco':
      texto = `${nome} ${insulto}${sufixo}`;
      break;
    case 'fora':
      texto = `FORA, ${nome} ${insulto}${sufixo}`;
      break;
    case 'abaixo':
      texto = `ABAIXO ${nome}, ${insulto}${sufixo}`;
      break;
    case 'ninguem':
      texto = `NINGUÉM AGUENTA ${nome}, ${insulto}${sufixo}`;
      break;
    case 'naoPresta':
      texto = `${nome} não presta: ${insulto}${sufixo}`;
      break;
    case 'manchete':
      texto = `${nome}: ${insulto}${sufixo}`;
      break;
    case 'duplo':
      texto = `${nome}, ${insulto} e ${adicionais[0]}${sufixo}`;
      break;
    case 'triplo':
      texto = `${nome}, ${insulto}, ${adicionais[0]} e ${adicionais[1]}${sufixo}`;
      break;
    case 'interrogacao':
      texto = `${nome}, ${insulto}${sufixo}?`;
      break;
    case 'sigla':
      texto = `${nome} = ${insulto}${sufixo}`;
      break;
    case 'predicado':
      texto = `${nome} ${escolhe(PREDICADOS, sorteio)}`;
      break;
    default:
      texto = `${nome} é ${artigo} ${insulto}${sufixo}`;
  }

  const textoFinal = pixacao ? texto.toLocaleUpperCase('pt-BR') : texto;
  return {
    texto: limitarTexto(textoFinal, limite),
    alvo: nome,
    genero: feminino ? 'f' : 'm',
    modelo: escolhido,
    tipo: entradaEscolhida.tipos?.[0] ?? categoriaTipo,
    categoria: categoriaTipo,
    insulto,
    intensificador: intensificador || null,
  };
}

// Versão detalhada: devolve o texto e as escolhas feitas. O gerador é
// determinístico quando recebe `random`; não lê relógio, rede ou estado global.
export function gerarXingamentoDetalhado({
  alvo = 'fulano',
  genero = 'm',
  tipo = null,
  intensidade = 0.35,
  random = Math.random,
  pixacao = false,
  modelo = null,
  limite = 180,
} = {}) {
  const entradas = tipo
    ? XINGAMENTOS.filter(item => item.tipos.includes(tipo))
    : XINGAMENTOS;
  if (!entradas.length) throw new RangeError(`tipo de xingamento desconhecido: ${tipo}`);

  const modeloPedido = modelo == null ? null : String(modelo);
  if (modeloPedido && !MODELOS.includes(modeloPedido)) {
    throw new RangeError(`modelo de xingamento desconhecido: ${modelo}`);
  }

  const sorteio = normalizarRandom(random);
  const feminino = normalizarGenero(genero);
  const nome = String(alvo ?? '').trim().replace(/\s+/gu, ' ').slice(0, 56) || 'fulano';
  const chance = Number.isFinite(intensidade) ? Math.max(0, Math.min(1, intensidade)) : 0.35;
  return montarXingamento({
    nome,
    feminino,
    entradas,
    escolhido: modeloPedido || escolhe(MODELOS, sorteio),
    chance,
    sorteio,
    limite,
    pixacao,
  });
}

export function gerarXingamento(opcoes = {}) {
  return gerarXingamentoDetalhado(opcoes).texto;
}

// Ofensas preconceituosas vêm do cadastro manual em xingamentos_preconceito.js.
// Sem entrada cadastrada, a categoria falha em vez de inventar conteúdo.
export function gerarOfensaPreconceitoDetalhado({
  tipo = null,
  alvo = 'fulano',
  genero = 'm',
  intensidade = 0.35,
  random = Math.random,
  pixacao = false,
  modelo = null,
  limite = 180,
} = {}) {
  if (!Object.prototype.hasOwnProperty.call(PREJUDICE_CRIME_TYPES, tipo)) {
    throw new RangeError(`categoria de preconceito desconhecida: ${tipo}`);
  }
  const entradas = ofensasDaCategoria(tipo).map(item => ({
    id: item.id,
    m: item.m,
    f: item.f,
    tipos: Object.freeze([]),
    generoFixo: null,
  }));
  if (!entradas.length) throw new Error(`sem ofensas cadastradas para ${tipo}`);

  const modeloPedido = modelo == null ? null : String(modelo);
  if (modeloPedido && !MODELOS_PRECONCEITO.includes(modeloPedido)) {
    throw new RangeError(`modelo de xingamento desconhecido: ${modelo}`);
  }

  const sorteio = normalizarRandom(random);
  const feminino = normalizarGenero(genero);
  const nome = String(alvo ?? '').trim().replace(/\s+/gu, ' ').slice(0, 56) || 'fulano';
  const chance = Number.isFinite(intensidade) ? Math.max(0, Math.min(1, intensidade)) : 0.35;
  return montarXingamento({
    nome,
    feminino,
    entradas,
    escolhido: modeloPedido || escolhe(MODELOS_PRECONCEITO, sorteio),
    chance,
    sorteio,
    limite,
    pixacao,
    categoriaTipo: tipo,
  });
}

export function gerarOfensaPreconceito(opcoes = {}) {
  return gerarOfensaPreconceitoDetalhado(opcoes).texto;
}

// Valida a categoria e devolve o rótulo do crime correspondente. O conteúdo
// ofensivo vem do cadastro manual em xingamentos_preconceito.js.
export function crimeDeOdio(categoria) {
  return Object.prototype.hasOwnProperty.call(PREJUDICE_CRIME_TYPES, categoria)
    ? PREJUDICE_CRIME_TYPES[categoria]
    : null;
}
