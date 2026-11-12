# Plano: mundo com múltiplas cidades

## Objetivo

Adicionar várias cidades independentes, cada uma com seu mapa e worker de simulação, conectadas por rotas marítimas para transporte de produtos e cidadãos.

A primeira entrega funcional é um mundo com duas cidades e uma rota comercial real. O plano inclui comércio, migração individual e familiar, políticas autônomas, persistência e medições de escala.

## Arquitetura proposta

```text
WorldCoordinator
  ├── relógio global
  ├── cadastro de cidades
  ├── rotas e viagens
  ├── registro de transferências
  └── CitySession por cidade
        ├── worker da simulação
        └── estado enviado à interface
```

O coordenador do mundo administra o tempo, as rotas e as transferências entre cidades. Cada worker continua responsável pelo mapa, moradores, economia, governo e caminhos da sua própria cidade. A interface acompanha a cidade selecionada; as demais podem enviar indicadores resumidos.

## Etapas

### Andamento da implementação

- **Base de coordenação iniciada:** `WorldCoordinator` registra sessões identificadas, propaga pausa e velocidade, mantém transferências no estado programado/em trânsito/entregue e exporta/restaura um snapshot de mundo versão 1.
- **Bridge identificado por cidade:** init, comandos, controles, passo e confirmação carregam `cityId`; respostas também são identificadas e descartadas pelo bridge quando pertencem a outra cidade. A cidade observada mantém movimento e snapshots detalhados; as demais enviam pulsos leves de relógio, indicadores de população/emprego/felicidade e snapshots completos menos frequentes. Ao selecionar outra cidade, o bridge pede um checkpoint imediato.
- **Duas sessões locais:** o botão **Nova cidade** cria outro mapa, população, entidades e worker; o seletor troca o mapa e os painéis exibidos sem encerrar os demais workers. Pausa e velocidade são propagadas a todas as sessões.
- **Relógio de mundo:** cada bridge reporta o minuto local; o coordenador avança o relógio global somente até o menor minuto alcançado entre as sessões. Novas cidades começam nesse minuto. Transferências vencidas ficam pendentes se os handlers de partida/entrega não estiverem instalados, evitando marcá-las como concluídas sem aplicar efeitos. `tests/world_coordinator.test.mjs` cobre a barreira de tempo, estados de transferência e restauração do ledger.
- **Rede marítima inicial:** cada sessão registra um porto conectado à porta do paço municipal, um ponto acessível por caminhos locais. O app monta rotas direcionais entre pares de cidades e mantém frota de canoas, lanchas, balsas e cargueiros por rota. A menor embarcação disponível que comporta cada manifesto é escolhida. Ao chegar, o barco retorna vazio ao porto de origem antes de aceitar outra carga; cancelamento o libera no porto em que está.
- **Comércio entre cidades:** a janela **Comércio marítimo** permite escolher vendedor, comprador, produto, quantidade e preço. Uma pessoa carrega a carga do vendedor ao porto pelos caminhos locais; depois da travessia, outra entrega do porto ao comprador. O comprador reserva produto mais frete marítimo, que é liquidado entre exportador e conta da frota após a entrega local. Cancelamentos e handlers repetíveis preservam estoque e dinheiro. `tests/world_trade_port.test.mjs` cobre os dois trechos físicos, `tests/world_trade_service.test.mjs` cobre liquidação, cancelamento e novas tentativas, e `tests/world_recovery_integration.test.mjs` recarrega os grafos completos e o ledger durante a travessia antes de concluir produto e pagamento sem duplicação.
- **Compra recorrente autônoma:** a janela marítima pode manter um contrato diário de fornecimento. A cada dia do relógio mundial, o sistema tenta reservar estoque e pagamento; se faltar saldo, repete no próximo minuto. Contratos e próxima tentativa entram no snapshot, e contratos podem ser pausados. Cada rota direcional ganha embarcação própria, permitindo viagens paralelas entre vários pares de cidades.
- **Salvamento versionado validado:** os workers confirmam checkpoints identificados por solicitação, então um snapshot antigo em trânsito não satisfaz um salvamento novo. A interface grava grafos completos das cidades, controles e coordenador em IndexedDB e pode restaurar o último salvamento. Na validação do navegador, fundei duas cidades, salvei o mundo, recarreguei a página e confirmei que as duas cidades voltaram ao seletor. Em outra checagem visual, fundei uma segunda cidade e confirmei indicadores resumidos nas duas opções e o painel de migração com rota entre elas. A recuperação normaliza partidas/chegadas interrompidas, retenta handlers idempotentes e restaura comércio e migração familiar/individual a partir dos grafos das duas cidades e do ledger; testes também cobrem cancelamento parcialmente aplicado e repetição após confirmação perdida.
- **Migração individual, familiar e autônoma:** uma vez por dia, moradores adultos com dificuldade de trabalho, moradia ou bem-estar avaliam cidades com rota disponível. A decisão compara vagas, moradias livres e bem-estar no destino, ponderados pelas condições e traços do morador; quando há oportunidade suficiente, migra a pessoa ou seu núcleo familiar. Emprego e aluguel são liberados na partida; proprietários de imóveis e negócios seguem inelegíveis para não deixar patrimônio ou obrigações locais órfãos. O manifesto versionado por pessoa reconecta parceiro, guardião, filhos e relações locais após a chegada. Saldo, habilidades, necessidades, histórico social arquivado com referências globais, dados políticos, reputação e pertences acompanham cada pessoa; memórias da origem deixam de participar de novos rumores para evitar colisões entre IDs locais. O dia da última rodada automática de comércio e migração agora acompanha o snapshot mundial, evitando repetição da rodada ao recarregar o mesmo dia. Cada cidadão recebe identidade global antes do início do worker; a ficha permite abrir vínculos familiares, contatos e memórias preservados em outras cidades. `tests/world_migration.test.mjs` cobre embarque, checkpoint, cancelamento, família, emprego, moradia e repetição sem duplicação; os casos de recuperação cobrem viagens em trânsito e impedem entidades duplicadas. `tests/world_coordinator.test.mjs` cobre resolução remota, identidade, unicidade e capacidade por pessoa em viagens familiares.
- **Medição e retenção de memória:** o benchmark instrumentado identificou crescimento do grafo social de cada cidade. Adicionei expiração diária de conhecidos fracos sem contato por três dias simulados; amizades, família, colegas/casa, conflitos importantes e relações recentes permanecem. A execução de 30 min com duas cidades de 512 moradores caiu de ~2,74 GB para ~2,51 GB de RSS (137,3% de um núcleo), com ~587 MB de heap pós-GC no coordenador e 306–308 MB por worker no fim. Na última metade, o RSS variou perto de 2,4–2,5 GB. Os índices de fatos, memória pessoal, histórico e ledger têm limites; o [relatório](benchmark-multiplas-cidades.md) define os cenários medidos como envelope de referência e explicita que outras populações/mapas precisam de medição própria.
- **Validação ampla:** a última execução de `npm test` terminou com 976 aprovações e 41 falhas em 1.017 testes, em 11 min 04 s. Nenhum teste multi-cidades, de ponte, de relógio, de comércio mundial, de migração ou de retenção social falhou. Comparei os nomes das 41 falhas com a execução anterior: o conjunto é idêntico, nos mesmos módulos já existentes de UI, eleições, emprego, produção/serviços, justiça, logística e economia. Os 44 testes de mundo multi-cidades passaram; o conjunto direcionado de 56 testes também passou integralmente.
- **Validação visual das rotas:** em um mundo isolado, fundei três cidades e confirmei indicadores de todas no seletor, criei compras diárias em duas rotas direcionais diferentes e ativei uma política autônoma. Depois da mudança de elegibilidade, uma cidade inicial com 96 moradores listou adultos trabalhadores e inquilinos, habilitou o embarque e confirmou a reserva de passagem; a tela explica que emprego e aluguel são liberados ao partir. Aquele mundo não tinha núcleo familiar elegível para testar o botão visual, então a migração familiar segue coberta por testes automatizados.
- **Transporte marítimo local:** as alterações recentes do gerador de arquipélagos foram removidas e o gerador original foi restaurado. A geração de arquipélagos permanece pendente. A busca de caminhos ainda pode conectar margens separadas por água e classifica a embarcação por distância e carga; bicicletas e outros veículos terrestres não entram no mar. Os modelos 3D do cais e das embarcações, o tráfego entre portos e a migração/comércio entre cidades seguem implementados, mas a inspeção visual do cais, de um barco atracado e da travessia local até o desembarque ainda está pendente.
- **Estado do plano:** as entregas e critérios descritos acima têm implementação no código e cobertura histórica documentada. A geração em arquipélago e a janela nativa do mundo foram verificadas em execução; o goal permanece em auditoria até conferir visualmente o cais/barcos e o transporte local ativo. O envelope de escala continua empírico e dependente de hardware/população.

