# Busca de banheiros e higiene — 6 de novembro de 2026

Cada busca percorria os imóveis candidatos e consultava relações entre seus moradores e o visitante, inclusive para pares que nunca se conheceram. A busca agora percorre uma vez os contatos existentes do visitante e reúne os moradores cuja opinião permite uma visita. As instalações continuam passando pelas mesmas regras de acesso, pontuação, desempate e tentativa de rota.

O teste usa a opinião do anfitrião sobre o visitante: afeto ≥65, confiança ≥50 e ressentimento <30. A lista existe somente durante a chamada síncrona de busca. Ela não é mantida por minuto nem transportada ao worker. Uma nova busca observa alterações nas relações e na moradia. O índice de moradores usado continua sendo o próprio índice de habitação, incluindo suas regras de invalidação. As consultas isoladas a `allowed` conservam o caminho anterior.

## Reprodução

Cidade real, 1024 habitantes, mapa 256, semente 1337, aquecimento até 19h e passos de 1x até aproximadamente 21h:

```sh
SUBURBAN_BENCH_POPULATION=1024 SUBURBAN_BENCH_SPEED=1 SUBURBAN_BENCH_CITY_MINUTES=120 SUBURBAN_BENCH_WARMUP_MINUTES=660 node scripts/benchmark-fast-simulation.mjs
```

Ensaio sintético de buscas com 1024 pessoas, 256 instalações residenciais, contatos direcionais e várias escolhas sucessivas:

```sh
node scripts/benchmark-sanitation-search.mjs
```

O argumento opcional seleciona um checkout de controle. O ensaio sintético registra consultas individuais às relações, tempos e hash das escolhas; não substitui o benchmark da cidade nem mede FPS. Os tempos de CPU da thread excluem o aquecimento. A cidade não inclui renderização nem serialização periódica neste ensaio.

## Verificação funcional

Os testes novos cobrem a direção da amizade, os limites de acesso, alteração de ressentimento e remoção de relação no mesmo minuto, mudança de moradia e propriedade de banheiro vazio. O conjunto direcionado existente cobre acesso público/pago/funcionários/residentes/amigos, uso físico, limpeza, rotas internas, troca de prestador e restauração de contratos.

A execução ampla dos dois arquivos de saneamento/moradia foi interrompida porque o arquivo de moradia não concluiu após mais de dois minutos. O conjunto com filtros diretamente ligados a saneamento concluiu: 17 aprovações. Os dois novos testes de permissões também passaram em execução separada. Não se declara a suíte integral aprovada.

## Resultados

Quatro execuções por cenário, em ordem controle/nova/nova/controle:

| Cenário | CPU média da thread antes | Depois | Redução |
|---|---:|---:|---:|
| Cidade noturna completa | 6650.0 ms | 6477.3 ms | 2.6% |
| Busca sintética isolada | 1263.4 ms | 294.6 ms | 76.7% |

O caso isolado evitou 13.218.368 consultas individuais via `relationships.view` em oito rodadas; as opiniões continuam sendo lidas diretamente nos registros dos contatos. As quatro execuções produziram as mesmas escolhas: hash `36708ccdaf52032c1e3826521028a01162d18b290277525aaf788e95645a4562`.

As quatro cidades completas também terminaram com o mesmo hash de necessidades, tarefas, posições, reservas, contas, eventos e relações: `6e646c169d7dd1052890df7d7fbe17fa4ca9bce01b0932198189eabacfe2ff3f`. O p95 dos passos noturnos variou de 24,7–25,1 ms no controle para 24,4–24,5 ms na versão nova. Os picos foram menores nas duas execuções novas, mas essa amostragem não sustenta promessa de eliminar pausas. [Dados brutos](performance-sanitation-search-results.json).

A melhora na rotina é expressiva; na cidade inteira, ela é modesta. A imagem não é alterada por esta mudança, e a fluidez geral de 1024+ habitantes ainda não foi comprovada.
