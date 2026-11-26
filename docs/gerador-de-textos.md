# Gerador de textos

O gerador produz frases, títulos, slogans e diálogos do jogo. A prioridade é
gramática e sentido; variedade vem depois, sem inventar palavra nem quebrar
concordância.

## Arquivos

- `js/gerador_textos.js`: motor. Monta o discurso (relações, coesão, tempo
  verbal, voz, negação, advérbio, adjunto) sobre as cenas do banco.
- `js/cenas_do_vocabulario.js`: monta o banco de cenas em tempo de execução.
  Toda palavra de conteúdo vem do catálogo; o arquivo só guarda as regras de
  montagem.
- `js/cenas_padroes.js`: estruturas gramaticais extraídas das cenas antigas.
  Artigo, substantivo, adjetivo, preposição e adjunto, sem palavra de conteúdo.
- `js/adjetivos_frequentes.js`: recurso de vocabulário com formas de adjetivo
  separadas por gênero e número, conferidas contra o catálogo.
- `js/generos_frequentes.js`: recurso de vocabulário com o gênero do substantivo
  conferido pelo spaCy. O gerador escolhe o artigo por este mapa.
- `js/vocabulario_frequente.js`: interseção do catálogo com uma lista de
  frequência. Também exporta `VERBOS_FREQUENTES`, conferido contra a lista de
  verbos de fserb/pt-br.
- `js/lexico_sinonimos.js`: variantes curadas de substantivos e verbos. Importa
  as listas amplas e funde todas sem repetir variante.
- `js/lexico_amplo_substantivos.js`, `js/lexico_amplo_substantivos_b.js`,
  `js/lexico_amplo_verbos.js`, `js/lexico_amplo_verbos_b.js`: variantes amplas,
  quase todas de uma só palavra.
- `js/vocabulario.js`: catálogo de palavras, conjugação e reexportação da API
  pública (`gerarFrase`, `gerarFraseTematica`, `gerarTituloTematico`,
  `gerarSloganPartidario`, `gerarDialogoTematico`, `aquecerCatalogos`).
- `scripts/validar_lexico_sinonimos.mjs`: confere o léxico de variantes.
- `scripts/extrair_padroes_cenas.py`: extrai as estruturas das cenas antigas e
  grava `js/cenas_padroes.js` e `js/adjetivos_frequentes.js`.
- `scripts/gerar_vocabulario_frequente.py`: gera
  `js/vocabulario_frequente.js` a partir do catálogo e da lista de verbos.
- `scripts/gerar_generos_frequentes.py`: gera `js/generos_frequentes.js` com o
  gênero que o spaCy atribui às palavras que o gerador pode escolher.
- `scripts/contar_vocabulario.mjs`: conta lemas e formas que o gerador alcança.
- `tests/vocabulario_qualidade.test.mjs`: regressão de gramática, construções,
  escala do banco e variedade.
- `js/xingamentos.js`: repertório curado de xingamentos, palavrões,
  intensificadores e modelos de pichação. Não traz discurso de ódio pronto.
- `js/xingamentos_preconceito.js`: listas vazias por categoria de preconceito,
  preenchidas manualmente; cadastro, remoção e validação das entradas.
- `js/city_graffiti_size.js`: medidas da peça, orçamento de texto e resolução do
  canvas para pichações de um ou vários tiles.
- `tests/xingamentos.test.mjs`: regressão de concordância, modelos,
  determinismo e integração com pichação.

## Cena

Cada cena é uma combinação de sujeito, verbo no infinitivo, objeto direto
opcional e complemento opcional. Não há frase pronta: o banco é montado a
partir do catálogo de `js/vocabulario.js`.

```js
{s: 'A prefeitura', v: 'reformar', o: {d: 'a', n: 'praça do bairro', g: 'f'}, c: ''}
```

O objeto guarda artigo e gênero para a concordância do particípio na voz
passiva. O complemento é usado como está (lugar, modo, finalidade).

