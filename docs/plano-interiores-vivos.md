# Plano de implementação: interiores vivos, móveis e atividades

## Objetivo e instruções para o agente executor

Implementar moradores que realmente se deslocam dentro dos prédios até pontos de interação e usam móveis ou equipamentos adequados à atividade. A simulação deve continuar acontecendo em **todos** os prédios, independentemente de estarem visíveis. Ao inspecionar um prédio, o jogador poderá revelar um andar e ver seus moradores, móveis e deslocamentos.

Este documento é um plano, não uma descrição de algo já implementado. Trabalhe na árvore atual: leia `AGENTS.md` aplicáveis, confira `git status` e preserve todas as alterações existentes, inclusive staged e arquivos não rastreados. Não descarte, reorganize ou reverta trabalho alheio. Não crie branch, commit, PR ou worktree sem pedido. Use os testes existentes, adapte chamadas a partir do código real e não suponha que linhas, APIs ou valores permaneçam iguais aos citados aqui.

Execute as etapas na ordem, concluindo e verificando cada uma antes da próxima. O escopo final cobre todos os tipos de prédio fechados e também as instalações internas de estabelecimentos ao ar livre. Uma fase intermediária não constitui entrega completa. Se uma etapa revelar conflito com o comportamento existente, resolva-o com uma solução compatível; registre limitações que não puder verificar. Não remova sistemas, detalhes visuais, sombras, filas ou efeitos econômicos para alcançar desempenho.

## Situação confirmada no código

- `js/city_housing.js` gera células/`units`, andares e circulação; cada cômodo tem `roomType`. Nem toda célula representa uma sala independente completa.
- `js/city_interiors.js` mantém `indoorLocation`, reservas por cômodo e `interiorRoute`. A rota atual avança por eixos e usa um ponto de escada aproximado; não modela portas internas nem obstáculos de mobiliário. `entity.x/y` continuam sendo a âncora externa, enquanto a posição interna é separada.
- A prefeitura, banheiro, alimentação, trabalho, eleições, quartos e vários outros fluxos já usam a entrada e reservas internas. As filas de banheiro e alimentação têm regras próprias em `js/city_service_queue.js` e `js/city_sanitation.js`.
- `js/city_renderer_3d.js` cria alguns objetos de banheiro, refeitório, escritório e lavanderia em `roomProps`, mas os mantém invisíveis. `js/renderer_3d.js` e `js/city_sim_worker.js` ocultam moradores internos, exceto em varandas e coberturas. O modelo de habitante está em `js/city_citizen_models.js`.
- `js/city_sim_bridge.js` transmite movimento externo por pacote compacto; o estado completo passa por `js/city_state.js`. Posição interna e visibilidade requerem cuidado para não ficarem atrasadas entre snapshots. Não presumir que o atual transporte já seja suficiente para movimento interno suave.
- `data/model` contém quadros OBJ já usados pelo jogo; o código expõe `idle`, `run` e `use`. Não presumir que existam poses dedicadas de sentar, deitar ou trabalhar. Inspecione os ativos antes de escolhê-los.
- Existe o bem econômico `moveis` e efeitos de conforto. Objetos visuais/funcionais iniciais deste plano não devem criar nem consumir estoque, alterar propriedade ou fingir que foram comprados.

## Regras de produto

