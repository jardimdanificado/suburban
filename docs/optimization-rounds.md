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

## Rodada 5 — destinos compartilhados no recrutamento de passageiros

O pico de movimento no minuto 1093 vinha do início de uma travessia coletiva. O recrutamento consultava até 32 moradores e calculava, para cada candidato, a rota direta, o acesso ao embarque e o caminho da margem de desembarque ao destino. Vários candidatos tinham o mesmo destino; uma dessas buscas finais custava aproximadamente 8 ms e era repetida.

Agora o recrutamento reutiliza a busca da margem para cada célula de destino, incluindo resultados sem caminho. O mapa existe somente durante aquela chamada síncrona de recrutamento. Novos embarques e pedidos posteriores consultam o terreno novamente. Cada passageiro mantém suas próprias listas e pontos de movimento; ordem, capacidade, elegibilidade e tarifas permanecem iguais.

Na seed 1794658272, arquipélago, 512 moradores, 128×128, em 1.200 minutos simulados sem LOD de fast-forward:

| Medida local | Antes | Depois |
| --- | ---: | ---: |
| Pico de movimento, minuto 1093 | 120,9 ms | 60,7 ms |
| Tempo acumulado de movimento | 3,408 s | 3,106 s |
| Percentil 95 das atualizações | 62,4 ms | 60,6 ms |
| Maior atualização completa | 157,8 ms | 164,9 ms |
| Tempo total medido | 36,192 s | 35,297 s |

O pico específico caiu pela metade. A maior atualização geral não melhorou: após a alteração ocorreu no minuto 481. Os tempos totais representam uma execução por versão e incluem variação de execução; não demonstram eliminação de todos os picos. O checksum completo do benchmark permaneceu `e45047d1e763c09f5510d07095ea4107926c90d5f8fcc8f7318aab0015b2d84d`.

Validação: 45 testes passaram nas suítes `boat_crossings`, `boat_towing`, `boat_boarding`, `boat_trip_routine`, `boat_rider_motion` e `worker_state_export`. O novo teste compara um e sete passageiros com o mesmo destino: as consultas a uma célula da margem caíram de 42 para seis, mantendo sete passageiros recrutados e listas independentes. O teste falhou na versão anterior e passou após a alteração. Para repetir a medição, use o comando da rodada 1 com `SUBURBAN_BENCH_CITY_MINUTES=1200`.

## Rodada 6 — recusa antecipada de travessias mais lentas que caminhar

A investigação do minuto 878 encontrou 98 chamadas de `findPath`, somando aproximadamente 100 ms na execução instrumentada; nenhuma busca individual explicava sozinha aquele pico. Parte do trabalho vinha da avaliação de travessias coletivas: mesmo quando a caminhada direta já era mais rápida que embarcar e navegar, a avaliação ainda buscava os dois trajetos terrestres de acesso antes de recusar o passageiro.

Um caso no minuto 1180 gastou 6,1 ms para avaliar uma caminhada de 0,35 s contra um mínimo de 5,08 s de embarque e navegação. Agora a comparação ocorre logo após calcular o trajeto direto. Como os dois trechos terrestres não podem ter duração negativa, essa recusa preserva a decisão final. Travessias úteis continuam calculando e comparando todos os trechos.

Na seed 1794658272, arquipélago, 512 moradores, 128×128, em 1.200 minutos simulados sem LOD de fast-forward:

| Medida local | Antes | Depois |
| --- | ---: | ---: |
| Tempo acumulado nas buscas de caminho do passo da simulação | 3,596 s | 3,033 s |
| Pico agregado dessas buscas | 86,9 ms | 81,3 ms |
| Tempo acumulado de movimento | 3,113 s | 2,766 s |
| Percentil 95 das atualizações | 61,2 ms | 58,8 ms |
| Maior atualização completa | 150,8 ms | 155,2 ms |
| Tempo total medido | 35,262 s | 34,317 s |

