import {SKILLS} from './city_economy.js';
import {FAMILY_STARTS,FAMILY_BUSINESSES,familyMembers,familyBusinesses,familyOffers} from './city_family_campaign.js';
import {formatMoney as money} from './city_ui_format.js';

const date = minute => `Dia ${Math.floor(minute/1440)+1} · ${String(Math.floor(minute%1440/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
const label = b => b.entity.properties.name;
export function renderFamilyCampaign(ui,p) {
  const city=ui.city,state=city.familyCampaign;
  const act=(action,options={})=>{
    const result=city.familyAction(action,options);
    ui.notice=result?'Ordem enviada. A execução respeita caixa, trabalho e deslocamentos.':city.lastError||'Não foi possível concluir a ação.';
    return result;
  };
  if(!state){
    p.heading('UMA FAMÍLIA, UM LUGAR NA CIDADE');
    p.note('Trabalhe, abra negócios, cumpra contratos e construa seu patrimônio. Os demais cidadãos continuam decidindo por conta própria.');
    p.heading('1 · ESCOLHA SUA ORIGEM');
    const profile=ui.familyProfile||'artisan';
    p.buttons(Object.entries(FAMILY_STARTS).map(([id,s])=>({label:s.label,selected:profile===id,click:()=>{ui.familyProfile=id;}})));
    p.note(FAMILY_STARTS[profile].description);
    p.note('O capital inicial sai do tesouro uma única vez. Construções, estoques e salários continuam sendo pagos.');
    p.heading('2 · ESCOLHA QUEM VOCÊ VAI CONDUZIR');
    const candidates=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)&&!city.politics.officeHolder(c)&&ui.matches(label(c)));
    const page=Math.min(ui.familyPeoplePage||0,Math.max(0,Math.ceil(candidates.length/8)-1));
    if(candidates.length>8)p.buttons([{label:'ANTERIORES',click:()=>{ui.familyPeoplePage=Math.max(0,page-1);}},{label:'PRÓXIMOS',click:()=>{ui.familyPeoplePage=page+1;}}]);
    for(const c of candidates.slice(page*8,page*8+8)){
      const skill=Object.entries(c.skills).sort((a,b)=>b[1]-a[1])[0];
      p.record(label(c),`${city.society.age(c)} anos · ${money(c.balance)} · ${c.jobId?'empregado':'sem emprego'} · ${SKILLS[skill[0]]||skill[0]} ${Math.round(skill[1])}`,()=>{ui.familyCandidateId=c.id;},ui.familyCandidateId===c.id);
      if(ui.familyCandidateId===c.id)p.button('COMEÇAR COM ESTA PESSOA',()=>act('start',{citizenId:c.id,profile}));
    }
    p.heading('OBJETIVO DA CAMPANHA');
    p.note('Cumpra três contratos. Mantenha toda a família abrigada e alimentada, uma empresa com reserva de folha e R$ 300 pessoais por um dia. Depois, continue expandindo e prepare a sucessão.');
    return;
  }
  const members=familyMembers(city),companies=familyBusinesses(city),leader=city.society.citizen(state.leaderId);
  const member=members.find(c=>c.id===ui.familyMemberId&&city.society.isAdult(c))||members.find(c=>c.id===state.leaderId)||members.find(c=>city.society.isAdult(c));
  const citizenId=member?.id;
  p.heading(`FAMÍLIA DE ${leader?label(leader):'SEM LIDERANÇA'}`);
  p.kv('Geração / origem',`${state.generation} · ${FAMILY_STARTS[state.profile].label}`);
  const progress=state.progress||{};
  p.status(state.wonAt!=null?'BAIRRO CONQUISTADO':state.status==='ended'?'FIM DA LINHAGEM':'CONSTRUA SEU LUGAR',state.wonAt!=null?'Campanha vencida. A cidade e o legado continuam.':state.status==='ended'?'Nenhum familiar sobreviveu. Crie outra cidade no menu principal.':`${progress.completed||0}/3 contratos · estabilidade ${Math.floor(progress.stableMinutes||0)}/1440 min`);
  const view=ui.familyView||'agenda';
  p.links([['agenda','AGENDA'],['family','FAMÍLIA'],['business','NEGÓCIOS'],['contracts','CONTRATOS'],['build','CONSTRUIR'],['politics','BAIRRO']].map(([id,text])=>({label:text,selected:view===id,click:()=>{ui.familyView=id;ui.resetScroll();}})));
  if(state.status==='ended')return;
  if(view==='agenda'){
    p.heading('PRÓXIMA DECISÃO');
    if(!companies.length){
      p.note('Comece por uma lavoura de milho: dispensa construção e pode abastecer contratos municipais. Padaria e transporte exigem mais capital.');
      p.button('ABRIR PRIMEIRO NEGÓCIO',()=>{ui.familyView='business';});
      if(member&&!member.jobId)p.button('PROCURAR EMPREGO',()=>{ui.familyView='family';});
    }else if(!state.contracts.some(r=>r.status==='active')){
      p.note('Uma empresa precisa vender. Compare os pedidos e aceite somente o que conseguir entregar em três dias.');
      p.button('ESCOLHER UM CONTRATO',()=>{ui.familyView='contracts';});
    }else{
      p.note('Produza ou compre o produto contratado. Despache o estoque; o pagamento chega após a entrega física.');
      p.button('ACOMPANHAR ENTREGAS',()=>{ui.familyView='contracts';});
    }
    p.heading('CONDIÇÕES PARA CONSOLIDAR O BAIRRO');
    for(const [text,met] of [['Três contratos concluídos',(progress.completed||0)>=3],['Todos os familiares com moradia',progress.housed],['Alimentação e saúde acima de 40',progress.healthy],['Empresa com um dia de folha ou R$ 10 de reserva',progress.solvent],['Reserva pessoal familiar de R$ 300',(progress.liquid||0)>=city.currency.price(30000)]])p.kv(met?'CUMPRIDO':'PENDENTE',text);
    p.note('Mantenha todas as condições por 24 horas da simulação. Perder uma condição reinicia a contagem. Falência e derrota eleitoral permitem recuperação.');
    p.heading('COMPROMISSOS');
    for(const r of state.contracts.filter(r=>r.status==='active'))p.record(`Contrato #${r.id} · ${city.economy.goods[r.good].label}`,`${r.delivered}/${r.quantity} entregues · vence ${date(r.deadline)}`,()=>{ui.familyView='contracts';});
    for(const project of city.development.projects.filter(r=>members.some(c=>c.accountId===r.accountId)&&r.status!=='completed'&&!r.cancelled))p.record(project.name,`${project.status} · pedras ${project.inventory.pedra||0}/${project.stone} · trabalho ${Math.floor(project.labor)}/${project.requiredLabor}`,()=>ui.host?.openContract(project.id));
    for(const c of members)for(const a of (c.career?.applications||[]).filter(a=>a.status==='análise'))p.note(`${label(c)}: entrevista em ${a.company}, ${date(a.interviewAt)}.`);
    p.heading('HISTÓRIA DA FAMÍLIA');
    for(const event of [...state.journal].reverse().slice(0,8))p.note(`${date(event.minute)} · ${event.text}`);
    return;
  }
  p.buttons(members.filter(c=>city.society.isAdult(c)).map(c=>({label:label(c),selected:c.id===citizenId,click:()=>{ui.familyMemberId=c.id;}})));
  if(!member){p.note('Os sobreviventes ainda são menores. Aguarde a maioridade para novas decisões.');return;}
  p.kv('Familiar escolhido / saldo',`${label(member)} · ${money(member.balance)}`);
  if(view==='family'){
    for(const c of members)p.record(label(c),`${city.society.age(c)} anos · ${money(c.balance)} · alimentação ${Math.round(c.needs.food)} · saúde ${Math.round(c.needs.health)} · ${c.homeUnitId?'abrigado':'sem moradia'}`,()=>ui.openCitizen(c.id));
    p.button('DESIGNAR COMO SUCESSOR',()=>act('heir',{citizenId}));
    p.note(`Sucessor preferido: ${city.society.citizen(state.heirId)?.entity.properties.name||'adulto sobrevivente da família'}. Heranças seguem os vínculos e as regras da cidade.`);
    if(member.jobId){
      p.record('EMPREGO',city.building(member.jobId)?.entity.properties.name||'Empresa indisponível',()=>ui.openBuilding(member.jobId));
      p.button('DEIXAR EMPREGO',()=>act('leaveJob',{citizenId}));
    }else{
      p.heading('VAGAS · ENTREVISTA E TRABALHO PRESENCIAIS');
      for(const b of city.economy.businesses.filter(b=>b.active&&!b.entity.destroyed&&b.workers.length<b.jobs).slice(0,8))p.button(`${label(b)} · ${money(b.wage*60)}/hora`,()=>act('apply',{citizenId,buildingId:b.id}));
    }
    for(const application of [...(member.career?.applications||[])].reverse().slice(0,4))p.note(`${application.company}: ${application.status} · ${application.reason}`);
    p.heading('MORADIAS DISPONÍVEIS');
    const homes=[...city.housing.homes.values()].filter(h=>{const units=city.housing.units(h);return !city.housing.isSocial(h)&&units.length&&units.every(u=>!u.tenantId&&(u.forRent||u.forSale||u.ownerId===member.accountId));}).slice(0,8);
    for(const home of homes){
      p.note(`${city.building(home.buildingId)?.entity.properties.name||home.id} · compra ${money(city.housing.price(home))} · aluguel ${money(city.housing.rent(home,member))}/dia`);
      p.buttons([{label:'ALUGAR / OCUPAR',click:()=>act('home',{citizenId,homeId:home.id})},{label:'COMPRAR E MORAR',click:()=>act('home',{citizenId,homeId:home.id,buy:true})}]);
    }
    if(!homes.length)p.note('Nenhuma oferta livre. Construa moradias na aba Construir; abrigos públicos continuam automáticos.');
    return;
  }
  if(view==='business'){
    p.heading('ABRIR EMPRESA');
    p.note('A abertura compra instalações ou contrata a obra pelo fluxo normal. Escolha abaixo a cultura da lavoura. O fundador trabalha no próprio negócio.');
    const crop=ui.familyCrop||'milho';
    p.buttons(['milho','trigo','maca'].map(good=>({label:city.economy.goods[good].label,selected:crop===good,click:()=>{ui.familyCrop=good;}})));
    p.buttons(FAMILY_BUSINESSES.map(type=>({label:city.buildingTypes[type].label,click:()=>act('found',{citizenId,type,crop})})));
    for(const b of companies){
      p.heading(label(b));
      p.kv('Caixa / equipe',`${money(b.balance)} · ${b.workers.length}/${b.jobs}`);
      p.kv('Salário por hora',money(b.wage*60));
      const stock=Object.entries(b.inventory).filter(([,n])=>n>0).slice(0,8);
      p.note(stock.length?stock.map(([good,n])=>`${city.economy.goods[good].label}: ${n}`).join(' · '):'Estoque vazio. Aguarde trabalho e abastecimento.');
      p.buttons([{label:'FICHA',click:()=>ui.openBuilding(b.id)},{label:'APORTAR R$ 100',click:()=>act('fund',{citizenId,buildingId:b.id,amount:city.currency.price(10000)})},{label:'SALÁRIO +10%',click:()=>act('employment',{citizenId,buildingId:b.id,baseWage:b.baseWage*1.1})},{label:'ACEITAR APRENDIZES',click:()=>act('employment',{citizenId,buildingId:b.id,allowTraining:true})}]);
      ui.section(p,`family-suppliers:${b.id}`,'Comprar estoque e insumos',()=>{
        const wanted=new Set([...Object.keys(b.inputDemand||{}),...(b.type==='market'?['milho','trigo','maca','pao']:[])]);
        let count=0;
        for(const supplier of city.economy.businesses.filter(s=>s.active&&!s.entity.destroyed&&s.id!==b.id))for(const good of wanted){
          if(count>=10||(supplier.inventory[good]||0)<1)continue;count++;
          const quantity=Math.min(6,supplier.inventory[good]);
          p.button(`${label(supplier)}: ${quantity} ${city.economy.goods[good].label} · ${money(city.economy.goods[good].price*quantity)} + frete`,()=>act('buyStock',{citizenId,buildingId:b.id,sellerId:supplier.id,good,quantity}));
        }
        if(!count)p.note('Nenhum fornecedor tem estoque destes produtos. Acompanhe Produção para localizar o gargalo.');
      });
    }
    return;
  }
  if(view==='contracts'){
    p.note('Pedidos pagam 15% acima do preço corrente na aceitação. O cliente reserva compra e frete. Prazo: três dias; até três contratos ativos. Cancelar ou atrasar reduz reputação.');
    for(const r of [...state.contracts].reverse().slice(0,12)){
      const names={active:'EM ANDAMENTO',completed:'CUMPRIDO',failed:'ATRASADO',cancelled:'CANCELADO'};
      p.heading(`#${r.id} · ${names[r.status]} · ${city.economy.goods[r.good].label}`);
      p.kv('Cliente',city.building(r.buyerId)?.entity.properties.name||'Indisponível');
      p.kv('Entrega / prazo',`${r.delivered}/${r.quantity} · ${date(r.deadline)}`);
      p.kv('Pagamento contratado',`${money(r.quantity*r.unitPrice)} · recebido ${money(r.revenue)}`);
      if(r.status==='active'){
        const shipments=city.logistics.shipments.filter(s=>s.familyContractId===r.id&&!['delivered','cancelled'].includes(s.status));
        for(const s of shipments)p.note(`Carga #${s.id}: ${s.quantity} unidades · ${s.status}${s.driverId?' · transportador a caminho':' · aguardando transportador'}`);
        p.buttons([{label:'DESPACHAR ESTOQUE',click:()=>act('dispatch',{citizenId,contractId:r.id})},{label:'CANCELAR CONTRATO',click:()=>act('cancel',{citizenId,contractId:r.id})}]);
      }else p.note(r.reason);
    }
    p.heading('ESCOLHA A EMPRESA FORNECEDORA');
    const selected=companies.find(b=>b.id===ui.familyCompanyId)||companies[0];
    p.buttons(companies.map(b=>({label:label(b),selected:selected?.id===b.id,click:()=>{ui.familyCompanyId=b.id;}})));
    if(!selected){p.note('Abra uma empresa antes de aceitar pedidos.');return;}
    p.heading('PEDIDOS DISPONÍVEIS');
    const offers=familyOffers(city);if(!offers.length)p.note('Sem pedidos financiados neste momento. Novas ofertas aparecem conforme o estoque, a demanda e o caixa dos clientes.');
    for(const offer of offers){
      p.note(`${offer.label} · ${city.building(offer.buyerId)?.entity.properties.name} · ${offer.quantity} ${city.economy.goods[offer.good].label} · ${money(offer.quantity*offer.unitPrice)}`);
      p.button('ACEITAR · ENTREGAR EM TRÊS DIAS',()=>act('accept',{citizenId,buildingId:selected.id,offerId:offer.id}));
    }
    return;
  }
  if(view==='build'){
    p.note('Compre um lote e escolha o uso. Obras usam 2×2 células; moradias têm dois andares. Materiais, fretes e construtores são reais. Lavouras dispensam edificação.');
    const crop=ui.familyCrop||'milho';
    p.buttons(['milho','trigo','maca'].map(good=>({label:city.economy.goods[good].label,selected:crop===good,click:()=>{ui.familyCrop=good;}})));
    const plots=city.development.plots.filter(l=>l.ownerId===member.accountId&&!l.buildingId&&!l.projectId);
    for(const plot of plots){
      p.heading(`SEU TERRENO ${plot.id} · ${plot.width}×${plot.depth}`);
      p.button('LOCALIZAR',()=>ui.camera(plot.x,plot.y));
      p.buttons(['farm','bakery','market','residential'].map(type=>({label:city.buildingTypes[type].label,click:()=>act('build',{citizenId,plotId:plot.id,type,crop})})));
    }
    p.heading('TERRENOS À VENDA');
    const lots=city.development.plots.filter(l=>l.forSale&&!l.buildingId&&!l.projectId&&l.ownerId!==member.accountId&&l.width>=2&&l.depth>=2).sort((a,b)=>a.price-b.price).slice(0,10);
    for(const plot of lots){p.note(`${plot.id} · ${plot.width}×${plot.depth} · ${plot.type||'urbano'} · ${money(plot.price)}`);p.buttons([{label:'LOCALIZAR',click:()=>ui.camera(plot.x,plot.y)},{label:'COMPRAR',click:()=>act('buyPlot',{citizenId,plotId:plot.id})}]);}
    if(!lots.length)p.note('Nenhum lote disponível. O município precisa cadastrar novos terrenos acessíveis.');
    p.windowLink('ACOMPANHAR OBRAS E MATERIAIS',()=>ui.openPanel({tab:'land',views:{land:'projects'}}));
    return;
  }
  if(view==='politics'){
    p.heading('VIZINHOS, CONCORRENTES E PODER');
    p.kv('Reputação comercial',Math.round(city.reputation.score(member,'commerce')));
    const types=new Set(companies.map(b=>b.type));
    const rivals=city.economy.businesses.filter(b=>b.active&&!b.entity.destroyed&&!companies.includes(b)&&types.has(b.type)).slice(0,6);
    for(const b of rivals)p.record(label(b),`${city.society.citizen(b.ownerId)?.entity.properties.name||'Empresa municipal'} · ${b.workers.length} trabalhadores · ${money(b.balance)}`,()=>ui.openBuilding(b.id));
    p.button(member.playerPoliticalAmbition?'NÃO BUSCAR NOVOS CARGOS':'ENTRAR NA DISPUTA POLÍTICA',()=>act('politics',{citizenId,enabled:!member.playerPoliticalAmbition}));
    p.note('Assumir um cargo pode exigir deixar a gestão empresarial, conforme as regras da cidade. A candidatura depende de partido, elegibilidade e escolha eleitoral.');
    p.note('Clientes e rivais são cidadãos reais. Emprego, comércio, vínculos e reputação influenciam a vida política. A eleição e a escolha partidária continuam autônomas.');
    const councilor=city.politics.council.members.some(m=>m.citizenId===citizenId);
    if(councilor){
      p.heading('SEU MANDATO NA CÂMARA');
      p.buttons([{label:'PROPOR PADARIA PÚBLICA',click:()=>act('bill',{citizenId,type:'build',payload:{buildingType:'bakery'}})},{label:'PROPOR LAVOURA PÚBLICA',click:()=>act('bill',{citizenId,type:'build',payload:{buildingType:'farm',crop:'milho'}})}]);
      p.note('A Câmara vota os projetos. Seu mandato não permite retirar dinheiro público nem construir sem orçamento.');
    }
    p.windowLink('GOVERNO, ELEIÇÕES E PROJETOS',()=>ui.openPanel({tab:'government',views:{government:'elections'},politicsTab:'overview'}));
  }
}