1. Caminhada, acesso e ocupação são parte da simulação para todos os moradores, mesmo com nenhum prédio selecionado, inclusive em velocidade alta. A exibição detalhada é uma escolha de apresentação; não troca o estado nem teletransporta moradores.
2. Por padrão, exteriores permanecem como hoje. Ao inspecionar um prédio, oferecer um controle explícito de **interior** e de andar, sem restaurar a transparência automática do prédio selecionado. Mostrar o andar escolhido, os cômodos e seus moradores/móveis; ocultar o teto e os andares acima somente nesse modo. Fechar o inspetor ou desativar interior restaura o exterior.
3. Não expor dados ou paredes de outro andar indevidamente. Varandas e coberturas mantêm o comportamento atual. Mudanças de andar, prédio e seleção precisam atualizar apresentação e picking imediatamente, sem alterar simulação.
4. Ao viajar ou executar uma atividade, o morador deve entrar fisicamente pela entrada, ir pelo caminho válido até o ponto de interação, ficar posicionado e orientado junto ao móvel e só então executar o efeito existente. Ao terminar, mudar de tarefa ou sair, liberar reservas e sair fisicamente. Preservar urgências, filas e fallback para necessidades vitais.
5. Equipamentos individuais têm capacidade definida; filas respeitam ordem de chegada onde já existe esse contrato. Objetos coletivos têm vagas separadas. Uma pessoa não pode usar uma vaga reservada por outra. Permitir que pedestres se cruzem em circulação, mas não que fiquem sobrepostos no mesmo ponto de uso.
6. Usar os modelos e animações existentes quando visualmente aceitáveis. Para dormir, deitar apropriadamente com o quadro disponível; para sentar, usar uma pose existente somente se visualmente convincente. Quando não houver pose compatível, criar ou adaptar um recurso/pose adequado e deixar claro o mecanismo; não anunciar uma animação inexistente como pronta. Roupas, chapéus, bicicletas e tons de pele devem continuar corretos.
7. Nenhuma pessoa fica bloqueada indefinidamente por móvel ausente, reforma, ocupação, rota inacessível ou cancelamento. Nesses casos, tentar outro ponto apropriado, aguardar em fila limitada quando cabível, ou usar o fallback funcional previsto. Não conceder compra, alimento, produção, voto, limpeza ou atendimento sem chegar ao destino quando o fluxo exige presença.

## Modelo de dados e contratos

### Geometria e conectividade

Criar um módulo independente de Three.js para gerar um **layout lógico determinístico** por prédio e andar, baseado no terreno/footprint, `units`, orientação e `layoutRevision`. A representação deve ser pequena e reconstruível; não materializar milhares de objetos gráficos no estado autoritativo.

Cada layout deve identificar: piso e área transitável; paredes; aberturas de portas; pontos de entrada externa; pontos de acesso entre circulação e cômodos; conexões explícitas de escada entre andares; e volumes bloqueados por móveis. Utilizar a geometria e as rotações reais do prédio (`CITY_FLOOR_HEIGHT`, `modelSize`, `buildingPoint`), mantendo claro quando as coordenadas são locais ou globais. Prédios de largura 1, terrenos 4×1, rotações 0–3 e andares existentes são obrigatórios.

Um ponto é acessível somente se há conexão contígua entre entrada, escadas, cômodo e ponto de uso. Não tratar a interpolação atual por eixos como prova de acessibilidade. As paredes renderizadas devem usar as mesmas aberturas lógicas das rotas. A escada não pode ser uma linha vertical atravessando um piso sólido sem representação visual correspondente. Evitar posicionar camas, portas ou equipamentos em células que eliminem a única rota para outro cômodo.

Cada equipamento deve ter ID estável derivado de prédio, andar, cômodo, tipo e índice; tipo, posição/orientação visual; volume ocupado; e uma ou mais vagas com posição/orientação/pose de uso e capacidade. IDs e geração não podem depender da ordem de renderização, seleção, FPS ou uso posterior de `city.random()`. Usar geração determinística e não consumir o RNG econômico só para gerar decoração.

Implementar cache local por prédio e `layoutRevision`, dimensões, orientação e identidade relevante das `units`; invalidar na construção, expansão, reforma, alteração de cômodo, demolição, locação empresarial que muda layout e carregamento/migração. Não serializar malhas, caches, mapas de caminho nem recursos Three.js; revisar `localFields` e reconstrução no worker e espelho.

### Vagas e ciclo de vida

Armazenar apenas o estado autoritativo necessário: ID do prédio/cômodo/equipamento/vaga, morador e fase da atividade. Reservas devem ser atômicas e liberadas em conclusão, desistência, urgência, morte, troca de trabalho ou casa, remoção do prédio ou cômodo, reforma, equipamento indisponível e recuperação de tarefa travada. As referências devem continuar válidas após transferência pelo worker e restauração de estado legado; não guardar ponteiros para objetos gráficos.

