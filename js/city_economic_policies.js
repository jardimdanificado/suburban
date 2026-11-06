import {ensureExternalAccount} from './city_currency.js';
const spec=(label,value,min,max,step,group,description)=>Object.freeze({label,default:value,min,max,step,group,description});
// Annual taxes accrue over 360 simulation days. Monetary values are cents at initial prices.
export const ECONOMIC_POLICIES=Object.freeze({
 wealthRate:spec('Grandes riquezas: alíquota anual',.015,0,.08,.005,'Patrimônio','Tributa somente patrimônio líquido acima da isenção; desconta dívidas.'),
 wealthExemption:spec('Grandes riquezas: faixa isenta',2000000,0,20000000,250000,'Patrimônio','Protege o pequeno patrimônio; inclui imóveis, veículos e ações sem duplicar o ativo da empresa.'),
 propertyRate:spec('IPTU: alíquota anual',.012,0,.06,.002,'Patrimônio','Cobrança sobre imóveis privados; patrimônio municipal é imune.'),
 homeExemption:spec('IPTU: isenção da moradia principal',120000,0,2000000,20000,'Patrimônio','Abate o valor da casa ocupada pelo próprio contribuinte.'),
 vacantPropertyMultiplier:spec('IPTU: multiplicador de imóvel vazio',1.5,1,4,.25,'Patrimônio','Aumenta o custo de manter imóveis privados desocupados.'),
 landRate:spec('Terrenos ociosos: alíquota anual',.02,0,.1,.005,'Patrimônio','Incide em terrenos privados sem prédio ou obra contratada.'),
 vehicleRate:spec('IPVA: alíquota anual',.02,0,.1,.005,'Patrimônio','Tributa veículos ativos de acordo com o valor real de fabricação.'),
 vehicleExemption:spec('IPVA: faixa isenta por proprietário',30000,0,500000,10000,'Patrimônio','Protege a mobilidade básica e pequenos equipamentos.'),
 incomeRate:spec('Imposto de renda: alíquota máxima',.25,0,.5,.025,'Renda','Sobre renda diária acima da faixa isenta; desconta imposto salarial já retido.'),
 incomeExemption:spec('Imposto de renda: faixa diária isenta',6000,0,50000,1000,'Renda','Salários, aluguéis e dividendos entram na apuração, sem taxar empréstimos ou resgates.'),
 dividendRate:spec('Dividendos: retenção',.1,0,.35,.025,'Renda','Retenção paga pelo acionista sobre distribuições efetivamente recebidas.'),
 rentIncomeRate:spec('Aluguéis: retenção',.08,0,.3,.02,'Renda','Renda imobiliária privada compõe o imposto de renda, com crédito da retenção.'),
 inheritanceRate:spec('Heranças em dinheiro: alíquota',.04,0,.25,.01,'Renda','Somente transmissões privadas; o espólio sem herdeiro retorna ao município.'),
 consumptionMultiplier:spec('Imposto de consumo: multiplicador',1,0,2,.1,'Consumo','Ajusta as alíquotas por ramo já existentes; preserva o teto de 50%.'),
 essentialConsumptionRelief:spec('Alimentos: redução de imposto',.25,0,1,.1,'Consumo','Reduz o imposto de alimentos para preservar o poder de compra.'),
 luxuryConsumptionRate:spec('Consumo de equipamentos: adicional',.03,0,.2,.01,'Consumo','Adicional sobre roupas e equipamentos de mobilidade.'),
 exportMunicipal:spec('Exportação de excedentes municipais',true,0,1,1,'Empresas públicas','Vende estoque físico excedente depois da reserva para demanda local e obras.'),
 exportReserveDays:spec('Exportação: dias de proteção do estoque',3,1,14,1,'Empresas públicas','Alimentos e materiais essenciais permanecem disponíveis para consumo e projetos locais.'),
 exportLotLimit:spec('Exportação: lote máximo por hora',12,1,96,4,'Empresas públicas','Limita a velocidade de absorção pelo mercado externo.'),
 municipalRevenueShare:spec('Exportação: repasse ao tesouro',.65,0,.9,.05,'Empresas públicas','Transfere parte da receita líquida ao tesouro preservando o capital operacional.'),
 municipalRentals:spec('Locação de imóveis municipais',true,0,1,1,'Moradia','Permite locar imóveis comerciais e residenciais municipais; habitação social continua protegida.'),
 municipalRentDiscount:spec('Locação municipal: desconto',.1,0,.75,.05,'Moradia','Desconto sobre novos contratos municipais de aluguel.'),
 dividendPayout:spec('Distribuição de lucro empresarial',.35,0,.8,.05,'Empresas','Limita dividendos ao lucro realizado e ao caixa livre após a reserva operacional.'),
 businessReserveDays:spec('Reserva de folha empresarial em dias',3,1,14,1,'Empresas','Evita prender uma semana inteira de salários em toda pequena empresa.'),
 serviceBufferDays:spec('Custeio: dias de caixa por serviço',2,1,7,1,'Orçamento','Dimensiona o caixa operacional das instalações públicas.'),
 directHiring:spec('Contratação direta pelos empregadores',true,0,1,1,'Trabalho','Entrevistas no empregador quando o balcão municipal não atende; candidatura nunca depende indefinidamente de um secretário.'),
 jobBoardLimit:spec('Vagas divulgadas no quadro público',128,16,512,16,'Trabalho','Amplia a divulgação de vagas, incluindo empresas distantes do centro.'),
 interviewGraceMinutes:spec('Tolerância para chegada à entrevista',180,30,720,30,'Trabalho','Dá tempo para deslocamento e necessidades básicas sem contratar candidatos ausentes.'),
 creditLoanRate:spec('Crédito pessoal: juros diários',.001,0,.01,.00025,'Crédito','Juros com limite de risco, reserva bancária e proteção da subsistência.'),
 creditReserveDays:spec('Reserva de operação dos bancos em dias',21,3,60,3,'Crédito','Protege a operação antes de conceder novos empréstimos.'),
 householdDebtLimit:spec('Crédito: múltiplo da renda diária',12,2,30,2,'Crédito','Limita empréstimos pessoais pela renda verificável; depósitos continuam integralmente lastreados.'),
 taxPaymentCap:spec('Tributos: teto diário do caixa disponível',.2,.05,.5,.05,'Proteção econômica','Protege subsistência e operação; o restante vira dívida tributária registrada.'),
 fiscalGuardDays:spec('Alerta fiscal: horizonte em dias',30,7,90,7,'Orçamento','Antecipa revisão de receita antes do esgotamento do caixa livre.'),
 automaticStabilizer:spec('Revisão fiscal preventiva',true,0,1,1,'Orçamento','Encaminha propostas tributárias ao Legislativo em vez de alterar impostos sem votação.'),
 nationalTransferPerResident:spec('Repartição nacional de receitas por morador/dia',1200,0,3000,100,'Orçamento','Repasse externo previsível de receitas nacionais; registrado na oferta monetária e nas contas públicas.'),
 publicWorksShare:spec('Receita livre destinada a obras',.12,0,.4,.02,'Infraestrutura','Reabastece a verba de obras apenas quando os serviços e a reserva estão protegidos.'),
});
export function economicPolicy(city,key){return city.politics?.policy?.economicPolicies?.[key]??(key==='creditLoanRate'?city.bank?.policy?.loanRate:undefined)??ECONOMIC_POLICIES[key]?.default;}
export function validateEconomicPolicy(key,value){const s=ECONOMIC_POLICIES[key];return !!s&&(typeof s.default==='boolean'?typeof value==='boolean':Number.isFinite(value)&&value>=s.min&&value<=s.max&&(Number.isInteger(s.step)?Number.isInteger(value):true));}
export function setEconomicPolicy(city,key,value){if(!validateEconomicPolicy(key,value))return false;city.politics.policy.economicPolicies??={};city.politics.policy.economicPolicies[key]=value;if(key==='creditLoanRate'&&city.bank)city.bank.policy.loanRate=value;if(city.fiscal){city.fiscal.serviceContinuityMinute=null;city.fiscal.reserveKey=null;}return true;}
export function economicPolicyAffinity(city,profile,payload){const s=ECONOMIC_POLICIES[payload.key];if(!s)return 0;const direction=Math.sign(Number(payload.value)-Number(payload.previousValue??economicPolicy(city,payload.key)));const social=['Patrimônio','Renda','Proteção econômica'].includes(s.group);return direction*(social?profile.redistribution*.8-profile.economy*.4:['Empresas','Crédito','Trabalho'].includes(s.group)?profile.economy*.6+.25:profile.fiscal*.5+.15);}
export function recordEconomicIncome(city,from,to,amount,reason){
 const person=city.accounts.get(to);if(!person?.entity?.properties?.citizen||person.entity.destroyed)return;
 if(/^(Salário|Primeiro aluguel|Aluguel|Distribuição de lucros|Lucro de empresa|Herança)/.test(reason)){
  const income=person.fiscalIncome??={income:0,dividends:0,rent:0,inheritance:0};
  if(/^Herança/.test(reason))income.inheritance+=amount;else {income.income+=amount;if(/lucros|Lucro/.test(reason))income.dividends+=amount;if(/aluguel|Aluguel/.test(reason))income.rent+=amount;}
 }
}
export function collectEconomicTaxes(city){
 const fiscal=city.fiscal;if(fiscal.lastEconomicTaxDay===city.day)return;fiscal.lastEconomicTaxDay=city.day;fiscal.taxDebts??={};
 const people=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)),assets=new Map(people.map(c=>[c.accountId,{property:0,vacant:0,land:0,vehicles:0,equity:0}]));
 for(const u of city.units.values()){const a=assets.get(u.ownerId);if(!a)continue;a.property+=u.price||0;if(!u.tenantId&&!u.occupantId)a.vacant+=u.price||0;}
 for(const p of city.development.plots){const a=assets.get(p.ownerId);if(a&&!p.buildingId&&!p.projectId)a.land+=p.price||0;}
 for(const v of city.vehicles?.units?.values?.()||[]){const a=assets.get(v.ownerAccountId);if(a&&v.active&&!v.scrapped)a.vehicles+=(v.purchasePrice||v.ownershipHistory?.findLast(row=>row.price>0)?.price||city.economy.goods[v.good]?.price||city.currency.price(30000))*Math.max(.2,(v.condition??100)/100);}
 for(const b of city.economy.businesses){const value=Math.max(0,b.balance||0)+b.units.reduce((n,u)=>n+(u.ownerId===b.accountId?u.price||0:0),0)+Object.entries(b.inventory||{}).reduce((n,[g,q])=>n+Math.max(0,q)*(city.economy.goods[g]?.price||0),0)-city.bank.loans.filter(l=>l.clientId===b.accountId&&!['paid','written-off','foreclosed'].includes(l.status)).reduce((n,l)=>n+l.remaining+(l.interest||0),0);for(const s of b.equityShares||[{accountId:b.ownerId?`citizen:${b.ownerId}`:'treasury',points:10000}]){const a=assets.get(s.accountId);if(a)a.equity+=Math.max(0,value)*s.points/10000;}}
 for(const c of people){
  const a=assets.get(c.accountId),income=c.fiscalIncome||{income:0,dividends:0,rent:0,inheritance:0},home=city.housing.home(c),ownsHome=home&&city.housing.units(home).every(u=>u.ownerId===c.accountId),debt=city.bank.loans.filter(l=>l.clientId===c.accountId&&!['paid','written-off','foreclosed'].includes(l.status)).reduce((n,l)=>n+l.remaining+(l.interest||0),0),wealth=c.balance+city.bank.savings(c.accountId)+a.property+a.land+a.vehicles+a.equity-debt;
  const credit=c.taxPaidToday||0,withholding=income.dividends*economicPolicy(city,'dividendRate')+income.rent*economicPolicy(city,'rentIncomeRate'),assessments={
   wealth:Math.max(0,wealth-city.currency.price(economicPolicy(city,'wealthExemption')))*economicPolicy(city,'wealthRate')/360,
   property:Math.max(0,a.property-(ownsHome?city.currency.price(economicPolicy(city,'homeExemption')):0)+a.vacant*(economicPolicy(city,'vacantPropertyMultiplier')-1))*economicPolicy(city,'propertyRate')/360,
   land:a.land*economicPolicy(city,'landRate')/360,
   vehicle:Math.max(0,a.vehicles-city.currency.price(economicPolicy(city,'vehicleExemption')))*economicPolicy(city,'vehicleRate')/360,
   income:Math.max(withholding,Math.max(0,income.income-city.currency.price(economicPolicy(city,'incomeExemption')))*economicPolicy(city,'incomeRate')-credit),
   inheritance:income.inheritance*economicPolicy(city,'inheritanceRate'),
  };
  const labels={wealth:'grandes riquezas',property:'IPTU',land:'terrenos ociosos',vehicle:'IPVA',income:'renda, dividendos e aluguéis',inheritance:'heranças'};let available=Math.floor(Math.max(0,c.balance-city.welfare.subsistenceFloor(c))*economicPolicy(city,'taxPaymentCap'));
  for(const [kind,base] of Object.entries(assessments)){const key=`${c.accountId}:${kind}`,account=fiscal.taxDebts[key]??={accountId:c.accountId,kind,due:0,remainder:0,assessed:0,paid:0},exact=Math.max(0,base)+account.remainder,amount=Math.floor(exact);account.remainder=exact-amount;account.due+=amount;account.assessed+=amount;const pay=Math.min(account.due,available);if(pay&&city.transfer(c.accountId,'treasury',pay,`Imposto: ${labels[kind]}`,{taxKind:kind})){account.due-=pay;account.paid+=pay;available-=pay;}}
  c.fiscalIncome={income:0,dividends:0,rent:0,inheritance:0};
 }
 const population=city.citizens.filter(c=>!c.entity.destroyed).length,grant=Math.floor(population*economicPolicy(city,'nationalTransferPerResident'));
 if(grant){ensureExternalAccount(city,'national-revenue','Repartição nacional de tributos');city.transfer('national-revenue','treasury',grant,'Repartição nacional de tributos',{population,perResident:economicPolicy(city,'nationalTransferPerResident')});}
 fiscal.economicTaxArrears=Object.values(fiscal.taxDebts).reduce((n,t)=>n+t.due,0);
 const free=Math.max(0,city.treasury-fiscal.reserve()*1.25),allocation=Math.floor(Math.min(grant*economicPolicy(city,'publicWorksShare'),free));if(allocation&&city.accounts.has('works-budget')){city.transfer('treasury','works-budget',allocation,'Dotação recorrente de obras',{essential:true});city.politics.policy.worksBudget=city.accounts.get('works-budget').balance;}
}

