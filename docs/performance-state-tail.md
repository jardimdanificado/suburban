# Mudanças de estrutura nos pacotes — 6 de novembro de 2026

Acrescentar ou retirar um campo de um objeto obrigava o transporte a enviar novamente o seu registro completo. Em cidadãos com muitos campos, essa operação repetia dados que não haviam mudado.

A extensão conserva o prefixo de campos existente e envia suas alterações de valores junto com o trecho cuja estrutura mudou. O receptor recompõe esse trecho e mantém o estado completo para as atualizações seguintes. A escolha usa uma estimativa de tamanho, incluindo uma margem para o cabeçalho.

O uso é negociado na inicialização: a tela anuncia o suporte efetivo do seu leitor e o worker só emite o formato novo após essa confirmação. Sem confirmação, permanece o protocolo anterior. Leitores novos continuam aceitando os registros antigos. A frequência de sincronização, as necessidades, as decisões da simulação e os elementos visuais não foram reduzidos.

## Medições

1024 habitantes, semente 1337, mapa 256×256 e 30 pacotes por caso. O cenário diurno vai de 08h a 10h; o noturno começa após 660 minutos de aquecimento da cidade, às 19h, e termina às 21h. O benchmark usa a ponte real e as necessidades/posições compactadas, omitindo caminhos externos como o worker. São médias por execução, com uma repetição da versão nova em cada caso, sujeitas à concorrência e ao aquecimento; não são FPS nem comprovação de fluidez em celulares.

| Caso / etapa | Controle | Extensão | Redução |
|---|---:|---:|---:|
| Dia: tamanho JSON médio | 1,570 MB | 1,142 MB | 27,3% |
| Dia: serialização | 158,1 ms | 151,9–156,8 ms | 0,8–3,9% |
| Dia: aplicação pela ponte | 31,6 ms | 23,3–25,0 ms | 20,9–26,3% |
| Noite: tamanho JSON médio | 1,081 MB | 1,004 MB | 7,1% |
| Noite: serialização | 257,8 ms | 229,1–255,8 ms | 0,8–11,2% |
| Noite: aplicação pela ponte | 26,6 ms | 21,2–25,0 ms | 6,1–20,4% |

Os hashes autoritativos coincidiram entre controle e extensão nos dois casos. A posição esperada para a tela, incluindo os assentos dos passageiros, também coincidiu com o estado efetivamente recebido em todas as comparações. [Dados brutos](performance-state-tail-results.json).

A repetição noturna também comparou separadamente os campos de altura, peso, estado visual e roupas/estampas de todos os cidadãos; os hashes visuais de origem e destino coincidiram. Isso valida os dados transportados, sem substituir uma comparação de pixels do renderizador.

A quantidade de nós alterados continua igual; a melhora vem do conteúdo menor de cada nó. A serialização noturna ainda é custosa. O objetivo geral de 1024+ habitantes continua sem comprovação de conclusão.

## Reprodução

```sh
SUBURBAN_BENCH_POPULATION=1024 SUBURBAN_BENCH_MAP_SIZE=256 SUBURBAN_BENCH_COMPACT_PATHS=1 SUBURBAN_BENCH_TAIL_PATCHES=1 node scripts/benchmark.mjs bridge
SUBURBAN_BENCH_POPULATION=1024 SUBURBAN_BENCH_MAP_SIZE=256 SUBURBAN_BENCH_COMPACT_PATHS=1 SUBURBAN_BENCH_TAIL_PATCHES=1 SUBURBAN_BENCH_WARMUP_MINUTES=660 node scripts/benchmark.mjs bridge
```

Um terceiro argumento aponta para o checkout de controle. O script atualizado funciona com o encoder antigo, que ignora a opção desconhecida e mantém os registros completos.

## Verificação

Os 23 testes direcionados passaram. Cobrem acréscimo, retirada e reordenação de campos, alterações no prefixo, referências compartilhadas e ciclos, callbacks locais, troca entre formatos completo e compacto, recodificação pela outra ponta, erro por ausência de baseline, anúncio de capacidade, rotas internas e posições de passageiros.

Também foi experimentado um cache de listas de registros imutáveis. A classificação e manutenção desse cache não produziram ganho consistente nos cenários medidos; a implementação experimental e seus testes foram removidos. A extensão de mudanças de estrutura é a alteração mantida nesta rodada.
