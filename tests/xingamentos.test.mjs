import test from 'node:test';
import assert from 'node:assert/strict';
import {
  XINGAMENTOS,
  INTENSIFICADORES,
  MODELOS,
  CATEGORIAS_DE_ODIO,
  gerarXingamento,
  gerarXingamentoDetalhado,
  limitarXingamento,
  crimeDeOdio,
} from '../js/xingamentos.js';
import {graffitiContent, graffitiMessage, graffitiDeOdio} from '../js/city_graffiti_text.js';

const zero = () => 0;
const sorteioDaEntrada = (id, tipo) => {
  const entradas = XINGAMENTOS.filter(item => item.tipos.includes(tipo));
  const indice = entradas.findIndex(item => item.id === id);
  assert(indice >= 0, id);
  return (indice + 0.5) / entradas.length;
};

test('xingamento is deterministic and respects the requested model', () => {
  const opcoes = {alvo: 'Fulano', tipo: 'conduta', modelo: 'e', intensidade: 0, random: zero};
  assert.equal(gerarXingamento(opcoes), 'Fulano é um ladrão');
  assert.equal(gerarXingamento(opcoes), gerarXingamento(opcoes));
});

test('feminine targets use the feminine form and article', () => {
  assert.equal(gerarXingamento({alvo: 'Fulana', genero: 'f', tipo: 'conduta', modelo: 'e', intensidade: 0, random: zero}), 'Fulana é uma ladra');
  assert.equal(gerarXingamento({alvo: 'Fulano', genero: 'm', tipo: 'conduta', modelo: 'e', intensidade: 0, random: zero}), 'Fulano é um ladrão');
});

test('fixed-gender nouns keep their own article', () => {
  assert.equal(gerarXingamento({alvo: 'Fulana', genero: 'f', tipo: 'desprezo', modelo: 'e', intensidade: 0, random: () => sorteioDaEntrada('lixo', 'desprezo')}), 'Fulana é um lixo');
});

test('intensity adds a curated modifier', () => {
  const texto = gerarXingamento({alvo: 'Fulano', tipo: 'conduta', modelo: 'e', intensidade: 1, random: zero});
  assert.equal(texto, 'Fulano é um ladrão do caralho');
  assert(INTENSIFICADORES.includes('do caralho'));
});

test('pixação uppercases the text and keeps the graffiti limit', () => {
  const texto = gerarXingamento({alvo: 'Fulano', tipo: 'conduta', modelo: 'e', intensidade: 0, random: zero, pixacao: true});
  assert.equal(texto, 'FULANO É UM LADRÃO');
  assert(limitarXingamento('palavra '.repeat(40)).length <= 180);
});

test('tipo restricts the repertoire and unknown values fail', () => {
  assert.equal(gerarXingamento({alvo: 'Fulano', tipo: 'desprezo', modelo: 'seco', intensidade: 0, random: () => sorteioDaEntrada('lixo', 'desprezo')}), 'Fulano lixo');
  assert.throws(() => gerarXingamento({tipo: 'inexistente'}), RangeError);
  assert.throws(() => gerarXingamento({modelo: 'inexistente'}), RangeError);
});

test('the detailed form exposes the choices without changing the text', () => {
  const detalhado = gerarXingamentoDetalhado({alvo: 'Fulana', genero: 'f', tipo: 'politica', modelo: 'e', intensidade: 1, random: zero});
  assert.equal(detalhado.texto, 'Fulana é uma ladra do caralho');
  assert.equal(detalhado.alvo, 'Fulana');
  assert.equal(detalhado.genero, 'f');
  assert.equal(detalhado.modelo, 'e');
  assert.equal(detalhado.intensificador, 'do caralho');
});

test('every curated entry has both forms and a known model', () => {
  for (const item of XINGAMENTOS) {
    assert(item.id && item.m && item.f, item.id);
    assert(Array.isArray(item.tipos) && item.tipos.length > 0, item.id);
  }
  for (const modelo of MODELOS) {
    assert(typeof modelo === 'string' && modelo.length > 0, modelo);
  }
});

test('every model produces text with the target and no placeholder', () => {
  for (const modelo of MODELOS) {
    const texto = gerarXingamento({alvo: 'Fulano', tipo: 'conduta', modelo, intensidade: 0, random: zero});
    assert(texto.includes('Fulano'), `${modelo}: ${texto}`);
    assert(!texto.includes('undefined'), `${modelo}: ${texto}`);
    assert(texto.length <= 180, `${modelo}: ${texto}`);
  }
});

test('triple and interrogative models keep agreement and punctuation', () => {
  assert.equal(gerarXingamento({alvo: 'Fulano', tipo: 'conduta', modelo: 'triplo', intensidade: 0, random: zero}), 'Fulano, ladrão, corrupto e bandido');
  assert.equal(gerarXingamento({alvo: 'Fulano', tipo: 'conduta', modelo: 'interrogacao', intensidade: 0, random: zero}), 'Fulano, ladrão?');
  assert.equal(gerarXingamento({alvo: 'Fulano', tipo: 'conduta', modelo: 'sigla', intensidade: 0, random: zero}), 'Fulano = ladrão');
});

test('hate crime mapping only accepts known prejudice categories', () => {
  assert.equal(crimeDeOdio('racismo'), 'Discriminação racial');
  assert.equal(crimeDeOdio('homofobia'), 'Discriminação por orientação sexual');
  assert.equal(crimeDeOdio('inventado'), null);
  assert(CATEGORIAS_DE_ODIO.includes('racismo'));
});

test('graffiti insult mode uses the generator and keeps the target', () => {
  const city = {random: zero};
  const c = {entity: {properties: {name: 'Fulano'}}};
  assert.equal(graffitiMessage(city, c, {xingamento: true, tipo: 'conduta', modelo: 'e', intensidade: 0}), 'Fulano é um ladrão');
  assert.equal(graffitiMessage(city, c, {xingamento: true, targetName: 'Fulana', genero: 'f', tipo: 'conduta', modelo: 'e', intensidade: 0}), 'Fulana é uma ladra');
});

test('hate graffiti requires a known category and a caller-supplied text', () => {
  assert.throws(() => graffitiDeOdio({message: 'texto', prejudiceType: 'inventado'}), RangeError);
  assert.throws(() => graffitiDeOdio({message: '', prejudiceType: 'racismo'}), Error);
  assert.deepEqual(graffitiDeOdio({message: 'texto', prejudiceType: 'racismo'}), {
    message: 'texto',
    prejudiceType: 'racismo',
    crimeLabel: 'Discriminação racial',
  });
  assert.throws(() => graffitiContent({random: zero}, {}, {prejudiceType: 'racismo'}), Error);
});