Evitar manter simultaneamente a reserva antiga de cômodo e a nova de vaga como fontes independentes de verdade. Durante migração, usar uma única política de reconciliação; adaptar `activityCellAvailable` e os consumidores sem alterar a capacidade de banheiros ou quebrar filas. Definir uma transição de migração segura para cidadãos já em `indoorLocation` sem vaga: reconstruir um destino válido ou liberá-lo e replanejar, sem duplicar pagamento/consumo.

A máquina de estados deve distinguir: procurando serviço; aguardando; reservado; entrando; caminhando; usando; saindo; concluído/cancelado. `performTask`, `workCellReady`, `activityRoomReady` e serviços já existentes devem receber um sinal de chegada real. Efeitos e preços mantêm a periodicidade atual: por exemplo, pagar e gerar lixo uma vez por visita de banheiro, consumir ingredientes uma vez por refeição e não duplicar salário/voto.

## Etapas de implementação

### 0. Diagnóstico reproduzível e inventário

- Leia as funções reais citadas, os fluxos de `city_work_meals.js`, `city_voting.js`, `city_development.js`, `city_offices.js`, `city_sanitation.js`, `city_service_queue.js`, `city_balconies.js` e os testes relacionados. Confirme como o renderizador escolhe o andar e como o worker envia movimento/visibilidade.
- Gere uma lista executável dos tipos de prédio registrados e mapeie para tipos de cômodo, atividade, equipamento e fallback. Inclua serviços públicos, estatais e privados, lojas, fábricas, obras, fazendas/pedreiras, empresariais/locatários, prefeitura, câmara e habitação social. Use essa lista como teste de cobertura, não uma lista parcial mantida apenas na documentação.
- Fixe e anote medições **antes** de alterar o comportamento: simulação, worker e cena 3D; 512 e 1.024 habitantes, 1× e 32×, uma mesma seed e tamanho de mapa em cada comparação. Use `scripts/benchmark.mjs` (modos `simulation`, `throughput`, `bridge`) e a visualização `?profile` no navegador. Registre população real, seed, tamanho, velocidade, visão/câmera, amostras, hardware/limitações e custo de abertura do interior. Não tratar benchmark Node como FPS/GPU.

### 1. Layout lógico e mobiliário

- Implementar layout e catálogo por tipo de cômodo, com IDs estáveis e pontos de acesso; gerar modelos simples a partir da mesma descrição lógica. Primeiro: cama, vaso/pia, mesa e assentos, estação de trabalho, balcão e máquina de lavanderia.
- Incluir mais de uma vaga quando o cômodo ou uso suporta mais de uma pessoa; vagas não podem se sobrepor entre si, com a parede ou com o próprio móvel. Dimensões devem considerar o tamanho do modelo de cidadão.
- Criar `tests/interior_layout.test.mjs`: repetibilidade, todas as rotações, múltiplos andares, terreno estreito, ponto não bloqueado, portas, escadas, conectividade, invalidação e layout após expansão/conversão. Para prédio apertado, escolher layout menor válido ou registrar um fallback utilizável, nunca inventar espaço fora da planta.

### 2. Caminhos e reservas reais

- Substituir o cálculo puramente por eixos por busca restrita ao grafo interno gerado. Reutilizar estruturas/caches por layout; não executar um A* completo por cidadão a cada frame. Deslocamento e tempos devem ser calculados com o relógio de simulação; a seleção visual não pode alterar sua duração.
- Conectar rota externa, porta, circulação, escada, cômodo e vaga. Tratar rota bloqueada, destino removido e replanejamento limitado; liberar reservas e manter `lastProgressAt` coerente com deslocamento real e espera legítima.
- Testar dois habitantes disputando banheiro/cadeira, FIFO por serviço, caminho passando por portas/escadas, inexistência de rota, interrupção, morte, demolição, expansão e mudança de andar. Testar especialmente que não há prisão cíclica por necessidades simultâneas ou morador preso dentro de sala inexistente.

### 3. Primeiros fluxos funcionais

