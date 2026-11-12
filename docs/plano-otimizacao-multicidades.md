# Plano: otimização da simulação depois das múltiplas cidades

## Sintoma

Antes de multi-cidades a partida rodava com uma simulação. Hoje o jogo **sempre começa com duas cidades** (`ensureMinimumWorldCities(2)`, em `app.js`), cada uma com sua própria `CitySimulation`, seu worker e sua população completa. O custo deixou de ser "uma cidade" e passou a ser "duas cidades + dois espelhos na thread principal", sem que a segunda cidade tenha sido projetada para rodar em segundo plano.

Este plano separa o que é transporte de estado, o que é espelho de interface, o que é CPU de simulação e o que é renderização, para atacar primeiro o que dá ganho grande com risco baixo.

## Medição de hoje (baseline)

Comando:

```sh
SUBURBAN_MULTI_DURATION_MS=8000 SUBURBAN_MULTI_MAP_SIZE=128 \
SUBURBAN_MULTI_POPULATION=512 SUBURBAN_MULTI_SPEED=32 \
node scripts/benchmark-multicity.mjs 2
```

Duas cidades, 512 moradores, mapa 128×128, 32×. Máquina do usuário, Node v24, sem renderização:

| Métrica | Cidade 1 | Cidade 2 |
|---|---:|---:|
| Snapshots completos na janela | 4 | 4 |
| Tamanho médio do snapshot | 5,54 MB | 5,69 MB |
| Codificação média do snapshot | 188 ms | 201 ms |
| Atualização média do worker | 15 ms | 15 ms |
| Maior atualização do worker | 215 ms | 182 ms |
| Minuto final | 797 | 806 |

Agregado: **355% de um núcleo**, RSS de **883 MB para 1482 MB (+599 MB em ~10 s)**. O benchmark não inclui WebGL nem a aplicação dos pacotes pela ponte, então o navegador é pior que isso.

Para comparação, os relatórios existentes:

- [benchmark-multiplas-cidades.md](benchmark-multiplas-cidades.md): 2 cidades de 512 em 30 min → 2,5 GB de RSS, 137% de um núcleo, snapshots de ~0,94 MB, heap pós-GC de ~587 MB no coordenador e 306–308 MB por worker.
- [performance-state-tail.md](performance-state-tail.md): aplicar um snapshot pela ponte custava 21–29 ms com 1024 habitantes; o pacote ainda era ~1 MB.
- [performance-night-simulation-profile.md](performance-night-simulation-profile.md): nos passos de 1 minuto, cidadãos somam 3,76 s de 6,13 s; deslocamentos somam 4,06 s dos 10,75 s totais.

## Onde o custo está, em ordem

1. **Duas cidades em detalhe integral, sempre.** Não existe nível de detalhe por cidade: a cidade de fundo executa exatamente os mesmos passos, conversas, interiores, móveis, arte e sincronização visual da cidade observada. O relógio mundial avança até o **menor** minuto entre as sessões (`WorldCoordinator.reconcileMinute`), então não é possível simplesmente "rodar a cidade de fundo mais devagar" sem travar o relógio global.
2. **Snapshots completos enormes, mesmo para a cidade que ninguém está vendo.** `stateInterval()` em `city_sim_worker.js` aumenta o intervalo da cidade não observada (8–20 s), mas o conteúdo continua sendo o grafo inteiro. Em 32×, cada snapshot chega a 5,5 MB e ~200 ms de codificação.
3. **Todo snapshot recebido é aplicado na thread principal, inclusive o da cidade de fundo.** `CitySimulationBridge.receive()` não consulta `this.observed`: aplica o grafo, refaz índices (`bindCityState(...,{rebuildIndexes:true})`), recalcula terreno, percorre todos os cidadãos e reconstrói amostras de movimento. Para uma cidade que não é desenhada, isso é trabalho puro de GC.
4. **Cada cidade mantém um espelho completo na thread principal.** No ensaio, o grafo de cada cidade tinha ~74 mil objetos e ~900 mil slots (incluindo ~16 mil memórias sociais e ~136 mil slots de objetos congelados). Dois espelhos + dois workers explicam boa parte do RSS e das pausas de GC.
5. **Salvar re-encoda todas as cidades na thread principal.** `captureWorldSave()` aguarda `checkpoint()` de cada worker e **ignora o resultado**, depois cria um `CityStateGraph` novo e codifica o espelho de cada cidade. Isso é um congelamento de centenas de ms por cidade e é o motivo pelo qual o espelho de fundo precisa estar sempre atualizado.
6. **Fundar cidade inicializa uma simulação inteira na thread principal.** `foundCity()` constrói `new CitySimulation`, chama `initialize()` e só então manda o pacote para o worker. Isso acontece no boot (cidade 2) e em "Nova cidade".
7. **Duplicação de dados no snapshot da cidade observada.** Posições e necessidades viajam no pacote completo e também no canal compacto de movimento (100 ms). Necessidades custam pouco (~49 KB com 512), mas posições, interiores, veículos e `boatRiders` são recalculados e transferidos em todas as mensagens.
8. **CPU dos passos em si** (cidadãos, sociedade, interiores). É relevante, mas é o item que já recebeu mais atenção nos relatórios anteriores e o que tem maior risco de alterar regras. Deve vir depois do transporte e do espelho.

