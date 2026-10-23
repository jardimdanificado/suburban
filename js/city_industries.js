// Every batch reserves real inputs and requires paid, on-site work. Prices are cents.
export const INDUSTRIAL_GOODS = Object.fromEntries([
  ['madeira','Madeira',180],['tabuas','Tábuas',520],['carvao','Carvão vegetal',450],['minerio','Minério de ferro',600],['ferro','Ferro',1600],['ferramentas','Ferramentas',4200],
  ['argila','Argila',120],['tijolos','Tijolos',650],['areia','Areia',180],['vidro','Vidro',1200],['moveis','Móveis',4200],['fibras','Fibras vegetais',150],['tecido','Tecido',650],['roupas','Roupas',1900],
  ['leite','Leite',200],['queijo','Queijo',750],['ovos','Ovos',180],['farinha','Farinha',320],['massa','Macarrão',700],['conserva','Conserva',600],['sabao','Sabão',1000],
  ['ervas','Ervas medicinais',220],['remedio','Remédio',1800],['papel','Papel',500],['livros','Livros',2300],['ceramica','Cerâmica',850],['adubo','Adubo orgânico',350],
].map(([id,label,price])=>[id,{label,price}]));
const industry = (label, inputs, outputs, labor, skill, impact, category='industry', use=null) => ({ label, inputs, outputs, labor, skill, impact, category, use, color: category==='food'?0xc6a363:category==='services'?0x87b7bc:0xa6a0ba, rent:90, price:80000, jobs:2 });
export const INDUSTRIES = {
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
  weaving: industry('Tecelagem',{fibras:4},{tecido:3},20,'maintenance','Fornece tecido para confecções e marcenarias.'),
  tailor: industry('Confecção',{tecido:3},{roupas:2},22,'commerce','Roupas melhoram higiene e proteção individual.','services',{need:'hygiene',boost:15}),
  dairy_farm: industry('Fazenda leiteira',{milho:3},{leite:5},30,'agriculture','Leite depende de ração; integra pecuária e lavoura.','food'),
  cheesemaker: industry('Queijaria',{leite:4},{queijo:2},16,'baking','Conserva e agrega valor ao leite.','food'),
  poultry: industry('Granja',{milho:2},{ovos:4},22,'agriculture','Ovos diversificam a alimentação e demandam milho.','food'),
  flour_mill: industry('Moinho de farinha',{trigo:3},{farinha:4},16,'baking','Processamento de cereais para massas.','food'),
  pasta_factory: industry('Fábrica de massas',{farinha:3,ovos:1},{massa:3},20,'baking','Conecta trigo, moagem e granjas às refeições.','food'),
  cannery: industry('Fábrica de conservas',{milho:2,cebola:1,vidro:1},{conserva:3},20,'baking','Transforma hortaliças e embalagens em alimento variado.','food'),
  soapworks: industry('Saboaria',{oleo:2,ervas:1},{sabao:3},18,'cleaning','Higiene doméstica compete pelo óleo usado na iluminação.','services',{need:'hygiene',boost:22}),
  herb_farm: industry('Horto medicinal',{}, {ervas:4},40,'agriculture','Cultivo renovável de insumos para remédios e sabão.'),
  pharmacy: industry('Farmácia',{ervas:3,vidro:1},{remedio:2},24,'medicine','Medicamentos reduzem necessidades de saúde.','services',{need:'health',boost:20}),
  paper_mill: industry('Fábrica de papel',{madeira:3},{papel:4},22,'maintenance','Papel liga a silvicultura à educação.'),
  publisher: industry('Editora e livraria',{papel:3,tecido:1},{livros:2},24,'social','Leitura melhora lazer e habilidades dos leitores.','services',{need:'leisure',boost:18}),
  pottery: industry('Ateliê de cerâmica',{argila:3,carvao:1},{ceramica:3},18,'maintenance','Utensílios para conforto doméstico.','services',{need:'shelter',boost:8}),
  composting: industry('Compostagem',{lixo:4},{adubo:2},20,'recycling','Resíduos urbanos retornam como fertilizante às lavouras.'),
  bank: industry('Banco',{}, {},1,'commerce','Depósitos mantêm reserva integral; crédito usa somente capital próprio disponível.','services'),
};
export const INDUSTRIAL_FOODS = ['leite','queijo','ovos','massa','conserva'];
