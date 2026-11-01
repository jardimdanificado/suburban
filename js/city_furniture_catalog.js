import {INDUSTRIES} from './city_industries.js';
const roomCaches=new WeakMap();
const HOUSING_FURNITURE_TYPES=new Set(['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing']);
// Task semantics live beside the equipment catalogue so simulation and
// renderer can agree about what a person is trying to use. `none` is an
// intentional spatial task (travel/escort), never an unclassified activity.
export const TASK_FURNITURE_PROFILES=Object.freeze({
 energy:{item:['bed','cot'],pose:'lying',room:['bedroom','cell']},toilet:{item:['toilet'],pose:'seated',room:['bathroom','cell']},hygiene:{item:['shower','sink'],pose:'use',room:['bathroom']},
 water:{item:['water_cooler','pump','counter'],pose:'use',room:['service','workspace','bathroom']},food:{item:['chair','counter'],pose:'use',room:['dining','service']},workmeal:{item:['chair'],pose:'seated',room:['dining']},provisions:{item:['chair','fridge','pantry'],pose:'use',room:['dining','bedroom']},supplies:{item:['shelf','counter'],pose:'use',room:['service','workspace']},
 care:{item:['crib','bed'],pose:'use',room:['bedroom']},caregiving:{item:['chair','play_mat'],pose:'seated',room:['bedroom','dining']},health:{item:['exam_bed','chair'],pose:'lying',room:['treatment']},
 work:{item:['workstation'],pose:'work',room:['workspace','office','plenary']},manage:{item:['desk'],pose:'seated',room:['office','workspace']},'work-wait':{item:['chair','bench'],pose:'seated',room:['waiting','office']},construction:{item:['workstation','blueprint_table'],pose:'work',room:['workspace','office']},
 'job-interview':{item:['meeting_chair','desk'],pose:'seated',room:['office','service']},interview:{item:['meeting_chair'],pose:'seated',room:['office','treatment']},research:{item:['desk','lab'],pose:'work',room:['workspace','office']},'council-session':{item:['council_chair','podium'],pose:'seated',room:['plenary','office']},vote:{item:['ballot_booth'],pose:'use',room:['service','office']},
 clean:{item:['cleaning_kit','broom','toilet'],pose:'use',room:['workspace','bathroom']},'informal-service':{item:['cleaning_kit','gardening_kit','workstation'],pose:'work',room:['workspace','service']},shopping:{item:['washer','rack','counter'],pose:'use',room:['laundry','service']},
 leisure:{item:['sofa','chair','bench'],pose:'seated',room:['dining','service','office']},social:{item:['sofa','chair','bench'],pose:'seated',room:['dining','office','service']},visit:{item:['sofa','chair'],pose:'seated',room:['dining','bedroom']},sit:{item:['bench','chair'],pose:'seated',room:['waiting']},outdoor_leisure:{item:['chair','bench'],pose:'seated',room:['balcony','roof_terrace']},
 'justice-report':{item:['service_desk','counter','evidence_counter'],pose:'use',room:['service','office']},'police-patrol':{item:['equipment_locker','desk'],pose:'use',room:['office','workspace']},'police-response':{item:['dispatch_desk'],pose:'use',room:['office','service']},'police-investigation':{item:['evidence_board','desk'],pose:'work',room:['office','workspace']},'police-oversight':{item:['desk','evidence_board'],pose:'work',room:['office']},'police-restitution':{item:['evidence_counter','cabinet'],pose:'use',room:['service','office']},'police-arrest-escort':{item:[],pose:'travel',room:[]},
 custody:{item:['cot','toilet','tray_table'],pose:'use',room:['cell']},'custody-escort':{item:[],pose:'travel',room:[]},'custody-water':{item:['pump','reservoir'],pose:'use',room:['service','workspace']},funeral:{item:['gurney','desk'],pose:'use',room:['treatment','workspace']},'paint-purchase':{item:['counter','paint_rack'],pose:'use',room:['service','workspace']},'paint-delivery':{item:['loading_dock','shelf'],pose:'use',room:['workspace','service']},campaign:{item:['podium','counter'],pose:'use',room:['service','workspace']},'urban-graffiti':{item:['paint_station'],pose:'work',room:['workspace']},transport:{item:['loading_dock'],pose:'work',room:['workspace','service']},
 'lake-water':{item:[],pose:'collect',room:[]},'combat-flee':{item:[],pose:'travel',room:[]},walk:{item:[],pose:'travel',room:[]},'outdoor-work':{item:[],pose:'work',room:[]},
});
// Every task also declares where its physical activity happens. Empty furniture
// lists are valid only for these moving or outdoor destinations.
export const TASK_DESTINATION_KINDS=Object.freeze({
 energy:'home',toilet:'bathroom-service',hygiene:'home-or-service',water:'utility',food:'meal-service',workmeal:'employer-refectory',provisions:'carried-meal-or-home',supplies:'supply-service',care:'home',caregiving:'child-or-home',health:'clinic',work:'workplace-or-field',manage:'business',
 'work-wait':'workplace-or-queue',construction:'construction-site', 'job-interview':'employer',interview:'interview-partner',research:'research-site', 'council-session':'council-chamber',vote:'townhall',clean:'cleaning-assignment','informal-service':'gig-site',shopping:'shop-or-laundromat',leisure:'leisure-site',social:'social-partner-or-venue',visit:'host-home',sit:'public-seat',outdoor_leisure:'balcony-or-roof',
 'justice-report':'police-station-counter','police-patrol':'patrol-route','police-response':'incident-scene','police-investigation':'case-scene-and-witness','police-oversight':'oversight-office','police-restitution':'person-and-handoff','police-arrest-escort':'person-to-custody',custody:'reserved-jail-cell','custody-escort':'escorted-route','custody-water':'water-source-to-jail',funeral:'body-and-ceremony-site',
 'paint-purchase':'paint-counter','paint-delivery':'delivery-site',campaign:'public-event','urban-graffiti':'artwork-site',transport:'loading-route','lake-water':'lake-edge','combat-flee':'safe-refuge',walk:'street-route','outdoor-work':'field-or-open-worksite',
});
export function taskFurnitureProfile(task){const profile=TASK_FURNITURE_PROFILES[task];return profile?{...profile,destination:taskDestinationKind(task)}:null;}
export function taskDestinationKind(task){return TASK_DESTINATION_KINDS[task]||null;}
const FURNITURE_FOOTPRINTS=Object.freeze({bed:[.4,.3],cot:[.54,.3],toilet:[.2,.24],sink:[.24,.19],shower:[.29,.29],table:[.52,.32],chair:[.18,.18],bench:[.63,.24],sofa:[.54,.3],desk:[.52,.32],counter:[.52,.32],workbench:[.52,.34],saw:[.48,.34],rollers:[.5,.26],welding:[.52,.32],assembly:[.52,.32],sewing:[.48,.27],loom:[.48,.2],washer:[.4,.36],rack:[.52,.24],coop:[.52,.24],fridge:[.25,.25],chest:[.3,.25],water_cooler:[.18,.18],pump:[.5,.3],furnace:[.52,.38],kiln:[.52,.38],stove:[.52,.38],press:[.48,.36],drill:[.48,.36],lathe:[.52,.3],vat:[.45,.32],tap:[.45,.34],mill:[.48,.34],wheel:[.48,.34],sieve:[.52,.36],lab:[.5,.3],crib:[.5,.34],play_mat:[.4,.36],exam_bed:[.55,.34],ballot_booth:[.4,.36],evidence_board:[.48,.12],filing_cabinet:[.25,.27],broom:[.1,.1],cleaning_kit:[.28,.24],gardening_kit:[.28,.24],podium:[.36,.29],bookshelf:[.48,.24],shelf:[.48,.25],pantry:[.32,.24],service_desk:[.52,.32],dispatch_desk:[.52,.32],evidence_counter:[.52,.32],equipment_locker:[.34,.25],reservoir:[.38,.32],tray_table:[.32,.24],gurney:[.56,.32],paint_rack:[.52,.24],paint_station:[.48,.3],loading_dock:[.55,.4],blueprint_table:[.52,.36],cabinet:[.3,.27],council_chair:[.18,.18],meeting_chair:[.18,.18]});
const machines={steel_mill:['furnace','Forno siderúrgico'],bauxite_mine:['drill','Perfuratriz de bauxita'],aluminum_smelter:['furnace','Forno de alumínio'],rubber_grove:['tap','Bancada de extração de látex'],rubberworks:['rollers','Misturador de borracha'],bearing_factory:['lathe','Torno de rolamentos'],frame_factory:['welding','Gabarito de solda de quadros'],deck_factory:['saw','Serra de plataformas'],tire_factory:['press','Prensa de rodas'],chain_factory:['lathe','Montadora de correntes'],safety_equipment:['press','Prensa de capacetes'],saddle_factory:['sewing','Bancada de selins'],cycle_parts:['lathe','Torno de peças'],sports_shoes:['sewing','Costura de botas'],skate_workshop:['assembly','Bancada de skates'],cycle_assembler:['assembly','Linha de montagem'],cycle_shop:['counter','Balcão da concessionária'],sports_shop:['counter','Balcão esportivo'],cycle_workshop:['welding','Cavalete de manutenção'],bicycle_rental:['rack','Rack da locadora'],kitchen:['stove','Fogão e bancada de preparo'],artisan:['workbench','Bancada de cestaria'],forestry:['saw','Bancada florestal'],sawmill:['saw','Serra de tábuas'],charcoal:['kiln','Forno de carvão'],iron_mine:['drill','Perfuratriz de ferro'],foundry:['furnace','Forno de fundição'],toolmaker:['lathe','Torno de ferramentas'],clay_pit:['drill','Extrator de argila'],brickworks:['kiln','Forno de tijolos'],sand_pit:['sieve','Peneira de areia'],glassworks:['furnace','Forno de vidro'],furniture:['saw','Bancada de marcenaria'],fiber_farm:['rack','Secador de fibras'],flagmaker:['sewing','Costura de bandeiras'],paintworks:['vat','Misturador de pigmentos'],weaving:['loom','Tear'],newsroom:['desk','Mesa da redação'],clothing_store:['rack','Arara de roupas'],laundromat:['washer','Máquina de lavar'],thrift_store:['rack','Arara do brechó'],tailor:['sewing','Máquina de costura'],dairy_farm:['vat','Tanque de leite'],cheesemaker:['vat','Cuba de queijo'],poultry:['coop','Ninhos e comedouros'],flour_mill:['mill','Moenda de farinha'],pasta_factory:['rollers','Laminador de massas'],cannery:['vat','Tanque de conservas'],soapworks:['vat','Tanque de sabão'],herb_farm:['rack','Secador de ervas'],pharmacy:['lab','Bancada de medicamentos'],paper_mill:['press','Prensa de papel'],publisher:['press','Prensa de encadernação'],pottery:['wheel','Roda de oleiro'],composting:['composter','Leira de compostagem'],research_institute:['desk','Mesa de pesquisa'],bank:['desk','Mesa de atendimento bancário']};
export const WORKSTATIONS=Object.freeze(Object.fromEntries(Object.keys(INDUSTRIES).map(type=>[type,{kind:machines[type]?.[0]||'workbench',label:machines[type]?.[1]||INDUSTRIES[type].label,inputs:Object.keys(INDUSTRIES[type].inputs),outputs:Object.keys(INDUSTRIES[type].outputs),seated:machines[type]?.[0]==='desk'||machines[type]?.[0]==='sewing'}])));
const basic={townhall:['desk','Mesa administrativa'],council_chamber:['desk','Mesa parlamentar'],police_station:['dispatch_desk','Mesa de despacho policial'],builder:['desk','Prancheta de obras'],carrier:['desk','Mesa de despacho'],lamp_service:['workbench','Bancada de lamparinas'],cleaner:['washer','Posto de higienização'],waste_collector:['sieve','Triagem de resíduos'],recycler:['press','Prensa de reciclagem'],mint:['press','Prensa de moedas'],bakery:['stove','Forno de pão'],restaurant:['stove','Fogão profissional'],mill:['mill','Prensa de óleo'],market:['counter','Balcão de vendas'],greengrocer:['counter','Banca de hortaliças'],popular_refectory:['stove','Bancada do refeitório'],quarry:['drill','Equipamento da pedreira'],clinic:['lab','Bancada clínica'],hospital:['lab','Posto de enfermagem'],utility:['pump','Bomba de abastecimento']};
export function workstationFor(type){return WORKSTATIONS[type]||{kind:basic[type]?.[0]||'desk',label:basic[type]?.[1]||'Posto de atendimento',seated:!basic[type]||['desk','dispatch_desk'].includes(basic[type][0]),inputs:[],outputs:[]};}
export function roomFurniture(b,u){
 const key=`${b.type}:${u.roomType}:${b.layoutRevision||0}`,cached=roomCaches.get(u);if(cached?.key===key)return cached.items;
 const items=[],add=(type,x,y,label,extra={})=>{const size=FURNITURE_FOOTPRINTS[type]||[.42,.32],f={id:`furniture:${u.id}:${type}:${items.length}`,unitId:u.id,roomType:u.roomType,type,x:u.x+x,y:u.y+y,z:u.z,label,footprint:{width:size[0],depth:size[1]},visualScale:.8,...extra};items.push(f);return f;},chair=(x,y,fx,fy,label='Cadeira')=>add('chair',x,y,label,{seated:true,visualScale:.62,facing:{x:u.x+fx,y:u.y+fy}});
 if(u.roomType==='bedroom'){add('bed',.25,.18,'Beliche familiar · dois leitos',{sleeping:true,bunk:true,capacity:2,visualScale:.55});add('bed',.75,.18,'Beliche familiar · dois leitos',{sleeping:true,bunk:true,capacity:2,visualScale:.55});add('chest',.16,.68,'Baú de roupas e itens',{storage:'clothes'});add('fridge',.84,.68,'Geladeira doméstica',{storage:'food'});if(HOUSING_FURNITURE_TYPES.has(b.type)){add('crib',.5,.82,'Berço',{childOnly:true,visualScale:.62,footprint:{width:.36,depth:.28}});chair(.5,.5,.6,.75,'Cadeira de cuidado e visita');}}
 else if(u.roomType==='cell'){add('cot',.28,.55,'Catre da cela',{sleeping:true});add('toilet',.76,.72,'Sanitário da cela',{seated:true});add('tray_table',.75,.22,'Mesa rebatível da cela');add('chest',.2,.84,'Armário da cela');}
 else if(u.roomType==='bathroom'){add('toilet',.68,.16,'Vaso sanitário',{seated:true,facing:{x:u.x+.68,y:u.y+.41}});add('sink',.24,.25,'Lavatório');add('shower',.5,.5,'Área de banho');add('cleaning_kit',.2,.55,'Armário de limpeza');}
 else if(u.roomType==='dining'){add('table',.5,.5,'Mesa de refeições');chair(.14,.5,.5,.5);chair(.86,.5,.5,.5);chair(.5,.14,.5,.5);chair(.5,.86,.5,.5);if((u.x+u.y)%4===0)add('fridge',.87,.87,'Geladeira do refeitório',{storage:'food'});}
 else if(u.roomType==='treatment'){if(['iml','crematorium'].includes(b.type))add('gurney',.36,.55,'Maca de transporte');else add('exam_bed',.32,.55,'Maca de atendimento');add('lab',.72,.18,'Mesa clínica');chair(.75,.84,.72,.18,'Cadeira de atendimento');}
 else if(u.roomType==='laundry'){add('washer',.5,.72,'Máquina de lavar');add('chest',.82,.3,'Baú de roupas');}
 else if(u.roomType==='service'){add(b.type==='police_station'?'evidence_counter':'counter',.5,.78,b.type==='police_station'?'Balcão de evidências':'Balcão de atendimento');const retail=['market','bakery','greengrocer','restaurant','clothing_store','sports_shop','cycle_shop','thrift_store','pharmacy','paintworks'].includes(b.type);if(retail){add('rack',.26,.25,'Expositor de produtos',{visualScale:.62,footprint:{width:.4,depth:.2}});add('shelf',.74,.25,'Prateleira de produtos',{visualScale:.65,footprint:{width:.38,depth:.2}});}else add('shelf',.25,.25,'Prateleira de serviço');if(['police_station','courthouse','iml','crematorium'].includes(b.type)){if(b.type==='police_station')add('equipment_locker',.78,.25,'Armário de equipamento');else add('filing_cabinet',.76,.25,'Arquivo de serviço');}}
 else if(u.roomType==='waiting'){if(['library','theater','leisure','park','sports_center'].includes(b.type))add('sofa',.5,.5,'Assento coletivo',{capacity:2});else add('bench',.5,.5,'Banco de espera',{capacity:2});}
 else if(u.roomType==='balcony'){add('chair',.25,.5,'Cadeira de varanda',{seated:true,facing:{x:u.x+.5,y:u.y+.2},visualScale:.62});add('table',.72,.18,'Mesa lateral de varanda',{visualScale:.62});}
 else if(u.roomType==='roof_terrace'){add('sofa',.5,.5,'Assento da cobertura',{capacity:4});}
 else if(u.roomType!=='circulation'){
  const w=workstationFor(b.type),justice=['police_station','council_oversight_office','courthouse','iml'].includes(b.type),stationX=.5,stationY=.5;add(w.kind,stationX,stationY,w.label,{workstation:true,requiresSeat:w.seated,visualScale:u.roomType==='plenary'?.62:.8});
  if(u.roomType==='plenary'){chair(.5,.13,.5,.5,'Assento parlamentar');chair(.13,.5,.5,.5,'Assento parlamentar');chair(.87,.5,.5,.5,'Assento parlamentar');chair(.5,.87,.5,.5,'Assento parlamentar');}
  else if(w.seated||u.roomType==='office')chair(.5,.16,.5,.5,'Cadeira de trabalho');
  if(u.roomType==='office'&&!justice)chair(.15,.15,.5,.5,'Cadeira de visitante');
  if(justice){add('evidence_board',.25,.82,'Quadro de evidências');if(b.type==='police_station')add('equipment_locker',.82,.82,'Armário de equipamento');else add('filing_cabinet',.82,.82,'Arquivo de processos');}
  if(u.roomType==='workspace'&&!justice&&(u.x+u.y)%5===0)add('chest',.18,.18,'Armário de ferramentas');
 }
 const stairCell=u.x===Math.floor(b.width/2)&&u.y===Math.floor(b.depth/2);
 if(['workspace','service','office','plenary','treatment','waiting'].includes(u.roomType)&&!stairCell)add('water_cooler',.12,.86,'Bebedouro');
 if(b.type==='townhall'&&u.roomType==='service')add('ballot_booth',.78,.28,'Cabine de votação');
 if(['builder','carrier','waste_collector','recycler','lamp_service'].includes(b.type)&&u.roomType==='workspace')add('loading_dock',.78,.84,'Área de expedição',{visualScale:.62,footprint:{width:.4,depth:.3}});
 roomCaches.set(u,{key,items});return items;
}
export function furnitureInteraction(b,u,kind,slot=0,task=null){
 const items=roomFurniture(b,u);let item;
 const profile=taskFurnitureProfile(task),types=profile?.item||[];
 const pick=type=>items.find(f=>f.type===type),workstation=items.find(f=>f.workstation);
 if(task==='energy'){const beds=items.filter(f=>['bed','cot'].includes(f.type));item=beds[Math.floor(slot/2)%Math.max(1,beds.length)]||null;}
 else if(task==='toilet')item=pick('toilet');
 else if(task==='hygiene')item=pick('shower')||pick('sink');
 else if(['food','workmeal'].includes(task)&&kind==='dining')item=items.filter(f=>f.type==='chair')[slot%Math.max(1,items.filter(f=>f.type==='chair').length)];
 else if(task==='care')item=pick('crib')||pick('bed');
 else if(task==='health')item=pick('exam_bed')||pick('bed');
 else if(task==='vote')item=pick('ballot_booth')||pick('counter');
 else if(['job-interview','interview','visit','social','leisure','sit','work-wait','caregiving','outdoor_leisure'].includes(task))item=items.filter(f=>['chair','bench','sofa','council_chair'].includes(f.type))[slot%Math.max(1,items.filter(f=>['chair','bench','sofa','council_chair'].includes(f.type)).length)];
 else if(task==='police-investigation')item=pick('evidence_board')||workstation;
 else if(task==='police-oversight')item=pick('evidence_board')||pick('desk')||workstation;
 else if(task==='police-patrol')item=pick('equipment_locker')||pick('desk')||workstation;
 else if(task==='police-response'){const station=pick('dispatch_desk')||pick('desk')||workstation;item=station?.requiresSeat?pick('chair')||station:station;}
 else if(task==='police-restitution')item=pick('evidence_counter')||pick('counter')||pick('desk');
 else if(task==='justice-report')item=pick('service_desk')||pick('counter')||pick('evidence_counter')||workstation;
 else if(task==='custody')item=pick('cot')||pick('toilet');
 else if(task==='funeral')item=pick('gurney')||pick('exam_bed')||workstation;
 else if(task==='custody-water'||task==='water')item=pick('water_cooler')||pick('pump')||pick('counter')||workstation;
 else if(task==='shopping')item=b.type==='laundromat'?pick('washer'):pick('rack')||pick('counter');
 else if(task==='provisions'&&kind==='dining')item=items.filter(f=>f.type==='chair')[slot%Math.max(1,items.filter(f=>f.type==='chair').length)];
 else if(task==='supplies'||task==='provisions')item=pick('fridge')||pick('pantry')||pick('shelf')||pick('counter');
 else if(task==='paint-purchase'||task==='campaign')item=pick('counter')||pick('rack')||pick('podium')||workstation;
 else if(task==='paint-delivery'||task==='transport')item=pick('loading_dock')||pick('shelf')||workstation;
 else if(task==='urban-graffiti')item=pick('paint_station')||workstation;
 else if(task==='clean'||task==='informal-service')item=pick('cleaning_kit')||pick('broom')||pick('gardening_kit')||workstation;
 else if(task==='construction')item=pick('blueprint_table')||workstation;
 else if(task==='council-session')item=items.filter(f=>f.type==='chair')[slot%Math.max(1,items.filter(f=>f.type==='chair').length)]||pick('podium')||workstation;
 else if(types.includes('workstation'))item=workstation?.requiresSeat?pick('chair')||workstation:workstation||pick('desk');
 else if(kind==='sink')item=pick('sink');
 else if(kind==='cleaning'){const toilet=pick('toilet');if(toilet)item={...toilet,seated:false};}
 else if(kind==='water_cooler')item=items.find(f=>f.type==='water_cooler');
 else if(kind==='bedroom')item=items.find(f=>f.type==='bed');
 else if(kind==='service'){const counter=items.find(f=>f.type==='counter'||f.workstation||f.type==='table');if(counter)item={...counter,seated:false};}
 else if(kind==='dining')item=items.filter(f=>f.type==='chair')[slot%4];
 else if(kind==='bathroom')item=items.find(f=>f.type==='toilet');
 else if(['workspace','office','plenary'].includes(kind))item=items.find(f=>f.type==='chair')||workstation;
 if(!item)return null;
 const pose=item.seated?'seated':profile?.pose||'use',hw=(item.footprint?.width||.4)/2,hd=(item.footprint?.depth||.3)/2,clear=.13;
 const berth=task==='energy'&&item.bunk?slot%2:0,posePoint={x:b.entity.x+item.x,y:b.entity.y+item.y,z:u.z*1.8+(berth?.78:.18)};let at={x:item.x,y:item.y};
 if(pose==='lying')at={x:item.x,y:item.y+hd+clear};
 else if(!item.seated){
  const candidates=[{x:item.x,y:item.y+hd+clear},{x:item.x-hw-clear,y:item.y},{x:item.x+hw+clear,y:item.y},{x:item.x,y:item.y-hd-clear}];
  const free=p=>p.x>=u.x+.08&&p.x<=u.x+.92&&p.y>=u.y+.08&&p.y<=u.y+.92&&!items.some(other=>other!==item&&Math.abs(p.x-other.x)<(other.footprint?.width||.4)/2+.09&&Math.abs(p.y-other.y)<(other.footprint?.depth||.3)/2+.09);
  at=candidates.find(free)||candidates.find(p=>p.x>=u.x&&p.x<=u.x+1&&p.y>=u.y&&p.y<=u.y+1)||candidates[0];
 }
 const point={x:b.entity.x+at.x,y:b.entity.y+at.y,z:u.z*1.8},facing=item.facing?{x:b.entity.x+item.facing.x,y:b.entity.y+item.facing.y}:{x:b.entity.x+item.x,y:b.entity.y+item.y},taskStation=item.type==='chair'&&workstation?.requiresSeat?workstation:item;
 return {item,taskStation,slot,pose,point,posePoint,facing};
}

export function roomFurnitureForCity(city,b,u){
 const tenant=b.type==='office_tower'&&city?.accounts.get(u.occupantId);
 if(tenant?.officeTenantOf===b.id){const actual=tenant.units.find(room=>room.x===u.x&&room.y===u.y&&room.z===u.z);if(actual)return roomFurniture(tenant,actual);}
 return roomFurniture(b,u);
}
