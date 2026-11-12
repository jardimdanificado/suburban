import {CITY_FLOOR_HEIGHT} from './city_building_geometry.js?v=banner-placement-2';
import {syncCorruptionVotes} from './city_corruption_votes.js';
import {VEHICLE_SPECS} from './city_vehicles.js?v=harbor-boats-4';
import {TAX_CATEGORIES,MINIMUM_WAGE_TAX_RATE} from './city_sales_tax.js';
import {ensureExternalAccount} from './city_currency.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const DIRECTIVE_LABELS={publicWork:'Contratação de obra pública',veto:'Veto do prefeito',releasePrisoner:'Libertação de pessoa presa',arrestAuthorization:'Autorização de prisão',worksBudget:'Ajuste da verba de obras',worksTransfer:'Transferência para obras',privatize:'Oferta de participação estatal',nationalize:'Estatização de empresa',policeStaffing:'Ajuste do efetivo policial',parliamentaryImmunity:'Regra de imunidade parlamentar',cleanRecord:'Regra da ficha limpa',penalCode:'Ajuste do código penal',suspend:'Afastamento do prefeito',build:'Obra pública',convict:'Condenação política',impeach:'Cassação de mandato'};
export const INTERVENTIONS={
  praise:{label:'Destacar boas ações',group:'opinion',description:'Divulga um perfil favorável, melhora reputação e alcança parte dos moradores.'},
  rumor:{label:'Espalhar um boato',group:'opinion',description:'Tenta prejudicar a imagem. Pessoas críticas podem desconfiar; o efeito enfraquece com o tempo.'},
  correction:{label:'Publicar esclarecimento',group:'opinion',description:'Corrige boatos das intervenções e divulga a correção aos moradores alcançados.'},
  expose:{label:'Vazar documentos de corrupção',group:'opinion',description:'Expõe um esquema existente envolvendo a pessoa; não inventa um crime.'},
  shield:{label:'Obstruir uma investigação',group:'opinion',description:'Dificulta a coleta de novas provas, preservando as provas e o conhecimento já públicos.'},
  endorsement:{label:'Divulgar apoio à candidatura',group:'campaign',description:'Apresenta a candidatura e a promessa a uma amostra de moradores.'},
  debate:{label:'Organizar debate público',group:'campaign',description:'Apresenta todos os candidatos; preparo, comunicação e afinidade influenciam a reação individual.'},
  rally:{label:'Organizar ato de rua',group:'campaign',description:'Mobiliza moradores disponíveis para fazer campanha presencial. Precisa de moradores disponíveis; o financiamento externo é registrado.'},
  rigPoll:{label:'Comprar adulteração de pesquisa',group:'campaign',description:'Determina a adulteração de uma pesquisa eleitoral publicada. Abre um esquema real de corrupção; provas podem levar à correção pública.'},
  partyFunding:{label:'Aporte ao fundo do partido',group:'campaign',description:'Transfere verba municipal para o partido escolhido; favorecimento gera desgaste político.',cost:25000},
  businessFunding:{label:'Financiar empresa',group:'economy',description:'Transfere capital municipal para custeio, salários e compras da empresa escolhida.',cost:100000},
  importVehicle:{label:'Importar veículo',group:'economy',description:'Compra externa explícita: entrega um veículo ao cidadão escolhido, sem depender da produção local.'},
  researchOrder:{label:'Encomendar pesquisa',group:'city',description:'Contrata coleta presencial sobre prioridades, mercado, partidos ou candidaturas.'},
  employmentOrder:{label:'Orientar contratação',group:'city',description:'Muda remuneração e critérios das vagas, preservando a contratação e o aprendizado reais.'},
  assemblyOrder:{label:'Encomendar lote de veículos',group:'city',description:'Define o próximo lote; peças, montagem e transporte continuam necessários.'},
  serviceOrder:{label:'Encomendar serviço',group:'city',description:'Contrata reparo, limpeza, jardinagem ou arte; trabalhadores, materiais e deslocamentos continuam necessários.'},
  removeArtwork:{label:'Ordenar retirada de obra de arte',group:'city',description:'Contrata uma equipe para retirar a obra no local, preservando autoria e histórico.'},
  cancelService:{label:'Cancelar encomenda',group:'city',description:'Cancela um serviço em andamento e devolve o saldo reservado pelo fluxo normal.'},
  prioritizeWork:{label:'Priorizar obra',group:'city',description:'Altera a prioridade de um contrato sem dispensar materiais ou construtores.'},
  ride:{label:'Solicitar passeio de bicicleta ou patins',group:'economy',description:'O proprietário ou funcionário busca o equipamento e segue por um caminho real na cidade.'},
  divineCampaign:{label:'Divulgar apoio à candidatura',group:'god',description:'Leva uma mensagem de apoio à candidatura para eleitores, com reação individual à ideologia e à confiança.'},
  divineSmear:{label:'Espalhar uma suspeita eleitoral',group:'god',description:'Espalha uma acusação sem prova durante a campanha; eleitores críticos podem rejeitá-la.'},
  divineTurnout:{label:'Convocar eleitores às urnas',group:'god',description:'Libera imediatamente os eleitores aptos e inicia os trajetos presenciais até a prefeitura.'},
  divineTreasury:{label:'Emitir dinheiro para a prefeitura',group:'god',description:'Emite dinheiro no tesouro; a expansão da base monetária pode pressionar a inflação.'},
  divineDecree:{label:'Decreto econômico imediato',group:'god',description:'Muda imediatamente uma alíquota, sem tramitação na Câmara.'},
  divineBankLiquidity:{label:'Injetar liquidez no banco',group:'god',description:'Transfere recursos do tesouro para o banco financiar depósitos e empréstimos.'},
  divineDebtRelief:{label:'Perdoar uma dívida',group:'god',description:'Encerra imediatamente o empréstimo escolhido e remove juros e saldo devedor.'},
  divineConvocation:{label:'Convocar a Câmara ao plenário',group:'god',description:'Convoca vereadores disponíveis e inicia o deslocamento até a sessão.'},
  divineGovernment:{label:'Ordem direta de governo',group:'god',description:'Aplica imediatamente uma decisão administrativa, econômica, legal ou de obra sem encaminhá-la à Câmara.'},
};
export class CityInterventions {
  constructor(city){this.city=city;this.records=[];this.nextId=1;this.cooldowns=new Map();}
  dispatch(kind,targetId=null,options={}){
    const city=this.city,p=city.politics,spec=INTERVENTIONS[kind];if(!spec)return city.fail('Intervenção desconhecida.');
    const key=`${kind}:${targetId??'city'}`;if(spec.group==='opinion'&&city.minute-(this.cooldowns.get(key)??-Infinity)<30)return city.fail('Aguarde 30 minutos da cidade para repetir esta intervenção no mesmo alvo.');
    const c=city.society.citizen(targetId),e=p.active,n=e?.candidates.find(n=>n.citizenId===targetId),record={id:this.nextId,kind,title:kind==='divineGovernment'?(DIRECTIVE_LABELS[options.type]||`Ordem direta: ${options.type||'governo'}`):spec.label,targetId,minute:city.minute,affected:0,cost:0,description:'',truth:kind!=='rumor'};
    const live=c&&!c.entity.destroyed;if(['opinion','campaign','god'].includes(spec.group)&&!['debate','divineGovernment','divineTreasury','divineDecree','divineBankLiquidity','divineDebtRelief','divineConvocation','divineTurnout'].includes(kind)&&!live)return city.fail('Selecione uma pessoa viva.');
    if(spec.group==='campaign'&&kind!=='partyFunding'&&(!e||e.status!=='campaign'))return city.fail('Esta intervenção precisa de uma campanha eleitoral em andamento.');
    if(['endorsement','rally','rigPoll'].includes(kind)&&!n)return city.fail('Selecione um candidato a prefeito desta eleição.');
    const audience=()=>p.campaigns.audience(Math.max(1,Math.ceil(city.citizens.length*.25)));
    const remember=(v,target,effect,message,truth=true)=>{p.initializeCitizen(v);p.remember(v,{kind:'observer-opinion',interventionId:record.id,electionId:null,candidateId:target.id,partyId:target.political?.partyId,truth,believes:effect!==0,effect,promiseKey:`observer:${record.id}:${target.id}`,description:message});record.affected++;};
    const sponsor=(to,amount)=>{ensureExternalAccount(city,'observer-funding','Patrocínio externo de intervenções');return city.transfer('observer-funding',to,amount,'Financiamento externo de intervenção',{interventionId:record.id});};
    const fund=(to,amount)=>{const shortfall=Math.max(0,amount-(city.accounts.get(to)?.balance||0));return !shortfall||sponsor(to,shortfall);};
    const pay=(to,amount,reason)=>{if(!Number.isSafeInteger(amount)||amount<1)return city.fail('Valor inválido.');if(!fund('treasury',amount+city.welfare.conditions().reserve))return false;if(!city.transfer('treasury',to,amount,reason,{kind:'observer-intervention',interventionId:record.id,targetId}))return false;record.cost+=amount;return true;};
    if(kind==='praise'||kind==='rumor'){
      p.initializeCitizen(c);for(const voter of audience()){const believes=kind==='praise'||city.random()<clamp(.85-(voter.political?.criticalSense??.5)*.7,.1,.8);remember(voter,c,believes?(kind==='praise'?5:-7):0,kind==='praise'?`Conheceu uma divulgação favorável sobre ${c.entity.properties.name}.`:`Ouviu um boato sobre ${c.entity.properties.name}; ${believes?'acreditou':'desconfiou'}.`,kind==='praise');}
      if(kind==='rumor'){const believers=city.citizens.filter(v=>v.political?.memories.some(m=>m.interventionId===record.id&&m.effect<0)).length;record.reputationDelta=-Math.round(4*believers/Math.max(1,record.affected));city.reputation.observe(c.accountId,'civic',record.reputationDelta,'boato divulgado pelo observador',{interventionId:record.id});}
      if(kind==='praise'){city.reputation.observe(c.accountId,'civic',5,'divulgação favorável do observador',{interventionId:record.id});c.political.popularity=clamp((c.political.popularity??50)+3,0,100);}
      record.description=`${kind==='praise'?'Perfil favorável':'Boato'} sobre ${c.entity.properties.name}; ${record.affected} moradores alcançados.`;
    }else if(kind==='correction'){
      for(const voter of city.citizens){if(voter.entity.destroyed)continue;let corrected=0;voter.political?.memories.forEach((m,i)=>{if(m.kind==='observer-opinion'&&m.candidateId===c.id&&!m.truth&&!m.corrected){voter.political.memories[i]=Object.freeze({...m,effect:0,corrected:true,description:'Conheceu a correção do boato divulgado pelo observador.'});corrected++;}});if(corrected)record.affected++;}for(const old of this.records.filter(r=>r.kind==='rumor'&&r.targetId===c.id&&!r.correctedAt)){old.correctedAt=city.minute;if(old.reputationDelta)city.reputation.observe(c.accountId,'civic',-old.reputationDelta,'correção de boato divulgado pelo observador',{interventionId:record.id});}record.description=`Esclarecimento sobre ${c.entity.properties.name}: ${record.affected} moradores corrigiram a informação.`;
    }else if(kind==='expose'||kind==='shield'){
      const cases=p.corruption.filter(s=>!s.archived&&(s.accusedId===c.id||s.participantIds?.includes(c.id))).sort((a,b)=>(b.severity||0)-(a.severity||0)),crime=options.caseId!=null?cases.find(s=>s.id===options.caseId):cases[0];if(!crime)return city.fail('Esta pessoa não está ligada a um esquema ativo conhecido pela simulação.');record.caseId=crime.id;
      if(kind==='expose'){crime.discoveredAt??=city.minute;crime.evidence=Math.min(1,(crime.evidence||0)+.45);if(!p.scandals.includes(crime))p.scandals.push(crime);crime.awareIds??=[];for(const voter of audience()){if(!crime.awareIds.includes(voter.id))crime.awareIds.push(voter.id);remember(voter,c,-(crime.proven?12:4),`Conheceu documentos do caso #${crime.id}, ${crime.proven?'comprovado':'ainda sob investigação'}.`);}syncCorruptionVotes(p,crime);record.description=`Documentos do caso #${crime.id} divulgados; novas provas e ${record.affected} moradores informados.`;}
      else{crime.concealment=clamp((crime.concealment??.4)+.2,0,.95);crime.coverUps=(crime.coverUps||0)+1;record.description=`Obstrução do caso #${crime.id}: descoberta de novas provas ficou mais difícil.`;}
    }else if(kind==='endorsement'){
      for(const voter of audience()){p.campaigns.hearPromises(voter,n,e,'Apoio divulgado pelo observador');remember(voter,c,3,`Conheceu um apoio público à candidatura de ${n.name}.`);}record.description=`Apoio a ${n.name} divulgado a ${record.affected} moradores.`;
    }else if(kind==='debate'){
      const listeners=audience();for(const voter of listeners)for(const candidate of e.candidates){const person=city.society.citizen(candidate.citizenId);if(!person||person.entity.destroyed)continue;p.campaigns.hearPromises(voter,candidate,e,'Debate público organizado pelo observador');const fit=1-p.distance(voter.political.ideology,p.party(candidate.partyId).ideology)/2.8,performance=((person.skills.social||0)+(person.skills.governance||0))/200;remember(voter,person,clamp((fit+performance-1)*5,-4,4),`Avaliou ${candidate.name} num debate público.`);}record.description=`Debate com ${e.candidates.length} candidaturas e ${listeners.length} moradores; reações individuais.`;
    }else if(kind==='rally'){
      const funds=p.partyAccount(p.party(n.partyId)),before=funds.balance;fund(funds.accountId,city.currency.price(1000000));for(let i=0;i<6;i++)p.campaigns.recruit(n,e);const participants=p.campaigns.rally(n,e);record.cost=Math.max(0,Math.max(before,city.currency.price(1000000))-funds.balance);
      record.affected=participants||city.citizens.filter(c=>c.task==='campaign'&&c.campaign?.partyId===n.partyId).length;if(!record.affected)return city.fail('Nenhum novo militante disponível: confira horário, necessidades e caixa partidário.');record.description=`Ato de ${n.name}: ${record.affected} moradores mobilizados nas ruas.`;
    }else if(kind==='rigPoll'){
      const poll=options.pollId!=null?e.polls.find(poll=>poll.id===options.pollId&&!poll.manipulated):[...e.polls].reverse().find(poll=>!poll.manipulated),institute=poll&&city.building(poll.instituteId),director=institute&&p.getResearch().staff(institute)[0];if(!poll||!institute||!director)return city.fail('Não há pesquisa publicada sem adulteração e com direção disponível.');
      const amount=city.currency.price(300000+poll.sampleSize*10000),account=p.partyAccount(p.party(n.partyId));if(!fund(account.accountId,amount))return city.fail('Não foi possível registrar o financiamento externo.');
      const crime=p.crime(c,'poll-rigging',account.accountId,institute.accountId,amount,{studyId:poll.studyId,pollId:poll.id,electionId:e.id,buildingId:institute.id,targetCandidateId:c.id,participantIds:[c.id,director.id],roles:[{citizenId:c.id,role:'Contratante da adulteração'},{citizenId:director.id,role:'Direção do instituto'}]});if(!crime)return city.fail('Não foi possível financiar o esquema.');crime.severity=75;crime.concealment=.65;record.caseId=crime.id;record.cost=amount;
      poll.originalPublishedResults=poll.results;poll.originalPublishedUndecided=poll.undecided;const forged=poll.results.map(r=>({...r})),favored=forged.find(r=>r.candidateId===c.id);if(favored){let needed=Math.max(1,Math.floor(poll.sampleSize*.2)),take=Math.min(needed,poll.undecided);poll.undecided-=take;favored.intentions+=take;needed-=take;for(const other of forged.filter(r=>r!==favored).sort((a,b)=>b.intentions-a.intentions)){take=Math.min(needed,other.intentions);other.intentions-=take;favored.intentions+=take;needed-=take;}poll.results=forged.map(Object.freeze);}poll.manipulated=true;poll.corruptionCaseId=crime.id;const study=p.getResearch().studies.find(s=>s.id===poll.studyId);if(study)study.corruptionCaseId=crime.id;record.truth=false;const leader=poll.results.slice().sort((a,b)=>b.intentions-a.intentions)[0];if(leader)for(const voter of audience()){p.remember(voter,{kind:'published-poll',electionId:e.id,studyId:poll.studyId,partyId:leader.partyId,candidateId:leader.candidateId,effect:Math.min(3,leader.intentions/Math.max(1,poll.sampleSize)*3),description:'Conheceu a divulgação adulterada de uma pesquisa eleitoral.'});record.affected++;}record.description=`Pesquisa #${poll.id} adulterada para favorecer ${n.name}; caso de corrupção #${crime.id}. Entrevistas originais e votos nas urnas foram preservados.`;
    }else if(kind==='partyFunding'){
      const party=p.party(c.political?.partyId);if(!party?.active)return city.fail('A pessoa escolhida não tem partido ativo.');if(!pay(p.partyAccount(party).accountId,city.currency.price(spec.cost),'Intervenção: aporte direcionado ao fundo partidário'))return false;
      for(const voter of audience())remember(voter,c,-2,`Desaprovou o aporte público direcionado a ${party.short}.`);record.description=`${party.short} recebeu verba municipal direcionada; houve reação ao favorecimento.`;
    }else if(kind==='businessFunding'){
      const b=city.building(targetId);if(!b?.active||b.entity.destroyed)return city.fail('Selecione uma empresa ativa.');if(!pay(b.accountId,city.currency.price(spec.cost),'Intervenção: capital para empresa'))return false;record.description=`Aporte municipal em ${b.entity.properties.name}; compras e trabalho continuam sendo necessários.`;record.buildingId=b.id;
    }else if(kind==='importVehicle'){
      if(!live)return city.fail('Selecione quem receberá o veículo.');const good=options.good||'bicicleta',system=city.vehicles,building=city.buildings.find(b=>b.type==='townhall'&&!b.entity.destroyed);if(!VEHICLE_SPECS[good]||!building)return city.fail('Veículo ou ponto de entrega indisponível.');
      ensureExternalAccount(city,'external-trade','Comércio exterior');if(!pay('external-trade',Math.ceil(city.economy.goods[good].price*1.5),'Intervenção: importação de veículo'))return false;
      const signature=`imported:${good}`;let model=system.models.get(signature);if(!model){model={id:system.nextModelId++,signature,kind:good,manufacturerId:null,brand:'Importação',name:VEHICLE_SPECS[good].label,components:[],createdAt:city.minute,imported:true};system.models.set(signature,model);}const id=system.nextId;system.registerUnits(building,good,1,model.id);const v=system.units.get(id);system.activate(v,c.accountId,building);v.imported=true;v.ownershipHistory=[{minute:city.minute,from:'external-trade',to:c.accountId,price:record.cost,reason:'Importação pelo observador'}];city.economy.initialStock[good]=(city.economy.initialStock[good]||0)+1;record.vehicleId=id;record.description=`${VEHICLE_SPECS[good].label} #${id} importado para ${c.entity.properties.name}. Usa força humana para circular nas ruas.`;
    }else if(kind==='divineCampaign'||kind==='divineSmear'){
      if(!p.active||p.active.status!=='campaign')return city.fail('Esta intervenção exige uma campanha eleitoral em andamento.');
      const candidate=p.active.candidates.find(row=>row.citizenId===targetId);if(!candidate)return city.fail('Escolha um candidato desta eleição.');
      const message=kind==='divineCampaign'?`Conheceu uma divulgação de apoio a ${candidate.name}.`:`Ouviu uma acusação eleitoral sem provas contra ${candidate.name}.`;
      const voters=p.campaigns.audience(Math.max(1,Math.ceil(city.citizens.length*.4)));
      for(const voter of voters){p.initializeCitizen(voter);const believes=kind==='divineCampaign'||city.random()<clamp(.75-(voter.political?.criticalSense??.5)*.65,.08,.72),fit=1-p.distance(voter.political.ideology,p.party(candidate.partyId).ideology)/2.8,effect=kind==='divineCampaign'?(believes?clamp(3+fit*4,-1,7):0):(believes?-clamp(4+fit*4,2,8):0);p.remember(voter,{kind:'observer-opinion',interventionId:record.id,electionId:p.active.id,candidateId:targetId,partyId:candidate.partyId,truth:kind==='divineCampaign',believes,effect,promiseKey:`observer:${record.id}:${voter.id}`,description:message});if(effect)record.affected++;}
      record.description=`${kind==='divineCampaign'?'Apoio':'Suspeita'} sobre ${candidate.name} chegou a ${voters.length} eleitores; ${record.affected} registraram reação.`;
    }else if(kind==='divineTurnout'){
      const election=p.active;if(!election||!['voting','counting'].includes(election.status))return city.fail('A convocação às urnas só funciona durante a votação presencial.');
      let routed=0;for(const row of election.electorate||[]){if(row.status!=='pending')continue;row.plannedAt=city.minute;row.nextAttemptAt=city.minute;if(election.status==='voting'&&p.voting.route(election,row))routed++;}
      record.affected=routed;record.description=`Convocação concluída: ${routed} eleitores aptos começaram o trajeto para votar na prefeitura.`;
    }else if(kind==='divineTreasury'){
      const amount=city.currency.price(Math.max(1000,Math.min(10000000,Number(options.amount)||100000)));if(!city.currency.issue(amount))return city.fail('A emissão não pôde ser registrada no tesouro.');
      record.cost=amount;record.affected=1;record.description=`A prefeitura recebeu ${city.currency.format?city.currency.format(amount):`R$ ${(amount/100).toFixed(2)}`} por emissão extraordinária; o dinheiro entrou no tesouro.`;
    }else if(kind==='divineDecree'){
      const value=Number(options.value),category=options.category,minimum=category?TAX_CATEGORIES[category]?.rate:MINIMUM_WAGE_TAX_RATE;if(!Number.isFinite(value)||!minimum||value<minimum||value>.5)return city.fail('A alíquota deve ser pelo menos o dobro da taxa anterior e no máximo 50%.');
      const before=category?city.politics.policy.salesTaxes?.[category]:city.taxRate;if(category){city.politics.policy.salesTaxes[category]=value;}else city.taxRate=value;
      record.affected=1;record.description=`Decreto econômico: ${category?`imposto de ${category}`:'imposto salarial'} alterado imediatamente de ${Math.round(before*100)}% para ${Math.round(value*100)}%.`;
    }else if(kind==='divineBankLiquidity'){
      const b=city.building(targetId);if(!b||b.type!=='bank'||b.entity.destroyed)return city.fail('Selecione um banco ativo.');const amount=city.currency.price(Math.max(1000,Math.min(100000000,Number(options.amount)||25000))),reserve=city.welfare.conditions().reserve;
      if(!fund('treasury',amount+reserve)||!city.transfer('treasury',b.accountId,amount,'Intervenção do observador: liquidez extraordinária para o banco',{buildingId:b.id}))return city.fail('O tesouro não tem saldo livre suficiente para essa injeção.');record.cost=amount;record.affected=1;record.buildingId=b.id;record.description=`${b.entity.properties.name} recebeu ${`R$ ${(amount/100).toFixed(2)}`} de liquidez imediatamente.`;
    }else if(kind==='divineDebtRelief'){
      const loan=city.bank.loans.find(l=>l.id===options.loanId&&l.bankId===targetId&&!['paid','written-off'].includes(l.status));if(!loan)return city.fail('Escolha uma dívida ativa deste banco.');
      const amount=loan.remaining+loan.interest;loan.remaining=0;loan.interest=0;loan.status='paid';loan.divineReliefAt=city.minute;record.cost=amount;record.affected=1;record.loanId=loan.id;record.description=`Dívida #${loan.id} de ${city.accountName(loan.clientId)} perdoada; ${`R$ ${(amount/100).toFixed(2)}`} deixaram de ser cobrados.`;
    }else if(kind==='divineConvocation'){
      const hall=city.politics.council.getChamber().hall();if(!hall)return city.fail('A Câmara ainda não tem plenário construído.');let routed=0;
      for(const person of city.politics.council.people()){if(!person||person.deliveryId||person.cleaningJobId)continue;if(city.urgentNeed(person))continue;const path=city.findPath(person.entity,hall.door);if(path===null)continue;person.task='council-session';person.targetId=hall.id;person.councilSession={buildingId:hall.id,startedAt:city.minute,observerConvocation:true};person.path=path;person.action='Convocado pelo observador para o plenário';routed++;}
      record.affected=routed;record.buildingId=hall.id;record.description=`${routed} vereadores iniciaram imediatamente o deslocamento para o plenário.`;
    }else if(kind==='researchOrder'){
      ensureExternalAccount(city,'observer-funding','Patrocínio externo de intervenções');const study=p.getResearch().commissionService('observer-funding',options.service||'public-priorities',options.subjectId??null,targetId);
      if(!study)return false;record.studyId=study.id;record.cost=study.funded;record.buildingId=study.instituteId;record.description=`Pesquisa #${study.id} contratada; entrevistas e análise serão realizadas pela equipe do instituto.`;
    }else if(kind==='employmentOrder'){
      const b=city.building(targetId);if(!b||b.entity.destroyed)return city.fail('Escolha uma empresa existente.');
      if(!options.changes||!city.economy.configureEmployment(b.id,options.changes))return city.fail('Condições de contratação inválidas.');
      record.buildingId=b.id;record.description=`Condições das vagas de ${b.entity.properties.name} atualizadas; seleção e aprendizado seguem o ciclo normal.`;
    }else if(kind==='assemblyOrder'){
      if(!city.vehicles.configureAssembly(targetId,options.good,options.size??1))return false;
      record.buildingId=targetId;record.description='Próximo lote de veículos encomendado; produção depende de peças, funcionários e transporte.';
    }else if(kind==='serviceOrder'||kind==='removeArtwork'){
      const piece=kind==='removeArtwork'?city.justice.art.find(a=>a.id===targetId&&!a.entity.destroyed):null;
      const b=city.building(piece?.support?.buildingId??piece?.buildingId??(kind==='serviceOrder'?targetId:null));
      const service=options.service||'repair',payer='observer-funding';ensureExternalAccount(city,payer,'Patrocínio externo de intervenções');
      let job;
      if(kind==='removeArtwork'){
        if(!piece)return city.fail('Escolha uma obra de arte existente.');
        if(city.gigs.jobs.some(j=>j.kind==='art-removal'&&j.artId===piece.id&&['open','working'].includes(j.status)))return city.fail('A retirada desta obra já foi encomendada.');
        const site=b||city.buildings.find(x=>!x.entity.destroyed&&x.door);if(!site)return city.fail('Não há ponto de apoio para a equipe.');
        const support=piece.support?.unitId?piece.support:null,point=support?{...support.position,x:support.position?.x??piece.entity.x,y:support.position?.y??piece.entity.y,z:support.position?.z??(support.floor||0)*CITY_FLOOR_HEIGHT}:[[0,0],[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:Math.floor(piece.entity.x)+dx+.5,y:Math.floor(piece.entity.y)+dy+.5})).find(point=>city.walkable(Math.floor(point.x),Math.floor(point.y))&&city.findPath(site.door,point)!==null);if(!point)return city.fail('A equipe não encontrou acesso à obra.');
        job=city.gigs.reserveOrder(payer,site,{kind:'art-removal',scope:support?'interior-art':'outdoor',unitId:support?.unitId??null,point,fee:city.currency.price(2400),required:24});if(job){job.artId=piece.id;job.artworkSupport=support?{...support,cleaning:true}:null;}
      }else{
        if(!b||b.entity.destroyed)return city.fail('Escolha um prédio existente.');
        if(service==='repair')job=city.gigs.createRepairOrder(payer,b.id);
        else if(service==='garden')job=city.gigs.createGardenOrder(payer,b.id);
        else if(service==='cleaning')job=city.gigs.createCleaningOrder(payer,b.id,{scope:options.scope||'interior'});
        else if(service==='art')job=city.gigs.createArtworkOrder(payer,b.id,{...options.artwork,observerOrder:true});
        else return city.fail('Serviço desconhecido.');
      }
      if(!job)return city.fail('Encomenda indisponível: confira acesso, necessidade e serviços já contratados.');
      if(piece)record.artId=piece.id;job.interventionId=record.id;record.gigId=job.id;record.buildingId=job.buildingId;record.cost=job.fee;record.affected=1;record.description=`Serviço #${job.id} contratado. A equipe fará o trajeto e executará o trabalho; materiais e disponibilidade continuam necessários.`;
    }else if(kind==='cancelService'){
      const job=city.gigs.get(targetId);if(!job||!['open','working'].includes(job.status))return city.fail('Escolha um serviço pendente.');city.gigs.cancel(job,'Cancelamento ordenado pelo observador');record.gigId=job.id;record.description=`Serviço #${job.id} cancelado pelo fluxo normal de reembolso.`;
    }else if(kind==='prioritizeWork'){
      const project=city.development.projects.find(x=>x.id===targetId&&!x.cancelled&&x.status!=='completed');if(!project)return city.fail('Escolha uma obra em andamento.');project.priority=options.priority===10?10:100;record.projectId=project.id;record.description=`Prioridade da obra #${project.id}: ${project.priority}. Materiais, transporte e trabalho continuam necessários.`;
    }else if(kind==='divineGovernment'){
      const type=options.type,payload=options.payload||{},council=city.politics.council;
      if(type==='publicWork'||type==='build'&&!['townhall','mint','council_chamber'].includes(payload.buildingType)){
        const project=city.politics.startPublicWork(payload.buildingType,payload.crop||'milho',{observer:true});if(!project)return false;
        record.projectId=project.id;record.buildingId=project.buildingId??null;record.affected=1;record.description=`Obra pública contratada imediatamente: ${city.buildingTypes[payload.buildingType]?.label||payload.buildingType} (projeto #${project.id}).`;
      }else if(type==='veto'){
        if(!city.politics.vetoBill(payload.billId))return false;
        record.billId=payload.billId;record.affected=1;record.description=`Veto do prefeito ao projeto #${payload.billId} registrado imediatamente.`;
      }else if(type==='releasePrisoner'){
        const caseRecord=city.justice.cases.find(r=>r.id===payload.caseId),person=city.society.citizen(payload.targetId??caseRecord?.investigation?.suspectId);
        if(!caseRecord||!person?.custody||person.custody.caseId!==caseRecord.id)return city.fail('A pessoa não está presa neste caso.');
        if(caseRecord.sentence){caseRecord.sentence.suspendedAt=city.minute;caseRecord.sentence.executionStatus='released-by-player';}caseRecord.playerReleaseAt=city.minute;caseRecord.playerReleaseInterventionId=record.id;
        if(!city.justice.release(person,'Libertação direta do jogador'))return city.fail('Não foi possível libertar a pessoa agora.');record.affected=1;record.targetId=person.id;record.caseId=caseRecord.id;record.description=`${person.entity.properties.name} foi libertado imediatamente por ordem direta do jogador.`;
      }else if(type==='partyLimit'){
        if(!Number.isSafeInteger(payload.value)||payload.value<4||payload.value>1000)return city.fail('O limite de partidos deve ser um número inteiro entre 4 e 1.000.');const previous=city.politics.policy.partyLimit;city.politics.policy.partyLimit=payload.value;city.politics.policy.mayorCandidateLimit=Math.min(city.politics.policy.mayorCandidateLimit??Math.floor(payload.value/2),Math.floor(payload.value/2));record.affected=1;record.description=`Limite de partidos alterado imediatamente de ${previous} para ${payload.value}; o teto de candidaturas foi ajustado ao novo limite.`;
      }else{
        const supported=new Set(['tax','businessTax','salesTax','tradeTax','policeStaffing','minimumWage','reelectionLimit','termDays','campaignDays','pollMinRate','pollMaxRate','inflation','welfare','roads','councilSeats','councilRate','councilBudget','mayorBudget','partyFund','worksBudget','worksTransfer','cleanRecord','parliamentaryImmunity','penalCode','arrestAuthorization','entrepreneurCandidates','nationalize','privatize','suspend','confidence','build','convict','impeach','economicPolicy','transportPolicy','mayorElectionSystem','secretaryElection','substanceLaw','prejudiceLaw','popularJurySize','dailyPrivatizationLimit','mayorCandidateLimit']);
        if(!supported.has(type)||!council)return city.fail('Comando de governo inválido.');
        if(['worksBudget','worksTransfer'].includes(type)){if(!Number.isSafeInteger(payload.value)||payload.value<0)return city.fail('Valor de orçamento inválido.');const amount=type==='worksTransfer'?payload.value:Math.max(0,payload.value-p.ensureWorksBudget());if(!fund('treasury',amount+city.welfare.conditions().reserve))return false;}
        const bill={id:`observer:${record.id}`,type,payload:{...payload},title:`Ordem direta: ${type}`,authorId:city.economy.mayorId,proposedAt:city.minute,status:'approved',attempts:0,result:null};
        council.execute(bill);
        if(bill.status==='dismissed'||bill.status==='executing'&&!bill.projectId)return city.fail(bill.result||city.lastError||'A ordem não pôde ser aplicada.');
        record.billType=type;record.projectId=bill.projectId??null;record.caseId=payload.caseId??null;record.buildingId=payload.buildingId??bill.buildingId??null;record.affected=1;
        record.description=bill.projectId?`Ordem direta aplicada. Obra #${bill.projectId} contratada imediatamente e em execução.`:`Ordem direta aplicada: ${bill.result||type} (sem votação ou aprovação da Câmara).`;
      }
    }else if(kind==='ride'){
      const system=city.vehicles,v=system.units.get(targetId);if(!v?.active||v.scrapped||v.driverId||v.condition<=15)return city.fail('Escolha um equipamento conservado e sem usuário ocupado.');
      const owner=city.accounts.get(v.ownerAccountId)?.entity?.properties.citizen,company=city.buildings.find(b=>b.accountId===v.ownerAccountId),people=owner?[owner]:(company?.workers||[]).map(id=>city.society.citizen(id)),rider=people.find(c=>c&&!c.entity.destroyed&&city.society.isAdult(c)&&!c.mobilityTrip&&!c.deliveryId&&!c.cleaningJobId&&!c.researchAssignment&&!c.campaign&&!c.conversation&&!city.urgentNeed(c));
      if(!rider)return city.fail('Não há usuário disponível ligado ao proprietário.');
      const entry=city.findPath(rider.entity,v),destination=p.campaigns.streetPoints(96,v).sort((a,b)=>Math.hypot(b.x-v.x,b.y-v.y)-Math.hypot(a.x-v.x,a.y-v.y)).find(point=>Math.hypot(point.x-v.x,point.y-v.y)>2&&city.findPath(v,point)!==null);
      if(entry===null||!destination)return city.fail('Não há caminho acessível para o passeio.');
      v.driverId=rider.id;rider.mobilityTrip={kind:'cycle',vehicleId:v.id,goal:destination,stage:'boarding'};rider.path=entry;rider.indoorLocation=null;rider.task=null;record.vehicleId=v.id;record.affected=1;record.description=`Passeio com ${VEHICLE_SPECS[v.good].label.toLowerCase()} solicitado para ${rider.entity.properties.name}.`;
    }

    this.nextId++;this.cooldowns.set(key,city.minute);record.eventId=city.log(`Intervenção do observador: ${record.description}`,'government',live&&(['opinion','campaign'].includes(spec.group)||['divineCampaign','divineSmear','importVehicle'].includes(kind))?[c.id]:[],{kind:'observer-intervention',interventionId:record.id,action:kind,targetId,gigId:record.gigId,projectId:record.projectId,studyId:record.studyId,loanId:record.loanId,artId:record.artId,buildingId:record.buildingId,vehicleId:record.vehicleId,corruptionCaseId:record.caseId,amount:record.cost,affected:record.affected,truth:record.truth}).id;this.records.push(record);if(this.records.length>200)this.records.shift();city.lastError='';return record;
  }
  perform(kind,targetId=null,options={}){return this.dispatch(kind,targetId,options);}
}
