# Enumeração dos campos — experimento retirado

Foi comparado `for…in` com `hasOwnProperty` por campo contra `Object.keys` no serializador, mantendo a ordem e as mesmas regras de exclusão de campos locais, accessors e callbacks.

Cidade de 1024 habitantes, mapa 256, semente 1337, aquecimento de 660 minutos, 30 pacotes por execução, opções compactas e extensão de mudanças de estrutura nas duas versões. Ordem controle/experimento/experimento/controle.

| Execução | Serialização média | Aplicação média |
|---|---:|---:|
| Controle | 212,4 ms | 20,0 ms |
| Experimento | 216,3 ms | 20,3 ms |
| Experimento | 213,5 ms | 20,0 ms |
| Controle | 256,3 ms | 24,7 ms |

A primeira comparação não apresentou ganho; o último controle ficou mais lento também na aplicação, que não foi alterada. A diferença das médias agregadas não é evidência suficiente para manter a mudança. Ela foi retirada. Os hashes de simulação, posições esperadas/recebidas e campos visuais coincidiram em todas as execuções. Os oito testes direcionados do protocolo passaram.

[Dados brutos](performance-own-field-experiment.json). Este resultado motivou uma comparação adicional com duas cidades restauradas do mesmo pacote e ordem alternada dentro do mesmo processo, disponível em `scripts/benchmark-state-encode.mjs`.
