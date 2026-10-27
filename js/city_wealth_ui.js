import {wealthReport} from './city_wealth.js';
import {formatMoney as money} from './city_ui_format.js';
const kinds={cash:'Caixa',savings:'Poupança',reserved:'Reservas',inventory:'Estoques',property:'Imóveis',land:'Terrenos',vehicles:'Bicicletas e patinetes',durables:'Bens pessoais',receivables:'A receber',debt:'Dívidas'};
const salesKinds={retail:'Varejo',wholesale:'Atacado',service:'Serviços',property:'Imóveis',rent:'Aluguéis'};
const stamp=m=>`D${Math.floor(m/1440)+1} ${String(Math.floor(m%1440/60)).padStart(2,'0')}:${String(Math.floor(m%60)).padStart(2,'0')}`;
const pct=n=>`${(n*100).toFixed(1)}%`;
function pages(ui,p,rows,draw){
 const key=ui.view()+':'+(ui.wealthAccountId||ui.wealthLocationId||ui.wealthGoodId||''),all=rows.filter(r=>ui.matches(r.search||r.name||r.label||''));ui.wealthPages??={};let page=Math.min(ui.wealthPages[key]||0,Math.max(0,Math.ceil(all.length/20)-1));
 p.buttons([{label:'‹ ANTERIORES',click:()=>{ui.wealthPages[key]=Math.max(0,page-1);ui.resetScroll();}},{label:`${page+1}/${Math.max(1,Math.ceil(all.length/20))} · ${all.length} registros`,click:()=>{}},{label:'PRÓXIMOS ›',click:()=>{ui.wealthPages[key]=Math.min(Math.ceil(all.length/20)-1,page+1);ui.resetScroll();}}]);
 for(const row of all.slice(page*20,page*20+20))draw(row);
 if(!all.length)p.note('Nenhum registro encontrado.');
}
function detail(ui,fields){ui.remember();Object.assign(ui,{wealthAccountId:null,wealthLocationId:null,wealthGoodId:null,marketSaleId:null},fields);ui.resetScroll();}
function accountLink(ui,p,r){p.button(r.name,()=>detail(ui,{wealthAccountId:r.id}));}
function assetRows(ui,p,report,assets){pages(ui,p,assets.map(a=>({...a,name:a.label,search:`${a.label} ${a.location} ${ui.city.accountName(a.ownerId)}`})),a=>p.record(a.label,`${kinds[a.kind]} · ${a.location} · ${ui.city.accountName(a.ownerId)}`,()=>detail(ui,{wealthAccountId:a.ownerId}),false,{value:money(a.value)}));}
function saleRows(ui,p,rows){pages(ui,p,rows.map(r=>({...r,search:`${r.buyerName} ${r.sellerName} ${r.reason}`})),r=>p.record(`${stamp(r.minute)} · ${r.reason}`,`${r.buyerName} → ${r.sellerName}`,()=>detail(ui,{marketSaleId:r.id}),false,{value:money(r.amount)}));}
export function renderMarket(ui,p){
 const city=ui.city,r=wealthReport(city),openAccount=id=>detail(ui,{wealthAccountId:id});
 if(ui.wealthAccountId!=null){
  const direct=r.direct.get(ui.wealthAccountId),owner=r.owners.get(ui.wealthAccountId),a=direct||owner;if(!a){p.note('Conta não encontrada.');return;}
  p.button('‹ VOLTAR AO MERCADO',()=>detail(ui,{}));p.heading(a.name);p.metrics([['Caixa próprio',money(a.cash)],['Poupança',money(a.savings)],['Patrimônio líquido direto',money(a.net)],['Com participações',money(owner?.net??a.net)]]);
  for(const[k,label]of Object.entries(kinds))if(a[k])p.kv(label,money(a[k]));
  const b=city.building(a.buildingId);if(b)p.buttons([{label:'VER EMPRESA / IMÓVEL',click:()=>ui.openBuilding(b.id)},{label:'LOCALIZAR',click:()=>ui.camera(b.entity.x,b.entity.y)}]);
  if(a.citizenId!=null)p.button('VER CIDADÃO',()=>ui.openCitizen(a.citizenId));
  if(owner?.companies.length){p.heading('PARTICIPAÇÕES EM EMPRESAS');for(const c of owner.companies)p.record(c.name,`${pct(c.share)} da empresa`,()=>openAccount(c.accountId),false,{value:money(c.value)});}
  const controllers=r.control.get(a.id)||[];if(controllers.some(c=>c.id!==a.id)){p.heading('QUEM CONTROLA');for(const c of controllers)p.record(city.accountName(c.id),pct(c.share),()=>openAccount(c.id));}
  p.heading('BENS E LOCALIZAÇÕES');assetRows(ui,p,r,a.assets.map(id=>r.assets[id]));
  const claims=r.claims.filter(c=>c.from===a.id||c.to===a.id);if(claims.length){p.heading('DÍVIDAS E DIREITOS');for(const c of claims.slice(-20))p.record(c.label,`${city.accountName(c.from)} → ${city.accountName(c.to)}`,()=>openAccount(c.from===a.id?c.to:c.from),false,{value:money(c.amount)});}
  return;
 }
 if(ui.wealthLocationId!=null){const place=r.locations.find(l=>l.id===ui.wealthLocationId);p.button('‹ VOLTAR',()=>detail(ui,{}));if(!place){p.note('Local sem bens registrados.');return;}p.heading(place.name);p.kv('Valor dos bens neste local',money(place.value));if(Number.isFinite(place.x)&&Number.isFinite(place.y))p.button('LOCALIZAR',()=>ui.camera(place.x,place.y));assetRows(ui,p,r,place.assets.map(id=>r.assets[id]));return;}
 if(ui.wealthGoodId!=null){const g=r.goods.find(g=>g.good===ui.wealthGoodId),spec=city.economy.goods[ui.wealthGoodId];p.button('‹ VOLTAR',()=>detail(ui,{}));p.heading(spec.label);p.kv('Preço atual por unidade',money(spec.price));p.kv('Quantidade física registrada',g?.quantity||0);pages(ui,p,(g?.holders||[]).map(h=>({...h,name:h.location,search:`${h.location} ${city.accountName(h.ownerId)}`})),h=>p.record(h.location,`${city.accountName(h.ownerId)} · ${h.quantity} unidades`,()=>openAccount(h.ownerId),false,{value:money(h.value)}));return;}
 if(ui.marketSaleId!=null){const s=r.sales.find(s=>s.id===ui.marketSaleId);p.button('‹ VOLTAR',()=>detail(ui,{}));if(!s){p.note('Venda fora da janela de registros retidos.');return;}p.heading(s.reason);p.kv('Quando',stamp(s.minute));p.kv('Tipo',salesKinds[s.kind]);p.kv('Valor pago',money(s.amount));accountLink(ui,p,{id:s.buyer,name:`Comprador: ${s.buyerName}`});accountLink(ui,p,{id:s.seller,name:`Vendedor: ${s.sellerName}`});if(s.good)p.kv('Produto',city.economy.goods[s.good]?.label||s.good);if(s.quantity!=null)p.kv('Quantidade',s.quantity);if(s.buildingId!=null)p.button('VER IMÓVEL / EMPRESA',()=>ui.openBuilding(s.buildingId));if(s.eventId)p.button('INSPECIONAR EVENTO',()=>ui.openEvent(s.eventId));if(s.shipmentId)p.button(`VER FRETE #${s.shipmentId}`,()=>ui.openPanel({tab:'transport',selectedShipmentId:s.shipmentId,views:{transport:'active'}}));return;}
 const view=ui.view();
 if(view==='people'||view==='companies'){
  p.heading(view==='people'?'RIQUEZA DOS CIDADÃOS':'PATRIMÔNIO DAS EMPRESAS');p.note(view==='people'?'Patrimônio líquido inclui bens próprios e participações nas empresas, descontadas as dívidas.':'Valores diretos das empresas. Seus sócios já recebem a participação correspondente no ranking das pessoas.');
  pages(ui,p,view==='people'?r.people:r.companies,a=>p.record(a.name,`Caixa ${money(r.direct.get(a.id)?.cash||0)} · dívidas ${money(a.debt)}${a.companyEquity?` · empresas ${money(a.companyEquity)}`:''}`,()=>openAccount(a.id),false,{value:money(a.net)}));return;
 }
 if(view==='locations'){p.heading('ONDE ESTÃO OS BENS');p.note('Dinheiro, poupança, imóveis, terrenos, estoques e bens móveis agrupados pelo local de custódia.');pages(ui,p,r.locations,l=>p.record(l.name,`${l.owners.size} titulares · ${[...l.kinds].map(k=>kinds[k]).join(', ')}`,()=>detail(ui,{wealthLocationId:l.id}),false,{value:money(l.value)}));return;}
 if(view==='goods'){
  p.heading('PREÇOS, ESTOQUES E PROCURA');const rows=Object.entries(city.economy.goods).map(([good,spec])=>({good,name:spec.label,stock:r.goods.find(g=>g.good===good)?.quantity||0,price:spec.price,demand:city.economy.market?.[good]?.demand||0}));
  pages(ui,p,rows,g=>p.record(g.name,`Estoque físico ${g.stock} · procura ${Math.round(g.demand)}`,()=>detail(ui,{wealthGoodId:g.good}),false,{value:money(g.price)}));return;
 }
 if(view==='sales'){
  p.heading('VENDAS E SERVIÇOS RECENTES');p.note('Até 600 pagamentos comerciais recentes. Reservas, salários, impostos, empréstimos e estornos ficam fora desta lista.');p.buttons([{label:'TODOS',click:()=>{ui.marketKindId=null;ui.resetScroll();},selected:!ui.marketKindId},...Object.entries(salesKinds).map(([id,label])=>({label,selected:ui.marketKindId===id,click:()=>{ui.marketKindId=id;ui.resetScroll();}}))]);saleRows(ui,p,r.sales.filter(s=>!ui.marketKindId||s.kind===ui.marketKindId));return;
 }
 p.heading('MERCADO E RIQUEZAS');p.metrics([['Dinheiro local',money(r.totals.localMoney)],['Bens registrados',money(r.totals.realAssets)],['Patrimônio local estimado',money(r.totals.gross-r.totals.externalMoney)],['Patrimônio mediano',money(r.distribution.median)]]);
 p.meters([['Riqueza dos 10% mais ricos',r.distribution.top10*100],['Concentração (Gini)',r.distribution.gini*100]]);
 p.note(`${r.distribution.zero} cidadãos sem patrimônio líquido positivo. Gini: 0 indica igualdade; 100, concentração máxima.`);
 p.heading('QUEM CONTROLA A RIQUEZA');
 const groups=[['Pessoas',a=>a.type==='person'],['Prefeitura',a=>a.type==='public'],['Partidos',a=>a.type==='party'],['Outras instituições',a=>!['person','public','party','external'].includes(a.type)]];
 for(const[label,test]of groups)p.kv(label,money([...r.owners.values()].filter(test).reduce((n,a)=>n+a.net,0)));
 p.button('VER PATRIMÔNIO DA PREFEITURA',()=>openAccount('treasury'));p.kv('Caixa externo (fornecedor e comércio)',money(r.totals.externalMoney));
 p.heading('MAIORES PATRIMÔNIOS PESSOAIS');for(const a of r.people.slice(0,5))p.record(a.name,`${a.companies.length} participações empresariais`,()=>openAccount(a.id),false,{value:money(a.net)});
 p.heading('ÚLTIMAS NEGOCIAÇÕES');for(const s of r.sales.slice(0,5))p.record(s.reason,`${stamp(s.minute)} · ${s.buyerName} → ${s.sellerName}`,()=>detail(ui,{marketSaleId:s.id}),false,{value:money(s.amount)});
 ui.section(p,'wealth-method','COMO OS VALORES SÃO CALCULADOS',p=>p.note('Dinheiro é somado uma vez por conta, com poupança e reservas atribuídas ao titular. Bens usam preços atuais e condição; imóveis e terrenos usam seus valores registrados. Estoques em trânsito não se repetem no destino. Participações redistribuem o patrimônio das empresas aos sócios, sem criar riqueza adicional. Dívidas têm um credor correspondente. Recursos ainda não extraídos, ruas e vegetação não recebem preço neste relatório. O fornecedor externo fica separado do dinheiro local. Atualização a cada 750 ms enquanto a janela está aberta.'));
}
