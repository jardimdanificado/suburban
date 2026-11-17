# Rodadas de otimização

## Rodada 1 — fachadas para grafite

A busca autônoma de grafite construía todas as superfícies superiores e validava suas rotas internas antes de escolher o primeiro alvo. Agora um iterador valida as fachadas sob demanda e para após encontrar a primeira rota utilizável. A API que retorna a lista completa continua disponível.

Na seed 1794658272, arquipélago, 512 moradores, 128×128, em 400 minutos simulados sem LOD de fast-forward:

| Medida local | Antes | Depois |
| --- | ---: | ---: |
| Pico da busca de grafite | 494,4 ms | 15,9 ms |
| Maior atualização completa | 521,4 ms | 410,0 ms |
| Percentil 95 das atualizações | 83,9 ms | 67,2 ms |
| Tempo total medido | 15,03 s | 13,51 s |

Os checksums completos do benchmark coincidiram: `53949bbbcbb78c9c389ea10ca3fb7cc837ed5cb21d579b590ee8675d0c836509`. A ordem dos alvos e o consumo do gerador aleatório foram preservados.

Validação: testes de grafite, texto e andares superiores, incluindo interrupção da enumeração antes de prédios não utilizados. Comando de medição:

```sh
SUBURBAN_BENCH_SEED=1794658272 SUBURBAN_BENCH_PRESET=0 \
SUBURBAN_BENCH_SIZE=128 SUBURBAN_BENCH_CITY_MINUTES=400 \
SUBURBAN_BENCH_FF=0 SUBURBAN_BENCH_PROFILE=1 \
node scripts/benchmark-fast-simulation.mjs
```

Esses tempos medem CPU da simulação local, sem renderização. Ainda existem picos em outros sistemas; os números não equivalem a FPS nem a medições no celular.
