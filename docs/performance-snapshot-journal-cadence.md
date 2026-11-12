# Fase 3 parcial: cadência do diário nos snapshots periódicos

Referência do plano: `docs/plano-otimizacao-multicidades.md` (fase 3). Medição
com duas cidades, 512 moradores, 128×128, 32×, cidade de fundo silenciada,
janela de 90 s (≈29 snapshots da cidade observada):

```sh
SUBURBAN_MULTI_DURATION_MS=90000 SUBURBAN_MULTI_MAP_SIZE=128 \
SUBURBAN_MULTI_POPULATION=512 SUBURBAN_MULTI_SPEED=32 \
SUBURBAN_MULTI_BACKGROUND=1 node scripts/benchmark-multicity.mjs 2
```

## Medidas antes/depois (A/B): cidade observada

| Métrica | Antes | Depois |
|---|---:|---:|
| Snapshot médio | 4,74 MB | 4,70 MB |
| Encode médio no worker | 199,9 ms | 199,3 ms |
| Apply médio na thread principal | 105,5 ms | **92,2 ms** |
| Apply total na janela | 3059 ms | **2674 ms (−12%)** |
| CPU do processo | 277,1% | **267,5%** |

## O que mudou

- `CityStateGraph.encode` ganhou `historyEvery` (`js/city_state.js`): quando
  maior que 1, o payload do diário (`CityHistory.snapshotSince`) só é enviado
  a cada Nª codificação — o cursor fica no último envio, e o próximo pacote
  de envio carrega a janela acumulada de uma vez. Grafo novo (baseline,
  `export-state`) e snapshots de sync (checkpoint, troca de cidade, passo em
  pausa) ignoram a cadência e enviam o diário inteiro.
- `city_sim_worker.js` usa `historyEvery: sync?1:4` nos snapshots periódicos
  e monta a lista de transferência só com os buffers presentes.

## O que se tentou e se reverteu

- **Necessidades fora do snapshot (`packNeeds:false`)**: piora. O formato
  compacto (`packedNeeds`, 10 campos + humor/felicidade em um `Float64Array`)
  venceu as mudanças por nó do grafo: ~8% mais bytes (5,11 MB vs 4,74 MB) e
  ~10% mais encode (221 ms vs 200 ms). Revertido para `packNeeds:true`.

## Por que o resto da fase 3 ficou em aberto

O volume recorrente dos snapshots da cidade observada não está no diário nem
nas necessidades: é o mesmo grafo re-difundido a cada ~2,5 s. Cortar isso
significaria suprimir nós por revisão (histórico de memórias sociais, estoques
de prédio, agenda política) — exige redesenho do encoder por tipo de nó, com
hash de estado por legado envolvido. As tambores medidos não justificavam o
risco nesta rodada.
