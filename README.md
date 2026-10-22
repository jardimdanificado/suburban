# Suburban — simulação autônoma de cidades

Uma cidade procedural sobre o relevo natural, com pessoas, patrimônio, governo, empresas, trabalho, produção de alimentos e famílias. A economia evolui sem comandos do jogador; o painel permite observar as decisões dos cidadãos.

```sh
python3 -m http.server 8000
```

Abra `http://localhost:8000`. Arraste o mapa para mover a câmera e use a roda para aproximar. **Cidade** na barra inferior mostra ou oculta o painel. Espaço pausa; +/− altera a velocidade; F3 alterna 2D/3D. Um segundo simulado representa quatro minutos da cidade.

## Acompanhar a cidade

- **Cidade:** população, emprego, moradia, vínculos, prefeito e configuração do terreno.
- **Cidadãos:** dinheiro, perfil econômico, empresas, patrimônio, profissão, habilidades, necessidades, parentesco e relações.
- **Imóveis:** proprietário de cada célula 1×1×1, ocupante, anúncio, empresa, equipe, caixa, despesas, receitas, estoques, cultivo e pedidos de insumos. Clique no mapa ou nas listas para inspecionar.
- **Economia:** prefeito, oportunidades de investimento, gargalos, produção, consumo e empresas. Os números de capacidade são estimativas de planejamento; a produção efetiva depende de trabalho e insumos.
- **Histórico:** acontecimentos com categoria, busca, filtro por cidadão, atualização congelável, paginação e exportação JSON. Retém os últimos 5.000 registros. Salários são agrupados por pessoa a cada hora.

## Governo e propriedade

O prefeito é um cidadão, escolhido inicialmente pela habilidade de administração pública entre os moradores que não são investidores. Ele tem rotina, conta pessoal, salário, necessidades e vínculos; seu dinheiro é separado do caixa municipal. A saída do prefeito provoca a escolha de outro morador. A prefeitura autoriza vendas de instalações e financia serviços públicos; suas decisões ficam no histórico.

Todos os prédios iniciais e suas células começam pertencendo à prefeitura. **A prefeitura sempre oferece seus imóveis à venda e nunca para aluguel.** Isso é uma regra da simulação, inclusive ao alterar anúncios ou devolver propriedades ao patrimônio público. Serviços públicos ocupam instalações municipais sem um contrato de aluguel.

Cada apartamento é uma célula de 1×1×1. Cidadãos compram os espaços e podem ocupá-los, alugá-los ou revendê-los. Proprietários privados decidem entre renda de aluguel e venda conforme reservas e preferência individual. A venda de um apartamento ocupado preserva seu inquilino; o próximo aluguel vai ao novo dono. Morar no próprio espaço dispensa aluguel. São cobradas diárias, com primeiro pagamento na contratação e encerramento do contrato após três dias sem pagamento. Trabalhadores que acumulam reservas também podem comprar moradia.

## População e capital inicial

A cidade começa com **três ricos e 21 trabalhadores**. Cada rico recebe R$ 4.000,00 de capital inicial; os outros recebem entre R$ 40,00 e R$ 59,99. Os valores saem do caixa municipal inicial de R$ 20.000,00: não são emitidos novos recursos. Os prédios iniciais são patrimônio de partida.

Os investidores compram a própria moradia e apartamentos para alugar à maioria, preservando recursos para empresas. Preferem gerir negócios próprios a aceitar empregos. Moradores que acumularem bastante capital também podem se tornar investidores. Cada pessoa traz três refeições de provisão, registradas separadamente dos produtos das empresas, para atravessar a implantação da cadeia alimentar. Essas refeições acabam e não são repostas automaticamente.

Desemprego, falta de alimentos, empresas sem recursos e inadimplência são situações possíveis. Não há garantia de emprego ou enriquecimento para cada pessoa.

## Empresas, contratação e aprendizado

Os negócios privados iniciais são **mercados, hortifrutis, padarias e fazendas**. Os ricos escolhem investimentos automaticamente; não é necessário clicar para fundar uma empresa. O empresário compra as instalações da prefeitura, capitaliza a conta da empresa e contrata trabalhadores. Caixa empresarial, dinheiro do dono e patrimônio são separados. Aportes e distribuição de lucros usam transferências reais.

A contratação combina habilidade profissional (75% da pontuação), confiança (15%) e afeto (10%) na relação com o dono. Pessoas ganham habilidades praticando sua profissão ou outras atividades: agricultura, panificação, comércio, gestão, administração pública, saúde, manutenção, comunicação e cuidados. Conversas e cuidados com filhos também ensinam. A habilidade melhora a produtividade agrícola e da padaria e influencia a remuneração.

As rotinas de trabalho acontecem entre 08:00 e 17:00, com salários pelo trabalho efetivo e imposto de 10%. Ricos que administram a própria empresa não recebem salário dela; podem receber lucros. Fazendas em crescimento e padarias sem matéria-prima não geram salários ou produção fictícios enquanto aguardam. Os serviços públicos recebem orçamento autorizado pelo prefeito.

## Alimentos com origem e demanda

