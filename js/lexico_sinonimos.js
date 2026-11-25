// Variantes lexicais do gerador de textos.
//
// As cenas continuam curadas: cada sujeito, verbo e objeto foi escrito à mão
// para manter sentido e concordância. Este arquivo amplia a variedade,
// trocando a palavra-chave da cena por uma variante do mesmo gênero e número.
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
  prefeitura: [
    'administração municipal', 'gestão municipal', 'municipalidade',
    'prefeitura local', 'administração da cidade', 'gestão pública',
    'prefeitura da cidade', 'administração local',
  ],
  governo: [
    'executivo', 'poder público', 'governo municipal', 'governo local',
    'estado', 'poder executivo', 'governo da cidade',
  ],
  prefeito: [
    'gestor municipal', 'mandatário municipal',
    'prefeito da cidade', 'governante municipal',
  ],
  vereadores: [
    'parlamentares', 'legisladores', 'edis', 'membros da câmara',
    'representantes do legislativo', 'vereadores da cidade',
  ],
  conselho: [
    'colegiado', 'órgão consultivo', 'conselho gestor', 'fórum municipal', 'colegiado municipal',
  ],
  secretaria: [
    'pasta', 'secretaria municipal',
    'repartição pública', 'secretaria local',
  ],
  campanha: [
    'mobilização', 'campanha eleitoral', 'disputa eleitoral',
    'corrida eleitoral', 'ação política', 'campanha política',
  ],
  polícia: [
    'corporação', 'força policial', 'polícia civil', 'polícia militar',
    'autoridade policial', 'força de segurança',
  ],
  imprensa: [
    'mídia', 'comunicação social', 'imprensa local',
  ],
  programas: [
    'projetos', 'programas sociais', 'planos municipais',
    'benefícios sociais', 'serviços públicos', 'programas públicos',
  ],

  // Cidade e bairro
  cidade: [
    'metrópole', 'urbe', 'capital', 'localidade', 'cidade grande',
    'área urbana', 'cidade inteira',
  ],
  bairro: ['distrito', 'subúrbio', 'entorno', 'setor', 'bairro popular'],
  comunidade: [
    'vizinhança', 'coletividade', 'população local',
    'comunidade local', 'comunidade do bairro',
  ],
  moradores: [
    'habitantes', 'residentes', 'cidadãos', 'vizinhos',
    'moradores locais', 'residentes locais',
  ],
  vizinhos: [
    'moradores', 'residentes', 'habitantes', 'moradores próximos', 'vizinhos da rua',
  ],
  obras: [
    'intervenções', 'melhorias', 'construções', 'reformas',
    'obras públicas',
  ],
  casas: [
    'moradias', 'residências', 'habitações', 'unidades habitacionais',
    'casas populares',
  ],
  casa: [
    'moradia', 'residência', 'habitação', 'unidade habitacional',
    'casa popular',
  ],
  rua: [
    'via', 'avenida', 'estrada', 'área pública', 'rua local', 'via pública',
  ],
  iluminação: [
    'luz', 'iluminação pública', 'iluminação da rua', 'luz pública',
    'rede de iluminação', 'iluminação local',
  ],

  // Trabalho, renda e comércio
  empresa: [
    'companhia', 'firma', 'organização', 'corporação',
    'companhia local', 'empresa local',
  ],
  cooperativa: [
    'associação', 'cooperativa local', 'organização coletiva',
    'entidade cooperativa',
  ],
  fábrica: [
    'indústria', 'unidade fabril', 'planta industrial',
    'fábrica local',
  ],
  indústria: [
    'fábrica', 'unidade industrial', 'planta industrial', 'indústria local',
  ],
  construtora: [
    'empreiteira', 'empresa de construção', 'companhia construtora',
    'firma construtora', 'construtora local',
  ],
  mercado: [
    'comércio', 'setor comercial', 'mercado local',
    'comércio local',
  ],
  comércio: [
    'mercado', 'setor comercial', 'comércio local',
  ],
  preços: [
    'valores', 'custos', 'preços ao consumidor',
    'valores de mercado', 'preços locais',
  ],
  trabalhadores: [
    'empregados', 'operários', 'funcionários', 'profissionais',
    'assalariados', 'trabalhadores locais',
  ],
  funcionários: [
    'empregados', 'servidores', 'trabalhadores', 'assalariados',
    'colaboradores', 'funcionários públicos',
  ],
  servidores: [
    'funcionários', 'empregados públicos', 'servidores públicos',
    'trabalhadores do setor público', 'agentes públicos',
  ],
  desempregados: [
    'desocupados', 'trabalhadores sem emprego',
    'trabalhadores desempregados',
  ],
  profissionais: [
    'trabalhadores', 'especialistas', 'técnicos',
    'profissionais locais', 'trabalhadores qualificados',
  ],
  agricultores: [
    'produtores rurais', 'trabalhadores rurais', 'camponeses',
    'produtores agrícolas', 'lavradores',
  ],
  reajuste: [
    'aumento', 'reajuste salarial',
    'aumento salarial',
  ],
  crédito: [
    'financiamento', 'empréstimo', 'crédito local', 'capital',
  ],
  impostos: [
    'tributos', 'impostos municipais',
    'encargos públicos',
  ],
  crescimento: [
    'avanço', 'aumento', 'desenvolvimento',
    'crescimento econômico',
  ],
  queda: ['redução', 'baixa', 'diminuição', 'retração', 'perda'],

  // Moradia
  inquilinos: [
    'locatários', 'arrendatários', 'moradores de aluguel',
    'inquilinos locais', 'ocupantes',
  ],
  proprietário: [
    'dono', 'senhorio', 'proprietário do imóvel', 'dono do imóvel',
    'proprietário local',
  ],
  'sem-teto': [
    'desabrigados', 'moradores de rua',
  ],
  prédio: [
    'imóvel', 'edifício', 'edifício residencial',
    'prédio residencial',
  ],
  regras: [
    'normas', 'regras de convivência',
    'diretrizes',
  ],

  // Família e cotidiano
  festa: ['celebração', 'comemoração', 'festividade', 'quermesse',],
  tarefas: [
    'funções', 'atividades', 'obrigações', 'tarefas domésticas',
  ],
  chuva: [
    'tempestade', 'precipitação', 'chuva forte',
    'pancada de chuva',
  ],
  espaço: ['lugar', 'ambiente', 'local', 'espaço público',],

  // Alimentação
  alimentos: [
    'mantimentos', 'produtos alimentícios', 'gêneros alimentícios',
    'itens alimentares',
  ],

  // Saúde
  enfermeiros: [
    'profissionais de enfermagem', 'técnicos de enfermagem',
    'enfermeiros locais',
  ],
  pacientes: [
    'doentes', 'usuários', 'pacientes locais',
    'usuários do sistema',
  ],
  remédios: [
    'medicamentos', 'fármacos', 'remédios básicos',
    'medicamentos essenciais', 'remédios controlados',
  ],
  vacinação: [
    'imunização', 'campanha de vacinação', 'vacinação pública',
    'aplicação de vacinas', 'cobertura vacinal',
  ],
  falta: [
    'ausência', 'carência', 'escassez', 'falta de recursos',
    'deficiência',
  ],

  // Mobilidade
  passageiros: [
    'usuários', 'viajantes', 'passageiros locais', 'usuários do transporte',
  ],
  motoristas: [
    'condutores', 'motoristas locais', 'profissionais do volante',
    'condutores de veículos',
  ],
  manutenção: [
    'conservação', 'manutenção preventiva',
    'revisão',
  ],
  congestionamento: [
    'engarrafamento', 'trânsito lento', 'trânsito parado',
  ],

  // Educação e cultura
  escola: [
    'instituição', 'escola pública', 'unidade escolar',
  ],
  escolas: [
    'instituições', 'unidades escolares', 'escolas públicas',
  ],
  professores: [
    'docentes', 'educadores', 'mestres', 'profissionais da educação',
    'professores locais',
  ],
  alunos: ['estudantes', 'discentes', 'alunos locais',],
  cursos: [
    'treinamentos', 'cursos técnicos',
  ],
  exposição: [
    'mostra', 'exibição', 'exposição cultural', 'acervo',
    'mostra cultural',
  ],

  // Segurança e justiça
  policiais: [
    'agentes', 'policiais locais', 'agentes de segurança', 'militares',
    'integrantes da corporação',
  ],
  guarda: [
    'corporação', 'guarda municipal', 'força de segurança',
    'patrulha', 'guarda local',
  ],
  segurança: [
    'proteção', 'tranquilidade', 'segurança pública',
    'sensação de segurança', 'defesa',
  ],

  // Meio ambiente
  ambientalistas: [
    'ecologistas', 'ativistas ambientais', 'defensores do meio ambiente',
    'protetores da natureza', 'ambientalistas locais',
  ],
  lixo: [
    'resíduo', 'lixo doméstico', 'lixo urbano',
  ],

  // Substâncias
  fumo: [
    'tabagismo', 'cigarro', 'fumo passivo', 'consumo de tabaco',
    'uso de cigarro',
  ],

  // Moda e lazer
  roupas: ['peças', 'vestimentas', 'roupas usadas',],
  turistas: [
    'visitantes', 'viajantes', 'turistas locais', 'visitantes da cidade',
    'excursionistas',
  ],
  campeonato: ['torneio', 'campeonato local'],
  torneio: ['campeonato', 'disputa esportiva', 'torneio local',],
});

