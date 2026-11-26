import {gerarFraseTematica} from './gerador_frases.js';
import {gerarXingamento, gerarOfensaPreconceito, crimeDeOdio} from './xingamentos.js';
import {graffitiTextCapacity, graffitiTextLimit} from './city_graffiti_size.js';

// Temas extras entram só em peças maiores. Cada frase mantém coerência porque
// o gerador recebe um conjunto de cenas do mesmo assunto, nunca palavras soltas.
const TEMAS_EXTRAS = [
  'trabalho', 'economia', 'moradia', 'familia', 'alimentacao', 'saude',
  'mobilidade', 'educacao_cultura', 'seguranca_justica', 'meio_ambiente',
  'esportes_lazer', 'cotidiano', 'moda', 'substancias',
];

function temasBase(c, protest) {
  const temas = ['cidade'];
  if (c.homeUnitId === null) temas.push('moradia');
  if (c.needs?.food < 42) temas.push('alimentacao');
  if (c.needs?.health < 45) temas.push('saude');
  if (protest) temas.push('politica');
  return temas;
}

function sortearTemas(extra, random, excluidos, quantidade) {
  const disponiveis = extra.filter(tema => !excluidos.has(tema));
  const escolhidos = [];
  while (escolhidos.length < quantidade && disponiveis.length) {
    const indice = Math.min(disponiveis.length - 1, Math.floor(random() * disponiveis.length));
    const [tema] = disponiveis.splice(indice, 1);
    escolhidos.push(tema);
  }
  return escolhidos;
}

function cortarTexto(texto, limite) {
  const limpo = String(texto || '').replace(/\s+/gu, ' ').trim();
  if (limpo.length <= limite) return limpo;
  return limpo.slice(0, limite - 1).replace(/\s+\S*$/u, '').replace(/[.,;:!?]+$/u, '') + '.';
}

function textoDePichacao(city, c, {protest = false, support = null} = {}) {
  const base = temasBase(c, protest);
  if (!support) return {texto: gerarFraseTematica(base, {random: () => city.random(), complexidade: 'simples'}), limite: 180};
  const capacidade = graffitiTextCapacity(support);
  const limite = graffitiTextLimit(support);
  const nivel = capacidade <= 60 ? 'simples' : capacidade <= 140 ? 'variada' : 'complexa';
  const frases = capacidade <= 140 ? 1 : capacidade <= 220 ? 2 : 3;
  const usados = new Set(base);
  let texto = '';
  for (let i = 0; i < frases; i++) {
    const quantidade = i === 0
      ? (nivel === 'simples' ? 0 : nivel === 'variada' ? 1 : 2)
      : 1 + Math.floor(city.random() * 2);
    const extras = sortearTemas(TEMAS_EXTRAS, () => city.random(), usados, quantidade);
    const temas = i === 0 ? [...base, ...extras] : extras;
    for (const tema of extras) usados.add(tema);
    const frase = gerarFraseTematica(temas.length ? temas : ['cidade'], {
      random: () => city.random(),
      complexidade: nivel,
    });
    texto = texto ? `${texto} ${frase}` : frase;
  }
  return {texto: cortarTexto(texto, limite), limite};
}

function politicalGraffiti(city,c){
  const politics=city.politics;if(!politics)return null;
  const memories=c.political?.memories||[],parties=(politics.parties||[]).filter(p=>p.active);
  const known=memories.filter(m=>['proven-scandal','corruption-rumor'].includes(m.kind)&&m.candidateId!=null);
  const hostile=memories.filter(m=>(m.effect||0)<0&&m.candidateId!=null);
  const own=parties.find(p=>p.id===c.political?.partyId);
  if(!known.length&&!hostile.length&&!own)return null;
  // Civic knowledge belongs to the author: never inspect undisclosed cases.
  if(city.random()>=.65)return null;
  const pool=known.length?known:hostile;
  if(pool.length){
    const memory=pool[Math.floor(city.random()*pool.length)],target=city.society?.citizen?.(memory.candidateId);
    if(target&&!target.entity?.destroyed){
      const party=parties.find(p=>p.id===(memory.partyId??target.political?.partyId));
      const proven=memory.kind==='proven-scandal',rumor=memory.kind==='corruption-rumor';
      const insults=proven?['ladrão','corrupto','safado']:rumor?['ladrão?','corrupto?']:['safado','canalha','sem-vergonha'];
      const insult=insults[Math.floor(city.random()*insults.length)];
      return {subjectId:target.id,partyId:party?.id??null,politicalKind:proven?'corruption':rumor?'corruption-rumor':'political-insult',corruptionCaseId:memory.caseId??null,
        targetName:`${String(target.entity.properties.name).slice(0,56)}: ${insult}${party?` · ${String(party.short||party.name).slice(0,20)} ${party.number}`:''}`};
    }
  }
  if(own)return {subjectId:null,partyId:own.id,politicalKind:'party-support',targetName:`${String(own.short||own.name).slice(0,60)} · ${own.number}`};
  return null;
}

