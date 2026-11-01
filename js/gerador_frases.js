import { vocabulario, classificarPalavra, converterParaSingular } from './vocabulario.js';

// Esta é uma gramática pequena e extensível, não um banco de frases. As formas
// do léxico são dados; as regras abaixo montam e flexionam os constituintes.
const nomes = [
  ['menino','meninos','m',['pessoa','agente']], ['menina','meninas','f',['pessoa','agente']],
  ['vizinho','vizinhos','m',['pessoa','agente']], ['vizinha','vizinhas','f',['pessoa','agente']],
  ['padeiro','padeiros','m',['pessoa','agente']], ['padeira','padeiras','f',['pessoa','agente']],
  ['professor','professores','m',['pessoa','agente']], ['professora','professoras','f',['pessoa','agente']],
  ['gato','gatos','m',['animal','agente']], ['gata','gatas','f',['animal','agente']],
  ['cachorro','cachorros','m',['animal','agente']], ['pássaro','pássaros','m',['animal','agente']],
  ['cidade','cidades','f',['lugar','passeio']], ['bairro','bairros','m',['lugar','passeio','corrida']],
  ['jardim','jardins','m',['lugar','passeio','corrida','abrigo']], ['rua','ruas','f',['lugar','passeio','corrida']], ['praça','praças','f',['lugar','passeio','corrida']],
  ['rio','rios','m',['lugar','natureza']], ['mercado','mercados','m',['comércio','lugar','abertura']],
  ['padaria','padarias','f',['comércio','lugar','abertura']], ['casa','casas','f',['lugar','objeto','abrigo','abertura']],
  ['céu','céus','m',['natureza','ceu']], ['sol','sóis','m',['astro','natureza']],
  ['lua','luas','f',['astro','natureza']], ['estrela','estrelas','f',['astro','natureza']],
  ['nuvem','nuvens','f',['nuvem','natureza']],
  ['chuva','chuvas','f',['chuva','natureza']], ['vento','ventos','m',['vento','natureza']],
  ['árvore','árvores','f',['planta','natureza']], ['flor','flores','f',['planta','natureza']],
  ['semente','sementes','f',['planta','objeto']], ['pão','pães','m',['comida']],
  ['bolo','bolos','m',['comida']], ['sopa','sopas','f',['comida']], ['fruta','frutas','f',['comida']],
  ['água','águas','f',['bebida']], ['café','cafés','m',['bebida']],
  ['livro','livros','m',['texto','objeto']], ['jornal','jornais','m',['texto','objeto']],
  ['carta','cartas','f',['texto','objeto']], ['história','histórias','f',['texto']],
  ['bola','bolas','f',['objeto']], ['janela','janelas','f',['objeto','abertura']], ['porta','portas','f',['objeto','abertura']],
  ['música','músicas','f',['som','objeto']], ['canção','canções','f',['som','texto']],
];
const substantivos = nomes.map(([lema, plural, genero, tags]) => ({ lema, plural, genero, tags }));
const palavrasDoCatalogo = new Set(vocabulario.palavras);
// A camada gramatical só anota palavras que realmente existem no catálogo.
const substantivosDoCatalogo = substantivos.filter(nome =>
  palavrasDoCatalogo.has(nome.lema) && palavrasDoCatalogo.has(nome.plural)
);

const temas = {
  arte: [
    {lema:'arte',plural:'artes',genero:'f',tags:['texto','objeto']},
    {lema:'memória',plural:'memórias',genero:'f',tags:['texto']},
    {lema:'cidade',plural:'cidades',genero:'f',tags:['lugar','passeio']},
    {lema:'rua',plural:'ruas',genero:'f',tags:['lugar','passeio','corrida']},
    {lema:'praça',plural:'praças',genero:'f',tags:['lugar','passeio','corrida']},
    {lema:'luta',plural:'lutas',genero:'f',tags:['texto']},
    {lema:'esperança',plural:'esperanças',genero:'f',tags:['texto']},
    {lema:'retrato',plural:'retratos',genero:'m',tags:['objeto','texto']},
  ],
  politica: [
    {lema:'povo',plural:'povos',genero:'m',tags:['pessoa','agente']},
    {lema:'cidade',plural:'cidades',genero:'f',tags:['lugar','passeio']},
    {lema:'bairro',plural:'bairros',genero:'m',tags:['lugar','passeio','corrida']},
    {lema:'trabalho',plural:'trabalhos',genero:'m',tags:['texto','objeto']},
    {lema:'futuro',plural:'futuros',genero:'m',tags:['texto']},
    {lema:'justiça',plural:'justiças',genero:'f',tags:['texto']},
    {lema:'união',plural:'uniões',genero:'f',tags:['objeto','texto']},
    {lema:'moradia',plural:'moradias',genero:'f',tags:['lugar']},
    {lema:'direito',plural:'direitos',genero:'m',tags:['texto']},
    {lema:'mudança',plural:'mudanças',genero:'f',tags:['texto']},
  ],
};

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

