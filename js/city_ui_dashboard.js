import {formatMoney as money} from './city_ui_format.js';
import {UI_COLORS as C} from './city_ui_widgets.js';
const stamp=n=>n==null?'Sem data':`Dia ${Math.floor(n/1440)+1} · ${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;

export function renderGovernmentDashboard(ui,p){
  const city=ui.city,gov=city.politics,needs=city.welfare.conditions(),mayor=city.society.citizen(city.economy.mayorId),term=gov.mandates.current;
  const data=ui.cachedList('government-dashboard',()=>{
    const works=city.development.projects.filter(o=>o.accountId==='treasury'&&!o.cancelled&&o.status!=='completed');
    const bills=gov.council.bills.filter(b=>!['executed','rejected','dismissed','veto-maintained'].includes(b.status));
    return [{works,bills,blocked:works.filter(o=>o.status==='blocked'),unlit:[...city.lighting.sites.values()].filter(l=>l.public&&l.built&&!l.fuel).length}];
  })[0];
  const policy=(politicsTab,extra={})=>ui.openPanel({views:{government:'elections'},politicsTab,billId:null,termId:null,...extra});
  p.heading('RESUMO MUNICIPAL');
  if(mayor)p.record(mayor.entity.properties.name,`${gov.isProvisionalMayor()?'Prefeito provisório':'Prefeito'} · ${gov.partyOfId(mayor.id)?.name||'Sem partido'}`,()=>ui.openCitizen(mayor.id));
  p.metrics([
    ['TESOURO',money(city.treasury),C.cyan,'saldo disponível',()=>ui.showView('finance')],
    ['APROVAÇÃO',`${gov.approval.toFixed(1)}%`,gov.approval<40?C.red:C.green,'ver motivos e mudanças',()=>policy('approval')],
    ['SEM MORADIA',needs.homeless,needs.homeless?C.red:C.green,'adultos sem casa',()=>ui.go('people',{filter:'homeless'})],
    ['OBRAS PÚBLICAS',data.works.length,C.cyan,'contratos em execução',()=>ui.showView('contracts')],
  ]);
  if(needs.crisis)p.status('ATENDIMENTO ESSENCIAL EM CRISE',`${needs.hungry} moradores com fome · ${needs.homeless} adultos sem moradia · reserva alimentar de ${needs.foodDays.toFixed(1)} dias.`,C.red,()=>ui.go('city',{view:'needs'}));
  if(gov.suspendedExecutive)p.status('PREFEITO AFASTADO',`Substituição temporária até ${stamp(gov.suspendedExecutive.until)}.`,C.gold,()=>policy('overview'));
  p.columns(q=>{
    q.heading('PROMESSA E RESULTADO');
    const promise=term?.promises[0];
    if(promise){
      q.status(promise.fulfilled?'META ATINGIDA':promise.progress>0?'PROMESSA EM AVANÇO':'PROMESSA PENDENTE',promise.title,promise.fulfilled?C.green:C.gold,()=>policy('promises'));
      q.meter('Avanço da meta',Math.max(0,Math.min(100,(promise.progress||0)*100)),promise.fulfilled?C.green:C.cyan);
      if(promise.execution?.blocked)q.note(promise.execution.blocked,C.red);
      q.button('META, EXECUÇÃO E HISTÓRICO',()=>policy('promises'));
    }else q.note('Aguardando definição do programa de governo.');
    q.heading('AGENDA POLÍTICA');q.kv('Próxima eleição',stamp(gov.nextElectionAt));q.kv('Câmara',`${gov.council.members.length}/${gov.council.seats} vereadores`);
    q.buttons([{label:'CÂMARA',click:()=>policy('council')},{label:'PESQUISAS',click:()=>policy('polls')},{label:'PARTIDOS',click:()=>policy('parties')}]);
  },q=>{
    q.heading('PENDÊNCIAS E SERVIÇOS');
    const alerts=[
      [`${data.blocked.length} obras bloqueadas`,'Examinar contratos, materiais e impedimentos.',data.blocked.length,()=>ui.showView('contracts')],
      [`${data.unlit} postes públicos sem óleo`,'Ver produção de óleo e abastecimento.',data.unlit,()=>ui.go('production',{view:'lighting'})],
      [`${data.bills.length} projetos em tramitação`,'Acompanhar votação, sanção e execução.',data.bills.length,()=>policy('council')],
    ];
    for(const [title,hint,count,click]of alerts)q.record(title,hint,click,false,{color:count?C.gold:C.green});
    q.kv('Reserva social de referência',money(needs.reserve));
    q.heading('TRANSPARÊNCIA');q.kv('Atos no jornal oficial',city.officialJournal?.records.length||0);q.kv('Aguardando impressão',city.officialJournal?.pending||0);
    q.button('JORNAL OFICIAL',()=>ui.openPanel({tab:'publications',selectedPublicationId:null,publicationTab:'official',publicationSourceEventId:null}));
    q.button('FISCALIZAÇÃO E CORRUPÇÃO',()=>policy('scandals'));
  });
}
