// Extensão manual do vocabulário de pichações preconceituosas.
//
// O jogo trata cada pichação preconceituosa como crime de ódio: o caso entra na
// justiça com `discriminatoryAct`, pode ser investigado, julgado e condenado, e
// a pena segue `PREJUDICE_CRIME_TYPES`. O conteúdo ofensivo não é gerado pelo
// projeto: cada categoria começa vazia e recebe termos revisados manualmente.
//
// Formato de cada entrada:
//   {id: 'identificador-unico', m: 'forma masculina', f: 'forma feminina'}
//
// `m` é obrigatório. Sem `f`, a forma masculina é usada para os dois gêneros.
// Para substantivo de gênero fixo, informe as duas formas iguais.
//
// Exemplo de cadastro (substitua pelos termos revisados):
//   OFENSAS_POR_PRECONCEITO.racismo.push({id: 'termo-1', m: '...', f: '...'});
import {PREJUDICE_TYPES} from './city_prejudice.js?v=discrimination-laws-1';

// Uma lista por categoria de PREJUDICE_TYPES. Mantenha a chave e altere só os
// itens. A lista vazia é válida: a categoria fica sem texto gerado até receber
// uma entrada.
export const OFENSAS_POR_PRECONCEITO = Object.fromEntries(
  Object.keys(PREJUDICE_TYPES).map(tipo => [tipo, []]),
);

OFENSAS_POR_PRECONCEITO.racismo.push(
  {id: 'racismo-1', m: 'colorido', f: 'colorida'},
  {id: 'racismo-2', m: 'descolorido', f: 'descolorida'},
  {id: 'racismo-3', m: 'pastel', f: 'pastela'},
  {id: 'racismo-4', m: 'estourado', f: 'estourada'},
  {id: 'racismo-5', m: 'palido', f: 'palida'},
);

OFENSAS_POR_PRECONCEITO.homofobia.push(
  {id: 'homofobia-1', m: 'viado', f: 'sapatão'},
  {id: 'homofobia-2', m: 'queima-rosca', f: 'chupa-charque'},
  {id: 'homofobia-3', m: 'frango', f: 'sapa'},
  {id: 'homofobia-4', m: 'gayzão', f: 'gayzona'},
  {id: 'homofobia-5', m: 'gayzinho', f: 'gayzinha'},
  {id: 'homofobia-6', m: 'biba', f: 'sapadrão'},
);

OFENSAS_POR_PRECONCEITO.transfobia.push(
  {id: 'transfobia-1', m: 'traveco', f: 'traveca'},
  {id: 'transfobia-2', m: 'veveco', f: 'veveca'},
);

OFENSAS_POR_PRECONCEITO.machismo.push(
  {id: 'machismo-1', m: 'mulherzinha', f: 'mulherzinha'},
  {id: 'machismo-2', m: 'dono de casa', f: 'dona de casa'},
);

OFENSAS_POR_PRECONCEITO.preconceitoBaixaEstatura.push(
  {id: 'preconceitoBaixaEstatura-1', m: 'nanico', f: 'nanica'},
  {id: 'preconceitoBaixaEstatura-2', m: 'tamburete', f: 'tamburete'},
  {id: 'preconceitoBaixaEstatura-3', m: 'pigmeu', f: 'pigmeia'},
  {id: 'preconceitoBaixaEstatura-4', m: 'anão', f: 'anã'},
);

OFENSAS_POR_PRECONCEITO.preconceitoAltaEstatura.push(
  {id: 'preconceitoAltaEstatura-1', m: 'girafa', f: 'girafa'},
  {id: 'preconceitoAltaEstatura-2', m: 'vara', f: 'vareta'},
  {id: 'preconceitoAltaEstatura-3', m: 'cigarro', f: 'escada'},
);

OFENSAS_POR_PRECONCEITO.gordofobia.push(
  {id: 'gordofobia-1', m: 'gordo', f: 'gorda'},
  {id: 'gordofobia-2', m: 'peixe-boi', f: 'baleia'},
  {id: 'gordofobia-3', m: 'mamute', f: 'orca'},
  {id: 'gordofobia-4', m: 'redondo', f: 'redonda'},
  {id: 'gordofobia-5', m: 'bola', f: 'bola'},
  {id: 'gordofobia-6', m: 'imenso', f: 'imensa'},
  {id: 'gordofobia-7', m: 'obeso', f: 'obesa'},
  {id: 'gordofobia-8', m: 'inchado', f: 'inchada'},
);

OFENSAS_POR_PRECONCEITO.magrofobia.push(
  {id: 'magrofobia-1', m: 'girafales', f: 'olivia palito'},
  {id: 'magrofobia-2', m: 'palito de dente', f: 'palito de fosforo'},
);

export function categoriasDePreconceito() {
  return Object.keys(OFENSAS_POR_PRECONCEITO);
}

export function ofensasDaCategoria(tipo) {
  const lista = OFENSAS_POR_PRECONCEITO[tipo];
  if (!lista) throw new RangeError(`categoria de preconceito desconhecida: ${tipo}`);
  // Normaliza também entradas adicionadas direto na lista, sem passar pelo
  // registrar: `m` é obrigatório e `f` cai para `m`.
  return lista.flatMap((entrada, indice) => {
    const m = String(entrada?.m ?? '').replace(/\s+/gu, ' ').trim();
    if (!m) return [];
    const f = String(entrada?.f ?? m).replace(/\s+/gu, ' ').trim() || m;
    return [{id: String(entrada?.id ?? `${tipo}-${indice + 1}`).trim(), m, f}];
  });
}

export function registrarOfensaPreconceito(tipo, entrada) {
  const lista = OFENSAS_POR_PRECONCEITO[tipo];
  if (!lista) throw new RangeError(`categoria de preconceito desconhecida: ${tipo}`);
  const m = String(entrada?.m ?? '').replace(/\s+/gu, ' ').trim();
  const f = String(entrada?.f ?? m).replace(/\s+/gu, ' ').trim() || m;
  if (!m) throw new TypeError('a ofensa precisa da forma masculina');
  const id = String(entrada?.id ?? `${tipo}-${lista.length + 1}`).trim();
  if (lista.some(item => item.id === id)) throw new RangeError(`ofensa repetida: ${id}`);
  const item = Object.freeze({id, m, f});
  lista.push(item);
  return item;
}

export function removerOfensaPreconceito(tipo, id) {
  const lista = OFENSAS_POR_PRECONCEITO[tipo];
  if (!lista) throw new RangeError(`categoria de preconceito desconhecida: ${tipo}`);
  const indice = lista.findIndex(item => item.id === id);
  if (indice < 0) return false;
  lista.splice(indice, 1);
  return true;
}
