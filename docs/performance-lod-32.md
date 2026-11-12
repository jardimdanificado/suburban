# Otimização: LOD de simulação em 32×, caches do hot loop e memoização do deslocamento

## Diagnóstico (por que a simulação estava "muito lenta")

Não havia um erro: era aritmética. Um passo integral de cidade (512 moradores)
custava **p50 ≈ 25 ms por minuto simulado** (p95 90 ms; picos de 220–360 ms nas
viradas de hora). O worker roda com cadência de 16 ms e prazo de 14 ms, então a
32× (1 passo = 1 minuto) o orçamento era ~8 ms. Resultado: o modo 32× rodava na
prática a ~7,5× (medido: "velocidade efetiva 7,46") e o deferral de fast-forward
(`city.fastForward`) só ligava a partir de 64× (`FF_SPEED`).

O custo não regrediu: nos últimos commits (`4315147..HEAD`) a p50 subiu só
23,1 → 25,3 ms (benchmarks comparáveis sem o medidor de fases).

Comandos de referência:

```sh
SUBURBAN_BENCH_POPULATION=512 SUBURBAN_BENCH_SPEED=32 node scripts/benchmark-fast-simulation.mjs
SUBURBAN_MULTI_DURATION_MS=8000 SUBURBAN_MULTI_MAP_SIZE=128 \
SUBURBAN_MULTI_POPULATION=512 SUBURBAN_MULTI_SPEED=32 \
SUBURBAN_MULTI_BACKGROUND=1 node scripts/benchmark-multicity.mjs 2
```

## Mudanças

1. **LOD em 32×** (`js/simulation_time.js`): novo `FF_LOD_SPEED = 32`; worker
   (`city_sim_worker.js`) e fallback local (`app.js`) ligam `city.fastForward`
   a partir daí. Rótulos de velocidade, `SPEED_TIERS`, passo do worker
   (0,25 s) e `FF_SPEED`/`FF2_SPEED` permanecem iguais; em 32× a interface
   continua mostrando "32×", só o detalhe interno passa a usar o deferral
   testado do fast-forward (`deferFastForwardCitizen`, janelas de 4 min,
   necessidades integradas no despertar). O benchmark espelhou o worker
   (`scripts/benchmark-fast-simulation.mjs`) e aceita `SUBURBAN_BENCH_FF`.
2. **`routineRevision` sem recalcular a string por cidadão por minuto**
   (`js/city_fast_forward.js`): cache em `WeakMap` fora do grafo, sobre jobId,
   home, identidade+comprimento de `businessIds` (remoções retribuem o vetor,
   então identidade já detecta), revisões e hora.
3. **Deferral sem alocar a assinatura** (`deferFastForwardCitizen`): os tokens
   de assinatura ficam no campo da própria entrada da fila e são comparados um
   a um; nada de vetor temporário por cidadão por minuto.
4. **Memoização de `c.action` no loop de deslocamento**
   (`city_simulation.js` `update()`): a string de status ("Indo: …") era
   recomposta em cada waypoint de cada quadro; agora só quando os campos que
   a determinam mudam (tarefa, entrega, barco, passarela, silvicultura, visita)
   ou se outro sistema reescreveu `c.action`.

## Medição (janela de 240 minutos após aquecimento, Node v24)

| Métrica | Antes | Depois |
|---|---:|---:|
| p50 por passo (32×) | 25,3 ms | **12,2 ms** |
| p95 | 90,4 ms | **39,2 ms** |
| peak | 219,6 ms | **141,6 ms** |
| Velocidade efetiva em 32× | 7,5× | **15,2×** |

Cenário de navegador (duas cidades, 512, uma observada, 8 s):

| Métrica | Antes | Depois |
|---|---:|---:|
| CPU do processo | 374,9% | **324,8%** |
| Update médio do worker | 82,4 ms | **20,4 ms** |
| Aplicação total na thread principal (10 s) | 1090 ms | **543 ms** |
| Minutos da cidade observada na janela | 660 | **972** |

## Fidelidade

- `node scripts/needs_audit.mjs 256 5 128 991 highlands` (detalhe integral,
  valida os caches sem LOD): aprovado, zero mortes, fome ≤ 2% pontual.
