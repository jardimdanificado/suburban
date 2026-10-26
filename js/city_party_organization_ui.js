import {describePoliticalOrientation} from './city_ideology.js';
const stamp=n=>`Dia ${Math.floor(n/1440)+1}, ${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const states={proposed:'Aguardando consulta popular',approved:'Aprovado; aguardando registro',registered:'Registrado',rejected:'Rejeitado',withdrawn:'Retirado'};
export function renderPartyOrganization(ui,p,{fold,paginate}){
  const city=ui.city,gov=city.politics,organization=gov.organization;if(!organization)return;
  const window=organization.window(),now=city.minute;
  p.kv('Partidos ativos / limite',`${gov.parties.filter(a=>a.active).length} / ${gov.policy.partyLimit}`);
  fold(ui,p,'partyFoundations','Fundações e vereditos populares',()=>{
    p.note('A cidade começa com quatro partidos. Novos registros exigem dois amigos adultos, ideias próximas e falta de representação. A consulta ocorre um dia após o pedido: maioria dos votos válidos e participação mínima de 25% dos adultos.');
    const rows=ui.partyProposalId?[]:paginate(ui,p,[...organization.proposals].reverse(),'partyFoundationPage',6);
    if(!ui.partyProposalId)for(const row of rows)p.record(row.name,`${states[row.status]} · ${stamp(row.proposedAt)}`,()=>ui.openPanel({tab:'party-organization',partyOrganizationView:'foundations',partyProposalId:row.id,recordWindow:true}),ui.partyProposalId===row.id);
    const selected=organization.proposals.find(r=>r.id===ui.partyProposalId);if(!selected)return;
    p.heading(selected.name);p.kv('Orientação política proposta',describePoliticalOrientation(selected).label);p.kv('Situação',states[selected.status]);p.kv('Consulta',stamp(selected.voteAt));
    if(selected.parentPartyId)p.kv('Dissidência de',gov.party(selected.parentPartyId)?.name||selected.parentPartyId);
    for(let i=0;i<selected.founderIds.length;i++)p.button(`FUNDADOR: ${selected.founderNames[i]}`,()=>ui.openCitizen(selected.founderIds[i]));
    if(selected.result)p.note(selected.result);
    if(selected.electorate!=null){p.metrics([['SIM',selected.yes],['NÃO',selected.no],['ABSTENÇÕES',selected.abstentions]]);p.kv('Eleitorado / quórum',`${selected.electorate} / ${selected.quorum}`);
      fold(ui,p,'partyFoundationBallots','Votos individuais e motivos',()=>p.table([{label:'Morador',weight:1.5},{label:'Voto'},{label:'Motivo',weight:2}],paginate(ui,p,selected.ballots,'partyFoundationBallotPage',8).map(b=>({cells:[b.name,b.vote===null?'Abstenção':b.vote?'Sim':'Não',b.reason],click:()=>ui.openCitizen(b.citizenId)}))));
    }
    p.button('INSPECIONAR PEDIDO',()=>ui.openEvent(selected.eventId));if(selected.resultEventId)p.button('INSPECIONAR VEREDITO',()=>ui.openEvent(selected.resultEventId));
  });
  fold(ui,p,'partyMembershipCampaign','Campanhas de filiação nas ruas',()=>{
    p.note('Ocorrem nos dois dias anteriores e no dia posterior à eleição da presidência da Câmara. Militantes disponíveis vão às ruas movimentadas; só abordam adultos sem partido, respeitando suas necessidades.');
    if(window){p.kv('Período nesta gestão',`${stamp(window.from)} → ${stamp(window.until)}`);p.kv('Situação',now<window.from?'Ainda não começou':now>window.until?'Encerrada':'Em andamento');}
    p.metrics([['ABORDAGENS',organization.totalContacts],['FILIAÇÕES',organization.totalJoined]]);
    p.note('A chance de adesão é pequena e depende das ideias, confiança e amizade com o militante, distância física, empatia, comunicação e qualidade da conversa. A maioria pode continuar independente.');
    for(const row of paginate(ui,p,[...organization.contacts].reverse(),'membershipOutreachPage',6))p.record(`${city.accountName(`citizen:${row.citizenId}`)} · ${gov.party(row.partyId)?.short||'Partido encerrado'}`,`${stamp(row.minute)} · ${row.joined?'Filiou-se':'Não se filiou'} · chance ${(row.chance*100).toFixed(2)}%`,()=>ui.openEvent(row.eventId));
  });
}

export function renderPartyOrganizationWindow(ui,p){
  p.links([['foundations','FUNDAÇÕES E REGISTROS'],['membership','CAMPANHAS DE FILIAÇÃO']].map(([id,label])=>({label,selected:(ui.partyOrganizationView||'foundations')===id,click:()=>ui.openPanel({partyOrganizationView:id,partyProposalId:null,recordWindow:false})})));
  const paginate=(ui,p,rows,key,size)=>{const page=Math.max(0,Math.min(ui[key]||0,Math.ceil(rows.length/size)-1));if(rows.length>size)p.buttons([{label:'ANTERIOR',click:()=>{ui[key]=Math.max(0,page-1);}},{label:'PRÓXIMA',click:()=>{ui[key]=page+1;}}]);return rows.slice(page*size,page*size+size);};
  const fold=(ui,p,key,title,draw)=>{if(key===(ui.partyOrganizationView==='membership'?'partyMembershipCampaign':'partyFoundations')||key==='partyFoundationBallots'){p.heading(title);draw();}};
  renderPartyOrganization(ui,p,{fold,paginate});
}