// Cada verbo declara valência e papéis semânticos, além da 3ª pessoa do
// presente e do pretérito. O futuro é produtivo: auxiliar ir + infinitivo.
const verbos = [
  { lema:'ver', presente:['vê','veem'], passado:['viu','viram'], sujeitos:['pessoa','animal'], objetos:['pessoa','animal','lugar','natureza','planta','comércio','comida','bebida','texto','objeto','som'] },
  { lema:'encontrar', presente:['encontra','encontram'], passado:['encontrou','encontraram'], sujeitos:['pessoa','animal'], objetos:['pessoa','animal','objeto'] },
  { lema:'ajudar', presente:['ajuda','ajudam'], passado:['ajudou','ajudaram'], sujeitos:['pessoa'], objetos:['pessoa','animal'] },
  { lema:'visitar', presente:['visita','visitam'], passado:['visitou','visitaram'], sujeitos:['pessoa','animal'], objetos:['lugar','comércio'] },
  { lema:'atravessar', presente:['atravessa','atravessam'], passado:['atravessou','atravessaram'], sujeitos:['pessoa','animal'], objetos:['lugar'] },
  { lema:'comprar', presente:['compra','compram'], passado:['comprou','compraram'], sujeitos:['pessoa'], objetos:['comida','bebida','texto','objeto'] },
  { lema:'preparar', presente:['prepara','preparam'], passado:['preparou','prepararam'], sujeitos:['pessoa'], objetos:['comida','bebida'] },
  { lema:'comer', presente:['come','comem'], passado:['comeu','comeram'], sujeitos:['pessoa','animal'], objetos:['comida'] },
  { lema:'beber', presente:['bebe','bebem'], passado:['bebeu','beberam'], sujeitos:['pessoa','animal'], objetos:['bebida'] },
  { lema:'ler', presente:['lê','leem'], passado:['leu','leram'], sujeitos:['pessoa'], objetos:['texto'] },
  { lema:'escrever', presente:['escreve','escrevem'], passado:['escreveu','escreveram'], sujeitos:['pessoa'], objetos:['texto'] },
  { lema:'guardar', presente:['guarda','guardam'], passado:['guardou','guardaram'], sujeitos:['pessoa','animal'], objetos:['comida','bebida','texto','objeto'] },
  { lema:'abrir', presente:['abre','abrem'], passado:['abriu','abriram'], sujeitos:['pessoa'], objetos:['abertura'] },
  { lema:'fechar', presente:['fecha','fecham'], passado:['fechou','fecharam'], sujeitos:['pessoa'], objetos:['abertura'] },
  { lema:'abrir', presente:['abre','abrem'], passado:['abriu','abriram'], sujeitos:['comércio'], complemento:{ adverbios:['logo cedo','durante o dia','ao anoitecer'] } },
  { lema:'plantar', presente:['planta','plantam'], passado:['plantou','plantaram'], sujeitos:['pessoa'], objetos:['planta'] },
  { lema:'regar', presente:['rega','regam'], passado:['regou','regaram'], sujeitos:['pessoa'], objetos:['planta'] },
  { lema:'ouvir', presente:['ouve','ouvem'], passado:['ouviu','ouviram'], sujeitos:['pessoa','animal'], objetos:['som'] },
  { lema:'cantar', presente:['canta','cantam'], passado:['cantou','cantaram'], sujeitos:['pessoa','animal'], objetos:['som'] },
  { lema:'desenhar', presente:['desenha','desenham'], passado:['desenhou','desenharam'], sujeitos:['pessoa'], objetos:['objeto','natureza','animal'] },
  { lema:'passear', presente:['passeia','passeiam'], passado:['passeou','passearam'], sujeitos:['pessoa','animal'], complemento:{ preposicao:'por', tags:['passeio'] } },
  { lema:'correr', presente:['corre','correm'], passado:['correu','correram'], sujeitos:['pessoa','animal'], complemento:{ preposicao:'por', tags:['corrida'] } },
  { lema:'dormir', presente:['dorme','dormem'], passado:['dormiu','dormiram'], sujeitos:['pessoa','animal'], complemento:{ preposicao:'em', tags:['abrigo'] } },
  { lema:'florescer', presente:['floresce','florescem'], passado:['floresceu','floresceram'], sujeitos:['planta'], complemento:{ preposicao:'em', fixo:'na primavera' } },
  { lema:'cair', presente:['cai','caem'], passado:['caiu','caíram'], sujeitos:['chuva','planta'], complemento:{ adverbios:['devagar','de repente','em silêncio'] } },
  { lema:'passar', presente:['passa','passam'], passado:['passou','passaram'], sujeitos:['nuvem'], complemento:{ preposicao:'por', tags:['ceu'] } },
  { lema:'soprar', presente:['sopra','sopram'], passado:['soprou','sopraram'], sujeitos:['vento'], complemento:{ adverbios:['forte','devagar','à noite'] } },
  { lema:'brilhar', presente:['brilha','brilham'], passado:['brilhou','brilharam'], sujeitos:['astro'], complemento:{ adverbios:['muito','à noite','no alto'] } },
];

