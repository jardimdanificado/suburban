import {formatMoney as money} from './city_ui_format.js';
const stamp=n=>n==null?'—':`D${Math.floor(n/1440)+1} ${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const statuses={funding:'Buscando financiamento',collecting:'Coleta presencial',published:'Publicada',insufficient:'Amostra insuficiente'};
const openStudy=(ui,id)=>ui.openPanel({tab:'government',views:{government:'elections'},politicsTab:'institutes',studyId:id});
export function renderResearchProgress(ui,p,e){
  const research=ui.city.politics.getResearch(),studies=research.studies.filter(s=>s.electionId===e.id&&s.status!=='published');
  if(e.requiredPolls?.length){p.heading('PESQUISAS OBRIGATÓRIAS');for(const row of e.requiredPolls)p.record(row.label,`${row.organizerId?ui.city.accountName(`citizen:${row.organizerId}`):'Aguardando dirigente'} · ${statuses[row.status]||'Solicitada'}${row.reason?' · '+row.reason:''}`,()=>row.studyId?openStudy(ui,row.studyId):null);}
  p.windowLink('INSTITUTOS E COLETAS PRESENCIAIS',()=>ui.openPanel({tab:'government',views:{government:'elections'},politicsTab:'institutes',studyId:null}));
  if(!research.institutes().length)p.note('Aguardando um instituto construído e em funcionamento. A demanda pode gerar empresas privadas; a Câmara pode aprovar uma instalação pública.');
  for(const s of studies.slice(-3))p.record(s.instituteName,`${statuses[s.status]} · ${s.responses.length}/${s.target} entrevistas · mínimo ${s.minimum}`,()=>openStudy(ui,s.id));
}
export function renderPollMethod(ui,p,poll){
  p.note(poll.method||'Pesquisa antiga: amostra aleatória sem reposição anterior à criação dos institutos.');
  if(poll.commission){p.kv('Pesquisa obrigatória',poll.commission.label);p.kv('Organizador responsável',ui.city.accountName(`citizen:${poll.commission.organizerId}`));}
  if(poll.instituteName)p.kv('Instituto responsável',poll.instituteName);
  if(poll.minRate!=null)p.kv('Limites na abertura da coleta',`${poll.minRate}%–${poll.maxRate}% do eleitorado adulto`);
  if(poll.studyId)p.windowLink('FINANCIAMENTO, AGENTES E LOCAIS',()=>openStudy(ui,poll.studyId));
  p.note('A margem é aproximada; local e horário de abordagem podem causar viés. Cada eleitor aparece no máximo uma vez na mesma pesquisa. A pesquisa não antecipa os votos na urna.');
  if(poll.manipulated){
    p.note(poll.correctedAt?`Manipulação comprovada; relatório corrigido em ${stamp(poll.correctedAt)}.`:'Visão do observador: o relatório foi adulterado. Isso não significa que a população ou a auditoria já saiba.');
    p.windowLink('ESQUEMA E CAMINHO DO DINHEIRO',()=>ui.openCorruption(poll.corruptionCaseId));
    ui.section(p,`pollAudit:${poll.studyId}`,'Conferir respostas originais e relatório divulgado',()=>{
      p.table([{label:'Candidato',weight:2},{label:'Entrevistas'},{label:'Divulgação inicial'}],poll.rawResults.map(r=>({cells:[r.name,r.intentions,poll.originalPublishedResults.find(a=>a.candidateId===r.candidateId)?.intentions??r.intentions]})));
      p.kv('Indecisos: entrevistas / divulgação',`${poll.rawUndecided} / ${poll.originalPublishedUndecided}`);
    });
  }
}
export function renderResearchDirectory(ui,p){
  const city=ui.city,gov=city.politics,research=gov.getResearch(),s=research.studies.find(r=>r.id===ui.studyId),min=gov.policy.pollMinRate??5,max=gov.policy.pollMaxRate??20;
  p.heading(s?`COLETA #${s.id} · ${s.instituteName}`:'INSTITUTOS DE PESQUISA');
  if(!s){
    const institutes=research.institutes(),all=[...research.studies],collecting=all.filter(r=>r.status==='collecting').length,published=all.filter(r=>r.status==='published').length;
    p.metrics([['INSTITUTOS ATIVOS',institutes.length],['COLETAS EM CAMPO',collecting],['PESQUISAS PUBLICADAS',published]]);
    p.kv('Amostra mínima / máxima em vigor',`${min}% / ${max}% do eleitorado adulto`);
    p.note('A Câmara pode fixar o mínimo entre 5% e 10% e o máximo entre 15% e 20%. Cada coleta preserva os limites em vigor quando foi registrada.');
    p.windowLink('PROPOR MUDANÇA DOS LIMITES',()=>ui.openPanel({politicsTab:'council',councilView:'propose',billId:null}));
    p.heading('INSTITUTOS EM OPERAÇÃO');
    for(const b of institutes)p.record(b.entity.properties.name,`${b.workers.length} funcionários · caixa ${money(b.balance)}`,()=>ui.openBuilding(b.id));
    if(!research.institutes().length)p.note('Nenhum instituto em operação. Obras usam a cadeia normal de construção.');
    const rows=[...research.studies].reverse().filter(r=>ui.matches(`${r.id} ${r.instituteName} ${statuses[r.status]}`)),pages=Math.max(1,Math.ceil(rows.length/10)),page=Math.min(ui.researchPage||0,pages-1);
    p.heading('HISTÓRICO DE PESQUISAS');if(pages>1)p.buttons([{label:'ANTERIORES',click:()=>{ui.researchPage=Math.max(0,page-1);}},{label:'PRÓXIMAS',click:()=>{ui.researchPage=Math.min(pages-1,page+1);}}]);
    for(const row of rows.slice(page*10,page*10+10))p.record(`#${row.id} · ${row.instituteName}`,`${statuses[row.status]} · ${row.responses.length}/${row.target} entrevistas · ${money(row.funded)} recebidos`,()=>openStudy(ui,row.id),false,{value:row.status==='published'?'PUBLICADA':row.status==='collecting'?'EM CAMPO':row.status==='insufficient'?'INSUFICIENTE':'FINANCIAMENTO'});return;
  }
  if(s.commission){p.kv('Pesquisa obrigatória da',s.commission.label);p.kv('Organizador',city.accountName(`citizen:${s.commission.organizerId}`));}
  p.block('RESUMO DA COLETA',statuses[s.status],q=>{
    q.metrics([['ENTREVISTAS',`${s.responses.length}/${s.target}`],['INTERVALO LEGAL',`${s.minimum}–${s.maximum}`],['RECEBIDO',money(s.funded)],['SALÁRIOS DE CAMPO',money(s.wages)]]);
    q.kv('Amostra / eleitorado',`${(s.responses.length/Math.max(1,s.population)*100).toFixed(1)}% / ${s.population}`);q.kv('Limites registrados',`${s.minRate}%–${s.maxRate}%`);q.kv('Orçamento operacional',money(s.budget));q.kv('Abertura / prazo',`${stamp(s.requestedAt)} / ${stamp(s.deadline)}`);q.note(s.reason);
    q.note(s.commission?'Pesquisa obrigatória contratada pelo poder público; todas as entrevistas e os custos continuam sendo reais.':'Financiamento privado é buscado primeiro. Sem nenhum investimento, a prefeitura pode contratar por 1,5× o orçamento; falta de caixa pode interromper a coleta. Uma amostra abaixo do mínimo não é publicada.');
  });
  p.heading('FINANCIAMENTO');for(const source of s.funders)p.record(source.name,`${source.kind} · ${stamp(source.minute)}`,()=>source.eventId?ui.openEvent(source.eventId):ui.openHistory(null,{logAccountId:source.accountId}),false,{value:money(source.amount)});
  if(!s.funders.length)p.note('Nenhum pagamento recebido.');
  p.heading('LOCAIS E DISTRIBUIÇÃO PELO FLUXO');p.table([{label:'Local',weight:2},{label:'Fluxo %'},{label:'Cota'},{label:'Feitas'}],s.sites.map(site=>({cells:[site.label,`${(site.share*100).toFixed(1)}%`,site.quota,site.interviews],click:()=>ui.camera(site.x,site.y)})));
  p.heading('AGENTES E TURNOS');for(const row of s.sessions.slice(-16).reverse())p.record(row.agentName,`${stamp(row.startedAt)}–${stamp(row.until)} · ${s.sites[row.siteIndex]?.label} · ${row.interviews} entrevistas · ${row.status==='active'?'em campo':row.reason}`,()=>ui.openCitizen(row.agentId));
  if(!s.sessions.length)p.note('Nenhum agente despachado. É necessário ter equipe, recursos e caminho até um ponto de coleta.');
  if(s.pollId)p.windowLink('RELATÓRIO PUBLICADO',()=>ui.openPanel({politicsTab:'polls',electionId:s.electionId,pollId:s.pollId}));
  p.windowLink('INSTITUTO RESPONSÁVEL',()=>ui.openBuilding(s.instituteId));p.windowLink('HISTÓRICO DESTA COLETA',()=>ui.openHistory(`studyId:${s.id}`));
}
