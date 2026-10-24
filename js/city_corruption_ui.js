import {formatMoney as money} from './city_ui_format.js';
import {drawPartyFlag} from './city_party_flags.js';
const labels={'vote-buying':'Compra de votos','contract-overbilling':'Superfaturamento contratual',favoritism:'Favorecimento indevido',embezzlement:'Desvio de recursos'};
const mechanisms={
  'vote-buying':'O candidato pagou diretamente a um eleitor em troca de uma promessa de voto. O recebimento não garante que o eleitor cumpra o acordo na urna.',
  'contract-overbilling':'Um aditivo indevido ligado a um contrato público retirou dinheiro do tesouro para o empresário contratado. Os repasses abaixo mostram os retornos efetivamente pagos aos integrantes do esquema.',
  favoritism:'Uma subvenção pública foi direcionada a uma empresa aliada. O favorecimento também dá preferência temporária à empresa; os retornos financeiros realizados aparecem no fluxo.',
  embezzlement:'Dinheiro do tesouro foi transferido diretamente para a conta pessoal do político, como desvio de caixa.'
};
const stamp=n=>n==null?'Não registrado':`Dia ${Math.floor(n/1440)+1}, ${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
export const corruptionCases=gov=>[...new Map([...gov.corruption,...gov.scandals].map(r=>[r.id,r])).values()].sort((a,b)=>b.id-a.id);
const discovered=r=>r.discoveredAt!=null;
const status=r=>r.impeached?'Cassação registrada':r.archived?(discovered(r)?'Investigação arquivada':'Arquivado sem descoberta'):!discovered(r)?'Ainda não descoberto':r.proven?'Provas confirmadas':'Em investigação';
const flows=r=>r.steps?.length?r.steps:[{minute:r.occurredAt,from:r.from,to:r.to,amount:r.amount,description:labels[r.type]||r.type}];
export function renderCorruptionDirectory(ui,p){
  const city=ui.city,all=corruptionCases(city.politics),publicCases=all.filter(discovered),visibleCases=ui.corruptionAll?all:publicCases;
  p.heading('CENTRAL DE CORRUPÇÃO');
  p.metrics([['CASOS PÚBLICOS',publicCases.length],['COM PROVAS',publicCases.filter(r=>r.proven).length],['VALOR ENVOLVIDO',money(visibleCases.reduce((n,r)=>n+r.amount,0))]]);
  p.buttons([{label:'DESCOBERTOS',selected:!ui.corruptionAll,click:()=>{ui.corruptionAll=false;ui.resetScroll();}},{label:'TODOS (SIMULAÇÃO)',selected:!!ui.corruptionAll,click:()=>{ui.corruptionAll=true;ui.resetScroll();}}]);
  p.note(ui.corruptionAll?'Visão do observador: inclui crimes secretos. Consultar estes registros não revela os esquemas à população.':'Casos que já se tornaram públicos. Abra um caso para acompanhar o dinheiro e os participantes.');
  const rows=visibleCases.filter(r=>ui.matches(`#${r.id} ${labels[r.type]||r.type} ${city.accountName(`citizen:${r.accusedId}`)} ${status(r)}`));
  if(!rows.length)p.note('Nenhum caso neste filtro.');
  p.rows(rows,r=>p.record(`#${r.id} ${labels[r.type]||r.type}`,`${city.accountName(`citizen:${r.accusedId}`)} · ${status(r)}`,()=>ui.openCorruption(r.id),false,{value:money(r.amount)}));
  p.note('O valor de cada caso conta a transferência inicial uma vez. Repasses entre participantes não são somados novamente.');
}
export function renderCorruptionInspector(ui,p){
  const city=ui.city,gov=city.politics,r=corruptionCases(gov).find(r=>r.id===ui.corruptionCaseId)||ui.corruptionSnapshot;
  if(!r){p.note('Caso indisponível.');return;}
  const tab=ui.corruptionTab||'summary',party=gov.party(r.partyId),steps=flows(r);
  p.heading(`CASO #${r.id} · ${labels[r.type]||r.type}`);
  p.buttons([['summary','ESQUEMA'],['money','DINHEIRO'],['evidence','INVESTIGAÇÃO']].map(([id,label])=>({label,selected:tab===id,click:()=>ui.openPanel({corruptionTab:id})})));
  p.kv('Situação',status(r));
  if(!discovered(r))p.note('Informação secreta da simulação: a população ainda não descobriu este esquema.');
  if(tab==='summary'){
    p.note(mechanisms[r.type]||'As movimentações registradas mostram a execução financeira deste esquema.');
    p.kv(r.type==='vote-buying'?'Pagamento ilegal inicial':'Valor retirado do tesouro',money(r.amount));
    p.kv('Quando ocorreu',stamp(r.occurredAt));p.kv('Partido do articulador à época',party?.name||'Sem partido');
    if(party?.flag){if(p.visible(40))drawPartyFlag(p.ui.ctx,party.flag,p.x,p.y,58,36);p.y+=41;}
    p.heading('REPUTAÇÃO DOS PARTIDOS');for(const affected of gov.parties){const incidents=(affected.reputationIncidents||[]).filter(i=>i.caseId===r.id);for(const incident of incidents)p.kv(`${affected.short} · ${incident.role==='origin'?'à época do crime':'acolhimento posterior'}`,`−${incident.penalty.toFixed(2)} pontos`);}
    if(!discovered(r))p.note('Sem efeito público na reputação enquanto o esquema permanecer secreto.');
    p.heading('QUEM PARTICIPOU');
    const roles=new Map((r.roles||[]).map(role=>[role.citizenId,role.role]));
    for(const id of new Set([r.accusedId,...(r.participantIds||[]),...roles.keys()])){
      const name=city.accountName(`citizen:${id}`),role=roles.get(id)||(id===r.accusedId?'Articulador':id===r.voterId?'Eleitor que recebeu o pagamento':'Participante');
      p.card(name,role,()=>ui.openCitizen(id));
    }
    const firm=city.building(r.buildingId);if(firm)p.button(`EMPRESA: ${firm.entity.properties.name}`,()=>ui.openBuilding(firm.id));
    if(r.projectId!=null){const project=city.development.projects.find(pr=>pr.id===r.projectId);p.kv('Contrato / obra vinculada',project?.name||`#${r.projectId}`);if(project)p.button('LOCALIZAR OBRA',()=>ui.camera(project.door.x,project.door.y));}
  }
  if(tab==='money'){
    p.heading('CAMINHO DO DINHEIRO');
    p.note('Transferências realizadas, em ordem. O saldo líquido abaixo mostra a parcela recebida menos os repasses deste caso; não é o saldo atual da conta.');
    const balances=new Map(),names=new Map();
    for(const [i,s] of steps.entries()){
      p.heading(`${i+1}. ${s.description||'Transferência'}`);p.kv('Quando',stamp(s.minute));
      p.kv('De',s.fromName||city.accountName(s.from));p.kv('Para',s.toName||city.accountName(s.to));p.kv('Valor',money(s.amount));
      if(s.eventId)p.button('ABRIR COMPROVANTE',()=>ui.openEvent(s.eventId));
      balances.set(s.from,(balances.get(s.from)||0)-s.amount);balances.set(s.to,(balances.get(s.to)||0)+s.amount);
      names.set(s.from,s.fromName||city.accountName(s.from));names.set(s.to,s.toName||city.accountName(s.to));
    }
    p.heading('DESTINO LÍQUIDO POR CONTA');
    p.table([{label:'Conta',weight:2},{label:'Saldo no esquema'}],[...balances].map(([account,amount])=>({cells:[names.get(account),money(amount)]})));
    p.kv('Transferência inicial',money(r.amount));
    if(!r.steps?.length)p.note('Caso antigo: somente a transferência inicial foi preservada. Não há registro de outros repasses.');
  }
  if(tab==='evidence'){
    p.kv('Descoberta',stamp(r.discoveredAt));p.kv('Gravidade',`${Math.round(r.severity||0)}/100`);
    p.meter('Evidência reunida',(r.evidence||0)*100);p.meter('Eleitores informados',r.publicAttention||0);
    p.kv('Obstruções / proteções',r.coverUps||0);if(r.outcome)p.note(r.outcome);
    p.note('Conhecer os envolvidos nesta janela não equivale a prova pública. A investigação precisa reunir evidências e o escândalo precisa ganhar repercussão para permitir uma cassação.');
    if(r.proven&&r.accusedId===city.economy.mayorId&&!gov.suspendedExecutive)p.button('PEDIR AFASTAMENTO POR 2 DIAS',()=>gov.submitBill('suspend',{targetId:r.accusedId,caseId:r.id,value:2}));
    if(r.evidenceEventId)p.button('DOCUMENTAÇÃO FINANCEIRA',()=>ui.openEvent(r.evidenceEventId));
    p.button('HISTÓRICO DESTE CASO',()=>ui.openHistory(`corruptionCaseId:${r.id}`));
  }
  p.button('CENTRAL DE CORRUPÇÃO',()=>ui.go('corruption'));
}