const determinantes = {
  definido: { m:['o','os'], f:['a','as'] },
  indefinido: { m:['um','uns'], f:['uma','umas'] },
  demonstrativo: { m:['este','estes'], f:['esta','estas'] },
  demonstrativoDistal: { m:['aquele','aqueles'], f:['aquela','aquelas'] },
};
const adverbiosFrasais = ['às vezes','de repente','com frequência','em silêncio'];
const conectores = ['e','enquanto'];
const escolher = (lista, random) => lista[Math.floor(Math.max(0,Math.min(0.999999999,random()))*lista.length)];
const combina = (a,b) => a.some(tag => b.includes(tag));
const plural = (random) => random() < 0.24;
const tempoAleatorio = (random) => random() < 0.68 ? 'presente' : random() < 0.75 ? 'passado' : 'futuro';

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

function complementos(verb, nomes, random) {
  if (verb.objetos) {
    const objetos = nomes.filter(nome => combina(nome.tags,verb.objetos));
    if (!objetos.length) return '';
    return ` ${sintagmaNominal(escolher(objetos,random),random).texto}`;
  }
  const comp = verb.complemento;
  if (!comp) return '';
  if (comp.adverbios) return ` ${escolher(comp.adverbios,random)}`;
  if (comp.fixo) return ` ${comp.fixo}`;
  const lugares = nomes.filter(nome => combina(nome.tags,comp.tags));
  if (!lugares.length) return '';
  const lugar = escolher(lugares,random);
  const np = sintagmaNominal(lugar,random,{adjetivo:false});
  const contracoes = comp.preposicao === 'por'
    ? { m:['pelo','pelos'], f:['pela','pelas'] }
    : comp.preposicao === 'em'
      ? { m:['no','nos'], f:['na','nas'] }
      : null;
  const contracao = contracoes ? contracoes[np.genero][np.plural ? 1 : 0] : comp.preposicao;
  return ` ${contracao} ${np.texto.replace(/^(o|a|os|as|um|uma|uns|umas|este|esta|estes|estas|aquele|aquela|aqueles|aquelas) /,'')}`;
}

function formaDoVerbo(verb, numero, tempo) {
  if (tempo === 'presente') return verb.presente[numero ? 1 : 0];
  if (tempo === 'passado') return verb.passado[numero ? 1 : 0];
  return `${numero ? 'vão' : 'vai'} ${verb.lema}`;
}

function gerarOracao(nomes, random) {
  const intransitivos = verbos.filter(v => v.complemento);
  const transitivos = verbos.filter(v => v.objetos);
  const tipo = random() < 0.32 ? 'copulativa' : random() < 0.5 ? 'intransitiva' : 'transitiva';
  const tempo = tempoAleatorio(random);
  const copulativa=()=>{
    const candidatas = nomes.filter(nome => adjData.some(adj => combina(nome.tags,adj.tags)));
    const sujeito = sintagmaNominal(escolher(candidatas,random),random);
    const adjetivosPossiveis = adjData.filter(adj => combina(sujeito.nome.tags,adj.tags));
    const adj = escolher(adjetivosPossiveis,random);
    const indice = (sujeito.plural ? 2 : 0) + (sujeito.genero === 'f' ? 1 : 0);
    const copula = tempo === 'presente' ? (sujeito.plural ? 'estão' : 'está') : tempo === 'passado' ? (sujeito.plural ? 'estavam' : 'estava') : (sujeito.plural ? 'estarão' : 'estará');
    return `${sujeito.texto} ${copula} ${adj.formas[indice]}`;
  };
  if (tipo === 'copulativa') return copulativa();
  const candidatosVerbo = tipo === 'transitiva' ? transitivos : intransitivos;
  const possibilidades = candidatosVerbo.flatMap(verb => nomes.filter(n => combina(n.tags,verb.sujeitos)).map(nome => ({verb,nome})));
  if(!possibilidades.length)return copulativa();
  const {verb,nome} = escolher(possibilidades,random);
  const sujeito = sintagmaNominal(nome,random);
  const verbo = formaDoVerbo(verb,sujeito.plural,tempo);
  return `${sujeito.texto} ${verbo}${complementos(verb,nomes,random)}`;
}