- Integrar casa (dormir em cama, higiene/banheiro, comer à mesa) e atendimento público (banheiro/refeitório). Usar os serviços e pagamentos existentes; vagas de móveis complementam, não substituem silenciosamente, o acesso por propriedade e os parâmetros de saneamento.
- Verificar moradias super populares, populares e de luxo: o número de banheiros reais já existente deve continuar correto por prédio/andar/unidade. Família pode usar os móveis da própria moradia; visitantes seguem regras existentes.
- Manter situação de falta de casa: dormir ao ar livre quando necessário, sem inventar uma cama; manter custo e fallback de espera de banheiro. Exercitar eletricidade/iluminação e tarefas de trabalhador sem introduzir dependência artificial de mobiliário comercial.
- Acrescentar testes de integração que avancem o tempo e verifiquem reserva → deslocamento → efeito → liberação, sem executar efeito antes da chegada e sem duplicá-lo. Verificar `workmeal` e alimentação simultânea, troca de tarefa e fila.

### 4. Visualização, animação e worker

- Acrescentar controle interior/andar no inspetor e integrar o estado à seleção de prédio e morador; estabelecer modo de corte por andar sem mudar o estilo visual das demais janelas. Não usar `group.visible=false` no prédio inteiro, nem transparência automática como substituto.
- Renderizar corretamente móveis e moradores no andar visível. Usar geometria agrupada/instanciada; não criar um draw call por cadeira ou habitante. Preservar cores, sombras, bandeiras, peças de roupa, fachadas, iluminação, plantações, seleção e culling. Liberar recursos gráficos ao invalidar/demolir.
- Propagar posição interna, altura, orientação e estado de pose pelo worker com dados compactos e sem sobrescrever a posição externa usada pelo pathfinding. Interpolar no cliente em 1×, respeitar pausa e teletransporte legítimo de migração; não fazer a simulação depender da frequência de renderização. A 16×/32× priorizar custo sem alterar atividades ou ocultar pessoas apenas por velocidade.
- Integrar animações disponíveis e criar/adaptar as que faltarem para deitar/sentar, verificando alinhamento visual, sem deformar roupas ou causar sobreposição com o móvel. Não usar pose de pedal para atividades comuns por conveniência. Orientação do modelo deve corresponder ao móvel e à direção de deslocamento.
- Testar snapshots incrementais, envio/recebimento de movimento, visibilidade interna, modo pausado, troca de andares, reconstrução e migração de estado. Inspecionar visualmente no navegador pelo menos uma casa, um prédio de múltiplos andares, um escritório locado e um banheiro público; testar também vista externa, sombras e terceira pessoa.

### 5. Cobertura de todas as atividades e tipos

- Aplicar o catálogo aos tipos registrados no inventário da etapa 0. Cada tipo precisa ter um perfil de interação coerente: balcão e estoque para comércio; estação e bancada para produção; mesa/gabinete/plenário/urna para governo; estação de limpeza/lavagem; tratamento e atendimento; mesas para redação/pesquisa; e trabalho de construção/logística nos locais pertinentes.
- Atividades ao ar livre continuam na plantação, rocha ou obra; banheiro/refeitório físico construído no local deve ser acessível e utilizável. Não colocar um prédio fechado fictício sobre a fazenda ou pedreira.
- Em empresariais, cada empresa usa apenas o próprio andar alugado para trabalho/atendimento e as áreas comuns permitidas. A posição e o acesso usam o prédio físico correto; respeitar os direitos de locação e a desocupação do andar. Preservar sede partidária e seus materiais.
- Para tipos sem ativo especializado ainda, usar uma estação funcional genérica claramente adequada, integrada ao catálogo e à vaga, sem impedir o funcionamento econômico. Criar teste que percorre todos os tipos atuais e falhe quando uma nova categoria não tiver mapeamento explícito ou fallback justificado.
- Passarelas elegíveis ligam portas do segundo andar, têm escadas exteriores representadas e entram no pathfinding de pedestres nos dois sentidos; o trajeto vertical é interpolado e não desgasta a rua. Transporte sobre rodas continua usando apenas caminhos no solo.

### 6. Robustez, desempenho e entrega

