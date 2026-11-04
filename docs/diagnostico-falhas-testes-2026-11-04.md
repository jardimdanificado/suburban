# Diagnóstico das falhas de testes — 2026-11-04

## Verificação

A última suíte completa executou 851 testes: 849 passaram e 2 falharam em expectativas que foram corrigidas depois dessa execução. Os dois cenários longos corrigidos passaram isoladamente: conservação e saneamento por vinte dias, e a cidade gerada que constrói e abastece iluminação pública. Os dez testes curtos afetados também passaram juntos.

## Causas corrigidas

- A auditoria da economia exigia trigo produzido localmente, embora o jogo pudesse importar trigo e usar esse insumo para produzir pão. O teste agora verifica consumo real de trigo.
- A herança de sobrenomes era conferida pelo último termo do nome exibido, que pode incluir sufixos; a identidade mantém os sobrenomes em `citizen.surnames`.
- A auditoria de vinte dias exigia produção/consumo de pão e limpeza de banheiro. O cenário usa reserva inicial de alimentos e registra limpeza fecal em `cleanedFeces`; as verificações agora cobrem o estoque de pão e ambos os contadores sanitários.
- A fixture do IML chamava veículos sem implementar `society.citizen`; o mock agora fornece a dependência.
- `crimeRecord()` podia despachar a patrulha automaticamente antes da segunda chamada explícita no teste; a fixture desativa a observação automática para testar um único despacho.
- Pedreiras fechadas precisavam de sala de jantar; fazendas ao ar livre continuam com suas células de trabalho e não exigem uma sala interna de jantar.
- O teste de obra confundia iniciar deslocamento até a célula com contabilizar trabalho. Agora verifica que a mão de obra só aumenta no local.
- Os testes de frete alteravam um prédio de mercado em vez da empresa transportadora, e supunham que uma carga fresca não poderia receber motorista enquanto outra pessoa levava comida. As fixtures e asserções agora seguem os IDs e o estado de coleta atuais.
- A consulta de entregas de óleo dependia de registros concluídos que a fila limita aos últimos 100; o cenário verifica o poste público aceso, que prova o abastecimento físico.
- A conservação da cidade gerada não somava as importações de óleo. O teste inclui `externalTrade.importedGoods` no saldo de entrada.
- A renderização de skybridges agrupa meshes em subgrupos e distribui postes de suporte ao longo do vão; o teste agora percorre a hierarquia e valida a geometria atual.
- O teste de bicicleta permitia apenas 30 frames, insuficientes para embarque e início da pedalada; o limite agora cobre a transição completa.

## Defeitos de jogo corrigidos nesta rodada

- Empresas com salário inicial acima do antigo teto agora podem elevar ofertas gradualmente quando conseguem sustentar a folha.
- Cores de bandeira geradas agora escolhem texto com contraste legível.
- Trabalhadores de pedreira conseguem alcançar células acessíveis ao lado das rochas; lotes comuns continuam aceitando encostas suaves.
- Refeições compradas para equipes de obra podem ser consumidas no próprio canteiro.
- O movimento externo também aplica o fator de velocidade por altura e peso.
- A pavimentação clara de calçadas recebeu contraste suficiente para ser visível.
- A sala de jantar de pedreiras é criada sem remover células operacionais das fazendas.