As 934 estruturas de `js/cenas_padroes.js` preservam os padrões das cenas
antigas: artigo definido ou indefinido, singular ou plural, adjetivo antes ou
depois do substantivo, sintagma com `de`/`em`/`por`, e complemento com
infinitivo. O preenchimento usa substantivos do tema, adjetivos concordados e
verbos conferidos.

## Discurso

A frase não é uma pilha de orações sorteadas. O motor escolhe uma relação de
discurso e só aceita as que combinam com a anterior:

- adição, oposição, causa, condição, concessão, tempo, conclusão e adição
  enfática;
- `causa` pede `conclusão`; `oposição` pede réplica; `conclusão` não abre uma
  frase sem uma causa antes.

Cada relação tem conectores próprios e, quando necessário, subjuntivo
(`se`, `caso`, `embora`, `antes que`). O mesmo conector não se repete na frase.

## Coesão

O motor acompanha o ator da oração anterior:

- mesmo ator em adição: o sujeito repetido vira elipse;
  `A prefeitura reformou a praça e ampliou a ciclovia`;
- ator que volta: retomada por descrição definida do léxico;
  `A prefeitura ... A administração ...`;
- oposição e concessão preferem outro ator, para não opor alguém a si mesmo.

`js/cenas_do_vocabulario.js` cria pares de mesmo ator em todos os temas para
garantir a elipse.

## Construções

Além da ordem direta, a primeira oração pode receber:

| Construção | Exemplo |
| --- | --- |
| clivagem | `Foi a prefeitura que reformou a praça.` |
| passiva sintética | `Reformou-se a praça do bairro.` |
| atribuição de fala | `A prefeitura anunciou que vai reformar a praça.` |
| adjunto fronteado | `No conselho municipal, a prefeitura aprovou o orçamento.` |
| inversão locativa | `No parque, caminham os moradores.` |

A passiva sintética só usa verbos de `PASSIVA_SE`, que não mudam de sentido com
o pronome. `formar-se`, `ocupar-se`, `tratar-se` e `empregar-se` ficam de fora.
O verbo concorda com o paciente: `Aprovaram-se as contas`.

## Estilo

`gerarFrase` e `gerarFraseTematica` aceitam `estilo`:

- `auto` (padrão): mistura equilibrada;
- `popular`: ordem direta, quase sem passiva nem clivagem;
- `jornal`: mais passiva, clivagem e atribuição de fala;
- `oficial`: mais passiva e passiva sintética.

O estilo muda probabilidades, nunca a gramática. A mesma semente e o mesmo
estilo produzem o mesmo texto.

## Variantes

O motor troca a palavra-chave da cena por um sinônimo do mesmo gênero e
número, com chance independente por campo:

- sujeito: só o núcleo, o token seguinte ao artigo;
- objeto: primeiro token com entrada no léxico, da esquerda para a direita;
- verbo: só em cena com objeto direto, porque `VERBOS_TRANSITIVOS` reúne
  verbos de transitividade direta.

No sujeito a busca não avança para o modificador preposicional. Sem essa
restrição, `O cinema de rua` viraria `O cinema de via`. A busca também para na
primeira preposição, para não trocar o núcleo de um sintagma preposicionado.

## Escala atual

O banco tem 8.207 cenas, 3.222 sujeitos, 2.089 objetos e 1.049 verbos de cena
distintos. O léxico curado tem 484 chaves de substantivo com 1.502 variantes e
327 chaves de verbo com 1.441 variantes. Somando cenas e léxico, o gerador
alcança 3.781 lemas de substantivo e 1.332 lemas de verbo, que viram cerca de
6.504 e 19.956 formas flexionadas.

Os números contam lemas, não flexões: `praça` e `praças` são um lema. Para ver
os totais atuais, rode `node scripts/contar_vocabulario.mjs`.

