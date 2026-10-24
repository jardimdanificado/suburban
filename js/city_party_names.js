import {vocabulario} from './vocabulario.js';
const organizations=[['Partido','m'],['Movimento','m'],['Sindicato','m'],['União','f'],['Frente','f'],['Aliança','f'],['Liga','f'],['Coalizão','f'],['Convergência','f'],['Pacto','m'],['Bloco','m'],['Congresso','m'],['Federação','f'],['Rede','f'],['Associação','f'],['Coletivo','m']];
export const POLITICAL_WORDS=Object.freeze({
  common:['Popular','Municipal','Comunitário','Cívico','Democrático','Republicano','Solidário','Renovador','Humanista','Progressista','Participativo','Federalista','Pluralista','Cooperativista'],
  left:['Socialista','Comunista','Trabalhista','Vermelho','Sindicalista','Coletivista','Igualitário','Solidário'],
  right:['Liberal','Capitalista','Empreendedor','Mercantil','Conservador','Reformista','Desenvolvimentista'],
  green:['Verde','Ecológico','Ambientalista','Sustentável','Socioambiental','Agroecológico'],
  authority:['Estadista','Militarista','Nacionalista','Patriótico','Institucional','Soberanista'],
  liberty:['Libertário','Autonomista','Anarquista','Descentralizador','Autogestionário'],
  causes:['dos Trabalhadores','da União Popular','da Solidariedade','da Cidadania','da Justiça Social','da Liberdade','da Autonomia','da Igualdade','da Terra','da Prosperidade','do Trabalho','da Cooperação','do Desenvolvimento','da Soberania','da Renovação','do Bem Comum','das Comunidades','dos Bairros','dos Produtores','da Cultura','da Educação','da Saúde','da Reforma','da Participação']
});
const pick=(city,items)=>items[Math.floor(city.random()*items.length)];
const capitalize=s=>s[0].toLocaleUpperCase('pt-BR')+s.slice(1).toLocaleLowerCase('pt-BR');
function flavor(city){for(let i=0;i<48;i++){const word=pick(city,vocabulario.palavras);if(typeof word==='string'&&/^[\p{L}]{4,14}$/u.test(word))return capitalize(word);}return 'Horizonte';}
export function makePartyName(city,ideology,parties,id){
  const pool=[...POLITICAL_WORDS.common,...(ideology.economy<-.3?POLITICAL_WORDS.left:ideology.economy>.3?POLITICAL_WORDS.right:[])];
  if(ideology.green>.65)pool.push(...POLITICAL_WORDS.green,...POLITICAL_WORDS.green);
  if(ideology.liberty<-.3)pool.push(...POLITICAL_WORDS.authority);
  if(ideology.liberty>.6)pool.push(...POLITICAL_WORDS.liberty.filter(w=>w!=='Anarquista'||ideology.economy<0));
  for(let attempt=0;attempt<24;attempt++){
    const [organization,gender]=pick(city,organizations);let adjective=pick(city,pool);if(gender==='f'&&adjective.endsWith('o'))adjective=adjective.slice(0,-1)+'a';
    const unique=flavor(city),core=`${organization} ${adjective} ${pick(city,POLITICAL_WORDS.causes)}`,name=`${core} — ${unique}`;
    if(parties.some(p=>p.name===name))continue;
    let short=core.split(' ').filter(w=>!['da','de','do','das','dos','e'].includes(w)).map(w=>w[0]).join('').slice(0,5)+unique[0];
    if(parties.some(p=>p.short===short))short+=id;
    return {name,short,nameFlavor:unique};
  }
  return {name:`Movimento da Renovação — ${flavor(city)} ${id}`,short:`MR${id}`,nameFlavor:'Renovação'};
}
