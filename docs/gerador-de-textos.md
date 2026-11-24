# Gerador de textos

O gerador produz frases, títulos, slogans e diálogos do jogo. A prioridade é
gramática e sentido; variedade vem depois, sem inventar palavra nem quebrar
concordância.

## Arquivos

- `js/gerador_textos.js`: motor. Guarda as cenas base e monta o discurso
  (relações, coesão, tempo verbal, voz, negação, advérbio, adjunto).
- `js/cenas_extra.js`: cenas adicionais, agrupadas por ator para permitir
  elipse de sujeito.
- `js/lexico_sinonimos.js`: variantes curadas de substantivos e verbos.
- `js/vocabulario.js`: catálogo de palavras, conjugação e reexportação da API
  pública (`gerarFrase`, `gerarFraseTematica`, `gerarTituloTematico`,
  `gerarSloganPartidario`, `gerarDialogoTematico`, `aquecerCatalogos`).
- `scripts/validar_lexico_sinonimos.mjs`: confere o léxico de variantes.
- `tests/vocabulario_qualidade.test.mjs`: regressão de gramática, construções e
  variedade.

## Cena

Cada cena é uma combinação plausível de sujeito, verbo no infinitivo, objeto
direto e complemento opcional:

```js
C('A prefeitura', 'reformar', 'a praça do bairro', 'f')
```

O objeto guarda artigo e gênero para a concordância do particípio na voz
passiva. O complemento é usado como está (lugar, modo, finalidade).

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

`js/cenas_extra.js` existe para garantir pares de mesmo ator em todos os temas.

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

Para vocabulário:

1. Acrescente a variante em `js/lexico_sinonimos.js`, mantendo gênero e número
   da chave.
2. Rode `node scripts/validar_lexico_sinonimos.mjs`.
3. Rode `node --test tests/vocabulario_qualidade.test.mjs`.

Para cenas:

1. Prefira criar um par com ator já existente no tema, em `js/cenas_extra.js`.
2. Mantenha verbo no infinitivo e objeto direto com artigo e gênero.
3. Rode a suíte de qualidade e confira amostras com sementes baixas.

Verbos exigem cuidado extra. Só entram na lista de variantes os que aceitam
qualquer objeto já usado nas cenas, sem preposição fixa e sem forma pronominal.

## Determinismo

Toda função recebe `random` como parâmetro. A mesma semente produz o mesmo
texto, inclusive depois das variantes, relações e construções. Os testes de
graffiti e de justiça dependem disso.