As fazendas podem cultivar **maçã, goiaba, trigo, milho, mandioca, cebola, feijão e coentro**. Cada fazenda se especializa num cultivo e opera dois talhões. Plantar consome sementes compradas; colher exige tanto crescimento (80–200 minutos, conforme o cultivo) quanto 120 unidades de trabalho. Cada colheita produz 12 unidades, e a habilidade agrícola acelera o trabalho.

As padarias consomem **duas unidades de trigo para produzir três de pão**, após acumular trabalho de panificação. Mercados e hortifrutis compram produtos das fazendas; mercados também podem comprar pão das padarias. As lojas vendem refeições com três unidades de alimento. Compras, produção, transformação e consumo alteram estoques reais e têm registros de origem e destino. Não há reposição de comida de um fornecedor externo nem geração de alimentos pelo simples trabalho no mercado.

As demandas combinam ausência de um tipo de comércio, população, capacidade estimada, estoques e pedidos de insumos. Uma padaria sem trigo aumenta a pressão por fazendas de trigo; lojas sem frutas e legumes geram oportunidades para os cultivos correspondentes. Demanda maior aumenta a prioridade de investimento, com variação individual nas escolhas. Capital disponível, mão de obra e um lote acessível também limitam novas empresas. Sementes e materiais de construção podem vir da economia externa, mediante pagamento; comida vem da cadeia local.

O comércio entre empresas exige conexão por terra e é contabilizado em rodadas horárias. O transporte é uma transferência de estoque entre empresas conectadas; ainda não há veículos de entrega. Preços, tempos e receitas são regras simplificadas de jogo, não uma representação dos custos agrícolas reais.

## Relevo e sementes

Sem semente na URL, cada carregamento sorteia terreno e paisagem. **Cidade → Terreno da cidade** permite escolher arquipélago, continente ou terras altas, repetir uma semente ou gerar outra cidade. Gerar terreno reinicia a partida.

```text
http://localhost:8000/?seed=47622&terrain=archipelago
http://localhost:8000/?seed=1337&terrain=highlands
```

`terrain` aceita `archipelago`, `continent` e `highlands`; sementes vão de 1 a 2147483647. Lotes e ruas respeitam água, relevo e vizinhos. Fundações com apoios e degraus acomodam inclinações suaves sem terraplanagem. Fazendas procuram terreno fértil. Lotes isolados ou íngremes são recusados. Novas instalações seguem as mesmas regras dos prédios iniciais. O editor manual continua disponível como ferramenta do framework.

## Relações e famílias

Pessoas próximas conversam por 4–8 minutos, com intervalo mínimo de 30 minutos, desenvolvendo familiaridade, confiança e afeto. Afinidades, discordâncias e afastamento podem gerar amizades, relacionamentos ou separações. Os balões indicam conversas no mapa. Relacionamentos amorosos exigem dois adultos solteiros interessados, sem parentesco próximo.

Casais estáveis que desejam filhos podem planejar uma família após dois dias, com saúde, reservas, moradia e espaço privado disponível. A chegada leva três dias simulados; o limite é de dois filhos por pessoa e o intervalo mínimo entre nascimentos é de cinco dias. A idade avança um ano a cada 12 dias. São tempos acelerados para a simulação.

Crianças têm parentesco, necessidades, conta e moradia própria. O responsável paga suas despesas; crianças pequenas precisam de cuidados em casa, com alimentos de provisões ou das lojas locais. A partir de seis anos, visitam serviços, ainda sustentadas pelo responsável. Aos 18, deixam a dependência financeira e podem disputar vagas. Crianças não são contratadas nem formam relacionamentos amorosos.

## Código e verificação

- `js/city_simulation.js`: pessoas, necessidades, propriedades, contas e integração.
- `js/city_economy.js`: prefeito, investidores, mercado imobiliário, contratação, habilidades, demandas, produção, comércio e consumo.
- `js/city_society.js`: vínculos, famílias, crescimento e responsáveis.
- `js/city_terrain.js`: implantação, lotes, ruas e navegação A*.
- `js/world_settings.js`: sementes e paisagens.
- `js/city_ui.js`: painéis de observação.
- `js/city_renderer_3d.js`: células volumétricas e fundações.

`npm test` verifica os controles originais, preservação do relevo, políticas públicas de venda, propriedade privada, contratação, habilidades, insumos, receitas, estoques, conversas e famílias. Simulações de vários dias verificam conservação de dinheiro e de cada mercadoria: produção acumulada = consumo e transformação + estoque restante.

Ainda não há salvamento da cidade, eleições periódicas, crédito bancário, mortalidade, escola, irrigação ou veículos de transporte. Recarregar reinicia a partida. O renderizador 3D carrega Three.js por `esm.sh`.

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

`js/legacy_ui.js` reutiliza diretamente a fonte bitmap 8×8 e os desenhos de caixa, botão, barra e HUD do `app.js` antigo. O starter usa esse estilo para a barra superior, ações e inspetor; `renderUI(ui, api)` permite acrescentar botões e painéis próprios. As telas antigas de Brutopolis, como dossiês, clãs, guerras e eleições, não foram trazidas porque dependem dos sistemas próprios do jogo.

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
