import {CIVIC_SERVICES} from './city_public_services.js';
import {INDUSTRIES} from './city_industries.js';

// Activity semantics are intentionally independent of the renderer. Every
// registered building type gets a documented interior/outdoor work profile.
const exact=new Map();
const assign=(profile,types)=>types.forEach(type=>exact.set(type,Object.freeze({...profile,type})));
assign({group:'habitação',roomTypes:['bedroom','bathroom','dining'],station:'cama, banheiro e mesa',fallback:'cômodo residencial compatível'},['residential','super_popular_housing','popular_housing','popular_luxury_housing','luxury_housing']);
assign({group:'saúde pública',roomTypes:['treatment','waiting','office'],station:'atendimento clínico e espera',fallback:'sala de tratamento'},['hospital','clinic']);
assign({group:'serviço cívico',roomTypes:['service','waiting','office'],station:'atendimento e espera',fallback:'balcão cívico'},['park','sports_center','library','theater','leisure','utility','public_toilet','paid_toilet']);
assign({group:'governo',roomTypes:['workspace','office','plenary'],station:'gabinete, plenário ou guichê',fallback:'mesa de trabalho administrativa'},['townhall','council_chamber','mint','popular_refectory']);
assign({group:'escritório',roomTypes:['office','workspace','waiting'],station:'mesa e área de atendimento',fallback:'estação de trabalho no andar alugado'},['office_tower','research_institute','newsroom']);
assign({group:'finanças',roomTypes:['workspace','office','waiting'],station:'mesa de atendimento financeiro',fallback:'estação de trabalho financeira'},['bank']);
assign({group:'comércio',roomTypes:['service','waiting','workspace'],station:'balcão e estoque',fallback:'balcão de serviço'},['market','bakery','greengrocer','cycle_shop','sports_shop','cycle_workshop','bicycle_rental','clothing_store','laundromat','thrift_store','pharmacy','publisher','pottery','artisan']);
assign({group:'produção',roomTypes:['workspace','service'],station:'bancada de produção',fallback:'bancada genérica de oficina'},Object.keys(INDUSTRIES).filter(type=>!exact.has(type)&&!['farm','forestry','dairy_farm','fiber_farm','herb_farm','rubber_grove','iron_mine','bauxite_mine','clay_pit','sand_pit','quarry'].includes(type)));
assign({group:'atividade ao ar livre',roomTypes:['workspace','bathroom','dining'],station:'célula de plantio, extração ou obra',fallback:'atividade externa; banheiro/refeitório físico local quando construído'},['farm','forestry','dairy_farm','fiber_farm','herb_farm','rubber_grove','iron_mine','bauxite_mine','clay_pit','sand_pit','quarry']);
assign({group:'infraestrutura e logística',roomTypes:['workspace','service','waiting'],station:'posto de serviço e pátio',fallback:'área operacional ou guichê'},['bike_rack','mill','cleaner','waste_collector','recycler','builder','lamp_service','carrier']);

export function buildingActivityProfile(type){return exact.get(type)||null;}
export function buildingPrimaryWorkRoom(type){return exact.get(type)?.roomTypes?.[0]||'workspace';}
export const BUILDING_ACTIVITY_PROFILE_TYPES=Object.freeze([...exact.keys()].sort());