- `SUBURBAN_AUDIT_FF=1 node scripts/needs_audit.mjs 256 10 128 991 highlands`
  (mesma auditoria com o deferral ativo em todo o passado; o script aceita o
  override): aprovado, distribuição de tarefas viva (trabalho, saúde,
  refeições, justiça).
- Resultados divergem do modo sem LOD a partir de 32×, como já ocorre em ff.

## O que ficou para a próxima rodada

- Fase 4 (cidade de fundo): o worker agora liga `fastForward` também para a
  cidade não observada em qualquer velocidade (`city_sim_worker.js`), o
  deferral testado do fast-forward cobre os passes dos moradores. Medido em
  8× o ganho é pequeno (~1% de CPU) porque o coordenador do relógio mantém a
  cidade de fundo majoritariamente parada a 480 min atrás da observada; a
  32×+ o ganho da LOD já cobre ambas as cidades. Trajetórias divergem como já
  ocorre em ff.
- Fase 3 do plano (`docs/plano-otimizacao-multicidades.md`): slim de snapshot
  (histórico/memória social em cadência própria; posições fora do pacote de
  grafo) — medido em `docs/performance-snapshot-journal-cadence.md`.
- Espalhar a virada de horas (`nextRoutineReview`, checagens de minuto%60) por
  `c.id%8` + cache de prefeitura (`townhall()`): p50/p95 iguais num A/B de 3
  execuções e o pico máximo caiu de ~167 ms para ~85-123 ms (o pico estourava
  o prazo de 14 ms do worker em cada virada de hora; os picos restantes são
  das fases políticas/econômicas horárias).
- `deferFastForwardCitizen`: estados especiais frequentes checados por leitura
  direta antes da lista rara (26 → 18 chaves em `some()`).
- Boot (fase 6 parcial): `wordMatch`/`partyNameAgenda`
  (`js/city_party_names.js`) compilava ~336 RegExp no primeiro passe de nomes
  (189 ms de tempo próprio no perfil); reescrito com `indexOf` + checagem de
  fronteira por caractere, provado equivalente (1,017 milhão de pares
  texto×palavra testados, 0 divergências, incluindo corpus adversário com
  hífens, prefixos colados e separadores múltiplos). Medido em `initialize`
  642 → ~554 ms de A/B; lote de 12 nomes com agenda fresca 142 → 13 ms. O
  `catalogoSet` (93 ms one-time por sessão) e o parse do `vocabulario.js` de
  8,5 MB (~200 ms de avaliação) continuam para o redesign da fase 6
  (worker/import dinâmico).
- Boot (fase 6 — opção "adiar" do plano): `ensureMinimumWorldCities` funda
  inline só a primeira cidade que falta; a(s) de fundo vivem em
  `requestIdleCallback` (fallback `setTimeout`), com epoch guard que cancela
  pendências quando o mundo é substituído (`restoreWorldRecord`,
  `startNewCity`). Sem mudança no fundado, apenas em quando: a fundação de
  uma cidade de fundo custa um `CitySimulation.initialize` completo
  (~554-640 ms em 512 hab/128 + geração do mundo) que saía do bloco anterior
  ao primeiro quadro. Coordenador/comércio/migrações já toleram 1 cidade
  (dirigidos por eventos por dia).
- Pico de `economy.hourly` fase 12 (`invest()`): o perfil de subárvore mostrou
  a composição do pico de ~175-191 ms — `bank.lendForBusiness` (57 ms no
  probe, dos quais ~25 ms só re-varrendo `economy.businesses`: o getter
  refiltra todos os prédios a cada acesso e `available().includes(bank)`
  chamava-o por tentativa de empréstimo). `city_bank.js` ganhou o predicado
  `canServe(bank)` — a mesma conjunção de `available()` — usado nos testes de
  adesão de `deposit`, `lend`, `lendHome` e `lendForBusiness`; `available()`
  mantém a mesma forma para quem quer a lista. Medido (A/B 3 execuções com
  profiler): pico `businessInvestment` 175-191 → 154 ms; pico do passo
  190-207 → 168-173 ms; agregado p50/p95 inalterado e hash de estado idêntico
  ao HEAD (`4de2bb74…`) na janela de 720 min.