/** Migrate defaults once; deliberate laws from an existing save remain in force. */
export function ensureEconomicReform(city){
 const policy=city.politics.policy;if(policy.economicReformVersion===1)return;
 const enacted=city.politics.council.bills.some(b=>b.type==='dailyPrivatizationLimit'&&b.status==='executed');
 if(!enacted&&(policy.dailyPrivatizationLimit==null||policy.dailyPrivatizationLimit===1))policy.dailyPrivatizationLimit=7;
 city.bank.initializePrivateBanks();policy.economicReformVersion=1;
}

export function economicPolicyInterest(city,c,payload){
 const direction=Math.sign(Number(payload.value)-Number(payload.previousValue??economicPolicy(city,payload.key))),kinds={wealthRate:'wealth',propertyRate:'property',landRate:'land',vehicleRate:'vehicle',incomeRate:'income',dividendRate:'income',rentIncomeRate:'income',inheritanceRate:'inheritance'},kind=kinds[payload.key];
 if(kind){const liable=(city.fiscal?.taxDebts?.[`${c.accountId}:${kind}`]?.assessed||0)>0;return direction*(liable?-.7:.12);}
 if(payload.key==='consumptionMultiplier')return -direction*(c.balance<city.welfare.subsistenceFloor(c)*2?.8:.35);
 if(payload.key==='essentialConsumptionRelief')return direction*(c.needs.food<60?.8:.25);
 if(payload.key==='directHiring')return direction*(!c.jobId&&!c.businessIds.length?.8:.15);
 return 0;
}
