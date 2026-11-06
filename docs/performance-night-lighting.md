# Iluminação noturna — 6 de novembro de 2026

A quantidade de `PointLight`s visíveis alterava `NUM_POINT_LIGHTS` do Three.js. Acender/apagar fontes e movimentar a câmera gerava variantes dos shaders de todos os materiais iluminados. Cada fragmento também executava o trecho expandido de todas as luzes, mesmo longe de sua área de influência.

O novo caminho mantém as fontes selecionadas e suas propriedades, mas usa uma grade espacial conservadora e texturas com listas locais. Não limita a quantidade por célula: até 256 fontes sobrepostas são conservadas. O alcance esférico, a normal e a atenuação são avaliados antes de aplicar a equação de iluminação do material. As posições das fontes são transformadas uma vez na CPU. Fontes e câmera paradas não reconstroem nem enviam a grade à GPU.

O tamanho escolhido do framebuffer, modelos OBJ, animações, roupas, estampas, altura e peso não são reduzidos. A economia não foi alterada. WebGL 1 sem textura float conserva o caminho nativo anterior.

## Ensaios gráficos

Os ensaios comparam os dois caminhos na mesma página e no mesmo WebGL. Tempos incluem conclusão do trabalho da GPU; a compilação inicial fica fora da mediana de quadros estáveis. Valores variam com aquecimento, concorrência e distribuição das luzes; não são uma promessa de FPS em celulares.

| Cenário | Antes | Depois | Observação |
|---|---:|---:|---|
| 1024 instâncias, 32 luzes, 512×384 | 5,5 ms | 2,1 ms | Pixels idênticos, inclusive após movimento de câmera/fontes |
| 1024 instâncias, 128 luzes, 512×384 | 9,6 ms | 3,3 ms | Pixels estáticos idênticos; movimento com diferença máxima de 1/255 por canal |
| Troca de quantidade de luzes, até 32 | pico de 92,2 ms | pico de 4,8 ms | Caminho anterior acumulou 20 programas; novo manteve 4 variantes próprias |
| Cidade real, 1024 habitantes, 64 postes ativos | 29,7 ms | 24,3 ms | Renderizador completo, modelos carregados, framebuffer 480×320 nas duas versões |

Na última cena, o trecho WebGL médio passou de 14,28 para 8,85 ms. Quatro deslocamentos de câmera que carregam outras regiões terminaram sem erro de shader. Os postes são inseridos pelo ensaio para controlar a distribuição; não representam uma cidade envelhecida por vários dias de economia.

O caso de estresse com tochas nos 1024 habitantes concentra as 32 fontes no mesmo espaço. Nesse caso o ganho total variou de aproximadamente 3% a 18% entre rodadas: todos esses fragmentos continuam recebendo muitas luzes. O trabalho de montagem dos personagens continua relevante. Portanto esta rodada **não comprova que o objetivo geral de 1024+ habitantes esteja concluído**.

Com 256 fontes o novo caminho compilou e renderizou sem erros; o nativo excedeu `MAX_FRAGMENT_UNIFORM_VECTORS(1024)` nesta GPU. Não se calcula ganho nem equivalência de pixels contra esse resultado inválido.

## Reprodução

```sh
python3 scripts/serve.py --port 4173
node --test tests/night_light_grid.test.mjs tests/night_lighting.test.mjs tests/terrain_transition_geometry.test.mjs tests/static_mesh.test.mjs
```

Abra os ensaios e use seus botões:

- `/tests/night_lighting_benchmark.html?lights=32` (também 128 e 256): materiais Lambert, Standard e Phong, instâncias, comparação de pixels, movimento e mudanças na quantidade de fontes.
- `/tests/night_city_benchmark.html?population=1024&limit=128`: renderizador real, roupas/modelos reais e postes distribuídos.
- `/tests/night_city_benchmark.html?population=1024&lights=torches`: caso de estresse com fontes concentradas.