- Medido e retirado: cache por rodada de `inspectBuildingSite` (`lots()` do
  investimento em serviços; provado equivalente com 7.070 pares) — inspeções
  custavam só ~2 ms do pico, o ganho não apareceu; revertido. Sobras do pico
  de ~154 ms: `updateDemand` (29 ms por chamada, chamada duas vezes por
  rodada) e os próprios empréstimos — alterar cadência mexe em regra.
- Custo contínuo por minuto (rodada 6, `js/city_furniture.js`):
  `furniture.syncCitizen` (~750 ms self) e `storeAtHome` (~405 ms) validados
  por perfil. Cortes sem mudança de regra: `storeAtHome` trocou
  `rooms.filter(...).flatMap(...)` (duas alocações por cidadão em casa por
  minuto) por uma busca única da unidade (`find`) alimentando o cache de
  móveis por unidade, e o teste de peça usada virou comparações diretas
  (sem alocar array de 5 por peça); `syncCitizen` trocar `['sit',...].includes`
  e `['beach_chair','beach_ground'].includes` por conjuntos no módulo e
  `seatId.split(':').map(Number)` por `seatIdParts` (indexOf+slice, sem
  alocar array de strings). Profiler: `storeAtHome` 405 → 271 ms (−33%),
  `syncCitizen` 752 → 686 ms; A/B limpo (3 exec, 1440 min) p50 −0,4 ms,
  pico máximo −60 a −75 ms (313/270/304 → 252/240/234) e eff +0,2; hash
  de estado idêntico ao HEAD na janela de 720 min.
- `clothingMood` (rodada 7, `js/city_clothing.js`): ~800 ms totais de
  `appearance`/`clothingOdor` no perfil — a felicidade física chama
  `clothingMood(c)` por cidadão em cada minuto que ele não dorme/idle, mas a
  peça só muda no `updateClothes` diário. `clothingMood` agora guarda o
  humor derivado por peça (fonte: identidade da peça, `dirt` e todos os
  campos de `garmentScore` — `piece`/`style`/`color`/`quality`/`condition`/
  `brandId` — mais `colorPreferences` congelado, preferência de marca e a
  entrada partidária `partyOwnerId`/`c.political.partyId`); qualquer mudança
  invalida e recalcula pela forma original. Medido: A/B 3 exec (1440 min)
  p50 13,2/13,2/13,1 → 13,2/13,3/12,9 (−0..−0,2 ms) e pico máximo
  185/179/179 → 196/178/242 (jitter de fase horária, sem melhora consistente
  no pico); hash de estado idêntico ao HEAD (`4de2bb74...`) na janela de
  720 min; testes 6/6 + 33/33 e `needs_audit` 5 dias exit 0. Nota: o mobiliário
  (`reservedSeatSlot`) nesta rodada ficou como micro-corte de código (~2 ms
  no profiler) — sem efeito mensurável, mantido por ser corte idêntico.
- `interiorRoute`/`nearest` (rodada 8, `js/city_interior_layout.js`): o
  `nearest` do roteamento interno varria todos os nós dedicando uma
  chave string+`keyAt` e distance squared por nó, e o fallback de
  todos os andares aplanava `walkNodes.values()`. A versão atual mantém a
  mesma função `keyAt`, a mesma elegibilidade de piso (`floor==null` ou
  `node.floor===floor`) e a mesma seleção de primeiro mínimo estrito; o
  fallback todos-os-andares agora usa `walkNodesByFloor.flat()`. A
  equivalência foi provada em 19.200 comparações do `nearest` HEAD-vs-novo
  (direto e por piso) sobre a cidade simulada sem nenhuma divergência.
  Medido: A/B intercalado 3 exec (1440 min) p50 13,7/13,7/13,3 →
  13,9/13,5/13,3 ms (wash, −0,2..+0,2), p95 wash, velocidade efetiva
  14,10/14,04/14,29 → 14,07/14,20/14,44, pico máximo 207/182/174 →
  200/187/179 (jitter). Hash idêntico ao HEAD (`4de2bb74...`) na janela
  720 min; testes relevantes 20/20 + 19/19 e `needs_audit` 5 dias exit 0
  (zero mortes). A tranche de `updateDemand`/`goodsStock` não foi aplicada
  nesta rodada: só leitura/profil — sem corte equivalente encontrado nesta
  passada, por isso não entrou no diff nem neste registro como ganho.
