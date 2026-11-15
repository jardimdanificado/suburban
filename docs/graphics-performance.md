# Otimização gráfica de 15/11/2026

Esta rodada preserva geometria, resolução, distância de desenho, sombras, densidade de vegetação e efeitos configurados. As mudanças reduzem trabalho repetido:

- A máscara de vegetação dos canteiros permanece em cache até mudar a área ocupada. Edições nos próprios objetos, conclusão e cancelamento de obras invalidam o cache.
- O escalonador calcula a prioridade e a distância de cada chunk uma vez por passagem, preservando a preferência pelo terreno visível.
- Materiais temporários de transição retornam a um pool com limite de 128 materiais ociosos. Cada transição mantém seus próprios uniforms. A limpeza do terreno libera o pool.
- Árvores enviam matrizes e crescimento à GPU somente quando os valores mudam, com intervalos de atualização limitados às instâncias alteradas.
- A câmera 3P reaproveita a colisão somente quando posição, órbita, cidade e terreno permanecem iguais. A varredura original continua em movimento.
- As câmeras reaproveitam os limites do terreno quando suas matrizes, projeção, alcance de neblina e dimensões do mapa permanecem iguais.
- Fazendas compartilham os mesmos atlas botânicos, liberados após o último material consumidor.
- O pós-processamento evita amostras de aberração cromática quando o deslocamento é zero e amostras de bokeh quando sua contribuição é zero.

## Medição reproduzível

Execute `node scripts/benchmark-graphics.mjs`. Um argumento opcional seleciona outro checkout para comparação: `node scripts/benchmark-graphics.mjs /caminho/do/checkout`.

Uma execução local, comparando com uma cópia do workspace anterior à rodada, produziu:

| Trabalho isolado | Antes | Depois |
| --- | ---: | ---: |
| Máscara de 200 obras de 100 células, 200 frames | 1.405 ms | 11 ms |
| Escalonador com 144 jobs, 1.000 passagens | 541 ms | 196 ms |
| Clones de materiais em 1.000 transições sequenciais | 2.000 | 2 |
| Uploads de matrizes/crescimento em 300 atualizações de 1.000 árvores estáticas | 300 / 300 | 0 / 0 |
| Leituras de superfície em 10.000 consultas idênticas da câmera 3P | 240.000 | 24 |
| Raios em 10.000 consultas idênticas do viewport em perspectiva | 40.000 | 4 |

Os checksums de cobertura, fila, matrizes, colisão e viewport permaneceram iguais. Esses números medem caminhos isolados; não representam o ganho percentual de FPS do jogo inteiro.

## Verificação visual e limites

Sirva o projeto com `python scripts/serve.py`. Abra `tests/graphics_optimization_preview.html?mode=iso`, `?mode=third` e `?mode=free`. O fixture percorre uma cena determinística, verifica compilação de shaders e testa o ciclo de vida dos atlas compartilhados. `&grass` acrescenta grama; `&cpu` desativa os desenhos para isolar preparação CPU.

Na comparação em Chromium/WebGL com SwiftShader (renderização por software), os três modos carregaram todos os detalhes sem erros de shader. Os oito hashes de pixels do pós-processamento coincidiram com a versão anterior, combinando quatro intensidades de DOF e aberração cromática ligada/desligada.

Os tempos de frames completos oscilaram entre execuções, incluindo picos isolados. Não foi demonstrada uma redução consistente do stutter geral. Ainda é necessário comparar um save representativo na máquina do jogador para medir esse efeito.

## Testes automatizados

Os 71 testes focados em terreno, filas, transições, árvores, colisão 3P, viewport, tintura e controle de normal maps passaram. `git diff --check` também passou.

A suíte ampla foi interrompida após apresentar falhas fora desta rodada. Cinco falhas foram reproduzidas na cópia anterior: duas de recuperação de necessidades, uma de transferência/pintura de bicicletas, uma de catálogo de tarefas e uma de arte urbana. A suíte completa não está verde; as demais falhas dessa execução não foram classificadas nesta rodada.
