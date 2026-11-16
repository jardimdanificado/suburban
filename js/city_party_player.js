import {formatMoney} from './city_ui_format.js';

export const PARTY_ACTIVITIES={outreach:'Conversa pública',listening:'Escuta de moradores',membership:'Campanha de filiação'};
export const PARTY_TOPICS={housing:'Moradia',food:'Abastecimento',jobs:'Emprego',services:'Serviços públicos'};

/** Local political activity uses a real member, nearby adults and the party account. */
export function partyActivity(city,options){
  const p=city.politics,s=city.mayorCampaign,party=p.party(s.partyId),person=city.society.citizen(options.citizenId);
  if(!Object.hasOwn(PARTY_ACTIVITIES,options.kind)||!Object.hasOwn(PARTY_TOPICS,options.topic))return city.fail('Escolha atividade e assunto disponíveis.');
  if(!person||person.entity.destroyed||person.political?.partyId!==s.partyId||!city.society.isAdult(person)||person.indoorLocation||city.urgentNeed(person)||person.custody)return city.fail('Escolha um filiado adulto disponível na rua.');
  if(city.hour<7||city.hour>=21)return city.fail('Atividades partidárias acontecem entre 7h e 21h.');
  if(city.minute-(s.lastActivityAt??-Infinity)<120)return city.fail('Aguarde duas horas entre atividades do partido.');
  const audience=city.citizens.filter(c=>c.id!==person.id&&!c.entity.destroyed&&city.society.isAdult(c)&&!c.indoorLocation&&!c.custody&&Math.hypot(c.entity.x-person.entity.x,c.entity.y-person.entity.y)<=8).slice(0,12);
  if(!audience.length)return city.fail('Não há moradores adultos próximos. Escolha outro filiado ou aguarde mais movimento na rua.');
  const fee=city.currency.price(50+audience.length*5),account=p.partyAccount(party);
  if(account.balance<fee)return city.fail(`Caixa partidário insuficiente: ${formatMoney(fee)}.`);
  if(!city.transfer(account.accountId,person.accountId,fee,'Atividade pública do partido',{partyId:party.id,kind:options.kind}))return city.fail('Não foi possível pagar a atividade.');
  let receptive=0,joined=0;
  for(const voter of audience){
    p.initializeCitizen(voter);
    const affinity=Math.max(-1,Math.min(1,1-p.distance(voter.political.ideology,party.ideology)));
    const effect=options.kind==='listening'?.4:affinity*(.5+(person.skills.social||0)/100);
    if(effect>0)receptive++;
    p.remember(voter,{kind:'party-public-activity',partyId:party.id,effect,truth:true,promiseKey:`party-activity:${party.id}:${city.day}:${options.topic}`,description:`${person.entity.properties.name}: ${PARTY_ACTIVITIES[options.kind]} sobre ${PARTY_TOPICS[options.topic]}, organizada por ${party.short}.`});
    if(options.kind==='membership'&&p.organization.contact(person,voter)&&voter.political.partyId===party.id)joined++;
  }
  s.lastActivityAt=city.minute;
  const row={minute:city.minute,kind:options.kind,topic:options.topic,citizenId:person.id,audience:audience.length,receptive,joined,fee};
  s.activities??=[];s.activities.push(row);if(s.activities.length>40)s.activities.shift();
  city.log(`${party.short}: ${PARTY_ACTIVITIES[options.kind]} sobre ${PARTY_TOPICS[options.topic]}; ${audience.length} moradores, ${receptive} receptivos, ${joined} filiações.`,'government',[person.id,...audience.map(c=>c.id)],{kind:'party-public-activity',partyId:party.id});
  return row;
}

export function renderPartyActivities(ui,p,act){
  const city=ui.city,s=city.mayorCampaign,gov=city.politics;
  p.heading('ATIVIDADES DO PARTIDO');
  p.note('Disponíveis entre eleições, sem prefeito ou vereadores. Conversas criam memórias; afinidade política influencia a recepção. Votos continuam livres.');
  const members=city.citizens.filter(c=>!c.entity.destroyed&&c.political?.partyId===s.partyId&&city.society.isAdult(c));
  if(!members.length){p.note('Nenhum filiado adulto disponível.');return;}
  const person=members.find(c=>c.id===ui.partySpeakerId)||members[0];
  ui.selectControl(p,'Porta-voz',members.map(c=>[c.id,`${c.entity.properties.name}${c.indoorLocation?' · em ambiente interno':''}`]),person.id,value=>{ui.partySpeakerId=Number(value);});
  p.button('LOCALIZAR PORTA-VOZ',()=>ui.camera?.(person.entity.x,person.entity.y));
  ui.selectControl(p,'Atividade partidária',Object.entries(PARTY_ACTIVITIES),ui.partyActivityKind||'outreach',value=>{ui.partyActivityKind=value;});
  ui.selectControl(p,'Assunto da atividade',Object.entries(PARTY_TOPICS),ui.partyActivityTopic||'jobs',value=>{ui.partyActivityTopic=value;});
  p.note('Alcance: até 12 adultos em um raio de 8 células do porta-voz. Custo: 50 + 5 por participante, na moeda atual, pagos pelo partido ao organizador. Intervalo de duas horas. Filiação respeita as regras e a chance de adesão existentes.');
  p.button('REALIZAR ATIVIDADE',()=>act('partyActivity',{citizenId:person.id,kind:ui.partyActivityKind||'outreach',topic:ui.partyActivityTopic||'jobs'}));
  p.heading('RESULTADOS DAS ATIVIDADES');
  for(const row of (s.activities||[]).slice(-5).reverse())p.note(`${PARTY_ACTIVITIES[row.kind]} · ${PARTY_TOPICS[row.topic]} · ${row.audience} participantes · ${row.receptive} receptivos · ${row.joined} filiações · ${formatMoney(row.fee)}`);
}
