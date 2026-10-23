# Suburban — simulação autônoma de cidades

Uma cidade procedural sobre o relevo natural, com pessoas, patrimônio, governo, empresas, trabalho, produção de alimentos e famílias. A economia evolui sem comandos do jogador; o painel permite observar as decisões dos cidadãos.

```sh
python3 -m http.server 8000
```

Abra `http://localhost:8000`. Arraste o mapa para mover a câmera e use a roda para aproximar. A barra superior abre janelas e controla pausa, velocidade e visualização. O minimapa e o botão de centralizar ajudam a navegar pelo terreno. Espaço pausa; +/− altera a velocidade; F3 alterna 2D/3D. Um segundo simulado representa quatro minutos da cidade.

## Acompanhar a cidade

- **Cidade:** indicadores de população, emprego, moradia, vínculos e alertas de necessidades.
- **Governo:** prefeito, tesouro separado, imóveis públicos, emissão monetária, inflação, movimentações e geração de terreno.
- **Pessoas:** lista pesquisável e fichas com necessidades, habilidades, trabalho, parentesco, vínculos, patrimônio e movimentações financeiras.
- **Terrenos:** cadastro de lotes, proprietários, preços, obras, pedras entregues e progresso de construção.
- **Imóveis:** operação, finanças, estoque, equipe e ficha individual de cada célula 1x1x1, com dono, ocupante, preço, aluguel e atrasos.
- **Empresas:** diretório das empresas privadas e municipais e acesso às respectivas fichas.
- **Produção:** produção, consumo e estoque por alimento, cultivos, movimentações de mercadorias e oportunidades de investimento.
- **Transportes:** cargas, origem/destino, situação, transportador, mercadoria e frete.
- **Saneamento:** banheiros, acesso, limpeza, contratos de faxina, lixo e registros de morte.
- **Histórico:** busca, filtros por assunto e pessoa, congelamento, carregamento de mais registros e exportação JSON dos resultados filtrados.

A interface usa uma **área de trabalho com janelas independentes**, seguindo o funcionamento do OpenTTD. A barra de ícones no topo abre os diretórios e ferramentas; passe o cursor para ver o nome. Em telas estreitas, o último botão abre a lista completa de ferramentas. A barra inferior mostra data, população e tesouro.

Arraste a **barra de título** para mover uma janela e o **canto inferior direito** para redimensionar. As bordas encaixam nas outras janelas e nos limites da tela. A janela clicada vem para frente. Cada janela mantém busca, filtros, abas e rolagem próprios. Abrir um cidadão ou prédio cria uma ficha separada e mantém o diretório aberto; reabrir o mesmo registro traz sua janela existente para frente.

Os controles da barra permitem **fechar**, **fixar**, **recolher** e **maximizar/restaurar**. Um duplo clique no título recolhe ou restaura. **Delete** fecha as janelas não fixadas; **Shift+Delete**, todas; **Esc**, a janela não fixada mais recente; **Tab/Shift+Tab** alterna o foco. O menu de janelas também organiza em cascata. Posições e tamanhos são lembrados ao reabrir durante a sessão.

