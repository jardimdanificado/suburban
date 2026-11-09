# Medição inicial: múltiplas cidades

Executado em 2026-11-09 com Node v24.21.0, Linux x86_64, 16 processadores reportados pelo sistema. Cada cidade usou um worker real, mapa 128×128, 64 cidadãos e velocidade 1×. A janela medida foi de 5 segundos após a inicialização e o primeiro snapshot.

| Cidades | CPU média do processo¹ | RSS após carga | RSS após 5 s | Aumento na janela | Snapshot médio | Codificação média | Maior atualização reportada | Minutos avançados |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2 | 70,4% | 612.499.456 B | 648.118.272 B | 35.618.816 B | 74.484 B | 54,27 ms | 136,32 ms | 18–22 |
| 4 | 144,9% | 1.004.441.600 B | 1.054.380.032 B | 49.938.432 B | 74.457 B | 56,18–59,88 ms | 159,44 ms | 19–22 |
| 2 | 66,2% | 638.230.528 B | 700.715.008 B | 62.484.480 B | 133.082–136.097 B | 40,03–40,67 ms | 103,38 ms | 19–21 |
| 2 | 112,1% | 685.367.296 B | 681.017.344 B | −4.349.952 B | 306.884–320.139 B | 73,88–84,16 ms | 229,65 ms | 18–22 |
| 2 | 88,9% | 862.695.424 B | 983.306.240 B | 120.610.816 B | 1.148.179–1.162.010 B | 101,61–110,13 ms | 120,86 ms | 499 |
| 2 | 93,4% | 860.348.416 B | 1.508.966.400 B | 648.617.984 B | 869.795–939.405 B | 131,34–133,96 ms | 150,36 ms | 941–948 |
| 2 | 117,3% | 849.805.312 B | 1.801.207.808 B | 951.402.496 B | 755.479–824.052 B | 255,28–267,20 ms | 427,56 ms | 1.552–1.556 |
| 2 | 116,7% | 855.683.072 B | 1.818.759.168 B | 963.076.096 B | 760.509–810.962 B | 259,85–264,66 ms | 485,79 ms | 1.558 |
| 2 | 158,7% | 854.884.352 B | 2.685.915.136 B | 1.831.030.784 B | 1.004.166–1.018.111 B | 459,11–461,26 ms | 864,66 ms | 6.435–6.519 |
| 2 | 156,5% | 855.564.288 B | 2.737.995.776 B | 1.882.431.488 B | 982.921–994.458 B | 432,93–438,69 ms | 883,08 ms | 6.456–6.555 |
| 2 | 137,3% | 862.576.640 B | 2.505.695.232 B | 1.643.118.592 B | 936.730–950.698 B | 345,71–345,94 ms | 608,23 ms | 6.722–6.760 |

¹ Percentual relativo a um núcleo. Os valores variam por cidade e pelo trabalho autônomo que acontece durante a janela. O RSS após carga inclui a simulação e os workers; o aumento mede a variação durante a janela e não é o custo total por cidade. As linhas adicionais usam 128 e 256 cidadãos por cidade, mapa 256×256 e a mesma janela de 5 segundos.

## Interpretação atual

O teste confirma avanço simultâneo e snapshots em todas as sessões. O custo de CPU quase dobra de duas para quatro cidades, enquanto o custo médio de codificação por snapshot ficou perto de 55–60 ms nas duas configurações de 64 pessoas. Com 128 pessoas e mapas 256×256, os snapshots ficaram perto de 133 KB e a codificação perto de 40 ms. Com 256 pessoas, os snapshots ficaram próximos de 300 KB, a codificação chegou a 84 ms e a maior atualização observada passou de 229 ms. O RSS total após carga passou de aproximadamente 612 MB para 1,0 GB no teste de quatro cidades; quatro cidades com população maior precisam ser avaliadas antes de escolher um limite de escala.

As duas primeiras linhas usam cidades pequenas, mapa 128×128 e população 64; as duas seguintes usam mapa 256×256 com 128 e 256 pessoas; as demais cobrem duas cidades com 512 pessoas. Antes da poda social, duas execuções de 30 minutos chegaram a 2,69–2,74 GB de RSS e 156–159% de um núcleo. O diagnóstico mostrou heap pós-GC de ~634 MB no coordenador e 321–337 MB por worker, contra ~154 MB e ~67–71 MB no primeiro minuto. O grafo social acumulava relações entre conhecidos e era responsável por boa parte do crescimento; caches de caminho permaneceram pequenos. Após expirar relações fracas sem contato por três dias simulados, a terceira execução de 30 minutos terminou com 2,51 GB de RSS, 137,3% de um núcleo, heap pós-GC de ~587 MB no coordenador e 306–308 MB por worker. Na última metade, RSS oscilou em torno de 2,4–2,5 GB. Cada snapshot ficou perto de 0,94 MB; as cidades terminaram com 5,9–7,5 mil relações, 768 fatos sociais, 14,7–15,6 mil memórias/beliefs, ~16,4 mil entradas de histórico e ledger de 1.000 entradas. Assim, 2 cidades de 512 moradores em mapas 256×256 são o cenário mais exigente medido, com custo alto de memória. Para uma implantação menor, 4 cidades de 64 moradores em mapas 128×128 usaram ~1,05 GB em execução curta; duração longa nessa combinação não foi medida. Resultados não incluem a renderização WebGL nem picos de população e não garantem os mesmos limites em outro hardware. Reproduzir com:

```sh
SUBURBAN_MULTI_DURATION_MS=5000 SUBURBAN_MULTI_POPULATION=64 node scripts/benchmark-multicity.mjs 2
SUBURBAN_MULTI_DURATION_MS=5000 SUBURBAN_MULTI_POPULATION=64 node scripts/benchmark-multicity.mjs 4
SUBURBAN_MULTI_DURATION_MS=5000 SUBURBAN_MULTI_MAP_SIZE=256 SUBURBAN_MULTI_POPULATION=128 node scripts/benchmark-multicity.mjs 2
SUBURBAN_MULTI_DURATION_MS=5000 SUBURBAN_MULTI_MAP_SIZE=256 SUBURBAN_MULTI_POPULATION=256 node scripts/benchmark-multicity.mjs 2
SUBURBAN_MULTI_DURATION_MS=5000 SUBURBAN_MULTI_MAP_SIZE=256 SUBURBAN_MULTI_POPULATION=512 node scripts/benchmark-multicity.mjs 2
SUBURBAN_MULTI_DURATION_MS=120000 SUBURBAN_MULTI_MAP_SIZE=256 SUBURBAN_MULTI_POPULATION=512 node scripts/benchmark-multicity.mjs 2
SUBURBAN_MULTI_DURATION_MS=300000 SUBURBAN_MULTI_MAP_SIZE=256 SUBURBAN_MULTI_POPULATION=512 node scripts/benchmark-multicity.mjs 2
SUBURBAN_MULTI_DURATION_MS=600000 SUBURBAN_MULTI_MAP_SIZE=256 SUBURBAN_MULTI_POPULATION=512 node --expose-gc scripts/benchmark-multicity.mjs 2
SUBURBAN_MULTI_DURATION_MS=1800000 SUBURBAN_MULTI_MAP_SIZE=256 SUBURBAN_MULTI_POPULATION=512 node --expose-gc scripts/benchmark-multicity.mjs 2
```
