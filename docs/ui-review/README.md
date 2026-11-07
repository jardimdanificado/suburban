# Revisão geral da interface

Abra `http://127.0.0.1:8000/docs/ui-review/` com o servidor habitual (`python3 scripts/serve.py` na raiz do projeto), ou abra `index.html` diretamente no navegador. O formulário é independente da simulação e não altera a cidade.

O inventário inclui as 19 janelas do desktop, abas dos módulos, subdivisões políticas, fichas por tipo, ferramentas e elementos gerais. Registros individuais repetidos são representados por um tipo de ficha; componentes e blocos internos sem navegação própria são avaliados no comentário da tela que os contém. Telas condicionais exigem registros correspondentes na simulação.

Cada item aceita uma das três classificações e comentário livre. As respostas são guardadas no armazenamento local deste navegador e desta origem. Exporte JSON para backup, compartilhamento e retomada por importação; o relatório Markdown serve para leitura e planejamento. Impressão respeita os filtros atuais. Os comentários são exportados mesmo se o item ainda não foi classificado.

Inventário extraído das definições `CITY_WINDOWS`, `VIEWS`, `POLITICS_SECTIONS` e das navegações implementadas nos renderizadores das fichas. Para atualizar o catálogo, execute `node scripts/build-ui-review-catalog.mjs` na raiz; o script também atualiza os dados incorporados no formulário. Os itens manuais devem acompanhar mudanças nas fichas e telas condicionais.