Os tempos representam uma execução por versão. A maior atualização geral não melhorou; outras fontes de picos permanecem. O checksum completo do benchmark continuou `e45047d1e763c09f5510d07095ea4107926c90d5f8fcc8f7318aab0015b2d84d`.

Validação: 46 testes passaram nas suítes `boat_crossings`, `boat_towing`, `boat_boarding`, `boat_trip_routine`, `boat_rider_motion` e `worker_state_export`. O novo teste mantém tarefa, destino e recusa de um passageiro cuja caminhada é mais rápida; as consultas à margem inacessível caem de 16 para zero. Esse teste falhou na versão anterior e passou após a alteração. Os casos existentes continuam verificando travessias úteis mesmo quando há uma conexão terrestre. Para repetir a medição, use o comando da rodada 1 com `SUBURBAN_BENCH_CITY_MINUTES=1200`.

## Rodada 7 — geometria reutilizada nas consultas a travessias abertas

A instrumentação do minuto 878 encontrou 44 buscas terrestres da avaliação de travessias coletivas, mas apenas 25 pares distintos de células. Essas buscas consumiram 53,9 ms naquela execução instrumentada; um mesmo par foi calculado quatro vezes. O mapa local introduzido na rodada 5 cobria apenas o recrutamento inicial, não pedidos posteriores de outros moradores a barcos que ainda embarcavam.

Agora as buscas terrestres desse módulo usam um cache privado por cidade, limitado a 256 rotas e descartado no minuto seguinte ou quando mudam terreno, estruturas, obstáculos, dimensões ou os objetos do mapa e da ocupação. Resultados sem caminho também podem ser reutilizados. Cada consumidor recebe listas e pontos próprios. Lotação, disponibilidade dos moradores e tarifas continuam sendo avaliadas por pedido; somente geometria é compartilhada. O cache fica em um `WeakMap` do módulo e não integra o grafo salvo.

Na seed 1794658272, arquipélago, 512 moradores, 128×128, em 1.200 minutos simulados sem LOD de fast-forward:

| Medida local | Antes | Depois |
| --- | ---: | ---: |
| Tempo acumulado nas buscas de caminho do passo da simulação | 2,924 s | 2,837 s |
| Pico agregado dessas buscas | 80,3 ms | 81,2 ms |
| Tempo acumulado de movimento | 2,764 s | 2,675 s |
| Pico de movimento | 46,0 ms | 54,8 ms |
| Percentil 95 das atualizações | 59,9 ms | 57,0 ms |
| Maior atualização completa | 156,4 ms | 148,8 ms |
| Tempo total medido | 34,179 s | 33,497 s |

São execuções individuais, sujeitas a variação. O ganho agregado foi pequeno; os picos de buscas e movimento não diminuíram nesta comparação. O checksum completo do benchmark permaneceu `e45047d1e763c09f5510d07095ea4107926c90d5f8fcc8f7318aab0015b2d84d`.

Validação: 48 testes passaram nas suítes `boat_crossings`, `boat_towing`, `boat_boarding`, `boat_trip_routine`, `boat_rider_motion` e `worker_state_export`. A regressão de consultas tardias caiu de 4.208 verificações de obstáculos para zero na segunda consulta equivalente; falhou na versão anterior e passou após a alteração. Os novos testes verificam cópias independentes, recusa por lotação mesmo com geometria em cache, remoção de obstáculos, alteração e restauração do terreno, invalidação de falhas e renovação no minuto seguinte. Para repetir a medição, use o comando da rodada 1 com `SUBURBAN_BENCH_CITY_MINUTES=1200`.

## Rodada 8 — bancos candidatos e classificação por demanda de serviço

A instrumentação separou a abertura de serviços da seleção de terrenos. A primeira consumia aproximadamente 35 ms no minuto 1572; as chamadas individuais de seleção de terrenos ficaram abaixo de 2 ms. A investigação das tentativas de crédito encontrou 838 reconstruções da lista de bancos em uma passagem no minuto 852 e 844 no minuto 1572. Cada reconstrução filtrava novamente o cadastro de empresas, mesmo sem possibilidade de criar bancos durante a abertura desses serviços.

