# Congelamento da simulação: seed 1794658272

## Reprodução e causa

Configuração: arquipélago (preset 0), seed 1794658272, 512 moradores, mapa 128×128. A reprodução usa uma cidade nova, transferida pelo mesmo grafo de estado do worker, sem renderização.

No minuto 830 (13h50 do primeiro dia), uma atualização levou 32,9 segundos. A fase de veículos consumiu 32,87 segundos. Uma captura da pilha durante o bloqueio apontou `dispatchBoatRelocations`, `planBoatTrip`, `crossingRoute` e `boatTowClear`.

A realocação examinava até 16 solicitações, 12 margens e quatro barcos, procurando operadores para cada combinação. Todo o trabalho ocorria na mesma chamada. Operadores e bicicletas distintos também repetiam buscas de geometria equivalentes. Não era necessário lançar uma exceção para bloquear o worker por dezenas de segundos.

## Correção

- A simulação executa no máximo uma busca de realocação por minuto simulado. Um iterador privado retoma o trabalho nas chamadas seguintes, inclusive fora dos múltiplos de dez minutos.
- Edições do terreno, estruturas ou obstáculos descartam o planejamento pendente. Antes de reservar ou comprar um barco, o planejamento revalida a demanda, o operador, a propriedade e a disponibilidade dos ativos.
- Rotas de aproximação e travessia compartilham geometria durante o mesmo minuto. O cache considera dimensões do mapa, revisões, obstáculos, classe e dimensões do casco, bicicleta, origem, destino e limite de tempo. Cada mapa de cache tem limite de 512 entradas.
- Os caches e iteradores usam `WeakMap`; não entram no grafo de save. As reservas reais continuam no estado persistido.

A realocação pode demorar mais minutos simulados para ser decidida. As viagens iniciadas continuam usando barcos e bicicletas físicos, sem teletransporte.

## Medição local

400 minutos solicitados, a partir de 08h00, com passo de 0,25 s e LOD de fast-forward desligado:

| Medida | Antes | Depois |
| --- | ---: | ---: |
| Maior atualização | 32.888 ms | 533 ms |
| Maior fase de veículos | 32.868 ms | 14,6 ms |
| Percentil 95 das atualizações | 241 ms | 96 ms |
| Tempo total da região medida | 55,7 s | 16,5 s |

Uma execução separada em velocidade 1, com passo de 1/60 s, chegou ao minuto 879: pico de 662 ms por atualização e 19,7 ms na fase de veículos. O último minuto solicitado ficou no acumulador fracionário.

O pico restante nas duas execuções corrigidas ocorreu na fase de justiça, principalmente na busca de locais para grafite. Portanto, esta correção elimina o bloqueio longo reproduzido no planejador de realocação; ainda existem pausas menores. Os números medem CPU da simulação local, não FPS nem desempenho de um celular.

Para reproduzir a medição principal:

```sh
SUBURBAN_BENCH_SEED=1794658272 \
SUBURBAN_BENCH_PRESET=0 \
SUBURBAN_BENCH_SIZE=128 \
SUBURBAN_BENCH_POPULATION=512 \
SUBURBAN_BENCH_CITY_MINUTES=400 \
SUBURBAN_BENCH_FF=0 \
SUBURBAN_BENCH_PROFILE=1 \
node scripts/benchmark-fast-simulation.mjs
```

Um argumento posicional seleciona outro checkout. Para velocidade normal, acrescente `SUBURBAN_BENCH_SPEED=1`.

Os testes focados cobrem reutilização e invalidação de geometria, retomada do planejamento, mudanças de disponibilidade durante a espera, viagens físicas, travessias compartilhadas e exportação de saves pelo worker.