## Por que o léxico é curado

O catálogo tem 320 mil palavras, mas não guarda relação de sinonímia. Extrair
sinônimos de listas genéricas produziu pares como `praça -> forte` e
`iluminação -> ideia`, porque a lista mistura sentidos. Por isso a relação de
sinonímia é curada; o catálogo participa da validação:

- número (singular/plural) pelo lema;
- conjugação em todos os tempos usados pelo motor;
- ortografia pelo modelo spaCy `pt_core_news_md`, quando disponível.

## Como ampliar

Para vocabulário:

1. Acrescente a variante em `js/lexico_amplo_substantivos.js`,
   `js/lexico_amplo_substantivos_b.js`, `js/lexico_amplo_verbos.js` ou
   `js/lexico_amplo_verbos_b.js`, mantendo gênero e número da chave.
2. Prefira uma só palavra. Sintagma curto só entra quando cabe no contexto sem
   deixar palavra sobrando. Não repita a chave.
3. Rode `node scripts/validar_lexico_sinonimos.mjs`.
4. Rode `node --test tests/vocabulario_qualidade.test.mjs`.
5. Confira `node scripts/contar_vocabulario.mjs` e ajuste os limites do teste
   de escala só quando o ganho for real.

Para cenas:

1. Não acrescente frase pronta. Ajuste as regras de
   `js/cenas_do_vocabulario.js` ou o vocabulário que elas consomem.
2. Para preservar uma estrutura nova, acrescente o padrão em
   `js/cenas_padroes.js` usando só artigo, `n`/`N` (substantivo singular ou
   plural), `j` (adjetivo), `p:preposição`, `f:palavra funcional` e `V`
   (infinitivo).
3. Mantenha verbo no infinitivo e objeto direto com artigo e gênero.
4. Rode a suíte de qualidade e confira amostras com sementes baixas.

Verbos exigem cuidado extra. Só entram na lista de variantes os que aceitam
qualquer objeto já usado nas cenas, sem preposição fixa e sem forma pronominal.
Uma variante que só funciona com parte dos objetos deve ser cortada, não
tratada como exceção.

## Xingamentos e pichações

`js/xingamentos.js` monta xingamento com alvo, gênero, categoria, intensidade e
modelo. O texto continua determinístico: a mesma semente e as mesmas opções
produzem a mesma frase.

```js
gerarXingamento({
  alvo: 'Fulana',
  genero: 'f',
  tipo: 'politica',
  intensidade: 0.8,
  pixacao: true,
  random,
});
```

- `gerarXingamento` devolve só o texto; `gerarXingamentoDetalhado` devolve
  texto, modelo, insulto e intensificador usados.
- `tipo` filtra o repertório: `conduta`, `politica`, `eleitoral`, `violencia`,
  `carater`, `covardia`, `profano`, `estupidez` e `desprezo`.
- `intensidade` é a chance de acrescentar um intensificador curado, como
  `de merda`, `do caralho` ou `da porra`.
- `modelo` escolhe o formato: frase com verbo, possessivo, seco, fora, abaixo,
  ninguém aguenta, não presta, manchete, duplo, triplo, interrogação, sigla ou
  predicado.
- `genero` escolhe a forma masculina ou feminina. Substantivos de gênero fixo,
  como `lixo`, `bosta` e `anta`, guardam o artigo original.
- `pixacao` converte para maiúsculas e o texto respeita o limite de 180
  caracteres usado pelas pichações.

O banco atual tem 162 entradas, 16 intensificadores, 24 predicados e 13
modelos. Cada entrada traz forma masculina, forma feminina e categorias.

O projeto não traz slurs prontos. `js/xingamentos_preconceito.js` define uma
lista vazia para cada categoria de `PREJUDICE_TYPES`. O conteúdo entra por
revisão manual, uma entrada por termo:

