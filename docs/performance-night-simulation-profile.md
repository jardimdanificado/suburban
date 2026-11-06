# Perfil da simulação noturna — 6 de novembro de 2026

O benchmark agora aceita aquecimento antes da região medida e perfil detalhado por fase. Isso permite medir a noite sem incluir o custo da manhã na média:

```sh
SUBURBAN_BENCH_POPULATION=1024 SUBURBAN_BENCH_SPEED=1 SUBURBAN_BENCH_CITY_MINUTES=120 SUBURBAN_BENCH_WARMUP_MINUTES=660 SUBURBAN_BENCH_PROFILE=1 node scripts/benchmark-fast-simulation.mjs
```

Mapa 256, semente 1337, estado transferido pela mesma classe de grafo do worker. O aquecimento avança 660 minutos com passos de um minuto da cidade; a região medida usa os passos de 1x entre 19h e 21h. Isso conserva o estado construído, mas não equivale à trajetória de uma cidade jogada desde a manhã inteiramente em 1x. Não há renderização, transporte de snapshots nem cidade antiga carregada de save neste ensaio.

O perfil inicial registrou 10,75 s para os 120 minutos da cidade, pico de 162 ms por atualização. Deslocamentos somaram 4,06 s (38%); os passos de minuto somaram 6,13 s (57%). Entre os componentes dos passos, cidadãos consumiram 3,76 s, sociedade 1,09 s e interiores 0,43 s. Escolha de atividades consumiu 1,28 s e busca de higiene 0,47 s. As medidas se sobrepõem hierarquicamente: não se somam totais com seus componentes.

Os maiores picos por componente incluíram recrutamento (81 ms), busca de caminhos (81 ms no minuto) e dispersão de aglomerações (75 ms). Não foi reproduzida uma pausa de um segundo neste estado inicial. Isso não exclui o problema relatado numa cidade mais desenvolvida nem os custos gráficos e de sincronização.

Essa execução tinha `profileDiagnostics` e o perfilador V8 ligados; seus tempos incluem instrumentação. O perfilador V8 inclui também inicialização e aquecimento, enquanto os totais por fase do JSON se restringem à noite. Comparações de desempenho devem rodar sem instrumentação nas duas versões. [Dados do perfil](performance-night-simulation-profile.json).

A captura evita contar novamente `lastStepProfile` em cada atualização de movimento: esse registro só é acumulado quando o minuto muda. O modo padrão do benchmark conserva o cenário anterior, sem aquecimento nem perfil detalhado.

## Experimento retirado

Foi testado reaproveitar a leitura do destino em `canStep`, usada tanto para acesso como para altitude. Uma comparação exaustiva de 589.824 combinações de terrenos, pontes, alturas e limites manteve o resultado anterior; os 14 testes de terreno e rotas passaram. Entretanto, a comparação noturna sem instrumentação em ordem controle/experimento/experimento/controle registrou CPU média da thread de 6879.6 ms no controle contra 8204.0 ms no experimento (piora de 19.3%). Todas as quatro execuções preservaram o hash `6e646c169d7dd1052890df7d7fbe17fa4ca9bce01b0932198189eabacfe2ff3f`.

A mudança em `canStep` foi retirada. Menos chamadas ao mapa não se traduziram em menor custo neste caminho do JavaScript. Mantêm-se somente os recursos de medição e o registro dos resultados desta etapa. [Dados das quatro execuções](performance-night-terrain-experiment.json).