Agora a passagem seleciona uma vez os prédios bancários, mantendo sua ordem. `available(candidates)` filtra essa lista novamente a cada empreendedor, e `lendForBusiness` continua verificando atendimento, autorização, caixa, risco e demais regras. Bancos inicialmente inativos permanecem entre os candidatos, permitindo considerar uma mudança de disponibilidade durante a passagem. A classificação da demanda como cadeia inicial também ocorre uma vez por tipo de serviço, pois tentativas de empréstimo recusadas não abrem empresas nem consomem depósitos minerais.

Na seed 1794658272, arquipélago, 512 moradores, 128×128, em 1.200 minutos simulados sem LOD de fast-forward:

| Medida local | Antes | Depois |
| --- | ---: | ---: |
| Pico de investimento em serviços essenciais, minuto 1572 | 33,9 ms | 30,0 ms |
| Pico de investimento em serviços iniciais, minuto 852 | 32,9 ms | 31,0 ms |
| Pico total de investimento empresarial | 95,8 ms | 93,7 ms |
| Percentil 95 das atualizações | 57,9 ms | 57,8 ms |
| Maior atualização completa | 150,9 ms | 150,0 ms |
| Tempo total medido | 34,166 s | 34,165 s |

O ganho da etapa foi pequeno e não houve melhoria do tempo total. As medições são execuções individuais. O checksum completo permaneceu `e45047d1e763c09f5510d07095ea4107926c90d5f8fcc8f7318aab0015b2d84d`.

Validação: 22 testes passaram nas suítes `service_investment_banks`, `business_heights` e `economic_reform`. As duas regressões cobrem serviços iniciais e já estabelecidos, mantêm a ordem dos bancos e verificam um banco ficando sem caixa e outro tornando-se ativo entre empreendedores. As leituras do cadastro de empresas caem de seis para uma nesse cenário; ambos os casos falharam na versão anterior e passaram após a alteração. A suíte adicional `sector_tax_lighting` teve três testes aprovados e uma falha preexistente: o teste de reposição de iluminação espera 12 unidades de combustível e recebe 48. Essa mesma falha foi reproduzida com os dois módulos anteriores à rodada. Para repetir a medição, use o comando da rodada 1 com `SUBURBAN_BENCH_CITY_MINUTES=1200`.

## Rodada 9 — obstáculos compactados na aproximação aos barcos

No minuto 1023, a instrumentação encontrou 78 decisões de tarefas, somando aproximadamente 94 ms. As decisões mais caras gastavam até 15 ms buscando caminhos. A decomposição apontou buscas terrestres de aproximação às embarcações, algumas próximas de 9 ms, além do cálculo da própria travessia. Essas aproximações ainda construíam coordenadas em texto e consultavam o conjunto de ocupação para cada vizinho explorado pelo A*.

Agora a primeira aproximação de uma cotação de terreno constrói uma grade `Uint8Array` a partir das células ocupadas. As aproximações seguintes reutilizam a grade durante a mesma revisão. A invalidação já existente considera minuto, dimensões, revisão do terreno, estruturas, obstáculos, quantidade de células ocupadas e substituição do mapa ou do conjunto. A grade segue a regra anterior dessas aproximações: bloqueia os edifícios registrados em `occupied`. O cache continua privado, fora dos saves, e as rotas e modos de transporte permanecem iguais.

Na seed 1794658272, arquipélago, 512 moradores, 128×128, em 1.200 minutos simulados sem LOD de fast-forward:

| Medida local | Antes | Depois |
| --- | ---: | ---: |
| Pico agregado de buscas, minuto 1023 | 79,5 ms | 63,7 ms |
| Pico de decisões de tarefas, minuto 1023 | 92,5 ms | 74,9 ms |
| Percentil 95 das atualizações | 57,6 ms | 57,0 ms |
| Maior atualização completa | 151,5 ms | 151,1 ms |
| Tempo total medido | 33,547 s | 33,728 s |