## Princípios

- **O estado autoritativo é do worker.** O espelho na thread principal é cache de interface e de renderização, não a fonte da verdade. Salvamento e troca de cidade devem vir do worker.
- **Regras iguais para todas as cidades; detalhe de sincronização diferente.** Primeiro cortar transferência e espelho (não muda resultado nenhum). Só depois avaliar detalhe de simulação, com teste de fidelidade explícito.
- **Uma coisa por fase, com número antes/depois.** Nada entra sem o benchmark da mesma janela, mesma população e mesma velocidade.
- **Hash e conservação continuam sendo o contrato.** Toda fase que não pretende mudar resultado precisa manter os hashes de necessidades, atividades, posições, finanças, relações e estoques.

## Fase 0 — instrumentar e fixar o baseline

Objetivo: saber, no navegador, quanto é simulação, quanto é transporte, quanto é espelho e quanto é render.

- Registrar por cidade, na ponte: bytes do pacote, tempo de decodificação/aplicação, nós alterados, tempo de `bindCityState`, tempo de diferenciação de terreno, tempo de reconstrução de amostras de movimento. O `metrics` da ponte já recebe `encodeMs`/`applyMs`/`changedNodes`; falta separar por cidade e expor no painel `?profile`.
- Registrar no worker: tempo de `update` por fase (já existe `lastUpdateProfile`) e custo de snapshot por cidade (já existe `maxSnapshotMs`).
- Criar um cenário de benchmark que reproduza o uso real: **duas cidades, uma observada e outra não**, com a ponte aplicando os pacotes (o `scripts/benchmark.mjs` já tem modo `bridge`; falta o modo duas cidades com observação alternada).
- Capturar uma sessão de navegador com `?profile` em 2 cidades/512/32× e guardar `root.dataset.performance` antes de qualquer mudança. É a única forma de separar "simulação terrível" de "render/GC terrível".

**Critério:** números por cidade disponíveis e baseline do navegador arquivado em `docs/`.

## Fase 1 — salvamento e troca de cidade pelo worker (pré-requisito)

Sem isso não é possível parar de sincronizar a cidade de fundo, porque o salvamento depende do espelho atualizado.

**Estado:** implementado. O worker responde a `export-state` com um pacote completo gerado por um `CityStateGraph` novo; `captureWorldSave()` usa esse pacote e não re-encoda mais os espelhos. O `checkpoint()` que era aguardado e descartado foi removido do salvamento. A seleção de cidade continua usando `checkpoint()` para atualizar o espelho congelado antes de observar. O formato de salvamento versão 1 foi mantido.

- O encode de cada cidade acontece no worker, em paralelo entre as cidades, fora da thread principal.
- O pacote ainda precisa ser clonado para a thread principal e gravado no IndexedDB; só o encode saiu da thread principal.
- O salvamento não depende mais de o espelho de uma cidade de fundo estar atualizado.
- `setActiveCity()` pede `checkpoint()` apenas quando a cidade estava em segundo plano, mantendo o espelho pronto para desenho.

