import {contextActions} from './city_context_actions.js';
import {renderResearchProgress,renderPollMethod} from './city_research_ui.js';
const stamp=n=>n==null?'—':`Dia ${Math.floor(n/1440)+1}, ${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const phases={scheduled:'Aguardando início da campanha', 'runoff-required':'Segundo turno confirmado',campaign:'Campanha e pesquisas',voting:'Votação presencial',counting:'Atendimento da fila final',completed:'Resultado definitivo',cancelled:'Eleição adiada'};
function pages(ui,p,rows,key,size=10){const count=Math.max(1,Math.ceil(rows.length/size)),page=Math.max(0,Math.min(count-1,ui[key]||0));if(count>1){p.note(`${rows.length} registros · página ${page+1}/${count}`);p.buttons([{label:'ANTERIOR',click:()=>{ui[key]=Math.max(0,page-1);}},{label:'PRÓXIMA',click:()=>{ui[key]=Math.min(count-1,page+1);}}]);}return rows.slice(page*size,page*size+size);}
export function electionFor(ui){const p=ui.city.politics;return [p.active,p.lastResult,...p.elections].find(e=>e?.id===ui.electionId)||ui.electionSnapshot;}
function mayorRanking(e){return e.ranking?.length?e.ranking:e.candidates.map(n=>({...n,votes:e.mayorCounts?.[n.citizenId]||0})).sort((a,b)=>b.votes-a.votes||a.citizenId-b.citizenId);}
function candidates(ui,p,e){const gov=ui.city.politics,total=e.validMayoralVotes??e.ballots.filter(b=>b.candidateId!=null).length;
  p.heading('PREFEITURA');p.table([{label:'Candidato',weight:2},{label:'Vice e coligação',weight:2},{label:'Partido'},{label:'Votos'},{label:'% recebidos'}],mayorRanking(e).map(n=>{const coalition=(n.coalitionPartyIds||[]).map(id=>gov.party(id)?.short).filter(Boolean);return{cells:[n.eligible===false?`${n.name} (indisponível)`:n.name,`${n.viceName||'Sem vice'}${n.vicePartyId&&n.vicePartyId!==n.partyId?` · ${gov.party(n.vicePartyId)?.short||'outra legenda'}`:''}${coalition.length>1?` · Coligação: ${coalition.join(' + ')}`:''}`,n.partyNumber!=null?`${n.partyNumber} · ${gov.party(n.partyId)?.short||'Partido encerrado'}`:gov.party(n.partyId)?.ballotLabel||'Partido encerrado',n.votes,total?`${(n.votes/total*100).toFixed(1)}%`:'0,0%'],click:()=>ui.openCitizen(n.citizenId),selected:n.citizenId===e.winnerId};}));
  for(const coalition of e.coalitions||[])p.note(`Coligação: ${coalition.partyIds.map(id=>gov.party(id)?.short||id).join(' + ')} · prefeito ${ui.city.society.citizen(coalition.mayorId)?.entity.properties.name||'—'} · vice ${ui.city.society.citizen(coalition.viceId)?.entity.properties.name||'—'}.`);
  const eligibleCount=e.status==='completed'?mayorRanking(e).filter(n=>n.eligible!==false).length:gov.voting.available(e).length;p.kv('Chapas aptas na disputa',eligibleCount);if(eligibleCount===1)p.note('Disputa com chapa única: a porcentagem de votos válidos não mede o apoio de quem se absteve ou votou em branco.');
  if(e.nominationReport?.length)ui.section(p,`nominations:${e.id}`,'Convenções, coligações e ausência de candidaturas',()=>{p.kv('Partidos registrados / limite',`${e.nominationReport.length} / ${e.partyLimitAtOpening??'—'}`);p.kv('Candidaturas a prefeito / limite vigente',`${e.candidates.length} / ${e.mayorCandidateLimitAtOpening??'—'}`);p.note('As candidaturas próprias são reservadas aos partidos com mais vereadores. Os demais negociam coligação com vice-prefeito ou apoio a uma chapa.');p.table([{label:'Partido'},{label:'Filiados'},{label:'Vereadores'},{label:'Decisão da convenção',weight:3}],e.nominationReport.map(row=>({cells:[row.partyName,row.members,row.representatives??0,row.status],click:()=>ui.openParty(row.partyId)})));});
  if(e.status==='completed'&&e.electorateSize){const winner=mayorRanking(e).find(n=>n.citizenId===e.winnerId);if(winner)p.kv('Votos do vencedor no eleitorado total',`${(winner.votes/e.electorateSize*100).toFixed(1)}%`);}
  const blanks=e.ballots.filter(b=>b.candidateId==null).length;if(blanks)p.kv('Votos em branco para prefeito',blanks);if(e.invalidMayoralVotes)p.kv('Votos para candidaturas indisponíveis ao encerrar',e.invalidMayoralVotes);
}
function polls(ui,p,e){
  renderResearchProgress(ui,p,e);p.note('Pesquisas presenciais por instituto, dentro dos limites de amostragem votados pela Câmara. Intenções declaradas não são votos nas urnas.');
  const poll=e.polls.find(r=>r.id===ui.monitorPollId)||e.polls.at(-1);
  if(!poll){p.note('Aguardando a primeira pesquisa.');return;}
  contextActions(ui,p,{poll});
  p.button('PESQUISA MAIS RECENTE',()=>{ui.monitorPollId=null;},ui.monitorPollId==null);
  p.heading(`TODAS AS PESQUISAS · ${e.polls.length}`);
  p.table([{label:'Data'},{label:'Instituto',weight:2},{label:'Amostra'},{label:'Indecisos'},{label:'Margem'}],e.polls.slice().reverse().map(r=>({cells:[stamp(r.minute),r.instituteName||'Instituto não identificado',r.sampleSize,r.undecided,`±${r.marginOfError.toFixed(1)} p.p.`],selected:r.id===poll.id,click:()=>{ui.monitorPollId=r.id;}})));
  if(poll.instituteName)p.kv('Instituto',poll.instituteName);p.kv('Última atualização',stamp(poll.minute));p.metrics([['ENTREVISTADOS',poll.sampleSize],['INDECISOS',poll.undecided],['MARGEM',`±${poll.marginOfError.toFixed(1)} p.p.`]]);
  p.table([{label:'Candidato',weight:2},{label:'Intenção'},{label:'Rejeição'}],poll.results.map(r=>({cells:[r.name,`${(r.intentions/Math.max(1,poll.sampleSize)*100).toFixed(1)}%`,`${(r.rejections/Math.max(1,poll.sampleSize)*100).toFixed(1)}%`],click:()=>ui.openCitizen(r.candidateId)})));
  p.kv('Aprovação entre entrevistados',`${poll.approval.toFixed(1)}%`);ui.section(p,`monitorMethod:${poll.id}`,'Método e financiamento',()=>renderPollMethod(ui,p,poll));
  ui.section(p,`electionPollResponses:${poll.id}`,'Respostas individuais e motivos',()=>{const rows=poll.responses||[];for(const row of pages(ui,p,rows,'monitorPollResponsePage',8))p.record(row.name,`${row.decided?ui.city.accountName(`citizen:${row.candidateId}`):'Indeciso'} · ${row.reason}`,()=>ui.openCitizen(row.citizenId));});
}
function campaign(ui,p,e){
  const city=ui.city,gov=city.politics,materials=gov.campaigns.getMaterials(),agents=city.citizens.filter(c=>c.campaign?.electionId===e.id).length;
  p.metrics([['CANDIDATURAS',e.candidates.length],['AGENTES NAS RUAS',agents],['ELEITORES CONTATADOS',e.contactedIds?.size||0],['PROPAGANDAS ATIVAS',materials.decorations.filter(d=>d.until>city.minute&&d.electionId===e.id).length]]);
  p.kv('Período',`${stamp(e.startedAt)} → ${stamp(e.voteAt)}`);
  p.table([{label:'Candidatura',weight:2},{label:'Partido'},{label:'Slogan da campanha',weight:2.3},{label:'Slogan do partido',weight:2.3},{label:'Coligação / apoios',weight:2},{label:'Promessas'}],e.candidates.map(n=>({cells:[n.name,gov.party(n.partyId)?.short||'—',n.slogan||'—',n.partySlogan||gov.party(n.partyId)?.slogan||'—',(n.endorsementPartyIds||[]).map(id=>gov.party(id)?.short||id).join(' + '),n.promises?.length||0],click:()=>ui.openCitizen(n.citizenId)})));
  if(e.councilCandidates?.length){p.heading('CANDIDATURAS À CÂMARA');p.table([{label:'Candidato',weight:2},{label:'Partido'},{label:'Slogan',weight:2.5}],e.councilCandidates.map(n=>({cells:[n.name,gov.party(n.partyId)?.short||'—',n.slogan||gov.party(n.partyId)?.slogan||'—'],click:()=>ui.openCitizen(n.citizenId)})));}
  p.heading('PROGRAMA DAS CANDIDATURAS');
  for(const n of e.candidates)p.block(n.name,`${gov.party(n.partyId)?.short||'—'} · ${n.slogan||'Sem slogan'}`,q=>{q.kv('Slogan partidário',n.partySlogan||gov.party(n.partyId)?.slogan||'—');if(n.viceName)q.kv('Vice-prefeito',`${n.viceName} · ${gov.party(n.vicePartyId)?.short||'—'}`);for(const promise of n.promises||[])q.record(promise.title,`${promise.higher?'Aumentar':'Reduzir'} até ${promise.target}`);const finance=n.campaignFinance;if(finance)q.kv('Financiamento recebido / gasto',`${finance.received||0} / ${finance.spent||0}`);});
  const events=[...(e.events||[])].reverse();p.heading('ATIVIDADE DE CAMPANHA');for(const event of pages(ui,p,events,'monitorCampaignPage',10))p.record(stamp(event.minute),event.message,()=>ui.openEvent(event.eventId));if(!events.length)p.note('Nenhuma atividade de campanha registrada.');
}
function coalitions(ui,p,e){
  const city=ui.city,gov=city.politics;p.heading('COLIGAÇÕES E APOIOS');
  if(e.coalitions?.length)p.table([{label:'Partidos',weight:2},{label:'Candidato a prefeito',weight:2},{label:'Vice-prefeito',weight:2},{label:'Data'}],e.coalitions.map(row=>({cells:[row.partyIds.map(id=>gov.party(id)?.short||id).join(' + '),city.society.citizen(row.mayorId)?.entity.properties.name||'—',city.society.citizen(row.viceId)?.entity.properties.name||'—',stamp(row.minute)]})));
  else p.note('Esta eleição não registrou coligação com vice compartilhado.');
  p.heading('DECISÃO DE CADA PARTIDO');
  p.table([{label:'Partido',weight:2},{label:'Filiados'},{label:'Vereadores'},{label:'Candidatura ou acordo',weight:3}],(e.nominationReport||[]).map(row=>{const n=e.candidates.find(candidate=>candidate.endorsementPartyIds?.includes(row.partyId)),party=gov.party(row.partyId);return{cells:[party?.name||row.partyName,row.members,row.representatives??0,`${row.status}${n?` · ${n.name}${n.viceName?` / vice ${n.viceName}`:''}`:''}`],click:()=>ui.openParty(row.partyId)};}));
}
function ballots(ui,p,e){
  p.note('Visão do observador: os votos e motivos abaixo são os efetivamente registrados na urna, com horário e escolhas individuais.');
  const rows=e.ballots.filter(b=>ui.matches(`${b.name} ${b.candidateName||''} ${b.councilCandidateName||''} ${b.reason}`));
  for(const b of pages(ui,p,[...rows].reverse(),'monitorBallotPage',8)){
    p.block(b.name,`${stamp(b.castAt)} · voto presencial`,q=>{
      q.kv('Prefeito',b.candidateName||e.candidates.find(n=>n.citizenId===b.candidateId)?.name||'Branco');if(e.round!==2)q.kv('Vereador',b.councilCandidateName||e.councilCandidates.find(n=>n.citizenId===b.councilCandidateId)?.name||'Branco');
      q.heading('MOTIVOS');q.note(`Prefeito: ${b.reason}`);if(b.councilReason)q.note(`Vereador: ${b.councilReason}`);q.button('FICHA DO ELEITOR',()=>ui.openCitizen(b.citizenId));
    });
  }
  if(!rows.length)p.note('Nenhum voto registrado neste filtro.');
}
const turnoutReason=reason=>(reason||'Motivo não registrado').replace(/Necessidade urgente: (energy|toilet|food|water|health|hygiene)/,(_,key)=>`Necessidade urgente: ${{energy:'cansaço',toilet:'banheiro',food:'fome',water:'sede',health:'saúde',hygiene:'higiene'}[key]}`);
function turnout(ui,p,e){
  const statuses={pending:'Ainda não saiu',travelling:'A caminho',waiting:'Na fila',casting:'Na urna',voted:'Já votou',unavailable:'Indisponível',abstained:'Abstenção'};
  const rows=(e.electorate||e.abstentions||[]).filter(r=>ui.matches(`${r.name} ${r.reason} ${statuses[r.status]}`));
  if(e.abstentions?.length){const reasons=new Map();for(const row of e.abstentions){const reason=turnoutReason(row.reason);reasons.set(reason,(reasons.get(reason)||0)+1);}p.heading('MOTIVOS DAS ABSTENÇÕES');p.note('Última condição registrada antes do fechamento; não mede quanto tempo durou nem todas as causas.');p.table([{label:'Motivo',weight:3},{label:'Eleitores'}],[...reasons].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([reason,count])=>({cells:[reason,count]})));}
  for(const row of pages(ui,p,rows,'monitorTurnoutPage',10))p.record(row.name,`${statuses[row.status]||row.status} · ${turnoutReason(row.reason)}`,()=>ui.openCitizen(row.citizenId));
}
function council(ui,p,e){
  const gov=ui.city.politics;if(e.round===2){p.note('Vereadores são escolhidos apenas no primeiro turno.');e=e.firstRoundElection||e;}
  if(e.electedCouncilors){
    p.heading(`VEREADORES ELEITOS · ${(e.electedCouncilors||[]).length} CADEIRAS`);
    p.table([{label:'Vereador',weight:2},{label:'Partido'},{label:'Votos pessoais'}],(e.electedCouncilors||[]).map(n=>({cells:[n.name,gov.party(n.partyId)?.short||n.partyId,n.votes],click:()=>ui.openCitizen(n.citizenId)})));
    p.heading('DISTRIBUIÇÃO POR PARTIDO');p.table([{label:'Partido',weight:2},{label:'Votos'},{label:'Cadeiras'}],(e.councilResult||[]).map(n=>({cells:[gov.party(n.partyId)?.short||n.partyId,n.votes,n.seats]})));
  }else{
    p.heading('VOTOS PARA A CÂMARA');const rows=e.councilCandidates.map(n=>({...n,votes:e.councilCounts?.[n.citizenId]||0})).sort((a,b)=>b.votes-a.votes||a.citizenId-b.citizenId);
    p.table([{label:'Candidato',weight:2},{label:'Partido'},{label:'Votos'}],pages(ui,p,rows,'monitorCouncilPage',10).map(n=>({cells:[n.name,gov.party(n.partyId)?.short||n.partyId,n.votes],click:()=>ui.openCitizen(n.citizenId)})));
    p.note(e.status==='runoff-required'?'Votação para a Câmara encerrada. A distribuição e a posse ocorrem ao concluir o segundo turno.':'As cadeiras são distribuídas proporcionalmente após o fechamento. Liderar em votos pessoais durante a votação ainda não garante uma cadeira.');
  }
}
export function renderElectionMonitor(ui,p){
  const city=ui.city,e=electionFor(ui);if(!e){p.note('Registro desta eleição indisponível.');return;}
  contextActions(ui,p,{election:e});
  const mode=ui.electionView||(['campaign','scheduled'].includes(e.status)?'campaign':'polls');p.heading(`ELEIÇÃO ${e.id} · ${e.round||1}º TURNO · ${phases[e.status]||e.status}`);
  const elections=[city.politics.active,city.politics.lastResult,...city.politics.elections].filter((item,index,all)=>item&&all.findIndex(row=>row?.id===item.id)===index).sort((a,b)=>b.id-a.id);
  if(elections.length>1)p.links(elections.map(item=>({label:`ELEIÇÃO ${item.id} · ${item.round||1}º TURNO`,selected:item.id===e.id,click:()=>ui.openPanel({electionId:item.id,electionView:item.status==='completed'?'results':'campaign'})})));
  if(e.firstRoundId)p.button('VER PRIMEIRO TURNO',()=>ui.openPanel({electionId:e.firstRoundId,electionView:'results'}));
  if(e.runoffId)p.button('VER SEGUNDO TURNO',()=>ui.openPanel({electionId:e.runoffId,electionView:'campaign'}));
  if(e.status==='runoff-required')p.note('Nenhuma chapa obteve mais de 50% dos votos válidos. As duas primeiras disputarão o segundo turno. A Câmara será empossada com o resultado final, usando somente os votos do primeiro turno.');
  if(e.status==='scheduled')p.note(`A campanha começa em ${stamp(e.startedAt)} e dura ${(e.voteAt-e.startedAt)/1440} dias, metade do período do primeiro turno.`);
  p.links([['campaign','CAMPANHAS'],['coalitions','COLIGAÇÕES'],['polls','TODAS AS PESQUISAS'],['count','APURAÇÃO'],['results','RESULTADO']].map(([id,label])=>({label,selected:mode===id,click:()=>ui.openPanel({electionView:id})})));
  if(mode==='campaign'){campaign(ui,p,e);return;}
  if(mode==='coalitions'){coalitions(ui,p,e);return;}
  if(mode==='polls'){p.kv('Dia da votação presencial',stamp(e.voteAt));polls(ui,p,e);return;}
  if(['campaign','scheduled'].includes(e.status)){p.note(`Votação presencial na prefeitura a partir de ${stamp(e.voteAt)}. A contagem começa com os votos efetivamente depositados.`);return;}
  p.metrics([['VOTOS REGISTRADOS',e.ballots.length],['ELEITORADO',e.electorateSize??e.ballots.length],['NÃO VOTARAM',Math.max(0,(e.electorateSize??e.ballots.length)-e.ballots.length)]]);
  p.kv('Local',e.pollingName||'Prefeitura');p.kv('Fechamento da fila',stamp(e.closesAt));
  if(['voting','counting'].includes(e.status)){const travelling=(e.electorate||[]).filter(r=>r.status==='travelling').length,waiting=(e.queue?.length||0)+(e.stations?.filter(s=>s.citizenId!=null).length||0);p.kv('A caminho / em atendimento',`${travelling} / ${waiting}`);p.note(e.status==='counting'?'Fila fechada: os eleitores que chegaram no horário ainda estão sendo atendidos.':'Contagem em tempo real. Cada voto aparece depois do atendimento presencial na urna.');}
  if(e.status==='cancelled'){p.note(`Eleição adiada: ${e.cancellationReason||'Sem resultado válido'}. O governo atual continua até nova votação.`);}
  if(e.tieBroken)p.note('Empate no segundo turno: desempate por capacidade administrativa e, persistindo, ordem de cadastro.');
  if(e.status==='completed'){p.heading(`PREFEITO ELEITO: ${e.winnerName||e.ranking.find(n=>n.citizenId===e.winnerId)?.name}`);p.kv('Vice-prefeito eleito',e.viceWinnerName||'Sem vice elegível');if(e.viceWinnerId){const vp=city.society.citizen(e.viceWinnerId),mp=city.society.citizen(e.winnerId);p.kv('Partidos da chapa',`${city.politics.party(mp?.political.partyId)?.short||'—'}${vp?.political.partyId!==mp?.political.partyId?` + ${city.politics.party(vp?.political.partyId)?.short||'independente'}`:''}`);}p.kv('Apuração concluída',stamp(e.completedAt));}
  const view=ui.electionDetailView||(mode==='results'?'elected':'count');p.links([['count','CONTAGEM'],['elected','VEREADORES'],['ballots','VOTOS INDIVIDUAIS'],['turnout','COMPARECIMENTO']].map(([id,label])=>({label,selected:view===id,click:()=>ui.openPanel({electionDetailView:id})})));
  if(view==='count')candidates(ui,p,e);if(view==='elected'){if(e.status==='completed')candidates(ui,p,e);council(ui,p,e);}if(view==='ballots')ballots(ui,p,e);if(view==='turnout')turnout(ui,p,e);
  if(e.pollingBuildingId)p.button('LOCALIZAR PREFEITURA',()=>{const hall=city.building(e.pollingBuildingId);if(hall)ui.camera(hall.door.x,hall.door.y);});
  p.button('ABRIR HISTÓRICO DESTA ELEIÇÃO',()=>ui.openHistory(`electionId:${e.id}`));
}
