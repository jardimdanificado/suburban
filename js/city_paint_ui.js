import {COLOR_PALETTE,colorName,colorAffinity,favoriteColors,factoryColors,normalizeColor,buildingColor} from './city_colors.js';
import {formatMoney as money} from './city_ui_format.js';
function chooser(ui,p,initial){
 const color=ui.paintColor||initial||COLOR_PALETTE[0].hex;p.kv('Cor selecionada',colorName(color));
 p.buttons(COLOR_PALETTE.map(c=>({label:c.name,selected:c.hex===color,click:()=>{ui.paintColor=c.hex;}})));
 p.button('ESCOLHER COR PERSONALIZADA (#RRGGBB)',()=>{const value=globalThis.prompt?.('Cor hexadecimal (#RRGGBB)',color),hex=normalizeColor(value);if(hex)ui.paintColor=hex;});return color;
}
function jobs(ui,p,list){for(const j of list.slice(-12).reverse())p.record(`Pintura #${j.id} · ${colorName(j.color)}`,`${({delivery:'Levar veículo à oficina',ready:'Aguarda tinta / pagamento / equipe',painting:'Em pintura',completed:'Concluída',cancelled:'Cancelada'})[j.status]} · ${j.labor.toFixed(0)}/${j.requiredLabor} · ${j.quantity} latas${j.price?' · '+money(j.price):''}`,()=>{});}
export function renderColorPreferences(ui,p,c){
 p.heading('CORES E GOSTOS PESSOAIS');p.note('A cor influencia roupas, a escolha de imóveis e veículos. Alimentos, abrigo, preço e utilidade continuam tendo prioridade.');
 p.table([{label:'Cor'},{label:'Afinidade'}],favoriteColors(c).map(color=>({cells:[color.name,`${Math.round(colorAffinity(c,color.hex)*100)}%`]})));
 const color=chooser(ui,p,favoriteColors(c)[0].hex);p.heading('TINTA PRÓPRIA');
 for(const l of c.paintBag?.paintLots||[])p.kv(`${colorName(l.color)} · ${l.producerName}`,`${l.quantity} lata(s)`);
 if(c.paintPurchase)p.note(`Compra pendente: ${colorName(c.paintPurchase.color)}. Aguarda estoque e deslocamento à fábrica.`);
 for(const b of ui.city.economy.businesses.filter(b=>b.type==='paintworks'&&b.active&&!b.entity.destroyed).slice(0,4)){
  p.heading(b.entity.properties.name);const available=ui.city.paint.available(b,color);p.kv('Disponível nessa cor',available);
  if(available)p.button(`COMPRAR 1 LATA · ${money(ui.city.paint.quote(b,color))}`,()=>ui.city.paint.requestPurchase(c.id,b.id,color));
  p.button(`ENCOMENDAR 1 LATA · ${money(Math.ceil(ui.city.economy.goods.tinta.price*1.75))}`,()=>ui.city.paint.requestPurchase(c.id,b.id,color,true));
 }p.note('A pessoa vai à fábrica buscar a tinta. Encomendas entram na produção real e custam pelo menos 75% a mais.');
}
export function renderFactoryPaint(ui,p,b){
 p.heading('TINTAS · CORES E ENCOMENDAS');p.kv('Paleta da fábrica',factoryColors(b).map(colorName).join(' · '));
 p.table([{label:'Cor'},{label:'Latas'},{label:'Preço / lata'}],ui.city.paint.stock(b).map(l=>({cells:[colorName(l.color),l.quantity,money(Math.ceil(ui.city.economy.goods.tinta.price*(l.premium?1.75:1)))]})));
 const color=chooser(ui,p,factoryColors(b)[0]);p.button('INCLUIR COR NA PALETA PADRÃO',()=>ui.city.paint.setPalette(b.id,[color,...factoryColors(b).filter(c=>c!==color).slice(0,3)]));
 p.note('Óleo de girassol + argila + ervas → tinta. A fábrica alterna sua paleta; encomendas de cores específicas têm prioridade no próximo lote.');
 for(const order of b.paintColorOrders||[])p.kv('Próximo lote encomendado',colorName(order.color));
}
export function renderBuildingPaint(ui,p,b){
 const city=ui.city,color=chooser(ui,p,normalizeColor(buildingColor(b)));p.heading('PINTAR PAREDES');
 const owners=[...new Set(b.units.map(u=>u.ownerId))];ui.paintPayer=owners.includes(ui.paintPayer)?ui.paintPayer:owners[0];
 p.buttons(owners.map(id=>({label:city.accountName(id),selected:id===ui.paintPayer,click:()=>{ui.paintPayer=id;}})));
 p.note('Cada dono pode pintar seus próprios cômodos. A construtora usa tinta real, cobra materiais e mão de obra e desloca um funcionário para o serviço.');
 p.button('CONTRATAR PINTURA COM TINTA DA CONSTRUTORA',()=>city.paint.requestBuilding(b.id,ui.paintPayer,color));
 p.button('CONTRATAR PINTURA LEVANDO TINTA PRÓPRIA',()=>city.paint.requestBuilding(b.id,ui.paintPayer,color,true));
 jobs(ui,p,city.paint.jobs.filter(j=>j.buildingId===b.id));
}
export function renderVehiclePaint(ui,p,v){
 if(!['bicicleta','bicicleta_carga','patinete'].includes(v.good))return;
 const city=ui.city;p.heading('COR, PINTURA E BANDEIRA');p.kv('Cor atual',colorName(v.color));
 if(v.active&&!v.scrapped){const color=chooser(ui,p,v.color),garages=city.economy.businesses.filter(b=>b.type==='cycle_workshop'&&b.active&&!b.entity.destroyed);
  for(const b of garages.slice(0,3)){p.kv(`Tinta em ${b.entity.properties.name}`,`${city.paint.available(b,color)} lata(s) nessa cor`);p.button(`PINTAR EM ${b.entity.properties.name}`,()=>city.paint.requestVehicle(v.id,b.id,color));p.button('LEVAR TINTA PRÓPRIA À OFICINA',()=>city.paint.requestVehicle(v.id,b.id,color,true));}
  p.note('O dono leva o veículo à oficina. A pintura exige tinta, pagamento e trabalho de um mecânico.');
  if(v.mountedFlag){p.kv('Bandeira instalada',v.mountedFlag.partyName);p.button('RETIRAR E GUARDAR BANDEIRA',()=>city.vehicles.removeFlag(v.id));}
  else p.buttons(city.politics.parties.filter(party=>party.active).map(party=>({label:`BANDEIRA ${party.short}`,click:()=>city.vehicles.mountFlag(v.id,party.id)})));
  p.note('Instalar usa uma bandeira do proprietário ou compra uma unidade disponível. Militantes também podem levar a bandeira que já carregam na bicicleta.');
 }
 jobs(ui,p,city.paint.jobs.filter(j=>j.vehicleId===v.id));
 for(const row of v.paintHistory||[])p.kv(`Pintura no dia ${Math.floor(row.minute/1440)+1}`,`${colorName(row.color)} · ${money(row.price)} · ${row.materials.map(l=>l.producerName).join(', ')}`);
}