**Critério:** salvar e carregar um mundo com 3 cidades, com uma viagem em trânsito, sem duplicar ou perder entidades, sem congelamento perceptível e sem `checkpoint` desperdiçado.

## Fase 2 — cidade não observada sem espelho completo (maior ganho seguro)

Objetivo: cortar transferência, aplicação e memória da cidade que não está sendo exibida, sem tocar em nenhuma regra.

- Em `CitySimulationBridge.receive()`, quando `!this.observed`, **não aplicar o grafo**. Guardar apenas o necessário para o seletor de cidades: minuto, população, emprego, felicidade, moradias, empresas — que já chegam pelo `summary` a cada 5 s.
- No worker, para `!observed`: parar de emitir snapshot completo; manter `heartbeat` (relógio) e `summary` (indicadores). Snapshot completo só sob demanda (`export-state`).
- `setActiveCity()` pede `export-state` ao worker da cidade escolhida e aplica uma única vez, antes de trocar o mapa/renderizador.
- Não construir `motionSamples`, não reconstruir índices, não diferenciar terreno, não chamar `applyBoatRiders`/`applyVehiclePositions` para cidade de fundo.
- Ao remover o espelho de fundo, remover também a cidade da memória da ponte? Não: `session.city` continua sendo usado pela interface de mundo (nome, porto, cidadãos para migração e comércio). Precisa continuar existindo, mas **congelado** e sem receber deltas. A alternativa mais agressiva (descartar o espelho e reconstruir do `export-state` ao selecionar) deve ser avaliada depois; ela quebra `resolveCitizen` entre cidades, que hoje varre `city.citizens`.
- `updateCitySummary` usa `structuredClone` a cada 5 s por cidade; trocar por uma cópia rasa tipada.

**Estado:** implementado. O worker deixa de emitir grafos periódicos quando `observed` é falso; a ponte ignora esses pacotes e mantém o espelho congelado, com checkpoint sob demanda na seleção. O salvamento usa `export-state` do worker desde a fase 1, portanto não depende mais do espelho estar atualizado.

**Resultado medido** (2 execuções por cenário, 2 cidades, 512 moradores, 128×128, 32×, janela de 8 s; `SUBURBAN_MULTI_BACKGROUND=1`):

| Cenário | CPU do processo | Aplicação da cidade de fundo | Bytes da cidade de fundo | Snapshots da cidade de fundo |
|---|---:|---:|---:|---:|
| Duas observadas | 351–356% | 619–704 ms | 23,4 MB | 4 |
| Uma observada | 332–333% | 26–33 ms | 1,0 MB | 1 (inicial) |

A cidade de fundo deixou de custar ~95% da aplicação na thread principal e ~96% dos bytes de snapshot. O CPU total caiu ~6%, porque a simulação da cidade de fundo continua no detalhe integral (fase 4). O espelho congelado permanece na memória; descartá-lo é a decisão pendente abaixo.

**Critério:** no cenário de 2 cidades/512/32×, bytes de snapshot por segundo e tempo de aplicação na thread principal caem ~50%; minutos avançados por cidade não caem; salvar/carregar e trocar de cidade continuam corretos.

## Fase 3 — enxugar o snapshot da cidade observada

Depois da fase 2 sobra um snapshot de ~5 MB a cada ~3 s em 32×. O que dá para tirar sem perder informação:

- **Necessidades fora do snapshot completo.** O canal compacto de movimento já manda `vitals()` a cada 100 ms para a cidade observada. `packNeeds` no snapshot é necessário apenas para `export-state`.
- **Posições, interiores, veículos e `boatRiders` fora do snapshot completo.** O snapshot pode ser só o delta de grafo; o canal de movimento já carrega tudo isso. Manter no `export-state`.
- **Histórico e memória social em cadência própria.** `histories` e os nós de memória/fatos sociais são a maior parte do volume e não precisam de atualização a cada 3 s para a interface. Enviar essas partes a cada 4º snapshot (ou por tamanho acumulado), mantendo o cursor do histórico.
- **Reaproveitar buffers** de `positions()`, `interiorPositions()`, `vehiclePositions()` e `vitals()` entre emissões, em vez de alocar `Float64Array` novo a cada 100 ms por cidade observada.

