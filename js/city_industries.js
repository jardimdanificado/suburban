// Every batch reserves real inputs and requires paid, on-site work. Prices are cents.
export const INDUSTRIAL_GOODS = Object.fromEntries([
  ['bandeiras','Bandeiras de tecido',2400],['faixas','Faixas de campanha',3600],['tinta','Tinta de fachada',1200],['cesta','Cesta de carga',1400],['carrinho','Carrinho de carga',4800],['marmita','Marmita completa',850],['marmita_simples','Marmita de arroz e feijão',600],['marmita_rustica','Marmita da roça',750],['madeira','Madeira',180],['tabuas','Tábuas',520],['carvao','Carvão vegetal',450],['minerio','Minério de ferro',600],['ferro','Ferro',1600],['ferramentas','Ferramentas',4200],
  ['argila','Argila',120],['tijolos','Tijolos',650],['areia','Areia',180],['vidro','Vidro',1200],['moveis','Móveis',4200],['fibras','Fibras vegetais',150],['tecido','Tecido',650],['roupas','Roupas',1900],
  ['leite','Leite',200],['queijo','Queijo',750],['ovos','Ovos',180],['farinha','Farinha',320],['massa','Macarrão',700],['conserva','Conserva',600],['sabao','Sabão',1000],
  ['ervas','Ervas medicinais',220],['remedio','Remédio',1800],['papel','Papel',500],['jornais','Jornais',3200],['livros','Livros',4300],['panfletos','Panfletos',700],['ceramica','Cerâmica',850],['adubo','Adubo orgânico',350],
].map(([id,label,price])=>[id,{label,price}]));
const industry = (label, inputs, outputs, labor, skill, impact, category='industry', use=null) => ({ label, inputs, outputs, labor, skill, impact, category, use, color: category==='food'?0xc6a363:category==='services'?0x87b7bc:0xa6a0ba, rent:90, price:80000, jobs:2 });
export const INDUSTRIES = {
  kitchen: industry('Cozinha e marmitaria',{feijao:2,arroz:2,alface:1,tomate:1},{marmita:3},18,'baking','Prepara marmitas com ingredientes reais e preserva suas preferências.','food'),
  artisan: industry('Loja do artesão',{madeira:3,fibras:2},{cesta:2,carrinho:1},24,'construction','Artesanato em madeira: cestas e carrinhos ampliam a capacidade individual de transporte.','services',{need:'energy',boost:0}),
  forestry: industry('Silvicultura',{}, {madeira:4},45,'agriculture','Replantio obrigatório; sustenta móveis, papel e combustível.'),
  sawmill: industry('Serraria',{madeira:3},{tabuas:5},18,'maintenance','Madeira beneficiada para mobiliário e ferramentas.'),
  charcoal: industry('Carvoaria',{madeira:3},{carvao:4},24,'maintenance','Combustível para fornos; consome a madeira das florestas cultivadas.'),
  iron_mine: industry('Mina de ferro',{}, {minerio:3},35,'mining','Extrai reservas finitas de afloramentos rochosos.'),
  foundry: industry('Fundição',{minerio:3,carvao:2},{ferro:2},30,'maintenance','Liga mineração e combustível à fabricação de equipamentos.'),
  toolmaker: industry('Ferramentaria',{ferro:2,tabuas:1},{ferramentas:1},22,'maintenance','Ferramentas consumidas pelos trabalhadores aumentam a produtividade.','industry',{need:'energy',boost:5}),
  clay_pit: industry('Barreiro',{}, {argila:5},22,'mining','Extrai argila de reservas locais finitas para tijolos e cerâmica.'),
  brickworks: industry('Olaria',{argila:4,carvao:1},{tijolos:3},18,'construction','Tijolos para manutenção e conforto das moradias.','industry',{need:'shelter',boost:12}),
  sand_pit: industry('Areeiro',{}, {areia:4},24,'mining','Areia de reservas locais para vidros.'),
  glassworks: industry('Vidraria',{areia:3,carvao:2},{vidro:2},24,'maintenance','Vidros para proteção e conforto dos imóveis.','industry',{need:'shelter',boost:10}),
  furniture: industry('Marcenaria',{tabuas:4,tecido:1},{moveis:1},28,'construction','Mobiliário melhora o descanso nas casas.','industry',{need:'energy',boost:18}),
  fiber_farm: industry('Cultivo de fibras',{}, {fibras:4},45,'agriculture','Fibras renováveis para roupas e estofados.'),
  flagmaker:industry('Oficina de bandeiras e faixas',{tecido:3,madeira:1},{bandeiras:2,faixas:1},18,'maintenance','Costura tecido em bandeiras e faixas; a madeira sustenta os mastros de campanha.','industry'),
  paintworks:industry('Fábrica de tintas',{oleo:1,argila:2,ervas:1},{tinta:4},20,'maintenance','Tintas de óleo e pigmentos para fachadas e publicidade.','industry'),
  weaving: industry('Tecelagem',{fibras:4},{tecido:3},20,'maintenance','Fornece tecido para confecções e marcenarias.'),
  newsroom: industry('Redação e gráfica de jornal',{papel:4},{jornais:1},20,'social','Jornais temáticos com média de quatro folhas, notícias preservadas e publicidade política paga.','services',{need:'leisure',boost:8}),
  clothing_store: industry('Loja de roupas',{roupas:1},{},1,'commerce','Revende peças de diferentes confecções, preservando marca, estilo, qualidade e durabilidade.','services',{need:'leisure',boost:0}),
  tailor: industry('Confecção',{tecido:3},{roupas:2},22,'commerce','Produz peças duráveis com marca, estilo e qualidade; vestir-se afeta bem-estar e credibilidade.','services',{need:'hygiene',boost:15}),
  dairy_farm: industry('Fazenda leiteira',{milho:3},{leite:5},30,'agriculture','Leite depende de ração; integra pecuária e lavoura.','food'),
  cheesemaker: industry('Queijaria',{leite:4},{queijo:2},16,'baking','Conserva e agrega valor ao leite.','food'),
  poultry: industry('Granja',{milho:2},{ovos:4},22,'agriculture','Ovos diversificam a alimentação e demandam milho.','food'),
  flour_mill: industry('Moinho de farinha',{trigo:3},{farinha:4},16,'baking','Processamento de cereais para massas.','food'),
  pasta_factory: industry('Fábrica de massas',{farinha:3,ovos:1},{massa:3},20,'baking','Conecta trigo, moagem e granjas às refeições.','food'),
  cannery: industry('Fábrica de conservas',{milho:2,cebola:1,vidro:1},{conserva:3},20,'baking','Transforma hortaliças e embalagens em alimento variado.','food'),
  soapworks: industry('Saboaria',{oleo:2,ervas:1},{sabao:3},18,'cleaning','Higiene doméstica compete pelo óleo usado na iluminação.','services',{need:'hygiene',boost:22}),
  herb_farm: industry('Horto medicinal',{}, {ervas:4},40,'agriculture','Cultivo renovável de insumos para remédios e sabão.'),
  pharmacy: industry('Farmácia',{ervas:3,vidro:1},{remedio:2},24,'medicine','Medicamentos reduzem necessidades de saúde.','services',{need:'health',boost:20}),
  paper_mill: industry('Prensa de papel',{madeira:3},{papel:12},22,'maintenance','Papel liga a silvicultura à educação.'),
  publisher: industry('Papelaria e encadernação',{papel:5},{livros:1,panfletos:1},24,'social','Encaderna livros e panfletos; cada página preserva dois relatos, inclusive propaganda e anúncios.','services',{need:'leisure',boost:18}),
  pottery: industry('Ateliê de cerâmica',{argila:3,carvao:1},{ceramica:3},18,'maintenance','Utensílios para conforto doméstico.','services',{need:'shelter',boost:8}),
  composting: industry('Compostagem',{lixo:4},{adubo:2},20,'recycling','Resíduos urbanos retornam como fertilizante às lavouras.'),
  research_institute: {...industry('Instituto de pesquisa',{}, {},1,'social','Pesquisas eleitorais presenciais financiadas por investidores e empresas; prefeitura contrata somente na falta de investimento privado.','services'),jobs:3,color:0x648caf},
  bank: industry('Banco',{}, {},1,'commerce','Depósitos mantêm reserva integral; crédito usa somente capital próprio disponível.','services'),
};
export const INDUSTRIAL_FOODS = ['leite','queijo','ovos','massa','conserva','marmita','marmita_simples','marmita_rustica'];

export const MEAL_COMPONENTS={
  marmita:{quality:4,ingredients:{feijao:2,arroz:2,alface:1,tomate:1}},
  marmita_simples:{quality:2,ingredients:{arroz:2,feijao:2}},
  marmita_rustica:{quality:3,ingredients:{mandioca:2,milho:2,tomate:1}},
};
export const KITCHEN_RECIPES=[
  {good:'marmita',quantity:3,labor:18,inputs:MEAL_COMPONENTS.marmita.ingredients},
  {good:'marmita_simples',quantity:2,labor:12,inputs:MEAL_COMPONENTS.marmita_simples.ingredients},
  {good:'marmita_rustica',quantity:2,labor:15,inputs:MEAL_COMPONENTS.marmita_rustica.ingredients},
];
