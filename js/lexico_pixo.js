// Vocabulário de rua para o gerador de textos.
//
// O repertório cívico já era amplo, mas as palavras do dia a dia da pixação
// apareciam pouco: muro, parede, tinta, spray, beco, laje, viaduto. Estas
// variantes mantêm gênero e número da chave, como o validador exige.
//
// Regras de autoria:
// - a variante é trocada só na cabeça do sujeito ou do objeto, então o resto da
//   cena continua valendo;
// - não use variante que repita o complemento da cena, como "muro da escola"
//   para a cena "o muro da escola";
// - verbos entram apenas no infinitivo e com objeto direto;
// - só entram verbos realmente sinônimos no uso transitivo da cena.

export const SUBSTANTIVOS_PIXO = {
  muro: ['muro velho', 'muro comprido', 'muro lateral', 'muro cinzento'],
  paredes: ['paredes velhas', 'paredes compridas', 'paredes descascadas'],
  parede: ['parede velha', 'parede cinzenta', 'parede comprida', 'parede descascada'],
  beco: ['beco estreito', 'beco comprido', 'beco sem saída'],
  laje: ['laje da casa', 'laje vizinha', 'laje colorida'],
  viaduto: ['viaduto central', 'viaduto velho', 'viaduto da avenida'],
  calçada: ['calçada estreita', 'calçada quebrada', 'calçada molhada'],
  tinta: ['tinta fresca', 'tinta colorida', 'tinta spray'],
  spray: ['aerossol', 'spray de tinta', 'spray colorido'],
  pichação: ['pichação colorida', 'pichação antiga', 'pichação recente', 'pixação'],
  grafiteiro: ['artista de rua', 'grafiteiro local', 'grafiteiro jovem', 'pintor de muro'],
  quebrada: ['periferia', 'vila', 'comunidade', 'quebrada do bairro'],
  poste: ['poste da esquina', 'poste velho', 'poste central'],
  lata: ['lata de tinta', 'lata vazia', 'lata velha'],
  latas: ['latas de tinta', 'latas vazias', 'latas velhas'],
  estêncil: ['molde', 'estêncil caseiro', 'gabarito'],
  grafite: ['grafite colorido', 'grafite local', 'mural'],
  centro: ['centro urbano', 'centro antigo', 'centro comercial'],
  vizinhança: ['vizinhança inteira', 'vizinhança unida'],
  mural: ['mural colorido', 'mural comunitário', 'mural da rua'],
  bairro: ['bairro antigo', 'bairro operário', 'bairro inteiro'],
  moradores: ['moradores antigos', 'residentes antigos'],
  obras: ['obras novas', 'obras grandes'],
};

export const VERBOS_PIXO = {
  grafitar: ['pichar', 'rabiscar'],
  pintar: ['pichar', 'rabiscar'],
  pichar: ['grafitar', 'pintar', 'rabiscar'],
  rabiscar: ['riscar', 'desenhar', 'rascunhar'],
  riscar: ['rabiscar', 'marcar', 'traçar'],
  estampar: ['imprimir', 'marcar', 'customizar'],
  customizar: ['estampar'],
};