O pico específico diminuiu cerca de 20%; não houve ganho no tempo total nessa execução individual. O checksum completo permaneceu `e45047d1e763c09f5510d07095ea4107926c90d5f8fcc8f7318aab0015b2d84d`.

Validação: 49 testes passaram nas suítes `boat_towing`, `boat_crossings`, `boat_boarding`, `boat_trip_routine`, `boat_rider_motion` e `worker_state_export`. O novo teste reproduziu 97 consultas textuais de obstáculos na versão anterior; após a alteração passou com limite inferior a 16. Também substitui obstáculos mantendo a mesma quantidade de células, incrementa a revisão e confirma que o operador cercado perde a rota. Remover os obstáculos permite planejar novamente. Para repetir a medição, use o comando da rodada 1 com `SUBURBAN_BENCH_CITY_MINUTES=1200`.

## Rodada 10 — menos listas temporárias na atualização de relações

A decomposição do fechamento diário encontrou aproximadamente 36 ms no processamento social, dos quais 32 ms estavam na atualização das relações. Foram observadas 3.921 chamadas de atualização de contextos naquele fechamento. A implementação construía listas de rótulos e duas strings para comparar família, colegas de trabalho, residência compartilhada e vizinhança, mesmo quando esses contextos não mudavam. As atualizações bilaterais também construíam listas temporárias de pares para visitar os dois observadores.

Agora os contextos são comparados diretamente, preservando ordem e identidade do snapshot existente. Uma nova lista congelada é criada somente quando os rótulos mudam. A atualização bilateral visita primeiro o mesmo observador anterior e depois o outro, sem construir listas de pares. Decaimento de sentimentos, taxa individual de perdão, revisão, eventos e regras de parceria permanecem iguais.

Na seed 1794658272, arquipélago, 512 moradores, 128×128, em 1.200 minutos simulados sem LOD de fast-forward:

| Medida local | Antes | Depois |
| --- | ---: | ---: |
| Fechamento diário das relações | 28,1 ms | 25,6 ms |
| Preparação diária total, minuto 1440 | 87,9 ms | 82,1 ms |
| Percentil 95 das atualizações | 57,4 ms | 56,3 ms |
| Maior atualização completa | 146,4 ms | 146,8 ms |
| Tempo total medido | 33,236 s | 33,502 s |

O ganho real é pequeno e não houve melhoria do tempo total. A comparação final ocorreu sem testes concorrentes; o tempo interno do fechamento social foi medido por um wrapper temporário de `relationships.daily`. O checksum completo do benchmark permaneceu `e45047d1e763c09f5510d07095ea4107926c90d5f8fcc8f7318aab0015b2d84d`.

O benchmark isolado `node scripts/benchmark-relationship-contexts.mjs` executa 200.000 atualizações, alternando todos os contextos a cada 1.024 chamadas. Caiu de 104,5 ms para 38,4 ms, com as mesmas 195 substituições de snapshots e checksum `7d540d2f0585c38f74c423967cdc1b1888b3ae954492ebe7552060bb32278acd`. O argumento posicional opcional seleciona outra árvore de fontes para comparação. Esse resultado mede somente a operação de contexto, não a simulação inteira.

Validação: 18 testes distintos passaram nas suítes `relationship_contexts`, `initial_relationships` e `society`, incluindo uma cidade simulada durante 15 dias com famílias, contratos e conservação monetária. Os casos novos cobrem todas as 16 combinações de contextos, ordem dos rótulos, snapshots congelados, retenção de identidade sem mudança, exclusão de vizinhança dentro do mesmo prédio e decaimento assimétrico conforme a taxa de perdão de cada observador. Para repetir a medição geral, use o comando da rodada 1 com `SUBURBAN_BENCH_CITY_MINUTES=1200`.

## Rodada 11 — amostragem única das margens em travessias sem reboque

A investigação da busca de banheiros no minuto 964 encontrou um morador com dez tentativas de rota, somando aproximadamente 57 ms. Durante a decomposição das buscas daquele minuto, uma travessia sem reboque consultou `walkable` 7.270 vezes para apenas 2.043 células distintas. A amostragem de passagem livre introduzida na rodada 3 era usada somente quando havia bicicleta rebocando o casco.