```js
OFENSAS_POR_PRECONCEITO.racismo.push({id: 'termo-1', m: '...', f: '...'});
```

Também há `registrarOfensaPreconceito(tipo, entrada)` e
`removerOfensaPreconceito(tipo, id)` para cadastro em tempo de execução. `m` é
obrigatório; sem `f`, a forma masculina vale para os dois gêneros. Uma categoria
vazia falha com `sem ofensas cadastradas` em vez de inventar texto.

Com a categoria preenchida, `gerarOfensaPreconceito` e
`gerarOfensaPreconceitoDetalhado` usam os mesmos modelos e intensificadores do
xingamento comum, sem o modelo `predicado`. `graffitiDeOdio` aceita `message`
pronta ou gera o texto pela categoria:

```js
graffitiContent(city, citizen, {prejudiceType: 'racismo', alvo, genero});
```

`graffitiDeOdio` valida `prejudiceType` contra `PREJUDICE_CRIME_TYPES` e devolve
o rótulo do crime. `CityJustice.recordHateGraffiti` registra o caso com
`discriminatoryAct: true`, liga o caso de pichação ao caso de discriminação e
guarda `hateCaseId` na obra. Quando existe uma vítima cidadã, a pichação passa
por `recordPrejudiceAct`, com testemunhas, cooldown ignorado, incidente e
reputação. Sem vítima individual, o caso de discriminação é registrado com
vítima nula. As duas ocorrências recebem evidência `hate-graffiti` com
`artId` e `graffitiCaseId`, e o caso de pichação guarda `details.hateCaseId` e
`details.prejudiceType`.

`defaceArtwork` e as missões de pichação aceitam `mission.prejudiceType`. O
crime de pichação continua separado do crime de discriminação, mas os dois
ficam ligados para investigação, julgamento e pena.

### Peças multi-tile e texto maior

`js/city_graffiti_size.js` mede a superfície e converte o tamanho em orçamento
de texto:

- `graffitiTileSpan(support)` devolve largura, altura e a quantidade de tiles
  em cada eixo.
- `graffitiTextCapacity(support)` devolve quantos caracteres o desenho consegue
  distribuir sem encolher a fonte até ficar ilegível.
- `graffitiTextLimit(support)` devolve o limite persistido da mensagem.
- `graffitiCanvasSize(support)` devolve a resolução da textura.

Uma peça de um tile mantém o comportamento antigo: capacidade 34 e limite 180.
`graffitiContent` cresce com a área: 4x4 usa complexidade `variada` e limite
245; 7x9 usa `complexa`, até três frases e limite 486. Cada frase recebe cenas
do mesmo assunto, nunca palavras soltas, e os temas já usados não se repetem.
`graffitiContent`, `graffitiDeOdio`, `xingamentoGraffiti` e `createArtwork`
aceitam `support`; sem ele, o texto e o limite continuam iguais aos anteriores.
`xingamentoGraffiti` também aceita `support` para acrescentar até três
predicados curados em muros grandes, sem mudar a concordância.

`nearbyGraffitiSurfaces` monta retângulos de piso a partir de cada canto de
quadra pavimentada. Ofertas padrão: 1x1, 2x2, 3x3, 4x4, 5x5, 6x6, 7x9, 9x7,
7x7, 8x8, 9x9 e o retângulo máximo do lote. `graffitiSurfaceExists` valida
todos os tiles cobertos, então um buraco na calçada invalida o mural inteiro.
Muros continuam crescendo em faixas horizontais de até 12 tiles; fachadas
superiores também empilham andares sólidos consecutivos. O canvas acompanha a
proporção da peça (128 px por tile, mínimo de 256 px por eixo), então o texto
não estica em faixas compridas nem em murais altos.

## Determinismo

Toda função recebe `random` como parâmetro. A mesma semente produz o mesmo
texto, inclusive depois das variantes, relações e construções. Os testes de
graffiti e de justiça dependem disso.
