# Suburban — simulador de cidades

Primeira versão jogável sobre o Experience Framework, com visualização 3D isométrica e 2D. A cidade é gerada sobre o relevo natural e inicia às 08:00 com 24 cidadãos, prefeitura, mercado, dois residenciais, clínica, água/saneamento e centro de lazer. Lotes, prédios e ruas variam com a semente, sem planificar o terreno.

```sh
python3 -m http.server 8000
```

Abra `http://localhost:8000`. Use **Cidade** na barra inferior para mostrar ou ocultar o painel de gestão. Arraste o mapa para mover a câmera; a roda aproxima e afasta. Os controles de pausa, velocidade, editor e opções do framework continuam disponíveis.

## Jogar

- **Cidade:** população, bem-estar, emprego, caixa municipal e acontecimentos. Em **Terreno da cidade**, escolha a paisagem, repita uma semente ou clique em **Terreno aleatório** para iniciar outra partida.
- **Cidadãos:** selecione alguém na lista ou no mapa para acompanhar idade, família, vínculos, histórico pessoal, saldo, emprego, moradia, atividade e dez necessidades: alimentação, água, descanso, higiene, banheiro, convívio, lazer, saúde, moradia e segurança.
- **Imóveis:** selecione um prédio e uma célula por coordenadas X/Y/Z. Cada célula **1×1×1** tem matrícula própria, proprietário, ocupante, aluguel diário, preço de venda e anúncios independentes. Clique diretamente numa célula visível em 3D para inspecioná-la; seu contorno fica destacado. Selecione um cidadão em **Negociar como** para alugar ou comprar. **Administrar anúncio** permite mudar preços e disponibilidades, inclusive revender espaços privados.
- **Histórico:** log geral com categorias, filtro por cidadão, busca, botão para congelar a atualização, paginação e exportação JSON. São retidos os últimos 5.000 registros da partida. Entradas incluem construções, contratos, transferências, emprego, conversas, amizades, relacionamentos, separações, nascimentos e cuidados infantis. Salários são agrupados por cidadão a cada hora para evitar uma linha por minuto.
- **Construir:** escolha o uso e as dimensões ou deixe campos vazios para geração procedural. Escolha terra firme em uma planície, praia ou colina suave. A obra custa R$ 3,50 por célula; serviços recebem R$ 700,00 de capital inicial. É necessário deixar espaço entre prédios e uma entrada conectada à cidade. O acesso é traçado automaticamente sobre o relevo existente. Escape cancela a colocação.

Os cidadãos procuram vagas e moradia automaticamente. Caminham por rotas que desviam de prédios e água, trabalham entre 08:00 e 17:00 e visitam serviços conforme suas necessidades. Recebem por minuto efetivamente trabalhado; 10% do salário volta à prefeitura. Aluguéis e orçamentos públicos são processados à meia-noite. O primeiro aluguel é cobrado na contratação. Três diárias sem pagamento encerram um contrato residencial. Moradores com reservas podem comprar seu próprio espaço automaticamente.

Comprar um espaço ocupado preserva seu inquilino; os próximos aluguéis vão ao novo dono. Morar no próprio espaço dispensa aluguel. Os serviços também alugam suas células e mantêm caixa próprio. Mercado, atendimento e lazer cobram dos cidadãos; mercado repõe alimentos com fornecedores externos. Todas as transferências usam centavos inteiros e contas de origem e destino, incluindo a economia externa. Não há emissão automática de dinheiro.

Uma segunda de simulação representa quatro minutos da cidade; a velocidade da barra multiplica esse ritmo. A prefeitura começa com R$ 20.000,00, usados também para capitalizar serviços e moradores.

## Terrenos aleatórios e implantação da cidade

Sem uma semente na URL, cada carregamento sorteia um novo terreno e uma das três paisagens: arquipélago, continente ou terras altas. Para repetir e compartilhar uma cidade inicial, informe os dois parâmetros, por exemplo:

```text
http://localhost:8000/?seed=47622&terrain=archipelago
http://localhost:8000/?seed=1337&terrain=highlands
```

As opções de `terrain` são `archipelago`, `continent` e `highlands`; sementes válidas vão de 1 a 2147483647. **Cidade → Terreno da cidade** mostra a semente atual e oferece os controles para gerar outro mapa. Gerar um terreno reinicia a partida; recarregar uma URL com semente mantém o mesmo mapa inicial.