Agora travessias sem reboque também reutilizam a passagem livre de cada célula durante a busca síncrona. Para esses barcos, a amostragem aloca apenas um byte de status por célula; a matriz de alturas continua exclusiva do reboque. A amostragem é descartada ao terminar a busca. Movimento, obstáculos editados posteriormente, saves, ordem de exploração e custos das rotas continuam seguindo as regras anteriores.

Na seed 1794658272, arquipélago, 512 moradores, 128×128, em 1.200 minutos simulados sem LOD de fast-forward:

| Medida local | Antes | Depois |
| --- | ---: | ---: |
| Pico agregado de buscas de caminho | 61,1 ms | 56,8 ms |
| Pico de busca de banheiro, minuto 964 | 54,6 ms | 58,8 ms |
| Pico de movimento | 51,7 ms | 49,8 ms |
| Percentil 95 das atualizações | 55,9 ms | 55,6 ms |
| Maior atualização completa | 160,1 ms | 150,9 ms |
| Tempo total medido | 33,391 s | 32,830 s |

As medições são execuções individuais e incluem variação. O pico específico de banheiros não diminuiu e permanece como alvo de investigação. A alteração reduz verificações repetidas nas travessias encontradas durante essa análise; não resolve todas as fontes daquele pico. O checksum completo permaneceu `e45047d1e763c09f5510d07095ea4107926c90d5f8fcc8f7318aab0015b2d84d`.

Validação: 50 testes passaram nas suítes `boat_towing`, `boat_crossings`, `boat_boarding`, `boat_trip_routine`, `boat_rider_motion` e `worker_state_export`. A nova regressão sem bicicleta reproduziu 635 consultas de passagem livre em 209 células na versão anterior. Após a alteração, passou com limite de uma consulta por célula, mais quatro verificações externas à busca da travessia. Os testes de reboque, obstáculos novos, embarque, movimento físico e exportação de estado continuaram passando. Para repetir a medição, use o comando da rodada 1 com `SUBURBAN_BENCH_CITY_MINUTES=1200`.

## Rodada 12 — obstáculos compactados nas pernas terrestres das travessias coletivas

A decomposição das dez buscas do morador 390 no minuto 964 mostrou que quase todo o tempo estava dentro de `findBoatPath`, nas buscas terrestres usadas para avaliar travessias coletivas. Cinco destinos consumiam de 7 a 14 ms cada; a avaliação de pontes e o caminho terrestre principal eram pequenos naquele caso. As buscas de aproximação e de saída desse módulo ainda consultavam `occupied` por coordenadas em texto, apesar de já compartilharem resultados de rotas.

Agora a revisão de geometria do módulo também mantém uma grade compacta dos mesmos obstáculos ocupados. As buscas A* de caminhada usam essa grade, preservando custos, ordem de exploração e critérios de acesso. A grade segue a invalidação já existente por minuto, dimensões, revisões e substituição do mapa ou conjunto de ocupação. Ela não adiciona árvores ou bancos de praça às regras anteriores dessas pernas terrestres e não integra os saves.

Na seed 1794658272, arquipélago, 512 moradores, 128×128, em 1.200 minutos simulados sem LOD de fast-forward:

| Medida local | Antes | Depois |
| --- | ---: | ---: |
| Pico de busca de banheiros | 60,6 ms | 26,2 ms |
| Pico de movimento, minuto 1093 | 50,3 ms | 14,2 ms |
| Pico agregado de buscas de caminho | 60,0 ms | 56,6 ms |
| Percentil 95 das atualizações | 55,4 ms | 52,8 ms |
| Maior atualização completa | 160,3 ms | 136,5 ms |
| Tempo total medido | 32,252 s | 31,803 s |

