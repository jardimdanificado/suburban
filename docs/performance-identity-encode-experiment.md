# Cache privado de identificadores — experimento retirado

Foi testado um cache de identidade via símbolo não enumerável, com fallback para WeakMap em objetos previamente congelados. O cache distinguia serializadores independentes e objetos que herdavam de um protótipo também serializado. O receptor instalava o cache antes de congelar registros novos. O símbolo não entrava nos pacotes.

No comparador alternado com duas cidades restauradas, 1024 habitantes, aquecimento até 19h e 30 pacotes noturnos:

| Medida | Controle | Experimento |
|---|---:|---:|
| CPU média por encode | 249,6 ms | 253,2 ms |
| Tempo médio | 252,0 ms | 256,5 ms |
| p95 | 362,1 ms | 385,7 ms |
| Máximo | 365,6 ms | 402,5 ms |

Sem ganho demonstrado; CPU média 1,4% maior e picos maiores. A implementação foi retirada, incluindo os metadados privados. Os estados finais coincidiram (`5941fb26abb0604317b8088d1de139efabb5e405c02543aad02967f0fc78a881`). Os testes de protocolo, listas, ciclos, objetos congelados, herança e serializadores independentes passaram. [Dados brutos](performance-identity-encode-experiment.json).

A comparação usa o mesmo processo e alterna a ordem dos encoders em cada rodada. Mantém duas cidades e o estado de origem na memória, portanto seu custo absoluto não representa uma medida de FPS nem uma previsão para celulares. O resultado não deve ser agregado com o experimento de listas, executado em outra rodada.
