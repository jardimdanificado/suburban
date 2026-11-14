# Modelos botânicos de árvores

`js/botanical_trees.js` fornece 41 modelos determinísticos para árvores, palmeiras e plantas de folhas largas. Cada espécie define arquitetura, folhas, casca e estruturas reprodutivas. Coqueiro, árvore-do-viajante e vitória-régia continuam nos caminhos anteriores do renderizador.

As copas de árvores de folhas largas usam folhas dobradas e galhos, sem uma esfera sólida genérica. Palmeira-real tem estipe e palmito visual próprios; areca usa hastes agrupadas; jerivá tem folhas pinadas pendentes; buriti e licuala usam leques distintos. Mangue recebe raízes aéreas. Cacau, jaca e jabuticaba aparecem junto ao tronco. A amendoeira tem ramificação em andares. O atlas compartilhado contém textura de casca, nervuras e normais; a área recortada de folhagem serve ao interior da copa do pinheiro.

A geometria é criada uma vez por espécie visível e reutilizada em `InstancedMesh`. Cada modelo tem até 4.500 triângulos. O limite existente de 1.200 instâncias passa a valer por espécie. Só madeira participa das sombras: o material de profundidade elimina folhas, flores e frutos. O vento usa o relógio discreto `uSimTick` existente e mantém os pontos de inserção das folhas fixos. Flores e frutos ficam ocultos em plantas com tamanho visual inferior a 0,8.

As cores hexadecimais são convertidas de sRGB para linear por `vegetationColor`, como nas cores de materiais do Three.js. Isso evita o aspecto pastel que surge quando canais sRGB são enviados diretamente aos atributos de vértice. A árvore-do-viajante usa a mesma conversão e o verde do coqueiro como referência, mantendo sua geometria.

## Conferência

- `node --test tests/botanical_trees.test.mjs tests/fan_palm.test.mjs`: nove testes de cobertura das espécies, geometria, orçamento, frutos, vento, instâncias e preservação dos caminhos existentes.
- `/tests/botanical_trees_preview.html`: galeria das 41 espécies, com rotação e alternância entre jovem/adulta.
- `/tests/botanical_renderer_preview.html`: renderizador real, incluindo retenção de instâncias, troca dos materiais com/sem normais e presença dos três modelos preservados. Resultado: 41 modelos novos e zero erros de shader.

## Referências de morfologia

- [NParks — Terminalia catappa](https://www.nparks.gov.sg/florafaunaweb/flora/3/1/3181): copa em andares e folhas concentradas nas extremidades dos ramos.
- [NParks — Singapore’s International Trees](https://www.nparks.gov.sg/publications-resources/articles/singapore-s-international-trees): copa ampla do flamboyant.
- [Gardens by the Bay — Theobroma cacao](https://www.gardensbythebay.com.sg/en/learn-with-us/explore-resources/whats-blooming/cacao-theobroma.html): frutos no tronco e nos ramos lenhosos.
