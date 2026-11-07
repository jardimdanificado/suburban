# Reaproveitamento de listas — experimento retirado

Foi testado reaproveitar a representação serializada de arrays de mesmo tamanho, copiando-a apenas ao encontrar uma referência diferente. Todos os filhos continuavam sendo visitados para descobrir suas mutações e evitar remover objetos alcançáveis.

O comparador `scripts/benchmark-state-encode.mjs` restaura duas cidades a partir do mesmo pacote, usa as classes de cada checkout, avança as simulações independentemente e alterna a ordem das medições por rodada. O cenário tem 1024 habitantes, mapa 256, semente 1337, aquecimento de 660 minutos e 30 pacotes noturnos com necessidades/posições/caminhos compactos e mudanças de estrutura habilitadas.

| Medida | Controle | Experimento |
|---|---:|---:|
| CPU média por encode | 228,8 ms | 246,8 ms |
| Tempo médio | 229,1 ms | 250,0 ms |
| p95 | 271,0 ms | 396,8 ms |
| Máximo | 303,2 ms | 416,9 ms |

Piora de 7,9% na CPU média. A alteração foi retirada. Os nós emitidos por rodada coincidiram e os estados finais também: hash `5941fb26abb0604317b8088d1de139efabb5e405c02543aad02967f0fc78a881`, incluindo posições, necessidades, tarefas, contas, relações, altura, peso, roupas e estado visual.

Dois testes adicionais verificaram filhos alterados em listas de referências estáveis, ciclos, coleta de objetos substituídos, reordenação, mudanças de tamanho, NaN, zero com sinal e strings iniciadas por `@`. Esses testes permanecem úteis ao contrato do protocolo e também passam com a implementação anterior.

Esse comparador inclui simulações restauradas como no worker, diferentemente do benchmark da ponte que avança a cidade original. Os dois cenários não devem ser comparados numericamente entre si. A manutenção das duas cidades no mesmo processo também amplia o uso de memória; o ensaio mede o encoder, não FPS nem a eliminação dos engasgos. [Dados brutos](performance-array-encode-experiment.json).

```sh
SUBURBAN_BENCH_POPULATION=1024 SUBURBAN_BENCH_WARMUP_MINUTES=660 SUBURBAN_BENCH_ROUNDS=30 node scripts/benchmark-state-encode.mjs /caminho/do/controle
```
