# Layout de propriedades — experimento retirado

O perfil concentrou amostras nas leituras de campos opcionais dos cidadãos. Um diagnóstico local com `%HasFastProperties`, usando Node com `--allow-natives-syntax` somente no ensaio, confirmou objetos restaurados em modo de dicionário. Uma consulta a um protótipo temporário, via JavaScript padrão, incentivou o V8 a converter o layout. O objeto original mantinha identidade, protótipo, campos, símbolos próprios e descritores.

A primeira versão preparava a cidade e os cidadãos ao receber o estado e registrava os objetos em um WeakSet para não repetir a preparação. Um ensaio com 16 cidadãos recém-criados mostrou 0/16 layouts rápidos no controle contra 16/16 na versão nova após restauração e bind. Depois do primeiro minuto, o cidadão observado voltou ao modo de dicionário. Portanto a preparação inicial não sustentava o efeito durante todas as alterações de campos.

No comparador alternado com 1024 habitantes, aquecimento de 660 minutos e 30 pacotes noturnos, a preparação inicial registrou CPU média de encode de 316,3 para 283,2 ms (10,5% menor). Esse ensaio ainda não registrava o custo das atualizações da simulação, portanto não demonstra benefício líquido.

A segunda versão reaplicava a preparação após cada minuto e após cada recebimento de estado. O comparador passou a registrar separadamente o custo das seis atualizações de 1/6 s (quatro minutos da cidade) que antecediam cada encode:

| Medida, por rodada | Controle | Preparação por minuto |
|---|---:|---:|
| CPU média da simulação | 222,3 ms | 456,7 ms |
| CPU média do encode | 247,9 ms | 256,7 ms |
| Tempo médio da simulação | 229,9 ms | 457,0 ms |
| p95 do encode | 381,2 ms | 368,6 ms |
| Máximo do encode | 399,0 ms | 441,4 ms |

CPU da simulação 105,4% maior. O estado final foi idêntico: `5941fb26abb0604317b8088d1de139efabb5e405c02543aad02967f0fc78a881`. A preparação por minuto e a inicial foram retiradas, incluindo o módulo auxiliar e seu WeakSet. O ganho de leitura isolado não justifica uma implementação sem evidência de benefício no ciclo completo. O mecanismo interno responsável pelo aumento de custo das escritas não foi provado; não se atribui o resultado a uma causa específica do V8 além do que foi observado.

Os testes de transporte, listas, ciclos, herança, objetos congelados e serializadores independentes passaram. O comparador conserva a medição separada da simulação para que próximos experimentos não sejam avaliados apenas pelo encode. Nenhum intrínseco específico de V8 foi adicionado ao jogo. [Dados brutos](performance-object-layout-experiment.json).
