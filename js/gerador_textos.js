// Gerador de textos em português com léxico curado e concordância explícita.
// Cada cena nasce de uma combinação semanticamente plausível de sujeito, verbo
// e objeto. Isso evita os verbos inventados e as concordâncias quebradas do
// gerador antigo, que derivava palavras do catálogo geral sem validação.
import { conjugarVerbo } from './vocabulario.js';
import { SUBSTANTIVOS, VERBOS_TRANSITIVOS } from './lexico_sinonimos.js';
import { CENAS_EXTRA } from './cenas_extra.js';
import { CENAS_AMPLAS_A } from './cenas_amplas_a.js';
import { CENAS_AMPLAS_B } from './cenas_amplas_b.js';
import { CENAS_AMPLAS_C } from './cenas_amplas_c.js';
import { CENAS_AMPLAS_D } from './cenas_amplas_d.js';

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

// Cena: sujeito, verbo no infinitivo, objeto direto com artigo, gênero do
// objeto e complemento opcional (lugar, modo, finalidade).
const C = (s, v, o, g, c = '') => {
  if (!o) return { s, v, o: null, c };
  const corte = o.indexOf(' ');
  return { s, v, o: { d: o.slice(0, corte), n: o.slice(corte + 1), g }, c };
};

export const CENAS = {
  politica: [
    C('A prefeitura', 'aprovar', 'o orçamento do bairro', 'm', 'no conselho municipal'),
    C('A câmara municipal', 'debater', 'a reforma da praça', 'f', 'na sessão ordinária'),
    C('O governo', 'ampliar', 'os programas sociais', 'm', 'para as famílias'),
    C('A oposição', 'questionar', 'o corte de investimentos', 'm', 'na saúde'),
    C('Os partidos', 'organizar', 'a campanha eleitoral', 'f', 'no centro da cidade'),
    C('Os eleitores', 'cobrar', 'as propostas claras', 'f', 'dos candidatos'),
    C('A candidatura', 'apresentar', 'um plano de moradia popular', 'm', 'para a cidade'),
    C('O conselho popular', 'fiscalizar', 'as obras da prefeitura', 'f', 'no bairro'),
    C('A comissão de justiça', 'analisar', 'o projeto de lei', 'm', 'na reunião'),
    C('O prefeito', 'assinar', 'o decreto de emergência', 'm'),
    C('Os vereadores', 'votar', 'o novo plano diretor', 'm', 'na câmara'),
    C('A população', 'participar', '', '', 'da audiência pública'),
    C('O tribunal eleitoral', 'julgar', 'os recursos da campanha', 'm'),
    C('A gestão municipal', 'reduzir', 'as despesas administrativas', 'f'),
    C('O sindicato dos servidores', 'negociar', 'o reajuste salarial', 'm', 'com o governo'),
    C('O movimento social', 'ocupar', 'a praça central', 'f', 'em protesto'),
    C('A imprensa', 'acompanhar', 'a apuração dos votos', 'f'),
    C('O secretário de governo', 'explicar', 'as metas do mandato', 'f', 'à população'),
    C('A coalizão partidária', 'dividir', 'os cargos da administração', 'm'),
  ],
  cidade: [
    C('A prefeitura', 'reformar', 'a praça do bairro', 'f'),
    C('Os moradores', 'cobrar', 'a iluminação da rua', 'f'),
    C('A equipe municipal', 'recuperar', 'a calçada central', 'f'),
    C('O bairro', 'ganhar', 'uma área de lazer', 'f'),
    C('A cidade', 'enfrentar', 'o crescimento do trânsito', 'm'),
    C('O conselho de bairro', 'acompanhar', 'as obras municipais', 'f'),
    C('Os comerciantes', 'reclamar', '', '', 'da falta de segurança'),
    C('A secretaria de obras', 'ampliar', 'a ciclovia', 'f'),
    C('O centro', 'receber', 'um projeto de revitalização', 'm'),
    C('A população', 'sugerir', 'as melhorias no transporte', 'f'),
    C('Os vizinhos', 'organizar', 'um mutirão de limpeza', 'm'),
    C('A prefeitura', 'investir', '', '', 'na drenagem das ruas'),
    C('O trânsito', 'mudar', '', '', 'com a nova rotatória'),
    C('A praça central', 'receber', 'uma feira de artesanato', 'f'),
    C('Os moradores', 'aprovar', 'a reforma da escola local', 'f'),
  ],
  trabalho: [
    C('A empresa', 'abrir', 'as novas vagas no comércio', 'f'),
    C('Os trabalhadores', 'negociar', 'o reajuste salarial', 'm', 'com a direção'),
    C('O sindicato', 'defender', 'os direitos dos empregados', 'm'),
    C('A prefeitura', 'criar', 'um programa de qualificação', 'm'),
    C('Os jovens', 'buscar', 'o primeiro emprego', 'm'),
    C('A cooperativa', 'organizar', 'a produção local', 'f'),
    C('Os funcionários', 'cobrar', 'as melhores condições de trabalho', 'f'),
    C('O mercado', 'contratar', 'os técnicos de manutenção', 'm'),
    C('A renda média', 'crescer', '', '', 'no bairro'),
    C('Os desempregados', 'procurar', 'os cursos profissionalizantes', 'm'),
    C('A fábrica', 'ampliar', 'o turno da noite', 'm'),
    C('O contrato', 'garantir', 'o pagamento das horas extras', 'm'),
    C('Os servidores públicos', 'exigir', 'a revisão do plano de carreira', 'f'),
    C('A loja', 'oferecer', 'o treinamento aos novos atendentes', 'm'),
  ],
  economia: [
    C('O comércio local', 'sentir', 'a queda das vendas', 'f'),
    C('Os preços', 'aumentar', '', '', 'no mercado do bairro'),
    C('O banco', 'reduzir', 'a taxa de juros', 'f'),
    C('A prefeitura', 'arrecadar', 'os impostos', 'm'),
    C('Os pequenos negócios', 'buscar', 'o crédito', 'm'),
    C('A inflação', 'afetar', 'o orçamento das famílias', 'm'),
    C('O investimento', 'crescer', '', '', 'no setor de serviços'),
    C('A dívida pública', 'preocupar', 'os economistas', 'm'),
    C('O mercado', 'abrir', 'as novas oportunidades de trabalho', 'f'),
    C('Os consumidores', 'comparar', 'os preços', 'm'),
    C('A moeda', 'cair', '', '', 'diante do dólar'),
    C('O governo', 'anunciar', 'um pacote de incentivos', 'm'),
    C('A cooperativa de crédito', 'atender', 'os produtores rurais', 'm'),
    C('O lucro das empresas', 'cair', '', '', 'no trimestre'),
    C('A feira', 'movimentar', 'a economia do bairro', 'f'),
  ],
  moradia: [
    C('A prefeitura', 'entregar', 'as novas moradias populares', 'f'),
    C('Os moradores', 'cobrar', 'a regularização dos imóveis', 'f'),
    C('O aluguel', 'aumentar', '', '', 'no centro da cidade'),
    C('A construtora', 'iniciar', 'as obras do condomínio', 'f'),
    C('As famílias', 'ocupar', 'o prédio abandonado', 'm'),
    C('O programa habitacional', 'atender', 'as famílias mais pobres', 'f'),
    C('Os inquilinos', 'reclamar', '', '', 'das condições do imóvel'),
    C('A comunidade', 'lutar', '', '', 'contra a remoção'),
    C('O proprietário', 'reformar', 'a casa antiga', 'f'),
    C('A prefeitura', 'vistoriar', 'os imóveis vazios', 'm'),
    C('O bairro', 'receber', 'o saneamento básico', 'm'),
    C('Os sem-teto', 'pedir', 'uma solução para a moradia', 'f'),
    C('A imobiliária', 'anunciar', 'os novos apartamentos', 'm'),
    C('O condomínio', 'aprovar', 'as regras de convivência', 'f'),
    C('As famílias', 'construir', 'as casas na periferia', 'f'),
  ],
  familia: [
    C('As famílias', 'compartilhar', 'o almoço de domingo', 'm'),
    C('Os pais', 'acompanhar', 'a educação dos filhos', 'f'),
    C('A creche', 'atender', 'as crianças do bairro', 'f'),
    C('Os vizinhos', 'ajudar', 'as famílias mais vulneráveis', 'f'),
    C('O casal', 'adiar', 'o casamento', 'm'),
    C('Os jovens', 'cuidar', '', '', 'dos avós'),
    C('A comunidade', 'celebrar', 'a festa das mães', 'f'),
    C('Os filhos', 'herdar', 'a casa da família', 'f'),
    C('A escola', 'chamar', 'os responsáveis', 'm', 'para uma reunião'),
    C('As mães', 'cobrar', 'a segurança para as crianças', 'f'),
    C('O pai', 'assumir', 'o cuidado dos filhos', 'm'),
    C('Os irmãos', 'dividir', 'as tarefas da casa', 'f'),
    C('A família', 'receber', 'o apoio do centro comunitário', 'm'),
    C('Os adolescentes', 'participar', '', '', 'do projeto social'),
    C('A vizinhança', 'organizar', 'uma festa para as crianças', 'f'),
  ],
  alimentacao: [
    C('A feira', 'vender', 'as frutas e verduras frescas', 'f'),
    C('As famílias', 'comprar', 'os alimentos', 'm', 'no mercado local'),
    C('O restaurante popular', 'oferecer', 'as refeições baratas', 'f'),
    C('Os agricultores', 'colher', 'a safra de milho', 'f'),
    C('A cozinha comunitária', 'distribuir', 'os alimentos', 'm'),
    C('Os preços dos alimentos', 'preocupar', 'os moradores', 'm'),
    C('O banco de alimentos', 'receber', 'as doações', 'f'),
    C('A escola', 'oferecer', 'a merenda', 'f', 'aos alunos'),
    C('Os produtores', 'vender', 'os produtos', 'm', 'diretamente ao consumidor'),
    C('A horta comunitária', 'produzir', 'os legumes', 'm'),
    C('O caminhão', 'entregar', 'a comida', 'f', 'nas lojas'),
    C('As crianças', 'aprender', '', '', 'sobre alimentação saudável'),
    C('O açougue', 'fechar', '', '', 'por falta de carne'),
    C('A padaria', 'ampliar', 'a produção de pães', 'f'),
    C('Os restaurantes', 'reclamar', '', '', 'do custo dos insumos'),
  ],
  saude: [
    C('O posto de saúde', 'atender', 'os moradores', 'm'),
    C('Os médicos', 'alertar', '', '', 'sobre a dengue'),
    C('A prefeitura', 'ampliar', 'o atendimento nas clínicas', 'm'),
    C('Os enfermeiros', 'cobrar', 'os melhores salários', 'm'),
    C('A farmácia popular', 'distribuir', 'os remédios', 'm'),
    C('O hospital', 'receber', 'os novos equipamentos', 'm'),
    C('As famílias', 'buscar', 'a vacinação para as crianças', 'f'),
    C('O agente de saúde', 'visitar', 'as casas', 'f'),
    C('A fila do SUS', 'preocupar', 'os pacientes', 'm'),
    C('Os dentistas', 'atender', 'as escolas', 'f'),
    C('A campanha', 'combater', 'a desnutrição infantil', 'f'),
    C('Os idosos', 'receber', 'o acompanhamento médico', 'm'),
    C('A secretaria de saúde', 'promover', 'uma campanha de vacinação', 'f'),
    C('O pronto-socorro', 'atender', 'os casos graves', 'm'),
    C('Os profissionais', 'denunciar', 'a falta de leitos', 'f'),
  ],
  mobilidade: [
    C('Os ônibus', 'aumentar', 'a frequência', 'f', 'no horário de pico'),
    C('A prefeitura', 'construir', 'uma nova ciclovia', 'f'),
    C('Os passageiros', 'reclamar', '', '', 'da lotação'),
    C('O trânsito', 'parar', '', '', 'no centro'),
    C('A empresa de transporte', 'renovar', 'a frota', 'f'),
    C('Os moradores', 'pedir', 'as linhas de ônibus', 'f'),
    C('A calçada', 'receber', 'a adaptação para cadeirantes', 'f'),
    C('O metrô', 'ampliar', 'o horário de funcionamento', 'm'),
    C('Os motoristas', 'enfrentar', 'o congestionamento', 'm'),
    C('A ponte', 'receber', 'a manutenção preventiva', 'f'),
    C('As bicicletas', 'conquistar', 'o espaço nas ruas', 'm'),
    C('A sinalização', 'melhorar', '', '', 'nos cruzamentos'),
    C('Os pedestres', 'cobrar', 'as travessias seguras', 'f'),
    C('A estação de trem', 'receber', 'uma reforma', 'f'),
  ],
  educacao_cultura: [
    C('A escola pública', 'receber', 'os novos livros', 'm'),
    C('Os professores', 'cobrar', 'as melhores condições de trabalho', 'f'),
    C('A biblioteca do bairro', 'ampliar', 'o acervo', 'm'),
    C('Os alunos', 'participar', '', '', 'do projeto de leitura'),
    C('O teatro municipal', 'apresentar', 'uma peça gratuita', 'f'),
    C('Os artistas locais', 'expor', 'as obras', 'f', 'no centro cultural'),
    C('A prefeitura', 'investir', '', '', 'na educação infantil'),
    C('Os estudantes', 'protestar', '', '', 'contra os cortes'),
    C('O museu', 'abrir', 'uma exposição sobre a cidade', 'f'),
    C('A banda da escola', 'ensaiar', '', '', 'no ginásio'),
    C('Os cursos técnicos', 'formar', 'os novos profissionais', 'm'),
    C('A feira do livro', 'movimentar', 'a praça', 'f'),
    C('Os jovens', 'aprender', 'a música', 'f', 'no projeto social'),
    C('A universidade', 'oferecer', 'os cursos comunitários', 'm'),
    C('O cinema de rua', 'exibir', 'os filmes nacionais', 'm'),
  ],
  seguranca_justica: [
    C('A polícia', 'reforçar', 'o patrulhamento', 'm', 'no bairro'),
    C('Os moradores', 'cobrar', 'a segurança', 'f'),
    C('O tribunal', 'julgar', 'o caso do assalto', 'm'),
    C('A guarda municipal', 'orientar', 'os comerciantes', 'm'),
    C('O crime', 'cair', '', '', 'após a instalação das câmeras'),
    C('Os juízes', 'condenar', 'os responsáveis pela fraude', 'm'),
    C('A defensoria pública', 'atender', 'os mais pobres', 'm'),
    C('Os agentes', 'apreender', 'as armas', 'f'),
    C('O sistema prisional', 'enfrentar', 'a superlotação', 'f'),
    C('As vítimas', 'receber', 'o apoio jurídico', 'm'),
    C('O conselho de segurança', 'debater', 'as ações da polícia', 'f', 'com a comunidade'),
    C('O Ministério Público', 'investigar', 'o desvio de recursos', 'm'),
    C('A justiça', 'determinar', 'a prisão dos suspeitos', 'f'),
    C('Os policiais', 'recuperar', 'os bens roubados', 'm'),
    C('A cidade', 'debater', 'o combate à violência', 'm'),
  ],
  meio_ambiente: [
    C('A prefeitura', 'recuperar', 'a mata ciliar do rio', 'f'),
    C('Os moradores', 'separar', 'o lixo reciclável', 'm'),
    C('A poluição do ar', 'piorar', '', '', 'no inverno'),
    C('O projeto de arborização', 'plantar', 'as novas árvores', 'f'),
    C('A enchente', 'atingir', 'as casas da várzea', 'f'),
    C('Os ambientalistas', 'defender', 'a preservação da floresta', 'f'),
    C('A usina solar', 'gerar', 'a energia limpa', 'f'),
    C('Os pescadores', 'reclamar', '', '', 'da água contaminada'),
    C('A coleta seletiva', 'chegar', '', '', 'ao bairro'),
    C('O desmatamento', 'ameaçar', 'a biodiversidade', 'f'),
    C('A cidade', 'ampliar', 'a rede de saneamento', 'f'),
    C('Os voluntários', 'limpar', 'a praia', 'f', 'no domingo'),
    C('O calor extremo', 'preocupar', 'os moradores', 'm'),
    C('A horta comunitária', 'reduzir', 'os resíduos', 'm'),
    C('O rio', 'receber', 'um projeto de despoluição', 'm'),
  ],
  substancias: [
    C('A campanha', 'alertar', '', '', 'sobre o uso de álcool'),
    C('Os jovens', 'experimentar', 'as bebidas', 'f', 'na festa'),
    C('O posto de saúde', 'tratar', 'a dependência química', 'f'),
    C('A prefeitura', 'fiscalizar', 'a venda de cigarros', 'f'),
    C('Os moradores', 'reclamar', '', '', 'do consumo de drogas na praça'),
    C('O álcool', 'causar', 'os acidentes', 'm', 'no trânsito'),
    C('A clínica', 'oferecer', 'o tratamento para fumantes', 'm'),
    C('As famílias', 'buscar', 'o apoio contra o crack', 'm'),
    C('A escola', 'promover', 'uma conversa sobre drogas', 'f'),
    C('O comércio', 'vender', 'as bebidas', 'f', 'até tarde'),
    C('A polícia', 'apreender', 'as drogas', 'f', 'no bairro'),
    C('Os dependentes', 'receber', 'a ajuda', 'f', 'no centro de acolhimento'),
    C('A lei', 'proibir', 'o fumo em locais fechados', 'm'),
    C('Os bares', 'receber', 'a orientação sobre o consumo responsável', 'f'),
    C('A comunidade', 'discutir', 'a redução de danos', 'f'),
  ],
  moda: [
    C('Os jovens', 'adotar', 'as tendências da moda', 'f'),
    C('A costureira', 'produzir', 'as roupas sob medida', 'f'),
    C('A feira', 'vender', 'os tecidos e acessórios', 'm'),
    C('Os brechós', 'conquistar', 'o espaço no bairro', 'm'),
    C('A escola de moda', 'formar', 'os novos estilistas', 'm'),
    C('Os artesãos', 'criar', 'as bolsas de couro', 'f'),
    C('A loja', 'lançar', 'a coleção de verão', 'f'),
    C('Os consumidores', 'escolher', 'as roupas sustentáveis', 'f'),
    C('O desfile', 'apresentar', 'os trabalhos dos alunos', 'm'),
    C('A alfaiataria', 'reformar', 'os ternos antigos', 'm'),
    C('Os moradores', 'trocar', 'as roupas', 'f', 'na feira'),
    C('A indústria têxtil', 'empregar', 'a comunidade', 'f'),
    C('O sapateiro', 'consertar', 'os calçados dos vizinhos', 'm'),
    C('A boutique', 'vender', 'as peças de designers locais', 'f'),
    C('Os acessórios coloridos', 'atrair', 'os turistas', 'm'),
  ],
  esportes_lazer: [
    C('O time do bairro', 'vencer', 'o campeonato', 'm'),
    C('Os jovens', 'jogar', 'uma partida de futebol', 'f', 'na praça'),
    C('A prefeitura', 'reformar', 'a quadra esportiva', 'f'),
    C('Os moradores', 'caminhar', '', '', 'no parque'),
    C('A piscina pública', 'receber', 'uma reforma', 'f'),
    C('Os atletas', 'treinar', '', '', 'para a corrida'),
    C('As crianças', 'brincar', '', '', 'no parque infantil'),
    C('O clube', 'oferecer', 'as aulas de natação', 'f'),
    C('A festa junina', 'reunir', 'a comunidade', 'f'),
    C('Os ciclistas', 'percorrer', 'a orla', 'f'),
    C('O campeonato de futebol', 'movimentar', 'a cidade', 'f'),
    C('Os idosos', 'praticar', 'a ginástica', 'f', 'no centro'),
    C('A praia', 'receber', 'um torneio de vôlei', 'm'),
    C('Os moradores', 'pedir', 'as áreas de lazer', 'f'),
    C('O ginásio', 'sediar', 'o jogo da final', 'm'),
  ],
  cotidiano: [
    C('Os moradores', 'conversar', '', '', 'na calçada'),
    C('A padaria', 'abrir', '', '', 'cedo no bairro'),
    C('As crianças', 'voltar', '', '', 'da escola'),
    C('Os vizinhos', 'organizar', 'a festa da rua', 'f'),
    C('O ônibus', 'passar', '', '', 'cheio pela manhã'),
    C('A feira', 'ocupar', 'a praça', 'f', 'no domingo'),
    C('Os comerciantes', 'abrir', 'as lojas', 'f'),
    C('As famílias', 'almoçar', '', '', 'juntas'),
    C('O carteiro', 'entregar', 'as cartas', 'f'),
    C('Os jovens', 'encontrar', 'os amigos', 'm', 'na praça'),
    C('A cidade', 'acordar', '', '', 'com o barulho dos carros'),
    C('Os idosos', 'descansar', '', '', 'na sombra'),
    C('A chuva', 'alagar', 'a rua principal', 'f'),
    C('Os moradores', 'reclamar', '', '', 'do barulho'),
    C('O bairro', 'receber', 'a visita dos parentes', 'f'),
  ],
};

