const stamp=n=>`D${Math.floor(n/1440)+1} ${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const eventLabels={'government-agenda-action':'Execução do plano de governo','voting-opened':'Abertura da votação presencial','voting-closed':'Fechamento da fila eleitoral','in-person-vote':'Voto presencial','vote':'Voto presencial','election-postponed':'Eleição adiada','promise-fulfilled':'Meta alcançada','promise-recovered':'Meta recuperada','promise-surpassed':'Meta superada','promise-setback':'Recuo na meta','term-assessed':'Balanço de mandato','campaign-program':'Apresentação de proposta','campaign-accountability':'Cobrança de governo anterior','campaign-defamation':'Acusação falsa de campanha','election-poll':'Pesquisa eleitoral','election-opened':'Abertura de eleição','election-completed':'Resultado eleitoral','party-foundation-proposed':'Pedido de fundação de partido','party-foundation-verdict':'Veredito popular','party-membership-outreach':'Abordagem de filiação','party-founded':'Fundação de partido','party-liquidated':'Liquidação de partido','bill-proposed':'Proposta legislativa','bill-voted':'Votação legislativa','mayor-appointed':'Posse na prefeitura','clothes-laundered':'Lavagem de roupas','thrift-garment-cleaned':'Peça limpa para revenda','clothing-gift':'Presente ou doação de roupa','ride-share':'Carona de bicicleta','used-clothing-sale':'Venda de roupa usada'};
export const eventTypeLabel=event=>eventLabels[event.data?.action||event.kind]||event.data?.action||event.kind;
const references={missionId:'Contrato de campanha',studyId:'Coleta de pesquisa',partyProposalId:'Fundação partidária',publicationId:'Publicação',shipmentId:'Entrega',projectId:'Obra',jobId:'Serviço',loanId:'Empréstimo',electionId:'Eleição',plantId:'Árvore',socialFactId:'Fato social',partyId:'Partido',billId:'Projeto de lei',termId:'Gestão',corruptionCaseId:'Investigação'};
export function renderEventTimeline(ui,p,event){
  const history=ui.city.history,refs=history.references(event),specific=refs.find(ref=>!ref.startsWith('partyId:'))||refs[0];
  const reference=refs.includes(ui.eventReference)?ui.eventReference:specific;
  p.note('Ordem dos registros preservados. Eventos da mesma operação dão contexto; só os vínculos explícitos são apresentados como causas. O estado atual pode ser diferente do estado na data do evento.');
  p.buttons(refs.map(ref=>({label:`${references[ref.split(':')[0]]||ref} #${ref.split(':')[1]}`,selected:ref===reference,click:()=>{ui.eventReference=ref;ui.eventTimelinePage=null;ui.resetScroll();}})));
  const direct=new Set([...(event.data?.relatedEventIds||[]),event.parentEventId,event.evidenceEventId].filter(id=>id!=null));
  const previous=new Set(event.relatedEventIds||[]);
  const source=reference?history.byReference.get(reference)||[]:[...previous,event.id].map(id=>history.get(id)).filter(Boolean);
  // Keep a bounded neighborhood around this event even for very long journals.
  const signature=`${history.total}:${history.dropped}:${reference}:${event.id}`;
  if(ui.eventTimelineCache?.signature!==signature){const index=source.findIndex(row=>row.id===event.id),start=Math.max(0,index-120);ui.eventTimelineCache={signature,rows:source.slice(start,start+240),initial:Math.max(0,Math.floor(Math.max(0,index-start)/10))};}
  const {rows,initial}=ui.eventTimelineCache,pages=Math.max(1,Math.ceil(rows.length/10)),page=Math.max(0,Math.min(pages-1,ui.eventTimelinePage??initial));
  p.kv('Registros nesta operação',source.length);p.note(`Página ${page+1} de ${pages}${source.length>rows.length?' · trecho próximo ao evento selecionado':''}`);
  p.buttons([{label:'ANTERIORES',click:()=>{ui.eventTimelinePage=Math.max(0,page-1);}},{label:'PRÓXIMOS',click:()=>{ui.eventTimelinePage=Math.min(pages-1,page+1);}}]);
  for(const row of rows.slice(page*10,page*10+10)){
    const relation=row.id===event.id?'EVENTO SELECIONADO':direct.has(row.id)?'CAUSA / VÍNCULO EXPLÍCITO':previous.has(row.id)?'REGISTRO ANTERIOR VINCULADO':'CONTEXTO DA OPERAÇÃO';
    p.record(`#${row.id} · ${stamp(row.minute)}`,relation,()=>ui.openEvent(row.id),row.id===event.id);p.note(row.message);
    if(row.amount!=null)p.kv('Valor registrado',ui.city.currency?`R$ ${(row.amount/100).toFixed(2)}`:row.amount);
  }
  if(!rows.length)p.note('Não há outros registros preservados para esta operação.');
  if(reference)p.button('ABRIR ESTA OPERAÇÃO EM HISTÓRICO SEPARADO',()=>ui.openHistory(reference));
}
export function renderEventSummary(ui,p,event){
  const city=ui.city,history=city.history;p.heading('O QUE ACONTECEU');p.note(event.message);p.kv('Quando',stamp(event.minute));
  p.kv('Tipo do registro',eventTypeLabel(event));
  if(event.reason)p.kv('Motivo registrado',event.reason);
  if(event.amount!=null)p.kv('Valor',`R$ ${(event.amount/100).toFixed(2)}`);
  for(const [key,label] of [['from','Origem do dinheiro'],['to','Destino do dinheiro']])if(event[key]!=null)p.kv(label,city.accountName(event[key]));
  if(event.truth!==undefined||event.objectiveTruth!==undefined){const truth=event.objectiveTruth??event.truth;p.kv('Veracidade registrada',truth===true?'Verdadeiro':truth===false?'Inventado':'Não verificado');}
  p.heading('QUEM PARTICIPOU');
  for(const subject of event.subjects||[]){const account=String(subject.accountId);if(account.startsWith('citizen:'))p.button(subject.name,()=>ui.openCitizen(Number(account.slice(8))));else if(account.startsWith('business:'))p.button(subject.name,()=>ui.openBuilding(Number(account.slice(9))));else p.note(subject.name);}
  if(!event.subjects?.length)p.note('Nenhum participante identificado no registro.');
  const explicit=[...new Set([...(event.data?.relatedEventIds||[]),event.parentEventId,event.evidenceEventId].filter(id=>id!=null&&id!==event.id))];
  p.heading('POR QUE / DE ONDE VEIO');
  for(const id of explicit){const cause=history.get(id);p.record(`#${id} · ${cause?stamp(cause.minute):'Fora da retenção'}`,cause?.message||'Vínculo registrado; detalhes não estão mais no histórico.',()=>ui.openEvent(id));}
  if(!explicit.length)p.note('O registro não informa uma causa explícita. Os detalhes e a linha do tempo podem mostrar o contexto e os parâmetros usados.');
  p.links([{label:'VER DADOS E SITUAÇÃO ATUAL',click:()=>ui.openPanel({eventTab:'details'})},{label:'SEGUIR LINHA DO TEMPO',click:()=>ui.openPanel({eventTab:'timeline'})}]);
}
