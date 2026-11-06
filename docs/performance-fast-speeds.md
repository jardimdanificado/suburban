# Otimização da simulação em 16x e 32x

Comparação de 6 de novembro de 2026 com a versão anterior `49c7428`.

## Trabalho removido

- Buscas repetidas pelos mesmos cômodos lotados durante um minuto. O resultado é invalidado quando uma reserva muda, inclusive por cancelamento de atendimento.
- Filtragem repetida dos espaços de espera para cada pessoa na fila.
- Validação completa de destinos internos que já estavam atribuídos e continuavam válidos.
- Recálculo da geometria de interação com móveis e recriação do estado de uso quando a pessoa continua na mesma posição.
- Consultas repetidas à Secretaria do Trabalho para cada candidatura dentro da mesma rodada.

O relógio passa a acompanhar o pacote compacto de movimento, emitido a cada 100 ms, em vez de aguardar a sincronização completa da cidade. O passo de simulação original de cada velocidade foi preservado.

## Medições finais

Duas execuções por versão e cenário, após as rodadas exploratórias. A tabela usa a mediana do tempo de CPU da thread que executa a simulação. Isso reduz o efeito da concorrência de outros aplicativos; o tempo total e a CPU de todas as threads também estão nos dados brutos.

| Pessoas | Velocidade | Antes | Depois | Redução |
|---:|---:|---:|---:|---:|
| 512 | 16x | 4.334 s | 4.124 s | 4.8% |
| 512 | 32x | 4.583 s | 3.683 s | 19.6% |
| 1024 | 16x | 9.602 s | 8.470 s | 11.8% |
| 1024 | 32x | 9.238 s | 8.367 s | 9.4% |

Todos os hashes coincidiram entre as versões, nas duas velocidades e populações. [Dados brutos](performance-fast-speeds-results.json). Os ganhos da simulação são modestos em alguns cenários; estes números não significam que uma cidade com 1.024 pessoas já sustente 32x em tempo real.

Além do processamento da simulação, foi removido o bloqueio de renderização de 40 ms em 16x/32x. Com `requestAnimationFrame` a 60 Hz, esse bloqueio só permitia desenhar aproximadamente um quadro em cada três, impondo um teto próximo de 20 FPS. A renderização agora pode usar cada quadro disponível. Isso remove o teto, sem garantir 60 FPS quando CPU ou GPU estiverem ocupadas. A sessão gráfica de validação ficou limitada em segundo plano e apresentou travamentos do WebGL, portanto não há comparação confiável de FPS real nesta rodada.

## Reprodução

```sh
SUBURBAN_BENCH_POPULATION=512 SUBURBAN_BENCH_SPEED=16 node scripts/benchmark-fast-simulation.mjs
SUBURBAN_BENCH_POPULATION=1024 SUBURBAN_BENCH_SPEED=32 node scripts/benchmark-fast-simulation.mjs
```

O primeiro argumento opcional aponta para outro checkout. O script usa o mesmo cenário nas duas versões: semente 1337, mapa 256×256, quatro horas da cidade e estado inicial transferido pelo `CityStateGraph`, como no worker. A inicialização fica fora da medição. O cenário não inclui renderização WebGL e não mede FPS. As obras iniciais automáticas ficam desativadas para isolar a simulação.

São registrados tempo total, tempo de CPU do processo e da thread atual (Node compatível), percentis por atualização e um hash das necessidades, atividades, posições, reservas, finanças, eventos, relações e estado profissional. Os hashes precisam coincidir entre as versões em cada combinação de população e velocidade.

## Verificações funcionais

As verificações incluem capacidade e ordem das filas, liberação de vaga no mesmo minuto, circulação interna, móveis, refeições, emprego, sincronização de estado e atualização do relógio pelo pacote compacto.

Cinco falhas anteriores foram reproduzidas no checkout de comparação: quatro em `presential_employment_meals.test.mjs` e uma no catálogo que cobra perfis para `street-market-shopping` e `street-market-food`. Elas não foram alteradas nesta rodada.
