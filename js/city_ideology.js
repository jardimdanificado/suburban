import {partyNameAgenda} from './city_party_names.js';
const clamp=(n,a=-1,b=1)=>Math.max(a,Math.min(b,n));
const profiles=new WeakMap();
const normalize=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
/** Distinct policy preferences. Economic side does not determine civil liberties. */
export function ideologicalProfile(subject){
  const citizen=!!subject?.political,i=citizen?subject.political.ideology:subject?.ideology,name=citizen?'':subject?.name||'',frugality=citizen?subject.traits?.frugality:null,cached=subject&&profiles.get(subject);
  if(cached&&cached.ideology===i&&cached.name===name&&cached.agenda===subject.nameAgenda&&cached.frugality===frugality)return cached.profile;
  const source=i||{},agenda=citizen?{}:subject?.nameAgenda||partyNameAgenda(name),text=normalize(name);
  const has=re=>re.test(text)?1:0,economy=clamp((source.economy||0)+(agenda.economy||0)*.7),liberty=clamp((source.liberty||0)+(agenda.liberty||0)*.6),green=clamp((source.green??.4)+(agenda.green||0),0,1);
  const redistribution=clamp(-economy*.8+(agenda.social||0)*.9),ownership=clamp(-economy*.65+(agenda.state||0)*1.1+has(/comunist|estatist|estadist|coletivist/)*.35-has(/anarqu|libertari/)*.4),regulation=clamp(-economy*.5-liberty*.25+green*.15+has(/sindicat|trabalh/)*.2),fiscal=clamp(economy*.45+(citizen?(subject.traits?.frugality??.5)-.5:0)+has(/fiscal|auster|conserv/)*.4-has(/desenvolv|expans/)*.25),cooperation=clamp(-economy*.5+liberty*.25+has(/cooper|solidari|mutual/)*.4);
  const side=economy<-.65?'esquerda':economy<-.2?'centro-esquerda':economy>.65?'direita':economy>.2?'centro-direita':'centro',current=ownership>.5?'estatal':ownership<-.4?'privada':cooperation>.4?'cooperativa':'mista';
  const profile=Object.freeze({economy,liberty,green,redistribution,ownership,regulation,fiscal,cooperation,label:`${side} · economia ${current} · ${liberty>.25?'libertária':liberty<-.25?'centralizadora':'pluralista'}`});
  if(subject)profiles.set(subject,{ideology:i,name,agenda:subject.nameAgenda,frugality,profile});return profile;
}
export function policyAffinity(profile,city,type,payload={}){
  const p=city.politics,v=payload.value,dir=current=>Math.sign(v-current),socialBuildings=['popular_housing','popular_refectory','clinic','utility','kitchen'],environmental=['recycler','composting','cleaner','forestry','leisure'];
  switch(type){
    case'entrepreneurCandidates':return (v?1:-1)*(profile.economy*1.1-profile.ownership*.3);
    case'tax':return dir(city.taxRate)*(profile.redistribution*.5+profile.ownership*.2-profile.fiscal*.4-.6);
    case'businessTax':return dir(p.policy.businessTax)*(profile.redistribution*.55+profile.regulation*.4-.3);
    case'salesTax':return dir(p.policy.salesTaxes?.[payload.category]??.1)*(profile.redistribution*.4-profile.economy*.35-.4-(payload.category==='food'?.2:0));
    case'minimumWage':return dir(p.policy.minimumWage)*(profile.redistribution*.75+profile.regulation*.65);
    case'welfare':return dir(city.welfare.policy.dailyBudget)*(profile.redistribution*1.2-profile.fiscal*.35+.15);
    case'nationalize':return profile.ownership*1.6+profile.regulation*.2;
    case'privatize':return -profile.ownership*1.6-profile.regulation*.2;
    case'build':return profile.ownership*.9+(socialBuildings.includes(payload.buildingType)?profile.redistribution*.65+.2:0)+(environmental.includes(payload.buildingType)?profile.green*.7:0)-profile.fiscal*.25;
    case'inflation':return Math.sign(city.currency.policy.dailyLimit-v)*(.35+profile.fiscal*.65+Math.min(1,Math.max(0,city.currency.dailyInflation)*40));
    case'partyLimit':return dir(p.policy.partyLimit)*profile.liberty;
    default:return null;
  }
}
export function citizenPolicyInterest(city,c,type,payload={}){
  const p=city.politics,owner=!!c.businessIds?.length,poor=c.balance<city.currency.price(10000),direction=current=>Math.sign(payload.value-current);
  switch(type){
    case'entrepreneurCandidates':return (payload.value?1:-1)*(owner?.35:0);
    case'tax':return -direction(city.taxRate)*(poor?.25:.1);
    case'businessTax':return direction(p.policy.businessTax)*(owner?-.45:.1);
    case'minimumWage':return direction(p.policy.minimumWage)*(owner?-.4:c.jobId?.3:.15);
    case'welfare':return direction(city.welfare.policy.dailyBudget)*((c.needs.food<45||!c.homeUnitId)?.5:poor?.2:0);
    case'build':return payload.buildingType==='popular_housing'&&!c.homeUnitId?.5:payload.buildingType==='popular_refectory'&&c.needs.food<45?.5:0;
    case'nationalize':return city.building(payload.buildingId)?.ownerId===c.id?-.65:0;
    case'privatize':return city.building(payload.buildingId)?.workers.includes(c.id)?-.2:0;
    default:return 0;
  }
}
export function ideologicalPromiseWeight(profile,metric){
  if(['publicHomes','publicMeals','stateFirms','publicJobs'].includes(metric))return profile.ownership*.65+profile.redistribution*.5;
  if(['fed','housed','wage','health','water','clinics','literacy','readers'].includes(metric))return profile.redistribution*.7;
  if(['tax','savers','banks','paidLoans'].includes(metric))return profile.economy*.5+profile.fiscal*.4;
  if(['smallFirms','artisans','builders','carriers'].includes(metric))return profile.economy*.55+profile.cooperation*.25;
  if(['recycling','cultivatedTrees','waste','parks','clean'].includes(metric))return profile.green*.8;
  if(metric==='inflation')return profile.fiscal*.7;
  return 0;
}