**Ganho esperado (estimativa):** 20–40% menos bytes e menos alocação por snapshot da cidade observada. Medir com `meanSnapshotBytes` e `applyMs`, não com impressão.

**Critério:** hashes idênticos; histórico e memória social visíveis na interface sem atraso perceptível; bytes por snapshot abaixo do baseline.

## Fase 4 — detalhe de fundo para cidades não observadas (escala)

Esta é a única fase que mexe em resultado e por isso vem depois. O relógio mundial impede reduzir minutos simulados, então o caminho é reduzir **detalhe por minuto**, não tempo.

- Aproveitar a maquinaria de fast-forward já testada (`city.fastForward`/`fastForward2`, `deferFastForwardCitizen`, agenda de revisões pessoais). Uma cidade de fundo pode rodar com o mesmo `speed` do mundo, mas com o adiamento de decisões pessoais e de sono que hoje só existe em ff/ff2. Os relatórios mediram **17% (noite) a 32% (dia) menos CPU** nesse modo.
- Começar pelas partes puramente cosméticas e de observação: sincronização de móveis, interiores detalhados, arte espontânea, dispersão de aglomerações, roupas/aparência, balões e conversas incidentais. Economia, produção, estoque, logística, moradia, necessidades, política, justiça e eleições continuam no passo de 1 minuto.
- Expor como opção implícita (cidade de fundo), não como configuração do jogador no primeiro momento.
- Medir fidelidade com `scripts/needs_audit.mjs` (20 dias) em uma cidade de fundo: nenhuma morte por privação, conservação de dinheiro e mercadorias, população estável. Se houver divergência, documentar o compromisso como já é feito em [plano-mecanicas-ff.md](plano-mecanicas-ff.md).

**Ganho esperado (estimativa):** 20–30% de CPU por cidade de fundo. É o que permite passar de 2 para 3–4 cidades.

**Critério:** 2 cidades de 512 por 30 min com RSS abaixo de 2 GB e CPU total menor que o baseline; auditoria de necessidades sem mortes por privação na cidade de fundo.

## Fase 5 — memória de longo prazo

- Medir de novo o grafo por cidade (`graph.objects`, `graph.previous`, slots por tipo) e o heap pós-GC de cada worker. O ensaio de hoje mostra ~74 mil objetos e ~900 mil slots por cidade só com 512 moradores.
- Revisar os limites de histórico, memórias, fatos, ledger e eventos por cidade. O ledger já está em 1.000 entradas e a poda social já expira conhecidos fracos; falta medir se esses limites continuam adequados com 2 cidades.
- O espelho de fundo removido na fase 2 deve ser a maior redução; confirmar com RSS antes/depois.
- Só considerar limites de snapshots/`previous` com medição de que o custo de recomputar é menor que o de manter.

**Critério:** 30 min com 2 cidades de 512 termina abaixo de 2 GB de RSS, sem crescimento monotônico na segunda metade.

## Fase 6 — criação de cidade e boot

- Tirar a inicialização de `CitySimulation` da thread principal: o worker pode receber uma especificação (preset, seed, tamanho, população) e construir o estado lá, devolvendo o primeiro pacote completo. Isso elimina o congelamento de `foundCity()` e de `ensureMinimumWorldCities(2)` no boot.
- Alternativa mais barata, se a anterior demorar: adiar a fundação da segunda cidade para depois do primeiro quadro e fazer em `requestIdleCallback`, mantendo o carregamento do mundo.
- Enquanto a cidade de fundo não tem espelho (fase 2), a criação fica mais barata de qualquer forma.

**Critério:** abrir a página com 2 cidades não bloqueia a thread principal por mais de um quadro perceptível; "Nova cidade" não congela a interface.

## O que não repetir

Experimentos já medidos e retirados do projeto:

- Reaproveitar listas serializadas no encoder: 7,9% pior.
- Cache privado de identificadores no encoder: 1,4% pior e picos maiores.
- Preparação de layout de propriedades dos cidadãos: simulação 105% mais cara.
- Reaproveitar leitura de destino em `canStep`: 19,3% pior na comparação noturna.
- Cache de listas de registros imutáveis: sem ganho consistente.

