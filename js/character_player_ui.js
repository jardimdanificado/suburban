import {controlledCitizen} from './character_game.js';
import {ownsBusiness,ownsProperty,playerGoods,playerRecipes,playerSalePrice,PLAYER_FURNITURE} from './character_player_actions.js';
import {colorName} from './city_colors.js';
import {PRIVATE_TYPES} from './city_economy.js';
import {equityShares} from './city_equity.js';
import {demolitionIssue} from './city_player_property.js';
import {formatMoney as money} from './city_ui_format.js';

const label=b=>b?.entity?.properties?.name||b?.name||String(b?.id??'');
const alive=b=>b&&!b.entity?.destroyed;
const tabs=[['trade','Comércio'],['items','Itens'],['property','Imóveis'],['business','Empresas'],['bank','Banco'],['vehicles','Veículos'],['social','Relações'],['work','Trabalho'],['explore','Explorar'],['politics','Política']];
function choose(p,state,key,title,rows,current,onChange=()=>{}){
  p.note(title);
  if(!rows.length){p.note('Nenhuma opção disponível.');return null;}
  const selected=rows.find(r=>String(r.id)===String(current))||rows[0];
  state.selectControl(p,`player:${key}`,rows.map(r=>[r.id,r.label]),selected.id,value=>{state.playerForm[key]=value;onChange(value);});
  return selected.record??selected.id;
}
function select(p,state,key,title,records,describe=label){return choose(p,state,key,title,records.map(record=>({id:record.id,label:describe(record),record})),state.playerForm[key]);}
function number(p,state,key,title,initial,{min=1,max=1000000000,step=1}={}){
  p.note(title);state.dynamicSelects??={};const id=`player:${key}`;let input=state.dynamicSelects[id];
  if(!input){input=document.createElement('input');input.type='number';input.value=String(initial);input.setAttribute('aria-label',title);input.addEventListener('pointerdown',()=>state.host?.manager.raise(state.windowId));state.element.append(input);state.dynamicSelects[id]=input;}
  input.min=String(min);input.max=String(max);input.step=String(step);
  if(p.y>=p.top&&p.y+20<=p.bottom)state.inputAt(input,p.x,p.y,p.w);p.space(26);
  return Number(input.value);
}
function goodChoice(p,state,key,city,goods){return choose(p,state,key,'Produto',goods.map(g=>({id:g,label:city.economy.goods[g]?.label||g})),state.playerForm[key]);}
function confirm(p,state,key,text,run){
  if(state.playerConfirm===key){p.note(text);p.buttons([{label:'Confirmar',click:()=>{state.playerConfirm=null;run();}},{label:'Cancelar',click:()=>{state.playerConfirm=null;}}]);}
  else p.button(text,()=>{state.playerConfirm=key;});
}
function status(p,city,c,act){
  const intent=city.characterGame.intent;
  p.kv('Saldo pessoal',money(c.balance));
  if(intent)p.note(c.action||'Ação em andamento.');
  if(intent?.kind==='player-craft')p.kv('Progresso',`${intent.progress||0} minutos de trabalho`);
  if(intent)p.button('Interromper atividade',()=>act('stop'));
}

