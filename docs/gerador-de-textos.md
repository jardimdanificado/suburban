# Gerador de textos

O gerador produz frases, títulos, slogans e diálogos do jogo. A prioridade é
gramática e sentido; variedade vem depois, sem inventar palavra nem quebrar
concordância.

## Arquivos

- `js/gerador_textos.js`: motor. Guarda as cenas curadas e monta a oração
  (tempo verbal, voz passiva, negação, advérbio, adjunto, conectivo).
- `js/lexico_sinonimos.js`: variantes curadas de substantivos e verbos.
- `js/vocabulario.js`: catálogo de palavras, conjugação e reexportação da API
  pública (`gerarFrase`, `gerarFraseTematica`, `gerarTituloTematico`,
  `gerarSloganPartidario`, `gerarDialogoTematico`, `aquecerCatalogos`).
- `scripts/validar_lexico_sinonimos.mjs`: confere o léxico de variantes.
- `tests/vocabulario_qualidade.test.mjs`: regressão de gramática e variedade.

## Cena

Cada cena é uma combinação plausível de sujeito, verbo no infinitivo, objeto
direto e complemento opcional:

```js
C('A prefeitura', 'reformar', 'a praça do bairro', 'f')
```

O objeto guarda artigo e gênero para a concordância do particípio na voz
passiva. O complemento é usado como está (lugar, modo, finalidade).

## Variantes

O motor troca a palavra-chave da cena por um sinônimo do mesmo gênero e
número, com chance independente por campo:

- sujeito: só o núcleo, o token seguinte ao artigo;
- objeto: primeiro token com entrada no léxico, da esquerda para a direita;
- verbo: só em cena com objeto direto, porque `VERBOS_TRANSITIVOS` reúne
  verbos de transitividade direta.

No sujeito a busca não avança para o modificador preposicional. Sem essa
restrição, `O cinema de rua` viraria `O cinema de via`.

## Por que o léxico é curado

O catálogo tem 320 mil palavras, mas não guarda relação de sinonímia. Extrair
sinônimos de listas genéricas produziu pares como `praça -> forte` e
`iluminação -> ideia`, porque a lista mistura sentidos. Por isso a relação de
sinonímia é curada; o catálogo participa da validação:

- número (singular/plural) pelo lema;
- conjugação em todos os tempos usados pelo motor;
- ortografia pelo modelo spaCy `pt_core_news_md`, quando disponível.

## Como ampliar

1. Acrescente a variante em `js/lexico_sinonimos.js`, mantendo gênero e número
   da chave.
2. Rode `node scripts/validar_lexico_sinonimos.mjs`.
3. Rode `node --test tests/vocabulario_qualidade.test.mjs`.
4. Confira uma amostra com sementes baixas: frases simples repetem mais.

Verbos exigem cuidado extra. Só entram na lista os que aceitam qualquer objeto
já usado nas cenas, sem preposição fixa e sem forma pronominal.

## Determinismo

Toda função recebe `random` como parâmetro. A mesma semente produz o mesmo
texto, inclusive depois das variantes. Os testes de graffiti e de justiça
dependem disso.
