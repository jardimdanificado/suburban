# Campanhas e mobilidade aérea

## Campanha eleitoral

- O programa, a experiência de governo, a ideologia, os vínculos e a reputação continuam influenciando votos. A familiaridade individual agora também tem peso: conhecer uma candidatura em contatos reais melhora sua avaliação em relação a candidaturas desconhecidas.
- O recrutamento de rua funciona das 7h às 21h. Usa voluntários filiados e contratos pagos pelo fundo do partido. Necessidades urgentes, transporte, cuidado e trabalho essencial não são interrompidos para recrutar agentes.
- A conversa de rua funciona mesmo sem tecido. Um balão de fala identifica o agente em atividade; esse indicador não representa uma bandeira física.
- Bandeiras carregadas e instaladas continuam exigindo produção, compra e transporte de materiais. A demanda por papel, tecido e propaganda começa seis dias antes da eleição.
- Contatos apresentam também candidatos a vereador do partido. A influência de uma memória sobre outro candidato do mesmo partido é menor que a influência sobre o candidato diretamente conhecido.
- Os votos continuam individuais; nenhuma distribuição partidária é forçada. A Câmara mantém sua distribuição proporcional aos votos reais de vereador.
- Governo → Política → Eleições → Campanha mostra agentes, contatos e instalações. O dossiê político de cada pessoa mostra candidaturas conhecidas e a origem dos contatos.

## Ruas e acessos

As ruas usam uma célula, com acessos de barro abertos na construção e calçamento contratado com materiais e trabalho. Foram removidos as faixas CRRC, o grafo de pistas e os requisitos de largura na fundação. Os pedestres continuam seguindo o relevo e os veículos voam independentemente das estradas.

## Produção

Foram acrescentados vinte ramos:

| Etapa | Empreendimentos |
| --- | --- |
| Metais | Siderúrgica, mina de bauxita, refinaria de alumínio |
| Borracha | Seringal, fábrica de borracha |
| Componentes | Motores, chassis, carrocerias, rodas e pneus, transmissões, vidros automotivos, assentos, autopeças |
| Tração animal | Criação de cavalos, oficina de carruagens |
| Montagem e serviços | Montadora, concessionária, posto de óleo combustível, oficina mecânica, empresa de ônibus |

Os ramos existentes fornecem ferro, carvão, areia, vidro, madeira, tábuas, tecido e tinta. As minas precisam de depósitos rochosos e possuem reservas finitas. As etapas participam do planejamento produtivo e do transporte de insumos.

Uma montadora reserva peças para um lote. Cada componente usa um fornecedor e uma revisão em todo o lote. A identidade do modelo inclui a montadora, o tipo de veículo, a receita, os fabricantes e as revisões das peças. Qualquer mudança nessa composição registra outro modelo; trocar apenas o tamanho do lote não muda o modelo.

O planejamento automático alterna carros, caminhões e ônibus conforme a frota e pode iniciar lotes menores com conjuntos completos. No dossiê da montadora é possível escolher tipo e quantidade; um lote manual aguarda todas as peças. Fábricas de componentes podem iniciar uma nova revisão, preservando a identificação do estoque antigo.

As concessionárias compram unidades por frete e revendem com margem. O capital inicial das concessionárias e empresas de ônibus inclui a aquisição da frota, e transportadoras podem financiar veículos com entrada e garantia. Os empréstimos usam dinheiro existente do banco.

## Voos e controle de tráfego

- Carros, caminhões, ônibus e carruagens são voadores. Toda a cadeia produtiva, as marcas, os modelos por composição de peças, as concessionárias, os financiamentos e as oficinas foram mantidos.
- Todos os veículos usam óleo de girassol, comprado e entregue por transporte. Não há combustível grátis. O veículo verifica reserva para voo, subida e descida antes de partir; combustível esgotado solicita pouso de emergência.
- Embarque ocorre no solo. Há subida vertical, cruzeiro e descida até a área reservada. Os passageiros permanecem no veículo até o pouso, inclusive quando interrompem a viagem.
- Áreas regulares de pouso reservam 2×2 células fora das ruas e prédios. A aproximação ao destino também requer acesso de pedestre entre a área e o destino. Em emergência pode ser usada uma célula livre.
- O cruzeiro usa oito faixas com separação vertical de três unidades, acima do maior teto da cidade e do relevo. Sentidos opostos recebem faixas diferentes. Esperas prolongadas permitem trocar de faixa.
- O controle prevê a menor distância entre trajetórias tridimensionais e retém movimentos conflitantes. Veículos são consultados por vizinhança espacial; não se usa uma busca de caminho por célula no ar.
- Veículos mal conservados podem perder o controlador de desvio. Acidentes exigem interseção física de trajetórias, incluindo o trecho entre dois quadros. Geram danos, ferimentos, registro do incidente e pousos de emergência.
- Ônibus operam linhas aéreas com pontos no solo, pilotos, lotação, horários, salários e tarifas. Caminhões e carruagens transportam as cargas reais das transportadoras.
- As oficinas atendem veículos pousados, levando as peças até eles. Passageiros e pilotos não são teleportados para o solo durante um voo interrompido.
- A renderização 3D usa altitude real, rotores e sombra no solo. O modo 2D também diferencia o veículo de sua projeção no solo.

## Interface

Em **Transportes**, as abas **Frota**, **Ônibus**, **Modelos** e **Tráfego aéreo** mostram a operação. O dossiê apresenta altitude, faixa, controlador, espera, peças, fabricante, lote, conservação, combustível e proprietários. A tela aérea reúne esperas, conflitos evitados, emergências e acidentes, com os veículos e cidadãos envolvidos.

## Revisão

Revisão estática e verificação de sintaxe dos módulos alterados. Não foi executada nesta rodada uma simulação prolongada nem uma validação visual no navegador.
