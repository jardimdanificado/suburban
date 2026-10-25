const stamp=n=>n==null?'—':`Dia ${Math.floor(n/1440)+1}, ${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const phases={scheduled:'Aguardando início da campanha', 'runoff-required':'Segundo turno confirmado',campaign:'Campanha e pesquisas',voting:'Votação presencial',counting:'Atendimento da fila final',completed:'Resultado definitivo',cancelled:'Eleição adiada'};
function pages(ui,p,rows,key,size=10){const count=Math.max(1,Math.ceil(rows.length/size)),page=Math.max(0,Math.min(count-1,ui[key]||0));if(count>1){p.note(`${rows.length} registros · página ${page+1}/${count}`);p.buttons([{label:'ANTERIOR',click:()=>{ui[key]=Math.max(0,page-1);}},{label:'PRÓXIMA',click:()=>{ui[key]=Math.min(count-1,page+1);}}]);}return rows.slice(page*size,page*size+size);}
export function electionFor(ui){const p=ui.city.politics;return [p.active,p.lastResult,...p.elections].find(e=>e?.id===ui.electionId)||ui.electionSnapshot;}
function mayorRanking(e){return e.ranking?.length?e.ranking:e.candidates.map(n=>({...n,votes:e.mayorCounts?.[n.citizenId]||0})).sort((a,b)=>b.votes-a.votes||a.citizenId-b.citizenId);}
function candidates(ui,p,e){const gov=ui.city.politics,total=e.validMayoralVotes??e.ballots.filter(b=>b.candidateId!=null).length;
  p.heading('PREFEITURA');p.table([{label:'Chapa',weight:2},{label:'Partido'},{label:'Votos'},{label:'% recebidos'}],mayorRanking(e).map(n=>({cells:[n.eligible===false?`${n.name} (indisponível)`:n.name,gov.party(n.partyId)?.short||'Partido encerrado',n.votes,total?`${(n.votes/total*100).toFixed(1)}%`:'0,0%'],click:()=>ui.openCitizen(n.citizenId),selected:n.citizenId===e.winnerId})));
  const blanks=e.ballots.filter(b=>b.candidateId==null).length;if(blanks)p.kv('Votos em branco para prefeito',blanks);if(e.invalidMayoralVotes)p.kv('Votos para candidaturas indisponíveis ao encerrar',e.invalidMayoralVotes);
}
function polls(ui,p,e){
  p.note('Pesquisas por amostragem: entrevistam aproximadamente 10% da população. Intenções não são votos depositados nas urnas.');
  const poll=e.polls.find(r=>r.id===ui.monitorPollId)||e.polls.at(-1);
  if(!poll){p.note('Aguardando a primeira pesquisa.');return;}
  p.button('ACOMPANHAR A MAIS RECENTE',()=>{ui.monitorPollId=null;},ui.monitorPollId==null);p.links(e.polls.map(r=>({label:`${stamp(r.minute)}`,click:()=>ui.openPanel({tab:'government',views:{government:'elections'},politicsTab:'polls',electionId:e.id,pollId:r.id})})));
  p.kv('Última atualização',stamp(poll.minute));p.metrics([['ENTREVISTADOS',poll.sampleSize],['INDECISOS',poll.undecided],['MARGEM',`±${poll.marginOfError.toFixed(1)} p.p.`]]);
  p.table([{label:'Candidato',weight:2},{label:'Intenção'},{label:'Rejeição'}],poll.results.map(r=>({cells:[r.name,`${(r.intentions/Math.max(1,poll.sampleSize)*100).toFixed(1)}%`,`${(r.rejections/Math.max(1,poll.sampleSize)*100).toFixed(1)}%`],click:()=>ui.openCitizen(r.candidateId)})));
  p.kv('Aprovação entre entrevistados',`${poll.approval.toFixed(1)}%`);
  p.button('RESPOSTAS E MOTIVOS',()=>ui.openPanel({tab:'government',views:{government:'elections'},politicsTab:'polls',electionId:e.id,pollId:poll.id}));
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
function turnout(ui,p,e){
  const statuses={pending:'Ainda não saiu',travelling:'A caminho',waiting:'Na fila',casting:'Na urna',voted:'Já votou',unavailable:'Indisponível',abstained:'Abstenção'};
  const rows=(e.electorate||e.abstentions||[]).filter(r=>ui.matches(`${r.name} ${r.reason} ${statuses[r.status]}`));
  for(const row of pages(ui,p,rows,'monitorTurnoutPage',10))p.record(row.name,`${statuses[row.status]||row.status} · ${row.reason}`,()=>ui.openCitizen(row.citizenId));
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
  const mode=ui.electionView||'polls';p.heading(`ELEIÇÃO ${e.id} · ${e.round||1}º TURNO · ${phases[e.status]||e.status}`);
  if(e.firstRoundId)p.button('RESULTADO DO PRIMEIRO TURNO',()=>ui.host?.openElection(e.firstRoundId,'results'));
  if(e.runoffId)p.button('ACOMPANHAR SEGUNDO TURNO',()=>ui.host?.openElection(e.runoffId,'polls'));
  if(e.status==='runoff-required')p.note('Nenhuma chapa obteve mais de 50% dos votos válidos. As duas primeiras disputarão o segundo turno. A Câmara será empossada com o resultado final, usando somente os votos do primeiro turno.');
  if(e.status==='scheduled')p.note(`A campanha começa em ${stamp(e.startedAt)} e dura ${(e.voteAt-e.startedAt)/1440} dias, como no primeiro turno.`);
  p.links([['polls','PESQUISAS'],['count','APURAÇÃO'],['results','RESULTADO']].map(([id,label])=>({label,selected:mode===id,click:()=>ui.host?.openElection(e.id,id)})));
  if(mode==='polls'){p.kv('Dia da votação presencial',stamp(e.voteAt));polls(ui,p,e);return;}
  if(['campaign','scheduled'].includes(e.status)){p.note(`Votação presencial na prefeitura a partir de ${stamp(e.voteAt)}. A contagem começa com os votos efetivamente depositados.`);return;}
  p.metrics([['VOTOS REGISTRADOS',e.ballots.length],['ELEITORADO',e.electorateSize??e.ballots.length],['NÃO VOTARAM',Math.max(0,(e.electorateSize??e.ballots.length)-e.ballots.length)]]);
  p.kv('Local',e.pollingName||'Prefeitura');p.kv('Fechamento da fila',stamp(e.closesAt));
  if(['voting','counting'].includes(e.status)){const travelling=(e.electorate||[]).filter(r=>r.status==='travelling').length,waiting=(e.queue?.length||0)+(e.stations?.filter(s=>s.citizenId!=null).length||0);p.kv('A caminho / em atendimento',`${travelling} / ${waiting}`);p.note(e.status==='counting'?'Fila fechada: os eleitores que chegaram no horário ainda estão sendo atendidos.':'Contagem em tempo real. Cada voto aparece depois do atendimento presencial na urna.');}
  if(e.status==='cancelled'){p.note(`Eleição adiada: ${e.cancellationReason||'Sem resultado válido'}. O governo atual continua até nova votação.`);}
  if(e.tieBroken)p.note('Empate no segundo turno: desempate por capacidade administrativa e, persistindo, ordem de cadastro.');
  if(e.status==='completed'){p.heading(`PREFEITO ELEITO: ${e.winnerName||e.ranking.find(n=>n.citizenId===e.winnerId)?.name}`);p.kv('Vice-prefeito eleito',e.viceWinnerName||'Sem vice elegível');p.kv('Apuração concluída',stamp(e.completedAt));}
  const view=ui.electionDetailView||(mode==='results'?'elected':'count');p.links([['count','CONTAGEM'],['elected','VEREADORES'],['ballots','VOTOS INDIVIDUAIS'],['turnout','COMPARECIMENTO']].map(([id,label])=>({label,selected:view===id,click:()=>ui.openPanel({electionDetailView:id})})));
  if(view==='count')candidates(ui,p,e);if(view==='elected'){if(e.status==='completed')candidates(ui,p,e);council(ui,p,e);}if(view==='ballots')ballots(ui,p,e);if(view==='turnout')turnout(ui,p,e);
  if(e.pollingBuildingId)p.button('LOCALIZAR PREFEITURA',()=>{const hall=city.building(e.pollingBuildingId);if(hall)ui.camera(hall.door.x,hall.door.y);});
  p.button('ABRIR HISTÓRICO DESTA ELEIÇÃO',()=>ui.openHistory(`electionId:${e.id}`));
}