### 1. Separar mundo, cidade e interface

- Adaptar `city_sim_bridge.js` para manter uma sessão por cidade.
- Incluir `cityId` em comandos, mensagens e respostas dos workers.
- Separar a seleção da cidade observada da execução da simulação.
- Qualificar referências entre cidades com cidade e ID local, mantendo os IDs internos atuais nesta etapa.

**Critério de conclusão:** duas cidades independentes rodam ao mesmo tempo e é possível alternar entre elas sem reiniciar a simulação.

### 2. Coordenar o tempo e o tráfego de dados

- Usar um relógio global para pausa e velocidade.
- Avançar workers em pequenos intervalos coordenados e receber confirmação do tempo processado.
- Aplicar eventos entre cidades somente no instante correto.
- Enviar snapshots e movimento detalhados da cidade selecionada e indicadores resumidos das demais.
- Solicitar snapshot atualizado ao trocar de cidade.

**Critério de conclusão:** alternar a cidade exibida não muda os resultados da simulação, e nenhuma cidade recebe eventos futuros.

### 3. Criar portos, rotas e viagens

- Conectar um porto à circulação local de cada cidade.
- Representar a viagem marítima no mundo por origem, destino, duração e progresso; não é necessário simular o oceano célula por célula.
- Criar barcos com capacidade, horários, manifesto e estados de carregamento, trânsito, desembarque e conclusão.
- Usar os caminhos locais da cidade para levar cargas ao porto e do porto ao destino.