O pico de banheiros passou do minuto 964 para o minuto 1023. O ganho de movimento também aparece porque o recrutamento inicial usa essas mesmas buscas. As medições são execuções individuais e não provam eliminação de todos os picos. O checksum completo do benchmark permaneceu `e45047d1e763c09f5510d07095ea4107926c90d5f8fcc8f7318aab0015b2d84d`.

Validação: 50 testes passaram nas suítes `boat_crossings`, `boat_towing`, `boat_boarding`, `boat_trip_routine`, `boat_rider_motion` e `worker_state_export`. A primeira consulta de travessia do teste fazia 4.208 verificações textuais de obstáculos na versão anterior; agora passa com limite de três verificações de destino. A segunda consulta equivalente continua sem refazer buscas. As regressões de recrutamento e recusa antecipada foram adaptadas para observar verificações de destino, pois a consulta textual de vizinhos deixou de existir. O teste de invalidação agora também troca obstáculos mantendo sua quantidade, além de verificar mudanças de terreno, falhas, lotação e renovação no minuto seguinte. Os 15 testes de travessias foram repetidos após esse reforço e passaram. Para repetir a medição, use o comando da rodada 1 com `SUBURBAN_BENCH_CITY_MINUTES=1200`.

## Rodada 13 — reutilização de opiniões nos grupos eleitorais

A revisão de popularidade recalculava afinidade ideológica e memória política para cada grupo eleitoral de cada candidato. Os grupos se sobrepõem: um eleitor pode participar de trabalhadores, baixa renda, ambientalistas e outros grupos simultaneamente. Agora cada par candidato/observador calcula seu apoio uma vez por revisão. A composição dos grupos também é calculada uma vez, preservando a ordem original das somas. Nenhum resultado é reutilizado entre revisões.

Um teste controlado com três candidatos e oito grupos reduziu as consultas de distância ideológica de 48 para nove, mantendo os valores exatos de popularidade e apoio segmentado. O teste também verifica atualização forçada após mudança de moradia e novas memórias. Na cidade da seed 1794658272, no minuto 542, 40 revisões isoladas após cinco aquecimentos reduziram a mediana de 7,04 para 4,75 ms e o percentil 95 de 11,09 para 6,59 ms.

No benchmark completo de 1.200 minutos, arquipélago, 512 moradores, 128×128, sem LOD de fast-forward:

| Medida local | Antes | Depois |
| --- | ---: | ---: |
| Pico político horário, minuto 542 | 53,0 ms | 55,0 ms |
| Tempo político acumulado | 332,7 ms | 322,3 ms |
| Percentil 95 das atualizações | 56,5 ms | 55,0 ms |
| Maior atualização completa | 142,2 ms | 150,7 ms |
| Tempo total medido | 32,809 s | 32,813 s |

A melhoria isolada não reduziu o pico político nem o tempo total nesta execução. Há outros custos nessa revisão horária; as medições individuais também variam. O checksum do benchmark permaneceu `e45047d1e763c09f5510d07095ea4107926c90d5f8fcc8f7318aab0015b2d84d`.

Validação: 31 testes passaram nas suítes `political_standing_refresh`, `city_government_performance`, `government_response`, `political_production_reform`, `party_reputation_migration`, `party_spectrum` e `party_network`. Cinco testes de `political_production_reform` falharam também na cópia anterior: financiamento coletivo de empresa, contrato com desvio, quatro ciclos eleitorais, microempresa de empregado e renderização dos painéis (`ui.selectControl`). A regressão nova foi repetida e passou. Para repetir o benchmark completo, use o comando da rodada 1 com `SUBURBAN_BENCH_CITY_MINUTES=1200`.

## Rodada 14 — consultas bancárias sem cópias da lista de empresas

O pico de investimento do minuto 1572 realizou 4.278 tentativas de crédito, todas recusadas: 1.536 pela preservação de caixa para a primeira loja de alimentos e 2.742 pelo limite de caixa ou risco do crédito comum. A decomposição também registrou 1.537 chamadas de `available`. Essas consultas acessavam repetidamente `economy.businesses`, cujo getter filtra e aloca a lista completa de empresas privadas antes da busca por bancos ou lojas de alimentos.

