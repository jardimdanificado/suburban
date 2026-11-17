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

## Rodada 2 — banheiros com a mesma porta

Na mesma seed, uma decisão de banheiro fazia até 51 consultas de rota para apenas quatro destinos; até 48 consultas repetiam a mesma porta inacessível. O número de banheiros no prédio multiplicava a tentativa de planejar caminhos terrestres, marítimos e por passarelas.

A decisão agora lembra quais portas não têm rota. Outros banheiros com a mesma entrada são descartados sem repetir a busca. A memória dura somente durante aquela decisão, inclusive sua tentativa de acesso privado por necessidade extrema. A próxima decisão testa as portas novamente, permitindo alterações de terreno, disponibilidade de barcos e acesso. Pontuação, permissões e filas continuam iguais.

Comparação local de 400 minutos simulados com os mesmos parâmetros da rodada 1:

| Medida | Antes | Depois |
| --- | ---: | ---: |
| Pico de busca de banheiro | 309,3 ms | 41,5 ms |
| Maior atualização completa | 402,3 ms | 190,4 ms |
| Percentil 95 das atualizações | 71,1 ms | 67,4 ms |
| Tempo total medido | 13,67 s | 12,80 s |

O checksum completo permaneceu `53949bbbcbb78c9c389ea10ca3fb7cc837ed5cb21d579b590ee8675d0c836509` nas duas execuções.

Os testes cobrem portas repetidas sem rota, nova tentativa após mudança de acesso, seleção do próximo banheiro pela pontuação, autorização de visitantes e contratos de limpeza. O teste longo de vinte dias falhou com `city.world.setSidewalk is not a function`; a mesma falha foi reproduzida com `city_sanitation.js` anterior à rodada, em uma cópia isolada. Essa falha não foi alterada nesta otimização.
