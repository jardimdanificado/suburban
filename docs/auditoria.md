# Auditoria de funcionamento e eficiência

## Escopo

Auditoria realizada em 25/10/2026, com testes de contratos e de integração, cidades autônomas em mapas reais e inspeção do navegador. Os resultados reproduzíveis ficam em `auditoria-resultados.json`.

| Área | Verificações |
| --- | --- |
| Economia e moeda | Contas em centavos inteiros, conservação de dinheiro, emissão e retirada de moeda, impostos e subsídio salarial |
| Bancos e assistência | Crédito empresarial, financiamento das cadeias iniciais, parcelas, depósitos com reserva integral, saques e benefícios |
| Produção | Culturas, receitas industriais, insumos físicos, armazéns, capacidade de carga e distribuição de matéria-prima escassa |
| Obras e terrenos | Compra, financiamento, materiais transportados, trabalho presencial, moradias populares, ampliação, ruas e ligação com a malha |
| Logística e iluminação | Reserva de mercadorias e pagamentos, interrupção, reembolso, transportadoras, instalação e abastecimento físico de postes |
| Vida e sociedade | Necessidades, atendimento de saúde, mortes, famílias, filhos, amizades, relações e ocupação de moradias |
| Saneamento | Acesso aos banheiros, sujeira, limpeza contratada, coleta, reciclagem e compostagem |
| Política | Câmara e quórum presencial, sucessão, veto, corrupção, partidos, campanhas, dois turnos, votação presencial e pesquisas com entrevistados únicos |
| Comunicação e consumo | Papel, livros, panfletos, jornais, preservação dos fatos registrados, roupas, marcas, desgaste e equipamentos de transporte |
| Interface e execução | Abas, janelas, filtros, seleção, recorte, telas estreitas, relógio, pausa, velocidades, transporte de estado pelo worker e renderização |

Os testes industriais exercitam as transformações individualmente com entradas controladas. As cidades autônomas verificam também o encadeamento entre produção, transporte, consumo, investimento e necessidades, sem teletransportar trabalhadores ou repor seus recursos artificialmente.

## Correções realizadas

1. **Moradias:** índice de moradores por casa, com invalidação nas mudanças de residência e na sincronização do worker. Evita varrer toda a população para cada banheiro e consulta residencial.
2. **Refeições:** receitas compiladas por conjunto e uma avaliação por estabelecimento na escolha de destino, eliminando cálculos repetidos dentro das ordenações.
3. **Navegação:** componentes de terreno acessível para consultar conectividade sem calcular um caminho completo entre cada par de empresas. Buscas de rota continuam sendo usadas quando necessárias. A pavimentação preserva a revisão de conectividade; alterações de terreno e obstáculos a invalidam.
4. **Terrenos:** pedreiras deixaram de ser contadas como terrenos urbanos disponíveis, corrigindo o bloqueio da expansão das cadeias industriais.
5. **Moradia popular:** pode receber uma frente financiada mesmo quando há muitas obras industriais; a reserva social e o limite de obras continuam sendo respeitados.
6. **Saúde:** atendimento urgente pode interromper viagens para banheiro e descanso. O cidadão procura atendimento antes de sua saúde chegar a zero, preservando tempo de deslocamento para quem trabalha longe.
7. **Fretes:** tentativas de despacho usam intervalo real desde a última tentativa. O resto da divisão do número da carga deixou de impedir a atribuição imediata das entregas prioritárias.
8. **Matéria-prima e distribuição:** compras giram entre compradores e limitam reservas a um lote quando a oferta não sustenta os estoques pretendidos. Evita uma fábrica reservar seis lotes enquanto outras não conseguem começar. Mercados e hortifrutis participam do financiamento inicial, junto às cadeias produtoras.
9. **Ruas:** conexão exige pavimentação contínua até a entrada do prédio. Trechos novos partem da malha existente. A busca usa um índice das áreas reservadas dos terrenos.
10. **Campanhas:** contas sem uma pessoa associada não podem provocar exceção na escolha de imóveis para propaganda. Materiais instalados são contabilizados uma única vez.
11. **Saídas e mortes:** sementes, materiais de campanha e roupas carregadas deixam um registro de perda no balanço de mercadorias.
12. **Publicações:** transcrições guardam uma cópia do acontecimento original, consultável mesmo depois da retenção limitada do histórico geral. A propriedade dos exemplares acompanha o frete, seu cancelamento, a recuperação de estoque de prédios demolidos e a herança. Exemplares perdidos não podem duplicar o estoque.
13. **Banco e interface:** saques rejeitam referências inválidas; navegação direta preserva os filtros e a visualização solicitados.
14. **3D:** moradores com a mesma aparência compartilham um lote de instâncias. Matrizes preservam posição, orientação e tamanho, e a seleção continua usando os limites de cada entidade. Instâncias desativadas liberam seus buffers.
15. **Planejamento de iluminação:** terrenos, acessos, construções e pedestres são indexados uma vez na atualização. Caminhos compartilhados deixam de repetir a procura pelos mesmos postes. Teste de equivalência confere as exclusões contra a versão sem índice.
16. **Compras:** moradores sem ofertas disponíveis repetem a busca em intervalos de trinta minutos, evitando varrer todas as empresas a cada minuto de ociosidade.

## Resultados executados