Agora `available` filtra diretamente os prédios atuais. `canServe` já verifica tipo bancário, atividade, destruição, caixa e atendimento. A consulta da primeira loja de alimentos também percorre os prédios diretamente, mantendo as verificações de tipo, atividade e destruição. Cada tentativa continua lendo o estado atual; não há cache de elegibilidade, saldos ou concessões de crédito.

Na seed 1794658272, arquipélago, 512 moradores, 128×128, em 1.200 minutos sem LOD de fast-forward:

| Medida local | Antes | Depois |
| --- | ---: | ---: |
| Pico de investimento empresarial, minuto 1572 | 116,6 ms | 87,1 ms |
| Investimento empresarial acumulado | 351,3 ms | 321,7 ms |
| Pico de seleção de terrenos e fundadores | 31,5 ms | 24,9 ms |
| Pico de investimento em serviços essenciais | 33,4 ms | 27,4 ms |
| Percentil 95 das atualizações | 51,7 ms | 52,6 ms |
| Maior atualização completa | 146,8 ms | 138,7 ms |
| Tempo total medido | 31,756 s | 31,541 s |

O pico de investimento caiu cerca de 25%; o percentil 95 global não melhorou nesta execução. São medições individuais, sujeitas a variação. O checksum do benchmark permaneceu `e45047d1e763c09f5510d07095ea4107926c90d5f8fcc8f7318aab0015b2d84d`.

Validação: 24 testes passaram nas suítes `bank_business_queries`, `service_investment_banks` e `economic_reform`. Cinco novas regressões verificam ordem e elegibilidade dos bancos, mudanças de caixa e atividade, bancos privados e municipais, seleção explícita de candidatos e reserva alimentar com loja ausente, inativa, destruída ou ativa. Elas também verificam empréstimo, recusa, saldos e transferências. Na versão anterior, as cinco preservaram essas expectativas funcionais e falharam apenas no contador de materializações da lista completa; depois, o contador ficou em zero. Para repetir o benchmark, use o comando da rodada 1 com `SUBURBAN_BENCH_CITY_MINUTES=1200`.

## Rodada 15 — menos alocações ao somar preferências alimentares

A investigação da virada diária separou relações sociais, economia e contratação. Dentro da revisão de demanda, a agregação de estoques e preferências apresentou custo elevado. O trecho de preferências usava `Object.entries` para cada morador: na cidade de 512 pessoas, eram 53.760 pares temporários por revisão, antes mesmo de descartar preferências negativas ou neutras.

Agora esse trecho percorre `Object.keys` e lê cada valor diretamente. Mantém a ordem das propriedades próprias enumeráveis, a ordem dos moradores, o descarte de valores não positivos e a soma original. Continua lendo preferências atuais a cada revisão, sem cache ou mudança nos saves. A alteração elimina os pares temporários desse trecho; ainda existe uma lista de chaves por morador.

Em uma medição isolada de demanda com essa cidade, cinco aquecimentos e 40 amostras reduziram a mediana de 8,22 para 6,83 ms e o percentil 95 de 9,50 para 9,13 ms. Os hashes de demandas, plano produtivo, insumos dos prédios e relatório de óleo coincidiram em três situações: preferências normais, registros ausentes/mistos com propriedades herdadas e alteração posterior de preferências mutáveis.

No benchmark completo da seed 1794658272, arquipélago, 512 moradores, 128×128, em 1.200 minutos sem LOD de fast-forward:

| Medida local | Antes | Depois |
| --- | ---: | ---: |
| Pico de demanda na atualização econômica horária | 19,7 ms | 16,4 ms |
| Pico de demanda na busca de investimento | 16,7 ms | 14,3 ms |
| Percentil 95 das atualizações | 57,0 ms | 55,8 ms |
| Preparação da virada diária, minuto 1440 | 98,0 ms | 110,6 ms |
| Maior atualização completa | 157,1 ms | 173,5 ms |
| Tempo total medido | 33,810 s | 33,163 s |

