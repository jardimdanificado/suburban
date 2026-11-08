import {interventionsVisible,compactInterventions} from './city_context_actions.js';
import {INTERVENTIONS} from './city_interventions.js';
import {formatMoney as money} from './city_ui_format.js';
import {MINIMUM_WAGE_TAX_RATE,taxRate} from './city_sales_tax.js';
export function renderInterventions(ui,p){
  if(!interventionsVisible(ui)){p.note('Controles ocultos. Ative em Opções → Interface.');return;}
  const city=ui.city,gov=city.politics,mode=ui.interventionView||'opinion',people=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)),target=city.society.citizen(ui.interventionTargetId),act=(kind,id=target?.id,options={})=>{const result=gov.executePlayerAction(kind,id,options);ui.notice=result?.description||(result===true?'Comando aplicado imediatamente.':city.lastError)||'Não foi possível concluir a intervenção.';return result;};
  p.note('Marcadores no mapa: bandeira = campanha; lupa = pesquisador; balão = entrevistado; urna = votação; pacote = entrega; capacete = obra; vassoura = faxina; cruz = cuidados; plenário = vereador.');
  p.note('Ações do observador para participar da simulação. Opiniões alteram escolhas futuras; votos já depositados permanecem registrados. Efeitos sobre opinião enfraquecem com o tempo.');
  p.links([['god','GOVERNO'],['city','OBRAS E SERVIÇOS'],['opinion','IMAGEM E OPINIÃO'],['campaign','ELEIÇÕES'],['economy','ECONOMIA E VEÍCULOS'],['history','INTERVENÇÕES FEITAS']].map(([id,label])=>({label,selected:mode===id,click:()=>ui.openPanel({interventionView:id})})));
  if(mode==='history'){
    const rows=[...(gov.interventions?.records||[])].reverse(),page=Math.min(ui.interventionPage||0,Math.max(0,Math.ceil(rows.length/10)-1));
    if(rows.length>10)p.buttons([{label:'ANTERIOR',click:()=>{ui.interventionPage=Math.max(0,page-1);}},{label:'PRÓXIMA',click:()=>{ui.interventionPage=page+1;}}]);
    for(const row of rows.slice(page*10,page*10+10))p.block(row.title,`Dia ${Math.floor(row.minute/1440)+1} · ${money(row.cost)} · alcance ${row.affected}`,q=>{q.note(row.description);q.button('EVENTO E DETALHES',()=>ui.openEvent(row.eventId));if(row.vehicleId)q.button('LOCALIZAR VEÍCULO',()=>{const v=city.vehicles.units.get(row.vehicleId);if(v?.entity)ui.camera(v.entity.x,v.entity.y);});});if(!rows.length)p.note('Nenhuma intervenção feita.');return;
  }
  p.kv('Caixa municipal / reserva social',`${money(city.treasury)} / ${money(city.welfare.conditions().reserve)}`);
  const selected=target&&!target.entity.destroyed?target:null;
  p.status('PESSOA ESCOLHIDA',selected?`${selected.entity.properties.name} · ${gov.party(selected.political?.partyId)?.short||'sem partido'}`:'Escolha uma pessoa abaixo.');
  const candidates=gov.active?.candidates||[],rows=(mode==='campaign'&&candidates.length?candidates.map(n=>city.society.citizen(n.citizenId)).filter(Boolean):people).filter(c=>ui.matches(c.entity.properties.name)),pages=Math.max(1,Math.ceil(rows.length/8)),page=Math.min(ui.interventionPeoplePage||0,pages-1);
  if(['opinion','campaign','economy'].includes(mode))ui.section(p,'interventionPeople',selected?'Trocar pessoa':'Selecionar pessoa',()=>{
    if(pages>1)p.buttons([{label:'ANTERIOR',click:()=>{ui.interventionPeoplePage=Math.max(0,page-1);}},{label:'PRÓXIMA',click:()=>{ui.interventionPeoplePage=Math.min(pages-1,page+1);}}]);
    p.table([{label:'Pessoa',weight:3},{label:'Partido'},{label:'Popularidade'}],rows.slice(page*8,page*8+8).map(c=>({cells:[c.entity.properties.name,gov.party(c.political?.partyId)?.short||'—',Math.round(c.political?.popularity??50)],selected:selected?.id===c.id,click:()=>{ui.interventionTargetId=c.id;ui.helpOpen.interventionPeople=false;}})));
  });
  if(mode==='city'){
    const types=Object.entries(city.buildingTypes).filter(([id])=>!['townhall','mint','council_chamber'].includes(id));
    compactInterventions(ui,p,'new-public-work',types.map(([buildingType,spec])=>({label:`Iniciar obra: ${spec.label}`,click:()=>act('divineGovernment',null,{type:'publicWork',payload:{buildingType}})})));
    const projects=city.development.projects.filter(x=>!x.cancelled&&x.status!=='completed');
    compactInterventions(ui,p,'work-priority',projects.flatMap(x=>[100,10].map(priority=>({label:`Obra #${x.id}: ${priority===100?'priorizar':'reduzir prioridade'}`,click:()=>act('prioritizeWork',x.id,{priority})}))));
    const jobs=city.gigs.jobs.filter(x=>['open','working'].includes(x.status));
    compactInterventions(ui,p,'cancel-service',jobs.map(x=>({label:`Cancelar serviço #${x.id} · ${x.kind}`,click:()=>act('cancelService',x.id)})));
    const art=city.justice.art.filter(x=>!x.entity.destroyed);
    compactInterventions(ui,p,'remove-art',art.map(x=>({label:`Retirar #${x.id} · ${x.message}`,click:()=>act('removeArtwork',x.id)})));
    compactInterventions(ui,p,'building-services',city.buildings.filter(b=>!b.entity.destroyed&&ui.matches(b.entity.properties.name)).flatMap(b=>[['repair','Reparo'],['cleaning','Limpeza'],['garden','Jardinagem'],['art','Arte']].map(([service,label])=>({label:`${label}: ${b.entity.properties.name}`,click:()=>act('serviceOrder',b.id,{service})}))));
    p.note('Ordens contratam trabalho real. Terreno, acessos, materiais e equipes continuam fazendo parte da simulação.');return;
  }
  if(mode==='god'){
    const actions=[],add=(label,kind,id=null,options={})=>actions.push({label,click:()=>act(kind,id,options)}),election=gov.active;
    if(election?.status==='campaign')for(const n of election.candidates){add(`Divulgar apoio: ${n.name}`,'divineCampaign',n.citizenId);add(`Espalhar suspeita: ${n.name}`,'divineSmear',n.citizenId);}
    if(['voting','counting'].includes(election?.status))add('Convocar eleitores às urnas','divineTurnout');
    for(const amount of [100000,1000000,10000000])add(`Emitir ${money(city.currency.price(amount))} para o tesouro`,'divineTreasury',null,{amount});
    for(const [category,label]of [[null,'salário'],['food','alimentos'],['services','serviços']])for(const delta of [-.02,.02]){const floor=category?taxRate(city,category):MINIMUM_WAGE_TAX_RATE,before=category?taxRate(city,category):city.taxRate,value=Math.max(floor,Math.min(.5,before+delta));if(value!==before)add(`Imposto de ${label}: ${Math.round(value*100)}%`,'divineDecree',null,{category,value});}
    add('Convocar vereadores disponíveis ao plenário','divineConvocation');
    actions.push({label:'Leis, impostos, comércio, segurança e orçamento…',click:()=>ui.openPanel({politicsTab:'council',councilView:'propose'})});
    compactInterventions(ui,p,'government-orders',actions);
    const banking=[];for(const bank of city.buildings.filter(b=>b.type==='bank'&&!b.entity.destroyed)){
      banking.push({label:`Injetar recursos: ${bank.entity.properties.name}`,click:()=>act('divineBankLiquidity',bank.id,{amount:2500000})});
      for(const loan of city.bank.loans.filter(l=>l.bankId===bank.id&&!['paid','written-off'].includes(l.status)))banking.push({label:`Perdoar dívida #${loan.id} · ${city.accountName(loan.clientId)}`,click:()=>act('divineDebtRelief',bank.id,{loanId:loan.id})});
    }compactInterventions(ui,p,'banking-orders',banking);return;
  }
  if(mode==='opinion'||mode==='campaign'){
    if(mode==='campaign')p.note(gov.active?.status==='campaign'?`Eleição ${gov.active.id}: ${candidates.length} candidaturas. A mobilização usa moradores disponíveis, ruas e recursos reais.`:'Ações eleitorais ficam disponíveis durante a campanha.');
    compactInterventions(ui,p,`intervention:${mode}`,Object.entries(INTERVENTIONS).filter(([,spec])=>spec.group===mode).map(([kind,spec])=>({label:spec.label,click:()=>act(kind)})));return;
  }
  compactInterventions(ui,p,'import-vehicles',[['bicicleta','Bicicleta'],['bicicleta_carga','Bicicleta de carga'],['patinete','Patinete'],['patins','Patins'],['skate','Skate']].map(([good,label])=>({label:`Importar ${label}`,click:()=>act('importVehicle',selected?.id,{good})})));
  compactInterventions(ui,p,'ride-vehicles',[...city.vehicles.units.values()].filter(v=>v.active&&!v.scrapped).map(v=>({label:`Passeio: veículo #${v.id} · ${city.accountName(v.ownerAccountId)}`,click:()=>act('ride',v.id)})));
  compactInterventions(ui,p,'fund-businesses',city.economy.businesses.filter(b=>b.active&&!b.entity.destroyed&&ui.matches(b.entity.properties.name)).map(b=>({label:`Financiar: ${b.entity.properties.name}`,click:()=>act('businessFunding',b.id)})));
  p.windowLink('FROTA, MONTADORAS E CADEIA',()=>ui.openPanel({tab:'transport',views:{transport:'models'}}));
}