`npm test`: **191 testes, 191 aprovações, nenhuma falha**, em aproximadamente 119 segundos nesta execução. Foram acrescentados 27 testes e atualizadas as condições dos testes antigos para contratos, eleições presenciais, limites de histórico e políticas atuais. A população de pequenos testes controlados é explícita; o padrão do jogo continua sendo 512.

| Cenário autônomo | Período acompanhado | População final | Mortes | Divergências de conservação |
| --- | --- | ---: | ---: | ---: |
| Continente, semente 1337 | Estado do dia 8 até o dia 14 | 512 | 0 | 0 |
| Arquipélago, semente 42 | Oito dias desde a fundação, terminando no dia 9 | 512 | 0 | 0 |
| Montanhas, semente 23811 | Dois dias desde a fundação | 128 | 0 | 0 |
| Inicialização com os ajustes finais de varejo | Três dias desde a fundação | 128 | 0 | 0 |
| Cidade madura com a otimização final | Mais 360 minutos do estado salvo do dia 14 | 512 | 0 | 0 |

No continente, os 35 setores industriais estavam instalados; houve produção de papel, jornais, roupas, cestas, móveis, cerâmica, bandeiras e alimentos compostos. Foram concluídas 21 obras de rua, houve 520 limpezas e 664 unidades de lixo processadas. A eleição registrou **426 votos de 426 eleitores distintos**, e três pesquisas foram publicadas. As pesquisas abaixo do mínimo ficaram explicitamente como insuficientes.

Na mesma cidade, restavam 114 moradores sem casa; no arquipélago, 391. Esses números mostram que funcionamento e conservação não equivalem a resolver imediatamente todos os problemas sociais. O arquipélago tinha 30 setores instalados ao final do período, com a expansão restante ainda em andamento. As etapas dos ajustes aplicados em cada execução estão indicadas no JSON; as últimas alterações também receberam verificações adicionais no estado maduro.

## Medição de desempenho

Em um mesmo estado salvo de cidade com 512 moradores, durante 360 minutos simulados, a introdução dos componentes de conectividade reduziu o tempo observado de aproximadamente **36,2 s para 16,6 s**. O maior passo caiu de aproximadamente **4,1 s para 0,68 s**. São medições desta máquina, com processos concorrentes; não constituem garantia de FPS nem comparação de cidades com evoluções diferentes.

Em outra comparação, partindo do mesmo estado salvo do dia 14, o índice de localização de postes reduziu 360 minutos de simulação de **27,7 s para 8,8 s**. O maior passo caiu de **2,21 s para 0,29 s**. Empresas, cadeias, projetos pendentes e indicadores finais observados coincidiram nas duas execuções. A colocação dos postes consumiu cerca de 357 ms nas seis atualizações horárias, contra 7.072 ms anteriormente.

Na inspeção inicial do navegador com 512 moradores, os lotes gráficos reduziram as chamadas de desenho de aproximadamente **1.100 para 81**, com **5 lotes** para os **512 moradores**. As leituras observadas passaram de aproximadamente 6 para 42 FPS. Os mapas e a carga da máquina variaram entre as leituras; a redução das chamadas de desenho é a evidência mais direta dessa mudança.

O teste `city-render` mede sincronização de prédios na CPU, sem executar uma GPU. Os modos `snapshots` e `bridge` conferem que o estado refletido mantém o mesmo resumo verificável da simulação.

## Reprodução

```sh
npm test
npm run audit -- --population=512 --days=8 --seed=42 --preset=0
npm run audit -- --population=512 --days=8 --seed=1337 --preset=1
npm run audit -- --population=128 --days=2 --seed=23811 --preset=2
npm run benchmark -- simulation
npm run benchmark -- snapshots
npm run benchmark -- bridge
npm run benchmark -- scene
npm run benchmark -- city-render
```

O auditor imprime JSON por etapa e um resumo final com erros de conservação, mortes, emprego, moradia, produção, obras, ruas, iluminação, pesquisas, publicações e custos dos subsistemas. Também confere entrevistados e votos únicos e a identidade das reservas de poupança. `completed: false` indica execução interrompida. `SIGINT` e `SIGTERM` solicitam encerramento na próxima pausa horária, produzindo o resumo parcial.

Para investigações locais longas, `--state=/tmp/cidade.state` salva o grafo com `node:v8` ao fim de cada dia e no encerramento; `--resume=/tmp/cidade.state` retoma o mesmo estado. Esses arquivos são instrumentos de diagnóstico desta versão do código, não um formato público de save. `--trace=51,312` acompanha os cidadãos indicados a cada dez minutos.

## Limites da conclusão

Uma auditoria pode demonstrar resultados nos cenários executados e acrescentar regressões; não pode garantir ausência de qualquer falha em todas as sementes, quantidades de habitantes, decisões políticas e placas gráficas. Existência de uma empresa também não significa produção contínua: falta de insumos, caixa, trabalhadores, demanda ou espaço pode interrompê-la legitimamente. Pesquisas que não atingem a amostra mínima são registradas como insuficientes, em vez de inventar entrevistas.

Ainda é necessário avaliar separadamente o desempenho em cidades muito maiores, partidas com centenas de dias e diferentes GPUs. A sincronização do grafo do worker e mudanças grandes de geometria continuam tendo custos mensuráveis.