O pico horário de demanda passou do minuto 551 para o minuto 1211; o pico durante investimento passou do minuto 1332 para o minuto 1092. A revisão isolada melhorou cerca de 17%, mas a virada diária e o maior pico global não melhoraram nesta execução. As medidas completas são execuções individuais e variam. O checksum permaneceu `e45047d1e763c09f5510d07095ea4107926c90d5f8fcc8f7318aab0015b2d84d`.

Validação: 31 testes passaram nas suítes `production_flow`, `economic_reform` e `economy_daily_listings`. O teste de descoberta de vagas em fazendas remotas falhou também na cópia anterior, com a mesma ausência da candidatura esperada. Não foram adicionados testes que apenas reproduzissem a nova forma de iteração. Para repetir o benchmark completo, use o comando da rodada 1 com `SUBURBAN_BENCH_CITY_MINUTES=1200`.

## Rodada 16 — reutilização de travessias entre limites de tempo diferentes

A decomposição do minuto 1023 mostrou buscas de travessia de aproximadamente 4 a 8 ms dentro da escolha de tarefas. O cache de geometria incluía o orçamento de tempo na chave: consultar o mesmo casco, origem e destino com outro limite podia refazer toda a busca, mesmo após encontrar a rota mínima.

Agora o cache mantém a rota mínima encontrada e testa seu custo contra cada novo limite. Uma busca recusada com limite finito só é reutilizada para limites menores ou iguais; um limite maior ainda dispara nova busca. Os critérios de casco, bicicleta, origem, destino, relocação, minuto e revisão de obstáculos permanecem. Disponibilidade, capacidade, acesso e escolha da embarcação continuam sendo avaliados fora desse cache.

A nova regressão fazia 4.170 leituras de terreno na versão anterior ao relaxar o orçamento de uma travessia já conhecida. Agora exige menos de 100 leituras e preserva exatamente a rota. Também verifica recusa com orçamento menor, reutilização de uma falha para orçamento ainda menor e recuperação com orçamento maior após uma falha limitada.

Em um cenário controlado de 32×24, após uma cotação inicial, 40 consultas com limites diferentes reduziram a mediana de 0,355 para 0,032 ms e o percentil 95 de 2,687 para 0,126 ms. As leituras de terreno caíram de 166.800 para 640. O hash das 40 rotas completas permaneceu idêntico. Esse cenário mede especificamente a reutilização entre orçamentos, não o custo total da cidade.

No benchmark completo da seed 1794658272, arquipélago, 512 moradores, 128×128, em 1.200 minutos sem LOD de fast-forward:

| Medida local | Antes | Depois |
| --- | ---: | ---: |
| Pico de escolha de tarefas, minuto 1023 | 66,8 ms | 69,8 ms |
| Pico agregado de buscas de caminho, minuto 1023 | 55,2 ms | 58,2 ms |
| Pico de busca de banheiros | 28,0 ms | 26,6 ms |
| Pico de veículos, minuto 947 | 40,8 ms | 38,0 ms |
| Percentil 95 das atualizações | 55,8 ms | 57,6 ms |
| Maior atualização completa | 155,4 ms | 161,0 ms |
| Tempo total medido | 33,616 s | 34,317 s |

O pico de banheiros passou do minuto 907 para o minuto 1023. A execução completa não demonstrou ganho global: os picos gerais e o tempo total ficaram maiores. As medidas individuais variam; a melhoria comprovada nesta rodada é a eliminação da busca repetida entre orçamentos no cenário controlado. O checksum completo permaneceu `e45047d1e763c09f5510d07095ea4107926c90d5f8fcc8f7318aab0015b2d84d`.

Validação: 51 testes passaram nas suítes `boat_towing`, `boat_crossings`, `boat_boarding`, `boat_trip_routine`, `boat_rider_motion` e `worker_state_export`. A regressão foi repetida após acrescentar a verificação de reutilização de falhas limitadas e passou. Para repetir o benchmark completo, use o comando da rodada 1 com `SUBURBAN_BENCH_CITY_MINUTES=1200`.
