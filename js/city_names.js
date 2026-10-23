import { vocabulario, classificarPalavra, converterParaSingular } from './vocabulario.js';

// The catalogue is module data: it never enters the city's worker snapshots.
// Sampling is bounded; no filtering/sorting of the full dictionary during simulation.
const filialTerms = new Set(['filho','filha','neto','neta','junior','sobrinho','sobrinha','de','da','do','dos','das']);
const capitalize = value => value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1).toLocaleLowerCase('pt-BR');
const pick = (city, words) => words[Math.floor(city.random() * words.length)];
function word(city, { names = false, gender = '' } = {}) {
  const source = names ? vocabulario.nomes : vocabulario.palavras;
  for (let attempt = 0; attempt < 80; attempt++) {
    const raw = pick(city, source);
    if (typeof raw !== 'string') continue;
    const clean = raw.trim().normalize('NFC');
    if (!/^[\p{L}]{3,16}$/u.test(clean) || filialTerms.has(clean.toLocaleLowerCase('pt-BR'))) continue;
    const category = classificarPalavra(clean);
    if (gender && category !== 'neutro' && category !== gender) continue;
    // Given names are proper nouns; singularization would damage names such as Carlos.
    const result = names ? clean : converterParaSingular(clean.toLocaleLowerCase('pt-BR'));
    if (result.length >= 3) return capitalize(result);
  }
  return names ? 'Pioneiro' : 'Horizonte';
}
function combinedName(city, first, gender = '') {
  const second = word(city, { names: true, gender });
  try {
    const combined = capitalize(vocabulario.combinar(first, second, 'eufonia', gender, 'singular'));
    if (/^[\p{L}]{3,24}$/u.test(combined)) return combined;
  } catch { /* A grammatical restriction may reject a combination; keep both names. */ }
  return `${first} ${second}`;
}
export function makeIdentity(city, used, index, options = {}) {
  const parents = (options.parentIds || []).map(id => city.accounts.get(`citizen:${id}`)).filter(Boolean);
  const inherited = parents.map(p => p.surnames?.at(-1) || p.entity.properties.name.split(' ').at(-1));
  const surnames = inherited.length ? inherited : [word(city), word(city)];
  if (surnames.length === 1) surnames.unshift(parents[0]?.surnames?.[0] || word(city));
  const gender = ['feminino','masculino'].includes(options.nameGender) ? options.nameGender : '';
  for (let attempt = 0; attempt < 128; attempt++) {
    const first = word(city, {names:true,gender});
    const givenNames = attempt ? combinedName(city, first, gender) : city.random() < .25 ? `${first} ${word(city,{names:true,gender})}` : first;
    const name = `${givenNames} ${surnames.join(' ')}`;
    if (!used.has(name)) {used.add(name);return {name,givenNames,surnames:[...surnames]};}
  }
  // Guaranteed progress even with a constant random source or an exhausted vocabulary.
  const stem = combinedName(city, word(city,{names:true,gender}), gender);
  for (let serial = Math.max(1,index+1); ; serial++) {
    const givenNames = `${stem} ${serial}`,name = `${givenNames} ${surnames.join(' ')}`;
    if (!used.has(name)) {used.add(name);return {name,givenNames,surnames:[...surnames]};}
  }
}
export function makeBuildingName(city, used, label) {
  for (let attempt = 0; attempt < 80; attempt++) {
    let title = word(city);
    if (attempt || city.random() < .2) {
      // Use the original prefix/suffix catalogue for coined establishment names.
      const first = city.random() < .5 ? pick(city,vocabulario.prefixos) : title;
      const second = first === title ? pick(city,vocabulario.sufixos) : title;
      try {title = capitalize(vocabulario.combinar(first,second,'eufonia','','singular'));} catch {continue;}
    }
    if (!/^[\p{L}]{3,24}$/u.test(title)) continue;
    const name = `${label} ${title}`;
    if (!used.has(name)) {used.add(name);return name;}
  }
  for (let serial = 1; ; serial++) {
    const name = `${label} Horizonte ${serial}`;
    if (!used.has(name)) {used.add(name);return name;}
  }
}