// Só entram aqui verbos que aceitam objeto direto e cujo sentido se mantém
// com qualquer objeto já usado nas cenas. Verbos pronominais, de ligação e os
// que exigem preposição fixa ficam de fora.
export const VERBOS_TRANSITIVOS = Object.freeze({
  cobrar: ['exigir', 'reivindicar', 'requerer', 'reclamar', 'demandar', 'pleitear', 'solicitar', 'pedir'],
  ampliar: ['expandir', 'aumentar', 'estender', 'alargar', 'dilatar', 'prolongar', 'desenvolver', 'intensificar', 'reforçar', 'acrescer', 'elevar', 'majorar'],
  oferecer: ['disponibilizar', 'ofertar', 'fornecer', 'proporcionar', 'entregar', 'apresentar', 'dar', 'conceder', 'ministrar', 'propiciar'],
  organizar: ['promover', 'estruturar', 'coordenar', 'ordenar', 'arrumar', 'compor', 'preparar', 'articular', 'planejar', 'constituir'],
  vender: ['comercializar', 'negociar', 'ofertar', 'colocar', 'revender', 'transacionar', 'alienar'],
  reformar: ['recuperar', 'renovar', 'restaurar', 'reconstruir', 'refazer', 'remodelar', 'reparar', 'consertar', 'modernizar', 'revitalizar', 'requalificar'],
  buscar: ['procurar', 'pesquisar', 'requerer', 'solicitar', 'pleitear'],
  preocupar: ['inquietar', 'afligir', 'angustiar', 'incomodar', 'alarmar', 'perturbar', 'atormentar'],
  aprovar: ['validar', 'ratificar', 'homologar', 'sancionar', 'referendar', 'autorizar', 'acolher', 'deferir', 'endossar', 'respaldar', 'avalizar', 'aplaudir'],
  debater: ['discutir', 'examinar', 'analisar', 'deliberar', 'argumentar', 'ponderar', 'considerar', 'tratar', 'questionar', 'avaliar'],
  apresentar: ['mostrar', 'exibir', 'revelar', 'expor', 'demonstrar', 'divulgar', 'propor', 'entregar', 'introduzir', 'trazer'],
  reduzir: ['diminuir', 'cortar', 'baixar', 'limitar', 'restringir', 'atenuar', 'minimizar', 'encurtar', 'abreviar'],
  recuperar: ['restaurar', 'reconquistar', 'retomar', 'reaver', 'recobrar', 'resgatar', 'consertar', 'reparar', 'reabilitar'],
  enfrentar: ['encarar', 'afrontar', 'combater', 'superar', 'suportar', 'desafiar', 'confrontar'],
  movimentar: ['animar', 'agitar', 'impulsionar', 'dinamizar', 'ativar', 'estimular', 'mover'],
  entregar: ['distribuir', 'fornecer', 'conceder', 'repassar', 'destinar', 'encaminhar', 'ceder', 'transferir'],
  pedir: ['solicitar', 'requerer', 'rogar', 'suplicar', 'demandar', 'reivindicar', 'requisitar', 'pleitear', 'implorar', 'clamar'],
  fiscalizar: ['inspecionar', 'vistoriar', 'verificar', 'controlar', 'monitorar', 'supervisionar', 'examinar', 'auditar', 'acompanhar', 'checar'],
  julgar: ['avaliar', 'examinar', 'decidir', 'apreciar', 'considerar', 'ponderar'],
  negociar: ['discutir', 'pactuar', 'acordar', 'ajustar', 'transigir', 'barganhar', 'deliberar'],
  dividir: ['repartir', 'separar', 'compartilhar', 'distribuir', 'partir', 'fracionar', 'segmentar', 'desmembrar', 'ratear', 'alocar'],
  criar: ['instituir', 'estabelecer', 'fundar', 'constituir', 'formar', 'produzir', 'gerar', 'elaborar', 'desenvolver', 'conceber', 'montar'],
  anunciar: ['divulgar', 'comunicar', 'informar', 'noticiar', 'publicar', 'revelar', 'proclamar', 'declarar', 'propagar', 'avisar'],
  construir: ['erguer', 'edificar', 'levantar', 'erigir', 'montar', 'produzir', 'formar', 'instalar'],
  distribuir: ['entregar', 'repartir', 'dividir', 'alocar', 'destinar', 'encaminhar', 'fornecer', 'compartilhar', 'espalhar', 'ratear'],
  aprender: ['estudar', 'assimilar', 'compreender', 'apreender', 'dominar', 'absorver', 'fixar', 'conhecer', 'entender', 'captar'],
  promover: ['realizar', 'organizar', 'fomentar', 'incentivar', 'impulsionar', 'viabilizar', 'patrocinar', 'estimular', 'desenvolver', 'efetuar'],
  conquistar: ['ganhar', 'obter', 'alcançar', 'conseguir', 'adquirir', 'assegurar', 'garantir', 'dominar', 'vencer'],
  formar: ['capacitar', 'instruir', 'educar', 'preparar', 'treinar', 'constituir', 'compor', 'criar', 'organizar', 'montar'],
  apreender: ['confiscar', 'recolher', 'retirar', 'capturar', 'tomar', 'arrecadar', 'sequestrar', 'embargar', 'reter'],
  questionar: ['contestar', 'indagar', 'criticar', 'desafiar', 'impugnar', 'refutar', 'inquirir'],
  analisar: ['examinar', 'avaliar', 'estudar', 'apreciar', 'verificar', 'inspecionar', 'averiguar', 'investigar', 'considerar', 'ponderar', 'escrutinar', 'sopesar'],
  assinar: ['firmar', 'subscrever', 'rubricar', 'referendar', 'endossar', 'homologar', 'autenticar', 'validar', 'apostilar'],
  votar: ['deliberar', 'decidir', 'escolher', 'referendar', 'homologar', 'submeter', 'eleger'],
  explicar: ['detalhar', 'esclarecer', 'explicitar', 'descrever', 'apresentar', 'justificar', 'comentar', 'narrar', 'demonstrar', 'revelar'],
  ganhar: ['conquistar', 'obter', 'receber', 'arrecadar', 'lucrar', 'faturar', 'angariar', 'alcançar', 'conseguir', 'auferir'],
  sugerir: ['propor', 'indicar', 'recomendar', 'aconselhar', 'insinuar', 'apontar', 'apresentar', 'defender'],
  contratar: ['empregar', 'admitir', 'assalariar', 'recrutar', 'selecionar', 'engajar', 'nomear', 'convocar'],
  procurar: ['buscar', 'pesquisar', 'requerer', 'solicitar', 'localizar'],
  garantir: ['assegurar', 'afiançar', 'certificar', 'confirmar', 'proteger', 'resguardar', 'salvaguardar', 'firmar', 'prometer', 'sustentar'],
  exigir: ['cobrar', 'requerer', 'demandar', 'reivindicar', 'requisitar', 'ordenar', 'impor', 'determinar', 'pressionar', 'reclamar'],
  sentir: ['perceber', 'notar', 'observar', 'experimentar', 'vivenciar', 'pressentir', 'intuir', 'detectar', 'constatar', 'verificar'],
  arrecadar: ['recolher', 'angariar', 'captar', 'obter', 'coletar', 'receber', 'auferir', 'lucrar', 'cobrar'],
  afetar: ['atingir', 'impactar', 'influenciar', 'prejudicar', 'comprometer', 'alterar', 'modificar', 'abalar', 'assolar', 'marcar'],
  iniciar: ['começar', 'principiar', 'abrir', 'instaurar', 'inaugurar', 'deflagrar', 'empreender', 'encetar', 'lançar', 'promover'],
  vistoriar: ['inspecionar', 'fiscalizar', 'examinar', 'verificar', 'controlar', 'revisar', 'checar', 'percorrer', 'avaliar', 'supervisionar'],
  compartilhar: ['dividir', 'repartir', 'partilhar', 'distribuir', 'socializar', 'trocar', 'transmitir', 'difundir', 'comunicar', 'ceder'],
  ajudar: ['auxiliar', 'apoiar', 'socorrer', 'amparar', 'assistir', 'favorecer', 'reforçar', 'atender'],
  adiar: ['postergar', 'procrastinar', 'prorrogar', 'retardar', 'suspender', 'transferir', 'remarcar', 'diferir', 'atrasar', 'sobrestar'],
  celebrar: ['comemorar', 'festejar', 'solenizar', 'homenagear', 'consagrar', 'marcar', 'realizar', 'saudar', 'aplaudir', 'exaltar'],
  herdar: ['receber', 'adquirir', 'suceder', 'obter', 'assumir', 'recolher', 'tomar'],
  chamar: ['convocar', 'convidar', 'denominar', 'nomear', 'intitular', 'requisitar', 'atrair'],
  comprar: ['adquirir', 'arrematar', 'obter', 'importar', 'encomendar', 'contratar'],
  combater: ['enfrentar', 'repelir', 'reprimir', 'debelar', 'eliminar', 'reduzir', 'controlar', 'mitigar', 'neutralizar', 'contestar'],
  denunciar: ['relatar', 'comunicar', 'acusar', 'revelar', 'notificar', 'informar', 'apontar', 'expor', 'declarar'],
  renovar: ['modernizar', 'atualizar', 'reformar', 'restaurar', 'refazer', 'substituir', 'prorrogar', 'revitalizar', 'recompor'],
  expor: ['mostrar', 'exibir', 'apresentar', 'revelar', 'publicar', 'divulgar', 'manifestar', 'declarar', 'demonstrar'],
  exibir: ['mostrar', 'apresentar', 'expor', 'revelar', 'ostentar', 'projetar', 'publicar', 'divulgar', 'demonstrar', 'trazer'],
  reforçar: ['intensificar', 'fortalecer', 'ampliar', 'aumentar', 'consolidar', 'robustecer', 'firmar', 'acentuar', 'apoiar'],
  orientar: ['instruir', 'guiar', 'aconselhar', 'direcionar', 'encaminhar', 'coordenar', 'esclarecer', 'informar', 'conduzir'],
  condenar: ['sentenciar', 'julgar', 'reprovar', 'censurar', 'incriminar', 'penalizar', 'punir', 'acusar', 'desaprovar', 'culpabilizar'],
  investigar: ['apurar', 'averiguar', 'examinar', 'pesquisar', 'sondar', 'escrutinar', 'analisar', 'rastrear', 'verificar', 'inquirir'],
  determinar: ['ordenar', 'decidir', 'estabelecer', 'definir', 'fixar', 'decretar', 'estipular', 'prescrever', 'impor'],
  separar: ['selecionar', 'dividir', 'apartar', 'isolar', 'distinguir', 'classificar', 'escolher', 'retirar', 'desmembrar'],
  plantar: ['cultivar', 'semear', 'produzir', 'criar', 'propagar', 'introduzir'],
  atingir: ['afetar', 'alcançar', 'prejudicar', 'comprometer', 'abater', 'assolar', 'impactar'],
  gerar: ['produzir', 'criar', 'originar', 'provocar', 'causar', 'formar', 'suscitar', 'ocasionar', 'propiciar'],
  ameaçar: ['comprometer'],
  limpar: ['higienizar', 'lavar', 'purificar', 'desinfetar', 'varrer', 'remover', 'sanear', 'assear', 'expurgar', 'desobstruir'],
  experimentar: ['provar', 'testar', 'verificar', 'ensaiar', 'conhecer', 'sentir', 'vivenciar', 'avaliar', 'analisar', 'saborear'],
  tratar: ['combater', 'atender', 'curar', 'assistir', 'acompanhar', 'abordar', 'discutir'],
  causar: ['provocar', 'originar', 'gerar', 'ocasionar', 'produzir', 'suscitar', 'motivar', 'desencadear', 'acarretar', 'implicar'],
  proibir: ['vetar', 'banir', 'interditar', 'impedir', 'bloquear', 'coibir', 'reprimir', 'barrar', 'restringir'],
  discutir: ['debater', 'tratar', 'examinar', 'analisar', 'deliberar', 'argumentar', 'questionar', 'considerar', 'comentar'],
  adotar: ['seguir', 'assumir', 'acolher', 'aprovar', 'escolher', 'implementar', 'aplicar', 'utilizar', 'abraçar', 'incorporar'],
  lançar: ['apresentar', 'divulgar', 'publicar', 'iniciar', 'promover', 'exibir', 'estrear'],
  escolher: ['selecionar', 'eleger', 'optar', 'preferir', 'designar', 'nomear', 'indicar', 'separar', 'distinguir'],
  empregar: ['contratar', 'admitir', 'usar', 'aplicar', 'utilizar', 'destinar', 'alocar', 'ocupar', 'exercer', 'investir'],
  consertar: ['reparar', 'arrumar', 'corrigir', 'restaurar', 'reformar', 'recuperar', 'ajustar', 'revisar', 'renovar'],
  atrair: ['chamar', 'cativar', 'seduzir', 'captar', 'conquistar', 'interessar', 'encantar', 'envolver'],
  vencer: ['ganhar', 'conquistar', 'superar', 'derrotar', 'triunfar', 'sobrepujar', 'dominar', 'ultrapassar'],
  jogar: ['disputar', 'arremessar', 'lançar', 'atirar', 'praticar', 'competir', 'enfrentar'],
  reunir: ['congregar', 'juntar', 'agrupar', 'convocar', 'concentrar', 'unir', 'agregar', 'acolher', 'somar'],
  percorrer: ['cruzar', 'atravessar', 'explorar', 'visitar', 'trilhar', 'seguir', 'cobrir', 'passar'],
  praticar: ['fazer', 'exercer', 'executar', 'realizar', 'efetuar', 'desempenhar', 'treinar', 'adotar', 'seguir'],
  alagar: ['inundar', 'cobrir', 'submergir', 'transbordar', 'molhar', 'encher', 'tomar', 'invadir', 'atingir'],
});
