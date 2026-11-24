// Cenas adicionais do gerador de textos.
//
// O motor usa retomada de sujeito e elipse em orações coordenadas. Para isso
// precisa de mais de uma cena com o mesmo ator dentro do tema. Estas cenas
// completam os pares que faltavam, sem repetir verbo e objeto das cenas base.
//
// A forma é a mesma de js/gerador_textos.js: sujeito, verbo no infinitivo,
// objeto direto com artigo e gênero, e complemento opcional.
const C = (s, v, o, g, c = '') => {
  if (!o) return { s, v, o: null, c };
  const corte = o.indexOf(' ');
  return { s, v, o: { d: o.slice(0, corte), n: o.slice(corte + 1), g }, c };
};

export const CENAS_EXTRA = {
  politica: [
    C('O governo', 'investir', 'mais recursos', 'm', 'na educação'),
    C('A câmara municipal', 'aprovar', 'o novo plano diretor', 'm'),
    C('Os vereadores', 'fiscalizar', 'as obras da prefeitura', 'f'),
    C('A prefeitura', 'instalar', 'a iluminação da praça', 'f'),
  ],
  cidade: [
    C('A prefeitura', 'pintar', 'as faixas de pedestre', 'f'),
    C('Os moradores', 'acompanhar', 'as obras da rua', 'f'),
  ],
  trabalho: [
    C('A empresa', 'contratar', 'os jovens do bairro', 'm'),
    C('Os trabalhadores', 'discutir', 'as condições de segurança', 'f', 'na fábrica'),
  ],
  economia: [
    C('Os pequenos negócios', 'gerar', 'a renda do bairro', 'f'),
    C('A cooperativa de crédito', 'oferecer', 'os empréstimos', 'm', 'aos associados'),
    C('A prefeitura', 'apoiar', 'os empreendedores locais', 'm'),
  ],
  moradia: [
    C('A prefeitura', 'regularizar', 'os imóveis', 'm', 'na comunidade'),
    C('Os moradores', 'acompanhar', 'as obras do condomínio', 'f'),
  ],
  familia: [
    C('As famílias', 'organizar', 'a festa do bairro', 'f'),
    C('Os pais', 'acompanhar', 'as reuniões da escola', 'f'),
  ],
  alimentacao: [
    C('A feira', 'oferecer', 'os produtos frescos', 'm'),
    C('Os agricultores', 'entregar', 'as cestas', 'f', 'no bairro'),
  ],
  saude: [
    C('A prefeitura', 'ampliar', 'o horário de atendimento', 'm'),
    C('Os enfermeiros', 'orientar', 'as famílias', 'f', 'no posto'),
  ],
  mobilidade: [
    C('A prefeitura', 'pintar', 'as faixas de pedestre', 'f'),
    C('Os passageiros', 'esperar', 'o ônibus', 'm', 'no terminal'),
  ],
  educacao_cultura: [
    C('A escola pública', 'abrir', 'a biblioteca', 'f', 'no contraturno'),
    C('Os alunos', 'visitar', 'a feira do livro', 'f'),
  ],
  seguranca_justica: [
    C('A polícia', 'aumentar', 'o patrulhamento', 'm', 'no bairro'),
    C('O conselho de segurança', 'propor', 'as medidas preventivas', 'f'),
  ],
  meio_ambiente: [
    C('A prefeitura', 'ampliar', 'a coleta seletiva', 'f'),
    C('Os ambientalistas', 'plantar', 'as mudas nativas', 'f', 'na margem do rio'),
  ],
  substancias: [
    C('A clínica', 'orientar', 'os dependentes', 'm'),
    C('Os jovens', 'participar', '', '', 'das oficinas de prevenção'),
  ],
  moda: [
    C('Os artesãos', 'vender', 'os acessórios', 'm', 'na feira'),
    C('A loja', 'contratar', 'as costureiras', 'f'),
  ],
  esportes_lazer: [
    C('Os jovens', 'organizar', 'o campeonato', 'm'),
    C('A prefeitura', 'iluminar', 'a quadra', 'f'),
  ],
  cotidiano: [
    C('Os vizinhos', 'ajudar', 'as famílias', 'f'),
    C('Os comerciantes', 'contratar', 'os jovens', 'm'),
  ],
};
