import {formatMoney} from './city_ui_format.js';
import {EVENT_CATEGORIES} from './city_society.js';
const stamp=n=>`Dia ${Math.floor(n/1440)+1}, ${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const statuses={waiting:'Aguardando atendimento',materials:'Aguardando materiais',completed:'Concluído',delivered:'Entregue',cancelled:'Cancelado',proposed:'Em votação',executed:'Executado'};
export function renderEventInspector(ui,p){
  const city=ui.city,event=city.history.get(ui.selectedEventId)||ui.eventSnapshot;
  p.heading(`INSPETOR DO EVENTO #${ui.selectedEventId}`);
  if(!event){p.note('Registro indisponível.');return;}
  p.note(event.message);
  p.columns(q=>{q.kv('Quando',stamp(event.minute));q.kv('Assunto',EVENT_CATEGORIES[event.category]||event.category||event.kind);},q=>{q.kv('Tipo',event.data?.action||event.kind);if(event.amount!=null)q.kv('Valor registrado',formatMoney(event.amount));});
  if(!city.history.get(event.id))p.note('Este registro saiu da retenção do histórico; o inspetor preserva a ocorrência aberta.');
  if(event.objectiveTruth!==undefined||event.truth!==undefined){const truth=event.objectiveTruth??event.truth;p.kv('Veracidade na simulação',truth===true?'Verdadeiro':truth===false?'Inventado':'Não verificado');}
  if(event.believes!==undefined)p.kv('Reação ao relato',event.believes?'Acreditou':'Duvidou');
  const fields=[['transactions','Pagamentos consolidados'],['quantity','Quantidade'],['quality','Qualidade'],['service','Serviço'],['provider','Prestador'],['reason','Motivo'],['topic','Assunto da conversa'],['dimension','Dimensão da reputação'],['previous','Valor anterior'],['value','Novo valor']];
  for(const [key,label] of fields)if(event[key]!=null&&typeof event[key]!=='object')p.kv(label,event[key]);
  if(event.kind==='party-membership-outreach'){
    for(const [key,label] of [['communication','Comunicação do militante'],['ideologicalAffinity','Afinidade ideológica'],['closeness','Proximidade social'],['chance','Chance de filiação']])if(event[key]!=null)p.kv(label,`${(event[key]*100).toFixed(2)}%`);
    p.kv('Distância física',`${Number(event.physicalDistance||0).toFixed(1)} células`);p.kv('Resultado',event.joined?'Filiou-se':'Não se filiou');
  }
  const foundation=city.politics.organization?.proposals.find(r=>r.id===event.partyProposalId);
  if(foundation){p.heading('FUNDAÇÃO PARTIDÁRIA');p.kv('Nome',foundation.name);p.kv('Consulta popular',stamp(foundation.voteAt));if(foundation.result)p.note(foundation.result);if(foundation.electorate!=null)p.kv('Sim / não / abstenções',`${foundation.yes} / ${foundation.no} / ${foundation.abstentions}`);p.button('ABRIR VEREDITO E VOTOS',()=>{const state=ui.go('government');state.setView('elections');state.politicsTab='parties';state.partyProposalId=foundation.id;state.helpOpen??={};state.helpOpen.partyFoundations=true;state.resetScroll();});}
  if(event.good)p.kv('Mercadoria',city.economy.goods[event.good]?.label||event.good);
  if(event.wage!=null)p.kv('Salário base/hora',formatMoney(event.wage*60));
  if(event.rate!=null)p.kv('Juros/dia',`${(event.rate*100).toFixed(2)}%`);
  if(event.startedAt!=null&&event.endedAt!=null)p.kv('Período',`${stamp(event.startedAt)} → ${stamp(event.endedAt)}`);
  if(event.ingredients)p.note('Ingredientes: '+Object.entries(event.ingredients).map(([id,n])=>`${n} ${city.economy.goods[id]?.label||id}`).join(', '));
  p.button('REGISTRAR EM LIVRO OU PANFLETO',()=>{const state=ui.go('publications');state.publicationSourceEventId=event.id;state.publicationDraft.value=event.message;state.publicationContentType=event.truth===false?'lie':'event';state.publicationTab='write';state.selectedPublicationId=null;state.publicationOwner=null;state.resetScroll();});
  p.heading('PESSOAS E IMÓVEIS ENVOLVIDOS');
  const seen=new Set();
  for(const id of event.citizenIds||[]){const c=city.society.citizen(id);if(c){seen.add(c.accountId);p.button(c.entity.properties.name,()=>ui.openCitizen(id));}}
  for(const id of event.buildingIds||[]){const b=city.building(id);if(b){seen.add(b.accountId);p.button(b.entity.properties.name,()=>ui.openBuilding(id));}}
  if(event.buildingId&&!event.buildingIds?.includes(event.buildingId)){const b=city.building(event.buildingId);if(b){seen.add(b.accountId);p.button(b.entity.properties.name,()=>ui.openBuilding(b.id));}}
  for(const subject of event.subjects||[]){if(seen.has(subject.accountId))continue;seen.add(subject.accountId);const c=city.accounts.get(subject.accountId),b=city.buildings.find(b=>b.accountId===subject.accountId);if(c?.entity?.properties.citizen&&!c.entity.destroyed)p.button(subject.name,()=>ui.openCitizen(c.id));else if(b)p.button(subject.name,()=>ui.openBuilding(b.id));else p.note(subject.name);}
  if(!seen.size)p.note('Sem pessoas ou imóveis identificados neste registro.');
  const project=city.development.projects.find(o=>o.id===event.projectId),shipment=city.logistics.shipments.find(s=>s.id===event.shipmentId),bill=city.politics.council.bills.find(b=>b.id===event.billId),record=[...city.politics.corruption,...city.politics.scandals].find(s=>s.id===(event.caseId??event.corruptionCaseId));
  if(project){p.heading('SITUAÇÃO ATUAL DA OBRA');p.kv('Projeto',project.name);p.kv('Estado',statuses[project.status]||project.status);p.kv('Pedras entregues',`${project.inventory.pedra}/${project.stone}`);p.meter('Trabalho executado',project.requiredLabor?project.labor/project.requiredLabor*100:100);p.button('LOCALIZAR OBRA',()=>ui.camera(project.door.x,project.door.y));}
  if(shipment){p.heading('SITUAÇÃO ATUAL DA ENTREGA');p.kv('Frete',shipment.id);p.kv('Estado',statuses[shipment.status]||shipment.status);p.kv('Carga',`${shipment.quantity} ${city.economy.goods[shipment.good]?.label||shipment.good}`);p.kv('Transportador',shipment.driverId?city.accountName(`citizen:${shipment.driverId}`):'Aguardando profissional');p.kv('Frete e serviço',formatMoney(shipment.fee+(shipment.serviceFee||0)));p.button('LOCALIZAR CARGA',()=>ui.camera(shipment.position.x,shipment.position.y));}
  const election=[city.politics.active,...city.politics.elections].find(e=>e?.id===event.electionId),poll=election?.polls?.find(r=>r.id===event.pollId);
  if(poll){p.heading('PESQUISA ELEITORAL VINCULADA');p.kv('Amostra / eleitorado',`${poll.sampleSize}/${poll.population}`);p.kv('Margem de referência',`±${poll.marginOfError.toFixed(1)} pontos percentuais`);p.kv('Indecisos',poll.undecided);p.note('Estimativa feita somente com as respostas dos moradores sorteados.');p.table([{label:'Candidato',weight:2},{label:'Intenção'},{label:'Rejeição'}],poll.results.map(r=>({cells:[r.name,`${(100*r.intentions/Math.max(1,poll.sampleSize)).toFixed(1)}%`,`${(100*r.rejections/Math.max(1,poll.sampleSize)).toFixed(1)}%`],click:()=>ui.openCitizen(r.candidateId)})));}
  if(bill){p.heading('SITUAÇÃO ATUAL DO PROJETO LEGISLATIVO');p.kv('Projeto',bill.title);p.kv('Estado',statuses[bill.status]||bill.status);if(bill.yes!=null)p.kv('Votação',`${bill.yes} sim / ${bill.no} não`);if(bill.result)p.note(bill.result);ui.section(p,'inspectorVotes','Votos e justificativas',()=>p.table([{label:'Vereador',weight:1.5},{label:'Voto'},{label:'Justificativa',weight:2}],(bill.votes||[]).map(v=>({cells:[v.name,v.yes?'Sim':'Não',v.reason],click:()=>ui.openCitizen(v.citizenId)}))));}
  if(record){p.heading('INVESTIGAÇÃO VINCULADA');p.button('ABRIR ESQUEMA DE CORRUPÇÃO',()=>ui.openCorruption(record.id));p.kv('Situação',record.proven?'Provas confirmadas':record.discoveredAt!=null?'Sob investigação':'Ainda não descoberto');p.kv('Gravidade / repercussão',`${Math.round(record.severity||0)} / ${Math.round(record.publicAttention||0)}%`);if(record.outcome)p.note(record.outcome);}
  p.heading('CAUSAS E EVENTOS RELACIONADOS');
  const related=[...new Set([...(event.relatedEventIds||[]),event.parentEventId,event.evidenceEventId].filter(id=>id!=null&&id!==event.id))];
  for(const id of related){const cause=city.history.get(id);p.button(`#${id}: ${cause?.message||'Registro fora da retenção'}`,()=>ui.openEvent(id));}
  if(!related.length)p.note('Nenhum evento anterior vinculado.');
  p.buttons([{label:'VER NO HISTÓRICO',click:()=>{const target=ui.go('log');target.logCategory='all';target.query='';target.search.value='';target.logReference=null;target.logCitizenId=null;target.logBuildingId=null;target.logAccountId=null;target.logLimit=80;target.logLive=true;target.scrolls={};}}]);
  for(const reference of city.history.references(event))p.button(`HISTÓRICO DA OPERAÇÃO: ${reference}`,()=>{const target=ui.go('log');target.logReference=reference;target.logCategory='all';target.logCitizenId=null;target.logBuildingId=null;target.logAccountId=null;target.query='';target.search.value='';target.resetScroll();});
}