- Rodar os testes novos e os existentes relevantes: `tests/balcony_living.test.mjs`, `tests/citizen_activity_recovery.test.mjs`, `tests/service_queue_office_demand.test.mjs`, `tests/housing_life_sanitation.test.mjs`, `tests/office_towers.test.mjs`, `tests/city_bridge_indoor.test.mjs`, `tests/compact_state_sync.test.mjs`, `tests/citizen_models.test.mjs` e testes de eleições/produção afetados. Se uma suíte demorar, rodar primeiro casos focados e depois a suíte relevante; registrar falhas preexistentes verificadas com um controle, sem escondê-las.
- Medir novamente os mesmos cenários da etapa 0 em várias execuções alternadas. Reportar medianas e p95, custo de CPU da simulação, encode/apply do worker, FPS/tempo de quadro, chamadas de desenho e triângulos quando disponíveis. Não comparar checksums se a mudança de comportamento for esperada; comparar invariantes, dinheiro/estoque, necessidades, presença, reservas e eventos.
- Meta de não regressão: investigar e corrigir aumentos consistentes acima de 10% na mediana da simulação/worker sem interior aberto e no tempo de quadro exterior, sob o mesmo cenário. Com interior aberto, informar o custo extra; não há orçamento absoluto comprovado para todas as máquinas. A meta histórica de 1.024 pessoas em 32× é desejada, mas não pode ser declarada atingida sem medição correspondente. Se o requisito de desempenho não for atingido, explicar os números e o gargalo, sem reduzir funcionalidades ou esconder a limitação.
- Confirmar que abrir/fechar o inspetor não altera decisões, duração de tarefa, necessidades, saldo ou resultados eleitorais. Garantir progresso para todos os cidadãos quando o prédio está fora da tela e quando nenhum interior está aberto.
- Atualizar versões de imports/cache do navegador e worker conforme o padrão do projeto; testar recarga limpa. Documentar comportamento, cobertura real, limitações e como observar um interior. Não alterar o tamanho padrão do mapa nem opções já estabelecidas.

## Critérios finais de aceite

A entrega só estará completa quando: (1) todos os perfis de prédio estiverem cobertos ou tiverem fallback funcional explícito; (2) moradores efetivamente andarem por rotas internas válidas e usarem uma vaga adequada antes dos efeitos da atividade; (3) o jogador puder ver isso nos andares inspecionados; (4) reservas, pagamentos, tarefas, necessidades, filas, worker e estados legados permanecerem corretos; e (5) existirem resultados reproduzíveis de testes e medições, com qualquer limitação relatada. Não afirmar que toda interação está pronta apenas porque há um móvel desenhado ou porque um teste chama diretamente uma função sem percorrer a rota.

## Registro da execução (2026-10-28)

Implementado nesta rodada:

- Grafo interno lógico em `js/city_interior_layout.js`, com cache por prédio, busca em largura entre células e andares, pontos de uso e perfis para quarto, banheiro, refeição, lavanderia, trabalho, escritório, plenário, serviço, tratamento, circulação, espera, varanda e cobertura.
- O movimento interno passou a usar essas rotas; tarefas internas têm fases de caminhada/uso/saída, e a saída percorre a rota até a porta. O cidadão só é renderizado dentro do edifício/andar inspecionado; a posição visual interpolada não altera a âncora externa de navegação.
- O renderizador agora mostra mobiliário por cômodo e andar, com meshes agrupadas; o inspetor permite abrir o interior, trocar de andar e voltar à fachada. Para locatários empresariais, a visualização aponta para o andar físico alugado.
- A posição interna compacta é enviada pelo worker e interpolada no cliente. Foram adicionados testes de cache/rotas/perfis e de interpolação, e corrigida a cobrança de faxina paga por banheiro municipal.

Verificação executada:

- `node --check` nos módulos alterados: passou.
- 35 testes focados de layout, ponte worker, varandas, recuperação de atividades, modelos, torres empresariais e filas: passaram.
- A simulação de sustentabilidade de vinte dias passou (302,5 s).
- Benchmark atual em 512 habitantes/256²: simulação 360 atualizações em 2,204 s (p50 5,89 ms; p95 14,96 ms); throughput 240 minutos em 2,495 s, com 4 snapshots e custo médio de encode de 422,6 ms.

