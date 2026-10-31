import {TAX_CATEGORIES,taxRate} from './city_sales_tax.js';
import {equityShares} from './city_equity.js?v=landlord-stock-market-1';
import {contextActions} from './city_context_actions.js';
import {describePoliticalOrientation} from './city_ideology.js';
import {electoralPriorities} from './city_electoral_behavior.js';
import {renderInterventions} from './city_interventions_ui.js';
import {renderResearchDirectory,renderResearchProgress,renderPollMethod} from './city_research_ui.js';
import {POLITICS_SECTIONS,POLITICS_GROUPS} from './city_ui_sections.js';
import {renderPartyOrganization} from './city_party_organization_ui.js';
import {approvalReport} from './city_political_institutions.js';
import { formatMoney } from './city_ui_format.js';
import { drawPartyFlag } from './city_party_flags.js';
import { PROMISE_METRICS } from './city_mandates.js';
import { CRIME_TYPES } from './city_justice.js';
import {recentBusinessRevenue} from './city_government_performance.js';
const money=formatMoney;
const stamp=n=>`Dia ${Math.floor(n/1440)+1}, ${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const states={'awaiting-session':'Aguardando apresentação no plenário',dismissed:'Arquivado','awaiting-sanction':'Aguardando sanção ou veto',vetoed:'Vetado: aguardando Câmara','veto-maintained':'Veto mantido',proposed:'Em discussão / aguardando quorum',approved:'Aprovado',executing:'Em execução / aguardando condições',executed:'Executado',rejected:'Rejeitado'};
const format=(metric,value)=>{const spec=PROMISE_METRICS[metric];return `${Number(value||0).toFixed(['%','dias'].includes(spec?.unit)?1:0)}${spec?.unit==='%'?'%':spec?.unit==='centavos'?' centavos/hora':spec?.unit==='dias'?' dias':''}`;};
function paginate(ui,p,rows,key,size=8){if(!rows.length){p.note('Nenhum registro disponível.');return [];}if(rows.length<=size)return rows;const page=Math.min(ui[key]||0,Math.max(0,Math.ceil(rows.length/size)-1));p.note(`${rows.length} registros / página ${page+1}`);p.buttons([{label:'ANTERIOR',click:()=>{ui[key]=Math.max(0,page-1);}},{label:'PRÓXIMA',click:()=>{ui[key]=page+1;}}]);return rows.slice(page*size,page*size+size);}
function flag(p,party){if(p.visible(42))drawPartyFlag(p.ui.ctx,party.flag,p.x,p.y,60,36);p.y+=42;}
function fold(ui,p,key,label,draw){ui.helpOpen??={};const open=!!ui.helpOpen[key];p.disclosure(label,open,()=>{ui.helpOpen[key]=!open;});if(open)draw();}
function promise(p,pr,campaign=false,ui=null){
  p.record(pr.title,`${campaign?'Na campanha':'Na posse'}: ${format(pr.metric,pr.baseline??pr.campaignBaseline)} · Meta: ${format(pr.metric,pr.target)}`,null,false,{value:campaign?'':pr.fulfilled?'Atingida':pr.progress>0?'Melhorou':pr.progress<0?'Piorou':'Sem avanço'});
  if(pr.ambitionLabel)p.kv('Ambição da meta',`${pr.ambitionLabel} · atenção ${(100*(pr.attention??0)).toFixed(0)}/100`);
  if(campaign){p.kv('Avanço prometido',`${pr.higher?'Aumentar':'Reduzir'} ${format(pr.metric,Math.abs(pr.target-pr.campaignBaseline))}`);p.note('Metas maiores atraem atenção e aumentam a cobrança ao fim do governo.');}
  if(!campaign){p.kv('Última medição',format(pr.metric,pr.current));p.kv('Avanço desde a posse',`${pr.higher?'Ganho':'Redução'} de ${format(pr.metric,(pr.current-pr.baseline)*(pr.higher?1:-1))}`);
    if(pr.fulfilledAt!=null)p.kv('Primeiro cumprimento',stamp(pr.fulfilledAt));
    const a=pr.assessment;if(a){p.kv('Superação do avanço prometido',`${(a.overdelivery*100).toFixed(1)}%`);p.kv('Efeito da promessa na avaliação',`${a.points>=0?'+':''}${a.points.toFixed(2)} pontos`);p.note(`Avanço +${a.partial.toFixed(1)} · conclusão +${a.completion.toFixed(1)} · rapidez +${a.early.toFixed(1)} · superação +${a.excess.toFixed(1)} · pendência ${a.pending.toFixed(1)} · recuos ${a.regression.toFixed(1)} · execução +${(a.initiative||0).toFixed(1)}`);}
    if(pr.execution){p.block('EXECUÇÃO DO PLANO',pr.execution.status,q=>{if(pr.execution.plan?.length)q.note(`Cadeia prevista: ${pr.execution.plan.join(' → ')}`);if(pr.execution.blocked)q.note(pr.execution.blocked);for(const action of pr.execution.actions.slice(-6).reverse()){q.record(stamp(action.minute),action.description,()=>ui.openEvent(action.eventId));if(action.billId)q.button(`PROJETO #${action.billId}`,()=>ui.openPanel({politicsTab:'council',councilView:'bills',billId:action.billId,recordWindow:true}));if(action.projectId)q.button('CONTRATO DA MEDIDA',()=>ui.openContract(action.projectId));if(action.result)q.note(action.result);}});}
    if(ui&&pr.lastEventId)p.button('INSPECIONAR ÚLTIMO MARCO',()=>ui.openEvent(pr.lastEventId));
  }
}
export function renderPoliticsNavigation(ui,p){
  const tab=ui.politicsTab||'overview';
  const group=POLITICS_GROUPS.find(([, , ids])=>ids.includes(tab))||POLITICS_GROUPS[0];
  const change=id=>ui.openPanel({politicsTab:id,billId:null,termId:null,recordWindow:false,approvalView:'summary',councilView:'bills'});
  p.links(POLITICS_GROUPS.map(([id,label,ids])=>({label,selected:group[0]===id,click:()=>change(ids[0])})));
  p.links(POLITICS_SECTIONS.filter(([id])=>group[2].includes(id)).map(([id,label])=>({label,selected:tab===id,click:()=>change(id)})));
}
export function renderPolitics(ui,p) {
  const city=ui.city,gov=city.politics,active=gov.active,tab=ui.politicsTab||'overview',partyName=id=>gov.party(id)?.ballotLabel||'Sem partido';
  if(!ui.politicsNavigationPinned)renderPoliticsNavigation(ui,p);
  if(!ui.billId)p.heading(POLITICS_SECTIONS.find(([id])=>id===tab)?.[1]||'GOVERNO, CÂMARA E ELEIÇÕES');
  if(tab==='directory'&&ui.host){p.meter('Aprovação do governo',gov.approval);p.kv(gov.isProvisionalMayor()?'Prefeito provisório':'Prefeito',city.accountName(`citizen:${city.economy.mayorId}`));p.kv('Vereadores',`${gov.council.members.length}/${gov.council.seats}`);p.kv('Partidos ativos',gov.parties.filter(p=>p.active).length);return;}
  if(tab==='directory'){
    for(const [label,ids] of [['GESTÃO',['overview','approval','promises']],['INSTITUIÇÕES',['parties','council','institutes','research-services']],['ELEIÇÕES',['campaign','polls','results']],['CONTROLE PÚBLICO',['scandals']]]){p.heading(label);for(const id of ids){const title=POLITICS_SECTIONS.find(([key])=>key===id)[1];p.windowLink(title,()=>ui.openPanel({politicsTab:id,billId:null,termId:null,councilView:'bills',approvalView:'summary'}));}}return;
  }
  if(tab==='interventions'){renderInterventions(ui,p);return;}
  if(tab==='institutes'||tab==='research-services'){renderResearchDirectory(ui,p);return;}
  if(tab==='approval'){
    const view=ui.approvalView||'summary';p.links([['summary','RESUMO'],['changes','DESDE A POSSE'],['promise','PROMESSA'],['conditions','CONDIÇÕES E PENALIDADES']].map(([id,label])=>({label,selected:view===id,click:()=>ui.openPanel({approvalView:id})})));
    const report=gov.approvalReport?.version===5?gov.approvalReport:approvalReport(gov),signed=n=>`${n>0?'+':''}${n.toFixed(2)} p.p.`,finance=report.finance;
    p.meter('Aprovação do governo',report.score);p.kv('Avaliação',report.score>50?'Saldo positivo (acima de 50 pontos)':report.score<50?'Saldo negativo (abaixo de 50 pontos)':'Avaliação neutra (50 pontos)');p.kv('Atualização',stamp(report.minute));
    p.heading('GESTÃO MATERIAL E SERVIÇOS');
    p.metrics([['CAIXA MUNICIPAL',money(finance.cash),finance.cash<finance.reserve?'#e8757a':'#70c8dc'],['SAÚDE DO CAIXA',`${finance.cashHealth.toFixed(1)}/100`,finance.cashHealth<35?'#e8757a':'#91c98c'],['SALDO DE CUSTEIO',money(finance.operatingBalance),finance.operatingBalance<0?'#e8757a':'#91c98c']]);
    p.kv('Caixa / reserva social',`${money(finance.cash)} / ${money(finance.reserve)}`);p.kv('Equilíbrio das despesas recorrentes',`${finance.operatingHealth.toFixed(1)}/100 · ${finance.expenses?`${money(finance.operatingBalance)} em relação a ${money(finance.expenses)} de despesas recentes`:'sem despesas recentes registradas'}`);
    p.kv('Empresas ativas com equipe e receita recente',`${finance.productiveCompanies}/${finance.activeCompanies} · ${finance.companyProductivity.toFixed(1)}/100`);
    p.note(finance.revenueWindowReady?'Produtividade baseada na receita registrada nos últimos 30 dias.':'Acompanhamento da receita recente está começando; até completar 30 dias, usa receita acumulada para evitar rebaixar empresas sem histórico da janela.');
    if(finance.cash<=0)p.status('TESOURO SEM CAIXA','A avaliação desconta o caixa zerado; benefícios, salários e serviços podem ficar sem pagamento.','#e8757a');
    if(finance.activeCompanies>finance.productiveCompanies){p.heading('EMPRESAS SEM EQUIPE OU RECEITA RECENTE');for(const b of (city.economy.businesses||[]).filter(b=>b.active&&!b.entity.destroyed&&(!b.workers?.length||(finance.revenueWindowReady?recentBusinessRevenue(city,b)<=0:(b.totalRevenue||0)<=0))).slice(0,12))p.record(b.entity.properties.name,`${b.workers?.length||0}/${b.jobs||0} funcionários · receita ${finance.revenueWindowReady?'nos últimos 30 dias':'acumulada'} ${money(finance.revenueWindowReady?recentBusinessRevenue(city,b):(b.totalRevenue||0))} · saldo ${money(b.balance||0)}`,()=>ui.openBuilding(b.id));}
    const term=gov.mandates.current;if(term?.promises?.length){p.heading('METAS DA GESTÃO');for(const promise of term.promises){const spec=PROMISE_METRICS[promise.metric],current=term.latest[promise.metric]??promise.current??promise.baseline;p.record(spec?.label||promise.title,`${format(promise.metric,current)} de ${format(promise.metric,promise.target)} · início ${format(promise.metric,promise.baseline)}${promise.fulfilled?' · meta cumprida':''}`,()=>ui.openPanel({politicsTab:'promises',termId:term.id,mandateView:'promise'}));}}
    p.note('O cálculo parte de 50 pontos, a nota neutra. A evolução desde a posse tem mais peso que as condições herdadas. Cumprimento, rapidez e superação da promessa somam pontos; retrocessos, pendências e decisões impopulares descontam. O ritmo da gestão anterior ajusta os bônus positivos. Ganhos sucessivos têm retorno decrescente, preservando espaço para discordância e evitando unanimidade automática.');
    p.note(`Sustentam a avaliação: ${(report.housed*100).toFixed(1)}% com moradia, ${(report.fed*100).toFixed(1)}% acima do limiar de fome e ${(report.employment*100).toFixed(1)}% com emprego ou negócio.`);
    const worst=report.rows.filter(r=>r.points<-.01).slice().sort((a,b)=>a.points-b.points).slice(0,3);if(worst.length)p.note('Maiores perdas: '+worst.map(r=>`${r.label.toLowerCase()} (${signed(r.points)})`).join('; ')+'.');
    const best=report.rows.filter(r=>r.points>.01&&!r.label.startsWith('Limite do efeito')).slice().sort((a,b)=>b.points-a.points).slice(0,3);if(best.length)p.note('Maiores ganhos: '+best.map(r=>`${r.label.toLowerCase()} (${signed(r.points)})`).join('; ')+'.');
    p.kv('Ponto de partida',report.startingScore);if(report.expectations.previousTermId){p.note(report.expectations.detail);p.button('GESTÃO ANTERIOR USADA NA COMPARAÇÃO',()=>ui.openPanel({politicsTab:'promises',termId:report.expectations.previousTermId,mandateView:'indicators'}));}
    const rows=report.rows.filter(row=>view==='summary'?Math.abs(row.points)>.01:view==='changes'?row.label.startsWith('Mudança')||['Limite do efeito das mudanças','Expectativa em relação à gestão anterior'].includes(row.label):view==='promise'?['Avanço da promessa','Execução comprovada do plano','Meta alcançada','Rapidez do cumprimento','Superação da meta','Cobrança da promessa pendente','Recuos na promessa','Limite do efeito da promessa','Expectativa em relação à gestão anterior'].includes(row.label):row.label.startsWith('Condições')||['Caixa municipal e reserva','Equilíbrio do custeio público','Produtividade das empresas ativas','Corrupção comprovada','Vetos do prefeito','Fundo partidário'].includes(row.label));
    for(const row of rows){p.heading(`${row.label}: ${signed(row.points)}`);p.note(row.detail);}
    p.kv('Soma antes do retorno decrescente',report.raw.toFixed(2));if(Math.abs(report.adjustment)>.001)p.kv('Retorno decrescente dos ganhos e perdas',signed(report.adjustment));p.kv('Nota final',report.score.toFixed(2));
    p.note('Este é o índice geral usado pelo governo. Pesquisas eleitorais medem uma amostra de moradores e podem produzir outro resultado.');
  }
  if(tab==='overview'){
    p.metrics([['APROVAÇÃO',`${gov.approval.toFixed(1)}%`,gov.approval<40?'#963226':'#305c28'],['VEREADORES',`${gov.council.members.length}/${gov.council.seats}`]]);
    p.button('ENTENDER A AVALIAÇÃO DO GOVERNO',()=>ui.openPanel({politicsTab:'approval',approvalView:'summary'}));
    p.columns(q=>{
      q.heading('QUEM GOVERNA');
      q.kv(gov.isProvisionalMayor()?'Prefeito provisório':'Prefeito',city.accountName(`citizen:${city.economy.mayorId}`));
      q.kv('Vice-prefeito',gov.viceMayorId?city.accountName(`citizen:${gov.viceMayorId}`):'Vago');
      q.kv('Partido do governo',partyName(gov.partyOfId(city.economy.mayorId)?.id));
      q.kv('Presidência da Câmara',gov.council.leaderId?city.accountName(`citizen:${gov.council.leaderId}`):'Eleição na metade do mandato');
    },q=>{
      q.heading('CALENDÁRIO E REPRESENTAÇÃO');
      q.kv('Próxima eleição',gov.nextElectionAt==null?'Aguardando população adulta':stamp(gov.nextElectionAt));
      q.kv('Mandato / campanha em vigor',`${gov.termRules.termMinutes/1440} / ${gov.termRules.campaignMinutes/1440} dias`);
      q.kv('Partidos ativos / limite',`${gov.parties.filter(a=>a.active).length}/${gov.policy.partyLimit}`);
      q.kv('Reeleições consecutivas',gov.policy.reelectionLimit);
    });
    if(gov.isProvisionalMayor())p.status('GESTÃO PROVISÓRIA','O prefeito fundador não disputa a reeleição seguinte. O resultado desta gestão afeta a imagem do partido.');
    if(gov.suspendedExecutive)p.status('AFASTAMENTO TEMPORÁRIO',`Substituição até ${stamp(gov.suspendedExecutive.until)}; mandato e promessa preservados.`);
    const needs=city.welfare.conditions();
    p.heading('PROTEÇÃO SOCIAL');
    p.metrics([['COM FOME',needs.hungry],['SEM CASA',needs.homeless],['ALIMENTO',`${needs.foodDays.toFixed(1)} dias`],['RESERVA',money(needs.reserve)]]);
    if(needs.crisis)p.status('PRIORIDADE ESSENCIAL','Alimentação, moradia e serviços essenciais têm prioridade na execução.','#963226');
    fold(ui,p,'governmentTaxes','Tributos e salário mínimo',()=>{
      p.kv('Salário mínimo por hora',money(city.currency.price(gov.policy.minimumWage)*60));p.kv('Imposto salarial',`${(city.taxRate*100).toFixed(0)}%`);p.kv('Imposto empresarial',`${(gov.policy.businessTax*100).toFixed(0)}%`);
    });
    fold(ui,p,'governmentPayroll','Orçamentos e regras das próximas gestões',()=>{
      p.kv('Mandato / campanha aprovados',`${gov.policy.termDays} / ${gov.policy.campaignDays} dias`);
      p.kv('Orçamento diário da Câmara',money(gov.policy.councilBudget));p.kv('Salário diário por vereador',money(Math.floor(gov.policy.councilBudget/Math.max(1,gov.council.members.length))));p.kv('Salário diário do prefeito',money(gov.policy.mayorBudget));
      p.note('O orçamento da Câmara é dividido entre os vereadores. Pagamentos respeitam o caixa e a reserva de subsistência; vereadores trabalham exclusivamente no mandato.');
    });
    fold(ui,p,'executiveWorks','Orçamento executivo e contratação de obras',()=>{
      const worksBudget=gov.ensureWorksBudget(),step=city.currency.price(250000);
      p.kv('Verba autorizada para novas obras',money(worksBudget));
      p.kv('Caixa municipal',money(city.treasury));
      p.note('A verba é dinheiro separado do caixa geral. O prefeito pode contratar obras diretamente dentro desse saldo; o valor liberado para cada contrato é descontado do orçamento. A dotação inicial respeita a reserva social do município.');
      p.buttons([{label:`PEDIR +${money(step)} DE ORÇAMENTO`,click:()=>gov.requestWorksBudget(worksBudget+step)},{label:`PEDIR −${money(step)} DE ORÇAMENTO`,click:()=>gov.requestWorksBudget(Math.max(0,worksBudget-step))}]);
      p.note('Solicitar outro limite (valor em centavos):');let inputY=p.y;p.space(24);if(inputY>=p.top&&inputY+20<=p.bottom)ui.inputAt(ui.worksBudgetInput,p.x,inputY,p.w);p.space(3);p.button('SOLICITAR ESTE ORÇAMENTO',()=>gov.requestWorksBudget(Number(ui.worksBudgetInput.value)));
      const transferAmounts=[city.currency.price(50000),city.currency.price(250000),city.currency.price(1000000),city.currency.price(5000000),city.currency.price(25000000)];
      p.note('Transferência solicitada do orçamento geral para a verba de obras. Pedidos maiores recebem menor apoio provável na Câmara.');
      p.buttons(transferAmounts.map(amount=>({label:`PEDIR TRANSFERÊNCIA ${money(amount)}`,click:()=>gov.requestWorksTransfer(amount)})));
      p.note('Ou solicite um valor exato (centavos):');inputY=p.y;p.space(24);if(inputY>=p.top&&inputY+20<=p.bottom)ui.inputAt(ui.worksTransferInput,p.x,inputY,p.w);p.space(3);p.button('SOLICITAR TRANSFERÊNCIA DESTE VALOR',()=>gov.requestWorksTransfer(Number(ui.worksTransferInput.value)));
      const publicTypes=Object.entries(city.buildingTypes).filter(([type])=>!['townhall','mint','council_chamber'].includes(type)&&ui.matches(city.buildingTypes[type].label));
      p.heading('CONTRATAÇÃO DIRETA PELO PREFEITO');
      if(publicTypes.some(([type])=>type==='farm'))p.buttons(Object.entries(city.economy.crops).map(([id,crop])=>({label:`CULTURA ${crop.label.toUpperCase()}`,selected:(ui.publicCrop||'milho')===id,click:()=>{ui.publicCrop=id;}})));
      for(const [type,spec] of paginate(ui,p,publicTypes,'executiveWorkPage',12))p.button(`CONSTRUIR ${spec.label.toUpperCase()}`,()=>gov.startPublicWork(type,ui.publicCrop||'milho'));
      const projects=city.development.projects.filter(project=>project.executiveInitiative&&!project.cancelled).slice(-8).reverse();
      if(projects.length){p.heading('OBRAS CONTRATADAS NESTA GESTÃO');for(const project of projects)p.record(project.name,`${project.status} · verba autorizada ${money(project.worksBudgetCharge||0)}`,()=>ui.openContract(project.id));}
    });
    p.button('JORNAL OFICIAL E VOTAÇÕES PRESERVADAS',()=>ui.openPanel({tab:'publications',selectedPublicationId:null,publicationTab:'official',publicationSourceEventId:null}));
    fold(ui,p,'governmentRules','Como funcionam os projetos e as votações',()=>{
    p.note('A primeira Câmara é provisória. Nas eleições, cada adulto escolhe prefeito e vereador. As cadeiras são distribuídas proporcionalmente por partido. Projetos exigem maioria absoluta dos votos ponderados; cassação e derrubada de veto exigem dois terços. O presidente tem peso de 5% das cadeiras, com mínimo de dois.');
    p.note('O programa vencedor passa pela Câmara. Obras aprovadas precisam de terreno, orçamento, construtora, materiais e transporte. Estatização paga o proprietário; privatização exige comprador com recursos.');
    });
  }
  if(tab==='parties'){
    const adults=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)),independent=adults.filter(c=>!gov.party(c.political?.partyId)?.active),parties=gov.parties.filter(a=>a.active&&ui.matches(`${a.name} ${a.short}`));
    p.metrics([['PARTIDOS',gov.parties.filter(a=>a.active).length],['LIMITE',gov.policy.partyLimit],['SEM PARTIDO',independent.length],['FILIADOS',adults.length-independent.length]]);
    p.table([{label:'Partido',weight:3},{label:'Filiados'},{label:'Cadeiras'},{label:'Reputação'}],parties.map(party=>({cells:[`${party.number??'—'} · ${party.short} · ${party.name}`,party.memberIds.length,gov.council.members.filter(m=>m.partyId===party.id).length,(party.publicReputation??50).toFixed(1)],click:()=>ui.openParty(party.id)})));
    if(!ui.host)p.heading('ORGANIZAÇÃO PARTIDÁRIA');p.links([{label:'REGISTROS E FUNDAÇÕES',click:()=>ui.openPanel({tab:'party-organization',partyOrganizationView:'foundations'})},{label:'CAMPANHAS DE FILIAÇÃO',click:()=>ui.openPanel({tab:'party-organization',partyOrganizationView:'membership'})}]);
    fold(ui,p,'dissolvedParties','Partidos liquidados',()=>{for(const party of gov.parties.filter(a=>a.liquidatedAt!=null))p.record(party.name,`${stamp(party.liquidatedAt)} · sem filiados vivos`,()=>ui.openParty(party.id));});
    fold(ui,p,'partyDirectoryRules','Como funcionam filiação e ideologia',()=>{p.note('Partidos sem filiados vivos são liquidados. O limite é um teto de registros ativos. Simpatia e voto não exigem filiação; lealdade muda com experiências, promessas e corrupção conhecida.');p.note('A orientação é descrita por posição política e correntes, como centro-esquerda social-democrata, esquerda socialista ou direita liberal. Economia, liberdades e ambiente são apresentados em palavras; a filiação não torna todos os membros ideologicamente iguais.');});
  }
  if(tab==='council'){
    const chamber=gov.council.getChamber(),hall=chamber.hall();
    p.metrics([['NO PLENÁRIO',`${chamber.present().length}/${gov.council.members.length}`],['GABINETES',`${chamber.officeCount||0}/${gov.council.members.length}`]]);
    fold(ui,p,'councilPremises','Sede, sessões e obras da Câmara',()=>{
p.kv('Sede e plenário',hall?hall.entity.properties.name:'Sede em planejamento / construção');if(chamber.planning){p.note(chamber.planning.reason);if(chamber.planning.requiredBudget!=null)p.kv('Orçamento necessário / disponível após reserva social',`${money(chamber.planning.requiredBudget)} / ${money(chamber.planning.availableBudget??Math.max(0,city.treasury-city.welfare.conditions().reserve))}`);}
    p.kv('Gabinetes disponíveis / necessários',`${chamber.officeCount||0}/${gov.council.members.length}`);p.kv('Presentes no plenário',`${chamber.present().length}/${gov.council.members.length}`);p.note('Sessões presenciais das 10h às 12h e das 15h às 17h. Apresentações e votações exigem presença na Câmara.');if(hall)p.button('LOCALIZAR PLENÁRIO',()=>ui.camera(hall.door.x,hall.door.y));for(const id of chamber.contracts.slice(-2))p.record('Obra da Câmara',id,()=>ui.openContract(id));
    });
    const view=ui.councilView||'bills';if(!ui.billId){
    const bounds=gov.council.bounds();p.kv('Representação aprovada',`${(gov.policy.councilRate??5).toFixed(1)}% da população / ${gov.council.seats} cadeiras`);p.kv('Faixa legal de vereadores',`${bounds.min} a ${bounds.max} / população ${bounds.population}`);p.kv('Presidência da Câmara',gov.council.leaderId?`${city.accountName(`citizen:${gov.council.leaderId}`)} / voto com peso ${gov.council.weight(gov.council.leaderId)}`:'Eleição pelos pares na metade do mandato');
    p.links([['bills','PROJETOS'],['members','VEREADORES'],['propose','ENCAMINHAR PEDIDO']].map(([id,label])=>({label,selected:view===id,click:()=>ui.openPanel({councilView:id,billId:null})})));
    }
    if(view==='members'){p.heading('LEGISLATURA');p.table([{label:'Vereador',weight:2},{label:'Partido'},{label:'Mandato'}],gov.council.members.filter(m=>ui.matches(`${m.name} ${partyName(m.partyId)}`)).map(m=>({cells:[m.name,partyName(m.partyId),m.provisional?'Provisório':'Eleito'],click:()=>ui.openCitizen(m.citizenId)})));}
    const author=gov.council.members.find(m=>m.citizenId===ui.selectedCouncilorId)||gov.council.members[0];
    if(view==='propose'&&author){fold(ui,p,'petitionAuthor',`Destinatário: ${author.name}`,()=>p.table([{label:'Vereador',weight:2},{label:'Partido'}],gov.council.members.map(m=>({cells:[m.name,partyName(m.partyId)],selected:m.citizenId===author.citizenId,click:()=>{ui.selectedCouncilorId=m.citizenId;ui.helpOpen.petitionAuthor=false;}}))));p.note('Encaminhar cria uma proposta. Os vereadores decidem por votação na simulação.');const submit=(type,payload)=>gov.submitBill(type,payload,author.citizenId);
      fold(ui,p,'petitionCandidacy','Candidatura de empresários',()=>{p.kv('Regra atual',gov.policy.entrepreneurCandidates===false?'Empresários não podem concorrer':'Empresários podem concorrer');p.note('Uma mudança afeta candidaturas futuras e em andamento; mandatos já ocupados não são cassados por esta regra.');p.button(gov.policy.entrepreneurCandidates===false?'PROPOR PERMITIR CANDIDATURAS':'PROPOR PROIBIR CANDIDATURAS',()=>submit('entrepreneurCandidates',{value:gov.policy.entrepreneurCandidates===false}));});
      fold(ui,p,'petitionPolicy','Impostos, salário mínimo, partidos e inflação',()=>{
      p.buttons([{label:'IMPOSTO SALARIAL +2 P.P.',click:()=>submit('tax',{value:Math.min(.5,city.taxRate+.02)})},{label:'IMPOSTO SALARIAL -2 P.P.',click:()=>submit('tax',{value:Math.max(-.5,city.taxRate-.02)})},{label:'IMPOSTO EMPRESARIAL +2 P.P.',click:()=>submit('businessTax',{value:Math.min(.5,gov.policy.businessTax+.02)})},{label:'IMPOSTO EMPRESARIAL -2 P.P.',click:()=>submit('businessTax',{value:Math.max(-.2,gov.policy.businessTax-.02)})},{label:'PISO +1 CENTAVO/MIN',click:()=>submit('minimumWage',{value:gov.policy.minimumWage+1})},{label:'PISO -1 CENTAVO/MIN',click:()=>submit('minimumWage',{value:Math.max(1,gov.policy.minimumWage-1)})},{label:'LIMITE DE PARTIDOS +1',click:()=>submit('partyLimit',{value:gov.policy.partyLimit+1})},{label:'LIMITE DE PARTIDOS -1',click:()=>submit('partyLimit',{value:Math.max(1,gov.policy.partyLimit-1)})},{label:'REELEIÇÕES +1',click:()=>submit('reelectionLimit',{value:gov.policy.reelectionLimit+1})},{label:'REELEIÇÕES -1',click:()=>submit('reelectionLimit',{value:Math.max(0,gov.policy.reelectionLimit-1)})},{label:'CONTROLE DA INFLAÇÃO',click:()=>submit('inflation',{value:Math.max(0,city.currency.policy.dailyLimit-20000)})}]);
      });
      fold(ui,p,'petitionJustice','Código penal e regras de elegibilidade',()=>{
        const justice=city.justice;p.heading('POLÍTICAS DE INTEGRIDADE PARLAMENTAR');p.note('As duas regras começam desligadas. A imunidade exige autorização da Câmara para prender um parlamentar; sem imunidade, vale o procedimento normal.');
        for(const [type,label]of [['cleanRecord','Lei da ficha limpa'],['parliamentaryImmunity','Imunidade parlamentar']]){p.kv(label,justice.policies[type]?'Em vigor':'Desativada');p.button(`PROPOR ${justice.policies[type]?'REVOGAR':'APROVAR'} ${label.toUpperCase()}`,()=>submit(type,{value:!justice.policies[type]}));}
        p.heading('REGRAS POR INFRAÇÃO');p.note('A Câmara decide se cada conduta é crime, sua severidade, multa e efeitos políticos. Regras mais brandas revisam processos anteriores; aumentos de pena valem para fatos novos. Descriminalizar não apaga reparações civis já reconhecidas.');
        for(const [crime,label]of Object.entries(CRIME_TYPES)){const rule=justice.policies.penalCode[crime];if(!rule)continue;
          p.kv(label,`${rule.criminal?'Crime':'Descriminalizada'} · severidade ${rule.severity} · multa ${money(rule.fine)} · reincidência +${rule.recidivismSeverityBonus||0}`);
          const update=changes=>submit('penalCode',{crime,rule:{...rule,...changes}});
          p.buttons([
            {label:rule.criminal?'DESCRIMINALIZAR':'DEFINIR COMO CRIME',click:()=>update({criminal:!rule.criminal})},
            {label:'SEVERIDADE -10',click:()=>update({severity:Math.max(0,rule.severity-10)})},
            {label:'SEVERIDADE +10',click:()=>update({severity:Math.min(100,rule.severity+10)})},
            {label:rule.fineOnly?'PERMITIR PRISÃO':'SOMENTE MULTA',click:()=>update({fineOnly:!rule.fineOnly})},
            {label:rule.politicalDisqualification?'PRESERVAR DIREITOS POLÍTICOS':'SUSPENDER DIREITOS POLÍTICOS',click:()=>update({politicalDisqualification:!rule.politicalDisqualification})},
            {label:rule.cleanRecordDisqualifying?'FICHA LIMPA NÃO BLOQUEIA':'IMPEDIR CANDIDATURA PELA FICHA LIMPA',click:()=>update({cleanRecordDisqualifying:!rule.cleanRecordDisqualifying})},
            {label:rule.cassation?'NÃO CASSAR MANDATO':rule.cassationTrigger==='conviction'?'CASSAR MANDATO NA CONDENAÇÃO':'CASSAR MANDATO NA PRISÃO',click:()=>update({cassation:!rule.cassation})},
            {label:`GATILHO: ${rule.cassationTrigger==='conviction'?'CONDENAÇÃO':'PRISÃO'} · ALTERNAR`,click:()=>update({cassationTrigger:rule.cassationTrigger==='conviction'?'arrest':'conviction'})}
          ]);
          p.buttons([{label:'AGRAVANTE POR REINCIDÊNCIA −10',click:()=>update({recidivismSeverityBonus:Math.max(0,(rule.recidivismSeverityBonus||0)-10)})},{label:'AGRAVANTE POR REINCIDÊNCIA +10',click:()=>update({recidivismSeverityBonus:Math.min(50,(rule.recidivismSeverityBonus||0)+10)})}]);
          if(crime==='graffiti'){
            p.kv('Autorização do proprietário',rule.ownerConsentDefense?'A obra autorizada não gera crime de pichação':'A autorização não afasta o crime');p.buttons([{label:rule.ownerConsentDefense?'CRIMINALIZAR MESMO COM AUTORIZAÇÃO':'RESPEITAR AUTORIZAÇÃO DO DONO',click:()=>update({ownerConsentDefense:!rule.ownerConsentDefense})}]);
            const artworkKinds={banner:'BANNERS',painting:'PINTURAS',graffiti:'PICHAÇÕES',statue:'ESTÁTUAS',flags:'BANDEIRINHAS',monument:'MONUMENTOS'},exempt=new Set(rule.exemptArtworkKinds||[]);p.kv('Suportes isentos de crime',exempt.size?[...exempt].map(kind=>artworkKinds[kind]||kind).join(', '):'Nenhum');
            p.buttons(Object.entries(artworkKinds).map(([kind,label])=>({label:`${exempt.has(kind)?'CRIMINALIZAR':'ISENTAR'} ${label}`,click:()=>update({exemptArtworkKinds:exempt.has(kind)?[...exempt].filter(item=>item!==kind):[...exempt,kind]})})));
          }
          if(crime==='vandalism'){p.kv('Dano mínimo por ato',`${rule.minimumDamage||0}/100 pontos de integridade`);p.buttons([{label:'LIMIAR DE DANO −10',click:()=>update({minimumDamage:Math.max(0,(rule.minimumDamage||0)-10)})},{label:'LIMIAR DE DANO +10',click:()=>update({minimumDamage:Math.min(100,(rule.minimumDamage||0)+10)})}]);}
          p.buttons([{label:'MULTA -100',click:()=>update({fine:Math.max(0,rule.fine-100)})},{label:'MULTA +100',click:()=>update({fine:rule.fine+100})}]);
        }
      });
      fold(ui,p,'petitionResearch','Pesquisas eleitorais',()=>{
        p.kv('Mínimo / máximo em vigor',`${gov.policy.pollMinRate??5}% / ${gov.policy.pollMaxRate??20}% do eleitorado`);
        p.buttons(['pollMinRate','pollMaxRate'].flatMap(type=>[-1,1].map(direction=>({label:`${type==='pollMinRate'?'AMOSTRA MÍNIMA':'AMOSTRA MÁXIMA'} ${direction>0?'+':'−'}1 P.P.`,click:()=>submit(type,{value:Math.max(type==='pollMinRate'?5:15,Math.min(type==='pollMinRate'?10:20,(gov.policy[type]??(type==='pollMinRate'?5:20))+direction))})}))));
      });
      fold(ui,p,'petitionSeats','Cadeiras e remuneração',()=>{
      p.heading('IMPOSTOS POR RAMO');p.note('Alíquotas incluídas no preço, recolhidas pelo vendedor em cada venda. A Câmara pode alterar cada ramo separadamente.');
      for(const [category,spec] of Object.entries(TAX_CATEGORIES)){const rate=taxRate(city,category);p.kv(spec.label,`${(rate*100).toFixed(1)}%`);p.buttons([-1,1].map(direction=>({label:`${spec.label.toUpperCase()} ${direction>0?'+':'−'}2 P.P.`,click:()=>submit('salesTax',{category,value:Math.max(0,Math.min(.5,Math.round((rate+direction*.02)*100)/100))})})));}
      p.heading('FUNDO ELEITORAL');p.kv('Orçamento total por eleição',money(gov.policy.partyFund??80000));p.note('Distribuído igualmente entre todos os partidos. Aumentar prejudica a imagem pública; reduzir melhora.');p.buttons([-1,1].map(direction=>({label:`FUNDO PARTIDÁRIO ${direction>0?'+':'−'}10%`,click:()=>submit('partyFund',{value:Math.max(0,Math.round((gov.policy.partyFund??80000)*(1+direction*.1)))})})));
      p.heading('CADEIRAS E REMUNERAÇÃO');p.note(`Orçamento global: ${money(gov.policy.councilBudget)}/dia, dividido por ${gov.council.members.length} vereadores. Prefeito: ${money(gov.policy.mayorBudget)}/dia.`);p.buttons([{label:'REPRESENTAÇÃO +0,5 P.P.',click:()=>submit('councilRate',{value:Math.min(12.5,(gov.policy.councilRate??5)+.5)})},{label:'REPRESENTAÇÃO -0,5 P.P.',click:()=>submit('councilRate',{value:Math.max(5,(gov.policy.councilRate??5)-.5)})},...['councilBudget','mayorBudget'].flatMap(type=>[-1,1].map(direction=>({label:`${type==='councilBudget'?'ORÇAMENTO CÂMARA':'SALÁRIO PREFEITO'} ${direction>0?'+':'-'}10%`,click:()=>submit(type,{value:Math.max(0,Math.round(gov.policy[type]*(1+direction*.1)))})}))) ]);

      });
      fold(ui,p,'petitionCalendar','Mandatos e campanhas',()=>{
      p.heading('DURAÇÃO DOS MANDATOS E CAMPANHAS');
      p.note('Mudanças aprovadas valem a partir da próxima gestão. A eleição já marcada mantém sua data. A campanha precisa durar pelo menos um dia e menos que o mandato.');
      p.buttons([{label:'MANDATO +1 DIA',click:()=>submit('termDays',{value:gov.policy.termDays+1})},{label:'MANDATO -1 DIA',click:()=>submit('termDays',{value:Math.max(gov.policy.campaignDays+1,gov.policy.termDays-1)})},{label:'CAMPANHA +1 DIA',click:()=>submit('campaignDays',{value:Math.min(gov.policy.termDays-1,gov.policy.campaignDays+1)})},{label:'CAMPANHA -1 DIA',click:()=>submit('campaignDays',{value:Math.max(1,gov.policy.campaignDays-1)})}]);

      });
      fold(ui,p,'petitionWorks','Obras públicas',()=>{
      p.heading('PEDIDOS DE OBRAS PÚBLICAS');
      p.buttons(Object.entries(city.economy.crops).map(([id,crop])=>({label:`CULTURA: ${crop.label.toUpperCase()}`,selected:(ui.publicCrop||'milho')===id,click:()=>{ui.publicCrop=id;}})));
      const types=Object.entries(city.buildingTypes).filter(([type,spec])=>!['townhall'].includes(type)&&ui.matches(spec.label));
      p.buttons(paginate(ui,p,types,'publicBuildPage',8).map(([type,spec])=>({label:`CONSTRUIR ${spec.label.toUpperCase()}`,click:()=>submit('build',{buildingType:type,crop:ui.publicCrop||'milho'})})));

      });
      fold(ui,p,'petitionOwnership','Estatizar ou privatizar empresas',()=>{
      p.heading('PROPRIEDADE DAS EMPRESAS');
      for(const b of paginate(ui,p,city.economy.businesses.filter(b=>(b.ownerId||b.municipal)&&!['townhall','mint'].includes(b.type)&&ui.matches(b.entity.properties.name)),'publicOwnershipPage',8)){const publicShare=equityShares(city,b).find(s=>s.accountId==='treasury')?.points||0;p.button(`PARTICIPAÇÕES: ${b.entity.properties.name} · ${(publicShare/100).toFixed(0)}% pública`,()=>ui.openBuilding(b.id));if(publicShare<10000)p.button(`NEGOCIAR ESTATIZAÇÃO: ${b.entity.properties.name}`,()=>submit('nationalize',{buildingId:b.id}));}
      });

    }
    if(view==='bills'){if(!ui.billId)p.heading('PROJETOS E VOTAÇÕES');if(!ui.billId)for(const b of paginate(ui,p,[...gov.council.bills].reverse().filter(b=>ui.matches(b.title)),'billPage'))p.card(`#${b.id} ${b.title}`,`${partyName(b.partyId)} / ${states[b.status]}${b.votedAt!=null?` / ${b.yes} a ${b.no}`:''}`,()=>ui.openPanel({billId:b.id,recordWindow:true}),ui.billId===b.id);
    const bill=gov.council.bills.find(b=>b.id===ui.billId);if(bill){p.heading(bill.title);p.kv('Autor',bill.authorName);p.kv('Votação',stamp(bill.voteAt));p.kv('Situação',states[bill.status]);if(bill.payload.value!=null)p.kv('Parâmetro proposto',['pollMinRate','pollMaxRate'].includes(bill.type)?`${bill.payload.value}% do eleitorado`:bill.type==='councilRate'?`${bill.payload.value}% da população`:['tax','businessTax'].includes(bill.type)?`${(bill.payload.value*100).toFixed(1)}%`:bill.type==='minimumWage'?`${money(city.currency.price(bill.payload.value)*60)} / hora`:['welfare','inflation'].includes(bill.type)?`${money(bill.payload.value)} / dia`:`${bill.payload.value}${['termDays','campaignDays'].includes(bill.type)?' dias':''}`);if(bill.effectiveFromTerm!=null)p.kv('Vigência','A partir da próxima gestão após a aprovação');if(bill.payload.buildingType)p.kv('Obra',city.buildingTypes[bill.payload.buildingType]?.label||bill.payload.buildingType);if(bill.payload.buildingId)p.button('ABRIR EMPRESA DO PROJETO',()=>ui.openBuilding(bill.payload.buildingId));if(bill.waitingForQuorum)p.note(`Votação aguardando quorum: presença ponderada ${bill.participationWeight??0}/${bill.totalChamberWeight??gov.council.totalWeight()}, mínimo ${bill.requiredQuorum??Math.floor(gov.council.totalWeight()/2)+1}. A proposta continua em tramitação.`);if(bill.votedAt!=null)p.kv('Quorum na votação',`${bill.participationWeight??'—'}/${bill.totalChamberWeight??'—'} presentes · mínimo ${bill.requiredQuorum??'—'} · aptos ${bill.eligibleWeight??'—'}`);if(bill.status==='awaiting-sanction')p.button('PREFEITO: VETAR PROJETO',()=>gov.vetoBill(bill.id));if(bill.vetoedAt)p.note(`Veto em ${stamp(bill.vetoedAt)}; impacto negativo na aprovação. ${bill.vetoOverridden?'Câmara derrubou o veto.':''}`);if(bill.threshold)p.kv('Maioria para aprovação',`${bill.threshold} votos ponderados entre os presentes aptos`);if(bill.result)p.note(bill.result);if(bill.projectId)p.button('CONTRATO DA OBRA',()=>ui.openContract(bill.projectId));fold(ui,p,`votes:${bill.id}`,'Votos e justificativas',()=>{for(const v of bill.votes)p.note(`${v.name} (${partyName(v.partyId)}): ${v.yes?'SIM':'NÃO'} (peso ${v.weight||1}) — ${v.reason}`);});p.button('ABRIR EVENTO DO PROJETO',()=>ui.openEvent(bill.eventId));}}
  }
  if(tab==='campaign'){if(active)contextActions(ui,p,{election:active});
    if(active)p.button('ABRIR ACOMPANHAMENTO DESTA ELEIÇÃO',()=>ui.host?.openElection(active.id,['campaign','scheduled'].includes(active.status)?'polls':'count'));
    if(!active){p.note(`As campanhas começam ${gov.termRules.campaignMinutes/1440} dias antes da eleição.`);return;}p.heading(`CAMPANHA ${active.id} · ${active.round||1}º TURNO`);p.metrics([['AGENTES NAS RUAS',city.citizens.filter(c=>c.campaign?.electionId===active.id).length],['ELEITORES CONTATADOS',active.contactedIds?.size||0],['PROPAGANDAS INSTALADAS',gov.campaigns.getMaterials().decorations.filter(d=>d.until>city.minute).length],['TURNOS CONTRATADOS',active.streetCampaign?.turns||0]]);p.kv('Duração prevista',`${(active.voteAt-active.startedAt)/1440} dias`);p.kv('Votação',stamp(active.voteAt));
    p.buttons(active.candidates.map(c=>({label:`${partyName(c.partyId)} · ${c.name}`,selected:ui.campaignCandidateId===c.citizenId,click:()=>{ui.campaignCandidateId=c.citizenId;}})));
    const candidate=active.candidates.find(c=>c.citizenId===ui.campaignCandidateId)||active.candidates[0];
    if(candidate){
      const c=candidate,party=gov.party(c.partyId),personal=city.society.citizen(c.citizenId)?.political?.popularity??50;
      flag(p,party);p.card(c.name,`${party.number??'—'} · ${party.short} · reputação ${ (party.publicReputation??50).toFixed(1)}/100`,()=>ui.openCitizen(c.citizenId));
      p.metrics([['POPULARIDADE',`${personal.toFixed(1)}/100`],['REPUTAÇÃO DO PARTIDO',`${(party.publicReputation??50).toFixed(1)}/100`],['APOIOS',c.endorsementPartyIds.length]]);
      if(c.promises?.length){p.heading('PROMESSA DE CAMPANHA');promise(p,c.promises[0],true,ui);if(c.promises.length>1)fold(ui,p,`extraPromises:${active.id}:${c.citizenId}`,`Outras propostas (${c.promises.length-1})`,()=>c.promises.slice(1).forEach(pr=>promise(p,pr,true,ui)));}
      fold(ui,p,`candidateProfile:${active.id}:${c.citizenId}`,'Chapa, coligação e indicação',()=>{if(c.viceId){p.kv('Vice-prefeito',c.viceName||city.accountName(`citizen:${c.viceId}`));p.kv('Partido do vice',partyName(c.vicePartyId));}p.kv('Orientação do candidato',describePoliticalOrientation(city.society.citizen(c.citizenId)).label);p.kv('Número do partido',party.number??c.partyNumber??'—');p.kv('Partidos da coligação / apoio',c.endorsementPartyIds.map(partyName).join(', ')||'Nenhum');p.kv('Critério da indicação',c.nominationReason||'Escolha partidária');p.kv('Popularidade na indicação',`${(c.popularityAtNomination??50).toFixed(1)}/100`);});
      fold(ui,p,`candidateFinance:${active.id}:${c.citizenId}`,'Financiamento da campanha',()=>{p.kv('Fundo disponível do partido',money(gov.partyAccount(party).balance));if(active.partyFunding)p.kv('Repasse público por partido',`${money(active.partyFunding.paidPerParty)} de ${money(active.partyFunding.perParty)} · ${active.partyFunding.status}`);if(c.campaignFinance)p.kv('Doações recebidas / gastos',`${money(c.campaignFinance.received)} / ${money(c.campaignFinance.spent)}`);});
      fold(ui,p,`candidateField:${active.id}:${c.citizenId}`,'Equipe, alcance e propaganda',()=>{const known=city.citizens.filter(v=>v.political?.candidateContacts?.[`${active.id}:${c.citizenId}`]).length,team=city.citizens.filter(v=>v.campaign?.electionId===active.id&&v.campaign.candidateId===c.citizenId).length;p.metrics([['ELEITORES QUE CONHECEM',known],['EQUIPE ATUAL',team]]);const missions=gov.campaigns.getMaterials().missions.filter(m=>m.electionId===active.id&&m.candidateId===c.citizenId).slice(-5).reverse();if(missions.length){p.heading('MATERIAIS E AÇÕES');for(const mission of missions)p.record(`${mission.kind==='pamphlet'?'Panfletaço':mission.kind==='flag'?'Bandeira':mission.kind==='banner'?'Faixa':'Pintura'} · ${city.accountName(`citizen:${mission.workerId}`)}`,`${mission.status} · ${mission.quantity} ${city.economy.goods[mission.good]?.label||mission.good} · ${money(mission.paid)}`,()=>ui.openEvent(mission.eventId));}else p.note('Nenhuma ação de propaganda registrada para esta candidatura.');});
    }

    p.heading('ACONTECIMENTOS DA CAMPANHA');const events=paginate(ui,p,[...active.events].reverse(),'campaignPage');if(events.length)for(const event of events)p.record(stamp(event.minute),event.message,()=>ui.openEvent(event.eventId));else p.note('Ainda não há acontecimentos registrados.');
  }
  if(tab==='polls'){
    const e=gov.elections.find(e=>e.id===ui.electionId)||active||gov.lastResult;if(e)renderResearchProgress(ui,p,e);else p.windowLink('INSTITUTOS DE PESQUISA',()=>ui.openPanel({politicsTab:'institutes',studyId:null}));if(!e?.polls?.length){p.note('Nenhuma pesquisa de campanha disponível.');return;}
    p.links(e.polls.map(poll=>({label:`${poll.instituteName||'Pesquisa'} · #${poll.id}`,selected:ui.pollId===poll.id,click:()=>ui.openPanel({electionId:e.id,pollId:poll.id})})));
    const poll=e.polls.find(s=>s.id===ui.pollId)||e.polls.at(-1);
    contextActions(ui,p,{poll});
    p.block(`PESQUISA ${poll.id}`,stamp(poll.minute),q=>{q.metrics([['AMOSTRA',poll.sampleSize],['INDECISOS',poll.undecided],['APROVAÇÃO',`${poll.approval.toFixed(1)}%`],['MARGEM',`±${poll.marginOfError.toFixed(1)} p.p.`]]);q.kv('Eleitorado / população total',`${poll.population} / ${poll.cityPopulation??poll.population}`);});
    p.heading('INTENÇÕES E REJEIÇÃO');p.table([{label:'Candidato',weight:2},{label:'Intenção'},{label:'Rejeição'}],poll.results.map(r=>({cells:[r.name,`${(r.intentions/Math.max(1,poll.sampleSize)*100).toFixed(1)}%`,`${(r.rejections/Math.max(1,poll.sampleSize)*100).toFixed(1)}%`],click:()=>ui.openCitizen(r.candidateId)})));
    fold(ui,p,'pollMethod','Instituto, financiamento e método',()=>renderPollMethod(ui,p,poll));
    p.heading('RESPOSTAS INDIVIDUAIS');p.note('A lista resume cada entrevista. Abra uma resposta para ver os motivos, fatores e rejeições em detalhe.');const responses=poll.responses.filter(r=>ui.matches(r.name));for(const response of paginate(ui,p,responses,'pollResponsePage',8)){const choice=response.decided?city.accountName(`citizen:${response.candidateId}`):'Indeciso';p.record(response.name,`${choice} · ${response.reason}`,()=>ui.openPanel({tab:'poll-response',electionId:e.id,pollId:poll.id,pollResponseCitizenId:response.citizenId}),false,{value:response.decided?'DECIDIDO':'INDECISO'});}
  }
  if(tab==='promises'){
    p.links([...gov.mandates.terms].reverse().slice(0,12).map(t=>({label:`GESTÃO ${t.id} / ${partyName(t.partyId)}`,selected:ui.termId===t.id,click:()=>ui.openPanel({termId:t.id,mandateView:'promise'})})));
    const term=gov.mandates.terms.find(t=>t.id===ui.termId)||gov.mandates.current||gov.mandates.terms.at(-1);if(!term)return;
    p.heading(`${term.mayorName} — ${partyName(term.partyId)}`);p.kv('Início',stamp(term.startedAt));p.kv('Fim',term.endedAt==null?'Em andamento':stamp(term.endedAt));
    const mode=ui.mandateView||'promise';p.links([['promise','META E RESULTADO'],['indicators','INDICADORES'],['measurements','MEDIÇÕES'],['events','ACONTECIMENTOS']].map(([id,label])=>({label,selected:id===mode,click:()=>ui.openPanel({termId:term.id,mandateView:id})})));
    if(mode==='promise'){for(const pr of term.promises)promise(p,pr,false,ui);p.kv('Efeito das mudanças na cidade',`${(term.outcomes?.points||0).toFixed(2)} pontos`);p.note('Indicadores e promessa são medidos a cada hora. O histórico mantém a última medição de cada dia e os eventos de cumprimento, superação e recuo.');}
    if(mode==='indicators')p.table([{label:'Indicador',weight:2},{label:'Na posse'},{label:'Último / fim'},{label:'Variação'}],Object.entries(PROMISE_METRICS).map(([key,spec])=>({cells:[spec.label,format(key,term.baseline[key]),format(key,term.latest[key]),`${term.latest[key]-term.baseline[key]>0?'+':''}${format(key,term.latest[key]-term.baseline[key])}`]})));
    if(mode==='measurements')for(const row of paginate(ui,p,[...term.checkpoints].reverse(),'milestonePage')){p.heading(stamp(row.minute));for(const pr of term.promises)p.kv(PROMISE_METRICS[pr.metric].label,format(pr.metric,row[pr.metric]));if(row.promisePoints!=null)p.kv('Promessa / evolução da cidade',`${row.promisePoints.toFixed(1)} / ${row.outcomePoints.toFixed(1)} pontos`);}
    if(mode==='events'){for(const event of paginate(ui,p,[...(city.history.byReference.get(`termId:${term.id}`)||[])].reverse(),'termEventsPage'))p.record(stamp(event.minute),event.message,()=>ui.openEvent(event.id));p.button('ABRIR HISTÓRICO DESTA GESTÃO',()=>ui.openHistory(`termId:${term.id}`));}
  }
  if(tab==='scandals'){
    p.note('Suspeitas podem ficar sem prova ou ser arquivadas por proteção política. Cassação por corrupção exige provas, gravidade e repercussão em pelo menos 65% do eleitorado, além de dois terços dos votos ponderados. Aprovação abaixo de 20% por três dias permite impeachment por perda de confiança. Cassados ficam impedidos nas duas eleições municipais seguintes. Mentiras eleitorais não constituem prova de corrupção.');
    p.button('ABRIR CENTRAL DE CORRUPÇÃO',()=>ui.go('corruption'));
    for(const s of paginate(ui,p,[...gov.scandals].reverse(),'scandalPage'))p.record(`#${s.id} ${city.accountName(`citizen:${s.accusedId}`)}`,s.outcome||(s.proven?'Provas confirmadas':'Investigação em andamento'),()=>ui.openCorruption(s.id),false,{value:money(s.amount)});
    if(!gov.scandals.length)p.note('Nenhuma investigação pública até o momento.');
  }
  if(tab==='results'){
    if(active)p.button('ABRIR VOTAÇÃO EM TEMPO REAL',()=>ui.host?.openElection(active.id,'count'));
    for(const e of [...gov.elections].reverse())p.button(`ELEIÇÃO ${e.id} · ${e.round||1}º turno: ${e.status==='runoff-required'?'Segundo turno confirmado':e.winnerName||'Adiada'}`,()=>ui.host?.openElection(e.id,'results'));const election=gov.elections.find(e=>e.id===ui.electionId)||gov.lastResult;if(!election){p.note('Nenhuma eleição concluída.');return;}
    p.button('ABRIR RESULTADO, ELEITOS E VOTOS',()=>ui.host?.openElection(election.id,'results'));p.heading(`RESULTADO ${election.id}`);p.table([{label:'Candidato',weight:2},{label:'Partido'},{label:'Votos'}],election.ranking.map(c=>({cells:[c.name,partyName(c.partyId),c.votes],click:()=>ui.openCitizen(c.citizenId)})));p.heading('CÂMARA');p.table([{label:'Partido'},{label:'Votos'},{label:'Cadeiras'}],(election.councilResult||[]).map(r=>({cells:[partyName(r.partyId),r.votes,r.seats]})));
    p.heading('VOTOS E MOTIVOS');for(const v of paginate(ui,p,election.ballots.filter(v=>ui.matches(v.name)),'ballotPage',12)){p.card(v.name,`${city.accountName(`citizen:${v.candidateId}`)} / ${v.reason}`,()=>ui.openCitizen(v.citizenId));if(election.round!==2)p.kv('Vereador',city.accountName(`citizen:${v.councilCandidateId}`));}
  }
}
export function renderCitizenPolitics(ui,p,c) {
  const seat=ui.city.politics.council.members.find(m=>m.citizenId===c.id);if(seat){const office=ui.city.units.get(seat.officeUnitId);p.kv('Gabinete na Câmara',office?`${seat.officeUnitId} · andar ${office.z+1}`:'Aguardando construção / ampliação');if(office)p.button('ABRIR GABINETE',()=>ui.select(ui.city.building(office.buildingId).entity,office.id));}
  const gov=ui.city.politics,political=c.political;if(!political){p.note('Sem participação política registrada.');return;}const party=gov.party(political.partyId);
  ui.section(p,'electoralPriorities','Como esta pessoa decide seu voto',()=>{
    const preferences=electoralPriorities(c);p.kv('Afinidade ideológica',preferences.ideology>22?'Peso alto':'Peso moderado');p.kv('Condições pessoais e serviços',preferences.material>1?'Peso alto':'Peso moderado');p.kv('Abertura à renovação',preferences.renewal>.8?'Alta':'Moderada');p.note('Histórico, popularidade e aprovação têm efeito conjunto limitado. Experiências pessoais, propostas, afinidades e informações conhecidas podem mudar a escolha. Apoio antigo não se transfere integralmente à eleição seguinte.');
    if(gov.active){const choices=gov.intentions(c);p.table([{label:'Candidatura',weight:2},{label:'Avaliação'},{label:'Principal motivo',weight:2}],choices.map(choice=>({cells:[ui.city.accountName(`citizen:${choice.candidateId}`),choice.score.toFixed(1),choice.reason],click:()=>ui.openCitizen(choice.candidateId)})));p.note('Avaliação relativa desta pessoa; não é uma porcentagem de votos.');}
  });
  ui.section(p,'candidateKnowledge','Candidaturas conhecidas e origem dos contatos',()=>{
    const rows=Object.values(political.candidateContacts||{}).filter(r=>!gov.active||r.electionId===gov.active.id||r.electionId===gov.active.firstRoundId).sort((a,b)=>b.minute-a.minute);
    p.table([{label:'Candidatura',weight:2},{label:'Partido'},{label:'Contatos'},{label:'Como conheceu',weight:2}],rows.map(r=>({cells:[ui.city.accountName(`citizen:${r.candidateId}`),gov.party(r.partyId)?.short||'Partido encerrado',r.count,r.source],click:()=>ui.openCitizen(r.candidateId)})));
  });
  if(party){flag(p,party);p.heading(`${party.number??'—'} · ${party.short} — ${party.name}`);}else p.heading('Eleitor independente / sem partido');p.kv('Simpatia atual',gov.party(political.sympathyPartyId)?.short||'Sem preferência consolidada');p.kv('Interesse em participar',`${Math.round((political.engagement||0)*100)}%`);p.kv('Autonomia de opinião',`${Math.round((political.independence||0)*100)}%`);p.table([{label:'Partido'},{label:'Convencimento'},{label:'Contatos'}],Object.entries(political.support||{}).sort((a,b)=>b[1].score-a[1].score).map(([id,s])=>({cells:[gov.party(Number(id))?.short||id,s.score.toFixed(1),s.contacts]})));p.kv('Função',c.id===ui.city.economy.mayorId?(gov.isProvisionalMayor(c)?'Prefeito provisório':'Prefeito'):c.role==='vice-mayor'?'Vice-prefeito':c.id===gov.council.leaderId?'Presidente da Câmara':c.role==='councilor'?'Vereador':'Eleitor');p.kv('Filiação',party?'Filiado desde '+stamp(political.membershipSince??ui.city.minute):'Sem partido');p.kv('Lealdade partidária',party?`${Math.round(political.loyalty*100)}%`:'Não se aplica');const orientation=describePoliticalOrientation(c);p.kv('Orientação política',orientation.label);p.kv('Modelo econômico',orientation.economic);p.kv('Liberdades civis',orientation.civil);p.kv('Pauta ambiental',orientation.environment);if(political.blockedUntilTerm>gov.termNumber)p.note(`Impedido de concorrer antes da eleição para o mandato ${political.blockedUntilTerm}.`);
  p.meter('Popularidade pessoal',political.popularity??50);const report=political.popularityReport;if(report)fold(ui,p,'personalPopularity','Como foi calculada a popularidade',()=>{p.note(`Índice de imagem pública atualizado em ${stamp(report.minute)} a partir de ${report.sampleSize} opiniões dentre ${report.electorate} adultos. Não é intenção de voto nem pesquisa eleitoral; o painel de opiniões é limitado a 64 pessoas para reduzir o custo.`);for(const row of report.components)p.kv(row.label,`${row.points>=0?'+':''}${row.points.toFixed(2)} pontos`);});
  p.heading('MEMÓRIA POLÍTICA');for(const memory of paginate(ui,p,[...political.memories].reverse(),'politicalMemoryPage')){p.heading(stamp(memory.minute));p.note(memory.description);for(const pr of memory.promises||[])p.note(`${pr.title}: início ${format(pr.metric,pr.baseline)}, meta ${format(pr.metric,pr.target)}${pr.current!=null?`, fim ${format(pr.metric,pr.current)} — ${pr.fulfilled?'atingida':'não atingida'}`:''}`);if(memory.eventId)p.button('VER ORIGEM',()=>ui.openEvent(memory.eventId));}
}