A implantação procura lotes adequados no relevo original. Os prédios ficam fora da água, das formações rochosas e das ruas, respeitando os vizinhos e o desnível do lote. Fundações com apoios e degraus acomodam pequenas inclinações sem cortar ou aterrar o solo. Lotes muito íngremes ou isolados são recusados. Os tamanhos e a distribuição dos prédios iniciais também variam com a semente.

As ruas conectam as entradas dos serviços, reutilizam trechos existentes e desviam de água e encostas íngremes. Planícies, praias e colinas recebem a variante de estrada com a mesma altura do terreno original. A navegação dos cidadãos respeita essas barreiras e prefere caminhos já construídos. Apenas o editor manual pode alterar livremente o terreno; a geração e a construção da cidade não fazem terraplanagem. Não há pontes ou túneis nesta versão.

## Convívio, relacionamentos e famílias

Conversas ocorrem entre duas pessoas próximas e paradas no mapa, durante 4–8 minutos, com intervalo mínimo de 30 minutos por pessoa. Os balões com reticências indicam conversas em andamento. Há temas, afinidades e personalidades individuais. Conversar atende ao convívio e desenvolve familiaridade, confiança e afeto; discordâncias e afastamento podem enfraquecer vínculos e causar separações. A ficha do cidadão mostra suas relações e permite abrir a pessoa ou o histórico correspondente.

Amizades podem evoluir para relacionamentos quando ambos são adultos, estão solteiros, desejam um vínculo amoroso e não têm parentesco próximo. Não há sorteio de casais sem convivência: os vínculos dependem das conversas. Crianças também podem fazer amizades a partir dos três anos, mas não têm vínculos amorosos nem emprego.

Casais que desejam filhos podem planejar uma família após dois dias de relacionamento estável, com saúde, reservas financeiras, moradia e espaço residencial disponível. A chegada leva três dias simulados. Cada pessoa pode ter até dois filhos, com intervalo de cinco dias entre nascimentos. São regras aceleradas de jogo; a idade avança um ano a cada 12 dias da cidade.

Cada criança é um cidadão com conta, parentesco, necessidades e uma célula residencial própria, preferencialmente no prédio do responsável. Não recebe auxílio de chegada nem salário: o responsável paga aluguel, alimentação, água e atendimento. Crianças menores de seis anos ficam em casa; o responsável precisa ir até elas para oferecer cuidados. A partir de seis anos, elas visitam os serviços por conta própria, ainda com despesas pagas pelo responsável. Aos 18 anos, passam a procurar emprego e pagar suas próprias despesas. A saída de um responsável transfere os cuidados ao outro quando possível.

## Escopo desta versão

As necessidades e os serviços usam regras simplificadas. Os cidadãos ficam visíveis nas entradas enquanto usam os espaços internos; não há navegação entre andares. Segurança depende da presença da prefeitura, e moradia depende de um contrato. Ainda não há mortes, escola, redes físicas de água/energia ou salvamento da cidade; recarregar a página reinicia a partida. O renderizador 3D usa a dependência Three.js hospedada em `esm.sh`.

## Código e testes

- `js/city_simulation.js`: cidadãos, necessidades, contas, imóveis e contratos, sem depender do navegador.
- `js/city_terrain.js`: implantação procedural, validação de lotes, relevo, ruas e navegação A*.
- `js/world_settings.js`: sementes aleatórias, paisagens e parâmetros da URL.
- `js/city_ui.js`: painel de gestão, famílias, histórico e construção.
- `js/city_society.js`: conversas, vínculos, parentesco, nascimento, crescimento e responsáveis.
- `js/city_renderer_3d.js`: células volumétricas, fachadas e seleção.
- `app.js`: integração com o loop e os controles do framework.
- `tests/city.test.mjs`: cidade inicial, negociação, inadimplência, construção, navegação, economia e demolição.
- `tests/society.test.mjs`: encontros, vínculos, famílias, menores, cuidados, crescimento, histórico e uma partida de 15 dias.
- `tests/terrain.test.mjs`: sementes, repetibilidade, preservação do relevo, conexão dos serviços, encostas, fundações e lotes isolados.

Execute `npm test`. Os testes da simulação verificam saldos e contratos e exercitam vários dias completos; os testes originais dos controles também continuam ativos.

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
