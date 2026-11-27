import {ECONOMIC_POLICIES,economicPolicy} from './city_economic_policies.js';
import {TAX_CATEGORIES,taxRate} from './city_sales_tax.js';
import {formatMoney as money} from './city_ui_format.js';
const labels={
  initialCapital:'Capital inicial da cidade (dinheiro de fundação)',
  nationalTransfers:'Repasses nacionais (divisão de tributos)',
  exports:'Exportações da prefeitura (vendas para fora)',
  rent:'Aluguéis de imóveis municipais',
  benefits:'Benefícios sociais (auxílios aos moradores)',
  food:'Alimentação pública (refeições e cestas)',
  tax:'Impostos e taxas (vendas, imóveis, veículos e empresas)',
  dividends:'Lucro de empresas públicas transferido ao Tesouro',
  monetary:'Emissão e retirada de moeda (Casa da Moeda)',
  investment:'Obras, compras e empréstimos',
  research:'Pesquisas contratadas pela prefeitura',
  payroll:'Salários de servidores públicos',
  operations:'Funcionamento de serviços públicos (manutenção e insumos)',
  liquidity:'Remanejamento interno entre contas da prefeitura',
  other:'Outras movimentações'
};
const signedMoney=v=>v>0?`+${money(v)}`:v<0?`-${money(-v)}`:money(0);
export function renderFiscalReport(ui,p){
  const city=ui.city,report=city.fiscal?.report();if(!report)return;
  const days=Math.max(1,report.days||1),freeCash=report.cash-report.reserve;
  p.heading('RESUMO DO TESOURO');
  p.metrics([
    ['CAIXA TOTAL',money(report.cash)],
    ['RESERVA PROTEGIDA',money(report.reserve)],
    ['FOLGA LIVRE',freeCash>=0?money(freeCash):`-${money(-freeCash)}`],
    ['SALDO DO DIA A DIA',signedMoney(report.operatingBalance)],
    ['DURAÇÃO ESTIMADA',report.runwayDays==null?'Estável':`${report.runwayDays.toFixed(1)} dias`],
    ['SERVIÇOS ESSENCIAIS',`${report.serviceHealth.toFixed(0)}%`]
  ]);
  p.note('Caixa total é todo o dinheiro na conta da prefeitura. Reserva protegida é o mínimo guardado para comida e assistência básica. Folga livre é o valor acima da reserva que pode ser usado em obras e novos gastos.');
  if(report.cash<report.reserve){
    p.status('CAIXA ABAIXO DA RESERVA PROTEGIDA',`Faltam ${money(report.reserve-report.cash)} para recompor a reserva social. Novos investimentos e obras ficam limitados para proteger a alimentação da população.`);
  }else if(report.runwayDays!=null&&report.runwayDays<30){
    p.status('ALERTA: GASTOS ACIMA DA ARRECADAÇÃO',`Nos últimos ${report.days} dias, a prefeitura gastou mais no dia a dia do que arrecadou. Nesse ritmo, a folga livre acaba em ${report.runwayDays.toFixed(1)} dias. ${report.servicesAtRisk} de ${report.servicesTracked} serviços essenciais estão sem caixa para dois dias.`);
  }else if(report.operatingBalance>=0){
    p.note(`Situação equilibrada nos últimos ${report.days} dias: a arrecadação do dia a dia cobriu os gastos e sobrou ${money(report.operatingBalance/days)} por dia. ${report.servicesAtRisk} de ${report.servicesTracked} serviços essenciais estão sem caixa para dois dias.`);
  }else{
    p.note(`Déficit leve no dia a dia (${money(-report.operatingBalance/days)}/dia), mas a folga livre ainda cobre ${report.runwayDays.toFixed(1)} dias. Continuidade dos serviços em ${report.serviceHealth.toFixed(0)}%.`);
  }
  p.heading('ENTRADAS E GASTOS NO PERÍODO');
  p.note(`Média calculada sobre os últimos ${report.days} dias observados (até 7 dias). "Dia a dia" reúne impostos, salários, serviços e benefícios, sem contar obras nem emissão de moeda.`);
  p.kv('Arrecadação do dia a dia (média/dia)',`${money(report.operatingIncome/days)} · total ${money(report.operatingIncome)}`);
  p.kv('Gastos do dia a dia (média/dia)',`${money(report.operatingExpenses/days)} · total ${money(report.operatingExpenses)}`);
  p.kv('Resultado do dia a dia',signedMoney(report.operatingBalance));
  p.kv('Variação total do caixa (inclui obras e emissão)',signedMoney(report.balance));
  p.kv('Projeção incluindo obras e investimentos',report.cashRunwayDays==null?'Sem consumo líquido de caixa':`${report.cashRunwayDays.toFixed(1)} dias até atingir a reserva`);
  p.kv('Serviços essenciais em risco (sem caixa p/ 2 dias)',`${report.servicesAtRisk} de ${report.servicesTracked}`);
  p.kv('Impostos de moradores em atraso',money(city.fiscal.economicTaxArrears||0));
  p.kv('Impostos de empresas a receber',money(report.taxArrears));
  p.kv('Verba de obras adiantada à subsistência',money(report.worksAdvance));
  p.kv('Exportações municipais (receita / repasse)',`${money(city.economy.municipalExports?.revenue||0)} / ${money(city.economy.municipalExports?.remitted||0)}`);
  if(report.revenueReviewBillId)p.button('VER PROPOSTA DE RECOMPOSIÇÃO DAS RECEITAS',()=>ui.openPanel({views:{government:'elections'},politicsTab:'council',councilView:'bills',billId:report.revenueReviewBillId}));
  if(report.lastDeferred)p.note(`Último gasto adiado para proteger a reserva: ${report.lastDeferred.reason} (${money(report.lastDeferred.amount)}).`);
  const keys=[...new Set([...Object.keys(report.receipts),...Object.keys(report.payments)])].filter(k=>(report.receipts[k]||0)>0||(report.payments[k]||0)>0).sort((a,b)=>((report.receipts[b]||0)+(report.payments[b]||0))-((report.receipts[a]||0)+(report.payments[a]||0)));
  const topIn=keys.filter(k=>(report.receipts[k]||0)>0).sort((a,b)=>(report.receipts[b]||0)-(report.receipts[a]||0)).slice(0,3);
  const topOut=keys.filter(k=>(report.payments[k]||0)>0).sort((a,b)=>(report.payments[b]||0)-(report.payments[a]||0)).slice(0,3);
  if(topIn.length)p.note(`Principais entradas: ${topIn.map(k=>`${(labels[k]||k).split(' (')[0]} (${money(report.receipts[k])})`).join(', ')}.`);
  if(topOut.length)p.note(`Principais saídas: ${topOut.map(k=>`${(labels[k]||k).split(' (')[0]} (${money(report.payments[k])})`).join(', ')}.`);
  p.table([{label:'Origem / finalidade (o que é)',weight:3},{label:'Entrou'},{label:'Saiu'},{label:'Saldo'}],keys.map(key=>{const inc=report.receipts[key]||0,exp=report.payments[key]||0;return {cells:[labels[key]||key,money(inc),money(exp),signedMoney(inc-exp)]};}),{empty:'Nenhuma movimentação registrada nos últimos dias.'});
  p.heading('POLÍTICAS ECONÔMICAS VOTÁVEIS');p.note('IPTU, IPVA e riqueza usam alíquotas anuais, apropriadas em 360 dias. Cada alteração abaixo apresenta um projeto à Câmara; o valor só muda após aprovação e sanção.');
  for(const group of new Set(Object.values(ECONOMIC_POLICIES).map(s=>s.group))){const entries=Object.entries(ECONOMIC_POLICIES).filter(([,s])=>s.group===group),render=()=>{
  for(const [key,spec] of entries){if(ui.matches&&!ui.matches(`${spec.label} ${spec.group}`))continue;const value=economicPolicy(city,key),format=n=>typeof n==='boolean'?(n?'Ativa':'Inativa'):spec.max<=1?`${(n*100).toFixed(2)}%`:key.endsWith('Exemption')||key==='nationalTransferPerResident'?money(city.currency.price(n)):String(n);p.kv(spec.label,format(value));p.note(spec.description);const values=typeof value==='boolean'?[!value]:[Math.max(spec.min,Number((value-spec.step).toFixed(6))),Math.min(spec.max,Number((value+spec.step).toFixed(6)))];p.buttons(values.filter(n=>n!==value).map(next=>({label:`VOTAR: ${format(next)}`,click:()=>{const bill=city.politics.submitBill('economicPolicy',{key,value:next});ui.notice=bill?.title?`Projeto apresentado: ${bill.title}`:city.lastError||'Proposta indisponível.';}})));}
  };if(ui.section)ui.section(p,`economicPolicies:${group}`,group,render);else render();}
  p.heading('IMPOSTOS POR RAMO');for(const [category,spec] of Object.entries(TAX_CATEGORIES))p.kv(spec.label,`${(taxRate(city,category)*100).toFixed(1)}%`);p.note('Alíquotas incluídas no preço e recolhidas pelo vendedor ao tesouro.');
  p.note('Obras, empréstimos e emissão aparecem separados do custeio. Remanejamentos usam dinheiro existente. O adiantamento da verba de obras é recomposto quando o caixa se recupera; cauções de contratos e poupanças privadas permanecem vinculadas.');
  p.note('Refeições públicas continuam gratuitas para quem precisa. Moradores com caixa e patrimônio acima do piso social contribuem até o custo dos alimentos. O imposto empresarial considera o resultado operacional positivo; tributos sem caixa para pagamento ficam registrados a receber.');
}
