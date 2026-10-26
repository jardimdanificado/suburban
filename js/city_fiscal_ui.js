import {formatMoney as money} from './city_ui_format.js';
const labels={benefits:'Benefícios de subsistência',food:'Alimentação e contribuição por refeições',tax:'Tributos',dividends:'Resultado de empresas municipais',monetary:'Emissão e retirada de moeda',investment:'Obras, aquisições e crédito produtivo',research:'Pesquisas',payroll:'Salários',operations:'Custeio de serviços',liquidity:'Remanejamentos de liquidez',other:'Outras movimentações'};
export function renderFiscalReport(ui,p){
  const city=ui.city,report=city.fiscal?.report();if(!report)return;
  p.heading('SUSTENTABILIDADE DO CAIXA MUNICIPAL');p.metrics([['CAIXA',money(report.cash)],['RESERVA SOCIAL',money(report.reserve)],['SALDO DE CUSTEIO',money(report.operatingBalance)]]);
  p.note(`Movimentações dos últimos ${report.days} dias observados, até o máximo de sete. A reserva cobre alimentação e assistência; benefícios e compras de refeições podem usá-la.`);
  p.kv('Receitas de custeio',money(report.operatingIncome));p.kv('Despesas de custeio',money(report.operatingExpenses));p.kv('Variação total do caixa',money(report.balance));
  p.kv('Verba de obras adiantada à subsistência',money(report.worksAdvance));p.kv('Impostos empresariais a receber',money(report.taxArrears));
  if(report.cash<report.reserve)p.status('CAIXA SOB PRESSÃO','Novos investimentos são limitados para proteger alimentação. Saldos municipais livres e verba de obras ainda não contratada podem recompor a liquidez.');
  if(report.revenueReviewBillId)p.button('PROPOSTA DE RECOMPOSIÇÃO DAS RECEITAS',()=>ui.openPanel({views:{government:'elections'},politicsTab:'council',councilView:'bills',billId:report.revenueReviewBillId}));
  if(report.lastDeferred)p.note(`Último gasto adiado por proteção da reserva: ${report.lastDeferred.reason} · ${money(report.lastDeferred.amount)}.`);
  p.table([{label:'Origem / finalidade',weight:3},{label:'Entradas'},{label:'Saídas'}],[...new Set([...Object.keys(report.receipts),...Object.keys(report.payments)])].map(key=>({cells:[labels[key]||key,money(report.receipts[key]||0),money(report.payments[key]||0)]})));
  p.note('Obras, empréstimos e emissão aparecem separados do custeio. Remanejamentos usam dinheiro existente. O adiantamento da verba de obras é recomposto quando o caixa se recupera; cauções de contratos e poupanças privadas permanecem vinculadas.');
  p.note('Refeições públicas continuam gratuitas para quem precisa. Moradores com caixa e patrimônio acima do piso social contribuem até o custo dos alimentos. O imposto empresarial considera o resultado operacional positivo; tributos sem caixa para pagamento ficam registrados a receber.');
}