Limitações que ainda precisam de validação antes de marcar todos os critérios como concluídos: não foi capturada uma medição prévia equivalente, portanto não há comparação confiável de regressão; o throughput de 2,495 s ainda não alcança a referência de 1,875 s; a inspeção visual manual de casa, prédio alto, escritório locado, banheiro público, sombras e terceira pessoa não foi concluída nesta rodada; e o inventário automático de todos os tipos de prédio/atividade ainda não foi transformado em teste de cobertura. O grafo conecta células do footprint e escadas centrais, mas ainda não descreve obstáculos de cada móvel como colisores independentes.

### Complemento (2026-10-28)

- A cobertura de tipos agora é executável: `tests/building_activity_profiles.test.mjs` falha se qualquer chave de `BUILDING_TYPES` ficar sem perfil ou justificativa de fallback. O catálogo classifica cada ramo e o posto recomendado. A planta gerada continua respeitando a atribuição atual de cômodos, pois uma tentativa de substituir em massa as oficinas por balcões/salas clínicas fez a cadeia alimentar falhar; a especialização visual ainda requer integração gradual por ramo com testes econômicos.
- Passarelas usam a mesma lista determinística no renderizador e na simulação. A busca avalia os dois sentidos; escadas visíveis ligam o passeio à plataforma; pedestres sobem, cruzam, descem e voltam a validar o terreno. A posição vertical compacta atravessa os pacotes do worker e eleva o modelo do cidadão. O teste percorre um trajeto de ida e volta ao nível do solo.
- Os imports principais receberam novas versões para evitar que o navegador mantenha os módulos anteriores em cache. A aplicação recarregou em `127.0.0.1:8000`, renderizou a cidade e não registrou erros no console. A inspeção visual foi só da vista inicial; os interiores de casa, torre locada, banheiro e terceira pessoa ainda não foram validados manualmente nesta execução.
- Testes focados de atividade, necessidades, salas, torres, fila, modelos, cobertura, passarelas e cadeia veicular: 39 passaram. O caso prolongado de sustentabilidade (20 dias) passou após o recuo da especialização em lote, em 412 s, incluindo produção de pão e balanço exato de moeda/estoque. A falha isolada de exaustão da pedreira continua: reproduzi-a com o pathfinding de passarela explicitamente desligado, então ela não foi introduzida por esta rota e continua pendente.
- Benchmark atual, 512 moradores/256², seed 1337, modo `simulation` (360 atualizações a 1/6 s): 3,265 s, p50 9,29 ms, p95 25,06 ms; repetição: 3,606 s, p50 10,02 ms, p95 26,02 ms. Controle local com roteamento de passarelas desligado: 3,283 s, p50 9,53 ms, p95 23,27 ms, sugerindo custo direto insignificante nesta amostra. `throughput` (240 minutos): 4,026 s, sete snapshots, encode médio 665,9 ms; continua acima da referência histórica de 1,875 s. O ambiente/estado do código não fornece baseline prévio equivalente, portanto não dá para atribuir a diferença histórica a esta implementação nem afirmar não regressão. FPS/GPU não medidos.
- Ainda faltam: teste de colisão em microescala contra cada móvel (o grafo atual continua usando células e pontos de interação), inspeção manual dos interiores e verificação de arte/animação no uso de cama e assentos. Até esses itens passarem, este plano permanece parcialmente concluído; o mapeamento automático não significa que cada profissão já tem um ativo visual exclusivo.

### Verificação final desta rodada

- A versão de cache `interiors-completion-2` foi propagada aos imports do mapa, da aplicação e do worker. A carga no navegador local confirmou HTTP 200 para os módulos alterados e carregou a cena inicial.
- Sintaxe dos módulos alterados e `git diff --check`: aprovados.
- Suíte focada ampliada: 54 testes passaram, cobrindo interiores, reservas e atividades, passarelas, worker, varandas, modelos e torres empresariais.
- O plano ainda não pode ser marcado como completo: falta validar colisão no espaço de cada móvel e concluir a inspeção visual detalhada de interiores/poses. Os perfis funcionais especializados por ramo também continuam parciais; não foi seguro substituir em lote os cômodos atuais porque isso quebrou a cadeia alimentar.