export function graffitiDeOdio({message = null, prejudiceType, alvo = 'fulano', genero = 'm', intensidade = 0.35, random = null, pixacao = false, modelo = null, support = null, limite = null}) {
  const crimeLabel = crimeDeOdio(prejudiceType);
  if (!crimeLabel) throw new RangeError(`categoria de ódio desconhecida: ${prejudiceType}`);
  const limiteTexto = Number.isFinite(limite) ? Math.max(1, Math.round(limite)) : graffitiTextLimit(support);
  let texto = String(message ?? '').replace(/\s+/gu, ' ').trim().slice(0, limiteTexto);
  if (!texto) {
    const sorteio = typeof random === 'function' ? random : Math.random;
    try {
      texto = gerarOfensaPreconceito({tipo: prejudiceType, alvo, genero, intensidade, random: sorteio, pixacao, modelo, limite: limiteTexto});
    } catch (error) {
      throw new Error(`pichação de ódio (${prejudiceType}) sem texto: ${error.message}`);
    }
  }
  if (!texto) throw new Error('a pichação de ódio precisa de um texto');
  return {message: texto, prejudiceType, crimeLabel};
}

export function xingamentoGraffiti(city, c, {targetName = null, genero = 'm', tipo = null, intensidade = 0.35, pixacao = false, modelo = null, support = null} = {}) {
  const alvo = String(targetName || c?.entity?.properties?.name || 'fulano').trim().slice(0, 56) || 'fulano';
  const capacidade = support ? graffitiTextCapacity(support) : 34;
  const detalhe = capacidade >= 220 ? 3 : capacidade >= 140 ? 2 : capacidade >= 80 ? 1 : 0;
  return {message: gerarXingamento({alvo, genero, tipo, intensidade, pixacao, modelo, detalhe, limite: graffitiTextLimit(support), random: () => city.random()})};
}

export function graffitiContent(city,c,{protest=false,targetName=null,xingamento=false,genero='m',tipo=null,intensidade=.35,pixacao=false,modelo=null,message=null,prejudiceType=null,support=null}={}){
  if (prejudiceType) return graffitiDeOdio({message, prejudiceType, alvo: targetName || c?.entity?.properties?.name, genero, intensidade, pixacao, modelo, support, random: () => city.random()});
  if (message) {
    const texto=String(message).replace(/\s+/gu,' ').trim().slice(0,graffitiTextLimit(support));
    if (!texto) throw new Error('mensagem de pichação vazia');
    return {message:texto};
  }
  if (xingamento || tipo) return xingamentoGraffiti(city,c,{targetName,genero,tipo,intensidade,pixacao,modelo,support});

  const political=politicalGraffiti(city,c);
  if(political){protest=true;targetName=political.targetName;}

  const {texto,limite}=textoDePichacao(city,c,{protest,support});
  const suffix=targetName?` · ${String(targetName).trim().slice(0,political?110:60)}`:'',limit=limite-suffix.length;
  const base=cortarTexto(texto,limit);
  return {message:base+suffix,...(political?{subjectId:political.subjectId,partyId:political.partyId,politicalKind:political.politicalKind,corruptionCaseId:political.corruptionCaseId??null}:{})};
}

export function graffitiMessage(city,c,options){return graffitiContent(city,c,options).message;}