function gerarOracaoComLexemaNovo(nomes, foco, random) {
  const verbosCompativeis = verbos.filter(verb => verb.objetos && combina(foco.tags,verb.objetos));
  const pares = verbosCompativeis.flatMap(verb => nomes
    .filter(nome => nome !== foco && combina(nome.tags,verb.sujeitos))
    .map(nome => ({ verb, nome })));
  const adjetivosCompativeis = adjData.filter(adj => combina(foco.tags,adj.tags));
  if (adjetivosCompativeis.length && (!pares.length || random() < 0.35)) {
    const sujeito = sintagmaNominal(foco,random);
    const adj = escolher(adjetivosCompativeis,random);
    const indice = (sujeito.plural ? 2 : 0) + (sujeito.genero === 'f' ? 1 : 0);
    const copula = sujeito.plural ? 'estão' : 'está';
    return `${sujeito.texto} ${copula} ${adj.formas[indice]}`;
  }
  if (pares.length) {
    const {verb,nome} = escolher(pares,random);
    const sujeito = sintagmaNominal(nome,random);
    return `${sujeito.texto} ${formaDoVerbo(verb,sujeito.plural,tempoAleatorio(random))} ${sintagmaNominal(foco,random).texto}`;
  }
  return gerarOracao(nomes,random);
}

/** Gera uma frase por regras gramaticais com combinações novas a cada chamada. */
export function gerarFrase({ random = Math.random, substantivos: extras = [], somenteExtras = false } = {}) {
  if (typeof random !== 'function') throw new TypeError('random precisa ser uma função');
  const nomes = [...(somenteExtras?[]:substantivosDoCatalogo),...extras].filter(nome => nome && typeof nome.lema === 'string' && typeof nome.plural === 'string' && ['m','f'].includes(nome.genero) && Array.isArray(nome.tags) && nome.tags.length);
  if (!nomes.length) throw new RangeError('O léxico não tem substantivos válidos');
  // Algumas saídas ganham um neologismo novo feito com o combinador real do
  // catálogo; o sentido gramatical vem das raízes que foram combinadas.
  let palavraNova = null;
  if (random() < 0.65) {
    const raiz = escolher(substantivosDoCatalogo,random);
    const relacionados = substantivosDoCatalogo.filter(nome => nome !== raiz && combina(nome.tags,raiz.tags));
    if (relacionados.length) {
      const outra = escolher(relacionados,random);
      try {
        const tags = raiz.tags.filter(tag => outra.tags.includes(tag));
        const neologismo = criarSubstantivoCombinado(raiz.lema,outra.lema,{ genero:raiz.genero === 'f' ? 'feminino' : 'masculino', tags });
        if (/^[\p{L}]{3,24}$/u.test(neologismo.lema) && neologismo.plural) {
          nomes.push(neologismo);
          palavraNova = neologismo;
        }
      } catch { /* Um par que viole as restrições morfológicas é simplesmente descartado. */ }
    }
  }
  const primeira = palavraNova
    ? gerarOracaoComLexemaNovo(nomes,palavraNova,random)
    : gerarOracao(nomes,random);
  const abertura = random() < 0.23 ? `${escolher(adverbiosFrasais,random)}, ` : '';
  if (random() < 0.12) {
    const segunda = gerarOracao(nomes,random);
    return `${abertura}${primeira} ${escolher(conectores,random)} ${segunda}.`;
  }
  return `${abertura}${primeira}.`;
}

/** Produz uma frase curta de arte ou política usando a mesma gramática do gerador. */
export function gerarFraseTematica(tema,{random=Math.random}={}){
  const substantivos=temas[tema];
  if(!substantivos)throw new RangeError(`Tema de frase desconhecido: ${tema}`);
  return gerarFrase({random,substantivos,somenteExtras:true});
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
