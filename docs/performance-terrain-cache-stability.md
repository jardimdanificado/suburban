# Estabilidade do cache do terreno — 6 de novembro de 2026

O renderizador ajustava `terrainDetailTier` a cada 120 quadros, usando a média do tempo de renderização da cena inteira. O nível entrava na assinatura de todos os blocos do terreno. Um quadro caro de personagens, iluminação ou outra rotina podia, portanto, disparar o descarte e a reconstrução de todo o terreno visível. A reconstrução acrescentava seu próprio custo aos quadros seguintes.

Foi retirado esse gatilho baseado no tempo dos quadros. O terreno conserva o nível padrão 2, o mais detalhado, e suas regras existentes de distância e zoom. Continuam válidas as invalidações por mudanças reais do mapa, câmera, modo de visão, grade e outras propriedades do terreno. Não há redução da resolução nem dos modelos, roupas, altura ou peso dos habitantes.

## Reprodução controlada

`tests/terrain_scene_stability.html` usa o renderizador real, a cidade com semente 1337 e mapa 256, 16 habitantes e câmera pausada. Após preparar os caches, simula oito verificações no limite de um histórico de quadros lentos: média de 40 ms e contador em 119 antes de cada quadro. É uma entrada sintética para reproduzir o gatilho; não é uma medição de FPS nem de oito quadros típicos de jogo.

O teste não desenha na GPU. Ele observa as assinaturas e identidades dos grupos dos blocos, isolando o custo de reconstrução na CPU.

| Medida | Controle | Correção |
|---|---:|---:|
| Blocos antes/depois | 36 / 36 | 36 / 36 |
| Blocos substituídos | 36 | 0 |
| Nível de detalhe inicial/final | 2 / 0 | 2 / 2 |
| Tempo do segmento de oito verificações | 2.040,7 ms | 14,2 ms |

O controle substituiu todos os blocos e baixou o detalhe. A correção manteve os mesmos blocos e o detalhe mais alto. Esse resultado comprova a remoção de um caminho de engasgo, sem demonstrar que todas as pausas noturnas foram eliminadas. [Controle](performance-terrain-cache-before.json), [correção](performance-terrain-cache-after.json).

Para reproduzir o controle, disponibilize temporariamente o renderizador anterior no mesmo diretório, preservando seus imports relativos:

```sh
git show 3659638:js/renderer_3d.js > js/renderer_3d_terrain_reference.js
```

Abra `/tests/terrain_scene_stability.html?reference=1` para o controle e `/tests/terrain_scene_stability.html` para a versão corrente. Remova o arquivo temporário ao terminar. A cópia usada nesta rodada foi removida do worktree; não faz parte da alteração entregue.

## Verificações

Os nove testes direcionados de lotes de postes, geometria estática, grade de luzes e preservação de shaders passaram. O ensaio completo de 1024 habitantes foi ampliado para registrar o nível de terreno e estatísticas por fase, incluindo a espera por conclusão da GPU. A contagem de terreno deve permanecer estável em comparações com a mesma câmera e o mesmo estado.

## Cena completa com 1024 habitantes

Após a correção, o ensaio de postes atravessou mais de 120 quadros com o terreno no nível 2 em todas as passagens. Foram 24 quadros de aquecimento por estratégia e quatro passagens de 24 amostras. Os 1024 corpos 3D permaneceram nos lotes ativos, o framebuffer continuou em 480×320 (escala escolhida 0,5), os pixels coincidiram e não houve erro de shader.

| Estratégia dos postes | Mediana | p95 | Máximo | Chamadas | Triângulos | Terreno |
|---|---:|---:|---:|---:|---:|---:|
| Originais | 27.3 ms | 37.0 ms | 40.7 ms | 923 | 1455776 | 2 |
| Instâncias | 23.7 ms | 26.5 ms | 26.7 ms | 740 | 1455776 | 2 |
| Instâncias | 23.6 ms | 27.5 ms | 27.6 ms | 740 | 1455776 | 2 |
| Originais | 24.7 ms | 26.7 ms | 26.7 ms | 923 | 1455776 | 2 |

Nenhuma das 96 amostras temporizadas ultrapassou 40,7 ms nessa rodada. Com os postes agrupados, o máximo foi de 27,6 ms. As medianas das fases de terreno ficaram em 0,3–0,4 ms; preparação das entidades e envio à WebGL continuam predominantes. A média das duas medianas do quadro mudou de 26,0 para 23,65 ms ao agrupar os postes, cerca de 9%, com a mesma geometria de terreno.

Esse é um cenário gráfico pausado com câmera fixa, incluindo todos os modelos e as luzes selecionadas. Não demonstra ainda fluidez da simulação em movimento, 16x/32x nem em celulares antigos. As medições anteriores com mudanças de detalhe não são agregadas a esta rodada. [Dados por fase](performance-lamp-city-stable-terrain-results.json).

Uma repetição do teste corrigido manteve os mesmos 36 blocos e o nível 2 novamente; o segmento medido levou 25,8 ms. Essa variação de tempo não altera o resultado de identidade do cache. [Repetição](performance-terrain-cache-after-repeat.json).
