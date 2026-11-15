import {formatMoney} from './city_ui_format.js';
import {controlledCitizen} from './character_game.js';
import {samePlace} from './character_interactions.js';

const name=c=>c?.entity?.properties?.name||'Não informado';
const kindLabels={person:'Pessoa',building:'Construção',plant:'Planta',water:'Água',vehicle:'Veículo',object:'Objeto no chão'};
export const targetKindLabel=target=>kindLabels[target.kind]||'Objeto';

/** Read-only dossiers resolve live records; they never expose management commands. */
export function drawTargetDossier(p,city,target,getEntity=()=>null){
  const c=controlledCitizen(city);
  const record=target.kind==='object'?{entity:getEntity(target.id)}:target.kind==='person'?city.society.citizen(target.id)||city.accounts.get(`citizen:${target.id}`):target.kind==='building'?city.building(target.id):target.kind==='plant'?city.nature.plants.get(target.id):target.kind==='vehicle'?city.vehicles.units.get(target.id):city.water.bodies.find(b=>b.id===target.id);
  if(!record||target.kind==='object'&&!record.entity){p.note('Este alvo não está mais disponível no mundo.');return;}
  const entity=record.entity;
  p.heading(entity?.properties?.name||target.label);p.kv('Tipo',targetKindLabel(target));
  if(entity?.destroyed){p.note(target.kind==='person'?'Esta pessoa morreu.':'Este objeto foi removido.');return;}
  if(c&&entity){
    const point=target.kind==='building'?record.door:target.kind==='plant'?{x:record.x+.5,y:record.y+.5}:entity;
    const visibleFloor=target.kind!=='person'||samePlace(c,record);
    p.kv('Distância atual',visibleFloor?`${Math.hypot(c.entity.x-point.x,c.entity.y-point.y).toFixed(1)} metros`:'Outro ambiente');
  }
  if(target.kind==='object'){
    const props=entity.properties;
    p.kv('Categoria',props.resourceType||props.species||'Objeto');
    if(props.item?.quantity!=null)p.kv('Quantidade',props.item.quantity);
    p.kv('Posição',`${entity.x.toFixed(1)}, ${entity.y.toFixed(1)}`);
    p.note('Objeto presente no mundo.');return;
  }
  if(target.kind==='person'){
    p.kv('Idade',`${city.society.age(record)} anos`);
    p.kv('Atividade',record.action||'Sem atividade');p.kv('Saldo',formatMoney(record.balance||0));
    p.kv('Emprego',city.building(record.jobId)?.entity.properties.name||'Sem emprego');
    const home=city.housing.home(record);p.kv('Moradia',home?city.building(home.buildingId)?.entity.properties.name||'Com moradia':'Sem moradia');
    p.kv('Parceiro(a)',record.partnerId?name(city.society.citizen(record.partnerId)):'Sem parceiro(a)');
    p.kv('Filhos',(record.childIds||[]).length);
    p.heading('Condição física');
    for(const [key,label]of [['health','Saúde'],['food','Alimentação'],['water','Água'],['energy','Energia']])p.meter(label,record.needs[key]);
    p.kv('Ferimentos',(record.combatInjuries||[]).length);return;
  }
  if(target.kind==='building'){
    p.kv('Uso',city.buildingTypes[record.type]?.label||record.type);p.kv('Situação',record.active?'Em funcionamento':'Inativa / em construção');
    p.kv('Conservação',`${Math.round(record.condition||0)}%`);p.kv('Andares',record.floors);p.kv('Área',`${record.width} × ${record.depth}`);
    p.kv('Proprietário',record.ownerId==='treasury'?'Município':record.ownerId!=null?name(city.society.citizen(record.ownerId)):'Sem proprietário');
    p.kv('Trabalhadores',`${record.workers.length}/${record.jobs}`);
    p.heading('Estoque');const goods=Object.entries(record.inventory||{}).filter(([,q])=>q>0);
    if(!goods.length)p.note('Nenhum item em estoque.');for(const [good,q]of goods)p.kv(city.economy.goods[good]?.label||good,q);return;
  }
  if(target.kind==='plant'){
    p.kv('Espécie',record.scientific||record.species);
    p.kv('Crescimento',({seedling:'Muda',young:'Jovem',mature:'Madura'})[record.stage]||record.stage);
    p.kv('Local',record.buildingId?city.building(record.buildingId)?.entity.properties.name||'Cultivo':'Vegetação do mundo');
    p.heading('Produção disponível');const products=Object.keys(city.nature.products(record));
    if(!products.length)p.note('Sem produtos de coleta.');for(const good of products)p.kv(city.economy.goods[good]?.label||good,city.nature.stock(record,good));return;
  }
  if(target.kind==='vehicle'){
    p.kv('Categoria',record.boatClass?'Embarcação':'Transporte terrestre');p.kv('Situação',record.status||'Disponível');p.kv('Conservação',`${Math.round(record.condition||0)}%`);
    p.kv('Proprietário',record.ownerAccountId?city.accountName(record.ownerAccountId):'Sem proprietário');p.kv('Passageiros',(record.passengerIds||[]).length);p.kv('Distância percorrida',Number(record.distance||0).toFixed(1));return;
  }
  p.kv('Volume',Math.round(record.volume));p.kv('Poluição',Number(record.pollution||0).toFixed(2));p.note('Água sem tratamento pode causar danos ao beber.');
}