/** Native fields, shared window lifecycle and ID-based commands; no management mutation in the viewer. */
export function drawPlayerActions(game,p,state){
  const city=game.getCity(),c=controlledCitizen(city);if(!c||c.entity.destroyed)return;
  state.playerForm??={tab:'trade'};const form=state.playerForm,act=(action,options={})=>game.act(action,options);
  p.links(tabs.map(([id,title])=>({label:title,selected:form.tab===id,click:()=>{form.tab=id;state.playerConfirm=null;state.resetScroll();}})));
  status(p,city,c,act);
  const buildings=city.buildings.filter(alive),own=buildings.filter(b=>ownsBusiness(c,b)),goods=playerGoods(city);
  const types=[...new Set([...PRIVATE_TYPES,'residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing'])].filter(type=>city.buildingTypes[type]);
  const typeChoice=(key='type')=>choose(p,state,key,'Tipo de empreendimento',types.map(id=>({id,label:city.buildingTypes[id].label})),form[key]);
  const cropChoice=()=>choose(p,state,'crop','Cultivo',Object.entries(city.economy.crops).map(([id,s])=>({id,label:s.label})),form.crop);
  if(form.tab==='trade'){
    p.heading('Comprar mercadorias');p.note('A compra só acontece ao chegar ao estabelecimento. O preço e o estoque são conferidos novamente.');
    const seller=select(p,state,'seller','Estabelecimento',buildings.filter(b=>b.active&&goods.some(g=>b.inventory?.[g]>0)));
    if(seller){
      const good=goodChoice(p,state,'buyGood',city,goods.filter(g=>seller.inventory[g]>0));
      const n=number(p,state,'tradeQuantity','Quantidade',1,{max:999});
      if(good){p.kv('Estoque',seller.inventory[good]);p.kv('Preço por unidade',money(playerSalePrice(city,seller,good)));p.kv('Total',money(playerSalePrice(city,seller,good)*n));p.button('Ir e comprar',()=>act('buy-good',{buildingId:seller.id,good,quantity:n}));}
    }
    p.heading('Vender mercadorias');
    const good=goodChoice(p,state,'sellGood',city,goods.filter(g=>c.inventory[g]>0));
    if(good){
      const buyer=select(p,state,'buyer','Comprador',buildings.filter(b=>b.active&&city.economy.accepts(b,good)));
      const n=number(p,state,'sellQuantity','Quantidade para vender',1,{max:999});
      if(buyer){p.kv('Valor por unidade',money(city.economy.goods[good].price));p.button('Ir e vender',()=>act('sell-good',{buildingId:buyer.id,good,quantity:n}));}
    }
    p.heading('Roupas');
    const shop=select(p,state,'clothingShop','Loja de roupas',buildings.filter(b=>b.active&&b.garments?.length&&b.inventory.roupas>0));
    if(shop){const garment=choose(p,state,'garment','Peça',shop.garments.map((g,i)=>({id:g.garmentId??i,label:`${g.piece} · ${colorName(g.color)}${g.patternFlag?` · ${g.patternFlag.emblems?.length||0} símbolos`:''} · ${g.brandName||'Sem marca'} · ${Math.round(g.condition)}%`,record:g})),form.garment);if(garment){p.kv('Preço',money(city.economy.goods.roupas.price));p.button('Ir e comprar esta peça',()=>act('buy-clothes',{buildingId:shop.id,garmentId:garment.garmentId}));}}
    return;
  }
  if(form.tab==='items'){
    p.heading('Mochila e equipamentos');
    const good=goodChoice(p,state,'itemGood',city,goods.filter(g=>c.inventory[g]>0));
    const n=number(p,state,'itemQuantity','Quantidade de itens',1,{max:999});
    if(good){
      p.kv('Na mochila',c.inventory[good]);p.button('Deixar no chão',()=>act('drop-good',{good,quantity:n}));
      if(['cesta','carrinho','porrete','barra_ferro','faca','garrucha'].includes(good))p.button('Equipar',()=>act('equip',{good}));
      const person=select(p,state,'recipient','Presentear pessoa próxima',game.targets().filter(t=>t.kind==='person').map(t=>city.society.citizen(t.id)));
      if(person)p.button('Entregar presente',()=>act('give-good',{good,quantity:n,citizenId:person.id}));
    }
    if(c.equipment?.weapon)p.button('Guardar arma equipada',()=>act('unequip',{good:c.equipment.weapon.good}));
    for(const good of ['cesta','carrinho'])if(c.equipment?.[good])p.button(`Guardar ${city.economy.goods[good].label}`,()=>act('unequip',{good}));
    p.heading('Objetos no chão');
    const item=select(p,state,'groundItem','Objeto próximo',(city.playerGroundItems||[]).filter(e=>!e.destroyed&&Math.hypot(e.x-c.entity.x,e.y-c.entity.y)<=1.8),e=>e.properties.name);
    if(item)p.button('Recolher objeto',()=>act('pickup-good',{entityId:item.id,quantity:n}));
    p.heading('Guarda-roupa');
    for(const [index,g]of (c.wardrobe||[]).entries())if(!g.discarded)p.button(`Vestir ${g.piece} · ${g.brandName||'Sem marca'}`,()=>act('wear',{index}));
    p.heading('Depósito próprio');
    const b=select(p,state,'storage','Imóvel ou empresa',buildings.filter(b=>ownsProperty(city,c,b)||ownsBusiness(c,b)));
    if(b){
      if(good)p.button('Ir e guardar itens',()=>act('store-good',{buildingId:b.id,good,quantity:n}));
      const stored=goodChoice(p,state,'storedGood',city,goods.filter(g=>b.inventory[g]>0));
      if(stored){p.kv('No depósito',b.inventory[stored]);p.button('Ir e retirar itens',()=>act('take-good',{buildingId:b.id,good:stored,quantity:n}));}
    }
    return;
  }
  if(form.tab==='property'){
    p.heading('Terrenos e construção');
    const plot=select(p,state,'plot','Terreno',city.development.plots.filter(p=>p.forSale||p.ownerId===c.accountId),p=>`Terreno ${p.id} · ${p.width} × ${p.depth} · ${p.ownerId===c.accountId?'Seu':money(p.price)}${p.buildingId?' · ocupado':''}`);
    if(plot){
      if(plot.ownerId!==c.accountId)p.button(`Comprar terreno · ${money(plot.price)}`,()=>act('buy-plot',{plotId:plot.id}));
      else if(!plot.buildingId&&!plot.projectId){
        const type=typeChoice('buildType'),crop=type==='farm'?cropChoice():null;
        const width=number(p,state,'width','Largura em células',Math.min(4,plot.width),{max:8}),depth=number(p,state,'depth','Profundidade em células',Math.min(4,plot.depth),{max:8}),floors=number(p,state,'floors','Andares',1,{max:8});
        p.note('O contrato reserva o pagamento da construtora. Pedra, transporte e trabalho continuam necessários.');
        p.button('Contratar construção',()=>act('build',{plotId:plot.id,type,crop,width,depth,floors}));
      }
    }
    p.heading('Seus imóveis');
    const b=select(p,state,'property','Imóvel',buildings.filter(b=>ownsProperty(city,c,b)||ownsBusiness(c,b)));
    if(b){
      p.kv('Conservação',`${Math.round(b.condition||0)}%`);p.kv('Andares atuais',b.floors);
      const floors=number(p,state,'expandFloors','Andares adicionais',1,{max:8});
      p.buttons([{label:'Contratar ampliação',click:()=>act('expand',{buildingId:b.id,floors})},{label:'Contratar reforma',click:()=>act('repair',{buildingId:b.id})}]);
      const issue=demolitionIssue(city,c,b);if(issue)p.note(`Demolição: ${issue}`);
      else confirm(p,state,`demolish:${b.id}`,'Demolir imóvel sem recuperar materiais',()=>act('demolish',{buildingId:b.id,confirmed:true}));
    }
    p.heading('Moradias à venda');
    const home=select(p,state,'home','Moradia',[...city.housing.homes.values()].filter(h=>city.housing.units(h).length&&city.housing.units(h).every(u=>u.forSale&&u.ownerId!==c.accountId)),h=>`${label(city.building(h.buildingId))} · ${money(city.housing.price(h))}`);
    if(home)p.button('Ir e comprar moradia',()=>act('buy-home',{buildingId:home.buildingId,homeId:home.id}));
    p.heading('Mobiliar residência');
    const currentHome=city.housing.home(c),furnished=select(p,state,'furnitureBuilding','Imóvel para mobiliar',buildings.filter(b=>ownsProperty(city,c,b)||b.id===currentHome?.buildingId));
    if(furnished){
      const unit=select(p,state,'furnitureUnit','Cômodo',furnished.units.filter(u=>!['circulation','bathroom'].includes(u.roomType)&&(ownsProperty(city,c,furnished)||u.ownerId===c.accountId||currentHome&&city.housing.units(currentHome).includes(u))),u=>`${u.roomType} · andar ${u.z+1} · ${u.x}, ${u.y}`);
      const type=choose(p,state,'furnitureType','Móvel',Object.entries(PLAYER_FURNITURE).map(([id,s])=>({id,label:s.label})),form.furnitureType);
      p.note('Cada móvel adicional usa uma unidade de móveis da mochila.');
      if(unit){p.button('Ir e instalar móvel',()=>act('furnish',{buildingId:furnished.id,unitId:unit.id,type}));for(const f of unit.playerFurniture||[])p.button(`Retirar ${f.label}`,()=>act('unfurnish',{buildingId:furnished.id,unitId:unit.id,furnitureId:f.id}));}
    }
    return;
  }
  if(form.tab==='business'){
    p.heading('Abrir empresa');const type=typeChoice('businessType'),crop=type==='farm'?cropChoice():null;
    p.note('A abertura usa seu capital e procura instalações ou terreno. O cargo público pode impedir a administração privada.');
    p.button('Abrir empreendimento',()=>act('found-business',{type,crop}));
    p.heading('Administrar empresa');const b=select(p,state,'business','Sua empresa',own);
    if(b){
      if(form.managedBusinessId!==b.id){form.managedBusinessId=b.id;form.training=b.hiringPolicy?.allowTraining!==false;form.manualHiring=b.playerHiring===true;form.interviewLocation=b.hiringPolicy?.interviewLocation||'auto';}
      p.kv('Caixa da empresa',money(b.balance));p.kv('Equipe',`${b.workers.length}/${b.jobs}`);
      const amount=number(p,state,'fundAmount','Aporte em centavos',10000);p.button(`Aportar ${money(amount)}`,()=>act('fund-business',{buildingId:b.id,amount}));
      const wage=number(p,state,`wage:${b.id}`,'Salário base em centavos por minuto',b.baseWage??b.wage,{max:1000}),skill=number(p,state,`minSkill:${b.id}`,'Habilidade mínima',b.hiringPolicy?.minSkill??0,{min:0,max:100});
      if(b.constructionKind==='open-air'){
        p.note('Local ao ar livre: entrevistas presenciais ocorrem na Secretaria do Trabalho.');
      }else{
        const loc=form.interviewLocation||'auto';
        p.buttons([
          {label:'Entrevista: automático',selected:loc==='auto',click:()=>{form.interviewLocation='auto';}},
          {label:'Entrevista: Secretaria',selected:loc==='agency',click:()=>{form.interviewLocation='agency';}},
          {label:'Entrevista: na empresa',selected:loc==='employer',click:()=>{form.interviewLocation='employer';}}
        ]);
      }
      p.buttons([{label:'Aceitar formação',selected:form.training!==false,click:()=>{form.training=form.training===false;}},{label:'Salvar condições das vagas',click:()=>act('employment',{buildingId:b.id,baseWage:wage,minSkill:skill,allowTraining:form.training!==false,manualHiring:form.manualHiring===true,interviewLocation:form.interviewLocation})}]);
      p.button(form.manualHiring?'Seleção manual: ligada':'Seleção manual: desligada',()=>{form.manualHiring=!form.manualHiring;});
      p.heading('Contratação direta (sem processo seletivo)');
      const directCandidates=city.citizens.filter(person=>!person.entity.destroyed&&city.society.isAdult(person)&&!city.politics.officeHolder(person)&&!person.businessIds.length&&person.jobId!==b.id).sort((a,d)=>{
        const va=city.relationships.view(c,a),vd=city.relationships.view(c,d);
        const sa=(va?.trust||0)+(va?.affection||0)+(a.jobId?0:30),sd=(vd?.trust||0)+(vd?.affection||0)+(d.jobId?0:30);
        return sd-sa||a.id-d.id;
      });
      const directTarget=select(p,state,`directHire:${b.id}`,'Pessoa de confiança ou interesse',directCandidates,person=>{
        const v=city.relationships.view(c,person);
        return `${label(person)} · conf. ${Math.round(v?.trust||0)} · afeto ${Math.round(v?.affection||0)}${person.jobId?' · empregado':' · disponível'}`;
      });
      if(directTarget)p.button(`Contratar ${label(directTarget)} sem seleção`,()=>act('direct-hire',{buildingId:b.id,citizenId:directTarget.id,reason:'Indicação direta do proprietário'}));
      p.heading('Candidaturas');
      const applicants=city.citizens.flatMap(person=>(person.career?.applications||[]).filter(a=>a.buildingId===b.id&&a.status==='análise').map(a=>({person,a})));
      if(!applicants.length)p.note('Nenhuma candidatura em análise. As vagas seguem o processo presencial de seleção.');
      for(const {person,a}of applicants){p.note(`${label(person)} · ${a.reason||'Em análise'}`);p.button(`Selecionar ${label(person)}`,()=>act('hire-applicant',{buildingId:b.id,citizenId:person.id}));}
      for(const id of b.workers){const person=city.society.citizen(id);if(person)confirm(p,state,`dismiss:${id}`,`Dispensar ${label(person)}`,()=>act('dismiss',{buildingId:b.id,citizenId:id}));}
      p.heading('Estoque e preços');const good=goodChoice(p,state,'businessGood',city,goods);
      if(good){
        p.kv('Estoque atual',b.inventory[good]||0);const price=number(p,state,`salePrice:${b.id}:${good}`,'Preço de venda em centavos',playerSalePrice(city,b,good));
        p.button('Salvar preço de venda',()=>act('price',{buildingId:b.id,good,amount:price}));
        const seller=select(p,state,'supplier','Fornecedor',buildings.filter(s=>s.id!==b.id&&s.active&&s.inventory[good]>0)),n=number(p,state,'stockQuantity','Quantidade para encomendar',1,{max:999});
        if(seller){p.kv('Preço por unidade',money(playerSalePrice(city,seller,good)));p.button('Encomendar entrega de estoque',()=>act('buy-stock',{buildingId:b.id,sellerId:seller.id,good,quantity:n}));}
      }
    }
    p.heading('Participações em empresas');
    const company=select(p,state,'shareCompany','Empresa com oferta ou participação sua',buildings.filter(b=>b.shareOffers?.some(o=>o.status==='open')||equityShares(city,b).some(s=>s.accountId===c.accountId)));
    if(company){
      const points=number(p,state,'sharePoints','Participação em pontos (100 = 1%)',100,{max:10000});
      p.kv('Sua participação',`${(equityShares(city,company).find(s=>s.accountId===c.accountId)?.points||0)/100}%`);
      p.button('Oferecer participação à venda',()=>act('offer-shares',{buildingId:company.id,points}));
      for(const offer of company.shareOffers||[])if(offer.status==='open'&&offer.sellerId!==c.accountId){p.note(`Oferta #${offer.id} · ${offer.remaining/100}% · avaliação ${money(offer.valuation)}`);p.button(`Comprar oferta #${offer.id}`,()=>act('buy-shares',{buildingId:company.id,offerId:offer.id,points}));}
    }
    return;
  }
  if(form.tab==='bank'){
    p.heading('Atendimento bancário');const b=select(p,state,'bank','Banco',buildings.filter(b=>b.type==='bank'&&b.active));
    if(!b)return;
    p.kv('Poupança neste banco',money(city.bank.deposits.get(`deposit:${b.id}:${c.accountId}`)?.balance||0));
    const amount=number(p,state,'bankAmount','Valor em centavos',10000);
    p.buttons([{label:'Ir e depositar',click:()=>act('bank-deposit',{buildingId:b.id,amount})},{label:'Ir e sacar',click:()=>act('bank-withdraw',{buildingId:b.id,amount})},{label:'Ir e pedir empréstimo',click:()=>act('bank-loan',{buildingId:b.id,amount})}]);
    p.note('Crédito depende de renda, reputação e liquidez. Juros e parcelas continuam sendo cobrados.');
    for(const loan of city.bank.loans.filter(l=>l.clientId===c.accountId&&l.bankId===b.id&&!['paid','written-off','foreclosed'].includes(l.status))){p.heading(`Dívida #${loan.id}`);p.kv('Principal restante',money(loan.remaining));p.kv('Juros acumulados',money(loan.interest));p.kv('Juros por dia',`${(loan.rate*100).toFixed(2)}%`);p.kv('Parcela',money(loan.dailyPayment));p.button(`Amortizar dívida #${loan.id}`,()=>act('bank-repay',{buildingId:b.id,loanId:loan.id,amount}));}
    return;
  }
  if(form.tab==='vehicles'){
    p.heading('Comprar veículo');
    const sale=select(p,state,'vehicleSale','Veículo à venda',[...city.vehicles.units.values()].filter(v=>!v.active&&!v.scrapped&&v.holderAccountId),v=>`${label(v)} · ${money(city.vehicles.vehiclePrice(v))}`);
    if(sale){const seller=buildings.find(b=>b.accountId===sale.holderAccountId)||city.worldPort;p.button('Ir e comprar veículo',()=>act('buy-vehicle',{buildingId:seller.id,vehicleId:sale.id}));}
    p.heading('Viajar com seu veículo');
    const vehicle=select(p,state,'vehicle','Equipamento disponível',[...city.vehicles.units.values()].filter(v=>v.active&&!v.scrapped&&(city.vehicles.accessAccount(v)===c.accountId||own.some(b=>b.accountId===city.vehicles.accessAccount(v)))),v=>`${label(v)} · ${v.status||''} · ${Math.round(v.condition)}%`);
    const x=number(p,state,'destinationX','Destino X',Math.floor(c.entity.x)+.5,{min:0,max:city.world.width-1,step:.5}),y=number(p,state,'destinationY','Destino Y',Math.floor(c.entity.y)+.5,{min:0,max:city.world.height-1,step:.5});
    if(vehicle)p.button('Iniciar viagem',()=>act('ride-vehicle',{vehicleId:vehicle.id,x,y}));
    p.note('Você vai até o veículo e segue uma rota real. Barcos exigem acesso à água e desembarque seguro.');
    if(c.ridingVehicleId||c.mobilityTrip||c.localBoatTrip||c.sharedBoatRide)p.button('Desembarcar quando seguro',()=>act('leave-vehicle'));
    return;
  }
  if(form.tab==='social'){
    p.heading('Relações pessoais');const person=select(p,state,'socialPerson','Pessoa próxima',game.targets().filter(t=>t.kind==='person').map(t=>city.society.citizen(t.id)));
    if(!person)return;
    const view=city.relationships.view(person,c);if(view){p.kv('Afeto da pessoa por você',Math.round(view.affection));p.kv('Confiança',Math.round(view.trust));}
    p.note('Interesse, confiança e vontade da outra pessoa contam. Uma proposta pode ser recusada.');
    p.buttons([{label:'Conversar',click:()=>act('talk',{citizenId:person.id})},{label:'Demonstrar interesse',click:()=>act('flirt',{citizenId:person.id})},{label:'Propor relacionamento',click:()=>act('propose',{citizenId:person.id})}]);
    if(c.partnerId===person.id){p.button('Formalizar união',()=>act('marry',{citizenId:person.id}));p.button('Planejar ter filhos',()=>act('plan-child',{citizenId:person.id}));confirm(p,state,`separate:${person.id}`,'Encerrar relacionamento',()=>act('separate',{citizenId:person.id}));}
    return;
  }
  if(form.tab==='work'){
    p.heading('Emprego');p.kv('Empregador',label(city.building(c.jobId))||'Sem emprego');p.button('Iniciar expediente',()=>act('work'));
    if(c.jobId)confirm(p,state,'leave-job','Pedir demissão',()=>act('leave-job'));
    p.heading('Escolher canteiro');
    const project=select(p,state,'project','Obra',city.development.projects.filter(pr=>!pr.cancelled&&pr.status!=='completed'&&(pr.accountId===c.accountId||pr.builderId===c.jobId)),pr=>`${pr.name} · ${pr.status}`);
    if(project)p.button('Trabalhar nesta obra',()=>act('work-project',{projectId:project.id}));
    p.heading('Fabricar com seus insumos');
    const type=choose(p,state,'recipe','Receita da sua profissão',playerRecipes(city,c).map(([id,s])=>({id,label:s.label})),form.recipe);
    if(type){const spec=playerRecipes(city,c).find(([id])=>id===type)[1],b=select(p,state,'workshop','Oficina',buildings.filter(b=>b.active&&b.type===type&&(ownsBusiness(c,b)||b.id===c.jobId)));
      p.note(`Insumos: ${Object.entries(spec.inputs).map(([g,q])=>`${q} ${city.economy.goods[g].label}`).join(', ')}.`);
      p.note(`Produtos: ${Object.entries(spec.outputs).map(([g,q])=>`${q} ${city.economy.goods[g].label}`).join(', ')}.`);p.kv('Trabalho necessário',`${spec.labor||10} minutos`);
      if(b)p.button('Ir e fabricar um lote',()=>act('craft',{buildingId:b.id,type}));
    }
    return;
  }
  if(form.tab==='explore'){
    p.heading('Entradas e interiores');
    const b=select(p,state,'exploreBuilding','Construção próxima',game.targets().filter(t=>t.kind==='building').map(t=>city.building(t.id)).filter(Boolean));
    if(b&&!c.indoorLocation){p.button('Entrar pela entrada pública',()=>act('enter',{buildingId:b.id}));confirm(p,state,`trespass:${b.id}`,'Entrar sem autorização · sujeito à lei',()=>act('enter',{buildingId:b.id,force:true}));}
    if(c.indoorLocation){
      const inside=city.building(c.indoorLocation.buildingId),unit=inside&&select(p,state,'exploreRoom','Cômodo e andar',inside.units.filter(u=>u.roomType!=='cell'),u=>`${u.roomType} · andar ${u.z+1} · ${u.x}, ${u.y}`);
      if(unit)p.button('Caminhar até este cômodo',()=>act('explore-room',{unitId:unit.id}));
      p.button('Sair do prédio',()=>act('exit'));
    }
    return;
  }
  if(form.tab==='politics'){
    p.heading('Participação política');p.kv('Mandato',c.id===city.economy.mayorId?'Prefeito':city.politics.council.members.some(m=>m.citizenId===c.id)?'Vereador':'Sem mandato');
    p.button(c.playerPoliticalAmbition?'Recusar novas candidaturas':'Aceitar candidaturas e cargos públicos',()=>act('political-ambition',{enabled:!c.playerPoliticalAmbition}));
    const party=select(p,state,'party','Partido',city.politics.parties.filter(p=>p.active),p=>p.ballotLabel||p.name);if(party)p.button('Filiar-se ao partido',()=>act('join-party',{partyId:party.id}));
    if(city.politics.council.members.some(m=>m.citizenId===c.id)){
      p.button('Comparecer à Câmara',()=>act('attend-council',{}));p.note('Sessões: 10h–12h e 15h–17h. Seu voto exige presença e quorum.');
      for(const bill of city.politics.council.bills.filter(b=>['awaiting-session','proposed','vetoed'].includes(b.status))){p.note(`${bill.title} · ${bill.playerVotes?.[c.id]===true?'Seu voto: sim':bill.playerVotes?.[c.id]===false?'Seu voto: não':'Seu voto pendente'}`);p.buttons([{label:'Votar sim',click:()=>act('council-vote',{billId:bill.id,yes:true})},{label:'Votar não',click:()=>act('council-vote',{billId:bill.id,yes:false})}]);}
    }
    p.heading('Propostas à Câmara');
    const bills=[['tax','Imposto pessoal'],['businessTax','Imposto empresarial'],['minimumWage','Salário mínimo'],['welfare','Assistência social'],['worksBudget','Orçamento de obras'],['worksTransfer','Transferência para obras'],['build','Construção pública'],['cleanRecord','Ficha limpa'],['parliamentaryImmunity','Imunidade parlamentar'],['mayorDecreeDays','Dias entre decretos'],['impeachmentCooldownElections','Eleições entre impeachments']];
    const type=choose(p,state,'billType','Tipo de proposta',bills.map(([id,label])=>({id,label})),form.billType);
    const value=number(p,state,'billValue','Valor da proposta (alíquota em fração; dinheiro em centavos)',.1,{min:0,step:.01});
    const buildingType=type==='build'?choose(p,state,'publicType','Tipo de obra pública',Object.entries(city.buildingTypes).filter(([id])=>!['townhall','mint','council_chamber'].includes(id)).map(([id,s])=>({id,label:s.label})),form.publicType):null;
    p.note('Somente seu mandato autoriza propostas, veto ou contratação. A Câmara mantém votação, orçamento e execução.');
    p.button('Apresentar proposta',()=>act('bill',{type,payload:type==='build'?{buildingType}:['cleanRecord','parliamentaryImmunity'].includes(type)?{value:value!==0}:{value}}));
    if(c.id===city.economy.mayorId){
      p.note(`Decreto sem votação: um a cada ${city.politics.policy.mayorDecreeDays??3} dias; próximo direito no minuto ${city.politics.decreeReadyAt()}. Não permite ampliar poderes do prefeito.`);
      p.button('Implementar por decreto',()=>act('decree',{type,payload:type==='build'?{buildingType}:['cleanRecord','parliamentaryImmunity'].includes(type)?{value:value!==0}:{value}}));
      p.heading('Administração municipal');const publicType=choose(p,state,'mayorWorkType','Obra pública',Object.entries(city.buildingTypes).filter(([id])=>!['townhall','mint','council_chamber'].includes(id)).map(([id,s])=>({id,label:s.label})),form.mayorWorkType),floors=number(p,state,'publicFloors','Andares da obra pública',1,{max:8});
      p.button('Contratar obra com orçamento público',()=>act('public-work',{type:publicType,floors}));
      const amount=number(p,state,'worksAmount','Transferência solicitada em centavos',10000);p.button('Solicitar verba à Câmara',()=>act('works-transfer',{amount}));
      for(const bill of city.politics.council.bills.filter(b=>b.status==='awaiting-sanction')){p.note(bill.title);p.buttons([{label:'Sancionar',click:()=>act('sanction',{billId:bill.id})},{label:'Vetar',click:()=>act('veto',{billId:bill.id})}]);}
    }
  }
}
