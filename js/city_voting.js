export const VOTING_RULES=Object.freeze({opensHour:8,closesHour:18,minutesPerVoter:2,routesPerMinute:2,retryMinutes:30});
/** Polling uses actual paths, an electoral roll, a physical queue and incremental tallies. */
export class CityVoting {
  constructor(city){this.city=city;this.lastMinute=null;}
  schedule(minute){return Math.floor(minute/1440)*1440+VOTING_RULES.opensHour*60;}
  hall(e){const b=this.city.building(e.pollingBuildingId);return b&&!b.entity.destroyed?b:null;}
  available(e){const p=this.city.politics;return e.candidates.filter(n=>{const c=this.city.society.citizen(n.citizenId);return p.party(n.partyId)?.active&&p.canRun(c,'mayor',true)&&c.political.partyId===n.partyId;});}
  open(e){
    if(e.status!=='campaign')return;const city=this.city,p=city.politics,hall=city.buildings.find(b=>b.type==='townhall'&&!b.entity.destroyed);
    e.votingOpenedAt=city.minute;e.closesAt=Math.floor(e.voteAt/1440)*1440+VOTING_RULES.closesHour*60;e.pollingBuildingId=hall?.id??null;e.pollingName=hall?.entity.properties.name||'Prefeitura indisponível';
    e.electorate=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)).map(c=>({citizenId:c.id,name:c.entity.properties.name,status:'pending',plannedAt:e.voteAt+((Math.imul(c.id+e.id,2654435761)>>>0)%Math.max(1,e.closesAt-e.voteAt-120)),nextAttemptAt:e.voteAt,reason:'Ainda não compareceu'}));
    e.roll=new Map(e.electorate.map(row=>[row.citizenId,row]));e.electorateSize=e.electorate.length;e.queue=[];e.stations=Array.from({length:Math.max(1,Math.ceil(e.electorateSize/240))},()=>({citizenId:null,finishAt:null}));e.routingCursor=0;e.turnout=e.ballots.length;e.mayorCounts={};e.councilCounts={};e.countRevision=0;e.councilSeats=p.council.seats;e.status='voting';
    for(const c of city.citizens)if(c.campaign?.electionId===e.id){c.campaign=null;if(c.task==='campaign'){c.task=null;c.path=[];}}
    e.votingEventId=city.log(`Eleição ${e.id}: votação presencial aberta na prefeitura; urnas até as ${VOTING_RULES.closesHour}h.`,'government',[],{kind:'voting-opened',electionId:e.id,buildingId:hall?.id,electorate:e.electorateSize,stations:e.stations.length,parentEventId:e.eventId}).id;
    if(!hall||!this.available(e).length){e.cancellationReason=!hall?'Prefeitura indisponível para votação presencial.':'Nenhuma candidatura elegível.';this.close(e);}
  }
  clear(c){if(!c)return;if(c.task==='vote'){c.task=null;c.path=[];c.targetId=null;}c.voting=null;}
  release(e,row,reason){const c=this.city.society.citizen(row.citizenId);this.clear(c);row.status=!c?'unavailable':this.city.minute<e.closesAt?'pending':'abstained';row.reason=!c?'Faleceu ou saiu da cidade antes de votar':reason;row.nextAttemptAt=this.city.minute+VOTING_RULES.retryMinutes;}
  route(e,row){
    const city=this.city,c=city.society.citizen(row.citizenId),hall=this.hall(e);
    if(!c){row.status='unavailable';row.reason='Faleceu ou saiu da cidade antes de votar';return false;}
    if(!hall)return false;
    if(c.voting?.electionId===e.id&&c.task==='vote')return false;
    if(city.urgentNeed(c)||Math.min(c.needs.food,c.needs.water,c.needs.energy,c.needs.health)<35||c.needs.toilet<25||c.workMeal||c.deliveryId||c.cleaningJobId||['care','caregiving','food','provisions','water','health','toilet','workmeal'].includes(c.task)){row.reason='Atendendo necessidade ou serviço essencial';return false;}
    row.nextAttemptAt=city.minute+VOTING_RULES.retryMinutes;const path=city.findPath(c.entity,hall.door);
    if(path===null){row.reason='Sem caminho acessível até a prefeitura';return true;}
    if(c.conversation){const other=city.society.citizen(c.conversation.a===c.id?c.conversation.b:c.conversation.a);if(other)other.conversation=null;c.conversation=null;}
    path.push({x:Math.floor(hall.door.x)+.18+(c.id%3)*.32,y:Math.floor(hall.door.y)+.18+(Math.floor(c.id/3)%3)*.32});
    c.campaign=null;c.socialVisitId=null;c.voting={electionId:e.id};c.targetId=hall.id;c.path=path;c.task='vote';c.action='Indo votar presencialmente na prefeitura';row.status='travelling';row.departedAt=city.minute;row.reason='A caminho da prefeitura';return true;
  }
  arrive(c){
    const city=this.city,e=city.politics.active,hall=e&&this.hall(e),row=e?.roll?.get(c.id);
    if(!e||!['voting','counting'].includes(e.status)||c.voting?.electionId!==e.id||!row||!hall){this.clear(c);return;}
    if(Math.hypot(c.entity.x-hall.door.x,c.entity.y-hall.door.y)>.9){this.release(e,row,'Percurso interrompido antes de chegar à prefeitura');return;}
    if(['waiting','casting'].includes(row.status)){c.action=row.status==='casting'?'Votando na urna da prefeitura':'Na fila para votar na prefeitura';return;}
    if(e.status!=='voting'||city.minute>=e.closesAt){this.release(e,row,'Chegou após o encerramento da fila');return;}
    if(row.status!=='travelling'){this.clear(c);return;}
    row.status='waiting';row.arrivedAt=city.minute;row.reason='Na fila presencial';e.queue.push(c.id);c.action='Na fila para votar na prefeitura';
  }
  cast(e,row){
    if(!row||row.status!=='casting'||!['voting','counting'].includes(e.status))return;
    const city=this.city,p=city.politics,voter=city.society.citizen(row.citizenId),hall=this.hall(e);
    if(!voter||voter.task!=='vote'||voter.voting?.electionId!==e.id||!hall||Math.hypot(voter.entity.x-hall.door.x,voter.entity.y-hall.door.y)>.9){this.release(e,row,'Não concluiu o atendimento presencial');return;}
    const chosen=p.intentions(voter,this.available(e))[0];
    const council=e.councilCandidates.map(n=>{const c=city.society.citizen(n.citizenId);return p.party(n.partyId)?.active&&p.canRun(c,'council',true)&&c.political.partyId===n.partyId?{id:n.citizenId,name:n.name,partyId:n.partyId,...p.voterAssessment(voter,c,p.platform(c))}:null;}).filter(Boolean).sort((a,b)=>b.score-a.score||a.id-b.id)[0];
    const nomination=e.candidates.find(n=>n.citizenId===chosen?.candidateId);
    const ballot=Object.freeze({citizenId:voter.id,name:row.name,candidateId:chosen?.candidateId??null,candidateName:nomination?.name??'Branco',partyId:chosen?.partyId??null,score:chosen?.score??0,reason:chosen?.reason||'Sem candidatura elegível',reasons:chosen?.reasons||[],councilCandidateId:council?.id??null,councilCandidateName:council?.name??'Branco',councilPartyId:council?.partyId??null,councilReason:council?.reason||'Sem candidatura elegível',castAt:city.minute,arrivedAt:row.arrivedAt,pollingBuildingId:hall.id});
    e.ballots.push(ballot);if(ballot.candidateId!=null)e.mayorCounts[ballot.candidateId]=(e.mayorCounts[ballot.candidateId]||0)+1;if(ballot.councilCandidateId!=null)e.councilCounts[ballot.councilCandidateId]=(e.councilCounts[ballot.councilCandidateId]||0)+1;e.turnout=e.ballots.length;e.countRevision++;
    row.status='voted';row.castAt=city.minute;row.reason=`Votou por ${ballot.reason}`;this.clear(voter);voter.action='Concluiu seu voto presencial';
    const event=city.history.record('government',`${row.name} votou presencialmente na prefeitura.` ,[voter.accountId],{kind:'in-person-vote',action:'vote',electionId:e.id,buildingId:hall.id,candidateId:ballot.candidateId,councilCandidateId:ballot.councilCandidateId,reason:ballot.reason,castAt:ballot.castAt,parentEventId:e.votingEventId});
    p.remember(voter,{kind:'vote',electionId:e.id,partyId:ballot.partyId,candidateId:ballot.candidateId,eventId:event.id,description:`Votou presencialmente em ${ballot.candidateName} e ${ballot.councilCandidateName}, por ${ballot.reason}.`});
  }
  close(e){
    const city=this.city;for(const row of e.electorate||[])if(!['voted','unavailable','abstained'].includes(row.status)){row.status='abstained';row.reason=e.cancellationReason||row.reason||'Não compareceu antes do fechamento';this.clear(city.society.citizen(row.citizenId));}
    e.abstentions=(e.electorate||[]).filter(r=>r.status!=='voted').map(r=>Object.freeze({citizenId:r.citizenId,name:r.name,status:r.status,reason:r.reason}));e.queue=[];for(const station of e.stations||[]){station.citizenId=null;station.finishAt=null;}e.readyToFinish=true;this.city.politics.vote();
  }
  updateMinute(){
    const city=this.city,p=city.politics,e=p.active;if(!e||this.lastMinute===city.minute)return;this.lastMinute=city.minute;
    if(e.status==='campaign'&&city.minute>=e.voteAt)this.open(e);
    if(p.active!==e||!['voting','counting'].includes(e.status))return;
    if(!this.hall(e)){e.cancellationReason='Prefeitura ficou indisponível durante a votação.';this.close(e);return;}
    if(e.status==='voting'&&city.minute>=e.closesAt){
      // Admit people who physically arrived before closing, including this minute's arrivals.
      for(const row of e.electorate)if(row.status==='travelling'){const c=city.society.citizen(row.citizenId);if(c&&c.task==='vote'&&!c.path.length&&Math.hypot(c.entity.x-this.hall(e).door.x,c.entity.y-this.hall(e).door.y)<=.9){row.status='waiting';row.arrivedAt=city.minute;row.reason='Na fila presencial no fechamento';e.queue.push(c.id);}}
      e.status='counting';e.closedAt=city.minute;city.log(`Eleição ${e.id}: fila encerrada; atendimento de quem já chegou continua.`,'government',[],{kind:'voting-closed',electionId:e.id,parentEventId:e.votingEventId});
      for(const row of e.electorate)if(['pending','travelling'].includes(row.status))this.release(e,row,row.status==='travelling'?'Não chegou à prefeitura antes do fechamento':row.reason);
    }
    e.queue=e.queue.filter(id=>{const row=e.roll.get(id),c=city.society.citizen(id);if(row?.status!=='waiting')return false;if(c&&c.task==='vote'&&!city.urgentNeed(c))return true;this.release(e,row,'Saiu da fila por necessidade ou interrupção');return false;});
    for(const station of e.stations){
      if(station.citizenId!=null){const row=e.roll.get(station.citizenId),c=city.society.citizen(station.citizenId);if(!c||c.task!=='vote'||city.urgentNeed(c)){this.release(e,row,'Atendimento interrompido por necessidade urgente');station.citizenId=null;station.finishAt=null;}else if(city.minute>=station.finishAt){this.cast(e,row);station.citizenId=null;station.finishAt=null;}}
      while(station.citizenId==null&&e.queue.length){const id=e.queue.shift(),row=e.roll.get(id),c=city.society.citizen(id);if(!row||row.status!=='waiting')continue;if(!c||c.task!=='vote'||city.urgentNeed(c)){this.release(e,row,'Saiu da fila por necessidade ou interrupção');continue;}row.status='casting';row.reason='Atendimento na urna';station.citizenId=id;station.finishAt=city.minute+VOTING_RULES.minutesPerVoter;}
    }
    if(e.status==='counting'){if(!e.queue.length&&e.stations.every(s=>s.citizenId==null))this.close(e);return;}
    let routes=0;for(let scanned=0;scanned<Math.min(24,e.electorate.length)&&routes<VOTING_RULES.routesPerMinute;scanned++){
      const row=e.electorate[e.routingCursor++%e.electorate.length];if(row.status==='travelling'){const c=city.society.citizen(row.citizenId);if(!c||c.task!=='vote'){this.release(e,row,'Trajeto interrompido; aguardando nova tentativa');}continue;}
      if(row.status!=='pending'||city.minute<row.plannedAt||city.minute<row.nextAttemptAt)continue;if(this.route(e,row))routes++;
    }
  }
}