Os 9 testes direcionados passaram. Cobrem fontes em coordenadas negativas, bordas, mapas grandes, 256 fontes sobrepostas sem truncamento, atualização da câmera, cache de uploads e preservação dos shaders de corpo/estampa e de variantes clonadas do terreno.

A rodada ampla registrou 865 aprovações e 33 falhas em 898 testes. Três falhas foram reproduzidas em uma cópia limpa do HEAD `58ba925`: catálogo de atividades, suportes de arte urbana e limite salarial de vagas. As demais falhas não foram classificadas nesta rodada; não se declara a suíte integral aprovada.

## Simulação

A passagem inicial de 512 habitantes de 08h a 01h não mostrou aumento de CPU durante a noite. Esse cenário começou sem postes construídos; não exclui gargalos de economia em cidades antigas. O ensaio de 1024 habitantes por 1020 minutos de cidade consumiu 50,35 s de CPU da thread, com passo de 0,25 s (cadência de 32x). Isso ainda fica muito abaixo de 32x efetivos e mantém pendente a otimização geral da simulação.

## Saídas e aglomerações

O perfil de 1024 habitantes também identificou geração repetida de anéis de busca e strings de ocupação em `leaveEntrance`/`disperseCrowds`. Os anéis agora são compartilhados, as células válidas usam chaves numéricas e moradores isolados não criam um vetor de grupo. A ordem da busca, a reserva de destinos e o orçamento de rotas continuam iguais; coordenadas fora do mapa mantêm chaves sem colisão.

Em comparação A/B/B/A de 240 minutos da cidade, 1024 habitantes e passo de 32x, a mediana da CPU da thread foi de 10.847 para 10.405 ms (redução de 4,1%). O p95 das atualizações foi de aproximadamente 112 para 94 ms. Todos os hashes finais coincidiram. A comparação de 1020 minutos também preservou o hash, mas os tempos dessa execução longa variaram bastante; ela não é usada para estimar o ganho. [Resultados A/B/B/A](performance-night-crowd-results.json).

O ensaio isolado de aglomerações reduziu CPU em 53–60% com saídas acessíveis e 70–74% com destinos bloqueados. Esses percentuais se referem somente à rotina, com a busca de caminhos substituída por um stub, e não ao jogo inteiro:

```sh
node scripts/benchmark-crowd-dispersion.mjs /caminho/do/checkout/anterior
```

Após essa alteração, 37 testes direcionados de dispersão, modelos, saias e iluminação passaram. Incluem prioridade de destinos já reservados, limite de 32 saídas, residentes ocupados e colisões de coordenadas fora do mapa. A aparência e a geometria dos personagens permanecem as mesmas.

## Aplicação de pacotes compactos

A recepção de um pacote com caminhos omitidos reconstruía o vetor de campos de cada cidadão em todas as chamadas, embora a retirada de `path` só fosse necessária na primeira transição. Agora o vetor só é copiado quando esse campo realmente existe. O protocolo, os caminhos locais e a aplicação dos valores compactados são preservados.

No ensaio isolado de 1024 habitantes, pacotes sem nós alterados e necessidades compactadas, quatro pares deram 4,18–5,56 ms por aplicação antes e 2,19–2,46 ms depois, com estado idêntico. Esse resultado não representa pacotes grandes com milhares de nós alterados. Os 10 testes direcionados de transporte compacto, movimento de passageiros e dispersão passaram. Reprodução: `node scripts/benchmark-state-apply.mjs /caminho/do/checkout/anterior`; [dados brutos](performance-state-apply-results.json).

A aplicação completa abriu com 1024 modelos 3D, worker ativo e sem erros de shader ou de módulos. O navegador de validação posteriormente deixou de responder às consultas de estado; não foi possível concluir por ele uma medição confiável de FPS nem certificar a passagem completa da noite. A medição de renderização noturna acima é dos ensaios controlados, não dessa sessão.