/** Human descriptions summarize existing policy axes; they do not change anyone's beliefs. */
export function describePoliticalOrientation(subject){
  if(!subject?.political?.ideology&&!subject?.ideology)return {label:'Orientação ainda não definida',position:'Ainda não definida',ideology:'Sem corrente definida',economic:'Sem preferência definida',civil:'Sem preferência definida',environment:'Sem preferência definida'};
  const p=ideologicalProfile(subject),position=p.economy<-.65?'Esquerda':p.economy<-.2?'Centro-esquerda':p.economy>.65?'Direita':p.economy>.2?'Centro-direita':'Centro';
  let ideology;
  if(p.economy<-.65)ideology=p.liberty>.45&&p.ownership<.55?'Socialismo libertário':p.liberty>.25?'Socialismo democrático':p.liberty<-.25?'Socialismo estatista':'Socialismo';
  else if(p.economy<-.2)ideology=p.liberty<-.35?'Desenvolvimentismo estatista':'Social-democracia';
  else if(p.economy>.65)ideology=p.liberty>.6?'Liberalismo libertário':p.liberty<-.25?'Capitalismo autoritário':'Liberalismo econômico';
  else if(p.economy>.2)ideology=p.ownership>.35?'Desenvolvimentismo estatal':p.fiscal>.45?'Conservadorismo fiscal':p.liberty<-.35?'Direita centralizadora':'Liberalismo moderado';
  else ideology=p.liberty>.35?'Liberalismo social':p.ownership>.35||p.liberty<-.35?'Estatismo moderado':'Centrismo pragmático';
  const tendencies=[];if(p.cooperation>.45)tendencies.push('Cooperativismo');if(p.green>=.65)tendencies.push('Ambientalismo');
  return {position,ideology,tendencies,label:[position,ideology,...tendencies].join(' · '),economic:p.ownership>.45?'Predomínio estatal e serviços públicos':p.ownership<-.4?'Iniciativa privada e livre mercado':p.cooperation>.45?'Economia mista com cooperativas':'Economia mista',civil:p.liberty>.35?'Libertária: autonomia e pluralismo':p.liberty<-.35?'Autoritária: centralização e autoridade':'Moderada: equilíbrio entre autonomia e regulação',environment:p.green>=.65?'Ambientalista: preservação como prioridade':p.green>=.35?'Equilíbrio entre preservação e produção':'Prioridade produtiva, com menor ênfase ambiental'};
}