Também não vale insistir em "mais chamadas ao mapa é mais barato" nesse encoder; as medições acima já mostraram o contrário nesses caminhos.

## Ordem, esforço e ganho esperado

| Fase | O que entrega | Esforço | Ganho esperado |
|---|---|---|---|
| 0 | Medição por cidade no navegador e no benchmark | 0,5–1 dia | Nenhum direto; evita otimização no lugar errado |
| 1 | Salvamento e troca de cidade pelo worker | 1 dia | Elimina congelamento do salvamento e libera a fase 2 |
| 2 | Cidade de fundo sem espelho nem snapshot | 1–2 dias | ~50% do transporte e da aplicação com 2 cidades |
| 3 | Snapshot da cidade observada menor | 1–2 dias | 20–40% menos bytes por snapshot |
| 4 | Detalhe de fundo reusando ff/ff2 | 2–4 dias | 20–30% de CPU por cidade de fundo |
| 5 | Memória de longo prazo | 1–2 dias | Manter 2–4 cidades sem crescimento |
| 6 | Criação de cidade fora da thread principal | 1–2 dias | Fim dos congelamentos de boot/nova cidade |

As fases 1 e 2 juntas são as que mais mudam a sensação de fluidez, porque atacam o trabalho que hoje acontece na thread principal por causa de uma cidade que o jogador nem está vendo.

## Critérios de aceitação gerais

- Duas cidades, 512 moradores, 32×, janela de 15 s: minutos avançados por cidade **não diminuem**, CPU total e bytes de snapshot **diminuem** em relação ao baseline.
- Hash de estado autoritativo idêntico ao baseline em todas as fases que não pretendem mudar resultado (1, 2, 3, 5 e 6).
- Conservação de dinheiro e de cada mercadoria nos testes de vários dias.
- Salvar/carregar com 3 cidades, com viagem marítima em trânsito, sem duplicar entidades.
- Auditoria de necessidades de 20 dias sem morte por privação na cidade observada; para a fase 4, também na cidade de fundo.
- Suíte ampla comparada com o baseline conhecido de falhas (a execução registrada em [plano-multiplas-cidades.md](plano-multiplas-cidades.md) tinha 976 aprovações e 41 falhas); nenhuma falha nova.

## Comandos

```sh
# baseline de 2 cidades
SUBURBAN_MULTI_DURATION_MS=15000 SUBURBAN_MULTI_MAP_SIZE=128 \
SUBURBAN_MULTI_POPULATION=512 SUBURBAN_MULTI_SPEED=32 \
node scripts/benchmark-multicity.mjs 2

# cenário longo de memória
SUBURBAN_MULTI_DURATION_MS=1800000 SUBURBAN_MULTI_MAP_SIZE=256 \
SUBURBAN_MULTI_POPULATION=512 node --expose-gc scripts/benchmark-multicity.mjs 2

# simulação isolada (sem transporte nem renderização)
SUBURBAN_BENCH_POPULATION=512 SUBURBAN_BENCH_SPEED=32 node scripts/benchmark-fast-simulation.mjs

# navegador com profiler
# abra http://127.0.0.1:8000/?profile e leia root.dataset.performance no console

# auditoria de necessidades
node scripts/needs_audit.mjs 512 20 256 2120920325 highlands
```

## Decisões pendentes

- **Fidelidade da cidade de fundo:** aceitar trajetórias diferentes (como em ff) ou manter regras idênticas e depender só das fases 1–3. A primeira opção escala; a segunda preserva comparação exata.
- **Espelho de fundo congelado ou descartado:** manter `session.city` congelado preserva busca e migração entre cidades; descartar libera mais memória, mas exige reconstruir tudo ao selecionar e muda `resolveCitizen`.
- **Teto de cidades:** definir o limite a partir da fase 5, não antes. O envelope atual medido é 2 cidades de 512 em mapas 256×256; 4 cidades de 64 em 128×128 usaram ~1,05 GB em execução curta.
