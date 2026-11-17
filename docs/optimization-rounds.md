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

## Rodada 3 — folga do casco durante o planejamento

A medição foi ampliada para 1.200 minutos simulados na mesma seed. No minuto 947, uma única cotação de realocação levou cerca de 274 ms: 258 ms na travessia e 16 ms nas aproximações. O algoritmo repetia consultas de terreno e obstáculos para as amostras do casco em cada direção de cada nó da busca.

Agora cada busca de casco mantém um retrato local e preguiçoso de altura, água e passagem livre das células visitadas. Leituras repetidas usam arrays tipados. O retrato existe somente durante a busca síncrona; o movimento real continua consultando os obstáculos atuais, sem reutilizar esse retrato.

| Medida local, 1.200 minutos | Antes | Depois |
| --- | ---: | ---: |
| Pico da fase de veículos | 265,2 ms | 49,8 ms |
| Maior atualização completa | 293,3 ms | 175,0 ms |
| Percentil 95 das atualizações | 60,5 ms | 63,0 ms |
| Tempo total medido | 35,42 s | 35,63 s |

O ganho demonstrado é na duração da pausa, não no tempo total ou no percentil 95. O checksum completo dos 1.200 minutos coincidiu: `e45047d1e763c09f5510d07095ea4107926c90d5f8fcc8f7318aab0015b2d84d`.

O teste de regressão reproduziu 52.878 consultas de passagem livre na versão anterior, em um mapa de 768 células. A versão corrigida passa com limite inferior a duas consultas por célula para a cotação completa, incluindo suas verificações externas ao casco. O teste também introduz um obstáculo após planejar e confirma que o barco não atravessa o novo bloqueio.

Para repetir a medição, use o comando da rodada 1 com `SUBURBAN_BENCH_CITY_MINUTES=1200`. Os próximos picos observados foram a preparação diária no minuto 1440 e o movimento no minuto 1093, ambos perto de 113 ms.

## Rodada 4 — imóveis por proprietário no fechamento diário

O fechamento econômico diário percorria o registro completo de cômodos para cada adulto, mesmo quando aquele morador não possuía imóveis. Agora uma única passagem agrupa os cômodos por proprietário. A decisão de vender ou alugar consulta somente o grupo daquele morador, preservando a ordem, as categorias residenciais, o limite de liquidez, a preferência por aluguel e as exclusões de moradia própria, locatários, menores e moradores mortos.

O agrupamento é local ao fechamento; transferências de propriedade e mudanças de saldo são consideradas novamente na próxima chamada, sem cache persistido.

Na seed e nos 1.200 minutos das rodadas anteriores:

| Medida local | Antes | Depois |
| --- | ---: | ---: |
| Preparação diária total | 103,7 ms | 97,8 ms |
| Fechamento econômico interno | 33,6 ms | 28,4 ms |
| Maior atualização completa | 162,2 ms | 156,5 ms |
| Tempo total medido | 35,586 s | 35,590 s |

O ganho no cenário real é pequeno; não houve redução do tempo total. O checksum completo permaneceu `e45047d1e763c09f5510d07095ea4107926c90d5f8fcc8f7318aab0015b2d84d`.

O benchmark isolado `node scripts/benchmark-daily-listings.mjs` usa 1.024 proprietários, 32.768 cômodos e oito fechamentos. Nessa carga sintética, o tempo caiu de 2.897 ms para 33,3 ms e as varreduras completas caíram de 8.192 para oito. O checksum das decisões permaneceu `647454482a5740195106a4cb49423fe91f06be6b8a849e4555e5666a3a4ef2d1`. Esse teste demonstra o ganho de escala da etapa, não o desempenho do jogo inteiro.

Validação: 13 testes passaram, incluindo conservação econômica em uma cidade autônoma por vários dias e os novos casos de propriedade, saldos, locatários e categorias residenciais. Um teste antigo espera exatamente 12 culturas agrícolas, enquanto o catálogo atual tem 32; a mesma falha foi reproduzida com `city_economy.js` anterior à rodada. O teste de uma única varredura falhou na versão anterior com três passagens para três adultos e passou após a alteração.