- Ganho contínuo no avanço (rodada 9, `js/city_fast_forward.js` +
  `js/city_society.js`): dois cortes por cidadão por minuto.
  `city_society.citizen()` (~500 chamadas no código, várias em caminhos
  por minuto) fazia `accounts.get(\`citizen:\${id}\`)` — concatenação de
  string por chamada — quando errava o `citizensById`; agora memoiza o
  registro resolvido (ids únicos e monotônicos; o guard de `destroyed`
  mantém o resultado). `deferFastForwardCitizen` avaliava
  `city.society.age()` antes da porta de atividade (a maioria dos
  residentes em fast-forward falha lá) e alocava uma closure por
  candidato no `SPECIAL.some(key=>c[key])`; agora a porta
  `traveling||idle` vem primeiro e o scan de missões raras é
  desenrolado em leituras diretas — todos os termos são leituras
  puras (age() só refresca caches derivados determinísticos), então a
  reordenação mantém o resultado idêntico. Medido: hash idêntico ao
  HEAD (`4de2bb74...`) em 720 min; A/B 3 exec (1440 min) p50
  13,7/13,2/13,5 → 13,0/13,3/12,7 ms, p95 41,8/39,8/39,3 →
  38,7/39,3/38,8, eff 14,12/14,55/14,25 → 14,69/14,45/14,95;
  profiler: `deferFastForwardCitizen` 996 → 856 ms self, `age`/`isAdult`
  saíram do top-50 (119+94 ms no HEAD), `citizen` 187 → 165 ms.
  Testes 20/20 + 19/19 e `needs_audit` 5 dias exit 0 (256/256 vivos).
- Degradar com a escala: reprodução e índice de casos (rodada 10,
  `js/city_justice.js`). A queixa (ff4 → 3-4× efetivos após dias 4-5) foi
  reproduzida em benchmark: com o ff ligado desde o minuto 0 (script
  `bench-ff-warmup`, warmup antes só no modo clássico esconde parte do
  efeito), p50 sobe 17,5 → 26,0 ms até o dia 3 e segue 29,0 → 31,0 nos
  dias 5-7 (eff 11,4 → 6,9×; no navegador, com render e segunda cidade,
  isso vira os 3-4× observados). Fases por dia (PROFILE=1, ms/min
  simulado, dia 3 → dia 7): `taskChoice` 3,8 → 5,2, `pathSearch` 2,0 →
  2,8, `taskExecution` 1,5 → 2,3, `justice.reports` 1,0 → 1,5.
  Sonda de acumulação: `justice.cases` 61 → 257 em 8 dias (nunca é
  removido), `unreported` 30 → 110, `reporting` 88 → 146, com até 49
  cidadãos simultâneos em `justice-report`. O corte aplicado (sem
  mudança de regra): `caseRecord(id)` — mapa preguiçoso id→caso
  (validado por tamanho; `cases` só recebe push, ids monotônicos e
  nunca reutilizados) substituindo 42 varreduras lineares
  `this.cases.find(r=>r.id===...)` (os 5 predicados compostos ficaram),
  e o loop de `unreported` em `dispatchReports` trocou
  `witnesses.map(...).find(available)` (alocação por caso por minuto)
  por um `for` com o mesmo primeiro- disponível. Perfil da janela
  tardia (dia 6): subárvore `dispatchReports` 9,9 s (3,7% do run),
  `arriveToReport` 501 ms, `updateInvestigations` 632 ms,
  `updateCourtCases` 560 ms — todos com componente O(casos) agora O(1).
  Medido: hash idêntico nas duas janelas (720 min `4de2bb74...` e
  7 dias ff `cfe44785...`); A/B intercalado 2 exec (warmup 5760 + 1440
  min ff, dia 6) p50 38,9/39,3 → 38,5/38,8 ms, eff 4,96/4,92 →
  4,97/4,94 (com instrumentação diária; ganho pequeno no dia 6, mas
  cresce com o backlog, que é ilimitado). Testes 20/20 + 19/19 e
  `needs_audit` 5 dias exit 0 (zero mortes).
