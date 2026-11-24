// Variantes lexicais do gerador de textos.
//
// As cenas continuam curadas: cada sujeito, verbo e objeto foi escrito à mão
// para manter sentido e concordância. Este arquivo só amplia a variedade,
// trocando a palavra-chave da cena por um sinônimo do mesmo gênero e número.
//
// Regras de autoria:
// - a chave é a forma exata que aparece na cena (minúscula, singular ou plural);
// - toda variante mantém gênero e número da chave;
// - verbos listados aqui só entram em cena com objeto direto, porque a lista é
//   de verbos transitivos diretos;
// - scripts/validar_lexico_sinonimos.mjs confere número, conjugação e, quando
//   Python e spaCy estão disponíveis, a ortografia das palavras.
export const SUBSTANTIVOS = Object.freeze({
  // Poder público e vida política
  prefeitura: ['administração', 'gestão'],
  governo: ['executivo', 'poder público'],
  prefeito: ['gestor municipal'],
  vereadores: ['parlamentares'],
  conselho: ['colegiado'],
  secretaria: ['pasta'],
  campanha: ['mobilização'],
  polícia: ['corporação'],
  imprensa: ['mídia'],
  programas: ['projetos'],

  // Cidade e bairro
  cidade: ['metrópole'],
  bairro: ['distrito'],
  comunidade: ['vizinhança', 'coletividade'],
  moradores: ['habitantes', 'residentes'],
  vizinhos: ['moradores', 'residentes'],
  obras: ['intervenções', 'melhorias'],
  casas: ['moradias'],
  casa: ['moradia'],
  rua: ['via'],
  iluminação: ['luz'],

  // Trabalho, renda e comércio
  empresa: ['companhia', 'firma'],
  cooperativa: ['associação'],
  fábrica: ['indústria'],
  indústria: ['fábrica'],
  construtora: ['empreiteira'],
  mercado: ['comércio'],
  comércio: ['mercado'],
  preços: ['valores'],
  trabalhadores: ['empregados', 'operários'],
  funcionários: ['empregados', 'servidores'],
  servidores: ['funcionários'],
  desempregados: ['desocupados'],
  profissionais: ['trabalhadores'],
  agricultores: ['produtores rurais'],
  reajuste: ['aumento'],
  crédito: ['financiamento'],
  impostos: ['tributos'],
  crescimento: ['avanço'],
  queda: ['redução'],

  // Moradia
  inquilinos: ['locatários'],
  proprietário: ['dono'],
  'sem-teto': ['desabrigados'],
  prédio: ['imóvel'],
  regras: ['normas'],

  // Família e cotidiano
  festa: ['celebração'],
  tarefas: ['funções'],
  chuva: ['tempestade'],
  espaço: ['lugar'],

  // Alimentação
  alimentos: ['mantimentos'],

  // Saúde
  enfermeiros: ['profissionais de enfermagem'],
  pacientes: ['doentes'],
  remédios: ['medicamentos'],
  vacinação: ['imunização'],
  falta: ['ausência'],

  // Mobilidade
  passageiros: ['usuários'],
  motoristas: ['condutores'],
  manutenção: ['conservação'],
  congestionamento: ['engarrafamento'],

  // Educação e cultura
  escola: ['instituição'],
  escolas: ['instituições'],
  professores: ['docentes'],
  alunos: ['estudantes'],
  cursos: ['treinamentos'],
  exposição: ['mostra'],

  // Segurança e justiça
  policiais: ['agentes'],
  guarda: ['corporação'],
  segurança: ['proteção'],

  // Meio ambiente
  ambientalistas: ['ecologistas'],
  lixo: ['resíduo'],

  // Substâncias
  fumo: ['tabagismo'],

  // Moda e lazer
  roupas: ['peças'],
  turistas: ['visitantes'],
  campeonato: ['torneio'],
  torneio: ['campeonato'],
});

// Só entram aqui verbos que aceitam objeto direto e cujo sentido se mantém
// com qualquer objeto já usado nas cenas. Verbos pronominais, de ligação e os
// que exigem preposição fixa ficam de fora.
export const VERBOS_TRANSITIVOS = Object.freeze({
  cobrar: ['exigir', 'reivindicar'],
  ampliar: ['expandir', 'aumentar'],
  oferecer: ['disponibilizar'],
  organizar: ['promover'],
  vender: ['comercializar'],
  reformar: ['recuperar', 'renovar'],
  buscar: ['procurar'],
  preocupar: ['inquietar'],
  aprovar: ['validar'],
  debater: ['discutir'],
  apresentar: ['mostrar'],
  reduzir: ['diminuir'],
  recuperar: ['restaurar'],
  enfrentar: ['encarar'],
  movimentar: ['animar'],
  entregar: ['distribuir'],
  pedir: ['solicitar'],
  fiscalizar: ['inspecionar'],
  julgar: ['avaliar'],
  negociar: ['discutir'],
  dividir: ['repartir'],
  criar: ['instituir'],
  anunciar: ['divulgar'],
  construir: ['erguer'],
  distribuir: ['entregar'],
  aprender: ['estudar'],
  promover: ['realizar'],
  conquistar: ['ganhar'],
  formar: ['capacitar'],
  apreender: ['confiscar'],
  questionar: ['contestar'],
  analisar: ['examinar'],
  assinar: ['firmar'],
  votar: ['aprovar'],
  explicar: ['detalhar'],
  ganhar: ['conquistar'],
  sugerir: ['propor'],
  contratar: ['empregar'],
  procurar: ['buscar'],
  garantir: ['assegurar'],
  exigir: ['cobrar'],
  sentir: ['perceber'],
  arrecadar: ['recolher'],
  afetar: ['atingir'],
  iniciar: ['começar'],
  vistoriar: ['inspecionar'],
  compartilhar: ['dividir'],
  ajudar: ['auxiliar'],
  adiar: ['postergar'],
  celebrar: ['comemorar'],
  herdar: ['receber'],
  chamar: ['convocar'],
  comprar: ['adquirir'],
  combater: ['enfrentar'],
  denunciar: ['relatar'],
  renovar: ['modernizar'],
  expor: ['mostrar'],
  exibir: ['mostrar'],
  reforçar: ['intensificar'],
  orientar: ['instruir'],
  condenar: ['sentenciar'],
  investigar: ['apurar'],
  determinar: ['ordenar'],
  separar: ['selecionar'],
  plantar: ['cultivar'],
  atingir: ['afetar'],
  gerar: ['produzir'],
  ameaçar: ['comprometer'],
  limpar: ['higienizar'],
  experimentar: ['provar'],
  tratar: ['combater'],
  causar: ['provocar'],
  proibir: ['vetar'],
  discutir: ['debater'],
  adotar: ['seguir'],
  lançar: ['apresentar'],
  escolher: ['selecionar'],
  empregar: ['contratar'],
  consertar: ['reparar'],
  atrair: ['chamar'],
  vencer: ['ganhar'],
  jogar: ['disputar'],
  reunir: ['congregar'],
  percorrer: ['cruzar'],
  praticar: ['fazer'],
  alagar: ['inundar'],
});
