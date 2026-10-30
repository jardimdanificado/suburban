import {INDUSTRIES} from './city_industries.js';
const roomCaches=new WeakMap();
const machines={steel_mill:['furnace','Forno siderúrgico'],bauxite_mine:['drill','Perfuratriz de bauxita'],aluminum_smelter:['furnace','Forno de alumínio'],rubber_grove:['tap','Bancada de extração de látex'],rubberworks:['rollers','Misturador de borracha'],bearing_factory:['lathe','Torno de rolamentos'],frame_factory:['welding','Gabarito de solda de quadros'],deck_factory:['saw','Serra de plataformas'],tire_factory:['press','Prensa de rodas'],chain_factory:['lathe','Montadora de correntes'],safety_equipment:['press','Prensa de capacetes'],saddle_factory:['sewing','Bancada de selins'],cycle_parts:['lathe','Torno de peças'],sports_shoes:['sewing','Costura de botas'],skate_workshop:['assembly','Bancada de skates'],cycle_assembler:['assembly','Linha de montagem'],cycle_shop:['counter','Balcão da concessionária'],sports_shop:['counter','Balcão esportivo'],cycle_workshop:['welding','Cavalete de manutenção'],bicycle_rental:['rack','Rack da locadora'],kitchen:['stove','Fogão e bancada de preparo'],artisan:['workbench','Bancada de cestaria'],forestry:['saw','Bancada florestal'],sawmill:['saw','Serra de tábuas'],charcoal:['kiln','Forno de carvão'],iron_mine:['drill','Perfuratriz de ferro'],foundry:['furnace','Forno de fundição'],toolmaker:['lathe','Torno de ferramentas'],clay_pit:['drill','Extrator de argila'],brickworks:['kiln','Forno de tijolos'],sand_pit:['sieve','Peneira de areia'],glassworks:['furnace','Forno de vidro'],furniture:['saw','Bancada de marcenaria'],fiber_farm:['rack','Secador de fibras'],flagmaker:['sewing','Costura de bandeiras'],paintworks:['vat','Misturador de pigmentos'],weaving:['loom','Tear'],newsroom:['desk','Mesa da redação'],clothing_store:['rack','Arara de roupas'],laundromat:['washer','Máquina de lavar'],thrift_store:['rack','Arara do brechó'],tailor:['sewing','Máquina de costura'],dairy_farm:['vat','Tanque de leite'],cheesemaker:['vat','Cuba de queijo'],poultry:['coop','Ninhos e comedouros'],flour_mill:['mill','Moenda de farinha'],pasta_factory:['rollers','Laminador de massas'],cannery:['vat','Tanque de conservas'],soapworks:['vat','Tanque de sabão'],herb_farm:['rack','Secador de ervas'],pharmacy:['lab','Bancada de medicamentos'],paper_mill:['press','Prensa de papel'],publisher:['press','Prensa de encadernação'],pottery:['wheel','Roda de oleiro'],composting:['composter','Leira de compostagem'],research_institute:['desk','Mesa de pesquisa'],bank:['desk','Mesa de atendimento bancário']};
export const WORKSTATIONS=Object.freeze(Object.fromEntries(Object.keys(INDUSTRIES).map(type=>[type,{kind:machines[type]?.[0]||'workbench',label:machines[type]?.[1]||INDUSTRIES[type].label,inputs:Object.keys(INDUSTRIES[type].inputs),outputs:Object.keys(INDUSTRIES[type].outputs),seated:machines[type]?.[0]==='desk'||machines[type]?.[0]==='sewing'}])));
const basic={townhall:['desk','Mesa administrativa'],council_chamber:['desk','Mesa parlamentar'],builder:['desk','Prancheta de obras'],carrier:['desk','Mesa de despacho'],lamp_service:['workbench','Bancada de lamparinas'],cleaner:['washer','Posto de higienização'],waste_collector:['sieve','Triagem de resíduos'],recycler:['press','Prensa de reciclagem'],mint:['press','Prensa de moedas'],bakery:['stove','Forno de pão'],mill:['mill','Prensa de óleo'],market:['counter','Balcão de vendas'],greengrocer:['counter','Banca de hortaliças'],popular_refectory:['stove','Bancada do refeitório'],quarry:['drill','Equipamento da pedreira'],clinic:['lab','Bancada clínica'],hospital:['lab','Posto de enfermagem'],utility:['pump','Bomba de abastecimento']};
export function workstationFor(type){return WORKSTATIONS[type]||{kind:basic[type]?.[0]||'desk',label:basic[type]?.[1]||'Posto de atendimento',seated:!basic[type]||basic[type][0]==='desk',inputs:[],outputs:[]};}
export function roomFurniture(b,u){
 const key=`${b.type}:${u.roomType}:${b.layoutRevision||0}`,cached=roomCaches.get(u);if(cached?.key===key)return cached.items;
 const items=[],add=(type,x,y,label,extra={})=>{const f={id:`furniture:${u.id}:${type}:${items.length}`,type,x:u.x+x,y:u.y+y,z:u.z,label,...extra};items.push(f);return f;},chair=(x,y,fx,fy,label='Cadeira')=>add('chair',x,y,label,{seated:true,facing:{x:u.x+fx,y:u.y+fy}});
 if(u.roomType==='bedroom'){add('bed',.5,.52,'Cama',{sleeping:true});add('chest',.78,.83,'Baú de roupas e itens',{storage:'clothes'});add('fridge',.18,.82,'Geladeira doméstica',{storage:'food'});}
 else if(u.roomType==='cell'){add('bed',.5,.52,'Beliche da cela',{sleeping:true});add('chest',.82,.82,'Armário da cela');}
 else if(u.roomType==='bathroom'){add('toilet',.5,.5,'Vaso sanitário',{seated:true,facing:{x:u.x+.5,y:u.y+.9}});add('sink',.5,.85,'Lavatório');}
 else if(u.roomType==='dining'){add('table',.5,.5,'Mesa de refeições');chair(.17,.5,.5,.5);chair(.83,.5,.5,.5);chair(.5,.17,.5,.5);chair(.5,.83,.5,.5);if((u.x+u.y)%4===0)add('fridge',.87,.87,'Geladeira do refeitório',{storage:'food'});}
 else if(u.roomType==='treatment'){add('bed',.5,.55,'Maca de atendimento');add('lab',.78,.86,'Mesa clínica');}
 else if(u.roomType==='laundry'){add('washer',.5,.72,'Máquina de lavar');add('chest',.82,.3,'Baú de roupas');}
 else if(u.roomType==='service'){add('counter',.5,.75,'Balcão de atendimento');}
 else if(u.roomType!=='circulation'){
  const w=workstationFor(b.type);add(w.kind,.5,.74,w.label,{workstation:true,seated:w.seated});if(w.seated||['office','plenary'].includes(u.roomType))chair(.5,.32,.5,.74,'Cadeira de trabalho');
  if((u.x+u.y)%5===0)add('chest',.86,.28,'Armário de ferramentas');
 }
 if(u.roomType!=='bathroom'&&(u.x+u.y+u.z)%5===0)add('water_cooler',.12,.86,'Bebedouro');
 roomCaches.set(u,{key,items});return items;
}
export function furnitureInteraction(b,u,kind,slot=0){
 const items=roomFurniture(b,u);let item;
 if(kind==='sink')item=items.find(f=>f.type==='sink');
 else if(kind==='cleaning'){const toilet=items.find(f=>f.type==='toilet');if(toilet)item={...toilet,seated:false};}
 else if(kind==='water_cooler')item=items.find(f=>f.type==='water_cooler');
 else if(kind==='bedroom')item=items.find(f=>f.type==='bed');
 else if(kind==='service'){const counter=items.find(f=>f.type==='counter'||f.workstation||f.type==='table');if(counter)item={...counter,seated:false};}
 else if(kind==='dining')item=items.filter(f=>f.type==='chair')[slot%4];
 else if(kind==='bathroom')item=items.find(f=>f.type==='toilet');
 else if(['workspace','office','plenary'].includes(kind))item=items.find(f=>f.type==='chair')||items.find(f=>f.workstation);
 if(!item)return null;
 const at=kind==='service'?{x:item.x+(slot%2?.16:-.16),y:item.y-.33-Math.floor(slot/2)*.14}:kind==='sink'||kind==='cleaning'?{x:item.x,y:item.y-.22}:kind==='water_cooler'?{x:item.x+.18,y:item.y-.12}:item.workstation&&!item.seated?{x:item.x,y:item.y-.37}:item;
 return {item,point:{x:b.entity.x+at.x,y:b.entity.y+at.y,z:u.z*1.8},facing:item.facing?{x:b.entity.x+item.facing.x,y:b.entity.y+item.facing.y}:{x:b.entity.x+item.x,y:b.entity.y+item.y+.4}};
}

export function roomFurnitureForCity(city,b,u){
 const tenant=b.type==='office_tower'&&city?.accounts.get(u.occupantId);
 if(tenant?.officeTenantOf===b.id){const actual=tenant.units.find(room=>room.x===u.x&&room.y===u.y&&room.z===u.z);if(actual)return roomFurniture(tenant,actual);}
 return roomFurniture(b,u);
}
