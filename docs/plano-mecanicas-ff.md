# Rotinas, logística, interiores e ff

Implementação de 7 de novembro de 2026.

## Planejamento e comportamento entregue

1. **Rotinas persistentes.** Serviços conhecidos são reutilizados por até seis horas, com revisões distribuídas por cidadão. Indisponibilidade, fechamento, falta de alimento ou de rota permitem procurar outra opção. Pessoas sem atividade revisam sua rotina em intervalos maiores; mudanças de emprego, moradia, mapa e estrutura, necessidades urgentes e a virada da hora invalidam a espera.
2. **Logística agrupada.** Pedidos comerciais pequenos podem aguardar até dez minutos da cidade para formar um lote de oito unidades. Falta de estoque no destino dispensa essa espera. Uma transportadora reúne até oito pedidos da mesma origem, para o mesmo destino ou destinos a até oito células de distância Manhattan do primeiro, respeitando a capacidade total. Cada pedido mantém mercadoria, procedência, conta de reserva e pagamento individual. O entregador segue para o próximo destino próximo após concluir a entrega. Interrupções deixam todas as cargas na posição física do entregador. Serviços especiais conservam sua logística própria.
3. **Interiores por tempo de acesso.** Atividades comuns validam uma rota real, reservam o cômodo e usam a extensão do percurso como duração. O atendimento só começa depois de chegar. Filas, vagas, mobiliário e andares continuam individuais. A posição simplificada permanece no início do percurso até a chegada. Ao observar o interior, o percurso detalhado é reconstruído com o progresso já realizado. Missões especiais e saídas mantêm o caminho detalhado.
4. **ff após 32x.** Disponível na barra, nas opções e no atalho de aumento de velocidade. Meta de 64x; a barra mostra a velocidade efetivamente alcançada. Pausa e passo individual continuam disponíveis.

## Detalhe do ff

Uma fila determinística agenda revisões de viagens pessoais e sono previsíveis, em janelas de até quatro minutos da cidade. A chegada, alteração de itinerário, mudança de mapa, condição física insegura, virada da hora ou retorno ao modo comum encerram o adiamento. Revisões de rotina sem urgência ficam mais espaçadas em ff, sem atravessar a próxima hora; novas urgências invalidam a espera. O sono acumula os minutos transcorridos e agenda o fim exato das oito horas. Necessidades passivas são integradas pelo tempo transcorrido na próxima revisão. Crianças, idosos a partir de 85 anos, responsáveis por dependentes, pessoas feridas, sob efeitos de substâncias e missões especiais não usam esse adiamento.

A descoberta de novos encontros sociais passa de cinco para quinze minutos, mantendo o orçamento de contatos de cada rodada; encontros incidentais novos ficam menos frequentes. Conversas já iniciadas continuam terminando no minuto previsto. A dispersão de aglomerações acontece a cada quatro minutos. Estes são compromissos explícitos de detalhe: encontros, decisões pessoais e posições internas podem divergir da trajetória em 32x. Os habitantes não são substituídos por médias populacionais.

Produção, pagamentos, estoques, justiça, votação, reservas e limites de atendimento continuam sendo processados a cada minuto. O worker nunca avança vários minutos de produção de uma vez. Esta versão agenda revisões pessoais; não é um simulador integral de eventos discretos para todos os sistemas da cidade.

## Verificação

Os testes específicos cobrem ordem da fila, interrupções, capacidade de carga somada, destinos sucessivos, liquidação individual, conservação de estoque e dinheiro, duração de acesso a cômodos e retorno ao detalhe. Um teste com o worker real verifica entrada em ff, avanço, pausa e saída para o passo detalhado.

Reprodução do benchmark, com a inicialização fora do intervalo medido:

```sh
SUBURBAN_BENCH_POPULATION=512 SUBURBAN_BENCH_SPEED=32 node scripts/benchmark-fast-simulation.mjs
SUBURBAN_BENCH_POPULATION=512 SUBURBAN_BENCH_SPEED=64 node scripts/benchmark-fast-simulation.mjs
```

O ganho deve ser medido para a mesma população e período. O benchmark mede a simulação, sem renderização ou envio periódico de snapshots. A meta nominal não garante 64x reais. Os hashes de 32x e ff podem divergir porque o nível de detalhe e os encontros mudam.

## Resultados locais do ff

512 habitantes, semente 1337, mapa 256×256, duas execuções por modo e cenário, em ordem 32x / ff / ff / 32x. A tabela usa a média da CPU da thread da simulação:

| Cenário | 32x | ff | Redução de CPU |
|---|---:|---:|---:|
| 08h–12h | 5.930 s | 4.012 s | 32.4% |
| 19h–21h | 2.312 s | 1.909 s | 17.4% |

O cenário diurno avança quatro horas; o noturno mede duas horas após 660 minutos de aquecimento comum. O aquecimento usa passos de um minuto e fica fora da medição. Os hashes repetiram dentro de cada modo/cenário; diferem entre 32x e ff conforme esperado para regras com detalhe diferente.

A variação é relevante: no dia, o controle consumiu de 5,036 a 6,825 s de CPU, enquanto ff consumiu de 3,912 a 4,111 s. Outras verificações longas estavam ativas durante parte da rodada. São resultados preliminares de dois pares, sem medição de FPS, GPU, sincronização periódica ou garantia de 64x efetivos. O avanço efetivo em ff ficou perto de 14,5–15,5x neste benchmark. [Dados das oito execuções](performance-ff-results.json).

## Resultado da validação

61 verificações direcionadas passaram, somando controles, worker real, sincronização, circulação observada, filas, sono, entregas e os cenários longos. Incluem a simulação de vinte dias com 128 habitantes e o abastecimento autônomo de um poste numa cidade gerada. Dinheiro e materiais fecharam nesses cenários.

A execução ampla inicial encontrou falhas; 34 delas foram reproduzidas em um snapshot limpo do HEAD anterior. Os casos novos foram investigados e revalidados: testes de movimento detalhado agora habilitam observação; o cenário de emissão mantém a cota fixa para isolar decisões políticas; iluminação verifica tanto o primeiro abastecimento como o começo da produção local dentro do prazo. A simulação longa revelou ainda estoques pessoais/domésticos que desapareciam ao remover um cidadão; agora entram na herança, no arquivo municipal ou em perdas explícitas, com procedência preservada. A suíte integral não é declarada aprovada.