- Restante mapeado da degradação (sem corte equivalente ainda):
  `report()` paga um `findPath` completo por repórter designado e o
  ciclo `reporting → unreported → novo repórter` re-paga o caminho a
  cada interrupção (~6 s do perfil tardio) — mudar cadência/retenção
  é regra; `sanitation.routeChoices` 8,0 s (busca de banheiro com
  findPath por candidato), `supplies.route`/`routeToMeal` ~3 s
  (varreduras de refeições O(prédios)) e `findSharedTerrainPath`/campos
  compartilhados ~7,3 s — todos crescem com prédios/instalações, que
  saturam; casos abertos não saturam.
- `chooseTask` (561 ms/10 s em LOD) e sociedade/interiores: exigem mudanças de
  regras com auditoria dedicada.
- Cortes puros em escolha de banheiro e refeição (rodada 11,
  `js/city_sanitation.js` + `js/city_work_meals.js`; tranche não commitada
  contra HEAD `6abbe35`, junto com a rodada 10). Perfil fresco da janela
  tardia (dia 6): `sanitation.choose` 16,0 s (6% do run) com
  `routeChoices` 4,9 s (findPath real, irredutível sem regra),
  `visitorAccess` 3,1 s, `facilityChoiceIndex` 1,1 s (rebuild por
  minuto) e `score` 0,8 s. Cortes aplicados (sem mudança de regra):
  (1) `score()` trocou o `.filter(...).length` por um `for` de contagem
  — zero alocação por candidato por escolha; (2) `routeToMeal` tinha um
  O(prédios²): o filtro de cada site avalia
  `.some(shop => mealScore(c, shop) < …)` varrendo todos os prédios, e
  `mealScore` é independente do site — agora memoiza um score por shop
  por chamada (pureza verificada: `preparedOffer`, `mealContribution`,
  `mealAssistanceEligible`, `providerPenalty`, `businessPenalty` só
  leem; mesma ordem de chamadas e mesmo short-circuit por site, cache
  reutilizado entre sites); (3) `reconcile()` invalida explicitamente o
  índice de escolha ao escrever `access`/`price` direto no townhall
  (cinto e suspensório — todas as outras mutações já passam pela API).
  Tentativa revertida: remover `city.minute` da assinatura de
  `facilityChoiceIndex` (1,1 s) — a compra de moradia
  (`city_simulation.js:797`) muta `unit.ownerId` sem invalidar, e o
  índice agrupa por `ownerId`; sem o minuto, o índice ficaria MAIS
  fresco que o original dentro do mesmo minuto → diferença semântica
  real, tratada como mudança de regra (menu abaixo). Medido: hash
  worktree = HEAD nas três janelas — 720 min (W0 C720) `f9ecbfdb...`,
  dia 6 (W5760 C1440 ff) `f5e93c63...` 2×, e 7 dias ff (W4320 C5760)
  `cfe44785aee4375f`, igual ao literal de referência (nota: o literal
  `4de2bb74...` citado nas rodadas 6-10 vinha de um comando ad-hoc não
  reproduzido; nesta rodada a validação passou a ser igualdade
  worktree×HEAD no mesmo comando). A/B intercalado 2 exec (dia 6):
  p50 30,9/24,5 → 24,7/24,9 ms, eff 6,03/7,77 → 7,68/7,74 (janela
  curta é ruidosa na máquina); janela longa 7 dias ff — onde a
  degradação de escala mora: p50 30,5 → 26,8 ms, eff 6,33 → 7,25×.
  Testes: sanitation_flow 8/8, sanitation_visitor_search 2/2,
  housing_life_sanitation 14/14, justice_reporting 5/5,
  justice_facilities 2/2; presential_employment_meals 4/7 e
  services_meals 13/14 com falhas pré-existentes idênticas no HEAD
  (não relacionadas). `needs_audit` 5 dias (pop 256, seed 991,
  highlands) exit 0 — 256/256 vivos, zero mortes.