// As cenas extras completam os pares de mesmo ator usados pela elipse e
// ampliam o repertório sem tocar nas cenas base.
for (const [tema, extras] of Object.entries(CENAS_EXTRA)) {
  if (CENAS[tema]) CENAS[tema].push(...extras);
}

// Cenas amplas entram sem repetir uma cena que já exista no tema. A checagem
// por JSON compara sujeito, verbo, objeto e complemento ao mesmo tempo.
const CENAS_AMPLAS = {
  ...CENAS_AMPLAS_A, ...CENAS_AMPLAS_B, ...CENAS_AMPLAS_C, ...CENAS_AMPLAS_D,
};
for (const [tema, cenas] of Object.entries(CENAS_AMPLAS)) {
  if (!CENAS[tema]) continue;
  const existentes = new Set(CENAS[tema].map(cena => JSON.stringify(cena)));
  for (const cena of cenas) {
    const chave = JSON.stringify(cena);
    if (existentes.has(chave)) continue;
    existentes.add(chave);
    CENAS[tema].push(cena);
  }
}

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

const PASSIVAVEIS = new Set([
  'aprovar', 'debater', 'analisar', 'fiscalizar', 'julgar', 'assinar',
  'votar', 'reformar', 'recuperar', 'ampliar', 'construir', 'entregar',
  'regularizar', 'iniciar', 'vistoriar', 'criar', 'organizar', 'contratar',
  'garantir', 'arrecadar', 'anunciar', 'atender', 'investigar', 'condenar',
  'determinar', 'instalar', 'plantar', 'limpar', 'tratar', 'distribuir',
  'produzir', 'renovar', 'adaptar', 'melhorar', 'exibir', 'apresentar',
  'atingir', 'ameaçar', 'preservar', 'reduzir', 'empregar', 'consertar',
  'formar', 'sediar', 'ocupar', 'alagar', 'reforçar', 'apreender',
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

// Verbos que aceitam a passiva sintética sem mudar de sentido. Ficam de fora
// os que, com "se", viram outra coisa: formar-se (diplomar-se), ocupar-se de,
// empregar-se, tratar-se de, apresentar-se, reunir-se.
const PASSIVA_SE = new Set([
  'aprovar', 'debater', 'analisar', 'fiscalizar', 'julgar', 'assinar',
  'votar', 'reformar', 'recuperar', 'ampliar', 'construir', 'entregar',
  'regularizar', 'iniciar', 'vistoriar', 'criar', 'organizar', 'contratar',
  'garantir', 'arrecadar', 'anunciar', 'atender', 'investigar', 'condenar',
  'determinar', 'instalar', 'plantar', 'limpar', 'distribuir', 'produzir',
  'renovar', 'adaptar', 'melhorar', 'exibir', 'atingir', 'preservar',
  'reduzir', 'consertar', 'sediar', 'alagar', 'reforçar', 'apreender',
]);

const DIZER = {
  singular: ['anunciou', 'informou', 'afirmou', 'confirmou', 'prometeu'],
  plural: ['anunciaram', 'informaram', 'afirmaram', 'confirmaram', 'prometeram'],
};

// A inversão só soa natural com verbo de movimento ou estado e adjunto
// locativo. Com complemento preposicional ("investir na drenagem") ela vira
// frase artificial, então esses casos ficam na ordem direta.
const INVERSIVEIS = new Set([
  'caminhar', 'conversar', 'descansar', 'brincar', 'passar', 'acordar',
  'almoçar', 'voltar', 'chegar', 'treinar', 'ensaiar', 'cair', 'crescer',
  'parar', 'protestar', 'lutar',
]);

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

// Atribuição de fala só combina com ator que pode falar. Uma praça ou um
// índice econômico não anunciam nada; instituições e pessoas anunciam.
const FALANTES = /^(?:A prefeitura|O governo|A câmara|A oposição|Os partidos|Os eleitores|A candidatura|O conselho|A comissão|O prefeito|Os vereadores|A população|O tribunal|A gestão|O sindicato|O movimento|A imprensa|O secretário|A coalizão|A empresa|Os trabalhadores|A cooperativa|Os funcionários|O mercado|Os desempregados|A fábrica|A loja|Os servidores|O banco|Os pequenos|Os consumidores|Os moradores|Os comerciantes|Os vizinhos|A secretaria|A equipe|A polícia|A guarda|Os juízes|A defensoria|Os agentes|As vítimas|O Ministério|A justiça|Os enfermeiros|Os médicos|Os dentistas|Os profissionais|Os professores|Os alunos|Os estudantes|Os artistas|Os atletas|Os idosos|As crianças|Os pais|As famílias|Os feirantes|Os agricultores|Os ambientalistas|Os pescadores|Os voluntários|A clínica|A escola|A universidade|A biblioteca|O teatro|O museu|A banda|O time|O clube|A padaria|O restaurante|O açougue|O hospital|O posto|A farmácia|Os jovens|As mães|O pai|Os filhos|Os irmãos|O casal|A creche|A vizinhança|O agente|O pronto-socorro)\b/iu;

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

  if (frente) oracao = `${minusculaInicial(cena.c)}, ${minusculaInicial(oracao)}`;
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
  if (rolagem < limiteAtribuicao && cena.o && FALANTES.test(cena.s)) {
    if (opts.meta) opts.meta.tipo = 'atribuicao';
    return montarAtribuicao(cena, random);
  }
  if (rolagem < limiteInversao && !cena.o && cena.c && INVERSIVEIS.has(cena.v) && ADJUNTO_INVERSIVEL.test(cena.c)) {
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
    if (PREPOSICOES_DO_SINTAGMA.has(tokens[i].toLocaleLowerCase('pt-BR'))) break;
    const opcoes = SUBSTANTIVOS[tokens[i].toLocaleLowerCase('pt-BR')];
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
  const sujeito = random() < 0.38
    ? trocarCabeca(cena.s.split(' '), 1, random, 2)
    : cena.s;
  const verbo = cena.o && VERBOS_TRANSITIVOS[cena.v] && random() < 0.34
    ? escolhe(VERBOS_TRANSITIVOS[cena.v], random)
    : cena.v;
  const objeto = cena.o && random() < 0.3
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

export function gerarFrase({ tema = null, random = Math.random, complexidade = 'variada', estilo = 'auto' } = {}) {
  if (typeof random !== 'function') throw new TypeError('random precisa ser uma função');
  if (!PERFIS[estilo]) throw new RangeError(`Estilo desconhecido: ${estilo}`);
  const temas = temasResolvidos(tema);
  const cenas = cenasDosTemas(temas);
  if (!cenas.length) throw new RangeError(`Os temas ${temas.join(', ')} não têm cenas suficientes`);
  const level = complexidade === 'simples' ? 'simples' : complexidade === 'complexa' ? 'complexa' : 'variada';
  const usadas = new Set();
  const relacoesUsadas = new Set();

  const primeiraBase = escolhe(cenas, random);
  usadas.add(primeiraBase);
  const primeira = aplicarVariantes(primeiraBase, random);
  const meta = {};
  let frase = realizarOracao(primeira, random, {
    level, estilo, meta,
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

export function gerarFraseTematica(tema, { random = Math.random, complexidade = 'variada', estilo = 'auto' } = {}) {
  if (!tema) throw new RangeError(`Tema desconhecido: ${tema}`);
  temasResolvidos(tema);
  return gerarFrase({ tema, random, complexidade, estilo });
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

// O léxico curado não exige aquecimento. A função permanece exportada para
// manter compatível a inicialização do simulador e do app.
export function aquecerCatalogos() {}
