# Postes compartilhados — 6 de novembro de 2026

O inventário da cena noturna registrou 923 chamadas de desenho com 1024 habitantes. Os 64 postes distribuídos pelo ensaio usavam três malhas cada: base/braço, estrutura da lanterna e vidro. Isso somava 192 chamadas para os postes.

As malhas agora compartilham instâncias por modelo e componente. Lanternas acesas e apagadas ficam em grupos separados para preservar o material emissivo. Os três visuais, geometrias, cores e materiais são conservados. As fontes de luz continuam sendo selecionadas pelo código anterior, usando os mesmos grupos de postes e posições. Só as malhas de origem ficam ocultas; o grupo usado para calcular visibilidade e luz permanece com seu estado original.

As matrizes são atualizadas somente quando postes, posições, visibilidade ou iluminação mudam. Crescimento substitui o InstancedMesh e descarta seu buffer específico, preservando geometria/material compartilhados. Os lotes ficam vazios quando os postes são removidos. Geometrias e materiais dos lotes são cópias próprias; demolir um poste não descarta os recursos dos outros.

## Comparação gráfica isolada

`tests/lamp_batch_benchmark.html` prepara os modelos reais pelo renderizador da cidade, isola os postes e usa as mesmas luzes e o mesmo framebuffer escolhido de 480×320 (escala 0,5). Foram 12 casos: lanternas acesas, apagadas e mistas, vistas de quatro direções. Nenhum canal diferiu em mais de 1/255; diferença máxima de 1/255. Nenhum erro de shader.

Tempos com conclusão do trabalho da GPU, 12 amostras por execução, após aquecer as variantes:

| Execução | Mediana | p95 | Chamadas | Triângulos |
|---|---:|---:|---:|---:|
| Controle | 1,9 ms | 2,7 ms | 192 | 17.672 |
| Instâncias | 0,9 ms | 1,2 ms | 12 | 17.672 |
| Instâncias | 0,6 ms | 1,0 ms | 12 | 17.672 |
| Controle | 1,9 ms | 2,9 ms | 192 | 17.672 |

Aproximadamente 60% menos tempo nesse ensaio isolado; 180 chamadas a menos no caso misto. Os três modelos totalmente acesos usam nove lotes (verificado pelo teste de agrupamento), e o caso misto pode usar doze. [Dados brutos](performance-lamp-batches-results.json).

## Limites e verificação

A primeira coleta da cena completa com 1024 habitantes terminou. Recarregamentos e o novo ensaio completo deixaram abas sem resposta às observações do navegador; houve nova tentativa com 64 habitantes e recuperação por uma página de inventário que prepara a cena sem desenho na GPU. O ensaio isolado dos postes terminou normalmente. Não se declara melhora medida de FPS da cidade inteira nem eliminação dos engasgos noturnos.

O inventário sem GPU em `tests/night_city_benchmark.html` é uma estimativa baseada em malhas visíveis e frustum, não substitui as estatísticas da renderização efetiva. A opção `?geometry=lamps&population=1024` compara os caminhos na cidade inteira quando a sessão gráfica estiver respondendo.

Os testes de lotes cobrem emissividade, visibilidade, deslocamento, ausência de uploads em quadros estáticos, expansão sem `instanceMatrix.dispose`, remoção e recriação. Os testes de geometria estática e iluminação são executados junto deles. O objetivo geral de 1024+ habitantes continua sem comprovação de conclusão.

A comparação completa foi reavaliada na mesma aba, que chegou a carregar os 1024 modelos e iniciou o teste, mas voltou a deixar de responder durante o desenho. A aba foi mantida para a próxima continuação, sem considerar o trabalho concluído por timeout. O benchmark de sincronização de 500 prédios/50 mil cômodos também executou após corrigir a detecção da assinatura do seu fixture: o código passou a reconhecer o nome do layout dentro de uma expressão condicional, sem exigir um dois-pontos imediatamente após o nome. Essa correção é do benchmark, não do jogo.

## Validação posterior da cena completa

A aba preservada concluiu a comparação com os 1024 modelos carregados e renderizados: 923 → 740 chamadas, 1.455.776 triângulos nas duas versões e pixels idênticos. A primeira rodada teve um pico de 1,86 s no controle; uma rodada com mais aquecimento também conservou a contagem de corpos e os pixels. Na repetição seguinte, outros objetos da cena mudaram de contagem durante as medições e ambos os caminhos apresentaram picos acima de um segundo. Esses tempos não são tratados como comprovação de fluidez geral.

A investigação identificou um ajuste do detalhe do terreno por tempo de quadro, que invalidava todas as suas assinaturas. Sua correção e teste controlado estão em [estabilidade do cache](performance-terrain-cache-stability.md). Os resultados originais das comparações foram conservados, sem remover os picos: [primeira rodada](performance-lamp-city-results.json), [mais aquecimento](performance-lamp-city-warm-results.json), [repetição](performance-lamp-city-repeat-results.json).
