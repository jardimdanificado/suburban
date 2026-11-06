# Geometria das venezianas — 6 de novembro de 2026

As venezianas continham uma cópia invertida de todos os vértices e triângulos para suportar instâncias espelhadas. Materiais de duas faces substituem essa duplicação. As normais de fachada continuam fixas nos dois lados, preservando a iluminação corrigida anteriormente. O vidro usa uma única passagem transparente, conservando o número de chamadas de desenho.

## Verificação visual

O teste `tests/shutter_geometry_benchmark.html?buildings=24` compara a geometria anterior reconstruída com a nova, mantendo os mesmos objetos e materiais para conservar a ordenação. Foram 64 combinações de janelas abertas/fechadas, dia/noite, quatro fachadas e câmeras perspectiva/ortográfica com os planos de corte reais do jogo. Nenhum canal diferiu em mais de 1/255; diferença máxima de 1/255. Uma câmera dentro do painel também produziu pixels idênticos. Nenhum erro de shader.

O ensaio inicial com plano próximo artificialmente pequeno apresentou diferenças de profundidade; as comparações finais acima usam as câmeras reais. Os tempos do teste isolado foram afetados pelo navegador em segundo plano e não sustentam uma conclusão sobre velocidade.

## Cidade completa à noite

`tests/night_city_benchmark.html?population=1024&geometry=shutters`, semente 1337, mapa 256, 20h, 64 postes distribuídos, limite de 32 fontes selecionadas. Simulação pausada para comparação exata; modelos e roupas carregados. Resolução escolhida mantida em 0,5 (buffer 480×320). Todos os 1024 corpos presentes. Pixels idênticos, sem erros de shader.

| Geometria | Triângulos | Chamadas |
|---|---:|---:|
| Anterior | 1.563.200 | 923 |
| Nova | 1.455.776 | 923 |

Redução de 107.424 triângulos (6,9%) na cena completa. As venezianas passam de 144 para 72 triângulos por instância, incluindo madeira e vidro.

Medições com conclusão do trabalho da GPU, 12 amostras por execução, ordem controle/nova/nova/controle:

| Execução | Mediana | p95 |
|---|---:|---:|
| Controle | 27,0 ms | 30,6 ms |
| Nova | 24,1 ms | 30,3 ms |
| Nova | 23,9 ms | 25,8 ms |
| Controle | 23,1 ms | 25,1 ms |

Há variação por aquecimento/concorrência; a média das duas medianas mudou de 25,05 para 24,0 ms (4,2%), mas o último controle foi mais rápido que as duas execuções novas. O resultado seguro é a redução de geometria com imagem preservada. Este teste estático não comprova que os engasgos da simulação noturna foram eliminados.

Os 35 testes direcionados de modelos, lotes estáticos, iluminação, grade de luzes e transporte de mudanças de campos passaram. O objetivo geral de fluidez com 1024+ habitantes permanece aberto.
