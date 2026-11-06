# Pacotes de estado e rotas internas — 6 de novembro de 2026

A comparação parte do commit `3ca8be7`, incluindo a rodada anterior de iluminação e aglomerações.

O serializador verificava a pertença do mesmo objeto aos conjuntos de cidadãos/entidades a cada campo. Essa informação agora é consultada uma vez por objeto.

Os pontos das rotas internas são fixos, enquanto a posição da pessoa e sua fila de destinos mudam. Os pontos compartilhados do cache agora são imutáveis e o rastro pode reutilizá-los. Isso permite ao transporte incremental reconhecer pontos já enviados e evita criar uma cópia ao alcançar cada destino. A fila individual continua mutável; a posição em movimento continua independente. As coordenadas, os trajetos e a ordem das atividades foram preservados.

## Comparação com 1024 habitantes

Semente 1337, mapa 256×256, 30 snapshots ao longo de 120 minutos da cidade, usando necessidades/posições compactadas e omitindo os caminhos externos, como no worker. Tempos médios de uma execução por versão; há variação de aquecimento e concorrência. Não são FPS nem garantia de desempenho em celulares.

| Etapa por snapshot | Antes | Depois | Redução |
|---|---:|---:|---:|
| Serialização | 191,0 ms | 146,5 ms | 23,3% |
| Aplicação pela ponte | 37,1 ms | 28,6 ms | 22,8% |
| Nós alterados | 6261 | 5209 | 16,8% |
| Tamanho JSON aproximado | 1,648 MB | 1,570 MB | 4,7% |

Os hashes da simulação coincidiram entre as versões. Os hashes do estado esperado para a tela também coincidiram com os da ponte em cada versão. [Dados brutos](performance-snapshot-routes-results.json).

A serialização ainda é cara. Esta rodada não comprova o objetivo geral de fluidez com 1024+ pessoas.

## Correção do benchmark

O ensaio da ponte montava posições em trincas (`id,x,y`), embora o protocolo atual use quatro valores (`id,x,y,pathActive`). Corrigiu-se o formato e acrescentou-se `SUBURBAN_BENCH_COMPACT_PATHS=1` para exercitar a omissão usada pelo worker.

A comparação agora distingue a posição autoritativa da simulação da posição visual dos passageiros, desenhados 0,38 m atrás do veículo por assento. A posição efetivamente recebida é comparada com essa regra, sem normalizar o resultado da ponte. Um hash separado conserva as coordenadas autoritativas originais.

```sh
SUBURBAN_BENCH_POPULATION=1024 SUBURBAN_BENCH_MAP_SIZE=256 SUBURBAN_BENCH_COMPACT_PATHS=1 node scripts/benchmark.mjs bridge
```

Um terceiro argumento opcional indica outro checkout. Use o script atualizado nas duas versões para conservar o mesmo formato de pacote.

## Verificação

Os 25 testes iniciais de layout, passagem por portas, atividades, sincronização compacta e passageiros passaram. Após acrescentar os testes de pontos compartilhados e de posição móvel independente, os 17 testes direcionados dessa segunda seleção também passaram. O transporte conserva as referências e o estado de necessidades, finanças e relações usados pelo benchmark; os modelos e a resolução não foram alterados por esta rodada.

A validação de 1020 minutos da cidade com 1024 habitantes atravessou a primeira noite e conservou o hash `c5405271dba250c6e3899da4f4e238c1a873b92e679817bf7522c54acd444d71` do cenário de comparação. A execução isolada de 240 minutos consumiu 10,22 s de CPU da thread e manteve o hash das execuções anteriores. Não se usa uma amostra executada simultaneamente com outros testes para estimar ganho de CPU.

Uma seleção adicional de 27 testes de atividades, necessidades básicas, pontes aéreas, layout e trilhas também passou. As alterações desta rodada não foram usadas para declarar a suíte completa aprovada.
