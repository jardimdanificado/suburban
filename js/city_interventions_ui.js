import {INTERVENTIONS} from './city_interventions.js';
import {formatMoney as money} from './city_ui_format.js';
export function renderInterventions(ui,p){
  const city=ui.city,gov=city.politics,mode=ui.interventionView||'opinion',people=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)),target=city.society.citizen(ui.interventionTargetId),act=(kind,id=target?.id,options={})=>gov.intervene(kind,id,options);
  p.note('Marcadores no mapa: bandeira = campanha; lupa = pesquisador; balão = entrevistado; urna = votação; pacote = entrega; capacete = obra; vassoura = faxina; cruz = cuidados; plenário = vereador.');
  p.note('Ações do observador para participar da simulação. Opiniões alteram escolhas futuras; votos já depositados permanecem registrados. Efeitos sobre opinião enfraquecem com o tempo.');
  p.links([['opinion','IMAGEM E OPINIÃO'],['campaign','ELEIÇÕES'],['economy','ECONOMIA E VEÍCULOS'],['history','INTERVENÇÕES FEITAS']].map(([id,label])=>({label,selected:mode===id,click:()=>ui.openPanel({interventionView:id})})));
  if(mode==='history'){
    const rows=[...(gov.interventions?.records||[])].reverse(),page=Math.min(ui.interventionPage||0,Math.max(0,Math.ceil(rows.length/10)-1));
    if(rows.length>10)p.buttons([{label:'ANTERIOR',click:()=>{ui.interventionPage=Math.max(0,page-1);}},{label:'PRÓXIMA',click:()=>{ui.interventionPage=page+1;}}]);
    for(const row of rows.slice(page*10,page*10+10))p.block(row.title,`Dia ${Math.floor(row.minute/1440)+1} · ${money(row.cost)} · alcance ${row.affected}`,q=>{q.note(row.description);q.button('EVENTO E DETALHES',()=>ui.openEvent(row.eventId));if(row.vehicleId)q.button('LOCALIZAR VEÍCULO',()=>{const v=city.vehicles.units.get(row.vehicleId);if(v?.entity)ui.camera(v.entity.x,v.entity.y);});});if(!rows.length)p.note('Nenhuma intervenção feita.');return;
  }
  p.kv('Caixa municipal / reserva social',`${money(city.treasury)} / ${money(city.welfare.conditions().reserve)}`);
  const selected=target&&!target.entity.destroyed?target:null;
  p.status('PESSOA ESCOLHIDA',selected?`${selected.entity.properties.name} · ${gov.party(selected.political?.partyId)?.short||'sem partido'}`:'Escolha uma pessoa abaixo.');
  const candidates=gov.active?.candidates||[],rows=(mode==='campaign'&&candidates.length?candidates.map(n=>city.society.citizen(n.citizenId)).filter(Boolean):people).filter(c=>ui.matches(c.entity.properties.name)),pages=Math.max(1,Math.ceil(rows.length/8)),page=Math.min(ui.interventionPeoplePage||0,pages-1);
  ui.section(p,'interventionPeople',selected?'Trocar pessoa':'Selecionar pessoa',()=>{
    if(pages>1)p.buttons([{label:'ANTERIOR',click:()=>{ui.interventionPeoplePage=Math.max(0,page-1);}},{label:'PRÓXIMA',click:()=>{ui.interventionPeoplePage=Math.min(pages-1,page+1);}}]);
    p.table([{label:'Pessoa',weight:3},{label:'Partido'},{label:'Popularidade'}],rows.slice(page*8,page*8+8).map(c=>({cells:[c.entity.properties.name,gov.party(c.political?.partyId)?.short||'—',Math.round(c.political?.popularity??50)],selected:selected?.id===c.id,click:()=>{ui.interventionTargetId=c.id;ui.helpOpen.interventionPeople=false;}})));
  });
  if(mode==='opinion'||mode==='campaign'){
    if(mode==='campaign')p.note(gov.active?.status==='campaign'?`Eleição ${gov.active.id}: ${candidates.length} candidaturas. A mobilização usa moradores disponíveis, ruas e recursos reais.`:'Ações eleitorais ficam disponíveis durante a campanha.');
    for(const [kind,spec]of Object.entries(INTERVENTIONS).filter(([,s])=>s.group===mode))p.block(spec.label,spec.cost?`Custo municipal: ${money(city.currency.price(spec.cost))}`:'Intervenção sobre informação e participação',q=>{q.note(spec.description);q.button(spec.label.toUpperCase(),()=>act(kind));});return;
  }
  p.heading('VEÍCULOS');p.note('A importação é uma compra externa comandada por você. A produção local continua dependendo de matérias-primas, componentes, montagem e transporte.');
  for(const [good,label]of [['bicicleta','BICICLETA'],['bicicleta_carga','BICICLETA DE CARGA'],['patinete','PATINETE'],['patins','PATINS'],['skate','SKATE']])p.button(`IMPORTAR ${label} · ${money(Math.ceil(city.economy.goods[good].price*1.5))}`,()=>act('importVehicle',selected?.id,{good}));
  const vehicles=[...city.vehicles.units.values()].filter(v=>v.active&&!v.scrapped);for(const v of vehicles.slice(-8))p.block(`Veículo #${v.id}`,`${city.accountName(v.ownerAccountId)} · conservação ${Math.round(v.condition)}%`,q=>{q.buttons([{label:'SOLICITAR PASSEIO',click:()=>act('ride',v.id)},{label:'LOCALIZAR',click:()=>{if(v.entity)ui.camera(v.entity.x,v.entity.y);}}]);});
  p.heading('FINANCIAR EMPRESAS');p.note(`Aporte por intervenção: ${money(city.currency.price(INTERVENTIONS.businessFunding.cost))}. Não substitui funcionários, materiais ou entregas.`);
  const businesses=city.economy.businesses.filter(b=>b.active&&!b.entity.destroyed&&ui.matches(`${b.entity.properties.name} ${city.buildingTypes[b.type]?.label||b.type}`)),businessPage=Math.min(ui.interventionBusinessPage||0,Math.max(0,Math.ceil(businesses.length/8)-1));if(businesses.length>8)p.buttons([{label:'EMPRESAS ANTERIORES',click:()=>{ui.interventionBusinessPage=Math.max(0,businessPage-1);}},{label:'PRÓXIMAS EMPRESAS',click:()=>{ui.interventionBusinessPage=businessPage+1;}}]);
  for(const b of businesses.slice(businessPage*8,businessPage*8+8))p.record(b.entity.properties.name,`${city.buildingTypes[b.type]?.label||b.type} · ${b.workers.length}/${b.jobs} funcionários`,()=>act('businessFunding',b.id),false,{value:'APORTAR'});
  p.windowLink('FROTA, MONTADORAS E CADEIA',()=>ui.openPanel({tab:'transport',views:{transport:'models'}}));
}