Opções e editor usam o mesmo sistema de janelas móveis. O **minimapa** exibe terreno, prédios e pessoas; clicar nele centraliza a câmera. **C** abre o panorama da cidade; **/** foca a busca da janela ativa. A roda, o arrasto do conteúdo e a barra de rolagem percorrem apenas a janela sob o cursor. **Page Up/Down**, **Home/End** percorrem a janela ativa. A planta de cada prédio permite selecionar andares e cômodos: **Q** quarto, **B** banheiro, **E** espaço empresarial e **::** circulação comum. O histórico mantém filtros, congelamento e exportação JSON.

## Governo e propriedade

O prefeito é um cidadão, escolhido inicialmente pela habilidade de administração pública entre os moradores que não são investidores. Ele tem rotina, conta pessoal, salário, necessidades e vínculos; seu dinheiro é separado do caixa municipal. A saída do prefeito provoca a escolha de outro morador. A prefeitura autoriza vendas de instalações e financia serviços públicos; suas decisões ficam no histórico.

O mapa começa com **prefeitura, construtora municipal, pedreira municipal e casa da moeda**. A prefeitura conserva os espaços de seus edifícios à venda e **nunca aluga**. Construtora e pedreira operam com contas próprias, funcionários e capital público, sem proprietários privilegiados. Moradores começam sem casa e usam os serviços de emergência enquanto a construtora ergue moradias para venda ou aluguel em sua própria conta. O município também pode contratar instalações essenciais quando os moradores ainda não conseguem financiá-las; essas empresas continuam públicas e não pertencem ao prefeito.

A prefeitura cadastra terrenos acessíveis de tamanhos variados (como 3x3, 3x5, 4x4, 5x5 e 6x4), sempre em um único nível, sem rampas na área do lote e sem alterar as alturas naturais. Vende os terrenos a cidadãos ou construtoras, e o dinheiro passa ao tesouro. Proprietários podem usar ou revender seus terrenos. As construtoras compram lotes, erguem residenciais para vender seus espaços e recebem pelo trabalho contratado. Os investidores individuais priorizam instalações para seus próprios negócios e compram moradias para morar ou alugar.

Uma obra precisa de **duas pedras por célula 1x1x1**, entregues no canteiro, e três unidades de trabalho por célula. A pedreira extrai pedras de uma reserva mineral finita, com trabalho humano; não há compra externa de pedras. O contrato da construtora fica reservado até a conclusão. Construir não cria um edifício pronto nem cobra materiais inexistentes. A geração inicial e o editor do framework usam uma exceção explícita de cenário.

Construtoras também oferecem **serviços contratados**, com preço por célula e pagamento reservado até a entrega. Empreendedores podem definir a largura, profundidade e quantidade de andares do empreendimento dentro do lote e escolher uma construtora. O cliente paga os materiais e fretes; a construtora emprega seus funcionários e recebe pelo serviço concluído.

O prefeito contrata **estradas e ampliação da prefeitura** com o tesouro, separado de seu dinheiro pessoal. Estradas exigem uma pedra e duas unidades de trabalho por tile novo, preservam a altura original e respeitam terrenos cadastrados. Novos empreendimentos deixam de ganhar estradas prontas: a ligação por terra continua disponível, e o município contrata a pavimentação. A ampliação adiciona pavimentos e espaços ao mesmo edifício, preservando os contratos e estoques existentes. A carga administrativa (população e empresas) gera a demanda por ampliar a prefeitura. Caminhos da geração inicial continuam sendo infraestrutura de partida.

**Ar livre** ocupa somente o nível do solo, acompanhando cada trecho do terreno, sem paredes, telhado, laje ou pavimentos. Fazendas exigem apenas o terreno para sua instalação, sem pedras ou trabalho de edificação; sementes e salários continuam sendo despesas de operação.
Cada unidade negociável é uma célula de **1×1×1 na fachada**; o miolo dos pavimentos é circulação comum e não pode ser vendido nem alugado. Moradias agrupam unidades contíguas, normalmente **quarto e banheiro**, e empresas utilizam várias unidades, incluindo seu banheiro de funcionários.

O preço inicial residencial é **R$ 1.200 por cômodo**, com aluguel diário de **R$ 3,50 por cômodo**: uma casa de quarto e banheiro custa R$ 2.400 ou R$ 7 por dia. Compra, aluguel e despesas de sobrevivência disputam o dinheiro real dos cidadãos. Eles preferem moradias completas quando conseguem pagá-las. Casais e filhos compartilham a casa; o contrato cobra todos os cômodos, sem multiplicar a diária por morador. Morar em unidades próprias dispensa o aluguel dessas unidades.

A prefeitura vende e nunca aluga. Proprietários privados podem alugar ou revender; construtoras preferem vender, mas podem colocar casas não vendidas para alugar após um dia. A venda de uma unidade ocupada preserva o inquilino. A primeira diária é paga na contratação; três dias sem pagamento encerram o contrato e deixam a família sem moradia. Pessoas sem casa continuam procurando emprego, comida e abrigo, com descanso menos eficaz ao dormir na rua.

## População, moeda e inflação

Os **64 moradores começam com saldo zero**. O banco municipal já existe na fundação: pessoas com renda podem pedir crédito; famílias sem recursos recebem benefícios sujeitos ao orçamento público. Não há classe de ricos nem promoção automática a investidor. Qualquer adulto, exceto o prefeito em exercício, pode abrir uma empresa se tiver dinheiro para terreno, materiais, construção, operação e uma reserva pessoal. As diferenças de patrimônio surgem das transações e do trabalho.

A emissão inicial de cenário é **R$ 320.000**, registrada pela casa da moeda e distribuída entre o tesouro e as contas das instalações municipais, sem doação inicial aos cidadãos. A construtora recebe R$ 20.000, a pedreira R$ 5.000 e o banco R$ 20.000 para iniciar a cadeia de obras. Essas contas não são patrimônio pessoal de nenhum morador. Comprar uma empresa municipal em operação exige pagar pelos espaços, terreno, caixa e estoque, além de reservar o capital de operação.

Depois da fundação, a **casa da moeda precisa de funcionário presente e trabalhando entre 08h e 17h**. Cada minuto de trabalho pode emitir R$ 2 para o tesouro, sujeito à política monetária e à cota inicial de R$ 800 por dia. O modo automático suspende emissões enquanto o tesouro tem pelo menos R$ 20.000 ou a inflação diária supera 0,1%. O funcionário recebe salário da conta da casa da moeda; a emissão não entra em sua conta pessoal. Sem trabalhador ou sem casa da moeda não há emissão. Impostos, salários, vendas e orçamentos municipais apenas transferem dinheiro existente.

A inflação usa um modelo monetário simplificado: a razão entre a emissão líquida (total emitido menos moeda retirada) e a emissão inicial define o índice de preços de referência; a cada dia os preços percorrem 35% da diferença até esse índice. Esse modelo representa a diluição monetária, sem tentar reproduzir toda a formação de preços de uma economia real. Alimentos, sementes, pedras, serviços, fretes, novos contratos, terrenos, imóveis e aluguéis acompanham o índice. Salários são reajustados com arredondamento em centavos. Saldos bancários, pagamentos em caução, contratos de frete/construção já reservados e atrasos de aluguel mantêm seu valor nominal. O painel **Governo**, inclusive a aba **Tesouro**, mostra emissão diária, total e inflação diária/acumulada.

Os preços iniciais dos espaços comerciais ficam entre **R$ 500 e R$ 600 por célula**, além do terreno a R$ 25 por tile. Uma moradia completa continua custando R$ 2.400, acima do saldo inicial de um cidadão. Pedra custa R$ 150 por unidade, o serviço de construção R$ 100 por célula e a pavimentação R$ 50 por tile, com materiais e frete pagos à parte. Abrir uma fazenda ao ar livre requer o terreno e o capital de operação; dispensa a construção do edifício.

Cada pessoa traz três refeições de provisão, separadas dos estoques das empresas. A prefeitura mantém uma reserva alimentar finita para a implantação da cadeia local. Desemprego, falta de alimentos, empresas sem recursos e inadimplência continuam possíveis. Emissão monetária não cria alimentos, pedras, moradias ou mão de obra.

## Empresas, contratação e aprendizado

Mercados, hortifrutis, padarias, fazendas e serviços surgem conforme a demanda e o capital disponível. Moradores escolhem investimentos automaticamente; não é necessário clicar para fundar uma empresa. O empresário compra instalações ou contrata uma obra, capitaliza a conta da empresa e contrata trabalhadores. Quando uma fazenda já tem o próprio dono trabalhando, sua mão de obra contratada pode atender serviços ainda sem funcionários. Caixa empresarial, dinheiro do dono e patrimônio são separados. Aportes e distribuição de lucros usam transferências reais.

A contratação combina habilidade profissional (75% da pontuação), confiança (15%) e afeto (10%) na relação com o dono. Pessoas ganham habilidades praticando sua profissão ou outras atividades: agricultura, panificação, comércio, gestão, administração pública, saúde, manutenção, comunicação e cuidados. Conversas e cuidados com filhos também ensinam. A habilidade melhora a produtividade agrícola e da padaria e influencia a remuneração.

As rotinas de trabalho acontecem entre 08:00 e 17:00, com salários pelo trabalho efetivo e imposto de 10%. Proprietários que administram a própria empresa não recebem salário dela; podem receber lucros. Fazendas em crescimento e padarias sem matéria-prima não geram salários ou produção fictícios enquanto aguardam. Os serviços públicos recebem orçamento autorizado pelo prefeito.

## Alimentos com origem e demanda

As fazendas podem cultivar **maçã, goiaba, trigo, milho, mandioca, cebola, feijão e coentro**. Cada fazenda se especializa num cultivo e opera dois talhões. Plantar consome sementes compradas; colher exige tanto crescimento (80–200 minutos, conforme o cultivo) quanto 120 unidades de trabalho. Cada colheita produz 12 unidades, e a habilidade agrícola acelera o trabalho.

As padarias consomem **duas unidades de trigo para produzir três de pão**, após acumular trabalho de panificação. Mercados e hortifrutis compram produtos das fazendas; mercados também podem comprar pão das padarias. As lojas vendem refeições com três unidades de alimento. Compras, produção, transformação e consumo alteram estoques reais e têm registros de origem e destino. Não há reposição de comida de um fornecedor externo nem geração de alimentos pelo simples trabalho no mercado.

As demandas combinam ausência de um tipo de comércio, população, capacidade estimada, estoques e pedidos de insumos. Uma padaria sem trigo aumenta a pressão por fazendas de trigo; lojas sem frutas e legumes geram oportunidades para os cultivos correspondentes. Demanda maior aumenta a prioridade de investimento, com variação individual nas escolhas. Capital disponível, mão de obra e um lote acessível também limitam novas empresas. Sementes ainda são compradas da economia externa, mediante pagamento e respeitando a capacidade do inventário. Pedras vêm das pedreiras locais ou do processamento de lixo. Comida vem da reserva inicial ou da cadeia agrícola local.

## Inventários, fretes e reserva pública

Todos os prédios, inclusive residenciais, têm inventário com capacidade finita. Prefeitura: 6.000 itens; demais instalações: capacidade proporcional às células, com mínimo de 160 e fator maior nas pedreiras. Cada canteiro tem seu próprio estoque. Sementes também ocupam espaço. Colheitas, extração e panificação param quando não há capacidade, preservando os materiais existentes.

As compras internas reservam espaço no destino e dinheiro em uma conta de frete. A carga sai do estoque de origem e fica identificada como mercadoria reservada, com posição física. Um cidadão percorre o caminho até a carga e depois até o destino. Só a chegada acrescenta itens ao inventário de destino e libera o pagamento ao fornecedor. Interrupções preservam a posição da carga; cancelamentos devolvem dinheiro e mercadoria, liberando a capacidade. Se não houver espaço para recuperar materiais de uma instalação demolida, a perda fica contabilizada explicitamente.

Transportadoras contratam funcionários conforme habilidades e vínculos, pagam salários durante os trajetos e recebem pelo frete entregue. A habilidade de logística aumenta com a prática. Antes de haver transportadora, ou quando conseguem pagar os produtos mas não o frete, os próprios empreendedores podem carregar compras. São viagens a pé de até 24 itens, sem veículos. Pedras também precisam viajar da pedreira ao canteiro.

A prefeitura começa com **4.608 unidades de pão** para os 64 habitantes: 1.536 refeições gratuitas, equivalentes a 24 refeições por pessoa. O estoque diminui a cada atendimento e não se repõe automaticamente. Ela também oferece água, higiene, descanso e atendimento básico provisórios até surgirem instalações especializadas. A comida das empresas não é gerada por reposição automática.

Preços, tempos e receitas são regras simplificadas de jogo, não uma representação dos custos agrícolas reais.

## Alimentação no trabalho

Empresas com funcionários compram comida de mercados, hortifrutis ou padarias e recebem os itens por frete. Enquanto não há comércio privado, também podem comprar parte da reserva pública inicial. Os alimentos ficam na sede ou no canteiro, dentro da capacidade do inventário; insumos como trigo, pedras e sementes não contam como refeição pronta.

O funcionário prefere o refeitório da empresa. Uma refeição consome três itens reais e recupera sua alimentação durante uma pausa de até 15 minutos, sem cobrar sua conta pessoal. Depois ele retoma o trabalho ou trajeto. Canteiros recebem refeições custeadas pela construtora, separadamente dos materiais que o cliente paga. Ao encerrar uma obra, os fretes de refeições ainda pendentes são cancelados e o empregador recebe o estorno.

Se não houver refeição acessível na empresa, o empregado vai a um estabelecimento e a empresa lhe paga um **vale-alimentação de no mínimo R$ 30,00 ou seis vezes o preço da refeição**, o que for maior. O valor sai do caixa do empregador e entra na conta do trabalhador; a mesma necessidade de comer não pode gerar vários vales. A diferença torna o refeitório abastecido muito mais barato que pagar vales. Sem caixa suficiente, o empregador não pode emitir dinheiro para o benefício.

A ficha **Equipe** mostra refeições fornecidas, compras para alimentação e vales pagos; a ficha do cidadão mostra o benefício recebido no dia. A arbitragem das necessidades atende à urgência de cada pessoa; refeições continuam possíveis mesmo com saúde ou outras necessidades críticas. Atividades sem progresso são canceladas para a pessoa reorganizar a rotina.

## Banheiros, limpeza e reciclagem

Toda empresa fornece banheiro para funcionários e proprietários. Banheiros residenciais atendem moradores e amigos muito próximos (afeto de pelo menos 65 e confiança de pelo menos 50). Banheiros públicos gratuitos são livres, mesmo imundos. Banheiros pagos cobram **R$ 1,50 por uso**, exigindo recursos do usuário.

Cada visita reduz a limpeza em seis pontos e gera uma unidade de lixo físico. Um banheiro praticamente perfeito dá bônus de humor; sujeira causa infelicidade e, quando extrema, prejudica higiene e saúde. Cada visita produz resíduos e cobra somente uma vez, mesmo durando vários minutos.

Empresas de faxina atendem moradores, empresas e prefeitura. Cada serviço reserva R$ 1,80 até um trabalhador chegar e executar a limpeza. Banheiros pagos podem contratar a cada três horas; privados, a cada dia; gratuitos, **somente após uma semana** desde a última limpeza. Sem prestadora, uma equipe municipal pode executar a faxina semanal gratuita. Sem dinheiro ou mão de obra disponível, a limpeza aguarda.

Coletoras retiram lotes de lixo por transporte físico, cobrando pelo serviço. Moradias cobram a coleta do proprietário, empresas do próprio caixa e banheiros públicos do tesouro. Recicladoras compram o lixo coletado e transformam **duas unidades de lixo em uma pedra**, com trabalho e habilidade. Lixo além da capacidade fica espalhado no prédio e continua contabilizado até haver espaço e coleta. A demanda por esses serviços atrai novos empresários.

## Sobrevivência e morte

Falta prolongada de comida (12 horas a zero), água (seis horas a zero) ou saúde (duas horas a zero) provoca morte. Também há morte por velhice. O histórico registra nome, idade, momento e causa uma única vez. Mortes encerram atividades e empregos, preservam cargas em trânsito e transferem dinheiro e patrimônio a herdeiros adultos ou ao município; o prefeito é substituído quando necessário.

## Relevo e sementes

Sem semente na URL, cada carregamento sorteia terreno e paisagem. **Governo → Geração de terreno** permite escolher arquipélago, continente ou terras altas, repetir uma semente ou gerar outra cidade. Gerar terreno reinicia a partida.

```text
http://localhost:8000/?seed=47622&terrain=archipelago
http://localhost:8000/?seed=1337&terrain=highlands
```

`terrain` aceita `archipelago`, `continent` e `highlands`; sementes vão de 1 a 2147483647. Lotes e ruas respeitam água, relevo e vizinhos. Fundações com apoios e degraus acomodam inclinações suaves sem terraplanagem. Fazendas procuram terreno fértil. Lotes isolados ou íngremes são recusados. Novas instalações seguem as mesmas regras dos prédios iniciais. O editor manual continua disponível como ferramenta do framework.

## Relações e famílias

Pessoas próximas conversam por 4–8 minutos, com intervalo mínimo de 30 minutos, desenvolvendo familiaridade, confiança e afeto. Afinidades, discordâncias e afastamento podem gerar amizades, relacionamentos ou separações. Os balões indicam conversas no mapa. Relacionamentos amorosos exigem dois adultos solteiros interessados, sem parentesco próximo.

Casais estáveis que desejam filhos podem planejar uma família após dois dias, com saúde, reservas, moradia e espaço privado disponível. A chegada leva três dias simulados; o limite é de dois filhos por pessoa e o intervalo mínimo entre nascimentos é de cinco dias. A idade avança um ano a cada 12 dias. São tempos acelerados para a simulação.

Crianças recebem nomes naturais, sem IDs, e herdam o sobrenome familiar. Têm parentesco, necessidades e conta, mas compartilham a moradia dos responsáveis. O responsável com mais recursos paga suas despesas; crianças pequenas precisam de cuidados em casa, com alimentos de provisões ou das lojas locais. A partir de seis anos, visitam serviços, ainda sustentadas pelo responsável. Aos 18, deixam a dependência financeira e podem disputar vagas. Crianças não são contratadas nem formam relacionamentos amorosos.

## Código e verificação

- `js/city_simulation.js`: pessoas, necessidades, propriedades, contas e integração.
- `js/city_economy.js`: prefeito, investidores, mercado imobiliário, contratação, habilidades, demandas, produção, comércio e consumo.
- `js/city_housing.js`: moradias, unidades na fachada, contratos familiares e despejos.
- `js/city_life.js`: nomes, recuperação de rotinas, sobrevivência e mortes.
- `js/city_sanitation.js`: acesso a banheiros, faxina contratada, lixo e reciclagem.
- `js/city_inventory.js`: capacidades e reservas de espaço.
- `js/city_logistics.js`: cargas, trajetos, transportadores, pagamentos e cancelamentos.
- `js/city_development.js`: terrenos, projetos sob medida, contratos, estradas e ampliações.
- `js/city_work_meals.js`: compras de comida, refeitórios, refeições no canteiro e vales.
- `js/city_society.js`: vínculos, famílias, crescimento e responsáveis.
- `js/city_terrain.js`: implantação, lotes, ruas e navegação A*.
- `js/world_settings.js`: sementes e paisagens.
- `js/city_ui.js`: conteúdo dos diretórios, filtros, panoramas, plantas e fichas.
- `js/city_desktop.js`: área de trabalho, barra de ferramentas, janelas, minimapa e integração.
- `js/window_manager.js`: foco, movimento, encaixe, redimensionamento e estados das janelas.
- `js/tycoon_icons.js`: ícones em pixels desenhados localmente para a barra de ferramentas.
- `js/city_ui_widgets.js`: tabelas, métricas, linhas de dados e barras de necessidades.
- `js/management_ui.js`: janelas em relevo, paleta clara, tipografia proporcional e controles da interface.
- `js/city_renderer_3d.js`: células volumétricas e fundações.

`npm test` verifica os controles originais, preservação do relevo, políticas públicas de venda, propriedade privada, contratação, habilidades, insumos, receitas, estoques, conversas e famílias. Simulações de vários dias verificam que os saldos somados correspondem exatamente à moeda emitida, além da conservação de cada mercadoria: estoque inicial e importações + produção = consumo e transformação + estoques em prédios, obras e fretes + perdas registradas. Os testes antigos de contratos e famílias usam uma cidade desenvolvida como fixture; os novos testes também verificam a evolução desde as quatro instalações iniciais, incluindo emissão por trabalho, limite diário, inflação, preços reajustados e contratos preservados.

Ainda não há salvamento da cidade, eleições periódicas, crédito bancário, escola, irrigação ou veículos de transporte. Recarregar reinicia a partida. O renderizador 3D carrega Three.js por `esm.sh`.

---

## Framework de base

Base independente para criar experiências sobre o mapa e os renderizadores de Brutopolis. Inclui os modos 3D isométrico e 2D e os componentes visuais NES da interface original: fonte bitmap 8×8, caixas, botões, barra superior, barra inferior e painéis. Não carrega telas ou regras específicas de criaturas, clãs, política ou construção.

## Executar

Sirva esta pasta por HTTP (o navegador não carrega módulos ES diretamente de `file://`):

```sh
cd experience-framework
python3 -m http.server 8000
```

Abra `http://localhost:8000`.

## Criar uma experiência

Edite `app.js`. O arquivo exporta `createEntity`, `destroyEntity`, `update(dt, api)` e `renderUI(ui, api)`. `update` define as regras da experiência; `renderUI` desenha UI própria com os componentes legados.

`update` recebe passos fixos de 1/60 de segundo simulado. A velocidade controla quantos passos acontecem por segundo real, mantendo as regras da experiência independentes do FPS. `api.time`, `api.options` e `api.editor` também estão disponíveis como exports de `app.js`.

```js
export function update(dt, { world, entities, createEntity }) {
  // Regras próprias da sua experiência.
}

createEntity({
  x: 256,
  y: 256,
  properties: {
    render: {
      skin: "Creature_Automaton_U.png",
      color: 0xffe8c547,
      backcolor: 0x00000000,
    },
    // Qualquer dado definido por você pode viver aqui.
    quest: { state: "ready" },
  },
});
```

O formato mínimo que o renderizador consome é `entity.x`, `entity.y` e `entity.properties.render`. O objeto `properties` é apenas um contêiner livre para dados da experiência; o framework não impõe tipos de entidade nem regras para esses dados. `world` fornece mapa procedural, leitura e alteração de tiles e relógio básico.

Controles do starter: os botões alternam entre 3D e 2D; arrastar move a câmera, roda do mouse aproxima/afasta, clique seleciona, espaço pausa e F3 alterna o renderizador. A seleção dispara `experience:select` com a entidade selecionada em `event.detail`.

## Opções e tempo

O botão **OPCOES** ou a tecla **O** abre o painel no estilo da UI antiga. Escape ou **X** fecha. As abas oferecem:

- **GRAFICOS:** resolução interna, distância de renderização, sombras, qualidade das sombras e wireframe.
- **EFEITOS:** profundidade de campo, neblina, mapas normais, reflexos, luz, anisotropia, oclusão, brilho e contraste. Esses ajustes usam os recursos de câmeras em perspectiva do renderizador 3D; o starter continua com câmera isométrica por padrão.
- **TEMPO:** velocidades de 0,5× a 32×, pausa e avanço manual.

Clique no valor de uma opção gráfica para alternar entre os valores disponíveis. As preferências gráficas ficam salvas neste navegador; **PADROES** restaura os valores iniciais. O painel pode ser rolado com o mouse em telas menores.

A barra inferior também oferece pausa, **−**, velocidade atual, **+** e **PASSO**. Espaço pausa/retoma, **−/+** muda a velocidade e **.** avança um passo quando pausado. O relógio, `update` e as animações do mundo acompanham a velocidade; a câmera e a UI continuam responsivas durante a pausa. Em telas estreitas, os controles de tempo ocupam uma segunda linha.

Pela API, use `api.time.setSpeed(4)`, `api.time.setPaused(true)` e `api.step()` para controlar a experiência. A velocidade e a pausa são estados da sessão; não são restauradas das preferências gráficas.

## Editor de mapa

O botão **EDITOR** ou a tecla **S** abre o editor nos modos 2D e 3D. Ele oferece os 14 terrenos/estradas do mapa, pincéis 1×1, 3×3, 5×5 e 9×9, pipeta, remoção de entidades e prévia do pincel. Arraste com o botão esquerdo para editar; use o direito para mover a câmera. Em telas menores, a roda do mouse rola o painel. Escape fecha o editor. As mudanças no terreno atualizam a geometria 3D automaticamente.

O catálogo de objetos pertence à experiência. Registre fábricas pelo export `editor` de `app.js` ou por `api.editor`:

```js
editor.registerPrefab("marcador", {
  label: "MARCADOR",
  create(x, y) {
    return createEntity({ x, y, properties: {
      render: { skin: "Creature_Automaton_U.png", color: 0xffe8c547 },
    } });
  },
});
```

Esses objetos aparecem na aba **OBJETOS** e podem ser colocados com um clique. O editor não importa os catálogos de criaturas e itens de Brutopolis.

## UI

`js/legacy_ui.js` reutiliza diretamente a fonte bitmap 8×8 e os desenhos de caixa, botão, barra e HUD do `app.js` antigo. O framework conserva esse estilo como opção; o simulador usa `ManagementCanvasUI`, com janelas claras e texto proporcional, para a barra superior, ações, opções, editor e inspetor; `renderUI(ui, api)` permite acrescentar botões e painéis próprios. As telas antigas de Brutopolis, como dossiês, clãs, guerras e eleições, não foram trazidas porque dependem dos sistemas próprios do jogo.

O renderizador 3D usa Three.js via `esm.sh`, portanto precisa de conexão com a internet para carregar essa dependência. O renderizador 2D continua disponível pelo botão 2D caso você queira uma experiência sem WebGL.

## Estrutura

- `app.js`: loop, controles, alternância de renderizador e API mínima de cena.
- `js/renderer.js`: renderizador 2D, sem conexão com `properties.js`.
- `js/renderer_3d.js`: renderizador isométrico 3D, sem conexão com `properties.js`.
- `js/legacy_ui.js`: fonte bitmap e componentes visuais NES reutilizados da UI antiga.
- `js/map_editor.js`: edição de terreno e colocação/remoção de objetos registrados pela experiência.
- `js/options.js`: painel de opções gráficas e tempo, com persistência de preferências gráficas.
- `js/simulation_time.js`: pausa, velocidade, passos fixos e avanço manual da simulação.
- `js/world.js` e `js/world_gen.js`: mapa e geração procedural reutilizáveis.
- `js/assets_data.js`: sprites embutidos usados pelo renderizador.
- `js/engine.js`: registro de entidades visíveis, sem regras de jogo.

O projeto original permanece intacto fora desta pasta.

## Inventário da extração

O starter ainda não contém toda a infraestrutura reutilizável do projeto original. Este é o estado atual:

| Recurso | Estado no framework |
| --- | --- |
| Renderizadores 2D e 3D | Incluídos, com alternância pela UI. |
| Fonte e componentes de UI antigos | Incluídos como componentes de canvas; telas específicas do jogo não foram portadas. |
| Editor de mapa | Incluído: terreno, pipeta, pincéis, remoção e fábricas de objetos próprias. |
| Geração procedural | Incluída no `World`; o painel de configuração de geração não foi portado. |
| Câmeras de primeira/terceira pessoa | Métodos estão no renderizador 3D; controles e UI ainda não estão integrados ao app. |
| Sombras, resolução e efeitos gráficos | Incluídos no painel de opções; efeitos de perspectiva seguem o modo da câmera do renderizador. |
| Controles de tempo | Incluídos na barra inferior, no painel e pela API: pausa, 0,5×–32× e avanço manual. |
| Áudio FMOD | Biblioteca, bancos e integração não foram trazidos para esta pasta. |
| Consultas espaciais | Há consulta de viewport e busca por ID; o índice espacial e as consultas de raio do motor original ainda não foram extraídos. |
| Eventos e histórico | O sistema antigo não foi extraído para uma API genérica. |
| Simulação em worker | O starter atualiza a experiência na thread principal. |
| Navegação e pathfinding | Ainda estão no projeto original, ligados à implementação de comportamentos. |

## Verificação

`npm test` executa os testes de controles, relógio, persistência gráfica e interação da UI de canvas. Não exige instalação de dependências. Os testes de UI usam um contexto de canvas simulado; não substituem uma conferência visual no navegador.


## Terrenos, tráfego e abastecimento da iluminação

Novos loteamentos incluem áreas rurais de 8×8, 10×10, 8×12, 12×12 e 16×12, distribuídas também longe da prefeitura. A ocupação ao ar livre aceita até 20×20. Fazendas novas ocupam o lote rural inteiro; o número de campos e vagas cresce com a área. Lotes rurais ficam reservados para fazendas. O loteamento procura manter três áreas agrícolas disponíveis, independentemente da quantidade de lotes urbanos. Fazendas acompanham os desníveis naturais de terra firme e podem ser abertas enquanto as obras de alvenaria estão na fila. Fazendas existentes não mudam de tamanho automaticamente.

A movimentação real dos cidadãos acumula passagens por célula. Essa contagem perde 20% ao dia, permitindo que o planejamento acompanhe mudanças no fluxo. Trechos de acesso com mais passagens recebem prioridade nas estradas, reparos e instalações de postes; orçamento, materiais e mão de obra continuam necessários.

Cada abastecimento de lamparina é um frete de uma unidade de óleo até a calçada do poste, seguido de quatro minutos de trabalho presencial do transportador. A unidade só vira combustível ao terminar esse serviço. O responsável pelo poste paga o óleo, o deslocamento e o abastecimento. Serviços municipais custam 1,5 vez o valor comum. A falta de transportadora gera demanda; o proprietário não abastece automaticamente à distância. Transportadoras dividem os pedidos considerando toda a fila, e novas empresas podem surgir se a capacidade não atender à demanda. Construção, limpeza, coleta, reciclagem e extração também consideram capacidade e acúmulo de trabalho.

## Banco e novas cadeias produtivas

Há 27 novos empreendimentos produtivos e um banco. As receitas consomem estoques físicos e trabalho; compras de insumos geram fretes. A abertura depende da demanda, do terreno e do financiamento da construção. A ficha de cada empresa mostra insumos, produtos e seu papel na cidade.

| Empreendimento | Insumos → produto | Efeito na sociedade |
| --- | --- | --- |
| Silvicultura | Trabalho, cultivo e replantio → madeira | Base renovável para várias indústrias |
| Serraria | Madeira → tábuas | Abastece móveis e ferramentas |
| Carvoaria | Madeira → carvão | Abastece fornos, competindo pela madeira |
| Mina de ferro | Reservas em rochas → minério | Reservas finitas exigem novos locais |
| Fundição | Minério + carvão → ferro | Liga mineração e manufatura |
| Ferramentaria | Ferro + tábuas → ferramentas | Aumenta temporariamente a produtividade de quem compra |
| Barreiro | Reserva local → argila | Abastece olaria e cerâmica |
| Olaria | Argila + carvão → tijolos | Melhora a necessidade de moradia dos compradores |
| Areeiro | Reserva local → areia | Abastece vidrarias |
| Vidraria | Areia + carvão → vidro | Embalagens e conforto doméstico |
| Marcenaria | Tábuas + tecido → móveis | Melhora o descanso |
| Cultivo de fibras | Trabalho, cultivo e replantio → fibras | Base da indústria têxtil |
| Tecelagem | Fibras → tecido | Abastece roupas, móveis e livros |
| Confecção | Tecido → roupas | Melhora a higiene dos compradores |
| Fazenda leiteira | Milho → leite | Demanda ração e diversifica refeições |
| Queijaria | Leite → queijo | Acrescenta variedade e valor à alimentação |
| Granja | Milho → ovos | Liga lavouras à alimentação e às massas |
| Moinho de farinha | Trigo → farinha | Prepara cereais para manufatura |
| Fábrica de massas | Farinha + ovos → macarrão | Nova refeição com vários fornecedores |
| Fábrica de conservas | Milho + cebola + vidro → conserva | Liga hortaliças e embalagens à alimentação |
| Saboaria | Óleo + ervas → sabão | Melhora higiene e compete com iluminação pelo óleo |
| Horto medicinal | Trabalho, cultivo e replantio → ervas | Insumo renovável para higiene e saúde |
| Farmácia | Ervas + vidro → remédio | Melhora a saúde dos compradores |
| Fábrica de papel | Madeira → papel | Liga florestas à educação |
| Editora e livraria | Papel + tecido → livros | Melhora lazer e habilidade de gestão |
| Ateliê de cerâmica | Argila + carvão → cerâmica | Melhora o conforto de moradia |
| Compostagem | Lixo → adubo | Devolve resíduos à agricultura; adubo reduz trabalho de cultivo |
| Banco | Capital existente → empréstimos; depósitos → guarda e saques | Crédito com limite e dívida, sem emissão de moeda |

Bens domésticos são comprados presencialmente quando há estoque, dinheiro e necessidade. Novos alimentos entram nas preferências individuais e nas receitas de pão com queijo e leite, macarronada e salada com ovos. Ferramentas duram um dia de simulação; fertilizante é consumido ao plantar. Silvicultura, fibras e ervas têm intervalo de replantio; minas e jazidas têm reservas finitas.

O banco usa somente seu próprio caixa para emprestar, preservando separadamente todo o dinheiro depositado. O limite considera renda e reserva de salários do banco. Cada pessoa pode ter um empréstimo ativo, com principal dividido em 30 parcelas e taxa diária fixada na contratação (inicialmente 0,2%) sobre o principal restante. Falta de dinheiro acumula dívida e atraso; não gera moeda nem novo empréstimo. Depósitos podem ser resgatados pela ficha financeira do morador e são sacados automaticamente quando a reserva pessoal fica baixa. Na mesma ficha estão os controles de depósito, saque e pedido de crédito.


## Capacidade agrícola, crédito e acompanhamento

Fazendas reservam duas células para instalações e dividem a área restante em talhões de até 12 células. Cada célula cultivável produz uma unidade por colheita completa e requer dez minutos-base de trabalho; a espécie também exige seu tempo de crescimento. Há uma vaga por 36 células cultiváveis, arredondando para cima. Exemplo: uma fazenda de 10×10 tem 98 células cultiváveis, nove talhões e três vagas; uma de 16×12 tem 190 células cultiváveis, dezesseis talhões e seis vagas. O proprietário pode trabalhar junto. A ficha mostra área, vagas, equipe, potencial por ciclo e estimativa diária; falta de sementes, trabalhadores, tempo de crescimento ou espaço impede colheitas automáticas.

A demanda de transportadoras considera o trabalho estimado dos trajetos, espera das cargas, fretes sem operador, transporte próprio e lamparinas aguardando abastecimento. Conta trabalhadores reais e proprietários ativos, com 240 minutos úteis estimados por transportador/dia. Empresas adicionais podem surgir mesmo quando já existe uma transportadora. O painel de transporte expõe a carga de trabalho, capacidade, espera e índice de demanda.

Benefícios de subsistência são revisados a cada hora: piso inicial de R$ 25 por adulto, acrescido de 50% por dependente, descontando dinheiro e poupança disponíveis. Há orçamento inicial de R$ 1.000 por dia e reserva protegida de R$ 5.000 no tesouro. O mesmo beneficiário não recebe mais que seu piso no dia. Crédito automático de subsistência tenta completar R$ 60 em caixa para adultos com renda, sujeito à análise e ao caixa do banco; pode ser desativado por pessoa. A cobrança preserva R$ 15 em caixa e registra atraso quando a parcela não pode ser paga. Não há perdão automático.

Pessoas guardam inicialmente 20% do excedente acima de R$ 100, com percentual ajustável na ficha financeira. A poupança tem reserva integral e rendimento diário inicial de 0,05%, pago com recursos do banco depois de preservar salários. Se o banco não tem recursos, não promete nem cria esse rendimento. Resgates automáticos recompõem a reserva em caixa. Dívidas são liquidadas com recursos do espólio antes de transmitir o saldo; perdas são registradas no banco.

O painel Governo permite ajustar emissão (automática, cota fixa ou pausa), retirar moeda do tesouro, suspender novo crédito, alterar juros de novos empréstimos, rendimento da poupança, imposto salarial e orçamento dos benefícios. Retirada de moeda preserva a reserva monetária e pelo menos metade da base inicial; poupança, juros, empréstimos e benefícios são transferências, não emissão. Os controles mantêm o modelo monetário simplificado descrito acima: juros e poupança alteram crédito e distribuição, enquanto emissão e retirada alteram diretamente a referência de preços.

As fichas de pessoas e prédios têm aba Histórico, com categorias de emprego, proprietários, vendas, serviços, crédito e finanças. Contratações e desligamentos guardam empregador, data, motivo e salário da ocasião. Propriedades registram compras, construção e heranças por cômodo ou instalação. Vendas físicas incluem produto, quantidade e valor; refeições também guardam ingredientes e qualidade. Fretes, abastecimento, faxina e construção registram a conclusão do serviço e seu valor. A aba Tesouro inclui o histórico público e as decisões de política. Cada categoria conserva até 2.000 eventos por pessoa/empresa e um contador de ocorrências desde a fundação; há filtros, busca e paginação. Esses registros pertencem à cidade em execução e são reiniciados ao gerar outra cidade.


## Resposta às filas de serviços essenciais

Faxina, transporte e construção têm um fluxo próprio de investimento, revisado a cada duas horas. A demanda usa trabalho pendente e capacidade da equipe, incluindo proprietários que trabalham; vagas vazias não contam como atendimento. A acumulação de serviço pode originar concorrentes, mesmo quando já existe uma empresa do mesmo tipo.

Adultos interessados podem financiar a sede sem ter que acumular previamente 40% do custo do empreendimento. O crédito empresarial é distinto do crédito de subsistência: contempla terreno, sede inicial de 3×3, pedras, serviço, frete e capital operacional. Usa dinheiro disponível do banco, com reserva de salários, prazo-base de 180 parcelas e taxa diária de no máximo 0,05%. A cobrança começa depois da conclusão da sede. Uma pessoa pode manter um contrato empresarial ativo além de seu crédito pessoal; o dinheiro para materiais e operação fica em uma conta reservada do projeto.

As sedes desses prestadores não ocupam o limite de duas obras públicas comuns. Seus materiais e sua construção recebem prioridade, mantendo entregas físicas e trabalho no local. O fundador de uma construtora pode construir a própria sede, saindo do emprego anterior durante essa etapa. Sem crédito privado suficiente, a prefeitura pode financiar uma empresa municipal, respeitando seu caixa e a reserva do programa de benefícios. Projetos antigos de prestadores também podem receber financiamento reservado de materiais. O sistema limita a uma sede financiada em andamento por tipo, sem considerar projetos sem financiamento como capacidade futura garantida.

Contratos de construção ainda sem trabalho realizado são distribuídos entre as construtoras disponíveis; serviços já iniciados mantêm a prestadora. Fretes sem motorista podem passar a novas transportadoras, preservando carga e valores em caução. Pedidos que estavam em transporte próprio só recebem transportadora se o pagador conseguir reservar o frete. A redistribuição examina até 64 fretes por hora, priorizando os materiais das sedes essenciais e as cargas mais antigas.

Faxinas novas e ainda não iniciadas são distribuídas conforme a fila de cada empresa e sua equipe. Banheiros abaixo de 35% de limpeza dispensam a espera pelo intervalo normal. Serviços pagos pela prefeitura respeitam o multiplicador municipal de 1,5. O painel de demandas informa a resposta de investimento, o projeto de sede ou o impedimento encontrado, como falta de terreno ou financiamento.


## Conta única da prefeitura

O prédio da Prefeitura usa a própria conta do tesouro municipal. O saldo mostrado na ficha do prédio, na barra e no painel Governo é o mesmo: impostos, emissão, salários da sede, benefícios, obras e contratos movimentam essa conta. A sede não recebe um segundo capital operacional nem repasses do tesouro para si mesma. Entradas e saídas acumuladas e o histórico do prédio também são os do município.

O dinheiro é contado uma única vez na oferta monetária. Reservas de contratos continuam nas respectivas cauções até o pagamento ou estorno; outras empresas públicas e privadas conservam suas contas próprias. A conta municipal permanece disponível se a sede for demolida, e uma sede reconstruída volta a mostrar o mesmo saldo.


## Coleta e processamento de lixo

Coletoras, recicladoras e unidades de compostagem participam do investimento em serviços essenciais: a acumulação de resíduos gera projetos com financiamento de materiais e operação, sem depender da fila comum de empreendimentos. Os funcionários e proprietários da coletora podem buscar o lixo e entregar a carga às processadoras; essas viagens não exigem que exista primeiro uma transportadora independente.

A coleta pode ser pedida a partir de duas unidades no imóvel, com pagamento pelo responsável. O serviço municipal custa 1,5 vez o valor comum. O pedido reserva lixo e dinheiro; o contador de coletado só aumenta quando a carga chega à coletora. Imóveis inativos também podem ter seus resíduos coletados, com cobrança ao proprietário. Não são criados pedidos repetidos para uma coleta que já está em andamento.

Lixo das coletoras segue por frete físico para reciclagem e compostagem, alternando os destinos. Dois resíduos geram uma pedra após trabalho na recicladora; quatro geram dois adubos após trabalho na compostagem. Ambos registram consumo real, produtos gerados e histórico de produção. Adubo é insumo das fazendas e não pode ser usado como comida dos funcionários.

O painel Saneamento → Resíduos separa lixo aguardando coleta, em transporte de coleta, armazenado nas coletoras, em transferência e nas processadoras. As fichas das empresas mostram equipe, estoque, cargas a receber, resíduos processados, produção e impedimentos como falta de trabalhadores, dinheiro ou insumos.
