export const MEDIA_REPLIES={proposal:'Apresentar propostas',accountability:'Prestar contas',attack:'Confrontar adversários'};
export const MEDIA_TONES={cordial:'Cordial',analytical:'Analítico',confrontational:'Confrontador'};
export function partyMediaEvents(city){if(!city.mayorCampaign)return [];return [city.politics.active,city.mayorCampaign?.mediaSession].filter(Boolean).flatMap(e=>(e.mediaEvents||[]).map(media=>({election:e,media}))).filter(({media})=>media.candidates.some(n=>n.partyId===city.mayorCampaign.partyId));}
export function partyMediaAction(city,options){
 const p=city.politics,s=city.mayorCampaign,party=p.party(s.partyId);
 if(options.command==='request'){
  const person=city.society.citizen(options.citizenId),host=city.building(options.buildingId);
  if(!person||person.entity.destroyed||person.political?.partyId!==s.partyId||!p.eligible(person)||!host?.active||host.entity.destroyed||host.type!=='newsroom')return city.fail('Escolha representante elegível e uma redação ativa.');
  if(city.minute-(s.lastMediaRequestAt??-Infinity)<1440)return city.fail('Aguarde um dia entre pedidos de entrevista.');
  if(s.mediaSession?.mediaEvents.some(m=>['scheduled','live'].includes(m.status)))return city.fail('Conclua a participação já agendada.');
  const candidate={citizenId:person.id,name:person.entity.properties.name,partyId:party.id,promises:p.mandates.program(person,party),endorsementPartyIds:[party.id]};
  const media={id:1,kind:options.kind==='debate'?'debate':'interview',hostId:host.id,buildingId:host.id,hostName:host.entity.properties.name,topic:({jobs:'emprego e renda',housing:'habitação e aluguel',services:'saúde e alimentação',food:'saúde e alimentação'})[options.topic]||'emprego e renda',startedAt:city.minute,status:'scheduled',candidates:[candidate],turns:[],scores:{},playerAccepted:true};
  if(media.kind==='debate')for(const other of p.parties.filter(row=>row.active&&row.id!==party.id).slice(0,2)){const c=city.society.citizen(other.leaderId)||city.citizens.find(c=>c.political?.partyId===other.id&&p.eligible(c));if(c)media.candidates.push({citizenId:c.id,name:c.entity.properties.name,partyId:other.id,promises:p.mandates.program(c,other)});}
  if(media.kind==='debate'&&media.candidates.length<2)return city.fail('Não há representantes adversários disponíveis.');
  s.mediaSession={id:-city.minute-1,voteAt:city.minute+2*1440,partyOnly:true,candidates:media.candidates,mediaEvents:[media],events:[]};s.lastMediaRequestAt=city.minute;return true;
 }
 const row=partyMediaEvents(city).find(({election,media})=>election.id===options.electionId&&media.id===options.mediaId&&['scheduled','live'].includes(media.status));
 if(!row)return city.fail('Convite ou participação encerrados.');
 const m=row.media,index=m.candidates.findIndex(n=>n.partyId===party.id);
 if(options.command==='decline'){
  const n=m.candidates[index],person=city.society.citizen(n.citizenId);if(person?.task==='campaign-media'&&person.targetId===m.buildingId){person.task=null;person.targetId=null;person.path=[];}
  m.candidates.splice(index,1);m.playerDeclined=true;if(!m.candidates.length)m.status='cancelled';return true;
 }
 if(options.command==='accept'){
  if(m.status!=='scheduled'||m.turns.length)return city.fail('A participação já começou.');
  const person=city.society.citizen(options.citizenId);
  if(!person||person.entity.destroyed||person.political?.partyId!==party.id||!p.eligible(person))return city.fail('Representante indisponível.');
  m.candidates[index]={...m.candidates[index],citizenId:person.id,name:person.entity.properties.name,promises:p.mandates.program(person,party)};m.playerAccepted=true;return true;
 }
 if(options.command==='reply'){
  if(!Object.hasOwn(MEDIA_REPLIES,options.reply)||!Object.hasOwn(MEDIA_TONES,options.tone))return city.fail('Escolha resposta e tom disponíveis.');
  const promises=m.candidates[index].promises||[];if(options.promiseMetric&&!promises.some(pr=>pr.metric===options.promiseMetric))return city.fail('Proposta indisponível para este representante.');
  m.playerReply={reply:options.reply,tone:options.tone,promiseMetric:options.promiseMetric??null};return true;
 }
 return city.fail('Ação de comunicação desconhecida.');
}
export function renderPartyMedia(ui,p,act){
 const city=ui.city,s=city.mayorCampaign,gov=city.politics;
 p.heading('IMPRENSA, ENTREVISTAS E DEBATES');
 const members=city.citizens.filter(c=>!c.entity.destroyed&&c.political?.partyId===s.partyId&&gov.eligible(c)),person=members.find(c=>c.id===ui.mediaRepresentative)||members[0];
 if(!person){p.note('Sem representante elegível.');return;}
 ui.selectControl(p,'Representante na imprensa',members.map(c=>[c.id,c.entity.properties.name]),person.id,value=>{ui.mediaRepresentative=Number(value);});
 const hosts=city.buildings.filter(b=>b.active&&!b.entity.destroyed&&b.type==='newsroom'),host=hosts.find(b=>b.id===ui.partyMediaHost)||hosts[0];
 if(host){
  ui.selectControl(p,'Redação',hosts.map(b=>[b.id,b.entity.properties.name]),host.id,value=>{ui.partyMediaHost=Number(value);});
  ui.selectControl(p,'Formato da participação',[['interview','Entrevista'],['debate','Debate com outros partidos']],ui.partyMediaKind||'interview',value=>{ui.partyMediaKind=value;});
  ui.selectControl(p,'Tema na imprensa',[['jobs','Emprego e renda'],['housing','Moradia'],['services','Saúde e alimentação']],ui.partyMediaTopic||'jobs',value=>{ui.partyMediaTopic=value;});
  p.button('SOLICITAR PARTICIPAÇÃO',()=>act('partyMedia',{command:'request',citizenId:person.id,buildingId:host.id,kind:ui.partyMediaKind||'interview',topic:ui.partyMediaTopic||'jobs'}));
 }else p.note('A cidade precisa de uma redação ativa para receber entrevistas e debates.');
 p.note('Uma solicitação por dia. Participantes precisam chegar à redação. Prepare cada fala; propostas, histórico, habilidade e tom afetam a repercussão.');
 for(const {election,media:m} of partyMediaEvents(city).slice(-6).reverse()){
  p.status(`${m.kind==='debate'?'Debate':'Entrevista'} · ${m.hostName}`,`${m.topic} · ${m.status}`);
  const target={electionId:election.id,mediaId:m.id};
  if(['scheduled','live'].includes(m.status)){
   if(!m.playerAccepted)p.button('ACEITAR CONVITE COM ESTE REPRESENTANTE',()=>act('partyMedia',{...target,command:'accept',citizenId:person.id}));
   p.button('RECUSAR / SAIR',()=>act('partyMedia',{...target,command:'decline'}));
   if(m.playerAccepted){
    ui.selectControl(p,`Resposta ${election.id}:${m.id}`,Object.entries(MEDIA_REPLIES),ui.partyMediaReply||'proposal',value=>{ui.partyMediaReply=value;});
    ui.selectControl(p,`Tom ${election.id}:${m.id}`,Object.entries(MEDIA_TONES),ui.partyMediaTone||'analytical',value=>{ui.partyMediaTone=value;});
    const promises=m.candidates.find(n=>n.partyId===s.partyId)?.promises||[];
    if(promises.length)ui.selectControl(p,`Proposta ${election.id}:${m.id}`,promises.map(pr=>[pr.metric,pr.title]),promises.some(pr=>pr.metric===ui.partyMediaPromise)?ui.partyMediaPromise:promises[0].metric,value=>{ui.partyMediaPromise=value;});
    p.button('PREPARAR PRÓXIMA FALA',()=>act('partyMedia',{...target,command:'reply',reply:ui.partyMediaReply||'proposal',tone:ui.partyMediaTone||'analytical',promiseMetric:promises.find(pr=>pr.metric===ui.partyMediaPromise)?.metric??promises[0]?.metric}));
    p.note(m.playerReply?'Resposta preparada. A fala aguarda a chegada dos participantes e sua vez.':'Aguardando sua escolha para a próxima fala.');
   }
  }
  for(const turn of m.turns.slice(-4))p.note(`${turn.name}: ${turn.text}${turn.score!=null?` · desempenho ${turn.score}/100`:''}`);
  if(m.winnerName)p.kv('Resultado',m.winnerName);
 }
}