**Critério de conclusão:** uma carga sai do estoque da origem, fica registrada durante a viagem e entra no estoque do destino sem duplicação ou perda indevida.

### 4. Implementar comércio entre cidades

Começar com um produto, uma rota e contratos simples. O fluxo deve reservar estoque e pagamento, levar o produto ao porto, transportá-lo, entregá-lo e liquidar pagamento e frete. Cancelamentos devem liberar as reservas.

Adotar inicialmente uma moeda comum ao mundo, mantendo tesouros e contas municipais separados. Câmbio pode ser considerado em uma etapa posterior.

Cada transferência terá um identificador único e confirmações persistidas para que mensagens repetidas não dupliquem carga ou dinheiro.

**Critério de conclusão:** estoque, pagamento e frete ficam conciliados ao completar ou cancelar uma negociação.

### 5. Adicionar passageiros e migração

- Atribuir a cada cidadão uma identidade global estável.
- Definir como trabalho, moradia, pertences, contratos, dívidas e obrigações são tratados no embarque.
- Registrar quem controla a pessoa durante a travessia e atualizar necessidades e acontecimentos básicos.
- Ao desembarcar, integrar o cidadão à simulação de destino e removê-lo da origem.
- Preservar referências a familiares, histórico e propriedades por identidade global.
- Usar um pacote de transferência explícito e versionado, sem copiar indiscriminadamente todo o grafo de objetos da simulação.

Começar com migração permanente de adultos elegíveis. Famílias, visitas, retorno e decisões autônomas de migração podem vir depois.

**Critério de conclusão:** o cidadão muda de cidade preservando identidade, saldo, habilidades e vínculos, sem permanecer ativo na origem.

### 6. Salvar, recuperar e medir o mundo

O salvamento do mundo deve incluir relógio, estado de cada cidade, rotas, barcos, manifestos, contratos, reservas e transferências pendentes ou confirmadas. O formato deve ser versionado.

O estado salvo precisa ser consistente mesmo durante embarque, viagem ou desembarque, para que uma carga ou pessoa não seja restaurada em dois lugares.

Medir CPU, memória e custo dos snapshots com duas e quatro cidades. A quantidade de cidades suportadas será definida pelos resultados. Inicialmente, as cidades em segundo plano continuam usando as mesmas regras de simulação.

**Critério de conclusão:** o mundo pode ser salvo e carregado durante uma viagem sem duplicar ou perder entidades, e há medições de desempenho para orientar a escala.

## Entregas

| Entrega | Resultado utilizável |
|---|---|
| 1 | Duas cidades, workers separados, seleção de cidade e relógio global |
| 2 | Portos e transporte de um produto, com recuperação por salvamento |
| 3 | Compra, venda, pagamento e frete entre cidades |
| 4 | Migração individual com identidade persistente |
| 5 | Comércio e migração autônomos, famílias e múltiplas rotas |

## Fora do primeiro ciclo

Oceano navegável célula por célula, combate naval, câmbio, turismo, empresas com filiais e simulação simplificada de cidades distantes ficam para depois. O primeiro marco de gameplay é uma cidade abastecer outra por barco, com efeitos reais nos estoques e na economia.
