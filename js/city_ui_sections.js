export const POLITICS_SECTIONS=[['overview','Governo'],['approval','Avaliação'],['parties','Partidos'],['council','Câmara'],['campaign','Campanha'],['polls','Pesquisas'],['institutes','Institutos de pesquisa'],['research-services','Pesquisas não eleitorais'],['promises','Promessas'],['interventions','Intervenções'],['scandals','Fiscalização'],['results','Resultados']];
export const POLITICS_GROUPS=[['management','Gestão',['overview','approval','promises','interventions']],['institutions','Instituições',['parties','council','institutes','research-services']],['elections','Eleições',['campaign','polls','results']],['oversight','Fiscalização',['scandals']]];
const details={profile:'Perfil',skills:'Habilidades',history:'Histórico',family:'Família',memories:'Memórias',politics:'Política',finance:'Finanças',infrastructure:'Infraestrutura',assets:'Conta',stock:'Estoque',staff:'Equipe',services:'Serviços',units:'Unidades'};
export function sectionTitle(state){
  if(state.tab==='party-organization')return state.partyProposalId?`Fundação partidária #${state.partyProposalId}`:state.partyOrganizationView==='membership'?'Campanhas de filiação':'Registro de partidos';
  if(state.tab==='land'&&state.recordWindow)return `Terreno ${state.selectedPlotId}`;
  if(state.tab==='publications'&&state.selectedPublicationId)return `${state.city.publications.documents.get(state.selectedPublicationId)?.title||'Publicação'} · ${state.publicationTab==='write'?'Escrita':'Conteúdo'}`;
  if(state.tab==='publications'&&state.publicationTab==='official')return 'Publicações · Jornal oficial';
  if(state.tab==='transport'&&state.selectedVehicleId!=null)return `Transportes · Veículo ${state.selectedVehicleId}`;
  if(state.tab==='transport'&&state.selectedShipmentId!=null)return `Transportes · Frete ${state.selectedShipmentId}`;
  if(state.tab==='party')return `Partido · ${state.city.politics.party(state.partyId)?.name||state.partyId}`;
  if(state.tab==='contract')return `Contrato · ${state.city.development.projects.find(p=>p.id===state.projectId)?.name||state.projectId}`;
  if(state.tab==='poll-response')return `Pesquisa ${state.pollId} · ${state.city.accountName(`citizen:${state.pollResponseCitizenId}`)}`;
  if(state.tab==='government'&&state.view()==='contracts'&&state.contractPlotId)return `Contratos · Terreno ${state.contractPlotId}`;
  if(state.tab==='government'&&['institutes','research-services'].includes(state.politicsTab)&&state.studyId)return `Coleta de pesquisa #${state.studyId}`;
  if(state.tab==='government'&&state.billId)return `Projeto de lei #${state.billId}`;
  if(state.selected)return `${state.selected.properties.name} · ${details[state.detailTab]||state.detailTab}`;
  if(state.tab==='government'&&state.view()==='elections')return `Governo · ${POLITICS_SECTIONS.find(([id])=>id===(state.politicsTab||'overview'))?.[1]||(state.politicsTab==='directory'?'Política':'Eleições')}${state.politicsTab==='approval'?' · '+({summary:'Resumo',changes:'Desde a posse',promise:'Promessa',conditions:'Condições e penalidades'}[state.approvalView||'summary']):state.politicsTab==='promises'?' · '+({promise:'Meta e resultado',indicators:'Indicadores',measurements:'Medições',events:'Acontecimentos'}[state.mandateView||'promise']):state.politicsTab==='council'?' · '+({bills:'Projetos',members:'Vereadores',propose:'Pedidos'}[state.councilView||'bills']):''}`;
  if(state.tab==='election')return `Eleição ${state.electionId} · ${{polls:'Pesquisas',count:'Apuração',results:'Resultado'}[state.electionView||'count']}`;
  if(state.tab==='event')return `Evento #${state.selectedEventId} · ${{summary:'Resumo',details:'Detalhes',timeline:'Linha do tempo'}[state.eventTab||'summary']}`;
  const module={city:'Cidade',government:'Governo',land:'Terrenos',production:'Produção',transport:'Transportes',sanitation:'Saneamento',log:'Histórico',people:'Cidadãos',economy:'Empresas',buildings:'Imóveis',publications:'Publicações',corruption:'Corrupção'}[state.tab]||state.tab;
  const view=state.view(),labels={overview:'Panorama',needs:'Necessidades',activity:'Atividade',nature:'Vegetação',contracts:'Contratos',finance:'Tesouro',world:'Terreno',plots:'Terrenos',projects:'Obras',stocks:'Estoques',demand:'Demandas',flow:'Movimentações',lighting:'Iluminação',vehicles:'Frota',lines:'Ônibus',models:'Montadoras e modelos',airspace:'Tráfego aéreo',active:'Em andamento',finished:'Encerrados',facilities:'Banheiros',cleaning:'Faxina',waste:'Resíduos',deaths:'Mortes'};
  return `${module}${labels[view]?' · '+labels[view]:''}`;
}
